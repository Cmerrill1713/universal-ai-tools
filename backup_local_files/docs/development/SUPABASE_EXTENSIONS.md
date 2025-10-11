# Supabase Extensions Guide
## Essential Extensions for Universal AI Tools
### 1. **vector** - AI/ML Vector Operations

```sql

CREATE EXTENSION IF NOT EXISTS vector;

```

- **Purpose**: Store and query embedding vectors for AI/ML operations

- **Use Case**: Semantic search, similarity matching, RAG implementations

- **Example**:

```sql

-- Create a table with vector embeddings

CREATE TABLE documents (

    id SERIAL PRIMARY KEY,

    content TEXT,

    embedding vector(1536) -- OpenAI embedding dimension

);
-- Create an index for fast similarity search

CREATE INDEX ON documents USING ivfflat (embedding vector_cosine_ops);
-- Query similar documents

SELECT content, 1 - (embedding <=> query_embedding) as similarity

FROM documents

ORDER BY embedding <=> query_embedding

LIMIT 10;

```
### 2. **pg_cron** - Scheduled Jobs

```sql

CREATE EXTENSION IF NOT EXISTS pg_cron;

```

- **Purpose**: Schedule recurring database tasks

- **Use Case**: Cleanup jobs, data aggregation, automated maintenance

- **Example**:

```sql

-- Schedule daily cleanup of old logs

SELECT cron.schedule(

    'cleanup-old-logs',

    '0 2 * * *', -- 2 AM daily

    $$DELETE FROM logs WHERE created_at < NOW() - INTERVAL '30 days'$$

);
-- Schedule hourly metrics aggregation

SELECT cron.schedule(

    'aggregate-metrics',

    '0 * * * *', -- Every hour

    $$CALL aggregate_hourly_metrics()$$

);

```
### 3. **pg_graphql** - GraphQL API

```sql

CREATE EXTENSION IF NOT EXISTS pg_graphql;

```

- **Purpose**: Automatic GraphQL API generation from database schema

- **Use Case**: Instant GraphQL endpoints for your tables

- **Features**:

  - Auto-generated queries and mutations

  - Respects RLS policies

  - Real-time subscriptions support
### 4. **pg_net** - HTTP Requests from Database

```sql

CREATE EXTENSION IF NOT EXISTS pg_net;

```

- **Purpose**: Make HTTP requests directly from PostgreSQL

- **Use Case**: Webhooks, external API calls, notifications

- **Example**:

```sql

-- Send webhook on user registration

CREATE OR REPLACE FUNCTION notify_user_registered()

RETURNS TRIGGER AS $$

BEGIN

    PERFORM net.http_post(

        url := 'https://your-webhook.com/user-registered',

        headers := '{"Content-Type": "application/json"}'::jsonb,

        body := json_build_object(

            'user_id', NEW.id,

            'email', NEW.email,

            'timestamp', NOW()

        )::text

    );

    RETURN NEW;

END;

$$ LANGUAGE plpgsql;

```
### 5. **pgjwt** - JWT Token Generation

```sql

CREATE EXTENSION IF NOT EXISTS pgjwt;

```

- **Purpose**: Generate and verify JWT tokens in PostgreSQL

- **Use Case**: Custom authentication flows, API tokens

- **Example**:

```sql

-- Generate a JWT token

SELECT sign(

    json_build_object(

        'role', 'authenticated',

        'user_id', user_id,

        'exp', extract(epoch from now() + interval '7 days')

    ),

    current_setting('app.jwt_secret')

);

```
### 6. **wrappers** - Foreign Data Wrappers

```sql

CREATE EXTENSION IF NOT EXISTS wrappers;

```

- **Purpose**: Connect to external data sources

- **Supported Sources**:

  - Stripe

  - Firebase

  - S3

  - BigQuery

  - Airtable

- **Example**:

```sql

-- Connect to Stripe

CREATE SERVER stripe_server

FOREIGN DATA WRAPPER stripe_wrapper

OPTIONS (

    api_key 'your_stripe_secret_key'

);
-- Query Stripe customers as a table

CREATE FOREIGN TABLE stripe_customers (

    id text,

    email text,

    name text,

    created timestamp

) SERVER stripe_server

OPTIONS (object 'customers');

```
### 7. **pg_jsonschema** - JSON Schema Validation

```sql

CREATE EXTENSION IF NOT EXISTS pg_jsonschema;

```

- **Purpose**: Validate JSON data against schemas

- **Use Case**: Ensure data integrity for JSON columns

