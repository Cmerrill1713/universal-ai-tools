/**
 * Automatic Context Middleware
 *
 * Seamlessly integrates enhanced context management with the existing API framework.
 * Automatically persists conversations, compresses context when needed, and injects
 * relevant context into LLM requests without requiring explicit management.
 *
 * Features:
 * - Automatic conversation tracking and persistence
 * - Token limit monitoring with proactive compression
 * - Context injection into LLM requests
 * - Session management across requests
 * - Background context optimization
 */

import type { NextFunction, Request, Response } from 'express';

import { contextInjectionService } from '../services/context-injection-service';
import { enhancedContextManager } from '../services/enhanced-context-manager';
import { semanticContextRetrievalService } from '../services/semantic-context-retrieval';
import { log,LogContext } from '../utils/logger';

interface ContextMiddlewareOptions {
  enableAutoTracking?: boolean;
  enableContextInjection?: boolean;
  enableTokenLimitMonitoring?: boolean;
  maxContextTokens?: number;
  compressionThreshold?: number;
  persistenceThreshold?: number;
  excludeRoutes?: string[];
  includeRoutes?: string[];
}

interface ExtractedContextInfo {
  sessionId: string;
  userId: string;
  projectPath?: string;
  workingDirectory?: string;
  conversationId?: string;
  contextMetadata?: Record<string, any>;
}

interface EnhancedRequest extends Request {
  contextInfo?: {
    sessionId: string;
    userId: string;
    projectPath?: string;
    workingDirectory?: string;
    conversationId?: string;
    contextMetadata?: Record<string, any>;
  };
  originalBody?: any;
  enhancedBody?: {
    originalRequest: any;
    enrichedPrompt: string;
    contextSummary: string;
    sourcesUsed: string[];
    tokenCount: number;
  };
}

interface ContextSession {
  sessionId: string;
  userId: string;
  lastActivity: Date;
  messageCount: number;
  totalTokens: number;
  compressionLevel: number;
  metadata: Record<string, any>;
}

export class AutoContextMiddleware {
  private sessions = new Map<string, ContextSession>();
  private readonly SESSION_TIMEOUT = 8 * 60 * 60 * 1000; // 8 hours - increased from 2 hours for better session continuity
  private cleanupTimer?: NodeJS.Timeout;
  private readonly CLEANUP_INTERVAL = 15 * 60 * 1000; // 15 minutes

