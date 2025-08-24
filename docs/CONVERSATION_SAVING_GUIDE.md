# Conversation Saving to Supabase

## Overview
All conversations are now automatically saved to Supabase for context persistence and future reference.

## Implementation

### 1. Context Storage Service
- Location: `src/services/context-storage-service.ts`
- Stores conversations with 384-dimension embeddings
- Categories: conversation, project_info, error_analysis, etc.
- Automatic embedding generation (Ollama or fallback)

### 2. API Endpoints
- **Save**: `POST /api/v1/conversation-context/save`
- **List**: `GET /api/v1/conversation-context/list`
- **Get by ID**: `GET /api/v1/conversation-context/:id`

### 3. Usage Examples

#### Save a Conversation
```bash
curl -X POST http://localhost:9999/api/v1/conversation-context/save \
  -H "Content-Type: application/json" \
  -d '{
    "summary": "Your conversation summary here",
    "userId": "claude-code-user",
    "projectPath": "/path/to/project"
  }'
```

#### List Saved Conversations
```bash
curl "http://localhost:9999/api/v1/conversation-context/list?userId=claude-code-user&limit=10"
```

#### Manual Save Script
```bash
npx tsx save-conversation-context.ts
```

#### Verify Saved Context
```bash
npx tsx verify-saved-context.ts
```

## Database Schema
- Table: `context_storage`
- Key fields:
  - `id`: UUID
  - `content`: Text content
  - `category`: conversation, project_info, etc.
  - `user_id`: User identifier
  - `embedding`: vector(384) for similarity search
  - `created_at`, `updated_at`: Timestamps

## Automatic Features
- Embedding generation for semantic search
- Token-efficient storage (summaries, not full text)
- Resilient database operations with retry logic
- Memory-optimized caching

## Best Practices
1. Save concise summaries, not full conversation history
2. Use appropriate categories for different context types
3. Include relevant metadata for better retrieval
4. Clean up old contexts periodically (30+ days)

## Integration with Claude Code
Claude Code sessions automatically:
- Save conversation summaries to Supabase
- Retrieve relevant context for new sessions
- Maintain project-specific context isolation
- Follow CLAUDE.md guidelines for selective storage