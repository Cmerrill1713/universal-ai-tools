/**
 * Simple Agent Router - Routes requests to appropriate agents
 */

import { LogContext, log } from '../utils/logger.js';
import type { SimpleAgentResponse, SimpleBaseAgent } from './simple-base-agent.js';
import SimplePersonalAssistant from './simple-personal-assistant.js';
import SimpleCodeAssistant from './simple-code-assistant.js';
import { SimpleMemoryService } from '../services/simple-memory-service.js';

export class SimpleAgentRouter {
  private personalAssistant: SimplePersonalAssistant;
  private codeAssistant: SimpleCodeAssistant;
  private memoryService: SimpleMemoryService;
  
  constructor() {
    this.memoryService = new SimpleMemoryService();
    this.personalAssistant = new SimplePersonalAssistant(this.memoryService);
    this.codeAssistant = new SimpleCodeAssistant(this.memoryService);
  }

  /**
   * Route a message to the most appropriate agent
   */
  async routeMessage(message: string, userId: string): Promise<SimpleAgentResponse> {
    try {
      const selectedAgent = this.selectAgent(message);
      
      log.info('🎯 Routing message to agent', LogContext.AGENT, {
        userId,
        selectedAgent: selectedAgent.getInfo().name,
        agentType: selectedAgent.getInfo().type,
        messageLength: message.length
      });

      const response = await selectedAgent.processRequest(message, userId);
      
      // Add routing information to response
      return {
        ...response,
        routingInfo: {
          routedBy: 'simple-agent-router',
          selectedAgent: selectedAgent.getInfo().name
        }
      } as SimpleAgentResponse;
      
    } catch (error) {
      log.error('❌ Agent routing failed', LogContext.AGENT, {
        userId,
        error: error instanceof Error ? error.message : String(error)
      });

      // Fallback to personal assistant
      return await this.personalAssistant.processRequest(message, userId);
    }
  }

  /**
   * Select the most appropriate agent based on message content
   */
  private selectAgent(message: string): SimpleBaseAgent {
    const lowerMessage = message.toLowerCase();
    
    // Coding-related keywords
    const codingKeywords = [
      'code', 'programming', 'function', 'class', 'method', 'variable',
      'javascript', 'typescript', 'python', 'java', 'swift', 'go', 'rust',
      'debug', 'error', 'bug', 'fix', 'review', 'refactor',
      'api', 'database', 'sql', 'framework', 'library',
      'algorithm', 'data structure', 'architecture', 'design pattern',
      'frontend', 'backend', 'fullstack', 'web development',
      'react', 'vue', 'angular', 'node', 'express', 'django',
      'git', 'github', 'deployment', 'testing', 'unit test'
    ];
    
    // Check if message contains coding-related keywords
    const codingScore = codingKeywords.reduce((score, keyword) => {
      return score + (lowerMessage.includes(keyword) ? 1 : 0);
    }, 0);
    
    // Additional coding indicators
    let additionalCodingScore = 0;
    
    // Check for code patterns (basic detection)
    if (lowerMessage.includes('function(') || lowerMessage.includes('def ') || 
        lowerMessage.includes('class ') || lowerMessage.includes('import ') ||
        lowerMessage.includes('const ') || lowerMessage.includes('let ') ||
        lowerMessage.includes('var ') || lowerMessage.includes('public ') ||
        lowerMessage.includes('private ') || lowerMessage.includes('async ')) {
      additionalCodingScore += 2;
    }
    
    // Check for file extensions
    if (lowerMessage.includes('.js') || lowerMessage.includes('.ts') ||
        lowerMessage.includes('.py') || lowerMessage.includes('.java') ||
        lowerMessage.includes('.swift') || lowerMessage.includes('.go') ||
        lowerMessage.includes('.rs') || lowerMessage.includes('.cpp')) {
      additionalCodingScore += 1;
    }
    
    const totalCodingScore = codingScore + additionalCodingScore;
    
    // Route to code assistant if there's significant coding content
    if (totalCodingScore >= 2) {
      log.info('🔧 Routing to code assistant', LogContext.AGENT, {
        codingScore: totalCodingScore,
        matchedKeywords: codingKeywords.filter(k => lowerMessage.includes(k))
      });
      return this.codeAssistant;
    }
    
    // Default to personal assistant for general queries
    log.info('👤 Routing to personal assistant', LogContext.AGENT, {
      codingScore: totalCodingScore,
      reason: 'general_query'
    });
    return this.personalAssistant;
  }

  /**
   * Get information about available agents
   */
  getAvailableAgents() {
    return {
      agents: [
        this.personalAssistant.getInfo(),
        this.codeAssistant.getInfo()
      ],
      router: 'simple-agent-router',
      version: '1.0.0',
      memory: this.memoryService.getStats()
    };
  }

  /**
   * Get memory service for direct access
   */
  getMemoryService(): SimpleMemoryService {
    return this.memoryService;
  }
}

export default SimpleAgentRouter;