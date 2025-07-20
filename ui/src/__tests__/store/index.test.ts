import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStore } from '../../store';

describe('Zustand Store', () => {
  beforeEach(() => {
    // Reset store state before each test
    const { result } = renderHook(() => useStore());
    act(() => {
      result.current.setTheme('dark');
      result.current.setActiveConversationId(null);
      result.current.clearGlobalError();
      result.current.setApiUrl('http://localhost:9999/api');
      result.current.setSelectedModel('llama3.2:3b');
    });
  });

  describe('Initial State', () => {
    it('has correct initial state', () => {
      const { result } = renderHook(() => useStore());
      
      expect(result.current.sidebarCollapsed).toBe(false);
      expect(result.current.theme).toBe('dark');
      expect(result.current.preferences.defaultModel).toBe('llama3.2:3b');
      expect(result.current.preferences.voiceEnabled).toBe(false);
      expect(result.current.globalError).toBe(null);
      expect(result.current.activeConversationId).toBe(null);
    });

    it('has correct connection status defaults', () => {
      const { result } = renderHook(() => useStore());
      
      expect(result.current.connectionStatus.backend).toBe('disconnected');
      expect(result.current.connectionStatus.ollama).toBe('disconnected');
      expect(result.current.connectionStatus.websocket).toBe('disconnected');
    });
  });

  describe('Actions', () => {
    it('toggles sidebar correctly', () => {
      const { result } = renderHook(() => useStore());
      
      expect(result.current.sidebarCollapsed).toBe(false);
      
      act(() => {
        result.current.toggleSidebar();
      });
      
      expect(result.current.sidebarCollapsed).toBe(true);
      
      act(() => {
        result.current.toggleSidebar();
      });
      
      expect(result.current.sidebarCollapsed).toBe(false);
    });

    it('sets theme correctly', () => {
      const { result } = renderHook(() => useStore());
      
      act(() => {
        result.current.setTheme('light');
      });
      
      expect(result.current.theme).toBe('light');
      
      act(() => {
        result.current.setTheme('dark');
      });
      
      expect(result.current.theme).toBe('dark');
    });

    it('updates preferences correctly', () => {
      const { result } = renderHook(() => useStore());
      
      const newPreferences = {
        voiceEnabled: true,
        autoScroll: false,
        messageFormat: 'plain' as const,
      };
      
      act(() => {
        result.current.setPreferences(newPreferences);
      });
      
      expect(result.current.preferences.voiceEnabled).toBe(true);
      expect(result.current.preferences.autoScroll).toBe(false);
      expect(result.current.preferences.messageFormat).toBe('plain');
      // Should preserve unchanged preferences
      expect(result.current.preferences.defaultModel).toBe('llama3.2:3b');
    });

    it('sets connection status correctly', () => {
      const { result } = renderHook(() => useStore());
      
      act(() => {
        result.current.setConnectionStatus('backend', 'connected');
      });
      
      expect(result.current.connectionStatus.backend).toBe('connected');
      
      act(() => {
        result.current.setConnectionStatus('ollama', 'checking');
      });
      
      expect(result.current.connectionStatus.ollama).toBe('checking');
    });

    it('manages global error state correctly', () => {
      const { result } = renderHook(() => useStore());
      
      const testError = {
        message: 'Test error message',
        type: 'error' as const,
        timestamp: new Date(),
      };
      
      act(() => {
        result.current.setGlobalError(testError);
      });
      
      expect(result.current.globalError).toEqual(testError);
      
      act(() => {
        result.current.clearGlobalError();
      });
      
      expect(result.current.globalError).toBe(null);
    });

    it('handles success type in global error', () => {
      const { result } = renderHook(() => useStore());
      
      const successMessage = {
        message: 'Operation successful',
        type: 'success' as const,
        timestamp: new Date(),
      };
      
      act(() => {
        result.current.setGlobalError(successMessage);
      });
      
      expect(result.current.globalError?.type).toBe('success');
      expect(result.current.globalError?.message).toBe('Operation successful');
    });

    it('sets active conversation ID correctly', () => {
      const { result } = renderHook(() => useStore());
      
      const testConversationId = 'test-conversation-123';
      
      act(() => {
        result.current.setActiveConversationId(testConversationId);
      });
      
      expect(result.current.activeConversationId).toBe(testConversationId);
      
      act(() => {
        result.current.setActiveConversationId(null);
      });
      
      expect(result.current.activeConversationId).toBe(null);
    });

    it('sets API URL correctly', () => {
      const { result } = renderHook(() => useStore());
      
      const newApiUrl = 'http://localhost:8080/api';
      
      act(() => {
        result.current.setApiUrl(newApiUrl);
      });
      
      expect(result.current.apiUrl).toBe(newApiUrl);
    });

    it('sets selected model correctly', () => {
      const { result } = renderHook(() => useStore());
      
      const newModel = 'gpt-4';
      
      act(() => {
        result.current.setSelectedModel(newModel);
      });
      
      expect(result.current.selectedModel).toBe(newModel);
    });
  });

  describe('Error Types', () => {
    it('supports all error types', () => {
      const { result } = renderHook(() => useStore());
      
      const errorTypes = ['error', 'warning', 'info', 'success'] as const;
      
      errorTypes.forEach(type => {
        const testError = {
          message: `Test ${type} message`,
          type,
          timestamp: new Date(),
        };
        
        act(() => {
          result.current.setGlobalError(testError);
        });
        
        expect(result.current.globalError?.type).toBe(type);
      });
    });
  });
});