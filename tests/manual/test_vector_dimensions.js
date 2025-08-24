#!/usr/bin/env node

/**
 * Test Vector Dimensions Compatibility
 * Verifies that the system correctly handles different embedding dimensions
 */

const { createClient } = require('@supabase/supabase-js');
const { config } = require('dotenv');

// Load environment variables
config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Test vectors of different dimensions
const testVectors = {
  '384d': {
    dimensions: 384,
    vector: Array(384).fill(0).map(() => Math.random()),
    model: 'all-minilm'
  },
  '768d': {
    dimensions: 768,
    vector: Array(768).fill(0).map(() => Math.random()),
    model: 'nomic-embed-text'
  },
  '1024d': {
    dimensions: 1024,
    vector: Array(1024).fill(0).map(() => Math.random()),
    model: 'mxbai-embed-large'
  },
  '1536d': {
    dimensions: 1536,
    vector: Array(1536).fill(0).map(() => Math.random()),
    model: 'text-embedding-3-large'
  }
};

async function testVectorInsertion() {
  console.log('🧪 Testing vector insertion with different dimensions...\n');
  
  const results = [];
  
  for (const [name, data] of Object.entries(testVectors)) {
    try {
      console.log(`📊 Testing ${name} (${data.dimensions} dimensions)...`);
      
      // Insert test memory with vector
      const { data: insertData, error: insertError } = await supabase
        .from('ai_memories')
        .insert({
          memory_type: 'test',
          content: `Test memory for ${data.dimensions}D vector`,
          embedding: data.vector,
          embedding_model: data.model,
          importance_score: 0.5,
          metadata: {
            test: true,
            dimensions: data.dimensions,
            model: data.model
          }
        })
        .select()
        .single();
      
      if (insertError) {
        console.error(`❌ Failed to insert ${name}:`, insertError.message);
        results.push({ name, success: false, error: insertError.message });
      } else {
        console.log(`✅ Successfully inserted ${name}`);
        results.push({ name, success: true, id: insertData.id });
      }
      
    } catch (error) {
      console.error(`❌ Error testing ${name}:`, error.message);
      results.push({ name, success: false, error: error.message });
    }
  }
  
  return results;
}

async function testVectorSearch(results) {
  console.log('\n🔍 Testing vector search with different dimensions...\n');
  
  const successfulInserts = results.filter(r => r.success);
  
  for (const insert of successfulInserts) {
    const testData = testVectors[insert.name];
    
    try {
      console.log(`🔍 Searching with ${insert.name} query vector...`);
      
      // Try to search with the same dimension vector
      const { data: searchData, error: searchError } = await supabase
        .rpc('search_similar_memories', {
          query_embedding: testData.vector,
          similarity_threshold: 0.1,
          max_results: 5
        });
      
      if (searchError) {
        console.error(`❌ Search failed for ${insert.name}:`, searchError.message);
      } else {
        console.log(`✅ Search successful for ${insert.name}: Found ${searchData.length} results`);
      }
      
    } catch (error) {
      console.error(`❌ Error searching ${insert.name}:`, error.message);
    }
  }
}

async function testCrossDimensionSearch() {
  console.log('\n🔄 Testing cross-dimension search compatibility...\n');
  
  const dimensions = [768, 1536];
  
  for (const queryDim of dimensions) {
    const queryVector = Array(queryDim).fill(0).map(() => Math.random());
    
    console.log(`🔍 Searching with ${queryDim}D query vector...`);
    
    try {
      const { data, error } = await supabase
        .rpc('search_similar_memories', {
          query_embedding: queryVector,
          similarity_threshold: 0.1,
          max_results: 5
        });
      
      if (error) {
        console.log(`⚠️  Expected behavior: ${queryDim}D search returned error:`, error.message);
      } else {
        console.log(`✅ ${queryDim}D search successful: Found ${data.length} compatible results`);
      }
    } catch (error) {
      console.log(`⚠️  Expected behavior: ${queryDim}D search error:`, error.message);
    }
  }
}

async function cleanupTestData(results) {
  console.log('\n🧹 Cleaning up test data...\n');
  
  const successfulInserts = results.filter(r => r.success);
  
  for (const insert of successfulInserts) {
    try {
      const { error } = await supabase
        .from('ai_memories')
        .delete()
        .eq('id', insert.id);
      
      if (error) {
        console.error(`❌ Failed to cleanup ${insert.name}:`, error.message);
      } else {
        console.log(`✅ Cleaned up ${insert.name}`);
      }
    } catch (error) {
      console.error(`❌ Error cleaning up ${insert.name}:`, error.message);
    }
  }
}

async function checkDimensionSummary() {
  console.log('\n📊 Checking embedding dimension summary...\n');
  
  try {
    const { data, error } = await supabase
      .rpc('get_embedding_dimensions_summary');
    
    if (error) {
      console.error('❌ Failed to get dimension summary:', error.message);
    } else {
      console.log('📊 Embedding Dimension Summary:');
      console.log(`   Total memories with embeddings: ${data.totalMemories}`);
      console.log(`   OpenAI embeddings (1536D): ${data.openaiEmbeddings}`);
      console.log(`   Ollama embeddings (768D): ${data.ollamaEmbeddings}`);
      console.log(`   Other dimensions: ${data.otherDimensions}`);
      console.log(`   Dimension breakdown:`, data.dimensionBreakdown);
    }
  } catch (error) {
    console.error('❌ Error getting dimension summary:', error.message);
  }
}

async function main() {
  console.log('🚀 Vector Dimension Compatibility Test\n');
  console.log('This test verifies that the system correctly handles different embedding dimensions.\n');
  
  try {
    // Check current state
    await checkDimensionSummary();
    
    // Test insertion
    const results = await testVectorInsertion();
    
    // Test search
    await testVectorSearch(results);
    
    // Test cross-dimension compatibility
    await testCrossDimensionSearch();
    
    // Clean up
    await cleanupTestData(results);
    
    // Final summary
    await checkDimensionSummary();
    
    console.log('\n✅ Vector dimension test completed!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
main().catch(console.error);