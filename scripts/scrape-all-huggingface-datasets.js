#!/usr/bin/env node
/**
 * HuggingFace Dataset Discovery and Comprehensive Scraping Script
 * 
 * This script discovers ALL available datasets from HuggingFace Hub API
 * and ingests them into the knowledge base using the existing ingestion service.
 * 
 * Features:
 * - Fetches complete dataset list from HuggingFace API with pagination
 * - Processes in batches with rate limiting to avoid API limits
 * - Handles failures gracefully and continues with remaining datasets
 * - Shows real-time progress with detailed statistics
 * - Provides comprehensive summary at completion
 * - Focuses ONLY on datasets (skips models entirely)
 * - Uses existing HuggingFace knowledge ingestion service
 * 
 * Usage:
 *   node scripts/scrape-all-huggingface-datasets.js [options]
 *   
 * Options:
 *   --limit <number>     Limit total datasets to process (for testing)
 *   --batch-size <num>   Number of datasets per batch (default: 5)
 *   --delay <ms>         Delay between batches in ms (default: 3000)
 *   --skip-existing      Skip datasets already in knowledge base
 *   --dry-run            Show what would be done without ingesting
 *   --start-from <id>    Start from specific dataset ID (resume support)
 *   --filter <tags>      Filter by tags (e.g., "text-classification")
 *   --author <name>      Filter by specific author/organization
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '..', '.env');
dotenv.config({ path: envPath });

// Configuration
const CONFIG = {
  // API endpoints
  HF_API_BASE: 'https://huggingface.co/api',
  DATASETS_ENDPOINT: '/datasets',
  LOCAL_API_BASE: process.env.LOCAL_API_BASE || 'http://localhost:9999/api',
  
  // Rate limiting and batch processing
  DEFAULT_BATCH_SIZE: 5,
  DEFAULT_DELAY_MS: 3000,
  MAX_CONCURRENT_REQUESTS: 3,
  REQUEST_TIMEOUT_MS: 30000,
  MAX_RETRIES: 3,
  
  // Pagination
  INITIAL_LIMIT: 100, // HF API default page size
  MAX_TOTAL_LIMIT: null, // null = no limit, fetch ALL datasets
  
  // Progress tracking
  PROGRESS_INTERVAL: 10, // Show progress every N datasets
  STATS_INTERVAL: 50,    // Show detailed stats every N datasets
};

class HuggingFaceDatasetScraper {
  constructor(options = {}) {
    this.options = {
      limit: options.limit || CONFIG.MAX_TOTAL_LIMIT,
      batchSize: options.batchSize || CONFIG.DEFAULT_BATCH_SIZE,
      delay: options.delay || CONFIG.DEFAULT_DELAY_MS,
      skipExisting: options.skipExisting !== false,
      dryRun: options.dryRun || false,
      startFrom: options.startFrom || null,
      filter: options.filter || null,
      author: options.author || null,
    };
    
    this.stats = {
      totalDiscovered: 0,
      totalProcessed: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      startTime: Date.now(),
      currentBatch: 0,
      errors: []
    };
    
    this.supabase = null;
    this.initializeSupabase();
    
    process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.log('🤗 HuggingFace Dataset Scraper initialized');
    console.log(`📋 Configuration:`);
    console.log(`   - Batch size: ${this.options.batchSize}`);
    console.log(`   - Delay between batches: ${this.options.delay}ms`);
    console.log(`   - Skip existing: ${this.options.skipExisting}`);
    console.log(`   - Dry run: ${this.options.dryRun}`);
    console.log(`   - Limit: ${this.options.limit || 'NO LIMIT (ALL DATASETS)'}`);
    if (this.options.filter) console.log(`   - Filter: ${this.options.filter}`);
    if (this.options.author) console.log(`   - Author: ${this.options.author}`);
    console.log('');
  }
  
  initializeSupabase() {
    try {
      this.supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY
      );
      console.log('✅ Supabase connection initialized');
    } catch (error) {
      process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.error('❌ Failed to initialize Supabase:', error.message);
      process.exit(1);
    }
  }
  
  /**
   * Discover ALL datasets from HuggingFace Hub API with pagination
   */
  async discoverAllDatasets() {
    console.log('🔍 Discovering all datasets from HuggingFace Hub...');
    
    const allDatasets = [];
    let nextUrl = this.buildInitialUrl();
    let pageCount = 0;
    
    try {
      while (nextUrl) {
        pageCount++;
        console.log(`📄 Fetching page ${pageCount}: ${nextUrl}`);
        
        const response = await this.fetchWithRetry(nextUrl);
        
        if (!response.ok) {
          throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }
        
        const datasets = await response.json();
        
        // Filter to only include actual datasets (not models)
        const datasetEntries = Array.isArray(datasets) ? datasets : [];
        allDatasets.push(...datasetEntries);
        
        console.log(`   Found ${datasetEntries.length} datasets on this page`);
        console.log(`   Total discovered so far: ${allDatasets.length}`);
        
        // Check for pagination using Link header
        nextUrl = this.extractNextUrl(response.headers.get('Link'));
        
        // Apply limit if specified
        if (this.options.limit && allDatasets.length >= this.options.limit) {
          console.log(`🎯 Reached specified limit of ${this.options.limit} datasets`);
          break;
        }
        
        // Rate limiting between pages
        if (nextUrl) {
          await this.sleep(1000); // 1 second between pages
        }
      }
      
      this.stats.totalDiscovered = allDatasets.length;
      console.log(`\n🎉 Discovery complete! Found ${allDatasets.length} total datasets`);
      
      return allDatasets;
      
    } catch (error) {
      console.error('❌ Error during dataset discovery:', error.message);
      throw error;
    }
  }
  
  buildInitialUrl() {
    const params = new URLSearchParams();
    
    // Set initial parameters
    params.set('limit', CONFIG.INITIAL_LIMIT.toString());
    params.set('full', 'true'); // Get comprehensive metadata
    
    // Apply filters if specified
    if (this.options.filter) {
      params.set('filter', this.options.filter);
    }
    
    if (this.options.author) {
      params.set('author', this.options.author);
    }
    
    // Sort by download count to prioritize popular datasets
    params.set('sort', 'downloads');
    params.set('direction', '-1');
    
    return `${CONFIG.HF_API_BASE}${CONFIG.DATASETS_ENDPOINT}?${params.toString()}`;
  }
  
  extractNextUrl(linkHeader) {
    if (!linkHeader) return null;
    
    // Parse GitHub-style Link header: '<url>; rel="next"'
    const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
    return nextMatch ? nextMatch[1] : null;
  }
  
  /**
   * Process all discovered datasets in batches
   */
  async processAllDatasets(datasets) {
    console.log(`\n🚀 Starting batch processing of ${datasets.length} datasets...`);
    
    // Apply start-from filter if specified
    let datasetsToProcess = datasets;
    if (this.options.startFrom) {
      const startIndex = datasets.findIndex(d => d.id === this.options.startFrom);
      if (startIndex >= 0) {
        datasetsToProcess = datasets.slice(startIndex);
        console.log(`📍 Starting from dataset: ${this.options.startFrom} (index ${startIndex})`);
      } else {
        console.log(`⚠️ Start-from dataset '${this.options.startFrom}' not found, processing all`);
      }
    }
    
    // Apply limit after start-from
    if (this.options.limit) {
      datasetsToProcess = datasetsToProcess.slice(0, this.options.limit);
    }
    
    console.log(`📊 Will process ${datasetsToProcess.length} datasets`);
    console.log(`📦 Batch size: ${this.options.batchSize}`);
    console.log(`⏱️ Delay between batches: ${this.options.delay}ms\n`);
    
    // Process in batches
    for (let i = 0; i < datasetsToProcess.length; i += this.options.batchSize) {
      const batch = datasetsToProcess.slice(i, i + this.options.batchSize);
      this.stats.currentBatch++;
      
      console.log(`\n📦 Processing batch ${this.stats.currentBatch} (${batch.length} datasets):`);
      batch.forEach((dataset, idx) => {
        console.log(`   ${i + idx + 1}. ${dataset.id || 'unknown-id'}`);
      });
      
      if (this.options.dryRun) {
        console.log('   🏃 DRY RUN - Would ingest these datasets');
        this.stats.totalProcessed += batch.length;
        continue;
      }
      
      // Process batch
      await this.processBatch(batch);
      
      // Show progress
      this.showProgress();
      
      // Rate limiting between batches
      if (i + this.options.batchSize < datasetsToProcess.length) {
        console.log(`⏳ Waiting ${this.options.delay}ms before next batch...`);
        await this.sleep(this.options.delay);
      }
    }
    
    console.log('\n🎉 All datasets processed!');
    this.showFinalSummary();
  }
  
  /**
   * Process a single batch of datasets
   */
  async processBatch(batch) {
    const batchPromises = batch.map(async (dataset) => {
      return await this.processDataset(dataset);
    });
    
    try {
      const results = await Promise.allSettled(batchPromises);
      
      results.forEach((result, index) => {
        const dataset = batch[index];
        this.stats.totalProcessed++;
        
        if (result.status === 'fulfilled') {
          const { success, skipped, error } = result.value;
          
          if (skipped) {
            this.stats.skipped++;
            console.log(`   ⏭️ ${dataset.id}: skipped (already exists)`);
          } else if (success) {
            this.stats.successful++;
            console.log(`   ✅ ${dataset.id}: success`);
          } else {
            this.stats.failed++;
            console.log(`   ❌ ${dataset.id}: failed - ${error}`);
            this.stats.errors.push({ dataset: dataset.id, error });
          }
        } else {
          this.stats.failed++;
          console.log(`   💥 ${dataset.id}: crashed - ${result.reason}`);
          this.stats.errors.push({ dataset: dataset.id, error: result.reason });
        }
      });
      
    } catch (error) {
      console.error('❌ Batch processing error:', error);
      this.stats.failed += batch.length;
    }
  }
  
  /**
   * Process a single dataset
   */
  async processDataset(dataset) {
    try {
      const datasetId = dataset.id;
      
      if (!datasetId) {
        return { success: false, error: 'No dataset ID found' };
      }
      
      // Check if already exists (if skipExisting is enabled)
      if (this.options.skipExisting) {
        const exists = await this.checkDatasetExists(datasetId);
        if (exists) {
          return { success: true, skipped: true };
        }
      }
      
      // Call the local ingestion API
      const response = await this.ingestDataset(datasetId);
      
      if (response.success) {
        return { success: true, skipped: false };
      } else {
        return { success: false, error: response.error || 'Unknown error' };
      }
      
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Check if dataset already exists in knowledge base
   */
  async checkDatasetExists(datasetId) {
    try {
      const { data, error } = await this.supabase
        .from('knowledge_base')
        .select('source_id')
        .eq('source', 'huggingface')
        .eq('source_id', datasetId)
        .single();
      
      return !error && !!data;
    } catch {
      return false;
    }
  }
  
  /**
   * Ingest dataset using local API
   */
  async ingestDataset(datasetId) {
    try {
      const url = `${CONFIG.LOCAL_API_BASE}/huggingface-knowledge/ingest/dataset`;
      
      const response = await this.fetchWithRetry(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ datasetId }),
        timeout: CONFIG.REQUEST_TIMEOUT_MS,
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error ${response.status}: ${errorText}`);
      }
      
      return await response.json();
      
    } catch (error) {
      throw new Error(`Ingestion failed: ${error.message}`);
    }
  }
  
  /**
   * Fetch with retry logic
   */
  async fetchWithRetry(url, options = {}, retries = CONFIG.MAX_RETRIES) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, {
          timeout: CONFIG.REQUEST_TIMEOUT_MS,
          ...options,
        });
        
        // Return response for successful requests (even if status is error)
        return response;
        
      } catch (error) {
        console.log(`   ⚠️ Attempt ${attempt}/${retries} failed: ${error.message}`);
        
        if (attempt === retries) {
          throw error;
        }
        
        // Wait before retry with exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        await this.sleep(delay);
      }
    }
  }
  
  /**
   * Sleep utility
   */
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Show progress updates
   */
  showProgress() {
    if (this.stats.totalProcessed % CONFIG.PROGRESS_INTERVAL === 0 || 
        this.stats.totalProcessed % CONFIG.STATS_INTERVAL === 0) {
      
      const elapsed = Date.now() - this.stats.startTime;
      const rate = this.stats.totalProcessed / (elapsed / 1000 / 60); // per minute
      const successRate = this.stats.totalProcessed > 0 ? 
        (this.stats.successful / this.stats.totalProcessed * 100).toFixed(1) : 0;
      
      console.log(`\n📊 Progress Update:`);
      console.log(`   Processed: ${this.stats.totalProcessed}/${this.stats.totalDiscovered}`);
      console.log(`   ✅ Successful: ${this.stats.successful}`);
      console.log(`   ❌ Failed: ${this.stats.failed}`);
      console.log(`   ⏭️ Skipped: ${this.stats.skipped}`);
      console.log(`   📈 Success rate: ${successRate}%`);
      console.log(`   ⚡ Rate: ${rate.toFixed(1)} datasets/min`);
      console.log(`   ⏱️ Elapsed: ${this.formatDuration(elapsed)}`);
      
      if (this.stats.totalDiscovered > this.stats.totalProcessed) {
        const remaining = this.stats.totalDiscovered - this.stats.totalProcessed;
        const eta = remaining / rate; // minutes
        console.log(`   🎯 ETA: ${this.formatDuration(eta * 60 * 1000)}`);
      }
    }
  }
  
  /**
   * Show final summary
   */
  showFinalSummary() {
    const elapsed = Date.now() - this.stats.startTime;
    const rate = this.stats.totalProcessed / (elapsed / 1000 / 60);
    const successRate = this.stats.totalProcessed > 0 ? 
      (this.stats.successful / this.stats.totalProcessed * 100).toFixed(1) : 0;
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 HUGGINGFACE DATASET SCRAPING COMPLETE');
    console.log('='.repeat(60));
    console.log(`📊 Final Statistics:`);
    console.log(`   🔍 Total discovered: ${this.stats.totalDiscovered}`);
    console.log(`   📝 Total processed: ${this.stats.totalProcessed}`);
    console.log(`   ✅ Successful ingestions: ${this.stats.successful}`);
    console.log(`   ❌ Failed ingestions: ${this.stats.failed}`);
    console.log(`   ⏭️ Skipped (existing): ${this.stats.skipped}`);
    console.log(`   📈 Success rate: ${successRate}%`);
    console.log(`   ⚡ Average rate: ${rate.toFixed(1)} datasets/min`);
    console.log(`   ⏱️ Total time: ${this.formatDuration(elapsed)}`);
    console.log(`   📦 Batches processed: ${this.stats.currentBatch}`);
    
    if (this.stats.errors.length > 0) {
      console.log(`\n❌ Errors encountered (${this.stats.errors.length}):`);
      this.stats.errors.slice(0, 10).forEach((error, idx) => {
        console.log(`   ${idx + 1}. ${error.dataset}: ${error.error}`);
      });
      if (this.stats.errors.length > 10) {
        console.log(`   ... and ${this.stats.errors.length - 10} more errors`);
      }
    }
    
    console.log(`\n🎯 Knowledge Base Impact:`);
    console.log(`   📚 Added ${this.stats.successful} new dataset entries`);
    console.log(`   🔍 Enhanced search and retrieval capabilities`);
    console.log(`   💾 All data stored in Supabase knowledge_base table`);
    console.log('\n✨ HuggingFace dataset scraping completed successfully!');
  }
  
  /**
   * Format duration in human-readable format
   */
  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
  
  /**
   * Main execution method
   */
  async run() {
    try {
      console.log('🚀 Starting HuggingFace dataset scraping process...\n');
      
      // Discover all datasets
      const datasets = await this.discoverAllDatasets();
      
      if (datasets.length === 0) {
        console.log('❌ No datasets discovered. Exiting.');
        return;
      }
      
      // Process all datasets
      await this.processAllDatasets(datasets);
      
    } catch (error) {
      console.error('\n💥 Scraping process failed:', error.message);
      console.error('Stack trace:', error.stack);
      process.exit(1);
    }
  }
}

// CLI argument parsing
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--help':
      case '-h':
        showHelp();
        process.exit(0);
        break;
      case '--limit':
        options.limit = parseInt(args[++i]);
        break;
      case '--batch-size':
        options.batchSize = parseInt(args[++i]);
        break;
      case '--delay':
        options.delay = parseInt(args[++i]);
        break;
      case '--skip-existing':
        options.skipExisting = true;
        break;
      case '--no-skip-existing':
        options.skipExisting = false;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--start-from':
        options.startFrom = args[++i];
        break;
      case '--filter':
        options.filter = args[++i];
        break;
      case '--author':
        options.author = args[++i];
        break;
      default:
        if (arg.startsWith('--')) {
          console.error(`❌ Unknown option: ${arg}`);
          process.exit(1);
        }
    }
  }
  
  return options;
}

function showHelp() {
  console.log(`
🤗 HuggingFace Dataset Comprehensive Scraper

This script discovers and ingests ALL datasets from HuggingFace Hub into the knowledge base.

Usage:
  node scripts/scrape-all-huggingface-datasets.js [options]

Options:
  --limit <number>        Limit total datasets to process (for testing)
  --batch-size <number>   Datasets per batch (default: 5)
  --delay <milliseconds>  Delay between batches (default: 3000)
  --skip-existing         Skip datasets already in knowledge base (default)
  --no-skip-existing      Process all datasets, even if they exist
  --dry-run              Show what would be done without ingesting
  --start-from <id>      Start from specific dataset ID (resume support)
  --filter <tags>        Filter by tags (e.g., "text-classification")
  --author <name>        Filter by author/organization
  --help, -h             Show this help message

Examples:
  # Scrape all datasets (recommended for production)
  node scripts/scrape-all-huggingface-datasets.js

  # Test with first 100 datasets only
  node scripts/scrape-all-huggingface-datasets.js --limit 100

  # Dry run to see what would be processed
  node scripts/scrape-all-huggingface-datasets.js --dry-run --limit 10

  # Resume from specific dataset
  node scripts/scrape-all-huggingface-datasets.js --start-from "some/dataset-id"

  # Filter by specific criteria
  node scripts/scrape-all-huggingface-datasets.js --filter "text-classification" --author "huggingface"

  # Faster processing for testing
  node scripts/scrape-all-huggingface-datasets.js --batch-size 10 --delay 1000

Environment Variables Required:
  SUPABASE_URL           - Supabase project URL
  SUPABASE_SERVICE_KEY   - Supabase service role key
  LOCAL_API_BASE         - Local API base URL (default: http://localhost:9999/api)

The script will:
✅ Discover ALL datasets from HuggingFace Hub API
✅ Process them in manageable batches with rate limiting
✅ Handle failures gracefully and continue processing
✅ Show real-time progress and detailed statistics
✅ Provide comprehensive summary on completion
✅ Store all dataset information in the knowledge base
`);
}

// Main execution
async function main() {
  try {
    const options = parseArgs();
    const scraper = new HuggingFaceDatasetScraper(options);
    await scraper.run();
  } catch (error) {
    console.error('💥 Script execution failed:', error.message);
    process.exit(1);
  }
}

// Handle process signals gracefully
process.on('SIGINT', () => {
  console.log('\n⏹️ Script interrupted by user. Exiting gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n⏹️ Script terminated. Exiting gracefully...');
  process.exit(0);
});

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { HuggingFaceDatasetScraper };