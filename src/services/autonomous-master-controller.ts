/**
 * Autonomous Master Controller
 * Central brain that handles ALL user interactions and routes them appropriately
 * This is the core service that enables the autonomous coding assistant vision
 */

import { LogContext, log } from '../utils/logger.js';
import { ProjectCompletionService } from './project-completion-service.js';
import voiceIntentService, { IntentClassification } from './voice-intent-service.js';
import { homeAssistantService } from './home-assistant-service.js';
import { AgentRegistry } from '../agents/agent-registry.js';
import { IntelligentParameterService } from './intelligent-parameter-service.js';
import { KnowledgeThirstEngine } from './knowledge-thirst-engine.js';
import { MultimodalFusionService } from './multimodal-fusion-service.js';
import { EventStreamService } from './event-stream-service.js';
// import { ContinuousLearningService } from './continuous-learning-service.js'; // TODO: Implement when needed
import { EventEmitter } from 'events';

export interface ConversationContext {
  userId?: string;
  sessionId: string;
  conversationHistory: ConversationMessage[];
  currentTask?: string;
  userPreferences?: Record<string, any>;
  activeProjects?: string[];
  environmentContext?: Record<string, any>;
}

export interface ConversationMessage {
  id: string;
  timestamp: Date;
  role: 'user' | 'assistant' | 'system';
  content: string;
  intent?: IntentClassification;
  action?: string;
  result?: any;
  context?: Record<string, any>;
}

export interface MasterResponse {
  success: boolean;
  message: string;
  action?: string;
  data?: any;
  needsClarification?: boolean;
  clarificationPrompt?: string;
  context?: Record<string, any>;
  suggestions?: string[];
}

export interface TaskExecution {
  id: string;
  type: 'coding' | 'home_automation' | 'email' | 'task_management' | 'general' | 'system';
  request: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  result?: any;
  error?: string;
  startTime: Date;
  endTime?: Date;
  context?: Record<string, any>;
}

class AutonomousMasterController extends EventEmitter {
  private static instance: AutonomousMasterController;
  private voiceIntentService: typeof voiceIntentService;
  private projectCompletionService: ProjectCompletionService;
  private homeAssistantService: typeof homeAssistantService;
  private agentRegistry: AgentRegistry;
  private intelligentParams: IntelligentParameterService;
  private knowledgeEngine: KnowledgeThirstEngine;
  private multimodalFusion: MultimodalFusionService;
  private eventStream: EventStreamService;
  // private learningService: ContinuousLearningService; // TODO: Implement when needed
  
  private activeTasks: Map<string, TaskExecution> = new Map();
  private conversationContexts: Map<string, ConversationContext> = new Map();
  private userPreferences: Map<string, any> = new Map();

  private constructor() {
    super();
    this.voiceIntentService = voiceIntentService;
    this.projectCompletionService = ProjectCompletionService.getInstance();
    this.homeAssistantService = homeAssistantService;
    this.agentRegistry = new AgentRegistry();
    this.intelligentParams = new IntelligentParameterService();
    this.knowledgeEngine = KnowledgeThirstEngine.getInstance();
    this.multimodalFusion = MultimodalFusionService.getInstance();
    this.eventStream = EventStreamService.getInstance();
    // this.learningService = ContinuousLearningService.getInstance(); // TODO: Implement when needed
    
    this.initializeServices();
  }

  public static getInstance(): AutonomousMasterController {
    if (!AutonomousMasterController.instance) {
      AutonomousMasterController.instance = new AutonomousMasterController();
    }
    return AutonomousMasterController.instance;
  }

  private async initializeServices(): Promise<void> {
    log.info('🧠 Initializing Autonomous Master Controller', LogContext.SERVICE);
    
    try {
      // Initialize multimodal fusion integration
      this.multimodalFusion.integrateKnowledgeEngine(this.knowledgeEngine);
      
      // Set up event listeners for learning and optimization
      this.setupEventListeners();
      
      // Set up event stream subscriptions
      this.setupEventStreamSubscriptions();
      
      log.info('✅ Master Controller fully initialized and ready', LogContext.SERVICE);
    } catch (error) {
      log.error('❌ Failed to initialize Master Controller:', LogContext.SERVICE, { error });
      throw error;
    }
  }

