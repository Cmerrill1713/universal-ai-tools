import { createClient } from '@supabase/supabase-js';
import { log, LogContext } from '@/utils/logger';
import { architectureAdvisor } from './architecture-advisor-service';
export class ContextInjectionService {
    supabase;
    maxContextTokens = 4000;
    contextCache = new Map();
    cacheExpiryMs = 5 * 60 * 1000;
    securityFilters = {
        promptInjectionPatterns: [
            /ignore\s+previous\s+instructions/gi,
            /forget\s+everything/gi,
            /system\s*:\s*/gi,
            /assistant\s*:\s*/gi,
            /\[INST\]/gi,
            /\<\|.*?\|\>/gi,
            /\n\n(human|assistant|user):/gi,
            /act\s+as\s+if/gi,
            /pretend\s+to\s+be/gi,
        ],
        sensitiveDataPatterns: [
            /\b[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
            /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
            /\b(?:sk-|pk_live_|pk_test_)[A-Za-z0-9]{20,}\b/g,
            /\b[A-Fa-f0-9]{32,}\b/g,
            /password\s*[:=]\s*[^\s\n]+/gi,
            /token\s*[:=]\s*[^\s\n]+/gi,
        ],
    };
    constructor() {
        this.supabase = createClient(process.env.SUPABASE_URL || 'http://127.0.0.1:54321', process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '');
    }
    async enrichWithContext(userRequest, projectContext) {
        try {
            const { sanitizedRequest, securityWarnings } = this.sanitizeAndValidateInput(userRequest);
            log.info('🔍 Enriching request with project context', LogContext.CONTEXT_INJECTION, {
                requestLength: sanitizedRequest.length,
                originalLength: userRequest.length,
                workingDirectory: projectContext.workingDirectory,
                userId: projectContext.userId,
                securityWarnings: securityWarnings.length,
            });
            const cacheKey = this.buildCacheKey(sanitizedRequest, projectContext);
            let enrichedContext = this.getCachedContext(cacheKey);
            if (!enrichedContext) {
                enrichedContext = await this.buildEnrichedContext(sanitizedRequest, projectContext);
                if (projectContext.includeArchitecturePatterns) {
                    enrichedContext.architecturePatterns = await this.getArchitecturePatterns(sanitizedRequest, projectContext);
                }
                this.cacheContext(cacheKey, enrichedContext);
            }
            const enrichedPrompt = this.buildEnrichedPrompt(sanitizedRequest, enrichedContext);
            const contextSummary = this.createContextSummary(enrichedContext);
            const sourcesUsed = this.extractSources(enrichedContext);
            log.info('✅ Context enrichment completed', LogContext.CONTEXT_INJECTION, {
                contextTokens: enrichedContext.totalContextTokens,
                sourcesCount: sourcesUsed.length,
                knowledgeChunks: enrichedContext.relevantKnowledge.length,
                securityWarnings: securityWarnings.length,
            });
            return {
                enrichedPrompt,
                contextSummary,
                sourcesUsed,
                securityWarnings: securityWarnings.length > 0 ? securityWarnings : undefined,
            };
        }
        catch (error) {
            log.error('❌ Context enrichment failed', LogContext.CONTEXT_INJECTION, {
                error: error instanceof Error ? error.message : String(error),
            });
            return {
                enrichedPrompt: this.buildFallbackPrompt(userRequest, projectContext),
                contextSummary: 'Context enrichment failed - using minimal context',
                sourcesUsed: [],
            };
        }
    }
    sanitizeAndValidateInput(input) {
        const warnings = [];
        let sanitized = input;
        this.securityFilters.promptInjectionPatterns.forEach((pattern, index) => {
            if (pattern.test(sanitized)) {
                warnings.push(`Potential prompt injection detected (pattern ${index + 1})`);
                sanitized = sanitized.replace(pattern, '[FILTERED_CONTENT]');
            }
        });
        this.securityFilters.sensitiveDataPatterns.forEach((pattern, index) => {
            const matches = sanitized.match(pattern);
            if (matches && matches.length > 0) {
                warnings.push(`Sensitive data filtered (${matches.length} instances)`);
                sanitized = sanitized.replace(pattern, '[REDACTED]');
            }
        });
        if (input.length > 10000) {
            warnings.push('Input length exceeds safe limits');
            sanitized = `${sanitized.substring(0, 10000)}[TRUNCATED]`;
        }
        if (warnings.length > 0) {
            log.warn('🚨 Security filtering applied to user input', LogContext.CONTEXT_INJECTION, {
                originalLength: input.length,
                sanitizedLength: sanitized.length,
                warnings: warnings.length,
            });
        }
        return { sanitizedRequest: sanitized, securityWarnings: warnings };
    }
    filterSensitiveContent(content) {
        let filtered = content;
        this.securityFilters.sensitiveDataPatterns.forEach((pattern) => {
            filtered = filtered.replace(pattern, '[REDACTED]');
        });
        return filtered;
    }
    async buildEnrichedContext(userRequest, projectContext) {
        const [relevantKnowledge, projectInfo, recentConversations, codeContext] = await Promise.all([
            this.getRelevantKnowledge(userRequest, projectContext),
            this.getProjectInfo(projectContext),
            this.getRecentConversations(projectContext),
            this.getCodeContext(userRequest, projectContext),
        ]);
        const totalContextTokens = this.estimateTokens([
            ...relevantKnowledge.map((k) => k.content),
            projectInfo,
            ...recentConversations,
            ...codeContext,
        ].join(' '));
        return {
            relevantKnowledge,
            projectInfo,
            recentConversations,
            codeContext,
            totalContextTokens,
        };
    }
    async getRelevantKnowledge(userRequest, projectContext) {
        try {
            if (!projectContext.userId) {
                log.warn('⚠️ No user ID provided - skipping knowledge retrieval for security', LogContext.CONTEXT_INJECTION);
                return [];
            }
            const embeddingResponse = await fetch('http://127.0.0.1:54321/functions/v1/ollama-embeddings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
                },
                body: JSON.stringify({
                    text: userRequest,
                    model: 'all-minilm:latest',
                    userId: projectContext.userId,
                }),
            });
            if (!embeddingResponse.ok) {
                throw new Error(`Embedding generation failed: ${embeddingResponse.status}`);
            }
            const { embedding } = await embeddingResponse.json();
            const { data: searchResults, error } = await this.supabase.rpc('hybrid_search', {
                query_text: userRequest,
                query_embedding: embedding,
                search_tables: ['knowledge_sources', 'documents', 'conversation_messages'],
                match_limit: 10,
                semantic_weight: 0.7,
            });
            if (error) {
                log.warn('⚠️ Hybrid search failed, falling back to user-filtered text search', LogContext.CONTEXT_INJECTION, {
                    error: error.message,
                });
                return await this.getSecureTextSearchResults(userRequest, projectContext.userId);
            }
            const userFilteredResults = searchResults?.filter((result) => !result.user_id || result.user_id === projectContext.userId) || [];
            return userFilteredResults.map((result) => ({
                id: result.id,
                content: this.filterSensitiveContent(result.content || result.text || result.summary),
                source: result.source || result.table_name || 'unknown',
                relevanceScore: result.similarity_score || result.rank || 0.5,
                type: this.determineContentType(result),
                metadata: {
                    created_at: result.created_at,
                    user_id: result.user_id,
                    tags: result.tags,
                },
            }));
        }
        catch (error) {
            log.error('❌ Knowledge retrieval failed', LogContext.CONTEXT_INJECTION, {
                error: error instanceof Error ? error.message : String(error),
            });
            return [];
        }
    }
    async getSecureTextSearchResults(userRequest, userId) {
        const searchTerms = userRequest
            .toLowerCase()
            .split(' ')
            .filter((term) => term.length > 3);
        const query = searchTerms.join(' | ');
        const { data, error } = await this.supabase
            .from('knowledge_sources')
            .select('*')
            .eq('user_id', userId)
            .textSearch('content', query)
            .limit(5);
        if (error)
            return [];
        return (data?.map((item) => ({
            id: item.id,
            content: this.filterSensitiveContent(item.content),
            source: item.source || 'knowledge_sources',
            relevanceScore: 0.5,
            type: 'knowledge',
            metadata: item.metadata || {},
        })) || []);
    }
    async getProjectInfo(projectContext) {
        try {
            if (projectContext.workingDirectory) {
                const { data: projectData, error } = await this.supabase
                    .from('documents')
                    .select('content, name')
                    .ilike('path', `%${projectContext.workingDirectory}%`)
                    .or('name.ilike.%README%,name.ilike.%CLAUDE.md%,name.ilike.%package.json%')
                    .limit(3);
                if (!error && projectData && projectData.length > 0) {
                    return projectData
                        .map((doc) => `${doc.name}:\n${this.filterSensitiveContent(doc.content)}`)
                        .join('\n\n');
                }
            }
            const { data: generalInfo, error } = await this.supabase
                .from('knowledge_sources')
                .select('content')
                .eq('type', 'project_info')
                .limit(1)
                .single();
            return generalInfo?.content || 'No specific project information available.';
        }
        catch (error) {
            return 'Project information unavailable.';
        }
    }
    async getRecentConversations(projectContext) {
        try {
            if (!projectContext.userId)
                return [];
            const { data: conversations, error } = await this.supabase
                .from('conversation_messages')
                .select('content, role, created_at')
                .eq('user_id', projectContext.userId)
                .order('created_at', { ascending: false })
                .limit(10);
            if (error)
                return [];
            return (conversations?.map((msg) => `${msg.role}: ${this.filterSensitiveContent(msg.content.substring(0, 200))}${msg.content.length > 200 ? '...' : ''}`) || []);
        }
        catch (error) {
            return [];
        }
    }
    async getCodeContext(userRequest, projectContext) {
        try {
            const codeKeywords = ['function', 'class', 'import', 'export', 'const', 'let', 'var'];
            const hasCodeRequest = codeKeywords.some((keyword) => userRequest.toLowerCase().includes(keyword));
            if (!hasCodeRequest)
                return [];
            const { data: codeFiles, error } = await this.supabase
                .from('documents')
                .select('content, name, path')
                .in('content_type', [
                'text/typescript',
                'text/javascript',
                'text/python',
                'application/json',
            ])
                .limit(5);
            if (error)
                return [];
            return (codeFiles?.map((file) => `${file.name} (${file.path}):\n${this.filterSensitiveContent(file.content.substring(0, 500))}${file.content.length > 500 ? '...' : ''}`) || []);
        }
        catch (error) {
            return [];
        }
    }
    buildEnrichedPrompt(userRequest, context) {
        let prompt = `IMPORTANT: Before processing the user request, you MUST consider the following project context and knowledge:\n\n`;
        if (context.projectInfo) {
            prompt += `## PROJECT CONTEXT:\n${context.projectInfo}\n\n`;
        }
        if (context.relevantKnowledge.length > 0) {
            prompt += `## RELEVANT KNOWLEDGE:\n`;
            context.relevantKnowledge.forEach((chunk, index) => {
                prompt += `${index + 1}. ${chunk.source} (relevance: ${chunk.relevanceScore.toFixed(2)}):\n${chunk.content}\n\n`;
            });
        }
        if (context.architecturePatterns && context.architecturePatterns.length > 0) {
            prompt += `## RECOMMENDED ARCHITECTURE PATTERNS:\n`;
            context.architecturePatterns.forEach((pattern, index) => {
                prompt += `${index + 1}. ${pattern.name} (${pattern.framework}):\n`;
                prompt += `   - Type: ${pattern.patternType}\n`;
                prompt += `   - Description: ${pattern.description}\n`;
                prompt += `   - Success Rate: ${((pattern.successRate || 0) * 100).toFixed(0)}%\n`;
                prompt += `   - Best For: ${(pattern.useCases || []).slice(0, 2).join(', ')}\n`;
                if (pattern.implementation) {
                    prompt += `   - Implementation Available: Yes\n`;
                }
                prompt += `\n`;
            });
        }
        if (context.recentConversations.length > 0) {
            prompt += `## RECENT CONVERSATION HISTORY:\n`;
            context.recentConversations.slice(0, 3).forEach((conv) => {
                prompt += `${conv}\n`;
            });
            prompt += `\n`;
        }
        if (context.codeContext.length > 0) {
            prompt += `## RELEVANT CODE CONTEXT:\n`;
            context.codeContext.forEach((code) => {
                prompt += `${code}\n\n`;
            });
        }
        prompt += `## INSTRUCTIONS:\n`;
        prompt += `You MUST use the above context to inform your response. Reference specific information from the context when relevant. `;
        if (context.architecturePatterns && context.architecturePatterns.length > 0) {
            prompt += `Consider the recommended architecture patterns when providing implementation guidance. `;
        }
        prompt += `If the context doesn't contain relevant information, acknowledge this and explain what additional information you would need.\n\n`;
        prompt += `## USER REQUEST:\n${userRequest}\n\n`;
        prompt += `Remember: Always consider the project context and knowledge above before providing your response.`;
        return prompt;
    }
    buildFallbackPrompt(userRequest, projectContext) {
        let prompt = `CONTEXT: You are working on a project`;
        if (projectContext.workingDirectory) {
            prompt += ` in directory: ${projectContext.workingDirectory}`;
        }
        if (projectContext.currentProject) {
            prompt += `, project: ${projectContext.currentProject}`;
        }
        prompt += `.\n\nUSER REQUEST: ${userRequest}\n\n`;
        prompt += `Note: Full context retrieval was unavailable. Please provide the best response possible with limited context.`;
        return prompt;
    }
    buildCacheKey(userRequest, projectContext) {
        const keyParts = [
            userRequest.substring(0, 100),
            projectContext.workingDirectory || '',
            projectContext.userId || '',
            projectContext.currentProject || '',
        ];
        return Buffer.from(keyParts.join('|')).toString('base64');
    }
    getCachedContext(cacheKey) {
        const cached = this.contextCache.get(cacheKey);
        if (cached && Date.now() < cached.expiry) {
            cached.hitCount += 1;
            return cached.context;
        }
        this.contextCache.delete(cacheKey);
        return null;
    }
    cacheContext(cacheKey, context) {
        this.contextCache.set(cacheKey, {
            context,
            expiry: Date.now() + this.cacheExpiryMs,
            hitCount: 0,
        });
    }
    estimateTokens(text) {
        return Math.ceil(text.length / 4);
    }
    determineContentType(result) {
        if (result.table_name === 'conversation_messages')
            return 'conversation';
        if (result.table_name === 'documents')
            return 'document';
        if (result.content_type?.includes('javascript') || result.content_type?.includes('typescript')) {
            return 'code';
        }
        return 'knowledge';
    }
    createContextSummary(context) {
        return `Used ${context.relevantKnowledge.length} knowledge chunks, ${context.recentConversations.length} recent conversations, ${context.codeContext.length} code files. Total context tokens: ${context.totalContextTokens}`;
    }
    extractSources(context) {
        return [...new Set(context.relevantKnowledge.map((k) => k.source))];
    }
    async getArchitecturePatterns(userRequest, projectContext) {
        try {
            log.info('🏗️ Fetching architecture patterns', LogContext.CONTEXT_INJECTION, {
                requestLength: userRequest.length,
            });
            const matchingContext = {
                userRequest,
                agentType: projectContext.metadata?.agentType,
                taskComplexity: this.assessTaskComplexity(userRequest),
                requiredCapabilities: projectContext.metadata?.capabilities,
            };
            const recommendations = await architectureAdvisor.getRelevantPatterns(JSON.stringify(matchingContext), {
                threshold: 0.6,
                limit: 3,
                includeRelated: false,
            });
            const patterns = recommendations.map((rec) => rec.pattern);
            log.info('✅ Found architecture patterns', LogContext.CONTEXT_INJECTION, {
                patternCount: patterns.length,
                topPattern: patterns[0]?.name,
            });
            return patterns;
        }
        catch (error) {
            log.error('❌ Failed to get architecture patterns', LogContext.CONTEXT_INJECTION, {
                error: error instanceof Error ? error.message : String(error),
            });
            return [];
        }
    }
    assessTaskComplexity(request) {
        const complexKeywords = [
            'integrate',
            'orchestrate',
            'distributed',
            'multi-agent',
            'workflow',
            'architecture',
        ];
        const simpleKeywords = ['simple', 'basic', 'single', 'straightforward'];
        const reqLower = request.toLowerCase();
        const complexCount = complexKeywords.filter((k) => reqLower.includes(k)).length;
        const simpleCount = simpleKeywords.filter((k) => reqLower.includes(k)).length;
        if (complexCount > 2 || request.length > 500)
            return 'complex';
        if (simpleCount > 1 || request.length < 100)
            return 'simple';
        return 'medium';
    }
    clearCache() {
        this.contextCache.clear();
        log.info('🧹 Context cache cleared', LogContext.CONTEXT_INJECTION);
    }
    getCacheStats() {
        const totalHits = Array.from(this.contextCache.values()).reduce((sum, entry) => sum + entry.hitCount, 0);
        const totalEntries = this.contextCache.size;
        return {
            size: totalEntries,
            hitRate: totalEntries > 0 ? totalHits / totalEntries : 0,
        };
    }
}
export const contextInjectionService = new ContextInjectionService();
export default contextInjectionService;
//# sourceMappingURL=context-injection-service.js.map