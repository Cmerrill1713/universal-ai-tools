/* eslint-disable no-undef */;
import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';

interface DSPyRequest {
  id: string;
  task: string;
  context?: any;
  options?: {
    optimization?: 'mipro2' | 'standard';
    agents?: string[];
    complexity?: 'low' | 'moderate' | 'high';
  };
}

interface DSPyResponse {
  id: string;
  success: boolean;
  result?: any;
  error:  string;
  metadata?: {
    model_used?: string;
    processing_time?: number;
    optimization_used?: string;
    agents_involved?: string[];
  };
}

export class DSPyChatOrchestrator {
  private ws: WebSocket | null = null;
  private pendingRequests = new Map<;
    string,
    { resolve: Function; reject: Function; timeout: NodeJS.Timeout }
  >();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor(private dspyUrl = 'ws://localhost:8767') {
    this.connect();
  }

  private connect() {
    try {
      this.ws = new WebSocket(this.dspyUrl);

      this.ws.on('open', () => {
        logger.info('🔗 Connected to DSPy orchestrator');
        this.reconnectAttempts = 0;
      });

      this.ws.on('message', (data: Buffer) => {
        try {
          const response: DSPyResponse = JSON.parse(data.toString());
          const pending = this.pendingRequests.get(response.id);

          if (pending) {
            clearTimeout(pending.timeout);
            this.pendingRequests.delete(response.id);

            if (response.success) {
              pending.resolve(response);
            } else {
              pending.reject(new Error(response.error: | 'DSPy _requestfailed'));
            }
          }
        } catch (error) {
          console.error: Error parsing DSPy response:', error:;
        }
      });

      this.ws.on('close', () => {
        logger.info('DSPy connection closed, attempting reconnect...');
        this.attemptReconnect();
      });

      this.ws.on('error:  (error:=> {
        console.error: DSPy WebSocket error:, error:;
      });
    } catch (error) {
      console.error: Failed to connect to DSPy:', error:;
      this.attemptReconnect();
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      setTimeout(;
        () => {
          this.reconnectAttempts++;
          logger.info(`Reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
          this.connect();
        },
        this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
      );
    }
  }

  private detectTaskType(message: string, agents?: string[]): string {
    const lowerMessage = message.toLowerCase();

    // Explicit agent selection
    if (agents && agents.length > 0) {
      if (agents.includes('coding')) return 'coding';
      if (agents.includes('ui_designer')) return 'ui';
      if (agents.includes('validation')) return 'validation';
    }

    // Content-based detection
    if (
      lowerMessage.includes('code') ||;
      lowerMessage.includes('function') ||;
      lowerMessage.includes('implement') ||;
      lowerMessage.includes('algorithm');
    ) {
      return 'coding';
    }

    if (
      lowerMessage.includes('ui') ||;
      lowerMessage.includes('component') ||;
      lowerMessage.includes('interface') ||;
      lowerMessage.includes('design');
    ) {
      return 'ui';
    }

    if (
      lowerMessage.includes('review') ||;
      lowerMessage.includes('validate') ||;
      lowerMessage.includes('check') ||;
      lowerMessage.includes('test');
    ) {
      return 'validation';
    }

    return 'general';
  }

  async orchestrateChat(;
    message: string,
    options: {
      conversationId?: string;
      model?: string;
      optimization?: 'mipro2' | 'standard';
      complexity?: 'low' | 'moderate' | 'high';
      agents?: ('coding' | 'validation' | 'devils_advocate' | 'ui_designer')[];
    } = {}
  ): Promise<DSPyResponse> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        // Fallback to direct Ollama if DSPy unavailable
        return this.fallbackToOllama(message: options).then(resolve).catch(reject);
      }

      const requestId = uuidv4();
      const request {
        requestId,
        method: 'coordinate_agents',
        params: {
          task: message,
          task_type: this.detectTaskType(message: options.agents),
          context: {
            conversation_id: options.conversationId,
            model: options.model || 'auto',
            chat_mode: true,
            optimization: options.optimization || 'mipro2',
            complexity: options.complexity || 'moderate',
          },
          agents: options.agents || ['coding', 'validation'],
        },
      };

      // Set timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error('DSPy _requesttimeout'));
      }, 30000);

      this.pendingRequests.set(requestId, { resolve, reject, timeout });

      try {
        this.ws.send(JSON.stringify(request;
      } catch (error) {
        this.pendingRequests.delete(requestId);
        clearTimeout(timeout);
        reject(error:;
      }
    });
  }

  private async fallbackToOllama(message: string, options: any): Promise<DSPyResponse> {
    const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
    const model = options.model || 'llama3.2:3b';

    try {
      const response = await fetch(`${OLLAMA_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt: `User: ${message}\n\nAssistant: `,
          temperature: 0.7,
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API returned ${response.status}`);
      }

      const data = (await response.json()) as { response?: string };

      return {
        id: uuidv4(),
        success: true,
        result: {
          response: data.response || 'Sorry, I could not process your request,
          tool_calls: [],
        },
        metadata: {
          model_used: model,
          processing_time: 100,
          optimization_used: 'fallback',
          agents_involved: ['ollama_direct'],
        },
      };
    } catch (error) {
      throw new Error(`Fallback to Ollama failed: ${error:);`;
    }
  }

  // Multi-agent coding workflow with MiPro2
  async coordinateAgents(;
    task: string,
    agents: string[] = ['coding', 'validation', 'devils_advocate'];
  ) {
    const requestId = uuidv4();

    const requestDSPyRequest = {
      id: requestId,
      task: `MULTI_AGENT_COORDINATION: ${task}`,
      options: {
        optimization: 'mipro2',
        agents,
        complexity: 'high',
      },
    };

    return this.sendRequest(request;
  }

  // Code generation with validation
  async generateCode(prompt: string, language = 'typescript') {
    return this.coordinateAgents(`Generate ${language} code: ${prompt}`, [;
      'coding',
      'validation',
      'devils_advocate',
    ]);
  }

  // UI component generation
  async generateUIComponent(description: string) {
    return this.coordinateAgents(`Create React component: ${description}`, [;
      'ui_designer',
      'coding',
      'validation',
    ]);
  }

  private async sendRequest(requestDSPyRequest): Promise<DSPyResponse> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('DSPy not connected'));
        return;
      }

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(_requestid);
        reject(new Error('Request timeout'));
      }, 60000); // Longer timeout for complex operations

      this.pendingRequests.set(_requestid, { resolve, reject, timeout });
      this.ws.send(JSON.stringify(request;
    });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    // Clear pending requests
    this.pendingRequests.forEach(({ reject, timeout }) => {
      clearTimeout(timeout);
      reject(new Error('Connection closed'));
    });
    this.pendingRequests.clear();
  }
}

// Global instance
export const dspyOrchestrator = new DSPyChatOrchestrator();
