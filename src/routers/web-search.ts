/**
 * Web Search Router
 * Provides comprehensive web search capabilities with multiple providers
 * Includes search engines, content scraping, and result aggregation
 */

import { Router } from 'express';
import { LogContext, log } from '../utils/logger';
import axios from 'axios';
import * as cheerio from 'cheerio';

// Circuit breaker options interface
interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeout: number;
  healthRequests: number;
}

// Simple circuit breaker implementation
class CircuitBreaker {
  private failures = 0;
  private lastFailTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private successCount = 0;
  private totalRequests = 0;

  constructor(
    private name: string,
    private options: CircuitBreakerOptions
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    this.totalRequests++;

    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailTime > this.options.resetTimeout) {
        this.state = 'HALF_OPEN';
        this.successCount = 0;
      } else {
        throw new Error(`Circuit breaker is OPEN for ${this.name}`);
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  getState(): 'CLOSED' | 'OPEN' | 'HALF_OPEN' {
    return this.state;
  }

  getMetrics() {
    return {
      failures: this.failures,
      successCount: this.successCount,
      totalRequests: this.totalRequests,
      lastFailTime: this.lastFailTime,
      successRate: this.totalRequests > 0 ? (this.successCount / this.totalRequests) * 100 : 0,
      failureRate: this.totalRequests > 0 ? (this.failures / this.totalRequests) * 100 : 0,
    };
  }

  private onSuccess() {
    this.successCount++;
    this.failures = 0;
    this.state = 'CLOSED';
  }

  private onFailure() {
    this.failures++;
    this.lastFailTime = Date.now();
    if (this.failures >= this.options.failureThreshold) {
      this.state = 'OPEN';
    }
  }
}

const router = Router();

// Search providers configuration
const SEARCH_PROVIDERS = {
  duckduckgo: {
    name: 'DuckDuckGo',
    url: 'https://html.duckduckgo.com/html/',
    enabled: true,
    priority: 1,
  },
  bing: {
    name: 'Bing',
    url: 'https://www.bing.com/search',
    enabled: true,
    priority: 2,
    requiresKey: false,
  },
  google: {
    name: 'Google Custom Search',
    url: 'https://www.googleapis.com/customsearch/v1',
    enabled: false, // Requires API key
    priority: 3,
    requiresKey: true,
  },
} as const;

// Circuit breakers for each provider
const circuitBreakers = new Map<string, CircuitBreaker>();

// Initialize circuit breakers
Object.keys(SEARCH_PROVIDERS).forEach((provider) => {
  circuitBreakers.set(provider, new CircuitBreaker(provider, {
    failureThreshold: 5,
    resetTimeout: 30000,
    healthRequests: 2,
  }));
});

// Rate limiting for search requests
const searchRateLimit = new Map<string, number>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS_PER_MINUTE = 30;

/**
 * Rate limiting middleware
 */
function rateLimitMiddleware(req: any, res: any, next: any): void {
  const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  const windowStart = Math.floor(now / RATE_LIMIT_WINDOW) * RATE_LIMIT_WINDOW;
  
  const key = `${clientIp}:${windowStart}`;
  const requests = searchRateLimit.get(key) || 0;
  
  if (requests >= MAX_REQUESTS_PER_MINUTE) {
    return res.status(429).json({
      success: false,
      error: 'Rate limit exceeded. Please try again later.',
      retryAfter: Math.ceil((windowStart + RATE_LIMIT_WINDOW - now) / 1000),
    });
  }
  
  searchRateLimit.set(key, requests + 1);
  
  // Clean up old entries
  for (const entry of searchRateLimit.entries()) {
    const [k] = entry;
    const keyTimePart = k.split(':')[1];
    if (!keyTimePart) continue;
    const keyTime = parseInt(keyTimePart);
    if (keyTime < windowStart - RATE_LIMIT_WINDOW) {
      searchRateLimit.delete(k);
    }
  }
  
  next();
}

/**
 * Search with DuckDuckGo
 */
async function searchDuckDuckGo(query: string, limit: number = 10): Promise<any[]> {
  const response = await axios.post(SEARCH_PROVIDERS.duckduckgo.url, 
    new URLSearchParams({
      q: query,
      df: '',
      kl: 'us-en',
      kd: '-1',
      kf: '-1',
      kt: 'h',
      kav: '1',
      k5: '1',
      ka: 'g',
      ko: '1',
      kq: '-1',
      kv: '1',
      o: 'json',
    }), {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate',
      'DNT': '1',
      'Connection': 'keep-alive',
    },
    timeout: 10000,
  });

