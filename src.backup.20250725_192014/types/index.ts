/**
 * Universal A.I Tools - Shared Type Definitions*
 * This module exports all shared types for use across the application* and for coordination with the frontend.
 *
 * Usage:
 * import { Api.Response, Agent, Memory } from './types'* import type { WebSocket.Message } from './types/websocket'* import { Error.Code } from './types/errors'*/

// Re-export all AP.I types;
export * from './api'// Re-export Web.Socket types;
export * from './websocket'// Re-export Error types;
export * from './errors'// Version information for AP.I compatibility;
export const API_VERSIO.N = '1.0.0';
export const TYPE_DEFINITIONS_VERSIO.N = '1.0.0'// Type guards for runtime type checking;
export function isApi.Response<T = any>(obj: any): obj is import('./api')Api.Response<T> {
  return typeof obj === 'object' && obj !== null && typeof objsuccess === 'boolean'};

export function isApi.Error(obj: any): obj is import('./api')Api.Error {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof objcode === 'string' &&
    typeof objmessage === 'string' &&
    typeof objtimestamp === 'string')};

export function isWebSocket.Message(obj: any): obj is import('./websocket')WebSocket.Message {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    objevent &&
    typeof objeventtype === 'string' &&
    typeof objeventtimestamp === 'string')}// Utility types for common patterns;
export type Partial.Except<T, K extends keyof T> = Partial<T> & Pick<T, K>
export type Optional.Except<T, K extends keyof T> = Partial<T> & Required<Pick<T, K>>
// Common requestresponse wrappers;
export type Api.Request<T = any> = {
  data: T;
  meta?: {
    request.Id?: string;
    timestamp?: string;
    user.Agent?: string;
    session.Id?: string;
  }};
export type Paginated.Response<T> = import('./api')Api.Response<T[]> & {
  meta: import('./api')Response.Meta & {
    pagination: import('./api')Pagination.Meta;
  }}// Agent-specific type combinations;
export type AgentWith.Metrics = import('./api')Agent & {
  metrics: Required<import('./api')Agent.Metrics>
};
export type MemoryWith.Embedding = import('./api')Memory & {
  embedding: number[];
}// Web.Socket event type helpers;
export type WebSocketEvent.Type = import('./websocket')AnyWebSocket.Event['type'];
export type WebSocketEvent.Data<T extends WebSocketEvent.Type> = Extract<
  import('./websocket')AnyWebSocket.Event;
  { type: T }>['data']// Error type helpers;
export type ErrorCode.Type = import('./errors')Error.Code;
export type ErrorSeverity.Type = import('./errors')Error.Severity// Constants for frontend coordination;
export const DEFAULT_API_CONFI.G = {
  baseUR.L: 'http://localhost:9999/api';
  timeout: 30000;
  headers: {
    'Content-Type': 'application/json';
  }} as const;
export const DEFAULT_WEBSOCKET_CONFI.G = {
  url: 'ws://localhost:9999/ws';
  reconnect.Interval: 3000;
  maxReconnect.Attempts: 5;
  heartbeat.Interval: 30000;
  timeout: 30000} as const;
export const DEFAULT_PAGINATIO.N = {
  page: 1;
  limit: 10;
  sort: 'created.At';
  order: 'desc' as const;
}// Type definitions for packagejson if this becomes a shared package;
export const PACKAGE_INF.O = {
  name: '@universal-ai-tools/types';
  version: TYPE_DEFINITIONS_VERSIO.N;
  description: 'Shared Type.Script type definitions for Universal A.I Tools';
  main: 'indexts';
  types: 'indexts'} as const;