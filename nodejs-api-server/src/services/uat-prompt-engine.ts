/**
 * UAT-Prompt Engine - Universal AI Tools Prompt Engineering System
 * Integrates with chat features to provide intelligent prompt optimization
 */

import { createClient } from '@supabase/supabase-js';

export interface UATPromptRequest {
  userMessage: string;
  conversationHistory: Array<{ role: string; content: string }>;
  contextCategories: string[];
  userId: string;
  projectPath?: string;
}

export interface UATPromptResponse {
  optimizedPrompt: string;
  contextInjection: string;
  promptMetadata: {
    confidence: number;
    optimizationTechniques: string[];
    contextRelevance: number;
  };
  suggestedParameters: {
    temperature: number;
    maxTokens: number;
    topP: number;
  };
}

export interface ContextRetrievalResult {
  content: string;
  category: string;
  source: string;
  relevanceScore: number;
  metadata: Record<string, any>;
}

export class UATPromptEngine {
  private supabase: any;
  private contextCache: Map<string, ContextRetrievalResult[]> = new Map();

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Main entry point for UAT-prompt processing
   */
  async processChatMessage(request: UATPromptRequest): Promise<UATPromptResponse> {
    console.log('🧠 UAT-Prompt Engine processing chat message...');

    // Step 1: Retrieve relevant context
    const contextResults = await this.retrieveRelevantContext(request);
    
    // Step 2: Analyze conversation patterns
    const conversationAnalysis = this.analyzeConversationPatterns(request.conversationHistory);
    
    // Step 3: Generate context injection
    const contextInjection = this.generateContextInjection(contextResults, request);
    
    // Step 4: Optimize prompt with UAT techniques
    const optimizedPrompt = await this.optimizePrompt(request.userMessage, contextInjection, conversationAnalysis);
    
    // Step 5: Determine optimal parameters
    const suggestedParameters = this.calculateOptimalParameters(request, conversationAnalysis);
    
    // Step 6: Generate metadata
    const promptMetadata = this.generatePromptMetadata(optimizedPrompt, contextResults, conversationAnalysis);

    return {
      optimizedPrompt,
      contextInjection,
      promptMetadata,
      suggestedParameters
    };
  }

  /**
   * Retrieve relevant context from Supabase
   */
  private async retrieveRelevantContext(request: UATPromptRequest): Promise<ContextRetrievalResult[]> {
    const cacheKey = `${request.userId}-${request.userMessage.slice(0, 50)}`;
    
    if (this.contextCache.has(cacheKey)) {
      return this.contextCache.get(cacheKey)!;
    }

    try {
      // Use hybrid search (text + semantic similarity)
      const { data, error } = await this.supabase.rpc('hybrid_context_search', {
        query_text: request.userMessage,
        user_id: request.userId,
        categories: request.contextCategories,
        limit: 10
      });

      if (error) {
        console.error('Context retrieval error:', error);
        return [];
      }

      const results: ContextRetrievalResult[] = data.map((item: any) => ({
        content: item.content,
        category: item.category,
        source: item.source,
        relevanceScore: item.relevance_score || 0.5,
        metadata: item.metadata || {}
      }));

      // Cache results
      this.contextCache.set(cacheKey, results);
      
      return results;
    } catch (error) {
      console.error('Error retrieving context:', error);
      return [];
    }
  }

  /**
   * Analyze conversation patterns for context
   */
  private analyzeConversationPatterns(history: Array<{ role: string; content: string }>): any {
    const analysis = {
      topicContinuity: 0,
      technicalDepth: 0,
      questionPattern: false,
      codeRelated: false,
      errorFocused: false,
      averageMessageLength: 0
    };

    if (history.length === 0) return analysis;

    // Calculate average message length
    analysis.averageMessageLength = history.reduce((sum, msg) => sum + msg.content.length, 0) / history.length;

    // Analyze recent messages for patterns
    const recentMessages = history.slice(-5);
    const allContent = recentMessages.map(msg => msg.content.toLowerCase()).join(' ');

    analysis.questionPattern = allContent.includes('?') || allContent.includes('how') || allContent.includes('why');
    analysis.codeRelated = allContent.includes('code') || allContent.includes('function') || allContent.includes('implement');
    analysis.errorFocused = allContent.includes('error') || allContent.includes('bug') || allContent.includes('fix');
    analysis.technicalDepth = this.calculateTechnicalDepth(allContent);

    return analysis;
  }

  /**
   * Generate context injection string
   */
  private generateContextInjection(contextResults: ContextRetrievalResult[], request: UATPromptRequest): string {
    if (contextResults.length === 0) return '';

    const contextSections = contextResults
      .filter(result => result.relevanceScore > 0.3)
      .map(result => {
        const categoryPrefix = this.getCategoryPrefix(result.category);
        return `${categoryPrefix}${result.content}`;
      })
      .join('\n\n');

    return `\n\n--- RELEVANT CONTEXT ---\n${contextSections}\n--- END CONTEXT ---\n`;
  }

