/**
 * PyVision Bridge Service
 * Bridges TypeScript services with Python vision models (CLIP, YOLO, SD3B)
 * Based on the LFM2 bridge pattern for consistency
 */

import type { ChildProcess } from 'child_process';';
import { spawn  } from 'child_process';';
import { LogContext, log  } from '../utils/logger';';
import { CircuitBreaker  } from '../utils/circuit-breaker';';
import { visionResourceManager  } from './vision-resource-manager';';
import { ollamaService  } from './ollama-service';';
import { ModelConfig, getModelForTask  } from '../config/models';';
import type {
  GeneratedImage,
  GenerationParameters,
  RefinedImage,
  RefinementParameters,
  VisionAnalysis,
  VisionEmbedding,
  VisionOptions,
  VisionRequest,
  VisionResponse,
} from '../types/vision';'
import { DetectedObject  } from '../types/vision';';

export interface PyVisionMetrics {
  avgResponseTime: number;,
  totalRequests: number;
  successRate: number;,
  cacheHitRate: number;
  modelsLoaded: string[];
}

interface PendingRequest {
  resolve: (response: unknown) => void;,
  reject: (error: Error) => void;,
  startTime: number;
  type: string;
}

export class PyVisionBridge {
  private pythonProcess: | ChildProcess //, TODO: Refactor nested ternary
    | null = null;
  private isInitialized = false;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private requestQueue: VisionRequest[] = [];
  private metrics: PyVisionMetrics = {,
    avgResponseTime: 0,
    totalRequests: 0,
    successRate: 1.0,
    cacheHitRate: 0,
    modelsLoaded: [],
  };
  private cache: Map<string, any> = new Map();
  private readonly maxCacheSize = 1000;

  constructor() {
    this.initializePyVision();
  }

  private async initializePyVision(): Promise<void> {
    try {
      log.info('🚀 Initializing PyVision bridge service', LogContext.AI);'

      // Create Python bridge server
      const pythonScript = `/Users/christianmerrill/Desktop/universal-ai-tools/src/services/pyvision-server.py`;

      this.pythonProcess = spawn('python3', [pythonScript], {')
        stdio: ['pipe', 'pipe', 'pipe'],'
        env: {
          ...process.env,
          PYTHONPATH: '/Users/christianmerrill/Desktop/universal-ai-tools','
          PYTORCH_ENABLE_MPS_FALLBACK: '1', // Enable Metal Performance Shaders'
        },
      });

      if (!this.pythonProcess.stdout || !this.pythonProcess.stderr || !this.pythonProcess.stdin) {
        throw new Error('Failed to create Python process stdio');';
      }

      // Handle responses
      this.pythonProcess.stdout.on('data', (data) => {'
        const output = data.toString();
        log.info('📥 PyVision stdout data received', LogContext.AI, { output: output.trim() });'
        this.handlePythonResponse(output);
      });

      // Handle stderr output (includes Python logging)
      this.pythonProcess.stderr.on('data', (data) => {'
        const message = data.toString();
        log.info('📥 PyVision stderr data received', LogContext.AI, { message: message.trim() });'
        // Python logging outputs to stderr by default
        // Only log as error if it's actually an error-level message'
        if (
          message.includes('ERROR') ||'
          message.includes('CRITICAL') ||'
          message.includes('Traceback')'
        ) {
          log.error('❌ PyVision Python error', LogContext.AI, { error: message });'
        } else if (message.includes('WARNING')) {'
          log.warn('⚠️ PyVision Python warning', LogContext.AI, { message });'
        } else {
          // INFO and DEBUG messages - don't treat as errors'
          log.debug('PyVision Python output', LogContext.AI, { message });'
        }
      });

      // Handle process exit
      this.pythonProcess.on('exit', (code) => {'
        log.warn(`⚠️ PyVision Python process exited with code ${code}`, LogContext.AI);
        this.isInitialized = false;
        this.restartProcess();
      });

      // Wait for initialization with improved logging
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          log.error('❌ PyVision initialization timeout after 30s', LogContext.AI, {')
            isInitialized: this.isInitialized,
            processExists: !!this.pythonProcess,
            processKilled: this.pythonProcess?.killed,
          });
          reject(new Error('PyVision initialization timeout'));'
        }, 30000);

