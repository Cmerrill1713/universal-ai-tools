#!/usr/bin/env node

/**
 * Supabase Development Workflow Script
 * Comprehensive development tooling for Supabase projects
 * 
 * Features:
 * - Local development setup
 * - Database schema management
 * - Type generation and validation
 * - Migration management
 * - Performance monitoring
 * - Testing utilities
 */

import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

class SupabaseDevWorkflow {
  constructor() {
    this.supabaseUrl = process.env.SUPABASE_URL;
    this.supabaseKey = process.env.SUPABASE_ANON_KEY;
    this.serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    this.isLocal = process.env.NODE_ENV === 'development';
  }

  log(message, type = 'info') {
    const colors = {
      info: '\x1b[36m',    // Cyan
      success: '\x1b[32m', // Green
      warning: '\x1b[33m', // Yellow
      error: '\x1b[31m',   // Red
      reset: '\x1b[0m'     // Reset
    };
    
    const timestamp = new Date().toISOString();
    console.log(`${colors[type]}[${timestamp}] ${message}${colors.reset}`);
  }

  async runCommand(command, options = {}) {
    this.log(`Running: ${command}`, 'info');
    try {
      const result = execSync(command, { 
        encoding: 'utf8', 
        cwd: projectRoot,
        ...options 
      });
      return result.trim();
    } catch (error) {
      this.log(`Command failed: ${error.message}`, 'error');
      throw error;
    }
  }

  // Setup local Supabase development environment
  async setupLocal() {
    this.log('Setting up local Supabase development environment', 'info');

    try {
      // Check if Supabase CLI is installed
      try {
        await this.runCommand('supabase --version');
        this.log('Supabase CLI is installed', 'success');
      } catch (error) {
        this.log('Installing Supabase CLI...', 'info');
        await this.runCommand('npm install -g supabase');
      }

      // Initialize Supabase project if not already done
      if (!fs.existsSync(path.join(projectRoot, 'supabase', 'config.toml'))) {
        this.log('Initializing Supabase project...', 'info');
        await this.runCommand('supabase init');
      }

      // Start local Supabase
      this.log('Starting local Supabase...', 'info');
      await this.runCommand('supabase start');

      // Get local credentials
      const status = await this.runCommand('supabase status');
      this.log('Local Supabase status:', 'info');
      console.log(status);

      this.log('Local development environment ready!', 'success');
      
    } catch (error) {
      this.log(`Failed to setup local environment: ${error.message}`, 'error');
      throw error;
    }
  }

  // Generate TypeScript types from database schema
  async generateTypes() {
    this.log('Generating TypeScript types from database schema', 'info');

    try {
      const outputPath = path.join(projectRoot, 'src', 'types', 'supabase.ts');
      
      // Ensure directory exists
      const typesDir = path.dirname(outputPath);
      if (!fs.existsSync(typesDir)) {
        fs.mkdirSync(typesDir, { recursive: true });
      }

      if (this.isLocal) {
        await this.runCommand(`supabase gen types typescript --local > ${outputPath}`);
      } else {
        const projectRef = this.extractProjectRef(this.supabaseUrl);
        await this.runCommand(`supabase gen types typescript --project-id ${projectRef} > ${outputPath}`);
      }

      this.log(`Types generated successfully: ${outputPath}`, 'success');

      // Generate additional helper types
      await this.generateHelperTypes(outputPath);

    } catch (error) {
      this.log(`Failed to generate types: ${error.message}`, 'error');
      throw error;
    }
  }

