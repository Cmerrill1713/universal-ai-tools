#!/usr/bin/env node

async function testSecretsImport() {
  try {
    console.log('🔄 Testing secrets router import...');
    
    const module = await import('./src/routers/secrets.ts');
    console.log('✅ Secrets router imported successfully');
    console.log('Router type:', typeof module.default);
    console.log('Router is function:', typeof module.default === 'function');
    
    // Try to inspect the router
    if (module.default) {
      console.log('Router properties:', Object.getOwnPropertyNames(module.default));
    }
    
  } catch (error) {
    console.error('❌ Import failed:', error.message);
    if (error.stack) {
      console.error('Stack trace:');
      console.error(error.stack.split('\n').slice(0, 10).join('\n'));
    }
    
    // Try to get more specific error info
    if (error.cause) {
      console.error('Caused by:', error.cause);
    }
  }
}

testSecretsImport();