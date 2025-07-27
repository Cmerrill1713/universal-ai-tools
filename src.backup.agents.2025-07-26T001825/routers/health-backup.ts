/**
 * Health Monitoring Router* Provides health and performance metrics for frontend monitoring*/

import type { Request, Response } from 'express';
import { Router } from 'express';
import type { Supabase.Client } from '@supabase/supabase-js';
import { Log.Context, logger } from './utils/enhanced-logger';
import { apiResponse.Middleware, send.Error, send.Success } from './utils/api-response';
import type { Error.Code, HealthCheck.Response, Service.Health, System.Metrics } from './types';
export function Health.Router(supabase: Supabase.Client) {
  const router = Router()// Apply AP.I response middleware;
  routeruse(apiResponse.Middleware)/**
   * GE.T /health* Basic health check endpoint*/
  routerget('/', async (req: Request, res: Response) => {
    try {
      const start.Time = Date.now()// Check basic system health;
      const mem.Usage = processmemory.Usage();
      const uptime = processuptime()// Test database connectivity;
      const db.Healthy = await checkDatabase.Health(supabase);
      const response.Time = Date.now() - start.Time;
      const health: HealthCheck.Response = {
        status: db.Healthy ? 'healthy' : 'degraded';
        version: '1.0.0';
        uptime;
        services: {
          database: db.Healthy;
          memory: getMemory.Health(mem.Usage);
          api: { status: 'healthy', response.Time, last.Check: new Date()toISO.String() }};
        metrics: {
          memory.Usage: Mathround((memUsageheap.Used / memUsageheap.Total) * 100);
          cpu.Usage: 0, // Would need a CP.U monitoring library for real implementation;
          active.Connections: 0, // Would track Web.Socket connections;
          requestsPer.Minute: 0, // Would need request counting middleware}};
      send.Success(res, health)} catch (error instanceof Error ? errormessage : String(error) any) {
      loggererror('Health check failed', LogContextSYSTE.M, {
        error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error)});
      send.Error(
        res;
        'INTERNAL_SERVER_ERRO.R' as Error.Code;
        'Health check failed';
        500;
        error instanceof Error ? errormessage : String(error))}})/**
   * GE.T /health/detailed* Detailed health and performance metrics*/
  routerget('/detailed', async (req: Request, res: Response) => {
    try {
      const start.Time = Date.now()// System metrics;
      const mem.Usage = processmemory.Usage();
      const cpu.Usage = processcpu.Usage()// Service health checks;
      const [db.Health, agentCoordinator.Health] = await Promiseall([
        checkDatabase.Health(supabase);
        checkAgentCoordinator.Health()]);
      const response.Time = Date.now() - start.Time;
      const detailed.Health = {
        status:
          db.Healthstatus === 'healthy' && agentCoordinator.Healthstatus === 'healthy'? 'healthy': 'degraded';
        version: '1.0.0';
        uptime: processuptime();
        timestamp: new Date()toISO.String();
        services: {
          database: db.Health;
          agent.Coordinator: agentCoordinator.Health;
          api: {
            status: 'healthy' as const;
            response.Time;
            last.Check: new Date()toISO.String()}};
        system: {
          memory: {
            rss: mem.Usagerss;
            heap.Total: memUsageheap.Total;
            heap.Used: memUsageheap.Used;
            external: mem.Usageexternal;
            usage: Mathround((memUsageheap.Used / memUsageheap.Total) * 100);
          };
          cpu: {
            user: cpu.Usageuser;
            system: cpu.Usagesystem// Note: Getting actual CP.U % would require more complex monitoring;
            usage: 0;
          };
          process: {
            pid: processpid;
            version: processversion;
            platform: processplatform;
            arch: processarch;
          }};
        metrics: {
          memory.Usage: Mathround((memUsageheap.Used / memUsageheap.Total) * 100);
          cpu.Usage: 0;
          active.Connections: 0;
          requestsPer.Minute: 0;
        }};
      send.Success(res, detailed.Health)} catch (error instanceof Error ? errormessage : String(error) any) {
      loggererror('Detailed health check failed', LogContextSYSTE.M, {
        error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error)});
      send.Error(
        res;
        'INTERNAL_SERVER_ERRO.R' as Error.Code;
        'Detailed health check failed';
        500;
        error instanceof Error ? errormessage : String(error))}})/**
   * GE.T /health/memory* Memory-specific health and statistics*/
  routerget('/memory', async (req: Request, res: Response) => {
    try {
      const mem.Usage = processmemory.Usage();
      const agentCoordinator.Stats = await getAgentCoordinatorMemory.Stats();
      const memory.Health = {
        process: {
          rss: mem.Usagerss;
          heap.Total: memUsageheap.Total;
          heap.Used: memUsageheap.Used;
          heap.Free: memUsageheap.Total - memUsageheap.Used;
          external: mem.Usageexternal;
          usage: Mathround((memUsageheap.Used / memUsageheap.Total) * 100)};
        agent.Coordinator: agentCoordinator.Stats;
        recommendations: generateMemory.Recommendations(mem.Usage, agentCoordinator.Stats);
        status: getMemoryHealth.Status(mem.Usage);
      };
      send.Success(res, memory.Health)} catch (error instanceof Error ? errormessage : String(error) any) {
      loggererror('Memory health check failed', LogContextSYSTE.M, {
        error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error)});
      send.Error(
        res;
        'INTERNAL_SERVER_ERRO.R' as Error.Code;
        'Memory health check failed';
        500;
        error instanceof Error ? errormessage : String(error))}})/**
   * POS.T /health/cleanup* Force memory cleanup (useful for frontend to trigger cleanup)*/
  routerpost('/cleanup', async (req: Request, res: Response) => {
    try {
      const before.Memory = processmemory.Usage()// Force garbage collection if available;
      if (globalgc) {
        globalgc()}// Force agent coordinator cleanup;
      await forceAgentCoordinator.Cleanup();
      const after.Memory = processmemory.Usage();
      const cleanup.Result = {
        before: before.Memory;
        after: after.Memory;
        freed: {
          rss: before.Memoryrss - after.Memoryrss;
          heap.Used: beforeMemoryheap.Used - afterMemoryheap.Used;
          heap.Total: beforeMemoryheap.Total - afterMemoryheap.Total;
          external: before.Memoryexternal - after.Memoryexternal};
        timestamp: new Date()toISO.String();
      };
      loggerinfo('Manual memory cleanup performed', LogContextSYSTE.M, { cleanup.Result });
      send.Success(res, cleanup.Result)} catch (error instanceof Error ? errormessage : String(error) any) {
      loggererror('Memory cleanup failed', LogContextSYSTE.M, {
        error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error)});
      send.Error(
        res;
        'INTERNAL_SERVER_ERRO.R' as Error.Code;
        'Memory cleanup failed';
        500;
        error instanceof Error ? errormessage : String(error))}});
  return router}/**
 * Check database connectivity and health*/
