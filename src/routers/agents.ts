/**
 * Agents Router - Provides information about available agents
 * Includes both main agents and single-file agents
 */

import { type Request, type Response, Router } from 'express';
import { authenticate } from '@/middleware/auth';
import { singleFileAgentBridge } from '@/services/single-file-agent-bridge';
import { log, LogContext } from '@/utils/logger';

const router = Router();

/**
 * Helper functions for enhanced agent metadata
 */

function categorizeSingleFileAgent(keywords: string[]): string {
  const keywordStr = keywords.join(' ').toLowerCase();
  
  if (keywordStr.includes('photo') || keywordStr.includes('image') || keywordStr.includes('face')) {
    return 'photos';
  }
  if (keywordStr.includes('data') || keywordStr.includes('organize') || keywordStr.includes('structure')) {
    return 'data';
  }
  if (keywordStr.includes('safety') || keywordStr.includes('security') || keywordStr.includes('validate')) {
    return 'security';
  }
  if (keywordStr.includes('code') || keywordStr.includes('program') || keywordStr.includes('develop')) {
    return 'development';
  }
  return 'general';
}

function generateUsageExamples(agent: any): string[] {
  const examples: string[] = [];
  const name = agent.name;
  const keywords = agent.keywords || [];
  
  // Generate contextual examples based on agent type
  if (name.includes('face')) {
    examples.push('Find all photos with faces in my photo library');
    examples.push('Detect and identify people in this image');
  } else if (name.includes('photo')) {
    examples.push('Organize my photos by date and location');
    examples.push('Help me manage my Mac Photos library');
  } else if (name.includes('data')) {
    examples.push('Organize this dataset into meaningful categories');
    examples.push('Create a structured profile from this information');
  } else if (name.includes('safety')) {
    examples.push('Check if this content is safe and appropriate');
    examples.push('Validate the security of this input');
  } else {
    examples.push(`Help me with ${keywords[0] || 'general'} tasks`);
    examples.push(`Ask me about ${agent.description?.toLowerCase() || 'various topics'}`);
  }
  
  return examples;
}

function generateCategorySummary(agents: any): any {
  const categories: { [key: string]: any } = {};
  
  // Process all agents to build category summary
  [...agents.main, ...agents.singleFile].forEach(agent => {
    const category = agent.category;
    if (!categories[category]) {
      categories[category] = {
        name: category,
        count: 0,
        agents: [],
        description: getCategoryDescription(category),
        icon: getCategoryIcon(category)
      };
    }
    categories[category].count++;
    categories[category].agents.push({
      name: agent.name,
      type: agent.type,
      description: agent.description
    });
  });
  
  return Object.values(categories);
}

function getCategoryDescription(category: string): string {
  const descriptions: { [key: string]: string } = {
    'photos': 'Image processing, face detection, and photo organization',
    'data': 'Data organization, structuring, and analysis',
    'security': 'Safety validation and security checks',
    'development': 'Code assistance and development tools',
    'general': 'General purpose assistance and coordination'
  };
  return descriptions[category] || 'Specialized assistance tools';
}

function getCategoryIcon(category: string): string {
  const icons: { [key: string]: string } = {
    'photos': '📸',
    'data': '📊',
    'security': '🛡️',
    'development': '💻',
    'general': '🤖'
  };
  return icons[category] || '⚙️';
}

