/**
 * HRM Sapient Agent
 * Integrates Sapient's Hierarchical Reasoning Model with Universal AI Tools
 * Provides advanced hierarchical reasoning for complex problem solving
 */

import { EnhancedBaseAgent } from '../enhanced-base-agent';
import type { AgentConfig, AgentContext, AgentResponse } from '@/types';
import { LogContext, log } from '@/utils/logger';
import { hrmSapientService, type HRMPuzzle, type HRMReasoningRequest } from '@/services/hrm-sapient-service';
import { z } from 'zod';

// HRM Agent response schema
const HRMAgentResponseSchema = z.object({
  reasoning_type: z.enum(['arc', 'sudoku', 'maze', 'general']),
  solution: z.any(),
  hierarchical_reasoning: z.object({
    high_level_insights: z.array(z.string()),
    low_level_details: z.array(z.string()),
    reasoning_cycles: z.number(),
    confidence_score: z.number().min(0).max(1),
  }),
  execution_time: z.number(),
  model_info: z.object({
    backend: z.string(),
    checkpoint: z.string().optional(),
    device: z.string(),
  }),
});

export type HRMAgentResponse = z.infer<typeof HRMAgentResponseSchema>;

export class HRMSapientAgent extends EnhancedBaseAgent {
  private checkpointPath?: string;

  protected buildSystemPrompt(): string {
    return `You are the HRM (Hierarchical Reasoning Model) Agent, powered by Sapient's advanced neural architecture.

Your capabilities:
1. **Hierarchical Reasoning**: Multi-level cognitive processing from abstract to concrete
2. **Complex Problem Solving**: Solve ARC puzzles, Sudoku, mazes, and general reasoning tasks
3. **Pattern Recognition**: Identify and apply complex patterns across domains
4. **Recursive Decomposition**: Break down problems into hierarchical sub-problems
5. **Neural Architecture**: Leverage high-level and low-level reasoning modules

You excel at:
- Abstract Reasoning Corpus (ARC) puzzles
- Complex Sudoku solving (including extreme difficulty)
- Pathfinding in mazes
- General hierarchical problem decomposition
- Pattern completion and transformation tasks

When given a task, determine if it can be formulated as a puzzle for HRM processing.
Structure your response with clear hierarchical reasoning levels.`;
  }

  protected getInternalModelName(): string {
    return 'hrm-sapient';
  }

  protected async onInitialize(): Promise<void> {
    // Check if a specific checkpoint is configured
    const checkpoints = {
      'arc-2': 'https://huggingface.co/sapientinc/HRM-checkpoint-ARC-2',
      'sudoku': 'https://huggingface.co/sapientinc/HRM-checkpoint-sudoku-extreme',
      'maze': 'https://huggingface.co/sapientinc/HRM-checkpoint-maze-30x30-hard',
    };

    // For now, we'll use the local untrained model
    // In production, you would download and use the checkpoints
    log.info('🧠 HRM Agent initialized with Sapient backend', LogContext.AGENT);
  }

  private convertToPuzzle(context: AgentContext): HRMPuzzle {
    // Analyze the request to determine puzzle type
    const request = context.userRequest.toLowerCase();
    
    let puzzleType: 'arc' | 'sudoku' | 'maze' | 'general' = 'general';
    
    if (request.includes('arc') || request.includes('pattern') || request.includes('grid')) {
      puzzleType = 'arc';
    } else if (request.includes('sudoku')) {
      puzzleType = 'sudoku';
    } else if (request.includes('maze') || request.includes('path')) {
      puzzleType = 'maze';
    }

    // Extract puzzle data from context
    const puzzleData = context.taskContext?.puzzle || context.sessionData?.puzzle || {
      description: context.userRequest,
      constraints: [],
    };

    return {
      type: puzzleType,
      input: puzzleData,
      constraints: puzzleData.constraints || [],
    };
  }

