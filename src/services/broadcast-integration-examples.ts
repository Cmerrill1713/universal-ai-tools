/**
 * Integration Examples for Real-time Broadcast Service
 * 
 * This file demonstrates how to integrate the RealtimeBroadcastService
 * with existing services to provide real-time updates.
 */

import { logger } from '../utils/logger';
import type { RealtimeBroadcastService } from './realtime-broadcast-service';

// Example 1: Agent State Broadcaster
export class AgentStateBroadcaster {
  constructor(private broadcastService: RealtimeBroadcastService) {}

  public reportAgentStateChange(agentId: string, status: 'idle' | 'active' | 'busy' | 'error' | 'offline', metadata?: any): void {
    // Simulate getting resource usage data
    const resourceUsage = {
      cpu: Math.random() * 100,
      memory: Math.random() * 100,
      activeConnections: Math.floor(Math.random() * 10),
    };

    this.broadcastService.broadcastAgentState({
      agentId,
      status,
      currentTask: metadata?.currentTask,
      resourceUsage,
      metadata,
    });
  }

  public reportAgentError(agentId: string, error: string, details?: any): void {
    this.reportAgentStateChange(agentId, 'error', { error, details });
    
    // Also send a system alert for critical errors
    this.broadcastService.broadcastSystemAlert({
      severity: 'error',
      component: `agent:${agentId}`,
      message: `Agent ${agentId} encountered an error: ${error}`,
      details: { agentId, error, ...details },
    });
  }
}

// Example 2: Performance Metrics Streamer
export class PerformanceMetricsStreamer {
  private metricsInterval: NodeJS.Timeout | null = null;

  constructor(private broadcastService: RealtimeBroadcastService) {}

  public startStreaming(intervalMs: number = 5000): void {
    if (this.metricsInterval) {
      this.stopStreaming();
    }

    this.metricsInterval = setInterval(() => {
      this.collectAndBroadcastMetrics();
    }, intervalMs);

    logger.info('Performance metrics streaming started');
  }

  public stopStreaming(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
    logger.info('Performance metrics streaming stopped');
  }

  private collectAndBroadcastMetrics(): void {
    // Collect system metrics
    const memUsage = process.memoryUsage();
    
    this.broadcastService.broadcastPerformanceMetric({
      metricName: 'memory.heapUsed',
      value: memUsage.heapUsed,
      unit: 'bytes',
      category: 'system',
    });

    this.broadcastService.broadcastPerformanceMetric({
      metricName: 'memory.heapTotal',
      value: memUsage.heapTotal,
      unit: 'bytes',
      category: 'system',
    });

    this.broadcastService.broadcastPerformanceMetric({
      metricName: 'system.uptime',
      value: process.uptime(),
      unit: 'seconds',
      category: 'system',
    });

    // Example agent-specific metrics
    this.broadcastService.broadcastPerformanceMetric({
      metricName: 'agent.responseTime',
      value: Math.random() * 1000,
      unit: 'milliseconds',
      category: 'agent',
      agentId: 'example-agent',
    });
  }
}

// Example 3: Workflow Execution Monitor
export class WorkflowExecutionMonitor {
  private activeWorkflows: Map<string, { workflowId: string; status: string; startTime: number }> = new Map();

  constructor(private broadcastService: RealtimeBroadcastService) {}

  public startWorkflow(workflowId: string, executionId: string, agentId?: string): void {
    this.activeWorkflows.set(executionId, {
      workflowId,
      status: 'running',
      startTime: Date.now(),
    });

    this.broadcastService.broadcastWorkflowUpdate({
      workflowId,
      executionId,
      stage: 'initialization',
      status: 'running',
      progress: 0,
      agentId,
    });
  }

  public updateWorkflowProgress(
    workflowId: string,
    executionId: string,
    stage: string,
    progress: number,
    agentId?: string
  ): void {
    const workflow = this.activeWorkflows.get(executionId);
    if (workflow) {
      this.broadcastService.broadcastWorkflowUpdate({
        workflowId,
        executionId,
        stage,
        status: 'running',
        progress: Math.min(100, Math.max(0, progress)),
        agentId,
      });
    }
  }

  public completeWorkflow(
    workflowId: string,
    executionId: string,
    result?: any,
    agentId?: string
  ): void {
    const workflow = this.activeWorkflows.get(executionId);
    if (workflow) {
      this.broadcastService.broadcastWorkflowUpdate({
        workflowId,
        executionId,
        stage: 'completed',
        status: 'completed',
        progress: 100,
        result,
        agentId,
      });

      this.activeWorkflows.delete(executionId);
    }
  }

