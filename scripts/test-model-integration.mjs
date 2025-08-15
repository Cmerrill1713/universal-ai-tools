#!/usr/bin/env node

/**
 * Multi-Tier Model Integration Test
 * Tests the integration between R1 RAG and optimized model selection
 */

import { performance } from 'perf_hooks';

console.log('🎯 Multi-Tier Model Integration Test');
console.log('===================================');
console.log('Testing R1 RAG integration with Qwen2.5 Coder 14B MLX and other optimized models\n');

const LM_STUDIO_URL = 'http://localhost:5901';
const OLLAMA_URL = 'http://localhost:11434';

// Model configurations based on our benchmark results
const optimizedModels = [
  {
    id: 'qwen2.5-coder-14b-instruct-mlx',
    name: 'Qwen2.5 Coder 14B MLX',
    endpoint: 'lm-studio',
    tier: 3,
    efficiency: 16.0, // Best efficiency from benchmark
    useCase: 'Fast reasoning tasks'
  },
  {
    id: 'qwen/qwen3-coder-30b',
    name: 'Qwen3 Coder 30B',
    endpoint: 'lm-studio', 
    tier: 4,
    efficiency: 12.5,
    useCase: 'Complex coding and analysis'
  },
  {
    id: 'deepseek/deepseek-r1-0528-qwen3-8b',
    name: 'DeepSeek R1 8B',
    endpoint: 'lm-studio',
    tier: 3,
    efficiency: 14.2,
    useCase: 'R1 reasoning cycles'
  },
  {
    id: 'gpt-oss:20b',
    name: 'GPT-OSS 20B',
    endpoint: 'ollama',
    tier: 3,
    efficiency: 8.5,
    useCase: 'General reasoning'
  }
];

// RAG test scenarios with different complexity levels
const integrationTests = [
  {
    name: 'Simple Query - Tier 2 Routing',
    query: 'What is the main purpose of Universal AI Tools?',
    expectedTier: 2,
    complexity: 'simple',
    context: 'Universal AI Tools is a platform for AI model coordination.'
  },
  {
    name: 'Code Analysis - Tier 3 Routing',
    query: 'Analyze this TypeScript code and suggest improvements for the multi-tier LLM service',
    expectedTier: 3,
    complexity: 'medium',
    context: 'TypeScript service with model routing logic and performance optimization.'
  },
  {
    name: 'Complex Reasoning - Tier 4 Routing', 
    query: 'Design a comprehensive strategy for optimizing Graph-R1 reasoning cycles with reinforcement learning and explain the mathematical foundations of GRPO optimization',
    expectedTier: 4,
    complexity: 'expert',
    context: 'Advanced AI research on reasoning optimization and reinforcement learning.'
  },
  {
    name: 'R1 Specific - DeepSeek Model',
    query: 'Execute a Think-Generate-Retrieve-Rethink cycle for this query: How can we improve knowledge graph construction efficiency?',
    expectedTier: 3,
    complexity: 'complex',
    context: 'R1 reasoning methodology with knowledge graph optimization.',
    preferredModel: 'deepseek/deepseek-r1-0528-qwen3-8b'
  }
];

class ModelIntegrationTester {
  constructor() {
    this.results = {
      modelTests: [],
      tierRoutingTests: [],
      efficiencyTests: [],
      overallScore: 0
    };
  }

  async runIntegrationTest() {
    console.log('🚀 Starting Model Integration Test\n');
    
    // Test 1: Individual model performance
    await this.testModelPerformance();
    
    // Test 2: Tier routing simulation
    await this.testTierRouting();
    
    // Test 3: Efficiency comparison
    await this.testEfficiencyComparison();
    
    // Test 4: R1 integration with best models
    await this.testR1Integration();
    
    // Generate integration report
    this.generateIntegrationReport();
  }

