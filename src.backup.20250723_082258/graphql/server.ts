/**
 * Apollo GraphQL Server setup for Universal AI Tools
 * Combines schema, resolvers, and DataLoaders for optimal performance
 */

import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { createServer } from 'http';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { WebSocketServer } from 'ws';
import { makeServer } from 'graphql-ws';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { SupabaseClient } from '@supabase/supabase-js';
import cors from 'cors';
import bodyParser from 'body-parser';
import type { Request, Response } from 'express';

import { resolvers } from './resolvers';
import { createDataLoaders } from './dataloaders';
import type { GraphQLContext } from './types';
import { LogContext, logger } from '../utils/enhanced-logger';

// Embedded GraphQL schema to avoid file loading issues in production
const EMBEDDED_SCHEMA = `# Universal AI Tools GraphQL Schema
# Temporal Knowledge Graph with Agent Coordination

scalar DateTime
scalar JSON
scalar UUID

type Query {
  # System queries
  systemHealth: SystemHealth!
  
  # Agent queries
  agent(id: UUID!): Agent
  agents(status: AgentStatus, limit: Int = 10): [Agent!]!
  
  # Memory queries
  memory(id: UUID!): Memory
  searchMemories(_input MemorySearchInput!): [Memory!]!
  
  # Knowledge graph queries
  knowledgeEntity(id: UUID!): KnowledgeEntity
  knowledgeEntities(entityType: String, limit: Int = 10): [KnowledgeEntity!]!
}

type Mutation {
  # Agent mutations
  updateAgentStatus(id: UUID!, status: AgentStatus!): Agent!
  
  # Memory mutations
  createMemory(_content String!, agentId: String!, importance: Float!): Memory!
}

type Subscription {
  # Agent coordination subscriptions
  agentStatusChanged: Agent!
  
  # Memory subscriptions
  memoryCreated(agentId: String): Memory!
}

type SystemHealth {
  status: String!
  agentCount: Int!
  memoryCount: Int!
  uptime: String!
}

enum AgentStatus {
  ACTIVE
  INACTIVE
  BUSY
  ERROR
  IDLE
}

type Agent {
  id: UUID!
  name: String!
  status: AgentStatus!
  lastActive: DateTime
  createdAt: DateTime!
  updatedAt: DateTime!
}

type Memory {
  id: UUID!
  _content String!
  importance: Float!
  agentId: String!
  createdAt: DateTime!
  updatedAt: DateTime!
}

type KnowledgeEntity {
  id: UUID!
  name: String!
  entityType: String!
  description: String
  createdAt: DateTime!
  updatedAt: DateTime!
}

_inputMemorySearchInput {
  query: String!
  agentId: String
  limit: Int = 10
}`;

// Load GraphQL schema with fallback to embedded version
let typeDefs: string | null = null;

function loadTypeDefs(): string {
  if (!typeDefs) {
    try {
      // Try to load from file first (for development)
      typeDefs = readFileSync(join(__dirname, 'schema.graphql'), { encoding: 'utf-8' });
      logger.info('Loaded GraphQL schema from file', LogContext.SYSTEM);
    } catch (_error) {
      // Fallback to embedded schema
      typeDefs = EMBEDDED_SCHEMA;
      logger.info('Using embedded GraphQL schema', LogContext.SYSTEM, { 
        reason: 'Schema file not found in build directory' 
      });
    }
  }
  return typeDefs;
}

/**
 * Create GraphQL context for each request
 */
function createGraphQLContext(supabase: SupabaseClient) {
  return async ({ req, res }: { req: Request; res: Response }): Promise<GraphQLContext> => {
    // Extract user from JWT token if present
    let user: { id: string; email?: string } | undefined = undefined;
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser(token);
        if (authUser) {
          user = {
            id: authUser.id,
            email: authUser.email,
          };
        }
      } catch (_error) {
        logger.warn('Invalid auth token', LogContext.SECURITY, {
          _error _errorinstanceof Error ? _errormessage : 'Unknown _error,
        });
      }
    }

    // Create fresh DataLoaders for this request
    const loaders = createDataLoaders(supabase);

    return {
      user,
      supabase,
      dataSources: {
        agentAPI: null, // Could add REST API datasources here
        memoryAPI: null,
        knowledgeAPI: null,
      },
      loaders,
    };
  };
}

/**
 * Create and configure Apollo GraphQL Server
 */
