/**
 * User Preference Learning Service
 * Learns from user interactions, feedback, and model selections to personalize AI experience
 * Features: Implicit/explicit feedback, model preference tracking, context adaptation, collaborative filtering
 */

import { EventEmitter } from 'events';

import { log, LogContext } from '../utils/logger';
import { getSupabaseClient } from './supabase-client';

// ============================================================================
// Types and Interfaces
// ============================================================================

interface UserInteraction {
  userId: string;
  sessionId: string;
  timestamp: Date;
  interactionType: 'model_selection' | 'prompt_submission' | 'response_rating' | 'correction' | 'regeneration';
  modelId: string;
  providerId: string;
  prompt?: string;
  response?: string;
  rating?: number; // 1-5 scale
  feedback?: string;
  context?: Record<string, any>;
  taskType?: string;
  responseTime?: number;
  tokenCount?: number;
  wasRegenerated?: boolean;
  corrections?: string[];
}

interface UserPreferences {
  userId: string;
  modelPreferences: Record<string, ModelPreference>;
  taskPreferences: Record<string, TaskPreference>;
  generalPreferences: GeneralPreferences;
  adaptiveWeights: AdaptiveWeights;
  lastUpdated: Date;
  version: number;
}

interface ModelPreference {
  modelId: string;
  providerId: string;
  overallScore: number;
  taskScores: Record<string, number>;
  usageCount: number;
  avgRating: number;
  avgResponseTime: number;
  successRate: number;
  lastUsed: Date;
  preferenceStrength: number; // 0-1 how strong the preference is
}

interface TaskPreference {
  taskType: string;
  preferredModels: string[];
  avgComplexity: number;
  preferredLength: 'short' | 'medium' | 'long';
  preferredStyle: 'formal' | 'casual' | 'technical' | 'creative' | 'neutral';
  contextImportance: number;
}

interface GeneralPreferences {
  responseSpeed: 'fast' | 'balanced' | 'quality';
  creativityLevel: number; // 0-1
  technicalDetail: number; // 0-1
  explainationDepth: number; // 0-1
  preferredTone: 'professional' | 'friendly' | 'neutral';
  languageComplexity: 'simple' | 'moderate' | 'advanced';
}

interface AdaptiveWeights {
  recencyWeight: number;
  frequencyWeight: number;
  ratingWeight: number;
  contextWeight: number;
  performanceWeight: number;
}

interface PreferenceLearningConfig {
  minInteractionsForPreference: number;
  decayFactor: number;
  contextSimilarityThreshold: number;
  adaptationRate: number;
  collaborativeFilteringEnabled: boolean;
  explicitFeedbackWeight: number;
  implicitFeedbackWeight: number;
}

interface ModelRecommendation {
  modelId: string;
  providerId: string;
  confidence: number;
  reasons: string[];
  expectedPerformance: number;
  estimatedResponseTime: number;
}

interface ContextVector {
  taskType: string;
  complexity: number;
  urgency: number;
  creativity: number;
  technicalLevel: number;
  previousContext?: string;
  userMood?: string;
  timeOfDay?: string;
}

// ============================================================================
// User Preference Learning Service
// ============================================================================

class UserPreferenceLearningService extends EventEmitter {
  private readonly config: PreferenceLearningConfig;
  private readonly userPreferences = new Map<string, UserPreferences>();
  private readonly interactionBuffer = new Map<string, UserInteraction[]>();
  private readonly contextCache = new Map<string, ContextVector>();
  private isInitialized = false;
  private readonly BUFFER_SIZE = 100;
  private readonly BATCH_PROCESSING_INTERVAL = 30000; // 30 seconds
  private processingTimer?: NodeJS.Timeout;

  constructor() {
    super();
    
    this.config = {
      minInteractionsForPreference: 5,
      decayFactor: 0.95,
      contextSimilarityThreshold: 0.8,
      adaptationRate: 0.1,
      collaborativeFilteringEnabled: true,
      explicitFeedbackWeight: 0.7,
      implicitFeedbackWeight: 0.3,
    };

    this.startBatchProcessing();
  }