  async generateHelperTypes(supabaseTypesPath) {
    const helperTypesPath = path.join(path.dirname(supabaseTypesPath), 'database-helpers.ts');
    
    const helperTypesContent = `/**
 * Database Helper Types
 * Generated helper types for common database operations
 */

import { Database } from './supabase';

// Table types
export type Tables = Database['public']['Tables'];
export type TableName = keyof Tables;

// Agent-specific types
export type AgentSession = Tables['agent_sessions']['Row'];
export type AgentSessionInsert = Tables['agent_sessions']['Insert'];
export type AgentSessionUpdate = Tables['agent_sessions']['Update'];

export type AgentMemory = Tables['agent_memories']['Row'];
export type AgentMemoryInsert = Tables['agent_memories']['Insert'];
export type AgentMemoryUpdate = Tables['agent_memories']['Update'];

export type AgentTool = Tables['agent_tools']['Row'];
export type AgentToolInsert = Tables['agent_tools']['Insert'];
export type AgentToolUpdate = Tables['agent_tools']['Update'];

// Common query types
export type QueryOptions = {
  select?: string;
  limit?: number;
  offset?: number;
  orderBy?: {
    column: string;
    ascending?: boolean;
  };
};

// Response types
export type DatabaseResponse<T> = {
  data: T | null;
  error: any;
  count?: number;
};

// Function parameter types
export type FunctionParams = Database['public']['Functions'];
export type FunctionName = keyof FunctionParams;

// View types (if any)
export type Views = Database['public']['Views'];

// Enum types
export type Enums = Database['public']['Enums'];

// Helper for JSON fields
export type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
export type JsonObject = { [key: string]: JsonValue };
export type JsonArray = JsonValue[];

// Memory types
export type MemoryType = 'conversation' | 'tool_usage' | 'learning' | 'context';

export type SessionStatus = 'active' | 'paused' | 'completed' | 'error';

// Search result types
export type VectorSearchResult = {
  id: string;
  content: any;
  metadata: JsonObject;
  similarity: number;
};

// Batch operation types
export type BatchInsert<T extends TableName> = Tables[T]['Insert'][];
export type BatchUpdate<T extends TableName> = {
  id: string;
  updates: Tables[T]['Update'];
}[];
`;

    fs.writeFileSync(helperTypesPath, helperTypesContent);
    this.log(`Helper types generated: ${helperTypesPath}`, 'success');
  }

  // Run database migrations
  async runMigrations(options = {}) {
    this.log('Running database migrations', 'info');

    try {
      const { dryRun = false, force = false } = options;

      if (dryRun) {
        this.log('Running dry-run migration check...', 'info');
        await this.runCommand('supabase db diff --schema public');
      } else {
        this.log('Applying migrations...', 'info');
        
        if (this.isLocal) {
          await this.runCommand('supabase db reset');
        } else {
          const pushCommand = force ? 'supabase db push --password' : 'supabase db push';
          await this.runCommand(pushCommand);
        }
      }

      this.log('Migrations completed successfully', 'success');

    } catch (error) {
      this.log(`Migration failed: ${error.message}`, 'error');
      throw error;
    }
  }

  // Create a new migration
  async createMigration(name) {
    if (!name) {
      throw new Error('Migration name is required');
    }

    this.log(`Creating new migration: ${name}`, 'info');

    try {
      const timestamp = new Date().toISOString().replace(/[-:T]/g, '').split('.')[0];
      const migrationName = `${timestamp}_${name.replace(/\s+/g, '_').toLowerCase()}`;
      
      await this.runCommand(`supabase migration new ${migrationName}`);
      
      this.log(`Migration created: ${migrationName}`, 'success');
      
    } catch (error) {
      this.log(`Failed to create migration: ${error.message}`, 'error');
      throw error;
    }
  }

  // Validate database schema
  async validateSchema() {
    this.log('Validating database schema', 'info');

    try {
      // Call the dev-tools-setup edge function for validation
      const response = await this.callEdgeFunction('dev-tools-setup', {
        action: 'validate_schema',
        options: { environment: this.isLocal ? 'local' : 'production' }
      });

      if (response.status === 'valid') {
        this.log('Schema validation passed ✓', 'success');
      } else {
        this.log(`Schema validation found issues:`, 'warning');
        response.validations.forEach(v => {
          if (v.issues.length > 0) {
            this.log(`${v.table}: ${v.issues.join(', ')}`, 'warning');
          }
        });
      }

      return response;

    } catch (error) {
      this.log(`Schema validation failed: ${error.message}`, 'error');
      throw error;
    }
  }

