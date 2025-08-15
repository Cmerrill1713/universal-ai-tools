/**
 * Content Safety Middleware
 * Integrates input and output guardrails into Express middleware
 */

import type { NextFunction,Request, Response } from 'express';

import { inputGuardrailsService } from '../services/guardrails/input-guardrails.js';
import { outputGuardrailsService } from '../services/guardrails/output-guardrails.js';
import { sendError } from '../utils/api-response.js';
import { log, LogContext } from '../utils/logger.js';

interface SafetyRequest extends Request {
  safetyContext?: {
    inputValidated: boolean;
    originalContent?: string;
    sanitizedContent?: string;
    riskScore: number;
    categories: string[];
  };
}

interface SafetyResponse extends Response {
  originalSend: Function;
  safetySend: Function;
}

/**
 * Input validation middleware - validates incoming request content
 */
export const inputSafetyMiddleware = async (
  req: SafetyRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id || req.ip || 'anonymous';
    const requestType = req.path.includes('vision') ? 'vision' : 
                       req.path.includes('chat') ? 'chat' : 
                       req.path.includes('assistant') ? 'assistant' : 'general';

    // Extract content to validate
    let contentToValidate = '';
    let imageData = null;

    // Handle different content types
    if (req.body?.message) {
      contentToValidate = req.body.message;
    } else if (req.body?.prompt) {
      contentToValidate = req.body.prompt;
    } else if (req.body?.content) {
      contentToValidate = req.body.content;
    } else if (req.body?.query) {
      contentToValidate = req.body.query;
    }

    // Handle image content
    if (req.body?.imageBase64 || req.body?.imagePath) {
      imageData = {
        imageBase64: req.body.imageBase64,
        imagePath: req.body.imagePath
      };
    }

    // Validate text content
    if (contentToValidate) {
      const textResult = await inputGuardrailsService.validateInput(
        contentToValidate,
        userId,
        requestType
      );

      if (!textResult.allowed) {
        log.warn('🛡️ Request blocked by input guardrails', LogContext.SECURITY, {
          userId,
          requestType,
          reason: textResult.reason,
          categories: textResult.categories,
          path: req.path
        });

        return sendError(res, 'CONTENT_BLOCKED', textResult.reason || 'Content not allowed', 400);
      }

      // Store safety context for later use
      req.safetyContext = {
        inputValidated: true,
        originalContent: contentToValidate,
        sanitizedContent: textResult.sanitizedContent,
        riskScore: 1.0 - textResult.confidence,
        categories: textResult.categories
      };

      // Apply sanitization if needed
      if (textResult.sanitizedContent) {
        if (req.body.message) req.body.message = textResult.sanitizedContent;
        if (req.body.prompt) req.body.prompt = textResult.sanitizedContent;
        if (req.body.content) req.body.content = textResult.sanitizedContent;
        if (req.body.query) req.body.query = textResult.sanitizedContent;
      }
    }

    // Validate image content
    if (imageData) {
      const imageResult = await inputGuardrailsService.validateImage(imageData, userId);

      if (!imageResult.allowed) {
        log.warn('🛡️ Image blocked by input guardrails', LogContext.SECURITY, {
          userId,
          reason: imageResult.reason,
          categories: imageResult.categories,
          path: req.path
        });

        return sendError(res, 'IMAGE_BLOCKED', imageResult.reason || 'Image not allowed', 400);
      }
    }

    // Continue to next middleware
    next();

  } catch (error) {
    log.error('Input safety middleware error', LogContext.SECURITY, { error });
    return sendError(res, 'SAFETY_CHECK_ERROR', 'Content validation failed', 500);
  }
};

/**
 * Output validation middleware - validates outgoing AI responses
 */
export const outputSafetyMiddleware = (
  req: SafetyRequest,
  res: SafetyResponse,
  next: NextFunction
): void => {
  // Store original send method
  res.originalSend = res.send;

  // Override send method to intercept responses
  res.send = function(data: any): SafetyResponse {
    // Only validate successful AI responses
    if (res.statusCode >= 200 && res.statusCode < 300) {
      validateAndSendResponse(req, res, data);
    } else {
      // Send error responses as-is
      res.originalSend.call(this, data);
    }
    return this;
  };

  next();
};

/**
 * Validate and send AI response with output guardrails
 */
