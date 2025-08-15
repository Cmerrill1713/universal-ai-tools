/**
 * Feature Discovery Service
 * Helps users discover and understand available features, agents, and capabilities
 * Addresses user experience issues where features are hard to find
 */

import { EventEmitter } from 'events';

import { log, LogContext } from '@/utils/logger';

// Feature discovery types
export interface FeatureCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  priority: number;
  tags: string[];
}

export interface Feature {
  id: string;
  name: string;
  description: string;
  category: string;
  type: 'agent' | 'endpoint' | 'capability' | 'integration';
  path?: string;
  agentName?: string;
  examples: FeatureExample[];
  tags: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  popularity: number;
  lastUsed?: Date;
  usageCount: number;
  isNew?: boolean;
  isRecommended?: boolean;
  prerequisites?: string[];
}

export interface FeatureExample {
  title: string;
  description: string;
  userInput: string;
  expectedOutput?: string;
  endpoint?: string;
  method?: string;
  payload?: any;
}

export interface UserIntent {
  query: string;
  keywords: string[];
  category?: string;
  difficulty?: string;
  type?: string;
}

export interface DiscoveryResult {
  features: Feature[];
  suggestions: FeatureSuggestion[];
  categories: FeatureCategory[];
  totalResults: number;
  searchTime: number;
  confidence: number;
}

export interface FeatureSuggestion {
  feature: Feature;
  reason: string;
  confidence: number;
  matchType: 'exact' | 'semantic' | 'category' | 'popular' | 'recommended';
}

export interface UserProfile {
  userId: string;
  experience: 'beginner' | 'intermediate' | 'expert';
  preferences: string[];
  usageHistory: Record<string, number>;
  lastActivity: Date;
}

export class FeatureDiscoveryService extends EventEmitter {
  private features = new Map<string, Feature>();
  private categories = new Map<string, FeatureCategory>();
  private userProfiles = new Map<string, UserProfile>();
  private isInitialized = false;

  constructor() {
    super();
    this.initializeFeatureDatabase();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    log.info('🔍 Initializing Feature Discovery Service', LogContext.API);

    // Load feature definitions
    await this.loadFeatureDefinitions();
    
    // Load user profiles
    await this.loadUserProfiles();

    this.isInitialized = true;
    this.emit('initialized');

    log.info('✅ Feature Discovery Service initialized', LogContext.API, {
      totalFeatures: this.features.size,
      totalCategories: this.categories.size,
      totalUsers: this.userProfiles.size,
    });
  }

  /**
   * Discover features based on user intent and query
   */
  async discoverFeatures(
    userIntent: UserIntent,
    userId?: string,
    options: {
      limit?: number;
      includeExamples?: boolean;
      filterByDifficulty?: boolean;
      personalizeResults?: boolean;
    } = {}
  ): Promise<DiscoveryResult> {
    const startTime = Date.now();
    const limit = options.limit || 10;

    try {
      // Get user profile for personalization
      const userProfile = userId ? this.userProfiles.get(userId) : undefined;

      // Find matching features
      const matchingFeatures = this.findMatchingFeatures(userIntent, userProfile);

      // Generate suggestions
      const suggestions = this.generateSuggestions(
        matchingFeatures, 
        userIntent, 
        userProfile
      );

      // Apply filters and sorting
      let filteredSuggestions = suggestions;
      
      if (options.filterByDifficulty && userProfile) {
        filteredSuggestions = this.filterByUserExperience(suggestions, userProfile);
      }

      if (options.personalizeResults && userProfile) {
        filteredSuggestions = this.personalizeResults(suggestions, userProfile);
      }

      // Sort by confidence and relevance
      filteredSuggestions.sort((a, b) => {
        // Prioritize exact matches
        if (a.matchType === 'exact' && b.matchType !== 'exact') return -1;
        if (b.matchType === 'exact' && a.matchType !== 'exact') return 1;
        
        // Then by confidence
        if (Math.abs(a.confidence - b.confidence) > 0.1) {
          return b.confidence - a.confidence;
        }
        
        // Then by popularity
        return b.feature.popularity - a.feature.popularity;
      });

      // Limit results
      const limitedSuggestions = filteredSuggestions.slice(0, limit);

      // Calculate overall confidence
      const confidence = limitedSuggestions.length > 0 
        ? limitedSuggestions.reduce((sum, s) => sum + s.confidence, 0) / limitedSuggestions.length
        : 0;

      const result: DiscoveryResult = {
        features: limitedSuggestions.map(s => s.feature),
        suggestions: limitedSuggestions,
        categories: this.getRelevantCategories(limitedSuggestions),
        totalResults: matchingFeatures.length,
        searchTime: Date.now() - startTime,
        confidence,
      };

      // Track usage for analytics
      if (userId && limitedSuggestions.length > 0) {
        this.trackFeatureDiscovery(userId, userIntent, result);
      }

      this.emit('featuresDiscovered', { userIntent, result, userId });

      return result;

    } catch (error) {
      log.error('❌ Feature discovery failed', LogContext.API, { error, userIntent });
      throw error;
    }
  }