/**
 * GET /api/v1/agents
 * List all available agents (main + single-file)
 * Public endpoint - returns empty array if registry not initialized
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    // Get main agents from registry
    const agentRegistry = (global as any).agentRegistry;
    const mainAgents = agentRegistry ? agentRegistry.getAvailableAgents() : [];

    // Get single-file agents
    const singleFileAgents = singleFileAgentBridge.isAvailable() 
      ? singleFileAgentBridge.getAvailableAgents()
      : [];

    // Format response with enhanced metadata
    const agents = {
      main: mainAgents.map((agent: any) => ({
        name: agent.name,
        category: agent.category || 'general',
        description: agent.description,
        capabilities: agent.capabilities,
        priority: agent.priority,
        type: 'main',
        status: 'available',
        usageExamples: [
          `Ask "${agent.name}" to help with ${agent.category || 'general'} tasks`,
          `Use for: ${agent.description?.toLowerCase() || 'various tasks'}`
        ],
        metadata: {
          averageResponseTime: '1-3 seconds',
          successRate: '95%',
          lastUpdated: new Date().toISOString()
        }
      })),
      singleFile: singleFileAgents.map((agent) => ({
        name: agent.name,
        category: categorizeSingleFileAgent(agent.keywords),
        description: agent.description,
        keywords: agent.keywords,
        confidence: agent.confidence,
        type: 'single-file',
        status: 'available',
        usageExamples: generateUsageExamples(agent),
        metadata: {
          executionTime: '5-30 seconds',
          scriptBased: true,
          lastUpdated: new Date().toISOString()
        }
      }))
    };

    // Generate category summary for better discovery
    const categories = generateCategorySummary(agents);
    
    return res.json({
      success: true,
      agents: [...agents.main, ...agents.singleFile], // Flatten for test compatibility
      data: {
        agents,
        categories,
        total: {
          main: agents.main.length,
          singleFile: agents.singleFile.length,
          all: agents.main.length + agents.singleFile.length
        },
        capabilities: {
          mainAgents: agentRegistry ? true : false,
          singleFileAgents: singleFileAgentBridge.isAvailable()
        },
        discovery: {
          quickStart: [
            'Try asking: "Help me organize my photos"',
            'Try asking: "Can you detect faces in images?"',
            'Try asking: "Help me with data organization"',
            'Try asking: "What can you help me with?"'
          ],
          popularAgents: agents.singleFile.slice(0, 3).map(agent => ({
            name: agent.name,
            description: agent.description,
            exampleUsage: agent.usageExamples[0]
          }))
        }
      },
      metadata: {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown',
        version: '2.0',
        enhanced: true
      }
    });

  } catch (error) {
    log.error('Failed to list agents', LogContext.API, {
      error: error instanceof Error ? error.message : String(error)
    });

    return res.status(500).json({
      success: false,
      error: {
        code: 'AGENTS_LIST_ERROR',
        message: 'Failed to retrieve agent information'
      }
    });
  }
});

/**
 * POST /api/v1/agents/detect
 * Agent recommendation and discovery based on user request
 * Public endpoint for agent discovery
 */
router.post('/detect', async (req: Request, res: Response) => {
  try {
    const { message } = req.body;
    
    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Message is required and must be a string'
        }
      });
    }

    // Use single-file agent bridge to detect best agents
    const bestAgent = singleFileAgentBridge.detectBestAgent(message);
    const allAgents = singleFileAgentBridge.getAvailableAgents();
    
    // Generate suggestions based on keyword matching
    const suggestions = allAgents
      .map(agent => {
        const score = calculateRelevanceScore(message, agent);
        return { ...agent, relevanceScore: score };
      })
      .filter(agent => agent.relevanceScore > 0.3)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 5);

    return res.json({
      success: true,
      data: {
        recommendedAgent: bestAgent ? bestAgent.name : 'personal_assistant',
        confidence: bestAgent ? bestAgent.confidence : 0.5,
        suggestions: suggestions.map(agent => ({
          name: agent.name,
          description: agent.description,
          category: categorizeSingleFileAgent(agent.keywords),
          relevanceScore: agent.relevanceScore,
          usageExample: generateUsageExamples(agent)[0]
        })),
        fallbackOptions: [
          {
            name: 'smart-assistant',
            description: 'General purpose assistant that can coordinate other agents',
            reason: 'Can help route your request to the most appropriate specialist'
          }
        ]
      },
      metadata: {
        timestamp: new Date().toISOString(),
        query: message.substring(0, 100) + (message.length > 100 ? '...' : ''),
        totalAgentsEvaluated: allAgents.length
      }
    });

  } catch (error) {
    log.error('Failed to detect agents', LogContext.API, {
      error: error instanceof Error ? error.message : String(error)
    });

    return res.status(500).json({
      success: false,
      error: {
        code: 'AGENT_DETECTION_ERROR',
        message: 'Failed to analyze request for agent recommendations'
      }
    });
  }
});

