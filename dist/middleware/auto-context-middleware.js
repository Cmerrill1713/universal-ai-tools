import { contextInjectionService } from '../services/context-injection-service';
import { enhancedContextManager } from '../services/enhanced-context-manager';
import { semanticContextRetrievalService } from '../services/semantic-context-retrieval';
import { log, LogContext } from '../utils/logger';
export class AutoContextMiddleware {
    options;
    sessions = new Map();
    SESSION_TIMEOUT = 8 * 60 * 60 * 1000;
    cleanupTimer;
    CLEANUP_INTERVAL = 15 * 60 * 1000;
    constructor(options = {}) {
        this.options = options;
        this.options = {
            enableAutoTracking: true,
            enableContextInjection: true,
            enableTokenLimitMonitoring: true,
            maxContextTokens: 32000,
            compressionThreshold: 24000,
            persistenceThreshold: 16000,
            excludeRoutes: ['/health', '/metrics', '/static'],
            includeRoutes: ['/api/v1/agents', '/api/v1/orchestration', '/api/v1/fast-coordinator'],
            ...this.options,
        };
        this.startSessionCleanup();
        log.info('🤖 Auto Context Middleware initialized', LogContext.CONTEXT_INJECTION, {
            autoTracking: this.options.enableAutoTracking,
            contextInjection: this.options.enableContextInjection,
            tokenLimitMonitoring: this.options.enableTokenLimitMonitoring,
            maxTokens: this.options.maxContextTokens,
        });
    }
    middleware() {
        return async (req, res, next) => {
            try {
                if (this.shouldSkipRoute(req.path)) {
                    return next();
                }
                const contextInfo = this.extractContextInfo(req);
                if (!contextInfo) {
                    return next();
                }
                req.contextInfo = contextInfo;
                await this.updateSession(contextInfo);
                if (this.options.enableContextInjection && this.isLLMRequest(req)) {
                    await this.injectContextIntoRequest(req);
                }
                const originalSend = res.send;
                const originalJson = res.json;
                res.send = function (body) {
                    handleResponse(body, 'send');
                    return originalSend.call(this, body);
                };
                res.json = function (obj) {
                    handleResponse(obj, 'json');
                    return originalJson.call(this, obj);
                };
                const handleResponse = async (responseData, method) => {
                    if (req.contextInfo && this.options.enableAutoTracking) {
                        await this.trackResponse(req.contextInfo, req, responseData);
                    }
                };
                next();
            }
            catch (error) {
                log.error('❌ Auto context middleware error', LogContext.CONTEXT_INJECTION, {
                    error: error instanceof Error ? error.message : String(error),
                    path: req.path,
                    method: req.method,
                });
                next();
            }
        };
    }
    extractContextInfo(req) {
        try {
            let userId = 'anonymous';
            if (req.headers.authorization) {
                const authHeader = req.headers.authorization;
                if (authHeader.startsWith('Bearer ')) {
                    userId = 'jwt_user';
                }
            }
            else if (req.headers['x-user-id']) {
                userId = req.headers['x-user-id'];
            }
            else if (req.body?.userId) {
                userId = req.body.userId;
            }
            else if (req.query.userId) {
                userId = req.query.userId;
            }
            let sessionId = req.headers['x-session-id'];
            if (!sessionId) {
                const ip = req.ip || req.connection.remoteAddress || 'unknown';
                const userAgent = req.headers['user-agent'] || 'unknown';
                sessionId = Buffer.from(`${ip}_${userAgent}_${userId}`).toString('base64').substring(0, 16);
            }
            const projectPath = req.headers['x-project-path'] ||
                req.body?.projectPath ||
                req.query.projectPath;
            const workingDirectory = req.headers['x-working-directory'] ||
                req.body?.workingDirectory ||
                req.query.workingDirectory ||
                process.cwd();
            return {
                sessionId,
                userId,
                projectPath,
                workingDirectory,
                conversationId: `conv_${sessionId}_${Date.now()}`,
                contextMetadata: {
                    userAgent: req.headers['user-agent'],
                    ip: req.ip,
                    method: req.method,
                    path: req.path,
                    timestamp: new Date().toISOString(),
                },
            };
        }
        catch (error) {
            log.error('❌ Failed to extract context info', LogContext.CONTEXT_INJECTION, {
                error: error instanceof Error ? error.message : String(error),
            });
            return null;
        }
    }
    async updateSession(contextInfo) {
        try {
            const sessionKey = `${contextInfo.sessionId}_${contextInfo.userId}`;
            let session = this.sessions.get(sessionKey);
            if (!session) {
                session = {
                    sessionId: contextInfo.sessionId,
                    userId: contextInfo.userId,
                    lastActivity: new Date(),
                    messageCount: 0,
                    totalTokens: 0,
                    compressionLevel: 0,
                    metadata: contextInfo.contextMetadata || {},
                };
                this.sessions.set(sessionKey, session);
                log.info('🆕 New context session created', LogContext.CONTEXT_INJECTION, {
                    sessionId: contextInfo.sessionId,
                    userId: contextInfo.userId,
                });
            }
            session.lastActivity = new Date();
            session.metadata = { ...session.metadata, ...contextInfo.contextMetadata };
        }
        catch (error) {
            log.error('❌ Failed to update session', LogContext.CONTEXT_INJECTION, {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    async injectContextIntoRequest(req) {
        try {
            if (!req.contextInfo)
                return;
            const userRequest = this.extractUserRequest(req);
            if (!userRequest)
                return;
            log.info('💉 Injecting context into LLM request', LogContext.CONTEXT_INJECTION, {
                sessionId: req.contextInfo.sessionId,
                userId: req.contextInfo.userId,
                requestLength: userRequest.length,
            });
            const contextResults = await semanticContextRetrievalService.semanticSearch({
                query: userRequest,
                userId: req.contextInfo.userId,
                sessionId: req.contextInfo.sessionId,
                projectPath: req.contextInfo.projectPath,
                maxResults: 10,
                timeWindow: 24,
                fuseSimilarResults: true,
            });
            const enrichmentResult = await contextInjectionService.enrichWithContext(userRequest, {
                userId: req.contextInfo.userId,
                sessionId: req.contextInfo.sessionId,
                workingDirectory: req.contextInfo.workingDirectory,
                currentProject: req.contextInfo.projectPath,
                includeArchitecturePatterns: true,
            });
            req.originalBody = { ...req.body };
            req.enhancedBody = {
                originalRequest: userRequest,
                enrichedPrompt: enrichmentResult.enrichedPrompt,
                contextSummary: enrichmentResult.contextSummary,
                sourcesUsed: enrichmentResult.sourcesUsed,
                tokenCount: contextResults.results.reduce((sum, r) => sum + r.metadata.tokenCount, 0),
            };
            this.updateRequestWithEnrichedContent(req, enrichmentResult.enrichedPrompt);
            log.info('✅ Context injection completed', LogContext.CONTEXT_INJECTION, {
                sessionId: req.contextInfo.sessionId,
                sourcesUsed: enrichmentResult.sourcesUsed.length,
                contextTokens: req.enhancedBody.tokenCount,
                semanticResults: contextResults.results.length,
            });
        }
        catch (error) {
            log.error('❌ Context injection failed', LogContext.CONTEXT_INJECTION, {
                error: error instanceof Error ? error.message : String(error),
                sessionId: req.contextInfo?.sessionId,
            });
        }
    }
    async trackResponse(contextInfo, req, responseData) {
        try {
            const userMessage = this.extractUserRequest(req);
            if (userMessage) {
                await enhancedContextManager.addMessage(contextInfo.sessionId, {
                    role: 'user',
                    content: userMessage,
                    metadata: {
                        userId: contextInfo.userId,
                        projectPath: contextInfo.projectPath,
                        endpoint: req.path,
                        method: req.method,
                    },
                });
            }
            const assistantMessage = this.extractAssistantResponse(responseData);
            if (assistantMessage) {
                const result = await enhancedContextManager.addMessage(contextInfo.sessionId, {
                    role: 'assistant',
                    content: assistantMessage,
                    metadata: {
                        userId: contextInfo.userId,
                        projectPath: contextInfo.projectPath,
                        endpoint: req.path,
                        method: req.method,
                        responseTime: Date.now() - (req.contextInfo?.contextMetadata?.startTime || Date.now()),
                    },
                });
                const sessionKey = `${contextInfo.sessionId}_${contextInfo.userId}`;
                const session = this.sessions.get(sessionKey);
                if (session) {
                    session.messageCount += 2;
                    session.totalTokens = result.tokenCount;
                    if (this.options.enableTokenLimitMonitoring &&
                        result.tokenCount > (this.options.compressionThreshold || 6000)) {
                        log.info('🗜️ Context compression recommended', LogContext.CONTEXT_INJECTION, {
                            sessionId: contextInfo.sessionId,
                            currentTokens: result.tokenCount,
                            threshold: this.options.compressionThreshold,
                        });
                    }
                }
                log.debug('📝 Conversation tracked', LogContext.CONTEXT_INJECTION, {
                    sessionId: contextInfo.sessionId,
                    messageCount: session?.messageCount || 0,
                    totalTokens: result.tokenCount,
                    shouldCompress: result.shouldCompress,
                });
            }
        }
        catch (error) {
            log.error('❌ Response tracking failed', LogContext.CONTEXT_INJECTION, {
                error: error instanceof Error ? error.message : String(error),
                sessionId: contextInfo.sessionId,
            });
        }
    }
    extractUserRequest(req) {
        try {
            const { body } = req;
            if (typeof body === 'string')
                return body;
            if (body?.prompt)
                return body.prompt;
            if (body?.message)
                return body.message;
            if (body?.query)
                return body.query;
            if (body?.request)
                return body.request;
            if (body?.input)
                return body.input;
            if (body?.text)
                return body.text;
            if (body?.content)
                return body.content;
            if (body?.task)
                return body.task;
            if (body?.instruction)
                return body.instruction;
            if (body?.userRequest)
                return body.userRequest;
            if (body?.messages && Array.isArray(body.messages)) {
                const lastMessage = body.messages[body.messages.length - 1];
                if (lastMessage?.content)
                    return lastMessage.content;
            }
            return null;
        }
        catch (error) {
            return null;
        }
    }
    extractAssistantResponse(responseData) {
        try {
            if (typeof responseData === 'string')
                return responseData;
            if (responseData?.response)
                return responseData.response;
            if (responseData?.result)
                return responseData.result;
            if (responseData?.output)
                return responseData.output;
            if (responseData?.content)
                return responseData.content;
            if (responseData?.message)
                return responseData.message;
            if (responseData?.text)
                return responseData.text;
            if (responseData?.answer)
                return responseData.answer;
            if (responseData?.agentResponse)
                return responseData.agentResponse;
            if (responseData?.synthesis)
                return responseData.synthesis;
            if (responseData?.analysis)
                return responseData.analysis;
            if (responseData?.success && responseData?.data) {
                return JSON.stringify(responseData.data, null, 2);
            }
            return null;
        }
        catch (error) {
            return null;
        }
    }
    updateRequestWithEnrichedContent(req, enrichedPrompt) {
        try {
            const { body } = req;
            if (body?.prompt) {
                body.prompt = enrichedPrompt;
            }
            else if (body?.message) {
                body.message = enrichedPrompt;
            }
            else if (body?.query) {
                body.query = enrichedPrompt;
            }
            else if (body?.request) {
                body.request = enrichedPrompt;
            }
            else if (body?.input) {
                body.input = enrichedPrompt;
            }
            else if (body?.text) {
                body.text = enrichedPrompt;
            }
            else if (body?.content) {
                body.content = enrichedPrompt;
            }
            else if (body?.task) {
                body.task = enrichedPrompt;
            }
            else if (body?.instruction) {
                body.instruction = enrichedPrompt;
            }
            else if (body?.userRequest) {
                body.userRequest = enrichedPrompt;
            }
            else if (body?.messages && Array.isArray(body.messages)) {
                const lastMessage = body.messages[body.messages.length - 1];
                if (lastMessage && lastMessage.role === 'user') {
                    lastMessage.content = enrichedPrompt;
                }
                else {
                    body.messages.push({
                        role: 'user',
                        content: enrichedPrompt,
                    });
                }
            }
            else {
                body.enrichedPrompt = enrichedPrompt;
            }
        }
        catch (error) {
            log.error('❌ Failed to update request with enriched content', LogContext.CONTEXT_INJECTION, {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    isLLMRequest(req) {
        const path = req.path.toLowerCase();
        const { body } = req;
        const llmEndpoints = [
            '/api/v1/agents',
            '/api/v1/orchestration',
            '/api/v1/fast-coordinator',
            '/api/v1/ab-mcts',
            '/api/v1/mlx',
            '/chat',
            '/complete',
            '/generate',
        ];
        const isLLMEndpoint = llmEndpoints.some((endpoint) => path.includes(endpoint));
        const hasLLMContent = body &&
            (body.prompt ||
                body.message ||
                body.query ||
                body.task ||
                body.instruction ||
                body.messages ||
                body.userRequest);
        return isLLMEndpoint && hasLLMContent;
    }
    shouldSkipRoute(path) {
        const excludeRoutes = this.options.excludeRoutes || [];
        const includeRoutes = this.options.includeRoutes || [];
        if (excludeRoutes.some((route) => path.startsWith(route))) {
            return true;
        }
        if (includeRoutes.length > 0) {
            return !includeRoutes.some((route) => path.startsWith(route));
        }
        return false;
    }
    startSessionCleanup() {
        this.cleanupTimer = setInterval(() => {
            this.cleanupExpiredSessions();
        }, this.CLEANUP_INTERVAL);
    }
    cleanupExpiredSessions() {
        const now = Date.now();
        let cleanedCount = 0;
        this.sessions.forEach((session, key) => {
            if (now - session.lastActivity.getTime() > this.SESSION_TIMEOUT) {
                this.sessions.delete(key);
                cleanedCount++;
            }
        });
        if (cleanedCount > 0) {
            log.info('🧹 Cleaned up expired sessions', LogContext.CONTEXT_INJECTION, {
                cleanedCount,
                activeSessions: this.sessions.size,
            });
        }
    }
    getStats() {
        let totalMessages = 0;
        let totalTokens = 0;
        let totalCompression = 0;
        this.sessions.forEach((session) => {
            totalMessages += session.messageCount;
            totalTokens += session.totalTokens;
            totalCompression += session.compressionLevel;
        });
        const sessionCount = this.sessions.size;
        return {
            activeSessions: sessionCount,
            totalMessages,
            averageTokensPerSession: sessionCount > 0 ? totalTokens / sessionCount : 0,
            compressionRate: sessionCount > 0 ? totalCompression / sessionCount : 0,
        };
    }
    cleanupSession(sessionId, userId) {
        const sessionKey = `${sessionId}_${userId}`;
        return this.sessions.delete(sessionKey);
    }
    getSession(sessionId, userId) {
        const sessionKey = `${sessionId}_${userId}`;
        return this.sessions.get(sessionKey) || null;
    }
    shutdown() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = undefined;
        }
        this.sessions.clear();
        log.info('🛑 Auto Context Middleware shutdown complete', LogContext.CONTEXT_INJECTION);
    }
}
export const autoContextMiddleware = new AutoContextMiddleware();
export const contextMiddleware = autoContextMiddleware.middleware();
export default contextMiddleware;
//# sourceMappingURL=auto-context-middleware.js.map