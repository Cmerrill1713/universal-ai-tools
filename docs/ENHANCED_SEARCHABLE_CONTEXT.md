# Enhanced Searchable Context System

This document describes the enhanced searchable context system that creates intelligent connections between stored knowledge, enables advanced search capabilities, and provides context-aware knowledge discovery.

## Overview

The enhanced system provides:
- **Memory Connections**: Automatic linking between related concepts across domains
- **Multi-Domain Search**: Intelligent search across different knowledge areas
- **Knowledge Graph Views**: Visual representation of knowledge relationships
- **Context Enrichment**: Automatic metadata enhancement for better discovery

## Key Features

### 1. Memory Connections

The system automatically creates connections between related memories across different domains:

#### Supabase ↔ GraphQL Connections
```sql
-- Connects database patterns with API patterns
SELECT * FROM memory_connections 
WHERE connection_type = 'database_api_pattern';
```

#### Reranking → Performance Optimization
```sql
-- Links performance optimization techniques to specific technologies
SELECT * FROM memory_connections 
WHERE connection_type = 'performance_optimization';
```

#### Agent Orchestration → All Technologies
```sql
-- Shows how agents utilize different technologies
SELECT * FROM memory_connections 
WHERE connection_type = 'agent_uses_technology';
```

### 2. Enhanced Search Functions

#### Multi-Domain Semantic Search
```sql
-- Search across domains with intent-based ranking
SELECT * FROM search_across_domains(
  query_text := 'how to optimize GraphQL queries in Supabase',
  intent := 'optimization',  -- Options: 'learning', 'debugging', 'implementation', 'optimization'
  domains := ARRAY['supabase', 'graphql', 'agent-orchestration-system'],
  max_results := 20
);
```

#### Knowledge Graph Traversal
```sql
-- Discover knowledge paths through connected memories
SELECT * FROM search_knowledge_graph(
  start_query := 'supabase real-time subscriptions',
  traversal_depth := 3,
  max_paths := 5,
  connection_types := ARRAY['database_api_pattern', 'performance_optimization']
);
```

### 3. Knowledge Graph Views

#### Memory Relationship Graph
```sql
-- Visualize all memory connections
SELECT 
  source_domain,
  target_domain,
  connection_type,
  COUNT(*) as connection_count,
  AVG(strength) as avg_strength
FROM memory_relationship_graph
GROUP BY source_domain, target_domain, connection_type
ORDER BY connection_count DESC;
```

#### Knowledge Clusters
```sql
-- View knowledge organized by topic and complexity
SELECT * FROM knowledge_clusters
WHERE primary_cluster = 'database-technologies'
  AND complexity_level = 'intermediate';
```

#### Technology Cross-References
```sql
-- See how different technologies relate to each other
SELECT * FROM technology_cross_references
WHERE domain1 = 'supabase' OR domain2 = 'supabase';
```

#### Usage Patterns
```sql
-- Analyze which knowledge is most useful
SELECT 
  service_id,
  memory_type,
  AVG(usefulness_rate) as avg_usefulness,
  SUM(unique_agent_accesses) as total_agent_uses
FROM knowledge_usage_patterns
GROUP BY service_id, memory_type
ORDER BY avg_usefulness DESC;
```

### 4. Context Enrichment

The system automatically enriches memories with:

#### Technology Stack Mappings
```json
{
  "technology_stack": {
    "primary": "supabase",
    "related": ["postgresql", "typescript", "react"],
    "patterns": ["api-design", "database-design", "realtime"]
  }
}
```

#### Use Case Scenarios
```json
{
  "use_cases": [
    {
      "scenario": "Building a modern full-stack application",
      "technologies": ["supabase", "graphql", "typescript"],
      "complexity": "intermediate"
    }
  ]
}
```

#### Performance Impact Assessment
```json
{
  "performance_impact": {
    "impact_areas": ["query-performance", "caching-efficiency"],
    "optimization_level": "architectural",
    "expected_improvement": "high"
  }
}
```

## Usage Examples

### 1. Finding Related Concepts
```sql
-- Find all GraphQL knowledge related to Supabase
WITH supabase_memories AS (
  SELECT id FROM ai_memories 
  WHERE service_id = 'supabase' 
    AND embedding IS NOT NULL
)
SELECT 
  tm.content,
  mc.strength,
  mc.metadata
FROM supabase_memories sm
JOIN memory_connections mc ON sm.id = mc.source_memory_id
JOIN ai_memories tm ON mc.target_memory_id = tm.id
WHERE tm.service_id LIKE '%graphql%'
ORDER BY mc.strength DESC;
```

### 2. Building Learning Paths
```sql
-- Discover learning paths for a topic
SELECT * FROM discover_learning_paths(
  start_topic := 'supabase',
  target_skill_level := 'advanced'
);
```

