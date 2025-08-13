import { createClient } from '@supabase/supabase-js';
import { config } from '../config/environment';
import { log, LogContext } from '../utils/logger';
import { contextStorageService } from './context-storage-service';
export class EnhancedContextManager {
    supabase;
    activeContexts = new Map();
    MAX_ACTIVE_CONTEXTS = parseInt(process.env.CTX_MAX_ACTIVE || '50', 10);
    DEFAULT_TOKEN_LIMIT = parseInt(process.env.CTX_MAX_TOKENS || '32000', 10);
    COMPRESSION_TRIGGER = parseInt(process.env.CTX_COMPRESSION_TRIGGER ||
        Math.floor((this.DEFAULT_TOKEN_LIMIT * 3) / 4).toString(), 10);
    PERSISTENCE_TRIGGER = parseInt(process.env.CTX_PERSISTENCE_TRIGGER || Math.floor(this.DEFAULT_TOKEN_LIMIT / 2).toString(), 10);
    CLEANUP_INTERVAL = parseInt(process.env.CTX_CLEANUP_INTERVAL_MS || (30 * 60 * 1000).toString(), 10);
    MAX_TOKENS_PER_SESSION = parseInt(process.env.SESSION_MAX_TOKENS || '64000', 10);
    MAX_MESSAGES_PER_SESSION = parseInt(process.env.SESSION_MAX_MESSAGES || '1000', 10);
    SESSION_ISOLATION_ENABLED = (process.env.SESSION_ISOLATION_ENABLED || 'true') === 'true';
    IMPORTANCE_WEIGHTS = {
        user_question: 0.9,
        assistant_answer: 0.7,
        error_message: 0.8,
        code_block: 0.6,
        system_message: 0.3,
    };
    cleanupTimer;
    constructor() {
        this.supabase = createClient(config.supabase.url, config.supabase.serviceKey);
        this.startBackgroundCleanup();
        log.info('🧠 Enhanced Context Manager initialized', LogContext.CONTEXT_INJECTION, {
            maxActiveContexts: this.MAX_ACTIVE_CONTEXTS,
            tokenLimit: this.DEFAULT_TOKEN_LIMIT,
            compressionTrigger: this.COMPRESSION_TRIGGER,
        });
    }
    async addMessage(sessionId, message) {
        try {
            const contextId = this.getContextId(sessionId, message.metadata?.userId || 'anonymous');
            let context = this.activeContexts.get(contextId);
            if (!context) {
                context = await this.initializeContext(contextId, sessionId, message.metadata?.userId);
            }
            const tokens = this.estimateTokens(message.content);
            const importance = this.calculateMessageImportance(message);
            if (this.SESSION_ISOLATION_ENABLED) {
                const sessionTokens = context.totalTokens + tokens;
                const sessionMessages = context.messages.length + 1;
                if (sessionTokens > this.MAX_TOKENS_PER_SESSION) {
                    await this.compressContext(context);
                    log.info('🔧 Session context compressed due to token limit', LogContext.CONTEXT_INJECTION, {
                        contextId,
                        sessionTokens,
                        maxTokens: this.MAX_TOKENS_PER_SESSION,
                    });
                }
                if (sessionMessages > this.MAX_MESSAGES_PER_SESSION) {
                    const messagesToRemove = sessionMessages - this.MAX_MESSAGES_PER_SESSION;
                    context.messages = context.messages.slice(messagesToRemove);
                    context.totalTokens = context.messages.reduce((sum, msg) => sum + msg.tokens, 0);
                    log.info('🔧 Session context trimmed due to message limit', LogContext.CONTEXT_INJECTION, {
                        contextId,
                        sessionMessages,
                        maxMessages: this.MAX_MESSAGES_PER_SESSION,
                        removedMessages: messagesToRemove,
                    });
                }
            }
            const fullMessage = {
                ...message,
                timestamp: new Date(),
                tokens,
                importance,
            };
            context.messages.push(fullMessage);
            context.totalTokens += tokens;
            context.lastAccessed = new Date();
            log.debug('📝 Message added to context', LogContext.CONTEXT_INJECTION, {
                contextId,
                role: message.role,
                tokens,
                importance: importance.toFixed(2),
                totalTokens: context.totalTokens,
            });
            const shouldCompress = context.totalTokens > this.COMPRESSION_TRIGGER;
            const shouldPersist = context.totalTokens > this.PERSISTENCE_TRIGGER;
            if (shouldPersist) {
                await this.persistContextToDatabase(context);
            }
            if (shouldCompress) {
                await this.compressContext(context);
            }
            this.activeContexts.set(contextId, context);
            return {
                contextId,
                shouldCompress,
                tokenCount: context.totalTokens,
            };
        }
        catch (error) {
            log.error('❌ Failed to add message to context', LogContext.CONTEXT_INJECTION, {
                error: error instanceof Error ? error.message : String(error),
                sessionId,
            });
            throw error;
        }
    }
    async getRelevantContext(sessionId, userId, options = {}) {
        try {
            const { maxTokens = this.DEFAULT_TOKEN_LIMIT, relevanceThreshold = 0.3, includeRecentMessages = true, includeSummaries = true, timeWindow = 24, } = options;
            const contextId = this.getContextId(sessionId, userId);
            let context = this.activeContexts.get(contextId);
            let source = 'memory';
            if (!context) {
                context = (await this.loadContextFromDatabase(contextId, userId, timeWindow)) || undefined;
                source = context ? 'database' : 'memory';
            }
            let messages = [];
            let summaries = [];
            let totalTokens = 0;
            if (context) {
                if (includeRecentMessages) {
                    messages = context.messages
                        .filter((msg) => msg.importance >= relevanceThreshold)
                        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
                        .slice(0, 50);
                    totalTokens = messages.reduce((sum, msg) => sum + msg.tokens, 0);
                }
                if (totalTokens > maxTokens && includeSummaries) {
                    summaries = await this.getContextSummaries(userId, sessionId, timeWindow);
                    const summaryTokens = summaries.reduce((sum, s) => sum + s.compressedTokens, 0);
                    if (summaryTokens < totalTokens) {
                        source = context ? 'hybrid' : 'database';
                        const remainingTokens = maxTokens - summaryTokens;
                        messages = this.selectMessagesByTokenBudget(messages, remainingTokens);
                        totalTokens = summaryTokens + messages.reduce((sum, msg) => sum + msg.tokens, 0);
                    }
                }
            }
            if (messages.length === 0 && summaries.length === 0) {
                const dbContext = await this.searchDatabaseContext(userId, sessionId, options);
                messages = dbContext.messages;
                summaries = dbContext.summaries;
                totalTokens = dbContext.totalTokens;
                source = 'database';
            }
            log.info('🔍 Context retrieved successfully', LogContext.CONTEXT_INJECTION, {
                contextId,
                messagesCount: messages.length,
                summariesCount: summaries.length,
                totalTokens,
                source,
                userId,
            });
            return { messages, summaries, totalTokens, source };
        }
        catch (error) {
            log.error('❌ Failed to retrieve context', LogContext.CONTEXT_INJECTION, {
                error: error instanceof Error ? error.message : String(error),
                sessionId,
                userId,
            });
            return { messages: [], summaries: [], totalTokens: 0, source: 'memory' };
        }
    }
    async compressContext(context) {
        try {
            log.info('🗜️ Compressing context', LogContext.CONTEXT_INJECTION, {
                contextId: context.id,
                beforeTokens: context.totalTokens,
                beforeMessages: context.messages.length,
            });
            const sortedMessages = [...context.messages].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
            const now = Date.now();
            const oneHourAgo = now - 60 * 60 * 1000;
            const recentMessages = sortedMessages.filter((msg) => msg.timestamp.getTime() > oneHourAgo || msg.importance > 0.7);
            const compressibleMessages = sortedMessages.filter((msg) => msg.timestamp.getTime() <= oneHourAgo && msg.importance <= 0.7);
            if (compressibleMessages.length > 5) {
                const summary = await this.createMessageSummary(compressibleMessages, context.metadata);
                await this.storeContextSummary(summary, context.metadata);
                context.messages = recentMessages;
                context.totalTokens = recentMessages.reduce((sum, msg) => sum + msg.tokens, 0);
                context.compressionLevel = Math.min(context.compressionLevel + 0.1, 1.0);
                log.info('✅ Context compressed successfully', LogContext.CONTEXT_INJECTION, {
                    contextId: context.id,
                    afterTokens: context.totalTokens,
                    afterMessages: context.messages.length,
                    compressedMessages: compressibleMessages.length,
                    compressionLevel: context.compressionLevel.toFixed(2),
                });
            }
        }
        catch (error) {
            log.error('❌ Context compression failed', LogContext.CONTEXT_INJECTION, {
                error: error instanceof Error ? error.message : String(error),
                contextId: context.id,
            });
        }
    }
    async createMessageSummary(messages, metadata) {
        try {
            const combinedContent = messages.map((msg) => `${msg.role}: ${msg.content}`).join('\n');
            const originalTokens = messages.reduce((sum, msg) => sum + msg.tokens, 0);
            const keyPoints = this.extractKeyPoints(messages);
            const summaryContent = `Summary of ${messages.length} messages (${new Date(messages[0]?.timestamp || Date.now()).toLocaleString()} - ${new Date(messages[messages.length - 1]?.timestamp || Date.now()).toLocaleString()}):
Key Points: ${keyPoints.join(', ')}
Discussion Topics: ${this.extractTopics(messages).join(', ')}`;
            const compressedTokens = this.estimateTokens(summaryContent);
            return {
                content: summaryContent,
                originalTokens,
                compressedTokens,
                compressionRatio: compressedTokens / originalTokens,
                keyPoints,
                preservedMessages: messages.filter((msg) => msg.importance > 0.8).length,
                timestamp: new Date(),
            };
        }
        catch (error) {
            log.error('❌ Summary creation failed', LogContext.CONTEXT_INJECTION, {
                error: error instanceof Error ? error.message : String(error),
            });
            return {
                content: `Summary of ${messages.length} messages from conversation`,
                originalTokens: messages.reduce((sum, msg) => sum + msg.tokens, 0),
                compressedTokens: 20,
                compressionRatio: 0.1,
                keyPoints: ['conversation occurred'],
                preservedMessages: 0,
                timestamp: new Date(),
            };
        }
    }
    extractKeyPoints(messages) {
        const keyPoints = [];
        const questionWords = ['what', 'how', 'why', 'when', 'where', 'which'];
        const actionWords = ['create', 'build', 'implement', 'fix', 'update', 'add', 'remove'];
        messages.forEach((msg) => {
            if (msg.role === 'user') {
                const sentences = msg.content.split(/[.!?]+/);
                sentences.forEach((sentence) => {
                    const lowerSentence = sentence.toLowerCase();
                    if (questionWords.some((word) => lowerSentence.includes(word)) ||
                        actionWords.some((word) => lowerSentence.includes(word))) {
                        const cleaned = sentence.trim();
                        if (cleaned.length > 10 && cleaned.length < 100) {
                            keyPoints.push(cleaned);
                        }
                    }
                });
            }
        });
        return keyPoints.slice(0, 5);
    }
    extractTopics(messages) {
        const topics = new Set();
        const techKeywords = [
            'api',
            'database',
            'server',
            'client',
            'frontend',
            'backend',
            'typescript',
            'javascript',
            'python',
            'react',
            'node',
            'supabase',
            'redis',
            'authentication',
            'authorization',
            'error',
            'bug',
            'feature',
            'implementation',
            'testing',
        ];
        messages.forEach((msg) => {
            const content = msg.content.toLowerCase();
            techKeywords.forEach((keyword) => {
                if (content.includes(keyword)) {
                    topics.add(keyword);
                }
            });
        });
        return Array.from(topics).slice(0, 8);
    }
    async persistContextToDatabase(context) {
        try {
            await contextStorageService.storeConversation(context.metadata.userId, JSON.stringify(context.messages, null, 2), `session_${context.metadata.sessionId}`, context.metadata.projectPath);
            log.info('💾 Context persisted to database', LogContext.CONTEXT_INJECTION, {
                contextId: context.id,
                messagesCount: context.messages.length,
                totalTokens: context.totalTokens,
            });
        }
        catch (error) {
            log.error('❌ Context persistence failed', LogContext.CONTEXT_INJECTION, {
                error: error instanceof Error ? error.message : String(error),
                contextId: context.id,
            });
        }
    }
    async storeContextSummary(summary, metadata) {
        try {
            await contextStorageService.storeContext({
                content: summary.content,
                category: 'conversation',
                source: `summary_${metadata.sessionId}`,
                userId: metadata.userId,
                projectPath: metadata.projectPath,
                metadata: {
                    summaryType: 'compressed_conversation',
                    originalTokens: summary.originalTokens,
                    compressedTokens: summary.compressedTokens,
                    compressionRatio: summary.compressionRatio,
                    keyPoints: summary.keyPoints,
                    preservedMessages: summary.preservedMessages,
                    timestamp: summary.timestamp.toISOString(),
                },
            });
            log.info('📋 Context summary stored', LogContext.CONTEXT_INJECTION, {
                originalTokens: summary.originalTokens,
                compressedTokens: summary.compressedTokens,
                compressionRatio: summary.compressionRatio.toFixed(2),
            });
        }
        catch (error) {
            log.error('❌ Summary storage failed', LogContext.CONTEXT_INJECTION, {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    async loadContextFromDatabase(contextId, userId, timeWindowHours = 24) {
        try {
            const recentContext = await contextStorageService.getContext(userId, 'conversation', undefined, 20);
            if (recentContext.length === 0)
                return null;
            const messages = [];
            const cutoffTime = Date.now() - timeWindowHours * 60 * 60 * 1000;
            for (const context of recentContext) {
                try {
                    const storedMessages = JSON.parse(context.content);
                    const recentMessages = storedMessages.filter((msg) => new Date(msg.timestamp).getTime() > cutoffTime);
                    messages.push(...recentMessages);
                }
                catch (parseError) {
                    log.warn('⚠️ Failed to parse stored messages', LogContext.CONTEXT_INJECTION, {
                        contextId: context.id,
                    });
                }
            }
            if (messages.length === 0)
                return null;
            const totalTokens = messages.reduce((sum, msg) => sum + msg.tokens, 0);
            const sessionId = contextId.split('_')[1] || 'unknown';
            const loadedContext = {
                id: contextId,
                messages: messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()),
                metadata: {
                    userId,
                    sessionId,
                    contextType: 'conversation',
                    tags: [],
                    keyTopics: [],
                },
                totalTokens,
                lastAccessed: new Date(),
                compressionLevel: 0,
            };
            log.info('📖 Context loaded from database', LogContext.CONTEXT_INJECTION, {
                contextId,
                messagesLoaded: messages.length,
                totalTokens,
                timeWindowHours,
            });
            return loadedContext;
        }
        catch (error) {
            log.error('❌ Failed to load context from database', LogContext.CONTEXT_INJECTION, {
                error: error instanceof Error ? error.message : String(error),
                contextId,
                userId,
            });
            return null;
        }
    }
    async searchDatabaseContext(userId, sessionId, options) {
        try {
            const summaries = await this.getContextSummaries(userId, sessionId, options.timeWindow || 24);
            const recentContext = await contextStorageService.getContext(userId, 'conversation', undefined, 5);
            const messages = [];
            for (const context of recentContext) {
                try {
                    const storedMessages = JSON.parse(context.content);
                    messages.push(...storedMessages.slice(-10));
                }
                catch (parseError) {
                }
            }
            const totalTokens = messages.reduce((sum, msg) => sum + msg.tokens, 0) +
                summaries.reduce((sum, s) => sum + s.compressedTokens, 0);
            return { messages: messages.slice(-20), summaries, totalTokens };
        }
        catch (error) {
            log.error('❌ Database context search failed', LogContext.CONTEXT_INJECTION, {
                error: error instanceof Error ? error.message : String(error),
                userId,
                sessionId,
            });
            return { messages: [], summaries: [], totalTokens: 0 };
        }
    }
    async getContextSummaries(userId, sessionId, timeWindowHours) {
        try {
            const summaries = await contextStorageService.searchContext(userId, `summary session_${sessionId}`, 'conversation', 10);
            return summaries
                .filter((s) => s.metadata?.summaryType === 'compressed_conversation')
                .map((s) => ({
                content: s.content,
                originalTokens: s.metadata?.originalTokens || 0,
                compressedTokens: s.metadata?.compressedTokens || this.estimateTokens(s.content),
                compressionRatio: s.metadata?.compressionRatio || 0.5,
                keyPoints: s.metadata?.keyPoints || [],
                preservedMessages: s.metadata?.preservedMessages || 0,
                timestamp: new Date(s.metadata?.timestamp || s.created_at),
            }))
                .filter((s) => {
                const cutoffTime = Date.now() - timeWindowHours * 60 * 60 * 1000;
                return s.timestamp.getTime() > cutoffTime;
            })
                .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
                .slice(0, 5);
        }
        catch (error) {
            log.error('❌ Failed to get context summaries', LogContext.CONTEXT_INJECTION, {
                error: error instanceof Error ? error.message : String(error),
                userId,
                sessionId,
            });
            return [];
        }
    }
    selectMessagesByTokenBudget(messages, tokenBudget) {
        const selected = [];
        let usedTokens = 0;
        const sorted = messages.sort((a, b) => {
            const importanceWeight = 0.7;
            const recencyWeight = 0.3;
            const aScore = a.importance * importanceWeight + (a.timestamp.getTime() / Date.now()) * recencyWeight;
            const bScore = b.importance * importanceWeight + (b.timestamp.getTime() / Date.now()) * recencyWeight;
            return bScore - aScore;
        });
        for (const message of sorted) {
            if (usedTokens + message.tokens <= tokenBudget) {
                selected.push(message);
                usedTokens += message.tokens;
            }
        }
        return selected.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    }
    async initializeContext(contextId, sessionId, userId) {
        const context = {
            id: contextId,
            messages: [],
            metadata: {
                userId: userId || 'anonymous',
                sessionId,
                contextType: 'conversation',
                tags: [],
                keyTopics: [],
            },
            totalTokens: 0,
            lastAccessed: new Date(),
            compressionLevel: 0,
        };
        log.info('🆕 New conversation context initialized', LogContext.CONTEXT_INJECTION, {
            contextId,
            sessionId,
            userId,
        });
        return context;
    }
    calculateMessageImportance(message) {
        let importance = 0.5;
        const roleWeight = this.IMPORTANCE_WEIGHTS[message.role] || 0.5;
        importance = roleWeight;
        const content = message.content.toLowerCase();
        if (content.includes('?') || content.match(/^(what|how|why|when|where|which)/)) {
            importance += 0.2;
        }
        if (content.includes('error') || content.includes('failed') || content.includes('exception')) {
            importance += 0.3;
        }
        if (content.includes('```') || content.includes('function') || content.includes('class')) {
            importance += 0.1;
        }
        if (message.content.length < 20) {
            importance -= 0.2;
        }
        if (message.content.length > 500) {
            importance += 0.1;
        }
        return Math.max(0, Math.min(1, importance));
    }
    getContextId(sessionId, userId) {
        return `ctx_${sessionId}_${userId}`;
    }
    estimateTokens(text) {
        return Math.ceil(text.length / 4);
    }
    startBackgroundCleanup() {
        this.cleanupTimer = setInterval(() => {
            this.performBackgroundCleanup();
        }, this.CLEANUP_INTERVAL);
        log.info('🧹 Background cleanup started', LogContext.CONTEXT_INJECTION, {
            intervalMs: this.CLEANUP_INTERVAL,
        });
    }
    async performBackgroundCleanup() {
        try {
            const now = Date.now();
            const staleThreshold = 8 * 60 * 60 * 1000;
            const contextsToCleanup = [];
            this.activeContexts.forEach((context, contextId) => {
                const timeSinceLastAccess = now - context.lastAccessed.getTime();
                const isStale = timeSinceLastAccess > staleThreshold;
                const isLowActivity = context.messages.length < 5 && context.totalTokens < 500;
                if (isStale && isLowActivity) {
                    contextsToCleanup.push(contextId);
                    log.debug('🧹 Marking context for cleanup', LogContext.CONTEXT_INJECTION, {
                        contextId,
                        timeSinceLastAccess: `${Math.round(timeSinceLastAccess / 1000 / 60)} minutes`,
                        messageCount: context.messages.length,
                        totalTokens: context.totalTokens,
                    });
                }
            });
            for (const contextId of contextsToCleanup) {
                const context = this.activeContexts.get(contextId);
                if (context) {
                    await this.persistContextToDatabase(context);
                    this.activeContexts.delete(contextId);
                }
            }
            if (this.activeContexts.size > this.MAX_ACTIVE_CONTEXTS * 3) {
                const sortedByAccess = Array.from(this.activeContexts.entries()).sort(([, a], [, b]) => a.lastAccessed.getTime() - b.lastAccessed.getTime());
                const toRemove = sortedByAccess.slice(0, Math.floor(this.activeContexts.size * 0.1));
                for (const [contextId, context] of toRemove) {
                    await this.persistContextToDatabase(context);
                    this.activeContexts.delete(contextId);
                }
                log.info('🧹 Removed oldest contexts due to limit', LogContext.CONTEXT_INJECTION, {
                    removedCount: toRemove.length,
                    activeContexts: this.activeContexts.size,
                    maxAllowed: this.MAX_ACTIVE_CONTEXTS * 3,
                });
            }
            if (contextsToCleanup.length > 0) {
                log.info('🧹 Background cleanup completed', LogContext.CONTEXT_INJECTION, {
                    cleanedContexts: contextsToCleanup.length,
                    activeContexts: this.activeContexts.size,
                });
            }
        }
        catch (error) {
            log.error('❌ Background cleanup failed', LogContext.CONTEXT_INJECTION, {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    getStats() {
        let totalMessages = 0;
        let totalTokens = 0;
        let totalCompression = 0;
        this.activeContexts.forEach((context) => {
            totalMessages += context.messages.length;
            totalTokens += context.totalTokens;
            totalCompression += context.compressionLevel;
        });
        return {
            activeContexts: this.activeContexts.size,
            totalMessages,
            totalTokens,
            averageCompression: this.activeContexts.size > 0 ? totalCompression / this.activeContexts.size : 0,
        };
    }
    async compressContextById(contextId) {
        const context = this.activeContexts.get(contextId);
        if (!context)
            return false;
        await this.compressContext(context);
        return true;
    }
    async persistContextById(contextId) {
        const context = this.activeContexts.get(contextId);
        if (!context)
            return false;
        await this.persistContextToDatabase(context);
        return true;
    }
    clearActiveContexts() {
        this.activeContexts.clear();
        log.info('🧹 All active contexts cleared', LogContext.CONTEXT_INJECTION);
    }
    shutdown() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = undefined;
        }
        Promise.all(Array.from(this.activeContexts.values()).map((context) => this.persistContextToDatabase(context))).then(() => {
            log.info('🛑 Enhanced Context Manager shutdown complete', LogContext.CONTEXT_INJECTION);
        });
    }
}
export const enhancedContextManager = new EnhancedContextManager();
export default enhancedContextManager;
//# sourceMappingURL=enhanced-context-manager.js.map