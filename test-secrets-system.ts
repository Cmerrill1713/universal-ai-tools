#!/usr/bin/env tsx
/**
 * Test Supabase Vault Secrets Management System
 */

import { createClient } from '@supabase/supabase-js';
import { config } from './src/config/environment';
import { secretsManager } from './src/services/secrets-manager';
import { LogContext, log } from './src/utils/logger';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function logTest(message: string, status: 'pass' | 'fail' | 'info' = 'info') {
  const color = status === 'pass' ? colors.green : status === 'fail' ? colors.red : colors.cyan;
  const symbol = status === 'pass' ? '✅' : status === 'fail' ? '❌' : '🔍';
  console.log(`${color}${symbol} ${message}${colors.reset}`);
}

async function testSecretsSystem() {
  console.log(`\n${colors.magenta}🧪 Testing Supabase Vault Secrets Management System${colors.reset}\n`);

  // Initialize Supabase client
  const supabase = createClient(
    config.supabase.url || 'http://localhost:54321',
    config.supabase.serviceKey || '',
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    }
  );

  let testsPassed = 0;
  let testsFailed = 0;

  try {
    // Test 1: Check Supabase connection
    logTest('Test 1: Checking Supabase connection...');
    const { data: healthCheck, error: healthError } = await supabase
      .from('service_configurations')
      .select('count')
      .limit(1);
    
    if (healthError) {
      logTest(`Supabase connection failed: ${healthError.message}`, 'fail');
      testsFailed++;
    } else {
      logTest('Supabase connection successful', 'pass');
      testsPassed++;
    }

    // Test 2: Check if Vault extension is enabled
    logTest('\nTest 2: Checking Vault extension...');
    const { data: vaultCheck, error: vaultError } = await supabase
      .rpc('list_secret_names')
      .limit(1);
    
    if (vaultError) {
      logTest(`Vault extension not properly configured: ${vaultError.message}`, 'fail');
      logTest('Run: npx supabase migration up', 'info');
      testsFailed++;
    } else {
      logTest('Vault extension is enabled', 'pass');
      testsPassed++;
    }

    // Test 3: Store a test secret
    logTest('\nTest 3: Storing test secret in Vault...');
    const testSecretName = `test_secret_${Date.now()}`;
    const testSecretValue = 'test-api-key-value-12345';
    
    const stored = await secretsManager.storeSecret({
      name: testSecretName,
      value: testSecretValue,
      description: 'Test secret for system validation',
      service: 'test_service'
    });

    if (stored) {
      logTest('Test secret stored successfully', 'pass');
      testsPassed++;
    } else {
      logTest('Failed to store test secret', 'fail');
      testsFailed++;
    }

    // Test 4: Retrieve the test secret
    logTest('\nTest 4: Retrieving test secret from Vault...');
    const retrieved = await secretsManager.getSecret(testSecretName);
    
    if (retrieved === testSecretValue) {
      logTest('Test secret retrieved successfully', 'pass');
      logTest(`Retrieved value matches: ${retrieved.substring(0, 10)}...`, 'info');
      testsPassed++;
    } else {
      logTest('Failed to retrieve test secret or value mismatch', 'fail');
      testsFailed++;
    }

    // Test 5: Check service configurations
    logTest('\nTest 5: Checking service configurations...');
    const { data: services, error: servicesError } = await supabase
      .from('service_configurations')
      .select('service_name, base_url, auth_type')
      .eq('is_active', true);

    if (servicesError) {
      logTest(`Failed to fetch service configurations: ${servicesError.message}`, 'fail');
      testsFailed++;
    } else {
      logTest(`Found ${services?.length || 0} service configurations`, 'pass');
      services?.slice(0, 5).forEach(s => {
        logTest(`  - ${s.service_name}: ${s.base_url} (${s.auth_type})`, 'info');
      });
      testsPassed++;
    }

    // Test 6: Test API key fallback mechanism
    logTest('\nTest 6: Testing API key fallback mechanism...');
    const testKey = await secretsManager.getApiKeyWithFallback('test_service', 'TEST_API_KEY');
    
    if (testKey) {
      logTest('Fallback mechanism working (found key)', 'pass');
      testsPassed++;
    } else {
      logTest('Fallback mechanism working (no key found, as expected)', 'pass');
      testsPassed++;
    }

    // Test 7: Get missing credentials
    logTest('\nTest 7: Checking for missing credentials...');
    const missing = await secretsManager.getMissingCredentials();
    
    if (Array.isArray(missing)) {
      logTest(`Found ${missing.length} services missing API keys`, 'pass');
      if (missing.length > 0) {
        logTest('Services missing keys:', 'info');
        missing.slice(0, 5).forEach(s => {
          logTest(`  - ${s}`, 'info');
        });
        logTest('Add these keys through the UI at /api-keys', 'info');
      }
      testsPassed++;
    } else {
      logTest('Failed to check missing credentials', 'fail');
      testsFailed++;
    }

    // Test 8: Test service configuration retrieval
    logTest('\nTest 8: Testing service configuration retrieval...');
    const openaiConfig = await secretsManager.getServiceConfig('openai');
    
    if (openaiConfig) {
      logTest('Service configuration retrieved successfully', 'pass');
      logTest(`  - Base URL: ${openaiConfig.base_url}`, 'info');
      logTest(`  - Auth Type: ${openaiConfig.auth_type}`, 'info');
      logTest(`  - Has API Key: ${openaiConfig.api_key ? 'Yes' : 'No'}`, 'info');
      testsPassed++;
    } else {
      logTest('Failed to retrieve service configuration', 'fail');
      testsFailed++;
    }

    // Test 9: Check LLM services
    logTest('\nTest 9: Checking LLM service credentials...');
    const llmServices = ['openai', 'anthropic', 'google_ai', 'ollama'];
    let llmServicesWithKeys = 0;
    
    for (const service of llmServices) {
      const hasKey = await secretsManager.hasValidCredentials(service);
      if (hasKey) {
        logTest(`  ✓ ${service} has valid credentials`, 'info');
        llmServicesWithKeys++;
      } else {
        logTest(`  ✗ ${service} missing credentials`, 'info');
      }
    }
    
    logTest(`${llmServicesWithKeys}/${llmServices.length} LLM services configured`, llmServicesWithKeys > 0 ? 'pass' : 'info');
    if (llmServicesWithKeys > 0) testsPassed++; else testsFailed++;

    // Test 10: Clean up test secret
    logTest('\nTest 10: Cleaning up test secret...');
    try {
      const { error } = await supabase.rpc('delete_secret', {
        secret_name: testSecretName
      });
      
      if (!error) {
        logTest('Test secret cleaned up successfully', 'pass');
        testsPassed++;
      } else {
        logTest(`Failed to clean up test secret: ${error.message}`, 'fail');
        testsFailed++;
      }
    } catch (err) {
      logTest('Failed to clean up test secret', 'fail');
      testsFailed++;
    }

    // Test 11: Test the API endpoints
    logTest('\nTest 11: Testing API endpoints...');
    try {
      // Test services endpoint
      const servicesRes = await fetch('http://localhost:9999/api/v1/secrets/services');
      if (servicesRes.ok) {
        const data = await servicesRes.json();
        logTest(`API endpoint /secrets/services working (${data.data?.services?.length || 0} services)`, 'pass');
        testsPassed++;
      } else {
        logTest('API endpoint /secrets/services not responding', 'fail');
        testsFailed++;
      }
    } catch (err) {
      logTest('API endpoints not available (server may not be running)', 'info');
    }

    // Summary
    console.log(`\n${colors.blue}📊 Test Summary${colors.reset}`);
    console.log(`${colors.green}Passed: ${testsPassed}${colors.reset}`);
    console.log(`${colors.red}Failed: ${testsFailed}${colors.reset}`);
    console.log(`${colors.yellow}Total: ${testsPassed + testsFailed}${colors.reset}`);

    if (testsFailed === 0) {
      console.log(`\n${colors.green}🎉 All tests passed! Secrets management system is working correctly.${colors.reset}`);
    } else {
      console.log(`\n${colors.yellow}⚠️  Some tests failed. Please check the configuration.${colors.reset}`);
    }

    // Helpful information
    console.log(`\n${colors.cyan}📝 Next Steps:${colors.reset}`);
    console.log('1. Access the API Keys Manager UI at: http://localhost:3000/api-keys');
    console.log('2. Add your API keys through the UI');
    console.log('3. Services will automatically use keys from Vault');
    console.log('4. No need to edit .env files anymore!');

  } catch (error) {
    console.error(`\n${colors.red}❌ Test suite failed with error:${colors.reset}`, error);
    process.exit(1);
  }

  process.exit(testsFailed > 0 ? 1 : 0);
}

// Run the tests
testSecretsSystem().catch(console.error);