#!/usr/bin/env node

/**
 * Framework Documentation Scraper
 * 
 * Comprehensive scraper for major framework documentation including:
 * - React/Next.js documentation
 * - TypeScript documentation
 * - Node.js/Express documentation
 * - Python/FastAPI documentation
 * - Kubernetes/Docker documentation
 * - Cloud provider documentation
 * - ML framework documentation
 * 
 * Usage: node scripts/crawl-framework-documentation.mjs [framework]
 */

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { setTimeout } from 'timers/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Crawler configuration
const CRAWLER_CONFIG = {
  name: 'Framework Documentation Scraper',
  type: 'framework-documentation',
  category: 'project_info',
  source: 'framework-docs-2025',
  batchSize: 5,
  delayMs: 2000, // Respectful delay
  maxRetries: 3
};

/**
 * Framework documentation sources
 */
const FRAMEWORK_DOCS = {
  react: {
    name: 'React',
    baseUrl: 'https://react.dev',
    paths: [
      '/learn',
      '/learn/installation',
      '/learn/start-a-new-react-project',
      '/learn/describing-the-ui',
      '/learn/adding-interactivity',
      '/learn/managing-state',
      '/learn/escape-hatches',
      '/reference/react',
      '/reference/react-dom',
      '/reference/react/hooks'
    ],
    category: 'frontend-framework'
  },
  
  nextjs: {
    name: 'Next.js',
    baseUrl: 'https://nextjs.org',
    paths: [
      '/docs',
      '/docs/getting-started',
      '/docs/app',
      '/docs/pages',
      '/docs/api-reference',
      '/docs/architecture',
      '/docs/deployment'
    ],
    category: 'fullstack-framework'
  },
  
  typescript: {
    name: 'TypeScript',
    baseUrl: 'https://www.typescriptlang.org',
    paths: [
      '/docs',
      '/docs/handbook/intro',
      '/docs/handbook/basic-types',
      '/docs/handbook/interfaces',
      '/docs/handbook/functions',
      '/docs/handbook/classes',
      '/docs/handbook/generics',
      '/docs/handbook/advanced-types'
    ],
    category: 'programming-language'
  },
  
  nodejs: {
    name: 'Node.js',
    baseUrl: 'https://nodejs.org',
    paths: [
      '/en/docs',
      '/en/docs/guides',
      '/en/docs/guides/getting-started-guide',
      '/en/learn',
      '/en/learn/getting-started/introduction-to-nodejs'
    ],
    category: 'backend-runtime'
  },
  
  fastapi: {
    name: 'FastAPI',
    baseUrl: 'https://fastapi.tiangolo.com',
    paths: [
      '/',
      '/tutorial',
      '/tutorial/first-steps',
      '/tutorial/path-params',
      '/tutorial/query-params',
      '/tutorial/body',
      '/tutorial/dependencies',
      '/advanced'
    ],
    category: 'backend-framework'
  },
  
  kubernetes: {
    name: 'Kubernetes',
    baseUrl: 'https://kubernetes.io',
    paths: [
      '/docs',
      '/docs/concepts',
      '/docs/concepts/overview',
      '/docs/concepts/cluster-administration',
      '/docs/concepts/workloads',
      '/docs/tasks',
      '/docs/reference'
    ],
    category: 'container-orchestration'
  },
  
  docker: {
    name: 'Docker',
    baseUrl: 'https://docs.docker.com',
    paths: [
      '/get-started',
      '/guides',
      '/reference',
      '/engine/reference/builder',
      '/compose',
      '/desktop'
    ],
    category: 'containerization'
  },
  
  pytorch: {
    name: 'PyTorch',
    baseUrl: 'https://pytorch.org',
    paths: [
      '/docs/stable',
      '/tutorials',
      '/get-started/locally',
      '/docs/stable/torch',
      '/docs/stable/nn',
      '/docs/stable/optim',
      '/docs/stable/tensors'
    ],
    category: 'ml-framework'
  },
  
  aws: {
    name: 'AWS',
    baseUrl: 'https://docs.aws.amazon.com',
    paths: [
      '/general/latest/gr',
      '/lambda/latest/dg',
      '/ec2/latest/userguide',
      '/s3/latest/userguide',
      '/rds/latest/userguide',
      '/cloudformation/latest/userguide'
    ],
    category: 'cloud-platform'
  },
  
  azure: {
    name: 'Azure',
    baseUrl: 'https://docs.microsoft.com',
    paths: [
      '/en-us/azure',
      '/en-us/azure/app-service',
      '/en-us/azure/storage',
      '/en-us/azure/sql-database',
      '/en-us/azure/virtual-machines',
      '/en-us/azure/kubernetes-service'
    ],
    category: 'cloud-platform'
  },
  
  gcp: {
    name: 'Google Cloud',
    baseUrl: 'https://cloud.google.com',
    paths: [
      '/docs',
      '/docs/overview',
      '/compute/docs',
      '/storage/docs',
      '/sql/docs',
      '/kubernetes-engine/docs'
    ],
    category: 'cloud-platform'
  },
  
  postgresql: {
    name: 'PostgreSQL',
    baseUrl: 'https://www.postgresql.org',
    paths: [
      '/docs/current',
      '/docs/current/tutorial',
      '/docs/current/sql',
      '/docs/current/admin',
      '/docs/current/client-interfaces',
      '/docs/current/server-programming'
    ],
    category: 'database'
  },
  
  mongodb: {
    name: 'MongoDB',
    baseUrl: 'https://docs.mongodb.com',
    paths: [
      '/manual',
      '/manual/introduction',
      '/manual/tutorial',
      '/manual/crud',
      '/manual/aggregation',
      '/manual/indexes'
    ],
    category: 'database'
  }
};

