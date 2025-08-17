/**
 * Enhanced Agent Orchestration Router for Arc UI
 * 
 * Provides comprehensive agent monitoring, coordination, and real-time WebSocket updates
 * for the Arc UI dashboard including network topology, performance analytics, and workflow coordination.
 */

import { EventEmitter } from 'events';
import type { Request, Response} from 'express';
import { Router } from 'express';
import { WebSocket } from 'ws';

// No enhanced validation import needed - using simple response format
import { AgentRegistry } from '@/agents/agent-registry';
import { authenticate } from '@/middleware/auth';
import { a2aMesh } from '@/services/a2a-communication-mesh';
import { type AgentCategory,type AgentDefinition } from '@/types';
import { log, LogContext } from '@/utils/logger';

const router = Router();

// Event emitter for real-time updates
const orchestrationEvents = new EventEmitter();

// WebSocket connections for real-time updates
const wsConnections = new Set<WebSocket>();

// Performance metrics storage
interface AgentMetrics {
  agentName: string;
  totalRequests: number;
  averageResponseTime: number;
  successRate: number;
  errorCount: number;
  lastActive: Date;
  cpuUsage: number;
  memoryUsage: number;
  queueLength: number;
  collaborationCount: number;
}

interface NetworkTopology {
  nodes: Array<{
    id: string;
    name: string;
    category: AgentCategory;
    status: 'online' | 'busy' | 'offline';
    capabilities: string[];
    trustLevel: number;
    collaborationScore: number;
    position?: { x: number; y: number };
  }>;
  edges: Array<{
    source: string;
    target: string;
    type: 'communication' | 'dependency' | 'collaboration';
    weight: number;
    lastActive: Date;
  }>;
}

interface AgentTask {
  id: string;
  agentName: string;
  type: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  priority: number;
  startTime?: Date;
  endTime?: Date;
  estimatedDuration?: number;
  context: any;
  result?: any;
  error?: string;
}

// In-memory storage for metrics and tasks (should use Redis in production)
const agentMetrics = new Map<string, AgentMetrics>();
const activeTasks = new Map<string, AgentTask>();
const taskHistory: AgentTask[] = [];

// Initialize agent registry singleton
const agentRegistry = new AgentRegistry();

/**
 * Middleware for WebSocket upgrade handling
 */
function setupWebSocketOrchestration(server: any) {
  const wss = new WebSocket.Server({ server, path: '/ws/orchestration' });
  
  wss.on('connection', (ws: WebSocket) => {
    wsConnections.add(ws);
    log.info('New WebSocket connection for orchestration', LogContext.AGENT);
    
    // Send initial state
    ws.send(JSON.stringify({
      type: 'initial_state',
      data: {
        topology: generateNetworkTopology(),
        metrics: Array.from(agentMetrics.values()),
        meshStatus: a2aMesh.getMeshStatus(),
        activeTasks: Array.from(activeTasks.values())
      }
    }));
    
    ws.on('close', () => {
      wsConnections.delete(ws);
      log.info('WebSocket connection closed for orchestration', LogContext.AGENT);
    });
  });
  
  // Set up real-time event broadcasting
  setupRealTimeEvents();
}

/**
 * Set up real-time event listeners and broadcasting
 */
function setupRealTimeEvents() {
  // Listen to agent registry events
  agentRegistry.on('agent_loaded', (data) => {
    broadcastToClients({
      type: 'agent_loaded',
      data: {
        agentName: data.agentName,
        timestamp: new Date()
      }
    });
    updateAgentMetrics(data.agentName, 'loaded');
  });

  agentRegistry.on('agent_unloaded', (data) => {
    broadcastToClients({
      type: 'agent_unloaded',
      data: {
        agentName: data.agentName,
        timestamp: new Date()
      }
    });
  });

  // Listen to A2A mesh events
  a2aMesh.on('message', (data) => {
    broadcastToClients({
      type: 'agent_communication',
      data: {
        from: data.message.from,
        to: data.message.to,
        type: data.message.type,
        timestamp: data.message.timestamp
      }
    });
  });

  // Periodic updates every 5 seconds
  setInterval(() => {
    const topology = generateNetworkTopology();
    const meshStatus = a2aMesh.getMeshStatus();
    
    broadcastToClients({
      type: 'periodic_update',
      data: {
        topology,
        meshStatus,
        metrics: Array.from(agentMetrics.values()),
        timestamp: new Date()
      }
    });
  }, 5000);
}

