#!/usr/bin/env tsx

/**
 * SwiftUI Documentation Scraper
 * Scrapes Apple's SwiftUI documentation and stores it in the knowledge base
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { OpenAI } from 'openai';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { URL } from 'url';
import pLimit from 'p-limit';
import { LogContext, log } from '../utils/logger.js';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing required environment variables: SUPABASE_URL or SUPABASE_KEY');
  console.error('Please ensure your .env file is properly configured');
  process.exit(1);
}

// TODO: Complete implementation


const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize OpenAI for embeddings
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy-key-for-local',
});

// SwiftUI documentation sources
const SWIFTUI_SOURCES = [
  // Core SwiftUI
  {
    url: 'https://developer.apple.com/documentation/swiftui',
    category: 'swiftui_overview',
    description: 'SwiftUI Framework Overview'
  },
  // Views and Controls
  {
    url: 'https://developer.apple.com/documentation/swiftui/views-and-controls',
    category: 'swiftui_views',
    description: 'SwiftUI Views and Controls'
  },
  // View Layout
  {
    url: 'https://developer.apple.com/documentation/swiftui/view-layout',
    category: 'swiftui_layout',
    description: 'SwiftUI Layout System'
  },
  // Drawing and Animation
  {
    url: 'https://developer.apple.com/documentation/swiftui/drawing-and-animation',
    category: 'swiftui_animation',
    description: 'SwiftUI Drawing and Animation'
  },
  // App Structure
  {
    url: 'https://developer.apple.com/documentation/swiftui/app-organization',
    category: 'swiftui_app_structure',
    description: 'SwiftUI App Organization'
  },
  // Data Flow
  {
    url: 'https://developer.apple.com/documentation/swiftui/model-data',
    category: 'swiftui_data_flow',
    description: 'SwiftUI Data Flow and State Management'
  },
  // Lists and Navigation
  {
    url: 'https://developer.apple.com/documentation/swiftui/lists',
    category: 'swiftui_lists',
    description: 'SwiftUI Lists and Navigation'
  },
  // Text Input
  {
    url: 'https://developer.apple.com/documentation/swiftui/text-input-and-output',
    category: 'swiftui_text_input',
    description: 'SwiftUI Text Input and Output'
  },
  // Images
  {
    url: 'https://developer.apple.com/documentation/swiftui/images',
    category: 'swiftui_images',
    description: 'SwiftUI Image Handling'
  },
  // Controls and Indicators
  {
    url: 'https://developer.apple.com/documentation/swiftui/controls-and-indicators',
    category: 'swiftui_controls',
    description: 'SwiftUI Controls and Indicators'
  },
  // Menus and Commands
  {
    url: 'https://developer.apple.com/documentation/swiftui/menus-and-commands',
    category: 'swiftui_menus',
    description: 'SwiftUI Menus and Commands'
  },
  // Gestures
  {
    url: 'https://developer.apple.com/documentation/swiftui/gestures',
    category: 'swiftui_gestures',
    description: 'SwiftUI Gesture Recognition'
  },
  // Previews
  {
    url: 'https://developer.apple.com/documentation/swiftui/previews',
    category: 'swiftui_previews',
    description: 'SwiftUI Preview System'
  },
  // macOS Specific
  {
    url: 'https://developer.apple.com/documentation/swiftui/macos',
    category: 'swiftui_macos',
    description: 'SwiftUI for macOS'
  },
  // iOS Specific
  {
    url: 'https://developer.apple.com/documentation/swiftui/ios',
    category: 'swiftui_ios',
    description: 'SwiftUI for iOS'
  },
  // watchOS Specific
  {
    url: 'https://developer.apple.com/documentation/swiftui/watchos',
    category: 'swiftui_watchos',
    description: 'SwiftUI for watchOS'
  }
];

// Additional tutorial sources
const TUTORIAL_SOURCES = [
  {
    url: 'https://developer.apple.com/tutorials/swiftui',
    category: 'swiftui_tutorials',
    description: 'SwiftUI Tutorials'
  },
  {
    url: 'https://developer.apple.com/tutorials/swiftui-concepts',
    category: 'swiftui_concepts',
    description: 'SwiftUI Concepts'
  }
];

interface ScrapedContent {
  url: string;
  title: string;
  content: string;
  code_examples: string[];
  category: string;
  tags: string[];
  metadata: Record<string, any>;
}

// Rate limiting
const limit = pLimit(3); // Max 3 concurrent requests

/**
 * Scrape a single documentation page
 */
