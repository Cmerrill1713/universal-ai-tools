import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Provider, defaultTheme } from '@adobe/react-spectrum';
import '@testing-library/jest-dom';

// Import components to test
import App from '../App';
import { Navigation } from '../components/Navigation/Navigation';
import { MessageBubble } from '../components/Chat/MessageBubble';
import { ChatInput } from '../components/Chat/ChatInput';
import ChatEnhanced from '../pages/ChatEnhanced';

// Mock API
jest.mock('../lib/api-enhanced', () => ({
  api: {
    health: jest.fn().mockResolvedValue({ status: 'ok' }),
    sendMessage: jest.fn().mockResolvedValue({
      message: 'Test response',
      conversationId: 'test-123'
    }),
    getChatHistory: jest.fn().mockResolvedValue({ messages: [] }),
    getAgents: jest.fn().mockResolvedValue([])
  }
}));

// Helper to render with providers
const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <Provider theme={defaultTheme}>
      <BrowserRouter>
        {component}
      </BrowserRouter>
    </Provider>
  );
};

describe('Universal AI Tools - Integration Tests', () => {
  describe('App Component', () => {
    test('renders without crashing', () => {
      renderWithProviders(<App />);
      expect(screen.getByText(/Universal AI Tools/i)).toBeInTheDocument();
    });
  });

  describe('Navigation Component', () => {
    test('renders all navigation items', () => {
      renderWithProviders(<Navigation />);
      
      expect(screen.getByText('Chat')).toBeInTheDocument();
      expect(screen.getByText('Task Execution')).toBeInTheDocument();
      expect(screen.getByText('Agent Activity')).toBeInTheDocument();
      expect(screen.getByText('Performance')).toBeInTheDocument();
    });

    test('shows active state for current route', () => {
      renderWithProviders(<Navigation />);
      const chatLink = screen.getByText('Chat').closest('a');
      expect(chatLink).toHaveClass('text-blue-400');
    });
  });

  describe('Chat Components', () => {
    test('MessageBubble renders user message correctly', () => {
      render(
        <MessageBubble
          role="user"
          content="Hello, world!"
          timestamp={new Date()}
        />
      );
      
      expect(screen.getByText('Hello, world!')).toBeInTheDocument();
    });

    test('MessageBubble renders assistant message with code', () => {
      render(
        <MessageBubble
          role="assistant"
          content="Here's some code:"
          code="console.log('test')"
          codeLanguage="javascript"
          timestamp={new Date()}
        />
      );
      
      expect(screen.getByText("Here's some code:")).toBeInTheDocument();
      expect(screen.getByText("console.log('test')")).toBeInTheDocument();
    });

    test('ChatInput handles text input', () => {
      const handleChange = jest.fn();
      const handleSend = jest.fn();
      
      render(
        <ChatInput
          value=""
          onChange={handleChange}
          onSend={handleSend}
        />
      );
      
      const input = screen.getByPlaceholderText('Type your message...');
      fireEvent.change(input, { target: { value: 'Test message' } });
      
      expect(handleChange).toHaveBeenCalledWith('Test message');
    });

    test('ChatInput send button is disabled when empty', () => {
      render(
        <ChatInput
          value=""
          onChange={() => {}}
          onSend={() => {}}
        />
      );
      
      const sendButton = screen.getByRole('button', { name: /send/i });
      expect(sendButton).toBeDisabled();
    });
  });

  describe('ChatEnhanced Page', () => {
    test('renders initial empty state', async () => {
      renderWithProviders(<ChatEnhanced />);
      
      await waitFor(() => {
        expect(screen.getByText('Start a conversation')).toBeInTheDocument();
      });
    });

    test('shows connection status', async () => {
      renderWithProviders(<ChatEnhanced />);
      
      await waitFor(() => {
        expect(screen.getByText(/Connected|Connecting/i)).toBeInTheDocument();
      });
    });

    test('displays suggested prompts', async () => {
      renderWithProviders(<ChatEnhanced />);
      
      await waitFor(() => {
        expect(screen.getByText('Build a React component')).toBeInTheDocument();
        expect(screen.getByText('How do AI agents work?')).toBeInTheDocument();
      });
    });
  });

  describe('API Integration', () => {
    test('health check is called on mount', async () => {
      const { api } = require('../lib/api-enhanced');
      renderWithProviders(<ChatEnhanced />);
      
      await waitFor(() => {
        expect(api.health).toHaveBeenCalled();
      });
    });
  });

  describe('Responsive Design', () => {
    test('navigation adapts to mobile view', () => {
      // Set viewport to mobile size
      global.innerWidth = 375;
      global.dispatchEvent(new Event('resize'));
      
      renderWithProviders(<Navigation />);
      // Add assertions for mobile view
    });
  });

  describe('Accessibility', () => {
    test('all interactive elements have accessible labels', () => {
      renderWithProviders(<App />);
      
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toHaveAccessibleName();
      });
    });

    test('navigation links are keyboard accessible', () => {
      renderWithProviders(<Navigation />);
      
      const links = screen.getAllByRole('link');
      links.forEach(link => {
        expect(link).toHaveAttribute('href');
      });
    });
  });
});

// Performance tests
describe('Performance', () => {
  test('renders large message list efficiently', () => {
    const messages = Array.from({ length: 100 }, (_, i) => ({
      id: i.toString(),
      role: i % 2 === 0 ? 'user' : 'assistant' as const,
      content: `Message ${i}`,
      timestamp: new Date()
    }));

    const start = performance.now();
    
    messages.forEach(msg => {
      render(<MessageBubble {...msg} />);
    });
    
    const end = performance.now();
    expect(end - start).toBeLessThan(1000); // Should render in less than 1 second
  });
});