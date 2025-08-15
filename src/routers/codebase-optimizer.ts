/**
 * Codebase Optimizer Router
 * 
 * REST API endpoints for the codebase optimizer agent functionality.
 * Provides comprehensive codebase analysis, optimization, and quality assessment.
 */

import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { promises as fs } from 'fs';

import type AgentRegistry from '@/agents/agent-registry';
import { log, LogContext } from '@/utils/logger';
import type { AgentContext } from '@/types';

const router = express.Router();

/**
 * POST /api/v1/codebase-optimizer/analyze
 * Analyze codebase for issues and optimization opportunities
 */
router.post('/analyze', async (req, res) => {
  const requestId = uuidv4();
  
  try {
    const { 
      basePath = process.cwd(),
      includeTests = false,
      performanceOnly = false,
      filePatterns = [],
      excludePatterns = []
    } = req.body;

    // Validate and sanitize base path
    const resolvedPath = path.resolve(basePath);
    
    // Security check: ensure path exists and is accessible
    try {
      await fs.access(resolvedPath);
      const stats = await fs.stat(resolvedPath);
      if (!stats.isDirectory()) {
        return res.status(400).json({
          success: false,
          error: 'Base path must be a directory',
          metadata: { requestId }
        });
      }
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or inaccessible base path',
        metadata: { requestId }
      });
    }

    const registry = (global as any).agentRegistry as AgentRegistry | undefined;
    if (!registry) {
      return res.status(503).json({
        success: false,
        error: 'Agent registry not available',
        metadata: { requestId }
      });
    }

    const context: AgentContext = {
      userRequest: 'Analyze codebase for optimization opportunities',
      requestId,
      workingDirectory: resolvedPath,
      metadata: {
        includeTests,
        performanceOnly,
        dryRun: true,
        filePatterns,
        excludePatterns,
        endpoint: '/analyze',
        timestamp: new Date().toISOString()
      }
    };

    log.info('🔍 Starting codebase analysis', LogContext.API, {
      requestId,
      basePath: resolvedPath,
      includeTests,
      performanceOnly
    });

    const response = await registry.processRequest('codebase_optimizer', context);

    log.info('✅ Codebase analysis completed', LogContext.API, {
      requestId,
      success: (response as any)?.success,
      issuesFound: (response as any)?.data?.result?.issuesFound
    });

    return res.json({
      success: true,
      data: response,
      metadata: { 
        requestId,
        timestamp: new Date().toISOString(),
        endpoint: '/analyze'
      }
    });

  } catch (error) {
    log.error('❌ Codebase analysis failed', LogContext.API, {
      requestId,
      error: error instanceof Error ? error.message : String(error)
    });

    return res.status(500).json({
      success: false,
      error: 'Failed to analyze codebase',
      details: error instanceof Error ? error.message : String(error),
      metadata: { requestId }
    });
  }
});

/**
 * POST /api/v1/codebase-optimizer/optimize
 * Optimize codebase with optional automatic fixes
 */
