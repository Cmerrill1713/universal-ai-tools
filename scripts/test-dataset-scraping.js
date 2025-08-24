#!/usr/bin/env node
/**
 * Test Script for HuggingFace Dataset Scraping
 * 
 * This script tests the comprehensive dataset scraping functionality
 * with a small subset of datasets to validate the implementation.
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '..', '.env');
dotenv.config({ path: envPath });

import { HuggingFaceDatasetScraper } from './scrape-all-huggingface-datasets.js';

async function testDatasetScraping() {
  process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.log('🧪 Testing HuggingFace Dataset Scraping');
  console.log('=====================================\n');

  try {
    // Test with a small limit for validation
    const scraper = new HuggingFaceDatasetScraper({
      limit: 20,           // Only process first 20 datasets
      batchSize: 3,        // Small batches
      delay: 2000,         // 2 seconds between batches
      skipExisting: true,  // Skip existing datasets
      dryRun: false        // Actually ingest (set to true for testing)
    });

    console.log('🚀 Starting test scraping...\n');
    await scraper.run();
    console.log('\n✅ Test completed successfully!');

  } catch (error) {
    process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.error('\n❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Check environment variables
function checkEnvironment() {
  const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(key => console.error(`   - ${key}`));
    console.error('\nPlease set these in your .env file');
    process.exit(1);
  }
}

// Main execution
async function main() {
  checkEnvironment();
  await testDatasetScraping();
}

main().catch(console.error);