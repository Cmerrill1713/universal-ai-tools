import { useEffect, useRef, useState, useCallback } from 'react';

interface UseWebSocketProps {
  url: string;
  onMessage?: (data: any) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  autoConnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export function useWebSocket({
  url,
  onMessage,
  onConnect,
  onDisconnect,
  onError,
  autoConnect = true,
  reconnectInterval = 3000,
  maxReconnectAttempts = 5,
}: UseWebSocketProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connectWebSocket = useCallback(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    console.log(`🔌 Attempting WebSocket connection to ${url}`);
    const ws = new WebSocket(url);
    socketRef.current = ws;

    ws.onopen = () => {
      console.log('✅ WebSocket connected successfully');
      setIsConnected(true);
      setReconnectAttempts(0);
      
      // Clear any pending reconnect timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      // Call onConnect with a slight delay to ensure the connection is stable
      setTimeout(() => onConnect?.(), 100);
    };

    ws.onclose = (event) => {
      console.log(`🔌 WebSocket connection closed (code: ${event.code}, reason: ${event.reason})`);
      setIsConnected(false);
      onDisconnect?.();
      
      // Attempt reconnection if not a clean close and within retry limits
      if (event.code !== 1000 && reconnectAttempts < maxReconnectAttempts) {
        console.log(`🔄 Attempting reconnection in ${reconnectInterval}ms (attempt ${reconnectAttempts + 1}/${maxReconnectAttempts})`);
        reconnectTimeoutRef.current = setTimeout(() => {
          setReconnectAttempts(prev => prev + 1);
          connectWebSocket();
        }, reconnectInterval);
      } else if (reconnectAttempts >= maxReconnectAttempts) {
        console.error('❌ Max reconnection attempts reached. WebSocket connection failed.');
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📨 WebSocket message received:', data);
        onMessage?.(data);
      } catch (error) {
        console.error('❌ WebSocket message parsing error:', error, 'Raw data:', event.data);
      }
    };

    ws.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
      onError?.(error);
    };
  }, [url, onConnect, onDisconnect, onMessage, onError, reconnectAttempts, maxReconnectAttempts, reconnectInterval]);

  useEffect(() => {
    if (!autoConnect) return;

    connectWebSocket();

    return () => {
      // Clean up on unmount
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.close(1000, 'Component unmounting');
      }
    };
  }, [connectWebSocket, autoConnect]);

  const sendMessage = useCallback((data: any) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      try {
        const message = JSON.stringify(data);
        console.log('📤 Sending WebSocket message:', data);
        socketRef.current.send(message);
        return true;
      } catch (error) {
        console.error('❌ Failed to send WebSocket message:', error);
        return false;
      }
    } else {
      console.warn('⚠️ Cannot send message - WebSocket not connected');
      return false;
    }
  }, []);

  const connect = useCallback(() => {
    if (socketRef.current?.readyState !== WebSocket.OPEN) {
      setReconnectAttempts(0);
      connectWebSocket();
    }
  }, [connectWebSocket]);

  const disconnect = useCallback(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.close();
    }
  }, []);

  return {
    isConnected,
    sendMessage,
    connect,
    disconnect,
    reconnectAttempts,
    maxReconnectAttempts,
  };
}