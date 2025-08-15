#!/usr/bin/env node

/**
 * Simple Content Seeding for RAG System
 * 
 * Seeds the knowledge base with key information about the project
 * by having conversations that will be stored by the context system
 */

const CONTENT_ITEMS = [
  {
    query: "What is the Universal AI Tools project and what are its main features?",
    expectedContext: "project overview, features, architecture"
  },
  {
    query: "How does the RAG system work in Universal AI Tools?",
    expectedContext: "RAG implementation, semantic search, knowledge graph"
  },
  {
    query: "What are the key components of the SwiftUI macOS app?",
    expectedContext: "SwiftUI architecture, components, RAG controls"
  },
  {
    query: "How do I set up and run the local LLM server?",
    expectedContext: "development setup, local LLM configuration"
  },
  {
    query: "What ports does the Universal AI Tools system use?",
    expectedContext: "port configuration, server architecture"
  }
];

async function seedWithConversations() {
  console.log('🌱 Seeding knowledge base with conversations...');
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const item of CONTENT_ITEMS) {
    try {
      console.log(`💬 Asking: ${item.query}`);
      
      const response = await fetch('http://localhost:7456/local/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: item.query,
          useRAG: false, // Don't use RAG for seeding
          sessionId: 'knowledge-seeding',
          projectPath: '/Users/christianmerrill/Desktop/universal-ai-tools',
          provider: 'ollama',
          model: 'tinyllama:latest',
          temperature: 0.7,
          max_tokens: 300
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        successCount++;
        console.log(`✅ Response generated and will be stored in context`);
        console.log(`   Preview: ${result.response.substring(0, 100)}...`);
      } else {
        const errorText = await response.text();
        errorCount++;
        console.log(`❌ Failed: ${response.status}: ${errorText}`);
      }
      
      // Delay between requests
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      errorCount++;
      console.error(`❌ Error:`, error.message);
    }
  }
  
  console.log(`\n📊 Seeding complete:`);
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log(`\n💡 These conversations should now be available for RAG retrieval!`);
}

async function testRAGRetrieval() {
  console.log('\n🔍 Testing RAG retrieval with seeded content...');
  
  try {
    const response = await fetch('http://localhost:7456/local/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: "Tell me about the Universal AI Tools project architecture",
        useRAG: true,
        maxContext: 5,
        sessionId: 'rag-test',
        projectPath: '/Users/christianmerrill/Desktop/universal-ai-tools',
        provider: 'ollama',
        model: 'tinyllama:latest',
        temperature: 0.7,
        max_tokens: 400
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log(`✅ RAG test successful!`);
      console.log(`📝 Response: ${result.response}`);
      
      if (result.rag) {
        console.log(`📊 RAG metadata:`, {
          contextUsed: result.rag.contextUsed,
          sources: result.rag.sources?.length || 0,
          graphPaths: result.rag.graphPaths
        });
      }
    } else {
      console.log(`❌ RAG test failed: ${response.status}`);
    }
  } catch (error) {
    console.error(`❌ RAG test error:`, error.message);
  }
}

async function main() {
  console.log('🚀 Starting knowledge base seeding process...\n');
  
  // First, seed with conversations
  await seedWithConversations();
  
  // Then test if RAG can retrieve the content
  await testRAGRetrieval();
  
  console.log('\n🎉 Knowledge base seeding complete!');
  console.log('💡 You can now test enhanced responses with RAG enabled.');
}

main().catch(console.error);