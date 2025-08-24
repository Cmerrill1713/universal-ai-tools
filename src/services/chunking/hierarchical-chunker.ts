/**
 * Hierarchical Chunker
 * Multi-level document decomposition that preserves document structure
 * and creates parent-child relationships between chunks at different levels
 */

import { log, LogContext } from '@/utils/logger';

import type { Chunk, ChunkingConfig, StructuralElement } from './chunking-service';

export interface DocumentStructure {
  type: 'document' | 'section' | 'subsection' | 'paragraph' | 'block';
  level: number;
  title?: string;
  startPosition: number;
  endPosition: number;
  children: DocumentStructure[];
  content: string;
  metadata: StructureMetadata;
}

export interface StructureMetadata {
  elementCount: number;
  hasCode: boolean;
  hasLists: boolean;
  hasTables: boolean;
  estimatedReadingTime: number;
  complexity: 'low' | 'medium' | 'high';
}

export interface HierarchyLevel {
  level: number;
  name: string;
  pattern: RegExp;
  minSize: number;
  maxSize: number;
  preserveIntegrity: boolean;
}

export class HierarchicalChunker {
  private defaultHierarchyLevels: HierarchyLevel[] = [
    {
      level: 0,
      name: 'document',
      pattern: /^$/, // Matches the entire document
      minSize: 0,
      maxSize: Infinity,
      preserveIntegrity: true
    },
    {
      level: 1,
      name: 'section',
      pattern: /^#{1,2}\s+(.+)$/m,
      minSize: 500,
      maxSize: 5000,
      preserveIntegrity: true
    },
    {
      level: 2,
      name: 'subsection',
      pattern: /^#{3,4}\s+(.+)$/m,
      minSize: 200,
      maxSize: 2000,
      preserveIntegrity: true
    },
    {
      level: 3,
      name: 'paragraph',
      pattern: /\n\s*\n/,
      minSize: 50,
      maxSize: 800,
      preserveIntegrity: false
    },
    {
      level: 4,
      name: 'block',
      pattern: /[.!?]+\s+/,
      minSize: 20,
      maxSize: 300,
      preserveIntegrity: false
    }
  ];

  constructor() {}

