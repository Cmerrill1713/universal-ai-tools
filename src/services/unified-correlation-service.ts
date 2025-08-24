/**
 * Unified Correlation Service
 * Correlates data across different services and provides unified insights
 */

export interface CorrelationEvent {
  id: string;
  timestamp: Date;
  service: string;
  type: string;
  data: Record<string, any>;
  correlationId?: string;
}

export interface CorrelationPattern {
  id: string;
  name: string;
  description: string;
  events: CorrelationEvent[];
  confidence: number;
  frequency: number;
}

export interface CorrelationInsight {
  pattern: CorrelationPattern;
  impact: 'low' | 'medium' | 'high';
  recommendation: string;
  actionable: boolean;
}

export class UnifiedCorrelationService {
  private events: CorrelationEvent[] = [];
  private patterns: CorrelationPattern[] = [];
  private readonly maxEvents = 10000;

  /**
   * Initialize the service (for compatibility)
   */
  async initialize(): Promise<void> {
    // Service is ready immediately - no async initialization needed
    return Promise.resolve();
  }

  /**
   * Record a correlation event
   */
  recordEvent(event: Omit<CorrelationEvent, 'id' | 'timestamp'>): void {
    const correlationEvent: CorrelationEvent = {
      id: this.generateId(),
      timestamp: new Date(),
      ...event
    };

    this.events.push(correlationEvent);

    // Maintain event history limit
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }

    // Trigger pattern analysis for new events
    this.analyzePatterns();
  }

  /**
   * Get correlation insights
   */
  getInsights(): CorrelationInsight[] {
    const insights: CorrelationInsight[] = [];

    for (const pattern of this.patterns) {
      if (pattern.confidence > 0.7) {
        insights.push({
          pattern,
          impact: this.calculateImpact(pattern),
          recommendation: this.generateRecommendation(pattern),
          actionable: pattern.confidence > 0.8 && pattern.frequency > 5
        });
      }
    }

    return insights.sort((a, b) => b.pattern.confidence - a.pattern.confidence);
  }

  /**
   * Get events by correlation ID
   */
  getEventsByCorrelationId(correlationId: string): CorrelationEvent[] {
    return this.events.filter(event => event.correlationId === correlationId);
  }

  /**
   * Get events by service
   */
  getEventsByService(service: string): CorrelationEvent[] {
    return this.events.filter(event => event.service === service);
  }

  /**
   * Find correlations between services
   */
  findServiceCorrelations(serviceA: string, serviceB: string): {
    correlation: number;
    commonPatterns: string[];
    recommendations: string[];
  } {
    const eventsA = this.getEventsByService(serviceA);
    const eventsB = this.getEventsByService(serviceB);

    // Simple correlation calculation based on temporal proximity
    let correlatedEvents = 0;
    const timeWindow = 5000; // 5 seconds

    for (const eventA of eventsA) {
      const correlatedB = eventsB.find(eventB => 
        Math.abs(eventA.timestamp.getTime() - eventB.timestamp.getTime()) < timeWindow
      );
      if (correlatedB) {correlatedEvents++;}
    }

    const correlation = eventsA.length > 0 ? correlatedEvents / eventsA.length : 0;

    return {
      correlation: Math.round(correlation * 100) / 100,
      commonPatterns: this.findCommonPatterns(serviceA, serviceB),
      recommendations: this.generateServiceRecommendations(serviceA, serviceB, correlation)
    };
  }

  /**
   * Get system-wide correlation statistics
   */
  getCorrelationStats(): {
    totalEvents: number;
    totalPatterns: number;
    topServices: Array<{ name: string; eventCount: number }>;
    correlationHealth: 'good' | 'fair' | 'poor';
  } {
    const serviceCounts = this.events.reduce((acc, event) => {
      acc[event.service] = (acc[event.service] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topServices = Object.entries(serviceCounts)
      .map(([name, count]) => ({ name, eventCount: count }))
      .sort((a, b) => b.eventCount - a.eventCount)
      .slice(0, 5);

    const highConfidencePatterns = this.patterns.filter(p => p.confidence > 0.8).length;
    const totalPatterns = this.patterns.length;
    
    let correlationHealth: 'good' | 'fair' | 'poor' = 'poor';
    if (totalPatterns > 0) {
      const healthRatio = highConfidencePatterns / totalPatterns;
      if (healthRatio > 0.7) {correlationHealth = 'good';} else if (healthRatio > 0.4) {correlationHealth = 'fair';}
    }

    return {
      totalEvents: this.events.length,
      totalPatterns: this.patterns.length,
      topServices,
      correlationHealth
    };
  }

  private analyzePatterns(): void {
    // Simple pattern analysis - in practice, this would be more sophisticated
    const recentEvents = this.events.slice(-100); // Analyze last 100 events
    
    // Group events by type and service
    const groups = recentEvents.reduce((acc, event) => {
      const key = `${event.service}-${event.type}`;
      if (!acc[key]) {acc[key] = [];}
      acc[key].push(event);
      return acc;
    }, {} as Record<string, CorrelationEvent[]>);

    // Create patterns for frequently occurring event combinations
    for (const [key, events] of Object.entries(groups)) {
      if (events.length >= 3) { // Minimum 3 occurrences to be considered a pattern
        const existingPattern = this.patterns.find(p => p.name === key);
        
        if (existingPattern) {
          existingPattern.events = events;
          existingPattern.frequency += 1;
          existingPattern.confidence = Math.min(0.95, existingPattern.confidence + 0.05);
        } else {
          this.patterns.push({
            id: this.generateId(),
            name: key,
            description: `Recurring pattern in ${key}`,
            events,
            confidence: 0.6,
            frequency: 1
          });
        }
      }
    }

    // Limit pattern storage
    this.patterns = this.patterns.slice(-50);
  }

  private calculateImpact(pattern: CorrelationPattern): 'low' | 'medium' | 'high' {
    if (pattern.frequency > 20 && pattern.confidence > 0.9) {return 'high';}
    if (pattern.frequency > 10 && pattern.confidence > 0.8) {return 'medium';}
    return 'low';
  }

  private generateRecommendation(pattern: CorrelationPattern): string {
    const [service, type] = pattern.name.split('-');
    
    if (pattern.confidence > 0.9 && pattern.frequency > 15) {
      return `Consider optimizing ${service} service for ${type} events due to high frequency`;
    }
    
    if (pattern.confidence > 0.8) {
      return `Monitor ${service} service for potential ${type} event clustering`;
    }

    return `Review ${service} service ${type} event patterns for optimization opportunities`;
  }

  private findCommonPatterns(serviceA: string, serviceB: string): string[] {
    return this.patterns
      .filter(pattern => 
        pattern.events.some(e => e.service === serviceA) &&
        pattern.events.some(e => e.service === serviceB)
      )
      .map(pattern => pattern.name);
  }

  private generateServiceRecommendations(serviceA: string, serviceB: string, correlation: number): string[] {
    const recommendations: string[] = [];

    if (correlation > 0.8) {
      recommendations.push(`High correlation detected - consider consolidating ${serviceA} and ${serviceB}`);
    } else if (correlation > 0.5) {
      recommendations.push(`Moderate correlation - monitor interaction patterns between ${serviceA} and ${serviceB}`);
    } else if (correlation < 0.2) {
      recommendations.push(`Low correlation - services ${serviceA} and ${serviceB} operate independently`);
    }

    return recommendations;
  }

  private generateId(): string {
    return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const unifiedCorrelationService = new UnifiedCorrelationService();