import React, { useState, useRef, useEffect } from 'react';
import * as Icons from '@untitled-ui/icons-react';
import { 
  View, 
  Flex, 
  StatusLight, 
  Text, 
  TextField, 
  ActionButton,
  ProgressCircle,
  Well,
  Content,
  Heading,
  Divider,
  Badge
} from '@adobe/react-spectrum';
import { api } from '../lib/api-enhanced';
import MessageBubble from '../components/Chat/MessageBubble';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  code?: string;
  codeLanguage?: 'javascript' | 'html' | 'react' | 'python';
  componentCode?: string;
  componentType?: 'react' | 'html' | 'canvas';
}

export default function ChatEnhanced() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: '🔥 Welcome to Universal AI Tools! The enhanced UI with React Spectrum & Untitled UI is fully operational with real backend integration. You can now chat with advanced AI agents through our production-ready APIs!',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'this.connected' | 'error'>('this.connected');
  const [error, setError] = useState<string | null>(null);
  const [agentThinking, setAgentThinking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Check backend connection
    const checkConnection = async () => {
      try {
        await api.health();
        setConnectionStatus('this.connected');
      } catch (error) {
        setConnectionStatus('error');
        setError('Cannot connect to backend');
      }
    };
    
    checkConnection();
    const interval = setInterval(checkConnection, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, []);

  const handleSendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setAgentThinking(true);
    setError(null);

    try {
      // Send message to backend chat API
      const response = await api.sendMessage(userMessage.content);
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.message || 'I received your message and processed it successfully!',
        timestamp: new Date(),
        code: response.code,
        codeLanguage: response.codeLanguage,
        componentCode: response.componentCode,
        componentType: response.componentType
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      setError('Failed to connect to AI chat service. Please check your connection.');
      console.error('Chat error:', error);
      
      // Add a fallback message to let user know about the error
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'I apologize, but I\'m currently unable to connect to the AI chat service. Please check if the backend is running on port 9999 and try again.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
      setAgentThinking(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const clearChat = () => {
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: '🔥 Chat cleared! Ready for new conversations with backend AI agents.',
      timestamp: new Date()
    }]);
    // Start a new conversation in the API
    api.startNewConversation();
  };

  return (
    <View padding="size-400" height="calc(100vh - 120px)">
      <Flex direction="column" height="100%" gap="size-300">
        
        {/* Header */}
        <Flex justifyContent="space-between" alignItems="center">
          <Flex alignItems="center" gap="size-200">
            <Icons.MessageSquare01 size={24} color="#3b82f6" />
            <Heading level={2}>AI Assistant Chat</Heading>
            <Badge variant={connectionStatus === 'this.connected' ? 'positive' : 'negative'}>
              {connectionStatus === 'this.connected' ? 'Online' : 'Offline'}
            </Badge>
          </Flex>
          
          <Flex alignItems="center" gap="size-200">
            <StatusLight variant={connectionStatus === 'this.connected' ? 'positive' : 'negative'}>
              <Text>{connectionStatus === 'this.connected' ? 'Connected' : 'Disconnected'}</Text>
            </StatusLight>
            
            <ActionButton
              isQuiet
              onPress={clearChat}
              aria-label="Clear chat"
            >
              <Icons.Trash01 size={20} />
              <Text>Clear</Text>
            </ActionButton>
          </Flex>
        </Flex>

        <Divider />

        {/* Error Display */}
        {error && (
          <Well>
            <Flex alignItems="center" gap="size-200">
              <Icons.AlertTriangle size={20} color="#ef4444" />
              <Text>{error}</Text>
              <ActionButton
                isQuiet
                onPress={() => setError(null)}
                aria-label="Dismiss error"
              >
                <Icons.X size={16} />
              </ActionButton>
            </Flex>
          </Well>
        )}

        {/* Messages Area */}
        <View 
          flex="1 1 auto" 
          overflow="auto"
          backgroundColor="gray-50"
          borderRadius="medium"
          padding="size-300"
          UNSAFE_style={{ 
            minHeight: 0,
            scrollBehavior: 'smooth'
          }}
        >
          <Flex direction="column" gap="size-300">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            
            {/* Thinking Indicator */}
            {agentThinking && (
              <Flex alignItems="center" gap="size-200" justifyContent="flex-start">
                <View
                  backgroundColor="gray-200"
                  borderRadius="medium"
                  padding="size-300"
                  maxWidth="size-3000"
                >
                  <Flex alignItems="center" gap="size-200">
                    <ProgressCircle 
                      size="S" 
                      isIndeterminate 
                      aria-label="Agent thinking"
                    />
                    <Text>
                      <em>AI is thinking...</em>
                    </Text>
                  </Flex>
                </View>
              </Flex>
            )}
            
            <div ref={messagesEndRef} />
          </Flex>
        </View>

        {/* Input Area */}
        <View 
          backgroundColor="gray-100" 
          borderRadius="medium" 
          padding="size-300"
        >
          <Flex gap="size-200" alignItems="end">
            <View flex="1 1 auto">
              <TextField
                value={input}
                onChange={setInput}
                onKeyPress={handleKeyPress}
                isDisabled={loading || connectionStatus !== 'this.connected'}
                autoFocus
                aria-label="Chat message input"
                description="Press Enter to send your message"
                UNSAFE_style={{ width: '100%' }}
              />
            </View>
            
            <ActionButton
              variant="accent"
              onPress={handleSendMessage}
              isDisabled={!input.trim() || loading || connectionStatus !== 'this.connected'}
              aria-label="Send message"
            >
              {loading ? (
                <ProgressCircle size="S" isIndeterminate />
              ) : (
                <Icons.Send01 size={20} />
              )}
              <Text>{loading ? 'Sending...' : 'Send'}</Text>
            </ActionButton>
          </Flex>
          
          <Flex justifyContent="space-between" alignItems="center" marginTop="size-100">
            <Text UNSAFE_style={{ fontSize: '0.75rem', color: '#6b7280' }}>
              Powered by Universal AI Tools • Real Backend Integration • React Spectrum UI
            </Text>
            
            <Flex alignItems="center" gap="size-100">
              <Icons.Zap size={14} color="#3b82f6" />
              <Text UNSAFE_style={{ fontSize: '0.75rem', color: '#3b82f6' }}>
                {connectionStatus === 'this.connected' ? 'Backend Live' : 'Backend Offline'}
              </Text>
            </Flex>
          </Flex>
        </View>
      </Flex>
    </View>
  );
}