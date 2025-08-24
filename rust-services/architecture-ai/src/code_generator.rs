use anyhow::Result;
use handlebars::{Handlebars, Template};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use tokio::fs;
use tracing::{info, debug, error};
use walkdir::WalkDir;

#[derive(Debug, Clone)]
pub struct CodeGenerator {
    handlebars: Handlebars<'static>,
    templates_dir: PathBuf,
    output_dir: PathBuf,
    templates: HashMap<String, ServiceTemplate>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceTemplate {
    pub template_id: String,
    pub name: String,
    pub description: String,
    pub language: String,
    pub framework: Option<String>,
    pub files: Vec<TemplateFile>,
    pub parameters: Vec<TemplateParameter>,
    pub dependencies: Vec<String>,
    pub post_generation_steps: Vec<PostGenerationStep>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateFile {
    pub source_path: String,
    pub target_path: String,
    pub is_template: bool,
    pub executable: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateParameter {
    pub name: String,
    pub parameter_type: String,
    pub description: String,
    pub default_value: Option<serde_json::Value>,
    pub required: bool,
    pub validation: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PostGenerationStep {
    pub step_type: String,
    pub description: String,
    pub command: Option<String>,
    pub parameters: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GeneratedFile {
    pub file_path: String,
    pub content_length: usize,
    pub generated_at: chrono::DateTime<chrono::Utc>,
    pub template_used: String,
}

impl CodeGenerator {
    pub async fn new(templates_dir: &str) -> Result<Self> {
        info!("🔧 Initializing Code Generator");

        let templates_path = PathBuf::from(templates_dir);
        let output_path = PathBuf::from("./generated");

        // Create directories if they don't exist
        fs::create_dir_all(&templates_path).await?;
        fs::create_dir_all(&output_path).await?;

        let mut handlebars = Handlebars::new();
        handlebars.set_strict_mode(true);

        let mut generator = Self {
            handlebars,
            templates_dir: templates_path,
            output_dir: output_path,
            templates: HashMap::new(),
        };

        // Load all available templates
        generator.load_templates().await?;
        generator.register_helpers();

        info!("✅ Code generator initialized with {} templates", generator.templates.len());

        Ok(generator)
    }

    pub async fn generate_service(&self, template_id: &str, parameters: HashMap<String, serde_json::Value>) -> Result<Vec<GeneratedFile>> {
        info!("🔧 Generating service from template: {}", template_id);

        let template = self.templates.get(template_id)
            .ok_or_else(|| anyhow::anyhow!("Template not found: {}", template_id))?;

        debug!("Using template: {} ({})", template.name, template.description);

        // Validate parameters
        self.validate_parameters(template, &parameters)?;

        let mut generated_files = Vec::new();
        let service_name = parameters.get("service_name")
            .and_then(|v| v.as_str())
            .unwrap_or("generated_service");

        let output_dir = self.output_dir.join(service_name);
        fs::create_dir_all(&output_dir).await?;

        // Process each template file
        for template_file in &template.files {
            let generated_file = self.process_template_file(
                template,
                template_file,
                &parameters,
                &output_dir,
            ).await?;

            generated_files.push(generated_file);
        }

        // Execute post-generation steps
        self.execute_post_generation_steps(template, &parameters, &output_dir).await?;

        info!("✅ Generated {} files for service: {}", generated_files.len(), service_name);

        Ok(generated_files)
    }

    async fn process_template_file(
        &self,
        template: &ServiceTemplate,
        template_file: &TemplateFile,
        parameters: &HashMap<String, serde_json::Value>,
        output_dir: &Path,
    ) -> Result<GeneratedFile> {
        let source_path = self.templates_dir
            .join(&template.template_id)
            .join(&template_file.source_path);

        let target_path = output_dir.join(&template_file.target_path);

        // Create parent directories if they don't exist
        if let Some(parent) = target_path.parent() {
            fs::create_dir_all(parent).await?;
        }

        let content = if template_file.is_template {
            // Process as Handlebars template
            let template_content = fs::read_to_string(&source_path).await?;
            self.handlebars.render_template(&template_content, parameters)?
        } else {
            // Copy file as-is
            fs::read_to_string(&source_path).await?
        };

        // Write the processed content
        fs::write(&target_path, &content).await?;

        // Set executable permissions if needed
        #[cfg(unix)]
        if template_file.executable {
            use std::os::unix::fs::PermissionsExt;
            let mut perms = fs::metadata(&target_path).await?.permissions();
            perms.set_mode(0o755);
            fs::set_permissions(&target_path, perms).await?;
        }

        debug!("Generated file: {} ({} bytes)", target_path.display(), content.len());

        Ok(GeneratedFile {
            file_path: target_path.to_string_lossy().to_string(),
            content_length: content.len(),
            generated_at: chrono::Utc::now(),
            template_used: template.template_id.clone(),
        })
    }

    async fn execute_post_generation_steps(
        &self,
        template: &ServiceTemplate,
        parameters: &HashMap<String, serde_json::Value>,
        output_dir: &Path,
    ) -> Result<()> {
        for step in &template.post_generation_steps {
            debug!("Executing post-generation step: {}", step.description);

            match step.step_type.as_str() {
                "command" => {
                    if let Some(command) = &step.command {
                        self.execute_command(command, output_dir, parameters).await?;
                    }
                }
                "file_operation" => {
                    self.execute_file_operation(step, output_dir, parameters).await?;
                }
                "dependency_install" => {
                    self.install_dependencies(template, output_dir).await?;
                }
                _ => {
                    debug!("Unknown post-generation step type: {}", step.step_type);
                }
            }
        }

        Ok(())
    }

    async fn execute_command(&self, command: &str, working_dir: &Path, parameters: &HashMap<String, serde_json::Value>) -> Result<()> {
        let rendered_command = self.handlebars.render_template(command, parameters)?;
        
        debug!("Executing command: {}", rendered_command);

        let output = tokio::process::Command::new("sh")
            .arg("-c")
            .arg(&rendered_command)
            .current_dir(working_dir)
            .output()
            .await?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            error!("Command failed: {}\nError: {}", rendered_command, stderr);
            return Err(anyhow::anyhow!("Command failed: {}", stderr));
        }

        Ok(())
    }

    async fn execute_file_operation(&self, step: &PostGenerationStep, output_dir: &Path, _parameters: &HashMap<String, serde_json::Value>) -> Result<()> {
        match step.parameters.get("operation").and_then(|v| v.as_str()) {
            Some("create_directory") => {
                if let Some(dir_path) = step.parameters.get("path").and_then(|v| v.as_str()) {
                    let full_path = output_dir.join(dir_path);
                    fs::create_dir_all(full_path).await?;
                }
            }
            Some("copy_file") => {
                if let Some(src) = step.parameters.get("source").and_then(|v| v.as_str()) {
                    if let Some(dst) = step.parameters.get("destination").and_then(|v| v.as_str()) {
                        let src_path = output_dir.join(src);
                        let dst_path = output_dir.join(dst);
                        fs::copy(src_path, dst_path).await?;
                    }
                }
            }
            _ => {
                debug!("Unknown file operation in post-generation step");
            }
        }

        Ok(())
    }

    async fn install_dependencies(&self, template: &ServiceTemplate, output_dir: &Path) -> Result<()> {
        match template.language.as_str() {
            "rust" => {
                // Run cargo build
                self.execute_command("cargo build", output_dir, &HashMap::new()).await?;
            }
            "go" => {
                // Run go mod tidy
                self.execute_command("go mod tidy", output_dir, &HashMap::new()).await?;
            }
            "typescript" | "javascript" => {
                // Run npm install
                self.execute_command("npm install", output_dir, &HashMap::new()).await?;
            }
            "python" => {
                // Install requirements if they exist
                let requirements_path = output_dir.join("requirements.txt");
                if requirements_path.exists() {
                    self.execute_command("pip install -r requirements.txt", output_dir, &HashMap::new()).await?;
                }
            }
            _ => {
                debug!("No dependency installation configured for language: {}", template.language);
            }
        }

        Ok(())
    }

    fn validate_parameters(&self, template: &ServiceTemplate, parameters: &HashMap<String, serde_json::Value>) -> Result<()> {
        for param in &template.parameters {
            if param.required && !parameters.contains_key(&param.name) {
                return Err(anyhow::anyhow!("Required parameter missing: {}", param.name));
            }

            if let Some(value) = parameters.get(&param.name) {
                // Basic type validation
                match param.parameter_type.as_str() {
                    "string" => {
                        if !value.is_string() {
                            return Err(anyhow::anyhow!("Parameter {} must be a string", param.name));
                        }
                    }
                    "number" => {
                        if !value.is_number() {
                            return Err(anyhow::anyhow!("Parameter {} must be a number", param.name));
                        }
                    }
                    "boolean" => {
                        if !value.is_boolean() {
                            return Err(anyhow::anyhow!("Parameter {} must be a boolean", param.name));
                        }
                    }
                    _ => {
                        // No validation for other types
                    }
                }

                // Custom validation if specified
                if let Some(validation_pattern) = &param.validation {
                    if param.parameter_type == "string" {
                        let string_value = value.as_str().unwrap();
                        let regex = regex::Regex::new(validation_pattern)?;
                        if !regex.is_match(string_value) {
                            return Err(anyhow::anyhow!("Parameter {} does not match validation pattern", param.name));
                        }
                    }
                }
            }
        }

        Ok(())
    }

    fn register_helpers(&mut self) {
        // Register custom Handlebars helpers
        self.handlebars.register_helper("snake_case", Box::new(snake_case_helper));
        self.handlebars.register_helper("camel_case", Box::new(camel_case_helper));
        self.handlebars.register_helper("pascal_case", Box::new(pascal_case_helper));
        self.handlebars.register_helper("kebab_case", Box::new(kebab_case_helper));
        self.handlebars.register_helper("uppercase", Box::new(uppercase_helper));
        self.handlebars.register_helper("lowercase", Box::new(lowercase_helper));
    }

    async fn load_templates(&mut self) -> Result<()> {
        // Create default templates if they don't exist
        self.create_default_templates().await?;

        // Scan templates directory
        if !self.templates_dir.exists() {
            return Ok(());
        }

        for entry in WalkDir::new(&self.templates_dir).max_depth(2) {
            let entry = entry?;
            let path = entry.path();

            if path.is_file() && path.file_name() == Some(std::ffi::OsStr::new("template.toml")) {
                if let Some(template_dir) = path.parent() {
                    match self.load_template_from_dir(template_dir).await {
                        Ok(template) => {
                            debug!("Loaded template: {}", template.template_id);
                            self.templates.insert(template.template_id.clone(), template);
                        }
                        Err(e) => {
                            error!("Failed to load template from {}: {}", template_dir.display(), e);
                        }
                    }
                }
            }
        }

        Ok(())
    }

    async fn load_template_from_dir(&self, template_dir: &Path) -> Result<ServiceTemplate> {
        let config_path = template_dir.join("template.toml");
        let config_content = fs::read_to_string(config_path).await?;
        let template: ServiceTemplate = toml::from_str(&config_content)?;
        Ok(template)
    }

    async fn create_default_templates(&self) -> Result<()> {
        // Create Rust service template
        self.create_rust_service_template().await?;
        
        // Create Go service template
        self.create_go_service_template().await?;

        Ok(())
    }

    async fn create_rust_service_template(&self) -> Result<()> {
        let template_dir = self.templates_dir.join("rust_service");
        fs::create_dir_all(&template_dir).await?;

        let template_config = ServiceTemplate {
            template_id: "rust_service".to_string(),
            name: "Rust Microservice".to_string(),
            description: "A high-performance Rust microservice with Axum web framework".to_string(),
            language: "rust".to_string(),
            framework: Some("axum".to_string()),
            files: vec![
                TemplateFile {
                    source_path: "Cargo.toml.hbs".to_string(),
                    target_path: "Cargo.toml".to_string(),
                    is_template: true,
                    executable: false,
                },
                TemplateFile {
                    source_path: "src/main.rs.hbs".to_string(),
                    target_path: "src/main.rs".to_string(),
                    is_template: true,
                    executable: false,
                },
                TemplateFile {
                    source_path: "src/config.rs.hbs".to_string(),
                    target_path: "src/config.rs".to_string(),
                    is_template: true,
                    executable: false,
                },
            ],
            parameters: vec![
                TemplateParameter {
                    name: "service_name".to_string(),
                    parameter_type: "string".to_string(),
                    description: "Name of the service".to_string(),
                    default_value: Some(serde_json::json!("my_service")),
                    required: true,
                    validation: Some(r"^[a-z][a-z0-9_]*$".to_string()),
                },
                TemplateParameter {
                    name: "port".to_string(),
                    parameter_type: "number".to_string(),
                    description: "Port number for the service".to_string(),
                    default_value: Some(serde_json::json!(8080)),
                    required: false,
                    validation: None,
                },
            ],
            dependencies: vec!["tokio".to_string(), "axum".to_string(), "serde".to_string()],
            post_generation_steps: vec![
                PostGenerationStep {
                    step_type: "command".to_string(),
                    description: "Format code with rustfmt".to_string(),
                    command: Some("cargo fmt".to_string()),
                    parameters: HashMap::new(),
                },
            ],
        };

        let config_path = template_dir.join("template.toml");
        let config_content = toml::to_string_pretty(&template_config)?;
        fs::write(config_path, config_content).await?;

        // Create template files
        self.create_rust_template_files(&template_dir).await?;

        Ok(())
    }

    async fn create_rust_template_files(&self, template_dir: &Path) -> Result<()> {
        let src_dir = template_dir.join("src");
        fs::create_dir_all(&src_dir).await?;

        // Cargo.toml template
        let cargo_toml = r#"[package]
name = "{{service_name}}"
version = "0.1.0"
edition = "2021"
description = "Generated Rust microservice"

[dependencies]
tokio = { version = "1.0", features = ["full"] }
axum = "0.7"
tower = "0.4"
tower-http = { version = "0.5", features = ["cors"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
anyhow = "1.0"
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }

[[bin]]
name = "{{service_name}}"
path = "src/main.rs"
"#;
        fs::write(template_dir.join("Cargo.toml.hbs"), cargo_toml).await?;

        // main.rs template
        let main_rs = r#"use axum::{
    response::Json,
    routing::get,
    Router,
};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use tokio::net::TcpListener;
use tracing::{info, error};

mod config;
use config::Config;

#[derive(Serialize, Deserialize)]
struct HealthResponse {
    status: String,
    service: String,
    version: String,
    timestamp: chrono::DateTime<chrono::Utc>,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter("{{service_name}}=debug")
        .init();

    info!("🚀 Starting {{service_name}}");

    // Load configuration
    let config = Config::from_env()?;
    
    // Build application routes
    let app = Router::new()
        .route("/health", get(health_check));

    // Start server
    let addr = SocketAddr::from(([0, 0, 0, 0], {{port}}));
    let listener = TcpListener::bind(&addr).await?;
    
    info!("🚀 {{service_name}} listening on port {{port}}");

    axum::serve(listener, app).await?;

    Ok(())
}

async fn health_check() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "healthy".to_string(),
        service: "{{service_name}}".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        timestamp: chrono::Utc::now(),
    })
}
"#;
        fs::write(src_dir.join("main.rs.hbs"), main_rs).await?;

        // config.rs template
        let config_rs = r#"use serde::{Deserialize, Serialize};
use std::env;
use anyhow::Result;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub server: ServerConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    pub port: u16,
    pub host: String,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        Ok(Config {
            server: ServerConfig {
                port: env::var("{{uppercase service_name}}_PORT")
                    .unwrap_or_else(|_| "{{port}}".to_string())
                    .parse()?,
                host: env::var("{{uppercase service_name}}_HOST")
                    .unwrap_or_else(|_| "0.0.0.0".to_string()),
            },
        })
    }
}

impl Default for Config {
    fn default() -> Self {
        Config {
            server: ServerConfig {
                port: {{port}},
                host: "0.0.0.0".to_string(),
            },
        }
    }
}
"#;
        fs::write(src_dir.join("config.rs.hbs"), config_rs).await?;

