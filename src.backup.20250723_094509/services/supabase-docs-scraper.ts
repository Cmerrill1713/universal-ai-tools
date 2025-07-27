import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';
import { z } from 'zod';
import axios from 'axios';
import * as cheerio from 'cheerio';

// Schema for documentation entries
const DocEntrySchema = z.object({
  category: z.string(),
  subcategory: z.string().optional(),
  title: z.string(),
  description: z.string(),
  code_snippets: z.array(
    z.object({
      language: z.string(),
      code: z.string(),
      description: z.string().optional(),
    })
  ),
  setup_instructions: z.array(z.string()),
  capabilities: z.array(z.string()),
  prerequisites: z.array(z.string()).optional(),
  best_practices: z.array(z.string()).optional(),
  examples: z
    .array(
      z.object({
        title: z.string(),
        description: z.string(),
        code: z.string(),
        language: z.string(),
      })
    )
    .optional(),
  related_docs: z.array(z.string()).optional(),
  api_reference: z
    .object({
      endpoint: z.string().optional(),
      methods: z.array(z.string()).optional(),
      parameters: z.any().optional(),
      response: z.any().optional(),
    })
    .optional(),
});

type DocEntry = z.infer<typeof DocEntrySchema>;

export class SupabaseDocsScraper {
  private supabase: SupabaseClient;
  private baseUrl = 'https://supabase.com/docs';
  private docsCache: Map<string, DocEntry> = new Map();

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Main method to scrape and store all Supabase documentation
   */
  async scrapeAndStore(): Promise<void> {
    logger.info('Starting Supabase documentation scraping...');

    try {
      // Define all the key Supabase features to document
      const features = [
        // Core Features
        {
          category: 'Database',
          url: '/guides/database',
          subcategories: ['Tables', 'RLS', 'Triggers', 'Functions'],
        },
        {
          category: 'Auth',
          url: '/guides/auth',
          subcategories: ['Email', 'Social', 'Phone', 'MFA'],
        },
        {
          category: 'Storage',
          url: '/guides/storage',
          subcategories: ['Uploads', 'Downloads', 'Policies', 'CDN'],
        },
        {
          category: 'Realtime',
          url: '/guides/realtime',
          subcategories: ['Broadcast', 'Presence', 'Postgres Changes'],
        },
        {
          category: 'Edge Functions',
          url: '/guides/functions',
          subcategories: ['Deploy', 'Secrets', 'CORS', 'Webhooks'],
        },

        // Extensions
        {
          category: 'Vector/Embeddings',
          url: '/guides/ai',
          subcategories: ['pgvector', 'OpenAI', 'Similarity Search'],
        },
        {
          category: 'GraphQL',
          url: '/guides/graphql',
          subcategories: ['pg_graphql', 'Queries', 'Mutations', 'Subscriptions'],
        },
        {
          category: 'Vault',
          url: '/guides/vault',
          subcategories: ['Encryption', 'Key Management', 'Secrets'],
        },
        {
          category: 'Cron',
          url: '/guides/cron',
          subcategories: ['pg_cron', 'Scheduled Jobs', 'Maintenance'],
        },

        // Advanced Features
        {
          category: 'Webhooks',
          url: '/guides/webhooks',
          subcategories: ['Database Webhooks', 'HTTP Triggers'],
        },
        {
          category: 'Wrappers',
          url: '/guides/wrappers',
          subcategories: ['Foreign Data', 'External APIs'],
        },
        {
          category: 'Analytics',
          url: '/guides/analytics',
          subcategories: ['BigQuery', 'Iceberg', 'Data Export'],
        },
      ];

      // Process each feature
      for (const feature of features) {
        await this.processFeature(feature);
      }

      // Store all collected documentation
      await this.storeDocumentation();

      logger.info('Supabase documentation scraping completed successfully');
    } catch (error) {
      logger.error('Error scraping Supabase documentation:', error);
      throw error;
    }
  }

