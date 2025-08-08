/**
 * Error Boundaries and Recovery System;
 * Comprehensive error handling, recovery mechanisms, and resilience patterns;
 */

import type express from 'express';
import { LogContext, log } from '@/utils/logger';
import { ServerTimeoutManager } from './server-timeouts';

export interface ErrorContext {
  requestId?: string;
  userId?: string;
  agent?: string;
  service?: string;
  operation?: string;
  attempt?: number;
  metadata?: Record<string, any>;
}

export interface RecoveryStrategy {
  name: string;
  attempt: (error: Error, context: ErrorContext) => Promise<any>;
  condition: (error: Error) => boolean;
  maxRetries?: number;
  backoffMs?: number;
}

export class ErrorBoundaryManager {
  private recoveryStrategies: RecoveryStrategy[] = [];
  private errorStats = new Map<string, { count: number; lastSeen: Date }>();
  private circuitBreakers = new Map<string, { failures: number; lastFailure: Date; isOpen: boolean }>();
  private timeoutManager: ServerTimeoutManager;

  constructor(timeoutManager: ServerTimeoutManager) {
    this?.timeoutManager = timeoutManager;
    this?.setupDefaultRecoveryStrategies();
  }

  private setupDefaultRecoveryStrategies(): void {
    // Network/Connection Recovery;
    this?.addRecoveryStrategy({
      name: 'network-retry',
      condition: (error) => 
        error?.message?.includes('ECONNREFUSED') ||
        error?.message?.includes('ENOTFOUND') ||
        error?.message?.includes('ETIMEDOUT'),
      attempt: async (error, context) => {
        log?.warn('Network error detected, implementing retry strategy', LogContext?.SYSTEM, {
          error: error?.message,
          context,
        });
        
        // Wait before retry;
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Return a fallback response;
        return {
          success: false,
          error: 'Network temporarily unavailable',
          recovery: 'network-retry',
          retryAfter: 5000,
        };
      },
      maxRetries: 3,
      backoffMs: 1000,
    });

    // Database Recovery;
    this?.addRecoveryStrategy({
      name: 'database-fallback',
      condition: (error) =>
        error?.message?.includes('connection') ||
        error?.message?.includes('timeout') ||
        error?.message?.includes('database'),
      attempt: async (error, context) => {
        log?.warn('Database error detected, using fallback strategy', LogContext?.DATABASE, {
          error: error?.message,
          context,
        });

        return {
          success: false,
          error: 'Database temporarily unavailable',
          recovery: 'database-fallback',
          cached: true,
        };
      },
      maxRetries: 2,
      backoffMs: 2000,
    });

    // AI Service Recovery;
    this?.addRecoveryStrategy({
      name: 'ai-service-fallback',
      condition: (error) =>
        error?.message?.includes('API key') ||
        error?.message?.includes('rate limit') ||
        error?.message?.includes('quota'),
      attempt: async (error, context) => {
        log?.warn('AI service error detected, implementing fallback', LogContext?.AGENT, {
          error: error?.message,
          context,
        });

        // Try fallback model or cached response;
        return {
          success: false,
          error: 'AI service temporarily limited',
          recovery: 'ai-service-fallback',
          message: 'Using fallback processing',
        };
      },
      maxRetries: 1,
      backoffMs: 5000,
    });

    // Memory/Resource Recovery;
    this?.addRecoveryStrategy({
      name: 'resource-cleanup',
      condition: (error) =>
        error?.message?.includes('memory') ||
        error?.message?.includes('heap') ||
        error?.message?.includes('ENOMEM'),
      attempt: async (error, context) => {
        log?.error('Memory/resource error detected, triggering cleanup', LogContext?.SYSTEM, {
          error: error?.message,
          context,
        });

        // Force garbage collection if available;
        if (global?.gc) {
          global?.gc();
        }

        return {
          success: false,
          error: 'Resource constraints detected',
          recovery: 'resource-cleanup',
          message: 'System resources optimized',
        };
      },
      maxRetries: 1,
    });
  }

