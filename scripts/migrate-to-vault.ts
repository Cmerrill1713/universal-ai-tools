#!/usr/bin/env tsx

/**
 * Vault Migration Script
 * Migrates all API keys from environment variables to Supabase Vault
 * 
 * Usage: npm run migrate:vault
 */

import { vaultMigrationService } from '../src/services/vault-migration-service';
import { vaultService } from '../src/services/vault-service';
import { LogContext, log } from '../src/utils/logger';

async function main() {
  console.log('🔐 Universal AI Tools - Vault Migration');
  console.log('=====================================\n');

  try {
    // Step 1: Validate vault setup
    console.log('Step 1: Validating Supabase Vault setup...');
    const validation = await vaultMigrationService.validateVaultSetup();
    
    if (!validation.vaultAvailable) {
      console.error('❌ Supabase Vault is not available');
      console.error('Errors:', validation.errors);
      process.exit(1);
    }

    if (!validation.canCreate || !validation.canRead) {
      console.error('❌ Vault permissions are insufficient');
      console.error('Can create:', validation.canCreate);
      console.error('Can read:', validation.canRead);
      console.error('Errors:', validation.errors);
      process.exit(1);
    }

    console.log('✅ Vault setup is valid\n');

    // Step 2: Check current migration status
    console.log('Step 2: Checking current migration status...');
    const status = await vaultMigrationService.getMigrationStatus();
    
    console.log(`Total secrets defined: ${status.totalSecrets}`);
    console.log(`Secrets in vault: ${status.secretsInVault}`);
    console.log(`Missing secrets: ${status.missingSecrets.length}`);
    console.log(`Required missing: ${status.requiredMissing.length}`);

    if (status.missingSecrets.length > 0) {
      console.log('\nMissing secrets:', status.missingSecrets.join(', '));
    }

    if (status.requiredMissing.length > 0) {
      console.log('\n⚠️  Required secrets missing:', status.requiredMissing.join(', '));
    }

    console.log('');

    // Step 3: Perform migration
    console.log('Step 3: Migrating secrets to vault...');
    const results = await vaultMigrationService.migrateAllSecrets();

    console.log('\n📊 Migration Results:');
    console.log(`✅ Successfully migrated: ${results.success.length}`);
    console.log(`⚠️  Already existed: ${results.skipped.length}`);
    console.log(`❌ Failed: ${results.failed.length}`);

    if (results.success.length > 0) {
      console.log('\nSuccessfully migrated:');
      results.success.forEach(result => {
        console.log(`  ✅ ${result.secretName}`);
      });
    }

    if (results.skipped.length > 0) {
      console.log('\nAlready in vault:');
      results.skipped.forEach(result => {
        console.log(`  ⚠️  ${result.secretName}`);
      });
    }

    if (results.failed.length > 0) {
      console.log('\nFailed migrations:');
      results.failed.forEach(result => {
        console.log(`  ❌ ${result.secretName}: ${result.error}`);
      });
    }

    // Step 4: Test secret retrieval
    console.log('\nStep 4: Testing secret retrieval...');
    
    const testSecrets = [
      { name: 'OpenAI API Key', getter: () => vaultService.getOpenAIApiKey() },
      { name: 'Anthropic API Key', getter: () => vaultService.getAnthropicApiKey() },
      { name: 'Hugging Face API Key', getter: () => vaultService.getHuggingFaceApiKey() },
      { name: 'JWT Secret', getter: () => vaultService.getJwtSecret() }
    ];

    for (const test of testSecrets) {
      try {
        const secret = await test.getter();
        if (secret) {
          console.log(`  ✅ ${test.name}: Retrieved successfully`);
        } else {
          console.log(`  ⚠️  ${test.name}: Not found (may be optional)`);
        }
      } catch (error) {
        console.log(`  ❌ ${test.name}: Error - ${error}`);
      }
    }

    // Step 5: Final status
    console.log('\nStep 5: Final migration status...');
    const finalStatus = await vaultMigrationService.getMigrationStatus();
    
    console.log(`\n📈 Migration Summary:`);
    console.log(`Total secrets: ${finalStatus.totalSecrets}`);
    console.log(`In vault: ${finalStatus.secretsInVault}`);
    console.log(`Coverage: ${Math.round((finalStatus.secretsInVault / finalStatus.totalSecrets) * 100)}%`);

    if (finalStatus.requiredMissing.length === 0) {
      console.log('\n🎉 All required secrets are now in vault!');
      console.log('\n📝 Next steps:');
      console.log('1. Update your services to use vaultService instead of process.env');
      console.log('2. Remove API keys from environment variables');
      console.log('3. Test all services to ensure they work with vault');
      console.log('4. Deploy with vault-based configuration');
    } else {
      console.log(`\n⚠️  ${finalStatus.requiredMissing.length} required secrets still missing:`);
      console.log(finalStatus.requiredMissing.join(', '));
      console.log('\nPlease add these secrets and run the migration again.');
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Handle script execution
if (require.main === module) {
  main()
    .then(() => {
      console.log('\n✅ Vault migration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Migration failed:', error);
      process.exit(1);
    });
}

export { main as migrateToVault };