/**
 * Broadcast data to all connected WebSocket clients
 */
function broadcastToClients(data: any) {
  const message = JSON.stringify(data);
  wsConnections.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  });
}

/**
 * Generate network topology for visualization
 */
function generateNetworkTopology(): NetworkTopology {
  const agents = agentRegistry.getAvailableAgents();
  const connections = a2aMesh.getAgentConnections();
  const loadedAgents = agentRegistry.getLoadedAgents();
  
  const nodes = agents.map(agent => {
    const connection = connections.find(c => c.agentName === agent.name);
    const isLoaded = loadedAgents.includes(agent.name);
    
    return {
      id: agent.name,
      name: agent.name,
      category: agent.category,
      status: connection?.status || (isLoaded ? 'online' : 'offline'),
      capabilities: agent.capabilities,
      trustLevel: connection?.trustLevel || 0.8,
      collaborationScore: connection?.collaborationScore || 0,
      position: generateNodePosition(agent.name, agent.category)
    };
  });
  
  const edges: NetworkTopology['edges'] = [];
  
  // Add dependency edges
  agents.forEach(agent => {
    agent.dependencies.forEach(dep => {
      edges.push({
        source: dep,
        target: agent.name,
        type: 'dependency',
        weight: 1,
        lastActive: new Date()
      });
    });
  });
  
  // Add communication edges from A2A mesh history
  // This would typically come from message history analysis
  connections.forEach(conn => {
    if (conn.messageQueue.length > 0) {
      edges.push({
        source: 'system',
        target: conn.agentName,
        type: 'communication',
        weight: conn.messageQueue.length,
        lastActive: conn.lastSeen
      });
    }
  });
  
  return { nodes, edges };
}

/**
 * Generate node positions for network visualization
 */
function generateNodePosition(agentName: string, category: AgentCategory): { x: number; y: number } {
  // Simple layout algorithm based on category
  const categoryOffsets = {
    core: { x: 200, y: 200 },
    cognitive: { x: 400, y: 150 },
    personal: { x: 300, y: 300 },
    specialized: { x: 500, y: 250 },
    utility: { x: 150, y: 350 }
  };
  
  const baseOffset = categoryOffsets[category] || { x: 300, y: 250 };
  const hash = agentName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  
  return {
    x: baseOffset.x + (hash % 100) - 50,
    y: baseOffset.y + ((hash * 7) % 100) - 50
  };
}

/**
 * Update agent metrics
 */
function updateAgentMetrics(agentName: string, event: string, responseTime?: number, success = true) {
  const existing = agentMetrics.get(agentName) || {
    agentName,
    totalRequests: 0,
    averageResponseTime: 0,
    successRate: 1,
    errorCount: 0,
    lastActive: new Date(),
    cpuUsage: Math.random() * 30 + 10, // Simulated for now
    memoryUsage: Math.random() * 100 + 50, // Simulated for now
    queueLength: 0,
    collaborationCount: 0
  };
  
  if (event === 'request') {
    existing.totalRequests++;
    existing.lastActive = new Date();
    
    if (responseTime) {
      existing.averageResponseTime = 
        (existing.averageResponseTime * (existing.totalRequests - 1) + responseTime) / existing.totalRequests;
    }
    
    if (!success) {
      existing.errorCount++;
    }
    
    existing.successRate = (existing.totalRequests - existing.errorCount) / existing.totalRequests;
  }
  
  agentMetrics.set(agentName, existing);
}

/**
 * Get real-time agent status and health monitoring
 */
