/**
 * Context Injection Service - Automatic Project Context for All LLM Calls
 * Ensures every LLM interaction has access to relevant project knowledge
 * SECURITY HARDENED: Includes prompt injection protection and data isolation
 */

import { createClient } from '@supabase/supabase-js';
import { LogContext, log } from '@/utils/logger';
import type { ArchitecturePattern } from '@/types/architecture';
import { architectureAdvisor } from './architecture-advisor-service';

interface ProjectContext {
  workingDirectory?: string;
  userId?: string;
  currentProject?: string;
  sessionId?: string;
  includeArchitecturePatterns?: boolean;
  metadata?: Record<string, any>;
}

interface ContextChunk {
  id: string;
  content: string;
  source: string;
  relevanceScore: number;
  type: 'document' | 'code' | 'conversation' | 'knowledge';
  metadata?: Record<string, any>;
}

interface EnrichedContext {
  relevantKnowledge: ContextChunk[];
  projectInfo: string;
  recentConversations: string[];
  codeContext: string[];
  totalContextTokens: number;
  architecturePatterns?: ArchitecturePattern[];
}

export class ContextInjectionService {
  private supabase;
  private maxContextTokens = 4000; // Reserve tokens for context
  private contextCache = new Map<string, { context: EnrichedContext; expiry: number; hitCount: number }>();
  private cacheExpiryMs = 5 * 60 * 1000; // 5 minutes
  
