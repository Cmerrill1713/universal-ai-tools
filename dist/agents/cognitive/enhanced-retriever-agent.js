import { knowledgeScraperService } from '@/services/knowledge-scraper-service';
import { log, LogContext } from '@/utils/logger';
import { EnhancedBaseAgent } from '../enhanced-base-agent';
export class EnhancedRetrieverAgent extends EnhancedBaseAgent {
    async execute(context) {
        try {
            const knowledgeResults = await this.searchKnowledgeBase(context);
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
        }
        catch (error) {
            log.warn('⚠️ Knowledge base search failed, continuing without it', LogContext.AGENT, {
                error: error instanceof Error ? error.message : String(error),
            });
        }
        return super.execute(context);
    }
    async searchKnowledgeBase(context) {
        try {
            const results = await knowledgeScraperService.searchKnowledge(context.userRequest, {
                limit: 5,
                categories: this.identifyRelevantCategories(context.userRequest),
                useReranking: true,
                rerankingModel: 'cross-encoder/ms-marco-MiniLM-L-12-v2',
            });
            return results;
        }
        catch (error) {
            log.error('Failed to search knowledge base', LogContext.AGENT, { error });
            return [];
        }
    }
    formatKnowledgeResults(results) {
        return results
            .map((result) => `
[Source: ${result.source}]
Title: ${result.title}
Content: ${result.content.substring(0, 500)}...
Category: ${result.category}
`)
            .join('\n---\n');
    }
    identifyRelevantCategories(request) {
        const categories = [];
        const lowerRequest = request.toLowerCase();
        if (lowerRequest.includes('javascript') ||
            lowerRequest.includes('react') ||
            lowerRequest.includes('node')) {
            categories.push('web-development', 'javascript');
        }
        if (lowerRequest.includes('ai') ||
            lowerRequest.includes('machine learning') ||
            lowerRequest.includes('ml')) {
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
    buildSystemPrompt() {
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
    getInternalModelName() {
        return 'retriever-smart';
    }
    getTemperature() {
        return 0.2;
    }
    getMaxTokens() {
        return 3000;
    }
    getAdditionalContext(context) {
        let additionalContext = '';
        const searchIntent = this.extractSearchIntent(context.userRequest);
        if (searchIntent) {
            additionalContext += `Search intent: ${searchIntent}\n`;
        }
        const domain = this.identifyDomain(context.userRequest);
        if (domain) {
            additionalContext += `Subject domain: ${domain}\n`;
        }
        const infoTypes = this.extractInformationTypes(context.userRequest);
        if (infoTypes.length > 0) {
            additionalContext += `Information types requested: ${infoTypes.join(', ')}\n`;
        }
        const scope = this.extractScope(context.userRequest);
        if (scope) {
            additionalContext += `Research scope: ${scope}\n`;
        }
        if (context.metadata?.knowledgeBase) {
            additionalContext += `\n\nRelevant Knowledge Base Information:\n${context.metadata.knowledgeBase}\n`;
        }
        return additionalContext || null;
    }
    extractSearchIntent(request) {
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
    identifyDomain(request) {
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
    extractInformationTypes(request) {
        const types = [];
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
    extractScope(request) {
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
    calculateConfidence(llmResponse, context) {
        let confidence = super.calculateConfidence(llmResponse, context);
        try {
            const parsed = JSON.parse(llmResponse.content);
            if (parsed.research_summary) {
                confidence += 0.1;
                if (parsed.research_summary.key_findings &&
                    Array.isArray(parsed.research_summary.key_findings)) {
                    confidence += 0.1;
                }
                if (parsed.research_summary.information_categories) {
                    confidence += 0.05;
                }
                if (parsed.research_summary.structured_data) {
                    confidence += 0.05;
                }
            }
            if (parsed.context_analysis) {
                confidence += 0.05;
            }
            if (parsed.recommendations && Array.isArray(parsed.recommendations)) {
                confidence += 0.05;
            }
            if (parsed.search_strategy) {
                confidence += 0.05;
            }
        }
        catch {
            confidence -= 0.15;
        }
        return Math.max(0.1, Math.min(1.0, confidence));
    }
}
export default EnhancedRetrieverAgent;
//# sourceMappingURL=enhanced-retriever-agent.js.map