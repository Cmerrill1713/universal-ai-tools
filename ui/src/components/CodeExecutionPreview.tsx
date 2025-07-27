import React, { useState, useEffect } from 'react'
import { api } from '../lib/api'

interface CodeExecutionPreviewProps {
  code?: string
  language?: 'javascript' | 'html' | 'react' | 'python'
  onClose?: () => void
}

export default function CodeExecutionPreview({ 
  code = '', 
  language = 'javascript',
  onClose 
}: CodeExecutionPreviewProps) {
  const [output, setOutput] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [isExecuting, setIsExecuting] = useState(false)
  const [previewHtml, setPreviewHtml] = useState<string>('')

  const executeCode = async () => {
    setIsExecuting(true)
    setError(null)
    
    try {
      // For HTML/React, render directly
      if (language === 'html') {
        setPreviewHtml(code)
      } else if (language === 'javascript') {
        // Create sandboxed iframe for JS execution
        const iframe = document.createElement('iframe')
        iframe.style.display = 'none'
        iframe.sandbox = 'allow-scripts'
        document.body.appendChild(iframe)
        
        // Capture console output
        const capturedOutput: string[] = []
        (iframe.contentWindow as any).console.log = (...args: any[]) => {
          capturedOutput.push(args.map(String).join(' '))
        }
        
        try {
          iframe.contentWindow!.eval(code)
          setOutput(capturedOutput.join('\n'))
        } catch (e: any) {
          setError(e.message)
        } finally {
          document.body.removeChild(iframe)
        }
      } else if (language === 'react') {
        // For React components, we'd need to compile JSX
        setOutput('React component preview (would need Babel/transpilation)')
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsExecuting(false)
    }
  }

  useEffect(() => {
    if (code) {
      executeCode()
    }
  }, [code])

  return (
    <div className="fixed top-20 right-4 w-96 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-700">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-semibold text-gray-300">Code Preview</span>
          <span className="text-xs px-2 py-1 bg-blue-900/50 text-blue-400 rounded">
            {language}
          </span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        )}
      </div>

      {/* Code Display */}
      <div className="p-3 border-b border-gray-700 max-h-48 overflow-auto">
        <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap">
          {code}
        </pre>
      </div>

      {/* Output/Preview */}
      <div className="p-3">
        {isExecuting ? (
          <div className="flex items-center space-x-2 text-gray-400">
            <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Executing...</span>
          </div>
        ) : error ? (
          <div className="text-red-400 text-sm">
            <span className="font-semibold">Error:</span> {error}
          </div>
        ) : language === 'html' && previewHtml ? (
          <div 
            className="bg-white rounded p-2 text-black"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        ) : output ? (
          <div className="bg-gray-800 rounded p-2">
            <pre className="text-xs text-green-400 font-mono">{output}</pre>
          </div>
        ) : (
          <div className="text-gray-500 text-sm">No output</div>
        )}
      </div>

      {/* Actions */}
      <div className="p-3 border-t border-gray-700 flex justify-end space-x-2">
        <button
          onClick={executeCode}
          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
        >
          Re-run
        </button>
        <button
          onClick={() => navigator.clipboard.writeText(code)}
          className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors"
        >
          Copy Code
        </button>
      </div>
    </div>
  )
}