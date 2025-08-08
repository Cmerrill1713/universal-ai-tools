import express from 'express';
import request from 'supertest';

// Bypass auth in tests
jest.mock('../../src/middleware/auth', () => ({
  authenticate: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

// Mock semantic retrieval to return deterministic context
jest.mock('../../src/services/semantic-context-retrieval', () => ({
  semanticContextRetrievalService: {
    semanticSearch: jest.fn(async () => ({
      results: [
        {
          id: 'ctx1',
          content: 'Project priorities: Phase 1 infrastructure, Phase 2 implementations',
          contentType: 'summary',
          source: 'context_storage',
          relevanceScore: 0.9,
          semanticScore: 0.9,
          temporalScore: 0.9,
          contextScore: 0.8,
          combinedScore: 0.87,
          metadata: {
            timestamp: new Date(),
            userId: 'test-user',
            tags: ['priorities'],
            topics: ['infrastructure'],
            wordCount: 8,
            tokenCount: 16,
          },
        },
      ],
      clusters: { clusters: [], outliers: [], totalResults: 1 },
      metrics: {
        searchTimeMs: 5,
        totalResults: 1,
        clusteredResults: 1,
        averageRelevance: 0.87,
        topicCoverage: 1,
        embeddingComputeTime: 1,
        databaseQueryTime: 1,
      },
    })),
  },
}));

// Mock context storage persistence
jest.mock('../../src/services/context-storage-service', () => ({
  contextStorageService: {
    storeConversation: jest.fn(async () => 'mock-context-id'),
  },
}));

// Helper to dynamically mock ollama service per test
const mockOllama = (shouldFail = false) => {
  jest.resetModules();
  jest.doMock('../../src/services/ollama-service', () => ({
    ollamaService: {
      generateResponse: shouldFail
        ? jest.fn(async () => {
            throw new Error('LLM unavailable');
          })
        : jest.fn(async () => ({
            model: 'test-model',
            created_at: new Date().toISOString(),
            message: { role: 'assistant', content: 'Mock LLM response' },
            done: true,
          })),
    },
  }));
};

describe('Assistant API - /api/v1/assistant/chat', () => {
  const buildApp = async () => {
    const app = express();
    app.use(express.json());
    const router = (await import('../../src/routers/assistant')).default;
    app.use('/api/v1/assistant', router);
    return app;
  };

  test('returns success with model response when LLM is available', async () => {
    mockOllama(false);
    const app = await buildApp();

    const res = await request(app)
      .post('/api/v1/assistant/chat')
      .send({ message: 'Smoke test: summarize project priorities' })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.response).toContain('Mock LLM response');
    expect(typeof res.body.metadata.requestId).toBe('string');
  });

  test('returns success with fallback when LLM is unavailable', async () => {
    mockOllama(true);
    const app = await buildApp();

    const res = await request(app)
      .post('/api/v1/assistant/chat')
      .send({ message: 'Smoke test: resilience path' })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.response).toMatch(/Assistant is initializing|try again/);
    expect(res.body.data.conversationStored).toBe(true);
  });
});
