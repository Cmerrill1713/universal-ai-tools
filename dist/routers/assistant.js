import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { zodValidate } from '@/middleware/zod-validate';
import { authenticate } from '../middleware/auth.js';
import { contextStorageService } from '../services/context-storage-service.js';
import { dspyService } from '../services/dspy-service.js';
import { ollamaService } from '../services/ollama-service.js';
import { semanticContextRetrievalService } from '../services/semantic-context-retrieval.js';
import { unifiedModelService } from '../services/unified-model-service.js';
import { log, LogContext } from '../utils/logger.js';
const router = Router();
router.get('/status', (req, res) => {
    res.json({ status: 'ok', routes: ['POST /chat'] });
});
router.post('/chat', authenticate, zodValidate(z.object({
    message: z.string().min(1, 'message is required'),
    sessionId: z.string().optional(),
    projectPath: z.string().optional(),
    maxContext: z.number().int().min(1).max(25).optional(),
})), async (req, res) => {
    const requestId = req.headers['x-request-id'] || uuidv4();
    const startTime = Date.now();
    try {
        const userId = req.user?.id || 'anonymous';
        const { message, sessionId, projectPath, maxContext = 8, } = req.body;
        const retrieval = await semanticContextRetrievalService.semanticSearch({
            query: message,
            userId,
            sessionId,
            projectPath,
            maxResults: Math.min(Math.max(Number(maxContext) || 8, 1), 25),
            fuseSimilarResults: true,
        });
        const topContext = retrieval.results
            .slice(0, Math.min(Math.max(Number(maxContext) || 8, 1), 25))
            .map((r) => `- (${r.contentType}) ${r.content}`)
            .join('\n');
        const systemPreamble = 'You are a helpful AI assistant. Use the following retrieved project context when it is relevant. If context is not relevant, proceed normally.';
        const contextBlock = topContext
            ? `\n\nRetrieved context (may be relevant):\n${topContext}\n\n`
            : '';
        const messages = [
            { role: 'system', content: systemPreamble + contextBlock },
            { role: 'user', content: message },
        ];
        const shouldUseDSPy = (() => {
            try {
                const lowContext = (retrieval.results?.length || 0) < Math.min(maxContext, 3);
                const complexHint = /plan|orchestrate|optimize|strategy|pipeline|agents?/i.test(message);
                return dspyService.isReady() && (lowContext || complexHint);
            }
            catch {
                return false;
            }
        })();
        let assistantText = '';
        try {
            if (shouldUseDSPy) {
                try {
                    const dsp = await dspyService.orchestrate({
                        userRequest: message,
                        userId,
                        context: {
                            projectPath,
                            sessionId: sessionId || null,
                            retrievalPreview: retrieval.results?.slice(0, 5) || [],
                        },
                    });
                    const dspText = dsp?.data?.response || dsp?.response;
                    if (typeof dspText === 'string' && dspText.trim().length > 0) {
                        assistantText = dspText;
                    }
                }
                catch (dspErr) {
                    log.warn('DSPy orchestration not available, falling back to Ollama', LogContext.DSPY, {
                        error: dspErr instanceof Error ? dspErr.message : String(dspErr),
                    });
                }
            }
            if (!assistantText) {
                try {
                    const unifiedResponse = await unifiedModelService.generate({
                        prompt: message,
                        systemPrompt: systemPreamble + contextBlock,
                        taskType: 'conversation',
                        priority: 'balanced',
                        maxTokens: 2048,
                        temperature: 0.7,
                    });
                    assistantText = unifiedResponse.content || '';
                    log.info('Assistant used model', LogContext.AI, {
                        model: unifiedResponse.model.id,
                        provider: unifiedResponse.model.provider,
                        latency: unifiedResponse.metrics.latencyMs,
                        tokensPerSecond: unifiedResponse.metrics.tokensPerSecond,
                    });
                    if (!assistantText || assistantText.length < 10) {
                        assistantText = "I'm a versatile AI assistant that can help you with:\n\n" +
                            "• Code generation and debugging\n" +
                            "• Text analysis and summarization\n" +
                            "• Data processing and analysis\n" +
                            "• Research and information gathering\n" +
                            "• Creative writing and content generation\n" +
                            "• Problem-solving and brainstorming\n\n" +
                            "Feel free to ask me anything!";
                    }
                }
                catch (error) {
                    log.warn('Unified model service error, falling back to Ollama directly', LogContext.AI, { error });
                    try {
                        const llmResponse = await ollamaService.generateResponse(messages);
                        assistantText = llmResponse?.message?.content || '';
                    }
                    catch (ollamaError) {
                        log.warn('Ollama error, using fallback', LogContext.AI, { error: ollamaError });
                        assistantText = "I'm here to help! I can assist with coding, analysis, writing, and many other tasks. What would you like to work on?";
                    }
                }
            }
            try {
                const { checkAndCorrectFactuality } = await import('../services/factuality-guard.js');
                const fact = await checkAndCorrectFactuality(assistantText, message, {
                    userId,
                    requestId,
                    projectPath,
                });
                assistantText = fact.content;
            }
            catch { }
        }
        catch (llmError) {
            log.warn('LLM unavailable, returning fallback response', LogContext.AI, {
                error: llmError instanceof Error ? llmError.message : String(llmError),
            });
            const enableLookup = String(process.env.ASSISTANT_FALLBACK_LOOKUP || 'false') === 'true';
            if (enableLookup) {
                try {
                    const { verifiedFactsService } = await import('../services/verified-facts-service.js');
                    const cached = await verifiedFactsService.findFact(message);
                    if (cached) {
                        assistantText = cached.answer;
                    }
                    else {
                        const { webSearchService } = await import('../services/web-search-service.js');
                        const hits = await webSearchService.searchDuckDuckGo(message, 3);
                        if (hits.length > 0) {
                            const cite = hits
                                .map((r, i) => `(${i + 1}) ${r.title} - ${r.url}`)
                                .join('\n');
                            assistantText = `Here are authoritative sources I found:\n\n${cite}`;
                        }
                        else {
                            assistantText =
                                'Assistant is initializing. Context has been retrieved and stored. Please try again shortly.';
                        }
                    }
                }
                catch {
                    assistantText =
                        'Assistant is initializing. Context has been retrieved and stored. Please try again shortly.';
                }
            }
            else {
                assistantText =
                    'Assistant is initializing. Context has been retrieved and stored. Please try again shortly.';
            }
        }
        const transcript = `Q: ${message}\nA: ${assistantText}`;
        await contextStorageService.storeConversation(userId, transcript, 'assistant_chat', projectPath);
        const durationMs = Date.now() - startTime;
        return res.json({
            success: true,
            data: {
                response: assistantText,
                contextUsed: retrieval.results.length,
                clusters: retrieval.clusters?.clusters?.length ?? 0,
                conversationStored: true,
            },
            metadata: {
                requestId,
                timestamp: new Date().toISOString(),
                durationMs,
            },
        });
    }
    catch (error) {
        log.error('Assistant chat failed', LogContext.API, {
            error: error instanceof Error ? error.message : String(error),
            requestId,
        });
        return res.status(500).json({
            success: false,
            error: {
                code: 'ASSISTANT_CHAT_ERROR',
                message: error instanceof Error ? error.message : 'Failed to process assistant request',
            },
            metadata: {
                requestId,
                timestamp: new Date().toISOString(),
            },
        });
    }
});
export default router;
//# sourceMappingURL=assistant.js.map