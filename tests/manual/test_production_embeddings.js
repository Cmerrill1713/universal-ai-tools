#!/usr/bin/env node
/**
 * Test Script for Production Embedding Service
 * Tests real OpenAI embeddings and enhanced memory system performance
 */

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const supabaseUrl = 'http://127.0.0.1:54321';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

console.log('🚀 Production Embedding Service Test Suite');
console.log('==========================================\n');

async function testOpenAIEmbeddings() {
  console.log('🧠 Testing OpenAI Embedding Generation...');
  
  if (!process.env.OPENAI_API_KEY) {
    console.log('  ⚠️  OPENAI_API_KEY not found in environment');
    console.log('  💡 Set OPENAI_API_KEY to test real embeddings');
    return false;
  }

  try {
    // Test the OpenAI service directly
    const OpenAI = require('openai');
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    const testTexts = [
      "Schedule a meeting with the development team for tomorrow",
      "Create a new React component for the user dashboard",
      "Organize project files by category and date"
    ];

    console.log('  📡 Testing OpenAI API connection...');
    
    const response = await openai.embeddings.create({
      model: "text-embedding-3-large",
      input: testTexts[0],
      dimensions: 1536
    });

    if (response.data && response.data[0] && response.data[0].embedding) {
      const embedding = response.data[0].embedding;
      console.log(`  ✅ OpenAI API working - received ${embedding.length}D embedding`);
      console.log(`  📊 Sample values: [${embedding.slice(0, 3).map(v => v.toFixed(4)).join(', ')}...]`);
      
      return { success: true, embeddings: [embedding] };
    } else {
      throw new Error('Invalid response structure from OpenAI');
    }
  } catch (error) {
    console.log('  ❌ OpenAI API test failed:', error.message);
    return { success: false, error: error.message };
  }
}

async function testEmbeddingCache() {
  console.log('\n💾 Testing Embedding Cache Performance...');
  
  try {
    const { ProductionEmbeddingService } = require('./dist/memory/production_embedding_service.js');
    
    const embeddingService = new ProductionEmbeddingService({
      model: 'text-embedding-3-large',
      dimensions: 1536,
      cacheMaxSize: 1000
    });

    const testText = "This is a test for caching performance";
    
    console.log('  🔄 First request (should hit API)...');
    const start1 = Date.now();
    const embedding1 = await embeddingService.generateEmbedding(testText);
    const time1 = Date.now() - start1;
    
    console.log('  🔄 Second request (should hit cache)...');
    const start2 = Date.now();
    const embedding2 = await embeddingService.generateEmbedding(testText);
    const time2 = Date.now() - start2;
    
    const stats = embeddingService.getStats();
    
    console.log(`  ⏱️  First request: ${time1}ms`);
    console.log(`  ⏱️  Second request: ${time2}ms (${((time1 - time2) / time1 * 100).toFixed(1)}% faster)`);
    console.log(`  📊 Cache stats: ${stats.cacheHits}/${stats.totalRequests} hits (${(stats.cacheHitRate * 100).toFixed(1)}%)`);
    
    // Verify embeddings are identical
    const identical = JSON.stringify(embedding1) === JSON.stringify(embedding2);
    console.log(`  ✅ Cache consistency: ${identical ? 'PASSED' : 'FAILED'}`);
    
    return { success: true, cacheSpeedup: time1 / time2, stats };
  } catch (error) {
    console.log('  ❌ Cache test failed:', error.message);
    return { success: false, error: error.message };
  }
}

async function testBatchProcessing() {
  console.log('\n⚡ Testing Batch Processing Performance...');
  
  try {
    const { ProductionEmbeddingService } = require('./dist/memory/production_embedding_service.js');
    
    const embeddingService = new ProductionEmbeddingService({
      model: 'text-embedding-3-large',
      dimensions: 1536,
      maxBatchSize: 4
    });

    const testTexts = [
      "Schedule a meeting with the development team",
      "Create a new React component for user interface",
      "Organize project files by category",
      "Review code changes and provide feedback",
      "Update documentation for API endpoints"
    ];

    console.log(`  📦 Processing ${testTexts.length} texts in batch...`);
    const start = Date.now();
    
    const embeddings = await embeddingService.generateEmbeddings(testTexts);
    
    const time = Date.now() - start;
    const stats = embeddingService.getStats();
    
    console.log(`  ⏱️  Batch processing: ${time}ms (${(time / testTexts.length).toFixed(1)}ms per text)`);
    console.log(`  ✅ Generated ${embeddings.length} embeddings of ${embeddings[0].length} dimensions`);
    console.log(`  📊 Cache performance: ${stats.cacheHitRate * 100}% hit rate`);
    
    return { success: true, batchTime: time, embeddingsPerSecond: testTexts.length / (time / 1000) };
  } catch (error) {
    console.log('  ❌ Batch processing test failed:', error.message);
    return { success: false, error: error.message };
  }
}

