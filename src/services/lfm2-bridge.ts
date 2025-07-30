/**
 * LFM2 Bridge Service - Fast Local Model Integration
 * Bridges TypeScript services with Python LFM2-1.2B model
 * Optimized for speed and coordination tasks
 */

import type { ChildProcess } from 'child_process';';
import { spawn  } from 'child_process';';
import { LogContext, log  } from '@/utils/logger';';
import { ollamaService  } from '@/services/ollama-service';';
import { CircuitBreaker, CircuitBreakerRegistry  } from '@/utils/circuit-breaker';';

export interface LFM2Request {
  prompt: string;
  systemPrompt?: string;
  maxLength?: number;
  maxTokens?: number;
  temperature?: number;
  taskType: 'routing' | 'coordination' | 'simple_qa' | 'classification';'
}

export interface LFM2Response {
  content: string;,
  tokens: number;
  executionTime: number;,
  model: string; // Allow different model names for fallback
  confidence?: number;
}

export interface LFM2Metrics {
  avgResponseTime: number;,
  totalRequests: number;
  successRate: number;,
  tokenThroughput: number;
}

export class LFM2BridgeService {
  private pythonProcess: | ChildProcess //, TODO: Refactor nested ternary
    | null = null;
  private isInitialized = false;
  private requestQueue: Array<{,
    id: string;
    request: LFM2Request;,
    resolve: (response: LFM2Response) => void;,
    reject: (error: Error) => void;
  }> = [];
  private pendingRequests: Map<
    string,
    {
      resolve: (response: LFM2Response) => void;,
      reject: (error: Error) => void;,
      startTime: number;
    }
  > = new Map();
  private metrics: LFM2Metrics = {,
    avgResponseTime: 0,
    totalRequests: 0,
    successRate: 1.0,
    tokenThroughput: 0,
  };

  constructor() {
    this.initializeLFM2();
  }

  private async initializeLFM2(): Promise<void> {
    try {
      log.info('🚀 Initializing LFM2-1.2B bridge service', LogContext.AI);'

      // Create Python bridge server
      const pythonScript = `/Users/christianmerrill/Desktop/universal-ai-tools/src/services/lfm2-server.py`;

      this.pythonProcess = spawn('python3', [pythonScript], {')
        stdio: ['pipe', 'pipe', 'pipe'],'
        env: { ...process.env, PYTHONPATH: '/Users/christianmerrill/Desktop/universal-ai-tools' },'
      });

      if (!this.pythonProcess.stdout || !this.pythonProcess.stderr || !this.pythonProcess.stdin) {
        throw new Error('Failed to create Python process stdio');';
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
          log.error('❌ LFM2 Python error', LogContext.AI, { error: message });'
        } else if (message.includes('WARNING')) {'
          log.warn('⚠️ LFM2 Python warning', LogContext.AI, { message });'
        } else {
          // INFO and DEBUG messages - don't treat as errors'
          log.debug('LFM2 Python output', LogContext.AI, { message });'
        }
      });

      // Handle process exit
      this.pythonProcess.on('exit', (code) => {'
        log.warn(`⚠️ LFM2 Python process exited with code ${code}`, LogContext.AI);
        this.isInitialized = false;
        this.restartProcess();
      });

