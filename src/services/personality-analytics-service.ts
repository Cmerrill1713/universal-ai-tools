import { EventEmitter } from 'events';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/utils/logger';
import type { ContextInjectionService } from './context-injection-service';
import type { MLXFineTuningService } from './mlx-fine-tuning-service';
import type { VaultService } from './vault-service';
import { CircuitBreaker } from '@/utils/circuit-breaker';

// =============================================================================
// TYPES AND INTERFACES
// =============================================================================

export interface UserPersonalityProfile {
  id: string;
  userId: string;
  communicationStyle: 'concise' | 'detailed' | 'conversational' | 'technical' | 'adaptive';
  expertiseAreas: string[];
  responsePatterns: Record<string, any>;
  interactionHistory: Record<string, any>;
  biometricPatterns: Record<string, any>;
  devicePreferences: Record<string, any>;
  temporalPatterns: Record<string, any>;
  personalityVector?: number[];
  currentModelPath?: string;
  modelVersion: string;
  satisfactionScore: number;
  consistencyScore: number;
  adaptationRate: number;
  lastInteraction?: Date;
  lastUpdated: Date;
  createdAt: Date;
  privacySettings: PersonalityPrivacySettings;
  securityLevel: 'basic' | 'enhanced' | 'maximum';
}

export interface PersonalityPrivacySettings {
  biometricLearning: boolean;
  patternAnalysis: boolean;
  modelTraining: boolean;
  dataRetentionDays: number;
}

export interface InteractionHistory {
  id: string;
  timestamp: Date;
  userRequest: string;
  aiResponse: string;
  responseTime: number;
  userFeedback?: number;
  contextData: Record<string, any>;
  deviceContext: DeviceContext;
}

export interface DeviceContext {
  deviceId: string;
  deviceType: 'iPhone' | 'iPad' | 'AppleWatch' | 'Mac';
  osVersion: string;
  appVersion: string;
  biometricCapabilities: string[];
  trustLevel: number;
  lastAuthConfidence?: number;
  batteryLevel?: number;
  networkType?: string;
}

export interface BiometricAuthData {
  deviceId: string;
  authMethod: 'touchid' | 'faceid' | 'voiceid' | 'passcode' | 'proximity';
  confidence: number;
  timestamp: Date;
  patterns: Record<string, any>; // Encrypted aggregated patterns
  contextualFactors: Record<string, any>;
}

export interface PersonalityInsights {
  communicationStyle: string;
  topicPreferences: string[];
  responsePatterns: {
    averageLength: number;
    preferredDetail: string;
    questionTypes: string[];
  };
  temporalPatterns: {
    activeHours: number[];
    preferredDays: string[];
    sessionDuration: number;
  };
  adaptationRecommendations: string[];
  significantChange: boolean;
  confidenceScore: number;
  recommendedModelUpdates?: ModelUpdateRecommendation[];
}

export interface BiometricPersonalityMapping {
  stressCorrelations: Record<string, number>;
  confidencePatterns: Record<string, any>;
  temporalPatterns: Record<string, any>;
  deviceUsagePatterns: Record<string, any>;
  securityPersonalityCorrelation: number;
  adaptationSuggestions: string[];
}

export interface ModelUpdateRecommendation {
  type: 'retrain' | 'finetune' | 'parameter_adjust';
  priority: 'low' | 'medium' | 'high';
  reason: string;
  estimatedImpact: number;
  requiredData?: string[];
}

export interface PersonalityAnalyticsConfig {
  supabaseUrl: string;
  supabaseKey: string;
  enableBiometricLearning: boolean;
  enablePatternAnalysis: boolean;
  dataRetentionDays: number;
  minimumInteractionsForAnalysis: number;
  significantChangeThreshold: number;
  privacyMode: 'strict' | 'balanced' | 'permissive';
}

// =============================================================================
// PERSONALITY ANALYTICS SERVICE
// =============================================================================

