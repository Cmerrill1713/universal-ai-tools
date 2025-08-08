#!/usr/bin/env tsx
/**
 * Test script for Ollama-Supabase integration
 * Tests the complete flow from chat requests to embedding generation
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testDatabaseConnection() {
  console.log('🔍 Testing database connection...');

  try {
    const { data, error } = await supabase.from('ollama_models').select('*').limit(1);
    if (error) throw error;

    console.log('✅ Database connection successful');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
}

async function testOllamaModels() {
  console.log('🤖 Testing Ollama models registration...');

  try {
    const { data: models, error } = await supabase.from('ollama_models').select('*').order('name');

    if (error) throw error;

    console.log(`✅ Found ${models?.length || 0} registered models:`);
    models?.forEach((model) => {
      console.log(`   - ${model.name} (${model.model_type}): ${model.capabilities?.join(', ')}`);
    });

    return models;
  } catch (error) {
    console.error('❌ Failed to fetch Ollama models:', error);
    return null;
  }
}

async function testLLMAgents() {
  console.log('🧠 Testing LLM agents configuration...');

  try {
    const { data: agents, error } = await supabase
      .from('llm_agents')
      .select('*')
      .eq('is_active', true);

    if (error) throw error;

    console.log(`✅ Found ${agents?.length || 0} active LLM agents:`);
    agents?.forEach((agent) => {
      console.log(`   - ${agent.agent_name} using ${agent.model_name}`);
      console.log(`     System: ${agent.system_prompt?.substring(0, 60)}...`);
    });

    return agents;
  } catch (error) {
    console.error('❌ Failed to fetch LLM agents:', error);
    return null;
  }
}

async function testDirectOllamaCall() {
  console.log('🚀 Testing direct Ollama API call...');

  try {
    const response = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama3.2:3b',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful AI assistant. Respond concisely.',
          },
          {
            role: 'user',
            content: 'Hello! Just say "Hello from Ollama" to test the connection.',
          },
        ],
        options: {
          temperature: 0.7,
          num_predict: 50,
        },
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    console.log('✅ Direct Ollama call successful:');
    console.log(`   Response: ${result.message.content}`);
    console.log(`   Model: ${result.model}`);

    return result;
  } catch (error) {
    console.error('❌ Direct Ollama call failed:', error);
    return null;
  }
}

async function testEmbeddingGeneration() {
  console.log('🔮 Testing embedding generation...');

  try {
    const testText = 'This is a test document for embedding generation';

    const response = await fetch('http://localhost:11434/api/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'all-minilm:latest',
        prompt: testText,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    console.log('✅ Embedding generation successful:');
    console.log(`   Text: "${testText}"`);
    console.log(`   Embedding dimension: ${result.embedding.length}`);
    console.log(
      `   First 5 values: [${result.embedding
        .slice(0, 5)
        .map((n: number) => n.toFixed(4))
        .join(', ')}...]`
    );

    return result;
  } catch (error) {
    console.error('❌ Embedding generation failed:', error);
    return null;
  }
}

async function testStorageBuckets() {
  console.log('🗄️ Testing storage buckets...');

  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();
    if (error) throw error;

    console.log(`✅ Found ${buckets?.length || 0} storage buckets:`);
    buckets?.forEach((bucket) => {
      console.log(`   - ${bucket.name} (${bucket.public ? 'public' : 'private'})`);
    });

    return buckets;
  } catch (error) {
    console.error('❌ Failed to list storage buckets:', error);
    return null;
  }
}

async function testDocumentWithEmbedding() {
  console.log('📄 Testing document insertion with automatic embedding...');

  try {
    const testDoc = {
      name: 'test-integration-doc.txt',
      path: '/test/integration-test.txt',
      content:
        'This is a comprehensive test document for the Ollama-Supabase integration. It should automatically generate embeddings when inserted.',
      content_type: 'text/plain',
      tags: ['test', 'integration', 'ollama'],
      user_id: '00000000-0000-0000-0000-000000000000', // Test UUID
    };

    const { data, error } = await supabase.from('documents').insert(testDoc).select().single();

    if (error) throw error;

    console.log('✅ Document inserted successfully:');
    console.log(`   ID: ${data.id}`);
    console.log(`   Name: ${data.name}`);
    console.log(`   Content length: ${data.content.length} chars`);

    // Wait a moment for embedding job to be queued
    console.log('⏳ Waiting for embedding job to be processed...');
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Check if embedding job was created
    const { data: embeddingJobs, error: jobError } = await supabase
      .from('embedding_jobs')
      .select('*')
      .eq('content_id', data.id)
      .order('created_at', { ascending: false });

    if (jobError) {
      console.warn('⚠️ Could not check embedding jobs:', jobError);
    } else {
      console.log(`📊 Embedding jobs: ${embeddingJobs?.length || 0} found`);
      if (embeddingJobs && embeddingJobs.length > 0) {
        const job = embeddingJobs[0];
        console.log(`   Status: ${job.status}`);
        console.log(`   Model: ${job.model_name}`);
      }
    }

    return data;
  } catch (error) {
    console.error('❌ Document insertion failed:', error);
    return null;
  }
}

async function testConversationFlow() {
  console.log('💬 Testing conversation flow...');

  try {
    // Create conversation thread
    const { data: thread, error: threadError } = await supabase
      .from('conversation_threads')
      .insert({
        title: 'Integration Test Conversation',
        summary: 'Testing the Ollama-Supabase integration flow',
        user_id: '00000000-0000-0000-0000-000000000000',
      })
      .select()
      .single();

    if (threadError) throw threadError;

    console.log(`✅ Created conversation thread: ${thread.id}`);

    // Add a user message
    const userMessage = {
      thread_id: thread.id,
      role: 'user',
      content: 'Hello! This is a test message for the integration.',
    };

    const { data: message, error: messageError } = await supabase
      .from('conversation_messages')
      .insert(userMessage)
      .select()
      .single();

    if (messageError) throw messageError;

    console.log('✅ Added user message to conversation');
    console.log(`   Message ID: ${message.id}`);

    return { thread, message };
  } catch (error) {
    console.error('❌ Conversation flow test failed:', error);
    return null;
  }
}

async function runAllTests() {
  console.log('🧪 Starting Ollama-Supabase Integration Tests\n');

  const results = {
    database: await testDatabaseConnection(),
    models: await testOllamaModels(),
    agents: await testLLMAgents(),
    ollama: await testDirectOllamaCall(),
    embeddings: await testEmbeddingGeneration(),
    storage: await testStorageBuckets(),
    documents: await testDocumentWithEmbedding(),
    conversation: await testConversationFlow(),
  };

  console.log('\n📊 Test Results Summary:');
  console.log('========================');

  Object.entries(results).forEach(([test, passed]) => {
    const status = passed ? '✅' : '❌';
    const name = test.charAt(0).toUpperCase() + test.slice(1);
    console.log(`${status} ${name}: ${passed ? 'PASSED' : 'FAILED'}`);
  });

  const totalTests = Object.keys(results).length;
  const passedTests = Object.values(results).filter(Boolean).length;

  console.log(`\n📈 Overall: ${passedTests}/${totalTests} tests passed`);

  if (passedTests === totalTests) {
    console.log('🎉 All tests passed! Ollama-Supabase integration is working correctly.');
  } else {
    console.log('⚠️ Some tests failed. Check the logs above for details.');
  }

  return results;
}

// Run the tests
if (import.meta.main) {
  runAllTests().catch(console.error);
}