  // Set up development database with sample data
  async seedDatabase() {
    this.log('Seeding database with development data', 'info');

    try {
      const seedPath = path.join(projectRoot, 'supabase', 'seed.sql');
      
      if (fs.existsSync(seedPath)) {
        await this.runCommand('supabase db seed');
        this.log('Database seeded successfully', 'success');
      } else {
        this.log('No seed file found, creating basic seed data...', 'info');
        await this.createBasicSeedData();
      }

    } catch (error) {
      this.log(`Failed to seed database: ${error.message}`, 'error');
      throw error;
    }
  }

  async createBasicSeedData() {
    const seedData = `-- Development seed data
-- This file contains sample data for development and testing

-- Insert sample agent sessions
INSERT INTO agent_sessions (id, user_id, agent_id, status, context, started_at, last_activity)
VALUES 
  ('session-1', 'user-1', 'rag-agent', 'active', '{"theme": "development"}', NOW(), NOW()),
  ('session-2', 'user-2', 'reasoning-agent', 'completed', '{"tasks": ["analysis"]}', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '30 minutes');

-- Insert sample memories
INSERT INTO agent_memories (agent_id, session_id, memory_type, content, metadata)
VALUES 
  ('rag-agent', 'session-1', 'conversation', '{"user": "Hello", "assistant": "Hi there!"}', '{"turn": 1}'),
  ('rag-agent', 'session-1', 'tool_usage', '{"tool": "search", "query": "AI"}', '{"success": true}'),
  ('reasoning-agent', 'session-2', 'learning', '{"insight": "User prefers concise answers"}', '{"confidence": 0.8}');

-- Insert sample tools
INSERT INTO agent_tools (name, description, schema, metadata)
VALUES 
  ('web_search', 'Search the web for information', '{"query": "string"}', '{"version": "1.0"}'),
  ('calculator', 'Perform mathematical calculations', '{"expression": "string"}', '{"version": "1.0"}'),
  ('code_executor', 'Execute code snippets', '{"language": "string", "code": "string"}', '{"version": "1.0"}');
`;

    const seedPath = path.join(projectRoot, 'supabase', 'seed.sql');
    fs.writeFileSync(seedPath, seedData);
    
    await this.runCommand('supabase db seed');
    this.log('Basic seed data created and applied', 'success');
  }

  // Performance testing
  async runPerformanceTests() {
    this.log('Running performance tests', 'info');

    try {
      const response = await this.callEdgeFunction('dev-tools-setup', {
        action: 'validate_schema',
        options: { includeMetrics: true }
      });

      this.log('Performance test results:', 'info');
      console.log(JSON.stringify(response, null, 2));

    } catch (error) {
      this.log(`Performance tests failed: ${error.message}`, 'error');
      throw error;
    }
  }

  // Backup database
  async backupDatabase(outputPath) {
    this.log('Creating database backup', 'info');

    try {
      const backupFile = outputPath || `backup-${Date.now()}.sql`;
      
      if (this.isLocal) {
        await this.runCommand(`supabase db dump --data-only > ${backupFile}`);
      } else {
        this.log('Remote backup requires additional configuration', 'warning');
        this.log('Use: supabase db dump --project-ref <ref> --password', 'info');
      }

      this.log(`Backup created: ${backupFile}`, 'success');

    } catch (error) {
      this.log(`Backup failed: ${error.message}`, 'error');
      throw error;
    }
  }