  /**
   * Process a specific feature and its subcategories
   */
  private async processFeature(feature: {
    category: string;
    url: string;
    subcategories: string[];
  }): Promise<void> {
    logger.info(`Processing ${feature.category} documentation...`);

    // Create comprehensive documentation for each category
    const docEntry: DocEntry = {
      category: feature.category,
      title: `Supabase ${feature.category} Complete Guide`,
      description: this.getFeatureDescription(feature.category),
      code_snippets: await this.getCodeSnippets(feature.category),
      setup_instructions: this.getSetupInstructions(feature.category),
      capabilities: this.getCapabilities(feature.category),
      prerequisites: this.getPrerequisites(feature.category),
      best_practices: this.getBestPractices(feature.category),
      examples: this.getExamples(feature.category),
      related_docs: feature.subcategories.map((sub) => `${feature.category}/${sub}`),
      api_reference: this.getApiReference(feature.category),
    };

    this.docsCache.set(feature.category, docEntry);

    // Process subcategories
    for (const subcategory of feature.subcategories) {
      const subDocEntry: DocEntry = {
        category: feature.category,
        subcategory,
        title: `${feature.category} - ${subcategory}`,
        description: this.getSubcategoryDescription(feature.category, subcategory),
        code_snippets: await this.getSubcategoryCodeSnippets(feature.category, subcategory),
        setup_instructions: this.getSubcategorySetup(feature.category, subcategory),
        capabilities: this.getSubcategoryCapabilities(feature.category, subcategory),
        examples: this.getSubcategoryExamples(feature.category, subcategory),
      };

      this.docsCache.set(`${feature.category}/${subcategory}`, subDocEntry);
    }
  }

  /**
   * Get feature description
   */
  private getFeatureDescription(category: string): string {
    const descriptions: Record<string, string> = {
      Database:
        'Supabase provides a full Postgres database with automatic APIs, real-time subscriptions, and Row Level Security.',
      Auth: 'Complete authentication solution with support for email/password, social logins, phone auth, and Multi-Factor Authentication.',
      Storage:
        'S3-compatible object storage with CDN, automatic image optimization, and fine-grained access controls.',
      Realtime:
        'WebSocket-based real-time updates for database changes, broadcast messages, and presence tracking.',
      'Edge Functions':
        'Globally distributed TypeScript functions that run close to your users with built-in database access.',
      'Vector/Embeddings':
        'AI and machine learning capabilities with pgvector for similarity search and embeddings storage.',
      GraphQL:
        'Automatic GraphQL API generation from your database schema with real-time subscriptions.',
      Vault:
        'Postgres extension for managing secrets and encryption keys directly in your database.',
      Cron: 'Schedule recurring database jobs and maintenance tasks with pg_cron.',
      Webhooks: 'HTTP webhooks triggered by database events for external integrations.',
      Wrappers: 'Foreign Data Wrappers to query external databases and APIs as Postgres tables.',
      Analytics: 'Export data to analytics platforms like BigQuery and Apache Iceberg.',
    };
    return descriptions[category] || `Complete guide for ${category} in Supabase`;
  }

