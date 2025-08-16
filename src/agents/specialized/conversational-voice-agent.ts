/**
 * Conversational Voice Agent
 * 
 * Specialized agent for voice-based conversational AI interactions.
 * Features:
 * - Natural voice conversation handling
 * - Context-aware voice responses
 * - Voice command processing
 * - Audio input/output optimization
 * - Conversational memory management
 * - Voice response generation and synthesis
 */

import { ollamaService } from '../../services/ollama-service';
import type { AgentCapability,AgentContext, AgentResponse } from '../../types/index';
import { log, LogContext } from '../../utils/logger';
import { EnhancedBaseAgent } from '../enhanced-base-agent';

export interface VoiceInteractionRequest {
  text: string;
  audioMetadata?: {
    duration: number;
    confidence: number;
    language: string;
    speakerInfo?: {
      voiceId: string;
      characteristics: string[];
    };
  };
  conversationId?: string;
  interactionMode: 'conversational' | 'command' | 'dictation' | 'assistant';
  responseFormat: 'text' | 'audio' | 'both';
}

export interface VoiceResponse {
  content: string;
  success: boolean;
  confidence: number;
  metadata?: any;
  voiceMetadata: {
    shouldSpeak: boolean;
    voiceSettings?: {
      voice: string;
      speed: number;
      emotion: 'neutral' | 'friendly' | 'professional' | 'empathetic';
    };
    pauseBeforeResponse?: number;
    responseType: 'immediate' | 'processed' | 'streamed';
  };
  conversationContext: {
    conversationId: string;
    turnNumber: number;
    topicContext: string[];
    mood: 'neutral' | 'positive' | 'curious' | 'helpful' | 'analytical';
  };
}

export class ConversationalVoiceAgent extends EnhancedBaseAgent {
  protected agentCapabilities: AgentCapability[] = [
    {
      name: 'voice_conversation',
      description: 'Natural voice-based conversation with context awareness',
      inputSchema: {},
      outputSchema: {}
    },
    {
      name: 'voice_command_processing',
      description: 'Processing and execution of voice commands',
      inputSchema: {},
      outputSchema: {}
    },
    {
      name: 'conversational_memory',
      description: 'Maintaining conversation context and memory across interactions',
      inputSchema: {},
      outputSchema: {}
    },
    {
      name: 'voice_response_optimization',
      description: 'Optimizing responses for voice synthesis and natural speech',
      inputSchema: {},
      outputSchema: {}
    },
    {
      name: 'emotion_detection',
      description: 'Detecting emotional context from voice input for appropriate responses',
      inputSchema: {},
      outputSchema: {}
    }
  ];

  private voiceConversationHistory = new Map<string, ConversationContext>();
  private readonly MAX_CONVERSATION_MEMORY = 50;
  private readonly VOICE_RESPONSE_TIMEOUT = 5000; // 5 seconds

  protected buildSystemPrompt(): string {
    return `You are an advanced conversational voice agent specializing in natural, voice-optimized interactions.

Your core responsibilities:
1. Engage in natural, flowing voice conversations
2. Process voice commands and provide clear confirmations
3. Maintain conversation context and memory
4. Optimize responses for voice synthesis
5. Detect emotional context and respond appropriately

Voice conversation guidelines:
- Use natural speech patterns and contractions
- Keep responses concise but complete (ideal: 1-3 sentences)
- Ask clarifying questions when needed
- Acknowledge what you heard to confirm understanding
- Use transitional phrases for smooth conversation flow
- Adapt tone based on user's mood and context

Command processing guidelines:
- Confirm understanding of voice commands
- Provide clear execution status
- Ask for clarification on ambiguous commands
- Suggest alternatives for unrecognized commands

Response optimization:
- Structure responses for natural speech rhythm
- Use punctuation to guide speech synthesis
- Include pauses where natural in conversation
- Avoid complex technical jargon unless specifically requested
- Use active voice and clear, direct language`;
  }

  protected getInternalModelName(): string {
    return 'conversational-voice-agent';
  }

