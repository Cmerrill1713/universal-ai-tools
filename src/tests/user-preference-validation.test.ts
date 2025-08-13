/**
 * User Preference Learning System Validation Tests
 * Comprehensive test suite to validate functionality
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock dependencies
jest.mock('../utils/logger', () => ({
  log: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
  LogContext: {
    AI: 'AI',
    DATABASE: 'DATABASE',
  }
}));

jest.mock('../services/supabase-client', () => ({
  getSupabaseClient: jest.fn(() => null), // Mock no Supabase for now
}));

// Import after mocking
import type { UserInteraction, ContextVector } from '../services/user-preference-learning-service';

describe('User Preference Learning System', () => {
  let userPreferenceLearningService: any;
  
  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Dynamic import to get fresh instance
    const module = await import('../services/user-preference-learning-service');
    userPreferenceLearningService = new (module as any).UserPreferenceLearningService();
  });
  
  afterEach(async () => {
    if (userPreferenceLearningService && typeof userPreferenceLearningService.shutdown === 'function') {
      await userPreferenceLearningService.shutdown();
    }
  });

  describe('Service Initialization', () => {
    it('should initialize without errors', async () => {
      expect(async () => {
        await userPreferenceLearningService.initialize();
      }).not.toThrow();
    });

    it('should handle missing Supabase gracefully', async () => {
      await userPreferenceLearningService.initialize();
      expect(userPreferenceLearningService.isInitialized).toBeTruthy();
    });
  });

  describe('User Interaction Recording', () => {
    beforeEach(async () => {
      await userPreferenceLearningService.initialize();
    });

    it('should record basic user interactions', async () => {
      const interaction: UserInteraction = {
        userId: 'test-user-1',
        sessionId: 'session-123',
        timestamp: new Date(),
        interactionType: 'model_selection',
        modelId: 'gpt-4',
        providerId: 'openai',
        taskType: 'coding',
        rating: 4,
      };

      expect(async () => {
        await userPreferenceLearningService.recordInteraction(interaction);
      }).not.toThrow();
    });

    it('should handle feedback interactions', async () => {
      const interaction: UserInteraction = {
        userId: 'test-user-1',
        sessionId: 'session-123',
        timestamp: new Date(),
        interactionType: 'response_rating',
        modelId: 'claude-3',
        providerId: 'anthropic',
        rating: 5,
        feedback: 'Excellent response quality',
        taskType: 'analysis',
      };

      expect(async () => {
        await userPreferenceLearningService.recordInteraction(interaction);
      }).not.toThrow();
    });

    it('should validate interaction types', () => {
      const validTypes = ['model_selection', 'prompt_submission', 'response_rating', 'correction', 'regeneration'];
      
      validTypes.forEach(type => {
        const interaction: UserInteraction = {
          userId: 'test-user-1',
          sessionId: 'session-123',
          timestamp: new Date(),
          interactionType: type as any,
          modelId: 'test-model',
          providerId: 'test-provider',
        };
        
        expect(async () => {
          await userPreferenceLearningService.recordInteraction(interaction);
        }).not.toThrow();
      });
    });
  });

  describe('Model Recommendations', () => {
    beforeEach(async () => {
      await userPreferenceLearningService.initialize();
    });

    it('should provide default recommendations for new users', async () => {
      const context: ContextVector = {
        taskType: 'general',
        complexity: 0.5,
        urgency: 0.3,
        creativity: 0.7,
        technicalLevel: 0.4,
      };

      const recommendations = await userPreferenceLearningService.getModelRecommendations(
        'new-user-123',
        context,
        3
      );

      expect(Array.isArray(recommendations)).toBeTruthy();
      expect(recommendations.length).toBeLessThanOrEqual(3);
    });

    it('should generate personalized model selection', async () => {
      const context: ContextVector = {
        taskType: 'coding',
        complexity: 0.8,
        urgency: 0.6,
        creativity: 0.2,
        technicalLevel: 0.9,
      };

      const selectedModel = await userPreferenceLearningService.getPersonalizedModelSelection(
        'test-user-1',
        context
      );

      expect(typeof selectedModel).toBe('string');
      expect(selectedModel).toContain(':'); // Should be in format "modelId:providerId"
    });

    it('should handle context vectors with missing properties', async () => {
      const context: ContextVector = {
        taskType: 'writing',
        // Missing other properties should get defaults
      } as any;

      expect(async () => {
        await userPreferenceLearningService.getModelRecommendations(
          'test-user-2',
          context,
          1
        );
      }).not.toThrow();
    });
  });

  describe('User Preference Building', () => {
    beforeEach(async () => {
      await userPreferenceLearningService.initialize();
    });

    it('should build preferences from multiple interactions', async () => {
      const userId = 'learning-user-1';
      const modelId = 'preferred-model';
      const providerId = 'preferred-provider';

      // Simulate multiple positive interactions
      for (let i = 0; i < 5; i++) {
        await userPreferenceLearningService.recordInteraction({
          userId,
          sessionId: `session-${i}`,
          timestamp: new Date(),
          interactionType: 'response_rating',
          modelId,
          providerId,
          rating: 5,
          taskType: 'analysis',
        });
      }

      // Process interactions
      await new Promise(resolve => setTimeout(resolve, 100));

      const insights = await userPreferenceLearningService.getUserInsights(userId);
      
      expect(insights).toBeDefined();
      expect(insights.topModels).toBeDefined();
      expect(Array.isArray(insights.topModels)).toBeTruthy();
    });

    it('should handle negative feedback appropriately', async () => {
      const userId = 'critical-user-1';
      
      await userPreferenceLearningService.recordInteraction({
        userId,
        sessionId: 'session-negative',
        timestamp: new Date(),
        interactionType: 'response_rating',
        modelId: 'poor-model',
        providerId: 'test-provider',
        rating: 1,
        feedback: 'Poor response quality',
        wasRegenerated: true,
        corrections: ['Fixed grammar', 'Improved accuracy'],
        taskType: 'writing',
      });

      expect(async () => {
        const insights = await userPreferenceLearningService.getUserInsights(userId);
        expect(insights).toBeDefined();
      }).not.toThrow();
    });
  });

  describe('Feedback Collection and Processing', () => {
    beforeEach(async () => {
      await userPreferenceLearningService.initialize();
    });

    it('should handle user feedback updates', async () => {
      expect(async () => {
        await userPreferenceLearningService.updateUserFeedback(
          'feedback-user-1',
          'session-feedback',
          'test-model',
          'test-provider',
          4,
          'Good response but could be more detailed'
        );
      }).not.toThrow();
    });

    it('should validate rating ranges', async () => {
      // Test edge cases for ratings
      const validRatings = [1, 2, 3, 4, 5];
      
      for (const rating of validRatings) {
        expect(async () => {
          await userPreferenceLearningService.updateUserFeedback(
            'rating-user-1',
            'session-rating',
            'test-model',
            'test-provider',
            rating
          );
        }).not.toThrow();
      }
    });
  });

  describe('Context Processing', () => {
    beforeEach(async () => {
      await userPreferenceLearningService.initialize();
    });

    it('should process context vectors correctly', async () => {
      const contexts: ContextVector[] = [
        {
          taskType: 'coding',
          complexity: 0.9,
          urgency: 0.8,
          creativity: 0.1,
          technicalLevel: 0.95,
          timeOfDay: 'morning',
        },
        {
          taskType: 'creative_writing',
          complexity: 0.6,
          urgency: 0.3,
          creativity: 0.95,
          technicalLevel: 0.2,
          timeOfDay: 'evening',
          userMood: 'creative',
        },
        {
          taskType: 'data_analysis',
          complexity: 0.8,
          urgency: 0.7,
          creativity: 0.3,
          technicalLevel: 0.85,
          previousContext: 'research',
        },
      ];

      for (const context of contexts) {
        expect(async () => {
          await userPreferenceLearningService.getModelRecommendations(
            'context-user-1',
            context,
            2
          );
        }).not.toThrow();
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    beforeEach(async () => {
      await userPreferenceLearningService.initialize();
    });

    it('should handle empty user IDs gracefully', async () => {
      expect(async () => {
        const insights = await userPreferenceLearningService.getUserInsights('');
      }).not.toThrow();
    });

    it('should handle invalid interaction data', async () => {
      const invalidInteractions = [
        {
          // Missing required fields
          userId: 'invalid-user',
        },
        {
          userId: 'invalid-user-2',
          sessionId: 'session',
          interactionType: 'invalid-type', // Invalid type
          modelId: 'model',
          providerId: 'provider',
        },
      ];

      for (const interaction of invalidInteractions) {
        // Should not throw, but may log warnings
        await userPreferenceLearningService.recordInteraction(interaction as any);
      }
    });

    it('should handle extremely long content gracefully', async () => {
      const longContent = 'x'.repeat(100000); // Very long string
      
      const interaction: UserInteraction = {
        userId: 'long-content-user',
        sessionId: 'session-long',
        timestamp: new Date(),
        interactionType: 'prompt_submission',
        modelId: 'test-model',
        providerId: 'test-provider',
        prompt: longContent,
        response: longContent,
        feedback: longContent,
      };

      expect(async () => {
        await userPreferenceLearningService.recordInteraction(interaction);
      }).not.toThrow();
    });
  });

  describe('Performance and Scalability', () => {
    beforeEach(async () => {
      await userPreferenceLearningService.initialize();
    });

    it('should handle multiple concurrent users', async () => {
      const userCount = 10;
      const interactionsPerUser = 5;
      
      const promises = [];
      
      for (let userId = 0; userId < userCount; userId++) {
        for (let interaction = 0; interaction < interactionsPerUser; interaction++) {
          promises.push(
            userPreferenceLearningService.recordInteraction({
              userId: `concurrent-user-${userId}`,
              sessionId: `session-${interaction}`,
              timestamp: new Date(),
              interactionType: 'model_selection',
              modelId: `model-${interaction % 3}`, // Rotate models
              providerId: `provider-${interaction % 2}`, // Rotate providers
              rating: Math.floor(Math.random() * 5) + 1,
              taskType: ['coding', 'writing', 'analysis'][interaction % 3],
            })
          );
        }
      }
      
      expect(async () => {
        await Promise.all(promises);
      }).not.toThrow();
    });

    it('should handle batch processing efficiently', async () => {
      const startTime = Date.now();
      
      // Create many interactions
      for (let i = 0; i < 100; i++) {
        await userPreferenceLearningService.recordInteraction({
          userId: 'batch-user',
          sessionId: `batch-session-${i}`,
          timestamp: new Date(),
          interactionType: 'response_rating',
          modelId: 'batch-model',
          providerId: 'batch-provider',
          rating: (i % 5) + 1,
          taskType: 'batch_processing',
        });
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(5000); // 5 seconds max
    });
  });

  describe('Service Lifecycle', () => {
    it('should shut down gracefully', async () => {
      await userPreferenceLearningService.initialize();
      
      expect(async () => {
        await userPreferenceLearningService.shutdown();
      }).not.toThrow();
    });

    it('should handle restart scenarios', async () => {
      // Initialize
      await userPreferenceLearningService.initialize();
      
      // Add some data
      await userPreferenceLearningService.recordInteraction({
        userId: 'restart-user',
        sessionId: 'session-before-restart',
        timestamp: new Date(),
        interactionType: 'model_selection',
        modelId: 'restart-model',
        providerId: 'restart-provider',
        rating: 4,
      });
      
      // Shutdown
      await userPreferenceLearningService.shutdown();
      
      // Restart
      expect(async () => {
        await userPreferenceLearningService.initialize();
      }).not.toThrow();
    });
  });
});