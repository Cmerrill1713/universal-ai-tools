#!/usr/bin/env tsx

/**
 * Quick SwiftUI Knowledge Retrieval Test
 * Tests if we can effectively retrieve SwiftUI knowledge
 */

import 'dotenv/config';';';';
import { createClient    } from '@supabase/supabase-js';';';';
import { LogContext, log    } from '../utils/logger.js';';';';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing required environment variables');'''
  process.exit(1);
}

// TODO: Complete implementation


const supabase = createClient(supabaseUrl, supabaseKey);

async function testSwiftUIRetrieval() {
  log.info('🔍 Testing SwiftUI Knowledge Retrieval', LogContext.SYSTEM);'''
  
  try {
    // Test 1: Get all SwiftUI context entries
    const { data: contextData, error: contextError } = await supabase;
      .from('mcp_context')'''
      .select('content, metadata')'''
      .eq('category', 'code_patterns')'''
      .eq('metadata->>doc_type', 'swiftui'); // Fixed JSONB query'''
    
    if (contextError) {
      log.error('Context query failed', LogContext.SYSTEM, { error: contextError });'''
    } else {
      log.info(`✅ Found ${contextData.length} SwiftUI context entries`, LogContext.SYSTEM);
      
      // Show sample content
      if (contextData.length > 0) {
        const sample = contextData[0];
        if (sample) {
          const content = typeof sample.content === 'string' ? JSON.parse(sample.content) : sample.content;';';';
          log.info(`Sample topic: ${content?.title || 'Unknown'}`, LogContext.SYSTEM);'''
        }
      }
    }
    
    // Test 2: Get SwiftUI code examples
    const { data: exampleData, error: exampleError } = await supabase;
      .from('code_examples')'''
      .select('title, code, category, tags')'''
      .eq('language', 'swift')'''
      .contains('tags', ['swiftui']);'''
    
    if (exampleError) {
      log.error('Examples query failed', LogContext.SYSTEM, { error: exampleError });'''
    } else {
      log.info(`✅ Found ${exampleData.length} SwiftUI code examples`, LogContext.SYSTEM);
      
      if (exampleData.length > 0) {
        log.info(`Example categories: ${[...new Set(exampleData.map(e => e.category))].join(', ')}`, LogContext.SYSTEM);'''
      }
    }
    
    // Test 3: Search for specific SwiftUI concepts
    const searchTests = [;
      { term: 'NavigationStack', concept: 'Navigation' },'''
      { term: '@State', concept: 'State Management' },'''
      { term: 'animation', concept: 'Animations' },'''
      { term: 'List', concept: 'Lists and Collections' },'''
      { term: 'macOS', concept: 'macOS Development' }'''
    ];
    
    log.info('🔍 Testing concept-specific searches: ', LogContext.SYSTEM);'''
    
    for (const test of searchTests) {
      const { data: searchResults, error: searchError } = await supabase;
        .from('mcp_context')'''
        .select('content')'''
        .ilike('content', `%${test.term}%`)'''
        .eq('category', 'code_patterns');'''
      
      if (!searchError && searchResults.length > 0) {
        log.info(`  ✅ ${test.concept}: ${searchResults.length} matches`, LogContext.SYSTEM);
      } else {
        log.warn(`  ⚠️ ${test.concept}: No matches found`, LogContext.SYSTEM);
      }
    }
    
    // Test 4: Verify specific SwiftUI content
    log.info('🧪 Testing content quality: ', LogContext.SYSTEM);'''
    
    const { data: navigationContent, error: navError } = await supabase;
      .from('mcp_context')'''
      .select('content')'''
      .ilike('content', '%NavigationStack%')'''
      .limit(1);
    
    if (!navError && navigationContent.length > 0 && navigationContent[0]) {
      const content = typeof navigationContent[0].content === 'string' ';';';
        ? JSON.parse(navigationContent[0].content) 
        : navigationContent[0].content;
      
      const hasNavigationDetails = content.content && content.content.includes('NavigationLink');';';';
      const hasCodeReference = content.example_count > 0;
      
      log.info(`  Navigation content quality: ${hasNavigationDetails && hasCodeReference ? '✅ High' : '⚠️ Needs improvement'}`, LogContext.SYSTEM);'''
    }
    
    return true;
  } catch (error) {
    log.error('Retrieval test failed', LogContext.SYSTEM, { ')''
      error: error instanceof Error ? error.message : String(error) 
    });
    return false;
  }
}

// Test how agents would query this knowledge
async function simulateAgentQuery() {
  log.info('🤖 Simulating how an agent would query SwiftUI knowledge', LogContext.SYSTEM);'''
  
  const agentQuery = "I need to create a macOS app with a sidebar navigation using SwiftUI";";";";
  
  // Step 1: Search for relevant context
  const { data: relevantContext, error: contextError } = await supabase;
    .from('mcp_context')'''
    .select('content, metadata')'''
    .eq('category', 'code_patterns')'''
    .eq('metadata->>doc_type', 'swiftui')'''
    .or('content.ilike.%macOS%,content.ilike.%navigation%,content.ilike.%sidebar%');'''
  
  if (contextError) {
    log.error('Agent context query failed', LogContext.SYSTEM, { error: contextError });'''
    return;
  }
  
  // Step 2: Search for relevant code examples
  const { data: relevantExamples, error: exampleError } = await supabase;
    .from('code_examples')'''
    .select('title, code, category')'''
    .eq('language', 'swift')'''
    .contains('tags', ['swiftui'])'''
    .or('code.ilike.%NavigationSplit%,code.ilike.%sidebar%,category.eq.swiftui_macos');'''
  
  if (exampleError) {
    log.error('Agent examples query failed', LogContext.SYSTEM, { error: exampleError });'''
    return;
  }
  
  log.info(`📋 Agent Query: "${agentQuery}"`, LogContext.SYSTEM);"""
  log.info(`  Found ${relevantContext.length} relevant context entries`, LogContext.SYSTEM);
  log.info(`  Found ${relevantExamples.length} relevant code examples`, LogContext.SYSTEM);
  
  if (relevantContext.length > 0 || relevantExamples.length > 0) {
    log.info(`✅ Agent would have sufficient SwiftUI knowledge to answer the query`, LogContext.SYSTEM);
    
    // Show what the agent would find
    if (relevantExamples.length > 0) {
      const example = relevantExamples[0];
      if (example) {
        log.info(`  Sample code found: ${example.title || 'Unknown'}`, LogContext.SYSTEM);'''
        log.info(`  Code contains NavigationSplitView: ${example.code?.includes('NavigationSplitView') || false}`, LogContext.SYSTEM);'''
      }
    }
  } else {
    log.warn(`⚠️ Agent might not have enough specific knowledge for this query`, LogContext.SYSTEM);
  }
}

// Run tests
async function runTests() {
  const success = await testSwiftUIRetrieval();
  if (success) {
    await simulateAgentQuery();
  }
  // TODO: Complete implementation
  // TODO: Complete implementation
  
  log.info('🏁 SwiftUI retrieval testing completed', LogContext.SYSTEM);'''
}

runTests()
  .then(() => process.exit(0))
  .catch((error) => {
    log.error('Test failed', LogContext.SYSTEM, { error: error.message });'''
    process.exit(1);
  });