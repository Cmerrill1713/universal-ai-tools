/**
 * Graph-R1 Implementation Test
 * 
 * Tests the actual functionality of our Graph-R1 implementation
 * including LLM entity extraction, GRPO, and reasoning cycle.
 */

import { llmEntityExtractor } from '../src/services/graph-rag/llm-entity-extractor';
import { grpoOptimizer } from '../src/services/graph-rag/grpo-optimizer';
import { reasoningCycle } from '../src/services/graph-rag/reasoning-cycle';
import { knowledgeGraphService } from '../src/services/graph-rag/knowledge-graph-service';

async function testLLMEntityExtraction() {
  console.log('\n🧪 Testing LLM Entity Extraction...');
  
  const testText = `
    GraphRAG R1 is a revolutionary knowledge graph system that uses reinforcement learning 
    for multi-hop reasoning. It integrates with Neo4j for graph storage and employs 
    GRPO (Graph Reinforcement Policy Optimization) for improved traversal. The system 
    was developed by researchers at LHRLAB and implements a think-generate-retrieve-rethink cycle.
  `;

  try {
    // Test entity extraction
    const entities = await llmEntityExtractor.extractEntities(testText, {
      includeEmbeddings: false,
      maxEntities: 20
    });

    console.log(`✅ Extracted ${entities.length} entities:`);
    entities.forEach(entity => {
      console.log(`  - ${entity.text} (${entity.type}) - confidence: ${entity.confidence.toFixed(2)}`);
    });

    // Test relation extraction
    const relations = await llmEntityExtractor.extractRelations(testText, entities, {
      includeNary: true
    });

    console.log(`\n✅ Extracted ${relations.length} relations:`);
    relations.forEach(rel => {
      if (rel.isNary) {
        console.log(`  - N-ary: ${rel.participants?.join(', ')} (${rel.type})`);
      } else {
        console.log(`  - ${rel.source} → ${rel.target} (${rel.type})`);
      }
    });

    // Test triplet extraction
    const triplets = await llmEntityExtractor.extractTriplets(testText, {
      maxTriplets: 10
    });

    console.log(`\n✅ Extracted ${triplets.length} triplets:`);
    triplets.forEach(t => {
      console.log(`  - (${t.subject}, ${t.predicate}, ${t.object})`);
    });

    return true;
  } catch (error) {
    console.error('❌ Entity extraction test failed:', error);
    return false;
  }
}

async function testGRPOOptimizer() {
  console.log('\n🧪 Testing GRPO Optimizer...');

  try {
    // Create a test state
    const testState = {
      query: 'How does GraphRAG R1 use reinforcement learning?',
      visitedNodes: new Set(['node1', 'node2']),
      retrievedContext: ['GraphRAG uses GRPO', 'GRPO optimizes traversal'],
      thoughts: ['Need to understand GRPO better'],
      stepCount: 2,
      totalReward: 0.5
    };

    // Test action selection
    const action = await grpoOptimizer.selectAction(testState);
    console.log(`✅ Selected action: ${action.type} (confidence: ${action.confidence.toFixed(2)})`);

    // Test reward calculation
    const nextState = {
      ...testState,
      stepCount: 3,
      visitedNodes: new Set(['node1', 'node2', 'node3']),
      retrievedContext: [...testState.retrievedContext, 'New context']
    };

    const reward = grpoOptimizer.calculateReward(testState, action, nextState);
    console.log(`✅ Calculated reward: ${reward.toFixed(3)}`);

    // Test policy update with sample transitions
    const transitions = [{
      state: testState,
      action,
      reward,
      nextState,
      done: false
    }];

    await grpoOptimizer.updatePolicy(transitions, 0.7);
    const stats = grpoOptimizer.getStatistics();
    console.log(`✅ Policy updated - Episodes: ${stats.totalEpisodes}, Avg reward: ${stats.averageReward.toFixed(3)}`);

    // Test policy export/import
    const policyData = grpoOptimizer.exportPolicy();
    console.log(`✅ Policy exported (${policyData.length} bytes)`);

    return true;
  } catch (error) {
    console.error('❌ GRPO optimizer test failed:', error);
    return false;
  }
}