async function scrapePage(url: string, category: string): Promise<ScrapedContent | null> {
  try {
    log.info(`Scraping: ${url}`, LogContext.SYSTEM);
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      },
      timeout: 30000
    });

    const $ = cheerio.load(response.data);
    
    // Extract title
    const title = $('h1').first().text().trim() || 
                 $('title').text().replace(' | Apple Developer Documentation', '').trim();
    
    // Extract main content
    const contentElements: string[] = [];
    
    // Get overview/description
    $('.abstract, .content').each((_, elem) => {
      const text = $(elem).text().trim();
      if (text) contentElements.push(text);
    });
    
    // Get sections
    $('section').each((_, elem) => {
      const sectionTitle = $(elem).find('h2, h3').first().text().trim();
      const sectionContent = $(elem).find('p, li').map((_, el) => $(el).text().trim()).get().join(' ');
      if (sectionTitle && sectionContent) {
        contentElements.push(`${sectionTitle}: ${sectionContent}`);
      }
    });
    
    // Extract code examples
    const codeExamples: string[] = [];
    $('pre code, .code-listing').each((_, elem) => {
      const code = $(elem).text().trim();
      if (code && code.length > 20) { // Filter out very short snippets
        codeExamples.push(code);
      }
      // TODO: Complete implementation
      // TODO: Complete implementation
    });
    
    // Extract tags from breadcrumbs or topics
    const tags: string[] = [];
    $('.breadcrumbs a, .topic').each((_, elem) => {
      const tag = $(elem).text().trim().toLowerCase();
      if (tag && !tag.includes('documentation') && !tag.includes('developer')) {
        tags.push(tag);
      }
    });
    
    // Extract metadata
    const metadata: Record<string, any> = {
      platform: extractPlatform($),
      framework_version: extractFrameworkVersion($),
      last_updated: new Date().toISOString(),
      source: 'apple_developer',
      doc_type: category.includes('tutorial') ? 'tutorial' : 'reference'
    };
    
    // Extract related links
    const relatedLinks: string[] = [];
    $('a[href*="/documentation/swiftui"]').each((_, elem) => {
      const href = $(elem).attr('href');
      if (href && !relatedLinks.includes(href)) {
        relatedLinks.push(href);
      }
    });
    metadata.related_links = relatedLinks.slice(0, 10); // Limit to 10 related links
    
    const content = contentElements.join('\n\n');
    
    if (!content || content.length < 100) {
      log.warn(`Insufficient content for ${url}`, LogContext.SYSTEM);
      return null;
    }
    
    return {
      url,
      title,
      content,
      code_examples: codeExamples,
      category,
      tags: [...new Set(tags)], // Remove duplicates
      metadata
    };
  } catch (error) {
    log.error(`Failed to scrape ${url}`, LogContext.SYSTEM, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    return null;
  }
}

/**
 * Extract platform information from the page
 */
function extractPlatform($: cheerio.CheerioAPI): string[] {
  const platforms: string[] = [];
  const platformText = $('.availability').text().toLowerCase();
  
  if (platformText.includes('ios') || $('[data-platform*="ios"]').length > 0) platforms.push('ios');
  if (platformText.includes('macos') || $('[data-platform*="macos"]').length > 0) platforms.push('macos');
  if (platformText.includes('watchos') || $('[data-platform*="watchos"]').length > 0) platforms.push('watchos');
  if (platformText.includes('tvos') || $('[data-platform*="tvos"]').length > 0) platforms.push('tvos');
  
  return platforms.length > 0 ? platforms : ['all'];
}

/**
 * Extract framework version information
 */
function extractFrameworkVersion($: cheerio.CheerioAPI): string {
  const versionText = $('.framework-version, .availability').text();
  const versionMatch = versionText?.match(/SwiftUI\s+(\d+\.\d+)/);
  return versionMatch?.[1] || 'latest';
}

/**
 * Generate embedding for content
 */
