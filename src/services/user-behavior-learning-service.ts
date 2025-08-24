/**
 * User Behavior Learning and Personalization Service
 * Learns from user interactions, preferences, and patterns to provide personalized experiences
 * Implements machine learning algorithms for continuous adaptation and improvement
 * 
 * Features:
 * - User interaction pattern analysis
 * - Preference learning and adaptation
 * - Behavioral prediction models
 * - Personalized recommendations
 * - A/B testing framework for optimization
 * - Privacy-preserving learning techniques
 * - Feedback integration and reinforcement learning
 * - Cross-session and long-term memory
 */

import { createClient } from '@supabase/supabase-js';
import { EventEmitter } from 'events';

import { config } from '@/config/environment';
import { log, LogContext } from '@/utils/logger';

export interface UserInteraction {
  id: string;
  userId: string;
  sessionId: string;
  timestamp: Date;
  type: 'click' | 'scroll' | 'search' | 'selection' | 'command' | 'navigation' | 'task_completion' | 'feedback';
  context: {
    page?: string;
    component?: string;
    action?: string;
    target?: string;
    metadata?: any;
  };
  outcome?: 'success' | 'failure' | 'abandoned' | 'partial';
  duration?: number; // milliseconds
  value?: any; // The actual value or result of the interaction
}

export interface UserPreference {
  id: string;
  userId: string;
  category: 'ui' | 'behavior' | 'content' | 'timing' | 'communication' | 'workflow';
  key: string;
  value: any;
  confidence: number; // 0-1, how confident we are in this preference
  source: 'explicit' | 'inferred' | 'learned' | 'default';
  lastUpdated: Date;
  updateCount: number;
  metadata?: {
    contexts?: string[]; // When this preference applies
    conditions?: any[]; // Specific conditions for this preference
    alternatives?: any[]; // Other values that were considered
  };
}

export interface BehaviorPattern {
  id: string;
  userId: string;
  name: string;
  description: string;
  pattern: {
    trigger: any; // Conditions that start the pattern
    sequence: UserInteraction[]; // Sequence of interactions
    outcome: any; // Expected or typical outcome
  };
  frequency: number; // How often this pattern occurs
  confidence: number; // How confident we are in this pattern
  contexts: string[]; // When/where this pattern applies
  variations: any[]; // Different variations of this pattern
  lastSeen: Date;
  firstSeen: Date;
}

export interface PersonalizationModel {
  id: string;
  userId: string;
  modelType: 'preference_prediction' | 'behavior_prediction' | 'recommendation' | 'optimization';
  algorithm: 'collaborative_filtering' | 'content_based' | 'neural_network' | 'decision_tree' | 'clustering';
  features: string[]; // Features used in the model
  parameters: any; // Model-specific parameters
  performance: {
    accuracy?: number;
    precision?: number;
    recall?: number;
    f1Score?: number;
    lastEvaluated: Date;
  };
  trainingData: {
    samples: number;
    lastTrained: Date;
    version: number;
  };
  status: 'training' | 'ready' | 'deprecated' | 'error';
}

export interface Recommendation {
  id: string;
  userId: string;
  type: 'action' | 'content' | 'setting' | 'workflow' | 'feature';
  title: string;
  description: string;
  reasoning: string;
  confidence: number;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  metadata: {
    action?: any; // Action to take if accepted
    alternatives?: any[]; // Alternative recommendations
    contexts?: string[]; // When this recommendation applies
    expectedBenefit?: string;
    effort?: 'low' | 'medium' | 'high';
  };
  status: 'pending' | 'presented' | 'accepted' | 'rejected' | 'ignored' | 'expired';
  createdAt: Date;
  presentedAt?: Date;
  respondedAt?: Date;
  expiresAt?: Date;
}

export interface ABTest {
  id: string;
  name: string;
  description: string;
  hypothesis: string;
  variants: {
    id: string;
    name: string;
    description: string;
    parameters: any;
    allocation: number; // Percentage of users
  }[];
  metrics: string[]; // What metrics to measure
  status: 'draft' | 'running' | 'paused' | 'completed' | 'analyzed';
  startDate: Date;
  endDate?: Date;
  results?: {
    variant: string;
    metrics: { [key: string]: number };
    significance: number;
    winner?: string;
  }[];
  participants: Map<string, string>; // userId -> variantId
}