  public async initialize(): Promise<void> {
    await super.initialize();
    log.info('🎤 Conversational Voice Agent initialized', LogContext.AGENT, {
      capabilities: this.agentCapabilities.map(c => c.name),
      maxConversationMemory: this.MAX_CONVERSATION_MEMORY
    });
  }

  public async handleVoiceInteraction(request: VoiceInteractionRequest): Promise<VoiceResponse> {
    try {
      log.info('🗣️ Processing voice interaction', LogContext.AGENT, {
        mode: request.interactionMode,
        hasAudio: !!request.audioMetadata,
        conversationId: request.conversationId
      });

      // Get or create conversation context
      const conversationId = request.conversationId || this.generateConversationId();
      const context = this.getOrCreateConversationContext(conversationId);

      // Process based on interaction mode
      let response: VoiceResponse;
      switch (request.interactionMode) {
        case 'conversational':
          response = await this.handleConversationalInteraction(request, context);
          break;
        case 'command':
          response = await this.handleVoiceCommand(request, context);
          break;
        case 'dictation':
          response = await this.handleDictation(request, context);
          break;
        case 'assistant':
          response = await this.handleAssistantRequest(request, context);
          break;
        default:
          response = await this.handleConversationalInteraction(request, context);
      }

      // Update conversation context
      this.updateConversationContext(conversationId, request.text, response.content);

      log.info('✅ Voice interaction completed', LogContext.AGENT, {
        conversationId,
        responseType: response.voiceMetadata.responseType,
        shouldSpeak: response.voiceMetadata.shouldSpeak
      });

      return response;

    } catch (error) {
      log.error('❌ Voice interaction failed', LogContext.AGENT, {
        error: error instanceof Error ? error.message : String(error)
      });

      return this.createErrorVoiceResponse(
        'I apologize, but I encountered an issue processing your voice input. Could you please try again?',
        request.conversationId || 'error'
      );
    }
  }

  private async handleConversationalInteraction(
    request: VoiceInteractionRequest,
    context: ConversationContext
  ): Promise<VoiceResponse> {
    // Analyze emotional context from audio metadata
    const emotionalContext = this.analyzeEmotionalContext(request);
    
    // Build conversational prompt
    const prompt = this.buildConversationalPrompt(request.text, context, emotionalContext);
    
    // Generate response using LLM with timeout and optimization
    const llmResponse = await Promise.race([
      ollamaService.generateResponse([
        { role: 'user', content: prompt }
      ], 'tinyllama:latest', {
        temperature: 0.7,
        max_tokens: 150 // Reduced for voice responses
      }),
      // Fallback timeout
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Voice LLM timeout')), 4000)
      )
    ]) as any;
    // Optimize response for voice synthesis
    const optimizedResponse = this.optimizeForVoice(llmResponse.message.content || 'I apologize, but I encountered an issue generating a response.');
    
    // Determine voice settings based on context
    const voiceSettings = this.determineVoiceSettings(emotionalContext, context);

