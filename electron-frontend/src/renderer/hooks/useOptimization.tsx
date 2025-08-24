import React, { useMemo, useCallback, useRef, useEffect, DependencyList } from 'react';
import { debounce, throttle } from '../utils/performance';

import Logger from '../utils/logger';
// Custom hook for memoized computations
export function useComputed<_T>(factory: () => _T, deps: DependencyList): _T {
  return useMemo(() => factory(), deps);
}

// Custom hook for stable callbacks
export function useStableCallback<_T extends (...args: unknown[]) => unknown>(
  callback: _T,
  deps: DependencyList
): _T {
  return useCallback((...args: unknown[]) => callback(...args), deps) as _T;
}

// Custom hook for debounced values
export function useDebouncedValue<_T>(value: _T, delay: number = 500): _T {
  const [debouncedValue, setDebouncedValue] = React.useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Custom hook for debounced callbacks
export function useDebouncedCallback<_T extends (...args: unknown[]) => unknown>(
  callback: _T,
  delay: number = 500
): _T {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const debouncedCallback = useMemo(
    () => debounce((...args: unknown[]) => callbackRef.current(...(args as Parameters<_T>)), delay),
    [delay]
  );

  return debouncedCallback as _T;
}

// Custom hook for throttled callbacks
export function useThrottledCallback<_T extends (...args: unknown[]) => unknown>(
  callback: _T,
  delay: number = 100
): _T {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const throttledCallback = useMemo(
    () => throttle((...args: unknown[]) => callbackRef.current(...(args as Parameters<_T>)), delay),
    [delay]
  );

  return throttledCallback as _T;
}

// Custom hook for lazy loading components
export function useLazyComponent<T extends Record<string, unknown> = Record<string, unknown>>(
  importFunc: () => Promise<{ default: React.ComponentType<T> }>,
  fallback?: React.ReactNode
) {
  const Component = React.lazy(importFunc);

  return React.useMemo(() => {
    const LazyComponent: React.ComponentType<T> = (props: T) => (
      <React.Suspense fallback={fallback || <div>Loading...</div>}>
        <Component {...(props as any)} />
      </React.Suspense>
    );

    return LazyComponent;
  }, [Component, fallback]);
}

// Custom hook for intersection observer
export function useIntersectionObserver(
  ref: React.RefObject<Element>,
  options?: IntersectionObserverInit
): boolean {
  const [isIntersecting, setIsIntersecting] = React.useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry) {
        setIsIntersecting(entry.isIntersecting);
      }
    }, options);

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [ref, options]);

  return isIntersecting;
}

// Custom hook for virtual scrolling
export function useVirtualScroll<T>(
  items: T[],
  itemHeight: number,
  containerHeight: number,
  overscan: number = 3
) {
  const [scrollTop, setScrollTop] = React.useState(0);

  const visibleRange = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
      items.length - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );

    return {
      startIndex,
      endIndex,
      visibleItems: items.slice(startIndex, endIndex + 1),
      offsetY: startIndex * itemHeight,
      totalHeight: items.length * itemHeight,
    };
  }, [scrollTop, items, itemHeight, containerHeight, overscan]);

  const handleScroll = useCallback((_e: React.UIEvent<HTMLElement>) => {
    setScrollTop(_e.currentTarget.scrollTop);
  }, []);

  return {
    ...visibleRange,
    handleScroll,
  };
}

// Custom hook for memoized selectors (similar to reselect)
export function useSelector<_T, R>(
  source: _T,
  selector: (source: _T) => R,
  deps: DependencyList = []
): R {
  return useMemo(() => selector(source), [source, selector, ...deps]);
}

// Custom hook for preventing unnecessary re-renders
export function useWhyDidYouUpdate(name: string, props: Record<string, unknown>) {
  const previousProps = useRef<Record<string, unknown>>();

  useEffect(() => {
    if (previousProps.current) {
      const allKeys = Object.keys({ ...previousProps.current, ...props });
      const changedProps: Record<string, unknown> = {};

      allKeys.forEach(key => {
        if (previousProps.current![key] !== props[key]) {
          changedProps[key] = {
            from: previousProps.current![key],
            to: props[key],
          };
        }
      });

      if (Object.keys(changedProps).length) {
        if (process.env.NODE_ENV === 'development') {
          Logger.warn('[why-did-you-update]', name, changedProps);
        }
      }
    }

    previousProps.current = props;
  });
}

