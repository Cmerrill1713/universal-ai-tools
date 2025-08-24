/**
 * Hypergraph Constructor for Graph-R1
 * 
 * Implements proper n-ary relation extraction and hypergraph construction
 * based on the Graph-R1 methodology for knowledge graph enhancement.
 */

import { log, LogContext } from '../../utils/logger';
import { generateEmbedding } from '../embeddings';
import type { ExtractedEntity, ExtractedRelation} from './llm-entity-extractor';
import {llmEntityExtractor } from './llm-entity-extractor';

export interface HyperedgeNode {
  id: string;
  entityId: string;
  role: string; // subject, object, predicate, modifier, etc.
  weight: number;
}

export interface Hyperedge {
  id: string;
  type: string; // relation type or pattern
  nodes: HyperedgeNode[];
  properties: Record<string, any>;
  weight: number;
  confidence: number;
  context: string;
  embedding?: number[];
}

export interface HypergraphPattern {
  id: string;
  pattern: string; // e.g., "A implements B using C"
  roles: string[]; // [subject, predicate, object, instrument]
  frequency: number;
  examples: string[];
}

export interface NaryRelation {
  id: string;
  participants: Array<{
    entity: string;
    role: string;
    importance: number;
  }>;
  relationType: string;
  context: string;
  confidence: number;
  temporalInfo?: {
    start?: Date;
    end?: Date;
    duration?: string;
  };
  spatialInfo?: {
    location?: string;
    scope?: string;
  };
}

export class HypergraphConstructor {
  private hyperedges: Map<string, Hyperedge> = new Map();
  private patterns: Map<string, HypergraphPattern> = new Map();
  private entityRoles: Map<string, Set<string>> = new Map();
  
  // Common n-ary relation patterns
  private readonly relationPatterns = [
    {
      pattern: /(\w+)\s+(?:uses|employs|utilizes)\s+(\w+)\s+(?:to|for)\s+(\w+)/gi,
      roles: ['agent', 'instrument', 'purpose'],
      type: 'instrumental_relation'
    },
    {
      pattern: /(\w+)\s+(?:collaborates|works)\s+(?:with|alongside)\s+(\w+)\s+(?:on|for)\s+(\w+)/gi,
      roles: ['collaborator1', 'collaborator2', 'project'],
      type: 'collaboration_relation'
    },
    {
      pattern: /(\w+)\s+(?:implements|realizes|executes)\s+(\w+)\s+(?:using|via|through)\s+(\w+)/gi,
      roles: ['implementer', 'concept', 'method'],
      type: 'implementation_relation'
    },
    {
      pattern: /(\w+)\s+(?:connects|links|bridges)\s+(\w+)\s+(?:and|with)\s+(\w+)/gi,
      roles: ['connector', 'source', 'target'],
      type: 'connection_relation'
    },
    {
      pattern: /(\w+)\s+(?:optimizes|improves|enhances)\s+(\w+)\s+(?:for|in)\s+(\w+)/gi,
      roles: ['optimizer', 'target', 'domain'],
      type: 'optimization_relation'
    }
  ];

  constructor() {
    this.initializeCommonPatterns();
  }

  /**
   * Construct hypergraph from entities and context
   */
  async constructHypergraph(
    entities: ExtractedEntity[],
    relations: ExtractedRelation[],
    context: string,
    options: {
      includePatterns?: boolean;
      maxHyperedges?: number;
      minConfidence?: number;
    } = {}
  ): Promise<{
    hyperedges: Hyperedge[];
    patterns: HypergraphPattern[];
    statistics: {
      totalHyperedges: number;
      averageNodes: number;
      patternCount: number;
      naryRelationCount: number;
    };
  }> {
    const includePatterns = options.includePatterns !== false;
    const maxHyperedges = options.maxHyperedges || 100;
    const minConfidence = options.minConfidence || 0.3;

    log.info('Constructing hypergraph', LogContext.AI, {
      entities: entities.length,
      relations: relations.length,
      contextLength: context.length
    });

    // Step 1: Extract n-ary relations from context
    const naryRelations = await this.extractNaryRelations(context, entities);
    
    // Step 2: Build hyperedges from binary and n-ary relations
    const hyperedges = await this.buildHyperedges(
      entities,
      relations,
      naryRelations,
      context
    );

    // Step 3: Discover and learn new patterns
    if (includePatterns) {
      await this.discoverPatterns(hyperedges, context);
    }

    // Step 4: Filter and rank hyperedges
    const filteredHyperedges = hyperedges
      .filter(h => h.confidence >= minConfidence)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, maxHyperedges);