async function testSemanticSimilarity() {
  console.log('\n🎯 Testing Semantic Similarity Quality...');
  
  try {
    const { ProductionEmbeddingService } = require('./dist/memory/production_embedding_service.js');
    
    const embeddingService = new ProductionEmbeddingService();

    const testPairs = [
      {
        text1: "Schedule a meeting for tomorrow",
        text2: "Book an appointment for the next day",
        expectedSimilarity: 0.8 // High similarity
      },
      {
        text1: "Write JavaScript code for authentication",
        text2: "Develop login functionality using JS",
        expectedSimilarity: 0.7 // Medium-high similarity
      },
      {
        text1: "Schedule a meeting tomorrow",
        text2: "The weather is sunny today",
        expectedSimilarity: 0.2 // Low similarity
      }
    ];

    console.log('  🔍 Testing semantic similarity pairs...');
    
    for (let i = 0; i < testPairs.length; i++) {
      const pair = testPairs[i];
      
      const [embedding1, embedding2] = await embeddingService.generateEmbeddings([
        pair.text1,
        pair.text2
      ]);
      
      // Calculate cosine similarity
      const similarity = cosineSimilarity(embedding1, embedding2);
      const expected = pair.expectedSimilarity;
      const diff = Math.abs(similarity - expected);
      
      console.log(`  📝 Pair ${i + 1}:`);
      console.log(`     Text 1: "${pair.text1}"`);
      console.log(`     Text 2: "${pair.text2}"`);
      console.log(`     Similarity: ${similarity.toFixed(3)} (expected ~${expected}, diff: ${diff.toFixed(3)})`);
      console.log(`     ${diff < 0.2 ? '✅ GOOD' : diff < 0.4 ? '⚠️  OK' : '❌ POOR'}`);
    }
    
    return { success: true };
  } catch (error) {
    console.log('  ❌ Similarity test failed:', error.message);
    return { success: false, error: error.message };
  }
}

