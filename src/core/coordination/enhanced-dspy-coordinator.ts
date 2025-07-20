import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';
import { dspyService } from '../../services/dspy-service';
import type { BrowserAgentPool } from './agent-pool';
import { v4 as uuidv4 } from 'uuid';
import type { Task } from './task-manager';

// Re-export interfaces for compatibility
export interface CoordinationPlan {
  id: string;
  problem: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  assignedAgents: string[];
  strategies: any[];
  status: 'planning' | 'executing' | 'completed' | 'failed';
  startTime: number;
  endTime?: number;
  results: any[];
  context: CoordinationContext;
  tasks: Task[];
  dspyResponse?: any;
}

export interface CoordinationContext {
  sessionId: string;
  sharedState: Record<string, any>;
  dependencies: Record<string, any>;
  resourceLimits: ResourceLimits;
  capabilities: any[];
}

export interface CoordinationSession {
  id: string;
  planIds: string[];
  sharedState: Record<string, any>;
  messageHistory: any[];
  participants: string[];
  startTime: number;
  lastActivity: number;
}

export interface ResourceLimits {
  maxConcurrentTasks: number;
  taskTimeout: number;
  memoryLimit: number;
  cpuLimit: number;
}

export interface ProblemAnalysis {
  problemType: string;
  technology: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  affectedComponents: string[];
  potentialCauses: string[];
  recommendedStrategies: string[];
}

/**
 * Enhanced DSPy-based Agent Coordinator
 * Maintains API compatibility while using DSPy for intelligent coordination
 */
export class EnhancedDSPyCoordinator extends EventEmitter {
  private agentPool: BrowserAgentPool;
  private activePlans: Map<string, CoordinationPlan> = new Map();
  private sessions: Map<string, CoordinationSession> = new Map();

  constructor(agentPool: BrowserAgentPool) {
    super();
    this.agentPool = agentPool;
  }

  /**
   * Coordinate a group fix using DSPy's intelligent orchestration
   */
  async coordinateGroupFix(problem: string, context: any): Promise<CoordinationPlan> {
    logger.info(`🎯 Starting enhanced DSPy-coordinated group fix for: ${problem}`);
    
    // Create session
    const session = await this.createCoordinationSession(problem, context);
    
    // Create plan
    const plan = await this.createCoordinationPlan(problem, session);

    try {
      // Get available agents
      const agentMap = await this.agentPool.getAvailableAgents();
      const availableAgents = Array.from(agentMap.keys());
      
      // Use DSPy for intelligent orchestration
      const orchestrationResult = await dspyService.orchestrate({
        requestId: plan.id,
        userRequest: problem,
        userId: 'system',
        orchestrationMode: this.determineOrchestrationMode(plan.severity),
        context: {
          ...context,
          sessionId: session.id,
          availableAgents,
          severity: plan.severity
        },
        timestamp: new Date()
      });

      // Update plan with DSPy results
      plan.assignedAgents = orchestrationResult.participatingAgents || [];
      plan.dspyResponse = orchestrationResult;
      plan.status = 'executing';

      logger.info(`📋 DSPy orchestration completed with ${plan.assignedAgents.length} agents`);
      
      // Execute the plan
      await this.executeDSPyPlan(plan, orchestrationResult);
      
      plan.status = 'completed';
      plan.endTime = Date.now();
      
      logger.info(`✅ Enhanced DSPy-coordinated fix completed in ${plan.endTime - plan.startTime}ms`);
      
    } catch (error) {
      plan.status = 'failed';
      plan.endTime = Date.now();
      logger.error(`❌ Enhanced DSPy coordination failed:`, error);
      throw error;
    }

    return plan;
  }

  /**
   * Create a coordination session
   */
  private async createCoordinationSession(problem: string, context: any): Promise<CoordinationSession> {
    const session: CoordinationSession = {
      id: `session-${Date.now()}`,
      planIds: [],
      sharedState: {
        problem,
        context,
        startTime: Date.now(),
        artifacts: [],
        decisions: [],
        metrics: {}
      },
      messageHistory: [],
      participants: [],
      startTime: Date.now(),
      lastActivity: Date.now()
    };

    this.sessions.set(session.id, session);
    return session;
  }

  /**
   * Create a coordination plan
   */
  private async createCoordinationPlan(problem: string, session: CoordinationSession): Promise<CoordinationPlan> {
    const planId = `plan-${Date.now()}`;
    const severity = this.analyzeSeverity(problem);
    
    const context: CoordinationContext = {
      sessionId: session.id,
      sharedState: session.sharedState,
      dependencies: {},
      resourceLimits: {
        maxConcurrentTasks: 20,
        taskTimeout: 300000,
        memoryLimit: 1024 * 1024 * 100,
        cpuLimit: 80
      },
      capabilities: []
    };
    
    const plan: CoordinationPlan = {
      id: planId,
      problem,
      severity,
      assignedAgents: [],
      strategies: [],
      status: 'planning',
      startTime: Date.now(),
      results: [],
      context,
      tasks: []
    };
    
    session.planIds.push(planId);
    this.activePlans.set(planId, plan);
    
    return plan;
  }

  /**
   * Determine orchestration mode based on severity
   */
  private determineOrchestrationMode(severity: string): 'simple' | 'standard' | 'cognitive' | 'adaptive' {
    switch (severity) {
      case 'critical':
        return 'adaptive';
      case 'high':
        return 'cognitive';
      case 'medium':
        return 'standard';
      default:
        return 'simple';
    }
  }

