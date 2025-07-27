import type { Next.Function, Request, Response } from 'express';
import type { Supabase.Client } from '@supabase/supabase-js';
import { logger } from './utils/logger';
interface Authenticated.Request extends Request {
  ai.Service?: any;
  aiService.Id?: string;
};

export function createEnhancedAuth.Middleware(supabase: Supabase.Client) {
  return async (req: Authenticated.Request, res: Response, next: Next.Function) => {
    const start.Time = Date.now();
    try {
      const api.Key = reqheaders['x-api-key'];
      const ai.Service = reqheaders['x-ai-service']// Skip authentication for health check endpoints;
      if (reqpathincludes('/health') || reqpath === '/api/docs') {
        return next()};

      if (!api.Key || !ai.Service) {
        loggerwarn('Missing authentication headers', {
          path: reqpath;
          method: reqmethod;
          hasApi.Key: !!api.Key;
          hasAi.Service: !!ai.Service});
        return resstatus(401)json({
          error instanceof Error ? errormessage : String(error) 'Missing authentication headers';
          required: ['X-AP.I-Key', 'X-A.I-Service']})}// Verify AP.I key in Supabase with retry logic;
      let key.Data = null;
      let attempts = 0;
      const max.Attempts = 3;
      while (attempts < max.Attempts && !key.Data) {
        attempts++
        try {
          const { data, error } = await supabase;
            from('ai_service_keys');
            select('*, ai_services(*)');
            eq('encrypted_key', api.Key);
            single();
          if (error instanceof Error ? errormessage : String(error){
            if (errorcode === 'PGRS.T116') {
              // Row not found;
              loggerwarn('Invalid AP.I key attempt', {
                path: reqpath;
                method: reqmethod;
                ai.Service});
              return resstatus(401)json({ error instanceof Error ? errormessage : String(error) 'Invalid AP.I key' })}// Other database errors - retry;
            if (attempts < max.Attempts) {
              loggerwarn(`Database query failed, attempt ${attempts}/${max.Attempts}`, {
                error instanceof Error ? errormessage : String(error) errormessage;
                code: errorcode});
              await new Promise((resolve) => set.Timeout(resolve, 100 * attempts))// Exponential backoff;
              continue};

            throw error instanceof Error ? errormessage : String(error)};

          key.Data = data} catch (error) {
          if (attempts === max.Attempts) {
            loggererror('Authentication database query failed after retries', {
              error;
              path: reqpath;
              method: reqmethod});
            return resstatus(503)json({
              error instanceof Error ? errormessage : String(error) 'Authentication service temporarily unavailable';
              retry.After: 5})}}};

      if (!key.Data || !key.Dataai_services) {
        loggerwarn('AP.I key found but no associated service', {
          path: reqpath;
          method: reqmethod;
          hasKey.Data: !!key.Data;
          has.Service: !!key.Data?ai_services});
        return resstatus(401)json({ error instanceof Error ? errormessage : String(error) 'Invalid AP.I key configuration' })}// Verify service matches;
      if (key.Dataai_servicesservice_name !== ai.Service) {
        loggerwarn('Service name mismatch', {
          path: reqpath;
          method: reqmethod;
          expected: key.Dataai_servicesservice_name;
          provided: ai.Service});
        return resstatus(401)json({ error instanceof Error ? errormessage : String(error) 'Service mismatch' })}// Check if service is active;
      if (!key.Dataai_servicesis_active) {
        loggerwarn('Inactive service attempted access', {
          path: reqpath;
          method: reqmethod;
          service.Id: key.Dataservice_id;
          service.Name: ai.Service});
        return resstatus(403)json({ error instanceof Error ? errormessage : String(error) 'Service is inactive' })}// Attach service info to request;
      reqai.Service = key.Dataai_services;
      reqaiService.Id = key.Dataservice_id// Log tool execution (non-blocking);
      const log.Execution = async () => {
        try {
          await supabasefrom('ai_tool_executions')insert({
            service_id: key.Dataservice_id;
            tool_name: reqpath;
            input_params: reqbody;
            status: 'pending';
            timestamp: new Date()toISO.String()})} catch (error) {
          loggererror('Failed to log tool execution', {
            error;
            service.Id: key.Dataservice_id;
            path: reqpath})}}// Fire and forget;
      log.Execution();
      const auth.Time = Date.now() - start.Time;
      if (auth.Time > 100) {
        loggerwarn('Slow authentication', {
          duration: auth.Time;
          path: reqpath;
          method: reqmethod})};

      next()} catch (error) {
      loggererror('Authentication error instanceof Error ? errormessage : String(error), {
        error;
        path: reqpath;
        method: reqmethod;
        duration: Date.now() - start.Time})// Don't expose internal errors;
      resstatus(500)json({
        error instanceof Error ? errormessage : String(error) 'Authentication failed';
        request.Id: reqheaders['x-requestid'] || 'unknown'})}}}// Public endpoints that don't require authentication;
export const public.Endpoints = [
  '/health';
  '/api/health';
  '/api/docs';
  '/api/register';
  '/api/ollama/status';
  '/api/assistant/suggest-tools';
  '/api/assistant/generate-integration';
  '/api/assistant/analyze-codebase';
  '/api/assistant/create-tool';
  '/api/stats';
  '/api/config';
  '/api/config/health';
  '/api/performance/metrics';
  '/api/performance/report'];
export function isPublic.Endpoint(path: string): boolean {
  return public.Endpointssome((endpoint) => pathstarts.With(endpoint))};
