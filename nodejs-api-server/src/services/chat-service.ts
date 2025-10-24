/**
 * Integrated Chat Service
 * Combines UAT-Prompt, Neuroforge, and Context Engineering for advanced chat features
 */

import { UATPromptEngine, UATPromptRequest, UATPromptResponse } from './uat-prompt-engine';
import { NeuroforgeIntegration, NeuroforgeRequest, NeuroforgeResponse, NeuralNetworkConfig } from './neuroforge-integration';
import { OllamaIntegrationService } from './ollama-integration';
import { createClient } from '@supabase/supabase-js';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: {
    uatPrompt?: UATPromptResponse;
    neuroforge?: NeuroforgeResponse;
    contextCategories?: string[];
  };
}

export interface ChatSession {
  id: string;
  userId: string;
  messages: ChatMessage[];
  context: {
    projectPath?: string;
    categories: string[];
    neuralState: any;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ChatServiceConfig {
  supabaseUrl: string;
  supabaseKey: string;
  neuroforgeConfig: NeuralNetworkConfig;
  ollamaConfig: {
    baseUrl: string;
    defaultModel: string;
    timeout: number;
  };
  enableUATPrompt: boolean;
  enableNeuroforge: boolean;
  enableContextEngineering: boolean;
  enableOllama: boolean;
  defaultModel?: string;
  defaultModelProvider?: 'ollama' | 'mlx' | 'openai' | 'anthropic';
}

export class ChatService {
  private uatPromptEngine: UATPromptEngine;
  private neuroforgeIntegration: NeuroforgeIntegration;
  private ollamaService: OllamaIntegrationService;
  private supabase: any;
  private config: ChatServiceConfig;
  private sessions: Map<string, ChatSession> = new Map();

  constructor(config: ChatServiceConfig) {
    this.config = config;
    this.supabase = createClient(config.supabaseUrl, config.supabaseKey);
    
    // Initialize UAT-Prompt Engine
    this.uatPromptEngine = new UATPromptEngine(config.supabaseUrl, config.supabaseKey);
    
    // Initialize Neuroforge Integration
    this.neuroforgeIntegration = new NeuroforgeIntegration(config.neuroforgeConfig, config.supabaseUrl, config.supabaseKey);
    
    // Initialize Ollama Service
    this.ollamaService = new OllamaIntegrationService();
  }

  /**
   * Initialize all services
   */
  async initialize(): Promise<void> {
    try {
      console.log('🚀 Initializing Chat Service...');
      
      // Initialize Neuroforge
      if (this.config.enableNeuroforge) {
        await this.neuroforgeIntegration.initialize();
        console.log('✅ Neuroforge initialized');
      }
      
      // Initialize Ollama
      if (this.config.enableOllama) {
        await this.ollamaService.initialize();
        console.log('✅ Ollama initialized');
      }
      
      console.log('✅ Chat Service initialized successfully');
    } catch (error) {
      console.error('❌ Chat Service initialization failed:', error);
      throw error;
    }
  }

  /**
   * Process a chat message through the complete pipeline
   */
  async processMessage(
    userId: string,
    sessionId: string,
    message: string,
    projectPath?: string
  ): Promise<ChatMessage> {
    console.log('💬 Processing chat message through integrated pipeline...');

    // Get or create session
    const session = await this.getOrCreateSession(userId, sessionId, projectPath);

    // Step 1: UAT-Prompt Processing
    let uatPromptResponse: UATPromptResponse | undefined;
    if (this.config.enableUATPrompt) {
      uatPromptResponse = await this.processUATPrompt(message, session);
    }

    // Step 2: Neuroforge Processing
    let neuroforgeResponse: NeuroforgeResponse | undefined;
    if (this.config.enableNeuroforge) {
      neuroforgeResponse = await this.processNeuroforge(message, session);
    }

    // Step 3: Generate AI Response
    const aiResponse = await this.generateAIResponse(message, session, uatPromptResponse, neuroforgeResponse);

    // Step 4: Create assistant message
    const assistantMessage: ChatMessage = {
      id: this.generateId(),
      role: 'assistant',
      content: aiResponse,
      timestamp: new Date().toISOString(),
      metadata: {
        uatPrompt: uatPromptResponse,
        neuroforge: neuroforgeResponse,
        contextCategories: session.context.categories
      }
    };

    // Step 5: Update session
    session.messages.push(assistantMessage);
    session.updatedAt = new Date().toISOString();
    this.sessions.set(sessionId, session);

    // Step 6: Save to database
    await this.saveMessageToDatabase(assistantMessage, sessionId);

    return assistantMessage;
  }

  /**
   * Process UAT-Prompt optimization
   */
  private async processUATPrompt(message: string, session: ChatSession): Promise<UATPromptResponse> {
    const request: UATPromptRequest = {
      userMessage: message,
      conversationHistory: session.messages.slice(-10).map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      contextCategories: session.context.categories,
      userId: session.userId,
      projectPath: session.context.projectPath
    };

    return await this.uatPromptEngine.processChatMessage(request);
  }

  /**
   * Process Neuroforge neural enhancement
   */
  private async processNeuroforge(message: string, session: ChatSession): Promise<NeuroforgeResponse> {
    const request: NeuroforgeRequest = {
      message: message,
      context: this.buildContextString(session),
      userId: session.userId,
      sessionId: session.id,
      neuralState: session.context.neuralState
    };

    return await this.neuroforgeIntegration.processMessage(request);
  }

  /**
   * Generate AI response using all integrated components
   */
  private async generateAIResponse(
    message: string,
    session: ChatSession,
    uatPrompt?: UATPromptResponse,
    neuroforge?: NeuroforgeResponse
  ): Promise<string> {
    // Build enhanced prompt
    let enhancedPrompt = message;

    if (uatPrompt) {
      enhancedPrompt = uatPrompt.optimizedPrompt;
    }

    if (neuroforge) {
      enhancedPrompt = neuroforge.enhancedMessage;
    }

    // Call LLM with enhanced prompt
    const llmResponse = await this.callLLM(enhancedPrompt, uatPrompt?.suggestedParameters);

    // Apply post-processing based on neuroforge insights
    if (neuroforge) {
      return this.applyPostProcessing(llmResponse, neuroforge);
    }

    return llmResponse;
  }

  /**
   * Call LLM with enhanced prompt using appropriate model provider
   */
  private async callLLM(prompt: string, parameters?: any): Promise<string> {
    try {
      const modelProvider = this.config.defaultModelProvider || 'ollama';
      const model = this.config.defaultModel || this.config.ollamaConfig.defaultModel;

      switch (modelProvider) {
        case 'ollama':
          if (this.config.enableOllama) {
            const response = await this.ollamaService.generateText({
              model: model,
              prompt: prompt,
              options: {
                temperature: parameters?.temperature || 0.7,
                top_p: parameters?.top_p || 0.9,
                num_predict: parameters?.max_tokens || 2000,
                ...parameters
              }
            });

            if (response.done && response.response) {
              return response.response;
            } else {
              throw new Error('Ollama response incomplete');
            }
          } else {
            throw new Error('Ollama is disabled');
          }

        case 'mlx':
          // Use MLX service for inference
          const { MLXIntegrationService } = require('./mlx-integration');
          const mlxService = new MLXIntegrationService();
          await mlxService.initialize();
          
          const mlxResponse = await mlxService.runInference({
            modelName: model,
            prompt: prompt,
            maxTokens: parameters?.max_tokens || 2000,
            temperature: parameters?.temperature || 0.7,
            topP: parameters?.top_p || 0.9,
            topK: parameters?.top_k || 40
          });

          return mlxResponse.response || 'MLX response incomplete';

        case 'openai':
        case 'anthropic':
          // For external API providers, we'd implement API calls here
          // For now, fall back to Ollama
          console.warn(`Provider ${modelProvider} not implemented, falling back to Ollama`);
          return await this.callLLM(prompt, parameters);

        default:
          throw new Error(`Unsupported model provider: ${modelProvider}`);
      }
    } catch (error) {
      console.error('Error calling LLM:', error);
      return `I apologize, but I encountered an error processing your request. Please try again.`;
    }
  }

  /**
   * Apply post-processing based on neuroforge insights
   */
  private applyPostProcessing(response: string, neuroforge: NeuroforgeResponse): string {
    let processed = response;

    // Add empathy if sentiment is negative
    if (neuroforge.neuralInsights.sentiment < -0.3) {
      processed = `I understand this might be challenging. ${processed}`;
    }

    // Add follow-up suggestions
    if (neuroforge.recommendations.followUpQuestions.length > 0) {
      processed += `\n\nWould you like me to elaborate on any of these points?`;
    }

    return processed;
  }

  /**
   * Get or create chat session
   */
  private async getOrCreateSession(
    userId: string, 
    sessionId: string, 
    projectPath?: string
  ): Promise<ChatSession> {
    if (this.sessions.has(sessionId)) {
      return this.sessions.get(sessionId)!;
    }

    const session: ChatSession = {
      id: sessionId,
      userId: userId,
      messages: [],
      context: {
        projectPath: projectPath,
        categories: ['conversation', 'project_info', 'error_analysis', 'code_patterns'],
        neuralState: null
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * Build context string for neuroforge
   */
  private buildContextString(session: ChatSession): string {
    const recentMessages = session.messages.slice(-5);
    return recentMessages.map(msg => `${msg.role}: ${msg.content}`).join('\n');
  }

  /**
   * Save message to database
   */
  private async saveMessageToDatabase(message: ChatMessage, sessionId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('chat_messages')
        .insert({
          id: message.id,
          session_id: sessionId,
          role: message.role,
          content: message.content,
          metadata: message.metadata,
          created_at: message.timestamp
        });

      if (error) {
        console.error('Error saving message to database:', error);
      }
    } catch (error) {
      console.error('Error saving message to database:', error);
    }
  }

  /**
   * Get chat history for a session
   */
  async getChatHistory(sessionId: string): Promise<ChatMessage[]> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return [];
    }
    return session.messages;
  }

  /**
   * Get session context
   */
  async getSessionContext(sessionId: string): Promise<any> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }
    return session.context;
  }

  /**
   * Update session context
   */
  async updateSessionContext(sessionId: string, updates: Partial<ChatSession['context']>): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.context = { ...session.context, ...updates };
      session.updatedAt = new Date().toISOString();
      this.sessions.set(sessionId, session);
    }
  }

  /**
   * Clear session
   */
  async clearSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
    
    // Clear neuroforge state
    this.neuroforgeIntegration.clearNeuralState(sessionId);
  }

  /**
   * Get service statistics
   */
  async getServiceStats(): Promise<any> {
    const neuroforgeStats = this.neuroforgeIntegration.getLearningStats();
    
    return {
      activeSessions: this.sessions.size,
      totalMessages: Array.from(this.sessions.values())
        .reduce((sum, session) => sum + session.messages.length, 0),
      neuroforge: neuroforgeStats,
      configuration: {
        uatPromptEnabled: this.config.enableUATPrompt,
        neuroforgeEnabled: this.config.enableNeuroforge,
        contextEngineeringEnabled: this.config.enableContextEngineering
      }
    };
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}