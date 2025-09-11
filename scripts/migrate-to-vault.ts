#!/usr/bin/env tsx

/**
 * Migration Script: Environment Variables to Supabase Vault
 * 
 * This script migrates API keys from environment variables to Supabase Vault
 * for secure, production-ready secrets management.
 */

import { secretsManager } from '../src/services/secrets-manager';
import { log, LogContext } from '../src/utils/logger';

async function main() {
  console.log('🔐 Universal AI Tools - Vault Migration');
  console.log('=====================================\n');

  try {
    // Check if vault is available
    const vaultAvailable = await secretsManager.isVaultAvailable();
    console.log(`Vault Status: ${vaultAvailable ? '✅ Available' : '⚠️  Using Fallback'}\n`);

    // List current secrets
    console.log('📋 Current secrets in system:');
    const currentSecrets = await secretsManager.listSecrets();
    if (currentSecrets.length === 0) {
      console.log('   No secrets found\n');
    } else {
      currentSecrets.forEach(secret => {
        console.log(`   - ${secret}`);
      });
      console.log('');
    }

    // Migrate environment variables
    console.log('🚚 Migrating environment variables to vault...');
    const { migrated, errors } = await secretsManager.migrateFromEnv();

    console.log(`\n📊 Migration Results:`);
    console.log(`   ✅ Migrated: ${migrated} secrets`);
    console.log(`   ❌ Errors: ${errors} secrets`);

    if (migrated > 0) {
      console.log('\n🎉 Migration completed successfully!');
      console.log('\n💡 Next steps:');
      console.log('   1. Verify secrets are accessible via API');
      console.log('   2. Remove environment variables from .env files');
      console.log('   3. Update deployment configurations to use vault');
    } else {
      console.log('\n⚠️  No secrets were migrated.');
      console.log('   - Check that environment variables are set');
      console.log('   - Ensure they are not placeholder values (sk-dev-...)');
      console.log('   - Verify Supabase connection');
    }

    // Validate required secrets
    console.log('\n🔍 Validating required secrets...');
    const validation = await secretsManager.validateRequiredSecrets();
    
    if (validation.valid) {
      console.log('✅ All required secrets are present');
    } else {
      console.log('❌ Missing required secrets:');
      validation.missing.forEach(secret => {
        console.log(`   - ${secret}`);
      });
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Test individual secret operations
async function testSecretOperations() {
  console.log('\n🧪 Testing secret operations...\n');

  // Test setting a secret
  console.log('1. Testing secret creation...');
  const testSecret = await secretsManager.setSecret(
    'test_secret', 
    'test-value-123', 
    'Test secret for validation'
  );
  console.log(`   ${testSecret ? '✅' : '❌'} Set test secret`);

  // Test getting the secret
  console.log('2. Testing secret retrieval...');
  const retrievedSecret = await secretsManager.getSecret('test_secret');
  const retrievalWorked = retrievedSecret === 'test-value-123';
  console.log(`   ${retrievalWorked ? '✅' : '❌'} Retrieved test secret (${retrievedSecret})`);

  // Test deleting the secret
  console.log('3. Testing secret deletion...');
  const deleted = await secretsManager.deleteSecret('test_secret');
  console.log(`   ${deleted ? '✅' : '❌'} Deleted test secret`);

  // Verify it's gone
  console.log('4. Verifying deletion...');
  const shouldBeNull = await secretsManager.getSecret('test_secret');
  const deletionWorked = shouldBeNull === null;
  console.log(`   ${deletionWorked ? '✅' : '❌'} Secret properly deleted`);

  return testSecret && retrievalWorked && deletionWorked;
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--test')) {
    testSecretOperations()
      .then(success => {
        console.log(`\n🧪 Tests ${success ? 'PASSED' : 'FAILED'}`);
        process.exit(success ? 0 : 1);
      })
      .catch(error => {
        console.error('\n❌ Test failed:', error);
        process.exit(1);
      });
  } else {
    main()
      .then(() => {
        console.log('\n✅ Migration process completed');
        process.exit(0);
      })
      .catch(error => {
        console.error('\n❌ Migration failed:', error);
        process.exit(1);
      });
  }
}