  /**
   * Get code snippets for a category
   */
  private async getCodeSnippets(category: string): Promise<any[]> {
    const snippets: Record<string, any[]> = {
      Database: [
        {
          language: 'javascript',
          description: 'Create a table and insert data',
          code: `
// Initialize Supabase client
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(url, key)

// Insert data
const { data, error} = await supabase
  .from('posts')
  .insert([
    { title: 'Hello World', content 'My first post' }
  ])
  .select()

// Query data with filters
const { data: posts } = await supabase
  .from('posts')
  .select('*')
  .eq('published', true)
  .order('created_at', { ascending: false })
  .limit(10)`,
        },
        {
          language: 'sql',
          description: 'Create table with RLS policies',
          code: `
-- Create posts table
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  contentTEXT,
  user_id UUID REFERENCES auth.users(id),
  published BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view published posts" ON posts
  FOR SELECT USING (published = true);

CREATE POLICY "Users can manage own posts" ON posts
  FOR ALL USING (auth.uid() = user_id);`,
        },
      ],
      Auth: [
        {
          language: 'javascript',
          description: 'Authentication flows',
          code: `
// Sign up with email
const { data, error} = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'secure-password',
  options: {
    data: {
      first_name: 'John',
      last_name: 'Doe'
    }
  }
})

// Sign in with email
const { data, error} = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'secure-password'
})

// Sign in with OAuth
const { data, error} = await supabase.auth.signInWithOAuth({
  provider: 'github',
  options: {
    redirectTo: 'https://example.com/auth/callback'
  }
})

// Sign out
const { error} = await supabase.auth.signOut()

// Get session
const { data: { session } } = await supabase.auth.getSession()

// Listen to auth changes
supabase.auth.onAuthStateChange((event, session) => {
  logger.debug('Authentication event', { event, session: session?.user?.id || 'anonymous' })
})`,
        },
      ],
      Storage: [
        {
          language: 'javascript',
          description: 'File upload and management',
          code: `
// Upload file
const { data, error} = await supabase.storage
  .from('avatars')
  .upload('public/avatar1.png', file, {
    cacheControl: '3600',
    upsert: false
  })

// Download file
const { data } = supabase.storage
  .from('avatars')
  .getPublicUrl('public/avatar1.png')

// List files
const { data: files } = await supabase.storage
  .from('avatars')
  .list('public', {
    limit: 100,
    offset: 0
  })

// Delete file
const { error} = await supabase.storage
  .from('avatars')
  .remove(['public/avatar1.png'])`,
        },
      ],
      Realtime: [
        {
          language: 'javascript',
          description: 'Real-time subscriptions',
          code: `
// Subscribe to INSERT events
const channel = supabase
  .channel('posts-insert')
  .on('postgres_changes', 
    { event: 'INSERT', schema: 'public', table: 'posts' },
    (payload) => logger.debug('New post created', { payload: payload.new })
  )
  .subscribe()

// Broadcast messages
const channel = supabase.channel('room1')
channel
  .on('broadcast', { event: 'message' }, ({ payload }) => {
    logger.debug('Broadcast received', { payload })
  })
  .subscribe()

// Send broadcast
channel.send({
  type: 'broadcast',
  event: 'message',
  payload: { text: 'Hello world' }
})

// Presence (track online users)
const presence = supabase.channel('online-users')
presence
  .on('presence', { event: 'sync' }, () => {
    const state = presence.presenceState()
    logger.debug('Online users updated', { count: Object.keys(state).length, state })
  })
  .subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await presence.track({ user_id: 'user123', online_at: new Date() })
    }
  })`,
        },
      ],
      'Edge Functions': [
        {
          language: 'typescript',
          description: 'Create and deploy Edge Function',
          code: `
// supabase/functions/hello-world/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Parse request
    const { name } = await req.json()

    // Query database
    const { data, error} = await supabaseClient
      .from('users')
      .select('*')
      .eq('name', name)
      .single()

    if (_error throw error;

    // Return response
    return new Response(
      JSON.stringify({ message: \`Hello \${data.name}!\`, user: data }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ _error error.message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }
})

// Deploy: supabase functions deploy hello-world
// Invoke: supabase functions invoke hello-world --body '{"name":"John"}'`,
        },
      ],
      'Vector/Embeddings': [
        {
          language: 'sql',
          description: 'Setup pgvector and create embeddings table',
          code: `
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create documents table with embeddings
CREATE TABLE documents (
  id BIGSERIAL PRIMARY KEY,
  contentTEXT NOT NULL,
  embedding VECTOR(1536), -- OpenAI embeddings dimension
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create index for similarity search
CREATE INDEX ON documents USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Function to search similar documents
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding VECTOR(1536),
  match_count INT DEFAULT 5,
  filter JSONB DEFAULT '{}'
) RETURNS TABLE(
  id BIGINT,
  contentTEXT,
  metadata JSONB,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    documents.id,
    documents.content
    documents.metadata,
    1 - (documents.embedding <=> query_embedding) AS similarity
  FROM documents
  WHERE metadata @> filter
  ORDER BY documents.embedding <=> query_embedding
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;`,
        },
        {
          language: 'javascript',
          description: 'Generate and store embeddings',
          code: `
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const supabase = createClient(url, key)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// Generate embedding
async function generateEmbedding(text: string) {
  const response = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input text
  })
  return response.data[0].embedding
}

// Store document with embedding
async function storeDocument(content string, metadata = {}) {
  const embedding = await generateEmbedding(content
  
  const { data, error} = await supabase
    .from('documents')
    .insert({
      content
      embedding,
      metadata
    })
    .select()
  
  return { data, error}
}

// Search similar documents
async function searchDocuments(query: string, matchCount = 5) {
  const queryEmbedding = await generateEmbedding(query)
  
  const { data, error} = await supabase.rpc('match_documents', {
    query_embedding: queryEmbedding,
    match_count: matchCount
  })
  
  return { data, error}
}`,
        },
      ],
      GraphQL: [
        {
          language: 'sql',
          description: 'Enable pg_graphql',
          code: `
-- Enable the extension
CREATE EXTENSION IF NOT EXISTS pg_graphql;

-- Tables are automatically exposed via GraphQL
-- Access at: https://[project].supabase.co/graphql/v1

-- Configure GraphQL schema visibility
COMMENT ON TABLE posts IS E'@graphql({"description": "Blog posts"})';
COMMENT ON COLUMN posts.contentIS E'@graphql({"description": "Post content})';

-- Hide table from GraphQL
COMMENT ON TABLE private_data IS E'@graphql({"exclude": true})';`,
        },
        {
          language: 'javascript',
          description: 'GraphQL queries and mutations',
          code: `
// GraphQL client setup
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(url, key)

// GraphQL query
const query = \`
  query GetPosts($limit: Int!) {
    postsCollection(
      first: $limit
      orderBy: { created_at: DescNullsLast }
    ) {
      edges {
        node {
          id
          title
          content
          user {
            id
            email
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
\`

// Execute GraphQL query
const { data, error} = await supabase
  .from('graphql')
  .select(query)
  .eq('limit', 10)
  .single()

// GraphQL mutation
const mutation = \`
  mutation CreatePost($title: String!, $content String!) {
    insertIntoposts(objects: {
      title: $title
      content $content
    }) {
      affectedCount
      records {
        id
        title
        created_at
      }
    }
  }
\`

// Execute mutation
const { data: result } = await supabase.rpc('graphql', {
  query: mutation,
  variables: { title: 'New Post', content 'Content here' }
})`,
        },
      ],
      Vault: [
        {
          language: 'sql',
          description: 'Vault for secrets management',
          code: `
-- Enable vault extension
CREATE EXTENSION IF NOT EXISTS vault;

-- Create an encryption key
SELECT vault.create_key('my-app-key', 'aes256-gcm');

-- Store a secret
INSERT INTO vault.secrets (name, secret, key_id)
VALUES (
  'api_key',
  vault.encrypt('sk_live_abc123', 'my-app-key'),
  (SELECT id FROM vault.keys WHERE name = 'my-app-key')
);

-- Retrieve and decrypt a secret
SELECT 
  name,
  vault.decrypt(secret, 'my-app-key') AS decrypted_value
FROM vault.secrets
WHERE name = 'api_key';

-- Create encrypted column
ALTER TABLE users 
ADD COLUMN ssn_encrypted BYTEA;

-- Store encrypted data
UPDATE users 
SET ssn_encrypted = vault.encrypt('123-45-6789', 'my-app-key')
WHERE id = 'user123';

-- Query with decryption
SELECT 
  id,
  email,
  vault.decrypt(ssn_encrypted, 'my-app-key') AS ssn
FROM users
WHERE id = 'user123';`,
        },
      ],
      Cron: [
        {
          language: 'sql',
          description: 'Schedule jobs with pg_cron',
          code: `
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule job to run every hour
SELECT cron.schedule(
  'cleanup-old-logs',
  '0 * * * *',
  $$DELETE FROM logs WHERE created_at < NOW() - INTERVAL '7 days'$$
);

-- Schedule daily summary email
SELECT cron.schedule(
  'daily-summary',
  '0 9 * * *',
  $$
  INSERT INTO email_queue (to_email, subject, body)
  SELECT 
    u.email,
    'Daily Summary',
    'Your activity summary for ' || CURRENT_DATE
  FROM users u
  WHERE u.notifications_enabled = true
  $$
);

-- Run job every 5 minutes
SELECT cron.schedule(
  'sync-data',
  '*/5 * * * *',
  $$SELECT sync_external_data()$$
);

-- List scheduled jobs
SELECT * FROM cron.job;

-- Remove a job
SELECT cron.unschedule('cleanup-old-logs');

-- Run job immediately (for testing)
CALL cron.job_run(job_id);`,
        },
      ],
      Webhooks: [
        {
          language: 'sql',
          description: 'Database webhooks setup',
          code: `
-- Create webhook for new user signups
CREATE OR REPLACE FUNCTION notify_new_user()
RETURNS TRIGGER AS $$
DECLARE
  payload JSON;
BEGIN
  payload = json_build_object(
    'event', 'user.created',
    'user_id', NEW.id,
    'email', NEW.email,
    'created_at', NEW.created_at
  );
  
  PERFORM net.http_post(
    url := 'https://your-app.com/webhooks/new-user',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Webhook-Secret', 'your-secret'
    ),
    body := payload::jsonb
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER on_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_user();

-- Webhook for order status changes
CREATE OR REPLACE FUNCTION webhook_order_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status != OLD.status THEN
    PERFORM net.http_post(
      url := 'https://your-app.com/webhooks/order-status',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object(
        'order_id', NEW.id,
        'old_status', OLD.status,
        'new_status', NEW.status,
        'updated_at', NOW()
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;`,
        },
      ],
      Wrappers: [
        {
          language: 'sql',
          description: 'Foreign Data Wrappers setup',
          code: `
-- Enable wrappers extension
CREATE EXTENSION IF NOT EXISTS wrappers;

-- Create foreign server for Stripe
CREATE SERVER stripe_server
FOREIGN DATA WRAPPER stripe_wrapper
OPTIONS (
  api_key 'sk_test_...'
);

-- Create foreign tables
CREATE FOREIGN TABLE stripe_customers (
  id TEXT,
  email TEXT,
  name TEXT,
  created TIMESTAMP,
  metadata JSONB
) SERVER stripe_server
OPTIONS (
  object 'customers'
);

-- Query Stripe data like regular tables
SELECT * FROM stripe_customers
WHERE email = 'user@example.com';

-- Join with local data
SELECT 
  u.id,
  u.email,
  sc.id as stripe_customer_id,
  sc.metadata
FROM users u
LEFT JOIN stripe_customers sc ON u.email = sc.email;

-- Create Firebase wrapper
CREATE SERVER firebase_server
FOREIGN DATA WRAPPER firebase_wrapper
OPTIONS (
  project_id 'your-project',
  service_account '/path/to/service-account.json'
);

-- Access Firestore collections
CREATE FOREIGN TABLE firebase_users (
  id TEXT,
  data JSONB
) SERVER firebase_server
OPTIONS (
  collection 'users'
);`,
        },
      ],
      Analytics: [
        {
          language: 'sql',
          description: 'Export to BigQuery',
          code: `
-- Enable BigQuery wrapper
CREATE EXTENSION IF NOT EXISTS wrappers;

-- Setup BigQuery connection
CREATE SERVER bigquery_server
FOREIGN DATA WRAPPER bigquery_wrapper
OPTIONS (
  project_id 'your-gcp-project',
  dataset_id 'analytics',
  service_account '/path/to/service-account.json'
);

-- Create materialized view for export
CREATE MATERIALIZED VIEW analytics_export AS
SELECT 
  date_trunc('hour', created_at) as hour,
  COUNT(*) as event_count,
  COUNT(DISTINCT user_id) as unique_users,
  jsonb_object_agg(event_type, count) as event_breakdown
FROM events
GROUP BY date_trunc('hour', created_at);

-- Export to BigQuery
CREATE FOREIGN TABLE bq_analytics (
  hour TIMESTAMP,
  event_count BIGINT,
  unique_users BIGINT,
  event_breakdown JSONB
) SERVER bigquery_server
OPTIONS (
  table 'hourly_analytics'
);

-- Sync data
INSERT INTO bq_analytics
SELECT * FROM analytics_export
WHERE hour > (
  SELECT COALESCE(MAX(hour), '2020-01-01') 
  FROM bq_analytics
);`,
        },
      ],
    };

    return snippets[category] || [];
  }

