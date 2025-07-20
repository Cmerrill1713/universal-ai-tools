/**
 * TypeScript types for GraphQL schema
 * Generated from schema.graphql
 */

export type UUID = string;
export type DateTime = string;
export type JSON = any;

// ============================================================================
// TEMPORAL TYPES
// ============================================================================

export enum TemporalType {
  PAST = 'PAST',
  PRESENT = 'PRESENT',
  FUTURE = 'FUTURE',
  RECURRING = 'RECURRING',
}

export enum UrgencyLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export interface TemporalContext {
  timeType: TemporalType;
  urgency: UrgencyLevel;
  timeExpressions: string[];
  validFrom: DateTime;
  validTo?: DateTime;
}

// ============================================================================
// KNOWLEDGE GRAPH TYPES
// ============================================================================

export interface Node {
  id: UUID;
  createdAt: DateTime;
  updatedAt: DateTime;
}

export interface TemporalNode extends Node {
  validFrom: DateTime;
  validTo?: DateTime;
  versionId: UUID;
}

export interface KnowledgeEntity extends TemporalNode {
  entityType: string;
  name: string;
  description?: string;
  properties: JSON;
  embedding?: number[];
  createdBy?: UUID;
  previousVersionId?: UUID;
  outgoingRelationships: KnowledgeRelationship[];
  incomingRelationships: KnowledgeRelationship[];
  connectedEntities: ConnectedEntity[];
}

export interface KnowledgeRelationship extends TemporalNode {
  sourceEntityId: UUID;
  targetEntityId: UUID;
  relationshipType: string;
  strength: number;
  confidence: number;
  properties: JSON;
  createdBy?: UUID;
  previousVersionId?: UUID;
  sourceEntity: KnowledgeEntity;
  targetEntity: KnowledgeEntity;
}

export interface ConnectedEntity {
  entity: KnowledgeEntity;
  pathLength: number;
  relationshipPath: string[];
}

export interface KnowledgeEvent extends Node {
  eventType: string;
  entityId?: UUID;
  relationshipId?: UUID;
  agentId?: string;
  eventData: JSON;
  timestamp: DateTime;
  causalEventId?: UUID;
  entity?: KnowledgeEntity;
  relationship?: KnowledgeRelationship;
  causalEvent?: KnowledgeEvent;
}

// ============================================================================
// AGENT TYPES
// ============================================================================

export enum AgentStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  BUSY = 'BUSY',
  ERROR = 'ERROR',
  IDLE = 'IDLE',
}

export interface Agent extends Node {
  name: string;
  status: AgentStatus;
  priority: number;
  lastActive?: DateTime;
  memories: MemoryConnection;
  performance: AgentPerformance;
  coordinatedAgents: Agent[];
  workloadScore: number;
  coordinationWeight: number;
  knowledgeEntities: KnowledgeEntity[];
}

export interface AgentPerformance {
  memoryCount: number;
  avgMemoryImportance: number;
  highImportanceMemories: number;
  activeDays: number;
  lifespanDays: number;
  memoriesPerDay: number;
  successRate?: number;
  avgLatency?: number;
}

export interface AgentCoordinationData {
  agentId: UUID;
  agentName: string;
  status: AgentStatus;
  workloadScore: number;
  memoryCount: number;
  avgMemoryImportance: number;
  lastActive?: DateTime;
  coordinationWeight: number;
}

// ============================================================================
// MEMORY TYPES
// ============================================================================

export interface Memory extends Node {
  content: string;
  importance: number;
  agentId: string;
  embedding?: number[];
  temporalContext?: TemporalContext;
  connections: MemoryConnectionEdge[];
  agent: Agent;
  relevanceScore?: number;
  temporalScore?: number;
  finalScore?: number;
}

export interface MemoryConnection {
  edges: MemoryEdge[];
  pageInfo: PageInfo;
  totalCount: number;
}

export interface MemoryEdge {
  node: Memory;
  cursor: string;
  strength: number;
  connectionType: string;
  target: Memory;
}

export interface MemoryConnectionEdge {
  targetId: UUID;
  type: string;
  strength: number;
  targetContent: string;
}

export interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor?: string;
  endCursor?: string;
}

// ============================================================================
// TEMPORAL KNOWLEDGE GRAPH TYPES
// ============================================================================

export interface KnowledgeSnapshot {
  timestamp: DateTime;
  entities: KnowledgeEntity[];
  relationships: KnowledgeRelationship[];
  version: string;
}

export interface KnowledgeEvolution {
  events: KnowledgeEvent[];
  startTime: DateTime;
  endTime: DateTime;
  totalEvents: number;
}

// ============================================================================
// INPUT TYPES
// ============================================================================

export interface KnowledgeEntityInput {
  entityType: string;
  name: string;
  description?: string;
  properties?: JSON;
}

export interface KnowledgeRelationshipInput {
  sourceEntityId: UUID;
  targetEntityId: UUID;
  relationshipType: string;
  strength?: number;
  confidence?: number;
  properties?: JSON;
}

export interface MemorySearchInput {
  query: string;
  agentId?: string;
  importanceThreshold?: number;
  limit?: number;
  temporalWeight?: number;
}

export interface KnowledgeSearchInput {
  embedding: number[];
  similarityThreshold?: number;
  limit?: number;
}

// ============================================================================
// SYSTEM TYPES
// ============================================================================

export interface SystemHealth {
  status: string;
  agentCount: number;
  memoryCount: number;
  knowledgeEntityCount: number;
  uptime: string;
}

// ============================================================================
// GRAPHQL CONTEXT
// ============================================================================

