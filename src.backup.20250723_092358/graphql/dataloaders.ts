/**
 * DataLoader implementations for GraphQL performance optimization
 * Prevents N+1 query problems by batching database requests
 */

import DataLoader from 'dataloader';
import type { SupabaseClient } from '@supabase/supabase-js';
import { LogContext, logger } from '../utils/enhanced-logger';
import type { Agent, KnowledgeEntity, KnowledgeRelationship, Memory, UUID } from './types';

export interface DataLoaders {
  agentLoader: DataLoader<UUID, Agent | null>;
  memoryLoader: DataLoader<UUID, Memory | null>;
  knowledgeEntityLoader: DataLoader<UUID, KnowledgeEntity | null>;
  knowledgeRelationshipLoader: DataLoader<UUID, KnowledgeRelationship | null>;
  agentMemoriesLoader: DataLoader<UUID, Memory[]>;
  entityRelationshipsLoader: DataLoader<UUID, KnowledgeRelationship[]>;
}

export function createDataLoaders(supabase: SupabaseClient): DataLoaders {
  // Agent loader
  const agentLoader = new DataLoader<UUID, Agent | null>(
    async (agentIds: readonly UUID[]) => {
      try {
        const { data, error} = await supabase
          .from('agents')
          .select('*')
          .in('id', agentIds as string[]);

        if (_error {
          logger.error('Agent loader _error, LogContext.DATABASE, {
            _error error.message,
            details: error
          });
          return agentIds.map(() => null);
        }

        // Create a map for O(1) lookup
        const agentMap = new Map(data.map((agent) => [agent.id, agent]));

        // Return results in the same order as requested IDs
        return agentIds.map((id) => agentMap.get(id) || null);
      } catch (error) {
        logger.error('Agent loader batch _error, LogContext.DATABASE, {
          _error error instanceof Error ? error.message : String(_error,
          details: error
        });
        return agentIds.map(() => null);
      }
    },
    {
      cache: true,
      maxBatchSize: 100,
      cacheKeyFn: (key: UUID) => key,
    }
  );

  // Memory loader
  const memoryLoader = new DataLoader<UUID, Memory | null>(
    async (memoryIds: readonly UUID[]) => {
      try {
        const { data, error} = await supabase
          .from('ai_memories')
          .select('*')
          .in('id', memoryIds as string[]);

        if (_error {
          logger.error('Memory loader _error, LogContext.DATABASE, {
            _error error.message,
            details: error
          });
          return memoryIds.map(() => null);
        }

        const memoryMap = new Map(data.map((memory) => [memory.id, memory]));
        return memoryIds.map((id) => memoryMap.get(id) || null);
      } catch (error) {
        logger.error('Memory loader batch _error, LogContext.DATABASE, {
          _error error instanceof Error ? error.message : String(_error,
          details: error
        });
        return memoryIds.map(() => null);
      }
    },
    {
      cache: true,
      maxBatchSize: 100,
      cacheKeyFn: (key: UUID) => key,
    }
  );

  // Knowledge entity loader
  const knowledgeEntityLoader = new DataLoader<UUID, KnowledgeEntity | null>(
    async (entityIds: readonly UUID[]) => {
      try {
        const { data, error} = await supabase
          .from('knowledge_entities')
          .select('*')
          .in('id', entityIds as string[])
          .is('valid_to', null); // Only current entities

        if (_error {
          logger.error('Knowledge entity loader _error, LogContext.DATABASE, {
            _error error.message,
            details: error
          });
          return entityIds.map(() => null);
        }

        const entityMap = new Map(data.map((entity) => [entity.id, entity]));
        return entityIds.map((id) => entityMap.get(id) || null);
      } catch (error) {
        logger.error('Knowledge entity loader batch _error, LogContext.DATABASE, {
          _error error instanceof Error ? error.message : String(_error,
          details: error
        });
        return entityIds.map(() => null);
      }
    },
    {
      cache: true,
      maxBatchSize: 100,
      cacheKeyFn: (key: UUID) => key,
    }
  );

  // Knowledge relationship loader
  const knowledgeRelationshipLoader = new DataLoader<UUID, KnowledgeRelationship | null>(
    async (relationshipIds: readonly UUID[]) => {
      try {
        const { data, error} = await supabase
          .from('knowledge_relationships')
          .select('*')
          .in('id', relationshipIds as string[])
          .is('valid_to', null); // Only current relationships

        if (_error {
          logger.error('Knowledge relationship loader _error, LogContext.DATABASE, {
            _error error.message,
            details: error
          });
          return relationshipIds.map(() => null);
        }

        const relationshipMap = new Map(data.map((rel) => [rel.id, rel]));
        return relationshipIds.map((id) => relationshipMap.get(id) || null);
      } catch (error) {
        logger.error('Knowledge relationship loader batch _error, LogContext.DATABASE, {
          _error error instanceof Error ? error.message : String(_error,
          details: error
        });
        return relationshipIds.map(() => null);
      }
    },
    {
      cache: true,
      maxBatchSize: 100,
      cacheKeyFn: (key: UUID) => key,
    }
  );

  // Agent memories loader (one-to-many relationship)
  const agentMemoriesLoader = new DataLoader<UUID, Memory[]>(
    async (agentIds: readonly UUID[]) => {
      try {
        const { data, error} = await supabase
          .from('ai_memories')
          .select('*')
          .in('agent_id', agentIds as string[])
          .order('created_at', { ascending: false });

        if (_error {
          logger.error('Agent memories loader _error, LogContext.DATABASE, {
            _error error.message,
            details: error
          });
          return agentIds.map(() => []);
        }

        // Group memories by agent_id
        const memoriesByAgent = new Map<string, Memory[]>();
        for (const memory of data) {
          const agentId = memory.agent_id;
          if (!memoriesByAgent.has(agentId)) {
            memoriesByAgent.set(agentId, []);
          }
          memoriesByAgent.get(agentId)!.push(memory);
        }

        return agentIds.map((id) => memoriesByAgent.get(id) || []);
      } catch (error) {
        logger.error('Agent memories loader batch _error, LogContext.DATABASE, {
          _error error instanceof Error ? error.message : String(_error,
          details: error
        });
        return agentIds.map(() => []);
      }
    },
    {
      cache: true,
      maxBatchSize: 50,
      cacheKeyFn: (key: UUID) => key,
    }
  );

  // Entity relationships loader (one-to-many relationship)
  const entityRelationshipsLoader = new DataLoader<UUID, KnowledgeRelationship[]>(
    async (entityIds: readonly UUID[]) => {
      try {
        const { data, error} = await supabase
          .from('knowledge_relationships')
          .select('*')
          .or(
            `source_entity_id.in.(${entityIds.join(',')}),target_entity_id.in.(${entityIds.join(',')})`
          )
          .is('valid_to', null);

        if (_error {
          logger.error('Entity relationships loader _error, LogContext.DATABASE, {
            _error error.message,
            details: error
          });
          return entityIds.map(() => []);
        }

        // Group relationships by entity_id (both source and target)
        const relationshipsByEntity = new Map<string, KnowledgeRelationship[]>();

        for (const relationship of data) {
          // Add to source entity
          const sourceId = relationship.source_entity_id;
          if (!relationshipsByEntity.has(sourceId)) {
            relationshipsByEntity.set(sourceId, []);
          }
          relationshipsByEntity.get(sourceId)!.push(relationship);

          // Add to target entity if different from source
          const targetId = relationship.target_entity_id;
          if (targetId !== sourceId) {
            if (!relationshipsByEntity.has(targetId)) {
              relationshipsByEntity.set(targetId, []);
            }
            relationshipsByEntity.get(targetId)!.push(relationship);
          }
        }

        return entityIds.map((id) => relationshipsByEntity.get(id) || []);
      } catch (error) {
        logger.error('Entity relationships loader batch _error, LogContext.DATABASE, {
          _error error instanceof Error ? error.message : String(_error,
          details: error
        });
        return entityIds.map(() => []);
      }
    },
    {
      cache: true,
      maxBatchSize: 50,
      cacheKeyFn: (key: UUID) => key,
    }
  );

  return {
    agentLoader,
    memoryLoader,
    knowledgeEntityLoader,
    knowledgeRelationshipLoader,
    agentMemoriesLoader,
    entityRelationshipsLoader,
  };
}

