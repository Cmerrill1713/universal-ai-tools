/**
 * Pydantic-style Models for Universal AI Tools Memory System
 * Provides structured data validation, serialization, and type safety
 */

import { z } from 'zod';

// ============================================
// ENUMS AND CONSTANTS
// ============================================

export enum MemoryType {
  USER_INTERACTION = 'user_interaction',
  TECHNICAL_NOTE = 'technical_note',
  PROJECT_UPDATE = 'project_update',
  ANALYSIS_RESULT = 'analysis_result',
  SYSTEM_EVENT = 'system_event',
  LEARNING_INSIGHT = 'learning_insight',
  ERROR_LOG = 'error_log',
  PERFORMANCE_METRIC = 'performance_metric',
}

export enum SearchStrategy {
  BALANCED = 'balanced',
  PRECISION = 'precision',
  RECALL = 'recall',
  SPEED = 'speed',
  PRIORITY = 'priority',
}

export enum ImportanceLevel {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  MINIMAL = 'minimal',
}

export enum EmbeddingProvider {
  OPENAI = 'openai',
  OLLAMA = 'ollama',
  MOCK = 'mock',
}

// ============================================
// BASE MODELS
// ============================================

export class BaseModel {
  id?: string;
  createdAt?: Date;
  updatedAt?: Date;

  /**
   * Convert to plain object for JSON serialization
   */
  toDict(): Record<string, unknown> {
    const obj: Record<string, unknown> = {};
    Object.keys(this).forEach((key) => {
      const value = (this as: any)[key];
      if (value !== undefined) {
        obj[key] = value;
      }
    });
    return obj;
  }

  /**
   * Create from plain object with validation
   */
  static fromDict<T extends BaseModel>(this: new () => T, data: Record<string, unknown>): T {
    const instance = new this();
    Object.assign(instance, data);
    return instance;
  }
}

// ============================================
// MEMORY MODELS
// ============================================

export class MemoryMetadata {
  priority?: string;
  category?: string;
  tags?: string[];
  source?: string;
  confidence?: number;
  additionalData?: Record<string, unknown>;
  test?: boolean;
}

export class EntityExtraction {
  text: string;
  type: string;
  confidence: number;
  startIndex?: number;
  endIndex?: number;
  metadata?: Record<string, unknown>;

  constructor(text?: string, type?: string, confidence?: number) {
    this.text = text || '';
    this.type = type || '';
    this.confidence = confidence || 0;
  }
}

export class ConceptAnalysis {
  concept: string;
  relevance: number;
  relatedConcepts?: string[];
  category?: string;

  constructor(concept?: string, relevance?: number) {
    this.concept = concept || '';
    this.relevance = relevance || 0;
  }
}

export class ContextualEnrichment {
  entities: EntityExtraction[];
  concepts: ConceptAnalysis[];
  intent?: string;
  sentiment?: string;
  urgency?: string;
  temporalContext?: {
    timeReferences?: string[];
    timeframe?: string;
    deadline?: Date;
  };
  spatialContext?: {
    locations?: string[];
    geography?: string;
  };

  constructor() {
    this.entities = [];
    this.concepts = [];
  }
}

export class MemoryModel extends BaseModel {
  content string;
  serviceId: string;
  memoryType: MemoryType;
  memoryCategory?: string;
  importanceScore: number;
  embedding?: number[];
  keywords?: string[];
  relatedEntities?: Record<string, unknown>;
  metadata?: MemoryMetadata;
  enrichment?: ContextualEnrichment;
  accessCount?: number;
  lastAccessed?: Date;

  constructor(
    content: string,
    serviceId?: string,
    memoryType?: MemoryType,
    importanceScore?: number
  ) {
    super();
    this.content= content|| '';
    this.serviceId = serviceId || '';
    this.memoryType = memoryType || MemoryType.USER_INTERACTION;
    this.importanceScore = importanceScore || 0.5;
  }

