/**;
 * Pydantic-style Validation Service;
 * Provides comprehensive data validation, transformation, and serialization;
 * for the Universal AI Tools Memory System;
 */;

import 'reflect-metadata';
import type { ValidationError } from 'class-validator';
import { validate } from 'class-validator';
import { Transform, classToPlain, plainToClass } from 'class-transformer';
import {;
  ConceptAnalysis;
  ContextualEnrichment;
  EmbeddingConfig;
  EmbeddingProvider;
  EmbeddingResponse;
  EntityExtraction;
  MemoryModel;
  MemoryType;
  ModelUtils;
  PerformanceMetrics;
  SearchOptions;
  SearchResponse;
  SearchResult;
  SearchStrategy;
  SystemHealth;
  UserFeedback;
} from '../models/pydantic_modelsjs';
import type { Logger } from 'winston';
import { LogContext } from '../utils/enhanced-logger';
export interface ValidationResult<T> {;
  isValid: boolean;
  data?: T;
  errors?: string[];
  warnings?: string[];
;
};

export interface SerializationOptions {;
  excludeFields?: string[];
  includePrivate?: boolean;
  transformDates?: boolean;
  prettify?: boolean;
;
};

export class PydanticValidationService {;
  private logger: Logger;
  private strictMode: boolean;
  constructor(logger: Logger, options: { strictMode?: boolean } = {}) {;
    thislogger = logger;
    thisstrictMode = optionsstrictMode ?? true;
  };

  // ============================================;
  // CORE VALIDATION METHODS;
  // ============================================;

