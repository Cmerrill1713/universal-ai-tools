#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import path from 'path';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const supabase = createClient(supabaseUrl, supabaseKey);

// Memory data for GraphQL knowledge
const memories = [
  {
    serviceId: 'universal-ai-tools-knowledge',
    memoryType: 'graphql_apollo_server',
    content: readFileSync('/Users/christianmerrill/Desktop/universal-ai-tools/graphql_apollo_server_memory_1.md', 'utf8'),
    importance: 0.95,
    metadata: {
      title: 'GraphQL Apollo Server TypeScript Best Practices',
      category: 'graphql',
      subcategory: 'apollo-server',
      tags: ['graphql', 'apollo-server', 'typescript', 'best-practices', 'modern-setup'],
      useCases: [
        'apollo-server-setup',
        'typescript-graphql',
        'schema-first-development',
        'production-deployment',
        'express-integration'
      ],
      technologies: ['Apollo Server 5.x', 'TypeScript', 'Express', 'GraphQL'],
      difficulty: 'intermediate',
      lastUpdated: new Date().toISOString()
    },
    tags: ['graphql', 'apollo-server', 'typescript', 'best-practices', 'setup', 'express']
  },
  {
    serviceId: 'universal-ai-tools-knowledge',
    memoryType: 'graphql_performance',
    content: readFileSync('/Users/christianmerrill/Desktop/universal-ai-tools/graphql_performance_memory_2.md', 'utf8'),
    importance: 0.92,
    metadata: {
      title: 'GraphQL Performance Optimization Techniques',
      category: 'graphql',
      subcategory: 'performance',
      tags: ['graphql', 'performance', 'optimization', 'dataloader', 'caching', 'pagination'],
      useCases: [
        'n-plus-one-problem',
        'query-optimization',
        'caching-strategies',
        'pagination-implementation',
        'performance-monitoring'
      ],
      technologies: ['DataLoader', 'Redis', 'APQ', 'Relay Pagination'],
      difficulty: 'advanced',
      lastUpdated: new Date().toISOString()
    },
    tags: ['graphql', 'performance', 'optimization', 'dataloader', 'caching', 'pagination']
  },
  {
    serviceId: 'universal-ai-tools-knowledge',
    memoryType: 'graphql_architecture',
    content: readFileSync('/Users/christianmerrill/Desktop/universal-ai-tools/graphql_architecture_memory_3.md', 'utf8'),
    importance: 0.94,
    metadata: {
      title: 'GraphQL Architecture Patterns and Best Practices',
      category: 'graphql',
      subcategory: 'architecture',
      tags: ['graphql', 'architecture', 'patterns', 'security', 'testing', 'subscriptions'],
      useCases: [
        'resolver-patterns',
        'schema-organization',
        'error-handling',
        'security-implementation',
        'real-time-subscriptions'
      ],
      technologies: ['GraphQL Tools', 'Federation', 'WebSockets', 'Jest'],
      difficulty: 'advanced',
      lastUpdated: new Date().toISOString()
    },
    tags: ['graphql', 'architecture', 'patterns', 'security', 'testing', 'subscriptions']
  }
];

async function addGraphQLMemories() {
  console.log('🚀 Adding GraphQL Apollo Server knowledge to memory system...');

  for (const memory of memories) {
    try {
      console.log(`📝 Adding memory: ${memory.metadata.title}`);

      // Insert memory into ai_memories table (without embedding for now)
      const { data, error } = await supabase
        .from('ai_memories')
        .insert({
          service_id: memory.serviceId,
          memory_type: memory.memoryType,
          content: memory.content,
          importance_score: memory.importance,
          metadata: memory.metadata,
          keywords: memory.tags,
          memory_category: 'technical_knowledge'
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Error inserting memory:', error);
        continue;
      }

      console.log(`✅ Successfully added memory: ${memory.metadata.title} (ID: ${data.id})`);
      
    } catch (error) {
      console.error('❌ Unexpected error:', error);
    }
  }

  console.log('🎉 GraphQL knowledge successfully added to memory system!');
  
  // Verify memories were added
  const { data: verifyData, error: verifyError } = await supabase
    .from('ai_memories')
    .select('id, memory_type, metadata')
    .eq('service_id', 'universal-ai-tools-knowledge')
    .in('memory_type', ['graphql_apollo_server', 'graphql_performance', 'graphql_architecture']);

  if (verifyError) {
    console.error('❌ Error verifying memories:', verifyError);
  } else {
    console.log('\n📊 Verification - Added memories:');
    verifyData.forEach(memory => {
      console.log(`   - ${memory.memory_type}: ${memory.metadata.title} (ID: ${memory.id})`);
    });
  }
}

// Execute the script
addGraphQLMemories().catch(console.error);