  /**
   * Get setup instructions for a category
   */
  private getSetupInstructions(category: string): string[] {
    const instructions: Record<string, string[]> = {
      Database: [
        'Create a new Supabase project at https://app.supabase.com',
        'Install Supabase client: npm install @supabase/supabase-js',
        'Get your project URL and anon key from project settings',
        'Initialize the client with createClient(url, anonKey)',
        'Create tables using the SQL editor or migrations',
        'Enable Row Level Security (RLS) on tables',
        'Create RLS policies for data access control',
      ],
      Auth: [
        'Enable authentication providers in Dashboard > Authentication > Providers',
        'Configure redirect URLs for OAuth providers',
        'Set up email templates in Authentication > Email Templates',
        'Configure password requirements in Authentication > Settings',
        'Install and initialize Supabase client',
        'Implement auth state change listeners',
        'Handle authentication flows in your app',
      ],
      Storage: [
        'Create storage buckets in Dashboard > Storage',
        'Set bucket privacy (public or private)',
        'Configure RLS policies for buckets',
        'Set allowed MIME types and file size limits',
        'Install Supabase client library',
        'Implement file upload/download in your app',
        'Configure CDN and image transformations',
      ],
      Realtime: [
        'Enable Realtime for tables in Dashboard > Database > Replication',
        'Install Supabase client with realtime-js',
        'Create channels for different features',
        'Implement subscription handlers',
        'Handle connection states and errors',
        'Set up presence tracking if needed',
        'Configure rate limits and security',
      ],
      'Edge Functions': [
        'Install Supabase CLI: npm install -g supabase',
        'Login to CLI: supabase login',
        'Initialize functions: supabase functions new function-name',
        'Write TypeScript/JavaScript function code',
        'Test locally: supabase functions serve',
        'Deploy: supabase functions deploy function-name',
        'Set secrets: supabase secrets set KEY=value',
      ],
      'Vector/Embeddings': [
        'Enable pgvector extension in SQL editor',
        'Create tables with vector columns',
        'Set up embedding generation (OpenAI, etc)',
        'Create similarity search functions',
        'Build indexes for performance',
        'Implement embedding storage logic',
        'Create search functionality',
      ],
      GraphQL: [
        'Enable pg_graphql extension',
        'Access GraphQL endpoint at /graphql/v1',
        'Configure table/column visibility with comments',
        'Set up GraphQL client in your app',
        'Implement queries and mutations',
        'Handle subscriptions for real-time',
        'Configure authentication headers',
      ],
      Vault: [
        'Enable vault extension in SQL editor',
        'Create encryption keys',
        'Set up key rotation policies',
        'Implement secret storage procedures',
        'Create encrypted columns',
        'Set up access controls',
        'Implement decryption in queries',
      ],
      Cron: [
        'Enable pg_cron extension',
        'Grant cron permissions to postgres role',
        'Create scheduled jobs with cron.schedule()',
        'Monitor job execution in cron.job_run_details',
        'Set up _errorhandling and notifications',
        'Test jobs with manual execution',
        'Configure job retention policies',
      ],
      Webhooks: [
        'Enable pg_net extension for HTTP requests',
        'Create trigger functions for events',
        'Set up webhook endpoints in your app',
        'Implement webhook authentication',
        'Handle retries and failures',
        'Log webhook activity',
        'Monitor webhook performance',
      ],
      Wrappers: [
        'Enable wrappers extension',
        'Install specific wrapper (stripe_wrapper, etc)',
        'Create foreign server with credentials',
        'Create foreign tables for data access',
        'Set up data sync procedures',
        'Implement caching if needed',
        'Monitor API usage and limits',
      ],
      Analytics: [
        'Set up data warehouse connection',
        'Create export views or functions',
        'Configure incremental sync',
        'Set up scheduled export jobs',
        'Implement data transformation',
        'Monitor export performance',
        'Set up data retention policies',
      ],
    };

    return instructions[category] || [];
  }

