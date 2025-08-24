import React from 'react';
#!/usr/bin/env npx tsx
/**
 * Ultra-Fast Parallel HuggingFace Dataset Scraper
 * 
 * Uses Promise.all with controlled concurrency for maximum speed and reliability.
 * No worker threads complexity - just pure parallel async processing.
 */

import axios from 'axios';
import { huggingFaceKnowledgeIngestion } from './src/services/huggingface-knowledge-ingestion.js';

interface HFDatasetInfo {
  id: string;
  downloads?: number;
  likes?: number;
  tags?: string[];
}

interface ProcessingResult {
  success: boolean;
  datasetId: string;
  error?: string;
  processingTime: number;
}

class FastParallelScraper {
  private totalProcessed = 0;
  private successful = 0;
  private failed = 0;
  private startTime = Date.now();
  private concurrencyLimit: number;

  constructor(concurrencyLimit = 50) {
    this.concurrencyLimit = concurrencyLimit;
    process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.log(`🚀 Fast parallel scraper initialized with ${concurrencyLimit} concurrent operations`);
  }

  async discoverAllDatasets(limit?: number): Promise<HFDatasetInfo[]> {
    const datasets: HFDatasetInfo[] = [];
    let offset = 0;
    const batchSize = 500;
    
    console.log('🔍 Rapidly discovering datasets from HuggingFace Hub...');
    
    // Discover multiple batches in parallel for speed
    const discoveryPromises: Promise<HFDatasetInfo[]>[] = [];
    
    // Create initial batch requests
    for (let i = 0; i < 10; i++) {
      const currentOffset = i * batchSize;
      discoveryPromises.push(this.fetchDatasetBatch(currentOffset, batchSize));
    }
    
    // Process discovery results
    const initialBatches = await Promise.all(discoveryPromises);
    
    for (const batch of initialBatches) {
      datasets.push(...batch);
      if (limit && datasets.length >= limit) {
        datasets.splice(limit); // Trim to exact limit
        break;
      }
    }
    
    console.log(`✅ Discovered ${datasets.length} datasets in parallel\n`);
    return datasets;
  }

