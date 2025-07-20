-- Seed data for SDK documentation
-- This file populates the sdk_documentation table with Supabase TypeScript SDK reference

-- Helper function to insert multiple examples at once
CREATE OR REPLACE FUNCTION seed_sdk_documentation() RETURNS void AS $$
BEGIN
    -- INITIALIZATION EXAMPLES
    PERFORM insert_sdk_documentation(
        'supabase-js',
        'initialization',
        'Basic Client Creation',
        'Create a basic Supabase client instance',
        E'import { createClient } from ''@supabase/supabase-js'';\n\nconst supabaseUrl = process.env.SUPABASE_URL!;\nconst supabaseKey = process.env.SUPABASE_ANON_KEY!;\n\nconst supabase = createClient(supabaseUrl, supabaseKey);',
        NULL,
        ARRAY['client', 'initialization', 'basic'],
        'Store URL and keys in environment variables for security'
    );

    PERFORM insert_sdk_documentation(
        'supabase-js',
        'initialization',
        'Advanced Client with Options',
        'Create Supabase client with advanced configuration options',
        E'const supabase = createClient<Database>(\n  process.env.SUPABASE_URL!,\n  process.env.SUPABASE_ANON_KEY!,\n  {\n    auth: {\n      autoRefreshToken: true,\n      persistSession: true,\n      detectSessionInUrl: true\n    },\n    realtime: {\n      params: {\n        eventsPerSecond: 10\n      }\n    },\n    global: {\n      headers: { ''x-my-custom-header'': ''my-value'' }\n    }\n  }\n);',
        NULL,
        ARRAY['client', 'initialization', 'advanced', 'auth', 'realtime'],
        'Use TypeScript generics for type safety with Database types'
    );

    -- DATABASE - SELECT OPERATIONS
    PERFORM insert_sdk_documentation(
        'supabase-js',
        'database',
        'Basic Select Query',
        'Select all records from a table',
        E'const { data, error } = await supabase\n  .from(''agents'')\n  .select(''*'');',
        'select',
        ARRAY['database', 'select', 'query'],
        'Always check for errors before using data'
    );

    PERFORM insert_sdk_documentation(
        'supabase-js',
        'database',
        'Select with Columns',
        'Select specific columns from a table',
        E'const { data, error } = await supabase\n  .from(''agents'')\n  .select(''id, name, status'');',
        'select',
        ARRAY['database', 'select', 'columns'],
        'Selecting specific columns reduces data transfer'
    );

    PERFORM insert_sdk_documentation(
        'supabase-js',
        'database',
        'Select with Filters',
        'Apply filters to select queries',
        E'const { data, error } = await supabase\n  .from(''agents'')\n  .select(''*'')\n  .eq(''status'', ''active'')\n  .gt(''priority'', 5)\n  .like(''name'', ''%AI%'');',
        'select',
        ARRAY['database', 'select', 'filter', 'where'],
        'Chain multiple filters for complex queries'
    );

    PERFORM insert_sdk_documentation(
        'supabase-js',
        'database',
        'Select with Joins',
        'Join related tables in queries',
        E'const { data, error } = await supabase\n  .from(''agents'')\n  .select(`\n    id,\n    name,\n    memories (\n      content,\n      created_at\n    )\n  `);',
        'select',
        ARRAY['database', 'select', 'join', 'relationship'],
        'Use backticks for multi-line select statements with joins'
    );

    PERFORM insert_sdk_documentation(
        'supabase-js',
        'database',
        'Select with Pagination',
        'Implement pagination in queries',
        E'const { data, error, count } = await supabase\n  .from(''agents'')\n  .select(''*'', { count: ''exact'' })\n  .range(0, 9)\n  .order(''created_at'', { ascending: false });',
        'select',
        ARRAY['database', 'select', 'pagination', 'limit', 'offset'],
        'Use count: "exact" to get total record count for pagination'
    );

    -- DATABASE - INSERT OPERATIONS
    PERFORM insert_sdk_documentation(
        'supabase-js',
        'database',
        'Single Insert',
        'Insert a single record into a table',
        E'const { data, error } = await supabase\n  .from(''agents'')\n  .insert({\n    name: ''New Agent'',\n    status: ''active'',\n    config: { priority: 10 }\n  })\n  .select();',
        'insert',
        ARRAY['database', 'insert', 'create'],
        'Add .select() to return the inserted record'
    );

    PERFORM insert_sdk_documentation(
        'supabase-js',
        'database',
        'Bulk Insert',
        'Insert multiple records at once',
        E'const { data, error } = await supabase\n  .from(''agents'')\n  .insert([\n    { name: ''Agent 1'', status: ''active'' },\n    { name: ''Agent 2'', status: ''inactive'' }\n  ])\n  .select();',
        'insert',
        ARRAY['database', 'insert', 'bulk', 'batch'],
        'Bulk inserts are more efficient than multiple single inserts'
    );

    PERFORM insert_sdk_documentation(
        'supabase-js',
        'database',
        'Upsert Operation',
        'Insert or update based on conflict',
        E'const { data, error } = await supabase\n  .from(''agents'')\n  .upsert({\n    id: ''123'',\n    name: ''Updated Agent'',\n    status: ''active''\n  })\n  .select();',
        'insert',
        ARRAY['database', 'upsert', 'insert', 'update'],
        'Upsert requires a unique constraint on the conflict column'
    );

    -- DATABASE - UPDATE OPERATIONS
    PERFORM insert_sdk_documentation(
        'supabase-js',
        'database',
        'Basic Update',
        'Update records in a table',
        E'const { data, error } = await supabase\n  .from(''agents'')\n  .update({ status: ''inactive'' })\n  .eq(''id'', ''123'')\n  .select();',
        'update',
        ARRAY['database', 'update', 'modify'],
        'Always include a filter to avoid updating all records'
    );

    PERFORM insert_sdk_documentation(
        'supabase-js',
        'database',
        'Update with Multiple Conditions',
        'Update records matching multiple conditions',
        E'const { data, error } = await supabase\n  .from(''agents'')\n  .update({ last_active: new Date().toISOString() })\n  .eq(''status'', ''active'')\n  .gte(''priority'', 5)\n  .select();',
        'update',
        ARRAY['database', 'update', 'conditions', 'filter'],
        'Combine multiple filters for precise updates'
    );

    -- DATABASE - DELETE OPERATIONS
    PERFORM insert_sdk_documentation(
        'supabase-js',
        'database',
        'Basic Delete',
        'Delete records from a table',
        E'const { error } = await supabase\n  .from(''agents'')\n  .delete()\n  .eq(''id'', ''123'');',
        'delete',
        ARRAY['database', 'delete', 'remove'],
        'Delete operations do not return data by default'
    );

    -- DATABASE - RPC OPERATIONS
    PERFORM insert_sdk_documentation(
        'supabase-js',
        'database',
        'Call Stored Procedure',
        'Execute a database function',
        E'const { data, error } = await supabase\n  .rpc(''get_agent_statistics'', {\n    agent_id: ''123''\n  });',
        'rpc',
        ARRAY['database', 'rpc', 'function', 'procedure'],
        'RPC functions must be created in the database first'
    );

    -- AUTHENTICATION
    PERFORM insert_sdk_documentation(
        'supabase-js',
        'authentication',
        'Sign Up New User',
        'Create a new user account',
        E'const { data, error } = await supabase.auth.signUp({\n  email: ''user@example.com'',\n  password: ''secure-password'',\n  options: {\n    data: {\n      first_name: ''John'',\n      age: 27\n    }\n  }\n});',
        NULL,
        ARRAY['auth', 'signup', 'register'],
        'User metadata can be stored in options.data'
    );

    PERFORM insert_sdk_documentation(
        'supabase-js',
        'authentication',
        'Sign In with Password',
        'Authenticate existing user',
        E'const { data, error } = await supabase.auth.signInWithPassword({\n  email: ''user@example.com'',\n  password: ''secure-password''\n});',
        NULL,
        ARRAY['auth', 'signin', 'login'],
        'Returns session and user data on success'
    );

    PERFORM insert_sdk_documentation(
        'supabase-js',
        'authentication',
        'Get Current Session',
        'Retrieve the current user session',
        E'const { data: { session } } = await supabase.auth.getSession();',
        NULL,
        ARRAY['auth', 'session', 'current'],
        'Session includes access token and user data'
    );

    PERFORM insert_sdk_documentation(
        'supabase-js',
        'authentication',
        'Sign Out User',
        'Log out the current user',
        E'const { error } = await supabase.auth.signOut();',
        NULL,
        ARRAY['auth', 'signout', 'logout'],
        'Clears session from local storage'
    );

    -- REALTIME
    PERFORM insert_sdk_documentation(
        'supabase-js',
        'realtime',
        'Subscribe to Table Changes',
        'Listen to real-time database changes',
        E'const channel = supabase\n  .channel(''agents-changes'')\n  .on(\n    ''postgres_changes'',\n    {\n      event: ''*'',\n      schema: ''public'',\n      table: ''agents''\n    },\n    (payload) => {\n      console.log(''Change received!'', payload);\n    }\n  )\n  .subscribe();',
        NULL,
        ARRAY['realtime', 'subscribe', 'changes', 'postgres'],
        'Remember to unsubscribe when component unmounts'
    );

    PERFORM insert_sdk_documentation(
        'supabase-js',
        'realtime',
        'Subscribe to Specific Events',
        'Listen to specific database events',
        E'const channel = supabase\n  .channel(''agent-updates'')\n  .on(\n    ''postgres_changes'',\n    {\n      event: ''UPDATE'',\n      schema: ''public'',\n      table: ''agents'',\n      filter: ''status=eq.active''\n    },\n    (payload) => {\n      console.log(''Active agent updated!'', payload);\n    }\n  )\n  .subscribe();',
        NULL,
        ARRAY['realtime', 'subscribe', 'filter', 'update'],
        'Use filters to reduce unnecessary updates'
    );

    PERFORM insert_sdk_documentation(
        'supabase-js',
        'realtime',
        'Presence Tracking',
        'Track online users in real-time',
        E'const channel = supabase.channel(''online-users'');\n\nchannel\n  .on(''presence'', { event: ''sync'' }, () => {\n    const state = channel.presenceState();\n    console.log(''Online users:'', state);\n  })\n  .on(''presence'', { event: ''join'' }, ({ key, newPresences }) => {\n    console.log(''User joined:'', key);\n  })\n  .subscribe(async (status) => {\n    if (status === ''SUBSCRIBED'') {\n      await channel.track({\n        user_id: ''123'',\n        online_at: new Date().toISOString()\n      });\n    }\n  });',
        NULL,
        ARRAY['realtime', 'presence', 'online', 'tracking'],
        'Presence automatically handles user disconnections'
    );

    -- STORAGE
    PERFORM insert_sdk_documentation(
        'supabase-js',
        'storage',
        'Upload File',
        'Upload a file to Supabase Storage',
        E'const file = new File([''content''], ''document.txt'', {\n  type: ''text/plain''\n});\n\nconst { data, error } = await supabase.storage\n  .from(''documents'')\n  .upload(''path/to/document.txt'', file, {\n    cacheControl: ''3600'',\n    upsert: true\n  });',
        NULL,
        ARRAY['storage', 'upload', 'file'],
        'Set upsert: true to overwrite existing files'
    );

    PERFORM insert_sdk_documentation(
        'supabase-js',
        'storage',
        'Download File',
        'Download a file from storage',
        E'const { data, error } = await supabase.storage\n  .from(''documents'')\n  .download(''path/to/document.txt'');',
        NULL,
        ARRAY['storage', 'download', 'file'],
        'Returns file as Blob'
    );

    PERFORM insert_sdk_documentation(
        'supabase-js',
        'storage',
        'Get Public URL',
        'Get a public URL for a file',
        E'const { data } = supabase.storage\n  .from(''documents'')\n  .getPublicUrl(''path/to/document.txt'');\n\nconst publicUrl = data.publicUrl;',
        NULL,
        ARRAY['storage', 'url', 'public'],
        'File must be in a public bucket'
    );

    -- EDGE FUNCTIONS
    PERFORM insert_sdk_documentation(
        'supabase-js',
        'edge_functions',
        'Invoke Edge Function',
        'Call a Supabase Edge Function',
        E'const { data, error } = await supabase.functions.invoke(''hello-world'', {\n  body: {\n    name: ''Functions User''\n  },\n  headers: {\n    ''x-custom-header'': ''custom-value''\n  }\n});',
        NULL,
        ARRAY['functions', 'edge', 'invoke'],
        'Edge Functions run on Deno runtime'
    );

    -- VECTOR OPERATIONS
    PERFORM insert_sdk_documentation(
        'supabase-js',
        'vectors',
        'Store Embedding',
        'Store vector embeddings in database',
        E'const embedding = new Array(1536).fill(0).map(() => Math.random());\n\nconst { data, error } = await supabase\n  .from(''documents'')\n  .insert({\n    content: ''Document content'',\n    embedding: embedding,\n    metadata: { category: ''tutorial'' }\n  });',
        NULL,
        ARRAY['vector', 'embedding', 'ai'],
        'Embeddings are typically 1536 dimensions for OpenAI'
    );

    PERFORM insert_sdk_documentation(
        'supabase-js',
        'vectors',
        'Vector Similarity Search',
        'Search by vector similarity',
        E'const { data, error } = await supabase.rpc(''match_documents'', {\n  query_embedding: queryVector,\n  match_threshold: 0.7,\n  match_count: 10\n});',
        NULL,
        ARRAY['vector', 'search', 'similarity', 'ai'],
        'Lower distance means higher similarity'
    );

    -- ERROR HANDLING
    PERFORM insert_sdk_documentation(
        'supabase-js',
        'error_handling',
        'Comprehensive Error Handling',
        'Handle different types of errors',
        E'try {\n  const { data, error } = await supabase\n    .from(''agents'')\n    .select(''*'')\n    .single();\n\n  if (error) {\n    switch (error.code) {\n      case ''PGRST116'':\n        console.error(''No rows returned'');\n        break;\n      case ''42P01'':\n        console.error(''Table does not exist'');\n        break;\n      case ''23505'':\n        console.error(''Duplicate key violation'');\n        break;\n      default:\n        console.error(''Database error:'', error.message);\n    }\n    return null;\n  }\n\n  return data;\n} catch (err) {\n  console.error(''Unexpected error:'', err);\n  return null;\n}',
        NULL,
        ARRAY['error', 'handling', 'try-catch'],
        'Always check error codes for specific handling'
    );

    -- ADVANCED PATTERNS
    PERFORM insert_sdk_documentation(
        'supabase-js',
        'advanced_patterns',
        'Optimistic Updates',
        'Update UI before database confirmation',
        E'// Update local state immediately\nconst optimisticData = { id: ''123'', status: ''processing'' };\nupdateLocalState(optimisticData);\n\n// Then update database\nconst { data, error } = await supabase\n  .from(''agents'')\n  .update({ status: ''processing'' })\n  .eq(''id'', ''123'')\n  .select()\n  .single();\n\nif (error) {\n  // Revert optimistic update\n  revertLocalState();\n  console.error(''Update failed'');\n}',
        NULL,
        ARRAY['pattern', 'optimistic', 'ui', 'performance'],
        'Improves perceived performance'
    );

    PERFORM insert_sdk_documentation(
        'supabase-js',
        'advanced_patterns',
        'Batch Operations',
        'Perform multiple operations efficiently',
        E'const updates = [\n  { id: ''1'', status: ''active'' },\n  { id: ''2'', status: ''inactive'' },\n  { id: ''3'', status: ''active'' }\n];\n\n// Use Promise.all for parallel operations\nconst results = await Promise.all(\n  updates.map(update =>\n    supabase\n      .from(''agents'')\n      .update({ status: update.status })\n      .eq(''id'', update.id)\n      .select()\n  )\n);\n\n// Check for any errors\nconst errors = results.filter(r => r.error);\nif (errors.length > 0) {\n  console.error(''Some updates failed:'', errors);\n}',
        NULL,
        ARRAY['pattern', 'batch', 'parallel', 'performance'],
        'Parallel operations are faster than sequential'
    );

    PERFORM insert_sdk_documentation(
        'supabase-js',
        'advanced_patterns',
        'Connection Pooling',
        'Manage Supabase client instances',
        E'// Singleton pattern for client\nclass SupabaseManager {\n  private static instance: SupabaseClient;\n  \n  static getInstance(): SupabaseClient {\n    if (!this.instance) {\n      this.instance = createClient(\n        process.env.SUPABASE_URL!,\n        process.env.SUPABASE_ANON_KEY!,\n        {\n          auth: {\n            autoRefreshToken: true,\n            persistSession: true\n          }\n        }\n      );\n    }\n    return this.instance;\n  }\n}\n\n// Usage\nconst supabase = SupabaseManager.getInstance();',
        NULL,
        ARRAY['pattern', 'singleton', 'connection', 'performance'],
        'Reuse client instances for better performance'
    );

    -- BEST PRACTICES
    PERFORM insert_sdk_documentation(
        'supabase-js',
        'best_practices',
        'Type Safety with TypeScript',
        'Use TypeScript for type-safe database operations',
        E'// Generate types from your database\n// Run: supabase gen types typescript --local > database.types.ts\n\nimport { Database } from ''./database.types'';\n\ntype Agent = Database[''public''][''Tables''][''agents''][''Row''];\ntype InsertAgent = Database[''public''][''Tables''][''agents''][''Insert''];\n\nconst supabase = createClient<Database>(\n  process.env.SUPABASE_URL!,\n  process.env.SUPABASE_ANON_KEY!\n);\n\n// Type-safe query\nconst { data, error } = await supabase\n  .from(''agents'')\n  .select(''*'')\n  .returns<Agent[]>();',
        NULL,
        ARRAY['typescript', 'types', 'safety', 'best-practice'],
        'Generate types from your database schema'
    );

    PERFORM insert_sdk_documentation(
        'supabase-js',
        'best_practices',
        'Environment Variables',
        'Securely manage Supabase credentials',
        E'// .env.local\nNEXT_PUBLIC_SUPABASE_URL=your_supabase_url\nNEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key\nSUPABASE_SERVICE_KEY=your_service_key # Server-side only\n\n// Usage in code\nconst supabase = createClient(\n  process.env.NEXT_PUBLIC_SUPABASE_URL!,\n  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!\n);\n\n// Server-side with service key\nconst supabaseAdmin = createClient(\n  process.env.NEXT_PUBLIC_SUPABASE_URL!,\n  process.env.SUPABASE_SERVICE_KEY!,\n  {\n    auth: {\n      autoRefreshToken: false,\n      persistSession: false\n    }\n  }\n);',
        NULL,
        ARRAY['security', 'environment', 'credentials', 'best-practice'],
        'Never expose service keys to client-side code'
    );

    PERFORM insert_sdk_documentation(
        'supabase-js',
        'best_practices',
        'Query Optimization',
        'Optimize database queries for performance',
        E'// Bad: Select all columns when you only need a few\nconst { data: bad } = await supabase\n  .from(''large_table'')\n  .select(''*'');\n\n// Good: Select only needed columns\nconst { data: good } = await supabase\n  .from(''large_table'')\n  .select(''id, name, status'');\n\n// Better: Use pagination for large datasets\nconst { data: better, count } = await supabase\n  .from(''large_table'')\n  .select(''id, name, status'', { count: ''exact'' })\n  .range(0, 99)\n  .order(''created_at'', { ascending: false });\n\n// Best: Use RPC for complex queries\nconst { data: best } = await supabase\n  .rpc(''get_optimized_data'', {\n    limit: 100,\n    filters: { status: ''active'' }\n  });',
        NULL,
        ARRAY['performance', 'optimization', 'query', 'best-practice'],
        'Minimize data transfer and use indexes'
    );

    -- Add patterns
    INSERT INTO sdk_patterns (
        pattern_name,
        description,
        use_case,
        implementation,
        pros,
        cons,
        when_to_use,
        when_not_to_use,
        example_scenario
    ) VALUES (
        'Repository Pattern',
        'Encapsulate data access logic in repository classes',
        'Centralize database operations and improve testability',
        E'export class AgentRepository {\n  constructor(private supabase: SupabaseClient) {}\n\n  async findById(id: string): Promise<Agent | null> {\n    const { data, error } = await this.supabase\n      .from(''agents'')\n      .select(''*'')\n      .eq(''id'', id)\n      .single();\n\n    if (error) {\n      console.error(''Error fetching agent:'', error);\n      return null;\n    }\n\n    return data;\n  }\n\n  async findActive(): Promise<Agent[]> {\n    const { data, error } = await this.supabase\n      .from(''agents'')\n      .select(''*'')\n      .eq(''status'', ''active'')\n      .order(''priority'', { ascending: false });\n\n    return data || [];\n  }\n\n  async create(agent: CreateAgentDto): Promise<Agent | null> {\n    const { data, error } = await this.supabase\n      .from(''agents'')\n      .insert(agent)\n      .select()\n      .single();\n\n    if (error) {\n      console.error(''Error creating agent:'', error);\n      return null;\n    }\n\n    return data;\n  }\n}',
        ARRAY['Separation of concerns', 'Easy to test', 'Consistent error handling', 'Type safety'],
        ARRAY['Additional abstraction layer', 'May hide Supabase features'],
        'When you have complex data access logic or need to mock database calls for testing',
        'For simple CRUD operations where direct Supabase usage is clearer',
        'Large application with multiple developers working on different features'
    );

    INSERT INTO sdk_patterns (
        pattern_name,
        description,
        use_case,
        implementation,
        pros,
        cons,
        when_to_use,
        when_not_to_use,
        example_scenario
    ) VALUES (
        'Real-time Sync Pattern',
        'Keep local state synchronized with database changes',
        'Build collaborative features with real-time updates',
        E'export function useRealtimeSync<T>(table: string, filter?: string) {\n  const [data, setData] = useState<T[]>([]);\n  const [loading, setLoading] = useState(true);\n  const supabase = useSupabase();\n\n  useEffect(() => {\n    // Initial fetch\n    const fetchData = async () => {\n      const query = supabase.from(table).select(''*'');\n      if (filter) {\n        // Apply filter (e.g., "status=eq.active")\n        const [column, op, value] = filter.split(''.'');\n        query.eq(column.split(''='')[0], value);\n      }\n\n      const { data, error } = await query;\n      if (!error && data) {\n        setData(data as T[]);\n      }\n      setLoading(false);\n    };\n\n    fetchData();\n\n    // Set up real-time subscription\n    const channel = supabase\n      .channel(`${table}-changes`)\n      .on(\n        ''postgres_changes'',\n        {\n          event: ''*'',\n          schema: ''public'',\n          table,\n          filter\n        },\n        (payload) => {\n          if (payload.eventType === ''INSERT'') {\n            setData(prev => [...prev, payload.new as T]);\n          } else if (payload.eventType === ''UPDATE'') {\n            setData(prev => \n              prev.map(item => \n                (item as any).id === payload.new.id ? payload.new as T : item\n              )\n            );\n          } else if (payload.eventType === ''DELETE'') {\n            setData(prev => \n              prev.filter(item => (item as any).id !== payload.old.id)\n            );\n          }\n        }\n      )\n      .subscribe();\n\n    return () => {\n      supabase.removeChannel(channel);\n    };\n  }, [table, filter]);\n\n  return { data, loading };\n}',
        ARRAY['Automatic synchronization', 'Reduced API calls', 'Real-time collaboration'],
        ARRAY['Complex state management', 'Potential race conditions', 'Memory usage for large datasets'],
        'Building collaborative applications, dashboards, or chat systems',
        'Static data that rarely changes or when real-time updates add complexity',
        'Multi-user document editor or team task management system'
    );

