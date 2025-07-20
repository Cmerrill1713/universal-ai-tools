import React, { useEffect, useRef, useState } from 'react';
import { Play, RefreshCw, Settings } from 'lucide-react';

interface WidgetSandboxProps {
  code: string;
  props?: Record<string, any>;
  dependencies?: Record<string, string>;
  className?: string;
}

interface PropEditor {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  value: any;
}

export const WidgetSandbox: React.FC<WidgetSandboxProps> = ({
  code,
  props = {},
  dependencies = {},
  className = '',
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showPropsEditor, setShowPropsEditor] = useState(false);
  const [editableProps, setEditableProps] = useState<PropEditor[]>([]);

  useEffect(() => {
    // Initialize props editor
    const propEditors: PropEditor[] = Object.entries(props).map(([name, value]) => ({
      name,
      type: Array.isArray(value) ? 'array' : typeof value as any,
      value,
    }));
    setEditableProps(propEditors);
  }, [props]);

  const createSandboxHTML = () => {
    const dependencyScripts = Object.entries(dependencies)
      .map(([name, url]) => `<script src="${url}"></script>`)
      .join('\n');

    const propsString = JSON.stringify(
      editableProps.reduce((acc, prop) => {
        acc[prop.name] = prop.value;
        return acc;
      }, {} as Record<string, any>)
    );

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
          <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
          <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
          ${dependencyScripts}
          <style>
            body {
              margin: 0;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
                'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
                sans-serif;
              -webkit-font-smoothing: antialiased;
              -moz-osx-font-smoothing: grayscale;
            }
            #root {
              padding: 20px;
            }
            .error {
              color: #dc2626;
              background: #fee;
              padding: 12px;
              border-radius: 4px;
              margin: 12px;
              font-family: monospace;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <div id="root"></div>
          <script type="text/babel">
            try {
              ${code}
              
              // Get the component (try different export patterns)
              let Component;
              if (typeof exports !== 'undefined' && exports.default) {
                Component = exports.default;
              } else if (typeof Widget !== 'undefined') {
                Component = Widget;
              } else {
                // Find first capitalized function
                const componentName = Object.keys(window).find(key => 
                  key[0] === key[0].toUpperCase() && 
                  typeof window[key] === 'function'
                );
                if (componentName) {
                  Component = window[componentName];
                }
              }
              
              if (Component) {
                const props = ${propsString};
                const root = ReactDOM.createRoot(document.getElementById('root'));
                root.render(React.createElement(Component, props));
              } else {
                throw new Error('No React component found');
              }
            } catch (error) {
              document.getElementById('root').innerHTML = 
                '<div class="error">Error: ' + error.message + '</div>';
              window.parent.postMessage({ type: 'error', message: error.message }, '*');
            }
            
            // Signal that loading is complete
            window.parent.postMessage({ type: 'ready' }, '*');
          </script>
        </body>
      </html>
    `;
  };

  const runCode = () => {
    setIsLoading(true);
    setError(null);
    
    if (iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(createSandboxHTML());
        doc.close();
      }
    }
  };

  useEffect(() => {
    runCode();
  }, [code, editableProps]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'error') {
        setError(event.data.message);
        setIsLoading(false);
      } else if (event.data.type === 'ready') {
        setIsLoading(false);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const updateProp = (index: number, value: any) => {
    const newProps = [...editableProps];
    newProps[index].value = value;
    setEditableProps(newProps);
  };

  const renderPropEditor = (prop: PropEditor, index: number) => {
    switch (prop.type) {
      case 'string':
        return (
          <input
            type="text"
            value={prop.value}
            onChange={(e) => updateProp(index, e.target.value)}
            className="w-full px-2 py-1 text-sm border rounded"
          />
        );
      case 'number':
        return (
          <input
            type="number"
            value={prop.value}
            onChange={(e) => updateProp(index, parseFloat(e.target.value) || 0)}
            className="w-full px-2 py-1 text-sm border rounded"
          />
        );
      case 'boolean':
        return (
          <input
            type="checkbox"
            checked={prop.value}
            onChange={(e) => updateProp(index, e.target.checked)}
            className="w-4 h-4"
          />
        );
      case 'object':
      case 'array':
        return (
          <textarea
            value={JSON.stringify(prop.value, null, 2)}
            onChange={(e) => {
              try {
                updateProp(index, JSON.parse(e.target.value));
              } catch {}
            }}
            className="w-full px-2 py-1 text-sm font-mono border rounded"
            rows={3}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-100 border-b">
        <div className="flex items-center space-x-2">
          <button
            onClick={runCode}
            className="flex items-center space-x-2 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            <Play className="w-4 h-4" />
            <span className="text-sm">Run</span>
          </button>
          <button
            onClick={() => setShowPropsEditor(!showPropsEditor)}
            className="flex items-center space-x-2 px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
          >
            <Settings className="w-4 h-4" />
            <span className="text-sm">Props</span>
          </button>
        </div>
        {isLoading && (
          <RefreshCw className="w-4 h-4 text-gray-500 animate-spin" />
        )}
      </div>

      {/* Props Editor */}
      {showPropsEditor && editableProps.length > 0 && (
        <div className="px-4 py-3 bg-gray-50 border-b">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Component Props</h4>
          <div className="space-y-2">
            {editableProps.map((prop, index) => (
              <div key={prop.name} className="flex items-start space-x-2">
                <label className="text-sm text-gray-600 min-w-[100px] pt-1">
                  {prop.name}:
                </label>
                <div className="flex-1">
                  {renderPropEditor(prop, index)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sandbox iframe */}
      <div className="flex-1 relative">
        {error && (
          <div className="absolute inset-x-0 top-0 z-10 m-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
        <iframe
          ref={iframeRef}
          className="w-full h-full border-0"
          sandbox="allow-scripts allow-same-origin"
          title="Widget Preview"
        />
      </div>
    </div>
  );
};