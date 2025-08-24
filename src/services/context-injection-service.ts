/**
 * Context Injection Service - Automatic Project Context for All LLM Calls
 * Ensures every LLM interaction has access to relevant project knowledge
 * SECURITY HARDENED: Includes prompt injection protection and data isolation
 * ENHANCED: Uses comprehensive chunking system for better performance and accuracy
 */

import { createClient } from '@supabase/supabase-js';

import type { ArchitecturePattern } from '@/types/architecture';
import { log, LogContext } from '@/utils/logger';

import { architectureAdvisor } from './architecture-advisor-service';
import { 
  type Chunk, 
  type ChunkingConfig, 
  type ChunkingResult,
  chunkingService, 
  type ChunkMetadata 
} from './chunking/chunking-service';
import { crawl4aiKnowledgeService } from './crawl4ai-knowledge-service';

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
  // Enhanced with comprehensive chunking data
  originalChunk?: Chunk;
  chunkLevel?: number;
  chunkingStrategy?: string;
  chunkingMetadata?: ChunkMetadata;
  contentType?: string;
  tokenCount?: number;
  hash?: string;
  parentChunkId?: string;
  semanticScore?: number;
  qualityMetrics?: {
    coherence: number;
    completeness: number;
    relevance: number;
  };
}

interface EnrichedContext {
  relevantKnowledge: ContextChunk[];
  projectInfo: string;
  recentConversations: string[];
  codeContext: string[];
  totalContextTokens: number;
  architecturePatterns?: ArchitecturePattern[];
  // Enhanced chunking integration
  chunkingResult?: ChunkingResult;
  chunkingConfig?: ChunkingConfig;
  chunkHierarchy?: Array<{
    chunk: ContextChunk;
    children: ContextChunk[];
    depth: number;
  }>;
  chunkingStats?: {
    totalChunks: number;
    averageChunkSize: number;
    strategiesUsed: string[];
    qualityScore: number;
  };
}

export class ContextInjectionService {
  private supabase;
  private maxContextTokens = 4000; // Reserve tokens for context
  private contextCache = new Map<
    string,
    { context: EnrichedContext; expiry: number; hitCount: number; chunksUsed: number }
  >();
  private chunkCache = new Map<
    string,
    { chunks: ContextChunk[]; expiry: number; sourceHash: string }
  >();
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
    securityWarnings: string[];
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
      sanitized = `${sanitized.substring(0, 10000)}[TRUNCATED]`;
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