END;
$$ LANGUAGE plpgsql;

-- Execute the seeding function
SELECT seed_sdk_documentation();

-- Clean up the temporary function
DROP FUNCTION seed_sdk_documentation();

-- Create additional helper function for agents to easily get examples
CREATE OR REPLACE FUNCTION get_sdk_example_for_task(
    task_description TEXT
)
RETURNS TABLE (
    title TEXT,
    code_example TEXT,
    usage_notes TEXT,
    relevance FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.title,
        s.code_example,
        s.usage_notes,
        ts_rank(s.search_text, plainto_tsquery('english', task_description)) as relevance
    FROM sdk_documentation s
    WHERE 
        s.code_example IS NOT NULL
        AND s.search_text @@ plainto_tsquery('english', task_description)
    ORDER BY relevance DESC
    LIMIT 5;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION get_sdk_example_for_task TO authenticated;

-- Create index for faster pattern lookups
CREATE INDEX idx_sdk_patterns_name ON sdk_patterns(pattern_name);

-- Notify that SDK documentation is ready
DO $$
BEGIN
    RAISE NOTICE 'SDK documentation has been successfully loaded into the database';
    RAISE NOTICE 'LLMs can now query this information using:';
    RAISE NOTICE '  - search_sdk_documentation() for text search';
    RAISE NOTICE '  - search_sdk_by_embedding() for semantic search';
    RAISE NOTICE '  - get_sdk_examples() for category-based examples';
    RAISE NOTICE '  - get_sdk_example_for_task() for task-based examples';
END $$;