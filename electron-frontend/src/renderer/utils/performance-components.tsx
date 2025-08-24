import React from 'react';
import { Suspense, lazy, ComponentType } from 'react';
import { ErrorBoundary } from 'react-error-boundary';

// Virtual list item renderer for large lists
export interface VirtualListItem {
  index: number;
  style: React.CSSProperties;
  data: unknown;
}

export function createVirtualListRenderer<T>(
  itemHeight: number,
  renderItem: (item: T, index: number) => React.ReactNode
) {
  const VirtualListRenderer = ({ index, style, data }: VirtualListItem) => {
    return <div style={style}>{renderItem(data[index], index)}</div>;
  };
  VirtualListRenderer.displayName = 'VirtualListRenderer';
  return VirtualListRenderer;
}

// Lazy loading HOC with _error boundary
export function withLazyLoading<P extends object>(
  importFunc: () => Promise<{ default: ComponentType<P> }>,
  fallback?: React.ComponentType,
  errorFallback?: React.ComponentType<{ error: Error; resetErrorBoundary: () => void }>
) {
  const LazyComponent = lazy(importFunc);
  const DefaultFallback =
    fallback ||
    (() => (
      <div className='flex items-center justify-center p-8'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-white'></div>
      </div>
    ));

  const DefaultErrorFallback =
    errorFallback ||
    (({ error, resetErrorBoundary }) => (
      <div className='glass-card p-6 rounded-xl border border-red-500/20'>
        <h3 className='text-red-400 font-semibold mb-2'>Component Error</h3>
        <p className='text-white/70 text-sm mb-4'>{error.message}</p>
        <button
          onClick={resetErrorBoundary}
          className='px-4 py-2 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600 transition-colors'
        >
          Try again
        </button>
      </div>
    ));

  const WrappedComponent = React.forwardRef<unknown, P>((props, ref) => (
    <ErrorBoundary FallbackComponent={DefaultErrorFallback}>
      <Suspense fallback={<DefaultFallback />}>
        <LazyComponent {...props} ref={ref} />
      </Suspense>
    </ErrorBoundary>
  ));

  WrappedComponent.displayName = `withLazyLoading(${(importFunc as any).name || 'Component'})`;

  return WrappedComponent;
}

// Performance-optimized image component
interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  placeholder?: string;
  loading?: 'lazy' | 'eager';
  onLoad?: () => void;
  onError?: () => void;
}

export const OptimizedImage = React.memo<OptimizedImageProps>(
  ({ src, alt, className = '', placeholder, loading = 'lazy', onLoad, onError }) => {
    const [imageLoaded, setImageLoaded] = React.useState(false);
    const [imageError, setImageError] = React.useState(false);
    const imgRef = React.useRef<HTMLImageElement>(null);

    const handleLoad = React.useCallback(() => {
      setImageLoaded(true);
      onLoad?.();
    }, [onLoad]);

    const handleError = React.useCallback(() => {
      setImageError(true);
      onError?.();
    }, [onError]);

    React.useEffect(() => {
      const img = imgRef.current;
      if (!img) return;

      if (img.complete) {
        handleLoad();
      }
    }, [handleLoad]);

    if (imageError) {
      return (
        <div className={`bg-gray-200 flex items-center justify-center ${className}`}>
          <span className='text-gray-500 text-sm'>Failed to load</span>
        </div>
      );
    }

    return (
      <div className={`relative ${className}`}>
        {placeholder && !imageLoaded && (
          <div className='absolute inset-0 bg-gray-200 animate-pulse rounded' />
        )}
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          loading={loading}
          onLoad={handleLoad}
          onError={handleError}
          className={`${imageLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300 ${className}`}
          style={{
            objectFit: 'cover',
            width: '100%',
            height: '100%',
          }}
        />
      </div>
    );
  }
);

OptimizedImage.displayName = 'OptimizedImage';

// Code splitting utilities
export const LazyDashboard = withLazyLoading(() => import('../pages/Dashboard'));
export const LazyChat = withLazyLoading(() => import('../pages/Chat'));
export const LazySettings = withLazyLoading(() => import('../pages/Settings'));
export const LazyServices = withLazyLoading(() => import('../pages/Services'));
export const LazyImageGeneration = withLazyLoading(() => import('../pages/ImageGeneration'));
