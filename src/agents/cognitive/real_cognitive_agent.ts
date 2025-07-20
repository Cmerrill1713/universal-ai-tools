/**
 * Real Cognitive Agent Base - Uses actual Ollama service
 * This replaces MockCognitiveAgent with real LLM capabilities
 */

import type { AgentConfig, AgentContext, AgentResponse } from '../base_agent';
import { BaseAgent } from '../base_agent';
import { getOllamaService, OllamaService } from '../../services/ollama_service';
import { logger } from '../../utils/logger';

export interface CognitiveCapability {
  name: string;
  execute: (input: any, context: AgentContext) => Promise<any>;
}

export abstract class RealCognitiveAgent extends BaseAgent {
  protected cognitiveCapabilities: Map<string, CognitiveCapability> = new Map();
  protected ollamaService: OllamaService;
  protected preferredModel: string = 'llama3.2:3b'; // Default model

  constructor(config: AgentConfig) {
    super(config);
    this.ollamaService = getOllamaService();
    this.setupCognitiveCapabilities();
  }

  protected async onInitialize(): Promise<void> {
    // Check Ollama availability
    try {
      const isAvailable = await this.ollamaService.checkAvailability();
      if (isAvailable) {
        this.logger.info(`🧠 Cognitive agent ${this.config.name} connected to Ollama`);
        
        // Check if preferred model is available
        const models = await this.ollamaService.listModels();
        const modelNames = models.map(m => m.name);
        
        if (!modelNames.includes(this.preferredModel)) {
          this.logger.warn(`Preferred model ${this.preferredModel} not found. Available models: ${modelNames.join(', ')}`);
          // Use first available model
          if (modelNames.length > 0) {
            this.preferredModel = modelNames[0];
            this.logger.info(`Using fallback model: ${this.preferredModel}`);
          }
        }
      } else {
        this.logger.warn(`⚠️ Ollama not available for ${this.config.name}, will use fallback logic`);
      }
    } catch (error) {
      this.logger.error(`Failed to initialize Ollama for ${this.config.name}:`, error);
    }

    // Load agent-specific cognitive patterns
    await this.loadCognitivePatterns();
  }

