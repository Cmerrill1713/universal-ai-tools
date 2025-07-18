import { RetrieverAgent } from '../../../agents/cognitive/retriever_agent';
import { createMockMemory, mockSupabaseClient, waitFor } from '../../setup';

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => mockSupabaseClient,
}));

describe('RetrieverAgent', () => {
  let agent: RetrieverAgent;
  const mockContext = {
    requestId: 'test-retriever-123',
    userRequest: 'test request',
    timestamp: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    agent = new RetrieverAgent({
      name: 'Retriever Agent',
      description: 'Retrieves information from various sources',
      priority: 5,
      capabilities: [],
      maxLatencyMs: 2000,
      retryAttempts: 3,
      dependencies: [],
      memoryEnabled: true,
      category: 'cognitive',
      retrieverSettings: {
        maxConcurrentQueries: 5,
        defaultTimeout: 2000,
        cacheEnabled: true,
        cacheTTL: 300000,
        relevanceThreshold: 0.5,
        adaptiveLearning: true,
      },
    });
  });

  describe('query parsing', () => {
    it('should extract search query from input', async () => {
      const input = 'find information about machine learning algorithms';
      const response = await agent.processInput(input, mockContext);

      expect(response.success).toBe(true);
      expect(response.data.query).toBe('information about machine learning algorithms');
    });

    it('should handle quoted phrases as exact matches', async () => {
      const input = 'search for "neural networks" and "deep learning"';
      const response = await agent.processInput(input, mockContext);

      expect(response.data.query).toBe('neural networks deep learning');
    });

    it('should extract constraints from query', async () => {
      const input = 'find top 5 relevant documents about AI quickly';
      const response = await agent.processInput(input, mockContext);

      expect(response.data.items.length).toBeLessThanOrEqual(5);
      expect(response.metadata.retrievalMetrics.totalTime).toBeLessThan(1000);
    });
  });

  describe('retrieval strategies', () => {
    it('should use exact match strategy for quoted queries', async () => {
      const input = 'find "exact phrase match" in documents';
      const response = await agent.processInput(input, mockContext);

      expect(response.reasoning).toContain('exact_match');
    });

    it('should use semantic search for complex queries', async () => {
      const input = 'find comprehensive information about the relationship between quantum computing and cryptography';
      const response = await agent.processInput(input, mockContext);

      expect(response.reasoning).toContain('semantic');
    });

    it('should use parallel search for urgent queries', async () => {
      const input = 'urgently find quick results about emergency protocols';
      const response = await agent.processInput(input, mockContext);

      expect(response.reasoning).toContain('parallel');
    });

    it('should use adaptive search for exploratory queries', async () => {
      const input = 'explore and discover patterns in user behavior data';
      const response = await agent.processInput(input, mockContext);

      expect(response.reasoning).toContain('adaptive');
    });
  });

  describe('source management', () => {
    it('should prioritize sources by reliability', async () => {
      const input = 'find critical information about system configuration';
      const response = await agent.processInput(input, mockContext);

      expect(response.success).toBe(true);
      expect(response.reasoning).toContain('Sources searched');
      
      // Check that high-priority sources were used
      const sourcesUsed = response.data.items.map((item: any) => item.source);
      expect(sourcesUsed).toContain('Agent Memory System');
    });

    it('should filter sources based on constraints', async () => {
      const input = 'find data from memory source only';
      const response = await agent.processInput(input, mockContext);

      const sources = response.data.items.map((item: any) => item.source);
      const uniqueSources = [...new Set(sources)];
      
      expect(uniqueSources).toHaveLength(1);
      expect(uniqueSources[0]).toContain('Memory');
    });

    it('should register custom sources', () => {
      agent.registerSource({
        type: 'external_api',
        name: 'Custom API',
        priority: 2,
        reliability: 0.85,
        accessTime: 200,
        costFactor: 0.5,
      });

      const sources = agent['sources'];
      expect(sources.has('Custom API')).toBe(true);
    });
  });

  describe('result ranking and filtering', () => {
    it('should rank results by relevance', async () => {
      const input = 'find best practices for code optimization';
      const response = await agent.processInput(input, mockContext);

      const relevanceScores = response.data.items.map((item: any) => item.relevance);
      
      // Check that results are sorted in descending order
      for (let i = 1; i < relevanceScores.length; i++) {
        expect(relevanceScores[i - 1]).toBeGreaterThanOrEqual(relevanceScores[i]);
      }
    });

    it('should filter results by minimum relevance', async () => {
      const input = 'find highly relevant information about security protocols';
      const response = await agent.processInput(input, mockContext);

      const {items} = response.data;
      items.forEach((item: any) => {
        expect(item.relevance).toBeGreaterThanOrEqual(0.5);
      });
    });

    it('should limit results based on constraints', async () => {
      const input = 'find top 3 resources about databases';
      const response = await agent.processInput(input, mockContext);

      expect(response.data.items.length).toBeLessThanOrEqual(3);
    });
  });

  describe('caching', () => {
    it('should cache successful retrieval results', async () => {
      const input = 'find information about caching strategies';
      
      // First request
      const response1 = await agent.processInput(input, mockContext);
      expect(response1.metadata.retrievalMetrics.cacheHit).toBe(false);

      // Second identical request
      const response2 = await agent.processInput(input, mockContext);
      expect(response2.data.items).toEqual(response1.data.items);
    });

    it('should respect cache TTL', async () => {
      // Set short TTL for testing
      agent['config'].retrieverSettings!.cacheTTL = 100;

      const input = 'find data with short cache';
      await agent.processInput(input, mockContext);

      // Wait for cache to expire
      await waitFor(150);

      const response = await agent.processInput(input, mockContext);
      expect(response.metadata.retrievalMetrics.cacheHit).toBe(false);
    });

    it('should limit cache size', async () => {
      // Generate many unique queries to fill cache
      for (let i = 0; i < 150; i++) {
        await agent.processInput(`find unique query ${i}`, mockContext);
      }

      const cacheSize = agent['queryCache'].size;
      expect(cacheSize).toBeLessThanOrEqual(100);
    });
  });

  describe('performance optimization', () => {
    it('should track strategy performance metrics', async () => {
      // Execute multiple queries
      await agent.processInput('find "exact match"', mockContext);
      await agent.processInput('find complex semantic information', mockContext);
      await agent.processInput('urgent find quick data', mockContext);

      const report = agent.getPerformanceReport();
      
      expect(report.strategyPerformance).toBeDefined();
      expect(Object.keys(report.strategyPerformance).length).toBeGreaterThan(0);
    });

    it('should complete retrieval within timeout', async () => {
      const input = 'find information quickly within 500ms';
      const startTime = Date.now();
      
      const response = await agent.processInput(input, mockContext);
      const duration = Date.now() - startTime;

      expect(response.success).toBe(true);
      expect(duration).toBeLessThan(1000);
    });

    it('should handle concurrent queries efficiently', async () => {
      const queries = [
        'find data about topic 1',
        'search for topic 2',
        'retrieve information on topic 3',
      ];

      const promises = queries.map(q => agent.processInput(q, mockContext));
      const responses = await Promise.all(promises);

      expect(responses.every(r => r.success)).toBe(true);
    });
  });

  describe('adaptive search', () => {
    it('should expand query terms when few results found', async () => {
      // Mock limited initial results
      agent['searchSource'] = jest.fn()
        .mockResolvedValueOnce([]) // First search returns nothing
        .mockResolvedValueOnce([   // Expanded search returns results
          { id: '1', content: 'expanded result', relevance: 0.7 }
        ]);

      const input = 'find rare information';
      const response = await agent.processInput(input, mockContext);

      expect(response.success).toBe(true);
      expect(agent['searchSource']).toHaveBeenCalledTimes(2);
    });

    it('should adjust search depth based on initial results', async () => {
      const input = 'explore adaptive search patterns';
      const response = await agent.processInput(input, mockContext);

      expect(response.success).toBe(true);
      expect(response.reasoning).toContain('adaptive');
    });
  });

  describe('memory integration', () => {
    it('should store retrieval events in memory', async () => {
      const mockStoreEpisode = jest.spyOn(agent as any, 'storeEpisode');
      
      await agent.processInput('find test data', mockContext);

      expect(mockStoreEpisode).toHaveBeenCalled();
      const memoryCall = mockStoreEpisode.mock.calls[0][0] as any;
      expect(memoryCall.event).toBe('retrieval_completed');
    });

    it('should store high-relevance items as semantic memories', async () => {
      const mockStoreSemanticMemory = jest.spyOn(agent as any, 'storeSemanticMemory');
      
      // Create mock high-relevance results
      agent['searchSource'] = jest.fn().mockResolvedValue([
        { id: '1', content: 'highly relevant', relevance: 0.9 }
      ]);

      await agent.processInput('find important data', mockContext);

      expect(mockStoreSemanticMemory).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle search failures gracefully', async () => {
      agent['searchSource'] = jest.fn().mockRejectedValue(
        new Error('Search service unavailable')
      );

      const response = await agent.processInput('find data', mockContext);

      expect(response.success).toBe(false);
      expect(response.message).toContain('Failed to retrieve');
      expect(response.metadata.error).toBeDefined();
    });

    it('should handle invalid query formats', async () => {
      const response = await agent.processInput('', mockContext);

      expect(response.success).toBe(true); // Handles empty query
      expect(response.data.query).toBe('');
    });

    it('should recover from source failures', async () => {
      // Mock first source failing, second succeeding
      let callCount = 0;
      agent['searchSource'] = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Source unavailable');
        }
        return Promise.resolve([
          { id: '1', content: 'backup result', relevance: 0.7 }
        ]);
      });

      const response = await agent.processInput('find with fallback', mockContext);

      expect(response.success).toBe(true);
      expect(response.data.items.length).toBeGreaterThan(0);
    });
  });

  describe('complex queries', () => {
    it('should handle multi-constraint queries', async () => {
      const input = 'find top 10 recent documents about AI from knowledge base with high relevance';
      const response = await agent.processInput(input, mockContext);

      expect(response.success).toBe(true);
      expect(response.data.items.length).toBeLessThanOrEqual(10);
      expect(response.reasoning).toContain('knowledge');
    });

    it('should process natural language time constraints', async () => {
      const input = 'quickly find data within 2 seconds';
      const startTime = Date.now();
      
      const response = await agent.processInput(input, mockContext);
      const duration = Date.now() - startTime;

      expect(response.success).toBe(true);
      expect(duration).toBeLessThan(3000); // Allow some buffer
    });
  });

  describe('result formatting', () => {
    it('should provide comprehensive summaries', async () => {
      const response = await agent.processInput(
        'find diverse information from multiple sources',
        mockContext
      );

      expect(response.data.summary).toBeDefined();
      expect(response.data.summary).toContain('Retrieved');
      expect(response.data.summary).toContain('sources');
      expect(response.data.summary).toContain('Relevance range');
    });

    it('should include retrieval metadata', async () => {
      const response = await agent.processInput('find metadata test', mockContext);

      expect(response.metadata.retrievalMetrics).toBeDefined();
      expect(response.metadata.retrievalMetrics.totalTime).toBeGreaterThan(0);
      expect(response.metadata.retrievalMetrics.itemsRetrieved).toBeGreaterThanOrEqual(0);
      expect(response.metadata.retrievalMetrics.sourcesUsed).toBeGreaterThanOrEqual(0);
    });
  });
});