router.get('/status', authenticate, async (req: Request, res: Response) => {
  try {
    const agents = agentRegistry.getAvailableAgents();
    const loadedAgents = agentRegistry.getLoadedAgents();
    const meshStatus = a2aMesh.getMeshStatus();
    const connections = a2aMesh.getAgentConnections();
    
    const agentStatus = agents.map(agent => {
      const isLoaded = loadedAgents.includes(agent.name);
      const connection = connections.find(c => c.agentName === agent.name);
      const metrics = agentMetrics.get(agent.name);
      
      return {
        name: agent.name,
        category: agent.category,
        description: agent.description,
        priority: agent.priority,
        capabilities: agent.capabilities,
        isLoaded,
        status: connection?.status || (isLoaded ? 'online' : 'offline'),
        lastSeen: connection?.lastSeen,
        trustLevel: connection?.trustLevel || 0.8,
        collaborationScore: connection?.collaborationScore || 0,
        queueLength: connection?.messageQueue?.length || 0,
        metrics: metrics || null,
        dependencies: agent.dependencies,
        maxLatencyMs: agent.maxLatencyMs,
        retryAttempts: agent.retryAttempts
      };
    });
    
    res.json({
      success: true,
      data: {
        agents: agentStatus,
        meshStatus,
        summary: {
          totalAgents: agents.length,
          loadedAgents: loadedAgents.length,
          onlineAgents: agentStatus.filter(a => a.status === 'online').length,
          busyAgents: agentStatus.filter(a => a.status === 'busy').length,
          offlineAgents: agentStatus.filter(a => a.status === 'offline').length,
          totalCollaborations: meshStatus.activeCollaborations,
          meshHealth: meshStatus.meshHealth
        }
      },
      message: 'Agent status retrieved successfully'
    });
  } catch (error) {
    log.error('Failed to get agent status', LogContext.AGENT, { error });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve agent status'
    });
  }
});

/**
 * Get network topology for visualization
 */
router.get('/topology', authenticate, async (req: Request, res: Response) => {
  try {
    const topology = generateNetworkTopology();
    
    res.json({
      success: true,
      data: topology,
      message: 'Network topology generated successfully'
    });
  } catch (error) {
    log.error('Failed to generate network topology', LogContext.AGENT, { error });
    res.status(500).json({
      success: false,
      error: 'Failed to generate network topology'
    });
  }
});

/**
 * Get agent performance metrics and analytics
 */
router.get('/metrics', authenticate, async (req: Request, res: Response) => {
  try {
    const { timeRange = '1h', agentName } = req.query;
    
    let metrics = Array.from(agentMetrics.values());
    
    if (agentName && typeof agentName === 'string') {
      metrics = metrics.filter(m => m.agentName === agentName);
    }
    
    // Calculate aggregate metrics
    const aggregates = {
      totalRequests: metrics.reduce((sum, m) => sum + m.totalRequests, 0),
      averageResponseTime: metrics.reduce((sum, m) => sum + m.averageResponseTime, 0) / Math.max(metrics.length, 1),
      averageSuccessRate: metrics.reduce((sum, m) => sum + m.successRate, 0) / Math.max(metrics.length, 1),
      totalErrors: metrics.reduce((sum, m) => sum + m.errorCount, 0),
      averageCpuUsage: metrics.reduce((sum, m) => sum + m.cpuUsage, 0) / Math.max(metrics.length, 1),
      averageMemoryUsage: metrics.reduce((sum, m) => sum + m.memoryUsage, 0) / Math.max(metrics.length, 1),
      totalActiveAgents: metrics.filter(m => Date.now() - m.lastActive.getTime() < 300000).length // 5 minutes
    };
    
    res.json({
      success: true,
      data: {
        metrics,
        aggregates,
        timeRange,
        timestamp: new Date()
      },
      message: 'Agent metrics retrieved successfully'
    });
  } catch (error) {
    log.error('Failed to get agent metrics', LogContext.AGENT, { error });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve agent metrics'
    });
  }
});

/**
 * Create new agent task assignment
 */
router.post('/tasks', authenticate, async (req: Request, res: Response) => {
  try {
    const { agentName, type, context, priority = 1, estimatedDuration } = req.body;
    
    if (!agentName || !type || !context) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: agentName, type, context'
      });
    }
    
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const task: AgentTask = {
      id: taskId,
      agentName,
      type,
      status: 'pending',
      priority,
      startTime: new Date(),
      estimatedDuration,
      context
    };
    
    activeTasks.set(taskId, task);
    
    // Start task execution
    executeAgentTask(taskId).catch(error => {
      log.error(`Task execution failed: ${taskId}`, LogContext.AGENT, { error });
    });
    
    broadcastToClients({
      type: 'task_created',
      data: task
    });
    
    return res.json({
      success: true,
      data: { taskId, task },
      message: 'Task created and queued successfully'
    });
  } catch (error) {
    log.error('Failed to create agent task', LogContext.AGENT, { error });
    return res.status(500).json({
      success: false,
      error: 'Failed to create agent task'
    });
  }
});

/**
 * Get active and historical tasks
 */