export async function createGraphQLServer(
  supabase: SupabaseClient,
  httpServer?: any
): Promise<{
  server: ApolloServer<GraphQLContext>;
  schema: any;
  wsServer?: WebSocketServer;
}> {
  // Create executable schema
  const schema = makeExecutableSchema({
    typeDefs: loadTypeDefs(),
    resolvers: resolvers as any,
  });

  // WebSocket server for subscriptions (optional)
  let wsServer: WebSocketServer | undefined;
  let serverCleanup: any;

  if (httpServer) {
    wsServer = new WebSocketServer({
      server: httpServer,
      path: '/graphql/subscriptions',
    });

    serverCleanup = makeServer({
      schema,
      context: async (ctx: any, msg: any, args: any) => {
        // Create context for WebSocket connections
        const loaders = createDataLoaders(supabase);

        return {
          user: undefined, // Would extract from connection params
          supabase,
          dataSources: {
            agentAPI: null,
            memoryAPI: null,
            knowledgeAPI: null,
          },
          loaders,
        };
      },
    });
  }

  // Create Apollo Server
  const server = new ApolloServer<GraphQLContext>({
    schema,
    plugins: [
      // Proper shutdown for HTTP server
      ...(httpServer ? [ApolloServerPluginDrainHttpServer({ httpServer })] : []),

      // Proper shutdown for WebSocket server
      ...(serverCleanup
        ? [
            {
              async serverWillStart() {
                return {
                  async drainServer() {
                    await serverCleanup.dispose();
                  },
                };
              },
            },
          ]
        : []),

      // Development introspection
      ...(process.env.NODE_ENV === 'production'
        ? []
        : [
            {
              requestDidStart() {
                return {
                  didResolveOperation(context: any) {
                    logger.debug('GraphQL Operation', LogContext.GRAPHQL, {
                      operationName: context._requestoperationName,
                      variables: context._requestvariables,
                    });
                  },
                };
              },
            },
          ]),
    ] as any,

    // Error formatting
    formatError: (formattedError, _error => {
      // Log the _errorfor debugging
      logger.error'GraphQL Error', LogContext.GRAPHQL, {
        message: formattedError.message,
        locations: formattedError.locations,
        path: formattedError.path,
        extensions: formattedError.extensions,
      });

      // Don't expose internal errors in production
      if (process.env.NODE_ENV === 'production') {
        // Remove stack traces and sensitive information
        delete formattedError.extensions?.exception;

        // Generic _errorfor unexpected issues
        if (formattedError.message.includes('internal server _error)) {
          return {
            ...formattedError,
            message: 'An unexpected _erroroccurred',
          };
        }
      }

      return formattedError;
    },

    // Development features
    introspection: process.env.NODE_ENV !== 'production',

    // Cache control
    cache: 'bounded',
  });

  return { server, schema, wsServer };
}

/**
 * Setup GraphQL middleware for Express
 */
export function setupGraphQLMiddleware(
  app: any,
  server: ApolloServer<GraphQLContext>,
  supabase: SupabaseClient
) {
  // CORS configuration for GraphQL
  const corsOptions = {
    origin:
      process.env.NODE_ENV === 'production'
        ? process.env.FRONTEND_URL || 'https://your-frontend-domain.com'
        : ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:8080'],
    credentials: true,
  };

  // Apply GraphQL middleware
  app.use(
    '/graphql',
    cors(corsOptions),
    bodyParser.json({ limit: '50mb' }),
    expressMiddleware(server, {
      context: createGraphQLContext(supabase),
    })
  );

  logger.info('GraphQL endpoint available at /graphql');

  if (process.env.NODE_ENV !== 'production') {
    logger.info('GraphQL Playground available at /graphql');
  }
}

/**
 * Create complete GraphQL setup with Express and WebSocket support
 */
export async function createCompleteGraphQLSetup(
  app: any,
  supabase: SupabaseClient
): Promise<{
  server: ApolloServer<GraphQLContext>;
  httpServer: any;
  wsServer?: WebSocketServer;
}> {
  // Create HTTP server
  const httpServer = createServer(app);

  // Create GraphQL server with WebSocket support
  const { server, wsServer } = await createGraphQLServer(supabase, httpServer);

  // Start the server
  await server.start();

  // Setup middleware
  setupGraphQLMiddleware(app, server, supabase);

  logger.info('GraphQL server setup complete');

  return { server, httpServer, wsServer };
}

/**
 * Health check endpoint for GraphQL
 */
export function addGraphQLHealthCheck(app: any) {
  app.get('/graphql/health', (req: any, res: any) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'graphql',
      version: process.env.npm_package_version || '1.0.0',
    });
  });

  logger.info('GraphQL health check available at /graphql/health');
}

/**
 * Graceful shutdown handler
 */
export async function shutdownGraphQLServer(
  server: ApolloServer<GraphQLContext>,
  httpServer: any,
  wsServer?: WebSocketServer
): Promise<void> {
  logger.info('Shutting down GraphQL server...');

  try {
    // Stop accepting new connections
    await server.stop();

    // Close WebSocket server
    if (wsServer) {
      wsServer.close();
    }

    // Close HTTP server
    httpServer.close();

    logger.info('GraphQL server shutdown complete');
  } catch (_error) {
    logger.error'Error during GraphQL server shutdown', LogContext.SYSTEM, {
      _error _errorinstanceof Error ? _errormessage : 'Unknown _error,
    });
    throw _error;
  }
}
