import { createClient } from '@supabase/supabase-js';
import { logger } from '../../utils/logger';
import { dspyService } from '../../services/dspy-service';
import { EventEmitter } from 'events';

// Simplified Knowledge Types
export type KnowledgeType =
  | 'solution'
  | '_pattern
  | '_error
  | 'performance'
  | 'context'
  | 'evolution'
  | 'coordination'
  | 'best_practice';

export interface KnowledgeItem {
  id: string;
  type: KnowledgeType;
  title: string;
  description: string;
  content any;
  tags: string[];
  confidence: number;
  relevance: number;
  created_at: string;
  updated_at: string;
  usage_count?: number;
  metadata?: Record<string, unknown>;
}

export interface KnowledgeQuery {
  type?: KnowledgeType[];
  tags?: string[];
  content_search?: string;
  min_confidence?: number;
  limit?: number;
}

export interface KnowledgeManagerConfig {
  supabaseUrl?: string;
  supabaseKey?: string;
  enableDSPyOptimization?: boolean;
  enableMIPROv2?: boolean;
  optimizationThreshold?: number;
}

/**
 * Lightweight DSPy-based Knowledge Manager
 * Leverages DSPy for intelligent knowledge extraction, search, and evolution
 */
export class DSPyKnowledgeManager extends EventEmitter {
  private supabase = createClient(
    process.env.SUPABASE_URL || 'http://localhost:54321',
    process.env.SUPABASE_SERVICE_KEY || ''
  );

  private config: Required<KnowledgeManagerConfig>;
  private cache = new Map<string, KnowledgeItem>();
  private operationCount = 0;
  private performanceMetrics = {
    extractions: { total: 0, successful: 0, avgConfidence: 0 },
    searches: { total: 0, successful: 0, avgConfidence: 0 },
    evolutions: { total: 0, successful: 0, avgConfidence: 0 },
    validations: { total: 0, successful: 0, avgScore: 0 },
  };