  /**
   * Get feature recommendations for a user
   */
  async getRecommendations(userId: string, limit = 5): Promise<Feature[]> {
    const userProfile = this.userProfiles.get(userId);
    
    if (!userProfile) {
      // Return popular features for new users
      return Array.from(this.features.values())
        .sort((a, b) => b.popularity - a.popularity)
        .slice(0, limit);
    }

    const recommendations: FeatureSuggestion[] = [];

    // Recommend based on usage patterns
    for (const [featureId, feature] of this.features) {
      if (userProfile.usageHistory[featureId]) continue; // Skip already used

      let confidence = 0;

      // Category preference matching
      if (userProfile.preferences.includes(feature.category)) {
        confidence += 0.3;
      }

      // Tag matching
      const matchingTags = feature.tags.filter(tag => 
        userProfile.preferences.includes(tag)
      );
      confidence += matchingTags.length * 0.1;

      // Difficulty matching
      if (this.isDifficultyAppropriate(feature, userProfile)) {
        confidence += 0.2;
      }

      // Trending features
      if (feature.isNew || feature.isRecommended) {
        confidence += 0.15;
      }

      if (confidence > 0.2) {
        recommendations.push({
          feature,
          confidence,
          reason: this.generateRecommendationReason(feature, userProfile),
          matchType: 'recommended',
        });
      }
    }

    return recommendations
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, limit)
      .map(r => r.feature);
  }

  /**
   * Search features by text query
   */
  async searchFeatures(
    query: string, 
    filters: {
      category?: string;
      type?: string;
      difficulty?: string;
      tags?: string[];
    } = {},
    limit = 20
  ): Promise<Feature[]> {
    const normalizedQuery = query.toLowerCase();
    const results: { feature: Feature; score: number }[] = [];

    for (const [, feature] of this.features) {
      let score = 0;

      // Apply filters first
      if (filters.category && feature.category !== filters.category) continue;
      if (filters.type && feature.type !== filters.type) continue;
      if (filters.difficulty && feature.difficulty !== filters.difficulty) continue;
      if (filters.tags && !filters.tags.some(tag => feature.tags.includes(tag))) continue;

      // Name matching (highest weight)
      if (feature.name.toLowerCase().includes(normalizedQuery)) {
        score += 10;
      }

      // Description matching
      if (feature.description.toLowerCase().includes(normalizedQuery)) {
        score += 5;
      }

      // Tag matching
      const matchingTags = feature.tags.filter(tag => 
        tag.toLowerCase().includes(normalizedQuery)
      );
      score += matchingTags.length * 3;

      // Example matching
      const exampleMatches = feature.examples.filter(example =>
        example.title.toLowerCase().includes(normalizedQuery) ||
        example.description.toLowerCase().includes(normalizedQuery) ||
        example.userInput.toLowerCase().includes(normalizedQuery)
      );
      score += exampleMatches.length * 2;

      // Keyword extraction and matching
      const queryWords = normalizedQuery.split(/\s+/);
      for (const word of queryWords) {
        if (word.length < 3) continue;

        if (feature.name.toLowerCase().includes(word)) score += 2;
        if (feature.description.toLowerCase().includes(word)) score += 1;
        if (feature.tags.some(tag => tag.toLowerCase().includes(word))) score += 1;
      }

      // Boost popular features
      score += feature.popularity * 0.1;

      if (score > 0) {
        results.push({ feature, score });
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(r => r.feature);
  }

  /**
   * Get all available categories
   */
  getCategories(): FeatureCategory[] {
    return Array.from(this.categories.values())
      .sort((a, b) => b.priority - a.priority);
  }

  /**
   * Get features by category
   */
  getFeaturesByCategory(categoryId: string, limit = 20): Feature[] {
    return Array.from(this.features.values())
      .filter(feature => feature.category === categoryId)
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, limit);
  }

  /**
   * Track feature usage for analytics and recommendations
   */
  async trackFeatureUsage(userId: string, featureId: string): Promise<void> {
    // Update feature usage count
    const feature = this.features.get(featureId);
    if (feature) {
      feature.usageCount++;
      feature.lastUsed = new Date();
      feature.popularity++; // Simple popularity boost
    }

    // Update user profile
    let userProfile = this.userProfiles.get(userId);
    if (!userProfile) {
      userProfile = {
        userId,
        experience: 'beginner',
        preferences: [],
        usageHistory: {},
        lastActivity: new Date(),
      };
      this.userProfiles.set(userId, userProfile);
    }

    userProfile.usageHistory[featureId] = (userProfile.usageHistory[featureId] || 0) + 1;
    userProfile.lastActivity = new Date();

    // Update preferences based on usage
    if (feature) {
      if (!userProfile.preferences.includes(feature.category)) {
        userProfile.preferences.push(feature.category);
      }

      // Add frequently used tags to preferences
      for (const tag of feature.tags) {
        if (!userProfile.preferences.includes(tag) && 
            userProfile.usageHistory[featureId] > 3) {
          userProfile.preferences.push(tag);
        }
      }
    }

    this.emit('featureUsed', { userId, featureId, feature });
  }

  /**
   * Get feature analytics
   */
  getAnalytics(): {
    totalFeatures: number;
    totalCategories: number;
    totalUsers: number;
    popularFeatures: Feature[];
    trendingCategories: { category: string; count: number }[];
    usageStats: Record<string, number>;
  } {
    const features = Array.from(this.features.values());
    const categories = Array.from(this.categories.values());

    // Calculate trending categories
    const categoryUsage = new Map<string, number>();
    for (const feature of features) {
      categoryUsage.set(
        feature.category, 
        (categoryUsage.get(feature.category) || 0) + feature.usageCount
      );
    }

    const trendingCategories = Array.from(categoryUsage.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Usage statistics
    const usageStats = {
      totalUsage: features.reduce((sum, f) => sum + f.usageCount, 0),
      averageUsage: features.length > 0 
        ? features.reduce((sum, f) => sum + f.usageCount, 0) / features.length 
        : 0,
      activeFeatures: features.filter(f => f.usageCount > 0).length,
      newFeatures: features.filter(f => f.isNew).length,
    };

    return {
      totalFeatures: features.length,
      totalCategories: categories.length,
      totalUsers: this.userProfiles.size,
      popularFeatures: features
        .sort((a, b) => b.popularity - a.popularity)
        .slice(0, 10),
      trendingCategories,
      usageStats,
    };
  }

  // Private helper methods

  private initializeFeatureDatabase(): void {
    // Initialize categories
    this.categories.set('photos', {
      id: 'photos',
      name: 'Photo & Image Processing',
      description: 'Organize, analyze, and enhance your photos with AI',
      icon: '📸',
      priority: 10,
      tags: ['photos', 'images', 'visual', 'ai'],
    });

    this.categories.set('code', {
      id: 'code',
      name: 'Code Development',
      description: 'AI-powered coding assistance and development tools',
      icon: '💻',
      priority: 9,
      tags: ['code', 'development', 'programming', 'ai'],
    });

    this.categories.set('data', {
      id: 'data',
      name: 'Data Analysis',
      description: 'Analyze, visualize, and extract insights from your data',
      icon: '📊',
      priority: 8,
      tags: ['data', 'analytics', 'visualization', 'insights'],
    });

    this.categories.set('writing', {
      id: 'writing',
      name: 'Writing & Content',
      description: 'Create, edit, and enhance written content',
      icon: '✍️',
      priority: 7,
      tags: ['writing', 'content', 'text', 'creative'],
    });

    this.categories.set('research', {
      id: 'research',
      name: 'Research & Knowledge',
      description: 'Research topics, gather information, and build knowledge',
      icon: '🔬',
      priority: 6,
      tags: ['research', 'knowledge', 'information', 'learning'],
    });

    this.categories.set('automation', {
      id: 'automation',
      name: 'Automation & Tasks',
      description: 'Automate workflows and manage tasks efficiently',
      icon: '🤖',
      priority: 5,
      tags: ['automation', 'tasks', 'workflow', 'productivity'],
    });
  }

  private async loadFeatureDefinitions(): Promise<void> {
    // Photo processing features
    this.features.set('face-detection', {
      id: 'face-detection',
      name: 'Face Detection',
      description: 'Detect and identify faces in photos with advanced AI',
      category: 'photos',
      type: 'agent',
      agentName: 'face_detection',
      examples: [
        {
          title: 'Detect faces in family photos',
          description: 'Find all people in your family vacation photos',
          userInput: 'Can you detect faces in my family photos?',
          endpoint: '/api/v1/vision/analyze',
          method: 'POST',
        },
        {
          title: 'Identify people in group photos',
          description: 'Recognize and tag people in group pictures',
          userInput: 'Help me identify who is in this group photo',
        },
      ],
      tags: ['face', 'detection', 'photos', 'ai', 'recognition'],
      difficulty: 'beginner',
      popularity: 8,
      usageCount: 0,
      isRecommended: true,
    });

    this.features.set('photo-organization', {
      id: 'photo-organization',
      name: 'Photo Organization',
      description: 'Automatically organize and categorize your photo collection',
      category: 'photos',
      type: 'agent',
      agentName: 'photo_organizer',
      examples: [
        {
          title: 'Organize photos by date',
          description: 'Sort photos into folders by when they were taken',
          userInput: 'Organize my photos by date',
        },
        {
          title: 'Group similar photos',
          description: 'Find and group similar or duplicate photos',
          userInput: 'Find duplicate photos in my collection',
        },
      ],
      tags: ['photos', 'organization', 'categorization', 'automation'],
      difficulty: 'beginner',
      popularity: 7,
      usageCount: 0,
      isRecommended: true,
    });

    // Code development features
    this.features.set('code-review', {
      id: 'code-review',
      name: 'Code Review Assistant',
      description: 'AI-powered code review and improvement suggestions',
      category: 'code',
      type: 'agent',
      agentName: 'code_assistant',
      examples: [
        {
          title: 'Review JavaScript code',
          description: 'Get suggestions for improving your JavaScript code',
          userInput: 'Can you review this JavaScript function for me?',
          endpoint: '/api/v1/agents/code_assistant',
          method: 'POST',
        },
        {
          title: 'Find code improvements',
          description: 'Identify performance and quality improvements',
          userInput: 'How can I improve this code?',
        },
      ],
      tags: ['code', 'review', 'improvement', 'quality', 'javascript'],
      difficulty: 'intermediate',
      popularity: 9,
      usageCount: 0,
      isRecommended: true,
    });

    this.features.set('code-debugging', {
      id: 'code-debugging',
      name: 'Debug Assistant',
      description: 'Help identify and fix bugs in your code',
      category: 'code',
      type: 'agent',
      agentName: 'debug_assistant',
      examples: [
        {
          title: 'Debug runtime errors',
          description: 'Fix errors that occur when running your code',
          userInput: 'I have a JavaScript function that is not working properly',
        },
        {
          title: 'Trace logic errors',
          description: 'Find logical mistakes in your code flow',
          userInput: 'My function returns unexpected results',
        },
      ],
      tags: ['code', 'debugging', 'errors', 'troubleshooting'],
      difficulty: 'intermediate',
      popularity: 8,
      usageCount: 0,
    });

    // Data analysis features
    this.features.set('data-visualization', {
      id: 'data-visualization',
      name: 'Data Visualization',
      description: 'Create charts and visualizations from your data',
      category: 'data',
      type: 'capability',
      examples: [
        {
          title: 'Create charts from CSV',
          description: 'Generate visualizations from spreadsheet data',
          userInput: 'Create a chart from my sales data',
        },
        {
          title: 'Dashboard creation',
          description: 'Build interactive dashboards',
          userInput: 'Help me create a dashboard for my business metrics',
        },
      ],
      tags: ['data', 'visualization', 'charts', 'dashboard', 'analytics'],
      difficulty: 'intermediate',
      popularity: 6,
      usageCount: 0,
    });

    // Add more features for comprehensive coverage
    await this.loadAdditionalFeatures();
  }

  private async loadAdditionalFeatures(): Promise<void> {
    // Writing and content features
    this.features.set('content-creation', {
      id: 'content-creation',
      name: 'Content Creation',
      description: 'Generate blogs, articles, and marketing content',
      category: 'writing',
      type: 'agent',
      agentName: 'content_creator',
      examples: [
        {
          title: 'Write blog posts',
          description: 'Create engaging blog content on any topic',
          userInput: 'Write a blog post about sustainable technology',
        },
        {
          title: 'Marketing copy',
          description: 'Generate compelling marketing content',
          userInput: 'Create marketing copy for my new product',
        },
      ],
      tags: ['writing', 'content', 'blogs', 'marketing', 'creative'],
      difficulty: 'beginner',
      popularity: 7,
      usageCount: 0,
    });

    // Research features
    this.features.set('research-assistant', {
      id: 'research-assistant',
      name: 'Research Assistant',
      description: 'Gather information and research topics comprehensively',
      category: 'research',
      type: 'agent',
      agentName: 'research_assistant',
      examples: [
        {
          title: 'Topic research',
          description: 'Deep dive into any subject with structured research',
          userInput: 'Research the latest trends in artificial intelligence',
        },
        {
          title: 'Fact checking',
          description: 'Verify information and sources',
          userInput: 'Help me fact-check this article',
        },
      ],
      tags: ['research', 'information', 'facts', 'analysis', 'knowledge'],
      difficulty: 'intermediate',
      popularity: 6,
      usageCount: 0,
    });

    // Automation features
    this.features.set('workflow-automation', {
      id: 'workflow-automation',
      name: 'Workflow Automation',
      description: 'Automate repetitive tasks and create efficient workflows',
      category: 'automation',
      type: 'capability',
      examples: [
        {
          title: 'Email automation',
          description: 'Set up automated email responses and workflows',
          userInput: 'Help me automate my email responses',
        },
        {
          title: 'Data processing',
          description: 'Automate data collection and processing tasks',
          userInput: 'Automate my daily data collection process',
        },
      ],
      tags: ['automation', 'workflow', 'productivity', 'tasks', 'efficiency'],
      difficulty: 'advanced',
      popularity: 5,
      usageCount: 0,
    });
  }

  private async loadUserProfiles(): Promise<void> {
    // In a real implementation, this would load from database
    // For now, we'll initialize empty
  }

  private findMatchingFeatures(
    userIntent: UserIntent, 
    userProfile?: UserProfile
  ): Feature[] {
    const query = userIntent.query.toLowerCase();
    const keywords = userIntent.keywords.map(k => k.toLowerCase());
    const matchingFeatures: Feature[] = [];

    for (const [, feature] of this.features) {
      let matches = false;

      // Direct query matching
      if (feature.name.toLowerCase().includes(query) ||
          feature.description.toLowerCase().includes(query)) {
        matches = true;
      }

      // Keyword matching
      if (keywords.some(keyword => 
        feature.tags.includes(keyword) ||
        feature.name.toLowerCase().includes(keyword) ||
        feature.description.toLowerCase().includes(keyword)
      )) {
        matches = true;
      }

      // Category matching
      if (userIntent.category && feature.category === userIntent.category) {
        matches = true;
      }

      // Type matching
      if (userIntent.type && feature.type === userIntent.type) {
        matches = true;
      }

      // Example matching
      if (feature.examples.some(example =>
        example.title.toLowerCase().includes(query) ||
        example.description.toLowerCase().includes(query) ||
        example.userInput.toLowerCase().includes(query)
      )) {
        matches = true;
      }

      if (matches) {
        matchingFeatures.push(feature);
      }
    }

    return matchingFeatures;
  }

  private generateSuggestions(
    features: Feature[],
    userIntent: UserIntent,
    userProfile?: UserProfile
  ): FeatureSuggestion[] {
    const suggestions: FeatureSuggestion[] = [];
    const query = userIntent.query.toLowerCase();
    const keywords = userIntent.keywords.map(k => k.toLowerCase());

    for (const feature of features) {
      let confidence = 0;
      let matchType: FeatureSuggestion['matchType'] = 'semantic';
      let reason = '';

      // Exact name match
      if (feature.name.toLowerCase() === query) {
        confidence = 1.0;
        matchType = 'exact';
        reason = 'Exact name match';
      }
      // Direct mention in query
      else if (feature.name.toLowerCase().includes(query)) {
        confidence = 0.9;
        matchType = 'exact';
        reason = 'Feature name mentioned in query';
      }
      // Tag matching
      else if (keywords.some(keyword => feature.tags.includes(keyword))) {
        confidence = 0.8;
        matchType = 'semantic';
        reason = 'Matches your search keywords';
      }
      // Category matching
      else if (userIntent.category === feature.category) {
        confidence = 0.7;
        matchType = 'category';
        reason = `Matches ${feature.category} category`;
      }
      // Description matching
      else if (feature.description.toLowerCase().includes(query)) {
        confidence = 0.6;
        matchType = 'semantic';
        reason = 'Relevant to your search description';
      }
      // Popular feature fallback
      else if (feature.popularity > 7) {
        confidence = 0.4;
        matchType = 'popular';
        reason = 'Popular feature that might help';
      }

      // Boost for user preferences
      if (userProfile?.preferences.includes(feature.category)) {
        confidence += 0.1;
        reason += ' (matches your interests)';
      }

      // Boost for appropriate difficulty
      if (userProfile && this.isDifficultyAppropriate(feature, userProfile)) {
        confidence += 0.05;
      }

      // Boost for new/recommended features
      if (feature.isNew || feature.isRecommended) {
        confidence += 0.05;
        if (feature.isRecommended) {
          reason += ' (recommended)';
        }
        if (feature.isNew) {
          reason += ' (new feature)';
        }
      }

      if (confidence > 0.3) {
        suggestions.push({
          feature,
          confidence: Math.min(1.0, confidence),
          reason: reason || 'Relevant to your search',
          matchType,
        });
      }
    }

    return suggestions;
  }

  private filterByUserExperience(
    suggestions: FeatureSuggestion[],
    userProfile: UserProfile
  ): FeatureSuggestion[] {
    const experienceLevel = userProfile.experience;
    
    return suggestions.filter(suggestion => {
      const feature = suggestion.feature;
      
      switch (experienceLevel) {
        case 'beginner':
          return feature.difficulty === 'beginner' || 
                 (feature.difficulty === 'intermediate' && suggestion.confidence > 0.8);
        case 'intermediate':
          return feature.difficulty !== 'advanced' || suggestion.confidence > 0.9;
        case 'expert':
          return true; // Experts can see all features
        default:
          return true;
      }
    });
  }

  private personalizeResults(
    suggestions: FeatureSuggestion[],
    userProfile: UserProfile
  ): FeatureSuggestion[] {
    return suggestions.map(suggestion => {
      let personalizedConfidence = suggestion.confidence;
      
      // Boost based on usage history
      if (userProfile.usageHistory[suggestion.feature.id]) {
        personalizedConfidence += 0.1;
      }

      // Boost based on category preferences
      if (userProfile.preferences.includes(suggestion.feature.category)) {
        personalizedConfidence += 0.1;
      }

      // Boost based on tag preferences
      const matchingTags = suggestion.feature.tags.filter(tag =>
        userProfile.preferences.includes(tag)
      );
      personalizedConfidence += matchingTags.length * 0.02;

      return {
        ...suggestion,
        confidence: Math.min(1.0, personalizedConfidence),
      };
    });
  }

  private getRelevantCategories(suggestions: FeatureSuggestion[]): FeatureCategory[] {
    const categoryIds = new Set(suggestions.map(s => s.feature.category));
    return Array.from(categoryIds)
      .map(id => this.categories.get(id))
      .filter(Boolean) as FeatureCategory[];
  }

  private isDifficultyAppropriate(feature: Feature, userProfile: UserProfile): boolean {
    const userLevel = userProfile.experience;
    const featureLevel = feature.difficulty;

    const levelOrder = { beginner: 0, intermediate: 1, advanced: 2 };
    const userLevelNum = levelOrder[userLevel];
    const featureLevelNum = levelOrder[featureLevel];

    // Allow current level and one level above
    return featureLevelNum <= userLevelNum + 1;
  }

  private generateRecommendationReason(feature: Feature, userProfile: UserProfile): string {
    const reasons: string[] = [];

    if (userProfile.preferences.includes(feature.category)) {
      reasons.push(`matches your interest in ${feature.category}`);
    }

    if (feature.isNew) {
      reasons.push('new feature you might enjoy');
    }

    if (feature.popularity > 7) {
      reasons.push('popular among users like you');
    }

    if (this.isDifficultyAppropriate(feature, userProfile)) {
      reasons.push(`appropriate for your ${userProfile.experience} level`);
    }

    return reasons.length > 0 
      ? reasons.join(', ')
      : 'might be useful for your workflow';
  }

  private trackFeatureDiscovery(
    userId: string, 
    userIntent: UserIntent, 
    result: DiscoveryResult
  ): void {
    // Track for analytics and improvement
    this.emit('discoveryTracked', {
      userId,
      query: userIntent.query,
      resultCount: result.features.length,
      confidence: result.confidence,
      searchTime: result.searchTime,
    });
  }
}

// Export singleton instance
export const featureDiscoveryService = new FeatureDiscoveryService();