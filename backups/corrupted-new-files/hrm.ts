/**
 * HRM (Hierarchical Reasoning Model) Router
 * API endpoints for Sapient's HRM integration
 */

import { Router } from 'express';
import { z } from 'zod';
import { validateRequest } from '@/middleware/validation';
import { authenticateRequest } from '@/middleware/auth';
import { intelligentParametersMiddleware } from '@/middleware/intelligent-parameters';
import { agentRegistry } from '@/agents/agent-registry';
import type { HRMSapientAgent } from '@/agents/cognitive/hrm-sapient-agent';
import { hrmSapientService } from '@/services/hrm-sapient-service';
import { log, LogContext } from '@/utils/logger';
import { asyncHandler } from '@/utils/async-handler';
import { createSuccessResponse, createErrorResponse } from '@/utils/api-response';

const router = Router();

// Schema for HRM reasoning request
const HRMReasoningSchema = z.object({
  puzzle: z.object({
    type: z.enum(['arc', 'sudoku', 'maze', 'general']),
    input: z.any(),
    expectedOutput: z.any().optional(),
    constraints: z.array(z.string()).optional(),
  }),
  maxCycles: z.number().optional().default(8),
  temperature: z.number().optional().default(0.7),
  hierarchicalDepth: z.number().optional().default(4),
});

// Schema for Sudoku solving
const SudokuSchema = z.object({
  grid: z.array(z.array(z.number().min(0).max(9))).length(9),
});

// Schema for maze solving
const MazeSchema = z.object({
  maze: z.array(z.array(z.any())),
  start: z.tuple([z.number(), z.number()]),
  end: z.tuple([z.number(), z.number()]),
});

/**
 * GET /api/v1/hrm/status
 * Get HRM service status
 */
router.get(
  '/status',
  authenticateRequest,
  asyncHandler(async (req, res) => {
    const status = hrmSapientService.getStatus();
    const serviceHealth = status.initialized ? 'healthy' : 'initializing';

    res.json(
      createSuccessResponse({
        status: serviceHealth,
        service: 'hrm-sapient',
        details: status,))
      })
    );
  })
);

/**
 * POST /api/v1/hrm/reason
 * Run hierarchical reasoning on a puzzle
 */
router.post(
  '/reason',
  authenticateRequest,
  intelligentParametersMiddleware,
  validateRequest(HRMReasoningSchema),
  asyncHandler(async (req, res) => {
    const { puzzle, maxCycles, temperature, hierarchicalDepth } = req.body;

    log.info('🧠 HRM reasoning request', LogContext.API, {
      puzzleType: puzzle.type,
      userId: req.userId,)
    });

    try {
      const result = await hrmSapientService.runReasoning({
        puzzle,
        maxCycles,
        temperature,
        hierarchicalDepth,)
      });

      if (result.success) {
        res.json(
          createSuccessResponse({
            solution: result.solution,
            reasoning: result.reasoning,
            executionTime: result.executionTime,))
          })
        );
      } else {
        res.status(400).json(
          createErrorResponse(result.error || 'Reasoning failed', 'HRM_REASONING_FAILED')
        );
      }
    } catch (error) {
      log.error('❌ HRM reasoning error', LogContext.API, {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json(
        createErrorResponse('Internal server error', 'HRM_ERROR')
      );
    }
  })
);

/**
 * POST /api/v1/hrm/solve/sudoku
 * Solve a Sudoku puzzle using HRM
 */
router.post(
  '/solve/sudoku',
  authenticateRequest,
  intelligentParametersMiddleware,
  validateRequest(SudokuSchema),
  asyncHandler(async (req, res) => {
    const { grid } = req.body;

    try {
      const agent = await agentRegistry.getAgent('hrm') as HRMSapientAgent;
      if (!agent) {
        return res.status(503).json(
          createErrorResponse('HRM agent not available', 'AGENT_UNAVAILABLE')
        );
      }

      const solution = await agent.solveSudoku(grid);
      
      if (solution) {
        res.json(
          createSuccessResponse({
            solution,
            type: 'sudoku',
            solved: true,))
          })
        );
      } else {
        res.status(400).json(
          createErrorResponse('Unable to solve Sudoku puzzle', 'SUDOKU_UNSOLVABLE')
        );
      }
    } catch (error) {
      log.error('❌ Sudoku solving error', LogContext.API, {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json(
        createErrorResponse('Failed to solve Sudoku', 'SUDOKU_ERROR')
      );
    }
  })
);

/**
 * POST /api/v1/hrm/solve/maze
 * Find optimal path through a maze using HRM
 */
router.post(
  '/solve/maze',
  authenticateRequest,
  intelligentParametersMiddleware,
  validateRequest(MazeSchema),
  asyncHandler(async (req, res) => {
    const { maze, start, end } = req.body;

    try {
      const agent = await agentRegistry.getAgent('hrm') as HRMSapientAgent;
      if (!agent) {
        return res.status(503).json(
          createErrorResponse('HRM agent not available', 'AGENT_UNAVAILABLE')
        );
      }

      const result = await agent.solveMaze(maze, start, end);
      
      res.json(
        createSuccessResponse({
          result,
          type: 'maze',
          start,
          end,))
        })
      );
    } catch (error) {
      log.error('❌ Maze solving error', LogContext.API, {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json(
        createErrorResponse('Failed to solve maze', 'MAZE_ERROR')
      );
    }
  })
);

/**
 * POST /api/v1/hrm/solve/arc
 * Solve an ARC (Abstraction and Reasoning Corpus) puzzle
 */
router.post(
  '/solve/arc',
  authenticateRequest,
  intelligentParametersMiddleware,
  asyncHandler(async (req, res) => {
    const { puzzle } = req.body;

    try {
      const agent = await agentRegistry.getAgent('hrm') as HRMSapientAgent;
      if (!agent) {
        return res.status(503).json(
          createErrorResponse('HRM agent not available', 'AGENT_UNAVAILABLE')
        );
      }

      const solution = await agent.solveARCPuzzle(puzzle);
      
      res.json(
        createSuccessResponse({
          solution,
          type: 'arc',))
        })
      );
    } catch (error) {
      log.error('❌ ARC solving error', LogContext.API, {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json(
        createErrorResponse('Failed to solve ARC puzzle', 'ARC_ERROR')
      );
    }
  })
);

/**
 * POST /api/v1/hrm/load-checkpoint
 * Load a specific HRM checkpoint
 */
router.post(
  '/load-checkpoint',
  authenticateRequest,
  asyncHandler(async (req, res) => {
    const { checkpointType } = req.body;

    if (!['arc-2', 'sudoku', 'maze'].includes(checkpointType)) {
      return res.status(400).json(
        createErrorResponse('Invalid checkpoint type', 'INVALID_CHECKPOINT')
      );
    }

    try {
      const agent = await agentRegistry.getAgent('hrm') as HRMSapientAgent;
      if (!agent) {
        return res.status(503).json(
          createErrorResponse('HRM agent not available', 'AGENT_UNAVAILABLE')
        );
      }

      await agent.loadCheckpoint(checkpointType);
      
      res.json(
        createSuccessResponse({
          message: `Checkpoint ${checkpointType))} loaded successfully`,
          checkpointType,
        })
      );
    } catch (error) {
      log.error('❌ Checkpoint loading error', LogContext.API, {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json(
        createErrorResponse('Failed to load checkpoint', 'CHECKPOINT_ERROR')
      );
    }
  })
);

export default router;