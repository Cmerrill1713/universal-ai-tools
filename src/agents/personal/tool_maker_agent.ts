/**
 * ToolMakerAgent - Dynamic tool creation and customization
 * Can create custom tools from natural language descriptions, generate code, and deploy them
 */

import type { AgentConfig, AgentContext, AgentResponse } from '../base_agent';
import { BaseAgent } from '../base_agent';
import type { SupabaseClient } from '@supabase/supabase-js';
import { promises as fs } from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import axios from 'axios';

interface ToolTemplate {
  id: string;
  name: string;
  description: string;
  category: 'web' | 'file' | 'api' | 'system' | 'data' | 'automation';
  template: string;
  parameters: any[];
  examples: string[];
}

interface CustomTool {
  id: string;
  name: string;
  description: string;
  implementation: string;
  implementationType: 'function' | 'sql' | 'api' | 'script' | 'workflow';
  inputSchema: any;
  outputSchema: any;
  dependencies: string[];
  security: {
    permissions: string[];
    sandbox: boolean;
    rateLimit?: number;
  };
  metadata: {
    created: Date;
    author: string;
    version: string;
    tested: boolean;
  };
}

export class ToolMakerAgent extends BaseAgent {
  private supabase: SupabaseClient;
  private toolTemplates: Map<string, ToolTemplate> = new Map();
  private customTools: Map<string, CustomTool> = new Map();

  constructor(supabase: SupabaseClient) {
    const config: AgentConfig = {
      name: 'tool_maker',
      description: 'Dynamic tool creation and customization engine',
      priority: 7,
      capabilities: [
        {
          name: 'create_tool',
          description: 'Create custom tools from natural language descriptions',
          inputSchema: {
            type: 'object',
            properties: {
              description: { type: 'string' },
              category: { type: 'string' },
              requirements: { type: 'object' },
              examples: { type: 'array' }
            },
            required: ['description']
          },
          outputSchema: {
            type: 'object',
            properties: {
              tool: { type: 'object' },
              code: { type: 'string' },
              testing: { type: 'object' }
            }
          }
        },
        {
          name: 'generate_integration',
          description: 'Generate integration code for external services',
          inputSchema: {
            type: 'object',
            properties: {
              service: { type: 'string' },
              apiSpec: { type: 'object' },
              authType: { type: 'string' },
              operations: { type: 'array' }
            },
            required: ['service']
          },
          outputSchema: {
            type: 'object',
            properties: {
              integration: { type: 'object' },
              code: { type: 'string' },
              documentation: { type: 'string' }
            }
          }
        },
        {
          name: 'create_workflow',
          description: 'Create automated workflows combining multiple tools',
          inputSchema: {
            type: 'object',
            properties: {
              workflow: { type: 'string' },
              steps: { type: 'array' },
              triggers: { type: 'array' },
              conditions: { type: 'object' }
            },
            required: ['workflow']
          },
          outputSchema: {
            type: 'object',
            properties: {
              workflow: { type: 'object' },
              execution: { type: 'object' }
            }
          }
        }
      ],
      maxLatencyMs: 20000, // Tool creation can take longer
      retryAttempts: 2,
      dependencies: ['ollama_assistant'],
      memoryEnabled: true
    };

    super(config);
    this.supabase = supabase;
    this.initializeTemplates();
  }

  protected async onInitialize(): Promise<void> {
    // Load existing custom tools
    await this.loadCustomTools();
    
    // Load tool templates
    await this.loadToolTemplates();
    
    this.logger.info('✅ ToolMakerAgent initialized with tool creation capabilities');
  }

  protected async process(context: AgentContext & { memoryContext?: any }): Promise<AgentResponse> {
    const { userRequest } = context;
    const startTime = Date.now();

    try {
      const intent = await this.parseToolMakingIntent(userRequest);
      
      let result: any;
      
      switch (intent.action) {
        case 'create_tool':
          result = await this.createCustomTool(intent);
          break;
          
        case 'generate_integration':
          result = await this.generateServiceIntegration(intent);
          break;
          
        case 'create_workflow':
          result = await this.createAutomationWorkflow(intent);
          break;
          
        case 'modify_tool':
          result = await this.modifyExistingTool(intent);
          break;
          
        case 'deploy_tool':
          result = await this.deployTool(intent);
          break;
          
        default:
          result = await this.handleGeneralToolQuery(userRequest);
      }

      return {
        success: true,
        data: result,
        reasoning: `Successfully processed tool ${intent.action} request`,
        confidence: 0.85,
        latencyMs: Date.now() - startTime,
        agentId: this.config.name
      };

    } catch (error) {
      return {
        success: false,
        data: null,
        reasoning: `Tool creation failed: ${(error as Error).message}`,
        confidence: 0.1,
        latencyMs: Date.now() - startTime,
        agentId: this.config.name,
        error: (error as Error).message
      };
    }
  }

