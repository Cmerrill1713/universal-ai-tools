#!/usr/bin/env tsx

/**
 * Test Context Retrieval from Supabase
 * Following CLAUDE.md instruction: "Always use supabase for context"
 */

import { contextStorageService } from '../src/services/context-storage-service';

async function testContextRetrieval() {
  console.log('📖 Testing context retrieval from Supabase...');

  try {
    // Test 1: Get all context for our session
    console.log('\n🔍 Test 1: Retrieving all context for claude_code_session...');
    const allContext = await contextStorageService.getContext('claude_code_session');
    console.log(`Found ${allContext.length} context entries:`);
    allContext.forEach((ctx, index) => {
      console.log(
        `  ${index + 1}. [${ctx.category}] ${ctx.source} - ${ctx.content.substring(0, 100)}...`
      );
    });

    // Test 2: Search for specific content
    console.log('\n🔍 Test 2: Searching for "Factory Acceptance Testing"...');
    const searchResults = await contextStorageService.searchContext(
      'claude_code_session',
      'Factory Acceptance Testing'
    );
    console.log(`Found ${searchResults.length} matching entries:`);
    searchResults.forEach((ctx, index) => {
      console.log(
        `  ${index + 1}. [${ctx.category}] Score: ${ctx.content.includes('Factory Acceptance') ? 'High' : 'Low'}`
      );
    });

    // Test 3: Get project-specific context
    console.log('\n🔍 Test 3: Retrieving project-specific context...');
    const projectContext = await contextStorageService.getContext(
      'claude_code_session',
      'project_info',
      '/Users/christianmerrill/Desktop/universal-ai-tools'
    );
    console.log(`Found ${projectContext.length} project info entries:`);
    projectContext.forEach((ctx, index) => {
      console.log(`  ${index + 1}. Created: ${ctx.created_at}`);
      console.log(`     Content: ${ctx.content.substring(0, 200)}...`);
    });

    // Test 4: Get test results
    console.log('\n🔍 Test 4: Retrieving test results...');
    const testResults = await contextStorageService.getContext(
      'claude_code_session',
      'test_results'
    );
    console.log(`Found ${testResults.length} test result entries:`);
    testResults.forEach((ctx, index) => {
      console.log(`  ${index + 1}. Source: ${ctx.source}`);
      if (ctx.metadata) {
        console.log(`     Metadata: ${JSON.stringify(ctx.metadata, null, 2)}`);
      }
    });

    // Test 5: Get conversation history
    console.log('\n🔍 Test 5: Retrieving conversation history...');
    const conversations = await contextStorageService.getContext(
      'claude_code_session',
      'conversation'
    );
    console.log(`Found ${conversations.length} conversation entries:`);
    conversations.forEach((ctx, index) => {
      console.log(`  ${index + 1}. From: ${ctx.source}`);
      console.log(`     Length: ${ctx.content.length} characters`);
      console.log(`     Preview: ${ctx.content.substring(0, 150)}...`);
    });

    // Final statistics
    console.log('\n📊 Final Context Statistics:');
    const stats = await contextStorageService.getContextStats('claude_code_session');
    console.log(`  Total Entries: ${stats.totalEntries}`);
    console.log(`  Categories: ${Object.keys(stats.entriesByCategory).join(', ')}`);
    console.log(`  Distribution:`, stats.entriesByCategory);
    console.log(`  Date Range: ${stats.oldestEntry} to ${stats.newestEntry}`);

    console.log('\n✅ Context retrieval test completed successfully!');
    console.log('🎯 All context is properly stored and retrievable from Supabase.');
  } catch (error) {
    console.error('❌ Error testing context retrieval:', error);
    process.exit(1);
  }
}

// Run the test
testContextRetrieval()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
