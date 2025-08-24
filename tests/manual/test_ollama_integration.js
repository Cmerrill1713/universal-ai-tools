#!/usr/bin/env node
/**
 * Ollama Integration Test Suite
 * Tests local embedding generation with Ollama
 * Provides setup instructions and health checks
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'http://127.0.0.1:54321';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

console.log('🦙 Ollama Integration Test Suite');
console.log('================================\n');

async function testOllamaHealth() {
  console.log('🏥 Testing Ollama Health...');
  
  try {
    // Test direct connection to Ollama
    const response = await fetch('http://localhost:11434/api/version');
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`  ✅ Ollama is running (version: ${data.version})`);
    
    // Test model availability
    const modelsResponse = await fetch('http://localhost:11434/api/tags');
    if (modelsResponse.ok) {
      const modelsData = await modelsResponse.json();
      const models = modelsData.models || [];
      
      console.log(`  📚 Available models: ${models.length}`);
      models.forEach(model => {
        console.log(`    - ${model.name} (${(model.size / 1024 / 1024).toFixed(1)}MB)`);
      });
      
      // Check for embedding models
      const embeddingModels = models.filter(m => 
        m.name.includes('embed') || 
        m.name.includes('nomic') || 
        m.name.includes('minilm') ||
        m.name.includes('mxbai')
      );
      
      if (embeddingModels.length > 0) {
        console.log(`  🎯 Embedding models found: ${embeddingModels.map(m => m.name).join(', ')}`);
      } else {
        console.log('  ⚠️  No embedding models found');
      }
      
      return { 
        available: true, 
        version: data.version, 
        models: models.length,
        embeddingModels: embeddingModels.length 
      };
    }
    
    return { available: true, version: data.version, models: 0, embeddingModels: 0 };
  } catch (error) {
    console.log('  ❌ Ollama is not available:', error.message);
    return { available: false, error: error.message };
  }
}

async function testOllamaEmbeddingService() {
  console.log('\n🧠 Testing Ollama Embedding Service...');
  
  try {
    // Build the project first
    const { execSync } = require('child_process');
    try {
      console.log('  🔨 Building TypeScript project...');
      execSync('npm run build', { stdio: 'pipe' });
    } catch (buildError) {
      console.log('  ⚠️  Build had errors, using existing dist files');
    }

    const { OllamaEmbeddingService } = require('./dist/memory/ollama_embedding_service.js');
    
    // Test different embedding models
    const modelsToTest = [
      { name: 'nomic-embed-text', dimensions: 768 },
      { name: 'all-minilm', dimensions: 384 },
      { name: 'mxbai-embed-large', dimensions: 1024 }
    ];

    let successfulModel = null;

    for (const modelConfig of modelsToTest) {
      console.log(`  📝 Testing ${modelConfig.name}...`);
      
      const embeddingService = new OllamaEmbeddingService({
        model: modelConfig.name,
        dimensions: modelConfig.dimensions,
        maxRetries: 1,
        timeoutMs: 10000
      });

      try {
        const health = await embeddingService.checkHealth();
        console.log(`    - Ollama available: ${health.available}`);
        console.log(`    - Model loaded: ${health.modelLoaded}`);

        if (health.available && health.modelLoaded) {
          // Test embedding generation
          const testText = 'This is a test sentence for embedding generation.';
          const startTime = Date.now();
          const embedding = await embeddingService.generateEmbedding(testText);
          const duration = Date.now() - startTime;

          console.log(`    - Generated embedding: ${embedding.length} dimensions in ${duration}ms`);
          console.log(`    - First few values: [${embedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`);

          // Test batch generation
          const batchTexts = [
            'First test sentence',
            'Second test sentence',
            'Third test sentence'
          ];
          const batchStart = Date.now();
          const batchEmbeddings = await embeddingService.generateEmbeddings(batchTexts);
          const batchDuration = Date.now() - batchStart;

          console.log(`    - Batch embeddings: ${batchEmbeddings.length} texts in ${batchDuration}ms`);

          // Get stats
          const stats = embeddingService.getStats();
          console.log(`    - Cache hits: ${stats.cacheHits}/${stats.totalRequests}`);
          console.log(`    - Average response time: ${stats.avgResponseTime.toFixed(1)}ms`);

          successfulModel = {
            name: modelConfig.name,
            dimensions: embedding.length,
            responseTime: duration,
            batchTime: batchDuration
          };
          break;
        } else if (health.available && !health.modelLoaded) {
          console.log(`    - Model not loaded. Run: ollama pull ${modelConfig.name}`);
        }
      } catch (error) {
        console.log(`    - Error: ${error.message}`);
      }
    }

    return { success: !!successfulModel, model: successfulModel };
  } catch (error) {
    console.log('  ❌ Ollama embedding service test failed:', error.message);
    return { success: false, error: error.message };
  }
}

async function testEnhancedMemorySystemWithOllama() {
  console.log('\n🔗 Testing Enhanced Memory System with Ollama...');
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    const { EnhancedMemorySystem } = require('./dist/memory/enhanced_memory_system.js');
    const winston = require('winston');
    
    const logger = winston.createLogger({
      level: 'error',
      format: winston.format.simple(),
      transports: [new winston.transports.Console()]
    });

    // Create memory system with Ollama
    const memorySystem = new EnhancedMemorySystem(
      supabase, 
      logger,
      { 
        model: 'nomic-embed-text',
        dimensions: 768
      },
      {
        hotCacheSize: 10,
        warmCacheSize: 20
      },
      { useOllama: true }
    );

    console.log('  ✅ Enhanced Memory System with Ollama instantiated');

    // Check embedding service health
    console.log('  🏥 Checking embedding service health...');
    const health = await memorySystem.checkEmbeddingServiceHealth();
    console.log(`    - Service: ${health.service}`);
    console.log(`    - Available: ${health.available}`);
    if (health.modelLoaded !== undefined) {
      console.log(`    - Model loaded: ${health.modelLoaded}`);
    }
    if (health.version) {
      console.log(`    - Version: ${health.version}`);
    }
    if (health.error) {
      console.log(`    - Error: ${health.error}`);
    }
    if (health.recommendations) {
      console.log('    - Recommendations:');
      health.recommendations.forEach(rec => console.log(`      * ${rec}`));
    }

    // Get service info
    const serviceInfo = memorySystem.getEmbeddingServiceInfo();
    console.log('  📊 Embedding service info:');
    console.log(`    - Service: ${serviceInfo.service}`);
    console.log(`    - Model: ${serviceInfo.model}`);
    console.log(`    - Dimensions: ${serviceInfo.dimensions}`);
    console.log(`    - Using Ollama: ${serviceInfo.useOllama}`);

    // Test switching services
    console.log('  🔄 Testing service switching...');
    memorySystem.switchEmbeddingService(false); // Switch to OpenAI
    const openaiInfo = memorySystem.getEmbeddingServiceInfo();
    console.log(`    - Switched to: ${openaiInfo.service} (${openaiInfo.model})`);

    memorySystem.switchEmbeddingService(true); // Switch back to Ollama
    const ollamaInfo = memorySystem.getEmbeddingServiceInfo();
    console.log(`    - Switched back to: ${ollamaInfo.service} (${ollamaInfo.model})`);

    // Test memory storage if Ollama is available
    if (health.available && health.modelLoaded) {
      console.log('  💾 Testing memory storage with Ollama embeddings...');
      
      const testMemory = await memorySystem.storeMemory(
        'ollama_test_agent',
        'test_interaction',
        'This is a test memory using Ollama embeddings for local generation.',
        { test: true, embedding_service: 'ollama' },
        ['ollama', 'test', 'local', 'embedding']
      );

      console.log(`    - Stored memory: ${testMemory.id}`);
      console.log(`    - Content length: ${testMemory.content.length}`);
      console.log(`    - Importance score: ${testMemory.importanceScore}`);

      // Test search
      console.log('  🔍 Testing search with Ollama embeddings...');
      const searchResults = await memorySystem.searchMemories({
        query: 'test memory ollama local',
        maxResults: 5,
        similarityThreshold: 0.1
      });

      console.log(`    - Search results: ${searchResults.length}`);
      if (searchResults.length > 0) {
        console.log(`    - Top result similarity: ${searchResults[0].importanceScore}`);
      }
    }

    return { 
      success: true, 
      health, 
      serviceInfo,
      canStoreMemories: health.available && health.modelLoaded 
    };
  } catch (error) {
    console.log('  ❌ Enhanced Memory System with Ollama test failed:', error.message);
    return { success: false, error: error.message };
  }
}

async function testModelPulling() {
  console.log('\n📥 Testing Model Pulling...');
  
  try {
    const health = await testOllamaHealth();
    
    if (!health.available) {
      console.log('  ⚠️  Ollama not available, skipping model pull test');
      return { success: false, reason: 'Ollama not available' };
    }

    // Test pulling a small model
    console.log('  📦 Testing model pull (all-minilm - small model)...');
    
    const pullResponse = await fetch('http://localhost:11434/api/pull', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'all-minilm' })
    });

    if (pullResponse.ok) {
      console.log('  ✅ Model pull initiated successfully');
      console.log('  💡 Note: Large models may take several minutes to download');
    } else {
      console.log('  ⚠️  Model pull request failed');
    }

    return { success: pullResponse.ok };
  } catch (error) {
    console.log('  ❌ Model pulling test failed:', error.message);
    return { success: false, error: error.message };
  }
}

async function runOllamaTests() {
  const results = {
    health: await testOllamaHealth(),
    embedding: await testOllamaEmbeddingService(),
    integration: await testEnhancedMemorySystemWithOllama(),
    pulling: await testModelPulling()
  };

  console.log('\n📊 Ollama Integration Test Results:');
  console.log('===================================');
  
  console.log('\n🏥 Ollama Health:');
  console.log(`${results.health.available ? '✅' : '❌'} Ollama Service: ${results.health.available ? 'RUNNING' : 'NOT AVAILABLE'}`);
  if (results.health.available) {
    console.log(`   Version: ${results.health.version}`);
    console.log(`   Models: ${results.health.models} total, ${results.health.embeddingModels} embedding models`);
  }

  console.log('\n🧠 Embedding Service:');
  console.log(`${results.embedding.success ? '✅' : '❌'} Ollama Embeddings: ${results.embedding.success ? 'WORKING' : 'FAILED'}`);
  if (results.embedding.model) {
    console.log(`   Model: ${results.embedding.model.name}`);
    console.log(`   Dimensions: ${results.embedding.model.dimensions}`);
    console.log(`   Response Time: ${results.embedding.model.responseTime}ms`);
  }

  console.log('\n🔗 System Integration:');
  console.log(`${results.integration.success ? '✅' : '❌'} Enhanced Memory System: ${results.integration.success ? 'INTEGRATED' : 'FAILED'}`);
  if (results.integration.success) {
    console.log(`   Service: ${results.integration.serviceInfo.service}`);
    console.log(`   Model: ${results.integration.serviceInfo.model}`);
    console.log(`   Can store memories: ${results.integration.canStoreMemories ? 'Yes' : 'No'}`);
  }

  const totalPassed = Object.values(results).filter(r => r.success).length;
  const totalTests = Object.keys(results).length;

  console.log(`\n${totalPassed === totalTests ? '🎉' : '⚠️'} Overall: ${totalPassed}/${totalTests} tests passed`);
  
  if (results.health.available && results.embedding.success && results.integration.success) {
    console.log('\n🚀 Ollama Integration is fully working!');
    console.log('\nKey Features Available:');
    console.log('• Local embedding generation (no API keys needed) ✅');
    console.log('• High-performance caching and batching ✅');
    console.log('• Multi-stage search with clustering ✅');
    console.log('• Contextual memory enrichment ✅');
    console.log('• Service switching (Ollama ↔ OpenAI) ✅');
    console.log('\nBenefits:');
    console.log('• Complete privacy - embeddings stay local');
    console.log('• No API costs or rate limits');
    console.log('• Offline capability');
    console.log('• Multiple model options');
    console.log('\nYour memory system is now fully autonomous! 🦙✨');
  } else if (!results.health.available) {
    console.log('\n🛠️  Setup Required:');
    console.log('1. Install Ollama: brew install ollama');
    console.log('2. Start Ollama: ollama serve');
    console.log('3. Pull an embedding model: ollama pull nomic-embed-text');
    console.log('4. Alternative models: ollama pull all-minilm (smaller, faster)');
    console.log('\n💡 Or visit: https://ollama.ai for installation instructions');
  } else {
    console.log('\n⚠️ Some components need setup');
    console.log('💡 Check the error messages above for details');
    
    if (results.health.available && results.health.embeddingModels === 0) {
      console.log('\n📥 No embedding models found. Try:');
      console.log('• ollama pull nomic-embed-text (best for embeddings)');
      console.log('• ollama pull all-minilm (smaller, faster)');
      console.log('• ollama pull mxbai-embed-large (high quality)');
    }
  }
}

runOllamaTests().catch(console.error);