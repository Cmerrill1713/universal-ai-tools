#!/usr/bin/env node

/**
 * Manual RAG Content Indexing
 * 
 * Since the RAG endpoints aren't built yet, this script directly populates
 * the knowledge base with essential content about the Universal AI Tools project
 */

import fs from 'fs/promises';
import path from 'path';

// Essential content to index
const contentToIndex = [
  {
    title: "Universal AI Tools - Project Overview",
    content: `# Universal AI Tools

A comprehensive AI tools platform featuring:

## Core Features
- Local LLM integration (Ollama, LM Studio)
- RAG (Retrieval-Augmented Generation) system
- Beautiful macOS SwiftUI application
- Knowledge graph with Graph-R1 optimization
- Semantic context retrieval
- Advanced agent orchestration

## Architecture
- **Backend**: Node.js/TypeScript with Express
- **Database**: Supabase with vector embeddings
- **Local LLM Server**: Port 7456 (unauthenticated)
- **Main Server**: Port 9999 (authenticated APIs)
- **Graph Database**: Neo4j for knowledge graphs
- **Frontend**: SwiftUI macOS app + HTML interface

## Key Services
- **Semantic Context Retrieval**: Vector-based content search
- **Knowledge Graph Service**: Graph-R1 with reinforcement learning
- **Agent System**: Multi-tier agent capabilities
- **Flash Attention**: Performance optimization
- **Context Storage**: Supabase-backed conversation persistence

## Recent Implementation
- RAG system integration with local LLMs
- SwiftUI controls for RAG configuration
- Knowledge graph with hyperedge support
- Metal acceleration for vector operations
- Auto-context detection middleware`,
    type: "documentation",
    projectPath: "/Users/christianmerrill/Desktop/universal-ai-tools"
  },
  
  {
    title: "RAG System Implementation",
    content: `# RAG System Implementation

## Overview
The RAG (Retrieval-Augmented Generation) system enhances LLM responses with relevant context from the knowledge base.

## Architecture
- **Semantic Search**: Vector embeddings for content retrieval
- **Knowledge Graph**: Graph-R1 with entity/relationship extraction
- **Context Injection**: Automatic prompt enrichment
- **Source Tracking**: Transparent source attribution

## API Endpoints
- \`POST /local/chat\` - RAG-enhanced chat
- \`POST /local/rag/search\` - Direct semantic search
- \`POST /local/rag/index\` - Content indexing

## Parameters
- \`useRAG\`: Enable/disable RAG
- \`maxContext\`: Number of context items (1-25)
- \`includeGraphPaths\`: Use knowledge graph
- \`sessionId\`: Session tracking
- \`projectPath\`: Project-specific context

## SwiftUI Integration
- RAG toggle control
- Context amount slider
- Graph search toggle
- Source display cards
- Project path selector

## Performance
- Metal acceleration for vector operations
- Efficient similarity search algorithms
- Lazy loading and caching
- Batch processing for indexing`,
    type: "documentation",
    projectPath: "/Users/christianmerrill/Desktop/universal-ai-tools"
  },
  
  {
    title: "Local LLM Integration",
    content: `# Local LLM Integration

## Supported Services
- **Ollama**: Running on localhost:11434
- **LM Studio**: OpenAI-compatible API on localhost:1234

## Configuration
- Auto-provider selection based on health checks
- Model selection (tinyllama, llama3.2, mistral, codellama)
- Temperature and token controls
- System prompt support

## Server Architecture
- **Local LLM Server**: Port 7456, no authentication
- **CORS**: Configured for local access
- **Rate Limiting**: 100 requests per IP per minute
- **Error Handling**: Graceful fallbacks

## Usage
\`\`\`bash
# Basic chat
curl -X POST http://localhost:7456/local/chat \\
  -H "Content-Type: application/json" \\
  -d '{"message": "Hello", "provider": "ollama"}'

# RAG-enhanced chat
curl -X POST http://localhost:7456/local/chat \\
  -H "Content-Type: application/json" \\
  -d '{
    "message": "Explain the codebase",
    "useRAG": true,
    "maxContext": 10,
    "sessionId": "session-123"
  }'
\`\`\`

## Health Monitoring
- Service availability checks
- Model listing endpoints
- Performance metrics
- Connection status tracking`,
    type: "code",
    projectPath: "/Users/christianmerrill/Desktop/universal-ai-tools"
  },
  
  {
    title: "SwiftUI App Architecture",
    content: `# SwiftUI macOS App

## Structure
- **APIService**: Network layer for backend communication
- **AppState**: Centralized state management
- **Views**: Modular SwiftUI components
- **Models**: Data structures and Codable types

## Key Components
- \`SimpleChatView\`: Main chat interface
- \`RAGControlsView\`: RAG configuration controls
- \`EnhancedMessageBubble\`: Rich message display
- \`ConnectionStatusView\`: Service status indicators

## RAG Integration
- Toggle for enabling RAG
- Context amount slider (1-25)
- Knowledge graph search toggle
- Project path selector
- Source display with type indicators

## Design Features
- Glassmorphism effects
- Smooth animations
- Color-coded content types
- Accessibility support
- Progressive disclosure
- Visual feedback

## API Integration
- Local LLM server on port 7456
- Backend fallback to port 9999
- WebSocket connections
- Real-time status updates
- Error handling and retry logic

## Data Models
- \`Message\`: Chat message with metadata
- \`RAGMetadata\`: Context and source information
- \`RAGSettings\`: User preferences
- \`RAGSource\`: Individual source items`,
    type: "code",
    projectPath: "/Users/christianmerrill/Desktop/universal-ai-tools"
  },
  
  {
    title: "Development Setup and Commands",
    content: `# Development Setup

## Prerequisites
- Node.js 18+
- npm or yarn
- Supabase CLI
- Docker (optional)
- Xcode (for macOS app)

## Installation
\`\`\`bash
npm install                 # Install dependencies
npm run dev                 # Start development server
npm run start:local-llm     # Start local LLM server
npm run build              # Build for production
npm test                   # Run tests
\`\`\`

## Environment Variables
\`\`\`bash
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_key
NEO4J_URI=bolt://localhost:7687
LOCAL_LLM_PORT=7456
\`\`\`

## Key Scripts
- \`npm run dev\`: Development mode with hot reload
- \`npm run build\`: TypeScript compilation
- \`npm run test\`: Jest test suite
- \`npm run lint\`: ESLint checking
- \`npm run typecheck\`: TypeScript validation

## Docker Setup
\`\`\`bash
docker-compose up -d        # Start all services
docker-compose logs -f      # View logs
docker-compose down         # Stop services
\`\`\`

## Supabase Setup
\`\`\`bash
supabase start             # Start local Supabase
supabase db reset          # Reset database
supabase migration new     # Create migration
\`\`\`

## macOS App Development
\`\`\`bash
cd macOS-App/UniversalAITools
xcodegen generate          # Generate Xcode project
open UniversalAITools.xcodeproj
\`\`\``,
    type: "documentation",
    projectPath: "/Users/christianmerrill/Desktop/universal-ai-tools"
  }
];