router.get('/tasks', authenticate, async (req: Request, res: Response) => {
  try {
    const { status, agentName, limit = 100 } = req.query;
    
    let tasks = Array.from(activeTasks.values());
    
    // Add recent completed tasks from history
    const recentHistory = taskHistory
      .filter(t => Date.now() - t.endTime!.getTime() < 3600000) // Last hour
      .slice(-50); // Last 50
    
    tasks = [...tasks, ...recentHistory];
    
    // Filter by status
    if (status && typeof status === 'string') {
      tasks = tasks.filter(t => t.status === status);
    }
    
    // Filter by agent
    if (agentName && typeof agentName === 'string') {
      tasks = tasks.filter(t => t.agentName === agentName);
    }
    
    // Limit results
    tasks = tasks.slice(0, Number(limit));
    
    res.json({
      success: true,
      data: {
        tasks,
        summary: {
          total: tasks.length,
          pending: tasks.filter(t => t.status === 'pending').length,
          running: tasks.filter(t => t.status === 'running').length,
          completed: tasks.filter(t => t.status === 'completed').length,
          failed: tasks.filter(t => t.status === 'failed').length
        }
      },
      message: 'Tasks retrieved successfully'
    });
  } catch (error) {
    log.error('Failed to get tasks', LogContext.AGENT, { error });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve tasks'
    });
  }
});

/**
 * Request agent collaboration
 */
router.post('/collaborate', authenticate, async (req: Request, res: Response) => {
  try {
    const { task, requiredCapabilities, teamSize = 3, priority = 'medium' } = req.body;
    
    if (!task || !requiredCapabilities || !Array.isArray(requiredCapabilities)) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: task, requiredCapabilities (array)'
      });
    }
    
    const sessionId = await agentRegistry.requestCollaboration(
      task,
      requiredCapabilities,
      teamSize,
      'orchestration_api'
    );
    
    broadcastToClients({
      type: 'collaboration_started',
      data: {
        sessionId,
        task,
        requiredCapabilities,
        teamSize,
        timestamp: new Date()
      }
    });
    
    return res.json({
      success: true,
      data: { sessionId },
      message: 'Collaboration session started successfully'
    });
  } catch (error) {
    log.error('Failed to start collaboration', LogContext.AGENT, { error });
    return res.status(500).json({
      success: false,
      error: 'Failed to start collaboration session'
    });
  }
});

/**
 * Get A2A communication history and tracking
 */
router.get('/communications', authenticate, async (req: Request, res: Response) => {
  try {
    const { limit = 100, agentName, messageType } = req.query;
    
    const collaborations = a2aMesh.getCollaborationHistory();
    const meshStatus = a2aMesh.getMeshStatus();
    
    // This would typically come from message history in a real implementation
    const communications = collaborations.map(collab => ({
      id: collab.id,
      participants: collab.participants,
      task: collab.task,
      status: collab.status,
      startTime: collab.startTime,
      messageCount: collab.messageHistory.length,
      type: 'collaboration'
    }));
    
    res.json({
      success: true,
      data: {
        communications,
        meshStatus,
        summary: {
          totalCommunications: communications.length,
          activeSessions: collaborations.filter(c => c.status === 'active').length,
          completedSessions: collaborations.filter(c => c.status === 'completed').length,
          failedSessions: collaborations.filter(c => c.status === 'failed').length
        }
      },
      message: 'Communications retrieved successfully'
    });
  } catch (error) {
    log.error('Failed to get communications', LogContext.AGENT, { error });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve communications'
    });
  }
});

/**
 * Get resource usage monitoring per agent
 */