  /**
   * Get capabilities for a category
   */
  private getCapabilities(category: string): string[] {
    const capabilities: Record<string, string[]> = {
      Database: [
        'Full PostgreSQL database',
        'Automatic REST APIs',
        'Row Level Security (RLS)',
        'Database functions and triggers',
        'Full-text search',
        'PostGIS for geospatial data',
        'JSON/JSONB support',
        'Database migrations',
        'Connection pooling',
        'Read replicas',
      ],
      Auth: [
        'Email/password authentication',
        'Magic link authentication',
        'Social OAuth providers',
        'Phone/SMS authentication',
        'Multi-factor authentication (MFA)',
        'JWT token management',
        'User management',
        'Custom user metadata',
        'Session management',
        'Role-based access control',
      ],
      Storage: [
        'S3-compatible object storage',
        'Direct file uploads from browser',
        'Automatic image optimization',
        'CDN distribution',
        'Storage policies with RLS',
        'Resumable uploads',
        'File versioning',
        'Public and private buckets',
        'Image transformations',
        'Virus scanning',
      ],
      Realtime: [
        'Database change notifications',
        'Broadcast messaging',
        'Presence (online users)',
        'Cursor tracking',
        'Room-based channels',
        'PostgreSQL listen/notify',
        'Filtered subscriptions',
        'Connection multiplexing',
        'Automatic reconnection',
        'Rate limiting',
      ],
      'Edge Functions': [
        'Serverless TypeScript/JavaScript',
        'Global deployment',
        'Database connection pooling',
        'Environment variables',
        'Scheduled functions',
        'Webhook handlers',
        'Custom REST endpoints',
        'Third-party API integration',
        'File processing',
        'Background jobs',
      ],
      'Vector/Embeddings': [
        'Vector similarity search',
        'Multiple distance metrics',
        'High-dimensional vectors',
        'Index types (IVFFlat, HNSW)',
        'Hybrid search (vector + text)',
        'Embedding storage',
        'Semantic search',
        'Recommendation systems',
        'Clustering support',
        'OpenAI integration',
      ],
      GraphQL: [
        'Auto-generated GraphQL API',
        'Type-safe queries',
        'Real-time subscriptions',
        'Relay-style pagination',
        'Complex filtering',
        'Nested relationships',
        'Custom resolvers',
        'Schema introspection',
        'Apollo compatibility',
        'GraphiQL explorer',
      ],
      Vault: [
        'Transparent column encryption',
        'Key management',
        'Secrets storage',
        'Encryption at rest',
        'Key rotation',
        'Multiple encryption algorithms',
        'Access control',
        'Audit logging',
        'Compliance features',
        'HSM integration',
      ],
      Cron: [
        'Scheduled SQL execution',
        'Recurring tasks',
        'One-time jobs',
        'Cron expression syntax',
        'Job monitoring',
        'Error handling',
        'Job history',
        'Timezone support',
        'Concurrent execution',
        'Job dependencies',
      ],
      Webhooks: [
        'Database event triggers',
        'HTTP POST requests',
        'Custom payloads',
        'Authentication headers',
        'Retry logic',
        'Async execution',
        'Event filtering',
        'Batch webhooks',
        'Webhook logs',
        'Circuit breakers',
      ],
      Wrappers: [
        'Query external APIs as tables',
        'Stripe integration',
        'Firebase integration',
        'S3 integration',
        'BigQuery integration',
        'Airtable integration',
        'SQL joins with external data',
        'Data caching',
        'Authentication handling',
        'Rate limit management',
      ],
      Analytics: [
        'BigQuery export',
        'Apache Iceberg support',
        'Incremental sync',
        'Data transformation',
        'Scheduled exports',
        'Change data capture',
        'Analytics views',
        'Data aggregation',
        'Time-series _analysis,
        'Data lake integration',
      ],
    };

    return capabilities[category] || [];
  }

