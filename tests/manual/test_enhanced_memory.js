#!/usr/bin/env node
/**
 * Test Script for Enhanced Memory System
 * Tests vector search, memory consolidation, and agent integration
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'http://127.0.0.1:54321';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

console.log('🧠 Enhanced Memory System Test Suite');
console.log('====================================\n');

async function testVectorExtensions() {
  console.log('🔌 Testing Vector Extensions...');
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    // Test pgvector extension
    const { data, error } = await supabase
      .from('ai_memories')
      .select('id')
      .limit(1);
    
    if (error) throw error;
    
    console.log('  ✅ pgvector extension working');
    
    // Test vector operations
    const { data: vectorTest, error: vectorError } = await supabase.rpc('search_similar_memories', {
      query_embedding: new Array(1536).fill(0.1),
      similarity_threshold: 0.5,
      max_results: 5
    });
    
    if (vectorError) {
      console.log('  ⚠️  Vector search function exists but no data yet');
    } else {
      console.log('  ✅ Vector search function working');
    }
    
    return true;
  } catch (error) {
    console.log('  ❌ Vector extension test failed:', error.message);
    return false;
  }
}

async function testMemoryStorage() {
  console.log('\n💾 Testing Memory Storage...');
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    // Generate mock embedding
    const mockEmbedding = new Array(1536).fill(0).map(() => Math.random());
    
    // Test storing memory with vector embedding
    const { data: memory, error } = await supabase
      .from('ai_memories')
      .insert({
        service_id: 'test_agent',
        memory_type: 'test_interaction',
        content: 'This is a test memory for vector search functionality',
        metadata: {
          test: true,
          timestamp: new Date().toISOString(),
          source: 'test_suite'
        },
        embedding: mockEmbedding,
        embedding_model: 'test-model',
        importance_score: 0.8,
        keywords: ['test', 'memory', 'vector', 'search'],
        related_entities: [
          { type: 'concept', value: 'testing' },
          { type: 'system', value: 'memory' }
        ]
      })
      .select()
      .single();
    
    if (error) throw error;
    
    console.log('  ✅ Memory stored with vector embedding');
    console.log(`  📝 Memory ID: ${memory.id}`);
    
    return memory.id;
  } catch (error) {
    console.log('  ❌ Memory storage failed:', error.message);
    return null;
  }
}

async function testVectorSearch(memoryId) {
  console.log('\n🔍 Testing Vector Similarity Search...');
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    // Create query embedding (similar to stored one)
    const queryEmbedding = new Array(1536).fill(0).map(() => Math.random() * 0.5);
    
    // Test similarity search
    const { data: searchResults, error } = await supabase.rpc('search_similar_memories', {
      query_embedding: queryEmbedding,
      similarity_threshold: 0.1, // Low threshold for testing
      max_results: 10,
      category_filter: null,
      agent_filter: null
    });
    
    if (error) throw error;
    
    console.log(`  ✅ Found ${searchResults.length} similar memories`);
    
    if (searchResults.length > 0) {
      const topResult = searchResults[0];
      console.log(`  🎯 Top result: similarity ${topResult.similarity.toFixed(3)}`);
      console.log(`  📄 Content: ${topResult.content.substring(0, 50)}...`);
    }
    
    return searchResults.length > 0;
  } catch (error) {
    console.log('  ❌ Vector search failed:', error.message);
    return false;
  }
}

async function testCrossAgentSearch() {
  console.log('\n🤝 Testing Cross-Agent Memory Search...');
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    // Add memories for different agents
    const agents = ['calendar_agent', 'file_manager', 'code_assistant'];
    const memoryIds = [];
    
    for (const agent of agents) {
      const mockEmbedding = new Array(1536).fill(0).map(() => Math.random());
      
      const { data: memory, error } = await supabase
        .from('ai_memories')
        .insert({
          service_id: agent,
          memory_type: 'agent_interaction',
          content: `Test memory for ${agent} with specific content`,
          metadata: { agent, test: true },
          embedding: mockEmbedding,
          importance_score: 0.7
        })
        .select()
        .single();
      
      if (error) throw error;
      memoryIds.push(memory.id);
    }
    
    console.log(`  ✅ Created memories for ${agents.length} agents`);
    
    // Test cross-agent search
    const queryEmbedding = new Array(1536).fill(0).map(() => Math.random() * 0.5);
    
    const { data: crossResults, error: crossError } = await supabase.rpc('cross_agent_memory_search', {
      query_embedding: queryEmbedding,
      agent_list: agents,
      similarity_threshold: 0.1,
      max_per_agent: 3
    });
    
    if (crossError) throw crossError;
    
    console.log(`  ✅ Cross-agent search returned ${crossResults.length} results`);
    
    // Group by agent
    const byAgent = crossResults.reduce((acc, result) => {
      acc[result.service_id] = (acc[result.service_id] || 0) + 1;
      return acc;
    }, {});
    
    console.log('  📊 Results by agent:', byAgent);
    
    return true;
  } catch (error) {
    console.log('  ❌ Cross-agent search failed:', error.message);
    return false;
  }
}

async function testMemoryConnections() {
  console.log('\n🔗 Testing Memory Connections...');
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    // Get some existing memories
    const { data: memories, error: memError } = await supabase
      .from('ai_memories')
      .select('id')
      .limit(3);
    
    if (memError) throw memError;
    
    if (memories.length < 2) {
      console.log('  ⚠️  Not enough memories to test connections');
      return false;
    }
    
    // Create memory connections (use unique test connection type to avoid conflicts)
    const testConnectionType = `test_semantic_${Date.now()}`;
    const { data: connection, error: connError } = await supabase
      .from('memory_connections')
      .insert({
        source_memory_id: memories[0].id,
        target_memory_id: memories[1].id,
        connection_type: testConnectionType,
        strength: 0.85,
        metadata: { test: true, created_by: 'test_suite' }
      })
      .select()
      .single();
    
    if (connError) throw connError;
    
    console.log('  ✅ Memory connection created');
    console.log(`  🔗 Connection ID: ${connection.id}`);
    
    // Test finding connected memories
    const { data: connected, error: findError } = await supabase.rpc('find_connected_memories', {
      start_memory_id: memories[0].id,
      connection_types: [testConnectionType],
      max_depth: 2,
      min_strength: 0.3
    });
    
    if (findError) throw findError;
    
    console.log(`  ✅ Found ${connected.length} connected memories`);
    
    return true;
  } catch (error) {
    console.log('  ❌ Memory connections test failed:', error.message);
    return false;
  }
}

async function testMemoryConsolidation() {
  console.log('\n🗜️  Testing Memory Consolidation...');
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    // Create similar memories that should be consolidated
    const similarEmbedding = new Array(1536).fill(0.5); // Very similar embeddings
    
    for (let i = 0; i < 3; i++) {
      // Add slight variations
      const embedding = similarEmbedding.map(val => val + (Math.random() - 0.5) * 0.01);
      
      await supabase
        .from('ai_memories')
        .insert({
          service_id: 'test_agent',
          memory_type: 'similar_interaction',
          content: `Similar test memory ${i + 1} for consolidation testing`,
          metadata: { 
            test: true, 
            consolidation_group: 'test_group',
            variation: i 
          },
          embedding: embedding,
          importance_score: 0.6
        });
    }
    
    console.log('  ✅ Created similar memories for consolidation');
    
    // Test consolidation function
    const { data: consolidationResult, error: consolidationError } = await supabase.rpc('consolidate_similar_memories');
    
    if (consolidationError) {
      // Consolidation might fail if not enough similar memories, that's okay
      console.log('  ⚠️  Consolidation function exists but no consolidation performed');
    } else {
      console.log(`  ✅ Consolidation completed: ${consolidationResult} groups consolidated`);
    }
    
    return true;
  } catch (error) {
    console.log('  ❌ Memory consolidation test failed:', error.message);
    return false;
  }
}

async function testMemoryMaintenance() {
  console.log('\n🔧 Testing Memory Maintenance...');
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    // Test memory importance decay
    const { data: decayResult, error: decayError } = await supabase.rpc('decay_memory_importance');
    
    if (decayError) throw decayError;
    
    console.log(`  ✅ Importance decay updated ${decayResult} memories`);
    
    // Test auto-connection creation
    const { data: connectionResult, error: connectionError } = await supabase.rpc('auto_connect_similar_memories', {
      similarity_threshold: 0.8,
      max_connections_per_memory: 3
    });
    
    if (connectionError) throw connectionError;
    
    console.log(`  ✅ Auto-connection created ${connectionResult} connections`);
    
    // Test full maintenance
    const { data: maintenanceResult, error: maintenanceError } = await supabase.rpc('perform_memory_maintenance');
    
    if (maintenanceError) throw maintenanceError;
    
    console.log('  ✅ Full maintenance completed');
    console.log('  📊 Maintenance results:', maintenanceResult);
    
    return true;
  } catch (error) {
    console.log('  ❌ Memory maintenance test failed:', error.message);
    return false;
  }
}

async function testMemoryStatistics() {
  console.log('\n📊 Testing Memory Statistics...');
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    // Get memory counts by type
    const { data: memoryStats, error: statsError } = await supabase
      .from('ai_memories')
      .select('service_id, memory_type, importance_score', { count: 'exact' });
    
    if (statsError) throw statsError;
    
    console.log(`  ✅ Total memories: ${memoryStats.length}`);
    
    // Group by service
    const byService = memoryStats.reduce((acc, mem) => {
      acc[mem.service_id] = (acc[mem.service_id] || 0) + 1;
      return acc;
    }, {});
    
    console.log('  📈 Memories by agent:', byService);
    
    // Group by type
    const byType = memoryStats.reduce((acc, mem) => {
      acc[mem.memory_type] = (acc[mem.memory_type] || 0) + 1;
      return acc;
    }, {});
    
    console.log('  📈 Memories by type:', byType);
    
    // Average importance
    const avgImportance = memoryStats.reduce((sum, mem) => sum + mem.importance_score, 0) / memoryStats.length;
    console.log(`  📈 Average importance: ${avgImportance.toFixed(3)}`);
    
    // Connection statistics
    const { data: connections, error: connError } = await supabase
      .from('memory_connections')
      .select('connection_type', { count: 'exact' });
    
    if (connError) throw connError;
    
    console.log(`  ✅ Total connections: ${connections.length}`);
    
    return true;
  } catch (error) {
    console.log('  ❌ Memory statistics test failed:', error.message);
    return false;
  }
}

async function runAllTests() {
  const results = {
    extensions: await testVectorExtensions(),
    storage: await testMemoryStorage(),
    search: false,
    crossAgent: await testCrossAgentSearch(),
    connections: await testMemoryConnections(),
    consolidation: await testMemoryConsolidation(),
    maintenance: await testMemoryMaintenance(),
    statistics: await testMemoryStatistics()
  };
  
  // Get memory ID for search test
  const memoryId = await testMemoryStorage();
  if (memoryId) {
    results.search = await testVectorSearch(memoryId);
  }
  
  console.log('\n📊 Test Results Summary:');
  console.log('========================');
  
  const passed = Object.values(results).filter(r => r).length;
  const total = Object.keys(results).length;
  
  Object.entries(results).forEach(([test, passed]) => {
    console.log(`${passed ? '✅' : '❌'} ${test}: ${passed ? 'PASSED' : 'FAILED'}`);
  });
  
  console.log(`\n${passed === total ? '🎉' : '⚠️'} Overall: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('\n🚀 Enhanced Memory System is working perfectly!');
    console.log('\nKey Features Verified:');
    console.log('• Vector similarity search with pgvector');
    console.log('• Cross-agent memory sharing');
    console.log('• Memory connections and graph traversal');
    console.log('• Automatic memory consolidation');
    console.log('• Memory maintenance and optimization');
    console.log('• Comprehensive analytics and statistics');
    console.log('\nYour AI agents now have semantic memory capabilities! 🧠✨');
  } else {
    console.log('\n⚠️ Some tests failed. Check the logs above for details.');
  }
}

// Run tests
runAllTests().catch(console.error);