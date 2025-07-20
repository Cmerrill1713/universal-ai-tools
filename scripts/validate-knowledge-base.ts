#!/usr/bin/env tsx
/**
 * Knowledge Base Validation Script
 * Validates all knowledge entries, connections, and system health
 */

import { createClient } from '@supabase/supabase-js';
import { logger } from '../src/utils/enhanced-logger';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseKey) {
  logger.error('Missing SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface ValidationResult {
  category: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: any;
}

const results: ValidationResult[] = [];

async function validateMemoryStorage() {
  console.log('\n📊 Validating Memory Storage...\n');
  
  try {
    // Check total memory count
    const { data: allMemories, error: countError } = await supabase
      .from('ai_memories')
      .select('*', { count: 'exact' });
    
    if (countError) throw countError;
    
    const totalCount = allMemories?.length || 0;
    console.log(`✅ Total memories in system: ${totalCount}`);
    
    // Check memories by service ID
    const serviceIds = [
      'universal-ai-tools-knowledge',
      'agent-orchestration-system'
    ];
    
    for (const serviceId of serviceIds) {
      const { data: serviceMemories, error } = await supabase
        .from('ai_memories')
        .select('*')
        .eq('service_id', serviceId);
      
      if (error) {
        results.push({
          category: 'Memory Storage',
          status: 'fail',
          message: `Failed to query memories for ${serviceId}`,
          details: error
        });
        continue;
      }
      
      const count = serviceMemories?.length || 0;
      console.log(`📁 Service ${serviceId}: ${count} memories`);
      
      if (count > 0) {
        results.push({
          category: 'Memory Storage',
          status: 'pass',
          message: `Found ${count} memories for ${serviceId}`,
          details: { count, serviceId }
        });
        
        // Check memory types
        const memoryTypes = new Map<string, number>();
        serviceMemories?.forEach(mem => {
          const type = mem.memory_type;
          memoryTypes.set(type, (memoryTypes.get(type) || 0) + 1);
        });
        
        console.log('  Memory types:');
        memoryTypes.forEach((count, type) => {
          console.log(`    - ${type}: ${count}`);
        });
      } else {
        results.push({
          category: 'Memory Storage',
          status: 'warning',
          message: `No memories found for ${serviceId}`,
          details: { serviceId }
        });
      }
    }
    
    // Check specific knowledge categories
    const expectedCategories = [
      { type: 'supabase_rls_best_practices', minCount: 1 },
      { type: 'supabase_auth_best_practices', minCount: 1 },
      { type: 'supabase_performance_optimization', minCount: 1 },
      { type: 'graphql_apollo_server', minCount: 1 },
      { type: 'graphql_performance', minCount: 1 },
      { type: 'graphql_architecture', minCount: 1 },
      { type: 'cross_encoder_fundamentals', minCount: 1 },
      { type: 'advanced_reranking_strategies', minCount: 1 },
      { type: 'reranking_production_patterns', minCount: 1 },
      { type: 'dspy_framework_fundamentals', minCount: 1 }
    ];
    
    console.log('\n📚 Checking Expected Knowledge Categories...\n');
    
    for (const { type, minCount } of expectedCategories) {
      const { data, error } = await supabase
        .from('ai_memories')
        .select('*')
        .eq('memory_type', type);
      
      if (error) {
        results.push({
          category: 'Knowledge Categories',
          status: 'fail',
          message: `Error checking ${type}`,
          details: error
        });
        continue;
      }
      
      const count = data?.length || 0;
      if (count >= minCount) {
        console.log(`✅ ${type}: ${count} entries`);
        results.push({
          category: 'Knowledge Categories',
          status: 'pass',
          message: `${type} has ${count} entries`,
          details: { type, count }
        });
      } else {
        console.log(`❌ ${type}: ${count} entries (expected at least ${minCount})`);
        results.push({
          category: 'Knowledge Categories',
          status: 'fail',
          message: `${type} has insufficient entries`,
          details: { type, count, expected: minCount }
        });
      }
    }
    
  } catch (error) {
    results.push({
      category: 'Memory Storage',
      status: 'fail',
      message: 'Failed to validate memory storage',
      details: error
    });
  }
}

async function validateMemoryConnections() {
  console.log('\n🔗 Validating Memory Connections...\n');
  
  try {
    const { data: connections, error } = await supabase
      .from('memory_connections')
      .select('*', { count: 'exact' });
    
    if (error) throw error;
    
    const count = connections?.length || 0;
    console.log(`Total connections: ${count}`);
    
    if (count > 0) {
      results.push({
        category: 'Memory Connections',
        status: 'pass',
        message: `Found ${count} memory connections`,
        details: { count }
      });
      
      // Check connection types
      const connectionTypes = new Map<string, number>();
      connections?.forEach(conn => {
        const type = conn.connection_type;
        connectionTypes.set(type, (connectionTypes.get(type) || 0) + 1);
      });
      
      console.log('Connection types:');
      connectionTypes.forEach((count, type) => {
        console.log(`  - ${type}: ${count}`);
      });
    } else {
      results.push({
        category: 'Memory Connections',
        status: 'warning',
        message: 'No memory connections found',
        details: { count: 0 }
      });
    }
    
  } catch (error) {
    results.push({
      category: 'Memory Connections',
      status: 'fail',
      message: 'Failed to validate memory connections',
      details: error
    });
  }
}

async function validateSearchFunctions() {
  console.log('\n🔍 Validating Search Functions...\n');
  
  try {
    // Test multi-domain semantic search
    const { data: searchResult, error: searchError } = await supabase
      .rpc('search_memories_by_intent', {
        query_text: 'How to implement authentication in Supabase',
        intent_type: 'implementation',
        limit_count: 5
      });
    
    if (!searchError && searchResult) {
      console.log(`✅ Multi-domain search working: ${searchResult.length} results`);
      results.push({
        category: 'Search Functions',
        status: 'pass',
        message: 'Multi-domain semantic search working',
        details: { resultCount: searchResult.length }
      });
    } else {
      console.log('⚠️ Multi-domain search function not available');
      results.push({
        category: 'Search Functions',
        status: 'warning',
        message: 'Multi-domain search function not available',
        details: searchError
      });
    }
    
  } catch (error) {
    results.push({
      category: 'Search Functions',
      status: 'fail',
      message: 'Failed to validate search functions',
      details: error
    });
  }
}

async function validateKnowledgeHealth() {
  console.log('\n💚 Validating Knowledge Health...\n');
  
  try {
    // Check importance score distribution
    const { data: memories, error } = await supabase
      .from('ai_memories')
      .select('importance_score, memory_type, metadata');
    
    if (error) throw error;
    
    if (memories && memories.length > 0) {
      const scores = memories.map(m => m.importance_score || 0);
      const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
      const highPriority = scores.filter(s => s >= 0.8).length;
      
      console.log(`Average importance score: ${avgScore.toFixed(2)}`);
      console.log(`High priority memories (≥0.8): ${highPriority}/${memories.length}`);
      
      results.push({
        category: 'Knowledge Health',
        status: avgScore >= 0.7 ? 'pass' : 'warning',
        message: `Average importance score: ${avgScore.toFixed(2)}`,
        details: { avgScore, highPriority, total: memories.length }
      });
      
      // Check metadata completeness
      let metadataComplete = 0;
      memories.forEach(mem => {
        if (mem.metadata && 
            mem.metadata.category && 
            mem.metadata.tags && 
            Array.isArray(mem.metadata.tags) && 
            mem.metadata.tags.length > 0) {
          metadataComplete++;
        }
      });
      
      const metadataCompleteness = (metadataComplete / memories.length) * 100;
      console.log(`Metadata completeness: ${metadataCompleteness.toFixed(1)}%`);
      
      results.push({
        category: 'Knowledge Health',
        status: metadataCompleteness >= 80 ? 'pass' : 'warning',
        message: `Metadata completeness: ${metadataCompleteness.toFixed(1)}%`,
        details: { complete: metadataComplete, total: memories.length }
      });
    }
    
  } catch (error) {
    results.push({
      category: 'Knowledge Health',
      status: 'fail',
      message: 'Failed to validate knowledge health',
      details: error
    });
  }
}

async function validateContinuousLearning() {
  console.log('\n🔄 Validating Continuous Learning System...\n');
  
  try {
    // Check if knowledge_sources table exists
    const { data: sources, error: sourcesError } = await supabase
      .from('knowledge_sources')
      .select('*', { count: 'exact' })
      .limit(1);
    
    if (!sourcesError) {
      console.log('✅ knowledge_sources table exists');
      results.push({
        category: 'Continuous Learning',
        status: 'pass',
        message: 'knowledge_sources table exists',
        details: { tableExists: true }
      });
    } else {
      console.log('⚠️ knowledge_sources table not found');
      results.push({
        category: 'Continuous Learning',
        status: 'warning',
        message: 'knowledge_sources table not found',
        details: { error: sourcesError.message }
      });
    }
    
    // Check knowledge_updates table
    const { data: updates, error: updatesError } = await supabase
      .from('knowledge_updates')
      .select('*', { count: 'exact' })
      .limit(1);
    
    if (!updatesError) {
      console.log('✅ knowledge_updates table exists');
      results.push({
        category: 'Continuous Learning',
        status: 'pass',
        message: 'knowledge_updates table exists',
        details: { tableExists: true }
      });
    } else {
      console.log('⚠️ knowledge_updates table not found');
      results.push({
        category: 'Continuous Learning',
        status: 'warning',
        message: 'knowledge_updates table not found',
        details: { error: updatesError.message }
      });
    }
    
  } catch (error) {
    results.push({
      category: 'Continuous Learning',
      status: 'fail',
      message: 'Failed to validate continuous learning system',
      details: error
    });
  }
}

async function generateReport() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 VALIDATION REPORT SUMMARY');
  console.log('='.repeat(60) + '\n');
  
  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const warnings = results.filter(r => r.status === 'warning').length;
  
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⚠️  Warnings: ${warnings}`);
  console.log(`📊 Total checks: ${results.length}`);
  
  console.log('\n📋 Detailed Results:\n');
  
  const categories = new Set(results.map(r => r.category));
  categories.forEach(category => {
    console.log(`\n${category}:`);
    results
      .filter(r => r.category === category)
      .forEach(r => {
        const icon = r.status === 'pass' ? '✅' : r.status === 'fail' ? '❌' : '⚠️';
        console.log(`  ${icon} ${r.message}`);
      });
  });
  
  console.log('\n' + '='.repeat(60));
  
  if (failed > 0) {
    console.log('\n⚠️  Some validations failed. Please review the details above.');
    process.exit(1);
  } else if (warnings > 0) {
    console.log('\n✅ All critical validations passed with some warnings.');
  } else {
    console.log('\n🎉 All validations passed successfully!');
  }
}

// Run all validations
async function main() {
  console.log('🔍 Starting Knowledge Base Validation...\n');
  
  await validateMemoryStorage();
  await validateMemoryConnections();
  await validateSearchFunctions();
  await validateKnowledgeHealth();
  await validateContinuousLearning();
  await generateReport();
}

main().catch(error => {
  logger.error('Validation script failed:', error);
  process.exit(1);
});