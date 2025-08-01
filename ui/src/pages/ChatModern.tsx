import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, 
  Sparkles, 
  Code2, 
  Copy, 
  Check, 
  Loader2,
  Bot,
  User,
  Terminal,
  Zap,
  Brain,
  Cpu,
  Network,
  BarChart3,
  Settings2,
  Moon,
  Sun,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { api } from '../lib/api-enhanced';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  code?: string;
  codeLanguage?: string;
  metadata?: {
    model?: string;
    confidence?: number;
    tokensUsed?: number;
    executionTime?: number;
    agent?: string;
  };
  streaming?: boolean;
}

interface ABMCTSMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  averageConfidence: number;
  learningCycles: number;
  parameterOptimizations: number;
}

export default function ChatModern() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'system',
      content: 'Welcome to Universal AI Tools. I\'m powered by advanced AB-MCTS orchestration with self-learning capabilities. How can I assist you today?',
      timestamp: new Date(),
      metadata: {
        agent: 'system',
        confidence: 1.0
      }
    }
  ]);
  
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [showMetrics, setShowMetrics] = useState(false);
  const [autoPilotActive, setAutoPilotActive] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [abMctsMetrics, setAbMctsMetrics] = useState<ABMCTSMetrics | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentModel, setCurrentModel] = useState('llama3.2:3b');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingText]);

  useEffect(() => {
    // Check auto-pilot status
    checkAutoPilotStatus();
    
    // Poll for metrics if auto-pilot is active
    const interval = setInterval(() => {
      if (autoPilotActive) {
        fetchAutoPilotMetrics();
      }
    }, 5000);
    
    return () => clearInterval(interval);
  }, [autoPilotActive]);

  const checkAutoPilotStatus = async () => {
    try {
      const response = await fetch('/api/v1/ab-mcts/auto-pilot/status');
      const data = await response.json();
      setAutoPilotActive(data.data?.active || false);
    } catch (error) {
      console.error('Failed to check auto-pilot status:', error);
    }
  };

  const fetchAutoPilotMetrics = async () => {
    try {
      const response = await fetch('/api/v1/ab-mcts/auto-pilot/metrics');
      const data = await response.json();
      setAbMctsMetrics(data.data?.performance || null);
    } catch (error) {
      console.error('Failed to fetch auto-pilot metrics:', error);
    }
  };

  const toggleAutoPilot = async () => {
    try {
      const endpoint = autoPilotActive ? 'stop' : 'start';
      const response = await fetch(`/api/v1/ab-mcts/auto-pilot/${endpoint}`, {
        method: 'POST'
      });
      const data = await response.json();
      
      if (data.success) {
        setAutoPilotActive(!autoPilotActive);
        
        const message: Message = {
          id: Date.now().toString(),
          role: 'system',
          content: `AB-MCTS Auto-Pilot ${!autoPilotActive ? 'activated' : 'deactivated'}. ${!autoPilotActive ? 'The system is now learning and optimizing autonomously.' : 'Manual control resumed.'}`,
          timestamp: new Date(),
          metadata: {
            agent: 'auto-pilot',
            confidence: 1.0
          }
        };
        
        setMessages(prev => [...prev, message]);
      }
    } catch (error) {
      console.error('Failed to toggle auto-pilot:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      // Create streaming message
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        streaming: true
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      
      // Submit to AB-MCTS if auto-pilot is active
      if (autoPilotActive) {
        const response = await fetch('/api/v1/ab-mcts/auto-pilot/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userRequest: userMessage.content,
            priority: 5
          })
        });
        
        const data = await response.json();
        
        // Simulate streaming response
        const fullResponse = `Task submitted to AB-MCTS Auto-Pilot with ID: ${data.data?.taskId}. The system is processing your request using advanced probabilistic orchestration...`;
        
        await simulateStreaming(assistantMessage.id, fullResponse, {
          agent: 'ab-mcts-auto-pilot',
          confidence: 0.95
        });
      } else {
        // Regular chat API
        try {
          const response = await api.chat(userMessage.content);
          
          // Extract message content from different possible response formats
          let messageContent = 'Processing your request...';
          
          if (response.data?.message?.content) {
            messageContent = response.data.message.content;
          } else if (response.response) {
            messageContent = response.response;
          } else if (response.message) {
            messageContent = response.message;
          }
          
          // Update current model with LFM2 routing information
          if (response.metadata?.serviceUsed || response.metadata?.model || response.data?.message?.metadata?.model) {
            let modelDisplay = response.metadata?.model || response.data?.message?.metadata?.model || 'unknown';
            
            // Show service used by LFM2 routing
            if (response.metadata?.serviceUsed) {
              const serviceUsed = response.metadata.serviceUsed;
              if (serviceUsed.includes('fallback')) {
                modelDisplay = `${serviceUsed}`;
              } else {
                modelDisplay = `${serviceUsed} → ${modelDisplay}`;
              }
            }
            
            // Add LFM2 indicator if routing was used
            if (response.metadata?.lfm2Enabled) {
              modelDisplay = `🎯 ${modelDisplay}`;
            }
            
            setCurrentModel(modelDisplay);
          }
          
          await simulateStreaming(assistantMessage.id, messageContent, {
            model: response.metadata?.model,
            confidence: response.metadata?.confidence,
            tokensUsed: response.metadata?.tokensUsed,
            executionTime: response.metadata?.executionTime,
            agent: response.metadata?.agent
          });
          
          // Add code if present
          if (response.code) {
            setMessages(prev => prev.map(msg => 
              msg.id === assistantMessage.id 
                ? { ...msg, code: response.code, codeLanguage: response.codeLanguage }
                : msg
            ));
          }
        } catch (apiError) {
          console.error('API Error:', apiError);
          
          // Remove the streaming message and add error message
          setMessages(prev => prev.filter(msg => msg.id !== assistantMessage.id));
          
          const errorMessage: Message = {
            id: (Date.now() + 2).toString(),
            role: 'assistant',
            content: `Sorry, I encountered an error: ${apiError instanceof Error ? apiError.message : 'Unknown error'}. Please ensure the backend is running properly.`,
            timestamp: new Date(),
            metadata: {
              agent: 'error-handler',
              confidence: 0
            }
          };
          
          setMessages(prev => [...prev, errorMessage]);
          return; // Exit early to avoid setting loading to false twice
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      
      const errorMessage: Message = {
        id: (Date.now() + 2).toString(),
        role: 'assistant',
        content: 'I apologize, but I encountered an error processing your request. Please ensure the backend is running and try again.',
        timestamp: new Date(),
        metadata: {
          agent: 'error-handler',
          confidence: 0
        }
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const simulateStreaming = async (messageId: string, fullText: string, metadata?: any) => {
    const words = fullText.split(' ');
    let currentText = '';
    
    for (let i = 0; i < words.length; i++) {
      currentText += (i > 0 ? ' ' : '') + words[i];
      
      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, content: currentText, metadata }
          : msg
      ));
      
      await new Promise(resolve => setTimeout(resolve, 30 + Math.random() * 20));
    }
    
    // Mark as complete
    setMessages(prev => prev.map(msg => 
      msg.id === messageId 
        ? { ...msg, streaming: false }
        : msg
    ));
  };

  const copyCode = async (code: string, id: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      chatContainerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
    setIsFullscreen(!isFullscreen);
  };

  const getAgentIcon = (agent?: string) => {
    switch (agent) {
      case 'ab-mcts-auto-pilot':
        return <Brain className="w-4 h-4" />;
      case 'planner':
        return <Network className="w-4 h-4" />;
      case 'synthesizer':
        return <Cpu className="w-4 h-4" />;
      default:
        return <Bot className="w-4 h-4" />;
    }
  };

  return (
    <div 
      ref={chatContainerRef}
      className={`flex flex-col h-screen ${darkMode ? 'bg-gray-900 text-gray-100' : 'bg-white text-gray-900'} transition-colors duration-300`}
    >
      {/* Header */}
      <div className={`flex items-center justify-between px-6 py-4 border-b ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
        <div className="flex items-center space-x-4">
          <div className="relative">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            {autoPilotActive && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse" />
            )}
          </div>
          
          <div>
            <h1 className="text-xl font-semibold">Universal AI Tools</h1>
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <Cpu className="w-3 h-3 text-blue-500" />
              <span>{currentModel}</span>
              <span>•</span>
              <Zap className="w-3 h-3 text-green-500" />
              <span>Connected</span>
              {autoPilotActive && (
                <>
                  <span className="text-gray-400">•</span>
                  <span className="text-blue-500">Auto-Pilot Active</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowMetrics(!showMetrics)}
            className={`p-2 rounded-lg transition-colors ${
              darkMode 
                ? 'hover:bg-gray-800 text-gray-400 hover:text-gray-200' 
                : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
            }`}
          >
            <BarChart3 className="w-5 h-5" />
          </button>
          
          <button
            onClick={toggleAutoPilot}
            className={`px-4 py-2 rounded-lg flex items-center space-x-2 transition-all ${
              autoPilotActive
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : darkMode
                  ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <Brain className="w-4 h-4" />
            <span className="text-sm font-medium">
              {autoPilotActive ? 'Auto-Pilot ON' : 'Auto-Pilot OFF'}
            </span>
          </button>

          <button
            onClick={() => setDarkMode(!darkMode)}
            className={`p-2 rounded-lg transition-colors ${
              darkMode 
                ? 'hover:bg-gray-800 text-gray-400 hover:text-gray-200' 
                : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
            }`}
          >
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          <button
            onClick={toggleFullscreen}
            className={`p-2 rounded-lg transition-colors ${
              darkMode 
                ? 'hover:bg-gray-800 text-gray-400 hover:text-gray-200' 
                : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
            }`}
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Metrics Panel */}
      <AnimatePresence>
        {showMetrics && abMctsMetrics && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className={`border-b ${darkMode ? 'border-gray-800 bg-gray-850' : 'border-gray-200 bg-gray-50'}`}
          >
            <div className="px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-gray-500">Success Rate</div>
                <div className="text-2xl font-semibold">
                  {((abMctsMetrics.successfulRequests / abMctsMetrics.totalRequests) * 100).toFixed(1)}%
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Avg Response Time</div>
                <div className="text-2xl font-semibold">
                  {(abMctsMetrics.averageResponseTime / 1000).toFixed(2)}s
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Learning Cycles</div>
                <div className="text-2xl font-semibold">
                  {abMctsMetrics.learningCycles}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Optimizations</div>
                <div className="text-2xl font-semibold">
                  {abMctsMetrics.parameterOptimizations}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        <AnimatePresence initial={false}>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex max-w-3xl ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'} space-x-3`}>
                {/* Avatar */}
                <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                  message.role === 'user'
                    ? 'bg-gradient-to-br from-green-500 to-emerald-600'
                    : message.role === 'system'
                      ? 'bg-gradient-to-br from-yellow-500 to-orange-600'
                      : 'bg-gradient-to-br from-blue-500 to-purple-600'
                }`}>
                  {message.role === 'user' ? (
                    <User className="w-5 h-5 text-white" />
                  ) : message.role === 'system' ? (
                    <Settings2 className="w-5 h-5 text-white" />
                  ) : (
                    getAgentIcon(message.metadata?.agent)
                  )}
                </div>

                {/* Message Content */}
                <div className={`flex-1 ${message.role === 'user' ? 'mr-3' : 'ml-3'}`}>
                  <div className={`rounded-2xl px-4 py-3 ${
                    message.role === 'user'
                      ? darkMode ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white'
                      : darkMode ? 'bg-gray-800' : 'bg-gray-100'
                  }`}>
                    <div className="text-sm whitespace-pre-wrap">
                      {message.content}
                      {message.streaming && (
                        <span className="inline-block w-1 h-4 ml-1 bg-current animate-pulse" />
                      )}
                    </div>

                    {/* Code Block */}
                    {message.code && (
                      <div className="mt-3">
                        <div className={`flex items-center justify-between px-3 py-2 rounded-t-lg ${
                          darkMode ? 'bg-gray-900' : 'bg-gray-200'
                        }`}>
                          <div className="flex items-center space-x-2">
                            <Code2 className="w-4 h-4" />
                            <span className="text-xs font-medium">
                              {message.codeLanguage || 'code'}
                            </span>
                          </div>
                          <button
                            onClick={() => copyCode(message.code!, message.id)}
                            className={`p-1 rounded transition-colors ${
                              darkMode 
                                ? 'hover:bg-gray-800 text-gray-400 hover:text-gray-200' 
                                : 'hover:bg-gray-300 text-gray-600 hover:text-gray-900'
                            }`}
                          >
                            {copiedCode === message.id ? (
                              <Check className="w-4 h-4 text-green-500" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                        <SyntaxHighlighter
                          language={message.codeLanguage || 'javascript'}
                          style={vscDarkPlus}
                          customStyle={{
                            margin: 0,
                            borderRadius: '0 0 0.5rem 0.5rem',
                            fontSize: '0.875rem'
                          }}
                        >
                          {message.code}
                        </SyntaxHighlighter>
                      </div>
                    )}
                  </div>

                  {/* Metadata */}
                  {message.metadata && message.role === 'assistant' && (
                    <div className="flex items-center space-x-3 mt-2 text-xs text-gray-500">
                      {message.metadata.agent && (
                        <span>Agent: {message.metadata.agent}</span>
                      )}
                      {message.metadata.confidence !== undefined && (
                        <span>Confidence: {(message.metadata.confidence * 100).toFixed(0)}%</span>
                      )}
                      {message.metadata.executionTime && (
                        <span>{message.metadata.executionTime}ms</span>
                      )}
                      {message.metadata.tokensUsed && (
                        <span>{message.metadata.tokensUsed} tokens</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {/* Loading indicator */}
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="flex items-center space-x-2 text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">AI is thinking...</span>
            </div>
          </motion.div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className={`border-t ${darkMode ? 'border-gray-800' : 'border-gray-200'} px-6 py-4`}>
        <div className={`flex items-end space-x-3 ${
          darkMode ? 'bg-gray-800' : 'bg-gray-100'
        } rounded-2xl px-4 py-3`}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Send a message..."
            rows={1}
            className={`flex-1 resize-none outline-none ${
              darkMode ? 'bg-transparent text-gray-100' : 'bg-transparent text-gray-900'
            } placeholder-gray-500`}
            style={{
              minHeight: '24px',
              maxHeight: '120px'
            }}
          />
          
          <button
            onClick={handleSendMessage}
            disabled={!input.trim() || loading}
            className={`p-2 rounded-lg transition-all ${
              input.trim() && !loading
                ? 'bg-blue-600 text-white hover:bg-blue-700 scale-100'
                : darkMode 
                  ? 'bg-gray-700 text-gray-500 scale-95'
                  : 'bg-gray-300 text-gray-400 scale-95'
            }`}
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
        
        <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
          <span>Press Enter to send, Shift+Enter for new line</span>
          <div className="flex items-center space-x-2">
            <Terminal className="w-3 h-3" />
            <span>Powered by AB-MCTS • MLX • DSPy</span>
          </div>
        </div>
      </div>
    </div>
  );
}