  const $ = cheerio.load(response.data);
  const results: any[] = [];

  $('.web-result').each((i, element) => {
    if (results.length >= limit) return false;
    
    const titleEl = $(element).find('h2 a');
    const snippetEl = $(element).find('.result__snippet');
    const urlEl = $(element).find('.result__url');
    
    const title = titleEl.text().trim();
    const snippet = snippetEl.text().trim();
    const url = titleEl.attr('href') || '';
    
    if (title && url) {
      results.push({
        title,
        url,
        snippet,
        provider: 'duckduckgo',
      });
    }
    
    return true;
  });

  return results;
}

/**
 * Search with Bing (screen scraping)
 */
async function searchBing(query: string, limit: number = 10): Promise<any[]> {
  const response = await axios.get(SEARCH_PROVIDERS.bing.url, {
    params: {
      q: query,
      count: limit,
      offset: 0,
      mkt: 'en-US',
      safesearch: 'moderate',
    },
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    timeout: 10000,
  });

  const $ = cheerio.load(response.data);
  const results: any[] = [];

  $('#b_results .b_algo').each((i, element) => {
    if (results.length >= limit) return false;
    
    const titleEl = $(element).find('h2 a');
    const snippetEl = $(element).find('.b_caption p');
    
    const title = titleEl.text().trim();
    const snippet = snippetEl.text().trim();
    const url = titleEl.attr('href') || '';
    
    if (title && url) {
      results.push({
        title,
        url,
        snippet,
        provider: 'bing',
      });
    }
    
    return true;
  });

  return results;
}

/**
 * Perform search across multiple providers
 */
async function performSearch(query: string, providers: string[] = ['duckduckgo'], limit: number = 10): Promise<{
  results: any[];
  metadata: any;
}> {
  const startTime = Date.now();
  const allResults: any[] = [];
  const providerResults: Record<string, any> = {};
  const errors: Record<string, string> = {};

  // Search each provider in parallel
  const searchPromises = providers.map(async (provider) => {
    const breaker = circuitBreakers.get(provider);
    if (!breaker) return;

    try {
      let results: any[] = [];
      
      await breaker.execute(async () => {
        switch (provider) {
          case 'duckduckgo':
            results = await searchDuckDuckGo(query, limit);
            break;
          case 'bing':
            results = await searchBing(query, limit);
            break;
          default:
            throw new Error(`Unknown provider: ${provider}`);
        }
      });

      providerResults[provider] = {
        count: results.length,
        results: results,
        status: 'success',
      };
      
      allResults.push(...results);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors[provider] = errorMessage;
      providerResults[provider] = {
        count: 0,
        results: [],
        status: 'error',
        error: errorMessage,
      };
      
      log.warn(`Search provider ${provider} failed`, LogContext.API, {
        query: query.substring(0, 50),
        error: errorMessage,
      });
    }
  });

  await Promise.all(searchPromises);

  // Remove duplicates based on URL
  const uniqueResults = allResults.filter((result, index, arr) => 
    arr.findIndex(r => r.url === result.url) === index
  );

  // Sort by provider priority and relevance
  uniqueResults.sort((a, b) => {
    const priorityA = SEARCH_PROVIDERS[a.provider as keyof typeof SEARCH_PROVIDERS]?.priority || 999;
    const priorityB = SEARCH_PROVIDERS[b.provider as keyof typeof SEARCH_PROVIDERS]?.priority || 999;
    return priorityA - priorityB;
  });

  const executionTime = Date.now() - startTime;

  return {
    results: uniqueResults.slice(0, limit),
    metadata: {
      query,
      totalResults: uniqueResults.length,
      providersUsed: providers,
      providerResults,
      errors,
      executionTime,
      deduplicatedResults: allResults.length - uniqueResults.length,
    },
  };
}

