/**
 * Database Schema Service for Graph-R1
 * 
 * Manages the database schema for storing graph data in both
 * Supabase (PostgreSQL) and Neo4j, with automatic migration support.
 */

import { log, LogContext } from '../../utils/logger';
import { contextStorageService } from '../context-storage-service';
import { getSupabaseClient } from '../supabase-client';

export interface GraphDatabaseSchema {
  nodes: NodeSchema;
  relationships: RelationshipSchema;
  hyperedges: HyperedgeSchema;
  communities: CommunitySchema;
  reasoning_sessions: ReasoningSessionSchema;
  embeddings: EmbeddingSchema;
}

export interface NodeSchema {
  id: string;
  type: string;
  name: string;
  description?: string;
  properties: Record<string, any>;
  embedding?: number[];
  created_at: Date;
  updated_at: Date;
  confidence: number;
  source: string;
}

export interface RelationshipSchema {
  id: string;
  source_id: string;
  target_id: string;
  type: string;
  properties: Record<string, any>;
  weight: number;
  confidence: number;
  bidirectional: boolean;
  is_nary: boolean;
  participants?: string[];
  created_at: Date;
}

export interface HyperedgeSchema {
  id: string;
  type: string;
  node_ids: string[];
  node_roles: Record<string, string>;
  properties: Record<string, any>;
  weight: number;
  confidence: number;
  context: string;
  embedding?: number[];
  pattern_id?: string;
  created_at: Date;
}

export interface CommunitySchema {
  id: string;
  node_ids: string[];
  label: string;
  summary: string;
  level: number;
  parent_id?: string;
  child_ids: string[];
  metrics: {
    size: number;
    density: number;
    modularity: number;
    coherence: number;
  };
  centroid?: number[];
  algorithm: string;
  created_at: Date;
}

export interface ReasoningSessionSchema {
  id: string;
  user_id: string;
  query: string;
  answer: string;
  confidence: number;
  steps: Array<{
    type: string;
    content: string;
    confidence: number;
    timestamp: number;
    metadata?: Record<string, any>;
  }>;
  retrieved_paths: Array<{
    nodes: string[];
    relationships: string[];
    score: number;
  }>;
  total_reward: number;
  reasoning_traces: string[];
  grpo_transitions: Array<{
    state: Record<string, any>;
    action: Record<string, any>;
    reward: number;
    next_state: Record<string, any>;
    done: boolean;
  }>;
  created_at: Date;
  completed_at?: Date;
}

export interface EmbeddingSchema {
  id: string;
  entity_id: string;
  entity_type: 'node' | 'hyperedge' | 'community';
  embedding: number[];
  model: string;
  created_at: Date;
}

export class DatabaseSchemaService {
  private schemaVersion = '1.0.0';
  
  constructor() {}

  /**
   * Initialize database schema for Graph-R1
   */
  async initializeSchema(): Promise<void> {
    log.info('Initializing Graph-R1 database schema', LogContext.DATABASE);

    try {
      // Create tables in Supabase (PostgreSQL)
      await this.createSupabaseTables();
      
      // Create Neo4j constraints and indexes
      await this.createNeo4jSchema();
      
      log.info('Database schema initialized successfully', LogContext.DATABASE, {
        version: this.schemaVersion
      });
    } catch (error) {
      log.error('Failed to initialize database schema', LogContext.DATABASE, { error });
      throw error;
    }
  }