  addRecoveryStrategy(strategy: RecoveryStrategy): void {
    this?.recoveryStrategies?.push(strategy);
    log?.info(`Recovery strategy added: ${strategy?.name}`, LogContext?.SYSTEM);
  }

  async handleError(
    error: Error,
    context: ErrorContext = {}
  ): Promise<any> {
    const errorKey = `${error?.name}:${error?.message?.substring(0, 100)}`;
    
    // Update error statistics;
    this?.updateErrorStats(errorKey);
    
    // Check circuit breaker;
    if (this?.isCircuitOpen(context?.service || 'unknown')) {
      return this?.createCircuitBreakerResponse();
    }

    // Try recovery strategies;
    for (const strategy of this?.recoveryStrategies) {
      if (strategy?.condition(error)) {
        try {
          const result = await this?.executeRecoveryStrategy(strategy, error, context);
          
          // Reset circuit breaker on successful recovery;
          this?.resetCircuitBreaker(context?.service || 'unknown');
          
          return result;
        } catch (recoveryError) {
          log?.error(`Recovery strategy failed: ${strategy?.name}`, LogContext?.SYSTEM, {
            originalError: error?.message,
            recoveryError: recoveryError instanceof Error ? recoveryError?.message : String(recoveryError),
          });
          
          // Update circuit breaker;
          this?.updateCircuitBreaker(context?.service || 'unknown');
        }
      }
    }

    // No recovery strategy worked, return generic error response;
    return this?.createGenericErrorResponse(error, context);
  }

