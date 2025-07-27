/**
 * Pydantic AI Router - HTTP endpoints for type-safe AI interactions
 */

import express from 'express';
import { z } from 'zod';
import { type AIRequest, pydanticAI } from '../services/pydantic-ai-service';
import { wrapAsync } from '../utils/async-wrapper';
import { LogContext, logger } from '../utils/enhanced-logger';

const router = express.Router();

/**
 * POST /api/pydantic-ai/request
 * Main AI request endpoint with type safety
 */
router.post(
  '/request',
  wrapAsync(async (req, res) => {
    try {
      const request: Partial<AIRequest> = req.body;
      const response = await pydanticAI.request(request);

      res.json({
        success: true,
        response,
      });
    } catch (error) {
      logger.error('PydanticAI request failed:', LogContext.API, {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Request failed'
      });
    }
  })
);

/**
 * POST /api/pydantic-ai/analyze
 * Cognitive analysis endpoint
 */
router.post(
  '/analyze',
  wrapAsync(async (req, res) => {
    try {
      const { content, context } = req.body;

      if (!content) {
        return res.status(400).json({
          success: false,
          error: 'Content is required',
        });
      }

      const analysis = await pydanticAI.analyzeCognitive(content, context);

      res.json({
        success: true,
        analysis
      });
    } catch (error) {
      logger.error('Cognitive analysis failed:', LogContext.API, {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Analysis failed',
      });
    }
  })
);

/**
 * POST /api/pydantic-ai/plan
 * Task planning endpoint
 */
router.post(
  '/plan',
  wrapAsync(async (req, res) => {
    try {
      const { objective, constraints } = req.body;

      if (!objective) {
        return res.status(400).json({
          success: false,
          error: 'Objective is required',
        });
      }

      const plan = await pydanticAI.planTask(objective, constraints);

      res.json({
        success: true,
        plan,
      });
    } catch (error) {
      logger.error('Task planning failed:', LogContext.API, {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Planning failed',
      });
    }
  })
);

/**
 * POST /api/pydantic-ai/generate-code
 * Code generation endpoint
 */
router.post(
  '/generate-code',
  wrapAsync(async (req, res) => {
    try {
      const { specification, language = 'typescript', options } = req.body;

      if (!specification) {
        return res.status(400).json({
          success: false,
          error: 'Specification is required',
        });
      }

      const code = await pydanticAI.generateCode(specification, language, options);

      res.json({
        success: true,
        code,
      });
    } catch (error) {
      logger.error('Code generation failed:', LogContext.API, {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Code generation failed',
      });
    }
  })
);

/**
 * POST /api/pydantic-ai/validate
 * Validate data against a schema
 */
router.post(
  '/validate',
  wrapAsync(async (req, res) => {
    try {
      const { data, schemaName, customSchema } = req.body;

      if (!data) {
        return res.status(400).json({
          success: false,
          error: 'Data is required',
        });
      }

      // If custom schema provided, register and use it
      if (customSchema) {
        try {
          const zodSchema = z.object(customSchema);
          pydanticAI.registerSchema('custom_validation', zodSchema);
          schemaName = 'custom_validation';
        } catch (error) {
          return res.status(400).json({
            success: false,
            error: 'Invalid schema definition',
          });
        }
      }

      if (!schemaName) {
        return res.status(400).json({
          success: false,
          error: 'Schema name or custom schema is required',
        });
      }

      // Use the PydanticAI agent for validation
      const response = await pydanticAI.request({
        prompt: `Validate the following data against the ${schemaName} schema`,
        context: {
          metadata: { data, schemaName },
        },
        orchestration: {
          mode: 'simple',
          preferredAgents: ['pydantic_ai'],
        },
      });

      res.json({
        success: true,
        validation: response.structuredData || response.content
      });
    } catch (error) {
      logger.error('Validation failed:', LogContext.API, {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Validation failed',
      });
    }
  })
);

/**
 * POST /api/pydantic-ai/register-schema
 * Register a custom validation schema
 */
router.post(
  '/register-schema',
  wrapAsync(async (req, res) => {
    try {
      const { name, schema } = req.body;

      if (!name || !schema) {
        return res.status(400).json({
          success: false,
          error: 'Name and schema are required',
        });
      }

      try {
        const zodSchema = z.object(schema);
        pydanticAI.registerSchema(name, zodSchema);

        res.json({
          success: true,
          message: `Schema '${name}' registered successfully`,
        });
      } catch (error) {
        return res.status(400).json({
          success: false,
          error: 'Invalid schema definition',
        });
      }
    } catch (error) {
      logger.error('Schema registration failed:', LogContext.API, {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Registration failed',
      });
    }
  })
);

/**
 * GET /api/pydantic-ai/stats
 * Get service statistics
 */
router.get(
  '/stats',
  wrapAsync(async (req, res) => {
    try {
      const stats = pydanticAI.getStats();

      res.json({
        success: true,
        stats,
      });
    } catch (error) {
      logger.error('Failed to get stats:', LogContext.API, {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get stats',
      });
    }
  })
);

/**
 * POST /api/pydantic-ai/clear-cache
 * Clear the response cache
 */
router.post(
  '/clear-cache',
  wrapAsync(async (req, res) => {
    try {
      pydanticAI.clearCache();

      res.json({
        success: true,
        message: 'Cache cleared successfully',
      });
    } catch (error) {
      logger.error('Failed to clear cache:', LogContext.API, {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to clear cache',
      });
    }
  })
);

/**
 * POST /api/pydantic-ai/structured
 * Request with custom output schema
 */
router.post(
  '/structured',
  wrapAsync(async (req, res) => {
    try {
      const { request, outputSchema } = req.body;

      if (!request || !outputSchema) {
        return res.status(400).json({
          success: false,
          error: 'Request and outputSchema are required',
        });
      }

      try {
        // Build Zod schema from JSON schema definition
        const zodSchema = buildZodSchema(outputSchema);
        const response = await pydanticAI.requestWithSchema(request, zodSchema);

        res.json({
          success: true,
          response,
        });
      } catch (error) {
        return res.status(400).json({
          success: false,
          error: error instanceof Error ? error.message : 'Invalid schema or request',
        });
      }
    } catch (error) {
      logger.error('Structured request failed:', LogContext.API, {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Request failed'
      });
    }
  })
);

/**
 * Helper function to build Zod schema from JSON schema
 */
function buildZodSchema(jsonSchema: any): z.ZodSchema {
  if (jsonSchema.type === 'object' && jsonSchema.properties) {
    const shape: Record<string, z.ZodSchema> = {};

    for (const [key, value] of Object.entries(jsonSchema.properties)) {
      shape[key] = buildZodSchema(value as any);
    }

    let schema = z.object(shape);

    if (jsonSchema.required && Array.isArray(jsonSchema.required)) {
      // Mark non-required fields as optional
      for (const key of Object.keys(shape)) {
        if (!jsonSchema.required.includes(key)) {
          shape[key] = shape[key].optional();
        }
      }
      schema = z.object(shape);
    }

    return schema;
  }

  if (jsonSchema.type === 'array' && jsonSchema.items) {
    return z.array(buildZodSchema(jsonSchema.items));
  }

  if (jsonSchema.type === 'string') {
    return z.string();
  }

  if (jsonSchema.type === 'number') {
    return z.number();
  }

  if (jsonSchema.type === 'boolean') {
    return z.boolean();
  }

  if (jsonSchema.type === 'null') {
    return z.null();
  }

  // Default to unknown for unsupported types
  return z.unknown();
}

export default router;