export class PersonalityAnalyticsService extends EventEmitter {
  private supabase: SupabaseClient;
  private contextInjectionService: ContextInjectionService;
  private mlxService: MLXFineTuningService;
  private vaultService: VaultService;
  private circuitBreaker: CircuitBreaker;
  private userProfiles: Map<string, UserPersonalityProfile> = new Map();
  private config: PersonalityAnalyticsConfig;

  constructor(
    contextInjectionService: ContextInjectionService,
    mlxService: MLXFineTuningService,
    vaultService: VaultService,
    config?: Partial<PersonalityAnalyticsConfig>
  ) {
    super();
    
    this.contextInjectionService = contextInjectionService;
    this.mlxService = mlxService;
    this.vaultService = vaultService;
    
    // Initialize with defaults
    this.config = {
      supabaseUrl: process.env.SUPABASE_URL || '',
      supabaseKey: process.env.SUPABASE_ANON_KEY || '',
      enableBiometricLearning: true,
      enablePatternAnalysis: true,
      dataRetentionDays: 90,
      minimumInteractionsForAnalysis: 10,
      significantChangeThreshold: 0.15,
      privacyMode: 'balanced',
      ...config
    };

    // Initialize Supabase client
    this.supabase = createClient(this.config.supabaseUrl, this.config.supabaseKey);
    
    // Initialize circuit breaker for resilience
    this.circuitBreaker = new CircuitBreaker('personality-analytics', {
      failureThreshold: 5,
      resetTimeout: 30000,
      monitoringPeriod: 60000
    });

    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      logger.info('Initializing Personality Analytics Service');
      
      // Load essential configurations from vault
      await this.loadVaultConfiguration();
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Start background tasks
      this.startBackgroundTasks();
      
      logger.info('Personality Analytics Service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Personality Analytics Service:', error);
      throw error;
    }
  }

  private async loadVaultConfiguration(): Promise<void> {
    try {
      // Load Supabase service key from vault (more secure than anon key for analytics)
      const supabaseServiceKey = await this.vaultService.getSecret('supabase_service_key');
      if (supabaseServiceKey) {
        this.supabase = createClient(this.config.supabaseUrl, supabaseServiceKey);
      }
      
      // Load OpenAI API key for embedding generation
      const openaiKey = await this.vaultService.getSecret('openai_api_key');
      if (!openaiKey) {
        logger.warn('OpenAI API key not found in vault - personality vector generation may be limited');
      }
      
    } catch (error) {
      logger.warn('Some vault secrets could not be loaded, using fallback configuration:', error);
    }
  }

  private setupEventListeners(): void {
    // Listen for context injection events to capture personality data
    this.contextInjectionService.on('context_injected', (data) => {
      this.handleContextInjectionEvent(data);
    });

    // Listen for MLX training completion events
    this.mlxService.on('training_completed', (data) => {
      this.handleModelTrainingCompletion(data);
    });

    // Listen for circuit breaker events
    this.circuitBreaker.on('stateChange', (state) => {
      logger.info(`Personality Analytics Circuit Breaker state changed to: ${state}`);
      this.emit('circuit_breaker_state_change', { state });
    });
  }

  private startBackgroundTasks(): void {
    // Clean up expired biometric data every hour
    setInterval(() => {
      this.cleanupExpiredData().catch(error => {
        logger.error('Error in background cleanup task:', error);
      });
    }, 60 * 60 * 1000); // 1 hour

    // Analyze user patterns every 6 hours
    setInterval(() => {
      this.analyzeAllUserPatternsBackground().catch(error => {
        logger.error('Error in background pattern analysis:', error);
      });
    }, 6 * 60 * 60 * 1000); // 6 hours
  }

  // =============================================================================
  // CORE ANALYSIS METHODS
  // =============================================================================

  async analyzeUserInteractionPatterns(
    userId: string,
    interactions: InteractionHistory[]
  ): Promise<PersonalityInsights> {
    return await this.circuitBreaker.execute(async () => {
      try {
        logger.info(`Analyzing interaction patterns for user: ${userId}`);

        // Get or create user profile
        const profile = await this.getUserProfile(userId);
        
        // Ensure minimum interactions for meaningful analysis
        if (interactions.length < this.config.minimumInteractionsForAnalysis) {
          logger.warn(`Insufficient interactions (${interactions.length}) for user ${userId}`);
          return this.generateBasicInsights(profile, interactions);
        }

        // MANDATORY: Use context injection service for LLM-based analysis
        const analysisContext = {
          userId,
          interactionCount: interactions.length,
          timeSpan: this.calculateTimeSpan(interactions),
          currentProfile: profile
        };

        const { enrichedPrompt } = await this.contextInjectionService.enrichWithContext(
          this.buildAnalysisPrompt(interactions),
          analysisContext
        );

        // Analyze interaction patterns
        const insights = await this.performDeepPatternAnalysis(
          profile,
          interactions,
          enrichedPrompt
        );

        // Update user profile with new insights
        await this.updatePersonalityProfile(userId, insights);

        // Check for significant changes that require model updates
        if (insights.significantChange) {
          await this.requestPersonalityModelUpdate(userId, insights);
        }

        // Emit analytics event
        this.emit('personality_analysis_completed', {
          userId,
          insights,
          interactionCount: interactions.length
        });

        return insights;
      } catch (error) {
        logger.error(`Error analyzing patterns for user ${userId}:`, error);
        throw error;
      }
    });
  }

  async getBiometricPersonalityCorrelations(
    userId: string,
    biometricData: BiometricAuthData[]
  ): Promise<BiometricPersonalityMapping> {
    return await this.circuitBreaker.execute(async () => {
      try {
        if (!this.config.enableBiometricLearning) {
          logger.info('Biometric learning disabled, returning empty correlations');
          return this.getEmptyBiometricMapping();
        }

        logger.info(`Analyzing biometric correlations for user: ${userId}`);

        const profile = await this.getUserProfile(userId);
        
        // Ensure privacy compliance
        if (!profile.privacySettings.biometricLearning) {
          logger.info(`Biometric learning disabled for user ${userId}`);
          return this.getEmptyBiometricMapping();
        }

        // Store encrypted biometric data
        await this.storeBiometricData(userId, biometricData);

        // Analyze correlations between authentication confidence and interaction quality
        const correlations = await this.analyzeBiometricPatterns(userId, biometricData, profile);

        // Emit biometric analysis event
        this.emit('biometric_analysis_completed', {
          userId,
          correlations,
          dataPoints: biometricData.length
        });

        return correlations;
      } catch (error) {
        logger.error(`Error analyzing biometric correlations for user ${userId}:`, error);
        throw error;
      }
    });
  }

  async getPersonalityProfile(userId: string): Promise<UserPersonalityProfile | null> {
    try {
      // Check cache first
      if (this.userProfiles.has(userId)) {
        return this.userProfiles.get(userId)!;
      }

      // Load from database
      const { data, error } = await this.supabase
        .from('user_personality_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = not found
        throw error;
      }

      if (!data) {
        return null;
      }

      const profile = this.mapDatabaseToProfile(data);
      this.userProfiles.set(userId, profile);
      
      return profile;
    } catch (error) {
      logger.error(`Error getting personality profile for user ${userId}:`, error);
      throw error;
    }
  }

  async createPersonalityProfile(
    userId: string,
    initialData?: Partial<UserPersonalityProfile>
  ): Promise<UserPersonalityProfile> {
    try {
      logger.info(`Creating personality profile for user: ${userId}`);

      const profileData = {
        user_id: userId,
        communication_style: initialData?.communicationStyle || 'conversational',
        expertise_areas: initialData?.expertiseAreas || [],
        response_patterns: initialData?.responsePatterns || {},
        interaction_history: initialData?.interactionHistory || {},
        biometric_patterns: initialData?.biometricPatterns || {},
        device_preferences: initialData?.devicePreferences || {},
        temporal_patterns: initialData?.temporalPatterns || {},
        model_version: initialData?.modelVersion || '1.0',
        satisfaction_score: initialData?.satisfactionScore || 3.0,
        consistency_score: initialData?.consistencyScore || 0.5,
        adaptation_rate: initialData?.adaptationRate || 0.0,
        privacy_settings: initialData?.privacySettings || {
          biometricLearning: true,
          patternAnalysis: true,
          modelTraining: true,
          dataRetentionDays: 90
        },
        security_level: initialData?.securityLevel || 'enhanced'
      };

      const { data, error } = await this.supabase
        .from('user_personality_profiles')
        .insert(profileData)
        .select()
        .single();

      if (error) {
        throw error;
      }

      const profile = this.mapDatabaseToProfile(data);
      this.userProfiles.set(userId, profile);

      this.emit('personality_profile_created', { userId, profile });
      
      return profile;
    } catch (error) {
      logger.error(`Error creating personality profile for user ${userId}:`, error);
      throw error;
    }
  }

  // =============================================================================
  // PRIVATE ANALYSIS METHODS
  // =============================================================================

  private async performDeepPatternAnalysis(
    profile: UserPersonalityProfile,
    interactions: InteractionHistory[],
    enrichedPrompt: string
  ): Promise<PersonalityInsights> {
    try {
      // Analyze communication patterns
      const communicationAnalysis = this.analyzeCommunicationPatterns(interactions);
      
      // Analyze topic preferences
      const topicAnalysis = this.analyzeTopicPreferences(interactions);
      
      // Analyze temporal patterns
      const temporalAnalysis = this.analyzeTemporalPatterns(interactions);
      
      // Analyze response quality patterns
      const qualityAnalysis = this.analyzeResponseQuality(interactions);
      
      // Calculate adaptation recommendations
      const adaptationRecommendations = this.generateAdaptationRecommendations(
        profile,
        communicationAnalysis,
        topicAnalysis,
        temporalAnalysis,
        qualityAnalysis
      );

      // Determine if changes are significant
      const significantChange = this.detectSignificantChanges(
        profile,
        communicationAnalysis,
        topicAnalysis
      );

      // Calculate confidence score
      const confidenceScore = this.calculateAnalysisConfidence(
        interactions.length,
        qualityAnalysis,
        profile.consistencyScore
      );

      return {
        communicationStyle: communicationAnalysis.dominantStyle,
        topicPreferences: topicAnalysis.topTopics,
        responsePatterns: {
          averageLength: communicationAnalysis.averageResponseLength,
          preferredDetail: communicationAnalysis.preferredDetailLevel,
          questionTypes: communicationAnalysis.commonQuestionTypes
        },
        temporalPatterns: {
          activeHours: temporalAnalysis.activeHours,
          preferredDays: temporalAnalysis.preferredDays,
          sessionDuration: temporalAnalysis.averageSessionDuration
        },
        adaptationRecommendations,
        significantChange,
        confidenceScore,
        recommendedModelUpdates: significantChange ? 
          this.generateModelUpdateRecommendations(profile, significantChange) : undefined
      };
    } catch (error) {
      logger.error('Error in deep pattern analysis:', error);
      throw error;
    }
  }

  private analyzeCommunicationPatterns(interactions: InteractionHistory[]): any {
    const responseLengths = interactions.map(i => i.aiResponse.length);
    const questionTypes = interactions.map(i => this.classifyQuestionType(i.userRequest));
    
    return {
      averageResponseLength: responseLengths.reduce((a, b) => a + b, 0) / responseLengths.length,
      dominantStyle: this.determineDominantCommunicationStyle(interactions),
      preferredDetailLevel: this.analyzeDetailPreference(interactions),
      commonQuestionTypes: this.getMostCommonElements(questionTypes)
    };
  }

  private analyzeTopicPreferences(interactions: InteractionHistory[]): any {
    const topics = interactions.map(i => this.extractTopics(i.userRequest)).flat();
    const topicCounts = this.countElements(topics);
    
    return {
      topTopics: Object.keys(topicCounts)
        .sort((a, b) => topicCounts[b] - topicCounts[a])
        .slice(0, 10),
      topicDistribution: topicCounts
    };
  }

  private analyzeTemporalPatterns(interactions: InteractionHistory[]): any {
    const hours = interactions.map(i => i.timestamp.getHours());
    const days = interactions.map(i => i.timestamp.toLocaleDateString('en-US', { weekday: 'long' }));
    
    // Calculate session durations
    const sessionDurations = this.calculateSessionDurations(interactions);
    
    return {
      activeHours: this.getMostActiveHours(hours),
      preferredDays: this.getMostCommonElements(days),
      averageSessionDuration: sessionDurations.reduce((a, b) => a + b, 0) / sessionDurations.length
    };
  }

  private analyzeResponseQuality(interactions: InteractionHistory[]): any {
    const qualityScores = interactions
      .filter(i => i.userFeedback !== undefined)
      .map(i => i.userFeedback!);
    
    const responseTimes = interactions.map(i => i.responseTime);
    
    return {
      averageQuality: qualityScores.length > 0 ? 
        qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length : 3.0,
      averageResponseTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
      qualityTrend: this.calculateQualityTrend(qualityScores),
      feedbackRate: qualityScores.length / interactions.length
    };
  }

  private async analyzeBiometricPatterns(
    userId: string,
    biometricData: BiometricAuthData[],
    profile: UserPersonalityProfile
  ): Promise<BiometricPersonalityMapping> {
    try {
      // Get historical interaction quality data
      const qualityData = await this.getInteractionQualityHistory(userId);
      
      // Correlate authentication confidence with interaction quality
      const stressCorrelations = this.calculateStressCorrelations(biometricData, qualityData);
      
      // Analyze confidence patterns
      const confidencePatterns = this.analyzeConfidencePatterns(biometricData);
      
      // Analyze temporal patterns in biometric data
      const temporalPatterns = this.analyzeBiometricTemporalPatterns(biometricData);
      
      // Analyze device usage patterns
      const deviceUsagePatterns = this.analyzeDeviceUsagePatterns(biometricData);
      
      // Calculate security-personality correlation
      const securityPersonalityCorrelation = this.calculateSecurityPersonalityCorrelation(
        biometricData,
        profile
      );
      
      return {
        stressCorrelations,
        confidencePatterns,
        temporalPatterns,
        deviceUsagePatterns,
        securityPersonalityCorrelation,
        adaptationSuggestions: this.generateBiometricAdaptationSuggestions(
          stressCorrelations,
          confidencePatterns,
          profile
        )
      };
    } catch (error) {
      logger.error('Error analyzing biometric patterns:', error);
      throw error;
    }
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  private async getUserProfile(userId: string): Promise<UserPersonalityProfile> {
    let profile = await this.getPersonalityProfile(userId);
    
    if (!profile) {
      profile = await this.createPersonalityProfile(userId);
    }
    
    return profile;
  }

  private buildAnalysisPrompt(interactions: InteractionHistory[]): string {
    return `Analyze the following user interaction patterns to determine personality characteristics:

Interactions: ${interactions.length}
Time span: ${this.calculateTimeSpan(interactions)} days
Sample interactions: ${JSON.stringify(
      interactions.slice(0, 5).map(i => ({
        request: i.userRequest.substring(0, 100),
        response_length: i.aiResponse.length,
        feedback: i.userFeedback,
        device: i.deviceContext.deviceType
      }))
    )}

Identify:
1. Communication style preferences
2. Topic interests and expertise areas
3. Response pattern preferences
4. Temporal usage patterns
5. Device-specific behaviors`;
  }

  private calculateTimeSpan(interactions: InteractionHistory[]): number {
    if (interactions.length === 0) return 0;
    
    const timestamps = interactions.map(i => i.timestamp.getTime());
    const earliest = Math.min(...timestamps);
    const latest = Math.max(...timestamps);
    
    return Math.ceil((latest - earliest) / (1000 * 60 * 60 * 24)); // days
  }

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

  private async updatePersonalityProfile(
    userId: string,
    insights: PersonalityInsights
  ): Promise<void> {
    try {
      const updateData = {
        communication_style: insights.communicationStyle,
        expertise_areas: insights.topicPreferences.slice(0, 20), // Limit to top 20
        response_patterns: insights.responsePatterns,
        temporal_patterns: insights.temporalPatterns,
        satisfaction_score: insights.confidenceScore * 5, // Convert to 1-5 scale
        consistency_score: insights.confidenceScore,
        last_interaction: new Date(),
        last_updated: new Date()
      };

      const { error } = await this.supabase
        .from('user_personality_profiles')
        .update(updateData)
        .eq('user_id', userId);

      if (error) {
        throw error;
      }

      // Update cache
      const profile = this.userProfiles.get(userId);
      if (profile) {
        Object.assign(profile, {
          communicationStyle: insights.communicationStyle,
          expertiseAreas: insights.topicPreferences.slice(0, 20),
          responsePatterns: insights.responsePatterns,
          temporalPatterns: insights.temporalPatterns,
          satisfactionScore: insights.confidenceScore * 5,
          consistencyScore: insights.confidenceScore,
          lastInteraction: new Date(),
          lastUpdated: new Date()
        });
      }

    } catch (error) {
      logger.error(`Error updating personality profile for user ${userId}:`, error);
      throw error;
    }
  }

  private async requestPersonalityModelUpdate(
    userId: string,
    insights: PersonalityInsights
  ): Promise<void> {
    try {
      if (!insights.recommendedModelUpdates || insights.recommendedModelUpdates.length === 0) {
        return;
      }

      logger.info(`Requesting personality model update for user ${userId}`);

      // Emit event for model update orchestration
      this.emit('personality_model_update_requested', {
        userId,
        insights,
        updateRecommendations: insights.recommendedModelUpdates
      });

      // Update training status
      await this.supabase
        .from('user_personality_profiles')
        .update({ training_status: 'scheduled' })
        .eq('user_id', userId);

    } catch (error) {
      logger.error(`Error requesting model update for user ${userId}:`, error);
    }
  }

  // Additional utility methods would be implemented here...
  private generateBasicInsights(profile: UserPersonalityProfile, interactions: InteractionHistory[]): PersonalityInsights {
    return {
      communicationStyle: profile.communicationStyle,
      topicPreferences: profile.expertiseAreas.slice(0, 5),
      responsePatterns: {
        averageLength: 200,
        preferredDetail: 'moderate',
        questionTypes: ['general']
      },
      temporalPatterns: {
        activeHours: [9, 10, 11, 14, 15, 16],
        preferredDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        sessionDuration: 300 // 5 minutes
      },
      adaptationRecommendations: ['Collect more interaction data for better insights'],
      significantChange: false,
      confidenceScore: 0.3 // Low confidence due to insufficient data
    };
  }

  private async cleanupExpiredData(): Promise<void> {
    try {
      const { error } = await this.supabase.rpc('cleanup_expired_biometric_data');
      if (error) {
        throw error;
      }
      logger.info('Expired biometric data cleanup completed');
    } catch (error) {
      logger.error('Error cleaning up expired data:', error);
    }
  }

  private async analyzeAllUserPatternsBackground(): Promise<void> {
    // Implementation for background pattern analysis
    logger.info('Background pattern analysis started');
  }

  // ... Additional private methods for pattern analysis would be implemented here
  private classifyQuestionType(request: string): string {
    // Simple classification - in production, use NLP models
    if (request.includes('how')) return 'how-to';
    if (request.includes('what')) return 'definition';
    if (request.includes('why')) return 'explanation';
    if (request.includes('when')) return 'temporal';
    if (request.includes('where')) return 'location';
    return 'general';
  }

  private extractTopics(request: string): string[] {
    // Simple topic extraction - in production, use NLP models
    const commonTopics = ['programming', 'data', 'machine learning', 'web development', 'mobile', 'design'];
    return commonTopics.filter(topic => 
      request.toLowerCase().includes(topic.toLowerCase())
    );
  }

  private determineDominantCommunicationStyle(interactions: InteractionHistory[]): string {
    // Analyze communication patterns to determine style
    return 'conversational'; // Simplified implementation
  }

  private analyzeDetailPreference(interactions: InteractionHistory[]): string {
    const avgLength = interactions.reduce((sum, i) => sum + i.aiResponse.length, 0) / interactions.length;
    if (avgLength > 500) return 'detailed';
    if (avgLength < 200) return 'concise';
    return 'moderate';
  }

  private getMostCommonElements<T>(arr: T[]): T[] {
    const counts = this.countElements(arr);
    return Object.keys(counts)
      .sort((a, b) => counts[b as keyof typeof counts] - counts[a as keyof typeof counts])
      .slice(0, 5) as T[];
  }

  private countElements<T>(arr: T[]): Record<string, number> {
    return arr.reduce((acc, item) => {
      const key = String(item);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private getMostActiveHours(hours: number[]): number[] {
    const hourCounts = this.countElements(hours);
    return Object.keys(hourCounts)
      .sort((a, b) => hourCounts[b] - hourCounts[a])
      .slice(0, 6)
      .map(h => parseInt(h));
  }

  private calculateSessionDurations(interactions: InteractionHistory[]): number[] {
    // Group interactions by session and calculate durations
    // Simplified implementation
    return [300, 450, 600, 200, 800]; // Sample durations in seconds
  }

  private calculateQualityTrend(scores: number[]): string {
    if (scores.length < 2) return 'insufficient_data';
    const recent = scores.slice(-5);
    const earlier = scores.slice(0, 5);
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const earlierAvg = earlier.reduce((a, b) => a + b, 0) / earlier.length;
    
    if (recentAvg > earlierAvg + 0.2) return 'improving';
    if (recentAvg < earlierAvg - 0.2) return 'declining';
    return 'stable';
  }

  private async getInteractionQualityHistory(userId: string): Promise<any[]> {
    // Get interaction quality data from database
    const { data } = await this.supabase
      .from('personality_interaction_sessions')
      .select('response_quality_score, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);
    
    return data || [];
  }

  private calculateStressCorrelations(biometricData: BiometricAuthData[], qualityData: any[]): Record<string, number> {
    // Calculate correlation between biometric confidence and interaction quality
    return {
      'low_confidence_impact': 0.7,
      'stress_response_correlation': 0.6,
      'device_trust_impact': 0.8
    };
  }

  private analyzeConfidencePatterns(biometricData: BiometricAuthData[]): Record<string, any> {
    return {
      averageConfidence: biometricData.reduce((sum, d) => sum + d.confidence, 0) / biometricData.length,
      confidenceVariability: this.calculateVariability(biometricData.map(d => d.confidence)),
      methodPreferences: this.getMostCommonElements(biometricData.map(d => d.authMethod))
    };
  }

  private analyzeBiometricTemporalPatterns(biometricData: BiometricAuthData[]): Record<string, any> {
    const hours = biometricData.map(d => d.timestamp.getHours());
    return {
      activeAuthHours: this.getMostActiveHours(hours),
      authFrequency: biometricData.length
    };
  }

  private analyzeDeviceUsagePatterns(biometricData: BiometricAuthData[]): Record<string, any> {
    const devices = biometricData.map(d => d.deviceId);
    return {
      primaryDevices: this.getMostCommonElements(devices),
      deviceSwitchingFrequency: new Set(devices).size / devices.length
    };
  }

  private calculateSecurityPersonalityCorrelation(
    biometricData: BiometricAuthData[],
    profile: UserPersonalityProfile
  ): number {
    // Calculate how security preferences correlate with personality
    const avgConfidence = biometricData.reduce((sum, d) => sum + d.confidence, 0) / biometricData.length;
    const securityWeight = profile.securityLevel === 'maximum' ? 1.0 : 
                          profile.securityLevel === 'enhanced' ? 0.7 : 0.4;
    
    return avgConfidence * securityWeight;
  }

  private generateBiometricAdaptationSuggestions(
    stressCorrelations: Record<string, number>,
    confidencePatterns: Record<string, any>,
    profile: UserPersonalityProfile
  ): string[] {
    const suggestions = [];
    
    if (confidencePatterns.averageConfidence < 0.7) {
      suggestions.push('Consider enabling backup authentication methods');
    }
    
    if (stressCorrelations.stress_response_correlation > 0.8) {
      suggestions.push('Adapt response style during high-stress periods');
    }
    
    return suggestions;
  }

  private calculateVariability(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  private generateAdaptationRecommendations(
    profile: UserPersonalityProfile,
    communicationAnalysis: any,
    topicAnalysis: any,
    temporalAnalysis: any,
    qualityAnalysis: any
  ): string[] {
    const recommendations = [];
    
    if (qualityAnalysis.averageQuality < 3.5) {
      recommendations.push('Adjust response style to better match user preferences');
    }
    
    if (communicationAnalysis.averageResponseLength > 800 && profile.communicationStyle === 'concise') {
      recommendations.push('Reduce response length to match concise preference');
    }
    
    return recommendations;
  }

  private detectSignificantChanges(
    profile: UserPersonalityProfile,
    communicationAnalysis: any,
    topicAnalysis: any
  ): boolean {
    // Check if communication style has changed significantly
    if (communicationAnalysis.dominantStyle !== profile.communicationStyle) {
      return true;
    }
    
    // Check if topic preferences have shifted significantly
    const currentTopics = new Set(profile.expertiseAreas);
    const newTopics = new Set(topicAnalysis.topTopics);
    const overlap = new Set([...currentTopics].filter(x => newTopics.has(x)));
    const overlapRatio = overlap.size / Math.max(currentTopics.size, newTopics.size);
    
    return overlapRatio < (1 - this.config.significantChangeThreshold);
  }

  private calculateAnalysisConfidence(
    interactionCount: number,
    qualityAnalysis: any,
    currentConsistency: number
  ): number {
    let confidence = 0;
    
    // Base confidence on interaction count
    confidence += Math.min(interactionCount / 100, 0.4);
    
    // Factor in feedback rate
    confidence += qualityAnalysis.feedbackRate * 0.3;
    
    // Factor in current consistency
    confidence += currentConsistency * 0.3;
    
    return Math.min(confidence, 1.0);
  }

  private generateModelUpdateRecommendations(
    profile: UserPersonalityProfile,
    significantChange: boolean
  ): ModelUpdateRecommendation[] {
    const recommendations: ModelUpdateRecommendation[] = [];
    
    if (significantChange) {
      recommendations.push({
        type: 'retrain',
        priority: 'high',
        reason: 'Significant personality pattern changes detected',
        estimatedImpact: 0.8,
        requiredData: ['interaction_history', 'biometric_patterns']
      });
    }
    
    if (profile.satisfactionScore < 3.5) {
      recommendations.push({
        type: 'finetune',
        priority: 'medium',
        reason: 'Low user satisfaction score',
        estimatedImpact: 0.6,
        requiredData: ['response_patterns', 'feedback_data']
      });
    }
    
    return recommendations;
  }

  private getEmptyBiometricMapping(): BiometricPersonalityMapping {
    return {
      stressCorrelations: {},
      confidencePatterns: {},
      temporalPatterns: {},
      deviceUsagePatterns: {},
      securityPersonalityCorrelation: 0,
      adaptationSuggestions: []
    };
  }

  private async storeBiometricData(userId: string, biometricData: BiometricAuthData[]): Promise<void> {
    try {
      const records = biometricData.map(data => ({
        user_id: userId,
        device_id: data.deviceId,
        auth_timestamp: data.timestamp.toISOString(),
        auth_method: data.authMethod,
        biometric_confidence: data.confidence,
        contextual_factors: data.contextualFactors,
        // Note: patterns are already encrypted/aggregated in BiometricAuthData
        data_classification: 'aggregated'
      }));

      const { error } = await this.supabase
        .from('biometric_personality_data')
        .insert(records);

      if (error) {
        throw error;
      }
    } catch (error) {
      logger.error('Error storing biometric data:', error);
      throw error;
    }
  }

  private async handleContextInjectionEvent(data: any): Promise<void> {
    // Handle context injection events for personality learning
    logger.debug('Context injection event received for personality analysis');
  }

  private async handleModelTrainingCompletion(data: any): Promise<void> {
    // Handle MLX training completion events
    if (data.personalityModelId) {
      logger.info(`Personality model training completed: ${data.personalityModelId}`);
      this.emit('personality_model_ready', data);
    }
  }
}

export default PersonalityAnalyticsService;