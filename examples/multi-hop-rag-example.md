# Multi-Hop RAG Example

This example demonstrates how to use the enhanced multi-hop RAG system for complex reasoning tasks.

## Basic Usage

### Single-Hop RAG (Traditional)

```json
{
  "query": "How do I optimize Supabase queries?",
  "k": 5,
  "model": "llama3.1:8b"
}
```

### Multi-Hop RAG (Enhanced)

```json
{
  "query": "How do I optimize Supabase queries for real-time applications?",
  "k": 5,
  "model": "llama3.1:8b",
  "enable_multi_hop": true,
  "traversal_depth": 3,
  "max_paths": 5
}
```

## Response Format

The multi-hop RAG response includes reasoning paths:

```json
{
  "answer": "To optimize Supabase queries for real-time applications, you should...",
  "model": "llama3.1:8b",
  "provider": "ollama",
  "citations": [
    {
      "table": "ai_memories",
      "id": "uuid-123",
      "title": "Supabase Performance Optimization",
      "score": 0.95
    }
  ],
  "reasoning_paths": [
    {
      "path_id": 1,
      "memory_sequence": ["uuid-123", "uuid-456", "uuid-789"],
      "content_sequence": [
        "Supabase query optimization basics",
        "Real-time subscription patterns",
        "Performance monitoring techniques"
      ],
      "domain_sequence": ["supabase", "realtime", "performance"],
      "total_strength": 0.89,
      "path_description": "Path: supabase → realtime → performance"
    }
  ],
  "used_multi_hop": true
}
```

## Complex Reasoning Example

For complex queries that require connecting multiple concepts:

```json
{
  "query": "How can I implement a secure authentication system using Supabase with GraphQL and React?",
  "enable_multi_hop": true,
  "traversal_depth": 4,
  "max_paths": 8
}
```

This will:

1. Start with Supabase authentication concepts
2. Traverse to GraphQL integration patterns
3. Connect to React implementation details
4. Link to security best practices
5. Synthesize a comprehensive answer

## Configuration Options

- `enable_multi_hop`: Enable/disable multi-hop reasoning
- `traversal_depth`: Maximum depth of knowledge graph traversal (1-5)
- `max_paths`: Maximum number of reasoning paths to explore (1-10)
- `k`: Number of final results to return

## Benefits

1. **Better Context**: Connects related concepts across domains
2. **Comprehensive Answers**: Covers multiple aspects of complex topics
3. **Transparent Reasoning**: Shows the path taken to reach conclusions
4. **Fallback Safety**: Falls back to single-hop if multi-hop fails

## API Endpoint

```bash
curl -X POST http://localhost:8080/r1-rag \
  -H "Content-Type: application/json" \
  -d '{
    "query": "How do I build a scalable real-time chat application?",
    "enable_multi_hop": true,
    "traversal_depth": 3,
    "max_paths": 5
  }'
```
