#!/usr/bin/env node

/**
 * CLI script to scrape AI library documentation and store in Supabase
 * Usage: npm run scrape:docs [library-name]
 */

import { documentationScraper } from '../services/documentation-scraper.js';
import { logger } from '../utils/enhanced-logger.js';
import { config } from 'dotenv';

// Load environment variables
config();

async function main() {
  const args = process.argv.slice(2);
  const libraryName = args[0];

  try {
    if (libraryName) {
      logger.info(`Scraping documentation for library: ${libraryName}`);
      
      // Import library data
      const aiLibrariesModule = await import('../routers/ai-libraries.js');
      const allLibraries = aiLibrariesModule.AI_LIBRARIES_EXPORT || [];
      
      // If no export, fall back to legacy exports
      if (allLibraries.length === 0) {
        const swiftLibraries = aiLibrariesModule.swiftLibraries || [];
        const aiFrameworks = aiLibrariesModule.aiFrameworks || [];
        allLibraries.push(...swiftLibraries, ...aiFrameworks);
      }
      const library = allLibraries.find(lib => 
        lib.name.toLowerCase() === libraryName.toLowerCase() ||
        lib.display_name.toLowerCase() === libraryName.toLowerCase()
      );

      if (!library) {
        logger.error(`Library not found: ${libraryName}`);
        logger.info('Available libraries:');
        allLibraries.forEach(lib => {
          logger.info(`  - ${lib.name} (${lib.display_name})`);
        });
        process.exit(1);
      }

      await documentationScraper.scrapeLibraryDocumentation(library as any);
      logger.info(`Successfully scraped documentation for ${library.display_name}`);
    } else {
      logger.info('Scraping documentation for all libraries...');
      await documentationScraper.scrapeAllLibraries();
      logger.info('Documentation scraping completed for all libraries');
    }

    process.exit(0);
  } catch (error) {
    logger.error('Documentation scraping failed', error);
    process.exit(1);
  }
}

// Run the script
main().catch(error => {
  logger.error('Unhandled error', error);
  process.exit(1);
});