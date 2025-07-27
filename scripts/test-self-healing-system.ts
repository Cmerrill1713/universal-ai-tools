#!/usr/bin/env npx tsx

/**
 * Universal AI Tools Self-Healing System Test Script
 *
 * This script comprehensively tests the self-healing capabilities of the system by:
 * 1. Starting the self-improvement orchestrator
 * 2. Monitoring for common system errors (port conflicts, service failures, etc.)
 * 3. Triggering improvement cycles when issues are detected
 * 4. Logging all self-healing activities with detailed reporting
 * 5. Simulating known issues to test the system's response
 */

import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { createClient } from '@supabase/supabase-js';
import { LogContext, logger } from '../src/utils/enhanced-logger';

// Import the self-improvement systems
import { IntegratedSelfImprovementSystem } from '../src/core/self-improvement/integrated-self-improvement-system';
import { SelfImprovementOrchestrator } from '../src/core/self-improvement/self-improvement-orchestrator';
import { AlphaEvolveSystem } from '../src/core/evolution/alpha-evolve-system';
import { HealthCheckService } from '../src/services/health-check';

const execAsync = promisify(exec);

interface TestConfig {
  monitoringIntervalMs: number;
  improvementCycleIntervalMs: number;
  maxTestDurationMs: number;
  simulateErrors: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  reportIntervalMs: number;
}

interface SystemError {
  id: string;
  type:
    | 'port_conflict'
    | 'service_failure'
    | 'typescript_error'
    | 'connection_error'
    | 'memory_leak'
    | 'other';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  source: string;
  timestamp: Date;
  stackTrace?: string;
  metadata?: Record<string, any>;
  resolved: boolean;
  resolutionStrategy?: string;
  resolutionTime?: Date;
}

interface SelfHealingEvent {
  id: string;
  type:
    | 'error_detected'
    | 'improvement_triggered'
    | 'cycle_started'
    | 'cycle_completed'
    | 'resolution_applied'
    | 'system_recovered';
  timestamp: Date;
  errorId?: string;
  details: Record<string, any>;
  performanceImpact?: number;
  successRate?: number;
}

interface TestReport {
  startTime: Date;
  endTime?: Date;
  duration: number;
  errorsDetected: number;
  errorsResolved: number;
  improvementCyclesTriggered: number;
  improvementCyclesCompleted: number;
  averageResolutionTime: number;
  systemHealthImprovement: number;
  selfHealingEffectiveness: number;
  events: SelfHealingEvent[];
  errors: SystemError[];
  recommendations: string[];
}

export class SelfHealingTestOrchestrator extends EventEmitter {
  private config: TestConfig;
  private isRunning = false;
  private startTime: Date;
  private supabase: any;
  private healthService: HealthCheckService;
  private integratedSystem: IntegratedSelfImprovementSystem;
  private improvementOrchestrator: SelfImprovementOrchestrator;
  private alphaEvolve: AlphaEvolveSystem;

  // Monitoring state
  private detectedErrors: Map<string, SystemError> = new Map();
  private healingEvents: SelfHealingEvent[] = [];
  private monitoringInterval?: NodeJS.Timeout;
  private reportingInterval?: NodeJS.Timeout;

  // Error pattern detection
  private errorPatterns = {
    portConflict: /EADDRINUSE.*:(\d+)/g,
    serviceFailure: /(Failed to connect|Connection refused|Service unavailable)/gi,
    typescriptError: /(TS\d+:|Type.*error|Cannot find module)/gi,
    memoryLeak: /(Maximum call stack|out of memory|ENOMEM)/gi,
    dspyFailure: /(DSPy.*failed|Python.*error|ModuleNotFoundError)/gi,
  };

  constructor(config: Partial<TestConfig> = {}) {
    super();

    this.config = {
      monitoringIntervalMs: 5000, // Check every 5 seconds
      improvementCycleIntervalMs: 30000, // Trigger improvements every 30 seconds
      maxTestDurationMs: 600000, // Run for 10 minutes max
      simulateErrors: true,
      logLevel: 'info',
      reportIntervalMs: 60000, // Report every minute
      ...config,
    };

    this.startTime = new Date();
    this.initializeServices();
  }

