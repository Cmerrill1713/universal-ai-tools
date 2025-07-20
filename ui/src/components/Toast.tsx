import { useEffect, useState } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';
import { useStore } from '../store';

interface ToastProps {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  onDismiss: (id: string) => void;
}

function Toast({ id, message, type, duration = 5000, onDismiss }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Trigger entrance animation
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => onDismiss(id), 300); // Match exit animation duration
  };

  const icons = {
    success: CheckCircle,
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info,
  };

  const styles = {
    success: 'bg-green-900/90 border-green-600 text-green-100',
    error: 'bg-red-900/90 border-red-600 text-red-100',
    warning: 'bg-yellow-900/90 border-yellow-600 text-yellow-100',
    info: 'bg-blue-900/90 border-blue-600 text-blue-100',
  };

  const iconStyles = {
    success: 'text-green-400',
    error: 'text-red-400',
    warning: 'text-yellow-400',
    info: 'text-blue-400',
  };

  const Icon = icons[type];

  return (
    <div
      className={cn(
        'relative flex items-center gap-3 p-4 rounded-lg border backdrop-blur-sm shadow-lg transition-all duration-300 ease-in-out',
        styles[type],
        isVisible && !isExiting ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      )}
    >
      <Icon className={cn('h-5 w-5 flex-shrink-0', iconStyles[type])} />
      
      <p className="flex-1 text-sm font-medium">{message}</p>
      
      <button
        onClick={handleDismiss}
        className="flex-shrink-0 p-1 rounded hover:bg-black/20 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

interface ToastContainerProps {
  className?: string;
}

export function ToastContainer({ className }: ToastContainerProps) {
  const { globalError, clearGlobalError } = useStore();
  const [toasts, setToasts] = useState<Array<{
    id: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
    timestamp: Date;
  }>>([]);

  // Convert global errors to toasts
  useEffect(() => {
    if (globalError) {
      const toast = {
        id: `toast-${Date.now()}`,
        message: globalError.message,
        type: globalError.type === 'error' ? 'error' as const : 
              globalError.type === 'warning' ? 'warning' as const : 'info' as const,
        timestamp: globalError.timestamp,
      };
      
      setToasts(prev => [...prev, toast]);
      
      // Clear global error after converting to toast
      setTimeout(() => clearGlobalError(), 100);
    }
  }, [globalError, clearGlobalError]);

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div className={cn(
      'fixed top-4 right-4 z-50 flex flex-col gap-2 w-96 max-w-[90vw]',
      className
    )}>
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          id={toast.id}
          message={toast.message}
          type={toast.type}
          onDismiss={dismissToast}
        />
      ))}
    </div>
  );
}

// Utility hook for programmatic toast creation
export function useToast() {
  const { setGlobalError } = useStore();
  
  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    setGlobalError({
      message,
      type,
      timestamp: new Date(),
    });
  };

  return {
    success: (message: string) => showToast(message, 'success'),
    error: (message: string) => showToast(message, 'error'),
    warning: (message: string) => showToast(message, 'warning'),
    info: (message: string) => showToast(message, 'info'),
  };
}