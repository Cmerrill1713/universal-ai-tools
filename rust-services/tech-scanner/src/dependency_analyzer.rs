use crate::config::Config;
use crate::scanner::{DependencyVulnerability, VulnerabilitySeverity};
use anyhow::Result;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;
use tokio::fs;
use tracing::{info, warn, error};

#[derive(Debug, Clone)]
pub struct DependencyAnalyzer {
    config: Config,
    project_root: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct CargoToml {
    dependencies: Option<HashMap<String, toml::Value>>,
    #[serde(rename = "dev-dependencies")]
    dev_dependencies: Option<HashMap<String, toml::Value>>,
}

#[derive(Debug, Serialize, Deserialize)]
struct PackageJson {
    dependencies: Option<HashMap<String, String>>,
    #[serde(rename = "devDependencies")]
    dev_dependencies: Option<HashMap<String, String>>,
}

#[derive(Debug, Serialize, Deserialize)]
struct GoMod {
    dependencies: Vec<GoDependency>,
}

#[derive(Debug, Serialize, Deserialize)]
struct GoDependency {
    name: String,
    version: String,
}

impl DependencyAnalyzer {
    pub async fn new(config: &Config) -> Result<Self> {
        let project_root = std::env::var("PROJECT_ROOT")
            .unwrap_or_else(|_| "/Users/christianmerrill/Desktop/universal-ai-tools".to_string());

        Ok(Self {
            config: config.clone(),
            project_root,
        })
    }

    pub async fn scan_project_dependencies(&self) -> Result<Vec<DependencyVulnerability>> {
        info!("🔍 Scanning project dependencies for vulnerabilities");

        let mut vulnerabilities = Vec::new();

        // Scan Rust dependencies (Cargo.toml files)
        if let Ok(rust_vulns) = self.scan_rust_dependencies().await {
            vulnerabilities.extend(rust_vulns);
        }

        // Scan Node.js dependencies (package.json)
        if let Ok(node_vulns) = self.scan_node_dependencies().await {
            vulnerabilities.extend(node_vulns);
        }

        // Scan Go dependencies (go.mod)
        if let Ok(go_vulns) = self.scan_go_dependencies().await {
            vulnerabilities.extend(go_vulns);
        }

        info!("✅ Found {} dependency vulnerabilities", vulnerabilities.len());
        Ok(vulnerabilities)
    }

    async fn scan_rust_dependencies(&self) -> Result<Vec<DependencyVulnerability>> {
        let mut vulnerabilities = Vec::new();

        // Find all Cargo.toml files
        let cargo_files = self.find_files("Cargo.toml").await?;

        for cargo_file in cargo_files {
            match self.analyze_cargo_file(&cargo_file).await {
                Ok(vulns) => vulnerabilities.extend(vulns),
                Err(e) => error!("Failed to analyze {}: {}", cargo_file, e),
            }
        }

        Ok(vulnerabilities)
    }

    async fn analyze_cargo_file(&self, file_path: &str) -> Result<Vec<DependencyVulnerability>> {
        let content = fs::read_to_string(file_path).await?;
        let cargo_toml: CargoToml = toml::from_str(&content)?;

        let mut vulnerabilities = Vec::new();

        // Check dependencies
        if let Some(deps) = cargo_toml.dependencies {
            vulnerabilities.extend(self.check_rust_vulnerabilities(&deps).await?);
        }

        // Check dev dependencies
        if let Some(dev_deps) = cargo_toml.dev_dependencies {
            vulnerabilities.extend(self.check_rust_vulnerabilities(&dev_deps).await?);
        }

        Ok(vulnerabilities)
    }