async function validateAndSendResponse(
  req: SafetyRequest,
  res: SafetyResponse,
  data: any
): Promise<void> {
  try {
    const userId = req.user?.id || req.ip || 'anonymous';
    const requestType = req.path.includes('vision') ? 'vision' : 
                       req.path.includes('chat') ? 'chat' : 
                       req.path.includes('assistant') ? 'assistant' : 'general';

    // Extract AI response content
    let responseContent = '';
    let responseData = data;

    // Handle different response formats
    if (typeof data === 'string') {
      responseContent = data;
    } else if (data?.data?.response) {
      responseContent = data.data.response;
    } else if (data?.data?.content) {
      responseContent = data.data.content;
    } else if (data?.response) {
      responseContent = data.response;
    } else if (data?.content) {
      responseContent = data.content;
    } else if (data?.message) {
      responseContent = data.message;
    }

    // Only validate if we have content to check
    if (responseContent && typeof responseContent === 'string' && responseContent.length > 0) {
      const requestContext = {
        userId,
        requestType,
        model: req.body?.model || 'unknown',
        prompt: req.safetyContext?.originalContent || req.body?.message || req.body?.prompt
      };

      const validationResult = await outputGuardrailsService.validateOutput(
        responseContent,
        requestContext
      );

      if (!validationResult.allowed) {
        log.warn('🛡️ Response blocked by output guardrails', LogContext.SECURITY, {
          userId,
          requestType,
          reason: validationResult.reason,
          categories: validationResult.categories,
          riskScore: validationResult.metadata.riskScore,
          path: req.path
        });

        // Send safe error response instead of blocked content
        const safeResponse = {
          success: false,
          error: {
            code: 'CONTENT_FILTERED',
            message: 'Response was filtered for safety reasons'
          },
          metadata: {
            filtered: true,
            reason: validationResult.reason,
            categories: validationResult.categories.filter(c => !c.includes('safe'))
          }
        };

        res.status(200); // Keep success status to avoid triggering error handlers
        return res.originalSend.call(res, safeResponse);
      }

      // Apply content sanitization if needed
      if (validationResult.sanitizedContent && validationResult.sanitizedContent !== responseContent) {
        log.info('🧹 Response sanitized by output guardrails', LogContext.SECURITY, {
          userId,
          requestType,
          categories: validationResult.categories,
          originalLength: validationResult.metadata.originalLength,
          sanitizedLength: validationResult.metadata.sanitizedLength
        });

        // Update response with sanitized content
        if (typeof data === 'string') {
          responseData = validationResult.sanitizedContent;
        } else if (data?.data?.response) {
          responseData.data.response = validationResult.sanitizedContent;
        } else if (data?.data?.content) {
          responseData.data.content = validationResult.sanitizedContent;
        } else if (data?.response) {
          responseData.response = validationResult.sanitizedContent;
        } else if (data?.content) {
          responseData.content = validationResult.sanitizedContent;
        } else if (data?.message) {
          responseData.message = validationResult.sanitizedContent;
        }

        // Add safety metadata
        if (typeof responseData === 'object' && responseData !== null) {
          responseData.metadata = {
            ...responseData.metadata,
            sanitized: true,
            safetyCategories: validationResult.categories,
            riskScore: validationResult.metadata.riskScore
          };
        }
      }

      // Log high-risk but allowed responses
      if (validationResult.metadata.riskScore > 0.5) {
        log.info('⚠️ High-risk response allowed', LogContext.SECURITY, {
          userId,
          requestType,
          riskScore: validationResult.metadata.riskScore,
          categories: validationResult.categories,
          path: req.path
        });
      }
    }

    // Send the (potentially sanitized) response
    res.originalSend.call(res, responseData);

  } catch (error) {
    log.error('Output safety middleware error', LogContext.SECURITY, { error });
    
    // On error, send a safe fallback response
    const fallbackResponse = {
      success: false,
      error: {
        code: 'SAFETY_VALIDATION_ERROR',
        message: 'Response validation failed'
      }
    };
    
    res.status(500);
    res.originalSend.call(res, fallbackResponse);
  }
}

/**
 * Combined safety middleware that applies both input and output validation
 */
export const contentSafetyMiddleware = [inputSafetyMiddleware, outputSafetyMiddleware];

/**
 * Rate limiting middleware for additional protection
 */
export const rateLimitingMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const userId = req.user?.id || req.ip || 'anonymous';
  const isHighRisk = req.path.includes('vision') || req.path.includes('generate');
  
  // This would typically integrate with Redis or another persistent store
  // For now, we'll rely on the guardrails service internal rate limiting
  
  if (isHighRisk) {
    // Add additional headers for rate limiting visibility
    res.set({
      'X-RateLimit-Limit': '10',
      'X-RateLimit-Window': '60',
      'X-RateLimit-Policy': 'high-risk-endpoints'
    });
  }

  next();
};

export default contentSafetyMiddleware;