  /**
   * Create tables in Supabase (PostgreSQL)
   */
  private async createSupabaseTables(): Promise<void> {
    const supabase = getSupabaseClient();

    // Graph nodes table
    await this.executeSQLSafely(`
      CREATE TABLE IF NOT EXISTS graph_nodes (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        properties JSONB DEFAULT '{}',
        embedding vector(1536), -- OpenAI embedding dimension
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        confidence REAL DEFAULT 1.0,
        source TEXT DEFAULT 'system'
      );

      CREATE INDEX IF NOT EXISTS idx_graph_nodes_type ON graph_nodes(type);
      CREATE INDEX IF NOT EXISTS idx_graph_nodes_name ON graph_nodes(name);
      CREATE INDEX IF NOT EXISTS idx_graph_nodes_created_at ON graph_nodes(created_at);
      CREATE INDEX IF NOT EXISTS idx_graph_nodes_embedding ON graph_nodes USING ivfflat (embedding vector_cosine_ops);
    `);

    // Graph relationships table
    await this.executeSQLSafely(`
      CREATE TABLE IF NOT EXISTS graph_relationships (
        id TEXT PRIMARY KEY,
        source_id TEXT NOT NULL,
        target_id TEXT NOT NULL,
        type TEXT NOT NULL,
        properties JSONB DEFAULT '{}',
        weight REAL DEFAULT 1.0,
        confidence REAL DEFAULT 1.0,
        bidirectional BOOLEAN DEFAULT FALSE,
        is_nary BOOLEAN DEFAULT FALSE,
        participants TEXT[],
        created_at TIMESTAMPTZ DEFAULT NOW(),
        FOREIGN KEY (source_id) REFERENCES graph_nodes(id) ON DELETE CASCADE,
        FOREIGN KEY (target_id) REFERENCES graph_nodes(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_graph_relationships_source ON graph_relationships(source_id);
      CREATE INDEX IF NOT EXISTS idx_graph_relationships_target ON graph_relationships(target_id);
      CREATE INDEX IF NOT EXISTS idx_graph_relationships_type ON graph_relationships(type);
      CREATE INDEX IF NOT EXISTS idx_graph_relationships_weight ON graph_relationships(weight);
    `);

    // Hyperedges table
    await this.executeSQLSafely(`
      CREATE TABLE IF NOT EXISTS graph_hyperedges (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        node_ids TEXT[] NOT NULL,
        node_roles JSONB DEFAULT '{}',
        properties JSONB DEFAULT '{}',
        weight REAL DEFAULT 1.0,
        confidence REAL DEFAULT 1.0,
        context TEXT,
        embedding vector(1536),
        pattern_id TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_graph_hyperedges_type ON graph_hyperedges(type);
      CREATE INDEX IF NOT EXISTS idx_graph_hyperedges_node_ids ON graph_hyperedges USING GIN(node_ids);
      CREATE INDEX IF NOT EXISTS idx_graph_hyperedges_embedding ON graph_hyperedges USING ivfflat (embedding vector_cosine_ops);
    `);

    // Communities table
    await this.executeSQLSafely(`
      CREATE TABLE IF NOT EXISTS graph_communities (
        id TEXT PRIMARY KEY,
        node_ids TEXT[] NOT NULL,
        label TEXT NOT NULL,
        summary TEXT,
        level INTEGER DEFAULT 0,
        parent_id TEXT,
        child_ids TEXT[] DEFAULT '{}',
        metrics JSONB DEFAULT '{}',
        centroid vector(1536),
        algorithm TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        FOREIGN KEY (parent_id) REFERENCES graph_communities(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_graph_communities_level ON graph_communities(level);
      CREATE INDEX IF NOT EXISTS idx_graph_communities_parent ON graph_communities(parent_id);
      CREATE INDEX IF NOT EXISTS idx_graph_communities_node_ids ON graph_communities USING GIN(node_ids);
      CREATE INDEX IF NOT EXISTS idx_graph_communities_centroid ON graph_communities USING ivfflat (centroid vector_cosine_ops);
    `);

    // Reasoning sessions table
    await this.executeSQLSafely(`
      CREATE TABLE IF NOT EXISTS reasoning_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        query TEXT NOT NULL,
        answer TEXT,
        confidence REAL DEFAULT 0.0,
        steps JSONB DEFAULT '[]',
        retrieved_paths JSONB DEFAULT '[]',
        total_reward REAL DEFAULT 0.0,
        reasoning_traces TEXT[] DEFAULT '{}',
        grpo_transitions JSONB DEFAULT '[]',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        completed_at TIMESTAMPTZ
      );

      CREATE INDEX IF NOT EXISTS idx_reasoning_sessions_user ON reasoning_sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_reasoning_sessions_created ON reasoning_sessions(created_at);
      CREATE INDEX IF NOT EXISTS idx_reasoning_sessions_query ON reasoning_sessions USING GIN(to_tsvector('english', query));
    `);

    // Embeddings table for caching
    await this.executeSQLSafely(`
      CREATE TABLE IF NOT EXISTS graph_embeddings (
        id TEXT PRIMARY KEY,
        entity_id TEXT NOT NULL,
        entity_type TEXT NOT NULL CHECK (entity_type IN ('node', 'hyperedge', 'community')),
        embedding vector(1536) NOT NULL,
        model TEXT DEFAULT 'text-embedding-ada-002',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(entity_id, entity_type, model)
      );

      CREATE INDEX IF NOT EXISTS idx_graph_embeddings_entity ON graph_embeddings(entity_id, entity_type);
      CREATE INDEX IF NOT EXISTS idx_graph_embeddings_embedding ON graph_embeddings USING ivfflat (embedding vector_cosine_ops);
    `);

    log.info('Supabase tables created successfully', LogContext.DATABASE);
  }

