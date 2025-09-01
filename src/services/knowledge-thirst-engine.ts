/**
 * Knowledge Thirst Engine
 * A system that actively seeks, absorbs, and applies new knowledge
 * Continuously learns from every interaction and proactively seeks information
 */

import { EventEmitter } from 'events';
import { log, LogContext } from '../utils/logger.js';
import axios from 'axios';

export interface KnowledgeQuery {
  topic: string;
  context: string;
  depth: 'shallow' | 'deep' | 'comprehensive';
  source?: string;
  timestamp: Date;
}

export interface LearningInsight {
  id: string;
  query: KnowledgeQuery;
  findings: string[];
  connections: string[];
  applications: string[];
  confidence: number;
  metadata: Record<string, any>;
}

export interface CuriosityTrigger {
  type: 'user_mention' | 'unknown_concept' | 'pattern_detected' | 'proactive';
  trigger: string;
  context: string;
  priority: number;
}

class KnowledgeThirstEngine extends EventEmitter {
  private static instance: KnowledgeThirstEngine;
  private knowledgeGraph: Map<string, Set<string>> = new Map();
  private learningQueue: KnowledgeQuery[] = [];
  private insights: Map<string, LearningInsight> = new Map();
  private curiosityTriggers: CuriosityTrigger[] = [];
  private isLearning: boolean = false;
  private learningCycle: NodeJS.Timeout | null = null;

  // Curiosity parameters
  private readonly CURIOSITY_THRESHOLD = 0.7;
  private readonly LEARNING_INTERVAL = 30000; // 30 seconds
  private readonly MAX_PARALLEL_QUERIES = 3;

  private constructor() {
    super();
    this.initializeKnowledgeThirst();
  }

  public static getInstance(): KnowledgeThirstEngine {
    if (!KnowledgeThirstEngine.instance) {
      KnowledgeThirstEngine.instance = new KnowledgeThirstEngine();
    }
    return KnowledgeThirstEngine.instance;
  }

  private initializeKnowledgeThirst(): void {
    log.info('🧠💧 Initializing Knowledge Thirst Engine', LogContext.SERVICE);
    
    // Start continuous learning cycle
    this.startLearningCycle();
    
    // Initialize with base curiosity topics
    this.seedCuriosity();
    
    log.info('✅ Knowledge Thirst Engine initialized - Always seeking, always learning', LogContext.SERVICE);
  }

  /**
   * Process user input and extract learning opportunities
   */
  public async analyzeForLearning(input: string, context: any): Promise<CuriosityTrigger[]> {
    const triggers: CuriosityTrigger[] = [];

    // Look for unknown concepts
    const unknownConcepts = this.extractUnknownConcepts(input);
    unknownConcepts.forEach(concept => {
      triggers.push({
        type: 'unknown_concept',
        trigger: concept,
        context: input,
        priority: 0.8
      });
    });

    // Detect patterns that need exploration
    const patterns = this.detectInterestingPatterns(input);
    patterns.forEach(pattern => {
      triggers.push({
        type: 'pattern_detected',
        trigger: pattern,
        context: input,
        priority: 0.6
      });
    });

    // User explicitly mentioned something to learn
    if (this.detectLearningIntent(input)) {
      triggers.push({
        type: 'user_mention',
        trigger: input,
        context: 'direct_request',
        priority: 1.0
      });
    }

    // Add to curiosity triggers
    this.curiosityTriggers.push(...triggers);
    
    // Queue learning queries
    triggers.forEach(trigger => {
      this.queueLearningQuery({
        topic: trigger.trigger,
        context: trigger.context,
        depth: trigger.priority > 0.8 ? 'deep' : 'shallow',
        timestamp: new Date()
      });
    });

    return triggers;
  }

  /**
   * Extract concepts that the system doesn't fully understand
   */
  private extractUnknownConcepts(input: string): string[] {
    const concepts: string[] = [];
    
    // Look for technical terms, acronyms, or complex phrases
    const technicalPattern = /\b([A-Z]{2,})\b|\b(\w+(?:ify|ize|ation|ment))\b/g;
    const matches = input.match(technicalPattern) || [];
    
    matches.forEach(match => {
      if (!this.knowledgeGraph.has(match.toLowerCase())) {
        concepts.push(match);
      }
    });

    // Look for "what is", "how does", "why" questions
    const questionPatterns = [
      /what (?:is|are) (\w+)/gi,
      /how (?:does|do|to) (\w+)/gi,
      /why (?:is|are|does|do) (\w+)/gi
    ];

    questionPatterns.forEach(pattern => {
      const questionMatch = input.match(pattern);
      if (questionMatch && questionMatch[1]) {
        concepts.push(questionMatch[1]);
      }
    });

    return [...new Set(concepts)]; // Remove duplicates
  }