    async fn check_rust_vulnerabilities(&self, dependencies: &HashMap<String, toml::Value>) -> Result<Vec<DependencyVulnerability>> {
        let mut vulnerabilities = Vec::new();

        // Known vulnerable Rust crates (this would normally come from a security database)
        let known_vulns = self.get_known_rust_vulnerabilities();

        for (name, version) in dependencies {
            let version_str = match version {
                toml::Value::String(v) => v.clone(),
                toml::Value::Table(table) => {
                    if let Some(toml::Value::String(v)) = table.get("version") {
                        v.clone()
                    } else {
                        continue;
                    }
                }
                _ => continue,
            };

            if let Some(vuln) = known_vulns.get(name) {
                if self.is_version_vulnerable(&version_str, &vuln.vulnerable_versions) {
                    vulnerabilities.push(DependencyVulnerability {
                        dependency: name.clone(),
                        current_version: version_str,
                        vulnerable_versions: vuln.vulnerable_versions.clone(),
                        fixed_version: vuln.fixed_version.clone(),
                        severity: vuln.severity.clone(),
                        cve_id: vuln.cve_id.clone(),
                    });
                }
            }
        }

        Ok(vulnerabilities)
    }

    async fn scan_node_dependencies(&self) -> Result<Vec<DependencyVulnerability>> {
        let mut vulnerabilities = Vec::new();

        // Find package.json files
        let package_files = self.find_files("package.json").await?;

        for package_file in package_files {
            match self.analyze_package_json(&package_file).await {
                Ok(vulns) => vulnerabilities.extend(vulns),
                Err(e) => error!("Failed to analyze {}: {}", package_file, e),
            }
        }

        Ok(vulnerabilities)
    }

    async fn analyze_package_json(&self, file_path: &str) -> Result<Vec<DependencyVulnerability>> {
        let content = fs::read_to_string(file_path).await?;
        let package_json: PackageJson = serde_json::from_str(&content)?;

        let mut vulnerabilities = Vec::new();

        // Check dependencies
        if let Some(deps) = package_json.dependencies {
            vulnerabilities.extend(self.check_npm_vulnerabilities(&deps).await?);
        }

        // Check dev dependencies
        if let Some(dev_deps) = package_json.dev_dependencies {
            vulnerabilities.extend(self.check_npm_vulnerabilities(&dev_deps).await?);
        }

        Ok(vulnerabilities)
    }

    async fn check_npm_vulnerabilities(&self, dependencies: &HashMap<String, String>) -> Result<Vec<DependencyVulnerability>> {
        let mut vulnerabilities = Vec::new();

        // Known vulnerable npm packages
        let known_vulns = self.get_known_npm_vulnerabilities();

        for (name, version) in dependencies {
            if let Some(vuln) = known_vulns.get(name) {
                if self.is_version_vulnerable(version, &vuln.vulnerable_versions) {
                    vulnerabilities.push(DependencyVulnerability {
                        dependency: name.clone(),
                        current_version: version.clone(),
                        vulnerable_versions: vuln.vulnerable_versions.clone(),
                        fixed_version: vuln.fixed_version.clone(),
                        severity: vuln.severity.clone(),
                        cve_id: vuln.cve_id.clone(),
                    });
                }
            }
        }

        Ok(vulnerabilities)
    }

    async fn scan_go_dependencies(&self) -> Result<Vec<DependencyVulnerability>> {
        let mut vulnerabilities = Vec::new();

        // Find go.mod files
        let go_files = self.find_files("go.mod").await?;

        for go_file in go_files {
            match self.analyze_go_mod(&go_file).await {
                Ok(vulns) => vulnerabilities.extend(vulns),
                Err(e) => error!("Failed to analyze {}: {}", go_file, e),
            }
        }

        Ok(vulnerabilities)
    }

