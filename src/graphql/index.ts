/**
 * GraphQL module exports
 * Universal AI Tools GraphQL API with temporal knowledge graph
 */

export * from './types';
export * from './resolvers';
export * from './dataloaders';
export * from './server';

// Re-export GraphQL schema as string for external use
import { readFileSync } from 'fs';
import { join } from 'path';

export const graphqlSchema = readFileSync(
  join(__dirname, 'schema.graphql'), 
  { encoding: 'utf-8' }
);