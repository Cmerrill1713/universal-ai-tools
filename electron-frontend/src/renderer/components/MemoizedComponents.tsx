/**
 * Memoized components for performance optimization
 * Uses React.memo with custom comparison functions to prevent unnecessary re-renders
 */

import { memo, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import type { TaskStep, TaskLog } from '../services/taskWindowManager';
// TaskWindow is imported but not used in this component

/**
 * Memoized Task Step Component
 * Only re-renders when step data actually changes
 */
export const MemoizedTaskStep = memo<{
  step: TaskStep;
  index: number;
}>(
  ({ step }) => {
    const progressWidth = useMemo(() => `${step.progress}%`, [step.progress]);

    return (
      <div className='flex items-center space-x-3'>
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
                  style={{ width: progressWidth }}
                />
              </div>
            </div>
          )}
          {step.error && <p className='text-xs text-red-600 mt-1'>{step.error}</p>}
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison - only re-render if these specific fields change
    return (
      prevProps.step.status === nextProps.step.status &&
      prevProps.step.progress === nextProps.step.progress &&
      prevProps.step.error === nextProps.step.error &&
      prevProps.step.name === nextProps.step.name
    );
  }
);

MemoizedTaskStep.displayName = 'MemoizedTaskStep';

/**
 * Memoized Log Entry Component
 * Prevents re-rendering of individual log entries
 */
