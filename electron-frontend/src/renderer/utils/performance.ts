import Logger from '../utils/logger';
// Debounce function for reducing function call frequency
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function (this: ThisParameterType<T>, ...args: Parameters<T>) {
    if (timeout) clearTimeout(timeout);

    timeout = setTimeout(() => {
      func.apply(this, args);
    }, wait);
  };
}

// Throttle function for limiting function call rate
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;

  return function (this: ThisParameterType<T>, ...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;

      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

// Memoization function for caching expensive computations
export function memoize<T extends (...args: any[]) => any>(
  func: T,
  getKey?: (...args: Parameters<T>) => string
): T {
  const cache = new Map<string, ReturnType<T>>();

  return ((...args: Parameters<T>) => {
    const key = getKey ? getKey(...args) : JSON.stringify(args);

    if (cache.has(key)) {
      return cache.get(key);
    }

    const result = func(...args);
    cache.set(key, result);

    // Limit cache size to prevent memory leaks
    if (cache.size > 100) {
      const firstKey = cache.keys().next().value;
      if (firstKey !== undefined) {
        cache.delete(firstKey);
      }
    }

    return result;
  }) as T;
}

// Request Animation Frame throttle for smooth animations
export function rafThrottle<T extends (...args: any[]) => any>(
  func: T
): (...args: Parameters<T>) => void {
  let rafId: number | null = null;
  let lastArgs: Parameters<T> | null = null;

  return function (this: ThisParameterType<T>, ...args: Parameters<T>) {
    lastArgs = args;

    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        func.apply(this, lastArgs!);
        rafId = null;
      });
    }
  };
}

// Batch updates for reducing React re-renders
export function batchUpdates(updates: Array<() => void>, delay: number = 0): Promise<void> {
  return new Promise(resolve => {
    setTimeout(() => {
      updates.forEach(update => update());
      resolve();
    }, delay);
  });
}

// Deep comparison for React.memo
export function deepEqual(obj1: unknown, obj2: unknown): boolean {
  if (obj1 === obj2) return true;

  if (typeof obj1 !== 'object' || obj1 === null || typeof obj2 !== 'object' || obj2 === null) {
    return false;
  }

  const keys1 = Object.keys(obj1 as Record<string, unknown>);
  const keys2 = Object.keys(obj2 as Record<string, unknown>);

  if (keys1.length !== keys2.length) return false;

  for (const key of keys1) {
    if (!keys2.includes(key)) return false;
    if (!deepEqual((obj1 as Record<string, unknown>)[key], (obj2 as Record<string, unknown>)[key]))
      return false;
  }

  return true;
}

// Shallow comparison for React.memo
export function shallowEqual(obj1: unknown, obj2: unknown): boolean {
  if (obj1 === obj2) return true;

  if (typeof obj1 !== 'object' || obj1 === null || typeof obj2 !== 'object' || obj2 === null) {
    return false;
  }

  const keys1 = Object.keys(obj1 as Record<string, unknown>);
  const keys2 = Object.keys(obj2 as Record<string, unknown>);

  if (keys1.length !== keys2.length) return false;

  for (const key of keys1) {
    if (!keys2.includes(key)) return false;
    if ((obj1 as Record<string, unknown>)[key] !== (obj2 as Record<string, unknown>)[key])
      return false;
  }

  return true;
}

// Performance monitoring
export class PerformanceMonitor {
  private marks: Map<string, number> = new Map();
  private measures: Map<string, number[]> = new Map();

  mark(name: string): void {
    this.marks.set(name, performance.now());
  }

  measure(name: string, startMark: string, endMark?: string): number {
    const start = this.marks.get(startMark);
    const end = endMark ? this.marks.get(endMark) : performance.now();

    if (!start) {
      if (process.env.NODE_ENV === 'development') {
        if (process.env.NODE_ENV === 'development') {
          Logger.warn(`Start mark "${startMark}" not found`);
        }
      }
      return 0;
    }

    const duration = (end || performance.now()) - start;

    if (!this.measures.has(name)) {
      this.measures.set(name, []);
    }

    this.measures.get(name)!.push(duration);

    // Keep only last 100 measurements
    const measurements = this.measures.get(name)!;
    if (measurements.length > 100) {
      measurements.shift();
    }

    return duration;
  }

