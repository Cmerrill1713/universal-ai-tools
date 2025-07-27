import React, { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { vi } from 'vitest'

interface AllTheProvidersProps {
  children: React.ReactNode
}

// Add all your providers here
const AllTheProviders = ({ children }: AllTheProvidersProps) => {
  return (
    <BrowserRouter>
      {children}
    </BrowserRouter>
  )
}

// Helper to create WebSocket mock
export const createMockWebSocket = () => ({
  isConnected: true,
  lastMessage: null,
  error: null,
  sendMessage: vi.fn(),
  disconnect: vi.fn(),
  reconnect: vi.fn()
})

// Theme provider for Spectrum
export const theme = {
  colorScheme: 'dark' as const
}

// Create wrapper with all providers
export const createWrapper = () => AllTheProviders

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options })

// Re-export everything
export * from '@testing-library/react'
export { customRender as render }

// Mock WebSocket for tests
export const mockWebSocket = {
  isConnected: true,
  lastMessage: null,
  error: null,
  sendMessage: vi.fn(),
  disconnect: vi.fn(),
  reconnect: vi.fn()
}

// Additional mock exports for tests
export const mockApiResponse = (data: any) => ({
  ok: true,
  json: async () => data,
});

export const resetMocks = () => {
  vi.clearAllMocks();
};

export const mockChatMessage = {
  id: '1',
  role: 'assistant' as const,
  content: 'Test message',
  timestamp: new Date(),
};

export const mockSystemStats = {
  totalMemories: 100,
  totalAgents: 5,
  activeConnections: 2,
  systemHealth: 'healthy' as const,
};

export const mockMemoryItem = {
  id: '1',
  content: 'Test memory',
  importance: 0.8,
  timestamp: new Date(),
  tags: ['test'],
};

// Mock API responses
export const mockApiResponses = {
  agents: [
    {
      id: 'agent-1',
      name: 'Test Agent',
      type: 'cognitive',
      status: 'active',
      capabilities: ['test'],
      lastActive: new Date().toISOString()
    }
  ],
  memories: [
    {
      id: 'memory-1',
      content: 'Test memory',
      metadata: { tags: ['test'] },
      timestamp: new Date().toISOString()
    }
  ],
  tasks: [
    {
      id: 'task-1',
      name: 'Test Task',
      description: 'Test task description',
      status: 'pending',
      agentId: 'agent-1',
      agentName: 'Test Agent'
    }
  ]
}