  /**
   * Get prerequisites
   */
  private getPrerequisites(category: string): string[] {
    const prerequisites: Record<string, string[]> = {
      Database: [
        'Basic SQL knowledge',
        'Understanding of relational databases',
        'Familiarity with PostgreSQL (helpful)',
      ],
      Auth: [
        'Understanding of authentication concepts',
        'Knowledge of JWT tokens',
        'OAuth flow understanding (for social auth)',
      ],
      Storage: [
        'Understanding of object storage',
        'File handling in your chosen framework',
        'Basic knowledge of CDNs',
      ],
      Realtime: [
        'Understanding of WebSockets',
        'Event-driven programming concepts',
        'Asynchronous JavaScript',
      ],
      'Edge Functions': [
        'TypeScript/JavaScript knowledge',
        'Understanding of serverless concepts',
        'Basic Deno knowledge (helpful)',
      ],
      'Vector/Embeddings': [
        'Understanding of embeddings',
        'Basic machine learning concepts',
        'Vector math basics',
      ],
      GraphQL: ['GraphQL query language', 'Understanding of schemas', 'API design concepts'],
      Vault: ['Encryption concepts', 'Security best practices', 'Key management understanding'],
      Cron: ['Cron expression syntax', 'SQL knowledge', 'Understanding of scheduled tasks'],
      Webhooks: ['HTTP protocol knowledge', 'Event-driven architecture', 'API security basics'],
      Wrappers: ['SQL knowledge', 'Understanding of foreign data', 'API integration experience'],
      Analytics: ['Data warehouse concepts', 'ETL understanding', 'SQL aggregation knowledge'],
    };

    return prerequisites[category] || [];
  }

