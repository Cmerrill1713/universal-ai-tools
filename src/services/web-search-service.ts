import { load } from 'cheerio';

import { config } from '../config/environment';
import { log, LogContext } from '../utils/logger';

export interface WebResult {
  title: string;
  url: string;
  snippet?: string;
  fullContent?: string;
  extractedData?: {
    headings: string[];
    keyPoints: string[];
    metadata: Record<string, any>;
    structured?: any;
  };
  relevanceScore?: number;
}

export interface SearxngResponse {
  results: Array<{
    title: string;
    url: string;
    content: string;
    engine: string;
  }>;
}

type CacheEntry = { results: WebResult[]; expiresAt: number };

export class WebSearchService {
  private cache = new Map<string, CacheEntry>();
  private lastFailureAt = 0;
  private failureBackoffMs = 30000; // 30s backoff after failure
  private ttlMs = 5 * 60 * 1000; // 5 minutes
  private searxngUrl = config.searxng?.url || 'http://localhost:8888';
  private crawl4aiUrl = config.crawl4ai?.url || 'http://localhost:8000';
  private deepCrawlCache = new Map<string, { content: string; extractedData: any; expiresAt: number }>();

  private getCacheKey(query: string, limit: number): string {
    return `${query}::${limit}`.toLowerCase();
  }

  private setCache(query: string, limit: number, results: WebResult[]): void {
    const key = this.getCacheKey(query, limit);
    this.cache.set(key, { results, expiresAt: Date.now() + this.ttlMs });
  }

  private getCached(query: string, limit: number): WebResult[] | null {
    const key = this.getCacheKey(query, limit);
    const entry = this.cache.get(key);
    if (entry && entry.expiresAt > Date.now()) {return entry.results;}
    return null;
  }

  private dedupe(results: WebResult[]): WebResult[] {
    const seen = new Set<string>();
    const out: WebResult[] = [];
    for (const r of results) {
      const u = r.url?.trim();
      if (!u || seen.has(u)) {continue;}
      seen.add(u);
      out.push(r);
    }
    return out;
  }

