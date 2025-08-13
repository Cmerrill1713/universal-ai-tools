import { load } from 'cheerio';
import { config } from '@/config/environment';
export class WebSearchService {
    cache = new Map();
    lastFailureAt = 0;
    failureBackoffMs = 30000;
    ttlMs = 5 * 60 * 1000;
    getCacheKey(query, limit) {
        return `${query}::${limit}`.toLowerCase();
    }
    setCache(query, limit, results) {
        const key = this.getCacheKey(query, limit);
        this.cache.set(key, { results, expiresAt: Date.now() + this.ttlMs });
    }
    getCached(query, limit) {
        const key = this.getCacheKey(query, limit);
        const entry = this.cache.get(key);
        if (entry && entry.expiresAt > Date.now())
            return entry.results;
        return null;
    }
    dedupe(results) {
        const seen = new Set();
        const out = [];
        for (const r of results) {
            const u = r.url?.trim();
            if (!u || seen.has(u))
                continue;
            seen.add(u);
            out.push(r);
        }
        return out;
    }
    async searchDuckDuckGo(query, limit = 5) {
        if (config.offlineMode || config.disableExternalCalls) {
            return [];
        }
        const cached = this.getCached(query, limit);
        if (cached)
            return cached;
        if (Date.now() - this.lastFailureAt < this.failureBackoffMs)
            return [];
        const results = [];
        try {
            if (!globalThis.fetch)
                return [];
            const resp = await globalThis.fetch(`https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; Universal-AI-Tools/1.0)',
                },
            });
            const html = await resp.text();
            const $ = load(html);
            $('a.result__a').each((i, el) => {
                const title = $(el).text().trim();
                const url = $(el).attr('href') || '';
                const snippet = $(el).parents('.result').find('.result__snippet').text().trim();
                if (title && url)
                    results.push({ title, url, snippet });
            });
            const deduped = this.dedupe(results).slice(0, limit);
            this.setCache(query, limit, deduped);
            return deduped;
        }
        catch {
            this.lastFailureAt = Date.now();
        }
        return results;
    }
    async searchWikipedia(query, limit = 3) {
        if (config.offlineMode || config.disableExternalCalls) {
            return [];
        }
        const cacheKey = `wiki::${this.getCacheKey(query, limit)}`;
        const cached = this.cache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now())
            return cached.results;
        try {
            const api = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&utf8=1&srlimit=${limit}`;
            if (!globalThis.fetch)
                return [];
            const resp = await globalThis.fetch(api, {
                headers: { 'User-Agent': 'Universal-AI-Tools/1.0' },
            });
            const data = await resp.json();
            const results = (data?.query?.search || []).slice(0, limit).map((s) => {
                const title = s.title;
                const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
                const snippet = s.snippet?.replace(/<[^>]+>/g, '') || undefined;
                return { title, url, snippet };
            });
            const deduped = this.dedupe(results);
            this.cache.set(cacheKey, { results: deduped, expiresAt: Date.now() + this.ttlMs });
            return deduped;
        }
        catch {
            this.lastFailureAt = Date.now();
            return [];
        }
    }
}
export const webSearchService = new WebSearchService();
//# sourceMappingURL=web-search-service.js.map