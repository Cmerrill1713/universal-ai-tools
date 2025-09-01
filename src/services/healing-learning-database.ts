/**
 * Healing Learning Database
 * Centralized knowledge base for all healing patterns and outcomes
 * Enables cross-module learning to achieve >95% success rates
 */

import { EventEmitter } from 'events';
import Redis from 'ioredis';
import { createClient } from '@supabase/supabase-js';
import { LogContext, log } from '../utils/logger';
import { config } from '../config/environment';
import { contextStorageService } from './context-storage-service';

interface LearningEntry {
  id: string;
  timestamp: Date;
  errorPattern: {
    type: string;
    message: string;
    severity: string;
    context: Record<string, any>;
  };
  healingAttempt: {
    module: string;
    approach: string;
    parameters: Record<string, any>;
    duration: number;
  };
  outcome: {
    success: boolean;
    confidence: number;
    validationPassed: boolean;
    performanceImpact: number;
    sideEffects: string[];
  };
  metadata: {
    environment: string;
    systemState: Record<string, any>;
    correlatedErrors: string[];
  };
}

interface PatternStatistics {
  patternId: string;
  occurrences: number;
  successRate: number;
  averageHealingTime: number;
  bestApproach: string;
  bestModule: string;
  confidenceScore: number;
  lastUpdated: Date;
}

interface ModulePerformance {
  moduleName: string;
  totalAttempts: number;
  successfulHeals: number;
  averageConfidence: number;
  averageTime: number;
  specializations: Map<string, number>;
  trends: {
    daily: number[];
    weekly: number[];
    monthly: number[];
  };
}

class HealingLearningDatabase extends EventEmitter {
  private redis: Redis;
  private supabase: ReturnType<typeof createClient>;
  private readonly logContext = LogContext.AI;
  private logger = log;
  private cache: Map<string, LearningEntry> = new Map();
  private patterns: Map<string, PatternStatistics> = new Map();
  private moduleStats: Map<string, ModulePerformance> = new Map();
  private readonly CACHE_TTL = 3600; // 1 hour
  private readonly BATCH_SIZE = 100;
  private readonly MIN_PATTERN_OCCURRENCES = 5;
  private readonly SUCCESS_THRESHOLD = 0.95;
  private pendingWrites: LearningEntry[] = [];
  private syncInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.redis = new Redis(config.redis?.url || 'redis://localhost:6379');
    this.supabase = createClient(config.supabase.url, config.supabase.serviceKey);
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Load existing patterns from Supabase
      await this.loadHistoricalData();
      
      // Start sync interval
      this.syncInterval = setInterval(() => {
        this.syncToStorage();
      }, 30000); // Sync every 30 seconds
      
      // Subscribe to Redis pub/sub for real-time updates
      await this.setupRedisPubSub();
      
