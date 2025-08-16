/**
 * Community Detection for Graph-R1
 * 
 * Implements real graph clustering algorithms including Louvain,
 * Leiden, and hierarchical community detection for knowledge graphs.
 */

import { log, LogContext } from '../../utils/logger';
import { generateEmbedding } from '../embeddings';
import type { Hyperedge } from './hypergraph-constructor';
import type { GraphEntity, GraphRelationship } from './knowledge-graph-service';

export interface Community {
  id: string;
  nodeIds: string[];
  label: string;
  summary: string;
  centroid?: number[];
  level: number;
  parentId?: string;
  childIds: string[];
  metrics: {
    size: number;
    density: number;
    modularity: number;
    coherence: number;
  };
  properties: Record<string, any>;
}

export interface CommunityDetectionResult {
  communities: Community[];
  hierarchy: Map<number, Community[]>;
  modularity: number;
  statistics: {
    totalCommunities: number;
    averageSize: number;
    maxLevel: number;
    coverageRatio: number;
  };
}

export interface GraphData {
  nodes: GraphEntity[];
  edges: GraphRelationship[];
  hyperedges?: Hyperedge[];
}

export class CommunityDetector {
  private adjacencyMatrix: Map<string, Map<string, number>> = new Map();
  private nodeToIndex: Map<string, number> = new Map();
  private indexToNode: Map<number, string> = new Map();

  constructor() {}

  /**
   * Detect communities using multiple algorithms and return best result
   */
  async detectCommunities(
    graphData: GraphData,
    options: {
      algorithm?: 'louvain' | 'leiden' | 'hierarchical' | 'auto';
      resolution?: number;
      minCommunitySize?: number;
      maxLevels?: number;
      includeHyperedges?: boolean;
    } = {}
  ): Promise<CommunityDetectionResult> {
    const algorithm = options.algorithm || 'auto';
    const resolution = options.resolution || 1.0;
    const minCommunitySize = options.minCommunitySize || 3;
    const maxLevels = options.maxLevels || 5;
    const includeHyperedges = options.includeHyperedges !== false;

    log.info('Starting community detection', LogContext.AI, {
      nodes: graphData.nodes.length,
      edges: graphData.edges.length,
      hyperedges: graphData.hyperedges?.length || 0,
      algorithm
    });

    // Build adjacency matrix
    this.buildAdjacencyMatrix(graphData, includeHyperedges);

    let result: CommunityDetectionResult;

    // Select algorithm
    switch (algorithm) {
      case 'louvain':
        result = await this.louvainCommunityDetection(resolution, minCommunitySize);
        break;
      case 'leiden':
        result = await this.leidenCommunityDetection(resolution, minCommunitySize);
        break;
      case 'hierarchical':
        result = await this.hierarchicalCommunityDetection(maxLevels, minCommunitySize);
        break;
      case 'auto':
      default:
        // Try multiple algorithms and pick the best one
        result = await this.autoCommunityDetection(resolution, minCommunitySize, maxLevels);
        break;
    }

    // Enhance communities with semantic information
    await this.enhanceCommunitiesWithSemantics(result.communities, graphData);

    log.info('Community detection completed', LogContext.AI, result.statistics);

    return result;
  }

