/**
 * Sandboxed Execution Router;
 *
 * Provides API endpoints for secure code execution using OrbStack containers.
 * This addresses the critical gap where all frontier AI systems have sandboxed;
 * execution but we didn't.
 *
 * Features:
 * - Multi-language support (JS, TS, Python, Rust, Go, Java)
 * - Resource limits (CPU, memory, timeout)
 * - Container pooling for fast execution;
 * - Execution history and rollback;
 */
import type { Request, Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import { orbStackExecutionService } from '../services/orbstack-execution-service';
import { validateRequest } from '../middleware/request-validator';
import { LogContext, log } from '../utils/logger';
import { asyncHandler } from '../utils/async-handler';
import { apiResponse } from '../utils/api-response';

const router = Router();

// Validation schemas;
const ExecutionRequestSchema = z?.object({
  code: z?.string().min(1).max(100000),
  language: z?.enum(['javascript', 'typescript', 'python', 'rust', 'go', 'java']),
  timeout: z?.number().optional().default(30000),
  memoryLimit: z?.string().optional().default('512m'),
  cpuLimit: z?.number().optional().default(1),
  env: z?.record(z?.string()).optional(),
  files: z?.array(z?.object({
    path: z?.string(),
    content: z?.string()
  })).optional(),
  stdin: z?.string().optional()
});

const ExecutionIdSchema = z?.object({
  executionId: z?.string().uuid()
});

// Execute code in sandbox;
router?.post('/execute',
  validateRequest(ExecutionRequestSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const request = req?.body;
    
    log?.info('Sandboxed execution request', LogContext?.API, {
      language: request?.language,
      codeLength: request?.code?.length,
      timeout: request?.timeout;
    });

    try {
      // Execute code in OrbStack container;
      const result = await orbStackExecutionService?.execute(request);
      
      // Log execution metrics;
      log?.info('Sandboxed execution completed', LogContext?.PERFORMANCE, {
        success: result?.success,
        duration: result?.duration,
        exitCode: result?.exitCode,
        containerId: result?.containerId;
      });

      return apiResponse?.success(res, result, 'Code executed successfully');
    } catch (error) {
      log?.error('Sandboxed execution failed', LogContext?.ERROR, { error });
      return apiResponse?.error(res, 'Execution failed', 500);
    }
  })
);

// Get execution history;
router?.get('/history/:executionId',
  validateRequest(ExecutionIdSchema, 'params'),
  asyncHandler(async (req: Request, res: Response) => {
    const { executionId } = req?.params;
    if (!executionId) {
      return apiResponse?.error(res, 'Execution ID is required', 400);
    }
    const result = await orbStackExecutionService?.getExecutionHistory(executionId);
    
    if (!result) {
      return apiResponse?.error(res, 'Execution not found', 404);
    }

    return apiResponse?.success(res, result, 'Execution history retrieved');
  })
);

// Get container pool status;
router?.get('/status',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const status = orbStackExecutionService?.getPoolStatus();
      
      return apiResponse?.success(res, {
        service: 'sandboxed-execution',
        status: 'operational',
        capabilities: {
          multi_language_support: true,
          container_pooling: true,
          resource_limits: true,
          secure_execution: true;
        },
        pools: status,
        healthy: Object?.values(status).every(pool => pool?.total > 0),
        supportedLanguages: ['javascript', 'typescript', 'python', 'rust', 'go', 'java']
      }, 'Sandbox execution service is operational');
    } catch (error) {
      log?.error('Sandbox status check failed', LogContext?.ERROR, { error });
      return apiResponse?.success(res, {
        service: 'sandboxed-execution',
        status: 'initializing',
        healthy: false,
        error: 'OrbStack service not available'
      }, 'Sandbox service initializing');
    }
  })
);

