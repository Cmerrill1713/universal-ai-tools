/**
 * Local Memory Layer Service
 * A self-hosted alternative to ByteRover for AI agent memory management
 * Provides shared memory layer for coding agents across sessions
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

import { log, LogContext } from '../utils/logger.js';

interface CodeMemory {
  id: string;
  session_id: string;
  agent_name: string;
  context_type: 'bug_fix' | 'feature' | 'refactor' | 'optimization' | 'pattern' | 'decision';
  content: string;
  code_snippet?: string;
  file_path?: string;
  programming_language?: string;
  tags: string[];
  success_metrics?: {
    compilation_success: boolean;
    test_passing: boolean;
    performance_improvement?: number;
  };
  embedding?: number[];
  created_at: string;
  last_accessed: string;
  access_count: number;
}

interface MemoryQuery {
  context: string;
  code_snippet?: string;
  file_path?: string;
  language?: string;
  agent_name?: string;
  limit?: number;
}

interface MemoryResponse {
  memories: CodeMemory[];
  relevance_scores: number[];
  total_found: number;
}

export class LocalMemoryLayerService {
  private supabase: SupabaseClient;
  private isInitialized = false;
  private sessionId: string;

  constructor() {
    this.sessionId = uuidv4();
    
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration missing for Local Memory Layer');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Create memory table if it doesn't exist
      await this.createMemoryTable();
      this.isInitialized = true;
      log.info('✅ Local Memory Layer Service initialized', LogContext.AI, {
        sessionId: this.sessionId
      });
    } catch (error) {
      log.error('❌ Failed to initialize Local Memory Layer', LogContext.AI, {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async createMemoryTable(): Promise<void> {
    const { error } = await this.supabase.rpc('create_code_memory_table', {
      sql: `
        CREATE TABLE IF NOT EXISTS code_memories (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          session_id TEXT NOT NULL,
          agent_name TEXT NOT NULL,
          context_type TEXT NOT NULL CHECK (context_type IN ('bug_fix', 'feature', 'refactor', 'optimization', 'pattern', 'decision')),
          content TEXT NOT NULL,
          code_snippet TEXT,
          file_path TEXT,
          programming_language TEXT,
          tags TEXT[] DEFAULT '{}',
          success_metrics JSONB,
          embedding VECTOR(1536),
          created_at TIMESTAMPTZ DEFAULT NOW(),
          last_accessed TIMESTAMPTZ DEFAULT NOW(),
          access_count INTEGER DEFAULT 0
        );

        CREATE INDEX IF NOT EXISTS idx_code_memories_session ON code_memories(session_id);
        CREATE INDEX IF NOT EXISTS idx_code_memories_agent ON code_memories(agent_name);
        CREATE INDEX IF NOT EXISTS idx_code_memories_type ON code_memories(context_type);
        CREATE INDEX IF NOT EXISTS idx_code_memories_language ON code_memories(programming_language);
        CREATE INDEX IF NOT EXISTS idx_code_memories_embedding ON code_memories USING ivfflat (embedding vector_cosine_ops);
      `
    });

    if (error && !error.message.includes('already exists')) {
      throw error;
    }
  }

  /**
   * Store a new coding memory
   */
  async storeMemory(memory: Omit<CodeMemory, 'id' | 'created_at' | 'last_accessed' | 'access_count'>): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('Memory layer not initialized');
    }

    try {
      // Generate embedding for the content
      const embedding = await this.generateEmbedding(memory.content + ' ' + (memory.code_snippet || ''));

      const { data, error } = await this.supabase
        .from('code_memories')
        .insert({
          ...memory,
          embedding,
          session_id: memory.session_id || this.sessionId,
          id: uuidv4(),
          created_at: new Date().toISOString(),
          last_accessed: new Date().toISOString(),
          access_count: 0
        })
        .select('id')
        .single();

      if (error) {throw error;}

      log.info('📝 Code memory stored', LogContext.AI, {
        memoryId: data.id,
        contextType: memory.context_type,
        agentName: memory.agent_name
      });

      return data.id;
    } catch (error) {
      log.error('❌ Failed to store code memory', LogContext.AI, {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Retrieve relevant memories based on context
   */
  async retrieveMemories(query: MemoryQuery): Promise<MemoryResponse> {
    if (!this.isInitialized) {
      throw new Error('Memory layer not initialized');
    }

    try {
      const queryEmbedding = await this.generateEmbedding(
        query.context + ' ' + (query.code_snippet || '')
      );

      // Use vector similarity search
      const { data, error } = await this.supabase.rpc('search_code_memories', {
        query_embedding: queryEmbedding,
        match_threshold: 0.7,
        match_count: query.limit || 5,
        agent_filter: query.agent_name,
        language_filter: query.language
      });

      if (error) {throw error;}

      // Update access counts
      const memoryIds = data.map((m: any) => m.id);
      if (memoryIds.length > 0) {
        for (const id of memoryIds) {
          await this.supabase
            .from('code_memories')
            .update({ 
              last_accessed: new Date().toISOString()
            })
            .eq('id', id);
        }
      }

      const memories: CodeMemory[] = data.map((row: any) => ({
        ...row,
        tags: row.tags || []
      }));

      const relevanceScores = data.map((row: any) => row.similarity || 0);

      log.info('🔍 Retrieved code memories', LogContext.AI, {
        found: memories.length,
        query: query.context.substring(0, 100)
      });

      return {
        memories,
        relevance_scores: relevanceScores,
        total_found: memories.length
      };
    } catch (error) {
      log.error('❌ Failed to retrieve memories', LogContext.AI, {
        error: error instanceof Error ? error.message : String(error)
      });
      return { memories: [], relevance_scores: [], total_found: 0 };
    }
  }

  /**
   * Auto-generate memory from successful coding interactions
   */
  async autoGenerateMemory(
    agentName: string,
    context: string,
    codeSnippet: string,
    filePath: string,
    success: boolean
  ): Promise<string | null> {
    if (!success) {return null;}

    // Determine context type based on patterns
    let contextType: CodeMemory['context_type'] = 'pattern';
    
    if (context.toLowerCase().includes('fix') || context.toLowerCase().includes('bug')) {
      contextType = 'bug_fix';
    } else if (context.toLowerCase().includes('refactor')) {
      contextType = 'refactor';
    } else if (context.toLowerCase().includes('optimize')) {
      contextType = 'optimization';
    } else if (context.toLowerCase().includes('feature') || context.toLowerCase().includes('add')) {
      contextType = 'feature';
    }

    // Extract programming language from file path
    const language = this.detectLanguage(filePath);

    // Generate tags from context
    const tags = this.extractTags(context, codeSnippet);

    return await this.storeMemory({
      session_id: this.sessionId,
      agent_name: agentName,
      context_type: contextType,
      content: context,
      code_snippet: codeSnippet,
      file_path: filePath,
      programming_language: language,
      tags,
      success_metrics: {
        compilation_success: true,
        test_passing: success
      }
    });
  }

  /**
   * Get memory statistics
   */
  async getMemoryStats(): Promise<{
    total_memories: number;
    by_agent: Record<string, number>;
    by_type: Record<string, number>;
    by_language: Record<string, number>;
  }> {
    try {
      const { data, error } = await this.supabase.rpc('get_memory_stats');
      if (error) {throw error;}
      return data[0] || { total_memories: 0, by_agent: {}, by_type: {}, by_language: {} };
    } catch (error) {
      log.error('❌ Failed to get memory stats', LogContext.AI, { error });
      return { total_memories: 0, by_agent: {}, by_type: {}, by_language: {} };
    }
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    // Use the existing embedding service or fallback to simple hash-based approach
    try {
      // For now, return a mock embedding - integrate with your embedding service
      const mockEmbedding = new Array(1536).fill(0).map(() => Math.random() - 0.5);
      return mockEmbedding;
    } catch (error) {
      log.warn('⚠️ Embedding generation failed, using fallback', LogContext.AI);
      return new Array(1536).fill(0);
    }
  }

  private detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      'ts': 'typescript',
      'js': 'javascript',
      'tsx': 'tsx',
      'jsx': 'jsx',
      'py': 'python',
      'swift': 'swift',
      'go': 'go',
      'rs': 'rust',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c'
    };
    return languageMap[ext || ''] || 'unknown';
  }

  private extractTags(context: string, code: string): string[] {
    const tags: Set<string> = new Set();
    
    // Extract common programming concepts
    const patterns = [
      /async|await/gi,
      /promise|then|catch/gi,
      /function|method/gi,
      /class|interface/gi,
      /api|endpoint/gi,
      /database|sql/gi,
      /test|testing/gi,
      /performance|optimization/gi,
      /security|auth/gi,
      /error|exception/gi
    ];

    patterns.forEach(pattern => {
      const matches = (context + ' ' + code).match(pattern);
      if (matches) {
        matches.forEach(match => tags.add(match.toLowerCase()));
      }
    });

    return Array.from(tags).slice(0, 10);
  }
}

// Export singleton instance
export const localMemoryLayer = new LocalMemoryLayerService();