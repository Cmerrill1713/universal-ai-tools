/**
 * Visual Memory Service
 * Manages storage, retrieval, and search of visual memories
 * Integrates with existing memory system for unified experience
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';

import { config } from '@/config/environment';
// VisualHypothesis is not used here
import type { ExpectedOutcome, LearningDelta, ObjectDifference, VisualObject } from '@/types';
import type {
  GeneratedImage,
  LearningOutcome,
  ValidationResult,
  VisionAnalysis,
  VisionEmbedding,
  VisualMemory,
} from '@/types/vision';
import { log, LogContext } from '@/utils/logger';

import { pyVisionBridge } from './pyvision-bridge';

export interface VisualSearchResult {
  memory: VisualMemory;
  similarity: number;
}

export interface ConceptUpdate {
  concept: string;
  prototype: Float32Array;
  description?: string;
}

export class VisualMemoryService {
  private supabase: SupabaseClient | null = null;
  private memoryCache: Map<string, VisualMemory> = new Map();
  private conceptCache: Map<string, any> = new Map();
  private readonly maxCacheSize = 500;

  constructor() {
    this.initializeSupabase();
  }

  private initializeSupabase(): void {
    if (!config.supabase.url || !config.supabase.serviceKey) {
      log.warn('⚠️ Supabase not configured for visual memory', LogContext.MEMORY);
      return;
    }

    this.supabase = createClient(config.supabase.url, config.supabase.serviceKey);

    log.info('✅ Visual Memory Service initialized', LogContext.MEMORY);
  }

  /**
   * Store a visual memory with analysis and embedding
   */
  public async storeVisualMemory(
    imagePath: string | Buffer,
    metadata: Record<string, any> = {},
    userId?: string
  ): Promise<VisualMemory> {
    try {
      // Generate embedding
      const embeddingResult = await pyVisionBridge.generateEmbedding(imagePath);
      if (!embeddingResult.success || !embeddingResult.data) {
        throw new Error('Failed to generate embedding');
      }

      // Analyze image
      const analysisResult = await pyVisionBridge.analyzeImage(imagePath, { detailed: true });

      // Create memory record
      const memory: Partial<VisualMemory> = {
        embedding: embeddingResult.data,
        imageData: {
          path: typeof imagePath === 'string' ? imagePath : undefined,
          base64: typeof imagePath !== 'string' ? imagePath.toString('base64') : undefined,
        },
        analysis: analysisResult.success ? analysisResult.data : undefined,
        metadata: {
          ...metadata,
          userId,
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date(),
      };

      // Store in database
      if (this.supabase) {
        const { data, error } = await this.supabase
          .from('ai_memories')
          .insert([
            {
              type: 'visual',
              content: JSON.stringify(memory.analysis || {}),
              metadata: memory.metadata,
              visual_embedding: Array.from(memory.embedding?.vector || []),
              image_path: memory.imageData?.path,
              user_id: userId,
              importance: 0.7,
            },
          ])
          .select()
          .single();

        if (error) {
          log.error('Failed to store visual memory', LogContext.MEMORY, { error });
          throw error;
        }

        memory.id = data.id; // Store embedding separately for faster search
        await this.storeEmbedding(data.id, memory.embedding!);
      } else {
        // Fallback to in-memory storage
        memory.id = `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }

      // Update cache
      if (memory.id) {
        this.updateCache(memory.id, memory as VisualMemory);
      }

      log.info('✅ Visual memory stored', LogContext.MEMORY, {
        memoryId: memory.id,
        hasAnalysis: !!memory.analysis,
      });

      return memory as VisualMemory;
    } catch (error) {
      log.error('Failed to store visual memory', LogContext.MEMORY, { error });
      throw error;
    }
  }

  /**
   * Search for similar visual memories
   */
  public async searchSimilar(
    queryEmbedding: Float32Array | string | Buffer,
    limit = 10,
    threshold = 0.7
  ): Promise<VisualSearchResult[]> {
    try {
      // Get embedding if needed
      let embedding: Float32Array;
      if (queryEmbedding instanceof Float32Array) {
        embedding = queryEmbedding;
      } else {
        const result = await pyVisionBridge.generateEmbedding(queryEmbedding);
        if (!result.success || !result.data) {
          throw new Error('Failed to generate query embedding');
        }
        embedding = new Float32Array(result.data.vector);
      }

      if (this.supabase) {
        // Use database function for similarity search
        const { data, error } = await this.supabase.rpc('search_similar_images', {
          query_embedding: Array.from(embedding),
          limit_count: limit,
          threshold,
        });

        if (error) {
          log.error('Visual search failed', LogContext.MEMORY, { error });
          throw error;
        }

        // Fetch full memories
        const results: VisualSearchResult[] = [];
        for (const row of data) {
          const memory = await this.getMemoryById(row.memory_id);
          if (memory) {
            results.push({
              memory,
              similarity: row.similarity,
            });
          }
        }

        return results;
      } else {
        // Fallback to in-memory search
        return this.searchInMemory(embedding, limit, threshold);
      }
    } catch (error) {
      log.error('Visual similarity search failed', LogContext.MEMORY, { error });
      throw error;
    }
  }

  /**
   * Store a visual hypothesis for testing
   */
  public async storeHypothesis(
    concept: string,
    hypothesis: string,
    generatedImage: GeneratedImage,
    expectedOutcome: ExpectedOutcome
  ): Promise<string> {
    try {
      if (!this.supabase) {
        log.warn('Cannot store hypothesis without database', LogContext.MEMORY);
        return 'mock_hypothesis_id';
      }

      const { data, error } = await this.supabase
        .from('visual_hypotheses')
        .insert([
          {
            concept,
            hypothesis,
            generated_image_id: generatedImage.id,
            expected_outcome: expectedOutcome,
          },
        ])
        .select()
        .single();

      if (error) {
        log.error('Failed to store hypothesis', LogContext.MEMORY, { error });
        throw error;
      }

      log.info('✅ Visual hypothesis stored', LogContext.MEMORY, {
        hypothesisId: data.id,
        concept,
      });

      return data.id;
    } catch (error) {
      log.error('Failed to store visual hypothesis', LogContext.MEMORY, { error });
      throw error;
    }
  }

  /**
   * Validate a visual hypothesis
   */
  public async validateHypothesis(
    hypothesisId: string,
    actualAnalysis: VisionAnalysis
  ): Promise<ValidationResult> {
    try {
      if (!this.supabase) {
        return this.mockValidation(hypothesisId, actualAnalysis);
      }

      // Fetch hypothesis
      const { data: hypothesis, error } = await this.supabase
        .from('visual_hypotheses')
        .select('*, generated_images(*)')
        .eq('id', hypothesisId)
        .single();

      if (error || !hypothesis) {
        throw new Error('Hypothesis not found');
      }

      // Compare expected vs actual
      const validationScore = this.calculateValidationScore(
        hypothesis.expected_outcome,
        actualAnalysis
      );

      const learningOutcome: LearningOutcome = {
        concept: hypothesis.concept,
        success: validationScore > 0.7,
        adjustment: this.generateLearningAdjustment(
          hypothesis.expected_outcome,
          actualAnalysis,
          validationScore
        ),
      };

      // Update hypothesis with validation
      await this.supabase
        .from('visual_hypotheses')
        .update({
          actual_outcome: actualAnalysis,
          validation_score: validationScore,
          learning_outcome: learningOutcome,
          validated_at: new Date().toISOString(),
        })
        .eq('id', hypothesisId);

      const result: ValidationResult = {
        hypothesis: {
          id: hypothesis.id,
          concept: hypothesis.concept,
          generatedImage: hypothesis.generated_images,
          expectedOutcome: hypothesis.expected_outcome,
          confidence: 0.8,
        },
        actual: actualAnalysis,
        match: validationScore > 0.7,
        matchScore: validationScore,
        learning: learningOutcome,
      };

      log.info('✅ Hypothesis validated', LogContext.MEMORY, {
        hypothesisId,
        success: result.match,
        score: validationScore,
      });

      return result;
    } catch (error) {
      log.error('Failed to validate hypothesis', LogContext.MEMORY, { error });
      throw error;
    }
  }

  /**
   * Update or create a visual concept
   */
  public async updateConcept(update: ConceptUpdate): Promise<void> {
    try {
      if (!this.supabase) {
        log.warn('Cannot update concept without database', LogContext.MEMORY);
        return;
      }

      await this.supabase.rpc('update_visual_concept', {
        p_concept: update.concept,
        p_new_prototype: Array.from(update.prototype),
      });

      // Clear concept cache
      this.conceptCache.delete(update.concept);

      log.info('✅ Visual concept updated', LogContext.MEMORY, {
        concept: update.concept,
      });
    } catch (error) {
      log.error('Failed to update visual concept', LogContext.MEMORY, { error });
      throw error;
    }
  }

  /**
   * Get visual concepts matching a query
   */
  public async getRelatedConcepts(query: string, limit = 5): Promise<any[]> {
    try {
      if (!this.supabase) {
        return [];
      }

      const { data, error } = await this.supabase
        .from('visual_concepts')
        .select('*')
        .textSearch('concept', query)
        .limit(limit)
        .order('usage_count', { ascending: false });

      if (error) {
        log.error('Failed to fetch concepts', LogContext.MEMORY, { error });
        throw error;
      }

      return data || [];
    } catch (error) {
      log.error('Failed to get related concepts', LogContext.MEMORY, { error });
      return [];
    }
  }

  /**
   * Store learning experience from visual interaction
   */
  public async storeLearningExperience(
    agentId: string,
    memoryId: string,
    prediction: ExpectedOutcome,
    actualOutcome: ExpectedOutcome,
    success: boolean
  ): Promise<void> {
    try {
      if (!this.supabase) {
        log.warn('Cannot store learning experience without database', LogContext.MEMORY);
        return;
      }

      const learningDelta = this.calculateLearningDelta(prediction, actualOutcome);

      await this.supabase.from('visual_learning_experiences').insert([
        {
          agent_id: agentId,
          memory_id: memoryId,
          prediction,
          actual_outcome: actualOutcome,
          learning_delta: learningDelta,
          success,
          confidence: success ? 0.9 : 0.3,
        },
      ]);

      log.info('✅ Visual learning experience stored', LogContext.MEMORY, {
        agentId,
        success,
      });
    } catch (error) {
      log.error('Failed to store learning experience', LogContext.MEMORY, { error });
    }
  }

  // Private helper methods

  private async storeEmbedding(memoryId: string, embedding: VisionEmbedding): Promise<void> {
    if (!this.supabase) {return;}

    await this.supabase.from('vision_embeddings').insert([
      {
        memory_id: memoryId,
        embedding: Array.from(embedding.vector),
        model_version: embedding.model,
        confidence: 0.95,
      },
    ]);
  }

  private async getMemoryById(id: string): Promise<VisualMemory | null> {
    // Check cache first
    if (this.memoryCache.has(id)) {
      return this.memoryCache.get(id)!;
    }

    if (!this.supabase) {return null;}

    const { data, error } = await this.supabase
      .from('ai_memories')
      .select('*, vision_embeddings(*)')
      .eq('id', id)
      .single();

    if (error || !data) {return null;}

    const embedding: VisionEmbedding | undefined = data.vision_embeddings?.[0]
      ? {
          vector: new Float32Array(data.vision_embeddings[0].embedding),
          model: data.vision_embeddings[0].model_version,
          dimension: 512,
        }
      : undefined;

    const memory: VisualMemory = {
      id: data.id,
      embedding: embedding!, // We'll handle undefined case in the type
      imageData: {
        path: data.image_path,
      },
      analysis: data.content ? JSON.parse(data.content) : undefined,
      metadata: data.metadata,
      timestamp: new Date(data.created_at),
    };

    this.updateCache(id, memory);
    return memory;
  }

  private searchInMemory(
    queryEmbedding: Float32Array,
    limit: number,
    threshold: number
  ): VisualSearchResult[] {
    const results: VisualSearchResult[] = [];

    for (const memory of this.memoryCache.values()) {
      if (!memory.embedding) {continue;}

      const similarity = this.cosineSimilarity(queryEmbedding, memory.embedding.vector);

      if (similarity >= threshold) {
        results.push({ memory, similarity });
      }
    }

    return results.sort((a, b) => b.similarity - a.similarity).slice(0, limit);
  }

  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      // eslint-disable-next-line security/detect-object-injection
      const aVal = Number(a[i] ?? 0);
      // eslint-disable-next-line security/detect-object-injection
      const bVal = Number(b[i] ?? 0);
      dotProduct += aVal * bVal;
      normA += aVal * aVal;
      normB += bVal * bVal;
    }

    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom > 0 ? dotProduct / denom : 0;
  }

  private calculateValidationScore(expected: ExpectedOutcome, actual: VisionAnalysis): number {
    // Simple validation based on object detection overlap
    const expectedObjects = new Set(expected.objects?.map((o: VisualObject) => o.class) || []);
    const actualObjects = new Set(actual.objects?.map((o) => o.class) || []);

    let matches = 0;
    for (const obj of expectedObjects) {
      if (actualObjects.has(String(obj))) {matches++;}
    }

    const precision = expectedObjects.size > 0 ? matches / expectedObjects.size : 0;
    const recall = actualObjects.size > 0 ? matches / actualObjects.size : 0;

    return precision * recall > 0 ? (2 * (precision * recall)) / (precision + recall) : 0;
  }

  private generateLearningAdjustment(
    expected: ExpectedOutcome,
    actual: VisionAnalysis,
    score: number
  ): string {
    if (score > 0.8) {
      return 'Hypothesis confirmed - maintain current understanding';
    } else if (score > 0.5) {
      return 'Partial match - refine object detection thresholds';
    } else {
      return 'Hypothesis incorrect - update visual concept mapping';
    }
  }

  private calculateLearningDelta(prediction: unknown, actual: unknown): LearningDelta {
    const predObj = (
      typeof prediction === 'object' && prediction !== null
        ? (prediction as Record<string, unknown>)
        : {}
    );
    const actObj = (
      typeof actual === 'object' && actual !== null ? (actual as Record<string, unknown>) : {}
    );

    const predConf = typeof predObj.confidence === 'number' ? (predObj.confidence) : 0;
    const actConf = typeof actObj.confidence === 'number' ? (actObj.confidence) : 0;

    return {
      added: this.findDifferences(actual, prediction),
      removed: this.findDifferences(prediction, actual),
      confidence_change: actConf - predConf,
    };
  }

  private findDifferences(a: unknown, b: unknown): ObjectDifference {
    // Project only known-safe fields from potentially dynamic objects
    type SafeProjected = {
      confidence?: number;
      objects?: Array<{ class: string }>;
      labels?: string[];
      path?: string;
      description?: string;
      generatedImage?: unknown;
      expectedOutcome?: unknown;
      metadata?: Record<string, unknown>;
      imageData?: { path?: string };
      timestamp?: string | Date;
      concept?: string;
    };

    const project = (input: unknown): SafeProjected => {
      const out: SafeProjected = {};
      if (typeof input !== 'object' || input === null) {return out;}
      const src = input as Record<string, unknown>;

      if (typeof src.confidence === 'number') {out.confidence = src.confidence;}
      if (Array.isArray(src.objects)) {
        const arr = (src.objects as unknown[])
          .map((o) => {
            if (o && typeof o === 'object' && typeof (o as any).class === 'string') {
              return { class: String((o as any).class) };
            }
            return null;
          })
          .filter(Boolean) as Array<{ class: string }>;
        if (arr.length > 0) {out.objects = arr;}
      }
      if (Array.isArray(src.labels)) {
        const labels = (src.labels as unknown[]).map((v) => String(v));
        if (labels.length > 0) {out.labels = labels;}
      }
      if (typeof src.path === 'string') {out.path = src.path;}
      if (typeof src.description === 'string') {out.description = src.description;}
      if (typeof src.generatedImage !== 'undefined') {out.generatedImage = src.generatedImage;}
      if (typeof src.expectedOutcome !== 'undefined') {out.expectedOutcome = src.expectedOutcome;}
      if (src.metadata && typeof src.metadata === 'object') {
        out.metadata = src.metadata as Record<string, unknown>;
      }
      if (src.imageData && typeof src.imageData === 'object') {
        const id = src.imageData as Record<string, unknown>;
        const pathVal = typeof id.path === 'string' ? (id.path) : undefined;
        out.imageData = { path: pathVal };
      }
      if (typeof src.timestamp === 'string' || src.timestamp instanceof Date) {
        out.timestamp = src.timestamp;
      }
      if (typeof src.concept === 'string') {out.concept = src.concept;}
      return out;
    };

    const A = project(a);
    const B = project(b);
    const result: ObjectDifference = {};

    const json = (v: unknown) => JSON.stringify(v, this.safeStringifyReplacer);

    // Compare field-by-field explicitly to avoid dynamic property access
    if (json(A.confidence) !== json(B.confidence)) {(result as any).confidence = A.confidence as any;}
    if (json(A.objects) !== json(B.objects)) {(result as any).objects = A.objects as any;}
    if (json(A.labels) !== json(B.labels)) {(result as any).labels = A.labels as any;}
    if (json(A.path) !== json(B.path)) {(result as any).path = A.path as any;}
    if (json(A.description) !== json(B.description)) {(result as any).description = A.description as any;}
    if (json(A.generatedImage) !== json(B.generatedImage)) {
      (result as any).generatedImage = A.generatedImage as any;
    }
    if (json(A.expectedOutcome) !== json(B.expectedOutcome)) {
      (result as any).expectedOutcome = A.expectedOutcome as any;
    }
    if (json(A.metadata) !== json(B.metadata)) {(result as any).metadata = A.metadata as any;}
    if (json(A.imageData) !== json(B.imageData)) {(result as any).imageData = A.imageData as any;}
    if (json(A.timestamp) !== json(B.timestamp)) {(result as any).timestamp = A.timestamp as any;}
    if (json(A.concept) !== json(B.concept)) {(result as any).concept = A.concept as any;}

    return result;
  }

  // Use a safe stable stringify to avoid prototype pollution concerns
  // and handle undefined/circular structures gracefully

  private safeStringifyReplacer(_key: string, value: unknown) {
    if (typeof value === 'function') {return '[Function]';}
    if (typeof value === 'symbol') {return String(value);}
    return value;
  }

  private mockValidation(hypothesisId: string, actual: VisionAnalysis): ValidationResult {
    return {
      hypothesis: {
        id: hypothesisId,
        concept: 'mock_concept',
        generatedImage: {} as GeneratedImage,
        expectedOutcome: 'mock_outcome',
        confidence: 0.8,
      },
      actual,
      match: true,
      matchScore: 0.85,
      learning: {
        concept: 'mock_concept',
        success: true,
        adjustment: 'Mock validation successful',
      },
    };
  }

  private updateCache(id: string, memory: VisualMemory): void {
    // LRU cache management
    if (this.memoryCache.size >= this.maxCacheSize) {
      const firstKey = this.memoryCache.keys().next().value;
      if (firstKey !== undefined) {
        this.memoryCache.delete(firstKey);
      }
    }
    this.memoryCache.set(id, memory);
  }

  public async shutdown(): Promise<void> {
    log.info('🛑 Shutting down Visual Memory Service', LogContext.MEMORY);
    this.memoryCache.clear();
    this.conceptCache.clear();
  }
}

// Export singleton
export const visualMemoryService = new VisualMemoryService();
export default visualMemoryService;