  public failWorkflow(
    workflowId: string,
    executionId: string,
    error: string,
    agentId?: string
  ): void {
    const workflow = this.activeWorkflows.get(executionId);
    if (workflow) {
      this.broadcastService.broadcastWorkflowUpdate({
        workflowId,
        executionId,
        stage: 'failed',
        status: 'failed',
        error,
        agentId,
      });

      // Also broadcast a system alert for workflow failures
      this.broadcastService.broadcastSystemAlert({
        severity: 'warning',
        component: 'workflow-engine',
        message: `Workflow ${workflowId} failed`,
        details: { workflowId, executionId, error, agentId },
      });

      this.activeWorkflows.delete(executionId);
    }
  }
}

// Example 4: Memory Timeline Tracker
export class MemoryTimelineTracker {
  constructor(private broadcastService: RealtimeBroadcastService) {}

  public trackMemoryCreation(memoryId: string, content: string, importance: number, tags: string[], agentId?: string): void {
    this.broadcastService.broadcastMemoryTimeline({
      memoryId,
      action: 'created',
      content,
      importance,
      tags,
      agentId,
    });
  }

  public trackMemoryAccess(memoryId: string, importance: number, tags: string[], agentId?: string): void {
    this.broadcastService.broadcastMemoryTimeline({
      memoryId,
      action: 'accessed',
      importance,
      tags,
      agentId,
    });
  }

  public trackMemoryUpdate(memoryId: string, content: string, importance: number, tags: string[], agentId?: string): void {
    this.broadcastService.broadcastMemoryTimeline({
      memoryId,
      action: 'updated',
      content,
      importance,
      tags,
      agentId,
    });
  }

  public trackMemoryDeletion(memoryId: string, importance: number, tags: string[], agentId?: string): void {
    this.broadcastService.broadcastMemoryTimeline({
      memoryId,
      action: 'deleted',
      importance,
      tags,
      agentId,
    });
  }
}

// Example 5: Health Monitor Integration
export class HealthMonitorIntegration {
  constructor(private broadcastService: RealtimeBroadcastService) {}

  public broadcastHealthAlert(severity: 'info' | 'warning' | 'error' | 'critical', component: string, message: string, details?: any): void {
    this.broadcastService.broadcastSystemAlert({
      severity,
      component,
      message,
      details,
    });
  }

  public broadcastServiceHealth(serviceName: string, status: 'healthy' | 'degraded' | 'unhealthy', responseTime?: number, details?: any): void {
    // Convert service health to performance metrics
    const healthScore = status === 'healthy' ? 100 : status === 'degraded' ? 50 : 0;
    
    this.broadcastService.broadcastPerformanceMetric({
      metricName: `service.${serviceName}.health`,
      value: healthScore,
      unit: 'percent',
      category: 'system',
      metadata: { status, details },
    });

    if (responseTime !== undefined) {
      this.broadcastService.broadcastPerformanceMetric({
        metricName: `service.${serviceName}.responseTime`,
        value: responseTime,
        unit: 'milliseconds',
        category: 'system',
      });
    }

    // Send alert for unhealthy services
    if (status === 'unhealthy') {
      this.broadcastHealthAlert('error', serviceName, `Service ${serviceName} is unhealthy`, details);
    } else if (status === 'degraded') {
      this.broadcastHealthAlert('warning', serviceName, `Service ${serviceName} is degraded`, details);
    }
  }
}

// Factory function to create all integrations
export function createBroadcastIntegrations(broadcastService: RealtimeBroadcastService) {
  return {
    agentState: new AgentStateBroadcaster(broadcastService),
    performanceMetrics: new PerformanceMetricsStreamer(broadcastService),
    workflowExecution: new WorkflowExecutionMonitor(broadcastService),
    memoryTimeline: new MemoryTimelineTracker(broadcastService),
    healthMonitor: new HealthMonitorIntegration(broadcastService),
  };
}

// Export types for external use
export type {
  AgentStateBroadcaster as AgentStateBroadcasterType,
  HealthMonitorIntegration as HealthMonitorIntegrationType,
  MemoryTimelineTracker as MemoryTimelineTrackerType,
  PerformanceMetricsStreamer as PerformanceMetricsStreamerType,
  WorkflowExecutionMonitor as WorkflowExecutionMonitorType,
};