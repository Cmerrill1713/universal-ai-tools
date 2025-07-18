/**
 * Pydantic Tools Integration
 * Provides structured data tools for AI agents with comprehensive validation
 */

import type { Logger } from 'winston';
import { PydanticValidationService } from '../services/pydantic_validation_service.js';
import type { 
  MemoryModel, 
  SearchResponse} from '../models/pydantic_models.js';
import { 
  ConceptAnalysis, 
  ContextualEnrichment,
  EmbeddingConfig,
  EmbeddingProvider,
  EntityExtraction,
  MemoryType,
  SearchOptions,
  SearchResult,
  SearchStrategy,
  SystemHealth,
  UserFeedback
} from '../models/pydantic_models.js';
import type { EnhancedMemorySystem } from '../memory/enhanced_memory_system.js';

export interface ToolResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  warnings?: string[];
  metadata?: {
    executionTime: number;
    validationTime: number;
    model: string;
  };
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: object;
  required: string[];
  examples?: object[];
}

export class PydanticTools {
  private validationService: PydanticValidationService;
  private memorySystem: EnhancedMemorySystem;
  private logger: Logger;

  constructor(
    memorySystem: EnhancedMemorySystem,
    logger: Logger,
    options: { strictValidation?: boolean } = {}
  ) {
    this.memorySystem = memorySystem;
    this.logger = logger;
    this.validationService = new PydanticValidationService(logger, {
      strictMode: options.strictValidation ?? true
    });
  }

  // ============================================
  // MEMORY MANAGEMENT TOOLS
  // ============================================