      log.info('Learning database initialized', this.logContext, {
        patternsLoaded: this.patterns.size,
        modulesTracked: this.moduleStats.size
      });
    } catch (error) {
      log.error('Failed to initialize learning database', this.logContext, { error });
    }
  }

  /**
   * Records a healing attempt and outcome for learning
   */
  async recordHealingOutcome(entry: Omit<LearningEntry, 'id' | 'timestamp'>): Promise<string> {
    const id = this.generateId();
    const timestamp = new Date();
    
    const learningEntry: LearningEntry = {
      id,
      timestamp,
      ...entry
    };
    
    // Store in cache
    this.cache.set(id, learningEntry);
    
    // Add to pending writes
    this.pendingWrites.push(learningEntry);
    
    // Update pattern statistics
    await this.updatePatternStatistics(learningEntry);
    
    // Update module performance
    await this.updateModulePerformance(learningEntry);
    
    // Publish to Redis for real-time sharing
    await this.publishLearningUpdate(learningEntry);
    
    // Trigger batch write if threshold reached
    if (this.pendingWrites.length >= this.BATCH_SIZE) {
      await this.batchWriteToStorage();
    }
    
    // Emit event for listeners
    this.emit('learning-recorded', learningEntry);
    
    return id;
  }

  /**
   * Queries the database for optimal healing approach
   */
  async queryOptimalApproach(errorPattern: {
    type: string;
    message: string;
    severity: string;
    context?: Record<string, any>;
  }): Promise<{
    module: string;
    approach: string;
    confidence: number;
    estimatedTime: number;
    historicalSuccess: number;
    alternatives: Array<{ module: string; approach: string; confidence: number }>;
  } | null> {
    // Generate pattern signature
    const signature = this.generatePatternSignature(errorPattern);
    
    // Check cache first
    const cachedPattern = this.patterns.get(signature);
    
    if (cachedPattern && cachedPattern.successRate >= this.SUCCESS_THRESHOLD) {
      return {
        module: cachedPattern.bestModule,
        approach: cachedPattern.bestApproach,
        confidence: cachedPattern.confidenceScore,
        estimatedTime: cachedPattern.averageHealingTime,
        historicalSuccess: cachedPattern.successRate,
        alternatives: await this.findAlternatives(signature)
      };
    }
    
    // Query similar patterns
    const similarPatterns = await this.findSimilarPatterns(errorPattern);
    
    if (similarPatterns.length === 0) {
      return null;
    }
    
    // Aggregate and rank approaches
    const rankedApproaches = this.rankApproaches(similarPatterns);
    
    if (rankedApproaches.length === 0) {
      return null;
    }
    
    const best = rankedApproaches[0];
    if (!best) {
      throw new Error('No healing approaches found');
    }
    
    return {
      module: best.module,
      approach: best.approach,
      confidence: best.confidence,
      estimatedTime: best.estimatedTime,
      historicalSuccess: best.successRate,
      alternatives: rankedApproaches.slice(1, 4).map(a => ({
        module: a.module,
        approach: a.approach,
        confidence: a.confidence
      }))
    };
  }

  /**
   * Gets performance metrics for all modules
   */
  async getModulePerformanceMetrics(): Promise<Map<string, ModulePerformance>> {
    // Ensure metrics are up to date
    await this.calculateModuleMetrics();
    return new Map(this.moduleStats);
  }

  /**
   * Gets pattern statistics for analysis
   */
  async getPatternStatistics(
    filter?: {
      minOccurrences?: number;
      minSuccessRate?: number;
      errorType?: string;
    }
  ): Promise<PatternStatistics[]> {
    let patterns = Array.from(this.patterns.values());
    
    if (filter) {
      if (filter.minOccurrences) {
        patterns = patterns.filter(p => p.occurrences >= filter.minOccurrences!);
      }
      if (filter.minSuccessRate) {
        patterns = patterns.filter(p => p.successRate >= filter.minSuccessRate!);
      }
      if (filter.errorType) {
        patterns = patterns.filter(p => p.patternId.includes(filter.errorType!));
      }
    }
    
    return patterns.sort((a, b) => b.successRate - a.successRate);
  }

  /**
   * Performs cross-module learning analysis
   */
  async performCrossModuleLearning(): Promise<{
    insights: string[];
    recommendations: Map<string, string[]>;
    optimizations: Array<{ module: string; suggestion: string; impact: number }>;
  }> {
    const insights: string[] = [];
    const recommendations = new Map<string, string[]>();
    const optimizations: Array<{ module: string; suggestion: string; impact: number }> = [];
    
    // Analyze module performance trends
    for (const [moduleName, stats] of this.moduleStats) {
      const successRate = stats.successfulHeals / stats.totalAttempts;
      
      if (successRate < this.SUCCESS_THRESHOLD) {
        // Find patterns where other modules perform better
        const betterModules = await this.findBetterPerformingModules(moduleName);
        
        if (betterModules.length > 0) {
          recommendations.set(moduleName, [
            `Consider delegating to ${betterModules[0]} for better results`,
            `Learn from ${betterModules.join(', ')} implementation patterns`
          ]);
          
          optimizations.push({
            module: moduleName,
            suggestion: `Adopt techniques from ${betterModules[0] || 'unknown'}`,
            impact: (this.moduleStats.get(betterModules[0] || '')?.successfulHeals || 0) / 
                   (this.moduleStats.get(betterModules[0] || '')?.totalAttempts || 1) - successRate
          });
        }
      }
      
      // Identify specialization opportunities
      const topSpecializations = Array.from(stats.specializations.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);
      
      if (topSpecializations.length > 0) {
        insights.push(
          `${moduleName} excels at: ${topSpecializations.map(s => s[0]).join(', ')}`
        );
      }
      
      // Analyze trends
      const trend = this.analyzeTrend(stats.trends.weekly);
      if (trend.direction === 'declining' && trend.significance > 0.1) {
        insights.push(
          `${moduleName} performance declining by ${(trend.significance * 100).toFixed(1)}% weekly`
        );
        
        recommendations.set(moduleName, [
          ...(recommendations.get(moduleName) || []),
          'Review recent changes and rollback if necessary',
          'Increase monitoring and testing coverage'
        ]);
      }
    }
    
    // Identify collaboration opportunities
    const collaborationPairs = await this.identifyCollaborationOpportunities();
    for (const pair of collaborationPairs) {
      insights.push(
        `${pair.module1} and ${pair.module2} could collaborate for ${(pair.potentialImprovement * 100).toFixed(1)}% improvement`
      );
      
      optimizations.push({
        module: `${pair.module1}+${pair.module2}`,
        suggestion: 'Implement ensemble approach',
        impact: pair.potentialImprovement
      });
    }
    
    // Global insights
    const globalSuccessRate = this.calculateGlobalSuccessRate();
    if (globalSuccessRate >= this.SUCCESS_THRESHOLD) {
      insights.push(`✅ System achieving ${(globalSuccessRate * 100).toFixed(1)}% success rate!`);
    } else {
      insights.push(
        `⚠️ System at ${(globalSuccessRate * 100).toFixed(1)}% success rate, ` +
        `${((this.SUCCESS_THRESHOLD - globalSuccessRate) * 100).toFixed(1)}% below target`
      );
    }
    
    return { insights, recommendations, optimizations };
  }

  /**
   * Updates pattern statistics based on new learning entry
   */
  private async updatePatternStatistics(entry: LearningEntry): Promise<void> {
    const signature = this.generatePatternSignature(entry.errorPattern);
    
    let stats = this.patterns.get(signature);
    if (!stats) {
      stats = {
        patternId: signature,
        occurrences: 0,
        successRate: 0,
        averageHealingTime: 0,
        bestApproach: entry.healingAttempt.approach,
        bestModule: entry.healingAttempt.module,
        confidenceScore: 0,
        lastUpdated: new Date()
      };
      this.patterns.set(signature, stats);
    }
    
    // Update statistics
    const prevTotal = stats.occurrences;
    stats.occurrences++;
    
    // Update success rate (moving average)
    stats.successRate = 
      (stats.successRate * prevTotal + (entry.outcome.success ? 1 : 0)) / 
      stats.occurrences;
    
    // Update average healing time
    stats.averageHealingTime = 
      (stats.averageHealingTime * prevTotal + entry.healingAttempt.duration) / 
      stats.occurrences;
    
    // Update best approach if this one performed better
    if (entry.outcome.success && entry.outcome.confidence > stats.confidenceScore) {
      stats.bestApproach = entry.healingAttempt.approach;
      stats.bestModule = entry.healingAttempt.module;
      stats.confidenceScore = entry.outcome.confidence;
    }
    
    stats.lastUpdated = new Date();
    
    // Store in Redis for fast access
    await this.redis.setex(
      `pattern:${signature}`,
      this.CACHE_TTL,
      JSON.stringify(stats)
    );
  }

  /**
   * Updates module performance metrics
   */
  private async updateModulePerformance(entry: LearningEntry): Promise<void> {
    const moduleName = entry.healingAttempt.module;
    
    let perf = this.moduleStats.get(moduleName);
    if (!perf) {
      perf = {
        moduleName,
        totalAttempts: 0,
        successfulHeals: 0,
        averageConfidence: 0,
        averageTime: 0,
        specializations: new Map(),
        trends: {
          daily: [],
          weekly: [],
          monthly: []
        }
      };
      this.moduleStats.set(moduleName, perf);
    }
    
    // Update basic metrics
    const prevTotal = perf.totalAttempts;
    perf.totalAttempts++;
    
    if (entry.outcome.success) {
      perf.successfulHeals++;
    }
    
    // Update averages
    perf.averageConfidence = 
      (perf.averageConfidence * prevTotal + entry.outcome.confidence) / 
      perf.totalAttempts;
    
    perf.averageTime = 
      (perf.averageTime * prevTotal + entry.healingAttempt.duration) / 
      perf.totalAttempts;
    
    // Update specializations
    const errorType = entry.errorPattern.type;
    const specCount = perf.specializations.get(errorType) || 0;
    perf.specializations.set(errorType, specCount + 1);
    
    // Update trends
    const today = new Date().toDateString();
    const dailyKey = `daily:${moduleName}:${today}`;
    const currentDaily = await this.redis.get(dailyKey) || '0';
    await this.redis.setex(
      dailyKey,
      86400, // 24 hours
      String(parseInt(currentDaily) + (entry.outcome.success ? 1 : 0))
    );
    
    // Store in Redis
    await this.redis.setex(
      `module:${moduleName}`,
      this.CACHE_TTL,
      JSON.stringify({
        ...perf,
        specializations: Array.from(perf.specializations.entries())
      })
    );
  }

  /**
   * Publishes learning update to Redis pub/sub
   */
  private async publishLearningUpdate(entry: LearningEntry): Promise<void> {
    try {
      await this.redis.publish(
        'healing:learning:updates',
        JSON.stringify({
          type: 'new_learning',
          entry,
          timestamp: Date.now()
        })
      );
    } catch (error) {
      this.logger.error('Failed to publish learning update', LogContext.DATABASE, { error });
    }
  }

  /**
   * Sets up Redis pub/sub for real-time updates
   */
  private async setupRedisPubSub(): Promise<void> {
    const subscriber = new Redis(config.redis?.url || 'redis://localhost:6379');
    
    subscriber.subscribe('healing:learning:updates', (err) => {
      if (err) {
        this.logger.error('Failed to subscribe to learning updates', LogContext.DATABASE, { error: err });
      }
    });
    
    subscriber.on('message', async (channel, message) => {
      if (channel === 'healing:learning:updates') {
        try {
          const update = JSON.parse(message);
          if (update.type === 'new_learning' && update.entry.id !== this.cache.get(update.entry.id)?.id) {
            // Update local cache with remote learning
            this.cache.set(update.entry.id, update.entry);
            await this.updatePatternStatistics(update.entry);
            await this.updateModulePerformance(update.entry);
          }
        } catch (error) {
          this.logger.error('Failed to process learning update', LogContext.DATABASE, { error });
        }
      }
    });
  }

  /**
   * Batch writes pending entries to storage
   */
  private async batchWriteToStorage(): Promise<void> {
    if (this.pendingWrites.length === 0) return;
    
    const batch = this.pendingWrites.splice(0, this.BATCH_SIZE);
    
    try {
      // Write to Supabase
      const { error } = await this.supabase
        .from('healing_learning')
        .insert(
          batch.map(entry => ({
            id: entry.id,
            timestamp: entry.timestamp,
            error_pattern: entry.errorPattern,
            healing_attempt: entry.healingAttempt,
            outcome: entry.outcome,
            metadata: entry.metadata
          }))
        );
      
      if (error) {
        this.logger.error('Failed to batch write to Supabase', LogContext.DATABASE, { error });
        // Re-add to pending writes
        this.pendingWrites.unshift(...batch);
      } else {
        this.logger.info(`Batch wrote ${batch.length} learning entries`, LogContext.DATABASE);
      }
      
      // Also store aggregated patterns to context storage
      for (const pattern of this.patterns.values()) {
        if (pattern.occurrences >= this.MIN_PATTERN_OCCURRENCES) {
          await contextStorageService.storeContext({
            content: JSON.stringify(pattern),
            category: 'architecture_patterns',
            source: 'healing-learning-db',
            metadata: {
              type: 'pattern_statistics',
              successRate: pattern.successRate,
              occurrences: pattern.occurrences
            }
          });
        }
      }
    } catch (error) {
      this.logger.error('Failed to batch write', LogContext.DATABASE, { error });
    }
  }

  /**
   * Syncs data to persistent storage
   */
  private async syncToStorage(): Promise<void> {
    await this.batchWriteToStorage();
    
    // Clean up old cache entries
    const cutoff = Date.now() - (this.CACHE_TTL * 1000);
    for (const [id, entry] of this.cache) {
      if (entry.timestamp.getTime() < cutoff) {
        this.cache.delete(id);
      }
    }
  }

  /**
   * Loads historical data from storage
   */
  private async loadHistoricalData(): Promise<void> {
    try {
      // Load recent learning entries from Supabase
      const { data: entries, error } = await this.supabase
        .from('healing_learning')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(1000);
      
      if (error) {
        this.logger.error('Failed to load historical data', LogContext.DATABASE, { error });
        return;
      }
      
      // Process entries to build patterns and stats
      for (const entry of entries || []) {
        const learningEntry: LearningEntry = {
          id: entry.id as string,
          timestamp: new Date(entry.timestamp as string),
          errorPattern: entry.error_pattern as { type: string; message: string; severity: string; context: Record<string, any>; },
          healingAttempt: entry.healing_attempt as { module: string; approach: string; parameters: Record<string, any>; duration: number; },
          outcome: entry.outcome as { success: boolean; confidence: number; validationPassed: boolean; performanceImpact: number; sideEffects: string[]; },
          metadata: entry.metadata as { environment: string; systemState: Record<string, any>; correlatedErrors: string[]; }
        };
        
        await this.updatePatternStatistics(learningEntry);
        await this.updateModulePerformance(learningEntry);
      }
      
      // Load cached patterns from Redis
      const keys = await this.redis.keys('pattern:*');
      for (const key of keys) {
        const data = await this.redis.get(key);
        if (data) {
          const pattern = JSON.parse(data) as PatternStatistics;
          this.patterns.set(pattern.patternId, pattern);
        }
      }
      
      this.logger.info('Loaded historical data', LogContext.DATABASE, {
        entriesLoaded: entries?.length || 0,
        patternsLoaded: this.patterns.size
      });
    } catch (error) {
      this.logger.error('Failed to load historical data', LogContext.DATABASE, { error });
    }
  }

  // Helper methods
  private generateId(): string {
    return `learn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generatePatternSignature(pattern: {
    type: string;
    message: string;
    severity: string;
  }): string {
    const normalized = `${pattern.type}-${pattern.severity}-${pattern.message.substring(0, 50)}`
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '');
    return normalized;
  }

  private async findSimilarPatterns(
    errorPattern: any
  ): Promise<PatternStatistics[]> {
    const signature = this.generatePatternSignature(errorPattern);
    const similar: PatternStatistics[] = [];
    
    // Use fuzzy matching to find similar patterns
    for (const [id, pattern] of this.patterns) {
      const similarity = this.calculateSimilarity(signature, id);
      if (similarity > 0.7) {
        similar.push(pattern);
      }
    }
    
    return similar.sort((a, b) => b.successRate - a.successRate);
  }

  private calculateSimilarity(sig1: string, sig2: string): number {
    const words1 = sig1.split('-');
    const words2 = sig2.split('-');
    const intersection = words1.filter(w => words2.includes(w));
    const union = [...new Set([...words1, ...words2])];
    return intersection.length / union.length;
  }

  private rankApproaches(patterns: PatternStatistics[]): Array<{
    module: string;
    approach: string;
    confidence: number;
    estimatedTime: number;
    successRate: number;
  }> {
    const approachMap = new Map<string, {
      totalWeight: number;
      totalTime: number;
      occurrences: number;
      successRate: number;
    }>();
    
    for (const pattern of patterns) {
      const key = `${pattern.bestModule}:${pattern.bestApproach}`;
      const existing = approachMap.get(key) || {
        totalWeight: 0,
        totalTime: 0,
        occurrences: 0,
        successRate: 0
      };
      
      const weight = pattern.occurrences * pattern.successRate;
      existing.totalWeight += weight;
      existing.totalTime += pattern.averageHealingTime * pattern.occurrences;
      existing.occurrences += pattern.occurrences;
      existing.successRate = 
        (existing.successRate * (existing.occurrences - pattern.occurrences) + 
         pattern.successRate * pattern.occurrences) / existing.occurrences;
      
      approachMap.set(key, existing);
    }
    
    return Array.from(approachMap.entries())
      .map(([key, stats]) => {
        const [module, approach] = key.split(':');
        return {
          module: module || 'unknown',
          approach: approach || 'default',
          confidence: Math.min(stats.successRate * 1.1, 0.99),
          estimatedTime: stats.totalTime / stats.occurrences,
          successRate: stats.successRate
        };
      })
      .sort((a, b) => b.confidence - a.confidence);
  }

  private async findAlternatives(
    signature: string
  ): Promise<Array<{ module: string; approach: string; confidence: number }>> {
    const alternatives: Array<{ module: string; approach: string; confidence: number }> = [];
    
    // Find patterns with different approaches
    for (const pattern of this.patterns.values()) {
      if (pattern.patternId !== signature && 
          pattern.successRate > 0.8 &&
          this.calculateSimilarity(signature, pattern.patternId) > 0.5) {
        alternatives.push({
          module: pattern.bestModule,
          approach: pattern.bestApproach,
          confidence: pattern.confidenceScore
        });
      }
    }
    
    return alternatives.slice(0, 3);
  }

  private async calculateModuleMetrics(): Promise<void> {
    // Aggregate trends from Redis
    for (const [moduleName, stats] of this.moduleStats) {
      // Get daily trends
      const dailyKeys = await this.redis.keys(`daily:${moduleName}:*`);
      const dailyValues = await Promise.all(
        dailyKeys.slice(-7).map(key => this.redis.get(key))
      );
      stats.trends.daily = dailyValues.map(v => parseInt(v || '0'));
      
      // Calculate weekly trends (last 4 weeks)
      stats.trends.weekly = [];
      for (let i = 0; i < 4; i++) {
        const weekSum = stats.trends.daily
          .slice(i * 7, (i + 1) * 7)
          .reduce((sum, val) => sum + val, 0);
        stats.trends.weekly.push(weekSum);
      }
    }
  }

  private async findBetterPerformingModules(moduleName: string): Promise<string[]> {
    const currentStats = this.moduleStats.get(moduleName);
    if (!currentStats) return [];
    
    const currentSuccess = currentStats.successfulHeals / currentStats.totalAttempts;
    const better: string[] = [];
    
    for (const [name, stats] of this.moduleStats) {
      if (name !== moduleName) {
        const successRate = stats.successfulHeals / stats.totalAttempts;
        if (successRate > currentSuccess + 0.1) {
          better.push(name);
        }
      }
    }
    
    return better.sort((a, b) => {
      const aRate = (this.moduleStats.get(a)?.successfulHeals || 0) / 
                   (this.moduleStats.get(a)?.totalAttempts || 1);
      const bRate = (this.moduleStats.get(b)?.successfulHeals || 0) / 
                   (this.moduleStats.get(b)?.totalAttempts || 1);
      return bRate - aRate;
    });
  }

  private analyzeTrend(data: number[]): {
    direction: 'improving' | 'declining' | 'stable';
    significance: number;
  } {
    if (data.length < 2) {
      return { direction: 'stable', significance: 0 };
    }
    
    // Simple linear regression
    const n = data.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = data.reduce((sum, val) => sum + val, 0);
    const sumXY = data.reduce((sum, val, i) => sum + val * i, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const avgY = sumY / n;
    
    const significance = Math.abs(slope) / (avgY || 1);
    
    if (slope > 0.05) {
      return { direction: 'improving', significance };
    } else if (slope < -0.05) {
      return { direction: 'declining', significance };
    } else {
      return { direction: 'stable', significance };
    }
  }

  private async identifyCollaborationOpportunities(): Promise<Array<{
    module1: string;
    module2: string;
    potentialImprovement: number;
  }>> {
    const opportunities: Array<{
      module1: string;
      module2: string;
      potentialImprovement: number;
    }> = [];
    
    const modules = Array.from(this.moduleStats.keys());
    
    for (let i = 0; i < modules.length; i++) {
      for (let j = i + 1; j < modules.length; j++) {
        const module1 = modules[i];
        const module2 = modules[j];
        
        if (!module1 || !module2) continue;
        
        const stats1 = this.moduleStats.get(module1);
        const stats2 = this.moduleStats.get(module2);
        
        if (!stats1 || !stats2) continue;
        
        // Check if they have complementary specializations
        const specs1 = Array.from(stats1.specializations.keys());
        const specs2 = Array.from(stats2.specializations.keys());
        const overlap = specs1.filter(s => specs2.includes(s));
        
        if (overlap.length < specs1.length * 0.3) {
          // Low overlap means good complementarity
          const combined = (stats1.successfulHeals + stats2.successfulHeals) / 
                          (stats1.totalAttempts + stats2.totalAttempts);
          const individual = Math.max(
            stats1.successfulHeals / stats1.totalAttempts,
            stats2.successfulHeals / stats2.totalAttempts
          );
          
          if (combined > individual) {
            opportunities.push({
              module1,
              module2,
              potentialImprovement: combined - individual
            });
          }
        }
      }
    }
    
    return opportunities.sort((a, b) => b.potentialImprovement - a.potentialImprovement);
  }

  private calculateGlobalSuccessRate(): number {
    let totalAttempts = 0;
    let totalSuccess = 0;
    
    for (const stats of this.moduleStats.values()) {
      totalAttempts += stats.totalAttempts;
      totalSuccess += stats.successfulHeals;
    }
    
    return totalAttempts > 0 ? totalSuccess / totalAttempts : 0;
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown(): Promise<void> {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    
    await this.syncToStorage();
    await this.redis.quit();
    
    this.logger.info('Learning database shutdown complete');
  }
}

// Export singleton instance
export const healingLearningDatabase = new HealingLearningDatabase();
export default healingLearningDatabase;