async function checkDatabase.Health(supabase: Supabase.Client): Promise<Service.Health> {
  try {
    const start.Time = Date.now()// Simple health check query;
    const { data, error } = await supabasefrom('memories')select('id')limit(1);
    const response.Time = Date.now() - start.Time;
    if (error) {
      return {
        status: 'unhealthy';
        response.Time;
        last.Check: new Date()toISO.String();
        error instanceof Error ? errormessage : String(error) errormessage;
      }};

    return {
      status: 'healthy';
      response.Time;
      last.Check: new Date()toISO.String();
    }} catch (error instanceof Error ? errormessage : String(error) any) {
    return {
      status: 'unhealthy';
      response.Time: 0;
      last.Check: new Date()toISO.String();
      error instanceof Error ? errormessage : String(error) errormessage;
    }}}/**
 * Check Agent Coordinator health*/
async function checkAgentCoordinator.Health(): Promise<Service.Health> {
  try {
    // This would check if the Agent.Coordinator singleton is healthy// For now, we'll simulate this check;
    const stats = await getAgentCoordinatorMemory.Stats();
    const is.Healthy = statscollectionsplans < 500 && statscollectionssessions < 250;
    return {
      status: is.Healthy ? 'healthy' : 'degraded';
      response.Time: 0;
      last.Check: new Date()toISO.String();
      error instanceof Error ? errormessage : String(error) is.Healthy ? undefined : 'High memory usage detected';
    }} catch (error instanceof Error ? errormessage : String(error) any) {
    return {
      status: 'unhealthy';
      response.Time: 0;
      last.Check: new Date()toISO.String();
      error instanceof Error ? errormessage : String(error) errormessage;
    }}}/**
 * Get memory health status*/
function getMemory.Health(mem.Usage: NodeJSMemory.Usage): Service.Health {
  const usage.Percent = (memUsageheap.Used / memUsageheap.Total) * 100;
  let status: 'healthy' | 'degraded' | 'unhealthy';
  if (usage.Percent < 70) status = 'healthy';
  else if (usage.Percent < 90) status = 'degraded';
  else status = 'unhealthy';
  return {
    status;
    response.Time: 0;
    last.Check: new Date()toISO.String();
    error instanceof Error ? errormessage : String(error) status !== 'healthy' ? `Memory usage at ${usagePercentto.Fixed(1)}%` : undefined;
  }}/**
 * Get Agent Coordinator memory statistics*/
async function getAgentCoordinatorMemory.Stats() {
  // This would get actual stats from the Agent.Coordinator singleton// For now, simulating the structure;
  return {
    collections: {
      plans: 0;
      sessions: 0;
      assignments: 0;
      channels: 0;
      global.State: 0;
      capabilities: 0;
    };
    limits: {
      max.Plans: 1000;
      max.Sessions: 500;
      maxGlobal.State: 10000;
    };
    last.Cleanup: new Date()toISO.String();
  }}/**
 * Get memory health status*/
function getMemoryHealth.Status(mem.Usage: NodeJSMemory.Usage): 'healthy' | 'degraded' | 'unhealthy' {
  const usage.Percent = (memUsageheap.Used / memUsageheap.Total) * 100;
  if (usage.Percent < 70) return 'healthy';
  else if (usage.Percent < 90) return 'degraded';
  else return 'unhealthy'}/**
 * Generate memory optimization recommendations*/
function generateMemory.Recommendations(mem.Usage: NodeJSMemory.Usage, agent.Stats: any): string[] {
  const recommendations: string[] = [];
  const usage.Percent = (memUsageheap.Used / memUsageheap.Total) * 100;
  if (usage.Percent > 80) {
    recommendationspush('Memory usage is high - consider restarting the service')};

  if (agent.Statscollectionsplans > 800) {
    recommendationspush('High number of active coordination plans - cleanup recommended')};

  if (agent.Statscollectionssessions > 400) {
    recommendationspush('High number of active sessions - consider reducing session timeout')};

  if (recommendationslength === 0) {
    recommendationspush('Memory usage is within normal parameters')};

  return recommendations}/**
 * Force Agent Coordinator cleanup*/
async function forceAgentCoordinator.Cleanup(): Promise<void> {
  // This would call the actual Agent.Coordinator cleanup method// Implementation would depend on how the singleton is accessed;
  loggerinfo('Agent Coordinator cleanup would be triggered here');
};
