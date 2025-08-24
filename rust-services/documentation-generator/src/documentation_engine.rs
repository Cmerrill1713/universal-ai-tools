use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{debug, error, info, warn};
use walkdir::WalkDir;

use crate::config::Config;
use crate::{
    DocumentationRequest, DocumentationResponse, DocumentationSection, 
    GenerationStatus, OutputFormat, DocumentationType, TemplateStyle
};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerationTask {
    pub id: String,
    pub request: DocumentationRequest,
    pub status: GenerationStatus,
    pub progress: f64,
    pub current_phase: String,
    pub start_time: chrono::DateTime<chrono::Utc>,
    pub estimated_completion: Option<chrono::DateTime<chrono::Utc>>,
    pub output_path: Option<String>,
    pub error_message: Option<String>,
    pub file_count: u32,
    pub total_lines: u32,
    pub sections: Vec<DocumentationSection>,
}

#[derive(Debug, Clone)]
pub struct DocumentationEngine {
    config: Config,
    active_generations: Arc<RwLock<HashMap<String, GenerationTask>>>,
    generation_queue: Arc<RwLock<Vec<String>>>,
}

impl DocumentationEngine {
    pub async fn new(config: &Config) -> Result<Self> {
        config.validate()?;
        
        let engine = Self {
            config: config.clone(),
            active_generations: Arc::new(RwLock::new(HashMap::new())),
            generation_queue: Arc::new(RwLock::new(Vec::new())),
        };

        info!("📚 Documentation Engine initialized");
        Ok(engine)
    }

    pub async fn start_generation(
        &self,
        generation_id: &str,
        request: &DocumentationRequest,
    ) -> Result<DocumentationResponse> {
        info!("🚀 Starting documentation generation: {}", generation_id);

        // Validate the request
        self.validate_request(request).await?;

        // Create generation task
        let task = GenerationTask {
            id: generation_id.to_string(),
            request: request.clone(),
            status: GenerationStatus::Queued,
            progress: 0.0,
            current_phase: "Initializing".to_string(),
            start_time: chrono::Utc::now(),
            estimated_completion: None,
            output_path: None,
            error_message: None,
            file_count: 0,
            total_lines: 0,
            sections: Vec::new(),
        };

        // Store the task
        let mut generations = self.active_generations.write().await;
        generations.insert(generation_id.to_string(), task.clone());

        // Add to queue
        let mut queue = self.generation_queue.write().await;
        queue.push(generation_id.to_string());

        // Return initial response
        Ok(DocumentationResponse {
            generation_id: generation_id.to_string(),
            status: GenerationStatus::Queued,
            output_path: None,
            progress: 0.0,
            estimated_completion: None,
            file_count: 0,
            total_lines: 0,
            documentation_sections: Vec::new(),
        })
    }

    async fn validate_request(&self, request: &DocumentationRequest) -> Result<()> {
        // Check if project path exists
        let project_path = PathBuf::from(&request.project_path);
        if !project_path.exists() {
            return Err(anyhow!("Project path does not exist: {}", request.project_path));
        }

        if !project_path.is_dir() {
            return Err(anyhow!("Project path is not a directory: {}", request.project_path));
        }

        // Validate patterns
        for pattern in &request.include_patterns {
            if pattern.is_empty() {
                return Err(anyhow!("Include patterns cannot be empty"));
            }
        }

        // Check template style
        match request.template_style {
            TemplateStyle::Modern | TemplateStyle::Classic | TemplateStyle::Minimal 
            | TemplateStyle::Technical | TemplateStyle::Corporate => {},
        }

        // Check output format
        match request.output_format {
            OutputFormat::Markdown | OutputFormat::Html | OutputFormat::Pdf 
            | OutputFormat::Confluence | OutputFormat::Docx => {},
        }

        Ok(())
    }

    pub async fn process_queue(&self) -> Result<()> {
        let generation_id = {
            let mut queue = self.generation_queue.write().await;
            if queue.is_empty() {
                return Ok(()); // No work to do
            }
            queue.remove(0)
        };

        debug!("📝 Processing generation from queue: {}", generation_id);
        
        if let Err(e) = self.process_generation(&generation_id).await {
            error!("Generation {} failed: {}", generation_id, e);
            self.mark_generation_failed(&generation_id, &e.to_string()).await?;
        }

        Ok(())
    }

