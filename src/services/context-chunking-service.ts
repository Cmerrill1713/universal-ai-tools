/**
 * Context Chunking Service
 * Optimized for semantic word-based chunking with our Docker Supabase stack
 */

import { createClient } from '@supabase/supabase-js';

export class ContextChunkingService {
  private readonly OPTIMAL_CHUNK_SIZE = 500; // words, not tokens
  private readonly OVERLAP_SIZE = 50; // words for context continuity
  private readonly MAX_CHUNK_SIZE = 750; // words absolute max
  
  private supabase = createClient(
    process.env.SUPABASE_URL || 'http://localhost:54321',
    process.env.SUPABASE_SERVICE_KEY || ''
  );

  /**
   * Chunk text using semantic word boundaries
   * Better for retrieval and maintaining meaning
   */
  async chunkTextSemantic(text: string, metadata?: any): Promise<ChunkResult[]> {
    const sentences = this.splitIntoSentences(text);
    const chunks: ChunkResult[] = [];
    let currentChunk: string[] = [];
    let currentWordCount = 0;

    for (const sentence of sentences) {
      const words = sentence.split(/\s+/).filter(w => w.length > 0);
      const sentenceWordCount = words.length;

      // If adding this sentence exceeds optimal size, create a chunk
      if (currentWordCount + sentenceWordCount > this.OPTIMAL_CHUNK_SIZE && currentChunk.length > 0) {
        chunks.push(await this.createChunk(currentChunk.join(' '), currentWordCount, metadata));
        
        // Add overlap for context continuity
        const overlapWords = currentChunk.join(' ').split(/\s+/).slice(-this.OVERLAP_SIZE);
        currentChunk = overlapWords.length > 0 ? [overlapWords.join(' ')] : [];
        currentWordCount = overlapWords.length;
      }

      currentChunk.push(sentence);
      currentWordCount += sentenceWordCount;
    }

    // Add remaining content
    if (currentChunk.length > 0) {
      chunks.push(await this.createChunk(currentChunk.join(' '), currentWordCount, metadata));
    }

    return chunks;
  }

  /**
   * Smart sentence splitting that preserves code blocks and lists
   */
  private splitIntoSentences(text: string): string[] {
    // Preserve code blocks
    const codeBlockRegex = /```[\s\S]*?```/g;
    const codeBlocks: string[] = [];
    let codeIndex = 0;
    
    text = text.replace(codeBlockRegex, (match) => {
      codeBlocks.push(match);
      return `__CODE_BLOCK_${codeIndex++}__`;
    });

    // Split by sentence endings, but preserve common abbreviations
    const sentences = text.split(/(?<=[.!?])\s+(?=[A-Z])/);
    
    // Restore code blocks
    return sentences.map(sentence => {
      return sentence.replace(/__CODE_BLOCK_(\d+)__/g, (_, index) => {
        return codeBlocks[parseInt(index)];
      });
    });
  }

  /**
   * Create a chunk with metadata for storage
   */
  private async createChunk(content: string, wordCount: number, metadata?: any): Promise<ChunkResult> {
    const chunk: ChunkResult = {
      content,
      wordCount,
      charCount: content.length,
      metadata: {
        ...metadata,
        created_at: new Date().toISOString(),
        chunk_method: 'semantic_word',
        has_code: content.includes('```'),
        estimated_tokens: Math.ceil(wordCount * 1.3) // Rough token estimate
      }
    };

    // Generate embedding if needed (would integrate with embedding service)
    // chunk.embedding = await this.generateEmbedding(content);

    return chunk;
  }

  /**
   * Store chunks in Supabase for retrieval
   */
  async storeChunks(chunks: ChunkResult[], category: string = 'conversation'): Promise<void> {
    const records = chunks.map(chunk => ({
      category,
      content: chunk.content,
      metadata: chunk.metadata,
      word_count: chunk.wordCount,
      embedding: chunk.embedding,
      source: 'context-chunking-service'
    }));

    const { error } = await this.supabase
      .from('context_storage')
      .insert(records);

    if (error) {
      console.error('Failed to store chunks:', error);
      throw error;
    }
  }

  /**
   * Retrieve relevant chunks using semantic search
   */
  async retrieveRelevantChunks(query: string, limit: number = 5): Promise<ChunkResult[]> {
    // This would use vector similarity search in production
    // For now, use text search
    const { data, error } = await this.supabase
      .from('context_storage')
      .select('*')
      .textSearch('content', query)
      .limit(limit);

    if (error) {
      console.error('Failed to retrieve chunks:', error);
      return [];
    }

    return data.map(record => ({
      content: record.content,
      wordCount: record.word_count,
      charCount: record.content.length,
      metadata: record.metadata,
      embedding: record.embedding
    }));
  }

  /**
   * Hybrid approach: Use tokens only for size estimation
   */
  estimateTokenCount(text: string): number {
    // Simple estimation: ~1.3 tokens per word for English
    // More accurate with actual tokenizer (tiktoken for GPT, etc.)
    const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
    return Math.ceil(wordCount * 1.3);
  }
}

interface ChunkResult {
  content: string;
  wordCount: number;
  charCount: number;
  metadata?: any;
  embedding?: number[];
}

// Usage example for our Swift integration
export const chunkingService = new ContextChunkingService();

// Example: Chunk Swift code documentation
async function chunkSwiftDocumentation(swiftCode: string) {
  const chunks = await chunkingService.chunkTextSemantic(swiftCode, {
    language: 'swift',
    type: 'documentation',
    project: 'universal-ai-tools'
  });
  
  await chunkingService.storeChunks(chunks, 'swift_documentation');
  
  console.log(`Created ${chunks.length} chunks from Swift documentation`);
  console.log(`Average chunk size: ${chunks.reduce((acc, c) => acc + c.wordCount, 0) / chunks.length} words`);
}