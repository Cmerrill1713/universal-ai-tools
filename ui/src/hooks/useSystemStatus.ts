import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useStore } from '../store';
import { systemApi } from '../lib/api';

/**
 * Custom hook to manage system status and connection state
 * Integrates with global store for centralized state management
 */
export function useSystemStatus() {
  const { connectionStatus, setConnectionStatus, setGlobalError } = useStore();
  
  // Monitor backend health
  const { 
    data: healthData, 
    isError: healthError,
    error: healthErrorData,
    isLoading: healthLoading 
  } = useQuery({
    queryKey: ['system-health'],
    queryFn: async () => {
      try {
        const health = await systemApi.getHealth();
        return health;
      } catch (error) {
        throw new Error('Backend service unreachable');
      }
    },
    refetchInterval: 10000, // Check every 10 seconds
    retry: 3,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 10000),
  });

  // Monitor Ollama status
  const { 
    data: ollamaData, 
    isError: ollamaError,
    error: ollamaErrorData,
    isLoading: ollamaLoading 
  } = useQuery({
    queryKey: ['ollama-status'],
    queryFn: async () => {
      try {
        return await systemApi.getOllamaStatus();
      } catch (error) {
        throw new Error('Ollama service unreachable');
      }
    },
    refetchInterval: 15000, // Check every 15 seconds
    retry: 2,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 15000),
    enabled: !healthError, // Only check Ollama if backend is healthy
  });

  // Update connection status based on query results
  useEffect(() => {
    if (healthLoading) {
      setConnectionStatus('backend', 'reconnecting');
    } else if (healthError) {
      setConnectionStatus('backend', 'disconnected');
      setGlobalError({
        message: 'Backend service is unavailable',
        type: 'error',
        timestamp: new Date(),
      });
    } else if (healthData) {
      setConnectionStatus('backend', 'connected');
    }
  }, [healthData, healthError, healthLoading, setConnectionStatus, setGlobalError]);

  useEffect(() => {
    if (healthError) {
      // Don't check Ollama if backend is down
      setConnectionStatus('ollama', 'disconnected');
    } else if (ollamaLoading) {
      setConnectionStatus('ollama', 'checking');
    } else if (ollamaError) {
      setConnectionStatus('ollama', 'disconnected');
    } else if (ollamaData?.status === 'available') {
      setConnectionStatus('ollama', 'connected');
    } else {
      setConnectionStatus('ollama', 'disconnected');
    }
  }, [ollamaData, ollamaError, ollamaLoading, healthError, setConnectionStatus]);

  return {
    // Connection states
    isBackendConnected: connectionStatus.backend === 'connected',
    isOllamaConnected: connectionStatus.ollama === 'connected',
    isSystemHealthy: connectionStatus.backend === 'connected' && connectionStatus.ollama === 'connected',
    
    // Loading states
    isCheckingBackend: healthLoading,
    isCheckingOllama: ollamaLoading,
    
    // Data
    healthData,
    ollamaData,
    availableModels: ollamaData?.models || [],
    
    // Error states
    backendError: healthError ? healthErrorData : null,
    ollamaError: ollamaError ? ollamaErrorData : null,
    
    // Connection status
    connectionStatus,
  };
}

/**
 * Hook for managing real-time WebSocket connection
 */
export function useWebSocketStatus() {
  const { connectionStatus, setConnectionStatus } = useStore();
  
  // This would integrate with the existing useWebSocket hook
  // For now, returning basic status
  return {
    isWebSocketConnected: connectionStatus.websocket === 'connected',
    webSocketStatus: connectionStatus.websocket,
    setWebSocketStatus: (status: typeof connectionStatus.websocket) => {
      setConnectionStatus('websocket', status);
    },
  };
}