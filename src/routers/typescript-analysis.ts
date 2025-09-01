/**
 * TypeScript Analysis Router
 * Provides API endpoints for TypeScript code analysis using parallel agents
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import AgentRegistry from '../agents/agent-registry';
import { LogContext, log } from '../utils/logger';
import type { AgentContext } from '../types';
import { sendSuccess, sendError } from '../utils/api-response';
import { createRateLimiter } from '../middleware/rate-limiter-enhanced';
import { authenticate } from '../middleware/auth';

const router = Router();
const agentRegistry = new AgentRegistry();

// Request schemas
const analyzeCodeSchema = z.object({
  code: z.string().min(1).max(100000), // Max 100KB of code
  filename: z.string().optional(),
  analysisType: z.enum(['context', 'syntax', 'both']).default('both'),
  options: z.object({
    includeFixSuggestions: z.boolean().default(true),
    depth: z.enum(['shallow', 'normal', 'deep']).default('normal'),
  }).optional(),
});

const batchAnalyzeSchema = z.object({
  files: z.array(z.object({
    filename: z.string(),
    code: z.string().min(1).max(100000),
  })).min(1).max(10), // Max 10 files
  analysisType: z.enum(['context', 'syntax', 'both']).default('both'),
});

/**
 * POST /api/v1/typescript/analyze-context
 * Analyze TypeScript code for context, structure, and dependencies
 */
router.post(
  '/analyze-context',
  // authenticate, // Temporarily disabled for development
  createRateLimiter({ maxRequests: 30, windowMs: 60000 }),
  async (req: Request, res: Response) => {
    try {
      const { code, filename, options } = analyzeCodeSchema.parse(req.body);
      const requestId = `ts-context-${Date.now()}`;

      log.info('📝 TypeScript context analysis requested', LogContext.API, {
        requestId,
        filename,
        codeLength: code.length,
      });

      const contextAgent = await agentRegistry.getAgent('enhanced-context-agent');
      if (!contextAgent) {
        return sendError(res, 'INTERNAL_ERROR', 'Context agent not available', 500);
      }

      const context: AgentContext = {
        userRequest: 'Analyze TypeScript code structure and context',
        requestId,
        metadata: {
          taskType: 'code_analysis',
          language: 'typescript',
          filename: filename || 'unknown.ts',
          codeLength: code.length,
          depth: options?.depth || 'normal',
        },
      };

      const result = await contextAgent.execute(context);

      if (!result.success) {
        return sendError(res, 'INTERNAL_SERVER_ERROR', (result as any).error || 'Analysis failed', 500);
      }

      // Parse the agent's response
      let analysisData;
      try {
        analysisData = typeof result.data === 'string' ? JSON.parse(result.data) : result.data;
      } catch {
        analysisData = { raw: result.data };
      }

      return sendSuccess(res, {
        requestId,
        analysis: analysisData,
        confidence: result.confidence,
        executionTime: (result as any).executionTime || 0,
      });
    } catch (error) {
      log.error('TypeScript context analysis error', LogContext.API, { error });
      
      if (error instanceof z.ZodError) {
        return sendError(res, 'VALIDATION_ERROR', 'Invalid request data', 400);
      }
      
      return sendError(res, 'INTERNAL_ERROR', 'Context analysis failed', 500);
    }
  }
);

/**
 * POST /api/v1/typescript/validate-syntax
 * Validate TypeScript syntax and detect errors
 */
router.post(
  '/validate-syntax',
  // authenticate, // Temporarily disabled for development
  createRateLimiter({ maxRequests: 30, windowMs: 60000 }),
  async (req: Request, res: Response) => {
    try {
      const { code, filename, options } = analyzeCodeSchema.parse(req.body);
      const requestId = `ts-syntax-${Date.now()}`;

      log.info('🔍 TypeScript syntax validation requested', LogContext.API, {
        requestId,
        filename,
        codeLength: code.length,
      });

      const syntaxAgent = await agentRegistry.getAgent('enhanced-syntax-agent');
      if (!syntaxAgent) {
        return sendError(res, 'INTERNAL_ERROR', 'Syntax agent not available', 500);
      }

      const context: AgentContext = {
        userRequest: 'Validate TypeScript syntax and detect errors',
        requestId,
        metadata: {
          taskType: 'syntax_validation',
          language: 'typescript',
          filename: filename || 'unknown.ts',
          codeLength: code.length,
          includeFixSuggestions: options?.includeFixSuggestions ?? true,
        },
      };

      const result = await syntaxAgent.execute(context);

      if (!result.success) {
        return sendError(res, 'INTERNAL_ERROR', (result as any).error || 'Validation failed', 500);
      }

      // Parse the agent's response
      let validationData;
      try {
        validationData = typeof result.data === 'string' ? JSON.parse(result.data) : result.data;
      } catch {
        validationData = { raw: result.data };
      }

      return sendSuccess(res, {
        requestId,
        validation: validationData,
        confidence: result.confidence,
        executionTime: (result as any).executionTime || 0,
      });
    } catch (error) {
      log.error('TypeScript syntax validation error', LogContext.API, { error });
      
      if (error instanceof z.ZodError) {
        return sendError(res, 'VALIDATION_ERROR', 'Invalid request data', 400);
      }
      
      return sendError(res, 'INTERNAL_ERROR', 'Syntax validation failed', 500);
    }
  }
);