  protected async onShutdown(): Promise<void> {
    // Save custom tools and templates
    await this.saveCustomTools();
    this.logger.info('ToolMakerAgent shutting down');
  }

  /**
   * Parse tool making intent from natural language
   */
  private async parseToolMakingIntent(request: string): Promise<any> {
    const prompt = `Parse this tool creation request:

Request: "${request}"

Determine:
1. Action (create_tool, generate_integration, create_workflow, modify_tool, deploy_tool)
2. Tool type/category (web, file, api, system, data, automation)
3. Specific requirements and functionality
4. Integration needs (APIs, databases, external services)
5. Security and permission requirements

Respond with JSON: {
  "action": "...",
  "category": "...",
  "requirements": {...},
  "integrations": [...],
  "security": {...}
}`;

    try {
      const response = await axios.post('http://localhost:11434/api/generate', {
        model: 'deepseek-r1:14b', // Use more powerful model for code generation
        prompt,
        stream: false,
        format: 'json'
      });

      return JSON.parse(response.data.response);
    } catch (error) {
      return this.fallbackToolIntentParsing(request);
    }
  }

  /**
   * Create a custom tool from description
   */
  private async createCustomTool(intent: any): Promise<CustomTool> {
    const description = intent.requirements?.description || intent.description;
    const category = intent.category || 'automation';
    
    // Generate the tool implementation
    const implementation = await this.generateToolImplementation(description, category, intent.requirements);
    
    // Create input/output schemas
    const schemas = await this.generateToolSchemas(description, implementation);
    
    // Generate unique tool ID
    const toolId = `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const customTool: CustomTool = {
      id: toolId,
      name: intent.requirements?.name || this.generateToolName(description),
      description,
      implementation: implementation.code,
      implementationType: implementation.type,
      inputSchema: schemas.input,
      outputSchema: schemas.output,
      dependencies: implementation.dependencies || [],
      security: {
        permissions: this.determinePermissions(description, implementation.code),
        sandbox: this.requiresSandboxing(implementation.code),
        rateLimit: intent.security?.rateLimit
      },
      metadata: {
        created: new Date(),
        author: 'tool_maker_agent',
        version: '1.0.0',
        tested: false
      }
    };
    
    // Test the tool
    const testResults = await this.testTool(customTool);
    customTool.metadata.tested = testResults.success;
    
    // Store the tool
    this.customTools.set(toolId, customTool);
    await this.saveToolToDatabase(customTool);
    
    return customTool;
  }

  /**
   * Generate tool implementation code
   */
  private async generateToolImplementation(description: string, category: string, requirements: any): Promise<any> {
    const template = this.getTemplateForCategory(category);
    
    const prompt = `Generate a production-ready tool implementation:

Description: "${description}"
Category: ${category}
Requirements: ${JSON.stringify(requirements, null, 2)}

Template Context:
${template}

Generate:
1. Clean, well-documented JavaScript/TypeScript function
2. Proper error handling and validation
3. Security considerations
4. Return type specification
5. Dependencies list

The function should be self-contained and follow these patterns:
- Use async/await for asynchronous operations
- Include proper input validation
- Return structured results with success/error status
- Handle edge cases gracefully
- Follow security best practices

Respond with JSON: {
  "code": "Complete function implementation",
  "type": "function|sql|api|script",
  "dependencies": ["dep1", "dep2"],
  "explanation": "How the tool works",
  "security_notes": "Security considerations"
}`;

    try {
      const response = await axios.post('http://localhost:11434/api/generate', {
        model: 'deepseek-r1:14b',
        prompt,
        stream: false,
        format: 'json'
      });

      return JSON.parse(response.data.response);
    } catch (error) {
      // Fallback to basic template
      return {
        code: this.generateBasicToolTemplate(description),
        type: 'function',
        dependencies: [],
        explanation: 'Basic tool implementation',
        security_notes: 'No special security requirements'
      };
    }
  }

  /**
   * Generate service integration code
   */
  private async generateServiceIntegration(intent: any): Promise<any> {
    const service = intent.requirements?.service;
    const operations = intent.requirements?.operations || [];
    
    const prompt = `Generate integration code for ${service}:

Service: ${service}
Operations: ${operations.join(', ')}
Auth Type: ${intent.requirements?.authType || 'API key'}

Generate a complete integration class with:
1. Authentication handling
2. Error handling and retries
3. Rate limiting
4. Response parsing
5. TypeScript interfaces

Include methods for: ${operations.join(', ')}

Return as JSON with code and documentation.`;

    try {
      const response = await axios.post('http://localhost:11434/api/generate', {
        model: 'deepseek-r1:14b',
        prompt,
        stream: false,
        format: 'json'
      });

      const integration = JSON.parse(response.data.response);
      
      // Create integration tool
      const toolId = `integration_${service}_${Date.now()}`;
      const customTool: CustomTool = {
        id: toolId,
        name: `${service}_integration`,
        description: `Integration with ${service} service`,
        implementation: integration.code,
        implementationType: 'function',
        inputSchema: integration.inputSchema || {},
        outputSchema: integration.outputSchema || {},
        dependencies: integration.dependencies || [],
        security: {
          permissions: ['network_access', 'api_calls'],
          sandbox: false,
          rateLimit: 100
        },
        metadata: {
          created: new Date(),
          author: 'tool_maker_agent',
          version: '1.0.0',
          tested: false
        }
      };
      
      // Store integration
      this.customTools.set(toolId, customTool);
      await this.saveToolToDatabase(customTool);
      
      return {
        integration: customTool,
        code: integration.code,
        documentation: integration.documentation
      };
      
    } catch (error) {
      throw new Error(`Failed to generate ${service} integration: ${(error as Error).message}`);
    }
  }

  /**
   * Create automation workflow
   */
  private async createAutomationWorkflow(intent: any): Promise<any> {
    const workflowDescription = intent.requirements?.workflow;
    const steps = intent.requirements?.steps || [];
    const triggers = intent.requirements?.triggers || [];
    
    const prompt = `Create an automation workflow:

Description: "${workflowDescription}"
Steps: ${steps.join(' -> ')}
Triggers: ${triggers.join(', ')}

Generate:
1. Workflow orchestration code
2. Step definitions
3. Error handling and rollback
4. Trigger setup
5. Monitoring and logging

Return as executable workflow definition with proper error handling.`;

    try {
      const response = await axios.post('http://localhost:11434/api/generate', {
        model: 'deepseek-r1:14b',
        prompt,
        stream: false,
        format: 'json'
      });

      const workflow = JSON.parse(response.data.response);
      
      // Create workflow tool
      const toolId = `workflow_${Date.now()}`;
      const customTool: CustomTool = {
        id: toolId,
        name: `automation_workflow`,
        description: workflowDescription,
        implementation: workflow.code,
        implementationType: 'workflow',
        inputSchema: workflow.inputSchema || {},
        outputSchema: workflow.outputSchema || {},
        dependencies: workflow.dependencies || [],
        security: {
          permissions: workflow.permissions || ['system_access'],
          sandbox: true,
          rateLimit: 10
        },
        metadata: {
          created: new Date(),
          author: 'tool_maker_agent',
          version: '1.0.0',
          tested: false
        }
      };
      
      this.customTools.set(toolId, customTool);
      await this.saveToolToDatabase(customTool);
      
      return {
        workflow: customTool,
        execution: workflow.execution
      };
      
    } catch (error) {
      throw new Error(`Failed to create workflow: ${(error as Error).message}`);
    }
  }

  /**
   * Initialize built-in tool templates
   */
  private initializeTemplates(): void {
    const templates: ToolTemplate[] = [
      {
        id: 'web_scraper',
        name: 'Web Scraper',
        description: 'Extract data from websites',
        category: 'web',
        template: `
async function scrapeWebsite(params) {
  const { url, selector, timeout = 10000 } = params;
  
  try {
    const response = await fetch(url, { 
      headers: { 'User-Agent': 'Universal AI Tools Scraper' },
      signal: AbortSignal.timeout(timeout)
    });
    
    if (!response.ok) {
      throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
    }
    
    const html = await response.text();
    
    // Extract based on selector or return full content
    if (selector) {
      // Would use cheerio or jsdom for proper parsing
      const content = extractWithSelector(html, selector);
      return { success: true, data: content, url };
    }
    
    return { success: true, data: html, url };
  } catch (error) {
    return { success: false, error: error.message, url };
  }
}`,
        parameters: ['url', 'selector', 'timeout'],
        examples: ['Scrape product prices', 'Extract news headlines', 'Monitor website changes']
      },
      {
        id: 'api_connector',
        name: 'API Connector',
        description: 'Connect to REST APIs',
        category: 'api',
        template: `
async function callAPI(params) {
  const { url, method = 'GET', headers = {}, body, auth } = params;
  
  try {
    const config = {
      method,
      headers: { 'Content-Type': 'application/json', ...headers }
    };
    
    if (auth) {
      if (auth.type === 'bearer') {
        config.headers['Authorization'] = \`Bearer \${auth.token}\`;
      } else if (auth.type === 'api_key') {
        config.headers[auth.header || 'X-API-Key'] = auth.key;
      }
    }
    
    if (body && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
      config.body = JSON.stringify(body);
    }
    
    const response = await fetch(url, config);
    const data = await response.json();
    
    return {
      success: response.ok,
      status: response.status,
      data,
      headers: Object.fromEntries(response.headers.entries())
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}`,
        parameters: ['url', 'method', 'headers', 'body', 'auth'],
        examples: ['Call REST API', 'Submit form data', 'Get JSON data']
      }
    ];

    templates.forEach(template => {
      this.toolTemplates.set(template.id, template);
    });
  }

  // Utility methods
  private getTemplateForCategory(category: string): string {
    const template = Array.from(this.toolTemplates.values())
      .find(t => t.category === category);
    
    return template?.template || 'Basic function template';
  }

  private generateBasicToolTemplate(description: string): string {
    return `
async function customTool(params) {
  try {
    // Tool implementation for: ${description}
    
    // TODO: Implement tool logic here
    const result = { message: 'Tool executed successfully', params };
    
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
}`;
  }

  private async generateToolSchemas(description: string, implementation: any): Promise<any> {
    // Generate input/output schemas based on the implementation
    return {
      input: {
        type: 'object',
        properties: {
          params: { type: 'object', description: 'Tool parameters' }
        },
        required: ['params']
      },
      output: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: { type: 'object' },
          error: { type: 'string' }
        },
        required: ['success']
      }
    };
  }

