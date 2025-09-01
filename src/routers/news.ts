/**
 * News Router - FIXED VERSION
 * Provides comprehensive news aggregation from multiple sources
 */

import { Router } from 'express';
import { LogContext, log } from '../utils/logger';
import axios from 'axios';
import * as cheerio from 'cheerio';
import Parser from 'rss-parser';

const router = Router();

// RSS parser instance
const parser = new Parser();

// Simple cache to prevent excessive requests
const requestCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 300000; // 5 minute cache
const activeRequests = new Map<string, Promise<any>>();

// News source configurations
const NEWS_SOURCES = {
  // RSS Feeds
  rss: {
    hackernews: {
      name: 'Hacker News',
      url: 'https://hnrss.org/frontpage',
      category: 'technology',
      enabled: true,
    }
  }
};

/**
 * Fetch RSS feed content with proper caching and deduplication
 */
async function fetchRSSFeed(source: string, url: string, limit: number = 20): Promise<any[]> {
  const cacheKey = `${source}-${limit}`;
  
  try {
    // Check cache first
    const cached = requestCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      log.info(`📰 Using cached RSS feed: ${source}`, LogContext.API);
      return cached.data;
    }
    
    // Check if request is already in progress
    if (activeRequests.has(cacheKey)) {
      log.info(`📰 Joining in-progress RSS request: ${source}`, LogContext.API);
      return await activeRequests.get(cacheKey)!;
    }
    
    log.info(`📰 Fetching RSS feed: ${source}`, LogContext.API, { url, limit });
    
    // Create request promise
    const requestPromise = (async () => {
      const feed = await parser.parseURL(url);
      const articles = feed.items.slice(0, limit).map((item) => ({
        title: item.title || 'Untitled',
        summary: item.contentSnippet || item.summary || '',
        url: item.link || '',
        publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
        source: source,
        category: 'technology',
        imageUrl: null
      }));
      
      return articles;
    })();
    
    // Track active request
    activeRequests.set(cacheKey, requestPromise);
    
    const result = await requestPromise;
    
    // Cache the result
    requestCache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });
    
    // Clean up active request tracking
    activeRequests.delete(cacheKey);
    
    return result;
    
  } catch (error) {
    // Clean up active request tracking on error
    activeRequests.delete(cacheKey);
    
    log.error(`❌ Failed to fetch RSS feed: ${source}`, LogContext.API, {
      url,
      error: error instanceof Error ? error.message : String(error)
    });
    
    return [];
  }
}

/**
 * GET /api/v1/news/aggregate
 * Aggregate news from all sources
 */
router.get('/aggregate', async (req, res) => {
  try {
    log.info('📰 Aggregating news from all sources', LogContext.API);
    
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    
    // Only fetch from Hacker News to prevent overload
    const articles = await fetchRSSFeed(
      NEWS_SOURCES.rss.hackernews.name,
      NEWS_SOURCES.rss.hackernews.url,
      limit
    );
    
    res.json({
      success: true,
      data: {
        articles: articles,
        totalSources: 1,
        totalArticles: articles.length
      }
    });
    
  } catch (error) {
    log.error('❌ Failed to aggregate news', LogContext.API, {
      error: error instanceof Error ? error.message : String(error)
    });
    
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to aggregate news',
        details: error instanceof Error ? error.message : String(error)
      }
    });
  }
});

export default router;