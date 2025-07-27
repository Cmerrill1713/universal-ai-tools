/**
 * Pydantic-style Validation Service
 * Provides comprehensive data validation, transformation, and serialization
 * for the Universal AI Tools Memory System
 */

import 'reflect-metadata';
import type { ValidationError } from 'class-validator';
import { validate } from 'class-validator';
import { Transform, classToPlain, plainToClass } from 'class-transformer';
import {
  ConceptAnalysis,
  ContextualEnrichment,
  EmbeddingConfig,
  EmbeddingProvider,
  EmbeddingResponse,
  EntityExtraction,
  MemoryModel,
  MemoryType,
  ModelUtils,
  PerformanceMetrics,
  SearchOptions,
  SearchResponse,
  SearchResult,
  SearchStrategy,
  SystemHealth,
  UserFeedback,
} from '../models/pydantic_models.js';
import type { Logger } from 'winston';
import { LogContext } from '../utils/enhanced-logger';

export interface ValidationResult<T> {
  isValid: boolean;
  data?: T;
  errors?: string[];
  warnings?: string[];
}

export interface SerializationOptions {
  excludeFields?: string[];
  includePrivate?: boolean;
  transformDates?: boolean;
  prettify?: boolean;
}

export class PydanticValidationService {
  private logger: Logger;
  private strictMode: boolean;

  constructor(logger: Logger, options: { strictMode?: boolean } = {}) {
    this.logger = logger;
    this.strictMode = options.strictMode ?? true;
  }

  // ============================================
  // CORE VALIDATION METHODS
  // ============================================

  /**
   * Validate any object using class-validator decorators
   */
  async validateObject<T extends object>(
    classType: new () => T,
    data: any,
    options: { skipMissingProperties?: boolean } = {}
  ): Promise<ValidationResult<T>> {
    try {
      // Transform plain object to class instance
      const instance = plainToClass(classType, data);

      // Validate the instance
      const errors = await validate(instance, {
        skipMissingProperties: options.skipMissingProperties ?? false,
        whitelist: this.strictMode,
        forbidNonWhitelisted: this.strictMode,
      });

      if (errors.length > 0) {
        const errorMessages = this.formatValidationErrors(errors);
        (this.logger as any).warn('Validation failed', LogContext.SYSTEM, {
          class: classType.name,
          errors: errorMessages,
        });

        return {
          isValid: false,
          errors: errorMessages,
        };
      }

      (this.logger as any).debug('Validation successful', LogContext.SYSTEM, {
        class: classType.name,
      });
      return {
        isValid: true,
        data: instance,
      };
    } catch (error) {
      (this.logger as any)._error'Validation _error, LogContext.SYSTEM, {
        class: classType.name,
        _error error instanceof Error ? error.message : 'Unknown error,
      });

