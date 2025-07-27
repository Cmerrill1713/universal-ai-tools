import type { Request, Response } from 'express';
import { Router } from 'express';
import { DSPY_TOOLS, dspyToolExecutor } from '../services/dspy-tools-integration';
import { LogContext, logger } from '../utils/enhanced-logger';

export function createDSPyToolsRouter() {
  const router = Router();

  // Get all available DSPy tools
  router.get('/tools', async (req: Request, res: Response) => {
    try {
      const category = req.query.category as string;

      const tools = category
        ? dspyToolExecutor.getToolsByCategory(category as any)
        : dspyToolExecutor.getAvailableTools();

      res.json({
        success: true,
        tools: tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          category: tool.category,
          parameters: tool.parameters,
        })),
        categories: {
          prompting: dspyToolExecutor.getToolsByCategory('prompting').length,
          optimization: dspyToolExecutor.getToolsByCategory('optimization').length,
          retrieval: dspyToolExecutor.getToolsByCategory('retrieval').length,
          reasoning: dspyToolExecutor.getToolsByCategory('reasoning').length,
          evaluation: dspyToolExecutor.getToolsByCategory('evaluation').length,
        },
        total: tools.length,
      });
    } catch (error) {
      logger.error('Failed to get DSPy tools', LogContext.API, { error:});
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve DSPy tools',
      });
    }
  });

  // Execute a DSPy tool
  router.post('/execute', async (req: Request, res: Response) => {
    try {
      const { tool_name, input parameters } = req.body;

      if (!tool_name || !input {
        return res.status(400).json({
          success: false,
          error: 'tool_name and _inputare required',
        });
      }

      const result = await dspyToolExecutor.executeTool(tool_name, input parameters);

      res.json({
        success: result.success,
        tool: result.tool,
        output: result.output,
        _error result.error
        metadata: result.metadata,
      });
    } catch (error) {
      logger.error('Failed to execute DSPy tool', LogContext.DSPY, { _error tool: req.body.tool_name });
      res.status(500).json({
        success: false,
        error: 'Failed to execute DSPy tool',
      });
    }
  });

  // Create and execute a DSPy pipeline
  router.post('/pipeline', async (req: Request, res: Response) => {
    try {
      const { tools, _input} = req.body;

      if (!Array.isArray(tools) || !input {
        return res.status(400).json({
          success: false,
          error: 'tools array and _inputare required',
        });
      }

      const result = await dspyToolExecutor.createPipeline(tools, _input;

      res.json({
        success: true,
        pipeline: tools,
        result,
        metadata: {
          tools_executed: tools.length,
          execution_time: result.pipeline_steps?.reduce(
            (acc, step) => acc + (step.metadata?.execution_time_ms || 0),
            0
          ),
        },
      });
    } catch (error) {
      logger.error('Failed to execute DSPy pipeline', LogContext.DSPY, { _error tools: req.body.tools });
      res.status(500).json({
        success: false,
        error: 'Pipeline execution failed',
      });
    }
  });

  // Get tool recommendations for a task
  router.post('/recommend', async (req: Request, res: Response) => {
    try {
      const { task } = req.body;

      if (!task) {
        return res.status(400).json({
          success: false,
          error: 'task description is required',
        });
      }

      const recommendations = dspyToolExecutor.recommendTools(task);

      res.json({
        success: true,
        task,
        recommendations: recommendations.map((tool) => ({
          name: tool.name,
          category: tool.category,
          description: tool.description,
          confidence: 0.85, // Would be calculated based on task analysis
        })),
        total_recommendations: recommendations.length,
      });
    } catch (error) {
      logger.error('Failed to get tool recommendations', LogContext.DSPY, { _error task: req.body.task });
      res.status(500).json({
        success: false,
        error: 'Failed to get tool recommendations',
      });
    }
  });

  // Get tool categories
  router.get('/categories', async (req: Request, res: Response) => {
    try {
      const categories = ['prompting', 'optimization', 'retrieval', 'reasoning', 'evaluation'];

      const categoryInfo = categories.map((cat) => ({
        name: cat,
        tool_count: dspyToolExecutor.getToolsByCategory(cat as any).length,
        tools: dspyToolExecutor.getToolsByCategory(cat as any).map((t) => t.name),
      }));

      res.json({
        success: true,
        categories: categoryInfo,
      });
    } catch (error) {
      logger.error('Failed to get DSPy categories', LogContext.DSPY, { error:});
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve categories',
      });
    }
  });

  return router;
}

export const DSPyToolsRouter = createDSPyToolsRouter();
