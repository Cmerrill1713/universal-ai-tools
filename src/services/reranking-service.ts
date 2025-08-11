/**
 * Reranking Service
 * Implements two-stage retrieval with cross-encoder reranking for improved search relevance
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

import { THOUSAND } from '../utils/common-constants';
import { log,LogContext } from '../utils/logger';

interface RerankingModel {
  name: string;
  type: 'huggingface' | 'openai' | 'local';
  endpoint?: string;
  apiKey?: string;
  maxBatchSize: number;
}

interface RerankCandidate {
  id: string;
  content: string;
  metadata?: Record<string, any>;
  biEncoderScore: number;
}

interface RerankResult {
  id: string;
  content: string;
  metadata?: Record<string, any>;
  biEncoderScore: number;
  crossEncoderScore: number;
  finalScore: number;
}

export class RerankingService {
  private supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

  private models: RerankingModel[] = [
    {
      name: 'cross-encoder/ms-marco-MiniLM-L-12-v2',
      type: 'huggingface',
      endpoint: 'https://api-inference.huggingface.co/models/cross-encoder/ms-marco-MiniLM-L-12-v2',
      maxBatchSize: 32,
    },
    {
      name: 'text-embedding-3-small',
      type: 'openai',
      maxBatchSize: 100,
    },
    {
      name: 'local-heuristic',
      type: 'local',
      maxBatchSize: 1000,
    },
  ];

  private activeModel: RerankingModel;

  constructor() {
    // Default to HuggingFace cross-encoder
    this.activeModel = this.models[0]!;
  }

  /**
   * Rerank candidates using cross-encoder model
   */
  async rerank(
    query: string,
    candidates: RerankCandidate[],
    options: {
      topK?: number;
      model?: string;
      threshold?: number;
    } = {}
  ): Promise<RerankResult[]> {
    const { topK = 10, model, threshold = 0.0 } = options;

    if (model) {
      const selectedModel = this.models.find((m) => m.name === model);
      if (selectedModel) {
        this.activeModel = selectedModel;
      }
    }

    log.info('🔄 Starting reranking process', LogContext.AI, {
      query: query.substring(0, 100),
      candidateCount: candidates.length,
      model: this.activeModel.name,
      topK,
    });

    try {
      // Batch candidates if needed
      const results: RerankResult[] = [];
      for (let i = 0; i < candidates.length; i += this.activeModel.maxBatchSize) {
        const batch = candidates.slice(i, i + this.activeModel.maxBatchSize);
        const batchResults = await this.rerankBatch(query, batch);
        results.push(...batchResults);
      }

      // Sort by final score (combination of bi-encoder and cross-encoder scores)
      results.sort((a, b) => b.finalScore - a.finalScore);

      // Filter by threshold and limit to topK
      const filtered = results.filter((r) => r.finalScore >= threshold).slice(0, topK);

      log.info('✅ Reranking completed', LogContext.AI, {
        inputCount: candidates.length,
        outputCount: filtered.length,
        topScore: filtered[0]?.finalScore || 0,
      });

      // Store reranking metrics for analysis
      await this.storeRerankingMetrics(query, candidates.length, filtered.length);

      return filtered;
    } catch (error) {
      log.error('❌ Reranking failed', LogContext.AI, { error });
      // Fallback to original bi-encoder scores
      return candidates
        .sort((a, b) => b.biEncoderScore - a.biEncoderScore)
        .slice(0, topK)
        .map((c) => ({
          ...c,
          crossEncoderScore: c.biEncoderScore,
          finalScore: c.biEncoderScore,
        }));
    }
  }

  /**
   * Rerank a batch of candidates
   */
  private async rerankBatch(query: string, candidates: RerankCandidate[]): Promise<RerankResult[]> {
    switch (this.activeModel.type) {
      case 'huggingface':
        return this.rerankWithHuggingFace(query, candidates);
      case 'openai':
        return this.rerankWithOpenAI(query, candidates);
      case 'local':
        return this.rerankWithLocal(query, candidates);
      default:
        throw new Error(`Unsupported model type: ${this.activeModel.type}`);
    }
  }

  /**
   * Rerank using HuggingFace cross-encoder
   */
  private async rerankWithHuggingFace(
    query: string,
    candidates: RerankCandidate[]
  ): Promise<RerankResult[]> {
    try {
      // Get API key from Supabase vault with fallback to shim
      let secret: any = null;
      try {
        const res = await this.supabase.rpc('vault.read_secret', {
          secret_name: 'huggingface_api_key',
        });
        secret = res.data;
      } catch {
        const res = await this.supabase.rpc('vault_shim_read_secret', {
          secret_name: 'huggingface_api_key',
        });
        secret = res.data;
      }

      if (!secret?.decrypted_secret && !process.env.HUGGINGFACE_API_KEY) {
        throw new Error('HuggingFace API key not found');
      }

      const apiKey = secret?.decrypted_secret || process.env.HUGGINGFACE_API_KEY;

      // Prepare input pairs for cross-encoder
      const inputs = candidates.map((c) => ({
        inputs: {
          source_sentence: query,
          sentences: [c.content],
        },
      }));

      const response = await axios.post(this.activeModel.endpoint!, inputs, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      // Process responses
      return candidates.map((candidate, idx) => {
        const score = response.data[idx]?.[0] || 0;
        const finalScore = this.combineBiAndCrossEncoderScores(candidate.biEncoderScore, score);

        return {
          ...candidate,
          crossEncoderScore: score,
          finalScore,
        };
      });
    } catch (error) {
      log.error('HuggingFace reranking failed', LogContext.AI, { error });
      throw error;
    }
  }

  /**
   * Rerank using OpenAI (simplified similarity approach)
   */
  private async rerankWithOpenAI(
    query: string,
    candidates: RerankCandidate[]
  ): Promise<RerankResult[]> {
    try {
      // For OpenAI, we'll use embeddings similarity as a proxy for reranking
      // This is not as good as true cross-encoder but works as fallback

      let secret: any = null;
      try {
        const res = await this.supabase.rpc('vault.read_secret', {
          secret_name: 'openai_api_key',
        });
        secret = res.data;
      } catch {
        const res = await this.supabase.rpc('vault_shim_read_secret', {
          secret_name: 'openai_api_key',
        });
        secret = res.data;
      }

      if (!secret?.decrypted_secret && !process.env.OPENAI_API_KEY) {
        throw new Error('OpenAI API key not found');
      }

      const apiKey = secret?.decrypted_secret || process.env.OPENAI_API_KEY;

      // Get query embedding
      const queryResponse = await axios.post(
        'https://api.openai.com/v1/embeddings',
        {
          input: query,
          model: 'text-embedding-3-small',
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const queryEmbedding = queryResponse.data.data[0].embedding;

      // Get candidate embeddings in batch
      const candidateResponse = await axios.post(
        'https://api.openai.com/v1/embeddings',
        {
          input: candidates.map((c) => c.content),
          model: 'text-embedding-3-small',
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      // Calculate cosine similarity as cross-encoder score
      return candidates.map((candidate, idx) => {
        const candidateEmbedding = candidateResponse.data.data[idx].embedding;
        const similarity = this.cosineSimilarity(queryEmbedding, candidateEmbedding);
        const finalScore = this.combineBiAndCrossEncoderScores(
          candidate.biEncoderScore,
          similarity
        );

        return {
          ...candidate,
          crossEncoderScore: similarity,
          finalScore,
        };
      });
    } catch (error) {
      log.error('OpenAI reranking failed', LogContext.AI, { error });
      throw error;
    }
  }

  /**
   * Rerank using local model (mock implementation)
   */
  private async rerankWithLocal(
    query: string,
    candidates: RerankCandidate[]
  ): Promise<RerankResult[]> {
    // Heuristic local reranker: combines token overlap, BM25-like scoring, and position bonuses
    const normalizedQuery = query.toLowerCase();
    const queryTokens = normalizedQuery.split(/\W+/).filter(Boolean);

    return candidates.map((candidate) => {
      const content = candidate.content || '';
      const lowerContent = content.toLowerCase();

      // Exact phrase presence bonus
      const exactMatch = lowerContent.includes(normalizedQuery) ? 0.25 : 0;

      // Token overlap ratio
      const overlap = this.calculateWordOverlap(normalizedQuery, lowerContent); // 0..1

      // Early-position bonus (first 200 chars)
      const earlySection = lowerContent.slice(0, 200);
      const earlyOverlap = this.calculateWordOverlap(normalizedQuery, earlySection) * 0.2;

      // Length normalization (discourage overly long snippets)
      const lengthPenalty = Math.min(0.2, Math.max(0, (content.length - 1200) / 6000));

      // Aggregate cross-encoder proxy score
      const crossEncoderScore = Math.max(
        0,
        Math.min(1, exactMatch + overlap * 0.6 + earlyOverlap * 0.2 - lengthPenalty)
      );

      const finalScore = this.combineBiAndCrossEncoderScores(
        candidate.biEncoderScore,
        crossEncoderScore
      );

      return {
        ...candidate,
        crossEncoderScore,
        finalScore,
      };
    });
  }

  /**
   * Combine bi-encoder and cross-encoder scores
   */
  private combineBiAndCrossEncoderScores(
    biEncoderScore: number,
    crossEncoderScore: number
  ): number {
    // Weighted combination: 30% bi-encoder, 70% cross-encoder
    // Cross-encoder is more accurate but expensive
    return 0.3 * biEncoderScore + 0.7 * crossEncoderScore;
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += (vec1[i] ?? 0) * (vec2[i] ?? 0);
      norm1 += (vec1[i] ?? 0) * (vec1[i] ?? 0);
      norm2 += (vec2[i] ?? 0) * (vec2[i] ?? 0);
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  /**
   * Calculate word overlap between query and content
   */
  private calculateWordOverlap(query: string, content: string): number {
    const queryWords = new Set(query.split(/\s+/));
    const contentWords = new Set(content.split(/\s+/));

    let overlap = 0;
    queryWords.forEach((word) => {
      if (contentWords.has(word)) {
        overlap++;
      }
    });

    return overlap / queryWords.size;
  }

  /**
   * Store reranking metrics for analysis
   */
  private async storeRerankingMetrics(
    query: string,
    inputCount: number,
    outputCount: number
  ): Promise<void> {
    try {
      await this.supabase.from('reranking_metrics').insert({
        query: query.substring(0, 200),
        model_name: this.activeModel.name,
        input_count: inputCount,
        output_count: outputCount,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      // Don't fail the reranking if metrics storage fails
      log.warn('Failed to store reranking metrics', LogContext.DATABASE, { error });
    }
  }

  /**
   * Get reranking performance statistics
   */
  async getRerankingStats(): Promise<{
    totalQueries: number;
    averageReductionRate: number;
    modelUsage: Record<string, number>;
  }> {
    try {
      const { data, error } = await this.supabase
        .from('reranking_metrics')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(THOUSAND);

      if (error) throw error;

      const totalQueries = data?.length || 0;
      const averageReductionRate = data
        ? data.reduce((sum, m) => sum + (1 - m.output_count / m.input_count), 0) / data.length
        : 0;

      const modelUsage: Record<string, number> = {};
      data?.forEach((m) => {
        modelUsage[m.model_name] = (modelUsage[m.model_name] || 0) + 1;
      });

      return {
        totalQueries,
        averageReductionRate,
        modelUsage,
      };
    } catch (error) {
      log.error('Failed to get reranking stats', LogContext.DATABASE, { error });
      return {
        totalQueries: 0,
        averageReductionRate: 0,
        modelUsage: {},
      };
    }
  }
}

// Create singleton instance
export const rerankingService = new RerankingService();
