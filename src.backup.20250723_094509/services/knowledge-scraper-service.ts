/**
 * Knowledge Scraper Service
 * Collects and processes knowledge from various external sources
 */

import type { Browser, Page } from 'playwright';
import { chromium } from 'playwright';
import Parser from 'rss-parser';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { createHash } from 'crypto';
import { logger } from '../utils/logger';
import { supabase } from './supabase_service';
import type { KnowledgeSource } from '../config/knowledge-sources';
import { KNOWLEDGE_SOURCES } from '../config/knowledge-sources';
import { RateLimiter } from 'limiter';
import * as cron from 'node-cron';

interface ScrapedContent {
  sourceId: string;
  url: string;
  title: string;
  content string;
  contentHash: string;
  metadata: Record<string, unknown>;
  categories: string[];
  scrapedAt: Date;
  quality?: number;
}

export class KnowledgeScraperService {
  private browser: Browser | null = null;
  private rssParser: Parser;
  private rateLimiters: Map<string, RateLimiter> = new Map();
  private scheduledJobs: Map<string, cron.ScheduledTask> = new Map();

  constructor() {
    this.rssParser = new Parser();
    this.initializeRateLimiters();
  }

  async initialize(): Promise<void> {
    try {
      // Initialize browser for scraping
      this.browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      // Schedule scraping jobs
      await this.scheduleScrapingJobs();

      logger.info('Knowledge scraper service initialized');
    } catch (error) {
      logger.error('Failed to initialize knowledge scraper', error);
      throw error;
    }
  }

  private initializeRateLimiters(): void {
    KNOWLEDGE_SOURCES.forEach((source) => {
      const rateLimit = source.scrapeConfig?.rateLimit || 60;
      this.rateLimiters.set(
        source.id,
        new RateLimiter({ tokensPerInterval: rateLimit, interval: 'minute' })
      );
    });
  }

  private async scheduleScrapingJobs(): Promise<void> {
    for (const source of KNOWLEDGE_SOURCES) {
      if (!source.enabled) continue;

      const job = cron.schedule(source.updateFrequency, async () => {
        try {
          await this.scrapeSource(source);
        } catch (error) {
          logger.error(Failed to scrape source ${source.id}`, error);
        }
      });

      this.scheduledJobs.set(source.id, job);
      job.start();
    }
  }

  async scrapeSource(source: KnowledgeSource): Promise<ScrapedContent[]> {
    const rateLimiter = this.rateLimiters.get(source.id);
    if (rateLimiter) {
      await rateLimiter.removeTokens(1);
    }

    logger.info(`Scraping source: ${source.name}`);

    switch (source.type) {
      case 'scraper':
        return this.scrapeWebsite(source);
      case 'rss':
        return this.scrapeRSSFeed(source);
      case 'api':
        return this.scrapeAPI(source);
      case 'github':
        return this.scrapeGitHub(source);
      case 'forum':
        return this.scrapeForum(source);
      default:
        throw new Error(`Unknown source type: ${source.type}`);
    }
  }

  private async scrapeWebsite(source: KnowledgeSource): Promise<ScrapedContent[]> {
    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    const contents: ScrapedContent[] = [];
    const page = await this.browser.newPage();

    try {
      await page.goto(source.url, { waitUntil: 'networkidle' });

      // Extract main content
      const content= await this.extractPageContent(page, source);
      if (content {
        contents.push(content;
      }

      // Handle pagination if enabled
      if (source.scrapeConfig?.paginate) {
        const links = await this.extractDocumentationLinks(page, source);
        const pageLimiter = this.rateLimiters.get(source.id);

        for (const link of links.slice(0, 50)) {
          // Limit to 50 pages per run
          if (pageLimiter) {
            await pageLimiter.removeTokens(1);
          }

          try {
            await page.goto(link, { waitUntil: 'networkidle' });
            const pageContent = await this.extractPageContent(page, source);
            if (pageContent) {
              contents.push(pageContent);
            }
          } catch (error) {
            logger.error(Failed to scrape page: ${link}`, error);
          }
        }
      }
    } finally {
      await page.close();
    }

    // Store scraped content
    await this.storeScrapedContent(contents);
    return contents;
  }

