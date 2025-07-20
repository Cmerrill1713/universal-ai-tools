import React, { useState, useCallback, useEffect } from 'react';
import { MessageSquare, Code, Eye, Download, Save, Share2 } from 'lucide-react';
import { LiveCodePreview } from './WidgetPreview/LiveCodePreview';
import { CodeEditor } from './WidgetPreview/CodeEditor';
import { WidgetSandbox } from './WidgetPreview/WidgetSandbox';
import { ExportManager } from './WidgetPreview/ExportManager';
import { SweetAthenaChat } from './SweetAthena/Chat/SweetAthenaChat';
import { useWebSocket } from '../hooks/useWebSocket';
import { api } from '../services/api';

interface WidgetMetadata {
  name: string;
  description: string;
  tags: string[];
  version: string;
  author?: string;
}

interface Widget {
  id?: string;
  metadata: WidgetMetadata;
  code: string;
  dependencies: Record<string, string>;
  props: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}

type ViewMode = 'split' | 'preview' | 'code' | 'chat';
type PreviewMode = 'live' | 'sandbox';

export const WidgetStudio: React.FC = () => {
  const [widget, setWidget] = useState<Widget>({
    metadata: {
      name: 'My Widget',
      description: 'A custom React widget',
      tags: ['react', 'component'],
      version: '1.0.0',
    },
    code: `// Your widget code will appear here
import React from 'react';

export const Widget: React.FC = () => {
  return (
    <div className="p-4 bg-blue-100 rounded-lg">
      <h2 className="text-xl font-bold text-blue-800">Hello Widget!</h2>
      <p className="text-blue-600">Start chatting with Athena to create your widget.</p>
    </div>
  );
};`,
    dependencies: {},
    props: {},
  });

  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [previewMode, setPreviewMode] = useState<PreviewMode>('live');
  const [showExport, setShowExport] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { sendMessage, lastMessage } = useWebSocket();

  // Handle messages from Athena that contain widget code
  useEffect(() => {
    if (lastMessage?.type === 'widget_code') {
      setWidget((prev) => ({
        ...prev,
        code: lastMessage.data.code,
        metadata: {
          ...prev.metadata,
          ...lastMessage.data.metadata,
        },
        dependencies: lastMessage.data.dependencies || {},
        props: lastMessage.data.props || {},
      }));
    }
  }, [lastMessage]);

  const handleCodeChange = (newCode: string) => {
    setWidget((prev) => ({ ...prev, code: newCode }));
  };

  const handleSaveWidget = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const response = await api.post('/api/widgets', widget);
      setWidget({ ...widget, id: response.data.id });
      // Show success toast
    } catch (err) {
      setError('Failed to save widget');
      console.error('Save error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleShareWidget = async () => {
    if (!widget.id) {
      await handleSaveWidget();
    }
    
    // Generate shareable link
    const shareUrl = `${window.location.origin}/widgets/${widget.id}`;
    await navigator.clipboard.writeText(shareUrl);
    // Show toast: "Widget link copied to clipboard!"
  };

  const handleChatMessage = (message: string) => {
    // Send message to backend with widget context
    sendMessage({
      type: 'widget_request',
      content: message,
      context: {
        currentCode: widget.code,
        metadata: widget.metadata,
      },
    });
  };

  const renderViewModeButton = (mode: ViewMode, icon: React.ReactNode, label: string) => (
    <button
      onClick={() => setViewMode(mode)}
      className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${
        viewMode === mode
          ? 'bg-blue-100 text-blue-700'
          : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </button>
  );

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Widget Studio</h1>
            <p className="text-sm text-gray-500 mt-1">
              Create beautiful React widgets with AI assistance
            </p>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* View mode toggles */}
            <div className="flex items-center space-x-2 bg-gray-100 p-1 rounded-lg">
              {renderViewModeButton('chat', <MessageSquare className="w-4 h-4" />, 'Chat')}
              {renderViewModeButton('split', <Eye className="w-4 h-4" />, 'Split')}
              {renderViewModeButton('code', <Code className="w-4 h-4" />, 'Code')}
              {renderViewModeButton('preview', <Eye className="w-4 h-4" />, 'Preview')}
            </div>

            {/* Action buttons */}
            <div className="flex items-center space-x-2">
              <button
                onClick={handleSaveWidget}
                disabled={isSaving}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Saving...' : 'Save'}</span>
              </button>
              
              <button
                onClick={handleShareWidget}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                <Share2 className="w-4 h-4" />
                <span>Share</span>
              </button>
              
              <button
                onClick={() => setShowExport(!showExport)}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Export</span>
              </button>
            </div>
          </div>
        </div>

        {/* Widget metadata */}
        <div className="mt-4 flex items-center space-x-6 text-sm">
          <input
            type="text"
            value={widget.metadata.name}
            onChange={(e) =>
              setWidget((prev) => ({
                ...prev,
                metadata: { ...prev.metadata, name: e.target.value },
              }))
            }
            className="font-medium text-gray-900 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none px-1"
          />
          <input
            type="text"
            value={widget.metadata.description}
            onChange={(e) =>
              setWidget((prev) => ({
                ...prev,
                metadata: { ...prev.metadata, description: e.target.value },
              }))
            }
            className="text-gray-500 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-gray-500 focus:outline-none px-1 flex-1"
            placeholder="Add a description..."
          />
          <span className="text-gray-400">v{widget.metadata.version}</span>
        </div>
      </header>

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat panel */}
        {(viewMode === 'chat' || viewMode === 'split') && (
          <div className={`${viewMode === 'split' ? 'w-1/3' : 'w-full'} border-r bg-white`}>
            <SweetAthenaChat
              onSendMessage={handleChatMessage}
              systemPrompt="You are a widget creation assistant. Help the user create React components and widgets. When the user describes a widget, generate the complete React code and send it back with type 'widget_code'."
              className="h-full"
            />
          </div>
        )}

        {/* Code editor */}
        {(viewMode === 'code' || viewMode === 'split') && (
          <div className={`${viewMode === 'split' ? 'w-1/3' : 'w-full'} border-r`}>
            <CodeEditor
              code={widget.code}
              onChange={handleCodeChange}
              language="typescript"
              theme="light"
              className="h-full"
            />
          </div>
        )}

        {/* Preview panel */}
        {(viewMode === 'preview' || viewMode === 'split') && (
          <div className={`${viewMode === 'split' ? 'w-1/3' : 'w-full'} bg-white`}>
            <div className="h-full flex flex-col">
              {/* Preview mode toggle */}
              <div className="flex items-center justify-center space-x-2 p-2 bg-gray-100 border-b">
                <button
                  onClick={() => setPreviewMode('live')}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    previewMode === 'live'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Live Preview
                </button>
                <button
                  onClick={() => setPreviewMode('sandbox')}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    previewMode === 'sandbox'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Sandbox
                </button>
              </div>

              {/* Preview content */}
              <div className="flex-1">
                {previewMode === 'live' ? (
                  <LiveCodePreview
                    code={widget.code}
                    dependencies={widget.dependencies}
                    onError={(err) => setError(err.message)}
                  />
                ) : (
                  <WidgetSandbox
                    code={widget.code}
                    props={widget.props}
                    dependencies={widget.dependencies}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Export panel */}
        {showExport && (
          <div className="w-96 bg-white border-l shadow-lg">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold">Export Options</h3>
              <button
                onClick={() => setShowExport(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            <ExportManager
              code={widget.code}
              widgetName={widget.metadata.name}
              description={widget.metadata.description}
              dependencies={widget.dependencies}
            />
          </div>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div className="absolute bottom-4 right-4 max-w-md p-4 bg-red-50 border border-red-200 rounded-lg shadow-lg">
          <p className="text-sm text-red-700">{error}</p>
          <button
            onClick={() => setError(null)}
            className="mt-2 text-xs text-red-600 hover:text-red-500 underline"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
};