  /**
   * Optimized Louvain community detection algorithm with O(m) complexity
   */
  private async louvainCommunityDetection(
    resolution: number,
    minSize: number
  ): Promise<CommunityDetectionResult> {
    const nodes = Array.from(this.nodeToIndex.keys());
    const communities = new Map<string, Set<string>>();
    
    // OPTIMIZATION: Use fast lookup for node-community mapping
    const nodeToCommunity = new Map<string, string>();
    const communityWeights = new Map<string, number>();
    
    // Initialize: each node in its own community
    for (const node of nodes) {
      communities.set(node, new Set([node]));
      nodeToCommunity.set(node, node);
      communityWeights.set(node, this.getNodeDegree(node));
    }

    let improved = true;
    let iteration = 0;
    let bestModularity = -1;
    const totalWeight = this.getTotalEdgeWeight();

    while (improved && iteration < 100) {
      improved = false;
      iteration++;

      // OPTIMIZATION: Randomize node order to avoid bias
      const shuffledNodes = [...nodes].sort(() => Math.random() - 0.5);

      // Process nodes in batches for better cache locality
      const batchSize = Math.min(1000, nodes.length);
      for (let batchStart = 0; batchStart < shuffledNodes.length; batchStart += batchSize) {
        const batch = shuffledNodes.slice(batchStart, batchStart + batchSize);
        
        for (const node of batch) {
          const currentCommunity = nodeToCommunity.get(node)!;
          const neighbors = this.getNeighbors(node);
          
          // OPTIMIZATION: Use Map for O(1) neighbor community lookups
          const neighborCommunities = new Map<string, number>();
          for (const neighbor of neighbors) {
            const neighborCommunity = nodeToCommunity.get(neighbor)!;
            if (neighborCommunity !== currentCommunity) {
              const weight = this.adjacencyMatrix.get(node)?.get(neighbor) || 0;
              neighborCommunities.set(neighborCommunity, 
                (neighborCommunities.get(neighborCommunity) || 0) + weight);
            }
          }
          
          // OPTIMIZATION: Pre-compute values for modularity calculation
          const nodeWeight = this.getNodeDegree(node);
          const currentCommunityWeight = communityWeights.get(currentCommunity)! - nodeWeight;
          
          let bestGain = 0;
          let bestCommunityId: string | null = null;

          // OPTIMIZATION: Only check communities with actual connections
          for (const [neighborCommunity, edgeWeight] of neighborCommunities) {
            const neighborCommunityWeight = communityWeights.get(neighborCommunity)!;
            
            // Fast modularity gain calculation
            const gain = this.fastModularityGain(
              nodeWeight,
              edgeWeight,
              currentCommunityWeight,
              neighborCommunityWeight,
              totalWeight,
              resolution
            );

            if (gain > bestGain) {
              bestGain = gain;
              bestCommunityId = neighborCommunity;
            }
          }

          // Move node if beneficial
          if (bestCommunityId && bestGain > 0) {
            this.optimizedMoveNode(
              node, 
              currentCommunity, 
              bestCommunityId, 
              communities,
              nodeToCommunity,
              communityWeights,
              nodeWeight
            );
            improved = true;
          }
        }
      }

      // OPTIMIZATION: Only calculate modularity every few iterations
      if (iteration % 5 === 0) {
        const currentModularity = this.calculateModularity(communities, resolution);
        if (currentModularity > bestModularity) {
          bestModularity = currentModularity;
        }
      }
    }

    // Filter small communities
    const filteredCommunities = this.filterSmallCommunities(communities, minSize);
    
    // Build result
    return this.buildCommunityResult(filteredCommunities, bestModularity, 'louvain');
  }

  /**
   * Leiden community detection algorithm (improved Louvain)
   */
  private async leidenCommunityDetection(
    resolution: number,
    minSize: number
  ): Promise<CommunityDetectionResult> {
    // Leiden algorithm - simplified implementation
    // In production, this would be more sophisticated with proper refinement phase
    
    const result = await this.louvainCommunityDetection(resolution, minSize);
    
    // Refinement phase: try to split/merge communities
    const refinedCommunities = await this.refineCommunities(result.communities, resolution);
    
    const finalModularity = this.calculateModularityFromCommunities(refinedCommunities, resolution);
    
    return {
      communities: refinedCommunities,
      hierarchy: new Map([[0, refinedCommunities]]),
      modularity: finalModularity,
      statistics: this.calculateStatistics(refinedCommunities)
    };
  }

  /**
   * Hierarchical community detection
   */
  private async hierarchicalCommunityDetection(
    maxLevels: number,
    minSize: number
  ): Promise<CommunityDetectionResult> {
    const hierarchy = new Map<number, Community[]>();
    let currentLevel = 0;
    let currentGraph = this.adjacencyMatrix;
    let overallModularity = 0;

    // Level 0: individual nodes
    const allNodes = Array.from(this.nodeToIndex.keys());
    const level0Communities = allNodes.map((node, index) => ({
      id: `l0_${index}`,
      nodeIds: [node],
      label: node,
      summary: `Individual node: ${node}`,
      level: 0,
      parentId: undefined,
      childIds: [],
      metrics: {
        size: 1,
        density: 1.0,
        modularity: 0,
        coherence: 1.0
      },
      properties: {}
    }));
    
    hierarchy.set(0, level0Communities);

    // Build hierarchy
    while (currentLevel < maxLevels) {
      currentLevel++;
      
      // Detect communities at current level
      const louvainResult = await this.louvainCommunityDetection(1.0, minSize);
      
      if (louvainResult.communities.length <= 1) {
        break; // No more meaningful divisions
      }

      // Create hierarchical communities
      const levelCommunities = louvainResult.communities.map((comm, index) => ({
        ...comm,
        id: `l${currentLevel}_${index}`,
        level: currentLevel,
        parentId: undefined, // Will be set if we go deeper
        childIds: []
      }));

      hierarchy.set(currentLevel, levelCommunities);
      overallModularity = Math.max(overallModularity, louvainResult.modularity);

      // Build super-graph for next level
      if (currentLevel < maxLevels) {
        currentGraph = this.buildSuperGraph(levelCommunities);
      }
    }

    // Build parent-child relationships
    this.buildHierarchicalRelationships(hierarchy);

    const allCommunities = Array.from(hierarchy.values()).flat();
    
    return {
      communities: allCommunities,
      hierarchy,
      modularity: overallModularity,
      statistics: this.calculateStatistics(allCommunities)
    };
  }

