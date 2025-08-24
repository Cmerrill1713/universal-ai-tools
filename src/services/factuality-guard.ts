import { contextStorageService } from '@/services/context-storage-service';
import { type LLMMessage, llmRouter } from '@/services/llm-router-service';
import { semanticContextRetrievalService } from '@/services/semantic-context-retrieval';
import { log,LogContext } from '@/utils/logger';

export interface FactualityResult {
  verified: boolean;
  content: string;
  references?: Array<{ title?: string; url?: string; snippet?: string }>;
  lookedUp?: boolean;
}

const TRUTH_POLICY = `
You must not fabricate facts. If uncertain, explicitly say "I don't know" and suggest how to verify. Quote or summarize sources when possible. Provide citations if you assert specific facts (numbers, names, dates, URLs).`;

export async function checkAndCorrectFactuality(
  originalContent: string,
  userQuery: string,
  options: { userId?: string; requestId?: string; projectPath?: string } = {}
): Promise<FactualityResult> {
  try {
    // Step 1: Self-check via LLM (extract claims and ask for uncertainty)
    const selfCheckMessages: LLMMessage[] = [
      {
        role: 'system',
        content:
          'You verify factual accuracy. Extract concrete claims from the assistant answer. For each claim, assess certainty (high/medium/low). If low, propose an "I don\'t know" rewrite.',
      },
      {
        role: 'user',
        content: `User query: ${userQuery}\n\nAssistant answer:\n${originalContent}`,
      },
    ];

    const selfCheck = await llmRouter.generateResponse('retriever-smart', selfCheckMessages, {
      temperature: 0.0,
      maxTokens: 800,
      includeContext: false,
      requestId: options.requestId,
      userId: options.userId,
    });

    const needsLookup =
      /low/i.test(selfCheck.content || '') || /don\'t know/i.test(selfCheck.content || '');

    // Step 2: Try semantic retrieval from Supabase knowledge/context
    // Check verified facts first
    try {
      const { verifiedFactsService } = await import('@/services/verified-facts-service');
      const cached = await verifiedFactsService.findFact(userQuery);
      if (cached) {
        return {
          verified: true,
          content: cached.answer,
          references: cached.citations,
          lookedUp: true,
        };
      }
    } catch {}

    const retrieval = await semanticContextRetrievalService
      .semanticSearch({
        query: userQuery,
        userId: options.userId || 'anonymous',
        sessionId: options.requestId,
        projectPath: options.projectPath,
        maxResults: 5,
        fuseSimilarResults: true,
      })
      .catch(() => ({ results: [] as any[] }) as any);

    const references: FactualityResult['references'] = (retrieval.results || []).map((r: any) => ({
      title: r.title || r.contentType,
      url: r.url,
      snippet: r.content?.slice(0, 240),
    }));

    // If we have references, request a corrected/cited rewrite
    if ((references?.length || 0) > 0) {
      const citeMessages: LLMMessage[] = [
        {
          role: 'system',
          content: `${TRUTH_POLICY}\nRewrite the assistant answer with citations if possible.`,
        },
        {
          role: 'user',
          content: `User query: ${userQuery}\nCurrent answer:\n${originalContent}\n\nContext snippets (may contain relevant facts):\n${(
            retrieval.results || []
          )
            .slice(0, 5)
            .map((r: any, i: number) => `(${i + 1}) ${r.content}`)
            .join('\n\n')}`,
        },
      ];

      const rewrite = await llmRouter.generateResponse('retriever-smart', citeMessages, {
        temperature: 0.2,
        maxTokens: 1000,
        includeContext: false,
        requestId: options.requestId,
        userId: options.userId,
      });

      const revised = rewrite.content?.trim() || originalContent;

      // Save to context storage for future reuse
      try {
        await contextStorageService.storeContext({
          content: revised,
          category: 'verified_answer',
          source: 'factuality_guard',
          userId: options.userId || 'system',
          projectPath: options.projectPath,
          metadata: {
            originalContent,
            userQuery,
            references,
            lookedUp: true,
            requestId: options.requestId,
          },
        } as any);
      } catch (e) {
        log.warn('Factuality guard: failed saving verified context', LogContext.DATABASE, { e });
      }

      return { verified: true, content: revised, references, lookedUp: needsLookup || true };
    }

    // If no references and self-check was uncertain, return honest fallback
    if (needsLookup) {
      try {
        // Enhanced knowledge acquisition with Crawl4AI
        const { crawl4aiKnowledgeService } = await import('@/services/crawl4ai-knowledge-service');
        
        // Determine domain for specialized search
        const domain = inferDomain(userQuery);
        
        const knowledgeResult = await crawl4aiKnowledgeService.acquireKnowledge({
          query: userQuery,
          domain,
          maxSources: 3,
          deepCrawl: true,
          includeStructured: true,
          filterCriteria: {
            minWordCount: 100,
            maxAge: 365 // 1 year
          }
        });

        if (knowledgeResult.sources.length > 0) {
          // Create comprehensive answer with deep knowledge
          const sourcesSummary = knowledgeResult.sources.map((source, i) => {
            const keyPoints = source.extractedData.keyPoints.slice(0, 2).join(' ');
            const credibility = source.credibilityScore > 0.7 ? '(High credibility)' : source.credibilityScore > 0.5 ? '(Medium credibility)' : '';
            return `(${i + 1}) ${source.title} ${credibility}\n${source.url}\n${keyPoints}`;
          }).join('\n\n');

          const corrected = `I looked this up using reliable sources:\n\n${sourcesSummary}\n\nKey insights: ${knowledgeResult.summary.keyTopics.slice(0, 3).join(', ')}`;

          // Save comprehensive knowledge to context
          try {
            await contextStorageService.storeContext({
              content: corrected,
              category: 'verified_answer',
              source: 'crawl4ai_knowledge_acquisition',
              userId: options.userId || 'system',
              projectPath: options.projectPath,
              metadata: {
                userQuery,
                references: knowledgeResult.sources.map(s => ({
                  title: s.title,
                  url: s.url,
                  relevanceScore: s.relevanceScore,
                  credibilityScore: s.credibilityScore
                })),
                summary: knowledgeResult.summary,
                lookedUp: true,
                requestId: options.requestId,
                acquisitionMethod: 'crawl4ai_deep_search'
              },
            } as any);

            // Store in verified facts with enhanced metadata
            try {
              const { verifiedFactsService } = await import('@/services/verified-facts-service');
              await verifiedFactsService.upsertFact({
                question: userQuery,
                answer: corrected,
                citations: knowledgeResult.sources.map(s => ({
                  title: s.title,
                  url: s.url,
                  snippet: s.extractedData.keyPoints.slice(0, 1).join('')
                })),
              });
            } catch {}
          } catch {}

          return { 
            verified: true, 
            content: corrected, 
            references: knowledgeResult.sources.map(s => ({
              title: s.title,
              url: s.url,
              snippet: s.extractedData.keyPoints.slice(0, 1).join('')
            })), 
            lookedUp: true 
          };
        }

        // Fallback to standard web search if Crawl4AI fails
        const { webSearchService } = await import('@/services/web-search-service');
        const web = await webSearchService.searchWithDeepCrawling(userQuery, {
          limit: 3,
          crawlTopResults: 2
        });

        if (web.length > 0) {
          const cite = web
            .map((r, i) => `(${i + 1}) ${r.title} - ${r.url}\n${r.snippet || (r.extractedData?.keyPoints.slice(0, 1).join('') || '')}`)
            .join('\n\n');
          const corrected = `I was uncertain, so I looked it up:\n\n${cite}`;

          // Save to context storage
          try {
            await contextStorageService.storeContext({
              content: corrected,
              category: 'verified_answer',
              source: 'web_search_fallback',
              userId: options.userId || 'system',
              projectPath: options.projectPath,
              metadata: {
                userQuery,
                references: web,
                lookedUp: true,
                requestId: options.requestId,
              },
            } as any);
          } catch {}

          return { verified: true, content: corrected, references: web, lookedUp: true };
        }

        // Final fallback to Wikipedia
        const wiki = await webSearchService.searchWikipedia(userQuery, 3);
        if (wiki.length > 0) {
          const cite = wiki
            .map((r, i) => `(${i + 1}) ${r.title} - ${r.url}\n${r.snippet || ''}`)
            .join('\n\n');
          const corrected = `I found some information on Wikipedia:\n\n${cite}`;
          
          try {
            await contextStorageService.storeContext({
              content: corrected,
              category: 'verified_answer',
              source: 'wikipedia_fallback',
              userId: options.userId || 'system',
              projectPath: options.projectPath,
              metadata: {
                userQuery,
                references: wiki,
                lookedUp: true,
                requestId: options.requestId,
              },
            } as any);
          } catch {}
          
          return { verified: true, content: corrected, references: wiki, lookedUp: true };
        }

      } catch (error) {
        log.warn('Knowledge acquisition failed, using uncertainty response', LogContext.AI, { error });
      }

      const fallback = `I don't know for certain. I can look this up and get authoritative sources if you want.`;
      return { verified: false, content: fallback, references: [], lookedUp: false };
    }

/**
 * Infer domain from user query for specialized search
 */
function inferDomain(query: string): string | undefined {
  const queryLower = query.toLowerCase();
  
  const domainPatterns = {
    academic: /research|study|paper|academic|journal|peer.review|citation/,
    technical: /code|programming|api|software|algorithm|technical|implementation/,
    medical: /health|medical|medicine|disease|treatment|symptoms|doctor|patient/,
    legal: /law|legal|court|attorney|lawsuit|regulation|statute|contract/,
    financial: /finance|investment|stock|market|economy|banking|money|trading/,
    news: /news|current|recent|latest|happening|event|breaking/
  };

  for (const [domain, pattern] of Object.entries(domainPatterns)) {
    if (pattern.test(queryLower)) {
      return domain;
    }
  }

  return undefined;
}

    // Otherwise accept original
    return { verified: true, content: originalContent, references, lookedUp: false };
  } catch (error) {
    log.warn('Factuality guard failed; returning original content', LogContext.AI, { error });
    return { verified: false, content: originalContent };
  }
}