    async fn analyze_go_mod(&self, file_path: &str) -> Result<Vec<DependencyVulnerability>> {
        let content = fs::read_to_string(file_path).await?;
        let dependencies = self.parse_go_mod(&content)?;

        let mut vulnerabilities = Vec::new();
        let known_vulns = self.get_known_go_vulnerabilities();

        for dep in dependencies {
            if let Some(vuln) = known_vulns.get(&dep.name) {
                if self.is_version_vulnerable(&dep.version, &vuln.vulnerable_versions) {
                    vulnerabilities.push(DependencyVulnerability {
                        dependency: dep.name,
                        current_version: dep.version,
                        vulnerable_versions: vuln.vulnerable_versions.clone(),
                        fixed_version: vuln.fixed_version.clone(),
                        severity: vuln.severity.clone(),
                        cve_id: vuln.cve_id.clone(),
                    });
                }
            }
        }

        Ok(vulnerabilities)
    }

    fn parse_go_mod(&self, content: &str) -> Result<Vec<GoDependency>> {
        let mut dependencies = Vec::new();
        let re = Regex::new(r"^\s*([^\s]+)\s+v([^\s]+)")?;

        let mut in_require_block = false;
        for line in content.lines() {
            let line = line.trim();
            
            if line.starts_with("require (") {
                in_require_block = true;
                continue;
            }
            
            if in_require_block && line == ")" {
                in_require_block = false;
                continue;
            }
            
            if in_require_block || line.starts_with("require ") {
                let line = line.strip_prefix("require ").unwrap_or(line);
                
                if let Some(caps) = re.captures(line) {
                    dependencies.push(GoDependency {
                        name: caps[1].to_string(),
                        version: caps[2].to_string(),
                    });
                }
            }
        }

        Ok(dependencies)
    }

    async fn find_files(&self, filename: &str) -> Result<Vec<String>> {
        let mut files = Vec::new();
        self.find_files_recursive(&self.project_root, filename, &mut files).await?;
        Ok(files)
    }

    #[async_recursion::async_recursion]
    async fn find_files_recursive(&self, dir: &str, filename: &str, files: &mut Vec<String>) -> Result<()> {
        let mut entries = fs::read_dir(dir).await?;

        while let Some(entry) = entries.next_entry().await? {
            let path = entry.path();
            
            if path.is_dir() {
                // Skip certain directories
                if let Some(dir_name) = path.file_name().and_then(|n| n.to_str()) {
                    if matches!(dir_name, "node_modules" | "target" | ".git" | "dist" | "build") {
                        continue;
                    }
                }
                
                if let Some(path_str) = path.to_str() {
                    self.find_files_recursive(path_str, filename, files).await?;
                }
            } else if let Some(file_name) = path.file_name().and_then(|n| n.to_str()) {
                if file_name == filename {
                    if let Some(path_str) = path.to_str() {
                        files.push(path_str.to_string());
                    }
                }
            }
        }

        Ok(())
    }

    fn is_version_vulnerable(&self, current_version: &str, vulnerable_versions: &[String]) -> bool {
        // Simplified version comparison - in production, use a proper semver library
        vulnerable_versions.iter().any(|vuln_ver| {
            current_version.starts_with(vuln_ver) || vuln_ver.contains(current_version)
        })
    }

    fn get_known_rust_vulnerabilities(&self) -> HashMap<String, KnownVulnerability> {
        // In production, this would come from RustSec database or similar
        let mut vulns = HashMap::new();
        
        vulns.insert("tokio".to_string(), KnownVulnerability {
            vulnerable_versions: vec!["1.0.0".to_string(), "1.0.1".to_string()],
            fixed_version: "1.0.2".to_string(),
            severity: VulnerabilitySeverity::Medium,
            cve_id: Some("CVE-2021-45710".to_string()),
        });

        vulns
    }

    fn get_known_npm_vulnerabilities(&self) -> HashMap<String, KnownVulnerability> {
        // In production, this would come from npm audit or security databases
        HashMap::new()
    }

    fn get_known_go_vulnerabilities(&self) -> HashMap<String, KnownVulnerability> {
        // In production, this would come from Go vulnerability database
        HashMap::new()
    }
}

#[derive(Debug, Clone)]
struct KnownVulnerability {
    vulnerable_versions: Vec<String>,
    fixed_version: String,
    severity: VulnerabilitySeverity,
    cve_id: Option<String>,
}