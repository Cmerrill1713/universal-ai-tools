/**
 * Sweet Athena Integration Service
 *
 * Extends the Natural Language Widget Generator with Sweet Athena avatar assistance
 * Provides personality-aware widget generation and voice-guided development
 */

import { EventEmitter } from 'events';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../utils/enhanced-logger';
import {
  type GeneratedWidgetResult,
  type NLWidgetRequest,
  NaturalLanguageWidgetGenerator,
} from './natural-language-widget-generator';
import {
  type PersonalityMode,
  type SweetAthenaState,
  SweetAthenaStateManager,
} from './sweet-athena-state-manager';
import { PixelStreamingBridge } from './pixel-streaming-bridge';
import { SpeechService } from './speech-service';
import { v4 as uuidv4 } from 'uuid';

export interface SweetAthenaWidgetRequest extends NLWidgetRequest {
  sweetAthenaConfig?: {
    personalityMode?: PersonalityMode;
    provideFeedback?: boolean;
    voiceGuidance?: boolean;
    adaptPersonality?: boolean;
    showAvatar?: boolean;
  };
}

export interface SweetAthenaWidgetResult extends GeneratedWidgetResult {
  sweetAthenaResponse: {
    personalityUsed: PersonalityMode;
    voiceGuidance?: {
      audioUrl: string;
      transcript: string;
      duration: number;
    };
    avatarFeedback: {
      encouragement: string;
      suggestions: string[];
      nextSteps: string[];
    };
    personalityAdaptation?: {
      suggestedPersonality: PersonalityMode;
      reason: string;
      confidence: number;
    };
  };
}

export interface WidgetComplexityAnalysis {
  complexity: 'simple' | 'moderate' | 'complex' | 'advanced';
  confidenceScore: number;
  factors: {
    componentCount: number;
    stateManagement: boolean;
    apiIntegration: boolean;
    userInteraction: number; // 0-1 scale
    dataVisualization: boolean;
  };
  estimatedTime: string;
  recommendedPersonality: PersonalityMode;
}

export class SweetAthenaIntegrationService extends EventEmitter {
  private stateManager: SweetAthenaStateManager;
  private pixelStreamingBridge: PixelStreamingBridge | null = null;
  private nlWidgetGenerator: NaturalLanguageWidgetGenerator;
  private speechService: SpeechService;
  private isInitialized = false;

  // Personality-specific responses for different widget types
  private readonly personalityResponses = {
    sweet: {
      encouragement: [
        "You're doing wonderfully! Let me help you create something beautiful.",
        'I love your creativity! This widget is going to be amazing.',
        "Such a thoughtful idea! I'm excited to help bring it to life.",
      ],
      guidance: {
        simple: "This looks like a fun little widget to create! Let's make it together.",
        moderate: "Ooh, this is getting interesting! I'll guide you through each step.",
        complex: "This is quite ambitious - I admire that! Let's break it down together.",
        advanced: "Wow, you're really pushing boundaries! I'll be your dedicated assistant.",
      },
    },
    shy: {
      encouragement: [
        'Um... this looks really nice. I think I can help with this.',
        "I hope you don't mind me suggesting... but maybe we could try this approach?",
        "Your idea is really good. I'll do my best to help you.",
      ],
      guidance: {
        simple: 'This seems manageable... I think we can do this together.',
        moderate: "This might be a bit challenging, but I'll try my best to help.",
        complex: "Oh my... this is quite complex. But I'll help however I can.",
        advanced: "This is really advanced... but I'll give it my all!",
      },
    },
    confident: {
      encouragement: [
        "Excellent choice! Let's build something impressive together.",
        "I can definitely make this happen for you. Let's get to work!",
        'Perfect! I know exactly how to approach this. Follow my lead.',
      ],
      guidance: {
        simple: "This will be quick and easy. I've got this handled.",
        moderate: "Solid request I'll have this built efficiently for you.",
        complex: "Challenging, but well within my capabilities. Let's execute.",
        advanced: "Now we're talking! This is the kind of project I excel at.",
      },
    },
    caring: {
      encouragement: [
        "I can tell this is important to you. I'm here to help every step of the way.",
        "Let's work together to make sure this meets all your needs.",
        "I want to make sure we create exactly what you're envisioning.",
      ],
      guidance: {
        simple: 'This is a lovely idea. Let me help you craft it with care.',
        moderate: "I can see what you're trying to achieve. Let's build this thoughtfully.",
        complex: "This requires attention to detail. I'll make sure we get it right.",
        advanced: "This is a significant undertaking. I'm committed to helping you succeed.",
      },
    },
    playful: {
      encouragement: [
        "Ooh, this sounds fun! Let's make something awesome!",
        "I love where your head's at! This is going to be epic!",
        'Yes! This is exactly the kind of creative challenge I live for!',
      ],
      guidance: {
        simple: "Easy peasy! Let's whip this up in no time!",
        moderate: "Now we're cooking! This is going to be so cool!",
        complex: 'Ooh, a puzzle! I love figuring out complex builds!',
        advanced: 'Mind. Blown. This is going to be absolutely incredible!',
      },
    },
  };

