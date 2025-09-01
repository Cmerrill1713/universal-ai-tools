import { vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';

// Mock Supabase client for testing
export function createSupabaseClient() {
  return {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      match: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: {}, error: null }),
      then: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      signInWithPassword: vi.fn().mockResolvedValue({ data: { user: {} }, error: null }),
    },
  };
}

// Mock Redis client for testing
export function createRedisClient() {
  const mockRedis = {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    exists: vi.fn().mockResolvedValue(0),
    expire: vi.fn().mockResolvedValue(1),
    flushall: vi.fn().mockResolvedValue('OK'),
    quit: vi.fn().mockResolvedValue('OK'),
  };
  
  return mockRedis;
}

// Test data generators
export const testData = {
  agent: {
    valid: () => ({
      name: 'Test Agent',
      type: 'cognitive',
      description: 'Test agent for unit testing',
      capabilities: ['reasoning', 'analysis'],
      model: 'ollama:llama3.2:3b',
      config: {
        temperature: 0.7,
        maxTokens: 1000,
      },
    }),
    
    invalid: () => ({
      name: '', // Invalid empty name
      type: 'invalid-type',
      description: 'Test',
    }),
  },

  memory: {
    valid: () => ({
      content: 'Test memory content for unit testing',
      type: 'conversation',
      metadata: {
        userId: 'test-user',
        timestamp: new Date().toISOString(),
        tags: ['test', 'unit-testing'],
      },
      embedding: Array.from({ length: 384 }, () => Math.random()),
    }),
    
    search: () => ({
      query: 'JavaScript programming',
      limit: 10,
      threshold: 0.7,
      filters: {
        type: 'knowledge',
        tags: ['programming'],
      },
    }),
  },

  vision: {
    testImage: () => ({
      // Base64 encoded 1x1 pixel PNG for testing
      data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
      options: {
        includeObjects: true,
        includeText: true,
        confidence: 0.5,
      },
    }),
    
    enhancement: () => ({
      image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
      options: {
        strength: 0.3,
        steps: 20,
        guidance: 7.5,
        backend: 'mlx',
      },
    }),
  },

  mlx: {
    fineTuning: () => ({
      baseModel: 'llama3.2:3b',
      trainingData: 'test-dataset.jsonl',
      optimization: 'lora',
      epochs: 5,
      learningRate: 0.0001,
      batchSize: 4,
      rankSize: 8,
      alphaRatio: 16,
    }),
    
    model: () => ({
      id: 'test-model-123',
      name: 'Llama 3.2 3B Instruct',
      size: '3B',
      quantization: '4bit',
      status: 'ready',
      path: '/models/llama3.2-3b-instruct',
    }),
  },

  parameters: {
    optimization: () => ({
      task: 'code_generation',
      model: 'ollama:llama3.2:3b',
      context: {
        language: 'typescript',
        complexity: 'medium',
        domain: 'web-development',
      },
      goals: ['accuracy', 'speed'],
      constraints: {
        maxTokens: 2000,
        timeout: 30,
      },
    }),
  },
};

// Mock HTTP responses
export const mockResponses = {
  success: (data: any) => ({
    success: true,
    data,
    timestamp: new Date().toISOString(),
  }),

  error: (message: string, code: string = 'GENERIC_ERROR') => ({
    success: false,
    error: message,
    code,
    timestamp: new Date().toISOString(),
  }),

  healthCheck: () => ({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: 'connected',
      redis: 'connected',
      llm: 'connected',
    },
    uptime: Math.floor(Math.random() * 10000),
  }),
};

// Test environment setup
export function setupTestEnvironment() {
  // Mock environment variables
  process.env.NODE_ENV = 'test';
  process.env.SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'test-anon-key';
  process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
  process.env.JWT_SECRET = 'test-jwt-secret';
  process.env.REDIS_URL = 'redis://localhost:6379';
  
  // Mock console methods to reduce noise in tests
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
}

// Cleanup test environment
export function cleanupTestEnvironment() {
  vi.restoreAllMocks();
  vi.clearAllMocks();
}

// Test database operations
export class TestDatabase {
  private supabase: any;

  constructor() {
    this.supabase = createSupabaseClient();
  }

  async createTestAgent(overrides: Partial<any> = {}) {
    const agent = { ...testData.agent.valid(), ...overrides };
    
    this.supabase.from.mockReturnValueOnce({
      insert: vi.fn().mockResolvedValue({
        data: { id: 'test-agent-123', ...agent },
        error: null,
      }),
    });

    return this.supabase.from('agents').insert(agent);
  }

  async createTestMemory(overrides: Partial<any> = {}) {
    const memory = { ...testData.memory.valid(), ...overrides };
    
    this.supabase.from.mockReturnValueOnce({
      insert: vi.fn().mockResolvedValue({
        data: { id: 'test-memory-123', ...memory },
        error: null,
      }),
    });

    return this.supabase.from('ai_memories').insert(memory);
  }

  async cleanup() {
    // Clean up all test data
    const tables = ['agents', 'ai_memories', 'mlx_fine_tuning_jobs', 'parameter_analytics'];
    
    for (const table of tables) {
      this.supabase.from.mockReturnValueOnce({
        delete: vi.fn().mockResolvedValue({ data: null, error: null }),
      });
      
      await this.supabase.from(table).delete().like('id', 'test-%');
    }
  }
}

// Performance testing utilities
export class PerformanceTracker {
  private startTime: number = 0;
  private measurements: Array<{ name: string; duration: number }> = [];

  start() {
    this.startTime = performance.now();
  }

  measure(name: string) {
    const duration = performance.now() - this.startTime;
    this.measurements.push({ name, duration });
    return duration;
  }

  getResults() {
    return {
      measurements: this.measurements,
      total: this.measurements.reduce((sum, m) => sum + m.duration, 0),
      average: this.measurements.length > 0 
        ? this.measurements.reduce((sum, m) => sum + m.duration, 0) / this.measurements.length 
        : 0,
    };
  }

  clear() {
    this.measurements = [];
    this.startTime = 0;
  }
}

// API testing utilities
export class ApiTester {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:9999') {
    this.baseUrl = baseUrl;
  }

  async testEndpoint(endpoint: string, options: any = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const defaultOptions = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const finalOptions = { ...defaultOptions, ...options };
    
    if (finalOptions.body && typeof finalOptions.body === 'object') {
      finalOptions.body = JSON.stringify(finalOptions.body);
    }

    const startTime = performance.now();
    
    try {
      const response = await fetch(url, finalOptions);
      const duration = performance.now() - startTime;
      const data = await response.json();

      return {
        success: response.ok,
        status: response.status,
        data,
        duration,
      };
    } catch (error) {
      const duration = performance.now() - startTime;
      
      return {
        success: false,
        status: 0,
        error: error instanceof Error ? error.message : String(error),
        duration,
      };
    }
  }
}

export default {
  createSupabaseClient,
  createRedisClient,
  testData,
  mockResponses,
  setupTestEnvironment,
  cleanupTestEnvironment,
  TestDatabase,
  PerformanceTracker,
  ApiTester,
};