    // Step 5: Calculate statistics
    const statistics = this.calculateStatistics(filteredHyperedges);

    // Store hyperedges
    for (const hyperedge of filteredHyperedges) {
      this.hyperedges.set(hyperedge.id, hyperedge);
    }

    log.info('Hypergraph construction completed', LogContext.AI, statistics);

    return {
      hyperedges: filteredHyperedges,
      patterns: Array.from(this.patterns.values()),
      statistics
    };
  }

  /**
   * Extract n-ary relations using LLM and pattern matching
   */
  private async extractNaryRelations(
    context: string,
    entities: ExtractedEntity[]
  ): Promise<NaryRelation[]> {
    const naryRelations: NaryRelation[] = [];

    // Method 1: Pattern-based extraction
    const patternRelations = this.extractPatternBasedRelations(context, entities);
    naryRelations.push(...patternRelations);

    // Method 2: LLM-based complex relation extraction
    try {
      const llmRelations = await this.extractLLMBasedNaryRelations(context, entities);
      naryRelations.push(...llmRelations);
    } catch (error) {
      log.warn('LLM-based n-ary relation extraction failed', LogContext.AI, { error });
    }

    // Method 3: Temporal and spatial relation detection
    const contextualRelations = this.extractContextualRelations(context, entities);
    naryRelations.push(...contextualRelations);

    // Deduplicate and merge similar relations
    return this.deduplicateNaryRelations(naryRelations);
  }

  /**
   * Extract relations using predefined patterns
   */
  private extractPatternBasedRelations(
    context: string,
    entities: ExtractedEntity[]
  ): NaryRelation[] {
    const relations: NaryRelation[] = [];
    const entityNames = new Set(entities.map(e => e.text.toLowerCase()));

    for (const pattern of this.relationPatterns) {
      const matches = context.matchAll(pattern.pattern);
      
      for (const match of matches) {
        const participants = [];
        
        // Extract participants based on pattern roles
        for (let i = 1; i < match.length && i - 1 < pattern.roles.length; i++) {
          const entityText = match[i];
          if (entityText && entityNames.has(entityText.toLowerCase())) {
            participants.push({
              entity: entityText,
              role: pattern.roles[i - 1] || "unknown",
              importance: 1.0 - (i - 1) * 0.1 // Decreasing importance
            });
          }
        }

        if (participants.length >= 3) { // N-ary requires at least 3 participants
          relations.push({
            id: this.generateNaryId(participants.map(p => p.entity).filter(Boolean)),
            participants,
            relationType: pattern.type,
            context: match[0],
            confidence: 0.8 - (participants.length - 3) * 0.05 // Adjust for complexity
          });
        }
      }
    }

    return relations;
  }

  /**
   * Extract n-ary relations using LLM
   */
  private async extractLLMBasedNaryRelations(
    context: string,
    entities: ExtractedEntity[]
  ): Promise<NaryRelation[]> {
    const entityList = entities.map(e => e.text).join(', ');
    
    const prompt = `Analyze the following text and identify complex relationships involving 3 or more entities.

Entities: ${entityList}

Text: ${context}

For each complex relationship, identify:
1. All participating entities and their roles
2. The type of relationship (collaboration, implementation, optimization, etc.)
3. The confidence score (0.0 to 1.0)

Format as JSON array:
[{
  "participants": [
    {"entity": "EntityA", "role": "implementer", "importance": 0.9},
    {"entity": "EntityB", "role": "method", "importance": 0.7},
    {"entity": "EntityC", "role": "target", "importance": 0.8}
  ],
  "relationType": "implementation_with_method",
  "confidence": 0.85
}]

Extract complex relationships:`;

    try {
      const triplets = await llmEntityExtractor.extractTriplets(prompt, {
        maxTriplets: 20
      });

      // Convert triplets to n-ary relations by grouping related triplets
      return this.groupTripletsIntoNaryRelations(triplets, entities);
    } catch (error) {
      log.warn('LLM n-ary extraction failed', LogContext.AI, { error });
      return [];
    }
  }

  /**
   * Extract temporal and spatial contextual relations
   */
  private extractContextualRelations(
    context: string,
    entities: ExtractedEntity[]
  ): NaryRelation[] {
    const relations: NaryRelation[] = [];

    // Temporal patterns
    const temporalPatterns = [
      /(\w+)\s+(?:during|while|when)\s+(\w+)\s+(?:was|is)\s+(\w+)/gi,
      /(\w+)\s+(?:before|after|since)\s+(\w+)\s+(?:started|began|ended)/gi
    ];

    // Spatial patterns
    const spatialPatterns = [
      /(\w+)\s+(?:in|at|within)\s+(\w+)\s+(?:contains|includes|has)\s+(\w+)/gi,
      /(\w+)\s+(?:connects|spans|covers)\s+(\w+)\s+(?:and|with)\s+(\w+)/gi
    ];

    // Extract temporal relations
    for (const pattern of temporalPatterns) {
      const matches = context.matchAll(pattern);
      for (const match of matches) {
        relations.push({
          id: this.generateNaryId([match[1], match[2], match[3]].filter((x): x is string => Boolean(x))),
          participants: [
            { entity: match[1] || "unknown", role: 'actor', importance: 0.9 },
            { entity: match[2] || "unknown", role: 'temporal_context', importance: 0.7 },
            { entity: match[3] || "unknown", role: 'state', importance: 0.8 }
          ],
          relationType: 'temporal_relation',
          context: match[0],
          confidence: 0.7,
          temporalInfo: {
            duration: match[2]
          }
        });
      }
    }

    // Extract spatial relations
    for (const pattern of spatialPatterns) {
      const matches = context.matchAll(pattern);
      for (const match of matches) {
        relations.push({
          id: this.generateNaryId([match[1], match[2], match[3]].filter((x): x is string => Boolean(x))),
          participants: [
            { entity: match[1] || "unknown", role: 'container', importance: 0.9 },
            { entity: match[2] || "unknown", role: 'location', importance: 0.8 },
            { entity: match[3] || "unknown", role: 'contained', importance: 0.7 }
          ],
          relationType: 'spatial_relation',
          context: match[0],
          confidence: 0.6,
          spatialInfo: {
            location: match[2]
          }
        });
      }
    }

    return relations;
  }

  /**
   * Build hyperedges from relations
   */
  private async buildHyperedges(
    entities: ExtractedEntity[],
    binaryRelations: ExtractedRelation[],
    naryRelations: NaryRelation[],
    context: string
  ): Promise<Hyperedge[]> {
    const hyperedges: Hyperedge[] = [];

    // Convert binary relations to hyperedges
    for (const relation of binaryRelations) {
      if (relation.isNary && relation.participants) {
        // Already n-ary
        const nodes: HyperedgeNode[] = relation.participants.map((p, index) => ({
          id: `${relation.source}_${relation.target}_${index}`,
          entityId: p,
          role: index === 0 ? 'primary' : 'secondary',
          weight: 1.0 / (index + 1)
        }));

        hyperedges.push({
          id: `hyperedge_${relation.source}_${relation.target}`,
          type: relation.type,
          nodes,
          properties: relation.properties,
          weight: 1.0,
          confidence: relation.confidence,
          context: context.substring(0, 200),
          embedding: (await generateEmbedding(`${relation.source} ${relation.type} ${relation.target}`)) || undefined
        });
      } else {
        // Binary relation
        const nodes: HyperedgeNode[] = [
          {
            id: `${relation.source}_subject`,
            entityId: relation.source,
            role: 'subject',
            weight: 1.0
          },
          {
            id: `${relation.target}_object`,
            entityId: relation.target,
            role: 'object',
            weight: 0.8
          }
        ];

        hyperedges.push({
          id: `hyperedge_${relation.source}_${relation.target}`,
          type: relation.type,
          nodes,
          properties: relation.properties,
          weight: 0.8, // Binary relations have lower weight
          confidence: relation.confidence,
          context: context.substring(0, 200),
          embedding: (await generateEmbedding(`${relation.source} ${relation.type} ${relation.target}`)) || undefined
        });
      }
    }

    // Convert n-ary relations to hyperedges
    for (const naryRelation of naryRelations) {
      const nodes: HyperedgeNode[] = naryRelation.participants.map(participant => ({
        id: `${naryRelation.id}_${participant.entity}`,
        entityId: participant.entity,
        role: participant.role,
        weight: participant.importance
      }));

      const hyperedge: Hyperedge = {
        id: `hyperedge_${naryRelation.id}`,
        type: naryRelation.relationType,
        nodes,
        properties: {
          temporal: naryRelation.temporalInfo,
          spatial: naryRelation.spatialInfo,
          participantCount: naryRelation.participants.length
        },
        weight: Math.min(1.0, 0.5 + naryRelation.participants.length * 0.1),
        confidence: naryRelation.confidence,
        context: naryRelation.context,
        embedding: (await generateEmbedding(naryRelation.context)) || undefined
      };

      hyperedges.push(hyperedge);
    }

    return hyperedges;
  }

  /**
   * Discover new patterns from existing hyperedges
   */
  private async discoverPatterns(
    hyperedges: Hyperedge[],
    context: string
  ): Promise<void> {
    // Group hyperedges by similar structures
    const structureGroups = new Map<string, Hyperedge[]>();

    for (const hyperedge of hyperedges) {
      const structure = this.getHyperedgeStructure(hyperedge);
      if (!structureGroups.has(structure)) {
        structureGroups.set(structure, []);
      }
      structureGroups.get(structure)?.push(hyperedge);
    }

    // Identify frequent patterns
    for (const [structure, edges] of structureGroups) {
      if (edges.length >= 2) { // Pattern must appear at least twice
        const pattern: HypergraphPattern = {
          id: `pattern_${structure}`,
          pattern: this.generatePatternDescription(edges),
          roles: edges[0]?.nodes?.map(n => n.role) || [],
          frequency: edges.length,
          examples: edges.slice(0, 3).map(e => e.context)
        };

        this.patterns.set(pattern.id, pattern);
        log.debug('Discovered hypergraph pattern', LogContext.AI, {
          pattern: pattern.pattern,
          frequency: pattern.frequency
        });
      }
    }
  }

  /**
   * Helper methods
   */
  private groupTripletsIntoNaryRelations(
    triplets: Array<{ subject: string; predicate: string; object: string; confidence: number }>,
    entities: ExtractedEntity[]
  ): NaryRelation[] {
    // Group triplets that share entities
    const entityGroups = new Map<string, typeof triplets>();
    
    for (const triplet of triplets) {
      const key = [triplet.subject, triplet.object].sort().join('_');
      if (!entityGroups.has(key)) {
        entityGroups.set(key, []);
      }
      entityGroups.get(key)?.push(triplet);
    }

    const naryRelations: NaryRelation[] = [];
    
    for (const [key, relatedTriplets] of entityGroups) {
      if (relatedTriplets.length >= 2) {
        const allEntities = new Set<string>();
        relatedTriplets.forEach(t => {
          allEntities.add(t.subject);
          allEntities.add(t.object);
        });

        if (allEntities.size >= 3) {
          const participants = Array.from(allEntities).map((entity, index) => ({
            entity,
            role: index === 0 ? 'primary' : `participant_${index}`,
            importance: 1.0 - index * 0.1
          }));

          naryRelations.push({
            id: this.generateNaryId(Array.from(allEntities)),
            participants,
            relationType: 'complex_relation',
            context: relatedTriplets.map(t => `${t.subject} ${t.predicate} ${t.object}`).join('; '),
            confidence: relatedTriplets.reduce((sum, t) => sum + t.confidence, 0) / relatedTriplets.length
          });
        }
      }
    }

    return naryRelations;
  }

  private deduplicateNaryRelations(relations: NaryRelation[]): NaryRelation[] {
    const seen = new Set<string>();
    return relations.filter(relation => {
      const key = relation.participants
        .map(p => p.entity)
        .sort()
        .join('_') + '_' + relation.relationType;
      
      if (seen.has(key)) {return false;}
      seen.add(key);
      return true;
    });
  }

  private generateNaryId(entities: string[]): string {
    return `nary_${entities.sort().join('_')}_${Date.now()}`;
  }

  private getHyperedgeStructure(hyperedge: Hyperedge): string {
    return hyperedge.nodes
      .map(n => n.role)
      .sort()
      .join('_');
  }

  private generatePatternDescription(edges: Hyperedge[]): string {
    const roles = edges[0]?.nodes?.map(n => n.role) || [];
    const type = edges[0]?.type || "unknown";
    return `${roles[0] || "unknown"} ${type} ${roles.slice(1).join(' and ')}`;
  }

  private calculateStatistics(hyperedges: Hyperedge[]) {
    const naryCount = hyperedges.filter(h => h.nodes.length > 2).length;
    const totalNodes = hyperedges.reduce((sum, h) => sum + h.nodes.length, 0);
    
    return {
      totalHyperedges: hyperedges.length,
      averageNodes: hyperedges.length > 0 ? totalNodes / hyperedges.length : 0,
      patternCount: this.patterns.size,
      naryRelationCount: naryCount
    };
  }

  private initializeCommonPatterns(): void {
    // Initialize with some common patterns
    const commonPatterns = [
      {
        id: 'implementation_pattern',
        pattern: 'agent implements concept using method',
        roles: ['agent', 'concept', 'method'],
        frequency: 0,
        examples: []
      },
      {
        id: 'collaboration_pattern',
        pattern: 'entity1 collaborates with entity2 on project',
        roles: ['collaborator1', 'collaborator2', 'project'],
        frequency: 0,
        examples: []
      }
    ];

    for (const pattern of commonPatterns) {
      this.patterns.set(pattern.id, pattern);
    }
  }

  /**
   * Get all hyperedges
   */
  getHyperedges(): Hyperedge[] {
    return Array.from(this.hyperedges.values());
  }

  /**
   * Get discovered patterns
   */
  getPatterns(): HypergraphPattern[] {
    return Array.from(this.patterns.values());
  }

  /**
   * Find hyperedges containing a specific entity
   */
  findHyperedgesByEntity(entityId: string): Hyperedge[] {
    return Array.from(this.hyperedges.values()).filter(hyperedge =>
      hyperedge.nodes.some(node => node.entityId === entityId)
    );
  }

  /**
   * Get hypergraph statistics
   */
  getStatistics() {
    const hyperedges = Array.from(this.hyperedges.values());
    return this.calculateStatistics(hyperedges);
  }
}

// Export singleton instance
export const hypergraphConstructor = new HypergraphConstructor();