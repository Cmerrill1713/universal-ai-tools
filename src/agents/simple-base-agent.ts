/**
 * Simple Base Agent - Basic LLM integration without complex dependencies
 */

import { LogContext, log } from '../utils/logger.js';
import type SimpleMemoryService from '../services/simple-memory-service.js';

export interface SimpleAgentResponse {
  success: boolean;
  message: string;
  confidence: number;
  model: string;
  timestamp: string;
  agentType: string;
}

export abstract class SimpleBaseAgent {
  protected agentName: string;
  protected agentType: string;
  protected memoryService: SimpleMemoryService;

  constructor(name: string, type: string, memoryService: SimpleMemoryService) {
    this.agentName = name;
    this.agentType = type;
    this.memoryService = memoryService;
  }

  /**
   * Process a user request and return a response
   */
  async processRequest(message: string, userId: string): Promise<SimpleAgentResponse> {
    try {
      log.info(`🤖 ${this.agentName} processing request`, LogContext.AGENT, {
        agentType: this.agentType,
        userId,
        messageLength: message.length
      });

      // Get conversation context for better responses
      const conversationContext = await this.memoryService.getConversationContext(userId);
      
      // Get the agent-specific response
      const response = await this.generateResponse(message, userId, conversationContext);
      
      const result: SimpleAgentResponse = {
        success: true,
        message: response,
        confidence: this.calculateConfidence(message, response),
        model: this.agentName,
        timestamp: new Date().toISOString(),
        agentType: this.agentType
      };

      // Store the conversation in memory
      await this.memoryService.storeConversation(
        userId, 
        message, 
        response, 
        this.agentType, 
        result.confidence
      );

      log.info(`✅ ${this.agentName} response generated`, LogContext.AGENT, {
        agentType: this.agentType,
        userId,
        responseLength: response.length,
        confidence: result.confidence,
        hasContext: !!conversationContext
      });

      return result;
    } catch (error) {
      log.error(`❌ ${this.agentName} processing failed`, LogContext.AGENT, {
        agentType: this.agentType,
        userId,
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        success: false,
        message: "I'm having trouble processing your request right now. Please try again.",
        confidence: 0.1,
        model: this.agentName,
        timestamp: new Date().toISOString(),
        agentType: this.agentType
      };
    }
  }

  /**
   * Generate agent-specific response - implemented by subclasses
   */
  protected abstract generateResponse(message: string, userId: string, context?: string | null): Promise<string>;

  /**
   * Calculate confidence based on message and response
   */
  protected calculateConfidence(message: string, response: string): number {
    // Simple confidence calculation
    let confidence = 0.7; // Base confidence
    
    // Higher confidence for longer, more detailed responses
    if (response.length > 100) confidence += 0.1;
    if (response.length > 300) confidence += 0.1;
    
    // Lower confidence for very short responses
    if (response.length < 50) confidence -= 0.2;
    
    // Higher confidence if response contains specific keywords
    const specificWords = ['specific', 'example', 'because', 'however', 'therefore'];
    const matchingWords = specificWords.filter(word => 
      response.toLowerCase().includes(word)
    ).length;
    confidence += matchingWords * 0.05;
    
    return Math.max(0.1, Math.min(1.0, confidence));
  }

  /**
   * Get agent information
   */
  getInfo() {
    return {
      name: this.agentName,
      type: this.agentType
    };
  }
}

export default SimpleBaseAgent;