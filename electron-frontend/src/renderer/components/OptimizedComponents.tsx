import React from 'react';
import { memo, useMemo, useCallback, useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { shallowEqual } from '../utils/performance';
import { useDebouncedValue, useIntersectionObserver } from '../hooks/useOptimization';

// Optimized Card Component with memo
interface CardProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  className?: string;
  children?: React.ReactNode;
}

export const OptimizedCard = memo<CardProps>(
  ({ title, description, icon, onClick, className = '', children }) => {
    const handleClick = useCallback(() => {
      onClick?.();
    }, [onClick]);

    return (
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleClick}
        className={`glass-card p-6 rounded-xl cursor-pointer ${className}`}
      >
        {icon && <div className='mb-4'>{icon}</div>}
        <h3 className='text-lg font-semibold mb-2 text-foreground'>{title}</h3>
        {description && <p className='text-sm text-muted'>{description}</p>}
        {children}
      </motion.div>
    );
  },
  shallowEqual // Use shallow comparison for props
);

OptimizedCard.displayName = 'OptimizedCard';

// Optimized List Component with virtualization
interface ListItem {
  id: string;
  title: string;
  subtitle?: string;
  avatar?: string;
}

interface OptimizedListProps {
  items: ListItem[];
  onItemClick?: (item: ListItem) => void;
  className?: string;
}

export const OptimizedList = memo<OptimizedListProps>(({ items, onItemClick, className = '' }) => {
  const handleItemClick = useCallback(
    (item: ListItem) => {
      onItemClick?.(item);
    },
    [onItemClick]
  );

  // Memoize the list items
  const listItems = useMemo(
    () =>
      items.map(item => (
        <OptimizedListItem key={item.id} item={item} onClick={() => handleItemClick(item)} />
      )),
    [items, handleItemClick]
  );

  return <div className={`space-y-2 ${className}`}>{listItems}</div>;
});

OptimizedList.displayName = 'OptimizedList';

// Optimized List Item with lazy loading
interface OptimizedListItemProps {
  item: ListItem;
  onClick: () => void;
}

const OptimizedListItem = memo<OptimizedListItemProps>(
  ({ item, onClick }) => {
    const ref = React.useRef<HTMLDivElement>(null);
    const isVisible = useIntersectionObserver(ref, {
      threshold: 0.1,
      rootMargin: '50px',
    });

    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 20 }}
        animate={isVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.3 }}
        whileHover={{ x: 4 }}
        onClick={onClick}
        className='glass-card p-4 rounded-lg cursor-pointer flex items-center gap-4'
      >
        {item.avatar && (
          <LazyImage src={item.avatar} alt={item.title} className='w-10 h-10 rounded-full' />
        )}
        <div className='flex-1'>
          <h4 className='font-medium text-foreground'>{item.title}</h4>
          {item.subtitle && <p className='text-sm text-muted'>{item.subtitle}</p>}
        </div>
      </motion.div>
    );
  },
  (prevProps, nextProps) =>
    prevProps.item.id === nextProps.item.id &&
    prevProps.item.title === nextProps.item.title &&
    prevProps.item.subtitle === nextProps.item.subtitle
);

OptimizedListItem.displayName = 'OptimizedListItem';

// Lazy loading image component
interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  placeholder?: string;
}

export const LazyImage = memo<LazyImageProps>(({ src, alt, className = '', placeholder }) => {
  const ref = React.useRef<HTMLDivElement>(null);
  const isVisible = useIntersectionObserver(ref, {
    threshold: 0.1,
    rootMargin: '50px',
  });
  const [loaded, setLoaded] = React.useState(false);
  const [imageSrc, setImageSrc] = React.useState(placeholder || '');

  React.useEffect(() => {
    if (isVisible && !loaded) {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        setImageSrc(src);
        setLoaded(true);
      };
    }
  }, [isVisible, src, loaded]);

  return (
    <div ref={ref} className={`relative ${className}`}>
      {imageSrc ? (
        <motion.img
          initial={{ opacity: 0 }}
          animate={{ opacity: loaded ? 1 : 0.5 }}
          transition={{ duration: 0.3 }}
          src={imageSrc}
          alt={alt}
          className='w-full h-full object-cover'
        />
      ) : (
        <div className='w-full h-full bg-muted animate-pulse' />
      )}
    </div>
  );
});

LazyImage.displayName = 'LazyImage';

// Optimized Search Input with debouncing
interface OptimizedSearchProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  className?: string;
}