/**
 * Basic web search endpoint
 */
router.get('/search', rateLimitMiddleware, async (req, res): Promise<any> => {
  try {
    const { 
      q: query, 
      limit = 10, 
      providers = 'duckduckgo,bing',
      safe = 'moderate'
    } = req.query;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Query parameter (q) is required',
        example: '/api/v1/search?q=artificial intelligence&limit=10',
      });
    }

    const searchLimit = Math.min(Math.max(parseInt(limit as string) || 10, 1), 50);
    const providerList = (providers as string).split(',').map(p => p.trim()).filter(Boolean);

    // Validate providers
    const validProviders = providerList.filter(p => 
      Object.keys(SEARCH_PROVIDERS).includes(p) && 
      SEARCH_PROVIDERS[p as keyof typeof SEARCH_PROVIDERS].enabled
    );

    if (validProviders.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid providers specified',
        availableProviders: Object.keys(SEARCH_PROVIDERS).filter(p => 
          SEARCH_PROVIDERS[p as keyof typeof SEARCH_PROVIDERS].enabled
        ),
      });
    }

    log.info('🔍 Performing web search', LogContext.API, {
      query: query.substring(0, 50),
      providers: validProviders,
      limit: searchLimit,
    });

    const searchResult = await performSearch(query, validProviders, searchLimit);

    res.json({
      success: true,
      data: {
        results: searchResult.results,
        pagination: {
          total: searchResult.metadata.totalResults,
          limit: searchLimit,
          hasMore: searchResult.metadata.totalResults > searchLimit,
        },
        metadata: {
          ...searchResult.metadata,
          timestamp: new Date().toISOString(),
          safe,
        },
      },
    });

    log.info('✅ Web search completed', LogContext.API, {
      query: query.substring(0, 50),
      resultsFound: searchResult.results.length,
      executionTime: `${searchResult.metadata.executionTime}ms`,
      providersUsed: validProviders.length,
    });

  } catch (error) {
    log.error('❌ Web search failed', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
      query: req.query.q,
    });

    res.status(500).json({
      success: false,
      error: 'Web search failed',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Advanced search with filters
 */
router.post('/search/advanced', rateLimitMiddleware, async (req, res): Promise<any> => {
  try {
    const {
      query,
      filters = {},
      limit = 10,
      providers = ['duckduckgo'],
      options = {},
    } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Query is required',
      });
    }

    // Apply filters to search query
    let processedQuery = query;
    
    if (filters.site) {
      processedQuery += ` site:${filters.site}`;
    }
    
    if (filters.filetype) {
      processedQuery += ` filetype:${filters.filetype}`;
    }
    
    if (filters.dateRange) {
      // Add date filtering if supported by provider
      processedQuery += ` ${filters.dateRange}`;
    }

    const searchResult = await performSearch(processedQuery, providers, limit);

    res.json({
      success: true,
      data: {
        results: searchResult.results,
        filters,
        options,
        metadata: {
          ...searchResult.metadata,
          originalQuery: query,
          processedQuery,
          timestamp: new Date().toISOString(),
        },
      },
    });

  } catch (error) {
    log.error('❌ Advanced web search failed', LogContext.API, { error });
    res.status(500).json({
      success: false,
      error: 'Advanced web search failed',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Search suggestions/autocomplete
 */
router.get('/suggest', rateLimitMiddleware, async (req, res): Promise<any> => {
  try {
    const { q: query } = req.query;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Query parameter (q) is required',
      });
    }

    // Mock suggestions for now - in a real implementation, this would
    // call suggestion APIs from search providers
    const suggestions = [
      `${query} tutorial`,
      `${query} example`,
      `${query} best practices`,
      `${query} documentation`,
      `${query} guide`,
    ].slice(0, 5);

    res.json({
      success: true,
      data: {
        query,
        suggestions,
        metadata: {
          timestamp: new Date().toISOString(),
        },
      },
    });

  } catch (error) {
    log.error('❌ Search suggestions failed', LogContext.API, { error });
    res.status(500).json({
      success: false,
      error: 'Search suggestions failed',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Extract content from a URL
 */
router.post('/extract', rateLimitMiddleware, async (req, res): Promise<any> => {
  try {
    const { url, options = {} } = req.body;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'URL is required',
      });
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      return res.status(400).json({
        success: false,
        error: 'Invalid URL format',
      });
    }

    log.info('📄 Extracting content from URL', LogContext.API, {
      url: url.substring(0, 100),
    });

    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
      timeout: 15000,
      maxContentLength: 10 * 1024 * 1024, // 10MB limit
    });

    const $ = cheerio.load(response.data);

    // Extract metadata and content
    const title = $('title').text().trim() || 
                  $('meta[property="og:title"]').attr('content') || 
                  $('h1').first().text().trim();

    const description = $('meta[name="description"]').attr('content') || 
                       $('meta[property="og:description"]').attr('content') || '';

    // Extract main content (try to find article or main content area)
    let content = '';
    const contentSelectors = [
      'article',
      'main',
      '.content',
      '.post-content',
      '.article-content',
      '#content',
      '.main-content',
    ];

    for (const selector of contentSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        content = element.text().trim();
        break;
      }
    }

    // Fallback to body content if no specific content area found
    if (!content) {
      // Remove script, style, and navigation elements
      $('script, style, nav, header, footer, aside').remove();
      content = $('body').text().trim();
    }

    // Clean up content
    content = content.replace(/\s+/g, ' ').trim();

    const wordCount = content.split(/\s+/).length;

    res.json({
      success: true,
      data: {
        url,
        title,
        description,
        content: options.maxLength ? content.substring(0, options.maxLength) : content,
        metadata: {
          contentLength: content.length,
          wordCount,
          extractedAt: new Date().toISOString(),
          contentType: response.headers['content-type'] || '',
        },
      },
    });

  } catch (error) {
    log.error('❌ Content extraction failed', LogContext.API, {
      url: req.body?.url,
      error: error instanceof Error ? error.message : String(error),
    });

    res.status(500).json({
      success: false,
      error: 'Content extraction failed',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Get search provider status
 */
router.get('/providers', (req, res): any => {
  const providerStatus = Object.entries(SEARCH_PROVIDERS).map(([key, config]) => {
    const breaker = circuitBreakers.get(key);
    return {
      name: key,
      displayName: config.name,
      enabled: config.enabled,
      priority: config.priority,
      requiresApiKey: ('requiresKey' in config) ? config.requiresKey : false,
      circuitBreaker: breaker ? {
        state: breaker.getState(),
        metrics: breaker.getMetrics(),
      } : null,
    };
  });

  res.json({
    success: true,
    data: {
      providers: providerStatus,
      metadata: {
        timestamp: new Date().toISOString(),
        rateLimiting: {
          windowMs: RATE_LIMIT_WINDOW,
          maxRequests: MAX_REQUESTS_PER_MINUTE,
        },
      },
    },
  });
});

/**
 * Health check endpoint
 */
router.get('/health', async (req, res): Promise<any> => {
  const healthChecks = await Promise.allSettled(
    Object.keys(SEARCH_PROVIDERS)
      .filter(provider => SEARCH_PROVIDERS[provider as keyof typeof SEARCH_PROVIDERS].enabled)
      .map(async (provider) => {
        try {
          // Perform a simple test search
          await performSearch('test', [provider], 1);
          return { provider, status: 'healthy' };
        } catch (error) {
          return { 
            provider, 
            status: 'unhealthy', 
            error: error instanceof Error ? error.message : String(error) 
          };
        }
      })
  );

  const results = healthChecks.map(result => 
    result.status === 'fulfilled' ? result.value : result.reason
  );

  const healthyCount = results.filter(r => r.status === 'healthy').length;
  const overallHealth = healthyCount > 0 ? 'healthy' : 'unhealthy';

  res.status(overallHealth === 'healthy' ? 200 : 503).json({
    success: true,
    status: overallHealth,
    data: {
      providers: results,
      summary: {
        total: results.length,
        healthy: healthyCount,
        unhealthy: results.length - healthyCount,
      },
      timestamp: new Date().toISOString(),
    },
  });
});

export default router;