  /**
   * Main hierarchical chunking method
   */
  async chunkByHierarchy(
    content: string,
    documentId: string,
    config: ChunkingConfig
  ): Promise<Chunk[]> {
    log.info('🏗️ Starting hierarchical chunking', LogContext.AI, {
      documentId,
      contentLength: content.length,
      hierarchyLevels: config.hierarchyLevels || 3
    });

    try {
      // Handle empty or whitespace-only content
      if (!content || content.trim().length === 0) {
        log.info('📝 Empty content provided, returning empty chunks array', LogContext.AI);
        return [];
      }

      // Step 1: Analyze document structure
      const documentStructure = await this.analyzeDocumentStructure(content);
      
      // Step 2: Build hierarchy tree
      const hierarchyTree = await this.buildHierarchyTree(
        content,
        documentStructure,
        config
      );
      
      // Step 3: Create chunks at each hierarchy level
      const chunks = await this.createHierarchicalChunks(
        hierarchyTree,
        documentId,
        config
      );
      
      // Step 4: Establish parent-child relationships
      const linkedChunks = await this.establishRelationships(chunks);
      
      // Step 5: Optimize hierarchy for retrieval
      const optimizedChunks = await this.optimizeHierarchy(linkedChunks, config);

      log.info('✅ Hierarchical chunking completed', LogContext.AI, {
        documentId,
        totalChunks: optimizedChunks.length,
        maxLevel: Math.max(...optimizedChunks.map(c => c.level)),
        avgChunkSize: optimizedChunks.reduce((sum, c) => sum + c.content.length, 0) / optimizedChunks.length
      });

      return optimizedChunks;

    } catch (error) {
      log.error('❌ Hierarchical chunking failed', LogContext.AI, {
        documentId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Analyze document structure to identify hierarchical elements
   */
  private async analyzeDocumentStructure(content: string): Promise<DocumentStructure> {
    log.info('📊 Analyzing document structure', LogContext.AI);

    const structure: DocumentStructure = {
      type: 'document',
      level: 0,
      startPosition: 0,
      endPosition: content.length,
      children: [],
      content,
      metadata: {
        elementCount: 0,
        hasCode: false,
        hasLists: false,
        hasTables: false,
        estimatedReadingTime: Math.ceil(content.split(/\s+/).length / 200),
        complexity: 'medium'
      }
    };

    // Detect all headings (H1-H6)
    const sectionPattern = /^(#{1,6})\s+(.+)$/gm;
    let match;
    const sections: Array<{level: number, title: string, start: number, content: string}> = [];

    while ((match = sectionPattern.exec(content)) !== null) {
      const level = match[1]?.length ?? 1;
      const title = match[2] ?? 'Untitled Section';
      const sectionStart = match.index;
      
      // Find the end of this section (next heading of same or higher level, or end of document)
      const nextSectionPattern = new RegExp(`^#{1,${level}}\\s+`, 'gm');
      nextSectionPattern.lastIndex = match.index + match[0].length;
      const nextMatch = nextSectionPattern.exec(content);
      const sectionEnd = nextMatch ? nextMatch.index : content.length;

      const sectionContent = content.slice(sectionStart, sectionEnd);
      sections.push({
        level,
        title,
        start: sectionStart,
        content: sectionContent
      });
    }

    // Build proper hierarchical structure by organizing sections by their level
    const structureStack: DocumentStructure[] = [structure];
    
    for (const section of sections) {
      const sectionStructure: DocumentStructure = {
        type: section.level <= 2 ? 'section' : 'subsection',
        level: section.level,
        title: section.title,
        startPosition: section.start,
        endPosition: section.start + section.content.length,
        children: [],
        content: section.content,
        metadata: this.analyzeStructureMetadata(section.content)
      };

      // Find the correct parent by level
      while (structureStack.length > 1) {
        const currentItem = structureStack[structureStack.length - 1];
        if (!currentItem || currentItem.level < section.level) {break;}
        structureStack.pop();
      }
      
      const parent = structureStack[structureStack.length - 1];
      if (parent) {
        parent.children.push(sectionStructure);
      }
      structureStack.push(sectionStructure);
      
      if (parent === structure) {
        structure.metadata.elementCount++;
      }
    }

    // If no major sections found, analyze paragraphs
    if (structure.children.length === 0) {
      structure.children = await this.findParagraphs(content, 0);
    }

    // Update document metadata
    structure.metadata = this.analyzeStructureMetadata(content);

    log.info('📋 Document structure analyzed', LogContext.AI, {
      sectionsFound: structure.children.length,
      hasCode: structure.metadata.hasCode,
      complexity: structure.metadata.complexity,
      estimatedReadingTime: structure.metadata.estimatedReadingTime
    });

    return structure;
  }

  /**
   * Find subsections within a section
   */
  private async findSubsections(
    content: string,
    basePosition: number,
    minLevel: number
  ): Promise<DocumentStructure[]> {
    const subsections: DocumentStructure[] = [];
    const subsectionPattern = new RegExp(`^(#{${minLevel},6})\\s+(.+)$`, 'gm');
    let match;

    while ((match = subsectionPattern.exec(content)) !== null) {
      const level = match[1]?.length ?? minLevel;
      const title = match[2] ?? 'Untitled Subsection';
      const subsectionStart = match.index;
      
      // Find the end of this subsection
      const nextSubsectionPattern = new RegExp(`^#{${minLevel},${level}}\\s+`, 'gm');
      nextSubsectionPattern.lastIndex = match.index + match[0].length;
      const nextMatch = nextSubsectionPattern.exec(content);
      const subsectionEnd = nextMatch ? nextMatch.index : content.length;

      const subsectionContent = content.slice(subsectionStart, subsectionEnd);
      const subsectionStructure: DocumentStructure = {
        type: 'subsection',
        level,
        title,
        startPosition: basePosition + subsectionStart,
        endPosition: basePosition + subsectionEnd,
        children: [],
        content: subsectionContent,
        metadata: this.analyzeStructureMetadata(subsectionContent)
      };

      // Recursively find deeper subsections
      if (subsectionContent.length > 200 && level < 6) {
        subsectionStructure.children = await this.findSubsections(
          subsectionContent,
          basePosition + subsectionStart,
          level + 1
        );
      }

      subsections.push(subsectionStructure);
    }

    return subsections;
  }

  /**
   * Find paragraphs in content without section headers
   */
  private async findParagraphs(content: string, basePosition: number): Promise<DocumentStructure[]> {
    const paragraphs: DocumentStructure[] = [];
    const paragraphSeparator = /\n\s*\n/g;
    let lastIndex = 0;
    let match;
    let paragraphIndex = 0;

    while ((match = paragraphSeparator.exec(content)) !== null) {
      const paragraphContent = content.slice(lastIndex, match.index).trim();
      
      if (paragraphContent.length > 50) {
        const paragraphStructure: DocumentStructure = {
          type: 'paragraph',
          level: 1,
          startPosition: basePosition + lastIndex,
          endPosition: basePosition + match.index,
          children: [],
          content: paragraphContent,
          metadata: this.analyzeStructureMetadata(paragraphContent)
        };

        paragraphs.push(paragraphStructure);
        paragraphIndex++;
      }

      lastIndex = match.index + match[0].length;
    }

    // Add the last paragraph if it exists
    const lastParagraphContent = content.slice(lastIndex).trim();
    if (lastParagraphContent.length > 50) {
      const paragraphStructure: DocumentStructure = {
        type: 'paragraph',
        level: 1,
        startPosition: basePosition + lastIndex,
        endPosition: basePosition + content.length,
        children: [],
        content: lastParagraphContent,
        metadata: this.analyzeStructureMetadata(lastParagraphContent)
      };

      paragraphs.push(paragraphStructure);
    }

    return paragraphs;
  }

  /**
   * Analyze metadata for a structure element
   */
  private analyzeStructureMetadata(content: string): StructureMetadata {
    const hasCode = /```[\s\S]*?```|`[^`]+`/.test(content);
    const hasLists = /^[\s]*[-*+]\s+|^[\s]*\d+\.\s+/m.test(content);
    const hasTables = /\|.*\|/.test(content);
    
    const wordCount = content.split(/\s+/).length;
    const estimatedReadingTime = Math.ceil(wordCount / 200);
    
    let complexity: 'low' | 'medium' | 'high' = 'low';
    const complexityScore = 
      (hasCode ? 2 : 0) + 
      (hasLists ? 1 : 0) + 
      (hasTables ? 1 : 0) + 
      (wordCount > 500 ? 1 : 0);
    
    if (complexityScore >= 3) {complexity = 'high';} else if (complexityScore >= 1) {complexity = 'medium';}

    return {
      elementCount: content.split(/\n\s*\n/).length,
      hasCode,
      hasLists,
      hasTables,
      estimatedReadingTime,
      complexity
    };
  }

  /**
   * Build hierarchy tree based on document structure
   */
  private async buildHierarchyTree(
    content: string,
    documentStructure: DocumentStructure,
    config: ChunkingConfig
  ): Promise<DocumentStructure> {
    log.info('🌳 Building hierarchy tree', LogContext.AI);

    // Apply hierarchy levels configuration
    const maxLevels = config.hierarchyLevels || 3;
    const pruned = this.pruneHierarchyTree(documentStructure, maxLevels);

    // Optimize tree for chunk size constraints
    const optimized = await this.optimizeTreeForChunking(pruned, config);

    log.info('📊 Hierarchy tree built', LogContext.AI, {
      maxDepth: this.calculateTreeDepth(optimized),
      totalNodes: this.countTreeNodes(optimized)
    });

    return optimized;
  }

  /**
   * Prune hierarchy tree to maximum levels
   */
  private pruneHierarchyTree(structure: DocumentStructure, maxLevels: number): DocumentStructure {
    const pruned = { ...structure };
    
    if (structure.level >= maxLevels) { // Levels are 0-indexed, so level 2 means 3 levels (0,1,2)
      pruned.children = [];
    } else {
      pruned.children = structure.children.map(child => 
        this.pruneHierarchyTree(child, maxLevels)
      );
    }

    return pruned;
  }

  /**
   * Optimize tree structure for optimal chunking
   */
  private async optimizeTreeForChunking(
    structure: DocumentStructure,
    config: ChunkingConfig
  ): Promise<DocumentStructure> {
    const optimized = { ...structure };
    
    // Merge small adjacent sections
    optimized.children = await this.mergeSmallSections(structure.children, config);
    
    // Split large sections
    optimized.children = await this.splitLargeSections(optimized.children, config);
    
    // Recursively optimize children
    optimized.children = await Promise.all(
      optimized.children.map(child => 
        this.optimizeTreeForChunking(child, config)
      )
    );

    return optimized;
  }

  /**
   * Merge small adjacent sections
   */
  private async mergeSmallSections(
    sections: DocumentStructure[],
    config: ChunkingConfig
  ): Promise<DocumentStructure[]> {
    const merged: DocumentStructure[] = [];
    let currentMerge: DocumentStructure | null = null;

    for (const section of sections) {
      if (section.content.length < config.minChunkSize) {
        if (currentMerge) {
          // Merge with previous small section
          currentMerge = this.mergeSections(currentMerge, section);
        } else {
          currentMerge = section;
        }
      } else {
        // Section is large enough
        if (currentMerge) {
          merged.push(currentMerge);
          currentMerge = null;
        }
        merged.push(section);
      }
    }

    // Add any remaining merge
    if (currentMerge) {
      merged.push(currentMerge);
    }

    return merged;
  }

  /**
   * Split large sections
   */
  private async splitLargeSections(
    sections: DocumentStructure[],
    config: ChunkingConfig
  ): Promise<DocumentStructure[]> {
    const split: DocumentStructure[] = [];

    for (const section of sections) {
      if (section.content.length > config.maxChunkSize) {
        const subSections = await this.splitSectionByContent(section, config);
        split.push(...subSections);
      } else {
        split.push(section);
      }
    }

    return split;
  }

  /**
   * Split a large section into smaller subsections
   */
  private async splitSectionByContent(
    section: DocumentStructure,
    config: ChunkingConfig
  ): Promise<DocumentStructure[]> {
    const subSections: DocumentStructure[] = [];
    const targetSize = config.maxChunkSize * 0.6; // Be very conservative to ensure chunks fit
    const {content} = section;
    
    // If content is small enough, return as-is
    if (content.length <= targetSize) {
      return [section];
    }
    
    // Try to split by natural boundaries (paragraphs, sentences)
    const paragraphs = content.split(/\n\s*\n/);
    let currentSubSection = '';
    let currentStart = section.startPosition;
    let subSectionIndex = 0;

    for (const paragraph of paragraphs) {
      const potentialLength = currentSubSection.length + paragraph.length + (currentSubSection ? 2 : 0);
      
      if (potentialLength <= targetSize && currentSubSection.length > 0) {
        currentSubSection += '\n\n' + paragraph;
      } else {
        // Create subsection from current content if it exists
        if (currentSubSection.length > 0) {
          const subSection: DocumentStructure = {
            type: 'subsection',
            level: section.level + 1,
            title: `${section.title || 'Section'} - Part ${subSectionIndex + 1}`,
            startPosition: currentStart,
            endPosition: currentStart + currentSubSection.length,
            children: [],
            content: currentSubSection,
            metadata: this.analyzeStructureMetadata(currentSubSection)
          };

          subSections.push(subSection);
          currentStart += currentSubSection.length + 2; // +2 for paragraph separator
          subSectionIndex++;
        }

        // If the paragraph itself is too large, split it immediately
        if (paragraph.length > targetSize) {
          const sentenceParts = this.splitBySentences(paragraph, targetSize);
          for (const part of sentenceParts) {
            const subSection: DocumentStructure = {
              type: 'subsection',
              level: section.level + 1,
              title: `${section.title || 'Section'} - Part ${subSectionIndex + 1}`,
              startPosition: currentStart,
              endPosition: currentStart + part.length,
              children: [],
              content: part,
              metadata: this.analyzeStructureMetadata(part)
            };

            subSections.push(subSection);
            currentStart += part.length;
            subSectionIndex++;
          }
          currentSubSection = '';
        } else {
          // Start new subsection with current paragraph
          currentSubSection = paragraph;
        }
      }
    }

    // Add the last subsection
    if (currentSubSection.length > 0) {
      const subSection: DocumentStructure = {
        type: 'subsection',
        level: section.level + 1,
        title: `${section.title || 'Section'} - Part ${subSectionIndex + 1}`,
        startPosition: currentStart,
        endPosition: section.endPosition,
        children: [],
        content: currentSubSection,
        metadata: this.analyzeStructureMetadata(currentSubSection)
      };

      subSections.push(subSection);
    }

    return subSections.length > 0 ? subSections : [section];
  }

  /**
   * Split content by sentences when paragraphs are too large
   */
  private splitBySentences(content: string, maxSize: number): string[] {
    const parts: string[] = [];
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    let currentPart = '';

    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      if (!trimmedSentence) {continue;}
      
      const potentialLength = currentPart.length + trimmedSentence.length + (currentPart ? 2 : 0);
      
      if (potentialLength <= maxSize) {
        currentPart += (currentPart ? '. ' : '') + trimmedSentence + '.';
      } else {
        if (currentPart) {
          parts.push(currentPart);
        }
        
        // If a single sentence is too large, just add it anyway
        currentPart = trimmedSentence + '.';
      }
    }

    if (currentPart) {
      parts.push(currentPart);
    }

    return parts.length > 0 ? parts : [content];
  }

  /**
   * Create hierarchical chunks from the optimized tree
   */
  private async createHierarchicalChunks(
    hierarchyTree: DocumentStructure,
    documentId: string,
    config: ChunkingConfig
  ): Promise<Chunk[]> {
    log.info('📦 Creating hierarchical chunks', LogContext.AI);

    const chunks: Chunk[] = [];
    const chunkQueue: Array<{ structure: DocumentStructure; path: string }> = [
      { structure: hierarchyTree, path: '' }
    ];

    while (chunkQueue.length > 0) {
      const queueItem = chunkQueue.shift();
      if (!queueItem) {continue;}
      const { structure, path } = queueItem;
      const chunkPath = path ? `${path}_${structure.type}` : structure.type;
      
      // Check if structure content is too large and needs further splitting
      const structureContentSize = structure.content.length;
      
      if (structureContentSize > config.maxChunkSize) {
        // Force split this structure's content at the chunk level
        const finalParts = this.splitBySentences(structure.content, config.maxChunkSize * 0.8);
        let partPosition = structure.startPosition;
        
        for (let i = 0; i < finalParts.length; i++) {
          const part = finalParts[i];
          if (!part) {continue;}
          
          const chunk: Chunk = {
            id: `${documentId}_${chunkPath}_${chunks.length}_part_${i}`,
            content: part,
            startPosition: partPosition,
            endPosition: partPosition + part.length,
            level: structure.level,
            childChunkIds: [],
            metadata: {
              sourceDocumentId: documentId,
              sourceType: 'hierarchical',
              createdAt: new Date(),
              version: 1,
              semanticScore: 0.7,
              topicTransitions: [],
              structuralElements: [],
              overlaps: []
            },
            contentType: this.inferContentType(part),
            tokenCount: Math.ceil(part.length / 4),
            hash: this.generateHash(part)
          };
          
          chunks.push(chunk);
          partPosition += part.length;
        }
      } else {
        // Create normal chunk for this structure level
        const chunk: Chunk = {
          id: `${documentId}_${chunkPath}_${chunks.length}`,
          content: structure.content,
          startPosition: structure.startPosition,
          endPosition: structure.endPosition,
          level: structure.level,
          childChunkIds: [],
          metadata: {
            sourceDocumentId: documentId,
          sourceType: 'hierarchical',
          createdAt: new Date(),
          version: 1,
          semanticScore: this.calculateSemanticScore(structure),
          topicTransitions: [],
          structuralElements: this.extractStructuralElements(structure),
          overlaps: []
        },
        contentType: this.inferContentType(structure.content),
        tokenCount: Math.ceil(structure.content.length / 4),
        hash: this.generateHash(structure.content)
      };

      chunks.push(chunk);
      }

      // Add children to queue
      for (let i = 0; i < structure.children.length; i++) {
        const child = structure.children[i];
        if (child) {
          chunkQueue.push({
            structure: child,
            path: chunkPath
          });
        }
      }
    }

    log.info('📊 Hierarchical chunks created', LogContext.AI, {
      totalChunks: chunks.length,
      averageChunkSize: chunks.reduce((sum, c) => sum + c.content.length, 0) / chunks.length
    });

    return chunks;
  }

  /**
   * Infer content type from content
   */
  private inferContentType(content: string): 'prose' | 'code' | 'mixed' {
    const codeIndicators = /```|`[^`]+`|function\s+\w+|class\s+\w+|import\s+|export\s+|def\s+\w+|const\s+\w+|let\s+\w+|var\s+\w+|\{|\}|;$/gm;
    const codeMatches = content.match(codeIndicators) || [];
    const lines = content.split('\n').length;
    const codeRatio = codeMatches.length / lines;
    
    if (codeRatio > 0.5 || content.includes('```')) {return 'code';}
    if (codeRatio > 0.1) {return 'mixed';}
    return 'prose';
  }

  /**
   * Generate a hash for content
   */
  private generateHash(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Establish parent-child relationships between chunks
   */
  private async establishRelationships(chunks: Chunk[]): Promise<Chunk[]> {
    log.info('🔗 Establishing chunk relationships', LogContext.AI);

    const linkedChunks = chunks.map(chunk => ({ ...chunk }));

    // Sort chunks by level and position
    linkedChunks.sort((a, b) => {
      if (a.level !== b.level) {return a.level - b.level;}
      return a.startPosition - b.startPosition;
    });

    // Establish parent-child relationships
    for (let i = 0; i < linkedChunks.length; i++) {
      const chunk = linkedChunks[i];
      if (!chunk) {continue;}
      
      // Find parent chunk (closest ancestor at level - 1)
      for (let j = i - 1; j >= 0; j--) {
        const potentialParent = linkedChunks[j];
        if (!potentialParent) {continue;}
        
        if (potentialParent.level === chunk.level - 1 &&
            potentialParent.startPosition <= chunk.startPosition &&
            potentialParent.endPosition >= chunk.endPosition) {
          
          chunk.parentChunkId = potentialParent.id;
          potentialParent.childChunkIds.push(chunk.id);
          break;
        }
      }
    }

    const relationshipsEstablished = linkedChunks.filter(c => c.parentChunkId).length;
    log.info('✅ Chunk relationships established', LogContext.AI, {
      totalRelationships: relationshipsEstablished
    });

    return linkedChunks;
  }

  /**
   * Optimize hierarchy for better retrieval performance
   */
  private async optimizeHierarchy(chunks: Chunk[], config: ChunkingConfig): Promise<Chunk[]> {
    log.info('🔧 Optimizing hierarchy for retrieval', LogContext.AI);

    // Create summary chunks for large parent chunks
    const optimizedChunks = [...chunks];
    
    for (const chunk of chunks) {
      if (chunk.childChunkIds.length > 0 && chunk.content.length > config.maxChunkSize) {
        // Create a summary chunk
        const summaryContent = this.createChunkSummary(chunk, chunks);
        
        const summaryChunk: Chunk = {
          id: `${chunk.id}_summary`,
          content: summaryContent,
          startPosition: chunk.startPosition,
          endPosition: chunk.startPosition + summaryContent.length,
          level: chunk.level,
          parentChunkId: chunk.parentChunkId,
          childChunkIds: [],
          metadata: {
            ...chunk.metadata,
            sourceType: 'hierarchical_summary'
          },
          contentType: config.contentType,
          tokenCount: Math.ceil(summaryContent.length / 4),
          hash: this.generateChunkHash(summaryContent)
        };

        optimizedChunks.push(summaryChunk);
      }
    }

    log.info('✅ Hierarchy optimization completed', LogContext.AI, {
      originalChunks: chunks.length,
      optimizedChunks: optimizedChunks.length
    });

    return optimizedChunks;
  }

  // Utility methods

  private mergeSections(section1: DocumentStructure, section2: DocumentStructure): DocumentStructure {
    return {
      type: section1.type,
      level: section1.level,
      title: `${section1.title || ''} & ${section2.title || ''}`,
      startPosition: section1.startPosition,
      endPosition: section2.endPosition,
      children: [...section1.children, ...section2.children],
      content: section1.content + '\n\n' + section2.content,
      metadata: {
        elementCount: section1.metadata.elementCount + section2.metadata.elementCount,
        hasCode: section1.metadata.hasCode || section2.metadata.hasCode,
        hasLists: section1.metadata.hasLists || section2.metadata.hasLists,
        hasTables: section1.metadata.hasTables || section2.metadata.hasTables,
        estimatedReadingTime: section1.metadata.estimatedReadingTime + section2.metadata.estimatedReadingTime,
        complexity: section1.metadata.complexity === 'high' || section2.metadata.complexity === 'high' ? 'high' : 'medium'
      }
    };
  }

  private calculateTreeDepth(structure: DocumentStructure): number {
    if (structure.children.length === 0) {return structure.level;}
    return Math.max(...structure.children.map(child => this.calculateTreeDepth(child)));
  }

  private countTreeNodes(structure: DocumentStructure): number {
    return 1 + structure.children.reduce((sum, child) => sum + this.countTreeNodes(child), 0);
  }

  private calculateSemanticScore(structure: DocumentStructure): number {
    // Calculate semantic coherence based on structure properties
    let score = 0.5; // Base score

    // Bonus for having a clear title
    if (structure.title) {score += 0.2;}

    // Bonus for appropriate length
    if (structure.content.length > 100 && structure.content.length < 2000) {score += 0.1;}

    // Bonus for structured content
    if (structure.metadata.hasCode || structure.metadata.hasLists || structure.metadata.hasTables) {
      score += 0.1;
    }

    // Penalty for very complex content
    if (structure.metadata.complexity === 'high') {score -= 0.1;}

    return Math.max(0, Math.min(1, score));
  }

  private extractStructuralElements(structure: DocumentStructure): StructuralElement[] {
    const elements: StructuralElement[] = [];

    // Add heading element if title exists
    if (structure.title) {
      elements.push({
        type: 'heading',
        level: structure.level,
        position: structure.startPosition,
        length: structure.title.length,
        content: structure.title
      });
    }

    // Extract other structural elements from content
    const {content} = structure;

    // Find code blocks
    const codeBlockRegex = /```[\s\S]*?```/g;
    let match;
    while ((match = codeBlockRegex.exec(content)) !== null) {
      elements.push({
        type: 'code_block',
        level: 0,
        position: structure.startPosition + match.index,
        length: match[0].length,
        content: match[0]
      });
    }

    // Find lists
    const listRegex = /^[\s]*[-*+]\s+.*/gm;
    while ((match = listRegex.exec(content)) !== null) {
      elements.push({
        type: 'list',
        level: 0,
        position: structure.startPosition + match.index,
        length: match[0].length,
        content: match[0]
      });
    }

    return elements;
  }

  private createChunkSummary(chunk: Chunk, allChunks: Chunk[]): string {
    const childChunks = allChunks.filter(c => chunk.childChunkIds.includes(c.id));
    
    let summary = `Summary of ${chunk.metadata.structuralElements.find(e => e.type === 'heading')?.content || 'section'}:\n\n`;
    
    childChunks.forEach((child, index) => {
      if (!child) {return;}
      const firstSentence = child.content.split(/[.!?]+/)[0]?.trim();
      if (firstSentence && firstSentence.length > 10) {
        summary += `${index + 1}. ${firstSentence}.\n`;
      }
    });

    return summary;
  }

  private generateChunkHash(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }
}