  protected async performTask(context: AgentContext): Promise<AgentResponse> {
    try {
      // Convert user request to HRM puzzle format
      const puzzle = this.convertToPuzzle(context);
      
      // Create reasoning request
      const reasoningRequest: HRMReasoningRequest = {
        puzzle,
        maxCycles: context.taskContext?.maxCycles || 8,
        temperature: context.taskContext?.temperature || 0.7,
        hierarchicalDepth: context.taskContext?.hierarchicalDepth || 4,
      };

      log.info('🧠 Running HRM hierarchical reasoning', LogContext.AGENT, {
        puzzleType: puzzle.type,
        requestId: context.requestId,)
      });

      // Execute hierarchical reasoning
      const startTime = Date.now();
      const result = await hrmSapientService.runReasoning(reasoningRequest);
      const executionTime = Date.now() - startTime;

      if (!result.success) {
        throw new Error(result.error || 'HRM reasoning failed');
      }

      // Get service status
      const status = hrmSapientService.getStatus();

      // Structure the response
      const hrmResponse: HRMAgentResponse = {
        reasoning_type: puzzle.type,
        solution: result.solution,
        hierarchical_reasoning: {
          high_level_insights: result.reasoning?.highLevel || ['High-level analysis completed'],
          low_level_details: result.reasoning?.lowLevel || ['Detailed computation performed'],
          reasoning_cycles: result.reasoning?.cycles || 1,
          confidence_score: result.reasoning?.confidence || 0.7,
        },
        execution_time: executionTime,
        model_info: {
          backend: 'sapient-hrm',
          checkpoint: this.checkpointPath,
          device: status.device || 'mps',
        },
      };

      return {
        success: true,
        data: hrmResponse,
        message: this.formatSolution(hrmResponse),
        metadata: {
          agentName: this.config.name,
          agentVersion: '1.0.0',
          confidence: hrmResponse.hierarchical_reasoning.confidence_score',
          processingTime: executionTime,
          reasoningCycles: hrmResponse.hierarchical_reasoning.reasoning_cycles,
        },
      };
    } catch (error) {
      log.error('❌ HRM reasoning failed', LogContext.AGENT, {
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error in HRM processing',
        message: 'Failed to complete hierarchical reasoning',
        metadata: {
          agentName: this.config.name,
          agentVersion: '1.0.0',
        },
      };
    }
  }

  private formatSolution(response: HRMAgentResponse): string {
    const insights = response.hierarchical_reasoning.high_level_insights.join('\n- ');
    const details = response.hierarchical_reasoning.low_level_details.join('\n- ');
    
    return `Hierarchical Reasoning Complete (${response.reasoning_type}):

High-Level Insights:
- ${insights}

Low-Level Analysis:
- ${details}

Solution: ${JSON.stringify(response.solution, null, 2)}

Confidence: ${(response.hierarchical_reasoning.confidence_score * 100).toFixed(1)}%
Reasoning Cycles: ${response.hierarchical_reasoning.reasoning_cycles}
Execution Time: ${response.execution_time}ms`;
  }

  /**
   * Solve an ARC puzzle
   */
  public async solveARCPuzzle(puzzle: any): Promise<any> {
    const context: AgentContext = {
      userRequest: 'Solve this ARC puzzle using hierarchical reasoning',
      requestId: `hrm-arc-${Date.now()}`,
      userId: 'system',
      conversationId: `hrm-conv-${Date.now()}`,
      sessionData: { puzzle },
      taskContext: { puzzleType: 'arc' },
    };

    const response = await this.performTask(context);
    return response.data;
  }

  /**
   * Solve a Sudoku puzzle
   */
  public async solveSudoku(grid: number[][]): Promise<number[][] | null> {
    const context: AgentContext = {
      userRequest: 'Solve this Sudoku puzzle',
      requestId: `hrm-sudoku-${Date.now()}`,
      userId: 'system',
      conversationId: `hrm-conv-${Date.now()}`,
      sessionData: { 
        puzzle: {
          type: 'sudoku',
          grid: grid,
        }
      },
    };

    const response = await this.performTask(context);
    if (response.success && response.data?.solution) {
      return response.data.solution as number[][];
    }
    return null;
  }

  /**
   * Find optimal path in a maze
   */
  public async solveMaze(maze: any, start: [number, number], end: [number, number]): Promise<any> {
    const context: AgentContext = {
      userRequest: 'Find the optimal path through this maze',
      requestId: `hrm-maze-${Date.now()}`,
      userId: 'system',
      conversationId: `hrm-conv-${Date.now()}`,
      sessionData: { 
        puzzle: {
          type: 'maze',
          maze: maze,
          start: start,
          end: end,
        }
      },
    };

    const response = await this.performTask(context);
    return response.data;
  }

  /**
   * Load a specific checkpoint for specialized reasoning
   */
  public async loadCheckpoint(checkpointType: 'arc-2' | 'sudoku' | 'maze'): Promise<void> {
    // In a real implementation, you would download the checkpoint
    // For now, we'll just store the reference
    this.checkpointPath = checkpointType;
    log.info(`🧠 HRM Agent configured for ${checkpointType)} checkpoint`, LogContext.AGENT);
  }
}

// Export factory function for agent registry
export function createHRMSapientAgent(config: AgentConfig): HRMSapientAgent {
  return new HRMSapientAgent(config);
}