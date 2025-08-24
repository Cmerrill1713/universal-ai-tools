/**
 * Test Alpha Evolve Learning System
 * Demonstrates self-improving file management with evolution
 */

import { createClient } from '@supabase/supabase-js';
import { AlphaEvolveCoordinator } from '../src/services/alpha-evolve-coordinator.js';
import { config } from '../src/config.js';

// Initialize Supabase client
const supabase = createClient(
  config.supabase.url,
  config.supabase.anonKey
);

async function testAlphaEvolve() {
  console.log('🧬 Testing Alpha Evolve Learning System...\n');

  try {
    // Initialize coordinator
    const coordinator = new AlphaEvolveCoordinator(supabase);

    // Set up event listeners
    coordinator.on('task_completed', (task) => {
      console.log(`✅ Task completed: ${task.id}`);
      console.log(`   Performance: ${(task.performance * 100).toFixed(1)}%`);
    });

    coordinator.on('agent_evolved', ({ agentId, metrics }) => {
      console.log(`🔄 Agent evolved: ${agentId}`);
      console.log(`   Generation: ${metrics.generation}`);
      console.log(`   Fitness: ${(metrics.fitnessScore * 100).toFixed(1)}%`);
    });

    coordinator.on('cross_learning_success', ({ source, target, improvement }) => {
      console.log(`🤝 Cross-learning: ${source} → ${target}`);
      console.log(`   Improvement: ${(improvement * 100).toFixed(1)}%`);
    });

    // Test 1: Basic file organization
    console.log('\n📁 Test 1: File Organization with Evolution');
    const task1 = await coordinator.submitTask(
      'file_manager',
      'organize_files',
      {
        request: 'Organize my Downloads folder by file type',
        directory: `${process.env.HOME}/Downloads`,
        dryRun: true
      },
      8 // High priority
    );
    console.log(`   Task submitted: ${task1}`);

    // Test 2: Duplicate detection
    console.log('\n🔍 Test 2: Duplicate Detection with Learning');
    const task2 = await coordinator.submitTask(
      'file_manager',
      'find_duplicates',
      {
        request: 'Find duplicate files in my Documents and Downloads folders',
        directories: [
          `${process.env.HOME}/Documents`,
          `${process.env.HOME}/Downloads`
        ]
      },
      7
    );
    console.log(`   Task submitted: ${task2}`);

    // Test 3: Smart search with query evolution
    console.log('\n🔎 Test 3: Smart Search with Query Evolution');
    const task3 = await coordinator.submitTask(
      'file_manager',
      'smart_search',
      {
        request: 'Find all project files related to machine learning from last month',
        scope: [`${process.env.HOME}/Documents`, `${process.env.HOME}/Projects`],
        includeContent: true
      },
      6
    );
    console.log(`   Task submitted: ${task3}`);

    // Wait for tasks to complete
    console.log('\n⏳ Processing tasks...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Check task statuses
    console.log('\n📊 Task Results:');
    for (const taskId of [task1, task2, task3]) {
      const status = await coordinator.getTaskStatus(taskId);
      if (status) {
        console.log(`\nTask ${taskId}:`);
        console.log(`   Status: ${status.status}`);
        console.log(`   Performance: ${((status.performance || 0) * 100).toFixed(1)}%`);
        if (status.result?.data) {
          console.log(`   Result summary:`, JSON.stringify(status.result.data, null, 2).substring(0, 200) + '...');
        }
      }
    }

    // Test 4: Repeated tasks to trigger learning
    console.log('\n🧠 Test 4: Learning from Repeated Tasks');
    const similarTasks = [];
    
    for (let i = 0; i < 5; i++) {
      const taskId = await coordinator.submitTask(
        'file_manager',
        'organize_files',
        {
          request: `Organize test folder ${i}`,
          directory: `${process.env.HOME}/TestFolder${i}`,
          dryRun: true
        },
        5
      );
      similarTasks.push(taskId);
      console.log(`   Submitted learning task ${i + 1}: ${taskId}`);
    }

    // Wait for learning
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Get evolution status
    console.log('\n📈 Evolution Status:');
    const globalStatus = await coordinator.getGlobalStatus();
    console.log(`   Total tasks processed: ${globalStatus.globalMetrics.totalTasks}`);
    console.log(`   Success rate: ${((globalStatus.globalMetrics.successfulTasks / Math.max(1, globalStatus.globalMetrics.totalTasks)) * 100).toFixed(1)}%`);
    console.log(`   Evolution cycles: ${globalStatus.globalMetrics.totalEvolutions}`);
    console.log(`   Cross-learning events: ${globalStatus.globalMetrics.crossLearningEvents}`);

    // Get agent-specific evolution
    console.log('\n🤖 File Manager Evolution:');
    const agentEvolution = await coordinator.getAgentEvolution('file_manager');
    if (agentEvolution) {
      console.log(`   Generation: ${agentEvolution.status.generation}`);
      console.log(`   Population size: ${agentEvolution.status.populationSize}`);
      console.log(`   Average fitness: ${(agentEvolution.status.averageFitness * 100).toFixed(1)}%`);
      console.log(`   Best fitness: ${(agentEvolution.status.bestFitness * 100).toFixed(1)}%`);
      console.log(`   Patterns learned: ${agentEvolution.status.patternsLearned}`);
      console.log(`   High-confidence patterns: ${agentEvolution.patterns.highConfidencePatterns}`);
    }

    // Test 5: Performance comparison
    console.log('\n⚡ Test 5: Performance Evolution');
    
    // Submit initial task
    const perfTask1 = await coordinator.submitTask(
      'file_manager',
      'organize_files',
      {
        request: 'Organize performance test folder',
        directory: `${process.env.HOME}/PerfTest`,
        dryRun: true
      },
      9
    );
    
    // Wait for completion
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Trigger evolution
    console.log('   Triggering manual evolution...');
    
    // Submit similar task after evolution
    const perfTask2 = await coordinator.submitTask(
      'file_manager',
      'organize_files',
      {
        request: 'Organize performance test folder again',
        directory: `${process.env.HOME}/PerfTest`,
        dryRun: true
      },
      9
    );
    
    // Wait and compare
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const perf1 = await coordinator.getTaskStatus(perfTask1);
    const perf2 = await coordinator.getTaskStatus(perfTask2);
    
    if (perf1 && perf2) {
      console.log(`   Initial performance: ${((perf1.performance || 0) * 100).toFixed(1)}%`);
      console.log(`   Evolved performance: ${((perf2.performance || 0) * 100).toFixed(1)}%`);
      const improvement = ((perf2.performance || 0) - (perf1.performance || 0)) / (perf1.performance || 1) * 100;
      console.log(`   Improvement: ${improvement > 0 ? '+' : ''}${improvement.toFixed(1)}%`);
    }

    // Get cross-learning history
    console.log('\n🤝 Cross-Learning History:');
    const crossLearning = await coordinator.getCrossLearningHistory(5);
    if (crossLearning.length > 0) {
      crossLearning.forEach((event, i) => {
        console.log(`   ${i + 1}. ${event.sourceAgent} → ${event.targetAgent}`);
        console.log(`      Success: ${event.transferSuccess}`);
        console.log(`      Improvement: ${(event.improvement * 100).toFixed(1)}%`);
      });
    } else {
      console.log('   No cross-learning events yet');
    }

    console.log('\n✨ Alpha Evolve test completed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testAlphaEvolve().catch(console.error);