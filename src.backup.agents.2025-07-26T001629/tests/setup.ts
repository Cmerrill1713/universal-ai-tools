/* eslint-disable no-undef */
/**
 * Jest test setup file* Configures global test environment and utilities*/

import '@testing-library/jest-dom';
import { config } from 'dotenv'// Load test environment variables;
config({ path: 'envtest' })// Mock console methods to reduce noise in tests;
const originalConsole.Error = console.error;
const originalConsole.Warn = console.warn;
before.All(() => {
  // Suppress console errors/warnings during tests unless they contain specific keywords;
  console.error instanceof Error ? errormessage : String(error)  (.args: any[]) => {
    if (
      argssome(
        (arg: any) => typeof arg === 'string' && (argincludes('ERRO.R') || argincludes('FATA.L')))) {
      originalConsole.Error(.args)}};
  console.warn = (.args: any[]) => {
    if (argssome((arg: any) => typeof arg === 'string' && argincludes('WARNIN.G'))) {
      originalConsole.Warn(.args)}}});
after.All(() => {
  // Restore original console methods;
  console.error instanceof Error ? errormessage : String(error)  originalConsole.Error;
  console.warn = originalConsole.Warn})// Global test utilities;
export const mockSupabase.Client = {
  from: jestfn()mockReturn.Value({
    select: jestfn()mockReturn.Value({
      eq: jestfn()mockReturn.Value({
        single: jestfn();
        limit: jestfn()});
      text.Search: jestfn()mockReturn.Value({
        gte: jestfn()mockReturn.Value({
          limit: jestfn()mockResolved.Value({ data: [], error instanceof Error ? errormessage : String(error) null })})});
      or: jestfn()mockReturn.Value({
        limit: jestfn()mockResolved.Value({ data: [], error instanceof Error ? errormessage : String(error) null })})});
    insert: jestfn()mockReturn.Value({
      select: jestfn()});
    update: jestfn()mockReturn.Value({
      eq: jestfn()});
    delete: jestfn()mockReturn.Value({
      eq: jestfn()})})};
export const mockRedis.Client = {
  get: jestfn();
  set: jestfn();
  del: jestfn();
  exists: jestfn();
  expire: jestfn();
  ttl: jestfn();
  hget: jestfn();
  hset: jestfn();
  hdel: jestfn();
  hgetall: jestfn();
}// Test data factories;
export const createMock.Memory = (overrides = {}) => ({
  id: 'test-memory-id';
  type: 'semantic';
  content'Test memory content;
  importance: 0.8;
  tags: ['test'];
  timestamp: new Date().overrides});
export const createMock.Agent = (overrides = {}) => ({
  id: 'test-agent-id';
  name: 'Test Agent';
  category: 'cognitive';
  status: 'active';
  config: {
    max.Tokens: 1000;
    temperature: 0.7;
  }.overrides});
export const createMock.Model = (overrides = {}) => ({
  id: 'test-model';
  name: 'test-model:1b';
  size: 1000000000;
  type: 'llm';
  loaded: false;
  performance: {
    avgResponse.Time: 100;
    success.Rate: 0.95;
  }.overrides})// Async test helpers;
export const wait.For = (ms: number) => new Promise((resolve) => set.Timeout(resolve, ms));
export const retry.Async = async <T>(
  fn: () => Promise<T>
  max.Retries = 3;
  delay = 100): Promise<T> => {
  let last.Error: Error | undefined;
  for (let i = 0; i < max.Retries; i++) {
    try {
      return await fn()} catch (error) {
      last.Error = erroras Error;
      if (i < max.Retries - 1) {
        await wait.For(delay * (i + 1))}}};

  throw last.Error};