  private async extractPageContent(
    page: Page,
    source: KnowledgeSource
  ): Promise<ScrapedContent | null> {
    const selectors = source.scrapeConfig?.selectors || {};

    try {
      const title = (await page.textContent(selectors.title || 'h1')) || 'Untitled';
      const content= (await page.textContent(selectors.content|| 'body')) || '';

      // Extract code blocks
      const codeBlocks: string[] = [];
      if (selectors.codeBlocks) {
        const elements = await page.$$(selectors.codeBlocks);
        for (const element of elements) {
          const code = await element.textContent();
          if (code) codeBlocks.push(code);
        }
      }

      // Extract last updated date if available
      let lastUpdated: Date | null = null;
      if (selectors.lastUpdated) {
        const dateText = await page.textContent(selectors.lastUpdated);
        if (dateText) {
          lastUpdated = new Date(dateText);
        }
      }

      const url = page.url();
      const contentHash = this.hashContent(content;

      return {
        sourceId: source.id,
        url,
        title,
        content
        contentHash,
        metadata: {
          codeBlocks,
          lastUpdated,
          wordCount: contentsplit(/\s+/).length,
          hasCodeExamples: codeBlocks.length > 0,
        },
        categories: source.categories,
        scrapedAt: new Date(),
      };
    } catch (error) {
      logger.error(Failed to extract contentfrom ${page.url()}`, error);
      return null;
    }
  }

  private async extractDocumentationLinks(page: Page, source: KnowledgeSource): Promise<string[]> {
    const links = await page.$$eval(
      'a[href]',
      (elements) =>
        elements.map((el) => el.getAttribute('href')).filter((href) => href !== null) as string[]
    );

    const baseUrl = new URL(source.url);
    return links
      .map((link) => {
        try {
          return new URL(link, baseUrl).href;
        } catch {
          return null;
        }
      })
      .filter(
        (link): link is string =>
          link !== null &&
          link.startsWith(baseUrl.origin) &&
          !link.includes('#') &&
          !link.endsWith('.pdf')
      );
  }

  private async scrapeRSSFeed(source: KnowledgeSource): Promise<ScrapedContent[]> {
    try {
      const feed = await this.rssParser.parseURL(source.url);
      const contents: ScrapedContent[] = [];

      for (const item of feed.items || []) {
        const contentHash = this.hashContent(item.content|| item.description || '');

        contents.push({
          sourceId: source.id,
          url: item.link || source.url,
          title: item.title || 'Untitled',
          content item.content|| item.description || '',
          contentHash,
          metadata: {
            author: item.creator,
            publishedDate: item.pubDate ? new Date(item.pubDate) : null,
            categories: item.categories || [],
          },
          categories: source.categories,
          scrapedAt: new Date(),
        });
      }

      await this.storeScrapedContent(contents);
      return contents;
    } catch (error) {
      logger.error(Failed to scrape RSS feed: ${source.url}`, error);
      return [];
    }
  }

  private async scrapeAPI(source: KnowledgeSource): Promise<ScrapedContent[]> {
    try {
      const headers: Record<string, string> = {};

      if (source.authentication) {
        switch (source.authentication.type) {
          case 'api_key':
            headers['Authorization'] = `Bearer ${source.authentication.credentials.token}`;
            break;
          case 'basic':
            const auth = Buffer.from(
              `${source.authentication.credentials.username}:${source.authentication.credentials.password}`
            ).toString('base64');
            headers['Authorization'] = `Basic ${auth}`;
            break;
        }
      }

      const response = await axios.get(source.url, {
        headers,
        params: source.authentication?.credentials.query
          ? { q: source.authentication.credentials.query }
          : {},
      });

      const contents: ScrapedContent[] = [];

      // Handle different API response formats
      if (source.id === 'arxiv-ai') {
        contents.push(...this.parseArxivResponse(response.data, source));
      } else if (source.id === 'github-trending') {
        contents.push(...this.parseGitHubResponse(response.data, source));
      } else if (source.id === 'stackoverflow-ai') {
        contents.push(...this.parseStackOverflowResponse(response.data, source));
      } else if (source.id === 'huggingface-models') {
        contents.push(...this.parseHuggingFaceResponse(response.data, source));
      }

      await this.storeScrapedContent(contents);
      return contents;
    } catch (error) {
      logger.error(Failed to scrape API: ${source.url}`, error);
      return [];
    }
  }

  private parseArxivResponse(data: any, source: KnowledgeSource): ScrapedContent[] {
    const $ = cheerio.load(data, { xmlMode: true });
    const contents: ScrapedContent[] = [];

    $('entry').each((_, entry) => {
      const $entry = $(entry);
      const title = $entry.find('title').text();
      const summary = $entry.find('summary').text();
      const authors = $entry
        .find('author name')
        .map((_, el) => $(el).text())
        .get();
      const url = $entry.find('id').text();
      const published = new Date($entry.find('published').text());

      contents.push({
        sourceId: source.id,
        url,
        title,
        content summary,
        contentHash: this.hashContent(summary),
        metadata: {
          authors,
          published,
          categories: $entry
            .find('category')
            .map((_, el) => $(el).attr('term'))
            .get(),
        },
        categories: source.categories,
        scrapedAt: new Date(),
      });
    });

    return contents;
  }

  private parseGitHubResponse(data: any, source: KnowledgeSource): ScrapedContent[] {
    const contents: ScrapedContent[] = [];

    for (const repo of data.items || []) {
      contents.push({
        sourceId: source.id,
        url: repo.html_url,
        title: repo.full_name,
        content repo.description || '',
        contentHash: this.hashContent(repo.description || ''),
        metadata: {
          stars: repo.stargazers_count,
          language: repo.language,
          topics: repo.topics || [],
          lastUpdated: new Date(repo.updated_at),
        },
        categories: source.categories,
        scrapedAt: new Date(),
      });
    }

    return contents;
  }

  private parseStackOverflowResponse(data: any, source: KnowledgeSource): ScrapedContent[] {
    const contents: ScrapedContent[] = [];

    for (const question of data.items || []) {
      contents.push({
        sourceId: source.id,
        url: question.link,
        title: question.title,
        content question.body || '',
        contentHash: this.hashContent(question.body || ''),
        metadata: {
          tags: question.tags,
          score: question.score,
          answerCount: question.answer_count,
          viewCount: question.view_count,
          isAnswered: question.is_answered,
        },
        categories: source.categories,
        scrapedAt: new Date(),
      });
    }

    return contents;
  }

  private parseHuggingFaceResponse(data: any[], source: KnowledgeSource): ScrapedContent[] {
    const contents: ScrapedContent[] = [];

    for (const model of data.slice(0, 50)) {
      // Limit to top 50 models
      contents.push({
        sourceId: source.id,
        url: `https://huggingface.co/${model.id}`,
        title: model.id,
        content model.description || '',
        contentHash: this.hashContent(model.description || ''),
        metadata: {
          likes: model.likes,
          downloads: model.downloads,
          tags: model.tags,
          library: model.library_name,
          pipeline: model.pipeline_tag,
        },
        categories: source.categories,
        scrapedAt: new Date(),
      });
    }

    return contents;
  }