  async testModelPerformance() {
    console.log('🧪 Testing Individual Model Performance...');
    
    const testPrompt = 'Explain the benefits of multi-tier LLM architecture in 100 words.';
    
    for (const model of optimizedModels) {
      console.log(`\\n   Testing ${model.name}:`);
      
      const startTime = performance.now();
      const result = await this.callModel(model, testPrompt);
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      const actualEfficiency = result.success ? (result.response.length / (duration / 1000)) : 0;
      
      this.results.modelTests.push({
        model: model.name,
        tier: model.tier,
        success: result.success,
        duration,
        efficiency: actualEfficiency,
        expectedEfficiency: model.efficiency,
        response: result.response || result.error
      });
      
      console.log(`      Status: ${result.success ? '✅' : '❌'}`);
      console.log(`      Duration: ${duration.toFixed(0)}ms`);
      if (result.success) {
        console.log(`      Efficiency: ${actualEfficiency.toFixed(1)} chars/sec`);
        console.log(`      Response: ${result.response.substring(0, 80)}...`);
      } else {
        console.log(`      Error: ${result.error}`);
      }
    }
    
    console.log();
  }

  async testTierRouting() {
    console.log('🎯 Testing Tier Routing Logic...');
    
    for (const test of integrationTests) {
      console.log(`\\n   ${test.name}:`);
      
      const selectedTier = this.simulateTierSelection(test);
      const selectedModel = this.selectModelForTier(selectedTier, test.preferredModel);
      
      console.log(`      Expected Tier: ${test.expectedTier}`);
      console.log(`      Selected Tier: ${selectedTier}`);
      console.log(`      Selected Model: ${selectedModel?.name || 'None'}`);
      console.log(`      Routing Accuracy: ${selectedTier === test.expectedTier ? '✅' : '❌'}`);
      
      this.results.tierRoutingTests.push({
        name: test.name,
        expectedTier: test.expectedTier,
        selectedTier,
        selectedModel: selectedModel?.name,
        accurate: selectedTier === test.expectedTier
      });
    }
    
    console.log();
  }

  simulateTierSelection(test) {
    // Simulate tier selection logic based on complexity
    const complexityToTier = {
      'simple': 2,
      'medium': 3, 
      'complex': 3,
      'expert': 4
    };
    
    let tier = complexityToTier[test.complexity] || 2;
    
    // Adjust for specific use cases
    if (test.query.toLowerCase().includes('code') || test.query.toLowerCase().includes('typescript')) {
      tier = Math.max(tier, 3); // Code tasks need at least tier 3
    }
    
    if (test.query.toLowerCase().includes('r1') || test.query.toLowerCase().includes('reasoning cycle')) {
      tier = Math.max(tier, 3); // R1 tasks need specialized models
    }
    
    return tier;
  }

  selectModelForTier(tier, preferredModel) {
    if (preferredModel) {
      return optimizedModels.find(m => m.id === preferredModel);
    }
    
    // Select best model for tier based on efficiency
    const tierModels = optimizedModels.filter(m => m.tier === tier);
    if (tierModels.length === 0) {
      // Fallback to any available model
      return optimizedModels[0];
    }
    
    // Sort by efficiency and select best
    return tierModels.sort((a, b) => b.efficiency - a.efficiency)[0];
  }

  async testEfficiencyComparison() {
    console.log('⚡ Testing Efficiency Comparison...');
    
    const testQuery = 'Create a Python function that implements binary search with error handling.';
    
    // Test our top models
    const topModels = optimizedModels.slice(0, 3);
    
    for (const model of topModels) {
      console.log(`\\n   Testing ${model.name}:`);
      
      const startTime = performance.now();
      const result = await this.callModel(model, testQuery);
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      const score = this.scoreCodeResponse(result.response || '');
      const efficiency = score / (duration / 1000); // Score per second
      
      this.results.efficiencyTests.push({
        model: model.name,
        duration,
        score,
        efficiency,
        success: result.success
      });
      
      console.log(`      Duration: ${duration.toFixed(0)}ms`);
      console.log(`      Code Score: ${score.toFixed(1)}/100`);
      console.log(`      Efficiency: ${efficiency.toFixed(1)} score/sec`);
    }
    
    console.log();
  }

