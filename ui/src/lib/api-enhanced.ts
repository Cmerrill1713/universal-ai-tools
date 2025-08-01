import { v4 as uuidv4 } from 'uuid';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:9999';
const API_KEY = import.meta.env.VITE_API_KEY || 'test-api-key-123';

interface ChatResponse {
  message: string;
  conversationId?: string;
  code?: string;
  codeLanguage?: 'javascript' | 'html' | 'react' | 'python';
  componentCode?: string;
  componentType?: 'react' | 'html' | 'canvas';
  agentInfo?: {
    name: string;
    type: string;
    confidence: number;
  };
}

interface HealthResponse {
  status: 'ok' | 'error';
  timestamp: string;
  services?: {
    database: boolean;
    redis: boolean;
    ollama: boolean;
    lmStudio: boolean;
  };
}

class EnhancedAPI {
  private headers = {
    'Content-Type': 'application/json',
    'X-API-Key': API_KEY,
    'X-AI-Service': import.meta.env.VITE_AI_SERVICE || 'universal-ai-ui'
  };
  
  // Session management
  private conversationId: string | null = null;
  private sessionId: string | null = null;
  
  constructor() {
    // Load session from localStorage
    this.conversationId = localStorage.getItem('conversationId');
    this.sessionId = localStorage.getItem('sessionId');
    
    // Generate new session ID if not exists
    if (!this.sessionId) {
      this.sessionId = this.generateId();
      localStorage.setItem('sessionId', this.sessionId);
    }
  }
  
