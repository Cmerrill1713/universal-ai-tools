/**
 * Adaptive Tool Integration for Universal AI Tools
 * Integrates MCP-Enhanced adaptive tools with existing agents
 */

import { AgentResponse, BaseAgent } from '../agents/base_agent';
import type { SupabaseClient } from '@supabase/supabase-js';

interface AdaptiveToolSignature {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
  };
  examples: any[];
  formatPreferences: FormatPreference[];
}

interface FormatPreference {
  model_pattern: string;
  input_format: 'structured' | 'json' | 'natural' | 'string';
  output_format: 'markdown' | 'json' | 'string' | 'structured';
  parameter_style: 'explicit' | 'conversational' | 'implied';
  example: any;
}

export class AdaptiveToolManager {
  private tools: Map<string, AdaptiveToolSignature> = new Map();
  private learningHistory: Map<string, any> = new Map();
  private supabase: SupabaseClient;
  
  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    this.initializeAdaptiveTools();
  }

  private initializeAdaptiveTools() {
    // Register all adaptive tools
    this.registerFileOperationTool();
    this.registerSearchTool();
    this.registerCodeAnalysisTool();
    this.registerDataProcessingTool();
    this.registerWebInteractionTool();
  }

  private registerFileOperationTool() {
    const tool: AdaptiveToolSignature = {
      name: 'adaptive_file_operation',
      description: 'Intelligent file operations that adapt to different AI models',
      parameters: {
        type: 'object',
        properties: {
          operation: { type: 'string', enum: ['read', 'write', 'list', 'delete', 'organize'] },
          path: { type: 'string' },
          content: { type: 'string', optional: true },
          options: { type: 'object', optional: true }
        }
      },
      examples: [],
      formatPreferences: [
        {
          model_pattern: '*ollama*llama*',
          input_format: 'natural',
          output_format: 'string',
          parameter_style: 'conversational',
          example: 'read the file at /path/to/file.txt and show me its contents'
        },
        {
          model_pattern: '*deepseek*',
          input_format: 'json',
          output_format: 'structured',
          parameter_style: 'explicit',
          example: {
            cmd: 'read',
            file_path: '/path/to/file.txt',
            opts: {}
          }
        },
        {
          model_pattern: '*gemma*',
          input_format: 'string',
          output_format: 'string',
          parameter_style: 'implied',
          example: '/path/to/file.txt read'
        }
      ]
    };
    
    this.tools.set(tool.name, tool);
  }

  private registerSearchTool() {
    const tool: AdaptiveToolSignature = {
      name: 'adaptive_search',
      description: 'Smart search that adapts query format to model preferences',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          scope: { type: 'string', enum: ['files', 'content', 'code', 'photos', 'all'] },
          filters: { type: 'object', optional: true },
          limit: { type: 'number', default: 10 }
        }
      },
      examples: [],
      formatPreferences: [
        {
          model_pattern: '*llama*',
          input_format: 'natural',
          output_format: 'string',
          parameter_style: 'conversational',
          example: 'find all photos of Sarah from last summer vacation'
        },
        {
          model_pattern: '*deepseek*',
          input_format: 'json',
          output_format: 'json',
          parameter_style: 'explicit',
          example: {
            search_query: 'function implementation',
            search_type: 'code',
            max_results: 10
          }
        },
        {
          model_pattern: '*qwen*',
          input_format: 'json',
          output_format: 'structured',
          parameter_style: 'explicit',
          example: {
            q: 'meeting notes',
            in: 'documents',
            limit: 20
          }
        }
      ]
    };
    
    this.tools.set(tool.name, tool);
  }

  private registerCodeAnalysisTool() {
    const tool: AdaptiveToolSignature = {
      name: 'adaptive_code_analysis',
      description: 'Code analysis that adapts complexity to model capabilities',
      parameters: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          analysis_type: { type: 'string', enum: ['review', 'debug', 'optimize', 'explain', 'refactor'] },
          language: { type: 'string', optional: true },
          context: { type: 'object', optional: true }
        }
      },
      examples: [],
      formatPreferences: [
        {
          model_pattern: '*deepseek*',
          input_format: 'structured',
          output_format: 'structured',
          parameter_style: 'explicit',
          example: {
            source_code: 'function example() {...}',
            task: 'comprehensive_analysis',
            output_sections: ['bugs', 'performance', 'suggestions']
          }
        },
        {
          model_pattern: '*llama*',
          input_format: 'natural',
          output_format: 'markdown',
          parameter_style: 'conversational',
          example: 'analyze this TypeScript function for potential bugs and suggest improvements'
        },
        {
          model_pattern: '*phi*',
          input_format: 'json',
          output_format: 'json',
          parameter_style: 'explicit',
          example: {
            code: 'function example() {...}',
            mode: 'review',
            focus: ['security', 'performance']
          }
        }
      ]
    };
    
    this.tools.set(tool.name, tool);
  }

  private registerDataProcessingTool() {
    const tool: AdaptiveToolSignature = {
      name: 'adaptive_data_processing',
      description: 'Data processing that adapts to model data handling strengths',
      parameters: {
        type: 'object',
        properties: {
          data: { type: 'any' },
          operation: { type: 'string', enum: ['transform', 'filter', 'aggregate', 'validate', 'analyze'] },
          format: { type: 'string', enum: ['json', 'csv', 'xml', 'yaml', 'auto'] },
          rules: { type: 'object', optional: true }
        }
      },
      examples: [],
      formatPreferences: [
        {
          model_pattern: '*llama*',
          input_format: 'natural',
          output_format: 'string',
          parameter_style: 'conversational',
          example: 'filter this data to show only entries from last week with status active'
        },
        {
          model_pattern: '*deepseek*',
          input_format: 'json',
          output_format: 'json',
          parameter_style: 'explicit',
          example: {
            dataset: [{id: 1, date: '2024-01-15', status: 'active'}],
            filter_rules: {date_range: 'last_week', status: 'active'}
          }
        }
      ]
    };
    
    this.tools.set(tool.name, tool);
  }

  private registerWebInteractionTool() {
    const tool: AdaptiveToolSignature = {
      name: 'adaptive_web_interaction',
      description: 'Web scraping and interaction adapted to model capabilities',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string' },
          action: { type: 'string', enum: ['fetch', 'scrape', 'monitor', 'extract', 'interact'] },
          selectors: { type: 'array', items: { type: 'string' }, optional: true },
          interaction: { type: 'object', optional: true }
        }
      },
      examples: [],
      formatPreferences: [
        {
          model_pattern: '*llama*',
          input_format: 'natural',
          output_format: 'markdown',
          parameter_style: 'conversational',
          example: 'go to techcrunch.com and get me the latest AI news headlines'
        },
        {
          model_pattern: '*deepseek*',
          input_format: 'json',
          output_format: 'structured',
          parameter_style: 'explicit',
          example: {
            target: 'https://news.ycombinator.com',
            extract: ['title', 'points', 'comments'],
            limit: 10
          }
        }
      ]
    };
    
    this.tools.set(tool.name, tool);
  }

  /**
   * Execute a tool with automatic format adaptation
   */
  async executeAdaptiveTool(
    toolName: string, 
    input: any, 
    modelUsed: string,
    context?: any
  ): Promise<any> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`Tool ${toolName} not found`);
    }

    // Find best format preference for the model
    const preference = this.findBestFormatPreference(tool, modelUsed);
    
    // Transform input based on preference
    const transformedInput = this.transformInput(input, preference);
    
    // Execute the actual tool logic
    const result = await this.executeToolLogic(toolName, transformedInput, context);
    
    // Transform output based on preference
    const transformedOutput = this.transformOutput(result, preference);
    
    // Learn from this execution
    await this.learnFromExecution(toolName, modelUsed, input, transformedOutput);
    
    return transformedOutput;
  }

  private findBestFormatPreference(
    tool: AdaptiveToolSignature, 
    modelName: string
  ): FormatPreference {
    // First check learned preferences
    const learnedKey = `${tool.name}:${modelName}`;
    const learned = this.learningHistory.get(learnedKey);
    if (learned?.preference) {
      return learned.preference;
    }

    // Then check configured preferences
    for (const pref of tool.formatPreferences) {
      const pattern = pref.model_pattern.replace(/\*/g, '.*');
      if (new RegExp(pattern, 'i').test(modelName)) {
        return pref;
      }
    }

    // Default preference
    return {
      model_pattern: '*',
      input_format: 'json',
      output_format: 'json',
      parameter_style: 'explicit',
      example: {}
    };
  }

  private transformInput(input: any, preference: FormatPreference): any {
    switch (preference.input_format) {
      case 'natural':
        return this.convertToNaturalLanguage(input);
      case 'string':
        return this.convertToStringFormat(input);
      case 'structured':
        return this.convertToStructuredFormat(input, preference.example);
      case 'json':
      default:
        return input;
    }
  }

  private transformOutput(output: any, preference: FormatPreference): any {
    switch (preference.output_format) {
      case 'markdown':
        return this.convertToMarkdown(output);
      case 'string':
        return this.convertToString(output);
      case 'structured':
        return this.convertToStructured(output);
      case 'json':
      default:
        return output;
    }
  }

  private async executeToolLogic(toolName: string, input: any, context?: any): Promise<any> {
    // This would be replaced with actual tool implementations
    switch (toolName) {
      case 'adaptive_file_operation':
        return this.executeFileOperation(input, context);
      case 'adaptive_search':
        return this.executeSearch(input, context);
      case 'adaptive_code_analysis':
        return this.executeCodeAnalysis(input, context);
      case 'adaptive_data_processing':
        return this.executeDataProcessing(input, context);
      case 'adaptive_web_interaction':
        return this.executeWebInteraction(input, context);
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  private async learnFromExecution(
    toolName: string,
    modelName: string,
    input: any,
    output: any
  ): Promise<void> {
    const key = `${toolName}:${modelName}`;
    const history = this.learningHistory.get(key) || { executions: [] };
    
    history.executions.push({
      timestamp: new Date(),
      input,
      output,
      success: true
    });

    // Keep only last 100 executions
    if (history.executions.length > 100) {
      history.executions = history.executions.slice(-100);
    }

    this.learningHistory.set(key, history);

    // Persist to Supabase
    await this.supabase
      .from('adaptive_tool_learning')
      .upsert({
        tool_name: toolName,
        model_name: modelName,
        learning_data: history,
        updated_at: new Date()
      });
  }

  // Conversion helpers
  private convertToNaturalLanguage(input: any): string {
    if (typeof input === 'string') return input;
    
    // Convert structured input to natural language
    const parts = [];
    for (const [key, value] of Object.entries(input)) {
      parts.push(`${key} ${value}`);
    }
    return parts.join(', ');
  }

  private convertToStringFormat(input: any): string {
    if (typeof input === 'string') return input;
    return JSON.stringify(input);
  }

  private convertToStructuredFormat(input: any, example: any): any {
    // Map input fields to example structure
    const result: { [key: string]: any } = {};
    for (const key of Object.keys(example)) {
      // Find matching field in input
      result[key] = this.findMatchingField(input, key);
    }
    return result;
  }

  private findMatchingField(input: any, targetKey: string): any {
    // Direct match
    if (input[targetKey] !== undefined) return input[targetKey];
    
    // Try common aliases
    const aliases = {
      'q': ['query', 'search'],
      'cmd': ['command', 'operation'],
      'max': ['limit', 'max_results'],
      'fmt': ['format', 'output_format']
    };
    
    for (const [alias, candidates] of Object.entries(aliases)) {
      if (alias === targetKey) {
        for (const candidate of candidates) {
          if (input[candidate] !== undefined) return input[candidate];
        }
      }
    }
    
    return null;
  }

  private convertToMarkdown(output: any): string {
    if (typeof output === 'string') return output;
    
    let markdown = '';
    
    if (Array.isArray(output)) {
      output.forEach((item, index) => {
        markdown += `${index + 1}. ${this.objectToMarkdown(item)}\n`;
      });
    } else {
      markdown = this.objectToMarkdown(output);
    }
    
    return markdown;
  }

  private objectToMarkdown(obj: any): string {
    if (typeof obj !== 'object') return String(obj);
    
    let md = '';
    for (const [key, value] of Object.entries(obj)) {
      md += `**${key}**: ${value}\n`;
    }
    return md;
  }

  private convertToString(output: any): string {
    if (typeof output === 'string') return output;
    if (Array.isArray(output)) return output.join('\n');
    return JSON.stringify(output, null, 2);
  }

  private convertToStructured(output: any): any {
    // Already structured
    return output;
  }

  // Placeholder implementations for tool logic
  private async executeFileOperation(input: any, context?: any): Promise<any> {
    // Would integrate with FileManagerAgent
    return { success: true, operation: input.operation, path: input.path };
  }

  private async executeSearch(input: any, context?: any): Promise<any> {
    // Would integrate with search functionality
    return { results: [], query: input.query };
  }

  private async executeCodeAnalysis(input: any, context?: any): Promise<any> {
    // Would integrate with CodeAssistantAgent
    return { analysis: 'Code analysis results', suggestions: [] };
  }

  private async executeDataProcessing(input: any, context?: any): Promise<any> {
    // Would process data based on operation
    return { processed: true, data: input.data };
  }

  private async executeWebInteraction(input: any, context?: any): Promise<any> {
    // Would integrate with WebScraperAgent
    return { content: 'Web content', url: input.url };
  }
}