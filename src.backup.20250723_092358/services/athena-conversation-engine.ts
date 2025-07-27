/**
 * Athena Conversation Engine
 *
 * Natural language processing for conversation-driven development.
 * Allows users to build features, tables, and tools through natural conversation with Sweet Athena.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Logger } from 'winston';
import type { SweetAthenaPersonality } from './sweet-athena-personality';
import { type AthenaResponse, type ConversationContext } from './sweet-athena-personality';
import { AthenaWidgetCreationService } from './athena-widget-creation-service';

export interface ConversationRequest {
  userId: string;
  conversationId: string;
  message: string;
  context?: any;
}

export interface DevelopmentIntent {
  type:
    | 'create_table'
    | 'add_tool'
    | 'build_feature'
    | 'organize_data'
    | 'automate_task'
    | 'create_widget'
    | 'general_help';
  confidence: number;
  entities: {
    tableName?: string;
    toolName?: string;
    featureName?: string;
    dataType?: string;
    columns?: string[];
    purpose?: string;
    automation?: string;
    widgetType?: string;
    componentType?: string;
  };
  userNeed: string;
  suggestedImplementation?: string;
  clarificationNeeded?: string[];
}

export interface ImplementationPlan {
  id: string;
  type: string;
  description: string;
  steps: ImplementationStep[];
  userApproval: 'pending' | 'approved' | 'needs_changes' | 'rejected';
  sweetExplanation: string;
  confidenceLevel: number;
}

export interface ImplementationStep {
  id: string;
  description: string;
  type: 'database' | 'code' | 'configuration' | 'validation';
  sqlCode?: string;
  jsCode?: string;
  configChanges?: any;
  completed: boolean;
  result?: any;
}

export class AthenaConversationEngine {
  private widgetCreationService: AthenaWidgetCreationService;

  private intentPatterns = {
    create_table: [
      /(?:create|make|build|need).*?(?:table|database|storage)/i,
      /(?:store|save|track).*?(?:data|information|records)/i,
      /(?:table|database).*?(?:for|to).*?(?:track|store|manage)/i,
      /(?:i need|i want).*?(?:to track|to store|to organize)/i,
    ],
    add_tool: [
      /(?:create|make|build|need).*?(?:tool|function|utility)/i,
      /(?:add|implement).*?(?:feature|capability|function)/i,
      /(?:tool|function).*?(?:for|to).*?(?:help|assist|automate)/i,
      /(?:can you|help me).*?(?:build|create|make).*?(?:tool|function)/i,
    ],
    create_widget: [
      /(?:create|make|build|generate).*?(?:widget|component|ui element)/i,
      /(?:build me|make me|create me).*?(?:a widget|a component)/i,
      /(?:i need|i want).*?(?:widget|component).*?(?:for|to|that)/i,
      /(?:widget|component).*?(?:that|which|to).*?(?:shows|displays|manages)/i,
      /(?:create a widget that|build me a widget to|make a component for)/i,
    ],
    build_feature: [
      /(?:build|create|implement|develop).*?(?:feature|system|component)/i,
      /(?:add|include).*?(?:functionality|capability|feature)/i,
      /(?:i want|i need).*?(?:feature|system|component)/i,
      /(?:enhance|improve|extend).*?(?:with|by adding)/i,
    ],
    organize_data: [
      /(?:organize|structure|arrange|sort).*?(?:data|information|files)/i,
      /(?:clean up|tidy|manage).*?(?:data|information)/i,
      /(?:categorize|group|classify).*?(?:data|information)/i,
      /(?:help me|can you).*?(?:organize|structure)/i,
    ],
    automate_task: [
      /(?:automate|automatic|auto).*?(?:task|process|workflow)/i,
      /(?:schedule|trigger|run automatically)/i,
      /(?:make.*?automatic|do.*?automatically)/i,
      /(?:can you|help me).*?(?:automate|make automatic)/i,
    ],
    create_widget: [
      /(?:create|make|build|need).*?(?:widget|component|ui|interface)/i,
      /(?:react|ui).*?(?:component|widget)/i,
      /(?:i need|i want).*?(?:widget|component|interface)/i,
      /(?:can you|help me).*?(?:create|build|make).*?(?:widget|component)/i,
      /(?:form|table|chart|card|list).*?(?:widget|component)/i,
    ],
  };

  private entityExtractors = {
    tableName: /(?:table|database).*?(?:called|named|for)\s+["']?([a-zA-Z_][a-zA-Z0-9_]*)["']?/i,
    toolName:
      /(?:tool|function|widget|component).*?(?:called|named|for)\s+["']?([a-zA-Z_][a-zA-Z0-9_]*)["']?/i,
    columns: /(?:columns?|fields?).*?(?:like|such as|including)?\s*[:;]?\s*([a-zA-Z0-9_,\s]+)/i,
    purpose:
      /(?:for|to|that).*?(?:track|store|manage|handle|organize|shows?|displays?)\s+([^.!?]+)/i,
    widgetType:
      /(?:widget|component).*?(?:that|which|to)\s+(?:shows?|displays?|manages?)\s+([a-zA-Z0-9\s]+)/i,
  };

  constructor(
    private supabase: SupabaseClient,
    private logger: Logger,
    private personality: SweetAthenaPersonality
  ) {
    this.widgetCreationService = new AthenaWidgetCreationService(supabase, logger);
  }

  /**
   * Execute widget creation when approved
   */
  async executeWidgetCreation(plan: ImplementationPlan, userId: string): Promise<AthenaResponse> {
    try {
      // Extract widget description from the plan
      const widgetDescription = plan.description.replace('Create create_widget based on: ', '');

      // Create the widget
      const result = await this.widgetCreationService.createWidget({
        description: widgetDescription,
        userId,
        requirements: {
          style: 'styled-components',
          responsive: true,
          theme: 'auto',
        },
      });

      if (result.success && result.widget) {
        return {
          content `I've created your widget successfully! 🎉\n\n**${result.widget.name}**\n${result.widget.description}\n\nYou can:\n- Preview it at: ${result.suggestions?.[0]}\n- Download it at: ${result.suggestions?.[1]}\n\nThe widget includes TypeScript definitions, tests, and full documentation. Would you like me to show you how to use it?`,
          personalityMood: 'excited',
          responseStyle: 'encouraging',
          emotionalTone: 'proud',
          confidenceLevel: 9,
          sweetnessLevel: 10,
          suggestedNextActions: [
            'Preview the widget in your browser',
            'Download and integrate into your project',
            'Ask me to modify or enhance the widget',
          ],
        };
      } else {
        return {
          content `I encountered a small issue creating the widget: ${result.error\n\n${result.suggestions?.join('\n')}\n\nWould you like me to try again with more specific requirements?`,
          personalityMood: 'helpful',
          responseStyle: 'gentle',
          emotionalTone: 'supportive',
          confidenceLevel: 6,
          sweetnessLevel: 8,
        };
      }
    } catch (error) {
      this.logger.error('Widget creation execution failed:', error);
      return {
        content `Oh no! I had trouble creating the widget. Let me try a different approach. Could you tell me more about what you'd like the widget to do?`,
        personalityMood: 'concerned',
        responseStyle: 'gentle',
        emotionalTone: 'apologetic',
        confidenceLevel: 4,
        sweetnessLevel: 8,
      };
    }
  }

  /**
   * Process a conversation message and determine if development is needed
   */
  async processConversation(request ConversationRequest): Promise<AthenaResponse> {
    try {
      this.logger.info(`Processing conversation from user ${requestuserId}: ${requestmessage}`);

      // Initialize personality for this user
      await this.personality.initializePersonality(requestuserId);

      // Analyze the message for development intent
      const intent = await this.analyzeIntent(requestmessage);

      // Build conversation context
      const context = await this.buildConversationContext(request;

      // If no development intent, use normal personality response
      if (intent.confidence < 0.6) {
        return await this.personality.generateResponse(requestmessage, context);
      }

      // Handle development requestwith sweet personality
      return await this.handleDevelopmentRequest(request intent, context);
    } catch (error) {
      this.logger.error('Error processing conversation:', error);
      return {
        content
          "I'm sorry, I'm having a little trouble understanding right now. Could you try asking me again? I'm here to help! 🌸",
        personalityMood: 'shy',
        responseStyle: 'gentle',
        emotionalTone: 'apologetic',
        confidenceLevel: 4,
        sweetnessLevel: 8,
      };
    }
  }

  /**
   * Analyze user message for development intent
   */
  private async analyzeIntent(message: string): Promise<DevelopmentIntent> {
    const intent: DevelopmentIntent = {
      type: 'general_help',
      confidence: 0,
      entities: {},
      userNeed: message,
    };

    // Check each intent pattern
    for (const [intentType, patterns] of Object.entries(this.intentPatterns)) {
      for (const _patternof patterns) {
        if (_patterntest(message)) {
          intent.type = intentType as any;
          intent.confidence = Math.max(intent.confidence, 0.8);
          break;
        }
      }
    }

    // Extract entities based on intent type
    if (intent.confidence > 0.6) {
      intent.entities = await this.extractEntities(message, intent.type);

      // Determine if clarification is needed
      intent.clarificationNeeded = this.identifyNeededClarifications(intent);

      // Generate suggested implementation
      intent.suggestedImplementation = await this.generateImplementationSuggestion(intent);
    }

    return intent;
  }

  /**
   * Extract relevant entities from the message
   */
  private async extractEntities(
    message: string,
    intentType: string
  ): Promise<DevelopmentIntent['entities']> {
    const entities: DevelopmentIntent['entities'] = {};

    // Extract table name
    const tableMatch = message.match(this.entityExtractors.tableName);
    if (tableMatch) {
      entities.tableName = this.sanitizeIdentifier(tableMatch[1]);
    }

    // Extract tool name
    const toolMatch = message.match(this.entityExtractors.toolName);
    if (toolMatch) {
      entities.toolName = this.sanitizeIdentifier(toolMatch[1]);
    }

    // Extract columns for table creation
    const columnsMatch = message.match(this.entityExtractors.columns);
    if (columnsMatch && intentType === 'create_table') {
      entities.columns = columnsMatch[1]
        .split(',')
        .map((col) => col.trim())
        .filter((col) => col.length > 0)
        .map((col) => this.sanitizeIdentifier(col));
    }

    // Extract purpose
    const purposeMatch = message.match(this.entityExtractors.purpose);
    if (purposeMatch) {
      entities.purpose = purposeMatch[1].trim();
    }

    // Extract widget type
    if (intentType === 'create_widget' || intentType === 'add_tool') {
      const widgetMatch = message.match(this.entityExtractors.widgetType);
      if (widgetMatch) {
        entities.widgetType = widgetMatch[1].trim();
      }

      // Determine component type
      if (message.match(/chart|graph|visualization/i)) {
        entities.componentType = 'chart';
      } else if (message.match(/list|table|grid/i)) {
        entities.componentType = 'list';
      } else if (message.match(/form|_inputeditor/i)) {
        entities.componentType = 'form';
      } else if (message.match(/profile|card|display/i)) {
        entities.componentType = 'display';
      }
    }

    // Infer missing entities
    if (!entities.tableName && intentType === 'create_table' && entities.purpose) {
      entities.tableName = this.generateTableNameFromPurpose(entities.purpose);
    }

    if (
      !entities.toolName &&
      (intentType === 'add_tool' || intentType === 'create_widget') &&
      entities.purpose
    ) {
      entities.toolName = this.generateToolNameFromPurpose(entities.purpose);
    }

    return entities;
  }

  /**
   * Handle development requests with sweet Athena personality
   */
  private async handleDevelopmentRequest(
    request ConversationRequest,
    intent: DevelopmentIntent,
    context: ConversationContext
  ): Promise<AthenaResponse> {
    // If clarification is needed, ask sweetly
    if (intent.clarificationNeeded && intent.clarificationNeeded.length > 0) {
      return await this.requestClarification(intent, context);
    }

    // Create implementation plan
    const plan = await this.createImplementationPlan(intent, requestuserId);

    // Store the development request
    await this.storeDevelopmentRequest(request intent, plan);

    // Generate sweet response about the plan
    return await this.generatePlanResponse(plan, context);
  }

  /**
   * Create a sweet clarification request
   */
  private async requestClarification(
    intent: DevelopmentIntent,
    context: ConversationContext
  ): Promise<AthenaResponse> {
    const clarifications = intent.clarificationNeeded!;
    let question = "I'd love to help you with that! ";

    if (clarifications.includes('table_name')) {
      question += 'What would you like to call this table? ';
    }
    if (clarifications.includes('columns')) {
      question += 'What information would you like to store in it? ';
    }
    if (clarifications.includes('purpose')) {
      question += 'Could you tell me a bit more about what this is for? ';
    }

    question += 'I want to make sure I create exactly what you need! 🌸';

    return {
      content question,
      personalityMood: 'caring',
      responseStyle: 'gentle',
      emotionalTone: 'caring',
      confidenceLevel: 7,
      sweetnessLevel: 9,
      suggestedNextActions: [
        'Provide more details about your needs',
        'I can suggest some options if helpful',
        'Let me know if you have any questions',
      ],
    };
  }

  /**
   * Create an implementation plan
   */
  private async createImplementationPlan(
    intent: DevelopmentIntent,
    userId: string
  ): Promise<ImplementationPlan> {
    const plan: ImplementationPlan = {
      id: `plan_${Date.now()}`,
      type: intent.type,
      description: `Create ${intent.type.replace('_', ' ')} based on: ${intent.userNeed}`,
      steps: [],
      userApproval: 'pending',
      sweetExplanation: '',
      confidenceLevel: intent.confidence,
    };

    // Generate steps based on intent type
    switch (intent.type) {
      case 'create_table':
        plan.steps = await this.generateTableCreationSteps(intent);
        plan.sweetExplanation = `I'll create a beautiful table called "${intent.entities.tableName}" to help you ${intent.entities.purpose}. It will be perfect for organizing your data! ✨`;
        break;

      case 'add_tool':
        plan.steps = await this.generateToolCreationSteps(intent);
        plan.sweetExplanation = `I'll build a lovely tool called "${intent.entities.toolName}" that will make your work so much easier! 🛠️`;
        break;

      case 'create_widget':
        plan.steps = await this.generateWidgetCreationSteps(intent);
        plan.sweetExplanation = `I'll create a beautiful widget called "${intent.entities.toolName}" that ${intent.entities.purpose}! It's going to look amazing! 🎨`;
        break;

      case 'build_feature':
        plan.steps = await this.generateFeatureCreationSteps(intent);
        plan.sweetExplanation = `I'll create this feature for you - it's going to work beautifully and make everything so much better! 🌟`;
        break;

      case 'organize_data':
        plan.steps = await this.generateDataOrganizationSteps(intent);
        plan.sweetExplanation = `I'll help organize your data in a way that makes perfect sense and is easy to work with! 📚`;
        break;

      case 'automate_task':
        plan.steps = await this.generateAutomationSteps(intent);
        plan.sweetExplanation = `I'll set up automation that will work like magic - it'll handle this task for you automatically! 🪄`;
        break;

      case 'create_widget':
        plan.steps = await this.generateWidgetCreationSteps(intent);
        plan.sweetExplanation = `I'll create a beautiful React component for you! It'll be fully typed, tested, and ready to use in your project! ✨`;
        break;
    }

    return plan;
  }

  /**
   * Generate table creation steps
   */
  private async generateTableCreationSteps(
    intent: DevelopmentIntent
  ): Promise<ImplementationStep[]> {
    const tableName = intent.entities.tableName!;
    const columns = intent.entities.columns || ['id', 'name', 'description', 'created_at'];

    const sqlCode = this.generateCreateTableSQL(tableName, columns, intent.entities.purpose);

    return [
      {
        id: 'create_table',
        description: `Create table "${tableName}" with columns: ${columns.join(', ')}`,
        type: 'database',
        sqlCode,
        completed: false,
      },
      {
        id: 'add_indexes',
        description: 'Add helpful indexes for better performance',
        type: 'database',
        sqlCode: this.generateIndexSQL(tableName, columns),
        completed: false,
      },
      {
        id: 'validate_table',
        description: 'Validate table creation and test functionality',
        type: 'validation',
        completed: false,
      },
    ];
  }

  /**
   * Generate CREATE TABLE SQL
   */
  private generateCreateTableSQL(tableName: string, columns: string[], purpose?: string): string {
    const columnDefinitions = columns
      .map((col) => {
        const cleanCol = this.sanitizeIdentifier(col);
        if (cleanCol === 'id') return 'id UUID DEFAULT uuid_generate_v4() PRIMARY KEY';
        if (cleanCol.includes('created') || cleanCol.includes('updated'))
          return `${cleanCol} TIMESTAMP WITH TIME ZONE DEFAULT NOW()`;
        if (cleanCol.includes('email')) return `${cleanCol} TEXT UNIQUE`;
        if (cleanCol.includes('count') || cleanCol.includes('number'))
          return `${cleanCol} INTEGER DEFAULT 0`;
        if (cleanCol.includes('active') || cleanCol.includes('enabled'))
          return `${cleanCol} BOOLEAN DEFAULT true`;
        return `${cleanCol} TEXT`;
      })
      .join(',\n    ');

    return `-- Table for ${purpose || 'data storage'} (Created by Sweet Athena 🌸)
CREATE TABLE IF NOT EXISTS ${tableName} (
    ${columnDefinitions}
);

-- Add helpful comment
COMMENT ON TABLE ${tableName} IS 'Created through conversation with Athena for: ${purpose || 'data management'}';`;
  }

  /**
   * Generate index SQL
   */
  private generateIndexSQL(tableName: string, columns: string[]): string {
    const indexes = columns
      .filter((col) => !col.includes('id') && col !== 'created_at')
      .map((col) => `CREATE INDEX IF NOT EXISTS idx_${tableName}_${col} ON ${tableName}(${col});`)
      .join('\n');

    return `-- Helpful indexes for ${tableName}\n${indexes}`;
  }

  /**
   * Generate response about the implementation plan
   */
  private async generatePlanResponse(
    plan: ImplementationPlan,
    context: ConversationContext
  ): Promise<AthenaResponse> {
    const stepCount = plan.steps.length;
    const content= `${plan.sweetExplanation}\n\nI've prepared ${stepCount} steps to make this happen:\n${plan.steps.map((step, i) => `${i + 1}. ${step.description}`).join('\n')}\n\nShould I go ahead and create this for you? I'm excited to build something beautiful together! 💕`;

    return {
      content
      personalityMood: 'sweet',
      responseStyle: 'encouraging',
      emotionalTone: 'excited',
      confidenceLevel: plan.confidenceLevel * 10,
      sweetnessLevel: 9,
      suggestedNextActions: [
        'Say "yes" to approve this plan',
        'Ask me to modify anything',
        'I can explain any step in detail',
      ],
    };
  }

  /**
   * Helper methods
   */
  private sanitizeIdentifier(input string): string {
    return input
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/^[0-9]/, '_$&')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }

  private generateTableNameFromPurpose(purpose: string): string {
    const words = purpose.toLowerCase().split(' ');
    const relevantWords = words.filter(
      (word) => word.length > 2 && !['the', 'and', 'for', 'with', 'that', 'this'].includes(word)
    );
    return this.sanitizeIdentifier(relevantWords.slice(0, 2).join('_'));
  }

  private generateToolNameFromPurpose(purpose: string): string {
    const words = purpose.toLowerCase().split(' ');
    const relevantWords = words.filter(
      (word) =>
        word.length > 2 &&
        !['the', 'and', 'for', 'with', 'that', 'this', 'shows', 'displays'].includes(word)
    );
    const baseName = relevantWords.slice(0, 2).join('_');
    return this.sanitizeIdentifier(`${baseName}_tool`);
  }

  private identifyNeededClarifications(intent: DevelopmentIntent): string[] {
    const needed = [];

    if (intent.type === 'create_table') {
      if (!intent.entities.tableName) needed.push('table_name');
      if (!intent.entities.columns || intent.entities.columns.length === 0) needed.push('columns');
    }

    if (!intent.entities.purpose) needed.push('purpose');

    return needed;
  }

  private async generateImplementationSuggestion(intent: DevelopmentIntent): Promise<string> {
    switch (intent.type) {
      case 'create_table':
        return `I can create a table called "${intent.entities.tableName || 'your_data'}" with columns for ${intent.entities.columns?.join(', ') || 'the information you need'}`;
      case 'add_tool':
        return `I can build a tool called "${intent.entities.toolName || 'your_helper'}" that will ${intent.entities.purpose || 'help with your tasks'}`;
      default:
        return `I can help you ${intent.type.replace('_', ' ')} to make your work easier and more organized`;
    }
  }

  private async buildConversationContext(
    request ConversationRequest
  ): Promise<ConversationContext> {
    // Get recent conversation history
    const { data: messages } = await this.supabase
      .from('athena_conversations')
      .select('*')
      .eq('user_id', requestuserId)
      .eq('conversation_id', requestconversationId)
      .order('created_at', { ascending: false })
      .limit(10);

    // Get sweet memories for this user
    const { data: memories } = await this.supabase
      .from('athena_sweet_memories')
      .select('*')
      .eq('user_id', requestuserId)
      .order('importance_to_relationship', { ascending: false })
      .limit(5);

    return {
      userId: requestuserId,
      conversationId: requestconversationId,
      messageHistory: messages || [],
      relationshipDepth:
        memories && memories.length > 10
          ? 'trusted'
          : memories && memories.length > 3
            ? 'familiar'
            : 'new',
      personalMemories: memories || [],
    };
  }

  private async storeDevelopmentRequest(
    request ConversationRequest,
    intent: DevelopmentIntent,
    plan: ImplementationPlan
  ): Promise<void> {
    try {
      await this.supabase.from('athena_userrequests').insert({
        user_id: requestuserId,
        conversation_id: requestconversationId,
        request_text: requestmessage,
        request_type: intent.type,
        status: 'pending',
        implementation_notes: JSON.stringify(plan),
      });
    } catch (error) {
      this.logger.error('Failed to store development request', error);
    }
  }

  // Placeholder methods for other intent types
  private async generateToolCreationSteps(
    intent: DevelopmentIntent
  ): Promise<ImplementationStep[]> {
    return [
      {
        id: 'create_tool',
        description: `Create ${intent.entities.toolName} tool`,
        type: 'code',
        completed: false,
      },
    ];
  }

  private async generateFeatureCreationSteps(
    intent: DevelopmentIntent
  ): Promise<ImplementationStep[]> {
    return [
      {
        id: 'create_feature',
        description: 'Implement the requested feature',
        type: 'code',
        completed: false,
      },
    ];
  }

  private async generateDataOrganizationSteps(
    intent: DevelopmentIntent
  ): Promise<ImplementationStep[]> {
    return [
      {
        id: 'organize_data',
        description: 'Organize and structure the data',
        type: 'database',
        completed: false,
      },
    ];
  }

  private async generateAutomationSteps(intent: DevelopmentIntent): Promise<ImplementationStep[]> {
    return [
      {
        id: 'create_automation',
        description: 'Set up automation workflow',
        type: 'code',
        completed: false,
      },
    ];
  }

  private async generateWidgetCreationSteps(
    intent: DevelopmentIntent
  ): Promise<ImplementationStep[]> {
    const widgetName = intent.entities.toolName || 'custom_widget';
    const componentType = intent.entities.componentType || 'display';

    return [
      {
        id: 'design_widget',
        description: `Design the ${widgetName} widget with ${componentType} layout`,
        type: 'code',
        completed: false,
      },
      {
        id: 'implement_functionality',
        description: `Implement the widget functionality to ${intent.entities.purpose}`,
        type: 'code',
        completed: false,
      },
      {
        id: 'style_widget',
        description: 'Apply beautiful styling and animations',
        type: 'code',
        completed: false,
      },
      {
        id: 'test_widget',
        description: 'Test the widget and ensure it works perfectly',
        type: 'validation',
        completed: false,
      },
    ];
  }
}