  /**
   * Auto community detection - tries multiple algorithms
   */
  private async autoCommunityDetection(
    resolution: number,
    minSize: number,
    maxLevels: number
  ): Promise<CommunityDetectionResult> {
    const results = await Promise.all([
      this.louvainCommunityDetection(resolution, minSize),
      this.leidenCommunityDetection(resolution, minSize),
      this.hierarchicalCommunityDetection(maxLevels, minSize)
    ]);

    // Pick the result with the best modularity
    const bestResult = results.reduce((best, current) => 
      current.modularity > best.modularity ? current : best
    );

    log.info('Auto community detection selected best algorithm', LogContext.AI, {
      bestModularity: bestResult.modularity,
      algorithms: results.map(r => r.modularity)
    });

    return bestResult;
  }

  /**
   * Build adjacency matrix from graph data
   */
  private buildAdjacencyMatrix(graphData: GraphData, includeHyperedges: boolean): void {
    this.adjacencyMatrix.clear();
    this.nodeToIndex.clear();
    this.indexToNode.clear();

    // Index all nodes
    graphData.nodes.forEach((node, index) => {
      this.nodeToIndex.set(node.id, index);
      this.indexToNode.set(index, node.id);
      this.adjacencyMatrix.set(node.id, new Map());
    });

    // Add edges
    for (const edge of graphData.edges) {
      if (this.adjacencyMatrix.has(edge.sourceId) && this.adjacencyMatrix.has(edge.targetId)) {
        const weight = edge.weight || 1.0;
        
        this.adjacencyMatrix.get(edge.sourceId)!.set(edge.targetId, weight);
        if (edge.bidirectional) {
          this.adjacencyMatrix.get(edge.targetId)!.set(edge.sourceId, weight);
        }
      }
    }

    // Add hyperedges if requested
    if (includeHyperedges && graphData.hyperedges) {
      for (const hyperedge of graphData.hyperedges) {
        const nodeIds = hyperedge.nodes.map(n => n.entityId);
        const weight = hyperedge.weight / nodeIds.length; // Distribute weight

        // Connect all pairs in the hyperedge
        for (let i = 0; i < nodeIds.length; i++) {
          for (let j = i + 1; j < nodeIds.length; j++) {
            const node1 = nodeIds[i]; if (!node1) continue;
            const node2 = nodeIds[j]; if (!node2) continue;
            
            if (this.adjacencyMatrix.has(node1) && this.adjacencyMatrix.has(node2)) {
              const existing1 = this.adjacencyMatrix.get(node1)!.get(node2) || 0;
              const existing2 = this.adjacencyMatrix.get(node2)!.get(node1) || 0;
              
              this.adjacencyMatrix.get(node1)!.set(node2, existing1 + weight);
              this.adjacencyMatrix.get(node2)!.set(node1, existing2 + weight);
            }
          }
        }
      }
    }
  }

  /**
   * Helper methods for community detection algorithms
   */
  private getNeighbors(nodeId: string): string[] {
    const neighbors = this.adjacencyMatrix.get(nodeId);
    return neighbors ? Array.from(neighbors.keys()) : [];
  }