export interface GraphQLContext {
  user?: {
    id: string;
    email?: string;
  };
  supabase: any;
  dataSources: {
    agentAPI: any;
    memoryAPI: any;
    knowledgeAPI: any;
  };
  loaders: {
    agentLoader: any;
    memoryLoader: any;
    agentMemoriesLoader: any;
    knowledgeEntityLoader: any;
    knowledgeRelationshipLoader: any;
  };
}

// ============================================================================
// RESOLVER TYPES
// ============================================================================

export interface ResolverArgs {
  id?: UUID;
  ids?: UUID[];
  input?: any;
  first?: number;
  after?: string;
  limit?: number;
  status?: AgentStatus;
  entityType?: string;
  agentId?: string;
  startEntityId?: UUID;
  maxDepth?: number;
  relationshipTypes?: string[];
  timestamp?: DateTime;
  startTime?: DateTime;
  endTime?: DateTime;
}

export type Resolver<TResult, TParent = any, TArgs = any> = (
  parent: TParent,
  args: TArgs,
  context: GraphQLContext,
  info: any
) => Promise<TResult> | TResult;

export interface Resolvers {
  Query: {
    agent: Resolver<Agent | null, any, { id: UUID }>;
    agents: Resolver<Agent[], any, { ids?: UUID[]; status?: AgentStatus; limit?: number }>;
    agentCoordination: Resolver<AgentCoordinationData[], any, { agentIds?: UUID[] }>;
    memory: Resolver<Memory | null, any, { id: UUID }>;
    searchMemories: Resolver<Memory[], any, { input: MemorySearchInput }>;
    knowledgeEntity: Resolver<KnowledgeEntity | null, any, { id: UUID }>;
    knowledgeEntities: Resolver<KnowledgeEntity[], any, { entityType?: string; limit?: number }>;
    searchKnowledgeEntities: Resolver<KnowledgeEntity[], any, { input: KnowledgeSearchInput }>;
    findConnectedEntities: Resolver<ConnectedEntity[], any, { startEntityId: UUID; maxDepth?: number; relationshipTypes?: string[] }>;
    knowledgeSnapshotAtTime: Resolver<KnowledgeSnapshot, any, { timestamp: DateTime }>;
    currentKnowledgeSnapshot: Resolver<KnowledgeSnapshot>;
    knowledgeEvolution: Resolver<KnowledgeEvolution, any, { startTime: DateTime; endTime: DateTime }>;
    systemHealth: Resolver<SystemHealth>;
  };
  
  Mutation: {
    createKnowledgeEntity: Resolver<KnowledgeEntity, any, { input: KnowledgeEntityInput }>;
    updateKnowledgeEntity: Resolver<KnowledgeEntity, any, { id: UUID; input: KnowledgeEntityInput }>;
    deleteKnowledgeEntity: Resolver<boolean, any, { id: UUID }>;
    createKnowledgeRelationship: Resolver<KnowledgeRelationship, any, { input: KnowledgeRelationshipInput }>;
    updateKnowledgeRelationship: Resolver<KnowledgeRelationship, any, { id: UUID; input: KnowledgeRelationshipInput }>;
    deleteKnowledgeRelationship: Resolver<boolean, any, { id: UUID }>;
    updateAgentStatus: Resolver<Agent, any, { id: UUID; status: AgentStatus }>;
    createMemory: Resolver<Memory, any, { content: string; agentId: string; importance: number; temporalContext?: JSON }>;
  };
  
  Subscription: {
    agentStatusChanged: {
      subscribe: () => AsyncIterator<Agent>;
    };
    agentCoordinationUpdated: {
      subscribe: () => AsyncIterator<AgentCoordinationData[]>;
    };
    memoryCreated: {
      subscribe: (parent: any, args: { agentId?: string }) => AsyncIterator<Memory>;
    };
    memoryUpdated: {
      subscribe: (parent: any, args: { agentId?: string }) => AsyncIterator<Memory>;
    };
    knowledgeEntityCreated: {
      subscribe: () => AsyncIterator<KnowledgeEntity>;
    };
    knowledgeEntityUpdated: {
      subscribe: () => AsyncIterator<KnowledgeEntity>;
    };
    knowledgeRelationshipCreated: {
      subscribe: () => AsyncIterator<KnowledgeRelationship>;
    };
    systemHealthChanged: {
      subscribe: () => AsyncIterator<SystemHealth>;
    };
  };
  
  // Field resolvers
  Agent: {
    memories: Resolver<MemoryConnection, Agent, { first?: number; after?: string; importance?: number }>;
    performance: Resolver<AgentPerformance, Agent>;
    coordinatedAgents: Resolver<Agent[], Agent>;
    knowledgeEntities: Resolver<KnowledgeEntity[], Agent>;
  };
  
  Memory: {
    connections: Resolver<MemoryConnectionEdge[], Memory>;
    agent: Resolver<Agent, Memory>;
  };
  
  KnowledgeEntity: {
    outgoingRelationships: Resolver<KnowledgeRelationship[], KnowledgeEntity, { types?: string[]; limit?: number }>;
    incomingRelationships: Resolver<KnowledgeRelationship[], KnowledgeEntity, { types?: string[]; limit?: number }>;
    connectedEntities: Resolver<ConnectedEntity[], KnowledgeEntity, { maxDepth?: number; relationshipTypes?: string[] }>;
  };
  
  KnowledgeRelationship: {
    sourceEntity: Resolver<KnowledgeEntity, KnowledgeRelationship>;
    targetEntity: Resolver<KnowledgeEntity, KnowledgeRelationship>;
  };
  
  KnowledgeEvent: {
    entity: Resolver<KnowledgeEntity | null, KnowledgeEvent>;
    relationship: Resolver<KnowledgeRelationship | null, KnowledgeEvent>;
    causalEvent: Resolver<KnowledgeEvent | null, KnowledgeEvent>;
  };
}