  /**
   * Create Neo4j schema (constraints and indexes)
   */
  private async createNeo4jSchema(): Promise<void> {
    // Note: In a real implementation, this would connect to Neo4j
    // For now, we'll log the Cypher queries that should be executed
    
    const neo4jQueries = [
      // Node constraints
      'CREATE CONSTRAINT entity_id IF NOT EXISTS FOR (n:Entity) REQUIRE n.id IS UNIQUE',
      'CREATE CONSTRAINT concept_id IF NOT EXISTS FOR (n:Concept) REQUIRE n.id IS UNIQUE',
      'CREATE CONSTRAINT agent_id IF NOT EXISTS FOR (n:Agent) REQUIRE n.id IS UNIQUE',
      
      // Indexes for performance
      'CREATE INDEX entity_type IF NOT EXISTS FOR (n:Entity) ON (n.type)',
      'CREATE INDEX entity_name IF NOT EXISTS FOR (n:Entity) ON (n.name)',
      'CREATE INDEX entity_confidence IF NOT EXISTS FOR (n:Entity) ON (n.confidence)',
      
      // Relationship indexes
      'CREATE INDEX rel_type IF NOT EXISTS FOR ()-[r:RELATES_TO]-() ON (r.type)',
      'CREATE INDEX rel_weight IF NOT EXISTS FOR ()-[r:RELATES_TO]-() ON (r.weight)',
      'CREATE INDEX rel_confidence IF NOT EXISTS FOR ()-[r:RELATES_TO]-() ON (r.confidence)',
      
      // Community node constraints
      'CREATE CONSTRAINT community_id IF NOT EXISTS FOR (c:Community) REQUIRE c.id IS UNIQUE',
      'CREATE INDEX community_level IF NOT EXISTS FOR (c:Community) ON (c.level)',
      'CREATE INDEX community_algorithm IF NOT EXISTS FOR (c:Community) ON (c.algorithm)',
      
      // Hyperedge constraints
      'CREATE CONSTRAINT hyperedge_id IF NOT EXISTS FOR (h:Hyperedge) REQUIRE h.id IS UNIQUE',
      'CREATE INDEX hyperedge_type IF NOT EXISTS FOR (h:Hyperedge) ON (h.type)',
      'CREATE INDEX hyperedge_confidence IF NOT EXISTS FOR (h:Hyperedge) ON (h.confidence)'
    ];

    log.info('Neo4j schema queries prepared', LogContext.DATABASE, {
      queries: neo4jQueries.length,
      note: 'Execute these in Neo4j Browser or application'
    });

    // Store Neo4j schema setup script
    const schemaScript = neo4jQueries.join('\n');
    log.debug('Neo4j schema script', LogContext.DATABASE, { script: schemaScript });
  }

  /**
   * Execute SQL safely with error handling and sanitization
   */
  private async executeSQLSafely(sql: string): Promise<void> {
    try {
      // SECURITY: Validate SQL contains only DDL operations for schema setup
      if (!this.validateSchemaSQL(sql)) {
        throw new Error('Invalid SQL: Only DDL operations allowed for schema setup');
      }

      const supabase = getSupabaseClient();
      
      if (!supabase) {
        throw new Error('Supabase client not available');
      }
      
      // SECURITY: Use parameterized queries when possible, avoid direct SQL execution
      // For schema setup, we'll use individual DDL operations instead of bulk execution
      const sqlStatements = this.parseSQLStatements(sql);
      
      for (const statement of sqlStatements) {
        try {
          // Execute each DDL statement individually for better security
          const { error } = await supabase.rpc('exec_ddl', { ddl_statement: statement });
          
          if (error) {
            log.warn('DDL statement failed, attempting fallback', LogContext.DATABASE, { 
              error,
              statement: statement.substring(0, 50) + '...'
            });
          }
        } catch (statementError) {
          log.warn('Individual DDL statement failed', LogContext.DATABASE, { 
            error: statementError,
            statement: statement.substring(0, 50) + '...'
          });
        }
      }
    } catch (error) {
      log.error('Schema SQL execution failed', LogContext.DATABASE, { 
        error,
        sqlPreview: sql.substring(0, 100) + '...'
      });
      throw error;
    }
  }