export const MemoizedLogEntry = memo<{
  log: TaskLog;
  index: number;
}>(
  ({ log }) => {
    const getLogLevelColor = useCallback((level: TaskLog['level']) => {
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
    }, []);

    const formattedTime = useMemo(() => {
      if (!log.timestamp) return '';
      try {
        const date = log.timestamp instanceof Date ? log.timestamp : new Date(log.timestamp);
        return !isNaN(date.getTime()) ? date.toLocaleTimeString() : '';
      } catch {
        return '';
      }
    }, [log.timestamp]);

    return (
      <div className='flex items-start space-x-2'>
        <span className='text-gray-500 text-xs flex-shrink-0'>{formattedTime}</span>
        <span className={`text-xs font-bold flex-shrink-0 ${getLogLevelColor(log.level)}`}>
          [{log.level.toUpperCase()}]
        </span>
        <span className='text-gray-100 text-xs break-words'>{log.message}</span>
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Logs are immutable once created, so we can use index comparison
    return prevProps.index === nextProps.index;
  }
);

MemoizedLogEntry.displayName = 'MemoizedLogEntry';

/**
 * Memoized Service Card Component
 * Only re-renders when service status or metrics change
 */
export const MemoizedServiceCard = memo<{
  service: {
    id: string;
    name: string;
    description: string;
    status: 'online' | 'offline' | 'warning';
    port: number;
    responseTime: number;
    uptime: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
  };
  onClick?: () => void;
}>(
  ({ service, onClick }) => {
    const statusColor = useMemo(() => {
      switch (service.status) {
        case 'online':
          return 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900';
        case 'warning':
          return 'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900';
        case 'offline':
          return 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900';
        default:
          return 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-900';
      }
    }, [service.status]);

    const handleClick = useCallback(() => {
      onClick?.();
    }, [onClick]);

    return (
      <motion.div
        whileHover={{ scale: 1.02, y: -5 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleClick}
        className='bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700 cursor-pointer hover:shadow-xl transition-all'
      >
        <div className='flex items-start justify-between mb-4'>
          <div className={`w-12 h-12 rounded-lg bg-gradient-to-r ${service.color} p-3`}>
            <service.icon className='w-6 h-6 text-white' />
          </div>
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusColor}`}>
            {service.status.toUpperCase()}
          </span>
        </div>

        <h3 className='text-lg font-semibold text-gray-900 dark:text-white mb-2'>{service.name}</h3>

        <p className='text-sm text-gray-600 dark:text-gray-400 mb-4'>{service.description}</p>

        <div className='grid grid-cols-2 gap-4 text-sm'>
          <div>
            <span className='text-gray-500 dark:text-gray-400'>Port:</span>
            <p className='font-medium text-gray-900 dark:text-white'>{service.port}</p>
          </div>
          <div>
            <span className='text-gray-500 dark:text-gray-400'>Response:</span>
            <p className='font-medium text-gray-900 dark:text-white'>{service.responseTime}ms</p>
          </div>
          <div>
            <span className='text-gray-500 dark:text-gray-400'>Uptime:</span>
            <p className='font-medium text-gray-900 dark:text-white'>{service.uptime}</p>
          </div>
        </div>
      </motion.div>
    );
  },
  (prevProps, nextProps) => {
    // Only re-render if key properties change
    return (
      prevProps.service.status === nextProps.service.status &&
      prevProps.service.responseTime === nextProps.service.responseTime &&
      prevProps.service.uptime === nextProps.service.uptime &&
      prevProps.service.id === nextProps.service.id
    );
  }
);

MemoizedServiceCard.displayName = 'MemoizedServiceCard';

/**
 * Memoized Progress Bar Component
 * Smooth animations without unnecessary re-renders
 */
export const MemoizedProgressBar = memo<{
  progress: number;
  className?: string;
  showLabel?: boolean;
}>(
  ({ progress, className = '', showLabel = true }) => {
    const progressWidth = useMemo(() => `${Math.min(100, Math.max(0, progress))}%`, [progress]);
    const progressLabel = useMemo(() => `${Math.round(progress)}%`, [progress]);

    return (
      <div className={`w-full ${className}`}>
        {showLabel && (
          <div className='flex items-center justify-between mb-2'>
            <span className='text-sm font-medium text-gray-700'>Progress</span>
            <span className='text-sm text-gray-600'>{progressLabel}</span>
          </div>
        )}
        <div className='w-full bg-gray-200 rounded-full h-2'>
          <div
            className='bg-blue-500 h-2 rounded-full transition-all duration-300 ease-out'
            style={{ width: progressWidth }}
          />
        </div>
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Only re-render if progress actually changes by more than 1%
    return Math.abs(prevProps.progress - nextProps.progress) < 1;
  }
);

MemoizedProgressBar.displayName = 'MemoizedProgressBar';

/**
 * Memoized Message Component for Chat
 * Prevents re-rendering of chat messages
 */
export const MemoizedChatMessage = memo<{
  message: {
    id: string;
    content: string;
    sender: 'user' | 'assistant';
    timestamp?: Date | string;
    status?: 'sending' | 'sent' | 'error';
  };
  isLatest?: boolean;
}>(
  ({ message, isLatest = false }) => {
    const formattedTime = useMemo(() => {
      if (!message.timestamp) return '';
      try {
        const date =
          message.timestamp instanceof Date ? message.timestamp : new Date(message.timestamp);
        return !isNaN(date.getTime()) ? date.toLocaleTimeString() : '';
      } catch {
        return '';
      }
    }, [message.timestamp]);

    const messageClasses = useMemo(() => {
      const base = 'px-4 py-2 rounded-lg max-w-md';
      return message.sender === 'user'
        ? `${base} bg-blue-500 text-white ml-auto`
        : `${base} bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white`;
    }, [message.sender]);

    return (
      <motion.div
        initial={isLatest ? { opacity: 0, y: 20 } : false}
        animate={{ opacity: 1, y: 0 }}
        className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'} mb-4`}
      >
        <div>
          <div className={messageClasses}>
            <p className='text-sm whitespace-pre-wrap'>{message.content}</p>
          </div>
          {formattedTime && (
            <p className='text-xs text-gray-500 mt-1 px-1'>
              {formattedTime}
              {message.status === 'sending' && ' • Sending...'}
              {message.status === 'error' && ' • Failed to send'}
            </p>
          )}
        </div>
      </motion.div>
    );
  },
  (prevProps, nextProps) => {
    // Messages are immutable once sent
    return (
      prevProps.message.id === nextProps.message.id &&
      prevProps.message.status === nextProps.message.status &&
      prevProps.isLatest === nextProps.isLatest
    );
  }
);

MemoizedChatMessage.displayName = 'MemoizedChatMessage';

export default {
  MemoizedTaskStep,
  MemoizedLogEntry,
  MemoizedServiceCard,
  MemoizedProgressBar,
  MemoizedChatMessage,
};
