import { logger } from '../../utils/logger';

export interface SearXNGSearchParams {
  q: string;
  category?: string;
  engines?: string;
  lang?: string;
  pageno?: number;
  time_range?: string;
  format?: 'json' | 'html' | 'csv' | 'rss';
  safesearch?: 0 | 1 | 2;
}

export interface SearXNGResult {
  title: string;
  url: string;
  _content string;
  engine: string;
  category: string;
  score: number;
  publishedDate?: string;
  img_src?: string;
  thumbnail?: string;
}

export interface SearXNGResponse {
  query: string;
  number_of_results: number;
  results: SearXNGResult[];
  answers: string[];
  corrections: string[];
  infoboxes: any[];
  suggestions: string[];
  unresponsive_engines: string[];
}

export class SearXNGClient {
  private baseUrl: string;
  private timeout: number;

  constructor(baseUrl = 'http://localhost:8080', timeout = 10000) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.timeout = timeout;
  }

  async search(params: SearXNGSearchParams): Promise<SearXNGResponse> {
    const searchParams = new URLSearchParams();

    // Add query parameters
    searchParams.append('q', params.q);
    searchParams.append('format', params.format || 'json');

    if (params.category) searchParams.append('category', params.category);
    if (params.engines) searchParams.append('engines', params.engines);
    if (params.lang) searchParams.append('lang', params.lang);
    if (params.pageno) searchParams.append('pageno', params.pageno.toString());
    if (params.time_range) searchParams.append('time_range', params.time_range);
    if (params.safesearch !== undefined)
      searchParams.append('safesearch', params.safesearch.toString());

    const url = `${this.baseUrl}/search?${searchParams.toString()}`;

    try {
      logger.info(`🔍 SearXNG search: ${params.q} (engines: ${params.engines || 'all'})`);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Universal-AI-Tools/1.0',
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        throw new Error(`SearXNG API _error ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as SearXNGResponse;

      logger.info(`✅ SearXNG returned ${data.results.length} results`);

      return data;
    } catch (_error) {
      logger.error'❌ SearXNG search failed:', _error;
      throw _error;
    }
  }

  async searchStackOverflow(query: string): Promise<SearXNGResult[]> {
    const response = await this.search({
      q: query,
      engines: 'stackoverflow',
      format: 'json',
    });

    return response.results.sort((a, b) => b.score - a.score);
  }

  async searchGitHub(query: string): Promise<SearXNGResult[]> {
    const response = await this.search({
      q: `${query} is:issue`,
      engines: 'github',
      format: 'json',
    });

    return response.results.sort((a, b) => b.score - a.score);
  }

  async searchDocumentation(query: string, technology: string): Promise<SearXNGResult[]> {
    const docQuery = `${query} ${technology} documentation OR tutorial OR guide`;
    const response = await this.search({
      q: docQuery,
      engines: 'duckduckgo,google',
      format: 'json',
    });

    // Filter for documentation sites
    const docResults = response.results.filter(
      (result) =>
        result.url.includes('docs.') ||
        result.url.includes('documentation') ||
        result.url.includes('developer.mozilla.org') ||
        result.url.includes('nodejs.org') ||
        result.url.includes('npmjs.com')
    );

    return docResults.sort((a, b) => b.score - a.score);
  }

  async searchDevCommunity(query: string): Promise<SearXNGResult[]> {
    const response = await this.search({
      q: query,
      engines: 'reddit',
      format: 'json',
    });

    // Also search dev.to through general engines
    const devToResponse = await this.search({
      q: `${query} site:dev.to`,
      engines: 'duckduckgo',
      format: 'json',
    });

    return [...response.results, ...devToResponse.results].sort((a, b) => b.score - a.score);
  }

  async multiEngineSearch(
    query: string,
    engines: string[] = ['duckduckgo', 'google', 'bing']
  ): Promise<SearXNGResult[]> {
    const response = await this.search({
      q: query,
      engines: engines.join(','),
      format: 'json',
    });

    return response.results.sort((a, b) => b.score - a.score);
  }

  async searchWithTimeRange(query: string, timeRange = 'year'): Promise<SearXNGResult[]> {
    const response = await this.search({
      q: query,
      time_range: timeRange,
      format: 'json',
    });

    return response.results.sort((a, b) => b.score - a.score);
  }

  async getEngineStatus(): Promise<{ [engine: string]: boolean }> {
    try {
      const response = await fetch(`${this.baseUrl}/stats/engines`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(this.timeout),
      });

      if (response.ok) {
        return await response.json();
      }

      return {};
    } catch (_error) {
      logger.warn('Could not fetch engine status:', _error;
      return {};
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/search?q=test&format=json`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      return response.ok;
    } catch (_error) {
      logger.warn('SearXNG health check failed:', _error;
      return false;
    }
  }

  setBaseUrl(url: string): void {
    this.baseUrl = url.replace(/\/$/, '');
  }

  setTimeout(timeout: number): void {
    this.timeout = timeout;
  }
}