    this.securityFilters.sensitiveDataPatterns.forEach((pattern) => {
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
    const [relevantKnowledge, projectInfo, recentConversations, codeContext] = await Promise.all([
      this.getRelevantKnowledge(userRequest, projectContext),
      this.getProjectInfo(projectContext),
      this.getRecentConversations(projectContext),
      this.getCodeContext(userRequest, projectContext),
    ]);

    // Calculate total token usage (rough estimate)
    const totalContextTokens = this.estimateTokens(
      [
        ...relevantKnowledge.map((k) => k.content),
        projectInfo,
        ...recentConversations,
        ...codeContext,
      ].join(' ')
    );

    return {
      relevantKnowledge,
      projectInfo,
      recentConversations,
      codeContext,
      totalContextTokens,
    };
  }

  /**
   * Get relevant knowledge with comprehensive chunking and mandatory user isolation (SECURITY CRITICAL)
   */
  private async getRelevantKnowledge(
    userRequest: string,
    projectContext: ProjectContext
  ): Promise<ContextChunk[]> {
    try {
      // SECURITY: Ensure user ID is present for data isolation
      if (!projectContext.userId) {
        log.warn(
          '⚠️ No user ID provided - skipping knowledge retrieval for security',
          LogContext.CONTEXT_INJECTION
        );
        return [];
      }

      log.info('🔍 Retrieving relevant knowledge with chunking', LogContext.CONTEXT_INJECTION, {
        userRequest: userRequest.substring(0, 100),
        userId: projectContext.userId,
        workingDirectory: projectContext.workingDirectory
      });

      // Check chunk cache first
      const cacheKey = this.buildChunkCacheKey(userRequest, projectContext);
      const cachedChunks = this.getCachedChunks(cacheKey);
      if (cachedChunks) {
        log.info('📋 Using cached chunks', LogContext.CONTEXT_INJECTION, {
          cachedChunksCount: cachedChunks.length
        });
        return cachedChunks;
      }

      // Step 1: Retrieve raw content with user isolation
      const rawContent = await this.getRawUserContent(userRequest, projectContext.userId);
      if (rawContent.length === 0) {
        return [];
      }

      // Step 2: Determine optimal chunking configuration
      const chunkingConfig = await this.determineOptimalChunkingConfig(userRequest, rawContent);

      // Step 3: Process content through comprehensive chunking system
      const relevantChunks: ContextChunk[] = [];
      
      for (const content of rawContent) {
        try {
          // Create document ID for chunking
          const documentId = `context_${content.id}_${Date.now()}`;
          
          // Apply comprehensive chunking
          const chunkingResult = await chunkingService.chunkDocument(
            content.content,
            documentId,
            chunkingConfig
          );

          // Convert chunks to ContextChunks and filter by relevance
          const contextChunks = await this.convertAndFilterChunks(
            chunkingResult.chunks,
            userRequest,
            content,
            projectContext
          );

          relevantChunks.push(...contextChunks);

        } catch (chunkingError) {
          log.warn('⚠️ Chunking failed for content, using fallback', LogContext.CONTEXT_INJECTION, {
            contentId: content.id,
            error: chunkingError instanceof Error ? chunkingError.message : String(chunkingError)
          });

          // Fallback to simple chunking
          const fallbackChunk = await this.createFallbackChunk(content, userRequest, projectContext);
          if (fallbackChunk) {
            relevantChunks.push(fallbackChunk);
          }
        }
      }

      // Step 4: Rank and select top chunks
      const selectedChunks = await this.rankAndSelectChunks(relevantChunks, userRequest, 10);

      // Step 5: Cache the results
      this.cacheChunks(cacheKey, selectedChunks, rawContent);

      log.info('✅ Knowledge retrieval with chunking completed', LogContext.CONTEXT_INJECTION, {
        totalRawContent: rawContent.length,
        totalChunks: relevantChunks.length,
        selectedChunks: selectedChunks.length,
        avgChunkSize: selectedChunks.reduce((sum, c) => sum + c.content.length, 0) / selectedChunks.length,
        avgRelevanceScore: selectedChunks.reduce((sum, c) => sum + c.relevanceScore, 0) / selectedChunks.length
      });

      return selectedChunks;

    } catch (error) {
      log.error('❌ Knowledge retrieval with chunking failed', LogContext.CONTEXT_INJECTION, {
        error: error instanceof Error ? error.message : String(error),
      });
      
      // Fallback to basic retrieval
      return await this.getSecureTextSearchResults(userRequest, projectContext.userId || '');
    }
  }

  /**
   * Retrieve raw content from multiple sources with user isolation
   */
  private async getRawUserContent(
    userRequest: string,
    userId: string
  ): Promise<Array<{ id: string; content: string; source: string; metadata: any }>> {
    const rawContent: Array<{ id: string; content: string; source: string; metadata: any }> = [];

    try {
      // Get content from knowledge sources
      const { data: knowledgeData, error: knowledgeError } = await this.supabase
        .from('knowledge_sources')
        .select('*')
        .eq('user_id', userId)
        .limit(20);

      if (!knowledgeError && knowledgeData) {
        rawContent.push(...knowledgeData.map(item => ({
          id: item.id,
          content: this.filterSensitiveContent(item.content),
          source: 'knowledge_sources',
          metadata: item.metadata || {}
        })));
      }

      // Get content from documents
      const { data: documentsData, error: documentsError } = await this.supabase
        .from('documents')
        .select('*')
        .eq('user_id', userId)
        .limit(15);

      if (!documentsError && documentsData) {
        rawContent.push(...documentsData.map(item => ({
          id: item.id,
          content: this.filterSensitiveContent(item.content),
          source: 'documents',
          metadata: { path: item.path, content_type: item.content_type }
        })));
      }

      // Get relevant conversation history
      const { data: conversationData, error: conversationError } = await this.supabase
        .from('conversation_messages')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!conversationError && conversationData) {
        rawContent.push(...conversationData.map(item => ({
          id: item.id,
          content: this.filterSensitiveContent(item.content),
          source: 'conversation_messages',
          metadata: { role: item.role, created_at: item.created_at }
        })));
      }

    } catch (error) {
      log.error('❌ Failed to retrieve raw user content', LogContext.CONTEXT_INJECTION, {
        error: error instanceof Error ? error.message : String(error)
      });
    }

    return rawContent;
  }

