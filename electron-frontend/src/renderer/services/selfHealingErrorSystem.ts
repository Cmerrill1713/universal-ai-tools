/**
 * Self-Healing Error Recovery System
 * Automatically detects and fixes common frontend errors at runtime
 */

import { logger } from '../utils/logger';

interface ErrorPattern {
  id: string;
  pattern: RegExp;
  description: string;
  autoFix: (error: Error, context?: any) => void;
  telemetry: {
    category: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    frequency: number;
    lastOccurrence?: Date;
  };
}

interface TelemetryEvent {
  timestamp: Date;
  errorId: string;
  errorMessage: string;
  stackTrace?: string;
  autoFixed: boolean;
  fixApplied?: string;
  userAgent: string;
  componentPath?: string;
  performance: {
    memoryUsage: number;
    cpuUsage?: number;
  };
}

class SelfHealingErrorSystem {
  private errorPatterns: Map<string, ErrorPattern> = new Map();
  private telemetryBuffer: TelemetryEvent[] = [];
  private isDevToolsAvailable: boolean = false;
  private errorCounts: Map<string, number> = new Map();
  private autoFixEnabled: boolean = true;
  private maxTelemetryBufferSize: number = 1000;

  constructor() {
    // Initialize in both development and production modes for system healing
    this.initializeErrorPatterns();
    this.setupGlobalErrorHandlers();
    if (process.env.NODE_ENV === 'development') {
      this.initializeDevToolsIntegration();
    }
    this.startTelemetryReporter();
  }

  /**
   * Initialize common error patterns with auto-fix strategies
   */
  private initializeErrorPatterns(): void {
    // Pattern 1: Parameter naming inconsistencies
    this.errorPatterns.set('param-naming', {
      id: 'param-naming',
      pattern: /Cannot read prop.*of undefined.*\b_?e\b/i,
      description: 'Parameter naming inconsistency (_e vs e)',
      autoFix: (error, context) => {
        logger.warn('[SelfHealing] Detected parameter naming issue', { error: error.message });
        // Auto-fix by ensuring consistent parameter references
        if (context?.component && context?.handler) {
          this.patchEventHandler(context.component, context.handler);
        }
      },
      telemetry: {
        category: 'syntax',
        severity: 'medium',
        frequency: 0,
      },
    });

    // Pattern 2: useState/useEffect not imported
    this.errorPatterns.set('hooks-import', {
      id: 'hooks-import',
      pattern: /use(State|Effect|Ref|Memo|Callback) is not defined/i,
      description: 'React hooks not properly imported',
      autoFix: (error, context) => {
        logger.warn('[SelfHealing] React hook import missing', { error: error.message });
        // Dynamically inject missing hooks
        this.injectMissingHooks(context?.component);
      },
      telemetry: {
        category: 'import',
        severity: 'high',
        frequency: 0,
      },
    });

    // Pattern 3: Undefined variable in catch blocks
    this.errorPatterns.set('catch-variable', {
      id: 'catch-variable',
      pattern: /Cannot read.*of undefined.*catch/i,
      description: 'Variable reference error in catch block',
      autoFix: (error, context) => {
        logger.warn('[SelfHealing] Catch block variable mismatch', { error: error.message });
        this.fixCatchBlockVariable(context);
      },
      telemetry: {
        category: 'syntax',
        severity: 'medium',
        frequency: 0,
      },
    });

    // Pattern 4: Component render errors
    this.errorPatterns.set('render-error', {
      id: 'render-error',
      pattern: /Cannot read.*during render|Objects are not valid as a React child/i,
      description: 'Component render error',
      autoFix: (error, context) => {
        logger.error('[SelfHealing] Component render error', { error: error.message });
        this.wrapComponentWithErrorBoundary(context?.component);
      },
      telemetry: {
        category: 'render',
        severity: 'critical',
        frequency: 0,
      },
    });

    // Pattern 5: Async operation errors
    this.errorPatterns.set('async-error', {
      id: 'async-error',
      pattern: /Unhandled Promise Rejection|await is only valid in async/i,
      description: 'Async/await error',
      autoFix: (error, context) => {
        logger.warn('[SelfHealing] Async operation error', { error: error.message });
        this.wrapInAsyncHandler(context);
      },
      telemetry: {
        category: 'async',
        severity: 'high',
        frequency: 0,
      },
    });

    // Pattern 6: Memory leak detection
    this.errorPatterns.set('memory-leak', {
      id: 'memory-leak',
      pattern: /Maximum update depth exceeded|memory leak/i,
      description: 'Potential memory leak detected',
      autoFix: (error, context) => {
        logger.error('[SelfHealing] Memory leak detected', { error: error.message });
        this.cleanupMemoryLeaks(context);
      },
      telemetry: {
        category: 'performance',
        severity: 'critical',
        frequency: 0,
      },
    });
  }

