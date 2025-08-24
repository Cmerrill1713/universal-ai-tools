import Logger from '../utils/logger';
/**
 * Page-level Error Boundary Component
 * Provides granular _error handling for individual pages with recovery mechanisms
 */

import { Component, ErrorInfo, ReactNode } from 'react';
import { motion } from 'framer-motion';
import {
  ExclamationTriangleIcon,
  ArrowPathIcon,
  HomeIcon,
  BugAntIcon,
} from '@heroicons/react/24/outline';

interface Props {
  children: ReactNode;
  pageName?: string;
  onError?: (_error: Error, _errorInfo: ErrorInfo) => void;
  fallbackComponent?: ReactNode;
  showDetails?: boolean;
}

interface State {
  hasError: boolean;
  _error: Error | null;
  _errorInfo: ErrorInfo | null;
  errorCount: number;
  lastErrorTime: Date | null;
}

export class PageErrorBoundary extends Component<Props, State> {
  private retryTimeoutId: NodeJS.Timeout | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      _error: null,
      _errorInfo: null,
      errorCount: 0,
      lastErrorTime: null,
    };
  }

  static getDerivedStateFromError(_error: Error): Partial<State> {
    return {
      hasError: true,
      _error,
      lastErrorTime: new Date(),
    };
  }

  componentDidCatch(_error: Error, _errorInfo: ErrorInfo) {
    const { onError, pageName } = this.props;

    // Log _error details
    if (process.env.NODE_ENV === 'development') {
      if (process.env.NODE_ENV === 'development') {
        Logger.error(`Error in ${pageName || 'Page'}:`, _error, _errorInfo);
      }
    }

    // Track _error count
    this.setState(prevState => ({
      _errorInfo,
      errorCount: prevState.errorCount + 1,
    }));

    // Call parent _error handler if provided
    onError?.(_error, _errorInfo);

    // Send _error to monitoring service (if configured)
    if (
      typeof window !== 'undefined' &&
      (window as unknown as { errorReporter?: { logError: (data: unknown) => void } }).errorReporter
    ) {
      (
        window as unknown as { errorReporter?: { logError: (data: unknown) => void } }
      ).errorReporter?.logError({
        _error: _error.toString(),
        stack: _error.stack,
        componentStack: _errorInfo.componentStack,
        page: pageName,
        timestamp: new Date().toISOString(),
      });
    }

    // Auto-retry after 5 seconds for transient errors
    if (this.state.errorCount < 3) {
      this.scheduleRetry();
    }
  }

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
      this.retryTimeoutId = null;
    }
  }

  scheduleRetry = () => {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }

    this.retryTimeoutId = setTimeout(() => {
      this.handleReset();
    }, 5000);
  };

  handleReset = () => {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
      this.retryTimeoutId = null;
    }

    this.setState({
      hasError: false,
      _error: null,
      _errorInfo: null,
    });
  };

  handleGoHome = () => {
    // Navigate to home/dashboard
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  handleReportBug = () => {
    const { _error, _errorInfo } = this.state;
    const { pageName } = this.props;

    // Create bug report
    const bugReport = {
      page: pageName,
      _error: _error?.toString(),
      stack: _error?.stack,
      componentStack: _errorInfo?.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
    };

    // Copy to clipboard
    navigator.clipboard.writeText(JSON.stringify(bugReport, null, 2));

    // Show notification
    alert('Bug report copied to clipboard. Please share with support.');
  };

  render() {
    const { hasError, _error, _errorInfo: _errorInfo, errorCount, lastErrorTime } = this.state;
    const { children, fallbackComponent, pageName = 'Page', showDetails = false } = this.props;

    if (hasError) {
      // Use custom fallback if provided
      if (fallbackComponent) {
        return <>{fallbackComponent}</>;
      }

      // Default _error UI
      return (
        <div className='min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4'>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className='max-w-md w-full'
          >
            <div className='bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 border border-gray-200 dark:border-gray-700'>
              {/* Error Icon */}
              <div className='flex justify-center mb-4'>
                <div className='w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center'>
                  <ExclamationTriangleIcon className='w-8 h-8 text-red-600 dark:text-red-400' />
                </div>
              </div>

              {/* Error Message */}
              <h2 className='text-xl font-semibold text-center text-gray-900 dark:text-white mb-2'>
                {pageName} Error
              </h2>

              <p className='text-center text-gray-600 dark:text-gray-400 mb-4'>
                Something went wrong while loading this page.
                {errorCount > 1 && (
                  <span className='block text-sm mt-1'>Error occurred {errorCount} times</span>
                )}
              </p>

              {/* Error Details (Development Only) */}
              {showDetails && process.env.NODE_ENV === 'development' && (
                <div className='mb-4 p-3 bg-gray-100 dark:bg-gray-700 rounded text-xs'>
                  <p className='font-mono text-red-600 dark:text-red-400 mb-2'>
                    {_error?.toString()}
                  </p>
                  {_error?.stack && (
                    <details className='cursor-pointer'>
                      <summary className='text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'>
                        Stack Trace
                      </summary>
                      <pre className='mt-2 text-gray-600 dark:text-gray-400 overflow-x-auto'>
                        {_error.stack}
                      </pre>
                    </details>
                  )}
                </div>
              )}

              {/* Last Error Time */}
              {lastErrorTime && (
                <p className='text-center text-xs text-gray-500 dark:text-gray-400 mb-4'>
                  Last _error:{' '}
                  {lastErrorTime instanceof Date && !isNaN(lastErrorTime.getTime())
                    ? lastErrorTime.toLocaleTimeString()
                    : ''}
                </p>
              )}

              {/* Action Buttons */}
              <div className='flex flex-col space-y-2'>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={this.handleReset}
                  className='w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2'
                >
                  <ArrowPathIcon className='w-4 h-4' />
                  <span>Try Again</span>
                </motion.button>

                <div className='flex space-x-2'>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={this.handleGoHome}
                    className='flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors flex items-center justify-center space-x-2'
                  >
                    <HomeIcon className='w-4 h-4' />
                    <span>Go Home</span>
                  </motion.button>

                  {process.env.NODE_ENV === 'development' && (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={this.handleReportBug}
                      className='flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors flex items-center justify-center space-x-2'
                    >
                      <BugAntIcon className='w-4 h-4' />
                      <span>Report Bug</span>
                    </motion.button>
                  )}
                </div>
              </div>

              {/* Auto-retry indicator */}
              {errorCount < 3 && (
                <div className='mt-4 text-center'>
                  <p className='text-xs text-gray-500 dark:text-gray-400'>
                    Auto-retrying in 5 seconds...
                  </p>
                  <div className='mt-2 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden'>
                    <motion.div
                      className='h-full bg-blue-500'
                      initial={{ width: '100%' }}
                      animate={{ width: '0%' }}
                      transition={{ duration: 5, ease: 'linear' }}
                    />
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      );
    }

    return children;
  }
}

/**
 * Higher-order component to wrap any component with _error boundary
 */
export function withPageErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  pageName?: string
): React.ComponentType<P> {
  const WrappedComponent = (props: P) => (
    <PageErrorBoundary pageName={pageName}>
      <Component {...props} />
    </PageErrorBoundary>
  );
  WrappedComponent.displayName = `withPageErrorBoundary(${Component.displayName || Component.name})`;
  return WrappedComponent;
}

/**
 * Hook to trigger _error boundary (for testing)
 */
export function useErrorHandler() {
  return (_error: Error) => {
    throw _error;
  };
}

export default PageErrorBoundary;