  // SECURITY: Pattern matching for prompt injection and sensitive data
  private securityFilters = {
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
      /\b[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, // Email
      /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, // Credit cards
      /\b(?:sk-|pk_live_|pk_test_)[A-Za-z0-9]{20,}\b/g, // API keys
      /\b[A-Fa-f0-9]{32,}\b/g, // Potential tokens
      /password\s*[:=]\s*[^\s\n]+/gi, // Passwords
      /token\s*[:=]\s*[^\s\n]+/gi, // Tokens
    ],
  };

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL || 'http://127.0.0.1:54321',
      process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || ''
    );
  }

  /**
   * Main method: Enrich any user request with relevant project context
   * SECURITY HARDENED: Includes input sanitization and validation
   */
  async enrichWithContext(
    userRequest: string,
    projectContext: ProjectContext
  ): Promise<{
    enrichedPrompt: string;
    contextSummary: string;
    sourcesUsed: string[];
    securityWarnings?: string[];
  }> {
    try {
      // SECURITY: First sanitize and validate input
      const { sanitizedRequest, securityWarnings } = this.sanitizeAndValidateInput(userRequest);
      
      log.info('🔍 Enriching request with project context', LogContext.CONTEXT_INJECTION, {
        requestLength: sanitizedRequest.length,
        originalLength: userRequest.length,
        workingDirectory: projectContext.workingDirectory,
        userId: projectContext.userId,
        securityWarnings: securityWarnings.length,
      });

      // Get cached context or build new one (using sanitized request)
      const cacheKey = this.buildCacheKey(sanitizedRequest, projectContext);
      let enrichedContext = this.getCachedContext(cacheKey);

      if (!enrichedContext) {
        enrichedContext = await this.buildEnrichedContext(sanitizedRequest, projectContext);
        
        // Add architecture patterns if requested
        if (projectContext.includeArchitecturePatterns) {
          enrichedContext.architecturePatterns = await this.getArchitecturePatterns(
            sanitizedRequest,
            projectContext
          );
        }
        
        this.cacheContext(cacheKey, enrichedContext);
      }

      // Build the enriched prompt (use sanitized request for context)
      const enrichedPrompt = this.buildEnrichedPrompt(sanitizedRequest, enrichedContext);

      // Create context summary for logging
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
    } catch (error) {
      log.error('❌ Context enrichment failed', LogContext.CONTEXT_INJECTION, {
        error: error instanceof Error ? error.message : String(error),
      });

      // Fallback: return original request with minimal context
      return {
        enrichedPrompt: this.buildFallbackPrompt(userRequest, projectContext),
        contextSummary: 'Context enrichment failed - using minimal context',
        sourcesUsed: [],
      };
    }
  }

  /**
   * SECURITY: Sanitize input and detect potential injection attacks
   */
  private sanitizeAndValidateInput(input: string): { 
    sanitizedRequest: string; 
    securityWarnings: string[] 
  } {
    const warnings: string[] = [];
    let sanitized = input;

    // Check for prompt injection patterns
    this.securityFilters.promptInjectionPatterns.forEach((pattern, index) => {
      if (pattern.test(sanitized)) {
        warnings.push(`Potential prompt injection detected (pattern ${index + 1})`);
        sanitized = sanitized.replace(pattern, '[FILTERED_CONTENT]');
      }
    });

    // Filter sensitive data
    this.securityFilters.sensitiveDataPatterns.forEach((pattern, index) => {
      const matches = sanitized.match(pattern);
      if (matches && matches.length > 0) {
        warnings.push(`Sensitive data filtered (${matches.length} instances)`);
        sanitized = sanitized.replace(pattern, '[REDACTED]');
      }
    });

    // Additional validation
    if (input.length > 10000) {
      warnings.push('Input length exceeds safe limits');
      sanitized = `${sanitized.substring(0, 10000)  }[TRUNCATED]`;
    }

    // Log security events
    if (warnings.length > 0) {
      log.warn('🚨 Security filtering applied to user input', LogContext.CONTEXT_INJECTION, {
        originalLength: input.length,
        sanitizedLength: sanitized.length,
        warnings: warnings.length,
      });
    }

    return { sanitizedRequest: sanitized, securityWarnings: warnings };
  }

  /**
   * SECURITY: Filter sensitive content from context
   */  
  private filterSensitiveContent(content: string): string {
    let filtered = content;
    
    this.securityFilters.sensitiveDataPatterns.forEach(pattern => {
      filtered = filtered.replace(pattern, '[REDACTED]');
    });

    return filtered;
  }

  /**
   * Build comprehensive context from multiple sources
   */
  private async buildEnrichedContext(
    userRequest: string,
    projectContext: ProjectContext
  ): Promise<EnrichedContext> {
    const [
      relevantKnowledge,
      projectInfo,
      recentConversations,
      codeContext,
    ] = await Promise.all([
      this.getRelevantKnowledge(userRequest, projectContext),
      this.getProjectInfo(projectContext),
      this.getRecentConversations(projectContext),
      this.getCodeContext(userRequest, projectContext),
    ]);

    // Calculate total token usage (rough estimate)
    const totalContextTokens = this.estimateTokens([
      ...relevantKnowledge.map(k => k.content),
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

  /**
   * Get relevant knowledge with mandatory user isolation (SECURITY CRITICAL)
   */
  private async getRelevantKnowledge(
    userRequest: string,
    projectContext: ProjectContext
  ): Promise<ContextChunk[]> {
    try {
      // SECURITY: Ensure user ID is present for data isolation
      if (!projectContext.userId) {
        log.warn('⚠️ No user ID provided - skipping knowledge retrieval for security', LogContext.CONTEXT_INJECTION);
        return [];
      }

      // First, generate embedding for the user request
      const embeddingResponse = await fetch('http://127.0.0.1:54321/functions/v1/ollama-embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
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

      // SECURITY: Use hybrid search with mandatory user filtering
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

      // SECURITY: Additional filtering to ensure only user's data is returned
      const userFilteredResults = searchResults?.filter((result: any) => 
        !result.user_id || result.user_id === projectContext.userId
      ) || [];

      return userFilteredResults.map((result: any) => ({
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
    } catch (error) {
      log.error('❌ Knowledge retrieval failed', LogContext.CONTEXT_INJECTION, {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * SECURITY: Secure text search with user filtering
   */
  private async getSecureTextSearchResults(userRequest: string, userId: string): Promise<ContextChunk[]> {
    const searchTerms = userRequest.toLowerCase().split(' ').filter(term => term.length > 3);
    const query = searchTerms.join(' | '); // PostgreSQL full-text search syntax

    const { data, error } = await this.supabase
      .from('knowledge_sources')
      .select('*')
      .eq('user_id', userId) // MANDATORY: Filter by user
      .textSearch('content', query)
      .limit(5);

    if (error) return [];

    return data?.map(item => ({
      id: item.id,
      content: this.filterSensitiveContent(item.content),
      source: item.source || 'knowledge_sources',
      relevanceScore: 0.5,
      type: 'knowledge' as const,
      metadata: item.metadata || {},
    })) || [];
  }

  /**
   * Get project-specific information
   */
  private async getProjectInfo(projectContext: ProjectContext): Promise<string> {
    try {
      // Get project metadata from working directory
      if (projectContext.workingDirectory) {
        const { data: projectData, error } = await this.supabase
          .from('documents')
          .select('content, name')
          .ilike('path', `%${projectContext.workingDirectory}%`)
          .or('name.ilike.%README%,name.ilike.%CLAUDE.md%,name.ilike.%package.json%')
          .limit(3);

        if (!error && projectData && projectData.length > 0) {
          return projectData.map(doc => `${doc.name}:\n${this.filterSensitiveContent(doc.content)}`).join('\n\n');
        }
      }

      // Fallback: get general project info
      const { data: generalInfo, error } = await this.supabase
        .from('knowledge_sources')
        .select('content')
        .eq('type', 'project_info')
        .limit(1)
        .single();

      return generalInfo?.content || 'No specific project information available.';
    } catch (error) {
      return 'Project information unavailable.';
    }
  }

  /**
   * Get recent conversation history for context
   */
  private async getRecentConversations(projectContext: ProjectContext): Promise<string[]> {
    try {
      if (!projectContext.userId) return [];

      const { data: conversations, error } = await this.supabase
        .from('conversation_messages')
        .select('content, role, created_at')
        .eq('user_id', projectContext.userId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) return [];

      return conversations?.map(msg => 
        `${msg.role}: ${this.filterSensitiveContent(msg.content.substring(0, 200))}${msg.content.length > 200 ? '...' : ''}`
      ) || [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Get relevant code context based on request
   */
  private async getCodeContext(
    userRequest: string,
    projectContext: ProjectContext
  ): Promise<string[]> {
    try {
      // Look for code-related documents
      const codeKeywords = ['function', 'class', 'import', 'export', 'const', 'let', 'var'];
      const hasCodeRequest = codeKeywords.some(keyword => 
        userRequest.toLowerCase().includes(keyword)
      );

      if (!hasCodeRequest) return [];

      const { data: codeFiles, error } = await this.supabase
        .from('documents')
        .select('content, name, path')
        .in('content_type', ['text/typescript', 'text/javascript', 'text/python', 'application/json'])
        .limit(5);

      if (error) return [];

      return codeFiles?.map(file => 
        `${file.name} (${file.path}):\n${this.filterSensitiveContent(file.content.substring(0, 500))}${file.content.length > 500 ? '...' : ''}`
      ) || [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Build the enriched prompt with context injection
   */
  private buildEnrichedPrompt(userRequest: string, context: EnrichedContext): string {
    let prompt = `IMPORTANT: Before processing the user request, you MUST consider the following project context and knowledge:\n\n`;

    // Add project information
    if (context.projectInfo) {
      prompt += `## PROJECT CONTEXT:\n${context.projectInfo}\n\n`;
    }

    // Add relevant knowledge
    if (context.relevantKnowledge.length > 0) {
      prompt += `## RELEVANT KNOWLEDGE:\n`;
      context.relevantKnowledge.forEach((chunk, index) => {
        prompt += `${index + 1}. ${chunk.source} (relevance: ${chunk.relevanceScore.toFixed(2)}):\n${chunk.content}\n\n`;
      });
    }

    // Add architecture patterns if available
    if (context.architecturePatterns && context.architecturePatterns.length > 0) {
      prompt += `## RECOMMENDED ARCHITECTURE PATTERNS:\n`;
      context.architecturePatterns.forEach((pattern, index) => {
        prompt += `${index + 1}. ${pattern.name} (${pattern.framework}):\n`;
        prompt += `   - Type: ${pattern.patternType}\n`;
        prompt += `   - Description: ${pattern.description}\n`;
        prompt += `   - Success Rate: ${(pattern.successRate * 100).toFixed(0)}%\n`;
        prompt += `   - Best For: ${pattern.useCases.slice(0, 2).join(', ')}\n`;
        if (pattern.implementation) {
          prompt += `   - Implementation Available: Yes\n`;
        }
        prompt += `\n`;
      });
    }

    // Add recent conversation context
    if (context.recentConversations.length > 0) {
      prompt += `## RECENT CONVERSATION HISTORY:\n`;
      context.recentConversations.slice(0, 3).forEach(conv => {
        prompt += `${conv}\n`;
      });
      prompt += `\n`;
    }

    // Add code context if available
    if (context.codeContext.length > 0) {
      prompt += `## RELEVANT CODE CONTEXT:\n`;
      context.codeContext.forEach(code => {
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

  /**
   * Build fallback prompt when context enrichment fails
   */
  private buildFallbackPrompt(userRequest: string, projectContext: ProjectContext): string {
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

  /**
   * Utility methods
   */
  private buildCacheKey(userRequest: string, projectContext: ProjectContext): string {
    const keyParts = [
      userRequest.substring(0, 100),
      projectContext.workingDirectory || '',
      projectContext.userId || '',
      projectContext.currentProject || '',
    ];
    return Buffer.from(keyParts.join('|')).toString('base64');
  }

  private getCachedContext(cacheKey: string): EnrichedContext | null {
    const cached = this.contextCache.get(cacheKey);
    if (cached && Date.now() < cached.expiry) {
      // Update hit count for analytics
      cached.hitCount += 1;
      return cached.context;
    }
    this.contextCache.delete(cacheKey);
    return null;
  }

  private cacheContext(cacheKey: string, context: EnrichedContext): void {
    this.contextCache.set(cacheKey, {
      context,
      expiry: Date.now() + this.cacheExpiryMs,
      hitCount: 0,
    });
  }

  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  private determineContentType(result: any): 'document' | 'code' | 'conversation' | 'knowledge' {
    if (result.table_name === 'conversation_messages') return 'conversation';
    if (result.table_name === 'documents') return 'document';
    if (result.content_type?.includes('javascript') || result.content_type?.includes('typescript')) return 'code';
    return 'knowledge';
  }

  private createContextSummary(context: EnrichedContext): string {
    return `Used ${context.relevantKnowledge.length} knowledge chunks, ${context.recentConversations.length} recent conversations, ${context.codeContext.length} code files. Total context tokens: ${context.totalContextTokens}`;
  }

  private extractSources(context: EnrichedContext): string[] {
    return [...new Set(context.relevantKnowledge.map(k => k.source))];
  }

  /**
   * Get relevant architecture patterns for the request
   */
  private async getArchitecturePatterns(
    userRequest: string,
    projectContext: ProjectContext
  ): Promise<ArchitecturePattern[]> {
    try {
      log.info('🏗️ Fetching architecture patterns', LogContext.CONTEXT_INJECTION, {
        requestLength: userRequest.length,
      });

      // Build pattern matching context
      const matchingContext = {
        userRequest,
        agentType: projectContext.metadata?.agentType,
        taskComplexity: this.assessTaskComplexity(userRequest),
        requiredCapabilities: projectContext.metadata?.capabilities,
      };

      // Get relevant patterns from architecture advisor
      const recommendations = await architectureAdvisor.getRelevantPatterns(matchingContext, {
        threshold: 0.6,
        limit: 3,
        includeRelated: false,
      });

      // Extract just the patterns
      const patterns = recommendations.map(rec => rec.pattern);

      log.info('✅ Found architecture patterns', LogContext.CONTEXT_INJECTION, {
        patternCount: patterns.length,
        topPattern: patterns[0]?.name,
      });

      return patterns;
    } catch (error) {
      log.error('❌ Failed to get architecture patterns', LogContext.CONTEXT_INJECTION, {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Assess task complexity from request
   */
  private assessTaskComplexity(request: string): 'simple' | 'medium' | 'complex' {
    const complexKeywords = ['integrate', 'orchestrate', 'distributed', 'multi-agent', 'workflow', 'architecture'];
    const simpleKeywords = ['simple', 'basic', 'single', 'straightforward'];
    
    const reqLower = request.toLowerCase();
    const complexCount = complexKeywords.filter(k => reqLower.includes(k)).length;
    const simpleCount = simpleKeywords.filter(k => reqLower.includes(k)).length;
    
    if (complexCount > 2 || request.length > 500) return 'complex';
    if (simpleCount > 1 || request.length < 100) return 'simple';
    
    return 'medium';
  }

  /**
   * Clear cache (useful for development/testing)
   */
  public clearCache(): void {
    this.contextCache.clear();
    log.info('🧹 Context cache cleared', LogContext.CONTEXT_INJECTION);
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): { size: number; hitRate: number } {
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