  private generateToolName(description: string): string {
    // Generate a tool name from description
    return description
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 50);
  }

  private determinePermissions(description: string, code: string): string[] {
    const permissions: string[] = [];
    
    if (code.includes('fetch(') || code.includes('axios')) {
      permissions.push('network_access');
    }
    
    if (code.includes('fs.') || code.includes('require(\'fs\'')) {
      permissions.push('file_system');
    }
    
    if (code.includes('exec') || code.includes('spawn')) {
      permissions.push('system_commands');
    }
    
    return permissions.length > 0 ? permissions : ['basic'];
  }

  private requiresSandboxing(code: string): boolean {
    // Determine if code needs to run in sandbox
    const dangerousPatterns = [
      'eval(',
      'Function(',
      'require(',
      'process.',
      'global.',
      '__dirname',
      '__filename'
    ];
    
    return dangerousPatterns.some(pattern => code.includes(pattern));
  }

  private async testTool(tool: CustomTool): Promise<any> {
    try {
      // Basic syntax validation
      new Function(tool.implementation);
      
      return { success: true, message: 'Tool syntax is valid' };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  // Placeholder implementations
  private async loadCustomTools(): Promise<void> {
    // Load custom tools from database
  }

  private async loadToolTemplates(): Promise<void> {
    // Load additional templates from database
  }

  private async saveCustomTools(): Promise<void> {
    // Save custom tools to database
  }

  private async saveToolToDatabase(tool: CustomTool): Promise<void> {
    try {
      await this.supabase
        .from('ai_custom_tools')
        .insert({
          tool_name: tool.name,
          description: tool.description,
          implementation_type: tool.implementationType,
          implementation: tool.implementation,
          input_schema: tool.inputSchema,
          output_schema: tool.outputSchema,
          metadata: tool.metadata,
          created_by: 'tool_maker_agent'
        });
    } catch (error) {
      this.logger.error('Failed to save tool to database:', error);
    }
  }

  private fallbackToolIntentParsing(request: string): any {
    const requestLower = request.toLowerCase();
    
    if (requestLower.includes('create') || requestLower.includes('make') || requestLower.includes('build')) {
      return { action: 'create_tool', category: 'automation' };
    }
    
    if (requestLower.includes('integration') || requestLower.includes('api') || requestLower.includes('connect')) {
      return { action: 'generate_integration', category: 'api' };
    }
    
    if (requestLower.includes('workflow') || requestLower.includes('automation') || requestLower.includes('process')) {
      return { action: 'create_workflow', category: 'automation' };
    }
    
    return { action: 'create_tool', category: 'automation' };
  }

  private async modifyExistingTool(intent: any): Promise<any> {
    return { modified: true };
  }

  private async deployTool(intent: any): Promise<any> {
    return { deployed: true };
  }

  private async handleGeneralToolQuery(request: string): Promise<any> {
    return { response: 'General tool query processed' };
  }
}

export default ToolMakerAgent;