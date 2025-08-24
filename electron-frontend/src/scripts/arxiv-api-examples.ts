/**
 * ArXiv API Usage Examples
 * Demonstrates proper methods for accessing ArXiv papers programmatically
 */

import fetch from 'node-fetch';
import * as xml2js from 'xml2js';
import { createClient } from '@supabase/supabase-js';

import Logger from '../renderer/utils/logger';
// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseKey =
  process.env.SUPABASE_SERVICE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * ArXiv API client with rate limiting and proper etiquette
 */
class ArXivAPIClient {
  private baseUrl = 'http://export.arxiv.org/api/query';
  private lastRequestTime = 0;
  private minRequestInterval = 3000; // 3 seconds between requests

  /**
   * Search ArXiv for papers matching a query
   */
  async searchPapers(
    query: string,
    maxResults: number = 10,
    sortBy: 'relevance' | 'lastUpdatedDate' | 'submittedDate' = 'submittedDate'
  ): Promise<any[]> {
    // Enforce rate limiting
    await this.enforceRateLimit();

    const params = new URLSearchParams({
      search_query: query,
      start: '0',
      max_results: maxResults.toString(),
      sortBy: sortBy,
      sortOrder: 'descending',
    });

    try {
      const response = await fetch(`${this.baseUrl}?${params}`, {
        headers: {
          'User-Agent': 'UniversalAITools/1.0 (contact@example.com)',
        },
      });

      if (!response.ok) {
        throw new Error(`ArXiv API _error: ${response.status}`);
      }

      const xmlText = await response.text();
      return await this.parseArXivXML(xmlText);
    } catch (_error) {
      if (process.env.NODE_ENV === 'development') {
        Logger.error('ArXiv API _error:', _error);
      }
      throw _error;
    }
  }

  /**
   * Get papers by category
   */
  async getPapersByCategory(category: string, maxResults: number = 20): Promise<any[]> {
    const query = `cat:${category}`;
    return this.searchPapers(query, maxResults);
  }

  /**
   * Get papers by author
   */
  async getPapersByAuthor(authorName: string, maxResults: number = 10): Promise<any[]> {
    const query = `au:${authorName}`;
    return this.searchPapers(query, maxResults);
  }

  /**
   * Get AI/ML papers from last 30 days
   */
  async getRecentAIPapers(days: number = 30): Promise<any[]> {
    const date = new Date();
    date.setDate(date.getDate() - days);
    const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');

    const query = `(cat:cs.AI OR cat:cs.LG OR cat:cs.CL) AND submittedDate:[${dateStr} TO *]`;
    return this.searchPapers(query, 50, 'submittedDate');
  }

  /**
   * Parse ArXiv XML response
   */
  private async parseArXivXML(xmlText: string): Promise<any[]> {
    const parser = new xml2js.Parser({ explicitArray: false });
    const result = await parser.parseStringPromise(xmlText);

    if (!result.feed || !result.feed.entry) {
      return [];
    }

    const entries = Array.isArray(result.feed.entry) ? result.feed.entry : [result.feed.entry];

    return entries.map(entry => ({
      id: entry.id,
      title: entry.title?.replace(/\s+/g, ' ').trim(),
      summary: entry.summary?.replace(/\s+/g, ' ').trim(),
      authors: this.extractAuthors(entry.author),
      published: entry.published,
      updated: entry.updated,
      category: entry['arxiv:primary_category']?.$.term,
      link: entry.link?.find((l: unknown) => l.$.type === 'text/html')?.$.href || entry.id,
      pdfLink: entry.link?.find((l: unknown) => l.$.title === 'pdf')?.$.href,
    }));
  }

  /**
   * Extract author names from entry
   */
  private extractAuthors(author: unknown): string[] {
    if (!author) return [];
    const authors = Array.isArray(author) ? author : [author];
    return authors.map(a => a.name || '').filter(Boolean);
  }