        Ok(())
    }

    async fn create_go_service_template(&self) -> Result<()> {
        // Similar implementation for Go service template
        // For brevity, this is simplified
        let template_dir = self.templates_dir.join("go_service");
        fs::create_dir_all(&template_dir).await?;

        let template_config = ServiceTemplate {
            template_id: "go_service".to_string(),
            name: "Go Microservice".to_string(),
            description: "A Go microservice with Gin web framework".to_string(),
            language: "go".to_string(),
            framework: Some("gin".to_string()),
            files: vec![
                TemplateFile {
                    source_path: "main.go.hbs".to_string(),
                    target_path: "main.go".to_string(),
                    is_template: true,
                    executable: false,
                },
                TemplateFile {
                    source_path: "go.mod.hbs".to_string(),
                    target_path: "go.mod".to_string(),
                    is_template: true,
                    executable: false,
                },
            ],
            parameters: vec![
                TemplateParameter {
                    name: "service_name".to_string(),
                    parameter_type: "string".to_string(),
                    description: "Name of the service".to_string(),
                    default_value: Some(serde_json::json!("my_service")),
                    required: true,
                    validation: None,
                },
            ],
            dependencies: vec!["gin".to_string()],
            post_generation_steps: vec![
                PostGenerationStep {
                    step_type: "dependency_install".to_string(),
                    description: "Install Go dependencies".to_string(),
                    command: None,
                    parameters: HashMap::new(),
                },
            ],
        };

        let config_path = template_dir.join("template.toml");
        let config_content = toml::to_string_pretty(&template_config)?;
        fs::write(config_path, config_content).await?;

        Ok(())
    }

    pub async fn list_templates(&self) -> Result<Vec<ServiceTemplate>> {
        Ok(self.templates.values().cloned().collect())
    }
}

