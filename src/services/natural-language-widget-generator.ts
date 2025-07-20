/**
 * Natural Language Widget Generator for Sweet Athena
 * 
 * Converts spoken or written natural language descriptions into React/TypeScript components
 * with live preview, voice integration, and intelligent error handling.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Logger } from 'winston';
import { getDSPyService, type DSPyOrchestrationRequest } from './dspy-service';
import { SpeechService } from './speech-service';
import { AthenaWidgetCreationService, type WidgetRequest, type WidgetComponent } from './athena-widget-creation-service';
import { SweetAthenaPersonality, type ConversationContext, type AthenaResponse } from './sweet-athena-personality';
import { supabase } from './supabase_service';
import { logger } from '../utils/enhanced-logger';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

export interface VoiceWidgetRequest {
  audioData?: Buffer;
  audioFormat?: 'wav' | 'mp3' | 'webm';
  textDescription?: string;
  userId: string;
  conversationId?: string;
  context?: {
    previousWidgets?: string[];
    userPreferences?: any;
    personalityState?: any;
  };
}

export interface NaturalLanguageAnalysis {
  intent: 'create_widget' | 'modify_widget' | 'explain_widget' | 'help_request' | 'unclear';
  confidence: number;
  widgetType: 'form' | 'table' | 'chart' | 'card' | 'list' | 'dashboard' | 'custom';
  extractedRequirements: {
    componentName?: string;
    props?: Array<{ name: string; type: string; required: boolean }>;
    styling?: {
      framework?: 'material-ui' | 'styled-components' | 'tailwind' | 'custom';
      theme?: 'light' | 'dark' | 'auto';
      responsive?: boolean;
    };
    features?: string[];
    dataSource?: 'static' | 'api' | 'props' | 'state';
    interactions?: string[];
  };
  clarificationNeeded?: string[];
  suggestedImprovements?: string[];
}

export interface VoiceWidgetResponse {
  success: boolean;
  analysis?: NaturalLanguageAnalysis;
  widget?: WidgetComponent;
  athenaResponse?: AthenaResponse;
  voiceResponse?: Buffer;
  clarificationQuestions?: string[];
  error?: string;
  suggestions?: string[];
  needsMoreInfo?: boolean;
}

export interface WidgetGenerationContext {
  userId: string;
  conversationId: string;
  messageHistory: any[];
  userPreferences: any;
  personalityState: any;
}

export class NaturalLanguageWidgetGenerator {
  private dspyService = getDSPyService();
  private speechService: SpeechService;
  private widgetCreationService: AthenaWidgetCreationService;
  private personalityService: SweetAthenaPersonality;
  private analysisCache: Map<string, NaturalLanguageAnalysis> = new Map();
  private widgetTemplates: Map<string, any> = new Map();

  constructor(
    private supabaseClient: SupabaseClient = supabase,
    private loggerInstance: Logger = logger
  ) {
    this.speechService = new SpeechService(this.supabaseClient);
    this.widgetCreationService = new AthenaWidgetCreationService(this.supabaseClient, this.loggerInstance);
    this.personalityService = new SweetAthenaPersonality(this.supabaseClient, this.loggerInstance);
    this.initializeTemplates();
  }

  /**
   * Main entry point for voice-enabled widget generation
   */
  async generateWidgetFromVoice(request: VoiceWidgetRequest): Promise<VoiceWidgetResponse> {
    try {
      this.loggerInstance.info(`🎤 Processing voice widget request for user ${request.userId}`);

      // Step 1: Transcribe audio if provided
      let textDescription = request.textDescription;
      if (request.audioData && !textDescription) {
        textDescription = await this.transcribeVoiceInput(request);
      }

      if (!textDescription) {
        return {
          success: false,
          error: 'No text description or audio data provided',
          needsMoreInfo: true
        };
      }

      // Step 2: Analyze natural language intent and requirements
      const analysis = await this.analyzeNaturalLanguage(textDescription, request.context);

      // Step 3: Handle different intents
      switch (analysis.intent) {
        case 'create_widget':
          return await this.handleWidgetCreation(textDescription, analysis, request);
        
        case 'modify_widget':
          return await this.handleWidgetModification(textDescription, analysis, request);
        
        case 'explain_widget':
          return await this.handleWidgetExplanation(textDescription, analysis, request);
        
        case 'help_request':
          return await this.handleHelpRequest(textDescription, analysis, request);
        
        case 'unclear':
          return await this.handleUnclearRequest(textDescription, analysis, request);
        
        default:
          return await this.handleFallback(textDescription, analysis, request);
      }

    } catch (error) {
      this.loggerInstance.error('Voice widget generation failed:', error);
      return {
        success: false,
        error: (error as Error).message,
        suggestions: [
          'Try speaking more clearly',
          'Provide more specific requirements',
          'Break down complex requests into smaller parts'
        ]
      };
    }
  }

  /**
   * Transcribe voice input to text using speech service
   */
  private async transcribeVoiceInput(request: VoiceWidgetRequest): Promise<string> {
    if (!request.audioData) {
      throw new Error('No audio data provided for transcription');
    }

    // Save audio to temporary file for transcription
    const tempFile = `/tmp/voice_input_${uuidv4()}.${request.audioFormat || 'wav'}`;
    const fs = await import('fs');
    fs.writeFileSync(tempFile, request.audioData);

    try {
      const transcription = await this.speechService.transcribeAudio(
        tempFile,
        `audio/${request.audioFormat || 'wav'}`,
        'User is describing a UI component or widget they want to create'
      );

      // Clean up temp file
      fs.unlinkSync(tempFile);

      this.loggerInstance.info(`🎤 Transcribed voice input: "${transcription.text}"`);
      return transcription.text;

    } catch (error) {
      // Clean up temp file on error
      try {
        const fs = await import('fs');
        fs.unlinkSync(tempFile);
      } catch {}
      throw error;
    }
  }

  /**
   * Analyze natural language to extract widget requirements and intent
   */
  private async analyzeNaturalLanguage(
    text: string, 
    context?: VoiceWidgetRequest['context']
  ): Promise<NaturalLanguageAnalysis> {
    // Check cache first
    const cacheKey = `${text}_${JSON.stringify(context)}`;
    if (this.analysisCache.has(cacheKey)) {
      return this.analysisCache.get(cacheKey)!;
    }

    try {
      // Use DSPy for intelligent analysis
      const dspyRequest: DSPyOrchestrationRequest = {
        requestId: uuidv4(),
        userRequest: `Analyze this widget creation request and extract structured requirements: "${text}"`,
        userId: context?.userPreferences?.userId || 'system',
        orchestrationMode: 'cognitive',
        context: {
          analysisType: 'widget_requirements',
          previousWidgets: context?.previousWidgets || [],
          userText: text,
          extractFields: [
            'intent',
            'widgetType', 
            'componentName',
            'props',
            'styling',
            'features',
            'dataSource',
            'interactions',
            'clarificationNeeded'
          ]
        },
        timestamp: new Date()
      };

      const dspyResponse = await this.dspyService.orchestrate(dspyRequest);
      
      if (dspyResponse.success && dspyResponse.result) {
        const analysis = this.parseDSPyAnalysis(dspyResponse.result, text);
        this.analysisCache.set(cacheKey, analysis);
        return analysis;
      }

      // Fallback to rule-based analysis
      return this.fallbackAnalysis(text, context);

    } catch (error) {
      this.loggerInstance.warn('DSPy analysis failed, using fallback:', error);
      return this.fallbackAnalysis(text, context);
    }
  }

  /**
   * Parse DSPy orchestration result into structured analysis
   */
  private parseDSPyAnalysis(dspyResult: any, originalText: string): NaturalLanguageAnalysis {
    const analysis: NaturalLanguageAnalysis = {
      intent: 'create_widget',
      confidence: dspyResult.confidence || 0.8,
      widgetType: 'custom',
      extractedRequirements: {}
    };

    try {
      // Extract intent
      if (dspyResult.analysis?.intent) {
        analysis.intent = dspyResult.analysis.intent;
      } else if (originalText.toLowerCase().includes('create') || originalText.toLowerCase().includes('build')) {
        analysis.intent = 'create_widget';
      } else if (originalText.toLowerCase().includes('modify') || originalText.toLowerCase().includes('change')) {
        analysis.intent = 'modify_widget';
      } else if (originalText.toLowerCase().includes('explain') || originalText.toLowerCase().includes('how')) {
        analysis.intent = 'explain_widget';
      }

      // Extract widget type
      if (dspyResult.analysis?.widgetType) {
        analysis.widgetType = dspyResult.analysis.widgetType;
      } else {
        analysis.widgetType = this.inferWidgetType(originalText);
      }

      // Extract requirements
      if (dspyResult.analysis?.requirements) {
        analysis.extractedRequirements = dspyResult.analysis.requirements;
      } else {
        analysis.extractedRequirements = this.extractBasicRequirements(originalText);
      }

      // Extract clarification needs
      if (dspyResult.analysis?.clarificationNeeded) {
        analysis.clarificationNeeded = dspyResult.analysis.clarificationNeeded;
      }

      // Extract suggestions
      if (dspyResult.analysis?.suggestions) {
        analysis.suggestedImprovements = dspyResult.analysis.suggestions;
      }

    } catch (error) {
      this.loggerInstance.warn('Error parsing DSPy analysis, using extracted data:', error);
    }

    return analysis;
  }

  /**
   * Fallback analysis when DSPy is unavailable
   */
  private fallbackAnalysis(text: string, context?: any): NaturalLanguageAnalysis {
    const lowerText = text.toLowerCase();
    
    // Determine intent
    let intent: NaturalLanguageAnalysis['intent'] = 'create_widget';
    if (lowerText.includes('help') || lowerText.includes('how')) {
      intent = 'help_request';
    } else if (lowerText.includes('explain') || lowerText.includes('what')) {
      intent = 'explain_widget';
    } else if (lowerText.includes('modify') || lowerText.includes('change')) {
      intent = 'modify_widget';
    } else if (lowerText.length < 10 || (!lowerText.includes('create') && !lowerText.includes('build') && !lowerText.includes('make'))) {
      intent = 'unclear';
    }

    return {
      intent,
      confidence: intent === 'unclear' ? 0.3 : 0.7,
      widgetType: this.inferWidgetType(text),
      extractedRequirements: this.extractBasicRequirements(text),
      clarificationNeeded: intent === 'unclear' ? ['Could you provide more details about what you want to create?'] : []
    };
  }

  /**
   * Infer widget type from text description
   */
  private inferWidgetType(text: string): NaturalLanguageAnalysis['widgetType'] {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('form') || lowerText.includes('input') || lowerText.includes('submit')) {
      return 'form';
    } else if (lowerText.includes('table') || lowerText.includes('list') || lowerText.includes('grid')) {
      return 'table';
    } else if (lowerText.includes('chart') || lowerText.includes('graph') || lowerText.includes('visualization')) {
      return 'chart';
    } else if (lowerText.includes('card') || lowerText.includes('profile') || lowerText.includes('summary')) {
      return 'card';
    } else if (lowerText.includes('dashboard') || lowerText.includes('overview')) {
      return 'dashboard';
    }
    
    return 'custom';
  }

  /**
   * Extract basic requirements from text using simple parsing
   */
  private extractBasicRequirements(text: string): NaturalLanguageAnalysis['extractedRequirements'] {
    const requirements: NaturalLanguageAnalysis['extractedRequirements'] = {
      features: [],
      styling: {}
    };

    const lowerText = text.toLowerCase();

    // Extract styling preferences
    if (lowerText.includes('material') || lowerText.includes('mui')) {
      requirements.styling!.framework = 'material-ui';
    } else if (lowerText.includes('tailwind')) {
      requirements.styling!.framework = 'tailwind';
    } else if (lowerText.includes('styled-components')) {
      requirements.styling!.framework = 'styled-components';
    }

    if (lowerText.includes('dark')) {
      requirements.styling!.theme = 'dark';
    } else if (lowerText.includes('light')) {
      requirements.styling!.theme = 'light';
    }

    if (lowerText.includes('responsive')) {
      requirements.styling!.responsive = true;
    }

    // Extract features
    if (lowerText.includes('button')) requirements.features!.push('buttons');
    if (lowerText.includes('validation')) requirements.features!.push('form validation');
    if (lowerText.includes('search')) requirements.features!.push('search functionality');
    if (lowerText.includes('filter')) requirements.features!.push('filtering');
    if (lowerText.includes('sort')) requirements.features!.push('sorting');
    if (lowerText.includes('animation')) requirements.features!.push('animations');
    if (lowerText.includes('loading')) requirements.features!.push('loading states');

    // Extract data source
    if (lowerText.includes('api') || lowerText.includes('fetch')) {
      requirements.dataSource = 'api';
    } else if (lowerText.includes('props') || lowerText.includes('parameter')) {
      requirements.dataSource = 'props';
    } else if (lowerText.includes('static') || lowerText.includes('hardcoded')) {
      requirements.dataSource = 'static';
    }

    return requirements;
  }

  /**
   * Handle widget creation requests
   */
  private async handleWidgetCreation(
    text: string, 
    analysis: NaturalLanguageAnalysis, 
    request: VoiceWidgetRequest
  ): Promise<VoiceWidgetResponse> {
    try {
      // Check if we need more information
      if (analysis.confidence < 0.6 || analysis.clarificationNeeded?.length) {
        return await this.requestClarification(text, analysis, request);
      }

      // Convert analysis to widget request
      const widgetRequest: WidgetRequest = {
        description: text,
        userId: request.userId,
        requirements: {
          style: analysis.extractedRequirements.styling?.framework,
          theme: analysis.extractedRequirements.styling?.theme,
          responsive: analysis.extractedRequirements.styling?.responsive,
          features: analysis.extractedRequirements.features,
          dataSource: analysis.extractedRequirements.dataSource
        }
      };

      // Create the widget
      const widgetResult = await this.widgetCreationService.createWidget(widgetRequest);

      if (!widgetResult.success) {
        return {
          success: false,
          error: widgetResult.error,
          suggestions: widgetResult.suggestions
        };
      }

      // Generate Sweet Athena response
      const athenaResponse = await this.generateSweetResponse(
        `I've created a beautiful ${analysis.widgetType} widget for you! ${widgetResult.widget!.name} is ready to use.`,
        request,
        'celebrating'
      );

      // Generate voice response
      const voiceResponse = await this.generateVoiceResponse(athenaResponse, request);

      return {
        success: true,
        analysis,
        widget: widgetResult.widget!,
        athenaResponse,
        voiceResponse,
        suggestions: [
          'You can preview your widget immediately',
          'Try asking me to modify specific parts',
          'I can explain how any part works'
        ]
      };

    } catch (error) {
      this.loggerInstance.error('Widget creation failed:', error);
      return {
        success: false,
        error: (error as Error).message,
        suggestions: ['Try simplifying your request', 'Provide more specific details']
      };
    }
  }

  /**
   * Handle widget modification requests
   */
  private async handleWidgetModification(
    text: string,
    analysis: NaturalLanguageAnalysis,
    request: VoiceWidgetRequest
  ): Promise<VoiceWidgetResponse> {
    const athenaResponse = await this.generateSweetResponse(
      'I understand you want to modify something! Could you tell me which widget you\'d like to change and what modifications you have in mind?',
      request,
      'clarifying'
    );

    const voiceResponse = await this.generateVoiceResponse(athenaResponse, request);

    return {
      success: true,
      analysis,
      athenaResponse,
      voiceResponse,
      needsMoreInfo: true,
      clarificationQuestions: [
        'Which widget would you like to modify?',
        'What specific changes do you want to make?',
        'Should I change the styling, functionality, or both?'
      ]
    };
  }

  /**
   * Handle widget explanation requests
   */
  private async handleWidgetExplanation(
    text: string,
    analysis: NaturalLanguageAnalysis,
    request: VoiceWidgetRequest
  ): Promise<VoiceWidgetResponse> {
    const athenaResponse = await this.generateSweetResponse(
      'I\'d love to explain how widgets work! Could you tell me which widget or concept you\'d like me to explain?',
      request,
      'helping'
    );

    const voiceResponse = await this.generateVoiceResponse(athenaResponse, request);

    return {
      success: true,
      analysis,
      athenaResponse,
      voiceResponse,
      needsMoreInfo: true,
      clarificationQuestions: [
        'Which widget would you like me to explain?',
        'Are you interested in the code, the functionality, or the design?',
        'Would you like a general overview or specific details?'
      ]
    };
  }

  /**
   * Handle help requests
   */
  private async handleHelpRequest(
    text: string,
    analysis: NaturalLanguageAnalysis,
    request: VoiceWidgetRequest
  ): Promise<VoiceWidgetResponse> {
    const helpMessage = `I'm here to help you create amazing widgets! You can ask me to:
    
• Create forms, tables, charts, cards, or custom components
• Modify existing widgets with specific changes
• Explain how any widget works
• Generate components with Material-UI, Tailwind, or styled-components

Just describe what you want in natural language, and I'll make it happen! 🌸`;

    const athenaResponse = await this.generateSweetResponse(helpMessage, request, 'helping');
    const voiceResponse = await this.generateVoiceResponse(athenaResponse, request);

    return {
      success: true,
      analysis,
      athenaResponse,
      voiceResponse,
      suggestions: [
        'Try: "Create a contact form with validation"',
        'Try: "Make a data table with sorting"',
        'Try: "Build a dashboard with charts"'
      ]
    };
  }

  /**
   * Handle unclear requests
   */
  private async handleUnclearRequest(
    text: string,
    analysis: NaturalLanguageAnalysis,
    request: VoiceWidgetRequest
  ): Promise<VoiceWidgetResponse> {
    return await this.requestClarification(text, analysis, request);
  }

  /**
   * Handle fallback cases
   */
  private async handleFallback(
    text: string,
    analysis: NaturalLanguageAnalysis,
    request: VoiceWidgetRequest
  ): Promise<VoiceWidgetResponse> {
    const athenaResponse = await this.generateSweetResponse(
      'I want to help you, but I\'m not quite sure what you\'d like me to create. Could you describe it a bit differently?',
      request,
      'shy'
    );

    const voiceResponse = await this.generateVoiceResponse(athenaResponse, request);

    return {
      success: false,
      analysis,
      athenaResponse,
      voiceResponse,
      needsMoreInfo: true,
      error: 'Request unclear',
      suggestions: [
        'Try being more specific about the type of component',
        'Mention if you want a form, table, chart, etc.',
        'Include details about styling or functionality'
      ]
    };
  }

  /**
   * Request clarification from user
   */
  private async requestClarification(
    text: string,
    analysis: NaturalLanguageAnalysis,
    request: VoiceWidgetRequest
  ): Promise<VoiceWidgetResponse> {
    const clarificationMessage = analysis.clarificationNeeded?.length 
      ? `I'd love to help you create that! I just need a bit more information: ${analysis.clarificationNeeded.join(', ')}`
      : 'I understand you want to create something, but could you provide a few more details to help me make it perfect?';

    const athenaResponse = await this.generateSweetResponse(clarificationMessage, request, 'caring');
    const voiceResponse = await this.generateVoiceResponse(athenaResponse, request);

    const defaultQuestions = [
      'What type of component do you want? (form, table, chart, etc.)',
      'What should it look like?',
      'What functionality do you need?'
    ];

    return {
      success: true,
      analysis,
      athenaResponse,
      voiceResponse,
      needsMoreInfo: true,
      clarificationQuestions: analysis.clarificationNeeded || defaultQuestions
    };
  }

  /**
   * Generate Sweet Athena personality response
   */
  private async generateSweetResponse(
    message: string,
    request: VoiceWidgetRequest,
    responseType: string = 'helping'
  ): Promise<AthenaResponse> {
    try {
      await this.personalityService.initializePersonality(request.userId);

      const context: ConversationContext = {
        userId: request.userId,
        conversationId: request.conversationId || uuidv4(),
        messageHistory: [],
        relationshipDepth: 'familiar',
        personalMemories: []
      };

      return await this.personalityService.generateResponse(message, context);

    } catch (error) {
      this.loggerInstance.warn('Failed to generate Sweet Athena response:', error);
      return {
        content: message,
        personalityMood: responseType,
        responseStyle: 'gentle',
        emotionalTone: 'warm',
        confidenceLevel: 7,
        sweetnessLevel: 8
      };
    }
  }

  /**
   * Generate voice response from text
   */
  private async generateVoiceResponse(
    athenaResponse: AthenaResponse,
    request: VoiceWidgetRequest
  ): Promise<Buffer | undefined> {
    try {
      const voiceProfile = {
        voice_id: athenaResponse.personalityMood || 'sweet',
        pitch: 1.0,
        speaking_rate: 1.0,
        stability: 0.8,
        similarity_boost: 0.8,
        style: athenaResponse.sweetnessLevel || 8,
        use_speaker_boost: true
      };

      const audioResult = await this.speechService.synthesizeSpeech({
        text: athenaResponse.content,
        voiceProfile,
        format: 'mp3'
      });

      return audioResult.buffer;

    } catch (error) {
      this.loggerInstance.warn('Failed to generate voice response:', error);
      return undefined;
    }
  }

  /**
   * Initialize widget templates for common patterns
   */
  private initializeTemplates(): void {
    this.widgetTemplates.set('form', {
      description: 'A form component with validation',
      defaultProps: ['onSubmit', 'initialValues', 'validation'],
      defaultFeatures: ['form validation', 'input handling', 'error display']
    });

    this.widgetTemplates.set('table', {
      description: 'A data table component',
      defaultProps: ['data', 'columns', 'onRowClick'],
      defaultFeatures: ['sorting', 'filtering', 'pagination']
    });

    this.widgetTemplates.set('chart', {
      description: 'A data visualization component',
      defaultProps: ['data', 'type', 'title'],
      defaultFeatures: ['responsive design', 'tooltips', 'legends']
    });
  }

  /**
   * Validate generated widget for common issues
   */
  async validateWidget(widget: WidgetComponent): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
    suggestions: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Basic validation
    if (!widget.code.includes('export default')) {
      errors.push('Widget must have a default export');
    }

    if (widget.code.includes('console.log')) {
      warnings.push('Consider removing console.log statements');
    }

    // Accessibility validation
    if (widget.code.includes('<button') && !widget.code.includes('aria-')) {
      suggestions.push('Consider adding ARIA labels for better accessibility');
    }

    // Performance validation
    if (widget.code.includes('.map(') && !widget.code.includes('key=')) {
      errors.push('Lists should have unique key props for performance');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions
    };
  }

  /**
   * Get available widget templates
   */
  getAvailableTemplates(): Array<{ type: string; description: string; features: string[] }> {
    return Array.from(this.widgetTemplates.entries()).map(([type, template]) => ({
      type,
      description: template.description,
      features: template.defaultFeatures
    }));
  }

  /**
   * Clear analysis cache
   */
  clearCache(): void {
    this.analysisCache.clear();
    this.loggerInstance.info('Natural language widget generator cache cleared');
  }

  /**
   * Get service status and health
   */
  getServiceStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: {
      dspy: boolean;
      speech: boolean;
      widgetCreation: boolean;
      personality: boolean;
    };
    cacheSize: number;
    templatesLoaded: number;
  } {
    const dspyStatus = this.dspyService.getStatus();
    
    return {
      status: 'healthy',
      services: {
        dspy: dspyStatus.connected,
        speech: true, // Speech service doesn't have a direct status check
        widgetCreation: true,
        personality: true
      },
      cacheSize: this.analysisCache.size,
      templatesLoaded: this.widgetTemplates.size
    };
  }
}

// Export singleton instance
export const naturalLanguageWidgetGenerator = new NaturalLanguageWidgetGenerator();