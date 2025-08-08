import { type LLMMessage, llmRouter } from '@/services/llm-router-service';
import { LogContext, log } from '@/utils/logger';
import { semanticContextRetrievalService } from '@/services/semantic-context-retrieval';
import { contextStorageService } from '@/services/context-storage-service';

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
        const { webSearchService } = await import('@/services/web-search-service');
        const web = await webSearchService.searchDuckDuckGo(userQuery, 3);
        if (web.length > 0) {
          const cite = web
            .map((r, i) => `(${i + 1}) ${r.title} - ${r.url}\n${r.snippet || ''}`)
            .join('\n\n');
          const corrected = `I was uncertain, so I looked it up:\n\n${cite}`;

          // Save verified lookup to both context and verified facts
          try {
            await contextStorageService.storeContext({
              content: corrected,
              category: 'verified_answer',
              source: 'web_lookup',
              userId: options.userId || 'system',
              projectPath: options.projectPath,
              metadata: {
                userQuery,
                references: web,
                lookedUp: true,
                requestId: options.requestId,
              },
            } as any);
            try {
              const { verifiedFactsService } = await import('@/services/verified-facts-service');
              await verifiedFactsService.upsertFact({
                question: userQuery,
                answer: corrected,
                citations: web,
              });
            } catch {}
          } catch {}

          return { verified: true, content: corrected, references: web, lookedUp: true };
        } else {
          const wiki = await webSearchService.searchWikipedia(userQuery, 3);
          if (wiki.length > 0) {
            const cite = wiki
              .map((r, i) => `(${i + 1}) ${r.title} - ${r.url}\n${r.snippet || ''}`)
              .join('\n\n');
            const corrected = `I was uncertain, so I looked it up:\n\n${cite}`;
            try {
              await contextStorageService.storeContext({
                content: corrected,
                category: 'verified_answer',
                source: 'web_lookup_wikipedia',
                userId: options.userId || 'system',
                projectPath: options.projectPath,
                metadata: {
                  userQuery,
                  references: wiki,
                  lookedUp: true,
                  requestId: options.requestId,
                },
              } as any);
              const { verifiedFactsService } = await import('@/services/verified-facts-service');
              await verifiedFactsService.upsertFact({
                question: userQuery,
                answer: corrected,
                citations: wiki,
              });
            } catch {}
            return { verified: true, content: corrected, references: wiki, lookedUp: true };
          }
        }
      } catch {}

      const fallback = `I don't know for certain. I can look this up and get authoritative sources if you want.`;
      return { verified: false, content: fallback, references: [], lookedUp: false };
    }

    // Otherwise accept original
    return { verified: true, content: originalContent, references, lookedUp: false };
  } catch (error) {
    log.warn('Factuality guard failed; returning original content', LogContext.AI, { error });
    return { verified: false, content: originalContent };
  }
}
