/**
 * Knowledge Scraper Service
 * Scrapes various databases and knowledge sources to enhance agent capabilities
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { RateLimiter } from 'limiter';

import { config } from '@/config/environment';

import { log, LogContext } from '../utils/logger';
import { rerankingService } from './reranking-service';

interface ScrapingSource {
  name: string;
  type: 'api' | 'web' | 'dump';
  url: string;
  rateLimit: number; // requests per minute
  parser: (data: any) => KnowledgeEntry[];
  enabled: boolean;
}

interface KnowledgeEntry {
  source: string;
  category: string;
  title: string;
  content: string;
  metadata: Record<string, any>;
  embedding?: number[];
  timestamp: Date;
}

export class KnowledgeScraperService {
  private supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

  private sources: ScrapingSource[] = [
    {
      name: 'MDN Web Docs',
      type: 'web',
      url: 'https://developer.mozilla.org/en-US/docs/Web',
      rateLimit: 30,
      enabled: true,
      parser: this.parseMDN.bind(this),
    },
    {
      name: 'Stack Overflow',
      type: 'api',
      url: 'https://api.stackexchange.com/2.3/questions',
      rateLimit: 300, // With key: 10,000/day
      enabled: true,
      parser: this.parseStackOverflow.bind(this),
    },
    {
      name: 'Papers with Code',
      type: 'api',
      url: 'https://paperswithcode.com/api/v1/papers',
      rateLimit: 60,
      enabled: true,
      parser: this.parsePapersWithCode.bind(this),
    },
    {
      name: 'Hugging Face',
      type: 'api',
      url: 'https://huggingface.co/api/models',
      rateLimit: 100,
      enabled: true,
      parser: this.parseHuggingFace.bind(this),
    },
    {
      name: 'DevDocs',
      type: 'api',
      url: 'https://devdocs.io/docs.json',
      rateLimit: 60,
      enabled: true,
      parser: this.parseDevDocs.bind(this),
    },
  ];

  private readonly allowedHosts = new Set<string>([
    'developer.mozilla.org',
    'api.stackexchange.com',
    'paperswithcode.com',
    'huggingface.co',
    'devdocs.io',
  ]);

  private limiters: Map<string, RateLimiter> = new Map();

  constructor() {
    // Initialize rate limiters
    this.sources.forEach((source) => {
      this.limiters.set(
        source.name,
        new RateLimiter({ tokensPerInterval: source.rateLimit, interval: 'minute' })
      );
    });
  }

  /**
   * Scrape all enabled sources and store in Supabase
   */
  async scrapeAllSources(
    options: {
      categories?: string[];
      limit?: number;
      updateExisting?: boolean;
    } = {}
  ): Promise<void> {
    if (config.offlineMode || config.disableExternalCalls) {
      log.info('🌐 Offline mode: skipping external knowledge scraping', LogContext.SERVICE);
      return;
    }
    log.info('🔍 Starting knowledge scraping', LogContext.SERVICE);

    for (const source of this.sources) {
      if (!source.enabled) {continue;}

      try {
        await this.scrapeSource(source, options);
      } catch (error) {
        log.error(`Failed to scrape ${source.name}`, LogContext.SERVICE, { error });
      }
    }

    log.info('✅ Knowledge scraping completed', LogContext.SERVICE);
  }

  /**
   * Scrape a specific source
   */
  async scrapeSource(
    source: ScrapingSource,
    options: {
      categories?: string[];
      limit?: number;
      updateExisting?: boolean;
    } = {}
  ): Promise<void> {
    if (config.offlineMode || config.disableExternalCalls) {
      throw new Error('External scraping disabled in offline mode');
    }
    const limiter = this.limiters.get(source.name)!;

    log.info(`Scraping ${source.name}...`, LogContext.SERVICE);

    try {
      // Wait for rate limit
      await limiter.removeTokens(1);

      let data;
      if (source.type === 'api') {
        const response = await axios.get(source.url, {
          params: {
            pagesize: options.limit || 100,
            order: 'desc',
            sort: 'votes',
            tagged: options.categories?.join(';'),
          },
          headers: {
            'User-Agent': 'Universal-AI-Tools/1.0',
            Accept: 'application/json',
          },
          timeout: 15000,
          maxRedirects: 3,
          validateStatus: (status) => status >= 200 && status < 400,
        });
        data = response.data;
      } else if (source.type === 'web') {
        // Basic SSRF protection: only fetch known hosts
        try {
          const u = new URL(source.url);
          if (!this.allowedHosts.has(u.hostname)) {
            throw new Error('Host not allowed for scraping');
          }
        } catch (e) {
          throw new Error('Invalid URL for scraping');
        }
        const response = await axios.get(source.url, {
          headers: {
            'User-Agent': 'Universal-AI-Tools/1.0',
            Accept: 'text/html',
          },
          timeout: 15000,
          maxRedirects: 3,
          validateStatus: (status) => status >= 200 && status < 400,
        });
        const html = String(response.data || '');
        // Basic sanitization to avoid executing scripts or dangerous URLs during parsing
        const sanitized = html
          .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
          .replace(/on\w+\s*=\s*"[^"]*"/gi, '')
          .replace(/on\w+\s*=\s*'[^']*'/gi, '')
          .replace(/javascript:/gi, '');
        data = sanitized;
      }

      // Parse entries
      const entries = source.parser(data);

      // Store in Supabase
      await this.storeKnowledge(entries, options.updateExisting || false);

      log.info(`✅ Scraped ${entries.length} entries from ${source.name}`, LogContext.SERVICE);
    } catch (error) {
      throw new Error(`Scraping ${source.name} failed: ${error}`);
    }
  }

  /**
   * Store knowledge entries in Supabase
   */
  async storeKnowledge(entries: KnowledgeEntry[], updateExisting: boolean): Promise<void> {
    const batchSize = 100;

    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize);

      // Generate embeddings if not present
      for (const entry of batch) {
        if (!entry.embedding) {
          entry.embedding = await this.generateEmbedding(entry.content);
        }
      }

      if (updateExisting) {
        await this.supabase.from('knowledge_base').upsert(batch, { onConflict: 'source,title' });
      } else {
        await this.supabase.from('knowledge_base').insert(batch);
      }
    }
  }

  /**
   * Generate embedding for content
   */
  async generateEmbedding(content: string): Promise<number[]> {
    // This would call your embedding service
    // For now, return a mock embedding
    const mockEmbedding = Array(1536)
      .fill(0)
      .map(() => Math.random());
    return mockEmbedding;
  }

  // Parsers for different sources

  private parseMDN(html: string): KnowledgeEntry[] {
    const $ = cheerio.load(html);
    const entries: KnowledgeEntry[] = [];

    $('article').each((_, element) => {
      const title = $(element).find('h1').text().trim();
      const content = $(element).find('.section-content').text().trim();
      const category = 'web-development';

      if (title && content) {
        entries.push({
          source: 'MDN',
          category,
          title,
          content,
          metadata: {
            url: $(element).find('link[rel="canonical"]').attr('href'),
            lastModified: new Date().toISOString(),
          },
          timestamp: new Date(),
        });
      }
    });

    return entries;
  }

  private parseStackOverflow(data: any): KnowledgeEntry[] {
    return (data.items || []).map((item: any) => ({
      source: 'StackOverflow',
      category: item.tags?.[0] || 'general',
      title: item.title,
      content: `Q: ${item.title}\n\nA: ${item.accepted_answer?.body || 'No accepted answer'}`,
      metadata: {
        questionId: item.question_id,
        score: item.score,
        viewCount: item.view_count,
        tags: item.tags,
        link: item.link,
      },
      timestamp: new Date(),
    }));
  }

  private parsePapersWithCode(data: any): KnowledgeEntry[] {
    return (data.results || []).map((paper: any) => ({
      source: 'PapersWithCode',
      category: 'ai-ml',
      title: paper.title,
      content: paper.abstract || '',
      metadata: {
        paperId: paper.id,
        arxivId: paper.arxiv_id,
        urlPdf: paper.url_pdf,
        publishedDate: paper.published,
        authors: paper.authors,
      },
      timestamp: new Date(),
    }));
  }

  private parseHuggingFace(data: any): KnowledgeEntry[] {
    return (data || []).slice(0, 100).map((model: any) => ({
      source: 'HuggingFace',
      category: 'ai-models',
      title: model.modelId,
      content: `Model: ${model.modelId}\nTask: ${model.pipeline_tag || 'unknown'}\n\n${model.description || 'No description'}`,
      metadata: {
        modelId: model.modelId,
        task: model.pipeline_tag,
        downloads: model.downloads,
        likes: model.likes,
        tags: model.tags,
      },
      timestamp: new Date(),
    }));
  }

  private parseDevDocs(data: any): KnowledgeEntry[] {
    return (data || []).map((doc: any) => ({
      source: 'DevDocs',
      category: 'api-reference',
      title: `${doc.name} ${doc.version || ''}`.trim(),
      content: `${doc.name} documentation - ${doc.slug}`,
      metadata: {
        slug: doc.slug,
        type: doc.type,
        version: doc.version,
        mtime: doc.mtime,
      },
      timestamp: new Date(),
    }));
  }

  /**
   * Search knowledge base with optional reranking
   */
  async searchKnowledge(
    query: string,
    options: {
      sources?: string[];
      categories?: string[];
      limit?: number;
      useReranking?: boolean;
      rerankingModel?: string;
    } = {}
  ): Promise<KnowledgeEntry[]> {
    const embedding = await this.generateEmbedding(query);
    const searchLimit = options.useReranking ? (options.limit || 10) * 10 : options.limit || 10;

    let queryBuilder = this.supabase.rpc('search_knowledge', {
      query_embedding: embedding,
      match_count: searchLimit,
    });

    if (options.sources?.length) {
      queryBuilder = queryBuilder.in('source', options.sources);
    }

    if (options.categories?.length) {
      queryBuilder = queryBuilder.in('category', options.categories);
    }

    const { data, error } = await queryBuilder;

    if (error) {
      throw new Error(`Knowledge search failed: ${error.message}`);
    }

    const results = data || [];

    // Apply reranking if enabled
    if (options.useReranking && results.length > 0) {
      log.info('🔄 Applying reranking to search results', LogContext.SERVICE, {
        initialCount: results.length,
        targetCount: options.limit || 10,
      });

      try {
        // Convert to reranking candidates
        const candidates = results.map((result: any) => ({
          id: result.id,
          content: `${result.title}\n\n${result.content}`,
          metadata: result.metadata,
          biEncoderScore: result.similarity || 0,
        }));

        // Rerank the candidates
        const rerankedResults = await rerankingService.rerank(query, candidates, {
          topK: options.limit || 10,
          model: options.rerankingModel,
        });

        // Convert back to KnowledgeEntry format
        return rerankedResults.map((reranked) => {
          const original = results.find((r: any) => r.id === reranked.id)!;
          return {
            ...original,
            similarity: reranked.finalScore,
            reranking_score: reranked.crossEncoderScore,
          };
        });
      } catch (rerankError) {
        log.warn('⚠️ Reranking failed, returning original results', LogContext.SERVICE, {
          error: rerankError,
        });
        return results.slice(0, options.limit || 10);
      }
    }

    return results;
  }

  /**
   * Get scraping status
   */
  async getScrapingStatus(): Promise<{
    sources: Array<{
      name: string;
      enabled: boolean;
      lastScraped?: Date;
      entryCount?: number;
    }>;
    totalEntries: number;
  }> {
    try {
      // Get counts by source
      const { data: entries, error: entriesError } = await this.supabase
        .from('knowledge_base')
        .select('source')
        .not('source', 'is', null);

      if (entriesError) {
        log.warn('Failed to get knowledge base entries', LogContext.DATABASE, {
          error: entriesError,
        });
      }

      // Count entries by source
      const sourceCounts = new Map<string, number>();
      if (entries) {
        entries.forEach((entry) => {
          const source = entry.source || 'unknown';
          sourceCounts.set(source, (sourceCounts.get(source) || 0) + 1);
        });
      }

      // Get total count
      const { count: totalEntries } = await this.supabase
        .from('knowledge_base')
        .select('*', { count: 'exact', head: true });

      return {
        sources: this.sources.map((source) => ({
          name: source.name,
          enabled: source.enabled,
          entryCount: sourceCounts.get(source.name) || 0,
        })),
        totalEntries: totalEntries || 0,
      };
    } catch (error) {
      log.error('Failed to get scraping status', LogContext.SERVICE, { error });
      // Return safe defaults
      return {
        sources: this.sources.map((source) => ({
          name: source.name,
          enabled: source.enabled,
          entryCount: 0,
        })),
        totalEntries: 0,
      };
    }
  }

  /**
   * Scrape relevant sources for a specific query
   */
  async scrapeRelevantSources(query: string): Promise<any[]> {
    try {
      log.info('🔍 Scraping relevant sources', LogContext.SERVICE, {
        query: query.substring(0, 100),
        sourceCount: this.sources.filter(s => s.enabled).length
      });

      const results: any[] = [];
      const enabledSources = this.sources.filter(source => source.enabled);

      // Scrape from each enabled source
      for (const source of enabledSources.slice(0, 3)) { // Limit to 3 sources to avoid rate limiting
        try {
          const limiter = this.limiters.get(source.name);
          if (limiter) {
            await limiter.removeTokens(1);
          }

          const sourceResults = await this.scrapeFromSource(source, query);
          results.push(...sourceResults);

          log.debug(`Scraped ${sourceResults.length} entries from ${source.name}`, LogContext.SERVICE);
        } catch (error) {
          log.warn(`Failed to scrape from ${source.name}`, LogContext.SERVICE, { error });
        }
      }

      // Convert to knowledge entries format
      const knowledgeEntries = results.map(result => ({
        content: result.content || result.title || '',
        source: result.source || 'Unknown',
        category: 'scraped_knowledge',
        confidence: 0.7,
        lastVerified: new Date(),
        metadata: {
          scrapedAt: new Date(),
          originalQuery: query,
          sourceUrl: result.url,
          ...result.metadata
        },
        citations: result.url ? [result.url] : []
      }));

      log.info(`✅ Scraped ${knowledgeEntries.length} relevant entries`, LogContext.SERVICE, {
        query: query.substring(0, 50),
        sources: enabledSources.map(s => s.name)
      });

      return knowledgeEntries;

    } catch (error) {
      log.error('❌ Failed to scrape relevant sources', LogContext.SERVICE, { error, query });
      return [];
    }
  }

  /**
   * Scrape from a specific source
   */
  private async scrapeFromSource(source: ScrapingSource, query: string): Promise<any[]> {
    try {
      let {url} = source;
      let params: Record<string, any> = {};

      // Customize URL and parameters based on source
      switch (source.name) {
        case 'Stack Overflow':
          params = {
            site: 'stackoverflow',
            q: query,
            sort: 'votes',
            pagesize: 5
          };
          break;
        case 'Papers with Code':
          params = { q: query, limit: 5 };
          break;
        case 'Hugging Face':
          params = { search: query, limit: 5 };
          break;
        case 'DevDocs':
          // DevDocs requires different approach
          url = `https://devdocs.io/${encodeURIComponent(query)}`;
          break;
        case 'MDN Web Docs':
          url = `https://developer.mozilla.org/en-US/search?q=${encodeURIComponent(query)}`;
          break;
      }

      const response = await axios.get(url, {
        params,
        timeout: 10000,
        headers: {
          'User-Agent': 'Universal-AI-Tools-Scraper/1.0',
          'Accept': 'application/json'
        }
      });

      // Parse response using source-specific parser
      return source.parser(response.data);

    } catch (error) {
      log.warn(`Scraping failed for ${source.name}`, LogContext.SERVICE, { error });
      return [];
    }
  }
}

// Create singleton instance
export const knowledgeScraperService = new KnowledgeScraperService();
