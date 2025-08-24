import React from 'react';
#!/usr/bin/env npx tsx
/**
 * Massively Parallel HuggingFace Dataset Scraper
 * 
 * Uses worker threads and concurrent processing to dramatically speed up dataset ingestion.
 * Can process hundreds of datasets simultaneously with intelligent rate limiting.
 */

import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { cpus } from 'os';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import axios from 'axios';
import { huggingFaceKnowledgeIngestion } from './src/services/huggingface-knowledge-ingestion.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface HFDatasetInfo {
  id: string;
  downloads?: number;
  likes?: number;
  tags?: string[];
}

interface WorkerResult {
  success: boolean;
  datasetId: string;
  error?: string;
  processingTime: number;
}

class ParallelDatasetScraper {
  private totalProcessed = 0;
  private successful = 0;
  private failed = 0;
  private startTime = Date.now();
  private workers: Worker[] = [];
  private maxWorkers: number;
  private workQueue: HFDatasetInfo[] = [];
  private processing = new Set<string>();
  private completed = new Set<string>();

  constructor(maxWorkers?: number) {
    // Use all CPU cores but cap at 50 for rate limiting
    this.maxWorkers = Math.min(maxWorkers || cpus().length * 4, 50);
    process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.log(`🚀 Initializing parallel scraper with ${this.maxWorkers} workers`);
  }

  async discoverAllDatasets(limit?: number): Promise<HFDatasetInfo[]> {
    const datasets: HFDatasetInfo[] = [];
    let offset = 0;
    const batchSize = 500; // Larger batches for discovery
    
    console.log('🔍 Discovering datasets from HuggingFace Hub...');
    
    while (true) {
      try {
        const url = `https://huggingface.co/api/datasets?limit=${batchSize}&offset=${offset}&full=true&sort=downloads&direction=-1`;
        console.log(`   Fetching batch at offset ${offset}...`);
        
        const response = await axios.get(url, {
          headers: {
            'User-Agent': 'Universal-AI-Tools/1.0'
          },
          timeout: 30000
        });
        
        if (!response.data || response.data.length === 0) {
          console.log('   No more datasets found.');
          break;
        }
        
        datasets.push(...response.data);
        console.log(`   Found ${response.data.length} datasets (total: ${datasets.length})`);
        
        if (limit && datasets.length >= limit) {
          console.log(`   Reached limit of ${limit} datasets`);
          datasets.splice(limit); // Trim to exact limit
          break;
        }
        
        if (response.data.length < batchSize) {
          console.log('   Reached end of dataset list');
          break;
        }
        
        offset += batchSize;
        
        // Minimal rate limiting for discovery
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.error(`   Error fetching datasets at offset ${offset}:`, error.message);
        break;
      }
    }
    
    console.log(`\n✅ Discovered ${datasets.length} total datasets\n`);
    return datasets;
  }

  private createWorker(): Worker {
    return new Worker(__filename, {
      workerData: { isWorker: true }
    });
  }

  private async processDataset(dataset: HFDatasetInfo): Promise<WorkerResult> {
    const startTime = Date.now();
    
    try {
      const result = await huggingFaceKnowledgeIngestion.ingestDataset(dataset.id);
      
      return {
        success: result.success,
        datasetId: dataset.id,
        error: result.success ? undefined : result.error,
        processingTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        datasetId: dataset.id,
        error: error.message,
        processingTime: Date.now() - startTime
      };
    }
  }

  async ingestDatasets(datasets: HFDatasetInfo[]) {
    console.log(`🚀 Starting PARALLEL ingestion of ${datasets.length} datasets`);
    console.log(`   Workers: ${this.maxWorkers}`);
    console.log(`   Expected completion: ~${Math.ceil(datasets.length / this.maxWorkers)} minutes\n`);
    
    this.workQueue = [...datasets];
    const progressInterval = setInterval(() => this.showProgress(datasets.length), 10000);
    
    try {
      // Create worker pool
      const workers = Array.from({ length: this.maxWorkers }, () => this.createWorker());
      
      // Process work queue
      const promises = workers.map(worker => this.runWorker(worker));
      
      // Wait for all workers to complete
      await Promise.all(promises);
      
      // Cleanup
      workers.forEach(worker => worker.terminate());
      clearInterval(progressInterval);
      
      // Final summary
      this.showFinalSummary(datasets.length);
      
    } catch (error) {
      clearInterval(progressInterval);
      console.error('❌ Fatal error in parallel processing:', error);
      throw error;
    }
  }

  private async runWorker(worker: Worker): Promise<void> {
    return new Promise((resolve, reject) => {
      worker.on('message', (result: WorkerResult) => {
        this.handleWorkerResult(result);
        
        // Send next dataset to worker
        const nextDataset = this.workQueue.shift();
        if (nextDataset) {
          worker.postMessage(nextDataset);
        } else {
          // No more work, terminate worker
          worker.terminate();
          resolve();
        }
      });
      
      worker.on('error', (error) => {
        console.error('Worker error:', error);
        reject(error);
      });
      
      worker.on('exit', (code) => {
        if (code !== 0) {
          console.error(`Worker stopped with exit code ${code}`);
        }
        resolve();
      });
      
      // Send initial dataset to worker
      const initialDataset = this.workQueue.shift();
      if (initialDataset) {
        worker.postMessage(initialDataset);
      } else {
        worker.terminate();
        resolve();
      }
    });
  }

