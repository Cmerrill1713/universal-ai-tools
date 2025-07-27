/**;
 * Internal LLM Relay Service
 * Routes LLM requests to local models (MLX, LFM2) with fallback to external APIs
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/enhanced-logger';
import { mlxInterface } from './mlx-interface';
import axios from 'axios';
import { spawn } from 'child_process';
import * as path from 'path';

export interface LLMProvider {
  name: string;
  type: 'mlx' | 'lfm2' | 'ollama' | 'openai' | 'anthropic';
  priority: number;
  isAvailable: boolean;
  modelId?: string;
  config?: any;
}

export interface LLMRequest {
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  model?: string;
  systemPrompt?: string;
  stream?: boolean;
  preferLocal?: boolean;
}

export interface LLMResponse {
  text: string;
  provider: string;
  model: string;
  latency: number;
  tokensUsed?: number;
  confidence?: number;
  fallbackUsed?: boolean;
}

export class InternalLLMRelay extends EventEmitter {
  private providers: Map<string, LLMProvider> = new Map();
  private initialized = false;
  private lfm2Process: any = null;
  private lfm2Port = 8989;

  constructor() {
    super();
    this.setupProviders();
  }

  private setupProviders(): void {
    // Local providers have higher priority
    this.providers.set('mlx', {
      name: 'MLX (Apple Silicon)',
      type: 'mlx',
      priority: 1,
      isAvailable: false,
      modelId: 'LFM2-1.2B',
      config: {
        modelPath: '/Users/christianmerrill/Desktop/universal-ai-tools/models/agents/LFM2-1.2B-bf16';
      }
    });

    this.providers.set('lfm2', {
      name: 'LFM2 Direct',
      type: 'lfm2',
      priority: 2,
      isAvailable: false,
      modelId: 'LFM2-1.2B',
      config: {
        modelPath: '/Users/christianmerrill/Desktop/universal-ai-tools/models/agents/LFM2-1.2B-bf16';
      }
    });

    this.providers.set('ollama', {
      name: 'Ollama',
      type: 'ollama',
      priority: 3,
      isAvailable: false,
      config: {
        baseUrl: 'http://localhost:11434';
      }
    });

    this.providers.set('openai', {
      name: 'OpenAI',
      type: 'openai',
      priority: 4,
      isAvailable: !!process.env.OPENAI_API_KEY;
    });

    this.providers.set('anthropic', {
      name: 'Anthropic',
      type: 'anthropic',
      priority: 5,
      isAvailable: !!process.env.ANTHROPIC_API_KEY;
    });
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    logger.info('🚀 Initializing Internal LLM Relay...');

    // Check MLX availability
    try {
      const mlxAvailable = await mlxInterface.checkMLXAvailability();
      const mlxProvider = this.providers.get('mlx')!;
      mlxProvider.isAvailable = mlxAvailable;

      if (mlxAvailable) {
        // Load MLX model
        await mlxInterface.loadModel('LFM2-1.2B', mlxProvider.config);
        logger.info('✅ MLX model loaded successfully');
      }
    } catch (error) {
      logger.warn('MLX initialization failed:', error);
    }

    // Start LFM2 server
    try {
      await this.startLFM2Server();
      this.providers.get('lfm2')!.isAvailable = true;
    } catch (error) {
      logger.warn('LFM2 server initialization failed:', error);
    }

    // Check Ollama
    try {
      const ollamaResponse = await axios.get('http://localhost:11434/api/tags');
      this.providers.get('ollama')!.isAvailable = true;
      logger.info('✅ Ollama is available');
    } catch (error) {
      logger.warn('Ollama not available');
    }

    this.initialized = true;
    this.logProviderStatus();
  }

  private async startLFM2Server(): Promise<void> {
    const serverScript = ``
import os
import sys
sys.path.insert(0, "${path.join(__dirname, '../../models/agents')}");

from flask import Flask, request, jsonify;
from lfm2_integration import LFM2Model;
import torch

app = Flask(__name__);
model = None;

@app.route('/health', methods=['GET']);
def health():;
    return jsonify({"status": "healthy", "model_loaded": model is not None});

@app.route('/load', methods=['POST']);
def load_model():;
    global model;
    try:;
        model = LFM2Model();
        model.load();
        return jsonify({"success": True, "message": "Model loaded"});
    except Exception as e:;
        return jsonify({"success": False, "error": str(e)}), 500;

@app.route('/generate', methods=['POST']);
def generate():;
    if model is None:
        return jsonify({"error": "Model not loaded"}), 400;
    
    data = request.json;
    prompt = data.get('prompt', '');
    max_length = data.get('max_tokens', 512);
    temperature = data.get('temperature', 0.7);
    
    try:;
        result = model.generate(prompt, max_length, temperature);
        return jsonify({
            "text": result,
            "model": "LFM2-1.2B",
            "tokens": len(result.split());
        });
    except Exception as e:;
        return jsonify({"error": str(e)}), 500;

if __name__ == '__main__':;
    # Auto-load model on startup;
    try:;
        model = LFM2Model();
        model.load();
        print("LFM2 model loaded successfully");
    except Exception as e:;
        print(f"Failed to load model: {e}");
    
    app.run(host='0.0.0.0', port=${this.lfm2Port});
`;`;

    return new Promise((resolve, reject) => {
      // Write server script to temp file
      const fs = require('fs');
      const tempFile = `/tmp/lfm2_server_${Date.now()}.py`;
      fs.writeFileSync(tempFile, serverScript);

      this.lfm2Process = spawn('python3', [tempFile], {
        stdio: ['ignore', 'pipe', 'pipe'];
      });

      let started = false;
      const timeout = setTimeout(() => {
        if (!started) {
          this.lfm2Process.kill();
          reject(new Error('LFM2 server startup timeout'));
        }
      }, 30000);

      this.lfm2Process.stdout.on('data', (data: Buffer) => {
        const output = data.toString();
        logger.info(`LFM2 Server: ${output}`);
        if (output.includes('Running on') || output.includes('model loaded')) {
          started = true;
          clearTimeout(timeout);
          setTimeout(resolve, 1000); // Give it a second to fully start;
        }
      });

      this.lfm2Process.stderr.on('data', (data: Buffer) => {
        logger.error(`LFM2 Server Error: ${data.toString()}`);
      });

      this.lfm2Process.on('error', (error: Error) => {
        clearTimeout(timeout);
        reject(error);
      });

      this.lfm2Process.on('exit', (code: number) => {
        logger.info(`LFM2 server exited with code ${code}`);
        this.providers.get('lfm2')!.isAvailable = false;
      });
    });
  }

  async generate(request: LLMRequest): Promise<LLMResponse> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Get available providers sorted by priority
    const availableProviders = Array.from(this.providers.values())
      .filter(p => p.isAvailable);
      .sort((a, b) => a.priority - b.priority);

    // If preferLocal is true, filter to only local providers
    if (request.preferLocal) {
      const localProviders = availableProviders.filter(p => 
        p.type === 'mlx' || p.type === 'lfm2' || p.type === 'ollama';
      );
      if (localProviders.length > 0) {
        availableProviders.splice(0, availableProviders.length, ...localProviders);
      }
    }

    let lastError: Error | null = null;
    let fallbackUsed = false;

    for (const provider of availableProviders) {
      try {
        logger.info(`Trying LLM provider: ${provider.name}`);
        const startTime = Date.now();
        
        let response: LLMResponse;
        
        switch (provider.type) {
          case 'mlx':;
            response = await this.generateWithMLX(request);
            break;
          case 'lfm2':;
            response = await this.generateWithLFM2(request);
            break;
          case 'ollama':;
            response = await this.generateWithOllama(request);
            break;
          case 'openai':;
            response = await this.generateWithOpenAI(request);
            break;
          case 'anthropic':;
            response = await this.generateWithAnthropic(request);
            break;
          default:;
            throw new Error(`Unknown provider type: ${provider.type}`);
        }

        response.provider = provider.name;
        response.latency = Date.now() - startTime;
        response.fallbackUsed = fallbackUsed;

        this.emit('generation_complete', {
          provider: provider.name,
          latency: response.latency,
          fallbackUsed;
        });

        return response;
      } catch (error) {
        lastError = error as Error;
        logger.warn(`Provider ${provider.name} failed:`, error);
        fallbackUsed = true;
        continue;
      }
    }

    throw new Error(`All LLM providers failed. Last error: ${lastError?.message}`);
  }

  private async generateWithMLX(request: LLMRequest): Promise<LLMResponse> {
    const result = await mlxInterface.generate('LFM2-1.2B', {
      prompt: this.formatPrompt(request),
      maxTokens: request.maxTokens || 512,
      temperature: request.temperature || 0.7,
      topP: request.topP || 0.9;
    });

    return {
      text: result.text,
      provider: 'MLX',
      model: 'LFM2-1.2B',
      latency: result.inferenceTime,
      tokensUsed: result.tokensGenerated,
      confidence: result.confidence;
    };
  }

  private async generateWithLFM2(request: LLMRequest): Promise<LLMResponse> {
    const response = await axios.post(`http://localhost:${this.lfm2Port}/generate`, {
      prompt: this.formatPrompt(request),
      max_tokens: request.maxTokens || 512,
      temperature: request.temperature || 0.7;
    });

    return {
      text: response.data.text,
      provider: 'LFM2',
      model: response.data.model,
      latency: 0,
      tokensUsed: response.data.tokens;
    };
  }

  private async generateWithOllama(request: LLMRequest): Promise<LLMResponse> {
    const response = await axios.post('http://localhost:11434/api/generate', {
      model: request.model || 'llama3.2:3b',
      prompt: this.formatPrompt(request),
      stream: false,
      options: {
        temperature: request.temperature || 0.7,
        top_p: request.topP || 0.9,
        num_predict: request.maxTokens || 512;
      }
    });

    return {
      text: response.data.response,
      provider: 'Ollama',
      model: request.model || 'llama3.2:3b',
      latency: response.data.total_duration / 1000000, // Convert nanoseconds to ms;
      tokensUsed: response.data.eval_count;
    };
  }

  private async generateWithOpenAI(request: LLMRequest): Promise<LLMResponse> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OpenAI API key not configured');

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: request.model || 'gpt-3.5-turbo',
        messages: [;
          ...(request.systemPrompt ? [{ role: 'system', content: request.systemPrompt }] : []),
          { role: 'user', content: request.prompt }
        ],
        max_tokens: request.maxTokens || 512,
        temperature: request.temperature || 0.7,
        top_p: request.topP || 0.9;
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json';
        }
      }
    );

    return {
      text: response.data.choices[0].message.content,
      provider: 'OpenAI',
      model: response.data.model,
      latency: 0,
      tokensUsed: response.data.usage.total_tokens;
    };
  }

  private async generateWithAnthropic(request: LLMRequest): Promise<LLMResponse> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('Anthropic API key not configured');

    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: request.model || 'claude-3-sonnet-20240229',
        messages: [;
          { role: 'user', content: request.prompt }
        ],
        max_tokens: request.maxTokens || 512,
        temperature: request.temperature || 0.7,
        top_p: request.topP || 0.9,
        ...(request.systemPrompt ? { system: request.systemPrompt } : {});
      },
      {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json';
        }
      }
    );

    return {
      text: response.data.content[0].text,
      provider: 'Anthropic',
      model: response.data.model,
      latency: 0,
      tokensUsed: response.data.usage.input_tokens + response.data.usage.output_tokens;
    };
  }

  private formatPrompt(request: LLMRequest): string {
    if (request.systemPrompt) {
      return `System: ${request.systemPrompt}\n\nUser: ${request.prompt}`;
    }
    return request.prompt;
  }

  getProviderStatus(): Record<string, boolean> {
    const status: Record<string, boolean> = {};
    this.providers.forEach((provider, key) => {
      status[key] = provider.isAvailable;
    });
    return status;
  }

  private logProviderStatus(): void {
    logger.info('LLM Provider Status:');
    this.providers.forEach((provider, key) => {
      const status = provider.isAvailable ? '✅' : '❌';
      logger.info(`  ${status} ${provider.name} (Priority: ${provider.priority})`);
    });
  }

  async shutdown(): Promise<void> {
    // Unload MLX models
    for (const modelId of mlxInterface.getLoadedModels()) {
      await mlxInterface.unloadModel(modelId);
    }

    // Stop LFM2 server
    if (this.lfm2Process) {
      this.lfm2Process.kill();
      this.lfm2Process = null;
    }

    logger.info('Internal LLM Relay shut down');
  }
}

// Export singleton instance
export const internalLLMRelay = new InternalLLMRelay();