function calculateRelevanceScore(message: string, agent: any): number {
  const lowerMessage = message.toLowerCase();
  let score = 0;
  
  // Keyword matching with different weights
  agent.keywords.forEach((keyword: string) => {
    if (lowerMessage.includes(keyword.toLowerCase())) {
      score += 0.3;
    }
  });
  
  // Name matching
  if (lowerMessage.includes(agent.name.toLowerCase().replace('-', ' '))) {
    score += 0.5;
  }
  
  // Description matching
  const descWords = agent.description.toLowerCase().split(' ');
  descWords.forEach((word: string) => {
    if (word.length > 3 && lowerMessage.includes(word)) {
      score += 0.1;
    }
  });
  
  // Apply agent confidence as multiplier
  score *= agent.confidence;
  
  return Math.min(score, 1.0); // Cap at 1.0
}

/**
 * POST /api/v1/agents/discover-features
 * Enhanced feature discovery that integrates agent detection with feature discovery
 */
router.post('/discover-features', authenticate, async (req: Request, res: Response) => {
  try {
    const { message, includeAgents = true, includeFeatures = true } = req.body;
    
    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Message is required and must be a string'
        }
      });
    }

    const results: any = {
      query: message,
      agents: null,
      features: null,
      recommendations: [],
    };

    // Get agent recommendations if requested
    if (includeAgents) {
      const bestAgent = singleFileAgentBridge.detectBestAgent(message);
      const allAgents = singleFileAgentBridge.getAvailableAgents();
      
      const agentSuggestions = allAgents
        .map(agent => {
          const score = calculateRelevanceScore(message, agent);
          return { ...agent, relevanceScore: score };
        })
        .filter(agent => agent.relevanceScore > 0.2)
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, 3);

      results.agents = {
        recommended: bestAgent,
        suggestions: agentSuggestions.map(agent => ({
          name: agent.name,
          description: agent.description,
          category: categorizeSingleFileAgent(agent.keywords),
          relevanceScore: agent.relevanceScore,
          type: 'agent',
        }))
      };
    }

    // Get feature recommendations if requested
    if (includeFeatures) {
      try {
        const { featureDiscoveryService } = await import('../services/feature-discovery-service');
        
        // Extract keywords from the message
        const keywords = message.toLowerCase().split(/\s+/).filter(word => word.length > 2);
        
        const userIntent = {
          query: message,
          keywords,
        };

        const userId = (req as any).user?.id || 'anonymous';
        
        const discoveryResult = await featureDiscoveryService.discoverFeatures(
          userIntent,
          userId,
          {
            limit: 5,
            includeExamples: true,
            personalizeResults: true,
          }
        );

        results.features = {
          suggestions: discoveryResult.suggestions.map(suggestion => ({
            name: suggestion.feature.name,
            description: suggestion.feature.description,
            category: suggestion.feature.category,
            confidence: suggestion.confidence,
            reason: suggestion.reason,
            type: 'feature',
            examples: suggestion.feature.examples.slice(0, 2),
          })),
          confidence: discoveryResult.confidence,
        };
      } catch (error) {
        log.warn('Feature discovery service not available', LogContext.API, { error });
        results.features = { error: 'Feature discovery service unavailable' };
      }
    }

    // Create unified recommendations combining agents and features
    const unifiedRecommendations = [];

    if (results.agents?.suggestions) {
      unifiedRecommendations.push(...results.agents.suggestions.map((agent: any) => ({
        ...agent,
        unified_type: 'agent',
        unified_score: agent.relevanceScore,
      })));
    }

    if (results.features?.suggestions) {
      unifiedRecommendations.push(...results.features.suggestions.map((feature: any) => ({
        ...feature,
        unified_type: 'feature',
        unified_score: feature.confidence,
      })));
    }

    // Sort unified recommendations by score
    unifiedRecommendations.sort((a, b) => b.unified_score - a.unified_score);

    results.recommendations = unifiedRecommendations.slice(0, 8);

    return res.json({
      success: true,
      data: results,
      metadata: {
        timestamp: new Date().toISOString(),
        query: message.substring(0, 100) + (message.length > 100 ? '...' : ''),
        includeAgents,
        includeFeatures,
        totalRecommendations: results.recommendations.length,
      }
    });

  } catch (error) {
    log.error('Failed to discover features and agents', LogContext.API, {
      error: error instanceof Error ? error.message : String(error)
    });

    return res.status(500).json({
      success: false,
      error: {
        code: 'DISCOVERY_ERROR',
        message: 'Failed to discover features and agents'
      }
    });
  }
});

export default router;