/**
 * POST /api/v1/typescript/parallel-analysis
 * Run both context and syntax analysis in parallel
 */
router.post(
  '/parallel-analysis',
  // authenticate, // Temporarily disabled for development
  createRateLimiter({ maxRequests: 20, windowMs: 60000 }),
  async (req: Request, res: Response) => {
    try {
      const { code, filename, options } = analyzeCodeSchema.parse(req.body);
      const requestId = `ts-parallel-${Date.now()}`;

      log.info('🔄 TypeScript parallel analysis requested', LogContext.API, {
        requestId,
        filename,
        codeLength: code.length,
      });

      // Load both agents
      const [contextAgent, syntaxAgent] = await Promise.all([
        agentRegistry.getAgent('enhanced-context-agent'),
        agentRegistry.getAgent('enhanced-syntax-agent'),
      ]);

      if (!contextAgent || !syntaxAgent) {
        return sendError(res, 'INTERNAL_ERROR', 'Required agents not available', 500);
      }

      // Create contexts for both agents
      const baseContext = {
        userRequest: 'Analyze TypeScript code',
        requestId,
        metadata: {
          language: 'typescript',
          filename: filename || 'unknown.ts',
          codeLength: code.length,
        },
      };

      const contextAnalysisContext: AgentContext = {
        ...baseContext,
        metadata: {
          ...baseContext.metadata,
          taskType: 'code_analysis',
          depth: options?.depth || 'normal',
        },
      };

      const syntaxValidationContext: AgentContext = {
        ...baseContext,
        metadata: {
          ...baseContext.metadata,
          taskType: 'syntax_validation',
          includeFixSuggestions: options?.includeFixSuggestions ?? true,
        },
      };

      // Execute both agents in parallel
      const startTime = Date.now();
      const [contextResult, syntaxResult] = await Promise.all([
        contextAgent.execute(contextAnalysisContext),
        syntaxAgent.execute(syntaxValidationContext),
      ]);
      const totalExecutionTime = Date.now() - startTime;

      // Process results
      const results: any = {
        requestId,
        executionTime: totalExecutionTime,
        parallel: true,
      };

      // Process context analysis result
      if (contextResult.success) {
        try {
          results.contextAnalysis = typeof contextResult.data === 'string' 
            ? JSON.parse(contextResult.data) 
            : contextResult.data;
          results.contextConfidence = contextResult.confidence;
        } catch {
          results.contextAnalysis = { raw: contextResult.data };
        }
      } else {
        results.contextAnalysis = { error: (contextResult as any).error || 'Context analysis failed' };
      }

      // Process syntax validation result
      if (syntaxResult.success) {
        try {
          results.syntaxValidation = typeof syntaxResult.data === 'string'
            ? JSON.parse(syntaxResult.data)
            : syntaxResult.data;
          results.syntaxConfidence = syntaxResult.confidence;
        } catch {
          results.syntaxValidation = { raw: syntaxResult.data };
        }
      } else {
        results.syntaxValidation = { error: (syntaxResult as any).error || 'Syntax validation failed' };
      }

      // Determine overall success
      results.overallSuccess = contextResult.success && syntaxResult.success;
      results.averageConfidence = (
        (contextResult.confidence || 0) + (syntaxResult.confidence || 0)
      ) / 2;

      log.info('✅ TypeScript parallel analysis completed', LogContext.API, {
        requestId,
        executionTime: totalExecutionTime,
        contextSuccess: contextResult.success,
        syntaxSuccess: syntaxResult.success,
      });

      return sendSuccess(res, results);
    } catch (error) {
      log.error('TypeScript parallel analysis error', LogContext.API, { error });
      
      if (error instanceof z.ZodError) {
        return sendError(res, 'VALIDATION_ERROR', 'Invalid request data', 400);
      }
      
      return sendError(res, 'INTERNAL_ERROR', 'Parallel analysis failed', 500);
    }
  }
);

/**
 * POST /api/v1/typescript/batch-analyze
 * Analyze multiple TypeScript files
 */