class DocumentationScraper {
  constructor() {
    this.supabaseHelper = null;
    this.scrapedCount = 0;
    this.errors = [];
  }

  async initialize() {
    // Import Supabase helper
    const { SupabaseAgentHelper } = await import(join(__dirname, '../src/utils/supabase-agent-helper.ts'));
    this.supabaseHelper = new SupabaseAgentHelper(CRAWLER_CONFIG.source);
    
    // Test connection
    const connectionTest = await this.supabaseHelper.testConnection();
    if (!connectionTest.success) {
      throw new Error(`Supabase connection failed: ${connectionTest.error}`);
    }
  }

  async scrapeUrl(url, retries = 0) {
    try {
      console.log(`🔍 Scraping: ${url}`);
      
      const response = await axios.get(url, {
        timeout: 30000,
        headers: {
          'User-Agent': 'Universal-AI-Tools Documentation Scraper 1.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive'
        }
      });

      const $ = cheerio.load(response.data);
      
      // Remove script tags, style tags, and navigation elements
      $('script, style, nav, header, footer, .navigation, .sidebar').remove();
      
      // Extract main content (try common selectors)
      let content = '';
      const contentSelectors = [
        'main',
        '[role="main"]',
        '.main-content',
        '.content',
        '.documentation',
        '.docs-content',
        'article',
        '.markdown-body'
      ];
      
      for (const selector of contentSelectors) {
        const element = $(selector);
        if (element.length > 0) {
          content = element.text().trim();
          break;
        }
      }
      
      // Fallback to body if no main content found
      if (!content) {
        content = $('body').text().trim();
      }
      
      // Clean up content
      content = content
        .replace(/\s+/g, ' ')
        .replace(/\n\s*\n/g, '\n')
        .trim();
      
      // Extract title
      let title = $('h1').first().text().trim();
      if (!title) {
        title = $('title').text().trim();
      }
      if (!title) {
        title = url.split('/').pop() || 'Documentation Page';
      }

      // Extract headings for structure
      const headings = [];
      $('h1, h2, h3, h4, h5, h6').each((i, el) => {
        const heading = $(el);
        const level = parseInt(el.tagName.substring(1));
        const text = heading.text().trim();
        if (text) {
          headings.push({ level, text });
        }
      });

      return {
        url,
        title,
        content: content.substring(0, 50000), // Limit content size
        headings,
        wordCount: content.split(' ').length,
        scrapedAt: new Date().toISOString()
      };

    } catch (error) {
      // Skip retries for 404 errors - they won't get better
      if (error.response && error.response.status === 404) {
        console.log(`⚠️ Skipping ${url} - Page not found (404)`);
        this.errors.push({ url, error: 'Page not found (404)' });
        return null;
      }
      
      if (retries < CRAWLER_CONFIG.maxRetries) {
        console.log(`⚠️ Retry ${retries + 1}/${CRAWLER_CONFIG.maxRetries} for ${url}`);
        await setTimeout(CRAWLER_CONFIG.delayMs * 2);
        return this.scrapeUrl(url, retries + 1);
      }
      
      console.error(`❌ Failed to scrape ${url}:`, error.message);
      this.errors.push({ url, error: error.message });
      return null;
    }
  }

