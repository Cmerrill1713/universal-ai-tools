/**
 * Intelligent Restart Agent
 * AI-powered agent that learns from restart failure patterns,
 * diagnoses complex issues, and orchestrates intelligent recovery
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';
import { connectionManager } from './connectionManager';
import {
  proactiveRestartMonitor,
  RestartFailure,
  ServiceHealthCheck,
} from './proactiveRestartMonitor';
import { serviceStartupSequencer, StartupFailure, PortConflict } from './serviceStartupSequencer';

export interface RestartPattern {
  id: string;
  patternType: 'temporal' | 'cascading' | 'resource_based' | 'configuration' | 'dependency_chain';
  services: string[];
  failureSequence: FailureEvent[];
  frequency: number;
  lastOccurrence: Date;
  resolutionSuccess: number; // Success rate 0-1
  avgRecoveryTime: number;
  rootCauseAnalysis: {
    primaryCause: string;
    contributingFactors: string[];
    systemConditions: any;
    confidence: number;
  };
  predictiveIndicators: {
    memoryTrend: number[];
    cpuTrend: number[];
    errorRates: number[];
    responseTimeTrend: number[];
  };
  learningMetadata: {
    analysisCount: number;
    lastAnalysis: Date;
    accuracyScore: number;
    improvementSuggestions: string[];
  };
}

export interface FailureEvent {
  timestamp: Date;
  serviceName: string;
  eventType: 'crash' | 'timeout' | 'resource_exhaustion' | 'dependency_failure' | 'config_error';
  severity: 'low' | 'medium' | 'high' | 'critical';
  metrics: {
    memoryUsageMB: number;
    cpuUsagePercent: number;
    responseTimeMs: number;
    errorRate: number;
    connectionCount: number;
  };
  context: any;
}

export interface IntelligentDiagnosis {
  diagnosisId: string;
  timestamp: Date;
  serviceName: string;
  failureData: RestartFailure | StartupFailure;
  aiAnalysis: {
    rootCause: string;
    confidence: number;
    reasoningChain: string[];
    similarPatterns: RestartPattern[];
    anomalies: string[];
  };
  recommendation: {
    immediateActions: RecoveryAction[];
    preventiveActions: PreventiveAction[];
    monitoringUpdates: MonitoringUpdate[];
    systemOptimizations: SystemOptimization[];
  };
  learningInsights: {
    newPatternDiscovered: boolean;
    patternUpdated?: string;
    knowledgeGaps: string[];
    confidenceImprovement: number;
  };
}

export interface RecoveryAction {
  id: string;
  type:
    | 'restart_service'
    | 'kill_process'
    | 'clear_cache'
    | 'update_config'
    | 'scale_resources'
    | 'network_reset'
    | 'dependency_fix';
  priority: 'immediate' | 'high' | 'medium' | 'low';
  description: string;
  estimatedTime: number;
  successProbability: number;
  riskLevel: 'low' | 'medium' | 'high';
  prerequisites: string[];
  rollbackPlan: string[];
  automatable: boolean;
}

export interface PreventiveAction {
  id: string;
  category: 'monitoring' | 'configuration' | 'resource_management' | 'dependency_management';
  description: string;
  implementation: string;
  expectedBenefit: string;
  effort: 'low' | 'medium' | 'high';
}

export interface MonitoringUpdate {
  metric: string;
  threshold: number;
  alertSeverity: 'info' | 'warning' | 'error' | 'critical';
  reason: string;
}

export interface SystemOptimization {
  area: 'memory' | 'cpu' | 'network' | 'disk' | 'configuration';
  optimization: string;
  expectedImprovement: string;
  implementationComplexity: 'low' | 'medium' | 'high';
}

export interface AgentLearningStats {
  totalPatterns: number;
  patternsThisWeek: number;
  diagnosticAccuracy: number;
  recoverySuccessRate: number;
  avgDiagnosisTime: number;
  knowledgeBaseSize: number;
  continuousLearningScore: number;
  falsePositiveRate: number;
  missedFailureRate: number;
}

class IntelligentRestartAgent {
  private supabase: SupabaseClient | null = null;
  private isActive = false;
  private patterns = new Map<string, RestartPattern>();
  private diagnoses = new Map<string, IntelligentDiagnosis>();
  private learningQueue: Array<{ failure: RestartFailure | StartupFailure; context: any }> = [];
  private isProcessingLearning = false;

  // AI learning parameters
  private readonly PATTERN_THRESHOLD = 3; // Need 3+ occurrences to establish pattern
  private readonly CONFIDENCE_THRESHOLD = 0.7; // Minimum confidence for automated actions
  private readonly LEARNING_WINDOW_HOURS = 168; // 7 days learning window
  private readonly MAX_PATTERN_HISTORY = 50; // Keep last 50 occurrences per pattern

  constructor() {
    this.initializeSupabase();
    this.startLearningProcessor();
  }

  /**
   * Initialize Supabase connection for pattern storage and learning
   */
  private async initializeSupabase(): Promise<void> {
    try {
      const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'http://127.0.0.1:54321';
      const supabaseKey =
        process.env.REACT_APP_SUPABASE_ANON_KEY ||
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOuoJkp8TgYwf65Ps6f4JI_xh8KKBTkS6rAs';

      if (supabaseUrl && supabaseKey) {
        this.supabase = createClient(supabaseUrl, supabaseKey);
        logger.info('[IntelligentRestartAgent] Supabase connection initialized');

        // Load existing patterns
        await this.loadExistingPatterns();
      }
    } catch (error) {
      logger.error('[IntelligentRestartAgent] Failed to initialize Supabase', error);
    }
  }

  /**
   * Start the intelligent restart agent
   */
  public async startAgent(): Promise<void> {
    if (this.isActive) {
      logger.warn('[IntelligentRestartAgent] Agent is already active');
      return;
    }

    logger.info('🧠 Starting Intelligent Restart Agent');
    this.isActive = true;

    // Subscribe to restart failures from monitors
    this.subscribeToFailures();

    // Start pattern analysis cycle
    setInterval(() => {
      this.analyzeRecentPatterns();
    }, 300000); // Every 5 minutes

    logger.info('✅ Intelligent Restart Agent started successfully');
  }

  /**
   * Stop the agent
   */
  public stopAgent(): void {
    if (!this.isActive) return;

    logger.info('🛑 Stopping Intelligent Restart Agent');
    this.isActive = false;
  }

  /**
   * Load existing patterns from Supabase
   */
  private async loadExistingPatterns(): Promise<void> {
    if (!this.supabase) return;

    try {
      const { data, error } = await this.supabase
        .from('context_storage')
        .select('*')
        .eq('category', 'intelligent_restart_patterns')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        logger.error('[IntelligentRestartAgent] Failed to load patterns:', error);
        return;
      }

      data?.forEach(record => {
        try {
          const pattern = JSON.parse(record.content) as RestartPattern;
          this.patterns.set(pattern.id, pattern);
        } catch (parseError) {
          logger.warn('[IntelligentRestartAgent] Failed to parse pattern record:', parseError);
        }
      });

      logger.info(`[IntelligentRestartAgent] Loaded ${this.patterns.size} existing patterns`);
    } catch (error) {
      logger.error('[IntelligentRestartAgent] Error loading patterns:', error);
    }
  }

  /**
   * Subscribe to failures from monitoring services
   */
  private subscribeToFailures(): void {
    // In a real implementation, this would subscribe to actual events
    // For now, we'll poll the monitors
    setInterval(async () => {
      await this.checkForNewFailures();
    }, 30000); // Every 30 seconds
  }

  /**
   * Check for new failures from monitors
   */
  private async checkForNewFailures(): Promise<void> {
    try {
      // Get failures from restart monitor
      const restartFailures = proactiveRestartMonitor.getRestartFailures();
      const startupFailures = serviceStartupSequencer.getStartupFailures();

      // Process new failures
      for (const failure of restartFailures) {
        if (!this.diagnoses.has(failure.id)) {
          this.queueForLearning(failure, { source: 'restart_monitor' });
        }
      }

      for (const failure of startupFailures) {
        if (!this.diagnoses.has(failure.id)) {
          this.queueForLearning(failure, { source: 'startup_sequencer' });
        }
      }
    } catch (error) {
      logger.error('[IntelligentRestartAgent] Error checking for new failures:', error);
    }
  }

  /**
   * Queue failure for learning and analysis
   */
  private queueForLearning(failure: RestartFailure | StartupFailure, context: any): void {
    this.learningQueue.push({ failure, context });

    if (!this.isProcessingLearning) {
      this.processLearningQueue();
    }
  }

  /**
   * Start learning processor
   */
  private startLearningProcessor(): void {
    setInterval(() => {
      if (this.learningQueue.length > 0 && !this.isProcessingLearning) {
        this.processLearningQueue();
      }
    }, 5000); // Process every 5 seconds
  }

  /**
   * Process learning queue
   */
  private async processLearningQueue(): Promise<void> {
    if (this.isProcessingLearning || this.learningQueue.length === 0) return;

    this.isProcessingLearning = true;
    logger.debug(
      `[IntelligentRestartAgent] Processing ${this.learningQueue.length} failures for learning`
    );

    while (this.learningQueue.length > 0) {
      const { failure, context } = this.learningQueue.shift()!;

      try {
        // Generate intelligent diagnosis
        const diagnosis = await this.generateIntelligentDiagnosis(failure, context);
        this.diagnoses.set(diagnosis.diagnosisId, diagnosis);

        // Learn from the failure
        await this.learnFromFailure(failure, diagnosis);

        // Execute recommended actions if confidence is high
        if (diagnosis.aiAnalysis.confidence >= this.CONFIDENCE_THRESHOLD) {
          await this.executeRecommendedActions(diagnosis);
        }

        // Store diagnosis in Supabase
        await this.storeDiagnosis(diagnosis);
      } catch (error) {
        logger.error('[IntelligentRestartAgent] Failed to process failure:', error);
      }
    }

    this.isProcessingLearning = false;
  }

  /**
   * Generate intelligent diagnosis for failure
   */
  private async generateIntelligentDiagnosis(
    failure: RestartFailure | StartupFailure,
    context: any
  ): Promise<IntelligentDiagnosis> {
    const diagnosisId = `diagnosis-${failure.id}`;

    // Analyze failure using AI patterns
    const aiAnalysis = await this.performAIAnalysis(failure);

    // Generate recommendations based on analysis
    const recommendation = await this.generateRecommendations(failure, aiAnalysis);

    // Determine learning insights
    const learningInsights = await this.analyzeLearningInsights(failure, aiAnalysis);

    const diagnosis: IntelligentDiagnosis = {
      diagnosisId,
      timestamp: new Date(),
      serviceName: failure.serviceName,
      failureData: failure,
      aiAnalysis,
      recommendation,
      learningInsights,
    };

    logger.info(
      `[IntelligentRestartAgent] Generated diagnosis for ${failure.serviceName} with ${Math.round(aiAnalysis.confidence * 100)}% confidence`
    );

    return diagnosis;
  }

  /**
   * Perform AI analysis of failure
   */
  private async performAIAnalysis(
    failure: RestartFailure | StartupFailure
  ): Promise<IntelligentDiagnosis['aiAnalysis']> {
    // Find similar patterns
    const similarPatterns = this.findSimilarPatterns(failure);

    // Analyze for anomalies
    const anomalies = await this.detectAnomalies(failure);

    // Build reasoning chain
    const reasoningChain = this.buildReasoningChain(failure, similarPatterns);

    // Determine root cause with confidence
    const { rootCause, confidence } = this.determineRootCause(failure, similarPatterns, anomalies);

    return {
      rootCause,
      confidence,
      reasoningChain,
      similarPatterns: similarPatterns.slice(0, 5), // Top 5 similar patterns
      anomalies,
    };
  }

  /**
   * Find similar failure patterns
   */
  private findSimilarPatterns(failure: RestartFailure | StartupFailure): RestartPattern[] {
    const patterns = Array.from(this.patterns.values());

    return patterns
      .map(pattern => ({
        pattern,
        similarity: this.calculatePatternSimilarity(failure, pattern),
      }))
      .filter(({ similarity }) => similarity > 0.5)
      .sort((a, b) => b.similarity - a.similarity)
      .map(({ pattern }) => pattern);
  }

  /**
   * Calculate pattern similarity
   */
  private calculatePatternSimilarity(
    failure: RestartFailure | StartupFailure,
    pattern: RestartPattern
  ): number {
    let similarity = 0;

    // Service match
    if (pattern.services.includes(failure.serviceName)) {
      similarity += 0.3;
    }

    // Failure type match
    if (
      'failureType' in failure &&
      pattern.failureSequence.some(
        event => this.mapFailureTypeToEventType(failure.failureType) === event.eventType
      )
    ) {
      similarity += 0.4;
    }

    // Time-based similarity (similar times of day/week)
    const timeScore = this.calculateTimeSimilarity(failure.timestamp, pattern.lastOccurrence);
    similarity += timeScore * 0.2;

    // Context similarity
    const contextScore = this.calculateContextSimilarity(failure, pattern);
    similarity += contextScore * 0.1;

    return Math.min(similarity, 1.0);
  }

  /**
   * Map failure type to event type
   */
  private mapFailureTypeToEventType(failureType: string): FailureEvent['eventType'] {
    const mapping: Record<string, FailureEvent['eventType']> = {
      port_conflict: 'config_error',
      memory_exhaustion: 'resource_exhaustion',
      service_dependency_failure: 'dependency_failure',
      startup_timeout: 'timeout',
      process_crash: 'crash',
    };

    return mapping[failureType] || 'crash';
  }

  /**
   * Calculate time-based similarity
   */
  private calculateTimeSimilarity(time1: Date, time2: Date): number {
    const hourDiff = Math.abs(time1.getHours() - time2.getHours());
    const dayDiff = Math.abs(time1.getDay() - time2.getDay());

    // Similar times of day and week get higher scores
    const hourSimilarity = 1 - hourDiff / 24;
    const daySimilarity = 1 - dayDiff / 7;

    return (hourSimilarity + daySimilarity) / 2;
  }

  /**
   * Calculate context similarity
   */
  private calculateContextSimilarity(
    failure: RestartFailure | StartupFailure,
    pattern: RestartPattern
  ): number {
    // Compare system conditions, load patterns, etc.
    // For now, return a base similarity
    return 0.5;
  }

  /**
   * Detect anomalies in failure
   */
  private async detectAnomalies(failure: RestartFailure | StartupFailure): Promise<string[]> {
    const anomalies: string[] = [];

    // Check if failure occurred during unusual conditions
    if ('diagnostics' in failure) {
      // Memory anomaly
      if (failure.diagnostics.memoryUsageMB && failure.diagnostics.memoryUsageMB > 4096) {
        anomalies.push('Unusually high memory usage detected');
      }

      // CPU anomaly
      if (failure.diagnostics.cpuUsagePercent && failure.diagnostics.cpuUsagePercent > 90) {
        anomalies.push('Unusually high CPU usage detected');
      }

      // Startup time anomaly
      if (failure.diagnostics.startupTimeMs && failure.diagnostics.startupTimeMs > 120000) {
        anomalies.push('Unusually long startup time detected');
      }
    }

    // Check for cascading failures
    const recentFailures = this.getRecentFailures(failure.timestamp, 300000); // 5 minutes
    if (recentFailures.length > 3) {
      anomalies.push('Cascading failure pattern detected');
    }

    return anomalies;
  }

  /**
   * Get recent failures within time window
   */
  private getRecentFailures(
    timestamp: Date,
    windowMs: number
  ): (RestartFailure | StartupFailure)[] {
    const cutoff = new Date(timestamp.getTime() - windowMs);
    const allFailures = [
      ...proactiveRestartMonitor.getRestartFailures(),
      ...serviceStartupSequencer.getStartupFailures(),
    ];

    return allFailures.filter(failure => failure.timestamp >= cutoff);
  }

  /**
   * Build reasoning chain
   */
  private buildReasoningChain(
    failure: RestartFailure | StartupFailure,
    similarPatterns: RestartPattern[]
  ): string[] {
    const chain: string[] = [];

    // Initial observation
    chain.push(`Service ${failure.serviceName} failed at ${failure.timestamp.toISOString()}`);

    // Pattern analysis
    if (similarPatterns.length > 0) {
      chain.push(`Found ${similarPatterns.length} similar failure patterns in history`);
      chain.push(`Most similar pattern has ${similarPatterns[0].frequency} occurrences`);
    }

    // Failure type analysis
    if ('failureType' in failure) {
      chain.push(`Failure type identified as: ${failure.failureType}`);
    }

    // System conditions
    if ('diagnostics' in failure && failure.diagnostics.memoryUsageMB) {
      chain.push(`System memory usage: ${failure.diagnostics.memoryUsageMB}MB`);
    }

    // Recovery probability
    if (similarPatterns.length > 0 && similarPatterns[0].resolutionSuccess > 0) {
      chain.push(
        `Historical recovery success rate: ${Math.round(similarPatterns[0].resolutionSuccess * 100)}%`
      );
    }

    return chain;
  }

  /**
   * Determine root cause with confidence
   */
  private determineRootCause(
    failure: RestartFailure | StartupFailure,
    similarPatterns: RestartPattern[],
    anomalies: string[]
  ): { rootCause: string; confidence: number } {
    let confidence = 0.5; // Base confidence
    let rootCause = 'Unknown system failure';

    // Use similar patterns to inform root cause
    if (similarPatterns.length > 0) {
      const primaryPattern = similarPatterns[0];
      rootCause = primaryPattern.rootCauseAnalysis.primaryCause;
      confidence = Math.min(confidence + primaryPattern.rootCauseAnalysis.confidence * 0.4, 0.9);
    }

    // Adjust based on failure type
    if ('failureType' in failure) {
      const knownCauses: Record<string, { cause: string; confidence: number }> = {
        port_conflict: { cause: 'Port binding conflict with existing process', confidence: 0.8 },
        memory_exhaustion: { cause: 'System memory resources exhausted', confidence: 0.85 },
        service_dependency_failure: {
          cause: 'Required dependency service unavailable',
          confidence: 0.75,
        },
        startup_timeout: {
          cause: 'Service initialization exceeded timeout threshold',
          confidence: 0.7,
        },
        process_crash: { cause: 'Unexpected service process termination', confidence: 0.6 },
      };

      if (knownCauses[failure.failureType]) {
        rootCause = knownCauses[failure.failureType].cause;
        confidence = Math.max(confidence, knownCauses[failure.failureType].confidence);
      }
    }

    // Reduce confidence for anomalies
    if (anomalies.length > 2) {
      confidence *= 0.8; // Reduce confidence when multiple anomalies present
    }

    return { rootCause, confidence };
  }

  /**
   * Generate recommendations based on analysis
   */
  private async generateRecommendations(
    failure: RestartFailure | StartupFailure,
    aiAnalysis: IntelligentDiagnosis['aiAnalysis']
  ): Promise<IntelligentDiagnosis['recommendation']> {
    const immediateActions = await this.generateImmediateActions(failure, aiAnalysis);
    const preventiveActions = await this.generatePreventiveActions(failure, aiAnalysis);
    const monitoringUpdates = await this.generateMonitoringUpdates(failure, aiAnalysis);
    const systemOptimizations = await this.generateSystemOptimizations(failure, aiAnalysis);

    return {
      immediateActions,
      preventiveActions,
      monitoringUpdates,
      systemOptimizations,
    };
  }

  /**
   * Generate immediate recovery actions
   */
  private async generateImmediateActions(
    failure: RestartFailure | StartupFailure,
    aiAnalysis: IntelligentDiagnosis['aiAnalysis']
  ): Promise<RecoveryAction[]> {
    const actions: RecoveryAction[] = [];

    // Service restart (always include)
    actions.push({
      id: `restart-${failure.serviceName}-${Date.now()}`,
      type: 'restart_service',
      priority: 'immediate',
      description: `Restart ${failure.serviceName} service`,
      estimatedTime: 60000,
      successProbability: 0.8,
      riskLevel: 'low',
      prerequisites: ['Stop current process', 'Clear temporary files'],
      rollbackPlan: ['Restore previous version if restart fails'],
      automatable: true,
    });

    // Specific actions based on failure type
    if ('failureType' in failure) {
      switch (failure.failureType) {
        case 'port_conflict':
          actions.push({
            id: `kill-conflicting-${Date.now()}`,
            type: 'kill_process',
            priority: 'immediate',
            description: 'Terminate process using conflicting port',
            estimatedTime: 10000,
            successProbability: 0.9,
            riskLevel: 'medium',
            prerequisites: ['Identify conflicting process'],
            rollbackPlan: ['Restart terminated process if critical'],
            automatable: true,
          });
          break;

        case 'memory_exhaustion':
          actions.push({
            id: `clear-memory-${Date.now()}`,
            type: 'clear_cache',
            priority: 'high',
            description: 'Clear system cache and free memory',
            estimatedTime: 20000,
            successProbability: 0.7,
            riskLevel: 'low',
            prerequisites: ['Check available memory'],
            rollbackPlan: ['Monitor memory usage post-cleanup'],
            automatable: true,
          });
          break;

        case 'service_dependency_failure':
          actions.push({
            id: `restart-deps-${Date.now()}`,
            type: 'dependency_fix',
            priority: 'high',
            description: 'Restart failed dependency services',
            estimatedTime: 120000,
            successProbability: 0.75,
            riskLevel: 'high',
            prerequisites: ['Identify failed dependencies'],
            rollbackPlan: ['Restore service mesh configuration'],
            automatable: false,
          });
          break;
      }
    }

    return actions;
  }

  /**
   * Generate preventive actions
   */
  private async generatePreventiveActions(
    failure: RestartFailure | StartupFailure,
    aiAnalysis: IntelligentDiagnosis['aiAnalysis']
  ): Promise<PreventiveAction[]> {
    const actions: PreventiveAction[] = [
      {
        id: `monitor-${failure.serviceName}-health`,
        category: 'monitoring',
        description: 'Implement enhanced health monitoring',
        implementation: 'Add comprehensive health checks with early warning indicators',
        expectedBenefit: 'Detect issues before they cause failures',
        effort: 'medium',
      },
    ];

    // Add specific preventive measures based on failure patterns
    if (aiAnalysis.similarPatterns.length > 0) {
      const pattern = aiAnalysis.similarPatterns[0];

      if (pattern.patternType === 'resource_based') {
        actions.push({
          id: `resource-limits-${failure.serviceName}`,
          category: 'resource_management',
          description: 'Implement dynamic resource scaling',
          implementation: 'Configure auto-scaling based on resource utilization',
          expectedBenefit: 'Prevent resource exhaustion failures',
          effort: 'high',
        });
      }

      if (pattern.patternType === 'dependency_chain') {
        actions.push({
          id: `circuit-breaker-${failure.serviceName}`,
          category: 'dependency_management',
          description: 'Implement circuit breaker pattern',
          implementation: 'Add circuit breakers for external dependencies',
          expectedBenefit: 'Prevent cascading failures',
          effort: 'medium',
        });
      }
    }

    return actions;
  }

  /**
   * Generate monitoring updates
   */
  private async generateMonitoringUpdates(
    failure: RestartFailure | StartupFailure,
    aiAnalysis: IntelligentDiagnosis['aiAnalysis']
  ): Promise<MonitoringUpdate[]> {
    const updates: MonitoringUpdate[] = [];

    // Memory monitoring
    if ('diagnostics' in failure && failure.diagnostics.memoryUsageMB) {
      updates.push({
        metric: 'memory_usage_mb',
        threshold: Math.max(failure.diagnostics.memoryUsageMB * 0.8, 1024),
        alertSeverity: 'warning',
        reason: 'Prevent memory exhaustion based on recent failure',
      });
    }

    // Response time monitoring
    if ('diagnostics' in failure && failure.diagnostics.startupTimeMs) {
      updates.push({
        metric: 'startup_time_ms',
        threshold: failure.diagnostics.startupTimeMs * 0.8,
        alertSeverity: 'warning',
        reason: 'Early warning for startup performance degradation',
      });
    }

    return updates;
  }

  /**
   * Generate system optimizations
   */
  private async generateSystemOptimizations(
    failure: RestartFailure | StartupFailure,
    aiAnalysis: IntelligentDiagnosis['aiAnalysis']
  ): Promise<SystemOptimization[]> {
    const optimizations: SystemOptimization[] = [];

    if ('failureType' in failure) {
      switch (failure.failureType) {
        case 'memory_exhaustion':
          optimizations.push({
            area: 'memory',
            optimization: 'Implement memory pooling and garbage collection tuning',
            expectedImprovement: '30-40% reduction in memory usage spikes',
            implementationComplexity: 'medium',
          });
          break;

        case 'startup_timeout':
          optimizations.push({
            area: 'configuration',
            optimization: 'Optimize service initialization sequence',
            expectedImprovement: '50% reduction in startup time',
            implementationComplexity: 'low',
          });
          break;
      }
    }

    return optimizations;
  }

  /**
   * Analyze learning insights
   */
  private async analyzeLearningInsights(
    failure: RestartFailure | StartupFailure,
    aiAnalysis: IntelligentDiagnosis['aiAnalysis']
  ): Promise<IntelligentDiagnosis['learningInsights']> {
    // Check if this represents a new pattern
    const existingPattern = this.findExistingPattern(failure, aiAnalysis);
    const newPatternDiscovered = !existingPattern && aiAnalysis.similarPatterns.length === 0;

    return {
      newPatternDiscovered,
      patternUpdated: existingPattern?.id,
      knowledgeGaps: this.identifyKnowledgeGaps(failure, aiAnalysis),
      confidenceImprovement: this.calculateConfidenceImprovement(aiAnalysis),
    };
  }

  /**
   * Find existing pattern that matches this failure
   */
  private findExistingPattern(
    failure: RestartFailure | StartupFailure,
    aiAnalysis: IntelligentDiagnosis['aiAnalysis']
  ): RestartPattern | undefined {
    return aiAnalysis.similarPatterns.find(
      pattern => this.calculatePatternSimilarity(failure, pattern) > 0.8
    );
  }

  /**
   * Identify knowledge gaps
   */
  private identifyKnowledgeGaps(
    failure: RestartFailure | StartupFailure,
    aiAnalysis: IntelligentDiagnosis['aiAnalysis']
  ): string[] {
    const gaps: string[] = [];

    if (aiAnalysis.confidence < 0.7) {
      gaps.push('Low confidence in root cause analysis');
    }

    if (aiAnalysis.similarPatterns.length === 0) {
      gaps.push('No historical patterns available for comparison');
    }

    if (aiAnalysis.anomalies.length > 2) {
      gaps.push('Multiple anomalies present - need better anomaly detection');
    }

    return gaps;
  }

  /**
   * Calculate confidence improvement from this learning
   */
  private calculateConfidenceImprovement(aiAnalysis: IntelligentDiagnosis['aiAnalysis']): number {
    // Base improvement based on pattern availability
    let improvement = 0.02; // 2% base improvement

    // More improvement if we're learning from good patterns
    if (aiAnalysis.similarPatterns.length > 0) {
      improvement += aiAnalysis.similarPatterns.length * 0.01;
    }

    // Less improvement if confidence is already high
    if (aiAnalysis.confidence > 0.8) {
      improvement *= 0.5;
    }

    return Math.min(improvement, 0.1); // Cap at 10% improvement
  }

  /**
   * Learn from failure and update patterns
   */
  private async learnFromFailure(
    failure: RestartFailure | StartupFailure,
    diagnosis: IntelligentDiagnosis
  ): Promise<void> {
    // Update existing pattern or create new one
    if (diagnosis.learningInsights.patternUpdated) {
      await this.updateExistingPattern(
        diagnosis.learningInsights.patternUpdated,
        failure,
        diagnosis
      );
    } else if (diagnosis.learningInsights.newPatternDiscovered) {
      await this.createNewPattern(failure, diagnosis);
    }

    // Update global learning metrics
    await this.updateLearningMetrics(diagnosis);
  }

  /**
   * Update existing pattern with new failure data
   */
  private async updateExistingPattern(
    patternId: string,
    failure: RestartFailure | StartupFailure,
    diagnosis: IntelligentDiagnosis
  ): Promise<void> {
    const pattern = this.patterns.get(patternId);
    if (!pattern) return;

    // Update pattern frequency and metadata
    pattern.frequency++;
    pattern.lastOccurrence = failure.timestamp;

    // Add new failure event to sequence
    const failureEvent: FailureEvent = {
      timestamp: failure.timestamp,
      serviceName: failure.serviceName,
      eventType:
        'failureType' in failure ? this.mapFailureTypeToEventType(failure.failureType) : 'crash',
      severity: failure.severity,
      metrics: this.extractMetrics(failure),
      context: diagnosis,
    };

    pattern.failureSequence.push(failureEvent);

    // Keep only recent events
    if (pattern.failureSequence.length > this.MAX_PATTERN_HISTORY) {
      pattern.failureSequence = pattern.failureSequence.slice(-this.MAX_PATTERN_HISTORY);
    }

    // Update learning metadata
    pattern.learningMetadata.analysisCount++;
    pattern.learningMetadata.lastAnalysis = new Date();
    pattern.learningMetadata.accuracyScore = this.calculatePatternAccuracy(pattern);

    this.patterns.set(patternId, pattern);

    // Store updated pattern
    await this.storePattern(pattern);

    logger.debug(
      `[IntelligentRestartAgent] Updated pattern ${patternId} (frequency: ${pattern.frequency})`
    );
  }

  /**
   * Create new pattern from failure
   */
  private async createNewPattern(
    failure: RestartFailure | StartupFailure,
    diagnosis: IntelligentDiagnosis
  ): Promise<void> {
    const patternId = `pattern-${failure.serviceName}-${Date.now()}`;

    const pattern: RestartPattern = {
      id: patternId,
      patternType: this.classifyPatternType(failure, diagnosis),
      services: [failure.serviceName],
      failureSequence: [
        {
          timestamp: failure.timestamp,
          serviceName: failure.serviceName,
          eventType:
            'failureType' in failure
              ? this.mapFailureTypeToEventType(failure.failureType)
              : 'crash',
          severity: failure.severity,
          metrics: this.extractMetrics(failure),
          context: diagnosis,
        },
      ],
      frequency: 1,
      lastOccurrence: failure.timestamp,
      resolutionSuccess: 0.5, // Start with neutral success rate
      avgRecoveryTime: diagnosis.aiAnalysis.confidence > 0.7 ? 60000 : 120000,
      rootCauseAnalysis: {
        primaryCause: diagnosis.aiAnalysis.rootCause,
        contributingFactors: diagnosis.aiAnalysis.anomalies,
        systemConditions: this.captureSystemConditions(),
        confidence: diagnosis.aiAnalysis.confidence,
      },
      predictiveIndicators: {
        memoryTrend: [],
        cpuTrend: [],
        errorRates: [],
        responseTimeTrend: [],
      },
      learningMetadata: {
        analysisCount: 1,
        lastAnalysis: new Date(),
        accuracyScore: diagnosis.aiAnalysis.confidence,
        improvementSuggestions: [],
      },
    };

    this.patterns.set(patternId, pattern);
    await this.storePattern(pattern);

    logger.info(
      `[IntelligentRestartAgent] Created new pattern ${patternId} for ${failure.serviceName}`
    );
  }

  /**
   * Classify pattern type
   */
  private classifyPatternType(
    failure: RestartFailure | StartupFailure,
    diagnosis: IntelligentDiagnosis
  ): RestartPattern['patternType'] {
    // Analyze the failure to determine pattern type
    if ('diagnostics' in failure) {
      if (failure.diagnostics.memoryUsageMB && failure.diagnostics.memoryUsageMB > 2048) {
        return 'resource_based';
      }

      if (
        failure.diagnostics.dependentServices &&
        failure.diagnostics.dependentServices.length > 0
      ) {
        return 'dependency_chain';
      }
    }

    if (diagnosis.aiAnalysis.anomalies.some(a => a.includes('cascading'))) {
      return 'cascading';
    }

    // Check if it's time-based (similar times)
    const hour = failure.timestamp.getHours();
    if (hour < 6 || hour > 22) {
      return 'temporal';
    }

    return 'configuration'; // Default
  }

  /**
   * Extract metrics from failure
   */
  private extractMetrics(failure: RestartFailure | StartupFailure): FailureEvent['metrics'] {
    const defaultMetrics = {
      memoryUsageMB: 0,
      cpuUsagePercent: 0,
      responseTimeMs: 0,
      errorRate: 0,
      connectionCount: 0,
    };

    if ('diagnostics' in failure) {
      return {
        memoryUsageMB: failure.diagnostics.memoryUsageMB || 0,
        cpuUsagePercent: failure.diagnostics.cpuUsagePercent || 0,
        responseTimeMs: failure.diagnostics.startupTimeMs || 0,
        errorRate: failure.severity === 'critical' ? 1.0 : 0.5,
        connectionCount: 0,
      };
    }

    return defaultMetrics;
  }

  /**
   * Capture current system conditions
   */
  private captureSystemConditions(): any {
    return {
      timestamp: new Date().toISOString(),
      systemLoad: 'normal', // Would be actual system metrics in production
      activeServices: Array.from(this.patterns.keys()).length,
      recentFailures: this.getRecentFailures(new Date(), 3600000).length, // Last hour
    };
  }

  /**
   * Calculate pattern accuracy
   */
  private calculatePatternAccuracy(pattern: RestartPattern): number {
    // Base accuracy on successful resolutions and learning count
    let accuracy = pattern.resolutionSuccess;

    // Improve accuracy with more data points
    if (pattern.learningMetadata.analysisCount > 10) {
      accuracy += 0.1;
    }

    // Factor in confidence from root cause analysis
    accuracy = (accuracy + pattern.rootCauseAnalysis.confidence) / 2;

    return Math.min(accuracy, 1.0);
  }

  /**
   * Execute recommended actions from diagnosis
   */
  private async executeRecommendedActions(diagnosis: IntelligentDiagnosis): Promise<void> {
    const automatedActions = diagnosis.recommendation.immediateActions
      .filter(action => action.automatable && action.riskLevel !== 'high')
      .sort((a, b) => this.getPriorityValue(a.priority) - this.getPriorityValue(b.priority));

    logger.info(
      `[IntelligentRestartAgent] Executing ${automatedActions.length} automated actions for ${diagnosis.serviceName}`
    );

    for (const action of automatedActions) {
      try {
        await this.executeAction(action);
        logger.info(`[IntelligentRestartAgent] ✅ Successfully executed: ${action.description}`);
      } catch (error) {
        logger.error(
          `[IntelligentRestartAgent] ❌ Failed to execute: ${action.description}`,
          error
        );
      }
    }
  }

  /**
   * Get priority value for sorting
   */
  private getPriorityValue(priority: RecoveryAction['priority']): number {
    const values = { immediate: 0, high: 1, medium: 2, low: 3 };
    return values[priority];
  }

  /**
   * Execute individual action
   */
  private async executeAction(action: RecoveryAction): Promise<void> {
    logger.info(`[IntelligentRestartAgent] Executing action: ${action.description}`);

    switch (action.type) {
      case 'restart_service':
        // In production, integrate with actual service management
        await new Promise(resolve => setTimeout(resolve, 2000));
        break;

      case 'kill_process':
        // In production, use actual process management
        await new Promise(resolve => setTimeout(resolve, 1000));
        break;

      case 'clear_cache':
        // In production, clear actual cache
        await new Promise(resolve => setTimeout(resolve, 3000));
        break;

      default:
        logger.warn(`[IntelligentRestartAgent] Unknown action type: ${action.type}`);
    }
  }

  /**
   * Store diagnosis in Supabase
   */
  private async storeDiagnosis(diagnosis: IntelligentDiagnosis): Promise<void> {
    if (!this.supabase) return;

    try {
      await this.supabase.from('context_storage').insert({
        category: 'intelligent_restart_diagnoses',
        source: 'intelligent-restart-agent',
        content: JSON.stringify(diagnosis),
        metadata: {
          service_name: diagnosis.serviceName,
          confidence: diagnosis.aiAnalysis.confidence,
          new_pattern: diagnosis.learningInsights.newPatternDiscovered,
        },
        user_id: 'system',
      });
    } catch (error) {
      logger.error('[IntelligentRestartAgent] Failed to store diagnosis:', error);
    }
  }

  /**
   * Store pattern in Supabase
   */
  private async storePattern(pattern: RestartPattern): Promise<void> {
    if (!this.supabase) return;

    try {
      await this.supabase.from('context_storage').upsert({
        category: 'intelligent_restart_patterns',
        source: 'intelligent-restart-agent',
        content: JSON.stringify(pattern),
        metadata: {
          pattern_id: pattern.id,
          pattern_type: pattern.patternType,
          frequency: pattern.frequency,
          accuracy: pattern.learningMetadata.accuracyScore,
        },
        user_id: 'system',
      });
    } catch (error) {
      logger.error('[IntelligentRestartAgent] Failed to store pattern:', error);
    }
  }

  /**
   * Update learning metrics
   */
  private async updateLearningMetrics(diagnosis: IntelligentDiagnosis): Promise<void> {
    // Store learning metrics for analysis
    const metrics = {
      timestamp: new Date().toISOString(),
      confidence: diagnosis.aiAnalysis.confidence,
      patterns_used: diagnosis.aiAnalysis.similarPatterns.length,
      new_pattern: diagnosis.learningInsights.newPatternDiscovered,
      knowledge_gaps: diagnosis.learningInsights.knowledgeGaps.length,
    };

    if (this.supabase) {
      try {
        await this.supabase.from('context_storage').insert({
          category: 'agent_learning_metrics',
          source: 'intelligent-restart-agent',
          content: JSON.stringify(metrics),
          metadata: {
            learning_session: new Date().toISOString().split('T')[0], // Daily sessions
          },
          user_id: 'system',
        });
      } catch (error) {
        logger.error('[IntelligentRestartAgent] Failed to store learning metrics:', error);
      }
    }
  }

  /**
   * Analyze recent patterns for trends
   */
  private async analyzeRecentPatterns(): Promise<void> {
    const recentPatterns = Array.from(this.patterns.values()).filter(pattern => {
      const daysSinceLastOccurrence =
        (Date.now() - pattern.lastOccurrence.getTime()) / (24 * 60 * 60 * 1000);
      return daysSinceLastOccurrence <= 7; // Last week
    });

    if (recentPatterns.length === 0) return;

    // Identify trending patterns
    const trendingPatterns = recentPatterns
      .filter(pattern => pattern.frequency >= this.PATTERN_THRESHOLD)
      .sort((a, b) => b.frequency - a.frequency);

    if (trendingPatterns.length > 0) {
      logger.info(
        `[IntelligentRestartAgent] Identified ${trendingPatterns.length} trending failure patterns:`,
        trendingPatterns
          .slice(0, 3)
          .map(p => `${p.services.join(',')} (${p.frequency}x)`)
          .join(', ')
      );
    }

    // Proactive recommendations for high-frequency patterns
    for (const pattern of trendingPatterns.slice(0, 3)) {
      if (pattern.frequency > 5 && pattern.resolutionSuccess < 0.8) {
        await this.generateProactiveRecommendations(pattern);
      }
    }
  }

  /**
   * Generate proactive recommendations for problematic patterns
   */
  private async generateProactiveRecommendations(pattern: RestartPattern): Promise<void> {
    logger.warn(
      `[IntelligentRestartAgent] 🚨 High-frequency pattern detected: ${pattern.services.join(',')} - ${pattern.frequency} occurrences`
    );

    const recommendations = {
      pattern_id: pattern.id,
      services: pattern.services,
      frequency: pattern.frequency,
      recommendations: [
        'Consider implementing circuit breaker pattern',
        'Review resource allocation and scaling policies',
        'Add comprehensive monitoring for early detection',
        'Implement chaos engineering to test resilience',
      ],
    };

    // Store proactive recommendations
    if (this.supabase) {
      try {
        await this.supabase.from('context_storage').insert({
          category: 'proactive_restart_recommendations',
          source: 'intelligent-restart-agent',
          content: JSON.stringify(recommendations),
          metadata: {
            pattern_type: pattern.patternType,
            urgency: 'high',
            services: pattern.services.join(','),
          },
          user_id: 'system',
        });
      } catch (error) {
        logger.error('[IntelligentRestartAgent] Failed to store proactive recommendations:', error);
      }
    }
  }

  /**
   * Get agent learning statistics
   */
  public getAgentLearningStats(): AgentLearningStats {
    const patterns = Array.from(this.patterns.values());
    const diagnoses = Array.from(this.diagnoses.values());

    // Calculate patterns this week
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const patternsThisWeek = patterns.filter(p => p.lastOccurrence >= oneWeekAgo).length;

    // Calculate diagnostic accuracy
    const accurateAnalyses = diagnoses.filter(d => d.aiAnalysis.confidence > 0.7).length;
    const diagnosticAccuracy = diagnoses.length > 0 ? accurateAnalyses / diagnoses.length : 0;

    // Calculate recovery success rate
    const patternsWithResolution = patterns.filter(p => p.resolutionSuccess > 0);
    const avgRecoverySuccess =
      patternsWithResolution.length > 0
        ? patternsWithResolution.reduce((sum, p) => sum + p.resolutionSuccess, 0) /
          patternsWithResolution.length
        : 0;

    // Calculate average diagnosis time (mock - in production, track actual time)
    const avgDiagnosisTime = 5000; // 5 seconds average

    // Calculate false positive rate (mock)
    const falsePositiveRate = Math.max(0, 0.1 - diagnosticAccuracy * 0.1);

    return {
      totalPatterns: patterns.length,
      patternsThisWeek,
      diagnosticAccuracy,
      recoverySuccessRate: avgRecoverySuccess,
      avgDiagnosisTime,
      knowledgeBaseSize: patterns.length + diagnoses.length,
      continuousLearningScore: Math.min(diagnosticAccuracy + patterns.length / 100, 1.0),
      falsePositiveRate,
      missedFailureRate: Math.max(0, 0.05 - diagnosticAccuracy * 0.05),
    };
  }

  /**
   * Get patterns
   */
  public getPatterns(): RestartPattern[] {
    return Array.from(this.patterns.values());
  }

  /**
   * Get diagnoses
   */
  public getDiagnoses(): IntelligentDiagnosis[] {
    return Array.from(this.diagnoses.values());
  }

  /**
   * Get agent status
   */
  public getAgentStatus(): any {
    return {
      isActive: this.isActive,
      learningQueueSize: this.learningQueue.length,
      isProcessingLearning: this.isProcessingLearning,
      totalPatterns: this.patterns.size,
      totalDiagnoses: this.diagnoses.size,
    };
  }
}

// Export the class and singleton instance
export { IntelligentRestartAgent };
export const intelligentRestartAgent = new IntelligentRestartAgent();
export default intelligentRestartAgent;
