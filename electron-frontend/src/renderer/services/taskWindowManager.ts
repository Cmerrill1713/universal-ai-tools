import Logger from '../utils/logger';
/**
 * Task Window Manager
 * Handles creation and management of task execution windows with real-time progress
 * Integrates with the Dynamic Agent Factory for complex operations
 */

import { EventEmitter } from 'eventemitter3';
import { safeDate, _safeNow, safeTaskId } from '../utils/defensiveDateHandler';

export interface TaskWindow {
  id: string;
  title: string;
  description: string;
  agentId: string;
  agentName: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  steps: TaskStep[];
  startTime?: Date;
  endTime?: Date;
  result?: unknown;
  error?: string;
  logs: TaskLog[];
}

export interface TaskStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  progress: number;
  logs: string[];
  error?: string;
  estimatedDuration?: number;
  actualDuration?: number;
}

export interface TaskLog {
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  stepId?: string;
}

export interface TaskWindowOptions {
  modal?: boolean;
  closeable?: boolean;
  minimizable?: boolean;
  width?: number;
  height?: number;
  showLogs?: boolean;
  showProgress?: boolean;
  autoClose?: boolean;
  timeout?: number;
}

/**
 * Task Window Manager - Manages task execution windows
 */
export class TaskWindowManager extends EventEmitter {
  private windows = new Map<string, TaskWindow>();
  private wsConnection?: WebSocket;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;
  private backendUrl?: string;

  constructor(backendUrl?: string) {
    super();
    this.backendUrl = backendUrl;
    this.initializeWebSocket();
  }

  /**
   * Initialize WebSocket connection for real-time updates
   */
  private async initializeWebSocket() {
    if (!this.backendUrl) {
      this.backendUrl = await this.discoverBackendUrl();
    }

    const wsUrl = this.backendUrl.replace('http://', 'ws://').replace('https://', 'wss://');

    try {
      this.wsConnection = new WebSocket(`${wsUrl}/ws/tasks`);

      this.wsConnection.onopen = () => {
        if (process.env.NODE_ENV === 'development') {
          Logger.debug('🔌 Task Window WebSocket connected');
        }
        this.reconnectAttempts = 0;
        this.emit('connectionEstablished');
      };

      this.wsConnection.onmessage = event => {
        try {
          const update = JSON.parse(event.data);
          this.handleTaskUpdate(update);
        } catch (_error) {
          if (process.env.NODE_ENV === 'development') {
            Logger.error('Error parsing task update:', _error);
          }
        }
      };

      this.wsConnection.onclose = () => {
        Logger.debug('🔌 Task Window WebSocket disconnected');
        this.emit('connectionClosed');
        this.attemptReconnect();
      };

      this.wsConnection.onerror = _error => {
        Logger.error('Task Window WebSocket _error:', _error);
        this.emit('connectionError', _error);
      };
    } catch (_error) {
      Logger.error('Failed to initialize WebSocket:', _error);
      this.emit('connectionError', _error);
    }
  }

  /**
   * Attempt to reconnect WebSocket
   */
  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      Logger.debug('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

    Logger.debug(
      `Attempting WebSocket reconnection in ${delay}ms (attempt ${this.reconnectAttempts})`
    );

    setTimeout(() => {
      this.initializeWebSocket();
    }, delay);
  }