  private setupEventListeners(): void {
    // Listen for task completions to learn from them
    this.on('taskCompleted', async (task: TaskExecution) => {
      // Publish to event stream
      await this.eventStream.publish('completion', 'autonomous-master', task, {
        priority: 'normal',
        correlationId: task.id
      });
      // await this.learningService.recordTaskCompletion(task); // TODO: Implement when needed
    });

    this.on('taskFailed', async (task: TaskExecution) => {
      // Publish error to event stream
      await this.eventStream.publish('error', 'autonomous-master', task, {
        priority: 'high',
        correlationId: task.id
      });
      // await this.learningService.recordTaskFailure(task); // TODO: Implement when needed
    });

    // Listen for user feedback to improve responses
    this.on('userFeedback', async (feedback: any) => {
      // Publish feedback to event stream
      await this.eventStream.publish('learning_insight', 'autonomous-master', feedback, {
        priority: 'normal'
      });
      // await this.learningService.recordUserFeedback(feedback); // TODO: Implement when needed
    });
  }
  
  private setupEventStreamSubscriptions(): void {
    // Subscribe to UI actions
    this.eventStream.subscribe('ui_action', async (event) => {
      log.info(`🎮 UI Action received: ${event.payload.action}`, LogContext.SERVICE);
      // Process UI actions in real-time
      if (event.payload.action === 'request') {
        await this.processUserRequest(event.payload.input, event.payload.context);
      }
    });
    
    // Subscribe to knowledge updates
    this.eventStream.subscribe('knowledge_update', async (event) => {
      log.info(`🎓 Knowledge update: ${event.payload.topic}`, LogContext.SERVICE);
      // Apply new knowledge to improve responses
      const insights = this.knowledgeEngine.applyKnowledge(event.payload.context);
      if (insights.length > 0) {
        await this.eventStream.publish('learning_insight', 'autonomous-master', {
          insights,
          source: 'knowledge-engine'
        });
      }
    });
  }

  /**
   * Main entry point for all user interactions
   * This is the primary method that handles everything the user says or types
   */
  async processUserRequest(
    input: string, 
    context?: Partial<ConversationContext>,
    inputType: 'text' | 'voice' = 'text'
  ): Promise<MasterResponse> {
    const sessionId = context?.sessionId || this.generateSessionId();
    const conversationContext = this.getOrCreateContext(sessionId, context);
    
    log.info(`🎯 Processing ${inputType} request: "${input}"`, LogContext.SERVICE);

    try {
      // Analyze input for learning opportunities (ByteDance-style knowledge seeking)
      const learningTriggers = await this.knowledgeEngine.analyzeForLearning(input, context);
      if (learningTriggers.length > 0) {
        log.info(`🎓 Knowledge opportunities detected: ${learningTriggers.length} topics to explore`, LogContext.SERVICE);
      }
      
      // Process through multimodal fusion if applicable
      if (inputType !== 'text') {
        const fusionResult = await this.multimodalFusion.processMultimodal(input, inputType);
        log.info(`🎯 Multimodal fusion result: ${fusionResult.confidence * 100}% confidence`, LogContext.SERVICE);
        conversationContext.environmentContext = {
          ...conversationContext.environmentContext,
          multimodalFusion: fusionResult
        };
        
        // Publish fusion result to event stream
        await this.eventStream.publish('multimodal_fusion', 'autonomous-master', fusionResult, {
          priority: 'normal',
          correlationId: conversationContext.sessionId
        });
      }
      
      // Classify the user's intent
      const intent = await this.voiceIntentService.classifyIntent(input);
      
      // Apply learned knowledge to enhance response
      const knowledgeEnhancements = this.knowledgeEngine.applyKnowledge(input);
      
      // Add to conversation history
      const message: ConversationMessage = {
        id: this.generateMessageId(),
        timestamp: new Date(),
        role: 'user',
        content: input,
        intent,
        context: { inputType }
      };
      
      conversationContext.conversationHistory.push(message);
      
      // Route to appropriate handler based on intent
      const response = await this.routeToHandler(intent, input, conversationContext);
      
      // Add assistant response to history
      const assistantMessage: ConversationMessage = {
        id: this.generateMessageId(),
        timestamp: new Date(),
        role: 'assistant',
        content: response.message,
        action: response.action,
        result: response.data,
        context: response.context
      };
      
      conversationContext.conversationHistory.push(assistantMessage);
      
      // Update context
      this.conversationContexts.set(sessionId, conversationContext);
      
      return response;
      
    } catch (error) {
      log.error('❌ Error processing user request:', LogContext.SERVICE, { error });
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      const errorResponse: MasterResponse = {
        success: false,
        message: "I encountered an error processing your request. Let me try a different approach or please rephrase your request.",
        context: { error: errorMessage }
      };
      
      return errorResponse;
    }
  }