  async searchSearxng(query: string, limit = 5, engines?: string[], categories?: string[]): Promise<WebResult[]> {
    if (config.offlineMode || config.disableExternalCalls) {
      return [];
    }

    try {
      if (!globalThis.fetch) {return [];}
      
      const searchParams = new URLSearchParams({
        q: query,
        format: 'json'
      });

      if (engines && engines.length > 0) {
        searchParams.append('engines', engines.join(','));
      }

      if (categories && categories.length > 0) {
        searchParams.append('categories', categories.join(','));
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const resp = await globalThis.fetch(
        `${this.searxngUrl}/search?${searchParams.toString()}`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; Universal-AI-Tools/1.0)',
            'Accept': 'application/json',
          },
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!resp.ok) {
        throw new Error(`Searxng responded with status ${resp.status}`);
      }

      const data: SearxngResponse = await resp.json();
      const results: WebResult[] = (data.results || []).slice(0, limit).map((item) => ({
        title: item.title || '',
        url: item.url || '',
        snippet: item.content || undefined,
      }));

      return this.dedupe(results);
    } catch (error) {
      log.warn('Searxng search failed', LogContext.SERVICE, { error });
      return [];
    }
  }

  async searchDuckDuckGo(query: string, limit = 5): Promise<WebResult[]> {
    if (config.offlineMode || config.disableExternalCalls) {
      return [];
    }
    const cached = this.getCached(query, limit);
    if (cached) {return cached;}

    // Backoff if recent failure
    if (Date.now() - this.lastFailureAt < this.failureBackoffMs) {return [];}

    // Try Searxng first
    const searxngResults = await this.searchSearxng(query, limit, ['duckduckgo']);
    if (searxngResults.length > 0) {
      this.setCache(query, limit, searxngResults);
      return searxngResults;
    }

    // Fallback to direct DuckDuckGo scraping
    const results: WebResult[] = [];
    try {
      if (!globalThis.fetch) {return [];}
      const resp = await globalThis.fetch(
        `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; Universal-AI-Tools/1.0)',
          },
        }
      );
      const html = await resp.text();
      const $ = load(html);
      $('a.result__a').each((i, el) => {
        const title = $(el).text().trim();
        const url = $(el).attr('href') || '';
        const snippet = $(el).parents('.result').find('.result__snippet').text().trim();
        if (title && url) {results.push({ title, url, snippet });}
      });
      const deduped = this.dedupe(results).slice(0, limit);
      this.setCache(query, limit, deduped);
      return deduped;
    } catch {
      this.lastFailureAt = Date.now();
    }
    return results;
  }

  async search(query: string, limit = 5, options?: {
    engines?: string[];
    categories?: string[];
    preferSearxng?: boolean;
  }): Promise<WebResult[]> {
    if (config.offlineMode || config.disableExternalCalls) {
      return [];
    }

    const cached = this.getCached(query, limit);
    if (cached) {return cached;}

    // Try Searxng first if preferred or if no specific options
    if (options?.preferSearxng !== false) {
      const searxngResults = await this.searchSearxng(
        query, 
        limit, 
        options?.engines, 
        options?.categories
      );
      if (searxngResults.length > 0) {
        this.setCache(query, limit, searxngResults);
        return searxngResults;
      }
    }

    // Fallback to DuckDuckGo if Searxng fails or is disabled
    return this.searchDuckDuckGo(query, limit);
  }

  /**
   * Enhanced crawling with Crawl4AI for deep content extraction
   */
  async crawlWithAI(url: string, options?: {
    extractStructured?: boolean;
    includeLinks?: boolean;
    maxDepth?: number;
    waitTime?: number;
  }): Promise<{
    content: string;
    extractedData: {
      headings: string[];
      keyPoints: string[];
      metadata: Record<string, any>;
      structured?: any;
    };
    success: boolean;
  }> {
    if (config.offlineMode || config.disableExternalCalls) {
      return { content: '', extractedData: { headings: [], keyPoints: [], metadata: {} }, success: false };
    }

    // Check cache first
    const cacheKey = `crawl:${url}`;
    const cached = this.deepCrawlCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return { content: cached.content, extractedData: cached.extractedData, success: true };
    }

    try {
      if (!globalThis.fetch) {return { content: '', extractedData: { headings: [], keyPoints: [], metadata: {} }, success: false };}

      log.info('🕷️ Starting Crawl4AI deep crawl', LogContext.AI, { url });

      const crawlPayload = {
        url,
        extract_structured: options?.extractStructured || true,
        include_links: options?.includeLinks || false,
        wait_time: options?.waitTime || 2,
        remove_overlay_elements: true,
        magic: true, // Enable AI-powered content extraction
        word_count_threshold: 10,
        css_selector: 'main, article, .content, .post, .entry-content, p, h1, h2, h3, h4, h5, h6',
        excluded_tags: ['nav', 'footer', 'header', 'aside', 'script', 'style', 'noscript', 'iframe']
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout for deep crawl

      const response = await globalThis.fetch(`${this.crawl4aiUrl}/crawl`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Universal-AI-Tools/1.0'
        },
        body: JSON.stringify(crawlPayload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Crawl4AI responded with status ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Crawl4AI crawl failed');
      }

      // Extract structured data
      const extractedData = {
        headings: this.extractHeadings(result.cleaned_html || result.markdown || ''),
        keyPoints: this.extractKeyPoints(result.markdown || result.cleaned_html || ''),
        metadata: {
          title: result.metadata?.title || '',
          description: result.metadata?.description || '',
          keywords: result.metadata?.keywords || [],
          wordCount: result.word_count || 0,
          readingTime: Math.ceil((result.word_count || 0) / 200), // Assume 200 WPM
          url: result.url || url,
          crawledAt: new Date().toISOString()
        },
        structured: result.extracted_content || null
      };

      const content = result.markdown || result.cleaned_html || '';

      // Cache the result
      this.deepCrawlCache.set(cacheKey, {
        content,
        extractedData,
        expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hour cache for crawled content
      });

      log.info('✅ Crawl4AI crawl completed', LogContext.AI, {
        url,
        wordCount: extractedData.metadata.wordCount,
        headings: extractedData.headings.length,
        keyPoints: extractedData.keyPoints.length
      });

      return { content, extractedData, success: true };

    } catch (error) {
      log.error('❌ Crawl4AI crawl failed', LogContext.AI, {
        url,
        error: error instanceof Error ? error.message : String(error)
      });

      // Fallback to basic fetch if Crawl4AI fails
      return this.fallbackCrawl(url);
    }
  }

  /**
   * Fallback crawling method using basic fetch + cheerio
   */
  private async fallbackCrawl(url: string): Promise<{
    content: string;
    extractedData: {
      headings: string[];
      keyPoints: string[];
      metadata: Record<string, any>;
      structured?: any;
    };
    success: boolean;
  }> {
    try {
      if (!globalThis.fetch) {return { content: '', extractedData: { headings: [], keyPoints: [], metadata: {} }, success: false };}

      const response = await globalThis.fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Universal-AI-Tools/1.0)' }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      const $ = load(html);

      // Remove unwanted elements
      $('script, style, nav, footer, header, aside, .ads, .advertisement').remove();

      // Extract main content
      const mainContent = $('main, article, .content, .post, .entry-content').first();
      const content = mainContent.length > 0 ? mainContent.text() : $('body').text();

      // Extract headings
      const headings: string[] = [];
      $('h1, h2, h3, h4, h5, h6').each((_, el) => {
        const heading = $(el).text().trim();
        if (heading) {headings.push(heading);}
      });

      // Extract key points (first sentences of paragraphs)
      const keyPoints: string[] = [];
      $('p').each((_, el) => {
        const text = $(el).text().trim();
        if (text && text.length > 50) {
          const firstSentence = text.split('.')[0] + '.';
          if (firstSentence.length > 20) {keyPoints.push(firstSentence);}
        }
      });

      const extractedData = {
        headings: headings.slice(0, 10), // Limit to 10 headings
        keyPoints: keyPoints.slice(0, 5), // Limit to 5 key points
        metadata: {
          title: $('title').text() || $('h1').first().text() || '',
          description: $('meta[name="description"]').attr('content') || '',
          keywords: ($('meta[name="keywords"]').attr('content') || '').split(',').map(k => k.trim()).filter(Boolean),
          wordCount: content.split(/\s+/).length,
          readingTime: Math.ceil(content.split(/\s+/).length / 200),
          url,
          crawledAt: new Date().toISOString()
        }
      };

      return { content: content.trim(), extractedData, success: true };

    } catch (error) {
      log.warn('⚠️ Fallback crawl also failed', LogContext.AI, {
        url,
        error: error instanceof Error ? error.message : String(error)
      });

      return { content: '', extractedData: { headings: [], keyPoints: [], metadata: {} }, success: false };
    }
  }

  /**
   * Enhanced search with deep crawling for top results
   */
  async searchWithDeepCrawling(query: string, options?: {
    limit?: number;
    crawlTopResults?: number;
    engines?: string[];
    categories?: string[];
  }): Promise<WebResult[]> {
    const limit = options?.limit || 5;
    const crawlTopResults = options?.crawlTopResults || 2;

    // First, get basic search results
    const searchResults = await this.search(query, limit, {
      engines: options?.engines,
      categories: options?.categories
    });

    if (searchResults.length === 0) {
      return [];
    }

    // Deep crawl the top results
    const enhancedResults: WebResult[] = [];
    
    for (let i = 0; i < Math.min(searchResults.length, crawlTopResults); i++) {
      const result = searchResults[i];
      if (!result) {continue;}
      
      log.info('🔍 Deep crawling top result', LogContext.AI, { 
        url: result.url, 
        title: result.title 
      });

      const crawlData = await this.crawlWithAI(result.url, {
        extractStructured: true,
        waitTime: 1
      });

      if (crawlData.success) {
        enhancedResults.push({
          title: result.title,
          url: result.url,
          snippet: result.snippet,
          fullContent: crawlData.content,
          extractedData: crawlData.extractedData,
          relevanceScore: this.calculateRelevanceScore(query, crawlData.content, crawlData.extractedData)
        });
      } else {
        enhancedResults.push(result);
      }
    }

    // Add remaining results without deep crawling
    for (let i = crawlTopResults; i < searchResults.length; i++) {
      const result = searchResults[i];
      if (result) {
        enhancedResults.push(result);
      }
    }

    // Sort by relevance score if available
    return enhancedResults.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
  }

  /**
   * Extract key points from content
   */
  private extractKeyPoints(content: string): string[] {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);
    const keyPoints: string[] = [];

    // Look for sentences with important keywords
    const importantKeywords = ['important', 'key', 'main', 'primary', 'essential', 'crucial', 'significant', 'note that', 'remember', 'keep in mind'];
    
    for (const sentence of sentences) {
      const lowerSentence = sentence.toLowerCase();
      if (importantKeywords.some(keyword => lowerSentence.includes(keyword))) {
        keyPoints.push(sentence.trim() + '.');
      }
    }

    // If no keyword-based key points, take first sentences of paragraphs
    if (keyPoints.length === 0) {
      const paragraphs = content.split('\n\n').filter(p => p.trim().length > 50);
      for (const para of paragraphs.slice(0, 5)) {
        const firstSentence = para.split(/[.!?]/)[0]?.trim();
        if (firstSentence && firstSentence.length > 20) {
          keyPoints.push(firstSentence + '.');
        }
      }
    }

    return keyPoints.slice(0, 5);
  }

  /**
   * Extract headings from content
   */
  private extractHeadings(content: string): string[] {
    const headings: string[] = [];
    
    // Extract markdown headings
    const markdownHeadings = content.match(/^#{1,6}\s+.+$/gm);
    if (markdownHeadings) {
      headings.push(...markdownHeadings.map(h => h.replace(/^#+\s+/, '')));
    }

    // Extract HTML headings
    const htmlHeadings = content.match(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi);
    if (htmlHeadings) {
      headings.push(...htmlHeadings.map(h => h.replace(/<[^>]+>/g, '')));
    }

    return Array.from(new Set(headings)).slice(0, 10); // Dedupe and limit
  }

  /**
   * Calculate relevance score based on query match
   */
  private calculateRelevanceScore(query: string, content: string, extractedData: any): number {
    const queryTerms = query.toLowerCase().split(/\s+/);
    const contentLower = content.toLowerCase();
    const headingsText = extractedData.headings.join(' ').toLowerCase();
    const keyPointsText = extractedData.keyPoints.join(' ').toLowerCase();

    let score = 0;

    // Score based on query term frequency in content
    for (const term of queryTerms) {
      const contentMatches = (contentLower.match(new RegExp(term, 'g')) || []).length;
      const headingMatches = (headingsText.match(new RegExp(term, 'g')) || []).length;
      const keyPointMatches = (keyPointsText.match(new RegExp(term, 'g')) || []).length;

      score += contentMatches * 0.1 + headingMatches * 0.5 + keyPointMatches * 0.3;
    }

    // Bonus for comprehensive content
    if (extractedData.metadata.wordCount > 500) {score += 0.2;}
    if (extractedData.headings.length > 3) {score += 0.1;}
    if (extractedData.keyPoints.length > 2) {score += 0.1;}

    return Math.min(score, 10); // Cap at 10
  }

  async searchWikipedia(query: string, limit = 3): Promise<WebResult[]> {
    if (config.offlineMode || config.disableExternalCalls) {
      return [];
    }
    const cacheKey = `wiki::${this.getCacheKey(query, limit)}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {return cached.results;}

    // Try Searxng with Wikipedia engine first
    const searxngResults = await this.searchSearxng(query, limit, ['wikipedia']);
    if (searxngResults.length > 0) {
      this.cache.set(cacheKey, { results: searxngResults, expiresAt: Date.now() + this.ttlMs });
      return searxngResults;
    }

    // Fallback to direct Wikipedia API
    try {
      const api = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
        query
      )}&format=json&utf8=1&srlimit=${limit}`;
      if (!globalThis.fetch) {return [];}
      const resp = await globalThis.fetch(api, {
        headers: { 'User-Agent': 'Universal-AI-Tools/1.0' },
      });
      const data = await resp.json();
      const results = (data?.query?.search || []).slice(0, limit).map((s: any) => {
        const title = s.title as string;
        const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
        const snippet = s.snippet?.replace(/<[^>]+>/g, '') || undefined;
        return { title, url, snippet } as WebResult;
      });
      const deduped = this.dedupe(results);
      this.cache.set(cacheKey, { results: deduped, expiresAt: Date.now() + this.ttlMs });
      return deduped;
    } catch {
      this.lastFailureAt = Date.now();
      return [];
    }
  }
}

export const webSearchService = new WebSearchService();