  private async executeRecoveryStrategy(
    strategy: RecoveryStrategy,
    error: Error,
    context: ErrorContext;
  ): Promise<any> {
    const maxRetries = strategy?.maxRetries || 1;
    const backoffMs = strategy?.backoffMs || 1000,

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        log?.info(`Executing recovery strategy: ${strategy?.name} (attempt ${attempt}/${maxRetries})`, LogContext?.SYSTEM);
        
        const result = await ServerTimeoutManager?.createGracefulTimeout(
          strategy?.attempt(error, { ...context, attempt }),
          10000 // 10 second timeout for recovery attempts;
        );

        log?.info(`Recovery strategy succeeded: ${strategy?.name}`, LogContext?.SYSTEM);
        return result;

      } catch (attemptError) {
        if (attempt < maxRetries) {
          const delay = backoffMs * attempt;
          log?.warn(`Recovery attempt ${attempt} failed, retrying in ${delay}ms`, LogContext?.SYSTEM, {
            strategy: strategy?.name,
            error: attemptError instanceof Error ? attemptError?.message : String(attemptError),
          });
          
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          throw attemptError;
        }
      }
    }
  }

  private updateErrorStats(errorKey: string): void {
    const existing = this?.errorStats?.get(errorKey);
    if (existing) {
      existing?.count++;
      existing?.lastSeen = new Date();
    } else {
      this?.errorStats?.set(errorKey, { count: 1, lastSeen: new Date() });
    }
  }

  private updateCircuitBreaker(service: string): void {
    const breaker = this?.circuitBreakers?.get(service) || { failures: 0, lastFailure: new Date(), isOpen: false };
    breaker?.failures++;
    breaker?.lastFailure = new Date();
    
    // Open circuit after 5 failures in 1 minute;
    if (breaker?.failures >= 5 && !breaker?.isOpen) {
      breaker?.isOpen = true;
      log?.warn(`Circuit breaker opened for service: ${service}`, LogContext?.SYSTEM, {
        failures: breaker?.failures,
      });
    }
    
    this?.circuitBreakers?.set(service, breaker);
  }

  private resetCircuitBreaker(service: string): void {
    const breaker = this?.circuitBreakers?.get(service);
    if (breaker) {
      breaker?.failures = 0,
      breaker?.isOpen = false;
      log?.info(`Circuit breaker reset for service: ${service}`, LogContext?.SYSTEM);
    }
  }

  private isCircuitOpen(service: string): boolean {
    const breaker = this?.circuitBreakers?.get(service);
    if (!breaker || !breaker?.isOpen) return false;
    
    // Auto-reset circuit breaker after 5 minutes;
    const fiveMinutesAgo = new Date(Date?.now() - 5 * 60 * 1000);
    if (breaker?.lastFailure < fiveMinutesAgo) {
      this?.resetCircuitBreaker(service);
      return false;
    }
    
    return true;
  }

  private createCircuitBreakerResponse(): any {
    return {
      success: false,
      error: 'Service Circuit Breaker Open',
      message: 'Service is temporarily unavailable due to repeated failures',
      code: 'CIRCUIT_BREAKER_OPEN',
      retryAfter: 300000, // 5 minutes;
    };
  }

  private createGenericErrorResponse(error: Error, context: ErrorContext): any {
    return {
      success: false,
      error: 'Internal Server Error',
      message: 'An unexpected error occurred',
      code: 'INTERNAL_ERROR',
      requestId: context?.requestId,
      timestamp: new Date().toISOString(),
    };
  }

  // Express middleware for error boundary;
  createErrorBoundaryMiddleware(): express?.ErrorRequestHandler {
    return async (error: Error, req: express?.Request, res: express?.Response, next: express?.NextFunction) => {
      const context: ErrorContext = {
        requestId: req?.headers['x-request-id'] as string,
        userId: (req as unknown).user?.id,
        service: req?.path?.split('/')[2], // Extract service from path like /api/v1/service;
        operation: `${req?.method} ${req?.path}`,
        metadata: {
          userAgent: req?.headers['user-agent'],
          ip: req?.ip,
          body: req?.method === 'POST' ? req?.body : undefined,
        },
      };

      log?.error('Request error caught by boundary', LogContext?.API, {
        error: error?.message,
        stack: error?.stack,
        context,
      });

      try {
        const recovery = await this?.handleError(error, context);
        
        // Determine HTTP status code;
        let statusCode = 500,
        if (error?.message?.includes('timeout')) statusCode = 408;
        if (error?.message?.includes('not found')) statusCode = 404;
        if (error?.message?.includes('unauthorized')) statusCode = 401;
        if (error?.message?.includes('forbidden')) statusCode = 403;
        if (recovery?.code === 'CIRCUIT_BREAKER_OPEN') statusCode = 503;

        res?.status(statusCode).json(recovery);
      } catch (handlingError) {
        log?.error('Error boundary handler failed', LogContext?.SYSTEM, {
          originalError: error?.message,
          handlingError: handlingError instanceof Error ? handlingError?.message : String(handlingError),
        });

        res?.status(500).json({
          success: false,
          error: 'Critical System Error',
          message: 'Error handling system failed',
          code: 'BOUNDARY_FAILURE',
        });
      }
    };
  }

  // Get error statistics;
  getErrorStats(): Record<string, any> {
    const stats = Array?.from(this?.errorStats?.entries()).map(([key, value]) => ({
      error: key,
      count: value?.count,
      lastSeen: value?.lastSeen,
    }));

    const circuitBreakers = Array?.from(this?.circuitBreakers?.entries()).map(([service, breaker]) => ({
      service,
      failures: breaker?.failures,
      isOpen: breaker?.isOpen,
      lastFailure: breaker?.lastFailure,
    }));

    return {
      errorCounts: stats,
      circuitBreakers,
      totalErrors: Array?.from(this?.errorStats?.values()).reduce((sum, stat) => sum + stat?.count, 0),
    };
  }

  // Cleanup old error statistics;
  cleanupOldStats(maxAgeMs: number = 24 * 60 * 60 * 1000): void {
    const cutoff = new Date(Date?.now() - maxAgeMs);
    
    for (const [key, stat] of this?.errorStats?.entries()) {
      if (stat?.lastSeen < cutoff) {
        this?.errorStats?.delete(key);
      }
    }

    log?.info('Error statistics cleaned up', LogContext?.SYSTEM, {
      remaining: this?.errorStats?.size,
    });
  }
}

export default ErrorBoundaryManager;