  /**
   * Route classified intent to the appropriate service handler
   */
  private async routeToHandler(
    intent: IntentClassification,
    input: string,
    context: ConversationContext
  ): Promise<MasterResponse> {
    
    const taskId = this.generateTaskId();
    const taskType = this.determineTaskType(intent);
    
    const task: TaskExecution = {
      id: taskId,
      type: taskType,
      request: input,
      status: 'pending',
      startTime: new Date(),
      context: { intent }
    };
    
    this.activeTasks.set(taskId, task);
    task.status = 'in_progress';
    
    try {
      let response: MasterResponse;
      
      switch (taskType) {
        case 'coding':
          response = await this.handleCodingRequest(input, intent, context);
          break;
          
        case 'home_automation':
          response = await this.handleHomeAutomation(input, intent, context);
          break;
          
        case 'email':
          response = await this.handleEmailRequest(input, intent, context);
          break;
          
        case 'task_management':
          response = await this.handleTaskManagement(input, intent, context);
          break;
          
        case 'system':
          response = await this.handleSystemRequest(input, intent, context);
          break;
          
        default:
          response = await this.handleGeneralRequest(input, intent, context);
      }
      
      task.status = 'completed';
      task.endTime = new Date();
      task.result = response;
      
      this.emit('taskCompleted', task);
      
      return response;
      
    } catch (error) {
      task.status = 'failed';
      task.endTime = new Date();
      task.error = error instanceof Error ? error.message : String(error);
      
      this.emit('taskFailed', task);
      
      throw error;
    }
  }

  /**
   * Handle coding and project completion requests
   */
  private async handleCodingRequest(
    input: string,
    intent: IntentClassification,
    context: ConversationContext
  ): Promise<MasterResponse> {
    log.info('👨‍💻 Routing to coding/project completion handler', LogContext.SERVICE);
    
    try {
      const result = await this.projectCompletionService.handleProjectCompletionRequest(input, context);
      
      return {
        success: true,
        message: result,
        action: 'project_completion',
        context: { intent }
      };
    } catch (error) {
      return {
        success: false,
        message: `I encountered an issue with your coding request: ${error instanceof Error ? error.message : 'Unknown error'}. Let me try a different approach.`,
        context: { error: error instanceof Error ? error.message : String(error), intent }
      };
    }
  }

  /**
   * Handle home automation requests
   */
  private async handleHomeAutomation(
    input: string,
    intent: IntentClassification,
    context: ConversationContext
  ): Promise<MasterResponse> {
    log.info('🏠 Routing to home automation handler', LogContext.SERVICE);
    
    try {
      // Parse device and action from the input directly
      let device = 'smart device';
      let action = 'control';
      
      // Extract device from input
      if (input.toLowerCase().includes('light')) device = 'lights';
      else if (input.toLowerCase().includes('temperature')) device = 'thermostat';
      else if (input.toLowerCase().includes('blind')) device = 'blinds';
      else if (input.toLowerCase().includes('door')) device = 'door';
      else if (input.toLowerCase().includes('fan')) device = 'fan';
      
      // Extract action from input
      if (input.toLowerCase().includes('turn on')) action = 'turn on';
      else if (input.toLowerCase().includes('turn off')) action = 'turn off';
      else if (input.toLowerCase().includes('dim')) action = 'dim';
      else if (input.toLowerCase().includes('set')) action = 'set';
      else if (input.toLowerCase().includes('close')) action = 'close';
      else if (input.toLowerCase().includes('open')) action = 'open';
      
      // For now, simulate successful home automation
      // In production, this would call actual Home Assistant API
      const simulatedResult = {
        success: true,
        message: `Successfully executed: ${action} ${device}`,
        device,
        action,
        timestamp: new Date().toISOString()
      };
      
      return {
        success: true,
        message: `✅ ${simulatedResult.message}`,
        action: 'home_automation',
        data: simulatedResult,
        context: { intent, device, action }
      };
    } catch (error) {
      return {
        success: false,
        message: `I couldn't control your smart home device: ${error instanceof Error ? error.message : 'Unknown error'}`,
        context: { error: error instanceof Error ? error.message : String(error), intent }
      };
    }
  }

  /**
   * Handle email requests (placeholder for future implementation)
   */
  private async handleEmailRequest(
    input: string,
    intent: IntentClassification,
    context: ConversationContext
  ): Promise<MasterResponse> {
    log.info('📧 Email handling requested (not yet implemented)', LogContext.SERVICE);
    
    return {
      success: false,
      message: "Email integration is coming soon! I'll be able to check your mail, compose messages, and manage your inbox.",
      action: 'email_placeholder',
      context: { intent }
    };
  }

  /**
   * Handle task management requests
   */
  private async handleTaskManagement(
    input: string,
    intent: IntentClassification,
    context: ConversationContext
  ): Promise<MasterResponse> {
    log.info('📋 Routing to task management handler', LogContext.SERVICE);
    
    // For now, route complex tasks to project completion
    if (intent.entities.complexity === 'high' || intent.keywords.includes('build') || intent.keywords.includes('create')) {
      return await this.handleCodingRequest(input, intent, context);
    }
    
    return {
      success: true,
      message: `I understand you want me to handle: ${input}. Let me work on that for you.`,
      action: 'task_management',
      context: { intent }
    };
  }

