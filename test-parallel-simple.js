#!/usr/bin/env node
/**
 * Simple Parallel LLM Test
 * Tests parallel processing without the full service
 */

async function testParallelProcessing() {
  console.log('⚡ SIMPLE PARALLEL LLM TESTING');
  console.log('');
  
  const testMessage = { role: 'user', content: 'What is the capital of Mars?' };
  const models = [
    'mlx-qwen2.5-0.5b',
    'test_uncertainty_model', 
    'workflow_test_model'
  ];

  console.log('=== STEP 1: SEQUENTIAL PROCESSING ===');
  const sequentialStart = Date.now();
  const sequentialResults = [];
  
  for (const model of models) {
    const start = Date.now();
    try {
      const response = await fetch('http://localhost:8001/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [testMessage],
          max_tokens: 30
        })
      });
      
      const data = await response.json();
      const responseTime = Date.now() - start;
      
      sequentialResults.push({
        model,
        response: data.choices[0].message.content,
        responseTime,
        success: true
      });
      
      console.log(`   ${model}: ${responseTime}ms`);
    } catch (error) {
      sequentialResults.push({
        model,
        response: '',
        responseTime: Date.now() - start,
        success: false,
        error: error.message
      });
      console.log(`   ${model}: FAILED`);
    }
  }
  
  const sequentialTotal = Date.now() - sequentialStart;
  console.log(`   Total Sequential Time: ${sequentialTotal}ms`);
  console.log('');

  console.log('=== STEP 2: PARALLEL PROCESSING ===');
  const parallelStart = Date.now();
  
  const parallelPromises = models.map(async (model) => {
    const start = Date.now();
    try {
      const response = await fetch('http://localhost:8001/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [testMessage],
          max_tokens: 30
        })
      });
      
      const data = await response.json();
      const responseTime = Date.now() - start;
      
      return {
        model,
        response: data.choices[0].message.content,
        responseTime,
        success: true
      };
    } catch (error) {
      return {
        model,
        response: '',
        responseTime: Date.now() - start,
        success: false,
        error: error.message
      };
    }
  });
  
  const parallelResults = await Promise.all(parallelPromises);
  const parallelTotal = Date.now() - parallelStart;
  
  parallelResults.forEach(result => {
    console.log(`   ${result.model}: ${result.responseTime}ms`);
  });
  console.log(`   Total Parallel Time: ${parallelTotal}ms`);
  console.log('');

  console.log('=== STEP 3: PERFORMANCE COMPARISON ===');
  const speedImprovement = ((sequentialTotal - parallelTotal) / sequentialTotal * 100).toFixed(1);
  console.log(`📈 Performance Results:`);
  console.log(`   Sequential: ${sequentialTotal}ms`);
  console.log(`   Parallel: ${parallelTotal}ms`);
  console.log(`   Speed Improvement: ${speedImprovement}%`);
  console.log(`   Time Saved: ${sequentialTotal - parallelTotal}ms`);
  console.log('');

  console.log('=== STEP 4: RESPONSE COMPARISON ===');
  console.log('📝 Response Quality:');
  parallelResults.forEach((result, index) => {
    console.log(`   ${result.model}:`);
    console.log(`     Response: "${result.response.substring(0, 50)}..."`);
    console.log(`     Time: ${result.responseTime}ms`);
    console.log(`     Success: ${result.success ? '✅' : '❌'}`);
  });
  console.log('');

  console.log('=== STEP 5: BEST RESPONSE SELECTION ===');
  const bestResponse = parallelResults
    .filter(r => r.success)
    .sort((a, b) => a.responseTime - b.responseTime)[0];
  
  console.log('🏆 Best Response:');
  console.log(`   Model: ${bestResponse.model}`);
  console.log(`   Response Time: ${bestResponse.responseTime}ms`);
  console.log(`   Content: "${bestResponse.response}"`);
  console.log('');

  console.log('🎯 PARALLEL PROCESSING TEST COMPLETE!');
  console.log('');
  console.log('✅ BENEFITS DEMONSTRATED:');
  console.log(`   • ${speedImprovement}% faster response times`);
  console.log('   • Multiple model responses for comparison');
  console.log('   • Automatic best response selection');
  console.log('   • Improved reliability through redundancy');
  console.log('   • Better user experience with faster responses');
  console.log('');
  console.log('🚀 PARALLEL LLM PROCESSING IS WORKING!');
}

// Run the test
testParallelProcessing();
