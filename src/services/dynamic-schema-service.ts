/**
 * Dynamic Schema Service
 * Provides runtime schema management with JSONB field validation
 * Enables flexible data structures without database migrations
 */

import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { log, LogContext } from '../utils/logger';
import { validators, ValidationResult, UniversalValidator } from '../utils/validation';
import { getSecretFromVault } from './secrets-manager';

export interface DynamicField {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'date';
  required?: boolean;
  default?: unknown;
  validation?: z.ZodSchema<any>;
  description?: string;
}

export interface DynamicSchema {
  id: string;
  name: string;
  version: string;
  fields: DynamicField[];
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface SchemaInstance {
  schema_id: string;
  data: Record<string, unknown>;
  validated: boolean;
  validation_errors?: string[];
}

/**
 * Dynamic Schema Manager - Core service for runtime schema management
 */
export class DynamicSchemaService {
  private supabase: any;
  private schemaCache = new Map<string, DynamicSchema>();
  private validatorCache = new Map<string, UniversalValidator<any>>();

  constructor() {
    this.initializeSupabase();
  }

  private async initializeSupabase() {
    try {
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = await getSecretFromVault('supabase_service_key');
      
      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Missing Supabase configuration');
      }

      this.supabase = createClient(supabaseUrl, supabaseKey);
    } catch (error) {
      log.error('Failed to initialize Supabase for dynamic schema service', LogContext.SYSTEM, {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Create a new dynamic schema
   */
  async createSchema(
    name: string,
    fields: DynamicField[],
    metadata: Record<string, unknown> = {}
  ): Promise<DynamicSchema> {
    const schemaId = `schema_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const version = '1.0.0';

    const schema: DynamicSchema = {
      id: schemaId,
      name,
      version,
      fields,
      metadata,
      created_at: new Date(),
      updated_at: new Date(),
    };

    // Store in database
    const { error } = await this.supabase.from('dynamic_schemas').insert({
      id: schemaId,
      name,
      version,
      fields: JSON.stringify(fields),
      metadata,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (error) {
      throw new Error(`Failed to create schema: ${error.message}`);
    }

    // Cache the schema and validator
    this.schemaCache.set(schemaId, schema);
    this.createValidator(schema);

    log.info('Created dynamic schema', LogContext.SYSTEM, {
      schemaId,
      name,
      fieldCount: fields.length,
    });

    return schema;
  }

  /**
   * Get schema by ID
   */
  async getSchema(schemaId: string): Promise<DynamicSchema | null> {
    // Check cache first
    if (this.schemaCache.has(schemaId)) {
      return this.schemaCache.get(schemaId)!;
    }

    // Fetch from database
    const { data, error } = await this.supabase
      .from('dynamic_schemas')
      .select('*')
      .eq('id', schemaId)
      .single();

    if (error || !data) {
      return null;
    }

    const schema: DynamicSchema = {
      id: data.id,
      name: data.name,
      version: data.version,
      fields: JSON.parse(data.fields),
      metadata: data.metadata || {},
      created_at: new Date(data.created_at),
      updated_at: new Date(data.updated_at),
    };

    // Cache the schema
    this.schemaCache.set(schemaId, schema);
    return schema;
  }

  /**
   * Update an existing schema (creates new version)
   */
  async updateSchema(
    schemaId: string,
    fields: DynamicField[],
    metadata: Record<string, unknown> = {}
  ): Promise<DynamicSchema> {
    const existingSchema = await this.getSchema(schemaId);
    if (!existingSchema) {
      throw new Error(`Schema ${schemaId} not found`);
    }

    // Create new version
    const version = this.incrementVersion(existingSchema.version);
    const newSchemaId = `${schemaId}_v${version.replace(/\./g, '_')}`;

    const updatedSchema: DynamicSchema = {
      id: newSchemaId,
      name: existingSchema.name,
      version,
      fields,
      metadata: { ...existingSchema.metadata, ...metadata },
      created_at: new Date(),
      updated_at: new Date(),
    };

    // Store in database
    const { error } = await this.supabase.from('dynamic_schemas').insert({
      id: newSchemaId,
      name: updatedSchema.name,
      version,
      fields: JSON.stringify(fields),
      metadata: updatedSchema.metadata,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (error) {
      throw new Error(`Failed to update schema: ${error.message}`);
    }

    // Update caches
    this.schemaCache.set(newSchemaId, updatedSchema);
    this.createValidator(updatedSchema);

    log.info('Updated dynamic schema', LogContext.SYSTEM, {
      originalId: schemaId,
      newId: newSchemaId,
      version,
    });

    return updatedSchema;
  }

  /**
   * Validate data against a schema
   */
  async validateData(schemaId: string, data: Record<string, unknown>): Promise<ValidationResult> {
    const schema = await this.getSchema(schemaId);
    if (!schema) {
      return {
        success: false,
        errors: [{
          field: 'schema',
          message: `Schema ${schemaId} not found`,
          value: schemaId,
          code: 'SCHEMA_NOT_FOUND',
        }],
      };
    }

    // Get or create validator
    let validator = this.validatorCache.get(schemaId);
    if (!validator) {
      validator = this.createValidator(schema);
    }

    return validator.validate(data);
  }

  /**
   * Store validated data instance
   */
  async storeInstance(
    schemaId: string,
    data: Record<string, unknown>,
    tableName = 'dynamic_data'
  ): Promise<string> {
    // Validate data first
    const validation = await this.validateData(schemaId, data);
    
    const instanceId = `instance_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const instance: SchemaInstance = {
      schema_id: schemaId,
      data,
      validated: validation.success,
      validation_errors: validation.errors?.map(e => `${e.field}: ${e.message}`),
    };

    // Store in specified table using JSONB
    const { error } = await this.supabase.from(tableName).insert({
      id: instanceId,
      schema_id: schemaId,
      data,
      validated: validation.success,
      validation_errors: instance.validation_errors,
      created_at: new Date().toISOString(),
    });

    if (error) {
      throw new Error(`Failed to store instance: ${error.message}`);
    }

    log.info('Stored dynamic data instance', LogContext.SYSTEM, {
      instanceId,
      schemaId,
      validated: validation.success,
      tableName,
    });

    return instanceId;
  }

  /**
   * Query data by schema and filters
   */
  async queryInstances(
    schemaId: string,
    filters: Record<string, unknown> = {},
    tableName = 'dynamic_data'
  ): Promise<SchemaInstance[]> {
    let query = this.supabase.from(tableName).select('*').eq('schema_id', schemaId);

    // Apply JSONB filters using PostgreSQL operators
    for (const [key, value] of Object.entries(filters)) {
      query = query.filter('data', 'cs', JSON.stringify({ [key]: value }));
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to query instances: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Create Zod validator from dynamic schema
   */
  private createValidator(schema: DynamicSchema): UniversalValidator<any> {
    const zodFields: Record<string, z.ZodTypeAny> = {};

    for (const field of schema.fields) {
      let zodType: z.ZodTypeAny;

      // Create base type
      switch (field.type) {
        case 'string':
          zodType = z.string();
          break;
        case 'number':
          zodType = z.number();
          break;
        case 'boolean':
          zodType = z.boolean();
          break;
        case 'array':
          zodType = z.array(z.unknown());
          break;
        case 'object':
          zodType = z.record(z.unknown());
          break;
        case 'date':
          zodType = z.string().datetime();
          break;
        default:
          zodType = z.unknown();
      }

      // Apply custom validation if provided
      if (field.validation) {
        zodType = field.validation;
      }

      // Handle optional/required and defaults
      if (!field.required) {
        zodType = zodType.optional();
      }

      if (field.default !== undefined) {
        zodType = zodType.default(field.default);
      }

      zodFields[field.name] = zodType;
    }

    const zodSchema = z.object(zodFields);
    const validator = validators.custom(zodSchema, { logValidation: true });

    // Cache the validator
    this.validatorCache.set(schema.id, validator);

    return validator;
  }

  /**
   * Increment version string (semantic versioning)
   */
  private incrementVersion(version: string): string {
    const parts = version.split('.').map(Number);
    parts[2] = (parts[2] || 0) + 1; // Increment patch version
    return parts.join('.');
  }

  /**
   * List all schemas
   */
  async listSchemas(): Promise<DynamicSchema[]> {
    const { data, error } = await this.supabase
      .from('dynamic_schemas')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to list schemas: ${error.message}`);
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      version: row.version,
      fields: JSON.parse(row.fields),
      metadata: row.metadata || {},
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
    }));
  }

  /**
   * Delete schema and all its instances
   */
  async deleteSchema(schemaId: string): Promise<void> {
    // Delete from database
    const { error } = await this.supabase
      .from('dynamic_schemas')
      .delete()
      .eq('id', schemaId);

    if (error) {
      throw new Error(`Failed to delete schema: ${error.message}`);
    }

    // Clear caches
    this.schemaCache.delete(schemaId);
    this.validatorCache.delete(schemaId);

    log.info('Deleted dynamic schema', LogContext.SYSTEM, { schemaId });
  }

  /**
   * Get schema statistics
   */
  async getSchemaStats(schemaId: string, tableName = 'dynamic_data'): Promise<{
    totalInstances: number;
    validatedInstances: number;
    lastUpdated: Date | null;
  }> {
    const { data, error } = await this.supabase
      .from(tableName)
      .select('validated, created_at')
      .eq('schema_id', schemaId);

    if (error) {
      throw new Error(`Failed to get schema stats: ${error.message}`);
    }

    const instances = data || [];
    return {
      totalInstances: instances.length,
      validatedInstances: instances.filter((i: any) => i.validated).length,
      lastUpdated: instances.length > 0 ? 
        new Date(Math.max(...instances.map((i: any) => new Date(i.created_at).getTime()))) : 
        null,
    };
  }
}

// Export singleton instance
export const dynamicSchemaService = new DynamicSchemaService();

/**
 * Helper functions for common schema operations
 */
export const schemaHelpers = {
  /**
   * Create agent configuration schema
   */
  createAgentConfigSchema: (agentName: string) => {
    return dynamicSchemaService.createSchema(
      `agent_config_${agentName}`,
      [
        {
          name: 'model',
          type: 'string',
          required: true,
          description: 'LLM model to use'
        },
        {
          name: 'temperature',
          type: 'number',
          default: 0.7,
          validation: z.number().min(0).max(2),
          description: 'Model temperature'
        },
        {
          name: 'maxTokens',
          type: 'number',
          default: 2048,
          validation: z.number().positive(),
          description: 'Maximum tokens'
        },
        {
          name: 'capabilities',
          type: 'array',
          default: [],
          description: 'Agent capabilities'
        },
        {
          name: 'memory',
          type: 'boolean',
          default: true,
          description: 'Enable memory'
        }
      ],
      {
        category: 'agent_config',
        agentName,
      }
    );
  },

  /**
   * Create user preference schema
   */
  createUserPreferenceSchema: () => {
    return dynamicSchemaService.createSchema(
      'user_preferences',
      [
        {
          name: 'theme',
          type: 'string',
          default: 'dark',
          validation: z.enum(['light', 'dark', 'auto']),
          description: 'UI theme preference'
        },
        {
          name: 'notifications',
          type: 'object',
          default: { email: true, push: false },
          description: 'Notification settings'
        },
        {
          name: 'defaultModel',
          type: 'string',
          default: 'ollama:llama3.2:3b',
          description: 'Default LLM model'
        },
        {
          name: 'maxConcurrentTasks',
          type: 'number',
          default: 3,
          validation: z.number().min(1).max(10),
          description: 'Maximum concurrent tasks'
        }
      ],
      {
        category: 'user_preferences',
      }
    );
  },

  /**
   * Create custom API schema
   */
  createApiSchema: (endpoint: string, fields: DynamicField[]) => {
    return dynamicSchemaService.createSchema(
      `api_${endpoint.replace(/[^a-zA-Z0-9]/g, '_')}`,
      fields,
      {
        category: 'api_schema',
        endpoint,
      }
    );
  },
};