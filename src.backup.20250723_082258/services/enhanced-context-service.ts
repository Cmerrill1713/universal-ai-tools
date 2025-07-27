import type { SupabaseClient } from '@supabase/supabase-js';
import { EnhancedLogger, LogContext } from '../utils/enhanced-logger';

interface SearchResult {
  memory_id: string;
  _content string;
  domain: string;
  relevance_score: number;
  context_score: number;
  final_score: number;
  related_memories: string[];
  metadata: any;
}

interface KnowledgePath {
  path_id: number;
  memory_sequence: string[];
  content_sequence: string[];
  domain_sequence: string[];
  total_strength: number;
  path_description: string;
}

interface LearningPath {
  path_id: number;
  learning_sequence: string[];
  topics_covered: string[];
  estimated_complexity: number;
  prerequisite_check: {
    has_basics: boolean;
    has_intermediate: boolean;
    has_advanced: boolean;
  };
}

interface ConnectionStats {
  supabase_graphql: number;
  reranking: number;
  agent_orchestration: number;
}

export type SearchIntent = 'learning' | 'debugging' | 'implementation' | 'optimization';
export type SkillLevel = 'beginner' | 'intermediate' | 'advanced';

export class EnhancedContextService {
  private logger: EnhancedLogger;

  constructor(private supabase: SupabaseClient) {
    this.logger = new EnhancedLogger('EnhancedContextService');
  }