  /**
   * Handle real-time task updates from backend
   */
  private handleTaskUpdate(update: unknown) {
    const { taskId, type, data } = update;
    const taskWindow = this.windows.get(taskId);

    if (!taskWindow) {
      if (process.env.NODE_ENV === 'development') {
        Logger.warn(`Received update for unknown task: ${taskId}`);
      }
      return;
    }

    switch (type) {
      case 'task_started':
        taskWindow.status = 'running';
        taskWindow.startTime = safeDate(data.startTime);
        this.addLog(taskWindow, 'info', `Task started: ${taskWindow.title}`);
        break;

      case 'step_started': {
        const startingStep = taskWindow.steps.find(s => s.id === data.stepId);
        if (startingStep) {
          startingStep.status = 'running';
          this.addLog(taskWindow, 'info', `Step started: ${startingStep.name}`, data.stepId);
        }
        break;
      }

      case 'step_progress': {
        const progressStep = taskWindow.steps.find(s => s.id === data.stepId);
        if (progressStep) {
          progressStep.progress = data.progress;
          if (data.message) {
            progressStep.logs.push(data.message);
            this.addLog(taskWindow, 'info', data.message, data.stepId);
          }
        }
        this.updateOverallProgress(taskWindow);
        break;
      }

      case 'step_completed': {
        const completedStep = taskWindow.steps.find(s => s.id === data.stepId);
        if (completedStep) {
          completedStep.status = 'completed';
          completedStep.progress = 100;
          completedStep.actualDuration = data.duration;
          this.addLog(taskWindow, 'success', `Step completed: ${completedStep.name}`, data.stepId);
        }
        this.updateOverallProgress(taskWindow);
        break;
      }

      case 'step_failed': {
        const failedStep = taskWindow.steps.find(s => s.id === data.stepId);
        if (failedStep) {
          failedStep.status = 'failed';
          failedStep._error = data.error;
          this.addLog(
            taskWindow,
            'error',
            `Step failed: ${failedStep.name} - ${data.error}`,
            data.stepId
          );
        }
        break;
      }

      case 'task_completed':
        taskWindow.status = 'completed';
        taskWindow.endTime = safeDate(data.endTime);
        taskWindow.result = data.result;
        taskWindow.progress = 100;
        this.addLog(taskWindow, 'success', 'Task completed successfully');
        break;

      case 'task_failed':
        taskWindow.status = 'failed';
        taskWindow.endTime = safeDate(data.endTime);
        taskWindow._error = data.error;
        this.addLog(taskWindow, 'error', `Task failed: ${data.error}`);
        break;
    }

    this.emit('taskUpdated', taskWindow, type, data);
  }

  /**
   * Create a new task window
   */
  async createTaskWindow(
    title: string,
    description: string,
    agentId: string,
    agentName: string,
    operation: string,
    params: Record<string, any>,
    options: TaskWindowOptions = {}
  ): Promise<TaskWindow> {
    const taskId = safeTaskId('task');

    const taskWindow: TaskWindow = {
      id: taskId,
      title,
      description,
      agentId,
      agentName,
      status: 'pending',
      progress: 0,
      steps: [],
      logs: [],
    };

    // Request task creation from backend
    try {
      const response = await fetch(`${this.backendUrl}/api/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          taskId,
          title,
          description,
          agentId,
          operation,
          params,
          options,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create task: ${response.statusText}`);
      }

      const taskData = await response.json();
      taskWindow.steps = taskData.steps || [];
    } catch (_error) {
      Logger.error('Failed to create task on backend:', _error);
      // Create local-only task window for offline mode
      taskWindow.steps = this.generateDefaultSteps(operation);
    }

    this.windows.set(taskId, taskWindow);
    this.addLog(taskWindow, 'info', `Task created: ${title}`);

    this.emit('taskWindowCreated', taskWindow);
    Logger.debug(`📋 Created task window: ${title} (${taskId})`);

