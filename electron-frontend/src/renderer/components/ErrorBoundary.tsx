import { Component, ErrorInfo, ReactNode } from 'react';
import { motion } from 'framer-motion';
import { ExclamationTriangleIcon, ArrowPathIcon, HomeIcon } from '@heroicons/react/24/outline';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (_error: Error, __errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  _error: Error | null;
  __errorInfo: ErrorInfo | null;
  errorCount: number;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      _error: null,
      __errorInfo: null,
      errorCount: 0,
    };
  }

  static getDerivedStateFromError(_error: Error): Partial<State> {
    return { hasError: true, _error };
  }

  componentDidCatch(_error: Error, __errorInfo: ErrorInfo) {
    // Log errors for debugging
    console.error('ErrorBoundary caught an error:', _error, __errorInfo);

    this.setState(prevState => ({
      __errorInfo,
      errorCount: prevState.errorCount + 1,
    }));

    // Call custom error handler if provided
    this.props.onError?.(_error, __errorInfo);

    // Log to external service (e.g., Sentry) in production
    if (process.env.NODE_ENV === 'production') {
      // logErrorToService(_error, __errorInfo);
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      _error: null,
      __errorInfo: null,
    });

    // Reload the window if errors persist
    if (this.state.errorCount > 3) {
      window.location.reload();
    }
  };

  handleGoHome = () => {
    this.setState({
      hasError: false,
      _error: null,
      __errorInfo: null,
    });
    window.location.hash = '/';
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return <>{this.props.fallback}</>;
      }

      // Default _error UI
      return (
        <div className='min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-8'>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className='glass-card max-w-2xl w-full p-8 text-center'
          >
            <motion.div
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 0.5, repeat: 3 }}
              className='inline-flex items-center justify-center w-20 h-20 bg-red-500/20 rounded-full mb-6'
            >
              <ExclamationTriangleIcon className='w-10 h-10 text-red-500' />
            </motion.div>

            <h1 className='text-2xl font-bold text-white mb-2'>Oops! Something went wrong</h1>

            <p className='text-gray-300 mb-6'>
              We encountered an unexpected error. Don&apos;t worry, your data is safe.
            </p>

            {/* Error details in development */}
            {process.env.NODE_ENV === 'development' && this.state._error && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                transition={{ delay: 0.2 }}
                className='mb-6 p-4 bg-black/30 rounded-lg text-left'
              >
                <p className='text-red-400 font-mono text-sm mb-2'>
                  {this.state._error.toString()}
                </p>
                {this.state.__errorInfo && (
                  <details className='text-gray-400 text-xs'>
                    <summary className='cursor-pointer hover:text-gray-300'>Stack Trace</summary>
                    <pre className='mt-2 overflow-auto max-h-40'>
                      {this.state.__errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </motion.div>
            )}

            <div className='flex gap-4 justify-center'>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={this.handleReset}
                className='glass-button flex items-center gap-2 px-6 py-3 rounded-xl'
              >
                <ArrowPathIcon className='w-5 h-5' />
                Try Again
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={this.handleGoHome}
                className='glass-button flex items-center gap-2 px-6 py-3 rounded-xl'
              >
                <HomeIcon className='w-5 h-5' />
                Go Home
              </motion.button>
            </div>

            {this.state.errorCount > 1 && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className='text-yellow-400 text-sm mt-4'
              >
                This error has occurred {this.state.errorCount} times.
                {this.state.errorCount > 3 && ' The app will reload on next attempt.'}
              </motion.p>
            )}
          </motion.div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook for functional components to report errors
export function useErrorHandler() {
  return (_error: Error, _errorInfo?: ErrorInfo) => {
    console.error('Error reported:', _error, _errorInfo);
    // Could integrate with store to show notifications
    // useStore.getState().addNotification({
    //   type: 'error',
    //   message: error.message,
    // });
  };
}