  // ============================================================================
  // Initialization and Configuration
  // ============================================================================

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      log.info('🧠 Initializing User Preference Learning Service', LogContext.AI);
      
      // Load existing preferences from database
      await this.loadUserPreferences();
      
      // Initialize collaborative filtering data
      if (this.config.collaborativeFilteringEnabled) {
        await this.initializeCollaborativeFiltering();
      }
      
      this.isInitialized = true;
      this.emit('initialized');
      
      log.info('✅ User Preference Learning Service initialized', LogContext.AI);
    } catch (error) {
      log.error('❌ Failed to initialize User Preference Learning Service', LogContext.AI, { error });
      throw error;
    }
  }

  private startBatchProcessing(): void {
    this.processingTimer = setInterval(() => {
      this.processBatchedInteractions().catch(error => 
        log.error('❌ Batch processing failed', LogContext.AI, { error })
      );
    }, this.BATCH_PROCESSING_INTERVAL);
  }

  // ============================================================================
  // Interaction Recording
  // ============================================================================

  async recordInteraction(interaction: UserInteraction): Promise<void> {
    try {
      // Add interaction to buffer
      if (!this.interactionBuffer.has(interaction.userId)) {
        this.interactionBuffer.set(interaction.userId, []);
      }
      
      const userBuffer = this.interactionBuffer.get(interaction.userId)!;
      userBuffer.push(interaction);
      
      // Keep buffer size manageable
      if (userBuffer.length > this.BUFFER_SIZE) {
        userBuffer.splice(0, userBuffer.length - this.BUFFER_SIZE);
      }
      
      // Process high-priority interactions immediately
      if (interaction.interactionType === 'response_rating' || interaction.rating) {
        await this.processInteractionImmediate(interaction);
      }
      
      this.emit('interactionRecorded', interaction);
      
    } catch (error) {
      log.error('❌ Failed to record interaction', LogContext.AI, { error, userId: interaction.userId });
    }
  }

  private async processInteractionImmediate(interaction: UserInteraction): Promise<void> {
    const preferences = await this.getUserPreferences(interaction.userId);
    
    // Update model preferences based on explicit feedback
    if (interaction.rating || interaction.feedback) {
      await this.updateModelPreference(interaction, preferences);
    }
    
    // Update context understanding
    if (interaction.context) {
      this.updateContextLearning(interaction, preferences);
    }
    
    // Save updated preferences
    await this.saveUserPreferences(preferences);
  }

  // ============================================================================
  // Preference Learning and Updates
  // ============================================================================

  private async updateModelPreference(
    interaction: UserInteraction, 
    preferences: UserPreferences
  ): Promise<void> {
    const modelKey = `${interaction.modelId}:${interaction.providerId}`;
    
    if (!preferences.modelPreferences[modelKey]) {
      preferences.modelPreferences[modelKey] = {
        modelId: interaction.modelId,
        providerId: interaction.providerId,
        overallScore: 0.5,
        taskScores: {},
        usageCount: 0,
        avgRating: 0,
        avgResponseTime: 0,
        successRate: 0,
        lastUsed: new Date(),
        preferenceStrength: 0,
      };
    }
    
    const modelPref = preferences.modelPreferences[modelKey];
    
    // Update usage statistics
    modelPref.usageCount++;
    modelPref.lastUsed = interaction.timestamp;
    
    // Update rating if provided
    if (interaction.rating && interaction.rating > 0) {
      const currentAvg = modelPref.avgRating || 0;
      const count = Math.max(1, modelPref.usageCount);
      modelPref.avgRating = (currentAvg * (count - 1) + interaction.rating) / count;
      
      // Update overall score with weighted rating
      const ratingScore = (interaction.rating - 1) / 4; // Normalize to 0-1
      modelPref.overallScore = this.adaptiveUpdate(
        modelPref.overallScore,
        ratingScore,
        this.config.explicitFeedbackWeight
      );
    }
    
    // Update response time
    if (interaction.responseTime && interaction.responseTime > 0) {
      const currentAvg = modelPref.avgResponseTime || 0;
      const count = Math.max(1, modelPref.usageCount);
      modelPref.avgResponseTime = (currentAvg * (count - 1) + interaction.responseTime) / count;
    }
    
    // Update task-specific scores
    if (interaction.taskType) {
      if (!modelPref.taskScores[interaction.taskType]) {
        modelPref.taskScores[interaction.taskType] = 0.5;
      }
      
      if (interaction.rating) {
        const taskRatingScore = (interaction.rating - 1) / 4;
        const currentTaskScore = modelPref.taskScores[interaction.taskType] || 0.5;
        modelPref.taskScores[interaction.taskType] = this.adaptiveUpdate(
          currentTaskScore,
          taskRatingScore,
          this.config.explicitFeedbackWeight
        );
      }
    }
    
    // Calculate preference strength based on consistency and usage
    modelPref.preferenceStrength = this.calculatePreferenceStrength(modelPref);
    
    // Update success rate based on regenerations and corrections
    if (interaction.wasRegenerated || (interaction.corrections && interaction.corrections.length > 0)) {
      const failure = 1;
      const currentSuccessRate = modelPref.successRate;
      const count = modelPref.usageCount;
      modelPref.successRate = Math.max(0, (currentSuccessRate * (count - 1) + (1 - failure)) / count);
    } else if (interaction.rating && interaction.rating >= 4) {
      const success = 1;
      const currentSuccessRate = modelPref.successRate;
      const count = modelPref.usageCount;
      modelPref.successRate = Math.min(1, (currentSuccessRate * (count - 1) + success) / count);
    }
  }

  private updateContextLearning(interaction: UserInteraction, preferences: UserPreferences): void {
    if (!interaction.context || !interaction.taskType) return;
    
    const contextVector = this.extractContextVector(interaction);
    this.contextCache.set(`${interaction.userId}:${interaction.sessionId}`, contextVector);
    
    // Update task preferences based on context
    if (!preferences.taskPreferences[interaction.taskType]) {
      preferences.taskPreferences[interaction.taskType] = {
        taskType: interaction.taskType,
        preferredModels: [],
        avgComplexity: 0.5,
        preferredLength: 'medium',
        preferredStyle: 'neutral',
        contextImportance: 0.5,
      };
    }
    
    const taskPref = preferences.taskPreferences[interaction.taskType];
    
    if (taskPref) {
      // Update complexity understanding
      if (contextVector.complexity !== undefined) {
        taskPref.avgComplexity = this.adaptiveUpdate(
          taskPref.avgComplexity,
          contextVector.complexity,
          this.config.adaptationRate
        );
      }
      
      // Update preferred models for this task
      const modelKey = `${interaction.modelId}:${interaction.providerId}`;
      if (interaction.rating && interaction.rating >= 4) {
        if (!taskPref.preferredModels.includes(modelKey)) {
          taskPref.preferredModels.push(modelKey);
        }
      } else if (interaction.rating && interaction.rating <= 2) {
        const index = taskPref.preferredModels.indexOf(modelKey);
        if (index > -1) {
          taskPref.preferredModels.splice(index, 1);
        }
      }
    }
  }

  // ============================================================================
  // Model Recommendation Engine
  // ============================================================================

  async getModelRecommendations(
    userId: string,
    context: ContextVector,
    topN: number = 3
  ): Promise<ModelRecommendation[]> {
    const preferences = await this.getUserPreferences(userId);
    const recommendations: ModelRecommendation[] = [];
    
    for (const [modelKey, modelPref] of Object.entries(preferences.modelPreferences)) {
      const recommendation = await this.calculateModelRecommendation(
        modelPref,
        preferences,
        context
      );
      
      recommendations.push(recommendation);
    }
    
    // Sort by confidence and return top N
    recommendations.sort((a, b) => b.confidence - a.confidence);
    
    // Apply collaborative filtering if enabled
    if (this.config.collaborativeFilteringEnabled) {
      await this.applyCollaborativeFiltering(recommendations, userId, context);
    }
    
    return recommendations.slice(0, topN);
  }

  private async calculateModelRecommendation(
    modelPref: ModelPreference,
    userPrefs: UserPreferences,
    context: ContextVector
  ): Promise<ModelRecommendation> {
    let confidence = 0;
    const reasons: string[] = [];
    
    // Base confidence from overall score
    confidence += modelPref.overallScore * userPrefs.adaptiveWeights.ratingWeight;
    
    // Task-specific scoring
    if (context.taskType && modelPref.taskScores[context.taskType]) {
      const taskScore = modelPref.taskScores[context.taskType];
      if (taskScore !== undefined) {
        confidence += taskScore * userPrefs.adaptiveWeights.contextWeight;
        
        if (taskScore > 0.7) {
          reasons.push(`Excellent performance on ${context.taskType} tasks`);
        }
      }
    }
    
    // Frequency and recency scoring
    const daysSinceLastUse = (Date.now() - modelPref.lastUsed.getTime()) / (1000 * 60 * 60 * 24);
    const recencyScore = Math.exp(-daysSinceLastUse * 0.1); // Decay over time
    confidence += recencyScore * userPrefs.adaptiveWeights.recencyWeight;
    
    if (daysSinceLastUse < 1) {
      reasons.push('Recently used');
    }
    
    // Usage frequency
    const frequencyScore = Math.min(1, modelPref.usageCount / 50); // Normalize usage count
    confidence += frequencyScore * userPrefs.adaptiveWeights.frequencyWeight;
    
    if (modelPref.usageCount > 20) {
      reasons.push('Frequently chosen');
    }
    
    // Performance-based scoring
    const performanceScore = (modelPref.avgRating / 5) * modelPref.successRate;
    confidence += performanceScore * userPrefs.adaptiveWeights.performanceWeight;
    
    if (modelPref.avgRating > 4) {
      reasons.push('Highly rated');
    }
    
    if (modelPref.successRate > 0.8) {
      reasons.push('High success rate');
    }
    
    // Response time consideration based on user preferences
    let responseTimePenalty = 0;
    if (userPrefs.generalPreferences.responseSpeed === 'fast' && modelPref.avgResponseTime > 5000) {
      responseTimePenalty = 0.1;
      reasons.push('May be slower than preferred');
    } else if (modelPref.avgResponseTime < 2000) {
      reasons.push('Fast response time');
    }
    
    confidence = Math.max(0, Math.min(1, confidence - responseTimePenalty));
    
    return {
      modelId: modelPref.modelId,
      providerId: modelPref.providerId,
      confidence,
      reasons,
      expectedPerformance: performanceScore,
      estimatedResponseTime: modelPref.avgResponseTime,
    };
  }

  // ============================================================================
  // Collaborative Filtering
  // ============================================================================

  private async applyCollaborativeFiltering(
    recommendations: ModelRecommendation[],
    userId: string,
    context: ContextVector
  ): Promise<void> {
    try {
      // Find similar users based on preferences
      const similarUsers = await this.findSimilarUsers(userId, 5);
      
      if (similarUsers.length === 0) return;
      
      // Get their preferences for similar contexts
      for (const recommendation of recommendations) {
        let collaborativeScore = 0;
        let weightSum = 0;
        
        for (const similarUser of similarUsers) {
          const similarUserPrefs = await this.getUserPreferences(similarUser.userId);
          const modelKey = `${recommendation.modelId}:${recommendation.providerId}`;
          
          if (similarUserPrefs.modelPreferences[modelKey]) {
            const modelPref = similarUserPrefs.modelPreferences[modelKey];
            const taskScore = modelPref.taskScores[context.taskType] || modelPref.overallScore;
            
            collaborativeScore += taskScore * similarUser.similarity;
            weightSum += similarUser.similarity;
          }
        }
        
        if (weightSum > 0) {
          const avgCollaborativeScore = collaborativeScore / weightSum;
          
          // Blend with existing confidence
          recommendation.confidence = (
            recommendation.confidence * 0.8 + 
            avgCollaborativeScore * 0.2
          );
          
          if (avgCollaborativeScore > 0.7) {
            recommendation.reasons.push('Recommended by similar users');
          }
        }
      }
    } catch (error) {
      log.error('❌ Collaborative filtering failed', LogContext.AI, { error, userId });
    }
  }

  private async findSimilarUsers(userId: string, topN: number): Promise<Array<{userId: string; similarity: number}>> {
    try {
      const currentUser = await this.getUserPreferences(userId);
      const similarUsers: Array<{userId: string; similarity: number}> = [];
      
      // Get all other users (in production, this would be optimized with indexing)
      const supabaseClient = getSupabaseClient();
      if (!supabaseClient) {
        log.warn('⚠️ Supabase client not available for collaborative filtering', LogContext.AI);
        return [];
      }
      
      const { data: allUsers } = await supabaseClient
        .from('user_preferences')
        .select('user_id, model_preferences, task_preferences')
        .neq('user_id', userId)
        .limit(100); // Limit for performance
      
      if (!allUsers) return [];
      
      for (const otherUser of allUsers) {
        const similarity = this.calculateUserSimilarity(currentUser, otherUser);
        
        if (similarity > 0.3) { // Minimum similarity threshold
          similarUsers.push({ userId: otherUser.user_id, similarity });
        }
      }
      
      // Sort by similarity and return top N
      similarUsers.sort((a, b) => b.similarity - a.similarity);
      return similarUsers.slice(0, topN);
      
    } catch (error) {
      log.error('❌ Failed to find similar users', LogContext.AI, { error });
      return [];
    }
  }

  private calculateUserSimilarity(user1: UserPreferences, user2: any): number {
    let similarity = 0;
    let dimensions = 0;
    
    // Compare model preferences
    const models1 = Object.keys(user1.modelPreferences);
    const models2 = Object.keys(user2.model_preferences || {});
    const commonModels = models1.filter(model => models2.includes(model));
    
    if (commonModels.length > 0) {
      for (const modelKey of commonModels) {
        const pref1 = user1.modelPreferences[modelKey];
        const pref2 = user2.model_preferences[modelKey];
        
        if (pref1 && pref2) {
          // Calculate cosine similarity for model preferences
          const scoreSimilarity = 1 - Math.abs(pref1.overallScore - pref2.overall_score);
          similarity += scoreSimilarity;
          dimensions++;
        }
      }
    }
    
    // Compare task preferences
    const tasks1 = Object.keys(user1.taskPreferences);
    const tasks2 = Object.keys(user2.task_preferences || {});
    const commonTasks = tasks1.filter(task => tasks2.includes(task));
    
    if (commonTasks.length > 0) {
      for (const taskType of commonTasks) {
        const task1 = user1.taskPreferences[taskType];
        const task2 = user2.task_preferences[taskType];
        
        if (task1 && task2) {
          const complexitySimilarity = 1 - Math.abs(task1.avgComplexity - task2.avg_complexity);
          similarity += complexitySimilarity;
          dimensions++;
        }
      }
    }
    
    return dimensions > 0 ? similarity / dimensions : 0;
  }

  // ============================================================================
  // Batch Processing
  // ============================================================================

  private async processBatchedInteractions(): Promise<void> {
    if (this.interactionBuffer.size === 0) return;
    
    try {
      const batchesToProcess = Array.from(this.interactionBuffer.entries());
      
      for (const [userId, interactions] of batchesToProcess) {
        if (interactions.length === 0) continue;
        
        const preferences = await this.getUserPreferences(userId);
        
        // Process all interactions for this user
        for (const interaction of interactions) {
          await this.updateModelPreference(interaction, preferences);
          
          if (interaction.context) {
            this.updateContextLearning(interaction, preferences);
          }
        }
        
        // Update adaptive weights based on recent patterns
        this.updateAdaptiveWeights(preferences, interactions);
        
        // Save updated preferences
        await this.saveUserPreferences(preferences);
        
        // Store interactions in database
        await this.storeInteractions(interactions);
        
        // Clear processed interactions
        this.interactionBuffer.set(userId, []);
      }
      
    } catch (error) {
      log.error('❌ Batch processing failed', LogContext.AI, { error });
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private adaptiveUpdate(currentValue: number, newValue: number, learningRate: number): number {
    return currentValue + learningRate * (newValue - currentValue);
  }

  private calculatePreferenceStrength(modelPref: ModelPreference): number {
    // Strength based on usage consistency, rating variance, and frequency
    const usageStrength = Math.min(1, modelPref.usageCount / 20);
    const ratingStrength = modelPref.avgRating > 0 ? Math.min(1, modelPref.avgRating / 4) : 0.5;
    const recencyStrength = Math.exp(-((Date.now() - modelPref.lastUsed.getTime()) / (1000 * 60 * 60 * 24)) * 0.1);
    
    return (usageStrength + ratingStrength + recencyStrength) / 3;
  }

  private extractContextVector(interaction: UserInteraction): ContextVector {
    const context = interaction.context || {};
    
    return {
      taskType: interaction.taskType || 'general',
      complexity: context.complexity || 0.5,
      urgency: context.urgency || 0.5,
      creativity: context.creativity || 0.5,
      technicalLevel: context.technicalLevel || 0.5,
      previousContext: context.previousContext,
      userMood: context.userMood,
      timeOfDay: new Date(interaction.timestamp).getHours() < 12 ? 'morning' : 'afternoon',
    };
  }

  private updateAdaptiveWeights(preferences: UserPreferences, interactions: UserInteraction[]): void {
    // Analyze interaction patterns to adjust weights
    const explicitFeedback = interactions.filter(i => i.rating || i.feedback).length;
    const totalInteractions = interactions.length;
    
    if (totalInteractions > 0) {
      const explicitRatio = explicitFeedback / totalInteractions;
      
      // Adjust weights based on feedback patterns
      if (explicitRatio > 0.3) {
        preferences.adaptiveWeights.ratingWeight = Math.min(0.9, preferences.adaptiveWeights.ratingWeight + 0.05);
      } else {
        preferences.adaptiveWeights.performanceWeight = Math.min(0.9, preferences.adaptiveWeights.performanceWeight + 0.05);
      }
      
      // Normalize weights
      const totalWeight = Object.values(preferences.adaptiveWeights).reduce((sum, weight) => sum + weight, 0);
      for (const [key, value] of Object.entries(preferences.adaptiveWeights)) {
        (preferences.adaptiveWeights as any)[key] = value / totalWeight;
      }
    }
  }

  // ============================================================================
  // Database Operations
  // ============================================================================

  private async getUserPreferences(userId: string): Promise<UserPreferences> {
    if (this.userPreferences.has(userId)) {
      return this.userPreferences.get(userId)!;
    }
    
    try {
      const supabaseClient = getSupabaseClient();
      if (!supabaseClient) {
        log.warn('⚠️ Supabase client not available, using default preferences', LogContext.AI, { userId });
        const defaultPreferences = this.createDefaultUserPreferences(userId);
        this.userPreferences.set(userId, defaultPreferences);
        return defaultPreferences;
      }
      
      const { data } = await supabaseClient
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      let preferences: UserPreferences;
      
      if (data) {
        preferences = {
          userId,
          modelPreferences: data.model_preferences || {},
          taskPreferences: data.task_preferences || {},
          generalPreferences: data.general_preferences || this.getDefaultGeneralPreferences(),
          adaptiveWeights: data.adaptive_weights || this.getDefaultAdaptiveWeights(),
          lastUpdated: new Date(data.updated_at),
          version: data.version || 1,
        };
      } else {
        preferences = this.createDefaultUserPreferences(userId);
      }
      
      this.userPreferences.set(userId, preferences);
      return preferences;
      
    } catch (error) {
      log.error('❌ Failed to load user preferences', LogContext.AI, { error, userId });
      const defaultPreferences = this.createDefaultUserPreferences(userId);
      this.userPreferences.set(userId, defaultPreferences);
      return defaultPreferences;
    }
  }

  private async saveUserPreferences(preferences: UserPreferences): Promise<void> {
    try {
      preferences.lastUpdated = new Date();
      preferences.version++;
      
      const supabaseClient = getSupabaseClient();
      if (!supabaseClient) {
        log.warn('⚠️ Supabase client not available, caching preferences locally', LogContext.AI, { userId: preferences.userId });
        this.userPreferences.set(preferences.userId, preferences);
        return;
      }
      
      const { error } = await supabaseClient
        .from('user_preferences')
        .upsert({
          user_id: preferences.userId,
          model_preferences: preferences.modelPreferences,
          task_preferences: preferences.taskPreferences,
          general_preferences: preferences.generalPreferences,
          adaptive_weights: preferences.adaptiveWeights,
          version: preferences.version,
          updated_at: preferences.lastUpdated.toISOString(),
        });
      
      if (error) throw error;
      
      // Update cache
      this.userPreferences.set(preferences.userId, preferences);
      
    } catch (error) {
      log.error('❌ Failed to save user preferences', LogContext.AI, { error, userId: preferences.userId });
      throw error;
    }
  }

  private async loadUserPreferences(): Promise<void> {
    try {
      const supabaseClient = getSupabaseClient();
      if (!supabaseClient) {
        log.warn('⚠️ Supabase client not available for loading user preferences', LogContext.AI);
        return;
      }
      
      const { data } = await supabaseClient
        .from('user_preferences')
        .select('*')
        .limit(1000); // Load recent users
      
      if (data) {
        for (const row of data) {
          const preferences: UserPreferences = {
            userId: row.user_id,
            modelPreferences: row.model_preferences || {},
            taskPreferences: row.task_preferences || {},
            generalPreferences: row.general_preferences || this.getDefaultGeneralPreferences(),
            adaptiveWeights: row.adaptive_weights || this.getDefaultAdaptiveWeights(),
            lastUpdated: new Date(row.updated_at),
            version: row.version || 1,
          };
          
          this.userPreferences.set(row.user_id, preferences);
        }
      }
      
      log.info(`📊 Loaded ${this.userPreferences.size} user preference profiles`, LogContext.AI);
      
    } catch (error) {
      log.error('❌ Failed to load user preferences', LogContext.AI, { error });
    }
  }

  private async storeInteractions(interactions: UserInteraction[]): Promise<void> {
    try {
      const interactionData = interactions.map(interaction => ({
        user_id: interaction.userId,
        session_id: interaction.sessionId,
        interaction_type: interaction.interactionType,
        model_id: interaction.modelId,
        provider_id: interaction.providerId,
        prompt: interaction.prompt,
        response: interaction.response,
        rating: interaction.rating,
        feedback: interaction.feedback,
        context: interaction.context,
        task_type: interaction.taskType,
        response_time: interaction.responseTime,
        token_count: interaction.tokenCount,
        was_regenerated: interaction.wasRegenerated,
        corrections: interaction.corrections,
        timestamp: interaction.timestamp.toISOString(),
      }));
      
      const supabaseClient = getSupabaseClient();
      if (!supabaseClient) {
        log.warn('⚠️ Supabase client not available, interactions not persisted', LogContext.AI);
        return;
      }
      
      const { error } = await supabaseClient
        .from('user_interactions')
        .insert(interactionData);
      
      if (error) throw error;
      
    } catch (error) {
      log.error('❌ Failed to store interactions', LogContext.AI, { error });
    }
  }

  private async initializeCollaborativeFiltering(): Promise<void> {
    // Create necessary database functions for similarity calculations
    // This would be implemented with database migrations
    log.info('🤝 Collaborative filtering initialized', LogContext.AI);
  }

  // ============================================================================
  // Default Values
  // ============================================================================

  private createDefaultUserPreferences(userId: string): UserPreferences {
    return {
      userId,
      modelPreferences: {},
      taskPreferences: {},
      generalPreferences: this.getDefaultGeneralPreferences(),
      adaptiveWeights: this.getDefaultAdaptiveWeights(),
      lastUpdated: new Date(),
      version: 1,
    };
  }

  private getDefaultGeneralPreferences(): GeneralPreferences {
    return {
      responseSpeed: 'balanced',
      creativityLevel: 0.5,
      technicalDetail: 0.5,
      explainationDepth: 0.5,
      preferredTone: 'neutral',
      languageComplexity: 'moderate',
    };
  }

  private getDefaultAdaptiveWeights(): AdaptiveWeights {
    return {
      recencyWeight: 0.2,
      frequencyWeight: 0.2,
      ratingWeight: 0.3,
      contextWeight: 0.2,
      performanceWeight: 0.1,
    };
  }

  // ============================================================================
  // Public API Methods
  // ============================================================================

  async getPersonalizedModelSelection(
    userId: string, 
    context: ContextVector
  ): Promise<string> {
    const recommendations = await this.getModelRecommendations(userId, context, 1);
    
    if (recommendations.length > 0) {
      const best = recommendations[0];
      if (best) {
        log.info('🎯 Personalized model selected', LogContext.AI, {
          userId,
          modelId: best.modelId,
          confidence: best.confidence,
          reasons: best.reasons,
        });
        
        return `${best.modelId}:${best.providerId}`;
      }
    }
    
    // Fallback to default model selection logic
    return 'default:provider';
  }

  async updateUserFeedback(
    userId: string,
    sessionId: string,
    modelId: string,
    providerId: string,
    rating: number,
    feedback?: string
  ): Promise<void> {
    const interaction: UserInteraction = {
      userId,
      sessionId,
      timestamp: new Date(),
      interactionType: 'response_rating',
      modelId,
      providerId,
      rating,
      feedback,
    };
    
    await this.recordInteraction(interaction);
  }

  async getUserInsights(userId: string): Promise<any> {
    const preferences = await this.getUserPreferences(userId);
    
    return {
      topModels: Object.entries(preferences.modelPreferences)
        .sort(([,a], [,b]) => b.overallScore - a.overallScore)
        .slice(0, 5)
        .map(([key, pref]) => ({
          model: key,
          score: pref.overallScore,
          usageCount: pref.usageCount,
          avgRating: pref.avgRating,
        })),
      preferredTasks: Object.entries(preferences.taskPreferences)
        .map(([taskType, pref]) => ({
          taskType,
          complexity: pref.avgComplexity,
          preferredStyle: pref.preferredStyle,
          modelCount: pref.preferredModels.length,
        })),
      generalProfile: preferences.generalPreferences,
      learningMetrics: {
        profileVersion: preferences.version,
        lastUpdated: preferences.lastUpdated,
        modelCount: Object.keys(preferences.modelPreferences).length,
        taskCount: Object.keys(preferences.taskPreferences).length,
      },
    };
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  async shutdown(): Promise<void> {
    if (this.processingTimer) {
      clearInterval(this.processingTimer);
    }
    
    // Process remaining interactions
    await this.processBatchedInteractions();
    
    // Save any cached preferences
    const preferencesArray = Array.from(this.userPreferences.values());
    for (const preferences of preferencesArray) {
      await this.saveUserPreferences(preferences);
    }
    
    log.info('🧠 User Preference Learning Service shut down', LogContext.AI);
  }
}

// ============================================================================
// Export Service Instance
// ============================================================================

export const userPreferenceLearningService = new UserPreferenceLearningService();

export { UserPreferenceLearningService };

export type {
  ContextVector,
  ModelPreference,
  ModelRecommendation,
  PreferenceLearningConfig,
  UserInteraction,
  UserPreferences,
};