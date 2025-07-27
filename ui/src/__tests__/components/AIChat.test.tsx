import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import AIChat from '../../pages/AIChat';
import { render, mockChatMessage, resetMocks } from '../../test/utils';

// Mock the hooks
vi.mock('../../hooks/useChat', () => ({
  useChat: vi.fn(),
}));

vi.mock('../../hooks/useSystemStatus', () => ({
  useSystemStatus: vi.fn(),
}));

vi.mock('../../store', () => ({
  useStore: vi.fn(),
}));

import { useChat } from '../../hooks/useChat';
import { useSystemStatus } from '../../hooks/useSystemStatus';
import { useStore } from '../../store';

// Mock icon components to avoid rendering issues
vi.mock('lucide-react', () => ({
  Send: ({ className }: any) => <div data-testid="send-icon" className={className} />,
  Bot: ({ className }: any) => <div data-testid="bot-icon" className={className} />,
  User: ({ className }: any) => <div data-testid="user-icon" className={className} />,
  Loader2: ({ className }: any) => <div data-testid="loader-icon" className={className} />,
  Settings2: ({ className }: any) => <div data-testid="settings-icon" className={className} />,
  RefreshCw: ({ className }: any) => <div data-testid="refresh-icon" className={className} />,
  Trash2: ({ className }: any) => <div data-testid="trash-icon" className={className} />,
  Copy: ({ className }: any) => <div data-testid="copy-icon" className={className} />,
  AlertCircle: ({ className }: any) => <div data-testid="alert-icon" className={className} />,
  Check: ({ className }: any) => <div data-testid="check-icon" className={className} />,
}));

