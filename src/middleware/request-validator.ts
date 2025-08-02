import type { NextFunction, Request, Response } from 'express';
import type { ValidationChain } from 'express-validator';
import { body, validationResult } from 'express-validator';
import { LogContext, log } from '../utils/logger';

// Common validation chains
export const validateChatMessage = [
  body('message')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Message is required')
    .isLength({ max: 10000 })
    .withMessage('Message too long (max 10000 characters)'),
  body('conversationId').optional().isString().trim(),
  body('sessionId').optional().isString().trim(),
];

export const validateAgentExecution = [
  body('task').notEmpty().withMessage('Task is required'),
  body('task.type').isString().notEmpty().withMessage('Task type is required'),
  body('task.params').optional().isObject().withMessage('Task params must be an object'),
];

export const validateImageUpload = [
  body('image').optional().isString().withMessage('Image must be a base64 string'),
];

export const validateMLXFineTune = [
  body('baseModel').isString().notEmpty().withMessage('Base model is required'),
  body('trainingData').notEmpty().withMessage('Training data is required'),
  body('parameters').isObject().withMessage('Parameters must be an object'),
  body('parameters.epochs')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Epochs must be between 1 and 100'),
  body('parameters.learningRate')
    .optional()
    .isFloat({ min: 0.00001, max: 0.1 })
    .withMessage('Learning rate must be between 0.00001 and 0.1'),
];

// Validation middleware
export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
): Response | void => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    log.warn('Validation errors', LogContext.API, {
      path: req.path,
      errors: errors.array(),
    });

    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array().map((err) => ({
        field: (err as any).param,
        message: err.msg,
      })),
    });
  }

  next();
};

// Content type validation
export const validateContentType = (expectedType: string) => {
  return (req: Request, res: Response, next: NextFunction): Response | void => {
    const contentType = req.get('Content-Type');

    if (req.method !== 'GET' && req.method !== 'DELETE') {
      if (!contentType || !contentType.includes(expectedType)) {
        return res.status(400).json({
          success: false,
          error: `Content-Type must be ${expectedType}`,
        });
      }
    }

    next();
  };
};

// API key validation
export const validateAPIKey = (
  req: Request,
  res: Response,
  next: NextFunction
): Response | void => {
  const apiKey = req.headers['x-api-key'] as string;
  const aiService = req.headers['x-ai-service'] as string;

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: 'API key is required',
    });
  }

  // In production, validate against stored API keys
  if (process.env.NODE_ENV === 'production') {
    const validApiKeys = process.env.VALID_API_KEYS?.split(',') || [];

    if (!validApiKeys.includes(apiKey)) {
      log.warn('Invalid API key attempt', LogContext.SECURITY, {
        apiKey: `${apiKey.substring(0, 8)}...`,
        aiService,
        ip: req.ip,
      });

      return res.status(401).json({
        success: false,
        error: 'Invalid API key',
      });
    }
  }

  // Store API key info in request for later use
  (req as any).apiKey = apiKey;
  (req as any).aiService = aiService;

  next();
};

// Request size limit
export const limitRequestSize = (maxSizeMB = 10) => {
  return (req: Request, res: Response, next: NextFunction): Response | void => {
    const contentLength = parseInt(req.get('content-length') || '0', 10);
    const maxSize = maxSizeMB * 1024 * 1024; // Convert to bytes

    if (contentLength > maxSize) {
      return res.status(413).json({
        success: false,
        error: `Request too large. Maximum size is ${maxSizeMB}MB`,
      });
    }

    next();
  };
};

// Sanitize user input
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  // Recursively sanitize strings in the request body
  const sanitize = (obj: unknown): unknown => {
    if (typeof obj === 'string') {
      // Remove potentially dangerous patterns
      return obj
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .trim();
    } else if (Array.isArray(obj)) {
      return obj.map(sanitize);
    } else if (obj && typeof obj === 'object') {
      const sanitized: Record<string, unknown> = {};
      for (const key in obj as Record<string, unknown>) {
        sanitized[key] = sanitize((obj as Record<string, unknown>)[key]);
      }
      return sanitized;
    }
    return obj;
  };

  if (req.body) {
    req.body = sanitize(req.body);
  }

  next();
};

// Create validation chain
export const createValidationChain = (validations: ValidationChain[]): RequestHandler[] => {
  return [...validations, handleValidationErrors];
};

type RequestHandler = (req: Request, res: Response, next: NextFunction) => void;
