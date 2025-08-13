import { createClient } from '@supabase/supabase-js';
import { config } from '@/config/environment';
import { log, LogContext } from '@/utils/logger';
import { pyVisionBridge } from './pyvision-bridge';
export class VisualMemoryService {
    supabase = null;
    memoryCache = new Map();
    conceptCache = new Map();
    maxCacheSize = 500;
    constructor() {
        this.initializeSupabase();
    }
    initializeSupabase() {
        if (!config.supabase.url || !config.supabase.serviceKey) {
            log.warn('⚠️ Supabase not configured for visual memory', LogContext.MEMORY);
            return;
        }
        this.supabase = createClient(config.supabase.url, config.supabase.serviceKey);
        log.info('✅ Visual Memory Service initialized', LogContext.MEMORY);
    }
    async storeVisualMemory(imagePath, metadata = {}, userId) {
        try {
            const embeddingResult = await pyVisionBridge.generateEmbedding(imagePath);
            if (!embeddingResult.success || !embeddingResult.data) {
                throw new Error('Failed to generate embedding');
            }
            const analysisResult = await pyVisionBridge.analyzeImage(imagePath, { detailed: true });
            const memory = {
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
                memory.id = data.id;
                await this.storeEmbedding(data.id, memory.embedding);
            }
            else {
                memory.id = `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            }
            if (memory.id) {
                this.updateCache(memory.id, memory);
            }
            log.info('✅ Visual memory stored', LogContext.MEMORY, {
                memoryId: memory.id,
                hasAnalysis: !!memory.analysis,
            });
            return memory;
        }
        catch (error) {
            log.error('Failed to store visual memory', LogContext.MEMORY, { error });
            throw error;
        }
    }
    async searchSimilar(queryEmbedding, limit = 10, threshold = 0.7) {
        try {
            let embedding;
            if (queryEmbedding instanceof Float32Array) {
                embedding = queryEmbedding;
            }
            else {
                const result = await pyVisionBridge.generateEmbedding(queryEmbedding);
                if (!result.success || !result.data) {
                    throw new Error('Failed to generate query embedding');
                }
                embedding = new Float32Array(result.data.vector);
            }
            if (this.supabase) {
                const { data, error } = await this.supabase.rpc('search_similar_images', {
                    query_embedding: Array.from(embedding),
                    limit_count: limit,
                    threshold,
                });
                if (error) {
                    log.error('Visual search failed', LogContext.MEMORY, { error });
                    throw error;
                }
                const results = [];
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
            }
            else {
                return this.searchInMemory(embedding, limit, threshold);
            }
        }
        catch (error) {
            log.error('Visual similarity search failed', LogContext.MEMORY, { error });
            throw error;
        }
    }
    async storeHypothesis(concept, hypothesis, generatedImage, expectedOutcome) {
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
        }
        catch (error) {
            log.error('Failed to store visual hypothesis', LogContext.MEMORY, { error });
            throw error;
        }
    }
    async validateHypothesis(hypothesisId, actualAnalysis) {
        try {
            if (!this.supabase) {
                return this.mockValidation(hypothesisId, actualAnalysis);
            }
            const { data: hypothesis, error } = await this.supabase
                .from('visual_hypotheses')
                .select('*, generated_images(*)')
                .eq('id', hypothesisId)
                .single();
            if (error || !hypothesis) {
                throw new Error('Hypothesis not found');
            }
            const validationScore = this.calculateValidationScore(hypothesis.expected_outcome, actualAnalysis);
            const learningOutcome = {
                concept: hypothesis.concept,
                success: validationScore > 0.7,
                adjustment: this.generateLearningAdjustment(hypothesis.expected_outcome, actualAnalysis, validationScore),
            };
            await this.supabase
                .from('visual_hypotheses')
                .update({
                actual_outcome: actualAnalysis,
                validation_score: validationScore,
                learning_outcome: learningOutcome,
                validated_at: new Date().toISOString(),
            })
                .eq('id', hypothesisId);
            const result = {
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
        }
        catch (error) {
            log.error('Failed to validate hypothesis', LogContext.MEMORY, { error });
            throw error;
        }
    }
    async updateConcept(update) {
        try {
            if (!this.supabase) {
                log.warn('Cannot update concept without database', LogContext.MEMORY);
                return;
            }
            await this.supabase.rpc('update_visual_concept', {
                p_concept: update.concept,
                p_new_prototype: Array.from(update.prototype),
            });
            this.conceptCache.delete(update.concept);
            log.info('✅ Visual concept updated', LogContext.MEMORY, {
                concept: update.concept,
            });
        }
        catch (error) {
            log.error('Failed to update visual concept', LogContext.MEMORY, { error });
            throw error;
        }
    }
    async getRelatedConcepts(query, limit = 5) {
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
        }
        catch (error) {
            log.error('Failed to get related concepts', LogContext.MEMORY, { error });
            return [];
        }
    }
    async storeLearningExperience(agentId, memoryId, prediction, actualOutcome, success) {
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
        }
        catch (error) {
            log.error('Failed to store learning experience', LogContext.MEMORY, { error });
        }
    }
    async storeEmbedding(memoryId, embedding) {
        if (!this.supabase)
            return;
        await this.supabase.from('vision_embeddings').insert([
            {
                memory_id: memoryId,
                embedding: Array.from(embedding.vector),
                model_version: embedding.model,
                confidence: 0.95,
            },
        ]);
    }
    async getMemoryById(id) {
        if (this.memoryCache.has(id)) {
            return this.memoryCache.get(id);
        }
        if (!this.supabase)
            return null;
        const { data, error } = await this.supabase
            .from('ai_memories')
            .select('*, vision_embeddings(*)')
            .eq('id', id)
            .single();
        if (error || !data)
            return null;
        const embedding = data.vision_embeddings?.[0]
            ? {
                vector: new Float32Array(data.vision_embeddings[0].embedding),
                model: data.vision_embeddings[0].model_version,
                dimension: 512,
            }
            : undefined;
        const memory = {
            id: data.id,
            embedding: embedding,
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
    searchInMemory(queryEmbedding, limit, threshold) {
        const results = [];
        for (const memory of this.memoryCache.values()) {
            if (!memory.embedding)
                continue;
            const similarity = this.cosineSimilarity(queryEmbedding, memory.embedding.vector);
            if (similarity >= threshold) {
                results.push({ memory, similarity });
            }
        }
        return results.sort((a, b) => b.similarity - a.similarity).slice(0, limit);
    }
    cosineSimilarity(a, b) {
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < a.length; i++) {
            const aVal = Number(a[i] ?? 0);
            const bVal = Number(b[i] ?? 0);
            dotProduct += aVal * bVal;
            normA += aVal * aVal;
            normB += bVal * bVal;
        }
        const denom = Math.sqrt(normA) * Math.sqrt(normB);
        return denom > 0 ? dotProduct / denom : 0;
    }
    calculateValidationScore(expected, actual) {
        const expectedObjects = new Set(expected.objects?.map((o) => o.class) || []);
        const actualObjects = new Set(actual.objects?.map((o) => o.class) || []);
        let matches = 0;
        for (const obj of expectedObjects) {
            if (actualObjects.has(String(obj)))
                matches++;
        }
        const precision = expectedObjects.size > 0 ? matches / expectedObjects.size : 0;
        const recall = actualObjects.size > 0 ? matches / actualObjects.size : 0;
        return precision * recall > 0 ? (2 * (precision * recall)) / (precision + recall) : 0;
    }
    generateLearningAdjustment(expected, actual, score) {
        if (score > 0.8) {
            return 'Hypothesis confirmed - maintain current understanding';
        }
        else if (score > 0.5) {
            return 'Partial match - refine object detection thresholds';
        }
        else {
            return 'Hypothesis incorrect - update visual concept mapping';
        }
    }
    calculateLearningDelta(prediction, actual) {
        const predObj = (typeof prediction === 'object' && prediction !== null
            ? prediction
            : {});
        const actObj = (typeof actual === 'object' && actual !== null ? actual : {});
        const predConf = typeof predObj.confidence === 'number' ? predObj.confidence : 0;
        const actConf = typeof actObj.confidence === 'number' ? actObj.confidence : 0;
        return {
            added: this.findDifferences(actual, prediction),
            removed: this.findDifferences(prediction, actual),
            confidence_change: actConf - predConf,
        };
    }
    findDifferences(a, b) {
        const project = (input) => {
            const out = {};
            if (typeof input !== 'object' || input === null)
                return out;
            const src = input;
            if (typeof src.confidence === 'number')
                out.confidence = src.confidence;
            if (Array.isArray(src.objects)) {
                const arr = src.objects
                    .map((o) => {
                    if (o && typeof o === 'object' && typeof o.class === 'string') {
                        return { class: String(o.class) };
                    }
                    return null;
                })
                    .filter(Boolean);
                if (arr.length > 0)
                    out.objects = arr;
            }
            if (Array.isArray(src.labels)) {
                const labels = src.labels.map((v) => String(v));
                if (labels.length > 0)
                    out.labels = labels;
            }
            if (typeof src.path === 'string')
                out.path = src.path;
            if (typeof src.description === 'string')
                out.description = src.description;
            if (typeof src.generatedImage !== 'undefined')
                out.generatedImage = src.generatedImage;
            if (typeof src.expectedOutcome !== 'undefined')
                out.expectedOutcome = src.expectedOutcome;
            if (src.metadata && typeof src.metadata === 'object') {
                out.metadata = src.metadata;
            }
            if (src.imageData && typeof src.imageData === 'object') {
                const id = src.imageData;
                const pathVal = typeof id.path === 'string' ? id.path : undefined;
                out.imageData = { path: pathVal };
            }
            if (typeof src.timestamp === 'string' || src.timestamp instanceof Date) {
                out.timestamp = src.timestamp;
            }
            if (typeof src.concept === 'string')
                out.concept = src.concept;
            return out;
        };
        const A = project(a);
        const B = project(b);
        const result = {};
        const json = (v) => JSON.stringify(v, this.safeStringifyReplacer);
        if (json(A.confidence) !== json(B.confidence))
            result.confidence = A.confidence;
        if (json(A.objects) !== json(B.objects))
            result.objects = A.objects;
        if (json(A.labels) !== json(B.labels))
            result.labels = A.labels;
        if (json(A.path) !== json(B.path))
            result.path = A.path;
        if (json(A.description) !== json(B.description)) {
            result.description = A.description;
        }
        if (json(A.generatedImage) !== json(B.generatedImage)) {
            result.generatedImage = A.generatedImage;
        }
        if (json(A.expectedOutcome) !== json(B.expectedOutcome)) {
            result.expectedOutcome = A.expectedOutcome;
        }
        if (json(A.metadata) !== json(B.metadata))
            result.metadata = A.metadata;
        if (json(A.imageData) !== json(B.imageData))
            result.imageData = A.imageData;
        if (json(A.timestamp) !== json(B.timestamp))
            result.timestamp = A.timestamp;
        if (json(A.concept) !== json(B.concept))
            result.concept = A.concept;
        return result;
    }
    safeStringifyReplacer(_key, value) {
        if (typeof value === 'function')
            return '[Function]';
        if (typeof value === 'symbol')
            return String(value);
        return value;
    }
    mockValidation(hypothesisId, actual) {
        return {
            hypothesis: {
                id: hypothesisId,
                concept: 'mock_concept',
                generatedImage: {},
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
    updateCache(id, memory) {
        if (this.memoryCache.size >= this.maxCacheSize) {
            const firstKey = this.memoryCache.keys().next().value;
            if (firstKey !== undefined) {
                this.memoryCache.delete(firstKey);
            }
        }
        this.memoryCache.set(id, memory);
    }
    async shutdown() {
        log.info('🛑 Shutting down Visual Memory Service', LogContext.MEMORY);
        this.memoryCache.clear();
        this.conceptCache.clear();
    }
}
export const visualMemoryService = new VisualMemoryService();
export default visualMemoryService;
//# sourceMappingURL=visual-memory-service.js.map