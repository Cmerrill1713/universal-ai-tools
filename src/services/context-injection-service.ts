/**
 * Enhanced Context Injection Service - Advanced AI Context System
 * Integrates iOS device context, biometric authentication, and Universal AI Tools architecture
 * SECURITY HARDENED: Includes prompt injection protection and data isolation
 */

import { createClient    } from '@supabase/supabase-js';';';';
import { LogContext, log    } from '@/utils/logger';';';';
import { contextStorageService    } from './context-storage-service';';';';
import { type ASTAnalysisResult, type CodePattern, astParser    } from '@/utils/ast-parser';';';';
import * as fs from 'fs/promises';';';';
import * as path from 'path';';';';

interface ProjectContext {
  workingDirectory?: string;
  userId?: string;
  currentProject?: string;
  sessionId?: string;
  // Enhanced iOS-specific context
  deviceContext?: DeviceContext;
  // NEW: Code generation specific context
  astAnalysis?: ASTAnalysisResult;
  repositoryPatterns?: CodePattern[];
  securityRequirements?: SecurityRequirements;
  qualityStandards?: QualityStandards;
  targetLanguage?: string;
  targetFramework?: string;
}

interface SecurityRequirements {
  vulnerabilityThreshold: 'zero-tolerance' | 'low' | 'medium' | 'high';,'''
  requiredScans: string[];,
  complianceStandards: string[];
}

interface QualityStandards {
  minComplexityScore: number;,
  minMaintainabilityScore: number;,
  requiredTestCoverage: number;,
  documentationRequired: boolean;
}

interface DeviceContext {
  deviceId?: string;
  deviceName?: string;
  osVersion?: string;
  appVersion?: string;
  authenticationState?: 'authenticated' | 'unauthenticated' | 'locked' | 'authenticating';'''
  biometricCapabilities?: string[];
  proximityState?: 'near' | 'far' | 'unknown';'''
  connectionType?: 'wifi' | 'cellular' | 'offline';'''
  batteryLevel?: number;
  isLowPowerMode?: boolean;
  locationPermission?: 'granted' | 'denied' | 'not_determined';'''
  cameraPermission?: 'granted' | 'denied' | 'not_determined';'''
  // Apple Watch specific
  watchConnected?: boolean;
  watchBatteryLevel?: number;
  // Authentication confidence
  biometricConfidence?: number;
  lastAuthTime?: string;
}