  getAverage(name: string): number {
    const measurements = this.measures.get(name);
    if (!measurements || measurements.length === 0) return 0;

    const sum = measurements.reduce((acc, val) => acc + val, 0);
    return sum / measurements.length;
  }

  getReport(): Record<string, { average: number; count: number }> {
    const report: Record<string, { average: number; count: number }> = {};

    for (const [name, measurements] of this.measures.entries()) {
      if (measurements.length > 0) {
        const sum = measurements.reduce((acc, val) => acc + val, 0);
        report[name] = {
          average: sum / measurements.length,
          count: measurements.length,
        };
      }
    }

    return report;
  }

  clear(): void {
    this.marks.clear();
    this.measures.clear();
  }
}

// Singleton performance monitor instance
export const perfMonitor = new PerformanceMonitor();

// Performance Analysis Report Generator
export class PerformanceAnalyzer {
  private static instance: PerformanceAnalyzer;
  private metrics: Map<string, number[]> = new Map();
  private startTime = performance.now();

  static getInstance(): PerformanceAnalyzer {
    if (!PerformanceAnalyzer.instance) {
      PerformanceAnalyzer.instance = new PerformanceAnalyzer();
    }
    return PerformanceAnalyzer.instance;
  }

  recordMetric(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(value);
  }

  getAverageMetric(name: string): number {
    const values = this.metrics.get(name);
    if (!values || values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  getMetricPercentile(name: string, percentile: number): number {
    const values = this.metrics.get(name);
    if (!values || values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)] || 0;
  }

  generateReport(): {
    overview: {
      totalUptime: number;
      averageRenderTime: number;
      p95RenderTime: number;
      memoryUsage: number;
      renderCount: number;
    };
    recommendations: string[];
    criticalIssues: string[];
  } {
    const uptime = performance.now() - this.startTime;
    const renderTimes = this.metrics.get('component-render') || [];
    const memoryUsage = this.getAverageMetric('memory-usage');

    const recommendations: string[] = [];
    const criticalIssues: string[] = [];

    // Analyze render performance
    const avgRender = this.getAverageMetric('component-render');
    if (avgRender > 16.67) {
      // 60fps threshold
      criticalIssues.push(
        `Average render time (${avgRender.toFixed(2)}ms) exceeds 60fps threshold`
      );
      recommendations.push('Consider using React.memo for heavy components');
      recommendations.push('Implement virtual scrolling for large lists');
    }

    // Analyze memory usage
    if (memoryUsage > 100) {
      // 100MB threshold
      criticalIssues.push(`High memory usage detected (${memoryUsage.toFixed(1)}MB)`);
      recommendations.push('Check for memory leaks in useEffect cleanup');
      recommendations.push('Implement lazy loading for images and components');
    }

    // Bundle size analysis
    const bundleSize = this.getAverageMetric('bundle-size');
    if (bundleSize > 1024) {
      // 1MB threshold
      recommendations.push('Enable tree shaking and code splitting');
      recommendations.push('Use dynamic imports for route-based splitting');
    }

    return {
      overview: {
        totalUptime: uptime,
        averageRenderTime: avgRender,
        p95RenderTime: this.getMetricPercentile('component-render', 95),
        memoryUsage,
        renderCount: renderTimes.length,
      },
      recommendations,
      criticalIssues,
    };
  }
}

export const perfAnalyzer = PerformanceAnalyzer.getInstance();

// Lazy load images with intersection observer
export function lazyLoadImage(src: string, placeholder?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => resolve(src);
    img.onerror = reject;

    // Start with placeholder if provided
    if (placeholder) {
      resolve(placeholder);
      // Load actual image in background
      setTimeout(() => {
        img.src = src;
      }, 0);
    } else {
      img.src = src;
    }
  });
}

// Re-export from performance-components.tsx
export type { VirtualListItem } from './performance-components';
export { createVirtualListRenderer } from './performance-components';
