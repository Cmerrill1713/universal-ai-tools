/**
 * Chunking Service
 * Provides text chunking capabilities for memory optimization and processing
 */

export interface ChunkConfig {
  maxChunkSize: number;
  overlap: number;
  preserveStructure: boolean;
  splitOn: 'sentence' | 'paragraph' | 'token' | 'character';
}

export interface TextChunk {
  id: string;
  content: string;
  index: number;
  startPosition: number;
  endPosition: number;
  metadata: Record<string, any>;
  tokenCount?: number;
}

export interface ChunkingResult {
  chunks: TextChunk[];
  totalChunks: number;
  totalTokens: number;
  avgChunkSize: number;
  processingTimeMs: number;
}

export class ChunkingService {
  private readonly defaultConfig: ChunkConfig = {
    maxChunkSize: 1000,
    overlap: 100,
    preserveStructure: true,
    splitOn: 'sentence'
  };

  /**
   * Chunk text based on configuration
   */
  async chunkText(text: string, config?: Partial<ChunkConfig>): Promise<ChunkingResult> {
    const startTime = Date.now();
    const finalConfig = { ...this.defaultConfig, ...config };
    
    const chunks = await this.performChunking(text, finalConfig);
    const processingTime = Date.now() - startTime;
    
    const totalTokens = chunks.reduce((sum, chunk) => sum + (chunk.tokenCount || 0), 0);
    const avgChunkSize = chunks.length > 0 ? totalTokens / chunks.length : 0;

    return {
      chunks,
      totalChunks: chunks.length,
      totalTokens,
      avgChunkSize: Math.round(avgChunkSize),
      processingTimeMs: processingTime
    };
  }

  /**
   * Chunk text by sentences with overlap
   */
  async chunkBySentence(text: string, maxSize = 1000, overlap = 100): Promise<TextChunk[]> {
    const sentences = this.splitIntoSentences(text);
    const chunks: TextChunk[] = [];
    let currentChunk = '';
    let chunkIndex = 0;
    let currentPosition = 0;

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      
      if (currentChunk.length + sentence.length <= maxSize) {
        currentChunk += sentence;
      } else {
        if (currentChunk.length > 0) {
          chunks.push(this.createChunk(currentChunk, chunkIndex, currentPosition, currentPosition + currentChunk.length));
          chunkIndex++;
        }
        
        // Handle overlap
        if (overlap > 0 && chunks.length > 0) {
          const overlapText = this.getOverlapText(currentChunk, overlap);
          currentChunk = overlapText + sentence;
          currentPosition = currentPosition + currentChunk.length - overlapText.length;
        } else {
          currentChunk = sentence;
          currentPosition = currentPosition + currentChunk.length;
        }
      }
    }

    // Add final chunk
    if (currentChunk.length > 0) {
      chunks.push(this.createChunk(currentChunk, chunkIndex, currentPosition, currentPosition + currentChunk.length));
    }

    return chunks;
  }

  /**
   * Chunk text by paragraphs
   */
  async chunkByParagraph(text: string, maxSize = 2000): Promise<TextChunk[]> {
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    const chunks: TextChunk[] = [];
    let currentChunk = '';
    let chunkIndex = 0;
    let currentPosition = 0;

    for (const paragraph of paragraphs) {
      if (currentChunk.length + paragraph.length <= maxSize) {
        currentChunk += (currentChunk.length > 0 ? '\n\n' : '') + paragraph;
      } else {
        if (currentChunk.length > 0) {
          chunks.push(this.createChunk(currentChunk, chunkIndex, currentPosition, currentPosition + currentChunk.length));
          chunkIndex++;
          currentPosition += currentChunk.length;
        }
        currentChunk = paragraph;
      }
    }

    // Add final chunk
    if (currentChunk.length > 0) {
      chunks.push(this.createChunk(currentChunk, chunkIndex, currentPosition, currentPosition + currentChunk.length));
    }

    return chunks;
  }

  /**
   * Chunk text by character count with word boundaries
   */
  async chunkByCharacter(text: string, maxSize = 1000, overlap = 100): Promise<TextChunk[]> {
    const chunks: TextChunk[] = [];
    let chunkIndex = 0;
    let position = 0;

    while (position < text.length) {
      let chunkEnd = Math.min(position + maxSize, text.length);
      
      // Find word boundary to avoid splitting words
      if (chunkEnd < text.length) {
        while (chunkEnd > position && text[chunkEnd] !== ' ' && text[chunkEnd] !== '\n') {
          chunkEnd--;
        }
      }

      const chunkContent = text.substring(position, chunkEnd).trim();
      
      if (chunkContent.length > 0) {
        chunks.push(this.createChunk(chunkContent, chunkIndex, position, chunkEnd));
        chunkIndex++;
      }

      // Move position considering overlap
      position = Math.max(chunkEnd - overlap, position + 1);
    }

    return chunks;
  }

  /**
   * Get optimal chunk size based on content type
   */
  getOptimalChunkSize(contentType: 'code' | 'prose' | 'technical' | 'general'): number {
    switch (contentType) {
      case 'code':
        return 500; // Smaller chunks for code to preserve structure
      case 'prose':
        return 1500; // Larger chunks for narrative content
      case 'technical':
        return 1000; // Medium chunks for technical documentation
      case 'general':
      default:
        return 1000;
    }
  }

  private async performChunking(text: string, config: ChunkConfig): Promise<TextChunk[]> {
    switch (config.splitOn) {
      case 'sentence':
        return this.chunkBySentence(text, config.maxChunkSize, config.overlap);
      case 'paragraph':
        return this.chunkByParagraph(text, config.maxChunkSize);
      case 'character':
        return this.chunkByCharacter(text, config.maxChunkSize, config.overlap);
      case 'token':
        // For now, approximate tokens as characters/4
        return this.chunkByCharacter(text, config.maxChunkSize * 4, config.overlap * 4);
      default:
        return this.chunkBySentence(text, config.maxChunkSize, config.overlap);
    }
  }

  private splitIntoSentences(text: string): string[] {
    // Simple sentence splitting - could be enhanced with NLP library
    return text.split(/[.!?]+/).filter(s => s.trim().length > 0).map(s => s.trim() + '.');
  }

  private createChunk(content: string, index: number, start: number, end: number): TextChunk {
    const tokenCount = this.estimateTokenCount(content);
    
    return {
      id: `chunk_${index}_${Date.now()}`,
      content: content.trim(),
      index,
      startPosition: start,
      endPosition: end,
      tokenCount,
      metadata: {
        length: content.length,
        wordCount: content.split(/\s+/).length,
        createdAt: new Date().toISOString()
      }
    };
  }

  private getOverlapText(text: string, overlapSize: number): string {
    if (text.length <= overlapSize) {return text;}
    return text.substring(text.length - overlapSize);
  }

  private estimateTokenCount(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }
}

export const chunkingService = new ChunkingService();