import { render, RenderOptions } from '@testing-library/react';
import { ReactElement, ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';

// Test wrapper with all necessary providers
const AllTheProviders = ({ children }: { children: ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  );
};

// Custom render function that includes providers
const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options });

// Mock data factories
export const mockSystemStats = {
  success: true,
  stats: {
    activeAgents: 5,
    messagestoday: 247,
    totalMemories: 1543,
    cpuUsage: { percent: 45 },
    memoryUsage: { percent: 62 },
    uptime: 86400,
    typeBreakdown: {
      'semantic': 654,
      'episodic': 432,
      'procedural': 287,
      'working': 170,
    },
  },
};

export const mockMemoryItem = {
  id: 'test-memory-1',
  content: 'Test memory content',
  memory_type: 'semantic',
  importance_score: 0.8,
  tags: ['test', 'mock'],
  created_at: '2024-01-01T00:00:00Z',
  metadata: {},
  access_count: 1,
  last_accessed: '2024-01-01T00:00:00Z',
  services_accessed: ['test-service'],
};

export const mockAgentItem = {
  id: 'test-agent-1',
  name: 'Test Agent',
  description: 'A test agent for unit testing',
  capabilities: ['test', 'mock', 'automation'],
  instructions: 'Test instructions',
  model: 'test-model',
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
};

export const mockChatMessage = {
  id: 'test-message-1',
  role: 'user' as const,
  content: 'Test message content',
  timestamp: new Date('2024-01-01T00:00:00Z'),
  model: 'test-model',
};

// Mock API responses
export const mockApiResponse = <T,>(data: T) => ({
  ok: true,
  json: () => Promise.resolve(data),
  status: 200,
  statusText: 'OK',
});

// Mock fetch implementation
export const mockFetch = (response: any) => {
  global.fetch = vi.fn().mockResolvedValue(mockApiResponse(response));
};

// Reset mocks helper
export const resetMocks = () => {
  vi.clearAllMocks();
  (global.fetch as any)?.mockClear?.();
};

// Wait for async operations
export const waitForAsyncOperations = () => new Promise(resolve => setTimeout(resolve, 0));

// re-export everything
export * from '@testing-library/react';
export { customRender as render };