  /**
   * Get importance level based on score
   */
  get importanceLevel(): ImportanceLevel {
    if (this.importanceScore >= 0.9) return ImportanceLevel.CRITICAL;
    if (this.importanceScore >= 0.7) return ImportanceLevel.HIGH;
    if (this.importanceScore >= 0.5) return ImportanceLevel.MEDIUM;
    if (this.importanceScore >= 0.3) return ImportanceLevel.LOW;
    return ImportanceLevel.MINIMAL;
  }

  /**
   * Check if memory contains specific entities
   */
  hasEntity(entityType: string): boolean {
    return this.enrichment?.entities.some((e) => e.type === entityType) ?? false;
  }

  /**
   * Get entities of specific type
   */
  getEntitiesByType(entityType: string): EntityExtraction[] {
    return this.enrichment?.entities.filter((e) => e.type === entityType) ?? [];
  }
}

// ============================================
// SEARCH MODELS
// ============================================

export class SearchOptions {
  query: string;
  similarityThreshold?: number = 0.7;
  maxResults?: number = 20;
  agentFilter?: string;
  categoryFilter?: string;
  excludeIds?: string[];
  searchStrategy?: SearchStrategy = SearchStrategy.BALANCED;
  enableContextualEnrichment?: boolean = true;
  enableMultiStage?: boolean = true;
  enableUtilityRanking?: boolean = true;
  contextualFactors?: {
    urgency?: string;
    sessionContext?: string;
    userPreferences?: Record<string, unknown>;
  };

  constructor(query?: string) {
    this.query = query || '';
  }
}

export class SearchResult {
  memory: MemoryModel;
  similarity: number;
  utilityScore?: number;
  contextualRelevance?: number;
  searchMethod?: string;
  rankingFactors?: {
    recency: number;
    frequency: number;
    importance: number;
    similarity: number;
  };

  constructor(memory?: MemoryModel, similarity?: number) {
    this.memory = memory || new MemoryModel();
    this.similarity = similarity || 0;
  }

  /**
   * Get composite score combining similarity and utility
   */
  get compositeScore(): number {
    if (this.utilityScore !== undefined) {
      return this.similarity * 0.7 + this.utilityScore * 0.3;
    }
    return this.similarity;
  }
}

export class SearchMetrics {
  totalSearchTime: number;
  clusterSearchTime?: number;
  detailSearchTime?: number;
  clustersEvaluated?: number;
  memoriesEvaluated?: number;
  cacheHit?: boolean;
  searchStrategy?: string;

  constructor(totalSearchTime?: number) {
    this.totalSearchTime = totalSearchTime || 0;
  }
}

export class SearchResponse {
  results: SearchResult[];
  metrics: SearchMetrics;
  queryEnrichment?: ContextualEnrichment;
  searchStrategy?: string;
  utilityRankingApplied?: boolean;

  constructor(results?: SearchResult[], metrics?: SearchMetrics) {
    this.results = results || [];
    this.metrics = metrics || new SearchMetrics();
  }
}

// ============================================
// EMBEDDING MODELS
// ============================================

export class EmbeddingConfig {
  provider: EmbeddingProvider;
  model?: string;
  dimensions?: number;
  baseUrl?: string;
  apiKey?: string;
  maxBatchSize?: number;
  timeout?: number;

  constructor(provider?: EmbeddingProvider) {
    this.provider = provider || EmbeddingProvider.MOCK;
  }
}

export class EmbeddingResponse {
  embedding: number[];
  dimensions: number;
  model: string;
  processingTime?: number;
  fromCache?: boolean;

  constructor(embedding?: number[], dimensions?: number, model?: string) {
    this.embedding = embedding || [];
    this.dimensions = dimensions || 0;
    this.model = model || '';
  }
}

// ============================================
// SYSTEM MODELS
// ============================================

export class SystemHealth {
  healthy: boolean;
  service: string;
  version?: string;
  details?: {
    database?: boolean;
    embeddings?: boolean;
    cache?: boolean;
    [key: string]: any;
  };
  warnings?: string[];
  errors?: string[];
  timestamp: Date;

  constructor(healthy?: boolean, service?: string) {
    this.healthy = healthy || false;
    this.service = service || '';
    this.timestamp = new Date();
  }
}