  constructor(
    private supabase: SupabaseClient,
    nlGenerator?: NaturalLanguageWidgetGenerator
  ) {
    super();

    this.stateManager = new SweetAthenaStateManager();
    this.nlWidgetGenerator = nlGenerator || new NaturalLanguageWidgetGenerator(supabase, logger);
    this.speechService = new SpeechService(supabase);

    this.setupEventHandlers();
  }

  /**
   * Initialize Sweet Athena Integration
   */
  async initialize(userId: string, pixelStreamingConfig?: any): Promise<void> {
    try {
      logger.info('Initializing Sweet Athena Integration Service', undefined, { userId });

      // Initialize Pixel Streaming if config provided
      if (pixelStreamingConfig) {
        this.pixelStreamingBridge = new PixelStreamingBridge(pixelStreamingConfig);
        await this.pixelStreamingBridge.initialize();
      }

      // Initialize state manager
      await this.stateManager.initialize(userId, this.pixelStreamingBridge || undefined);

      this.isInitialized = true;
      this.emit('initialized', { userId, avatarEnabled: !!this.pixelStreamingBridge });

      logger.info('Sweet Athena Integration Service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Sweet Athena Integration:', undefined, error);
      throw error;
    }
  }

  /**
   * Generate widget with Sweet Athena assistance
   */
  async generateWidgetWithSweetAthena(
    request SweetAthenaWidgetRequest
  ): Promise<SweetAthenaWidgetResult> {
    if (!this.isInitialized) {
      throw new Error('Sweet Athena Integration not initialized');
    }

    const startTime = Date.now();
    const requestId = uuidv4();

    try {
      logger.info(`🌸 Starting Sweet Athena widget generation: ${requestId}`, undefined, {
        inputType: requestinputType,
        userId: requestuserId,
        personalityMode: requestsweetAthenaConfig?.personalityMode,
      });

      // Set interaction mode
      await this.stateManager.setInteractionMode('widget_assistance', request_input;

      // Analyze widget complexity
      const complexityAnalysis = await this.analyzeWidgetComplexity(request_input;

      // Adapt personality if requested
      if (requestsweetAthenaConfig?.adaptPersonality) {
        await this.adaptPersonalityToWidget(complexityAnalysis, request;
      } else if (requestsweetAthenaConfig?.personalityMode) {
        await this.stateManager.setPersonality(requestsweetAthenaConfig.personalityMode);
      }

      // Get current personality state
      const currentState = this.stateManager.getCurrentState();
      const personality = currentState.personality.mode;

      // Provide initial voice guidance if requested
      let initialGuidance;
      if (requestsweetAthenaConfig?.voiceGuidance) {
        initialGuidance = await this.provideInitialGuidance(
          request
          complexityAnalysis,
          personality
        );
      }

      // Generate widget with enhanced context
      const enhancedRequest: NLWidgetRequest = {
        ...request
        context: {
          ...requestcontext,
          sweetAthenaPersonality: personality,
          complexityLevel: complexityAnalysis.complexity,
          guidanceStyle: this.getGuidanceStyle(personality),
        },
      };

      const widgetResult = await this.nlWidgetGenerator.generateWidget(enhancedRequest);

      // Generate Sweet Athena feedback
      const avatarFeedback = await this.generateAvatarFeedback(
        widgetResult,
        complexityAnalysis,
        personality
      );

      // Provide completion voice guidance
      let completionGuidance;
      if (requestsweetAthenaConfig?.voiceGuidance) {
        completionGuidance = await this.provideCompletionGuidance(
          widgetResult,
          complexityAnalysis,
          personality
        );
      }

      // Create Sweet Athena enhanced result
      const sweetAthenaResult: SweetAthenaWidgetResult = {
        ...widgetResult,
        sweetAthenaResponse: {
          personalityUsed: personality,
          voiceGuidance: completionGuidance,
          avatarFeedback,
          personalityAdaptation: requestsweetAthenaConfig?.adaptPersonality
            ? {
                suggestedPersonality: complexityAnalysis.recommendedPersonality,
                reason: this.getPersonalityAdaptationReason(complexityAnalysis),
                confidence: complexityAnalysis.confidenceScore,
              }
            : undefined,
        },
      };

      // Update user engagement based on interaction
      this.updateUserEngagement(request widgetResult);

      // Emit events
      this.emit('widgetGenerated', {
        requestId,
        result: sweetAthenaResult,
        personality,
        complexity: complexityAnalysis.complexity,
      });

      logger.info(`✅ Sweet Athena widget generation completed in ${Date.now() - startTime}ms`);

      return sweetAthenaResult;
    } catch (error) {
      logger.error('Sweet Athena widget generation failed:', undefined, { _error requestId });
      throw error;
    }
  }

  /**
   * Analyze widget complexity to determine appropriate personality and guidance
   */
  private async analyzeWidgetComplexity(input string): Promise<WidgetComplexityAnalysis> {
    const lowerInput = _inputtoLowerCase();

    // Component count analysis
    const componentKeywords = [
      'button',
      '_input,
      'form',
      'table',
      'chart',
      'modal',
      'dropdown',
      'tab',
      'card',
    ];
    const componentCount = componentKeywords.filter((keyword) =>
      lowerInput.includes(keyword)
    ).length;

    // State management analysis
    const stateKeywords = ['state', 'dynamic', 'interactive', 'update', 'change', 'toggle'];
    const stateManagement = stateKeywords.some((keyword) => lowerInput.includes(keyword));

    // API integration analysis
    const apiKeywords = ['api', 'fetch', 'request, 'data', 'load', 'save', 'submit'];
    const apiIntegration = apiKeywords.some((keyword) => lowerInput.includes(keyword));

    // User interaction analysis
    const interactionKeywords = ['click', 'hover', 'drag', 'sort', 'filter', 'search', 'select'];
    const interactionScore =
      interactionKeywords.filter((keyword) => lowerInput.includes(keyword)).length /
      interactionKeywords.length;

    // Data visualization analysis
    const visualKeywords = ['chart', 'graph', 'visualization', 'plot', 'dashboard', 'metric'];
    const dataVisualization = visualKeywords.some((keyword) => lowerInput.includes(keyword));

    // Calculate complexity
    let complexityScore = 0;
    complexityScore += componentCount * 0.2;
    complexityScore += stateManagement ? 0.3 : 0;
    complexityScore += apiIntegration ? 0.3 : 0;
    complexityScore += interactionScore * 0.2;
    complexityScore += dataVisualization ? 0.2 : 0;

    // Determine complexity level
    let complexity: WidgetComplexityAnalysis['complexity'];
    let estimatedTime: string;
    let recommendedPersonality: PersonalityMode;

    if (complexityScore <= 0.3) {
      complexity = 'simple';
      estimatedTime = '2-5 minutes';
      recommendedPersonality = 'playful';
    } else if (complexityScore <= 0.6) {
      complexity = 'moderate';
      estimatedTime = '5-15 minutes';
      recommendedPersonality = 'sweet';
    } else if (complexityScore <= 0.8) {
      complexity = 'complex';
      estimatedTime = '15-30 minutes';
      recommendedPersonality = 'confident';
    } else {
      complexity = 'advanced';
      estimatedTime = '30+ minutes';
      recommendedPersonality = 'caring';
    }

    return {
      complexity,
      confidenceScore: Math.min(complexityScore, 1.0),
      factors: {
        componentCount,
        stateManagement,
        apiIntegration,
        userInteraction: interactionScore,
        dataVisualization,
      },
      estimatedTime,
      recommendedPersonality,
    };
  }

  /**
   * Adapt personality based on widget complexity
   */
  private async adaptPersonalityToWidget(
    _analysis WidgetComplexityAnalysis,
    request SweetAthenaWidgetRequest
  ): Promise<void> {
    try {
      await this.stateManager.setPersonality(_analysisrecommendedPersonality);

      this.emit('personalityAdapted', {
        from: this.stateManager.getCurrentState().personality.mode,
        to: _analysisrecommendedPersonality,
        reason: this.getPersonalityAdaptationReason(_analysis,
        complexity: _analysiscomplexity,
      });
    } catch (error) {
      logger.error('Failed to adapt personality:', undefined, error);
    }
  }

  /**
   * Get personality adaptation reason
   */
  private getPersonalityAdaptationReason(_analysis WidgetComplexityAnalysis): string {
    switch (_analysiscomplexity) {
      case 'simple':
        return 'Simple widgets work best with a playful, energetic approach';
      case 'moderate':
        return 'Moderate complexity benefits from a sweet, encouraging personality';
      case 'complex':
        return 'Complex widgets require confidence and clear guidance';
      case 'advanced':
        return 'Advanced projects need careful, caring support throughout';
      default:
        return 'Personality adapted based on widget requirements';
    }
  }

  /**
   * Provide initial guidance for widget creation
   */
  private async provideInitialGuidance(
    request SweetAthenaWidgetRequest,
    _analysis WidgetComplexityAnalysis,
    personality: PersonalityMode
  ): Promise<{ audioUrl: string; transcript: string; duration: number }> {
    const responses = this.personalityResponses[personality];
    const encouragement =
      responses.encouragement[Math.floor(Math.random() * responses.encouragement.length)];
    const guidance = responses.guidance[_analysiscomplexity];

    const transcript = `${encouragement} ${guidance} This should take about ${_analysisestimatedTime}. Let's get started!`;

    try {
      // Generate voice guidance with personality-specific voice settings
      const voiceSettings = this.getVoiceSettings(personality);

      const audioResult = await this.speechService.synthesizeSpeech({
        text: transcript,
        voiceProfile: {
          voice_id: personality,
          ...voiceSettings,
        },
        format: 'mp3',
      });

      // Send to avatar if streaming is available
      if (this.pixelStreamingBridge) {
        await this.pixelStreamingBridge.sendTextInput(transcript, personality);
      }

      return {
        audioUrl: `/api/speech/guidance/${uuidv4()}`,
        transcript,
        duration: Math.ceil(transcript.length / 15), // Rough estimation: 15 chars per second
      };
    } catch (error) {
      logger.error('Failed to generate initial guidance:', undefined, error);
      return {
        audioUrl: '',
        transcript,
        duration: 0,
      };
    }
  }

  /**
   * Provide completion guidance after widget generation
   */
  private async provideCompletionGuidance(
    widgetResult: GeneratedWidgetResult,
    _analysis WidgetComplexityAnalysis,
    personality: PersonalityMode
  ): Promise<{ audioUrl: string; transcript: string; duration: number }> {
    const completionMessages = {
      sweet: [
        `Perfect! I've created your ${widgetResult.widget.name} widget with so much care.`,
        `Your ${widgetResult.widget.name} is ready! I hope you love what we built together.`,
        `All done! Your beautiful ${widgetResult.widget.name} widget is ready to use.`,
      ],
      shy: [
        `Um... I think your ${widgetResult.widget.name} turned out really well.`,
        `I hope you like the ${widgetResult.widget.name} I made for you.`,
        `Your widget is finished... I tried my best with the ${widgetResult.widget.name}.`,
      ],
      confident: [
        `Excellent! Your ${widgetResult.widget.name} widget is built to perfection.`,
        `Mission accomplished! Your ${widgetResult.widget.name} is ready and optimized.`,
        `Outstanding! I've delivered exactly what you requested with your ${widgetResult.widget.name}.`,
      ],
      caring: [
        `I've carefully crafted your ${widgetResult.widget.name} with all the features you need.`,
        `Your ${widgetResult.widget.name} is complete. I made sure every detail serves your purpose.`,
        `All finished! Your ${widgetResult.widget.name} widget is ready and thoroughly tested.`,
      ],
      playful: [
        `Ta-da! Your awesome ${widgetResult.widget.name} widget is ready to rock!`,
        `Boom! Just finished your super cool ${widgetResult.widget.name}!`,
        `Woo-hoo! Your amazing ${widgetResult.widget.name} widget is complete!`,
      ],
    };

    const completionMessage =
      completionMessages[personality][
        Math.floor(Math.random() * completionMessages[personality].length)
      ];

    const nextSteps = [
      'You can preview it right here in the interface.',
      'The code is ready to copy or download.',
      'Tests are included to ensure everything works perfectly.',
    ];

    const transcript = `${completionMessage} ${nextSteps.join(' ')}`;

    try {
      const voiceSettings = this.getVoiceSettings(personality);

      const audioResult = await this.speechService.synthesizeSpeech({
        text: transcript,
        voiceProfile: {
          voice_id: personality,
          ...voiceSettings,
        },
        format: 'mp3',
      });

      // Send to avatar if streaming is available
      if (this.pixelStreamingBridge) {
        await this.pixelStreamingBridge.sendTextInput(transcript, personality);
      }

      return {
        audioUrl: `/api/speech/completion/${uuidv4()}`,
        transcript,
        duration: Math.ceil(transcript.length / 15),
      };
    } catch (error) {
      logger.error('Failed to generate completion guidance:', undefined, error);
      return {
        audioUrl: '',
        transcript,
        duration: 0,
      };
    }
  }

  /**
   * Generate avatar feedback for the created widget
   */
  private async generateAvatarFeedback(
    widgetResult: GeneratedWidgetResult,
    _analysis WidgetComplexityAnalysis,
    personality: PersonalityMode
  ): Promise<{ encouragement: string; suggestions: string[]; nextSteps: string[] }> {
    const responses = this.personalityResponses[personality];
    const encouragement =
      responses.encouragement[Math.floor(Math.random() * responses.encouragement.length)];

    // Generate personality-specific suggestions
    const suggestions = this.generatePersonalitySuggestions(widgetResult, _analysis personality);

    // Generate next steps
    const nextSteps = [
      'Test the widget in the preview panel',
      'Customize the styling to match your design',
      'Copy the code to your project',
      'Run the included tests to verify functionality',
    ];

    // Add complexity-specific next steps
    if (_analysiscomplexity === 'complex' || _analysiscomplexity === 'advanced') {
      nextSteps.push('Consider breaking into smaller components for maintainability');
      nextSteps.push('Add _errorhandling for production use');
    }

    return {
      encouragement,
      suggestions,
      nextSteps,
    };
  }

  /**
   * Generate personality-specific suggestions
   */
  private generatePersonalitySuggestions(
    widgetResult: GeneratedWidgetResult,
    _analysis WidgetComplexityAnalysis,
    personality: PersonalityMode
  ): string[] {
    const baseSuggestions = widgetResult.metadata.suggestions || [];
    const personalitySuggestions: string[] = [];

    switch (personality) {
      case 'sweet':
        personalitySuggestions.push(
          'Consider adding gentle animations for a smoother user experience'
        );
        personalitySuggestions.push('Maybe add some lovely color variations?');
        break;
      case 'shy':
        personalitySuggestions.push('Perhaps... you might want to add some subtle hover effects?');
        personalitySuggestions.push(
          "If you don't mind, maybe consider accessibility improvements?"
        );
        break;
      case 'confident':
        personalitySuggestions.push('Add keyboard shortcuts for power users');
        personalitySuggestions.push('Implement advanced filtering and sorting options');
        break;
      case 'caring':
        personalitySuggestions.push('Consider adding helpful tooltips for user guidance');
        personalitySuggestions.push('Make sure error.messages are clear and actionable');
        break;
      case 'playful':
        personalitySuggestions.push('How about some fun micro-interactions?');
        personalitySuggestions.push('Maybe add some delightful animations or easter eggs!');
        break;
    }

    return [...baseSuggestions, ...personalitySuggestions];
  }

  /**
   * Get voice settings for personality
   */
  private getVoiceSettings(personality: PersonalityMode): any {
    const settingsMap = {
      sweet: { pitch: 1.1, speaking_rate: 1.0, stability: 0.8, similarity_boost: 0.8 },
      shy: { pitch: 0.9, speaking_rate: 0.8, stability: 0.9, similarity_boost: 0.7 },
      confident: { pitch: 1.0, speaking_rate: 1.1, stability: 0.7, similarity_boost: 0.9 },
      caring: { pitch: 1.05, speaking_rate: 0.95, stability: 0.85, similarity_boost: 0.8 },
      playful: { pitch: 1.15, speaking_rate: 1.1, stability: 0.6, similarity_boost: 0.9 },
    };

    return settingsMap[personality];
  }

  /**
   * Get guidance style for personality
   */
  private getGuidanceStyle(personality: PersonalityMode): string {
    const styleMap = {
      sweet: 'encouraging and nurturing',
      shy: 'gentle and supportive',
      confident: 'direct and efficient',
      caring: 'thoughtful and detailed',
      playful: 'energetic and creative',
    };

    return styleMap[personality];
  }

  /**
   * Update user engagement based on interaction
   */
  private updateUserEngagement(
    request SweetAthenaWidgetRequest,
    result: GeneratedWidgetResult
  ): void {
    // Calculate engagement score based on various factors
    let engagementScore = 0.5; // Base score

    // Boost for voice interaction
    if (requestinputType === 'voice') {
      engagementScore += 0.2;
    }

    // Boost for detailed requests
    if (request_inputlength > 100) {
      engagementScore += 0.1;
    }

    // Boost for high confidence results
    if (result.metadata.confidence > 0.8) {
      engagementScore += 0.1;
    }

    // Boost for requesting Sweet Athena features
    if (requestsweetAthenaConfig?.voiceGuidance) {
      engagementScore += 0.1;
    }

    this.stateManager.updateUserEngagement(Math.min(engagementScore, 1.0));
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    this.stateManager.on('personalityChanged', (data) => {
      this.emit('personalityChanged', data);
    });

    this.stateManager.on('clothingLevelChanged', (data) => {
      this.emit('clothingChanged', data);
    });

    this.stateManager.on('stateChanged', (state) => {
      this.emit('avatarStateChanged', state);
    });

    if (this.pixelStreamingBridge) {
      this.pixelStreamingBridge.on('connected', () => {
        this.emit('avatarConnected');
      });

      this.pixelStreamingBridge.on('disconnected', () => {
        this.emit('avatarDisconnected');
      });
    }
  }

  /**
   * Get current Sweet Athena state
   */
  getCurrentState(): SweetAthenaState {
    return this.stateManager.getCurrentState();
  }

  /**
   * Set personality mode
   */
  async setPersonality(mode: PersonalityMode): Promise<void> {
    await this.stateManager.setPersonality(mode);
  }

  /**
   * Set clothing level
   */
  async setClothingLevel(
    level: 'conservative' | 'moderate' | 'revealing' | 'very_revealing'
  ): Promise<void> {
    await this.stateManager.setClothingLevel(level);
  }

  /**
   * Connect to UE5 avatar
   */
  async connectAvatar(): Promise<void> {
    if (this.pixelStreamingBridge) {
      await this.pixelStreamingBridge.connect();
    }
  }

  /**
   * Disconnect from UE5 avatar
   */
  async disconnectAvatar(): Promise<void> {
    if (this.pixelStreamingBridge) {
      await this.pixelStreamingBridge.disconnect();
    }
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    this.removeAllListeners();
    await this.stateManager.destroy();
    if (this.pixelStreamingBridge) {
      await this.pixelStreamingBridge.destroy();
    }
  }
}

export default SweetAthenaIntegrationService;