  /**
   * Execute the plan generated by DSPy
   */
  private async executeDSPyPlan(plan: CoordinationPlan, orchestrationResult: any): Promise<void> {
    // Create mock tasks for compatibility
    const tasks: Task[] = [{
      id: `task-${Date.now()}`,
      planId: plan.id,
      type: 'execute',
      description: `Execute DSPy orchestration for: ${plan.problem}`,
      assignedAgent: plan.assignedAgents[0] || 'coordinator',
      dependencies: [],
      status: 'completed',
      priority: 'high',
      output: orchestrationResult.result,
      metadata: {},
      retryCount: 0,
      maxRetries: 3,
      timeout: 30000
    }];
    
    plan.tasks = tasks;
    plan.results = [{
      success: orchestrationResult.success,
      data: orchestrationResult.result,
      reasoning: orchestrationResult.reasoning,
      confidence: orchestrationResult.confidence,
      executionTime: orchestrationResult.executionTime
    }];
    
    // Emit events for compatibility
    this.emit('task_completed', tasks[0]);
  }

  /**
   * Analyze problem severity
   */
  private analyzeSeverity(problem: string): 'low' | 'medium' | 'high' | 'critical' {
    const problemLower = problem.toLowerCase();
    
    if (problemLower.includes('critical') || problemLower.includes('crash') || problemLower.includes('connection refused')) {
      return 'critical';
    } else if (problemLower.includes('error') || problemLower.includes('failed')) {
      return 'high';
    } else if (problemLower.includes('warning')) {
      return 'low';
    }
    
    return 'medium';
  }

  /**
   * Get coordination statistics
   */
  async getCoordinationStats(): Promise<{
    totalPlans: number;
    activePlans: number;
    completedPlans: number;
    failedPlans: number;
    totalAgents: number;
    activeAgents: number;
    totalTasks: number;
    completedTasks: number;
    averagePlanDuration: number;
    successRate: number;
  }> {
    const plans = Array.from(this.activePlans.values());
    const completedPlans = plans.filter(p => p.status === 'completed');
    const failedPlans = plans.filter(p => p.status === 'failed');
    
    const totalDuration = completedPlans.reduce((sum, plan) => {
      return sum + (plan.endTime ? plan.endTime - plan.startTime : 0);
    }, 0);
    
    const averagePlanDuration = completedPlans.length > 0 ? totalDuration / completedPlans.length : 0;
    const successRate = plans.length > 0 ? (completedPlans.length / plans.length) * 100 : 0;
    
    const poolStats = this.agentPool.getPoolStats();
    
    return {
      totalPlans: plans.length,
      activePlans: plans.filter(p => p.status === 'executing').length,
      completedPlans: completedPlans.length,
      failedPlans: failedPlans.length,
      totalAgents: poolStats.totalAgents,
      activeAgents: poolStats.activeAgents,
      totalTasks: plans.reduce((sum, p) => sum + p.tasks.length, 0),
      completedTasks: plans.reduce((sum, p) => sum + p.tasks.filter(t => t.status === 'completed').length, 0),
      averagePlanDuration,
      successRate
    };
  }

  /**
   * Get active plans
   */
  async getActivePlans(): Promise<CoordinationPlan[]> {
    return Array.from(this.activePlans.values());
  }

  /**
   * Get plan status
   */
  async getPlanStatus(planId: string): Promise<CoordinationPlan | null> {
    return this.activePlans.get(planId) || null;
  }

  /**
   * Cancel a plan
   */
  async cancelPlan(planId: string): Promise<boolean> {
    const plan = this.activePlans.get(planId);
    if (!plan) return false;
    
    plan.status = 'failed';
    plan.endTime = Date.now();
    
    this.activePlans.delete(planId);
    logger.info(`🚫 Plan cancelled: ${planId}`);
    
    return true;
  }

  /**
   * Clean up old plans and sessions
   */
  async cleanup(): Promise<void> {
    const cutoff = Date.now() - 3600000; // 1 hour
    
    // Clean up old sessions
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.lastActivity < cutoff) {
        this.sessions.delete(sessionId);
        logger.info(`🧹 Cleaned up old session: ${sessionId}`);
      }
    }
    
    // Clean up old plans
    for (const [planId, plan] of this.activePlans.entries()) {
      if ((plan.status === 'completed' || plan.status === 'failed') && 
          plan.endTime && plan.endTime < cutoff) {
        this.activePlans.delete(planId);
        logger.info(`🧹 Cleaned up old plan: ${planId}`);
      }
    }
  }

  /**
   * Shutdown the coordinator
   */
  async shutdown(): Promise<void> {
    logger.info('🔥 Shutting down Enhanced DSPy Coordinator...');
    
    // Cancel all active plans
    const activePlans = Array.from(this.activePlans.keys());
    for (const planId of activePlans) {
      await this.cancelPlan(planId);
    }
    
    // Clear all data
    this.activePlans.clear();
    this.sessions.clear();
    
    logger.info('🔥 Enhanced DSPy Coordinator shutdown complete');
  }
}

// Alias for compatibility
export { EnhancedDSPyCoordinator as EnhancedAgentCoordinator };