  /**
   * Get best practices
   */
  private getBestPractices(category: string): string[] {
    const practices: Record<string, string[]> = {
      Database: [
        'Always use Row Level Security (RLS)',
        'Create indexes for frequently queried columns',
        'Use database functions for complex logic',
        'Implement proper _errorhandling',
        'Use transactions for data consistency',
        'Regular backups and point-in-time recovery',
        'Monitor query performance',
        'Use connection pooling',
        'Implement rate limiting',
        'Version control your migrations',
      ],
      Auth: [
        'Implement proper session management',
        'Use secure password requirements',
        'Enable MFA for sensitive accounts',
        'Validate email addresses',
        'Implement rate limiting on auth endpoints',
        'Use refresh token rotation',
        'Log authentication events',
        'Handle edge cases (expired tokens, etc)',
        'Implement proper logout',
        'Secure password reset flows',
      ],
      Storage: [
        'Set appropriate bucket policies',
        'Use presigned URLs for uploads',
        'Implement file type validation',
        'Set size limits',
        'Use CDN for public assets',
        'Implement virus scanning for uploads',
        'Regular cleanup of unused files',
        'Monitor storage usage',
        'Use image transformations wisely',
        'Implement proper _errorhandling',
      ],
      Realtime: [
        'Implement reconnection logic',
        'Handle connection state changes',
        'Use channel namespacing',
        'Implement proper cleanup on disconnect',
        'Rate limit broadcast messages',
        'Use presence sparingly',
        'Filter subscriptions at database level',
        'Monitor WebSocket connections',
        'Implement heartbeat checks',
        'Handle network interruptions',
      ],
      'Edge Functions': [
        'Keep functions small and focused',
        'Use environment variables for secrets',
        'Implement proper _errorhandling',
        'Add requestvalidation',
        'Use TypeScript for type safety',
        'Monitor function execution time',
        'Implement rate limiting',
        'Use connection pooling for database',
        'Log important events',
        'Test locally before deploying',
      ],
    };

    return practices[category] || [];
  }

