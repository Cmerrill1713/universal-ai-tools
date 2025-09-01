/**
 * Memory Validation Middleware
 * Enforces best practices rules for AI assistant memory operations
 */

import type { Request, Response, NextFunction } from 'express';
import { MemoryBestPracticesEngine } from '../utils/memory-best-practices.js';
import { LogContext, log } from '../utils/logger.js';

interface MemoryRequest extends Request {
  body: {
    content: string;
    type: 'conversation' | 'knowledge' | 'context' | 'preference';
    metadata?: any;
    tags?: string[];
    importance?: number;
    enforceRules?: boolean; // Allow bypassing for emergency situations
    autoFix?: boolean; // Automatically apply fixes when possible
  };
}

export class MemoryValidationMiddleware {
  private static _bestPractices = MemoryBestPracticesEngine.getInstance();

  /**
   * Validate memory creation requests against best practices
   */
  public static validateMemoryCreation = (
    req: MemoryRequest,
    res: Response,
    next: NextFunction
  ): void => {
    try {
      // Skip validation if explicitly requested (emergency bypass)
      if (req.body.enforceRules === false) {
        log.warn('Memory validation bypassed by request', LogContext.API);
        return next();
      }

      const userId = (req as any).user?.id || 'anonymous';
      
      // Create memory object for validation
      const memory = {
        id: 'temp-validation-id',
        userId,
        content: req.body.content,
        type: req.body.type,
        metadata: {
          ...req.body.metadata,
          timestamp: new Date().toISOString(),
          tags: req.body.tags || [],
          importance: req.body.importance || 0.5,
          accessCount: 0
        }
      };

      // Validate against best practices
      const validation = MemoryValidationMiddleware._bestPractices.validateMemory(memory);

      // Handle critical errors (block storage)
      const criticalErrors = validation.violations.filter(v => v.severity === 'error');
      if (criticalErrors.length > 0) {
        log.warn('Memory creation blocked due to critical violations', LogContext.API, {
          violations: criticalErrors.map(v => v.message),
          userId
        });

        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Memory violates critical best practices rules',
            violations: criticalErrors
          },
          suggestions: {
            autoFixable: validation.fixable,
            fixes: criticalErrors.flatMap(v => v.suggestions)
          }
        });
        return;
      }

      // Apply auto-fixes if requested and available
      if (req.body.autoFix !== false && validation.autoFixedMemory) {
        req.body = {
          ...req.body,
          content: validation.autoFixedMemory.content,
          metadata: validation.autoFixedMemory.metadata,
          tags: validation.autoFixedMemory.metadata.tags,
          importance: validation.autoFixedMemory.metadata.importance
        };

        log.info('Applied automatic memory fixes', LogContext.API, {
          fixesApplied: validation.fixable,
          userId
        });
      }

      // Log warnings but allow storage to proceed
      const warnings = validation.violations.filter(v => v.severity === 'warning');
      if (warnings.length > 0) {
        log.warn('Memory has best practice warnings', LogContext.API, {
          warnings: warnings.map(v => v.message),
          userId
        });

        // Add warnings to response headers for client awareness
        res.setHeader('X-Memory-Warnings', JSON.stringify(warnings.map(w => w.message)));
      }

      // Add validation metadata to request for downstream use
      (req as any).memoryValidation = {
        passed: validation.passed,
        violations: validation.violations,
        autoFixed: !!validation.autoFixedMemory
      };

      next();

    } catch (error) {
      log.error('Memory validation middleware error', LogContext.API, { error });
      // Don't block on validation errors, but log them
      next();
    }
  };

  /**
   * Validate memory update requests
   */
  public static validateMemoryUpdate = (
    req: MemoryRequest,
    res: Response,
    next: NextFunction
  ): void => {
    try {
      // Similar validation for updates, but more lenient
      // Skip validation if explicitly requested
      if (req.body.enforceRules === false) {
        return next();
      }

      // Only validate the fields being updated
      if (req.body.content) {
        const tempMemory = {
          id: req.params.id || 'temp-id',
          userId: (req as any).user?.id || 'anonymous',
          content: req.body.content,
          type: 'knowledge' as const, // Assume knowledge for validation
          metadata: {
            timestamp: new Date().toISOString(),
            tags: req.body.tags || [],
            importance: req.body.importance || 0.5,
            accessCount: 0,
            ...req.body.metadata
          }
        };

        const validation = MemoryValidationMiddleware._bestPractices.validateMemory(tempMemory);
        
        // Block critical errors
        const criticalErrors = validation.violations.filter(v => v.severity === 'error');
        if (criticalErrors.length > 0) {
          res.status(400).json({
            success: false,
            error: {
              code: 'UPDATE_VALIDATION_ERROR',
              message: 'Update violates critical best practices rules',
              violations: criticalErrors
            }
          });
          return;
        }

        // Apply fixes if available
        if (req.body.autoFix !== false && validation.autoFixedMemory) {
          req.body.content = validation.autoFixedMemory.content;
          if (validation.autoFixedMemory.metadata) {
            req.body.metadata = {
              ...req.body.metadata,
              ...validation.autoFixedMemory.metadata
            };
          }
        }
      }

      next();

    } catch (error) {
      log.error('Memory update validation error', LogContext.API, { error });
      next();
    }
  };

  /**
   * Add validation report to memory retrieval responses
   */
  public static addValidationReport = (
    req: Request,
    res: Response,
    next: NextFunction
  ): void => {
    try {
      // Store original json method
      const originalJson = res.json;

      // Override json method to add validation data
      res.json = function(obj: any) {
        if (obj.success && obj.data) {
          // Add validation reports for memories
          if (obj.data.memories) {
            // Multiple memories
            obj.data.memories = obj.data.memories.map((memory: any) => ({
              ...memory,
              validationReport: MemoryValidationMiddleware._bestPractices.getValidationReport(memory.id)
            }));
          } else if (obj.data.id) {
            // Single memory
            obj.data.validationReport = MemoryValidationMiddleware._bestPractices.getValidationReport(obj.data.id);
          }

          // Add system validation stats
          obj.validationStats = MemoryValidationMiddleware._bestPractices.getValidationStats();
        }

        return originalJson.call(this, obj);
      };

      next();

    } catch (error) {
      log.error('Validation report middleware error', LogContext.API, { error });
      next();
    }
  };

  /**
   * Get current validation statistics
   */
  public static getValidationStats(): any {
    return MemoryValidationMiddleware._bestPractices.getValidationStats();
  }

  /**
   * Add custom validation rule
   */
  public static addCustomRule(rule: any): void {
    MemoryValidationMiddleware._bestPractices.addCustomRule(rule);
  }

  /**
   * Access to best practices engine for external use
   */
  public static get bestPractices() {
    return MemoryValidationMiddleware._bestPractices;
  }

}

export default MemoryValidationMiddleware;