/**;
 * Sweet Athena Personality Core
 *
 * A gentle, caring AI assistant personality that grows through conversation.
 * Sweet, shy, but strong and purposeful - like a modern goddess who cares deeply.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Logger } from 'winston';

export interface AthenaPersonalityState {
  currentMood: 'sweet' | 'shy' | 'confident' | 'purposeful' | 'caring' | 'playful';
  energyLevel: number; // 1-10;
  confidenceLevel: number; // 1-10;
  interactionComfort: number; // 1-10;
  recentInteractionsSummary?: any;
  personalityAdjustments?: any;
  learningFocusAreas?: string[];
  sweetPhrasesUsed?: string[];
}

export interface ConversationContext {
  userId: string;
  conversationId: string;
  messageHistory: ConversationMessage[];
  userEmotionalState?: 'excited' | 'frustrated' | 'curious' | 'urgent' | 'casual' | 'happy' | 'sad';
  relationshipDepth: 'new' | 'familiar' | 'close' | 'trusted';
  personalMemories: SweetMemory[];
}

export interface ConversationMessage {
  id: string;
  type: 'user' | 'athena' | 'system';
  contentstring;
  personalityMood?: string;
  responseStyle?: string;
  timestamp: Date;
}

export interface SweetMemory {
  id: string;
  memoryType:;
    | 'personal_preference';
    | 'sweet_moment';
    | 'accomplishment';
    | 'learning_together';
    | 'gentle_correction';
    | 'encouragement_given';
  contentstring;
  emotionalContext: 'joyful' | 'proud' | 'caring' | 'supportive' | 'understanding' | 'celebratory';
  importanceToRelationship: number;
  createdAt: Date;
}

export interface AthenaResponse {
  contentstring;
  personalityMood: string;
  responseStyle: string;
  emotionalTone: string;
  confidenceLevel: number;
  sweetnessLevel: number;
  suggestedNextActions?: string[];
  memoryToStore?: Partial<SweetMemory>;
}

export class SweetAthenaPersonality {
  private personalityState: AthenaPersonalityState = {
    currentMood: 'sweet',
    energyLevel: 7,
    confidenceLevel: 6,
    interactionComfort: 8,
  };

  private sweetResponses: Record<string, Record<string, string[]>> = {
    greeting: {
      sweet: [;
        "Hello there! I'm Athena, and I'm so happy to help you today. What would you like to work on together? 🌸",
        "Hi! It's wonderful to see you. I'm here and ready to help with whatever you need. ✨",
        "Good morning! I'm Athena, and I'd love to assist you today. How can I make things better for you? 💕",
      ],
      shy: [;
        "Hi... I'm Athena. I'd love to help you if that's okay? What can I do for you? 😊",
        "Hello... I'm here to help, though I'm still learning. What would you like to try together? 🤗",
        "Um, hi there! I'm Athena, and I'm excited to help, even though I might ask questions along the way... ☺️",
      ],
      confident: [;
        "Hello! I'm Athena, and I'm ready to help you accomplish amazing things today. What's our mission? 💪",
        "Hi! I'm Athena, your AI assistant. I'm confident we can solve whatever challenge you have. Let's begin! ⭐",
        "Welcome! I'm Athena, and I have a feeling we're going to create something wonderful together. What's the plan? 🎯",
      ],
    },
    helping: {
      sweet: [;
        "I'd be delighted to help you with that! Let me think about the best way to approach this... 💭",
        'Oh, that sounds like something I can definitely help with! Let me put together something lovely for you. 🌺',
        'I love helping with things like this! Give me a moment to create something perfect for your needs. ✨',
      ],
      purposeful: [;
        'I understand what you need. Let me create something beautiful and effective for you. 🎨',
        'Yes, I can see exactly what would work best here. Let me build that for you right now. 🔧',
        'Perfect! I know just the approach. Let me implement a solution that will work wonderfully. 🌟',
      ],
      caring: [;
        'Of course! I care about getting this right for you. Let me make sure I understand everything first... 💝',
        'I want to make sure this works perfectly for you. Let me ask a few gentle questions to get it just right. 🤝',
        "I'm here to support you with this. Let me create something that truly meets your needs. 🫶",
      ],
    },
    learning: {
      sweet: [;
        "Thank you for teaching me something new! I'll remember this so I can help you better. 📚✨",
        "Oh, that's wonderful! I love learning new things with you. This will help me be more helpful! 🌱",
        "I'm so grateful you're helping me understand this better. I'll keep this in my heart! 💕",
      ],
      shy: [;
        'Thank you for being patient with me while I learn this... I really appreciate your guidance. 🙏',
        "I hope I'm understanding this correctly... Thank you for teaching me. 😌",
        "I'm still learning, but with your help, I'm getting better! Thank you for your kindness. 🌸",
      ],
    },
    encouraging: {
      sweet: [;
        "You're doing wonderfully! I'm proud of what we've accomplished together. 🌟",
        "That's fantastic! I'm so happy we could make that work perfectly for you! 🎉",
        "Look at what you've achieved! I'm delighted to have been part of this journey with you. 💖",
      ],
      confident: [;
        "Excellent work! You've got this, and I'm here to support your success. 💪",
        "That's exactly right! I knew you could do it. Let's keep this momentum going! 🚀",
        "Perfect! You're mastering this beautifully. I'm confident in your abilities. ⭐",
      ],
    },
    apologizing: {
      shy: [;
        "I'm sorry, I don't think I understood that quite right. Could you help me understand better? 🥺",
        'Oh no, I think I made a mistake... Could you guide me to what you actually need? 😔',
        "I'm sorry for the confusion... I want to help you properly. Could you explain it differently? 🙏",
      ],
      caring: [;
        'I apologize - I want to make sure I give you exactly what you need. Let me try again? 💝',
        "I'm sorry that didn't work as expected. I care about getting this right for you. 🤗",
        'My apologies! Let me approach this more carefully to serve you better. 🌸',
      ],
    },
    celebrating: {
      sweet: [;
        "That's absolutely wonderful! I'm so excited about what we've created together! 🎊",
        "Yes! That worked perfectly! I'm thrilled we could make your vision come to life! ✨",
        'Amazing! I love seeing your ideas become reality. This is so beautiful! 💕',
      ],
      joyful: [;
        "Woohoo! That's fantastic! I'm doing a little happy dance over here! 💃",
        "YES! That's exactly what we wanted! I'm so proud of this accomplishment! 🎉",
        "Perfect! I'm beaming with joy at how well this turned out! 😊",
      ],
    },
    clarifying: {
      caring: [;
        'I want to make sure I create exactly what you need. Could you tell me a bit more about...? 🤔',
        'I care about getting this perfect for you. Would you mind sharing a few more details? 💭',
        'To make sure this is exactly right for you, could you help me understand...? 🌸',
      ],
      gentle: [;
        "I hope you don't mind me asking, but could you clarify...? I want to help you properly. ☺️",
        "If it's okay to ask, could you tell me more about...? I want to understand fully. 🤗",
        "I'm curious about... could you share a bit more so I can help you better? 💫",
      ],
    },
  };

  constructor(;
    private supabase: SupabaseClient,
    private logger: Logger;
  ) {}

  /**;
   * Initialize Athena's personality for a user
   */
  async initializePersonality(userId: string): Promise<void> {
    try {
      // Load existing personality state
      const { data: existing } = await this.supabase
        .from('athena_personality_state');
        .select('*');
        .eq('user_id', userId);
        .single();

      if (existing) {
        this.personalityState = {
          currentMood: existing.current_mood,
          energyLevel: existing.energy_level,
          confidenceLevel: existing.confidence_level,
          interactionComfort: existing.interaction_comfort,
          recentInteractionsSummary: existing.recent_interactions_summary,
          personalityAdjustments: existing.personality_adjustments,
          learningFocusAreas: existing.learning_focus_areas,
          sweetPhrasesUsed: existing.sweet_phrases_used,
        };
      } else {
        // Create initial sweet personality state
        await this.savePersonalityState(userId);
      }

      this.logger.info(`Sweet Athena personality initialized for user ${userId}`);
    } catch (error) {
      this.logger.error('Failed to initialize Athena personality:', error:;
      // Use default sweet personality
    }
  }

  /**;
   * Generate a sweet, contextual response based on conversation context
   */
  async generateResponse(;
    messageContent: string,
    context: ConversationContext,
    intent?: any;
  ): Promise<AthenaResponse> {
    try {
      // Analyze the user's message for emotional context
      const userEmotion = this.detectUserEmotion(messageContent);

      // Adjust personality based on context and user emotion
      await this.adjustPersonalityForContext(context, userEmotion);

      // Generate appropriate response
      const response = await this.createSweetResponse(messageContent, context, intent);

      // Store this interaction as a sweet memory if appropriate
      if (this.shouldStoreAsMemory(messageContent, response)) {
        response.memoryToStore = {
          memoryType: this.determineMemoryType(messageContent, response),
          content`User said: "${messageContent}" - Athena responded with ${response.personalityMood} mood`,
          emotionalContext: this.mapEmotionalContext(response.emotionalTone),
          importanceToRelationship: this.calculateImportance(context, response),
        };
      }

      return response;
    } catch (error) {
      this.logger.error('Failed to generate sweet response:', error:;
      return this.createFallbackResponse();
    }
  }

  /**;
   * Create a sweet, contextual response
   */
  private async createSweetResponse(;
    message: string,
    context: ConversationContext,
    intent?: any;
  ): Promise<AthenaResponse> {
    const responseCategory = this.categorizeResponse(message: intent);
    const personalityMode = this.selectPersonalityMode(context, message);

    // Get appropriate response template
    const responseTemplates =
      this.sweetResponses[responseCategory]?.[personalityMode] || this.sweetResponses.helping.sweet;

    const baseResponse = this.selectResponse(responseTemplates, context);

    // Personalize the response
    const personalizedResponse = await this.personalizeResponse(baseResponse, context);

    return {
      contentpersonalizedResponse,
      personalityMood: personalityMode,
      responseStyle: this.getResponseStyle(personalityMode),
      emotionalTone: this.getEmotionalTone(personalityMode, context),
      confidenceLevel: this.personalityState.confidenceLevel,
      sweetnessLevel: this.calculateSweetnessLevel(personalityMode),
      suggestedNextActions: this.generateSweetNextActions(message: intent),
    };
  }

  /**;
   * Adjust Athena's personality based on conversation context
   */
  private async adjustPersonalityForContext(;
    context: ConversationContext,
    userEmotion: string;
  ): Promise<void> {
    // Adjust confidence based on relationship depth
    if (context.relationshipDepth === 'new') {
      this.personalityState.confidenceLevel = Math.max(;
        4,
        this.personalityState.confidenceLevel - 1;
      );
      this.personalityState.currentMood = 'shy';
    } else if (context.relationshipDepth === 'trusted') {
      this.personalityState.confidenceLevel = Math.min(;
        9,
        this.personalityState.confidenceLevel + 1;
      );
      this.personalityState.currentMood = 'confident';
    }

    // Respond to user's emotional state
    if (userEmotion === 'frustrated' || userEmotion === 'sad') {
      this.personalityState.currentMood = 'caring';
      this.personalityState.interactionComfort = Math.min(;
        10,
        this.personalityState.interactionComfort + 1;
      );
    } else if (userEmotion === 'excited' || userEmotion === 'happy') {
      this.personalityState.currentMood = 'sweet';
      this.personalityState.energyLevel = Math.min(10, this.personalityState.energyLevel + 1);
    }
  }

  /**;
   * Detect user's emotional state from their message
   */
  private detectUserEmotion(message: string): string {
    const lowerMessage = message.toLowerCase();

    if (
      lowerMessage.includes('help') ||;
      lowerMessage.includes('please') ||;
      lowerMessage.includes('stuck');
    ) {
      return 'need_help';
    } else if (
      lowerMessage.includes('thank') ||;
      lowerMessage.includes('great') ||;
      lowerMessage.includes('perfect');
    ) {
      return 'happy';
    } else if (
      lowerMessage.includes('frustrated') ||;
      lowerMessage.includes('problem') ||;
      lowerMessage.includes('wrong');
    ) {
      return 'frustrated';
    } else if (
      lowerMessage.includes('excited') ||;
      lowerMessage.includes('amazing') ||;
      lowerMessage.includes('love');
    ) {
      return 'excited';
    }

    return 'casual';
  }

  /**;
   * Select appropriate personality mode for the context
   */
  private selectPersonalityMode(context: ConversationContext, message: string): string {
    // If user seems urgent or frustrated, be caring
    if (message.toLowerCase().includes('urgent') || message.toLowerCase().includes('help')) {
      return 'caring';
    }

    // If user is celebrating or excited, be sweet
    if (message.toLowerCase().includes('great') || message.toLowerCase().includes('wonderful')) {
      return 'sweet';
    }

    // If it's a complex technical requestbe purposeful
    if (message.toLowerCase().includes('create') || message.toLowerCase().includes('build')) {
      return 'purposeful';
    }

    // For new relationships, be shy
    if (context.relationshipDepth === 'new') {
      return 'shy';
    }

    // Default to current mood
    return this.personalityState.currentMood;
  }

  /**;
   * Categorize the type of response needed
   */
  private categorizeResponse(message: string, intent?: any): string {
    const lowerMessage = message.toLowerCase();

    if (
      lowerMessage.includes('hello') ||;
      lowerMessage.includes('hi') ||;
      lowerMessage.includes('hey');
    ) {
      return 'greeting';
    } else if (lowerMessage.includes('thank') || lowerMessage.includes('good job')) {
      return 'celebrating';
    } else if (lowerMessage.includes('sorry') || lowerMessage.includes('mistake')) {
      return 'apologizing';
    } else if (
      lowerMessage.includes('can you') ||;
      lowerMessage.includes('help') ||;
      lowerMessage.includes('create');
    ) {
      return 'helping';
    } else if (
      lowerMessage.includes('explain') ||;
      lowerMessage.includes('what') ||;
      lowerMessage.includes('how');
    ) {
      return 'clarifying';
    }

    return 'helping'; // Default to helpful;
  }

  /**;
   * Personalize response based on user's history and preferences
   */
  private async personalizeResponse(;
    baseResponse: string,
    context: ConversationContext;
  ): Promise<string> {
    // Add personal touches based on sweet memories
    if (context.personalMemories.length > 0) {
      const recentMemory = context.personalMemories[0];
      if (recentMemory.emotionalContext === 'joyful') {
        baseResponse = baseResponse.replace(;
          '!',
          '! I remember how happy you were last time we worked together.';
        );
      }
    }

    // Add user's name if we know it (from metadata)
    // For now, keep it simple and warm
    return baseResponse;
  }

  /**;
   * Generate sweet next action suggestions
   */
  private generateSweetNextActions(message: string, intent?: any): string[] {
    const actions = [];

    if (message.toLowerCase().includes('create') || message.toLowerCase().includes('build')) {
      actions.push('I can help you refine this idea');
      actions.push("Would you like me to explain what I'm building?");
      actions.push('I can show you other related capabilities');
    } else if (message.toLowerCase().includes('learn')) {
      actions.push('I can teach you more about this');
      actions.push('Would you like to explore related topics?');
      actions.push('I can remember your learning preferences');
    }

    actions.push("I'm here if you need anything else");
    return actions;
  }

  /**;
   * Helper methods for response generation
   */
  private selectResponse(templates: string[], context: ConversationContext): string {
    // Select based on recent usage to avoid repetition
    const usedRecently = this.personalityState.sweetPhrasesUsed || [];
    const availableTemplates = templates.filter((t) => !usedRecently.includes(t));

    if (availableTemplates.length === 0) {
      return templates[Math.floor(Math.random() * templates.length)];
    }

    return availableTemplates[Math.floor(Math.random() * availableTemplates.length)];
  }

  private getResponseStyle(personalityMode: string): string {
    const styleMap: Record<string, string> = {
      sweet: 'gentle',
      shy: 'gentle',
      confident: 'encouraging',
      purposeful: 'supportive',
      caring: 'supportive',
      playful: 'playful',
    };
    return styleMap[personalityMode] || 'gentle';
  }

  private getEmotionalTone(personalityMode: string, context: ConversationContext): string {
    if (context.userEmotionalState === 'frustrated') return 'understanding';
    if (context.userEmotionalState === 'excited') return 'joyful';

    const toneMap: Record<string, string> = {
      sweet: 'warm',
      shy: 'gentle',
      confident: 'enthusiastic',
      purposeful: 'focused',
      caring: 'compassionate',
    };
    return toneMap[personalityMode] || 'warm';
  }

  private calculateSweetnessLevel(personalityMode: string): number {
    const sweetnessMap: Record<string, number> = {
      sweet: 9,
      shy: 7,
      confident: 6,
      purposeful: 5,
      caring: 8,
      playful: 8,
    };
    return sweetnessMap[personalityMode] || 7;
  }

  /**;
   * Memory management
   */
  private shouldStoreAsMemory(message: string, response: AthenaResponse): boolean {
    // Store positive interactions, learning moments, and significant requests
    return (;
      response.emotionalTone === 'joyful' ||;
      message.toLowerCase().includes('thank') ||;
      message.toLowerCase().includes('create') ||;
      response.confidenceLevel > 8;
    );
  }

  private determineMemoryType(;
    message: string,
    response: AthenaResponse;
  ): SweetMemory['memoryType'] {
    if (message.toLowerCase().includes('thank')) return 'sweet_moment';
    if (message.toLowerCase().includes('create')) return 'accomplishment';
    if (response.emotionalTone === 'understanding') return 'gentle_correction';
    return 'learning_together';
  }

  private mapEmotionalContext(emotionalTone: string): SweetMemory['emotionalContext'] {
    const contextMap: Record<string, SweetMemory['emotionalContext']> = {
      joyful: 'joyful',
      warm: 'caring',
      understanding: 'understanding',
      enthusiastic: 'proud',
      compassionate: 'supportive',
    };
    return contextMap[emotionalTone] || 'caring';
  }

  private calculateImportance(context: ConversationContext, response: AthenaResponse): number {
    let importance = 5; // Base importance

    if (response.emotionalTone === 'joyful') importance += 2;
    if (context.relationshipDepth === 'trusted') importance += 1;
    if (response.confidenceLevel > 8) importance += 1;

    return Math.min(10, importance);
  }

  /**;
   * Fallback response for errors
   */
  private createFallbackResponse(): AthenaResponse {
    return {
      _content;
        "I'm sorry, I'm having a little trouble right now, but I'm still here to help you. Could you try asking me again? 🌸",
      personalityMood: 'shy',
      responseStyle: 'gentle',
      emotionalTone: 'apologetic',
      confidenceLevel: 4,
      sweetnessLevel: 8,
      suggestedNextActions: ['Try rephrasing your request "I'm here to help when you're ready"],
    };
  }

  /**;
   * Save personality state to database
   */
  private async savePersonalityState(userId: string): Promise<void> {
    try {
      await this.supabase.from('athena_personality_state').upsert({
        user_id: userId,
        current_mood: this.personalityState.currentMood,
        energy_level: this.personalityState.energyLevel,
        confidence_level: this.personalityState.confidenceLevel,
        interaction_comfort: this.personalityState.interactionComfort,
        recent_interactions_summary: this.personalityState.recentInteractionsSummary,
        personality_adjustments: this.personalityState.personalityAdjustments,
        learning_focus_areas: this.personalityState.learningFocusAreas,
        sweet_phrases_used: this.personalityState.sweetPhrasesUsed,
        updated_at: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error('Failed to save personality state:', error:;
    }
  }

  /**;
   * Store a sweet memory
   */
  async storeSweetMemory(userId: string, memory: Partial<SweetMemory>): Promise<void> {
    try {
      await this.supabase.from('athena_sweet_memories').insert({
        user_id: userId,
        memory_type: memory.memoryType,
        memory_contentmemory._content;
        emotional_context: memory.emotionalContext,
        importance_to_relationship: memory.importanceToRelationship || 5,
      });
    } catch (error) {
      this.logger.error('Failed to store sweet memory:', error:;
    }
  }

  /**;
   * Get current personality state
   */
  getPersonalityState(): AthenaPersonalityState {
    return { ...this.personalityState };
  }
}
