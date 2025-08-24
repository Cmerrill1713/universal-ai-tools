/**
 * Entity Extractor Service
 * 
 * Advanced entity extraction using LLMs for GraphRAG.
 * Extracts entities, their types, and properties from text using
 * local LLMs (Ollama) for cost-efficiency.
 */

import axios from 'axios';

import { log, LogContext } from '../../utils/logger';
import { generateEmbedding } from '../embeddings';
import type { GraphEntity } from './knowledge-graph-service';

export interface EntityExtractionOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  includeEmbeddings?: boolean;
  contextWindow?: number;
}

export interface ExtractedEntity {
  text: string;
  type: EntityType;
  confidence: number;
  properties: Record<string, any>;
  position: { start: number; end: number };
  context?: string;
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
  CODE_ENTITY = 'code_entity',
  API_ENDPOINT = 'api_endpoint',
  DATABASE = 'database',
  FRAMEWORK = 'framework',
  UNKNOWN = 'unknown'
}

export class EntityExtractor {
  private readonly ollamaEndpoint: string;
  private readonly defaultModel = 'tinyllama:latest';
  private readonly entityTypePatterns: Map<EntityType, RegExp[]>;
  
  constructor() {
    this.ollamaEndpoint = process.env.OLLAMA_ENDPOINT || 'http://localhost:11434';
    this.entityTypePatterns = this.initializePatterns();
  }