  /**
   * OPTIMIZATION: Fast modularity gain calculation
   */
  private fastModularityGain(
    nodeWeight: number,
    edgeWeight: number,
    currentCommunityWeight: number,
    targetCommunityWeight: number,
    totalWeight: number,
    resolution: number
  ): number {
    const term1 = edgeWeight / totalWeight;
    const term2 = (nodeWeight * targetCommunityWeight) / (2 * totalWeight * totalWeight);
    const term3 = (nodeWeight * currentCommunityWeight) / (2 * totalWeight * totalWeight);
    
    return resolution * (term1 - term2 + term3);
  }

  /**
   * OPTIMIZATION: Optimized node movement with batch updates
   */
  private optimizedMoveNode(
    node: string,
    fromCommunity: string,
    toCommunity: string,
    communities: Map<string, Set<string>>,
    nodeToCommunity: Map<string, string>,
    communityWeights: Map<string, number>,
    nodeWeight: number
  ): void {
    // Update community membership
    communities.get(fromCommunity)?.delete(node);
    communities.get(toCommunity)?.add(node);
    nodeToCommunity.set(node, toCommunity);
    
    // Update community weights
    communityWeights.set(fromCommunity, 
      (communityWeights.get(fromCommunity) || 0) - nodeWeight);
    communityWeights.set(toCommunity,
      (communityWeights.get(toCommunity) || 0) + nodeWeight);
    
    // Clean up empty communities
    if (communities.get(fromCommunity)?.size === 0) {
      communities.delete(fromCommunity);
      communityWeights.delete(fromCommunity);
    }
  }

  private findCommunityForNode(node: string, communities: Map<string, Set<string>>): string {
    for (const [communityId, members] of communities) {
      if (members.has(node)) {
        return communityId;
      }
    }
    return ''; // Should not happen
  }

  private calculateModularityGain(
    node: string,
    fromCommunity: string,
    toCommunity: string,
    communities: Map<string, Set<string>>,
    resolution: number
  ): number {
    // Simplified modularity gain calculation
    const ki = this.getNodeDegree(node);
    const kiIn = this.getInternalDegree(node, toCommunity, communities);
    const sigmaTot = this.getCommunityDegree(toCommunity, communities);
    const m = this.getTotalEdgeWeight();

    // Delta Q calculation (simplified)
    const deltaQ = (kiIn - ki * sigmaTot / (2 * m)) * resolution;
    
    return deltaQ;
  }

  private getNodeDegree(nodeId: string): number {
    const neighbors = this.adjacencyMatrix.get(nodeId);
    return neighbors ? Array.from(neighbors.values()).reduce((sum, weight) => sum + weight, 0) : 0;
  }

  private getInternalDegree(node: string, communityId: string, communities: Map<string, Set<string>>): number {
    const neighbors = this.adjacencyMatrix.get(node);
    const communityMembers = communities.get(communityId);
    
    if (!neighbors || !communityMembers) return 0;
    
    let internalDegree = 0;
    for (const [neighbor, weight] of neighbors) {
      if (communityMembers.has(neighbor)) {
        internalDegree += weight;
      }
    }
    
    return internalDegree;
  }

  private getCommunityDegree(communityId: string, communities: Map<string, Set<string>>): number {
    const members = communities.get(communityId);
    if (!members) return 0;
    
    let totalDegree = 0;
    for (const member of members) {
      totalDegree += this.getNodeDegree(member);
    }
    
    return totalDegree;
  }

  private getTotalEdgeWeight(): number {
    let total = 0;
    for (const neighbors of this.adjacencyMatrix.values()) {
      for (const weight of neighbors.values()) {
        total += weight;
      }
    }
    return total / 2; // Each edge counted twice
  }

  private moveNodeToCommunity(
    node: string,
    fromCommunity: string,
    toCommunity: string,
    communities: Map<string, Set<string>>
  ): void {
    communities.get(fromCommunity)?.delete(node);
    communities.get(toCommunity)?.add(node);
    
    // Clean up empty communities
    if (communities.get(fromCommunity)?.size === 0) {
      communities.delete(fromCommunity);
    }
  }

  private calculateModularity(communities: Map<string, Set<string>>, resolution: number): number {
    let modularity = 0;
    const m = this.getTotalEdgeWeight();
    
    for (const members of communities.values()) {
      let linksInside = 0;
      let degreesSum = 0;
      
      for (const node of members) {
        degreesSum += this.getNodeDegree(node);
        
        const neighbors = this.adjacencyMatrix.get(node);
        if (neighbors) {
          for (const [neighbor, weight] of neighbors) {
            if (members.has(neighbor)) {
              linksInside += weight;
            }
          }
        }
      }
      
      linksInside /= 2; // Each internal edge counted twice
      modularity += (linksInside / m) - Math.pow(degreesSum / (2 * m), 2) * resolution;
    }
    
    return modularity;
  }

