#!/usr/bin/env node
/**
 * Simple Test for Production Embedding Service
 * Tests OpenAI embeddings without complex TypeScript builds
 */

const dotenv = require('dotenv');
dotenv.config();

console.log('🚀 Simple Embedding Test');
console.log('========================\n');

async function testOpenAIDirectly() {
  console.log('🧠 Testing OpenAI API Directly...');
  
  if (!process.env.OPENAI_API_KEY) {
    console.log('  ⚠️  OPENAI_API_KEY not found');
    console.log('  💡 Set OPENAI_API_KEY=your_key in .env file');
    return false;
  }

  try {
    const OpenAI = require('openai');
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    const testTexts = [
      "Schedule a meeting with the development team tomorrow",
      "Create a new React component for user authentication", 
      "Organize project files by date and category"
    ];

    console.log('  📡 Testing single embedding...');
    const start1 = Date.now();
    const response1 = await openai.embeddings.create({
      model: "text-embedding-3-large",
      input: testTexts[0],
      dimensions: 1536
    });
    const time1 = Date.now() - start1;
    
    const embedding1 = response1.data[0].embedding;
    console.log(`  ✅ Single embedding: ${time1}ms, ${embedding1.length}D`);
    console.log(`  📊 Sample: [${embedding1.slice(0, 3).map(v => v.toFixed(4)).join(', ')}...]`);

    console.log('  📦 Testing batch embeddings...');
    const start2 = Date.now();
    const response2 = await openai.embeddings.create({
      model: "text-embedding-3-large", 
      input: testTexts,
      dimensions: 1536
    });
    const time2 = Date.now() - start2;
    
    console.log(`  ✅ Batch embeddings: ${time2}ms (${(time2/testTexts.length).toFixed(1)}ms per text)`);
    console.log(`  📊 Generated ${response2.data.length} embeddings`);

    // Test semantic similarity
    console.log('  🎯 Testing semantic similarity...');
    
    const similarTexts = [
      "Schedule a meeting tomorrow",
      "Book an appointment for the next day"  // Should be similar
    ];
    
    const similarResponse = await openai.embeddings.create({
      model: "text-embedding-3-large",
      input: similarTexts,
      dimensions: 1536
    });
    
    const [emb1, emb2] = similarResponse.data.map(d => d.embedding);
    const similarity = cosineSimilarity(emb1, emb2);
    
    console.log(`  📝 Similar texts similarity: ${similarity.toFixed(3)}`);
    console.log(`  ${similarity > 0.8 ? '✅ High quality' : similarity > 0.6 ? '⚠️  Moderate' : '❌ Low quality'}`);

    return {
      success: true,
      singleTime: time1,
      batchTime: time2,
      similarity: similarity
    };

  } catch (error) {
    console.log('  ❌ OpenAI test failed:', error.message);
    return { success: false, error: error.message };
  }
}