router.post('/optimize', async (req, res) => {
  const requestId = uuidv4();
  
  try {
    const { 
      basePath = process.cwd(),
      autoFix = false,
      includeTests = false,
      dryRun = true
    } = req.body;

    // Validate and sanitize base path
    const resolvedPath = path.resolve(basePath);
    
    // Security check: ensure path exists and is accessible
    try {
      await fs.access(resolvedPath);
      const stats = await fs.stat(resolvedPath);
      if (!stats.isDirectory()) {
        return res.status(400).json({
          success: false,
          error: 'Base path must be a directory',
          metadata: { requestId }
        });
      }
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or inaccessible base path',
        metadata: { requestId }
      });
    }

    const registry = (global as any).agentRegistry as AgentRegistry | undefined;
    if (!registry) {
      return res.status(503).json({
        success: false,
        error: 'Agent registry not available',
        metadata: { requestId }
      });
    }

    const context: AgentContext = {
      userRequest: autoFix ? 'Optimize codebase with automatic fixes' : 'Optimize codebase (analysis only)',
      requestId,
      workingDirectory: resolvedPath,
      metadata: {
        autoFix,
        includeTests,
        dryRun,
        endpoint: '/optimize',
        timestamp: new Date().toISOString()
      }
    };

    log.info('🚀 Starting codebase optimization', LogContext.API, {
      requestId,
      basePath: resolvedPath,
      autoFix,
      dryRun
    });

    const response = await registry.processRequest('codebase_optimizer', context);

    log.info('✅ Codebase optimization completed', LogContext.API, {
      requestId,
      success: (response as any)?.success,
      autoFixesApplied: (response as any)?.data?.result?.autoFixesApplied
    });

    return res.json({
      success: true,
      data: response,
      metadata: { 
        requestId,
        timestamp: new Date().toISOString(),
        endpoint: '/optimize'
      }
    });

  } catch (error) {
    log.error('❌ Codebase optimization failed', LogContext.API, {
      requestId,
      error: error instanceof Error ? error.message : String(error)
    });

    return res.status(500).json({
      success: false,
      error: 'Failed to optimize codebase',
      details: error instanceof Error ? error.message : String(error),
      metadata: { requestId }
    });
  }
});

/**
 * POST /api/v1/codebase-optimizer/performance
 * Analyze codebase specifically for performance issues
 */
router.post('/performance', async (req, res) => {
  const requestId = uuidv4();
  
  try {
    const { 
      basePath = process.cwd(),
      includeTests = false
    } = req.body;

    // Validate and sanitize base path
    const resolvedPath = path.resolve(basePath);
    
    // Security check: ensure path exists and is accessible
    try {
      await fs.access(resolvedPath);
      const stats = await fs.stat(resolvedPath);
      if (!stats.isDirectory()) {
        return res.status(400).json({
          success: false,
          error: 'Base path must be a directory',
          metadata: { requestId }
        });
      }
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or inaccessible base path',
        metadata: { requestId }
      });
    }

    const registry = (global as any).agentRegistry as AgentRegistry | undefined;
    if (!registry) {
      return res.status(503).json({
        success: false,
        error: 'Agent registry not available',
        metadata: { requestId }
      });
    }

    const agent = await registry.getAgent('codebase_optimizer');
    if (!agent) {
      return res.status(503).json({
        success: false,
        error: 'Codebase optimizer agent not available',
        metadata: { requestId }
      });
    }

    const context: AgentContext = {
      userRequest: 'Analyze codebase for performance optimization opportunities',
      requestId,
      workingDirectory: resolvedPath,
      metadata: {
        performanceOnly: true,
        includeTests,
        dryRun: true,
        endpoint: '/performance',
        timestamp: new Date().toISOString()
      }
    };

    log.info('⚡ Starting performance analysis', LogContext.API, {
      requestId,
      basePath: resolvedPath
    });

    // Use the specific performance optimization method
    const enhancedAgent = agent as any;
    const response = typeof enhancedAgent.optimizeForPerformance === 'function'
      ? await enhancedAgent.optimizeForPerformance(context)
      : await agent.execute(context);

    log.info('✅ Performance analysis completed', LogContext.API, {
      requestId,
      success: response.success,
      performanceImprovements: response.data?.result?.performanceImprovements?.length || 0
    });

    return res.json({
      success: true,
      data: response,
      metadata: { 
        requestId,
        timestamp: new Date().toISOString(),
        endpoint: '/performance'
      }
    });

  } catch (error) {
    log.error('❌ Performance analysis failed', LogContext.API, {
      requestId,
      error: error instanceof Error ? error.message : String(error)
    });

    return res.status(500).json({
      success: false,
      error: 'Failed to analyze performance',
      details: error instanceof Error ? error.message : String(error),
      metadata: { requestId }
    });
  }
});

/**
 * POST /api/v1/codebase-optimizer/security
 * Analyze codebase specifically for security vulnerabilities
 */