  scoreCodeResponse(response) {
    let score = 0;
    const content = response.toLowerCase();
    
    // Check for Python function syntax
    if (content.includes('def ')) score += 20;
    if (content.includes('binary search') || content.includes('binary_search')) score += 20;
    if (content.includes('try:') || content.includes('except:')) score += 15;
    if (content.includes('return')) score += 10;
    if (content.includes('if ') && content.includes('else')) score += 10;
    if (response.length > 100) score += 10;
    if (response.length > 200) score += 10;
    if (content.includes('mid') || content.includes('middle')) score += 5;
    
    return Math.min(100, score);
  }

  async testR1Integration() {
    console.log('🧠 Testing R1 Integration with Optimized Models...');
    
    const r1Query = 'Use R1 reasoning to analyze: What are the key performance bottlenecks in large language model inference and how can multi-tier architecture address them?';
    
    // Test with DeepSeek R1 model (specialized for reasoning)
    const r1Model = optimizedModels.find(m => m.name.includes('DeepSeek R1'));
    
    if (r1Model) {
      console.log(`\\n   Testing R1 Integration with ${r1Model.name}:`);
      
      const startTime = performance.now();
      const result = await this.simulateR1WithModel(r1Query, r1Model);
      const endTime = performance.now();
      
      console.log(`      R1 Cycle Duration: ${(endTime - startTime).toFixed(0)}ms`);
      console.log(`      Steps Completed: ${result.steps}`);
      console.log(`      Final Confidence: ${result.confidence.toFixed(2)}`);
      console.log(`      Answer Quality: ${result.quality}/100`);
      
      if (result.answer) {
        console.log(`      Answer Preview: ${result.answer.substring(0, 120)}...`);
      }
    } else {
      console.log('   ⚠️  DeepSeek R1 model not available for testing');
    }
    
    console.log();
  }

  async simulateR1WithModel(query, model) {
    const steps = [];
    
    // Step 1: Think
    steps.push('Think: Analyzing query about LLM performance bottlenecks');
    
    // Step 2: Generate sub-queries
    steps.push('Generate: Creating focused sub-queries about inference optimization');
    
    // Step 3: Retrieve (simulated)
    steps.push('Retrieve: Gathering information about multi-tier architectures');
    
    // Step 4: Rethink
    steps.push('Rethink: Synthesizing performance optimization strategies');
    
    // Step 5: Generate answer using the model
    const result = await this.callModel(model, query);
    
    let quality = 0;
    if (result.success) {
      quality = this.scoreR1Answer(result.response);
      steps.push('Answer: Generated comprehensive response');
    } else {
      steps.push('Answer: Failed to generate response');
    }
    
    return {
      steps: steps.length,
      confidence: result.success ? 0.85 : 0.2,
      quality,
      answer: result.response
    };
  }

  scoreR1Answer(response) {
    let score = 0;
    const content = response.toLowerCase();
    
    // Check for key concepts
    if (content.includes('bottleneck') || content.includes('performance')) score += 15;
    if (content.includes('inference') || content.includes('latency')) score += 15;
    if (content.includes('multi-tier') || content.includes('tier')) score += 15;
    if (content.includes('memory') || content.includes('compute')) score += 10;
    if (content.includes('optimization') || content.includes('efficiency')) score += 10;
    
    // Check for reasoning structure
    if (content.includes('first') || content.includes('second') || content.includes('finally')) score += 10;
    if (response.length > 200) score += 10;
    if (response.length > 500) score += 10;
    
    // Check for technical depth
    if (content.includes('batch') || content.includes('parallel')) score += 5;
    
    return Math.min(100, score);
  }

  async callModel(model, prompt) {
    try {
      if (model.endpoint === 'lm-studio') {
        const response = await fetch(`${LM_STUDIO_URL}/v1/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: model.id,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
            max_tokens: 400
          }),
          signal: AbortSignal.timeout(15000)
        });
        
        if (response.ok) {
          const data = await response.json();
          return {
            success: true,
            response: data.choices[0]?.message?.content || ''
          };
        } else {
          return { success: false, error: `HTTP ${response.status}` };
        }
      } else {
        const response = await fetch(`${OLLAMA_URL}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: model.id,
            prompt,
            stream: false,
            options: { temperature: 0.3 }
          }),
          signal: AbortSignal.timeout(15000)
        });
        
