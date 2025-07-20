import React, { useEffect, useRef, useState, useMemo } from 'react';
import { transform } from '@babel/standalone';
import { ErrorBoundary } from 'react-error-boundary';
import { AlertCircle, Monitor, Tablet, Smartphone } from 'lucide-react';

interface LiveCodePreviewProps {
  code: string;
  dependencies?: Record<string, any>;
  className?: string;
  onError?: (error: Error) => void;
}

type DeviceType = 'desktop' | 'tablet' | 'mobile';

const deviceSizes: Record<DeviceType, { width: string; height: string }> = {
  desktop: { width: '100%', height: '100%' },
  tablet: { width: '768px', height: '1024px' },
  mobile: { width: '375px', height: '667px' },
};

function ErrorFallback({ error, resetErrorBoundary }: any) {
  return (
    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
      <div className="flex items-start space-x-3">
        <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
        <div className="flex-1">
          <h3 className="text-sm font-medium text-red-800">Preview Error</h3>
          <pre className="mt-2 text-xs text-red-700 whitespace-pre-wrap">
            {error.message}
          </pre>
          <button
            onClick={resetErrorBoundary}
            className="mt-3 text-sm text-red-600 hover:text-red-500 underline"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}

export const LiveCodePreview: React.FC<LiveCodePreviewProps> = ({
  code,
  dependencies = {},
  className = '',
  onError,
}) => {
  const [Component, setComponent] = useState<React.ComponentType | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [device, setDevice] = useState<DeviceType>('desktop');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Add default dependencies
  const allDependencies = useMemo(() => ({
    React,
    ...dependencies,
  }), [dependencies]);

  useEffect(() => {
    try {
      // Reset error state
      setError(null);

      // Transform the code
      const transformedCode = transform(code, {
        presets: ['react', 'typescript'],
        filename: 'widget.tsx',
      }).code;

      // Create a function that returns the component
      const createComponent = new Function(
        ...Object.keys(allDependencies),
        `
        ${transformedCode}
        
        // Try to find the default export or the first component
        if (typeof exports !== 'undefined' && exports.default) {
          return exports.default;
        } else if (typeof Widget !== 'undefined') {
          return Widget;
        } else {
          // Try to find any function that looks like a React component
          const componentNames = Object.keys(window).filter(key => 
            key[0] === key[0].toUpperCase() && 
            typeof window[key] === 'function'
          );
          if (componentNames.length > 0) {
            return window[componentNames[0]];
          }
          throw new Error('No React component found in the code');
        }
        `
      );

      // Execute the function with dependencies
      const NewComponent = createComponent(...Object.values(allDependencies));
      setComponent(() => NewComponent);
    } catch (err) {
      const error = err as Error;
      setError(error);
      onError?.(error);
    }
  }, [code, allDependencies, onError]);

  const deviceIcons = {
    desktop: Monitor,
    tablet: Tablet,
    mobile: Smartphone,
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Device selector */}
      <div className="flex items-center space-x-2 p-2 bg-gray-100 border-b">
        {(Object.keys(deviceSizes) as DeviceType[]).map((deviceType) => {
          const Icon = deviceIcons[deviceType];
          return (
            <button
              key={deviceType}
              onClick={() => setDevice(deviceType)}
              className={`p-2 rounded transition-colors ${
                device === deviceType
                  ? 'bg-blue-500 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-200'
              }`}
              title={deviceType}
            >
              <Icon className="w-4 h-4" />
            </button>
          );
        })}
        <span className="text-sm text-gray-500 ml-4">
          {device === 'desktop' ? 'Full Width' : deviceSizes[device].width} ×{' '}
          {device === 'desktop' ? 'Full Height' : deviceSizes[device].height}
        </span>
      </div>

      {/* Preview area */}
      <div className="flex-1 bg-gray-50 p-4 overflow-auto">
        <div
          className={`bg-white rounded-lg shadow-lg mx-auto transition-all ${
            device !== 'desktop' ? 'border-2 border-gray-300' : ''
          }`}
          style={{
            width: deviceSizes[device].width,
            height: device === 'desktop' ? '100%' : deviceSizes[device].height,
            maxWidth: '100%',
          }}
        >
          <ErrorBoundary
            FallbackComponent={ErrorFallback}
            resetKeys={[code]}
            onError={onError}
          >
            {error ? (
              <ErrorFallback error={error} resetErrorBoundary={() => setError(null)} />
            ) : Component ? (
              <div className="h-full overflow-auto p-4">
                <Component />
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                <p>Loading preview...</p>
              </div>
            )}
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
};