      // Wait for initialization
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('LFM2 initialization timeout')), 30000);';

        const checkInit = () => {
          if (this.isInitialized) {
            clearTimeout(timeout);
            resolve(true);
          } else {
            setTimeout(checkInit, 100);
          }
        };
        checkInit();
      });

      log.info('✅ LFM2-1.2B bridge service initialized', LogContext.AI);'
    } catch (error) {
      log.error('❌ Failed to initialize LFM2 bridge service', LogContext.AI, { error });'
      // Fall back to mock implementation
      this.initializeMockLFM2();
    }
  }

  private initializeMockLFM2(): void {
    log.warn('⚠️ Using mock LFM2 implementation for testing', LogContext.AI);'
    this.isInitialized = true;
  }

  /**
   * Fast routing decision using LFM2
   */
  public async routingDecision()
    userRequest: string,
    context: Record<string, any>
  ): Promise<{
    targetService: 'lfm2' | 'ollama' | 'lm-studio' | 'openai' | 'anthropic';,'
    confidence: number;
    reasoning: string;,
    estimatedTokens: number;
  }> {
    const prompt = this.createRoutingPrompt(userRequest, context);

    const response = await this.generate({);
      prompt,
      maxLength: 200,
      temperature: 0.3,
      taskType: 'routing','
    });

    // Parse LFM2 routing response
    return this.parseRoutingResponse(response.content);
  }

  /**
   * Quick classification and simple Q&A
   */
  public async quickResponse()
    userRequest: string,
    taskType: 'classification' | 'simple_qa' = 'simple_qa''
  ): Promise<LFM2Response> {
    const prompt = this.createQuickResponsePrompt(userRequest, taskType);

    return this.generate({);
      prompt,
      maxLength: 150,
      temperature: 0.6,
      taskType,
    });
  }

  /**
   * Coordinate multiple agent tasks
   */
  public async coordinateAgents()
    primaryTask: string,
    supportingTasks: string[]
  ): Promise<{
    execution_plan: {,
      primary_priority: number;
      supporting_priorities: number[];,
      parallel_execution: boolean;
      estimated_total_time: number;
    };
    resource_allocation: {,
      primary_service: string;
      supporting_services: string[];
    };
  }> {
    const prompt = this.createCoordinationPrompt(primaryTask, supportingTasks);

    const response = await this.generate({);
      prompt,
      maxLength: 300,
      temperature: 0.4,
      taskType: 'coordination','
    });

    return this.parseCoordinationResponse(response.content);
  }

  /**
   * Core generation method
   */
  public async generate(request: LFM2Request): Promise<LFM2Response> {
    if (!this.isInitialized) {
      return this.generateMockResponse(request);
    }

    const requestId = this.generateRequestId();
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(requestId, { resolve, reject, startTime });

      // Send request to Python process with correct format
      const pythonRequest = {
        type: request.taskType === 'routing' || request.taskType === 'coordination''
            ? request.taskType: 'completion','
        requestId,
        prompt: request.prompt,
        maxTokens: request.maxTokens || request.maxLength || 512,
        temperature: request.temperature || 0.7,
      };

      if (this.pythonProcess && this.pythonProcess.stdin) {
        this.pythonProcess.stdin.write(`${JSON.stringify(pythonRequest)}n`);
      } else {
        reject(new Error('Python process not available'));'
      }

      // Timeout after 10 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error('LFM2 request timeout'));'
        }
      }, 10000);
    });
  }

  /**
   * Batch processing for efficiency
   */
  public async generateBatch(requests: LFM2Request[]): Promise<LFM2Response[]> {
    log.info('📦 Processing LFM2 batch request', LogContext.AI, { count: requests.length });'

    // Process requests in parallel but limit concurrency
    const batchSize = THREE;
    const results: LFM2Response[] = [];

    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map((request) => this.generate(request)));
      results.push(...batchResults);
    }

    return results;
  }

  private handlePythonResponse(data: string): void {
    const lines = data.trim().split('\n');';

    for (const line of lines) {
      if (line === 'INITIALIZED') {'
        this.isInitialized = true;
        continue;
      }

      try {
        const response = JSON.parse(line);

        // Handle Python server response format
        if (response.requestId && this.pendingRequests.has(response.requestId)) {
          const { resolve, reject, startTime } = this.pendingRequests.get(response.requestId)!;
          this.pendingRequests.delete(response.requestId);

          const executionTime = response.processingTime || Date.now() - startTime;

          if (response.success) {
            const content = response.text || response.strategy || response.category || '';';

            // Update metrics
            this.updateMetrics(executionTime, content.length);

            resolve({)
              content,
              tokens: Math.ceil(content.length / 4),
              executionTime,
              model: response.model || 'lfm2-1.2b','
              confidence: response.confidence,
            });
          } else {
            reject(new Error(response.error(|| 'LFM2 processing failed'));'
          }
        }
      } catch (error) {
        log.error('❌ Failed to parse LFM2 response', LogContext.AI, { error, data: line });'
      }
    }
  }

  private createRoutingPrompt(userRequest: string, context: Record<string, any>): string {
    return `FAST ROUTING DECISION: ;

USER, REQUEST: "${userRequest}""
CONTEXT: ${JSON.stringify(context)}

ROUTING OPTIONS: -, lfm2: Simple questions, quick responses (<100 tokens)
- ollama: Medium complexity, general purpose (<1000 tokens)
- lm-studio: Code generation, technical tasks (<2000 tokens)
- openai: Complex reasoning, creative tasks (>1000 tokens)
- anthropic: Analysis, research, long-form content

Respond with JSON: {"service": "...", "confidence": 0.0-1.0, "reasoning": "...", "tokens": number}`;"
  }

  private createQuickResponsePrompt(userRequest: string, taskType: string): string {
    const taskInstructions = {
      classification: 'Classify this request into categories and respond briefly.','
      simple_qa: 'Answer this question quickly and concisely.','
    };

    return `${taskInstructions[taskType as keyof typeof taskInstructions]}

REQUEST: "${userRequest}""

Response: `;
  }

  private createCoordinationPrompt(primaryTask: string, supportingTasks: string[]): string {
    return `AGENT COORDINATION PLAN: ;

PRIMARY, TASK: "${primaryTask}""
SUPPORTING TASKS: ${supportingTasks.map((task, i) => `${i + 1}. "${task}"`).join(', ')}'"

Create execution plan with priorities, resource allocation, and timing.

Respond with JSON: {
  "execution_plan": {"
    "primary_priority": 1-5,"
    "supporting_priorities": [1-5, ...],"
    "parallel_execution": boolean,"
    "estimated_total_time": seconds"
  },
  "resource_allocation": {"
    "primary_service": "service_name","
    "supporting_services": ["service1", "service2", ...]"
  }
}`;
  }

  private parseRoutingResponse(content: string): unknown {
    try {
      const jsonMatch = content.match(/{.*}/s);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          targetService: parsed.service || 'ollama','
          confidence: parsed.confidence || 0.7,
          reasoning: parsed.reasoning || 'Automatic routing decision','
          estimatedTokens: parsed.tokens || 100,
        };
      }
    } catch (error) {
      log.warn('⚠️ Failed to parse LFM2 routing response', LogContext.AI);'
    }

    // Fallback parsing
    return {
      targetService: 'ollama' as const,'
      confidence: 0.5,
      reasoning: 'Fallback routing due to parsing error','
      estimatedTokens: 100,
    };
  }

  private parseCoordinationResponse(content: string): unknown {
    try {
      const jsonMatch = content.match(/{.*}/s);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      log.warn('⚠️ Failed to parse LFM2 coordination response', LogContext.AI);'
    }

    // Fallback coordination plan
    return {
      execution_plan: {,
        primary_priority: 1,
        supporting_priorities: [2, 3],
        parallel_execution: true,
        estimated_total_time: 30,
      },
      resource_allocation: {,
        primary_service: 'ollama','
        supporting_services: ['lfm2', 'ollama'],'
      },
    };
  }

  private generateMockResponse(request: LFM2Request): LFM2Response {
    // Fast mock response for development/testing
    const mockContent = `Mock LFM2 response for: ${request.prompt.substring(0, 50)}...`;

    return {
      content: mockContent,
      tokens: Math.ceil(mockContent.length / 4),
      executionTime: 50 + Math.random() * 100, // 50-150ms
      model: 'LFM2-1.2B','
      confidence: 0.8,
    };
  }

  private generateRequestId(): string {
    return `lfm2_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private updateMetrics(executionTime: number, responseLength: number): void {
    this.metrics.totalRequests++;

    // Exponential moving average
    const alpha = 0.1;
    this.metrics.avgResponseTime =
      alpha * executionTime + (1 - alpha) * this.metrics.avgResponseTime;

    // Token throughput (tokens per second)
    const tokens = Math.ceil(responseLength / 4);
    const throughput = tokens / (executionTime / 1000);
    this.metrics.tokenThroughput = alpha * throughput + (1 - alpha) * this.metrics.tokenThroughput;
  }

  private async restartProcess(): Promise<void> {
    log.info('🔄 Restarting LFM2 bridge service', LogContext.AI);'

    if (this.pythonProcess) {
      this.pythonProcess.kill();
      this.pythonProcess = null;
    }

    // Wait a bit before restarting
    await new Promise((resolve) => setTimeout(resolve, 2000));

    this.initializeLFM2();
  }

  public getMetrics(): LFM2Metrics & { isInitialized: boolean } {
    return {
      ...this.metrics,
      isInitialized: this.isInitialized,
    };
  }

  public isAvailable(): boolean {
    return this.isInitialized && this.pythonProcess !== null;
  }

  public async shutdown(): Promise<void> {
    log.info('🛑 Shutting down LFM2 bridge service', LogContext.AI);'

    if (this.pythonProcess) {
      this.pythonProcess.kill();
      this.pythonProcess = null;
    }

    this.isInitialized = false;
  }
}

// Create singleton with lazy initialization and circuit breaker protection
class SafeLFM2Bridge {
  private instance: LFM2BridgeService | null = null;
  private initAttempted = false;
  private circuitBreaker: CircuitBreaker<LFM2Response>;

  constructor() {
    // Create circuit breaker with optimized settings
    this.circuitBreaker = new CircuitBreaker<LFM2Response>('lfm2-bridge', {'
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 30000, // 30 seconds
      errorThresholdPercentage: 60,
      volumeThreshold: 5,
    });

    // Register for monitoring
    CircuitBreakerRegistry.register('lfm2-bridge', this.circuitBreaker);'
  }

  async quickResponse()
    userRequest: string,
    taskType: 'classification' | 'simple_qa' = 'simple_qa''
  ): Promise<LFM2Response> {
    return this.circuitBreaker.execute(async () => {
      if (!this.initAttempted && !this.instance) {
        this.initAttempted = true;
        try {
          this.instance = new LFM2BridgeService();
          log.info('✅ LFM2 bridge initialized successfully', LogContext.AI);'
        } catch (error) {
          log.warn('⚠️ LFM2 bridge initialization failed, using fallback', LogContext.AI, {')
            error,
          });
          return this.createFallbackResponse(userRequest);
        }
      }

      if (this.instance) {
        return this.instance.quickResponse(userRequest, taskType);
      } else {
        return this.createFallbackResponse(userRequest);
      }
    });
  }

  async execute(request: LFM2Request): Promise<LFM2Response> {
    // Use circuit breaker for resilient execution
    return this.circuitBreaker.execute();
      async () => {
        // Try to initialize LFM2 if not attempted
        if (!this.initAttempted && !this.instance) {
          this.initAttempted = true;
          try {
            this.instance = new LFM2BridgeService();
            log.info('✅ LFM2 bridge initialized successfully', LogContext.AI);'
          } catch (error) {
            log.warn('⚠️ LFM2 bridge initialization failed, using fallback', LogContext.AI, {')
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        // Try native LFM2 if available
        if (this.instance && this.instance.isAvailable()) {
          return this.instance.generate(request);
        }

        // Use Ollama as primary fallback
        const // TODO: Refactor nested ternary;
          messages = [
            ...(request.systemPrompt
              ? [{ role: 'system' as const, content: request.systemPrompt }]'
              : []),
            { role: 'user' as const, content: request.prompt },'
          ];

        const response = await ollamaService.generateResponse();
          [{ role: 'user', content: request.prompt }],'
          'llama3.2: 3b','
          {
            temperature: request.temperature || 0.1,
            max_tokens: request.maxTokens || 100,
          }
        );

        return {
          content: response.message.content,
          tokens: response.eval_count || 50,
          executionTime: (response.total_duration || 100000000) / 1000000,
          model: 'llama3.2:3b (LFM2 fallback)','
          confidence: 0.85,
        };
      },
      // Fallback function when circuit is open
      async () => {
        log.warn('⚡ Circuit breaker active, using emergency fallback', LogContext.AI);'
        return {
          content: "I'm currently experiencing high load. Please try again in a moment.",'"
          tokens: 10,
          executionTime: 1,
          model: 'circuit-breaker-fallback','
          confidence: 0.3,
        };
      }
    );
  }

  private createFallbackResponse(userRequest: string): LFM2Response {
    return {
      content: `I understand you're asking, about: ${userRequest.substring(0, 50)}... I'm currently experiencing connectivity issues but will help as soon as possible.`,'
      tokens: 25,
      executionTime: 1,
      model: 'fallback-response','
      confidence: 0.4,
    };
  }

  isAvailable(): boolean {
    return this.instance?.isAvailable() || true; // Always available with fallback;
  }

  getMetrics() {
    if (this.instance) {
      return this.instance.getMetrics();
    }
    return {
      avgResponseTime: 100,
      totalRequests: 0,
      successRate: 1.0,
      tokenThroughput: 500,
    };
  }

  /**
   * Fast routing decision using LFM2 with fallback
   */
  public async routingDecision()
    userRequest: string,
    context: Record<string, any>
  ): Promise<{
    targetService: 'lfm2' | 'ollama' | 'lm-studio' | 'openai' | 'anthropic';,'
    confidence: number;
    reasoning: string;,
    estimatedTokens: number;
  }> {
    try {
      if (this.instance && this.instance.isAvailable()) {
        return this.instance.routingDecision(userRequest, context);
      }

      // Fallback to simple heuristic
      return {
        targetService: 'ollama','
        confidence: 0.5,
        reasoning: 'LFM2 unavailable, falling back to Ollama','
        estimatedTokens: userRequest.length / 4,
      };
    } catch (error) {
      log.error('❌ LFM2 routing decision failed', LogContext.AI, { error });'
      return {
        targetService: 'ollama','
        confidence: 0.3,
        reasoning: 'Error in routing, defaulting to Ollama','
        estimatedTokens: userRequest.length / 4,
      };
    }
  }

  shutdown() {
    if (this.instance) {
      this.instance.shutdown();
    }
  }

  // Get circuit breaker health status
  getCircuitBreakerMetrics() {
    return this.circuitBreaker.getMetrics();
  }
}

// Export safe singleton that won't crash on startup'
export const lfm2Bridge = new SafeLFM2Bridge();
export default lfm2Bridge;