  /**;
   * Validate any object using class-validator decorators;
   */;
  async validateObject<T extends object>(;
    classType: new () => T;
    data: any;
    options: { skipMissingProperties?: boolean } = {};
  ): Promise<ValidationResult<T>> {;
    try {;
      // Transform plain object to class instance;
      const instance = plainToClass(classType, data);
      // Validate the instance;
      const errors = await validate(instance, {;
        skipMissingProperties: optionsskipMissingProperties ?? false;
        whitelist: thisstrictMode;
        forbidNonWhitelisted: thisstrictMode;
      });
      if (errorslength > 0) {;
        const errorMessages = thisformatValidationErrors(errors);
        (thislogger as any)warn('Validation failed', LogContextSYSTEM, {;
          class: classTypename;
          errors: errorMessages;
        });
        return {;
          isValid: false;
          errors: errorMessages;
        ;
};
      };

      (thislogger as any)debug('Validation successful', LogContextSYSTEM, {;
        class: classTypename;
      });
      return {;
        isValid: true;
        data: instance;
      ;
};
    } catch (error) {;
      (thislogger as any)error instanceof Error ? errormessage : String(error) Validation error instanceof Error ? errormessage : String(error) LogContextSYSTEM, {;
        class: classTypename;
        error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : 'Unknown error instanceof Error ? errormessage : String(error);
      });
      return {;
        isValid: false;
        errors: [`Validation failed: ${error instanceof Error ? errormessage : 'Unknown error instanceof Error ? errormessage : String(error)`];
      ;
};
    };
  };

  /**;
   * Validate memory data;
   */;
  async validateMemory(data: any): Promise<ValidationResult<MemoryModel>> {;
    const result = await thisvalidateObject(MemoryModel, data);
    if (resultisValid && resultdata) {;
      // Additional business logic validation;
      const warnings: string[] = [];
      if (resultdataimportanceScore < 0.1) {;
        warningspush('Very low importance score detected');
      };

      if (resultdatacontent-length < 10) {;
        warningspush('Very short content detected');
      };

      if (!resultdataembedding || resultdataembeddinglength === 0) {;
        warningspush('No embedding data provided');
      };

      if (warningslength > 0) {;
        return { ..result, warnings };
      };
    };

    return result;
  };

  /**;
   * Validate search options;
   */;
  async validateSearchOptions(data: any): Promise<ValidationResult<SearchOptions>> {;
    const result = await thisvalidateObject(SearchOptions, data);
    if (resultisValid && resultdata) {;
      const warnings: string[] = [];
      if (resultdatasimilarityThreshold && resultdatasimilarityThreshold < 0.3) {;
        warningspush('Very low similarity threshold may return irrelevant results');
      };

      if (resultdatamaxResults && resultdatamaxResults > 50) {;
        warningspush('Large result set may impact performance');
      };

      if (warningslength > 0) {;
        return { ..result, warnings };
      };
    };

    return result;
  };

  /**;
   * Validate embedding configuration;
   */;
  async validateEmbeddingConfig(data: any): Promise<ValidationResult<EmbeddingConfig>> {;
    const result = await thisvalidateObject(EmbeddingConfig, data);
    if (resultisValid && resultdata) {;
      const warnings: string[] = [];
      // Provider-specific validation;
      if (resultdataprovider === EmbeddingProviderOPENAI && !resultdataapiKey) {;
        warningspush('OpenAI provider requires API key');
      };

      if (resultdataprovider === EmbeddingProviderOLLAMA && !resultdatabaseUrl) {;
        warningspush('Ollama provider should specify base URL');
      };

      if (;
        resultdatadimensions && (resultdatadimensions < 100 || resultdatadimensions > 3000);
      ) {;
        warningspush('Unusual embedding dimensions detected');
      };

      if (warningslength > 0) {;
        return { ..result, warnings };
      };
    };

    return result;
  };

  // ============================================;
  // BATCH VALIDATION;
  // ============================================;

  /**;
   * Validate multiple memories in batch;
   */;
  async validateMemoryBatch(memories: any[]): Promise<{;
    valid: MemoryModel[];
    invalid: Array<{ data: any, errors: string[] }>;
    summary: {;
      total: number;
      validCount: number;
      invalidCount: number;
      warnings: string[];
    ;
};
  }> {;
    const valid: MemoryModel[] = [];
    const invalid: Array<{ data: any, errors: string[] }> = [];
    const allWarnings: string[] = [];
    for (const memoryData of memories) {;
      const result = await thisvalidateMemory(memoryData);
      if (resultisValid && resultdata) {;
        validpush(resultdata);
        if (resultwarnings) {;
          allWarningspush(..resultwarnings);
        };
      } else {;
        invalidpush({;
          data: memoryData;
          errors: resulterrors || ['Unknown validation error instanceof Error ? errormessage : String(error);
        });
      };
    };

    (thislogger as any)info('Batch memory validation completed', LogContextMEMORY, {;
      total: memorieslength;
      valid: validlength;
      invalid: invalidlength;
    });
    return {;
      valid;
      invalid;
      summary: {;
        total: memorieslength;
        validCount: validlength;
        invalidCount: invalidlength;
        warnings: [..new Set(allWarnings)], // Remove duplicates;
      };
    };
  };

  // ============================================;
  // SERIALIZATION AND TRANSFORMATION;
  // ============================================;

  /**;
   * Serialize object to JSON with options;
   */;
  serialize<T extends object>(obj: T, options: SerializationOptions = {}): string {;
    try {;
      let plainObj = classToPlain(obj, {;
        excludeExtraneousValues: thisstrictMode;
      });
      // Apply exclusions;
      if (optionsexcludeFields) {;
        plainObj = thisexcludeFields(plainObj, optionsexcludeFields);
      };

      // Transform dates if requested;
      if (optionstransformDates) {;
        plainObj = thistransformDates(plainObj);
      };

      const result = JSONstringify(plainObj, null, optionsprettify ? 2 : 0);
      (thislogger as any)debug('Serialization successful', LogContextSYSTEM, {;
        type: objconstructorname;
        size: resultlength;
      });
      return result;
    } catch (error) {;
      (thislogger as any)error instanceof Error ? errormessage : String(error) Serialization failed', LogContextSYSTEM, {;
        type: objconstructorname;
        error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : 'Unknown error instanceof Error ? errormessage : String(error);
      });
      throw new Error(;
        `Serialization failed: ${error instanceof Error ? errormessage : 'Unknown error instanceof Error ? errormessage : String(error)`;
      );
    ;
};
  };

  /**;
   * Deserialize JSON to typed object;
   */;
  async deserialize<T extends object>(;
    classType: new () => T;
    json: string;
  ): Promise<ValidationResult<T>> {;
    try {;
      const data = JSONparse(json);
      return await thisvalidateObject(classType, data);
    } catch (error) {;
      (thislogger as any)error instanceof Error ? errormessage : String(error) Deserialization failed', LogContextSYSTEM, {;
        class: classTypename;
        error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : 'Unknown error instanceof Error ? errormessage : String(error);
      });
      return {;
        isValid: false;
        errors: [;
          `Deserialization failed: ${error instanceof Error ? errormessage : 'Unknown error instanceof Error ? errormessage : String(error)`;
        ];
      ;
};
    };
  };

  // ============================================;
  // SCHEMA GENERATION;
  // ============================================;

  /**;
   * Generate JSON schema for a model class;
   */;
  generateJsonSchema<T extends object>(classType: new () => T): object {;
    // This is a simplified schema generator;
    // In a production system, you might use a more sophisticated library;
    const instance = new classType();
    const schema: any = {;
      type: 'object';
      properties: {;
};
      required: [];
    ;
};
    // Use reflection to build schema;
    const keys = ObjectgetOwnPropertyNames(instance);
    for (const key of keys) {;
      const value = (instance as any)[key];
      schemaproperties[key] = thisgetPropertySchema(value);
    };

    return schema;
  };

  /**;
   * Generate OpenAPI schema for API documentation;
   */;
  generateOpenApiSchema(): object {;
    return {;
      components: {;
        schemas: {;
          MemoryModel: thisgenerateJsonSchema(MemoryModel);
          SearchOptions: thisgenerateJsonSchema(SearchOptions);
          SearchResult: thisgenerateJsonSchema(SearchResult);
          SearchResponse: thisgenerateJsonSchema(SearchResponse);
          EmbeddingConfig: thisgenerateJsonSchema(EmbeddingConfig);
          SystemHealth: thisgenerateJsonSchema(SystemHealth);
          UserFeedback: thisgenerateJsonSchema(UserFeedback);
        ;
};
      };
    };
  };

  // ============================================;
  // DATA TRANSFORMATION UTILITIES;
  // ============================================;

  /**;
   * Transform raw database results to validated models;
   */;
  async transformDatabaseResults<T extends object>(;
    classType: new () => T;
    dbResults: any[];
  ): Promise<{;
    models: T[];
    errors: Array<{ data: any, errors: string[] }>;
  }> {;
    const models: T[] = [];
    const errors: Array<{ data: any, errors: string[] }> = [];
    for (const dbResult of dbResults) {;
      const result = await thisvalidateObject(classType, dbResult, {;
        skipMissingProperties: true;
      });
      if (resultisValid && resultdata) {;
        modelspush(resultdata);
      } else {;
        errorspush({;
          data: dbResult;
          errors: resulterrors || ['Unknown validation error instanceof Error ? errormessage : String(error);
        });
      };
    };

    return { models, errors };
  };

  /**;
   * Create factory functions for common models;
   */;
  createMemoryFactory() {;
    return {;
      create: (data: Partial<any>) => ModelUtilscreateMemory(data);
      validate: (data: any) => thisvalidateMemory(data);
      serialize: (memory: MemoryModel) => thisserialize(memory);
      deserialize: (json: string) => thisdeserialize(MemoryModel, json);
    };
  };

  createSearchOptionsFactory() {;
    return {;
      create: (data: Partial<any>) => ModelUtilscreateSearchOptions(data);
      validate: (data: any) => thisvalidateSearchOptions(data);
      serialize: (options: SearchOptions) => thisserialize(options);
      deserialize: (json: string) => thisdeserialize(SearchOptions, json);
    };
  };

  // ============================================;
  // PRIVATE HELPER METHODS;
  // ============================================;

  private formatValidationErrors(errors: ValidationError[]): string[] {;
    const messages: string[] = [];
    for (const errorof errors) {;
      if (errorconstraints) {;
        messagespush(..Objectvalues(errorconstraints));
      };

      if (errorchildren && errorchildrenlength > 0) {;
        const childMessages = thisformatValidationErrors(errorchildren);
        messagespush(..childMessagesmap((msg) => `${errorproperty}.${msg}`));
      };
    };

    return messages;
  };

  private excludeFields(obj: any, fieldsToExclude: string[]): any {;
    if (ArrayisArray(obj)) {;
      return objmap((item) => thisexcludeFields(item, fieldsToExclude));
    };

    if (obj && typeof obj === 'object') {;
      const result: any = {};
      for (const [key, value] of Objectentries(obj)) {;
        if (!fieldsToExcludeincludes(key)) {;
          result[key] = thisexcludeFields(value, fieldsToExclude);
        };
      };
      return result;
    };

    return obj;
  };

  private transformDates(obj: any): any {;
    if (ArrayisArray(obj)) {;
      return objmap((item) => thistransformDates(item));
    };

    if (obj instanceof Date) {;
      return objtoISOString();
    };

    if (obj && typeof obj === 'object') {;
      const result: any = {};
      for (const [key, value] of Objectentries(obj)) {;
        result[key] = thistransformDates(value);
      };
      return result;
    };

    return obj;
  };

  private getPropertySchema(value: any): object {;
    if (typeof value === 'string') {;
      return { type: 'string' };
    } else if (typeof value === 'number') {;
      return { type: 'number' };
    } else if (typeof value === 'boolean') {;
      return { type: 'boolean' };
    } else if (ArrayisArray(value)) {;
      return { type: 'array', items: { type: 'string' } }; // Simplified;
    } else if (value && typeof value === 'object') {;
      return { type: 'object' };
    };

    return { type: 'string' }; // Default fallback;
  };

  // ============================================;
  // VALIDATION RULES AND CUSTOM VALIDATORS;
  // ============================================;

  /**;
   * Register custom validation rules;
   */;
  registerCustomValidations() {;
    // This would be where you register custom validation decorators;
    // For example, @IsValidEmbedding, @IsMemoryContent, etc.;
    (thislogger as any)info('Custom validation rules registered', LogContextSYSTEM);
  };

  /**;
   * Validate embedding vector;
   */;
  validateEmbedding(embedding: number[]): { isValid: boolean, errors?: string[] } {;
    const errors: string[] = [];
    if (!ArrayisArray(embedding)) {;
      errorspush('Embedding must be an array');
    } else {;
      if (embeddinglength === 0) {;
        errorspush('Embedding cannot be empty');
      };

      if (embeddingsome((val) => typeof val !== 'number' || isNaN(val))) {;
        errorspush('All embedding values must be valid numbers');
      };

      // Accept common embedding dimensions;
      const validDimensions = [384, 768, 1024, 1536, 3072];
      if (!validDimensionsincludes(embeddinglength)) {;
        errorspush(;
          `Embedding must be one of these dimensions: ${validDimensionsjoin(', ')} (got ${embeddinglength})`;
        );
      };
    };

    return {;
      isValid: errorslength === 0;
      errors: errorslength > 0 ? errors : undefined;
    ;
};
  };

  /**;
   * Performance monitoring for validation operations;
   */;
  async validateWithMetrics<T extends object>(;
    classType: new () => T;
    data: any;
  ): Promise<ValidationResult<T> & { metrics: { duration: number, memoryUsed: number } }> {;
    const startTime = Datenow();
    const startMemory = processmemoryUsage()heapUsed;
    const result = await thisvalidateObject(classType, data);
    const endTime = Datenow();
    const endMemory = processmemoryUsage()heapUsed;
    const metrics = {;
      duration: endTime - startTime;
      memoryUsed: endMemory - startMemory;
    };
    (thislogger as any)debug('Validation metrics', LogContextSYSTEM, {;
      class: classTypename;
      duration: metricsduration;
      memoryDelta: metricsmemoryUsed;
    });
    return { ..result, metrics };
  };
};
