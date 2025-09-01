/**
 * LFM2 MLX Service - Direct MLX Integration for LFM2
 * Uses Apple Silicon optimized MLX framework for fast local inference
 */

import { spawn, ChildProcess } from 'child_process';
import { LogContext, log } from '../utils/logger.js';
import { existsSync, writeFileSync } from 'fs';
import { join } from 'path';

export interface LFM2MLXRequest {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  taskType: 'routing' | 'coordination' | 'simple_qa' | 'classification';
}

export interface LFM2MLXResponse {
  content: string;
  tokens: number;
  executionTime: number;
  model: string;
  confidence?: number;
}

class LFM2MLXService {
  private static instance: LFM2MLXService;
  private pythonProcess: ChildProcess | null = null;
  private isInitialized = false;
  private modelPath: string = '';
  private pendingRequests: Map<string, {
    resolve: (response: LFM2MLXResponse) => void;
    reject: (error: Error) => void;
    startTime: number;
  }> = new Map();

  private constructor() {
    this.initialize();
  }

  public static getInstance(): LFM2MLXService {
    if (!LFM2MLXService.instance) {
      LFM2MLXService.instance = new LFM2MLXService();
    }
    return LFM2MLXService.instance;
  }

  private async initialize(): Promise<void> {
    log.info('🍎 Initializing LFM2 with MLX backend', LogContext.AI);
    
    // Check for MLX models directory
    const modelsPath = process.env.MLX_MODELS_PATH || '/Users/christianmerrill/Desktop/universal-ai-tools/models';
    
    // Look for LFM2 model or any small model we can use
    const possibleModels = [
      'mlx-community--Llama-3.2-3B-Instruct-4bit',  // Downloaded model with -- separator
      'mlx-community/Llama-3.2-3B-Instruct-4bit',
      'mlx-community/Mistral-7B-Instruct-v0.2-4bit', 
      'mlx-community/gemma-2b-it-4bit',
      'mlx-community/Phi-3.5-mini-instruct-4bit'
    ];
    
    for (const modelName of possibleModels) {
      const modelPath = join(modelsPath, modelName);
      if (existsSync(modelPath)) {
        this.modelPath = modelPath;
        log.info(`✅ Found MLX model: ${modelName}`, LogContext.AI);
        break;
      }
    }
    
    if (!this.modelPath) {
      log.warn('⚠️ No MLX models found, will download on first use', LogContext.AI);
      this.modelPath = 'mlx-community/Llama-3.2-3B-Instruct-4bit'; // Default to download
    }
    
    // Start the MLX Python bridge
    await this.startMLXBridge();
  }

  private async startMLXBridge(): Promise<void> {
    try {
      const pythonScript = `
import sys
import json
import time
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

try:
    import mlx.core as mx
    import mlx.nn as nn
    from mlx_lm import load, generate
    MLX_AVAILABLE = True
    logger.info("MLX imported successfully")
except ImportError as e:
    MLX_AVAILABLE = False
    logger.error(f"MLX not available: {e}")
    sys.exit(1)

model = None
tokenizer = None
model_path = "${this.modelPath}"

# Load model
try:
    logger.info(f"Loading model: {model_path}")
    model, tokenizer = load(model_path)
    logger.info("Model loaded successfully")
    print(json.dumps({"type": "ready", "model": model_path}))
    sys.stdout.flush()
except Exception as e:
    logger.error(f"Failed to load model: {e}")
    print(json.dumps({"type": "error", "error": str(e)}))
    sys.stdout.flush()
    sys.exit(1)

# Main loop
while True:
    try:
        line = sys.stdin.readline()
        if not line:
            break
        
        request = json.loads(line)
        request_id = request.get('id')
        prompt = request.get('prompt')
        max_tokens = request.get('maxTokens', 128)
        temperature = request.get('temperature', 0.7)
        
        start_time = time.time()
        
        # Generate response
        response = generate(
            model,
            tokenizer,
            prompt,
            max_tokens=max_tokens,
            verbose=False
        )
        
        # Clean response
        if response.startswith(prompt):
            response = response[len(prompt):].strip()
        
        execution_time = (time.time() - start_time) * 1000
        
        result = {
            "type": "response",
            "id": request_id,
            "content": response,
            "tokens": len(tokenizer.encode(response)),
            "executionTime": execution_time,
            "model": model_path.split('/')[-1]
        }
        
        print(json.dumps(result))
        sys.stdout.flush()
        
    except json.JSONDecodeError:
        continue
    except Exception as e:
        error_result = {
            "type": "error",
            "id": request_id if 'request_id' in locals() else None,
            "error": str(e)
        }
        print(json.dumps(error_result))
        sys.stdout.flush()
`;

      // Write the script to a temporary file and execute it
      const tempScriptPath = '/tmp/lfm2-mlx-bridge.py';
      writeFileSync(tempScriptPath, pythonScript);
      
      this.pythonProcess = spawn('python3', [tempScriptPath], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      if (!this.pythonProcess.stdout || !this.pythonProcess.stderr || !this.pythonProcess.stdin) {
        throw new Error('Failed to create Python process stdio');
      }

      // Handle stdout
      this.pythonProcess.stdout.on('data', (data) => {
        const lines = data.toString().split('\n').filter((line: any) => line.trim());
        for (const line of lines) {
          try {
            const response = JSON.parse(line);
            this.handleMLXResponse(response);
          } catch (e) {
            // Not JSON, might be logging
            if (line.includes('INFO') || line.includes('DEBUG')) {
              log.info(`MLX: ${line}`, LogContext.AI);
            }
          }
        }
      });

      // Handle stderr
      this.pythonProcess.stderr.on('data', (data) => {
        const message = data.toString();
        if (message.includes('ERROR')) {
          log.error(`MLX Error: ${message}`, LogContext.AI);
        } else if (message.includes('WARNING')) {
          log.warn(`MLX Warning: ${message}`, LogContext.AI);
        } else {
          log.info(`MLX: ${message}`, LogContext.AI);
        }
      });

      // Handle process exit
      this.pythonProcess.on('exit', (code) => {
        log.warn(`MLX process exited with code ${code}`, LogContext.AI);
        this.pythonProcess = null;
        this.isInitialized = false;
        
        // Reject all pending requests
        this.pendingRequests.forEach((request, id) => {
          request.reject(new Error('MLX process terminated'));
        });
        this.pendingRequests.clear();
      });

      // Wait for ready signal
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('MLX initialization timeout'));
        }, 30000);