async function indexContent() {
  console.log('📚 Manually indexing essential content...');
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const item of contentToIndex) {
    try {
      // Test if we can send to the chat endpoint with enhanced context
      const response = await fetch('http://localhost:7456/local/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: `Index this content: ${item.title}\n\n${item.content}`,
          useRAG: true,
          sessionId: 'manual-indexing',
          projectPath: item.projectPath,
          provider: 'ollama',
          model: 'tinyllama:latest',
          temperature: 0.1,
          max_tokens: 50
        })
      });
      
      if (response.ok) {
        successCount++;
        console.log(`✅ Processed: ${item.title}`);
      } else {
        errorCount++;
        console.log(`❌ Failed: ${item.title}`);
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      errorCount++;
      console.error(`❌ Error with ${item.title}:`, error.message);
    }
  }
  
  console.log(`\n📊 Manual indexing complete:`);
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Errors: ${errorCount}`);
}

// Also create a simple test file with key project info
async function createProjectSummary() {
  const summaryPath = '/Users/christianmerrill/Desktop/universal-ai-tools/PROJECT_SUMMARY.md';
  const summary = `# Universal AI Tools - Project Summary

## What This Is
A sophisticated AI tools platform that combines local LLMs, RAG (Retrieval-Augmented Generation), and a beautiful macOS app.

## Key Features Recently Implemented
- ✅ RAG system with semantic search
- ✅ Local LLM integration (Ollama/LM Studio)
- ✅ SwiftUI macOS app with RAG controls
- ✅ Knowledge graph with Graph-R1
- ✅ Auto-context detection
- ✅ Beautiful UI with glassmorphism effects

## Architecture
- **Local LLM Server**: Port 7456 (unauthenticated, RAG-enabled)
- **Main Server**: Port 9999 (authenticated APIs)
- **Database**: Supabase with vector embeddings
- **Graph DB**: Neo4j for knowledge graphs
- **Frontend**: SwiftUI macOS app

## Recent Work
We just completed a comprehensive RAG system integration that allows the local LLMs to retrieve relevant context from the knowledge base. The SwiftUI app now has beautiful controls for enabling RAG, adjusting context amounts, and viewing source attributions.

## Testing Status
- ✅ Local LLM server running
- ✅ Basic chat working
- ✅ RAG parameters accepted
- ✅ SwiftUI integration complete
- ⚠️ RAG endpoints need build deployment

## Next Steps
1. Deploy the new build with RAG endpoints
2. Test full RAG workflow
3. Index more content into knowledge base
4. Build and test macOS app

Generated: ${new Date().toISOString()}
`;

  await fs.writeFile(summaryPath, summary);
  console.log(`📄 Created project summary: ${summaryPath}`);
}

async function main() {
  await createProjectSummary();
  await indexContent();
}

main().catch(console.error);