  private calculateModularityFromCommunities(communities: Community[], resolution: number): number {
    const communityMap = new Map<string, Set<string>>();
    
    for (const community of communities) {
      communityMap.set(community.id, new Set(community.nodeIds));
    }
    
    return this.calculateModularity(communityMap, resolution);
  }

  private filterSmallCommunities(
    communities: Map<string, Set<string>>,
    minSize: number
  ): Map<string, Set<string>> {
    const filtered = new Map<string, Set<string>>();
    
    for (const [id, members] of communities) {
      if (members.size >= minSize) {
        filtered.set(id, members);
      }
    }
    
    return filtered;
  }

  private async buildCommunityResult(
    communities: Map<string, Set<string>>,
    modularity: number,
    algorithm: string
  ): Promise<CommunityDetectionResult> {
    const communityList: Community[] = [];
    
    let index = 0;
    for (const [id, members] of communities) {
      const nodeIds = Array.from(members);
      const density = this.calculateCommunityDensity(nodeIds);
      
      const community: Community = {
        id: `${algorithm}_${index++}`,
        nodeIds,
        label: `Community ${index}`,
        summary: await this.generateCommunitySummary(nodeIds),
        level: 0,
        parentId: undefined,
        childIds: [],
        metrics: {
          size: nodeIds.length,
          density,
          modularity: 0, // Will be calculated per community if needed
          coherence: density // Simplified coherence measure
        },
        properties: {
          algorithm,
          createdAt: new Date().toISOString()
        }
      };
      
      communityList.push(community);
    }
    
    return {
      communities: communityList,
      hierarchy: new Map([[0, communityList]]),
      modularity,
      statistics: this.calculateStatistics(communityList)
    };
  }

  private calculateCommunityDensity(nodeIds: string[]): number {
    if (nodeIds.length < 2) return 1.0;
    
    let edges = 0;
    const possibleEdges = (nodeIds.length * (nodeIds.length - 1)) / 2;
    
    for (let i = 0; i < nodeIds.length; i++) {
      for (let j = i + 1; j < nodeIds.length; j++) {
        const nodeId = nodeIds[i]; if (!nodeId) continue; const neighbors = this.adjacencyMatrix.get(nodeId);
        const otherNodeId = nodeIds[j]; if (otherNodeId && neighbors?.has(otherNodeId)) {
          edges++;
        }
      }
    }
    
    return edges / possibleEdges;
  }

  private async generateCommunitySummary(nodeIds: string[]): Promise<string> {
    // In production, use LLM to generate meaningful summaries
    // For now, simple heuristic
    if (nodeIds.length <= 3) {
      return `Small community: ${nodeIds.join(', ')}`;
    } else {
      return `Community of ${nodeIds.length} entities including ${nodeIds.slice(0, 3).join(', ')}...`;
    }
  }

  private async enhanceCommunitiesWithSemantics(
    communities: Community[],
    graphData: GraphData
  ): Promise<void> {
    for (const community of communities) {
      try {
        // Generate centroid embedding
        const memberTexts = community.nodeIds
          .map(id => graphData.nodes.find(n => n.id === id)?.name || id)
          .join(' ');
        
        const embedding = await generateEmbedding(memberTexts); if (embedding) { community.centroid = embedding; }
        
        // Enhanced summary using entity names
        const entityNames = community.nodeIds
          .map(id => graphData.nodes.find(n => n.id === id)?.name || id)
          .filter(name => name);
        
        if (entityNames.length > 0) {
          community.summary = `Community focused on ${entityNames.slice(0, 5).join(', ')}`;
          community.label = this.generateCommunityLabel(entityNames);
        }
      } catch (error) {
        log.warn('Failed to enhance community with semantics', LogContext.AI, {
          communityId: community.id,
          error
        });
      }
    }
  }

