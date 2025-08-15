# GraphRAG R1 Setup and Configuration Guide

## Overview

GraphRAG R1 is our implementation of Graph-based Retrieval Augmented Generation with reinforcement learning enhancements, based on the Graph-R1 paper. It provides knowledge graph construction, entity extraction, and multi-hop reasoning capabilities at a cost-efficient rate of $2.81 per 1K tokens.

## Features

- **Entity and Relationship Extraction**: Automated extraction using LLMs
- **Hypergraph Construction**: Support for n-ary relationships
- **Community Detection**: Hierarchical clustering and summarization
- **Multi-hop Reasoning**: Path-based retrieval with configurable hop limits
- **Reinforcement Learning**: GRPO (Graph Reinforcement Policy Optimization) for improved traversal
- **Neo4j Integration**: Persistent graph storage with fallback to in-memory operations
- **Context Integration**: Seamless integration with existing context storage service

## Prerequisites

1. **Neo4j Database** (optional but recommended)
   - Docker installed
   - Port 7687 available for Bolt protocol
   - Port 7474 available for HTTP interface

2. **Local LLM** (for entity extraction)
   - Ollama installed and running
   - At least one model installed (e.g., `tinyllama:latest`)

3. **Node.js Dependencies**
   ```bash
   npm install neo4j-driver
   ```

## Installation Steps

### 1. Install Dependencies

```bash
# Install Neo4j driver
npm install neo4j-driver

# Verify installation
npm list neo4j-driver
```

### 2. Configure Environment Variables

Add the following to your `.env` file:

```env
# Neo4j Configuration for GraphRAG R1
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password123
```

### 3. Set Up Neo4j Database

#### Option A: Using Docker (Recommended)

```bash
# Pull and run Neo4j with Graph Data Science plugin
docker run -d \
  --name neo4j-graphrag \
  -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/password123 \
  -e NEO4J_PLUGINS='["graph-data-science"]' \
  neo4j:latest

# Verify container is running
docker ps | grep neo4j-graphrag

# Check logs
docker logs neo4j-graphrag
```

#### Option B: Local Installation

1. Download Neo4j from https://neo4j.com/download/
2. Install Graph Data Science plugin
3. Configure authentication
4. Start Neo4j service

### 4. Verify Installation

```bash
# Check Neo4j connection
curl -u neo4j:password123 http://localhost:7474/db/neo4j/

# Test GraphRAG health endpoint
curl -X GET http://localhost:9999/api/v1/graphrag/health \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## API Endpoints

### Health Check
```bash
GET /api/v1/graphrag/health
```

Returns the status of GraphRAG service including Neo4j connection status.

### Build Knowledge Graph
```bash
POST /api/v1/graphrag/build
Content-Type: application/json
Authorization: Bearer YOUR_JWT_TOKEN

{
  "texts": ["Array of texts to process"],
  "contextIds": ["Optional array of existing context IDs"],
  "source": "source_identifier",
  "includeEmbeddings": true,
  "detectCommunities": false,
  "useExistingContext": true
}
```

### Query Knowledge Graph
```bash
POST /api/v1/graphrag/query
Content-Type: application/json
Authorization: Bearer YOUR_JWT_TOKEN

{
  "query": "Your search query",
  "maxHops": 3,
  "includeNeighbors": true,
  "communityLevel": 1,
  "useRL": false,
  "limit": 10
}
```

### Extract Entities
```bash
POST /api/v1/graphrag/extract-entities
Content-Type: application/json
Authorization: Bearer YOUR_JWT_TOKEN

{
  "text": "Text to extract entities from",
  "model": "optional_model_name",
  "includeEmbeddings": false,
  "contextWindow": 2000
}
```

### Get Metrics
```bash
GET /api/v1/graphrag/metrics
Authorization: Bearer YOUR_JWT_TOKEN
```

### Visualize Graph
```bash
GET /api/v1/graphrag/visualize
Authorization: Bearer YOUR_JWT_TOKEN
```

Returns Cytoscape-compatible graph format for visualization.

## Usage Examples

### Building a Knowledge Graph from Context

```javascript
// Using existing context from Supabase
const response = await fetch('http://localhost:9999/api/v1/graphrag/build', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    useExistingContext: true,
    source: 'documentation',
    includeEmbeddings: true,
    detectCommunities: true
  })
});
```

### Querying with Reinforcement Learning

```javascript
// Multi-hop reasoning with RL optimization
const response = await fetch('http://localhost:9999/api/v1/graphrag/query', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    query: "How does authentication work with GraphRAG?",
    maxHops: 5,
    useRL: true,
    includeNeighbors: true
  })
});
```

## Architecture

### Core Components

1. **Knowledge Graph Service** (`src/services/graph-rag/knowledge-graph-service.ts`)
   - Manages Neo4j connection
   - Handles graph operations
   - Implements RL components

2. **Entity Extractor** (`src/services/graph-rag/entity-extractor.ts`)
   - LLM-based entity extraction
   - Type classification
   - Property extraction

3. **GraphRAG Router** (`src/routers/graphrag.ts`)
   - REST API endpoints
   - Request validation
   - Authentication middleware

### Data Flow

1. **Text Input** → Entity Extraction → Relationship Detection
2. **Graph Construction** → Neo4j Storage → Community Detection
3. **Query Processing** → Multi-hop Traversal → Path Scoring
4. **RL Optimization** → Policy Update → Improved Retrieval

## Troubleshooting

### Neo4j Connection Issues

```bash
# Check if Neo4j is accessible
curl -I http://localhost:7474

# Check container logs
docker logs neo4j-graphrag

# Restart container
docker restart neo4j-graphrag
```

### Entity Extraction Not Working

1. Verify Ollama is running:
   ```bash
   ollama list
   ```

2. Check if model is available:
   ```bash
   ollama pull tinyllama:latest
   ```

3. Test Ollama connection:
   ```bash
   curl http://localhost:11434/api/generate -d '{
     "model": "tinyllama:latest",
     "prompt": "Extract entities from: GraphRAG uses Neo4j"
   }'
   ```

### Authentication Errors

1. Generate a valid JWT token:
   ```javascript
   const jwt = require('jsonwebtoken');
   const token = jwt.sign(
     { id: 'user-id', email: 'user@example.com' },
     process.env.JWT_SECRET,
     { expiresIn: '1h' }
   );
   ```

2. Include in request headers:
   ```bash
   Authorization: Bearer YOUR_JWT_TOKEN
   ```

## Performance Considerations

- **Entity Extraction**: Uses local LLMs for cost efficiency
- **Graph Storage**: Neo4j provides persistent storage with indexing
- **Fallback Mode**: Automatically falls back to in-memory operations if Neo4j unavailable
- **Embedding Generation**: Cached for repeated entities
- **Community Detection**: Requires Neo4j Graph Data Science plugin

## Security

- All endpoints require JWT authentication
- Neo4j credentials should be stored securely
- Use environment variables for sensitive configuration
- Regular backups of Neo4j data recommended

## Future Enhancements

- [ ] Advanced entity disambiguation
- [ ] Incremental graph updates
- [ ] Real-time graph streaming
- [ ] Integration with vector databases
- [ ] Enhanced visualization capabilities
- [ ] Distributed graph processing

## References

- [Graph-R1 Paper](https://arxiv.org/abs/graph-r1)
- [Neo4j Documentation](https://neo4j.com/docs/)
- [Graph Data Science Library](https://neo4j.com/docs/graph-data-science/)

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review server logs: `npm run dev`
3. Check Neo4j logs: `docker logs neo4j-graphrag`
4. Open an issue in the repository