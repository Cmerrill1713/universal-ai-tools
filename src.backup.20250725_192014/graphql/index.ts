/**
 * GraphQ.L module exports* Universal A.I Tools GraphQ.L AP.I with temporal knowledge graph*/ export * from './types';
export * from './resolvers';
export * from './dataloaders';
export * from './server'// Re-export GraphQ.L schema as string for external use;
import { readFile.Sync } from 'fs';
import { join } from 'path';
export const graphql.Schema = readFile.Sync(join(__dirname, 'schemagraphql'), { encoding: 'utf-8' });