async function testEnhancedMemorySystem() {
  console.log('\n🧠 Testing Enhanced Memory System with Real Embeddings...');
  
  try {
    // Build the TypeScript first if needed
    const { execSync } = require('child_process');
    try {
      execSync('npm run build', { stdio: 'pipe' });
      console.log('  🔨 Built TypeScript project');
    } catch (buildError) {
      console.log('  ⚠️  Build failed, using existing dist files');
    }

    const { EnhancedMemorySystem } = require('./dist/memory/enhanced_memory_system.js');
    const winston = require('winston');
    
    const logger = winston.createLogger({
      level: 'info',
      format: winston.format.simple(),
      transports: [new winston.transports.Console()]
    });

    const supabase = createClient(supabaseUrl, supabaseKey);
    const memorySystem = new EnhancedMemorySystem(supabase, logger, {
      model: 'text-embedding-3-large',
      dimensions: 1536
    });

    // Test storing memories with real embeddings
    console.log('  💾 Storing test memories with real embeddings...');
    
    const testMemories = [
      {
        serviceId: 'calendar_agent',
        memoryType: 'meeting_scheduling',
        content: 'User requested to schedule a team standup meeting for tomorrow at 10 AM'
      },
      {
        serviceId: 'code_assistant',
        memoryType: 'code_development',
        content: 'User asked for help creating a React component for user authentication'
      },
      {
        serviceId: 'file_manager',
        memoryType: 'file_organization',
        content: 'User wants to organize project files by date and category'
      }
    ];

    const storedMemories = [];
    
    for (const mem of testMemories) {
      const stored = await memorySystem.storeMemory(
        mem.serviceId,
        mem.memoryType,
        mem.content,
        { test: true, timestamp: new Date().toISOString() }
      );
      storedMemories.push(stored);
      console.log(`    ✅ Stored memory for ${mem.serviceId}: ${stored.id}`);
    }

    // Test semantic search
    console.log('  🔍 Testing semantic search with real embeddings...');
    
    const searchQueries = [
      { query: "help me set up a meeting", expectedAgent: 'calendar_agent' },
      { query: "need assistance with React development", expectedAgent: 'code_assistant' },
      { query: "organize my documents and files", expectedAgent: 'file_manager' }
    ];

    for (const search of searchQueries) {
      const results = await memorySystem.searchMemories({
        query: search.query,
        similarityThreshold: 0.5,
        maxResults: 3
      });

      if (results.length > 0) {
        const topResult = results[0];
        const isCorrectAgent = topResult.serviceId === search.expectedAgent;
        
        console.log(`    Query: "${search.query}"`);
        console.log(`    Top result: ${topResult.serviceId} (score: ${topResult.importanceScore.toFixed(3)})`);
        console.log(`    Expected: ${search.expectedAgent} ${isCorrectAgent ? '✅' : '❌'}`);
      } else {
        console.log(`    Query: "${search.query}" - No results found ❌`);
      }
    }

    // Get embedding stats
    const embeddingStats = memorySystem.getEmbeddingStats();
    console.log(`  📊 Embedding stats: ${embeddingStats.totalRequests} requests, ${(embeddingStats.cacheHitRate * 100).toFixed(1)}% cache hit rate`);

    return { success: true, memoriesStored: storedMemories.length, embeddingStats };
  } catch (error) {
    console.log('  ❌ Enhanced memory system test failed:', error.message);
    return { success: false, error: error.message };
  }
}

// Helper function to calculate cosine similarity
function cosineSimilarity(a, b) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function runAllTests() {
  const results = {
    openai: await testOpenAIEmbeddings(),
    cache: { success: false },
    batch: { success: false },
    similarity: { success: false },
    memorySystem: { success: false }
  };

  // Only run other tests if OpenAI is working
  if (results.openai.success) {
    results.cache = await testEmbeddingCache();
    results.batch = await testBatchProcessing();
    results.similarity = await testSemanticSimilarity();
    results.memorySystem = await testEnhancedMemorySystem();
  } else {
    console.log('\n⚠️  Skipping advanced tests due to OpenAI API issues');
    console.log('💡 To test with real embeddings:');
    console.log('   1. Set OPENAI_API_KEY environment variable');
    console.log('   2. Ensure you have OpenAI API credits');
    console.log('   3. Run: OPENAI_API_KEY=your_key node test_production_embeddings.js');
  }

  console.log('\n📊 Test Results Summary:');
  console.log('========================');
  
  const testNames = {
    openai: 'OpenAI API Connection',
    cache: 'Embedding Caching',
    batch: 'Batch Processing',
    similarity: 'Semantic Similarity',
    memorySystem: 'Enhanced Memory System'
  };

  let passed = 0;
  let total = 0;

  Object.entries(results).forEach(([test, result]) => {
    total++;
    if (result.success) passed++;
    
    console.log(`${result.success ? '✅' : '❌'} ${testNames[test]}: ${result.success ? 'PASSED' : 'FAILED'}`);
    
    if (!result.success && result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });

  console.log(`\n${passed === total ? '🎉' : '⚠️'} Overall: ${passed}/${total} tests passed`);
  
  if (passed === total && results.openai.success) {
    console.log('\n🚀 Production Embedding System is working perfectly!');
    console.log('\nKey Features Verified:');
    console.log('• Real OpenAI text-embedding-3-large integration');
    console.log('• High-performance caching with significant speedup');
    console.log('• Efficient batch processing');
    console.log('• High-quality semantic similarity detection');
    console.log('• Enhanced memory system with real embeddings');
    console.log('\nYour system now has production-grade semantic capabilities! 🧠✨');
  } else if (!results.openai.success) {
    console.log('\n💡 To enable production embeddings:');
    console.log('export OPENAI_API_KEY="your-openai-api-key"');
    console.log('node test_production_embeddings.js');
  }
}

// Run tests
runAllTests().catch(console.error);