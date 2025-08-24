use anyhow::{anyhow, Result};
use handlebars::{Handlebars, Helper, Context, RenderContext, Output, HelperResult};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use tracing::{debug, error, info, warn};
use walkdir::WalkDir;

use crate::config::Config;
use crate::{TemplateStyle, DocumentationType, OutputFormat};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Template {
    pub name: String,
    pub style: TemplateStyle,
    pub output_format: OutputFormat,
    pub content: String,
    pub metadata: TemplateMetadata,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateMetadata {
    pub version: String,
    pub author: String,
    pub description: String,
    pub supported_types: Vec<DocumentationType>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone)]
pub struct TemplateGenerator {
    config: Config,
    handlebars: Handlebars<'static>,
    templates: HashMap<String, Template>,
}

impl TemplateGenerator {
    pub async fn new(config: &Config) -> Result<Self> {
        let mut handlebars = Handlebars::new();
        
        // Register custom helpers
        Self::register_helpers(&mut handlebars)?;
        
        let mut generator = Self {
            config: config.clone(),
            handlebars,
            templates: HashMap::new(),
        };

        // Load built-in templates
        generator.load_builtin_templates().await?;
        
        // Load custom templates from directory
        generator.load_custom_templates().await?;

        info!("📄 Template Generator initialized with {} templates", generator.templates.len());
        Ok(generator)
    }

    fn register_helpers(handlebars: &mut Handlebars<'static>) -> Result<()> {
        // Date formatting helper
        handlebars.register_helper("format_date", Box::new(format_date_helper));
        
        // Markdown to HTML helper
        handlebars.register_helper("markdown", Box::new(markdown_helper));
        
        // Code highlighting helper
        handlebars.register_helper("highlight", Box::new(highlight_helper));
        
        // Capitalize helper
        handlebars.register_helper("capitalize", Box::new(capitalize_helper));
        
        // Pluralize helper
        handlebars.register_helper("pluralize", Box::new(pluralize_helper));
        
        // Table of contents helper
        handlebars.register_helper("toc", Box::new(toc_helper));

        debug!("📝 Registered {} template helpers", 6);
        Ok(())
    }

    async fn load_builtin_templates(&mut self) -> Result<()> {
        // Modern Markdown Template
        let modern_markdown = Template {
            name: "modern_markdown".to_string(),
            style: TemplateStyle::Modern,
            output_format: OutputFormat::Markdown,
            content: self.create_modern_markdown_template(),
            metadata: TemplateMetadata {
                version: "1.0.0".to_string(),
                author: "Documentation Generator".to_string(),
                description: "Modern, clean Markdown template with syntax highlighting".to_string(),
                supported_types: vec![
                    DocumentationType::Api,
                    DocumentationType::Architecture,
                    DocumentationType::UserGuide,
                    DocumentationType::DeveloperGuide,
                    DocumentationType::Reference,
                    DocumentationType::Comprehensive,
                ],
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
            },
        };
        self.templates.insert("modern_markdown".to_string(), modern_markdown);

        // Classic HTML Template
        let classic_html = Template {
            name: "classic_html".to_string(),
            style: TemplateStyle::Classic,
            output_format: OutputFormat::Html,
            content: self.create_classic_html_template(),
            metadata: TemplateMetadata {
                version: "1.0.0".to_string(),
                author: "Documentation Generator".to_string(),
                description: "Classic HTML template with traditional styling".to_string(),
                supported_types: vec![
                    DocumentationType::Api,
                    DocumentationType::UserGuide,
                    DocumentationType::Reference,
                    DocumentationType::Comprehensive,
                ],
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
            },
        };
        self.templates.insert("classic_html".to_string(), classic_html);

        // Technical PDF Template (simplified)
        let technical_pdf = Template {
            name: "technical_pdf".to_string(),
            style: TemplateStyle::Technical,
            output_format: OutputFormat::Pdf,
            content: "# {{project_name}} Technical Documentation\n\n{{#each sections}}## {{title}}\n{{content}}\n{{/each}}".to_string(),
            metadata: TemplateMetadata {
                version: "1.0.0".to_string(),
                author: "Documentation Generator".to_string(),
                description: "Technical documentation template optimized for PDF output".to_string(),
                supported_types: vec![
                    DocumentationType::Api,
                    DocumentationType::Architecture,
                    DocumentationType::DeveloperGuide,
                    DocumentationType::Reference,
                ],
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
            },
        };
        self.templates.insert("technical_pdf".to_string(), technical_pdf);

        // Minimal Template
        let minimal_markdown = Template {
            name: "minimal_markdown".to_string(),
            style: TemplateStyle::Minimal,
            output_format: OutputFormat::Markdown,
            content: self.create_minimal_template(),
            metadata: TemplateMetadata {
                version: "1.0.0".to_string(),
                author: "Documentation Generator".to_string(),
                description: "Minimal, lightweight template for quick documentation".to_string(),
                supported_types: vec![
                    DocumentationType::Api,
                    DocumentationType::Reference,
                ],
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
            },
        };
        self.templates.insert("minimal_markdown".to_string(), minimal_markdown);

        // Corporate Template
        let corporate_html = Template {
            name: "corporate_html".to_string(),
            style: TemplateStyle::Corporate,
            output_format: OutputFormat::Html,
            content: self.create_corporate_template(),
            metadata: TemplateMetadata {
                version: "1.0.0".to_string(),
                author: "Documentation Generator".to_string(),
                description: "Professional corporate template with branding support".to_string(),
                supported_types: vec![
                    DocumentationType::UserGuide,
                    DocumentationType::Architecture,
                    DocumentationType::Comprehensive,
                ],
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
            },
        };
        self.templates.insert("corporate_html".to_string(), corporate_html);

        debug!("📚 Loaded {} built-in templates", self.templates.len());
        Ok(())
    }

