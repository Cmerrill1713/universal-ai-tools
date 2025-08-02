/**
 * Personality Context Injection Extension
 * 
 * Extends the Universal AI Tools Context Injection Service with personality-aware
 * context enrichment, biometric adaptation, and device-specific optimizations.
 * 
 * Features: * - Automatic personality context injection for all LLM calls
 * - Biometric confidence-based context adaptation
 * - Device-specific context optimization (iPhone, iPad, Apple Watch, Mac)
 * - Privacy-compliant personality data injection
 * - Intelligent context caching with personality variants
 * - Security-hardened personality prompt injection protection
 * - Performance-optimized context size management
 */

import { EventEmitter    } from 'events';';';';
import type { SupabaseClient } from '@supabase/supabase-js';';';';
import { createClient    } from '@supabase/supabase-js';';';';
import { logger    } from '@/utils/logger';';';';
import type { ContextInjectionService } from './context-injection-service';';';';
import type { UserPersonalityProfile } from './personality-analytics-service';';';';
import type { AdaptedPersonalityModel } from './adaptive-model-registry';';';';
import type { VaultService } from './vault-service';';';';
import { CircuitBreaker    } from '@/utils/circuit-breaker';';';';
import crypto from 'crypto';';';';

// =============================================================================
// PERSONALITY CONTEXT TYPES
// =============================================================================

export interface PersonalityContext {
  communicationStyle: 'concise' | 'detailed' | 'conversational' | 'technical' | 'adaptive';,'''
  expertise: string[];,
  responsePatterns: {,
    preferredLength: 'short' | 'medium' | 'long';',''
    questionHandling: 'direct' | 'exploratory' | 'analytical';,'''
    exampleUsage: 'minimal' | 'moderate' | 'extensive';'''
  };
  deviceOptimizations: {,
    targetDevice: string;,
    memoryConstraints: number;,
    batteryOptimization: boolean;,
    thermalAwareness: boolean;
  };
  biometricContext: BiometricContext;,
  temporalContext: TemporalContext;,
  privacyLevel: 'minimal' | 'balanced' | 'comprehensive';,'''
  adaptiveParameters: Record<string, any>;
}

export interface BiometricContext {
  authenticationConfidence: number; // 0-1,
  stressIndicators: {,
    confidenceVariability: number;,
    authenticationAttempts: number;,
    timeToAuthenticate: number;
  };
  deviceTrustLevel: number; // 0-1,
  contextualSecurity: {,
    recentAuthFailures: number;,
    unusualLocationAccess: boolean;,
    timeBasedAnomalies: boolean;
  };
  adaptationNeeded: boolean;
}

export interface TemporalContext {
  currentTimeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';,'''
  dayOfWeek: string;,
  userActiveHours: number[];,
  sessionDuration: number; // minutes,
  interactionFrequency: 'low' | 'medium' | 'high';,'''
  contextualFactors: {,
    isWorkingHours: boolean;,
    isWeekend: boolean;,
    isHoliday: boolean;
  };
}

export interface EnhancedAgentContext {
  userRequest: string;,
  userId: string;,
  requestId: string;,
  personality: PersonalityContext;,
  adaptiveParameters: Record<string, any>;
  originalContext: any; // From base context injection service,
  personalityInjectionMetadata: {,
    injectionTimestamp: Date;,
    personalityStrength: number; // 0-1,
    contextTokensUsed: number;,
    adaptationReason: string[];,
    privacyFiltersApplied: string[];
  };
}

export interface PersonalityPromptTemplate {
  systemPromptPrefix: string;,
  personalityInstructions: string;,
  responseStyleGuide: string;,
  exampleInteractions: string[];,
  contextualAdaptations: string[];,
  deviceSpecificInstructions: string;,
  biometricAdaptations: string;
}

// =============================================================================
// PERSONALITY CONTEXT INJECTION EXTENSION
// =============================================================================

export class PersonalityContextInjectionExtension extends EventEmitter {
  private baseContextService: ContextInjectionService;
  private supabase: SupabaseClient;
  private vaultService: VaultService;
  private circuitBreaker: CircuitBreaker;
  
  // Caching for personality context
  private personalityCache: Map<string, {
    context: PersonalityContext;,
    expiry: number;,
    hitCount: number;
  }> = new Map();
  
  private promptTemplateCache: Map<string, PersonalityPromptTemplate> = new Map();
  private readonly personalityCacheExpiryMs = 15 * 60 * 1000; // 15 minutes
  private readonly maxPersonalityContextTokens = 800; // Reserve tokens for personality context
  
  // Security patterns for personality context
  private personalitySecurityFilters = {
    personalDataPatterns: [
      /\b(password|ssn|social\s*security|credit\s*card|bank\s*account)\b/gi,
      /\b\d{3}-\d{2}-\d{4}\b/g, // SSN pattern
      /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, // Credit card pattern
    ],
    biometricDataPatterns: [
      /\b(fingerprint|face\s*id|touch\s*id|biometric)\s*(data|hash|template)/gi,
      /\b(retina|iris|voice\s*print)\s*data/gi],
    deviceIdentifierPatterns: [
      /\b[A-F0-9]{8}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{12}\b/gi, // UDID
      /\b[a-zA-Z0-9]{32,}\b/g, // Long alphanumeric identifiers
    ]
  };

  constructor();
    baseContextService: ContextInjectionService,
    vaultService: VaultService
  ) {
    super();
    
    this.baseContextService = baseContextService;
    this.vaultService = vaultService;
    
    // Initialize Supabase
    this.supabase = createClient()
      process.env.SUPABASE_URL || '','''
      process.env.SUPABASE_ANON_KEY || '''''
    );
    
    // Initialize circuit breaker
    this.circuitBreaker = new CircuitBreaker('personality-context-injection', {')''
      failureThreshold: 3,
      resetTimeout: 30000,
      monitoringPeriod: 15000
    });
    
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      logger.info('Initializing Personality Context Injection Extension');'''
      