- **Example**:

```sql

-- Add JSON schema validation

ALTER TABLE ai_agents

ADD CONSTRAINT validate_config

CHECK (

    json_matches_schema(

        schema := '{

            "type": "object",

            "properties": {

                "model": {"type": "string"},

                "temperature": {"type": "number", "minimum": 0, "maximum": 2},

                "max_tokens": {"type": "integer", "minimum": 1}

            },

            "required": ["model"]

        }',

        instance := config

    )

);

```
### 8. **hypopg** - Hypothetical Indexes

```sql

CREATE EXTENSION IF NOT EXISTS hypopg;

```

- **Purpose**: Test index performance without creating actual indexes

- **Use Case**: Performance optimization planning

- **Example**:

```sql

-- Create hypothetical index

SELECT hypopg_create_index('CREATE INDEX ON users (email)');
-- Test query with hypothetical index

EXPLAIN SELECT * FROM users WHERE email = 'test@example.com';
-- Drop hypothetical index

SELECT hypopg_drop_index(indexrelid) FROM hypopg();

```
### 9. **pgaudit** - Audit Logging

```sql

CREATE EXTENSION IF NOT EXISTS pgaudit;

```

- **Purpose**: Detailed session and object-level audit logging

- **Use Case**: Compliance, security monitoring

- **Configuration**:

```sql

-- Enable audit logging for specific tables

ALTER TABLE sensitive_data SET (pgaudit.log = 'all');
-- Configure what to audit

ALTER SYSTEM SET pgaudit.log = 'ddl, write';

```
### 10. **pg_stat_monitor** - Advanced Monitoring

```sql

CREATE EXTENSION IF NOT EXISTS pg_stat_monitor;

```

- **Purpose**: Enhanced query performance monitoring

- **Features**:

  - Query execution time histograms

  - Top queries by various metrics

  - Wait event information
## Implementation Script
```sql

-- Enable essential extensions for Universal AI Tools

BEGIN;
-- Core AI/ML functionality

CREATE EXTENSION IF NOT EXISTS vector;
-- Scheduled jobs for maintenance

CREATE EXTENSION IF NOT EXISTS pg_cron;
-- HTTP requests for webhooks

CREATE EXTENSION IF NOT EXISTS pg_net;
-- JWT token handling

CREATE EXTENSION IF NOT EXISTS pgjwt;
-- JSON validation

CREATE EXTENSION IF NOT EXISTS pg_jsonschema;
-- Performance optimization

CREATE EXTENSION IF NOT EXISTS hypopg;
-- Audit logging (if needed for compliance)

-- CREATE EXTENSION IF NOT EXISTS pgaudit;
COMMIT;
-- Verify installations

SELECT extname, extversion FROM pg_extension ORDER BY extname;

```
## Extension-Specific Tables
### For Vector Extension

```sql

-- Enhance memory storage with vector embeddings

ALTER TABLE ai_memories

ADD COLUMN IF NOT EXISTS embedding vector(1536);
CREATE INDEX IF NOT EXISTS idx_memories_embedding 

ON ai_memories USING ivfflat (embedding vector_cosine_ops);

```
### For pg_cron Extension

```sql

-- Schedule regular maintenance tasks

SELECT cron.schedule('cleanup-old-sessions', '0 3 * * *', 

    $$DELETE FROM user_sessions WHERE created_at < NOW() - INTERVAL '7 days'$$);
SELECT cron.schedule('aggregate-agent-metrics', '*/15 * * * *',

    $$REFRESH MATERIALIZED VIEW CONCURRENTLY agent_performance_summary$$);

```
### For pg_net Extension

```sql

-- Create webhook notifications table

CREATE TABLE IF NOT EXISTS webhook_events (

    id SERIAL PRIMARY KEY,

    event_type VARCHAR(100),

    payload JSONB,

    webhook_url TEXT,

    sent_at TIMESTAMP,

    response_status INTEGER,

    created_at TIMESTAMP DEFAULT NOW()

);

```
## Security Considerations
1. **vector**: Ensure embedding dimensions match your AI model

2. **pg_cron**: Be careful with scheduled DELETE operations

3. **pg_net**: Validate and sanitize URLs before making requests

4. **pgjwt**: Store JWT secrets securely in Vault

5. **pgaudit**: Can generate large amounts of logs - monitor disk space
## Next Steps
1. Enable extensions based on your needs

2. Update database schema to leverage extensions

3. Create helper functions for common operations

4. Set up monitoring for extension-specific metrics