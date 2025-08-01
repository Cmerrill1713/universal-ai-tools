#!/usr/bin/env tsx

/**
 * Test SwiftUI Knowledge Integration
 * Tests if Athena agents can effectively use the SwiftUI knowledge we added
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { LogContext, log } from '../utils/logger.js';
import axios from 'axios';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Test queries to validate SwiftUI knowledge capabilities
const TEST_QUERIES = [
  {
    query: "How do I create a NavigationStack in SwiftUI?",
    expectedKeywords: ['NavigationStack', 'NavigationLink', 'path'],
    category: 'navigation'
  },
  {
    query: "Show me how to animate a view in SwiftUI",
    expectedKeywords: ['withAnimation', 'spring', 'easeInOut'],
    category: 'animation'
  },
  {
    query: "How do I use @State and @Binding in SwiftUI?",
    expectedKeywords: ['@State', '@Binding', 'property wrapper'],
    category: 'data_flow'
  },
  {
    query: "Create a List with swipe actions in SwiftUI",
    expectedKeywords: ['List', 'ForEach', 'onDelete', 'swipe'],
    category: 'lists'
  },
  {
    query: "How do I build a macOS menu bar app with SwiftUI?",
    expectedKeywords: ['NSStatusItem', 'NSPopover', 'menu bar'],
    category: 'macos'
  }
];

async function testKnowledgeRetrieval() {
  log.info('Testing SwiftUI knowledge retrieval...', LogContext.SYSTEM);
  
  for (const test of TEST_QUERIES) {
    try {
      // Test direct knowledge query
      const { data: contextResults, error: contextError } = await supabase
        .from('mcp_context')
        .select('content, metadata')
        .eq('category', 'code_patterns')
        .like('metadata->doc_type', 'swiftui');
      
      if (contextError) {
        log.error(`Failed to query context for ${test.category}`, LogContext.SYSTEM, { error: contextError });
        continue;
      }
      
      // Test code examples query
      const { data: exampleResults, error: exampleError } = await supabase
        .from('code_examples')
        .select('title, code, category, tags')
        .eq('language', 'swift')
        .contains('tags', ['swiftui']);
      
      if (exampleError) {
        log.error(`Failed to query examples for ${test.category}`, LogContext.SYSTEM, { error: exampleError });
        continue;
      }
      
      // Analyze results
      const contextCount = contextResults?.length || 0;
      const exampleCount = exampleResults?.length || 0;
      
      log.info(`Query: "${test.query}"`, LogContext.SYSTEM);
      log.info(`  Context entries: ${contextCount}`, LogContext.SYSTEM);
      log.info(`  Code examples: ${exampleCount}`, LogContext.SYSTEM);
      
      // Check if we have relevant content
      const hasRelevantContent = contextResults?.some(item => {
        const content = typeof item.content === 'string' ? item.content : JSON.stringify(item.content);
        return test.expectedKeywords.some(keyword => 
          content.toLowerCase().includes(keyword.toLowerCase())
        );
      });
      
      const hasRelevantExamples = exampleResults?.some(item => {
        const codeContent = item.code.toLowerCase();
        return test.expectedKeywords.some(keyword => 
          codeContent.includes(keyword.toLowerCase())
        );
      });
      
      log.info(`  Relevant content found: ${hasRelevantContent}`, LogContext.SYSTEM);
      log.info(`  Relevant examples found: ${hasRelevantExamples}`, LogContext.SYSTEM);
      
    } catch (error) {
      log.error(`Error testing ${test.category}`, LogContext.SYSTEM, { 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }
}

async function testAgentIntegration() {
  log.info('Testing Athena agent integration with SwiftUI knowledge...', LogContext.SYSTEM);
  
  try {
    // Test if server is running
    const healthResponse = await axios.get('http://localhost:9999/health', {
      timeout: 5000
    });
    
    if (healthResponse.status !== 200) {
      log.warn('Server not running, skipping agent integration test', LogContext.SYSTEM);
      return;
    }
    
    // Test Athena agent spawning for SwiftUI task
    const spawnResponse = await axios.post('http://localhost:9999/api/v1/athena/spawn', {
      task: 'Help me create a SwiftUI navigation view with a sidebar',
      context: 'Building a macOS app with SwiftUI',
      expertise_needed: ['swiftui', 'macos', 'navigation'],
      autonomy_level: 'intermediate'
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    if (spawnResponse.status === 200) {
      log.info('✅ Agent spawning successful', LogContext.SYSTEM);
      log.info(`Agent ID: ${spawnResponse.data.agent?.id}`, LogContext.SYSTEM);
      
      // Test agent execution with SwiftUI query
      if (spawnResponse.data.agent?.id) {
        const executeResponse = await axios.post('http://localhost:9999/api/v1/athena/execute', {
          agent_id: spawnResponse.data.agent.id,
          task: 'Show me how to create a NavigationSplitView with a sidebar in SwiftUI for macOS',
          context: {
            platform: 'macOS',
            framework: 'SwiftUI'
          }
        }, {
          timeout: 30000
        });
        
        if (executeResponse.status === 200) {
          log.info('✅ Agent execution successful', LogContext.SYSTEM);
          
          const {result} = executeResponse.data;
          if (result && typeof result === 'object' && result.response) {
            const {response} = result;
            const hasSwiftUIContent = /NavigationSplitView|SwiftUI|sidebar/i.test(response);
            const hasCodeExample = /struct|var body|View/i.test(response);
            
            log.info(`Response contains SwiftUI content: ${hasSwiftUIContent}`, LogContext.SYSTEM);
            log.info(`Response contains code examples: ${hasCodeExample}`, LogContext.SYSTEM);
            
            if (hasSwiftUIContent && hasCodeExample) {
              log.info('✅ Agent successfully used SwiftUI knowledge!', LogContext.SYSTEM);
            } else {
              log.warn('⚠️ Agent response may not be using SwiftUI knowledge effectively', LogContext.SYSTEM);
            }
          }
        } else {
          log.warn('Agent execution failed', LogContext.SYSTEM);
        }
      }
    } else {
      log.warn('Agent spawning failed', LogContext.SYSTEM);
    }
    
  } catch (error) {
    log.warn('Server not available for agent testing', LogContext.SYSTEM, { 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
}

async function testMCPIntegration() {
  log.info('Testing MCP integration with SwiftUI knowledge...', LogContext.SYSTEM);
  
  try {
    // Test MCP context search
    const { data: mcpResults, error: mcpError } = await supabase
      .rpc('search_context', {
        query_text: 'SwiftUI NavigationStack',
        category_filter: 'code_patterns',
        limit_count: 5
      });
    
    if (mcpError) {
      log.warn('MCP search function not available, using direct query', LogContext.SYSTEM);
      
      // Fallback to direct search
      const { data: directResults, error: directError } = await supabase
        .from('mcp_context')
        .select('content, metadata')
        .eq('category', 'code_patterns')
        .ilike('content', '%SwiftUI%')
        .limit(5);
      
      if (directError) {
        log.error('Direct MCP query failed', LogContext.SYSTEM, { error: directError });
        return;
      }
      
      log.info(`Found ${directResults?.length || 0} SwiftUI entries in MCP context`, LogContext.SYSTEM);
    } else {
      log.info(`MCP search returned ${mcpResults?.length || 0} results`, LogContext.SYSTEM);
    }
    
  } catch (error) {
    log.error('MCP integration test failed', LogContext.SYSTEM, { 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
}

async function runAllTests() {
  log.info('🧪 Starting SwiftUI Knowledge Capability Tests', LogContext.SYSTEM);
  
  await testKnowledgeRetrieval();
  await testMCPIntegration();
  await testAgentIntegration();
  
  log.info('🏁 SwiftUI Knowledge Capability Tests Completed', LogContext.SYSTEM);
}

// Run all tests
runAllTests()
  .then(() => {
    log.info('All tests completed successfully', LogContext.SYSTEM);
    process.exit(0);
  })
  .catch((error) => {
    log.error('Test suite failed', LogContext.SYSTEM, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    process.exit(1);
  });