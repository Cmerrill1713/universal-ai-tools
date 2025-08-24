/**
 * Test script for HuggingFace knowledge ingestion using crawl4ai
 */

import { huggingFaceKnowledgeIngestion } from './src/services/huggingface-knowledge-ingestion.js';

async function testIngestion() {
  process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.log('🧪 Testing HuggingFace Knowledge Ingestion with crawl4ai\n');
  
  // Test 1: Ingest a popular model
  console.log('Test 1: Ingesting a single model (microsoft/DialoGPT-large)');
  const modelResult = await huggingFaceKnowledgeIngestion.ingestModel('microsoft/DialoGPT-large');
  console.log('Result:', modelResult.success ? '✅ Success' : '❌ Failed');
  if (modelResult.knowledge) {
    console.log('  - Name:', modelResult.knowledge.name);
    console.log('  - Description:', modelResult.knowledge.description?.substring(0, 100) + '...');
    console.log('  - Metadata:', Object.keys(modelResult.knowledge.metadata || {}));
    console.log('  - Chunks created:', modelResult.knowledge.chunks?.length || 0);
  }
  console.log();

  // Test 2: Ingest a dataset
  console.log('Test 2: Ingesting a dataset (squad)');
  const datasetResult = await huggingFaceKnowledgeIngestion.ingestDataset('squad');
  console.log('Result:', datasetResult.success ? '✅ Success' : '❌ Failed');
  if (datasetResult.knowledge) {
    console.log('  - Name:', datasetResult.knowledge.name);
    console.log('  - Type:', datasetResult.knowledge.type);
    console.log('  - Metadata:', Object.keys(datasetResult.knowledge.metadata || {}));
  }
  console.log();

  // Test 3: Batch ingestion
  console.log('Test 3: Batch ingestion of multiple items');
  const batchItems = [
    { id: 'gpt2', type: 'model' as const },
    { id: 'bert-base-uncased', type: 'model' as const },
    { id: 'imdb', type: 'dataset' as const }
  ];
  const batchResult = await huggingFaceKnowledgeIngestion.batchIngest(batchItems, {
    concurrency: 2,
    skipExisting: true
  });
  console.log(`Result: ${batchResult.successful} successful, ${batchResult.failed} failed`);
  console.log();

  // Test 4: Query ingested knowledge
  console.log('Test 4: Querying ingested knowledge');
  const queryResults = await huggingFaceKnowledgeIngestion.queryKnowledge('dialogue generation', {
    type: 'model',
    limit: 5
  });
  console.log(`Found ${queryResults.length} results`);
  queryResults.forEach((result: unknown) => {
    console.log(`  - ${result.title} (${result.category})`);
  });
  console.log();

  // Test 5: Ingest trending models
  console.log('Test 5: Ingesting trending models');
  const trendingResult = await huggingFaceKnowledgeIngestion.ingestTrending('models', 3);
  console.log('Result:', trendingResult.success ? '✅ Success' : '❌ Failed');
  if (trendingResult.successful) {
    console.log(`  - Ingested ${trendingResult.successful} trending models`);
  }
  console.log();

  console.log('✨ Testing complete!');
}

// Run the test
testIngestion().catch(console.error);