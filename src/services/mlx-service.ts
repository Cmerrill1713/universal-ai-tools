/**
 * MLX Service - Apple Silicon Optimized ML Framework
 * Provides fine-tuning and inference capabilities using MLX
 */

import type { ChildProcess } from 'child_process';';
import { spawn  } from 'child_process';';
import { LogContext, log  } from '../utils/logger';';
import { CircuitBreaker  } from '../utils/circuit-breaker';';
import { existsSync, readFileSync, writeFileSync  } from 'fs';';
import { dirname, join  } from 'path';';
import { fileURLToPath  } from 'url';';

// ES Module compatibility for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface MLXConfig {
  pythonPath?: string;
  modelsPath?: string;
  timeout?: number;
}

export interface FineTuningRequest {
  modelName: string;,
  datasetPath: string;
  outputPath: string;
  hyperparameters?: {
    learningRate?: number;
    batchSize?: number;
    epochs?: number;
    maxSeqLength?: number;
    gradientAccumulation?: number;
  };
  validation?: {
    splitRatio?: number;
    validationPath?: string;
  };
}

export interface InferenceRequest {
  modelPath: string;,
  prompt: string;
  parameters?: {
    maxTokens?: number;
    temperature?: number;
    topP?: number;
    rawPrompt?: boolean;
  };
}

export interface MLXMetrics {
  totalInferences: number;,
  totalTrainingJobs: number;
  successfulInferences: number;,
  successfulTrainingJobs: number;
  averageInferenceTime: number;,
  modelsLoaded: string[];
  isInitialized: boolean;,
  hardwareInfo: {
    device: string;,
    memory: string;
    unified: boolean;
  };
}

interface PendingRequest {
  resolve: (response: unknown) => void;,
  reject: (error: Error) => void;,
  startTime: number;
  type: string;
}

export class MLXService {
  private config: MLXConfig;
  private pythonProcess: | ChildProcess //, TODO: Refactor nested ternary
    | null = null;
  private isInitialized = false;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private metrics: MLXMetrics;
  private modelsPath: string;
  private circuitBreaker: CircuitBreaker<any>;