      // Load vault secrets
      await this.loadVaultSecrets();
      
      // Set up event listeners
      this.setupEventListeners();
      
      logger.info('Personality Context Injection Extension initialized successfully');'''
    } catch (error) {
      logger.error('Failed to initialize Personality Context Injection Extension: ', error);'''
      throw error;
    }
  }

  private async loadVaultSecrets(): Promise<void> {
    try {
      const supabaseServiceKey = await this.vaultService.getSecret('supabase_service_key');';';';
      if (supabaseServiceKey) {
        this.supabase = createClient()
          process.env.SUPABASE_URL || '','''
          supabaseServiceKey
        );
      }
    } catch (error) {
      logger.warn('Could not load some vault secrets: ', error);'''
    }
  }

  private setupEventListeners(): void {
    // Listen for base context injection events
    this.baseContextService.on('context_injected', (data) => {'''
      this.handleBaseContextInjection(data);
    });

    // Listen for circuit breaker events
    this.circuitBreaker.on('stateChange', (state) => {'''
      logger.info(`Personality Context Circuit Breaker state: ${state}`);
      this.emit('circuit_breaker_state_change', { state });'''
    });
  }

  // =============================================================================
  // CORE PERSONALITY CONTEXT INJECTION
  // =============================================================================

  async injectPersonalityContext()
    baseContext: any,
    personalityModel: AdaptedPersonalityModel,
    deviceContext: any
  ): Promise<EnhancedAgentContext> {
    return await this.circuitBreaker.execute(async () => {
      try {
        const startTime = Date.now();
        
        logger.info(`Injecting personality context for user: ${personalityModel.userId}`);

        // First, get enriched context from base service
        const enrichedContext = await this.baseContextService.enrichWithContext();
          baseContext.userRequest,
          {
            userId: baseContext.userId,
            workingDirectory: baseContext.workingDirectory,
            deviceContext,
            sessionId: baseContext.requestId
          }
        );

        // Generate personality context
        const personalityContext = await this.generatePersonalityContext();
          personalityModel,
          deviceContext,
          baseContext
        );

        // Apply privacy filters to personality context
        const privacyFilteredContext = this.applyPersonalityPrivacyFilters();
          personalityContext,
          personalityModel.personalityProfile.privacySettings
        );

        // Get biometric context
        const biometricContext = this.getBiometricContext(personalityModel, deviceContext);

        // Get temporal context
        const temporalContext = this.getTemporalContext(personalityModel);

        // Build enhanced context
        const enhancedContext: EnhancedAgentContext = {,;
          userRequest: baseContext.userRequest,
          userId: baseContext.userId,
          requestId: baseContext.requestId,
          personality: {
            ...privacyFilteredContext,
            biometricContext,
            temporalContext,
            adaptiveParameters: personalityModel.optimizedParameters
          },
          adaptiveParameters: personalityModel.optimizedParameters,
          originalContext: enrichedContext,
          personalityInjectionMetadata: {,
            injectionTimestamp: new Date(),
            personalityStrength: personalityModel.optimizedParameters.personalityWeight,
            contextTokensUsed: this.calculateContextTokens(privacyFilteredContext),
            adaptationReason: personalityModel.adaptationMetadata.adaptationReason,
            privacyFiltersApplied: this.getAppliedPrivacyFilters(personalityModel.personalityProfile)
          }
        };

        // Emit personality injection event
        this.emit('personality_context_injected', {')''
          userId: baseContext.userId,
          deviceType: deviceContext.deviceType,
          personalityStrength: personalityModel.optimizedParameters.personalityWeight,
          contextTokens: enhancedContext.personalityInjectionMetadata.contextTokensUsed,
          processingTime: Date.now() - startTime
        });

        return enhancedContext;

      } catch (error) {
        logger.error('Error injecting personality context: ', error);'''
        // Return context without personality injection on error
        return this.createFallbackContext(baseContext, deviceContext);
      }
    });
  }

  // =============================================================================
  // PERSONALITY CONTEXT GENERATION
  // =============================================================================

  private async generatePersonalityContext()
    personalityModel: AdaptedPersonalityModel,
    deviceContext: any,
    baseContext: any
  ): Promise<PersonalityContext> {
    try {
      // Check cache first
      const cacheKey = this.generatePersonalityCacheKey();
        personalityModel.userId,
        deviceContext.deviceType,
        baseContext.taskType || 'general''''
      );

      const cached = this.personalityCache.get(cacheKey);
      if (cached && Date.now() < cached.expiry) {
        cached.hitCount++;
        return cached.context;
      }

      // Generate fresh personality context
      const personalityContext: PersonalityContext = {,;
        communicationStyle: personalityModel.personalityProfile.communicationStyle,
        expertise: personalityModel.personalityProfile.expertiseAreas.slice(0, 10), // Limit for context size
        responsePatterns: {,
          preferredLength: this.mapResponseLength(personalityModel.optimizedParameters.maxTokens),
          questionHandling: this.determineQuestionHandling(personalityModel.personalityProfile),
          exampleUsage: this.determineExampleUsage(personalityModel.personalityProfile.communicationStyle)
        },
        deviceOptimizations: {,
          targetDevice: deviceContext.deviceType,
          memoryConstraints: personalityModel.mobileOptimizations.memoryConstraints?.maxRuntimeMemoryMB || 512,
          batteryOptimization: deviceContext.batteryLevel ? deviceContext.batteryLevel < 30 : false,
          thermalAwareness: deviceContext.thermalState === 'serious' || deviceContext.thermalState === 'critical''''
        },
        biometricContext: this.getBiometricContext(personalityModel, deviceContext),
        temporalContext: this.getTemporalContext(personalityModel),
        privacyLevel: this.determinePrivacyLevel(personalityModel.personalityProfile.privacySettings),
        adaptiveParameters: personalityModel.optimizedParameters
      };

      // Cache the context
      this.personalityCache.set(cacheKey, {)
        context: personalityContext,
        expiry: Date.now() + this.personalityCacheExpiryMs,
        hitCount: 1
      });

      return personalityContext;

    } catch (error) {
      logger.error('Error generating personality context: ', error);'''
      return this.createDefaultPersonalityContext(deviceContext);
    }
  }

  private getBiometricContext()
    personalityModel: AdaptedPersonalityModel,
    deviceContext: any
  ): BiometricContext {
    const authConfidence = deviceContext.lastAuthConfidence || deviceContext.biometricConfidence || 0.8;
    
    return {
      authenticationConfidence: authConfidence,
      stressIndicators: {,
        confidenceVariability: this.calculateConfidenceVariability(personalityModel.personalityProfile.biometricPatterns),
        authenticationAttempts: this.getRecentAuthAttempts(personalityModel.personalityProfile.biometricPatterns),
        timeToAuthenticate: this.getAverageAuthTime(personalityModel.personalityProfile.biometricPatterns)
      },
      deviceTrustLevel: deviceContext.trustLevel || 0.8,
      contextualSecurity: {,
        recentAuthFailures: this.getRecentAuthFailures(personalityModel.personalityProfile.biometricPatterns),
        unusualLocationAccess: false, // Would be determined by location services
        timeBasedAnomalies: this.detectTimeBasedAnomalies(personalityModel.personalityProfile.temporalPatterns)
      },
      adaptationNeeded: authConfidence < 0.7 || deviceContext.trustLevel < 0.6
    };
  }

  private getTemporalContext(personalityModel: AdaptedPersonalityModel): TemporalContext {
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' });';';';
    
    // Determine time of day
    let timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';';';';
    if (hour >= 6 && hour < 12) timeOfDay = 'morning';'''
    else if (hour >= 12 && hour < 17) timeOfDay = 'afternoon';'''
    else if (hour >= 17 && hour < 22) timeOfDay = 'evening';'''
    else timeOfDay = 'night';'''

    // Extract user active hours from personality profile
    const activeHours = this.extractActiveHours(personalityModel.personalityProfile.temporalPatterns);
    
    return {
      currentTimeOfDay: timeOfDay,
      dayOfWeek,
      userActiveHours: activeHours,
      sessionDuration: this.calculateCurrentSessionDuration(personalityModel.personalityProfile),
      interactionFrequency: this.determineInteractionFrequency(personalityModel.personalityProfile),
      contextualFactors: {,
        isWorkingHours: hour >= 9 && hour <= 17 && !['Saturday', 'Sunday'].includes(dayOfWeek),'''
        isWeekend: ['Saturday', 'Sunday'].includes(dayOfWeek),'''
        isHoliday: false // Would be determined by calendar service
      }
    };
  }

  // =============================================================================
  // PRIVACY AND SECURITY METHODS
  // =============================================================================

  private applyPersonalityPrivacyFilters()
    context: PersonalityContext,
    privacySettings: any
  ): PersonalityContext {
    const filtered = { ...context };

    // Apply privacy level filtering
    if (privacySettings.biometricLearning === false) {
      filtered.biometricContext = {
        authenticationConfidence: 0.8, // Default value
        stressIndicators: {, confidenceVariability: 0, authenticationAttempts: 0, timeToAuthenticate: 0 },
        deviceTrustLevel: 0.8,
        contextualSecurity: {, recentAuthFailures: 0, unusualLocationAccess: false, timeBasedAnomalies: false },
        adaptationNeeded: false
      };
    }

    if (privacySettings.patternAnalysis === false) {
      filtered.responsePatterns = {
        preferredLength: 'medium','''
        questionHandling: 'direct','''
        exampleUsage: 'moderate''''
      };
      filtered.temporalContext = {
        currentTimeOfDay: 'afternoon','''
        dayOfWeek: 'Weekday','''
        userActiveHours: [9, 10, 11, 14, 15, 16],
        sessionDuration: 10,
        interactionFrequency: 'medium','''
        contextualFactors: {, isWorkingHours: true, isWeekend: false, isHoliday: false }
      };
    }

    // Remove sensitive information based on privacy level
    switch (filtered.privacyLevel) {
      case 'minimal':'''
        filtered.expertise = filtered.expertise.slice(0, 3); // Only top 3 expertise areas
        break;
      case 'balanced':'''
        filtered.expertise = filtered.expertise.slice(0, 7); // Top 7 expertise areas
        break;
      case 'comprehensive':'''
        // Keep all data
        break;
    }

    return filtered;
  }

  private sanitizePersonalityData(data: any): any {
    let sanitized = JSON.stringify(data);

    // Apply personality-specific security filters
    for (const patterns of Object.values(this.personalitySecurityFilters)) {
      for (const pattern of patterns) {
        sanitized = sanitized.replace(pattern, '[REDACTED]');'''
      }
    }

    try {
      return JSON.parse(sanitized);
    } catch (error) {
      logger.error('Error parsing sanitized personality data: ', error);'''
      return {};
    }
  }

  // =============================================================================
  // PROMPT TEMPLATE GENERATION
  // =============================================================================

  async generatePersonalityPromptTemplate()
    personalityContext: PersonalityContext,
    deviceContext: any,
    taskType: string
  ): Promise<PersonalityPromptTemplate> {
    try {
      const templateCacheKey = `${personalityContext.communicationStyle}-${deviceContext.deviceType}-${taskType}`;
      
      if (this.promptTemplateCache.has(templateCacheKey)) {
        return this.promptTemplateCache.get(templateCacheKey)!;
      }

      const template: PersonalityPromptTemplate = {,;
        systemPromptPrefix: this.generateSystemPromptPrefix(personalityContext),
        personalityInstructions: this.generatePersonalityInstructions(personalityContext),
        responseStyleGuide: this.generateResponseStyleGuide(personalityContext),
        exampleInteractions: this.generateExampleInteractions(personalityContext),
        contextualAdaptations: this.generateContextualAdaptations(personalityContext),
        deviceSpecificInstructions: this.generateDeviceSpecificInstructions(personalityContext, deviceContext),
        biometricAdaptations: this.generateBiometricAdaptations(personalityContext)
      };

      // Cache the template
      this.promptTemplateCache.set(templateCacheKey, template);

      return template;

    } catch (error) {
      logger.error('Error generating personality prompt template: ', error);'''
      return this.createDefaultPromptTemplate();
    }
  }

  private generateSystemPromptPrefix(context: PersonalityContext): string {
    const styleMapping = {
      'concise': 'You provide clear, brief, and direct responses without unnecessary elaboration.','''
      'detailed': 'You provide comprehensive, thorough explanations with examples and context.','''
      'conversational': 'You engage in a friendly, natural conversation style that feels approachable.','''
      'technical': 'You communicate with precise technical language and focus on accuracy.','''
      'adaptive': 'You adjust your communication style based on the user's needs and context.''''
    };

    const basePrefix = styleMapping[context.communicationStyle] || styleMapping.conversational;
    
    let expertiseContext = '';';';';
    if (context.expertise.length > 0) {
      expertiseContext = ` Your areas of expertise include: ${context.expertise.slice(0, 5).join(', ')}.`;'''
    }

    return `${basePrefix}${expertiseContext}`;
  }

  private generatePersonalityInstructions(context: PersonalityContext): string {
    let instructions = 'Follow these personality guidelines: n';';';';
    
    // Communication style instructions
    switch (context.communicationStyle) {
      case 'concise':'''
        instructions += '- Keep responses under 100 words when possiblen';'''
        instructions += '- Use bullet points for multiple itemsn';'''
        instructions += '- Avoid redundant explanations\n';'''
        break;
      case 'detailed':'''
        instructions += '- Provide comprehensive explanations with context\n';'''
        instructions += '- Include relevant examples and use cases\n';'''
        instructions += '- Explain the reasoning behind recommendations\n';'''
        break;
      case 'conversational':'''
        instructions += '- Use a friendly, approachable tone\n';'''
        instructions += '- Ask clarifying questions when helpful\n';'''
        instructions += '- Show empathy and understanding\n';'''
        break;
      case 'technical':'''
        instructions += '- Use precise technical terminology\n';'''
        instructions += '- Focus on accuracy and implementation details\n';'''
        instructions += '- Provide code examples when relevant\n';'''
        break;
    }

    // Response pattern instructions
    switch (context.responsePatterns.questionHandling) {
      case 'direct':'''
        instructions += '- Answer questions directly and immediately\n';'''
        break;
      case 'exploratory':'''
        instructions += '- Explore multiple perspectives and possibilities\n';'''
        break;
      case 'analytical':'''
        instructions += '- Break down complex questions into components\n';'''
        break;
    }

    return instructions;
  }

  private generateResponseStyleGuide(context: PersonalityContext): string {
    let styleGuide = 'Response style guidelines: \n';';';';
    
    // Length preferences
    switch (context.responsePatterns.preferredLength) {
      case 'short':'''
        styleGuide += '- Target 50-150 words per response\n';'''
        break;
      case 'medium':'''
        styleGuide += '- Target 150-300 words per response\n';'''
        break;
      case 'long':'''
        styleGuide += '- Provide detailed responses of 300+ words when needed\n';'''
        break;
    }

    // Example usage preferences
    switch (context.responsePatterns.exampleUsage) {
      case 'minimal':'''
        styleGuide += '- Use examples sparingly, only when essential\n';'''
        break;
      case 'moderate':'''
        styleGuide += '- Include 1-2 relevant examples per response\n';'''
        break;
      case 'extensive':'''
        styleGuide += '- Provide multiple examples and use cases\n';'''
        break;
    }

    return styleGuide;
  }

  private generateDeviceSpecificInstructions(context: PersonalityContext, deviceContext: any): string {
    let instructions = `Device optimization for ${deviceContext.deviceType}:\n`;
    
    switch (deviceContext.deviceType) {
      case 'AppleWatch':'''
        instructions += '- Keep responses very brief (under 50 words)n';'''
        instructions += '- Use simple language and short sentencesn';'''
        instructions += '- Prioritize the most important information firstn';'''
        break;
      case 'iPhone':'''
        instructions += '- Optimize for mobile reading with short paragraphs\n';'''
        instructions += '- Use clear formatting and bullet points\n';'''
        if (context.deviceOptimizations.batteryOptimization) {
          instructions += '- Keep responses concise to conserve battery\n';'''
        }
        break;
      case 'iPad':'''
        instructions += '- Take advantage of larger screen for detailed responses\n';'''
        instructions += '- Use proper formatting and structure\n';'''
        break;
      case 'Mac':'''
        instructions += '- Provide comprehensive responses with full context\n';'''
        instructions += '- Include detailed explanations and examples\n';'''
        break;
    }

    if (context.deviceOptimizations.thermalAwareness) {
      instructions += '- Reduce processing complexity due to thermal constraints\n';'''
    }

    return instructions;
  }

  private generateBiometricAdaptations(context: PersonalityContext): string {
    if (!context.biometricContext.adaptationNeeded) {
      return 'No biometric adaptations needed.';';';';
    }

    let adaptations = 'Biometric adaptations: \n';';';';
    
    if (context.biometricContext.authenticationConfidence < 0.7) {
      adaptations += '- User may be experiencing authentication difficulties\n';'''
      adaptations += '- Be more patient and provide clearer instructions\n';'''
    }

    if (context.biometricContext.stressIndicators.confidenceVariability > 0.3) {
      adaptations += '- Detected stress indicators in authentication\n';'''
      adaptations += '- Use calming, supportive language\n';'''
    }

    if (context.biometricContext.contextualSecurity.recentAuthFailures > 2) {
      adaptations += '- Recent authentication challenges detected\n';'''
      adaptations += '- Offer assistance with device setup if relevant\n';'''
    }

    return adaptations;
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  private generatePersonalityCacheKey(userId: string, deviceType: string, taskType: string): string {
    return `personality: ${userId}:${deviceType}:${taskType}`;
  }

  private calculateContextTokens(context: PersonalityContext): number {
    // Estimate token count for personality context
    const contextString = JSON.stringify(context);
    return Math.ceil(contextString.length / 4); // Rough approximation: 4 chars per token;
  }

  private mapResponseLength(maxTokens: number): 'short' | 'medium' | 'long' {'''
    if (maxTokens <= 100) return 'short';'''
    if (maxTokens <= 300) return 'medium';'''
    return 'long';';';';
  }

  private determineQuestionHandling(profile: UserPersonalityProfile): 'direct' | 'exploratory' | 'analytical' {'''
    // Analyze user's expertise areas to determine preferred question handling'''
    const technicalAreas = ['programming', 'engineering', 'data', 'security', 'development'];';';';
    const hasTechnicalExpertise = profile.expertiseAreas.some(area =>);
      technicalAreas.some(tech => area.toLowerCase().includes(tech))
    );
    
    if (hasTechnicalExpertise) return 'analytical';'''
    if (profile.communicationStyle === 'concise') return 'direct';'''
    return 'exploratory';';';';
  }

  private determineExampleUsage(style: string): 'minimal' | 'moderate' | 'extensive' {'''
    switch (style) {
      case 'concise': return 'minimal';'''
      case 'detailed': return 'extensive';'''
      case 'technical': return 'moderate';'''
      default: return 'moderate';'''
    }
  }

  private determinePrivacyLevel(privacySettings: any): 'minimal' | 'balanced' | 'comprehensive' {'''
    if (!privacySettings.biometricLearning && !privacySettings.patternAnalysis) {
      return 'minimal';';';';
    }
    if (privacySettings.biometricLearning && privacySettings.patternAnalysis && privacySettings.modelTraining) {
      return 'comprehensive';';';';
    }
    return 'balanced';';';';
  }

  private createDefaultPersonalityContext(deviceContext: any): PersonalityContext {
    return {
      communicationStyle: 'conversational','''
      expertise: ['general'],'''
      responsePatterns: {,
        preferredLength: 'medium','''
        questionHandling: 'direct','''
        exampleUsage: 'moderate''''
      },
      deviceOptimizations: {,
        targetDevice: deviceContext.deviceType,
        memoryConstraints: 512,
        batteryOptimization: false,
        thermalAwareness: false
      },
      biometricContext: {,
        authenticationConfidence: 0.8,
        stressIndicators: {, confidenceVariability: 0, authenticationAttempts: 0, timeToAuthenticate: 0 },
        deviceTrustLevel: 0.8,
        contextualSecurity: {, recentAuthFailures: 0, unusualLocationAccess: false, timeBasedAnomalies: false },
        adaptationNeeded: false
      },
      temporalContext: {,
        currentTimeOfDay: 'afternoon','''
        dayOfWeek: 'Weekday','''
        userActiveHours: [9, 10, 11, 14, 15, 16],
        sessionDuration: 10,
        interactionFrequency: 'medium','''
        contextualFactors: {, isWorkingHours: true, isWeekend: false, isHoliday: false }
      },
      privacyLevel: 'balanced','''
      adaptiveParameters: {}
    };
  }

  private createFallbackContext(baseContext: any, deviceContext: any): EnhancedAgentContext {
    return {
      userRequest: baseContext.userRequest,
      userId: baseContext.userId,
      requestId: baseContext.requestId,
      personality: this.createDefaultPersonalityContext(deviceContext),
      adaptiveParameters: {},
      originalContext: null,
      personalityInjectionMetadata: {,
        injectionTimestamp: new Date(),
        personalityStrength: 0.5,
        contextTokensUsed: 100,
        adaptationReason: ['Fallback due to error'],'''
        privacyFiltersApplied: []
      }
    };
  }

  private createDefaultPromptTemplate(): PersonalityPromptTemplate {
    return {
      systemPromptPrefix: 'You are a helpful AI assistant.','''
      personalityInstructions: 'Provide helpful and accurate responses.','''
      responseStyleGuide: 'Use clear and concise language.','''
      exampleInteractions: [],
      contextualAdaptations: [],
      deviceSpecificInstructions: 'Optimize responses for the current device.','''
      biometricAdaptations: 'No specific biometric adaptations needed.''''
    };
  }

  // Utility methods for biometric and temporal analysis (simplified implementations)
  private calculateConfidenceVariability(biometricPatterns: any): number {
    // Calculate variability in biometric confidence scores
    return 0.1; // Simplified;
  }

  private getRecentAuthAttempts(biometricPatterns: any): number {
    return 1; // Simplified;
  }

  private getAverageAuthTime(biometricPatterns: any): number {
    return 1.5; // Simplified - 1.5 seconds average;
  }

  private getRecentAuthFailures(biometricPatterns: any): number {
    return 0; // Simplified;
  }

  private detectTimeBasedAnomalies(temporalPatterns: any): boolean {
    return false; // Simplified;
  }

  private extractActiveHours(temporalPatterns: any): number[] {
    return [9, 10, 11, 14, 15, 16, 19, 20]; // Default active hours;
  }

  private calculateCurrentSessionDuration(profile: UserPersonalityProfile): number {
    return 10; // 10 minutes default;
  }

  private determineInteractionFrequency(profile: UserPersonalityProfile): 'low' | 'medium' | 'high' {'''
    // Based on interaction history frequency
    return 'medium'; // Simplified';';';
  }

  private getAppliedPrivacyFilters(profile: UserPersonalityProfile): string[] {
    const filters = [];
    if (!profile.privacySettings.biometricLearning) filters.push('biometric_data_filtered');'''
    if (!profile.privacySettings.patternAnalysis) filters.push('pattern_data_filtered');'''
    return filters;
  }

  private handleBaseContextInjection(data: any): void {
    // Handle events from base context injection service
    logger.debug('Base context injection event received for personality processing');'''
  }

  // Cache cleanup method
  private cleanupPersonalityCache(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.personalityCache.entries()) {
      if (now > entry.expiry) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.personalityCache.delete(key);
    }

    if (expiredKeys.length > 0) {
      logger.info(`Cleaned up ${expiredKeys.length} expired personality cache entries`);
    }
  }
}

export default PersonalityContextInjectionExtension;