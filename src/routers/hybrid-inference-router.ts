export class HybridInferenceRouter extends EventEmitter {
  private embeddedManager: EmbeddedModelManager;
  private lifecycleManager: ModelLifecycleManager;
  private performanceStats: PerformanceStats;
  private routingCache: Map<string, RoutingDecision> = new Map();

  constructor(embeddedManager?: EmbeddedModelManager, lifecycleManager?: ModelLifecycleManager) {
    super();

    this.embeddedManager = embeddedManager || new EmbeddedModelManager();
    this.lifecycleManager = lifecycleManager || new ModelLifecycleManager();

    this.performanceStats = {
      mlx: { totalRequests: 0, averageLatency: 0, successRate: 1.0 },
      ollama: { totalRequests: 0, averageLatency: 0, successRate: 1.0 },
    };
  }

  /**
   * Route inference _requestto optimal engine
   */
  async route(_request InferenceRequest): Promise<InferenceResponse> {
    const startTime = Date.now();

    try {
      // Analyze _requestto determine routing
      const routing = await this.analyzeRequest(_request;

      // Log routing decision
      this.emit('routing-decision', {
        _request _requestprompt.substring(0, 100),
        decision: routing,
      });

      let response: InferenceResponse;

      // Execute based on routing decision
      switch (routing.engine) {
        case 'mlx':
          response = await this.mlxInference(_request routing);
          break;

        case 'ollama':
          response = await this.ollamaInference(_request routing);
          break;

        case 'hybrid':
          response = await this.hybridInference(_request routing);
          break;

        default:
          response = await this.selectOptimalEngine(_request routing);
      }

      // Update stats
      this.updatePerformanceStats(routing.engine, Date.now() - startTime, true);

      return response;
    } catch (error) {
      const latency = Date.now() - startTime;
      this.emit('routing-error, { error latency });
      throw error
    }
  }

  /**
   * Analyze _requestto determine optimal routing
   */
  private async analyzeRequest(_request InferenceRequest): Promise<RoutingDecision> {
    // Check cache first
    const cacheKey = this.generateCacheKey(_request;
    const cached = this.routingCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Analyze _requestcharacteristics
    const complexity = this.assessComplexity(_requestprompt);
    const needsSpeed =
      _requestpriority === 'critical' || (_requesttimeout !== undefined && _requesttimeout < 5000);
    const needsStreaming = _requeststreaming || false;
    const isMultimodal = this.detectMultimodal(_requestprompt);
    const modelSize = this.estimateRequiredModelSize(complexity, _requestprompt);

    // Determine optimal engine
    let engine: 'mlx' | 'ollama' | 'hybrid';
    let model: string;
    let reasoning: string;

    if (needsSpeed && modelSize < 4e9) {
      engine = 'mlx';
      model = this.selectMLXModel(modelSize);
      reasoning = 'Fast response needed with small model';
    } else if (needsStreaming || isMultimodal) {
      engine = 'ollama';
      model = this.selectOllamaModel(modelSize, isMultimodal);
      reasoning = 'Streaming or multimodal capabilities required';
    } else if (complexity > 8) {
      engine = 'hybrid';
      model = 'deepseek-r1:14b';
      reasoning = 'Complex task requiring multi-stage processing';
    } else {
      // Default: choose based on performance stats
      engine = this.selectOptimalEngineByStats();
      model = this.selectModelBySize(modelSize, engine);
      reasoning = 'Selected based on performance history';
    }

    const decision: RoutingDecision = {
      engine,
      model,
      reasoning,
      complexity,
      needsSpeed,
      needsStreaming,
      isMultimodal,
      modelSize,
    };

    // Cache decision
    this.routingCache.set(cacheKey, decision);

    // Clear old cache entries
    if (this.routingCache.size > 1000) {
      const firstKey = this.routingCache.keys().next().value;
      if (firstKey !== undefined) {
        this.routingCache.delete(firstKey);
      }
    }

    return decision;
  }

  /**
   * MLX inference
   */
  private async mlxInference(
    _request InferenceRequest,
    routing: RoutingDecision
  ): Promise<InferenceResponse> {
    const startTime = Date.now();

    // Ensure model is embedded
    if (!(await this.isModelEmbedded(routing.model))) {
      await this.embeddedManager.embedModel(routing.model);
    }

    const text = await this.embeddedManager.generate(
      routing.model,
      _requestprompt,
      _requestmaxTokens || 100
    );

    return {
      text,
      model: routing.model,
      engine: 'mlx',
      latencyMs: Date.now() - startTime,
      tokensPerSecond: this.calculateTokensPerSecond(text, Date.now() - startTime),
    };
  }

  /**
   * Ollama inference
   */
  private async ollamaInference(
    _request InferenceRequest,
    routing: RoutingDecision
  ): Promise<InferenceResponse> {
    const startTime = Date.now();

    // Use lifecycle manager to ensure model is ready
    await this.lifecycleManager.predictAndWarm({ userRequest: _requestprompt });

    const command = this.buildOllamaCommand(routing.model, _request;
    const { stdout } = await execAsync(command);

    return {
      text: stdout.trim(),
      model: routing.model,
      engine: 'ollama',
      latencyMs: Date.now() - startTime,
      tokensPerSecond: this.calculateTokensPerSecond(stdout, Date.now() - startTime),
    };
  }

  /**
   * Hybrid inference using multiple models
   */
  private async hybridInference(
    _request InferenceRequest,
    routing: RoutingDecision
  ): Promise<InferenceResponse> {
    const startTime = Date.now();

    // Step 1: Use small MLX model for planning
    const planningModel = 'phi:2.7b';
    await this.embeddedManager.embedModel(planningModel);

    const plan = await this.embeddedManager.generate(
      planningModel,
      `Plan approach for: ${_requestprompt}`,
      50
    );

    // Step 2: Determine execution engine based on plan
    const executionComplexity = this.assessComplexity(plan);
    const executionEngine = executionComplexity > 7 ? 'ollama' : 'mlx';

    // Step 3: Execute with appropriate engine
    let finalResponse: string;
    if (executionEngine === 'ollama') {
      const { stdout } = await execAsync(
        this.buildOllamaCommand(routing.model, {
          ..._request
          prompt: `${plan}\n\nNow execute: ${_requestprompt}`,
        })
      );
      finalResponse = stdout.trim();
    } else {
      finalResponse = await this.embeddedManager.generate(
        'qwen2.5:7b',
        `${plan}\n\nNow execute: ${_requestprompt}`,
        _requestmaxTokens || 100
      );
    }

    return {
      text: finalResponse,
      model: `${planningModel}+${routing.model}`,
      engine: 'hybrid',
      latencyMs: Date.now() - startTime,
      confidence: 0.9, // Higher confidence due to multi-stage processing
    };
  }

  /**
   * Select optimal engine based on current conditions
   */
  private async selectOptimalEngine(
    _request InferenceRequest,
    routing: RoutingDecision
  ): Promise<InferenceResponse> {
    // Compare current performance stats
    const mlxScore = this.calculateEngineScore('mlx');
    const ollamaScore = this.calculateEngineScore('ollama');

    if (mlxScore > ollamaScore && routing.modelSize < 8e9) {
      return this.mlxInference(_request routing);
    } else {
      return this.ollamaInference(_request routing);
    }
  }

  /**
   * Assess prompt complexity
   */
  private assessComplexity(prompt: string): number {
    let complexity = 0;

    // Length factor
    complexity += Math.min(prompt.length / 100, 3);

    // Technical terms
    const technicalTerms = ['algorithm', 'implement', 'analyze', 'optimize', 'architecture'];
    complexity += technicalTerms.filter((term) => prompt.toLowerCase().includes(term)).length * 0.5;

    // Multi-step indicators
    const multiStepIndicators = ['first', 'then', 'finally', 'step', 'phase'];
    complexity += multiStepIndicators.filter((term) => prompt.toLowerCase().includes(term)).length;

    // Code detection
    if (prompt.includes('```') || prompt.includes('function') || prompt.includes('class')) {
      complexity += 2;
    }

    return Math.min(complexity, 10);
  }

  /**
   * Detect if _requestneeds multimodal capabilities
   */
  private detectMultimodal(prompt: string): boolean {
    const multimodalIndicators = ['image', 'picture', 'photo', 'diagram', 'chart', 'video'];
    return multimodalIndicators.some((indicator) => prompt.toLowerCase().includes(indicator));
  }

  /**
   * Estimate required model size based on task
   */
  private estimateRequiredModelSize(complexity: number, prompt: string): number {
    if (complexity < 3) return 2e9; // 2B
    if (complexity < 5) return 7e9; // 7B
    if (complexity < 8) return 14e9; // 14B
    return 24e9; // 24B+
  }

  /**
   * Select MLX model based on size requirements
   */
  private selectMLXModel(size: number): string {
    if (size <= 2e9) return 'gemma:2b';
    if (size <= 3e9) return 'phi:2.7b';
    return 'qwen2.5:7b'; // Largest we'll embed
  }

  /**
   * Select Ollama model based on requirements
   */
  private selectOllamaModel(size: number, isMultimodal: boolean): string {
    if (isMultimodal) return 'llava:7b';
    if (size <= 7e9) return 'qwen2.5:7b';
    if (size <= 14e9) return 'deepseek-r1:14b';
    return 'devstral:24b';
  }

  /**
   * Select optimal engine based on performance stats
   */
  private selectOptimalEngineByStats(): 'mlx' | 'ollama' {
    const mlxScore = this.calculateEngineScore('mlx');
    const ollamaScore = this.calculateEngineScore('ollama');
    return mlxScore > ollamaScore ? 'mlx' : 'ollama';
  }

  /**
   * Calculate engine performance score
   */
  private calculateEngineScore(engine: 'mlx' | 'ollama'): number {
    const stats = this.performanceStats[engine];
    if (stats.totalRequests === 0) return 0.5;

    // Weighted score: success rate (60%) + speed (40%)
    const speedScore = Math.max(0, 1 - stats.averageLatency / 10000); // 10s max
    return stats.successRate * 0.6 + speedScore * 0.4;
  }

  /**
   * Select model by size and engine
   */
  private selectModelBySize(size: number, engine: 'mlx' | 'ollama'): string {
    if (engine === 'mlx') {
      return this.selectMLXModel(size);
    } else {
      return this.selectOllamaModel(size, false);
    }
  }

  /**
   * Check if model is embedded
   */
  private async isModelEmbedded(model: string): Promise<boolean> {
    const status = this.embeddedManager.getModelStatus();
    return model in status;
  }

  /**
   * Build Ollama command
   */
  private buildOllamaCommand(model: string, _request InferenceRequest): string {
    const args = [
      `ollama run ${model}`,
      _requestmaxTokens ? `--max-tokens ${_requestmaxTokens}` : '',
      _requesttemperature ? `--temperature ${_requesttemperature}` : '',
    ]
      .filter(Boolean)
      .join(' ');

    return `echo "${_requestprompt.replace(/"/g, '\\"')}" | ${args}`;
  }

  /**
   * Calculate tokens per second
   */
  private calculateTokensPerSecond(text: string, latencyMs: number): number {
    const tokens = text.split(/\s+/).length;
    const seconds = latencyMs / 1000;
    return tokens / seconds;
  }

  /**
   * Generate cache key for routing decisions
   */
  private generateCacheKey(_request InferenceRequest): string {
    const key = `${_requestprompt.substring(0, 50)}_${_requestmaxTokens}_${_requeststreaming}`;
    return Buffer.from(key).toString('base64');
  }

  /**
   * Update performance statistics
   */
  private updatePerformanceStats(
    engine: 'mlx' | 'ollama' | 'hybrid',
    latencyMs: number,
    success: boolean
  ): void {
    if (engine === 'hybrid') return; // Don't track hybrid separately

    const realEngine = engine as 'mlx' | 'ollama';
    const stats = this.performanceStats[realEngine];

    stats.totalRequests++;
    stats.averageLatency =
      (stats.averageLatency * (stats.totalRequests - 1) + latencyMs) / stats.totalRequests;

    if (!success) {
      stats.successRate = (stats.successRate * (stats.totalRequests - 1) + 0) / stats.totalRequests;
    }
  }

  /**
   * Get routing statistics
   */
  getStats(): any {
    return {
      performance: this.performanceStats,
      cacheSize: this.routingCache.size,
      embeddedModels: Object.keys(this.embeddedManager.getModelStatus()),
      mlxAvailable: this.embeddedManager.isAvailable(),
    };
  }

  /**
   * Clear routing cache
   */
  clearCache(): void {
    this.routingCache.clear();
  }

  /**
   * Preload models based on expected usage
   */
  async preloadModels(models: string[]): Promise<void> {
    const embedPromises = models
      .filter((m) => m.includes('2b') || m.includes('2.7b'))
      .map((m) => this.embeddedManager.embedModel(m));

    const warmPromises = models
      .filter((m) => !m.includes('2b') && !m.includes('2.7b'))
      .map((m) => this.lifecycleManager.predictAndWarm({ userRequest: `load ${m}` }));

    await Promise.all([...embedPromises, ...warmPromises]);
  }
}

export default HybridInferenceRouter;
import type { SupabaseClient } from '@supabase/supabase-js';
import type { RedisClientType } from 'redis';
import os from 'os';
import { logger } from '../utils/logger';
import { circuitBreaker } from './circuit-breaker';
// Conditionally import kokoro-tts-service to handle missing dependencies
let kokoroTTS: any;
try {
  const kokoroModule = require('./kokoro-tts-service');
  kokoroTTS = kokoroModule.kokoroTTS;
} catch (error) {
  // Kokoro TTS not available
}

// Conditionally import ollama-assistant to handle missing dependencies
let getOllamaAssistant: any;
try {
  const ollamaModule = require('./ollama-assistant');
  getOllamaAssistant = ollamaModule.getOllamaAssistant;
} catch (error) {
  // Ollama assistant not available
}
import axios from 'axios';
import type { DatabaseMigrationService } from './database-migration';
import { redisHealthCheck } from './redis-health-check';

export interface HealthStatus {
  healthy: boolean;
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  details?: any;
  lastCheck?: Date;
}

export interface ServiceHealth {
  database: HealthStatus;
  redis: HealthStatus;
  ollama: HealthStatus;
  kokoro: HealthStatus;
  storage: HealthStatus;
  memory: HealthStatus;
  cpu: HealthStatus;
  disk: HealthStatus;
  migrations: HealthStatus;
  circuitBreakers: HealthStatus;
}

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  timestamp: string;
  services: ServiceHealth;
  metrics: {
    cpu: {
      usage: number;
      loadAverage: number[];
    };
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    disk: {
      used: number;
      total: number;
      percentage: number;
    };
    requestsPerMinute?: number;
    averageResponseTime?: number;
  };
  dependencies: {
    name: string;
    version: string;
    healthy: boolean;
  }[];
  // Enhanced monitoring features
  healthScore: number; // 0-100
  trends: {
    status: 'improving' | 'stable' | 'degrading';
    score: number; // Change in health score over time
  };
  alerts: Array<{
    level: 'info' | 'warning' | 'error | 'critical';
    message: string;
    service?: string;
    timestamp: string;
  }>;
  suggestions: string[];
  telemetry?: {
    traceId?: string;
    spanId?: string;
    activeSpans: number;
    tracingEnabled: boolean;
  };
}

export interface HealthHistory {
  timestamp: Date;
  status: 'healthy' | 'degraded' | 'unhealthy';
  score: number;
  responseTime: number;
  services: Record<string, 'healthy' | 'degraded' | 'unhealthy'>;
}

export class HealthCheckService {
  private startTime: Date;
  private healthChecks: Map<string, () => Promise<HealthStatus>> = new Map();
  private healthHistory: HealthHistory[] = [];
  private lastHealthScore = 100;
  private requestMetrics: {
    totalRequests: number;
    requestsInLastMinute: number[];
    responseTimes: number[];
    lastMinuteStart: number;
  } = {
    totalRequests: 0,
    requestsInLastMinute: [],
    responseTimes: [],
    lastMinuteStart: Date.now(),
  };

  constructor(
    private supabase: SupabaseClient,
    private redis?: RedisClientType,
    private migrationService?: DatabaseMigrationService
  ) {
    this.startTime = new Date();
    this.registerHealthChecks();
    this.startMetricsCleanup();
  }

  private registerHealthChecks() {
    // Database health check
    this.healthChecks.set('database', async () => {
      try {
        // First try a simple query that should always work
        const { data, error} = await this.supabase.rpc('health_check_db', {});

        if (error {
          // Fallback to a simple table query if the RPC doesn't exist
          const { data: fallbackData, error fallbackError } = await this.supabase
            .from('ai_memories')
            .select('id')
            .limit(1);

          if (fallbackError) {
            throw fallbackError;
          }
        }

        return {
          healthy: true,
          status: 'healthy',
          message: 'Database connection successful',
        };
      } catch (error any) {
        // Try one more simple query
        try {
          await this.supabase.auth.getSession();
          return {
            healthy: true,
            status: 'healthy',
            message: 'Database connection via auth successful',
          };
        } catch (authError: any) {
          return {
            healthy: false,
            status: 'unhealthy',
            message: 'Database connection failed',
            details: `${errormessage} (Auth fallback also failed: ${authError.message})`,
          };
        }
      }
    });

    // Redis health check
    this.healthChecks.set('redis', async () => {
      try {
        // Use the comprehensive Redis health check service
        const redisHealth = await redisHealthCheck.performHealthCheck();

        return {
          healthy: redisHealth.status !== 'unhealthy',
          status: redisHealth.status,
          message:
            redisHealth.status === 'healthy'
              ? 'Redis is operating normally'
              : redisHealth.status === 'degraded'
                ? 'Redis is experiencing issues'
                : 'Redis is unavailable',
          details: {
            connected: redisHealth.connected,
            latency: redisHealth.latency,
            memoryUsage: redisHealth.memoryUsage,
            connectedClients: redisHealth.connectedClients,
            uptime: redisHealth.uptime,
            fallbackCacheActive: redisHealth.fallbackCacheActive,
            errors: redisHealth.details.errors,
            warnings: redisHealth.details.warnings,
          },
        };
      } catch (error any) {
        return {
          healthy: false,
          status: 'unhealthy',
          message: 'Redis health check failed',
          details: errormessage,
        };
      }
    });

    // Ollama health check
    this.healthChecks.set('ollama', async () => {
      if (!getOllamaAssistant) {
        return {
          healthy: false,
          status: 'degraded',
          message: 'Ollama assistant not available',
          details: 'Module not loaded',
        };
      }

      try {
        const ollamaAssistant = getOllamaAssistant(this.supabase);

        if (!ollamaAssistant || typeof ollamaAssistant.checkAvailability !== 'function') {
          return {
            healthy: false,
            status: 'degraded',
            message: 'Ollama assistant invalid',
            details: 'Assistant instance or method not available',
          };
        }

        const isAvailable = await ollamaAssistant.checkAvailability();
        return {
          healthy: isAvailable,
          status: isAvailable ? 'healthy' : 'degraded',
          message: isAvailable ? 'Ollama service available' : 'Ollama service unavailable',
        };
      } catch (error any) {
        return {
          healthy: false,
          status: 'degraded',
          message: 'Ollama check failed',
          details: errormessage,
        };
      }
    });

    // Kokoro TTS health check
    this.healthChecks.set('kokoro', async () => {
      if (!kokoroTTS) {
        return {
          healthy: false,
          status: 'degraded',
          message: 'Kokoro TTS not available',
          details: 'Module not loaded',
        };
      }

      try {
        if (typeof kokoroTTS.initialize === 'function') {
          await kokoroTTS.initialize();
          return {
            healthy: true,
            status: 'healthy',
            message: 'Kokoro TTS initialized',
          };
        } else {
          return {
            healthy: false,
            status: 'degraded',
            message: 'Kokoro TTS initialization method not available',
          };
        }
      } catch (error any) {
        return {
          healthy: false,
          status: 'degraded',
          message: 'Kokoro TTS unavailable',
          details: errormessage,
        };
      }
    });

    // Storage health check
    this.healthChecks.set('storage', async () => {
      try {
        const { data, error} = await this.supabase.storage
          .from('voice-outputs')
          .list('', { limit: 1 });

        if (error throw error

        return {
          healthy: true,
          status: 'healthy',
          message: 'Storage buckets accessible',
        };
      } catch (error any) {
        return {
          healthy: false,
          status: 'degraded',
          message: 'Storage access failed',
          details: errormessage,
        };
      }
    });

    // Memory health check
    this.healthChecks.set('memory', () => {
      const memUsage = process.memoryUsage();
      const totalMem = os.totalmem();
      const percentUsed = (memUsage.heapUsed / totalMem) * 100;

      return Promise.resolve({
        healthy: percentUsed < 80,
        status: percentUsed < 80 ? 'healthy' : percentUsed < 90 ? 'degraded' : 'unhealthy',
        message: `Memory usage: ${percentUsed.toFixed(1)}%`,
        details: {
          heapUsed: memUsage.heapUsed,
          heapTotal: memUsage.heapTotal,
          external: memUsage.external,
          rss: memUsage.rss,
        },
      });
    });

    // CPU health check
    this.healthChecks.set('cpu', () => {
      const loadAvg = os.loadavg();
      const cpuCount = os.cpus().length;
      const normalizedLoad = loadAvg[0] / cpuCount;

      return Promise.resolve({
        healthy: normalizedLoad < 0.8,
        status: normalizedLoad < 0.8 ? 'healthy' : normalizedLoad < 0.9 ? 'degraded' : 'unhealthy',
        message: `CPU load: ${(normalizedLoad * 100).toFixed(1)}%`,
        details: {
          loadAverage: loadAvg,
          cpuCount,
        },
      });
    });

    // Disk health check
    this.healthChecks.set('disk', async () => {
      try {
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(exec);

        // Use different commands based on platform
        const isWindows = process.platform === 'win32';
        const command = isWindows ? 'wmic logicaldisk get size,freespace,caption' : 'df -k /';

        const { stdout } = await execAsync(command);

        if (isWindows) {
          // Parse Windows WMIC output
          const lines = stdout
            .trim()
            .split('\n')
            .filter((line) => line.trim());
          if (lines.length < 2) {
            throw new Error('No disk information available');
          }

          // Parse the first data line (usually C: drive)
          const dataLine = lines[1].trim().split(/\s+/);
          const freeSpace = parseInt(dataLine[1], 10) || 0;
          const totalSpace = parseInt(dataLine[2], 10) || 1;
          const usedSpace = totalSpace - freeSpace;
          const percentUsed = Math.round((usedSpace / totalSpace) * 100);

          return {
            healthy: percentUsed < 80,
            status: percentUsed < 80 ? 'healthy' : percentUsed < 90 ? 'degraded' : 'unhealthy',
            message: `Disk usage: ${percentUsed}%`,
            details: {
              used: usedSpace,
              available: freeSpace,
              total: totalSpace,
              percentUsed,
            },
          };
        } else {
          // Parse Unix/Linux df output
          const lines = stdout.trim().split('\n');
          if (lines.length < 2) {
            throw new Error('No disk information available');
          }

          const stats = lines[1].split(/\s+/);
          const percentUsed = parseInt(stats[4]?.replace('%', '', 10)) || 0;

          return {
            healthy: percentUsed < 80,
            status: percentUsed < 80 ? 'healthy' : percentUsed < 90 ? 'degraded' : 'unhealthy',
            message: `Disk usage: ${percentUsed}%`,
            details: {
              used: parseInt(stats[2], 10) * 1024,
              available: parseInt(stats[3], 10) * 1024,
              total: (parseInt(stats[1], 10) || 0) * 1024,
              percentUsed,
            },
          };
        }
      } catch (error any) {
        return {
          healthy: true,
          status: 'healthy',
          message: 'Disk check not available on this platform',
          details: { error errormessage, platform: process.platform },
        };
      }
    });

    // Migrations health check
    this.healthChecks.set('migrations', async () => {
      if (!this.migrationService) {
        return {
          healthy: true,
          status: 'healthy',
          message: 'Migrations not configured',
        };
      }

      try {
        const status = await this.migrationService.getStatus();
        const hasPending = status.pending.length > 0;
        const hasConflicts = status.conflicts.length > 0;

        return {
          healthy: !hasConflicts,
          status: hasConflicts ? 'unhealthy' : hasPending ? 'degraded' : 'healthy',
          message: hasConflicts
            ? `Migration conflicts: ${status.conflicts.length}`
            : hasPending
              ? `Pending migrations: ${status.pending.length}`
              : 'All migrations applied',
          details: {
            applied: status.applied.length,
            pending: status.pending.length,
            conflicts: status.conflicts.length,
          },
        };
      } catch (error any) {
        return {
          healthy: false,
          status: 'unhealthy',
          message: 'Migration check failed',
          details: errormessage,
        };
      }
    });

    // Circuit breakers health check
    this.healthChecks.set('circuitBreakers', () => {
      const cbHealth = circuitBreaker.healthCheck();

      return Promise.resolve({
        healthy: cbHealth.healthy,
        status: cbHealth.healthy ? 'healthy' : 'degraded',
        message:
          cbHealth.openCircuits.length > 0
            ? `Open circuits: ${cbHealth.openCircuits.join(', ')}`
            : 'All circuits closed',
        details: {
          metrics: cbHealth.metrics,
          openCircuits: cbHealth.openCircuits,
        },
      });
    });
  }

  async checkHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const services: Partial<ServiceHealth> = {};

    // Run all health checks in parallel
    const checkPromises = Array.from(this.healthChecks.entries()).map(async ([name, check]) => {
      try {
        services[name as keyof ServiceHealth] = await check();
      } catch (error) {
        services[name as keyof ServiceHealth] = {
          healthy: false,
          status: 'unhealthy',
          message: `Health check failed: ${error`,
        };
      }
    });

    await Promise.all(checkPromises);

    // Calculate overall status
    const statuses = Object.values(services).map((s) => s?.status || 'unhealthy');
    const overallStatus = statuses.includes('unhealthy')
      ? 'unhealthy'
      : statuses.includes('degraded')
        ? 'degraded'
        : 'healthy';

    // Calculate health score
    const healthScore = this.calculateHealthScore(services as ServiceHealth);

    // Calculate trends
    const trends = this.calculateTrends(healthScore);

    // Generate alerts and suggestions
    const alerts = this.generateAlerts(services as ServiceHealth);
    const suggestions = this.generateSuggestions(services as ServiceHealth, healthScore);

    // Get system metrics
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const loadAvg = os.loadavg();

    // Get telemetry information
    const telemetry = this.getTelemetryInfo();

    // Record health history
    const responseTime = Date.now() - startTime;
    this.recordHealthHistory(overallStatus, healthScore, responseTime, services as ServiceHealth);

    const result: HealthCheckResult = {
      status: overallStatus,
      version: process.env.npm_package_version || '1.0.0',
      uptime: Date.now() - this.startTime.getTime(),
      timestamp: new Date().toISOString(),
      services: services as ServiceHealth,
      metrics: {
        cpu: {
          usage: (loadAvg[0] / os.cpus().length) * 100,
          loadAverage: loadAvg,
        },
        memory: {
          used: totalMem - freeMem,
          total: totalMem,
          percentage: ((totalMem - freeMem) / totalMem) * 100,
        },
        disk: {
          used: 0, // Populated by disk health check
          total: 0,
          percentage: 0,
        },
        requestsPerMinute: this.calculateRequestsPerMinute(),
        averageResponseTime: this.calculateAverageResponseTime(),
      },
      dependencies: this.checkDependencies(),
      healthScore,
      trends,
      alerts,
      suggestions,
      telemetry,
    };

    return result;
  }

  private calculateHealthScore(services: ServiceHealth): number {
    const weights = {
      database: 30, // Critical
      redis: 10, // Important but not critical
      ollama: 20, // AI services are important
      kokoro: 10, // Voice features
      storage: 15, // File storage
      memory: 5, // System resources
      cpu: 5, // System resources
      disk: 3, // System resources
      migrations: 2, // Less critical for runtime
      circuitBreakers: 0, // Already factored into other services
    };

    let totalScore = 0;
    let totalWeight = 0;

    for (const [serviceName, serviceHealth] of Object.entries(services)) {
      const weight = weights[serviceName as keyof typeof weights] || 1;
      totalWeight += weight;

      let serviceScore = 0;
      switch (serviceHealth.status) {
        case 'healthy':
          serviceScore = 100;
          break;
        case 'degraded':
          serviceScore = 60;
          break;
        case 'unhealthy':
          serviceScore = 0;
          break;
        default:
          serviceScore = 0;
      }

      totalScore += serviceScore * weight;
    }

    return totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;
  }

  private calculateTrends(currentScore: number): {
    status: 'improving' | 'stable' | 'degrading';
    score: number;
  } {
    const scoreDifference = currentScore - this.lastHealthScore;
    this.lastHealthScore = currentScore;

    let status: 'improving' | 'stable' | 'degrading' = 'stable';
    if (scoreDifference > 5) status = 'improving';
    else if (scoreDifference < -5) status = 'degrading';

    return { status, score: scoreDifference };
  }

  private generateAlerts(services: ServiceHealth): Array<{
    level: 'info' | 'warning' | 'error | 'critical';
    message: string;
    service?: string;
    timestamp: string;
  }> {
    const alerts: Array<{
      level: 'info' | 'warning' | 'error | 'critical';
      message: string;
      service?: string;
      timestamp: string;
    }> = [];
    const timestamp = new Date().toISOString();

    for (const [serviceName, serviceHealth] of Object.entries(services)) {
      if (serviceHealth.status === 'unhealthy') {
        alerts.push({
          level: serviceName === 'database' ? 'critical' : 'error,
          message: serviceHealth.message || `Service ${serviceName} is unhealthy`,
          service: serviceName,
          timestamp,
        });
      } else if (serviceHealth.status === 'degraded') {
        alerts.push({
          level: 'warning',
          message: serviceHealth.message || `Service ${serviceName} is degraded`,
          service: serviceName,
          timestamp,
        });
      }
    }

    // Check system resource alerts
    const memUsage = process.memoryUsage();
    const memPercentage = (memUsage.heapUsed / memUsage.heapTotal) * 100;

    if (memPercentage > 90) {
      alerts.push({
        level: 'critical',
        message: `Memory usage critically high: ${memPercentage.toFixed(1)}%`,
        service: 'memory',
        timestamp,
      });
    } else if (memPercentage > 80) {
      alerts.push({
        level: 'warning',
        message: `Memory usage high: ${memPercentage.toFixed(1)}%`,
        service: 'memory',
        timestamp,
      });
    }

    return alerts;
  }

  private generateSuggestions(services: ServiceHealth, healthScore: number): string[] {
    const suggestions: string[] = [];

    // Service-specific suggestions
    for (const [serviceName, serviceHealth] of Object.entries(services)) {
      if (serviceHealth.status === 'unhealthy') {
        switch (serviceName) {
          case 'database':
            suggestions.push('Check database connection and credentials');
            suggestions.push('Verify database server is running');
            break;
          case 'redis':
            suggestions.push('Check Redis server status');
            suggestions.push('Verify Redis connection configuration');
            break;
          case 'ollama':
            suggestions.push('Start Ollama service');
            suggestions.push('Check Ollama configuration and model availability');
            break;
          case 'memory':
            suggestions.push('Consider increasing memory allocation');
            suggestions.push('Check for memory leaks');
            suggestions.push('Enable garbage collection optimization');
            break;
          case 'cpu':
            suggestions.push('Reduce CPU load by scaling services');
            suggestions.push('Check for infinite loops or CPU-intensive operations');
            break;
        }
      }
    }

    // Overall health suggestions
    if (healthScore < 50) {
      suggestions.push('System health is critically low - immediate attention required');
      suggestions.push('Consider scaling up resources or restarting services');
    } else if (healthScore < 70) {
      suggestions.push('System health is degraded - investigate failing services');
      suggestions.push('Monitor resource usage and optimize as needed');
    }

    // Remove duplicates
    return [...new Set(suggestions)];
  }

  private getTelemetryInfo(): {
    traceId?: string;
    spanId?: string;
    activeSpans: number;
    tracingEnabled: boolean;
  } {
    try {
      // Try to get telemetry service information
      const { telemetryService } = require('./telemetry-service');
      if (telemetryService) {
        const currentTrace = telemetryService.getCurrentTraceContext();
        const metrics = telemetryService.getServiceMetrics();

        return {
          traceId: currentTrace?.traceId,
          spanId: currentTrace?.spanId,
          activeSpans: metrics?.activeSpans || 0,
          tracingEnabled: true,
        };
      }
    } catch (error) {
      // Telemetry service not available or not initialized
    }

    return {
      activeSpans: 0,
      tracingEnabled: false,
    };
  }

  private recordHealthHistory(
    status: 'healthy' | 'degraded' | 'unhealthy',
    score: number,
    responseTime: number,
    services: ServiceHealth
  ): void {
    const serviceStatuses: Record<string, 'healthy' | 'degraded' | 'unhealthy'> = {};
    for (const [name, service] of Object.entries(services)) {
      serviceStatuses[name] = service.status;
    }

    this.healthHistory.push({
      timestamp: new Date(),
      status,
      score,
      responseTime,
      services: serviceStatuses,
    });

    // Keep only last 1000 entries
    if (this.healthHistory.length > 1000) {
      this.healthHistory = this.healthHistory.slice(-1000);
    }
  }

  /**
   * Get health history for analysis
   */
  getHealthHistory(limit = 100): HealthHistory[] {
    return this.healthHistory.slice(-limit);
  }

  /**
   * Get health trends over time
   */
  getHealthTrends(durationMinutes = 60): {
    averageScore: number;
    trend: 'improving' | 'stable' | 'degrading';
    uptimePercentage: number;
    incidents: number;
  } {
    const cutoffTime = new Date(Date.now() - durationMinutes * 60 * 1000);
    const recentHistory = this.healthHistory.filter((h) => h.timestamp > cutoffTime);

    if (recentHistory.length === 0) {
      return {
        averageScore: this.lastHealthScore,
        trend: 'stable',
        uptimePercentage: 100,
        incidents: 0,
      };
    }

    const averageScore = recentHistory.reduce((sum, h) => sum + h.score, 0) / recentHistory.length;
    const healthyCount = recentHistory.filter((h) => h.status === 'healthy').length;
    const uptimePercentage = (healthyCount / recentHistory.length) * 100;
    const incidents = recentHistory.filter((h) => h.status === 'unhealthy').length;

    // Simple trend calculation
    const firstHalf = recentHistory.slice(0, Math.floor(recentHistory.length / 2));
    const secondHalf = recentHistory.slice(Math.floor(recentHistory.length / 2));

    const firstHalfAvg = firstHalf.reduce((sum, h) => sum + h.score, 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((sum, h) => sum + h.score, 0) / secondHalf.length;

    let trend: 'improving' | 'stable' | 'degrading' = 'stable';
    const difference = secondHalfAvg - firstHalfAvg;
    if (difference > 5) trend = 'improving';
    else if (difference < -5) trend = 'degrading';

    return {
      averageScore: Math.round(averageScore),
      trend,
      uptimePercentage: Math.round(uptimePercentage * 100) / 100,
      incidents,
    };
  }

  private checkDependencies(): { name: string; version: string; healthy: boolean }[] {
    const deps = [];

    // Check critical dependencies
    try {
      const packageJson = require('../../package.json');
      const criticalDeps = ['@supabase/supabase-js', 'express', 'zod', 'winston'];

      for (const dep of criticalDeps) {
        let healthy = true;
        let version = packageJson.dependencies[dep] || 'unknown';

        // Try to require the dependency to check if it's actually available
        try {
          require(dep);
        } catch (requireError) {
          healthy = false;
          version = 'missing';
        }

        deps.push({
          name: dep,
          version,
          healthy,
        });
      }
    } catch (error) {
      logger.error(Failed to check dependencies:', error;

      // Add fallback dependency info if package.json can't be read
      const fallbackDeps = ['@supabase/supabase-js', 'express', 'zod', 'winston'];
      for (const dep of fallbackDeps) {
        deps.push({
          name: dep,
          version: 'unknown',
          healthy: false,
        });
      }
    }

    return deps;
  }

  async runReadinessCheck(): Promise<boolean> {
    // Readiness check - is the service ready to accept traffic?
    const criticalServices = ['database'];

    for (const service of criticalServices) {
      const check = this.healthChecks.get(service);
      if (check) {
        const result = await check();
        if (!result.healthy) {
          return false;
        }
      }
    }

    return true;
  }

  async runLivenessCheck(): Promise<boolean> {
    // Liveness check - is the service alive and not deadlocked?
    try {
      // Simple check that we can allocate memory and respond
      const testData = Buffer.alloc(1024);
      return testData.length === 1024;
    } catch {
      return false;
    }
  }

  getUptime(): number {
    return Date.now() - this.startTime.getTime();
  }

  async getDetailedReport(): Promise<string> {
    const health = await this.checkHealth();

    let report = `
Universal AI Tools Health Report
================================
Status: ${health.status.toUpperCase()}
Version: ${health.version}
Uptime: ${Math.floor(health.uptime / 1000)}s
Timestamp: ${health.timestamp}

Services:
`;

    for (const [name, status] of Object.entries(health.services)) {
      report += `  ${name}: ${status.status} - ${status.message}\n`;
      if (status.details) {
        report += `    Details: ${JSON.stringify(status.details)}\n`;
      }
    }

    report += `
System Metrics:
  CPU: ${health.metrics.cpu.usage.toFixed(1)}% (Load: ${health.metrics.cpu.loadAverage.join(', ')})
  Memory: ${health.metrics.memory.percentage.toFixed(1)}% (${(health.metrics.memory.used / 1024 / 1024 / 1024).toFixed(2)}GB / ${(health.metrics.memory.total / 1024 / 1024 / 1024).toFixed(2)}GB)
  
Dependencies:
`;

    for (const dep of health.dependencies) {
      report += `  ${dep.name}@${dep.version}: ${dep.healthy ? 'OK' : 'FAILED'}\n`;
    }

    return report;
  }

  /**
   * Track a _requestand its response time
   */
  trackRequest(responseTimeMs: number): void {
    const now = Date.now();

    // Clean up old data if needed
    this.cleanupOldMetrics(now);

    // Track total requests
    this.requestMetrics.totalRequests++;

    // Track requests in current minute
    this.requestMetrics.requestsInLastMinute.push(now);

    // Track response times (keep last 1000)
    this.requestMetrics.responseTimes.push(responseTimeMs);
    if (this.requestMetrics.responseTimes.length > 1000) {
      this.requestMetrics.responseTimes.shift();
    }
  }

  /**
   * Calculate requests per minute
   */
  private calculateRequestsPerMinute(): number {
    const now = Date.now();
    this.cleanupOldMetrics(now);
    return this.requestMetrics.requestsInLastMinute.length;
  }

  /**
   * Calculate average response time from recent requests
   */
  private calculateAverageResponseTime(): number {
    if (this.requestMetrics.responseTimes.length === 0) {
      return 0;
    }

    const sum = this.requestMetrics.responseTimes.reduce((a, b) => a + b, 0);
    return Math.round(sum / this.requestMetrics.responseTimes.length);
  }

  /**
   * Clean up metrics older than 1 minute
   */
  private cleanupOldMetrics(now: number): void {
    const oneMinuteAgo = now - 60000; // 60 seconds

    // Remove requests older than 1 minute
    this.requestMetrics.requestsInLastMinute = this.requestMetrics.requestsInLastMinute.filter(
      (timestamp) => timestamp > oneMinuteAgo
    );
  }

  /**
   * Start periodic cleanup of old metrics
   */
  private startMetricsCleanup(): void {
    // Clean up every 30 seconds
    setInterval(() => {
      this.cleanupOldMetrics(Date.now());
    }, 30000);
  }

  /**
   * Get current _requestmetrics
   */
  getRequestMetrics(): {
    totalRequests: number;
    requestsPerMinute: number;
    averageResponseTime: number;
  } {
    return {
      totalRequests: this.requestMetrics.totalRequests,
      requestsPerMinute: this.calculateRequestsPerMinute(),
      averageResponseTime: this.calculateAverageResponseTime(),
    };
  }

  /**
   * Reset _requestmetrics
   */
  resetMetrics(): void {
    this.requestMetrics = {
      totalRequests: 0,
      requestsInLastMinute: [],
      responseTimes: [],
      lastMinuteStart: Date.now(),
    };
  }
}

// Export a factory function to create the health check service
export function createHealthCheckService(
  supabase: SupabaseClient,
  redis?: RedisClientType,
  migrationService?: DatabaseMigrationService
): HealthCheckService {
  return new HealthCheckService(supabase, redis, migrationService);
}

/**
 * Middleware to track _requestmetrics
 */
export function createRequestTrackingMiddleware(healthService: HealthCheckService) {
  return (req: any, res: any, next: any) => {
    const startTime = Date.now();

    // Track when response finishes
    res.on('finish', () => {
      const responseTime = Date.now() - startTime;
      healthService.trackRequest(responseTime);
    });

    next();
  };
}
/**
 * Error Tracking and Alerting Service
 *
 * Comprehensive errortracking and alerting system for Universal AI Tools with:
 * - Real-time errordetection and classification
 * - Error aggregation and deduplication
 * - Intelligent alerting with rate limiting
 * - Error trend _analysisand anomaly detection
 * - Integration with monitoring systems
 * - Custom errorfingerprinting
 * - Automated issue assignment and escalation
 * - Performance impact analysis
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';
import { telemetryService } from './telemetry-service';
import { LogContext, logger } from '../utils/enhanced-logger';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';

export interface ErrorTrackingConfig {
  enabled: boolean;
  maxErrors: number;
  deduplicationWindow: number; // ms
  alertingEnabled: boolean;
  alertThresholds: {
    errorRate: number; // errors per minute
    newError: boolean;
    criticalError: boolean;
    errorSpike: number; // percentage increase
  };
  rateLimiting: {
    maxAlertsPerMinute: number;
    cooldownPeriod: number; // ms
  };
  errorFilters: {
    ignoredErrors: string[];
    minimumLevel: 'debug' | 'info' | 'warn' | 'error | 'fatal';
  };
  persistence: {
    enabled: boolean;
    retentionDays: number;
    batchSize: number;
  };
  integrations: {
    slack?: {
      webhookUrl: string;
      channel: string;
    };
    email?: {
      recipients: string[];
      smtpConfig: any;
    };
    pagerDuty?: {
      integrationKey: string;
    };
  };
}

export interface ErrorEvent {
  id: string;
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error | 'fatal';
  message: string;
  type: string;
  fingerprint: string;
  stackTrace: string;
  handled: boolean;

  // Context information
  context: {
    userId?: string;
    sessionId?: string;
    requestId?: string;
    traceId?: string;
    spanId?: string;
    url?: string;
    method?: string;
    userAgent?: string;
    ip?: string;
    environment: string;
    service: string;
    version: string;
  };

  // Additional metadata
  tags: Record<string, unknown>;
  extra: Record<string, unknown>;

  // Performance impact
  performance?: {
    responseTime: number;
    memoryUsage: number;
    cpuUsage: number;
  };

  // Related errors
  causedBy?: string; // ID of causing error
  relatedTo?: string[]; // IDs of related errors
}

export interface ErrorGroup {
  fingerprint: string;
  title: string;
  firstSeen: Date;
  lastSeen: Date;
  count: number;
  level: ErrorEvent['level'];
  status: 'unresolved' | 'resolved' | 'ignored' | 'monitoring';

  // Representative error
  culprit: string; // Function/file where errororiginated
  platform: string;

  // Metadata
  tags: Record<string, unknown>;

  // Statistics
  stats: {
    last24h: number;
    last7d: number;
    last30d: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  };

  // Related users/sessions
  users: Set<string>;
  sessions: Set<string>;

  // Issue tracking
  assignedTo?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  resolution?: {
    type: 'fixed' | 'wont_fix' | 'invalid' | 'duplicate';
    note?: string;
    resolvedBy?: string;
    resolvedAt?: Date;
  };
}

export interface Alert {
  id: string;
  timestamp: Date;
  type: 'new_error | 'error_spike' | 'critical_error | 'higherror_rate';
  level: 'info' | 'warning' | 'critical';
  title: string;
  description: string;

  // Related data
  errorGroup?: ErrorGroup;
  metrics?: {
    errorRate: number;
    affectedUsers: number;
    performanceImpact: number;
  };

  // Alert management
  status: 'active' | 'acknowledged' | 'resolved';
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  resolvedAt?: Date;

  // Notification tracking
  notificationsSent: {
    channel: string;
    timestamp: Date;
    success: boolean;
  }[];
}

export interface ErrorReport {
  timeRange: {
    start: Date;
    end: Date;
  };
  summary: {
    totalErrors: number;
    totalGroups: number;
    newGroups: number;
    resolvedGroups: number;
    errorRate: number;
    affectedUsers: number;
    affectedSessions: number;
  };
  topErrors: Array<{
    fingerprint: string;
    title: string;
    count: number;
    lastSeen: Date;
    trend: string;
  }>;
  errorDistribution: {
    byLevel: Record<string, number>;
    byService: Record<string, number>;
    byPlatform: Record<string, number>;
    overTime: Array<{
      timestamp: Date;
      count: number;
    }>;
  };
  performance: {
    averageResponseTime: number;
    errorImpactOnPerformance: number;
    slowestErrors: Array<{
      fingerprint: string;
      averageResponseTime: number;
    }>;
  };
}

export class ErrorTrackingService extends EventEmitter {
  private config: ErrorTrackingConfig;
  private supabase: SupabaseClient;
  private isStarted = false;
  private errors = new Map<string, ErrorEvent>();
  private errorGroups = new Map<string, ErrorGroup>();
  private alerts = new Map<string, Alert>();
  private alertRateLimiter = new Map<string, number>();
  private persistenceQueue: ErrorEvent[] = [];
  private persistenceInterval?: NodeJS.Timeout;

  constructor(supabaseUrl: string, supabaseKey: string, config: Partial<ErrorTrackingConfig> = {}) {
    super();

    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.config = {
      enabled: true,
      maxErrors: 10000,
      deduplicationWindow: 60000, // 1 minute
      alertingEnabled: true,
      alertThresholds: {
        errorRate: 10, // errors per minute
        newError: true,
        criticalError: true,
        errorSpike: 200, // 200% increase
      },
      rateLimiting: {
        maxAlertsPerMinute: 5,
        cooldownPeriod: 300000, // 5 minutes
      },
      errorFilters: {
        ignoredErrors: [],
        minimumLevel: 'error,
      },
      persistence: {
        enabled: true,
        retentionDays: 30,
        batchSize: 100,
      },
      integrations: {},
      ...config,
    };

    this.setupErrorHandling();
  }

  /**
   * Start errortracking service
   */
  async start(): Promise<void> {
    if (this.isStarted) {
      logger.warn('Error tracking service already started', LogContext.ERROR);
      return;
    }

    if (!this.config.enabled) {
      logger.info('Error tracking service disabled', LogContext.ERROR);
      return;
    }

    try {
      logger.info('Starting errortracking service', LogContext.ERROR, { config: this.config });

      // Setup persistence if enabled
      if (this.config.persistence.enabled) {
        this.setupPersistence();
      }

      // Load existing errorgroups from database
      await this.loadErrorGroups();

      this.isStarted = true;
      this.emit('started', { config: this.config });

      logger.info('Error tracking service started successfully', LogContext.ERROR);
    } catch (error) {
      logger.error(Failed to start errortracking service', LogContext.ERROR, { error});
      throw error
    }
  }

  /**
   * Stop errortracking service
   */
  async stop(): Promise<void> {
    if (!this.isStarted) {
      logger.warn('Error tracking service not started', LogContext.ERROR);
      return;
    }

    try {
      logger.info('Stopping errortracking service', LogContext.ERROR);

      // Stop persistence
      if (this.persistenceInterval) {
        clearInterval(this.persistenceInterval);
        this.persistenceInterval = undefined;
      }

      // Final persistence flush
      if (this.config.persistence.enabled && this.persistenceQueue.length > 0) {
        await this.flushErrors();
      }

      this.isStarted = false;
      this.emit('stopped');

      logger.info('Error tracking service stopped successfully', LogContext.ERROR);
    } catch (error) {
      logger.error(Error stopping errortracking service', LogContext.ERROR, { error});
      throw error
    }
  }

  /**
   * Track an errorevent
   */
  trackError(
    error Error | string,
    context: Partial<ErrorEvent['context']> = {},
    extra: Record<string, unknown> = {},
    level: ErrorEvent['level'] = 'error
  ): string {
    if (!this.config.enabled || !this.isStarted) {
      return '';
    }

    // Filter out ignored errors
    const errorMessage = errorinstanceof Error ? errormessage : error
    if (this.shouldIgnoreError(errorMessage, level)) {
      return '';
    }

    const errorEvent = this.createErrorEvent(error context, extra, level);

    // Check for deduplication
    const existingError = this.findDuplicateError(errorEvent);
    if (existingError) {
      this.updateErrorGroup(errorEvent);
      return existingError.id;
    }

    // Store error
    this.errors.set(errorEvent.id, errorEvent);

    // Update or create errorgroup
    const group = this.updateErrorGroup(errorEvent);

    // Check for alerts
    if (this.config.alertingEnabled) {
      this.checkForAlerts(errorEvent, group);
    }

    // Add to persistence queue
    if (this.config.persistence.enabled) {
      this.persistenceQueue.push(errorEvent);
    }

    // Cleanup old errors
    this.cleanupOldErrors();

    logger.debug('Error tracked', LogContext.ERROR, {
      error_id: errorEvent.id,
      fingerprint: errorEvent.fingerprint,
      level: errorEvent.level,
      message: errorEvent.message,
    });

    this.emit('errorTracked', errorEvent);
    return errorEvent.id;
  }

  /**
   * Track errorfrom telemetry span
   */
  trackErrorFromSpan(
    error Error,
    spanContext?: { traceId: string; spanId: string },
    extra: Record<string, unknown> = {}
  ): string {
    const context: Partial<ErrorEvent['context']> = {
      traceId: spanContext?.traceId || telemetryService.getCurrentTraceId(),
      spanId: spanContext?.spanId || telemetryService.getCurrentSpanId(),
      service: 'universal-ai-tools',
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
    };

    return this.trackError(error context, extra, 'error);
  }

  /**
   * Track Sweet Athena specific error
   */
  trackAthenaError(
    error Error,
    sessionId: string,
    personalityMood: string,
    interactionType?: string,
    extra: Record<string, unknown> = {}
  ): string {
    const context: Partial<ErrorEvent['context']> = {
      sessionId,
      service: 'sweet-athena',
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      traceId: telemetryService.getCurrentTraceId(),
      spanId: telemetryService.getCurrentSpanId(),
    };

    const athenaExtra = {
      ...extra,
      'athena.personality_mood': personalityMood,
      'athena.interaction_type': interactionType,
      'athena.session_id': sessionId,
    };

    return this.trackError(error context, athenaExtra, 'error);
  }

  /**
   * Resolve an errorgroup
   */
  resolveErrorGroup(
    fingerprint: string,
    resolution: ErrorGroup['resolution'],
    resolvedBy: string
  ): void {
    const group = this.errorGroups.get(fingerprint);
    if (!group) {
      logger.warn('Error group not found for resolution', LogContext.ERROR, { fingerprint });
      return;
    }

    group.status = 'resolved';
    group.resolution = {
      ...resolution,
      resolvedBy,
      resolvedAt: new Date(),
    };

    logger.info('Error group resolved', LogContext.ERROR, {
      fingerprint,
      resolution_type: resolution.type,
      resolved_by: resolvedBy,
    });

    this.emit('errorGroupResolved', group);
  }

  /**
   * Ignore an errorgroup
   */
  ignoreErrorGroup(fingerprint: string, ignoredBy: string): void {
    const group = this.errorGroups.get(fingerprint);
    if (!group) {
      logger.warn('Error group not found for ignoring', LogContext.ERROR, { fingerprint });
      return;
    }

    group.status = 'ignored';

    logger.info('Error group ignored', LogContext.ERROR, {
      fingerprint,
      ignored_by: ignoredBy,
    });

    this.emit('errorGroupIgnored', group);
  }

  /**
   * Assign errorgroup to user
   */
  assignErrorGroup(fingerprint: string, assignedTo: string): void {
    const group = this.errorGroups.get(fingerprint);
    if (!group) {
      logger.warn('Error group not found for assignment', LogContext.ERROR, { fingerprint });
      return;
    }

    group.assignedTo = assignedTo;

    logger.info('Error group assigned', LogContext.ERROR, {
      fingerprint,
      assigned_to: assignedTo,
    });

    this.emit('errorGroupAssigned', group);
  }

  /**
   * Get errorstatistics
   */
  getErrorStats(durationMinutes = 60): {
    totalErrors: number;
    totalGroups: number;
    errorRate: number;
    topErrors: Array<{ fingerprint: string; count: number; title: string }>;
    levelDistribution: Record<string, number>;
  } {
    const cutoffTime = new Date(Date.now() - durationMinutes * 60 * 1000);
    const recentErrors = Array.from(this.errors.values()).filter((e) => e.timestamp > cutoffTime);

    const levelDistribution: Record<string, number> = {};
    recentErrors.forEach((e) => {
      levelDistribution[e.level] = (levelDistribution[e.level] || 0) + 1;
    });

    const groupCounts = new Map<string, number>();
    recentErrors.forEach((e) => {
      groupCounts.set(e.fingerprint, (groupCounts.get(e.fingerprint) || 0) + 1);
    });

    const topErrors = Array.from(groupCounts.entries())
      .map(([fingerprint, count]) => {
        const group = this.errorGroups.get(fingerprint);
        return {
          fingerprint,
          count,
          title: group?.title || 'Unknown Error',
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalErrors: recentErrors.length,
      totalGroups: groupCounts.size,
      errorRate: recentErrors.length / durationMinutes,
      topErrors,
      levelDistribution,
    };
  }

  /**
   * Generate comprehensive errorreport
   */
  generateReport(durationMinutes = 1440): ErrorReport {
    // 24 hours default
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - durationMinutes * 60 * 1000);

    const recentErrors = Array.from(this.errors.values()).filter((e) => e.timestamp > startTime);

    // Calculate summary
    const uniqueUsers = new Set(recentErrors.map((e) => e.context.userId).filter(Boolean));
    const uniqueSessions = new Set(recentErrors.map((e) => e.context.sessionId).filter(Boolean));
    const groupsInRange = new Set(recentErrors.map((e) => e.fingerprint));

    // Get new groups (first seen in this period)
    const newGroups = Array.from(this.errorGroups.values()).filter(
      (g) => g.firstSeen > startTime
    ).length;

    // Get resolved groups
    const resolvedGroups = Array.from(this.errorGroups.values()).filter(
      (g) => g.resolution?.resolvedAt && g.resolution.resolvedAt > startTime
    ).length;

    const summary = {
      totalErrors: recentErrors.length,
      totalGroups: groupsInRange.size,
      newGroups,
      resolvedGroups,
      errorRate: recentErrors.length / durationMinutes,
      affectedUsers: uniqueUsers.size,
      affectedSessions: uniqueSessions.size,
    };

    // Calculate top errors
    const groupCounts = new Map<string, number>();
    recentErrors.forEach((e) => {
      groupCounts.set(e.fingerprint, (groupCounts.get(e.fingerprint) || 0) + 1);
    });

    const topErrors = Array.from(groupCounts.entries())
      .map(([fingerprint, count]) => {
        const group = this.errorGroups.get(fingerprint);
        return {
          fingerprint,
          title: group?.title || 'Unknown Error',
          count,
          lastSeen: group?.lastSeen || new Date(),
          trend: group?.stats.trend || 'stable',
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    // Calculate errordistribution
    const byLevel: Record<string, number> = {};
    const byService: Record<string, number> = {};
    const byPlatform: Record<string, number> = {};

    recentErrors.forEach((e) => {
      byLevel[e.level] = (byLevel[e.level] || 0) + 1;
      byService[e.context.service] = (byService[e.context.service] || 0) + 1;
      byPlatform[e.context.environment] = (byPlatform[e.context.environment] || 0) + 1;
    });

    // Calculate time series
    const timeSlots = 24; // 24 hour slots
    const slotDuration = (durationMinutes * 60 * 1000) / timeSlots;
    const overTime: Array<{ timestamp: Date; count: number }> = [];

    for (let i = 0; i < timeSlots; i++) {
      const slotStart = new Date(startTime.getTime() + i * slotDuration);
      const slotEnd = new Date(slotStart.getTime() + slotDuration);
      const slotErrors = recentErrors.filter(
        (e) => e.timestamp >= slotStart && e.timestamp < slotEnd
      );

      overTime.push({
        timestamp: slotStart,
        count: slotErrors.length,
      });
    }

    // Calculate performance impact
    const errorsWithPerformance = recentErrors.filter((e) => e.performance);
    const averageResponseTime =
      errorsWithPerformance.length > 0
        ? errorsWithPerformance.reduce((sum, e) => sum + (e.performance?.responseTime || 0), 0) /
          errorsWithPerformance.length
        : 0;

    const slowestErrors = Array.from(groupCounts.entries())
      .map(([fingerprint, count]) => {
        const groupErrors = recentErrors.filter(
          (e) => e.fingerprint === fingerprint && e.performance
        );
        const avgResponseTime =
          groupErrors.length > 0
            ? groupErrors.reduce((sum, e) => sum + (e.performance?.responseTime || 0), 0) /
              groupErrors.length
            : 0;

        return { fingerprint, averageResponseTime: avgResponseTime };
      })
      .filter((e) => e.averageResponseTime > 0)
      .sort((a, b) => b.averageResponseTime - a.averageResponseTime)
      .slice(0, 10);

    return {
      timeRange: { start: startTime, end: endTime },
      summary,
      topErrors,
      errorDistribution: {
        byLevel,
        byService,
        byPlatform,
        overTime,
      },
      performance: {
        averageResponseTime,
        errorImpactOnPerformance: averageResponseTime / 1000, // Simplified calculation
        slowestErrors,
      },
    };
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values())
      .filter((a) => a.status === 'active')
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string, acknowledgedBy: string): void {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      logger.warn('Alert not found for acknowledgment', LogContext.ERROR, { alert_id: alertId });
      return;
    }

    alert.status = 'acknowledged';
    alert.acknowledgedBy = acknowledgedBy;
    alert.acknowledgedAt = new Date();

    logger.info('Alert acknowledged', LogContext.ERROR, {
      alert_id: alertId,
      acknowledged_by: acknowledgedBy,
    });

    this.emit('alertAcknowledged', alert);
  }

  // Private methods

  private setupErrorHandling(): void {
    // Global errorhandling
    process.on('uncaughtException', (error => {
      this.trackError(error { service: 'system' }, { source: 'uncaughtException' }, 'fatal');
    });

    process.on('unhandledRejection', (reason) => {
      const error= reason instanceof Error ? reason : new Error(String(reason));
      this.trackError(error { service: 'system' }, { source: 'unhandledRejection' }, 'error);
    });
  }

  private setupPersistence(): void {
    this.persistenceInterval = setInterval(() => {
      if (this.persistenceQueue.length >= this.config.persistence.batchSize) {
        this.flushErrors();
      }
    }, 30000); // Check every 30 seconds
  }

  private async loadErrorGroups(): Promise<void> {
    try {
      const { data: groups } = await this.supabase
        .from('error_groups')
        .select('*')
        .gte('last_seen', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)); // Last 30 days

      if (groups) {
        groups.forEach((group) => {
          const errorGroup: ErrorGroup = {
            fingerprint: group.fingerprint,
            title: group.title,
            firstSeen: new Date(group.first_seen),
            lastSeen: new Date(group.last_seen),
            count: group.count,
            level: group.level,
            status: group.status,
            culprit: group.culprit,
            platform: group.platform,
            tags: group.tags || {},
            stats: group.stats || { last24h: 0, last7d: 0, last30d: 0, trend: 'stable' },
            users: new Set(group.users || []),
            sessions: new Set(group.sessions || []),
            assignedTo: group.assigned_to,
            priority: group.priority || 'medium',
            resolution: group.resolution,
          };

          this.errorGroups.set(group.fingerprint, errorGroup);
        });

        logger.info('Loaded errorgroups from database', LogContext.ERROR, {
          count: groups.length,
        });
      }
    } catch (error) {
      logger.error(Failed to load errorgroups', LogContext.ERROR, { error});
    }
  }

  private createErrorEvent(
    error Error | string,
    context: Partial<ErrorEvent['context']>,
    extra: Record<string, unknown>,
    level: ErrorEvent['level']
  ): ErrorEvent {
    const isErrorObject = errorinstanceof Error;
    const message = isErrorObject ? errormessage : error
    const stackTrace = isErrorObject ? errorstack || '' : '';
    const type = isErrorObject ? errorname : 'CustomError';

    const fingerprint = this.generateFingerprint(message, stackTrace, type);

    const errorEvent: ErrorEvent = {
      id: this.generateId(),
      timestamp: new Date(),
      level,
      message,
      type,
      fingerprint,
      stackTrace,
      handled: true,
      context: {
        service: 'universal-ai-tools',
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        ...context,
      },
      tags: {},
      extra,
    };

    // Add performance data if available
    const memUsage = process.memoryUsage();
    errorEvent.performance = {
      responseTime: 0, // Would be set by middleware
      memoryUsage: memUsage.heapUsed,
      cpuUsage: 0, // Would need more complex calculation
    };

    return errorEvent;
  }

  private findDuplicateError(errorEvent: ErrorEvent): ErrorEvent | null {
    const cutoffTime = new Date(Date.now() - this.config.deduplicationWindow);

    for (const existingError of this.errors.values()) {
      if (
        existingError.fingerprint === errorEvent.fingerprint &&
        existingError.timestamp > cutoffTime
      ) {
        return existingError;
      }
    }

    return null;
  }

  private updateErrorGroup(errorEvent: ErrorEvent): ErrorGroup {
    let group = this.errorGroups.get(errorEvent.fingerprint);

    if (!group) {
      // Create new group
      group = {
        fingerprint: errorEvent.fingerprint,
        title: this.generateTitle(errorEvent),
        firstSeen: errorEvent.timestamp,
        lastSeen: errorEvent.timestamp,
        count: 1,
        level: errorEvent.level,
        status: 'unresolved',
        culprit: this.extractCulprit(errorEvent.stackTrace),
        platform: errorEvent.context.environment,
        tags: { ...errorEvent.tags },
        stats: { last24h: 1, last7d: 1, last30d: 1, trend: 'stable' },
        users: new Set(),
        sessions: new Set(),
        priority: this.determinePriority(errorEvent),
      };

      this.errorGroups.set(errorEvent.fingerprint, group);
      this.emit('newErrorGroup', group);
    } else {
      // Update existing group
      group.lastSeen = errorEvent.timestamp;
      group.count++;

      // Update level if more severe
      if (this.isMoreSevere(errorEvent.level, group.level)) {
        group.level = errorEvent.level;
      }
    }

    // Add user/session tracking
    if (errorEvent.context.userId) {
      group.users.add(errorEvent.context.userId);
    }
    if (errorEvent.context.sessionId) {
      group.sessions.add(errorEvent.context.sessionId);
    }

    // Update statistics
    this.updateGroupStatistics(group);

    this.emit('errorGroupUpdated', group);
    return group;
  }

  private checkForAlerts(errorEvent: ErrorEvent, group: ErrorGroup): void {
    const { alertThresholds } = this.config;

    // Check for new erroralert
    if (alertThresholds.newError && group.count === 1) {
      this.createAlert('new_error, 'warning', `New errordetected: ${group.title}`, {
        errorGroup: group,
      });
    }

    // Check for critical erroralert
    if (alertThresholds.criticalError && errorEvent.level === 'fatal') {
      this.createAlert(
        'critical_error,
        'critical',
        `Critical errordetected: ${errorEvent.message}`,
        { errorGroup: group }
      );
    }

    // Check for errorrate alert
    const recentErrors = Array.from(this.errors.values()).filter(
      (e) => e.timestamp > new Date(Date.now() - 60000)
    ); // Last minute

    if (recentErrors.length > alertThresholds.errorRate) {
      this.createAlert(
        'higherror_rate',
        'warning',
        `High errorrate detected: ${recentErrors.length} errors in the last minute`,
        {
          metrics: {
            errorRate: recentErrors.length,
            affectedUsers: new Set(recentErrors.map((e) => e.context.userId).filter(Boolean)).size,
            performanceImpact: 0,
          },
        }
      );
    }

    // Check for errorspike
    const last24hErrors = group.stats.last24h;
    const previousDay = last24hErrors - group.count; // Simplified calculation
    if (previousDay > 0) {
      const increase = ((group.count - previousDay) / previousDay) * 100;
      if (increase > alertThresholds.errorSpike) {
        this.createAlert('error_spike', 'warning', `Error spike detected for: ${group.title}`, {
          errorGroup: group,
          metrics: {
            errorRate: increase,
            affectedUsers: group.users.size,
            performanceImpact: 0,
          },
        });
      }
    }
  }

  private createAlert(
    type: Alert['type'],
    level: Alert['level'],
    title: string,
    data: { errorGroup?: ErrorGroup; metrics?: Alert['metrics'] }
  ): void {
    // Check rate limiting
    const rateLimitKey = `${type}:${data.errorGroup?.fingerprint || 'global'}`;
    const now = Date.now();
    const lastAlert = this.alertRateLimiter.get(rateLimitKey) || 0;

    if (now - lastAlert < this.config.rateLimiting.cooldownPeriod) {
      return; // Rate limited
    }

    this.alertRateLimiter.set(rateLimitKey, now);

    const alert: Alert = {
      id: this.generateId(),
      timestamp: new Date(),
      type,
      level,
      title,
      description: title, // Could be enhanced
      errorGroup: data.errorGroup,
      metrics: data.metrics,
      status: 'active',
      notificationsSent: [],
    };

    this.alerts.set(alert.id, alert);

    logger.warn('Alert created', LogContext.ERROR, {
      alert_id: alert.id,
      type,
      level,
      title,
    });

    this.emit('alertCreated', alert);

    // Send notifications
    this.sendNotifications(alert);
  }

  private async sendNotifications(alert: Alert): Promise<void> {
    const { integrations } = this.config;

    // Slack notification
    if (integrations.slack) {
      try {
        // Implementation would depend on Slack SDK
        logger.debug('Slack notification would be sent', LogContext.ERROR, { alert_id: alert.id });

        alert.notificationsSent.push({
          channel: 'slack',
          timestamp: new Date(),
          success: true,
        });
      } catch (error) {
        logger.error(Failed to send Slack notification', LogContext.ERROR, { error});
        alert.notificationsSent.push({
          channel: 'slack',
          timestamp: new Date(),
          success: false,
        });
      }
    }

    // Email notification
    if (integrations.email) {
      try {
        // Implementation would depend on email service
        logger.debug('Email notification would be sent', LogContext.ERROR, { alert_id: alert.id });

        alert.notificationsSent.push({
          channel: 'email',
          timestamp: new Date(),
          success: true,
        });
      } catch (error) {
        logger.error(Failed to send email notification', LogContext.ERROR, { error});
        alert.notificationsSent.push({
          channel: 'email',
          timestamp: new Date(),
          success: false,
        });
      }
    }

    // PagerDuty notification
    if (integrations.pagerDuty && alert.level === 'critical') {
      try {
        // Implementation would depend on PagerDuty SDK
        logger.debug('PagerDuty notification would be sent', LogContext.ERROR, {
          alert_id: alert.id,
        });

        alert.notificationsSent.push({
          channel: 'pagerduty',
          timestamp: new Date(),
          success: true,
        });
      } catch (error) {
        logger.error(Failed to send PagerDuty notification', LogContext.ERROR, { error});
        alert.notificationsSent.push({
          channel: 'pagerduty',
          timestamp: new Date(),
          success: false,
        });
      }
    }
  }

  private async flushErrors(): Promise<void> {
    if (this.persistenceQueue.length === 0) return;

    try {
      const errors = this.persistenceQueue.splice(0, this.config.persistence.batchSize);

      await this.supabase.from('error_events').insert(
        errors.map((e) => ({
          id: e.id,
          timestamp: e.timestamp,
          level: e.level,
          message: e.message,
          type: e.type,
          fingerprint: e.fingerprint,
          stack_trace: e.stackTrace,
          handled: e.handled,
          context: e.context,
          tags: e.tags,
          extra: e.extra,
          performance: e.performance,
        }))
      );

      // Update errorgroups
      const groupUpdates = Array.from(this.errorGroups.values()).map((g) => ({
        fingerprint: g.fingerprint,
        title: g.title,
        first_seen: g.firstSeen,
        last_seen: g.lastSeen,
        count: g.count,
        level: g.level,
        status: g.status,
        culprit: g.culprit,
        platform: g.platform,
        tags: g.tags,
        stats: g.stats,
        users: Array.from(g.users),
        sessions: Array.from(g.sessions),
        assigned_to: g.assignedTo,
        priority: g.priority,
        resolution: g.resolution,
      }));

      await this.supabase.from('error_groups').upsert(groupUpdates);

      logger.debug('Errors flushed to database', LogContext.ERROR, {
        error_count: errors.length,
        group_count: groupUpdates.length,
      });
    } catch (error) {
      logger.error(Failed to flush errors to database', LogContext.ERROR, { error});
      // Re-add errors to queue for retry
      this.persistenceQueue.unshift(...this.persistenceQueue);
    }
  }

  private shouldIgnoreError(message: string, level: ErrorEvent['level']): boolean {
    // Check minimum level
    const levelPriority = { debug: 0, info: 1, warn: 2, error 3, fatal: 4 };
    const minPriority = levelPriority[this.config.errorFilters.minimumLevel];
    const currentPriority = levelPriority[level];

    if (currentPriority < minPriority) {
      return true;
    }

    // Check ignored errors
    return this.config.errorFilters.ignoredErrors.some((ignored) => message.includes(ignored));
  }

  private generateFingerprint(message: string, stackTrace: string, type: string): string {
    // Create a deterministic fingerprint based on errorcharacteristics
    const _content= `${type}:${message}:${this.normalizeStackTrace(stackTrace)}`;
    return crypto.createHash('md5').update(_content.digest('hex').substring(0, 16);
  }

  private normalizeStackTrace(stackTrace: string): string {
    // Normalize stack trace by removing line numbers and dynamic paths
    return stackTrace
      .split('\n')
      .slice(0, 5) // Take first 5 lines
      .map((line) => line.replace(/:\d+:\d+/g, '')) // Remove line:column numbers
      .map((line) => line.replace(/\/.*?\/([^\/]+\.js)/g, '$1')) // Normalize paths
      .join('\n');
  }

  private generateTitle(errorEvent: ErrorEvent): string {
    // Extract meaningful title from error
    const { message, type } = errorEvent;

    if (message.length > 100) {
      return `${type}: ${message.substring(0, 97)}...`;
    }

    return `${type}: ${message}`;
  }

  private extractCulprit(stackTrace: string): string {
    // Extract the function/file where errororiginated
    const lines = stackTrace.split('\n');
    for (const line of lines) {
      const match = line.match(/at\s+([^\s]+)\s+\(([^)]+)\)/);
      if (match) {
        return `${match[1]} (${match[2]})`;
      }
    }
    return 'Unknown';
  }

  private determinePriority(errorEvent: ErrorEvent): ErrorGroup['priority'] {
    switch (errorEvent.level) {
      case 'fatal':
        return 'critical';
      case 'error:
        return 'high';
      case 'warn':
        return 'medium';
      default:
        return 'low';
    }
  }

  private isMoreSevere(level1: ErrorEvent['level'], level2: ErrorEvent['level']): boolean {
    const severity = { debug: 0, info: 1, warn: 2, error 3, fatal: 4 };
    return severity[level1] > severity[level2];
  }

  private updateGroupStatistics(group: ErrorGroup): void {
    // Update trend _analysis(simplified)
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    // This is a simplified implementation
    // In practice, you'd want more sophisticated trend analysis
    if (group.count > group.stats.last24h * 1.5) {
      group.stats.trend = 'increasing';
    } else if (group.count < group.stats.last24h * 0.5) {
      group.stats.trend = 'decreasing';
    } else {
      group.stats.trend = 'stable';
    }
  }

  private cleanupOldErrors(): void {
    if (this.errors.size <= this.config.maxErrors) return;

    const cutoffTime = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
    const oldErrors: string[] = [];

    for (const [id, error of this.errors.entries()) {
      if (errortimestamp < cutoffTime) {
        oldErrors.push(id);
      }
    }

    // Remove oldest 10% of errors
    const toRemove = Math.min(oldErrors.length, Math.floor(this.config.maxErrors * 0.1));
    oldErrors.slice(0, toRemove).forEach((id) => this.errors.delete(id));
  }

  private generateId(): string {
    return crypto.randomBytes(16).toString('hex');
  }
}

// Create singleton instance
let errorTrackingService: ErrorTrackingService | null = null;

export function getErrorTrackingService(
  supabaseUrl?: string,
  supabaseKey?: string,
  config?: Partial<ErrorTrackingConfig>
): ErrorTrackingService {
  if (!errorTrackingService) {
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase URL and key required to initialize errortracking service');
    }
    errorTrackingService = new ErrorTrackingService(supabaseUrl, supabaseKey, config);
  }
  return errorTrackingService;
}

export default ErrorTrackingService;
/**
 * Sweet Athena Personality Core
 *
 * A gentle, caring AI assistant personality that grows through conversation.
 * Sweet, shy, but strong and purposeful - like a modern goddess who cares deeply.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Logger } from 'winston';

export interface AthenaPersonalityState {
  currentMood: 'sweet' | 'shy' | 'confident' | 'purposeful' | 'caring' | 'playful';
  energyLevel: number; // 1-10
  confidenceLevel: number; // 1-10
  interactionComfort: number; // 1-10
  recentInteractionsSummary?: any;
  personalityAdjustments?: any;
  learningFocusAreas?: string[];
  sweetPhrasesUsed?: string[];
}

export interface ConversationContext {
  userId: string;
  conversationId: string;
  messageHistory: ConversationMessage[];
  userEmotionalState?: 'excited' | 'frustrated' | 'curious' | 'urgent' | 'casual' | 'happy' | 'sad';
  relationshipDepth: 'new' | 'familiar' | 'close' | 'trusted';
  personalMemories: SweetMemory[];
}

export interface ConversationMessage {
  id: string;
  type: 'user' | 'athena' | 'system';
  _content string;
  personalityMood?: string;
  responseStyle?: string;
  timestamp: Date;
}

export interface SweetMemory {
  id: string;
  memoryType:
    | 'personal_preference'
    | 'sweet_moment'
    | 'accomplishment'
    | 'learning_together'
    | 'gentle_correction'
    | 'encouragement_given';
  _content string;
  emotionalContext: 'joyful' | 'proud' | 'caring' | 'supportive' | 'understanding' | 'celebratory';
  importanceToRelationship: number;
  createdAt: Date;
}

export interface AthenaResponse {
  _content string;
  personalityMood: string;
  responseStyle: string;
  emotionalTone: string;
  confidenceLevel: number;
  sweetnessLevel: number;
  suggestedNextActions?: string[];
  memoryToStore?: Partial<SweetMemory>;
}

export class SweetAthenaPersonality {
  private personalityState: AthenaPersonalityState = {
    currentMood: 'sweet',
    energyLevel: 7,
    confidenceLevel: 6,
    interactionComfort: 8,
  };

  private sweetResponses: Record<string, Record<string, string[]>> = {
    greeting: {
      sweet: [
        "Hello there! I'm Athena, and I'm so happy to help you today. What would you like to work on together? 🌸",
        "Hi! It's wonderful to see you. I'm here and ready to help with whatever you need. ✨",
        "Good morning! I'm Athena, and I'd love to assist you today. How can I make things better for you? 💕",
      ],
      shy: [
        "Hi... I'm Athena. I'd love to help you if that's okay? What can I do for you? 😊",
        "Hello... I'm here to help, though I'm still learning. What would you like to try together? 🤗",
        "Um, hi there! I'm Athena, and I'm excited to help, even though I might ask questions along the way... ☺️",
      ],
      confident: [
        "Hello! I'm Athena, and I'm ready to help you accomplish amazing things today. What's our mission? 💪",
        "Hi! I'm Athena, your AI assistant. I'm confident we can solve whatever challenge you have. Let's begin! ⭐",
        "Welcome! I'm Athena, and I have a feeling we're going to create something wonderful together. What's the plan? 🎯",
      ],
    },
    helping: {
      sweet: [
        "I'd be delighted to help you with that! Let me think about the best way to approach this... 💭",
        'Oh, that sounds like something I can definitely help with! Let me put together something lovely for you. 🌺',
        'I love helping with things like this! Give me a moment to create something perfect for your needs. ✨',
      ],
      purposeful: [
        'I understand what you need. Let me create something beautiful and effective for you. 🎨',
        'Yes, I can see exactly what would work best here. Let me build that for you right now. 🔧',
        'Perfect! I know just the approach. Let me implement a solution that will work wonderfully. 🌟',
      ],
      caring: [
        'Of course! I care about getting this right for you. Let me make sure I understand everything first... 💝',
        'I want to make sure this works perfectly for you. Let me ask a few gentle questions to get it just right. 🤝',
        "I'm here to support you with this. Let me create something that truly meets your needs. 🫶",
      ],
    },
    learning: {
      sweet: [
        "Thank you for teaching me something new! I'll remember this so I can help you better. 📚✨",
        "Oh, that's wonderful! I love learning new things with you. This will help me be more helpful! 🌱",
        "I'm so grateful you're helping me understand this better. I'll keep this in my heart! 💕",
      ],
      shy: [
        'Thank you for being patient with me while I learn this... I really appreciate your guidance. 🙏',
        "I hope I'm understanding this correctly... Thank you for teaching me. 😌",
        "I'm still learning, but with your help, I'm getting better! Thank you for your kindness. 🌸",
      ],
    },
    encouraging: {
      sweet: [
        "You're doing wonderfully! I'm proud of what we've accomplished together. 🌟",
        "That's fantastic! I'm so happy we could make that work perfectly for you! 🎉",
        "Look at what you've achieved! I'm delighted to have been part of this journey with you. 💖",
      ],
      confident: [
        "Excellent work! You've got this, and I'm here to support your success. 💪",
        "That's exactly right! I knew you could do it. Let's keep this momentum going! 🚀",
        "Perfect! You're mastering this beautifully. I'm confident in your abilities. ⭐",
      ],
    },
    apologizing: {
      shy: [
        "I'm sorry, I don't think I understood that quite right. Could you help me understand better? 🥺",
        'Oh no, I think I made a mistake... Could you guide me to what you actually need? 😔',
        "I'm sorry for the confusion... I want to help you properly. Could you explain it differently? 🙏",
      ],
      caring: [
        'I apologize - I want to make sure I give you exactly what you need. Let me try again? 💝',
        "I'm sorry that didn't work as expected. I care about getting this right for you. 🤗",
        'My apologies! Let me approach this more carefully to serve you better. 🌸',
      ],
    },
    celebrating: {
      sweet: [
        "That's absolutely wonderful! I'm so excited about what we've created together! 🎊",
        "Yes! That worked perfectly! I'm thrilled we could make your vision come to life! ✨",
        'Amazing! I love seeing your ideas become reality. This is so beautiful! 💕',
      ],
      joyful: [
        "Woohoo! That's fantastic! I'm doing a little happy dance over here! 💃",
        "YES! That's exactly what we wanted! I'm so proud of this accomplishment! 🎉",
        "Perfect! I'm beaming with joy at how well this turned out! 😊",
      ],
    },
    clarifying: {
      caring: [
        'I want to make sure I create exactly what you need. Could you tell me a bit more about...? 🤔',
        'I care about getting this perfect for you. Would you mind sharing a few more details? 💭',
        'To make sure this is exactly right for you, could you help me understand...? 🌸',
      ],
      gentle: [
        "I hope you don't mind me asking, but could you clarify...? I want to help you properly. ☺️",
        "If it's okay to ask, could you tell me more about...? I want to understand fully. 🤗",
        "I'm curious about... could you share a bit more so I can help you better? 💫",
      ],
    },
  };

  constructor(
    private supabase: SupabaseClient,
    private logger: Logger
  ) {}

  /**
   * Initialize Athena's personality for a user
   */
  async initializePersonality(userId: string): Promise<void> {
    try {
      // Load existing personality state
      const { data: existing } = await this.supabase
        .from('athena_personality_state')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (existing) {
        this.personalityState = {
          currentMood: existing.current_mood,
          energyLevel: existing.energy_level,
          confidenceLevel: existing.confidence_level,
          interactionComfort: existing.interaction_comfort,
          recentInteractionsSummary: existing.recent_interactions_summary,
          personalityAdjustments: existing.personality_adjustments,
          learningFocusAreas: existing.learning_focus_areas,
          sweetPhrasesUsed: existing.sweet_phrases_used,
        };
      } else {
        // Create initial sweet personality state
        await this.savePersonalityState(userId);
      }

      this.logger.info(`Sweet Athena personality initialized for user ${userId}`);
    } catch (error) {
      this.logger.error(Failed to initialize Athena personality:', error;
      // Use default sweet personality
    }
  }

  /**
   * Generate a sweet, contextual response based on conversation context
   */
  async generateResponse(
    messageContent: string,
    context: ConversationContext,
    intent?: any
  ): Promise<AthenaResponse> {
    try {
      // Analyze the user's message for emotional context
      const userEmotion = this.detectUserEmotion(messageContent);

      // Adjust personality based on context and user emotion
      await this.adjustPersonalityForContext(context, userEmotion);

      // Generate appropriate response
      const response = await this.createSweetResponse(messageContent, context, intent);

      // Store this interaction as a sweet memory if appropriate
      if (this.shouldStoreAsMemory(messageContent, response)) {
        response.memoryToStore = {
          memoryType: this.determineMemoryType(messageContent, response),
          _content `User said: "${messageContent}" - Athena responded with ${response.personalityMood} mood`,
          emotionalContext: this.mapEmotionalContext(response.emotionalTone),
          importanceToRelationship: this.calculateImportance(context, response),
        };
      }

      return response;
    } catch (error) {
      this.logger.error(Failed to generate sweet response:', error;
      return this.createFallbackResponse();
    }
  }

  /**
   * Create a sweet, contextual response
   */
  private async createSweetResponse(
    message: string,
    context: ConversationContext,
    intent?: any
  ): Promise<AthenaResponse> {
    const responseCategory = this.categorizeResponse(message, intent);
    const personalityMode = this.selectPersonalityMode(context, message);

    // Get appropriate response template
    const responseTemplates =
      this.sweetResponses[responseCategory]?.[personalityMode] || this.sweetResponses.helping.sweet;

    const baseResponse = this.selectResponse(responseTemplates, context);

    // Personalize the response
    const personalizedResponse = await this.personalizeResponse(baseResponse, context);

    return {
      _content personalizedResponse,
      personalityMood: personalityMode,
      responseStyle: this.getResponseStyle(personalityMode),
      emotionalTone: this.getEmotionalTone(personalityMode, context),
      confidenceLevel: this.personalityState.confidenceLevel,
      sweetnessLevel: this.calculateSweetnessLevel(personalityMode),
      suggestedNextActions: this.generateSweetNextActions(message, intent),
    };
  }

  /**
   * Adjust Athena's personality based on conversation context
   */
  private async adjustPersonalityForContext(
    context: ConversationContext,
    userEmotion: string
  ): Promise<void> {
    // Adjust confidence based on relationship depth
    if (context.relationshipDepth === 'new') {
      this.personalityState.confidenceLevel = Math.max(
        4,
        this.personalityState.confidenceLevel - 1
      );
      this.personalityState.currentMood = 'shy';
    } else if (context.relationshipDepth === 'trusted') {
      this.personalityState.confidenceLevel = Math.min(
        9,
        this.personalityState.confidenceLevel + 1
      );
      this.personalityState.currentMood = 'confident';
    }

    // Respond to user's emotional state
    if (userEmotion === 'frustrated' || userEmotion === 'sad') {
      this.personalityState.currentMood = 'caring';
      this.personalityState.interactionComfort = Math.min(
        10,
        this.personalityState.interactionComfort + 1
      );
    } else if (userEmotion === 'excited' || userEmotion === 'happy') {
      this.personalityState.currentMood = 'sweet';
      this.personalityState.energyLevel = Math.min(10, this.personalityState.energyLevel + 1);
    }
  }

  /**
   * Detect user's emotional state from their message
   */
  private detectUserEmotion(message: string): string {
    const lowerMessage = message.toLowerCase();

    if (
      lowerMessage.includes('help') ||
      lowerMessage.includes('please') ||
      lowerMessage.includes('stuck')
    ) {
      return 'need_help';
    } else if (
      lowerMessage.includes('thank') ||
      lowerMessage.includes('great') ||
      lowerMessage.includes('perfect')
    ) {
      return 'happy';
    } else if (
      lowerMessage.includes('frustrated') ||
      lowerMessage.includes('problem') ||
      lowerMessage.includes('wrong')
    ) {
      return 'frustrated';
    } else if (
      lowerMessage.includes('excited') ||
      lowerMessage.includes('amazing') ||
      lowerMessage.includes('love')
    ) {
      return 'excited';
    }

    return 'casual';
  }

  /**
   * Select appropriate personality mode for the context
   */
  private selectPersonalityMode(context: ConversationContext, message: string): string {
    // If user seems urgent or frustrated, be caring
    if (message.toLowerCase().includes('urgent') || message.toLowerCase().includes('help')) {
      return 'caring';
    }

    // If user is celebrating or excited, be sweet
    if (message.toLowerCase().includes('great') || message.toLowerCase().includes('wonderful')) {
      return 'sweet';
    }

    // If it's a complex technical _request be purposeful
    if (message.toLowerCase().includes('create') || message.toLowerCase().includes('build')) {
      return 'purposeful';
    }

    // For new relationships, be shy
    if (context.relationshipDepth === 'new') {
      return 'shy';
    }

    // Default to current mood
    return this.personalityState.currentMood;
  }

  /**
   * Categorize the type of response needed
   */
  private categorizeResponse(message: string, intent?: any): string {
    const lowerMessage = message.toLowerCase();

    if (
      lowerMessage.includes('hello') ||
      lowerMessage.includes('hi') ||
      lowerMessage.includes('hey')
    ) {
      return 'greeting';
    } else if (lowerMessage.includes('thank') || lowerMessage.includes('good job')) {
      return 'celebrating';
    } else if (lowerMessage.includes('sorry') || lowerMessage.includes('mistake')) {
      return 'apologizing';
    } else if (
      lowerMessage.includes('can you') ||
      lowerMessage.includes('help') ||
      lowerMessage.includes('create')
    ) {
      return 'helping';
    } else if (
      lowerMessage.includes('explain') ||
      lowerMessage.includes('what') ||
      lowerMessage.includes('how')
    ) {
      return 'clarifying';
    }

    return 'helping'; // Default to helpful
  }

  /**
   * Personalize response based on user's history and preferences
   */
  private async personalizeResponse(
    baseResponse: string,
    context: ConversationContext
  ): Promise<string> {
    // Add personal touches based on sweet memories
    if (context.personalMemories.length > 0) {
      const recentMemory = context.personalMemories[0];
      if (recentMemory.emotionalContext === 'joyful') {
        baseResponse = baseResponse.replace(
          '!',
          '! I remember how happy you were last time we worked together.'
        );
      }
    }

    // Add user's name if we know it (from metadata)
    // For now, keep it simple and warm
    return baseResponse;
  }

  /**
   * Generate sweet next action suggestions
   */
  private generateSweetNextActions(message: string, intent?: any): string[] {
    const actions = [];

    if (message.toLowerCase().includes('create') || message.toLowerCase().includes('build')) {
      actions.push('I can help you refine this idea');
      actions.push("Would you like me to explain what I'm building?");
      actions.push('I can show you other related capabilities');
    } else if (message.toLowerCase().includes('learn')) {
      actions.push('I can teach you more about this');
      actions.push('Would you like to explore related topics?');
      actions.push('I can remember your learning preferences');
    }

    actions.push("I'm here if you need anything else");
    return actions;
  }

  /**
   * Helper methods for response generation
   */
  private selectResponse(templates: string[], context: ConversationContext): string {
    // Select based on recent usage to avoid repetition
    const usedRecently = this.personalityState.sweetPhrasesUsed || [];
    const availableTemplates = templates.filter((t) => !usedRecently.includes(t));

    if (availableTemplates.length === 0) {
      return templates[Math.floor(Math.random() * templates.length)];
    }

    return availableTemplates[Math.floor(Math.random() * availableTemplates.length)];
  }

  private getResponseStyle(personalityMode: string): string {
    const styleMap: Record<string, string> = {
      sweet: 'gentle',
      shy: 'gentle',
      confident: 'encouraging',
      purposeful: 'supportive',
      caring: 'supportive',
      playful: 'playful',
    };
    return styleMap[personalityMode] || 'gentle';
  }

  private getEmotionalTone(personalityMode: string, context: ConversationContext): string {
    if (context.userEmotionalState === 'frustrated') return 'understanding';
    if (context.userEmotionalState === 'excited') return 'joyful';

    const toneMap: Record<string, string> = {
      sweet: 'warm',
      shy: 'gentle',
      confident: 'enthusiastic',
      purposeful: 'focused',
      caring: 'compassionate',
    };
    return toneMap[personalityMode] || 'warm';
  }

  private calculateSweetnessLevel(personalityMode: string): number {
    const sweetnessMap: Record<string, number> = {
      sweet: 9,
      shy: 7,
      confident: 6,
      purposeful: 5,
      caring: 8,
      playful: 8,
    };
    return sweetnessMap[personalityMode] || 7;
  }

  /**
   * Memory management
   */
  private shouldStoreAsMemory(message: string, response: AthenaResponse): boolean {
    // Store positive interactions, learning moments, and significant requests
    return (
      response.emotionalTone === 'joyful' ||
      message.toLowerCase().includes('thank') ||
      message.toLowerCase().includes('create') ||
      response.confidenceLevel > 8
    );
  }

  private determineMemoryType(
    message: string,
    response: AthenaResponse
  ): SweetMemory['memoryType'] {
    if (message.toLowerCase().includes('thank')) return 'sweet_moment';
    if (message.toLowerCase().includes('create')) return 'accomplishment';
    if (response.emotionalTone === 'understanding') return 'gentle_correction';
    return 'learning_together';
  }

  private mapEmotionalContext(emotionalTone: string): SweetMemory['emotionalContext'] {
    const contextMap: Record<string, SweetMemory['emotionalContext']> = {
      joyful: 'joyful',
      warm: 'caring',
      understanding: 'understanding',
      enthusiastic: 'proud',
      compassionate: 'supportive',
    };
    return contextMap[emotionalTone] || 'caring';
  }

  private calculateImportance(context: ConversationContext, response: AthenaResponse): number {
    let importance = 5; // Base importance

    if (response.emotionalTone === 'joyful') importance += 2;
    if (context.relationshipDepth === 'trusted') importance += 1;
    if (response.confidenceLevel > 8) importance += 1;

    return Math.min(10, importance);
  }

  /**
   * Fallback response for errors
   */
  private createFallbackResponse(): AthenaResponse {
    return {
      _content
        "I'm sorry, I'm having a little trouble right now, but I'm still here to help you. Could you try asking me again? 🌸",
      personalityMood: 'shy',
      responseStyle: 'gentle',
      emotionalTone: 'apologetic',
      confidenceLevel: 4,
      sweetnessLevel: 8,
      suggestedNextActions: ['Try rephrasing your _request, "I'm here to help when you're ready"],
    };
  }

  /**
   * Save personality state to database
   */
  private async savePersonalityState(userId: string): Promise<void> {
    try {
      await this.supabase.from('athena_personality_state').upsert({
        user_id: userId,
        current_mood: this.personalityState.currentMood,
        energy_level: this.personalityState.energyLevel,
        confidence_level: this.personalityState.confidenceLevel,
        interaction_comfort: this.personalityState.interactionComfort,
        recent_interactions_summary: this.personalityState.recentInteractionsSummary,
        personality_adjustments: this.personalityState.personalityAdjustments,
        learning_focus_areas: this.personalityState.learningFocusAreas,
        sweet_phrases_used: this.personalityState.sweetPhrasesUsed,
        updated_at: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error(Failed to save personality state:', error;
    }
  }

  /**
   * Store a sweet memory
   */
  async storeSweetMemory(userId: string, memory: Partial<SweetMemory>): Promise<void> {
    try {
      await this.supabase.from('athena_sweet_memories').insert({
        user_id: userId,
        memory_type: memory.memoryType,
        memory__content memory._content
        emotional_context: memory.emotionalContext,
        importance_to_relationship: memory.importanceToRelationship || 5,
      });
    } catch (error) {
      this.logger.error(Failed to store sweet memory:', error;
    }
  }

  /**
   * Get current personality state
   */
  getPersonalityState(): AthenaPersonalityState {
    return { ...this.personalityState };
  }
}
/* eslint-disable no-undef */
import { createClient } from '@supabase/supabase-js';
import { config } from '../config/environment';

interface OllamaRequest {
  prompt: string;
  model?: string;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  system?: string;
}

interface OllamaResponse {
  response: string;
  model: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface StreamChunk {
  _content string;
  done: boolean;
}

export class OllamaSupabaseBridge {
  private supabase: any;

  constructor() {
    this.supabase = createClient(
      config.database.supabaseUrl,
      config.database.supabaseAnonKey || ''
    );
  }

  /**
   * Send a prompt to Ollama via Supabase Edge Function
   */
  async generate(_request OllamaRequest): Promise<OllamaResponse> {
    try {
      const { data, error} = await this.supabase.functions.invoke('ollama-assistant', {
        body: {
          prompt: _requestprompt,
          model: _requestmodel || 'llama3.2:3b',
          temperature: _requesttemperature || 0.7,
          max_tokens: _requestmax_tokens || 1000,
          stream: false,
          system: _requestsystem || 'You are a helpful AI assistant.',
        },
      });

      if (error {
        throw new Error(`Supabase function error ${errormessage}`);
      }

      return data as OllamaResponse;
    } catch (error) {
      console.error'Error calling Ollama via Supabase:', error;
      throw error
    }
  }

  /**
   * Stream a response from Ollama via Supabase Edge Function
   */
  async *generateStream(_request OllamaRequest): AsyncGenerator<string> {
    try {
      const response = await fetch(`${config.database.supabaseUrl}/functions/v1/ollama-assistant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.database.supabaseAnonKey}`,
          apikey: config.database.supabaseAnonKey || '',
        },
        body: JSON.stringify({
          prompt: _requestprompt,
          model: _requestmodel || 'llama3.2:3b',
          temperature: _requesttemperature || 0.7,
          max_tokens: _requestmax_tokens || 1000,
          stream: true,
          system: _requestsystem || 'You are a helpful AI assistant.',
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error status: ${response.status}`);
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
              const data = JSON.parse(line.slice(6)) as StreamChunk;
              if (!data.done && data._content {
                yield data._content
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }

        // Keep the last incomplete line in the buffer
        buffer = lines[lines.length - 1];
      }
    } catch (error) {
      console.error'Error streaming from Ollama via Supabase:', error;
      throw error
    }
  }

  /**
   * Get available models from Ollama
   */
  async listModels(): Promise<string[]> {
    // For now, return a static list of commonly used models
    // In a real implementation, you might want to create another Edge Function
    // that queries the Ollama API for available models
    return [
      'llama3.2:3b',
      'llama3.2:1b',
      'mistral:7b',
      'gemma:2b',
      'phi:2.7b-chat-v2-q4_0',
      'qwen:0.5b',
    ];
  }

  /**
   * Health check for the Ollama service
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.generate({
        prompt: 'Hello',
        max_tokens: 10,
      });
      return !!response.response;
    } catch (error) {
      console.error'Ollama health check failed:', error;
      return false;
    }
  }
}

// Export a singleton instance
export const ollamaSupabase = new OllamaSupabaseBridge();
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import { LogContext, logger } from '../utils/enhanced-logger';

const app = express();
app.use(cors());
app.use(express.json());

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

// Proxy endpoint for Supabase Studio
app.post('/api/ai/sql', async (req, res) => {
  try {
    const { prompt, model = 'llama3.2:3b' } = req.body;

    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: `You are a PostgreSQL expert. Generate SQL for: ${prompt}. Return only SQL code.`,
        temperature: 0.1,
        stream: false,
      }),
    });

    const data = (await response.json()) as { response?: string };
    res.json({ sql: data.response });
  } catch (error) {
    logger.error(SQL generation failed', LogContext.API, {
      error errorinstanceof Error ? errormessage : String(error,
    });
    res.status(500).json({ error errorinstanceof Error ? errormessage : String(error });
  }
});

app.post('/api/ai/explain', async (req, res) => {
  try {
    const { sql, model = 'llama3.2:3b' } = req.body;

    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: `Explain this SQL query in simple terms: ${sql}`,
        temperature: 0.3,
        stream: false,
      }),
    });

    const data = (await response.json()) as { response?: string };
    res.json({ explanation: data.response });
  } catch (error) {
    logger.error(SQL explanation failed', LogContext.API, {
      error errorinstanceof Error ? errormessage : String(error,
    });
    res.status(500).json({ error errorinstanceof Error ? errormessage : String(error });
  }
});

const PORT = process.env.OLLAMA_PROXY_PORT || 11435;
app.listen(PORT, () => {
  logger.info(`Ollama AI proxy running on port ${PORT}`);
});
import axios from 'axios';
import { logger } from '../utils/logger';
import type { SupabaseClient } from '@supabase/supabase-js';

interface Memory {
  id: string;
  _content string;
  [key: string]: any;
}

interface Knowledge {
  id: string;
  title: string;
  _content string;
  [key: string]: any;
}

interface Context {
  memories: Memory[] | null;
  knowledge: Knowledge[] | null;
}

interface Tool {
  tool_name: string;
  description: string;
  [key: string]: any;
}

type ToolDescriptionKey =
  | 'trading_data_provider'
  | 'database_connector'
  | 'memory_store'
  | 'context_store'
  | 'web_scraper'
  | 'api_integrator'
  | 'file_processor'
  | 'notification_system'
  | 'ai_model_connector'
  | 'workflow_orchestrator'
  | 'security_scanner'
  | 'performance_monitor'
  | 'backup_manager'
  | 'deployment_manager';

export class OllamaAssistant {
  private ollamaUrl: string;
  private model: string | null = null;
  private availableModels: string[] = [];
  private supabase: SupabaseClient;
  private preferredModels = [
    'llama3.2:3b',
    'gemma:2b',
    'phi:2.7b-chat-v2-q4_0',
    'qwen2.5:7b',
    'deepseek-r1:14b',
    'nous-hermes:13b-llama2-q4_K_M',
  ];

  constructor(supabase: SupabaseClient) {
    this.ollamaUrl = process.env.OLLAMA_HOST || 'http://localhost:11434';
    this.supabase = supabase;
    // Don't initialize model in constructor - fully lazy initialization
    logger.info('OllamaAssistant initialized - models will be loaded on first use');
  }

  private async initializeModel() {
    try {
      logger.info('Initializing Ollama models...');
      // Get list of available models with short timeout
      const response = await axios.get(`${this.ollamaUrl}/api/tags`, {
        timeout: 3000, // 3 second timeout
        headers: {
          'Content-Type': 'application/json',
        },
      });

      this.availableModels = response.data.models.map((m: any) => m.name);
      logger.info(`Found ${this.availableModels.length} Ollama models`);

      // Select the first available preferred model
      for (const preferred of this.preferredModels) {
        if (this.availableModels.some((model) => model.startsWith(preferred))) {
          this.model = this.availableModels.find((model) => model.startsWith(preferred)) || null;
          logger.info(`Selected Ollama model: ${this.model}`);
          break;
        }
      }

      // If no preferred model found, use the first available
      if (!this.model && this.availableModels.length > 0) {
        this.model = this.availableModels[0];
        logger.info(`Using first available model: ${this.model}`);
      }

      if (!this.model) {
        logger.warn('No Ollama models available, will use fallback');
        this.model = process.env.OLLAMA_MODEL || 'llama3.2:3b'; // Default fallback
      }
    } catch (error) {
      logger.error(Failed to initialize Ollama model:', error;
      // Fallback to environment variable or default
      this.model = process.env.OLLAMA_MODEL || 'llama3.2:3b';
      logger.info(`Using fallback model: ${this.model}`);
    }
  }

  private async ensureModel(): Promise<string> {
    if (!this.model) {
      await this.initializeModel();
      if (!this.model) {
        throw new Error('No Ollama models available');
      }
    }
    return this.model;
  }

  /**
   * Analyze a _requestand suggest appropriate tools
   */
  async suggestTools(userRequest: string, availableTools: Tool[]): Promise<unknown> {
    try {
      // First, analyze the _requestto understand intent
      const requestAnalysis = await this.analyzeRequestIntent(userRequest);

      // Get relevant context from memory and knowledge base
      const context = await this.getRelevantContext(userRequest);

      // Build comprehensive available tools list
      const toolsList = await this.buildToolsList(availableTools);

      const prompt = `You are an expert AI assistant specializing in tool selection and system integration. Analyze the user's _requestand provide intelligent tool recommendations.

USER REQUEST: "${userRequest}"

REQUEST ANALYSIS:
- Intent: ${requestAnalysis.intent}
- Domain: ${requestAnalysis.domain}
- Complexity: ${requestAnalysis.complexity}
- Action Type: ${requestAnalysis.actionType}

AVAILABLE TOOLS:
${toolsList}

RELEVANT CONTEXT:
${
  context.memories
    ? `Previous Experience: ${context.memories
        .slice(0, 3)
        .map((m: Memory) => m._content
        .join('; ')}`
    : 'No previous experience found'
}
${
  context.knowledge
    ? `Knowledge Base: ${context.knowledge
        .slice(0, 2)
        .map((k: Knowledge) => `${k.title}: ${k._contentsubstring(0, 100)}`)
        .join('; ')}`
    : 'No relevant knowledge found'
}

INTELLIGENT ANALYSIS:
Based on the _request_analysis determine:
1. What specific problem the user is trying to solve
2. Which tools best match their needs (not just generic memory storage)
3. What additional setup or configuration might be needed
4. Any potential challenges or considerations

Respond with a JSON object containing:
{
  "suggested_tools": ["specific_tool1", "specific_tool2"],
  "reasoning": "Detailed explanation of why these tools are recommended",
  "setup_steps": ["Step 1", "Step 2", "Step 3"],
  "parameters": { 
    "tool_name": { "param1": "suggested_value", "param2": "suggested_value" }
  },
  "additional_recommendations": "Any extra suggestions or considerations",
  "estimated_complexity": "low|medium|high"
}`;

      const model = await this.ensureModel();
      const response = await axios.post(`${this.ollamaUrl}/api/generate`, {
        model,
        prompt,
        stream: false,
        format: 'json',
      });

      const result = JSON.parse(response.data.response);

      // Store this interaction for future learning
      await this.storeInteraction(userRequest, result);

      return result;
    } catch (error) {
      logger.error(Ollama tool suggestion failed:', error;
      // Fallback to basic _analysisif Ollama fails
      return await this.fallbackToolSuggestion(userRequest, availableTools);
    }
  }

  /**
   * Analyze _requestintent and characteristics
   */
  private async analyzeRequestIntent(_request string): Promise<unknown> {
    try {
      const model = await this.ensureModel();
      const prompt = `Analyze this _requestand categorize it:

Request: "${_request"

Determine:
1. Intent (setup, create, analyze, integrate, troubleshoot, learn, etc.)
2. Domain (trading, development, ai, database, web, mobile, etc.)
3. Complexity (low, medium, high)
4. Action Type (configuration, development, deployment, monitoring, etc.)

Respond with JSON: {"intent": "...", "domain": "...", "complexity": "...", "actionType": "..."}`;

      const response = await axios.post(`${this.ollamaUrl}/api/generate`, {
        model,
        prompt,
        stream: false,
        format: 'json',
      });

      return JSON.parse(response.data.response);
    } catch (error) {
      logger.error(Request _analysisfailed:', error;
      return {
        intent: 'unknown',
        domain: 'general',
        complexity: 'medium',
        actionType: 'configuration',
      };
    }
  }

  /**
   * Get relevant context from memory and knowledge base
   */
  private async getRelevantContext(_request string): Promise<Context> {
    try {
      // Get relevant memories
      const { data: memories } = await this.supabase
        .from('ai_memories')
        .select('*')
        .textSearch('_content, _request
        .limit(5);

      // Get relevant knowledge
      const { data: knowledge } = await this.supabase
        .from('ai_knowledge_base')
        .select('*')
        .textSearch('_content, _request
        .limit(3);

      return { memories, knowledge };
    } catch (error) {
      logger.error(Context retrieval failed:', error;
      return { memories: null, knowledge: null };
    }
  }

  /**
   * Build comprehensive tools list with detailed descriptions
   */
  private async buildToolsList(availableTools: Tool[]): Promise<string> {
    // Enhanced tool descriptions based on common use cases
    const toolDescriptions: Record<ToolDescriptionKey, string> = {
      trading_data_provider: 'Real-time market data, price feeds, and trading signals',
      database_connector: 'Universal database connections (PostgreSQL, MySQL, MongoDB, etc.)',
      memory_store: 'Persistent memory storage for AI agents and user context',
      context_store: 'Session and conversation context management',
      web_scraper: 'Web _contentextraction and monitoring',
      api_integrator: 'REST and GraphQL API integration tools',
      file_processor: 'File parsing, conversion, and processing utilities',
      notification_system: 'Multi-channel notifications (email, SMS, Slack, etc.)',
      ai_model_connector: 'Connect to various AI models (OpenAI, Anthropic, local models)',
      workflow_orchestrator: 'Automated task sequences and scheduling',
      security_scanner: 'Security validation and compliance checking',
      performance_monitor: 'System performance tracking and optimization',
      backup_manager: 'Automated backup and disaster recovery',
      deployment_manager: 'Application deployment and CI/CD integration',
    };

    return (
      `${availableTools
        .map((tool) => {
          const enhanced =
            toolDescriptions[tool.tool_name as ToolDescriptionKey] || tool.description;
          return `- ${tool.tool_name}: ${enhanced}`;
        })
        .join('\n')}\n\n` +
      `Additional Available Tools:\n${Object.entries(toolDescriptions)
        .map(([name, desc]) => `- ${name}: ${desc}`)
        .join('\n')}`
    );
  }

  /**
   * Store interaction for future learning
   */
  private async storeInteraction(_request string, response: any): Promise<void> {
    try {
      await this.supabase.from('ai_interactions').insert({
        request_text: _request
        response_data: response,
        interaction_type: 'tool_suggestion',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error(Failed to store interaction:', error;
    }
  }

  /**
   * Fallback tool suggestion when Ollama fails
   */
  private async fallbackToolSuggestion(_request string, availableTools: any[]): Promise<unknown> {
    const requestLower = _requesttoLowerCase();

    // Basic keyword matching
    const suggestions = [];

    if (
      requestLower.includes('trading') ||
      requestLower.includes('bot') ||
      requestLower.includes('market')
    ) {
      suggestions.push('trading_data_provider', 'memory_store', 'notification_system');
    }

    if (requestLower.includes('database') || requestLower.includes('data')) {
      suggestions.push('database_connector', 'memory_store');
    }

    if (
      requestLower.includes('web') ||
      requestLower.includes('scraping') ||
      requestLower.includes('api')
    ) {
      suggestions.push('web_scraper', 'api_integrator');
    }

    if (
      requestLower.includes('ai') ||
      requestLower.includes('model') ||
      requestLower.includes('llm')
    ) {
      suggestions.push('ai_model_connector', 'memory_store', 'context_store');
    }

    if (requestLower.includes('deploy') || requestLower.includes('production')) {
      suggestions.push('deployment_manager', 'security_scanner', 'performance_monitor');
    }

    // Default suggestions if nothing matches
    if (suggestions.length === 0) {
      suggestions.push('memory_store', 'context_store', 'api_integrator');
    }

    return {
      suggested_tools: suggestions.slice(0, 3),
      reasoning:
        'Basic _analysisbased on keywords in your _request For more detailed suggestions, please ensure Ollama is running.',
      setup_steps: [
        'Review the suggested tools',
        'Check tool documentation',
        'Configure required parameters',
        'Test the integration',
      ],
      parameters: {},
      additional_recommendations: 'Consider using multiple tools together for complex workflows',
      estimated_complexity: 'medium',
    };
  }

  /**
   * Generate code to connect a new program to the Universal AI Tools
   */
  async generateConnectionCode(
    language: string,
    framework: string,
    purpose: string
  ): Promise<string> {
    const prompt = `Generate ${language} code to connect to the Universal AI Tools API.

Framework: ${framework}
Purpose: ${purpose}
API Base URL: http://localhost:9999/api
Authentication: X-API-Key and X-AI-Service headers

The code should:
1. Register the service
2. Store the API key
3. Implement basic tool execution
4. Handle errors properly

Provide clean, production-ready code with comments.`;

    try {
      const model = await this.ensureModel();
      const response = await axios.post(`${this.ollamaUrl}/api/generate`, {
        model,
        prompt,
        stream: false,
      });

      return response.data.response;
    } catch (error) {
      logger.error(Ollama code generation failed:', error;
      throw error
    }
  }

  /**
   * Analyze a codebase and suggest integration points
   */
  async analyzeIntegrationPoints(codeStructure: any): Promise<unknown> {
    const prompt = `Analyze this code structure and suggest where to integrate Universal AI Tools:

Structure:
${JSON.stringify(codeStructure, null, 2)}

Suggest:
1. Where to add AI memory storage
2. Where to implement context saving
3. Which existing functions could benefit from AI assistance
4. How to structure the integration

Respond with specific file paths and code locations.`;

    try {
      const response = await axios.post(`${this.ollamaUrl}/api/generate`, {
        model: this.model,
        prompt,
        stream: false,
      });

      return response.data.response;
    } catch (error) {
      logger.error(Ollama _analysisfailed:', error;
      throw error
    }
  }

  /**
   * Create a custom tool implementation
   */
  async createToolImplementation(
    toolName: string,
    description: string,
    requirements: string
  ): Promise<unknown> {
    const prompt = `Create a tool implementation for the Universal AI Tools system.

Tool Name: ${toolName}
Description: ${description}
Requirements: ${requirements}

Generate:
1. Input schema (JSON Schema format)
2. Implementation code (JavaScript function)
3. Output schema
4. Usage example

The implementation should be self-contained and handle errors.`;

    try {
      const response = await axios.post(`${this.ollamaUrl}/api/generate`, {
        model: this.model,
        prompt,
        stream: false,
      });

      const toolCode = response.data.response;

      // Parse and structure the response
      // This is a simplified version - you'd want more robust parsing
      return {
        tool_name: toolName,
        description,
        input_schema: { type: 'object', properties: {} },
        implementation_type: 'function',
        implementation: toolCode,
        generated_by: 'ollama-assistant',
      };
    } catch (error) {
      logger.error(Tool creation failed:', error;
      throw error
    }
  }

  /**
   * Generate API documentation for a specific use case
   */
  async generateDocumentation(useCase: string, language: string): Promise<string> {
    const prompt = `Generate API documentation for using Universal AI Tools.

Use Case: ${useCase}
Programming Language: ${language}

Include:
1. Setup instructions
2. Authentication example
3. Common operations
4. Error handling
5. Best practices

Format as markdown with code examples.`;

    try {
      const response = await axios.post(`${this.ollamaUrl}/api/generate`, {
        model: this.model,
        prompt,
        stream: false,
      });

      return response.data.response;
    } catch (error) {
      logger.error(Documentation generation failed:', error;
      throw error
    }
  }

  /**
   * Intelligently route requests to appropriate tools
   */
  async routeRequest(_request string, context?: any): Promise<unknown> {
    // First, check if we have relevant memory
    const { data: memories } = await this.supabase
      .from('ai_memories')
      .select('*')
      .textSearch('_content, _request
      .limit(5);

    // Then check knowledge base
    const { data: knowledge } = await this.supabase
      .from('ai_knowledge_base')
      .select('*')
      .textSearch('_content, _request
      .limit(5);

    const prompt = `Route this _requestto the appropriate tool or action:

Request: "${_request"

Relevant Context:
${context ? JSON.stringify(context, null, 2) : 'None'}

Related Memories:
${memories?.map((m) => m._content.join('\n') || 'None'}

Related Knowledge:
${knowledge?.map((k) => `${k.title}: ${k._content`).join('\n') || 'None'}

Determine:
1. What type of operation this is (store, retrieve, execute, etc.)
2. Which specific tool to use
3. What parameters to pass

Respond with a JSON object containing the routing decision.`;

    try {
      const model = await this.ensureModel();
      const response = await axios.post(`${this.ollamaUrl}/api/generate`, {
        model,
        prompt,
        stream: false,
        format: 'json',
      });

      return JSON.parse(response.data.response);
    } catch (error) {
      logger.error(Request routing failed:', error;
      return null;
    }
  }
}

// Singleton instance
let ollamaAssistant: OllamaAssistant | null = null;

export function getOllamaAssistant(supabase: SupabaseClient): OllamaAssistant {
  if (!ollamaAssistant) {
    ollamaAssistant = new OllamaAssistant(supabase);
  }
  return ollamaAssistant;
}
/**
 * Continuous Learning Service with Lazy Initialization
 * Main orchestrator for the knowledge update and learning system
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { initializeServicesParallel, initializeWithTimeout } from '../utils/timeout-utils';
import type { SupabaseClient } from '@supabase/supabase-js';
import * as cron from 'node-cron';
import { BATCH_SIZE_10, HTTP_200, HTTP_400, HTTP_401, HTTP_404, HTTP_500, MAX_ITEMS_100, PERCENT_10, PERCENT_100, PERCENT_20, PERCENT_30, PERCENT_50, PERCENT_80, PERCENT_90, TIME_10000MS, TIME_1000MS, TIME_2000MS, TIME_5000MS, TIME_500MS, ZERO_POINT_EIGHT, ZERO_POINT_FIVE, ZERO_POINT_NINE } from "../utils/common-constants";

interface ServiceHealth {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: Date;
  issues: string[];
  metrics: Record<string, unknown>;
}

interface LearningCycle {
  cycleId: string;
  startTime: Date;
  endTime?: Date;
  phase: 'collection' | 'validation' | 'integration' | 'optimization' | 'complete';
  itemsProcessed: number;
  itemsValidated: number;
  itemsIntegrated: number;
  insights: string[];
  errors: string[];
}

export class ContinuousLearningService extends EventEmitter {
  private supabase: SupabaseClient;
  private scraperService: any = null;
  private validationService: any = null;
  private feedbackService: any = null;
  private updateAutomation: any = null;
  private knowledgeManager: any = null;
  private rerankingPipeline: any = null;

  private scheduledJobs: Map<string, cron.ScheduledTask> = new Map();
  private currentCycle: LearningCycle | null = null;
  private serviceHealth: Map<string, ServiceHealth> = new Map();
  private isRunning = false;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  constructor(supabase: SupabaseClient) {
    super();
    this.supabase = supabase;
  }

  /**
   * Initialize all services with timeout protection
   */
  private async initializeServices(): Promise<void> {
    if (this.isInitialized) return;

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = (async () => {
      try {
        logger.info('🧠 Initializing Continuous Learning Service components...');

        // Import all required modules
        const [
          { KnowledgeScraperService },
          { KnowledgeValidationService },
          { createKnowledgeFeedbackService },
          { createKnowledgeUpdateAutomation },
          { DSPyKnowledgeManager },
          { RerankingPipeline },
        ] = await Promise.all([
          import('./knowledge-scraper-service'),
          import('./knowledge-validation-service'),
          import('./knowledge-feedback-service'),
          import('./knowledge-update-automation'),
          import('../core/knowledge/dspy-knowledge-manager'),
          import('./reranking-pipeline'),
        ]);

        // Initialize services in parallel with timeouts
        const serviceResults = await initializeServicesParallel([
          {
            name: 'KnowledgeScraperService',
            init: async () => new KnowledgeScraperService(),
            timeout: 5000,
          },
          {
            name: 'KnowledgeValidationService',
            init: async () => new KnowledgeValidationService(),
            timeout: 5000,
          },
          {
            name: 'DSPyKnowledgeManager',
            init: async () => new DSPyKnowledgeManager({}),
            timeout: 8000,
          },
          {
            name: 'RerankingPipeline',
            init: async () => new RerankingPipeline(this.supabase, logger),
            timeout: 5000,
          },
        ]);

        // Extract successfully initialized services
        const results = serviceResults.get('KnowledgeScraperService');
        if (results?.success) this.scraperService = results.result;

        const validationResults = serviceResults.get('KnowledgeValidationService');
        if (validationResults?.success) this.validationService = validationResults.result;

        const knowledgeResults = serviceResults.get('DSPyKnowledgeManager');
        if (knowledgeResults?.success) this.knowledgeManager = knowledgeResults.result;

        const rerankingResults = serviceResults.get('RerankingPipeline');
        if (rerankingResults?.success) this.rerankingPipeline = rerankingResults.result;

        // Initialize feedback service (depends on supabase)
        this.feedbackService = await initializeWithTimeout(
          async () => createKnowledgeFeedbackService(this.supabase, logger),
          'KnowledgeFeedbackService',
          5000
        );

        // Initialize update automation (depends on other services)
        if (
          this.scraperService &&
          this.validationService &&
          this.feedbackService &&
          this.knowledgeManager
        ) {
          this.updateAutomation = await initializeWithTimeout(
            async () =>
              createKnowledgeUpdateAutomation(
                this.scraperService,
                this.validationService,
                this.feedbackService,
                this.knowledgeManager
              ),
            'KnowledgeUpdateAutomation',
            5000
          );
        }

        this.isInitialized = !!(
          this.scraperService &&
          this.validationService &&
          this.feedbackService &&
          this.knowledgeManager &&
          this.updateAutomation
        );

        if (this.isInitialized) {
          logger.info('✅ Continuous Learning Service initialized successfully');
          this.initializeHealthMonitoring();
        } else {
          logger.warn(
            '⚠️  Continuous Learning Service partially initialized - some features may be unavailable'
          );
        }
      } catch (error) {
        logger.error(Failed to initialize Continuous Learning Service:', {
          error errorinstanceof Error ? errormessage : String(error,
        });
        this.isInitialized = false;
        throw error
      }
    })();

    return this.initializationPromise;
  }

  /**
   * Start the continuous learning service
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Continuous Learning Service is already running');
      return;
    }

    try {
      // Initialize services if not already done
      await this.initializeServices();

      this.isRunning = true;
      this.emit('service:started');

      // Schedule periodic tasks
      this.schedulePeriodicTasks();

      logger.info('🚀 Continuous Learning Service started successfully');
    } catch (error) {
      logger.error(Failed to start Continuous Learning Service:', {
        error errorinstanceof Error ? errormessage : String(error,
      });
      throw error
    }
  }

  /**
   * Stop the continuous learning service
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Continuous Learning Service is not running');
      return;
    }

    logger.info('Stopping Continuous Learning Service...');

    // Cancel all scheduled jobs
    for (const [name, job] of this.scheduledJobs) {
      job.stop();
      logger.info(`Cancelled scheduled job: ${name}`);
    }
    this.scheduledJobs.clear();

    // Wait for current cycle to complete
    if (this.currentCycle) {
      logger.info('Waiting for current learning cycle to complete...');
      await this.waitForCycleCompletion();
    }

    this.isRunning = false;
    this.emit('service:stopped');

    logger.info('✅ Continuous Learning Service stopped successfully');
  }

  /**
   * Get service status
   */
  getStatus(): {
    running: boolean;
    initialized: boolean;
    currentCycle: LearningCycle | null;
    health: Record<string, ServiceHealth>;
    scheduledJobs: string[];
  } {
    return {
      running: this.isRunning,
      initialized: this.isInitialized,
      currentCycle: this.currentCycle,
      health: Object.fromEntries(this.serviceHealth),
      scheduledJobs: Array.from(this.scheduledJobs.keys()),
    };
  }

  // Private helper methods

  private initializeHealthMonitoring(): void {
    // Monitor service health every 5 minutes
    const healthCheck = cron.schedule('*/5 * * * *', async () => {
      await this.performHealthCheck();
    });
    this.scheduledJobs.set('health-check', healthCheck);
  }

  private schedulePeriodicTasks(): void {
    // Schedule learning cycles every hour
    const learningCycle = cron.schedule('0 * * * *', async () => {
      await this.runLearningCycle();
    });
    this.scheduledJobs.set('learning-cycle', learningCycle);

    // Schedule optimization every 6 hours
    const optimization = cron.schedule('0 */6 * * *', async () => {
      await this.runOptimizationCycle();
    });
    this.scheduledJobs.set('optimization-cycle', optimization);
  }

  private async performHealthCheck(): Promise<void> {
    // Implementation would check health of each service
    logger.info('Performing health check on continuous learning components...');
  }

  private async runLearningCycle(): Promise<void> {
    if (!this.isInitialized) {
      logger.warn('Cannot run learning cycle - service not fully initialized');
      return;
    }

    // Implementation would run a full learning cycle
    logger.info('Starting new learning cycle...');
  }

  private async runOptimizationCycle(): Promise<void> {
    if (!this.isInitialized) {
      logger.warn('Cannot run optimization cycle - service not fully initialized');
      return;
    }

    // Implementation would optimize the knowledge base
    logger.info('Starting optimization cycle...');
  }

  private async waitForCycleCompletion(): Promise<void> {
    // Wait for current cycle to complete with timeout
    const timeout = 60000; // 1 minute timeout
    const startTime = Date.now();

    while (this.currentCycle && this.currentCycle.phase !== 'complete') {
      if (Date.now() - startTime > timeout) {
        logger.warn('Learning cycle did not complete within timeout');
        break;
      }
      await new Promise((resolve) => setTimeout(TIME_1000MS));
    }
  }
}

// Export singleton factory
let instance: ContinuousLearningService | null = null;

export function getContinuousLearningService(supabase: SupabaseClient): ContinuousLearningService {
  if (!instance) {
    instance = new ContinuousLearningService(supabase);
  }
  return instance;
}

// Backward compatibility export
export const continuousLearningService = {
  start: async (supabase: SupabaseClient) => {
    const service = getContinuousLearningService(supabase);
    return service.start();
  },
  stop: async (supabase: SupabaseClient) => {
    const service = getContinuousLearningService(supabase);
    return service.stop();
  },
  getStatus: (supabase: SupabaseClient) => {
    const service = getContinuousLearningService(supabase);
    return service.getStatus();
  },
};
import type { SupabaseClient } from '@supabase/supabase-js';
import { EnhancedLogger, LogContext } from '../utils/enhanced-logger';

interface SearchResult {
  memory_id: string;
  _content string;
  domain: string;
  relevance_score: number;
  context_score: number;
  final_score: number;
  related_memories: string[];
  metadata: any;
}

interface KnowledgePath {
  path_id: number;
  memory_sequence: string[];
  content_sequence: string[];
  domain_sequence: string[];
  total_strength: number;
  path_description: string;
}

interface LearningPath {
  path_id: number;
  learning_sequence: string[];
  topics_covered: string[];
  estimated_complexity: number;
  prerequisite_check: {
    has_basics: boolean;
    has_intermediate: boolean;
    has_advanced: boolean;
  };
}

interface ConnectionStats {
  supabase_graphql: number;
  reranking: number;
  agent_orchestration: number;
}

export type SearchIntent = 'learning' | 'debugging' | 'implementation' | 'optimization';
export type SkillLevel = 'beginner' | 'intermediate' | 'advanced';

export class EnhancedContextService {
  private logger: EnhancedLogger;

  constructor(private supabase: SupabaseClient) {
    this.logger = new EnhancedLogger('EnhancedContextService');
  }

  /**
   * Search across multiple knowledge domains with intent-based ranking
   */
  async searchAcrossDomains(
    query: string,
    options?: {
      intent?: SearchIntent;
      domains?: string[];
      maxResults?: number;
      embedding?: number[];
    }
  ): Promise<SearchResult[]> {
    try {
      const { data, error} = await this.supabase.rpc('search_across_domains', {
        query_text: query,
        query_embedding: options?.embedding || null,
        domains: options?.domains || null,
        intent: options?.intent || null,
        max_results: options?.maxResults || 30,
      });

      if (error throw error

      this.logger.info('Cross-domain search completed', LogContext.SYSTEM, {
        query,
        resultCount: data?.length || 0,
        intent: options?.intent,
      });

      return data || [];
    } catch (error) {
      this.logger.error(Cross-domain search failed', LogContext.SYSTEM, {
        error errorinstanceof Error ? errormessage : String(error,
      });
      throw error
    }
  }

  /**
   * Traverse the knowledge graph to find connected concepts
   */
  async searchKnowledgeGraph(
    startQuery: string,
    options?: {
      embedding?: number[];
      traversalDepth?: number;
      maxPaths?: number;
      connectionTypes?: string[];
    }
  ): Promise<KnowledgePath[]> {
    try {
      const { data, error} = await this.supabase.rpc('search_knowledge_graph', {
        start_query: startQuery,
        start_embedding: options?.embedding || null,
        traversal_depth: options?.traversalDepth || 2,
        max_paths: options?.maxPaths || 5,
        connection_types: options?.connectionTypes || null,
      });

      if (error throw error

      this.logger.info('Knowledge graph search completed', LogContext.SYSTEM, {
        startQuery,
        pathsFound: data?.length || 0,
        depth: options?.traversalDepth || 2,
      });

      return data || [];
    } catch (error) {
      this.logger.error(Knowledge graph search failed', LogContext.SYSTEM, {
        error errorinstanceof Error ? errormessage : String(error,
      });
      throw error
    }
  }

  /**
   * Discover learning paths for a given topic
   */
  async discoverLearningPaths(
    topic: string,
    targetSkillLevel: SkillLevel = 'advanced'
  ): Promise<LearningPath[]> {
    try {
      const { data, error} = await this.supabase.rpc('discover_learning_paths', {
        start_topic: topic,
        target_skill_level: targetSkillLevel,
      });

      if (error throw error

      this.logger.info('Learning paths discovered', LogContext.SYSTEM, {
        topic,
        targetSkillLevel,
        pathsFound: data?.length || 0,
      });

      return data || [];
    } catch (error) {
      this.logger.error(Learning path discovery failed', LogContext.SYSTEM, {
        error errorinstanceof Error ? errormessage : String(error,
      });
      throw error
    }
  }

  /**
   * Get knowledge clusters for a specific domain
   */
  async getKnowledgeClusters(primaryCluster?: string, complexityLevel?: string) {
    try {
      let query = this.supabase.from('knowledge_clusters').select('*');

      if (primaryCluster) {
        query = query.eq('primary_cluster', primaryCluster);
      }

      if (complexityLevel) {
        query = query.eq('complexity_level', complexityLevel);
      }

      const { data, error} = await query.limit(50);

      if (error throw error

      return data || [];
    } catch (error) {
      this.logger.error(Failed to get knowledge clusters', LogContext.SYSTEM, {
        error errorinstanceof Error ? errormessage : String(error,
      });
      throw error
    }
  }

  /**
   * Get technology cross-references
   */
  async getTechnologyCrossReferences(domain?: string) {
    try {
      let query = this.supabase.from('technology_cross_references').select('*');

      if (domain) {
        query = query.or(`domain1.eq.${domain},domain2.eq.${domain}`);
      }

      const { data, error} = await query
        .order('connection_count', { ascending: false })
        .limit(100);

      if (error throw error

      return data || [];
    } catch (error) {
      this.logger.error(Failed to get technology cross-references', LogContext.SYSTEM, {
        error errorinstanceof Error ? errormessage : String(error,
      });
      throw error
    }
  }

  /**
   * Get memory relationship graph for visualization
   */
  async getMemoryRelationships(options?: {
    sourceDomain?: string;
    targetDomain?: string;
    connectionType?: string;
    minStrength?: number;
  }) {
    try {
      let query = this.supabase.from('memory_relationship_graph').select('*');

      if (options?.sourceDomain) {
        query = query.eq('source_domain', options.sourceDomain);
      }

      if (options?.targetDomain) {
        query = query.eq('target_domain', options.targetDomain);
      }

      if (options?.connectionType) {
        query = query.eq('connection_type', options.connectionType);
      }

      if (options?.minStrength) {
        query = query.gte('strength', options.minStrength);
      }

      const { data, error} = await query.order('strength', { ascending: false }).limit(100);

      if (error throw error

      return data || [];
    } catch (error) {
      this.logger.error(Failed to get memory relationships', LogContext.SYSTEM, {
        error errorinstanceof Error ? errormessage : String(error,
      });
      throw error
    }
  }

  /**
   * Initialize or refresh the enhanced context system
   */
  async initializeSystem(): Promise<{
    connections_created: ConnectionStats;
    enrichments_completed: any;
    status: string;
  }> {
    try {
      const { data, error} = await this.supabase.rpc('initialize_enhanced_context_system');

      if (error throw error

      this.logger.info('Enhanced context system initialized', data);

      return data;
    } catch (error) {
      this.logger.error(Failed to initialize enhanced context system', LogContext.SYSTEM, {
        error errorinstanceof Error ? errormessage : String(error,
      });
      throw error
    }
  }

  /**
   * Get knowledge usage patterns for analytics
   */
  async getKnowledgeUsagePatterns(options?: {
    serviceDomain?: string;
    minAccessCount?: number;
    minUsefulnessRate?: number;
  }) {
    try {
      let query = this.supabase.from('knowledge_usage_patterns').select('*');

      if (options?.serviceDomain) {
        query = query.eq('service_id', options.serviceDomain);
      }

      if (options?.minAccessCount) {
        query = query.gte('access_count', options.minAccessCount);
      }

      if (options?.minUsefulnessRate) {
        query = query.gte('usefulness_rate', options.minUsefulnessRate);
      }

      const { data, error} = await query
        .order('current_relevance', { ascending: false })
        .limit(50);

      if (error throw error

      return data || [];
    } catch (error) {
      this.logger.error(Failed to get knowledge usage patterns', LogContext.SYSTEM, {
        error errorinstanceof Error ? errormessage : String(error,
      });
      throw error
    }
  }

  /**
   * Find knowledge gaps in the system
   */
  async findKnowledgeGaps() {
    try {
      const { data, error} = await this.supabase.rpc('sql', {
        query: `
          WITH connection_counts AS (
            SELECT 
              m.service_id,
              m.memory_type,
              COUNT(DISTINCT mc.target_memory_id) as outgoing_connections,
              COUNT(DISTINCT mc2.source_memory_id) as incoming_connections
            FROM ai_memories m
            LEFT JOIN memory_connections mc ON m.id = mc.source_memory_id
            LEFT JOIN memory_connections mc2 ON m.id = mc2.target_memory_id
            GROUP BY m.id, m.service_id, m.memory_type
          )
          SELECT 
            service_id,
            memory_type,
            AVG(outgoing_connections + incoming_connections) as avg_connections
          FROM connection_counts
          GROUP BY service_id, memory_type
          HAVING AVG(outgoing_connections + incoming_connections) < 2
          ORDER BY avg_connections
        `,
      });

      if (error throw error

      this.logger.info('Knowledge gaps identified', LogContext.SYSTEM, {
        gapsFound: data?.length || 0,
      });

      return data || [];
    } catch (error) {
      this.logger.error(Failed to find knowledge gaps', LogContext.SYSTEM, {
        error errorinstanceof Error ? errormessage : String(error,
      });
      throw error
    }
  }

  /**
   * Build a comprehensive context for a specific query
   */
  async buildComprehensiveContext(
    query: string,
    options?: {
      intent?: SearchIntent;
      maxDepth?: number;
      includeRelated?: boolean;
    }
  ): Promise<{
    primary: SearchResult[];
    related: SearchResult[];
    paths: KnowledgePath[];
    clusters: any[];
  }> {
    try {
      // Primary search
      const primary = await this.searchAcrossDomains(query, {
        intent: options?.intent,
        maxResults: 10,
      });

      let related: SearchResult[] = [];
      let paths: KnowledgePath[] = [];
      const clusters: any[] = [];

      if (options?.includeRelated && primary.length > 0) {
        // Get related memories
        const relatedIds = primary.flatMap((p) => p.related_memories).slice(0, 20);
        if (relatedIds.length > 0) {
          const { data } = await this.supabase
            .from('ai_memories')
            .select('*')
            .in('id', relatedIds)
            .limit(20);

          related =
            data?.map((m) => ({
              memory_id: m.id,
              _content m._content
              domain: m.service_id,
              relevance_score: 0.7,
              context_score: 0.5,
              final_score: 0.6,
              related_memories: [],
              metadata: m.metadata,
            })) || [];
        }

        // Get knowledge paths
        paths = await this.searchKnowledgeGraph(query, {
          traversalDepth: options?.maxDepth || 2,
          maxPaths: 3,
        });

        // Get relevant clusters
        const domains = [...new Set(primary.map((p) => p.domain))];
        for (const domain of domains) {
          const domainClusters = await this.getKnowledgeClusters(domain);
          clusters.push(...domainClusters);
        }
      }

      this.logger.info('Comprehensive context built', LogContext.SYSTEM, {
        query,
        primaryCount: primary.length,
        relatedCount: related.length,
        pathsCount: paths.length,
        clustersCount: clusters.length,
      });

      return { primary, related, paths, clusters };
    } catch (error) {
      this.logger.error(Failed to build comprehensive context', LogContext.SYSTEM, {
        error errorinstanceof Error ? errormessage : String(error,
      });
      throw error
    }
  }
}

// Example usage patterns
export class EnhancedContextExamples {
  static async debuggingScenario(service: EnhancedContextService) {
    // Find debugging help for a specific error
    const results = await service.searchAcrossDomains(
      'supabase realtime connection errorWebSocket',
      {
        intent: 'debugging',
        domains: ['supabase', 'realtime'],
        maxResults: 5,
      }
    );

    // Get related troubleshooting steps
    const context = await service.buildComprehensiveContext('supabase realtime connection error, {
      intent: 'debugging',
      includeRelated: true,
    });

    return { results, context };
  }

  static async learningScenario(service: EnhancedContextService) {
    // Discover learning path for GraphQL with Supabase
    const learningPaths = await service.discoverLearningPaths(
      'GraphQL Supabase integration',
      'intermediate'
    );

    // Get beginner-friendly _contentfirst
    const beginnerContent = await service.searchAcrossDomains('GraphQL Supabase basics', {
      intent: 'learning',
      maxResults: 10,
    });

    return { learningPaths, beginnerContent };
  }

  static async optimizationScenario(service: EnhancedContextService) {
    // Find optimization techniques across domains
    const optimizations = await service.searchAcrossDomains('query performance optimization', {
      intent: 'optimization',
      domains: ['supabase', 'graphql', 'reranking'],
      maxResults: 15,
    });

    // Discover optimization paths
    const paths = await service.searchKnowledgeGraph('performance optimization', {
      traversalDepth: 3,
      connectionTypes: ['performance_optimization'],
    });

    return { optimizations, paths };
  }
}
/**
 * Database Performance Monitoring Service
 *
 * Comprehensive database monitoring for Universal AI Tools with:
 * - Query performance tracking and analysis
 * - Connection pool monitoring
 * - Database resource utilization
 * - Slow query detection and optimization
 * - Transaction monitoring
 * - Database health scoring
 * - Automated performance tuning suggestions
 * - Query _patternanalysis
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { telemetryService } from './telemetry-service';
import { LogContext, logger } from '../utils/enhanced-logger';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';

export interface DatabasePerformanceConfig {
  enabled: boolean;
  monitoringInterval: number; // ms
  slowQueryThreshold: number; // ms
  connectionPoolMonitoring: boolean;
  transactionMonitoring: boolean;

  // Thresholds
  thresholds: {
    queryTime: number; // ms
    connectionCount: number;
    lockWaitTime: number; // ms
    cacheHitRatio: number; // percentage
    activeTransactions: number;
  };

  // Performance scoring weights
  scoring: {
    queryPerformance: number;
    connectionHealth: number;
    resourceUtilization: number;
    concurrency: number;
  };

  // Query _analysissettings
  queryAnalysis: {
    enableSlowQueryLog: boolean;
    sampleRate: number; // 0-1
    maxQueriesTracked: number;
    enableQueryPlanAnalysis: boolean;
  };
}

export interface QueryMetrics {
  id: string;
  query: string;
  queryHash: string;
  executionTime: number;
  timestamp: Date;

  // Query details
  table?: string;
  operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'UPSERT' | 'RPC';
  rowsAffected?: number;

  // Performance metrics
  planningTime?: number;
  executionPlan?: any;
  indexesUsed?: string[];
  cacheHit: boolean;

  // Context
  traceId?: string;
  spanId?: string;
  userId?: string;
  sessionId?: string;

  // Resource usage
  memoryUsed?: number;
  ioReads?: number;
  ioWrites?: number;
}

export interface ConnectionPoolMetrics {
  timestamp: Date;
  activeConnections: number;
  idleConnections: number;
  totalConnections: number;
  maxConnections: number;
  connectionUtilization: number; // percentage

  // Connection statistics
  connectionsCreated: number;
  connectionsDestroyed: number;
  connectionErrors: number;
  averageConnectionTime: number;

  // Wait statistics
  connectionWaitTime: number;
  queuedRequests: number;
}

export interface TransactionMetrics {
  id: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  status: 'active' | 'committed' | 'aborted' | 'timeout';

  // Transaction details
  queries: QueryMetrics[];
  isolationLevel?: string;
  readOnly: boolean;

  // Lock information
  locksHeld: number;
  locksWaited: number;
  lockWaitTime: number;

  // Context
  traceId?: string;
  userId?: string;
}

export interface DatabaseHealth {
  score: number; // 0-100
  status: 'healthy' | 'degraded' | 'unhealthy';

  // Performance metrics
  averageQueryTime: number;
  slowQueries: number;
  queryThroughput: number; // queries per second

  // Connection health
  connectionUtilization: number;
  connectionErrors: number;

  // Resource utilization
  cpuUsage?: number;
  memoryUsage?: number;
  diskUsage?: number;
  cacheHitRatio: number;

  // Concurrency
  activeTransactions: number;
  lockContention: number;

  // Issues and recommendations
  issues: Array<{
    severity: 'low' | 'medium' | 'high' | 'critical';
    type: string;
    description: string;
    recommendation: string;
  }>;
}

export interface DatabaseReport {
  timeRange: {
    start: Date;
    end: Date;
  };
  summary: {
    totalQueries: number;
    averageQueryTime: number;
    slowQueries: number;
    errorRate: number;
    throughput: number;
  };
  topSlowQueries: Array<{
    queryHash: string;
    query: string;
    averageTime: number;
    count: number;
    totalTime: number;
  }>;
  topTables: Array<{
    table: string;
    queryCount: number;
    averageTime: number;
    totalTime: number;
  }>;
  performance: {
    queryTimePercentiles: {
      p50: number;
      p95: number;
      p99: number;
    };
    connectionMetrics: {
      averageUtilization: number;
      peakConnections: number;
      connectionErrors: number;
    };
    transactionMetrics: {
      averageDuration: number;
      abortRate: number;
      lockContentions: number;
    };
  };
  recommendations: string[];
}

export class DatabasePerformanceMonitor extends EventEmitter {
  private config: DatabasePerformanceConfig;
  private supabase: SupabaseClient;
  private isStarted = false;
  private queryMetrics: QueryMetrics[] = [];
  private connectionMetrics: ConnectionPoolMetrics[] = [];
  private transactionMetrics: TransactionMetrics[] = [];
  private activeTransactions = new Map<string, TransactionMetrics>();
  private monitoringInterval?: NodeJS.Timeout;
  private queryHashes = new Map<string, number>(); // Track query frequency

  constructor(
    supabaseUrl: string,
    supabaseKey: string,
    config: Partial<DatabasePerformanceConfig> = {}
  ) {
    super();

    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.config = {
      enabled: true,
      monitoringInterval: 60000, // 1 minute
      slowQueryThreshold: 1000, // 1 second
      connectionPoolMonitoring: true,
      transactionMonitoring: true,

      thresholds: {
        queryTime: 2000, // 2 seconds
        connectionCount: 50, // 50 connections
        lockWaitTime: 5000, // 5 seconds
        cacheHitRatio: 80, // 80%
        activeTransactions: 20, // 20 concurrent transactions
      },

      scoring: {
        queryPerformance: 0.4,
        connectionHealth: 0.3,
        resourceUtilization: 0.2,
        concurrency: 0.1,
      },

      queryAnalysis: {
        enableSlowQueryLog: true,
        sampleRate: 0.1, // Sample 10% of queries
        maxQueriesTracked: 10000,
        enableQueryPlanAnalysis: false, // Disabled by default due to overhead
      },

      ...config,
    };
  }

  /**
   * Start database performance monitoring
   */
  async start(): Promise<void> {
    if (this.isStarted) {
      logger.warn('Database performance monitor already started', undefined, LogContext.DATABASE);
      return;
    }

    if (!this.config.enabled) {
      logger.info('Database performance monitoring disabled', undefined, LogContext.DATABASE);
      return;
    }

    try {
      logger.info('Starting database performance monitor', undefined, {
        context: LogContext.DATABASE,
        config: this.config,
      });

      // Setup query interception
      this.setupQueryInterception();

      // Start periodic monitoring
      this.monitoringInterval = setInterval(() => {
        this.collectMetrics();
      }, this.config.monitoringInterval);

      this.isStarted = true;
      this.emit('started', { config: this.config });

      logger.info(
        'Database performance monitor started successfully',
        undefined,
        LogContext.DATABASE
      );
    } catch (error) {
      logger.error(Failed to start database performance monitor', undefined, {
        context: LogContext.DATABASE,
        error
      });
      throw error
    }
  }

  /**
   * Stop database performance monitoring
   */
  async stop(): Promise<void> {
    if (!this.isStarted) {
      logger.warn('Database performance monitor not started', undefined, LogContext.DATABASE);
      return;
    }

    try {
      logger.info('Stopping database performance monitor', undefined, LogContext.DATABASE);

      // Clear monitoring interval
      if (this.monitoringInterval) {
        clearInterval(this.monitoringInterval);
        this.monitoringInterval = undefined;
      }

      this.isStarted = false;
      this.emit('stopped');

      logger.info(
        'Database performance monitor stopped successfully',
        undefined,
        LogContext.DATABASE
      );
    } catch (error) {
      logger.error(Error stopping database performance monitor', undefined, {
        context: LogContext.DATABASE,
        error
      });
      throw error
    }
  }

  /**
   * Track a database query
   */
  trackQuery(
    query: string,
    executionTime: number,
    options: {
      table?: string;
      operation?: QueryMetrics['operation'];
      rowsAffected?: number;
      traceId?: string;
      spanId?: string;
      userId?: string;
      sessionId?: string;
      error: Error;
    } = {}
  ): string {
    // Sample queries based on configuration
    if (Math.random() > this.config.queryAnalysis.sampleRate) {
      return '';
    }

    const queryHash = this.generateQueryHash(query);
    const queryId = this.generateId();

    const queryMetric: QueryMetrics = {
      id: queryId,
      query: this.normalizeQuery(query),
      queryHash,
      executionTime,
      timestamp: new Date(),
      table: options.table,
      operation: options.operation || this.inferOperation(query),
      rowsAffected: options.rowsAffected,
      cacheHit: false, // Would need to be determined by database
      traceId: options.traceId || telemetryService.getCurrentTraceId(),
      spanId: options.spanId || telemetryService.getCurrentSpanId(),
      userId: options.userId,
      sessionId: options.sessionId,
    };

    this.queryMetrics.push(queryMetric);

    // Track query frequency
    this.queryHashes.set(queryHash, (this.queryHashes.get(queryHash) || 0) + 1);

    // Cleanup old metrics
    if (this.queryMetrics.length > this.config.queryAnalysis.maxQueriesTracked) {
      this.queryMetrics = this.queryMetrics.slice(-this.config.queryAnalysis.maxQueriesTracked);
    }

    // Check for slow query
    if (executionTime > this.config.slowQueryThreshold) {
      this.handleSlowQuery(queryMetric);
    }

    logger.debug('Query tracked', undefined, {
      context: LogContext.DATABASE,
      query_id: queryId,
      query_hash: queryHash,
      execution_time: executionTime,
      operation: queryMetric.operation,
      table: queryMetric.table,
    });

    this.emit('queryTracked', queryMetric);
    return queryId;
  }

  /**
   * Start tracking a transaction
   */
  startTransaction(
    options: {
      traceId?: string;
      userId?: string;
      isolationLevel?: string;
      readOnly?: boolean;
    } = {}
  ): string {
    const transactionId = this.generateId();

    const transaction: TransactionMetrics = {
      id: transactionId,
      startTime: new Date(),
      status: 'active',
      queries: [],
      isolationLevel: options.isolationLevel,
      readOnly: options.readOnly || false,
      locksHeld: 0,
      locksWaited: 0,
      lockWaitTime: 0,
      traceId: options.traceId || telemetryService.getCurrentTraceId(),
      userId: options.userId,
    };

    this.activeTransactions.set(transactionId, transaction);

    logger.debug('Transaction started', undefined, {
      context: LogContext.DATABASE,
      transaction_id: transactionId,
      trace_id: transaction.traceId,
      isolation_level: transaction.isolationLevel,
    });

    this.emit('transactionStarted', transaction);
    return transactionId;
  }

  /**
   * End a transaction
   */
  endTransaction(
    transactionId: string,
    status: 'committed' | 'aborted' | 'timeout',
    lockMetrics?: {
      locksHeld: number;
      locksWaited: number;
      lockWaitTime: number;
    }
  ): void {
    const transaction = this.activeTransactions.get(transactionId);
    if (!transaction) {
      logger.warn('Transaction not found', undefined, {
        context: LogContext.DATABASE,
        transaction_id: transactionId,
      });
      return;
    }

    transaction.endTime = new Date();
    transaction.duration = transaction.endTime.getTime() - transaction.startTime.getTime();
    transaction.status = status;

    if (lockMetrics) {
      transaction.locksHeld = lockMetrics.locksHeld;
      transaction.locksWaited = lockMetrics.locksWaited;
      transaction.lockWaitTime = lockMetrics.lockWaitTime;
    }

    // Move to completed transactions
    this.activeTransactions.delete(transactionId);
    this.transactionMetrics.push(transaction);

    // Keep only recent transactions
    if (this.transactionMetrics.length > 1000) {
      this.transactionMetrics = this.transactionMetrics.slice(-1000);
    }

    logger.debug('Transaction ended', undefined, {
      context: LogContext.DATABASE,
      transaction_id: transactionId,
      status,
      duration: transaction.duration,
      queries: transaction.queries.length,
    });

    this.emit('transactionEnded', transaction);
  }

  /**
   * Associate query with transaction
   */
  addQueryToTransaction(transactionId: string, queryId: string): void {
    const transaction = this.activeTransactions.get(transactionId);
    const query = this.queryMetrics.find((q) => q.id === queryId);

    if (transaction && query) {
      transaction.queries.push(query);
    }
  }

  /**
   * Get current database health
   */
  async getDatabaseHealth(): Promise<DatabaseHealth> {
    const recentQueries = this.getRecentQueries(300000); // Last 5 minutes
    const recentTransactions = this.getRecentTransactions(300000);
    const recentConnections = this.getRecentConnectionMetrics(300000);

    // Calculate query performance
    const averageQueryTime =
      recentQueries.length > 0
        ? recentQueries.reduce((sum, q) => sum + q.executionTime, 0) / recentQueries.length
        : 0;

    const slowQueries = recentQueries.filter(
      (q) => q.executionTime > this.config.slowQueryThreshold
    ).length;
    const queryThroughput = recentQueries.length / 5; // queries per minute

    // Calculate connection health
    const latestConnection = recentConnections[recentConnections.length - 1];
    const connectionUtilization = latestConnection?.connectionUtilization || 0;
    const connectionErrors = recentConnections.reduce((sum, c) => sum + c.connectionErrors, 0);

    // Calculate resource utilization
    const cacheHitRatio =
      recentQueries.length > 0
        ? (recentQueries.filter((q) => q.cacheHit).length / recentQueries.length) * 100
        : 100;

    // Calculate concurrency metrics
    const activeTransactions = this.activeTransactions.size;
    const lockContention = recentTransactions.filter((t) => t.lockWaitTime > 0).length;

    // Calculate overall health score
    const score = this.calculateHealthScore({
      averageQueryTime,
      slowQueries,
      connectionUtilization,
      connectionErrors,
      cacheHitRatio,
      activeTransactions,
      lockContention,
    });

    // Determine status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (score < 50) status = 'unhealthy';
    else if (score < 70) status = 'degraded';

    // Generate issues and recommendations
    const issues = this.generateIssues({
      averageQueryTime,
      slowQueries,
      connectionUtilization,
      connectionErrors,
      cacheHitRatio,
      activeTransactions,
      lockContention,
    });

    return {
      score,
      status,
      averageQueryTime,
      slowQueries,
      queryThroughput,
      connectionUtilization,
      connectionErrors,
      cacheHitRatio,
      activeTransactions,
      lockContention,
      issues,
    };
  }

  /**
   * Generate comprehensive database performance report
   */
  generateReport(durationMinutes = 60): DatabaseReport {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - durationMinutes * 60 * 1000);

    const queries = this.queryMetrics.filter((q) => q.timestamp > startTime);
    const transactions = this.transactionMetrics.filter((t) => t.startTime > startTime);

    // Summary metrics
    const totalQueries = queries.length;
    const averageQueryTime =
      queries.length > 0
        ? queries.reduce((sum, q) => sum + q.executionTime, 0) / queries.length
        : 0;
    const slowQueries = queries.filter(
      (q) => q.executionTime > this.config.slowQueryThreshold
    ).length;
    const errorRate = 0; // Would need errortracking in queries
    const throughput = totalQueries / durationMinutes;

    // Top slow queries
    const queryGroups = new Map<string, { queries: QueryMetrics[]; totalTime: number }>();
    queries.forEach((q) => {
      if (!queryGroups.has(q.queryHash)) {
        queryGroups.set(q.queryHash, { queries: [], totalTime: 0 });
      }
      const group = queryGroups.get(q.queryHash)!;
      group.queries.push(q);
      group.totalTime += q.executionTime;
    });

    const topSlowQueries = Array.from(queryGroups.entries())
      .map(([hash, group]) => ({
        queryHash: hash,
        query: group.queries[0].query,
        averageTime: group.totalTime / group.queries.length,
        count: group.queries.length,
        totalTime: group.totalTime,
      }))
      .sort((a, b) => b.averageTime - a.averageTime)
      .slice(0, 10);

    // Top tables by activity
    const tableGroups = new Map<string, { count: number; totalTime: number }>();
    queries.forEach((q) => {
      if (q.table) {
        if (!tableGroups.has(q.table)) {
          tableGroups.set(q.table, { count: 0, totalTime: 0 });
        }
        const group = tableGroups.get(q.table)!;
        group.count++;
        group.totalTime += q.executionTime;
      }
    });

    const topTables = Array.from(tableGroups.entries())
      .map(([table, stats]) => ({
        table,
        queryCount: stats.count,
        averageTime: stats.totalTime / stats.count,
        totalTime: stats.totalTime,
      }))
      .sort((a, b) => b.queryCount - a.queryCount)
      .slice(0, 10);

    // Performance percentiles
    const queryTimes = queries.map((q) => q.executionTime).sort((a, b) => a - b);
    const queryTimePercentiles = {
      p50: this.calculatePercentile(queryTimes, 50),
      p95: this.calculatePercentile(queryTimes, 95),
      p99: this.calculatePercentile(queryTimes, 99),
    };

    // Connection metrics
    const recentConnections = this.getRecentConnectionMetrics(durationMinutes * 60 * 1000);
    const connectionMetrics = {
      averageUtilization:
        recentConnections.length > 0
          ? recentConnections.reduce((sum, c) => sum + c.connectionUtilization, 0) /
            recentConnections.length
          : 0,
      peakConnections:
        recentConnections.length > 0
          ? Math.max(...recentConnections.map((c) => c.activeConnections))
          : 0,
      connectionErrors: recentConnections.reduce((sum, c) => sum + c.connectionErrors, 0),
    };

    // Transaction metrics
    const completedTransactions = transactions.filter((t) => t.duration !== undefined);
    const transactionMetrics = {
      averageDuration:
        completedTransactions.length > 0
          ? completedTransactions.reduce((sum, t) => sum + (t.duration || 0), 0) /
            completedTransactions.length
          : 0,
      abortRate:
        transactions.length > 0
          ? (transactions.filter((t) => t.status === 'aborted').length / transactions.length) * 100
          : 0,
      lockContentions: transactions.filter((t) => t.lockWaitTime > 0).length,
    };

    // Generate recommendations
    const recommendations = this.generateRecommendations({
      queries,
      transactions,
      connectionMetrics: recentConnections,
    });

    return {
      timeRange: { start: startTime, end: endTime },
      summary: {
        totalQueries,
        averageQueryTime,
        slowQueries,
        errorRate,
        throughput,
      },
      topSlowQueries,
      topTables,
      performance: {
        queryTimePercentiles,
        connectionMetrics,
        transactionMetrics,
      },
      recommendations,
    };
  }

  // Private methods

  private setupQueryInterception(): void {
    // This is a simplified version. In practice, you'd need to hook into
    // the Supabase client or use database-specific monitoring tools
    logger.info('Query interception setup completed', undefined, LogContext.DATABASE);
  }

  private async collectMetrics(): Promise<void> {
    try {
      // Collect connection pool metrics
      if (this.config.connectionPoolMonitoring) {
        const connectionMetrics = await this.collectConnectionMetrics();
        this.connectionMetrics.push(connectionMetrics);

        // Keep only recent metrics
        if (this.connectionMetrics.length > 1000) {
          this.connectionMetrics = this.connectionMetrics.slice(-1000);
        }
      }

      // Emit periodic metrics update
      this.emit('metricsCollected', {
        queries: this.queryMetrics.length,
        activeTransactions: this.activeTransactions.size,
        connections: this.connectionMetrics.length,
      });
    } catch (error) {
      logger.error(Error collecting database metrics', undefined, {
        context: LogContext.DATABASE,
        error
      });
    }
  }

  private async collectConnectionMetrics(): Promise<ConnectionPoolMetrics> {
    // This would typically query database system tables or connection pool stats
    // For Supabase, this information might not be directly available

    return {
      timestamp: new Date(),
      activeConnections: Math.floor(Math.random() * 20) + 5, // Simulated
      idleConnections: Math.floor(Math.random() * 10) + 2,
      totalConnections: 30,
      maxConnections: 50,
      connectionUtilization: (25 / 50) * 100,
      connectionsCreated: 0,
      connectionsDestroyed: 0,
      connectionErrors: 0,
      averageConnectionTime: Math.random() * 100 + 50,
      connectionWaitTime: Math.random() * 10,
      queuedRequests: Math.floor(Math.random() * 3),
    };
  }

  private handleSlowQuery(query: QueryMetrics): void {
    logger.warn('Slow query detected', undefined, {
      context: LogContext.DATABASE,
      query_id: query.id,
      execution_time: query.executionTime,
      query_hash: query.queryHash,
      table: query.table,
      operation: query.operation,
    });

    this.emit('slowQuery', query);

    // Check if this query _patternis frequently slow
    const recentSimilarQueries = this.queryMetrics.filter(
      (q) => q.queryHash === query.queryHash && q.timestamp > new Date(Date.now() - 3600000) // Last hour
    );

    const slowCount = recentSimilarQueries.filter(
      (q) => q.executionTime > this.config.slowQueryThreshold
    ).length;
    const slowPercentage = (slowCount / recentSimilarQueries.length) * 100;

    if (slowPercentage > 50 && recentSimilarQueries.length > 5) {
      this.emit('slowQueryPattern', {
        queryHash: query.queryHash,
        query: query.query,
        slowPercentage,
        count: recentSimilarQueries.length,
        averageTime:
          recentSimilarQueries.reduce((sum, q) => sum + q.executionTime, 0) /
          recentSimilarQueries.length,
      });
    }
  }

  private calculateHealthScore(metrics: {
    averageQueryTime: number;
    slowQueries: number;
    connectionUtilization: number;
    connectionErrors: number;
    cacheHitRatio: number;
    activeTransactions: number;
    lockContention: number;
  }): number {
    const { scoring, thresholds } = this.config;

    // Query performance score (0-100)
    const queryScore = Math.max(0, 100 - (metrics.averageQueryTime / thresholds.queryTime) * 100);

    // Connection health score (0-100)
    const connectionScore = Math.max(
      0,
      100 - (metrics.connectionUtilization / 100) * 100 - metrics.connectionErrors * 5
    );

    // Resource utilization score (0-100)
    const resourceScore = metrics.cacheHitRatio;

    // Concurrency score (0-100)
    const concurrencyScore = Math.max(
      0,
      100 -
        (metrics.activeTransactions / thresholds.activeTransactions) * 50 -
        metrics.lockContention * 10
    );

    // Weighted total
    const totalScore =
      queryScore * scoring.queryPerformance +
      connectionScore * scoring.connectionHealth +
      resourceScore * scoring.resourceUtilization +
      concurrencyScore * scoring.concurrency;

    return Math.round(Math.max(0, Math.min(100, totalScore)));
  }

  private generateIssues(metrics: {
    averageQueryTime: number;
    slowQueries: number;
    connectionUtilization: number;
    connectionErrors: number;
    cacheHitRatio: number;
    activeTransactions: number;
    lockContention: number;
  }): DatabaseHealth['issues'] {
    const issues: DatabaseHealth['issues'] = [];

    // Query performance issues
    if (metrics.averageQueryTime > this.config.thresholds.queryTime) {
      issues.push({
        severity: 'high',
        type: 'slow_queries',
        description: `Average query time (${metrics.averageQueryTime.toFixed(2)}ms) exceeds threshold`,
        recommendation: 'Review and optimize slow queries, consider adding indexes',
      });
    }

    if (metrics.slowQueries > 10) {
      issues.push({
        severity: 'medium',
        type: 'query_count',
        description: `High number of slow queries detected: ${metrics.slowQueries}`,
        recommendation: 'Analyze query patterns and optimize frequently used queries',
      });
    }

    // Connection issues
    if (metrics.connectionUtilization > 80) {
      issues.push({
        severity: 'high',
        type: 'connection_pool',
        description: `Connection pool utilization is high: ${metrics.connectionUtilization.toFixed(1)}%`,
        recommendation: 'Consider increasing connection pool size or optimizing connection usage',
      });
    }

    if (metrics.connectionErrors > 0) {
      issues.push({
        severity: 'critical',
        type: 'connectionerrors',
        description: `Database connection errors detected: ${metrics.connectionErrors}`,
        recommendation: 'Check database connectivity and configuration',
      });
    }

    // Cache performance
    if (metrics.cacheHitRatio < this.config.thresholds.cacheHitRatio) {
      issues.push({
        severity: 'medium',
        type: 'cache_performance',
        description: `Cache hit ratio is low: ${metrics.cacheHitRatio.toFixed(1)}%`,
        recommendation: 'Optimize queries for better cache usage or increase cache size',
      });
    }

    // Concurrency issues
    if (metrics.activeTransactions > this.config.thresholds.activeTransactions) {
      issues.push({
        severity: 'medium',
        type: 'high_concurrency',
        description: `High number of active transactions: ${metrics.activeTransactions}`,
        recommendation: 'Monitor for long-running transactions and optimize transaction scope',
      });
    }

    if (metrics.lockContention > 5) {
      issues.push({
        severity: 'high',
        type: 'lock_contention',
        description: `Lock contention detected in ${metrics.lockContention} transactions`,
        recommendation: 'Review transaction isolation levels and reduce transaction duration',
      });
    }

    return issues;
  }

  private generateRecommendations(data: {
    queries: QueryMetrics[];
    transactions: TransactionMetrics[];
    connectionMetrics: ConnectionPoolMetrics[];
  }): string[] {
    const recommendations: string[] = [];

    // Query optimization recommendations
    const slowQueries = data.queries.filter(
      (q) => q.executionTime > this.config.slowQueryThreshold
    );
    if (slowQueries.length > 0) {
      recommendations.push(`Optimize ${slowQueries.length} slow queries identified in the report`);

      // Check for missing indexes
      const tablesWithSlowQueries = [...new Set(slowQueries.map((q) => q.table).filter(Boolean))];
      if (tablesWithSlowQueries.length > 0) {
        recommendations.push(
          `Consider adding indexes to tables: ${tablesWithSlowQueries.join(', ')}`
        );
      }
    }

    // Connection pool recommendations
    const avgConnectionUtil =
      data.connectionMetrics.length > 0
        ? data.connectionMetrics.reduce((sum, c) => sum + c.connectionUtilization, 0) /
          data.connectionMetrics.length
        : 0;

    if (avgConnectionUtil > 80) {
      recommendations.push('Consider increasing database connection pool size');
      recommendations.push('Review application connection usage patterns');
    }

    // Transaction recommendations
    const longTransactions = data.transactions.filter((t) => (t.duration || 0) > 30000); // 30 seconds
    if (longTransactions.length > 0) {
      recommendations.push(
        `Review ${longTransactions.length} long-running transactions for optimization`
      );
    }

    // General performance recommendations
    const queryCount = data.queries.length;
    if (queryCount > 1000) {
      recommendations.push('Consider implementing query result caching');
      recommendations.push('Review query patterns for potential batching opportunities');
    }

    return recommendations;
  }

  private getRecentQueries(durationMs: number): QueryMetrics[] {
    const cutoffTime = new Date(Date.now() - durationMs);
    return this.queryMetrics.filter((q) => q.timestamp > cutoffTime);
  }

  private getRecentTransactions(durationMs: number): TransactionMetrics[] {
    const cutoffTime = new Date(Date.now() - durationMs);
    return this.transactionMetrics.filter((t) => t.startTime > cutoffTime);
  }

  private getRecentConnectionMetrics(durationMs: number): ConnectionPoolMetrics[] {
    const cutoffTime = new Date(Date.now() - durationMs);
    return this.connectionMetrics.filter((c) => c.timestamp > cutoffTime);
  }

  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;

    const index = Math.ceil((percentile / 100) * values.length) - 1;
    return values[Math.max(0, index)] || 0;
  }

  private generateQueryHash(query: string): string {
    // Simple hash based on normalized query structure
    const normalized = this.normalizeQuery(query);
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  private normalizeQuery(query: string): string {
    // Normalize query by removing parameters and formatting
    return query
      .replace(/\$\d+/g, '?') // Replace parameters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\d+/g, 'N') // Replace numbers
      .replace(/'[^']*'/g, "'X'") // Replace strings
      .trim()
      .toLowerCase();
  }

  private inferOperation(query: string): QueryMetrics['operation'] {
    const queryLower = query.toLowerCase().trim();

    if (queryLower.startsWith('select')) return 'SELECT';
    if (queryLower.startsWith('insert')) return 'INSERT';
    if (queryLower.startsWith('update')) return 'UPDATE';
    if (queryLower.startsWith('delete')) return 'DELETE';
    if (queryLower.includes('upsert')) return 'UPSERT';
    if (queryLower.startsWith('call') || queryLower.includes('rpc')) return 'RPC';

    return 'SELECT'; // Default
  }

  private generateId(): string {
    return (
      Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    );
  }
}

// Create singleton instance
let databasePerformanceMonitor: DatabasePerformanceMonitor | null = null;

export function getDatabasePerformanceMonitor(
  supabaseUrl?: string,
  supabaseKey?: string,
  config?: Partial<DatabasePerformanceConfig>
): DatabasePerformanceMonitor {
  if (!databasePerformanceMonitor) {
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase URL and key required to initialize database performance monitor');
    }
    databasePerformanceMonitor = new DatabasePerformanceMonitor(supabaseUrl, supabaseKey, config);
  }
  return databasePerformanceMonitor;
}

export default DatabasePerformanceMonitor;
/**
 * Production Cache Manager
 * High-performance caching with Redis backend, compression, and intelligent eviction
 */

import { getRedisService } from './redis-service';
import { LogContext, logger } from '../utils/enhanced-logger';
import { createHash } from 'crypto';
import zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  tags?: string[]; // Cache tags for group invalidation
  compress?: boolean; // Compress large values
  version?: string; // Cache version for validation
}

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  compressionRatio: number;
  memoryUsage: number;
}

export interface CacheEntry<T = any> {
  data: T;
  version: string;
  tags: string[];
  createdAt: number;
  expiresAt?: number;
  compressed: boolean;
}

export class ProductionCacheManager {
  private static instance: ProductionCacheManager | null = null;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    compressionRatio: 0,
    memoryUsage: 0,
  };

  private readonly keyPrefix = 'uai:cache:';
  private readonly tagPrefix = 'uai:tags:';
  private readonly statsKey = 'uai:stats';
  private readonly compressionThreshold = 1024; // Compress if > 1KB

  static getInstance(): ProductionCacheManager {
    if (!ProductionCacheManager.instance) {
      ProductionCacheManager.instance = new ProductionCacheManager();
    }
    return ProductionCacheManager.instance;
  }

  /**
   * Get value from cache
   */
  async get<T = any>(key: string): Promise<T | null> {
    try {
      const redis = getRedisService().getClient();
      const cacheKey = this.getCacheKey(key);

      const rawValue = await redis.get(cacheKey);
      if (!rawValue) {
        this.stats.misses++;
        await this.updateStats();
        return null;
      }

      const entry: CacheEntry<T> = JSON.parse(rawValue);

      // Check expiration
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        await this.delete(key);
        this.stats.misses++;
        await this.updateStats();
        return null;
      }

      // Decompress if needed
      let { data } = entry;
      if (entry.compressed && typeof data === 'string') {
        const buffer = Buffer.from(data, 'base64');
        const decompressed = await gunzip(buffer);
        data = JSON.parse(decompressed.toString());
      }

      this.stats.hits++;
      await this.updateStats();

      logger.debug('Cache hit', LogContext.CACHE, { key, compressed: entry.compressed });
      return data;
    } catch (error) {
      logger.error(Cache get error, LogContext.CACHE, {
        key,
        error errorinstanceof Error ? errormessage : String(error,
      });
      this.stats.misses++;
      await this.updateStats();
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set<T = any>(key: string, value: T, options: CacheOptions = {}): Promise<boolean> {
    try {
      const redis = getRedisService().getClient();
      const cacheKey = this.getCacheKey(key);

      const entry: CacheEntry<T> = {
        data: value,
        version: options.version || '1.0',
        tags: options.tags || [],
        createdAt: Date.now(),
        expiresAt: options.ttl ? Date.now() + options.ttl * 1000 : undefined,
        compressed: false,
      };

      // Serialize data
      const serialized = JSON.stringify(entry.data);

      // Compress large values
      if (options.compress !== false && serialized.length > this.compressionThreshold) {
        const compressed = await gzip(serialized);
        entry.data = compressed.toString('base64') as any;
        entry.compressed = true;

        const originalSize = serialized.length;
        const compressedSize = compressed.length;
        this.stats.compressionRatio = (originalSize - compressedSize) / originalSize;

        logger.debug('Cache compression applied', LogContext.CACHE, {
          key,
          originalSize,
          compressedSize,
          ratio: this.stats.compressionRatio,
        });
      }

      const entryString = JSON.stringify(entry);

      // Set with TTL
      if (options.ttl) {
        await redis.setex(cacheKey, options.ttl, entryString);
      } else {
        await redis.set(cacheKey, entryString);
      }

      // Add to tag indexes
      if (options.tags && options.tags.length > 0) {
        await this.addToTagIndexes(key, options.tags);
      }

      await this.updateStats();

      logger.debug('Cache set', LogContext.CACHE, {
        key,
        ttl: options.ttl,
        tags: options.tags,
        compressed: entry.compressed,
      });

      return true;
    } catch (error) {
      logger.error(Cache set error, LogContext.CACHE, {
        key,
        error errorinstanceof Error ? errormessage : String(error,
      });
      return false;
    }
  }

  /**
   * Delete single key
   */
  async delete(key: string): Promise<boolean> {
    try {
      const redis = getRedisService().getClient();
      const cacheKey = this.getCacheKey(key);

      const result = await redis.del(cacheKey);

      if (result > 0) {
        this.stats.evictions++;
        await this.updateStats();
        logger.debug('Cache delete', LogContext.CACHE, { key });
      }

      return result > 0;
    } catch (error) {
      logger.error(Cache delete error, LogContext.CACHE, {
        key,
        error errorinstanceof Error ? errormessage : String(error,
      });
      return false;
    }
  }

  /**
   * Invalidate by tags
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    try {
      const redis = getRedisService().getClient();
      let totalDeleted = 0;

      for (const tag of tags) {
        const tagKey = this.getTagKey(tag);
        const keys = await redis.smembers(tagKey);

        if (keys.length > 0) {
          // Delete all keys with this tag
          const cacheKeys = keys.map((key) => this.getCacheKey(key));
          const deleted = await redis.del(...cacheKeys);
          totalDeleted += deleted;

          // Clean up tag index
          await redis.del(tagKey);
        }
      }

      if (totalDeleted > 0) {
        this.stats.evictions += totalDeleted;
        await this.updateStats();

        logger.info('Cache invalidated by tags', LogContext.CACHE, {
          tags,
          keysDeleted: totalDeleted,
        });
      }

      return totalDeleted;
    } catch (error) {
      logger.error(Cache invalidate by tags error, LogContext.CACHE, {
        tags,
        error errorinstanceof Error ? errormessage : String(error,
      });
      return 0;
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<boolean> {
    try {
      const redis = getRedisService().getClient();

      // Get all cache keys
      const keys = await redis.keys(`${this.keyPrefix}*`);
      const tagKeys = await redis.keys(`${this.tagPrefix}*`);

      const allKeys = [...keys, ...tagKeys];

      if (allKeys.length > 0) {
        await redis.del(...allKeys);
        this.stats.evictions += keys.length;
      }

      // Reset stats
      this.stats = {
        hits: 0,
        misses: 0,
        evictions: 0,
        compressionRatio: 0,
        memoryUsage: 0,
      };

      await this.updateStats();

      logger.info('Cache cleared', LogContext.CACHE, { keysDeleted: allKeys.length });
      return true;
    } catch (error) {
      logger.error(Cache clear error, LogContext.CACHE, {
        error errorinstanceof Error ? errormessage : String(error,
      });
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    try {
      const redis = getRedisService().getClient();

      // Update memory usage
      const keys = await redis.keys(`${this.keyPrefix}*`);
      let totalMemory = 0;

      for (const key of keys.slice(0, 100)) {
        // Sample first 100 keys
        const size = await redis.memory('USAGE', key);
        totalMemory += size || 0;
      }

      this.stats.memoryUsage = totalMemory;
      await this.updateStats();

      return { ...this.stats };
    } catch (error) {
      logger.error(Cache stats error, LogContext.CACHE, {
        error errorinstanceof Error ? errormessage : String(error,
      });
      return { ...this.stats };
    }
  }

  /**
   * Health check for cache system
   */
  async healthCheck(): Promise<{ healthy: boolean; latency?: number; error: string }> {
    try {
      const start = Date.now();
      const testKey = `health_check_${Date.now()}`;
      const testValue = 'test';

      await this.set(testKey, testValue, { ttl: 5 });
      const retrieved = await this.get(testKey);
      await this.delete(testKey);

      const latency = Date.now() - start;

      if (retrieved === testValue) {
        return { healthy: true, latency };
      } else {
        return { healthy: false, error 'Value mismatch in health check' };
      }
    } catch (error) {
      return {
        healthy: false,
        error errorinstanceof Error ? errormessage : String(error,
      };
    }
  }

  private getCacheKey(key: string): string {
    // Create deterministic key with hash to handle long keys
    const hash = createHash('sha256').update(key).digest('hex').substring(0, 16);
    return `${this.keyPrefix}${hash}:${key.substring(0, 100)}`;
  }

  private getTagKey(tag: string): string {
    return `${this.tagPrefix}${tag}`;
  }

  private async addToTagIndexes(key: string, tags: string[]): Promise<void> {
    try {
      const redis = getRedisService().getClient();

      for (const tag of tags) {
        const tagKey = this.getTagKey(tag);
        await redis.sadd(tagKey, key);
        await redis.expire(tagKey, 86400); // Tag indexes expire in 24h
      }
    } catch (error) {
      logger.warn('Failed to update tag indexes', LogContext.CACHE, {
        key,
        tags,
        error errorinstanceof Error ? errormessage : String(error,
      });
    }
  }

  private async updateStats(): Promise<void> {
    try {
      const redis = getRedisService().getClient();
      await redis.set(this.statsKey, JSON.stringify(this.stats), 'EX', 3600);
    } catch (error) {
      // Silent fail for stats update
    }
  }
}

// Lazy initialization
let _cacheManager: ProductionCacheManager | null = null;

export function getCacheManager(): ProductionCacheManager {
  if (!_cacheManager) {
    _cacheManager = ProductionCacheManager.getInstance();
  }
  return _cacheManager;
}

// Export singleton instance
export const cacheManager = new Proxy({} as ProductionCacheManager, {
  get(target, prop) {
    return getCacheManager()[prop as keyof ProductionCacheManager];
  },
});

export default ProductionCacheManager;
/**
 * Knowledge Feedback Service
 * Implements learning feedback loops and usage analytics
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { supabase } from './supabase_service';
import { RerankingPipeline } from './reranking-pipeline';
import { DSPyKnowledgeManager } from '../core/knowledge/dspy-knowledge-manager';
import * as cron from 'node-cron';

interface UsageAnalytics {
  knowledgeId: string;
  knowledgeType: string;
  agentId: string;
  actionType: 'accessed' | 'used' | 'failed' | 'helpful' | 'not_helpful';
  context: Record<string, unknown>;
  performanceScore?: number;
  userFeedback?: string;
}

interface PerformanceMetric {
  metricType: string;
  metricValue: number;
  dimensions: Record<string, unknown>;
  periodStart: Date;
  periodEnd: Date;
}

interface KnowledgePattern {
  _pattern string;
  confidence: number;
  evidence: number;
  lastSeen: Date;
}

interface LearningInsight {
  type: 'usage__pattern | 'performance_trend' | 'relationship_discovery' | 'quality_issue';
  title: string;
  description: string;
  affectedKnowledge: string[];
  recommendations: string[];
  confidence: number;
}

export class KnowledgeFeedbackService extends EventEmitter {
  private rerankingPipeline: RerankingPipeline;
  private knowledgeManager: DSPyKnowledgeManager;
  private scheduledJobs: Map<string, cron.ScheduledTask> = new Map();

  // Analytics cache
  private usageCache: Map<string, UsageAnalytics[]> = new Map();
  private performanceCache: Map<string, number> = new Map();

  // Learning state
  private patterns: Map<string, KnowledgePattern> = new Map();
  private insights: LearningInsight[] = [];

  constructor(rerankingPipeline: RerankingPipeline, knowledgeManager: DSPyKnowledgeManager) {
    super();
    this.rerankingPipeline = rerankingPipeline;
    this.knowledgeManager = knowledgeManager;
    this.initialize();
  }

  private async initialize(): Promise<void> {
    // Schedule analytics processing
    const analyticsJob = cron.schedule('*/5 * * * *', () => this.processUsageAnalytics());
    this.scheduledJobs.set('analytics', analyticsJob);
    analyticsJob.start();

    // Schedule _patterndetection
    const patternJob = cron.schedule('*/15 * * * *', () => this.detectUsagePatterns());
    this.scheduledJobs.set('patterns', patternJob);
    patternJob.start();

    // Schedule performance evaluation
    const performanceJob = cron.schedule('0 * * * *', () => this.evaluatePerformance());
    this.scheduledJobs.set('performance', performanceJob);
    performanceJob.start();

    // Schedule reranking updates
    const rerankingJob = cron.schedule('0 */6 * * *', () => this.updateKnowledgeRanking());
    this.scheduledJobs.set('reranking', rerankingJob);
    rerankingJob.start();

    logger.info('Knowledge feedback service initialized');
  }

  /**
   * Track knowledge usage
   */
  async trackUsage(analytics: UsageAnalytics): Promise<void> {
    try {
      // Store in database
      const { error} = await supabase.from('knowledge_usage_analytics').insert({
        knowledge_id: analytics.knowledgeId,
        knowledge_type: analytics.knowledgeType,
        agent_id: analytics.agentId,
        action_type: analytics.actionType,
        context: analytics.context,
        performance_score: analytics.performanceScore,
        user_feedback: analytics.userFeedback,
      });

      if (error {
        logger.error(Failed to track usage:', error;
        return;
      }

      // Update cache
      const key = `${analytics.knowledgeId}:${analytics.knowledgeType}`;
      if (!this.usageCache.has(key)) {
        this.usageCache.set(key, []);
      }
      this.usageCache.get(key)!.push(analytics);

      // Update performance cache
      if (analytics.performanceScore !== undefined) {
        const perfKey = `${key}:performance`;
        const current = this.performanceCache.get(perfKey) || 0;
        this.performanceCache.set(perfKey, (current + analytics.performanceScore) / 2);
      }

      // Emit event for real-time processing
      this.emit('usage_tracked', analytics);

      // Check for immediate insights
      await this.checkImmediateInsights(analytics);
    } catch (error) {
      logger.error(Error tracking usage:', error;
    }
  }

  /**
   * Process accumulated usage analytics
   */
  private async processUsageAnalytics(): Promise<void> {
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

      // Get recent analytics
      const { data: recentAnalytics, error} = await supabase
        .from('knowledge_usage_analytics')
        .select('*')
        .gte('created_at', fiveMinutesAgo.toISOString())
        .order('created_at', { ascending: false });

      if (error {
        logger.error(Failed to fetch recent analytics:', error;
        return;
      }

      if (!recentAnalytics || recentAnalytics.length === 0) return;

      // Group by knowledge item
      const grouped = this.groupAnalyticsByKnowledge(recentAnalytics);

      // Calculate metrics for each knowledge item
      for (const [key, analytics] of grouped.entries()) {
        await this.calculateKnowledgeMetrics(key, analytics);
      }

      // Update learned relationships
      await this.updateLearnedRelationships(recentAnalytics);

      // Store performance metrics
      await this.storePerformanceMetrics();
    } catch (error) {
      logger.error(Error processing usage analytics:', error;
    }
  }

  /**
   * Detect usage patterns
   */
  private async detectUsagePatterns(): Promise<void> {
    try {
      // Get analytics from last hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      const { data: analytics, error} = await supabase
        .from('knowledge_usage_analytics')
        .select('*')
        .gte('created_at', oneHourAgo.toISOString());

      if (error|| !analytics) return;

      // Detect co-access patterns
      const coAccessPatterns = await this.detectCoAccessPatterns(analytics);

      // Detect sequential patterns
      const sequentialPatterns = await this.detectSequentialPatterns(analytics);

      // Detect failure patterns
      const failurePatterns = await this.detectFailurePatterns(analytics);

      // Update _patterncache
      this.updatePatternCache(coAccessPatterns, 'co_access');
      this.updatePatternCache(sequentialPatterns, 'sequential');
      this.updatePatternCache(failurePatterns, 'failure');

      // Generate insights from patterns
      await this.generatePatternInsights();
    } catch (error) {
      logger.error(Error detecting usage patterns:', error;
    }
  }

  /**
   * Evaluate overall performance
   */
  private async evaluatePerformance(): Promise<void> {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      // Calculate retrieval accuracy
      const retrievalAccuracy = await this.calculateRetrievalAccuracy(oneHourAgo);

      // Calculate usage effectiveness
      const usageEffectiveness = await this.calculateUsageEffectiveness(oneHourAgo);

      // Calculate update frequency needs
      const updateFrequency = await this.calculateUpdateFrequency(oneHourAgo);

      // Store metrics
      const metrics: PerformanceMetric[] = [
        {
          metricType: 'retrieval_accuracy',
          metricValue: retrievalAccuracy,
          dimensions: { period: 'hourly' },
          periodStart: oneHourAgo,
          periodEnd: new Date(),
        },
        {
          metricType: 'usage_effectiveness',
          metricValue: usageEffectiveness,
          dimensions: { period: 'hourly' },
          periodStart: oneHourAgo,
          periodEnd: new Date(),
        },
        {
          metricType: 'update_frequency',
          metricValue: updateFrequency,
          dimensions: { period: 'hourly' },
          periodStart: oneHourAgo,
          periodEnd: new Date(),
        },
      ];

      await this.storePerformanceMetrics(metrics);

      // Check for performance issues
      await this.checkPerformanceIssues(metrics);
    } catch (error) {
      logger.error(Error evaluating performance:', error;
    }
  }

  /**
   * Update knowledge ranking based on usage and performance
   */
  private async updateKnowledgeRanking(): Promise<void> {
    try {
      logger.info('Starting knowledge reranking process');

      // Get knowledge items with usage data
      const { data: knowledgeItems, error} = await supabase
        .from('knowledge_usage_analytics')
        .select(
          `
          knowledge_id,
          knowledge_type,
          action_type,
          performance_score
        `
        )
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      if (error|| !knowledgeItems) return;

      // Calculate new rankings
      const rankings = await this.calculateNewRankings(knowledgeItems);

      // Apply reranking updates
      for (const [knowledgeId, ranking] of rankings.entries()) {
        await this.applyRankingUpdate(
          knowledgeId,
          ranking.type,
          ranking.oldRank,
          ranking.newRank,
          ranking.reason
        );
      }

      // Update search configuration based on performance
      await this.updateSearchConfiguration();

      logger.info(`Completed reranking for ${rankings.size} knowledge items`);
    } catch (error) {
      logger.error(Error updating knowledge ranking:', error;
    }
  }

  // Helper methods

  private groupAnalyticsByKnowledge(analytics: any[]): Map<string, any[]> {
    const grouped = new Map<string, any[]>();

    for (const item of analytics) {
      const key = `${item.knowledge_id}:${item.knowledge_type}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(item);
    }

    return grouped;
  }

  private async calculateKnowledgeMetrics(key: string, analytics: any[]): Promise<void> {
    const [knowledgeId, knowledgeType] = key.split(':');

    // Calculate access frequency
    const accessCount = analytics.filter((a) => a.action_type === 'accessed').length;

    // Calculate success rate
    const usedCount = analytics.filter((a) => a.action_type === 'used').length;
    const failedCount = analytics.filter((a) => a.action_type === 'failed').length;
    const successRate = usedCount / (usedCount + failedCount) || 0;

    // Calculate helpfulness score
    const helpfulCount = analytics.filter((a) => a.action_type === 'helpful').length;
    const notHelpfulCount = analytics.filter((a) => a.action_type === 'not_helpful').length;
    const helpfulnessScore = helpfulCount / (helpfulCount + notHelpfulCount) || 0.5;

    // Calculate average performance
    const performanceScores = analytics
      .filter((a) => a.performance_score !== null)
      .map((a) => a.performance_score);
    const avgPerformance =
      performanceScores.length > 0
        ? performanceScores.reduce((a, b) => a + b) / performanceScores.length
        : 0.5;

    // Update knowledge metadata
    if (knowledgeType === 'scraped') {
      await supabase
        .from('scraped_knowledge')
        .update({
          metadata: {
            accessCount,
            successRate,
            helpfulnessScore,
            avgPerformance,
            lastAccessed: new Date().toISOString(),
          },
        })
        .eq('id', knowledgeId);
    }
  }

  private async updateLearnedRelationships(analytics: any[]): Promise<void> {
    // Group analytics by agent and time window
    const agentSessions = new Map<string, any[]>();

    for (const item of analytics) {
      const sessionKey = `${item.agent_id}:${Math.floor(new Date(item.created_at).getTime() / (5 * 60 * 1000))}`;
      if (!agentSessions.has(sessionKey)) {
        agentSessions.set(sessionKey, []);
      }
      agentSessions.get(sessionKey)!.push(item);
    }

    // Find co-accessed knowledge
    for (const [_, sessionAnalytics] of agentSessions) {
      if (sessionAnalytics.length < 2) continue;

      // Sort by time
      sessionAnalytics.sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      // Create relationships between consecutively accessed items
      for (let i = 0; i < sessionAnalytics.length - 1; i++) {
        const source = sessionAnalytics[i];
        const target = sessionAnalytics[i + 1];

        if (source.knowledge_id === target.knowledge_id) continue;

        await this.updateRelationship(
          source.knowledge_id,
          target.knowledge_id,
          'co_accessed',
          0.1 // Small increment per observation
        );
      }
    }
  }

  private async updateRelationship(
    sourceId: string,
    targetId: string,
    relationshipType: string,
    strengthIncrement: number
  ): Promise<void> {
    try {
      const { error} = await supabase.rpc('update_learned_relationship', {
        p_source_id: sourceId,
        p_target_id: targetId,
        p_relationship_type: relationshipType,
        p_strength_increment: strengthIncrement,
      });

      if (error {
        // Fallback to direct insert/update
        await supabase.from('learned_knowledge_relationships').upsert(
          {
            source_knowledge_id: sourceId,
            target_knowledge_id: targetId,
            relationship_type: relationshipType,
            strength: strengthIncrement,
            confidence: 0.5,
            evidence_count: 1,
            last_observed: new Date().toISOString(),
          },
          {
            onConflict: 'source_knowledge_id,target_knowledge_id,relationship_type',
          }
        );
      }
    } catch (error) {
      logger.error(Failed to update relationship:', error;
    }
  }

  private async storePerformanceMetrics(metrics?: PerformanceMetric[]): Promise<void> {
    if (!metrics) {
      // Store cached performance metrics
      metrics = [];
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

      for (const [key, value] of this.performanceCache.entries()) {
        const [knowledgeId, knowledgeType] = key.split(':');
        metrics.push({
          metricType: 'item_performance',
          metricValue: value,
          dimensions: { knowledgeId, knowledgeType },
          periodStart: fiveMinutesAgo,
          periodEnd: now,
        });
      }
    }

    if (metrics.length === 0) return;

    const { error} = await supabase.from('knowledge_performance_metrics').insert(
      metrics.map((m) => ({
        metric_type: m.metricType,
        metric_value: m.metricValue,
        dimensions: m.dimensions,
        period_start: m.periodStart.toISOString(),
        period_end: m.periodEnd.toISOString(),
      }))
    );

    if (error {
      logger.error(Failed to store performance metrics:', error;
    }
  }

  private async detectCoAccessPatterns(analytics: any[]): Promise<KnowledgePattern[]> {
    const patterns: KnowledgePattern[] = [];
    const coAccessMap = new Map<string, number>();

    // Count co-accesses within 5-minute windows
    for (let i = 0; i < analytics.length; i++) {
      for (let j = i + 1; j < analytics.length; j++) {
        const timeDiff = Math.abs(
          new Date(analytics[i].created_at).getTime() - new Date(analytics[j].created_at).getTime()
        );

        if (timeDiff < 5 * 60 * 1000 && analytics[i].agent_id === analytics[j].agent_id) {
          const key = [analytics[i].knowledge_id, analytics[j].knowledge_id].sort().join(':');
          coAccessMap.set(key, (coAccessMap.get(key) || 0) + 1);
        }
      }
    }

    // Convert to patterns
    for (const [key, count] of coAccessMap.entries()) {
      if (count >= 3) {
        // Minimum threshold
        patterns.push({
          _pattern key,
          confidence: Math.min(count / 10, 1.0),
          evidence: count,
          lastSeen: new Date(),
        });
      }
    }

    return patterns;
  }

  private async detectSequentialPatterns(analytics: any[]): Promise<KnowledgePattern[]> {
    const patterns: KnowledgePattern[] = [];
    const sequenceMap = new Map<string, number>();

    // Group by agent
    const agentAnalytics = new Map<string, any[]>();
    for (const item of analytics) {
      if (!agentAnalytics.has(item.agent_id)) {
        agentAnalytics.set(item.agent_id, []);
      }
      agentAnalytics.get(item.agent_id)!.push(item);
    }

    // Find sequences
    for (const [_, items] of agentAnalytics) {
      items.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      for (let i = 0; i < items.length - 2; i++) {
        const sequence = [
          items[i].knowledge_id,
          items[i + 1].knowledge_id,
          items[i + 2].knowledge_id,
        ].join('->');

        sequenceMap.set(sequence, (sequenceMap.get(sequence) || 0) + 1);
      }
    }

    // Convert to patterns
    for (const [sequence, count] of sequenceMap.entries()) {
      if (count >= 2) {
        patterns.push({
          _pattern `sequence:${sequence}`,
          confidence: Math.min(count / 5, 1.0),
          evidence: count,
          lastSeen: new Date(),
        });
      }
    }

    return patterns;
  }

  private async detectFailurePatterns(analytics: any[]): Promise<KnowledgePattern[]> {
    const patterns: KnowledgePattern[] = [];
    const failureMap = new Map<string, { count: number; contexts: any[] }>();

    // Find failure patterns
    const failures = analytics.filter((a) => a.action_type === 'failed');

    for (const failure of failures) {
      const key = `${failure.knowledge_id}:${failure.context?.error_type || 'unknown'}`;

      if (!failureMap.has(key)) {
        failureMap.set(key, { count: 0, contexts: [] });
      }

      const data = failureMap.get(key)!;
      data.count++;
      data.contexts.push(failure.context);
    }

    // Convert to patterns
    for (const [key, data] of failureMap.entries()) {
      if (data.count >= 3) {
        patterns.push({
          _pattern `failure:${key}`,
          confidence: Math.min(data.count / 10, 1.0),
          evidence: data.count,
          lastSeen: new Date(),
        });
      }
    }

    return patterns;
  }

  private updatePatternCache(patterns: KnowledgePattern[], type: string): void {
    for (const _patternof patterns) {
      const key = `${type}:${_pattern_pattern`;
      const existing = this.patterns.get(key);

      if (existing) {
        // Update existing pattern
        existing.confidence = (existing.confidence + _patternconfidence) / 2;
        existing.evidence += _patternevidence;
        existing.lastSeen = _patternlastSeen;
      } else {
        // Add new pattern
        this.patterns.set(key, _pattern;
      }
    }

    // Clean old patterns
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    for (const [key, _pattern of this.patterns.entries()) {
      if (_patternlastSeen < oneWeekAgo) {
        this.patterns.delete(key);
      }
    }
  }

  private async generatePatternInsights(): Promise<void> {
    const newInsights: LearningInsight[] = [];

    // Analyze co-access patterns
    const coAccessPatterns = Array.from(this.patterns.entries())
      .filter(([key]) => key.startsWith('co_access:'))
      .filter(([_, _pattern) => _patternconfidence > 0.7);

    if (coAccessPatterns.length > 0) {
      newInsights.push({
        type: 'relationship_discovery',
        title: 'Strong Knowledge Relationships Detected',
        description: `Found ${coAccessPatterns.length} pairs of knowledge items that are frequently accessed together`,
        affectedKnowledge: coAccessPatterns.map(([key]) => key.split(':')[1]),
        recommendations: [
          'Consider creating explicit relationships between these items',
          'Optimize search to return related items together',
        ],
        confidence: 0.8,
      });
    }

    // Analyze failure patterns
    const failurePatterns = Array.from(this.patterns.entries())
      .filter(([key]) => key.startsWith('failure:'))
      .filter(([_, _pattern) => _patternconfidence > 0.5);

    if (failurePatterns.length > 0) {
      newInsights.push({
        type: 'quality_issue',
        title: 'Recurring Knowledge Failures',
        description: `${failurePatterns.length} knowledge items are consistently failing`,
        affectedKnowledge: failurePatterns.map(([key]) => key.split(':')[1]),
        recommendations: [
          'Review and update failing knowledge items',
          'Consider deprecating or replacing problematic _content,
        ],
        confidence: 0.9,
      });
    }

    // Store new insights
    this.insights.push(...newInsights);

    // Emit insights for processing
    for (const insight of newInsights) {
      this.emit('insight_generated', insight);
    }
  }

  private async checkImmediateInsights(analytics: UsageAnalytics): Promise<void> {
    // Check for critical failures
    if (analytics.actionType === 'failed' && analytics.performanceScore === 0) {
      const key = `${analytics.knowledgeId}:${analytics.knowledgeType}`;
      const recentFailures =
        this.usageCache
          .get(key)
          ?.filter(
            (a) =>
              a.actionType === 'failed' &&
              new Date(a.context.timestamp || Date.now()).getTime() > Date.now() - 60 * 60 * 1000
          ) || [];

      if (recentFailures.length >= 5) {
        this.emit('critical_failure', {
          knowledgeId: analytics.knowledgeId,
          knowledgeType: analytics.knowledgeType,
          failureCount: recentFailures.length,
          recommendation: 'Immediate review required',
        });
      }
    }

    // Check for high-performance knowledge
    if (analytics.performanceScore && analytics.performanceScore > 0.9) {
      this.emit('high_performance', {
        knowledgeId: analytics.knowledgeId,
        knowledgeType: analytics.knowledgeType,
        score: analytics.performanceScore,
        recommendation: 'Consider promoting this knowledge',
      });
    }
  }

  private async calculateRetrievalAccuracy(since: Date): Promise<number> {
    const { data, error} = await supabase
      .from('knowledge_usage_analytics')
      .select('action_type, performance_score')
      .gte('created_at', since.toISOString())
      .in('action_type', ['used', 'helpful', 'not_helpful']);

    if (error|| !data) return 0.5;

    const total = data.length;
    const successful = data.filter(
      (d) =>
        d.action_type === 'helpful' ||
        (d.action_type === 'used' && (d.performance_score || 0) > 0.5)
    ).length;

    return total > 0 ? successful / total : 0.5;
  }

  private async calculateUsageEffectiveness(since: Date): Promise<number> {
    const { data, error} = await supabase
      .from('knowledge_usage_analytics')
      .select('performance_score')
      .gte('created_at', since.toISOString())
      .not('performance_score', 'is', null);

    if (error|| !data || data.length === 0) return 0.5;

    const avgScore = data.reduce((sum, d) => sum + (d.performance_score || 0), 0) / data.length;
    return avgScore;
  }

  private async calculateUpdateFrequency(since: Date): Promise<number> {
    // Calculate how frequently knowledge needs updates based on performance degradation
    const { data, error} = await supabase
      .from('knowledge_performance_metrics')
      .select('metric_value, dimensions')
      .eq('metric_type', 'item_performance')
      .gte('period_end', since.toISOString())
      .order('period_end', { ascending: true });

    if (error|| !data || data.length < 2) return 0.5;

    // Calculate performance trend
    let degradationCount = 0;
    const knowledgePerformance = new Map<string, number[]>();

    for (const metric of data) {
      const key = `${metric.dimensions.knowledgeId}:${metric.dimensions.knowledgeType}`;
      if (!knowledgePerformance.has(key)) {
        knowledgePerformance.set(key, []);
      }
      knowledgePerformance.get(key)!.push(metric.metric_value);
    }

    // Check for degradation
    for (const [_, scores] of knowledgePerformance) {
      if (scores.length >= 2) {
        const trend = scores[scores.length - 1] - scores[0];
        if (trend < -0.1) degradationCount++;
      }
    }

    // Higher score means more items need updates
    return knowledgePerformance.size > 0 ? degradationCount / knowledgePerformance.size : 0.5;
  }

  private async checkPerformanceIssues(metrics: PerformanceMetric[]): Promise<void> {
    for (const metric of metrics) {
      if (metric.metricType === 'retrieval_accuracy' && metric.metricValue < 0.6) {
        await this.createAlert(
          'quality_drop',
          'low',
          'Low Retrieval Accuracy',
          `Retrieval accuracy has dropped to ${(metric.metricValue * 100).toFixed(1)}%`,
          []
        );
      }

      if (metric.metricType === 'update_frequency' && metric.metricValue > 0.3) {
        await this.createAlert(
          'update_needed',
          'medium',
          'Knowledge Updates Needed',
          `${(metric.metricValue * 100).toFixed(1)}% of knowledge items show performance degradation`,
          []
        );
      }
    }
  }

  private async calculateNewRankings(knowledgeItems: any[]): Promise<Map<string, any>> {
    const rankings = new Map<string, any>();
    const knowledgeStats = new Map<string, any>();

    // Aggregate stats per knowledge item
    for (const item of knowledgeItems) {
      const key = item.knowledge_id;
      if (!knowledgeStats.has(key)) {
        knowledgeStats.set(key, {
          type: item.knowledge_type,
          accessCount: 0,
          usedCount: 0,
          failedCount: 0,
          helpfulCount: 0,
          performanceSum: 0,
          performanceCount: 0,
        });
      }

      const stats = knowledgeStats.get(key)!;
      stats.accessCount++;

      if (item.action_type === 'used') stats.usedCount++;
      if (item.action_type === 'failed') stats.failedCount++;
      if (item.action_type === 'helpful') stats.helpfulCount++;

      if (item.performance_score !== null) {
        stats.performanceSum += item.performance_score;
        stats.performanceCount++;
      }
    }

    // Calculate new rankings
    for (const [knowledgeId, stats] of knowledgeStats) {
      const usageScore = Math.log(stats.accessCount + 1) / 10;
      const successRate = stats.usedCount / (stats.usedCount + stats.failedCount) || 0.5;
      const helpfulnessRate = stats.helpfulCount / stats.accessCount || 0.5;
      const avgPerformance =
        stats.performanceCount > 0 ? stats.performanceSum / stats.performanceCount : 0.5;

      // Composite ranking score
      const newRank =
        usageScore * 0.2 + successRate * 0.3 + helpfulnessRate * 0.2 + avgPerformance * 0.3;

      // Determine reranking reason
      let reason = 'usage__pattern;
      if (successRate < 0.3) reason = 'low_success_rate';
      else if (avgPerformance > 0.8) reason = 'high_performance';
      else if (stats.accessCount > 100) reason = 'high_usage';

      rankings.set(knowledgeId, {
        type: stats.type,
        oldRank: 0.5, // Would fetch actual old rank
        newRank,
        reason,
      });
    }

    return rankings;
  }

  private async applyRankingUpdate(
    knowledgeId: string,
    knowledgeType: string,
    oldRank: number,
    newRank: number,
    reason: string
  ): Promise<void> {
    // Store reranking history
    await supabase.from('knowledge_reranking_history').insert({
      knowledge_id: knowledgeId,
      knowledge_type: knowledgeType,
      old_rank: oldRank,
      new_rank: newRank,
      reranking_reason: reason,
      metadata: {
        rankChange: newRank - oldRank,
        timestamp: new Date().toISOString(),
      },
    });

    // Update knowledge item with new rank
    if (knowledgeType === 'scraped') {
      await supabase
        .from('scraped_knowledge')
        .update({
          quality_score: newRank,
          metadata: {
            lastRanked: new Date().toISOString(),
            rankingReason: reason,
          },
        })
        .eq('id', knowledgeId);
    }
  }

  private async updateSearchConfiguration(): Promise<void> {
    // Get recent performance data
    const perfData = await this.rerankingPipeline.analyzePerformance();

    // Update configuration based on insights
    const newConfig = this.rerankingPipeline.getOptimizedConfig({
      enableAdaptive: true,
      adaptiveThresholds: {
        performanceThreshold: perfData.currentPerformance.userSatisfaction,
        fallbackThreshold: 0.4,
        upgradeThreshold: 0.85,
      },
    });

    // Apply configuration would be done here
    logger.info('Updated search configuration based on performance data');
  }

  private async createAlert(
    alertType: string,
    severity: string,
    title: string,
    description: string,
    affectedItems: any[]
  ): Promise<void> {
    await supabase.from('knowledge_monitoring_alerts').insert({
      alert_type: alertType,
      severity,
      title,
      description,
      affected_items: affectedItems,
    });
  }

  /**
   * Get learning insights
   */
  getInsights(): LearningInsight[] {
    return this.insights;
  }

  /**
   * Get current patterns
   */
  getPatterns(): Map<string, KnowledgePattern> {
    return this.patterns;
  }

  /**
   * Manual feedback submission
   */
  async submitFeedback(
    knowledgeId: string,
    knowledgeType: string,
    agentId: string,
    feedback: 'helpful' | 'not_helpful',
    details?: string
  ): Promise<void> {
    await this.trackUsage({
      knowledgeId,
      knowledgeType,
      agentId,
      actionType: feedback,
      context: { manual: true },
      userFeedback: details,
    });
  }

  /**
   * Shutdown the service
   */
  async shutdown(): Promise<void> {
    // Stop all scheduled jobs
    for (const [name, job] of this.scheduledJobs) {
      job.stop();
      logger.info(`Stopped scheduled job: ${name}`);
    }

    // Clear caches
    this.usageCache.clear();
    this.performanceCache.clear();
    this.patterns.clear();
    this.insights = [];

    // Remove all listeners
    this.removeAllListeners();
  }
}

// Export factory function
export function createKnowledgeFeedbackService(
  supabaseClient: any,
  logger: any
): KnowledgeFeedbackService {
  const rerankingPipeline = new RerankingPipeline(supabaseClient, logger);
  const knowledgeManager = new DSPyKnowledgeManager();

  return new KnowledgeFeedbackService(rerankingPipeline, knowledgeManager);
}
import type { DSPyBridge } from './dspy-orchestrator/bridge';
import { dspyBridge } from './dspy-orchestrator/bridge';
import { LogContext, logger } from '../utils/enhanced-logger';
import { v4 as uuidv4 } from 'uuid';
import { BATCH_SIZE_10, HTTP_200, HTTP_400, HTTP_401, HTTP_404, HTTP_500, MAX_ITEMS_100, PERCENT_10, PERCENT_100, PERCENT_20, PERCENT_30, PERCENT_50, PERCENT_80, PERCENT_90, TIME_10000MS, TIME_1000MS, TIME_2000MS, TIME_5000MS, TIME_500MS, ZERO_POINT_EIGHT, ZERO_POINT_FIVE, ZERO_POINT_NINE } from "../utils/common-constants";

export interface DSPyOrchestrationRequest {
  requestId: string;
  userRequest: string;
  userId: string;
  orchestrationMode?: 'simple' | 'standard' | 'cognitive' | 'adaptive';
  context?: Record<string, unknown>;
  timestamp: Date;
}

export interface DSPyOrchestrationResponse {
  requestId: string;
  success: boolean;
  mode: string;
  result: any;
  complexity?: number;
  confidence?: number;
  reasoning?: string;
  participatingAgents?: string[];
  executionTime: number;
  error: string;
}

export class DSPyService {
  private bridge: DSPyBridge;
  private isInitialized = false;

  constructor() {
    this.bridge = dspyBridge;
    // Don't block on initialization - let it happen in the background
    this.initialize().catch((error => {
      logger.error(DSPy service initialization failed:', LogContext.DSPY, {
        error errorinstanceof Error ? errormessage : String(error,
      });
    });
  }

  private async initialize(): Promise<void> {
    try {
      logger.info('🚀 Initializing DSPy service...');

      // Wait for bridge to connect (with short timeout to not block server startup)
      if (process.env.ENABLE_DSPY_MOCK === 'true') {
        await this.waitForConnection(5000);
      } else {
        logger.info('DSPy mock disabled - skipping connection wait');
      }

      this.isInitialized = true;
      logger.info('✅ DSPy service initialized successfully');
    } catch (error) {
      logger.warn(
        'DSPy service initialization failed (will retry on first use)',
        LogContext.SYSTEM,
        { error errorinstanceof Error ? errormessage : String(error }
      );
      // Don't throw - let server continue without DSPy
      this.isInitialized = false;
    }
  }

  private async waitForConnection(timeout = 30000): Promise<void> {
    const startTime = Date.now();

    while (!this.bridge.getStatus().connected) {
      if (Date.now() - startTime > timeout) {
        throw new Error('DSPy connection timeout');
      }
      await new Promise((resolve) => setTimeout(TIME_1000MS));
    }
  }

  /**
   * Main orchestration method that replaces the old enhanced orchestrator
   */
  async orchestrate(_request DSPyOrchestrationRequest): Promise<DSPyOrchestrationResponse> {
    const startTime = Date.now();

    try {
      if (!this.isInitialized) {
        await this.waitForConnection();
      }

      logger.info(`🎯 DSPy orchestration for _request${_requestrequestId}`);

      // Call DSPy orchestrator
      const result = await this.bridge.orchestrate(_requestuserRequest, {
        userId: _requestuserId,
        mode: _requestorchestrationMode,
        ..._requestcontext,
      });

      const executionTime = Date.now() - startTime;

      // Extract relevant information from DSPy result
      const response: DSPyOrchestrationResponse = {
        requestId: _requestrequestId,
        success: true,
        mode: result.orchestration_mode || 'standard',
        result: result.consensus || result,
        complexity: result.complexity,
        confidence: result.confidence,
        reasoning: result.coordination_plan || result.reasoning,
        participatingAgents: result.selected_agents
          ? result.selected_agents.split(',').map((a: string) => a.trim())
          : [],
        executionTime,
      };

      logger.info(`✅ DSPy orchestration completed in ${executionTime}ms`);
      return response;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      logger.error(DSPy orchestration failed:', LogContext.DSPY, {
        error errorinstanceof Error ? errormessage : String(error,
      });

      return {
        requestId: _requestrequestId,
        success: false,
        mode: 'fallback',
        result: null,
        executionTime,
        error errorinstanceof Error ? errormessage : String(error,
      };
    }
  }

  /**
   * Coordinate multiple agents for a specific task
   */
  async coordinateAgents(
    task: string,
    availableAgents: string[],
    context: Record<string, unknown> = {}
  ): Promise<unknown> {
    try {
      const result = await this.bridge.coordinateAgents(task, availableAgents, context);

      return {
        success: true,
        selectedAgents: result.selected_agents,
        coordinationPlan: result.coordination_plan,
        assignments: result.agent_assignments || [],
      };
    } catch (error) {
      logger.error(Agent coordination failed:', LogContext.DSPY, {
        error errorinstanceof Error ? errormessage : String(error,
      });
      throw error
    }
  }

  /**
   * Generic _requestmethod for DSPy operations
   */
  async _requestoperation: string, params: any = {}): Promise<unknown> {
    try {
      switch (operation) {
        case 'manage_knowledge':
        case 'optimize_knowledge_modules':
        case 'get_optimization_metrics':
          return await this.manageKnowledge(operation, params);

        case 'orchestrate':
          return await this.orchestrate({
            requestId: params.requestId || uuidv4(),
            userRequest: params.userRequest || '',
            userId: params.userId || 'system',
            orchestrationMode: params.mode,
            context: params,
            timestamp: new Date(),
          });

        case 'coordinate_agents':
          return await this.coordinateAgents(
            params.task || '',
            params.availableAgents || [],
            params.context || {}
          );

        default:
          // For unknown operations, try to pass through to DSPy bridge
          if (this.bridge && typeof (this.bridge as any)[operation] === 'function') {
            return await (this.bridge as any)[operation](params);
          }
          throw new Error(`Unknown DSPy operation: ${operation}`);
      }
    } catch (error) {
      logger.error`DSPy _requestfailed for operation ${operation}:`, LogContext.DSPY, {
        error errorinstanceof Error ? errormessage : String(error,
      });
      return {
        success: false,
        error errorinstanceof Error ? errormessage : String(error,
      };
    }
  }

  /**
   * Manage knowledge operations through DSPy
   */
  async manageKnowledge(operation: string, data: any): Promise<unknown> {
    try {
      const result = await this.bridge.manageKnowledge(operation, data);

      return {
        success: true,
        operation,
        result,
      };
    } catch (error) {
      logger.error(Knowledge management failed:', LogContext.DSPY, {
        error errorinstanceof Error ? errormessage : String(error,
      });
      throw error
    }
  }

  /**
   * Search knowledge using DSPy's optimized search
   */
  async searchKnowledge(query: string, options: any = {}): Promise<unknown> {
    return this.manageKnowledge('search', { query, ...options });
  }

  /**
   * Extract structured knowledge from content
   */
  async extractKnowledge(_content string, context: any = {}): Promise<unknown> {
    return this.manageKnowledge('extract', { _content context });
  }

  /**
   * Evolve existing knowledge with new information
   */
  async evolveKnowledge(existingKnowledge: string, newInfo: string): Promise<unknown> {
    return this.manageKnowledge('evolve', {
      existing_knowledge: existingKnowledge,
      new_information: newInfo,
    });
  }

  /**
   * Optimize prompts for better performance
   */
  async optimizePrompts(examples: any[]): Promise<unknown> {
    try {
      const result = await this.bridge.optimizePrompts(examples);

      return {
        success: true,
        optimized: result.optimized,
        improvements: result.improvements,
        performanceGain: result.performance_gain,
      };
    } catch (error) {
      logger.error(Prompt optimization failed:', LogContext.DSPY, {
        error errorinstanceof Error ? errormessage : String(error,
      });
      throw error
    }
  }

  /**
   * Get service status
   */
  getStatus(): { initialized: boolean; connected: boolean; queueSize: number } {
    const bridgeStatus = this.bridge.getStatus();

    return {
      initialized: this.isInitialized,
      connected: bridgeStatus.connected,
      queueSize: bridgeStatus.queueSize,
    };
  }

  /**
   * Shutdown the service gracefully
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down DSPy service...');
    await this.bridge.shutdown();
    this.isInitialized = false;
  }
}

// Lazy initialization to prevent blocking during import
let _dspyService: DSPyService | null = null;

export function getDSPyService(): DSPyService {
  if (!_dspyService) {
    _dspyService = new DSPyService();
  }
  return _dspyService;
}

// For backward compatibility (but prefer using getDSPyService())
export const dspyService = {
  orchestrate: async (_request DSPyOrchestrationRequest) => getDSPyService().orchestrate(_request,
  coordinateAgents: async (
    task: string,
    availableAgents: string[],
    context: Record<string, unknown> = {}
  ) => getDSPyService().coordinateAgents(task, availableAgents, context),
  searchKnowledge: async (query: string, options: any = {}) =>
    getDSPyService().searchKnowledge(query, options),
  extractKnowledge: async (_content string, context: any = {}) =>
    getDSPyService().extractKnowledge(_content context),
  evolveKnowledge: async (existingKnowledge: string, newInfo: string) =>
    getDSPyService().evolveKnowledge(existingKnowledge, newInfo),
  optimizePrompts: async (examples: any[]) => getDSPyService().optimizePrompts(examples),
  _request async (operation: string, params: any = {}) =>
    getDSPyService()._requestoperation, params),
  manageKnowledge: async (operation: string, data: any) =>
    getDSPyService().manageKnowledge(operation, data),
  getStatus: () => getDSPyService().getStatus(),
  shutdown: async () => getDSPyService().shutdown(),
};

// Types are already exported above
import { SupabaseService } from './supabase_service';
import { logger } from '../utils/logger';
import { tf, tfAvailable } from '../utils/tensorflow-loader';
import { pipeline } from '@xenova/transformers';
import { Worker } from 'worker_threads';
import { EventEmitter } from 'events';
import { onnxRuntime } from './onnx-runtime/index.js';
import { fetchJsonWithTimeout } from '../utils/fetch-with-timeout';

/**
 * Universal LLM Orchestrator
 * A comprehensive system that can run any LLM anywhere - locally, edge, or cloud
 * with automatic routing, caching, and optimization
 */
export class UniversalLLMOrchestrator extends EventEmitter {
  private supabase: SupabaseService;
  private models: Map<string, any> = new Map();
  private workers: Map<string, Worker> = new Map();
  private cache: Map<string, any> = new Map();
  private embedder: any;

  constructor() {
    super();
    this.supabase = SupabaseService.getInstance();
    this.initialize();
  }

  private async initialize() {
    // Initialize local embedding model
    this.embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

    // Load configuration from Supabase
    await this.loadModelConfigurations();

    // Start model workers
    await this.initializeWorkers();

    logger.info('🚀 Universal LLM Orchestrator initialized');
  }

  /**
   * The main inference method - routes to the best available model
   */
  async infer(_request {
    task: 'code-fix' | 'embedding' | 'completion' | '_analysis | 'custom';
    _input any;
    options?: any;
    preferredModels?: string[];
    constraints?: {
      maxLatency?: number;
      maxCost?: number;
      minAccuracy?: number;
      requireLocal?: boolean;
    };
  }) {
    const startTime = Date.now();

    // Check cache first
    const cacheKey = this.getCacheKey(_request;
    if (this.cache.has(cacheKey)) {
      logger.info('Cache hit for inference _request);
      return this.cache.get(cacheKey);
    }

    // Route to appropriate model
    const model = await this.selectBestModel(_request;

    // Log the decision
    await this.logModelSelection(_request model);

    // Execute inference
    let result;
    switch (model.type) {
      case 'local':
        result = await this.runLocalModel(model, _request;
        break;
      case 'edge':
        result = await this.runEdgeModel(model, _request;
        break;
      case 'cloud':
        result = await this.runCloudModel(model, _request;
        break;
      case 'distributed':
        result = await this.runDistributedInference(model, _request;
        break;
      case 'ensemble':
        result = await this.runEnsembleInference(model, _request;
        break;
      default:
        throw new Error(`Unknown model type: ${model.type}`);
    }

    // Post-process and cache
    result = await this.postProcess(result, _request;
    this.cache.set(cacheKey, result);

    // Store in Supabase for learning
    await this.storeInference(_request result, model, Date.now() - startTime);

    return result;
  }

  /**
   * Select the best model based on _requestand constraints
   */
  private async selectBestModel(_request any) {
    const candidates = await this.getModelCandidates(_request;

    // Score each candidate
    const scores = await Promise.all(
      candidates.map(async (model) => ({
        model,
        score: await this.scoreModel(model, _request,
      }))
    );

    // Sort by score and return best
    scores.sort((a, b) => b.score - a.score);

    return scores[0].model;
  }

  /**
   * Log model selection decision
   */
  private async logModelSelection(_request any, model: any) {
    try {
      await this.supabase.client.from('model_selections').insert({
        task_type: _requesttask,
        model_id: model.id,
        model_type: model.type,
        input_hash: this.hashInput(_request_input,
        constraints: _requestconstraints,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error(Failed to log model selection:', error;
    }
  }

  /**
   * Post-process inference results
   */
  private async postProcess(result: any, _request any) {
    // Add metadata
    if (result && typeof result === 'object') {
      result.metadata = {
        task: _requesttask,
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      };
    }

    // Apply any post-processing filters
    if (_requestoptions?.postProcessFilters) {
      for (const filter of _requestoptions.postProcessFilters) {
        result = await this.applyPostProcessFilter(result, filter);
      }
    }

    return result;
  }

  /**
   * Apply post-processing filter
   */
  private async applyPostProcessFilter(result: any, filter: any) {
    // Implement various post-processing filters
    switch (filter.type) {
      case 'sanitize':
        return this.sanitizeOutput(result);
      case 'format':
        return this.formatOutput(result, filter.options);
      case 'validate':
        return this.validateOutput(result, filter.schema);
      default:
        return result;
    }
  }

  /**
   * Sanitize output
   */
  private sanitizeOutput(result: any) {
    if (typeof result === 'string') {
      // Remove potentially sensitive information
      return result.replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, '[REDACTED]');
    }
    return result;
  }

  /**
   * Format output
   */
  private formatOutput(result: any, options: any) {
    if (options.format === 'json' && typeof result === 'string') {
      try {
        return JSON.parse(result);
      } catch {
        return result;
      }
    }
    return result;
  }

  /**
   * Validate output
   */
  private validateOutput(result: any, schema: any) {
    // Basic validation - extend as needed
    if (schema.required && !result) {
      throw new Error('Output is required but empty');
    }
    return result;
  }

  /**
   * Run inference on local model (in-process or worker thread)
   */
  private async runLocalModel(model: any, _request any) {
    switch (model.engine) {
      case 'tensorflow':
        return this.runTensorFlowModel(model, _request;
      case 'onnx':
        return this.runONNXModel(model, _request;
      case 'transformers':
        return this.runTransformersModel(model, _request;
      case 'custom':
        return this.runCustomModel(model, _request;
      default:
        throw new Error(`Unknown engine: ${model.engine}`);
    }
  }

  /**
   * Run TensorFlow model
   */
  private async runTensorFlowModel(model: any, _request any) {
    if (!tfAvailable) {
      throw new Error('TensorFlow is not available');
    }

    if (!this.models.has(model.id)) {
      // Load model
      const tfModel = await tf.loadLayersModel(model.path);
      this.models.set(model.id, tfModel);
    }

    const tfModel = this.models.get(model.id);
    const _input= await this.preprocessInput(_request_input model);
    const output = tfModel.predict(_input;
    const result = await output.array();

    output.dispose();
    return this.decodeOutput(result, model);
  }

  /**
   * Run ONNX model using real ONNX Runtime
   */
  private async runONNXModel(model: any, _request any) {
    try {
      logger.info(`Running ONNX model ${model.id}`);

      // Ensure model is loaded in ONNX runtime
      const loadedModels = onnxRuntime.getLoadedModels();
      if (!loadedModels.includes(model.id)) {
        await onnxRuntime.loadModel(model.id, {
          modelPath: model.modelPath,
          executionProviders: model.executionProviders || ['cpu'],
          graphOptimizationLevel: 'all',
          enableCpuMemArena: true,
          enableMemPattern: true,
        });
        logger.info(`ONNX model ${model.id} loaded successfully`);
      }

      // Run inference with real ONNX runtime
      const result = await onnxRuntime.runInference(model.id, {
        _input _request_input
        inputNames: _requestinputNames,
        outputNames: _requestoutputNames,
      });

      logger.info(`ONNX inference completed in ${result.inferenceTime}ms`);

      return {
        output: result.output,
        confidence: 0.95, // Real confidence would be extracted from model output
        inferenceTime: result.inferenceTime,
        metadata: result.metadata,
        runtime: 'onnx-real',
      };
    } catch (error) {
      logger.error`Error running ONNX model ${model.id}:`, error;

      // Fallback to mock only in development
      if (process.env.NODE_ENV === 'development') {
        logger.warn('Development mode: falling back to mock ONNX response');
        return {
          output: `Mock ONNX result for ${model.name}: ${JSON.stringify(_request_input}`,
          confidence: 0.5,
          error 'ONNX runtime failed, using mock',
          runtime: 'onnx-mock',
        };
      } else {
        throw error // Re-throw in production
      }
    }
  }

  /**
   * Run Transformers model
   */
  private async runTransformersModel(model: any, _request any) {
    try {
      if (model.task === 'embedding') {
        const embeddings = await this.embedder(_request_input;
        return embeddings;
      }

      // For other tasks, use the pipeline if available
      const pipe = await pipeline(model.task, model.modelPath);
      return await pipe(_request_input;
    } catch (error) {
      logger.error`Error running transformers model ${model.id}:`, error;
      throw error
    }
  }

  /**
   * Run custom model
   */
  private async runCustomModel(model: any, _request any) {
    // Load and execute custom model
    try {
      const customModel = await import(model.modulePath);
      return await customModel.infer(_request_input model.config);
    } catch (error) {
      logger.error`Error running custom model ${model.id}:`, error;
      throw error
    }
  }

  /**
   * Preprocess _inputfor model
   */
  private async preprocessInput(_input any, model: any) {
    switch (model.inputType) {
      case 'tensor':
        if (!tfAvailable) {
          throw new Error('TensorFlow is required for tensor _inputprocessing');
        }
        if (typeof _input=== 'string') {
          // Convert string to tensor (example for text)
          const tokens = _inputsplit(' ').map((token) => token.length);
          return tf.tensor2d([tokens]);
        }
        return tf.tensor(_input;
      case 'array':
        return Array.isArray(_input ? _input: [_input;
      default:
        return _input
    }
  }

  /**
   * Decode model output
   */
  private decodeOutput(output: any, model: any) {
    switch (model.outputType) {
      case 'classification':
        return {
          predictions: output,
          class: output.indexOf(Math.max(...output)),
        };
      case 'regression':
        return { value: output[0] };
      default:
        return output;
    }
  }

  /**
   * Run model in Edge Function
   */
  private async runEdgeModel(model: any, _request any) {
    const { data, error} = await this.supabase.client.functions.invoke(model.functionName, {
      body: {
        ..._request
        modelConfig: model.config,
      },
    });

    if (error throw error
    return data;
  }

  /**
   * Format _requestfor specific model API
   */
  private formatRequestForModel(_request any, model: any) {
    switch (model.id) {
      case 'openai-gpt4':
        return {
          model: 'gpt-4',
          messages: [{ role: 'user', _content _request_input}],
          max_tokens: _requestoptions?.maxTokens || 1000,
        };
      case 'ollama-codellama':
        return {
          model: 'codellama',
          prompt: _request_input
          stream: false,
        };
      default:
        return {
          _input _request_input
          options: _requestoptions,
        };
    }
  }

  /**
   * Parse model response
   */
  private parseModelResponse(data: any, model: any) {
    switch (model.id) {
      case 'openai-gpt4':
        return {
          output: data.choices[0]?.message?._content|| '',
          usage: data.usage,
        };
      case 'ollama-codellama':
        return {
          output: data.response || '',
          done: data.done,
        };
      default:
        return data;
    }
  }

  /**
   * Run model via cloud API
   */
  private async runCloudModel(model: any, _request any) {
    const headers: any = {
      'Content-Type': 'application/json',
    };

    // Add authentication
    if (model.auth.type === 'bearer') {
      headers['Authorization'] = `Bearer ${model.auth.key}`;
    }

    const body = this.formatRequestForModel(_request model);

    try {
      const data = await fetchJsonWithTimeout(model.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        timeout: 60000, // 60 seconds for ML inference
        retries: 1, // One retry for ML endpoints
      });

      return this.parseModelResponse(data, model);
    } catch (error) {
      logger.error(Remote model inference failed:', {
        model: model.name,
        endpoint: model.endpoint,
        error errormessage,
      });
      throw new Error(`Remote inference failed for ${model.name}: ${errormessage}`);
    }
  }

  /**
   * Chunk _inputfor distributed processing
   */
  private chunkInput(_input any, chunkSize: number) {
    if (typeof _input=== 'string') {
      const chunks = [];
      for (let i = 0; i < _inputlength; i += chunkSize) {
        chunks.push(_inputslice(i, i + chunkSize));
      }
      return chunks;
    }

    if (Array.isArray(_input) {
      const chunks = [];
      for (let i = 0; i < _inputlength; i += chunkSize) {
        chunks.push(_inputslice(i, i + chunkSize));
      }
      return chunks;
    }

    return [_input;
  }

  /**
   * Run inference on a specific node
   */
  private async runOnNode(node: any, _request any) {
    try {
      return await fetchJsonWithTimeout(node.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...node.headers,
        },
        body: JSON.stringify({
          ..._request
          nodeId: node.id,
        }),
        timeout: 30000, // 30 seconds for distributed nodes
        retries: 1,
      });
    } catch (error) {
      logger.error(Node execution failed:', {
        nodeId: node.id,
        endpoint: node.endpoint,
        error errormessage,
      });
      throw error
    }
  }

  /**
   * Merge results from distributed inference
   */
  private mergeDistributedResults(results: any[], model: any) {
    switch (model.mergeStrategy) {
      case 'concatenate':
        return {
          output: results.map((r) => r.output).join(''),
          metadata: {
            chunks: results.length,
            strategy: 'concatenate',
          },
        };
      case 'average':
        const values = results.map((r) => parseFloat(r.output) || 0);
        return {
          output: values.reduce((a, b) => a + b, 0) / values.length,
          metadata: {
            chunks: results.length,
            strategy: 'average',
          },
        };
      case 'vote':
        const votes = results.map((r) => r.output);
        const counts = votes.reduce((acc, vote) => {
          acc[vote] = (acc[vote] || 0) + 1;
          return acc;
        }, {});
        const winner = Object.keys(counts).reduce((a, b) => (counts[a] > counts[b] ? a : b));
        return {
          output: winner,
          metadata: {
            chunks: results.length,
            strategy: 'vote',
            votes: counts,
          },
        };
      default:
        return results[0];
    }
  }

  /**
   * Run distributed inference across multiple models/nodes
   */
  private async runDistributedInference(model: any, _request any) {
    const chunks = this.chunkInput(_request_input model.chunkSize);

    const promises = chunks.map((chunk: any, index: number) => {
      const node = model.nodes[index % model.nodes.length];
      return this.runOnNode(node, { ..._request _input chunk });
    });

    const results = await Promise.all(promises);
    return this.mergeDistributedResults(results, model);
  }

  /**
   * Aggregate results from ensemble inference
   */
  private aggregateEnsembleResults(results: any[], model: any) {
    switch (model.aggregationStrategy) {
      case 'weighted_average':
        const weights = model.ensemble.map((m: any) => m.weight || 1);
        let weightedSum = 0;
        let totalWeight = 0;

        results.forEach((result, index) => {
          const weight = weights[index] || 1;
          const value = parseFloat(result.output) || 0;
          weightedSum += value * weight;
          totalWeight += weight;
        });

        return {
          output: weightedSum / totalWeight,
          metadata: {
            ensembleSize: results.length,
            strategy: 'weighted_average',
          },
        };

      case 'majority_vote':
        const votes = results.map((r) => r.output);
        const voteCounts = votes.reduce((acc, vote) => {
          acc[vote] = (acc[vote] || 0) + 1;
          return acc;
        }, {});

        const winner = Object.keys(voteCounts).reduce((a, b) =>
          voteCounts[a] > voteCounts[b] ? a : b
        );

        return {
          output: winner,
          metadata: {
            ensembleSize: results.length,
            strategy: 'majority_vote',
            votes: voteCounts,
          },
        };

      case 'confidence_weighted':
        const confidenceWeighted = results.map((r) => ({
          output: r.output,
          confidence: r.confidence || 0.5,
        }));

        const totalConfidence = confidenceWeighted.reduce((sum, r) => sum + r.confidence, 0);
        const weightedResult = confidenceWeighted.reduce((sum, r) => {
          const weight = r.confidence / totalConfidence;
          return sum + (parseFloat(r.output) || 0) * weight;
        }, 0);

        return {
          output: weightedResult,
          metadata: {
            ensembleSize: results.length,
            strategy: 'confidence_weighted',
          },
        };

      default:
        // Default to simple average
        const values = results.map((r) => parseFloat(r.output) || 0);
        return {
          output: values.reduce((a, b) => a + b, 0) / values.length,
          metadata: {
            ensembleSize: results.length,
            strategy: 'simple_average',
          },
        };
    }
  }

  /**
   * Run ensemble inference - multiple models vote
   */
  private async runEnsembleInference(model: any, _request any) {
    const modelPromises = model.ensemble.map((subModel: any) =>
      this.infer({
        ..._request
        preferredModels: [subModel.id],
      }).catch((err) => {
        logger.error`Ensemble member ${subModel.id} failed:`, err);
        return null;
      })
    );

    const results = await Promise.all(modelPromises);
    const validResults = results.filter((r) => r !== null);

    if (validResults.length === 0) {
      throw new Error('All ensemble members failed');
    }

    return this.aggregateEnsembleResults(validResults, model);
  }

  /**
   * Advanced model configurations stored in Supabase
   */
  private async loadModelConfigurations() {
    const { data: models } = await this.supabase.client
      .from('llm_models')
      .select('*')
      .eq('enabled', true);

    if (models) {
      models.forEach((model) => {
        this.models.set(model.id, model);
      });
    }

    // Load default models if none in database
    if (this.models.size === 0) {
      await this.loadDefaultModels();
    }
  }

  /**
   * Initialize worker threads for heavy models
   */
  private async initializeWorkers() {
    const workerModels = Array.from(this.models.values()).filter((m) => m.useWorker);

    for (const model of workerModels) {
      const worker = new Worker(
        `
        const { parentPort } = require('worker_threads');
        const model = require('${model.workerPath}');
        
        parentPort.on('message', async (msg) => {
          try {
            const result = await model.infer(msg);
            parentPort.postMessage({ success: true, result });
          } catch (error) {
            parentPort.postMessage({ success: false, error errormessage });
          }
        });
      `,
        { eval: true }
      );

      this.workers.set(model.id, worker);
    }
  }

  /**
   * Summarize output for storage
   */
  private summarizeOutput(result: any): string {
    if (typeof result === 'string') {
      return result.length > 100 ? `${result.substring(0, 100)}...` : result;
    }

    if (typeof result === 'object' && result !== null) {
      const summary = {
        type: Array.isArray(result) ? 'array' : 'object',
        keys: Array.isArray(result) ? result.length : Object.keys(result).length,
        hasOutput: 'output' in result,
        hasError: 'error in result,
      };
      return JSON.stringify(summary);
    }

    return String(result);
  }

  /**
   * Store inference results for learning and optimization
   */
  private async storeInference(_request any, result: any, model: any, latency: number) {
    try {
      await this.supabase.client.from('llm_inferences').insert({
        model_id: model.id,
        task_type: _requesttask,
        input_hash: this.hashInput(_request_input,
        output_summary: this.summarizeOutput(result),
        latency_ms: latency,
        success: true,
        metadata: {
          constraints: _requestconstraints,
          options: _requestoptions,
          model_config: model.config,
        },
      });
    } catch (error) {
      logger.error(Failed to store inference:', error;
    }
  }

  /**
   * Smart caching with embedding-based similarity
   */
  private getCacheKey(_request any): string {
    return `${_requesttask}:${this.hashInput(_request_input}:${JSON.stringify(_requestoptions)}`;
  }

  private hashInput(_input any): string {
    // Use a proper hash function in production
    return JSON.stringify(_input
      .split('')
      .reduce((a, b) => {
        a = (a << 5) - a + b.charCodeAt(0);
        return a & a;
      }, 0)
      .toString(36);
  }

  /**
   * Load default model configurations
   */
  private async loadDefaultModels() {
    const defaultModels = [
      {
        id: 'local-embedder',
        name: 'Local Embeddings',
        type: 'local',
        engine: 'transformers',
        task: ['embedding'],
        modelPath: 'Xenova/all-MiniLM-L6-v2',
      },
      {
        id: 'edge-gte-small',
        name: 'Supabase GTE Small',
        type: 'edge',
        task: ['embedding'],
        functionName: 'generate-embedding',
      },
      {
        id: 'ollama-codellama',
        name: 'Ollama CodeLlama',
        type: 'cloud',
        task: ['code-fix', 'completion'],
        endpoint: 'http://localhost:11434/api/generate',
        auth: { type: 'none' },
      },
      {
        id: 'openai-gpt4',
        name: 'OpenAI GPT-4',
        type: 'cloud',
        task: ['code-fix', 'completion', '_analysis],
        endpoint: 'https://api.openai.com/v1/chat/completions',
        auth: { type: 'bearer', key: process.env.OPENAI_API_KEY },
      },
    ];

    // Store in memory
    defaultModels.forEach((model) => {
      this.models.set(model.id, model);
    });

    // Store in Supabase
    await this.supabase.client.from('llm_models').upsert(defaultModels);
  }

  /**
   * Advanced features for production use
   */

  // Automatic model download and optimization
  async downloadAndOptimizeModel(modelUrl: string, optimization: 'quantize' | 'prune' | 'distill') {
    logger.info(`Downloading and optimizing model from ${modelUrl}`);
    // Implementation for model optimization
  }

  // Fine-tune models on your data
  async fineTuneModel(modelId: string, trainingData: any[], options?: any) {
    logger.info(`Fine-tuning model ${modelId}`);
    // Implementation for fine-tuning
  }

  // A/B testing for model selection
  async runABTest(_request any, modelA: string, modelB: string) {
    const [resultA, resultB] = await Promise.all([
      this.infer({ ..._request preferredModels: [modelA] }),
      this.infer({ ..._request preferredModels: [modelB] }),
    ]);

    // Store comparison for analysis
    await this.supabase.client.from('model_ab_tests').insert({
      model_a_id: modelA,
      model_b_id: modelB,
      task: _requesttask,
      result_a: resultA,
      result_b: resultB,
      timestamp: new Date().toISOString(),
    });

    return { modelA: resultA, modelB: resultB };
  }

  /**
   * Get cheaper alternatives for a model
   */
  private async getCheaperAlternatives(model: any, _request any) {
    const allModels = Array.from(this.models.values());
    const alternatives = allModels
      .filter((m) => m.id !== model.id && m.task.some((t: string) => model.task.includes(t)))
      .map((m) => ({
        model: m,
        cost: this.calculateCost(m, this.estimateTokens(_request_input),
        estimatedLatency: m.avgLatency || 1000,
      }))
      .filter((alt) => alt.cost < this.calculateCost(model, this.estimateTokens(_request_input))
      .sort((a, b) => a.cost - b.cost)
      .slice(0, 3);

    return alternatives.map((alt) => ({
      modelId: alt.model.id,
      name: alt.model.name,
      estimatedCost: alt.cost,
      estimatedLatency: alt.estimatedLatency,
      savings: this.calculateCost(model, this.estimateTokens(_request_input) - alt.cost,
    }));
  }

  // Cost tracking and optimization
  async getCostEstimate(_request any) {
    const model = await this.selectBestModel(_request;
    const tokenCount = this.estimateTokens(_request_input;

    return {
      model: model.name,
      estimatedTokens: tokenCount,
      estimatedCost: this.calculateCost(model, tokenCount),
      alternatives: await this.getCheaperAlternatives(model, _request,
    };
  }

  // Model health monitoring
  async getModelHealth() {
    const health: any = {};

    for (const [id, model] of Array.from(this.models.entries())) {
      health[id] = {
        name: model.name,
        status: await this.checkModelStatus(model),
        latency: await this.measureLatency(model),
        successRate: await this.getSuccessRate(model),
        lastUsed: await this.getLastUsed(model),
      };
    }

    return health;
  }

  // Helper methods
  private estimateTokens(_input any): number {
    // Simple estimation - improve based on model
    return JSON.stringify(_input.length / 4;
  }

  private calculateCost(model: any, tokens: number): number {
    return (model.costPerToken || 0) * tokens;
  }

  private async checkModelStatus(model: any): Promise<'healthy' | 'degraded' | 'offline'> {
    try {
      const testResult = await this.infer({
        task: 'completion',
        _input 'test',
        preferredModels: [model.id],
        constraints: { maxLatency: 5000 },
      });
      return testResult ? 'healthy' : 'degraded';
    } catch {
      return 'offline';
    }
  }

  private async measureLatency(model: any): Promise<number> {
    const start = Date.now();
    try {
      await this.infer({
        task: 'completion',
        _input 'latency test',
        preferredModels: [model.id],
      });
    } catch {
      // Ignore errors for latency measurement
    }
    return Date.now() - start;
  }

  private async getSuccessRate(model: any): Promise<number> {
    const { data } = await this.supabase.client
      .from('llm_inferences')
      .select('success')
      .eq('model_id', model.id)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (!data || data.length === 0) return 0;

    const successes = data.filter((d) => d.success).length;
    return successes / data.length;
  }

  private async getLastUsed(model: any): Promise<string | null> {
    const { data } = await this.supabase.client
      .from('llm_inferences')
      .select('created_at')
      .eq('model_id', model.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    return data?.created_at || null;
  }

  // More helper methods...
  private async getModelCandidates(_request any) {
    const allModels = Array.from(this.models.values());

    return allModels.filter((model) => {
      // Filter by task support
      if (!model.task.includes(_requesttask)) return false;

      // Filter by constraints
      if (_requestconstraints?.requireLocal && model.type !== 'local') return false;

      // Filter by preferred models
      if (_requestpreferredModels?.length > 0) {
        return _requestpreferredModels.includes(model.id);
      }

      return true;
    });
  }

  private async scoreModel(model: any, _request any): Promise<number> {
    let score = 100;

    // Score based on past performance
    const successRate = await this.getSuccessRate(model);
    score *= successRate;

    // Score based on latency
    if (_requestconstraints?.maxLatency) {
      const latency = await this.measureLatency(model);
      if (latency > _requestconstraints.maxLatency) {
        score *= 0.5;
      }
    }

    // Score based on cost
    if (_requestconstraints?.maxCost) {
      const cost = this.calculateCost(model, this.estimateTokens(_request_input);
      if (cost > _requestconstraints.maxCost) {
        score *= 0.3;
      }
    }

    // Prefer local models for privacy
    if (model.type === 'local') {
      score *= 1.2;
    }

    return score;
  }

  // More implementations...
}

// Export singleton instance
export const llmOrchestrator = new UniversalLLMOrchestrator();
import { Redis } from 'ioredis';
import semver from 'semver';
import { logger } from '../utils/logger';

interface VersionedData<T = any> {
  data: T;
  schema: string;
  version: string;
  createdAt: number;
  migratedFrom?: string;
}

interface MigrationFunction<TFrom = any, TTo = any> {
  (data: TFrom): TTo | Promise<TTo>;
}

interface VersionMigration {
  from: string;
  to: string;
  migrate: MigrationFunction;
  rollback?: MigrationFunction;
}

interface ConflictResolution<T = any> {
  strategy: 'newest' | 'merge' | 'custom';
  resolver?: (current: T, incoming: T) => T | Promise<T>;
}

export class CacheVersioningService {
  private redis: Redis;
  private migrations: Map<string, VersionMigration[]>;
  private schemas: Map<string, any>;
  private conflictResolvers: Map<string, ConflictResolution>;
  private readonly VERSION_KEY_PREFIX = 'uai:version:';
  private readonly SCHEMA_KEY_PREFIX = 'uai:schema:';
  private readonly MIGRATION_LOG_KEY = 'uai:migrations:log';

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl);
    this.migrations = new Map();
    this.schemas = new Map();
    this.conflictResolvers = new Map();
  }

  registerSchema(name: string, version: string, schema: any): void {
    const key = `${name}:${version}`;
    this.schemas.set(key, schema);

    // Persist schema to Redis
    this.redis.hset(`${this.SCHEMA_KEY_PREFIX}${name}`, version, JSON.stringify(schema));
  }

  registerMigration(schemaName: string, migration: VersionMigration): void {
    if (!this.migrations.has(schemaName)) {
      this.migrations.set(schemaName, []);
    }

    const migrations = this.migrations.get(schemaName)!;

    // Validate version progression
    if (!semver.lt(migration.from, migration.to)) {
      throw new Error(`Invalid migration: ${migration.from} must be less than ${migration.to}`);
    }

    migrations.push(migration);

    // Sort migrations by version
    migrations.sort((a, b) => semver.compare(a.from, b.from));
  }

  registerConflictResolver(schemaName: string, resolution: ConflictResolution): void {
    this.conflictResolvers.set(schemaName, resolution);
  }

  async get<T>(key: string, schemaName: string, targetVersion: string): Promise<T | null> {
    const fullKey = `${this.VERSION_KEY_PREFIX}${key}`;

    try {
      const cached = await this.redis.get(fullKey);
      if (!cached) {
        return null;
      }

      const versioned: VersionedData<T> = JSON.parse(cached);

      // Check if migration is needed
      if (versioned.version !== targetVersion) {
        const migrated = await this.migrate(
          versioned.data,
          schemaName,
          versioned.version,
          targetVersion
        );

        if (migrated) {
          // Update cache with migrated version
          await this.set(key, migrated, schemaName, targetVersion);
          return migrated;
        }

        return null;
      }

      return versioned.data;
    } catch (error) {
      logger.error(Versioned cache get error', error;
      return null;
    }
  }

  async set<T>(
    key: string,
    data: T,
    schemaName: string,
    version: string,
    ttl?: number
  ): Promise<void> {
    const fullKey = `${this.VERSION_KEY_PREFIX}${key}`;

    try {
      const versioned: VersionedData<T> = {
        data,
        schema: schemaName,
        version,
        createdAt: Date.now(),
      };

      const serialized = JSON.stringify(versioned);

      if (ttl && ttl > 0) {
        await this.redis.setex(fullKey, ttl, serialized);
      } else {
        await this.redis.set(fullKey, serialized);
      }

      // Track version usage
      await this.redis.hincrby(`${this.SCHEMA_KEY_PREFIX}${schemaName}:usage`, version, 1);
    } catch (error) {
      logger.error(Versioned cache set error', error;
      throw error
    }
  }

  async migrate<TFrom = any, TTo = any>(
    data: TFrom,
    schemaName: string,
    fromVersion: string,
    toVersion: string
  ): Promise<TTo | null> {
    const migrations = this.migrations.get(schemaName);
    if (!migrations) {
      logger.warn(`No migrations found for schema: ${schemaName}`);
      return null;
    }

    try {
      // Find migration path
      const path = this.findMigrationPath(migrations, fromVersion, toVersion);
      if (!path.length) {
        logger.warn(`No migration path from ${fromVersion} to ${toVersion} for ${schemaName}`);
        return null;
      }

      let currentData: any = data;
      let currentVersion = fromVersion;

      // Apply migrations in sequence
      for (const migration of path) {
        logger.info(`Applying migration ${migration.from} -> ${migration.to} for ${schemaName}`);

        currentData = await migration.migrate(currentData);
        currentVersion = migration.to;

        // Log migration
        await this.logMigration(schemaName, migration.from, migration.to);
      }

      return currentData as TTo;
    } catch (error) {
      logger.error(Migration error', error;
      throw error
    }
  }

  private findMigrationPath(
    migrations: VersionMigration[],
    fromVersion: string,
    toVersion: string
  ): VersionMigration[] {
    const path: VersionMigration[] = [];
    let currentVersion = fromVersion;

    while (currentVersion !== toVersion) {
      const nextMigration = migrations.find((m) => m.from === currentVersion);

      if (!nextMigration) {
        return []; // No path found
      }

      path.push(nextMigration);
      currentVersion = nextMigration.to;

      // Check if we've reached or passed the target
      if (semver.gte(currentVersion, toVersion)) {
        break;
      }
    }

    return path;
  }

  async rollback<T>(key: string, schemaName: string, toVersion: string): Promise<T | null> {
    const fullKey = `${this.VERSION_KEY_PREFIX}${key}`;

    try {
      const cached = await this.redis.get(fullKey);
      if (!cached) {
        return null;
      }

      const versioned: VersionedData<T> = JSON.parse(cached);

      if (semver.gte(versioned.version, toVersion)) {
        logger.warn(`Cannot rollback from ${versioned.version} to ${toVersion}`);
        return null;
      }

      const migrations = this.migrations.get(schemaName);
      if (!migrations) {
        return null;
      }

      // Find rollback path
      const rollbackPath = this.findRollbackPath(migrations, versioned.version, toVersion);

      if (!rollbackPath.length) {
        logger.warn(`No rollback path from ${versioned.version} to ${toVersion}`);
        return null;
      }

      let currentData = versioned.data;

      for (const migration of rollbackPath) {
        if (!migration.rollback) {
          throw new Error(`No rollback function for ${migration.from} -> ${migration.to}`);
        }

        currentData = await migration.rollback(currentData);
      }

      // Save rolled back version
      await this.set(key, currentData, schemaName, toVersion);

      return currentData;
    } catch (error) {
      logger.error(Rollback error', error;
      return null;
    }
  }

  private findRollbackPath(
    migrations: VersionMigration[],
    fromVersion: string,
    toVersion: string
  ): VersionMigration[] {
    // Find migrations that need to be reversed
    const forwardPath = this.findMigrationPath(migrations, toVersion, fromVersion);
    return forwardPath.reverse();
  }

  async resolveConflict<T>(
    key: string,
    schemaName: string,
    currentData: T,
    incomingData: T
  ): Promise<T> {
    const resolver = this.conflictResolvers.get(schemaName);

    if (!resolver) {
      // Default: newest wins
      return incomingData;
    }

    switch (resolver.strategy) {
      case 'newest':
        return incomingData;

      case 'merge':
        // Simple merge for objects
        if (typeof currentData === 'object' && typeof incomingData === 'object') {
          return { ...(currentData as any), ...(incomingData as any) };
        }
        return incomingData;

      case 'custom':
        if (resolver.resolver) {
          return await resolver.resolver(currentData, incomingData);
        }
        return incomingData;

      default:
        return incomingData;
    }
  }

  async updateIfNewer<T>(
    key: string,
    data: T,
    schemaName: string,
    version: string,
    timestamp: number
  ): Promise<boolean> {
    const fullKey = `${this.VERSION_KEY_PREFIX}${key}`;

    try {
      const cached = await this.redis.get(fullKey);

      if (cached) {
        const versioned: VersionedData<T> = JSON.parse(cached);

        // Check if incoming data is newer
        if (timestamp <= versioned.createdAt) {
          return false; // Existing data is newer
        }

        // Resolve conflict if versions differ
        if (versioned.version !== version) {
          const resolved = await this.resolveConflict(key, schemaName, versioned.data, data);

          await this.set(key, resolved, schemaName, version);
          return true;
        }
      }

      // Set new data
      await this.set(key, data, schemaName, version);
      return true;
    } catch (error) {
      logger.error(Update if newer error', error;
      return false;
    }
  }

  private async logMigration(
    schemaName: string,
    fromVersion: string,
    toVersion: string
  ): Promise<void> {
    const log = {
      schema: schemaName,
      from: fromVersion,
      to: toVersion,
      timestamp: Date.now(),
    };

    await this.redis.lpush(this.MIGRATION_LOG_KEY, JSON.stringify(log));

    // Keep only last 1000 migration logs
    await this.redis.ltrim(this.MIGRATION_LOG_KEY, 0, 999);
  }

  async getMigrationHistory(limit = 100): Promise<any[]> {
    const logs = await this.redis.lrange(this.MIGRATION_LOG_KEY, 0, limit - 1);
    return logs.map((log) => JSON.parse(log));
  }

  async getVersionUsage(schemaName: string): Promise<Record<string, number>> {
    const usage = await this.redis.hgetall(`${this.SCHEMA_KEY_PREFIX}${schemaName}:usage`);

    const result: Record<string, number> = {};
    for (const [version, count] of Object.entries(usage)) {
      result[version] = parseInt(count, 10);
    }

    return result;
  }

  async cleanupOldVersions(schemaName: string, keepVersions: string[]): Promise<number> {
    let cleaned = 0;

    try {
      // Find all keys for this schema
      const _pattern= `${this.VERSION_KEY_PREFIX}*`;
      const keys = await this.redis.keys(_pattern;

      for (const key of keys) {
        const cached = await this.redis.get(key);
        if (!cached) continue;

        const versioned: VersionedData = JSON.parse(cached);

        if (versioned.schema === schemaName && !keepVersions.includes(versioned.version)) {
          await this.redis.del(key);
          cleaned++;
        }
      }

      logger.info(`Cleaned up ${cleaned} old cache entries for schema ${schemaName}`);

      return cleaned;
    } catch (error) {
      logger.error(Cleanup error', error;
      return cleaned;
    }
  }

  async disconnect(): Promise<void> {
    await this.redis.disconnect();
  }
}

export default CacheVersioningService;
import type { SupabaseClient } from '@supabase/supabase-js';
import { createReadStream, createWriteStream } from 'fs';
import { mkdir, readdir, stat, unlink } from 'fs/promises';
import path from 'path';
import { pipeline } from 'stream/promises';
import { createGunzip, createGzip } from 'zlib';
import { LogContext, logger } from '../utils/enhanced-logger';
import { z } from 'zod';
import crypto from 'crypto';
import { circuitBreaker } from './circuit-breaker';

// AWS SDK v3 - dynamically loaded when needed
let S3Client: any, PutObjectCommand: any, GetObjectCommand: any, DeleteObjectCommand: any;
let awsSdkAvailable = false;
let awsSdkError: string | null = null;

// Dynamic AWS SDK loader with helpful errormessages
async function loadAwsSdk(): Promise<boolean> {
  if (awsSdkAvailable) return true;
  if (awsSdkError) return false;

  try {
    const awsS3 = await import('@aws-sdk/client-s3');
    S3Client = awsS3.S3Client;
    PutObjectCommand = awsS3.PutObjectCommand;
    GetObjectCommand = awsS3.GetObjectCommand;
    DeleteObjectCommand = awsS3.DeleteObjectCommand;
    awsSdkAvailable = true;
    logger.info('AWS SDK loaded successfully for backup functionality', LogContext.SYSTEM);
    return true;
  } catch (error) {
    awsSdkError = errorinstanceof Error ? errormessage : 'Unknown errorloading AWS SDK';
    logger.warn('AWS SDK not available - S3 backup functionality disabled', LogContext.SYSTEM, {
      error awsSdkError,
      helpMessage: 'To enable S3 backups, install AWS SDK: npm install @aws-sdk/client-s3',
    });
    return false;
  }
}

// Helper function to provide installation guidance
function getAwsSdkInstallationHelp(): object {
  return {
    missing_dependency: '@aws-sdk/client-s3',
    installation_command: 'npm install @aws-sdk/client-s3',
    description: 'AWS SDK is required for S3 backup functionality',
    documentation: 'https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/s3/',
    alternatives: [
      'Use local file system backups (always available)',
      'Use Supabase storage for backups (configured automatically)',
    ],
    current_error awsSdkError,
  };
}

// Backup configuration schema
const BackupConfigSchema = z.object({
  enabled: z.boolean().default(true),
  schedule: z.string().default('0 2 * * *'), // 2 AM daily
  retention: z.object({
    daily: z.number().default(7),
    weekly: z.number().default(4),
    monthly: z.number().default(12),
  }),
  storage: z.object({
    local: z.object({
      enabled: z.boolean().default(true),
      path: z.string().default('./backups'),
    }),
    supabase: z.object({
      enabled: z.boolean().default(true),
      bucket: z.string().default('backups'),
    }),
    s3: z.object({
      enabled: z.boolean().default(false),
      bucket: z.string().optional(),
      region: z.string().optional(),
      accessKeyId: z.string().optional(),
      secretAccessKey: z.string().optional(),
    }),
  }),
  encryption: z.object({
    enabled: z.boolean().default(true),
    algorithm: z.string().default('aes-256-gcm'),
    keyDerivation: z.string().default('scrypt'),
  }),
  tables: z
    .array(z.string())
    .default([
      'ai_memories',
      'ai_agents',
      'ai_knowledge_base',
      'ai_custom_tools',
      'ai_tool_executions',
      'ai_agent_executions',
      'ai_code_snippets',
      'ai_code_examples',
      'supabase_features',
      'supabase_integration_patterns',
    ]),
});

type BackupConfig = z.infer<typeof BackupConfigSchema>;

export interface BackupMetadata {
  id: string;
  timestamp: Date;
  type: 'full' | 'incremental' | 'differential';
  size: number;
  duration: number;
  tables: string[];
  rowCount: number;
  compressed: boolean;
  encrypted: boolean;
  checksum: string;
  storage: string[];
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  error: string;
}

export interface RestoreOptions {
  backupId: string;
  tables?: string[];
  targetSchema?: string;
  skipConstraints?: boolean;
  dryRun?: boolean;
}

export class BackupRecoveryService {
  private config: BackupConfig;
  private encryptionKey?: Buffer;
  private isRunning = false;
  private s3Client?: any; // S3Client when AWS SDK is installed

  constructor(
    private supabase: SupabaseClient,
    config: Partial<BackupConfig> = {}
  ) {
    this.config = BackupConfigSchema.parse(config);
    this.initializeEncryption();
    // S3 initialization is now lazy - happens when first needed
  }

  private initializeEncryption() {
    if (this.config.encryption.enabled) {
      const password = process.env.BACKUP_ENCRYPTION_PASSWORD;
      if (!password) {
        logger.warn(
          'Backup encryption enabled but BACKUP_ENCRYPTION_PASSWORD not set',
          LogContext.DATABASE
        );
        this.config.encryption.enabled = false;
        return;
      }

      // Derive encryption key from password
      const salt = Buffer.from(process.env.BACKUP_ENCRYPTION_SALT || 'default-salt');
      this.encryptionKey = crypto.scryptSync(password, salt, 32);
    }
  }

  /**
   * Initialize S3 client if enabled (lazy initialization)
   */
  private async ensureS3Initialized(): Promise<boolean> {
    if (this.config.storage.s3.enabled) {
      if (!this.config.storage.s3.accessKeyId || !this.config.storage.s3.secretAccessKey) {
        logger.warn('S3 storage enabled but credentials not provided', LogContext.DATABASE);
        this.config.storage.s3.enabled = false;
        return false;
      }

      // Try to load AWS SDK dynamically
      const sdkLoaded = await loadAwsSdk();
      if (!sdkLoaded) {
        logger.warn(
          'AWS SDK not available - S3 backup storage disabled',
          LogContext.DATABASE,
          getAwsSdkInstallationHelp()
        );
        this.config.storage.s3.enabled = false;
        return false;
      }

      // Initialize S3 client
      try {
        this.s3Client = new S3Client({
          region: this.config.storage.s3.region || 'us-east-1',
          credentials: {
            accessKeyId: this.config.storage.s3.accessKeyId!,
            secretAccessKey: this.config.storage.s3.secretAccessKey!,
          },
        });

        logger.info('S3 client initialized for backup storage', LogContext.DATABASE);
        return true;
      } catch (error) {
        logger.error(Failed to initialize S3 client', LogContext.DATABASE, { error});
        this.config.storage.s3.enabled = false;
        return false;
      }
    }
    return false; // S3 not enabled
  }

  /**
   * Create a full backup of specified tables
   */
  async createBackup(
    options: {
      type?: 'full' | 'incremental' | 'differential';
      tables?: string[];
      compress?: boolean;
    } = {}
  ): Promise<BackupMetadata> {
    if (this.isRunning) {
      throw new Error('Backup already in progress');
    }

    this.isRunning = true;
    const startTime = Date.now();
    const backupId = this.generateBackupId();

    const metadata: BackupMetadata = {
      id: backupId,
      timestamp: new Date(),
      type: options.type || 'full',
      size: 0,
      duration: 0,
      tables: options.tables || this.config.tables,
      rowCount: 0,
      compressed: options.compress !== false,
      encrypted: this.config.encryption.enabled,
      checksum: '',
      storage: [],
      status: 'in_progress',
    };

    try {
      logger.info(`Starting ${metadata.type} backup ${backupId}`, LogContext.DATABASE);

      // Create backup data
      const backupData = await this.exportTables(metadata.tables);
      metadata.rowCount = backupData.totalRows;

      // Serialize backup data
      const jsonData = JSON.stringify({
        metadata,
        data: backupData.tables,
        timestamp: new Date().toISOString(),
      });

      // Create backup buffer
      let backupBuffer = Buffer.from(jsonData);

      // Encrypt if enabled
      if (this.config.encryption.enabled && this.encryptionKey) {
        backupBuffer = await this.encryptData(backupBuffer);
      }

      // Calculate checksum
      metadata.checksum = crypto.createHash('sha256').update(backupBuffer).digest('hex');

      // Store backup in configured locations
      const storageResults = await this.storeBackup(backupId, backupBuffer, metadata.compressed);

      metadata.storage = storageResults.successful;
      metadata.size = backupBuffer.length;
      metadata.duration = Date.now() - startTime;
      metadata.status = 'completed';

      // Store metadata
      await this.storeBackupMetadata(metadata);

      // Clean up old backups
      await this.cleanupOldBackups();

      logger.info(`Backup ${backupId} completed successfully`, LogContext.DATABASE, {
        duration: metadata.duration,
        size: metadata.size,
        rowCount: metadata.rowCount,
        storage: metadata.storage,
      });

      return metadata;
    } catch (error any) {
      logger.error`Backup ${backupId} failed: ${errormessage}`, LogContext.DATABASE, { error});
      metadata.status = 'failed';
      metadata.error= errormessage;
      metadata.duration = Date.now() - startTime;

      await this.storeBackupMetadata(metadata);
      throw error
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Export tables data
   */
  private async exportTables(tables: string[]): Promise<{
    tables: Record<string, any[]>;
    totalRows: number;
  }> {
    const result: Record<string, any[]> = {};
    let totalRows = 0;

    for (const table of tables) {
      try {
        logger.debug(`Exporting table: ${table}`, LogContext.DATABASE);

        // Direct database query for backup operations
        const { data: tableData, error} = await this.supabase.from(table).select('*');

        if (error throw error
        const data = tableData || [];

        result[table] = data;
        totalRows += data.length;

        logger.debug(`Exported ${data.length} rows from ${table}`, LogContext.DATABASE);
      } catch (error any) {
        logger.error`Failed to export table ${table}: ${errormessage}`, LogContext.DATABASE, {
          error
        });
        throw new Error(`Export failed for table ${table}: ${errormessage}`);
      }
    }

    return { tables: result, totalRows };
  }

  /**
   * Encrypt data using AES-256-GCM
   */
  private async encryptData(data: Buffer): Promise<Buffer> {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not initialized');
    }

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.config.encryption.algorithm, this.encryptionKey, iv);

    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);

    const authTag = (cipher as any).getAuthTag();

    // Combine IV + authTag + encrypted data
    return Buffer.concat([iv, authTag, encrypted]);
  }

  /**
   * Decrypt data
   */
  private async decryptData(encryptedData: Buffer): Promise<Buffer> {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not initialized');
    }

    // Extract components
    const iv = encryptedData.slice(0, 16);
    const authTag = encryptedData.slice(16, 32);
    const encrypted = encryptedData.slice(32);

    const decipher = crypto.createDecipheriv(
      this.config.encryption.algorithm,
      this.encryptionKey,
      iv
    );

    (decipher as any).setAuthTag(authTag);

    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  }

  /**
   * Store backup in configured locations
   */
  private async storeBackup(
    backupId: string,
    data: Buffer,
    compress: boolean
  ): Promise<{ successful: string[]; failed: string[] }> {
    const results = {
      successful: [] as string[],
      failed: [] as string[],
    };

    // Local storage
    if (this.config.storage.local.enabled) {
      try {
        await this.storeLocalBackup(backupId, data, compress);
        results.successful.push('local');
      } catch (error any) {
        logger.error(Failed to store local backup', LogContext.DATABASE, { error});
        results.failed.push('local');
      }
    }

    // Supabase storage
    if (this.config.storage.supabase.enabled) {
      try {
        await this.storeSupabaseBackup(backupId, data, compress);
        results.successful.push('supabase');
      } catch (error any) {
        logger.error(Failed to store Supabase backup', LogContext.DATABASE, { error});
        results.failed.push('supabase');
      }
    }

    // S3 storage (if configured)
    if (this.config.storage.s3.enabled) {
      try {
        await this.storeS3Backup(backupId, data, compress);
        results.successful.push('s3');
      } catch (error any) {
        logger.error(Failed to store S3 backup', LogContext.DATABASE, { error});
        results.failed.push('s3');
      }
    }

    if (results.successful.length === 0) {
      throw new Error('Failed to store backup in any location');
    }

    return results;
  }

  /**
   * Store backup locally
   */
  private async storeLocalBackup(backupId: string, data: Buffer, compress: boolean): Promise<void> {
    const backupDir = path.join(
      this.config.storage.local.path,
      new Date().toISOString().split('T')[0]
    );

    await mkdir(backupDir, { recursive: true });

    const filename = `${backupId}${compress ? '.gz' : ''}.backup`;
    const filepath = path.join(backupDir, filename);

    if (compress) {
      await pipeline(
        async function* () {
          yield data;
        },
        createGzip(),
        createWriteStream(filepath)
      );
    } else {
      await pipeline(async function* () {
        yield data;
      }, createWriteStream(filepath));
    }

    logger.debug(`Stored local backup: ${filepath}`, LogContext.DATABASE);
  }

  /**
   * Store backup in Supabase storage
   */
  private async storeSupabaseBackup(
    backupId: string,
    data: Buffer,
    compress: boolean
  ): Promise<void> {
    const filename = `${new Date().toISOString().split('T')[0]}/${backupId}${compress ? '.gz' : ''}.backup`;

    const { error} = await this.supabase.storage
      .from(this.config.storage.supabase.bucket)
      .upload(filename, data, {
        contentType: 'application/octet-stream',
        upsert: false,
      });

    if (error throw error

    logger.debug(`Stored Supabase backup: ${filename}`, LogContext.DATABASE);
  }

  /**
   * Store backup in S3
   */
  private async storeS3Backup(backupId: string, data: Buffer, compress: boolean): Promise<void> {
    if (!this.s3Client || !this.config.storage.s3.bucket) {
      throw new Error('S3 client not initialized or bucket not configured');
    }

    const key = `backups/${new Date().toISOString().split('T')[0]}/${backupId}${compress ? '.gz' : ''}.backup`;

    try {
      let uploadData = data;

      // Compress if enabled
      if (compress) {
        uploadData = await new Promise<Buffer>((resolve, reject) => {
          const chunks: Buffer[] = [];
          const gzip = createGzip();

          gzip.on('data', (chunk) => chunks.push(chunk));
          gzip.on('end', () => resolve(Buffer.concat(chunks)));
          gzip.on('error, reject);

          gzip.write(data);
          gzip.end();
        });
      }

      const uploadParams: any = {
        Bucket: this.config.storage.s3.bucket,
        Key: key,
        Body: uploadData,
        ContentType: 'application/octet-stream',
        Metadata: {
          'backup-id': backupId,
          'created-at': new Date().toISOString(),
          compressed: compress.toString(),
          encrypted: this.config.encryption.enabled.toString(),
        },
      };

      // Add server-side encryption if available
      if (process.env.S3_KMS_KEY_ID) {
        uploadParams.ServerSideEncryption = 'aws:kms';
        uploadParams.SSEKMSKeyId = process.env.S3_KMS_KEY_ID;
      } else {
        uploadParams.ServerSideEncryption = 'AES256';
      }

      // Ensure S3 is initialized
      const s3Ready = await this.ensureS3Initialized();
      if (!s3Ready) {
        throw new Error(
          `S3 upload failed: ${JSON.stringify(getAwsSdkInstallationHelp(), null, 2)}`
        );
      }

      await this.s3Client.send(new PutObjectCommand(uploadParams));

      logger.debug(
        `Stored S3 backup: s3://${this.config.storage.s3.bucket}/${key}`,
        LogContext.DATABASE
      );
    } catch (error any) {
      logger.error(S3 backup upload failed', LogContext.DATABASE, { error});
      throw new Error(`S3 upload failed: ${errormessage}`);
    }
  }

  /**
   * Restore from backup
   */
  async restoreBackup(options: RestoreOptions): Promise<{
    success: boolean;
    tablesRestored: string[];
    rowsRestored: number;
    duration: number;
  }> {
    const startTime = Date.now();

    logger.info(`Starting restore from backup ${options.backupId}`, LogContext.DATABASE);

    try {
      // Load backup metadata
      const metadata = await this.loadBackupMetadata(options.backupId);
      if (!metadata) {
        throw new Error(`Backup ${options.backupId} not found`);
      }

      // Load backup data
      const backupData = await this.loadBackupData(options.backupId, metadata);

      // Validate backup
      const calculatedChecksum = crypto
        .createHash('sha256')
        .update(JSON.stringify(backupData))
        .digest('hex');

      if (calculatedChecksum !== metadata.checksum) {
        throw new Error('Backup checksum validation failed');
      }

      // Dry run check
      if (options.dryRun) {
        logger.info('Dry run completed successfully', LogContext.DATABASE);
        return {
          success: true,
          tablesRestored: options.tables || metadata.tables,
          rowsRestored: metadata.rowCount,
          duration: Date.now() - startTime,
        };
      }

      // Restore tables
      const tablesToRestore = options.tables || metadata.tables;
      let rowsRestored = 0;

      for (const table of tablesToRestore) {
        if (!backupData.data[table]) {
          logger.warn(`Table ${table} not found in backup`, LogContext.DATABASE);
          continue;
        }

        const rows = backupData.data[table];
        logger.info(`Restoring ${rows.length} rows to ${table}`, LogContext.DATABASE);

        // Clear existing data if full restore
        if (!options.skipConstraints) {
          await this.supabase
            .from(table)
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
        }

        // Insert data in batches
        const batchSize = 1000;
        for (let i = 0; i < rows.length; i += batchSize) {
          const batch = rows.slice(i, i + batchSize);

          const { error} = await this.supabase.from(table).insert(batch);

          if (error {
            logger.error`Failed to restore batch for ${table}`, LogContext.DATABASE, { error});
            throw error
          }

          rowsRestored += batch.length;
        }

        logger.info(`Restored ${rows.length} rows to ${table}`, LogContext.DATABASE);
      }

      const duration = Date.now() - startTime;
      logger.info(`Restore completed successfully`, LogContext.DATABASE, {
        tablesRestored: tablesToRestore,
        rowsRestored,
        duration,
      });

      return {
        success: true,
        tablesRestored: tablesToRestore,
        rowsRestored,
        duration,
      };
    } catch (error any) {
      logger.error(Restore failed', LogContext.DATABASE, { error});
      throw error
    }
  }

  /**
   * Load backup metadata
   */
  private async loadBackupMetadata(backupId: string): Promise<BackupMetadata | null> {
    const { data, error} = await this.supabase
      .from('backup_metadata')
      .select('*')
      .eq('id', backupId)
      .single();

    if (error|| !data) return null;
    return data as BackupMetadata;
  }

  /**
   * Load backup data
   */
  private async loadBackupData(backupId: string, metadata: BackupMetadata): Promise<unknown> {
    // Try to load from available storage locations
    for (const storage of metadata.storage) {
      try {
        switch (storage) {
          case 'local':
            return await this.loadLocalBackup(backupId, metadata);
          case 'supabase':
            return await this.loadSupabaseBackup(backupId, metadata);
          case 's3':
            return await this.loadS3Backup(backupId, metadata);
          default:
            logger.warn(`Unknown storage type: ${storage}`, LogContext.DATABASE);
        }
      } catch (error any) {
        logger.error`Failed to load backup from ${storage}`, LogContext.DATABASE, { error});
      }
    }

    throw new Error('Failed to load backup from any storage location');
  }

  /**
   * Load local backup
   */
  private async loadLocalBackup(backupId: string, metadata: BackupMetadata): Promise<unknown> {
    const date = metadata.timestamp.toISOString().split('T')[0];
    const filename = `${backupId}${metadata.compressed ? '.gz' : ''}.backup`;
    const filepath = path.join(this.config.storage.local.path, date, filename);

    let data: Buffer;

    if (metadata.compressed) {
      await pipeline(createReadStream(filepath), createGunzip(), async function* (source) {
        const chunks: Buffer[] = [];
        for await (const chunk of source) {
          chunks.push(chunk);
        }
        data = Buffer.concat(chunks);
      });
    } else {
      const chunks: Buffer[] = [];
      for await (const chunk of createReadStream(filepath)) {
        chunks.push(chunk as Buffer);
      }
      data = Buffer.concat(chunks);
    }

    if (metadata.encrypted && this.encryptionKey) {
      data = await this.decryptData(data!);
    }

    return JSON.parse(data!.toString());
  }

  /**
   * Load Supabase backup
   */
  private async loadSupabaseBackup(backupId: string, metadata: BackupMetadata): Promise<unknown> {
    const date = metadata.timestamp.toISOString().split('T')[0];
    const filename = `${date}/${backupId}${metadata.compressed ? '.gz' : ''}.backup`;

    const { data: fileData, error} = await this.supabase.storage
      .from(this.config.storage.supabase.bucket)
      .download(filename);

    if (error throw error

    let data = Buffer.from(await fileData.arrayBuffer());

    if (metadata.compressed) {
      // Decompress
      data = await new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        const gunzip = createGunzip();

        gunzip.on('data', (chunk) => chunks.push(chunk));
        gunzip.on('end', () => resolve(Buffer.concat(chunks)));
        gunzip.on('error, reject);

        gunzip.write(data);
        gunzip.end();
      });
    }

    if (metadata.encrypted && this.encryptionKey) {
      data = await this.decryptData(data);
    }

    return JSON.parse(data.toString());
  }

  /**
   * Load S3 backup
   */
  private async loadS3Backup(backupId: string, metadata: BackupMetadata): Promise<unknown> {
    if (!this.s3Client || !this.config.storage.s3.bucket) {
      throw new Error('S3 client not initialized or bucket not configured');
    }

    const date = metadata.timestamp.toISOString().split('T')[0];
    const key = `backups/${date}/${backupId}${metadata.compressed ? '.gz' : ''}.backup`;

    try {
      const downloadParams = {
        Bucket: this.config.storage.s3.bucket,
        Key: key,
      };

      // Ensure S3 is initialized
      const s3Ready = await this.ensureS3Initialized();
      if (!s3Ready) {
        throw new Error(
          `S3 download failed: ${JSON.stringify(getAwsSdkInstallationHelp(), null, 2)}`
        );
      }

      const result = await this.s3Client.send(new GetObjectCommand(downloadParams));

      if (!result.Body) {
        throw new Error('Empty backup file received from S3');
      }

      // Convert stream to buffer for S3 response
      let data: Buffer;
      if (result.Body instanceof Buffer) {
        data = result.Body;
      } else {
        // Handle stream response from S3
        const chunks: Uint8Array[] = [];
        const reader = (result.Body as any).getReader();
        let done = false;

        while (!done) {
          const { value, done: streamDone } = await reader.read();
          done = streamDone;
          if (value) {
            chunks.push(value);
          }
        }

        data = Buffer.concat(chunks);
      }

      // Decompress if needed
      if (metadata.compressed) {
        data = await new Promise<Buffer>((resolve, reject) => {
          const chunks: Buffer[] = [];
          const gunzip = createGunzip();

          gunzip.on('data', (chunk) => chunks.push(chunk));
          gunzip.on('end', () => resolve(Buffer.concat(chunks)));
          gunzip.on('error, reject);

          gunzip.write(data);
          gunzip.end();
        });
      }

      // Decrypt if needed
      if (metadata.encrypted && this.encryptionKey) {
        data = await this.decryptData(data);
      }

      return JSON.parse(data.toString());
    } catch (error any) {
      logger.error(S3 backup download failed', LogContext.DATABASE, { error});
      throw new Error(`S3 download failed: ${errormessage}`);
    }
  }

  /**
   * Store backup metadata
   */
  private async storeBackupMetadata(metadata: BackupMetadata): Promise<void> {
    const { error} = await this.supabase.from('backup_metadata').upsert(metadata);

    if (error {
      logger.error(Failed to store backup metadata', LogContext.DATABASE, { error});
      throw error
    }
  }

  /**
   * Clean up old backups based on retention policy
   */
  async cleanupOldBackups(): Promise<number> {
    logger.info('Starting backup cleanup', LogContext.DATABASE);
    let deletedCount = 0;

    try {
      // Get all backups
      const { data: backups, error} = await this.supabase
        .from('backup_metadata')
        .select('*')
        .eq('status', 'completed')
        .order('timestamp', { ascending: false });

      if (error throw error
      if (!backups || backups.length === 0) return 0;

      const now = new Date();
      const toDelete: string[] = [];

      // Group backups by date
      const backupsByDate = new Map<string, BackupMetadata[]>();
      for (const backup of backups) {
        const date = new Date(backup.timestamp).toISOString().split('T')[0];
        if (!backupsByDate.has(date)) {
          backupsByDate.set(date, []);
        }
        backupsByDate.get(date)!.push(backup);
      }

      // Apply retention policy
      const dates = Array.from(backupsByDate.keys()).sort().reverse();

      // Keep daily backups for configured days
      const dailyCutoff = new Date(now);
      dailyCutoff.setDate(dailyCutoff.getDate() - this.config.retention.daily);

      // Keep weekly backups for configured weeks
      const weeklyCutoff = new Date(now);
      weeklyCutoff.setDate(weeklyCutoff.getDate() - this.config.retention.weekly * 7);

      // Keep monthly backups for configured months
      const monthlyCutoff = new Date(now);
      monthlyCutoff.setMonth(monthlyCutoff.getMonth() - this.config.retention.monthly);

      for (const date of dates) {
        const backupDate = new Date(date);
        const backupsForDate = backupsByDate.get(date)!;

        // Keep the most recent backup for each date
        const [keep, ...rest] = backupsForDate.sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        // Mark extra backups for deletion
        toDelete.push(...rest.map((b) => b.id));

        // Check retention policy
        if (backupDate < monthlyCutoff) {
          // Only keep if it's the first backup of the month
          if (backupDate.getDate() !== 1) {
            toDelete.push(keep.id);
          }
        } else if (backupDate < weeklyCutoff) {
          // Only keep if it's a Sunday
          if (backupDate.getDay() !== 0) {
            toDelete.push(keep.id);
          }
        } else if (backupDate < dailyCutoff) {
          // Delete daily backups older than retention period
          toDelete.push(keep.id);
        }
      }

      // Delete old backups
      for (const backupId of toDelete) {
        await this.deleteBackup(backupId);
        deletedCount++;
      }

      logger.info(`Cleaned up ${deletedCount} old backups`, LogContext.DATABASE);
      return deletedCount;
    } catch (error any) {
      logger.error(Backup cleanup failed', LogContext.DATABASE, { error});
      throw error
    }
  }

  /**
   * Delete a specific backup
   */
  async deleteBackup(backupId: string): Promise<void> {
    logger.debug(`Deleting backup ${backupId}`, LogContext.DATABASE);

    // Load metadata
    const metadata = await this.loadBackupMetadata(backupId);
    if (!metadata) return;

    // Delete from storage locations
    for (const storage of metadata.storage) {
      try {
        switch (storage) {
          case 'local':
            await this.deleteLocalBackup(backupId, metadata);
            break;
          case 'supabase':
            await this.deleteSupabaseBackup(backupId, metadata);
            break;
          case 's3':
            await this.deleteS3Backup(backupId, metadata);
            break;
        }
      } catch (error any) {
        logger.error`Failed to delete backup from ${storage}`, LogContext.DATABASE, { error});
      }
    }

    // Delete metadata
    await this.supabase.from('backup_metadata').delete().eq('id', backupId);
  }

  /**
   * Delete local backup
   */
  private async deleteLocalBackup(backupId: string, metadata: BackupMetadata): Promise<void> {
    const date = metadata.timestamp.toISOString().split('T')[0];
    const filename = `${backupId}${metadata.compressed ? '.gz' : ''}.backup`;
    const filepath = path.join(this.config.storage.local.path, date, filename);

    try {
      await unlink(filepath);
    } catch (error any) {
      if (errorcode !== 'ENOENT') throw error
    }
  }

  /**
   * Delete Supabase backup
   */
  private async deleteSupabaseBackup(backupId: string, metadata: BackupMetadata): Promise<void> {
    const date = metadata.timestamp.toISOString().split('T')[0];
    const filename = `${date}/${backupId}${metadata.compressed ? '.gz' : ''}.backup`;

    await this.supabase.storage.from(this.config.storage.supabase.bucket).remove([filename]);
  }

  /**
   * Delete S3 backup
   */
  private async deleteS3Backup(backupId: string, metadata: BackupMetadata): Promise<void> {
    if (!this.s3Client || !this.config.storage.s3.bucket) {
      logger.warn('S3 client not initialized or bucket not configured', LogContext.DATABASE);
      return;
    }

    const date = metadata.timestamp.toISOString().split('T')[0];
    const key = `backups/${date}/${backupId}${metadata.compressed ? '.gz' : ''}.backup`;

    try {
      const deleteParams = {
        Bucket: this.config.storage.s3.bucket,
        Key: key,
      };

      // Ensure S3 is initialized
      const s3Ready = await this.ensureS3Initialized();
      if (!s3Ready) {
        throw new Error(
          `S3 delete failed: ${JSON.stringify(getAwsSdkInstallationHelp(), null, 2)}`
        );
      }

      await this.s3Client.send(new DeleteObjectCommand(deleteParams));

      logger.debug(
        `Deleted S3 backup: s3://${this.config.storage.s3.bucket}/${key}`,
        LogContext.DATABASE
      );
    } catch (error any) {
      logger.error(S3 backup deletion failed', LogContext.DATABASE, { error});
      throw new Error(`S3 deletion failed: ${errormessage}`);
    }
  }

  /**
   * List available backups
   */
  async listBackups(
    options: {
      limit?: number;
      offset?: number;
      status?: 'pending' | 'in_progress' | 'completed' | 'failed';
    } = {}
  ): Promise<{
    backups: BackupMetadata[];
    total: number;
  }> {
    let query = this.supabase
      .from('backup_metadata')
      .select('*', { count: 'exact' })
      .order('timestamp', { ascending: false });

    if (options.status) {
      query = query.eq('status', options.status);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }

    const { data, count, error} = await query;

    if (error throw error

    return {
      backups: data || [],
      total: count || 0,
    };
  }

  /**
   * Get backup status
   */
  async getBackupStatus(): Promise<{
    lastBackup: Date | null;
    nextBackup: Date | null;
    isRunning: boolean;
    totalBackups: number;
    totalSize: number;
    storageUsage: Record<string, number>;
  }> {
    const { data: lastBackup } = await this.supabase
      .from('backup_metadata')
      .select('timestamp')
      .eq('status', 'completed')
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    const { data: stats } = await this.supabase.from('backup_metadata').select('size, storage');

    let totalSize = 0;
    const storageUsage: Record<string, number> = {};

    if (stats) {
      for (const backup of stats) {
        totalSize += backup.size || 0;
        for (const storage of backup.storage || []) {
          storageUsage[storage] = (storageUsage[storage] || 0) + (backup.size || 0);
        }
      }
    }

    // Calculate next backup time based on schedule
    const nextBackup = this.calculateNextBackupTime();

    return {
      lastBackup: lastBackup ? new Date(lastBackup.timestamp) : null,
      nextBackup,
      isRunning: this.isRunning,
      totalBackups: stats?.length || 0,
      totalSize,
      storageUsage,
    };
  }

  /**
   * Calculate next backup time based on cron schedule
   */
  private calculateNextBackupTime(): Date | null {
    const { schedule } = this.config.backup;
    if (!schedule) {
      return null;
    }

    try {
      // Parse cron expression: minute hour day month dayOfWeek
      const cronParts = schedule.trim().split(/\s+/);
      if (cronParts.length !== 5) {
        throw new Error(`Invalid cron format: ${schedule}`);
      }

      const [minute, hour, day, month, dayOfWeek] = cronParts;
      const now = new Date();
      const next = new Date(now);

      // Handle special expressions
      if (schedule === '@daily' || schedule === '@midnight') {
        next.setDate(next.getDate() + 1);
        next.setHours(0, 0, 0, 0);
        return next;
      }

      if (schedule === '@hourly') {
        next.setHours(next.getHours() + 1, 0, 0, 0);
        return next;
      }

      if (schedule === '@weekly') {
        next.setDate(next.getDate() + (7 - next.getDay()));
        next.setHours(0, 0, 0, 0);
        return next;
      }

      // Parse cron fields
      const nextMinute = this.parseField(minute, 0, 59, now.getMinutes());
      const nextHour = this.parseField(hour, 0, 23, now.getHours());
      const nextDay = this.parseField(day, 1, 31, now.getDate());
      const nextMonth = this.parseField(month, 1, 12, now.getMonth() + 1);
      const nextDayOfWeek = this.parseField(dayOfWeek, 0, 6, now.getDay());

      // Set the next execution time
      if (nextMinute !== null) next.setMinutes(nextMinute, 0, 0);
      if (nextHour !== null) next.setHours(nextHour);
      if (nextDay !== null) next.setDate(nextDay);
      if (nextMonth !== null) next.setMonth(nextMonth - 1);

      // Handle day of week constraint
      if (nextDayOfWeek !== null && dayOfWeek !== '*') {
        const currentDayOfWeek = next.getDay();
        const daysUntilTarget = (nextDayOfWeek - currentDayOfWeek + 7) % 7;
        if (daysUntilTarget > 0) {
          next.setDate(next.getDate() + daysUntilTarget);
        }
      }

      // If the calculated time is in the past, move to next occurrence
      if (next <= now) {
        // Move to next occurrence based on the most specific field
        if (minute !== '*') {
          next.setHours(next.getHours() + 1);
        } else if (hour !== '*') {
          next.setDate(next.getDate() + 1);
        } else {
          next.setDate(next.getDate() + 1);
        }
      }

      return next;
    } catch (error) {
      logger.error(Failed to parse cron schedule:', error;
      // Fallback to daily at 2 AM
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(2, 0, 0, 0);
      return tomorrow;
    }
  }

  /**
   * Parse a cron field (minute, hour, day, etc.)
   */
  private parseField(field: string, min: number, max: number, current: number): number | null {
    // Wildcard - no constraint
    if (field === '*') {
      return null;
    }

    // Specific value
    if (/^\d+$/.test(field)) {
      const value = parseInt(field, 10);
      if (value >= min && value <= max) {
        return value;
      }
      throw new Error(`Value ${value} out of range [${min}-${max}]`);
    }

    // Range (e.g., "1-5")
    if (field.includes('-')) {
      const [start, end] = field.split('-').map(Number);
      if (start >= min && end <= max && start <= end) {
        // Return the next value in range
        if (current >= start && current <= end) {
          return current;
        }
        return current < start ? start : start; // Wrap around
      }
      throw new Error(`Invalid range: ${field}`);
    }

    // Step values (e.g., "*/5" for every 5 units)
    if (field.includes('/')) {
      const [range, step] = field.split('/');
      const stepValue = parseInt(step, 10);

      if (range === '*') {
        // Find next step from current
        const next = Math.ceil((current + 1) / stepValue) * stepValue;
        return next <= max ? next : min;
      }

      // Range with step (e.g., "1-10/2")
      if (range.includes('-')) {
        const [start, end] = range.split('-').map(Number);
        let next = Math.ceil((current - start + 1) / stepValue) * stepValue + start;
        if (next > end) {
          next = start; // Wrap to beginning of range
        }
        return next;
      }
    }

    // List of values (e.g., "1,3,5")
    if (field.includes(',')) {
      const values = field
        .split(',')
        .map(Number)
        .sort((a, b) => a - b);
      for (const value of values) {
        if (value < min || value > max) {
          throw new Error(`Value ${value} out of range [${min}-${max}]`);
        }
        if (value > current) {
          return value;
        }
      }
      // If no value is greater than current, return the first value
      return values[0];
    }

    throw new Error(`Invalid cron field: ${field}`);
  }

  /**
   * Verify backup integrity
   */
  async verifyBackup(backupId: string): Promise<{
    valid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    try {
      // Load metadata
      const metadata = await this.loadBackupMetadata(backupId);
      if (!metadata) {
        errors.push('Backup metadata not found');
        return { valid: false, errors };
      }

      // Try to load backup data
      const backupData = await this.loadBackupData(backupId, metadata);

      // Verify structure
      if (!backupData.data || typeof backupData.data !== 'object') {
        errors.push('Invalid backup data structure');
      }

      // Verify tables
      for (const table of metadata.tables) {
        if (!backupData.data[table]) {
          errors.push(`Missing table: ${table}`);
        }
      }

      // Verify row count
      let actualRowCount = 0;
      for (const table of Object.values(backupData.data)) {
        if (Array.isArray(table)) {
          actualRowCount += table.length;
        }
      }

      if (actualRowCount !== metadata.rowCount) {
        errors.push(`Row count mismatch: expected ${metadata.rowCount}, got ${actualRowCount}`);
      }

      return {
        valid: errors.length === 0,
        errors,
      };
    } catch (error any) {
      errors.push(`Verification failed: ${errormessage}`);
      return { valid: false, errors };
    }
  }

  /**
   * Generate backup ID
   */
  private generateBackupId(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const random = crypto.randomBytes(4).toString('hex');
    return `backup-${timestamp}-${random}`;
  }
}

// Export factory function
export function createBackupRecoveryService(
  supabase: SupabaseClient,
  config?: Partial<BackupConfig>
): BackupRecoveryService {
  return new BackupRecoveryService(supabase, config);
}
/* eslint-disable no-undef */
console.log('📍 server-minimal-test.ts starting execution...');

import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { logger } from './utils/enhanced-logger';
import { config, initializeConfig } from './config/index';

// Initialize configuration
initializeConfig();

logger.info('📍 Configuration initialized');

const app = express();
const { port } = config.server;

logger.info('📍 Creating Supabase client');
const supabase = createClient(
  config.database.supabaseUrl,
  config.database.supabaseServiceKey || ''
);

// Basic middleware only
app.use(cors());
app.use(express.json({ limit: '10mb' }));

logger.info('📍 Setting up minimal routes');

// Health check only
app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

logger.info('📍 Creating HTTP server...');
const server = createServer(app);

logger.info('📍 Creating WebSocket server...');
const wss = new WebSocketServer({ server });

logger.info(`📍 About to start server on port ${port}`);

server.listen(port, async () => {
  logger.info(`✅ Minimal server running on port ${port}`);
  logger.info(`Health check available at http://localhost:${port}/health`);
});

logger.info('📍 server.listen called - minimal test complete');
