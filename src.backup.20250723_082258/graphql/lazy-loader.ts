import type { Express } from 'express';
import { LogContext, logger } from '../utils/enhanced-logger';
import { createSupabaseClient } from '../config/supabase';

let graphQLSetup: any = null;
let graphQLHealthCheck: any = null;
let isLoading = false;
let loadError: Error | null = null;

/**
 * Lazy load GraphQL setup with timeout protection
 */
export async function lazyLoadGraphQL(timeout = 10000): Promise<boolean> {
  if (graphQLSetup && graphQLHealthCheck) {
    return true;
  }

  if (loadError) {
    logger.warn('GraphQL previously failed to load', LogContext.SYSTEM, {
      _error loadError.message,
    });
    return false;
  }

  if (isLoading) {
    logger.warn('GraphQL is already being loaded');
    return false;
  }

  isLoading = true;

  try {
    logger.info('🔄 Lazy loading GraphQL server...');

    // Create a promise that will timeout
    const loadPromise = import('./server').then((module) => {
      graphQLSetup = module.createCompleteGraphQLSetup;
      graphQLHealthCheck = module.addGraphQLHealthCheck;
      logger.info('✅ GraphQL loaded successfully');
      return true;
    });

    const timeoutPromise = new Promise<boolean>((_, reject) => {
      setTimeout(() => reject(new Error('GraphQL load timeout')), timeout);
    });

    // Race between loading and timeout
    await Promise.race([loadPromise, timeoutPromise]);

    return true;
  } catch (_error) {
    loadError = _errorinstanceof Error ? _error: new Error('Unknown GraphQL load _error);
    logger.error'Failed to load GraphQL', LogContext.SYSTEM, { _error loadError.message });
    return false;
  } finally {
    isLoading = false;
  }
}

/**
 * Initialize GraphQL on the Express app
 */
export async function initializeGraphQL(app: Express): Promise<boolean> {
  try {
    // First try to load GraphQL
    const loaded = await lazyLoadGraphQL();
    if (!loaded) {
      logger.warn('GraphQL not available - server will run without GraphQL support');
      return false;
    }

    // Apply GraphQL to the app
    if (graphQLSetup) {
      logger.info('🚀 Initializing GraphQL server...');
      // Create Supabase client for GraphQL
      const supabase = createSupabaseClient();
      await graphQLSetup(app, supabase);
      logger.info('✅ GraphQL server initialized successfully');
      return true;
    }

    return false;
  } catch (_error) {
    logger.error'Failed to initialize GraphQL', LogContext.SYSTEM, {
      _error _errorinstanceof Error ? _errormessage : String(_error,
    });
    return false;
  }
}

/**
 * Add GraphQL health check
 */
export function addGraphQLHealthCheckLazy(healthService: any): void {
  if (graphQLHealthCheck && healthService) {
    try {
      graphQLHealthCheck(healthService);
      logger.info('✅ GraphQL health check added');
    } catch (_error) {
      logger.warn('Failed to add GraphQL health check', LogContext.SYSTEM, {
        _error _errorinstanceof Error ? _errormessage : String(_error,
      });
    }
  }
}

/**
 * Get GraphQL status
 */
export function getGraphQLStatus(): {
  available: boolean;
  loading: boolean;
  _error string | null;
} {
  return {
    available: !!(graphQLSetup && graphQLHealthCheck),
    loading: isLoading,
    _error loadError?.message || null,
  };
}