  /**
   * Get examples for a category
   */
  private getExamples(category: string): any[] {
    // This would contain specific examples for each category
    // Simplified for brevity
    return [
      {
        title: `Basic ${category} Example`,
        description: `A simple example of using ${category}`,
        language: 'javascript',
        code: `// Example code for ${category}`,
      },
    ];
  }

  /**
   * Get subcategory descriptions
   */
  private getSubcategoryDescription(category: string, subcategory: string): string {
    return `Detailed guide for ${subcategory} within Supabase ${category}`;
  }

  /**
   * Get subcategory code snippets
   */
  private async getSubcategoryCodeSnippets(category: string, subcategory: string): Promise<any[]> {
    // This would return specific snippets for each subcategory
    return [];
  }

  /**
   * Get subcategory setup instructions
   */
  private getSubcategorySetup(category: string, subcategory: string): string[] {
    return [`Setup instructions for ${category} - ${subcategory}`];
  }

  /**
   * Get subcategory capabilities
   */
  private getSubcategoryCapabilities(category: string, subcategory: string): string[] {
    return [`Capabilities of ${category} - ${subcategory}`];
  }

  /**
   * Get subcategory examples
   */
  private getSubcategoryExamples(category: string, subcategory: string): any[] {
    return [];
  }

  /**
   * Get API reference
   */
  private getApiReference(category: string): any {
    // This would return API reference for each category
    return {
      endpoint: `/api/${category.toLowerCase()}`,
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      parameters: {},
      response: {},
    };
  }

  /**
   * Store all documentation in Supabase
   */
  private async storeDocumentation(): Promise<void> {
    logger.info('Storing documentation in Supabase...');

    for (const [key, doc] of this.docsCache) {
      try {
        // Validate the document
        const validatedDoc = DocEntrySchema.parse(doc);

        // Store in knowledge base
        const { _error kbError } = await this.supabase.from('ai_knowledge_base').upsert(
          {
            title: validatedDoc.title,
            content JSON.stringify({
              description: validatedDoc.description,
              setup_instructions: validatedDoc.setup_instructions,
              capabilities: validatedDoc.capabilities,
              prerequisites: validatedDoc.prerequisites,
              best_practices: validatedDoc.best_practices,
              api_reference: validatedDoc.api_reference,
            }),
            category: validatedDoc.category,
            tags: [
              'supabase',
              validatedDoc.category.toLowerCase(),
              ...(validatedDoc.subcategory ? [validatedDoc.subcategory.toLowerCase()] : []),
            ],
            source: 'supabase_docs',
            metadata: {
              subcategory: validatedDoc.subcategory,
              related_docs: validatedDoc.related_docs,
              last_updated: new Date().toISOString(),
            },
          },
          {
            onConflict: 'title',
          }
        );

        if (kbError) {
          logger.error(Error storing knowledge base entry for ${key}:`, kbError);
        }

        // Store code snippets separately for better search
        for (const snippet of validatedDoc.code_snippets) {
          const { _error snippetError } = await this.supabase.from('ai_code_snippets').insert({
            title: `${validatedDoc.title} - ${snippet.description || 'Code Example'}`,
            language: snippet.language,
            code: snippet.code,
            description: snippet.description,
            category: validatedDoc.category,
            subcategory: validatedDoc.subcategory,
            tags: ['supabase', validatedDoc.category.toLowerCase(), snippet.language],
            metadata: {
              source: 'supabase_docs',
              related_to: validatedDoc.title,
            },
          });

          if (snippetError) {
            logger.error(Error storing code snippet:`, snippetError);
          }
        }

        // Store examples
        if (validatedDoc.examples) {
          for (const example of validatedDoc.examples) {
            const { _error exampleError } = await this.supabase.from('ai_code_examples').insert({
              title: example.title,
              description: example.description,
              code: example.code,
              language: example.language,
              category: validatedDoc.category,
              tags: ['supabase', 'example', validatedDoc.category.toLowerCase()],
              metadata: {
                source: 'supabase_docs',
                parent_doc: validatedDoc.title,
              },
            });

            if (exampleError) {
              logger.error(Error storing example:`, exampleError);
            }
          }
        }

        logger.info(`✓ Stored documentation for ${key}`);
      } catch (error) {
        logger.error(Error processing documentation for ${key}:`, error);
      }
    }
  }
}

// Export function to run the scraper
export async function scrapeSupabaseDocs(supabase: SupabaseClient): Promise<void> {
  const scraper = new SupabaseDocsScraper(supabase);
  await scraper.scrapeAndStore();
}