  private initializePatterns(): Map<EntityType, RegExp[]> {
    const patterns = new Map<EntityType, RegExp[]>();
    
    // Person patterns
    patterns.set(EntityType.PERSON, [
      /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g, // Full names
      /\b(?:Mr\.|Mrs\.|Ms\.|Dr\.|Prof\.)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g, // With titles
    ]);
    
    // Organization patterns
    patterns.set(EntityType.ORGANIZATION, [
      /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+(?:Inc|Corp|LLC|Ltd|Company|Group|Foundation|Institute|University|College)\.?))\b/g,
      /\b(Google|Microsoft|Apple|Amazon|Meta|OpenAI|Anthropic|IBM|Oracle|Tesla|SpaceX)\b/gi,
    ]);
    
    // Technology patterns
    patterns.set(EntityType.TECHNOLOGY, [
      /\b(React|Vue|Angular|Next\.js|Node\.js|TypeScript|JavaScript|Python|Java|C\+\+|Rust|Go|Swift|Kotlin)\b/gi,
      /\b(Docker|Kubernetes|AWS|Azure|GCP|GraphQL|REST|API|MySQL|PostgreSQL|MongoDB|Redis)\b/gi,
      /\b(AI|ML|LLM|NLP|GPT|BERT|GraphRAG|RAG|embedding|vector|transformer)\b/gi,
    ]);
    
    // Framework patterns
    patterns.set(EntityType.FRAMEWORK, [
      /\b(Express|FastAPI|Django|Flask|Rails|Spring|Laravel|Symfony)\b/gi,
      /\b(TensorFlow|PyTorch|Keras|scikit-learn|pandas|NumPy)\b/gi,
    ]);
    
    // Concept patterns
    patterns.set(EntityType.CONCEPT, [
      /\b(machine learning|deep learning|neural network|natural language processing|computer vision)\b/gi,
      /\b(microservices|serverless|cloud computing|DevOps|CI\/CD|agile|scrum)\b/gi,
      /\b(authentication|authorization|encryption|security|performance|optimization|scalability)\b/gi,
    ]);
    
    return patterns;
  }

  /**
   * Extract entities using LLM
   */
  public async extractWithLLM(
    text: string,
    options: EntityExtractionOptions = {}
  ): Promise<ExtractedEntity[]> {
    const {
      model = this.defaultModel,
      maxTokens = 1000,
      temperature = 0.3,
      includeEmbeddings = false,
    } = options;
    
    try {
      // Prepare prompt for entity extraction
      const prompt = this.buildExtractionPrompt(text);
      
      // Call Ollama API
      const response = await axios.post(`${this.ollamaEndpoint}/api/generate`, {
        model,
        prompt,
        stream: false,
        options: {
          temperature,
          num_predict: maxTokens,
        },
      });
      
      // Parse LLM response
      const entities = this.parseLLMResponse(response.data.response, text);
      
      // Add embeddings if requested
      if (includeEmbeddings) {
        await this.addEmbeddings(entities);
      }
      
      log.info(`🤖 Extracted ${entities.length} entities with LLM`, LogContext.AI);
      return entities;
    } catch (error) {
      log.warn('⚠️ LLM extraction failed, falling back to regex', LogContext.AI, { error });
      return this.extractWithRegex(text);
    }
  }

  /**
   * Extract entities using regex patterns (fallback)
   */
  public async extractWithRegex(text: string): Promise<ExtractedEntity[]> {
    const entities: ExtractedEntity[] = [];
    const seenEntities = new Set<string>();
    
    for (const [type, patterns] of this.entityTypePatterns) {
      for (const pattern of patterns) {
        const matches = text.matchAll(pattern);
        
        for (const match of matches) {
          const entityText = match[1] || match[0];
          const key = `${type}:${entityText.toLowerCase()}`;
          
          if (!seenEntities.has(key)) {
            seenEntities.add(key);
            
            entities.push({
              text: entityText,
              type,
              confidence: 0.6, // Lower confidence for regex extraction
              properties: {},
              position: {
                start: match.index || 0,
                end: (match.index || 0) + entityText.length,
              },
              context: this.extractContext(text, match.index || 0),
            });
          }
        }
      }
    }
    
    log.info(`📋 Extracted ${entities.length} entities with regex`, LogContext.AI);
    return entities;
  }

  /**
   * Build extraction prompt for LLM
   */
  private buildExtractionPrompt(text: string): string {
    const truncated = text.length > 2000 ? text.substring(0, 2000) + '...' : text;
    
    return `Extract all entities from the following text. For each entity, identify:
1. The entity text
2. The entity type (person, organization, technology, concept, etc.)
3. Any relevant properties

Format your response as JSON array:
[
  {"text": "entity_name", "type": "entity_type", "properties": {}},
  ...
]

Text:
${truncated}

Entities:`;
  }

  /**
   * Parse LLM response
   */
  private parseLLMResponse(response: string, originalText: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];
    
    try {
      // Try to parse as JSON
      const parsed = JSON.parse(response);
      
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          const position = this.findEntityPosition(item.text, originalText);
          
          entities.push({
            text: item.text,
            type: this.mapEntityType(item.type),
            confidence: 0.8, // Higher confidence for LLM extraction
            properties: item.properties || {},
            position,
            context: this.extractContext(originalText, position.start),
          });
        }
      }
    } catch (error) {
      // Fallback to line-by-line parsing
      const lines = response.split('\n');
      for (const line of lines) {
        const match = line.match(/[-*]\s*(.+?):\s*(.+)/);
        if (match && match[1] && match[2]) {
          const [, entityText, entityType] = match;
          const position = this.findEntityPosition(entityText, originalText);
          
          entities.push({
            text: entityText.trim(),
            type: this.mapEntityType(entityType.trim()),
            confidence: 0.7,
            properties: {},
            position,
            context: this.extractContext(originalText, position.start),
          });
        }
      }
    }
    
    return entities;
  }

  /**
   * Find entity position in text
   */
  private findEntityPosition(entity: string, text: string): { start: number; end: number } {
    const index = text.toLowerCase().indexOf(entity.toLowerCase());
    return {
      start: index >= 0 ? index : 0,
      end: index >= 0 ? index + entity.length : entity.length,
    };
  }

  /**
   * Extract surrounding context
   */
  private extractContext(text: string, position: number, windowSize = 50): string {
    const start = Math.max(0, position - windowSize);
    const end = Math.min(text.length, position + windowSize);
    return text.substring(start, end);
  }

  /**
   * Map string to EntityType
   */
  private mapEntityType(typeStr: string): EntityType {
    const normalized = typeStr.toLowerCase().trim();
    
    const typeMap: Record<string, EntityType> = {
      person: EntityType.PERSON,
      people: EntityType.PERSON,
      organization: EntityType.ORGANIZATION,
      company: EntityType.ORGANIZATION,
      location: EntityType.LOCATION,
      place: EntityType.LOCATION,
      date: EntityType.DATE,
      time: EntityType.DATE,
      technology: EntityType.TECHNOLOGY,
      tech: EntityType.TECHNOLOGY,
      concept: EntityType.CONCEPT,
      idea: EntityType.CONCEPT,
      product: EntityType.PRODUCT,
      event: EntityType.EVENT,
      code: EntityType.CODE_ENTITY,
      api: EntityType.API_ENDPOINT,
      database: EntityType.DATABASE,
      framework: EntityType.FRAMEWORK,
    };
    
    return typeMap[normalized] || EntityType.UNKNOWN;
  }

  /**
   * Add embeddings to entities
   */
  private async addEmbeddings(entities: ExtractedEntity[]): Promise<void> {
    for (const entity of entities) {
      try {
        const embedding = await generateEmbedding(entity.text);
        if (embedding) {
          entity.properties.embedding = embedding;
        }
      } catch (error) {
        log.warn(`⚠️ Failed to generate embedding for ${entity.text}`, LogContext.AI);
      }
    }
  }

  /**
   * Convert ExtractedEntity to GraphEntity
   */
  public toGraphEntity(extracted: ExtractedEntity, source?: string): GraphEntity {
    return {
      id: this.generateEntityId(extracted.text, extracted.type),
      type: extracted.type,
      name: extracted.text,
      properties: {
        ...extracted.properties,
        confidence: extracted.confidence,
        source,
        extractedAt: new Date().toISOString(),
        context: extracted.context,
      },
      embedding: extracted.properties.embedding,
      importance: extracted.confidence,
    };
  }

  /**
   * Batch extraction from multiple texts
   */
  public async extractBatch(
    texts: string[],
    options: EntityExtractionOptions = {}
  ): Promise<ExtractedEntity[][]> {
    const results: ExtractedEntity[][] = [];
    
    // Process in parallel with concurrency limit
    const BATCH_SIZE = 5;
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(text => this.extractWithLLM(text, options))
      );
      results.push(...batchResults);
    }
    
    return results;
  }

  /**
   * Deduplicate entities
   */
  public deduplicateEntities(entities: ExtractedEntity[]): ExtractedEntity[] {
    const seen = new Map<string, ExtractedEntity>();
    
    for (const entity of entities) {
      const key = `${entity.type}:${entity.text.toLowerCase()}`;
      const existing = seen.get(key);
      
      if (!existing || entity.confidence > existing.confidence) {
        seen.set(key, entity);
      }
    }
    
    return Array.from(seen.values());
  }

  /**
   * Generate entity ID
   */
  private generateEntityId(text: string, type: EntityType): string {
    const sanitized = text.toLowerCase().replace(/[^a-z0-9]/g, '_');
    return `${type}_${sanitized}_${Date.now()}`;
  }
}

// Export singleton instance
export const entityExtractor = new EntityExtractor();