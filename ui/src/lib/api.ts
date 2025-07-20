import axios, { AxiosInstance, AxiosResponse } from 'axios';

// API Configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:9999/api';
const API_KEY = process.env.REACT_APP_API_KEY || '';
const AI_SERVICE = process.env.REACT_APP_AI_SERVICE || 'local-ui';

// Warn if API key is not set
if (!API_KEY) {
  console.warn('⚠️  REACT_APP_API_KEY is not set. Authentication will fail.');
}

// Create axios instance with authentication headers
export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': API_KEY,
    'x-ai-service': AI_SERVICE,
  },
  timeout: 30000, // 30 second timeout
});

// Request interceptor to add authentication headers
apiClient.interceptors.request.use(
  (config) => {
    // Add authentication headers for every request
    config.headers['x-api-key'] = API_KEY;
    config.headers['x-ai-service'] = AI_SERVICE;
    
    console.log(`🔌 API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('❌ Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    console.log(`✅ API Response: ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error(`❌ API Error: ${error.response?.status} ${error.config?.url}`, error.response?.data);
    
    // Handle specific error cases with enhanced messaging
    if (error.response?.status === 401) {
      console.error('🔒 Authentication failed - check API keys');
      error.message = 'Authentication failed. Please check your API credentials.';
    } else if (error.response?.status === 403) {
      console.error('🚫 Access forbidden - insufficient permissions');
      error.message = 'Access forbidden. You don\'t have permission to perform this action.';
    } else if (error.response?.status === 404) {
      console.error('🔍 Resource not found');
      error.message = 'The requested resource was not found.';
    } else if (error.response?.status === 422) {
      console.error('📝 Validation error');
      error.message = error.response?.data?.message || 'Validation failed. Please check your input.';
    } else if (error.response?.status === 429) {
      console.error('⏱️ Rate limit exceeded');
      error.message = 'Too many requests. Please try again later.';
    } else if (error.response?.status === 500) {
      console.error('🚨 Server error - check backend service');
      error.message = 'Internal server error. Please try again or contact support.';
    } else if (error.response?.status === 503) {
      console.error('🔧 Service unavailable');
      error.message = 'Service temporarily unavailable. Please try again later.';
    } else if (error.code === 'ECONNREFUSED' || error.code === 'NETWORK_ERROR') {
      console.error('🌐 Network connection failed');
      error.message = 'Unable to connect to server. Please check your internet connection.';
    } else if (error.code === 'ECONNABORTED') {
      console.error('⏰ Request timeout');
      error.message = 'Request timed out. Please try again.';
    }
    
    return Promise.reject(error);
  }
);

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface MemoryItem {
  id: string;
  content: string;
  memory_type: string;
  importance_score: number;
  importance?: number; // For backward compatibility
  tags?: string[];
  created_at: string;
  metadata?: Record<string, any>;
  access_count?: number;
  last_accessed?: string;
  services_accessed?: string[];
}

export interface AgentItem {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  instructions: string;
  model: string;
  is_active: boolean;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  model?: string;
}

export interface OrchestrationRequest {
  userRequest: string;
  orchestrationMode?: 'simple' | 'standard' | 'cognitive' | 'adaptive';
  context?: Record<string, any>;
  conversationId?: string;
  sessionId?: string;
}

export interface OrchestrationResponse {
  success: boolean;
  requestId: string;
  data: any;
  mode: string;
  confidence: number;
  reasoning: string;
  participatingAgents: string[];
  executionTime: number;
}

// Memory API
export const memoryApi = {
  search: async (query: string, limit = 20): Promise<MemoryItem[]> => {
    const response = await apiClient.post('/memory/search', { query, limit });
    // Backend returns data.results for search endpoint
    const memories = response.data.data?.results || response.data.memories || [];
    // Add backward compatibility alias
    return memories.map((memory: any) => ({
      ...memory,
      importance: memory.importance_score || memory.importance
    }));
  },

  store: async (memory: {
    content: string;
    memory_type: string;
    importance: number;
    tags?: string[];
    metadata?: Record<string, any>;
  }): Promise<MemoryItem> => {
    const response = await apiClient.post('/memory', {
      content: memory.content,
      memory_type: memory.memory_type,
      importance_score: memory.importance,
      tags: memory.tags,
      metadata: memory.metadata
    });
    // Backend returns data wrapped in success response
    const memoryData = response.data.data || response.data.memory;
    return {
      ...memoryData,
      importance: memoryData.importance_score || memoryData.importance
    };
  },

  retrieve: async (memoryType?: string, limit = 50): Promise<MemoryItem[]> => {
    const params = new URLSearchParams();
    if (memoryType) params.append('memory_type', memoryType);
    params.append('limit', limit.toString());
    
    const response = await apiClient.get(`/memory?${params.toString()}`);
    const memories = response.data.memories || [];
    // Add backward compatibility alias
    return memories.map((memory: any) => ({
      ...memory,
      importance: memory.importance_score || memory.importance
    }));
  },

  updateImportance: async (id: string, importance: number): Promise<MemoryItem> => {
    const response = await apiClient.put(`/memory/${id}/importance`, { importance });
    const memoryData = response.data.memory;
    return {
      ...memoryData,
      importance: memoryData.importance_score || memoryData.importance
    };
  }
};

// Chat API
export const chatApi = {
  sendMessage: async (message: string, model: string, conversationId = 'default'): Promise<{
    response: string;
    model: string;
    conversation_id: string;
    timestamp: string;
  }> => {
    const response = await apiClient.post('/assistant/chat', {
      message,
      model,
      conversation_id: conversationId
    });
    return response.data;
  },

  getConversationHistory: async (conversationId: string, limit = 50): Promise<ChatMessage[]> => {
    const response = await apiClient.get(`/assistant/conversation/${conversationId}?limit=${limit}`);
    return response.data.messages || [];
  }
};

// Orchestration API (DSPy)
export const orchestrationApi = {
  orchestrate: async (request: OrchestrationRequest): Promise<OrchestrationResponse> => {
    const response = await apiClient.post('/orchestration/orchestrate', request);
    return response.data;
  },

  coordinate: async (task: string, availableAgents: string[], context = {}): Promise<{
    success: boolean;
    selectedAgents: string;
    coordinationPlan: string;
    assignments: any[];
  }> => {
    const response = await apiClient.post('/orchestration/coordinate', {
      task,
      availableAgents,
      context
    });
    return response.data;
  },

  searchKnowledge: async (query: string, filters = {}, limit = 10): Promise<{
    success: boolean;
    operation: string;
    result: any;
  }> => {
    const response = await apiClient.post('/orchestration/knowledge/search', {
      query,
      filters,
      limit
    });
    return response.data;
  },

  extractKnowledge: async (content: string, context = {}): Promise<{
    success: boolean;
    operation: string;
    result: any;
  }> => {
    const response = await apiClient.post('/orchestration/knowledge/extract', {
      content,
      context
    });
    return response.data;
  },

  evolveKnowledge: async (existingKnowledge: string, newInformation: string): Promise<{
    success: boolean;
    operation: string;
    result: any;
  }> => {
    const response = await apiClient.post('/orchestration/knowledge/evolve', {
      existingKnowledge,
      newInformation
    });
    return response.data;
  },

  optimizePrompts: async (examples: Array<{
    input: string;
    output: string;
    metadata?: any;
  }>): Promise<{
    success: boolean;
    optimized: boolean;
    improvements: string[];
    performanceGain: number;
  }> => {
    const response = await apiClient.post('/orchestration/optimize/prompts', {
      examples
    });
    return response.data;
  }
};

// Agents API
export const agentsApi = {
  list: async (): Promise<AgentItem[]> => {
    const response = await apiClient.get('/agents');
    return response.data.agents || [];
  },

  create: async (agent: {
    name: string;
    description: string;
    capabilities: string[];
    instructions: string;
    model?: string;
  }): Promise<AgentItem> => {
    const response = await apiClient.post('/agents', agent);
    return response.data.agent;
  },

  update: async (id: string, updates: Partial<AgentItem>): Promise<AgentItem> => {
    const response = await apiClient.put(`/agents/${id}`, updates);
    return response.data.agent;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/agents/${id}`);
  },

  execute: async (id: string, input: string, context = {}): Promise<{
    success: boolean;
    output: string;
    agent: string;
    model: string;
  }> => {
    const response = await apiClient.post(`/agents/${id}/execute`, { input, context });
    return response.data;
  }
};

// Tools API
export const toolsApi = {
  list: async (): Promise<any[]> => {
    const response = await apiClient.get('/tools');
    return response.data.tools || [];
  },

  execute: async (toolName: string, parameters: Record<string, any>): Promise<{
    success: boolean;
    result: any;
    execution_time_ms: number;
  }> => {
    const response = await apiClient.post('/tools/execute', {
      tool_name: toolName,
      parameters
    });
    return response.data;
  },

  executeBuiltin: async (toolName: string, parameters: Record<string, any>): Promise<{
    success: boolean;
    result: any;
  }> => {
    const response = await apiClient.post(`/tools/execute/builtin/${toolName}`, parameters);
    return response.data;
  },

  create: async (tool: {
    tool_name: string;
    description: string;
    input_schema: Record<string, any>;
    output_schema?: Record<string, any>;
    implementation_type: 'sql' | 'function' | 'api' | 'script';
    implementation: string;
    rate_limit?: number;
  }): Promise<any> => {
    const response = await apiClient.post('/tools', tool);
    return response.data.tool;
  }
};

// Performance API
export const performanceApi = {
  getMetrics: async (): Promise<{
    success: boolean;
    metrics: any;
    timestamp: string;
  }> => {
    const response = await apiClient.get('/performance/metrics');
    return response.data;
  },

  getReport: async (format = 'json'): Promise<{
    success: boolean;
    report: any;
    timestamp: string;
  }> => {
    const response = await apiClient.get(`/performance/report?format=${format}`);
    return response.data;
  }
};

// System API
export const systemApi = {
  getStats: async (): Promise<{
    success: boolean;
    stats: {
      activeAgents: number;
      messagestoday: number;
      totalMemories: number;
      cpuUsage: any;
      memoryUsage: any;
      uptime: number;
      typeBreakdown: Record<string, number>;
    };
  }> => {
    const response = await apiClient.get('/stats');
    return response.data;
  },

  getHealth: async (): Promise<{
    status: string;
    timestamp: string;
    uptime: number;
    service: string;
    config: any;
  }> => {
    const response = await apiClient.get('/health');
    return response.data;
  },

  getOllamaStatus: async (): Promise<{
    status: string;
    models: string[];
  }> => {
    const response = await apiClient.get('/ollama/status');
    return response.data;
  }
};

// Supabase Ollama API (Direct Edge Function calls)
export const supabaseOllamaApi = {
  generate: async (request: {
    prompt: string;
    model?: string;
    temperature?: number;
    max_tokens?: number;
    stream?: boolean;
    system?: string;
  }): Promise<{
    response: string;
    model: string;
    usage: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
  }> => {
    const supabaseUrl = 'http://127.0.0.1:54321'; // Local Supabase
    const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
    
    const response = await fetch(`${supabaseUrl}/functions/v1/ollama-assistant`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`,
        'apikey': anonKey
      },
      body: JSON.stringify({
        prompt: request.prompt,
        model: request.model || 'llama3.2:3b',
        temperature: request.temperature || 0.7,
        max_tokens: request.max_tokens || 1000,
        stream: false,
        system: request.system || 'You are a helpful AI assistant.'
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }

    return response.json();
  },

  generateStream: async function* (request: {
    prompt: string;
    model?: string;
    temperature?: number;
    max_tokens?: number;
    system?: string;
  }): AsyncGenerator<string> {
    const supabaseUrl = 'http://127.0.0.1:54321'; // Local Supabase
    const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
    
    const response = await fetch(`${supabaseUrl}/functions/v1/ollama-assistant`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`,
        'apikey': anonKey
      },
      body: JSON.stringify({
        prompt: request.prompt,
        model: request.model || 'llama3.2:3b',
        temperature: request.temperature || 0.7,
        max_tokens: request.max_tokens || 1000,
        stream: true,
        system: request.system || 'You are a helpful AI assistant.'
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      
      // Process all complete lines
      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i].trim();
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (!data.done && data.content) {
              yield data.content;
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
      
      // Keep the last incomplete line in the buffer
      buffer = lines[lines.length - 1];
    }
  },

  healthCheck: async (): Promise<boolean> => {
    try {
      await supabaseOllamaApi.generate({
        prompt: 'Hello',
        max_tokens: 10
      });
      return true;
    } catch (error) {
      console.error('Ollama health check failed:', error);
      return false;
    }
  }
};

// Export default API object
export const api = {
  memory: memoryApi,
  chat: chatApi,
  orchestration: orchestrationApi,
  agents: agentsApi,
  tools: toolsApi,
  performance: performanceApi,
  system: systemApi,
  ollama: supabaseOllamaApi, // Direct Supabase Edge Function access
};

export default api;