// Handlebars helper functions
fn snake_case_helper(
    h: &handlebars::Helper,
    _: &handlebars::Handlebars,
    _: &handlebars::Context,
    _rc: &mut handlebars::RenderContext,
    out: &mut dyn handlebars::Output,
) -> handlebars::HelperResult {
    if let Some(param) = h.param(0) {
        let value = param.value().as_str().unwrap_or("");
        let snake_case = value.to_lowercase().replace("-", "_").replace(" ", "_");
        out.write(&snake_case)?;
    }
    Ok(())
}

fn camel_case_helper(
    h: &handlebars::Helper,
    _: &handlebars::Handlebars,
    _: &handlebars::Context,
    _rc: &mut handlebars::RenderContext,
    out: &mut dyn handlebars::Output,
) -> handlebars::HelperResult {
    if let Some(param) = h.param(0) {
        let value = param.value().as_str().unwrap_or("");
        let camel_case = value.split(|c: char| c == '_' || c == '-' || c == ' ')
            .enumerate()
            .map(|(i, s)| {
                if i == 0 {
                    s.to_lowercase()
                } else {
                    let mut chars = s.chars();
                    match chars.next() {
                        None => String::new(),
                        Some(first) => first.to_uppercase().collect::<String>() + &chars.collect::<String>().to_lowercase(),
                    }
                }
            })
            .collect::<String>();
        out.write(&camel_case)?;
    }
    Ok(())
}