### 3. Context-Aware Search
```sql
-- Search for debugging help with context
SELECT 
  memory_id,
  content,
  domain,
  final_score,
  related_memories
FROM search_across_domains(
  query_text := 'supabase authentication error',
  intent := 'debugging',
  max_results := 10
)
WHERE final_score > 0.7;
```

### 4. Cross-Domain Knowledge Discovery
```sql
-- Find optimization techniques that apply to multiple domains
WITH optimization_memories AS (
  SELECT * FROM search_across_domains(
    query_text := 'performance optimization',
    intent := 'optimization'
  )
)
SELECT 
  om.content,
  om.domain,
  array_agg(DISTINCT rm.domain) as applicable_domains
FROM optimization_memories om
JOIN ai_memories rm ON rm.id = ANY(om.related_memories)
GROUP BY om.memory_id, om.content, om.domain
HAVING COUNT(DISTINCT rm.domain) > 2;
```

## Best Practices

### 1. Searching Effectively
- Use specific intents to get more relevant results
- Combine text and embedding search for best results
- Leverage domain filters when you know the technology area

### 2. Following Knowledge Paths
- Start with broad concepts and traverse to specific implementations
- Use connection strength to find the most relevant paths
- Limit traversal depth to avoid information overload

### 3. Analyzing Patterns
- Regularly review usage patterns to identify knowledge gaps
- Use cluster analysis to organize learning materials
- Monitor cross-references to find integration opportunities

### 4. Maintaining the System
```sql
-- Refresh connections periodically
SELECT initialize_enhanced_context_system();

-- Update cluster assignments
SELECT update_memory_cluster_assignments();

-- Clean up weak connections
DELETE FROM memory_connections WHERE strength < 0.3;
```

## Advanced Queries

### Finding Knowledge Gaps
```sql
-- Identify areas with few connections
WITH connection_counts AS (
  SELECT 
    m.service_id,
    m.memory_type,
    COUNT(DISTINCT mc.target_memory_id) as outgoing_connections,
    COUNT(DISTINCT mc2.source_memory_id) as incoming_connections
  FROM ai_memories m
  LEFT JOIN memory_connections mc ON m.id = mc.source_memory_id
  LEFT JOIN memory_connections mc2 ON m.id = mc2.target_memory_id
  GROUP BY m.id, m.service_id, m.memory_type
)
SELECT 
  service_id,
  memory_type,
  AVG(outgoing_connections + incoming_connections) as avg_connections
FROM connection_counts
GROUP BY service_id, memory_type
HAVING AVG(outgoing_connections + incoming_connections) < 2
ORDER BY avg_connections;
```

### Discovering Integration Patterns
```sql
-- Find successful technology integrations
SELECT 
  mc.metadata->>'pattern' as integration_pattern,
  array_agg(DISTINCT sm.service_id || ' + ' || tm.service_id) as technology_pairs,
  COUNT(*) as usage_count,
  AVG(mc.strength) as avg_strength
FROM memory_connections mc
JOIN ai_memories sm ON mc.source_memory_id = sm.id
JOIN ai_memories tm ON mc.target_memory_id = tm.id
WHERE mc.metadata ? 'pattern'
GROUP BY mc.metadata->>'pattern'
HAVING COUNT(*) > 3
ORDER BY usage_count DESC;
```

## Monitoring and Analytics

### Connection Health
```sql
-- Monitor connection quality
SELECT 
  connection_type,
  COUNT(*) as total_connections,
  AVG(strength) as avg_strength,
  MIN(strength) as min_strength,
  MAX(strength) as max_strength,
  STDDEV(strength) as strength_variance
FROM memory_connections
GROUP BY connection_type
ORDER BY total_connections DESC;
```

### Knowledge Coverage
```sql
-- Analyze knowledge distribution
SELECT 
  kc.primary_cluster,
  SUM(kc.memory_count) as total_memories,
  COUNT(DISTINCT kc.complexity_level) as complexity_levels,
  array_agg(DISTINCT unnest(kc.domains)) as covered_domains
FROM knowledge_clusters kc
GROUP BY kc.primary_cluster
ORDER BY total_memories DESC;
```

## Troubleshooting

### Common Issues

1. **No search results**: Check embedding dimensions match
2. **Weak connections**: Increase similarity threshold
3. **Missing enrichments**: Run `initialize_enhanced_context_system()`
4. **Slow queries**: Ensure indexes are created and up-to-date

### Performance Optimization
```sql
-- Analyze index usage
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

## Future Enhancements

1. **Temporal Knowledge Graphs**: Track how knowledge evolves over time
2. **Collaborative Filtering**: Recommend memories based on team usage
3. **Auto-Summarization**: Generate topic summaries from connected memories
4. **Knowledge Validation**: Verify accuracy of connections and information