interface ContextChunk {
  id: string;,
  content: string;,
  source: string;,
  relevanceScore: number;,
  type: 'document' | 'code' | 'conversation' | 'knowledge' | 'device' | 'biometric' | 'ast_pattern' | 'security_analysis' | 'quality_metrics';'''
  metadata?: Record<string, any>;
  // NEW: Code-specific metadata
  language?: string;
  filePath?: string;
  lineStart?: number;
  lineEnd?: number;
  complexity?: number;
  securityScore?: number;
  qualityScore?: number;
}

interface EnrichedContext {
  relevantKnowledge: ContextChunk[];,
  projectInfo: string;,
  recentConversations: string[];,
  codeContext: string[];,
  deviceContext: string[];,
  biometricContext: string[];
  // NEW: AST and code analysis context,
  astContext: string[];,
  repositoryPatterns: string[];,
  securityContext: string[];,
  qualityMetrics: string[];,
  codeComplexityInsights: string[];,
  totalContextTokens: number;
}

export class ContextInjectionService {
  private supabase;
  private maxContextTokens = 4000; // Reserve tokens for context
  private contextCache = new Map<string, { context: EnrichedContext;, expiry: number;, hitCount: number }>();
  private eventListeners: Map<string, Function[]> = new Map();
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
      /pretend\s+to\s+be/gi],
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
    this.supabase = createClient()
      process.env.SUPABASE_URL || 'http: //127.0.0.1:54321','''
      process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '''''
    );
  }

  /**
   * Main method: Enrich any user request with relevant project context including iOS device context
   * SECURITY HARDENED: Includes input sanitization and validation
   */
  async enrichWithContext()
    userRequest: string,
    projectContext: ProjectContext
  ): Promise<{
    enrichedPrompt: string;,
    contextSummary: string;,
    sourcesUsed: string[];
    securityWarnings?: string[];
  }> {
    try {
      // SECURITY: First sanitize and validate input
      const { sanitizedRequest, securityWarnings } = this.sanitizeAndValidateInput(userRequest);
      
      log.info('🔍 Enriching request with enhanced AI context', LogContext.CONTEXT_INJECTION, {')''
        requestLength: sanitizedRequest.length,
        originalLength: userRequest.length,
        workingDirectory: projectContext.workingDirectory,
        userId: projectContext.userId,
        deviceId: projectContext.deviceContext?.deviceId,
        authState: projectContext.deviceContext?.authenticationState,
        securityWarnings: securityWarnings.length,
      });

      // Store this interaction in context storage for future use
      if (projectContext.userId) {
        await contextStorageService.storeConversation()
          projectContext.userId,
          `Request: ${sanitizedRequest}`,
          'ios_companion_app','''
          projectContext.workingDirectory
        );
      }

      // Get cached context or build new one (using sanitized request)
      const cacheKey = this.buildCacheKey(sanitizedRequest, projectContext);
      let enrichedContext = this.getCachedContext(cacheKey);

      if (!enrichedContext) {
        enrichedContext = await this.buildEnrichedContext(sanitizedRequest, projectContext);
        this.cacheContext(cacheKey, enrichedContext);
      }


      // Build the enriched prompt (use sanitized request for context)
      const enrichedPrompt = this.buildEnrichedPrompt(sanitizedRequest, enrichedContext, projectContext);

      // Create context summary for logging
      const contextSummary = this.createContextSummary(enrichedContext);
      const sourcesUsed = this.extractSources(enrichedContext);

      log.info('✅ Enhanced context enrichment completed', LogContext.CONTEXT_INJECTION, {')''
        contextTokens: enrichedContext.totalContextTokens,
        sourcesCount: sourcesUsed.length,
        knowledgeChunks: enrichedContext.relevantKnowledge.length,
        deviceContextItems: enrichedContext.deviceContext.length,
        biometricContextItems: enrichedContext.biometricContext.length,
        securityWarnings: securityWarnings.length,
      });

      return {
        enrichedPrompt,
        contextSummary,
        sourcesUsed,
        securityWarnings: securityWarnings.length > 0 ? securityWarnings : undefined,
      };
    } catch (error) {
      log.error('❌ Enhanced context enrichment failed', LogContext.CONTEXT_INJECTION, {')''
        error: error instanceof Error ? error.message : String(error),
      });

      // Fallback: return original request with minimal context
      return {
        enrichedPrompt: this.buildFallbackPrompt(userRequest, projectContext),
        contextSummary: 'Enhanced context enrichment failed - using minimal context','''
        sourcesUsed: [],
      };
    }
  }

  /**
   * SECURITY: Sanitize input and detect potential injection attacks
   */
  private sanitizeAndValidateInput(input: string): {, 
    sanitizedRequest: string;, 
    securityWarnings: string[] 
  } {
    const warnings: string[] = [];
    let sanitized = input;

    // Check for prompt injection patterns
    this.securityFilters.promptInjectionPatterns.forEach((pattern, index) => {
      if (pattern.test(sanitized)) {
        warnings.push(`Potential prompt injection detected (pattern ${index + 1})`);
        sanitized = sanitized.replace(pattern, '[FILTERED_CONTENT]');'''
      }
    });

    // Filter sensitive data
    this.securityFilters.sensitiveDataPatterns.forEach((pattern, index) => {
      const matches = sanitized.match(pattern);
      if (matches && matches.length > 0) {
        warnings.push(`Sensitive data filtered (${matches.length} instances)`);
        sanitized = sanitized.replace(pattern, '[REDACTED]');'''
      }
    });

    // Additional validation
    if (input.length > 10000) {
      warnings.push('Input length exceeds safe limits');'''
      sanitized = `${sanitized.substring(0, 10000)  }[TRUNCATED]`;
    }

    // Log security events
    if (warnings.length > 0) {
      log.warn('🚨 Security filtering applied to user input', LogContext.CONTEXT_INJECTION, {')''
        originalLength: input.length,
        sanitizedLength: sanitized.length,
        warnings: warnings.length,
      });
    }

    return { sanitizedRequest: sanitized, securityWarnings: warnings };
  }

  /**
   * Build comprehensive context from multiple sources including iOS device context
   */
  private async buildEnrichedContext()
    userRequest: string,
    projectContext: ProjectContext
  ): Promise<EnrichedContext> {
    const [;
      relevantKnowledge,
      projectInfo,
      recentConversations,
      codeContext,
      deviceContext,
      biometricContext,
      // NEW: AST and code analysis context
      astContext,
      repositoryPatterns,
      securityContext,
      qualityMetrics,
      codeComplexityInsights] = await Promise.all([)
      this.getRelevantKnowledge(userRequest, projectContext),
      this.getProjectInfo(projectContext),
      this.getRecentConversations(projectContext),
      this.getCodeContext(userRequest, projectContext),
      this.getDeviceContext(projectContext.deviceContext),
      this.getBiometricContext(projectContext.deviceContext),
      // NEW: Enhanced code analysis methods
      this.getASTContext(userRequest, projectContext),
      this.getRepositoryPatterns(userRequest, projectContext),
      this.getSecurityContext(userRequest, projectContext),
      this.getQualityMetrics(userRequest, projectContext),
      this.getCodeComplexityInsights(userRequest, projectContext)]);

    // Calculate total token usage (rough estimate) including new context types
    const totalContextTokens = this.estimateTokens([);
      ...relevantKnowledge.map(k => k.content),
      projectInfo,
      ...recentConversations,
      ...codeContext,
      ...deviceContext,
      ...biometricContext,
      ...astContext,
      ...repositoryPatterns,
      ...securityContext,
      ...qualityMetrics,
      ...codeComplexityInsights].join(' '));'''

    return {
      relevantKnowledge,
      projectInfo,
      recentConversations,
      codeContext,
      deviceContext,
      biometricContext,
      // NEW: AST and code analysis context
      astContext,
      repositoryPatterns,
      securityContext,
      qualityMetrics,
      codeComplexityInsights,
      totalContextTokens,
    };
  }

  /**
   * Get device-specific context from iOS companion app
   */
  private async getDeviceContext(deviceContext?: DeviceContext): Promise<string[]> {
    if (!deviceContext) return [];

    const context: string[] = [];

    // Device information
    if (deviceContext.deviceName || deviceContext.osVersion) {
      context.push(`Device: ${deviceContext.deviceName || 'iOS Device'} running ${deviceContext.osVersion || 'iOS'}`);'''
    }

    if (deviceContext.appVersion) {
      context.push(`Universal AI Tools Companion v${deviceContext.appVersion}`);
    }

    // Connection and power status
    if (deviceContext.connectionType) {
      context.push(`Connection: ${deviceContext.connectionType.toUpperCase()}`);
    }

    if (deviceContext.batteryLevel !== undefined) {
      const batteryStatus = deviceContext.isLowPowerMode ? 'Low Power Mode' : 'Normal';';';';
      context.push(`Battery: ${deviceContext.batteryLevel}% (${batteryStatus})`);
    }

    // Apple Watch integration
    if (deviceContext.watchConnected) {
      const watchStatus = deviceContext.watchBatteryLevel 
        ? `Connected (${deviceContext.watchBatteryLevel}% battery)`
        : 'Connected';'''
      context.push(`Apple Watch: ${watchStatus}`);
    }

    // Permissions context
    const permissions: string[] = [];
    if (deviceContext.locationPermission === 'granted') permissions.push('Location');'''
    if (deviceContext.cameraPermission === 'granted') permissions.push('Camera');'''
    if (permissions.length > 0) {
      context.push(`Permissions: ${permissions.join(', ')} access granted`);'''
    }

    // Proximity context for authentication
    if (deviceContext.proximityState && deviceContext.proximityState !== 'unknown') {'''
      context.push(`Device proximity: ${deviceContext.proximityState}`);
    }

    return context;
  }

  /**
   * Get biometric and authentication context
   */
  private async getBiometricContext(deviceContext?: DeviceContext): Promise<string[]> {
    if (!deviceContext) return [];

    const context: string[] = [];

    // Authentication state
    if (deviceContext.authenticationState) {
      const authDisplay = deviceContext.authenticationState.charAt(0).toUpperCase() + 
                          deviceContext.authenticationState.slice(1);
      context.push(`Authentication Status: ${authDisplay}`);
    }

    // Biometric capabilities
    if (deviceContext.biometricCapabilities && deviceContext.biometricCapabilities.length > 0) {
      context.push(`Biometric Capabilities: ${deviceContext.biometricCapabilities.join(', ')}`);'''
    }

    // Authentication confidence and timing
    if (deviceContext.biometricConfidence !== undefined) {
      context.push(`Authentication Confidence: ${Math.floor(deviceContext.biometricConfidence * 100)}%`);
    }

    if (deviceContext.lastAuthTime) {
      const authTime = new Date(deviceContext.lastAuthTime);
      const timeSince = Math.floor((Date.now() - authTime.getTime()) / (1000 * 60)); // minutes;
      context.push(`Last Authentication: ${timeSince} minutes ago`);
    }

    // Security recommendations based on auth state
    if (deviceContext.authenticationState === 'authenticated' && deviceContext.biometricConfidence) {'''
      if (deviceContext.biometricConfidence > 0.9) {
        context.push('High security confidence - full feature access recommended');'''
      } else if (deviceContext.biometricConfidence > 0.7) {
        context.push('Medium security confidence - standard feature access');'''
      } else {
        context.push('Lower security confidence - consider re-authentication for sensitive operations');'''
      }
    }

    return context;
  }

  /**
   * Get relevant knowledge with mandatory user isolation (SECURITY CRITICAL)
   */
  private async getRelevantKnowledge()
    userRequest: string,
    projectContext: ProjectContext
  ): Promise<ContextChunk[]> {
    try {
      // SECURITY: Ensure user ID is present for data isolation
      if (!projectContext.userId) {
        log.warn('⚠️ No user ID provided - skipping knowledge retrieval for security', LogContext.CONTEXT_INJECTION);'''
        return [];
      }

      // First check our context storage service
      const storedContext = await contextStorageService.searchContext();
        projectContext.userId,
        userRequest,
        undefined,
        5
      );

      const contextChunks: ContextChunk[] = storedContext.map(context => ({,);
        id: context.id,
        content: this.filterSensitiveContent(context.content),
        source: `stored_context:${context.category}`,
        relevanceScore: 0.8,
        type: 'knowledge','''
        metadata: context.metadata || undefined,
      }));

      // Try to get additional knowledge through embedding search
      try {
        const embeddingResponse = await fetch('http: //127.0.0.1:54321/functions/v1/ollama-embeddings', {');';';
          method: 'POST','''
          headers: {
            "content-type": 'application/json',''"'"
            'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,'''
          },
          body: JSON.stringify({,)
            text: userRequest,
            model: 'all-minilm:latest','''
            userId: projectContext.userId,
          }),
        });

        if (embeddingResponse.ok) {
          const { embedding } = await embeddingResponse.json();

          // SECURITY: Use hybrid search with mandatory user filtering
          const { data: searchResults } = await this.supabase.rpc('hybrid_search', {');';';
            query_text: userRequest,
            query_embedding: embedding,
            search_tables: ['knowledge_sources', 'documents', 'conversation_messages'],'''
            match_limit: 5,
            semantic_weight: 0.7,
          });

          if (searchResults) {
            const additionalChunks = searchResults;
              .filter((result: any) => !result.user_id || result.user_id === projectContext.userId)
              .map((result: any) => ({,
                id: result.id,
                content: this.filterSensitiveContent(result.content || result.text || result.summary),
                source: result.source || result.table_name || 'unknown','''
                relevanceScore: result.similarity_score || result.rank || 0.5,
                type: this.determineContentType(result),
                metadata: {,
                  created_at: result.created_at,
                  user_id: result.user_id,
                  tags: result.tags,
                },
              }));

            contextChunks.push(...additionalChunks);
          }
        }
      } catch (embeddingError) {
        log.warn('⚠️ Embedding search failed, using stored context only', LogContext.CONTEXT_INJECTION);'''
      }

      return contextChunks.slice(0, 10); // Limit to top 10 results;
    } catch (error) {
      log.error('❌ Knowledge retrieval failed', LogContext.CONTEXT_INJECTION, {')''
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Get project-specific information
   */
  private async getProjectInfo(projectContext: ProjectContext): Promise<string> {
    try {
      // Get project metadata from working directory
      if (projectContext.workingDirectory) {
        const { data: projectData, error } = await this.supabase;
          .from('documents')'''
          .select('content, name')'''
          .ilike('path', `%${projectContext.workingDirectory}%`)'''
          .or('name.ilike.%README%,name.ilike.%CLAUDE.md%,name.ilike.%package.json%')'''
          .limit(3);

        if (!error && projectData && projectData.length > 0) {
          return projectData.map(doc => `${doc.name}:n${this.filterSensitiveContent(doc.content)}`).join('nn');';';';
        }
      }

      // Fallback: get general project info
      const { data: generalInfo, error } = await this.supabase;
        .from('knowledge_sources')'''
        .select('content')'''
        .eq('type', 'project_info')'''
        .limit(1)
        .single();

      return generalInfo?.content || 'Universal AI Tools - Advanced AI platform with iOS companion app integration.';';';';
    } catch (error) {
      return 'Project information unavailable.';';';';
    }
  }

  /**
   * Get recent conversation history for context
   */
  private async getRecentConversations(projectContext: ProjectContext): Promise<string[]> {
    try {
      if (!projectContext.userId) return [];

      const conversations = await contextStorageService.getContext();
        projectContext.userId,
        'conversation','''
        projectContext.workingDirectory,
        5
      );

      return conversations.map(conv =>);
        `${conv.source}: ${this.filterSensitiveContent(conv.content.substring(0, 200))}${conv.content.length > 200 ? '...' : ''}`'''
      );
    } catch (error) {
      return [];
    }
  }

  /**
   * Get relevant code context based on request
   */
  private async getCodeContext()
    userRequest: string,
    projectContext: ProjectContext
  ): Promise<string[]> {
    try {
      // Look for code-related documents
      const codeKeywords = ['function', 'class', 'import', 'export', 'const', 'let', 'var', 'swift', 'swiftui'];';';';
      const hasCodeRequest = codeKeywords.some(keyword =>);
        userRequest.toLowerCase().includes(keyword)
      );

      if (!hasCodeRequest) return [];

      const { data: codeFiles, error } = await this.supabase;
        .from('documents')'''
        .select('content, name, path')'''
        .in('content_type', ['text/typescript', 'text/javascript', 'text/python', 'application/json', 'text/swift'])'''
        .limit(5);

      if (error) return [];

      return codeFiles?.map(file =>);
        `${file.name} (${file.path}):n${this.filterSensitiveContent(file.content.substring(0, 500))}${file.content.length > 500 ? '...' : ''}`'''
      ) || [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Build the enriched prompt with enhanced context injection
   */
  private buildEnrichedPrompt()
    userRequest: string, 
    context: EnrichedContext, 
    projectContext: ProjectContext
  ): string {
    let prompt = `UNIVERSAL AI TOOLS CONTEXT - Advanced AI Platform with iOS Integrationnn`;

    prompt += `IMPORTANT: You are working with the Universal AI Tools platform, featuring: n`;
    prompt += `- Service-oriented architecture with MLX fine-tuning, DSPy cognitive orchestrationn`;
    prompt += `- Intelligent parameter automation and AB-MCTS probabilistic coordinationn`;
    prompt += `- iOS companion app with biometric authentication and Apple ecosystem integrationnn`;

    // Add device and biometric context first (most relevant for iOS app)
    if (context.deviceContext.length > 0) {
      prompt += `## iOS DEVICE CONTEXT: n`;
      context.deviceContext.forEach(deviceInfo => {)
        prompt += `${deviceInfo}n`;
      });
      prompt += `n`;
    }

    if (context.biometricContext.length > 0) {
      prompt += `## AUTHENTICATION & BIOMETRIC CONTEXT: n`;
      context.biometricContext.forEach(biometricInfo => {)
        prompt += `${biometricInfo}n`;
      });
      prompt += `n`;
    }

    // Add project information
    if (context.projectInfo) {
      prompt += `## PROJECT CONTEXT: n${context.projectInfo}nn`;
    }

    // Add relevant knowledge
    if (context.relevantKnowledge.length > 0) {
      prompt += `## RELEVANT KNOWLEDGE: n`;
      context.relevantKnowledge.forEach((chunk, index) => {
        prompt += `${index + 1}. ${chunk.source} (relevance: ${chunk.relevanceScore.toFixed(2)}):n${chunk.content}nn`;
      });
    }

    // Add recent conversation context
    if (context.recentConversations.length > 0) {
      prompt += `## RECENT CONVERSATION HISTORY: n`;
      context.recentConversations.slice(0, 3).forEach(conv => {)
        prompt += `${conv}n`;
      });
      prompt += `n`;
    }

    // Add code context if available
    if (context.codeContext.length > 0) {
      prompt += `## RELEVANT CODE CONTEXT: n`;
      context.codeContext.forEach(code => {)
        prompt += `${code}nn`;
      });
    }

    prompt += `## CONTEXT-AWARE INSTRUCTIONS: n`;
    prompt += `You MUST use the above context to inform your response, especially: n`;
    prompt += `1. Consider the user's device capabilities and authentication staten`;'''
    prompt += `2. Tailor responses based on biometric confidence and security contextn`;
    prompt += `3. Reference Universal AI Tools' sophisticated architecture when relevantn`;'''
    prompt += `4. Consider iOS app integration and Apple ecosystem featuresn`;
    prompt += `5. Use project-specific knowledge and conversation history for continuitynn`;

    prompt += `## USER REQUEST: n${userRequest}nn`;
    prompt += `Remember: Provide context-aware responses that leverage the Universal AI Tools platform capabilities and iOS device integration.`;

    return prompt;
  }

  /**
   * Build fallback prompt when context enrichment fails
   */
  private buildFallbackPrompt(userRequest: string, projectContext: ProjectContext): string {
    let prompt = `CONTEXT: You are working with Universal AI Tools platform`;
    
    if (projectContext.workingDirectory) {
      prompt += ` in directory: ${projectContext.workingDirectory}`;
    }
    
    if (projectContext.deviceContext?.authenticationState) {
      prompt += `, user is ${projectContext.deviceContext.authenticationState}`;
    }

    prompt += `.nnUSER REQUEST: ${userRequest}n\n`;
    prompt += `Note: Full context retrieval was unavailable. Provide the best response possible with limited context.`;

    return prompt;
  }

  /**
   * SECURITY: Filter sensitive content from context
   */  
  private filterSensitiveContent(content: string): string {
    let filtered = content;
    
    this.securityFilters.sensitiveDataPatterns.forEach(pattern => {)
      filtered = filtered.replace(pattern, '[REDACTED]');'''
    });

    return filtered;
  }

  /**
   * Utility methods
   */
  private buildCacheKey(userRequest: string, projectContext: ProjectContext): string {
    const keyParts = [;
      userRequest.substring(0, 100),
      projectContext.workingDirectory || '','''
      projectContext.userId || '','''
      projectContext.currentProject || '','''
      projectContext.deviceContext?.deviceId || '','''
      projectContext.deviceContext?.authenticationState || '','''
    ];
    return Buffer.from(keyParts.join('|')).toString('base64');';';';
  }

  private getCachedContext(cacheKey: string): EnrichedContext | null {
    const cached = this.contextCache.get(cacheKey);
    if (cached && Date.now() < cached.expiry) {
      cached.hitCount += 1;
      return cached.context;
    }
    this.contextCache.delete(cacheKey);
    return null;
  }

  private cacheContext(cacheKey: string, context: EnrichedContext): void {
    this.contextCache.set(cacheKey, {)
      context,
      expiry: Date.now() + this.cacheExpiryMs,
      hitCount: 0,
    });
  }

  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  private determineContentType(result: any): 'document' | 'code' | 'conversation' | 'knowledge' {'''
    if (result.table_name === 'conversation_messages') return 'conversation';'''
    if (result.table_name === 'documents') return 'document';'''
    if (result.content_type?.includes('javascript') || result.content_type?.includes('typescript') || result.content_type?.includes('swift')) return 'code';'''
    return 'knowledge';';';';
  }

  private createContextSummary(context: EnrichedContext): string {
    return `Enhanced context: ${context.relevantKnowledge.length} knowledge chunks, ${context.recentConversations.length} conversations, ${context.codeContext.length} code files, ${context.deviceContext.length} device info, ${context.biometricContext.length} biometric details. Total tokens: ${context.totalContextTokens}`;
  }

  private extractSources(context: EnrichedContext): string[] {
    const sources = new Set(context.relevantKnowledge.map(k => k.source));
    if (context.deviceContext.length > 0) sources.add('ios_device');'''
    if (context.biometricContext.length > 0) sources.add('biometric_auth');'''
    return Array.from(sources);
  }

  /**
   * Get AST context for code understanding and generation
   */
  private async getASTContext(userRequest: string, projectContext: ProjectContext): Promise<string[]> {
    try {
      const context: string[] = [];
      
      if (!projectContext.workingDirectory) {
        return context;
      }

      // Check if request is code-related
      const codeKeywords = ['function', 'class', 'interface', 'component', 'implement', 'refactor', 'generate', 'code'];';';';
      const isCodeRequest = codeKeywords.some(keyword =>);
        userRequest.toLowerCase().includes(keyword)
      );

      if (!isCodeRequest) {
        return context;
      }

      // Get relevant code files from the working directory
      try {
        const codeFiles = await this.getRelevantCodeFiles(projectContext.workingDirectory);
        
        for (const file of codeFiles.slice(0, 3)) { // Limit to 3 files for performance
          try {
            const fileContent = await fs.readFile(file.path, 'utf-8');';';';
            const language = this.detectLanguage(file.path);
            
            if (language) {
              const astResult = await astParser.parseCode(fileContent, language, file.path);
              
              if (astResult.parseSuccess) {
                context.push(`AST Analysis - ${file.name}:`);
                context.push(`  Language: ${astResult.language}`);
                context.push(`  Patterns: ${astResult.patterns.length} (${astResult.patterns.map(p => p.type).join(', ')})`);'''
                context.push(`  Complexity: Cyclomatic=${astResult.complexity.cyclomatic}, Cognitive=${astResult.complexity.cognitive}`);
                context.push(`  Quality: ${astResult.qualityMetrics.linesOfCode} LOC, ${astResult.qualityMetrics.functionsCount} functions`);
                
                if (astResult.securityIssues.length > 0) {
                  context.push(`  Security Issues: ${astResult.securityIssues.length} found`);
                }
                
                context.push(`  Summary: ${astResult.contextSummary}`);
              }
            }
          } catch (fileError) {
            log.warn('⚠️ Failed to analyze file for AST context', LogContext.CONTEXT_INJECTION, {')''
              filePath: file.path,
              error: fileError instanceof Error ? fileError.message : String(fileError)
            });
          }
        }
      } catch (dirError) {
        log.warn('⚠️ Failed to read directory for AST context', LogContext.CONTEXT_INJECTION, {')''
          workingDirectory: projectContext.workingDirectory,
          error: dirError instanceof Error ? dirError.message : String(dirError)
        });
      }

      return context;
    } catch (error) {
      log.error('❌ Failed to get AST context', LogContext.CONTEXT_INJECTION, {')''
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * Get repository patterns for code generation context
   */
  private async getRepositoryPatterns(userRequest: string, projectContext: ProjectContext): Promise<string[]> {
    try {
      const context: string[] = [];

      if (!projectContext.workingDirectory || !projectContext.targetLanguage) {
        return context;
      }

      // Query repository patterns from database
      const { data: patterns, error } = await this.supabase;
        .from('repository_patterns')'''
        .select('pattern_name, pattern_type, quality_score, usage_frequency, pattern_signature')'''
        .eq('language', projectContext.targetLanguage)'''
        .order('quality_score', { ascending: false })'''
        .order('usage_frequency', { ascending: false })'''
        .limit(10);

      if (error) {
        log.warn('⚠️ Failed to query repository patterns', LogContext.CONTEXT_INJECTION, { error: error.message });'''
        return context;
      }

      if (patterns && patterns.length > 0) {
        context.push('Repository Patterns Available: ');'''
        
        const patternsByType = patterns.reduce((acc, pattern) => {
          if (!acc[pattern.pattern_type]) {
            acc[pattern.pattern_type] = [];
          }
          acc[pattern.pattern_type].push(pattern);
          return acc;
        }, {} as Record<string, any[]>);

        Object.entries(patternsByType).forEach(([type, typePatterns]) => {
          const patterns = typePatterns as any[];
          context.push(`  ${type}: ${patterns.length} patterns available`);
          patterns.slice(0, 3).forEach(pattern => {)
            context.push(`    - ${pattern.pattern_name} (quality: ${pattern.quality_score.toFixed(2)}, usage: ${pattern.usage_frequency})`);
            if (pattern.pattern_signature) {
              context.push(`      Signature: ${pattern.pattern_signature.substring(0, 100)}${pattern.pattern_signature.length > 100 ? '...' : ''}`);'''
            }
          });
        });
      }

      return context;
    } catch (error) {
      log.error('❌ Failed to get repository patterns', LogContext.CONTEXT_INJECTION, {')''
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * Get security context and requirements for code generation
   */
  private async getSecurityContext(userRequest: string, projectContext: ProjectContext): Promise<string[]> {
    try {
      const context: string[] = [];

      // Get security requirements from project context
      if (projectContext.securityRequirements) {
        context.push('Security Requirements: ');'''
        context.push(`  Vulnerability Threshold: ${projectContext.securityRequirements.vulnerabilityThreshold}`);
        
        if (projectContext.securityRequirements.requiredScans.length > 0) {
          context.push(`  Required Scans: ${projectContext.securityRequirements.requiredScans.join(', ')}`);'''
        }
        
        if (projectContext.securityRequirements.complianceStandards.length > 0) {
          context.push(`  Compliance Standards: ${projectContext.securityRequirements.complianceStandards.join(', ')}`);'''
        }
      }

      // Get security patterns for the target language
      if (projectContext.targetLanguage) {
        const { data: securityPatterns, error } = await this.supabase;
          .from('security_patterns')'''
          .select('vulnerability_type, severity, pattern_description')'''
          .eq('language', projectContext.targetLanguage)'''
          .eq('enabled', true)'''
          .order('severity', { ascending: true }) // Critical first'''
          .limit(5);

        if (!error && securityPatterns && securityPatterns.length > 0) {
          context.push('Security Patterns to Watch: ');'''
          securityPatterns.forEach(pattern => {)
            context.push(`  ${pattern.vulnerability_type.toUpperCase()} (${pattern.severity}): ${pattern.pattern_description}`);
          });
        }
      }

      // Add general security guidelines for code generation
      context.push('Security Guidelines: ');'''
      context.push('  - Validate all user input and sanitize data');'''
      context.push('  - Use parameterized queries instead of string concatenation');'''
      context.push('  - Implement proper error handling without exposing sensitive information');'''
      context.push('  - Follow principle of least privilege for access controls');'''
      context.push('  - Use secure communication protocols (HTTPS, WSS)');'''

      return context;
    } catch (error) {
      log.error('❌ Failed to get security context', LogContext.CONTEXT_INJECTION, {')''
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * Get quality metrics and standards for code generation
   */
  private async getQualityMetrics(userRequest: string, projectContext: ProjectContext): Promise<string[]> {
    try {
      const context: string[] = [];

      // Get quality standards from project context
      if (projectContext.qualityStandards) {
        context.push('Quality Standards: ');'''
        context.push(`  Minimum Complexity Score: ${projectContext.qualityStandards.minComplexityScore}`);
        context.push(`  Minimum Maintainability Score: ${projectContext.qualityStandards.minMaintainabilityScore}`);
        context.push(`  Required Test Coverage: ${projectContext.qualityStandards.requiredTestCoverage}%`);
        context.push(`  Documentation Required: ${projectContext.qualityStandards.documentationRequired ? 'Yes' : 'No'}`);'''
      }

      // Get recent code quality assessments for learning
      if (projectContext.userId) {
        const { data: recentAssessments, error } = await this.supabase;
          .from('code_quality_assessments')'''
          .select('overall_quality_score, cyclomatic_complexity, lines_of_code, documentation_score, security_score')'''
          .order('assessed_at', { ascending: false })'''
          .limit(5);

        if (!error && recentAssessments && recentAssessments.length > 0) {
          context.push('Recent Quality Metrics: ');'''
          const avgQuality = recentAssessments.reduce((sum, a) => sum + a.overall_quality_score, 0) / recentAssessments.length;
          const avgComplexity = recentAssessments.reduce((sum, a) => sum + a.cyclomatic_complexity, 0) / recentAssessments.length;
          const avgSecurity = recentAssessments.reduce((sum, a) => sum + a.security_score, 0) / recentAssessments.length;
          
          context.push(`  Average Quality Score: ${avgQuality.toFixed(2)}`);
          context.push(`  Average Complexity: ${avgComplexity.toFixed(1)}`);
          context.push(`  Average Security Score: ${avgSecurity.toFixed(2)}`);
        }
      }

      // Add general quality guidelines
      context.push('Quality Guidelines: ');'''
      context.push('  - Write clean, readable, and maintainable code');'''
      context.push('  - Follow consistent naming conventions and code style');'''
      context.push('  - Keep functions small and focused on single responsibilities');'''
      context.push('  - Add comprehensive error handling and logging');'''
      context.push('  - Include appropriate documentation and comments');'''
      context.push('  - Write unit tests for critical functionality');'''

      return context;
    } catch (error) {
      log.error('❌ Failed to get quality metrics', LogContext.CONTEXT_INJECTION, {')''
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * Get code complexity insights for intelligent code generation
   */
  private async getCodeComplexityInsights(userRequest: string, projectContext: ProjectContext): Promise<string[]> {
    try {
      const context: string[] = [];

      if (!projectContext.workingDirectory) {
        return context;
      }

      // Analyze request complexity to provide appropriate context
      const complexityIndicators = {
        simple: ['variable', 'constant', 'getter', 'setter'],'''
        moderate: ['function', 'method', 'interface', 'type'],'''
        complex: ['class', 'service', 'component', 'system'],'''
        advanced: ['architecture', 'framework', 'integration', 'orchestration']'''
      };

      let requestComplexity = 'simple';';';';
      const lowerRequest = userRequest.toLowerCase();

      if (complexityIndicators.advanced.some(keyword => lowerRequest.includes(keyword))) {
        requestComplexity = 'advanced';'''
      } else if (complexityIndicators.complex.some(keyword => lowerRequest.includes(keyword))) {
        requestComplexity = 'complex';'''
      } else if (complexityIndicators.moderate.some(keyword => lowerRequest.includes(keyword))) {
        requestComplexity = 'moderate';'''
      }

      context.push(`Request Complexity Assessment: ${requestComplexity.toUpperCase()}`);

      // Provide complexity-appropriate guidance
      switch (requestComplexity) {
        case 'simple':'''
          context.push('Complexity Guidance: ');'''
          context.push('  - Focus on clear, single-purpose implementations');'''
          context.push('  - Use descriptive variable names and simple logic');'''
          context.push('  - Minimal dependencies and straightforward patterns');'''
          break;

        case 'moderate':'''
          context.push('Complexity Guidance: ');'''
          context.push('  - Break down into smaller, manageable functions');'''
          context.push('  - Consider interface segregation and single responsibility');'''
          context.push('  - Add basic error handling and validation');'''
          context.push('  - Include unit tests for key functionality');'''
          break;

        case 'complex':'''
          context.push('Complexity Guidance: ');'''
          context.push('  - Use design patterns for maintainability (Factory, Strategy, Observer)');'''
          context.push('  - Implement proper separation of concerns');'''
          context.push('  - Add comprehensive error handling and logging');'''
          context.push('  - Consider dependency injection and modular architecture');'''
          context.push('  - Include integration tests and documentation');'''
          break;

        case 'advanced':'''
          context.push('Complexity Guidance: ');'''
          context.push('  - Follow service-oriented architecture patterns');'''
          context.push('  - Implement sophisticated error handling and circuit breakers');'''
          context.push('  - Use event-driven architecture and async processing');'''
          context.push('  - Include comprehensive monitoring and observability');'''
          context.push('  - Implement security best practices and compliance patterns');'''
          context.push('  - Design for scalability and performance optimization');'''
          break;
      }

      // Add Universal AI Tools specific complexity insights
      if (lowerRequest.includes('universal ai tools') || lowerRequest.includes('service') || lowerRequest.includes('agent')) {'''
        context.push('Universal AI Tools Architecture Complexity: ');'''
        context.push('  - Integrate with context injection service for all LLM calls');'''
        context.push('  - Use AB-MCTS orchestration for multi-service coordination');'''
        context.push('  - Follow MLX integration patterns for Apple Silicon optimization');'''
        context.push('  - Implement DSPy cognitive orchestration for complex reasoning');'''
        context.push('  - Use Supabase vault for secure secrets management');'''
        context.push('  - Follow existing service mesh patterns and error handling');'''
      }

      return context;
    } catch (error) {
      log.error('❌ Failed to get code complexity insights', LogContext.CONTEXT_INJECTION, {')''
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * Helper method to get relevant code files from directory
   */
  private async getRelevantCodeFiles(workingDirectory: string): Promise<Array<{name: string, path: string}>> {
    try {
      const files: Array<{name: string, path: string}> = [];
      const allowedExtensions = ['.ts', '.js', '.py', '.swift', '.go', '.rs', '.java', '.cpp', '.c'];';';';
      
      // This is a simplified implementation. In production, you'd want to use a proper file walking library'''
      // or integrate with the file system more robustly
      const items = await fs.readdir(workingDirectory, { withFileTypes: true });
      
      for (const item of items) {
        if (item.isFile()) {
          const ext = path.extname(item.name);
          if (allowedExtensions.includes(ext)) {
            files.push({)
              name: item.name,
              path: path.join(workingDirectory, item.name)
            });
          }
        }
      }
      
      return files.slice(0, 10); // Limit for performance;
    } catch (error) {
      return [];
    }
  }

  /**
   * Helper method to detect programming language from file path
   */
  private detectLanguage(filePath: string): string | null {
    const ext = path.extname(filePath).toLowerCase();
    const languageMap: Record<string, string> = {
      '.ts': 'typescript','''
      '.js': 'javascript','''
      '.py': 'python','''
      '.swift': 'swift','''
      '.go': 'go','''
      '.rs': 'rust','''
      '.java': 'java','''
      '.cpp': 'cpp','''
      '.c': 'c''''
    };
    
    return languageMap[ext] || null;
  }

  /**
   * Clear cache (useful for development/testing)
   */
  public clearCache(): void {
    this.contextCache.clear();
    log.info('🧹 Enhanced context cache cleared', LogContext.CONTEXT_INJECTION);'''
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): { size: number;, hitRate: number } {
    const totalHits = Array.from(this.contextCache.values()).reduce((sum, entry) => sum + entry.hitCount, 0);
    const totalEntries = this.contextCache.size;
    return {
      size: totalEntries,
      hitRate: totalEntries > 0 ? totalHits / totalEntries : 0,
    };
  }

  // EventEmitter-like methods for backward compatibility
  on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  emit(event: string, ...args: any[]): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {)
        try {
          callback(...args);
        } catch (error) {
          log.error(`Error in context injection service event listener for ${event}`, LogContext.CONTEXT_INJECTION, {)
            error: error instanceof Error ? error.message : String(error)
          });
        }
      });
    }
  }

  off(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }
}

export const contextInjectionService = new ContextInjectionService();
export default contextInjectionService;