fn pascal_case_helper(
    h: &handlebars::Helper,
    _: &handlebars::Handlebars,
    _: &handlebars::Context,
    _rc: &mut handlebars::RenderContext,
    out: &mut dyn handlebars::Output,
) -> handlebars::HelperResult {
    if let Some(param) = h.param(0) {
        let value = param.value().as_str().unwrap_or("");
        let pascal_case = value.split(|c: char| c == '_' || c == '-' || c == ' ')
            .map(|s| {
                let mut chars = s.chars();
                match chars.next() {
                    None => String::new(),
                    Some(first) => first.to_uppercase().collect::<String>() + &chars.collect::<String>().to_lowercase(),
                }
            })
            .collect::<String>();
        out.write(&pascal_case)?;
    }
    Ok(())
}

fn kebab_case_helper(
    h: &handlebars::Helper,
    _: &handlebars::Handlebars,
    _: &handlebars::Context,
    _rc: &mut handlebars::RenderContext,
    out: &mut dyn handlebars::Output,
) -> handlebars::HelperResult {
    if let Some(param) = h.param(0) {
        let value = param.value().as_str().unwrap_or("");
        let kebab_case = value.to_lowercase().replace("_", "-").replace(" ", "-");
        out.write(&kebab_case)?;
    }
    Ok(())
}

fn uppercase_helper(
    h: &handlebars::Helper,
    _: &handlebars::Handlebars,
    _: &handlebars::Context,
    _rc: &mut handlebars::RenderContext,
    out: &mut dyn handlebars::Output,
) -> handlebars::HelperResult {
    if let Some(param) = h.param(0) {
        let value = param.value().as_str().unwrap_or("");
        out.write(&value.to_uppercase())?;
    }
    Ok(())
}

fn lowercase_helper(
    h: &handlebars::Helper,
    _: &handlebars::Handlebars,
    _: &handlebars::Context,
    _rc: &mut handlebars::RenderContext,
    out: &mut dyn handlebars::Output,
) -> handlebars::HelperResult {
    if let Some(param) = h.param(0) {
        let value = param.value().as_str().unwrap_or("");
        out.write(&value.to_lowercase())?;
    }
    Ok(())
}