  /**
   * Tool: Store Memory with Validation
   */
  async storeMemory(params: {
    content: string;
    serviceId: string;
    memoryType: string;
    metadata?: object;
    importance?: number;
  }): Promise<ToolResult<MemoryModel>> {
    const startTime = Date.now();
    
    try {
      // Validate and transform input
      const memoryData = {
        content: params.content,
        serviceId: params.serviceId,
        memoryType: params.memoryType as MemoryType,
        importanceScore: params.importance ?? 0.5,
        metadata: params.metadata
      };

      const validationResult = await this.validationService.validateMemory(memoryData);
      
      if (!validationResult.isValid) {
        return {
          success: false,
          error: `Validation failed: ${validationResult.errors?.join(', ')}`,
          metadata: {
            executionTime: Date.now() - startTime,
            validationTime: Date.now() - startTime,
            model: 'MemoryModel'
          }
        };
      }

      // Store the memory
      const storedMemory = await this.memorySystem.storeMemory(
        params.serviceId,
        params.memoryType,
        params.content,
        params.metadata
      );

      this.logger.info('Memory stored successfully', {
        memoryId: storedMemory.id,
        serviceId: params.serviceId,
        type: params.memoryType
      });

      return {
        success: true,
        data: validationResult.data!,
        warnings: validationResult.warnings,
        metadata: {
          executionTime: Date.now() - startTime,
          validationTime: Date.now() - startTime,
          model: 'MemoryModel'
        }
      };

    } catch (error) {
      this.logger.error('Failed to store memory', { error: error instanceof Error ? error.message : 'Unknown error' });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        metadata: {
          executionTime: Date.now() - startTime,
          validationTime: 0,
          model: 'MemoryModel'
        }
      };
    }
  }

  /**
   * Tool: Search Memories with Structured Options
   */
  async searchMemories(params: {
    query: string;
    maxResults?: number;
    similarityThreshold?: number;
    agentFilter?: string;
    categoryFilter?: string;
    searchStrategy?: string;
    enableEnrichment?: boolean;
    contextualFactors?: object;
  }): Promise<ToolResult<SearchResponse>> {
    const startTime = Date.now();
    
    try {
      // Validate search options
      const searchData = {
        query: params.query,
        maxResults: params.maxResults ?? 20,
        similarityThreshold: params.similarityThreshold ?? 0.7,
        agentFilter: params.agentFilter,
        categoryFilter: params.categoryFilter,
        searchStrategy: params.searchStrategy as SearchStrategy ?? SearchStrategy.BALANCED,
        enableContextualEnrichment: params.enableEnrichment ?? true,
        contextualFactors: params.contextualFactors
      };

      const validationResult = await this.validationService.validateSearchOptions(searchData);
      
      if (!validationResult.isValid) {
        return {
          success: false,
          error: `Search validation failed: ${validationResult.errors?.join(', ')}`,
          metadata: {
            executionTime: Date.now() - startTime,
            validationTime: Date.now() - startTime,
            model: 'SearchOptions'
          }
        };
      }

      // Perform the search
      const searchResults = await this.memorySystem.searchMemories({
        query: params.query,
        maxResults: params.maxResults,
        similarityThreshold: params.similarityThreshold,
        agentFilter: params.agentFilter,
        category: params.categoryFilter
      });

      const response: SearchResponse = {
        results: searchResults.map(result => ({
          memory: result as any, // Type assertion for compatibility
          similarity: (result as any).similarity || 0,
          utilityScore: (result as any).utilityScore,
          searchMethod: 'standard',
          get compositeScore() {
            return this.utilityScore ? 
              (this.similarity * 0.7) + (this.utilityScore * 0.3) : 
              this.similarity;
          }
        })),
        metrics: {
          totalSearchTime: Date.now() - startTime,
          memoriesEvaluated: searchResults.length
        }
      };

      this.logger.info('Memory search completed', {
        query: params.query,
        resultsCount: searchResults.length,
        executionTime: Date.now() - startTime
      });

      return {
        success: true,
        data: response,
        warnings: validationResult.warnings,
        metadata: {
          executionTime: Date.now() - startTime,
          validationTime: Date.now() - startTime,
          model: 'SearchResponse'
        }
      };

    } catch (error) {
      this.logger.error('Memory search failed', { error: error instanceof Error ? error.message : 'Unknown error' });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Search failed',
        metadata: {
          executionTime: Date.now() - startTime,
          validationTime: 0,
          model: 'SearchResponse'
        }
      };
    }
  }

  /**
   * Tool: Intelligent Search with All Features
   */
  async intelligentSearch(params: {
    query: string;
    agentName: string;
    contextualFactors?: {
      urgency?: string;
      sessionContext?: string;
      userPreferences?: object;
    };
    maxResults?: number;
  }): Promise<ToolResult<SearchResponse>> {
    const startTime = Date.now();
    
    try {
      // Perform intelligent search with all features
      const result = await this.memorySystem.intelligentSearch(
        params.query,
        params.agentName,
        {
          maxResults: params.maxResults,
          urgency: params.contextualFactors?.urgency as 'low' | 'medium' | 'high' | 'critical',
          sessionContext: params.contextualFactors?.sessionContext
        }
      );

      this.logger.info('Intelligent search completed', {
        query: params.query,
        agentName: params.agentName,
        resultsCount: result.results.length
      });

      const searchResponse: SearchResponse = {
        results: result.results.map(memory => ({
          memory: memory as any,
          similarity: (memory as any).similarity || 0,
          utilityScore: (memory as any).utilityScore,
          searchMethod: result.searchStrategy || 'intelligent',
          get compositeScore() {
            return this.utilityScore ? 
              (this.similarity * 0.7) + (this.utilityScore * 0.3) : 
              this.similarity;
          }
        })),
        metrics: result.metrics || {
          totalSearchTime: Date.now() - startTime,
          memoriesEvaluated: result.results.length
        },
        queryEnrichment: result.queryEnrichment,
        searchStrategy: result.searchStrategy,
        utilityRankingApplied: result.utilityRankingApplied
      };

      return {
        success: true,
        data: searchResponse,
        metadata: {
          executionTime: Date.now() - startTime,
          validationTime: 0,
          model: 'SearchResponse'
        }
      };

    } catch (error) {
      this.logger.error('Intelligent search failed', { error: error instanceof Error ? error.message : 'Unknown error' });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Intelligent search failed',
        metadata: {
          executionTime: Date.now() - startTime,
          validationTime: 0,
          model: 'SearchResponse'
        }
      };
    }
  }

  /**
   * Tool: Record User Feedback
   */
  async recordFeedback(params: {
    memoryId: string;
    agentName: string;
    relevance?: number;
    helpfulness?: number;
    accuracy?: number;
    tags?: string[];
    comments?: string;
  }): Promise<ToolResult<UserFeedback>> {
    const startTime = Date.now();
    
    try {
      // Validate feedback data
      const feedbackData = {
        memoryId: params.memoryId,
        agentName: params.agentName,
        relevance: params.relevance,
        helpfulness: params.helpfulness,
        accuracy: params.accuracy,
        tags: params.tags,
        comments: params.comments,
        timestamp: new Date()
      };

      const validationResult = await this.validationService.validateObject(UserFeedback, feedbackData);
      
      if (!validationResult.isValid) {
        return {
          success: false,
          error: `Feedback validation failed: ${validationResult.errors?.join(', ')}`,
          metadata: {
            executionTime: Date.now() - startTime,
            validationTime: Date.now() - startTime,
            model: 'UserFeedback'
          }
        };
      }

      // Record the feedback
      await this.memorySystem.recordUserFeedback(
        params.memoryId,
        params.agentName,
        {
          relevance: params.relevance ?? 3,
          helpfulness: params.helpfulness ?? 3,
          accuracy: params.accuracy ?? 3
        },
        params.tags
      );

      this.logger.info('User feedback recorded', {
        memoryId: params.memoryId,
        agentName: params.agentName
      });

      return {
        success: true,
        data: validationResult.data!,
        metadata: {
          executionTime: Date.now() - startTime,
          validationTime: Date.now() - startTime,
          model: 'UserFeedback'
        }
      };

    } catch (error) {
      this.logger.error('Failed to record feedback', { error: error instanceof Error ? error.message : 'Unknown error' });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to record feedback',
        metadata: {
          executionTime: Date.now() - startTime,
          validationTime: 0,
          model: 'UserFeedback'
        }
      };
    }
  }

  // ============================================
  // SYSTEM MONITORING TOOLS
  // ============================================

  /**
   * Tool: Get System Health
   */
  async getSystemHealth(): Promise<ToolResult<SystemHealth>> {
    const startTime = Date.now();
    
    try {
      // Check embedding service health
      const embeddingHealth = await this.memorySystem.checkEmbeddingServiceHealth();
      
      // Get system statistics
      const stats = await this.memorySystem.getSystemStatistics();
      
      const healthData = {
        healthy: embeddingHealth.available && stats.memory.totalMemories >= 0,
        service: 'Universal AI Tools Memory System',
        version: '1.0.0',
        details: {
          database: true,
          embeddings: embeddingHealth.available,
          cache: stats.cache.memory.overall.overallHitRate >= 0,
          totalMemories: stats.memory.totalMemories,
          embeddingService: embeddingHealth.service
        },
        warnings: embeddingHealth.available ? [] : ['Embedding service unavailable'],
        timestamp: new Date()
      };

      const validationResult = await this.validationService.validateObject(SystemHealth, healthData);
      
      return {
        success: true,
        data: validationResult.data || healthData as SystemHealth,
        metadata: {
          executionTime: Date.now() - startTime,
          validationTime: Date.now() - startTime,
          model: 'SystemHealth'
        }
      };

    } catch (error) {
      this.logger.error('Failed to get system health', { error: error instanceof Error ? error.message : 'Unknown error' });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get system health',
        metadata: {
          executionTime: Date.now() - startTime,
          validationTime: 0,
          model: 'SystemHealth'
        }
      };
    }
  }

  /**
   * Tool: Get Learning Insights
   */
  async getLearningInsights(params: {
    agentName: string;
  }): Promise<ToolResult<object>> {
    const startTime = Date.now();
    
    try {
      const insights = await this.memorySystem.getLearningInsights(params.agentName);
      
      this.logger.info('Learning insights retrieved', {
        agentName: params.agentName,
        preferredTypes: insights.userPreferences.preferredMemoryTypes.length,
        timePatterns: insights.userPreferences.timeOfDayPatterns.length
      });

      return {
        success: true,
        data: insights,
        metadata: {
          executionTime: Date.now() - startTime,
          validationTime: 0,
          model: 'LearningInsights'
        }
      };

    } catch (error) {
      this.logger.error('Failed to get learning insights', { error: error instanceof Error ? error.message : 'Unknown error' });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get learning insights',
        metadata: {
          executionTime: Date.now() - startTime,
          validationTime: 0,
          model: 'LearningInsights'
        }
      };
    }
  }

  // ============================================
  // DATA VALIDATION AND TRANSFORMATION TOOLS
  // ============================================

  /**
   * Tool: Validate and Transform Data
   */
  async validateData(params: {
    data: any;
    modelType: string;
    strictMode?: boolean;
  }): Promise<ToolResult<any>> {
    const startTime = Date.now();
    
    try {
      let validationResult;
      
      switch (params.modelType.toLowerCase()) {
        case 'memory':
          validationResult = await this.validationService.validateMemory(params.data);
          break;
        case 'searchoptions':
          validationResult = await this.validationService.validateSearchOptions(params.data);
          break;
        case 'embeddingconfig':
          validationResult = await this.validationService.validateEmbeddingConfig(params.data);
          break;
        default:
          return {
            success: false,
            error: `Unknown model type: ${params.modelType}`,
            metadata: {
              executionTime: Date.now() - startTime,
              validationTime: 0,
              model: params.modelType
            }
          };
      }

      return {
        success: validationResult.isValid,
        data: validationResult.data,
        error: validationResult.isValid ? undefined : validationResult.errors?.join(', '),
        warnings: validationResult.warnings,
        metadata: {
          executionTime: Date.now() - startTime,
          validationTime: Date.now() - startTime,
          model: params.modelType
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Validation failed',
        metadata: {
          executionTime: Date.now() - startTime,
          validationTime: 0,
          model: params.modelType
        }
      };
    }
  }

  /**
   * Tool: Serialize Data to JSON
   */
  serializeData(params: {
    data: any;
    excludeFields?: string[];
    prettify?: boolean;
  }): ToolResult<string> {
    const startTime = Date.now();
    
    try {
      const serialized = this.validationService.serialize(params.data, {
        excludeFields: params.excludeFields,
        prettify: params.prettify ?? false
      });

      return {
        success: true,
        data: serialized,
        metadata: {
          executionTime: Date.now() - startTime,
          validationTime: 0,
          model: 'Serialization'
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Serialization failed',
        metadata: {
          executionTime: Date.now() - startTime,
          validationTime: 0,
          model: 'Serialization'
        }
      };
    }
  }

  // ============================================
  // TOOL DEFINITIONS FOR AI AGENTS
  // ============================================

  /**
   * Get all available tool definitions for AI agents
   */
  getToolDefinitions(): ToolDefinition[] {
    return [
      {
        name: 'store_memory',
        description: 'Store a memory with comprehensive validation and structured data',
        parameters: {
          type: 'object',
          properties: {
            content: { type: 'string', description: 'Memory content' },
            serviceId: { type: 'string', description: 'Service or agent identifier' },
            memoryType: { 
              type: 'string', 
              enum: Object.values(MemoryType),
              description: 'Type of memory being stored' 
            },
            metadata: { type: 'object', description: 'Additional metadata' },
            importance: { type: 'number', minimum: 0, maximum: 1, description: 'Importance score' }
          },
          required: ['content', 'serviceId', 'memoryType']
        },
        required: ['content', 'serviceId', 'memoryType'],
        examples: [
          {
            content: 'User requested help with Python debugging',
            serviceId: 'assistant',
            memoryType: 'user_interaction',
            importance: 0.8
          }
        ]
      },
      {
        name: 'search_memories',
        description: 'Search memories with structured options and validation',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            maxResults: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            similarityThreshold: { type: 'number', minimum: 0, maximum: 1, default: 0.7 },
            agentFilter: { type: 'string', description: 'Filter by agent/service' },
            categoryFilter: { type: 'string', description: 'Filter by category' },
            searchStrategy: { 
              type: 'string', 
              enum: Object.values(SearchStrategy),
              description: 'Search strategy to use' 
            }
          },
          required: ['query']
        },
        required: ['query'],
        examples: [
          {
            query: 'Python debugging help',
            maxResults: 10,
            agentFilter: 'assistant',
            searchStrategy: 'balanced'
          }
        ]
      },
      {
        name: 'intelligent_search',
        description: 'Perform intelligent search with all advanced features enabled',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            agentName: { type: 'string', description: 'Agent performing the search' },
            contextualFactors: {
              type: 'object',
              properties: {
                urgency: { type: 'string', description: 'Urgency level' },
                sessionContext: { type: 'string', description: 'Current session context' }
              }
            },
            maxResults: { type: 'integer', minimum: 1, maximum: 50, default: 20 }
          },
          required: ['query', 'agentName']
        },
        required: ['query', 'agentName']
      },
      {
        name: 'record_feedback',
        description: 'Record user feedback on memory relevance and quality',
        parameters: {
          type: 'object',
          properties: {
            memoryId: { type: 'string', format: 'uuid', description: 'Memory identifier' },
            agentName: { type: 'string', description: 'Agent name' },
            relevance: { type: 'integer', minimum: 1, maximum: 5, description: 'Relevance score' },
            helpfulness: { type: 'integer', minimum: 1, maximum: 5, description: 'Helpfulness score' },
            accuracy: { type: 'integer', minimum: 1, maximum: 5, description: 'Accuracy score' },
            tags: { type: 'array', items: { type: 'string' }, description: 'Feedback tags' },
            comments: { type: 'string', description: 'Additional comments' }
          },
          required: ['memoryId', 'agentName']
        },
        required: ['memoryId', 'agentName']
      },
      {
        name: 'get_system_health',
        description: 'Get comprehensive system health status and metrics',
        parameters: {
          type: 'object',
          properties: {}
        },
        required: []
      },
      {
        name: 'validate_data',
        description: 'Validate data against Pydantic-style models',
        parameters: {
          type: 'object',
          properties: {
            data: { type: 'object', description: 'Data to validate' },
            modelType: { 
              type: 'string', 
              enum: ['memory', 'searchoptions', 'embeddingconfig'],
              description: 'Type of model to validate against' 
            },
            strictMode: { type: 'boolean', default: true, description: 'Enable strict validation' }
          },
          required: ['data', 'modelType']
        },
        required: ['data', 'modelType']
      }
    ];
  }

  /**
   * Execute tool by name with parameters
   */
  async executeTool(toolName: string, params: any): Promise<ToolResult> {
    this.logger.info('Executing Pydantic tool', { toolName, params });
    
    switch (toolName) {
      case 'store_memory':
        return await this.storeMemory(params);
      case 'search_memories':
        return await this.searchMemories(params);
      case 'intelligent_search':
        return await this.intelligentSearch(params);
      case 'record_feedback':
        return await this.recordFeedback(params);
      case 'get_system_health':
        return await this.getSystemHealth();
      case 'get_learning_insights':
        return await this.getLearningInsights(params);
      case 'validate_data':
        return await this.validateData(params);
      case 'serialize_data':
        return this.serializeData(params);
      default:
        return {
          success: false,
          error: `Unknown tool: ${toolName}`,
          metadata: {
            executionTime: 0,
            validationTime: 0,
            model: 'Unknown'
          }
        };
    }
  }
}