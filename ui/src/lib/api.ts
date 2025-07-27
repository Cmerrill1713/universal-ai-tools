const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:9999'
const API_KEY = import.meta.env.VITE_API_KEY || 'test-api-key-123'

class API {
  private headers = {
    'Content-Type': 'application/json',
    'X-API-Key': API_KEY,
    'X-AI-Service': import.meta.env.VITE_AI_SERVICE || 'universal-ai-ui'
  }
  
  // Session management
  private conversationId: string | null = null
  private sessionId: string | null = null
  
  constructor() {
    // Load session from localStorage
    this.conversationId = localStorage.getItem('conversationId')
    this.sessionId = localStorage.getItem('sessionId')
    
    // Generate new session ID if not exists
    if (!this.sessionId) {
      this.sessionId = this.generateId()
      localStorage.setItem('sessionId', this.sessionId)
    }
  }
  
  private generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2)
  }
  
  startNewConversation() {
    this.conversationId = this.generateId()
    localStorage.setItem('conversationId', this.conversationId)
    return this.conversationId
  }
  
  async chat(message: string, newConversation = false) {
    // Start new conversation if requested
    if (newConversation || !this.conversationId) {
      this.startNewConversation()
    }
    
    const response = await fetch(`${API_URL}/api/v1/chat`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ 
        message,
        conversationId: this.conversationId,
        sessionId: this.sessionId
      })
    })
    
    if (!response.ok) {
      throw new Error('Chat request failed')
    }
    
    const data = await response.json()
    
    // Update conversation ID if returned by server
    if (data.conversationId) {
      this.conversationId = data.conversationId
      localStorage.setItem('conversationId', data.conversationId)
    }
    
    return data
  }
  
  async getChatHistory(conversationId?: string) {
    const id = conversationId || this.conversationId
    if (!id) {
      return { success: false, messages: [] }
    }
    
    const response = await fetch(`${API_URL}/api/v1/chat/history/${id}`, {
      headers: this.headers
    })
    
    if (!response.ok) {
      throw new Error('Failed to fetch chat history')
    }
    
    return response.json()
  }
  
  async getStatus() {
    const response = await fetch(`${API_URL}/api/v1/status`, {
      headers: this.headers
    })
    
    if (!response.ok) {
      throw new Error('Status request failed')
    }
    
    return response.json()
  }
  
  // MCP Agent methods
  async getMCPAgents() {
    const response = await fetch(`${API_URL}/api/v1/mcp/agents`, {
      headers: this.headers
    })
    
    if (!response.ok) {
      throw new Error('Failed to fetch MCP agents')
    }
    
    return response.json()
  }
  
  async getMCPAgent(agentId: string) {
    const response = await fetch(`${API_URL}/api/v1/mcp/agents/${agentId}`, {
      headers: this.headers
    })
    
    if (!response.ok) {
      throw new Error('Failed to fetch MCP agent')
    }
    
    return response.json()
  }
  
  async storeMCPAgentKeys(agentId: string, keys: Record<string, string>) {
    const response = await fetch(`${API_URL}/api/v1/mcp/agents/${agentId}/keys`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ keys })
    })
    
    if (!response.ok) {
      throw new Error('Failed to store MCP agent keys')
    }
    
    return response.json()
  }
  
  async executeMCPAgent(agentId: string, action: string, params?: any) {
    const response = await fetch(`${API_URL}/api/v1/mcp/agents/${agentId}/execute`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ action, params })
    })
    
    if (!response.ok) {
      throw new Error('Failed to execute MCP agent action')
    }
    
    return response.json()
  }
  
  async testMCPAgent(agentId: string) {
    const response = await fetch(`${API_URL}/api/v1/mcp/agents/${agentId}/test`, {
      method: 'POST',
      headers: this.headers
    })
    
    if (!response.ok) {
      throw new Error('Failed to test MCP agent')
    }
    
    return response.json()
  }
  
  async getMCPStatus() {
    const response = await fetch(`${API_URL}/api/v1/mcp/status`, {
      headers: this.headers
    })
    
    if (!response.ok) {
      throw new Error('Failed to fetch MCP status')
    }
    
    return response.json()
  }
}

export const api = new API()

export const systemApi = {
  getStats: async () => ({ data: {} }),
  getHealth: async () => ({ data: { healthy: true } })
};

export const memoryApi = {
  list: async () => ({ data: [] }),
  create: async (data: any) => ({ data }),
  delete: async (id: string) => ({ success: true })
};