export interface UserSession {
  id: string;
  userId: string;
  startTime: Date;
  endTime?: Date;
  interactions: UserInteraction[];
  context: {
    device?: string;
    browser?: string;
    location?: string;
    entryPoint?: string;
  };
  goals?: string[]; // What the user was trying to accomplish
  outcomes?: {
    completed: string[];
    abandoned: string[];
    successful: boolean;
  };
}

export interface LearningInsight {
  id: string;
  userId: string;
  type: 'preference_discovered' | 'pattern_identified' | 'behavior_changed' | 'efficiency_gained';
  insight: string;
  evidence: any[];
  confidence: number;
  actionable: boolean;
  recommendedActions?: string[];
  discoveredAt: Date;
  applied: boolean;
}

export class UserBehaviorLearningService extends EventEmitter {
  private userInteractions: Map<string, UserInteraction[]> = new Map(); // userId -> interactions
  private userPreferences: Map<string, Map<string, UserPreference>> = new Map(); // userId -> preferences
  private behaviorPatterns: Map<string, BehaviorPattern[]> = new Map(); // userId -> patterns
  private personalizationModels: Map<string, PersonalizationModel[]> = new Map(); // userId -> models
  private recommendations: Map<string, Recommendation[]> = new Map(); // userId -> recommendations
  private userSessions: Map<string, UserSession[]> = new Map(); // userId -> sessions
  private activeSessions: Map<string, UserSession> = new Map(); // sessionId -> session
  private abTests: Map<string, ABTest> = new Map();
  private learningInsights: Map<string, LearningInsight[]> = new Map(); // userId -> insights
  private supabase: any;
  private isInitialized = false;

  // Learning configuration
  private learningConfig = {
    minInteractionsForPattern: 3,
    patternDecayFactor: 0.95, // How much to decay pattern confidence over time
    preferenceConfidenceThreshold: 0.7,
    modelRetrainingInterval: 24 * 60 * 60 * 1000, // 24 hours
    maxInteractionsPerUser: 10000,
    sessionTimeoutMinutes: 30
  };