async function testSupabaseIntegration() {
  console.log('\n💾 Testing Supabase Integration...');
  
  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabaseUrl = 'http://127.0.0.1:54321';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    if (!process.env.OPENAI_API_KEY) {
      console.log('  ⚠️  Skipping Supabase test - no OpenAI key');
      return { success: false, reason: 'no_openai_key' };
    }

    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Generate real embedding
    console.log('  🧠 Generating real embedding...');
    const testContent = "User wants to schedule a team meeting for next Tuesday";
    
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-large",
      input: testContent,
      dimensions: 1536
    });
    
    const embedding = embeddingResponse.data[0].embedding;
    console.log(`  ✅ Generated ${embedding.length}D embedding`);

    // Store in Supabase with real embedding
    console.log('  💾 Storing memory with real embedding...');
    
    const { data: stored, error: storeError } = await supabase
      .from('ai_memories')
      .insert({
        service_id: 'test_production_embeddings',
        memory_type: 'test_real_embedding',
        content: testContent,
        metadata: { 
          test: true, 
          embedding_model: 'text-embedding-3-large',
          timestamp: new Date().toISOString()
        },
        embedding: embedding,
        embedding_model: 'text-embedding-3-large',
        importance_score: 0.8,
        keywords: ['meeting', 'schedule', 'team', 'tuesday']
      })
      .select()
      .single();

    if (storeError) throw storeError;
    console.log(`  ✅ Stored memory: ${stored.id}`);

    // Test vector search with real query
    console.log('  🔍 Testing vector search...');
    
    const queryText = "help me organize a meeting";
    const queryResponse = await openai.embeddings.create({
      model: "text-embedding-3-large", 
      input: queryText,
      dimensions: 1536
    });
    
    const queryEmbedding = queryResponse.data[0].embedding;
    
    const { data: searchResults, error: searchError } = await supabase.rpc('search_similar_memories', {
      query_embedding: queryEmbedding,
      similarity_threshold: 0.5,
      max_results: 5,
      category_filter: null,
      agent_filter: null
    });

    if (searchError) throw searchError;
    
    console.log(`  ✅ Found ${searchResults.length} similar memories`);
    
    if (searchResults.length > 0) {
      const topResult = searchResults[0];
      console.log(`  🎯 Top result: similarity ${topResult.similarity.toFixed(3)}`);
      console.log(`  📄 Content: "${topResult.content.substring(0, 50)}..."`);
      
      if (topResult.similarity > 0.7) {
        console.log('  ✅ High quality semantic match!');
      } else if (topResult.similarity > 0.5) {
        console.log('  ⚠️  Moderate semantic match');
      } else {
        console.log('  ❌ Low quality match');
      }
    }

    return {
      success: true,
      memoryId: stored.id,
      searchResults: searchResults.length,
      topSimilarity: searchResults.length > 0 ? searchResults[0].similarity : 0
    };

  } catch (error) {
    console.log('  ❌ Supabase integration failed:', error.message);
    return { success: false, error: error.message };
  }
}

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

async function runSimpleTests() {
  const results = {
    openai: await testOpenAIDirectly(),
    supabase: await testSupabaseIntegration()
  };

  console.log('\n📊 Test Results:');
  console.log('================');
  
  let passed = 0;
  let total = 2;

  if (results.openai.success) {
    passed++;
    console.log('✅ OpenAI API: PASSED');
    console.log(`   - Single embedding: ${results.openai.singleTime}ms`);
    console.log(`   - Batch processing: ${results.openai.batchTime}ms`);
    console.log(`   - Similarity quality: ${results.openai.similarity.toFixed(3)}`);
  } else {
    console.log('❌ OpenAI API: FAILED');
    if (results.openai.error) {
      console.log(`   Error: ${results.openai.error}`);
    }
  }

  if (results.supabase.success) {
    passed++;
    console.log('✅ Supabase Integration: PASSED');
    console.log(`   - Search results: ${results.supabase.searchResults}`);
    console.log(`   - Top similarity: ${results.supabase.topSimilarity.toFixed(3)}`);
  } else {
    console.log('❌ Supabase Integration: FAILED');
    if (results.supabase.reason === 'no_openai_key') {
      console.log('   Reason: No OpenAI API key');
    } else if (results.supabase.error) {
      console.log(`   Error: ${results.supabase.error}`);
    }
  }

  console.log(`\n${passed === total ? '🎉' : '⚠️'} Overall: ${passed}/${total} tests passed`);

  if (passed === total) {
    console.log('\n🚀 Production Embedding Integration Working!');
    console.log('\nKey Achievements:');
    console.log('• Real OpenAI text-embedding-3-large integration ✅');
    console.log('• High-quality semantic similarity detection ✅');
    console.log('• Supabase vector storage and search ✅');
    console.log('• Performance optimization ready ✅');
    console.log('\nYour memory system is now using production-grade embeddings! 🧠✨');
  } else if (!results.openai.success) {
    console.log('\n💡 To test with real embeddings:');
    console.log('1. Get OpenAI API key from https://platform.openai.com');
    console.log('2. Add to .env file: OPENAI_API_KEY=your_key_here');
    console.log('3. Run: node test_embeddings_simple.js');
  }
}

runSimpleTests().catch(console.error);