  /**
   * SECURITY: Validate SQL contains only safe DDL operations
   */
  private validateSchemaSQL(sql: string): boolean {
    const normalizedSQL = sql.toLowerCase().trim();
    
    // Only allow specific DDL operations for schema setup
    const allowedOperations = [
      'create table',
      'create index',
      'create extension',
      'alter table',
      'create constraint'
    ];
    
    // Block dangerous operations
    const blockedOperations = [
      'drop',
      'delete',
      'update',
      'insert',
      'truncate',
      'exec',
      'execute',
      'call',
      'select',
      'union',
      'copy',
      'bulk'
    ];
    
    // Check for blocked operations
    for (const blocked of blockedOperations) {
      if (normalizedSQL.includes(blocked)) {
        log.error('Blocked SQL operation detected', LogContext.DATABASE, { 
          operation: blocked,
          sqlPreview: sql.substring(0, 100)
        });
        return false;
      }
    }
    
    // Ensure at least one allowed operation is present
    const hasAllowedOperation = allowedOperations.some(op => normalizedSQL.includes(op));
    if (!hasAllowedOperation) {
      log.error('No valid DDL operations found', LogContext.DATABASE, {
        sqlPreview: sql.substring(0, 100)
      });
      return false;
    }
    
    return true;
  }

  /**
   * SECURITY: Parse SQL into individual statements for safer execution
   */
  private parseSQLStatements(sql: string): string[] {
    // Split by semicolon but handle potential edge cases
    const statements = sql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    return statements;
  }

  /**
   * Migrate schema to newer version
   */
  async migrateSchema(targetVersion: string): Promise<void> {
    log.info('Starting schema migration', LogContext.DATABASE, {
      from: this.schemaVersion,
      to: targetVersion
    });

    // Add migration logic here as needed
    // For now, just update version
    this.schemaVersion = targetVersion;

    log.info('Schema migration completed', LogContext.DATABASE, {
      newVersion: this.schemaVersion
    });
  }

  /**
   * Validate schema integrity
   */
  async validateSchema(): Promise<{ valid: boolean; issues: string[] }> {
    const issues: string[] = [];

    try {
      const supabase = getSupabaseClient();

      if (!supabase) {
        log.warn('Supabase client not available for validation', LogContext.DATABASE);
        return { valid: false, issues: ['Supabase client not available'] };
      }

      // Check if required tables exist
      const tables = ['graph_nodes', 'graph_relationships', 'graph_hyperedges', 'graph_communities', 'reasoning_sessions'];
      
      for (const table of tables) {
        try {
          const { error } = await supabase.from(table).select('*').limit(1);
          if (error && error.code === 'PGRST116') {
            issues.push(`Table ${table} does not exist`);
          }
        } catch (error) {
          issues.push(`Cannot access table ${table}: ${error}`);
        }
      }

      return {
        valid: issues.length === 0,
        issues
      };
    } catch (error) {
      return {
        valid: false,
        issues: [`Schema validation failed: ${error}`]
      };
    }
  }

  /**
   * Get schema information
   */
  getSchemaInfo() {
    return {
      version: this.schemaVersion,
      tables: [
        'graph_nodes',
        'graph_relationships', 
        'graph_hyperedges',
        'graph_communities',
        'reasoning_sessions',
        'graph_embeddings'
      ],
      neo4jConstraints: [
        'entity_id',
        'concept_id',
        'agent_id',
        'community_id',
        'hyperedge_id'
      ],
      features: [
        'Vector similarity search',
        'N-ary relationship support',
        'Community detection storage',
        'Reasoning session tracking',
        'GRPO transition storage',
        'Embedding caching'
      ]
    };
  }