  private async scrapeGitHub(source: KnowledgeSource): Promise<ScrapedContent[]> {
    // GitHub scraping is handled by the API method
    return this.scrapeAPI(source);
  }

  private async scrapeForum(source: KnowledgeSource): Promise<ScrapedContent[]> {
    // Forum scraping would be implemented based on specific forum APIs
    // For now, treat Reddit as an API source
    if (source.id === 'reddit-ai') {
      const response = await axios.get(source.url);
      const contents: ScrapedContent[] = [];

      for (const post of response.data.data.children || []) {
        const { data } = post;
        contents.push({
          sourceId: source.id,
          url: `https://reddit.com${data.permalink}`,
          title: data.title,
          content data.selftext || data.url,
          contentHash: this.hashContent(data.selftext || data.url),
          metadata: {
            author: data.author,
            score: data.score,
            subreddit: data.subreddit,
            commentCount: data.num_comments,
            created: new Date(data.created_utc * 1000),
          },
          categories: source.categories,
          scrapedAt: new Date(),
        });
      }

      await this.storeScrapedContent(contents);
      return contents;
    }

    return [];
  }

  private async storeScrapedContent(contents: ScrapedContent[]): Promise<void> {
    if (contents.length === 0) return;

    try {
      // Check for existing contentby hash to avoid duplicates
      const hashes = contents.map((c) => c.contentHash);
      const { data: existing } = await supabase
        .from('scraped_knowledge')
        .select('content_hash')
        .in('content_hash', hashes);

      const existingHashes = new Set(existing?.map((e) => e.content_hash) || []);
      const newContents = contents.filter((c) => !existingHashes.has(c.contentHash));

      if (newContents.length > 0) {
        const { error} = await supabase.from('scraped_knowledge').insert(
          newContents.map((content => ({
            source_id: contentsourceId,
            url: contenturl,
            title: contenttitle,
            content contentcontent
            content_hash: contentcontentHash,
            metadata: contentmetadata,
            categories: contentcategories,
            scraped_at: contentscrapedAt,
            quality_score: contentquality,
          }))
        );

        if (_error {
          logger.error('Failed to store scraped content, error);
        } else {
          logger.info(`Stored ${newContents.length} new knowledge items`);
        }
      }
    } catch (error) {
      logger.error('Error storing scraped content, error);
    }
  }

  private hashContent(content string): string {
    return createHash('sha256').update(content.digest('hex');
  }

  async shutdown(): Promise<void> {
    // Stop all scheduled jobs
    this.scheduledJobs.forEach((job) => job.stop());
    this.scheduledJobs.clear();

    // Close browser
    if (this.browser) {
      await this.browser.close();
    }
  }
}

// Lazy initialization to prevent blocking during import
let _knowledgeScraperService: KnowledgeScraperService | null = null;

export function getKnowledgeScraperService(): KnowledgeScraperService {
  if (!_knowledgeScraperService) {
    _knowledgeScraperService = new KnowledgeScraperService();
  }
  return _knowledgeScraperService;
}

// For backward compatibility
export const knowledgeScraperService = new Proxy({} as KnowledgeScraperService, {
  get(target, prop) {
    return getKnowledgeScraperService()[prop as keyof KnowledgeScraperService];
  },
});