  constructor(config: MLXConfig = {}) {
    this.config = {
      pythonPath: config.pythonPath || 'python3','
      modelsPath: config.modelsPath || '/Users/christianmerrill/Desktop/universal-ai-tools/models','
      timeout: config.timeout || 300000, // 5 minutes for training
    };

    this.modelsPath = this.config.modelsPath!;

    // Initialize circuit breaker
    this.circuitBreaker = new CircuitBreaker<any>('mlx-service', {'
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 30000,
      errorThresholdPercentage: 60,
      volumeThreshold: 5,
    });

    this.metrics = {
      totalInferences: 0,
      totalTrainingJobs: 0,
      successfulInferences: 0,
      successfulTrainingJobs: 0,
      averageInferenceTime: 0,
      modelsLoaded: [],
      isInitialized: false,
      hardwareInfo: {,
        device: 'unknown','
        memory: 'unknown','
        unified: false,
      },
    };

    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      log.info('🍎 Initializing MLX service for Apple Silicon', LogContext.AI);'

      // Check MLX installation
      await this.checkMLXInstallation();

      // Start MLX Python bridge
      await this.startMLXBridge();

      this.isInitialized = true;
      this.metrics.isInitialized = true;

      log.info('✅ MLX service initialized successfully', LogContext.AI);'
    } catch (error) {
      log.error('❌ Failed to initialize MLX service', LogContext.AI, {')
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async checkMLXInstallation(): Promise<void> {
    return new Promise((resolve, reject) => {
      const checkProcess = spawn(this.config.pythonPath!, [);
        '-c','
        'import mlx.core as mx; import mlx_lm; print("MLX_AVAILABLE")','"
      ]);

      let output = '';';
      let errorOutput = '';';

      checkProcess.stdout?.on('data', (data) => {'
        output += data.toString();
      });

      checkProcess.stderr?.on('data', (data) => {'
        errorOutput += data.toString();
      });

      checkProcess.on('close', (code) => {'
        if (code === 0 && output.includes('MLX_AVAILABLE')) {'
          log.info('✅ MLX framework detected and available', LogContext.AI);'
          resolve();
        } else {
          const error = new Error(`MLX not available: ${errorOutput}`);
          log.error('❌ MLX framework not found', LogContext.AI, {')
            error: errorOutput,
            suggestion: 'Install, with: pip install mlx-lm','
          });
          reject(error);
        }
      });
    });
  }

  private async startMLXBridge(): Promise<void> {
    return new Promise((resolve, reject) => {
      const // TODO: Refactor nested ternary;
        scriptPath = join(__dirname, 'mlx-bridge.py');'

      // Create MLX bridge script if it doesn't exist'
      if (!existsSync(scriptPath)) {
        this.createMLXBridgeScript(scriptPath);
      }

      this.pythonProcess = spawn(this.config.pythonPath!, [scriptPath], {)
        stdio: ['pipe', 'pipe', 'pipe'],'
        env: {
          ...process.env,
          PYTHONPATH: join(__dirname, '..', '..'),'
        },
      });

      if (!this.pythonProcess.stdout || !this.pythonProcess.stderr || !this.pythonProcess.stdin) {
        reject(new Error('Failed to create MLX Python process stdio'));'
        return;
      }

      // Handle responses
      this.pythonProcess.stdout.on('data', (data) => {'
        this.handlePythonResponse(data.toString());
      });

      // Handle stderr output (includes Python logging)
      this.pythonProcess.stderr.on('data', (data) => {'
        const message = data.toString();
        // Python logging outputs to stderr by default
        // Only log as error if it's actually an error-level message'
        if (
          message.includes('ERROR') ||'
          message.includes('CRITICAL') ||'
          message.includes('Traceback')'
        ) {
          log.error('❌ MLX Python bridge error', LogContext.AI, { error: message });'
        } else if (message.includes('WARNING')) {'
          log.warn('⚠️ MLX Python bridge warning', LogContext.AI, { message });'
        } else {
          // INFO and DEBUG messages - don't treat as errors'
          log.debug('MLX Python bridge output', LogContext.AI, { message });'
        }
      });

      // Handle process exit
      this.pythonProcess.on('exit', (code) => {'
        log.warn(`⚠️ MLX Python bridge exited with code ${code}`, LogContext.AI);
        this.isInitialized = false;
        this.metrics.isInitialized = false;
      });

      // Wait for initialization
      const timeout = setTimeout(() => {
        reject(new Error('MLX bridge initialization timeout'));'
      }, 30000);

      const checkInit = () => {
        if (this.isInitialized) {
          clearTimeout(timeout);
          resolve();
        } else {
          setTimeout(checkInit, 100);
        }
      };
      checkInit();
    });
  }

  private createMLXBridgeScript(scriptPath: string): void {
    const script = `#!/usr/bin/env python3;
""""
MLX Bridge Server
Handles MLX fine-tuning and inference requests
""""

import sys;
import json;
import time;
import logging;
from typing import Dict, Any, Optional

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - MLX - %(levelname)s - %(message)s')'
logger = logging.getLogger(__name__)

try: import mlx.core as mx;
    import mlx.nn as nn;
    from mlx_lm import load, generate
    from mlx_lm.utils import generate_text
    MLX_AVAILABLE = True
except ImportError as e: MLX_AVAILABLE = False
    logger.error(f"MLX not available: {e}")"

class MLXBridge: def __init__(self):
        self.models = {}
        self.is_ready = False
        
    def initialize(self):
        if not MLX_AVAILABLE: raise RuntimeError("MLX not available")"
        
        logger.info("🍎 Initializing MLX bridge...")"
        self.is_ready = True
        print("INITIALIZED", flush=True)"
        logger.info("✅ MLX bridge ready")"
    
    def load_model(self, model_path: str) ->, bool: try:
            logger.info(f"📥 Loading model from {model_path}")"
            model, tokenizer = load(model_path)
            self.models[model_path] = {'model': model, 'tokenizer': tokenizer}'
            logger.info(f"✅ Model loaded: {model_path}")"
            return True;
        except Exception as e: logger.error(f"❌ Failed to load model {model_path}: {e}")"
            return False;
    
    def inference(self, request: Dict[str, Any]) -> Dict[str, Any]:
        try: model_path = request['modelPath']'
            prompt = request['prompt']'
            params = request.get('parameters', {})'
            
            # Load model if not already loaded
            if model_path not in self.models: if not self.load_model(model_path):
                    return {'success': False, 'error': f'Failed to load model {model_path}'}';
            
            model_info = self.models[model_path]
            model = model_info['model']'
            tokenizer = model_info['tokenizer']'
            
            # Generate text
            response = generate()
                model=model,
                tokenizer=tokenizer,
                prompt=prompt,
                max_tokens=params.get('maxTokens', 256),'
                temp=params.get('temperature', 0.7),'
                top_p=params.get('topP', 0.9),'
                verbose=False
            )
            
            # Clean response
            if response.startswith(prompt):
                response = response[len(prompt):].strip()
            
            return {
                'success': True,'
                'data': {'
                    'text': response,'
                    'model': model_path,'
                    'prompt': prompt'
                }
            }
            
        except Exception as e: logger.error(f"❌ Inference, failed: {e}")"
            return {'success': False, 'error': str(e)}';
    
    def fine_tune(self, request: Dict[str, Any]) -> Dict[str, Any]:
        # Placeholder for fine-tuning implementation
        return {
            'success': False,'
            'error': 'Fine-tuning not yet implemented''
        }
    
    def process_request(self, request: Dict[str, Any]) -> Dict[str, Any]:
        request_id = request.get('id', 'unknown')'
        request_type = request.get('type', 'unknown')'
        
        try: if request_type == 'inference':'
                result = self.inference(request)
            elif request_type == 'fine_tune':'
                result = self.fine_tune(request)
            else: result = {'success': False, 'error': f'Unknown request type: {request_type}'}'
            
            result['id'] = request_id'
            return result;
            
        except Exception as e: return {
                'id': request_id,'
                'success': False,'
                'error': str(e)'
            }
    
    def run(self):
        logger.info("🏃 Starting MLX bridge server...")"
        
        while True:  , try: line = sys.stdin.readline()
                if not line: break
                
                request = json.loads(line.strip())
                response = self.process_request(request)
                print(json.dumps(response), flush=True)
                
            except json.JSONDecodeError as e: logger.error(f"❌ Invalid, JSON: {e}")"
            except KeyboardInterrupt: logger.info("⏹️ Shutting down MLX bridge...")"
                break
            except Exception as e: logger.error(f"❌ Unexpected, error: {e}")"

if __name__ == "__main__":"
    bridge = MLXBridge()
    bridge.initialize()
    bridge.run()
`;

    writeFileSync(scriptPath, script, 'utf8');'
    log.info('✅ MLX bridge script created', LogContext.AI, { path: scriptPath });'
  }

  private handlePythonResponse(data: string): void {
    const lines = data.trim().split('n');';

    for (const line of lines) {
      if (line.trim() === 'INITIALIZED') {'
        log.info('🍎 MLX bridge initialized', LogContext.AI);'
        this.isInitialized = true;
        this.detectHardware();
        continue;
      }

      if (line.trim() === '') continue;'

      try {
        const response = JSON.parse(line);

        if (response.id && this.pendingRequests.has(response.id)) {
          const { resolve, startTime } = this.pendingRequests.get(response.id)!;
          this.pendingRequests.delete(response.id);

          const executionTime = Date.now() - startTime;
          this.updateMetrics(executionTime, response.success);

          resolve(response);
        }
      } catch (error) {
        log.error('❌ Failed to parse MLX response', LogContext.AI, { error, data: line });'
      }
    }
  }

  private detectHardware(): void {
    // Detect Apple Silicon hardware
    this.metrics.hardwareInfo = {
      device: 'Apple Silicon','
      memory: 'Unified Memory','
      unified: true,
    };

    log.info('🍎 Hardware detected', LogContext.AI, this.metrics.hardwareInfo);'
  }

  /**
   * Run inference on a model
   */
  public async runInference(request: InferenceRequest): Promise<any> {
    return this.circuitBreaker.execute(async () => {
      if (!this.isInitialized) {
        throw new Error('MLX service not initialized');';
      }

      const requestId = `mlx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const startTime = Date.now();

      return new Promise((resolve, reject) => {
        this.pendingRequests.set(requestId, {)
          resolve,
          reject,
          startTime,
          type: 'inference','
        });

        const mlxRequest = {
          id: requestId,
          type: 'inference','
          modelPath: request.modelPath,
          prompt: request.prompt,
          parameters: request.parameters || {},
        };

        if (this.pythonProcess && this.pythonProcess.stdin) {
          this.pythonProcess.stdin.write(`${JSON.stringify(mlxRequest)}n`);
        } else {
          reject(new Error('MLX Python process not available'));'
        }

        // Timeout handling
        setTimeout(() => {
          if (this.pendingRequests.has(requestId)) {
            this.pendingRequests.delete(requestId);
            reject(new Error('MLX inference timeout'));'
          }
        }, this.config.timeout);
      });
    });
  }

  /**
   * Fine-tune a model
   */
  public async fineTuneModel(request: FineTuningRequest): Promise<any> {
    return this.circuitBreaker.execute(async () => {
      if (!this.isInitialized) {
        throw new Error('MLX service not initialized');';
      }

      log.info('🎯 Starting MLX fine-tuning job', LogContext.AI, {')
        model: request.modelName,
        dataset: request.datasetPath,
      });

      const requestId = `mlx_ft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const startTime = Date.now();

      return new Promise((resolve, reject) => {
        this.pendingRequests.set(requestId, {)
          resolve,
          reject,
          startTime,
          type: 'fine_tune','
        });

        const mlxRequest = {
          id: requestId,
          type: 'fine_tune','
          ...request,
        };

        if (this.pythonProcess && this.pythonProcess.stdin) {
          this.pythonProcess.stdin.write(`${JSON.stringify(mlxRequest)}n`);
        } else {
          reject(new Error('MLX Python process not available'));'
        }

        // Extended timeout for training
        setTimeout(() => {
          if (this.pendingRequests.has(requestId)) {
            this.pendingRequests.delete(requestId);
            reject(new Error('MLX fine-tuning timeout'));'
          }
        }, this.config.timeout! * 4); // 20 minutes for training
      });
    });
  }

