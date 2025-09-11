#!/usr/bin/env tsx

/**
 * Automated secret detection and fixing script
 * This script helps identify and automatically fix common secret leaks
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

interface Secret {
  file: string;
  line: number;
  match: string;
  rule: string;
}

class SecretAutoFixer {
  private envExamplePath = '.env.example';
  private envPath = '.env';
  
  async run() {
    console.log('🔍 Scanning for secrets...\n');
    
    try {
      // Run gitleaks and capture output
      const secrets = this.detectSecrets();
      
      if (secrets.length === 0) {
        console.log('✅ No secrets detected!');
        return;
      }
      
      console.log(`⚠️  Found ${secrets.length} potential secret(s)\n`);
      
      for (const secret of secrets) {
        await this.handleSecret(secret);
      }
      
      console.log('\n✅ Secret fixing complete!');
      console.log('💡 Remember to:');
      console.log('   1. Add real values to your .env file');
      console.log('   2. Update .env.example with placeholder values');
      console.log('   3. Never commit your .env file');
      
    } catch (error) {
      console.error('❌ Error during secret scanning:', error);
      process.exit(1);
    }
  }
  
  private detectSecrets(): Secret[] {
    try {
      execSync('gitleaks detect --config .gitleaks.toml --report-path gitleaks-temp.json --report-format json --exit-code 0', {
        stdio: 'pipe'
      });
      
      if (!fs.existsSync('gitleaks-temp.json')) {
        return [];
      }
      
      const report = JSON.parse(fs.readFileSync('gitleaks-temp.json', 'utf8'));
      fs.unlinkSync('gitleaks-temp.json');
      
      return report.map((finding: any) => ({
        file: finding.File,
        line: finding.StartLine,
        match: finding.Match,
        rule: finding.RuleID
      }));
    } catch (error) {
      return [];
    }
  }
  
  private async handleSecret(secret: Secret) {
    console.log(`\n📄 File: ${secret.file}`);
    console.log(`📍 Line: ${secret.line}`);
    console.log(`🔑 Match: ${this.maskSecret(secret.match)}`);
    console.log(`📏 Rule: ${secret.rule}`);
    
    const action = await this.promptAction();
    
    switch (action) {
      case '1':
        await this.moveToEnvVar(secret);
        break;
      case '2':
        await this.replaceWithPlaceholder(secret);
        break;
      case '3':
        await this.addToGitleaksIgnore(secret);
        break;
      case '4':
        console.log('⏭️  Skipping...');
        break;
    }
  }
  
  private maskSecret(secret: string): string {
    if (secret.length <= 8) return '*'.repeat(secret.length);
    return secret.substring(0, 4) + '*'.repeat(secret.length - 8) + secret.substring(secret.length - 4);
  }
  
  private async promptAction(): Promise<string> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    return new Promise((resolve) => {
      console.log('\nWhat would you like to do?');
      console.log('1. Move to environment variable');
      console.log('2. Replace with placeholder');
      console.log('3. Add to .gitleaks.toml ignore list');
      console.log('4. Skip');
      
      rl.question('Select action (1-4): ', (answer) => {
        rl.close();
        resolve(answer);
      });
    });
  }
  
  private async moveToEnvVar(secret: Secret) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const envVarName = await new Promise<string>((resolve) => {
      rl.question('Enter environment variable name (e.g., API_KEY): ', (answer) => {
        rl.close();
        resolve(answer.toUpperCase());
      });
    });
    
    // Read the file
    const content = fs.readFileSync(secret.file, 'utf8');
    const lines = content.split('\n');
    
    // Replace the secret with env var reference
    if (secret.file.endsWith('.ts') || secret.file.endsWith('.js')) {
      lines[secret.line - 1] = lines[secret.line - 1].replace(
        secret.match,
        `process.env.${envVarName}`
      );
    } else {
      lines[secret.line - 1] = lines[secret.line - 1].replace(
        secret.match,
        `\${${envVarName}}`
      );
    }
    
    // Write back to file
    fs.writeFileSync(secret.file, lines.join('\n'));
    
    // Add to .env.example
    this.addToEnvExample(envVarName, secret.match);
    
    console.log(`✅ Replaced with environment variable: ${envVarName}`);
  }
  
  private async replaceWithPlaceholder(secret: Secret) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const placeholder = await new Promise<string>((resolve) => {
      rl.question('Enter placeholder value (e.g., your-api-key-here): ', (answer) => {
        rl.close();
        resolve(answer);
      });
    });
    
    // Read the file
    const content = fs.readFileSync(secret.file, 'utf8');
    const lines = content.split('\n');
    
    // Replace the secret with placeholder
    lines[secret.line - 1] = lines[secret.line - 1].replace(secret.match, placeholder);
    
    // Write back to file
    fs.writeFileSync(secret.file, lines.join('\n'));
    
    console.log(`✅ Replaced with placeholder: ${placeholder}`);
  }
  
  private async addToGitleaksIgnore(secret: Secret) {
    // Read current .gitleaks.toml
    const configPath = '.gitleaks.toml';
    let config = fs.readFileSync(configPath, 'utf8');
    
    // Find the allowlist paths section
    const pathsMatch = config.match(/paths = \[([\s\S]*?)\]/);
    if (pathsMatch) {
      const currentPaths = pathsMatch[1];
      const newPath = `\n    '''${secret.file}''',`;
      
      // Add the new path if not already present
      if (!currentPaths.includes(secret.file)) {
        config = config.replace(
          pathsMatch[0],
          `paths = [${currentPaths}${newPath}\n]`
        );
        
        fs.writeFileSync(configPath, config);
        console.log(`✅ Added ${secret.file} to .gitleaks.toml ignore list`);
      } else {
        console.log(`ℹ️  ${secret.file} is already in ignore list`);
      }
    }
  }
  
  private addToEnvExample(varName: string, originalValue: string) {
    let envExample = '';
    
    if (fs.existsSync(this.envExamplePath)) {
      envExample = fs.readFileSync(this.envExamplePath, 'utf8');
    }
    
    // Check if variable already exists
    if (!envExample.includes(`${varName}=`)) {
      // Determine placeholder based on the secret type
      let placeholder = 'your-value-here';
      if (originalValue.startsWith('sk-')) {
        placeholder = 'sk-your-api-key-here';
      } else if (originalValue.startsWith('hf_')) {
        placeholder = 'hf_your-token-here';
      } else if (varName.includes('JWT')) {
        placeholder = 'your-jwt-secret-here';
      }
      
      envExample += `\n${varName}=${placeholder}`;
      fs.writeFileSync(this.envExamplePath, envExample.trim() + '\n');
      
      console.log(`📝 Added ${varName} to .env.example`);
    }
  }
}

// Run the auto-fixer
const fixer = new SecretAutoFixer();
fixer.run().catch(console.error);