import { useState, useEffect } from 'react';

export interface SystemStatus {
  database: boolean;
  redis: boolean;
  ollama: boolean;
  lmStudio: boolean;
  websocket: boolean;
  supabase: boolean;
}

export function useSystemStatus() {
  const [status, setStatus] = useState<SystemStatus>({
    database: false,
    redis: false,
    ollama: false,
    lmStudio: false,
    websocket: false,
    supabase: false
  });

  useEffect(() => {
    // TODO: Fetch system status from API
    // For now, return mock data
    setStatus({
      database: true,
      redis: true,
      ollama: true,
      lmStudio: false,
      websocket: true,
      supabase: true
    });
  }, []);

  return status;
}
