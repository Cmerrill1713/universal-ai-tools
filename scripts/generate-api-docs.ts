#!/usr/bin/env tsx
/**
 * API Documentation Generator - Universal AI Tools
 * 
 * This script automatically generates comprehensive API documentation
 * by analyzing the Express.js routes and endpoint handlers.
 * 
 * Features:
 * - Auto-discovery of all API endpoints
 * - Parameter extraction and validation
 * - Response schema inference
 * - Authentication requirements detection
 * - Rate limiting information
 * - Example request/response generation
 * - OpenAPI 3.0 specification output
 * - Interactive HTML documentation
 * 
 * Usage: npm run docs:generate
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

interface EndpointDoc {
  path: string;
  method: string;
  summary: string;
  description: string;
  parameters: Parameter[];
  requestBody?: RequestBody;
  responses: Response[];
  authentication: AuthRequirement[];
  rateLimit?: RateLimit;
  examples: Example[];
  tags: string[];
}

interface Parameter {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  required: boolean;
  schema: SchemaObject;
  description: string;
  example?: any;
}

interface RequestBody {
  required: boolean;
  content: Record<string, MediaTypeObject>;
  description: string;
}

interface MediaTypeObject {
  schema: SchemaObject;
  examples?: Record<string, Example>;
}

interface Response {
  statusCode: number;
  description: string;
  content?: Record<string, MediaTypeObject>;
  headers?: Record<string, HeaderObject>;
}

interface HeaderObject {
  description: string;
  schema: SchemaObject;
}

interface AuthRequirement {
  type: 'bearer' | 'apiKey' | 'basic';
  name: string;
  in?: 'header' | 'query' | 'cookie';
  description: string;
}

interface RateLimit {
  requests: number;
  window: string;
  description: string;
}

interface Example {
  summary: string;
  description: string;
  value: any;
}

interface SchemaObject {
  type: string;
  properties?: Record<string, SchemaObject>;
  items?: SchemaObject;
  required?: string[];
  example?: any;
  enum?: any[];
  format?: string;
}

class APIDocumentationGenerator {
  private endpoints: EndpointDoc[] = [];
  private routerFiles: string[] = [];
  private serviceFiles: string[] = [];

  constructor() {
    this.loadRouterFiles();
  }

  private async loadRouterFiles(): Promise<void> {
    this.routerFiles = await glob('src/routers/**/*.ts', { cwd: process.cwd() });
    this.serviceFiles = await glob('src/services/**/*.ts', { cwd: process.cwd() });
    console.log(`📁 Found ${this.routerFiles.length} router files and ${this.serviceFiles.length} service files`);
  }

  public async generate(): Promise<void> {
    console.log('🚀 Starting API documentation generation...');
    
    // Discover endpoints
    await this.discoverEndpoints();
    
    // Generate documentation formats
    await this.generateOpenAPISpec();
    await this.generateMarkdownDocs();
    await this.generateHTMLDocs();
    
    console.log('✅ API documentation generated successfully!');
  }

  private async discoverEndpoints(): Promise<void> {
    console.log('🔍 Discovering API endpoints...');

    for (const routerFile of this.routerFiles) {
      await this.analyzeRouterFile(routerFile);
    }

    console.log(`📊 Discovered ${this.endpoints.length} endpoints`);
  }

  private async analyzeRouterFile(filePath: string): Promise<void> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const fileName = path.basename(filePath, '.ts');
    
    // Extract route definitions
    const routePatterns = [
      /router\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g,
      /app\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g
    ];

    for (const pattern of routePatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const [, method, path] = match;
        await this.analyzeEndpoint(filePath, method, path, content);
      }
    }
  }

  private async analyzeEndpoint(filePath: string, method: string, routePath: string, content: string): Promise<void> {
    const fileName = path.basename(filePath, '.ts');
    const tag = this.extractTag(fileName);
    
    // Find the handler function for this endpoint
    const handlerMatch = this.findHandlerFunction(content, method, routePath);
    
    const endpoint: EndpointDoc = {
      path: routePath,
      method: method.toUpperCase(),
      summary: this.generateSummary(method, routePath, tag),
      description: this.extractDescription(handlerMatch?.handlerCode || '', routePath),
      parameters: this.extractParameters(handlerMatch?.handlerCode || '', routePath),
      requestBody: this.extractRequestBody(handlerMatch?.handlerCode || ''),
      responses: this.extractResponses(handlerMatch?.handlerCode || ''),
      authentication: this.extractAuthRequirements(handlerMatch?.handlerCode || ''),
      rateLimit: this.extractRateLimit(handlerMatch?.handlerCode || ''),
      examples: this.generateExamples(method, routePath, tag),
      tags: [tag]
    };

    this.endpoints.push(endpoint);
  }

  private findHandlerFunction(content: string, method: string, routePath: string): { handlerCode: string } | null {
    // Look for the handler function after the route definition
    const routeRegex = new RegExp(
      `router\\.${method}\\s*\\(\\s*['"\`]${this.escapeRegex(routePath)}['"\`]\\s*,\\s*([^{]+\\{[\\s\\S]*?\\n\\}\\s*\\))`
    );
    
    const match = routeRegex.exec(content);
    if (match) {
      return { handlerCode: match[1] };
    }
    
    return null;
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private extractTag(fileName: string): string {
    // Convert filename to readable tag
    return fileName
      .replace(/-/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .replace(/^\w/, c => c.toUpperCase())
      .trim();
  }

  private generateSummary(method: string, path: string, tag: string): string {
    const action = this.getActionFromMethod(method);
    const resource = this.getResourceFromPath(path);
    return `${action} ${resource}`;
  }

  private getActionFromMethod(method: string): string {
    const actions: Record<string, string> = {
      GET: 'Get',
      POST: 'Create',
      PUT: 'Update',
      DELETE: 'Delete',
      PATCH: 'Modify'
    };
    return actions[method.toUpperCase()] || method;
  }

  private getResourceFromPath(path: string): string {
    // Extract resource name from path
    const segments = path.split('/').filter(s => s && !s.startsWith(':') && !s.startsWith('{'));
    return segments[segments.length - 1] || 'resource';
  }

  private extractDescription(handlerCode: string, routePath: string): string {
    // Look for comments in the handler function
    const commentMatch = handlerCode.match(/\/\*\*(.*?)\*\//s) || handlerCode.match(/\/\/(.*?)$/m);
    
    if (commentMatch) {
      return commentMatch[1].replace(/\*/g, '').trim();
    }
    
    // Generate default description
    return `Endpoint for ${routePath} operations`;
  }

  private extractParameters(handlerCode: string, routePath: string): Parameter[] {
    const parameters: Parameter[] = [];
    
    // Extract path parameters
    const pathParams = routePath.match(/:(\w+)/g);
    if (pathParams) {
      pathParams.forEach(param => {
        const name = param.substring(1);
        parameters.push({
          name,
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: `${name} identifier`,
          example: `example-${name}`
        });
      });
    }
    
    // Extract query parameters from handler code
    const queryMatches = handlerCode.matchAll(/req\.query\.(\w+)/g);
    for (const match of queryMatches) {
      const name = match[1];
      if (!parameters.some(p => p.name === name)) {
        parameters.push({
          name,
          in: 'query',
          required: false,
          schema: { type: 'string' },
          description: `${name} parameter`,
          example: `example-${name}`
        });
      }
    }
    
    return parameters;
  }

  private extractRequestBody(handlerCode: string): RequestBody | undefined {
    // Check if handler uses req.body
    if (handlerCode.includes('req.body')) {
      return {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: this.inferBodySchema(handlerCode)
            }
          }
        },
        description: 'Request payload'
      };
    }
    return undefined;
  }

  private inferBodySchema(handlerCode: string): Record<string, SchemaObject> {
    const schema: Record<string, SchemaObject> = {};
    
    // Look for common body field accesses
    const bodyFieldMatches = handlerCode.matchAll(/req\.body\.(\w+)/g);
    for (const match of bodyFieldMatches) {
      const field = match[1];
      schema[field] = {
        type: 'string',
        example: `example-${field}`
      };
    }
    
    return schema;
  }

  private extractResponses(handlerCode: string): Response[] {
    const responses: Response[] = [];
    
    // Look for res.status or res.json calls
    const statusMatches = handlerCode.matchAll(/res\.status\((\d+)\)/g);
    const statusCodes = new Set<number>();
    
    for (const match of statusMatches) {
      statusCodes.add(parseInt(match[1]));
    }
    
    // Add common status codes if not found
    if (statusCodes.size === 0) {
      statusCodes.add(200);
    }
    
    statusCodes.forEach(code => {
      responses.push({
        statusCode: code,
        description: this.getStatusDescription(code),
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                data: { type: 'object' },
                message: { type: 'string' }
              }
            }
          }
        }
      });
    });
    
    return responses;
  }

  private getStatusDescription(code: number): string {
    const descriptions: Record<number, string> = {
      200: 'Success',
      201: 'Created',
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      429: 'Rate Limited',
      500: 'Internal Server Error'
    };
    return descriptions[code] || `Status ${code}`;
  }

  private extractAuthRequirements(handlerCode: string): AuthRequirement[] {
    const requirements: AuthRequirement[] = [];
    
    // Check for JWT auth middleware
    if (handlerCode.includes('jwt') || handlerCode.includes('bearer') || handlerCode.includes('Authorization')) {
      requirements.push({
        type: 'bearer',
        name: 'Authorization',
        description: 'Bearer JWT token'
      });
    }
    
    // Check for API key auth
    if (handlerCode.includes('api-key') || handlerCode.includes('X-API-Key')) {
      requirements.push({
        type: 'apiKey',
        name: 'X-API-Key',
        in: 'header',
        description: 'API key for authentication'
      });
    }
    
    return requirements;
  }

  private extractRateLimit(handlerCode: string): RateLimit | undefined {
    // Look for rate limiting middleware
    if (handlerCode.includes('rateLimit') || handlerCode.includes('rate-limit')) {
      return {
        requests: 100,
        window: '15 minutes',
        description: 'Rate limited to prevent abuse'
      };
    }
    return undefined;
  }

  private generateExamples(method: string, path: string, tag: string): Example[] {
    const examples: Example[] = [];
    
    if (method.toLowerCase() === 'post' || method.toLowerCase() === 'put') {
      examples.push({
        summary: 'Example Request',
        description: `Example ${method} request for ${path}`,
        value: {
          example: 'data'
        }
      });
    }
    
    examples.push({
      summary: 'Success Response',
      description: 'Successful response example',
      value: {
        success: true,
        data: {},
        message: 'Operation completed successfully'
      }
    });
    
    return examples;
  }

  private async generateOpenAPISpec(): Promise<void> {
    console.log('📝 Generating OpenAPI 3.0 specification...');

    const spec = {
      openapi: '3.0.0',
      info: {
        title: 'Universal AI Tools API',
        description: 'Comprehensive API documentation for Universal AI Tools - a sophisticated AI orchestration platform',
        version: '1.0.0',
        contact: {
          name: 'Universal AI Tools',
          email: 'support@universal-ai-tools.com'
        },
        license: {
          name: 'MIT',
          url: 'https://opensource.org/licenses/MIT'
        }
      },
      servers: [
        {
          url: 'http://localhost:9999',
          description: 'Development server'
        },
        {
          url: 'https://api.universal-ai-tools.com',
          description: 'Production server'
        }
      ],
      security: [
        { bearerAuth: [] },
        { apiKeyAuth: [] }
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT'
          },
          apiKeyAuth: {
            type: 'apiKey',
            in: 'header',
            name: 'X-API-Key'
          }
        },
        schemas: this.generateSchemas()
      },
      paths: this.generatePaths(),
      tags: this.generateTags()
    };

    const outputPath = 'docs/api/openapi.json';
    await this.ensureDirectoryExists(path.dirname(outputPath));
    fs.writeFileSync(outputPath, JSON.stringify(spec, null, 2));
    console.log(`✅ OpenAPI spec saved to ${outputPath}`);
  }

  private generatePaths(): Record<string, any> {
    const paths: Record<string, any> = {};

    this.endpoints.forEach(endpoint => {
      if (!paths[endpoint.path]) {
        paths[endpoint.path] = {};
      }

      paths[endpoint.path][endpoint.method.toLowerCase()] = {
        summary: endpoint.summary,
        description: endpoint.description,
        tags: endpoint.tags,
        parameters: endpoint.parameters,
        requestBody: endpoint.requestBody,
        responses: this.formatResponsesForOpenAPI(endpoint.responses),
        security: endpoint.authentication.length > 0 ? [{ bearerAuth: [] }] : []
      };
    });

    return paths;
  }

  private formatResponsesForOpenAPI(responses: Response[]): Record<string, any> {
    const formattedResponses: Record<string, any> = {};

    responses.forEach(response => {
      formattedResponses[response.statusCode.toString()] = {
        description: response.description,
        content: response.content,
        headers: response.headers
      };
    });

    return formattedResponses;
  }

  private generateSchemas(): Record<string, any> {
    return {
      ApiResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: { type: 'object' },
          message: { type: 'string' },
          error: { type: 'string' }
        }
      },
      Agent: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          type: { type: 'string' },
          status: { type: 'string', enum: ['active', 'inactive', 'busy'] },
          capabilities: { type: 'array', items: { type: 'string' } }
        }
      },
      Memory: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          content: { type: 'string' },
          type: { type: 'string' },
          metadata: { type: 'object' },
          created_at: { type: 'string', format: 'date-time' }
        }
      }
    };
  }

  private generateTags(): Array<{ name: string; description: string }> {
    const tags = [...new Set(this.endpoints.flatMap(e => e.tags))];
    return tags.map(tag => ({
      name: tag,
      description: `${tag} related endpoints`
    }));
  }

  private async generateMarkdownDocs(): Promise<void> {
    console.log('📄 Generating Markdown documentation...');

    let markdown = `# Universal AI Tools API Documentation

This document provides comprehensive API documentation for Universal AI Tools, a sophisticated AI orchestration platform.

## Base URL

\`\`\`
http://localhost:9999  # Development
https://api.universal-ai-tools.com  # Production
\`\`\`

## Authentication

The API supports multiple authentication methods:

### Bearer Token (JWT)
\`\`\`http
Authorization: Bearer <your-jwt-token>
\`\`\`

### API Key
\`\`\`http
X-API-Key: <your-api-key>
\`\`\`

## Rate Limiting

API requests are rate limited to prevent abuse. Default limits:
- **100 requests per 15 minutes** per IP address
- **1000 requests per hour** for authenticated users

## Endpoints

`;

    // Group endpoints by tag
    const groupedEndpoints = this.groupEndpointsByTag();

    for (const [tag, endpoints] of Object.entries(groupedEndpoints)) {
      markdown += `\n## ${tag}\n\n`;

      endpoints.forEach(endpoint => {
        markdown += this.generateEndpointMarkdown(endpoint);
      });
    }

    // Add schemas section
    markdown += this.generateSchemasMarkdown();

    const outputPath = 'docs/api/README.md';
    await this.ensureDirectoryExists(path.dirname(outputPath));
    fs.writeFileSync(outputPath, markdown);
    console.log(`✅ Markdown docs saved to ${outputPath}`);
  }

  private groupEndpointsByTag(): Record<string, EndpointDoc[]> {
    const grouped: Record<string, EndpointDoc[]> = {};

    this.endpoints.forEach(endpoint => {
      endpoint.tags.forEach(tag => {
        if (!grouped[tag]) {
          grouped[tag] = [];
        }
        grouped[tag].push(endpoint);
      });
    });

    return grouped;
  }

  private generateEndpointMarkdown(endpoint: EndpointDoc): string {
    let md = `### ${endpoint.method} ${endpoint.path}\n\n`;
    md += `${endpoint.description}\n\n`;

    // Parameters
    if (endpoint.parameters.length > 0) {
      md += `**Parameters:**\n\n`;
      endpoint.parameters.forEach(param => {
        md += `- \`${param.name}\` (${param.in}${param.required ? ', required' : ''}): ${param.description}\n`;
      });
      md += '\n';
    }

    // Request body
    if (endpoint.requestBody) {
      md += `**Request Body:**\n\n\`\`\`json\n${JSON.stringify(endpoint.examples.find(e => e.summary.includes('Request'))?.value || {}, null, 2)}\n\`\`\`\n\n`;
    }

    // Responses
    md += `**Responses:**\n\n`;
    endpoint.responses.forEach(response => {
      md += `- **${response.statusCode}**: ${response.description}\n`;
    });
    md += '\n';

    // Example
    const successExample = endpoint.examples.find(e => e.summary.includes('Success'));
    if (successExample) {
      md += `**Example Response:**\n\n\`\`\`json\n${JSON.stringify(successExample.value, null, 2)}\n\`\`\`\n\n`;
    }

    md += '---\n\n';
    return md;
  }

  private generateSchemasMarkdown(): string {
    return `
## Data Schemas

### ApiResponse
\`\`\`json
{
  "success": boolean,
  "data": object,
  "message": string,
  "error": string
}
\`\`\`

### Agent
\`\`\`json
{
  "id": string,
  "name": string,
  "type": string,
  "status": "active" | "inactive" | "busy",
  "capabilities": string[]
}
\`\`\`

### Memory
\`\`\`json
{
  "id": string,
  "content": string,
  "type": string,
  "metadata": object,
  "created_at": string
}
\`\`\`
`;
  }

  private async generateHTMLDocs(): Promise<void> {
    console.log('🌐 Generating HTML documentation...');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Universal AI Tools API Documentation</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 0; margin-bottom: 30px; }
        .header h1 { margin: 0; text-align: center; font-size: 2.5rem; }
        .nav { background: #f8f9fa; padding: 15px; margin-bottom: 30px; border-radius: 8px; }
        .nav a { margin-right: 20px; color: #667eea; text-decoration: none; font-weight: 500; }
        .nav a:hover { text-decoration: underline; }
        .endpoint { background: #fff; border: 1px solid #e9ecef; border-radius: 8px; margin-bottom: 20px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .method { display: inline-block; padding: 4px 12px; border-radius: 4px; font-weight: bold; margin-right: 10px; }
        .get { background: #28a745; color: white; }
        .post { background: #007bff; color: white; }
        .put { background: #ffc107; color: black; }
        .delete { background: #dc3545; color: white; }
        .code { background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 4px; padding: 15px; margin: 10px 0; overflow-x: auto; }
        .params { margin: 15px 0; }
        .param { padding: 8px; margin: 5px 0; border-left: 3px solid #667eea; background: #f8f9fa; }
    </style>
</head>
<body>
    <div class="header">
        <div class="container">
            <h1>Universal AI Tools API</h1>
            <p>Comprehensive API documentation for the sophisticated AI orchestration platform</p>
        </div>
    </div>
    
    <div class="container">
        <div class="nav">
            <a href="#authentication">Authentication</a>
            <a href="#rate-limiting">Rate Limiting</a>
            <a href="#endpoints">Endpoints</a>
            <a href="#schemas">Schemas</a>
        </div>

        <section id="authentication">
            <h2>Authentication</h2>
            <p>The API supports Bearer token (JWT) and API key authentication:</p>
            <div class="code">
                <pre><code>Authorization: Bearer &lt;your-jwt-token&gt;
X-API-Key: &lt;your-api-key&gt;</code></pre>
            </div>
        </section>

        <section id="rate-limiting">
            <h2>Rate Limiting</h2>
            <p>API requests are rate limited:</p>
            <ul>
                <li><strong>100 requests per 15 minutes</strong> per IP address</li>
                <li><strong>1000 requests per hour</strong> for authenticated users</li>
            </ul>
        </section>

        <section id="endpoints">
            <h2>Endpoints</h2>
            ${this.generateEndpointsHTML()}
        </section>

        <section id="schemas">
            <h2>Data Schemas</h2>
            ${this.generateSchemasHTML()}
        </section>
    </div>

    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-json.min.js"></script>
</body>
</html>`;

    const outputPath = 'docs/api/index.html';
    await this.ensureDirectoryExists(path.dirname(outputPath));
    fs.writeFileSync(outputPath, html);
    console.log(`✅ HTML docs saved to ${outputPath}`);
  }

  private generateEndpointsHTML(): string {
    let html = '';

    const groupedEndpoints = this.groupEndpointsByTag();

    for (const [tag, endpoints] of Object.entries(groupedEndpoints)) {
      html += `<h3>${tag}</h3>`;

      endpoints.forEach(endpoint => {
        html += `
        <div class="endpoint">
            <h4>
                <span class="method ${endpoint.method.toLowerCase()}">${endpoint.method}</span>
                <code>${endpoint.path}</code>
            </h4>
            <p>${endpoint.description}</p>
            
            ${endpoint.parameters.length > 0 ? `
            <div class="params">
                <strong>Parameters:</strong>
                ${endpoint.parameters.map(param => `
                <div class="param">
                    <strong>${param.name}</strong> (${param.in}${param.required ? ', required' : ''}) - ${param.description}
                </div>
                `).join('')}
            </div>
            ` : ''}
            
            ${endpoint.examples.length > 0 ? `
            <strong>Example Response:</strong>
            <div class="code">
                <pre><code class="language-json">${JSON.stringify(endpoint.examples.find(e => e.summary.includes('Success'))?.value || {}, null, 2)}</code></pre>
            </div>
            ` : ''}
        </div>
        `;
      });
    }

    return html;
  }

  private generateSchemasHTML(): string {
    return `
    <div class="code">
        <h4>ApiResponse</h4>
        <pre><code class="language-json">{
  "success": "boolean",
  "data": "object",
  "message": "string",
  "error": "string"
}</code></pre>
    </div>

    <div class="code">
        <h4>Agent</h4>
        <pre><code class="language-json">{
  "id": "string",
  "name": "string", 
  "type": "string",
  "status": "active | inactive | busy",
  "capabilities": ["string"]
}</code></pre>
    </div>

    <div class="code">
        <h4>Memory</h4>
        <pre><code class="language-json">{
  "id": "string",
  "content": "string",
  "type": "string",
  "metadata": "object",
  "created_at": "string"
}</code></pre>
    </div>
    `;
  }

  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }
}

// Run the documentation generator
if (require.main === module) {
  const generator = new APIDocumentationGenerator();
  
  generator.generate().then(() => {
    console.log('🎉 Documentation generation completed successfully!');
    process.exit(0);
  }).catch((error) => {
    console.error('❌ Documentation generation failed:', error);
    process.exit(1);
  });
}

export { APIDocumentationGenerator };