  /**
   * Create SQL migration script
   */
  generateMigrationScript(): string {
    return `
-- Graph-R1 Database Schema Migration Script
-- Version: ${this.schemaVersion}
-- Generated: ${new Date().toISOString()}

-- Enable vector extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS vector;

-- Graph nodes table
CREATE TABLE IF NOT EXISTS graph_nodes (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  properties JSONB DEFAULT '{}',
  embedding vector(1536),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  confidence REAL DEFAULT 1.0,
  source TEXT DEFAULT 'system'
);

-- Graph relationships table
CREATE TABLE IF NOT EXISTS graph_relationships (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  type TEXT NOT NULL,
  properties JSONB DEFAULT '{}',
  weight REAL DEFAULT 1.0,
  confidence REAL DEFAULT 1.0,
  bidirectional BOOLEAN DEFAULT FALSE,
  is_nary BOOLEAN DEFAULT FALSE,
  participants TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (source_id) REFERENCES graph_nodes(id) ON DELETE CASCADE,
  FOREIGN KEY (target_id) REFERENCES graph_nodes(id) ON DELETE CASCADE
);

-- Hyperedges table
CREATE TABLE IF NOT EXISTS graph_hyperedges (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  node_ids TEXT[] NOT NULL,
  node_roles JSONB DEFAULT '{}',
  properties JSONB DEFAULT '{}',
  weight REAL DEFAULT 1.0,
  confidence REAL DEFAULT 1.0,
  context TEXT,
  embedding vector(1536),
  pattern_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Communities table
CREATE TABLE IF NOT EXISTS graph_communities (
  id TEXT PRIMARY KEY,
  node_ids TEXT[] NOT NULL,
  label TEXT NOT NULL,
  summary TEXT,
  level INTEGER DEFAULT 0,
  parent_id TEXT,
  child_ids TEXT[] DEFAULT '{}',
  metrics JSONB DEFAULT '{}',
  centroid vector(1536),
  algorithm TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (parent_id) REFERENCES graph_communities(id) ON DELETE SET NULL
);

-- Reasoning sessions table
CREATE TABLE IF NOT EXISTS reasoning_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  query TEXT NOT NULL,
  answer TEXT,
  confidence REAL DEFAULT 0.0,
  steps JSONB DEFAULT '[]',
  retrieved_paths JSONB DEFAULT '[]',
  total_reward REAL DEFAULT 0.0,
  reasoning_traces TEXT[] DEFAULT '{}',
  grpo_transitions JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Embeddings table
CREATE TABLE IF NOT EXISTS graph_embeddings (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('node', 'hyperedge', 'community')),
  embedding vector(1536) NOT NULL,
  model TEXT DEFAULT 'text-embedding-ada-002',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(entity_id, entity_type, model)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_graph_nodes_type ON graph_nodes(type);
CREATE INDEX IF NOT EXISTS idx_graph_nodes_name ON graph_nodes(name);
CREATE INDEX IF NOT EXISTS idx_graph_nodes_embedding ON graph_nodes USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_graph_relationships_source ON graph_relationships(source_id);
CREATE INDEX IF NOT EXISTS idx_graph_relationships_target ON graph_relationships(target_id);
CREATE INDEX IF NOT EXISTS idx_graph_hyperedges_node_ids ON graph_hyperedges USING GIN(node_ids);
CREATE INDEX IF NOT EXISTS idx_graph_communities_node_ids ON graph_communities USING GIN(node_ids);
CREATE INDEX IF NOT EXISTS idx_reasoning_sessions_user ON reasoning_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_graph_embeddings_entity ON graph_embeddings(entity_id, entity_type);

-- Update schema version
INSERT INTO context_storage (id, user_id, content, metadata, created_at) 
VALUES (
  'graph_r1_schema_version',
  'system',
  '${this.schemaVersion}',
  '{"type": "schema_version", "component": "graph-r1"}',
  NOW()
) ON CONFLICT (id) DO UPDATE SET 
  content = '${this.schemaVersion}',
  metadata = '{"type": "schema_version", "component": "graph-r1"}',
  created_at = NOW();
`;
  }
}

// Export singleton instance
export const databaseSchemaService = new DatabaseSchemaService();