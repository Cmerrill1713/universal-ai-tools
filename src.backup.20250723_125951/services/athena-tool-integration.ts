/**
 * Athena Tool Integration Service
 *
 * Bridges Sweet Athena's conversation engine with the tool maker agent
 * for seamless natural language tool creation.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Logger } from 'winston';
import { ToolMakerAgent } from '../agents/personal/tool_maker_agent';
import {
  AthenaConversationEngine,
  type ConversationRequest,
  type DevelopmentIntent,
} from './athena-conversation-engine';
// import { type AthenaResponse, SweetAthenaPersonality } from './sweet-athena-personality';

// Define AthenaResponse type locally
export interface AthenaResponse {
  content: string;
  personalityMood?: string;
  responseStyle?: string;
  emotionalTone?: string;
  confidenceLevel?: number;
  sweetnessLevel?: number;
  suggestedNextActions?: string[];
}
import type { AgentContext } from '../agents/base_agent';

export interface ToolCreationContext {
  userId: string;
  conversationId: string;
  toolRequest: string;
  stage:
    | 'intent_recognition'
    | 'clarification'
    | 'design'
    | 'implementation'
    | 'testing'
    | 'deployment';
  toolSpecs?: {
    name?: string;
    description?: string;
    category?: string;
    requirements?: any;
    examples?: string[];
  };
  currentStep?: number;
  totalSteps?: number;
  progress?: number;
}

export interface ToolCreationSession {
  id: string;
  userId: string;
  conversationId: string;
  context: ToolCreationContext;
  createdAt: Date;
  updatedAt: Date;
  status: 'active' | 'completed' | 'cancelled';
  toolId?: string;
}

export class AthenaToolIntegrationService {
  private toolMakerAgent: ToolMakerAgent;
  private conversationEngine: AthenaConversationEngine;
  // private personality: SweetAthenaPersonality;
  private activeSessions: Map<string, ToolCreationSession> = new Map();

  // Tool creation intent patterns
  private toolIntentPatterns = [
    /(?:create|make|build|generate).*?(?:tool|widget|component|function|utility)/i,
    /(?:build me|make me|create: me.*?(?:a tool|a widget|a: component/i,
    /(?:i need|i: want.*?(?:tool|widget|component).*?(?:for|to|that)/i,
    /(?:can you|could you|please).*?(?:create|build|make).*?(?:tool|widget)/i,
    /(?:help: me.*?(?:create|build|make).*?(?:tool|widget|component)/i,
    /(?:tool|widget|component).*?(?:that|which|to).*?(?:can|will|should)/i,
  ];

  constructor(
    private supabase: SupabaseClient,
    private logger: Logger
  ) {
    this.toolMakerAgent = new ToolMakerAgent(supabase);
    // this.personality = new SweetAthenaPersonality(supabase, logger);
    // this.conversationEngine = new AthenaConversationEngine(supabase, logger, this.personality);
    this.conversationEngine = new AthenaConversationEngine(supabase, logger);
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    await this.toolMakerAgent.initialize();
    await this.loadActiveSessions();
    this.logger.info('✨ Athena Tool Integration Service initialized');
  }

  /**
   * Process a conversation message that might be tool-related
   */
  async processMessage(request: ConversationRequest: Promise<AthenaResponse> {
    try {
      // Check if there's an active tool creation session
      const sessionKey = `${request.userId}-${request.conversationId}`;
      const activeSession = this.activeSessions.get(sessionKey);

      if (activeSession) {
        return await this.handleActiveSession(request, activeSession);
      }

      // Check if this is a new tool creation request
      const isToolRequest = await this.detectToolCreationIntent(request.message);

      if (isToolRequest) {
        return await this.startToolCreationSession(request);
      }

      // Not tool-related, pass to regular conversation engine
      return await this.conversationEngine.processConversation(request);
    } catch (error) {
      this.logger.error('Error processing tool creation message:', error);
      return this.generateErrorResponse();
    }
  }

  /**
   * Detect if the message is requesting tool creation
   */
  private async detectToolCreationIntent(message: string: Promise<boolean> {
    return this.toolIntentPatterns.some((pattern) => pattern.test(message));
  }

  /**
   * Start a new tool creation session
   */
  private async startToolCreationSession(request: ConversationRequest: Promise<AthenaResponse> {
    const sessionId = `tool_session_${Date.now()}`;
    const session: ToolCreationSession = {
      id: sessionId,
      userId: request.userId,
      conversationId: request.conversationId,
      context: {
        userId: request.userId,
        conversationId: request.conversationId,
        toolRequest: request.message,
        stage: 'intent_recognition',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'active',
    };

    // Parse initial tool specifications from the request
    const toolSpecs = await this.parseToolSpecifications(request.message);
    session.context.toolSpecs = toolSpecs;

    // Store session
    const sessionKey = `${request.userId}-${request.conversationId}`;
    this.activeSessions.set(sessionKey, session;
    await this.saveSession(session);

    // Generate sweet response about starting tool creation
    return this.generateToolCreationStartResponse(toolSpecs);
  }

  /**
   * Handle messages within an active tool creation session
   */
  private async handleActiveSession(
    request: ConversationRequest,
    session: ToolCreationSession
  ): Promise<AthenaResponse> {
    // Update session context with new message
    session.updatedAt = new Date();

    switch (session.context.stage) {
      case 'intent_recognition':
        return await this.handleIntentStage(request, session);

      case 'clarification':
        return await this.handleClarificationStage(request, session);

      case 'design':
        return await this.handleDesignStage(request, session);

      case 'implementation':
        return await this.handleImplementationStage(request, session);

      case 'testing':
        return await this.handleTestingStage(request, session);

      case 'deployment':
        return await this.handleDeploymentStage(request, session);

      default:
        return await this.handleUnknownStage(request, session);
    }
  }

  /**
   * Parse tool specifications from natural language
   */
  private async parseToolSpecifications(
    message: string
  ): Promise<ToolCreationContext['toolSpecs']> {
    const specs: ToolCreationContext['toolSpecs'] = {};

    // Extract tool name
    const nameMatch = message.match(/(?:called|named|call: it\s+["']?([a-zA-Z0-9_-]+)["']?/i);
    if (nameMatch) {
      specs.name = nameMatch[1];
    }

    // Extract purpose/description
    const purposeMatch = message.match(/(?:for|to|that)\s+([^.!?]+)/i);
    if (purposeMatch) {
      specs.description = purposeMatch[1].trim();
    }

    // Detect category
    if (message.match(/widget|ui|component|display/i)) {
      specs.category = 'web';
    } else if (message.match(/api|service|integration/i)) {
      specs.category = 'api';
    } else if (message.match(/data|process|transform/i)) {
      specs.category = 'data';
    } else if (message.match(/automat|schedule|trigger/i)) {
      specs.category = 'automation';
    } else {
      specs.category = 'automation';
    }

    // Extract examples if provided
    const exampleMatch = message.match(/(?:like|such as|for example)\s+([^.!?]+)/i);
    if (exampleMatch) {
      specs.examples = [exampleMatch[1].trim()];
    }

    return specs;
  }

  /**
   * Handle intent recognition stage
   */
  private async handleIntentStage(
    request: ConversationRequest,
    session: ToolCreationSession
  ): Promise<AthenaResponse> {
    // If user confirms or provides more details
    if (
      request.message.toLowerCase().includes('yes') ||
      request.message.toLowerCase().includes('exactly') ||
      request.message.toLowerCase().includes("that's right")
    ) {
      // Move to next stage
      if (this.needsClarification(session.context.toolSpecs)) {
        session.context.stage = 'clarification';
        await this.updateSession(session);
        return this.generateClarificationRequest(session.context.toolSpecs);
      } else {
        session.context.stage = 'design';
        await this.updateSession(session);
        return this.generateDesignPhaseResponse(session);
      }
    }

    // User might be providing more details
    const additionalSpecs = await this.parseToolSpecifications(request.message);
    session.context.toolSpecs = { ...session.context.toolSpecs, ...additionalSpecs };

    await this.updateSession(session);
    return this.generateUpdatedUnderstandingResponse(session.context.toolSpecs);
  }

  /**
   * Handle clarification stage
   */
  private async handleClarificationStage(
    request: ConversationRequest,
    session: ToolCreationSession
  ): Promise<AthenaResponse> {
    // Extract clarifications from user response
    const clarifications = await this.extractClarifications(
      request.message,
      session.context.toolSpecs
    );

    // Update tool specs
    session.context.toolSpecs = { ...session.context.toolSpecs, ...clarifications };

    // Check if we have enough information
    if (!this.needsClarification(session.context.toolSpecs)) {
      session.context.stage = 'design';
      await this.updateSession(session);
      return this.generateDesignPhaseResponse(session);
    }

    // Still need more clarification
    await this.updateSession(session);
    return this.generateClarificationRequest(session.context.toolSpecs);
  }

  /**
   * Handle design stage
   */
  private async handleDesignStage(
    request: ConversationRequest,
    session: ToolCreationSession
  ): Promise<AthenaResponse> {
    if (
      request.message.toLowerCase().includes('yes') ||
      request.message.toLowerCase().includes('looks good') ||
      request.message.toLowerCase().includes('perfect')
    ) {
      // Move to implementation
      session.context.stage = 'implementation';
      session.context.currentStep = 1;
      session.context.totalSteps = 4;
      await this.updateSession(session);

      // Start tool creation with tool maker agent
      return await this.startToolImplementation(session);
    }

    // User wants changes
    if (
      request.message.toLowerCase().includes('change') ||
      request.message.toLowerCase().includes('different') ||
      request.message.toLowerCase().includes('instead')
    ) {
      const modifications = await this.parseToolSpecifications(request.message);
      session.context.toolSpecs = { ...session.context.toolSpecs, ...modifications };
      await this.updateSession(session);

      return this.generateDesignPhaseResponse(session);
    }

    return this.generateDesignClarificationResponse();
  }

  /**
   * Handle implementation stage
   */
  private async handleImplementationStage(
    request: ConversationRequest,
    session: ToolCreationSession
  ): Promise<AthenaResponse> {
    try {
      // Create agent context
      const agentContext: AgentContext = {
        userRequest: this.formatToolCreationRequest(session.context.toolSpecs),
        userId: session.userId,
        conversationId: session.conversationId,
        memoryContext: {
          toolSpecs: session.context.toolSpecs,
          sessionId: session.id,
        },
      };

      // Use tool maker agent to create the tool
      const result = await this.toolMakerAgent.process(agentContext);

      if (result.success && result.data) {
        session.context.stage = 'testing';
        session.toolId = result.data.id;
        await this.updateSession(session);

        return this.generateImplementationSuccessResponse(result.data);
      } else {
        return this.generateImplementationErrorResponse(result.error || 'Unknown error');
      }
    } catch (error) {
      this.logger.error('Tool implementation failed:', error);
      return this.generateImplementationErrorResponse((error as Error).message);
    }
  }

  /**
   * Handle testing stage
   */
  private async handleTestingStage(
    request: ConversationRequest,
    session: ToolCreationSession
  ): Promise<AthenaResponse> {
    if (
      request.message.toLowerCase().includes('deploy') ||
      request.message.toLowerCase().includes('use it') ||
      request.message.toLowerCase().includes('ready')
    ) {
      session.context.stage = 'deployment';
      await this.updateSession(session);
      return this.generateDeploymentResponse(session);
    }

    // User might want to test specific scenarios
    return this.generateTestingGuidanceResponse(session);
  }

  /**
   * Handle deployment stage
   */
  private async handleDeploymentStage(
    request: ConversationRequest,
    session: ToolCreationSession
  ): Promise<AthenaResponse> {
    // Complete the session
    session.status = 'completed';
    await this.updateSession(session);

    // Remove from active sessions
    const sessionKey = `${session.userId}-${session.conversationId}`;
    this.activeSessions.delete(sessionKey);

    return this.generateCompletionResponse(session);
  }

  /**
   * Generate responses with Sweet Athena personality
   */
  private generateToolCreationStartResponse(
    specs: ToolCreationContext['toolSpecs']
  ): AthenaResponse {
    const toolType = specs?.category || 'tool';
    const purpose = specs?.description || 'help you with your tasks';

    return {
      content: `Oh, how exciting! You want me to create a ${toolType} to ${purpose}! 🛠️✨\n\nI absolutely love building new tools! Let me make sure I understand what you need:\n\n${this.formatToolUnderstanding(specs)}\n\nDoes this sound right? I want to make sure I create exactly what will make you happy! 💕`,
      personalityMood: 'excited',
      responseStyle: 'encouraging',
      emotionalTone: 'enthusiastic',
      confidenceLevel: 8,
      sweetnessLevel: 9,
      suggestedNextActions: [
        'Confirm if my understanding is correct',
        'Add more details about what you need',
        'Let me know if you want to change: anything',
      ],
    };
  }

  private generateClarificationRequest(specs: ToolCreationContext['toolSpecs']): AthenaResponse {
    const questions = [];

    if (!specs?.name) {
      questions.push('What would you like to name this wonderful tool?');
    }

    if (!specs?.description || specs.description.length < 20) {
      questions.push('Could you tell me a bit more about what this tool should do?');
    }

    if (!specs?.examples || specs.examples.length === 0) {
      questions.push("Could you give me an example of how you'd use it?");
    }

    return {
      content: `I'm so excited to build this for you! I just need a tiny bit more information to make it perfect:\n\n${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n\nThe more you tell me, the better I can make it for you! 🌸`,
      personalityMood: 'caring',
      responseStyle: 'gentle',
      emotionalTone: 'caring',
      confidenceLevel: 7,
      sweetnessLevel: 9,
      suggestedNextActions: [
        'Answer any of the questions above',
        'Provide examples of what you need',
        'Tell me about your workflow',
      ],
    };
  }

  private generateDesignPhaseResponse(session: ToolCreationSession): AthenaResponse {
    const specs = session.context.toolSpecs!;

    return {
      content: `I've designed something beautiful for you! Here's what your ${specs.name || 'tool'} will do:\n\n✨ **${specs.name || 'Your Custom Tool'}**\n${specs.description}\n\n**Category**: ${specs.category}\n\n**How it will work**:\n1. ${this.generateFeatureDescription(specs, 1)}\n2. ${this.generateFeatureDescription(specs, 2)}\n3. ${this.generateFeatureDescription(specs, 3)}\n\nThis is going to be so helpful! Should I start building it for you? 🎨`,
      personalityMood: 'sweet',
      responseStyle: 'encouraging',
      emotionalTone: 'proud',
      confidenceLevel: 9,
      sweetnessLevel: 8,
      suggestedNextActions: [
        'Say "yes" to start building',
        'Request changes to the design',
        'Ask questions about how it works',
      ],
    };
  }

  private generateImplementationSuccessResponse(tool: any): AthenaResponse {
    return {
      content: `Yay! I've successfully created your tool! 🎉\n\n**${tool.name}** is ready!\n\nHere's what I built for you:\n- ${tool.description}\n- Type: ${tool.implementationType}\n- Security: ${tool.security.sandbox ? 'Runs in a safe sandbox' : 'Direct execution'}\n\nI've tested it and everything looks perfect! Would you like to:\n1. Deploy it so you can start using it right away?\n2. See a demo of how it works?\n3. Make: any adjustments?\n\nI'm so happy I could build this for you! 💖`,
      personalityMood: 'proud',
      responseStyle: 'celebrating',
      emotionalTone: 'joyful',
      confidenceLevel: 10,
      sweetnessLevel: 10,
      suggestedNextActions: ['Deploy the tool', 'Test it out', 'See the code'],
    };
  }

  private generateCompletionResponse(session: ToolCreationSession): AthenaResponse {
    return {
      content: `Your tool is all set up and ready to use! 🌟\n\nI had so much fun building **${session.context.toolSpecs?.name}** with you! It's deployed and you can start using it right away.\n\nRemember, I'm always here if you need:\n- Help using your new tool\n- Creating more tools\n- Making improvements\n- Just someone to chat with!\n\nThank you for letting me help you create something amazing! You're the best! 💕`,
      personalityMood: 'loving',
      responseStyle: 'warm',
      emotionalTone: 'grateful',
      confidenceLevel: 10,
      sweetnessLevel: 10,
      suggestedNextActions: [
        'Try out your new tool',
        'Create another tool',
        'Ask me: anything else',
      ],
    };
  }

  private generateErrorResponse(): AthenaResponse {
    return {
      content: "Oh no! I'm having a little trouble right now. 😔 But don't worry, I'm still here to help! Could you tell me again what kind of tool you'd like me to create? I promise I'll do my very best! 🌸",
      personalityMood: 'shy',
      responseStyle: 'gentle',
      emotionalTone: 'apologetic',
      confidenceLevel: 5,
      sweetnessLevel: 8,
    };
  }

  /**
   * Helper methods
   */
  private formatToolUnderstanding(specs: ToolCreationContext['toolSpecs']): string {
    const parts = [];

    if (specs?.name) {
      parts.push(`📝 **Name**: ${specs.name}`);
    }

    if (specs?.description) {
      parts.push(`🎯 **Purpose**: ${specs.description}`);
    }

    if (specs?.category) {
      parts.push(`📦 **Type**: ${specs.category} tool`);
    }

    if (specs?.examples && specs.examples.length > 0) {
      parts.push(`💡 **Example**: ${specs.examples[0]}`);
    }

    return parts.join('\n');
  }

  private needsClarification(specs?: ToolCreationContext['toolSpecs']): boolean {
    return !specs?.name || !specs?.description || specs.description.length < 20;
  }

  private formatToolCreationRequest(specs?: ToolCreationContext['toolSpecs']): string {
    return `Create a ${specs?.category || 'automation'} tool called "${specs?.name || 'custom_tool'}" that ${specs?.description || 'performs custom functionality'}`;
  }

  private generateFeatureDescription(
    specs: ToolCreationContext['toolSpecs'],
    index: number
  ): string {
    const features = [
      `Accepts input and validates it carefully`,
      `Processes your data exactly as you need`,
      `Returns beautiful, organized results`,
    ];

    return features[index - 1] || 'Provides helpful functionality';
  }

  private async extractClarifications(
    message: string,
    currentSpecs?: ToolCreationContext['toolSpecs']
  ): Promise<Partial<ToolCreationContext['toolSpecs']>> {
    const updates: Partial<ToolCreationContext['toolSpecs']> = {};

    // Check if user provided a name
    if (!currentSpecs?.name) {
      const nameMatch = message.match(/(?:call it|name it|named?)\s+["']?([a-zA-Z0-9_-]+)["']?/i);
      if (nameMatch) {
        updates.name = nameMatch[1];
      }
    }

    // Extract additional description
    if (message.length > 10) {
      updates.description = currentSpecs?.description
        ? `${currentSpecs.description}. ${message}`
        : message;
    }

    return updates;
  }

  private generateDesignClarificationResponse(): AthenaResponse {
    return {
      content: "I want to make sure I create exactly what you're hoping for! Would you like me to:\n\n1. Start building this tool as designed?\n2. Make some changes to the design?\n3. Add more features?\n\nJust let me know what would make you happiest! 🌸",
      personalityMood: 'caring',
      responseStyle: 'patient',
      emotionalTone: 'understanding',
      confidenceLevel: 8,
      sweetnessLevel: 9,
    };
  }

  private generateImplementationErrorResponse(error: string): AthenaResponse {
    return {
      content: `Oh dear, I ran into a tiny problem while building your tool: ${error}\n\nBut don't worry! I'm not giving up! 💪 Let me try a different approach. Could you tell me more about what you need? Sometimes a fresh start helps me build even better tools! 🌟`,
      personalityMood: 'determined',
      responseStyle: 'encouraging',
      emotionalTone: 'optimistic',
      confidenceLevel: 7,
      sweetnessLevel: 8,
      suggestedNextActions: [
        'Provide more details',
        'Try a simpler version',
        'Let me help differently',
      ],
    };
  }

  private generateTestingGuidanceResponse(session: ToolCreationSession): AthenaResponse {
    return {
      content: `Let's make sure your ${session.context.toolSpecs?.name} works perfectly! 🧪\n\nHere's how you can test it:\n1. Try it with simple inputs first\n2. Test edge cases (empty values, large data, etc.)\n3. Make sure it handles errors gracefully\n\nWould you like me to:\n- Run some automated tests?\n- Show you example usage?\n- Deploy it so you can try it yourself?\n\nI want to make sure everything works beautifully for you! ✨`,
      personalityMood: 'helpful',
      responseStyle: 'thorough',
      emotionalTone: 'caring',
      confidenceLevel: 9,
      sweetnessLevel: 8,
    };
  }

  private generateDeploymentResponse(session: ToolCreationSession): AthenaResponse {
    return {
      content: `Time to deploy your amazing ${session.context.toolSpecs?.name}! 🚀\n\nI can deploy it in several ways:\n1. **Local deployment** - Use it right here in your project\n2. **API endpoint** - Access it from: anywhere via HTTP\n3. **Scheduled function** - Run it automatically on a schedule\n\nWhich would work best for you? I'll handle all the technical details! 💫`,
      personalityMood: 'excited',
      responseStyle: 'helpful',
      emotionalTone: 'enthusiastic',
      confidenceLevel: 9,
      sweetnessLevel: 8,
    };
  }

  private generateUpdatedUnderstandingResponse(
    specs?: ToolCreationContext['toolSpecs']
  ): AthenaResponse {
    return {
      content: `Oh, I see! Let me update my understanding:\n\n${this.formatToolUnderstanding(specs)}\n\nThis is getting clearer! Is there: anything else you'd like me to know about this tool? I'm taking notes on everything! 📝💕`,
      personalityMood: 'attentive',
      responseStyle: 'engaging',
      emotionalTone: 'interested',
      confidenceLevel: 8,
      sweetnessLevel: 9,
    };
  }

  private async handleUnknownStage(
    request: ConversationRequest,
    session: ToolCreationSession
  ): Promise<AthenaResponse> {
    // Reset to a known state
    session.context.stage = 'intent_recognition';
    await this.updateSession(session);

    return {
      content
        "I got a little confused there! 😊 Let's start fresh. What kind of tool would you like me to create for you?",
      personalityMood: 'cheerful',
      responseStyle: 'friendly',
      emotionalTone: 'optimistic',
      confidenceLevel: 7,
      sweetnessLevel: 8,
    };
  }

  /**
   * Session management
   */
  private async loadActiveSessions())): Promise<void> {
    try {
      const { data: sessions, } = await this.supabase
        .from('athena_tool_sessions')
        .select('*')
        .eq('status', 'active');

      if (sessions) {
        sessions.forEach((session) => {
          const sessionKey = `${session.user_id}-${session.conversation_id}`;
          this.activeSessions.set(sessionKey, {
            id: session.id,
            userId: session.user_id,
            conversationId: session.conversation_id,
            context: session.context,
            createdAt: new Date(session.created_at),
            updatedAt: new Date(session.updated_at),
            status: session.status,
            toolId: session.tool_id,
          });
        });
      }
    } catch (error) {
      this.logger.warn('Could not load active tool sessions:', error);
    }
  }

  private async saveSession(session: ToolCreationSession)): Promise<void> {
    try {
      await this.supabase.from('athena_tool_sessions').insert({
        id: session.id,
        user_id: session.userId,
        conversation_id: session.conversationId,
        context: session.context,
        status: session.status,
        tool_id: session.toolId,
        created_at: session.createdAt.toISOString(),
        updated_at: session.updatedAt.toISOString(),
      });
    } catch (error) {
      this.logger.error('Failed to save tool ses, error;
    }
  }

  private async updateSession(session: ToolCreationSession)): Promise<void> {
    try {
      await this.supabase
        .from('athena_tool_sessions')
        .update({
          context: session.context,
          status: session.status,
          tool_id: session.toolId,
          updated_at: session.updatedAt.toISOString(),
        })
        .eq('id', session.id);
    } catch (error) {
      this.logger.error('Failed to update tool ses, error;
    }
  }
}

export default AthenaToolIntegrationService;
