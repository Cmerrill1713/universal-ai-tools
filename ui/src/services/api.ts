const API_URL = 'http://localhost:9999';

interface ApiConfig {
  apiKey: string;
  serviceName: string;
}

class ApiService {
  private config: ApiConfig | null = null;

  setConfig(config: ApiConfig) {
    this.config = config;
  }

  private getHeaders() {
    // Use default local service config if not set
    const config = this.config || {
      apiKey: 'local-dev-key',
      serviceName: 'local-ui'
    };

    return {
      'Content-Type': 'application/json',
      'X-API-Key': config.apiKey,
      'X-AI-Service': config.serviceName,
    };
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `Request failed with status ${response.status}`);
    }

    return response.json();
  }

  // Memory API
  async storeMemory(memory: {
    key: string;
    content: any;
    metadata?: any;
    embedding?: number[];
  }) {
    return this.request('/api/memory', {
      method: 'POST',
      body: JSON.stringify(memory),
    });
  }

  async retrieveMemory(key: string) {
    return this.request(`/api/memory?key=${encodeURIComponent(key)}`);
  }

  async searchMemory(query: string, limit = 10) {
    return this.request('/api/memory/search', {
      method: 'POST',
      body: JSON.stringify({ query, limit }),
    });
  }

  async getAllMemories(limit = 50, offset = 0) {
    return this.request(`/api/memory?limit=${limit}&offset=${offset}`);
  }

  // Tools API
  async listTools() {
    return this.request('/api/tools');
  }

  async executeTool(toolName: string, parameters: any) {
    return this.request('/api/tools/execute', {
      method: 'POST',
      body: JSON.stringify({ tool_name: toolName, parameters }),
    });
  }

  async createTool(tool: {
    tool_name: string;
    description: string;
    parameters: any;
    implementation: string;
  }) {
    return this.request('/api/tools', {
      method: 'POST',
      body: JSON.stringify(tool),
    });
  }

  // Context API
  async saveContext(type: string, key: string, value: any) {
    return this.request('/api/context', {
      method: 'POST',
      body: JSON.stringify({ type, key, value }),
    });
  }

  async getContext(type: string, key: string) {
    return this.request(`/api/context/${type}/${key}`);
  }

  async updateContext(type: string, key: string, value: any) {
    return this.request(`/api/context/${type}/${key}`, {
      method: 'PUT',
      body: JSON.stringify({ value }),
    });
  }

  // Knowledge API
  async addKnowledge(knowledge: {
    topic: string;
    content: string;
    source?: string;
    confidence?: number;
  }) {
    return this.request('/api/knowledge', {
      method: 'POST',
      body: JSON.stringify(knowledge),
    });
  }

  async searchKnowledge(query: string, limit = 10) {
    return this.request('/api/knowledge/search', {
      method: 'POST',
      body: JSON.stringify({ query, limit }),
    });
  }

  async verifyKnowledge(id: string, isVerified: boolean) {
    return this.request(`/api/knowledge/${id}/verify`, {
      method: 'PUT',
      body: JSON.stringify({ is_verified: isVerified }),
    });
  }

  // Assistant API (no auth required)
  async suggestTools(request: string) {
    const response = await fetch(`${API_URL}/api/assistant/suggest-tools`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ request }),
    });

    if (!response.ok) {
      throw new Error('Failed to get tool suggestions');
    }

    return response.json();
  }

  async generateIntegration(language: string, framework: string, purpose: string) {
    const response = await fetch(`${API_URL}/api/assistant/generate-integration`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ language, framework, purpose }),
    });

    if (!response.ok) {
      throw new Error('Failed to generate integration code');
    }

    return response.json();
  }

  async analyzeCodebase(structure: any) {
    const response = await fetch(`${API_URL}/api/assistant/analyze-codebase`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ structure }),
    });

    if (!response.ok) {
      throw new Error('Failed to analyze codebase');
    }

    return response.json();
  }

  async createToolImplementation(name: string, description: string, requirements: string[], save = false) {
    const response = await fetch(`${API_URL}/api/assistant/create-tool`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, description, requirements, save }),
    });

    if (!response.ok) {
      throw new Error('Failed to create tool implementation');
    }

    return response.json();
  }
}

export const api = new ApiService();