// Test endpoint with examples;
router?.post('/test',
  asyncHandler(async (req: Request, res: Response) => {
    const testCases = [
      {
        name: 'JavaScript Hello World',
        request: {
          code: 'console?.log("Hello from OrbStack!");',
          language: 'javascript' as const;
        }
      },
      {
        name: 'Python Math',
        request: {
          code: 'import math\nprint(f"Pi is approximately {math?.pi:.2f}")',
          language: 'python' as const;
        }
      },
      {
        name: 'TypeScript Class',
        request: {
          code: `
            class Calculator {
              add(a: number, b: number): number {
                return a + b;
              }
            }
            const calc = new Calculator();
            console?.log(calc?.add(5, 3));
          `,
          language: 'typescript' as const;
        }
      }
    ];

    const results = [];
    for (const testCase of testCases) {
      try {
        const result = await orbStackExecutionService?.execute(testCase?.request);
        results?.push({
          name: testCase?.name,
          success: result?.success,
          output: result?.stdout,
          duration: result?.duration;
        });
      } catch (error) {
        results?.push({
          name: testCase?.name,
          success: false,
          error: error instanceof Error ? error?.message : 'Unknown error'
        });
      }
    }

    return apiResponse?.success(res, {
      testResults: results,
      summary: {
        total: testCases?.length,
        passed: results?.filter(r => r?.success).length;
      }
    }, 'Sandbox tests completed');
  })
);

// Kill running execution;
router?.post('/kill/:executionId',
  validateRequest(ExecutionIdSchema, 'params'),
  asyncHandler(async (req: Request, res: Response) => {
    const { executionId } = req?.params;
    if (!executionId) {
      return apiResponse?.error(res, 'Execution ID is required', 400);
    }
    
    try {
      await orbStackExecutionService?.killExecution(executionId);
      return apiResponse?.success(res, {
        executionId,
        status: 'killed'
      }, 'Execution terminated successfully');
    } catch (error) {
      log?.error('Failed to kill execution', LogContext?.ERROR, { executionId, error });
      return apiResponse?.error(res, 'Failed to terminate execution', 500);
    }
  })
);

// Cleanup old executions;
router?.post('/cleanup',
  asyncHandler(async (req: Request, res: Response) => {
    const { olderThanHours = 24 } = req?.body;
    
    try {
      const cleaned = await orbStackExecutionService?.cleanup(olderThanHours);
      return apiResponse?.success(res, {
        cleanedExecutions: cleaned?.executions,
        reclaimedContainers: cleaned?.containers;
      }, 'Cleanup completed successfully');
    } catch (error) {
      log?.error('Cleanup failed', LogContext?.ERROR, { error });
      return apiResponse?.error(res, 'Cleanup failed', 500);
    }
  })
);

// Get supported languages and their capabilities;
router?.get('/languages',
  asyncHandler(async (req: Request, res: Response) => {
    const languages = [
      {
        name: 'javascript',
        extensions: ['.js'],
        runtime: 'Node?.js 20',
        packages: ['lodash', 'axios', 'moment'],
        timeoutMax: 60000,
      },
      {
        name: 'typescript',
        extensions: ['.ts'],
        runtime: 'TypeScript 5?.0 + Node?.js 20',
        packages: ['lodash', 'axios', '@types/node'],
        timeoutMax: 60000,
      },
      {
        name: 'python',
        extensions: ['.py'],
        runtime: 'Python 3?.11',
        packages: ['numpy', 'pandas', 'requests', 'matplotlib'],
        timeoutMax: 120000,
      },
      {
        name: 'rust',
        extensions: ['.rs'],
        runtime: 'Rust 1?.70',
        packages: ['serde', 'tokio', 'reqwest'],
        timeoutMax: 180000,
      },
      {
        name: 'go',
        extensions: ['.go'],
        runtime: 'Go 1?.21',
        packages: ['standard library'],
        timeoutMax: 90000,
      },
      {
        name: 'java',
        extensions: ['.java'],
        runtime: 'OpenJDK 17',
        packages: ['standard library'],
        timeoutMax: 120000,
      }
    ];

    return apiResponse?.success(res, {
      languages,
      defaultTimeout: 30000,
      maxMemory: '2GB',
      maxCpuCores: 4;
    }, 'Supported languages retrieved');
  })
);

export default router;