export class PerformanceMetrics {
  totalMemories: number;
  memoriesWithEmbeddings: number;
  averageSearchTime?: number;
  cacheHitRate?: number;
  totalClusters?: number;
  resourceUsage?: {
    memoryMB?: number;
    cpuPercent?: number;
    diskMB?: number;
  };

  constructor(totalMemories?: number, memoriesWithEmbeddings?: number) {
    this.totalMemories = totalMemories || 0;
    this.memoriesWithEmbeddings = memoriesWithEmbeddings || 0;
  }
}

// ============================================
// USER FEEDBACK MODELS
// ============================================

export class UserFeedback {
  memoryId: string;
  agentName: string;
  relevance?: number;
  helpfulness?: number;
  accuracy?: number;
  tags?: string[];
  comments?: string;
  timestamp: Date;

  constructor(memoryId?: string, agentName?: string) {
    this.memoryId = memoryId || '';
    this.agentName = agentName || '';
    this.timestamp = new Date();
  }
}

// ============================================
// ZOD SCHEMAS (for runtime validation)
// ============================================

export const MemorySchema = z.object({
  id: z.string().uuid().optional(),
  content z.string().min(1).max(10000),
  serviceId: z.string().min(1),
  memoryType: z.nativeEnum(MemoryType),
  memoryCategory: z.string().optional(),
  importanceScore: z.number().min(0).max(1),
  embedding: z.array(z.number()).optional(),
  keywords: z.array(z.string()).optional(),
  relatedEntities: z.record(z.any()).optional(),
  metadata: z
    .object({
      priority: z.string().optional(),
      category: z.string().optional(),
      tags: z.array(z.string()).optional(),
      source: z.string().optional(),
      confidence: z.number().optional(),
      additionalData: z.record(z.any()).optional(),
      test: z.boolean().optional(),
    })
    .optional(),
  accessCount: z.number().min(0).optional(),
  lastAccessed: z.date().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export const SearchOptionsSchema = z.object({
  query: z.string().min(1),
  similarityThreshold: z.number().min(0).max(1).default(0.7),
  maxResults: z.number().min(1).max(100).default(20),
  agentFilter: z.string().optional(),
  categoryFilter: z.string().optional(),
  excludeIds: z.array(z.string().uuid()).optional(),
  searchStrategy: z.nativeEnum(SearchStrategy).default(SearchStrategy.BALANCED),
  enableContextualEnrichment: z.boolean().default(true),
  enableMultiStage: z.boolean().default(true),
  enableUtilityRanking: z.boolean().default(true),
  contextualFactors: z
    .object({
      urgency: z.string().optional(),
      sessionContext: z.string().optional(),
      userPreferences: z.record(z.any()).optional(),
    })
    .optional(),
});

export const EntityExtractionSchema = z.object({
  text: z.string().min(1),
  type: z.string().min(1),
  confidence: z.number().min(0).max(1),
  startIndex: z.number().optional(),
  endIndex: z.number().optional(),
  metadata: z.record(z.any()).optional(),
});

export const ConceptAnalysisSchema = z.object({
  concept: z.string().min(1),
  relevance: z.number().min(0).max(1),
  relatedConcepts: z.array(z.string()).optional(),
  category: z.string().optional(),
});

export const ContextualEnrichmentSchema = z.object({
  entities: z.array(EntityExtractionSchema),
  concepts: z.array(ConceptAnalysisSchema),
  intent: z.string().optional(),
  sentiment: z.string().optional(),
  urgency: z.string().optional(),
  temporalContext: z
    .object({
      timeReferences: z.array(z.string()).optional(),
      timeframe: z.string().optional(),
      deadline: z.date().optional(),
    })
    .optional(),
  spatialContext: z
    .object({
      locations: z.array(z.string()).optional(),
      geography: z.string().optional(),
    })
    .optional(),
});

export const SearchResultSchema = z.object({
  memory: MemorySchema,
  similarity: z.number().min(0).max(1),
  utilityScore: z.number().min(0).max(1).optional(),
  contextualRelevance: z.number().min(0).max(1).optional(),
  searchMethod: z.string().optional(),
  rankingFactors: z
    .object({
      recency: z.number(),
      frequency: z.number(),
      importance: z.number(),
      similarity: z.number(),
    })
    .optional(),
});

export const SearchMetricsSchema = z.object({
  totalSearchTime: z.number().min(0),
  clusterSearchTime: z.number().min(0).optional(),
  detailSearchTime: z.number().min(0).optional(),
  clustersEvaluated: z.number().min(0).optional(),
  memoriesEvaluated: z.number().min(0).optional(),
  cacheHit: z.boolean().optional(),
  searchStrategy: z.string().optional(),
});

export const SearchResponseSchema = z.object({
  results: z.array(SearchResultSchema),
  metrics: SearchMetricsSchema,
  queryEnrichment: ContextualEnrichmentSchema.optional(),
  searchStrategy: z.string().optional(),
  utilityRankingApplied: z.boolean().optional(),
});

export const EmbeddingConfigSchema = z.object({
  provider: z.nativeEnum(EmbeddingProvider),
  model: z.string().optional(),
  dimensions: z.number().min(1).max(4096).optional(),
  baseUrl: z.string().url().optional(),
  apiKey: z.string().optional(),
  maxBatchSize: z.number().min(1).max(100).optional(),
  timeout: z.number().min(0).optional(),
});

export const EmbeddingResponseSchema = z.object({
  embedding: z.array(z.number()),
  dimensions: z.number().min(1),
  model: z.string(),
  processingTime: z.number().min(0).optional(),
  fromCache: z.boolean().optional(),
});

export const SystemHealthSchema = z.object({
  healthy: z.boolean(),
  service: z.string().min(1),
  version: z.string().optional(),
  details: z
    .object({
      database: z.boolean().optional(),
      embeddings: z.boolean().optional(),
      cache: z.boolean().optional(),
    })
    .catchall(z.any())
    .optional(),
  warnings: z.array(z.string()).optional(),
  errors: z.array(z.string()).optional(),
  timestamp: z.date(),
});

export const PerformanceMetricsSchema = z.object({
  totalMemories: z.number().min(0),
  memoriesWithEmbeddings: z.number().min(0),
  averageSearchTime: z.number().min(0).optional(),
  cacheHitRate: z.number().min(0).max(1).optional(),
  totalClusters: z.number().min(0).optional(),
  resourceUsage: z
    .object({
      memoryMB: z.number().optional(),
      cpuPercent: z.number().optional(),
      diskMB: z.number().optional(),
    })
    .optional(),
});

export const UserFeedbackSchema = z.object({
  memoryId: z.string().uuid(),
  agentName: z.string().min(1),
  relevance: z.number().min(1).max(5).optional(),
  helpfulness: z.number().min(1).max(5).optional(),
  accuracy: z.number().min(1).max(5).optional(),
  tags: z.array(z.string()).optional(),
  comments: z.string().max(1000).optional(),
  timestamp: z.date(),
});

// ============================================
// TYPE EXPORTS
// ============================================

export type MemoryData = z.infer<typeof MemorySchema>;
export type SearchOptionsData = z.infer<typeof SearchOptionsSchema>;
export type EntityExtractionData = z.infer<typeof EntityExtractionSchema>;
export type ConceptAnalysisData = z.infer<typeof ConceptAnalysisSchema>;
export type ContextualEnrichmentData = z.infer<typeof ContextualEnrichmentSchema>;
export type SearchResultData = z.infer<typeof SearchResultSchema>;
export type SearchMetricsData = z.infer<typeof SearchMetricsSchema>;
export type SearchResponseData = z.infer<typeof SearchResponseSchema>;
export type EmbeddingConfigData = z.infer<typeof EmbeddingConfigSchema>;
export type EmbeddingResponseData = z.infer<typeof EmbeddingResponseSchema>;
export type SystemHealthData = z.infer<typeof SystemHealthSchema>;
export type PerformanceMetricsData = z.infer<typeof PerformanceMetricsSchema>;
export type UserFeedbackData = z.infer<typeof UserFeedbackSchema>;

/**
 * Utility functions for model validation and transformation
 */
export class ModelUtils {
  /**
   * Validate object against Zod schema
   */
  static validateWithZod<T>(
    schema: z.ZodSchema<T>,
    data: unknown
  ): { success: boolean; data?: T; error: string } {
    try {
      const result = schema.parse(data);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        _error error instanceof z.ZodError ? error.message : 'Validation failed',
      };
    }
  }

  /**
   * Create memory model with validation
   */
  static createMemory(data: Partial<MemoryData>): MemoryModel {
    const validation = this.validateWithZod(MemorySchema, data);
    if (!validation.success) {
      throw new Error(`Invalid memory data: ${validation._error`);
    }

    const memory = new MemoryModel(
      validation.data!.content
      validation.data!.serviceId,
      validation.data!.memoryType,
      validation.data!.importanceScore
    );

    Object.assign(memory, validation.data);
    return memory;
  }

  /**
   * Create search options with validation
   */
  static createSearchOptions(data: Partial<SearchOptionsData>): SearchOptions {
    const validation = this.validateWithZod(SearchOptionsSchema, data);
    if (!validation.success) {
      throw new Error(`Invalid search options: ${validation._error`);
    }

    const options = new SearchOptions(validation.data!.query);
    Object.assign(options, validation.data);
    return options;
  }

  /**
   * Create entity extraction with validation
   */
  static createEntityExtraction(data: Partial<EntityExtractionData>): EntityExtraction {
    const validation = this.validateWithZod(EntityExtractionSchema, data);
    if (!validation.success) {
      throw new Error(`Invalid entity extraction data: ${validation._error`);
    }

    const entity = new EntityExtraction(
      validation.data!.text,
      validation.data!.type,
      validation.data!.confidence
    );

    Object.assign(entity, validation.data);
    return entity;
  }

  /**
   * Create concept _analysiswith validation
   */
  static createConceptAnalysis(data: Partial<ConceptAnalysisData>): ConceptAnalysis {
    const validation = this.validateWithZod(ConceptAnalysisSchema, data);
    if (!validation.success) {
      throw new Error(`Invalid concept _analysisdata: ${validation._error`);
    }

    const concept = new ConceptAnalysis(validation.data!.concept, validation.data!.relevance);

    Object.assign(concept, validation.data);
    return concept;
  }

  /**
   * Create search result with validation
   */
  static createSearchResult(data: Partial<SearchResultData>): SearchResult {
    const validation = this.validateWithZod(SearchResultSchema, data);
    if (!validation.success) {
      throw new Error(`Invalid search result data: ${validation._error`);
    }

    const memoryData = validation.data!.memory;
    const memory = this.createMemory(memoryData);

    const result = new SearchResult(memory, validation.data!.similarity);
    Object.assign(result, validation.data);
    return result;
  }

  /**
   * Create embedding config with validation
   */
  static createEmbeddingConfig(data: Partial<EmbeddingConfigData>): EmbeddingConfig {
    const validation = this.validateWithZod(EmbeddingConfigSchema, data);
    if (!validation.success) {
      throw new Error(`Invalid embedding config data: ${validation._error`);
    }

    const config = new EmbeddingConfig(validation.data!.provider);
    Object.assign(config, validation.data);
    return config;
  }

  /**
   * Create system health with validation
   */
  static createSystemHealth(data: Partial<SystemHealthData>): SystemHealth {
    const validation = this.validateWithZod(SystemHealthSchema, data);
    if (!validation.success) {
      throw new Error(`Invalid system health data: ${validation._error`);
    }

    const health = new SystemHealth(validation.data!.healthy, validation.data!.service);
    Object.assign(health, validation.data);
    return health;
  }

  /**
   * Create user feedback with validation
   */
  static createUserFeedback(data: Partial<UserFeedbackData>): UserFeedback {
    const validation = this.validateWithZod(UserFeedbackSchema, data);
    if (!validation.success) {
      throw new Error(`Invalid user feedback data: ${validation._error`);
    }

    const feedback = new UserFeedback(validation.data!.memoryId, validation.data!.agentName);
    Object.assign(feedback, validation.data);
    return feedback;
  }
}
