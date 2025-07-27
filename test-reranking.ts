#!/usr/bin/env tsx
/**
 * Test Reranking System
 */

import 'dotenv/config';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

const API_BASE = 'http://localhost:9999/api/v1';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function testRerankingSearch() {
  console.log('🧪 Testing Reranking System\n');

  try {
    // Test queries
    const testQueries = [
      {
        query: 'React hooks useEffect cleanup',
        description: 'Testing technical query with reranking',
      },
      {
        query: 'JavaScript async await error handling',
        description: 'Testing programming concept query',
      },
      {
        query: 'How to optimize database queries',
        description: 'Testing general optimization query',
      },
    ];

    for (const testCase of testQueries) {
      console.log(`\n📝 Test: ${testCase.description}`);
      console.log(`Query: "${testCase.query}"`);
      console.log('-'.repeat(60));

      // First, search WITHOUT reranking
      console.log('\n1️⃣ Without Reranking:');
      const normalResponse = await axios.get(`${API_BASE}/knowledge/search`, {
        params: {
          query: testCase.query,
          limit: 5,
          useReranking: 'false',
        },
      });

      if (normalResponse.data.success) {
        console.log(`✅ Found ${normalResponse.data.data.count} results`);
        normalResponse.data.data.results.slice(0, 3).forEach((result: any, idx: number) => {
          console.log(`\n  ${idx + 1}. ${result.title || 'Untitled'}`);
          console.log(`     Source: ${result.source}`);
          console.log(`     Score: ${result.similarity?.toFixed(4) || 'N/A'}`);
          console.log(`     Preview: ${result.content.substring(0, 100)}...`);
        });
      }

      // Then, search WITH reranking
      console.log('\n\n2️⃣ With Reranking:');
      const rerankResponse = await axios.get(`${API_BASE}/knowledge/search`, {
        params: {
          query: testCase.query,
          limit: 5,
          useReranking: 'true',
          rerankingModel: 'cross-encoder/ms-marco-MiniLM-L-12-v2',
        },
      });

      if (rerankResponse.data.success) {
        console.log(`✅ Found ${rerankResponse.data.data.count} results (reranked)`);
        rerankResponse.data.data.results.slice(0, 3).forEach((result: any, idx: number) => {
          console.log(`\n  ${idx + 1}. ${result.title || 'Untitled'}`);
          console.log(`     Source: ${result.source}`);
          console.log(`     Bi-encoder: ${result.similarity?.toFixed(4) || 'N/A'}`);
          console.log(`     Reranking: ${result.reranking_score?.toFixed(4) || 'N/A'}`);
          console.log(`     Preview: ${result.content.substring(0, 100)}...`);
        });
      }
    }

    // Get reranking statistics
    console.log('\n\n📊 Reranking Statistics:');
    const statsResponse = await axios.get(`${API_BASE}/knowledge/reranking/stats`);
    if (statsResponse.data.success) {
      const stats = statsResponse.data.data;
      console.log(`Total queries: ${stats.totalQueries}`);
      console.log(`Average reduction rate: ${(stats.averageReductionRate * 100).toFixed(1)}%`);
      console.log('Model usage:');
      Object.entries(stats.modelUsage).forEach(([model, count]) => {
        console.log(`  - ${model}: ${count} queries`);
      });
    }

  } catch (error: any) {
    console.error('❌ Reranking test failed:', error.response?.data || error.message);
    if (error.response?.data?.error?.details) {
      console.error('Validation errors:', JSON.stringify(error.response.data.error.details, null, 2));
    }
    return false;
  }

  return true;
}

async function main() {
  console.log('🚀 Starting Reranking System Test\n');

  // Check if knowledge base has entries
  const { count } = await supabase
    .from('knowledge_base')
    .select('*', { count: 'exact', head: true });

  if (!count || count === 0) {
    console.log('⚠️ Knowledge base is empty. Please run knowledge scraping first:');
    console.log('   npm run knowledge:scrape');
    process.exit(1);
  }

  console.log(`✅ Knowledge base contains ${count} entries`);

  // Test reranking
  await testRerankingSearch();

  console.log('\n\n✅ Reranking test completed!');
  console.log('\n📚 Next steps:');
  console.log('1. Monitor reranking performance with different queries');
  console.log('2. Test with different reranking models');
  console.log('3. Analyze the quality improvement from reranking');
}

// Run the test
main().catch(console.error);