  async scrapeFramework(frameworkKey) {
    const framework = FRAMEWORK_DOCS[frameworkKey];
    if (!framework) {
      throw new Error(`Framework '${frameworkKey}' not found`);
    }

    console.log(`\n🚀 Scraping ${framework.name} documentation...`);
    console.log(`📁 Category: ${framework.category}`);
    console.log(`🔗 Base URL: ${framework.baseUrl}`);
    console.log(`📄 Pages: ${framework.paths.length}`);
    console.log('');

    const results = [];
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < framework.paths.length; i++) {
      const path = framework.paths[i];
      const url = framework.baseUrl + path;
      
      try {
        const data = await this.scrapeUrl(url);
        
        if (data) {
          // Store in Supabase
          const result = await this.supabaseHelper.storePattern({
            name: `${framework.name}: ${data.title}`,
            description: `${framework.name} documentation for ${data.title}`,
            content: JSON.stringify({
              url: data.url,
              title: data.title,
              content: data.content,
              headings: data.headings,
              wordCount: data.wordCount,
              framework: framework.name,
              category: framework.category,
              scrapedAt: data.scrapedAt
            }),
            type: `${frameworkKey}-documentation`,
            tools: [framework.name],
            keyConcepts: data.headings.map(h => h.text).slice(0, 10),
            tags: [frameworkKey, 'documentation', framework.category],
            complexity: 'intermediate'
          }, 'project_info');

          if (result.success) {
            console.log(`✅ Stored: ${data.title} (${data.wordCount} words)`);
            successCount++;
          } else {
            console.error(`❌ Failed to store: ${data.title}`, result.error);
            failCount++;
          }
          
          results.push(data);
        } else {
          failCount++;
        }
        
        this.scrapedCount++;
        
        // Respectful delay between requests
        if (i < framework.paths.length - 1) {
          await setTimeout(CRAWLER_CONFIG.delayMs);
        }
        
      } catch (error) {
        console.error(`❌ Error processing ${url}:`, error.message);
        failCount++;
      }
    }

    console.log(`\n📊 ${framework.name} Results:`);
    console.log(`  ✅ Success: ${successCount}`);
    console.log(`  ❌ Failed: ${failCount}`);
    console.log(`  📝 Total: ${framework.paths.length}`);

    return results;
  }

  async scrapeAllFrameworks() {
    console.log(`🤖 ${CRAWLER_CONFIG.name}`);
    console.log(`📚 Scraping documentation for ${Object.keys(FRAMEWORK_DOCS).length} frameworks...`);
    
    await this.initialize();

    const allResults = {};
    
    for (const [key, framework] of Object.entries(FRAMEWORK_DOCS)) {
      try {
        allResults[key] = await this.scrapeFramework(key);
      } catch (error) {
        console.error(`❌ Failed to scrape ${framework.name}:`, error.message);
        this.errors.push({ framework: key, error: error.message });
      }
    }

    // Final statistics
    const stats = await this.supabaseHelper.getStatistics();
    
    console.log('\n🏆 DOCUMENTATION SCRAPING COMPLETE!');
    console.log('');
    console.log('📊 Summary:');
    console.log(`  🔍 Total pages scraped: ${this.scrapedCount}`);
    console.log(`  ❌ Total errors: ${this.errors.length}`);
    
    if (stats.success) {
      console.log('');
      console.log('📈 Updated Knowledge Base:');
      console.log(`  📝 Total Records: ${stats.data.totalRecords}`);
      console.log(`  📂 Categories: ${Object.keys(stats.data.categoryCounts).length}`);
      console.log(`  🔗 Sources: ${Object.keys(stats.data.sourceCounts).length}`);
    }

    if (this.errors.length > 0) {
      console.log('\n⚠️ Errors encountered:');
      this.errors.forEach(error => {
        console.log(`  - ${error.url || error.framework}: ${error.error}`);
      });
    }

    return allResults;
  }

  async scrapeSpecificFramework(frameworkKey) {
    console.log(`🤖 ${CRAWLER_CONFIG.name}`);
    console.log(`🎯 Targeting specific framework: ${frameworkKey}`);
    
    await this.initialize();
    
    const results = await this.scrapeFramework(frameworkKey);
    
    console.log('\n🏆 FRAMEWORK DOCUMENTATION SCRAPING COMPLETE!');
    
    return results;
  }
}

// Main execution
async function main() {
  const scraper = new DocumentationScraper();
  const framework = process.argv[2];
  
  try {
    if (framework) {
      if (!FRAMEWORK_DOCS[framework]) {
        console.error(`❌ Framework '${framework}' not found.`);
        console.log('Available frameworks:', Object.keys(FRAMEWORK_DOCS).join(', '));
        process.exit(1);
      }
      await scraper.scrapeSpecificFramework(framework);
    } else {
      await scraper.scrapeAllFrameworks();
    }
  } catch (error) {
    console.error('❌ Scraper failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { DocumentationScraper, FRAMEWORK_DOCS, CRAWLER_CONFIG };