router.get('/resources', authenticate, async (req: Request, res: Response) => {
  try {
    const { agentName } = req.query;
    
    const agents = agentRegistry.getLoadedAgents();
    const connections = a2aMesh.getAgentConnections();
    
    const resourceUsage = agents.map(name => {
      const connection = connections.find(c => c.agentName === name);
      const metrics = agentMetrics.get(name);
      
      return {
        agentName: name,
        status: connection?.status || 'unknown',
        cpuUsage: metrics?.cpuUsage || 0,
        memoryUsage: metrics?.memoryUsage || 0,
        queueLength: connection?.messageQueue?.length || 0,
        lastActive: connection?.lastSeen || new Date(),
        collaborationScore: connection?.collaborationScore || 0,
        trustLevel: connection?.trustLevel || 0.8
      };
    });
    
    // System-wide resource summary
    const systemResources = {
      totalAgents: resourceUsage.length,
      totalCpuUsage: resourceUsage.reduce((sum, r) => sum + r.cpuUsage, 0),
      totalMemoryUsage: resourceUsage.reduce((sum, r) => sum + r.memoryUsage, 0),
      averageCpuUsage: resourceUsage.reduce((sum, r) => sum + r.cpuUsage, 0) / Math.max(resourceUsage.length, 1),
      averageMemoryUsage: resourceUsage.reduce((sum, r) => sum + r.memoryUsage, 0) / Math.max(resourceUsage.length, 1),
      totalQueueLength: resourceUsage.reduce((sum, r) => sum + r.queueLength, 0),
      meshHealth: a2aMesh.getMeshStatus().meshHealth
    };
    
    let filteredUsage = resourceUsage;
    if (agentName && typeof agentName === 'string') {
      filteredUsage = resourceUsage.filter(r => r.agentName === agentName);
    }
    
    res.json({
      success: true,
      data: {
        resources: filteredUsage,
        systemResources,
        timestamp: new Date()
      },
      message: 'Resource usage retrieved successfully'
    });
  } catch (error) {
    log.error('Failed to get resource usage', LogContext.AGENT, { error });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve resource usage'
    });
  }
});

/**
 * Orchestrate complex multi-agent workflows
 */
router.post('/orchestrate', authenticate, async (req: Request, res: Response) => {
  try {
    const { primaryAgent, supportingAgents = [], context, workflow } = req.body;
    
    if (!primaryAgent || !context) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: primaryAgent, context'
      });
    }
    
    const startTime = Date.now();
    
    // Execute orchestration
    const result = await agentRegistry.orchestrateAgents(
      primaryAgent,
      supportingAgents,
      context
    );
    
    const executionTime = Date.now() - startTime;
    
    // Update metrics for all participating agents
    updateAgentMetrics(primaryAgent, 'request', executionTime, !(result.primary as any)?.error);
    supportingAgents.forEach((agent: string) => {
      const agentResult = result.supporting.find(r => r.agentName === agent);
      updateAgentMetrics(agent, 'request', executionTime, !agentResult?.error);
    });
    
    broadcastToClients({
      type: 'orchestration_completed',
      data: {
        primaryAgent,
        supportingAgents,
        executionTime,
        success: !(result.primary as any)?.error && !result.supporting.some(r => r.error),
        timestamp: new Date()
      }
    });
    
    return res.json({
      success: true,
      data: {
        result,
        executionTime,
        participatingAgents: [primaryAgent, ...supportingAgents]
      },
      message: 'Agent orchestration completed successfully'
    });
  } catch (error) {
    log.error('Failed to orchestrate agents', LogContext.AGENT, { error });
    return res.status(500).json({
      success: false,
      error: 'Failed to orchestrate agents'
    });
  }
});

/**
 * Execute an agent task
 */
async function executeAgentTask(taskId: string): Promise<void> {
  const task = activeTasks.get(taskId);
  if (!task) return;
  
  try {
    task.status = 'running';
    task.startTime = new Date();
    
    broadcastToClients({
      type: 'task_started',
      data: task
    });
    
    const startTime = Date.now();
    
    // Execute the task through agent registry
    const result = await agentRegistry.processRequest(task.agentName, task.context);
    
    const executionTime = Date.now() - startTime;
    
    task.status = 'completed';
    task.endTime = new Date();
    task.result = result;
    
    // Update metrics
    updateAgentMetrics(task.agentName, 'request', executionTime, true);
    
    // Move to history
    activeTasks.delete(taskId);
    taskHistory.push(task);
    
    // Keep history limited
    if (taskHistory.length > 1000) {
      taskHistory.splice(0, 100);
    }
    
    broadcastToClients({
      type: 'task_completed',
      data: task
    });
    
  } catch (error) {
    task.status = 'failed';
    task.endTime = new Date();
    task.error = error instanceof Error ? error.message : String(error);
    
    updateAgentMetrics(task.agentName, 'request', 0, false);
    
    activeTasks.delete(taskId);
    taskHistory.push(task);
    
    broadcastToClients({
      type: 'task_failed',
      data: task
    });
    
    log.error(`Task execution failed: ${taskId}`, LogContext.AGENT, { error });
  }
}

export default router;
export { setupWebSocketOrchestration };