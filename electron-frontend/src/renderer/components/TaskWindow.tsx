import Logger from '../utils/logger';
/**
 * Task Window Component
 * Real-time task execution window with progress tracking and log display
 */

import { useState, useEffect, useRef } from 'react';
import {
  TaskWindow as TaskWindowType,
  TaskStep,
  TaskLog,
  TaskWindowManager,
} from '../services/taskWindowManager';

interface TaskWindowProps {
  taskWindow: TaskWindowType;
  onClose: () => void;
  onCancel?: () => void;
  taskWindowManager: TaskWindowManager;
}

export const TaskWindow: React.ComponentType<TaskWindowProps> = ({
  taskWindow,
  onClose,
  onCancel,
  taskWindowManager,
}) => {
  const [logs, setLogs] = useState<TaskLog[]>(taskWindow.logs);
  const [steps, setSteps] = useState<TaskStep[]>(taskWindow.steps);
  const [progress, setProgress] = useState(taskWindow.progress);
  const [status, setStatus] = useState(taskWindow.status);
  const [showLogs, setShowLogs] = useState(true);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<number | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs to bottom
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Listen for task updates
  useEffect(() => {
    const handleTaskUpdate = (updatedTask: TaskWindowType) => {
      if (updatedTask.id === taskWindow.id) {
        setLogs(updatedTask.logs);
        setSteps(updatedTask.steps);
        setProgress(updatedTask.progress);
        setStatus(updatedTask.status);

        // Update estimated time
        const timeRemaining = taskWindowManager.getEstimatedTimeRemaining(updatedTask);
        setEstimatedTimeRemaining(timeRemaining);
      }
    };

    taskWindowManager.on('taskUpdated', handleTaskUpdate);
    return () => {
      taskWindowManager.off('taskUpdated', handleTaskUpdate);
    };
  }, [taskWindow.id, taskWindowManager]);

  const handleCancel = async () => {
    if (status === 'running' && onCancel) {
      try {
        await taskWindowManager.cancelTask(taskWindow.id);
        onCancel();
      } catch (_error) {
        if (process.env.NODE_ENV === 'development') {
          Logger.error('Failed to cancel task:', _error);
        }
      }
    }
  };

  const getStatusColor = (taskStatus: string) => {
    switch (taskStatus) {
      case 'pending':
        return 'text-yellow-600';
      case 'running':
        return 'text-blue-600';
      case 'completed':
        return 'text-green-600';
      case 'failed':
        return 'text-red-600';
      case 'cancelled':
        return 'text-gray-600';
      default:
        return 'text-gray-600';
    }
  };

  const getLogLevelColor = (level: TaskLog['level']) => {
    switch (level) {
      case 'info':
        return 'text-blue-600';
      case 'success':
        return 'text-green-600';
      case 'warn':
        return 'text-yellow-600';
      case 'error':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  return (
    <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
      <div className='bg-white rounded-lg shadow-xl w-full max-w-4xl h-3/4 flex flex-col'>
        {/* Header */}
        <div className='flex items-center justify-between p-4 border-b'>
          <div className='flex items-center space-x-3'>
            <div className='flex items-center space-x-2'>
              <div
                className={`w-3 h-3 rounded-full ${
                  status === 'running'
                    ? 'bg-blue-500 animate-pulse'
                    : status === 'completed'
                      ? 'bg-green-500'
                      : status === 'failed'
                        ? 'bg-red-500'
                        : status === 'cancelled'
                          ? 'bg-gray-500'
                          : 'bg-yellow-500'
                }`}
              />
              <h2 className='text-lg font-semibold'>{taskWindow.title}</h2>
            </div>
            <span className={`text-sm font-medium ${getStatusColor(status)}`}>
              {status.toUpperCase()}
            </span>
          </div>

          <div className='flex items-center space-x-2'>
            {status === 'running' && onCancel && (
              <button
                onClick={handleCancel}
                className='px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors'
                aria-label='Cancel current task'
              >
                Cancel
              </button>
            )}
            <button
              onClick={onClose}
              className='text-gray-500 hover:text-gray-700'
              aria-label='Close task window'
            >
              <svg
                className='w-6 h-6'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
                aria-hidden='true'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M6 18L18 6M6 6l12 12'
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Task Description */}
        <div className='px-4 py-2 bg-gray-50 border-b'>
          <p className='text-sm text-gray-600'>{taskWindow.description}</p>
          <div className='flex items-center justify-between mt-2'>
            <span className='text-xs text-gray-500'>
              Agent: {taskWindow.agentName} ({taskWindow.agentId})
            </span>
            {estimatedTimeRemaining && status === 'running' && (
              <span className='text-xs text-gray-500'>
                Est. time remaining: {formatDuration(estimatedTimeRemaining)}
              </span>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className='px-4 py-3 border-b'>
          <div className='flex items-center justify-between mb-2'>
            <span className='text-sm font-medium text-gray-700'>Progress</span>
            <span className='text-sm text-gray-600'>{Math.round(progress)}%</span>
          </div>
          <div className='w-full bg-gray-200 rounded-full h-2'>
            <div
              className='bg-blue-500 h-2 rounded-full transition-all duration-300 ease-out'
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Steps */}
        <div className='px-4 py-3 border-b'>
          <div className='flex items-center justify-between mb-2'>
            <span className='text-sm font-medium text-gray-700'>Steps ({steps.length})</span>
            <button
              onClick={() => setShowLogs(!showLogs)}
              className='text-xs text-blue-600 hover:text-blue-800'
            >
              {showLogs ? 'Hide Logs' : 'Show Logs'}
            </button>
          </div>
          <div className='space-y-2 max-h-32 overflow-y-auto'>
            {steps.map((step, _index) => (
              <div key={step.id} className='flex items-center space-x-3'>
                <div className='flex-shrink-0'>
                  {step.status === 'completed' && (
                    <svg className='w-5 h-5 text-green-500' fill='currentColor' viewBox='0 0 20 20'>
                      <path
                        fillRule='evenodd'
                        d='M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z'
                        clipRule='evenodd'
                      />
                    </svg>
                  )}
                  {step.status === 'running' && (
                    <div className='w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin' />
                  )}
                  {step.status === 'failed' && (
                    <svg className='w-5 h-5 text-red-500' fill='currentColor' viewBox='0 0 20 20'>
                      <path
                        fillRule='evenodd'
                        d='M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z'
                        clipRule='evenodd'
                      />
                    </svg>
                  )}
                  {step.status === 'pending' && (
                    <div className='w-5 h-5 border-2 border-gray-300 rounded-full' />
                  )}
                </div>
                <div className='flex-1 min-w-0'>
                  <div className='flex items-center justify-between'>
                    <p className='text-sm font-medium text-gray-900 truncate'>{step.name}</p>
                    <span className='text-xs text-gray-500'>{Math.round(step.progress)}%</span>
                  </div>
                  {step.status === 'running' && (
                    <div className='mt-1'>
                      <div className='w-full bg-gray-200 rounded-full h-1'>
                        <div
                          className='bg-blue-400 h-1 rounded-full transition-all duration-300'
                          style={{ width: `${step.progress}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {step.error && <p className='text-xs text-red-600 mt-1'>{step.error}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Logs Section */}
        {showLogs && (
          <div className='flex-1 flex flex-col min-h-0'>
            <div className='px-4 py-2 bg-gray-50 border-b'>
              <span className='text-sm font-medium text-gray-700'>Logs ({logs.length})</span>
            </div>
            <div className='flex-1 p-4 overflow-y-auto bg-gray-900 text-sm font-mono'>
              {logs.length === 0 ? (
                <div className='text-gray-500 text-center py-8'>No logs yet...</div>
              ) : (
                <div className='space-y-1'>
                  {logs.map((log, index) => (
                    <div key={index} className='flex items-start space-x-2'>
                      <span className='text-gray-500 text-xs flex-shrink-0'>
                        {log.timestamp
                          ? (log.timestamp instanceof Date
                              ? log.timestamp
                              : new Date(log.timestamp)
                            ).toLocaleTimeString()
                          : ''}
                      </span>
                      <span
                        className={`text-xs font-bold flex-shrink-0 ${getLogLevelColor(log.level)}`}
                      >
                        [{log.level.toUpperCase()}]
                      </span>
                      <span className='text-gray-100 text-xs break-words'>{log.message}</span>
                    </div>
                  ))}
                  <div ref={logsEndRef} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className='px-4 py-3 bg-gray-50 border-t flex items-center justify-between'>
          <div className='text-xs text-gray-500'>
            {taskWindow.startTime && (
              <span>
                Started:{' '}
                {taskWindow.startTime instanceof Date && !isNaN(taskWindow.startTime.getTime())
                  ? taskWindow.startTime.toLocaleTimeString()
                  : ''}
                {taskWindow.endTime && taskWindow.startTime && (
                  <>
                    {' '}
                    • Duration:{' '}
                    {taskWindow.endTime instanceof Date &&
                    taskWindow.startTime instanceof Date &&
                    !isNaN(taskWindow.endTime.getTime()) &&
                    !isNaN(taskWindow.startTime.getTime())
                      ? formatDuration(
                          taskWindow.endTime.getTime() - taskWindow.startTime.getTime()
                        )
                      : ''}
                  </>
                )}
              </span>
            )}
          </div>
          <div className='flex space-x-2'>
            {(status === 'completed' || status === 'failed' || status === 'cancelled') && (
              <button
                onClick={onClose}
                className='px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors'
              >
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskWindow;
