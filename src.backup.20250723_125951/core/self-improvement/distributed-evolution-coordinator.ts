/**
 * Distributed Evolution Coordinator
 * Manages and orchestrates evolution strategies across multiple agents and systems
 */

import { EventEmitter } from 'events';
import type { SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { WebSocket } from 'ws';
import { LogContext, logger } from '../../utils/enhanced-logger';
import { BATCH_SIZE_10, HTTP_200, HTTP_400, HTTP_401, HTTP_404, HTTP_500, MAX_ITEMS_100, PERCENT_10, PERCENT_100, PERCENT_20, PERCENT_30, PERCENT_50, PERCENT_80, PERCENT_90, TIME_10000MS, TIME_1000MS, TIME_2000MS, TIME_5000MS, TIME_500MS, ZERO_POINT_EIGHT, ZERO_POINT_FIVE, ZERO_POINT_NINE } from "../utils/common-constants";

export interface EvolutionNode {
  id: string;
  type: 'coordinator' | 'worker' | 'evaluator';
  endpoint: string;
  capabilities: string[];
  workload: number;
  status: 'online' | 'offline' | 'busy' | 'maintenance';
  performance: NodePerformance;
  lastSeen: Date;
}

export interface NodePerformance {
  tasksCompleted: number;
  averageTaskTime: number;
  successRate: number;
  cpuUsage: number;
  memoryUsage: number;
  queueSize: number;
}

export interface DistributedTask {
  id: string;
  type: 'evolution' | 'evaluation' | 'optimization' | '_patternmining';
  priority: number;
  parameters: any;
  dependencies: string[];
  assignedNode?: string;
  status: 'pending' | 'assigned' | 'running' | 'completed' | 'failed';
  result?: any;
  error: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface EvolutionCluster {
  id: string;
  name: string;
  nodes: EvolutionNode[];
  strategy: 'round-robin' | 'load-balanced' | 'capability-based' | 'performance-weighted';
  configuration: ClusterConfiguration;
}

export interface ClusterConfiguration {
  maxNodes: number;
  taskRetries: number;
  timeoutMs: number;
  loadBalancing: LoadBalancingConfig;
  faultTolerance: FaultToleranceConfig;
}

export interface LoadBalancingConfig {
  algorithm: 'weighted' | 'least-connections' | 'round-robin' | 'random';
  weights: Map<string, number>;
  healthCheckInterval: number;
}

export interface FaultToleranceConfig {
  maxFailures: number;
  retryDelayMs: number;
  circuitBreakerThreshold: number;
  recoveryTimeMs: number;
}

export interface EvolutionPipeline {
  id: string;
  name: string;
  stages: PipelineStage[];
  status: 'running' | 'paused' | 'completed' | 'failed';
  metrics: PipelineMetrics;
}

export interface PipelineStage {
  id: string;
  name: string;
  type: 'generation' | 'evaluation' | 'selection' | 'mutation' | 'crossover';
  dependencies: string[];
  parallelism: number;
  configuration: any;
}

export interface PipelineMetrics {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  averageLatency: number;
  throughput: number;
  resourceUtilization: number;
}

export class DistributedEvolutionCoordinator extends EventEmitter {
  private nodes: Map<string, EvolutionNode> = new Map();
  private tasks: Map<string, DistributedTask> = new Map();
  private clusters: Map<string, EvolutionCluster> = new Map();
  private pipelines: Map<string, EvolutionPipeline> = new Map();
  private wsConnections: Map<string, WebSocket> = new Map();
  private taskQueue: DistributedTask[] = [];
  
  constructor(
    private supabase: SupabaseClient,
    private config: {
      port: number;
      maxRetries: number;
      taskTimeout: number;
      heartbeatInterval: number;
      cleanupInterval: number;
    } = {
      port: 8080,
      maxRetries: 3,
      taskTimeout: 300000, // 5 minutes
      heartbeatInterval: 30000, // 30 seconds
      cleanupInterval: 60000 // 1 minute
    }
  ) {
    super();
    this.initialize();
  }

  /**
   * Initialize the distributed coordinator
   */
  private async initialize())): Promise<void> {
    try {
      await this.loadExistingNodes();
      await this.loadExistingClusters();
      await this.startHeartbeatMonitoring();
      await this.startTaskScheduler();
      await this.startCleanupProcess();
      
      logger.info('Distributed Evolution Coordinator initialized', LogContext.SYSTEM);
    } catch (error) {
      logger.error('Failed to initialize Di, LogContext.SYSTEM, { error});
    }
  }

  /**
   * Register a new evolution node
   */
  async registerNode(nodeConfig: {
    type: EvolutionNode['type'];
    endpoint: string;
    capabilities: string[];
  }): Promise<EvolutionNode> {
    const node: EvolutionNode = {
      id: uuidv4(),
      ...nodeConfig,
      workload: 0,
      status: 'online',
      performance: {
        tasksCompleted: 0,
        averageTaskTime: 0,
        successRate: 1.0,
        cpuUsage: 0,
        memoryUsage: 0,
        queueSize: 0
      },
      lastSeen: new Date()
    };

    this.nodes.set(node.id, node;
    await this.persistNode(node);
    
    // Establish WebSocket connection if applicable
    if (node.endpoint.startsWith('ws://') || node.endpoint.startsWith('wss://')) {
      await this.connectToNode(node);
    }

    this.emit('node-registered', node);
    logger.info(`Evolution node registered: ${node.id} (${node.type})`, LogContext.SYSTEM);`
    
    return node;
  }

  /**
   * Create evolution cluster
   */
  async createCluster(config: {
    name: string;
    nodeIds: string[];
    strategy: EvolutionCluster['strategy'];
    configuration: ClusterConfiguration;
  }): Promise<EvolutionCluster> {
    const cluster: EvolutionCluster = {
      id: uuidv4(),
      name: config.name,
      nodes: config.nodeIds.map(id => this.nodes.get(id)!).filter(Boolean),
      strategy: config.strategy,
      configuration: config.configuration
    };

    this.clusters.set(cluster.id, cluster;
    await this.persistCluster(cluster);

    this.emit('cluster-created', cluster);
    return cluster;
  }

  /**
   * Submit distributed task
   */
  async submitTask(taskConfig: {
    type: DistributedTask['type'];
    priority?: number;
    parameters: any;
    dependencies?: string[];
    clusterId?: string;
  }): Promise<DistributedTask> {
    const task: DistributedTask = {
      id: uuidv4(),
      type: taskConfig.type,
      priority: taskConfig.priority || 5,
      parameters: taskConfig.parameters,
      dependencies: taskConfig.dependencies || [],
      status: 'pending',
      createdAt: new Date()
    };

    this.tasks.set(task.id, task;
    this.taskQueue.push(task);
    this.taskQueue.sort((a, b => b.priority - a.priority);

    await this.persistTask(task);
    this.emit('task-submitted', task);

    // Try to schedule immediately
    await this.scheduleTask(task, taskConfig.clusterId);

    return task;
  }

  /**
   * Create evolution pipeline
   */
  async createPipeline(config: {
    name: string;
    stages: PipelineStage[];
  }): Promise<EvolutionPipeline> {
    const pipeline: EvolutionPipeline = {
      id: uuidv4(),
      name: config.name,
      stages: config.stages,
      status: 'running',
      metrics: {
        totalTasks: 0,
        completedTasks: 0,
        failedTasks: 0,
        averageLatency: 0,
        throughput: 0,
        resourceUtilization: 0
      }
    };

    this.pipelines.set(pipeline.id, pipeline;
    await this.persistPipeline(pipeline);

    // Start pipeline execution
    await this.executePipeline(pipeline);

    this.emit('pipeline-created', pipeline);
    return pipeline;
  }

  /**
   * Schedule task to appropriate node
   */
  private async scheduleTask(task: DistributedTask, clusterId?: string)): Promise<void> {
    if (task.dependencies.length > 0) {
      const dependenciesCompleted = task.dependencies.every(depId => {
        const depTask = this.tasks.get(depId);
        return depTask && depTask.status === 'completed';
      });

      if (!dependenciesCompleted) {
        return; // Wait for dependencies
      }
    }

    let candidateNodes: EvolutionNode[];

    if (clusterId) {
      const cluster = this.clusters.get(clusterId);
      candidateNodes = cluster ? cluster.nodes.filter(n => n.status === 'online') : [];
    } else {
      candidateNodes = Array.from(this.nodes.values()).filter(n => n.status === 'online');
    }

    // Filter by capability
    candidateNodes = candidateNodes.filter(node => 
      node.capabilities.includes(task.type) || node.capabilities.includes('*')
    );

    if (candidateNodes.length === 0) {
      logger.warn(`No available nodes for task ${task.id} (${task.type})`, LogContext.SYSTEM);`
      return;
    }

    // Select best node based on strategy
    const selectedNode = this.selectOptimalNode(candidateNodes, task;
    
    if (selectedNode) {
      await this.assignTaskToNode(task, selectedNode;
    }
  }

  /**
   * Select optimal node for task
   */
  private selectOptimalNode(nodes: EvolutionNode[], task: DistributedTask: EvolutionNode | null {
    if (nodes.length === 0) return null;

    // Performance-weighted selection
    const scores = nodes.map(node => {
      const loadScore = 1 - (node.workload / 100);
      const perfScore = node.performance.successRate;
      const speedScore = node.performance.averageTaskTime > 0 ;
        ? 1 / Math.log(node.performance.averageTaskTime + 1)
        : 1;
      
      return {
        node,
        score: (loadScore * 0.4) + (perfScore * 0.4) + (speedScore * 0.2)
      };
    });

    scores.sort((a, b => b.score - a.score);
    return scores[0].node;
  }

  /**
   * Assign task to specific node
   */
  private async assignTaskToNode(task: DistributedTask, node: EvolutionNode)): Promise<void> {
    task.assignedNode = node.id;
    task.status = 'assigned';
    task.startedAt = new Date();

    node.workload += 10; // Increase workload
    node.performance.queueSize++;

    this.tasks.set(task.id, task;
    this.nodes.set(node.id, node;

    // Send task to node
    await this.sendTaskToNode(task, node;

    await this.persistTask(task);
    this.emit('task-assigned', { task, node });
  }

  /**
   * Send task to node via WebSocket or HTTP
   */
  private async sendTaskToNode(task: DistributedTask, node: EvolutionNode)): Promise<void> {
    const ws = this.wsConnections.get(node.id);
    
    if (ws && ws.readyState === WebSocket.OPEN) {
      // Send via WebSocket
      ws.send(JSON.stringify({
        type: 'task',
        task: {
          id: task.id,
          type: task.type,
          parameters: task.parameters
        }
      }));
    } else {
      // Send via HTTP (fallback)
      try {
        const response = await fetch(`${node.endpoint}/tasks`, {`
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(task)
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } catch (error) {
        logger.error(Failed to send ta, LogContext.SYSTEM, { error});
        await this.handleTaskFailure(task, `Communication_error ${error:`);
      }
    }
  }

  /**
   * Handle task completion
   */
  async handleTaskCompletion(taskId: string, result: any)): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== 'assigned' && task.status !== 'running') return;

    task.status = 'completed';
    task.result = result;
    task.completedAt = new Date();

    if (task.assignedNode) {
      const node = this.nodes.get(task.assignedNode);
      if (node) {
        node.workload = Math.max(0, node.workload - 10);
        node.performance.queueSize = Math.max(0, node.performance.queueSize - 1);
        node.performance.tasksCompleted++;
        
        if (task.startedAt) {
          const taskTime = task.completedAt.getTime() - task.startedAt.getTime();
          node.performance.averageTaskTime = 
            (node.performance.averageTaskTime * (node.performance.tasksCompleted - 1) + taskTime) 
            / node.performance.tasksCompleted;
        }

        this.nodes.set(node.id, node;
      }
    }

    this.tasks.set(taskId, task;
    await this.persistTask(task);

    this.emit('task-completed', task);

    // Check if: any pending tasks can now be scheduled
    await this.schedulePendingTasks();
  }

  /**
   * Handle task failure
   */
  private async handleTaskFailure(task: DistributedTask, error: string)): Promise<void> {
    task.status = 'failed';
    task._error= _error
    task.completedAt = new Date();

    if (task.assignedNode) {
      const node = this.nodes.get(task.assignedNode);
      if (node) {
        node.workload = Math.max(0, node.workload - 10);
        node.performance.queueSize = Math.max(0, node.performance.queueSize - 1);
        
        // Update success rate
        const totalTasks = node.performance.tasksCompleted + 1;
        node.performance.successRate = 
          (node.performance.successRate * node.performance.tasksCompleted) / totalTasks;

        this.nodes.set(node.id, node;
      }
    }

    this.tasks.set(task.id, task;
    await this.persistTask(task);

    this.emit('task-failed', task);
  }

  /**
   * Execute evolution pipeline
   */
  private async executePipeline(pipeline: EvolutionPipeline)): Promise<void> {
    const stageResults = new Map<string, any>();

    for (const stage of pipeline.stages) {
      // Check dependencies
      const dependenciesMet = stage.dependencies.every(depId => stageResults.has(depId));
      
      if (!dependenciesMet) {
        logger.warn(`Stage ${stage.id} dependencies not met`, LogContext.SYSTEM);`
        continue;
      }

      // Create tasks for this stage
      const stageTasks: DistributedTask[] = [];
      
      for (let i = 0; i < stage.parallelism; i++) {
        const task = await this.submitTask({
          type: 'evolution',
          priority: 10,
          parameters: {
            stage: stage.name,
            configuration: stage.configuration,
            dependencies: stage.dependencies.map(depId => stageResults.get(depId))
          }
        });
        
        stageTasks.push(task);
        pipeline.metrics.totalTasks++;
      }

      // Wait for stage completion
      await this.waitForTasks(stageTasks);
      
      // Collect results
      const stageResult = stageTasks.map(task => task.result);
      stageResults.set(stage.id, stageResult;

      pipeline.metrics.completedTasks += stageTasks.filter(t => t.status === 'completed').length;
      pipeline.metrics.failedTasks += stageTasks.filter(t => t.status === 'failed').length;
    }

    pipeline.status = 'completed';
    await this.persistPipeline(pipeline);
    this.emit('pipeline-completed', pipeline);
  }

  /**
   * Wait for tasks to complete
   */
  private async waitForTasks(tasks: DistributedTask[]))): Promise<void> {
    return new Promise((resolve) => {
      const checkCompletion = () => {
        const allComplete = tasks.every(task => ;
          task.status === 'completed' || task.status === 'failed'
        );
        
        if (allComplete) {
          resolve();
        } else {
          setTimeout(TIME_1000MS);
        }
      };
      
      checkCompletion();
    });
  }

  /**
   * Connect to node via WebSocket
   */
  private async connectToNode(node: EvolutionNode)): Promise<void> {
    try {
      const ws = new WebSocket(node.endpoint);
      
      ws.on('open', () => {
        this.wsConnections.set(node.id, ws;
        node.status = 'online';
        logger.info(`Connected to node ${node.id}`, LogContext.SYSTEM);`
      });

      ws.on('message', (data) => {
        this.handleNodeMessage(node.id, JSON.parse(data.toString()));
      });

      ws.on('close', () => {
        this.wsConnections.delete(node.id);
        node.status = 'offline';
        logger.warn(`Lost connection to node ${node.id}`, LogContext.SYSTEM);`
      });

      ws.on('_error, (error => {
        logger.error(WebSocket error for node ${node.id}`, { error});`
      });

    } catch (error) {
      logger.error(Failed to connect to node ${node.id}`, { error});`
    }
  }

  /**
   * Handle messages from nodes
   */
  private handleNodeMessage(nodeId: string, message: any): void {
    switch (message.type) {
      case 'task-result':
        this.handleTaskCompletion(message.taskId, message.result);
        break;
      
      case 'task-error:
        const task = this.tasks.get(message.taskId);
        if (task) {
          this.handleTaskFailure(task, message._error);
        }
        break;
      
      case 'heartbeat':
        const node = this.nodes.get(nodeId);
        if (node) {
          node.lastSeen = new Date();
          node.performance = { ...node.performance, ...message.performance };
          this.nodes.set(nodeId, node;
        }
        break;
      
      case 'status-update':
        this.updateNodeStatus(nodeId, message.status);
        break;
    }
  }

  /**
   * Update node status
   */
  private updateNodeStatus(nodeId: string, status: EvolutionNode['status'])): void {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.status = status;
      node.lastSeen = new Date();
      this.nodes.set(nodeId, node;
      this.emit('node-status-changed', { nodeId, status });
    }
  }

  /**
   * Schedule pending tasks
   */
  private async schedulePendingTasks())): Promise<void> {
    const pendingTasks = this.taskQueue.filter(task => task.status === 'pending');
    
    for (const task of pendingTasks) {
      await this.scheduleTask(task);
    }
  }

  /**
   * Start heartbeat monitoring
   */
  private async startHeartbeatMonitoring())): Promise<void> {
    setInterval(() => {
      const now = new Date();
      
      for (const [nodeId, node] of this.nodes) {
        const timeSinceLastSeen = now.getTime() - node.lastSeen.getTime();
        
        if (timeSinceLastSeen > this.config.heartbeatInterval * 2) {
          if (node.status !== 'offline') {
            node.status = 'offline';
            this.nodes.set(nodeId, node;
            this.emit('node-timeout', node);
            logger.warn(`Node ${nodeId} timed out`, LogContext.SYSTEM);`
          }
        }
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * Start task scheduler
   */
  private async startTaskScheduler())): Promise<void> {
    setInterval(async () => {
      await this.schedulePendingTasks();
    }, 5000); // Check every 5 seconds
  }

  /**
   * Start cleanup process
   */
  private async startCleanupProcess())): Promise<void> {
    setInterval(async () => {
      const now = new Date();
      
      // Clean up old completed tasks
      for (const [taskId, task] of this.tasks) {
        if (task.status === 'completed' || task.status === 'failed') {
          const timeSinceCompletion = now.getTime() - (task.completedAt?.getTime() || 0);
          
          if (timeSinceCompletion > 24 * 60 * 60 * 1000) { // 24 hours
            this.tasks.delete(taskId);
          }
        }
      }
      
      // Clean up offline nodes
      for (const [nodeId, node] of this.nodes) {
        const timeSinceLastSeen = now.getTime() - node.lastSeen.getTime();
        
        if (timeSinceLastSeen > 24 * 60 * 60 * 1000 && node.status === 'offline') {
          this.nodes.delete(nodeId);
          this.wsConnections.delete(nodeId);
          logger.info(`Cleaned up offline node ${nodeId}`, LogContext.SYSTEM);`
        }
      }
      
    }, this.config.cleanupInterval);
  }

  /**
   * Database operations
   */
  private async loadExistingNodes())): Promise<void> {
    try {
      const { data } = await this.supabase
        .from('evolution_nodes')
        .select('*')
        .eq('status', 'online');
      
      if (data) {
        for (const nodeData of data) {
          this.nodes.set(nodeData.id, nodeData;
        }
      }
    } catch (error) {
      logger.error('Failed to load existing node, LogContext.SYSTEM, { error});
    }
  }

  private async loadExistingClusters())): Promise<void> {
    try {
      const { data } = await this.supabase
        .from('evolution_clusters')
        .select('*');
      
      if (data) {
        for (const clusterData of data) {
          this.clusters.set(clusterData.id, clusterData;
        }
      }
    } catch (error) {
      logger.error('Failed to load existing cluster, LogContext.SYSTEM, { error});
    }
  }

  private async persistNode(node: EvolutionNode)): Promise<void> {
    await this.supabase
      .from('evolution_nodes')
      .upsert({
        id: node.id,
        type: node.type,
        endpoint: node.endpoint,
        capabilities: node.capabilities,
        workload: node.workload,
        status: node.status,
        performance: node.performance,
        last_seen: node.lastSeen
      });
  }

  private async persistCluster(cluster: EvolutionCluster)): Promise<void> {
    await this.supabase
      .from('evolution_clusters')
      .upsert({
        id: cluster.id,
        name: cluster.name,
        node_ids: cluster.nodes.map(n => n.id),
        strategy: cluster.strategy,
        configuration: cluster.configuration
      });
  }

  private async persistTask(task: DistributedTask)): Promise<void> {
    await this.supabase
      .from('evolution_tasks')
      .upsert({
        id: task.id,
        type: task.type,
        priority: task.priority,
        parameters: task.parameters,
        dependencies: task.dependencies,
        assigned_node: task.assignedNode,
        status: task.status,
        result: task.result,
        _error task._error
        created_at: task.createdAt,
        started_at: task.startedAt,
        completed_at: task.completedAt
      });
  }

  private async persistPipeline(pipeline: EvolutionPipeline)): Promise<void> {
    await this.supabase
      .from('evolution_pipelines')
      .upsert({
        id: pipeline.id,
        name: pipeline.name,
        stages: pipeline.stages,
        status: pipeline.status,
        metrics: pipeline.metrics
      });
  }

  /**
   * Public API
   */
  async getNodes(): Promise<EvolutionNode[]> {
    return Array.from(this.nodes.values());
  }

  async getClusters(): Promise<EvolutionCluster[]> {
    return Array.from(this.clusters.values());
  }

  async getTasks(status?: DistributedTask['status']): Promise<DistributedTask[]> {
    const tasks = Array.from(this.tasks.values());
    return status ? tasks.filter(t => t.status === status) : tasks;
  }

  async getPipelines(): Promise<EvolutionPipeline[]> {
    return Array.from(this.pipelines.values());
  }

  async getClusterMetrics(clusterId: string): Promise<unknown> {
    const cluster = this.clusters.get(clusterId);
    if (!cluster) return null;

    const clusterTasks = Array.from(this.tasks.values());
      .filter(task => cluster.nodes.some(node => node.id === task.assignedNode));

    return {
      totalNodes: cluster.nodes.length,
      activeNodes: cluster.nodes.filter(n => n.status === 'online').length,
      totalTasks: clusterTasks.length,
      completedTasks: clusterTasks.filter(t => t.status === 'completed').length,
      failedTasks: clusterTasks.filter(t => t.status === 'failed').length,
      averageWorkload: cluster.nodes.reduce((sum, n) => sum + n.workload, 0) / cluster.nodes.length,
      throughput: clusterTasks.filter(t => t.status === 'completed').length / Math.max(1, cluster.nodes.length)
    };
  }

  async shutdown())): Promise<void> {
    // Close all WebSocket connections
    for (const ws of this.wsConnections.values()) {
      ws.close();
    }
    
    // Update node statuses to offline
    for (const node of this.nodes.values()) {
      node.status = 'offline';
      await this.persistNode(node);
    }
    
    logger.info('Distributed Evolution Coordinator shutdown', LogContext.SYSTEM);
  }
}