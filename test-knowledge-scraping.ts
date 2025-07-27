#!/usr/bin/env tsx
/**
 * Test Knowledge Scraping and Agent Integration
 */

import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import AgentRegistry from './src/agents/agent-registry';
import type { AgentContext } from './src/types';

const API_BASE = 'http://localhost:9999/api/v1';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testKnowledgeScraping() {
  console.log('🧪 Testing Knowledge Scraping System\n');

  try {
    // 1. Check if knowledge scraper is available
    console.log('1️⃣ Checking knowledge scraper health...');
    const healthResponse = await axios.get(`${API_BASE}/knowledge/health`);
    console.log('✅ Knowledge scraper health:', healthResponse.data);

    // 2. Get available sources
    console.log('\n2️⃣ Getting available knowledge sources...');
    const sourcesResponse = await axios.get(`${API_BASE}/knowledge/sources`);
    console.log('✅ Available sources:', sourcesResponse.data.data.sources.map((s: any) => s.name));

    // 3. Start scraping Stack Overflow (limited for testing)
    console.log('\n3️⃣ Starting knowledge scraping from Stack Overflow...');
    const scrapeResponse = await axios.post(`${API_BASE}/knowledge/scrape`, {
      sources: ['Stack Overflow'],
      categories: ['javascript', 'react'],
      limit: 10,
      updateExisting: true
    });
    console.log('✅ Scraping started:', scrapeResponse.data);

    // 4. Wait for scraping to complete (or timeout)
    console.log('\n⏳ Waiting for scraping to complete (30 seconds)...');
    await delay(30000);

    // 5. Check scraping status
    console.log('\n4️⃣ Checking scraping status...');
    const statusResponse = await axios.get(`${API_BASE}/knowledge/status`);
    console.log('✅ Scraping status:', statusResponse.data.data);

    // 6. Test knowledge search
    console.log('\n5️⃣ Testing knowledge search...');
    const searchResponse = await axios.get(`${API_BASE}/knowledge/search`, {
      params: {
        query: 'react hooks useEffect',
        limit: 3
      }
    });
    console.log('✅ Search results:', searchResponse.data.data.count, 'results found');
    if (searchResponse.data.data.results.length > 0) {
      console.log('\nFirst result:');
      console.log('- Source:', searchResponse.data.data.results[0].source);
      console.log('- Title:', searchResponse.data.data.results[0].title);
      console.log('- Content preview:', searchResponse.data.data.results[0].content.substring(0, 200) + '...');
    }

  } catch (error: any) {
    console.error('❌ Knowledge scraping test failed:', error.response?.data || error.message);
    return false;
  }

  return true;
}

async function testAgentWithKnowledge() {
  console.log('\n\n🤖 Testing Agent Integration with Knowledge Base\n');

  try {
    // Initialize agent registry
    const agentRegistry = new AgentRegistry();
    await agentRegistry.initialize();

    // Get the enhanced retriever agent
    const retrieverAgent = await agentRegistry.getAgent('enhanced-retriever-agent');
    if (!retrieverAgent) {
      throw new Error('Enhanced retriever agent not found');
    }

    console.log('✅ Enhanced retriever agent loaded');

    // Test queries
    const testQueries = [
      'What are React hooks and how do useEffect work?',
      'Explain the difference between useState and useReducer in React',
      'How to implement authentication in Node.js with JWT?'
    ];

    for (const query of testQueries) {
      console.log(`\n📝 Testing query: "${query}"`);
      
      const context: AgentContext = {
        userRequest: query,
        requestId: `test-${Date.now()}`,
        userId: 'test-user',
        metadata: {}
      };

      const response = await retrieverAgent.execute(context);
      
      console.log('✅ Agent response received');
      console.log('- Success:', response.success);
      console.log('- Confidence:', response.confidence.toFixed(2));
      console.log('- Execution time:', response.executionTime, 'ms');
      
      // Check if knowledge base was used
      if (context.metadata?.knowledgeResultsCount) {
        console.log('- Knowledge base results used:', context.metadata.knowledgeResultsCount);
      }

      // Parse and display structured response
      try {
        const parsed = JSON.parse(response.content);
        if (parsed.research_summary?.key_findings) {
          console.log('\n📊 Key Findings:');
          parsed.research_summary.key_findings.slice(0, 3).forEach((finding: any, i: number) => {
            console.log(`${i + 1}. ${finding.finding} (confidence: ${finding.confidence})`);
          });
        }
      } catch (e) {
        console.log('- Response preview:', response.content.substring(0, 200) + '...');
      }
    }

  } catch (error) {
    console.error('❌ Agent test failed:', error);
    return false;
  }

  return true;
}

async function main() {
  console.log('🚀 Starting Knowledge Scraping and Agent Integration Test\n');

  // First, run the migration to ensure tables exist
  console.log('📦 Ensuring database tables exist...');
  try {
    // Check if knowledge_base table exists
    const { data, error } = await supabase
      .from('knowledge_base')
      .select('id')
      .limit(1);

    if (error && error.message.includes('relation "knowledge_base" does not exist')) {
      console.log('❌ Knowledge base tables not found. Please run:');
      console.log('   npx supabase migration up');
      console.log('   to create the required tables.');
      process.exit(1);
    }
    console.log('✅ Database tables verified');
  } catch (error) {
    console.error('❌ Database check failed:', error);
    process.exit(1);
  }

  // Test knowledge scraping
  const scrapingSuccess = await testKnowledgeScraping();
  
  if (scrapingSuccess) {
    // Test agent integration
    await testAgentWithKnowledge();
  }

  console.log('\n\n✅ Test completed!');
  console.log('\n📚 Next steps:');
  console.log('1. Run more comprehensive scraping: npm run knowledge:scrape');
  console.log('2. Monitor scraping progress: npm run knowledge:status');
  console.log('3. Test with more agents and queries');
}

// Run the test
main().catch(console.error);