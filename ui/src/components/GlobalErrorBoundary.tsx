import React, { ReactNode } from 'react';
import { ErrorBoundary } from './ErrorBoundary';
import { useStore } from '../store';

interface GlobalErrorBoundaryProps {
  children: ReactNode;
}

/**
 * Global error boundary that integrates with Zustand store
 * Captures errors and updates global state for centralized error handling
 */
export function GlobalErrorBoundary({ children }: GlobalErrorBoundaryProps) {
  const setGlobalError = useStore(state => state.setGlobalError);
  
  const handleError = (error: Error, errorInfo: React.ErrorInfo) => {
    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Global Error Boundary caught an error:', error);
      console.error('Error Info:', errorInfo);
    }
    
    // Update global error state
    setGlobalError({
      message: `Application Error: ${error.message}`,
      type: 'error',
      timestamp: new Date(),
    });
    
    // In production, you might want to send this to an error reporting service
    // Example: Sentry.captureException(error, { extra: errorInfo });
  };
  
  return (
    <ErrorBoundary 
      name="GlobalErrorBoundary"
      onError={handleError}
    >
      {children}
    </ErrorBoundary>
  );
}