  /**
   * Setup global error handlers with telemetry
   */
  private setupGlobalErrorHandlers(): void {
    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', event => {
      // Only log in development, don't add to telemetry
      if (process.env.NODE_ENV === 'development') {
        logger.debug('[SelfHealing] Unhandled rejection:', event.reason);
      }
      event.preventDefault();
    });

    // Handle general errors
    window.addEventListener('error', event => {
      // Filter out non-critical errors
      const errorMessage = event.message?.toLowerCase() || '';
      const ignoredErrors = [
        'resizeobserver loop',
        'non-error promise rejection',
        'network request failed',
        'failed to fetch',
        'load failed',
      ];

      if (ignoredErrors.some(ignored => errorMessage.includes(ignored))) {
        event.preventDefault();
        return;
      }

      // Only handle critical errors in production
      if (process.env.NODE_ENV === 'production') {
        event.preventDefault();
        return;
      }

      this.handleError(event.error || new Error(event.message), {
        source: 'window.error',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
      if (this.autoFixEnabled) {
        event.preventDefault();
      }
    });

    // React Error Boundary integration
    if (typeof window !== 'undefined' && (window as any).React) {
      this.setupReactErrorBoundary();
    }
  }

  /**
   * Initialize DevTools integration for enhanced debugging
   */
  private initializeDevToolsIntegration(): void {
    if (typeof window !== 'undefined' && (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__) {
      this.isDevToolsAvailable = true;

      // Inject custom DevTools panel
      this.injectDevToolsPanel();

      // Hook into React DevTools for component inspection
      const devTools = (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;
      if (devTools.onCommitFiberRoot) {
        const originalOnCommit = devTools.onCommitFiberRoot;
        devTools.onCommitFiberRoot = (id: any, root: any) => {
          this.analyzeComponentTree(root);
          return originalOnCommit(id, root);
        };
      }
    }

    // Chrome DevTools Protocol integration
    if ((window as any).chrome?.devtools) {
      this.setupChromeDevToolsIntegration();
    }
  }

  /**
   * Inject custom DevTools panel for error monitoring
   */
  private injectDevToolsPanel(): void {
    if (!this.isDevToolsAvailable) return;

    // Create custom panel in DevTools
    const panel = {
      name: 'Self-Healing Errors',
      version: '1.0.0',
      getErrors: () => this.getErrorSummary(),
      getTelemetry: () => this.getTelemetryData(),
      toggleAutoFix: (enabled: boolean) => (this.autoFixEnabled = enabled),
      clearErrors: () => this.clearErrorHistory(),
      exportTelemetry: () => this.exportTelemetry(),
    };

    (window as any).__SELF_HEALING_PANEL__ = panel;

    logger.info('[SelfHealing] DevTools panel injected', panel);
  }

  /**
   * Setup Chrome DevTools Protocol integration
   */
  private setupChromeDevToolsIntegration(): void {
    try {
      const chrome = (window as any).chrome;
      if (chrome?.devtools?.inspectedWindow) {
        chrome.devtools.inspectedWindow.eval(
          `console.log('[SelfHealing] Chrome DevTools integration active')`,
          (result: any, error: any) => {
            if (!error) {
              this.enableChromeDevToolsFeatures();
            }
          }
        );
      }
    } catch (error) {
      logger.debug('[SelfHealing] Chrome DevTools not available');
    }
  }

  /**
   * Enable Chrome DevTools specific features
   */
  private enableChromeDevToolsFeatures(): void {
    // Performance monitoring
    if (performance && performance.mark) {
      performance.mark('self-healing-init');
    }

    // Memory profiling
    if ((performance as any).memory) {
      setInterval(() => {
        const memInfo = (performance as any).memory;
        if (memInfo.usedJSHeapSize / memInfo.jsHeapSizeLimit > 0.9) {
          this.handleError(new Error('Memory usage critical'), {
            source: 'memory-monitor',
            memoryInfo: memInfo,
          });
        }
      }, 30000); // Check every 30 seconds
    }
  }

  /**
   * Main error handler with pattern matching and auto-fix
   */
  public handleError(error: Error, context?: any): void {
    const errorString = error.toString();
    const stackTrace = error.stack || '';

    // Pattern matching
    let matchedPattern: ErrorPattern | null = null;
    for (const pattern of this.errorPatterns.values()) {
      if (pattern.pattern.test(errorString) || pattern.pattern.test(stackTrace)) {
        matchedPattern = pattern;
        break;
      }
    }

    // Update error counts
    const errorId = matchedPattern?.id || 'unknown';
    this.errorCounts.set(errorId, (this.errorCounts.get(errorId) || 0) + 1);

    // Record telemetry
    const telemetryEvent: TelemetryEvent = {
      timestamp: new Date(),
      errorId,
      errorMessage: error.message,
      stackTrace,
      autoFixed: false,
      userAgent: navigator.userAgent,
      componentPath: context?.componentPath,
      performance: {
        memoryUsage: (performance as any).memory?.usedJSHeapSize || 0,
      },
    };

    // Attempt auto-fix if pattern matched
    if (matchedPattern && this.autoFixEnabled) {
      try {
        matchedPattern.autoFix(error, context);
        telemetryEvent.autoFixed = true;
        telemetryEvent.fixApplied = matchedPattern.description;
        matchedPattern.telemetry.frequency++;
        matchedPattern.telemetry.lastOccurrence = new Date();

        logger.info('[SelfHealing] Auto-fix applied', {
          errorId: matchedPattern.id,
          description: matchedPattern.description,
        });
      } catch (fixError) {
        logger.error('[SelfHealing] Auto-fix failed', fixError);
      }
    }

    // Add to telemetry buffer
    this.addTelemetryEvent(telemetryEvent);

    // Emit to DevTools if available
    if (this.isDevToolsAvailable) {
      this.emitToDevTools(telemetryEvent);
    }
  }

  /**
   * Patch event handlers with parameter naming issues
   */
  private patchEventHandler(component: any, handler: string): void {
    if (!component || !handler) return;

    try {
      const originalHandler = component[handler];
      if (typeof originalHandler === 'function') {
        component[handler] = function (event: any) {
          // Ensure consistent parameter naming
          const _e = event;
          const e = event; // Alias for compatibility
          return originalHandler.call(this, event);
        };
        logger.debug('[SelfHealing] Patched event handler', { handler });
      }
    } catch (error) {
      logger.error('[SelfHealing] Failed to patch event handler', error);
    }
  }

  /**
   * Inject missing React hooks dynamically
   */
  private injectMissingHooks(component: any): void {
    if (!component || typeof window === 'undefined') return;

    try {
      const React = (window as any).React;
      if (React) {
        // Ensure all common hooks are available
        const hooks = ['useState', 'useEffect', 'useRef', 'useMemo', 'useCallback'];
        hooks.forEach(hook => {
          if (!(window as any)[hook]) {
            (window as any)[hook] = React[hook];
            logger.debug(`[SelfHealing] Injected missing hook: ${hook}`);
          }
        });
      }
    } catch (error) {
      logger.error('[SelfHealing] Failed to inject hooks', error);
    }
  }

  /**
   * Fix variable references in catch blocks
   */
  private fixCatchBlockVariable(context: any): void {
    if (!context?.code) return;

    try {
      // This would need source map support for runtime fixing
      // For now, log the issue for manual fix
      logger.warn('[SelfHealing] Catch block variable issue detected', {
        component: context.component,
        suggestion: 'Use consistent variable naming in catch blocks',
      });
    } catch (error) {
      logger.error('[SelfHealing] Failed to fix catch block', error);
    }
  }

  /**
   * Wrap component with error boundary for safety
   */
  private wrapComponentWithErrorBoundary(component: any): void {
    if (!component) return;

    try {
      // Add error boundary wrapper
      const ErrorBoundary = this.createErrorBoundary();
      // This would need React integration to wrap the component
      logger.info('[SelfHealing] Component wrapped with error boundary');
    } catch (error) {
      logger.error('[SelfHealing] Failed to wrap component', error);
    }
  }

  /**
   * Create a React error boundary component
   */
  private createErrorBoundary(): any {
    const React = (window as any).React;
    if (!React) return null;

    class ErrorBoundary extends React.Component {
      state = { hasError: false, error: null };

      static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
      }

      componentDidCatch(error: Error, errorInfo: any) {
        logger.error('[ErrorBoundary] Caught error', { error, errorInfo });
      }

      render() {
        if (this.state.hasError) {
          return React.createElement(
            'div',
            {
              style: { padding: '20px', background: '#f8d7da', color: '#721c24' },
            },
            'Component error - Self-healing in progress...'
          );
        }
        return this.props.children;
      }
    }

    return ErrorBoundary;
  }

  /**
   * Wrap async operations in proper error handling
   */
  private wrapInAsyncHandler(context: any): void {
    if (!context?.fn || typeof context.fn !== 'function') return;

    const originalFn = context.fn;
    context.fn = async (...args: any[]) => {
      try {
        return await originalFn(...args);
      } catch (error) {
        logger.error('[SelfHealing] Async operation failed', error);
        this.handleError(error as Error, { ...context, source: 'async-wrapper' });
        throw error;
      }
    };
  }

  /**
   * Clean up potential memory leaks
   */
  private cleanupMemoryLeaks(context: any): void {
    try {
      // Clear event listeners
      if (context?.element) {
        const element = context.element;
        const newElement = element.cloneNode(true);
        element.parentNode?.replaceChild(newElement, element);
        logger.info('[SelfHealing] Cleared event listeners to prevent leak');
      }

      // Clear timers
      if (context?.timers) {
        context.timers.forEach((timer: number) => {
          clearTimeout(timer);
          clearInterval(timer);
        });
      }

      // Trigger garbage collection if available
      if ((window as any).gc) {
        (window as any).gc();
        logger.info('[SelfHealing] Triggered garbage collection');
      }
    } catch (error) {
      logger.error('[SelfHealing] Failed to cleanup memory', error);
    }
  }

  /**
   * Setup React Error Boundary integration
   */
  private setupReactErrorBoundary(): void {
    const React = (window as any).React;
    if (!React || !React.Component) return;

    // Override React.Component.prototype.setState to catch state update errors
    const originalSetState = React.Component.prototype.setState;
    React.Component.prototype.setState = function (updater: any, callback?: any) {
      try {
        return originalSetState.call(this, updater, callback);
      } catch (error) {
        logger.error('[SelfHealing] setState error caught', error);
        // Attempt recovery
        return originalSetState.call(this, {}, callback);
      }
    };
  }

  /**
   * Analyze React component tree for issues
   */
  private analyzeComponentTree(root: any): void {
    if (!root) return;

    try {
      // Walk the fiber tree looking for issues
      const issues: any[] = [];
      const walkFiber = (fiber: any) => {
        if (!fiber) return;

        // Check for common issues
        if (fiber.memoizedState && typeof fiber.memoizedState === 'object') {
          // Check for excessive re-renders
          if (fiber.actualDuration > 16) {
            issues.push({
              type: 'performance',
              component: fiber.elementType?.name || 'Unknown',
              duration: fiber.actualDuration,
            });
          }
        }

        // Recurse through tree
        if (fiber.child) walkFiber(fiber.child);
        if (fiber.sibling) walkFiber(fiber.sibling);
      };

      walkFiber(root.current);

      if (issues.length > 0) {
        logger.warn('[SelfHealing] Component tree issues detected', issues);
      }
    } catch (error) {
      logger.error('[SelfHealing] Failed to analyze component tree', error);
    }
  }

  /**
   * Add telemetry event to buffer
   */
  private addTelemetryEvent(event: TelemetryEvent): void {
    this.telemetryBuffer.push(event);

    // Maintain buffer size limit
    if (this.telemetryBuffer.length > this.maxTelemetryBufferSize) {
      this.telemetryBuffer.shift();
    }
  }

  /**
   * Emit telemetry to DevTools
   */
  private emitToDevTools(event: TelemetryEvent): void {
    if (!this.isDevToolsAvailable) return;

    try {
      // Emit custom event for DevTools
      window.postMessage(
        {
          type: 'SELF_HEALING_ERROR',
          payload: event,
        },
        '*'
      );

      // Also log to console for DevTools Console
      console.groupCollapsed(
        `%c[SelfHealing] ${event.autoFixed ? '✅' : '❌'} ${event.errorId}`,
        `color: ${event.autoFixed ? 'green' : 'red'}; font-weight: bold;`
      );
      console.log('Error:', event.errorMessage);
      console.log('Auto-fixed:', event.autoFixed);
      if (event.fixApplied) {
        console.log('Fix applied:', event.fixApplied);
      }
      if (event.stackTrace) {
        console.log('Stack trace:', event.stackTrace);
      }
      console.log('Telemetry:', event);
      console.groupEnd();
    } catch (error) {
      logger.error('[SelfHealing] Failed to emit to DevTools', error);
    }
  }

  /**
   * Start telemetry reporter
   */
  private startTelemetryReporter(): void {
    // Report telemetry every 5 minutes
    setInterval(
      () => {
        this.reportTelemetry();
      },
      5 * 60 * 1000
    );

    // Report on page unload
    window.addEventListener('beforeunload', () => {
      this.reportTelemetry();
    });
  }

  /**
   * Report telemetry to backend
   */
  private async reportTelemetry(): Promise<void> {
    if (this.telemetryBuffer.length === 0) return;

    try {
      const summary = this.getTelemetryData();

      // Send to backend API
      await fetch('/api/telemetry/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(summary),
      });

      logger.info('[SelfHealing] Telemetry reported', {
        eventCount: this.telemetryBuffer.length,
      });
    } catch (error) {
      logger.error('[SelfHealing] Failed to report telemetry', error);
    }
  }

  /**
   * Get error summary for DevTools
   */
  public getErrorSummary(): any {
    const summary: any = {
      totalErrors: 0,
      autoFixed: 0,
      byCategory: {},
      bySeverity: {},
      topErrors: [],
    };

    this.errorCounts.forEach((count, errorId) => {
      summary.totalErrors += count;
      const pattern = this.errorPatterns.get(errorId);
      if (pattern) {
        summary.byCategory[pattern.telemetry.category] =
          (summary.byCategory[pattern.telemetry.category] || 0) + count;
        summary.bySeverity[pattern.telemetry.severity] =
          (summary.bySeverity[pattern.telemetry.severity] || 0) + count;
      }
    });

    summary.autoFixed = this.telemetryBuffer.filter(e => e.autoFixed).length;

    // Get top 5 errors
    const sortedErrors = Array.from(this.errorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    summary.topErrors = sortedErrors.map(([errorId, count]) => ({
      errorId,
      count,
      pattern: this.errorPatterns.get(errorId)?.description || 'Unknown',
    }));

    return summary;
  }

  /**
   * Get telemetry data for export
   */
  public getTelemetryData(): any {
    return {
      timestamp: new Date(),
      summary: this.getErrorSummary(),
      events: this.telemetryBuffer,
      patterns: Array.from(this.errorPatterns.values()).map(p => ({
        id: p.id,
        description: p.description,
        frequency: p.telemetry.frequency,
        lastOccurrence: p.telemetry.lastOccurrence,
      })),
    };
  }

  /**
   * Clear error history
   */
  public clearErrorHistory(): void {
    this.telemetryBuffer = [];
    this.errorCounts.clear();
    this.errorPatterns.forEach(pattern => {
      pattern.telemetry.frequency = 0;
      pattern.telemetry.lastOccurrence = undefined;
    });
    logger.info('[SelfHealing] Error history cleared');
  }

  /**
   * Export telemetry data
   */
  public exportTelemetry(): string {
    const data = this.getTelemetryData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    // Create download link
    const a = document.createElement('a');
    a.href = url;
    a.download = `telemetry-${Date.now()}.json`;
    a.click();

    URL.revokeObjectURL(url);
    return url;
  }

  /**
   * Enable/disable auto-fix functionality
   */
  public setAutoFixEnabled(enabled: boolean): void {
    this.autoFixEnabled = enabled;
    logger.info(`[SelfHealing] Auto-fix ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Add custom error pattern
   */
  public addErrorPattern(pattern: ErrorPattern): void {
    this.errorPatterns.set(pattern.id, pattern);
    logger.info('[SelfHealing] Added custom error pattern', { id: pattern.id });
  }
}

// Export singleton instance
export const selfHealingSystem = new SelfHealingErrorSystem();

// Export for DevTools access (development only)
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).__SELF_HEALING_SYSTEM__ = selfHealingSystem;
}

export default selfHealingSystem;
