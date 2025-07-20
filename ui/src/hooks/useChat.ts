import { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useStore, useConversationStore } from '../store';
import { chatApi, ChatMessage } from '../lib/api';
import { useSystemStatus } from './useSystemStatus';

interface UseChatOptions {
  conversationId?: string;
  autoGenerateId?: boolean;
}

/**
 * Custom hook for managing chat functionality
 * Handles message state, API calls, conversation management, and error handling
 */
export function useChat({ conversationId, autoGenerateId = true }: UseChatOptions = {}) {
  const queryClient = useQueryClient();
  const { 
    preferences, 
    setGlobalError, 
    clearGlobalError,
    activeConversationId,
    setActiveConversationId 
  } = useStore();
  const { addConversation, updateConversation } = useConversationStore();
  const { isOllamaConnected, availableModels } = useSystemStatus();
  
  // Generate conversation ID if needed
  const finalConversationId = conversationId || 
    (autoGenerateId ? `chat-${Date.now()}` : null);
  
  // Local state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState(preferences.defaultModel);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load conversation history
  const { 
    data: conversationHistory, 
    isLoading: historyLoading
  } = useQuery({
    queryKey: ['conversation-history', finalConversationId],
    queryFn: async () => {
      if (!finalConversationId) return [];
      try {
        return await chatApi.getConversationHistory(finalConversationId, 50);
      } catch (error) {
        console.warn('Failed to fetch conversation history:', error);
        return [];
      }
    },
    enabled: !!finalConversationId,
    retry: 1,
  });

  // Chat mutation with enhanced error handling
  const chatMutation = useMutation({
    mutationFn: async ({ message, model }: { message: string; model: string }) => {
      if (!finalConversationId) {
        throw new Error('No active conversation');
      }
      
      clearGlobalError(); // Clear any previous global errors
      return await chatApi.sendMessage(message, model, finalConversationId);
    },
    onSuccess: (data) => {
      const assistantMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date(data.timestamp),
        model: data.model,
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      
      // Update conversation metadata
      if (finalConversationId) {
        updateConversation(finalConversationId, {
          lastActivity: new Date(),
          messageCount: messages.length + 1,
          model: data.model,
        });
      }
      
      // Refresh conversation history
      queryClient.invalidateQueries({ 
        queryKey: ['conversation-history', finalConversationId] 
      });
    },
    onError: (error: Error) => {
      console.error('Chat error:', error);
      
      // Set global error for UI feedback
      setGlobalError({
        message: error.message || 'Failed to send message',
        type: 'error',
        timestamp: new Date(),
      });
      
      // Add error message to chat
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `❌ Error: ${error.message}`,
        timestamp: new Date(),
        model: selectedModel,
      };
      setMessages(prev => [...prev, errorMessage]);
    },
  });

  // Auto-scroll to bottom
  useEffect(() => {
    if (preferences.autoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, preferences.autoScroll]);

  // Load conversation history when available
  useEffect(() => {
    if (conversationHistory && Array.isArray(conversationHistory)) {
      const formattedMessages = conversationHistory.map(msg => ({
        ...msg,
        timestamp: new Date(msg.timestamp),
      }));
      setMessages(formattedMessages);
    }
  }, [conversationHistory]);

  // Set active conversation
  useEffect(() => {
    if (finalConversationId && finalConversationId !== activeConversationId) {
      setActiveConversationId(finalConversationId);
    }
  }, [finalConversationId, activeConversationId, setActiveConversationId]);

  // Update selected model from preferences
  useEffect(() => {
    setSelectedModel(preferences.defaultModel);
  }, [preferences.defaultModel]);

  // Handlers
  const sendMessage = async (messageText?: string) => {
    const textToSend = messageText || input.trim();
    
    if (!textToSend || chatMutation.isPending) return;

    // Check if Ollama is available
    if (!isOllamaConnected) {
      setGlobalError({
        message: 'Ollama service is not available. Please ensure it is running.',
        type: 'error',
        timestamp: new Date(),
      });
      return;
    }

    // Ensure conversation exists
    if (finalConversationId) {
      addConversation({
        id: finalConversationId,
        title: textToSend.slice(0, 50) + (textToSend.length > 50 ? '...' : ''),
        model: selectedModel,
      });
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: textToSend,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    clearGlobalError();

    // Send message to AI
    chatMutation.mutate({
      message: textToSend,
      model: selectedModel,
    });
  };

  const clearConversation = () => {
    setMessages([]);
    clearGlobalError();
    if (finalConversationId) {
      queryClient.invalidateQueries({ 
        queryKey: ['conversation-history', finalConversationId] 
      });
    }
  };

  const copyToClipboard = async (text: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(messageId);
      setTimeout(() => setCopySuccess(null), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
      setGlobalError({
        message: 'Failed to copy text to clipboard',
        type: 'warning',
        timestamp: new Date(),
      });
    }
  };

  const retryLastMessage = () => {
    const lastUserMessage = [...messages].reverse().find(msg => msg.role === 'user');
    if (lastUserMessage) {
      sendMessage(lastUserMessage.content);
    }
  };

  return {
    // State
    messages,
    input,
    setInput,
    selectedModel,
    setSelectedModel,
    conversationId: finalConversationId,
    copySuccess,
    
    // Status
    isLoading: chatMutation.isPending,
    isLoadingHistory: historyLoading,
    hasError: !!chatMutation.error,
    error: chatMutation.error,
    
    // Actions
    sendMessage,
    clearConversation,
    copyToClipboard,
    retryLastMessage,
    
    // Refs for UI
    messagesEndRef,
    
    // Available models
    availableModels,
    
    // System status
    isSystemReady: isOllamaConnected,
  };
}