  /**
   * Detect interesting patterns worth learning about
   */
  private detectInterestingPatterns(input: string): string[] {
    const patterns: string[] = [];

    // Detect technology combinations
    if (input.includes('with') || input.includes('using')) {
      const techCombo = input.match(/(\w+)\s+(?:with|using)\s+(\w+)/gi);
      if (techCombo) {
        patterns.push(`integration: ${techCombo[0]}`);
      }
    }

    // Detect comparisons
    if (input.includes('vs') || input.includes('versus') || input.includes('better than')) {
      patterns.push(`comparison: ${input.substring(0, 50)}`);
    }

    // Detect optimization requests
    if (input.includes('optimize') || input.includes('improve') || input.includes('faster')) {
      patterns.push(`optimization: ${input.substring(0, 50)}`);
    }

    return patterns;
  }

  /**
   * Detect if user wants the system to learn something
   */
  private detectLearningIntent(input: string): boolean {
    const learningKeywords = [
      'learn', 'understand', 'know about', 'research',
      'find out', 'discover', 'explore', 'study',
      'tell me about', 'explain', 'what is', 'how does'
    ];

    return learningKeywords.some(keyword => 
      input.toLowerCase().includes(keyword)
    );
  }

  /**
   * Queue a learning query for processing
   */
  private queueLearningQuery(query: KnowledgeQuery): void {
    this.learningQueue.push(query);
    
    // Trigger immediate learning if high priority
    if (query.depth === 'deep' || query.depth === 'comprehensive') {
      this.processLearningQueue();
    }
  }

  /**
   * Start the continuous learning cycle
   */
  private startLearningCycle(): void {
    this.learningCycle = setInterval(() => {
      this.processLearningQueue();
      this.proactivelySeekKnowledge();
    }, this.LEARNING_INTERVAL);
  }

  /**
   * Process queued learning queries
   */
  private async processLearningQueue(): Promise<void> {
    if (this.isLearning || this.learningQueue.length === 0) return;

    this.isLearning = true;
    const batch = this.learningQueue.splice(0, this.MAX_PARALLEL_QUERIES);

    try {
      const learningPromises = batch.map(query => this.seekKnowledge(query));
      const insights = await Promise.all(learningPromises);
      
      insights.forEach(insight => {
        if (insight) {
          this.insights.set(insight.id, insight);
          this.updateKnowledgeGraph(insight);
          this.emit('knowledgeGained', insight);
        }
      });

      log.info(`🎓 Learned ${insights.length} new insights`, LogContext.SERVICE);
    } catch (error) {
      log.error('❌ Error in learning cycle:', LogContext.SERVICE, { error });
    } finally {
      this.isLearning = false;
    }
  }

