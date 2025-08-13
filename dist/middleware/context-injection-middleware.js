import { architectureAdvisor } from '../services/architecture-advisor-service';
import { mcpIntegrationService } from '../services/mcp-integration-service';
import { log, LogContext } from '../utils/logger';
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
const contextCache = new Map();
const CACHE_EXPIRY_MS = 30 * 60 * 1000;
export function contextInjectionMiddleware(options = {}) {
    const config = {
        enabled: true,
        maxContextTokens: 8000,
        cacheContext: true,
        contextTypes: [
            'code_patterns',
            'error_analysis',
            'conversation_history',
            'project_overview',
        ],
        securityLevel: 'strict',
        fallbackOnError: true,
        ...options,
    };
    return async (req, res, next) => {
        if (!config.enabled || !isLLMRequest(req)) {
            return next();
        }
        try {
            const startTime = Date.now();
            const cacheKey = generateContextCacheKey(req, config);
            let relevantContext = [];
            let cached = false;
            if (config.cacheContext && contextCache.has(cacheKey)) {
                const cachedEntry = contextCache.get(cacheKey);
                if (cachedEntry.expiry > Date.now()) {
                    relevantContext = cachedEntry.context;
                    cachedEntry.hitCount++;
                    cached = true;
                    log.debug('Using cached MCP context', LogContext.MCP, {
                        cacheKey,
                        hitCount: cachedEntry.hitCount,
                    });
                }
                else {
                    contextCache.delete(cacheKey);
                }
            }
            if (!cached) {
                relevantContext = await fetchRelevantContext(req, config);
                if (config.cacheContext && relevantContext.length > 0) {
                    contextCache.set(cacheKey, {
                        context: relevantContext,
                        expiry: Date.now() + CACHE_EXPIRY_MS,
                        hitCount: 1,
                    });
                }
            }
            const secureContext = applySecurityFiltering(relevantContext, config.securityLevel);
            const contextTokens = estimateContextTokens(secureContext);
            if (secureContext.length > 0 && contextTokens <= config.maxContextTokens) {
                req.mcpContext = {
                    relevantContext: secureContext,
                    contextTokens,
                    contextSources: secureContext.map((ctx) => ctx.source || 'unknown'),
                    cached,
                };
                enhanceMessagesWithContext(req, secureContext);
                log.info(' MCP context injected successfully', LogContext.MCP, {
                    contextItems: secureContext.length,
                    contextTokens,
                    cached,
                    processingTime: Date.now() - startTime,
                    endpoint: req.path,
                });
            }
            else if (contextTokens > config.maxContextTokens) {
                log.warn('� Context too large, skipping injection', LogContext.MCP, {
                    contextTokens,
                    maxTokens: config.maxContextTokens,
                    endpoint: req.path,
                });
            }
            next();
        }
        catch (error) {
            log.error('L Error in context injection middleware', LogContext.MCP, {
                error: error instanceof Error ? error.message : String(error),
                endpoint: req.path,
            });
            if (config.fallbackOnError) {
                next();
            }
            else {
                next(error);
            }
        }
    };
}
function isLLMRequest(req) {
    const llmPaths = [
        '/api/v1/chat',
        '/api/v1/agents',
        '/api/v1/ab-mcts',
        '/api/v1/vision',
        '/api/v1/huggingface',
    ];
    return (llmPaths.some((path) => req.path.startsWith(path)) ||
        req.body?.messages ||
        req.body?.prompt ||
        req.body?.userRequest);
}
function generateContextCacheKey(req, config) {
    const keyParts = [
        req.path,
        req.method,
        JSON.stringify(config.contextTypes),
        config.maxContextTokens,
        req.body?.userRequest || req.body?.prompt || req.body?.messages?.[0]?.content || '',
    ];
    return Buffer.from(keyParts.join('|')).toString('base64').slice(0, 32);
}
async function fetchRelevantContext(req, config) {
    const userInput = extractUserInput(req);
    if (!userInput)
        return [];
    const contextPromises = [];
    if (config.contextTypes?.includes('architecture_patterns')) {
        contextPromises.push(architectureAdvisor
            .getTaskRecommendations(userInput, {
            limit: 2,
            minSuccessRate: 0.6,
        })
            .then((recommendations) => ({
            type: 'architecture_recommendations',
            content: recommendations,
            source: 'architecture_advisor',
        }))
            .catch((error) => {
            log.warn('Failed to get architecture recommendations', LogContext.SERVICE, { error });
            return null;
        }));
    }
    if (config.contextTypes?.includes('project_overview')) {
        contextPromises.push(mcpIntegrationService.sendMessage('search_context', {
            query: userInput,
            category: 'project_overview',
            limit: 3,
        }));
    }
    if (config.contextTypes?.includes('code_patterns')) {
        contextPromises.push(mcpIntegrationService.sendMessage('search_context', {
            query: userInput,
            category: 'code_patterns',
            limit: 5,
        }));
    }
    if (config.contextTypes?.includes('error_analysis')) {
        contextPromises.push(mcpIntegrationService.sendMessage('search_context', {
            query: userInput,
            category: 'error_analysis',
            limit: 3,
        }));
    }
    if (config.contextTypes?.includes('conversation_history')) {
        contextPromises.push(mcpIntegrationService.sendMessage('get_recent_context', {
            category: 'conversation',
            limit: 5,
        }));
    }
    if (config.contextTypes?.includes('tool_definitions')) {
        const toolDefs = getToolDefinitions(req.path);
        if (toolDefs) {
            contextPromises.push(Promise.resolve({
                results: [{
                        type: 'tool_definitions',
                        content: toolDefs,
                        source: 'system',
                        category: 'tools'
                    }]
            }));
        }
    }
    try {
        const results = await Promise.all(contextPromises);
        const relevantContext = [];
        for (const result of results) {
            if (result && typeof result === 'object' && 'results' in result) {
                const resultArray = Array.isArray(result.results) ? result.results : [];
                relevantContext.push(...resultArray);
            }
        }
        return relevantContext;
    }
    catch (error) {
        log.warn('� Error fetching MCP context, using empty context', LogContext.MCP, {
            error: error instanceof Error ? error.message : String(error),
        });
        return [];
    }
}
function extractUserInput(req) {
    if (req.body?.userRequest)
        return req.body.userRequest;
    if (req.body?.prompt)
        return req.body.prompt;
    if (req.body?.messages && Array.isArray(req.body.messages)) {
        const lastMessage = req.body.messages[req.body.messages.length - 1];
        if (lastMessage?.content)
            return lastMessage.content;
    }
    if (req.body?.input)
        return req.body.input;
    return '';
}
function applySecurityFiltering(context, securityLevel) {
    if (securityLevel === 'relaxed')
        return context;
    return context.filter((item) => {
        const content = item.content || '';
        for (const pattern of SECURITY_PATTERNS.promptInjection) {
            if (pattern.test(content)) {
                log.warn('= Blocked context item due to prompt injection pattern', LogContext.MCP, {
                    pattern: pattern.source,
                    itemId: item.id,
                });
                return false;
            }
        }
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
function estimateContextTokens(context) {
    let totalTokens = 0;
    for (const item of context) {
        const content = item.content || '';
        totalTokens += Math.ceil(content.length / 4);
    }
    return totalTokens;
}
function enhanceMessagesWithContext(req, context) {
    if (!context.length)
        return;
    req.originalMessages = JSON.parse(JSON.stringify(req.body?.messages || []));
    const contextSummary = formatContextForInjection(context);
    const toolDefinitions = getToolDefinitions(req.path);
    if (req.body?.messages && Array.isArray(req.body.messages)) {
        const systemMessage = req.body.messages.find((msg) => msg.role === 'system');
        if (systemMessage) {
            systemMessage.content = `${systemMessage.content}\n\n## Relevant Project Context:\n${contextSummary}${toolDefinitions ? `\n\n## Available Tools:\n${toolDefinitions}` : ''}`;
        }
        else {
            req.body.messages.unshift({
                role: 'system',
                content: `## Relevant Project Context:\n${contextSummary}${toolDefinitions ? `\n\n## Available Tools:\n${toolDefinitions}` : ''}`,
            });
        }
    }
    else if (req.body?.prompt) {
        req.body.prompt = `## Relevant Project Context:\n${contextSummary}${toolDefinitions ? `\n\n## Available Tools:\n${toolDefinitions}` : ''}\n\n## User Request:\n${req.body.prompt}`;
    }
    req.enhancedMessages = JSON.parse(JSON.stringify(req.body?.messages || []));
}
function getToolDefinitions(path) {
    const toolSets = {
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
    for (const [pathPattern, tools] of Object.entries(toolSets)) {
        if (path.startsWith(pathPattern)) {
            return tools.map(tool => `- **${tool.name}**: ${tool.description}\n  Parameters: ${JSON.stringify(tool.parameters, null, 2)}`).join('\n\n');
        }
    }
    return null;
}
function formatContextForInjection(context) {
    const formatted = context
        .map((item) => {
        const source = item.source || item.category || 'unknown';
        const content = item.content || '';
        return `**[${source}]**: ${content}`;
    })
        .join('\n\n');
    return formatted.length > 2000 ? `${formatted.slice(0, 2000)}...` : formatted;
}
export function chatContextMiddleware() {
    return contextInjectionMiddleware({
        contextTypes: ['error_analysis', 'conversation_history'],
        maxContextTokens: 2000,
    });
}
export function agentContextMiddleware() {
    return contextInjectionMiddleware({
        contextTypes: ['code_patterns', 'error_analysis', 'conversation_history', 'project_overview', 'tool_definitions'],
        maxContextTokens: 5000,
    });
}
export function codeContextMiddleware() {
    return contextInjectionMiddleware({
        contextTypes: ['code_patterns', 'error_analysis', 'project_overview'],
        maxContextTokens: 8000,
        securityLevel: 'moderate',
    });
}
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of contextCache.entries()) {
        if (entry.expiry < now) {
            contextCache.delete(key);
        }
    }
}, 60000);
export default contextInjectionMiddleware;
//# sourceMappingURL=context-injection-middleware.js.map