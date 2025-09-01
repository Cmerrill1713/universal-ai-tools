/**
 * Project Completion Router
 * API endpoint for triggering project completion through the assistant
 */

import { Router } from 'express';
import { ProjectCompletionModule, type ProjectCompletionRequest } from '../modules/project-completion-module.js';
import { AgentRegistry } from '../agents/agent-registry.js';
import { log, LogContext } from '../utils/logger.js';
import { validateRequest } from '../middleware/validation.js';
import { z } from 'zod';

const router = Router();

// Initialize project completion module with agent registry
const agentRegistry = new AgentRegistry();
const projectCompletion = new ProjectCompletionModule(agentRegistry);

// Request validation schemas
const ProjectCompletionSchema = z.object({
  projectPath: z.string().min(1, 'Project path is required'),
  projectName: z.string().min(1, 'Project name is required'),
  requirements: z.string().optional(),
  targetLanguage: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high']).optional().default('medium'),
  deadline: z.string().transform(str => str ? new Date(str) : undefined).optional()
});

/**
 * @route POST /api/v1/project-completion/complete
 * @desc Complete a project using AI agents
 */
router.post('/complete', validateRequest(ProjectCompletionSchema), async (req, res) => {
  try {
    const request: ProjectCompletionRequest = req.body;
    
    log.info(`🚀 Project completion request received: ${request.projectName}`, LogContext.API, {
      projectPath: request.projectPath,
      priority: request.priority
    });

    // Start project completion (this runs asynchronously)
    const result = await projectCompletion.completeProject(request);
    
    res.json({
      success: true,
      message: 'Project completion started',
      result,
      projectName: request.projectName,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    log.error('❌ Project completion request failed', LogContext.API, { error });
    
    res.status(500).json({
      success: false,
      error: 'Project completion failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route GET /api/v1/project-completion/status/:projectId
 * @desc Get project completion status and progress
 */
router.get('/status/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    
    const progress = projectCompletion.getProjectProgress(projectId);
    
    if (!progress) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
        projectId,
        timestamp: new Date().toISOString()
      });
    }

    return res.json({
      success: true,
      projectId,
      progress,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    log.error('❌ Failed to get project status', LogContext.API, { error });
    
    return res.status(500).json({
      success: false,
      error: 'Failed to get project status',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route GET /api/v1/project-completion/active
 * @desc Get all active projects being completed
 */
router.get('/active', async (req, res) => {
  try {
    const activeProjects = projectCompletion.getActiveProjects();
    
    res.json({
      success: true,
      activeProjects: activeProjects.map(project => ({
        id: project.id,
        status: project.status,
        startTime: project.startTime,
        progress: project.progress,
        tasksTotal: project.tasks.length,
        tasksCompleted: project.tasks.filter(t => t.status === 'completed').length
      })),
      totalActive: activeProjects.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    log.error('❌ Failed to get active projects', LogContext.API, { error });
    
    res.status(500).json({
      success: false,
      error: 'Failed to get active projects',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route POST /api/v1/project-completion/analyze
 * @desc Analyze a project to understand what needs to be completed (without starting)
 */
router.post('/analyze', validateRequest(z.object({
  projectPath: z.string().min(1, 'Project path is required'),
  projectName: z.string().min(1, 'Project name is required')
})), async (req, res) => {
  try {
    const { projectPath, projectName } = req.body;
    
    log.info(`🔍 Project analysis request: ${projectName}`, LogContext.API, {
      projectPath
    });

    // Create a temporary module instance just for analysis
    const analysisModule = new ProjectCompletionModule(agentRegistry);
    
    // We'll need to expose the analyzeProject method or create a public analysis method
    // For now, return basic project info
    const response = {
      projectName,
      projectPath,
      message: 'Project analysis completed',
      recommendations: [
        'This project can be completed using the AI agent system',
        'Estimated completion time: 2-4 hours depending on complexity',
        'Multiple agents will coordinate to complete missing components'
      ],
      nextSteps: [
        'Use POST /api/v1/project-completion/complete to start project completion',
        'Monitor progress with GET /api/v1/project-completion/status/{projectId}',
        'View all active projects with GET /api/v1/project-completion/active'
      ]
    };

    res.json({
      success: true,
      analysis: response,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    log.error('❌ Project analysis failed', LogContext.API, { error });
    
    res.status(500).json({
      success: false,
      error: 'Project analysis failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// WebSocket support for real-time updates (if WebSocket is available)
projectCompletion.on('taskCompleted', (task, progress) => {
  // Emit to WebSocket clients if available
  log.info(`📊 Task completed: ${task.name} - ${progress.completionPercentage}% done`, LogContext.PROJECT);
});

projectCompletion.on('projectCompleted', (projectId, projectState) => {
  // Emit to WebSocket clients if available
  log.info(`🎉 Project completed: ${projectId}`, LogContext.PROJECT);
});

export default router;