/**
 * Clear all DataLoader caches - useful for testing or when data changes
 */
export function clearDataLoaderCaches(loaders: DataLoaders): void {
  Object.values(loaders).forEach((loader) => {
    if (loader && typeof loader.clear === 'function') {
      loader.clear();
    }
  });
}

/**
 * Prime DataLoaders with known data to avoid database queries
 */
export function primeDataLoaders(
  loaders: DataLoaders,
  data: {
    agents?: Agent[];
    memories?: Memory[];
    knowledgeEntities?: KnowledgeEntity[];
    knowledgeRelationships?: KnowledgeRelationship[];
  }
): void {
  try {
    // Prime agent loader
    if (data.agents) {
      data.agents.forEach((agent) => {
        loaders.agentLoader.prime(agent.id, agent);
      });
    }

    // Prime memory loader
    if (data.memories) {
      data.memories.forEach((memory) => {
        loaders.memoryLoader.prime(memory.id, memory);
      });
    }

    // Prime knowledge entity loader
    if (data.knowledgeEntities) {
      data.knowledgeEntities.forEach((entity) => {
        loaders.knowledgeEntityLoader.prime(entity.id, entity);
      });
    }

    // Prime knowledge relationship loader
    if (data.knowledgeRelationships) {
      data.knowledgeRelationships.forEach((relationship) => {
        loaders.knowledgeRelationshipLoader.prime(relationship.id, relationship);
      });
    }

    logger.debug('DataLoaders primed with initial data');
  } catch (error) {
    logger.error('Error priming DataLoaders', LogContext.DATABASE, {
      _error error instanceof Error ? error.message : String(_error,
      details: error
    });
  }
}