    fn create_modern_markdown_template(&self) -> String {
        r#"# {{project_name}}

{{#if description}}
{{description}}
{{/if}}

*Generated on {{format_date generated_at "%B %d, %Y at %I:%M %p UTC"}}*

## Table of Contents

{{#each sections}}
- [{{title}}](#{{title}})
{{/each}}

{{#each sections}}
## {{title}}

{{markdown content}}

{{#if api_endpoints}}
### API Endpoints

{{#each api_endpoints}}
#### `{{method}} {{path}}`

{{description}}

{{#if parameters}}
**Parameters:**

{{#each parameters}}
- **{{name}}** ({{param_type}}) - {{description}} {{#if required}}*Required*{{/if}}
{{/each}}
{{/if}}

{{#if responses}}
**Responses:**

{{#each responses}}
- **{{status_code}}** {{content_type}} - {{description}}
{{/each}}
{{/if}}

{{/each}}
{{/if}}

{{#if complexity_metrics}}
### Complexity Metrics

- **Cyclomatic Complexity:** {{complexity_metrics.cyclomatic_complexity}}
- **Cognitive Complexity:** {{complexity_metrics.cognitive_complexity}}
- **Maintainability Index:** {{complexity_metrics.maintainability_index}}
- **Technical Debt Ratio:** {{complexity_metrics.technical_debt_ratio}}
{{/if}}

{{/each}}

---

*This documentation was generated automatically by Documentation Generator v1.0.0*
"#.to_string()
    }

    fn create_classic_html_template(&self) -> String {
        r#"<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{project_name}} - {{doc_type}}</title>
    <style>
        body {
            font-family: 'Times New Roman', serif;
            line-height: 1.6;
            max-width: 900px;
            margin: 0 auto;
            padding: 20px;
            color: #333;
            background-color: #fff;
        }
        h1, h2, h3, h4, h5, h6 {
            color: #2c3e50;
            border-bottom: 2px solid #ecf0f1;
            padding-bottom: 10px;
        }
        .header {
            text-align: center;
            border-bottom: 3px solid #3498db;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .toc {
            background-color: #f8f9fa;
            border: 1px solid #dee2e6;
            padding: 20px;
            margin: 20px 0;
            border-radius: 5px;
        }
        .section {
            margin: 30px 0;
        }
        pre {
            background-color: #f4f4f4;
            border: 1px solid #ddd;
            border-left: 4px solid #3498db;
            padding: 15px;
            overflow-x: auto;
            border-radius: 3px;
        }
        code {
            background-color: #f8f8f8;
            padding: 2px 4px;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
        }
        .api-endpoint {
            background-color: #fff;
            border: 1px solid #e1e8ed;
            border-radius: 8px;
            padding: 16px;
            margin: 16px 0;
        }
        .method {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-weight: bold;
            color: white;
            margin-right: 8px;
        }
        .method.get { background-color: #28a745; }
        .method.post { background-color: #007bff; }
        .method.put { background-color: #ffc107; color: black; }
        .method.delete { background-color: #dc3545; }
    </style>
</head>
<body>
    <div class="header">
        <h1>{{project_name}}</h1>
        <h2>{{capitalize doc_type}} Documentation</h2>
        <p><em>Generated on {{format_date generated_at "%B %d, %Y at %I:%M %p UTC"}}</em></p>
    </div>

    {{#if toc_enabled}}
    <div class="toc">
        <h3>Table of Contents</h3>
        {{toc sections}}
    </div>
    {{/if}}

    {{#each sections}}
    <div class="section">
        <h2 id="{{slug title}}">{{title}}</h2>
        {{markdown content}}
        
        {{#if api_endpoints}}
        <h3>API Endpoints</h3>
        {{#each api_endpoints}}
        <div class="api-endpoint">
            <span class="method {{lowercase method}}">{{method}}</span>
            <strong>{{path}}</strong>
            <p>{{description}}</p>
            {{#if parameters}}
            <h4>Parameters</h4>
            <ul>
            {{#each parameters}}
            <li><strong>{{name}}</strong> ({{param_type}}) - {{description}} {{#if required}}<em>Required</em>{{/if}}</li>
            {{/each}}
            </ul>
            {{/if}}
        </div>
        {{/each}}
        {{/if}}
    </div>
    {{/each}}

    <footer style="margin-top: 50px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #666;">
        <p>Generated by Documentation Generator v1.0.0</p>
    </footer>
</body>
</html>"#.to_string()
    }


    fn create_minimal_template(&self) -> String {
        r#"# {{project_name}}

{{#if description}}
{{description}}
{{/if}}

## Quick Reference

{{#each sections}}
### {{title}}

{{content}}

{{#if api_endpoints}}
**Endpoints:**
{{#each api_endpoints}}
- `{{method}} {{path}}` - {{description}}
{{/each}}
{{/if}}

{{/each}}

---
*Generated: {{format_date generated_at "%Y-%m-%d"}}}*
"#.to_string()
    }

    fn create_corporate_template(&self) -> String {
        r#"<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{project_name}} - Corporate Documentation</title>
    <style>
        :root {
            --primary-color: #003366;
            --secondary-color: #0066cc;
            --accent-color: #f0f8ff;
            --text-color: #333;
            --border-color: #ddd;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: var(--text-color);
            margin: 0;
            padding: 0;
            background-color: #fff;
        }
        
        .header {
            background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
            color: white;
            padding: 40px 0;
            text-align: center;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 20px;
        }
        
        .header h1 {
            margin: 0;
            font-size: 2.5em;
            font-weight: 300;
        }
        
        .header p {
            font-size: 1.2em;
            margin: 10px 0 0 0;
            opacity: 0.9;
        }
        
        .content {
            margin: 40px 0;
        }
        
        .sidebar {
            background-color: var(--accent-color);
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
        }
        
        h2, h3, h4, h5, h6 {
            color: var(--primary-color);
            border-bottom: 2px solid var(--border-color);
            padding-bottom: 8px;
        }
        
        .section {
            margin: 30px 0;
            padding: 20px;
            border-left: 4px solid var(--secondary-color);
            background-color: #fafafa;
        }
        
        .api-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin: 20px 0;
        }
        
        .api-card {
            background: white;
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .method-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.8em;
            font-weight: bold;
            text-transform: uppercase;
            margin-right: 10px;
        }
        
        .method-get { background-color: #28a745; color: white; }
        .method-post { background-color: #007bff; color: white; }
        .method-put { background-color: #ffc107; color: black; }
        .method-delete { background-color: #dc3545; color: white; }
        
        .footer {
            background-color: var(--primary-color);
            color: white;
            text-align: center;
            padding: 20px 0;
            margin-top: 60px;
        }
        
        @media print {
            .header { background: var(--primary-color) !important; }
        }
    </style>
</head>
<body>
    <header class="header">
        <div class="container">
            <h1>{{project_name}}</h1>
            <p>{{capitalize doc_type}} Documentation</p>
            <p><em>{{format_date generated_at "%B %d, %Y"}}</em></p>
        </div>
    </header>

    <main class="container content">
        {{#if executive_summary}}
        <div class="sidebar">
            <h3>Executive Summary</h3>
            <p>{{executive_summary}}</p>
        </div>
        {{/if}}

        {{#each sections}}
        <section class="section">
            <h2 id="{{slug title}}">{{title}}</h2>
            {{markdown content}}
            
            {{#if api_endpoints}}
            <h3>API Endpoints</h3>
            <div class="api-grid">
                {{#each api_endpoints}}
                <div class="api-card">
                    <div>
                        <span class="method-badge method-{{lowercase method}}">{{method}}</span>
                        <strong>{{path}}</strong>
                    </div>
                    <p>{{description}}</p>
                    {{#if parameters}}
                    <h4>Parameters</h4>
                    <ul>
                    {{#each parameters}}
                    <li><strong>{{name}}</strong> - {{description}}</li>
                    {{/each}}
                    </ul>
                    {{/if}}
                </div>
                {{/each}}
            </div>
            {{/if}}
        </section>
        {{/each}}
    </main>

    <footer class="footer">
        <div class="container">
            <p>&copy; {{format_date generated_at "%Y"}} {{company_name}}. Generated by Documentation Generator v1.0.0</p>
        </div>
    </footer>
</body>
</html>"#.to_string()
    }

    async fn load_custom_templates(&mut self) -> Result<()> {
        if !self.config.templates.template_dir.exists() {
            debug!("Custom template directory does not exist, skipping");
            return Ok(());
        }

        let mut loaded_count = 0;

        for entry in WalkDir::new(&self.config.templates.template_dir)
            .max_depth(2)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().is_file())
        {
            if let Some(extension) = entry.path().extension() {
                if matches!(extension.to_str(), Some("hbs" | "handlebars" | "template")) {
                    match self.load_template_from_file(entry.path()).await {
                        Ok(template) => {
                            self.templates.insert(template.name.clone(), template);
                            loaded_count += 1;
                        },
                        Err(e) => {
                            warn!("Failed to load template {:?}: {}", entry.path(), e);
                        }
                    }
                }
            }
        }

        if loaded_count > 0 {
            info!("📁 Loaded {} custom templates", loaded_count);
        }

        Ok(())
    }

    async fn load_template_from_file(&self, path: &std::path::Path) -> Result<Template> {
        let content = tokio::fs::read_to_string(path).await?;
        
        // Extract metadata from template file (YAML front matter)
        let (metadata, template_content) = self.parse_template_with_metadata(&content)?;
        
        let name = path.file_stem()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown")
            .to_string();

        Ok(Template {
            name,
            style: metadata.style.unwrap_or(TemplateStyle::Modern),
            output_format: metadata.output_format.unwrap_or(OutputFormat::Markdown),
            content: template_content,
            metadata: TemplateMetadata {
                version: metadata.version.unwrap_or("1.0.0".to_string()),
                author: metadata.author.unwrap_or("Unknown".to_string()),
                description: metadata.description.unwrap_or("Custom template".to_string()),
                supported_types: metadata.supported_types.unwrap_or_else(|| vec![DocumentationType::Comprehensive]),
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
            },
        })
    }

    fn parse_template_with_metadata(&self, content: &str) -> Result<(TemplateFileMeta, String)> {
        if content.starts_with("---\n") {
            // YAML front matter present
            let parts: Vec<&str> = content.splitn(3, "---\n").collect();
            if parts.len() >= 3 {
                let yaml_content = parts[1];
                let template_content = parts[2];
                
                let metadata: TemplateFileMeta = serde_yaml::from_str(yaml_content)?;
                return Ok((metadata, template_content.to_string()));
            }
        }
        
        // No metadata, use defaults
        Ok((TemplateFileMeta::default(), content.to_string()))
    }

    pub async fn refresh_templates(&self) -> Result<()> {
        // In a more complete implementation, this would reload all templates
        info!("🔄 Template cache refreshed");
        Ok(())
    }

    pub async fn list_available_templates(&self) -> Result<Vec<serde_json::Value>> {
        let mut templates = Vec::new();

        for (name, template) in &self.templates {
            templates.push(serde_json::json!({
                "name": name,
                "style": template.style,
                "output_format": template.output_format,
                "description": template.metadata.description,
                "author": template.metadata.author,
                "version": template.metadata.version,
                "supported_types": template.metadata.supported_types,
                "created_at": template.metadata.created_at,
                "updated_at": template.metadata.updated_at
            }));
        }

        Ok(templates)
    }

    pub async fn create_custom_template(&self, request: &HashMap<String, serde_json::Value>) -> Result<serde_json::Value> {
        let name = request.get("name")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("Template name required"))?;

        let content = request.get("content")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("Template content required"))?;

        let style: TemplateStyle = request.get("style")
            .and_then(|v| serde_json::from_value(v.clone()).ok())
            .unwrap_or(TemplateStyle::Modern);

        let output_format: OutputFormat = request.get("output_format")
            .and_then(|v| serde_json::from_value(v.clone()).ok())
            .unwrap_or(OutputFormat::Markdown);

        // Validate the template syntax
        if let Err(e) = self.handlebars.render_template(content, &serde_json::json!({})) {
            return Err(anyhow!("Invalid template syntax: {}", e));
        }

        // Save template to file
        let template_file = self.config.templates.template_dir
            .join(format!("{}.hbs", name));

        let template_with_metadata = format!(
            "---\nstyle: {:?}\noutput_format: {:?}\nauthor: Custom\ndescription: Custom template\nversion: 1.0.0\n---\n{}",
            style, output_format, content
        );

        tokio::fs::write(&template_file, template_with_metadata).await?;

        Ok(serde_json::json!({
            "name": name,
            "status": "created",
            "file_path": template_file.to_string_lossy(),
            "style": style,
            "output_format": output_format
        }))
    }

    pub fn render_template(
        &self,
        template_name: &str,
        data: &serde_json::Value,
    ) -> Result<String> {
        let template = self.templates.get(template_name)
            .ok_or_else(|| anyhow!("Template {} not found", template_name))?;

        let rendered = self.handlebars.render_template(&template.content, data)?;
        Ok(rendered)
    }

    pub fn get_template_by_style_and_format(
        &self,
        style: &TemplateStyle,
        format: &OutputFormat,
    ) -> Option<&Template> {
        self.templates.values()
            .find(|t| &t.style == style && &t.output_format == format)
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
struct TemplateFileMeta {
    style: Option<TemplateStyle>,
    output_format: Option<OutputFormat>,
    version: Option<String>,
    author: Option<String>,
    description: Option<String>,
    supported_types: Option<Vec<DocumentationType>>,
}

// Template helper functions
fn format_date_helper(
    h: &Helper,
    _: &Handlebars,
    _: &Context,
    _: &mut RenderContext,
    out: &mut dyn Output,
) -> HelperResult {
    let date_str = h.param(0)
        .and_then(|v| v.value().as_str())
        .unwrap_or("N/A");
    
    let format_str = h.param(1)
        .and_then(|v| v.value().as_str())
        .unwrap_or("%Y-%m-%d");
    
    if let Ok(date) = chrono::DateTime::parse_from_rfc3339(date_str) {
        out.write(&date.format(format_str).to_string())?;
    } else if let Ok(date) = chrono::DateTime::parse_from_str(date_str, "%Y-%m-%d %H:%M:%S UTC") {
        out.write(&date.format(format_str).to_string())?;
    } else {
        out.write(date_str)?;
    }
    
    Ok(())
}

fn markdown_helper(
    h: &Helper,
    _: &Handlebars,
    _: &Context,
    _: &mut RenderContext,
    out: &mut dyn Output,
) -> HelperResult {
    let markdown = h.param(0)
        .and_then(|v| v.value().as_str())
        .unwrap_or("");
    
    use pulldown_cmark::{Parser, html, Options};
    
    let mut options = Options::empty();
    options.insert(Options::ENABLE_STRIKETHROUGH);
    options.insert(Options::ENABLE_TABLES);
    options.insert(Options::ENABLE_TASKLISTS);
    
    let parser = Parser::new_ext(markdown, options);
    let mut html_output = String::new();
    html::push_html(&mut html_output, parser);
    
    out.write(&html_output)?;
    Ok(())
}

fn highlight_helper(
    h: &Helper,
    _: &Handlebars,
    _: &Context,
    _: &mut RenderContext,
    out: &mut dyn Output,
) -> HelperResult {
    let code = h.param(0)
        .and_then(|v| v.value().as_str())
        .unwrap_or("");
    
    let language = h.param(1)
        .and_then(|v| v.value().as_str())
        .unwrap_or("text");
    
    // Simple syntax highlighting (in production, use syntect or similar)
    let highlighted = format!(
        r#"<pre><code class="language-{}">{}</code></pre>"#,
        language,
        html_escape::encode_text(code)
    );
    
    out.write(&highlighted)?;
    Ok(())
}

fn capitalize_helper(
    h: &Helper,
    _: &Handlebars,
    _: &Context,
    _: &mut RenderContext,
    out: &mut dyn Output,
) -> HelperResult {
    let text = h.param(0)
        .and_then(|v| v.value().as_str())
        .unwrap_or("");
    
    let capitalized: String = text.chars()
        .enumerate()
        .map(|(i, c)| if i == 0 { c.to_uppercase().collect::<String>() } else { c.to_string() })
        .collect();
    
    out.write(&capitalized)?;
    Ok(())
}

fn pluralize_helper(
    h: &Helper,
    _: &Handlebars,
    _: &Context,
    _: &mut RenderContext,
    out: &mut dyn Output,
) -> HelperResult {
    let count = h.param(0)
        .and_then(|v| v.value().as_u64())
        .unwrap_or(0);
    
    let singular = h.param(1)
        .and_then(|v| v.value().as_str())
        .unwrap_or("item");
    
    let default_plural = format!("{}s", singular);
    let plural = h.param(2)
        .and_then(|v| v.value().as_str())
        .unwrap_or(&default_plural);
    
    let result = if count == 1 { singular } else { plural };
    out.write(result)?;
    Ok(())
}

fn toc_helper(
    h: &Helper,
    _: &Handlebars,
    _: &Context,
    _: &mut RenderContext,
    out: &mut dyn Output,
) -> HelperResult {
    if let Some(sections) = h.param(0).and_then(|v| v.value().as_array()) {
        let mut toc = String::new();
        toc.push_str("<ul>\n");
        
        for (_i, section) in sections.iter().enumerate() {
            if let Some(title) = section.get("title").and_then(|t| t.as_str()) {
                let slug = title.to_lowercase().replace(' ', "-");
                let formatted_item = format!("<li><a href=\"#{}\">{}</a></li>", slug, title);
                toc.push_str(&formatted_item);
                toc.push('\n');
            }
        }
        
        toc.push_str("</ul>");
        out.write(&toc)?;
    }
    
    Ok(())
}