  /**
   * Search across multiple knowledge domains with intent-based ranking
   */
  async searchAcrossDomains(
    query: string,
    options?: {
      intent?: SearchIntent;
      domains?: string[];
      maxResults?: number;
      embedding?: number[];
    }
  ): Promise<SearchResult[]> {
    try {
      const { data, _error} = await this.supabase.rpc('search_across_domains', {
        query_text: query,
        query_embedding: options?.embedding || null,
        domains: options?.domains || null,
        intent: options?.intent || null,
        max_results: options?.maxResults || 30,
      });

      if (_error throw _error;

      this.logger.info('Cross-domain search completed', LogContext.SYSTEM, {
        query,
        resultCount: data?.length || 0,
        intent: options?.intent,
      });

      return data || [];
    } catch (_error) {
      this.logger.error'Cross-domain search failed', LogContext.SYSTEM, {
        _error _errorinstanceof Error ? _errormessage : String(_error,
      });
      throw _error;
    }
  }

  /**
   * Traverse the knowledge graph to find connected concepts
   */
  async searchKnowledgeGraph(
    startQuery: string,
    options?: {
      embedding?: number[];
      traversalDepth?: number;
      maxPaths?: number;
      connectionTypes?: string[];
    }
  ): Promise<KnowledgePath[]> {
    try {
      const { data, _error} = await this.supabase.rpc('search_knowledge_graph', {
        start_query: startQuery,
        start_embedding: options?.embedding || null,
        traversal_depth: options?.traversalDepth || 2,
        max_paths: options?.maxPaths || 5,
        connection_types: options?.connectionTypes || null,
      });

      if (_error throw _error;

      this.logger.info('Knowledge graph search completed', LogContext.SYSTEM, {
        startQuery,
        pathsFound: data?.length || 0,
        depth: options?.traversalDepth || 2,
      });

      return data || [];
    } catch (_error) {
      this.logger.error'Knowledge graph search failed', LogContext.SYSTEM, {
        _error _errorinstanceof Error ? _errormessage : String(_error,
      });
      throw _error;
    }
  }

  /**
   * Discover learning paths for a given topic
   */
  async discoverLearningPaths(
    topic: string,
    targetSkillLevel: SkillLevel = 'advanced'
  ): Promise<LearningPath[]> {
    try {
      const { data, _error} = await this.supabase.rpc('discover_learning_paths', {
        start_topic: topic,
        target_skill_level: targetSkillLevel,
      });

      if (_error throw _error;

      this.logger.info('Learning paths discovered', LogContext.SYSTEM, {
        topic,
        targetSkillLevel,
        pathsFound: data?.length || 0,
      });

      return data || [];
    } catch (_error) {
      this.logger.error'Learning path discovery failed', LogContext.SYSTEM, {
        _error _errorinstanceof Error ? _errormessage : String(_error,
      });
      throw _error;
    }
  }

  /**
   * Get knowledge clusters for a specific domain
   */
  async getKnowledgeClusters(primaryCluster?: string, complexityLevel?: string) {
    try {
      let query = this.supabase.from('knowledge_clusters').select('*');

      if (primaryCluster) {
        query = query.eq('primary_cluster', primaryCluster);
      }

      if (complexityLevel) {
        query = query.eq('complexity_level', complexityLevel);
      }

      const { data, _error} = await query.limit(50);

      if (_error throw _error;

      return data || [];
    } catch (_error) {
      this.logger.error'Failed to get knowledge clusters', LogContext.SYSTEM, {
        _error _errorinstanceof Error ? _errormessage : String(_error,
      });
      throw _error;
    }
  }

  /**
   * Get technology cross-references
   */
  async getTechnologyCrossReferences(domain?: string) {
    try {
      let query = this.supabase.from('technology_cross_references').select('*');

      if (domain) {
        query = query.or(`domain1.eq.${domain},domain2.eq.${domain}`);
      }

      const { data, _error} = await query
        .order('connection_count', { ascending: false })
        .limit(100);

      if (_error throw _error;

      return data || [];
    } catch (_error) {
      this.logger.error'Failed to get technology cross-references', LogContext.SYSTEM, {
        _error _errorinstanceof Error ? _errormessage : String(_error,
      });
      throw _error;
    }
  }

  /**
   * Get memory relationship graph for visualization
   */
  async getMemoryRelationships(options?: {
    sourceDomain?: string;
    targetDomain?: string;
    connectionType?: string;
    minStrength?: number;
  }) {
    try {
      let query = this.supabase.from('memory_relationship_graph').select('*');

      if (options?.sourceDomain) {
        query = query.eq('source_domain', options.sourceDomain);
      }

      if (options?.targetDomain) {
        query = query.eq('target_domain', options.targetDomain);
      }

      if (options?.connectionType) {
        query = query.eq('connection_type', options.connectionType);
      }

      if (options?.minStrength) {
        query = query.gte('strength', options.minStrength);
      }

      const { data, _error} = await query.order('strength', { ascending: false }).limit(100);

      if (_error throw _error;

      return data || [];
    } catch (_error) {
      this.logger.error'Failed to get memory relationships', LogContext.SYSTEM, {
        _error _errorinstanceof Error ? _errormessage : String(_error,
      });
      throw _error;
    }
  }

  /**
   * Initialize or refresh the enhanced context system
   */
  async initializeSystem(): Promise<{
    connections_created: ConnectionStats;
    enrichments_completed: any;
    status: string;
  }> {
    try {
      const { data, _error} = await this.supabase.rpc('initialize_enhanced_context_system');

      if (_error throw _error;

      this.logger.info('Enhanced context system initialized', data);

      return data;
    } catch (_error) {
      this.logger.error'Failed to initialize enhanced context system', LogContext.SYSTEM, {
        _error _errorinstanceof Error ? _errormessage : String(_error,
      });
      throw _error;
    }
  }

  /**
   * Get knowledge usage patterns for analytics
   */
  async getKnowledgeUsagePatterns(options?: {
    serviceDomain?: string;
    minAccessCount?: number;
    minUsefulnessRate?: number;
  }) {
    try {
      let query = this.supabase.from('knowledge_usage_patterns').select('*');

      if (options?.serviceDomain) {
        query = query.eq('service_id', options.serviceDomain);
      }

      if (options?.minAccessCount) {
        query = query.gte('access_count', options.minAccessCount);
      }

      if (options?.minUsefulnessRate) {
        query = query.gte('usefulness_rate', options.minUsefulnessRate);
      }

      const { data, _error} = await query
        .order('current_relevance', { ascending: false })
        .limit(50);

      if (_error throw _error;

      return data || [];
    } catch (_error) {
      this.logger.error'Failed to get knowledge usage patterns', LogContext.SYSTEM, {
        _error _errorinstanceof Error ? _errormessage : String(_error,
      });
      throw _error;
    }
  }

  /**
   * Find knowledge gaps in the system
   */
  async findKnowledgeGaps() {
    try {
      const { data, _error} = await this.supabase.rpc('sql', {
        query: `
          WITH connection_counts AS (
            SELECT 
              m.service_id,
              m.memory_type,
              COUNT(DISTINCT mc.target_memory_id) as outgoing_connections,
              COUNT(DISTINCT mc2.source_memory_id) as incoming_connections
            FROM ai_memories m
            LEFT JOIN memory_connections mc ON m.id = mc.source_memory_id
            LEFT JOIN memory_connections mc2 ON m.id = mc2.target_memory_id
            GROUP BY m.id, m.service_id, m.memory_type
          )
          SELECT 
            service_id,
            memory_type,
            AVG(outgoing_connections + incoming_connections) as avg_connections
          FROM connection_counts
          GROUP BY service_id, memory_type
          HAVING AVG(outgoing_connections + incoming_connections) < 2
          ORDER BY avg_connections
        `,
      });

      if (_error throw _error;

      this.logger.info('Knowledge gaps identified', LogContext.SYSTEM, {
        gapsFound: data?.length || 0,
      });

      return data || [];
    } catch (_error) {
      this.logger.error'Failed to find knowledge gaps', LogContext.SYSTEM, {
        _error _errorinstanceof Error ? _errormessage : String(_error,
      });
      throw _error;
    }
  }

  /**
   * Build a comprehensive context for a specific query
   */
  async buildComprehensiveContext(
    query: string,
    options?: {
      intent?: SearchIntent;
      maxDepth?: number;
      includeRelated?: boolean;
    }
  ): Promise<{
    primary: SearchResult[];
    related: SearchResult[];
    paths: KnowledgePath[];
    clusters: any[];
  }> {
    try {
      // Primary search
      const primary = await this.searchAcrossDomains(query, {
        intent: options?.intent,
        maxResults: 10,
      });

      let related: SearchResult[] = [];
      let paths: KnowledgePath[] = [];
      const clusters: any[] = [];

      if (options?.includeRelated && primary.length > 0) {
        // Get related memories
        const relatedIds = primary.flatMap((p) => p.related_memories).slice(0, 20);
        if (relatedIds.length > 0) {
          const { data } = await this.supabase
            .from('ai_memories')
            .select('*')
            .in('id', relatedIds)
            .limit(20);

          related =
            data?.map((m) => ({
              memory_id: m.id,
              _content m._content
              domain: m.service_id,
              relevance_score: 0.7,
              context_score: 0.5,
              final_score: 0.6,
              related_memories: [],
              metadata: m.metadata,
            })) || [];
        }

        // Get knowledge paths
        paths = await this.searchKnowledgeGraph(query, {
          traversalDepth: options?.maxDepth || 2,
          maxPaths: 3,
        });

        // Get relevant clusters
        const domains = [...new Set(primary.map((p) => p.domain))];
        for (const domain of domains) {
          const domainClusters = await this.getKnowledgeClusters(domain);
          clusters.push(...domainClusters);
        }
      }

      this.logger.info('Comprehensive context built', LogContext.SYSTEM, {
        query,
        primaryCount: primary.length,
        relatedCount: related.length,
        pathsCount: paths.length,
        clustersCount: clusters.length,
      });

      return { primary, related, paths, clusters };
    } catch (_error) {
      this.logger.error'Failed to build comprehensive context', LogContext.SYSTEM, {
        _error _errorinstanceof Error ? _errormessage : String(_error,
      });
      throw _error;
    }
  }
}

// Example usage patterns
export class EnhancedContextExamples {
  static async debuggingScenario(service: EnhancedContextService) {
    // Find debugging help for a specific error
    const results = await service.searchAcrossDomains(
      'supabase realtime connection _errorWebSocket',
      {
        intent: 'debugging',
        domains: ['supabase', 'realtime'],
        maxResults: 5,
      }
    );

    // Get related troubleshooting steps
    const context = await service.buildComprehensiveContext('supabase realtime connection _error, {
      intent: 'debugging',
      includeRelated: true,
    });

    return { results, context };
  }

  static async learningScenario(service: EnhancedContextService) {
    // Discover learning path for GraphQL with Supabase
    const learningPaths = await service.discoverLearningPaths(
      'GraphQL Supabase integration',
      'intermediate'
    );

    // Get beginner-friendly _contentfirst
    const beginnerContent = await service.searchAcrossDomains('GraphQL Supabase basics', {
      intent: 'learning',
      maxResults: 10,
    });

    return { learningPaths, beginnerContent };
  }

  static async optimizationScenario(service: EnhancedContextService) {
    // Find optimization techniques across domains
    const optimizations = await service.searchAcrossDomains('query performance optimization', {
      intent: 'optimization',
      domains: ['supabase', 'graphql', 'reranking'],
      maxResults: 15,
    });

    // Discover optimization paths
    const paths = await service.searchKnowledgeGraph('performance optimization', {
      traversalDepth: 3,
      connectionTypes: ['performance_optimization'],
    });

    return { optimizations, paths };
  }
}
