/**
 * LLM-based Entity Extractor for Graph-R1
 * 
 * Implements actual LLM-based entity and relation extraction
 * for the Graph-R1 knowledge graph system.
 */

import axios from 'axios';

import { log, LogContext } from '../../utils/logger';
import { generateEmbedding } from '../embeddings';

export interface ExtractedEntity {
  text: string;
  type: EntityType;
  properties: Record<string, any>;
  confidence: number;
  context: string;
  position?: { start: number; end: number };
}

export interface ExtractedRelation {
  source: string;
  target: string;
  type: string;
  properties: Record<string, any>;
  confidence: number;
  isNary?: boolean;
  participants?: string[]; // For n-ary relations
}

export enum EntityType {
  PERSON = 'person',
  ORGANIZATION = 'organization',
  LOCATION = 'location',
  DATE = 'date',
  TECHNOLOGY = 'technology',
  CONCEPT = 'concept',
  PRODUCT = 'product',
  EVENT = 'event',
  METHOD = 'method',
  METRIC = 'metric',
  SYSTEM = 'system',
  UNKNOWN = 'unknown'
}

export class LLMEntityExtractor {
  private readonly ollamaUrl: string;
  private readonly defaultModel = 'tinyllama:latest';
  private readonly largeModel = 'gpt-oss:20b'; // For complex extraction
  private readonly maxInputLength = 8000; // SECURITY: Limit input size
  private readonly maxContextLength = 2000; // SECURITY: Limit context window

  constructor(ollamaUrl = 'http://localhost:11434') {
    this.ollamaUrl = ollamaUrl;
  }