async function testReasoningCycle() {
  console.log('\n🧪 Testing Reasoning Cycle...');

  try {
    const testQuery = 'What is the core innovation of Graph-R1 compared to traditional GraphRAG?';

    // Set up listener for reasoning steps
    reasoningCycle.on('reasoning_step', (step) => {
      console.log(`  📍 ${step.type}: ${step.content.substring(0, 100)}...`);
    });

    // Execute reasoning with minimal steps for testing
    const result = await reasoningCycle.executeReasoning(testQuery, {
      maxSteps: 5,
      useRL: true,
      verbose: true
    });

    console.log(`\n✅ Reasoning completed:`);
    console.log(`  - Steps taken: ${result.steps.length}`);
    console.log(`  - Final confidence: ${result.confidence.toFixed(2)}`);
    console.log(`  - Total reward: ${result.totalReward.toFixed(3)}`);
    console.log(`  - Answer preview: ${result.answer.substring(0, 150)}...`);

    return true;
  } catch (error) {
    console.error('❌ Reasoning cycle test failed:', error);
    return false;
  }
}

async function testIntegration() {
  console.log('\n🧪 Testing Full Integration...');

  try {
    // Test building a knowledge graph
    const testTexts = [
      'Graph-R1 is an agentic GraphRAG framework that uses end-to-end reinforcement learning.',
      'The system employs GRPO for policy optimization and implements a think-retrieve-rethink cycle.',
      'Neo4j provides the graph database backend for storing knowledge graphs.'
    ];

    // Extract entities and relations for each text
    let allEntities: any[] = [];
    let allRelations: any[] = [];

    for (const text of testTexts) {
      const entities = await llmEntityExtractor.extractEntities(text);
      const relations = await llmEntityExtractor.extractRelations(text, entities);
      
      allEntities.push(...entities);
      allRelations.push(...relations);
    }

    console.log(`✅ Extracted ${allEntities.length} entities and ${allRelations.length} relations`);

    // Test metrics
    const metrics = knowledgeGraphService.getMetrics();
    console.log(`✅ Graph metrics:`, metrics);

    return true;
  } catch (error) {
    console.error('❌ Integration test failed:', error);
    return false;
  }
}

async function runAllTests() {
  console.log('🚀 Starting Graph-R1 Implementation Tests');
  console.log('==========================================');

  const results = {
    entityExtraction: false,
    grpoOptimizer: false,
    reasoningCycle: false,
    integration: false
  };

  // Check if Ollama is available
  try {
    const response = await fetch('http://localhost:11434/api/tags');
    const data = await response.json();
    console.log(`✅ Ollama available with ${data.models?.length || 0} models`);
  } catch (error) {
    console.error('⚠️ Warning: Ollama not available - tests will use fallback methods');
  }

  // Run tests
  results.entityExtraction = await testLLMEntityExtraction();
  results.grpoOptimizer = await testGRPOOptimizer();
  results.reasoningCycle = await testReasoningCycle();
  results.integration = await testIntegration();

  // Summary
  console.log('\n==========================================');
  console.log('📊 Test Results Summary:');
  console.log('==========================================');
  
  let passed = 0;
  let failed = 0;

  for (const [test, result] of Object.entries(results)) {
    if (result) {
      console.log(`✅ ${test}: PASSED`);
      passed++;
    } else {
      console.log(`❌ ${test}: FAILED`);
      failed++;
    }
  }

  console.log(`\nTotal: ${passed} passed, ${failed} failed`);

  if (failed === 0) {
    console.log('\n🎉 All tests passed! Graph-R1 implementation is functional.');
  } else {
    console.log('\n⚠️ Some tests failed. Review the implementation.');
  }

  process.exit(failed === 0 ? 0 : 1);
}

// Run tests if executed directly
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Check if this module is being run directly
const isMainModule = process.argv[1] === __filename;

if (isMainModule) {
  runAllTests().catch(error => {
    console.error('Fatal error running tests:', error);
    process.exit(1);
  });
}

export { testLLMEntityExtraction, testGRPOOptimizer, testReasoningCycle, testIntegration };