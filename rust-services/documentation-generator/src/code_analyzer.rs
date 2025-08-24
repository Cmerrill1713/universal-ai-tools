use anyhow::{anyhow, Result};
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;
use tracing::{debug, error, info, warn};
use walkdir::WalkDir;

use crate::config::Config;
use crate::{
    ProjectAnalysis, LanguageStats, ArchitectureInfo, ComponentInfo, 
    ApiEndpoint, ApiParameter, ApiResponse, DependencyInfo, ComplexityMetrics
};

#[derive(Debug, Clone)]
pub struct CodeAnalyzer {
    config: Config,
    complexity_patterns: HashMap<String, Vec<Regex>>,
    api_patterns: HashMap<String, Vec<Regex>>,
}

impl CodeAnalyzer {
    pub async fn new(config: &Config) -> Result<Self> {
        let mut analyzer = Self {
            config: config.clone(),
            complexity_patterns: HashMap::new(),
            api_patterns: HashMap::new(),
        };

        analyzer.initialize_patterns().await?;
        info!("🔍 Code Analyzer initialized");
        Ok(analyzer)
    }

    async fn initialize_patterns(&mut self) -> Result<()> {
        // Initialize complexity patterns for different languages
        self.init_complexity_patterns()?;
        
        // Initialize API endpoint patterns
        self.init_api_patterns()?;
        
        Ok(())
    }

    fn init_complexity_patterns(&mut self) -> Result<()> {
        // Rust patterns
        let rust_patterns = vec![
            Regex::new(r"if\s+")?,           // If statements
            Regex::new(r"else\s+")?,         // Else statements
            Regex::new(r"while\s+")?,        // While loops
            Regex::new(r"for\s+")?,          // For loops
            Regex::new(r"match\s+")?,        // Match expressions
            Regex::new(r"loop\s*\{")?,       // Loop statements
            Regex::new(r"\|\s*\w+\s*\|")?,   // Closures
            Regex::new(r"async\s+fn")?,      // Async functions
        ];
        self.complexity_patterns.insert("rust".to_string(), rust_patterns);

        // TypeScript/JavaScript patterns
        let ts_patterns = vec![
            Regex::new(r"if\s*\(")?,
            Regex::new(r"else\s*")?,
            Regex::new(r"while\s*\(")?,
            Regex::new(r"for\s*\(")?,
            Regex::new(r"switch\s*\(")?,
            Regex::new(r"case\s+")?,
            Regex::new(r"catch\s*\(")?,
            Regex::new(r"function\s+\w+")?,
            Regex::new(r"=>\s*")?,           // Arrow functions
        ];
        self.complexity_patterns.insert("typescript".to_string(), ts_patterns.clone());
        self.complexity_patterns.insert("javascript".to_string(), ts_patterns);

        // Python patterns
        let python_patterns = vec![
            Regex::new(r"if\s+")?,
            Regex::new(r"elif\s+")?,
            Regex::new(r"else:")?,
            Regex::new(r"while\s+")?,
            Regex::new(r"for\s+")?,
            Regex::new(r"try:")?,
            Regex::new(r"except\s*")?,
            Regex::new(r"def\s+\w+")?,
            Regex::new(r"lambda\s+")?,
        ];
        self.complexity_patterns.insert("python".to_string(), python_patterns);

        // Go patterns
        let go_patterns = vec![
            Regex::new(r"if\s+")?,
            Regex::new(r"else\s*\{")?,
            Regex::new(r"for\s+")?,
            Regex::new(r"switch\s+")?,
            Regex::new(r"case\s+")?,
            Regex::new(r"select\s*\{")?,
            Regex::new(r"func\s+\w+")?,
            Regex::new(r"go\s+")?,           // Goroutines
        ];
        self.complexity_patterns.insert("go".to_string(), go_patterns);

        Ok(())
    }