router.post('/security', async (req, res) => {
  const requestId = uuidv4();
  
  try {
    const { 
      basePath = process.cwd(),
      includeTests = true
    } = req.body;

    // Validate and sanitize base path
    const resolvedPath = path.resolve(basePath);
    
    // Security check: ensure path exists and is accessible
    try {
      await fs.access(resolvedPath);
      const stats = await fs.stat(resolvedPath);
      if (!stats.isDirectory()) {
        return res.status(400).json({
          success: false,
          error: 'Base path must be a directory',
          metadata: { requestId }
        });
      }
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or inaccessible base path',
        metadata: { requestId }
      });
    }

    const registry = (global as any).agentRegistry as AgentRegistry | undefined;
    if (!registry) {
      return res.status(503).json({
        success: false,
        error: 'Agent registry not available',
        metadata: { requestId }
      });
    }

    const agent = await registry.getAgent('codebase_optimizer');
    if (!agent) {
      return res.status(503).json({
        success: false,
        error: 'Codebase optimizer agent not available',
        metadata: { requestId }
      });
    }

    const context: AgentContext = {
      userRequest: 'Analyze codebase for security vulnerabilities',
      requestId,
      workingDirectory: resolvedPath,
      metadata: {
        performanceOnly: false,
        includeTests,
        dryRun: true,
        endpoint: '/security',
        timestamp: new Date().toISOString()
      }
    };

    log.info('🔒 Starting security analysis', LogContext.API, {
      requestId,
      basePath: resolvedPath
    });

    // Use the specific security analysis method
    const enhancedAgent = agent as any;
    const response = typeof enhancedAgent.analyzeSecurity === 'function'
      ? await enhancedAgent.analyzeSecurity(context)
      : await agent.execute(context);

    log.info('✅ Security analysis completed', LogContext.API, {
      requestId,
      success: response.success,
      securityImprovements: response.data?.result?.securityImprovements?.length || 0
    });

    return res.json({
      success: true,
      data: response,
      metadata: { 
        requestId,
        timestamp: new Date().toISOString(),
        endpoint: '/security'
      }
    });

  } catch (error) {
    log.error('❌ Security analysis failed', LogContext.API, {
      requestId,
      error: error instanceof Error ? error.message : String(error)
    });

    return res.status(500).json({
      success: false,
      error: 'Failed to analyze security',
      details: error instanceof Error ? error.message : String(error),
      metadata: { requestId }
    });
  }
});

/**
 * GET /api/v1/codebase-optimizer/status
 * Get current status and capabilities of the codebase optimizer
 */
router.get('/status', async (_req, res) => {
  const requestId = uuidv4();
  
  try {
    const registry = (global as any).agentRegistry as AgentRegistry | undefined;
    if (!registry) {
      return res.status(503).json({
        success: false,
        error: 'Agent registry not available',
        metadata: { requestId }
      });
    }

    const agentDefinition = registry.getAvailableAgents().find(a => a.name === 'codebase_optimizer');
    const isLoaded = registry.getLoadedAgents().includes('codebase_optimizer');

    return res.json({
      success: true,
      data: {
        available: !!agentDefinition,
        loaded: isLoaded,
        definition: agentDefinition ? {
          name: agentDefinition.name,
          category: agentDefinition.category,
          description: agentDefinition.description,
          capabilities: agentDefinition.capabilities,
          maxLatencyMs: agentDefinition.maxLatencyMs
        } : null,
        endpoints: [
          '/analyze - Comprehensive codebase analysis',
          '/optimize - Codebase optimization with optional auto-fixes',
          '/performance - Performance-focused analysis',
          '/security - Security vulnerability analysis',
          '/status - Current status and capabilities'
        ]
      },
      metadata: { 
        requestId,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    log.error('❌ Failed to get codebase optimizer status', LogContext.API, {
      requestId,
      error: error instanceof Error ? error.message : String(error)
    });

    return res.status(500).json({
      success: false,
      error: 'Failed to get status',
      details: error instanceof Error ? error.message : String(error),
      metadata: { requestId }
    });
  }
});

export default router;