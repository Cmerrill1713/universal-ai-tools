/**
 * OpenAPI Documentation Setup
 * Wires comprehensive API documentation into the Express app
 */

import type { Application } from 'express';

import { log, LogContext } from '@/utils/logger';

import { setupOpenAPIDocumentation } from './openapi-integration';

/**
 * Wire OpenAPI documentation and validation
 * This is the main entry point for API documentation
 */
export async function wireOpenAPIDocs(app: Application): Promise<void> {
  try {
    // Set up comprehensive OpenAPI documentation
    await setupOpenAPIDocumentation(app, {
      enableValidation: process.env.ENABLE_API_VALIDATION === 'true',
      enableMockMode: process.env.ENABLE_MOCK_MODE === 'true',
      apiKeyHeader: 'X-API-Key'
    });
    
    log.info('📚 API Documentation initialized', LogContext.API, {
      docsUrl: '/api/docs',
      specUrl: '/api/openapi.json',
      gettingStarted: '/docs/api-getting-started.md'
    });
    
  } catch (error) {
    log.warn('Failed to initialize OpenAPI documentation', LogContext.API, {
      error: error instanceof Error ? error.message : String(error),
      note: 'API will continue without documentation'
    });
  }
}