        const checkReady = setInterval(() => {
          if (this.isInitialized) {
            clearInterval(checkReady);
            clearTimeout(timeout);
            resolve();
          }
        }, 100);
      });

    } catch (error) {
      log.error('Failed to start MLX bridge:', LogContext.AI, { error });
      throw error;
    }
  }

  private handleMLXResponse(response: any): void {
    if (response.type === 'ready') {
      this.isInitialized = true;
      log.info(`✅ LFM2 MLX ready with model: ${response.model}`, LogContext.AI);
      return;
    }

    if (response.type === 'error') {
      log.error(`MLX error: ${response.error}`, LogContext.AI);
      if (response.id && this.pendingRequests.has(response.id)) {
        const request = this.pendingRequests.get(response.id)!;
        request.reject(new Error(response.error));
        this.pendingRequests.delete(response.id);
      }
      return;
    }

    if (response.type === 'response' && response.id) {
      const request = this.pendingRequests.get(response.id);
      if (request) {
        const executionTime = Date.now() - request.startTime;
        request.resolve({
          content: response.content,
          tokens: response.tokens,
          executionTime: response.executionTime || executionTime,
          model: response.model,
          confidence: this.calculateConfidence(response.content)
        });
        this.pendingRequests.delete(response.id);
      }
    }
  }

  private calculateConfidence(content: string): number {
    // Simple confidence calculation based on response length and coherence
    if (!content || content.length < 10) return 0.3;
    if (content.includes('error') || content.includes('sorry')) return 0.5;
    if (content.length > 50 && content.includes('.')) return 0.9;
    return 0.7;
  }

  public async process(request: LFM2MLXRequest): Promise<LFM2MLXResponse> {
    if (!this.isInitialized || !this.pythonProcess) {
      // Try to reinitialize
      await this.startMLXBridge();
      if (!this.isInitialized) {
        throw new Error('MLX service not initialized');
      }
    }

    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      // Store the pending request
      this.pendingRequests.set(requestId, { resolve, reject, startTime });

      // Build the prompt based on task type
      let prompt = request.prompt;
      if (request.systemPrompt) {
        prompt = `System: ${request.systemPrompt}\n\nUser: ${prompt}\n\nAssistant:`;
      } else if (request.taskType === 'routing') {
        prompt = `Analyze this request and determine which service should handle it: "${prompt}"\n\nService (one of: ollama, openai, anthropic, local):`;
      } else if (request.taskType === 'classification') {
        prompt = `Classify this text into a category: "${prompt}"\n\nCategory:`;
      }

      // Send request to Python process
      const mlxRequest = {
        id: requestId,
        prompt,
        maxTokens: request.maxTokens || 128,
        temperature: request.temperature || 0.7
      };

      this.pythonProcess!.stdin!.write(JSON.stringify(mlxRequest) + '\n');

      // Set timeout
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error('MLX request timeout'));
        }
      }, 30000);
    });
  }

  public async quickResponse(prompt: string, taskType: 'classification' | 'simple_qa' = 'simple_qa'): Promise<LFM2MLXResponse> {
    return this.process({
      prompt,
      taskType,
      maxTokens: taskType === 'classification' ? 20 : 128,
      temperature: taskType === 'classification' ? 0.3 : 0.7
    });
  }

  public async routingDecision(userRequest: string, context: Record<string, any>): Promise<{
    targetService: string;
    confidence: number;
    reasoning: string;
  }> {
    const response = await this.process({
      prompt: userRequest,
      taskType: 'routing',
      maxTokens: 50,
      temperature: 0.5
    });

    // Parse the response to extract routing decision
    const content = response.content.toLowerCase();
    let targetService = 'ollama'; // default
    
    if (content.includes('openai') || content.includes('gpt')) {
      targetService = 'openai';
    } else if (content.includes('anthropic') || content.includes('claude')) {
      targetService = 'anthropic';
    } else if (content.includes('local') || content.includes('llama')) {
      targetService = 'ollama';
    }

    return {
      targetService,
      confidence: response.confidence || 0.7,
      reasoning: response.content.substring(0, 100)
    };
  }

  public isAvailable(): boolean {
    return this.isInitialized && this.pythonProcess !== null;
  }

  public getMetrics() {
    return {
      isAvailable: this.isAvailable(),
      modelPath: this.modelPath,
      pendingRequests: this.pendingRequests.size,
      initialized: this.isInitialized
    };
  }
}

export default LFM2MLXService;
export { LFM2MLXService };