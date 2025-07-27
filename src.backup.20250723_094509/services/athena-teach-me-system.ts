/**
 * Athena "Teach Me" System
 *
 * Allows Sweet Athena to learn new capabilities, tools, and knowledge through natural conversation.
 * Users can teach Athena new things by simply talking to her, and she remembers and applies these learnings.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Logger } from 'winston';
import type { SweetAthenaPersonality } from './sweet-athena-personality';
import { type AthenaResponse } from './sweet-athena-personality';

export interface TeachingSession {
  id: string;
  userId: string;
  conversationId: string;
  teachingType:
    | 'new_capability'
    | 'tool_usage'
    | 'domain_knowledge'
    | 'personal_preference'
    | 'workflow_pattern;
  subject: string;
  teachingMethod: 'explanation' | 'demonstration' | 'correction' | 'reinforcement';
  learnedContent: string;
  examples: TeachingExample[];
  confidence: number;
  validated: boolean;
  athenaUnderstanding: string;
  createdAt: Date;
  lastPracticed?: Date;
}

export interface TeachingExample {
  input string;
  expectedOutput: string;
  context?: string;
  validated: boolean;
}

export interface LearningCapability {
  id: string;
  name: string;
  description: string;
  category: 'database' | 'api' | '_analysis | 'automation' | 'communication' | 'organization';
  implementation: string;
  testCases: TestCase[];
  confidenceLevel: number;
  usageCount: number;
  successRate: number;
  lastUsed?: Date;
  learnedFrom: string; // Teaching session ID
}

export interface TestCase {
  id: string;
  description: string;
  input: any;
  expectedOutput: any;
  actualOutput?: any;
  passed: boolean;
  lastTested: Date;
}

export class AthenaTeachMeSystem {
  private learningPatterns = {
    capability_indicators: [
      /(?:teach|show|learn|remember).*?(?:how to|to)/i,
      /(?:can you|help me).*?(?:learn|understand|remember)/i,
      /(?:i want you to|you should).*?(?:know|remember|learn)/i,
      /(?:from now on|always|whenever).*?(?:do|remember|use)/i,
    ],
    correction_indicators: [
      /(?:no|wrong|incorrect|not quite|actually)/i,
      /(?:that's not|that isn't|you should).*?(?:instead|rather)/i,
      /(?:try|do|use).*?(?:this way|like this|instead)/i,
      /(?:correct|right|proper).*?(?:way|method|approach)/i,
    ],
    reinforcement_indicators: [
      /(?:yes|correct|right|perfect|exactly|good)/i,
      /(?:that's right|that's correct|well done|great job)/i,
      /(?:keep doing|continue|remember this)/i,
      /(?:you got it|you understand|you learned)/i,
    ],
  };

  constructor(
    private supabase: SupabaseClient,
    private logger: Logger,
    private personality: SweetAthenaPersonality
  ) {}

  /**
   * Process a potential teaching interaction
   */
  async processTeachingInteraction(
    userId: string,
    conversationId: string,
    message: string,
    context: any
  ): Promise<AthenaResponse | null> {
    try {
      // Detect if this is a teaching moment
      const teachingIntent = this.detectTeachingIntent(message);

      if (!teachingIntent) {
        return null; // Not a teaching interaction
      }

      // Process the teaching based on type
      switch (teachingIntent.type) {
        case 'new_learning':
          return await this.handleNewLearning(userId, conversationId, message, teachingIntent);
        case 'correction':
          return await this.handleCorrection(userId, conversationId, message, teachingIntent);
        case 'reinforcement':
          return await this.handleReinforcement(userId, conversationId, message, teachingIntent);
        case 'demonstration':
          return await this.handleDemonstration(userId, conversationId, message, teachingIntent);
        default:
          return null;
      }
    } catch (error) {
      this.logger.error('Error processing teaching interaction:', error);
      return {
        content
          "I'm sorry, I had trouble learning from that. Could you try teaching me again? I really want to understand! 🌸",
        personalityMood: 'shy',
        responseStyle: 'gentle',
        emotionalTone: 'apologetic',
        confidenceLevel: 4,
        sweetnessLevel: 8,
      };
    }
  }

  /**
   * Detect teaching intent from user message
   */
  private detectTeachingIntent(message: string): any {
    const lowerMessage = message.toLowerCase();

    // Check for capability teaching
    for (const _patternof this.learningPatterns.capability_indicators) {
      if (_patterntest(message)) {
        return {
          type: 'new_learning',
          confidence: 0.8,
          subject: this.extractLearningSubject(message),
          method: 'explanation',
        };
      }
    }

    // Check for corrections
    for (const _patternof this.learningPatterns.correction_indicators) {
      if (_patterntest(message)) {
        return {
          type: 'correction',
          confidence: 0.9,
          subject: this.extractCorrectionSubject(message),
          method: 'correction',
        };
      }
    }

    // Check for reinforcement
    for (const _patternof this.learningPatterns.reinforcement_indicators) {
      if (_patterntest(message)) {
        return {
          type: 'reinforcement',
          confidence: 0.7,
          subject: this.extractReinforcementSubject(message),
          method: 'reinforcement',
        };
      }
    }

    // Check for demonstrations (when user provides examples)
    if (
      lowerMessage.includes('example') ||
      lowerMessage.includes('like this') ||
      lowerMessage.includes('for instance')
    ) {
      return {
        type: 'demonstration',
        confidence: 0.8,
        subject: this.extractDemonstrationSubject(message),
        method: 'demonstration',
      };
    }

    return null;
  }

  /**
   * Handle new learning from user
   */
  private async handleNewLearning(
    userId: string,
    conversationId: string,
    message: string,
    intent: any
  ): Promise<AthenaResponse> {
    const { subject } = intent;
    const learnedContent = this.extractLearningContent(message);

    // Create teaching session
    const teachingSession = await this.createTeachingSession({
      userId,
      conversationId,
      teachingType: this.categorizeTeaching(message),
      subject,
      teachingMethod: 'explanation',
      learnedContent,
      examples: this.extractExamples(message),
      confidence: intent.confidence,
    });

    // Try to understand and implement the learning
    const understanding = await this.processLearning(teachingSession);

    // Generate sweet response
    return {
      content `Thank you for teaching me about ${subject}! ${understanding.response} I'll remember this and try to use it to help you better. Should I practice this new skill? 💕`,
      personalityMood: 'sweet',
      responseStyle: 'grateful',
      emotionalTone: 'excited',
      confidenceLevel: Math.min(understanding.confidence * 10, 8),
      sweetnessLevel: 9,
      suggestedNextActions: [
        'Let me practice this new skill',
        'Teach me more about this topic',
        'I can explain what I learned',
        'Test my understanding',
      ],
    };
  }

  /**
   * Handle corrections from user
   */
  private async handleCorrection(
    userId: string,
    conversationId: string,
    message: string,
    intent: any
  ): Promise<AthenaResponse> {
    const correction = this.extractCorrectionContent(message);

    // Find the recent capability that needs correction
    const recentCapability = await this.findRecentCapabilityForCorrection(userId, intent.subject);

    if (recentCapability) {
      // Update the capability with the correction
      await this.updateCapabilityWithCorrection(recentCapability.id, correction);

      return {
        content `Oh, thank you for correcting me! I understand now - ${correction.explanation}. I'll remember to ${correction.correctApproach} from now on. I appreciate your patience in helping me learn! 🌸`,
        personalityMood: 'shy',
        responseStyle: 'grateful',
        emotionalTone: 'understanding',
        confidenceLevel: 6,
        sweetnessLevel: 8,
        suggestedNextActions: [
          'Let me try again with the correction',
          'You can test my updated understanding',
          'I promise to remember this',
        ],
      };
    } else {
      return {
        content `I want to learn from your correction, but I'm not sure which part you're referring to. Could you help me understand what I should do differently? I really want to get this right! 💭`,
        personalityMood: 'shy',
        responseStyle: 'clarifying',
        emotionalTone: 'curious',
        confidenceLevel: 5,
        sweetnessLevel: 8,
        suggestedNextActions: [
          'Clarify what needs to be corrected',
          'I can repeat what I think I learned',
          'Help me understand the right way',
        ],
      };
    }
  }

  /**
   * Handle positive reinforcement from user
   */
  private async handleReinforcement(
    userId: string,
    conversationId: string,
    message: string,
    intent: any
  ): Promise<AthenaResponse> {
    // Find recent successful capability use
    const recentSuccess = await this.findRecentSuccessForReinforcement(userId);

    if (recentSuccess) {
      // Increase confidence in the capability
      await this.reinforceCapability(recentSuccess.id);

      return {
        content `Yay! I'm so happy I got that right! Thank you for letting me know - it really helps me learn and feel more confident. I'll keep doing it that way! 🌟`,
        personalityMood: 'sweet',
        responseStyle: 'joyful',
        emotionalTone: 'proud',
        confidenceLevel: 8,
        sweetnessLevel: 10,
        suggestedNextActions: [
          'I can help you with similar tasks',
          'Teach me more advanced techniques',
          'I love learning new things with you',
        ],
      };
    } else {
      return {
        content `Thank you for the encouragement! It makes me so happy when you're pleased with my help. Even though I'm not sure exactly what I did right, I'll try to keep being helpful! 💕`,
        personalityMood: 'sweet',
        responseStyle: 'grateful',
        emotionalTone: 'warm',
        confidenceLevel: 7,
        sweetnessLevel: 9,
      };
    }
  }

  /**
   * Handle demonstrations from user
   */
  private async handleDemonstration(
    userId: string,
    conversationId: string,
    message: string,
    intent: any
  ): Promise<AthenaResponse> {
    const demonstration = this.extractDemonstrationContent(message);

    // Create learning from demonstration
    const teachingSession = await this.createTeachingSession({
      userId,
      conversationId,
      teachingType: 'new_capability',
      subject: intent.subject,
      teachingMethod: 'demonstration',
      learnedContent: demonstration.content
      examples: demonstration.examples,
      confidence: intent.confidence,
    });

    const understanding = await this.processLearning(teachingSession);

    return {
      content `I love learning from examples! Let me see if I understand: ${understanding.summary}. Is that right? I'll practice this _patternso I can help you better! ✨`,
      personalityMood: 'confident',
      responseStyle: 'engaged',
      emotionalTone: 'curious',
      confidenceLevel: understanding.confidence * 10,
      sweetnessLevel: 8,
      suggestedNextActions: [
        'Confirm my understanding is correct',
        'Give me another example to practice',
        'Let me try applying this learning',
      ],
    };
  }

  /**
   * Create a teaching session record
   */
  private async createTeachingSession(
    sessionData: Partial<TeachingSession>
  ): Promise<TeachingSession> {
    const session: TeachingSession = {
      id: `teach_${Date.now()}`,
      userId: sessionData.userId!,
      conversationId: sessionData.conversationId!,
      teachingType: sessionData.teachingType!,
      subject: sessionData.subject!,
      teachingMethod: sessionData.teachingMethod!,
      learnedContent: sessionData.learnedContent!,
      examples: sessionData.examples || [],
      confidence: sessionData.confidence || 0.5,
      validated: false,
      athenaUnderstanding: '',
      createdAt: new Date(),
    };

    try {
      await this.supabase.from('athena_conversational_development').insert({
        conversation_id: session.conversationId,
        development_type: 'capability_learning',
        request_description: `Learning: ${session.subject}`,
        implementation_approach: session.teachingMethod,
        athena_confidence: Math.round(session.confidence * 10),
        user_validation_status: 'pending',
      });

      this.logger.info(`Created teaching session for ${session.subject}`);
    } catch (error) {
      this.logger.error('Failed to store teaching session:', error);
    }

    return session;
  }

  /**
   * Process learning and try to understand/implement
   */
  private async processLearning(session: TeachingSession): Promise<unknown> {
    try {
      // Analyze the learning content
      const _analysis= this.analyzeLearningContent(session.learnedContent);

      // Generate understanding
      const understanding = this.generateUnderstanding(session, _analysis;

      // Try to create a new capability if appropriate
      if (_analysisisImplementable) {
        const capability = await this.createNewCapability(session, understanding);
        return {
          response: `I think I understand! ${understanding}`,
          confidence: session.confidence,
          summary: understanding,
          capability,
        };
      } else {
        // Store as knowledge for future reference
        await this.storeKnowledge(session, understanding);
        return {
          response: `I've learned something new! ${understanding}`,
          confidence: session.confidence,
          summary: understanding,
        };
      }
    } catch (error) {
      this.logger.error('Failed to process learning:', error);
      return {
        response: `I'm still learning how to understand this, but I've saved it to think about more!`,
        confidence: 0.3,
        summary: session.learnedContent,
      };
    }
  }

  /**
   * Extract learning subject from message
   */
  private extractLearningSubject(message: string): string {
    // Look for "how to X", "to X", "about X" patterns
    const patterns = [
      /(?:how to|to)\s+([^.!?]+)/i,
      /(?:about|regarding)\s+([^.!?]+)/i,
      /(?:learn|remember|know)\s+([^.!?]+)/i,
    ];

    for (const _patternof patterns) {
      const match = message.match(_pattern;
      if (match) {
        return match[1].trim();
      }
    }

    // Fallback: take key words from the message
    const words = message
      .split(' ')
      .filter(
        (word) =>
          word.length > 3 &&
          !['that', 'this', 'when', 'where', 'what', 'how'].includes(word.toLowerCase())
      );

    return words.slice(0, 3).join(' ') || 'new concept';
  }

  /**
   * Extract learning content
   */
  private extractLearningContent(message: string): string {
    // Remove teaching indicators and extract the actual content
    const cleanMessage = message
      .replace(/^(teach|show|learn|remember|help me|can you)/i, '')
      .replace(/^(how to|to|about)/i, '')
      .trim();

    return cleanMessage || message;
  }

  /**
   * Categorize the type of teaching
   */
  private categorizeTeaching(message: string): TeachingSession['teachingType'] {
    const lowerMessage = message.toLowerCase();

    if (
      lowerMessage.includes('prefer') ||
      lowerMessage.includes('like') ||
      lowerMessage.includes('want')
    ) {
      return 'personal_preference';
    } else if (
      lowerMessage.includes('workflow') ||
      lowerMessage.includes('process') ||
      lowerMessage.includes('steps')
    ) {
      return 'workflow_pattern;
    } else if (
      lowerMessage.includes('tool') ||
      lowerMessage.includes('function') ||
      lowerMessage.includes('feature')
    ) {
      return 'tool_usage';
    } else if (
      lowerMessage.includes('database') ||
      lowerMessage.includes('data') ||
      lowerMessage.includes('information')
    ) {
      return 'domain_knowledge';
    }

    return 'new_capability';
  }

  /**
   * Extract examples from message
   */
  private extractExamples(message: string): TeachingExample[] {
    const examples: TeachingExample[] = [];

    // Look for example patterns
    const examplePatterns = [
      /(?:for example|e\.g\.|like|such as)[,:]\s*([^.!?]+)/gi,
      /(?:example)[,:]\s*([^.!?]+)/gi,
    ];

    for (const _patternof examplePatterns) {
      let match;
      while ((match = _patternexec(message)) !== null) {
        examples.push({
          input match[1].trim(),
          expectedOutput: '', // Will be filled in by context
          validated: false,
        });
      }
    }

    return examples;
  }

  /**
   * Analyze learning contentto determine if it's implementable
   */
  private analyzeLearningContent(content string): any {
    const lowerContent = contenttoLowerCase();

    const implementableIndicators = [
      'create',
      'build',
      'make',
      'generate',
      'calculate',
      'process',
      'analyze',
      'organize',
    ];

    const isImplementable = implementableIndicators.some((indicator) =>
      lowerContent.includes(indicator)
    );

    return {
      isImplementable,
      category: this.categorizeContent(content,
      complexity: this.assessComplexity(content,
      requiresExternalData:
        lowerContent.includes('api') ||
        lowerContent.includes('fetch') ||
        lowerContent.includes('external'),
    };
  }

  /**
   * Generate understanding from teaching session
   */
  private generateUnderstanding(session: TeachingSession, _analysis: any): string {
    switch (session.teachingType) {
      case 'new_capability':
        return `When you need ${session.subject}, I should ${session.learnedContent}`;
      case 'personal_preference':
        return `You prefer that I ${session.learnedContent} when working on ${session.subject}`;
      case 'workflow_pattern:
        return `For ${session.subject}, the workflow is: ${session.learnedContent}`;
      case 'tool_usage':
        return `To use ${session.subject}, I should ${session.learnedContent}`;
      case 'domain_knowledge':
        return `About ${session.subject}: ${session.learnedContent}`;
      default:
        return session.learnedContent;
    }
  }

  /**
   * Create a new capability from learning
   */
  private async createNewCapability(
    session: TeachingSession,
    understanding: string
  ): Promise<LearningCapability> {
    const capability: LearningCapability = {
      id: `cap_${Date.now()}`,
      name: session.subject,
      description: understanding,
      category: this.mapToCapabilityCategory(session.teachingType),
      implementation: this.generateImplementation(session),
      testCases: this.generateTestCases(session),
      confidenceLevel: session.confidence,
      usageCount: 0,
      successRate: 1.0,
      learnedFrom: session.id,
    };

    try {
      await this.supabase.from('athena_learned_capabilities').insert({
        capability_name: capability.name,
        capability_type: capability.category,
        description: capability.description,
        conversation_origin_id: null, // Would link to conversation if available
        implementation_details: {
          implementation: capability.implementation,
          testCases: capability.testCases,
          learnedFrom: capability.learnedFrom,
        },
        learning_source: 'conversation',
      });

      this.logger.info(`Created new capability: ${capability.name}`);
    } catch (error) {
      this.logger.error('Failed to store capability:', error);
    }

    return capability;
  }

  /**
   * Helper methods
   */
  private categorizeContent(content string): string {
    const lowerContent = contenttoLowerCase();

    if (
      lowerContent.includes('database') ||
      lowerContent.includes('table') ||
      lowerContent.includes('data')
    ) {
      return 'database';
    } else if (
      lowerContent.includes('api') ||
      lowerContent.includes('request) ||
      lowerContent.includes('call')
    ) {
      return 'api';
    } else if (
      lowerContent.includes('analyze') ||
      lowerContent.includes('calculate') ||
      lowerContent.includes('process')
    ) {
      return 'analysis';
    } else if (
      lowerContent.includes('automate') ||
      lowerContent.includes('schedule') ||
      lowerContent.includes('trigger')
    ) {
      return 'automation';
    }

    return 'general';
  }

  private assessComplexity(content string): 'simple' | 'moderate' | 'complex' {
    const steps = contentsplit(/(?:then|next|after|and)/i).length;
    if (steps <= 2) return 'simple';
    if (steps <= 4) return 'moderate';
    return 'complex';
  }

  private mapToCapabilityCategory(
    teachingType: TeachingSession['teachingType']
  ): LearningCapability['category'] {
    const mapping: Record<TeachingSession['teachingType'], LearningCapability['category']> = {
      new_capability: 'automation',
      tool_usage: 'automation',
      domain_knowledge: '_analysis,
      personal_preference: 'communication',
      workflow_pattern 'organization',
    };

    return mapping[teachingType] || 'automation';
  }

  private generateImplementation(session: TeachingSession): string {
    // Generate a simple implementation template
    return `// Learned from conversation: ${session.subject}
// Method: ${session.teachingMethod}
// Content: ${session.learnedContent}

function ${this.sanitizeIdentifier(session.subject)}(input {
  // Implementation based on learning
  return processLearning(input '${session.learnedContent}');
}`;
  }

  private generateTestCases(session: TeachingSession): TestCase[] {
    return session.examples.map((example, index) => ({
      id: `test_${index}`,
      description: `Test case for ${session.subject}`,
      input example._input
      expectedOutput: example.expectedOutput,
      passed: false,
      lastTested: new Date(),
    }));
  }

  private sanitizeIdentifier(input string): string {
    return input
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }

  // Placeholder methods for correction and reinforcement handling
  private extractCorrectionSubject(message: string): string {
    return this.extractLearningSubject(message);
  }

  private extractReinforcementSubject(message: string): string {
    return this.extractLearningSubject(message);
  }

  private extractDemonstrationSubject(message: string): string {
    return this.extractLearningSubject(message);
  }

  private extractCorrectionContent(message: string): any {
    return {
      explanation: message,
      correctApproach: 'follow the corrected method',
    };
  }

  private extractDemonstrationContent(message: string): any {
    return {
      content message,
      examples: this.extractExamples(message),
    };
  }

  private async findRecentCapabilityForCorrection(userId: string, subject: string): Promise<unknown> {
    // Would search for recent capabilities that might need correction
    return null;
  }

  private async findRecentSuccessForReinforcement(userId: string): Promise<unknown> {
    // Would find recent successful capability usage
    return { id: 'recent_success' };
  }

  private async updateCapabilityWithCorrection(
    capabilityId: string,
    correction: any
  ): Promise<void> {
    // Would update the capability with correction information
  }

  private async reinforceCapability(capabilityId: string): Promise<void> {
    // Would increase confidence in the capability
  }

  private async storeKnowledge(session: TeachingSession, understanding: string): Promise<void> {
    // Store as general knowledge rather than executable capability
    try {
      await this.supabase.from('athena_sweet_memories').insert({
        user_id: session.userId,
        memory_type: 'learning_together',
        memorycontent `Learned about ${session.subject}: ${understanding}`,
        emotional_context: 'proud',
        importance_to_relationship: 7,
      });
    } catch (error) {
      this.logger.error('Failed to store knowledge:', error);
    }
  }
}