async function generateEmbedding(text: string): Promise<number[] | null> {
  try {
    // Use Ollama for embeddings if available
    const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
    
    try {
      const response = await axios.post(`${ollamaUrl}/api/embeddings`, {
        model: 'nomic-embed-text',
        prompt: text.slice(0, 8000) // Limit text length
      });
      
      if (response.data?.embedding) {
        return response.data.embedding;
      }
    } catch (ollamaError) {
      log.warn('Ollama embedding failed, falling back to OpenAI', LogContext.SYSTEM);
    }
    
    // Fallback to OpenAI if configured
    if (process?.env?.OPENAI_API_KEY !== 'dummy-key-for-local') {
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text.slice(0, 8000),
      });
      
      return response.data?.[0]?.embedding || [];
    }
    
    // Return null if no embedding service is available
    return null;
  } catch (error) {
    log.error('Failed to generate embedding', LogContext.SYSTEM, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    return null;
  }
}

/**
 * Store content in Supabase
 */
async function storeInSupabase(content: ScrapedContent): Promise<void> {
  try {
    // Generate embedding for searchability
    const embedding = await generateEmbedding(
      `${content.title} ${content.content} ${content.code_examples.join(' ')}`
    );
    
    // First check if knowledge_sources table exists, if not use documents table
    let tableName = 'documents'; // Default fallback
    
    try {
      const { error } = await supabase
        .from('knowledge_sources')
        .select('title')
        .limit(1);
      
      if (!error) {
        tableName = 'knowledge_sources';
      }
      
      // TODO: Complete implementation
      
      // TODO: Complete implementation
    } catch (e) {
      // Use default documents table
    }
    
    // Store in the appropriate table
    if (tableName === 'knowledge_sources') {
      const { error: knowledgeError } = await supabase
        .from('knowledge_sources')
        .upsert({
          title: content.title,
          content: content.content,
          source_url: content.url,
          source_type: 'documentation',
          category: content.category,
          tags: content.tags,
          metadata: {
            ...content.metadata,
            code_examples_count: content.code_examples.length,
            has_embedding: !!embedding
          },
          content_embedding: embedding,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'source_url'
        });
      
      if (knowledgeError) {
        throw knowledgeError;
      }
    } else {
      // Use documents table as fallback
      const { error: docsError } = await supabase
        .from('documents')
        .upsert({
          name: content.title,
          path: content.url,
          content: content.content,
          content_type: 'text/html',
          metadata: {
            ...content.metadata,
            category: content.category,
            code_examples_count: content.code_examples.length,
            has_embedding: !!embedding
          },
          tags: content.tags,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'path'
        });
      
      if (docsError) {
        throw docsError;
      }
    }
    
    // Store code examples separately if they exist
    if (content.code_examples.length > 0) {
      for (const [index, example] of content.code_examples.entries()) {
        const exampleEmbedding = await generateEmbedding(example);
        
        const { error: exampleError } = await supabase
          .from('code_examples')
          .upsert({
            source_url: content.url,
            title: `${content.title} - Example ${index + 1}`,
            code: example,
            language: 'swift',
            category: content.category,
            tags: [...content.tags, 'code-example', 'swiftui'],
            embedding: exampleEmbedding,
            metadata: {
              source_type: 'documentation',
              example_index: index,
              parent_title: content.title
            },
            created_at: new Date().toISOString()
          }, {
            onConflict: 'source_url,title'
          });
        
        if (exampleError) {
          log.error('Failed to store code example', LogContext.SYSTEM, { error: exampleError });
        }
      }
    }
    
    // Store in MCP context for easy retrieval
    const { error: mcpError } = await supabase
      .from('mcp_context')
      .insert({
        content: JSON.stringify({
          title: content.title,
          url: content.url,
          summary: content.content.slice(0, 500),
          code_examples: content.code_examples.slice(0, 3), // Store first 3 examples
          tags: content.tags
        }),
        category: 'code_patterns', // Use valid category from enum
        metadata: {
          doc_type: 'swiftui',
          original_category: content.category,
          has_code_examples: content.code_examples.length > 0,
          platforms: content.metadata.platform
        },
        created_at: new Date().toISOString()
      });
    
    if (mcpError) {
      log.error('Failed to store in MCP context', LogContext.SYSTEM, { error: mcpError });
    }
    
    log.info(`Stored: ${content.title} (${content.code_examples.length} examples)`, LogContext.SYSTEM);
  } catch (error) {
    log.error(`Failed to store ${content.url}`, LogContext.SYSTEM, { 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
}

/**
 * Discover additional documentation pages
 */
async function discoverPages(baseUrl: string, visitedUrls: Set<string>): Promise<string[]> {
  try {
    const response = await axios.get(baseUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      },
      timeout: 30000
    });

    const $ = cheerio.load(response.data);
    const newUrls: string[] = [];
    
    // Find all SwiftUI documentation links
    $('a[href*="/documentation/swiftui"]').each((_, elem) => {
      const href = $(elem).attr('href');
      if (href) {
        const fullUrl = new URL(href, baseUrl).toString();
        if (!visitedUrls.has(fullUrl) && !fullUrl.includes('#') && !fullUrl.includes('?')) {
          newUrls.push(fullUrl);
          visitedUrls.add(fullUrl);
        }
      // TODO: Complete implementation
      // TODO: Complete implementation
      }
    });
    
    return newUrls.slice(0, 50); // Limit to 50 new URLs per page
  } catch (error) {
    log.error(`Failed to discover pages from ${baseUrl}`, LogContext.SYSTEM, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    return [];
  }
}

/**
 * Main scraping function
 */
async function scrapeSwiftUIDocumentation(): Promise<void> {
  log.info('Starting SwiftUI documentation scraping...', LogContext.SYSTEM);
  
  const visitedUrls = new Set<string>();
  const urlsToScrape: Array<{ url: string; category: string }> = [];
  
  // Add initial sources
  for (const source of [...SWIFTUI_SOURCES, ...TUTORIAL_SOURCES]) {
    urlsToScrape.push({ url: source.url, category: source.category });
    visitedUrls.add(source.url);
  }
  
  // Process URLs with rate limiting
  let processedCount = 0;
  let storedCount = 0;
  
  while (urlsToScrape.length > 0 && processedCount < 500) { // Limit total pages
    const batch = urlsToScrape.splice(0, 10); // Process in batches
    
    const results = await Promise.all(
      batch.map(({ url, category }) => 
        limit(() => scrapePage(url, category))
      )
    );
    
    for (const [index, content] of results.entries()) {
      if (content) {
        await storeInSupabase(content);
        storedCount++;
        
        // Discover more pages from this one
        const newUrls = await discoverPages(content.url, visitedUrls);
        for (const newUrl of newUrls.slice(0, 5)) { // Limit discovery per page
          urlsToScrape.push({ url: newUrl, category: batch[index]?.category || 'unknown' });
        }
      }
      processedCount++;
    }
    
    log.info(`Progress: ${processedCount} processed, ${storedCount} stored, ${urlsToScrape.length} remaining`, LogContext.SYSTEM);
    
    // Add a small delay between batches
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Create a summary entry
  const { error: summaryError } = await supabase
    .from('mcp_context')
    .insert({
      content: JSON.stringify({
        summary: `SwiftUI documentation scraping completed`,
        total_pages: storedCount,
        categories: [...new Set(SWIFTUI_SOURCES.map(s => s.category))],
        timestamp: new Date().toISOString()
      }),
      category: 'project_overview', // Use valid category
      metadata: {
        doc_type: 'swiftui',
        scraping_summary: true,
        total_processed: processedCount,
        total_stored: storedCount
      },
      created_at: new Date().toISOString()
    });
  
  if (summaryError) {
    log.error('Failed to store summary', LogContext.SYSTEM, { error: summaryError });
  }
  
  log.info(`SwiftUI documentation scraping completed! Processed: ${processedCount}, Stored: ${storedCount}`, LogContext.SYSTEM);
}

// Run the scraper
scrapeSwiftUIDocumentation()
  .then(() => {
    log.info('SwiftUI documentation scraping finished successfully', LogContext.SYSTEM);
    process.exit(0);
  })
  .catch((error) => {
    log.error('SwiftUI documentation scraping failed', LogContext.SYSTEM, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    process.exit(1);
  });