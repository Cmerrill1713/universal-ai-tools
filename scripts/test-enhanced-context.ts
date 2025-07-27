#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import {
  EnhancedContextService,
  EnhancedContextExamples,
} from '../src/services/enhanced-context-service';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY in environment variables');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const contextService = new EnhancedContextService(supabase);

  console.log('🚀 Testing Enhanced Searchable Context System\n');

  try {
    // Test 1: Initialize the system
    console.log('1️⃣ Initializing enhanced context system...');
    const initResult = await contextService.initializeSystem();
    console.log('✅ System initialized:', JSON.stringify(initResult, null, 2));
    console.log('\n---\n');

    // Test 2: Cross-domain search
    console.log('2️⃣ Testing cross-domain search...');
    const searchResults = await contextService.searchAcrossDomains(
      'How to implement real-time subscriptions with GraphQL in Supabase',
      {
        intent: 'implementation',
        domains: ['supabase', 'graphql'],
        maxResults: 5,
      }
    );
    console.log(`✅ Found ${searchResults.length} results`);
    searchResults.forEach((result, i) => {
      console.log(`\n  Result ${i + 1}:`);
      console.log(`  Domain: ${result.domain}`);
      console.log(`  Score: ${result.final_score.toFixed(3)}`);
      console.log(`  Content: ${result.content.substring(0, 100)}...`);
      console.log(`  Related memories: ${result.related_memories.length}`);
    });
    console.log('\n---\n');

    // Test 3: Knowledge graph traversal
    console.log('3️⃣ Testing knowledge graph traversal...');
    const knowledgePaths = await contextService.searchKnowledgeGraph(
      'Supabase performance optimization',
      {
        traversalDepth: 2,
        maxPaths: 3,
      }
    );
    console.log(`✅ Found ${knowledgePaths.length} knowledge paths`);
    knowledgePaths.forEach((path, i) => {
      console.log(`\n  Path ${i + 1}: ${path.path_description}`);
      console.log(`  Strength: ${path.total_strength.toFixed(3)}`);
      console.log(`  Domains covered: ${path.domain_sequence.join(' → ')}`);
    });
    console.log('\n---\n');

    // Test 4: Learning paths
    console.log('4️⃣ Testing learning path discovery...');
    const learningPaths = await contextService.discoverLearningPaths('supabase', 'intermediate');
    console.log(`✅ Found ${learningPaths.length} learning paths`);
    learningPaths.forEach((path, i) => {
      console.log(`\n  Learning Path ${i + 1}:`);
      console.log(`  Complexity: ${path.estimated_complexity.toFixed(1)}`);
      console.log(`  Topics: ${path.topics_covered.join(', ')}`);
      console.log(`  Prerequisites: ${JSON.stringify(path.prerequisite_check)}`);
    });
    console.log('\n---\n');

    // Test 5: Knowledge clusters
    console.log('5️⃣ Testing knowledge clusters...');
    const clusters = await contextService.getKnowledgeClusters();
    console.log(`✅ Found ${clusters.length} knowledge clusters`);
    clusters.slice(0, 3).forEach((cluster) => {
      console.log(`\n  Cluster: ${cluster.primary_cluster}`);
      console.log(`  Complexity: ${cluster.complexity_level}`);
      console.log(`  Memory count: ${cluster.memory_count}`);
      console.log(`  Domains: ${cluster.domains.join(', ')}`);
    });
    console.log('\n---\n');

    // Test 6: Technology cross-references
    console.log('6️⃣ Testing technology cross-references...');
    const crossRefs = await contextService.getTechnologyCrossReferences('supabase');
    console.log(`✅ Found ${crossRefs.length} cross-references for Supabase`);
    crossRefs.slice(0, 3).forEach((ref) => {
      console.log(`\n  ${ref.domain1} ↔ ${ref.domain2}`);
      console.log(`  Connections: ${ref.connection_count}`);
      console.log(`  Avg strength: ${ref.avg_strength.toFixed(3)}`);
      console.log(`  Types: ${ref.connection_types.join(', ')}`);
    });
    console.log('\n---\n');

    // Test 7: Comprehensive context building
    console.log('7️⃣ Testing comprehensive context building...');
    const context = await contextService.buildComprehensiveContext(
      'How to optimize Supabase queries',
      {
        intent: 'optimization',
        includeRelated: true,
        maxDepth: 2,
      }
    );
    console.log('✅ Comprehensive context built:');
    console.log(`  Primary results: ${context.primary.length}`);
    console.log(`  Related results: ${context.related.length}`);
    console.log(`  Knowledge paths: ${context.paths.length}`);
    console.log(`  Clusters: ${context.clusters.length}`);
    console.log('\n---\n');

    // Test 8: Usage patterns
    console.log('8️⃣ Testing knowledge usage patterns...');
    const usagePatterns = await contextService.getKnowledgeUsagePatterns({
      minUsefulnessRate: 0.7,
    });
    console.log(`✅ Found ${usagePatterns.length} highly useful knowledge items`);
    usagePatterns.slice(0, 3).forEach((pattern) => {
      console.log(`\n  Domain: ${pattern.service_id}`);
      console.log(`  Type: ${pattern.memory_type}`);
      console.log(`  Access count: ${pattern.access_count}`);
      console.log(`  Usefulness rate: ${pattern.usefulness_rate?.toFixed(2) || 'N/A'}`);
      console.log(`  Current relevance: ${pattern.current_relevance.toFixed(3)}`);
    });
    console.log('\n---\n');

    // Test 9: Example scenarios
    console.log('9️⃣ Testing example scenarios...');

    console.log('\n  📚 Learning Scenario:');
    const learningExample = await EnhancedContextExamples.learningScenario(contextService);
    console.log(`  Found ${learningExample.learningPaths.length} learning paths`);
    console.log(`  Found ${learningExample.beginnerContent.length} beginner resources`);

    console.log('\n  🐛 Debugging Scenario:');
    const debuggingExample = await EnhancedContextExamples.debuggingScenario(contextService);
    console.log(`  Found ${debuggingExample.results.length} debugging results`);
    console.log(`  Built context with ${debuggingExample.context.primary.length} primary items`);

    console.log('\n  ⚡ Optimization Scenario:');
    const optimizationExample = await EnhancedContextExamples.optimizationScenario(contextService);
    console.log(`  Found ${optimizationExample.optimizations.length} optimization techniques`);
    console.log(`  Found ${optimizationExample.paths.length} optimization paths`);

    console.log('\n✅ All tests completed successfully!');
  } catch (error) {
    console.error('❌ Error during testing:', error);
    process.exit(1);
  }
}

// Run the test
main().catch(console.error);
