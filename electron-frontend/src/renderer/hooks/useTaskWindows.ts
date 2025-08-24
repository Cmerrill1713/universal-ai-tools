import Logger from '../utils/logger';
/**
 * React Hook for Task Window Management
 * Manages task window lifecycle and state integration with the chat interface
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  TaskWindowManager,
  TaskWindow as TaskWindowType,
  TaskWindowOptions,
} from '../services/taskWindowManager';
// Note: DynamicAgentFactory runs on the backend - frontend should use API calls
// import { DynamicAgentFactory } from '../../services/dynamic-agent-factory';

export interface UseTaskWindowsConfig {
  backendUrl?: string;
  maxConcurrentTasks?: number;
  autoCloseCompletedTasks?: boolean;
}

export interface UseTaskWindowsReturn {
  taskWindows: TaskWindowType[];
  activeTaskWindows: TaskWindowType[];
  isConnected: boolean;
  createTaskWindow: (
    title: string,
    description: string,
    agentId: string,
    agentName: string,
    operation: string,
    params: Record<string, unknown>,
    options?: TaskWindowOptions
  ) => Promise<TaskWindowType>;
  startTask: (taskId: string) => Promise<void>;
  cancelTask: (taskId: string) => Promise<void>;
  closeTaskWindow: (taskId: string) => void;
  getTaskWindow: (taskId: string) => TaskWindowType | undefined;
  clearCompletedTasks: () => void;
  executeAgentOperation: (
    agentType: 'one-folder' | 'pydantic-ai',
    operation: string,
    params: Record<string, unknown>,
    options?: TaskWindowOptions
  ) => Promise<TaskWindowType>;
}

const DEFAULT_CONFIG: UseTaskWindowsConfig = {
  backendUrl: undefined, // Will be discovered automatically
  maxConcurrentTasks: 5,
  autoCloseCompletedTasks: false,
};

export const useTaskWindows = (config: UseTaskWindowsConfig = {}): UseTaskWindowsReturn => {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const [taskWindows, setTaskWindows] = useState<TaskWindowType[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  const taskManagerRef = useRef<TaskWindowManager>();
  // const agentFactoryRef = useRef<DynamicAgentFactory>();

  // Initialize managers
  useEffect(() => {
    taskManagerRef.current = new TaskWindowManager(finalConfig.backendUrl);
    // agentFactoryRef.current = new DynamicAgentFactory(finalConfig.backendUrl!);
    // Note: Agent factory runs on backend - frontend uses API calls via taskManager

    // Set up event listeners
    const taskManager = taskManagerRef.current;

    const handleTaskWindowCreated = (taskWindow: TaskWindowType) => {
      setTaskWindows(prev => [...prev, taskWindow]);
    };

    const handleTaskWindowClosed = (taskWindow: TaskWindowType) => {
      setTaskWindows(prev => prev.filter(tw => tw.id !== taskWindow.id));
    };

    const handleTaskUpdated = (taskWindow: TaskWindowType) => {
      setTaskWindows(prev => prev.map(tw => (tw.id === taskWindow.id ? taskWindow : tw)));

      // Auto-close completed tasks if enabled
      if (
        finalConfig.autoCloseCompletedTasks &&
        (taskWindow.status === 'completed' || taskWindow.status === 'failed')
      ) {
        setTimeout(() => {
          taskManager.closeTaskWindow(taskWindow.id);
        }, 3000);
      }
    };

    const handleConnectionEstablished = () => {
      setIsConnected(true);
    };

    const handleConnectionClosed = () => {
      setIsConnected(false);
    };

    // Register event listeners
    taskManager.on('taskWindowCreated', handleTaskWindowCreated);
    taskManager.on('taskWindowClosed', handleTaskWindowClosed);
    taskManager.on('taskUpdated', handleTaskUpdated);
    taskManager.on('connectionEstablished', handleConnectionEstablished);
    taskManager.on('connectionClosed', handleConnectionClosed);

    // Cleanup
    return () => {
      taskManager.off('taskWindowCreated', handleTaskWindowCreated);
      taskManager.off('taskWindowClosed', handleTaskWindowClosed);
      taskManager.off('taskUpdated', handleTaskUpdated);
      taskManager.off('connectionEstablished', handleConnectionEstablished);
      taskManager.off('connectionClosed', handleConnectionClosed);

      taskManager.destroy();
    };
  }, [finalConfig.backendUrl, finalConfig.autoCloseCompletedTasks]);

  // Get active task windows (running or pending)
  const activeTaskWindows = taskWindows.filter(
    tw => tw.status === 'running' || tw.status === 'pending'
  );

  // Create task window
  const createTaskWindow = useCallback(
    async (
      title: string,
      description: string,
      agentId: string,
      agentName: string,
      operation: string,
      params: Record<string, unknown>,
      options: TaskWindowOptions = {}
    ): Promise<TaskWindowType> => {
      if (!taskManagerRef.current) {
        throw new Error('Task manager not initialized');
      }

      // Check concurrent task limit
      if (activeTaskWindows.length >= finalConfig.maxConcurrentTasks!) {
        throw new Error(`Maximum concurrent tasks reached (${finalConfig.maxConcurrentTasks})`);
      }

      return await taskManagerRef.current.createTaskWindow(
        title,
        description,
        agentId,
        agentName,
        operation,
        params,
        options
      );
    },
    [activeTaskWindows.length, finalConfig.maxConcurrentTasks]
  );

  // Start task execution
  const startTask = useCallback(async (taskId: string): Promise<void> => {
    if (!taskManagerRef.current) {
      throw new Error('Task manager not initialized');
    }

    await taskManagerRef.current.startTask(taskId);
  }, []);

  // Cancel task
  const cancelTask = useCallback(async (taskId: string): Promise<void> => {
    if (!taskManagerRef.current) {
      throw new Error('Task manager not initialized');
    }

    await taskManagerRef.current.cancelTask(taskId);
  }, []);

  // Close task window
  const closeTaskWindow = useCallback((taskId: string): void => {
    if (!taskManagerRef.current) {
      return;
    }

    taskManagerRef.current.closeTaskWindow(taskId);
  }, []);

  // Get specific task window
  const getTaskWindow = useCallback((taskId: string): TaskWindowType | undefined => {
    if (!taskManagerRef.current) {
      return undefined;
    }

    return taskManagerRef.current.getTaskWindow(taskId);
  }, []);

  // Clear completed tasks
  const clearCompletedTasks = useCallback((): void => {
    const completedTasks = taskWindows.filter(
      tw => tw.status === 'completed' || tw.status === 'failed' || tw.status === 'cancelled'
    );

    completedTasks.forEach(task => {
      closeTaskWindow(task.id);
    });
  }, [taskWindows, closeTaskWindow]);

  // Execute agent operation with automatic task window creation
  const executeAgentOperation = useCallback(
    async (
      agentType: 'one-folder' | 'pydantic-ai',
      operation: string,
      params: Record<string, unknown>,
      options: TaskWindowOptions = {}
    ): Promise<TaskWindowType> => {
      if (!taskManagerRef.current) {
        throw new Error('Task manager not initialized');
      }

      // Agent creation is handled by the backend API
      // Create task window for the operation that will communicate with backend agents
      const taskWindow = await createTaskWindow(
        `${agentType} - ${operation}`,
        `Executing ${operation} operation`,
        `${agentType}-agent`,
        `${agentType} Agent`,
        operation,
        params,
        options
      );

      // Start the task
      try {
        await startTask(taskWindow.id);
      } catch (_error) {
        if (process.env.NODE_ENV === 'development') {
          Logger.error('Failed to start agent task:', _error);
        }
        throw _error;
      }

      return taskWindow;
    },
    [createTaskWindow, startTask]
  );

  return {
    taskWindows,
    activeTaskWindows,
    isConnected,
    createTaskWindow,
    startTask,
    cancelTask,
    closeTaskWindow,
    getTaskWindow,
    clearCompletedTasks,
    executeAgentOperation,
  };
};

export default useTaskWindows;
