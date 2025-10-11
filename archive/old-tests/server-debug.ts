#!/usr/bin/env node

// Debug version of server to identify hanging point

console.log('🔍 DEBUG: Starting server debug...');

// Override console to add timestamps
const originalLog = console.log;
console.log = (...args: any[]) => {
  originalLog(new Date().toISOString(), ...args);
};

console.log('🔍 DEBUG: About to import modules...');

// Test imports one by one
async function debugStartup() {
  try {
    console.log('🔍 DEBUG: Importing express...');
    const express = await import('express');
    console.log('✅ DEBUG: express imported');
    
    console.log('🔍 DEBUG: Importing cors...');
    const cors = await import('cors');
    console.log('✅ DEBUG: cors imported');
    
    console.log('🔍 DEBUG: Importing @supabase/supabase-js...');
    const { createClient } = await import('@supabase/supabase-js');
    console.log('✅ DEBUG: @supabase/supabase-js imported');
    
    console.log('🔍 DEBUG: Importing config...');
    const { config, initializeConfig } = await import('./src/config/index');
    console.log('✅ DEBUG: config imported');
    
    console.log('🔍 DEBUG: Initializing config...');
    initializeConfig();
    console.log('✅ DEBUG: config initialized');
    
    console.log('🔍 DEBUG: Creating Supabase client...');
    const supabase = createClient(
      config.database.supabaseUrl,
      config.database.supabaseServiceKey || ''
    );
    console.log('✅ DEBUG: Supabase client created');
    
    console.log('🔍 DEBUG: Importing enhanced logger...');
    const { logger } = await import('./src/utils/enhanced-logger');
    console.log('✅ DEBUG: logger imported');
    
    console.log('🔍 DEBUG: Importing dspy-service...');
    console.log('  - This imports DSPyBridge which may spawn a Python process...');
    const dspyModule = await import('./src/services/dspy-service');
    console.log('✅ DEBUG: dspy-service imported');
    console.log('  - dspyService instance:', !!dspyModule.dspyService);
    
    console.log('🔍 DEBUG: Importing security-hardening...');
    const securityModule = await import('./src/services/security-hardening');
    console.log('✅ DEBUG: security-hardening imported');
    console.log('  - securityHardeningService instance:', !!securityModule.securityHardeningService);
    
    console.log('🔍 DEBUG: Importing performance middleware...');
    const { default: PerformanceMiddleware } = await import('./src/middleware/performance');
    console.log('✅ DEBUG: performance middleware imported');
    
    console.log('🔍 DEBUG: Creating performance middleware instance...');
    const performanceMiddleware = new PerformanceMiddleware(supabase, {
      enableRequestTiming: true,
      enableMemoryMonitoring: true,
      enableCacheMetrics: true,
      enableDatabaseOptimization: true,
      slowRequestThreshold: 2000,
      memoryThreshold: 1024,
      requestTimeoutMs: 30000
    });
    console.log('✅ DEBUG: performance middleware created');
    
    console.log('\n✅ All critical imports completed successfully!');
    console.log('The server should be able to start now.');
    
    // Test creating the Express app
    console.log('\n🔍 DEBUG: Creating Express app...');
    const app = express.default();
    console.log('✅ DEBUG: Express app created');
    
    console.log('\n🔍 DEBUG: Testing server listen...');
    const server = app.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === 'object' ? addr?.port : 'unknown';
      console.log(`✅ DEBUG: Server successfully listening on random port ${port}`);
      server.close();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ DEBUG: Error during startup:', error);
    process.exit(1);
  }
}

// Set a timeout to catch hangs
const timeout = setTimeout(() => {
  console.error('\n❌ DEBUG: TIMEOUT - Process hung for more than 30 seconds');
  console.error('Check the last successful import above to identify the hanging module');
  process.exit(1);
}, 30000);

// Run the debug
debugStartup().then(() => {
  clearTimeout(timeout);
}).catch(error => {
  clearTimeout(timeout);
  console.error('❌ DEBUG: Unhandled error:', error);
  process.exit(1);
});