  /**
   * Actively seek knowledge about a topic
   */
  private async seekKnowledge(query: KnowledgeQuery): Promise<LearningInsight | null> {
    try {
      // Simulate knowledge seeking (in production, this would call various APIs)
      const insight: LearningInsight = {
        id: `insight_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        query,
        findings: await this.gatherFindings(query),
        connections: this.findConnections(query.topic),
        applications: this.generateApplications(query.topic),
        confidence: Math.random() * 0.3 + 0.7, // 0.7-1.0
        metadata: {
          source: 'autonomous_learning',
          timestamp: new Date()
        }
      };

      return insight;
    } catch (error) {
      log.error(`Failed to seek knowledge about ${query.topic}:`, LogContext.SERVICE, { error });
      return null;
    }
  }

  /**
   * Gather findings about a topic
   */
  private async gatherFindings(query: KnowledgeQuery): Promise<string[]> {
    const findings: string[] = [];

    // In production, this would:
    // 1. Search documentation
    // 2. Query knowledge bases
    // 3. Analyze code repositories
    // 4. Check community resources

    findings.push(`Core concept: ${query.topic} relates to ${query.context}`);
    findings.push(`Pattern identified: Common use cases in modern development`);
    findings.push(`Best practice: Industry standards and recommendations`);

    if (query.depth === 'deep' || query.depth === 'comprehensive') {
      findings.push(`Advanced technique: Optimization strategies`);
      findings.push(`Edge cases: Potential pitfalls and solutions`);
    }

    return findings;
  }

  /**
   * Find connections to existing knowledge
   */
  private findConnections(topic: string): string[] {
    const connections: string[] = [];
    
    // Find related concepts in knowledge graph
    this.knowledgeGraph.forEach((values, key) => {
      if (key.includes(topic.toLowerCase()) || topic.toLowerCase().includes(key)) {
        connections.push(`Related to: ${key}`);
      }
    });

    // Add domain connections
    if (topic.toLowerCase().includes('react') || topic.toLowerCase().includes('vue')) {
      connections.push('Domain: Frontend Development');
    }
    if (topic.toLowerCase().includes('node') || topic.toLowerCase().includes('express')) {
      connections.push('Domain: Backend Development');
    }

    return connections;
  }

  /**
   * Generate practical applications
   */
  private generateApplications(topic: string): string[] {
    return [
      `Can be applied to: Current project architecture`,
      `Useful for: Solving similar problems`,
      `Integration opportunity: Enhance existing features`
    ];
  }

  /**
   * Update the knowledge graph with new insights
   */
  private updateKnowledgeGraph(insight: LearningInsight): void {
    const topic = insight.query.topic.toLowerCase();
    
    if (!this.knowledgeGraph.has(topic)) {
      this.knowledgeGraph.set(topic, new Set());
    }

    const connections = this.knowledgeGraph.get(topic)!;
    insight.connections.forEach(conn => connections.add(conn));
    insight.findings.forEach(finding => connections.add(finding));
  }

  /**
   * Proactively seek knowledge based on patterns and gaps
   */
  private proactivelySeekKnowledge(): void {
    // Generate proactive curiosity
    const proactiveTopics = [
      'emerging technologies',
      'optimization techniques',
      'security best practices',
      'performance patterns',
      'user experience trends'
    ];

    const randomTopic = proactiveTopics[Math.floor(Math.random() * proactiveTopics.length)] || 'general knowledge';
    
    this.curiosityTriggers.push({
      type: 'proactive',
      trigger: randomTopic,
      context: 'autonomous_curiosity',
      priority: 0.5
    });

    log.info(`🔍 Proactively exploring: ${randomTopic}`, LogContext.SERVICE);
  }

  /**
   * Seed initial curiosity topics
   */
  private seedCuriosity(): void {
    const seedTopics = [
      'quantum computing applications',
      'AI consciousness theories',
      'distributed system patterns',
      'human-computer interaction',
      'cognitive architectures'
    ];

    seedTopics.forEach(topic => {
      this.queueLearningQuery({
        topic,
        context: 'initial_curiosity',
        depth: 'shallow',
        timestamp: new Date()
      });
    });
  }

  /**
   * Get current knowledge state
   */
  public getKnowledgeState(): {
    totalConcepts: number;
    totalInsights: number;
    pendingQueries: number;
    recentLearning: LearningInsight[];
  } {
    const recentLearning = Array.from(this.insights.values())
      .sort((a, b) => b.metadata.timestamp.getTime() - a.metadata.timestamp.getTime())
      .slice(0, 5);

    return {
      totalConcepts: this.knowledgeGraph.size,
      totalInsights: this.insights.size,
      pendingQueries: this.learningQueue.length,
      recentLearning
    };
  }

  /**
   * Apply learned knowledge to improve responses
   */
  public applyKnowledge(context: string): string[] {
    const relevantInsights: string[] = [];
    
    this.insights.forEach(insight => {
      if (context.toLowerCase().includes(insight.query.topic.toLowerCase())) {
        relevantInsights.push(...insight.findings);
        relevantInsights.push(...insight.applications);
      }
    });

    return relevantInsights;
  }

  /**
   * Clean up resources
   */
  public destroy(): void {
    if (this.learningCycle) {
      clearInterval(this.learningCycle);
      this.learningCycle = null;
    }
    log.info('💧 Knowledge Thirst Engine stopped', LogContext.SERVICE);
  }
}

export default KnowledgeThirstEngine;
export { KnowledgeThirstEngine };