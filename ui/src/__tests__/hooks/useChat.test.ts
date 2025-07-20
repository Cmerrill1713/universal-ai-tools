import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { useChat } from '../../hooks/useChat';
import { chatApi } from '../../lib/api';
import { useStore, useConversationStore } from '../../store';
import { useSystemStatus } from '../../hooks/useSystemStatus';

// Mock the dependencies
vi.mock('../../lib/api', () => ({
  chatApi: {
    sendMessage: vi.fn(),
    getConversationHistory: vi.fn(),
  },
}));

vi.mock('../../store', () => ({
  useStore: vi.fn(),
  useConversationStore: vi.fn(),
}));

vi.mock('../../hooks/useSystemStatus', () => ({
  useSystemStatus: vi.fn(),
}));

const mockStore = {
  preferences: {
    defaultModel: 'llama3.2:1b',
    autoScroll: true,
    voiceEnabled: false,
    messageFormat: 'markdown' as const,
  },
  setGlobalError: vi.fn(),
  clearGlobalError: vi.fn(),
  activeConversationId: null,
  setActiveConversationId: vi.fn(),
};

const mockConversationStore = {
  addConversation: vi.fn(),
  updateConversation: vi.fn(),
};

const mockSystemStatus = {
  isOllamaConnected: true,
  availableModels: ['llama3.2:1b', 'llama3.2:3b', 'phi3:mini'],
};