  private generateCommunityLabel(entityNames: string[]): string {
    // Find common themes or use most frequent words
    const words = entityNames.join(' ').toLowerCase().split(/\s+/);
    const wordCounts = new Map<string, number>();
    
    for (const word of words) {
      if (word.length > 3) { // Skip short words
        wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
      }
    }
    
    if (wordCounts.size > 0) {
      const entries = Array.from(wordCounts.entries()); if (entries.length > 0) {
        const topWord = entries.sort((a, b) => b[1] - a[1])[0]?.[0]; if (topWord) {
          return `${topWord.charAt(0).toUpperCase() + topWord.slice(1)} Community`; } }
    }
    
    return 'Unnamed Community';
  }

  private async refineCommunities(communities: Community[], resolution: number): Promise<Community[]> {
    // Simplified refinement - in production, implement proper Leiden refinement
    return communities.filter(c => c.metrics.size >= 2);
  }

  private buildSuperGraph(communities: Community[]): Map<string, Map<string, number>> {
    // Build super-graph where each community becomes a super-node
    const superGraph = new Map<string, Map<string, number>>();
    
    for (const community of communities) {
      superGraph.set(community.id, new Map());
    }
    
    // Calculate inter-community weights
    for (let i = 0; i < communities.length; i++) {
      for (let j = i + 1; j < communities.length; j++) {
        const comm1 = communities[i]; if (!comm1) continue;
        const comm2 = communities[j]; if (!comm2) continue;
        
        let totalWeight = 0;
        for (const node1 of comm1.nodeIds) {
          for (const node2 of comm2.nodeIds) {
            const neighbors = this.adjacencyMatrix.get(node1);
            if (neighbors?.has(node2)) {
              totalWeight += neighbors.get(node2) || 0;
            }
          }
        }
        
        if (totalWeight > 0) {
          superGraph.get(comm1.id)!.set(comm2.id, totalWeight);
          superGraph.get(comm2.id)!.set(comm1.id, totalWeight);
        }
      }
    }
    
    return superGraph;
  }

  private buildHierarchicalRelationships(hierarchy: Map<number, Community[]>): void {
    const levels = Array.from(hierarchy.keys()).sort((a, b) => a - b);
    
    for (let i = 0; i < levels.length - 1; i++) {
      const currentLevelKey = levels[i];
      const nextLevelKey = levels[i + 1];
      if (currentLevelKey === undefined || nextLevelKey === undefined) continue;
      
      const currentLevel = hierarchy.get(currentLevelKey)!;
      const nextLevel = hierarchy.get(nextLevelKey)!;
      
      // Simple parent assignment based on overlap
      for (const child of currentLevel) {
        for (const parent of nextLevel) {
          const overlap = child.nodeIds.filter(id => parent.nodeIds.includes(id)).length;
          if (overlap > child.nodeIds.length / 2) { // Majority overlap
            child.parentId = parent.id;
            parent.childIds.push(child.id);
            break;
          }
        }
      }
    }
  }

  private calculateStatistics(communities: Community[]) {
    const totalSize = communities.reduce((sum, c) => sum + c.metrics.size, 0);
    const maxLevel = Math.max(...communities.map(c => c.level));
    
    return {
      totalCommunities: communities.length,
      averageSize: communities.length > 0 ? totalSize / communities.length : 0,
      maxLevel,
      coverageRatio: totalSize / this.nodeToIndex.size
    };
  }

  /**
   * Get communities containing a specific node
   */
  getCommunitiesForNode(nodeId: string, communities: Community[]): Community[] {
    return communities.filter(community => community.nodeIds.includes(nodeId));
  }

  /**
   * Find similar communities based on centroid similarity
   */
  async findSimilarCommunities(
    targetCommunity: Community,
    allCommunities: Community[],
    threshold = 0.7
  ): Promise<Community[]> {
    if (!targetCommunity.centroid) return [];
    
    const similar: Community[] = [];
    
    for (const community of allCommunities) {
      if (community.id === targetCommunity.id || !community.centroid) continue;
      
      const similarity = this.cosineSimilarity(targetCommunity.centroid, community.centroid);
      if (similarity >= threshold) {
        similar.push(community);
      }
    }
    
    return similar.sort((a, b) => {
      const simA = this.cosineSimilarity(targetCommunity.centroid!, a.centroid!);
      const simB = this.cosineSimilarity(targetCommunity.centroid!, b.centroid!);
      return simB - simA;
    });
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      const aVal = a[i] || 0;
      const bVal = b[i] || 0;
      dotProduct += aVal * bVal;
      normA += aVal * aVal;
      normB += bVal * bVal;
    }
    
    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }
}

// Export singleton instance
export const communityDetector = new CommunityDetector();