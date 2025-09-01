/**
 * Distributed AI Orchestration System
 * 
 * Coordinates AI operations across multiple nodes, services, and computing resources
 * for maximum scalability and fault tolerance.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import Redis from 'ioredis';
import { logger } from '../utils/logger';

export interface NodeCapabilities {
    id: string;
    hostname: string;
    region: string;
    availability_zone?: string;
    resources: {
        cpu_cores: number;
        memory_gb: number;
        gpu_memory_gb?: number;
        storage_gb: number;
        network_bandwidth_mbps: number;
    };
    services: {
        rust_services: boolean;
        gpu_acceleration: boolean;
        mlx_support: boolean;
        edge_computing: boolean;
    };
    current_load: {
        cpu_percent: number;
        memory_percent: number;
        gpu_percent?: number;
        active_tasks: number;
    };
    health_status: 'healthy' | 'degraded' | 'unhealthy';
    last_heartbeat: Date;
}

export interface DistributedTask {
    id: string;
    type: 'inference' | 'training' | 'analysis' | 'orchestration';
    priority: 'low' | 'medium' | 'high' | 'critical';
    requirements: {
        min_cpu_cores: number;
        min_memory_gb: number;
        gpu_required?: boolean;
        min_gpu_memory_gb?: number;
        rust_services_required?: boolean;
        estimated_duration_ms: number;
        max_latency_ms?: number;
    };
    payload: any;
    routing_preferences?: {
        preferred_regions?: string[];
        avoid_regions?: string[];
        affinity_node_id?: string;
        anti_affinity_node_ids?: string[];
    };
    created_at: Date;
    scheduled_at?: Date;
    started_at?: Date;
    completed_at?: Date;
    failed_at?: Date;
    result?: any;
    error?: string;
}

export interface OrchestrationMetrics {
    total_nodes: number;
    healthy_nodes: number;
    total_tasks_queued: number;
    total_tasks_running: number;
    total_tasks_completed: number;
    total_tasks_failed: number;
    average_task_duration_ms: number;
    average_queue_time_ms: number;
    resource_utilization: {
        cpu_percent: number;
        memory_percent: number;
        gpu_percent?: number;
    };
    throughput_tasks_per_second: number;
}

export class DistributedCoordinator extends EventEmitter {
    private redis: Redis;
    private nodes: Map<string, NodeCapabilities> = new Map();
    private taskQueue: DistributedTask[] = [];
    private runningTasks: Map<string, DistributedTask> = new Map();
    private completedTasks: Map<string, DistributedTask> = new Map();
    private nodeHeartbeatInterval!: NodeJS.Timeout;
    private taskSchedulerInterval!: NodeJS.Timeout;
    private metricsInterval!: NodeJS.Timeout;
    private readonly config: {
        heartbeat_interval_ms: number;
        task_scheduler_interval_ms: number;
        metrics_interval_ms: number;
        node_timeout_ms: number;
        max_retries: number;
    };

    constructor(redisConfig?: any) {
        super();
        
        this.redis = new Redis(redisConfig || {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            retryDelayOnFailover: 100,
            enableReadyCheck: false,
            maxRetriesPerRequest: null,
        });

        this.config = {
            heartbeat_interval_ms: 30000, // 30 seconds
            task_scheduler_interval_ms: 1000, // 1 second
            metrics_interval_ms: 60000, // 1 minute
            node_timeout_ms: 90000, // 90 seconds
            max_retries: 3,
        };

        this.initialize();
    }

    private async initialize(): Promise<void> {
        try {
            // Subscribe to distributed events
            await this.redis.subscribe(
                'orchestration:heartbeat',
                'orchestration:task:result',
                'orchestration:task:failed',
                'orchestration:node:joined',
                'orchestration:node:left'
            );

            this.redis.on('message', this.handleRedisMessage.bind(this));

            // Start background processes
            this.startHeartbeatMonitor();
            this.startTaskScheduler();
            this.startMetricsCollector();

            // Register this node
            await this.registerNode(this.getLocalNodeCapabilities());

            logger.info('Distributed AI Coordinator initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize Distributed Coordinator:', error);
            throw error;
        }
    }

    /**
     * Register a new node in the distributed system
     */
    async registerNode(node: NodeCapabilities): Promise<void> {
        try {
            node.last_heartbeat = new Date();
            this.nodes.set(node.id, node);

            // Store in Redis for persistence
            await this.redis.hset('orchestration:nodes', node.id, JSON.stringify(node));
            
            // Announce node joining
            await this.redis.publish('orchestration:node:joined', JSON.stringify(node));

            this.emit('nodeJoined', node);
            logger.info(`Node ${node.id} registered successfully`);
        } catch (error) {
            logger.error(`Failed to register node ${node.id}:`, error);
            throw error;
        }
    }

    /**
     * Remove a node from the distributed system
     */
    async unregisterNode(nodeId: string): Promise<void> {
        try {
            const node = this.nodes.get(nodeId);
            if (!node) return;

            // Move running tasks back to queue
            for (const [taskId, task] of this.runningTasks.entries()) {
                if (task.routing_preferences?.affinity_node_id === nodeId) {
                    task.routing_preferences.affinity_node_id = undefined;
                    this.taskQueue.unshift(task);
                    this.runningTasks.delete(taskId);
                }
            }

            this.nodes.delete(nodeId);
            await this.redis.hdel('orchestration:nodes', nodeId);
            await this.redis.publish('orchestration:node:left', JSON.stringify({ id: nodeId }));

            this.emit('nodeLeft', { id: nodeId });
            logger.info(`Node ${nodeId} unregistered`);
        } catch (error) {
            logger.error(`Failed to unregister node ${nodeId}:`, error);
        }
    }

    /**
     * Submit a task for distributed execution
     */
    async submitTask(task: Omit<DistributedTask, 'id' | 'created_at'>): Promise<string> {
        const fullTask: DistributedTask = {
            ...task,
            id: uuidv4(),
            created_at: new Date(),
        };

        // Add to queue
        this.taskQueue.push(fullTask);

        // Store in Redis for persistence
        await this.redis.hset('orchestration:tasks:queued', fullTask.id, JSON.stringify(fullTask));

        logger.info(`Task ${fullTask.id} submitted for distributed execution`);
        this.emit('taskSubmitted', fullTask);

        return fullTask.id;
    }

    /**
     * Get task status and result
     */
    async getTaskStatus(taskId: string): Promise<{
        status: 'queued' | 'running' | 'completed' | 'failed';
        task: DistributedTask | null;
    }> {
        // Check running tasks
        if (this.runningTasks.has(taskId)) {
            return { status: 'running', task: this.runningTasks.get(taskId)! };
        }

        // Check completed tasks
        if (this.completedTasks.has(taskId)) {
            const task = this.completedTasks.get(taskId)!;
            return { 
                status: task.failed_at ? 'failed' : 'completed', 
                task 
            };
        }

        // Check queued tasks
        const queuedTask = this.taskQueue.find(task => task.id === taskId);
        if (queuedTask) {
            return { status: 'queued', task: queuedTask };
        }

        return { status: 'completed', task: null };
    }

    /**
     * Intelligent node selection based on task requirements
     */
    private selectOptimalNode(task: DistributedTask): NodeCapabilities | null {
        const availableNodes = Array.from(this.nodes.values())
            .filter(node => {
                // Check health
                if (node.health_status !== 'healthy') return false;

                // Check heartbeat timeout
                const timeSinceHeartbeat = Date.now() - node.last_heartbeat.getTime();
                if (timeSinceHeartbeat > this.config.node_timeout_ms) return false;

                // Check resource requirements
                const availableCpu = node.resources.cpu_cores * (1 - node.current_load.cpu_percent / 100);
                const availableMemory = node.resources.memory_gb * (1 - node.current_load.memory_percent / 100);

                if (availableCpu < task.requirements.min_cpu_cores) return false;
                if (availableMemory < task.requirements.min_memory_gb) return false;

                // Check GPU requirements
                if (task.requirements.gpu_required) {
                    if (!node.resources.gpu_memory_gb) return false;
                    if (!node.services.gpu_acceleration) return false;
                    
                    const availableGpu = node.resources.gpu_memory_gb * (1 - (node.current_load.gpu_percent || 0) / 100);
                    if (availableGpu < (task.requirements.min_gpu_memory_gb || 0)) return false;
                }

                // Check Rust services requirement
                if (task.requirements.rust_services_required && !node.services.rust_services) {
                    return false;
                }

                return true;
            });

        if (availableNodes.length === 0) return null;

        // Apply routing preferences
        let candidateNodes = availableNodes;

        if (task.routing_preferences) {
            // Affinity node preference
            if (task.routing_preferences?.affinity_node_id) {
                const affinityNode = candidateNodes.find(n => n.id === task.routing_preferences!.affinity_node_id);
                if (affinityNode) return affinityNode;
            }

            // Regional preferences
            if (task.routing_preferences?.preferred_regions) {
                const preferredNodes = candidateNodes.filter(n => 
                    task.routing_preferences!.preferred_regions!.includes(n.region)
                );
                if (preferredNodes.length > 0) candidateNodes = preferredNodes;
            }

            // Anti-affinity
            if (task.routing_preferences?.anti_affinity_node_ids) {
                candidateNodes = candidateNodes.filter(n => 
                    !task.routing_preferences!.anti_affinity_node_ids!.includes(n.id)
                );
            }

            // Avoid regions
            if (task.routing_preferences?.avoid_regions) {
                candidateNodes = candidateNodes.filter(n => 
                    !task.routing_preferences!.avoid_regions!.includes(n.region)
                );
            }
        }

        // Score nodes based on multiple factors
        const scoredNodes = candidateNodes.map(node => {
            let score = 0;

            // Load balancing (prefer less loaded nodes)
            score += (100 - node.current_load.cpu_percent) * 0.3;
            score += (100 - node.current_load.memory_percent) * 0.3;
            score += (100 - (node.current_load.gpu_percent || 0)) * 0.2;

            // Task queue length (prefer nodes with fewer tasks)
            score += Math.max(0, 100 - node.current_load.active_tasks * 10) * 0.1;

            // Priority boost for high-performance capabilities
            if (node.services.rust_services) score += 10;
            if (node.services.gpu_acceleration && task.requirements.gpu_required) score += 15;
            if (node.services.mlx_support) score += 5;

            return { node, score };
        });

        // Sort by score and return best node
        scoredNodes.sort((a, b) => b.score - a.score);
        return scoredNodes[0]?.node || null;
    }

    /**
     * Task scheduler - runs periodically to assign tasks to nodes
     */
    private async scheduleNextTask(): Promise<void> {
        if (this.taskQueue.length === 0) return;

        // Sort tasks by priority and creation time
        this.taskQueue.sort((a, b) => {
            const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
            const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
            if (priorityDiff !== 0) return priorityDiff;
            return a.created_at.getTime() - b.created_at.getTime();
        });

        const task = this.taskQueue[0];
        if (!task) {
            return; // No tasks in queue
        }

        const selectedNode = this.selectOptimalNode(task);

        if (!selectedNode) {
            // No suitable node available, wait for next cycle
            return;
        }

        // Remove from queue and add to running tasks
        this.taskQueue.shift();
        task.scheduled_at = new Date();
        task.started_at = new Date();
        this.runningTasks.set(task.id, task);

        // Update node load
        selectedNode.current_load.active_tasks++;

        // Dispatch task to selected node
        await this.dispatchTask(task, selectedNode);

        logger.info(`Task ${task.id} scheduled to node ${selectedNode.id}`);
        this.emit('taskScheduled', { task, node: selectedNode });
    }

    /**
     * Dispatch task to a specific node
     */
    private async dispatchTask(task: DistributedTask, node: NodeCapabilities): Promise<void> {
        try {
            // Send task to node via Redis pub/sub
            await this.redis.publish(
                `orchestration:node:${node.id}:task`, 
                JSON.stringify(task)
            );

            // Update task tracking
            await this.redis.hdel('orchestration:tasks:queued', task.id);
            await this.redis.hset('orchestration:tasks:running', task.id, JSON.stringify(task));
        } catch (error) {
            logger.error(`Failed to dispatch task ${task.id} to node ${node.id}:`, error);
            
            // Return task to queue
            this.taskQueue.unshift(task);
            this.runningTasks.delete(task.id);
            node.current_load.active_tasks--;
        }
    }

    /**
     * Handle Redis messages for distributed coordination
     */
    private async handleRedisMessage(channel: string, message: string): Promise<void> {
        try {
            const data = JSON.parse(message);

            switch (channel) {
                case 'orchestration:heartbeat':
                    await this.handleNodeHeartbeat(data);
                    break;

                case 'orchestration:task:result':
                    await this.handleTaskResult(data);
                    break;

                case 'orchestration:task:failed':
                    await this.handleTaskFailed(data);
                    break;

                case 'orchestration:node:joined':
                    this.emit('nodeJoined', data);
                    break;

                case 'orchestration:node:left':
                    this.emit('nodeLeft', data);
                    break;
            }
        } catch (error) {
            logger.error(`Failed to handle Redis message on channel ${channel}:`, error);
        }
    }

    /**
     * Handle node heartbeat updates
     */
    private async handleNodeHeartbeat(heartbeat: {
        node_id: string;
        capabilities: NodeCapabilities;
    }): Promise<void> {
        const { node_id, capabilities } = heartbeat;
        
        capabilities.last_heartbeat = new Date();
        this.nodes.set(node_id, capabilities);
        
        // Update in Redis
        await this.redis.hset('orchestration:nodes', node_id, JSON.stringify(capabilities));
    }

    /**
     * Handle task completion
     */
    private async handleTaskResult(result: {
        task_id: string;
        node_id: string;
        result: any;
        execution_time_ms: number;
    }): Promise<void> {
        const { task_id, node_id, result: taskResult, execution_time_ms } = result;
        
        const task = this.runningTasks.get(task_id);
        if (!task) return;

        // Update task
        task.completed_at = new Date();
        task.result = taskResult;

        // Move to completed tasks
        this.runningTasks.delete(task_id);
        this.completedTasks.set(task_id, task);

        // Update node load
        const node = this.nodes.get(node_id);
        if (node) {
            node.current_load.active_tasks--;
        }

        // Update Redis
        await this.redis.hdel('orchestration:tasks:running', task_id);
        await this.redis.hset('orchestration:tasks:completed', task_id, JSON.stringify(task));

        logger.info(`Task ${task_id} completed on node ${node_id} in ${execution_time_ms}ms`);
        this.emit('taskCompleted', { task, node_id, execution_time_ms });
    }

    /**
     * Handle task failure
     */
    private async handleTaskFailed(failure: {
        task_id: string;
        node_id: string;
        error: string;
    }): Promise<void> {
        const { task_id, node_id, error } = failure;
        
        const task = this.runningTasks.get(task_id);
        if (!task) return;

        // Update task
        task.failed_at = new Date();
        task.error = error;

        // Move to completed tasks (with failure status)
        this.runningTasks.delete(task_id);
        this.completedTasks.set(task_id, task);

        // Update node load
        const node = this.nodes.get(node_id);
        if (node) {
            node.current_load.active_tasks--;
        }

        // Update Redis
        await this.redis.hdel('orchestration:tasks:running', task_id);
        await this.redis.hset('orchestration:tasks:failed', task_id, JSON.stringify(task));

        logger.error(`Task ${task_id} failed on node ${node_id}: ${error}`);
        this.emit('taskFailed', { task, node_id, error });
    }

    /**
     * Start heartbeat monitoring
     */
    private startHeartbeatMonitor(): void {
        this.nodeHeartbeatInterval = setInterval(async () => {
            const now = Date.now();
            const timeoutNodes: string[] = [];

            for (const [nodeId, node] of this.nodes.entries()) {
                const timeSinceHeartbeat = now - node.last_heartbeat.getTime();
                if (timeSinceHeartbeat > this.config.node_timeout_ms) {
                    timeoutNodes.push(nodeId);
                }
            }

            // Remove timed out nodes
            for (const nodeId of timeoutNodes) {
                await this.unregisterNode(nodeId);
            }
        }, this.config.heartbeat_interval_ms);
    }

    /**
     * Start task scheduler
     */
    private startTaskScheduler(): void {
        this.taskSchedulerInterval = setInterval(async () => {
            try {
                await this.scheduleNextTask();
            } catch (error) {
                logger.error('Task scheduler error:', error);
            }
        }, this.config.task_scheduler_interval_ms);
    }

    /**
     * Start metrics collector
     */
    private startMetricsCollector(): void {
        this.metricsInterval = setInterval(async () => {
            const metrics = this.getMetrics();
            await this.redis.set('orchestration:metrics', JSON.stringify(metrics));
            this.emit('metricsUpdated', metrics);
        }, this.config.metrics_interval_ms);
    }

    /**
     * Get current orchestration metrics
     */
    getMetrics(): OrchestrationMetrics {
        const nodes = Array.from(this.nodes.values());
        const healthyNodes = nodes.filter(n => n.health_status === 'healthy');
        
        const totalCpu = nodes.reduce((sum, n) => sum + n.current_load.cpu_percent, 0);
        const totalMemory = nodes.reduce((sum, n) => sum + n.current_load.memory_percent, 0);
        const totalGpu = nodes.reduce((sum, n) => sum + (n.current_load.gpu_percent || 0), 0);

        // Calculate task durations for completed tasks in the last hour
        const oneHourAgo = Date.now() - 3600000;
        const recentTasks = Array.from(this.completedTasks.values())
            .filter(task => task.completed_at && task.completed_at.getTime() > oneHourAgo);
        
        const avgTaskDuration = recentTasks.length > 0 
            ? recentTasks.reduce((sum, task) => {
                const duration = task.completed_at!.getTime() - task.started_at!.getTime();
                return sum + duration;
            }, 0) / recentTasks.length
            : 0;

        const avgQueueTime = recentTasks.length > 0
            ? recentTasks.reduce((sum, task) => {
                const queueTime = task.started_at!.getTime() - task.created_at.getTime();
                return sum + queueTime;
            }, 0) / recentTasks.length
            : 0;

        return {
            total_nodes: nodes.length,
            healthy_nodes: healthyNodes.length,
            total_tasks_queued: this.taskQueue.length,
            total_tasks_running: this.runningTasks.size,
            total_tasks_completed: this.completedTasks.size,
            total_tasks_failed: Array.from(this.completedTasks.values()).filter(t => t.failed_at).length,
            average_task_duration_ms: avgTaskDuration,
            average_queue_time_ms: avgQueueTime,
            resource_utilization: {
                cpu_percent: nodes.length > 0 ? totalCpu / nodes.length : 0,
                memory_percent: nodes.length > 0 ? totalMemory / nodes.length : 0,
                gpu_percent: nodes.length > 0 ? totalGpu / nodes.length : undefined,
            },
            throughput_tasks_per_second: recentTasks.length / 3600, // Tasks per hour to tasks per second
        };
    }

    /**
     * Get local node capabilities
     */
    private getLocalNodeCapabilities(): NodeCapabilities {
        const os = require('os');
        
        return {
            id: `node-${os.hostname()}-${Date.now()}`,
            hostname: os.hostname(),
            region: process.env.NODE_REGION || 'us-west-2',
            availability_zone: process.env.NODE_AZ,
            resources: {
                cpu_cores: os.cpus().length,
                memory_gb: Math.round(os.totalmem() / (1024 * 1024 * 1024)),
                gpu_memory_gb: this.detectGpuMemory(),
                storage_gb: 100, // Would need to detect actual storage
                network_bandwidth_mbps: 1000, // Would need to detect actual bandwidth
            },
            services: {
                rust_services: true, // We have Rust services implemented
                gpu_acceleration: this.detectGpuAcceleration(),
                mlx_support: process.platform === 'darwin', // MLX is Apple-specific
                edge_computing: false,
            },
            current_load: {
                cpu_percent: 0,
                memory_percent: (1 - os.freemem() / os.totalmem()) * 100,
                gpu_percent: 0,
                active_tasks: 0,
            },
            health_status: 'healthy',
            last_heartbeat: new Date(),
        };
    }

    /**
     * Detect GPU memory (simplified)
     */
    private detectGpuMemory(): number | undefined {
        // This would need platform-specific GPU detection
        // For now, assume 8GB if on macOS (Apple Silicon)
        if (process.platform === 'darwin') {
            return 8;
        }
        return undefined;
    }

    /**
     * Detect GPU acceleration capability
     */
    private detectGpuAcceleration(): boolean {
        // Check for Metal (macOS), CUDA, or OpenCL
        return process.platform === 'darwin' || // Metal on macOS
               process.env.CUDA_VISIBLE_DEVICES !== undefined; // CUDA
    }

    /**
     * Cleanup resources
     */
    async shutdown(): Promise<void> {
        clearInterval(this.nodeHeartbeatInterval);
        clearInterval(this.taskSchedulerInterval);
        clearInterval(this.metricsInterval);
        
        await this.redis.quit();
        logger.info('Distributed Coordinator shut down');
    }
}

// Export singleton instance
export const distributedCoordinator = new DistributedCoordinator();