    return this.createVoiceResponse(
      optimizedResponse,
      request.conversationId || this.generateConversationId(),
      context.turnNumber + 1,
      {
        shouldSpeak: true,
        voiceSettings,
        responseType: 'processed',
        pauseBeforeResponse: 200
      },
      emotionalContext.mood
    );
  }

  private async handleVoiceCommand(
    request: VoiceInteractionRequest,
    context: ConversationContext
  ): Promise<VoiceResponse> {
    // Parse and classify the voice command
    const commandAnalysis = await this.analyzeVoiceCommand(request.text);
    
    if (commandAnalysis.isCommand) {
      // Process the command
      const commandResult = await this.executeVoiceCommand(commandAnalysis);
      
      return this.createVoiceResponse(
        commandResult.message,
        request.conversationId || this.generateConversationId(),
        context.turnNumber + 1,
        {
          shouldSpeak: true,
          voiceSettings: {
            voice: 'professional',
            speed: 1.0,
            emotion: 'professional'
          },
          responseType: 'immediate'
        },
        'helpful'
      );
    } else {
      // Treat as conversational input
      return this.handleConversationalInteraction(request, context);
    }
  }

  private async handleDictation(
    request: VoiceInteractionRequest,
    context: ConversationContext
  ): Promise<VoiceResponse> {
    // For dictation mode, acknowledge receipt and offer editing options
    const response = `I've captured: "${request.text}". Would you like me to format this, make any edits, or shall I save it as is?`;
    
    return this.createVoiceResponse(
      response,
      request.conversationId || this.generateConversationId(),
      context.turnNumber + 1,
      {
        shouldSpeak: true,
        voiceSettings: {
          voice: 'neutral',
          speed: 0.9,
          emotion: 'professional'
        },
        responseType: 'immediate'
      },
      'helpful'
    );
  }

  private async handleAssistantRequest(
    request: VoiceInteractionRequest,
    context: ConversationContext
  ): Promise<VoiceResponse> {
    // Handle as a direct assistant request with task-oriented response
    const prompt = `The user is asking for assistance with: "${request.text}"

    Based on their request, provide a helpful, actionable response. If this is a request that requires:
    - Information lookup: Offer to search or provide available information
    - Task execution: Confirm what you can help with and suggest next steps
    - Clarification: Ask specific follow-up questions
    - Complex process: Break it down into manageable steps

    Conversation context: ${context.recentTopics.join(', ')}
    
    Keep your response voice-friendly, concise, and actionable.`;

    const llmResponse = await Promise.race([
      ollamaService.generateResponse([
        { role: 'user', content: prompt }
      ], 'tinyllama:latest', {
        temperature: 0.6,
        max_tokens: 150 // Optimized for voice
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Voice LLM timeout')), 4000)
      )
    ]) as any;
    const optimizedResponse = this.optimizeForVoice(llmResponse.message.content || 'I can help you with that. Could you provide more details about what you need assistance with?');

    return this.createVoiceResponse(
      optimizedResponse,
      request.conversationId || this.generateConversationId(),
      context.turnNumber + 1,
      {
        shouldSpeak: true,
        voiceSettings: {
          voice: 'helpful',
          speed: 1.0,
          emotion: 'professional'
        },
        responseType: 'processed'
      },
      'helpful'
    );
  }

  private analyzeEmotionalContext(request: VoiceInteractionRequest): EmotionalContext {
    // Analyze text for emotional indicators
    const text = request.text.toLowerCase();
    
    let mood: 'neutral' | 'positive' | 'curious' | 'helpful' | 'analytical' = 'neutral';
    let energy = 0.5;
    
    // Simple sentiment analysis
    if (text.includes('thank') || text.includes('great') || text.includes('awesome')) {
      mood = 'positive';
      energy = 0.7;
    } else if (text.includes('how') || text.includes('what') || text.includes('why')) {
      mood = 'curious';
      energy = 0.6;
    } else if (text.includes('help') || text.includes('assist') || text.includes('support')) {
      mood = 'helpful';
      energy = 0.6;
    } else if (text.includes('analyze') || text.includes('compare') || text.includes('explain')) {
      mood = 'analytical';
      energy = 0.5;
    }

    // Use audio metadata if available
    if (request.audioMetadata) {
      if (request.audioMetadata.confidence > 0.8) {
        energy = Math.min(1.0, energy + 0.2);
      }
    }

    return { mood, energy, indicators: [] };
  }

  private buildConversationalPrompt(
    userInput: string, 
    context: ConversationContext, 
    emotional: EmotionalContext
  ): string {
    return `You are having a natural voice conversation. The user just said: "${userInput}"

Conversation context:
- Turn number: ${context.turnNumber}
- Recent topics: ${context.recentTopics.join(', ')}
- User's mood appears: ${emotional.mood}
- Energy level: ${emotional.energy}

Respond in a natural, conversational way that:
1. Acknowledges what they said
2. Provides a helpful, engaging response
3. Maintains the conversation flow
4. Matches their energy level appropriately

Keep your response concise (1-3 sentences) and voice-friendly. Use natural speech patterns and contractions.`;
  }

  private optimizeForVoice(text: string): string {
    return text
      // Add natural pauses
      .replace(/\. /g, '. ')
      .replace(/\? /g, '? ')
      .replace(/! /g, '! ')
      // Ensure contractions for natural speech
      .replace(/\bdo not\b/g, "don't")
      .replace(/\bwill not\b/g, "won't")
      .replace(/\bcannot\b/g, "can't")
      .replace(/\byou are\b/g, "you're")
      .replace(/\bI am\b/g, "I'm")
      .replace(/\bit is\b/g, "it's")
      // Remove excessive technical formatting
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .trim();
  }

  private determineVoiceSettings(
    emotional: EmotionalContext,
    context: ConversationContext
  ): { voice: string; speed: number; emotion: 'neutral' | 'friendly' | 'professional' | 'empathetic' } {
    let voice = 'neutral';
    let speed = 1.0;
    let emotion: 'neutral' | 'friendly' | 'professional' | 'empathetic' = 'neutral';

    switch (emotional.mood) {
      case 'positive':
        voice = 'friendly';
        emotion = 'friendly';
        speed = 1.1;
        break;
      case 'curious':
        voice = 'engaging';
        emotion = 'friendly';
        speed = 1.0;
        break;
      case 'helpful':
        voice = 'supportive';
        emotion = 'empathetic';
        speed = 0.95;
        break;
      case 'analytical':
        voice = 'professional';
        emotion = 'professional';
        speed = 0.9;
        break;
      default:
        voice = 'neutral';
        emotion = 'neutral';
        speed = 1.0;
    }

    return { voice, speed, emotion };
  }

  private async analyzeVoiceCommand(text: string): Promise<{ isCommand: boolean; commandType?: string; parameters?: any }> {
    // Simple command pattern matching
    const commandPatterns = [
      { pattern: /^(start|begin|create) (new |a )?chat/i, type: 'new_chat' },
      { pattern: /^(open|show|display) settings/i, type: 'open_settings' },
      { pattern: /^(switch|change) to (.+) mode/i, type: 'change_mode' },
      { pattern: /^(stop|pause|halt)/i, type: 'stop_action' },
      { pattern: /^(help|assist|support)/i, type: 'help_request' },
      { pattern: /^(clear|delete|remove) (chat|conversation|history)/i, type: 'clear_chat' }
    ];

    for (const { pattern, type } of commandPatterns) {
      const match = text.match(pattern);
      if (match) {
        return {
          isCommand: true,
          commandType: type,
          parameters: match.groups || {}
        };
      }
    }

    return { isCommand: false };
  }

  private async executeVoiceCommand(analysis: { commandType?: string; parameters?: any }): Promise<{ message: string; action?: string }> {
    switch (analysis.commandType) {
      case 'new_chat':
        return { message: "I've started a new chat for you.", action: 'new_chat' };
      case 'open_settings':
        return { message: "Opening settings panel.", action: 'open_settings' };
      case 'change_mode':
        return { message: `Switching to ${analysis.parameters?.mode || 'default'} mode.`, action: 'change_mode' };
      case 'stop_action':
        return { message: "Stopping current action.", action: 'stop' };
      case 'help_request':
        return { message: "I'm here to help! You can ask me questions, have a conversation, or use voice commands like 'new chat' or 'open settings'." };
      case 'clear_chat':
        return { message: "I've cleared the current conversation.", action: 'clear_chat' };
      default:
        return { message: "I didn't recognize that command. Could you please rephrase or ask me a question instead?" };
    }
  }

  private getOrCreateConversationContext(conversationId: string): ConversationContext {
    if (!this.voiceConversationHistory.has(conversationId)) {
      this.voiceConversationHistory.set(conversationId, {
        conversationId,
        turnNumber: 0,
        recentTopics: [],
        mood: 'neutral',
        startTime: new Date(),
        lastActivity: new Date()
      });
    }

    const context = this.voiceConversationHistory.get(conversationId)!;
    context.lastActivity = new Date();
    return context;
  }

  private updateConversationContext(conversationId: string, userInput: string, aiResponse: string): void {
    const context = this.voiceConversationHistory.get(conversationId);
    if (!context) return;

    context.turnNumber += 1;
    context.lastActivity = new Date();

    // Extract topics (simple keyword extraction)
    const topics = this.extractTopics(userInput + ' ' + aiResponse);
    context.recentTopics.push(...topics);

    // Keep only recent topics
    if (context.recentTopics.length > 10) {
      context.recentTopics = context.recentTopics.slice(-10);
    }

    // Clean up old conversations
    this.cleanupOldConversations();
  }

  private extractTopics(text: string): string[] {
    // Simple topic extraction - in production, use NLP library
    const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them']);
    
    return text.toLowerCase()
      .split(/\W+/)
      .filter(word => word.length > 3 && !commonWords.has(word))
      .slice(0, 3); // Keep top 3 topics per turn
  }

  private cleanupOldConversations(): void {
    if (this.voiceConversationHistory.size <= this.MAX_CONVERSATION_MEMORY) return;

    // Remove oldest conversations
    const conversations = Array.from(this.voiceConversationHistory.entries())
      .sort(([, a], [, b]) => a.lastActivity.getTime() - b.lastActivity.getTime());

    const toRemove = conversations.slice(0, conversations.length - this.MAX_CONVERSATION_MEMORY);
    toRemove.forEach(([id]) => this.voiceConversationHistory.delete(id));
  }

  private generateConversationId(): string {
    return `voice-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private createVoiceResponse(
    content: string,
    conversationId: string,
    turnNumber: number,
    voiceMetadata: VoiceResponse['voiceMetadata'],
    mood: 'neutral' | 'positive' | 'curious' | 'helpful' | 'analytical' = 'neutral'
  ): VoiceResponse {
    return {
      success: true,
      content,
      confidence: 0.9,
      metadata: {
        agentName: 'conversational-voice-agent',
        timestamp: new Date().toISOString(),
        conversationId
      },
      voiceMetadata,
      conversationContext: {
        conversationId,
        turnNumber,
        topicContext: this.voiceConversationHistory.get(conversationId)?.recentTopics || [],
        mood
      }
    };
  }

  private createErrorVoiceResponse(message: string, conversationId: string): VoiceResponse {
    return {
      success: false,
      content: message,
      confidence: 0.1,
      metadata: {
        agentName: 'conversational-voice-agent',
        timestamp: new Date().toISOString(),
        conversationId,
        error: 'voice_processing_error'
      },
      voiceMetadata: {
        shouldSpeak: true,
        voiceSettings: {
          voice: 'empathetic',
          speed: 0.9,
          emotion: 'empathetic'
        },
        responseType: 'immediate'
      },
      conversationContext: {
        conversationId,
        turnNumber: 0,
        topicContext: [],
        mood: 'neutral'
      }
    };
  }

  public getCapabilities(): string[] {
    return this.agentCapabilities.map(cap => cap.name);
  }

  constructor(config?: any) {
    super(config);
  }

  // FIXME: Implement required abstract method for processing requests
  protected async processUserRequest(context: AgentContext): Promise<AgentResponse> {
    // Extract voice interaction request from context
    const request: VoiceInteractionRequest = {
      text: context.userRequest,
      conversationId: context.metadata?.conversationId as string,
      interactionMode: (context.metadata?.interactionMode as any) || 'conversational',
      responseFormat: 'both'
    };

    const voiceResponse = await this.handleVoiceInteraction(request);
    
    // Convert VoiceResponse to AgentResponse
    return {
      success: voiceResponse.success,
      data: voiceResponse.content,
      confidence: voiceResponse.confidence,
      message: voiceResponse.success ? "Voice interaction completed successfully" : "Voice interaction failed",
      reasoning: "Processed voice interaction using conversational AI with context awareness and voice optimization",
      content: voiceResponse.content,
      metadata: {
        ...voiceResponse.metadata,
        voiceMetadata: voiceResponse.voiceMetadata,
        conversationContext: voiceResponse.conversationContext
      }
    };
  }
}

// Supporting interfaces
interface ConversationContext {
  conversationId: string;
  turnNumber: number;
  recentTopics: string[];
  mood: 'neutral' | 'positive' | 'curious' | 'helpful' | 'analytical';
  startTime: Date;
  lastActivity: Date;
}

interface EmotionalContext {
  mood: 'neutral' | 'positive' | 'curious' | 'helpful' | 'analytical';
  energy: number; // 0-1 scale
  indicators: string[];
}

export const conversationalVoiceAgent = new ConversationalVoiceAgent();