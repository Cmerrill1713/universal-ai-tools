use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::Command;
use tokio::process::Command as AsyncCommand;
use tracing::{debug, error, info, warn};

use crate::config::Config;
use crate::OutputFormat;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportTask {
    pub id: String,
    pub source_path: PathBuf,
    pub output_path: PathBuf,
    pub format: OutputFormat,
    pub status: ExportStatus,
    pub progress: f64,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub completed_at: Option<chrono::DateTime<chrono::Utc>>,
    pub file_size: Option<u64>,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum ExportStatus {
    Queued,
    Processing,
    Completed,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadInfo {
    pub file_path: String,
    pub file_name: String,
    pub file_size: u64,
    pub mime_type: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub expires_at: Option<chrono::DateTime<chrono::Utc>>,
    pub download_count: u32,
}

#[derive(Debug, Clone)]
pub struct ExportManager {
    config: Config,
    active_exports: HashMap<String, ExportTask>,
    download_cache: HashMap<String, DownloadInfo>,
}

impl ExportManager {
    pub async fn new(config: &Config) -> Result<Self> {
        let manager = Self {
            config: config.clone(),
            active_exports: HashMap::new(),
            download_cache: HashMap::new(),
        };

        // Ensure export directory exists
        if !config.documentation.output_dir.exists() {
            tokio::fs::create_dir_all(&config.documentation.output_dir).await?;
        }

        // Check external dependencies
        manager.check_export_dependencies().await?;

        info!("📤 Export Manager initialized");
        Ok(manager)
    }

    async fn check_export_dependencies(&self) -> Result<()> {
        let mut missing_tools = Vec::new();

        // Check for PDF generation tools
        if !self.is_tool_available("wkhtmltopdf").await {
            if !self.is_tool_available("weasyprint").await {
                missing_tools.push("wkhtmltopdf or weasyprint (for PDF generation)");
            }
        }

        // Check for DOCX generation (optional)
        if !self.is_tool_available("pandoc").await {
            warn!("pandoc not available - DOCX export will use basic conversion");
        }

        if !missing_tools.is_empty() {
            warn!("Missing export tools: {:?}", missing_tools);
        }

        Ok(())
    }

    async fn is_tool_available(&self, tool_name: &str) -> bool {
        match AsyncCommand::new("which")
            .arg(tool_name)
            .output()
            .await
        {
            Ok(output) => output.status.success(),
            Err(_) => false,
        }
    }

    pub async fn export_to_format(
        &mut self,
        generation_id: &str,
        source_path: &Path,
        target_format: OutputFormat,
    ) -> Result<String> {
        let export_id = format!("{}_{:?}", generation_id, target_format);
        info!("📤 Starting export: {} to {:?}", export_id, target_format);

        // Create export task
        let output_path = self.get_export_output_path(generation_id, &target_format);
        let task = ExportTask {
            id: export_id.clone(),
            source_path: source_path.to_path_buf(),
            output_path: output_path.clone(),
            format: target_format.clone(),
            status: ExportStatus::Queued,
            progress: 0.0,
            created_at: chrono::Utc::now(),
            completed_at: None,
            file_size: None,
            error_message: None,
        };

        self.active_exports.insert(export_id.clone(), task);

        // Perform the export
        match self.perform_export(generation_id, source_path, &target_format).await {
            Ok(exported_path) => {
                self.mark_export_completed(&export_id, &exported_path).await?;
                Ok(exported_path)
            },
            Err(e) => {
                self.mark_export_failed(&export_id, &e.to_string()).await?;
                Err(e)
            }
        }
    }

    fn get_export_output_path(&self, generation_id: &str, format: &OutputFormat) -> PathBuf {
        let filename = match format {
            OutputFormat::Markdown => format!("{}.md", generation_id),
            OutputFormat::Html => format!("{}.html", generation_id),
            OutputFormat::Pdf => format!("{}.pdf", generation_id),
            OutputFormat::Confluence => format!("{}_confluence.json", generation_id),
            OutputFormat::Docx => format!("{}.docx", generation_id),
        };

        self.config.documentation.output_dir.join(filename)
    }

    async fn perform_export(
        &mut self,
        generation_id: &str,
        source_path: &Path,
        target_format: &OutputFormat,
    ) -> Result<String> {
        self.update_export_progress(generation_id, target_format, 10.0).await;

        match target_format {
            OutputFormat::Markdown => {
                // Already in Markdown, just copy
                let output_path = self.get_export_output_path(generation_id, target_format);
                tokio::fs::copy(source_path, &output_path).await?;
                Ok(output_path.to_string_lossy().to_string())
            },
            OutputFormat::Html => {
                self.export_to_html(generation_id, source_path).await
            },
            OutputFormat::Pdf => {
                self.export_to_pdf(generation_id, source_path).await
            },
            OutputFormat::Confluence => {
                self.export_to_confluence(generation_id, source_path).await
            },
            OutputFormat::Docx => {
                self.export_to_docx(generation_id, source_path).await
            },
        }
    }

    async fn export_to_html(&mut self, generation_id: &str, source_path: &Path) -> Result<String> {
        self.update_export_progress(generation_id, &OutputFormat::Html, 30.0).await;

        let content = tokio::fs::read_to_string(source_path).await?;
        let output_path = self.get_export_output_path(generation_id, &OutputFormat::Html);

        // Convert Markdown to HTML using pulldown-cmark
        use pulldown_cmark::{Parser, html, Options};

        let mut options = Options::empty();
        options.insert(Options::ENABLE_STRIKETHROUGH);
        options.insert(Options::ENABLE_TABLES);
        options.insert(Options::ENABLE_FOOTNOTES);
        options.insert(Options::ENABLE_TASKLISTS);

        self.update_export_progress(generation_id, &OutputFormat::Html, 60.0).await;

        let parser = Parser::new_ext(&content, options);
        let mut html_output = String::new();
        html::push_html(&mut html_output, parser);

        // Wrap in a complete HTML document
        let full_html = self.create_html_document(&html_output, generation_id)?;

        self.update_export_progress(generation_id, &OutputFormat::Html, 90.0).await;

        tokio::fs::write(&output_path, full_html).await?;

        Ok(output_path.to_string_lossy().to_string())
    }

    fn create_html_document(&self, body_html: &str, generation_id: &str) -> Result<String> {
        let css = self.get_html_css();
        
        let html = format!(
            r#"<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Documentation - {}</title>
    <style>
{}
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>Documentation</h1>
            <p class="generated-info">Generated on {}</p>
        </header>
        <main>
{}
        </main>
        <footer>
            <p>Generated by Documentation Generator v1.0.0</p>
        </footer>
    </div>
    
    <script>
        // Add syntax highlighting for code blocks
        document.querySelectorAll('pre code').forEach((block) => {{
            block.style.background = '#f8f8f8';
            block.style.border = '1px solid #e1e1e8';
            block.style.borderRadius = '4px';
        }});
        
        // Add copy buttons to code blocks
        document.querySelectorAll('pre').forEach((pre) => {{
            const button = document.createElement('button');
            button.textContent = 'Copy';
            button.style.cssText = 'position: absolute; top: 8px; right: 8px; padding: 4px 8px; background: #007bff; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 12px;';
            pre.style.position = 'relative';
            button.onclick = () => {{
                navigator.clipboard.writeText(pre.textContent);
                button.textContent = 'Copied!';
                setTimeout(() => {{ button.textContent = 'Copy'; }}, 2000);
            }};
            pre.appendChild(button);
        }});
    </script>
</body>
</html>"#,
            generation_id,
            css,
            chrono::Utc::now().format("%Y-%m-%d %H:%M:%S UTC"),
            body_html
        );

        Ok(html)
    }

    fn get_html_css(&self) -> &str {
        r#"
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f8f9fa;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background-color: white;
            min-height: 100vh;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
        }
        
        header {
            border-bottom: 2px solid #e9ecef;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        
        header h1 {
            margin: 0;
            color: #2c3e50;
        }
        
        .generated-info {
            color: #6c757d;
            margin: 10px 0 0 0;
            font-style: italic;
        }
        
        h1, h2, h3, h4, h5, h6 {
            color: #2c3e50;
            margin-top: 2em;
            margin-bottom: 1em;
        }
        
        h1 { font-size: 2.5em; }
        h2 { font-size: 2em; border-bottom: 1px solid #e9ecef; padding-bottom: 0.5em; }
        h3 { font-size: 1.5em; }
        h4 { font-size: 1.25em; }
        
        p {
            margin: 1em 0;
        }
        
        pre {
            background-color: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 6px;
            padding: 16px;
            overflow-x: auto;
            margin: 1em 0;
            position: relative;
        }
        
        code {
            background-color: #f8f9fa;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
            font-size: 0.9em;
        }
        
        pre code {
            background: none;
            padding: 0;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 1em 0;
        }
        
        th, td {
            border: 1px solid #e9ecef;
            padding: 12px;
            text-align: left;
        }
        
        th {
            background-color: #f8f9fa;
            font-weight: 600;
        }
        
        blockquote {
            border-left: 4px solid #007bff;
            margin: 1em 0;
            padding: 1em 1em 1em 2em;
            background-color: #f8f9fa;
        }
        
        ul, ol {
            padding-left: 2em;
        }
        
        li {
            margin: 0.5em 0;
        }
        
        a {
            color: #007bff;
            text-decoration: none;
        }
        
        a:hover {
            text-decoration: underline;
        }
        
        footer {
            margin-top: 60px;
            padding-top: 20px;
            border-top: 1px solid #e9ecef;
            text-align: center;
            color: #6c757d;
            font-size: 0.9em;
        }
        
        @media (max-width: 768px) {
            .container {
                padding: 15px;
            }
            
            h1 { font-size: 2em; }
            h2 { font-size: 1.5em; }
            h3 { font-size: 1.25em; }
        }
        "#
    }

    async fn export_to_pdf(&mut self, generation_id: &str, source_path: &Path) -> Result<String> {
        self.update_export_progress(generation_id, &OutputFormat::Pdf, 20.0).await;

        // First convert to HTML
        let html_path = self.export_to_html(generation_id, source_path).await?;
        
        self.update_export_progress(generation_id, &OutputFormat::Pdf, 60.0).await;

        let output_path = self.get_export_output_path(generation_id, &OutputFormat::Pdf);

        // Try wkhtmltopdf first, then weasyprint
        let pdf_generated = if self.is_tool_available("wkhtmltopdf").await {
            self.generate_pdf_with_wkhtmltopdf(&html_path, &output_path).await?
        } else if self.is_tool_available("weasyprint").await {
            self.generate_pdf_with_weasyprint(&html_path, &output_path).await?
        } else {
            // Fallback: create a simple text-based PDF placeholder
            self.create_pdf_placeholder(source_path, &output_path).await?
        };

        self.update_export_progress(generation_id, &OutputFormat::Pdf, 90.0).await;

        if pdf_generated {
            Ok(output_path.to_string_lossy().to_string())
        } else {
            Err(anyhow!("Failed to generate PDF"))
        }
    }

    async fn generate_pdf_with_wkhtmltopdf(&self, html_path: &str, output_path: &Path) -> Result<bool> {
        let output = AsyncCommand::new("wkhtmltopdf")
            .args([
                "--page-size", "A4",
                "--margin-top", "1in",
                "--margin-bottom", "1in",
                "--margin-left", "0.8in",
                "--margin-right", "0.8in",
                "--encoding", "UTF-8",
                "--enable-local-file-access",
                html_path,
                &output_path.to_string_lossy(),
            ])
            .output()
            .await?;

        if output.status.success() {
            debug!("PDF generated successfully with wkhtmltopdf");
            Ok(true)
        } else {
            let error = String::from_utf8_lossy(&output.stderr);
            warn!("wkhtmltopdf failed: {}", error);
            Ok(false)
        }
    }

    async fn generate_pdf_with_weasyprint(&self, html_path: &str, output_path: &Path) -> Result<bool> {
        let output = AsyncCommand::new("weasyprint")
            .args([
                html_path,
                &output_path.to_string_lossy(),
            ])
            .output()
            .await?;

        if output.status.success() {
            debug!("PDF generated successfully with weasyprint");
            Ok(true)
        } else {
            let error = String::from_utf8_lossy(&output.stderr);
            warn!("weasyprint failed: {}", error);
            Ok(false)
        }
    }

    async fn create_pdf_placeholder(&self, source_path: &Path, output_path: &Path) -> Result<bool> {
        // Create a simple text file as PDF placeholder
        let content = tokio::fs::read_to_string(source_path).await?;
        let placeholder = format!(
            "PDF Export Placeholder\n\nThis is a text representation of the documentation.\nFor proper PDF generation, install wkhtmltopdf or weasyprint.\n\n{}",
            content
        );
        
        tokio::fs::write(output_path, placeholder).await?;
        Ok(true)
    }

    async fn export_to_confluence(&mut self, generation_id: &str, source_path: &Path) -> Result<String> {
        self.update_export_progress(generation_id, &OutputFormat::Confluence, 30.0).await;

        let content = tokio::fs::read_to_string(source_path).await?;
        let output_path = self.get_export_output_path(generation_id, &OutputFormat::Confluence);

        // Convert Markdown to Confluence storage format
        let confluence_content = self.convert_markdown_to_confluence(&content)?;

        self.update_export_progress(generation_id, &OutputFormat::Confluence, 80.0).await;

        let confluence_export = serde_json::json!({
            "type": "page",
            "title": format!("Documentation - {}", generation_id),
            "body": {
                "storage": {
                    "value": confluence_content,
                    "representation": "storage"
                }
            },
            "metadata": {
                "generated_at": chrono::Utc::now(),
                "generator": "Documentation Generator v1.0.0"
            }
        });

        tokio::fs::write(&output_path, serde_json::to_string_pretty(&confluence_export)?).await?;

        Ok(output_path.to_string_lossy().to_string())
    }

    fn convert_markdown_to_confluence(&self, markdown: &str) -> Result<String> {
        // Simple Markdown to Confluence conversion
        let mut confluence = markdown.to_string();

        // Convert headers
        confluence = confluence.replace("# ", "<h1>");
        confluence = confluence.replace("## ", "<h2>");
        confluence = confluence.replace("### ", "<h3>");
        confluence = confluence.replace("#### ", "<h4>");

        // Convert code blocks
        confluence = confluence.replace("```", "<pre><code>");
        confluence = confluence.replace("```", "</code></pre>");

        // Convert inline code
        confluence = confluence.replace("`", "<code>");
        confluence = confluence.replace("`", "</code>");

        // Convert bold and italic
        confluence = confluence.replace("**", "<strong>");
        confluence = confluence.replace("**", "</strong>");
        confluence = confluence.replace("*", "<em>");
        confluence = confluence.replace("*", "</em>");

        Ok(confluence)
    }

    async fn export_to_docx(&mut self, generation_id: &str, source_path: &Path) -> Result<String> {
        self.update_export_progress(generation_id, &OutputFormat::Docx, 20.0).await;

        let output_path = self.get_export_output_path(generation_id, &OutputFormat::Docx);

        if self.is_tool_available("pandoc").await {
            self.generate_docx_with_pandoc(source_path, &output_path).await
        } else {
            // Fallback: create a basic Word-compatible document
            self.create_docx_placeholder(source_path, &output_path).await
        }
    }

    async fn generate_docx_with_pandoc(&mut self, source_path: &Path, output_path: &Path) -> Result<String> {
        self.update_export_progress("", &OutputFormat::Docx, 60.0).await;

        let output = AsyncCommand::new("pandoc")
            .args([
                "-f", "markdown",
                "-t", "docx",
                "-o", &output_path.to_string_lossy(),
                &source_path.to_string_lossy(),
            ])
            .output()
            .await?;

        if output.status.success() {
            debug!("DOCX generated successfully with pandoc");
            Ok(output_path.to_string_lossy().to_string())
        } else {
            let error = String::from_utf8_lossy(&output.stderr);
            Err(anyhow!("pandoc failed: {}", error))
        }
    }

    async fn create_docx_placeholder(&mut self, source_path: &Path, output_path: &Path) -> Result<String> {
        self.update_export_progress("", &OutputFormat::Docx, 80.0).await;

        // Create a simple HTML file with .docx extension (Word can often open this)
        let html_content = self.export_to_html("temp", source_path).await?;
        tokio::fs::copy(html_content, output_path).await?;

        Ok(output_path.to_string_lossy().to_string())
    }

    async fn update_export_progress(&mut self, generation_id: &str, format: &OutputFormat, progress: f64) {
        let export_id = format!("{}_{:?}", generation_id, format);
        if let Some(task) = self.active_exports.get_mut(&export_id) {
            task.progress = progress;
            task.status = if progress >= 100.0 { ExportStatus::Completed } else { ExportStatus::Processing };
        }
    }

    async fn mark_export_completed(&mut self, export_id: &str, output_path: &str) -> Result<()> {
        if let Some(task) = self.active_exports.get_mut(export_id) {
            task.status = ExportStatus::Completed;
            task.progress = 100.0;
            task.completed_at = Some(chrono::Utc::now());
            
            // Get file size
            if let Ok(metadata) = tokio::fs::metadata(output_path).await {
                task.file_size = Some(metadata.len());
            }
            
            // Create download info
            let download_info = self.create_download_info(export_id, output_path).await?;
            self.download_cache.insert(export_id.to_string(), download_info);
        }
        
        info!("✅ Export {} completed successfully", export_id);
        Ok(())
    }

    async fn mark_export_failed(&mut self, export_id: &str, error_message: &str) -> Result<()> {
        if let Some(task) = self.active_exports.get_mut(export_id) {
            task.status = ExportStatus::Failed;
            task.error_message = Some(error_message.to_string());
        }
        
        error!("❌ Export {} failed: {}", export_id, error_message);
        Ok(())
    }

    async fn create_download_info(&self, _export_id: &str, file_path: &str) -> Result<DownloadInfo> {
        let path = Path::new(file_path);
        let metadata = tokio::fs::metadata(path).await?;
        
        let file_name = path.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("download")
            .to_string();
        
        let mime_type = self.get_mime_type(&file_name);
        
        Ok(DownloadInfo {
            file_path: file_path.to_string(),
            file_name,
            file_size: metadata.len(),
            mime_type,
            created_at: chrono::Utc::now(),
            expires_at: Some(chrono::Utc::now() + chrono::Duration::days(7)), // 7 days expiry
            download_count: 0,
        })
    }

    fn get_mime_type(&self, file_name: &str) -> String {
        match file_name.split('.').last().unwrap_or("") {
            "md" => "text/markdown",
            "html" => "text/html",
            "pdf" => "application/pdf",
            "docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "json" => "application/json",
            _ => "application/octet-stream",
        }.to_string()
    }

    pub async fn get_download_info(&mut self, generation_id: &str) -> Result<serde_json::Value> {
        if let Some(download_info) = self.download_cache.get_mut(generation_id) {
            // Check if file still exists
            if Path::new(&download_info.file_path).exists() {
                download_info.download_count += 1;
                
                Ok(serde_json::json!({
                    "file_name": download_info.file_name,
                    "file_size": download_info.file_size,
                    "mime_type": download_info.mime_type,
                    "download_url": format!("/downloads/{}", generation_id),
                    "expires_at": download_info.expires_at,
                    "download_count": download_info.download_count
                }))
            } else {
                Err(anyhow!("File no longer exists"))
            }
        } else {
            Err(anyhow!("Download not found"))
        }
    }

    pub async fn cleanup_expired_downloads(&mut self) -> Result<()> {
        let now = chrono::Utc::now();
        let mut to_remove = Vec::new();

        for (id, info) in &self.download_cache {
            if let Some(expires_at) = info.expires_at {
                if now > expires_at {
                    // Remove expired file
                    if Path::new(&info.file_path).exists() {
                        if let Err(e) = tokio::fs::remove_file(&info.file_path).await {
                            warn!("Failed to remove expired file {}: {}", info.file_path, e);
                        }
                    }
                    to_remove.push(id.clone());
                }
            }
        }

        for id in to_remove {
            self.download_cache.remove(&id);
        }

        debug!("🧹 Cleaned up expired downloads");
        Ok(())
    }
}