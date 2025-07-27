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
  searchMemories(input: MemorySearchInput!): [Memory!]!
  # Knowledge graph queries
  knowledgeEntity(id: UUID!): KnowledgeEntity
  knowledgeEntities(entityType: String, limit: Int = 10): [KnowledgeEntity!]!
}

type Mutation {
  # Agent mutations
  updateAgentStatus(id: UUID!, status: AgentStatus!): Agent!
  # Memory mutations
  createMemory(content: String!, agentId: String!, importance: Float!): Memory!
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
  content: String!
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

input MemorySearchInput {
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
      typeDefs = readFileSync(join(__dirname, 'schemagraphql'), { encoding: 'utf-8' });
      loggerinfo('Loaded GraphQL schema from file', LogContextSYSTEM);
    } catch (error) {
      // Fallback to embedded schema
      typeDefs = EMBEDDED_SCHEMA;
      loggerinfo('Using embedded GraphQL schema', LogContextSYSTEM, {
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
    const authHeader = reqheadersauthorization;
    
    if (authHeader && authHeaderstartsWith('Bearer ')) {
      const token = authHeadersubstring(7);
      try {
        const {
          data: { user: authUser }
        } = await supabaseauthgetUser(token);
        
        if (authUser) {
          user = {
            id: authUserid,
            email: authUseremail
          };
        }
      } catch (error) {
        loggerwarn('Invalid auth token', LogContextSECURITY, {
          error: error instanceof Error ? errormessage : String(error)
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
        knowledgeAPI: null
      },
      loaders
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
    resolvers: resolvers as any
  });

  // WebSocket server for subscriptions (optional)
  let wsServer: WebSocketServer | undefined;
  let serverCleanup: any;

  if (httpServer) {
    wsServer = new WebSocketServer({
      server: httpServer,
      path: '/graphql/subscriptions'
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
            knowledgeAPI: null
          },
          loaders
        };
      }
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
                    await serverCleanupdispose();
                  }
                };
              }
            }
          ]
        : []),
      // Development introspection
      ...(processenvNODE_ENV === 'production'
        ? []
        : [
            {
              requestDidStart() {
                return {
                  didResolveOperation(context: any) {
                    loggerdebug('GraphQL Operation', LogContextGRAPHQL, {
                      operationName: contextrequestoperationName,
                      variables: contextrequestvariables
                    });
                  }
                };
              }
            }
          ])
    ] as any,
    // Error formatting
    formatError: (formattedError, error) => {
      // Log the error for debugging
      loggererror('GraphQL Error', LogContextGRAPHQL, {
        message: formattedErrormessage,
        locations: formattedErrorlocations,
        path: formattedErrorpath,
        extensions: formattedErrorextensions
      });

      // Don't expose internal errors in production
      if (processenvNODE_ENV === 'production') {
        // Remove stack traces and sensitive information
        delete formattedErrorextensions?exception;
        // Generic error for unexpected issues
        if (formattedErrormessageincludes('internal server error')) {
          return {
            ..formattedError,
            message: 'An unexpected error occurred'
          };
        }
      }

      return formattedError;
    },
    // Development features
    introspection: processenvNODE_ENV !== 'production',
    // Cache control
    cache: 'bounded'
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
      processenvNODE_ENV === 'production'
        ? processenvFRONTEND_URL || 'https://your-frontend-domaincom'
        : ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:8080'],
    credentials: true
  };

  // Apply GraphQL middleware
  appuse(
    '/graphql',
    cors(corsOptions),
    bodyParserjson({ limit: '50mb' }),
    expressMiddleware(server, {
      context: createGraphQLContext(supabase)
    })
  );

  loggerinfo('GraphQL endpoint available at /graphql');
  if (processenvNODE_ENV !== 'production') {
    loggerinfo('GraphQL Playground available at /graphql');
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
  await serverstart();
  
  // Setup middleware
  setupGraphQLMiddleware(app, server, supabase);
  
  loggerinfo('GraphQL server setup complete');
  return { server, httpServer, wsServer };
}

/**
 * Health check endpoint for GraphQL
 */
export function addGraphQLHealthCheck(app: any) {
  appget('/graphql/health', (req: any, res: any) => {
    resjson({
      status: 'healthy',
      timestamp: new Date()toISOString(),
      service: 'graphql',
      version: processenvnpm_package_version || '1.0.0'
    });
  });
  loggerinfo('GraphQL health check available at /graphql/health');
}

/**
 * Graceful shutdown handler
 */
export async function shutdownGraphQLServer(
  server: ApolloServer<GraphQLContext>,
  httpServer: any,
  wsServer?: WebSocketServer
): Promise<void> {
  loggerinfo('Shutting down GraphQL server...');
  try {
    // Stop accepting new connections
    await serverstop();
    
    // Close WebSocket server
    if (wsServer) {
      wsServerclose();
    }

    // Close HTTP server
    httpServerclose();
    loggerinfo('GraphQL server shutdown complete');
  } catch (error) {
    loggererror('Error during GraphQL server shutdown', LogContextSYSTEM, {
      error: error instanceof Error ? errormessage : String(error)
    });
    throw error;
  }
}
