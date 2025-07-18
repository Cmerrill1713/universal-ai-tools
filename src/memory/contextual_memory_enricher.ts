/**
 * Contextual Memory Enricher
 * Extracts entities, concepts, and intent to create context-aware embeddings
 * Enhances memory quality and search relevance through semantic understanding
 */

export interface EntityExtraction {
  type: 'person' | 'organization' | 'location' | 'date' | 'time' | 'email' | 'url' | 'phone' | 'money' | 'percentage' | 'other';
  value: string;
  confidence?: number;
  start?: number;
  end?: number;
}

export interface ConceptExtraction {
  concept: string;
  category: 'action' | 'object' | 'attribute' | 'domain' | 'temporal' | 'emotional' | 'technical';
  relevance: number;
  keywords: string[];
}

export interface IntentClassification {
  intent: string;
  confidence: number;
  category: 'request' | 'information' | 'action' | 'question' | 'complaint' | 'compliment' | 'other';
  urgency?: 'low' | 'medium' | 'high' | 'critical';
}

export interface TemporalContext {
  hasTimeReference: boolean;
  timeExpressions: string[];
  temporalType?: 'past' | 'present' | 'future' | 'recurring';
  urgency?: 'immediate' | 'soon' | 'scheduled' | 'flexible';
}

export interface ContextualEnrichment {
  entities: EntityExtraction[];
  concepts: ConceptExtraction[];
  intent: IntentClassification;
  temporal: TemporalContext;
  sentiment?: {
    polarity: number; // -1 to 1
    subjectivity: number; // 0 to 1
    confidence: number;
  };
  complexity: {
    readabilityScore: number;
    technicalLevel: 'basic' | 'intermediate' | 'advanced' | 'expert';
    abstractionLevel: 'concrete' | 'mixed' | 'abstract';
  };
  relationships: {
    dependsOn: string[];
    relatedTo: string[];
    conflicts: string[];
  };
}

