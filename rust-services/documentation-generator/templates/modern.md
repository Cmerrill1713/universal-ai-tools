# {{project_name}}

{{#if description}}
{{description}}
{{/if}}

*Generated on {{format_date generated_at "%B %d, %Y at %I:%M %p UTC"}}*

## Table of Contents

{{#each sections}}
- [{{title}}](#{{slug title}})
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