// Performance monitoring hook for React DevTools Profiler
export function usePerformanceProfiler(id: string, _phase: 'mount' | 'update' = 'update') {
  const [profileData, setProfileData] = React.useState<{
    id: string;
    phase: 'mount' | 'update' | 'nested-update';
    actualDuration: number;
    baseDuration: number;
    startTime: number;
    commitTime: number;
  } | null>(null);

  const onRender = React.useCallback(
    (
      id: string,
      phase: 'mount' | 'update' | 'nested-update',
      actualDuration: number,
      baseDuration: number,
      startTime: number,
      commitTime: number
    ) => {
      setProfileData({
        id,
        phase,
        actualDuration,
        baseDuration,
        startTime,
        commitTime,
      });

      // Log performance data in development
      if (process.env.NODE_ENV === 'development') {
        Logger.warn(`[Profiler] ${id}:`, {
          phase,
          actualDuration: `${actualDuration}ms`,
          baseDuration: `${baseDuration}ms`,
          efficiency: `${((baseDuration / actualDuration) * 100).toFixed(1)}%`,
        });
      }
    },
    []
  );

  const ProfilerWrapper: React.ComponentType<{ children: React.ReactNode }> = ({ children }) => (
    <React.Profiler id={id} onRender={onRender}>
      {children}
    </React.Profiler>
  );

  return { ProfilerWrapper, profileData };
}

// Hook for measuring component render time
export function useRenderTime(componentName: string) {
  const startTime = React.useRef<number>();
  const [renderTime, setRenderTime] = React.useState<number>(0);

  React.useLayoutEffect(() => {
    if (startTime.current) {
      const duration = performance.now() - startTime.current;
      setRenderTime(duration);

      if (process.env.NODE_ENV === 'development' && duration > 10) {
        Logger.warn(`[Performance] ${componentName} render took ${duration.toFixed(2)}ms`);
      }
    }
    startTime.current = performance.now();
  }, [componentName]);

  return renderTime;
}

// Hook for tracking component re-renders
export function useRenderCount(componentName: string) {
  const renderCount = React.useRef(0);
  const lastRenderTime = React.useRef(Date.now());

  React.useEffect(() => {
    renderCount.current += 1;
    const now = Date.now();
    const timeSinceLastRender = now - lastRenderTime.current;

    if (process.env.NODE_ENV === 'development') {
      Logger.warn(
        `[Renders] ${componentName}: ${renderCount.current} renders, ${timeSinceLastRender}ms since last`
      );
    }

    lastRenderTime.current = now;
  });

  return renderCount.current;
}

// Hook for memory usage monitoring
export function useMemoryUsage() {
  const [memoryInfo, setMemoryInfo] = React.useState<{
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
    usage: number;
  } | null>(null);

  React.useEffect(() => {
    const updateMemoryInfo = () => {
      interface MemoryInfo {
        usedJSHeapSize: number;
        totalJSHeapSize: number;
        jsHeapSizeLimit: number;
      }
      interface ExtendedPerformance extends Performance {
        memory?: MemoryInfo;
      }
      if ('memory' in performance && (performance as ExtendedPerformance).memory) {
        const memory = (performance as ExtendedPerformance).memory!;
        const usage = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;

        setMemoryInfo({
          usedJSHeapSize: memory.usedJSHeapSize,
          totalJSHeapSize: memory.totalJSHeapSize,
          jsHeapSizeLimit: memory.jsHeapSizeLimit,
          usage,
        });
      }
    };

    updateMemoryInfo();
    const interval = setInterval(updateMemoryInfo, 5000);

    return () => clearInterval(interval);
  }, []);

  return memoryInfo;
}