  private async fetchDatasetBatch(offset: number, batchSize: number): Promise<HFDatasetInfo[]> {
    try {
      const url = `https://huggingface.co/api/datasets?limit=${batchSize}&offset=${offset}&full=true&sort=downloads&direction=-1`;
      
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Universal-AI-Tools/1.0'
        },
        timeout: 30000
      });
      
      return response.data || [];
    } catch (error) {
      process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.warn(`   Warning: Failed to fetch batch at offset ${offset}`);
      return [];
    }
  }

  private async processDataset(dataset: HFDatasetInfo): Promise<ProcessingResult> {
    const startTime = Date.now();
    
    try {
      const result = await huggingFaceKnowledgeIngestion.ingestDataset(dataset.id);
      
      const processingTime = Date.now() - startTime;
      
      if (result.success) {
        this.successful++;
        console.log(`✅ [${++this.totalProcessed}] ${dataset.id} (${processingTime}ms)`);
      } else {
        this.failed++;
        console.log(`❌ [${++this.totalProcessed}] ${dataset.id} - ${result.error} (${processingTime}ms)`);
      }
      
      return {
        success: result.success,
        datasetId: dataset.id,
        error: result.success ? undefined : result.error,
        processingTime
      };
    } catch (error) {
      this.failed++;
      const processingTime = Date.now() - startTime;
      console.log(`❌ [${++this.totalProcessed}] ${dataset.id} - ${error.message} (${processingTime}ms)`);
      
      return {
        success: false,
        datasetId: dataset.id,
        error: error.message,
        processingTime
      };
    }
  }

  private async processChunk(datasets: HFDatasetInfo[]): Promise<ProcessingResult[]> {
    const promises = datasets.map(dataset => this.processDataset(dataset));
    return Promise.all(promises);
  }

  async ingestDatasets(datasets: HFDatasetInfo[]) {
    console.log(`🚀 Starting ULTRA-FAST parallel ingestion of ${datasets.length} datasets`);
    console.log(`   Concurrency: ${this.concurrencyLimit} simultaneous operations`);
    console.log(`   Expected completion: ~${Math.ceil(datasets.length / this.concurrencyLimit)} minutes\n`);
    
    // Split datasets into chunks for controlled concurrency
    const chunks: HFDatasetInfo[][] = [];
    for (let i = 0; i < datasets.length; i += this.concurrencyLimit) {
      chunks.push(datasets.slice(i, i + this.concurrencyLimit));
    }
    
    console.log(`📦 Processing ${chunks.length} chunks of ${this.concurrencyLimit} datasets each\n`);
    
    // Progress tracking
    const progressInterval = setInterval(() => {
      this.showProgress(datasets.length);
    }, 15000); // Show progress every 15 seconds
    
    try {
      // Process chunks sequentially to maintain concurrency limit
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        console.log(`\n🔥 Processing chunk ${i + 1}/${chunks.length} (${chunk.length} datasets)...`);
        
        await this.processChunk(chunk);
        
        // Brief pause between chunks to avoid overwhelming the API
        if (i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      clearInterval(progressInterval);
      this.showFinalSummary(datasets.length);
      
    } catch (error) {
      clearInterval(progressInterval);
      process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.error('❌ Fatal error in parallel processing:', error);
      throw error;
    }
  }

  private showProgress(total: number) {
    const elapsed = (Date.now() - this.startTime) / 1000;
    const rate = (this.totalProcessed / elapsed) * 60;
    const remaining = total - this.totalProcessed;
    const eta = remaining / (rate / 60);
    
    console.log(`\n📊 ULTRA-FAST PROGRESS: ${this.totalProcessed}/${total} (${Math.round(this.totalProcessed / total * 100)}%)`);
    console.log(`   ✅ Successful: ${this.successful}`);
    console.log(`   ❌ Failed: ${this.failed}`);
    console.log(`   ⚡ Rate: ${rate.toFixed(1)} datasets/min`);
    console.log(`   ⏱️ ETA: ${Math.round(eta / 60)} minutes`);
  }

  private showFinalSummary(total: number) {
    const totalTime = (Date.now() - this.startTime) / 1000;
    console.log('\n' + '='.repeat(80));
    console.log('🎉 ULTRA-FAST PARALLEL DATASET INGESTION COMPLETE');
    console.log('='.repeat(80));
    console.log(`📊 Final Statistics:`);
    console.log(`   📝 Total processed: ${this.totalProcessed}`);
    console.log(`   ✅ Successful: ${this.successful}`);
    console.log(`   ❌ Failed: ${this.failed}`);
    console.log(`   📈 Success rate: ${(this.successful / this.totalProcessed * 100).toFixed(1)}%`);
    console.log(`   ⏱️ Total time: ${Math.round(totalTime / 60)} minutes (${totalTime.toFixed(1)}s)`);
    console.log(`   ⚡ Average rate: ${(this.totalProcessed / totalTime * 60).toFixed(1)} datasets/min`);
    console.log(`   🚀 Speedup: ~${this.concurrencyLimit}x faster than sequential`);
    console.log(`   🏆 Performance: ${(this.totalProcessed / totalTime).toFixed(1)} datasets/second`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const limit = args.includes('--limit') ? 
    parseInt(args[args.indexOf('--limit') + 1]) : 
    args.includes('--test') ? 500 : undefined;
  
  const concurrency = args.includes('--concurrency') ?
    parseInt(args[args.indexOf('--concurrency') + 1]) : 50;
    
  console.log('⚡ Ultra-Fast Parallel HuggingFace Dataset Scraper');
  console.log('=================================================\n');
  
  if (args.includes('--help')) {
    console.log('Usage: npx tsx fast-parallel-scraper.ts [options]');
    console.log('\nOptions:');
    console.log('  --test                Test mode (limit to 500 datasets)');
    console.log('  --limit <n>           Limit number of datasets to process');
    console.log('  --concurrency <n>     Number of concurrent operations (default: 50, max: 200)');
    console.log('  --help                Show this help message');
    console.log('\nExamples:');
    console.log('  npx tsx fast-parallel-scraper.ts --test');
    console.log('  npx tsx fast-parallel-scraper.ts --limit 1000 --concurrency 100');
    console.log('  npx tsx fast-parallel-scraper.ts --concurrency 200  # Maximum speed');
    process.exit(0);
  }
  
  const scraper = new FastParallelScraper(Math.min(concurrency, 200));
  
  try {
    // Discover datasets in parallel
    const datasets = await scraper.discoverAllDatasets(limit);
    
    if (datasets.length === 0) {
      console.log('❌ No datasets found to ingest');
      process.exit(1);
    }
    
    const estimatedMinutes = Math.ceil(datasets.length / concurrency);
    console.log(`🔥 About to process ${datasets.length} datasets with ${concurrency} concurrent operations`);
    console.log(`⚡ Estimated completion time: ~${estimatedMinutes} minutes\n`);
    
    // Start ultra-fast parallel ingestion
    await scraper.ingestDatasets(datasets);
    
    console.log('\n✨ Ultra-fast dataset scraping completed! Your knowledge base is now MASSIVE.');
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
main().catch(console.error);