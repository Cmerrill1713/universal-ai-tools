# Supabase Local Development Setup Guide
## Overview
This guide helps you work with Supabase locally for the Universal AI Tools project, including how to handle the "failed to load branches" error in Supabase Studio.
## The "Failed to Load Branches" Error
When running Supabase locally, you'll see a "failed to load branches" error in the top-left corner of Supabase Studio. This is a **cosmetic issue** that doesn't affect functionality:
- **Why it happens**: Database branching is a cloud-only feature, but the local Studio UI still tries to fetch branches

- **Impact**: None - all database operations work normally

- **Solution**: Ignore the error or use our custom viewer scripts
## Accessing Your Data
### Option 1: Supabase Studio (Recommended)
1. Open http://localhost:54323 in your browser

2. Click **Table Editor** in the left sidebar

3. Select the **ai_memories** table

4. Use the filter options to view specific data:

   - Filter by `service_id` contains `claude` to see autofix data

   - Sort by `created_at` to see recent entries
### Option 2: Custom Memory Viewer
We've created a CLI tool to view autofix memories directly:
```bash
# View autofix memories with nice formatting

npm run view:memories

# Or run directly

node scripts/view-autofix-memories.mjs

```
This shows:

- Memory summary by service

- Recent autofix patterns

- Fix type statistics

- Success rates and confidence scores
### Option 3: Direct Database Access
```bash
# Connect to PostgreSQL directly

psql postgresql://postgres:postgres@127.0.0.1:54322/postgres

# Query memories

SELECT * FROM ai_memories WHERE service_id LIKE 'claude-%' ORDER BY created_at DESC LIMIT 10;

```
## Verifying Data Storage
To confirm the autofix system is storing data correctly:
```bash
# Run test script

npm run test:ai-memories

# Check what was stored

npm run view:memories

```
## Database Schema
The `ai_memories` table structure:
```sql

CREATE TABLE ai_memories (

    id UUID PRIMARY KEY,

    service_id VARCHAR(255),

    memory_type VARCHAR(255),

    content TEXT,

    metadata JSONB,

    memory_category VARCHAR(255),

    importance_score NUMERIC,

    keywords TEXT[],

    access_count INTEGER DEFAULT 0,

    last_accessed TIMESTAMP,

    created_at TIMESTAMP DEFAULT NOW(),

    updated_at TIMESTAMP DEFAULT NOW()

);

```
## Autofix Memory Types
The system stores various types of memories:
1. **autofix_pattern**: Individual fix attempts with success metrics

2. **session_summary**: Overall session statistics

3. **adaptive_learning**: Confidence adjustments

4. **pattern_recognition**: Learned patterns for specific file types
## Troubleshooting
### Can't see data in Studio?
1. Ensure Supabase is running: `npx supabase status`

2. Check the correct table: `ai_memories` (not `memories`)

3. Clear any filters in the Table Editor

4. Use the custom viewer: `npm run view:memories`
### Connection refused errors?
```bash
# Restart Supabase

npx supabase stop

npx supabase start

```
### Need to reset the database?
```bash
# Reset to clean state (WARNING: deletes all data)

npx supabase db reset

```
## NPM Scripts
Add these helpful scripts to your package.json:
```json

{

  "scripts": {

    "view:memories": "node scripts/view-autofix-memories.mjs",

    "test:ai-memories": "node scripts/test-ai-memories.mjs",

    "supabase:status": "npx supabase status",

    "supabase:start": "npx supabase start",

    "supabase:stop": "npx supabase stop"

  }

}

```
## Summary
- The "failed to load branches" error is cosmetic and can be ignored

- Your autofix data is stored in the `ai_memories` table

- Use Supabase Studio, the custom viewer, or direct SQL to access your data

- The autofix system successfully stores all fix patterns, confidence scores, and learning data