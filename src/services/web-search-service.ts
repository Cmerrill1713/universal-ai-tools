import { load } from 'cheerio';

import { config } from '@/config/environment';

export interface WebResult {
  title: string;
  url: string;
  snippet?: string;
}

type CacheEntry = { results: WebResult[]; expiresAt: number };

export class WebSearchService {
  private cache = new Map<string, CacheEntry>();
  private lastFailureAt = 0;
  private failureBackoffMs = 30000; // 30s backoff after failure
  private ttlMs = 5 * 60 * 1000; // 5 minutes

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
    if (entry && entry.expiresAt > Date.now()) return entry.results;
    return null;
  }

  private dedupe(results: WebResult[]): WebResult[] {
    const seen = new Set<string>();
    const out: WebResult[] = [];
    for (const r of results) {
      const u = r.url?.trim();
      if (!u || seen.has(u)) continue;
      seen.add(u);
      out.push(r);
    }
    return out;
  }

  async searchDuckDuckGo(query: string, limit = 5): Promise<WebResult[]> {
    if (config.offlineMode || config.disableExternalCalls) {
      return [];
    }
    const cached = this.getCached(query, limit);
    if (cached) return cached;

    // Backoff if recent failure
    if (Date.now() - this.lastFailureAt < this.failureBackoffMs) return [];

    const results: WebResult[] = [];
    try {
      if (!globalThis.fetch) return [];
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
        if (title && url) results.push({ title, url, snippet });
      });
      const deduped = this.dedupe(results).slice(0, limit);
      this.setCache(query, limit, deduped);
      return deduped;
    } catch {
      this.lastFailureAt = Date.now();
    }
    return results;
  }

  async searchWikipedia(query: string, limit = 3): Promise<WebResult[]> {
    if (config.offlineMode || config.disableExternalCalls) {
      return [];
    }
    const cacheKey = `wiki::${this.getCacheKey(query, limit)}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.results;

    try {
      const api = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
        query
      )}&format=json&utf8=1&srlimit=${limit}`;
      if (!globalThis.fetch) return [];
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
