import axios from 'axios';
import { logger } from '../utils/logger';
import type { SupabaseClient } from '@supabase/supabase-js';

interface Memory {
  id: string;
  content string;
  [key: string]: any;
}

interface Knowledge {
  id: string;
  title: string;
  content string;
  [key: string]: any;
}

interface Context {
  memories: Memory[] | null;
  knowledge: Knowledge[] | null;
}

interface Tool {
  tool_name: string;
  description: string;
  [key: string]: any;
}

type ToolDescriptionKey =
  | 'trading_data_provider'
  | 'database_connector'
  | 'memory_store'
  | 'context_store'
  | 'web_scraper'
  | 'api_integrator'
  | 'file_processor'
  | 'notification_system'
  | 'ai_model_connector'
  | 'workflow_orchestrator'
  | 'security_scanner'
  | 'performance_monitor'
  | 'backup_manager'
  | 'deployment_manager';

export class OllamaAssistant {
  private ollamaUrl: string;
  private model: string | null = null;
  private availableModels: string[] = [];
  private supabase: SupabaseClient;
  private preferredModels = [
    'llama3.2:3b',
    'gemma:2b',
    'phi:2.7b-chat-v2-q4_0',
    'qwen2.5:7b',
    'deepseek-r1:14b',
    'nous-hermes:13b-llama2-q4_K_M',
  ];

  constructor(supabase: SupabaseClient) {
    this.ollamaUrl = process.env.OLLAMA_HOST || 'http://localhost:11434';
    this.supabase = supabase;
    // Don't initialize model in constructor - fully lazy initialization
    logger.info('OllamaAssistant initialized - models will be loaded on first use');
  }

  private async initializeModel() {
    try {
      logger.info('Initializing Ollama models...');
      // Get list of available models with short timeout
      const response = await axios.get(`${this.ollamaUrl}/api/tags`, {
        timeout: 3000, // 3 second timeout
        headers: {
          'Content-Type': 'application/json',
        },
      });

      this.availableModels = response.data.models.map((m: any) => m.name);
      logger.info(`Found ${this.availableModels.length} Ollama models`);

      // Select the first available preferred model
      for (const preferred of this.preferredModels) {
        if (this.availableModels.some((model) => model.startsWith(preferred))) {
          this.model = this.availableModels.find((model) => model.startsWith(preferred)) || null;
          logger.info(`Selected Ollama model: ${this.model}`);
          break;
        }
      }

      // If no preferred model found, use the first available
      if (!this.model && this.availableModels.length > 0) {
        this.model = this.availableModels[0];
        logger.info(`Using first available model: ${this.model}`);
      }

      if (!this.model) {
        logger.warn('No Ollama models available, will use fallback');
        this.model = process.env.OLLAMA_MODEL || 'llama3.2:3b'; // Default fallback
      }
    } catch (error) {
      logger.error('Failed to initialize Ollama model:', error);
      // Fallback to environment variable or default
      this.model = process.env.OLLAMA_MODEL || 'llama3.2:3b';
      logger.info(`Using fallback model: ${this.model}`);
    }
  }

  private async ensureModel(): Promise<string> {
    if (!this.model) {
      await this.initializeModel();
      if (!this.model) {
        throw new Error('No Ollama models available');
      }
    }
    return this.model;
  }

