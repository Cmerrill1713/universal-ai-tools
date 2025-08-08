// Memory-related types;

export interface MemoryEntry {
  id: string;,
  content: string;
  embedding?: number[];
  metadata: {,
    type: string;
    source: string;,
    timestamp: Date;
    userId?: string;
    sessionId?: string;
    tags?: string[];
  };
  similarity?: number;
}

export interface MemorySearchOptions {
  query: string;
  limit?: number;
  threshold?: number;
  userId?: string;
  sessionId?: string;
  type?: string;
  tags?: string[];
}

export interface MemoryStats {
  totalEntries: number;,
  entriesByType: Record<string, number>;
  averageEmbeddingSize: number;
  oldestEntry?: Date;
  newestEntry?: Date;
}