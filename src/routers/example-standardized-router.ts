/**
 * Example Router with Standardized Validation and Error Handling
 * Demonstrates best practices for the new validation and error handling system
 */

import type { NextFunction,Request, Response } from 'express';
import { Router } from 'express';

import { authenticate } from '@/middleware/auth';
import { 
  validateContentType,
  validateParams,
  validateQueryParams, 
  validateRequest,
  validateRequestBody, 
  validateRequestSize 
} from '@/middleware/enhanced-validation';
import {
  ApiAuthenticationError,
  ApiNotFoundError,
  ApiServiceUnavailableError,
  ApiValidationError,
  asyncErrorHandler} from '@/middleware/standardized-error-handler';
import { 
  agentRequestSchema,
  chatRequestSchema, 
  healthCheckQuerySchema, 
  idParamSchema,
  paginationSchema,
  searchSchema} from '@/middleware/validation-schemas';
import { sendError,sendPaginatedSuccess, sendSuccess } from '@/utils/api-response';
import { log, LogContext } from '@/utils/logger';

const router = Router();

// ============================================================================
// Example: Simple endpoint with body validation
// ============================================================================

router.post('/chat',
  // Content type validation
  validateContentType('application/json'),
  
  // Request size limit (1MB)
  validateRequestSize(1024 * 1024),
  
  // Authentication
  authenticate,
  
  // Request body validation
  validateRequestBody(chatRequestSchema, {
    sanitize: true,
    stripUnknown: true
  }),
  
  // Route handler wrapped with async error handler
  asyncErrorHandler(async (req: Request, res: Response) => {
    const validatedData = req.body; // TypeScript knows this is ChatRequest type
    
    log.info('Processing chat request', LogContext.API, {
      userId: (req as any).user?.id,
      messageLength: validatedData.message.length,
      model: validatedData.model,
    });
    
    // Simulate processing
    if (validatedData.message.toLowerCase().includes('error')) {
      throw new ApiServiceUnavailableError('Chat service');
    }
    
    const currentTime = Date.now();
    const startTime = (req as any).startTime || currentTime;
    
    const response = {
      id: 'chat_' + currentTime,
      message: 'Hello! How can I help you?',
      model: validatedData.model || 'default',
      timestamp: new Date().toISOString(),
    };
    
    sendSuccess(res, response, 201, {
      processingTime: currentTime - startTime,
    });
  })
);

// ============================================================================
// Example: Endpoint with path params and query validation
// ============================================================================

router.get('/agents/:id',
  // Path parameter validation
  validateParams(idParamSchema),
  
  // Query parameter validation
  validateQueryParams(healthCheckQuerySchema, {
    coerceTypes: true,
    sanitize: true
  }),
  
  // Authentication
  authenticate,
  
  asyncErrorHandler(async (req: Request, res: Response) => {
    const { id } = req.params; // TypeScript knows this is validated
    const queryParams = req.query as any; // TypeScript knows this is HealthCheckQuery
    
    log.debug('Fetching agent details', LogContext.API, {
      agentId: id,
      includeDetails: queryParams.detailed,
      includes: queryParams.include,
    });
    
    // Simulate agent lookup
    if (id === 'nonexistent') {
      throw new ApiNotFoundError('Agent');
    }
    
    const agent = {
      id,
      name: 'Agent ' + id,
      status: 'active',
      capabilities: ['chat', 'analysis'],
      ...(queryParams.detailed && {
        detailedMetrics: {
          uptime: '99.9%',
          responseTime: '150ms',
          requests: 1234,
        }
      }),
    };
    
    sendSuccess(res, agent);
  })
);

export default router;
