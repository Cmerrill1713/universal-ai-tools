use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub server: ServerConfig,
    pub documentation: DocumentationConfig,
    pub analysis: AnalysisConfig,
    pub templates: TemplateConfig,
    pub export: ExportConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
    pub workers: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentationConfig {
    pub output_dir: PathBuf,
    pub temp_dir: PathBuf,
    pub max_file_size: u64,
    pub supported_languages: Vec<String>,
    pub default_template_style: String,
    pub include_git_info: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisConfig {
    pub max_depth: usize,
    pub ignore_patterns: Vec<String>,
    pub complexity_threshold: f64,
    pub analyze_dependencies: bool,
    pub extract_comments: bool,
    pub include_private_members: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateConfig {
    pub template_dir: PathBuf,
    pub custom_templates: Vec<String>,
    pub theme: String,
    pub enable_syntax_highlighting: bool,
    pub code_theme: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportConfig {
    pub pdf_engine: String,
    pub html_minify: bool,
    pub compress_output: bool,
    pub max_export_size: u64,
    pub watermark_enabled: bool,
    pub watermark_text: Option<String>,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            server: ServerConfig {
                host: "127.0.0.1".to_string(),
                port: 8087,
                workers: num_cpus::get(),
            },
            documentation: DocumentationConfig {
                output_dir: PathBuf::from("./documentation_output"),
                temp_dir: PathBuf::from("./temp"),
                max_file_size: 50 * 1024 * 1024, // 50MB
                supported_languages: vec![
                    "rust".to_string(),
                    "typescript".to_string(),
                    "javascript".to_string(),
                    "python".to_string(),
                    "go".to_string(),
                    "swift".to_string(),
                    "java".to_string(),
                    "c".to_string(),
                    "cpp".to_string(),
                ],
                default_template_style: "modern".to_string(),
                include_git_info: true,
            },
            analysis: AnalysisConfig {
                max_depth: 10,
                ignore_patterns: vec![
                    "node_modules".to_string(),
                    "target".to_string(),
                    ".git".to_string(),
                    "dist".to_string(),
                    "build".to_string(),
                    "*.min.js".to_string(),
                    "*.map".to_string(),
                ],
                complexity_threshold: 10.0,
                analyze_dependencies: true,
                extract_comments: true,
                include_private_members: false,
            },
            templates: TemplateConfig {
                template_dir: PathBuf::from("./templates"),
                custom_templates: Vec::new(),
                theme: "default".to_string(),
                enable_syntax_highlighting: true,
                code_theme: "github".to_string(),
            },
            export: ExportConfig {
                pdf_engine: "wkhtmltopdf".to_string(),
                html_minify: true,
                compress_output: true,
                max_export_size: 100 * 1024 * 1024, // 100MB
                watermark_enabled: false,
                watermark_text: None,
            },
        }
    }
}

impl Config {
    pub async fn new() -> Result<Self> {
        // Try to load from config file, fall back to default
        let config_path = std::env::var("DOCGEN_CONFIG_PATH")
            .unwrap_or_else(|_| "./config/documentation-generator.toml".to_string());
        
        if std::path::Path::new(&config_path).exists() {
            Self::from_file(&config_path).await
        } else {
            tracing::info!("Config file not found, using default configuration");
            Ok(Self::default())
        }
    }

    pub async fn from_file(path: &str) -> Result<Self> {
        let content = tokio::fs::read_to_string(path).await?;
        let config: Config = toml::from_str(&content)?;
        
        // Ensure directories exist
        config.ensure_directories().await?;
        
        tracing::info!("Configuration loaded from: {}", path);
        Ok(config)
    }

    async fn ensure_directories(&self) -> Result<()> {
        // Create output directory
        if !self.documentation.output_dir.exists() {
            tokio::fs::create_dir_all(&self.documentation.output_dir).await?;
            tracing::info!("Created output directory: {:?}", self.documentation.output_dir);
        }

        // Create temp directory
        if !self.documentation.temp_dir.exists() {
            tokio::fs::create_dir_all(&self.documentation.temp_dir).await?;
            tracing::info!("Created temp directory: {:?}", self.documentation.temp_dir);
        }

        // Create template directory
        if !self.templates.template_dir.exists() {
            tokio::fs::create_dir_all(&self.templates.template_dir).await?;
            tracing::info!("Created template directory: {:?}", self.templates.template_dir);
        }

        Ok(())
    }

    pub fn get_output_path(&self, generation_id: &str) -> PathBuf {
        self.documentation.output_dir.join(generation_id)
    }

    pub fn get_temp_path(&self, generation_id: &str) -> PathBuf {
        self.documentation.temp_dir.join(generation_id)
    }

    pub fn is_supported_language(&self, extension: &str) -> bool {
        let language = match extension {
            "rs" => "rust",
            "ts" => "typescript", 
            "js" => "javascript",
            "py" => "python",
            "go" => "go",
            "swift" => "swift",
            "java" => "java",
            "c" => "c",
            "cpp" | "cc" | "cxx" => "cpp",
            _ => return false,
        };
        
        self.documentation.supported_languages.contains(&language.to_string())
    }

    pub fn should_ignore(&self, path: &std::path::Path) -> bool {
        let path_str = path.to_string_lossy();
        
        for pattern in &self.analysis.ignore_patterns {
            if path_str.contains(pattern) {
                return true;
            }
            
            // Simple glob pattern matching for *.ext patterns
            if pattern.starts_with("*.") {
                let extension = &pattern[2..];
                if let Some(ext) = path.extension() {
                    if ext == extension {
                        return true;
                    }
                }
            }
        }
        
        false
    }

    pub fn validate(&self) -> Result<()> {
        if self.server.port == 0 {
            return Err(anyhow::anyhow!("Server port must be greater than 0"));
        }

        if self.server.workers == 0 {
            return Err(anyhow::anyhow!("Server workers must be greater than 0"));
        }

        if self.analysis.max_depth == 0 {
            return Err(anyhow::anyhow!("Analysis max depth must be greater than 0"));
        }

        if self.analysis.complexity_threshold < 0.0 {
            return Err(anyhow::anyhow!("Complexity threshold must be non-negative"));
        }

        if self.documentation.max_file_size == 0 {
            return Err(anyhow::anyhow!("Max file size must be greater than 0"));
        }

        if self.export.max_export_size == 0 {
            return Err(anyhow::anyhow!("Max export size must be greater than 0"));
        }

        Ok(())
    }
}