import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import { THOUSAND } from '../utils/common-constants';
import { log, LogContext } from '../utils/logger';
export class RerankingService {
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    models = [
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
    activeModel;
    constructor() {
        this.activeModel = this.models[0];
    }
    async rerank(query, candidates, options = {}) {
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
            const results = [];
            for (let i = 0; i < candidates.length; i += this.activeModel.maxBatchSize) {
                const batch = candidates.slice(i, i + this.activeModel.maxBatchSize);
                const batchResults = await this.rerankBatch(query, batch);
                results.push(...batchResults);
            }
            results.sort((a, b) => b.finalScore - a.finalScore);
            const filtered = results.filter((r) => r.finalScore >= threshold).slice(0, topK);
            log.info('✅ Reranking completed', LogContext.AI, {
                inputCount: candidates.length,
                outputCount: filtered.length,
                topScore: filtered[0]?.finalScore || 0,
            });
            await this.storeRerankingMetrics(query, candidates.length, filtered.length);
            return filtered;
        }
        catch (error) {
            log.error('❌ Reranking failed', LogContext.AI, { error });
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
    async rerankBatch(query, candidates) {
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
    async rerankWithHuggingFace(query, candidates) {
        try {
            let secret = null;
            try {
                const res = await this.supabase.rpc('vault.read_secret', {
                    secret_name: 'huggingface_api_key',
                });
                secret = res.data;
            }
            catch {
                const res = await this.supabase.rpc('vault_shim_read_secret', {
                    secret_name: 'huggingface_api_key',
                });
                secret = res.data;
            }
            if (!secret?.decrypted_secret && !process.env.HUGGINGFACE_API_KEY) {
                throw new Error('HuggingFace API key not found');
            }
            const apiKey = secret?.decrypted_secret || process.env.HUGGINGFACE_API_KEY;
            const inputs = candidates.map((c) => ({
                inputs: {
                    source_sentence: query,
                    sentences: [c.content],
                },
            }));
            const response = await axios.post(this.activeModel.endpoint, inputs, {
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
            });
            return candidates.map((candidate, idx) => {
                const score = response.data[idx]?.[0] || 0;
                const finalScore = this.combineBiAndCrossEncoderScores(candidate.biEncoderScore, score);
                return {
                    ...candidate,
                    crossEncoderScore: score,
                    finalScore,
                };
            });
        }
        catch (error) {
            log.error('HuggingFace reranking failed', LogContext.AI, { error });
            throw error;
        }
    }
    async rerankWithOpenAI(query, candidates) {
        try {
            let secret = null;
            try {
                const res = await this.supabase.rpc('vault.read_secret', {
                    secret_name: 'openai_api_key',
                });
                secret = res.data;
            }
            catch {
                const res = await this.supabase.rpc('vault_shim_read_secret', {
                    secret_name: 'openai_api_key',
                });
                secret = res.data;
            }
            if (!secret?.decrypted_secret && !process.env.OPENAI_API_KEY) {
                throw new Error('OpenAI API key not found');
            }
            const apiKey = secret?.decrypted_secret || process.env.OPENAI_API_KEY;
            const queryResponse = await axios.post('https://api.openai.com/v1/embeddings', {
                input: query,
                model: 'text-embedding-3-small',
            }, {
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
            });
            const queryEmbedding = queryResponse.data.data[0].embedding;
            const candidateResponse = await axios.post('https://api.openai.com/v1/embeddings', {
                input: candidates.map((c) => c.content),
                model: 'text-embedding-3-small',
            }, {
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
            });
            return candidates.map((candidate, idx) => {
                const candidateEmbedding = candidateResponse.data.data[idx].embedding;
                const similarity = this.cosineSimilarity(queryEmbedding, candidateEmbedding);
                const finalScore = this.combineBiAndCrossEncoderScores(candidate.biEncoderScore, similarity);
                return {
                    ...candidate,
                    crossEncoderScore: similarity,
                    finalScore,
                };
            });
        }
        catch (error) {
            log.error('OpenAI reranking failed', LogContext.AI, { error });
            throw error;
        }
    }
    async rerankWithLocal(query, candidates) {
        const normalizedQuery = query.toLowerCase();
        const queryTokens = normalizedQuery.split(/\W+/).filter(Boolean);
        return candidates.map((candidate) => {
            const content = candidate.content || '';
            const lowerContent = content.toLowerCase();
            const exactMatch = lowerContent.includes(normalizedQuery) ? 0.25 : 0;
            const overlap = this.calculateWordOverlap(normalizedQuery, lowerContent);
            const earlySection = lowerContent.slice(0, 200);
            const earlyOverlap = this.calculateWordOverlap(normalizedQuery, earlySection) * 0.2;
            const lengthPenalty = Math.min(0.2, Math.max(0, (content.length - 1200) / 6000));
            const crossEncoderScore = Math.max(0, Math.min(1, exactMatch + overlap * 0.6 + earlyOverlap * 0.2 - lengthPenalty));
            const finalScore = this.combineBiAndCrossEncoderScores(candidate.biEncoderScore, crossEncoderScore);
            return {
                ...candidate,
                crossEncoderScore,
                finalScore,
            };
        });
    }
    combineBiAndCrossEncoderScores(biEncoderScore, crossEncoderScore) {
        return 0.3 * biEncoderScore + 0.7 * crossEncoderScore;
    }
    cosineSimilarity(vec1, vec2) {
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
    calculateWordOverlap(query, content) {
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
    async storeRerankingMetrics(query, inputCount, outputCount) {
        try {
            await this.supabase.from('reranking_metrics').insert({
                query: query.substring(0, 200),
                model_name: this.activeModel.name,
                input_count: inputCount,
                output_count: outputCount,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            log.warn('Failed to store reranking metrics', LogContext.DATABASE, { error });
        }
    }
    async getRerankingStats() {
        try {
            const { data, error } = await this.supabase
                .from('reranking_metrics')
                .select('*')
                .order('timestamp', { ascending: false })
                .limit(THOUSAND);
            if (error)
                throw error;
            const totalQueries = data?.length || 0;
            const averageReductionRate = data
                ? data.reduce((sum, m) => sum + (1 - m.output_count / m.input_count), 0) / data.length
                : 0;
            const modelUsage = {};
            data?.forEach((m) => {
                modelUsage[m.model_name] = (modelUsage[m.model_name] || 0) + 1;
            });
            return {
                totalQueries,
                averageReductionRate,
                modelUsage,
            };
        }
        catch (error) {
            log.error('Failed to get reranking stats', LogContext.DATABASE, { error });
            return {
                totalQueries: 0,
                averageReductionRate: 0,
                modelUsage: {},
            };
        }
    }
}
export const rerankingService = new RerankingService();
//# sourceMappingURL=reranking-service.js.map