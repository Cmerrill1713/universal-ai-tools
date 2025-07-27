#!/usr/bin/env tsx

import { readFileSync } from 'fs';

// Memory data for GraphQL knowledge
const memories = [
  {
    content: readFileSync(
      '/Users/christianmerrill/Desktop/universal-ai-tools/graphql_apollo_server_memory_1.md',
      'utf8'
    ),
    metadata: {
      serviceId: 'universal-ai-tools-knowledge',
      memoryType: 'graphql_apollo_server',
      title: 'GraphQL Apollo Server TypeScript Best Practices',
      category: 'graphql',
      subcategory: 'apollo-server',
      tags: ['graphql', 'apollo-server', 'typescript', 'best-practices', 'modern-setup'],
      useCases: [
        'apollo-server-setup',
        'typescript-graphql',
        'schema-first-development',
        'production-deployment',
        'express-integration',
      ],
      technologies: ['Apollo Server 5.x', 'TypeScript', 'Express', 'GraphQL'],
      difficulty: 'intermediate',
      importance: 0.95,
      lastUpdated: new Date().toISOString(),
    },
    tags: ['graphql', 'apollo-server', 'typescript', 'best-practices', 'setup', 'express'],
    userId: 'system',
  },
  {
    content: readFileSync(
      '/Users/christianmerrill/Desktop/universal-ai-tools/graphql_performance_memory_2.md',
      'utf8'
    ),
    metadata: {
      serviceId: 'universal-ai-tools-knowledge',
      memoryType: 'graphql_performance',
      title: 'GraphQL Performance Optimization Techniques',
      category: 'graphql',
      subcategory: 'performance',
      tags: ['graphql', 'performance', 'optimization', 'dataloader', 'caching', 'pagination'],
      useCases: [
        'n-plus-one-problem',
        'query-optimization',
        'caching-strategies',
        'pagination-implementation',
        'performance-monitoring',
      ],
      technologies: ['DataLoader', 'Redis', 'APQ', 'Relay Pagination'],
      difficulty: 'advanced',
      importance: 0.92,
      lastUpdated: new Date().toISOString(),
    },
    tags: ['graphql', 'performance', 'optimization', 'dataloader', 'caching', 'pagination'],
    userId: 'system',
  },
  {
    content: readFileSync(
      '/Users/christianmerrill/Desktop/universal-ai-tools/graphql_architecture_memory_3.md',
      'utf8'
    ),
    metadata: {
      serviceId: 'universal-ai-tools-knowledge',
      memoryType: 'graphql_architecture',
      title: 'GraphQL Architecture Patterns and Best Practices',
      category: 'graphql',
      subcategory: 'architecture',
      tags: ['graphql', 'architecture', 'patterns', 'security', 'testing', 'subscriptions'],
      useCases: [
        'resolver-patterns',
        'schema-organization',
        'error-handling',
        'security-implementation',
        'real-time-subscriptions',
      ],
      technologies: ['GraphQL Tools', 'Federation', 'WebSockets', 'Jest'],
      difficulty: 'advanced',
      importance: 0.94,
      lastUpdated: new Date().toISOString(),
    },
    tags: ['graphql', 'architecture', 'patterns', 'security', 'testing', 'subscriptions'],
    userId: 'system',
  },
];

async function addGraphQLMemories() {
  console.log('🚀 Adding GraphQL Apollo Server knowledge to memory system via API...');

  for (const memory of memories) {
    try {
      console.log(`📝 Adding memory: ${memory.metadata.title}`);

      const response = await fetch('http://localhost:9999/api/v1/memory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Service-Name': 'universal-ai-tools',
          'X-Service-Version': '1.0.0',
        },
        body: JSON.stringify(memory),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ API Error (${response.status}):`, errorText);
        continue;
      }

      const result = await response.json();
      console.log(
        `✅ Successfully added memory: ${memory.metadata.title} (ID: ${result.data?.id})`
      );
    } catch (error) {
      console.error('❌ Network error:', error);
    }
  }

  console.log('🎉 GraphQL knowledge upload attempts completed!');

  // Verify memories were added
  try {
    const verifyResponse = await fetch(
      'http://localhost:9999/api/v1/memory?memory_type=graphql_apollo_server,graphql_performance,graphql_architecture',
      {
        headers: {
          'X-Service-Name': 'universal-ai-tools',
          'X-Service-Version': '1.0.0',
        },
      }
    );

    if (verifyResponse.ok) {
      const verifyData = await verifyResponse.json();
      console.log('\n📊 Verification - Added memories:');
      if (verifyData.memories && verifyData.memories.length > 0) {
        verifyData.memories.forEach((memory: any) => {
          console.log(
            `   - ${memory.memory_type}: ${memory.metadata?.title || 'No title'} (ID: ${memory.id})`
          );
        });
      } else {
        console.log('   No memories found matching the criteria');
      }
    } else {
      console.error('❌ Error verifying memories:', await verifyResponse.text());
    }
  } catch (error) {
    console.error('❌ Error during verification:', error);
  }
}

// Execute the script
addGraphQLMemories().catch(console.error);