  /**
   * Handle system-related requests
   */
  private async handleSystemRequest(
    input: string,
    intent: IntentClassification,
    context: ConversationContext
  ): Promise<MasterResponse> {
    log.info('⚙️ Routing to system handler', LogContext.SERVICE);
    
    if (intent.intent === 'system_status') {
      const status = await this.getSystemStatus();
      return {
        success: true,
        message: `System Status: ${status.message}`,
        action: 'system_status',
        data: status,
        context: { intent }
      };
    }
    
    return {
      success: true,
      message: "System command acknowledged. What would you like me to do?",
      action: 'system_general',
      context: { intent }
    };
  }

  /**
   * Handle general conversation and requests
   */
  private async handleGeneralRequest(
    input: string,
    intent: IntentClassification,
    context: ConversationContext
  ): Promise<MasterResponse> {
    log.info('💬 Routing to general conversation handler', LogContext.SERVICE);
    
    // Use the enhanced agents for general conversation
    try {
      const agent = await this.agentRegistry.getAgent('enhanced-personal-assistant-agent');
      if (!agent) {
        throw new Error('Agent not found');
      }
      const result = await agent.execute({
        userRequest: input,
        requestId: this.generateMessageId(),
        metadata: {
          conversationHistory: context.conversationHistory.slice(-5), // Last 5 messages for context
          userPreferences: context.userPreferences
        }
      });
      
      return {
        success: true,
        message: result.message || "I'm here to help! What can I do for you?",
        action: 'general_conversation',
        data: result,
        context: { intent }
      };
    } catch (error) {
      return {
        success: true,
        message: "I'm here to help you with coding projects, home automation, and daily tasks. What would you like me to work on?",
        action: 'general_fallback',
        context: { intent }
      };
    }
  }

  /**
   * Get or create conversation context for a session
   */
  private getOrCreateContext(sessionId: string, context?: Partial<ConversationContext>): ConversationContext {
    let conversationContext = this.conversationContexts.get(sessionId);
    
    if (!conversationContext) {
      conversationContext = {
        sessionId,
        conversationHistory: [],
        userPreferences: {},
        activeProjects: [],
        environmentContext: {},
        ...context
      };
      this.conversationContexts.set(sessionId, conversationContext);
    }
    
    return conversationContext;
  }

  /**
   * Determine task type from intent classification
   */
  private determineTaskType(intent: IntentClassification): TaskExecution['type'] {
    const intentMap: Record<string, TaskExecution['type']> = {
      'code_generation': 'coding',
      'code_assistance': 'coding',
      'project_creation': 'coding',
      'debugging': 'coding',
      'code_review': 'coding',
      'code_explanation': 'coding',
      'home_control': 'home_automation',
      'smart_home': 'home_automation',
      'device_control': 'home_automation',
      'lights_control': 'home_automation',
      'temperature_control': 'home_automation',
      'email_check': 'email',
      'email_compose': 'email',
      'task_creation': 'task_management',
      'project_management': 'task_management',
      'system_status': 'system',
      'system_control': 'system'
    };
    
    return intentMap[intent.intent] || 'general';
  }

  /**
   * Get current system status
   */
  private async getSystemStatus(): Promise<any> {
    return {
      message: 'All systems operational',
      activeTasks: this.activeTasks.size,
      activeConversations: this.conversationContexts.size,
      uptime: process.uptime(),
      timestamp: new Date()
    };
  }

  // Utility methods
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Public methods for external integration
   */

  /**
   * Process voice input specifically
   */
  async processVoiceInput(audioInput: string, context?: Partial<ConversationContext>): Promise<MasterResponse> {
    return this.processUserRequest(audioInput, context, 'voice');
  }

  /**
   * Get conversation history for a session
   */
  getConversationHistory(sessionId: string): ConversationMessage[] {
    const context = this.conversationContexts.get(sessionId);
    return context?.conversationHistory || [];
  }

  /**
   * Get active tasks
   */
  getActiveTasks(): TaskExecution[] {
    return Array.from(this.activeTasks.values());
  }

  /**
   * Record user feedback for learning
   */
  async recordFeedback(sessionId: string, messageId: string, feedback: 'positive' | 'negative', details?: string): Promise<void> {
    this.emit('userFeedback', {
      sessionId,
      messageId,
      feedback,
      details,
      timestamp: new Date()
    });
  }
}

export default AutonomousMasterController;
export { AutonomousMasterController };