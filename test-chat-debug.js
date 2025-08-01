#!/usr/bin/env node

/**
 * Debug Chat API Issues
 * Tests the exact flow that's causing the "Cannot read properties of undefined (reading 'data')" error
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:9999';

async function testChatAPI() {
  console.log('🔍 Testing Chat API to identify the undefined data error...\n');

  try {
    // Test 1: Simple chat request that should trigger the error
    console.log('1️⃣ Testing basic chat request...');
    const response = await axios.post(`${BASE_URL}/api/v1/chat`, {
      message: 'Hello, can you help me?',
      agentName: 'personal_assistant'
    }, {
      timeout: 45000, // 45 second timeout
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Chat response received:', {
      success: response.data.success,
      hasMessage: !!response.data.message,
      hasData: !!response.data.data,
      dataKeys: response.data.data ? Object.keys(response.data.data) : [],
      metadataKeys: response.data.metadata ? Object.keys(response.data.metadata) : [],
      serviceUsed: response.data.metadata?.serviceUsed,
      agentName: response.data.metadata?.agentName
    });

    if (response.data.data?.message) {
      console.log('📝 Message structure:', {
        id: response.data.data.message.id,
        role: response.data.data.message.role,
        hasContent: !!response.data.data.message.content,
        hasMetadata: !!response.data.data.message.metadata,
        metadataKeys: response.data.data.message.metadata ? Object.keys(response.data.data.message.metadata) : []
      });
    }

  } catch (error) {
    console.error('❌ Chat API Error:');
    
    if (error.response) {
      console.error('Response Status:', error.response.status);
      console.error('Response Data:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('Request Error:', error.code || error.message);
    } else {
      console.error('General Error:', error.message);
    }
  }

  // Test 2: Check service health
  console.log('\n2️⃣ Testing service health...');
  try {
    const healthResponse = await axios.get(`${BASE_URL}/api/v1/monitoring/health`);
    console.log('✅ Service health:', {
      status: healthResponse.data.status,
      services: Object.keys(healthResponse.data.services || {}),
      serviceStates: healthResponse.data.services
    });
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
  }

  // Test 3: Check LFM2 status specifically
  console.log('\n3️⃣ Testing LFM2 bridge status...');
  try {
    const lfm2Response = await axios.get(`${BASE_URL}/api/v1/monitoring/circuit-breakers`);
    console.log('✅ Circuit breaker status:', {
      breakers: Object.keys(lfm2Response.data || {}),
      lfm2Status: lfm2Response.data['lfm2-bridge']
    });
  } catch (error) {
    console.error('❌ Circuit breaker check failed:', error.message);
  }

  // Test 4: Test Ollama directly
  console.log('\n4️⃣ Testing Ollama service...');
  try {
    const ollamaResponse = await axios.get('http://localhost:11434/api/tags');
    console.log('✅ Ollama available:', {
      modelCount: ollamaResponse.data.models?.length || 0,
      models: ollamaResponse.data.models?.map(m => m.name).slice(0, 3) || []
    });
  } catch (error) {
    console.error('❌ Ollama unavailable:', error.message);
  }
}

// Run the test
testChatAPI().catch(console.error);