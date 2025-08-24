/**
 * Context Injection Middleware - Automatic MCP Context Integration
 * Automatically injects relevant project context into all LLM requests
 * SECURITY HARDENED: Includes prompt injection protection and token management
 */

import type { NextFunction, Request, Response } from 'express';

import { architectureAdvisor } from '../services/architecture-advisor-service';
import { mcpIntegrationService } from '../services/mcp-integration-service';
import { log,LogContext } from '../utils/logger';

export interface ContextualRequest extends Request {
  mcpContext?: {
    relevantContext: any[];
    contextTokens: number;
    contextSources: string[];
    cached: boolean;
  };
  originalMessages?: any[];
  enhancedMessages?: any[];
}

interface ContextInjectionOptions {
  enabled?: boolean;
  maxContextTokens?: number;
  cacheContext?: boolean;
  contextTypes?: string[];
  securityLevel?: 'strict' | 'moderate' | 'relaxed';
  fallbackOnError?: boolean;
}

// Security filters to prevent prompt injection
const SECURITY_PATTERNS = {
  promptInjection: [
    /ignore\s+previous\s+instructions/gi,
    /forget\s+everything/gi,
    /system\s*:\s*/gi,
    /assistant\s*:\s*/gi,
    /\[INST\]/gi,
    /<\|.*?\|\>/gi,
    /\n\n(human|assistant|user):/gi,
    /act\s+as\s+if/gi,
    /pretend\s+you\s+are/gi,
    /roleplay\s+as/gi,
    /execute\s+code/gi,
    /run\s+command/gi,
  ],
  sensitiveData: [/api[_-]?key/gi, /secret/gi, /password/gi, /token/gi, /credential/gi, /auth/gi],
};

const contextCache = new Map<
  string,
  {
    context: any[];
    expiry: number;
    hitCount: number;
  }
>();

const CACHE_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes - increased from 5 minutes for better cache utilization

/**
 * Main context injection middleware factory
 */
export function contextInjectionMiddleware(options: ContextInjectionOptions = {}) {
  const config = {
    enabled: true,
    maxContextTokens: 8000, // Increased from 1000 to better utilize available context window
    cacheContext: true,
    contextTypes: [
      'code_patterns',      // Most relevant for current work
      'error_analysis',     // Only if there are errors
      'conversation_history', // Re-enabled: Important for context continuity
      'project_overview',   // Re-enabled: Provides essential project context
      // Keep disabled: 'architecture_patterns' - less frequently needed
    ],
    securityLevel: 'strict' as const,
    fallbackOnError: true,
    ...options,
  };

  return async (req: ContextualRequest, res: Response, next: NextFunction) => {
    // Skip if disabled or not an LLM request
    if (!config.enabled || !isLLMRequest(req)) {
      return next();
    }

    try {
      const startTime = Date.now();

      // Generate cache key for context
      const cacheKey = generateContextCacheKey(req, config);

      // Try to get cached context first
      let relevantContext: any[] = [];
      let cached = false;

      if (config.cacheContext && contextCache.has(cacheKey)) {
        const cachedEntry = contextCache.get(cacheKey)!;
        if (cachedEntry.expiry > Date.now()) {
          relevantContext = cachedEntry.context;
          cachedEntry.hitCount++;
          cached = true;
          log.debug('Using cached MCP context', LogContext.MCP, {
            cacheKey,
            hitCount: cachedEntry.hitCount,
          });
        } else {
          contextCache.delete(cacheKey);
        }
      }

      // Fetch fresh context if not cached
      if (!cached) {
        relevantContext = await fetchRelevantContext(req, config);

        // Cache the context
        if (config.cacheContext && relevantContext.length > 0) {
          contextCache.set(cacheKey, {
            context: relevantContext,
            expiry: Date.now() + CACHE_EXPIRY_MS,
            hitCount: 1,
          });
        }
      }

      // Apply security filtering
      const secureContext = applySecurityFiltering(relevantContext, config.securityLevel);

      // Calculate context tokens (rough estimation)
      const contextTokens = estimateContextTokens(secureContext);

      // Inject context into request
      if (secureContext.length > 0 && contextTokens <= config.maxContextTokens) {
        req.mcpContext = {
          relevantContext: secureContext,
          contextTokens,
          contextSources: secureContext.map((ctx) => ctx.source || 'unknown'),
          cached,
        };

        // Enhance messages with context
        enhanceMessagesWithContext(req, secureContext);

        log.info(' MCP context injected successfully', LogContext.MCP, {
          contextItems: secureContext.length,
          contextTokens,
          cached,
          processingTime: Date.now() - startTime,
          endpoint: req.path,
        });
      } else if (contextTokens > config.maxContextTokens) {
        log.warn('� Context too large, skipping injection', LogContext.MCP, {
          contextTokens,
          maxTokens: config.maxContextTokens,
          endpoint: req.path,
        });
      }

      next();
    } catch (error) {
      log.error('L Error in context injection middleware', LogContext.MCP, {
        error: error instanceof Error ? error.message : String(error),
        endpoint: req.path,
      });

      if (config.fallbackOnError) {
        // Continue without context rather than failing the request
        next();
      } else {
        next(error);
      }
    }
  };
}

