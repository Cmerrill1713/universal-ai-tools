import React, { useState, useEffect, useRef } from 'react'

interface Agent {
  id: string
  name: string
  status: 'idle' | 'thinking' | 'working' | 'completed' | 'error'
  currentTask?: string
  progress?: number
  timestamp?: Date
  metadata?: {
    confidence?: number
    participatingIn?: string
    result?: any
  }
}

interface AgentCollaborationViewProps {
  agents?: Agent[]
  onClose?: () => void
}

export default function AgentCollaborationView({ 
  agents = [], 
  onClose 
}: AgentCollaborationViewProps) {
  const [activeAgents, setActiveAgents] = useState<Agent[]>(agents)
  const [isConnected, setIsConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Connect to WebSocket for real-time updates
  useEffect(() => {
    const connectWebSocket = () => {
      try {
        const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//localhost:9999/ws/agent-collaboration`
        wsRef.current = new WebSocket(wsUrl)
        
        wsRef.current.onopen = () => {
          console.log('Connected to agent collaboration WebSocket')
          setIsConnected(true)
          // Request initial statuses
          wsRef.current?.send(JSON.stringify({ type: 'get_status' }))
        }
        
        wsRef.current.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data)
            
            if (message.type === 'initial_statuses') {
              // Update all agents
              const formattedAgents = message.data.map((agent: any) => ({
                id: agent.agentId,
                name: agent.agentName,
                status: agent.status,
                currentTask: agent.currentTask,
                progress: agent.progress,
                timestamp: agent.timestamp,
                metadata: agent.metadata
              }))
              setActiveAgents(formattedAgents)
            } else if (message.type === 'agent_status') {
              // Update single agent
              const agentUpdate = message.data
              setActiveAgents(prev => prev.map(agent => 
                agent.id === agentUpdate.agentId 
                  ? {
                      id: agentUpdate.agentId,
                      name: agentUpdate.agentName,
                      status: agentUpdate.status,
                      currentTask: agentUpdate.currentTask,
                      progress: agentUpdate.progress,
                      timestamp: agentUpdate.timestamp,
                      metadata: agentUpdate.metadata
                    }
                  : agent
              ))
            }
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error)
          }
        }
        
        wsRef.current.onerror = (error) => {
          console.error('WebSocket error:', error)
          setIsConnected(false)
        }
        
        wsRef.current.onclose = () => {
          console.log('WebSocket connection closed')
          setIsConnected(false)
          
          // Attempt to reconnect after 3 seconds
          reconnectTimeoutRef.current = setTimeout(() => {
            connectWebSocket()
          }, 3000)
        }
      } catch (error) {
        console.error('Failed to connect to WebSocket:', error)
        setIsConnected(false)
      }
    }
    
    connectWebSocket()
    
    // Cleanup on unmount
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [])

  const getStatusColor = (status: Agent['status']) => {
    switch (status) {
      case 'idle': return 'bg-gray-500'
      case 'thinking': return 'bg-yellow-500 animate-pulse'
      case 'working': return 'bg-blue-500'
      case 'completed': return 'bg-green-500'
      case 'error': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  const getStatusIcon = (status: Agent['status']) => {
    switch (status) {
      case 'idle': return '💤'
      case 'thinking': return '🤔'
      case 'working': return '⚡'
      case 'completed': return '✅'
      case 'error': return '❌'
      default: return '❓'
    }
  }

  return (
    <div className="fixed bottom-4 right-4 w-80 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-40">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-700">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-semibold text-gray-300">Agent Collaboration</span>
          {isConnected ? (
            <span className="flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
          ) : (
            <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500" title="Connecting..."></span>
          )}
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

      {/* Agent List */}
      <div className="p-3 space-y-3 max-h-96 overflow-auto">
        {activeAgents.map(agent => (
          <div 
            key={agent.id}
            className="bg-gray-800 rounded-lg p-3 transition-all hover:bg-gray-750"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center space-x-2">
                <span className="text-lg">{getStatusIcon(agent.status)}</span>
                <span className="font-medium text-gray-200">{agent.name}</span>
              </div>
              <div className={`w-2 h-2 rounded-full ${getStatusColor(agent.status)}`} />
            </div>
            
            <p className="text-xs text-gray-400 mb-2">{agent.currentTask}</p>
            
            {agent.progress !== undefined && agent.status === 'working' && (
              <div className="w-full bg-gray-700 rounded-full h-1.5">
                <div 
                  className="bg-blue-500 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${agent.progress}%` }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Collaboration Flow */}
      <div className="p-3 border-t border-gray-700">
        <div className="flex items-center justify-center space-x-1 text-xs text-gray-500">
          <span>Orchestrator</span>
          <span>→</span>
          <span>Agents</span>
          <span>→</span>
          <span>Output</span>
        </div>
      </div>
    </div>
  )
}