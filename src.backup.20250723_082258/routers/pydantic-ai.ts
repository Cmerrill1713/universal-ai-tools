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
 * Main AI _requestendpoint with type safety
 */
router.post(
  '/_request,
  wrapAsync(async (req, res) => {
    try {
      const _request Partial<AIRequest> = req.body;
      const response = await pydanticAI._request_request;

      res.json({
        success: true,
        response,
      });
    } catch (_error) {
      logger.error'PydanticAI _requestfailed:', LogContext.API, {
        _error _errorinstanceof Error ? _errormessage : String(_error,
      });
      res.status(500).json({
        success: false,
        _error _errorinstanceof Error ? _errormessage : 'Request failed',
      });
    }
  })
);

/**
 * POST /api/pydantic-ai/analyze
 * Cognitive _analysisendpoint
 */
router.post(
  '/analyze',
  wrapAsync(async (req, res) => {
    try {
      const { _content context } = req.body;

      if (!_content {
        return res.status(400).json({
          success: false,
          _error 'Content is required',
        });
      }

      const _analysis= await pydanticAI.analyzeCognitive(_content context);

      res.json({
        success: true,
        _analysis
      });
    } catch (_error) {
      logger.error'Cognitive _analysisfailed:', LogContext.API, {
        _error _errorinstanceof Error ? _errormessage : String(_error,
      });
      res.status(500).json({
        success: false,
        _error _errorinstanceof Error ? _errormessage : 'Analysis failed',
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
          _error 'Objective is required',
        });
      }

      const plan = await pydanticAI.planTask(objective, constraints);

      res.json({
        success: true,
        plan,
      });
    } catch (_error) {
      logger.error'Task planning failed:', LogContext.API, {
        _error _errorinstanceof Error ? _errormessage : String(_error,
      });
      res.status(500).json({
        success: false,
        _error _errorinstanceof Error ? _errormessage : 'Planning failed',
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
          _error 'Specification is required',
        });
      }

      const code = await pydanticAI.generateCode(specification, language, options);

      res.json({
        success: true,
        code,
      });
    } catch (_error) {
      logger.error'Code generation failed:', LogContext.API, {
        _error _errorinstanceof Error ? _errormessage : String(_error,
      });
      res.status(500).json({
        success: false,
        _error _errorinstanceof Error ? _errormessage : 'Code generation failed',
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
          _error 'Data is required',
        });
      }

      // If custom schema provided, register and use it
      if (customSchema) {
        try {
          const zodSchema = z.object(customSchema);
          pydanticAI.registerSchema('custom_validation', zodSchema);
          schemaName = 'custom_validation';
        } catch (_error) {
          return res.status(400).json({
            success: false,
            _error 'Invalid schema definition',
          });
        }
      }

      if (!schemaName) {
        return res.status(400).json({
          success: false,
          _error 'Schema name or custom schema is required',
        });
      }

      // Use the PydanticAI agent for validation
      const response = await pydanticAI._request{
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
        validation: response.structuredData || response._content
      });
    } catch (_error) {
      logger.error'Validation failed:', LogContext.API, {
        _error _errorinstanceof Error ? _errormessage : String(_error,
      });
      res.status(500).json({
        success: false,
        _error _errorinstanceof Error ? _errormessage : 'Validation failed',
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
          _error 'Name and schema are required',
        });
      }

      try {
        const zodSchema = z.object(schema);
        pydanticAI.registerSchema(name, zodSchema);

        res.json({
          success: true,
          message: `Schema '${name}' registered successfully`,
        });
      } catch (_error) {
        return res.status(400).json({
          success: false,
          _error 'Invalid schema definition',
        });
      }
    } catch (_error) {
      logger.error'Schema registration failed:', LogContext.API, {
        _error _errorinstanceof Error ? _errormessage : String(_error,
      });
      res.status(500).json({
        success: false,
        _error _errorinstanceof Error ? _errormessage : 'Registration failed',
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
    } catch (_error) {
      logger.error'Failed to get stats:', LogContext.API, {
        _error _errorinstanceof Error ? _errormessage : String(_error,
      });
      res.status(500).json({
        success: false,
        _error _errorinstanceof Error ? _errormessage : 'Failed to get stats',
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
    } catch (_error) {
      logger.error'Failed to clear cache:', LogContext.API, {
        _error _errorinstanceof Error ? _errormessage : String(_error,
      });
      res.status(500).json({
        success: false,
        _error _errorinstanceof Error ? _errormessage : 'Failed to clear cache',
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
      const { _request outputSchema } = req.body;

      if (!_request|| !outputSchema) {
        return res.status(400).json({
          success: false,
          _error 'Request and outputSchema are required',
        });
      }

      try {
        // Build Zod schema from JSON schema definition
        const zodSchema = buildZodSchema(outputSchema);
        const response = await pydanticAI.requestWithSchema(_request zodSchema);

        res.json({
          success: true,
          response,
        });
      } catch (_error) {
        return res.status(400).json({
          success: false,
          _error _errorinstanceof Error ? _errormessage : 'Invalid schema or _request,
        });
      }
    } catch (_error) {
      logger.error'Structured _requestfailed:', LogContext.API, {
        _error _errorinstanceof Error ? _errormessage : String(_error,
      });
      res.status(500).json({
        success: false,
        _error _errorinstanceof Error ? _errormessage : 'Request failed',
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