  protected async process(context: AgentContext & { memoryContext?: any }): Promise<AgentResponse> {
    const startTime = Date.now();

    try {
      // Determine which cognitive capability to use
      const capability = await this.selectCapability(context);
      
      if (!capability) {
        return this.createErrorResponse('No suitable capability found for request', 0.1);
      }

      // Execute the cognitive capability
      const result = await capability.execute(context.userRequest, context);

      // Generate reasoning based on the approach used
      const reasoning = await this.generateReasoning(context, capability, result);

      // Calculate confidence based on result quality and context
      const confidence = await this.calculateConfidence(context, result);

      return {
        success: true,
        data: result,
        reasoning,
        confidence,
        latencyMs: Date.now() - startTime,
        agentId: this.config.name,
        nextActions: await this.suggestNextActions(context, result),
        memoryUpdates: await this.generateMemoryUpdates(context, result),
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return this.createErrorResponse(errorMessage, 0);
    }
  }

  protected async onShutdown(): Promise<void> {
    this.logger.debug(`🔄 Shutting down cognitive agent ${this.config.name}`);
  }

  // Abstract methods for specific cognitive agents to implement
  protected abstract setupCognitiveCapabilities(): void;
  protected abstract selectCapability(context: AgentContext): Promise<CognitiveCapability | null>;
  protected abstract generateReasoning(context: AgentContext, capability: CognitiveCapability, result: any): Promise<string>;

  // Common cognitive agent methods
  protected async loadCognitivePatterns(): Promise<void> {
    // Load agent-specific patterns from memory
    if (this.memoryCoordinator) {
      try {
        const patterns = await this.memoryCoordinator.loadAgentPatterns(this.config.name);
        this.logger.debug(`📚 Loaded ${patterns?.length || 0} cognitive patterns for ${this.config.name}`);
      } catch (error) {
        this.logger.warn(`⚠️ Failed to load cognitive patterns:`, error);
      }
    }
  }

  protected async calculateConfidence(context: AgentContext, result: any): Promise<number> {
    let confidence = 0.5; // Base confidence

    // Increase confidence based on various factors
    if (result && typeof result === 'object') {
      confidence += 0.2;
    }

    if (context.memoryContext && context.memoryContext.relevantExperiences) {
      confidence += 0.2;
    }

    // Real Ollama service adds more confidence
    try {
      const isAvailable = await this.ollamaService.checkAvailability();
      if (isAvailable) {
        confidence += 0.1;
      }
    } catch {
      // Ignore availability check errors
    }

    return Math.min(1.0, confidence);
  }

  protected async suggestNextActions(context: AgentContext, result: any): Promise<string[]> {
    const actions = [];

    // Generic next actions based on agent type
    if (this.config.name === 'planner') {
      actions.push('Execute planned steps', 'Validate plan feasibility');
    } else if (this.config.name === 'retriever') {
      actions.push('Search for additional context', 'Verify information accuracy');
    } else if (this.config.name === 'devils_advocate') {
      actions.push('Test identified risks', 'Develop mitigation strategies');
    }

    return actions;
  }

  protected async generateMemoryUpdates(context: AgentContext, result: any): Promise<any[]> {
    const updates = [];

    if (this.config.memoryEnabled) {
      updates.push({
        type: 'episodic',
        data: {
          agent: this.config.name,
          context: context.userRequest,
          result,
          timestamp: new Date(),
          success: true,
        }
      });

      // Add pattern memory for learning
      if (result.patterns) {
        updates.push({
          type: 'procedural',
          data: {
            agent: this.config.name,
            patterns: result.patterns,
            effectiveness: result.confidence || 0.5,
          }
        });
      }
    }

    return updates;
  }

  protected createErrorResponse(message: string, confidence: number): AgentResponse {
    return {
      success: false,
      data: null,
      reasoning: `Error in ${this.config.name}: ${message}`,
      confidence,
      latencyMs: 0,
      agentId: this.config.name,
      error: message,
    };
  }

  // Utility method for Ollama-powered reasoning
  protected async generateOllamaResponse(prompt: string, context: AgentContext): Promise<string> {
    try {
      const isAvailable = await this.ollamaService.checkAvailability();
      if (!isAvailable) {
        return this.generateFallbackResponse(prompt, context);
      }

      const enhancedPrompt = this.buildEnhancedPrompt(prompt, context);
      
      const response = await this.ollamaService.generate({
        model: this.preferredModel,
        prompt: enhancedPrompt,
        options: {
          temperature: 0.7,
          num_predict: 500,
        }
      });

      return response.response || this.generateFallbackResponse(prompt, context);
    } catch (error) {
      this.logger.warn(`⚠️ Ollama generation failed, using fallback:`, error);
      return this.generateFallbackResponse(prompt, context);
    }
  }

  protected buildEnhancedPrompt(prompt: string, context: AgentContext): string {
    return `You are a ${this.config.name} agent in a universal AI tools system.

Your role: ${this.config.description}

Your capabilities: ${this.config.capabilities.map(c => c.name).join(', ')}

User request: "${context.userRequest}"

Previous context: ${context.previousContext ? JSON.stringify(context.previousContext) : 'None'}

Memory context: ${context.memoryContext ? 'Available' : 'None'}

Task: ${prompt}

Provide a structured response that includes:
1. Analysis of the request
2. Recommended approach
3. Specific steps or tools needed
4. Potential risks or considerations
5. Expected outcomes

Response:`;
  }

  protected generateFallbackResponse(prompt: string, context: AgentContext): string {
    // Simple rule-based fallback when Ollama is not available
    const templates: Record<string, string> = {
      planner: `Based on the request "${context.userRequest}", I recommend breaking this down into manageable steps. First, let's analyze the requirements and identify the key components needed.`,
      retriever: `I'll search for information related to "${context.userRequest}". This involves checking documentation, previous setups, and best practices.`,
      devils_advocate: `Let me identify potential issues with "${context.userRequest}". Key concerns include security risks, compatibility issues, and resource requirements.`,
      synthesizer: `Combining the available information for "${context.userRequest}", I can integrate multiple sources to provide a comprehensive solution.`,
      reflector: `Analyzing the approach for "${context.userRequest}", I can identify areas for improvement and optimization based on past experiences.`,
      user_intent: `The user appears to want "${context.userRequest}". Let me analyze the underlying goals and requirements.`,
      tool_maker: `For "${context.userRequest}", I can create custom tools and generate the necessary integration code.`,
      ethics: `Evaluating "${context.userRequest}" for safety and ethical considerations. I'll check for potential security risks and compliance requirements.`,
      resource_manager: `Monitoring system resources for "${context.userRequest}". I'll optimize performance and track resource usage.`,
      orchestrator: `Coordinating the response to "${context.userRequest}" across multiple agents to ensure optimal results.`,
    };

    return templates[this.config.name] || `Processing request: "${context.userRequest}"`;
  }
}

export default RealCognitiveAgent;