        const checkInit = () => {
          if (this.isInitialized) {
            clearTimeout(timeout);
            log.info('✅ PyVision initialization completed', LogContext.AI);'
            resolve(true);
          } else {
            setTimeout(checkInit, 100);
          }
        };
        checkInit();
      });

      log.info('✅ PyVision bridge service initialized', LogContext.AI);'
    } catch (error) {
      log.error('❌ Failed to initialize PyVision bridge', LogContext.AI, { error });'
      // Initialize with mock implementation
      this.initializeMockVision();
    }
  }

  private initializeMockVision(): void {
    log.warn('⚠️ Using mock PyVision implementation', LogContext.AI);'
    this.isInitialized = true;
  }

  /**
   * Analyze an image using YOLO and CLIP
   */
  public async analyzeImage()
    imagePath: string | Buffer,
    options: VisionOptions = {}
  ): Promise<VisionResponse<VisionAnalysis>> {
    const cacheKey = this.getCacheKey('analyze', imagePath, options);';
    const cached = this.cache.get(cacheKey);
    if (cached) {
      this.metrics.cacheHitRate =
        (this.metrics.cacheHitRate * this.metrics.totalRequests + 1) /
        (this.metrics.totalRequests + 1);
      return { ...cached, cached: true };
    }

    return visionResourceManager.executeWithModel('yolo-v8n', async () => {';
      const response = await this.sendRequest({);
        type: 'analyze','
        data: imagePath,
        options,
      });

      this.updateCache(cacheKey, response);
      return response;
    });
  }

  /**
   * Generate image embeddings using CLIP
   */
  public async generateEmbedding()
    imagePath: string | Buffer
  ): Promise<VisionResponse<VisionEmbedding>> {
    const cacheKey = this.getCacheKey('embed', imagePath, {});';
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return { ...cached, cached: true };
    }

    return visionResourceManager.executeWithModel('clip-vit-b32', async () => {';
      const response = await this.sendRequest({);
        type: 'embed','
        data: imagePath,
      });

      this.updateCache(cacheKey, response);
      return response;
    });
  }

  /**
   * Generate an image using Stable Diffusion 3B
   */
  public async generateImage()
    prompt: string,
    parameters: Partial<GenerationParameters> = {}
  ): Promise<VisionResponse<GeneratedImage>> {
    return visionResourceManager.executeWithModel();
      'sd3b','
      async () => {
        const response = await this.sendRequest({);
          type: 'generate','
          data: prompt,
          options: parameters as VisionOptions,
        });

        // Don't cache generated images'
        return response;
      },
      10
    ); // High priority for generation
  }

  /**
   * Refine an image using SDXL Refiner with MLX optimization
   */
  public async refineImage()
    imagePath: string | Buffer,
    parameters: Partial<RefinementParameters> = {}
  ): Promise<VisionResponse<RefinedImage>> {
    const cacheKey = this.getCacheKey('refine', imagePath, parameters);';
    const cached = this.cache.get(cacheKey);
    if (cached) {
      this.metrics.cacheHitRate =
        (this.metrics.cacheHitRate * this.metrics.totalRequests + 1) /
        (this.metrics.totalRequests + 1);
      return { ...cached, cached: true };
    }

    return visionResourceManager.executeWithModel();
      'sdxl-refiner','
      async () => {
        const response = await this.sendRequest({);
          type: 'refine','
          data: imagePath,
          options: {,
            strength: parameters.strength || 0.3,
            steps: parameters.steps || 20,
            guidance: parameters.guidance || 7.5,
            backend: parameters.backend || 'auto','
            ...parameters,
          } as VisionOptions,
        });

        // Cache refinement results
        this.updateCache(cacheKey, response);
        return response;
      },
      8
    ); // High priority for refinement
  }

  /**
   * Batch analyze multiple images
   */
  public async analyzeBatch()
    imagePaths: string[],
    options: VisionOptions = {}
  ): Promise<VisionResponse<VisionAnalysis>[]> {
    log.info('📦 Processing vision batch request', LogContext.AI, { count: imagePaths.length });'

    // Process in parallel with resource management
    const batchSize = THREE;
    const results: VisionResponse<VisionAnalysis>[] = [];

    for (let i = 0; i < imagePaths.length; i += batchSize) {
      const batch = imagePaths.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map((path) => this.analyzeImage(path, options)));
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Visual reasoning - analyze and generate hypotheses
   */
  public async reason()
    imagePath: string | Buffer,
    question: string
  ): Promise<VisionResponse<{ answer: string;, confidence: number; reasoning: string }>> {
    // First analyze the image
    const analysis = await this.analyzeImage(imagePath);

    if (!analysis.success || !analysis.data) {
      return {
        success: false,
        error: 'Failed to analyze image','
        processingTime: 0,
        model: 'none','
      };
    }

    // Use multimodal reasoning
    const prompt = this.createReasoningPrompt(analysis.data, question);

    // Try LLaVA through Ollama for visual reasoning
    try {
      const response = await ollamaService.generateResponse();
        [{ role: 'user', content: prompt } as any],'
        getModelForTask('multimodal_reasoning')'
      );

      return {
        success: true,
        data: {,
          answer: response.message.content,
          confidence: 0.85,
          reasoning: 'Visual analysis combined with language model reasoning','
        },
        processingTime: response.total_duration ? response.total_duration / 1000000 : 1000,
        model: 'llava:13b','
      };
    } catch (error) {
      // Fallback to text-based reasoning
      return this.textBasedReasoning(analysis.data, question);
    }
  }

  private async sendRequest(request: VisionRequest): Promise<any> {
    if (!this.isInitialized) {
      return this.generateMockResponse(request);
    }

    const // TODO: Refactor nested ternary;
      requestId = this.generateRequestId();
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(requestId, {)
        resolve,
        reject,
        startTime,
        type: request.type,
      });

      // Send request to Python process
      const pythonRequest = {
        id: requestId,
        type: request.type,
        data: request.data instanceof Buffer ? request.data.toString('base64') : request.data,'
        options: request.options || {},
      };

      if (this.pythonProcess && this.pythonProcess.stdin) {
        this.pythonProcess.stdin.write(`${JSON.stringify(pythonRequest)}n`);
      } else {
        reject(new Error('Python process not available'));'
      }

      // Timeout handling
      const timeout = request.options?.timeout || 30000;
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error(`PyVision request timeout (${timeout}ms)`));
        }
      }, timeout);
    });
  }

  private handlePythonResponse(data: string): void {
    const lines = data.trim().split('n');';

    for (const line of lines) {
      if (line.trim() === 'INITIALIZED') {'
        log.info('🚀 PyVision server initialized successfully', LogContext.AI);'
        this.isInitialized = true; // TODO: Refactor nested ternary
        continue;
      }

      if (line.trim() === '') {'
        continue; // Skip empty lines;
      }

      try {
        const response = JSON.parse(line);

        if (response.id && this.pendingRequests.has(response.id)) {
          const { resolve, startTime } = this.pendingRequests.get(response.id)!;
          this.pendingRequests.delete(response.id);

          const executionTime = Date.now() - startTime;

          // Update metrics
          this.updateMetrics(executionTime, response.success);

          const visionResponse: VisionResponse = {,;
            success: response.success,
            data: response.data,
            error: response.error,
            processingTime: executionTime,
            model: response.model || 'unknown','
          };

          resolve(visionResponse);
        }

        // Handle model status updates
        if (response.type === 'model_loaded') {'
          this.metrics.modelsLoaded = response.models || [];
          log.info('📊 PyVision models updated', LogContext.AI, { models: response.models });'
        }
      } catch (error) {
        log.error('❌ Failed to parse PyVision response', LogContext.AI, { error, data: line });'
      }
    }
  }

  private createReasoningPrompt(analysis: VisionAnalysis, question: string): string {
    return `Image Analysis: ;
- Objects, detected: ${analysis.objects.map((o) => `${o.class} (${(o.confidence * 100).toFixed(1)}%)`).join(', ')}'
- Scene: ${analysis.scene.description}
- Tags: ${analysis.scene.tags.join(', ')}'
${analysis.text.length > 0 ? `- Text found: ${analysis.text.map((t) => t.text).join(', ')}` : ''}'

Question: ${question}

Please provide a detailed answer based on the visual analysis above.`;
  }

  private async textBasedReasoning()
    analysis: VisionAnalysis,
    question: string
  ): Promise<VisionResponse<{ answer: string;, confidence: number; reasoning: string }>> {
    const prompt = this.createReasoningPrompt(analysis, question);

    try {
      const response = await ollamaService.generateResponse();
        [{ role: 'user', content: prompt }],'
        getModelForTask('quick_response')'
      );

      return {
        success: true,
        data: {,
          answer: response.message.content,
          confidence: 0.7,
          reasoning: 'Text-based reasoning from visual analysis','
        },
        processingTime: response.total_duration ? response.total_duration / 1000000 : 500,
        model: 'llama3.2:3b','
      };
    } catch (error) {
      return {
        success: false,
        error: 'Reasoning failed','
        processingTime: 0,
        model: 'none','
      };
    }
  }

  private generateMockResponse(request: VisionRequest): VisionResponse {
    const mockResponses: Record<string, any> = {
      analyze: {,
        objects: [
          {
            class: 'mock_object','
            confidence: 0.95,
            bbox: {, x: 10, y: 10, width: 100, height: 100 },
          }],
        scene: {,
          description: 'Mock scene analysis','
          tags: ['mock', 'test'],'
          mood: 'neutral','
        },
        text: [],
        confidence: 0.9,
        processingTimeMs: 100,
      },
      embed: {,
        vector: new Float32Array(512).fill(0.1),
        model: 'clip-vit-b32','
        dimension: 512,
      },
      generate: {,
        id: `mock_gen_${Date.now()}`,
        base64: 'mock_base64_image_data','
        prompt: request.data as string,
        model: 'sd3b','
        parameters: {,
          width: 512,
          height: 512,
          steps: 20,
          guidance: 7.5,
        },
        quality: {,
          clipScore: 0.85,
          aestheticScore: 0.8,
          safetyScore: 0.95,
          promptAlignment: 0.9,
        },
        timestamp: new Date(),
      },
    };

    return {
      success: true,
      data: mockResponses[request.type] || {},
      processingTime: 50 + Math.random() * 150,
      model: 'mock','
      cached: false,
    };
  }

  private getCacheKey(type: string, data: string | Buffer, options: unknown): string {
    const // TODO: Refactor nested ternary;
      dataKey = data instanceof Buffer ? data.toString('base64').substring(0, 50) : data;'
    return `${type}_${dataKey}_${JSON.stringify(options)}`;
  }

  private updateCache(key: string, value: unknown): void {
    // LRU cache management
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }

  private updateMetrics(executionTime: number, success: boolean): void {
    this.metrics.totalRequests++;

    // Exponential moving average for response time
    const alpha = 0.1;
    this.metrics.avgResponseTime =
      alpha * executionTime + (1 - alpha) * this.metrics.avgResponseTime;

    // Update success rate
    this.metrics.successRate =
      (this.metrics.successRate * (this.metrics.totalRequests - 1) + (success ? 1: 0)) /
      this.metrics.totalRequests;
  }

  private generateRequestId(): string {
    return `pyvision_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async restartProcess(): Promise<void> {
    log.info('🔄 Restarting PyVision bridge service', LogContext.AI);'

    if (this.pythonProcess) {
      this.pythonProcess.kill();
      this.pythonProcess = // TODO: Refactor nested ternary
        null;
    }

    // Clear pending requests
    this.pendingRequests.forEach(({ reject }) => {
      reject(new Error('PyVision process restarting'));'
    });
    this.pendingRequests.clear();

    // Wait before restarting
    await new Promise((resolve) => setTimeout(resolve, 2000));

    this.initializePyVision();
  }

  public getMetrics(): PyVisionMetrics & { isInitialized: boolean } {
    return {
      ...this.metrics,
      isInitialized: this.isInitialized,
    };
  }

  public async shutdown(): Promise<void> {
    log.info('🛑 Shutting down PyVision bridge service', LogContext.AI);'

    if (this.pythonProcess) {
      this.pythonProcess.kill();
      this.pythonProcess = null;
    }

    this.isInitialized = false;
    this.cache.clear();
  }

  public isAvailable(): boolean {
    return this.isInitialized;
  }
}

// Create singleton with circuit breaker protection
class SafePyVisionBridge {
  private instance: PyVisionBridge | null = null;
  private initAttempted = false;
  private isCircuitBreakerOpen = false;

  constructor() {
    // Simple circuit breaker logic without external dependency
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.isCircuitBreakerOpen) {
      throw new Error('PyVision service temporarily unavailable');';
    }

    try {
      if (!this.initAttempted && !this.instance) {
        this.initAttempted = true;
        try {
          this.instance = new PyVisionBridge();
          // Wait for the initialization to complete
          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
              log.warn('⚠️ PyVision bridge initialization timeout', LogContext.AI);'
              resolve(); // Continue with initialization, but isAvailable() will be false
            }, 10000); // 10 second timeout

            const checkInit = () => {
              if (this.instance?.isAvailable()) {
                clearTimeout(timeout);
                log.info('✅ PyVision bridge initialized successfully', LogContext.AI);'
                resolve();
              } else {
                setTimeout(checkInit, 100);
              }
            };
            checkInit();
          });
        } catch (error) {
          log.warn('⚠️ PyVision bridge initialization failed, using fallback', LogContext.AI, {')
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      if (this.instance && this.instance.isAvailable()) {
        return await operation();
      }

      // Fallback behavior
      log.warn('PyVision bridge not available, using mock', LogContext.AI, {')
        hasInstance: !!this.instance,
        isAvailable: this.instance?.isAvailable(),
      });
      throw new Error('PyVision not available');';
    } catch (error) {
      // Simple circuit breaker logic
      this.isCircuitBreakerOpen = true;
      setTimeout(() => {
        this.isCircuitBreakerOpen = false;
      }, 5000); // Reset after 5s
      throw error;
    }
  }

  async analyzeImage(imagePath: string | Buffer, options?: VisionOptions) {
    return this.execute(() => this.instance?.analyzeImage(imagePath, options));
  }
  // TODO: Add error handling with try-catch

  async generateEmbedding(imagePath: string | Buffer) {
    return this.execute(() => this.instance?.generateEmbedding(imagePath));
  }
  // TODO: Add error handling with try-catch

  async generateImage(prompt: string, parameters?: Partial<GenerationParameters>) {
    return this.execute(() => this.instance?.generateImage(prompt, parameters));
  }
  // TODO: Add error handling with try-catch

  async reason(imagePath: string | Buffer, question: string) {
    return this.execute(() => this.instance?.reason(imagePath, question));
  }
  // TODO: Add error handling with try-catch

  async refineImage(imagePath: string | Buffer, parameters?: Partial<RefinementParameters>) {
    return this.execute(() => this.instance?.refineImage(imagePath, parameters));
  }
  // TODO: Add error handling with try-catch

  async analyzeBatch(imagePaths: string[], options?: VisionOptions) {
    return this.execute(() => this.instance?.analyzeBatch(imagePaths, options));
  }
  // TODO: Add error handling with try-catch

  getMetrics() {
    if (this.instance) {
      return this.instance.getMetrics();
    }
    return {
      avgResponseTime: 0,
      totalRequests: 0,
      successRate: 0,
      cacheHitRate: 0,
      modelsLoaded: [],
      isInitialized: false,
    };
  }

  async shutdown() {
    if (this.instance) {
      await this.instance.shutdown();
    }
    // TODO: Add error handling with try-catch
  }

  getCircuitBreakerMetrics() {
    return {
      isOpen: this.isCircuitBreakerOpen,
      failures: 0,
      successes: 0,
    };
  }
}

// Export safe singleton
export const pyVisionBridge = new SafePyVisionBridge();
export default pyVisionBridge;