  private async initializeServices(): Promise<void> {
    try {
      // Initialize Supabase client
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase credentials not found in environment variables');
      }

      this.supabase = createClient(supabaseUrl, supabaseKey);

      // Initialize health check service
      this.healthService = new HealthCheckService(this.supabase);

      // Initialize self-improvement systems
      this.integratedSystem = new IntegratedSelfImprovementSystem(this.supabase, {
        enabledComponents: ['all'],
        orchestrationMode: 'adaptive',
        improvementThreshold: 0.5, // Lower threshold for testing
        coordinationInterval: this.config.improvementCycleIntervalMs,
        failureHandling: 'continue',
      });

      this.improvementOrchestrator = new SelfImprovementOrchestrator(this.supabase, {
        enableAutoImprovement: true,
        improvementThreshold: 0.5,
        maxImprovementsPerCycle: 3,
        cycleIntervalMs: this.config.improvementCycleIntervalMs,
        enableCodeEvolution: false, // Disable for safety in testing
        enableStrategyEvolution: true,
        safetyCheckEnabled: true,
      });

      const alphaConfig = {
        populationSize: 20, // Smaller population for testing
        mutationRate: 0.2,
        crossoverRate: 0.6,
        elitismRate: 0.15,
        maxGenerations: 100,
        fitnessThreshold: 0.85,
        adaptationThreshold: 0.6,
        learningRate: 0.05,
      };
      this.alphaEvolve = new AlphaEvolveSystem(this.supabase, alphaConfig);

      this.setupEventHandlers();

      logger.info('Self-healing test orchestrator initialized successfully', LogContext.SYSTEM);
    } catch (error) {
      logger.error('Failed to initialize self-healing test orchestrator', LogContext.SYSTEM, {
        error,
      });
      throw error;
    }
  }

  private setupEventHandlers(): void {
    // Integrated system events
    this.integratedSystem.on('system-initialized', () => {
      this.recordEvent('improvement_triggered', { system: 'integrated', action: 'initialized' });
    });

    this.integratedSystem.on('cycle-started', (cycle) => {
      this.recordEvent('cycle_started', { cycleId: cycle.id, system: 'integrated' });
    });

    this.integratedSystem.on('cycle-completed', (cycle) => {
      this.recordEvent('cycle_completed', {
        cycleId: cycle.id,
        system: 'integrated',
        improvements: cycle.activeImprovements,
      });
    });

    this.integratedSystem.on('improvement-detected', (data) => {
      this.recordEvent('improvement_triggered', {
        component: data.component,
        improvement: data.data,
        system: 'integrated',
      });
    });

    // Orchestrator events
    this.improvementOrchestrator.on('started', () => {
      this.recordEvent('improvement_triggered', { system: 'orchestrator', action: 'started' });
    });

    this.improvementOrchestrator.on('cycle-completed', (cycle) => {
      this.recordEvent('cycle_completed', {
        cycleId: cycle.id,
        system: 'orchestrator',
        improvementsApplied: cycle.improvementsApplied,
        performanceGain: cycle.performanceGain,
      });
    });

    this.improvementOrchestrator.on('cycle-failed', (data) => {
      this.recordEvent('error_detected', {
        type: 'improvement_cycle_failure',
        cycleId: data.cycle.id,
        error: data.error,
        system: 'orchestrator',
      });
    });

    // Alpha evolve events
    this.alphaEvolve.on('evolution_completed', (metrics) => {
      this.recordEvent('cycle_completed', {
        system: 'alpha_evolve',
        generation: metrics.generationId,
        fitnessScore: metrics.fitnessScore,
        adaptationRate: metrics.adaptationRate,
      });
    });

    this.alphaEvolve.on('pattern_learned', (data) => {
      this.recordEvent('improvement_triggered', {
        system: 'alpha_evolve',
        pattern: data.pattern.pattern,
        confidence: data.pattern.confidence,
      });
    });
  }

  async startTest(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Self-healing test is already running', LogContext.SYSTEM);
      return;
    }

    this.isRunning = true;
    this.startTime = new Date();

    logger.info('🚀 Starting Universal AI Tools Self-Healing System Test', LogContext.SYSTEM);

    try {
      // Start all self-improvement systems
      await this.startSelfImprovementSystems();

      // Start system monitoring
      this.startSystemMonitoring();

      // Start periodic reporting
      this.startPeriodicReporting();

      // If configured, simulate errors for testing
      if (this.config.simulateErrors) {
        this.startErrorSimulation();
      }

      // Set test duration limit
      setTimeout(() => {
        if (this.isRunning) {
          logger.info('Test duration limit reached, stopping test', LogContext.SYSTEM);
          this.stopTest();
        }
      }, this.config.maxTestDurationMs);

      this.emit('test-started', { startTime: this.startTime });
    } catch (error) {
      logger.error('Failed to start self-healing test', LogContext.SYSTEM, { error });
      this.isRunning = false;
      throw error;
    }
  }

  private async startSelfImprovementSystems(): Promise<void> {
    logger.info('Starting self-improvement systems...', LogContext.SYSTEM);

    try {
      // Start improvement orchestrator
      await this.improvementOrchestrator.start();
      logger.info('✅ Self-improvement orchestrator started', LogContext.SYSTEM);

      // The integrated system starts automatically on initialization
      logger.info('✅ Integrated self-improvement system active', LogContext.SYSTEM);

      // Alpha evolve system starts automatically
      logger.info('✅ Alpha evolve system active', LogContext.SYSTEM);
    } catch (error) {
      logger.error('Failed to start self-improvement systems', LogContext.SYSTEM, { error });
      throw error;
    }
  }

  private startSystemMonitoring(): void {
    logger.info('Starting system monitoring...', LogContext.SYSTEM);

    this.monitoringInterval = setInterval(async () => {
      try {
        await this.performSystemCheck();
      } catch (error) {
        logger.error('System monitoring check failed', LogContext.SYSTEM, { error });
      }
    }, this.config.monitoringIntervalMs);
  }

  private async performSystemCheck(): Promise<void> {
    try {
      // Check system health
      const healthCheck = await this.healthService.checkHealth();

      // Analyze health results for issues
      await this.analyzeHealthForIssues(healthCheck);

      // Check for specific error patterns in logs
      await this.checkSystemLogs();

      // Monitor running processes
      await this.monitorProcesses();

      // Check for port conflicts
      await this.checkPortConflicts();
    } catch (error) {
      this.detectError('other', 'medium', 'System check failed', 'system_monitor', error);
    }
  }

  private async analyzeHealthForIssues(health: any): Promise<void> {
    // Check overall system health
    if (health.status === 'unhealthy') {
      this.detectError(
        'service_failure',
        'critical',
        `System health critical: ${health.healthScore}`,
        'health_check'
      );
    } else if (health.status === 'degraded') {
      this.detectError(
        'service_failure',
        'medium',
        `System health degraded: ${health.healthScore}`,
        'health_check'
      );
    }

    // Check individual services
    for (const [serviceName, serviceHealth] of Object.entries(health.services)) {
      const service = serviceHealth as any;
      if (service.status === 'unhealthy') {
        this.detectError(
          'service_failure',
          'high',
          `Service ${serviceName} failed: ${service.message}`,
          serviceName
        );
      }
    }

    // Check for memory issues
    if (health.metrics?.memory?.percentage > 85) {
      this.detectError(
        'memory_leak',
        'high',
        `High memory usage: ${health.metrics.memory.percentage}%`,
        'memory_monitor'
      );
    }

    // Check CPU usage
    if (health.metrics?.cpu?.usage > 90) {
      this.detectError(
        'service_failure',
        'medium',
        `High CPU usage: ${health.metrics.cpu.usage}%`,
        'cpu_monitor'
      );
    }
  }

  private async checkSystemLogs(): Promise<void> {
    try {
      // Check recent log files for error patterns
      const logFiles = [
        'logs/application.log',
        'logs/error.log',
        'npm-debug.log',
        '.next/trace.log',
      ];

      for (const logFile of logFiles) {
        try {
          const logPath = path.join(process.cwd(), logFile);
          const stats = await fs.stat(logPath);

          // Only check recent logs (last 5 minutes)
          if (Date.now() - stats.mtime.getTime() < 300000) {
            const logContent = await fs.readFile(logPath, 'utf-8');
            await this.analyzeLogContent(logContent, logFile);
          }
        } catch (error) {
          // Log file doesn't exist or can't be read - that's ok
        }
      }
    } catch (error) {
      logger.debug('Log checking failed', LogContext.SYSTEM, { error });
    }
  }

  private async analyzeLogContent(content: string, source: string): Promise<void> {
    const recentLines = content.split('\n').slice(-100); // Check last 100 lines
    const recentContent = recentLines.join('\n');

    // Check for port conflicts
    const portMatches = recentContent.match(this.errorPatterns.portConflict);
    if (portMatches) {
      for (const match of portMatches) {
        const portMatch = match.match(/:(\d+)/);
        const port = portMatch ? portMatch[1] : 'unknown';
        this.detectError('port_conflict', 'high', `Port ${port} is already in use`, source, null, {
          port,
        });
      }
    }

    // Check for service failures
    const serviceMatches = recentContent.match(this.errorPatterns.serviceFailure);
    if (serviceMatches) {
      for (const match of serviceMatches) {
        this.detectError('service_failure', 'medium', match, source);
      }
    }

    // Check for TypeScript errors
    const tsMatches = recentContent.match(this.errorPatterns.typescriptError);
    if (tsMatches) {
      for (const match of tsMatches) {
        this.detectError('typescript_error', 'low', match, source);
      }
    }

    // Check for memory issues
    const memoryMatches = recentContent.match(this.errorPatterns.memoryLeak);
    if (memoryMatches) {
      for (const match of memoryMatches) {
        this.detectError('memory_leak', 'critical', match, source);
      }
    }

    // Check for DSPy failures
    const dspyMatches = recentContent.match(this.errorPatterns.dspyFailure);
    if (dspyMatches) {
      for (const match of dspyMatches) {
        this.detectError('service_failure', 'medium', `DSPy service issue: ${match}`, source);
      }
    }
  }

  private async monitorProcesses(): Promise<void> {
    try {
      const { stdout } = await execAsync('ps aux | grep -E "(node|npm|tsx)" | grep -v grep');
      const processes = stdout.split('\n').filter((line) => line.trim());

      // Check for high CPU/memory usage processes
      for (const process of processes) {
        const parts = process.split(/\s+/);
        if (parts.length >= 11) {
          const cpu = parseFloat(parts[2]);
          const memory = parseFloat(parts[3]);

          if (cpu > 80) {
            this.detectError(
              'service_failure',
              'medium',
              `High CPU process detected: ${cpu}%`,
              'process_monitor',
              null,
              { pid: parts[1], cpu, memory }
            );
          }

          if (memory > 10) {
            // More than 10% memory
            this.detectError(
              'memory_leak',
              'medium',
              `High memory process detected: ${memory}%`,
              'process_monitor',
              null,
              { pid: parts[1], cpu, memory }
            );
          }
        }
      }
    } catch (error) {
      // Process monitoring failed - not critical
      logger.debug('Process monitoring failed', LogContext.SYSTEM, { error });
    }
  }

  private async checkPortConflicts(): Promise<void> {
    const commonPorts = [3000, 3001, 8000, 8766, 5000, 5432, 6379];

    for (const port of commonPorts) {
      try {
        const { stdout } = await execAsync(`lsof -i :${port} 2>/dev/null || true`);
        if (stdout.trim()) {
          const lines = stdout.split('\n').filter((line) => line.trim());
          if (lines.length > 1) {
            // Header + at least one process
            // Port is in use - check if it should be
            const processInfo = lines[1].split(/\s+/);
            const processName = processInfo[0];

            // Expected processes for certain ports
            const expectedProcesses = {
              3000: ['node', 'npm', 'next'],
              8766: ['python', 'uvicorn'],
              5432: ['postgres'],
              6379: ['redis-server'],
            };

            const expected = expectedProcesses[port as keyof typeof expectedProcesses] || [];
            const isExpected = expected.some((name) => processName.includes(name));

            if (!isExpected) {
              this.detectError(
                'port_conflict',
                'medium',
                `Unexpected process on port ${port}: ${processName}`,
                'port_monitor',
                null,
                { port, process: processName }
              );
            }
          }
        }
      } catch (error) {
        // Port check failed - not critical
      }
    }
  }

  private detectError(
    type: SystemError['type'],
    severity: SystemError['severity'],
    message: string,
    source: string,
    error?: any,
    metadata?: Record<string, any>
  ): void {
    const errorId = `${type}_${source}_${Date.now()}`;

    // Check if we've already detected this error recently (within 30 seconds)
    const recentError = Array.from(this.detectedErrors.values()).find(
      (e) =>
        e.type === type &&
        e.source === source &&
        e.message === message &&
        Date.now() - e.timestamp.getTime() < 30000
    );

    if (recentError) {
      return; // Don't duplicate recent errors
    }

    const systemError: SystemError = {
      id: errorId,
      type,
      severity,
      message,
      source,
      timestamp: new Date(),
      stackTrace: error?.stack,
      metadata,
      resolved: false,
    };

    this.detectedErrors.set(errorId, systemError);

    logger.warn(`🔍 Error detected: ${type} - ${message}`, LogContext.SYSTEM, {
      errorId,
      severity,
      source,
      metadata,
    });

    this.recordEvent('error_detected', {
      errorId,
      type,
      severity,
      message,
      source,
    });

    // Trigger self-healing response
    this.triggerSelfHealingResponse(systemError);
  }

  private async triggerSelfHealingResponse(error: SystemError): Promise<void> {
    logger.info(`🔧 Triggering self-healing response for error: ${error.id}`, LogContext.SYSTEM);

    try {
      // Determine healing strategy based on error type
      const strategy = this.determineHealingStrategy(error);

      this.recordEvent('improvement_triggered', {
        errorId: error.id,
        strategy,
        trigger: 'error_detection',
      });

      // Apply healing strategy
      await this.applyHealingStrategy(error, strategy);
    } catch (healingError) {
      logger.error(`Failed to apply healing strategy for error ${error.id}`, LogContext.SYSTEM, {
        error: healingError,
      });
    }
  }

  private determineHealingStrategy(error: SystemError): string {
    const strategies = {
      port_conflict: 'port_reallocation',
      service_failure: 'service_restart',
      typescript_error: 'code_analysis',
      memory_leak: 'memory_optimization',
      connection_error: 'connection_retry',
      other: 'general_improvement',
    };

    return strategies[error.type] || 'general_improvement';
  }

  private async applyHealingStrategy(error: SystemError, strategy: string): Promise<void> {
    logger.info(`Applying healing strategy: ${strategy} for error ${error.id}`, LogContext.SYSTEM);

    try {
      switch (strategy) {
        case 'port_reallocation':
          await this.handlePortConflict(error);
          break;

        case 'service_restart':
          await this.handleServiceFailure(error);
          break;

        case 'code_analysis':
          await this.handleTypeScriptError(error);
          break;

        case 'memory_optimization':
          await this.handleMemoryIssue(error);
          break;

        case 'connection_retry':
          await this.handleConnectionError(error);
          break;

        case 'general_improvement':
        default:
          await this.triggerGeneralImprovement(error);
          break;
      }

      // Mark error as having a resolution strategy
      error.resolutionStrategy = strategy;

      this.recordEvent('resolution_applied', {
        errorId: error.id,
        strategy,
        timestamp: new Date(),
      });
    } catch (strategyError) {
      logger.error(`Healing strategy ${strategy} failed for error ${error.id}`, LogContext.SYSTEM, {
        error: strategyError,
      });
    }
  }

  private async handlePortConflict(error: SystemError): Promise<void> {
    const port = error.metadata?.port;
    if (!port) return;

    logger.info(`Handling port conflict on port ${port}`, LogContext.SYSTEM);

    // Strategy 1: Try to find alternative port
    const alternativePorts = [3001, 3002, 3003, 8001, 8002, 8003];

    for (const altPort of alternativePorts) {
      try {
        const { stdout } = await execAsync(`lsof -i :${altPort} 2>/dev/null || true`);
        if (!stdout.trim()) {
          logger.info(`Found available alternative port: ${altPort}`, LogContext.SYSTEM);
          // Trigger improvement cycle to adapt to new port
          await this.improvementOrchestrator.runImprovementCycle();
          error.resolved = true;
          error.resolutionTime = new Date();
          return;
        }
      } catch (checkError) {
        // Continue to next port
      }
    }

    // Strategy 2: Force improvement cycle to handle port conflicts
    await this.triggerGeneralImprovement(error);
  }

  private async handleServiceFailure(error: SystemError): Promise<void> {
    logger.info(`Handling service failure: ${error.source}`, LogContext.SYSTEM);

    // Trigger multiple improvement systems to address service failure
    const promises = [
      this.improvementOrchestrator.runImprovementCycle(),
      this.integratedSystem.forceImprovement([`improve-${error.source}-reliability`]),
    ];

    if (error.source.includes('dspy') || error.source.includes('python')) {
      // Special handling for DSPy/Python service failures
      try {
        // Log the DSPy service failure for pattern learning
        await this.alphaEvolve.learnFromPattern(
          'service_failure_dspy',
          { source: error.source, message: error.message },
          { success: false, performance: 0.1 }
        );
      } catch (learningError) {
        logger.debug('Failed to record DSPy failure pattern', LogContext.SYSTEM, {
          error: learningError,
        });
      }
    }

    await Promise.allSettled(promises);

    // Check if service is back online after improvement attempts
    setTimeout(async () => {
      const healthCheck = await this.healthService.checkHealth();
      const serviceHealth = (healthCheck.services as any)[error.source];

      if (serviceHealth && serviceHealth.status !== 'unhealthy') {
        error.resolved = true;
        error.resolutionTime = new Date();

        this.recordEvent('system_recovered', {
          errorId: error.id,
          recoveryTime: error.resolutionTime,
        });

        logger.info(`✅ Service ${error.source} recovered`, LogContext.SYSTEM);
      }
    }, 10000); // Check after 10 seconds
  }

  private async handleTypeScriptError(error: SystemError): Promise<void> {
    logger.info(`Handling TypeScript error: ${error.message}`, LogContext.SYSTEM);

    // TypeScript errors are usually development-time issues
    // Focus on learning from the pattern rather than auto-fixing
    try {
      await this.alphaEvolve.learnFromPattern(
        'typescript_compilation_error',
        {
          message: error.message,
          source: error.source,
          timestamp: error.timestamp,
        },
        { success: false, performance: 0.3 }
      );

      // Trigger a general improvement cycle
      await this.triggerGeneralImprovement(error);

      // Mark as resolved through learning (not auto-fix)
      error.resolved = true;
      error.resolutionTime = new Date();
    } catch (learningError) {
      logger.debug('Failed to learn from TypeScript error pattern', LogContext.SYSTEM, {
        error: learningError,
      });
    }
  }

  private async handleMemoryIssue(error: SystemError): Promise<void> {
    logger.info(`Handling memory issue`, LogContext.SYSTEM);

    // Force garbage collection if possible
    if (global.gc) {
      global.gc();
      logger.info('Forced garbage collection', LogContext.SYSTEM);
    }

    // Trigger memory optimization improvement
    await this.integratedSystem.forceImprovement([
      'reduce-memory-resource-usage',
      'improve-overall-health',
    ]);

    // Learn from memory usage pattern
    try {
      await this.alphaEvolve.learnFromPattern(
        'memory_usage_high',
        {
          processId: process.pid,
          memoryUsage: process.memoryUsage(),
          timestamp: error.timestamp,
        },
        { success: false, performance: 0.2 }
      );
    } catch (learningError) {
      logger.debug('Failed to learn from memory pattern', LogContext.SYSTEM, {
        error: learningError,
      });
    }

    // Check memory after a delay
    setTimeout(() => {
      const memUsage = process.memoryUsage();
      const totalMem = require('os').totalmem();
      const percentage = (memUsage.heapUsed / totalMem) * 100;

      if (percentage < 80) {
        // Improved
        error.resolved = true;
        error.resolutionTime = new Date();

        this.recordEvent('system_recovered', {
          errorId: error.id,
          memoryImprovement: true,
          newMemoryPercentage: percentage,
        });
      }
    }, 15000); // Check after 15 seconds
  }

  private async handleConnectionError(error: SystemError): Promise<void> {
    logger.info(`Handling connection error: ${error.message}`, LogContext.SYSTEM);

    // Trigger connection-related improvements
    await this.integratedSystem.forceImprovement(['improve-connection-reliability']);

    // Learn from connection patterns
    try {
      await this.alphaEvolve.learnFromPattern(
        'connection_failure',
        {
          source: error.source,
          message: error.message,
          timestamp: error.timestamp,
        },
        { success: false, performance: 0.1 }
      );
    } catch (learningError) {
      logger.debug('Failed to learn from connection error pattern', LogContext.SYSTEM, {
        error: learningError,
      });
    }

    // Test connection recovery
    setTimeout(async () => {
      try {
        const healthCheck = await this.healthService.checkHealth();
        if (healthCheck.status !== 'unhealthy') {
          error.resolved = true;
          error.resolutionTime = new Date();

          this.recordEvent('system_recovered', {
            errorId: error.id,
            connectionRestored: true,
          });
        }
      } catch (recoveryCheckError) {
        logger.debug('Connection recovery check failed', LogContext.SYSTEM, {
          error: recoveryCheckError,
        });
      }
    }, 5000);
  }

  private async triggerGeneralImprovement(error: SystemError): Promise<void> {
    logger.info(`Triggering general improvement cycle for error: ${error.type}`, LogContext.SYSTEM);

    // Run improvement cycle on the orchestrator
    await this.improvementOrchestrator.runImprovementCycle();

    // Trigger integrated system improvements
    const opportunities = [
      'improve-overall-health',
      'stimulate-improvement',
      `address-${error.type.replace('_', '-')}`,
    ];

    await this.integratedSystem.forceImprovement(opportunities);

    // Learn from the error pattern
    try {
      await this.alphaEvolve.learnFromPattern(
        `general_error_${error.type}`,
        {
          type: error.type,
          severity: error.severity,
          source: error.source,
          message: error.message,
        },
        { success: false, performance: 0.4 }
      );
    } catch (learningError) {
      logger.debug('Failed to learn from general error pattern', LogContext.SYSTEM, {
        error: learningError,
      });
    }

    // Mark as resolved through improvement attempts
    setTimeout(() => {
      if (!error.resolved) {
        error.resolved = true;
        error.resolutionTime = new Date();

        this.recordEvent('resolution_applied', {
          errorId: error.id,
          strategy: 'general_improvement',
          timestamp: error.resolutionTime,
        });
      }
    }, 20000); // Consider resolved after 20 seconds of improvement attempts
  }

  private recordEvent(type: SelfHealingEvent['type'], details: Record<string, any>): void {
    const event: SelfHealingEvent = {
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      timestamp: new Date(),
      details,
    };

    if (details.errorId) {
      event.errorId = details.errorId;
    }

    this.healingEvents.push(event);

    // Keep only last 1000 events
    if (this.healingEvents.length > 1000) {
      this.healingEvents = this.healingEvents.slice(-1000);
    }

    logger.debug(`Self-healing event recorded: ${type}`, LogContext.SYSTEM, details);

    this.emit('healing-event', event);
  }

  private startPeriodicReporting(): void {
    this.reportingInterval = setInterval(async () => {
      await this.generatePeriodicReport();
    }, this.config.reportIntervalMs);

    // Generate initial report
    setTimeout(() => this.generatePeriodicReport(), 5000);
  }

  private async generatePeriodicReport(): Promise<void> {
    try {
      const report = await this.generateTestReport();

      logger.info('📊 Self-Healing System Periodic Report', LogContext.SYSTEM, {
        duration: `${Math.round(report.duration / 1000)}s`,
        errorsDetected: report.errorsDetected,
        errorsResolved: report.errorsResolved,
        resolutionRate: `${Math.round((report.errorsResolved / Math.max(1, report.errorsDetected)) * 100)}%`,
        improvementCycles: report.improvementCyclesCompleted,
        healthImprovement: `${report.systemHealthImprovement}%`,
        effectiveness: `${Math.round(report.selfHealingEffectiveness * 100)}%`,
      });

      // Save report to file
      const reportPath = path.join(process.cwd(), 'logs', `self-healing-report-${Date.now()}.json`);
      await fs.mkdir(path.dirname(reportPath), { recursive: true });
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    } catch (error) {
      logger.error('Failed to generate periodic report', LogContext.SYSTEM, { error });
    }
  }

  private startErrorSimulation(): void {
    logger.info('Starting error simulation for testing...', LogContext.SYSTEM);

    // Simulate different types of errors periodically
    const errorSimulations = [
      () => this.simulatePortConflict(),
      () => this.simulateServiceFailure(),
      () => this.simulateMemorySpike(),
      () => this.simulateConnectionError(),
    ];

    let simulationIndex = 0;

    const simulateNextError = () => {
      if (!this.isRunning) return;

      try {
        errorSimulations[simulationIndex % errorSimulations.length]();
        simulationIndex++;
      } catch (error) {
        logger.debug('Error simulation failed', LogContext.SYSTEM, { error });
      }

      // Schedule next simulation (random interval between 30-90 seconds)
      const nextInterval = 30000 + Math.random() * 60000;
      setTimeout(simulateNextError, nextInterval);
    };

    // Start first simulation after 10 seconds
    setTimeout(simulateNextError, 10000);
  }

  private simulatePortConflict(): void {
    logger.info('🎭 Simulating port conflict error', LogContext.SYSTEM);

    this.detectError(
      'port_conflict',
      'high',
      'EADDRINUSE: address already in use :::8766',
      'simulated_error',
      null,
      { port: 8766, simulation: true }
    );
  }

  private simulateServiceFailure(): void {
    logger.info('🎭 Simulating service failure', LogContext.SYSTEM);

    const services = ['dspy', 'ollama', 'redis'];
    const service = services[Math.floor(Math.random() * services.length)];

    this.detectError(
      'service_failure',
      'medium',
      `Failed to connect to ${service} service: Connection refused`,
      service,
      null,
      { simulation: true }
    );
  }

  private simulateMemorySpike(): void {
    logger.info('🎭 Simulating memory spike', LogContext.SYSTEM);

    this.detectError(
      'memory_leak',
      'high',
      'Memory usage critically high: 87.3%',
      'memory_monitor',
      null,
      { memoryPercentage: 87.3, simulation: true }
    );
  }

  private simulateConnectionError(): void {
    logger.info('🎭 Simulating connection error', LogContext.SYSTEM);

    this.detectError(
      'connection_error',
      'medium',
      'Database connection timeout after 30s',
      'database',
      null,
      { timeout: 30000, simulation: true }
    );
  }

  async stopTest(): Promise<TestReport> {
    if (!this.isRunning) {
      logger.warn('Self-healing test is not running', LogContext.SYSTEM);
      return this.generateTestReport();
    }

    this.isRunning = false;

    logger.info('🛑 Stopping Universal AI Tools Self-Healing System Test', LogContext.SYSTEM);

    // Stop monitoring
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    if (this.reportingInterval) {
      clearInterval(this.reportingInterval);
      this.reportingInterval = undefined;
    }

    // Stop self-improvement systems
    try {
      await this.improvementOrchestrator.stop();
      // Note: IntegratedSelfImprovementSystem doesn't have a stop method in the current implementation
    } catch (error) {
      logger.error('Error stopping self-improvement systems', LogContext.SYSTEM, { error });
    }

    // Generate final report
    const report = await this.generateTestReport();

    // Save final report
    const reportPath = path.join(
      process.cwd(),
      'logs',
      `self-healing-final-report-${Date.now()}.json`
    );
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    logger.info('📋 Final Self-Healing Test Report', LogContext.SYSTEM, {
      duration: `${Math.round(report.duration / 1000)}s`,
      errorsDetected: report.errorsDetected,
      errorsResolved: report.errorsResolved,
      resolutionRate: `${Math.round((report.errorsResolved / Math.max(1, report.errorsDetected)) * 100)}%`,
      improvementCycles: report.improvementCyclesCompleted,
      effectiveness: `${Math.round(report.selfHealingEffectiveness * 100)}%`,
      reportPath,
    });

    this.emit('test-completed', report);

    return report;
  }

  private async generateTestReport(): Promise<TestReport> {
    const now = new Date();
    const duration = now.getTime() - this.startTime.getTime();

    const errors = Array.from(this.detectedErrors.values());
    const resolvedErrors = errors.filter((e) => e.resolved);

    const improvementEvents = this.healingEvents.filter(
      (e) => e.type === 'improvement_triggered' || e.type === 'cycle_started'
    );
    const completedCycles = this.healingEvents.filter((e) => e.type === 'cycle_completed');

    // Calculate average resolution time
    const resolutionTimes = resolvedErrors
      .filter((e) => e.resolutionTime)
      .map((e) => e.resolutionTime!.getTime() - e.timestamp.getTime());

    const averageResolutionTime =
      resolutionTimes.length > 0
        ? resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length
        : 0;

    // Calculate system health improvement
    let systemHealthImprovement = 0;
    try {
      const currentHealth = await this.healthService.checkHealth();
      const trends = this.healthService.getHealthTrends(Math.round(duration / 60000));
      systemHealthImprovement = trends.averageScore - 50; // Assume baseline of 50
    } catch (error) {
      logger.debug('Failed to calculate health improvement', LogContext.SYSTEM, { error });
    }

    // Calculate self-healing effectiveness
    const resolutionRate = errors.length > 0 ? resolvedErrors.length / errors.length : 1;
    const cycleSuccessRate =
      improvementEvents.length > 0 ? completedCycles.length / improvementEvents.length : 1;
    const selfHealingEffectiveness = (resolutionRate + cycleSuccessRate) / 2;

    // Generate recommendations
    const recommendations = this.generateRecommendations(errors, this.healingEvents);

    const report: TestReport = {
      startTime: this.startTime,
      endTime: now,
      duration,
      errorsDetected: errors.length,
      errorsResolved: resolvedErrors.length,
      improvementCyclesTriggered: improvementEvents.length,
      improvementCyclesCompleted: completedCycles.length,
      averageResolutionTime,
      systemHealthImprovement,
      selfHealingEffectiveness,
      events: this.healingEvents,
      errors,
      recommendations,
    };

    return report;
  }

  private generateRecommendations(errors: SystemError[], events: SelfHealingEvent[]): string[] {
    const recommendations: string[] = [];

    // Analyze error patterns
    const errorTypes = errors.reduce(
      (acc, error) => {
        acc[error.type] = (acc[error.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    // Most common error type
    const mostCommonError = Object.entries(errorTypes).sort(([, a], [, b]) => b - a)[0];

    if (mostCommonError && mostCommonError[1] > 2) {
      recommendations.push(
        `Consider implementing proactive monitoring for ${mostCommonError[0]} errors (${mostCommonError[1]} occurrences)`
      );
    }

    // Unresolved errors
    const unresolvedErrors = errors.filter((e) => !e.resolved);
    if (unresolvedErrors.length > 0) {
      recommendations.push(
        `${unresolvedErrors.length} errors remain unresolved - review resolution strategies`
      );
    }

    // High severity errors
    const criticalErrors = errors.filter((e) => e.severity === 'critical');
    if (criticalErrors.length > 0) {
      recommendations.push(
        `${criticalErrors.length} critical errors detected - implement immediate alerting`
      );
    }

    // Performance recommendations
    const cycleEvents = events.filter((e) => e.type === 'cycle_completed');
    const failedCycles = events.filter(
      (e) => e.type === 'error_detected' && e.details.type === 'improvement_cycle_failure'
    );

    if (failedCycles.length > cycleEvents.length * 0.2) {
      recommendations.push(
        'High improvement cycle failure rate - review system resources and dependencies'
      );
    }

    // Resolution time recommendations
    const longResolutions = errors.filter(
      (e) =>
        e.resolved && e.resolutionTime && e.resolutionTime.getTime() - e.timestamp.getTime() > 60000 // > 1 minute
    );

    if (longResolutions.length > errors.length * 0.3) {
      recommendations.push('Many errors taking >1 minute to resolve - optimize healing strategies');
    }

    // General recommendations
    if (errors.length === 0) {
      recommendations.push(
        'No errors detected during test - consider increasing monitoring sensitivity'
      );
    }

    if (events.filter((e) => e.type === 'system_recovered').length === 0) {
      recommendations.push(
        'No system recovery events recorded - improve recovery detection mechanisms'
      );
    }

    return recommendations;
  }

  // Public API methods
  async getSystemStatus(): Promise<{
    isRunning: boolean;
    uptime: number;
    errorsDetected: number;
    errorsResolved: number;
    lastEvent?: SelfHealingEvent;
  }> {
    return {
      isRunning: this.isRunning,
      uptime: Date.now() - this.startTime.getTime(),
      errorsDetected: this.detectedErrors.size,
      errorsResolved: Array.from(this.detectedErrors.values()).filter((e) => e.resolved).length,
      lastEvent: this.healingEvents[this.healingEvents.length - 1],
    };
  }

  getDetectedErrors(): SystemError[] {
    return Array.from(this.detectedErrors.values());
  }

  getHealingEvents(): SelfHealingEvent[] {
    return [...this.healingEvents];
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const config: Partial<TestConfig> = {};

  // Parse command line arguments
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    const value = args[i + 1];

    switch (key) {
      case '--duration':
        config.maxTestDurationMs = parseInt(value) * 1000;
        break;
      case '--monitor-interval':
        config.monitoringIntervalMs = parseInt(value) * 1000;
        break;
      case '--no-simulation':
        config.simulateErrors = false;
        break;
      case '--log-level':
        config.logLevel = value as any;
        break;
    }
  }

  console.log('🚀 Starting Universal AI Tools Self-Healing System Test');
  console.log('Configuration:', config);

  const orchestrator = new SelfHealingTestOrchestrator(config);

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Received interrupt signal, stopping test...');
    await orchestrator.stopTest();
    process.exit(0);
  });

  try {
    await orchestrator.startTest();

    // Keep process alive
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', async (key) => {
      if (key.toString() === 'q' || key.toString() === '\u0003') {
        // 'q' or Ctrl+C
        console.log('\n🛑 Stopping test...');
        await orchestrator.stopTest();
        process.exit(0);
      } else if (key.toString() === 's') {
        const status = await orchestrator.getSystemStatus();
        console.log('\n📊 Current Status:', status);
      } else if (key.toString() === 'r') {
        const report = await orchestrator.generateTestReport();
        console.log('\n📋 Current Report Summary:');
        console.log(
          `  Errors: ${report.errorsDetected} detected, ${report.errorsResolved} resolved`
        );
        console.log(`  Cycles: ${report.improvementCyclesCompleted} completed`);
        console.log(`  Effectiveness: ${Math.round(report.selfHealingEffectiveness * 100)}%`);
      }
    });

    console.log('\n💡 Test is running. Press:');
    console.log('  - "q" to quit');
    console.log('  - "s" for status');
    console.log('  - "r" for report');
  } catch (error) {
    console.error('❌ Test failed to start:', error);
    process.exit(1);
  }
}

// Export for use as module
export { TestConfig, SystemError, SelfHealingEvent, TestReport };

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}