    fn init_api_patterns(&mut self) -> Result<()> {
        // REST API patterns
        let api_patterns = vec![
            Regex::new(r#"@(?:Get|Post|Put|Delete|Patch)\s*\(\s*"([^"]*)"#)?,
            Regex::new(r#"\.get\s*\(\s*["']([^"']*)["']"#)?,
            Regex::new(r#"\.post\s*\(\s*["']([^"']*)["']"#)?,
            Regex::new(r#"\.put\s*\(\s*["']([^"']*)["']"#)?,
            Regex::new(r#"\.delete\s*\(\s*["']([^"']*)["']"#)?,
            Regex::new(r#"\.patch\s*\(\s*["']([^"']*)["']"#)?,
            Regex::new(r#"route\s*\(\s*["']([^"']*)["']"#)?,
            Regex::new(r#"app\.(get|post|put|delete|patch)\s*\(\s*["']([^"']*)["']"#)?,
        ];
        self.api_patterns.insert("api".to_string(), api_patterns);

        Ok(())
    }

    pub async fn analyze_project(&self, project_path: &str) -> Result<ProjectAnalysis> {
        info!("🔍 Starting project analysis: {}", project_path);

        let project_path = Path::new(project_path);
        if !project_path.exists() {
            return Err(anyhow!("Project path does not exist: {}", project_path.display()));
        }

        // Analyze languages and files
        let languages = self.analyze_languages(project_path).await?;
        
        // Analyze architecture
        let architecture_overview = self.analyze_architecture(project_path).await?;
        
        // Extract API endpoints
        let api_endpoints = self.extract_api_endpoints(project_path).await?;
        
        // Analyze dependencies
        let dependencies = self.analyze_dependencies(project_path).await?;
        
        // Calculate complexity metrics
        let complexity_metrics = self.calculate_complexity_metrics(project_path).await?;

        let project_name = project_path.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("Unknown Project")
            .to_string();

        let analysis = ProjectAnalysis {
            project_name,
            languages,
            architecture_overview,
            api_endpoints,
            dependencies,
            complexity_metrics,
        };

        info!("✅ Project analysis completed for: {}", analysis.project_name);
        Ok(analysis)
    }

    async fn analyze_languages(&self, project_path: &Path) -> Result<HashMap<String, LanguageStats>> {
        let mut languages: HashMap<String, LanguageStats> = HashMap::new();
        let mut total_files = 0;
        let mut total_lines = 0;

        for entry in WalkDir::new(project_path)
            .max_depth(self.config.analysis.max_depth)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().is_file())
        {
            if self.config.should_ignore(entry.path()) {
                continue;
            }

            if let Some(extension) = entry.path().extension() {
                if let Some(ext_str) = extension.to_str() {
                    let language = self.extension_to_language(ext_str);
                    
                    if let Some(lang) = language {
                        total_files += 1;
                        
                        // Count lines and calculate complexity
                        if let Ok(content) = tokio::fs::read_to_string(entry.path()).await {
                            let line_count = content.lines().count() as u32;
                            total_lines += line_count;
                            
                            let complexity = self.calculate_file_complexity(&content, &lang).await;
                            
                            let stats = languages.entry(lang).or_insert(LanguageStats {
                                file_count: 0,
                                line_count: 0,
                                percentage: 0.0,
                                complexity_score: 0.0,
                            });
                            
                            stats.file_count += 1;
                            stats.line_count += line_count;
                            stats.complexity_score = (stats.complexity_score + complexity) / 2.0; // Average
                        }
                    }
                }
            }
        }

        // Calculate percentages
        for stats in languages.values_mut() {
            stats.percentage = (stats.line_count as f64 / total_lines as f64) * 100.0;
        }

        debug!("📊 Analyzed {} files with {} total lines across {} languages", 
               total_files, total_lines, languages.len());

        Ok(languages)
    }

    fn extension_to_language(&self, extension: &str) -> Option<String> {
        match extension {
            "rs" => Some("rust".to_string()),
            "ts" | "tsx" => Some("typescript".to_string()),
            "js" | "jsx" => Some("javascript".to_string()),
            "py" => Some("python".to_string()),
            "go" => Some("go".to_string()),
            "swift" => Some("swift".to_string()),
            "java" => Some("java".to_string()),
            "c" => Some("c".to_string()),
            "cpp" | "cc" | "cxx" => Some("cpp".to_string()),
            _ => None,
        }
    }

    async fn calculate_file_complexity(&self, content: &str, language: &str) -> f64 {
        if let Some(patterns) = self.complexity_patterns.get(language) {
            let mut complexity = 1.0; // Base complexity
            
            for pattern in patterns {
                let matches = pattern.find_iter(content).count();
                complexity += matches as f64;
            }
            
            // Additional complexity factors
            let line_count = content.lines().count();
            let function_count = self.count_functions(content, language);
            let nesting_depth = self.calculate_max_nesting_depth(content);
            
            // Weighted complexity calculation
            complexity += (line_count as f64 / 100.0) * 0.1; // Lines contribute minimally
            complexity += function_count as f64 * 0.5; // Functions add moderate complexity
            complexity += nesting_depth as f64 * 2.0; // Deep nesting significantly increases complexity
            
            complexity
        } else {
            1.0 // Default complexity for unknown languages
        }
    }

    fn count_functions(&self, content: &str, language: &str) -> usize {
        let function_pattern = match language {
            "rust" => Regex::new(r"fn\s+\w+").ok(),
            "typescript" | "javascript" => Regex::new(r"function\s+\w+|=>\s*|:\s*\(\s*\)\s*=>").ok(),
            "python" => Regex::new(r"def\s+\w+").ok(),
            "go" => Regex::new(r"func\s+\w+").ok(),
            "swift" => Regex::new(r"func\s+\w+").ok(),
            "java" => Regex::new(r"(public|private|protected)?\s*(static\s+)?\w+\s+\w+\s*\(").ok(),
            _ => None,
        };
        
        function_pattern.map_or(0, |pattern| pattern.find_iter(content).count())
    }

    fn calculate_max_nesting_depth(&self, content: &str) -> usize {
        let mut max_depth = 0;
        let mut current_depth = 0;
        
        for char in content.chars() {
            match char {
                '{' => {
                    current_depth += 1;
                    max_depth = max_depth.max(current_depth);
                },
                '}' => {
                    if current_depth > 0 {
                        current_depth -= 1;
                    }
                },
                _ => {},
            }
        }
        
        max_depth
    }

    async fn analyze_architecture(&self, project_path: &Path) -> Result<ArchitectureInfo> {
        let mut components = Vec::new();
        let mut layers = Vec::new();
        let mut data_flow = Vec::new();

        // Detect common architecture patterns
        let pattern = self.detect_architecture_pattern(project_path).await;
        
        // Common layer detection
        if project_path.join("src").exists() {
            layers.push("Source".to_string());
        }
        if project_path.join("tests").exists() {
            layers.push("Tests".to_string());
        }
        if project_path.join("docs").exists() {
            layers.push("Documentation".to_string());
        }
        
        // Language-specific layer detection
        if project_path.join("src/controllers").exists() || project_path.join("src/handlers").exists() {
            layers.push("Controllers/Handlers".to_string());
        }
        if project_path.join("src/services").exists() {
            layers.push("Services".to_string());
        }
        if project_path.join("src/models").exists() {
            layers.push("Models".to_string());
        }
        if project_path.join("src/middleware").exists() {
            layers.push("Middleware".to_string());
        }

        // Add sample components (in a real implementation, these would be detected)
        components.push(ComponentInfo {
            name: "Core Service".to_string(),
            component_type: "Service".to_string(),
            responsibilities: vec!["Business Logic".to_string(), "Data Processing".to_string()],
            dependencies: vec!["Database".to_string(), "Cache".to_string()],
        });

        // Sample data flow
        data_flow.push("Client → API Gateway → Service → Database".to_string());
        data_flow.push("Service → Cache → Client".to_string());

        Ok(ArchitectureInfo {
            pattern,
            layers,
            components,
            data_flow,
        })
    }

    async fn detect_architecture_pattern(&self, project_path: &Path) -> String {
        // Check for common architecture patterns
        if project_path.join("src/main.rs").exists() {
            if project_path.join("Cargo.toml").exists() {
                return "Rust Microservice".to_string();
            }
        }

        if project_path.join("package.json").exists() {
            if project_path.join("src/server.ts").exists() || project_path.join("src/app.ts").exists() {
                return "Node.js/TypeScript Service".to_string();
            }
            if project_path.join("pages").exists() || project_path.join("app").exists() {
                return "React/Next.js Application".to_string();
            }
        }

        if project_path.join("go.mod").exists() {
            return "Go Service".to_string();
        }

        if project_path.join("requirements.txt").exists() || project_path.join("pyproject.toml").exists() {
            return "Python Application".to_string();
        }

        if project_path.join("Package.swift").exists() {
            return "Swift Package".to_string();
        }

        "Unknown Architecture".to_string()
    }

    async fn extract_api_endpoints(&self, project_path: &Path) -> Result<Vec<ApiEndpoint>> {
        let mut endpoints = Vec::new();

        // Scan source files for API endpoint patterns
        for entry in WalkDir::new(project_path)
            .max_depth(self.config.analysis.max_depth)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().is_file())
        {
            if self.config.should_ignore(entry.path()) {
                continue;
            }

            if let Some(extension) = entry.path().extension() {
                if matches!(extension.to_str(), Some("rs" | "ts" | "js" | "go" | "py")) {
                    if let Ok(content) = tokio::fs::read_to_string(entry.path()).await {
                        let file_endpoints = self.extract_endpoints_from_content(&content).await;
                        endpoints.extend(file_endpoints);
                    }
                }
            }
        }

        // Remove duplicates
        endpoints.sort_by(|a, b| a.path.cmp(&b.path));
        endpoints.dedup_by(|a, b| a.path == b.path && a.method == b.method);

        debug!("🔗 Found {} API endpoints", endpoints.len());
        Ok(endpoints)
    }

    async fn extract_endpoints_from_content(&self, content: &str) -> Vec<ApiEndpoint> {
        let mut endpoints = Vec::new();

        if let Some(patterns) = self.api_patterns.get("api") {
            for pattern in patterns {
                for capture in pattern.captures_iter(content) {
                    if let Some(path) = capture.get(1) {
                        let method = if pattern.as_str().contains("get") { "GET" }
                        else if pattern.as_str().contains("post") { "POST" }
                        else if pattern.as_str().contains("put") { "PUT" }
                        else if pattern.as_str().contains("delete") { "DELETE" }
                        else if pattern.as_str().contains("patch") { "PATCH" }
                        else { "GET" };

                        endpoints.push(ApiEndpoint {
                            method: method.to_string(),
                            path: path.as_str().to_string(),
                            description: format!("{} endpoint", path.as_str()),
                            parameters: vec![
                                ApiParameter {
                                    name: "id".to_string(),
                                    param_type: "path".to_string(),
                                    required: true,
                                    description: "Resource identifier".to_string(),
                                }
                            ],
                            responses: vec![
                                ApiResponse {
                                    status_code: 200,
                                    description: "Success".to_string(),
                                    content_type: "application/json".to_string(),
                                },
                                ApiResponse {
                                    status_code: 404,
                                    description: "Not Found".to_string(),
                                    content_type: "application/json".to_string(),
                                }
                            ],
                        });
                    }
                }
            }
        }

        endpoints
    }

    async fn analyze_dependencies(&self, project_path: &Path) -> Result<Vec<DependencyInfo>> {
        let mut dependencies = Vec::new();

        // Rust dependencies from Cargo.toml
        if let Ok(cargo_content) = tokio::fs::read_to_string(project_path.join("Cargo.toml")).await {
            dependencies.extend(self.parse_cargo_dependencies(&cargo_content)?);
        }

        // Node.js dependencies from package.json
        if let Ok(package_content) = tokio::fs::read_to_string(project_path.join("package.json")).await {
            dependencies.extend(self.parse_npm_dependencies(&package_content)?);
        }

        // Python dependencies from requirements.txt
        if let Ok(requirements_content) = tokio::fs::read_to_string(project_path.join("requirements.txt")).await {
            dependencies.extend(self.parse_python_dependencies(&requirements_content)?);
        }

        // Go dependencies from go.mod
        if let Ok(go_mod_content) = tokio::fs::read_to_string(project_path.join("go.mod")).await {
            dependencies.extend(self.parse_go_dependencies(&go_mod_content)?);
        }

        debug!("📦 Found {} dependencies", dependencies.len());
        Ok(dependencies)
    }

    fn parse_cargo_dependencies(&self, content: &str) -> Result<Vec<DependencyInfo>> {
        let mut deps = Vec::new();
        let lines: Vec<&str> = content.lines().collect();
        let mut in_dependencies = false;

        for line in lines {
            let trimmed = line.trim();
            
            if trimmed == "[dependencies]" {
                in_dependencies = true;
                continue;
            }
            
            if trimmed.starts_with('[') && trimmed != "[dependencies]" {
                in_dependencies = false;
                continue;
            }
            
            if in_dependencies && trimmed.contains('=') {
                let parts: Vec<&str> = trimmed.split('=').collect();
                if parts.len() >= 2 {
                    let name = parts[0].trim().to_string();
                    let version = parts[1].trim().trim_matches('"').to_string();
                    
                    deps.push(DependencyInfo {
                        name,
                        version,
                        dependency_type: "cargo".to_string(),
                        license: None,
                        security_vulnerabilities: 0,
                    });
                }
            }
        }

        Ok(deps)
    }

    fn parse_npm_dependencies(&self, content: &str) -> Result<Vec<DependencyInfo>> {
        let mut deps = Vec::new();
        
        if let Ok(package_json) = serde_json::from_str::<serde_json::Value>(content) {
            // Parse regular dependencies
            if let Some(dependencies) = package_json.get("dependencies") {
                if let Some(deps_obj) = dependencies.as_object() {
                    for (name, version) in deps_obj {
                        deps.push(DependencyInfo {
                            name: name.clone(),
                            version: version.as_str().unwrap_or("unknown").to_string(),
                            dependency_type: "npm".to_string(),
                            license: None,
                            security_vulnerabilities: 0,
                        });
                    }
                }
            }

            // Parse dev dependencies
            if let Some(dev_dependencies) = package_json.get("devDependencies") {
                if let Some(dev_deps_obj) = dev_dependencies.as_object() {
                    for (name, version) in dev_deps_obj {
                        deps.push(DependencyInfo {
                            name: name.clone(),
                            version: version.as_str().unwrap_or("unknown").to_string(),
                            dependency_type: "npm-dev".to_string(),
                            license: None,
                            security_vulnerabilities: 0,
                        });
                    }
                }
            }
        }

        Ok(deps)
    }

    fn parse_python_dependencies(&self, content: &str) -> Result<Vec<DependencyInfo>> {
        let mut deps = Vec::new();
        
        for line in content.lines() {
            let trimmed = line.trim();
            if !trimmed.is_empty() && !trimmed.starts_with('#') {
                let parts: Vec<&str> = trimmed.split("==").collect();
                let name = parts[0].trim().to_string();
                let version = parts.get(1).unwrap_or(&"latest").trim().to_string();
                
                deps.push(DependencyInfo {
                    name,
                    version,
                    dependency_type: "pip".to_string(),
                    license: None,
                    security_vulnerabilities: 0,
                });
            }
        }

        Ok(deps)
    }

    fn parse_go_dependencies(&self, content: &str) -> Result<Vec<DependencyInfo>> {
        let mut deps = Vec::new();
        
        for line in content.lines() {
            let trimmed = line.trim();
            if trimmed.starts_with("require") || (!trimmed.starts_with("module") && !trimmed.starts_with("go ") && trimmed.contains("v")) {
                let parts: Vec<&str> = trimmed.split_whitespace().collect();
                if parts.len() >= 2 {
                    let name = parts[0].to_string();
                    let version = parts[1].to_string();
                    
                    deps.push(DependencyInfo {
                        name,
                        version,
                        dependency_type: "go".to_string(),
                        license: None,
                        security_vulnerabilities: 0,
                    });
                }
            }
        }

        Ok(deps)
    }

    async fn calculate_complexity_metrics(&self, project_path: &Path) -> Result<ComplexityMetrics> {
        let mut total_complexity = 0.0;
        let mut total_files = 0;
        let mut total_functions = 0;
        let mut total_lines = 0;

        for entry in WalkDir::new(project_path)
            .max_depth(self.config.analysis.max_depth)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().is_file())
        {
            if self.config.should_ignore(entry.path()) {
                continue;
            }

            if let Some(extension) = entry.path().extension() {
                if let Some(ext_str) = extension.to_str() {
                    if let Some(language) = self.extension_to_language(ext_str) {
                        if let Ok(content) = tokio::fs::read_to_string(entry.path()).await {
                            let complexity = self.calculate_file_complexity(&content, &language).await;
                            let functions = self.count_functions(&content, &language);
                            let lines = content.lines().count();
                            
                            total_complexity += complexity;
                            total_functions += functions;
                            total_lines += lines;
                            total_files += 1;
                        }
                    }
                }
            }
        }

        let cyclomatic_complexity = if total_files > 0 { total_complexity / total_files as f64 } else { 0.0 };
        let cognitive_complexity = cyclomatic_complexity * 1.2; // Estimate
        
        // Calculate maintainability index (simplified formula)
        let maintainability_index = if total_lines > 0 {
            let volume = total_lines as f64 * (total_functions as f64 + 1.0).log2();
            171.0 - 5.2 * volume.log2() - 0.23 * cyclomatic_complexity - 16.2 * (total_lines as f64).log2()
        } else {
            100.0
        };
        
        let maintainability_index = maintainability_index.max(0.0).min(100.0);
        
        // Technical debt ratio (estimated based on complexity)
        let technical_debt_ratio = if cyclomatic_complexity > self.config.analysis.complexity_threshold {
            (cyclomatic_complexity - self.config.analysis.complexity_threshold) / cyclomatic_complexity
        } else {
            0.0
        };

        Ok(ComplexityMetrics {
            cyclomatic_complexity,
            cognitive_complexity,
            maintainability_index,
            technical_debt_ratio,
        })
    }
}