  constructor(config: Partial<KnowledgeManagerConfig> = {}) {
    super();

    this.config = {
      supabaseUrl: config.supabaseUrl || process.env.SUPABASE_URL || 'http://localhost:54321',
      supabaseKey: config.supabaseKey || process.env.SUPABASE_SERVICE_KEY || '',
      enableDSPyOptimization: config.enableDSPyOptimization ?? true,
      enableMIPROv2: config.enableMIPROv2 ?? true,
      optimizationThreshold: config.optimizationThreshold ?? 100,
    };

    if (config.supabaseUrl || config.supabaseKey) {
      this.supabase = createClient(this.config.supabaseUrl, this.config.supabaseKey);
    }

    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await this.ensureKnowledgeTable();
      logger.info('🧠 DSPy Knowledge Manager initialized');
    } catch (error) {
      logger.error('Failed to initialize knowledge manager:', error);
    }
  }

  private async ensureKnowledgeTable(): Promise<void> {
    // Simple check if table exists by attempting a query
    const { _error} = await this.supabase.from('knowledge_base').select('id').limit(1);

    if (_error.code === '42P01') {
      logger.warn('Knowledge base table does not exist. Please create it manually.');
    }
  }

  /**
   * Store knowledge with DSPy extraction and optimization
   */
  async storeKnowledge(knowledge: Partial<KnowledgeItem>): Promise<string> {
    try {
      const id =
        knowledge.id || `knowledge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Use DSPy with MIPROv2 optimization to extract and enrich knowledge
      let enrichedContent = knowledge.content
      let extractionConfidence = 0.8;

      if (this.config.enableDSPyOptimization && knowledge.content {
        const operation = this.config.enableMIPROv2 ? 'manage_knowledge' : 'extractKnowledge';
        const params = this.config.enableMIPROv2
          ? {
              operation: 'extract',
              data: {
                content JSON.stringify(knowledge.content,
                context: { type: knowledge.type, title: knowledge.title },
              },
            }
          : {
              content JSON.stringify(knowledge.content,
              context: { type: knowledge.type, title: knowledge.title },
            };

        const extracted = await dspyService.requestoperation, params);

        if (extracted.success) {
          if (this.config.enableMIPROv2) {
            enrichedContent = extracted.result.structured_knowledge;
            extractionConfidence = extracted.result.confidence || 0.8;
            this._updatePerformanceMetrics('extractions', extracted.result.confidence || 0.8);
          } else {
            enrichedContent = extracted.result;
          }
        }
      }

      const knowledgeItem: KnowledgeItem = {
        id,
        type: knowledge.type || 'solution',
        title: knowledge.title || 'Untitled',
        description: knowledge.description || '',
        content enrichedContent,
        tags: knowledge.tags || [],
        confidence: knowledge.confidence || extractionConfidence,
        relevance: knowledge.relevance || 0.7,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        usage_count: 0,
        metadata: knowledge.metadata || {},
      };

      const { _error} = await this.supabase.from('knowledge_base').insert([knowledgeItem]);

      if (_error {
        logger.error('Failed to store knowledge:', error);
        throw error;
      }

      this.cache.set(id, knowledgeItem);
      logger.info(`📚 Knowledge stored: ${id} (${knowledgeItem.type})`);
      this.emit('knowledge_stored', { id, type: knowledgeItem.type });

      return id;
    } catch (error) {
      logger.error('Failed to store knowledge:', error);
      throw error;
    }
  }

  /**
   * Retrieve knowledge by ID
   */
  async getKnowledge(id: string): Promise<KnowledgeItem | null> {
    try {
      if (this.cache.has(id)) {
        const item = this.cache.get(id)!;
        await this.updateUsageCount(id);
        return item;
      }

      const { data, error} = await this.supabase
        .from('knowledge_base')
        .select('*')
        .eq('id', id)
        .single();

      if (_error {
        if (_errorcode === 'PGRST116') return null;
        throw error;
      }

      const knowledge = data as KnowledgeItem;
      this.cache.set(id, knowledge);
      await this.updateUsageCount(id);

      return knowledge;
    } catch (error) {
      logger.error('Failed to retrieve knowledge:', error);
      throw error;
    }
  }

  /**
   * Search knowledge using DSPy-optimized search
   */
  async searchKnowledge(query: KnowledgeQuery): Promise<KnowledgeItem[]> {
    try {
      // Use DSPy with MIPROv2 for intelligent search if contentsearch is provided
      if (this.config.enableDSPyOptimization && query.content_search) {
        if (this.config.enableMIPROv2) {
          const searchResult = await dspyService.request'manage_knowledge', {
            operation: 'search',
            data: {
              query: query.content_search,
              context: {
                type: query.type,
                tags: query.tags,
                min_confidence: query.min_confidence,
              },
            },
          });

          if (searchResult.success) {
            this._updatePerformanceMetrics('searches', searchResult.result.confidence || 0.7);
            return searchResult.result.relevant_items || [];
          }
        } else {
          const searchResult = await dspyService.searchKnowledge(query.content_search, {
            type: query.type,
            tags: query.tags,
            min_confidence: query.min_confidence,
          });

          if (searchResult.success && searchResult.result.items) {
            return searchResult.result.items;
          }
        }
      }

      // Fallback to database search
      let dbQuery = this.supabase.from('knowledge_base').select('*');

      if (query.type?.length) {
        dbQuery = dbQuery.in('type', query.type);
      }

      if (query.tags?.length) {
        dbQuery = dbQuery.overlaps('tags', query.tags);
      }

      if (query.min_confidence) {
        dbQuery = dbQuery.gte('confidence', query.min_confidence);
      }

      if (query.content_search) {
        dbQuery = dbQuery.or(
          `title.ilike.%${query.content_search}%,description.ilike.%${query.content_search}%`
        );
      }

      if (query.limit) {
        dbQuery = dbQuery.limit(query.limit);
      }

      const { data, error} = await dbQuery
        .order('relevance', { ascending: false })
        .order('confidence', { ascending: false });

      if (_error {
        logger.error('Failed to search knowledge:', error);
        throw error;
      }

      return (data as KnowledgeItem[]) || [];
    } catch (error) {
      logger.error('Failed to search knowledge:', error);
      throw error;
    }
  }

  /**
   * Update knowledge with DSPy evolution
   */
  async updateKnowledge(id: string, updates: Partial<KnowledgeItem>): Promise<boolean> {
    try {
      const existing = await this.getKnowledge(id);
      if (!existing) return false;

      // Use DSPy with MIPROv2 to evolve knowledge if contentis being updated
      let evolvedContent = updates.content
      if (this.config.enableDSPyOptimization && updates.content&& existing.content {
        if (this.config.enableMIPROv2) {
          const evolved = await dspyService.request'manage_knowledge', {
            operation: 'evolve',
            data: {
              existing: existing.content
              new_info: updates.content
              context: { type: existing.type, id: existing.id },
            },
          });

          if (evolved.success) {
            evolvedContent = evolved.result.evolved_knowledge;
            this._updatePerformanceMetrics('evolutions', evolved.result.confidence || 0.8);
          }
        } else {
          const evolved = await dspyService.evolveKnowledge(
            JSON.stringify(existing.content,
            JSON.stringify(updates.content
          );

          if (evolved.success) {
            evolvedContent = evolved.result;
          }
        }
      }

      const updatedKnowledge = {
        ...existing,
        ...updates,
        content evolvedContent || existing.content
        updated_at: new Date().toISOString(),
      };

      const { _error} = await this.supabase
        .from('knowledge_base')
        .update(updatedKnowledge)
        .eq('id', id);

      if (_error {
        logger.error('Failed to update knowledge:', error);
        throw error;
      }

      this.cache.set(id, updatedKnowledge);
      logger.info(`📝 Knowledge updated: ${id}`);
      this.emit('knowledge_updated', { id, updates });

      return true;
    } catch (error) {
      logger.error('Failed to update knowledge:', error);
      throw error;
    }
  }

  /**
   * Delete knowledge
   */
  async deleteKnowledge(id: string): Promise<boolean> {
    try {
      const { _error} = await this.supabase.from('knowledge_base').delete().eq('id', id);

      if (_error {
        logger.error('Failed to delete knowledge:', error);
        throw error;
      }

      this.cache.delete(id);
      logger.info(`🗑️ Knowledge deleted: ${id}`);
      this.emit('knowledge_deleted', { id });

      return true;
    } catch (error) {
      logger.error('Failed to delete knowledge:', error);
      throw error;
    }
  }

  /**
   * Get knowledge recommendations using DSPy
   */
  async getRecommendations(context: Record<string, unknown>): Promise<KnowledgeItem[]> {
    try {
      const query: KnowledgeQuery = {
        limit: 10,
        min_confidence: 0.7,
      };

      if (context.type) query.type = [context.type];
      if (context.tags) query.tags = context.tags;
      if (context.search) query.content_search = context.search;

      return await this.searchKnowledge(query);
    } catch (error) {
      logger.error('Failed to get recommendations:', error);
      return [];
    }
  }

  /**
   * Get knowledge metrics
   */
  async getMetrics(): Promise<Record<string, unknown>> {
    try {
      const { data, error} = await this.supabase
        .from('knowledge_base')
        .select('type, confidence, usage_count')
        .limit(1000);

      if (_error throw error;

      const items = data || [];
      const metrics = {
        total_items: items.length,
        by_type: {} as Record<string, number>,
        average_confidence: 0,
        total_usage: 0,
      };

      items.forEach((item: any) => {
        metrics.by_type[item.type] = (metrics.by_type[item.type] || 0) + 1;
        metrics.average_confidence += item.confidence;
        metrics.total_usage += item.usage_count || 0;
      });

      if (items.length > 0) {
        metrics.average_confidence /= items.length;
      }

      return metrics;
    } catch (error) {
      logger.error('Failed to get metrics:', error);
      return {};
    }
  }

  private async updateUsageCount(id: string): Promise<void> {
    try {
      await this.supabase.rpc('increment_knowledge_usage', { knowledge_id: id });
    } catch (error) {
      // Fallback to manual update if RPC doesn't exist
      const { data } = await this.supabase
        .from('knowledge_base')
        .select('usage_count')
        .eq('id', id)
        .limit(1)
        .single();

      if (data) {
        await this.supabase
          .from('knowledge_base')
          .update({ usage_count: (data.usage_count || 0) + 1 })
          .eq('id', id);
      }
    }
  }

  /**
   * Validate knowledge using MIPROv2
   */
  async validateKnowledge(knowledge: Partial<KnowledgeItem>): Promise<{
    isValid: boolean;
    score: number;
    issues: string[];
    suggestions: string[];
  }> {
    if (!this.config.enableMIPROv2) {
      // Simple validation without MIPROv2
      return {
        isValid: true,
        score: 0.8,
        issues: [],
        suggestions: [],
      };
    }

    try {
      const result = await dspyService.request'manage_knowledge', {
        operation: 'validate',
        data: {
          knowledge,
          context: { type: knowledge.type },
        },
      });

      if (result.success) {
        this._updatePerformanceMetrics('validations', result.result.validation_score || 0.7);
        return {
          isValid: result.result.is_valid,
          score: result.result.validation_score,
          issues: result.result.issues || [],
          suggestions: result.result.suggestions || [],
        };
      }
    } catch (error) {
      logger.error('Validation failed:', error);
    }

    return {
      isValid: false,
      score: 0,
      issues: ['Validation failed'],
      suggestions: [],
    };
  }

  /**
   * Trigger MIPROv2 optimization manually
   */
  async optimizeKnowledgeModules(examples: any[] = []): Promise<unknown> {
    if (!this.config.enableMIPROv2) {
      return { success: false, reason: 'MIPROv2 not enabled' };
    }

    try {
      const result = await dspyService.request'optimize_knowledge_modules', {
        examples,
        iterations: 10,
      });

      if (result.success) {
        logger.info('✨ Knowledge modules optimized successfully');
        this.emit('modules_optimized', result.result);
      }

      return result;
    } catch (error) {
      logger.error('Module optimization failed:', error);
      return { success: false, error error instanceof Error ? error.message : String(_error };
    }
  }

  /**
   * Get optimization metrics
   */
  async getOptimizationMetrics(): Promise<unknown> {
    if (!this.config.enableMIPROv2) {
      return this.performanceMetrics;
    }

    try {
      const result = await dspyService.request'get_optimization_metrics', {});

      if (result.success) {
        return {
          ...this.performanceMetrics,
          miprov2: result.result,
        };
      }
    } catch (error) {
      logger.error('Failed to get optimization metrics:', error);
    }

    return this.performanceMetrics;
  }

  /**
   * Update performance metrics for continuous learning
   */
  private _updatePerformanceMetrics(operation: string, score: number): void {
    const metrics = (this.performanceMetrics as any)[operation];
    if (!metrics) return;

    metrics.total++;
    if (score > 0.7) metrics.successful++;

    // Update rolling average
    const avgField = operation === 'validations' ? 'avgScore' : 'avgConfidence';
    metrics[avgField] = (metrics[avgField] * (metrics.total - 1) + score) / metrics.total;

    this.operationCount++;

    // Check if optimization threshold is reached
    if (this.operationCount >= this.config.optimizationThreshold) {
      this._triggerOptimization();
    }
  }

  /**
   * Trigger automatic optimization
   */
  private async _triggerOptimization(): Promise<void> {
    logger.info(`🔄 Triggering automatic optimization after ${this.operationCount} operations`);

    try {
      // Reset counter
      this.operationCount = 0;

      // Collect recent examples from cache
      const examples = Array.from(this.cache.values())
        .slice(-50) // Last 50 items
        .map((item) => ({
          rawcontent JSON.stringify(item.content,
          context: { type: item.type, title: item.title },
          knowledge_item: item,
        }));

      await this.optimizeKnowledgeModules(examples);
    } catch (error) {
      logger.error('Automatic optimization failed:', error);
    }
  }

  /**
   * Shutdown the knowledge manager
   */
  async shutdown(): Promise<void> {
    logger.info('🔥 Shutting down DSPy Knowledge Manager...');

    // Get final metrics before shutdown
    const metrics = await this.getOptimizationMetrics();
    logger.info('Final performance metrics:', metrics);

    this.cache.clear();
    this.removeAllListeners();
  }
}

// Export utility functions for creating knowledge items
export const knowledgeUtils = {
  createKnowledge: (
    type: KnowledgeType,
    title: string,
    content any,
    metadata: Record<string, unknown> = {}
  ): Partial<KnowledgeItem> => ({
    type,
    title,
    description: `${type} knowledge: ${title}`,
    content
    tags: metadata.tags || [],
    confidence: metadata.confidence || 0.8,
    relevance: metadata.relevance || 0.7,
    metadata,
  }),
};
