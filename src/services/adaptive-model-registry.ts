/**
 * Adaptive Model Registry
 * 
 * Manages personalized AI models with intelligent selection and optimization.
 * Provides real-time model adaptation based on user context, device constraints,
 * and task requirements while maintaining Universal AI Tools architecture patterns.
 * 
 * Features:
 * - Personalized model loading and caching
 * - Device-aware model selection with mobile optimization
 * - Task-specific model adaptation
 * - Intelligent parameter optimization integration
 * - Performance monitoring and automatic model updates
 * - Multi-tenant security with RLS compliance
 * - Circuit breaker pattern for resilience
 */

import { EventEmitter } from 'events';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/utils/logger';
import { CircuitBreaker } from '@/utils/circuit-breaker';
import type { ContextStorageService } from './context-storage-service';
import type { IntelligentParameterService } from './intelligent-parameter-service';
import type { VaultService } from './vault-service';
import type { 
  PersonalityModel, 
  PersonalityPerformanceProfile,
  PersonalityRuntimeParameters 
} from './personality-fine-tuning-extension';
import type { UserPersonalityProfile } from './personality-analytics-service';
import { existsSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { performance } from 'perf_hooks';

// =============================================================================
// TYPES AND INTERFACES
// =============================================================================

export interface DeviceContext {
  deviceId: string;
  deviceType: 'iPhone' | 'iPad' | 'AppleWatch' | 'Mac';
  osVersion: string;
  appVersion: string;
  availableMemory: number; // MB
  batteryLevel?: number; // 0-100
  thermalState?: 'nominal' | 'fair' | 'serious' | 'critical';
  networkType?: 'wifi' | 'cellular' | 'offline';
  lastAuthConfidence?: number;
  trustLevel: number; // 0-1
  biometricCapabilities: string[];
  processingCapabilities: {
    coreMLSupport: boolean;
    neuralEngineSupport: boolean;
    mlComputeSupport: boolean;
  };
}

export interface TaskContext {
  type: 'general' | 'code_generation' | 'analysis' | 'creative' | 'technical' | 'personal';
  userRequest: string;
  expectedResponseLength?: 'short' | 'medium' | 'long';
  urgency?: 'low' | 'medium' | 'high';
  complexity?: 'simple' | 'moderate' | 'complex';
  domainExpertise?: string[];
  userContext: {
    userId: string;
    sessionId?: string;
    workingDirectory?: string;
    currentProject?: string;
    recentInteractions?: string[];
  };
}

export interface ModelSelectionCriteria {
  primaryFactor: 'performance' | 'accuracy' | 'battery' | 'memory';
  deviceConstraints: DeviceContext;
  taskRequirements: TaskContext;
  userPreferences: ModelUserPreferences;
  performanceTargets: {
    maxLatencyMs: number;
    maxMemoryMB: number;
    maxBatteryImpact: number; // mAh per hour
    minAccuracy: number; // 0-1
  };
}

export interface ModelUserPreferences {
  preferredResponseStyle: 'concise' | 'detailed' | 'conversational' | 'technical';
  prioritizeSpeed: boolean;
  prioritizeAccuracy: boolean;
  prioritizeBattery: boolean;
  personalityStrength: number; // 0-1, how much personality to apply
  adaptationSensitivity: number; // 0-1, how quickly to adapt
}

export interface AdaptedPersonalityModel extends PersonalityModel {
  adaptationMetadata: {
    selectedForDevice: string;
    selectedForTask: string;
    adaptationTimestamp: Date;
    adaptationReason: string[];
    performancePrediction: {
      estimatedLatency: number;
      estimatedMemoryUsage: number;
      estimatedBatteryImpact: number;
      confidenceScore: number;
    };
  };
  optimizedParameters: PersonalityRuntimeParameters;
}

export interface ModelRegistryCache {
  userId: string;
  model: AdaptedPersonalityModel;
  deviceContext: DeviceContext;
  lastAccessed: Date;
  accessCount: number;
  averageLatency: number;
  successRate: number;
  cacheExpiry: Date;
}

export interface ModelPerformanceMetrics {
  modelId: string;
  userId: string;
  deviceType: string;
  averageLatency: number;
  memoryUsage: number;
  batteryImpact: number;
  accuracyScore: number;
  userSatisfaction: number;
  usageCount: number;
  errorRate: number;
  lastUpdated: Date;
}

export interface ModelUpdateTrigger {
  userId: string;
  modelId: string;
  triggerType: 'performance_degradation' | 'user_feedback' | 'pattern_change' | 'scheduled';
  severity: 'low' | 'medium' | 'high' | 'critical';
  metrics: {
    currentPerformance: number;
    targetPerformance: number;
    performanceDelta: number;
    sampleSize: number;
  };
  recommendedAction: 'retrain' | 'parameter_adjust' | 'model_update' | 'cache_refresh';
}

// =============================================================================
// ADAPTIVE MODEL REGISTRY CLASS
// =============================================================================

export class AdaptiveModelRegistry extends EventEmitter {
  private personalityModels: Map<string, AdaptedPersonalityModel> = new Map();
  private modelCache: Map<string, ModelRegistryCache> = new Map();
  private performanceMetrics: Map<string, ModelPerformanceMetrics[]> = new Map();
  
  private supabase: SupabaseClient;
  private contextStorage: ContextStorageService;
  private intelligentParameterService: IntelligentParameterService;
  private vaultService: VaultService;
  private circuitBreaker: CircuitBreaker;
  
  private readonly modelsPath: string;
  private readonly cacheSize: number;
  private readonly cacheTTL: number; // milliseconds
  private readonly performanceThreshold: number;

  constructor(
    contextStorage: ContextStorageService,
    intelligentParameterService: IntelligentParameterService,
    vaultService: VaultService,
    options?: {
      cacheSize?: number;
      cacheTTL?: number;
      performanceThreshold?: number;
    }
  ) {
    super();
    
    this.contextStorage = contextStorage;
    this.intelligentParameterService = intelligentParameterService;
    this.vaultService = vaultService;
    
    // Configuration
    this.modelsPath = process.env.MLX_MODELS_PATH || join(process.cwd(), 'models', 'personality');
    this.cacheSize = options?.cacheSize || 100;
    this.cacheTTL = options?.cacheTTL || 30 * 60 * 1000; // 30 minutes
    this.performanceThreshold = options?.performanceThreshold || 0.8;
    
    // Initialize Supabase
    this.supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_ANON_KEY || ''
    );
    
    // Initialize circuit breaker
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      resetTimeout: 60000,
      monitoringPeriod: 30000
    });
    
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      logger.info('Initializing Adaptive Model Registry');
      
      // Load vault secrets
      await this.loadVaultSecrets();
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Load existing models
      await this.loadExistingModels();
      
      // Start background tasks
      this.startBackgroundTasks();
      
      logger.info('Adaptive Model Registry initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Adaptive Model Registry:', error);
      throw error;
    }
  }

  private async loadVaultSecrets(): Promise<void> {
    try {
      const supabaseServiceKey = await this.vaultService.getSecret('supabase_service_key');
      if (supabaseServiceKey) {
        this.supabase = createClient(
          process.env.SUPABASE_URL || '',
          supabaseServiceKey
        );
      }
    } catch (error) {
      logger.warn('Could not load some vault secrets:', error);
    }
  }

  private setupEventListeners(): void {
    // Listen for intelligent parameter updates
    this.intelligentParameterService.on('parameters_optimized', (data) => {
      this.handleParameterOptimization(data);
    });

    // Listen for context storage events
    this.contextStorage.on('context_updated', (data) => {
      this.handleContextUpdate(data);
    });

    // Listen for circuit breaker state changes
    this.circuitBreaker.on('stateChange', (state) => {
      logger.info(`Model Registry Circuit Breaker state: ${state}`);
      this.emit('circuit_breaker_state_change', { state });
    });
  }

  private async loadExistingModels(): Promise<void> {
    try {
      const { data, error } = await this.supabase
        .from('personality_models')
        .select('*')
        .eq('status', 'ready');

      if (error) {
        throw error;
      }

      if (data) {
        for (const modelData of data) {
          const model = await this.loadPersonalityModel(modelData);
          if (model) {
            this.personalityModels.set(model.userId, model);
          }
        }
      }

      logger.info(`Loaded ${this.personalityModels.size} personality models`);
    } catch (error) {
      logger.error('Error loading existing models:', error);
    }
  }

  private startBackgroundTasks(): void {
    // Cache cleanup every 10 minutes
    setInterval(() => {
      this.cleanupCache();
    }, 10 * 60 * 1000);

    // Performance monitoring every 5 minutes
    setInterval(() => {
      this.monitorModelPerformance();
    }, 5 * 60 * 1000);

    // Model update checks every hour
    setInterval(() => {
      this.checkForModelUpdates();
    }, 60 * 60 * 1000);
  }

  // =============================================================================
  // CORE MODEL SELECTION AND ADAPTATION
  // =============================================================================

  async getPersonalizedModel(
    userId: string,
    deviceContext: DeviceContext,
    taskContext: TaskContext
  ): Promise<AdaptedPersonalityModel> {
    return await this.circuitBreaker.execute(async () => {
      try {
        const startTime = performance.now();
        
        logger.info(`Getting personalized model for user: ${userId}, device: ${deviceContext.deviceType}`);

        // Check cache first
        const cachedModel = this.getCachedModel(userId, deviceContext, taskContext);
        if (cachedModel) {
          this.updateCacheMetrics(cachedModel, performance.now() - startTime);
          return cachedModel.model;
        }

        // Load or create personality model
        let baseModel = this.personalityModels.get(userId);
        if (!baseModel || this.shouldUpdateModel(baseModel, deviceContext)) {
          baseModel = await this.loadOrCreatePersonalityModel(userId, deviceContext);
          this.personalityModels.set(userId, baseModel);
        }

        // Apply context-specific adaptations
        const adaptedModel = await this.adaptModelForTask(baseModel, deviceContext, taskContext);

        // Cache the adapted model
        this.cacheAdaptedModel(userId, adaptedModel, deviceContext);

        // Track performance metrics
        const processingTime = performance.now() - startTime;
        await this.recordModelAccess(userId, adaptedModel.id, deviceContext.deviceType, processingTime);

        // Emit selection event
        this.emit('model_selected', {
          userId,
          modelId: adaptedModel.id,
          deviceType: deviceContext.deviceType,
          taskType: taskContext.type,
          processingTime,
          cacheHit: false
        });

        return adaptedModel;

      } catch (error) {
        logger.error(`Error getting personalized model for user ${userId}:`, error);
        throw error;
      }
    });
  }

  private getCachedModel(
    userId: string,
    deviceContext: DeviceContext,
    taskContext: TaskContext
  ): ModelRegistryCache | null {
    const cacheKey = this.generateCacheKey(userId, deviceContext, taskContext);
    const cached = this.modelCache.get(cacheKey);
    
    if (!cached || Date.now() > cached.cacheExpiry.getTime()) {
      if (cached) {
        this.modelCache.delete(cacheKey);
      }
      return null;
    }
    
    // Update access metrics
    cached.lastAccessed = new Date();
    cached.accessCount++;
    
    return cached;
  }

  private async loadOrCreatePersonalityModel(
    userId: string,
    deviceContext: DeviceContext
  ): Promise<AdaptedPersonalityModel> {
    try {
      // Try to load existing model
      const { data, error } = await this.supabase
        .from('personality_models')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'ready')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        const model = await this.loadPersonalityModel(data);
        if (model) {
          return model;
        }
      }

      // No model found, request creation
      logger.info(`No personality model found for user ${userId}, requesting creation`);
      
      this.emit('personality_model_creation_requested', {
        userId,
        deviceContext,
        reason: 'no_existing_model'
      });

      // Return a default adapted model while waiting for training
      return this.createDefaultPersonalityModel(userId, deviceContext);

    } catch (error) {
      logger.error(`Error loading/creating personality model for user ${userId}:`, error);
      throw error;
    }
  }

  private async adaptModelForTask(
    baseModel: AdaptedPersonalityModel,
    deviceContext: DeviceContext,
    taskContext: TaskContext
  ): Promise<AdaptedPersonalityModel> {
    try {
      // Get intelligent parameters for this specific context
      const optimizedParams = await this.intelligentParameterService.getOptimalParameters({
        model: baseModel.modelId,
        taskType: taskContext.type,
        userContext: taskContext.userContext,
        deviceContext: {
          deviceType: deviceContext.deviceType,
          availableMemory: deviceContext.availableMemory,
          batteryLevel: deviceContext.batteryLevel,
          thermalState: deviceContext.thermalState
        },
        personalityContext: {
          communicationStyle: baseModel.personalityProfile.communicationStyle,
          expertiseAreas: baseModel.personalityProfile.expertiseAreas,
          satisfactionScore: baseModel.personalityProfile.satisfactionScore
        },
        performanceGoals: ['personality_consistency', 'response_quality', 'mobile_performance']
      });

      // Apply device-specific optimizations
      const deviceOptimizedParams = this.applyDeviceOptimizations(
        optimizedParams,
        deviceContext,
        baseModel.mobileOptimizations
      );

      // Apply task-specific adaptations
      const taskAdaptedParams = this.applyTaskAdaptations(
        deviceOptimizedParams,
        taskContext,
        baseModel.personalityProfile
      );

      // Create adapted model
      const adaptedModel: AdaptedPersonalityModel = {
        ...baseModel,
        optimizedParameters: taskAdaptedParams,
        adaptationMetadata: {
          selectedForDevice: deviceContext.deviceType,
          selectedForTask: taskContext.type,
          adaptationTimestamp: new Date(),
          adaptationReason: [
            `Device: ${deviceContext.deviceType}`,
            `Task: ${taskContext.type}`,
            `Memory: ${deviceContext.availableMemory}MB`,
            `Battery: ${deviceContext.batteryLevel || 'unknown'}%`
          ],
          performancePrediction: await this.predictModelPerformance(
            baseModel,
            deviceContext,
            taskAdaptedParams
          )
        }
      };

      return adaptedModel;

    } catch (error) {
      logger.error('Error adapting model for task:', error);
      // Return base model if adaptation fails
      return {
        ...baseModel,
        adaptationMetadata: {
          selectedForDevice: deviceContext.deviceType,
          selectedForTask: taskContext.type,
          adaptationTimestamp: new Date(),
          adaptationReason: ['Adaptation failed, using base model'],
          performancePrediction: {
            estimatedLatency: 2000,
            estimatedMemoryUsage: 512,
            estimatedBatteryImpact: 10,
            confidenceScore: 0.5
          }
        },
        optimizedParameters: baseModel.runtimeParameters
      };
    }
  }

  // =============================================================================
  // OPTIMIZATION AND ADAPTATION METHODS
  // =============================================================================

  private applyDeviceOptimizations(
    baseParams: any,
    deviceContext: DeviceContext,
    mobileConfig: any
  ): PersonalityRuntimeParameters {
    const optimized = { ...baseParams };

    // Device-specific optimizations
    switch (deviceContext.deviceType) {
      case 'AppleWatch':
        optimized.maxTokens = Math.min(optimized.maxTokens, 100); // Very short responses
        optimized.temperature = Math.max(optimized.temperature - 0.1, 0.1); // More deterministic
        optimized.contextWindowSize = 1024; // Smaller context window
        break;

      case 'iPhone':
        optimized.maxTokens = Math.min(optimized.maxTokens, 200);
        if (deviceContext.batteryLevel && deviceContext.batteryLevel < 20) {
          optimized.temperature = Math.max(optimized.temperature - 0.2, 0.1);
          optimized.maxTokens = Math.min(optimized.maxTokens, 150);
        }
        break;

      case 'iPad':
        // iPad can handle more processing
        optimized.maxTokens = Math.min(optimized.maxTokens, 400);
        optimized.contextWindowSize = 2048;
        break;

      case 'Mac':
        // Mac has the most resources
        optimized.contextWindowSize = 4096;
        break;
    }

    // Thermal state adjustments
    if (deviceContext.thermalState === 'critical' || deviceContext.thermalState === 'serious') {
      optimized.temperature = Math.max(optimized.temperature - 0.3, 0.1);
      optimized.maxTokens = Math.min(optimized.maxTokens * 0.7, optimized.maxTokens);
    }

    // Memory constraints
    if (deviceContext.availableMemory < 512) {
      optimized.contextWindowSize = Math.min(optimized.contextWindowSize, 1024);
      optimized.personalityWeight = Math.max(optimized.personalityWeight - 0.2, 0.2);
    }

    return optimized as PersonalityRuntimeParameters;
  }

  private applyTaskAdaptations(
    baseParams: PersonalityRuntimeParameters,
    taskContext: TaskContext,
    personalityProfile: UserPersonalityProfile
  ): PersonalityRuntimeParameters {
    const adapted = { ...baseParams };

    // Task type specific adaptations
    switch (taskContext.type) {
      case 'code_generation':
        adapted.temperature = 0.3; // More deterministic for code
        adapted.repetitionPenalty = 1.2;
        adapted.personalityWeight = 0.4; // Less personality, more accuracy
        break;

      case 'creative':
        adapted.temperature = 0.8; // More creative
        adapted.topP = 0.95;
        adapted.personalityWeight = 0.9; // Strong personality for creativity
        break;

      case 'technical':
        adapted.temperature = 0.4;
        adapted.personalityWeight = 0.5;
        adapted.responseStyleWeight = 0.9; // Strong technical style
        break;

      case 'personal':
        adapted.personalityWeight = 1.0; // Maximum personality
        adapted.biometricAdaptation = 0.8; // High biometric adaptation
        break;

      default: // general
        // Use base parameters
        break;
    }

    // Urgency adaptations
    if (taskContext.urgency === 'high') {
      adapted.maxTokens = Math.min(adapted.maxTokens, 150);
      adapted.temperature = Math.max(adapted.temperature - 0.1, 0.1);
    }

    // Complexity adaptations
    if (taskContext.complexity === 'complex') {
      adapted.contextWindowSize = Math.max(adapted.contextWindowSize, 2048);
      adapted.maxTokens = Math.max(adapted.maxTokens, 300);
    }

    // Response length preferences
    if (taskContext.expectedResponseLength === 'short') {
      adapted.maxTokens = Math.min(adapted.maxTokens, 100);
    } else if (taskContext.expectedResponseLength === 'long') {
      adapted.maxTokens = Math.max(adapted.maxTokens, 400);
    }

    return adapted;
  }

  // =============================================================================
  // PERFORMANCE MONITORING AND MODEL MANAGEMENT
  // =============================================================================

  private async predictModelPerformance(
    model: AdaptedPersonalityModel,
    deviceContext: DeviceContext,
    parameters: PersonalityRuntimeParameters
  ): Promise<{
    estimatedLatency: number;
    estimatedMemoryUsage: number;
    estimatedBatteryImpact: number;
    confidenceScore: number;
  }> {
    try {
      // Get historical performance data
      const historicalData = await this.getHistoricalPerformance(
        model.userId,
        deviceContext.deviceType
      );

      // Base predictions on model characteristics
      let estimatedLatency = model.performanceProfile[`${deviceContext.deviceType.toLowerCase()}Latency` as keyof PersonalityPerformanceProfile] as number || 1500;
      let estimatedMemoryUsage = model.performanceProfile.memoryConstraints[deviceContext.deviceType] || 512;
      let estimatedBatteryImpact = model.performanceProfile.batteryImpact[deviceContext.deviceType] || 8;

      // Adjust based on parameters
      if (parameters.maxTokens > 200) {
        estimatedLatency *= 1.3;
        estimatedMemoryUsage *= 1.2;
        estimatedBatteryImpact *= 1.4;
      }

      if (parameters.contextWindowSize > 2048) {
        estimatedLatency *= 1.2;
        estimatedMemoryUsage *= 1.5;
      }

      // Adjust based on device state
      if (deviceContext.thermalState === 'serious' || deviceContext.thermalState === 'critical') {
        estimatedLatency *= 1.5;
      }

      if (deviceContext.availableMemory < 512) {
        estimatedLatency *= 1.3;
      }

      // Calculate confidence based on historical data availability
      const confidenceScore = historicalData.length > 10 ? 0.9 : 
                             historicalData.length > 5 ? 0.7 : 0.5;

      return {
        estimatedLatency: Math.round(estimatedLatency),
        estimatedMemoryUsage: Math.round(estimatedMemoryUsage),
        estimatedBatteryImpact: Math.round(estimatedBatteryImpact),
        confidenceScore
      };

    } catch (error) {
      logger.error('Error predicting model performance:', error);
      return {
        estimatedLatency: 2000,
        estimatedMemoryUsage: 512,
        estimatedBatteryImpact: 10,
        confidenceScore: 0.3
      };
    }
  }

  private shouldUpdateModel(
    model: AdaptedPersonalityModel,
    deviceContext: DeviceContext
  ): boolean {
    // Check if model is outdated
    const daysSinceUpdate = (Date.now() - model.updatedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceUpdate > 7) {
      return true;
    }

    // Check performance metrics
    const recentMetrics = this.getRecentPerformanceMetrics(model.userId, deviceContext.deviceType);
    if (recentMetrics && recentMetrics.averageLatency > 3000) {
      return true;
    }

    // Check if device capabilities have changed significantly
    const supportedDevices = model.deviceTargets.map(d => d.deviceType);
    if (!supportedDevices.includes(deviceContext.deviceType)) {
      return true;
    }

    return false;
  }

  // =============================================================================
  // CACHE MANAGEMENT
  // =============================================================================

  private generateCacheKey(
    userId: string,
    deviceContext: DeviceContext,
    taskContext: TaskContext
  ): string {
    const keyComponents = [
      userId,
      deviceContext.deviceType,
      deviceContext.osVersion,
      taskContext.type,
      taskContext.complexity || 'moderate',
      Math.floor(deviceContext.availableMemory / 100) * 100 // Round to nearest 100MB
    ];
    
    return keyComponents.join('|');
  }

  private cacheAdaptedModel(
    userId: string,
    model: AdaptedPersonalityModel,
    deviceContext: DeviceContext
  ): void {
    const cacheKey = this.generateCacheKey(
      userId,
      deviceContext,
      { type: 'general', userRequest: '', userContext: { userId } }
    );

    // Clean cache if at capacity
    if (this.modelCache.size >= this.cacheSize) {
      this.evictOldestCacheEntry();
    }

    const cacheEntry: ModelRegistryCache = {
      userId,
      model,
      deviceContext,
      lastAccessed: new Date(),
      accessCount: 1,
      averageLatency: 0,
      successRate: 1.0,
      cacheExpiry: new Date(Date.now() + this.cacheTTL)
    };

    this.modelCache.set(cacheKey, cacheEntry);
  }

  private evictOldestCacheEntry(): void {
    let oldestKey = '';
    let oldestTime = Date.now();

    for (const [key, entry] of this.modelCache.entries()) {
      if (entry.lastAccessed.getTime() < oldestTime) {
        oldestTime = entry.lastAccessed.getTime();
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.modelCache.delete(oldestKey);
    }
  }

  private cleanupCache(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.modelCache.entries()) {
      if (now > entry.cacheExpiry.getTime()) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.modelCache.delete(key);
    }

    if (expiredKeys.length > 0) {
      logger.info(`Cleaned up ${expiredKeys.length} expired cache entries`);
    }
  }

  // =============================================================================
  // UTILITY AND HELPER METHODS
  // =============================================================================

  private async loadPersonalityModel(data: any): Promise<AdaptedPersonalityModel | null> {
    try {
      // Verify model file exists
      if (!existsSync(data.model_path)) {
        logger.warn(`Model file not found: ${data.model_path}`);
        return null;
      }

      // Load personality profile
      const { data: profileData, error } = await this.supabase
        .from('user_personality_profiles')
        .select('*')
        .eq('user_id', data.user_id)
        .single();

      if (error) {
        logger.error('Error loading personality profile:', error);
        return null;
      }

      const model: AdaptedPersonalityModel = {
        id: data.id,
        userId: data.user_id,
        modelId: data.model_name,
        modelPath: data.model_path,
        personalityProfile: this.mapDatabaseToProfile(profileData),
        mobileOptimizations: data.mobile_optimizations || {},
        deviceTargets: data.device_targets || [],
        trainingMetrics: {
          personalityConsistency: 0.8,
          adaptationAccuracy: 0.75,
          biometricCorrelationScore: 0.6,
          deviceOptimizationScore: 0.9,
          userSatisfactionPrediction: 0.8,
          modelSize: data.model_size_mb || 250,
          inferenceLatency: data.average_latency_ms || 1500,
          memoryUsage: data.memory_usage_mb || 512,
          batteryImpactScore: data.battery_impact_score || 0.3
        },
        performanceProfile: this.generateDefaultPerformanceProfile(),
        runtimeParameters: this.generateDefaultRuntimeParameters(),
        status: data.status,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
        adaptationMetadata: {
          selectedForDevice: 'default',
          selectedForTask: 'general',
          adaptationTimestamp: new Date(),
          adaptationReason: ['Initial load'],
          performancePrediction: {
            estimatedLatency: 1500,
            estimatedMemoryUsage: 512,
            estimatedBatteryImpact: 8,
            confidenceScore: 0.7
          }
        },
        optimizedParameters: this.generateDefaultRuntimeParameters()
      };

      return model;
    } catch (error) {
      logger.error('Error loading personality model:', error);
      return null;
    }
  }

  private createDefaultPersonalityModel(
    userId: string,
    deviceContext: DeviceContext
  ): AdaptedPersonalityModel {
    return {
      id: `default-${userId}`,
      userId,
      modelId: 'default-personality',
      modelPath: '/default/path',
      personalityProfile: this.generateDefaultPersonalityProfile(userId),
      mobileOptimizations: {},
      deviceTargets: [],
      trainingMetrics: {
        personalityConsistency: 0.5,
        adaptationAccuracy: 0.5,
        biometricCorrelationScore: 0.0,
        deviceOptimizationScore: 0.5,
        userSatisfactionPrediction: 0.6,
        modelSize: 200,
        inferenceLatency: 2000,
        memoryUsage: 400,
        batteryImpactScore: 0.4
      },
      performanceProfile: this.generateDefaultPerformanceProfile(),
      runtimeParameters: this.generateDefaultRuntimeParameters(),
      status: 'ready',
      createdAt: new Date(),
      updatedAt: new Date(),
      adaptationMetadata: {
        selectedForDevice: deviceContext.deviceType,
        selectedForTask: 'general',
        adaptationTimestamp: new Date(),
        adaptationReason: ['Default model - no trained model available'],
        performancePrediction: {
          estimatedLatency: 2000,
          estimatedMemoryUsage: 400,
          estimatedBatteryImpact: 10,
          confidenceScore: 0.4
        }
      },
      optimizedParameters: this.generateDefaultRuntimeParameters()
    };
  }

  // Event handlers and additional methods...
  private async handleParameterOptimization(data: any): Promise<void> {
    if (data.userId && this.personalityModels.has(data.userId)) {
      logger.info(`Parameter optimization completed for user: ${data.userId}`);
      // Invalidate cache to force re-adaptation with new parameters
      this.invalidateUserCache(data.userId);
    }
  }

  private handleContextUpdate(data: any): void {
    if (data.userId) {
      // Context update might affect model selection
      this.invalidateUserCache(data.userId);
    }
  }

  private invalidateUserCache(userId: string): void {
    const keysToDelete: string[] = [];
    for (const [key, entry] of this.modelCache.entries()) {
      if (entry.userId === userId) {
        keysToDelete.push(key);
      }
    }
    
    for (const key of keysToDelete) {
      this.modelCache.delete(key);
    }
    
    if (keysToDelete.length > 0) {
      logger.info(`Invalidated ${keysToDelete.length} cache entries for user: ${userId}`);
    }
  }

  private updateCacheMetrics(cached: ModelRegistryCache, latency: number): void {
    cached.averageLatency = (cached.averageLatency * (cached.accessCount - 1) + latency) / cached.accessCount;
  }

  private async recordModelAccess(
    userId: string,
    modelId: string,
    deviceType: string,
    processingTime: number
  ): Promise<void> {
    try {
      // Record access metrics for performance monitoring
      const metricsKey = `${userId}:${deviceType}`;
      let metrics = this.performanceMetrics.get(metricsKey) || [];
      
      const newMetric: ModelPerformanceMetrics = {
        modelId,
        userId,
        deviceType,
        averageLatency: processingTime,
        memoryUsage: 0, // Would be measured in real implementation
        batteryImpact: 0, // Would be measured in real implementation
        accuracyScore: 0, // Would be calculated based on feedback
        userSatisfaction: 0, // Would be based on user feedback
        usageCount: 1,
        errorRate: 0,
        lastUpdated: new Date()
      };
      
      metrics.push(newMetric);
      
      // Keep only recent metrics (last 100 entries)
      if (metrics.length > 100) {
        metrics = metrics.slice(-100);
      }
      
      this.performanceMetrics.set(metricsKey, metrics);
    } catch (error) {
      logger.error('Error recording model access:', error);
    }
  }

  private getRecentPerformanceMetrics(userId: string, deviceType: string): ModelPerformanceMetrics | null {
    const metricsKey = `${userId}:${deviceType}`;
    const metrics = this.performanceMetrics.get(metricsKey);
    
    if (!metrics || metrics.length === 0) {
      return null;
    }
    
    // Return most recent metric
    return metrics[metrics.length - 1];
  }

  private async getHistoricalPerformance(userId: string, deviceType: string): Promise<ModelPerformanceMetrics[]> {
    const metricsKey = `${userId}:${deviceType}`;
    return this.performanceMetrics.get(metricsKey) || [];
  }

  private async monitorModelPerformance(): Promise<void> {
    // Monitor performance and trigger updates if needed
    for (const [key, metrics] of this.performanceMetrics.entries()) {
      const [userId, deviceType] = key.split(':');
      const recentMetrics = metrics.slice(-10); // Last 10 entries
      
      if (recentMetrics.length >= 5) {
        const avgLatency = recentMetrics.reduce((sum, m) => sum + m.averageLatency, 0) / recentMetrics.length;
        
        if (avgLatency > 3000) { // 3 second threshold
          this.emit('model_performance_degradation', {
            userId,
            deviceType,
            averageLatency: avgLatency,
            sampleSize: recentMetrics.length
          });
        }
      }
    }
  }

  private async checkForModelUpdates(): Promise<void> {
    // Check if any models need updates
    for (const [userId, model] of this.personalityModels.entries()) {
      const daysSinceUpdate = (Date.now() - model.updatedAt.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysSinceUpdate > 30) { // 30 days
        this.emit('model_update_required', {
          userId,
          modelId: model.id,
          reason: 'scheduled_update',
          daysSinceUpdate
        });
      }
    }
  }

  // Default generation methods...
  private mapDatabaseToProfile(data: any): UserPersonalityProfile {
    return {
      id: data.id,
      userId: data.user_id,
      communicationStyle: data.communication_style,
      expertiseAreas: data.expertise_areas || [],
      responsePatterns: data.response_patterns || {},
      interactionHistory: data.interaction_history || {},
      biometricPatterns: data.biometric_patterns || {},
      devicePreferences: data.device_preferences || {},
      temporalPatterns: data.temporal_patterns || {},
      personalityVector: data.personality_vector,
      currentModelPath: data.current_model_path,
      modelVersion: data.model_version,
      satisfactionScore: data.satisfaction_score,
      consistencyScore: data.consistency_score,
      adaptationRate: data.adaptation_rate,
      lastInteraction: data.last_interaction ? new Date(data.last_interaction) : undefined,
      lastUpdated: new Date(data.last_updated),
      createdAt: new Date(data.created_at),
      privacySettings: data.privacy_settings,
      securityLevel: data.security_level
    };
  }

  private generateDefaultPersonalityProfile(userId: string): UserPersonalityProfile {
    return {
      id: `default-${userId}`,
      userId,
      communicationStyle: 'conversational',
      expertiseAreas: ['general'],
      responsePatterns: {},
      interactionHistory: {},
      biometricPatterns: {},
      devicePreferences: {},
      temporalPatterns: {},
      modelVersion: '1.0',
      satisfactionScore: 3.0,
      consistencyScore: 0.5,
      adaptationRate: 0.1,
      lastUpdated: new Date(),
      createdAt: new Date(),
      privacySettings: {
        biometricLearning: true,
        patternAnalysis: true,
        modelTraining: true,
        dataRetentionDays: 90
      },
      securityLevel: 'enhanced'
    };
  }

  private generateDefaultPerformanceProfile(): PersonalityPerformanceProfile {
    return {
      iPhoneLatency: 2000,
      iPadLatency: 1500,
      appleWatchLatency: 3000,
      macLatency: 1000,
      memoryConstraints: {
        iPhone: 512,
        iPad: 1024,
        AppleWatch: 256,
        Mac: 2048
      },
      batteryImpact: {
        iPhone: 8,
        iPad: 12,
        AppleWatch: 4,
        Mac: 20
      },
      thermalProfile: {
        peakTemperature: 45,
        sustainedPerformance: true
      }
    };
  }

  private generateDefaultRuntimeParameters(): PersonalityRuntimeParameters {
    return {
      temperature: 0.7,
      topP: 0.9,
      maxTokens: 200,
      repetitionPenalty: 1.1,
      personalityWeight: 0.6,
      biometricAdaptation: 0.3,
      contextWindowSize: 2048,
      responseStyleWeight: 0.5
    };
  }
}

export default AdaptiveModelRegistry;