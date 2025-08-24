#!/usr/bin/env node

/**
 * Standalone script to scrape all AI library documentation
 * This version doesn't import the router to avoid dependency issues
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as cheerio from 'cheerio';

// Load environment variables
config();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
const supabase = createClient(supabaseUrl, supabaseKey);

// Simple logger
const logger = {
  info: (msg: string, ...args: any[]) => console.log(`[INFO] ${msg}`, ...args),
  error: (msg: string, ...args: any[]) => console.error(`[ERROR] ${msg}`, ...args),
  debug: (msg: string, ...args: any[]) => console.log(`[DEBUG] ${msg}`, ...args),
};

// Delay helper
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Scrape GitHub README
async function scrapeGitHubReadme(repository: string): Promise<{ content: string; markdown: string } | null> {
  try {
    const match = repository.match(/github\.com\/([^\/]+\/[^\/]+)/);
    if (!match) return null;

    const repoPath = match[1];
    const rawUrl = `https://raw.githubusercontent.com/${repoPath}/main/README.md`;
    
    // Try main branch first
    let response = await axios.get(rawUrl, { timeout: 10000 }).catch(() => null);
    
    // Try master branch if main fails
    if (!response) {
      const masterUrl = `https://raw.githubusercontent.com/${repoPath}/master/README.md`;
      response = await axios.get(masterUrl, { timeout: 10000 }).catch(() => null);
    }

    if (response && response.data) {
      return {
        content: response.data,
        markdown: response.data
      };
    }

    return null;
  } catch (error) {
    logger.error('Failed to scrape GitHub README', error);
    return null;
  }
}

// Scrape web documentation
async function scrapeWebDocumentation(url: string): Promise<{ content: string; html: string } | null> {
  try {
    const response = await axios.get(url, { 
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DocScraper/1.0)'
      }
    });

    const $ = cheerio.load(response.data);
    
    // Remove scripts and styles
    $('script').remove();
    $('style').remove();
    
    // Try to find main content
    const mainContent = $('main').text() || 
                       $('.documentation').text() || 
                       $('.content').text() || 
                       $('article').text() || 
                       $('body').text();

    return {
      content: mainContent.trim(),
      html: response.data
    };
  } catch (error) {
    logger.error('Failed to scrape web documentation', error);
    return null;
  }
}

// Store library in database
async function storeLibrary(library: any): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('ai_libraries')
      .upsert({
        name: library.id || library.name.toLowerCase().replace(/\s+/g, '-'),
        display_name: library.name,
        category: library.category,
        language: library.language,
        description: library.description,
        homepage: library.homepage,
        repository: library.repository,
        documentation_url: library.documentation,
        stars: library.stars || 0,
        downloads: library.downloads || 0,
        rating: library.rating || 0,
        installation: library.installation || {},
        features: library.features || [],
        tags: library.tags || [],
        metadata: {
          license: library.license,
          maintainers: library.maintainers,
          examples: library.examples
        }
      }, {
        onConflict: 'name',
        ignoreDuplicates: false
      })
      .select('id')
      .single();

    if (error) {
      logger.error(`Failed to store library ${library.name}:`, error);
      return null;
    }

    return data?.id;
  } catch (error) {
    logger.error(`Failed to store library ${library.name}:`, error);
    return null;
  }
}

// Store documentation
async function storeDocumentation(libraryId: string, docType: string, title: string, content: string, markdown?: string, html?: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('library_documentation')
      .upsert({
        library_id: libraryId,
        doc_type: docType,
        title: title,
        content: content,
        markdown_content: markdown,
        html_content: html,
        version: 'latest',
        language: 'en'
      }, {
        onConflict: 'library_id,doc_type,version,language'
      });

    if (error) {
      logger.error(`Failed to store documentation:`, error);
    }
  } catch (error) {
    logger.error(`Failed to store documentation:`, error);
  }
}

// Process a single library
async function processLibrary(library: any): Promise<void> {
  try {
    logger.info(`Processing ${library.name}...`);

    // Store library info
    const libraryId = await storeLibrary(library);
    if (!libraryId) {
      logger.error(`Failed to store library ${library.name}`);
      return;
    }

    // Scrape README from GitHub if available
    if (library.repository && library.repository.includes('github.com')) {
      logger.info(`  Scraping GitHub README...`);
      const readme = await scrapeGitHubReadme(library.repository);
      if (readme) {
        await storeDocumentation(libraryId, 'readme', 'README', readme.content, readme.markdown);
        logger.info(`  ✓ Stored README`);
      }
    }

    // Scrape web documentation if available
    if (library.documentation) {
      logger.info(`  Scraping web documentation...`);
      const webDoc = await scrapeWebDocumentation(library.documentation);
      if (webDoc) {
        await storeDocumentation(libraryId, 'getting_started', 'Documentation', webDoc.content, undefined, webDoc.html);
        logger.info(`  ✓ Stored documentation`);
      }
    }

    // Store code examples if provided
    if (library.examples && Array.isArray(library.examples)) {
      for (const example of library.examples) {
        await supabase
          .from('library_code_examples')
          .upsert({
            library_id: libraryId,
            title: example,
            description: `Example: ${example}`,
            code: `// Example code for ${example}`,
            language: library.language,
            category: 'example'
          });
      }
      logger.info(`  ✓ Stored ${library.examples.length} examples`);
    }

    logger.info(`✓ Completed ${library.name}`);
  } catch (error) {
    logger.error(`Failed to process ${library.name}:`, error);
  }
}

// Main function
async function main() {
  try {
    // Import expanded libraries
    const expandedLibrariesModule = await import('../data/expanded-libraries.js');
    const EXPANDED_LIBRARIES = expandedLibrariesModule.EXPANDED_LIBRARIES || [];
    
    // Import additional reference libraries  
    const additionalLibrariesModule = await import('../data/additional-reference-libraries.js');
    const ADDITIONAL_LIBRARIES = additionalLibrariesModule.ADDITIONAL_LIBRARIES || [];
    
    // Import beautiful frontend libraries
    const beautifulLibrariesModule = await import('../data/beautiful-frontend-libraries.js');
    const BEAUTIFUL_LIBRARIES = beautifulLibrariesModule.BEAUTIFUL_FRONTEND_LIBRARIES || [];
    
    // Combine all libraries
    const ALL_LIBRARIES = [...EXPANDED_LIBRARIES, ...ADDITIONAL_LIBRARIES, ...BEAUTIFUL_LIBRARIES];
    
    logger.info('Starting documentation scraping for all libraries...');
    logger.info(`Found ${ALL_LIBRARIES.length} libraries to process (${EXPANDED_LIBRARIES.length} expanded + ${ADDITIONAL_LIBRARIES.length} additional + ${BEAUTIFUL_LIBRARIES.length} beautiful)`);

    // Process libraries in batches to avoid overwhelming the API
    const batchSize = 5;
    for (let i = 0; i < ALL_LIBRARIES.length; i += batchSize) {
      const batch = ALL_LIBRARIES.slice(i, i + batchSize);
      
      logger.info(`Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(ALL_LIBRARIES.length / batchSize)}`);
      
      await Promise.all(batch.map(library => processLibrary(library)));
      
      // Delay between batches
      if (i + batchSize < ALL_LIBRARIES.length) {
        logger.info('Waiting before next batch...');
        await delay(3000);
      }
    }

    logger.info('✅ Documentation scraping completed successfully!');
    logger.info(`Processed ${ALL_LIBRARIES.length} libraries`);
    process.exit(0);
  } catch (error) {
    logger.error('Documentation scraping failed:', error);
    process.exit(1);
  }
}

// Run the script
main().catch(error => {
  logger.error('Fatal error:', error);
  process.exit(1);
});