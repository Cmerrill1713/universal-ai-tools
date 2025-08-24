import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BugAntIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import { selfHealingSystem } from '../services/selfHealingErrorSystem';

interface DiagnosticResult {
  type: 'error' | 'warning' | 'info' | 'success';
  message: string;
  details?: string;
  timestamp: string;
  autoFixed?: boolean;
}

export const DevToolsDiagnostics: React.FC = () => {
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([]);
  const [isVisible, setIsVisible] = useState(process.env.NODE_ENV === 'development');
  const [errorSummary, setErrorSummary] = useState<any>(null);
  const [autoFixEnabled, setAutoFixEnabled] = useState(true);

  useEffect(() => {
    if (!isVisible) return;

    const runDiagnostics = () => {
      const results: DiagnosticResult[] = [];
      const timestamp = new Date().toLocaleTimeString();

      // Get self-healing system status
      const healingSummary = selfHealingSystem.getErrorSummary();
      setErrorSummary(healingSummary);

      // Add self-healing status
      if (healingSummary.totalErrors > 0) {
        results.push({
          type: healingSummary.autoFixed > 0 ? 'success' : 'warning',
          message: `Self-Healing: ${healingSummary.autoFixed}/${healingSummary.totalErrors} errors auto-fixed`,
          details: `Fix rate: ${healingSummary.autoFixed > 0 ? Math.round((healingSummary.autoFixed / healingSummary.totalErrors) * 100) : 0}%`,
          timestamp,
          autoFixed: true,
        });
      }

      // Check for React DevTools availability
      if (typeof window !== 'undefined' && (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__) {
        results.push({
          type: 'success',
          message: 'React DevTools detected and active',
          details: 'React DevTools extension is properly loaded',
          timestamp,
        });
      } else {
        results.push({
          type: 'warning',
          message: 'React DevTools not detected',
          details: 'React DevTools extension may not be installed or loaded',
          timestamp,
        });
      }

      // Check for React version
      if (typeof React !== 'undefined') {
        results.push({
          type: 'info',
          message: `React version: ${React.version}`,
          details: 'React library is properly loaded',
          timestamp,
        });
      }

      // Check for common React warnings in console
      const originalConsoleWarn = console.warn;
      const originalConsoleError = console.error;
      let _warningCount = 0;
      let _errorCount = 0;

      console.warn = (...args) => {
        if (args.some(arg => typeof arg === 'string' && arg.includes('React'))) {
          _warningCount++;
        }
        originalConsoleWarn(...args);
      };

      console.error = (...args) => {
        if (args.some(arg => typeof arg === 'string' && arg.includes('React'))) {
          _errorCount++;
        }
        originalConsoleError(...args);
      };

      // Performance checks
      if (typeof performance !== 'undefined' && typeof performance.mark === 'function') {
        results.push({
          type: 'info',
          message: 'Performance API available',
          details: 'Can monitor React component performance',
          timestamp,
        });
      }

      // Check for memory usage (if available)
      if (typeof performance !== 'undefined' && (performance as any).memory) {
        const memory = (performance as any).memory;
        const memoryUsage = (memory.usedJSHeapSize / 1024 / 1024).toFixed(2);
        results.push({
          type: 'info',
          message: `Memory usage: ${memoryUsage}MB`,
          details: `Heap limit: ${(memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)}MB`,
          timestamp,
        });
      }

      // Check for unused React hooks or components
      const checkForUnusedDeps = () => {
        // This is a simplified check - in a real scenario, you'd use more sophisticated tools
        const scripts = Array.from(document.scripts);
        const hasUnusedWarnings = scripts.some(
          script =>
            script.textContent?.includes('hook') && script.textContent?.includes('dependency')
        );

        if (hasUnusedWarnings) {
          results.push({
            type: 'warning',
            message: 'Potential unused dependencies detected',
            details: 'Check React DevTools for hook dependency warnings',
            timestamp,
          });
        }
      };

      checkForUnusedDeps();

      // Check for StrictMode
      const isStrictMode = document.documentElement.querySelector('[data-reactroot]');
      if (isStrictMode) {
        results.push({
          type: 'info',
          message: 'React StrictMode enabled',
          details: 'Enhanced error detection and warnings active',
          timestamp,
        });
      }

      setDiagnostics(results);
    };

    // Initial run
    runDiagnostics();

    // Run diagnostics every 30 seconds in development
    const interval = setInterval(runDiagnostics, 30000);

    return () => {
      clearInterval(interval);
    };
  }, [isVisible]);

  const getIcon = (type: DiagnosticResult['type']) => {
    switch (type) {
      case 'error':
        return <ExclamationTriangleIcon className='w-4 h-4 text-red-400' />;
      case 'warning':
        return <ExclamationTriangleIcon className='w-4 h-4 text-yellow-400' />;
      case 'success':
        return <CheckCircleIcon className='w-4 h-4 text-green-400' />;
      default:
        return <ChartBarIcon className='w-4 h-4 text-blue-400' />;
    }
  };

  const getBgColor = (type: DiagnosticResult['type']) => {
    switch (type) {
      case 'error':
        return 'bg-red-500/10 border-red-500/20';
      case 'warning':
        return 'bg-yellow-500/10 border-yellow-500/20';
      case 'success':
        return 'bg-green-500/10 border-green-500/20';
      default:
        return 'bg-blue-500/10 border-blue-500/20';
    }
  };

  if (!isVisible) return null;

  return (
    <motion.div
      className='fixed bottom-4 right-4 w-80 max-h-96 overflow-y-auto z-50'
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 100 }}
    >
      <div className='glass rounded-xl p-4 border border-white/10'>
        <div className='flex items-center space-x-2 mb-3'>
          <BugAntIcon className='w-5 h-5 text-blue-400' />
          <h3 className='text-sm font-medium text-white'>React DevTools Diagnostics</h3>
          <button
            onClick={() => setIsVisible(false)}
            className='ml-auto text-white/50 hover:text-white/80 transition-colors'
          >
            ×
          </button>
        </div>

        <div className='space-y-2'>
          {diagnostics.map((diagnostic, index) => (
            <motion.div
              key={`${diagnostic.message}-${index}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`p-2 rounded-lg border ${getBgColor(diagnostic.type)}`}
            >
              <div className='flex items-start space-x-2'>
                {getIcon(diagnostic.type)}
                <div className='flex-1 min-w-0'>
                  <p className='text-xs text-white/90 font-medium'>{diagnostic.message}</p>
                  {diagnostic.details && (
                    <p className='text-xs text-white/60 mt-1'>{diagnostic.details}</p>
                  )}
                  <p className='text-xs text-white/40 mt-1'>{diagnostic.timestamp}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className='mt-3 pt-3 border-t border-white/10'>
          <p className='text-xs text-white/60 text-center'>
            Open DevTools (F12) and go to Components/Profiler tabs
          </p>
        </div>

        {/* Self-Healing Controls */}
        {errorSummary && errorSummary.totalErrors > 0 && (
          <div className='mt-3 pt-3 border-t border-white/10'>
            <div className='flex items-center justify-between mb-2'>
              <div className='flex items-center space-x-2'>
                <ShieldCheckIcon className='w-4 h-4 text-green-400' />
                <span className='text-xs text-white/80 font-medium'>Self-Healing Active</span>
              </div>
              <button
                onClick={() => {
                  const newState = !autoFixEnabled;
                  setAutoFixEnabled(newState);
                  selfHealingSystem.setAutoFixEnabled(newState);
                }}
                className={`px-2 py-1 rounded text-xs transition-colors ${
                  autoFixEnabled
                    ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                    : 'bg-gray-500/20 text-gray-400 hover:bg-gray-500/30'
                }`}
              >
                {autoFixEnabled ? 'Enabled' : 'Disabled'}
              </button>
            </div>

            {/* Error Summary */}
            <div className='grid grid-cols-3 gap-2 mb-2'>
              <div className='text-center'>
                <div className='text-sm font-bold text-white/90'>{errorSummary.totalErrors}</div>
                <div className='text-xs text-white/50'>Total</div>
              </div>
              <div className='text-center'>
                <div className='text-sm font-bold text-green-400'>{errorSummary.autoFixed}</div>
                <div className='text-xs text-white/50'>Fixed</div>
              </div>
              <div className='text-center'>
                <div className='text-sm font-bold text-yellow-400'>
                  {errorSummary.totalErrors - errorSummary.autoFixed}
                </div>
                <div className='text-xs text-white/50'>Pending</div>
              </div>
            </div>

            {/* Top Errors */}
            {errorSummary.topErrors && errorSummary.topErrors.length > 0 && (
              <div className='mt-2'>
                <div className='text-xs text-white/60 mb-1'>Top Errors:</div>
                {errorSummary.topErrors.slice(0, 3).map((error: any, index: number) => (
                  <div key={index} className='flex items-center justify-between py-1'>
                    <span className='text-xs text-white/70 truncate flex-1'>{error.pattern}</span>
                    <span className='text-xs text-white/50 ml-2'>×{error.count}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className='flex space-x-2 mt-2'>
              <button
                onClick={() => selfHealingSystem.clearErrorHistory()}
                className='flex-1 px-2 py-1 bg-gray-500/20 hover:bg-gray-500/30 text-xs text-white/70 rounded transition-colors'
              >
                Clear History
              </button>
              <button
                onClick={() => selfHealingSystem.exportTelemetry()}
                className='flex-1 px-2 py-1 bg-blue-500/20 hover:bg-blue-500/30 text-xs text-blue-400 rounded transition-colors'
              >
                Export Telemetry
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};
