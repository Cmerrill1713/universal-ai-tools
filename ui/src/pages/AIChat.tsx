import { Send, Bot, User, Loader2, Settings2, RefreshCw, Trash2, Copy, AlertCircle, Check } from 'lucide-react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Select } from '../components/Select';
import { cn } from '../lib/utils';
import { useChat } from '../hooks/useChat';
import { useSystemStatus } from '../hooks/useSystemStatus';
import { useStore } from '../store';

interface OllamaModel {
  name: string;
  label: string;
}

export function AIChat() {
  const { globalError, clearGlobalError } = useStore();
  const { 
    isBackendConnected, 
    isOllamaConnected, 
    availableModels,
    isCheckingOllama
  } = useSystemStatus();
  
  const {
    messages,
    input,
    setInput,
    selectedModel,
    setSelectedModel,
    copySuccess,
    isLoading,
    isLoadingHistory,
    sendMessage,
    clearConversation,
    copyToClipboard,
    retryLastMessage,
    messagesEndRef,
    isSystemReady,
  } = useChat();

  // Get available models with proper formatting
  const modelOptions: OllamaModel[] = availableModels?.map((model: string) => ({
    name: model,
    label: model.charAt(0).toUpperCase() + model.slice(1),
  })) || [
    { name: 'llama3.2:1b', label: 'Llama 3.2 1B (Fast)' },
    { name: 'llama3.2:3b', label: 'Llama 3.2 3B (Balanced)' },
    { name: 'phi3:mini', label: 'Phi-3 Mini (Code)' },
    { name: 'mistral:7b', label: 'Mistral 7B (Quality)' },
    { name: 'codellama:7b', label: 'CodeLlama 7B (Code)' },
  ];

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    await sendMessage();
  };

  return (
    <div className="flex h-full gap-6">
      {/* 3D Avatar Area */}
      <div className="w-96 flex flex-col gap-4">
        <Card className="h-96 overflow-hidden">
          <div className="flex items-center justify-center h-full">
            <Bot className={cn(
              "w-24 h-24 text-muted-foreground",
              isLoading ? "animate-pulse text-blue-500" : "text-gray-600"
            )} />
          </div>
        </Card>
        <Card className="flex-1 p-4">
          <h3 className="font-semibold mb-4 text-cyan-400">Neural Network Status</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Model</span>
              <span className="text-cyan-400">{selectedModel}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Status</span>
              <span className={cn(
                "font-medium",
                isLoading ? "text-yellow-400" : "text-green-400"
              )}>
                {isLoading ? "Processing" : "Ready"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Backend</span>
              <span className={cn(
                "font-medium",
                isBackendConnected ? "text-green-400" : "text-red-400"
              )}>
                {isBackendConnected ? "Online" : "Offline"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Ollama</span>
              <span className={cn(
                "font-medium",
                isCheckingOllama ? "text-yellow-400" :
                isOllamaConnected ? "text-green-400" : "text-red-400"
              )}>
                {isCheckingOllama ? "Checking..." : 
                 isOllamaConnected ? "Online" : "Offline"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Models</span>
              <span className="text-cyan-400">{availableModels?.length || 0}</span>
            </div>
          </div>
        </Card>
      </div>
      
      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        <Card className="flex-1 flex flex-col">
          {/* Model Selector */}
          <div className="p-4 border-b border-gray-700 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Settings2 className="h-5 w-5 text-gray-400" />
              <Select
                value={selectedModel}
                onChange={setSelectedModel}
                options={modelOptions.map(model => ({
                  value: model.name,
                  label: model.label
                }))}
                className="w-64"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Button 
                variant="secondary" 
                size="sm"
                onClick={clearConversation}
                disabled={messages.length === 0}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button 
                variant="secondary" 
                size="sm"
                onClick={retryLastMessage}
                disabled={isLoading || !messages.length}
                title="Retry last message"
              >
                <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
              </Button>
              <div className={cn(
                "w-2 h-2 rounded-full",
                !isBackendConnected ? "bg-red-500" :
                isOllamaConnected ? "bg-green-500" : "bg-yellow-500"
              )} />
              <span className="text-sm text-gray-400">
                {!isBackendConnected ? 'Backend Error' :
                 isOllamaConnected ? 'Connected' : 'Ollama Offline'}
              </span>
            </div>
          </div>

          {/* Error Banner */}
          {globalError && (
            <div className={cn(
              "mx-4 mt-4 p-3 rounded-lg flex items-center space-x-2",
              globalError.type === 'error' ? "bg-red-900/50 border border-red-600" :
              globalError.type === 'warning' ? "bg-yellow-900/50 border border-yellow-600" :
              "bg-blue-900/50 border border-blue-600"
            )}>
              <AlertCircle className={cn(
                "h-5 w-5",
                globalError.type === 'error' ? "text-red-400" :
                globalError.type === 'warning' ? "text-yellow-400" :
                "text-blue-400"
              )} />
              <span className={cn(
                "text-sm",
                globalError.type === 'error' ? "text-red-200" :
                globalError.type === 'warning' ? "text-yellow-200" :
                "text-blue-200"
              )}>
                {globalError.message}
              </span>
              <button
                onClick={clearGlobalError}
                className={cn(
                  "ml-auto hover:opacity-75",
                  globalError.type === 'error' ? "text-red-400" :
                  globalError.type === 'warning' ? "text-yellow-400" :
                  "text-blue-400"
                )}
              >
                ×
              </button>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 mt-8">
                <Bot className="h-12 w-12 mx-auto mb-4 text-gray-600" />
                <p>Start a conversation with AI</p>
                <p className="text-sm mt-2">Select a model and type your message</p>
                {!isBackendConnected && (
                  <p className="text-sm mt-2 text-red-400">
                    Backend service is unavailable. Please check your connection.
                  </p>
                )}
                {!isOllamaConnected && isBackendConnected && (
                  <p className="text-sm mt-2 text-red-400">
                    Ollama is not available. Please make sure it's running.
                  </p>
                )}
                {isLoadingHistory && (
                  <p className="text-sm mt-2 text-blue-400">
                    Loading conversation history...
                  </p>
                )}
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex items-start space-x-3",
                    message.role === 'user' && "flex-row-reverse space-x-reverse"
                  )}
                >
                  <div className={cn(
                    "p-2 rounded-lg",
                    message.role === 'user' 
                      ? "bg-blue-600" 
                      : "bg-gray-700"
                  )}>
                    {message.role === 'user' ? (
                      <User className="h-5 w-5" />
                    ) : (
                      <Bot className="h-5 w-5" />
                    )}
                  </div>
                  <div className={cn(
                    "flex-1 p-4 rounded-lg relative group",
                    message.role === 'user'
                      ? "bg-blue-900/50 ml-12"
                      : "bg-gray-800 mr-12"
                  )}>
                    <div className="whitespace-pre-wrap">
                      {message.content.includes('```') ? (
                        // Basic code block detection
                        message.content.split('```').map((part, index) => (
                          index % 2 === 0 ? (
                            <span key={index}>{part}</span>
                          ) : (
                            <pre key={index} className="bg-gray-900 p-3 rounded mt-2 mb-2 overflow-x-auto">
                              <code className="text-sm font-mono text-green-400">{part}</code>
                            </pre>
                          )
                        ))
                      ) : (
                        <span>{message.content}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      {message.timestamp.toLocaleTimeString()}
                      {message.model && ` • ${message.model}`}
                    </p>
                    <button
                      onClick={() => copyToClipboard(message.content, message.id)}
                      className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-200 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Copy message"
                    >
                      {copySuccess === message.id ? (
                        <Check className="h-4 w-4 text-green-400" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              ))
            )}
            {isLoading && (
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-lg bg-gray-700">
                  <Bot className="h-5 w-5" />
                </div>
                <div className="flex-1 p-4 rounded-lg bg-gray-800 mr-12">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-gray-700">
            <div className="flex space-x-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={
                  !isSystemReady ? 
                  "System unavailable..." : 
                  "Type your message... (Press Enter to send)"
                }
                className={cn(
                  "flex-1 bg-gray-800 rounded-lg px-4 py-2 focus:outline-none focus:ring-2",
                  isSystemReady ? "focus:ring-blue-500" : "focus:ring-red-500"
                )}
                disabled={isLoading || !isSystemReady}
              />
              <Button
                onClick={handleSend}
                disabled={isLoading || !input.trim() || !isSystemReady}
                className="px-4"
                title={
                  !isSystemReady ? 
                  "System is unavailable" : 
                  isLoading ? "Sending message..." : "Send message"
                }
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </Button>
            </div>
            {input.length > 1000 && (
              <p className="text-xs text-yellow-400 mt-1">
                Message is quite long ({input.length} characters). Consider breaking it into smaller parts.
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}