  private generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private isValidUUID(str: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  }
  
  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_URL}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...this.headers,
          ...options.headers
        }
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `Request failed: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`API request failed: ${endpoint}`, error);
      throw error;
    }
  }
  
  // Health check
  async health(): Promise<HealthResponse> {
    return this.request<HealthResponse>('/health');
  }
  
  // Chat endpoints
  async chat(
    message: string, 
    conversationId?: string
  ): Promise<ChatResponse> {
    return this.sendMessage(message, conversationId);
  }

  async sendMessage(
    message: string, 
    conversationId?: string
  ): Promise<ChatResponse> {
    // Prepare the request body
    const requestBody: any = {
      message
    };

    // Only include conversationId if it's a valid UUID
    const targetConversationId = conversationId || this.conversationId;
    if (targetConversationId && this.isValidUUID(targetConversationId)) {
      requestBody.conversationId = targetConversationId;
    }

    const response = await this.request<any>('/api/v1/chat', {
      method: 'POST',
      body: JSON.stringify(requestBody)
    });

    // Handle the actual API response structure
    if (response.success && response.data) {
      // Update conversation ID if provided
      if (response.data.conversationId) {
        this.conversationId = response.data.conversationId;
        localStorage.setItem('conversationId', this.conversationId);
      }

      // Transform the response to match ChatResponse interface
      return {
        message: response.data.message?.content || 'No response',
        conversationId: response.data.conversationId,
        metadata: {
          model: response.data.message?.metadata?.model,
          confidence: response.data.message?.metadata?.confidence,
          tokensUsed: response.data.usage?.tokens,
          executionTime: response.metadata?.executionTime || response.data.usage?.executionTime,
          agent: response.data.message?.metadata?.agentName || response.metadata?.agentName
        }
      };
    } else {
      throw new Error(response.error?.message || 'Chat request failed');
    }
  }
  
  async getChatHistory(conversationId?: string) {
    const id = conversationId || this.conversationId;
    if (!id) {
      return { success: false, messages: [] };
    }
    
    return this.request(`/api/v1/chat/history/${id}`);
  }
  
  // Agent endpoints
  async getAgents() {
    return this.request('/api/v1/agents');
  }
  
  async executeAgent(agentId: string, task: any) {
    return this.request(`/api/v1/agents/${agentId}/execute`, {
      method: 'POST',
      body: JSON.stringify({ task })
    });
  }
  
  // Task execution
  async executeTask(taskData: {
    type: string;
    params: any;
    agents?: string[];
  }) {
    return this.request('/api/v1/ab-mcts/execute', {
      method: 'POST',
      body: JSON.stringify(taskData)
    });
  }
  
  async getTaskStatus(taskId: string) {
    return this.request(`/api/v1/ab-mcts/status/${taskId}`);
  }
  
  // Vision endpoints
  async processImage(imageData: string | File) {
    const formData = new FormData();
    
    if (typeof imageData === 'string') {
      formData.append('image', imageData);
    } else {
      formData.append('image', imageData);
    }
    
    return this.request('/api/v1/vision/process', {
      method: 'POST',
      headers: {
        'X-API-Key': API_KEY,
        'X-AI-Service': import.meta.env.VITE_AI_SERVICE || 'universal-ai-ui'
      },
      body: formData
    });
  }
  
  // MLX endpoints
  async getMLXModels() {
    return this.request('/api/v1/mlx/models');
  }
  
  async fineTuneModel(config: {
    baseModel: string;
    trainingData: any;
    parameters: any;
  }) {
    return this.request('/api/v1/mlx/fine-tune', {
      method: 'POST',
      body: JSON.stringify(config)
    });
  }
  
  // Monitoring endpoints
  async getPerformanceMetrics() {
    return this.request('/api/v1/monitoring/metrics');
  }
  
  async getAgentPerformance(agentId?: string) {
    const endpoint = agentId 
      ? `/api/v1/monitoring/agents/${agentId}`
      : '/api/v1/monitoring/agents';
    return this.request(endpoint);
  }

  async getSystemHealth() {
    return this.request('/api/v1/monitoring/health/detailed');
  }

  async getCircuitBreakers() {
    return this.request('/api/v1/monitoring/circuit-breakers');
  }

  async resetCircuitBreaker(name: string) {
    return this.request(`/api/v1/monitoring/circuit-breakers/${name}/reset`, {
      method: 'POST'
    });
  }

  async getModelPerformance() {
    return this.request('/api/v1/monitoring/models/performance');
  }

  // Vision processing endpoints
  async analyzeImage(imageFile: File, options?: any) {
    const formData = new FormData();
    formData.append('image', imageFile);
    if (options) {
      formData.append('options', JSON.stringify(options));
    }

    return this.request('/api/v1/vision/analyze', {
      method: 'POST',
      headers: {
        'X-API-Key': API_KEY,
        'X-AI-Service': this.headers['X-AI-Service']
      },
      body: formData
    });
  }

  async generateImage(prompt: string, options?: any) {
    return this.request('/api/v1/vision/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt, options })
    });
  }

  async enhanceImage(imageFile: File, options?: any) {
    const formData = new FormData();
    formData.append('image', imageFile);
    if (options) {
      formData.append('options', JSON.stringify(options));
    }

    return this.request('/api/v1/vision/enhance', {
      method: 'POST',
      headers: {
        'X-API-Key': API_KEY,
        'X-AI-Service': this.headers['X-AI-Service']
      },
      body: formData
    });
  }

  async getVisionHealth() {
    return this.request('/api/v1/vision/health');
  }

  async getVisionStatus() {
    return this.request('/api/v1/vision/status');
  }

  // AB-MCTS orchestration endpoints
  async orchestrateTask(userRequest: string, options?: any) {
    return this.request('/api/v1/ab-mcts/orchestrate', {
      method: 'POST',
      body: JSON.stringify({ userRequest, options })
    });
  }

  async getOrchestrationStatus(id: string) {
    return this.request(`/api/v1/ab-mcts/status/${id}`);
  }

  async submitFeedback(orchestrationId: string, rating: number, comment?: string) {
    return this.request('/api/v1/ab-mcts/feedback', {
      method: 'POST',
      body: JSON.stringify({ orchestrationId, rating, comment })
    });
  }

  async getOrchestrationHistory() {
    return this.request('/api/v1/ab-mcts/history');
  }

  // MLX endpoints - Extended
  async mlxInference(modelPath: string, prompt: string, parameters?: any) {
    return this.request('/api/v1/mlx/inference', {
      method: 'POST',
      body: JSON.stringify({ modelPath, prompt, parameters })
    });
  }

  async mlxFineTune(config: any) {
    return this.request('/api/v1/mlx/fine-tune', {
      method: 'POST',
      body: JSON.stringify(config)
    });
  }

  async getMLXHealth() {
    return this.request('/api/v1/mlx/health');
  }

  async getFineTuningJobs() {
    return this.request('/api/v1/mlx/fine-tuning/jobs');
  }

  async getFineTuningJob(jobId: string) {
    return this.request(`/api/v1/mlx/fine-tuning/jobs/${jobId}`);
  }

  // HuggingFace endpoints
  async getHuggingFaceModels() {
    return this.request('/api/v1/huggingface/models');
  }

  async huggingFaceInference(model: string, inputs: any, parameters?: any) {
    return this.request('/api/v1/huggingface/inference', {
      method: 'POST',
      body: JSON.stringify({ model, inputs, parameters })
    });
  }

  async getHuggingFaceHealth() {
    return this.request('/api/v1/huggingface/health');
  }

  // Fast Coordinator endpoints
  async getRoutingDecision(request: any) {
    return this.request('/api/v1/fast-coordinator/routing-decision', {
      method: 'POST',
      body: JSON.stringify(request)
    });
  }

  async executeCoordinated(request: any) {
    return this.request('/api/v1/fast-coordinator/execute', {
      method: 'POST',
      body: JSON.stringify(request)
    });
  }

  async coordinateAgents(request: any) {
    return this.request('/api/v1/fast-coordinator/coordinate-agents', {
      method: 'POST',
      body: JSON.stringify(request)
    });
  }

  async optimizeParameters(request: any) {
    return this.request('/api/v1/fast-coordinator/optimize', {
      method: 'POST',
      body: JSON.stringify(request)
    });
  }

  async getCoordinatorStatus() {
    return this.request('/api/v1/fast-coordinator/status');
  }
  
  // WebSocket connection for real-time updates
  createWebSocket(path: string = '/ws'): WebSocket {
    const wsUrl = API_URL.replace(/^http/, 'ws') + path;
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      // Send authentication
      ws.send(JSON.stringify({
        type: 'auth',
        apiKey: API_KEY,
        sessionId: this.sessionId
      }));
    };
    
    return ws;
  }
  
  // Utility methods
  startNewConversation() {
    this.conversationId = uuidv4();
    localStorage.setItem('conversationId', this.conversationId);
    return this.conversationId;
  }
  
  clearSession() {
    this.conversationId = null;
    this.sessionId = null;
    localStorage.removeItem('conversationId');
    localStorage.removeItem('sessionId');
  }
}

export const api = new EnhancedAPI();