  /**
   * Optimize prompt using UAT techniques
   */
  private async optimizePrompt(
    userMessage: string, 
    contextInjection: string, 
    conversationAnalysis: any
  ): Promise<string> {
    let optimizedPrompt = userMessage;

    // Apply UAT optimization techniques
    if (conversationAnalysis.codeRelated) {
      optimizedPrompt = this.enhanceForCodeGeneration(optimizedPrompt);
    }

    if (conversationAnalysis.errorFocused) {
      optimizedPrompt = this.enhanceForErrorAnalysis(optimizedPrompt);
    }

    if (conversationAnalysis.questionPattern) {
      optimizedPrompt = this.enhanceForQuestionAnswering(optimizedPrompt);
    }

    // Add context injection
    optimizedPrompt += contextInjection;

    // Add UAT-specific instructions
    optimizedPrompt += this.generateUATInstructions(conversationAnalysis);

    return optimizedPrompt;
  }

  /**
   * Calculate optimal LLM parameters
   */
  private calculateOptimalParameters(request: UATPromptRequest, analysis: any): any {
    const baseParams = {
      temperature: 0.7,
      maxTokens: 2000,
      topP: 0.9
    };

    // Adjust based on conversation analysis
    if (analysis.codeRelated) {
      baseParams.temperature = 0.3; // More deterministic for code
      baseParams.maxTokens = 4000; // More tokens for code generation
    }

    if (analysis.errorFocused) {
      baseParams.temperature = 0.2; // Very deterministic for error analysis
    }

    if (analysis.questionPattern) {
      baseParams.temperature = 0.5; // Balanced for Q&A
    }

    return baseParams;
  }

  /**
   * Generate prompt metadata
   */
  private generatePromptMetadata(
    optimizedPrompt: string, 
    contextResults: ContextRetrievalResult[], 
    analysis: any
  ): any {
    return {
      confidence: this.calculateConfidence(contextResults, analysis),
      optimizationTechniques: this.getAppliedTechniques(analysis),
      contextRelevance: this.calculateContextRelevance(contextResults)
    };
  }

  // Helper methods
  private getCategoryPrefix(category: string): string {
    const prefixes = {
      'conversation': '💬 CONVERSATION CONTEXT: ',
      'project_info': '📋 PROJECT INFO: ',
      'error_analysis': '🐛 ERROR ANALYSIS: ',
      'code_patterns': '💻 CODE PATTERNS: ',
      'test_results': '🧪 TEST RESULTS: ',
      'architecture_patterns': '🏗️ ARCHITECTURE: '
    };
    return prefixes[category as keyof typeof prefixes] || '📄 CONTEXT: ';
  }

  private calculateTechnicalDepth(content: string): number {
    const technicalTerms = ['api', 'function', 'class', 'method', 'variable', 'import', 'export', 'async', 'await'];
    const matches = technicalTerms.filter(term => content.includes(term)).length;
    return Math.min(matches / technicalTerms.length, 1);
  }

  private enhanceForCodeGeneration(prompt: string): string {
    return `As an expert software engineer, please provide clean, well-documented code for the following request:\n\n${prompt}`;
  }

  private enhanceForErrorAnalysis(prompt: string): string {
    return `Please analyze the following error or issue and provide a detailed solution:\n\n${prompt}`;
  }

  private enhanceForQuestionAnswering(prompt: string): string {
    return `Please provide a comprehensive answer to the following question:\n\n${prompt}`;
  }

  private generateUATInstructions(analysis: any): string {
    let instructions = '\n\n--- UAT INSTRUCTIONS ---\n';
    instructions += 'You are Universal AI Tools, an advanced AI assistant with access to project context.\n';
    
    if (analysis.codeRelated) {
      instructions += 'Focus on providing practical, production-ready code solutions.\n';
    }
    
    if (analysis.errorFocused) {
      instructions += 'Prioritize debugging and error resolution with clear explanations.\n';
    }
    
    instructions += 'Use the provided context to give more accurate and relevant responses.\n';
    instructions += '--- END UAT INSTRUCTIONS ---';
    
    return instructions;
  }

  private calculateConfidence(contextResults: ContextRetrievalResult[], analysis: any): number {
    const contextConfidence = contextResults.length > 0 ? 
      contextResults.reduce((sum, r) => sum + r.relevanceScore, 0) / contextResults.length : 0.5;
    
    const analysisConfidence = analysis.technicalDepth > 0.5 ? 0.8 : 0.6;
    
    return (contextConfidence + analysisConfidence) / 2;
  }

  private getAppliedTechniques(analysis: any): string[] {
    const techniques = [];
    
    if (analysis.codeRelated) techniques.push('code-generation-enhancement');
    if (analysis.errorFocused) techniques.push('error-analysis-optimization');
    if (analysis.questionPattern) techniques.push('question-answering-optimization');
    
    techniques.push('context-injection', 'conversation-pattern-analysis');
    
    return techniques;
  }

  private calculateContextRelevance(contextResults: ContextRetrievalResult[]): number {
    if (contextResults.length === 0) return 0;
    return contextResults.reduce((sum, r) => sum + r.relevanceScore, 0) / contextResults.length;
  }
}