  constructor(private options: ContextMiddlewareOptions = {}) {
    // Set default options - aligned with enhanced context manager
    this.options = {
      enableAutoTracking: true,
      enableContextInjection: true,
      enableTokenLimitMonitoring: true,
      maxContextTokens: 32000, // Aligned with enhanced context manager
      compressionThreshold: 24000, // 75% of max tokens
      persistenceThreshold: 16000, // 50% of max tokens
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

  /**
   * Main middleware function - processes requests and responses
   */
  middleware() {
    return async (req: EnhancedRequest, res: Response, next: NextFunction) => {
      try {
        // Skip excluded routes
        if (this.shouldSkipRoute(req.path)) {
          return next();
        }

        // Extract context information from request
        const contextInfo = this.extractContextInfo(req);
        if (!contextInfo) {
          return next();
        }

        req.contextInfo = contextInfo;

        // Update or create session
        await this.updateSession(contextInfo);

        // Handle pre-request context injection
        if (this.options.enableContextInjection && this.isLLMRequest(req)) {
          await this.injectContextIntoRequest(req);
        }

        // Store original response methods to intercept response
        const originalSend = res.send;
        const originalJson = res.json;

        // Intercept response to track assistant messages
        res.send = function (this: Response, body: any) {
          handleResponse(body, 'send');
          return originalSend.call(this, body);
        };

        res.json = function (this: Response, obj: any) {
          handleResponse(obj, 'json');
          return originalJson.call(this, obj);
        };

        const handleResponse = async (responseData: any, method: string) => {
          if (req.contextInfo && this.options.enableAutoTracking) {
            await this.trackResponse(req.contextInfo, req, responseData);
          }
        };

        next();
      } catch (error) {
        log.error('❌ Auto context middleware error', LogContext.CONTEXT_INJECTION, {
          error: error instanceof Error ? error.message : String(error),
          path: req.path,
          method: req.method,
        });
        next(); // Continue without context management
      }
    };
  }

  /**
   * Extract context information from request
   */
  private extractContextInfo(req: Request): ExtractedContextInfo | null {
    try {
      // Extract user ID from various sources
      let userId = 'anonymous';
      if (req.headers.authorization) {
        // Try to extract from JWT or API key
        const authHeader = req.headers.authorization;
        if (authHeader.startsWith('Bearer ')) {
          // For JWT, would decode token to get user ID
          userId = 'jwt_user'; // Placeholder
        }
      } else if (req.headers['x-user-id']) {
        userId = req.headers['x-user-id'] as string;
      } else if (req.body?.userId) {
        userId = req.body.userId;
      } else if (req.query.userId) {
        userId = req.query.userId as string;
      }

      // Generate or extract session ID
      let sessionId = req.headers['x-session-id'] as string;
      if (!sessionId) {
        // Generate session ID based on IP + User-Agent
        const ip = req.ip || req.connection.remoteAddress || 'unknown';
        const userAgent = req.headers['user-agent'] || 'unknown';
        sessionId = Buffer.from(`${ip}_${userAgent}_${userId}`).toString('base64').substring(0, 16);
      }

      // Extract project context
      const projectPath =
        (req.headers['x-project-path'] as string) ||
        req.body?.projectPath ||
        (req.query.projectPath as string);

      const workingDirectory =
        (req.headers['x-working-directory'] as string) ||
        req.body?.workingDirectory ||
        (req.query.workingDirectory as string) ||
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
    } catch (error) {
      log.error('❌ Failed to extract context info', LogContext.CONTEXT_INJECTION, {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Update or create session information
   */
  private async updateSession(contextInfo: any): Promise<void> {
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

      // Update session activity
      session.lastActivity = new Date();
      session.metadata = { ...session.metadata, ...contextInfo.contextMetadata };
    } catch (error) {
      log.error('❌ Failed to update session', LogContext.CONTEXT_INJECTION, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Inject context into LLM requests
   */
  private async injectContextIntoRequest(req: EnhancedRequest): Promise<void> {
    try {
      if (!req.contextInfo) return;

      // Extract the user's request/prompt from the body
      const userRequest = this.extractUserRequest(req);
      if (!userRequest) return;

      log.info('💉 Injecting context into LLM request', LogContext.CONTEXT_INJECTION, {
        sessionId: req.contextInfo.sessionId,
        userId: req.contextInfo.userId,
        requestLength: userRequest.length,
      });

      // Get relevant context using semantic search
      const contextResults = await semanticContextRetrievalService.semanticSearch({
        query: userRequest,
        userId: req.contextInfo.userId,
        sessionId: req.contextInfo.sessionId,
        projectPath: req.contextInfo.projectPath,
        maxResults: 10,
        timeWindow: 24,
        fuseSimilarResults: true,
      });

      // Use existing context injection service for enrichment
      const enrichmentResult = await contextInjectionService.enrichWithContext(userRequest, {
        userId: req.contextInfo.userId,
        sessionId: req.contextInfo.sessionId,
        workingDirectory: req.contextInfo.workingDirectory,
        currentProject: req.contextInfo.projectPath,
        includeArchitecturePatterns: true,
      });

      // Store original body and create enhanced body
      req.originalBody = { ...req.body };
      req.enhancedBody = {
        originalRequest: userRequest,
        enrichedPrompt: enrichmentResult.enrichedPrompt,
        contextSummary: enrichmentResult.contextSummary,
        sourcesUsed: enrichmentResult.sourcesUsed,
        tokenCount: contextResults.results.reduce((sum, r) => sum + r.metadata.tokenCount, 0),
      };

      // Update request body with enriched prompt
      this.updateRequestWithEnrichedContent(req, enrichmentResult.enrichedPrompt);

      log.info('✅ Context injection completed', LogContext.CONTEXT_INJECTION, {
        sessionId: req.contextInfo.sessionId,
        sourcesUsed: enrichmentResult.sourcesUsed.length,
        contextTokens: req.enhancedBody.tokenCount,
        semanticResults: contextResults.results.length,
      });
    } catch (error) {
      log.error('❌ Context injection failed', LogContext.CONTEXT_INJECTION, {
        error: error instanceof Error ? error.message : String(error),
        sessionId: req.contextInfo?.sessionId,
      });
    }
  }

  /**
   * Track response and add to conversation context
   */
  private async trackResponse(
    contextInfo: any,
    req: EnhancedRequest,
    responseData: any
  ): Promise<void> {
    try {
      // Add user message to context first
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

      // Add assistant response to context
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

        // Update session metrics
        const sessionKey = `${contextInfo.sessionId}_${contextInfo.userId}`;
        const session = this.sessions.get(sessionKey);
        if (session) {
          session.messageCount += 2; // User + assistant messages
          session.totalTokens = result.tokenCount;

          // Check if compression is needed
          if (
            this.options.enableTokenLimitMonitoring &&
            result.tokenCount > (this.options.compressionThreshold || 6000)
          ) {
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
    } catch (error) {
      log.error('❌ Response tracking failed', LogContext.CONTEXT_INJECTION, {
        error: error instanceof Error ? error.message : String(error),
        sessionId: contextInfo.sessionId,
      });
    }
  }

  /**
   * Extract user request from request body
   */
  private extractUserRequest(req: Request): string | null {
    try {
      const { body } = req;

      // Common patterns for extracting user input
      if (typeof body === 'string') return body;
      if (body?.prompt) return body.prompt;
      if (body?.message) return body.message;
      if (body?.query) return body.query;
      if (body?.request) return body.request;
      if (body?.input) return body.input;
      if (body?.text) return body.text;
      if (body?.content) return body.content;

      // For agent orchestration requests
      if (body?.task) return body.task;
      if (body?.instruction) return body.instruction;
      if (body?.userRequest) return body.userRequest;

      // For chat/conversation requests
      if (body?.messages && Array.isArray(body.messages)) {
        const lastMessage = body.messages[body.messages.length - 1];
        if (lastMessage?.content) return lastMessage.content;
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Extract assistant response from response data
   */
  private extractAssistantResponse(responseData: any): string | null {
    try {
      if (typeof responseData === 'string') return responseData;
      if (responseData?.response) return responseData.response;
      if (responseData?.result) return responseData.result;
      if (responseData?.output) return responseData.output;
      if (responseData?.content) return responseData.content;
      if (responseData?.message) return responseData.message;
      if (responseData?.text) return responseData.text;
      if (responseData?.answer) return responseData.answer;

      // For agent responses
      if (responseData?.agentResponse) return responseData.agentResponse;
      if (responseData?.synthesis) return responseData.synthesis;
      if (responseData?.analysis) return responseData.analysis;

      // For structured responses, serialize key parts
      if (responseData?.success && responseData?.data) {
        return JSON.stringify(responseData.data, null, 2);
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Update request body with enriched content
   */
  private updateRequestWithEnrichedContent(req: EnhancedRequest, enrichedPrompt: string): void {
    try {
      const { body } = req;

      // Update based on request structure
      if (body?.prompt) {
        body.prompt = enrichedPrompt;
      } else if (body?.message) {
        body.message = enrichedPrompt;
      } else if (body?.query) {
        body.query = enrichedPrompt;
      } else if (body?.request) {
        body.request = enrichedPrompt;
      } else if (body?.input) {
        body.input = enrichedPrompt;
      } else if (body?.text) {
        body.text = enrichedPrompt;
      } else if (body?.content) {
        body.content = enrichedPrompt;
      } else if (body?.task) {
        body.task = enrichedPrompt;
      } else if (body?.instruction) {
        body.instruction = enrichedPrompt;
      } else if (body?.userRequest) {
        body.userRequest = enrichedPrompt;
      } else if (body?.messages && Array.isArray(body.messages)) {
        // Update last user message
        const lastMessage = body.messages[body.messages.length - 1];
        if (lastMessage && lastMessage.role === 'user') {
          lastMessage.content = enrichedPrompt;
        } else {
          // Add new enriched message
          body.messages.push({
            role: 'user',
            content: enrichedPrompt,
          });
        }
      } else {
        // Fallback: add as new property
        body.enrichedPrompt = enrichedPrompt;
      }
    } catch (error) {
      log.error('❌ Failed to update request with enriched content', LogContext.CONTEXT_INJECTION, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Check if this is an LLM request that should get context injection
   */
  private isLLMRequest(req: Request): boolean {
    const path = req.path.toLowerCase();
    const { body } = req;

    // Check if this is an agent or LLM endpoint
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

    // Check if request body suggests LLM interaction
    const hasLLMContent =
      body &&
      (body.prompt ||
        body.message ||
        body.query ||
        body.task ||
        body.instruction ||
        body.messages ||
        body.userRequest);

    return isLLMEndpoint && hasLLMContent;
  }

  /**
   * Check if route should be skipped
   */
  private shouldSkipRoute(path: string): boolean {
    const excludeRoutes = this.options.excludeRoutes || [];
    const includeRoutes = this.options.includeRoutes || [];

    // Skip if explicitly excluded
    if (excludeRoutes.some((route) => path.startsWith(route))) {
      return true;
    }

    // If include routes specified, only process those
    if (includeRoutes.length > 0) {
      return !includeRoutes.some((route) => path.startsWith(route));
    }

    return false;
  }

  /**
   * Start session cleanup process
   */
  private startSessionCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredSessions();
    }, this.CLEANUP_INTERVAL);
  }

  /**
   * Clean up expired sessions
   */
  private cleanupExpiredSessions(): void {
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

  /**
   * Get middleware statistics
   */
  public getStats(): {
    activeSessions: number;
    totalMessages: number;
    averageTokensPerSession: number;
    compressionRate: number;
  } {
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

  /**
   * Force cleanup of specific session
   */
  public cleanupSession(sessionId: string, userId: string): boolean {
    const sessionKey = `${sessionId}_${userId}`;
    return this.sessions.delete(sessionKey);
  }

  /**
   * Get session information
   */
  public getSession(sessionId: string, userId: string): ContextSession | null {
    const sessionKey = `${sessionId}_${userId}`;
    return this.sessions.get(sessionKey) || null;
  }

  /**
   * Shutdown the middleware
   */
  public shutdown(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }

    this.sessions.clear();
    log.info('🛑 Auto Context Middleware shutdown complete', LogContext.CONTEXT_INJECTION);
  }
}

// Create and export middleware instance
export const autoContextMiddleware = new AutoContextMiddleware();

// Export middleware function for use in Express app
export const contextMiddleware = autoContextMiddleware.middleware();

export default contextMiddleware;