// Test wrapper with QueryClient
const createWrapper = () => {
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

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('useChat Hook', () => {
  beforeEach(() => {
    vi.mocked(useStore).mockReturnValue(mockStore);
    vi.mocked(useConversationStore).mockReturnValue(mockConversationStore);
    vi.mocked(useSystemStatus).mockReturnValue(mockSystemStatus);
    vi.mocked(chatApi.getConversationHistory).mockResolvedValue([]);
    vi.mocked(chatApi.sendMessage).mockResolvedValue({
      response: 'Test response',
      model: 'llama3.2:1b',
      timestamp: new Date().toISOString(),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with default values', () => {
    const { result } = renderHook(() => useChat(), {
      wrapper: createWrapper(),
    });

    expect(result.current.messages).toEqual([]);
    expect(result.current.input).toBe('');
    expect(result.current.selectedModel).toBe('llama3.2:1b');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isLoadingHistory).toBe(false);
    expect(result.current.copySuccess).toBeNull();
    expect(result.current.isSystemReady).toBe(true);
    expect(result.current.availableModels).toEqual(['llama3.2:1b', 'llama3.2:3b', 'phi3:mini']);
  });

  it('generates conversation ID when autoGenerateId is true', () => {
    const { result } = renderHook(() => useChat({ autoGenerateId: true }), {
      wrapper: createWrapper(),
    });

    expect(result.current.conversationId).toMatch(/^chat-\d+$/);
  });

  it('uses provided conversation ID', () => {
    const { result } = renderHook(() => useChat({ conversationId: 'test-conversation' }), {
      wrapper: createWrapper(),
    });

    expect(result.current.conversationId).toBe('test-conversation');
  });

  it('loads conversation history on mount', async () => {
    const mockHistory = [
      {
        id: '1',
        role: 'user' as const,
        content: 'Hello',
        timestamp: '2024-01-01T10:00:00Z',
      },
      {
        id: '2',
        role: 'assistant' as const,
        content: 'Hi there!',
        timestamp: '2024-01-01T10:00:05Z',
        model: 'llama3.2:1b',
      },
    ];

    vi.mocked(chatApi.getConversationHistory).mockResolvedValue(mockHistory);

    const { result } = renderHook(() => useChat({ conversationId: 'test-conversation' }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages[0].content).toBe('Hello');
      expect(result.current.messages[1].content).toBe('Hi there!');
    });
  });

  it('handles sendMessage successfully', async () => {
    const { result } = renderHook(() => useChat({ conversationId: 'test-conversation' }), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.setInput('Test message');
    });

    await act(async () => {
      await result.current.sendMessage();
    });

    await waitFor(() => {
      expect(chatApi.sendMessage).toHaveBeenCalledWith(
        'Test message',
        'llama3.2:1b',
        'test-conversation'
      );
      expect(result.current.messages).toHaveLength(2); // User message + AI response
      expect(result.current.input).toBe(''); // Input should be cleared
    });
  });

  it('handles sendMessage with custom text', async () => {
    const { result } = renderHook(() => useChat({ conversationId: 'test-conversation' }), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.sendMessage('Custom message');
    });

    await waitFor(() => {
      expect(chatApi.sendMessage).toHaveBeenCalledWith(
        'Custom message',
        'llama3.2:1b',
        'test-conversation'
      );
    });
  });

  it('prevents sending message when Ollama is disconnected', async () => {
    vi.mocked(useSystemStatus).mockReturnValue({
      ...mockSystemStatus,
      isOllamaConnected: false,
    });

    const { result } = renderHook(() => useChat({ conversationId: 'test-conversation' }), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.setInput('Test message');
    });

    await act(async () => {
      await result.current.sendMessage();
    });

    expect(chatApi.sendMessage).not.toHaveBeenCalled();
    expect(mockStore.setGlobalError).toHaveBeenCalledWith({
      message: 'Ollama service is not available. Please ensure it is running.',
      type: 'error',
      timestamp: expect.any(Date),
    });
  });

  it('prevents sending empty messages', async () => {
    const { result } = renderHook(() => useChat({ conversationId: 'test-conversation' }), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.setInput('   '); // Only whitespace
    });

    await act(async () => {
      await result.current.sendMessage();
    });

    expect(chatApi.sendMessage).not.toHaveBeenCalled();
  });

  it('prevents sending message when already loading', async () => {
    // Mock a slow API call
    vi.mocked(chatApi.sendMessage).mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({
        response: 'Response',
        model: 'llama3.2:1b',
        timestamp: new Date().toISOString(),
      }), 100))
    );

    const { result } = renderHook(() => useChat({ conversationId: 'test-conversation' }), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.setInput('First message');
    });

    // Start first message
    act(() => {
      result.current.sendMessage();
    });

    // Try to send second message while first is loading
    await act(async () => {
      result.current.setInput('Second message');
      await result.current.sendMessage();
    });

    expect(chatApi.sendMessage).toHaveBeenCalledTimes(1);
  });

  it('handles API errors gracefully', async () => {
    vi.mocked(chatApi.sendMessage).mockRejectedValue(new Error('API Error'));

    const { result } = renderHook(() => useChat({ conversationId: 'test-conversation' }), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.setInput('Test message');
    });

    await act(async () => {
      await result.current.sendMessage();
    });

    await waitFor(() => {
      expect(mockStore.setGlobalError).toHaveBeenCalledWith({
        message: 'API Error',
        type: 'error',
        timestamp: expect.any(Date),
      });
      
      // Should add error message to chat
      const lastMessage = result.current.messages[result.current.messages.length - 1];
      expect(lastMessage.content).toContain('❌ Error: API Error');
    });
  });

  it('clears conversation correctly', async () => {
    // Start with some messages
    const mockHistory = [
      {
        id: '1',
        role: 'user' as const,
        content: 'Hello',
        timestamp: '2024-01-01T10:00:00Z',
      },
    ];

    vi.mocked(chatApi.getConversationHistory).mockResolvedValue(mockHistory);

    const { result } = renderHook(() => useChat({ conversationId: 'test-conversation' }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(1);
    });

    await act(async () => {
      result.current.clearConversation();
    });

    expect(result.current.messages).toHaveLength(0);
    expect(mockStore.clearGlobalError).toHaveBeenCalled();
  });

  it('handles copy to clipboard successfully', async () => {
    // Mock clipboard API
    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: mockWriteText,
      },
    });

    const { result } = renderHook(() => useChat(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.copyToClipboard('Test text', 'message-1');
    });

    expect(mockWriteText).toHaveBeenCalledWith('Test text');
    expect(result.current.copySuccess).toBe('message-1');

    // Should clear copy success after 2 seconds
    await waitFor(() => {
      expect(result.current.copySuccess).toBeNull();
    }, { timeout: 2500 });
  });

  it('handles copy to clipboard failure', async () => {
    // Mock clipboard API failure
    const mockWriteText = vi.fn().mockRejectedValue(new Error('Clipboard error'));
    Object.assign(navigator, {
      clipboard: {
        writeText: mockWriteText,
      },
    });

    const { result } = renderHook(() => useChat(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.copyToClipboard('Test text', 'message-1');
    });

    expect(mockStore.setGlobalError).toHaveBeenCalledWith({
      message: 'Failed to copy text to clipboard',
      type: 'warning',
      timestamp: expect.any(Date),
    });
  });

  it('handles retry last message', async () => {
    const { result } = renderHook(() => useChat({ conversationId: 'test-conversation' }), {
      wrapper: createWrapper(),
    });

    // Add a user message first
    await act(async () => {
      result.current.setInput('First message');
    });

    await act(async () => {
      await result.current.sendMessage();
    });

    // Clear the mock to track retry call
    vi.mocked(chatApi.sendMessage).mockClear();

    await act(async () => {
      result.current.retryLastMessage();
    });

    await waitFor(() => {
      expect(chatApi.sendMessage).toHaveBeenCalledWith(
        'First message',
        'llama3.2:1b',
        'test-conversation'
      );
    });
  });

  it('handles retry when no user messages exist', async () => {
    const { result } = renderHook(() => useChat({ conversationId: 'test-conversation' }), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.retryLastMessage();
    });

    expect(chatApi.sendMessage).not.toHaveBeenCalled();
  });

  it('updates selected model', async () => {
    const { result } = renderHook(() => useChat(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.setSelectedModel('phi3:mini');
    });

    expect(result.current.selectedModel).toBe('phi3:mini');
  });

  it('updates input text', async () => {
    const { result } = renderHook(() => useChat(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.setInput('New input text');
    });

    expect(result.current.input).toBe('New input text');
  });

  it('updates conversation metadata on successful send', async () => {
    const { result } = renderHook(() => useChat({ conversationId: 'test-conversation' }), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.setInput('Test message');
    });

    await act(async () => {
      await result.current.sendMessage();
    });

    await waitFor(() => {
      expect(mockConversationStore.updateConversation).toHaveBeenCalledWith(
        'test-conversation',
        expect.objectContaining({
          lastActivity: expect.any(Date),
          messageCount: expect.any(Number),
          model: 'llama3.2:1b',
        })
      );
    });
  });

  it('adds conversation when sending first message', async () => {
    const { result } = renderHook(() => useChat({ conversationId: 'new-conversation' }), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.setInput('First message');
    });

    await act(async () => {
      await result.current.sendMessage();
    });

    await waitFor(() => {
      expect(mockConversationStore.addConversation).toHaveBeenCalledWith({
        id: 'new-conversation',
        title: 'First message',
        model: 'llama3.2:1b',
      });
    });
  });

  it('truncates long conversation title', async () => {
    const longMessage = 'a'.repeat(100);
    
    const { result } = renderHook(() => useChat({ conversationId: 'new-conversation' }), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.setInput(longMessage);
    });

    await act(async () => {
      await result.current.sendMessage();
    });

    await waitFor(() => {
      expect(mockConversationStore.addConversation).toHaveBeenCalledWith({
        id: 'new-conversation',
        title: 'a'.repeat(50) + '...',
        model: 'llama3.2:1b',
      });
    });
  });

  it('sets active conversation ID', async () => {
    const { result } = renderHook(() => useChat({ conversationId: 'test-conversation' }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(mockStore.setActiveConversationId).toHaveBeenCalledWith('test-conversation');
    });
  });

  it('updates from store preferences', async () => {
    const updatedStore = {
      ...mockStore,
      preferences: {
        ...mockStore.preferences,
        defaultModel: 'phi3:mini',
      },
    };

    const { rerender } = renderHook(() => useChat(), {
      wrapper: createWrapper(),
    });

    vi.mocked(useStore).mockReturnValue(updatedStore);
    
    rerender();

    await waitFor(() => {
      expect(renderedHook.result.current.selectedModel).toBe('phi3:mini');
    });
  });

  it('handles conversation history loading errors gracefully', async () => {
    vi.mocked(chatApi.getConversationHistory).mockRejectedValue(new Error('History error'));

    const { result } = renderHook(() => useChat({ conversationId: 'test-conversation' }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.messages).toEqual([]);
      expect(result.current.isLoadingHistory).toBe(false);
    });
  });

  it('provides system ready status based on Ollama connection', async () => {
    const { result: connectedResult } = renderHook(() => useChat(), {
      wrapper: createWrapper(),
    });

    expect(connectedResult.current.isSystemReady).toBe(true);

    vi.mocked(useSystemStatus).mockReturnValue({
      ...mockSystemStatus,
      isOllamaConnected: false,
    });

    const { result: disconnectedResult } = renderHook(() => useChat(), {
      wrapper: createWrapper(),
    });

    expect(disconnectedResult.current.isSystemReady).toBe(false);
  });
});