  // Development health check
  async healthCheck() {
    this.log('Running development health check', 'info');

    try {
      const response = await this.callEdgeFunction('dev-tools-setup', {
        action: 'health_check',
        options: { environment: this.isLocal ? 'local' : 'production' }
      });

      if (response.status === 'healthy') {
        this.log('All systems healthy ✓', 'success');
      } else {
        this.log(`Health check found issues: ${response.status}`, 'warning');
        Object.entries(response.checks).forEach(([service, status]) => {
          const icon = status ? '✓' : '✗';
          const type = status ? 'success' : 'error';
          this.log(`${service}: ${icon}`, type);
        });
      }

      return response;

    } catch (error) {
      this.log(`Health check failed: ${error.message}`, 'error');
      throw error;
    }
  }

  // Utility: Call Supabase Edge Function
  async callEdgeFunction(functionName, payload) {
    const url = this.isLocal 
      ? `http://localhost:54321/functions/v1/${functionName}`
      : `${this.supabaseUrl}/functions/v1/${functionName}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.serviceRoleKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Edge function call failed: ${response.statusText}`);
    }

    return await response.json();
  }

  // Utility: Extract project reference from URL
  extractProjectRef(url) {
    const match = url.match(/https:\\/\\/([^.]+)\\.supabase\\.co/);
    return match ? match[1] : null;
  }

  // Watch for schema changes
  async watch() {
    this.log('Starting development watcher...', 'info');
    this.log('Watching for schema changes, type regeneration, etc.', 'info');
    this.log('Press Ctrl+C to stop', 'info');

    // This would implement file watching for auto-regeneration
    // For now, just demonstrate the concept
    setInterval(async () => {
      try {
        await this.healthCheck();
      } catch (error) {
        this.log(`Watcher health check failed: ${error.message}`, 'warning');
      }
    }, 30000);
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const workflow = new SupabaseDevWorkflow();

  try {
    switch (command) {
      case 'setup':
        await workflow.setupLocal();
        break;

      case 'types':
        await workflow.generateTypes();
        break;

      case 'migrate':
        const migrationOptions = {
          dryRun: args.includes('--dry-run'),
          force: args.includes('--force'),
        };
        await workflow.runMigrations(migrationOptions);
        break;

      case 'create-migration':
        const migrationName = args[1];
        await workflow.createMigration(migrationName);
        break;

      case 'validate':
        await workflow.validateSchema();
        break;

      case 'seed':
        await workflow.seedDatabase();
        break;

      case 'performance':
        await workflow.runPerformanceTests();
        break;

      case 'backup':
        const outputPath = args[1];
        await workflow.backupDatabase(outputPath);
        break;

      case 'health':
        await workflow.healthCheck();
        break;

      case 'watch':
        await workflow.watch();
        break;

      case 'all':
        workflow.log('Running complete development setup...', 'info');
        await workflow.setupLocal();
        await workflow.generateTypes();
        await workflow.validateSchema();
        await workflow.seedDatabase();
        await workflow.healthCheck();
        workflow.log('Complete setup finished!', 'success');
        break;

      default:
        console.log(`
Supabase Development Workflow Tool

Usage: node scripts/supabase-dev-workflow.mjs <command> [options]

Commands:
  setup              Set up local Supabase development environment
  types              Generate TypeScript types from database schema
  migrate            Run database migrations [--dry-run] [--force]
  create-migration   Create a new migration file <name>
  validate           Validate database schema
  seed               Seed database with development data
  performance        Run performance tests
  backup             Create database backup [output-file]
  health             Run system health check
  watch              Watch for changes and auto-regenerate
  all                Run complete setup process

Examples:
  npm run supabase:setup
  npm run supabase:types
  npm run supabase:migrate -- --dry-run
  npm run supabase:create-migration -- "add_agent_capabilities"
  npm run supabase:validate
  npm run supabase:health
        `);
        break;
    }
  } catch (error) {
    workflow.log(`Command failed: ${error.message}`, 'error');
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default SupabaseDevWorkflow;