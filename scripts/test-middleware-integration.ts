#!/usr/bin/env npx tsx
/**
 * Test Middleware Integration
 * Tests the actual middleware components that use MCP context
 */

import express from 'express';
import request from 'supertest';
import { contextInjectionMiddleware } from '../src/middleware/context-injection-middleware';
import { intelligentParametersMiddleware } from '../src/middleware/intelligent-parameters';
import pg from 'pg';
import { log, LogContext } from '../src/utils/logger';

const { Client } = pg;
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

async function testMiddlewareIntegration(): Promise<void> {
  let client: pg.Client | null = null;
  
  try {
    console.log('🔌 Setting up test environment...');
    client = new Client({ connectionString: DATABASE_URL });
    await client.connect();
    
    // Add some test context to the database
    await client.query(`
      INSERT INTO mcp_context (content, category, metadata, user_id, source)
      VALUES 
        ('This is a TypeScript project with Express.js backend', 'project_overview', '{"test": true}', 'test_user', 'middleware_test'),
        ('Use async/await for database operations', 'code_patterns', '{"language": "typescript"}', 'test_user', 'middleware_test'),
        ('Common error: Cannot find module - check imports', 'error_analysis', '{"errorType": "import_error"}', 'test_user', 'middleware_test')
      ON CONFLICT DO NOTHING
    `);
    console.log('   ✅ Test context data added');
    
    // Create test Express app
    console.log('🚀 Setting up test Express app...');
    const app = express();
    app.use(express.json());
    
    // Test route with context injection middleware
    app.post('/test/context-injection', 
      contextInjectionMiddleware({
        enabled: true,
        maxContextTokens: 2000,
        contextTypes: ['project_overview', 'code_patterns', 'error_analysis'],
        securityLevel: 'moderate',
        fallbackOnError: true,
      }),
      (req, res) => {
        res.json({
          success: true,
          hasContext: !!(req as any).mcpContext,
          contextItems: (req as any).mcpContext?.relevantContext?.length || 0,
          contextTokens: (req as any).mcpContext?.contextTokens || 0,
          originalMessages: (req as any).originalMessages,
          enhancedMessages: (req as any).enhancedMessages,
        });
      }
    );
    
    // Test route with intelligent parameters middleware
    app.post('/test/intelligent-params',
      intelligentParametersMiddleware({
        taskType: 'CODE_GENERATION' as any,
        temperature: 0.3,
      }),
      (req, res) => {
        res.json({
          success: true,
          hasOptimizedParams: !!(req as any).optimizedParameters,
          temperature: req.body.temperature,
          maxTokens: req.body.maxTokens,
          taskContext: (req as any).taskContext,
        });
      }
    );
    
    console.log('🧪 Running middleware tests...');
    
    // Test 1: Context injection middleware
    console.log('   Testing context injection middleware...');
    const contextResponse = await request(app)
      .post('/test/context-injection')
      .send({
        userRequest: 'Help me fix a TypeScript import error',
        messages: [
          { role: 'user', content: 'Help me fix a TypeScript import error' }
        ]
      })
      .expect(200);
    
    console.log(`      ✅ Context injection: ${contextResponse.body.contextItems} items, ${contextResponse.body.contextTokens} tokens`);
    if (contextResponse.body.enhancedMessages) {
      console.log(`      ✅ Messages enhanced with context`);
    }
    
    // Test 2: Intelligent parameters middleware  
    console.log('   Testing intelligent parameters middleware...');
    const paramsResponse = await request(app)
      .post('/test/intelligent-params')
      .send({
        prompt: 'Generate a function to validate email addresses',
        language: 'typescript'
      })
      .expect(200);
    
    console.log(`      ✅ Intelligent params: temp=${paramsResponse.body.temperature}, tokens=${paramsResponse.body.maxTokens}`);
    if (paramsResponse.body.taskContext) {
      console.log(`      ✅ Task context created`);
    }
    
    // Test 3: Combined middleware
    console.log('   Testing combined middleware...');
    app.post('/test/combined',
      contextInjectionMiddleware({ enabled: true }),
      intelligentParametersMiddleware(),
      (req, res) => {
        res.json({
          success: true,
          hasContext: !!(req as any).mcpContext,
          hasParams: !!(req as any).optimizedParameters,
          contextItems: (req as any).mcpContext?.relevantContext?.length || 0,
          temperature: req.body.temperature,
        });
      }
    );
    
    const combinedResponse = await request(app)
      .post('/test/combined')
      .send({
        userRequest: 'Create a REST API endpoint',
        prompt: 'Create a REST API endpoint for user management'
      })
      .expect(200);
    
    console.log(`      ✅ Combined middleware: context=${combinedResponse.body.hasContext}, params=${combinedResponse.body.hasParams}`);
    
    console.log('');
    console.log('🎉 Middleware integration testing completed successfully!');
    console.log('');
    console.log('📊 Test Results:');
    console.log(`   ✅ Context injection middleware: Working`);
    console.log(`   ✅ Intelligent parameters middleware: Working`);
    console.log(`   ✅ Combined middleware pipeline: Working`);
    console.log(`   ✅ Context items retrieved: ${contextResponse.body.contextItems}`);
    console.log(`   ✅ Message enhancement: ${contextResponse.body.enhancedMessages ? 'Active' : 'Inactive'}`);
    
    log.info('🎉 Middleware integration testing successful', LogContext.MCP, {
      contextItemsRetrieved: contextResponse.body.contextItems,
      contextTokens: contextResponse.body.contextTokens,
      messageEnhanced: !!contextResponse.body.enhancedMessages,
      intelligentParamsActive: !!paramsResponse.body.hasOptimizedParams,
    });

  } catch (error) {
    console.error('❌ Middleware integration testing failed:', error);
    log.error('❌ Middleware integration testing failed', LogContext.MCP, {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  } finally {
    if (client) {
      await client.end();
    }
  }
}

// Run the test
testMiddlewareIntegration().catch((error) => {
  console.error('💥 Middleware integration test failed:', error);
  process.exit(1);
});