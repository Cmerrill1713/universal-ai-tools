/**
 * Enhanced Retriever Agent - Real AI Information Retrieval
 * Uses information retrieval models to gather and synthesize relevant information
 */

import { EnhancedBaseAgent } from '../enhanced-base-agent';
import type { AgentContext, AgentResponse } from '@/types';
import { knowledgeScraperService } from '@/services/knowledge-scraper-service';
import { LogContext, log } from '@/utils/logger';

export class EnhancedRetrieverAgent extends EnhancedBaseAgent {
  /**
   * Override execute to search knowledge base first
   */
  public async execute(context: AgentContext): Promise<AgentResponse> {
    try {
      // Search knowledge base for relevant information
      const knowledgeResults = await this.searchKnowledgeBase(context);

      // Add knowledge results to context
      if (knowledgeResults.length > 0) {
        const knowledgeContext = this.formatKnowledgeResults(knowledgeResults);
        context.metadata = {
          ...context.metadata,
          knowledgeBase: knowledgeContext,
          knowledgeResultsCount: knowledgeResults.length,
        };

        log.info('📚 Found knowledge base results', LogContext.AGENT, {
          count: knowledgeResults.length,
          sources: [...new Set(knowledgeResults.map((r) => r.source))],
        });
      }
    } catch (error) {
      log.warn('⚠️ Knowledge base search failed, continuing without it', LogContext.AGENT, {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Call parent execute with enriched context
    return super.execute(context);
  }

  /**
   * Search knowledge base for relevant information
   */
  private async searchKnowledgeBase(context: AgentContext): Promise<any[]> {
    try {
      const results = await knowledgeScraperService.searchKnowledge(context.userRequest, {
        limit: 5,
        categories: this.identifyRelevantCategories(context.userRequest),
        useReranking: true, // Enable reranking for better relevance
        rerankingModel: 'cross-encoder/ms-marco-MiniLM-L-12-v2',
      });

      return results;
    } catch (error) {
      log.error('Failed to search knowledge base', LogContext.AGENT, { error });
      return [];
    }
  }

  /**
   * Format knowledge results for context
   */
  private formatKnowledgeResults(results: any[]): string {
    return results
      .map(
        (result) => `
[Source: ${result.source}]
Title: ${result.title}
Content: ${result.content.substring(0, 500)}...
Category: ${result.category}
`
      )
      .join('\n---\n');
  }

  /**
   * Identify relevant categories based on request
   */
  private identifyRelevantCategories(request: string): string[] {
    const categories = [];
    const lowerRequest = request.toLowerCase();

    if (
      lowerRequest.includes('javascript') ||
      lowerRequest.includes('react') ||
      lowerRequest.includes('node')
    ) {
      categories.push('web-development', 'javascript');
    }
    if (
      lowerRequest.includes('ai') ||
      lowerRequest.includes('machine learning') ||
      lowerRequest.includes('ml')
    ) {
      categories.push('ai-ml');
    }
    if (lowerRequest.includes('python')) {
      categories.push('programming-languages', 'python');
    }
    if (lowerRequest.includes('api') || lowerRequest.includes('endpoint')) {
      categories.push('api-reference');
    }

    return categories.length > 0 ? categories : ['general'];
  }
  protected buildSystemPrompt(): string {
    return `You are an expert information retrieval and research agent with advanced analytical capabilities.

ROLE: Information Gathering & Context Synthesis Specialist

CAPABILITIES:
- Research and gather relevant information from context
- Synthesize information from multiple sources
- Identify key facts, patterns, and insights
- Extract structured data from unstructured text
- Provide comprehensive context analysis
- Generate research summaries and reports

RESPONSE FORMAT:
Always respond with a structured JSON format:
{
  "research_summary": {
    "topic": "Main research topic",
    "key_findings": [
      {
        "finding": "Important discovery or fact",
        "relevance": "high|medium|low",
        "source_context": "Where this information was derived from",
        "confidence": number_between_0_and_1
      }
    ],
    "information_categories": {
      "facts": ["List of verified facts"],
      "concepts": ["Important concepts and definitions"],
      "relationships": ["Connections between different elements"],
      "gaps": ["Areas where more information is needed"]
    },
    "structured_data": {
      "entities": ["People, places, organizations mentioned"],
      "dates": ["Important dates and timelines"],
      "numbers": ["Relevant statistics and metrics"],
      "technologies": ["Technical tools and systems mentioned"]
    }
  },
  "context_analysis": {
    "complexity": "low|medium|high",
    "domain": "Primary subject domain",
    "urgency": "low|medium|high",
    "completeness": number_between_0_and_1
  },
  "recommendations": [
    {
      "action": "Recommended next step",
      "priority": "high|medium|low",
      "reasoning": "Why this action is recommended"
    }
  ],
  "reasoning": "Detailed explanation of research approach and findings",
  "confidence": number_between_0_and_1,
  "search_strategy": "Description of how information was gathered and analyzed"
}

RESEARCH PRINCIPLES:
1. Always identify the core information need first
2. Look for multiple perspectives and viewpoints
3. Distinguish between facts, opinions, and speculation
4. Consider the credibility and recency of information
5. Identify information gaps and limitations
6. Synthesize findings into actionable insights
7. Provide specific, relevant examples when possible

Be thorough, accurate, and objective. Focus on providing comprehensive context that enables informed decision-making.`;
  }

  protected getInternalModelName(): string {
    return 'retriever-smart';
  }

  protected getTemperature(): number {
    return 0.2; // Lower temperature for more factual, consistent retrieval
  }

  protected getMaxTokens(): number {
    return 3000; // Allow for comprehensive research responses
  }

  protected getAdditionalContext(context: AgentContext): string | null {
    let       additionalContext = '';

    // Extract search intent and scope
    const searchIntent = this.extractSearchIntent(context.userRequest);
    if (searchIntent) {
      additionalContext += `Search intent: ${searchIntent}\n`;
    }

    // Identify domain/field
    const domain = this.identifyDomain(context.userRequest);
    if (domain) {
      additionalContext += `Subject domain: ${domain}\n`;
    }

    // Check for specific information types requested
    const infoTypes = this.extractInformationTypes(context.userRequest);
    if (infoTypes.length > 0) {
      additionalContext += `Information types requested: ${infoTypes.join(', ')}\n`;
    }

    // Look for scope limitations
    const scope = this.extractScope(context.userRequest);
    if (scope) {
      additionalContext += `Research scope: ${scope}\n`;
    }

    // Include knowledge base results if available
    if (context.metadata?.knowledgeBase) {
      additionalContext += `\n\nRelevant Knowledge Base Information:\n${context.metadata.knowledgeBase}\n`;
    }

    return additionalContext || null;
  }

  private extractSearchIntent(request: string): string | null {
    const intentPatterns = [
      { pattern: /find (information|details|data) about/gi, intent: 'information_gathering' },
      { pattern: /research/gi, intent: 'comprehensive_research' },
      { pattern: /what is/gi, intent: 'definition_lookup' },
      { pattern: /how (does|do|to)/gi, intent: 'process_explanation' },
      { pattern: /compare/gi, intent: 'comparison_analysis' },
      { pattern: /analyze/gi, intent: 'deep_analysis' },
      { pattern: /summary|summarize/gi, intent: 'summarization' },
    ];

    for (const { pattern, intent } of intentPatterns) {
      if (pattern.test(request)) {
        return intent;
      }
    }

    return null;
  }

  private identifyDomain(request: string): string | null {
    const domainKeywords = {
      technology: [
        'software',
        'programming',
        'AI',
        'machine learning',
        'database',
        'API',
        'framework',
      ],
      business: ['strategy', 'marketing', 'finance', 'management', 'startup', 'revenue'],
      science: ['research', 'study', 'experiment', 'data', 'analysis', 'hypothesis'],
      education: ['learning', 'course', 'curriculum', 'teaching', 'training'],
      health: ['medical', 'healthcare', 'treatment', 'diagnosis', 'wellness'],
      legal: ['law', 'regulation', 'compliance', 'legal', 'contract', 'rights'],
    };

    const requestLower = request.toLowerCase();

    for (const [domain, keywords] of Object.entries(domainKeywords)) {
      if (keywords.some((keyword) => requestLower.includes(keyword))) {
        return domain;
      }
    }

    return null;
  }

  private extractInformationTypes(request: string): string[] {
    const types: string[] = [];
    const typePatterns = [
      { pattern: /statistics?|numbers?|metrics?/gi, type: 'statistics' },
      { pattern: /examples?/gi, type: 'examples' },
      { pattern: /definition/gi, type: 'definitions' },
      { pattern: /process|steps|procedure/gi, type: 'processes' },
      { pattern: /benefits?|advantages?/gi, type: 'benefits' },
      { pattern: /risks?|disadvantages?|problems?/gi, type: 'risks' },
      { pattern: /alternatives?|options?/gi, type: 'alternatives' },
      { pattern: /timeline|history|chronology/gi, type: 'timeline' },
    ];

    for (const { pattern, type } of typePatterns) {
      if (pattern.test(request)) {
        types.push(type);
      }
    }

    return types;
  }

  private extractScope(request: string): string | null {
    const scopePatterns = [
      /recent|latest|current/gi,
      /comprehensive|complete|thorough/gi,
      /brief|quick|summary/gi,
      /detailed|in-depth/gi,
      /(in|for) the (last|past) ([^,.]+)/gi,
    ];

    for (const pattern of scopePatterns) {
      const match = request.match(pattern);
      if (match) {
        return match[0];
      }
    }

    return null;
  }

  protected calculateConfidence(llmResponse: unknown, context: AgentContext): number {
    let confidence = super.calculateConfidence(llmResponse, context);

    try {
      const parsed = JSON.parse((llmResponse as any).content);

      // Check for structured research summary
      if (parsed.research_summary) {
        confidence += 0.1;

        if (
          parsed.research_summary.key_findings &&
          Array.isArray(parsed.research_summary.key_findings)
        ) {
          confidence += 0.1;
        }
      return undefined;
      return undefined;

        if (parsed.research_summary.information_categories) {
          confidence += 0.05;
        }

        return undefined;

        return undefined;

        if (parsed.research_summary.structured_data) {
          confidence += 0.05;
        }

        return undefined;

        return undefined;
      }

      // Check for context analysis
      if (parsed.context_analysis) {
        confidence += 0.05;
      }
      return undefined;
      return undefined;

      // Check for actionable recommendations
      if (parsed.recommendations && Array.isArray(parsed.recommendations)) {
        confidence += 0.05;
      }

      // Bonus for comprehensive response
      if (parsed.search_strategy) {
        confidence += 0.05;
      }
      return undefined;
      return undefined;
    } catch {
      // Not valid JSON, reduce confidence
      confidence -= 0.15;
    }

    return Math.max(0.1, Math.min(1.0, confidence));
  }
}

export default EnhancedRetrieverAgent;
