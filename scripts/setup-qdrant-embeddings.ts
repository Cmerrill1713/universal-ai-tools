#!/usr/bin/env npx tsx

import { QdrantClient } from '@qdrant/js-client-rest';

// Qdrant client configuration
const qdrantClient = new QdrantClient({
  url: 'http://localhost:6333',
  apiKey: process.env.QDRANT_API_KEY,
});

// Sample data for embeddings
const sampleDocuments = [
  {
    id: 1,
    text: "Universal AI Tools is a comprehensive platform for AI development",
    category: "overview",
    metadata: { source: "documentation", importance: "high" }
  },
  {
    id: 2,
    text: "The system uses Rust for high-performance LLM routing and inference",
    category: "architecture",
    metadata: { source: "technical", importance: "high" }
  },
  {
    id: 3,
    text: "Go services handle WebSocket connections and API gateway functionality",
    category: "architecture",
    metadata: { source: "technical", importance: "high" }
  },
  {
    id: 4,
    text: "Swift and SwiftUI power the native macOS application",
    category: "frontend",
    metadata: { source: "technical", importance: "medium" }
  },
  {
    id: 5,
    text: "Ollama provides local LLM inference for offline AI capabilities",
    category: "features",
    metadata: { source: "documentation", importance: "high" }
  },
  {
    id: 6,
    text: "JWT authentication ensures secure API access across all services",
    category: "security",
    metadata: { source: "technical", importance: "high" }
  },
  {
    id: 7,
    text: "OpenTelemetry tracing provides distributed observability",
    category: "monitoring",
    metadata: { source: "technical", importance: "medium" }
  },
  {
    id: 8,
    text: "Qdrant vector database enables semantic search and RAG capabilities",
    category: "features",
    metadata: { source: "technical", importance: "high" }
  }
];

// Simple text to embedding function (mock - replace with actual embedding model)
async function generateEmbedding(text: string): Promise<number[]> {
  // In production, use an actual embedding model like:
  // - OpenAI's text-embedding-ada-002
  // - Sentence Transformers
  // - Local embedding model via Ollama
  
  // For now, create a simple mock embedding (384 dimensions to match common models)
  const embedding = new Array(384).fill(0).map(() => Math.random() * 2 - 1);
  
  // Normalize the vector
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return embedding.map(val => val / magnitude);
}

async function setupQdrantCollections() {
  process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.log("🚀 Setting up Qdrant vector collections...\n");
  
  const collections = [
    {
      name: "universal_ai_docs",
      vectorSize: 384,
      distance: "Cosine" as const
    },
    {
      name: "code_embeddings",
      vectorSize: 384,
      distance: "Cosine" as const
    },
    {
      name: "chat_history",
      vectorSize: 384,
      distance: "Cosine" as const
    }
  ];
  
  for (const collection of collections) {
    try {
      // Check if collection exists
      const collectionInfo = await qdrantClient.getCollection(collection.name);
      console.log(`✅ Collection '${collection.name}' already exists`);
    } catch {
      // Create collection if it doesn't exist
      try {
        await qdrantClient.createCollection(collection.name, {
          vectors: {
            size: collection.vectorSize,
            distance: collection.distance,
          },
          optimizers_config: {
            default_segment_number: 2,
          },
          replication_factor: 1,
        });
        console.log(`✅ Created collection '${collection.name}'`);
      } catch (error) {
        process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.error(`❌ Failed to create collection '${collection.name}':`, error);
      }
    }
  }
}

async function populateSampleData() {
  console.log("\n📝 Populating sample embeddings...\n");
  
  const points = await Promise.all(
    sampleDocuments.map(async (doc) => {
      const embedding = await generateEmbedding(doc.text);
      return {
        id: doc.id,
        vector: embedding,
        payload: {
          text: doc.text,
          category: doc.category,
          ...doc.metadata,
          timestamp: new Date().toISOString()
        }
      };
    })
  );
  
  try {
    await qdrantClient.upsert("universal_ai_docs", {
      wait: true,
      points: points
    });
    
    console.log(`✅ Inserted ${points.length} sample documents into 'universal_ai_docs'`);
  } catch (error) {
    console.error("❌ Failed to insert sample data:", error);
  }
}

async function testSemanticSearch() {
  console.log("\n🔍 Testing semantic search...\n");
  
  const queries = [
    "How does authentication work?",
    "What programming languages are used?",
    "Tell me about the architecture"
  ];
  
  for (const query of queries) {
    console.log(`Query: "${query}"`);
    
    const queryEmbedding = await generateEmbedding(query);
    
    try {
      const searchResult = await qdrantClient.search("universal_ai_docs", {
        vector: queryEmbedding,
        limit: 3,
        with_payload: true,
      });
      
      console.log("Top results:");
      searchResult.forEach((result, index) => {
        console.log(`  ${index + 1}. [Score: ${result.score?.toFixed(3)}] ${result.payload?.text}`);
      });
      console.log();
    } catch (error) {
      console.error(`❌ Search failed for query "${query}":`, error);
    }
  }
}

async function getCollectionStats() {
  console.log("\n📊 Collection Statistics:\n");
  
  try {
    const collections = await qdrantClient.getCollections();
    
    for (const collection of collections.collections) {
      const info = await qdrantClient.getCollection(collection.name);
      console.log(`Collection: ${collection.name}`);
      console.log(`  - Vectors: ${info.vectors_count || 0}`);
      console.log(`  - Points: ${info.points_count || 0}`);
      console.log(`  - Status: ${info.status}`);
      console.log();
    }
  } catch (error) {
    console.error("❌ Failed to get collection stats:", error);
  }
}

async function main() {
  console.log("====================================");
  console.log("🎯 Qdrant Vector Database Setup");
  console.log("====================================\n");
  
  try {
    // Check Qdrant health
    const health = await qdrantClient.api('get', '/');
    console.log("✅ Qdrant is healthy:", health.data);
    console.log();
    
    // Setup collections
    await setupQdrantCollections();
    
    // Populate sample data
    await populateSampleData();
    
    // Test semantic search
    await testSemanticSearch();
    
    // Show statistics
    await getCollectionStats();
    
    console.log("✅ Qdrant setup complete!");
    
  } catch (error) {
    console.error("❌ Setup failed:", error);
    process.exit(1);
  }
}

// Run the setup
main().catch(console.error);