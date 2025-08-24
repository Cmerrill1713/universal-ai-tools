/**
 * Multi-Hop Reasoning Engine for Code Exploration
 * 
 * Implements sophisticated reasoning capabilities for ToolTrain-style code navigation
 * Supports complex query decomposition, relationship mapping, and adaptive search strategies
 */

import { EventEmitter } from 'events';
import { z } from 'zod';

import type { AgentContext } from '@/types';
import { log, LogContext } from '@/utils/logger';

import { mcpIntegrationService } from './mcp-integration-service';

// Multi-hop reasoning types
interface ReasoningNode {
  id: string;
  type: 'file' | 'function' | 'class' | 'interface' | 'variable' | 'import' | 'usage';
  name: string;
  location: {
    file: string;
    line?: number;
  };
  context: string;
  relevanceScore: number;
  relationships: Array<{
    target: string; // ID of related node
    type: 'imports' | 'exports' | 'calls' | 'inherits' | 'implements' | 'uses' | 'defines';
    strength: number; // 0-1, how strong the relationship is
  }>;
  metadata: Record<string, any>;
}

interface ReasoningPath {
  nodes: ReasoningNode[];
  edges: Array<{
    from: string;
    to: string;
    type: string;
    strength: number;
  }>;
  totalScore: number;
  confidence: number;
  reasoning: string;
}

interface MultiHopQuery {
  primaryGoal: string;
  context: string[];
  constraints: {
    maxDepth: number;
    maxNodes: number;
    relevanceThreshold: number;
    timeLimit: number;
  };
  preferences: {
    includeUsages: boolean;
    includeDependencies: boolean;
    includeInheritance: boolean;
    preferRecent: boolean;
  };
}

interface ReasoningResult {
  query: MultiHopQuery;
  paths: ReasoningPath[];
  knowledgeGraph: {
    nodes: ReasoningNode[];
    edges: Array<{ from: string; to: string; type: string; strength: number }>;
  };
  reasoningTrace: Array<{
    step: number;
    action: string;
    reasoning: string;
    result: any;
    confidence: number;
    timestamp: number;
  }>;
  performance: {
    totalTime: number;
    nodesExplored: number;
    toolCallsMade: number;
    pathsFound: number;
    averageConfidence: number;
  };
}

const MultiHopQuerySchema = z.object({
  primaryGoal: z.string(),
  context: z.array(z.string()).default([]),
  constraints: z.object({
    maxDepth: z.number().min(1).max(10).default(5),
    maxNodes: z.number().min(10).max(1000).default(100),
    relevanceThreshold: z.number().min(0).max(1).default(0.3),
    timeLimit: z.number().min(1000).max(300000).default(30000), // 30 seconds
  }).default({}),
  preferences: z.object({
    includeUsages: z.boolean().default(true),
    includeDependencies: z.boolean().default(true),
    includeInheritance: z.boolean().default(true),
    preferRecent: z.boolean().default(false),
  }).default({}),
});

/**
 * Multi-hop reasoning engine for code exploration
 */
export class MultiHopReasoningEngine extends EventEmitter {
  private knowledgeGraph = new Map<string, ReasoningNode>();
  private explorationHistory: Array<{
    query: string;
    result: ReasoningResult;
    timestamp: number;
  }> = [];
  private toolPerformanceCache = new Map<string, {
    averageTime: number;
    successRate: number;
    usageCount: number;
  }>();

  constructor() {
    super();
    log.info('Multi-hop reasoning engine initialized', LogContext.AI);
  }

