# Neo4j and Supabase Integration

## Overview
The system now integrates Supabase conversation storage with Neo4j knowledge graphs to create a connected knowledge base from all conversations.

## Architecture

### Data Flow
1. **Conversations** → Saved to Supabase `context_storage` table
2. **Sync Service** → Processes conversations to extract entities and relationships
3. **Knowledge Graph** → Stores in Neo4j (or Supabase fallback)
4. **Query Engine** → Enables graph-based retrieval and reasoning

## Components

### 1. Context Storage (Supabase)
- **Table**: `context_storage`
- **Purpose**: Store conversation history with embeddings
- **Features**: 
  - 384-dimension embeddings for similarity search
  - Categories (conversation, project_info, etc.)
  - Metadata tracking

### 2. Knowledge Graph (Neo4j/Supabase)
- **Primary**: Neo4j graph database
- **Fallback**: Supabase tables (graph_entities, graph_relationships, graph_hyperedges)
- **Features**:
  - Entity extraction (people, technologies, concepts)
  - Relationship mapping
  - Hyperedges for n-ary relationships
  - Community detection

### 3. Sync Service
- **Service**: `conversation-graph-sync-service.ts`
- **Purpose**: Bridge between conversation storage and knowledge graph
- **Capabilities**:
  - Extract entities from conversations
  - Build relationships between entities
  - Create hyperedges for complex relationships
  - Track processing status

## API Endpoints

### Conversation Storage
- `POST /api/v1/conversation-context/save` - Save conversation
- `GET /api/v1/conversation-context/list` - List conversations
- `GET /api/v1/conversation-context/:id` - Get specific conversation

### Graph Sync
- `POST /api/v1/graph-sync/conversations` - Sync conversations to graph
- `GET /api/v1/graph-sync/status` - Check sync status
- `POST /api/v1/graph-sync/query` - Query graph from conversation
- `POST /api/v1/graph-sync/paths` - Find knowledge paths

## Usage Examples

### 1. Save and Sync a Conversation
```bash
# Save conversation
curl -X POST http://localhost:9999/api/v1/conversation-context/save \
  -H "Content-Type: application/json" \
  -d '{"summary": "Discussion about GraphRAG and knowledge graphs"}'

# Sync to graph
curl -X POST http://localhost:9999/api/v1/graph-sync/conversations \
  -H "Content-Type: application/json" \
  -d '{"userId": "claude-code-user", "limit": 5}'
```

### 2. Query Knowledge Graph
```bash
curl -X POST http://localhost:9999/api/v1/graph-sync/query \
  -H "Content-Type: application/json" \
  -d '{
    "conversationId": "b0ce3f09-f819-44ee-9cbd-7d1a68b351a9",
    "query": "What technologies are mentioned?",
    "maxHops": 2
  }'
```

### 3. Find Knowledge Paths
```bash
curl -X POST http://localhost:9999/api/v1/graph-sync/paths \
  -H "Content-Type: application/json" \
  -d '{
    "startTopic": "TypeScript",
    "endTopic": "GraphRAG"
  }'
```

## Benefits

1. **Connected Knowledge**: Conversations become nodes in a knowledge graph
2. **Relationship Discovery**: Automatically finds connections between topics
3. **Multi-hop Reasoning**: Query across multiple conversation contexts
4. **Community Detection**: Groups related concepts automatically
5. **Semantic Search**: Combines embeddings with graph traversal

## Configuration

### Neo4j Setup (Optional)
```bash
# Run Neo4j with Docker
docker run -d \
  --name neo4j \
  -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/password \
  neo4j:latest
```

### Environment Variables
```env
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password
```

## Processing Flow

1. **Entity Extraction**:
   - People, organizations, technologies
   - Concepts, projects, systems
   - Automatic embedding generation

2. **Relationship Building**:
   - implements, depends_on, relates_to
   - is_a, uses, extends
   - Bidirectional relationships

3. **Hyperedge Creation**:
   - Multi-entity relationships
   - Complex interactions
   - Contextual groupings

4. **Community Detection**:
   - Hierarchical clustering
   - Topic summarization
   - Centroid calculation

## Status Tracking

Conversations are marked with metadata after processing:
- `graphProcessed`: boolean
- `graphProcessedAt`: timestamp
- `entitiesExtracted`: count
- `relationshipsCreated`: count

## Fallback Mode

When Neo4j is unavailable, the system:
1. Falls back to Supabase storage
2. Creates tables if needed:
   - `graph_entities`
   - `graph_relationships`
   - `graph_hyperedges`
3. Maintains full functionality with SQL queries

## Future Enhancements

1. **Real-time Sync**: Automatic processing on conversation save
2. **Graph Visualization**: D3.js or Cytoscape integration
3. **ML-Enhanced Extraction**: Better entity recognition
4. **Cross-User Graphs**: Shared knowledge networks
5. **Temporal Graphs**: Time-based relationship evolution