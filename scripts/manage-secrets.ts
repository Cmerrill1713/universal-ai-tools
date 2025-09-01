#!/usr/bin/env tsx

/**
 * CLI utility for managing secrets in the system keyring
 * Usage: tsx scripts/manage-secrets.ts [command] [options]
 */

import { keyringSecretsManager } from '../src/services/keyring-secrets-manager';
import readline from 'readline';
import { promisify } from 'util';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = promisify(rl.question).bind(rl);

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function printHelp() {
  console.log(`
${colors.bright}Universal AI Tools - Secrets Manager${colors.reset}
${colors.cyan}Securely manage API keys and secrets in your system keyring${colors.reset}

${colors.bright}Usage:${colors.reset}
  tsx scripts/manage-secrets.ts [command] [options]

${colors.bright}Commands:${colors.reset}
  ${colors.green}list${colors.reset}              List all stored secrets (names only)
  ${colors.green}get <name>${colors.reset}        Retrieve a specific secret
  ${colors.green}set <name>${colors.reset}        Store a new secret
  ${colors.green}delete <name>${colors.reset}     Delete a secret
  ${colors.green}migrate${colors.reset}           Migrate secrets from .env to keyring
  ${colors.green}init${colors.reset}              Initialize default secrets
  ${colors.green}verify${colors.reset}            Verify all required secrets are present
  ${colors.green}export${colors.reset}            Export secret names for backup

${colors.bright}Examples:${colors.reset}
  tsx scripts/manage-secrets.ts list
  tsx scripts/manage-secrets.ts set openai_api_key
  tsx scripts/manage-secrets.ts get jwt_secret
  tsx scripts/manage-secrets.ts migrate

${colors.bright}Security Notes:${colors.reset}
  • Secrets are encrypted in your system keyring
  • Never share or commit secret values
  • Use different API keys for dev/prod environments
  `);
}

async function listSecrets() {
  console.log(`\n${colors.bright}Stored Secrets:${colors.reset}`);
  
  try {
    const secrets = await keyringSecretsManager.listSecrets();
    
    if (secrets.length === 0) {
      console.log(`${colors.yellow}No secrets found in keyring${colors.reset}`);
      return;
    }
    
    const maxNameLength = Math.max(...secrets.map(s => s.name.length));
    
    secrets.forEach(secret => {
      const name = secret.name.padEnd(maxNameLength + 2);
      const encrypted = secret.encrypted ? '🔒' : '⚠️ ';
      const desc = secret.description || 'No description';
      const updated = new Date(secret.updatedAt).toLocaleDateString();
      
      console.log(`  ${encrypted} ${colors.cyan}${name}${colors.reset} ${desc} ${colors.bright}(Updated: ${updated})${colors.reset}`);
    });
    
    console.log(`\n${colors.green}Total: ${secrets.length} secrets${colors.reset}`);
  } catch (error) {
    console.error(`${colors.red}Error listing secrets:${colors.reset}`, error);
  }
}

async function getSecret(name: string) {
  if (!name) {
    console.error(`${colors.red}Error: Secret name is required${colors.reset}`);
    return;
  }
  
  try {
    const value = await keyringSecretsManager.getSecret(name);
    
    if (value) {
      console.log(`\n${colors.green}Secret found:${colors.reset} ${name}`);
      console.log(`${colors.bright}Value:${colors.reset} ${value.substring(0, 10)}...${value.substring(value.length - 5)}`);
      console.log(`${colors.yellow}⚠️  Full value hidden for security${colors.reset}`);
    } else {
      console.log(`${colors.yellow}Secret not found:${colors.reset} ${name}`);
    }
  } catch (error) {
    console.error(`${colors.red}Error retrieving secret:${colors.reset}`, error);
  }
}

async function setSecret(name: string) {
  if (!name) {
    console.error(`${colors.red}Error: Secret name is required${colors.reset}`);
    return;
  }
  
  try {
    // Check if secret already exists
    const existing = await keyringSecretsManager.getSecret(name);
    if (existing) {
      const overwrite = await question(`${colors.yellow}Secret '${name}' already exists. Overwrite? (y/n): ${colors.reset}`);
      if (overwrite.toLowerCase() !== 'y') {
        console.log('Operation cancelled');
        return;
      }
    }
    
    const value = await question(`Enter value for '${name}': `) as string;
    const description = await question(`Enter description (optional): `) as string;
    
    await keyringSecretsManager.setSecret(name, value, {
      description: description || undefined,
      encrypt: true
    });
    
    console.log(`${colors.green}✅ Secret stored successfully:${colors.reset} ${name}`);
  } catch (error) {
    console.error(`${colors.red}Error storing secret:${colors.reset}`, error);
  }
}

async function deleteSecret(name: string) {
  if (!name) {
    console.error(`${colors.red}Error: Secret name is required${colors.reset}`);
    return;
  }
  
  try {
    const confirm = await question(`${colors.yellow}Are you sure you want to delete '${name}'? This cannot be undone. (y/n): ${colors.reset}`);
    
    if (confirm.toLowerCase() !== 'y') {
      console.log('Operation cancelled');
      return;
    }
    
    const success = await keyringSecretsManager.deleteSecret(name);
    
    if (success) {
      console.log(`${colors.green}✅ Secret deleted:${colors.reset} ${name}`);
    } else {
      console.log(`${colors.yellow}Secret not found or could not be deleted:${colors.reset} ${name}`);
    }
  } catch (error) {
    console.error(`${colors.red}Error deleting secret:${colors.reset}`, error);
  }
}

