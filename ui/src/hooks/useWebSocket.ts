import { useEffect, useRef, useState, useCallback } from 'react';

interface UseWebSocketProps {
  url: string;
  onMessage?: (data: any) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  autoConnect?: boolean;
}

export function useWebSocket({
  url,
  onMessage,
  onConnect,
  onDisconnect,
  autoConnect = true,
}: UseWebSocketProps) {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!autoConnect) return;

    const ws = new WebSocket(url);
    socketRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      onConnect?.();
    };

    ws.onclose = () => {
      setIsConnected(false);
      onDisconnect?.();
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage?.(data);
      } catch (error) {
        console.error('WebSocket message parsing error:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return () => {
      ws.close();
    };
  }, [url, autoConnect, onConnect, onDisconnect, onMessage]);

  const sendMessage = useCallback((data: any) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(data));
    }
  }, []);

  const connect = useCallback(() => {
    if (socketRef.current?.readyState === WebSocket.CLOSED) {
      // Create new WebSocket connection
      const ws = new WebSocket(url);
      socketRef.current = ws;
      
      ws.onopen = () => {
        setIsConnected(true);
        onConnect?.();
      };

      ws.onclose = () => {
        setIsConnected(false);
        onDisconnect?.();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessage?.(data);
        } catch (error) {
          console.error('WebSocket message parsing error:', error);
        }
      };
    }
  }, [url, onConnect, onDisconnect, onMessage]);

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
  };
}