  /**
   * Determine optimal chunking configuration based on request and content
   */
  private async determineOptimalChunkingConfig(
    userRequest: string,
    rawContent: Array<{ content: string; source: string }>
  ): Promise<ChunkingConfig> {
    // Analyze the combined content to determine optimal strategy
    const totalLength = rawContent.reduce((sum, item) => sum + item.content.length, 0);
    const avgLength = totalLength / rawContent.length;
    
    // Detect content types
    const hasCode = rawContent.some(item => 
      /```|function|class|import|export/.test(item.content)
    );
    const hasTechnicalContent = /api|endpoint|database|server|client/.test(userRequest.toLowerCase());
    
    // Determine content type
    let contentType: 'prose' | 'code' | 'mixed' | 'data' = 'prose';
    if (hasCode && hasTechnicalContent) {
      contentType = 'mixed';
    } else if (hasCode) {
      contentType = 'code';
    } else if (rawContent.some(item => item.source === 'conversation_messages')) {
      contentType = 'mixed';
    }

    // Determine strategy based on content analysis
    let strategy: 'semantic' | 'hierarchical' | 'hybrid' | 'fixed' = 'hybrid';
    if (contentType === 'code') {
      strategy = 'hierarchical';
    } else if (avgLength > 2000) {
      strategy = 'semantic';
    } else if (totalLength < 1000) {
      strategy = 'fixed';
    }

    const config: ChunkingConfig = {
      strategy,
      maxChunkSize: Math.min(1200, Math.max(800, avgLength * 0.8)),
      minChunkSize: 100,
      overlapRatio: contentType === 'code' ? 0.05 : 0.15,
      preserveStructure: hasCode,
      contentType,
      targetEmbeddingModel: 'auto',
      enableMetadata: true,
      hierarchyLevels: contentType === 'code' ? 4 : 3
    };

    log.info('📊 Chunking configuration determined', LogContext.CONTEXT_INJECTION, {
      strategy: config.strategy,
      contentType: config.contentType,
      maxChunkSize: config.maxChunkSize,
      hasCode,
      totalContent: rawContent.length
    });

    return config;
  }

  /**
   * Convert chunking service chunks to ContextChunks and filter by relevance
   */
  private async convertAndFilterChunks(
    chunks: Chunk[],
    userRequest: string,
    sourceContent: { id: string; source: string; metadata: any },
    projectContext: ProjectContext
  ): Promise<ContextChunk[]> {
    const contextChunks: ContextChunk[] = [];

    for (const chunk of chunks) {
      try {
        // Calculate relevance score
        const relevanceScore = await this.calculateChunkRelevance(chunk.content, userRequest);
        
        // Skip chunks with very low relevance
        if (relevanceScore < 0.2) {
          continue;
        }

        const contextChunk: ContextChunk = {
          id: chunk.id,
          content: chunk.content,
          source: sourceContent.source,
          relevanceScore,
          type: this.determineContentTypeFromChunk(chunk, sourceContent),
          metadata: {
            ...chunk.metadata,
            originalSourceId: sourceContent.id,
            chunkLevel: chunk.level,
            tokenCount: chunk.tokenCount,
            semanticScore: chunk.metadata.semanticScore
          },
          chunkingMetadata: chunk.metadata,
          contentType: chunk.contentType,
          tokenCount: chunk.tokenCount,
          hash: chunk.hash
        };

        contextChunks.push(contextChunk);

      } catch (error) {
        log.warn('⚠️ Failed to convert chunk', LogContext.CONTEXT_INJECTION, {
          chunkId: chunk.id,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return contextChunks;
  }

  /**
   * Calculate relevance score between chunk content and user request
   */
  private async calculateChunkRelevance(chunkContent: string, userRequest: string): Promise<number> {
    try {
      // Simple keyword-based relevance for now - could be enhanced with embeddings
      const requestWords = userRequest.toLowerCase().split(/\s+/).filter(word => word.length > 3);
      const chunkWords = chunkContent.toLowerCase().split(/\s+/);
      
      let relevanceScore = 0;
      const totalWords = requestWords.length;

      for (const word of requestWords) {
        const wordCount = chunkWords.filter(cWord => cWord.includes(word)).length;
        if (wordCount > 0) {
          relevanceScore += Math.min(wordCount / chunkWords.length * 10, 1);
        }
      }

      // Normalize score
      const normalizedScore = totalWords > 0 ? relevanceScore / totalWords : 0;
      
      // Boost score for chunks with higher semantic scores
      const semanticBoost = 0.1; // Would be actual semantic score from chunk metadata
      
      return Math.min(normalizedScore + semanticBoost, 1.0);

    } catch (error) {
      log.warn('⚠️ Failed to calculate chunk relevance', LogContext.CONTEXT_INJECTION, {
        error: error instanceof Error ? error.message : String(error)
      });
      return 0.5; // Default relevance
    }
  }

  /**
   * Determine content type from chunk and source information
   */
  private determineContentTypeFromChunk(
    chunk: Chunk,
    sourceContent: { source: string; metadata: any }
  ): 'document' | 'code' | 'conversation' | 'knowledge' {
    if (sourceContent.source === 'conversation_messages') {
      return 'conversation';
    }
    
    if (sourceContent.source === 'documents') {
      const contentType = sourceContent.metadata?.content_type;
      if (contentType?.includes('javascript') || contentType?.includes('typescript') || 
          /```|function|class|import/.test(chunk.content)) {
        return 'code';
      }
      return 'document';
    }