    async fn process_generation(&self, generation_id: &str) -> Result<()> {
        let mut task = {
            let generations = self.active_generations.read().await;
            generations.get(generation_id)
                .ok_or_else(|| anyhow!("Generation {} not found", generation_id))?
                .clone()
        };

        info!("🔄 Processing generation: {}", generation_id);

        // Phase 1: Analyzing project structure
        self.update_task_status(&mut task, GenerationStatus::Analyzing, "Analyzing project structure", 10.0).await?;
        let project_info = self.analyze_project_structure(&task.request).await?;

        // Phase 2: Extracting content
        self.update_task_status(&mut task, GenerationStatus::Generating, "Extracting documentation content", 40.0).await?;
        let sections = self.extract_documentation_content(&task.request, &project_info).await?;
        task.sections = sections.clone();

        // Phase 3: Formatting output
        self.update_task_status(&mut task, GenerationStatus::Formatting, "Formatting documentation", 80.0).await?;
        let output_path = self.format_documentation(&task.request, &sections, generation_id).await?;

        // Phase 4: Completed
        task.status = GenerationStatus::Completed;
        task.progress = 100.0;
        task.current_phase = "Completed".to_string();
        task.output_path = Some(output_path);
        task.estimated_completion = Some(chrono::Utc::now());
        task.file_count = project_info.file_count;
        task.total_lines = project_info.total_lines;

        // Update final task
        let mut generations = self.active_generations.write().await;
        generations.insert(generation_id.to_string(), task);

        info!("✅ Generation {} completed successfully", generation_id);
        Ok(())
    }

    async fn update_task_status(
        &self,
        task: &mut GenerationTask,
        status: GenerationStatus,
        phase: &str,
        progress: f64,
    ) -> Result<()> {
        task.status = status;
        task.current_phase = phase.to_string();
        task.progress = progress;

        // Estimate completion time based on progress
        if progress > 0.0 {
            let elapsed = chrono::Utc::now().signed_duration_since(task.start_time);
            let total_estimated = elapsed.num_seconds() as f64 / (progress / 100.0);
            let remaining = total_estimated - elapsed.num_seconds() as f64;
            task.estimated_completion = Some(chrono::Utc::now() + chrono::Duration::seconds(remaining as i64));
        }

        // Update in storage
        let mut generations = self.active_generations.write().await;
        generations.insert(task.id.clone(), task.clone());

        debug!("📊 Updated task {}: {} - {:.1}%", task.id, phase, progress);
        Ok(())
    }

    async fn mark_generation_failed(&self, generation_id: &str, error_message: &str) -> Result<()> {
        let mut generations = self.active_generations.write().await;
        if let Some(task) = generations.get_mut(generation_id) {
            task.status = GenerationStatus::Failed;
            task.error_message = Some(error_message.to_string());
            task.current_phase = "Failed".to_string();
        }
        Ok(())
    }