describe('AIChat Component', () => {
  const mockUseChat = {
    messages: [],
    input: '',
    setInput: vi.fn(),
    selectedModel: 'llama3.2:1b',
    setSelectedModel: vi.fn(),
    copySuccess: null,
    isLoading: false,
    isLoadingHistory: false,
    sendMessage: vi.fn(),
    clearConversation: vi.fn(),
    copyToClipboard: vi.fn(),
    retryLastMessage: vi.fn(),
    messagesEndRef: { current: null },
    isSystemReady: true,
  };

  const mockUseSystemStatus = {
    isBackendConnected: true,
    isOllamaConnected: true,
    availableModels: ['llama3.2:1b', 'llama3.2:3b', 'phi3:mini'],
    isCheckingOllama: false,
  };

  const mockUseStore = {
    globalError: null,
    clearGlobalError: vi.fn(),
  };

  beforeEach(() => {
    resetMocks();
    vi.mocked(useChat).mockReturnValue(mockUseChat);
    vi.mocked(useSystemStatus).mockReturnValue(mockUseSystemStatus);
    vi.mocked(useStore).mockReturnValue(mockUseStore);
  });

  it('renders without crashing', () => {
    render(<AIChat />);
    expect(screen.getByText('Neural Network Status')).toBeInTheDocument();
  });

  it('displays system status correctly when this.connected', () => {
    render(<AIChat />);
    
    expect(screen.getByText('Ready')).toBeInTheDocument();
    expect(screen.getByText('Online')).toBeInTheDocument();
    expect(screen.getAllByText('Online')).toHaveLength(2); // Backend and Ollama
    expect(screen.getByText('Connected')).toBeInTheDocument();
  });

  it('displays system status correctly when disconnected', () => {
    vi.mocked(useSystemStatus).mockReturnValue({
      ...mockUseSystemStatus,
      isBackendConnected: false,
      isOllamaConnected: false,
    });

    render(<AIChat />);
    
    expect(screen.getByText('Ready')).toBeInTheDocument();
    expect(screen.getAllByText('Offline')).toHaveLength(2); // Backend and Ollama
    expect(screen.getByText('Backend Error')).toBeInTheDocument();
  });

  it('displays loading state correctly', () => {
    vi.mocked(useChat).mockReturnValue({
      ...mockUseChat,
      isLoading: true,
    });

    render(<AIChat />);
    
    expect(screen.getByText('Processing')).toBeInTheDocument();
  });

  it('displays empty state when no messages', () => {
    render(<AIChat />);
    
    expect(screen.getByText('Start a conversation with AI')).toBeInTheDocument();
    expect(screen.getByText('Select a model and type your message')).toBeInTheDocument();
  });

  it('displays messages correctly', () => {
    const testMessages = [
      {
        ...mockChatMessage,
        role: 'user' as const,
        content: 'Hello AI',
      },
      {
        ...mockChatMessage,
        id: 'test-message-2',
        role: 'assistant' as const,
        content: 'Hello! How can I help you?',
      },
    ];

    vi.mocked(useChat).mockReturnValue({
      ...mockUseChat,
      messages: testMessages,
    });

    render(<AIChat />);
    
    expect(screen.getByText('Hello AI')).toBeInTheDocument();
    expect(screen.getByText('Hello! How can I help you?')).toBeInTheDocument();
  });

  it('handles input change correctly', async () => {
    render(<AIChat />);
    
    const input = screen.getByPlaceholderText(/Type your message/);
    fireEvent.change(input, { target: { value: 'Test message' } });
    
    expect(mockUseChat.setInput).toHaveBeenCalledWith('Test message');
  });

  it('handles send message on Enter key', async () => {
    vi.mocked(useChat).mockReturnValue({
      ...mockUseChat,
      input: 'Test message',
    });

    render(<AIChat />);
    
    const input = screen.getByPlaceholderText(/Type your message/);
    fireEvent.keyPress(input, { key: 'Enter', code: 'Enter' });
    
    expect(mockUseChat.sendMessage).toHaveBeenCalled();
  });

  it('prevents send when input is empty', async () => {
    render(<AIChat />);
    
    const sendButton = screen.getByTitle(/Send message/);
    expect(sendButton).toBeDisabled();
  });

  it('disables input when system is not ready', () => {
    vi.mocked(useChat).mockReturnValue({
      ...mockUseChat,
      isSystemReady: false,
    });

    render(<AIChat />);
    
    const input = screen.getByPlaceholderText(/System unavailable/);
    expect(input).toBeDisabled();
  });

  it('displays model selector with available models', () => {
    render(<AIChat />);
    
    // The Select component should be present
    expect(screen.getByDisplayValue('llama3.2:1b')).toBeInTheDocument();
  });

  it('handles clear conversation', async () => {
    const testMessages = [mockChatMessage];
    vi.mocked(useChat).mockReturnValue({
      ...mockUseChat,
      messages: testMessages,
    });

    render(<AIChat />);
    
    const clearButton = screen.getByTestId('trash-icon').closest('button');
    if (clearButton) {
      fireEvent.click(clearButton);
      expect(mockUseChat.clearConversation).toHaveBeenCalled();
    }
  });

  it('handles retry last message', async () => {
    const testMessages = [mockChatMessage];
    vi.mocked(useChat).mockReturnValue({
      ...mockUseChat,
      messages: testMessages,
    });

    render(<AIChat />);
    
    const retryButton = screen.getByTestId('refresh-icon').closest('button');
    if (retryButton) {
      fireEvent.click(retryButton);
      expect(mockUseChat.retryLastMessage).toHaveBeenCalled();
    }
  });

  it('displays global error when present', () => {
    vi.mocked(useStore).mockReturnValue({
      ...mockUseStore,
      globalError: {
        message: 'Test error message',
        type: 'error',
        timestamp: new Date(),
      },
    });

    render(<AIChat />);
    
    expect(screen.getByText('Test error message')).toBeInTheDocument();
  });

  it('handles copy message to clipboard', async () => {
    const testMessages = [
      {
        ...mockChatMessage,
        content: 'Message to copy',
      },
    ];
    vi.mocked(useChat).mockReturnValue({
      ...mockUseChat,
      messages: testMessages,
    });

    render(<AIChat />);
    
    // Hover over message to show copy button
    const messageContainer = screen.getByText('Message to copy').closest('.group');
    if (messageContainer) {
      fireEvent.mouseEnter(messageContainer);
      
      const copyButton = screen.getByTestId('copy-icon').closest('button');
      if (copyButton) {
        fireEvent.click(copyButton);
        expect(mockUseChat.copyToClipboard).toHaveBeenCalledWith('Message to copy', mockChatMessage.id);
      }
    }
  });

  it('displays copy success state', () => {
    const testMessages = [mockChatMessage];
    vi.mocked(useChat).mockReturnValue({
      ...mockUseChat,
      messages: testMessages,
      copySuccess: mockChatMessage.id,
    });

    render(<AIChat />);
    
    expect(screen.getByTestId('check-icon')).toBeInTheDocument();
  });

  it('displays backend offline message when backend is down', () => {
    vi.mocked(useSystemStatus).mockReturnValue({
      ...mockUseSystemStatus,
      isBackendConnected: false,
    });

    render(<AIChat />);
    
    expect(screen.getByText(/Backend service is unavailable/)).toBeInTheDocument();
  });

  it('displays Ollama offline message when Ollama is down', () => {
    vi.mocked(useSystemStatus).mockReturnValue({
      ...mockUseSystemStatus,
      isOllamaConnected: false,
    });

    render(<AIChat />);
    
    expect(screen.getByText(/Ollama is not available/)).toBeInTheDocument();
  });

  it('displays loading history message', () => {
    vi.mocked(useChat).mockReturnValue({
      ...mockUseChat,
      isLoadingHistory: true,
    });

    render(<AIChat />);
    
    expect(screen.getByText(/Loading conversation history/)).toBeInTheDocument();
  });

  it('handles long message warning', () => {
    const longInput = 'a'.repeat(1001);
    vi.mocked(useChat).mockReturnValue({
      ...mockUseChat,
      input: longInput,
    });

    render(<AIChat />);
    
    expect(screen.getByText(/Message is quite long/)).toBeInTheDocument();
  });

  it('renders code blocks correctly', () => {
    const messageWithCode = {
      ...mockChatMessage,
      content: 'Here is some code:\n```\nconsole.log("hello");\n```\nEnd of code.',
    };
    vi.mocked(useChat).mockReturnValue({
      ...mockUseChat,
      messages: [messageWithCode],
    });

    render(<AIChat />);
    
    expect(screen.getByText('console.log("hello");')).toBeInTheDocument();
  });
});