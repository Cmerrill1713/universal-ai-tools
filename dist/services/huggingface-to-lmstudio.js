import { ModelConfig } from '../config/models';
import { log, LogContext } from '../utils/logger';
export class HuggingFaceToLMStudioAdapter {
    baseUrl;
    constructor() {
        this.baseUrl = ModelConfig.lmStudio.url;
    }
    async generateText(request) {
        const lmStudioRequest = {
            model: request.model || ModelConfig.lmStudio.models.textGeneration,
            messages: [{ role: 'user', content: request.inputs }],
            temperature: request.parameters?.temperature || 0.7,
            max_tokens: request.parameters?.max_new_tokens || 500,
        };
        try {
            const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(lmStudioRequest),
            });
            if (!response.ok) {
                throw new Error(`LM Studio error: ${response.statusText}`);
            }
            const data = await response.json();
            return [
                {
                    generated_text: data.choices[0]?.message?.content || data.choices[0]?.text || '',
                },
            ];
        }
        catch (error) {
            log.error('LM Studio text generation failed', LogContext.AI, { error });
            throw error;
        }
    }
    async generateEmbeddings(request) {
        const input = Array.isArray(request.inputs) ? request.inputs : [request.inputs];
        try {
            const response = await fetch(`${this.baseUrl}/v1/embeddings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: request.model || ModelConfig.lmStudio.models.embedding,
                    input,
                }),
            });
            if (!response.ok) {
                throw new Error(`LM Studio error: ${response.statusText}`);
            }
            const data = await response.json();
            return data.data.map((item) => item.embedding);
        }
        catch (error) {
            log.error('LM Studio embedding generation failed', LogContext.AI, { error });
            throw error;
        }
    }
    async summarizeText(request) {
        const prompt = `Please summarize the following text concisely:\n\n${request.inputs}\n\nSummary:`;
        const lmStudioRequest = {
            model: request.model || ModelConfig.lmStudio.models.summarization,
            messages: [{ role: 'user', content: prompt }],
            temperature: request.parameters?.temperature || 0.5,
            max_tokens: request.parameters?.max_length || 200,
        };
        try {
            const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(lmStudioRequest),
            });
            if (!response.ok) {
                throw new Error(`LM Studio error: ${response.statusText}`);
            }
            const data = await response.json();
            return [
                {
                    summary_text: data.choices[0]?.message?.content || '',
                },
            ];
        }
        catch (error) {
            log.error('LM Studio summarization failed', LogContext.AI, { error });
            throw error;
        }
    }
    async analyzeSentiment(text, model) {
        const prompt = `Analyze the sentiment of the following text and respond with only one word: POSITIVE, NEGATIVE, or NEUTRAL.\n\nText: "${text}"\n\nSentiment:`;
        const lmStudioRequest = {
            model: model || ModelConfig.lmStudio.models.sentiment,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.1,
            max_tokens: 10,
        };
        try {
            const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(lmStudioRequest),
            });
            if (!response.ok) {
                throw new Error(`LM Studio error: ${response.statusText}`);
            }
            const data = await response.json();
            const sentiment = (data.choices[0]?.message?.content || '').trim().toUpperCase();
            const scores = {
                POSITIVE: sentiment === 'POSITIVE' ? 0.9 : 0.05,
                NEGATIVE: sentiment === 'NEGATIVE' ? 0.9 : 0.05,
                NEUTRAL: sentiment === 'NEUTRAL' ? 0.9 : 0.05,
            };
            return [
                {
                    label: sentiment,
                    score: scores[sentiment] || 0.33,
                },
            ];
        }
        catch (error) {
            log.error('LM Studio sentiment analysis failed', LogContext.AI, { error });
            throw error;
        }
    }
    async answerQuestion(request) {
        const prompt = `Based on the following context, answer the question.\n\nContext: ${request.context}\n\nQuestion: ${request.question}\n\nAnswer:`;
        const lmStudioRequest = {
            model: request.model || ModelConfig.lmStudio.models.textGeneration,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
            max_tokens: 200,
        };
        try {
            const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(lmStudioRequest),
            });
            if (!response.ok) {
                throw new Error(`LM Studio error: ${response.statusText}`);
            }
            const data = await response.json();
            return {
                answer: data.choices[0]?.message?.content || '',
                score: 0.85,
                start: 0,
                end: request.context.length,
            };
        }
        catch (error) {
            log.error('LM Studio question answering failed', LogContext.AI, { error });
            throw error;
        }
    }
    async healthCheck() {
        try {
            const response = await fetch(`${this.baseUrl}/v1/models`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
            });
            if (!response.ok) {
                throw new Error(`LM Studio not available: ${response.statusText}`);
            }
            const data = await response.json();
            return {
                status: 'healthy',
                models: data.data?.map((m) => m.id) || [],
                baseUrl: this.baseUrl,
                adapter: 'huggingface-to-lmstudio',
            };
        }
        catch (error) {
            return {
                status: 'unhealthy',
                error: error instanceof Error ? error.message : String(error),
                baseUrl: this.baseUrl,
                adapter: 'huggingface-to-lmstudio',
            };
        }
    }
    getMetrics() {
        return {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            averageResponseTime: 100,
            modelsUsed: new Set(['lm-studio']),
            lastRequestTime: Date.now(),
        };
    }
    async listModels() {
        try {
            const response = await fetch(`${this.baseUrl}/v1/models`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
            });
            if (!response.ok) {
                throw new Error(`Failed to list models: ${response.statusText}`);
            }
            const data = await response.json();
            return data.data?.map((m) => m.id) || [];
        }
        catch (error) {
            log.error('Failed to list LM Studio models', LogContext.AI, { error });
            return [];
        }
    }
}
export const huggingFaceService = ModelConfig.lmStudio.enabled
    ? new HuggingFaceToLMStudioAdapter()
    : null;
log.info(huggingFaceService
    ? '✅ HuggingFace requests will be routed to LM Studio'
    : '⚠️ LM Studio disabled, HuggingFace functionality unavailable', LogContext.AI);
//# sourceMappingURL=huggingface-to-lmstudio.js.map