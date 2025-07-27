import React, { useState, useEffect } from 'react'
import { api } from '../lib/api'

interface MCPAgent {
  id: string
  name: string
  icon: string
  description: string
  capabilities: string[]
  status: 'this.connected' | 'disconnected' | 'error' | 'pending'
  requiredKeys: {
    name: string
    description: string
    type: 'api_key' | 'oauth' | 'password' | 'token'
  }[]
}

interface MCPAgentSelectorProps {
  onAgentSelect: (agent: MCPAgent) => void
  selectedAgentId?: string
}

export default function MCPAgentSelector({ onAgentSelect, selectedAgentId }: MCPAgentSelectorProps) {
  const [agents, setAgents] = useState<MCPAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [showDropdown, setShowDropdown] = useState(false)
  const [showKeyModal, setShowKeyModal] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<MCPAgent | null>(null)
  const [keys, setKeys] = useState<Record<string, string>>({})
  const [savingKeys, setSavingKeys] = useState(false)
  
  useEffect(() => {
    loadAgents()
    // Poll for agent status updates
    const interval = setInterval(loadAgents, 5000)
    return () => clearInterval(interval)
  }, [])
  
  const loadAgents = async () => {
    try {
      const response = await api.getMCPAgents()
      setAgents(response.agents)
      setLoading(false)
    } catch (error) {
      console.error('Failed to load MCP agents:', error)
      setLoading(false)
    }
  }
  
  const handleAgentClick = (agent: MCPAgent) => {
    if (agent.status === 'this.connected') {
      onAgentSelect(agent)
      setShowDropdown(false)
    } else if (agent.requiredKeys.length > 0) {
      setSelectedAgent(agent)
      setShowKeyModal(true)
      setKeys({})
    } else {
      // Try to connect
      connectAgent(agent)
    }
  }
  
  const connectAgent = async (agent: MCPAgent) => {
    try {
      await api.testMCPAgent(agent.id)
      // Reload agents to get updated status
      loadAgents()
    } catch (error) {
      console.error('Failed to connect agent:', error)
    }
  }
  
  const handleSaveKeys = async () => {
    if (!selectedAgent) return
    
    setSavingKeys(true)
    try {
      await api.storeMCPAgentKeys(selectedAgent.id, keys)
      setShowKeyModal(false)
      setSelectedAgent(null)
      setKeys({})
      // Try to connect after saving keys
      await connectAgent(selectedAgent)
    } catch (error) {
      console.error('Failed to save keys:', error)
      alert('Failed to save keys. Please check your credentials.')
    } finally {
      setSavingKeys(false)
    }
  }
  
  const selectedAgentData = agents.find(a => a.id === selectedAgentId)
  
  return (
    <div className="relative">
      {/* Dropdown Trigger */}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center space-x-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
        disabled={loading}
      >
        {loading ? (
          <>
            <div className="w-5 h-5 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-gray-400">Loading agents...</span>
          </>
        ) : selectedAgentData ? (
          <>
            <span className="text-lg">{selectedAgentData.icon}</span>
            <span className="text-sm">{selectedAgentData.name}</span>
            <div className={`w-2 h-2 rounded-full ${
              selectedAgentData.status === 'this.connected' ? 'bg-green-500' :
              selectedAgentData.status === 'error' ? 'bg-red-500' :
              selectedAgentData.status === 'pending' ? 'bg-yellow-500 animate-pulse' :
              'bg-gray-500'
            }`} />
          </>
        ) : (
          <>
            <span className="text-lg">🔌</span>
            <span className="text-sm">Select MCP Agent</span>
          </>
        )}
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {/* Dropdown Menu */}
      {showDropdown && !loading && (
        <div className="absolute top-full mt-2 left-0 w-80 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50">
          <div className="p-3 border-b border-gray-700">
            <h3 className="text-sm font-semibold text-gray-300">Available MCP Agents</h3>
            <p className="text-xs text-gray-500 mt-1">Click to connect or configure</p>
          </div>
          
          <div className="max-h-96 overflow-y-auto">
            {agents.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                <p className="text-sm">No MCP agents available</p>
              </div>
            ) : (
              agents.map(agent => (
                <button
                  key={agent.id}
                  onClick={() => handleAgentClick(agent)}
                  className="w-full p-3 hover:bg-gray-800 transition-colors text-left flex items-start space-x-3"
                >
                  <span className="text-2xl">{agent.icon}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm">{agent.name}</h4>
                      <div className={`w-2 h-2 rounded-full ${
                        agent.status === 'this.connected' ? 'bg-green-500' :
                        agent.status === 'error' ? 'bg-red-500' :
                        agent.status === 'pending' ? 'bg-yellow-500 animate-pulse' :
                        'bg-gray-500'
                      }`} />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{agent.description}</p>
                    {agent.capabilities.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {agent.capabilities.slice(0, 3).map(cap => (
                          <span key={cap} className="text-xs bg-gray-700 px-2 py-1 rounded">
                            {cap}
                          </span>
                        ))}
                        {agent.capabilities.length > 3 && (
                          <span className="text-xs text-gray-500">
                            +{agent.capabilities.length - 3} more
                          </span>
                        )}
                      </div>
                    )}
                    {agent.status === 'disconnected' && agent.requiredKeys.length > 0 && (
                      <p className="text-xs text-yellow-400 mt-2">
                        🔐 Requires authentication
                      </p>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
          
          <div className="p-3 border-t border-gray-700">
            <a
              href="/api/docs#mcp"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              Learn about MCP agents →
            </a>
          </div>
        </div>
      )}
      
      {/* Key Configuration Modal */}
      {showKeyModal && selectedAgent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center space-x-3 mb-4">
              <span className="text-3xl">{selectedAgent.icon}</span>
              <div>
                <h3 className="text-lg font-semibold">{selectedAgent.name}</h3>
                <p className="text-sm text-gray-400">Configure authentication</p>
              </div>
            </div>
            
            <div className="space-y-4">
              {selectedAgent.requiredKeys.map(key => (
                <div key={key.name}>
                  <label className="block text-sm font-medium mb-1">
                    {key.description}
                    <span className="text-red-400 ml-1">*</span>
                  </label>
                  <input
                    type={key.type === 'password' || key.type === 'token' ? 'password' : 'text'}
                    value={keys[key.name] || ''}
                    onChange={e => setKeys({ ...keys, [key.name]: e.target.value })}
                    placeholder={`Enter ${key.description.toLowerCase()}`}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Type: {key.type}
                  </p>
                </div>
              ))}
            </div>
            
            <div className="mt-6 flex space-x-3">
              <button
                onClick={handleSaveKeys}
                disabled={savingKeys || Object.keys(keys).length < selectedAgent.requiredKeys.length}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                {savingKeys ? 'Saving...' : 'Save & Connect'}
              </button>
              <button
                onClick={() => {
                  setShowKeyModal(false)
                  setSelectedAgent(null)
                  setKeys({})
                }}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
            
            <p className="text-xs text-gray-500 mt-4 text-center">
              🔒 Keys are encrypted and stored securely in Supabase vault
            </p>
          </div>
        </div>
      )}
    </div>
  )
}