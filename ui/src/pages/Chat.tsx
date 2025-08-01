import React, { useState, useRef, useEffect } from 'react'
import { api } from '../lib/api'
import CodeExecutionPreview from '../components/CodeExecutionPreview'
import AgentCollaborationView from '../components/AgentCollaborationView'
import DynamicComponentRenderer from '../components/DynamicComponentRenderer'
import UniversalModifier from '../components/UniversalModifier'
import MCPAgentSelector from '../components/MCPAgentSelector'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  code?: string
  codeLanguage?: 'javascript' | 'html' | 'react' | 'python'
  componentCode?: string
  componentType?: 'react' | 'html' | 'canvas'
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'this.connected' | 'error'>('checking')
  const [error, setError] = useState<string | null>(null)
  const [showTools, setShowTools] = useState(false)
  const [agentThinking, setAgentThinking] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [showCodePreview, setShowCodePreview] = useState(false)
  const [showAgentView, setShowAgentView] = useState(false)
  const [showComponentRenderer, setShowComponentRenderer] = useState(false)
  const [currentCode, setCurrentCode] = useState('')
  const [currentCodeLanguage, setCurrentCodeLanguage] = useState<'javascript' | 'html' | 'react' | 'python'>('javascript')
  const [currentComponent, setCurrentComponent] = useState('')
  const [currentComponentType, setCurrentComponentType] = useState<'react' | 'html' | 'canvas'>('html')
  const [selectedMCPAgent, setSelectedMCPAgent] = useState<string | undefined>()
  const [conversationId, setConversationId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }
  
  useEffect(() => {
    scrollToBottom()
    // Refocus input after messages update
    inputRef.current?.focus()
  }, [messages])
  
  // Check connection on mount and load chat history
  useEffect(() => {
    checkConnection()
    loadChatHistory()
    // Focus input on mount
    inputRef.current?.focus()
  }, [])
  
  const checkConnection = async () => {
    try {
      await api.getStatus()
      setConnectionStatus('this.connected')
      setError(null)
    } catch (err) {
      setConnectionStatus('error')
      setError('Unable to connect to server. Please ensure the backend is running on port 9999.')
      console.error('Connection check failed:', err)
    }
  }
  
  const loadChatHistory = async () => {
    try {
      const history = await api.getChatHistory()
      if (history.success && history.messages) {
        const formattedMessages: Message[] = history.messages.map((msg: any) => ({
          id: msg.id,
          role: msg.type === 'user_message' ? 'user' : 'assistant',
          content: msg.content,
          timestamp: new Date(msg.timestamp),
        }))
        setMessages(formattedMessages)
        setConversationId(history.conversationId)
      }
    } catch (err) {
      console.log('No previous chat history')
    }
  }
  
  const startNewConversation = () => {
    setMessages([])
    const newId = api.startNewConversation()
    setConversationId(newId)
    inputRef.current?.focus()
  }
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || loading) return
    
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    }
    
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)
    setAgentThinking(true)
    
    try {
      // Check if this is a modification command
      const isModificationCommand = [
        'change', 'modify', 'update', 'make', 'set', 'turn', 'switch',
        'add', 'remove', 'show', 'hide', 'create', 'delete'
      ].some(cmd => userMessage.content.toLowerCase().includes(cmd))
      
      if (isModificationCommand && (window as any).handleModificationCommand) {
        // Process as modification
        await (window as any).handleModificationCommand(userMessage.content)
        
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `✨ I'm ${userMessage.content.toLowerCase().includes('change') ? 'changing' : 'modifying'} that for you right now...`,
          timestamp: new Date()
        }
        setMessages(prev => [...prev, assistantMessage])
        
        // Add confirmation after a short delay
        setTimeout(() => {
          const confirmMessage: Message = {
            id: (Date.now() + 2).toString(),
            role: 'assistant',
            content: '✅ Done! The changes have been applied. What else would you like me to modify?',
            timestamp: new Date()
          }
          setMessages(prev => [...prev, confirmMessage])
        }, 1500)
      } else {
        // Check if we should use MCP agent
        if (selectedMCPAgent && userMessage.content.toLowerCase().includes('[mcp]')) {
          // Extract the action from the message
          const actionMatch = userMessage.content.match(/\[mcp\]\s*(\w+)(?:\s+(.+))?/i)
          if (actionMatch) {
            const action = actionMatch[1]
            const params = actionMatch[2] ? { query: actionMatch[2] } : {}
            
            try {
              const result = await api.executeMCPAgent(selectedMCPAgent, action, params)
              
              const assistantMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: `🔌 MCP Agent Response:\n\n${JSON.stringify(result.result, null, 2)}`,
                timestamp: new Date()
              }
              
              setMessages(prev => [...prev, assistantMessage])
            } catch (error) {
              const errorMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: `❌ MCP Agent Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                timestamp: new Date()
              }
              
              setMessages(prev => [...prev, errorMessage])
            }
          } else {
            // Normal chat with MCP context
            const response = await api.chat(`[Using MCP Agent: ${selectedMCPAgent}] ${userMessage.content}`)
            
            // Extract message content from different possible response formats
            let messageContent = 'Sorry, I could not process your request.';
            
            if (response.data?.message?.content) {
              messageContent = response.data.message.content;
            } else if (response.response) {
              messageContent = response.response;
            } else if (response.message) {
              messageContent = response.message;
            }
            
            const assistantMessage: Message = {
              id: (Date.now() + 1).toString(),
              role: 'assistant',
              content: messageContent,
              timestamp: new Date()
            }
            
            setMessages(prev => [...prev, assistantMessage])
          }
        } else {
          // Normal chat response
          const response = await api.chat(userMessage.content)
          
          // Extract message content from different possible response formats
          let messageContent = 'Sorry, I could not process your request.';
          
          if (response.data?.message?.content) {
            // Chat router format: {success: true, data: {message: {content: "..."}}}
            messageContent = response.data.message.content;
          } else if (response.response) {
            // Assistant router format: {response: "...", confidence: 0.7}
            messageContent = response.response;
          } else if (response.message) {
            // Legacy format: {message: "..."}
            messageContent = response.message;
          }
          
          const assistantMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: messageContent,
            timestamp: new Date()
          }
          
          setMessages(prev => [...prev, assistantMessage])
          
          // Update conversation ID if new
          const newConversationId = response.conversationId || response.data?.conversationId;
          if (newConversationId && newConversationId !== conversationId) {
            setConversationId(newConversationId)
          }
        }
      }
    } catch (error: any) {
      console.error('Chat error:', error)
      
      let errorContent = 'Sorry, I encountered an error. Please try again.'
      if (error.message.includes('fetch')) {
        errorContent = 'Unable to connect to the server. Please check if the backend is running.'
        setConnectionStatus('error')
      }
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: errorContent,
        timestamp: new Date()
      }
      
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setLoading(false)
      setAgentThinking(false)
    }
  }
  
  // File handling
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(true)
  }
  
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
  }
  
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      const fileInfo = files.map(f => `${f.name} (${(f.size / 1024).toFixed(1)}KB)`).join(', ')
      const message = `I've uploaded the following files: ${fileInfo}. What would you like me to do with them?`
      
      // Process as a regular message for now
      const userMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: message,
        timestamp: new Date()
      }
      
      setMessages(prev => [...prev, userMessage])
      setInput('')
      setLoading(true)
      setAgentThinking(true)
      
      try {
        const response = await api.chat(message)
        
        // Extract message content from different possible response formats
        let messageContent = 'I received your files. I can help analyze or process them.';
        
        if (response.data?.message?.content) {
          messageContent = response.data.message.content;
        } else if (response.response) {
          messageContent = response.response;
        } else if (response.message) {
          messageContent = response.message;
        }
        
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: messageContent,
          timestamp: new Date()
        }
        setMessages(prev => [...prev, assistantMessage])
      } catch (error) {
        console.error('Error processing files:', error)
      } finally {
        setLoading(false)
        setAgentThinking(false)
      }
    }
  }
  
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      const fileInfo = Array.from(files).map(f => `${f.name} (${(f.size / 1024).toFixed(1)}KB)`).join(', ')
      const message = `I've selected the following files: ${fileInfo}. What would you like me to do with them?`
      
      // Process as a regular message
      const userMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: message,
        timestamp: new Date()
      }
      
      setMessages(prev => [...prev, userMessage])
      setInput('')
      setLoading(true)
      setAgentThinking(true)
      
      try {
        const response = await api.chat(message)
        
        // Extract message content from different possible response formats
        let messageContent = 'I received your files. I can help analyze or process them.';
        
        if (response.data?.message?.content) {
          messageContent = response.data.message.content;
        } else if (response.response) {
          messageContent = response.response;
        } else if (response.message) {
          messageContent = response.message;
        }
        
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: messageContent,
          timestamp: new Date()
        }
        setMessages(prev => [...prev, assistantMessage])
      } catch (error) {
        console.error('Error processing files:', error)
      } finally {
        setLoading(false)
        setAgentThinking(false)
      }
    }
  }
  
  // Available tools
  const tools = [
    { id: 'store_context', name: 'Store Context', icon: '💾' },
    { id: 'search', name: 'Search', icon: '🔍' },
    { id: 'coordinate', name: 'Coordinate Agents', icon: '🤖' },
    { id: 'memory', name: 'Memory', icon: '🧠' },
    { id: 'create_ui', name: 'Create UI', icon: '🎨' },
    { id: 'execute_code', name: 'Execute Code', icon: '▶️' },
  ]
  
  // Check for code or component generation in responses
  useEffect(() => {
    const lastMessage = messages[messages.length - 1]
    if (lastMessage && lastMessage.role === 'assistant') {
      // Check for code blocks
      const codeMatch = lastMessage.content.match(/```(\w+)?\n([\s\S]+?)```/)
      if (codeMatch) {
        const language = codeMatch[1] || 'javascript'
        const code = codeMatch[2]
        setCurrentCode(code)
        setCurrentCodeLanguage(language as any)
        setShowCodePreview(true)
      }
      
      // Check for component generation
      if (lastMessage.content.includes('[COMPONENT:') || lastMessage.content.includes('[UI:')) {
        const componentMatch = lastMessage.content.match(/\[(COMPONENT|UI):(\w+)\]([\s\S]+?)\[\/(COMPONENT|UI)\]/)
        if (componentMatch) {
          const type = componentMatch[2].toLowerCase() as any
          const componentCode = componentMatch[3].trim()
          setCurrentComponent(componentCode)
          setCurrentComponentType(type)
          setShowComponentRenderer(true)
        }
      }
    }
  }, [messages])
  
  return (
    <div 
      className="h-screen flex flex-col max-w-4xl mx-auto"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className="border-b border-gray-800 p-4">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold">Universal AI Chat</h1>
          <div className="flex items-center space-x-4">
            {/* New Conversation Button */}
            <button
              onClick={startNewConversation}
              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
              title="Start new conversation"
            >
              New Chat
            </button>
            {/* MCP Agent Selector */}
            <MCPAgentSelector
              onAgentSelect={(agent) => setSelectedMCPAgent(agent.id)}
              selectedAgentId={selectedMCPAgent}
            />
            {/* Feature toggles */}
            <button
              onClick={() => setShowAgentView(!showAgentView)}
              className={`p-2 rounded transition-colors ${
                showAgentView 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
              title="Toggle agent collaboration view"
            >
              🤖
            </button>
            <div className={`w-3 h-3 rounded-full ${
              connectionStatus === 'this.connected' ? 'bg-green-500' : 
              connectionStatus === 'error' ? 'bg-red-500' : 
              'bg-yellow-500 animate-pulse'
            }`} />
            <span className="text-sm text-gray-400">
              {connectionStatus === 'this.connected' ? 'Connected' : 
               connectionStatus === 'error' ? 'Disconnected' : 
               'Connecting...'}
            </span>
          </div>
        </div>
      </div>
      
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 relative">
        {/* Drag overlay */}
        {dragActive && (
          <div className="absolute inset-0 bg-blue-900/20 border-2 border-dashed border-blue-500 rounded-lg flex items-center justify-center z-10">
            <div className="text-center">
              <div className="text-6xl mb-4">📁</div>
              <p className="text-xl font-semibold text-blue-400">Drop files here</p>
              <p className="text-sm text-gray-400 mt-2">I'll help you analyze or process them</p>
            </div>
          </div>
        )}
        {/* Error Banner */}
        {error && connectionStatus === 'error' && (
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-4">
            <p className="text-red-400 text-sm">{error}</p>
            <button 
              onClick={checkConnection}
              className="text-red-400 text-sm underline mt-2 hover:text-red-300"
            >
              Retry Connection
            </button>
          </div>
        )}
        
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-8">
            <p className="text-lg">Welcome! How can I help you today?</p>
          </div>
        )}
        
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[70%] rounded-lg p-4 ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-100'
              }`}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
              <p className="text-xs opacity-70 mt-1">
                {message.timestamp.toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}
        
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="flex space-x-2">
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
              </div>
            </div>
          </div>
        )}
        
        {agentThinking && !loading && (
          <div className="flex justify-start">
            <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-3">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-blue-400">Agents are contemplating your request...</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t border-gray-800 p-4">
        {/* Tools widget */}
        {showTools && (
          <div className="mb-3 p-3 bg-gray-800 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-300">Available Tools</span>
              <button
                type="button"
                onClick={() => setShowTools(false)}
                className="text-gray-400 hover:text-gray-200"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {tools.map(tool => (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => {
                    setInput(prev => `${prev  } [Use ${tool.name}]`)
                    setShowTools(false)
                    inputRef.current?.focus()
                  }}
                  className="flex items-center space-x-2 p-2 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
                >
                  <span className="text-lg">{tool.icon}</span>
                  <span className="text-sm">{tool.name}</span>
                </button>
              ))}
              <button
                key="show_agents"
                type="button"
                onClick={() => {
                  setShowAgentView(true)
                  setShowTools(false)
                }}
                className="flex items-center space-x-2 p-2 bg-gray-700 hover:bg-gray-600 rounded transition-colors col-span-2"
              >
                <span className="text-lg">👀</span>
                <span className="text-sm">View Active Agents</span>
              </button>
            </div>
          </div>
        )}
        
        <div className="flex space-x-2">
          {/* Tools button */}
          <button
            type="button"
            onClick={() => setShowTools(!showTools)}
            className="p-2 bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            title="Available tools"
          >
            🛠️
          </button>
          
          {/* File upload button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            title="Upload files"
          >
            📎
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message or drop files here..."
            className="flex-1 bg-gray-800 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </div>
      </form>
      
      {/* Feature Windows */}
      {showCodePreview && currentCode && (
        <CodeExecutionPreview
          code={currentCode}
          language={currentCodeLanguage}
          onClose={() => setShowCodePreview(false)}
        />
      )}
      
      {showAgentView && (
        <AgentCollaborationView
          onClose={() => setShowAgentView(false)}
        />
      )}
      
      {showComponentRenderer && currentComponent && (
        <DynamicComponentRenderer
          componentCode={currentComponent}
          componentType={currentComponentType}
          onClose={() => setShowComponentRenderer(false)}
        />
      )}
      
      {/* Universal Modifier - Always Active */}
      <UniversalModifier />
    </div>
  )
}