    async fn analyze_project_structure(&self, request: &DocumentationRequest) -> Result<ProjectInfo> {
        let mut file_count = 0;
        let mut total_lines = 0;
        let mut languages: HashMap<String, u32> = HashMap::new();

        for entry in WalkDir::new(&request.project_path)
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
                    if self.config.is_supported_language(ext_str) {
                        file_count += 1;
                        
                        // Count lines in file
                        if let Ok(content) = tokio::fs::read_to_string(entry.path()).await {
                            let line_count = content.lines().count() as u32;
                            total_lines += line_count;
                            
                            // Track language usage
                            *languages.entry(ext_str.to_string()).or_insert(0) += 1;
                        }
                    }
                }
            }
        }

        Ok(ProjectInfo {
            file_count,
            total_lines,
            languages,
        })
    }

    async fn extract_documentation_content(
        &self,
        request: &DocumentationRequest,
        _project_info: &ProjectInfo,
    ) -> Result<Vec<DocumentationSection>> {
        let mut sections = Vec::new();

        // Create different sections based on documentation type
        match request.documentation_type {
            DocumentationType::Api => {
                sections.push(DocumentationSection {
                    title: "API Overview".to_string(),
                    content_type: "api".to_string(),
                    word_count: 250,
                    last_updated: chrono::Utc::now(),
                });
                sections.push(DocumentationSection {
                    title: "Endpoints".to_string(),
                    content_type: "api_endpoints".to_string(),
                    word_count: 1200,
                    last_updated: chrono::Utc::now(),
                });
            },
            DocumentationType::Architecture => {
                sections.push(DocumentationSection {
                    title: "System Architecture".to_string(),
                    content_type: "architecture".to_string(),
                    word_count: 800,
                    last_updated: chrono::Utc::now(),
                });
                sections.push(DocumentationSection {
                    title: "Component Diagram".to_string(),
                    content_type: "diagram".to_string(),
                    word_count: 150,
                    last_updated: chrono::Utc::now(),
                });
            },
            DocumentationType::UserGuide => {
                sections.push(DocumentationSection {
                    title: "Getting Started".to_string(),
                    content_type: "tutorial".to_string(),
                    word_count: 500,
                    last_updated: chrono::Utc::now(),
                });
                sections.push(DocumentationSection {
                    title: "User Interface".to_string(),
                    content_type: "guide".to_string(),
                    word_count: 750,
                    last_updated: chrono::Utc::now(),
                });
            },
            DocumentationType::DeveloperGuide => {
                sections.push(DocumentationSection {
                    title: "Development Setup".to_string(),
                    content_type: "setup".to_string(),
                    word_count: 400,
                    last_updated: chrono::Utc::now(),
                });
                sections.push(DocumentationSection {
                    title: "Code Architecture".to_string(),
                    content_type: "architecture".to_string(),
                    word_count: 900,
                    last_updated: chrono::Utc::now(),
                });
            },
            DocumentationType::Reference => {
                sections.push(DocumentationSection {
                    title: "API Reference".to_string(),
                    content_type: "reference".to_string(),
                    word_count: 2000,
                    last_updated: chrono::Utc::now(),
                });
            },
            DocumentationType::Comprehensive => {
                // Include all section types
                sections.extend([
                    DocumentationSection {
                        title: "Overview".to_string(),
                        content_type: "overview".to_string(),
                        word_count: 300,
                        last_updated: chrono::Utc::now(),
                    },
                    DocumentationSection {
                        title: "Architecture".to_string(),
                        content_type: "architecture".to_string(),
                        word_count: 800,
                        last_updated: chrono::Utc::now(),
                    },
                    DocumentationSection {
                        title: "API Documentation".to_string(),
                        content_type: "api".to_string(),
                        word_count: 1500,
                        last_updated: chrono::Utc::now(),
                    },
                    DocumentationSection {
                        title: "User Guide".to_string(),
                        content_type: "guide".to_string(),
                        word_count: 1000,
                        last_updated: chrono::Utc::now(),
                    },
                ]);
            },
        }

        Ok(sections)
    }

    async fn format_documentation(
        &self,
        request: &DocumentationRequest,
        sections: &[DocumentationSection],
        generation_id: &str,
    ) -> Result<String> {
        let output_dir = self.config.get_output_path(generation_id);
        tokio::fs::create_dir_all(&output_dir).await?;

        let output_file = match request.output_format {
            OutputFormat::Markdown => output_dir.join("documentation.md"),
            OutputFormat::Html => output_dir.join("documentation.html"),
            OutputFormat::Pdf => output_dir.join("documentation.pdf"),
            OutputFormat::Confluence => output_dir.join("documentation.json"),
            OutputFormat::Docx => output_dir.join("documentation.docx"),
        };

        // Generate content based on format
        let content = self.generate_content(request, sections).await?;
        
        match request.output_format {
            OutputFormat::Markdown => {
                tokio::fs::write(&output_file, content).await?;
            },
            OutputFormat::Html => {
                let html_content = self.markdown_to_html(&content)?;
                tokio::fs::write(&output_file, html_content).await?;
            },
            OutputFormat::Pdf => {
                // For now, create HTML and note that PDF conversion would happen here
                let html_content = self.markdown_to_html(&content)?;
                tokio::fs::write(output_dir.join("temp.html"), html_content).await?;
                tokio::fs::write(&output_file, "PDF generation placeholder").await?;
            },
            OutputFormat::Confluence => {
                let confluence_json = self.generate_confluence_format(sections)?;
                tokio::fs::write(&output_file, confluence_json).await?;
            },
            OutputFormat::Docx => {
                tokio::fs::write(&output_file, "DOCX generation placeholder").await?;
            },
        }

        Ok(output_file.to_string_lossy().to_string())
    }

    async fn generate_content(&self, request: &DocumentationRequest, sections: &[DocumentationSection]) -> Result<String> {
        let mut content = String::new();
        
        // Title based on documentation type
        let title = match request.documentation_type {
            DocumentationType::Api => "API Documentation",
            DocumentationType::Architecture => "System Architecture Documentation",
            DocumentationType::UserGuide => "User Guide",
            DocumentationType::DeveloperGuide => "Developer Guide",
            DocumentationType::Reference => "Reference Documentation",
            DocumentationType::Comprehensive => "Comprehensive Documentation",
        };

        content.push_str(&format!("# {}\n\n", title));
        content.push_str(&format!("*Generated on {}*\n\n", chrono::Utc::now().format("%Y-%m-%d %H:%M:%S UTC")));

        // Table of Contents
        content.push_str("## Table of Contents\n\n");
        for (i, section) in sections.iter().enumerate() {
            content.push_str(&format!("{}. [{}](#{})\n", i + 1, section.title, section.title.to_lowercase().replace(' ', "-")));
        }
        content.push_str("\n");

        // Generate sections
        for section in sections {
            content.push_str(&format!("## {}\n\n", section.title));
            content.push_str(&self.generate_section_content(section, request).await?);
            content.push_str("\n\n");
        }

        Ok(content)
    }

    async fn generate_section_content(&self, section: &DocumentationSection, _request: &DocumentationRequest) -> Result<String> {
        let content = match section.content_type.as_str() {
            "overview" => "This section provides a high-level overview of the system, its purpose, and key features.",
            "architecture" => "This section describes the system architecture, including components, data flow, and design patterns.",
            "api" => "This section documents the API endpoints, request/response formats, and authentication methods.",
            "guide" => "This section provides step-by-step instructions and best practices for using the system.",
            "reference" => "This section provides detailed reference information including all available functions, classes, and methods.",
            "setup" => "This section covers development environment setup, dependencies, and configuration.",
            "tutorial" => "This section provides hands-on tutorials and examples.",
            "api_endpoints" => "### Available Endpoints\n\n- GET /api/health - System health check\n- POST /api/generate - Generate documentation\n- GET /api/status/:id - Check generation status",
            "diagram" => "[Architecture Diagram would be inserted here]",
            _ => "Content for this section would be generated based on code analysis.",
        };

        Ok(content.to_string())
    }

    fn markdown_to_html(&self, markdown: &str) -> Result<String> {
        use pulldown_cmark::{Parser, html};
        
        let parser = Parser::new(markdown);
        let mut html_output = String::new();
        html::push_html(&mut html_output, parser);
        
        // Wrap in basic HTML structure
        let full_html = format!(
            r#"<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Documentation</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }}
        pre {{ background-color: #f4f4f4; padding: 10px; border-radius: 4px; overflow-x: auto; }}
        code {{ background-color: #f4f4f4; padding: 2px 4px; border-radius: 2px; }}
        blockquote {{ border-left: 4px solid #ddd; margin: 0; padding-left: 20px; color: #666; }}
    </style>
</head>
<body>
{}
</body>
</html>"#,
            html_output
        );
        
        Ok(full_html)
    }

    fn generate_confluence_format(&self, sections: &[DocumentationSection]) -> Result<String> {
        let confluence_data = serde_json::json!({
            "type": "page",
            "title": "Generated Documentation",
            "body": {
                "storage": {
                    "value": sections.iter().map(|s| format!("<h2>{}</h2><p>Content for {}</p>", s.title, s.title)).collect::<Vec<_>>().join(""),
                    "representation": "storage"
                }
            },
            "metadata": {
                "generated_at": chrono::Utc::now(),
                "sections": sections.len()
            }
        });

        Ok(serde_json::to_string_pretty(&confluence_data)?)
    }

    pub async fn get_preview(&self, generation_id: &str) -> Result<serde_json::Value> {
        let generations = self.active_generations.read().await;
        let task = generations.get(generation_id)
            .ok_or_else(|| anyhow!("Generation {} not found", generation_id))?;

        let preview = serde_json::json!({
            "generation_id": generation_id,
            "status": task.status,
            "progress": task.progress,
            "current_phase": task.current_phase,
            "sections_preview": task.sections.iter().take(3).collect::<Vec<_>>(),
            "estimated_completion": task.estimated_completion,
            "file_count": task.file_count,
            "total_lines": task.total_lines
        });

        Ok(preview)
    }
}

#[derive(Debug, Clone)]
struct ProjectInfo {
    file_count: u32,
    total_lines: u32,
    languages: HashMap<String, u32>,
}