export const OptimizedSearch = memo<OptimizedSearchProps>(
  ({ onSearch, placeholder = 'Search...', className = '' }) => {
    const [value, setValue] = React.useState('');
    const debouncedValue = useDebouncedValue(value, 300);

    React.useEffect(() => {
      if (debouncedValue) {
        onSearch(debouncedValue);
      }
    }, [debouncedValue, onSearch]);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
      setValue(e.target.value);
    }, []);

    const handleClear = useCallback(() => {
      setValue('');
      onSearch('');
    }, [onSearch]);

    return (
      <div className={`relative ${className}`}>
        <input
          type='text'
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          className='w-full px-4 py-2 pl-10 pr-10 glass-card rounded-lg text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary'
        />
        <svg
          className='absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted'
          fill='none'
          stroke='currentColor'
          viewBox='0 0 24 24'
        >
          <path
            strokeLinecap='round'
            strokeLinejoin='round'
            strokeWidth={2}
            d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'
          />
        </svg>
        {value && (
          <button
            onClick={handleClear}
            className='absolute right-3 top-1/2 transform -translate-y-1/2 text-muted hover:text-foreground'
          >
            <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M6 18L18 6M6 6l12 12'
              />
            </svg>
          </button>
        )}
      </div>
    );
  }
);

OptimizedSearch.displayName = 'OptimizedSearch';

// Optimized Tab Component
interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface OptimizedTabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
}

export const OptimizedTabs = memo<OptimizedTabsProps>(
  ({ tabs, activeTab, onTabChange, className = '' }) => {
    const tabElements = useMemo(
      () =>
        tabs.map(tab => (
          <motion.button
            key={tab.id}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onTabChange(tab.id)}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
              activeTab === tab.id
                ? 'bg-primary text-primary-foreground'
                : 'text-muted hover:text-foreground'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </motion.button>
        )),
      [tabs, activeTab, onTabChange]
    );

    return <div className={`flex gap-2 ${className}`}>{tabElements}</div>;
  },
  (prevProps, nextProps) =>
    prevProps.activeTab === nextProps.activeTab &&
    prevProps.tabs.length === nextProps.tabs.length &&
    prevProps.tabs.every((tab, i) => tab.id === nextProps.tabs[i]?.id)
);

OptimizedTabs.displayName = 'OptimizedTabs';

// Performance Dashboard Component
interface PerformanceMonitorProps {
  className?: string;
  showDetails?: boolean;
}

export const PerformanceMonitor = memo<PerformanceMonitorProps>(
  ({ className = '', showDetails = false }) => {
    const [performanceData, setPerformanceData] = useState({
      renderCount: 0,
      lastRenderTime: 0,
      memoryUsage: 0,
      fps: 0,
    });

    const frameCount = useRef(0);
    const lastTime = useRef(performance.now());

    useEffect(() => {
      const updatePerformanceData = () => {
        const now = performance.now();
        frameCount.current++;

        // Calculate FPS every second
        if (now - lastTime.current >= 1000) {
          const fps = Math.round((frameCount.current * 1000) / (now - lastTime.current));

          setPerformanceData(prev => ({
            ...prev,
            fps,
            lastRenderTime: now,
            renderCount: prev.renderCount + 1,
          }));

          frameCount.current = 0;
          lastTime.current = now;
        }

        requestAnimationFrame(updatePerformanceData);
      };

      const rafId = requestAnimationFrame(updatePerformanceData);

      // Memory monitoring
      const memoryInterval = setInterval(() => {
        interface PerformanceMemory {
          usedJSHeapSize: number;
          totalJSHeapSize: number;
          jsHeapSizeLimit: number;
        }
        interface ExtendedPerformance extends Performance {
          memory?: PerformanceMemory;
        }
        if ('memory' in performance && (performance as ExtendedPerformance).memory) {
          const memory = (performance as ExtendedPerformance).memory!;
          const usage = (memory.usedJSHeapSize / (1024 * 1024)).toFixed(1); // MB
          setPerformanceData(prev => ({
            ...prev,
            memoryUsage: parseFloat(usage),
          }));
        }
      }, 2000);

      return () => {
        cancelAnimationFrame(rafId);
        clearInterval(memoryInterval);
      };
    }, []);

    if (!showDetails && process.env.NODE_ENV !== 'development') {
      return null;
    }

    return (
      <div className={`fixed bottom-4 right-4 z-50 ${className}`}>
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className='glass-card p-3 rounded-lg text-xs font-mono'
        >
          <div className='flex items-center gap-4'>
            <div className='flex items-center gap-1'>
              <div className='w-2 h-2 bg-green-400 rounded-full animate-pulse'></div>
              <span className='text-white/80'>{performanceData.fps} FPS</span>
            </div>

            <div className='flex items-center gap-1'>
              <div
                className={`w-2 h-2 rounded-full ${
                  performanceData.memoryUsage < 50
                    ? 'bg-green-400'
                    : performanceData.memoryUsage < 100
                      ? 'bg-yellow-400'
                      : 'bg-red-400'
                }`}
              ></div>
              <span className='text-white/80'>{performanceData.memoryUsage}MB</span>
            </div>

            {showDetails && <div className='text-white/60'>R: {performanceData.renderCount}</div>}
          </div>

          {showDetails && (
            <div className='mt-2 pt-2 border-t border-white/10 text-white/60'>
              <div>Last render: {performanceData.lastRenderTime.toFixed(0)}ms</div>
            </div>
          )}
        </motion.div>
      </div>
    );
  }
);

PerformanceMonitor.displayName = 'PerformanceMonitor';
