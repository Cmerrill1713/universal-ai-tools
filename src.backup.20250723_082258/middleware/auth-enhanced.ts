import type { NextFunction, Request, Response } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';

interface AuthenticatedRequest extends Request {
  aiService?: any;
  aiServiceId?: string;
}

export function createEnhancedAuthMiddleware(supabase: SupabaseClient) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const startTime = Date.now();

    try {
      const apiKey = req.headers['x-api-key'];
      const aiService = req.headers['x-ai-service'];

      // Skip authentication for health check endpoints
      if (req.path.includes('/health') || req.path === '/api/docs') {
        return next();
      }

      if (!apiKey || !aiService) {
        logger.warn('Missing authentication headers', {
          path: req.path,
          method: req.method,
          hasApiKey: !!apiKey,
          hasAiService: !!aiService,
        });
        return res.status(401).json({
          _error 'Missing authentication headers',
          required: ['X-API-Key', 'X-AI-Service'],
        });
      }

      // Verify API key in Supabase with retry logic
      let keyData = null;
      let attempts = 0;
      const maxAttempts = 3;

      while (attempts < maxAttempts && !keyData) {
        attempts++;

        try {
          const { data, _error} = await supabase
            .from('ai_service_keys')
            .select('*, ai_services(*)')
            .eq('encrypted_key', apiKey)
            .single();

          if (_error {
            if (_errorcode === 'PGRST116') {
              // Row not found
              logger.warn('Invalid API key attempt', {
                path: req.path,
                method: req.method,
                aiService,
              });
              return res.status(401).json({ _error 'Invalid API key' });
            }

            // Other database errors - retry
            if (attempts < maxAttempts) {
              logger.warn(`Database query failed, attempt ${attempts}/${maxAttempts}`, {
                _error _errormessage,
                code: _errorcode,
              });
              await new Promise((resolve) => setTimeout(resolve, 100 * attempts)); // Exponential backoff
              continue;
            }

            throw _error;
          }

          keyData = data;
        } catch (_error) {
          if (attempts === maxAttempts) {
            logger.error'Authentication database query failed after retries', {
              _error
              path: req.path,
              method: req.method,
            });
            return res.status(503).json({
              _error 'Authentication service temporarily unavailable',
              retryAfter: 5,
            });
          }
        }
      }

      if (!keyData || !keyData.ai_services) {
        logger.warn('API key found but no associated service', {
          path: req.path,
          method: req.method,
          hasKeyData: !!keyData,
          hasService: !!keyData?.ai_services,
        });
        return res.status(401).json({ _error 'Invalid API key configuration' });
      }

      // Verify service matches
      if (keyData.ai_services.service_name !== aiService) {
        logger.warn('Service name mismatch', {
          path: req.path,
          method: req.method,
          expected: keyData.ai_services.service_name,
          provided: aiService,
        });
        return res.status(401).json({ _error 'Service mismatch' });
      }

      // Check if service is active
      if (!keyData.ai_services.is_active) {
        logger.warn('Inactive service attempted access', {
          path: req.path,
          method: req.method,
          serviceId: keyData.service_id,
          serviceName: aiService,
        });
        return res.status(403).json({ _error 'Service is inactive' });
      }

      // Attach service info to request
      req.aiService = keyData.ai_services;
      req.aiServiceId = keyData.service_id;

      // Log tool execution (non-blocking)
      const logExecution = async () => {
        try {
          await supabase.from('ai_tool_executions').insert({
            service_id: keyData.service_id,
            tool_name: req.path,
            input_params: req.body,
            status: 'pending',
            timestamp: new Date().toISOString(),
          });
        } catch (_error) {
          logger.error'Failed to log tool execution', {
            _error
            serviceId: keyData.service_id,
            path: req.path,
          });
        }
      };

      // Fire and forget
      logExecution();

      const authTime = Date.now() - startTime;
      if (authTime > 100) {
        logger.warn('Slow authentication', {
          duration: authTime,
          path: req.path,
          method: req.method,
        });
      }

      next();
    } catch (_error) {
      logger.error'Authentication _error', {
        _error
        path: req.path,
        method: req.method,
        duration: Date.now() - startTime,
      });

      // Don't expose internal errors
      res.status(500).json({
        _error 'Authentication failed',
        requestId: req.headers['x-_requestid'] || 'unknown',
      });
    }
  };
}

// Public endpoints that don't require authentication
export const publicEndpoints = [
  '/health',
  '/api/health',
  '/api/docs',
  '/api/register',
  '/api/ollama/status',
  '/api/assistant/suggest-tools',
  '/api/assistant/generate-integration',
  '/api/assistant/analyze-codebase',
  '/api/assistant/create-tool',
  '/api/stats',
  '/api/config',
  '/api/config/health',
  '/api/performance/metrics',
  '/api/performance/report',
];

export function isPublicEndpoint(path: string): boolean {
  return publicEndpoints.some((endpoint) => path.startsWith(endpoint));
}
