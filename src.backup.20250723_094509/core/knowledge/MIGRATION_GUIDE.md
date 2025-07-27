# Knowledge Manager Migration Guide

## Overview

The Knowledge Manager has been migrated from a complex 800+ line implementation to a lightweight DSPy-based system (under 200 lines) that maintains all essential functionality while leveraging intelligent knowledge extraction and optimization.

## Key Changes

### 1. Simplified Data Structure

- Removed complex nested interfaces (KnowledgeContent, KnowledgeMetadata, etc.)
- Consolidated into a single `KnowledgeItem` interface with essential fields
- Content is now a flexible `any` type that DSPy can intelligently process

### 2. DSPy Integration

- Knowledge extraction: Automatically enriches content using DSPy's extraction capabilities
- Intelligent search: Leverages DSPy's optimized search when content_search is provided
- Knowledge evolution: Uses DSPy to intelligently merge and evolve knowledge

### 3. Removed Features (can be re-added if needed)

- Complex validation system (replaced by DSPy's intelligent processing)
- Manual semantic indexing (DSPy handles this internally)
- Relationship graphs (can use DSPy's knowledge relationships)
- Evolution queue and cycles (DSPy handles evolution on-demand)

### 4. Maintained Features

- Supabase persistence
- Event emission
- Caching
- Usage tracking
- Search capabilities
- CRUD operations

## Migration Steps

### 1. Update Imports

```typescript
// Old
import { KnowledgeManager } from './knowledge-manager';

// New (no change needed - backward compatible)
import { KnowledgeManager } from './knowledge-manager';
```

### 2. Simplify Knowledge Creation

```typescript
// Old
const knowledge = knowledgeUtils.createSolutionKnowledge(
  'Fix TypeScript Error',
  { solution: 'Add type annotations' },
  { domain: 'frontend', technology: ['typescript'] },
  {
    /* complex metadata */
  }
);

// New
const knowledge = knowledgeUtils.createKnowledge(
  'solution',
  'Fix TypeScript Error',
  { solution: 'Add type annotations' },
  { tags: ['typescript', 'frontend'] }
);
```

### 3. Update Search Queries

```typescript
// Old
const results = await km.searchKnowledge({
  type: ['solution'],
  domain: 'frontend',
  technology: ['typescript'],
  min_confidence: 0.8,
  sort_by: 'relevance',
});

// New
const results = await km.searchKnowledge({
  type: ['solution'],
  tags: ['frontend', 'typescript'],
  min_confidence: 0.8,
});
```

### 4. Handle Removed Methods

- `validateKnowledge()` - No longer needed, DSPy handles quality
- `evolveKnowledge()` - Now happens automatically in `updateKnowledge()`
- `shareKnowledge()` - Can be implemented as simple copy operations
- `cleanupExpiredKnowledge()` - Add TTL at database level if needed

## Database Schema Update

The new implementation expects a simplified schema:

```sql
CREATE TABLE IF NOT EXISTS knowledge_base (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  content JSONB,
  tags TEXT[] DEFAULT '{}',
  confidence FLOAT DEFAULT 0.8,
  relevance FLOAT DEFAULT 0.7,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  usage_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'
);

-- Optional: Create index for better search performance
CREATE INDEX idx_knowledge_type ON knowledge_base(type);
CREATE INDEX idx_knowledge_tags ON knowledge_base USING GIN(tags);
CREATE INDEX idx_knowledge_confidence ON knowledge_base(confidence);
```

## Benefits of Migration

1. **Reduced Complexity**: From 1400+ lines to under 200 lines
2. **Intelligent Processing**: DSPy handles extraction, search, and evolution
3. **Better Performance**: Less overhead, smarter caching
4. **Easier Maintenance**: Simpler codebase, fewer moving parts
5. **Future-Proof**: Leverages DSPy's continuous improvements

## Need Help?

If you need any removed features, they can be selectively added back or implemented using DSPy's capabilities. The new system is designed to be extended as needed while maintaining simplicity.
