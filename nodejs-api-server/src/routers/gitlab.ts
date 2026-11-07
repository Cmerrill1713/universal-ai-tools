/**
 * GitLab API Router
 * Exposes GitLab integration endpoints for issue detection, code analysis, and context gathering
 */

import { Router, Request, Response } from 'express';
import { GitLabIntegrationService, GitLabConfig } from '../services/gitlab-integration';

const router = Router();

// Initialize GitLab service
const gitlabConfig: GitLabConfig = {
  baseUrl: process.env.GITLAB_URL || 'https://gitlab.com',
  accessToken: process.env.GITLAB_ACCESS_TOKEN || '',
  projectId: process.env.GITLAB_PROJECT_ID || '',
  enableWebhooks: process.env.GITLAB_ENABLE_WEBHOOKS === 'true',
  webhookSecret: process.env.GITLAB_WEBHOOK_SECRET
};

const gitlabService = new GitLabIntegrationService(gitlabConfig);

// Initialize GitLab service
gitlabService.initialize().catch(error => {
  console.error('Failed to initialize GitLab service:', error);
});

/**
 * GET /api/gitlab/status
 * Get GitLab integration status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const isConnected = await gitlabService.testConnection();
    
    res.json({
      status: 'available',
      connected: isConnected,
      config: {
        baseUrl: gitlabConfig.baseUrl,
        projectId: gitlabConfig.projectId,
        webhooksEnabled: gitlabConfig.enableWebhooks
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/gitlab/project
 * Get project information
 */