  /**
   * Execute multi-hop reasoning for a code exploration query
   */
  async explore(query: string, context: AgentContext): Promise<ReasoningResult> {
    const startTime = Date.now();
    
    // Parse and validate query
    const parsedQuery = this.parseQuery(query, context);
    
    // Initialize reasoning state
    const reasoningState = {
      currentDepth: 0,
      exploredNodes: new Set<string>(),
      reasoningTrace: [] as ReasoningResult['reasoningTrace'],
      knowledgeGraph: {
        nodes: [] as ReasoningNode[],
        edges: [] as Array<{ from: string; to: string; type: string; strength: number }>,
      },
      toolCallCount: 0,
    };

    try {
      // Execute multi-hop exploration
      const paths = await this.executeMultiHopExploration(parsedQuery, reasoningState);
      
      // Build final result
      const result: ReasoningResult = {
        query: parsedQuery,
        paths,
        knowledgeGraph: reasoningState.knowledgeGraph,
        reasoningTrace: reasoningState.reasoningTrace,
        performance: {
          totalTime: Date.now() - startTime,
          nodesExplored: reasoningState.exploredNodes.size,
          toolCallsMade: reasoningState.toolCallCount,
          pathsFound: paths.length,
          averageConfidence: paths.length > 0 ? 
            paths.reduce((sum, p) => sum + p.confidence, 0) / paths.length : 0,
        },
      };

      // Store exploration history
      this.explorationHistory.push({
        query,
        result,
        timestamp: Date.now(),
      });

      // Keep only recent history
      if (this.explorationHistory.length > 50) {
        this.explorationHistory = this.explorationHistory.slice(-50);
      }

      log.info('Multi-hop exploration completed', LogContext.AI, {
        query,
        pathsFound: paths.length,
        nodesExplored: reasoningState.exploredNodes.size,
        totalTime: result.performance.totalTime,
      });

      return result;
    } catch (error) {
      log.error('Multi-hop exploration failed', LogContext.AI, {
        query,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Parse natural language query into structured multi-hop query
   */
  private parseQuery(query: string, context: AgentContext): MultiHopQuery {
    // Extract context from agent context
    const contextClues = [
      context.metadata?.workingDirectory || '',
      context.metadata?.currentFile || '',
      ...((context.metadata?.relevantFiles as string[]) || []),
    ].filter(Boolean);

    // Basic query parsing - in production, this could use LLM-based parsing
    const queryLower = query.toLowerCase();
    
    const baseQuery: MultiHopQuery = {
      primaryGoal: query,
      context: contextClues,
      constraints: {
        maxDepth: 5,
        maxNodes: 100,
        relevanceThreshold: 0.3,
        timeLimit: 30000,
      },
      preferences: {
        includeUsages: true,
        includeDependencies: true,
        includeInheritance: true,
        preferRecent: false,
      },
    };

    // Adjust based on query content
    if (queryLower.includes('find all') || queryLower.includes('everywhere')) {
      baseQuery.constraints.maxNodes = 200;
      baseQuery.constraints.maxDepth = 8;
    }

    if (queryLower.includes('usage') || queryLower.includes('used')) {
      baseQuery.preferences.includeUsages = true;
      baseQuery.constraints.maxDepth = 6;
    }

    if (queryLower.includes('inherit') || queryLower.includes('extend')) {
      baseQuery.preferences.includeInheritance = true;
    }

    if (queryLower.includes('import') || queryLower.includes('depend')) {
      baseQuery.preferences.includeDependencies = true;
    }

    return MultiHopQuerySchema.parse(baseQuery);
  }

  /**
   * Execute multi-hop exploration with adaptive reasoning
   */
  private async executeMultiHopExploration(
    query: MultiHopQuery,
    state: any
  ): Promise<ReasoningPath[]> {
    const startTime = Date.now();
    const {timeLimit} = query.constraints;
    
    // Step 1: Initial discovery phase
    await this.addReasoningStep(state, 'initial_discovery', 
      'Starting initial code discovery phase', null, 0.8);
    
    const initialNodes = await this.discoverInitialNodes(query, state);
    
    // Step 2: Relationship exploration phase
    await this.addReasoningStep(state, 'relationship_exploration',
      `Exploring relationships from ${initialNodes.length} initial nodes`, null, 0.7);
    
    const expandedNodes = await this.exploreRelationships(initialNodes, query, state, timeLimit - (Date.now() - startTime));
    
    // Step 3: Path construction phase
    await this.addReasoningStep(state, 'path_construction',
      'Constructing reasoning paths from discovered relationships', null, 0.9);
    
    const paths = await this.constructReasoningPaths(expandedNodes, query);
    
    // Step 4: Path ranking and filtering
    await this.addReasoningStep(state, 'path_ranking',
      `Ranking and filtering ${paths.length} candidate paths`, null, 0.8);
    
    const rankedPaths = this.rankAndFilterPaths(paths, query);
    
    return rankedPaths;
  }

  /**
   * Discover initial nodes based on query
   */
  private async discoverInitialNodes(query: MultiHopQuery, state: any): Promise<ReasoningNode[]> {
    const nodes: ReasoningNode[] = [];
    
    try {
      // Use code search to find initial matches
      const searchResult = await mcpIntegrationService.callTool('code-search', 'search_code', {
        query: query.primaryGoal,
        max_results: Math.min(20, query.constraints.maxNodes / 2),
        include_context: true,
      });
      
      state.toolCallCount++;
      
      if (searchResult && typeof searchResult === 'object' && 'results' in searchResult) {
        const results = searchResult.results as any[];
        
        for (const result of results) {
          const node: ReasoningNode = {
            id: `${result.type}_${result.file}_${result.line || 0}`,
            type: result.type,
            name: result.name,
            location: {
              file: result.file,
              line: result.line,
            },
            context: result.context || result.signature || '',
            relevanceScore: this.calculateRelevance(result, query),
            relationships: [],
            metadata: {
              signature: result.signature,
              originalSearchResult: result,
            },
          };
          
          nodes.push(node);
          state.knowledgeGraph.nodes.push(node);
          state.exploredNodes.add(node.id);
          this.knowledgeGraph.set(node.id, node);
        }
      }
    } catch (error) {
      log.warn('Initial node discovery failed', LogContext.AI, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    
    return nodes;
  }

  /**
   * Explore relationships from discovered nodes
   */
  private async exploreRelationships(
    initialNodes: ReasoningNode[],
    query: MultiHopQuery,
    state: any,
    remainingTime: number
  ): Promise<ReasoningNode[]> {
    const allNodes = [...initialNodes];
    const nodesToExplore = [...initialNodes];
    
    while (nodesToExplore.length > 0 && 
           state.currentDepth < query.constraints.maxDepth &&
           allNodes.length < query.constraints.maxNodes &&
           remainingTime > 0) {
      
      const nodeStartTime = Date.now();
      const currentNode = nodesToExplore.shift()!;
      state.currentDepth++;
      
      try {
        // Explore imports/dependencies
        if (query.preferences.includeDependencies) {
          const importNodes = await this.exploreImports(currentNode, query, state);
          allNodes.push(...importNodes);
          nodesToExplore.push(...importNodes.filter(n => 
            n.relevanceScore >= query.constraints.relevanceThreshold
          ));
        }
        
        // Explore usages
        if (query.preferences.includeUsages) {
          const usageNodes = await this.exploreUsages(currentNode, query, state);
          allNodes.push(...usageNodes);
          nodesToExplore.push(...usageNodes.filter(n => 
            n.relevanceScore >= query.constraints.relevanceThreshold
          ));
        }
        
        // Check time constraints
        remainingTime -= (Date.now() - nodeStartTime);
        if (remainingTime <= 1000) {break;} // Stop if less than 1 second remaining
        
      } catch (error) {
        log.warn('Node exploration failed', LogContext.AI, {
          nodeId: currentNode.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    
    return allNodes;
  }

  /**
   * Explore import relationships for a node
   */
  private async exploreImports(node: ReasoningNode, query: MultiHopQuery, state: any): Promise<ReasoningNode[]> {
    const importNodes: ReasoningNode[] = [];
    
    try {
      const traceResult = await mcpIntegrationService.callTool('code-search', 'trace_imports', {
        file_path: node.location.file,
        symbol: node.name,
        max_depth: 3,
      });
      
      state.toolCallCount++;
      
      if (traceResult && typeof traceResult === 'object' && 'import_chain' in traceResult) {
        const importChain = traceResult.import_chain as any[];
        
        for (const link of importChain) {
          for (const imp of link.imports || []) {
            for (const symbol of imp.symbols || []) {
              const importNode: ReasoningNode = {
                id: `import_${symbol}_${link.file}_${imp.line}`,
                type: 'import',
                name: symbol,
                location: {
                  file: link.file,
                  line: imp.line,
                },
                context: `import ${symbol} from ${imp.module}`,
                relevanceScore: this.calculateImportRelevance(symbol, query),
                relationships: [{
                  target: node.id,
                  type: 'imports',
                  strength: 0.8,
                }],
                metadata: {
                  module: imp.module,
                  depth: link.depth,
                },
              };
              
              importNodes.push(importNode);
              
              // Add edge to knowledge graph
              state.knowledgeGraph.edges.push({
                from: importNode.id,
                to: node.id,
                type: 'imports',
                strength: 0.8,
              });
            }
          }
        }
      }
    } catch (error) {
      log.debug('Import exploration failed', LogContext.AI, {
        nodeId: node.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    
    return importNodes;
  }

  /**
   * Explore usage relationships for a node
   */
  private async exploreUsages(node: ReasoningNode, query: MultiHopQuery, state: any): Promise<ReasoningNode[]> {
    const usageNodes: ReasoningNode[] = [];
    
    try {
      const usageResult = await mcpIntegrationService.callTool('code-search', 'find_usages', {
        symbol: node.name,
        symbol_type: node.type,
        include_definitions: false,
      });
      
      state.toolCallCount++;
      
      if (usageResult && typeof usageResult === 'object' && 'usages' in usageResult) {
        const usages = usageResult.usages as any[];
        
        for (const usage of usages) {
          const usageNode: ReasoningNode = {
            id: `usage_${node.name}_${usage.file}_${usage.line}`,
            type: 'usage',
            name: `${node.name} usage`,
            location: {
              file: usage.file,
              line: usage.line,
            },
            context: usage.usage_context || usage.surrounding_context || '',
            relevanceScore: usage.confidence || this.calculateUsageRelevance(usage, query),
            relationships: [{
              target: node.id,
              type: 'uses',
              strength: usage.confidence || 0.6,
            }],
            metadata: {
              usageContext: usage.usage_context,
              originalUsage: usage,
            },
          };
          
          usageNodes.push(usageNode);
          
          // Add edge to knowledge graph
          state.knowledgeGraph.edges.push({
            from: usageNode.id,
            to: node.id,
            type: 'uses',
            strength: usage.confidence || 0.6,
          });
        }
      }
    } catch (error) {
      log.debug('Usage exploration failed', LogContext.AI, {
        nodeId: node.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    
    return usageNodes;
  }

  /**
   * Construct reasoning paths from explored nodes
   */
  private async constructReasoningPaths(nodes: ReasoningNode[], query: MultiHopQuery): Promise<ReasoningPath[]> {
    const paths: ReasoningPath[] = [];
    
    // Group nodes by relevance and type
    const highRelevanceNodes = nodes.filter(n => n.relevanceScore >= 0.7);
    const mediumRelevanceNodes = nodes.filter(n => n.relevanceScore >= 0.4 && n.relevanceScore < 0.7);
    
    // Create paths starting from high-relevance nodes
    for (const startNode of highRelevanceNodes) {
      const path = await this.buildPathFromNode(startNode, nodes, query);
      if (path.totalScore >= query.constraints.relevanceThreshold) {
        paths.push(path);
      }
    }
    
    // If we don't have enough paths, include medium-relevance starting points
    if (paths.length < 3) {
      for (const startNode of mediumRelevanceNodes) {
        const path = await this.buildPathFromNode(startNode, nodes, query);
        if (path.totalScore >= query.constraints.relevanceThreshold * 0.7) {
          paths.push(path);
        }
      }
    }
    
    return paths;
  }

  /**
   * Build a reasoning path starting from a specific node
   */
  private async buildPathFromNode(startNode: ReasoningNode, allNodes: ReasoningNode[], query: MultiHopQuery): Promise<ReasoningPath> {
    const pathNodes = [startNode];
    const pathEdges: Array<{ from: string; to: string; type: string; strength: number }> = [];
    
    // Find connected nodes through relationships
    let currentNode = startNode;
    const visited = new Set([startNode.id]);
    
    for (let depth = 0; depth < query.constraints.maxDepth - 1; depth++) {
      const relatedNode = this.findBestRelatedNode(currentNode, allNodes, visited, query);
      
      if (!relatedNode) {break;}
      
      pathNodes.push(relatedNode);
      pathEdges.push({
        from: currentNode.id,
        to: relatedNode.id,
        type: 'related',
        strength: relatedNode.relevanceScore,
      });
      
      visited.add(relatedNode.id);
      currentNode = relatedNode;
    }
    
    // Calculate path score
    const totalScore = pathNodes.reduce((sum, node) => sum + node.relevanceScore, 0) / pathNodes.length;
    const confidence = Math.min(0.95, totalScore * pathNodes.length / query.constraints.maxDepth);
    
    // Generate reasoning
    const reasoning = this.generatePathReasoning(pathNodes, query);
    
    return {
      nodes: pathNodes,
      edges: pathEdges,
      totalScore,
      confidence,
      reasoning,
    };
  }

  /**
   * Find the best related node for path construction
   */
  private findBestRelatedNode(
    currentNode: ReasoningNode, 
    allNodes: ReasoningNode[], 
    visited: Set<string>, 
    query: MultiHopQuery
  ): ReasoningNode | null {
    let bestNode: ReasoningNode | null = null;
    let bestScore = 0;
    
    for (const node of allNodes) {
      if (visited.has(node.id)) {continue;}
      
      // Check for relationships
      const hasRelationship = currentNode.relationships.some(rel => rel.target === node.id) ||
                             node.relationships.some(rel => rel.target === currentNode.id);
      
      if (hasRelationship || this.areNodesRelated(currentNode, node)) {
        const score = node.relevanceScore * this.calculateNodeSimilarity(currentNode, node);
        
        if (score > bestScore) {
          bestScore = score;
          bestNode = node;
        }
      }
    }
    
    return bestNode;
  }

  /**
   * Check if two nodes are related by location or context
   */
  private areNodesRelated(node1: ReasoningNode, node2: ReasoningNode): boolean {
    // Same file
    if (node1.location.file === node2.location.file) {return true;}
    
    // Similar names
    if (node1.name.includes(node2.name) || node2.name.includes(node1.name)) {return true;}
    
    // Same type and related context
    if (node1.type === node2.type && 
        (node1.context.includes(node2.name) || node2.context.includes(node1.name))) {
      return true;
    }
    
    return false;
  }

  /**
   * Calculate similarity between two nodes
   */
  private calculateNodeSimilarity(node1: ReasoningNode, node2: ReasoningNode): number {
    let similarity = 0;
    
    // Same file bonus
    if (node1.location.file === node2.location.file) {similarity += 0.3;}
    
    // Same type bonus
    if (node1.type === node2.type) {similarity += 0.2;}
    
    // Name similarity
    const nameOverlap = this.calculateStringOverlap(node1.name, node2.name);
    similarity += nameOverlap * 0.3;
    
    // Context similarity
    const contextOverlap = this.calculateStringOverlap(node1.context, node2.context);
    similarity += contextOverlap * 0.2;
    
    return Math.min(1.0, similarity);
  }

  /**
   * Calculate string overlap between two strings
   */
  private calculateStringOverlap(str1: string, str2: string): number {
    const words1 = str1.toLowerCase().split(/\W+/).filter(w => w.length > 2);
    const words2 = str2.toLowerCase().split(/\W+/).filter(w => w.length > 2);
    
    if (words1.length === 0 || words2.length === 0) {return 0;}
    
    const overlap = words1.filter(w => words2.includes(w)).length;
    return overlap / Math.max(words1.length, words2.length);
  }

  /**
   * Generate human-readable reasoning for a path
   */
  private generatePathReasoning(nodes: ReasoningNode[], query: MultiHopQuery): string {
    if (nodes.length === 0) {return 'No reasoning path found.';}
    
    if (nodes.length === 1) {
      const node = nodes[0];
      return `Found direct match: ${node?.name || 'unknown'} in ${node?.location?.file || 'unknown'}`;
    }
    
    const startNode = nodes[0];
    const endNode = nodes[nodes.length - 1];
    
    if (!startNode || !endNode) {
      return 'Invalid reasoning path - missing nodes.';
    }
    
    let reasoning = `Starting from ${startNode?.name || 'unknown'} (${startNode?.type || 'unknown'}) in ${startNode?.location?.file || 'unknown'}`;
    
    if (nodes.length > 2) {
      reasoning += `, following relationships through ${nodes.length - 2} intermediate nodes`;
    }
    
    reasoning += `, leading to ${endNode?.name || 'unknown'} (${endNode?.type || 'unknown'}) in ${endNode?.location?.file || 'unknown'}.`;
    
    // Add specific relationship details
    const relationshipTypes = new Set(nodes.flatMap(n => n.relationships.map(r => r.type)));
    if (relationshipTypes.size > 0) {
      reasoning += ` Relationships include: ${Array.from(relationshipTypes).join(', ')}.`;
    }
    
    return reasoning;
  }

  /**
   * Rank and filter paths based on quality
   */
  private rankAndFilterPaths(paths: ReasoningPath[], query: MultiHopQuery): ReasoningPath[] {
    // Sort by total score and confidence
    const sortedPaths = paths.sort((a, b) => 
      (b.totalScore * b.confidence) - (a.totalScore * a.confidence)
    );
    
    // Filter by relevance threshold
    const filteredPaths = sortedPaths.filter(path => 
      path.totalScore >= query.constraints.relevanceThreshold
    );
    
    // Return top 10 paths
    return filteredPaths.slice(0, 10);
  }

  /**
   * Calculate relevance score for a search result
   */
  private calculateRelevance(result: any, query: MultiHopQuery): number {
    let score = 0;
    
    const queryLower = query.primaryGoal.toLowerCase();
    const nameLower = (result.name || '').toLowerCase();
    
    // Exact match
    if (nameLower === queryLower) {score += 1.0;} else if (nameLower.includes(queryLower)) {score += 0.8;} else if (queryLower.includes(nameLower)) {score += 0.6;}
    
    // Type bonus
    if (result.type === 'function' && queryLower.includes('function')) {score += 0.2;}
    if (result.type === 'class' && queryLower.includes('class')) {score += 0.2;}
    
    // Context match
    const context = (result.context || result.signature || '').toLowerCase();
    if (context.includes(queryLower)) {score += 0.3;}
    
    return Math.min(1.0, score);
  }

  /**
   * Calculate relevance for import relationships
   */
  private calculateImportRelevance(symbol: string, query: MultiHopQuery): number {
    const queryLower = query.primaryGoal.toLowerCase();
    const symbolLower = symbol.toLowerCase();
    
    if (symbolLower.includes(queryLower) || queryLower.includes(symbolLower)) {
      return 0.7;
    }
    
    return 0.4; // Base relevance for imports
  }

  /**
   * Calculate relevance for usage relationships
   */
  private calculateUsageRelevance(usage: any, query: MultiHopQuery): number {
    const queryLower = query.primaryGoal.toLowerCase();
    const context = (usage.usage_context || usage.surrounding_context || '').toLowerCase();
    
    if (context.includes(queryLower)) {
      return 0.8;
    }
    
    return 0.5; // Base relevance for usages
  }

  /**
   * Add a reasoning step to the trace
   */
  private async addReasoningStep(
    state: any, 
    action: string, 
    reasoning: string, 
    result: any, 
    confidence: number
  ): Promise<void> {
    state.reasoningTrace.push({
      step: state.reasoningTrace.length + 1,
      action,
      reasoning,
      result,
      confidence,
      timestamp: Date.now(),
    });
  }

  /**
   * Get exploration history for analysis
   */
  getExplorationHistory(): Array<{ query: string; result: ReasoningResult; timestamp: number }> {
    return [...this.explorationHistory];
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics() {
    const totalExplorations = this.explorationHistory.length;
    
    if (totalExplorations === 0) {
      return {
        totalExplorations: 0,
        averageTime: 0,
        averagePathsFound: 0,
        averageConfidence: 0,
        toolPerformance: Object.fromEntries(this.toolPerformanceCache),
      };
    }
    
    const avgTime = this.explorationHistory.reduce((sum, ex) => sum + ex.result.performance.totalTime, 0) / totalExplorations;
    const avgPaths = this.explorationHistory.reduce((sum, ex) => sum + ex.result.performance.pathsFound, 0) / totalExplorations;
    const avgConfidence = this.explorationHistory.reduce((sum, ex) => sum + ex.result.performance.averageConfidence, 0) / totalExplorations;
    
    return {
      totalExplorations,
      averageTime: avgTime,
      averagePathsFound: avgPaths,
      averageConfidence: avgConfidence,
      toolPerformance: Object.fromEntries(this.toolPerformanceCache),
    };
  }
}

// Export singleton instance
export const multiHopReasoningEngine = new MultiHopReasoningEngine();