import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, Settings2, RefreshCw, Trash2, Copy, AlertCircle, Check } from 'lucide-react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Select } from '../components/Select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cn } from '../lib/utils';
import { chatApi, systemApi, ChatMessage } from '../lib/api';

interface OllamaModel {
  name: string;
  label: string;
}

export function AIChat() {
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState('llama3.2:3b');
  const [conversationId] = useState(() => `chat-${Date.now()}`);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Check Ollama status and get available models
  const { data: ollamaStatus, isLoading: statusLoading, error: statusError } = useQuery({
    queryKey: ['ollama-status'],
    queryFn: async () => {
      try {
        return await systemApi.getOllamaStatus();
      } catch (error) {
        console.error('Failed to fetch Ollama status:', error);
        throw new Error('Failed to connect to Ollama service');
      }
    },
    refetchInterval: 30000, // Refetch every 30 seconds
    retry: 3,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Load conversation history on mount
  const { data: conversationHistory, isLoading: historyLoading, error: historyError } = useQuery({
    queryKey: ['conversation-history', conversationId],
    queryFn: async () => {
      try {
        return await chatApi.getConversationHistory(conversationId, 50);
      } catch (error) {
        console.error('Failed to fetch conversation history:', error);
        // Return empty array if conversation doesn't exist yet
        return [];
      }
    },
    enabled: !!conversationId,
    retry: 1, // Only retry once for history
  });

  // Chat mutation
  const chatMutation = useMutation({
    mutationFn: async ({ message, model }: { message: string; model: string }) => {
      try {
        setError(null); // Clear any previous errors
        return await chatApi.sendMessage(message, model, conversationId);
      } catch (error: any) {
        console.error('Chat error:', error);
        const errorMessage = error.response?.data?.error || error.message || 'Failed to send message';
        throw new Error(errorMessage);
      }
    },
    onSuccess: (data) => {
      const assistantMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date(data.timestamp),
        model: data.model,
      };
      setMessages(prev => [...prev, assistantMessage]);
      
      // Refresh conversation history
      queryClient.invalidateQueries({ queryKey: ['conversation-history', conversationId] });
    },
    onError: (error: Error) => {
      setError(error.message);
      
      // Add error message to chat
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `❌ Error: ${error.message}`,
        timestamp: new Date(),
        model: selectedModel,
      };
      setMessages(prev => [...prev, errorMessage]);
    },
  });

  // Get available models from Ollama status
  const availableModels: OllamaModel[] = ollamaStatus?.models?.map((model: string) => ({
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
    if (!input.trim() || chatMutation.isPending) return;

    // Check if Ollama is available
    if (ollamaStatus?.status !== 'available') {
      setError('Ollama service is not available. Please ensure it is running and try again.');
      return;
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = input.trim();
    setInput('');
    setError(null); // Clear any previous errors

    // Send message to AI
    chatMutation.mutate({
      message: currentInput,
      model: selectedModel,
    });
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Set initial model from available models
  useEffect(() => {
    if (availableModels.length > 0 && !availableModels.find(m => m.name === selectedModel)) {
      setSelectedModel(availableModels[0].name);
    }
  }, [availableModels, selectedModel]);

  // Load conversation history when available
  useEffect(() => {
    if (conversationHistory && Array.isArray(conversationHistory)) {
      // Convert timestamps to Date objects
      const formattedMessages = conversationHistory.map(msg => ({
        ...msg,
        timestamp: new Date(msg.timestamp),
      }));
      setMessages(formattedMessages);
    }
  }, [conversationHistory]);

  const clearConversation = () => {
    setMessages([]);
    setError(null);
    // Invalidate conversation history to ensure it's refreshed
    queryClient.invalidateQueries({ queryKey: ['conversation-history', conversationId] });
  };

  const copyToClipboard = async (text: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(messageId);
      setTimeout(() => setCopySuccess(null), 2000); // Clear success indicator after 2 seconds
    } catch (err) {
      console.error('Failed to copy text: ', err);
      setError('Failed to copy text to clipboard');
    }
  };

  // Clear error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  return (
    <div className="flex h-full gap-6">
      {/* 3D Avatar Area */}
      <div className="w-96 flex flex-col gap-4">
        <Card className="h-96 overflow-hidden">
          <div className="flex items-center justify-center h-full">
            <Bot className={cn(
              "w-24 h-24 text-muted-foreground",
              chatMutation.isPending ? "animate-pulse text-blue-500" : "text-gray-600"
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
                chatMutation.isPending ? "text-yellow-400" : "text-green-400"
              )}>
                {chatMutation.isPending ? "Processing" : "Ready"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Ollama</span>
              <span className={cn(
                "font-medium",
                statusError ? "text-red-400" : 
                ollamaStatus?.status === 'available' ? "text-green-400" : "text-yellow-400"
              )}>
                {statusLoading ? "Checking..." : 
                 statusError ? "Error" :
                 ollamaStatus?.status === 'available' ? "Online" : "Offline"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Models</span>
              <span className="text-cyan-400">{ollamaStatus?.models?.length || 0}</span>
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
                options={availableModels.map(model => ({
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
                onClick={() => queryClient.invalidateQueries({ queryKey: ['ollama-status'] })}
                disabled={statusLoading}
              >
                <RefreshCw className={cn("h-4 w-4", statusLoading && "animate-spin")} />
              </Button>
              <div className={cn(
                "w-2 h-2 rounded-full",
                statusError ? "bg-red-500" :
                ollamaStatus?.status === 'available' ? "bg-green-500" : "bg-yellow-500"
              )} />
              <span className="text-sm text-gray-400">
                {statusError ? 'Error' :
                 ollamaStatus?.status === 'available' ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mx-4 mt-4 p-3 bg-red-900/50 border border-red-600 rounded-lg flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <span className="text-red-200 text-sm">{error}</span>
              <button
                onClick={() => setError(null)}
                className="ml-auto text-red-400 hover:text-red-200"
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
                {(statusError || ollamaStatus?.status !== 'available') && (
                  <p className="text-sm mt-2 text-red-400">
                    {statusError ? 'Failed to connect to backend service.' : 'Ollama is not available. Please make sure it\'s running.'}
                  </p>
                )}
                {historyLoading && (
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
            {chatMutation.isPending && (
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
                  ollamaStatus?.status !== 'available' ? 
                  "Ollama service unavailable..." : 
                  "Type your message... (Press Enter to send)"
                }
                className={cn(
                  "flex-1 bg-gray-800 rounded-lg px-4 py-2 focus:outline-none focus:ring-2",
                  ollamaStatus?.status === 'available' ? "focus:ring-blue-500" : "focus:ring-red-500"
                )}
                disabled={chatMutation.isPending || ollamaStatus?.status !== 'available'}
              />
              <Button
                onClick={handleSend}
                disabled={chatMutation.isPending || !input.trim() || ollamaStatus?.status !== 'available'}
                className="px-4"
                title={
                  ollamaStatus?.status !== 'available' ? 
                  "Ollama service is unavailable" : 
                  chatMutation.isPending ? "Sending message..." : "Send message"
                }
              >
                {chatMutation.isPending ? (
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