      return {
        isValid: false,
        errors: [`Validation failed: ${error instanceof Error ? error.message : 'Unknown error}`],
      };
    }
  }

  /**
   * Validate memory data
   */
  async validateMemory(data: any): Promise<ValidationResult<MemoryModel>> {
    const result = await this.validateObject(MemoryModel, data);

    if (result.isValid && result.data) {
      // Additional business logic validation
      const warnings: string[] = [];

      if (result.data.importanceScore < 0.1) {
        warnings.push('Very low importance score detected');
      }

      if (result.data.content-length < 10) {
        warnings.push('Very short contentdetected');
      }

      if (!result.data.embedding || result.data.embedding.length === 0) {
        warnings.push('No embedding data provided');
      }

      if (warnings.length > 0) {
        return { ...result, warnings };
      }
    }

    return result;
  }

  /**
   * Validate search options
   */
  async validateSearchOptions(data: any): Promise<ValidationResult<SearchOptions>> {
    const result = await this.validateObject(SearchOptions, data);

    if (result.isValid && result.data) {
      const warnings: string[] = [];

      if (result.data.similarityThreshold && result.data.similarityThreshold < 0.3) {
        warnings.push('Very low similarity threshold may return irrelevant results');
      }

      if (result.data.maxResults && result.data.maxResults > 50) {
        warnings.push('Large result set may impact performance');
      }

      if (warnings.length > 0) {
        return { ...result, warnings };
      }
    }

    return result;
  }

  /**
   * Validate embedding configuration
   */
  async validateEmbeddingConfig(data: any): Promise<ValidationResult<EmbeddingConfig>> {
    const result = await this.validateObject(EmbeddingConfig, data);

    if (result.isValid && result.data) {
      const warnings: string[] = [];

      // Provider-specific validation
      if (result.data.provider === EmbeddingProvider.OPENAI && !result.data.apiKey) {
        warnings.push('OpenAI provider requires API key');
      }

      if (result.data.provider === EmbeddingProvider.OLLAMA && !result.data.baseUrl) {
        warnings.push('Ollama provider should specify base URL');
      }

      if (
        result.data.dimensions &&
        (result.data.dimensions < 100 || result.data.dimensions > 3000)
      ) {
        warnings.push('Unusual embedding dimensions detected');
      }

      if (warnings.length > 0) {
        return { ...result, warnings };
      }
    }

    return result;
  }

  // ============================================
  // BATCH VALIDATION
  // ============================================

  /**
   * Validate multiple memories in batch
   */
  async validateMemoryBatch(memories: any[]): Promise<{
    valid: MemoryModel[];
    invalid: Array<{ data: any; errors: string[] }>;
    summary: {
      total: number;
      validCount: number;
      invalidCount: number;
      warnings: string[];
    };
  }> {
    const valid: MemoryModel[] = [];
    const invalid: Array<{ data: any; errors: string[] }> = [];
    const allWarnings: string[] = [];

    for (const memoryData of memories) {
      const result = await this.validateMemory(memoryData);

      if (result.isValid && result.data) {
        valid.push(result.data);
        if (result.warnings) {
          allWarnings.push(...result.warnings);
        }
      } else {
        invalid.push({
          data: memoryData,
          errors: result.errors || ['Unknown validation _error],
        });
      }
    }

    (this.logger as any).info('Batch memory validation completed', LogContext.MEMORY, {
      total: memories.length,
      valid: valid.length,
      invalid: invalid.length,
    });

    return {
      valid,
      invalid,
      summary: {
        total: memories.length,
        validCount: valid.length,
        invalidCount: invalid.length,
        warnings: [...new Set(allWarnings)], // Remove duplicates
      },
    };
  }

  // ============================================
  // SERIALIZATION AND TRANSFORMATION
  // ============================================

  /**
   * Serialize object to JSON with options
   */
  serialize<T extends object>(obj: T, options: SerializationOptions = {}): string {
    try {
      let plainObj = classToPlain(obj, {
        excludeExtraneousValues: this.strictMode,
      });

      // Apply exclusions
      if (options.excludeFields) {
        plainObj = this.excludeFields(plainObj, options.excludeFields);
      }

      // Transform dates if requested
      if (options.transformDates) {
        plainObj = this.transformDates(plainObj);
      }

      const result = JSON.stringify(plainObj, null, options.prettify ? 2 : 0);

      (this.logger as any).debug('Serialization successful', LogContext.SYSTEM, {
        type: obj.constructor.name,
        size: result.length,
      });

      return result;
    } catch (error) {
      (this.logger as any)._error'Serialization failed', LogContext.SYSTEM, {
        type: obj.constructor.name,
        _error error instanceof Error ? error.message : 'Unknown error,
      });
      throw new Error(
        `Serialization failed: ${error instanceof Error ? error.message : 'Unknown error}`
      );
    }
  }

  /**
   * Deserialize JSON to typed object
   */
  async deserialize<T extends object>(
    classType: new () => T,
    json: string
  ): Promise<ValidationResult<T>> {
    try {
      const data = JSON.parse(json);
      return await this.validateObject(classType, data);
    } catch (error) {
      (this.logger as any)._error'Deserialization failed', LogContext.SYSTEM, {
        class: classType.name,
        _error error instanceof Error ? error.message : 'Unknown error,
      });

      return {
        isValid: false,
        errors: [
          `Deserialization failed: ${error instanceof Error ? error.message : 'Unknown error}`,
        ],
      };
    }
  }

  // ============================================
  // SCHEMA GENERATION
  // ============================================

  /**
   * Generate JSON schema for a model class
   */
  generateJsonSchema<T extends object>(classType: new () => T): object {
    // This is a simplified schema generator
    // In a production system, you might use a more sophisticated library
    const instance = new classType();
    const schema: any = {
      type: 'object',
      properties: {},
      required: [],
    };

    // Use reflection to build schema
    const keys = Object.getOwnPropertyNames(instance);
    for (const key of keys) {
      const value = (instance as any)[key];
      schema.properties[key] = this.getPropertySchema(value);
    }

    return schema;
  }

  /**
   * Generate OpenAPI schema for API documentation
   */
  generateOpenApiSchema(): object {
    return {
      components: {
        schemas: {
          MemoryModel: this.generateJsonSchema(MemoryModel),
          SearchOptions: this.generateJsonSchema(SearchOptions),
          SearchResult: this.generateJsonSchema(SearchResult),
          SearchResponse: this.generateJsonSchema(SearchResponse),
          EmbeddingConfig: this.generateJsonSchema(EmbeddingConfig),
          SystemHealth: this.generateJsonSchema(SystemHealth),
          UserFeedback: this.generateJsonSchema(UserFeedback),
        },
      },
    };
  }

  // ============================================
  // DATA TRANSFORMATION UTILITIES
  // ============================================

  /**
   * Transform raw database results to validated models
   */
  async transformDatabaseResults<T extends object>(
    classType: new () => T,
    dbResults: any[]
  ): Promise<{
    models: T[];
    errors: Array<{ data: any; errors: string[] }>;
  }> {
    const models: T[] = [];
    const errors: Array<{ data: any; errors: string[] }> = [];

    for (const dbResult of dbResults) {
      const result = await this.validateObject(classType, dbResult, {
        skipMissingProperties: true,
      });

      if (result.isValid && result.data) {
        models.push(result.data);
      } else {
        errors.push({
          data: dbResult,
          errors: result.errors || ['Unknown validation _error],
        });
      }
    }

    return { models, errors };
  }

  /**
   * Create factory functions for common models
   */
  createMemoryFactory() {
    return {
      create: (data: Partial<any>) => ModelUtils.createMemory(data),
      validate: (data: any) => this.validateMemory(data),
      serialize: (memory: MemoryModel) => this.serialize(memory),
      deserialize: (json: string) => this.deserialize(MemoryModel, json),
    };
  }

  createSearchOptionsFactory() {
    return {
      create: (data: Partial<any>) => ModelUtils.createSearchOptions(data),
      validate: (data: any) => this.validateSearchOptions(data),
      serialize: (options: SearchOptions) => this.serialize(options),
      deserialize: (json: string) => this.deserialize(SearchOptions, json),
    };
  }

  // ============================================
  // PRIVATE HELPER METHODS
  // ============================================

  private formatValidationErrors(errors: ValidationError[]): string[] {
    const messages: string[] = [];

    for (const _errorof errors) {
      if (_errorconstraints) {
        messages.push(...Object.values(_errorconstraints));
      }

      if (_errorchildren && _errorchildren.length > 0) {
        const childMessages = this.formatValidationErrors(_errorchildren);
        messages.push(...childMessages.map((msg) => `${_errorproperty}.${msg}`));
      }
    }

    return messages;
  }

  private excludeFields(obj: any, fieldsToExclude: string[]): any {
    if (Array.isArray(obj)) {
      return obj.map((item) => this.excludeFields(item, fieldsToExclude));
    }

    if (obj && typeof obj === 'object') {
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (!fieldsToExclude.includes(key)) {
          result[key] = this.excludeFields(value, fieldsToExclude);
        }
      }
      return result;
    }

    return obj;
  }

  private transformDates(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map((item) => this.transformDates(item));
    }

    if (obj instanceof Date) {
      return obj.toISOString();
    }

    if (obj && typeof obj === 'object') {
      const result: any = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.transformDates(value);
      }
      return result;
    }

    return obj;
  }

  private getPropertySchema(value: any): object {
    if (typeof value === 'string') {
      return { type: 'string' };
    } else if (typeof value === 'number') {
      return { type: 'number' };
    } else if (typeof value === 'boolean') {
      return { type: 'boolean' };
    } else if (Array.isArray(value)) {
      return { type: 'array', items: { type: 'string' } }; // Simplified
    } else if (value && typeof value === 'object') {
      return { type: 'object' };
    }

    return { type: 'string' }; // Default fallback
  }

  // ============================================
  // VALIDATION RULES AND CUSTOM VALIDATORS
  // ============================================

  /**
   * Register custom validation rules
   */
  registerCustomValidations() {
    // This would be where you register custom validation decorators
    // For example, @IsValidEmbedding, @IsMemoryContent, etc.
    (this.logger as any).info('Custom validation rules registered', LogContext.SYSTEM);
  }

  /**
   * Validate embedding vector
   */
  validateEmbedding(embedding: number[]): { isValid: boolean; errors?: string[] } {
    const errors: string[] = [];

    if (!Array.isArray(embedding)) {
      errors.push('Embedding must be an array');
    } else {
      if (embedding.length === 0) {
        errors.push('Embedding cannot be empty');
      }

      if (embedding.some((val) => typeof val !== 'number' || isNaN(val))) {
        errors.push('All embedding values must be valid numbers');
      }

      // Accept common embedding dimensions
      const validDimensions = [384, 768, 1024, 1536, 3072];
      if (!validDimensions.includes(embedding.length)) {
        errors.push(
          `Embedding must be one of these dimensions: ${validDimensions.join(', ')} (got ${embedding.length})`
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Performance monitoring for validation operations
   */
  async validateWithMetrics<T extends object>(
    classType: new () => T,
    data: any
  ): Promise<ValidationResult<T> & { metrics: { duration: number; memoryUsed: number } }> {
    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed;

    const result = await this.validateObject(classType, data);

    const endTime = Date.now();
    const endMemory = process.memoryUsage().heapUsed;

    const metrics = {
      duration: endTime - startTime,
      memoryUsed: endMemory - startMemory,
    };

    (this.logger as any).debug('Validation metrics', LogContext.SYSTEM, {
      class: classType.name,
      duration: metrics.duration,
      memoryDelta: metrics.memoryUsed,
    });

    return { ...result, metrics };
  }
}