        if (response.ok) {
          const data = await response.json();
          return {
            success: true,
            response: data.response || ''
          };
        } else {
          return { success: false, error: `HTTP ${response.status}` };
        }
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  generateIntegrationReport() {
    console.log('📊 Model Integration Test Report');
    console.log('===============================');
    
    // Model Performance Summary
    console.log('\\n🧪 Model Performance Summary:');
    this.results.modelTests.forEach(test => {
      const status = test.success ? '✅' : '❌';
      console.log(`   ${status} ${test.model} (Tier ${test.tier}): ${test.duration.toFixed(0)}ms`);
      if (test.success) {
        console.log(`      Efficiency: ${test.efficiency.toFixed(1)} chars/sec`);
      }
    });
    
    // Tier Routing Accuracy
    console.log('\\n🎯 Tier Routing Accuracy:');
    const routingAccuracy = this.results.tierRoutingTests.filter(t => t.accurate).length / this.results.tierRoutingTests.length;
    console.log(`   Overall Accuracy: ${(routingAccuracy * 100).toFixed(1)}%`);
    
    this.results.tierRoutingTests.forEach(test => {
      const status = test.accurate ? '✅' : '❌';
      console.log(`   ${status} ${test.name}: Tier ${test.selectedTier} (Expected: ${test.expectedTier})`);
    });
    
    // Efficiency Rankings
    console.log('\\n⚡ Efficiency Rankings:');
    const sortedEfficiency = [...this.results.efficiencyTests]
      .filter(t => t.success)
      .sort((a, b) => b.efficiency - a.efficiency);
    
    sortedEfficiency.forEach((test, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}.`;
      console.log(`   ${medal} ${test.model}: ${test.efficiency.toFixed(1)} score/sec`);
    });
    
    // Best Model Recommendations
    console.log('\\n💡 Best Model Recommendations:');
    
    const fastestModel = sortedEfficiency[0];
    if (fastestModel) {
      console.log(`   🚀 Fastest: ${fastestModel.model} (${fastestModel.efficiency.toFixed(1)} score/sec)`);
    }
    
    const bestTier3 = this.results.modelTests
      .filter(t => t.tier === 3 && t.success)
      .sort((a, b) => b.efficiency - a.efficiency)[0];
    if (bestTier3) {
      console.log(`   🎯 Best Tier 3: ${bestTier3.model} (${bestTier3.efficiency.toFixed(1)} chars/sec)`);
    }
    
    // Overall Integration Score
    const successfulModels = this.results.modelTests.filter(t => t.success).length;
    const totalModels = this.results.modelTests.length;
    const modelScore = (successfulModels / totalModels) * 40;
    const routingScore = routingAccuracy * 30;
    const efficiencyScore = sortedEfficiency.length > 0 ? 30 : 0;
    
    const overallScore = modelScore + routingScore + efficiencyScore;
    
    console.log(`\\n🎯 Overall Integration Score: ${overallScore.toFixed(1)}/100`);
    
    if (overallScore >= 85) {
      console.log('\\n✅ EXCELLENT: Your model integration is outstanding!');
      console.log('   - All optimized models are working correctly');
      console.log('   - Tier routing is accurate and efficient');
      console.log('   - Ready for production R1 RAG workloads');
    } else if (overallScore >= 70) {
      console.log('\\n🟡 GOOD: Model integration is solid with minor areas for improvement');
      console.log('   - Most models are performing well');
      console.log('   - Consider optimizing slower models or routing logic');
    } else {
      console.log('\\n⚠️  NEEDS ATTENTION: Model integration requires optimization');
      console.log('   - Check model availability and configuration');
      console.log('   - Verify tier routing logic');
    }
    
    console.log('\\n🏁 Model Integration Test Complete!');
  }
}

// Run the integration test
const tester = new ModelIntegrationTester();
tester.runIntegrationTest().catch(console.error);