    if (sourceContent.source === 'knowledge_sources') {
      return 'knowledge';
    }

    return 'document';
  }

  /**
   * Create fallback chunk when comprehensive chunking fails
   */
  private async createFallbackChunk(
    content: { id: string; content: string; source: string; metadata: any },
    userRequest: string,
    projectContext: ProjectContext
  ): Promise<ContextChunk | null> {
    try {
      const relevanceScore = await this.calculateChunkRelevance(content.content, userRequest);
      
      if (relevanceScore < 0.3) {
        return null;
      }

      // Create simplified chunk
      const fallbackChunk: ContextChunk = {
        id: `fallback_${content.id}`,
        content: content.content.length > 1500 
          ? content.content.substring(0, 1500) + '...'
          : content.content,
        source: content.source,
        relevanceScore,
        type: this.determineContentType({ table_name: content.source, content_type: content.metadata?.content_type }),
        metadata: {
          ...content.metadata,
          fallback: true,
          originalLength: content.content.length
        },
        contentType: content.metadata?.content_type || 'mixed',
        tokenCount: Math.ceil(content.content.length / 4),
        hash: this.generateSimpleHash(content.content)
      };

      return fallbackChunk;

    } catch (error) {
      log.warn('⚠️ Failed to create fallback chunk', LogContext.CONTEXT_INJECTION, {
        contentId: content.id,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }

  /**
   * Rank and select top chunks based on relevance and diversity
   */
  private async rankAndSelectChunks(
    chunks: ContextChunk[],
    userRequest: string,
    limit: number
  ): Promise<ContextChunk[]> {
    // Sort by relevance score first
    const sortedChunks = chunks.sort((a, b) => b.relevanceScore - a.relevanceScore);
    
    // Apply diversity filtering to avoid duplicate information
    const selectedChunks: ContextChunk[] = [];
    const usedContent = new Set<string>();

    for (const chunk of sortedChunks) {
      if (selectedChunks.length >= limit) {
        break;
      }

      // Check for content similarity to avoid duplicates
      const contentHash = this.generateSimpleHash(chunk.content.substring(0, 200));
      if (usedContent.has(contentHash)) {
        continue;
      }

      selectedChunks.push(chunk);
      usedContent.add(contentHash);
    }

    // Sort final selection by relevance and source priority
    return selectedChunks.sort((a, b) => {
      // Prioritize certain source types
      const sourcePriority = { 'knowledge_sources': 3, 'documents': 2, 'conversation_messages': 1 };
      const aPriority = sourcePriority[a.source as keyof typeof sourcePriority] || 0;
      const bPriority = sourcePriority[b.source as keyof typeof sourcePriority] || 0;
      
      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }
      
      return b.relevanceScore - a.relevanceScore;
    });
  }

  /**
   * Cache management for chunks
   */
  private buildChunkCacheKey(userRequest: string, projectContext: ProjectContext): string {
    const keyParts = [
      userRequest.substring(0, 100),
      projectContext.userId || '',
      projectContext.workingDirectory || '',
      'chunks'
    ];
    return Buffer.from(keyParts.join('|')).toString('base64');
  }

  private getCachedChunks(cacheKey: string): ContextChunk[] | null {
    const cached = this.chunkCache.get(cacheKey);
    if (cached && Date.now() < cached.expiry) {
      return cached.chunks;
    }
    this.chunkCache.delete(cacheKey);
    return null;
  }

  private cacheChunks(
    cacheKey: string,
    chunks: ContextChunk[],
    rawContent: Array<{ content: string }>
  ): void {
    const sourceHash = this.generateSimpleHash(
      rawContent.map(c => c.content.substring(0, 100)).join('')
    );
    
    this.chunkCache.set(cacheKey, {
      chunks,
      expiry: Date.now() + this.cacheExpiryMs,
      sourceHash
    });
  }

  private generateSimpleHash(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  /**
   * Group chunks by source for better organization in prompts
   */
  private groupChunksBySource(chunks: ContextChunk[]): Record<string, ContextChunk[]> {
    return chunks.reduce((groups, chunk) => {
      const {source} = chunk;
      if (!groups[source]) {
        groups[source] = [];
      }
      groups[source].push(chunk);
      return groups;
    }, {} as Record<string, ContextChunk[]>);
  }

  /**
   * SECURITY: Secure text search with user filtering
   */
  private async getSecureTextSearchResults(
    userRequest: string,
    userId: string
  ): Promise<ContextChunk[]> {
    const searchTerms = userRequest
      .toLowerCase()
      .split(' ')
      .filter((term) => term.length > 3);
    const query = searchTerms.join(' | '); // PostgreSQL full-text search syntax

    const { data, error } = await this.supabase
      .from('knowledge_sources')
      .select('*')
      .eq('user_id', userId) // MANDATORY: Filter by user
      .textSearch('content', query)
      .limit(5);

    if (error) {return [];}

    return (
      data?.map((item) => ({
        id: item.id,
        content: this.filterSensitiveContent(item.content),
        source: item.source || 'knowledge_sources',
        relevanceScore: 0.5,
        type: 'knowledge' as const,
        metadata: item.metadata || {},
      })) || []
    );
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
          return projectData
            .map((doc) => `${doc.name}:\n${this.filterSensitiveContent(doc.content)}`)
            .join('\n\n');
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
      if (!projectContext.userId) {return [];}

      const { data: conversations, error } = await this.supabase
        .from('conversation_messages')
        .select('content, role, created_at')
        .eq('user_id', projectContext.userId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {return [];}

      return (
        conversations?.map(
          (msg) =>
            `${msg.role}: ${this.filterSensitiveContent(msg.content.substring(0, 200))}${msg.content.length > 200 ? '...' : ''}`
        ) || []
      );
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
      const hasCodeRequest = codeKeywords.some((keyword) =>
        userRequest.toLowerCase().includes(keyword)
      );

      if (!hasCodeRequest) {return [];}

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

      if (error) {return [];}

      return (
        codeFiles?.map(
          (file) =>
            `${file.name} (${file.path}):\n${this.filterSensitiveContent(file.content.substring(0, 500))}${file.content.length > 500 ? '...' : ''}`
        ) || []
      );
    } catch (error) {
      return [];
    }
  }

  /**
   * Build the enriched prompt with enhanced context injection using chunking information
   */
  private buildEnrichedPrompt(userRequest: string, context: EnrichedContext): string {
    let prompt = `IMPORTANT: Before processing the user request, you MUST consider the following intelligently chunked project context and knowledge:\n\n`;

    // Add project information
    if (context.projectInfo) {
      prompt += `## PROJECT CONTEXT:\n${context.projectInfo}\n\n`;
    }

    // Add relevant knowledge with enhanced chunk information
    if (context.relevantKnowledge.length > 0) {
      prompt += `## RELEVANT KNOWLEDGE (${context.relevantKnowledge.length} intelligent chunks):\n`;
      
      // Group chunks by source for better organization
      const chunksBySource = this.groupChunksBySource(context.relevantKnowledge);
      
      Object.entries(chunksBySource).forEach(([source, chunks]) => {
        prompt += `\n### ${source.toUpperCase()} (${chunks.length} chunks):\n`;
        
        chunks.forEach((chunk, index) => {
          const metadata = chunk.chunkingMetadata;
          const qualityInfo = metadata ? 
            ` [semantic: ${metadata.semanticScore.toFixed(2)}, tokens: ${chunk.tokenCount}]` : 
            ` [tokens: ${chunk.tokenCount}]`;
          
          prompt += `${index + 1}. **${chunk.type.toUpperCase()}** (relevance: ${chunk.relevanceScore.toFixed(2)}${qualityInfo}):\n`;
          prompt += `${chunk.content}\n\n`;
          
          // Add structural context if available
          if (metadata?.structuralElements && metadata.structuralElements.length > 0) {
            const structures = metadata.structuralElements.slice(0, 3).map(s => s.type).join(', ');
            prompt += `   *Structural elements: ${structures}*\n\n`;
          }
        });
      });
      
      // Add chunking quality summary
      if (context.chunkingResult) {
        const avgSemanticScore = context.relevantKnowledge.reduce((sum, c) => 
          sum + (c.chunkingMetadata?.semanticScore || 0.5), 0) / context.relevantKnowledge.length;
        
        prompt += `**Chunking Quality**: Average semantic coherence: ${avgSemanticScore.toFixed(2)}, `;
        prompt += `Strategy used: ${context.chunkingConfig?.strategy || 'hybrid'}, `;
        prompt += `Total processing time: ${context.chunkingResult.documentMetadata.processingTime}ms\n\n`;
      }
    }

    // Add architecture patterns if available
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

    // Add recent conversation context
    if (context.recentConversations.length > 0) {
      prompt += `## RECENT CONVERSATION HISTORY:\n`;
      context.recentConversations.slice(0, 3).forEach((conv) => {
        prompt += `${conv}\n`;
      });
      prompt += `\n`;
    }

    // Add code context if available
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
      chunksUsed: context.relevantKnowledge.length,
    });
  }

  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  private determineContentType(result: any): 'document' | 'code' | 'conversation' | 'knowledge' {
    if (result.table_name === 'conversation_messages') {return 'conversation';}
    if (result.table_name === 'documents') {return 'document';}
    if (result.content_type?.includes('javascript') || result.content_type?.includes('typescript')) {return 'code';}
    return 'knowledge';
  }

  private createContextSummary(context: EnrichedContext): string {
    return `Used ${context.relevantKnowledge.length} knowledge chunks, ${context.recentConversations.length} recent conversations, ${context.codeContext.length} code files. Total context tokens: ${context.totalContextTokens}`;
  }

  private extractSources(context: EnrichedContext): string[] {
    return [...new Set(context.relevantKnowledge.map((k) => k.source))];
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
      const recommendations = await architectureAdvisor.getRelevantPatterns(
        JSON.stringify(matchingContext),
        {
          threshold: 0.6,
          limit: 3,
          includeRelated: false,
        }
      );

      // Extract just the patterns
      const patterns = recommendations.map((rec: any) => rec.pattern);

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

    if (complexCount > 2 || request.length > 500) {return 'complex';}
    if (simpleCount > 1 || request.length < 100) {return 'simple';}

    return 'medium';
  }

  /**
   * Clear all caches (useful for development/testing)
   */
  public clearCache(): void {
    this.contextCache.clear();
    this.chunkCache.clear();
    log.info('🧹 All caches cleared (context + chunks)', LogContext.CONTEXT_INJECTION);
  }

  /**
   * Clear only chunk cache
   */
  public clearChunkCache(): void {
    this.chunkCache.clear();
    log.info('🧹 Chunk cache cleared', LogContext.CONTEXT_INJECTION);
  }

  /**
   * Get cache statistics including chunk cache information
   */
  public getCacheStats(): { 
    size: number; 
    hitRate: number; 
    chunksCache: { size: number; totalChunks: number };
    avgChunksPerEntry: number;
  } {
    const totalHits = Array.from(this.contextCache.values()).reduce(
      (sum, entry) => sum + entry.hitCount,
      0
    );
    const totalEntries = this.contextCache.size;
    const totalChunksUsed = Array.from(this.contextCache.values()).reduce(
      (sum, entry) => sum + entry.chunksUsed,
      0
    );
    
    const chunksCacheSize = this.chunkCache.size;
    const totalCachedChunks = Array.from(this.chunkCache.values()).reduce(
      (sum, entry) => sum + entry.chunks.length,
      0
    );
    
    return {
      size: totalEntries,
      hitRate: totalEntries > 0 ? totalHits / totalEntries : 0,
      chunksCache: {
        size: chunksCacheSize,
        totalChunks: totalCachedChunks
      },
      avgChunksPerEntry: totalEntries > 0 ? totalChunksUsed / totalEntries : 0,
    };
  }

  /**
   * Enhanced knowledge retrieval with comprehensive chunking
   */
  async getRelevantKnowledgeWithChunking(
    userRequest: string,
    projectContext: ProjectContext,
    chunkingConfig?: Partial<ChunkingConfig>
  ): Promise<ContextChunk[]> {
    try {
      log.info('🧠 Retrieving knowledge with comprehensive chunking', LogContext.CONTEXT_INJECTION, {
        requestLength: userRequest.length,
        userId: projectContext.userId
      });

      // Step 1: Get comprehensive knowledge using Crawl4AI service
      const knowledgeResult = await crawl4aiKnowledgeService.acquireKnowledge({
        query: userRequest,
        maxSources: 5,
        deepCrawl: true,
        enableChunking: true,
        chunkingConfig: {
          strategy: 'hybrid',
          maxChunkSize: 1200,
          preserveStructure: true,
          contentType: 'mixed',
          enableMetadata: true,
          ...chunkingConfig
        }
      });

      // Step 2: Convert knowledge sources to context chunks
      const contextChunks = this.convertKnowledgeSourcesToContextChunks(knowledgeResult.sources);

      // Step 3: Apply additional relevance scoring
      const rankedChunks = await this.rankChunksByRelevance(contextChunks, userRequest);

      // Step 4: Select optimal chunks based on context constraints
      const selectedChunks = this.selectOptimalChunks(rankedChunks, this.maxContextTokens * 0.7);

      log.info('✅ Knowledge retrieval with chunking completed', LogContext.CONTEXT_INJECTION, {
        totalSources: knowledgeResult.sources.length,
        chunksExtracted: contextChunks.length,
        chunksSelected: selectedChunks.length,
        avgRelevance: selectedChunks.reduce((sum, c) => sum + c.relevanceScore, 0) / selectedChunks.length
      });

      return selectedChunks;

    } catch (error) {
      log.error('❌ Enhanced knowledge retrieval failed', LogContext.CONTEXT_INJECTION, {
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Fallback to traditional method
      return this.getRelevantKnowledge(userRequest, projectContext);
    }
  }

  /**
   * Convert knowledge sources to context chunks
   */
  private convertKnowledgeSourcesToContextChunks(sources: any[]): ContextChunk[] {
    const contextChunks: ContextChunk[] = [];

    for (const source of sources) {
      if (!source.chunks) {continue;}

      for (const chunk of source.chunks) {
        const contextChunk: ContextChunk = {
          id: chunk.id,
          content: chunk.content,
          source: source.url,
          relevanceScore: source.relevanceScore || 0.5,
          type: 'knowledge',
          metadata: {
            title: source.title,
            url: source.url,
            acquisitionTimestamp: source.acquisitionTimestamp,
            credibilityScore: source.credibilityScore
          },
          originalChunk: chunk,
          chunkLevel: chunk.level,
          chunkingStrategy: chunk.metadata.sourceType,
          chunkingMetadata: chunk.metadata,
          contentType: chunk.contentType,
          tokenCount: chunk.tokenCount,
          hash: chunk.hash,
          parentChunkId: chunk.parentChunkId,
          semanticScore: chunk.metadata.semanticScore,
          qualityMetrics: {
            coherence: chunk.metadata.semanticScore,
            completeness: this.calculateCompleteness(chunk),
            relevance: source.relevanceScore || 0.5
          }
        };

        contextChunks.push(contextChunk);
      }
    }

    return contextChunks;
  }

  /**
   * Rank chunks by relevance using advanced scoring
   */
  private async rankChunksByRelevance(
    chunks: ContextChunk[],
    userRequest: string
  ): Promise<ContextChunk[]> {
    const rankedChunks = [...chunks];

    for (const chunk of rankedChunks) {
      // Calculate comprehensive relevance score
      let {relevanceScore} = chunk;

      // Boost score based on semantic quality
      if (chunk.semanticScore && chunk.semanticScore > 0.7) {
        relevanceScore *= 1.2;
      }

      // Boost score for hierarchical chunks with good structure
      if (chunk.chunkLevel === 1 && chunk.originalChunk?.childChunkIds && chunk.originalChunk.childChunkIds.length > 0) {
        relevanceScore *= 1.1;
      }

      // Boost score based on chunking strategy effectiveness
      const strategyBoost = {
        'semantic': 1.15,
        'hierarchical': 1.1,
        'hybrid': 1.2,
        'basic': 1.0
      };
      const boost = strategyBoost[chunk.chunkingStrategy as keyof typeof strategyBoost] || 1.0;
      relevanceScore *= boost;

      // Apply quality metrics boost
      if (chunk.qualityMetrics) {
        const qualityScore = (
          chunk.qualityMetrics.coherence +
          chunk.qualityMetrics.completeness +
          chunk.qualityMetrics.relevance
        ) / 3;
        relevanceScore *= (0.8 + qualityScore * 0.4); // 0.8-1.2 multiplier
      }

      chunk.relevanceScore = Math.min(relevanceScore, 1.0);
    }

    return rankedChunks.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * Select optimal chunks considering hierarchical relationships
   */
  private selectOptimalChunks(chunks: ContextChunk[], maxTokens: number): ContextChunk[] {
    const selected: ContextChunk[] = [];
    const usedTokens = { count: 0 };
    const usedContent = new Set<string>();

    // First pass: select top-level chunks with high relevance
    for (const chunk of chunks) {
      if (usedTokens.count >= maxTokens) {break;}

      // Prefer top-level chunks initially
      if (chunk.chunkLevel === 0 || chunk.chunkLevel === 1) {
        if (this.tryAddChunk(chunk, selected, usedTokens, maxTokens, usedContent)) {
          continue;
        }
      }
    }

    // Second pass: fill remaining space with best chunks regardless of level
    for (const chunk of chunks) {
      if (usedTokens.count >= maxTokens) {break;}

      this.tryAddChunk(chunk, selected, usedTokens, maxTokens, usedContent);
    }

    return selected;
  }

  /**
   * Try to add a chunk if it fits within constraints
   */
  private tryAddChunk(
    chunk: ContextChunk,
    selected: ContextChunk[],
    usedTokens: { count: number },
    maxTokens: number,
    usedContent: Set<string>
  ): boolean {
    const chunkTokens = chunk.tokenCount || Math.ceil(chunk.content.length / 4);
    
    if (usedTokens.count + chunkTokens > maxTokens) {
      return false;
    }

    // Check for content duplication
    const contentHash = chunk.hash || this.generateSimpleHash(chunk.content.substring(0, 100));
    if (usedContent.has(contentHash)) {
      return false;
    }

    selected.push(chunk);
    usedTokens.count += chunkTokens;
    usedContent.add(contentHash);
    return true;
  }

  /**
   * Calculate chunk completeness score
   */
  private calculateCompleteness(chunk: Chunk): number {
    let completeness = 0.5; // Base score

    // Check for complete sentences
    const sentences = chunk.content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length > 0) {
      const lastSentence = sentences[sentences.length - 1]?.trim();
      if (lastSentence && lastSentence.length > 10 && chunk.content.trim().endsWith('.')) {
        completeness += 0.2;
      }
    }

    // Check for structural elements
    if (chunk.metadata.structuralElements.length > 0) {
      completeness += 0.2;
    }

    // Check for appropriate length
    if (chunk.content.length > 100 && chunk.content.length < 2000) {
      completeness += 0.1;
    }

    return Math.min(completeness, 1.0);
  }

}

export const contextInjectionService = new ContextInjectionService();
export default contextInjectionService;
