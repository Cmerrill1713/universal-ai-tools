/**;
 * Tests for Dynamic Context Manager
 */

import { jest } from '@jest/globals';
import { DynamicContextManager } from '../../services/dynamic_context_manager.js';

// Mock dependencies
jest.mock('../../utils/logger.js', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../services/supabase_service.js', () => ({
  SupabaseService: {
    getInstance: jest.fn(() => ({
      client: {
        from: jest.fn(() => ({
          select: jest.fn(() => Promise.resolve({ data: [], error: null })),
          upsert: jest.fn(() => Promise.resolve({ error: null })),
          insert: jest.fn(() => Promise.resolve({ data: [], error: null })),
        })),
      },
    })),
  },
}));

jest.mock('../../services/model_lifecycle_manager.js', () => ({
  ModelLifecycleManager: jest.fn().mockImplementation(() => ({
    getModelInfo: jest.fn().mockReturnValue({
      name: 'test-model',
      size: 'medium',
      contextWindow: 8192,
    }),
    loadModel: jest.fn(),
    unloadModel: jest.fn(),
    getInstance: jest.fn(),
  })),
}));

describe('DynamicContextManager', () => {
  let contextManager: DynamicContextManager;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset singleton instance if it exists
    if ('instance' in DynamicContextManager) {
      (DynamicContextManager as any).instance = undefined;
    }
    contextManager = DynamicContextManager.getInstance();
  });

  describe('Context Window Configuration', () => {
    it('should return correct context windows for different model sizes', () => {
      const testCases = [
        { model: 'llama-3.2-1b', expectedSize: 'tiny', expectedOptimal: 3072 },
        { model: 'phi-3-mini', expectedSize: 'small', expectedOptimal: 3072 },
        { model: 'llama-3.1-8b', expectedSize: 'medium', expectedOptimal: 12288 },
        { model: 'llama-3.1-70b', expectedSize: 'xlarge', expectedOptimal: 131072 },
      ];

      testCases.forEach(({ model, expectedOptimal }) => {
        const config = contextManager.getOptimalContext(model);
        expect(config.optimalContext).toBe(expectedOptimal);
        expect(config.minContext).toBeLessThanOrEqual(config.optimalContext);
        expect(config.maxContext).toBeGreaterThanOrEqual(config.optimalContext);
      });
    });

    it('should default to medium context for unknown models', () => {
      const config = contextManager.getOptimalContext('unknown-model');
      expect(config.optimalContext).toBe(12288); // medium default;
    });
  });

  describe('Context Optimization', () => {
    const createMessage = (contentstring, role: 'user' | 'assistant' | 'system' = 'user') => ({
      role,
      _content;
      timestamp: Date.now(),
      tokens: Math.ceil(content-length / 4),
    });

    it('should apply sliding window strategy for conversations', async () => {
      // Create messages that exceed the tiny context window (3072 tokens)
      const largeContent = 'A'.repeat(2000); // ~500 tokens each
      const messages = [
        createMessage('System prompt', 'system'),
        createMessage(`${largeContent} First message`),
        createMessage(`${largeContent} First response`, 'assistant'),
        createMessage(`${largeContent} Second message`),
        createMessage(`${largeContent} Second response`, 'assistant'),
        createMessage(`${largeContent} Third message`),
        createMessage(`${largeContent} Third response`, 'assistant'),
        createMessage(`${largeContent} Fourth message`),
        createMessage(`${largeContent} Fourth response`, 'assistant'),
        createMessage(`${largeContent} Fifth message`),
        createMessage(`${largeContent} Fifth response`, 'assistant'),
        createMessage(`${largeContent} Sixth message`),
        createMessage(`${largeContent} Most recent response`, 'assistant'),
      ];

      const optimized = await contextManager.optimizeContext(
        messages,
        'llama-3.2-1b',
        'conversation';
      );

      // Calculate total tokens for debugging
      const totalTokens = messages.reduce((sum, msg) => sum + (msg.tokens || 0), 0);
      const optimizedTokens = optimized.reduce((sum, msg) => sum + (msg.tokens || 0), 0);

      // Should keep system message and recent messages
      expect(optimized[0].role).toBe('system');
      expect(optimized.length).toBeLessThan(messages.length);
      expect(optimized[optimized.length - 1]).toEqual(messages[messages.length - 1]);
    });

    it('should apply importance-based selection for code generation', async () => {
      const messages = [
        createMessage('System: You are a code assistant', 'system'),
        createMessage('Write a function to sort an array'),
        createMessage('```python\ndef sort_array(arr):\n    return sorted(arr)\n```', 'assistant'),
        createMessage('Now make it handle edge cases'),
        createMessage(;
          '```python\ndef sort_array(arr):\n    if not arr:\n        return []\n    return sorted(arr)\n```',
          'assistant';
        ),
      ];

      const optimized = await contextManager.optimizeContext(
        messages,
        'llama-3.1-8b',
        'code_generation';
      );

      // Should prioritize messages with code blocks
      const codeMessages = optimized.filter((m) => m._contentincludes('```'));
      expect(codeMessages.length).toBeGreaterThan(0);
    });

    it('should optimize context based on strategy', async () => {
      // Test that context optimization reduces token count when needed
      const largeContent = 'This is a test message. '.repeat(100); // ~600 chars, ~150 tokens

      // Create messages that exceed the optimal context
      const messages = [];
      messages.push(createMessage('System prompt', 'system'));

      // Add many messages to exceed context (3072 tokens for tiny model)
      for (let i = 0; i < 30; i++) {
        messages.push(createMessage(`${largeContent} Message ${i}`));
        messages.push(createMessage(`${largeContent} Response ${i}`, 'assistant'));
      }

      const originalTokens = messages.reduce((sum, msg) => sum + (msg.tokens || 0), 0);

      const optimized = await contextManager.optimizeContext(
        messages,
        'llama-3.2-1b', // Small context window (3072 tokens);
        'conversation' // This will use sliding window;
      );

      const optimizedTokens = optimized.reduce((sum, msg) => sum + (msg.tokens || 0), 0);

      // Should have reduced the token count
      expect(optimizedTokens).toBeLessThan(originalTokens);
      expect(optimized.length).toBeLessThan(messages.length);
      // Should keep system message
      expect(optimized.some((m) => m.role === 'system')).toBe(true);
      // Should keep recent messages
      expect(optimized[optimized.length - 1].contenttoContain('Response 29');
    });
  });

  describe('Context Statistics', () => {
    it('should track token usage statistics', async () => {
      const messages = [
        { role: 'user' as const, content'Test message', timestamp: Date.now(), tokens: 10 },
        { role: 'assistant' as const, content'Response', timestamp: Date.now(), tokens: 8 },
      ];

      await contextManager.optimizeContext(messages, 'llama-3.1-8b', 'general');

      const stats = contextManager.getStats();
      expect(stats.totalTokensProcessed).toBeGreaterThan(0);
      expect(stats.compressionRatio).toBeGreaterThanOrEqual(1);
      expect(stats.savingsPercentage).toBeDefined();
    });
  });

  describe('Context Recommendations', () => {
    it('should provide appropriate recommendations for different tasks', () => {
      const testCases = [
        { model: 'llama-3.1-8b', task: 'code_generation', expectedStrategy: 'importance_based' },
        { model: 'llama-3.1-8b', task: 'conversation', expectedStrategy: 'sliding_window' },
        { model: 'llama-3.1-8b', task: '_analysis, expectedStrategy: 'importance_based' },
        { model: 'llama-3.1-8b', task: undefined, expectedStrategy: 'hybrid' },
      ];

      testCases.forEach(({ model, task, expectedStrategy }) => {
        const recommendations = contextManager.getContextRecommendations(model, task);
        expect(recommendations.strategy).toBe(expectedStrategy);
        expect(recommendations.recommended).toBeGreaterThan(0);
        expect(recommendations.minimum).toBeLessThanOrEqual(recommendations.recommended);
        expect(recommendations.maximum).toBeGreaterThanOrEqual(recommendations.recommended);
      });
    });
  });
});