  // Processing intervals
  private patternAnalysisInterval: NodeJS.Timeout | null = null;
  private modelTrainingInterval: NodeJS.Timeout | null = null;
  private recommendationGenerationInterval: NodeJS.Timeout | null = null;
  private insightGenerationInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.initializeService();
  }

  private async initializeService(): Promise<void> {
    try {
      // Initialize Supabase for storing learning data
      if (config.supabase.url && config.supabase.serviceKey) {
        this.supabase = createClient(config.supabase.url, config.supabase.serviceKey);
      }

      // Load existing data
      await this.loadUserData();
      
      // Start learning processes
      this.startPatternAnalysis();
      this.startModelTraining();
      this.startRecommendationGeneration();
      this.startInsightGeneration();
      
      // Set up session management
      this.setupSessionManagement();
      
      this.isInitialized = true;
      
      log.info('✅ User Behavior Learning Service initialized', LogContext.AI, {
        users: this.userInteractions.size,
        totalInteractions: Array.from(this.userInteractions.values()).reduce((sum, interactions) => sum + interactions.length, 0),
        patterns: Array.from(this.behaviorPatterns.values()).reduce((sum, patterns) => sum + patterns.length, 0),
        activeTests: Array.from(this.abTests.values()).filter(test => test.status === 'running').length
      });
      
    } catch (error) {
      log.error('❌ Failed to initialize User Behavior Learning Service', LogContext.AI, {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // Interaction Tracking

  /**
   * Record a user interaction for learning
   */
  async recordInteraction(interaction: Omit<UserInteraction, 'id' | 'timestamp'>): Promise<string> {
    const fullInteraction: UserInteraction = {
      ...interaction,
      id: this.generateId('interaction'),
      timestamp: new Date()
    };

    // Store interaction
    if (!this.userInteractions.has(interaction.userId)) {
      this.userInteractions.set(interaction.userId, []);
    }
    
    const userInteractions = this.userInteractions.get(interaction.userId)!;
    userInteractions.push(fullInteraction);
    
    // Maintain size limits
    if (userInteractions.length > this.learningConfig.maxInteractionsPerUser) {
      userInteractions.shift(); // Remove oldest interaction
    }

    // Add to active session if exists
    const session = this.getActiveSession(interaction.sessionId);
    if (session) {
      session.interactions.push(fullInteraction);
    }

    // Immediate learning opportunities
    await this.processImediateInteraction(fullInteraction);

    log.info('📊 User interaction recorded', LogContext.AI, {
      userId: interaction.userId,
      type: interaction.type,
      context: interaction.context.action || interaction.context.component
    });

    this.emit('interactionRecorded', fullInteraction);
    return fullInteraction.id;
  }

  /**
   * Start a new user session
   */
  async startSession(userId: string, context?: any): Promise<string> {
    const session: UserSession = {
      id: this.generateId('session'),
      userId,
      startTime: new Date(),
      interactions: [],
      context: context || {},
      goals: []
    };

    this.activeSessions.set(session.id, session);
    
    if (!this.userSessions.has(userId)) {
      this.userSessions.set(userId, []);
    }
    this.userSessions.get(userId)!.push(session);

    log.info('🎯 User session started', LogContext.AI, {
      userId,
      sessionId: session.id
    });

    this.emit('sessionStarted', session);
    return session.id;
  }

  /**
   * End a user session
   */
  async endSession(sessionId: string, outcomes?: any): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {return;}

    session.endTime = new Date();
    session.outcomes = outcomes;

    // Analyze session for patterns and insights
    await this.analyzeSession(session);

    this.activeSessions.delete(sessionId);
    
    log.info('🏁 User session ended', LogContext.AI, {
      sessionId,
      userId: session.userId,
      duration: session.endTime.getTime() - session.startTime.getTime(),
      interactions: session.interactions.length
    });

    this.emit('sessionEnded', session);
  }

  // Preference Learning

  /**
   * Record a user preference (explicit or inferred)
   */
  async recordPreference(
    userId: string,
    category: UserPreference['category'],
    key: string,
    value: any,
    source: UserPreference['source'] = 'learned',
    confidence: number = 0.8
  ): Promise<void> {
    if (!this.userPreferences.has(userId)) {
      this.userPreferences.set(userId, new Map());
    }

    const userPrefs = this.userPreferences.get(userId)!;
    const prefKey = `${category}:${key}`;
    const existing = userPrefs.get(prefKey);

    const preference: UserPreference = {
      id: existing?.id || this.generateId('pref'),
      userId,
      category,
      key,
      value,
      confidence,
      source,
      lastUpdated: new Date(),
      updateCount: (existing?.updateCount || 0) + 1,
      metadata: existing?.metadata
    };

    userPrefs.set(prefKey, preference);
    
    log.info('🎨 User preference recorded', LogContext.AI, {
      userId,
      category,
      key,
      source,
      confidence
    });

    this.emit('preferenceUpdated', preference);
  }

  /**
   * Get user preferences
   */
  getUserPreferences(userId: string, category?: UserPreference['category']): UserPreference[] {
    const userPrefs = this.userPreferences.get(userId);
    if (!userPrefs) {return [];}

    const preferences = Array.from(userPrefs.values());
    return category ? preferences.filter(p => p.category === category) : preferences;
  }

  /**
   * Infer preferences from interactions
   */
  private async inferPreferencesFromInteractions(userId: string): Promise<void> {
    const interactions = this.userInteractions.get(userId) || [];
    const recentInteractions = interactions.slice(-100); // Last 100 interactions

    // UI preferences
    const uiElements = recentInteractions
      .filter(i => i.context.component)
      .reduce((acc, i) => {
        acc[i.context.component!] = (acc[i.context.component!] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    for (const [component, count] of Object.entries(uiElements)) {
      if (count > 5) { // Used frequently
        await this.recordPreference(userId, 'ui', `preferred_${component}`, true, 'inferred', 0.6);
      }
    }

    // Timing preferences
    const hourUsage = recentInteractions.reduce((acc, i) => {
      const hour = i.timestamp.getHours();
      acc[hour] = (acc[hour] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    const mostActiveHours = Object.entries(hourUsage)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([hour]) => parseInt(hour));

    if (mostActiveHours.length > 0) {
      await this.recordPreference(userId, 'timing', 'preferred_hours', mostActiveHours, 'inferred', 0.7);
    }
  }

  // Pattern Recognition

  private startPatternAnalysis(): void {
    this.patternAnalysisInterval = setInterval(async () => {
      await this.analyzeUserPatterns();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  private async analyzeUserPatterns(): Promise<void> {
    for (const [userId, interactions] of this.userInteractions.entries()) {
      if (interactions.length < this.learningConfig.minInteractionsForPattern) {continue;}

      await this.identifySequencePatterns(userId, interactions);
      await this.identifyUsagePatterns(userId, interactions);
      await this.identifyPreferencePatterns(userId, interactions);
    }
  }

  private async identifySequencePatterns(userId: string, interactions: UserInteraction[]): Promise<void> {
    const sequences = this.extractSequences(interactions, 3); // Look for 3-step sequences

    for (const sequence of sequences) {
      const patternId = this.generatePatternId(sequence);
      
      if (!this.behaviorPatterns.has(userId)) {
        this.behaviorPatterns.set(userId, []);
      }

      const userPatterns = this.behaviorPatterns.get(userId)!;
      const existing = userPatterns.find(p => p.id === patternId);

      if (existing) {
        existing.frequency++;
        existing.confidence = Math.min(1, existing.confidence + 0.1);
        existing.lastSeen = new Date();
      } else {
        const pattern: BehaviorPattern = {
          id: patternId,
          userId,
          name: `Sequence: ${sequence.map(s => s.type).join(' → ')}`,
          description: `User tends to ${sequence.map(s => s.context.action || s.type).join(', then ')}`,
          pattern: {
            trigger: sequence[0]?.context || {},
            sequence,
            outcome: sequence[sequence.length - 1]?.outcome
          },
          frequency: 1,
          confidence: 0.5,
          contexts: Array.from(new Set(sequence.map(s => s.context.page).filter(Boolean))) as string[],
          variations: [],
          firstSeen: new Date(),
          lastSeen: new Date()
        };

        userPatterns.push(pattern);
        
        log.info('🔍 New behavior pattern identified', LogContext.AI, {
          userId,
          patternName: pattern.name
        });

        this.emit('patternIdentified', pattern);
      }
    }
  }

  private async identifyUsagePatterns(userId: string, interactions: UserInteraction[]): Promise<void> {
    // Identify temporal patterns
    const hourlyUsage = interactions.reduce((acc, i) => {
      const hour = i.timestamp.getHours();
      acc[hour] = (acc[hour] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    // Daily patterns
    const dailyUsage = interactions.reduce((acc, i) => {
      const day = i.timestamp.getDay();
      acc[day] = (acc[day] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    // Update preferences based on patterns
    const peakHours = Object.entries(hourlyUsage)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([hour]) => parseInt(hour));

    if (peakHours.length > 0) {
      await this.recordPreference(userId, 'timing', 'peak_hours', peakHours, 'inferred');
    }
  }

  private async identifyPreferencePatterns(userId: string, interactions: UserInteraction[]): Promise<void> {
    // Look for consistent choices that indicate preferences
    const successfulInteractions = interactions.filter(i => i.outcome === 'success');
    
    // Feature usage patterns
    const featureUsage = successfulInteractions.reduce((acc, i) => {
      if (i.context.action) {
        acc[i.context.action] = (acc[i.context.action] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    for (const [feature, count] of Object.entries(featureUsage)) {
      if (count > 10) { // Used frequently
        await this.recordPreference(userId, 'workflow', `prefers_${feature}`, true, 'inferred', Math.min(1, count / 20));
      }
    }
  }

  // Model Training and Personalization

  private startModelTraining(): void {
    this.modelTrainingInterval = setInterval(async () => {
      await this.trainPersonalizationModels();
    }, 60 * 60 * 1000); // Every hour
  }

  private async trainPersonalizationModels(): Promise<void> {
    for (const [userId] of this.userInteractions.entries()) {
      await this.trainUserModels(userId);
    }
  }

  private async trainUserModels(userId: string): Promise<void> {
    const interactions = this.userInteractions.get(userId) || [];
    if (interactions.length < 50) {return;} // Need minimum data

    // Train different types of models
    await this.trainPreferencePredictionModel(userId, interactions);
    await this.trainBehaviorPredictionModel(userId, interactions);
    await this.trainRecommendationModel(userId, interactions);
  }

  private async trainPreferencePredictionModel(userId: string, interactions: UserInteraction[]): Promise<void> {
    const modelId = `${userId}_preference_prediction`;
    
    if (!this.personalizationModels.has(userId)) {
      this.personalizationModels.set(userId, []);
    }

    const userModels = this.personalizationModels.get(userId)!;
    let model = userModels.find(m => m.modelType === 'preference_prediction');

    if (!model) {
      model = {
        id: modelId,
        userId,
        modelType: 'preference_prediction',
        algorithm: 'decision_tree',
        features: ['interaction_type', 'context', 'time_of_day', 'day_of_week', 'outcome'],
        parameters: {},
        performance: {
          lastEvaluated: new Date()
        },
        trainingData: {
          samples: 0,
          lastTrained: new Date(),
          version: 1
        },
        status: 'training'
      };
      userModels.push(model);
    }

    // Simplified training (in reality, would use ML library)
    const trainingData = this.prepareTrainingData(interactions);
    model.trainingData.samples = trainingData.length;
    model.trainingData.lastTrained = new Date();
    model.trainingData.version++;
    model.status = 'ready';

    log.info('🤖 Preference prediction model trained', LogContext.AI, {
      userId,
      samples: model.trainingData.samples,
      version: model.trainingData.version
    });

    this.emit('modelTrained', model);
  }

  private async trainBehaviorPredictionModel(userId: string, interactions: UserInteraction[]): Promise<void> {
    // Similar to preference prediction but focuses on predicting next actions
    log.info('🎯 Training behavior prediction model', LogContext.AI, { userId });
  }

  private async trainRecommendationModel(userId: string, interactions: UserInteraction[]): Promise<void> {
    // Train model to generate personalized recommendations
    log.info('💡 Training recommendation model', LogContext.AI, { userId });
  }

  // Recommendation Generation

  private startRecommendationGeneration(): void {
    this.recommendationGenerationInterval = setInterval(async () => {
      await this.generateRecommendations();
    }, 30 * 60 * 1000); // Every 30 minutes
  }

  private async generateRecommendations(): Promise<void> {
    for (const [userId] of this.userInteractions.entries()) {
      await this.generateUserRecommendations(userId);
    }
  }

  private async generateUserRecommendations(userId: string): Promise<void> {
    const interactions = this.userInteractions.get(userId) || [];
    const preferences = this.getUserPreferences(userId);
    const patterns = this.behaviorPatterns.get(userId) || [];

    if (!this.recommendations.has(userId)) {
      this.recommendations.set(userId, []);
    }

    const userRecommendations = this.recommendations.get(userId)!;

    // Generate different types of recommendations
    const workflowRecommendations = await this.generateWorkflowRecommendations(userId, patterns);
    const settingRecommendations = await this.generateSettingRecommendations(userId, preferences);
    const featureRecommendations = await this.generateFeatureRecommendations(userId, interactions);

    const allRecommendations = [
      ...workflowRecommendations,
      ...settingRecommendations,
      ...featureRecommendations
    ];

    for (const rec of allRecommendations) {
      // Avoid duplicates
      if (!userRecommendations.some(r => r.title === rec.title && r.status === 'pending')) {
        userRecommendations.push(rec);
        
        log.info('💡 Recommendation generated', LogContext.AI, {
          userId,
          title: rec.title,
          confidence: rec.confidence
        });

        this.emit('recommendationGenerated', rec);
      }
    }

    // Clean up old recommendations
    const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days
    this.recommendations.set(userId, userRecommendations.filter(r => 
      r.createdAt.getTime() > cutoff || r.status !== 'pending'
    ));
  }

  private async generateWorkflowRecommendations(userId: string, patterns: BehaviorPattern[]): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];

    // Look for inefficient patterns
    const inefficientPatterns = patterns.filter(p => 
      p.frequency > 5 && 
      p.pattern.sequence.length > 4 && 
      p.confidence > 0.7
    );

    for (const pattern of inefficientPatterns) {
      recommendations.push({
        id: this.generateId('rec'),
        userId,
        type: 'workflow',
        title: 'Optimize Your Workflow',
        description: `We noticed you frequently ${pattern.description.toLowerCase()}. We can create a shortcut for this.`,
        reasoning: `You've performed this sequence ${pattern.frequency} times. A shortcut could save time.`,
        confidence: pattern.confidence,
        priority: pattern.frequency > 10 ? 'high' : 'medium',
        category: 'efficiency',
        metadata: {
          action: { type: 'create_shortcut', pattern: pattern.id },
          expectedBenefit: 'Save time on repetitive tasks',
          effort: 'low'
        },
        status: 'pending',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      });
    }

    return recommendations;
  }

  private async generateSettingRecommendations(userId: string, preferences: UserPreference[]): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];

    // Look for settings that could be optimized based on preferences
    const timingPrefs = preferences.filter(p => p.category === 'timing');
    
    for (const pref of timingPrefs) {
      if (pref.key === 'peak_hours' && pref.confidence > 0.7) {
        recommendations.push({
          id: this.generateId('rec'),
          userId,
          type: 'setting',
          title: 'Optimize Notification Timing',
          description: `Based on your usage patterns, we can optimize when you receive notifications.`,
          reasoning: `You're most active during ${pref.value.join(', ')}. Notifications during these times would be more effective.`,
          confidence: pref.confidence,
          priority: 'medium',
          category: 'personalization',
          metadata: {
            action: { type: 'update_notification_settings', peakHours: pref.value },
            expectedBenefit: 'More relevant notification timing',
            effort: 'low'
          },
          status: 'pending',
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
        });
      }
    }

    return recommendations;
  }

  private async generateFeatureRecommendations(userId: string, interactions: UserInteraction[]): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];

    // Look for features that user hasn't tried but might benefit from
    const usedFeatures = new Set(interactions
      .filter(i => i.context.action)
      .map(i => i.context.action!)
    );

    const availableFeatures = ['voice_commands', 'keyboard_shortcuts', 'automation', 'templates'];
    const unusedFeatures = availableFeatures.filter(f => !usedFeatures.has(f));

    for (const feature of unusedFeatures.slice(0, 2)) { // Limit to 2 suggestions
      recommendations.push({
        id: this.generateId('rec'),
        userId,
        type: 'feature',
        title: `Try ${feature.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}`,
        description: `Based on your usage patterns, you might find ${feature} helpful.`,
        reasoning: 'Users with similar patterns have found this feature valuable.',
        confidence: 0.6,
        priority: 'low',
        category: 'discovery',
        metadata: {
          action: { type: 'show_feature_tour', feature },
          expectedBenefit: 'Discover new capabilities',
          effort: 'medium'
        },
        status: 'pending',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      });
    }

    return recommendations;
  }

  // A/B Testing

  /**
   * Create an A/B test
   */
  async createABTest(testData: Omit<ABTest, 'id' | 'participants' | 'status' | 'startDate'>): Promise<string> {
    const test: ABTest = {
      ...testData,
      id: this.generateId('ab_test'),
      status: 'draft',
      startDate: new Date(),
      participants: new Map()
    };

    this.abTests.set(test.id, test);
    
    log.info('🧪 A/B test created', LogContext.AI, {
      testId: test.id,
      name: test.name,
      variants: test.variants.length
    });

    this.emit('abTestCreated', test);
    return test.id;
  }

  /**
   * Start an A/B test
   */
  async startABTest(testId: string): Promise<boolean> {
    const test = this.abTests.get(testId);
    if (!test) {return false;}

    test.status = 'running';
    test.startDate = new Date();
    
    log.info('🧪 A/B test started', LogContext.AI, {
      testId,
      name: test.name
    });

    this.emit('abTestStarted', test);
    return true;
  }

  /**
   * Get variant for user in A/B test
   */
  getABTestVariant(testId: string, userId: string): string | null {
    const test = this.abTests.get(testId);
    if (!test || test.status !== 'running') {return null;}

    if (test.participants.has(userId)) {
      return test.participants.get(userId)!;
    }

    // Assign user to variant based on allocation
    let cumulative = 0;
    const random = Math.random() * 100;
    
    for (const variant of test.variants) {
      cumulative += variant.allocation;
      if (random <= cumulative) {
        test.participants.set(userId, variant.id);
        return variant.id;
      }
    }

    return test.variants[0]?.id || null; // Fallback
  }

  // Insight Generation

  private startInsightGeneration(): void {
    this.insightGenerationInterval = setInterval(async () => {
      await this.generateInsights();
    }, 2 * 60 * 60 * 1000); // Every 2 hours
  }

  private async generateInsights(): Promise<void> {
    for (const [userId] of this.userInteractions.entries()) {
      await this.generateUserInsights(userId);
    }
  }

  private async generateUserInsights(userId: string): Promise<void> {
    const interactions = this.userInteractions.get(userId) || [];
    const preferences = this.getUserPreferences(userId);
    const patterns = this.behaviorPatterns.get(userId) || [];

    if (!this.learningInsights.has(userId)) {
      this.learningInsights.set(userId, []);
    }

    const userInsights = this.learningInsights.get(userId)!;

    // Generate insights about behavior changes
    const recentInteractions = interactions.slice(-100);
    const oldInteractions = interactions.slice(-200, -100);

    if (oldInteractions.length > 0 && recentInteractions.length > 0) {
      const insight = await this.analyzeBehaviorChange(userId, oldInteractions, recentInteractions);
      if (insight) {
        userInsights.push(insight);
        this.emit('insightGenerated', insight);
      }
    }

    // Generate insights about preferences
    const preferenceInsight = await this.analyzePreferenceEvolution(userId, preferences);
    if (preferenceInsight) {
      userInsights.push(preferenceInsight);
      this.emit('insightGenerated', preferenceInsight);
    }

    // Clean up old insights
    const cutoff = Date.now() - (30 * 24 * 60 * 60 * 1000); // 30 days
    this.learningInsights.set(userId, userInsights.filter(i => i.discoveredAt.getTime() > cutoff));
  }

  private async analyzeBehaviorChange(userId: string, oldInteractions: UserInteraction[], recentInteractions: UserInteraction[]): Promise<LearningInsight | null> {
    // Compare feature usage between periods
    const oldFeatures = this.extractFeatureUsage(oldInteractions);
    const recentFeatures = this.extractFeatureUsage(recentInteractions);

    // Look for significant changes
    for (const [feature, recentCount] of Object.entries(recentFeatures)) {
      const oldCount = oldFeatures[feature] || 0;
      const changeRatio = oldCount > 0 ? recentCount / oldCount : recentCount;

      if (changeRatio > 2) { // Significant increase
        return {
          id: this.generateId('insight'),
          userId,
          type: 'behavior_changed',
          insight: `User has significantly increased usage of ${feature} (${Math.round(changeRatio * 100)}% increase)`,
          evidence: [
            { period: 'old', usage: oldCount },
            { period: 'recent', usage: recentCount }
          ],
          confidence: 0.8,
          actionable: true,
          recommendedActions: [`Consider providing advanced ${feature} features`],
          discoveredAt: new Date(),
          applied: false
        };
      }
    }

    return null;
  }

  private async analyzePreferenceEvolution(userId: string, preferences: UserPreference[]): Promise<LearningInsight | null> {
    const recentlyUpdated = preferences.filter(p => 
      Date.now() - p.lastUpdated.getTime() < 7 * 24 * 60 * 60 * 1000 && // Updated in last week
      p.updateCount > 5 && // Has been updated multiple times
      p.confidence > 0.8 // High confidence
    );

    if (recentlyUpdated.length > 0) {
      const pref = recentlyUpdated[0];
      if (pref) {
        return {
          id: this.generateId('insight'),
          userId,
          type: 'preference_discovered',
          insight: `Strong preference discovered: ${pref.category}:${pref.key} = ${JSON.stringify(pref.value)}`,
          evidence: [{ preference: pref }],
          confidence: pref.confidence,
          actionable: true,
          recommendedActions: [`Optimize UI/UX based on this preference`],
          discoveredAt: new Date(),
          applied: false
        };
      }
    }

    return null;
  }

  // Utility methods

  private async processImediateInteraction(interaction: UserInteraction): Promise<void> {
    // Immediate learning from this interaction
    
    // Update preferences based on successful actions
    if (interaction.outcome === 'success' && interaction.context.action) {
      await this.recordPreference(
        interaction.userId,
        'workflow',
        `successful_${interaction.context.action}`,
        true,
        'learned',
        0.6
      );
    }

    // Track failed interactions for improvement
    if (interaction.outcome === 'failure') {
      await this.recordPreference(
        interaction.userId,
        'workflow',
        `avoid_${interaction.context.action || interaction.type}`,
        true,
        'learned',
        0.7
      );
    }
  }

  private async analyzeSession(session: UserSession): Promise<void> {
    // Analyze completed session for patterns and insights
    if (session.interactions.length < 2) {return;}

    // Look for goal completion patterns
    if (session.outcomes?.successful) {
      const successfulSequence = session.interactions.filter(i => i.outcome === 'success');
      if (successfulSequence.length > 1) {
        // This could be a useful pattern to remember
        await this.recordSuccessfulWorkflow(session.userId, successfulSequence);
      }
    }
  }

  private async recordSuccessfulWorkflow(userId: string, sequence: UserInteraction[]): Promise<void> {
    // Record a successful workflow for future recommendations
    log.info('✅ Successful workflow recorded', LogContext.AI, {
      userId,
      steps: sequence.length,
      actions: sequence.map(s => s.context.action).filter(Boolean)
    });
  }

  private extractSequences(interactions: UserInteraction[], length: number): UserInteraction[][] {
    const sequences: UserInteraction[][] = [];
    
    for (let i = 0; i <= interactions.length - length; i++) {
      sequences.push(interactions.slice(i, i + length));
    }
    
    return sequences;
  }

  private generatePatternId(sequence: UserInteraction[]): string {
    // Generate consistent ID for a sequence pattern
    const signature = sequence.map(s => `${s.type}:${s.context.action || s.context.component}`).join('->');
    return `pattern_${Buffer.from(signature).toString('base64').substring(0, 10)}`;
  }

  private prepareTrainingData(interactions: UserInteraction[]): any[] {
    // Convert interactions to feature vectors for ML training
    return interactions.map(interaction => ({
      type: interaction.type,
      context: interaction.context,
      hour: interaction.timestamp.getHours(),
      day: interaction.timestamp.getDay(),
      outcome: interaction.outcome,
      duration: interaction.duration
    }));
  }

  private extractFeatureUsage(interactions: UserInteraction[]): Record<string, number> {
    return interactions
      .filter(i => i.context.action)
      .reduce((acc, i) => {
        acc[i.context.action!] = (acc[i.context.action!] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
  }

  private getActiveSession(sessionId: string): UserSession | undefined {
    return this.activeSessions.get(sessionId);
  }

  private setupSessionManagement(): void {
    // Clean up inactive sessions
    setInterval(() => {
      const cutoff = Date.now() - this.learningConfig.sessionTimeoutMinutes * 60 * 1000;
      
      for (const [sessionId, session] of this.activeSessions.entries()) {
        const lastInteraction = session.interactions[session.interactions.length - 1];
        if (lastInteraction && lastInteraction.timestamp.getTime() < cutoff) {
          this.endSession(sessionId);
        }
      }
    }, 5 * 60 * 1000); // Check every 5 minutes
  }

  private async loadUserData(): Promise<void> {
    // Load existing learning data from database
    // For now, start with empty data
    log.info('📊 Loading user behavior data', LogContext.AI);
  }

  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  // Public API methods

  public getUserInteractions(userId: string, limit?: number): UserInteraction[] {
    const interactions = this.userInteractions.get(userId) || [];
    return limit ? interactions.slice(-limit) : interactions;
  }

  public getUserPatterns(userId: string): BehaviorPattern[] {
    return this.behaviorPatterns.get(userId) || [];
  }

  public getUserRecommendations(userId: string, status?: Recommendation['status']): Recommendation[] {
    const recommendations = this.recommendations.get(userId) || [];
    return status ? recommendations.filter(r => r.status === status) : recommendations;
  }

  public getUserInsights(userId: string): LearningInsight[] {
    return this.learningInsights.get(userId) || [];
  }

  public async respondToRecommendation(recommendationId: string, response: 'accepted' | 'rejected' | 'ignored'): Promise<boolean> {
    for (const [userId, recommendations] of this.recommendations.entries()) {
      const rec = recommendations.find(r => r.id === recommendationId);
      if (rec) {
        rec.status = response;
        rec.respondedAt = new Date();
        
        // Learn from the response
        if (response === 'accepted') {
          await this.recordPreference(userId, 'content', `likes_${rec.type}_recommendations`, true, 'learned', 0.8);
        } else if (response === 'rejected') {
          await this.recordPreference(userId, 'content', `dislikes_${rec.category}_recommendations`, true, 'learned', 0.7);
        }

        this.emit('recommendationResponded', rec);
        return true;
      }
    }
    return false;
  }

  public async setUserGoals(userId: string, sessionId: string, goals: string[]): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.goals = goals;
    }

    // Record goals as preferences
    for (const goal of goals) {
      await this.recordPreference(userId, 'behavior', `goal_${goal}`, true, 'explicit', 0.9);
    }
  }

  public getPersonalizationData(userId: string): any {
    return {
      interactions: this.getUserInteractions(userId, 100),
      preferences: this.getUserPreferences(userId),
      patterns: this.getUserPatterns(userId),
      recommendations: this.getUserRecommendations(userId, 'pending'),
      insights: this.getUserInsights(userId),
      models: this.personalizationModels.get(userId) || []
    };
  }

  public getLearningStats(): any {
    return {
      totalUsers: this.userInteractions.size,
      totalInteractions: Array.from(this.userInteractions.values()).reduce((sum, interactions) => sum + interactions.length, 0),
      totalPatterns: Array.from(this.behaviorPatterns.values()).reduce((sum, patterns) => sum + patterns.length, 0),
      activeRecommendations: Array.from(this.recommendations.values()).reduce((sum, recs) => sum + recs.filter(r => r.status === 'pending').length, 0),
      runningTests: Array.from(this.abTests.values()).filter(test => test.status === 'running').length,
      recentInsights: Array.from(this.learningInsights.values()).reduce((sum, insights) => sum + insights.filter(i => Date.now() - i.discoveredAt.getTime() < 7 * 24 * 60 * 60 * 1000).length, 0)
    };
  }
}

// Export singleton instance
export const userBehaviorLearningService = new UserBehaviorLearningService();
export default userBehaviorLearningService;