  /**
   * Analyze a requestand suggest appropriate tools
   */
  async suggestTools(userRequest: string, availableTools: Tool[]): Promise<unknown> {
    try {
      // First, analyze the request to understand intent
      const requestAnalysis = await this.analyzeRequestIntent(userRequest);

      // Get relevant context from memory and knowledge base
      const context = await this.getRelevantContext(userRequest);

      // Build comprehensive available tools list
      const toolsList = await this.buildToolsList(availableTools);

      const prompt = `You are an expert AI assistant specializing in tool selection and system integration. Analyze the user's requestand provide intelligent tool recommendations.

USER REQUEST: "${userRequest}"

REQUEST ANALYSIS:
- Intent: ${requestAnalysis.intent}
- Domain: ${requestAnalysis.domain}
- Complexity: ${requestAnalysis.complexity}
- Action Type: ${requestAnalysis.actionType}

AVAILABLE TOOLS:
${toolsList}

RELEVANT CONTEXT:
${
  context.memories
    ? `Previous Experience: ${context.memories
        .slice(0, 3)
        .map((m: Memory) => m.content
        .join('; ')}`
    : 'No previous experience found'
}
${
  context.knowledge
    ? `Knowledge Base: ${context.knowledge
        .slice(0, 2)
        .map((k: Knowledge) => `${k.title}: ${k.contentsubstring(0, 100)}`)
        .join('; ')}`
    : 'No relevant knowledge found'
}

INTELLIGENT ANALYSIS:
Based on the request_analysis determine:
1. What specific problem the user is trying to solve
2. Which tools best match their needs (not just generic memory storage)
3. What additional setup or configuration might be needed
4. Any potential challenges or considerations

Respond with a JSON object containing:
{
  "suggested_tools": ["specific_tool1", "specific_tool2"],
  "reasoning": "Detailed explanation of why these tools are recommended",
  "setup_steps": ["Step 1", "Step 2", "Step 3"],
  "parameters": { 
    "tool_name": { "param1": "suggested_value", "param2": "suggested_value" }
  },
  "additional_recommendations": "Any extra suggestions or considerations",
  "estimated_complexity": "low|medium|high"
}`;

      const model = await this.ensureModel();
      const response = await axios.post(`${this.ollamaUrl}/api/generate`, {
        model,
        prompt,
        stream: false,
        format: 'json',
      });

      const result = JSON.parse(response.data.response);

      // Store this interaction for future learning
      await this.storeInteraction(userRequest, result);

      return result;
    } catch (error) {
      logger.error('Ollama tool suggestion failed:', error);
      // Fallback to basic _analysisif Ollama fails
      return await this.fallbackToolSuggestion(userRequest, availableTools);
    }
  }

  /**
   * Analyze requestintent and characteristics
   */
  private async analyzeRequestIntent(request string): Promise<unknown> {
    try {
      const model = await this.ensureModel();
      const prompt = `Analyze this requestand categorize it:

Request: "${request"

Determine:
1. Intent (setup, create, analyze, integrate, troubleshoot, learn, etc.)
2. Domain (trading, development, ai, database, web, mobile, etc.)
3. Complexity (low, medium, high)
4. Action Type (configuration, development, deployment, monitoring, etc.)

Respond with JSON: {"intent": "...", "domain": "...", "complexity": "...", "actionType": "..."}`;

      const response = await axios.post(`${this.ollamaUrl}/api/generate`, {
        model,
        prompt,
        stream: false,
        format: 'json',
      });

      return JSON.parse(response.data.response);
    } catch (error) {
      logger.error('Request analysis failed:', error);
      return {
        intent: 'unknown',
        domain: 'general',
        complexity: 'medium',
        actionType: 'configuration',
      };
    }
  }

  /**
   * Get relevant context from memory and knowledge base
   */
  private async getRelevantContext(request string): Promise<Context> {
    try {
      // Get relevant memories
      const { data: memories } = await this.supabase
        .from('ai_memories')
        .select('*')
        .textSearch('content, request
        .limit(5);

      // Get relevant knowledge
      const { data: knowledge } = await this.supabase
        .from('ai_knowledge_base')
        .select('*')
        .textSearch('content, request
        .limit(3);

      return { memories, knowledge };
    } catch (error) {
      logger.error('Context retrieval failed:', error);
      return { memories: null, knowledge: null };
    }
  }

  /**
   * Build comprehensive tools list with detailed descriptions
   */
  private async buildToolsList(availableTools: Tool[]): Promise<string> {
    // Enhanced tool descriptions based on common use cases
    const toolDescriptions: Record<ToolDescriptionKey, string> = {
      trading_data_provider: 'Real-time market data, price feeds, and trading signals',
      database_connector: 'Universal database connections (PostgreSQL, MySQL, MongoDB, etc.)',
      memory_store: 'Persistent memory storage for AI agents and user context',
      context_store: 'Session and conversation context management',
      web_scraper: 'Web contentextraction and monitoring',
      api_integrator: 'REST and GraphQL API integration tools',
      file_processor: 'File parsing, conversion, and processing utilities',
      notification_system: 'Multi-channel notifications (email, SMS, Slack, etc.)',
      ai_model_connector: 'Connect to various AI models (OpenAI, Anthropic, local models)',
      workflow_orchestrator: 'Automated task sequences and scheduling',
      security_scanner: 'Security validation and compliance checking',
      performance_monitor: 'System performance tracking and optimization',
      backup_manager: 'Automated backup and disaster recovery',
      deployment_manager: 'Application deployment and CI/CD integration',
    };

    return (
      `${availableTools
        .map((tool) => {
          const enhanced =
            toolDescriptions[tool.tool_name as ToolDescriptionKey] || tool.description;
          return `- ${tool.tool_name}: ${enhanced}`;
        })
        .join('\n')}\n\n` +
      `Additional Available Tools:\n${Object.entries(toolDescriptions)
        .map(([name, desc]) => `- ${name}: ${desc}`)
        .join('\n')}`
    );
  }

  /**
   * Store interaction for future learning
   */
  private async storeInteraction(request string, response: any): Promise<void> {
    try {
      await this.supabase.from('ai_interactions').insert({
        request_text: request
        response_data: response,
        interaction_type: 'tool_suggestion',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Failed to store interaction:', error);
    }
  }

  /**
   * Fallback tool suggestion when Ollama fails
   */
  private async fallbackToolSuggestion(request string, availableTools: any[]): Promise<unknown> {
    const requestLower = request toLowerCase();

    // Basic keyword matching
    const suggestions = [];

    if (
      requestLower.includes('trading') ||
      requestLower.includes('bot') ||
      requestLower.includes('market')
    ) {
      suggestions.push('trading_data_provider', 'memory_store', 'notification_system');
    }

    if (requestLower.includes('database') || requestLower.includes('data')) {
      suggestions.push('database_connector', 'memory_store');
    }

    if (
      requestLower.includes('web') ||
      requestLower.includes('scraping') ||
      requestLower.includes('api')
    ) {
      suggestions.push('web_scraper', 'api_integrator');
    }

    if (
      requestLower.includes('ai') ||
      requestLower.includes('model') ||
      requestLower.includes('llm')
    ) {
      suggestions.push('ai_model_connector', 'memory_store', 'context_store');
    }

    if (requestLower.includes('deploy') || requestLower.includes('production')) {
      suggestions.push('deployment_manager', 'security_scanner', 'performance_monitor');
    }

    // Default suggestions if nothing matches
    if (suggestions.length === 0) {
      suggestions.push('memory_store', 'context_store', 'api_integrator');
    }

    return {
      suggested_tools: suggestions.slice(0, 3),
      reasoning:
        'Basic _analysisbased on keywords in your request For more detailed suggestions, please ensure Ollama is running.',
      setup_steps: [
        'Review the suggested tools',
        'Check tool documentation',
        'Configure required parameters',
        'Test the integration',
      ],
      parameters: {},
      additional_recommendations: 'Consider using multiple tools together for complex workflows',
      estimated_complexity: 'medium',
    };
  }

  /**
   * Generate code to connect a new program to the Universal AI Tools
   */
  async generateConnectionCode(
    language: string,
    framework: string,
    purpose: string
  ): Promise<string> {
    const prompt = `Generate ${language} code to connect to the Universal AI Tools API.

Framework: ${framework}
Purpose: ${purpose}
API Base URL: http://localhost:9999/api
Authentication: X-API-Key and X-AI-Service headers

The code should:
1. Register the service
2. Store the API key
3. Implement basic tool execution
4. Handle errors properly

Provide clean, production-ready code with comments.`;

    try {
      const model = await this.ensureModel();
      const response = await axios.post(`${this.ollamaUrl}/api/generate`, {
        model,
        prompt,
        stream: false,
      });

      return response.data.response;
    } catch (error) {
      logger.error('Ollama code generation failed:', error);
      throw error;
    }
  }

  /**
   * Analyze a codebase and suggest integration points
   */
  async analyzeIntegrationPoints(codeStructure: any): Promise<unknown> {
    const prompt = `Analyze this code structure and suggest where to integrate Universal AI Tools:

Structure:
${JSON.stringify(codeStructure, null, 2)}

Suggest:
1. Where to add AI memory storage
2. Where to implement context saving
3. Which existing functions could benefit from AI assistance
4. How to structure the integration

Respond with specific file paths and code locations.`;

    try {
      const response = await axios.post(`${this.ollamaUrl}/api/generate`, {
        model: this.model,
        prompt,
        stream: false,
      });

      return response.data.response;
    } catch (error) {
      logger.error('Ollama analysis failed:', error);
      throw error;
    }
  }

  /**
   * Create a custom tool implementation
   */
  async createToolImplementation(
    toolName: string,
    description: string,
    requirements: string
  ): Promise<unknown> {
    const prompt = `Create a tool implementation for the Universal AI Tools system.

Tool Name: ${toolName}
Description: ${description}
Requirements: ${requirements}

Generate:
1. Input schema (JSON Schema format)
2. Implementation code (JavaScript function)
3. Output schema
4. Usage example

The implementation should be self-contained and handle errors.`;

    try {
      const response = await axios.post(`${this.ollamaUrl}/api/generate`, {
        model: this.model,
        prompt,
        stream: false,
      });

      const toolCode = response.data.response;

      // Parse and structure the response
      // This is a simplified version - you'd want more robust parsing
      return {
        tool_name: toolName,
        description,
        input_schema: { type: 'object', properties: {} },
        implementation_type: 'function',
        implementation: toolCode,
        generated_by: 'ollama-assistant',
      };
    } catch (error) {
      logger.error('Tool creation failed:', error);
      throw error;
    }
  }

  /**
   * Generate API documentation for a specific use case
   */
  async generateDocumentation(useCase: string, language: string): Promise<string> {
    const prompt = `Generate API documentation for using Universal AI Tools.

Use Case: ${useCase}
Programming Language: ${language}

Include:
1. Setup instructions
2. Authentication example
3. Common operations
4. Error handling
5. Best practices

Format as markdown with code examples.`;

    try {
      const response = await axios.post(`${this.ollamaUrl}/api/generate`, {
        model: this.model,
        prompt,
        stream: false,
      });

      return response.data.response;
    } catch (error) {
      logger.error('Documentation generation failed:', error);
      throw error;
    }
  }

  /**
   * Intelligently route requests to appropriate tools
   */
  async routeRequest(request string, context?: any): Promise<unknown> {
    // First, check if we have relevant memory
    const { data: memories } = await this.supabase
      .from('ai_memories')
      .select('*')
      .textSearch('content, request
      .limit(5);

    // Then check knowledge base
    const { data: knowledge } = await this.supabase
      .from('ai_knowledge_base')
      .select('*')
      .textSearch('content, request
      .limit(5);

    const prompt = `Route this request to the appropriate tool or action:

Request: "${request"

Relevant Context:
${context ? JSON.stringify(context, null, 2) : 'None'}

Related Memories:
${memories?.map((m) => m.content.join('\n') || 'None'}

Related Knowledge:
${knowledge?.map((k) => `${k.title}: ${k.content`).join('\n') || 'None'}

Determine:
1. What type of operation this is (store, retrieve, execute, etc.)
2. Which specific tool to use
3. What parameters to pass

Respond with a JSON object containing the routing decision.`;

    try {
      const model = await this.ensureModel();
      const response = await axios.post(`${this.ollamaUrl}/api/generate`, {
        model,
        prompt,
        stream: false,
        format: 'json',
      });

      return JSON.parse(response.data.response);
    } catch (error) {
      logger.error('Request routing failed:', error);
      return null;
    }
  }
}

// Singleton instance
let ollamaAssistant: OllamaAssistant | null = null;

export function getOllamaAssistant(supabase: SupabaseClient): OllamaAssistant {
  if (!ollamaAssistant) {
    ollamaAssistant = new OllamaAssistant(supabase);
  }
  return ollamaAssistant;
}