export class ContextualMemoryEnricher {
  private static readonly ENTITY_PATTERNS = {
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    url: /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g,
    phone: /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
    money: /\$\d{1,3}(,\d{3})*(\.\d{2})?|\d{1,3}(,\d{3})*(\.\d{2})?\s*(dollars?|USD|cents?)/gi,
    percentage: /\d+(\.\d+)?%/g,
    date: /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b|\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}\b/gi,
    time: /\b\d{1,2}:\d{2}(\s?[AaPp][Mm])?\b/g
  };

  private static readonly INTENT_PATTERNS = {
    request: [
      /please\s+(help|assist|do|make|create|build|fix|solve)/i,
      /can\s+you\s+(help|do|make|create|show)/i,
      /i\s+need\s+(help|assistance|support)/i,
      /would\s+you\s+(mind|please)/i
    ],
    question: [
      /\b(what|how|when|where|why|who|which)\b.*\?/i,
      /\bis\s+.*\?/i,
      /\bdo\s+you\s+know/i,
      /can\s+you\s+tell\s+me/i
    ],
    action: [
      /\b(schedule|book|create|make|build|send|call|email|remind)/i,
      /\blet's\s+(do|make|create|start)/i,
      /\bi\s+want\s+to\s+(do|make|create|start)/i
    ],
    information: [
      /\btell\s+me\s+about/i,
      /\bshow\s+me/i,
      /\bexplain/i,
      /\bdescribe/i
    ]
  };

  private static readonly TEMPORAL_PATTERNS = {
    immediate: /\b(now|immediately|asap|urgent|right\s+away)\b/i,
    soon: /\b(soon|shortly|quickly|in\s+a\s+(few|couple)\s+(minutes?|hours?))\b/i,
    today: /\b(today|this\s+(morning|afternoon|evening))\b/i,
    tomorrow: /\b(tomorrow|next\s+day)\b/i,
    future: /\b(next\s+(week|month|year)|later|eventually|someday)\b/i,
    recurring: /\b(daily|weekly|monthly|every\s+(day|week|month|year))\b/i
  };

  private static readonly CONCEPT_CATEGORIES = {
    action: ['create', 'make', 'build', 'develop', 'design', 'implement', 'execute', 'perform', 'do', 'schedule', 'organize', 'manage'],
    object: ['file', 'document', 'project', 'meeting', 'task', 'component', 'system', 'application', 'database', 'report'],
    domain: ['technology', 'business', 'education', 'health', 'finance', 'marketing', 'operations', 'development', 'design'],
    temporal: ['deadline', 'schedule', 'timeline', 'urgent', 'priority', 'immediate', 'future', 'past', 'recurring'],
    emotional: ['excited', 'frustrated', 'happy', 'concerned', 'confident', 'worried', 'satisfied', 'disappointed'],
    technical: ['code', 'api', 'database', 'server', 'algorithm', 'framework', 'library', 'protocol', 'interface']
  };

  /**
   * Extract entities from text using pattern matching and NLP techniques
   */
  extractEntities(text: string): EntityExtraction[] {
    const entities: EntityExtraction[] = [];

    // Extract using regex patterns
    Object.entries(ContextualMemoryEnricher.ENTITY_PATTERNS).forEach(([type, pattern]) => {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        entities.push({
          type: type as EntityExtraction['type'],
          value: match[0],
          confidence: 0.8, // High confidence for regex matches
          start: match.index,
          end: match.index ? match.index + match[0].length : undefined
        });
      }
    });

    // Extract names (capitalized words that aren't common words)
    const namePattern = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g;
    const commonWords = new Set(['The', 'This', 'That', 'And', 'Or', 'But', 'For', 'With', 'From', 'To', 'In', 'On', 'At', 'By']);
    
    const nameMatches = text.matchAll(namePattern);
    for (const match of nameMatches) {
      if (!commonWords.has(match[0]) && match[0].length > 2) {
        const isProbablyName = match[0].split(' ').length <= 3 && !entities.some(e => 
          e.start !== undefined && match.index !== undefined && 
          e.start <= match.index && match.index < (e.start + e.value.length)
        );
        
        if (isProbablyName) {
          entities.push({
            type: 'person',
            value: match[0],
            confidence: 0.6,
            start: match.index,
            end: match.index ? match.index + match[0].length : undefined
          });
        }
      }
    }

    return entities;
  }

  /**
   * Extract concepts and categorize them
   */
  extractConcepts(text: string): ConceptExtraction[] {
    const concepts: ConceptExtraction[] = [];
    const words = text.toLowerCase().split(/\W+/).filter(word => word.length > 2);
    const wordFreq = new Map<string, number>();
    
    // Count word frequencies
    words.forEach(word => {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    });

    // Extract concepts based on categories
    Object.entries(ContextualMemoryEnricher.CONCEPT_CATEGORIES).forEach(([category, keywords]) => {
      keywords.forEach(keyword => {
        const keywordLower = keyword.toLowerCase();
        if (words.includes(keywordLower)) {
          const relevance = Math.min(1.0, (wordFreq.get(keywordLower) || 0) / words.length * 10);
          
          concepts.push({
            concept: keyword,
            category: category as ConceptExtraction['category'],
            relevance,
            keywords: [keywordLower]
          });
        }
      });
    });

    // Extract compound concepts (phrases)
    const phrases = this.extractPhrases(text);
    phrases.forEach(phrase => {
      const category = this.classifyPhrase(phrase);
      if (category) {
        concepts.push({
          concept: phrase,
          category,
          relevance: 0.7,
          keywords: phrase.toLowerCase().split(/\s+/)
        });
      }
    });

    // Sort by relevance and remove duplicates
    return concepts
      .sort((a, b) => b.relevance - a.relevance)
      .filter((concept, index, arr) => 
        arr.findIndex(c => c.concept.toLowerCase() === concept.concept.toLowerCase()) === index
      )
      .slice(0, 15); // Top 15 concepts
  }

  /**
   * Classify intent from text
   */
  classifyIntent(text: string): IntentClassification {
    const textLower = text.toLowerCase();
    const intents: Array<{ intent: string; category: IntentClassification['category']; confidence: number }> = [];

    // Check against intent patterns
    Object.entries(ContextualMemoryEnricher.INTENT_PATTERNS).forEach(([category, patterns]) => {
      patterns.forEach(pattern => {
        if (pattern.test(text)) {
          intents.push({
            intent: category,
            category: category as IntentClassification['category'],
            confidence: 0.8
          });
        }
      });
    });

    // Analyze urgency indicators
    let urgency: IntentClassification['urgency'] = 'medium';
    if (/\b(urgent|critical|asap|emergency|immediately)\b/i.test(text)) {
      urgency = 'critical';
    } else if (/\b(important|priority|soon|quickly)\b/i.test(text)) {
      urgency = 'high';
    } else if (/\b(when\s+convenient|no\s+rush|eventually|someday)\b/i.test(text)) {
      urgency = 'low';
    }

    // If no specific intent found, classify as other
    if (intents.length === 0) {
      if (text.includes('?')) {
        intents.push({ intent: 'question', category: 'question', confidence: 0.6 });
      } else {
        intents.push({ intent: 'statement', category: 'other', confidence: 0.5 });
      }
    }

    // Return the highest confidence intent
    const topIntent = intents.sort((a, b) => b.confidence - a.confidence)[0];
    
    return {
      intent: topIntent.intent,
      confidence: topIntent.confidence,
      category: topIntent.category,
      urgency
    };
  }

  /**
   * Extract temporal context
   */
  extractTemporalContext(text: string): TemporalContext {
    const timeExpressions: string[] = [];
    let temporalType: TemporalContext['temporalType'] = 'present';
    let urgency: TemporalContext['urgency'] = 'flexible';

    // Find time expressions
    Object.entries(ContextualMemoryEnricher.TEMPORAL_PATTERNS).forEach(([type, pattern]) => {
      const matches = text.match(pattern);
      if (matches) {
        timeExpressions.push(...matches);
        
        if (type === 'immediate') {
          urgency = 'immediate';
          temporalType = 'present';
        } else if (type === 'soon' || type === 'today') {
          urgency = 'soon';
          temporalType = 'present';
        } else if (type === 'tomorrow') {
          urgency = 'scheduled';
          temporalType = 'future';
        } else if (type === 'future') {
          temporalType = 'future';
        } else if (type === 'recurring') {
          temporalType = 'recurring';
        }
      }
    });

    // Check for past tense indicators
    if (/\b(was|were|had|did|yesterday|last\s+(week|month|year))\b/i.test(text)) {
      temporalType = 'past';
    }

    return {
      hasTimeReference: timeExpressions.length > 0,
      timeExpressions,
      temporalType,
      urgency
    };
  }

  /**
   * Analyze text complexity
   */
  analyzeComplexity(text: string): ContextualEnrichment['complexity'] {
    const words = text.split(/\W+/).filter(word => word.length > 0);
    const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / words.length;
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const avgSentenceLength = words.length / sentences.length;

    // Technical indicators
    const technicalTerms = ['api', 'database', 'algorithm', 'framework', 'protocol', 'interface', 'implementation', 'architecture'];
    const technicalCount = technicalTerms.filter(term => text.toLowerCase().includes(term)).length;

    // Abstract vs concrete indicators
    const abstractWords = ['concept', 'idea', 'theory', 'principle', 'strategy', 'approach', 'methodology'];
    const concreteWords = ['file', 'button', 'screen', 'document', 'table', 'folder', 'item'];
    
    const abstractCount = abstractWords.filter(word => text.toLowerCase().includes(word)).length;
    const concreteCount = concreteWords.filter(word => text.toLowerCase().includes(word)).length;

    // Calculate readability score (simplified Flesch-Kincaid)
    const readabilityScore = Math.max(0, Math.min(100, 
      206.835 - (1.015 * avgSentenceLength) - (84.6 * (avgWordLength / words.length))
    ));

    let technicalLevel: ContextualEnrichment['complexity']['technicalLevel'] = 'basic';
    if (technicalCount >= 3) technicalLevel = 'expert';
    else if (technicalCount >= 2) technicalLevel = 'advanced';
    else if (technicalCount >= 1) technicalLevel = 'intermediate';

    let abstractionLevel: ContextualEnrichment['complexity']['abstractionLevel'] = 'concrete';
    if (abstractCount > concreteCount) abstractionLevel = 'abstract';
    else if (abstractCount > 0 && concreteCount > 0) abstractionLevel = 'mixed';

    return {
      readabilityScore,
      technicalLevel,
      abstractionLevel
    };
  }

  /**
   * Create contextual embedding content
   */
  createContextualEmbedding(
    originalContent: string,
    serviceId: string,
    memoryType: string,
    enrichment: ContextualEnrichment
  ): string {
    const contextualParts = [
      `Agent: ${serviceId}`,
      `Type: ${memoryType}`,
      `Intent: ${enrichment.intent.intent} (${enrichment.intent.category})`,
      `Urgency: ${enrichment.intent.urgency || 'medium'}`,
      `Temporal: ${enrichment.temporal.temporalType || 'present'}`,
      `Technical Level: ${enrichment.complexity.technicalLevel}`,
      `Entities: ${enrichment.entities.map(e => `${e.type}:${e.value}`).join(', ')}`,
      `Concepts: ${enrichment.concepts.slice(0, 5).map(c => c.concept).join(', ')}`,
      `Content: ${originalContent}`
    ];

    return contextualParts.filter(part => part && !part.endsWith(': ')).join('\n');
  }

  /**
   * Full contextual enrichment
   */
  enrichMemory(
    content: string,
    serviceId: string,
    memoryType: string,
    metadata: Record<string, any> = {}
  ): {
    enrichment: ContextualEnrichment;
    contextualContent: string;
    enhancedMetadata: Record<string, any>;
  } {
    const entities = this.extractEntities(content);
    const concepts = this.extractConcepts(content);
    const intent = this.classifyIntent(content);
    const temporal = this.extractTemporalContext(content);
    const complexity = this.analyzeComplexity(content);

    const enrichment: ContextualEnrichment = {
      entities,
      concepts,
      intent,
      temporal,
      complexity,
      relationships: {
        dependsOn: metadata.dependsOn || [],
        relatedTo: metadata.relatedTo || [],
        conflicts: metadata.conflicts || []
      }
    };

    const contextualContent = this.createContextualEmbedding(content, serviceId, memoryType, enrichment);

    const enhancedMetadata = {
      ...metadata,
      enrichment: {
        entities: entities.length,
        concepts: concepts.length,
        intent: intent.intent,
        urgency: intent.urgency,
        temporalType: temporal.temporalType,
        technicalLevel: complexity.technicalLevel,
        readabilityScore: complexity.readabilityScore
      },
      extractedEntities: entities,
      extractedConcepts: concepts.slice(0, 10), // Store top 10 concepts
      temporalContext: temporal.hasTimeReference ? temporal.timeExpressions : undefined,
      version: '2.0'
    };

    return {
      enrichment,
      contextualContent,
      enhancedMetadata
    };
  }

  private extractPhrases(text: string): string[] {
    const phrases: string[] = [];
    
    // Extract noun phrases (simplified)
    const nounPhrasePattern = /\b(the|a|an)\s+([a-zA-Z]+\s+)*[a-zA-Z]+\b/gi;
    const matches = text.matchAll(nounPhrasePattern);
    
    for (const match of matches) {
      const phrase = match[0].replace(/^(the|a|an)\s+/i, '').trim();
      if (phrase.length > 3 && phrase.split(' ').length <= 3) {
        phrases.push(phrase);
      }
    }

    return phrases;
  }

  private classifyPhrase(phrase: string): ConceptExtraction['category'] | null {
    const phraseLower = phrase.toLowerCase();
    
    if (/\b(create|make|build|develop|design|implement)\b/.test(phraseLower)) {
      return 'action';
    } else if (/\b(file|document|project|meeting|task|component)\b/.test(phraseLower)) {
      return 'object';
    } else if (/\b(technology|business|education|health|finance)\b/.test(phraseLower)) {
      return 'domain';
    } else if (/\b(deadline|schedule|timeline|urgent|priority)\b/.test(phraseLower)) {
      return 'temporal';
    } else if (/\b(code|api|database|server|algorithm)\b/.test(phraseLower)) {
      return 'technical';
    }
    
    return null;
  }
}

// Singleton instance
let globalEnricher: ContextualMemoryEnricher | null = null;

export function getMemoryEnricher(): ContextualMemoryEnricher {
  if (!globalEnricher) {
    globalEnricher = new ContextualMemoryEnricher();
  }
  return globalEnricher;
}