    return taskWindow;
  }

  /**
   * Start task execution
   */
  async startTask(taskId: string): Promise<void> {
    const taskWindow = this.windows.get(taskId);
    if (!taskWindow) {
      throw new Error(`Task window ${taskId} not found`);
    }

    if (taskWindow.status !== 'pending') {
      throw new Error(`Task ${taskId} is not in pending state`);
    }

    try {
      const response = await fetch(`${this.backendUrl}/api/tasks/${taskId}/start`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`Failed to start task: ${response.statusText}`);
      }

      // Task will be updated via WebSocket
      this.addLog(taskWindow, 'info', 'Task execution requested');
    } catch (_error) {
      Logger.error('Failed to start task:', _error);
      taskWindow.status = 'failed';
      taskWindow._error = _error instanceof Error ? error.message : String(_error);
      this.addLog(taskWindow, 'error', `Failed to start task: ${taskWindow.error}`);
    }
  }

  /**
   * Cancel task execution
   */
  async cancelTask(taskId: string): Promise<void> {
    const taskWindow = this.windows.get(taskId);
    if (!taskWindow) {
      throw new Error(`Task window ${taskId} not found`);
    }

    try {
      const response = await fetch(`${this.backendUrl}/api/tasks/${taskId}/cancel`, {
        method: 'POST',
      });

      if (response.ok) {
        taskWindow.status = 'cancelled';
        taskWindow.endTime = safeDate();
        this.addLog(taskWindow, 'warn', 'Task cancelled by user');
        this.emit('taskCancelled', taskWindow);
      }
    } catch (_error) {
      Logger.error('Failed to cancel task:', _error);
    }
  }

  /**
   * Close task window
   */
  closeTaskWindow(taskId: string): void {
    const taskWindow = this.windows.get(taskId);
    if (taskWindow) {
      this.windows.delete(taskId);
      this.emit('taskWindowClosed', taskWindow);
      Logger.debug(`🗑️ Closed task window: ${taskWindow.title}`);
    }
  }

  /**
   * Get all task windows
   */
  getAllTaskWindows(): TaskWindow[] {
    return Array.from(this.windows.values());
  }

  /**
   * Get active task windows
   */
  getActiveTaskWindows(): TaskWindow[] {
    return Array.from(this.windows.values()).filter(
      t => t.status === 'running' || t.status === 'pending'
    );
  }

  /**
   * Get task window by ID
   */
  getTaskWindow(taskId: string): TaskWindow | undefined {
    return this.windows.get(taskId);
  }

  /**
   * Add log entry to task window
   */
  private addLog(
    taskWindow: TaskWindow,
    level: TaskLog['level'],
    message: string,
    stepId?: string
  ): void {
    const log: TaskLog = {
      timestamp: safeDate(),
      level,
      message,
      stepId,
    };

    taskWindow.logs.push(log);

    // Keep only last 1000 log entries to prevent memory issues
    if (taskWindow.logs.length > 1000) {
      taskWindow.logs = taskWindow.logs.slice(-1000);
    }

    this.emit('taskLogAdded', taskWindow, log);
  }

  /**
   * Update overall task progress based on step completion
   */
  private updateOverallProgress(taskWindow: TaskWindow): void {
    if (taskWindow.steps.length === 0) {
      return;
    }

    const totalProgress = taskWindow.steps.reduce((sum, step) => sum + step.progress, 0);
    taskWindow.progress = totalProgress / taskWindow.steps.length;
  }

  /**
   * Generate default steps for operations
   */
  private generateDefaultSteps(operation: string): TaskStep[] {
    const _steps: TaskStep[] = [];

    switch (operation) {
      case 'build_react_app':
        return [
          { id: 'validate', name: 'Validate Parameters', status: 'pending', progress: 0, logs: [] },
          {
            id: 'scaffold',
            name: 'Create Project Structure',
            status: 'pending',
            progress: 0,
            logs: [],
            estimatedDuration: 3000,
          },
          {
            id: 'dependencies',
            name: 'Install Dependencies',
            status: 'pending',
            progress: 0,
            logs: [],
            estimatedDuration: 30000,
          },
          {
            id: 'components',
            name: 'Generate Components',
            status: 'pending',
            progress: 0,
            logs: [],
            estimatedDuration: 5000,
          },
          {
            id: 'testing',
            name: 'Setup Testing',
            status: 'pending',
            progress: 0,
            logs: [],
            estimatedDuration: 2000,
          },
          {
            id: 'finalize',
            name: 'Finalize Project',
            status: 'pending',
            progress: 0,
            logs: [],
            estimatedDuration: 1000,
          },
        ];

      case 'organize_folder':
        return [
          {
            id: 'analyze',
            name: 'Analyze Directory',
            status: 'pending',
            progress: 0,
            logs: [],
            estimatedDuration: 2000,
          },
          {
            id: 'plan',
            name: 'Create Organization Plan',
            status: 'pending',
            progress: 0,
            logs: [],
            estimatedDuration: 1000,
          },
          {
            id: 'execute',
            name: 'Execute Organization',
            status: 'pending',
            progress: 0,
            logs: [],
            estimatedDuration: 3000,
          },
        ];

      case 'generate_image':
        return [
          {
            id: 'prepare',
            name: 'Prepare Generation',
            status: 'pending',
            progress: 0,
            logs: [],
            estimatedDuration: 500,
          },
          {
            id: 'generate',
            name: 'Generate Image',
            status: 'pending',
            progress: 0,
            logs: [],
            estimatedDuration: 10000,
          },
          {
            id: 'postprocess',
            name: 'Post-process Image',
            status: 'pending',
            progress: 0,
            logs: [],
            estimatedDuration: 1000,
          },
        ];

      default:
        return [
          {
            id: 'execute',
            name: 'Execute Operation',
            status: 'pending',
            progress: 0,
            logs: [],
            estimatedDuration: 5000,
          },
        ];
    }
  }

  /**
   * Calculate estimated time remaining
   */
  getEstimatedTimeRemaining(taskWindow: TaskWindow): number | null {
    if (taskWindow.status !== 'running' || taskWindow.steps.length === 0) {
      return null;
    }

    const remainingSteps = taskWindow.steps.filter(
      s => s.status === 'pending' || s.status === 'running'
    );
    const totalEstimated = remainingSteps.reduce((sum, step) => {
      return sum + (step.estimatedDuration || 5000);
    }, 0);

    // Adjust for current step progress
    const currentStep = taskWindow.steps.find(s => s.status === 'running');
    if (currentStep && currentStep.estimatedDuration) {
      const currentRemaining = currentStep.estimatedDuration * (1 - currentStep.progress / 100);
      return totalEstimated - (currentStep.estimatedDuration - currentRemaining);
    }

    return totalEstimated;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.wsConnection) {
      this.wsConnection.close();
      this.wsConnection = undefined;
    }
    this.windows.clear();
    this.removeAllListeners();
  }

  /**
   * Discover backend URL using service discovery with automated port configuration
   */
  private async discoverBackendUrl(): Promise<string> {
    // First try to discover port manager for dynamic service discovery
    const portManagerCandidates = [
      'http://localhost:8080', // Primary Go API Gateway with port manager
      'http://localhost:8081', // Alternative Go API Gateway
    ];

    // Try to use automated port management first
    for (const managerUrl of portManagerCandidates) {
      try {
        const response = await fetch(`${managerUrl}/api/v1/discovery/services`, {
          method: 'GET',
          timeout: 2000,
        });

        if (response.ok) {
          const services = await response.json();
          Logger.debug('🔍 Discovered services via port manager:', services);

          // Look for task execution service
          const taskService = services.find(
            (s: unknown) => s.name?.includes('task') || s.endpoints?.includes('tasks')
          );

          if (taskService) {
            const discoveredUrl = `http://localhost:${taskService.port}`;
            Logger.debug(`🎯 Found task service at ${discoveredUrl}`);
            return discoveredUrl;
          }
        }
      } catch {
        // Continue to next candidate
      }
    }

    // Fallback to common service locations
    const staticCandidates = [
      'http://localhost:8081', // Go API Gateway
      'http://localhost:8080', // Alternative gateway
      'http://localhost:8082', // Rust LLM Router
      'http://localhost:9999', // Legacy TypeScript backend
    ];

    for (const url of staticCandidates) {
      try {
        const response = await fetch(`${url}/api/health`, {
          method: 'GET',
          timeout: 2000,
        });

        if (response.ok) {
          Logger.debug(`🔍 Found backend service at ${url}`);
          return url;
        }
      } catch {
        // Try next candidate
      }
    }

    // Last resort - check for task-specific endpoints
    const taskCandidates = [
      'http://localhost:8083', // Potential task service
      'http://localhost:8084', // Alternative task service
      'http://localhost:8085', // Backup task service
    ];

    for (const url of taskCandidates) {
      try {
        const response = await fetch(`${url}/api/tasks`, {
          method: 'GET',
          timeout: 1500,
        });

        if (response.ok || response.status === 404) {
          // 404 is fine, means endpoint exists
          Logger.debug(`🔍 Found task service at ${url}`);
          return url;
        }
      } catch {
        // Try next candidate
      }
    }

    // Fallback to legacy backend
    Logger.warn('⚠️ Could not discover backend service, falling back to legacy');
    return 'http://localhost:9999';
  }
}

export default TaskWindowManager;
