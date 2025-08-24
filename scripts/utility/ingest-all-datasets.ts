import React from 'react';
#!/usr/bin/env npx tsx
/**
 * Direct HuggingFace Dataset Ingestion Script
 * Discovers and ingests all HuggingFace datasets directly using the service
 */

import axios from 'axios';
import { huggingFaceKnowledgeIngestion } from './src/services/huggingface-knowledge-ingestion.js';
import { logger } from './src/utils/enhanced-logger.js';

interface HFDatasetInfo {
  id: string;
  downloads?: number;
  likes?: number;
  tags?: string[];
}

class DatasetIngester {
  private totalProcessed = 0;
  private successful = 0;
  private failed = 0;
  private startTime = Date.now();

  async discoverAllDatasets(limit?: number): Promise<HFDatasetInfo[]> {
    const datasets: HFDatasetInfo[] = [];
    let offset = 0;
    const batchSize = 100;
    
    process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.log('🔍 Discovering datasets from HuggingFace Hub...');
    
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
          break;
        }
        
        if (response.data.length < batchSize) {
          console.log('   Reached end of dataset list');
          break;
        }
        
        offset += batchSize;
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.error(`   Error fetching datasets at offset ${offset}:`, error.message);
        break;
      }
    }
    
    console.log(`\n✅ Discovered ${datasets.length} total datasets\n`);
    return datasets;
  }

  async ingestDatasets(datasets: HFDatasetInfo[], batchSize = 5, delay = 3000) {
    console.log(`🚀 Starting ingestion of ${datasets.length} datasets`);
    console.log(`   Batch size: ${batchSize}`);
    console.log(`   Delay between batches: ${delay}ms\n`);
    
    for (let i = 0; i < datasets.length; i += batchSize) {
      const batch = datasets.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      
      console.log(`\n📦 Processing batch ${batchNum} (${batch.length} datasets):`);
      
      const promises = batch.map(async (dataset, idx) => {
        const num = i + idx + 1;
        console.log(`   ${num}. ${dataset.id}`);
        
        try {
          const result = await huggingFaceKnowledgeIngestion.ingestDataset(dataset.id);
          
          if (result.success) {
            this.successful++;
            console.log(`      ✅ Success: ${dataset.id}`);
          } else {
            this.failed++;
            console.log(`      ❌ Failed: ${dataset.id} - ${result.error}`);
          }
        } catch (error) {
          this.failed++;
          console.log(`      ❌ Error: ${dataset.id} - ${error.message}`);
        }
        
        this.totalProcessed++;
      });
      
      await Promise.all(promises);
      
      // Progress update
      const elapsed = (Date.now() - this.startTime) / 1000;
      const rate = (this.totalProcessed / elapsed) * 60;
      const remaining = datasets.length - this.totalProcessed;
      const eta = remaining / (rate / 60);
      
      console.log(`\n📊 Progress: ${this.totalProcessed}/${datasets.length} (${Math.round(this.totalProcessed / datasets.length * 100)}%)`);
      console.log(`   ✅ Successful: ${this.successful}`);
      console.log(`   ❌ Failed: ${this.failed}`);
      console.log(`   ⚡ Rate: ${rate.toFixed(1)} datasets/min`);
      console.log(`   ⏱️ ETA: ${Math.round(eta / 60)} minutes`);
      
      // Wait before next batch (unless it's the last batch)
      if (i + batchSize < datasets.length) {
        console.log(`   ⏳ Waiting ${delay}ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    // Final summary
    const totalTime = (Date.now() - this.startTime) / 1000;
    console.log('\n' + '='.repeat(60));
    console.log('🎉 DATASET INGESTION COMPLETE');
    console.log('='.repeat(60));
    console.log(`📊 Final Statistics:`);
    console.log(`   📝 Total processed: ${this.totalProcessed}`);
    console.log(`   ✅ Successful: ${this.successful}`);
    console.log(`   ❌ Failed: ${this.failed}`);
    console.log(`   📈 Success rate: ${(this.successful / this.totalProcessed * 100).toFixed(1)}%`);
    console.log(`   ⏱️ Total time: ${Math.round(totalTime / 60)} minutes`);
    console.log(`   ⚡ Average rate: ${(this.totalProcessed / totalTime * 60).toFixed(1)} datasets/min`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const limit = args.includes('--limit') ? 
    parseInt(args[args.indexOf('--limit') + 1]) : 
    args.includes('--test') ? 100 : undefined;
  
  const batchSize = args.includes('--batch') ?
    parseInt(args[args.indexOf('--batch') + 1]) : 5;
    
  const delay = args.includes('--delay') ?
    parseInt(args[args.indexOf('--delay') + 1]) : 3000;
  
  console.log('🤗 HuggingFace Dataset Ingestion Tool');
  console.log('=====================================\n');
  
  if (args.includes('--help')) {
    console.log('Usage: npx tsx ingest-all-datasets.ts [options]');
    console.log('\nOptions:');
    console.log('  --test         Test mode (limit to 100 datasets)');
    console.log('  --limit <n>    Limit number of datasets to process');
    console.log('  --batch <n>    Batch size (default: 5)');
    console.log('  --delay <ms>   Delay between batches in ms (default: 3000)');
    console.log('  --help         Show this help message');
    process.exit(0);
  }
  
  const ingester = new DatasetIngester();
  
  try {
    // Discover datasets
    const datasets = await ingester.discoverAllDatasets(limit);
    
    if (datasets.length === 0) {
      console.log('❌ No datasets found to ingest');
      process.exit(1);
    }
    
    // Ask for confirmation if ingesting many datasets
    if (!args.includes('--yes') && datasets.length > 1000) {
      console.log(`\n⚠️  About to ingest ${datasets.length} datasets.`);
      console.log('This will take approximately', Math.round(datasets.length / 60), 'minutes.');
      console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    // Ingest datasets
    await ingester.ingestDatasets(datasets, batchSize, delay);
    
    console.log('\n✨ All done! Dataset knowledge base has been populated.');
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
main().catch(console.error);