  /**
   * Enforce rate limiting
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.minRequestInterval) {
      const waitTime = this.minRequestInterval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }
}

/**
 * Example usage scenarios
 */
async function demonstrateArXivAPI() {
  const client = new ArXivAPIClient();

  if (process.env.NODE_ENV === 'development') {
    Logger.debug('🔍 ArXiv API Usage Examples');
  }
  Logger.debug('============================\n');

  try {
    // Example 1: Search for transformer papers
    Logger.debug('1. Searching for recent transformer papers...');
    const transformerPapers = await client.searchPapers('all:transformer', 5);
    Logger.debug(`Found ${transformerPapers.length} papers:`);
    transformerPapers.forEach(paper => {
      Logger.debug(`  - ${paper.title}`);
      Logger.debug(`    Authors: ${paper.authors.join(', ')}`);
      Logger.debug(`    Category: ${paper.category}`);
      Logger.debug(`    Link: ${paper.link}\n`);
    });

    // Example 2: Get papers from AI category
    Logger.debug('2. Getting recent CS.AI papers...');
    const aiPapers = await client.getPapersByCategory('cs.AI', 5);
    Logger.debug(`Found ${aiPapers.length} AI papers:`);
    aiPapers.forEach(paper => {
      Logger.debug(`  - ${paper.title.substring(0, 80)}...`);
    });
    Logger.debug();

    // Example 3: Search by author
    Logger.debug('3. Searching for papers by Yoshua Bengio...');
    const bengioPapers = await client.getPapersByAuthor('Bengio', 3);
    Logger.debug(`Found ${bengioPapers.length} papers by Bengio:`);
    bengioPapers.forEach(paper => {
      Logger.debug(`  - ${paper.title}`);
      Logger.debug(`    Published: ${new Date(paper.published).toLocaleDateString()}`);
    });
    Logger.debug();

    // Example 4: Get recent AI papers (last 7 days)
    Logger.debug('4. Getting AI papers from last 7 days...');
    const recentPapers = await client.getRecentAIPapers(7);
    Logger.debug(`Found ${recentPapers.length} recent AI papers`);

    // Store sample data in Supabase
    if (transformerPapers.length > 0) {
      Logger.debug('\n📥 Storing sample papers in Supabase...');

      const { data, _error } = await supabase.from('context_storage').insert({
        category: 'code_patterns',
        source: 'arxiv-api-sample',
        content: JSON.stringify({
          title: 'ArXiv Paper Sample Collection',
          papers: transformerPapers.slice(0, 3),
          totalAvailable: '2.4+ million papers',
          apiUsed: true,
          timestamp: new Date().toISOString(),
        }),
        metadata: {
          type: 'arxiv_papers',
          count: transformerPapers.length,
          query: 'transformer',
          api_compliant: true,
        },
        user_id: 'system',
      });

      if (_error) {
        Logger.error('Error storing papers:', _error);
      } else {
        Logger.debug('✅ Sample papers stored successfully!');
      }
    }
  } catch (_error) {
    Logger.error('Error demonstrating API:', _error);
  }
}

/**
 * Alternative: Use ArXiv bulk data access
 */
function demonstrateBulkDataAccess() {
  Logger.debug('\n📚 Alternative: ArXiv Bulk Data Access');
  Logger.debug('=====================================\n');

  Logger.debug('For comprehensive ArXiv data access, consider these options:\n');

  Logger.debug('1. ArXiv Dataset on Kaggle');
  Logger.debug('   - URL: https://www.kaggle.com/Cornell-University/arxiv');
  Logger.debug('   - Size: 3.5GB compressed JSON');
  Logger.debug('   - Content: Metadata for all 2.4M+ papers');
  Logger.debug('   - Updated: Regularly by Cornell University\n');

  Logger.debug('2. ArXiv Bulk Data via Amazon S3');
  Logger.debug('   - URL: https://info.arxiv.org/help/bulk_data.html');
  Logger.debug('   - Format: PDF source files + metadata');
  Logger.debug('   - Access: Requester pays for S3 bandwidth');
  Logger.debug('   - Use case: Large-scale research projects\n');

  Logger.debug('3. Papers With Code Integration');
  Logger.debug('   - URL: https://paperswithcode.com');
  Logger.debug('   - Papers: 100,000+ with code implementations');
  Logger.debug('   - Benefit: Direct link to GitHub repositories');
  Logger.debug('   - API: Available for programmatic access\n');

  Logger.debug('4. Semantic Scholar API');
  Logger.debug('   - URL: https://api.semanticscholar.org');
  Logger.debug('   - Papers: 200M+ including ArXiv');
  Logger.debug('   - Features: Citation graphs, influence metrics');
  Logger.debug('   - Rate limit: 100 requests per 5 minutes\n');
}

// Export for use
export { ArXivAPIClient, demonstrateArXivAPI, demonstrateBulkDataAccess };

// Run demonstration if called directly
if (require.main === module) {
  (async () => {
    await demonstrateArXivAPI();
    demonstrateBulkDataAccess();
  })();
}