async function migrateSecrets() {
  console.log(`\n${colors.bright}Migrating secrets from environment variables...${colors.reset}`);
  
  try {
    await keyringSecretsManager.migrateFromEnvironment();
    console.log(`${colors.green}✅ Migration complete${colors.reset}`);
    
    // List the migrated secrets
    await listSecrets();
  } catch (error) {
    console.error(`${colors.red}Error during migration:${colors.reset}`, error);
  }
}

async function initDefaults() {
  console.log(`\n${colors.bright}Initializing default secrets...${colors.reset}`);
  
  try {
    await keyringSecretsManager.initializeDefaults();
    console.log(`${colors.green}✅ Default secrets initialized${colors.reset}`);
    
    // List all secrets
    await listSecrets();
  } catch (error) {
    console.error(`${colors.red}Error initializing defaults:${colors.reset}`, error);
  }
}

async function verifySecrets() {
  console.log(`\n${colors.bright}Verifying required secrets...${colors.reset}`);
  
  const requiredSecrets = [
    'jwt_secret',
    'encryption_key',
    'openai_api_key',
    'anthropic_api_key',
    'supabase_service_key'
  ];
  
  const optionalSecrets = [
    'google_ai_api_key',
    'huggingface_api_key',
    'serper_api_key',
    'elevenlabs_api_key',
    'replicate_api_key',
    'pinecone_api_key'
  ];
  
  let missingRequired = 0;
  let missingOptional = 0;
  
  console.log(`\n${colors.bright}Required Secrets:${colors.reset}`);
  for (const name of requiredSecrets) {
    const value = await keyringSecretsManager.getSecret(name);
    if (value) {
      console.log(`  ${colors.green}✅${colors.reset} ${name}`);
    } else {
      console.log(`  ${colors.red}❌${colors.reset} ${name} ${colors.red}(MISSING)${colors.reset}`);
      missingRequired++;
    }
  }
  
  console.log(`\n${colors.bright}Optional Secrets:${colors.reset}`);
  for (const name of optionalSecrets) {
    const value = await keyringSecretsManager.getSecret(name);
    if (value) {
      console.log(`  ${colors.green}✅${colors.reset} ${name}`);
    } else {
      console.log(`  ${colors.yellow}⚠️${colors.reset}  ${name} (not configured)`);
      missingOptional++;
    }
  }
  
  console.log('\n' + '='.repeat(50));
  
  if (missingRequired === 0) {
    console.log(`${colors.green}✅ All required secrets are configured${colors.reset}`);
  } else {
    console.log(`${colors.red}❌ Missing ${missingRequired} required secrets${colors.reset}`);
    console.log(`${colors.yellow}Run 'tsx scripts/manage-secrets.ts init' to initialize defaults${colors.reset}`);
  }
  
  if (missingOptional > 0) {
    console.log(`${colors.yellow}ℹ️  ${missingOptional} optional secrets not configured${colors.reset}`);
  }
}

async function exportSecrets() {
  console.log(`\n${colors.bright}Exporting secret names (for backup reference)...${colors.reset}`);
  
  try {
    const secrets = await keyringSecretsManager.listSecrets();
    
    const exportData = {
      timestamp: new Date().toISOString(),
      count: secrets.length,
      secrets: secrets.map(s => ({
        name: s.name,
        description: s.description,
        encrypted: s.encrypted,
        updatedAt: s.updatedAt
      }))
    };
    
    const filename = `secrets-backup-${new Date().toISOString().split('T')[0]}.json`;
    const fs = await import('fs');
    
    fs.writeFileSync(filename, JSON.stringify(exportData, null, 2));
    
    console.log(`${colors.green}✅ Exported to:${colors.reset} ${filename}`);
    console.log(`${colors.yellow}⚠️  This file contains secret names only, not values${colors.reset}`);
  } catch (error) {
    console.error(`${colors.red}Error exporting secrets:${colors.reset}`, error);
  }
}

// Main CLI handler
async function main() {
  const [,, command, ...args] = process.argv;
  
  try {
    switch (command) {
      case 'list':
        await listSecrets();
        break;
      
      case 'get':
        await getSecret(args[0]);
        break;
      
      case 'set':
        await setSecret(args[0]);
        break;
      
      case 'delete':
        await deleteSecret(args[0]);
        break;
      
      case 'migrate':
        await migrateSecrets();
        break;
      
      case 'init':
        await initDefaults();
        break;
      
      case 'verify':
        await verifySecrets();
        break;
      
      case 'export':
        await exportSecrets();
        break;
      
      case 'help':
      case '--help':
      case '-h':
        printHelp();
        break;
      
      default:
        if (command) {
          console.error(`${colors.red}Unknown command: ${command}${colors.reset}`);
        }
        printHelp();
        break;
    }
  } catch (error) {
    console.error(`${colors.red}Error:${colors.reset}`, error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Run the CLI
main().catch(console.error);