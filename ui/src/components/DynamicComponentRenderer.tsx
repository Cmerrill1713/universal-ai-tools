import React, { useState, useEffect } from 'react'
import * as ReactDOM from 'react-dom/client'

interface DynamicComponentRendererProps {
  componentCode?: string
  componentType?: 'react' | 'html' | 'canvas'
  onClose?: () => void
}

export default function DynamicComponentRenderer({ 
  componentCode = '', 
  componentType = 'react',
  onClose 
}: DynamicComponentRendererProps) {
  const [error, setError] = useState<string | null>(null)
  const [isFloating, setIsFloating] = useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!componentCode || !containerRef.current) return

    try {
      setError(null)

      if (componentType === 'html') {
        // Render HTML directly
        containerRef.current.innerHTML = componentCode
      } else if (componentType === 'canvas') {
        // Create canvas element
        const canvas = document.createElement('canvas')
        canvas.width = 400
        canvas.height = 300
        containerRef.current.appendChild(canvas)
        
        // Execute canvas drawing code
        const ctx = canvas.getContext('2d')
        if (ctx) {
          // Create a function that has access to ctx
          const drawFunction = new Function('ctx', componentCode)
          drawFunction(ctx)
        }
      } else if (componentType === 'react') {
        // For React components, we'd need proper transpilation
        // For now, show a preview of what would be rendered
        containerRef.current.innerHTML = `
          <div class="p-4 bg-blue-900/20 border border-blue-800 rounded">
            <p class="text-blue-400 text-sm mb-2">React Component Preview:</p>
            <pre class="text-xs text-gray-300 overflow-auto">${componentCode}</pre>
          </div>
        `
      }
    } catch (err: any) {
      setError(err.message)
    }
  }, [componentCode, componentType])

  return (
    <div 
      className={`${
        isFloating 
          ? 'fixed top-1/4 left-1/4 z-50' 
          : 'relative'
      } bg-gray-900 border border-gray-700 rounded-lg shadow-xl transition-all`}
      style={{
        minWidth: '400px',
        minHeight: '300px'
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-700 cursor-move">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-semibold text-gray-300">Generated Component</span>
          <span className="text-xs px-2 py-1 bg-purple-900/50 text-purple-400 rounded">
            {componentType}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsFloating(!isFloating)}
            className="text-gray-400 hover:text-white transition-colors"
            title={isFloating ? 'Dock' : 'Float'}
          >
            {isFloating ? '📌' : '🔓'}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Render Area */}
      <div className="p-4">
        {error ? (
          <div className="text-red-400 text-sm">
            <span className="font-semibold">Error:</span> {error}
          </div>
        ) : (
          <div ref={containerRef} className="w-full h-full" />
        )}
      </div>

      {/* Actions */}
      <div className="p-3 border-t border-gray-700 flex justify-between">
        <button
          onClick={() => {
            const newWindow = window.open('', '_blank', 'width=600,height=400')
            if (newWindow && containerRef.current) {
              newWindow.document.write(`
                <html>
                  <head>
                    <title>Generated Component</title>
                    <style>
                      body { margin: 20px; font-family: Arial, sans-serif; }
                    </style>
                  </head>
                  <body>
                    ${containerRef.current.innerHTML}
                  </body>
                </html>
              `)
            }
          }}
          className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded transition-colors"
        >
          Open in New Window
        </button>
        <button
          onClick={() => {
            if (containerRef.current) {
              const content = containerRef.current.innerHTML
              navigator.clipboard.writeText(content)
            }
          }}
          className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors"
        >
          Copy Output
        </button>
      </div>
    </div>
  )
}