/**
 * Check if this is an LLM request that should receive context
 */
function isLLMRequest(req: Request): boolean {
  const llmPaths = [
    '/api/v1/chat',
    '/api/v1/agents',
    '/api/v1/ab-mcts',
    '/api/v1/vision',
    '/api/v1/huggingface',
  ];

  return (
    llmPaths.some((path) => req.path.startsWith(path)) ||
    req.body?.messages ||
    req.body?.prompt ||
    req.body?.userRequest
  );
}

/**
 * Generate cache key for context based on request characteristics
 */
function generateContextCacheKey(req: Request, config: ContextInjectionOptions): string {
  const keyParts = [
    req.path,
    req.method,
    JSON.stringify(config.contextTypes),
    config.maxContextTokens,
    // Include a hash of the request content to ensure relevance
    req.body?.userRequest || req.body?.prompt || req.body?.messages?.[0]?.content || '',
  ];

  return Buffer.from(keyParts.join('|')).toString('base64').slice(0, 32);
}

/**
 * Fetch relevant context from MCP service
 */
async function fetchRelevantContext(req: Request, config: ContextInjectionOptions): Promise<any[]> {
  const userInput = extractUserInput(req);
  if (!userInput) {return [];}

  const contextPromises = [];

  // Get architecture recommendations for the request
  if (config.contextTypes?.includes('architecture_patterns')) {
    contextPromises.push(
      architectureAdvisor
        .getTaskRecommendations(userInput, {
          limit: 2,
          minSuccessRate: 0.6,
        })
        .then((recommendations: any) => ({
          type: 'architecture_recommendations',
          content: recommendations,
          source: 'architecture_advisor',
        }))
        .catch((error: any) => {
          log.warn('Failed to get architecture recommendations', LogContext.SERVICE, { error });
          return null;
        })
    );
  }

  // Search for relevant context based on user input
  if (config.contextTypes?.includes('project_overview')) {
    contextPromises.push(
      mcpIntegrationService.sendMessage('search_context', {
        query: userInput,
        category: 'project_overview',
        limit: 3,
      })
    );
  }

  if (config.contextTypes?.includes('code_patterns')) {
    contextPromises.push(
      mcpIntegrationService.sendMessage('search_context', {
        query: userInput,
        category: 'code_patterns',
        limit: 5, // Restored to original limit for better pattern coverage
      })
    );
  }

  if (config.contextTypes?.includes('error_analysis')) {
    contextPromises.push(
      mcpIntegrationService.sendMessage('search_context', {
        query: userInput,
        category: 'error_analysis',
        limit: 3, // Restored to original limit for comprehensive error context
      })
    );
  }

  if (config.contextTypes?.includes('conversation_history')) {
    contextPromises.push(
      mcpIntegrationService.sendMessage('get_recent_context', {
        category: 'conversation',
        limit: 5,
      })
    );
  }

  // Include tool definitions if requested
  if (config.contextTypes?.includes('tool_definitions')) {
    const toolDefs = getToolDefinitions(req.path);
    if (toolDefs) {
      contextPromises.push(
        Promise.resolve({
          results: [{
            type: 'tool_definitions',
            content: toolDefs,
            source: 'system',
            category: 'tools'
          }]
        })
      );
    }
  }

  try {
    const results = await Promise.all(contextPromises);
    const relevantContext: any[] = [];

    for (const result of results) {
      if (result && typeof result === 'object' && 'results' in result) {
        const resultArray = Array.isArray(result.results) ? result.results : [];
        relevantContext.push(...resultArray);
      }
    }

    return relevantContext;
  } catch (error) {
    log.warn('� Error fetching MCP context, using empty context', LogContext.MCP, {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * Extract user input from various request formats
 */
function extractUserInput(req: Request): string {
  if (req.body?.userRequest) {return req.body.userRequest;}
  if (req.body?.prompt) {return req.body.prompt;}
  if (req.body?.messages && Array.isArray(req.body.messages)) {
    const lastMessage = req.body.messages[req.body.messages.length - 1];
    if (lastMessage?.content) {return lastMessage.content;}
  }
  if (req.body?.input) {return req.body.input;}
  return '';
}

/**
 * Apply security filtering to context
 */
function applySecurityFiltering(
  context: any[],
  securityLevel: 'strict' | 'moderate' | 'relaxed'
): any[] {
  if (securityLevel === 'relaxed') {return context;}

  return context.filter((item) => {
    const content = item.content || '';

    // Check for prompt injection patterns
    for (const pattern of SECURITY_PATTERNS.promptInjection) {
      if (pattern.test(content)) {
        log.warn('= Blocked context item due to prompt injection pattern', LogContext.MCP, {
          pattern: pattern.source,
          itemId: item.id,
        });
        return false;
      }
    }

    // Check for sensitive data (strict mode only)
    if (securityLevel === 'strict') {
      for (const pattern of SECURITY_PATTERNS.sensitiveData) {
        if (pattern.test(content)) {
          log.warn('= Blocked context item due to sensitive data pattern', LogContext.MCP, {
            pattern: pattern.source,
            itemId: item.id,
          });
          return false;
        }
      }
    }

    return true;
  });
}

/**
 * Estimate token count for context (rough approximation)
 */
function estimateContextTokens(context: any[]): number {
  let totalTokens = 0;

  for (const item of context) {
    const content = item.content || '';
    // Rough estimation: 1 token per 4 characters
    totalTokens += Math.ceil(content.length / 4);
  }

  return totalTokens;
}

/**
 * Enhance request messages with context
 */
function enhanceMessagesWithContext(req: ContextualRequest, context: any[]): void {
  if (!context.length) {return;}

  // Store original messages
  req.originalMessages = JSON.parse(JSON.stringify(req.body?.messages || []));

  // Create context summary
  const contextSummary = formatContextForInjection(context);

  // Add tool definitions for agent awareness
  const toolDefinitions = getToolDefinitions(req.path);

  if (req.body?.messages && Array.isArray(req.body.messages)) {
    // Add context to system message or create one
    const systemMessage = req.body.messages.find((msg: any) => msg.role === 'system');

    if (systemMessage) {
      systemMessage.content = `${systemMessage.content}\n\n## Relevant Project Context:\n${contextSummary}${toolDefinitions ? `\n\n## Available Tools:\n${toolDefinitions}` : ''}`;
    } else {
      req.body.messages.unshift({
        role: 'system',
        content: `## Relevant Project Context:\n${contextSummary}${toolDefinitions ? `\n\n## Available Tools:\n${toolDefinitions}` : ''}`,
      });
    }
  } else if (req.body?.prompt) {
    // Enhance prompt directly
    req.body.prompt = `## Relevant Project Context:\n${contextSummary}${toolDefinitions ? `\n\n## Available Tools:\n${toolDefinitions}` : ''}\n\n## User Request:\n${req.body.prompt}`;
  }

  req.enhancedMessages = JSON.parse(JSON.stringify(req.body?.messages || []));
}

/**
 * Get tool definitions based on the request path
 */
function getToolDefinitions(path: string): string | null {
  // Define tools available for different endpoints
  const toolSets: Record<string, any[]> = {
    '/api/v1/agents': [
      {
        name: 'organize_photos',
        description: 'Organize photos with metadata extraction and intelligent tagging',
        parameters: {
          extract_metadata: 'Extract date, location, camera settings from photos',
          identify_people: 'Use face recognition to identify and tag people',
          auto_tag: 'Automatically add descriptive tags for search',
          create_albums: 'Create smart albums based on criteria'
        }
      },
      {
        name: 'search_context',
        description: 'Search through stored project context and documentation',
        parameters: {
          query: 'Search query string',
          category: 'Optional category filter (code_patterns, errors, etc.)',
          limit: 'Maximum number of results'
        }
      },
      {
        name: 'save_context',
        description: 'Save important context for future reference',
        parameters: {
          content: 'Content to save',
          category: 'Category for organization',
          metadata: 'Additional metadata'
        }
      },
      {
        name: 'analyze_code',
        description: 'Analyze code patterns and suggest improvements',
        parameters: {
          code: 'Code to analyze',
          language: 'Programming language',
          focus: 'Analysis focus (performance, security, style)'
        }
      }
    ],
    '/api/v1/chat': [
      {
        name: 'search_knowledge',
        description: 'Search through knowledge base',
        parameters: {
          query: 'Search query'
        }
      }
    ],
    '/api/v1/vision': [
      {
        name: 'analyze_image',
        description: 'Analyze and extract information from images',
        parameters: {
          image_path: 'Path to image file',
          analysis_type: 'Type of analysis (ocr, object_detection, face_recognition)'
        }
      }
    ]
  };

  // Find matching tools for the path
  for (const [pathPattern, tools] of Object.entries(toolSets)) {
    if (path.startsWith(pathPattern)) {
      return tools.map(tool => 
        `- **${tool.name}**: ${tool.description}\n  Parameters: ${JSON.stringify(tool.parameters, null, 2)}`
      ).join('\n\n');
    }
  }

  return null;
}

/**
 * Format context items for injection
 */
function formatContextForInjection(context: any[]): string {
  const formatted = context
    .map((item) => {
      const source = item.source || item.category || 'unknown';
      const content = item.content || '';
      return `**[${source}]**: ${content}`;
    })
    .join('\n\n');

  return formatted.length > 2000 ? `${formatted.slice(0, 2000)}...` : formatted;
}

/**
 * Middleware specifically for chat endpoints
 */
export function chatContextMiddleware() {
  return contextInjectionMiddleware({
    contextTypes: ['error_analysis', 'conversation_history'], // Include conversation history for continuity
    maxContextTokens: 2000, // Increased from 500 for better context
  });
}

/**
 * Middleware specifically for agent endpoints
 */
export function agentContextMiddleware() {
  return contextInjectionMiddleware({
    contextTypes: ['code_patterns', 'error_analysis', 'conversation_history', 'project_overview', 'tool_definitions'], // Added tool_definitions
    maxContextTokens: 5000, // Increased to accommodate tool definitions
  });
}

/**
 * Middleware specifically for code-related endpoints
 */
export function codeContextMiddleware() {
  return contextInjectionMiddleware({
    contextTypes: ['code_patterns', 'error_analysis', 'project_overview'],
    maxContextTokens: 8000, // Restored to original 4000+ for code-heavy operations
    securityLevel: 'moderate',
  });
}

// Clean up cache periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of contextCache.entries()) {
    if (entry.expiry < now) {
      contextCache.delete(key);
    }
  }
}, 60000); // Clean every minute

export default contextInjectionMiddleware;
