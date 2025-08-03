/**
 * AB-MCTS Tree Storage Service
 * Provides Redis-based persistence for MCTS trees
 */

import Redis from 'ioredis';
import type { ABMCTSNode, ABMCTSSearchResult } from '../types/ab-mcts';
import { LogContext, log } from '../utils/logger';
import { config } from '../config/environment';
import { HOURS_IN_DAY } from '../utils/constants';

export interface TreeStorageOptions {
  ttl?: number; // Time to live in seconds (default: 1 hour)
  compress?: boolean; // Compress tree data (default: true)
}

export class ABMCTSTreeStorage {
  private redis:
    | Redis     | null = null;
  private readonly prefix = 'ab-mcts:tree:';
  private readonly resultPrefix = 'ab-mcts:result:';
  private readonly defaultTTL = 3600; // 1 hour

  constructor() {
    this.initializeRedis();
  }

  private initializeRedis(): void {
    try {
      if (config.redis?.url) {
        this.redis = new Redis(config.redis.url, {
          maxRetriesPerRequest: 3,
          enableReadyCheck: true,
          lazyConnect: true,
        });

        this.redis.on('connect', () => {
          log.info('✅ Redis connected for AB-MCTS tree storage', LogContext.CACHE);
        });

        this.redis.on('error', (error) => {
          log.error('❌ Redis error in tree storage', LogContext.CACHE, { error });
        });
      }
    } catch (error) {
      log.warn('⚠️ Redis not available for tree storage', LogContext.CACHE, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Save a tree node and its children recursively
   */
  async saveNode(
    node: ABMCTSNode,
    options:     TreeStorageOptions = {}
  ): Promise<void> {
    if (!this.redis) {
      log.debug('Redis not available, skipping tree save', LogContext.CACHE);
      return;
    }

    try {
      const key = `${this.prefix}${node.id}`;
      const ttl = options.ttl || this.defaultTTL;

      // Prepare node data for storage
      const nodeData = {
        id: node.id,
        state: node.state,
        visits: node.visits,
        totalReward: node.totalReward,
        averageReward: node.averageReward,
        ucbScore: node.ucbScore,
        thompsonSample: node.thompsonSample,
        priorAlpha: node.priorAlpha,
        priorBeta: node.priorBeta,
        depth: node.depth,
        isTerminal: node.isTerminal,
        isExpanded: node.isExpanded,
        metadata: node.metadata,
        parentId: node.parent?.id,
        childIds: Array.from(node.children.keys()),
      };

      // Store node data
      const data = options.compress
        ? this.compress(JSON.stringify(nodeData))
        : JSON.stringify(nodeData);

      await this.redis.setex(key, ttl, data);

      // Recursively save children
      for (const child of node.children.values()) {
        await this.saveNode(child, options);
      }

      log.debug('Saved MCTS node to Redis', LogContext.CACHE, {
        nodeId: node.id,
        depth: node.depth,
        children: node.children.size,
      });
    } catch (error) {
      log.error('Failed to save MCTS node', LogContext.CACHE, {
        nodeId: node.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Load a tree node and reconstruct its structure
   */
  async loadNode(
    nodeId: string,
    options:     TreeStorageOptions = {}
  ): Promise<ABMCTSNode | null> {
    if (!this.redis) {
      return null;
    }

    try {
      const key = `${this.prefix}${nodeId}`;
      const data = await this.redis.get(key);

      if (!data) {
        return null;
      }

      const nodeData = JSON.parse(options.compress ? this.decompress(data) : data);

      // Reconstruct node
      const node: ABMCTSNode = {
        id: nodeData.id,
        state: nodeData.state,
        visits: nodeData.visits,
        totalReward: nodeData.totalReward,
        averageReward: nodeData.averageReward,
        ucbScore: nodeData.ucbScore,
        thompsonSample: nodeData.thompsonSample,
        priorAlpha: nodeData.priorAlpha,
        priorBeta: nodeData.priorBeta,
        children: new Map(),
        parent: undefined, // Will be set during reconstruction
        depth: nodeData.depth,
        isTerminal: nodeData.isTerminal,
        isExpanded: nodeData.isExpanded,
        metadata: nodeData.metadata,
      };

      // Recursively load children
      for (const childId of nodeData.childIds) {
        const child = await this.loadNode(childId, options);
        if (child) {
          child.parent = node;
          node.children.set(childId, child);
        }
      }

      return node;
    } catch (error) {
      log.error('Failed to load MCTS node', LogContext.CACHE, {
        nodeId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Save search results for later retrieval
   */
  async saveSearchResult(
    searchId: string,
    result: ABMCTSSearchResult,
    options:     TreeStorageOptions = {}
  ): Promise<void> {
    if (!this.redis) {
      return;
    }

    try {
      const key = `${this.resultPrefix}${searchId}`;
      const ttl = options.ttl || this.defaultTTL;

      // Save the root node of the best path
      if (result.bestPath.length > 0 && result.bestPath[0]) {
        await this.saveNode(result.bestPath[0], options);
      }

      // Save search result metadata
      const resultData = {
        searchId,
        bestAction: result.bestAction,
        confidence: result.confidence,
        searchMetrics: result.searchMetrics,
        recommendations: result.recommendations,
        rootNodeId: result.bestPath[0]?.id,
        timestamp: Date.now(),
      };

      await this.redis.setex(key, ttl, JSON.stringify(resultData));

      log.info('Saved AB-MCTS search result', LogContext.CACHE, {
        searchId,
        pathLength: result.bestPath.length,
        confidence: result.confidence,
      });
    } catch (error) {
      log.error('Failed to save search result', LogContext.CACHE, {
        searchId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Load search results by ID
   */
  async loadSearchResult(searchId: string): Promise<Partial<ABMCTSSearchResult> | null> {
    if (!this.redis) {
      return null;
    }

    try {
      const         key = `${this.resultPrefix}${searchId}`;
      const data = await this.redis.get(key);

      if (!data) {
        return null;
      }

      const resultData = JSON.parse(data);

      // Load the tree if available
      let bestPath: ABMCTSNode[] = [];
      if (resultData.rootNodeId) {
        const rootNode = await this.loadNode(resultData.rootNodeId);
        if (rootNode) {
          // Reconstruct best path (simplified - just returns root for now)
          bestPath = [rootNode];
        }
      }

      return {
        bestPath,
        bestAction: resultData.bestAction,
        confidence: resultData.confidence,
        searchMetrics: resultData.searchMetrics,
        recommendations: resultData.recommendations,
      };
    } catch (error) {
      log.error('Failed to load search result', LogContext.CACHE, {
        searchId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Delete a tree and all its nodes
   */
  async deleteTree(nodeId: string): Promise<void> {
    if (!this.redis) {
      return;
    }

    try {
      // Load node to get children
      const node = await this.loadNode(nodeId);
      if (!node) {
        return;
      }

      // Recursively delete children
      for (const childId of node.children.keys()) {
        await this.deleteTree(childId);
      }

      // Delete this node
      const key = `${this.prefix}${nodeId}`;
      await this.redis.del(key);

      log.debug('Deleted MCTS tree node', LogContext.CACHE, { nodeId });
    } catch (error) {
      log.error('Failed to delete tree', LogContext.CACHE, {
        nodeId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get tree statistics
   */
  async getTreeStats(nodeId: string): Promise<{
    totalNodes: number;
    maxDepth: number;
    avgBranchingFactor: number;
  } | null> {
    if (!this.redis) {
      return null;
    }

    try {
      const         node = await this.loadNode(nodeId);
      if (!node) {
        return null;
      }

      // Calculate statistics recursively
      let totalNodes = 0;
      let maxDepth = 0;
      let totalBranches = 0;
      let nodesWithChildren = 0;

      const visit = (n: ABMCTSNode) => {
        totalNodes++;
        maxDepth = Math.max(maxDepth, n.depth);

        if (n.children.size > 0) {
          totalBranches += n.children.size;
          nodesWithChildren++;

          for (const child of n.children.values()) {
            visit(child);
          }
        }
      };

      visit(node);

      return {
        totalNodes,
        maxDepth,
        avgBranchingFactor: nodesWithChildren > 0 ? totalBranches / nodesWithChildren : 0,
      };
    } catch (error) {
      log.error('Failed to get tree stats', LogContext.CACHE, {
        nodeId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Simple compression (in production, use a proper compression library)
   */
  private compress(data: string): string {
    // For now, just return the data
    // In production, use zlib or similar
    return data;
  }

  /**
   * Simple decompression
   */
  private decompress(data: string): string {
    // For now, just return the data
    // In production, use zlib or similar
    return data;
  }

  /**
   * Cleanup old trees
   */
  async cleanup(olderThanHours = HOURS_IN_DAY): Promise<number> {
    if (!this.redis) {
      return 0;
    }

    try {
      // Get all tree keys
      const keys = await this.redis.keys(`${this.prefix}*`);
      let deleted = 0;

      for (const key of keys) {
        const ttl = await this.redis.ttl(key);

        // If TTL is expired or will expire soon
        if (ttl < 0 || ttl < olderThanHours * 3600) {
          await this.redis.del(key);
          deleted++;
        }
      }

      log.info('Cleaned up old MCTS trees', LogContext.CACHE, {
        totalKeys: keys.length,
        deleted,
      });

      return deleted;
    } catch (error) {
      log.error('Failed to cleanup trees', LogContext.CACHE, {
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

  /**
   * Check if Redis is available
   */
  isAvailable(): boolean {
    return this.redis !== null && this.redis.status === 'ready';
  }
}

// Export singleton instance
export const treeStorage = new ABMCTSTreeStorage();
export default treeStorage;