router.get('/project', async (req: Request, res: Response) => {
  try {
    const project = await gitlabService.getProject();
    
    res.json({
      success: true,
      data: project,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get project information',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/gitlab/issues
 * Get project issues
 */
router.get('/issues', async (req: Request, res: Response) => {
  try {
    const { state = 'opened', limit = 50 } = req.query;
    
    const issues = await gitlabService.getIssues(state as 'opened' | 'closed' | 'all');
    const limitedIssues = issues.slice(0, parseInt(limit as string));
    
    res.json({
      success: true,
      data: limitedIssues,
      total: issues.length,
      returned: limitedIssues.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get issues',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/gitlab/merge-requests
 * Get merge requests
 */
router.get('/merge-requests', async (req: Request, res: Response) => {
  try {
    const { state = 'opened', limit = 50 } = req.query;
    
    const mergeRequests = await gitlabService.getMergeRequests(state as 'opened' | 'closed' | 'merged' | 'all');
    const limitedMRs = mergeRequests.slice(0, parseInt(limit as string));
    
    res.json({
      success: true,
      data: limitedMRs,
      total: mergeRequests.length,
      returned: limitedMRs.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get merge requests',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/gitlab/pipelines
 * Get pipeline information
 */
router.get('/pipelines', async (req: Request, res: Response) => {
  try {
    const { limit = 10 } = req.query;
    
    const pipelines = await gitlabService.getPipelines(parseInt(limit as string));
    
    res.json({
      success: true,
      data: pipelines,
      total: pipelines.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get pipelines',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/gitlab/code-quality
 * Get code quality report
 */
router.get('/code-quality', async (req: Request, res: Response) => {
  try {
    const codeQuality = await gitlabService.getCodeQualityReport();
    
    if (!codeQuality) {
      return res.status(404).json({
        success: false,
        error: 'No code quality report available',
        timestamp: new Date().toISOString()
      });
    }
    
    res.json({
      success: true,
      data: codeQuality,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get code quality report',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/gitlab/security
 * Get security report
 */
router.get('/security', async (req: Request, res: Response) => {
  try {
    const securityReport = await gitlabService.getSecurityReport();
    
    if (!securityReport) {
      return res.status(404).json({
        success: false,
        error: 'No security report available',
        timestamp: new Date().toISOString()
      });
    }
    
    res.json({
      success: true,
      data: securityReport,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get security report',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/gitlab/context
 * Get comprehensive project context
 */
router.get('/context', async (req: Request, res: Response) => {
  try {
    const context = await gitlabService.getProjectContext();
    
    res.json({
      success: true,
      data: context,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get project context',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/gitlab/analysis
 * Get comprehensive issue analysis and recommendations
 */
router.get('/analysis', async (req: Request, res: Response) => {
  try {
    const context = await gitlabService.getProjectContext();
    
    // Analyze issues and provide recommendations
    const analysis = {
      summary: {
        totalIssues: context.issues.length,
        openIssues: context.issues.filter(i => i.state === 'opened').length,
        closedIssues: context.issues.filter(i => i.state === 'closed').length,
        criticalIssues: context.issues.filter(i => i.priority === 'critical').length,
        highPriorityIssues: context.issues.filter(i => i.priority === 'high').length,
        securityIssues: context.issues.filter(i => i.category === 'security').length,
        bugIssues: context.issues.filter(i => i.category === 'bug').length,
        featureRequests: context.issues.filter(i => i.category === 'feature').length
      },
      recommendations: generateRecommendations(context),
      trends: analyzeTrends(context),
      healthScore: calculateHealthScore(context)
    };
    
    res.json({
      success: true,
      data: analysis,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to analyze project',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/gitlab/metrics
 * Get repository metrics and statistics
 */
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const metrics = await gitlabService.getRepositoryMetrics();
    
    res.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get repository metrics',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/gitlab/health
 * Get project health analysis
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const health = await gitlabService.analyzeProjectHealth();
    
    res.json({
      success: true,
      data: health,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to analyze project health',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/gitlab/statistics
 * Get comprehensive project statistics
 */
router.get('/statistics', async (req: Request, res: Response) => {
  try {
    const statistics = await gitlabService.getProjectStatistics();
    
    res.json({
      success: true,
      data: statistics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get project statistics',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/gitlab/webhook
 * Handle GitLab webhook events
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-gitlab-token'] as string;
    const eventType = req.headers['x-gitlab-event'] as string;
    const userAgent = req.headers['user-agent'] as string;
    
    console.log(`🔔 Received GitLab webhook: ${eventType}`);
    console.log(`  User-Agent: ${userAgent}`);
    console.log(`  Signature: ${signature ? 'present' : 'missing'}`);

    // Check if webhooks are enabled
    if (!process.env.GITLAB_ENABLE_WEBHOOKS || process.env.GITLAB_ENABLE_WEBHOOKS !== 'true') {
      console.log('⚠️ Webhooks are disabled, ignoring event');
      return res.status(200).json({
        success: true,
        message: 'Webhooks disabled, event ignored',
        timestamp: new Date().toISOString()
      });
    }

    // Validate webhook signature if secret is configured
    if (process.env.GITLAB_WEBHOOK_SECRET) {
      const isValid = gitlabService.validateWebhookSignature(
        JSON.stringify(req.body),
        signature,
        process.env.GITLAB_WEBHOOK_SECRET
      );

      if (!isValid) {
        console.log('❌ Invalid webhook signature');
        return res.status(401).json({
          success: false,
          error: 'Invalid webhook signature',
          timestamp: new Date().toISOString()
        });
      }
    } else {
      console.log('⚠️ No webhook secret configured, skipping signature validation');
    }

    // Process webhook event
    await gitlabService.processWebhookEvent(req.body);
    
    console.log(`✅ Webhook processed successfully: ${eventType}`);
    
    res.json({
      success: true,
      message: 'Webhook processed successfully',
      eventType,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Webhook processing failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process webhook',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/gitlab/webhook/config
 * Get webhook configuration and status
 */
router.get('/webhook/config', async (req: Request, res: Response) => {
  try {
    const config = gitlabService.getWebhookConfig();
    
    res.json({
      success: true,
      data: config,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get webhook config',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/gitlab/webhook/test
 * Test webhook functionality with mock data
 */
router.post('/webhook/test', async (req: Request, res: Response) => {
  try {
    const eventType = req.body.eventType || 'issue';
    
    // Create mock webhook event
    const mockEvent = {
      object_kind: eventType,
      event_type: eventType,
      user: {
        id: 1,
        name: 'Test User',
        username: 'testuser',
        email: 'test@example.com'
      },
      project: {
        id: parseInt(process.env.GITLAB_PROJECT_ID || '123'),
        name: 'Universal AI Tools',
        description: 'Test project',
        web_url: 'https://gitlab.com/test/project',
        git_ssh_url: 'git@gitlab.com:test/project.git',
        git_http_url: 'https://gitlab.com/test/project.git',
        namespace: 'test',
        visibility_level: 0,
        path_with_namespace: 'test/project',
        default_branch: 'main',
        homepage: 'https://gitlab.com/test/project',
        url: 'git@gitlab.com:test/project.git',
        ssh_url: 'git@gitlab.com:test/project.git',
        http_url: 'https://gitlab.com/test/project.git'
      },
      repository: {
        name: 'project',
        url: 'git@gitlab.com:test/project.git',
        description: 'Test repository',
        homepage: 'https://gitlab.com/test/project',
        git_http_url: 'https://gitlab.com/test/project.git',
        git_ssh_url: 'git@gitlab.com:test/project.git',
        visibility_level: 0
      },
      object_attributes: {
        id: 1,
        title: 'Test Event',
        description: 'This is a test webhook event',
        state: 'opened',
        action: 'opened',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Process the mock event
    await gitlabService.processWebhookEvent(mockEvent);
    
    res.json({
      success: true,
      message: 'Test webhook processed successfully',
      eventType,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process test webhook',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/gitlab/webhook/analytics
 * Get webhook analytics and metrics
 */
router.get('/webhook/analytics', async (req: Request, res: Response) => {
  try {
    const analytics = gitlabService.getWebhookAnalytics();
    
    res.json({
      success: true,
      data: analytics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get webhook analytics',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/gitlab/webhook/filter
 * Filter webhook events based on criteria
 */
router.post('/webhook/filter', async (req: Request, res: Response) => {
  try {
    const filter = req.body;
    const filteredEvents = gitlabService.filterWebhookEvents(filter);
    
    res.json({
      success: true,
      data: filteredEvents,
      filter,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to filter webhook events',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/gitlab/webhook/health
 * Get webhook health status
 */
router.get('/webhook/health', async (req: Request, res: Response) => {
  try {
    const health = gitlabService.getWebhookHealth();
    
    res.json({
      success: true,
      data: health,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get webhook health',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/gitlab/webhook/reset
 * Reset webhook analytics
 */
router.post('/webhook/reset', async (req: Request, res: Response) => {
  try {
    gitlabService.resetWebhookAnalytics();
    
    res.json({
      success: true,
      message: 'Webhook analytics reset successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to reset webhook analytics',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Generate recommendations based on project context
 */
function generateRecommendations(context: any): string[] {
  const recommendations: string[] = [];
  
  // Issue-based recommendations
  const criticalIssues = context.issues.filter((i: any) => i.priority === 'critical');
  if (criticalIssues.length > 0) {
    recommendations.push(`🚨 ${criticalIssues.length} critical issues need immediate attention`);
  }
  
  const securityIssues = context.issues.filter((i: any) => i.category === 'security');
  if (securityIssues.length > 0) {
    recommendations.push(`🔒 ${securityIssues.length} security issues require review`);
  }
  
  // Pipeline-based recommendations
  const failedPipelines = context.pipelines.filter((p: any) => p.status === 'failed');
  if (failedPipelines.length > 0) {
    recommendations.push(`❌ ${failedPipelines.length} failed pipelines need investigation`);
  }
  
  // Code quality recommendations
  if (context.codeQuality) {
    const { summary } = context.codeQuality;
    if (summary.criticalIssues > 0) {
      recommendations.push(`🐛 ${summary.criticalIssues} critical code quality issues found`);
    }
    if (summary.coverage < 80) {
      recommendations.push(`📊 Code coverage is ${summary.coverage}%, consider improving test coverage`);
    }
  }
  
  // Security recommendations
  if (context.securityReport) {
    const { summary } = context.securityReport;
    if (summary.critical > 0) {
      recommendations.push(`🚨 ${summary.critical} critical security vulnerabilities found`);
    }
    if (summary.high > 0) {
      recommendations.push(`⚠️ ${summary.high} high-severity security issues need attention`);
    }
  }
  
  return recommendations;
}

/**
 * Analyze trends in the project
 */
function analyzeTrends(context: any): any {
  const now = new Date();
  const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  const recentIssues = context.issues.filter((i: any) => 
    new Date(i.createdAt) > lastWeek
  );
  
  const recentMRs = context.mergeRequests.filter((mr: any) => 
    new Date(mr.createdAt) > lastWeek
  );
  
  return {
    issuesThisWeek: recentIssues.length,
    mergeRequestsThisWeek: recentMRs.length,
    averageIssueResolutionTime: 'N/A', // Would calculate from historical data
    codeQualityTrend: 'stable', // Would analyze from historical reports
    securityTrend: 'stable' // Would analyze from historical reports
  };
}

/**
 * Calculate project health score
 */
function calculateHealthScore(context: any): number {
  let score = 100;
  
  // Deduct points for critical issues
  const criticalIssues = context.issues.filter((i: any) => i.priority === 'critical');
  score -= criticalIssues.length * 10;
  
  // Deduct points for security issues
  const securityIssues = context.issues.filter((i: any) => i.category === 'security');
  score -= securityIssues.length * 5;
  
  // Deduct points for failed pipelines
  const failedPipelines = context.pipelines.filter((p: any) => p.status === 'failed');
  score -= failedPipelines.length * 3;
  
  // Deduct points for low code coverage
  if (context.codeQuality && context.codeQuality.coverage < 80) {
    score -= (80 - context.codeQuality.coverage) * 0.5;
  }
  
  return Math.max(0, Math.min(100, score));
}

export default router;