  private handleWorkerResult(result: WorkerResult) {
    this.processing.delete(result.datasetId);
    this.completed.add(result.datasetId);
    this.totalProcessed++;
    
    if (result.success) {
      this.successful++;
      console.log(`✅ [${this.totalProcessed}] ${result.datasetId} (${result.processingTime}ms)`);
    } else {
      this.failed++;
      console.log(`❌ [${this.totalProcessed}] ${result.datasetId} - ${result.error} (${result.processingTime}ms)`);
    }
  }

  private showProgress(total: number) {
    const elapsed = (Date.now() - this.startTime) / 1000;
    const rate = (this.totalProcessed / elapsed) * 60;
    const remaining = total - this.totalProcessed;
    const eta = remaining / (rate / 60);
    const activeWorkers = this.processing.size;
    
    console.log(`\n📊 PARALLEL PROGRESS: ${this.totalProcessed}/${total} (${Math.round(this.totalProcessed / total * 100)}%)`);
    console.log(`   ✅ Successful: ${this.successful}`);
    console.log(`   ❌ Failed: ${this.failed}`);
    console.log(`   🔄 Active workers: ${activeWorkers}/${this.maxWorkers}`);
    console.log(`   ⚡ Rate: ${rate.toFixed(1)} datasets/min`);
    console.log(`   ⏱️ ETA: ${Math.round(eta / 60)} minutes`);
    console.log(`   🏃 Queue remaining: ${this.workQueue.length}`);
  }

  private showFinalSummary(total: number) {
    const totalTime = (Date.now() - this.startTime) / 1000;
    console.log('\n' + '='.repeat(80));
    console.log('🎉 PARALLEL DATASET INGESTION COMPLETE');
    console.log('='.repeat(80));
    console.log(`📊 Final Statistics:`);
    console.log(`   📝 Total processed: ${this.totalProcessed}`);
    console.log(`   ✅ Successful: ${this.successful}`);
    console.log(`   ❌ Failed: ${this.failed}`);
    console.log(`   📈 Success rate: ${(this.successful / this.totalProcessed * 100).toFixed(1)}%`);
    console.log(`   ⏱️ Total time: ${Math.round(totalTime / 60)} minutes (${totalTime.toFixed(1)}s)`);
    console.log(`   ⚡ Average rate: ${(this.totalProcessed / totalTime * 60).toFixed(1)} datasets/min`);
    console.log(`   🚀 Speedup: ~${Math.round(this.maxWorkers)}x faster than sequential`);
  }
}

// Worker thread code
if (!isMainThread) {
  parentPort?.on('message', async (dataset: HFDatasetInfo) => {
    const startTime = Date.now();
    
    try {
      const result = await huggingFaceKnowledgeIngestion.ingestDataset(dataset.id);
      
      parentPort?.postMessage({
        success: result.success,
        datasetId: dataset.id,
        error: result.success ? undefined : result.error,
        processingTime: Date.now() - startTime
      });
    } catch (error) {
      parentPort?.postMessage({
        success: false,
        datasetId: dataset.id,
        error: error.message,
        processingTime: Date.now() - startTime
      });
    }
  });
}

// Main thread execution
async function main() {
  if (!isMainThread) return; // Skip main execution in worker threads
  
  const args = process.argv.slice(2);
  const limit = args.includes('--limit') ? 
    parseInt(args[args.indexOf('--limit') + 1]) : 
    args.includes('--test') ? 1000 : undefined;
  
  const workers = args.includes('--workers') ?
    parseInt(args[args.indexOf('--workers') + 1]) : undefined;
    
  console.log('🚀 Massively Parallel HuggingFace Dataset Scraper');
  console.log('================================================\n');
  
  if (args.includes('--help')) {
    console.log('Usage: npx tsx parallel-dataset-scraper.ts [options]');
    console.log('\nOptions:');
    console.log('  --test           Test mode (limit to 1,000 datasets)');
    console.log('  --limit <n>      Limit number of datasets to process');
    console.log('  --workers <n>    Number of parallel workers (default: CPU cores * 4, max 50)');
    console.log('  --help           Show this help message');
    process.exit(0);
  }
  
  const scraper = new ParallelDatasetScraper(workers);
  
  try {
    // Discover datasets
    const datasets = await scraper.discoverAllDatasets(limit);
    
    if (datasets.length === 0) {
      console.log('❌ No datasets found to ingest');
      process.exit(1);
    }
    
    console.log(`\n🔥 About to process ${datasets.length} datasets in PARALLEL`);
    console.log(`Expected completion time: ~${Math.ceil(datasets.length / (workers || 20))} minutes\n`);
    
    // Start parallel ingestion
    await scraper.ingestDatasets(datasets);
    
    console.log('\n✨ Parallel dataset scraping completed! Your knowledge base is now MASSIVE.');
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
main().catch(console.error);