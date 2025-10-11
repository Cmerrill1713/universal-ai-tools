# Vector Database Service

A high-performance vector database service built with Rust, providing efficient storage and retrieval of vector embeddings.

## Features

- **Vector Storage**: Efficient storage of high-dimensional vectors
- **Similarity Search**: Fast approximate nearest neighbor search
- **Persistence**: Optional persistence to disk for data durability
- **Collection Management**: Organize vectors into collections
- **RESTful API**: Easy integration with other services
- **Performance Monitoring**: Built-in metrics and health checks

## Endpoints

- `GET /health` - Service health check
- `POST /collections` - Create a new collection
- `GET /collections` - List all collections
- `GET /collections/{id}` - Get collection details
- `DELETE /collections/{id}` - Delete a collection
- `POST /collections/{id}/vectors` - Add vectors to collection
- `GET /collections/{id}/vectors` - Search vectors in collection
- `DELETE /collections/{id}/vectors/{vector_id}` - Delete a vector
- `POST /snapshots` - Create a snapshot
- `GET /snapshots` - List snapshots
- `POST /snapshots/{id}/restore` - Restore from snapshot

## Configuration

Set the following environment variables:

- `PORT` - Service port (default: 8085)
- `VECTOR_DB_PERSISTENCE` - Enable persistence (default: false)
- `MAX_VECTORS_PER_COLLECTION` - Maximum vectors per collection (default: 1000000)
- `VECTOR_DIMENSION` - Default vector dimension (default: 1536)

## Usage

```bash
# Start the service
cargo run -p vector-db

# Health check
curl http://localhost:8085/health

# Create a collection
curl -X POST http://localhost:8085/collections \
  -H "Content-Type: application/json" \
  -d '{
    "id": "embeddings",
    "dimension": 1536,
    "description": "Text embeddings collection"
  }'

# Add vectors
curl -X POST http://localhost:8085/collections/embeddings/vectors \
  -H "Content-Type: application/json" \
  -d '{
    "vectors": [
      {
        "id": "doc1",
        "vector": [0.1, 0.2, 0.3, ...],
        "metadata": {"text": "Sample document"}
      }
    ]
  }'

# Search similar vectors
curl -X GET "http://localhost:8085/collections/embeddings/vectors?query=[0.1,0.2,0.3,...]&limit=5"
```

## Request/Response Formats

### Create Collection

```json
{
  "id": "string",
  "dimension": 1536,
  "description": "string"
}
```

### Add Vectors

```json
{
  "vectors": [
    {
      "id": "string",
      "vector": [0.1, 0.2, 0.3],
      "metadata": {}
    }
  ]
}
```

### Search Response

```json
{
  "results": [
    {
      "id": "string",
      "score": 0.95,
      "metadata": {}
    }
  ],
  "total": 1
}
```

## Architecture

The service uses:

- **In-memory storage** for fast access
- **Optional RocksDB persistence** for durability
- **Efficient indexing** for similarity search
- **Async processing** for high throughput

## Development

```bash
# Run tests
cargo test -p vector-db

# Run with persistence enabled
VECTOR_DB_PERSISTENCE=true cargo run -p vector-db

# Run with debug logging
RUST_LOG=debug cargo run -p vector-db
```