router.post(
  '/batch-analyze',
  // authenticate, // Temporarily disabled for development
  createRateLimiter({ maxRequests: 10, windowMs: 60000 }),
  async (req: Request, res: Response) => {
    try {
      const { files, analysisType } = batchAnalyzeSchema.parse(req.body);
      const requestId = `ts-batch-${Date.now()}`;

      log.info('📦 TypeScript batch analysis requested', LogContext.API, {
        requestId,
        fileCount: files.length,
        analysisType,
      });

      // Determine which agents to use
      const useContext = analysisType === 'context' || analysisType === 'both';
      const useSyntax = analysisType === 'syntax' || analysisType === 'both';

      // Load required agents
      const agents: any = {};
      if (useContext) {
        agents.context = await agentRegistry.getAgent('enhanced-context-agent');
        if (!agents.context) {
          return sendError(res, 'INTERNAL_ERROR', 'Context agent not available', 500);
        }
      }
      if (useSyntax) {
        agents.syntax = await agentRegistry.getAgent('enhanced-syntax-agent');
        if (!agents.syntax) {
          return sendError(res, 'INTERNAL_ERROR', 'Syntax agent not available', 500);
        }
      }

      // Process each file
      const startTime = Date.now();
      const fileResults = await Promise.all(
        files.map(async (file) => {
          const fileRequestId = `${requestId}-${file.filename}`;
          const baseContext = {
            userRequest: 'Analyze TypeScript code',
            requestId: fileRequestId,
            metadata: {
              language: 'typescript',
              filename: file.filename,
              codeLength: file.code.length,
            },
          };

          const tasks = [];
          
          if (useContext) {
            tasks.push(
              agents.context.execute({
                ...baseContext,
                metadata: { ...baseContext.metadata, taskType: 'code_analysis' },
              })
            );
          }
          
          if (useSyntax) {
            tasks.push(
              agents.syntax.execute({
                ...baseContext,
                metadata: { ...baseContext.metadata, taskType: 'syntax_validation' },
              })
            );
          }

          const results = await Promise.all(tasks);
          
          const fileResult: any = {
            filename: file.filename,
            requestId: fileRequestId,
          };

          if (useContext) {
            const contextResult = results[0];
            if (contextResult.success) {
              try {
                fileResult.contextAnalysis = typeof contextResult.data === 'string'
                  ? JSON.parse(contextResult.data)
                  : contextResult.data;
              } catch {
                fileResult.contextAnalysis = { raw: contextResult.data };
              }
            } else {
              fileResult.contextAnalysis = { error: contextResult.error };
            }
          }

          if (useSyntax) {
            const syntaxResult = results[useContext ? 1 : 0];
            if (syntaxResult.success) {
              try {
                fileResult.syntaxValidation = typeof syntaxResult.data === 'string'
                  ? JSON.parse(syntaxResult.data)
                  : syntaxResult.data;
              } catch {
                fileResult.syntaxValidation = { raw: syntaxResult.data };
              }
            } else {
              fileResult.syntaxValidation = { error: syntaxResult.error };
            }
          }

          return fileResult;
        })
      );

      const totalExecutionTime = Date.now() - startTime;

      log.info('✅ TypeScript batch analysis completed', LogContext.API, {
        requestId,
        executionTime: totalExecutionTime,
        filesProcessed: files.length,
      });

      return sendSuccess(res, {
        requestId,
        analysisType,
        executionTime: totalExecutionTime,
        filesProcessed: files.length,
        results: fileResults,
      });
    } catch (error) {
      log.error('TypeScript batch analysis error', LogContext.API, { error });
      
      if (error instanceof z.ZodError) {
        return sendError(res, 'VALIDATION_ERROR', 'Invalid request data', 400);
      }
      
      return sendError(res, 'INTERNAL_ERROR', 'Batch analysis failed', 500);
    }
  }
);

/**
 * GET /api/v1/typescript/health
 * Check the health status of TypeScript analysis agents
 */
router.get(
  '/health',
  async (_req: Request, res: Response) => {
    try {
      const [contextAgent, syntaxAgent] = await Promise.all([
        agentRegistry.getAgent('enhanced-context-agent'),
        agentRegistry.getAgent('enhanced-syntax-agent'),
      ]);

      const health = {
        status: 'healthy',
        agents: {
          context: contextAgent ? 'available' : 'unavailable',
          syntax: syntaxAgent ? 'available' : 'unavailable',
        },
        timestamp: new Date().toISOString(),
      };

      if (!contextAgent || !syntaxAgent) {
        health.status = 'degraded';
      }

      return sendSuccess(res, health);
    } catch (error) {
      log.error('TypeScript health check error', LogContext.API, { error });
      return sendError(res, 'INTERNAL_ERROR', 'Health check failed', 500);
    }
  }
);

export default router;