  /**
   * SECURITY: Sanitize and validate input text to prevent prompt injection
   */
  private sanitizeInput(text: string, maxLength: number = this.maxInputLength): string {
    if (!text || typeof text !== 'string') {
      throw new Error('Invalid input: text must be a non-empty string');
    }

    // Remove potential prompt injection patterns
    let sanitized = text
      .replace(/```[\s\S]*?```/g, '[CODE_BLOCK]') // Remove code blocks
      .replace(/\[INST\]|\[\/INST\]/g, '') // Remove instruction markers
      .replace(/<\|.*?\|>/g, '') // Remove special tokens
      .replace(/System:|Assistant:|Human:/gi, '[ROLE]') // Remove role indicators
      .replace(/\n{3,}/g, '\n\n') // Limit consecutive newlines
      .trim();

    // Limit length to prevent DoS
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength) + '[TRUNCATED]';
    }

    // Additional validation
    if (sanitized.length === 0) {
      throw new Error('Input text is empty after sanitization');
    }

    return sanitized;
  }

  /**
   * SECURITY: Escape special characters for JSON context
   */
  private escapeForJSON(text: string): string {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
  }

  /**
   * SECURITY: Validate entity extraction parameters
   */
  private validateExtractionParams(options: {
    model?: string;
    maxEntities?: number;
    includeEmbeddings?: boolean;
  }): void {
    if (options.maxEntities && (options.maxEntities < 1 || options.maxEntities > 100)) {
      throw new Error('maxEntities must be between 1 and 100');
    }
    
    if (options.model && !/^[a-zA-Z0-9:\-_.]+$/.test(options.model)) {
      throw new Error('Invalid model name format');
    }
  }

  /**
   * OPTIMIZATION: Extract entities with parallel batch processing
   */
  async extractEntities(
    text: string,
    options: {
      model?: string;
      maxEntities?: number;
      includeEmbeddings?: boolean;
      batchSize?: number;
      parallelRequests?: number;
    } = {}
  ): Promise<ExtractedEntity[]> {
    // SECURITY: Validate parameters
    this.validateExtractionParams(options);
    
    const model = options.model || this.defaultModel;
    const maxEntities = Math.min(options.maxEntities || 50, 100);
    const batchSize = options.batchSize || 2000; // Process text in chunks
    const parallelRequests = Math.min(options.parallelRequests || 3, 5); // Limit concurrency

    try {
      // SECURITY: Sanitize input text
      const sanitizedText = this.sanitizeInput(text, this.maxInputLength);
      
      // OPTIMIZATION: Split large texts into chunks for parallel processing
      const textChunks = this.splitTextIntoChunks(sanitizedText, batchSize);
      
      if (textChunks.length === 1) {
        // Single chunk - process normally
        const chunk = textChunks[0];
        if (!chunk) throw new Error('Empty text chunk');
        return await this.extractEntitiesFromChunk(chunk, model, maxEntities, options.includeEmbeddings);
      }
      
      // OPTIMIZATION: Parallel processing of chunks
      const chunkPromises: Promise<ExtractedEntity[]>[] = [];
      const semaphore = this.createSemaphore(parallelRequests);
      
      for (const chunk of textChunks) {
        const promise = semaphore.acquire().then(async (release) => {
          try {
            return await this.extractEntitiesFromChunk(
              chunk, 
              model, 
              Math.ceil(maxEntities / textChunks.length),
              false // Don't generate embeddings in parallel phase
            );
          } finally {
            release();
          }
        });
        chunkPromises.push(promise);
      }
      
      // Wait for all chunks to complete
      const chunkResults = await Promise.all(chunkPromises);
      
      // OPTIMIZATION: Merge and deduplicate results
      const allEntities = this.mergeAndDeduplicateEntities(chunkResults, maxEntities);
      
      // OPTIMIZATION: Generate embeddings in parallel if requested
      if (options.includeEmbeddings) {
        await this.addEmbeddingsInParallel(allEntities, parallelRequests);
      }

      log.info(`Extracted ${allEntities.length} entities using parallel LLM processing`, LogContext.AI, {
        model,
        chunks: textChunks.length,
        parallelRequests,
        originalTextLength: text.length,
        entityCount: allEntities.length
      });

      return allEntities;
    } catch (error) {
      log.error('Parallel LLM entity extraction failed', LogContext.AI, { error });
      // Fallback to regex-based extraction
      const sanitizedText = this.sanitizeInput(text, this.maxContextLength);
      return this.fallbackEntityExtraction(sanitizedText);
    }
  }

  /**
   * Extract n-ary relations using LLM
   */
  async extractRelations(
    text: string,
    entities: ExtractedEntity[],
    options: {
      model?: string;
      includeNary?: boolean;
    } = {}
  ): Promise<ExtractedRelation[]> {
    // SECURITY: Validate inputs
    if (!Array.isArray(entities) || entities.length === 0) {
      throw new Error('Invalid entities: must be a non-empty array');
    }
    
    const model = options.model || this.defaultModel;
    const includeNary = options.includeNary !== false;

    try {
      // SECURITY: Sanitize input text
      const sanitizedText = this.sanitizeInput(text, this.maxContextLength);
      const escapedText = this.escapeForJSON(sanitizedText);
      
      // SECURITY: Sanitize entity list
      const sanitizedEntities = entities
        .slice(0, 50) // Limit to 50 entities max
        .map(e => this.escapeForJSON(e.text.substring(0, 100))) // Limit entity text length
        .join(', ');
      
      const prompt = `You are a relation extraction system. Given the text and list of entities, extract all relationships between them.

Entities found: ${sanitizedEntities}

For each relation, provide:
1. Source entity
2. Target entity (or multiple targets for n-ary relations)
3. Relation type (e.g., "works_for", "located_in", "implements", "depends_on", "collaborates_with")
4. Confidence score (0.0 to 1.0)
${includeNary ? '5. For n-ary relations, list all participants' : ''}

Format as JSON array:
[{"source": "entity1", "target": "entity2", "type": "relation_type", "confidence": 0.9}]
${includeNary ? 'For n-ary: {"participants": ["e1", "e2", "e3"], "type": "collaborates", "isNary": true}' : ''}

==== TEXT TO ANALYZE ====
"${escapedText}"
==== END TEXT ====

Extract relations:`;

      const response = await this.callOllama(prompt, model);
      const relations = this.parseRelationResponse(response, entities);

      log.info(`Extracted ${relations.length} relations using LLM`, LogContext.AI, {
        model,
        relationCount: relations.length,
        naryCount: relations.filter(r => r.isNary).length
      });

      return relations;
    } catch (error) {
      log.error('LLM relation extraction failed', LogContext.AI, { error });
      const sanitizedText = this.sanitizeInput(text, this.maxContextLength);
      return this.fallbackRelationExtraction(sanitizedText, entities);
    }
  }

  /**
   * Extract knowledge graph triplets for hypergraph construction
   */
  async extractTriplets(
    text: string,
    options: {
      model?: string;
      maxTriplets?: number;
    } = {}
  ): Promise<Array<{ subject: string; predicate: string; object: string; confidence: number }>> {
    const model = options.model || this.largeModel; // Use larger model for better understanding
    const maxTriplets = options.maxTriplets || 30;

    try {
      const prompt = `Extract knowledge graph triplets from the following text. Each triplet should be in the form (subject, predicate, object).

Examples:
- (GraphRAG, uses, reinforcement learning)
- (Neo4j, stores, graph data)
- (Entity extraction, requires, LLM)

Format as JSON array:
[{"subject": "...", "predicate": "...", "object": "...", "confidence": 0.9}]

Text:
"${text.substring(0, 1500)}"

Extract up to ${maxTriplets} triplets:`;

      const response = await this.callOllama(prompt, model);
      const triplets = this.parseTripletResponse(response);

      log.info(`Extracted ${triplets.length} triplets`, LogContext.AI, {
        model,
        tripletCount: triplets.length
      });

      return triplets;
    } catch (error) {
      log.error('Triplet extraction failed', LogContext.AI, { error });
      return [];
    }
  }

  /**
   * Perform reasoning query for Graph-R1's think-retrieve-rethink cycle
   */
  async performReasoning(
    query: string,
    context: string[],
    previousThoughts: string[] = [],
    options: {
      model?: string;
      temperature?: number;
    } = {}
  ): Promise<{
    thought: string;
    nextQuery?: string;
    confidence: number;
    shouldRetrieve: boolean;
  }> {
    const model = options.model || this.largeModel;
    const temperature = options.temperature || 0.7;

    try {
      const contextStr = context.join('\n');
      const thoughtHistory = previousThoughts.join('\n');

      const prompt = `You are a reasoning agent in a Graph-R1 system. Given a query and context, perform reasoning to determine the next action.

Query: ${query}

Current Context:
${contextStr}

Previous Thoughts:
${thoughtHistory}

Based on the above, provide:
1. Your current thought/reasoning
2. Whether more information is needed (true/false)
3. If needed, what specific information to retrieve next
4. Confidence in your current understanding (0.0 to 1.0)

Format as JSON:
{"thought": "...", "shouldRetrieve": true/false, "nextQuery": "...", "confidence": 0.8}

Your reasoning:`;

      const response = await this.callOllama(prompt, model, temperature);
      const reasoning = this.parseReasoningResponse(response);

      log.info('Reasoning step completed', LogContext.AI, {
        shouldRetrieve: reasoning.shouldRetrieve,
        confidence: reasoning.confidence
      });

      return reasoning;
    } catch (error) {
      log.error('Reasoning step failed', LogContext.AI, { error });
      return {
        thought: 'Unable to perform reasoning',
        confidence: 0,
        shouldRetrieve: false
      };
    }
  }

  /**
   * Call Ollama API
   */
  private async callOllama(
    prompt: string,
    model: string,
    temperature = 0.3
  ): Promise<string> {
    try {
      const response = await axios.post(`${this.ollamaUrl}/api/generate`, {
        model,
        prompt,
        temperature,
        stream: false,
        format: 'json' // Request JSON format when possible
      }, {
        timeout: 30000 // 30 second timeout
      });

      return response.data.response || '';
    } catch (error) {
      if (axios.isAxiosError(error)) {
        log.error('Ollama API error', LogContext.AI, {
          status: error.response?.status,
          message: error.message
        });
      }
      throw error;
    }
  }

  /**
   * Parse entity extraction response
   */
  private parseEntityResponse(response: string, originalText: string): ExtractedEntity[] {
    try {
      // Try to parse as JSON first
      const parsed = JSON.parse(response);
      if (Array.isArray(parsed)) {
        return parsed.map(entity => ({
          text: entity.text || entity.name || '',
          type: this.normalizeEntityType(entity.type),
          confidence: entity.confidence || 0.8,
          properties: entity.properties || {},
          context: originalText.substring(0, 100)
        })).filter(e => e.text.length > 0);
      }
    } catch {
      // If JSON parsing fails, try to extract from text
      log.warn('Failed to parse entity JSON, attempting text extraction', LogContext.AI);
    }

    // Fallback parsing from text
    const entities: ExtractedEntity[] = [];
    const lines = response.split('\n');
    
    for (const line of lines) {
      const entityMatch = line.match(/["']([^"']+)["']\s*(?::|,)?\s*["']?(\w+)["']?/);
      if (entityMatch && entityMatch[1] && entityMatch[2]) {
        entities.push({
          text: entityMatch[1],
          type: this.normalizeEntityType(entityMatch[2]),
          confidence: 0.7,
          properties: {},
          context: originalText.substring(0, 100)
        });
      }
    }

    return entities;
  }

  /**
   * Parse relation extraction response
   */
  private parseRelationResponse(response: string, entities: ExtractedEntity[]): ExtractedRelation[] {
    try {
      const parsed = JSON.parse(response);
      if (Array.isArray(parsed)) {
        return parsed.map(rel => {
          if (rel.isNary && rel.participants) {
            return {
              source: rel.participants[0] || '',
              target: rel.participants[1] || '',
              type: rel.type || 'related_to',
              confidence: rel.confidence || 0.7,
              isNary: true,
              participants: rel.participants,
              properties: rel.properties || {}
            };
          }
          return {
            source: rel.source || '',
            target: rel.target || '',
            type: rel.type || 'related_to',
            confidence: rel.confidence || 0.7,
            properties: rel.properties || {}
          };
        }).filter(r => r.source && (r.target || r.participants));
      }
    } catch {
      log.warn('Failed to parse relation JSON', LogContext.AI);
    }

    return [];
  }

  /**
   * Parse triplet response
   */
  private parseTripletResponse(response: string): Array<{ subject: string; predicate: string; object: string; confidence: number }> {
    try {
      const parsed = JSON.parse(response);
      if (Array.isArray(parsed)) {
        return parsed.map(t => ({
          subject: t.subject || '',
          predicate: t.predicate || t.relation || '',
          object: t.object || '',
          confidence: t.confidence || 0.8
        })).filter(t => t.subject && t.predicate && t.object);
      }
    } catch {
      log.warn('Failed to parse triplet JSON', LogContext.AI);
    }

    return [];
  }

  /**
   * Parse reasoning response
   */
  private parseReasoningResponse(response: string): {
    thought: string;
    nextQuery?: string;
    confidence: number;
    shouldRetrieve: boolean;
  } {
    try {
      const parsed = JSON.parse(response);
      return {
        thought: parsed.thought || 'Processing...',
        nextQuery: parsed.nextQuery,
        confidence: parsed.confidence || 0.5,
        shouldRetrieve: parsed.shouldRetrieve || false
      };
    } catch {
      // Extract from text if JSON fails
      return {
        thought: response.substring(0, 200),
        confidence: 0.5,
        shouldRetrieve: response.toLowerCase().includes('need') || response.toLowerCase().includes('retrieve')
      };
    }
  }

  /**
   * Normalize entity type to enum
   */
  private normalizeEntityType(type: string): EntityType {
    const normalized = type.toLowerCase().trim();
    const typeMap: Record<string, EntityType> = {
      'person': EntityType.PERSON,
      'people': EntityType.PERSON,
      'organization': EntityType.ORGANIZATION,
      'org': EntityType.ORGANIZATION,
      'company': EntityType.ORGANIZATION,
      'location': EntityType.LOCATION,
      'place': EntityType.LOCATION,
      'date': EntityType.DATE,
      'time': EntityType.DATE,
      'technology': EntityType.TECHNOLOGY,
      'tech': EntityType.TECHNOLOGY,
      'concept': EntityType.CONCEPT,
      'idea': EntityType.CONCEPT,
      'product': EntityType.PRODUCT,
      'event': EntityType.EVENT,
      'method': EntityType.METHOD,
      'algorithm': EntityType.METHOD,
      'metric': EntityType.METRIC,
      'measure': EntityType.METRIC,
      'system': EntityType.SYSTEM
    };

    return typeMap[normalized] || EntityType.UNKNOWN;
  }

  /**
   * Fallback entity extraction using patterns
   */
  private fallbackEntityExtraction(text: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];
    
    // Technology patterns
    const techPattern = /\b(GraphRAG|Neo4j|LLM|GRPO|PPO|REINFORCE|React|Vue|Node\.js|Python|TypeScript|JavaScript)\b/gi;
    const techMatches = text.matchAll(techPattern);
    
    for (const match of techMatches) {
      if (match[1]) {
        entities.push({
          text: match[1],
        type: EntityType.TECHNOLOGY,
        confidence: 0.6,
        properties: {},
        context: text.substring(Math.max(0, match.index! - 50), match.index! + 50)
        });
      }
    }

    // Deduplicate
    const seen = new Set<string>();
    return entities.filter(e => {
      if (seen.has(e.text.toLowerCase())) return false;
      seen.add(e.text.toLowerCase());
      return true;
    });
  }

  /**
   * Fallback relation extraction
   */
  private fallbackRelationExtraction(text: string, entities: ExtractedEntity[]): ExtractedRelation[] {
    const relations: ExtractedRelation[] = [];
    const entityNames = entities.map(e => e.text.toLowerCase());

    // Simple pattern matching for relations
    const patterns = [
      { regex: /(\w+)\s+uses?\s+(\w+)/gi, type: 'uses' },
      { regex: /(\w+)\s+implements?\s+(\w+)/gi, type: 'implements' },
      { regex: /(\w+)\s+requires?\s+(\w+)/gi, type: 'requires' },
      { regex: /(\w+)\s+depends?\s+on\s+(\w+)/gi, type: 'depends_on' }
    ];

    for (const pattern of patterns) {
      const matches = text.matchAll(pattern.regex);
      for (const match of matches) {
        if (match[1] && match[2] &&
            entityNames.includes(match[1].toLowerCase()) && 
            entityNames.includes(match[2].toLowerCase())) {
          relations.push({
            source: match[1],
            target: match[2],
            type: pattern.type,
            confidence: 0.5,
            properties: {}
          });
        }
      }
    }

    return relations;
  }

  /**
   * OPTIMIZATION: Split text into chunks for parallel processing
   */
  private splitTextIntoChunks(text: string, chunkSize: number): string[] {
    if (text.length <= chunkSize) {
      return [text];
    }

    const chunks: string[] = [];
    const sentences = text.split(/[.!?]+/);
    let currentChunk = '';

    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length <= chunkSize) {
        currentChunk += sentence + '.';
      } else {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = sentence + '.';
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * OPTIMIZATION: Process single text chunk
   */
  private async extractEntitiesFromChunk(
    text: string,
    model: string,
    maxEntities: number,
    includeEmbeddings?: boolean
  ): Promise<ExtractedEntity[]> {
    const escapedText = this.escapeForJSON(text);

    const prompt = `You are an entity extraction system. Extract all important entities from the following text.

For each entity, provide:
1. The entity text (exact as it appears)
2. The entity type (person, organization, location, technology, concept, product, event, method, metric, system)
3. A confidence score (0.0 to 1.0)
4. Any relevant properties

Format your response as JSON array:
[{"text": "entity_name", "type": "entity_type", "confidence": 0.9, "properties": {}}]

==== TEXT TO ANALYZE ====
"${escapedText}"
==== END TEXT ====

Extract entities (maximum ${maxEntities}):`;

    const response = await this.callOllama(prompt, model);
    const entities = this.parseEntityResponse(response, text);

    if (includeEmbeddings) {
      for (const entity of entities) {
        try {
          const embedding = await generateEmbedding(entity.text);
          entity.properties = { ...entity.properties, embedding };
        } catch (embeddingError) {
          log.warn('Failed to generate embedding for entity', LogContext.AI, {
            entityText: entity.text,
            error: embeddingError
          });
        }
      }
    }

    return entities;
  }

  /**
   * OPTIMIZATION: Merge and deduplicate entities from multiple chunks
   */
  private mergeAndDeduplicateEntities(
    chunkResults: ExtractedEntity[][],
    maxEntities: number
  ): ExtractedEntity[] {
    const entityMap = new Map<string, ExtractedEntity>();
    
    for (const entities of chunkResults) {
      for (const entity of entities) {
        const key = entity.text.toLowerCase();
        const existing = entityMap.get(key);
        
        if (!existing || entity.confidence > existing.confidence) {
          entityMap.set(key, entity);
        }
      }
    }

    // Sort by confidence and limit results
    return Array.from(entityMap.values())
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, maxEntities);
  }

  /**
   * OPTIMIZATION: Add embeddings to entities in parallel
   */
  private async addEmbeddingsInParallel(
    entities: ExtractedEntity[],
    parallelRequests: number
  ): Promise<void> {
    const semaphore = this.createSemaphore(parallelRequests);
    
    const embeddingPromises = entities.map(entity => 
      semaphore.acquire().then(async (release) => {
        try {
          const embedding = await generateEmbedding(entity.text);
          entity.properties = { ...entity.properties, embedding };
        } catch (embeddingError) {
          log.warn('Failed to generate embedding for entity', LogContext.AI, {
            entityText: entity.text,
            error: embeddingError
          });
        } finally {
          release();
        }
      })
    );
    
    await Promise.all(embeddingPromises);
  }

  /**
   * OPTIMIZATION: Create semaphore for concurrency control
   */
  private createSemaphore(maxConcurrency: number) {
    let currentCount = 0;
    const queue: Array<() => void> = [];

    return {
      acquire: (): Promise<() => void> => {
        return new Promise((resolve) => {
          const release = () => {
            currentCount--;
            if (queue.length > 0) {
              const next = queue.shift()!;
              next();
            }
          };

          if (currentCount < maxConcurrency) {
            currentCount++;
            resolve(release);
          } else {
            queue.push(() => {
              currentCount++;
              resolve(release);
            });
          }
        });
      }
    };
  }
}

// Export singleton instance
export const llmEntityExtractor = new LLMEntityExtractor();