  /**
   * List available models
   */
  public async listModels(): Promise<any> {
    try {
      const modelPaths = [join(this.modelsPath, 'agents'), join(this.modelsPath, 'fine-tuned')];';

      const models = [];
      for (const path of modelPaths) {
        if (existsSync(path)) {
          const { readdirSync, statSync } = require('fs');';
          const entries = readdirSync(path);

          for (const entry of entries) {
            const fullPath = join(path, entry);
            if (statSync(fullPath).isDirectory()) {
              models.push({)
                name: entry,
                path: fullPath,
                type: path.includes('fine-tuned') ? 'fine-tuned' : 'base','
                available: true,
              });
            }
          }
        }
      }

      return {
        success: true,
        data: {
          models,
          modelsPath: this.modelsPath,
          total: models.length,
        },
      };
    } catch (error) {
      log.error('❌ Failed to list MLX models', LogContext.AI, { error });'
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get service metrics
   */
  public getMetrics(): MLXMetrics {
    return { ...this.metrics };
  }

  /**
   * Health check
   */
  public async healthCheck(): Promise<any> {
    try {
      if (!this.isInitialized) {
        return {
          status: 'initializing','
          healthy: false,
          error: 'Service not initialized','
        };
      }

      return {
        status: 'healthy','
        healthy: true,
        metrics: this.getMetrics(),
        hardware: this.metrics.hardwareInfo,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy','
        healthy: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private updateMetrics(executionTime: number, success: boolean): void {
    this.metrics.totalInferences++;

    if (success) {
      this.metrics.successfulInferences++;
    }

    // Update average response time
    const alpha = 0.1;
    this.metrics.averageInferenceTime =
      alpha * executionTime + (1 - alpha) * this.metrics.averageInferenceTime;
  }

  /**
   * Shutdown the service
   */
  public async shutdown(): Promise<void> {
    log.info('🛑 Shutting down MLX service', LogContext.AI);'

    if (this.pythonProcess) {
      this.pythonProcess.kill();
      this.pythonProcess = null;
    }

    this.isInitialized = false;
    this.metrics.isInitialized = false;
  }
}

// Create singleton instance
export const mlxService = new MLXService();
export default mlxService;
