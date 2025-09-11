#!/usr/bin/env node

import { execSync } from 'child_process';
import chalk from 'chalk';
import fs from 'fs';

console.log(chalk.blue.bold('🔧 Setting up Ollama with Nginx Proxy\n'));

async function setupOllamaNginx() {
  try {
    // 1. Check if Ollama is running
    console.log(chalk.yellow('🤖 Checking Ollama...'));
    try {
      execSync('curl -s http://localhost:11434/api/tags', { stdio: 'pipe' });
      console.log(chalk.green('✅ Ollama is running'));
    } catch (err) {
      console.error(chalk.red('❌ Ollama is not running!'));
      console.log(chalk.yellow('Please start Ollama: ollama serve'));
      process.exit(1);
    }

    // 2. Start nginx proxy
    console.log(chalk.yellow('\n🚀 Starting nginx proxy...'));
    try {
      execSync('docker-compose -f docker-compose.ollama.yml up -d', { stdio: 'inherit' });
      console.log(chalk.green('✅ Nginx proxy started'));
    } catch (err) {
      console.error(chalk.red('❌ Failed to start nginx proxy'));
      console.log(chalk.yellow('Make sure Docker is running'));
      process.exit(1);
    }

    // 3. Wait for nginx to be ready
    console.log(chalk.yellow('\n⏳ Waiting for nginx to be ready...'));
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 4. Test nginx proxy
    console.log(chalk.yellow('🧪 Testing nginx proxy...'));
    try {
      execSync('curl -s http://localhost:8080/api/tags', { stdio: 'pipe' });
      console.log(chalk.green('✅ Nginx proxy is working'));
    } catch (err) {
      console.error(chalk.red('❌ Nginx proxy test failed'));
      console.log(chalk.yellow('Check docker logs: docker-compose -f docker-compose.ollama.yml logs'));
    }

    // 5. Enable pg_net in Supabase
    console.log(chalk.yellow('\n📦 Checking pg_net extension...'));
    const enablePgNet = `
-- Enable pg_net extension
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Grant usage to roles
GRANT USAGE ON SCHEMA net TO postgres, anon, authenticated, service_role;

-- Test pg_net
SELECT net.http_get('http://ollama-proxy:8080/api/version');
`;

    fs.writeFileSync('supabase/migrations/20250119_enable_pg_net.sql', enablePgNet);
    console.log(chalk.green('✅ Created pg_net migration'));

    // 6. Instructions
    console.log(chalk.blue.bold('\n✨ Setup Complete!\n'));
    
    console.log(chalk.cyan('Next steps:'));
    console.log(chalk.green('1. Apply migrations:'));
    console.log(chalk.gray('   npx supabase db reset'));
    
    console.log(chalk.green('\n2. Test the connection:'));
    console.log(chalk.gray('   psql $DATABASE_URL -c "SELECT test_ollama_connection();"'));
    
    console.log(chalk.green('\n3. Use AI functions:'));
    console.log(chalk.gray('   SELECT ai_generate_sql(\'find all active users\');'));
    console.log(chalk.gray('   SELECT ai_explain_sql(\'SELECT * FROM users WHERE active = true\');'));
    
    console.log(chalk.yellow('\n⚠️  Important:'));
    console.log(chalk.gray('- Nginx runs on port 8080'));
    console.log(chalk.gray('- Ollama must be running (ollama serve)'));
    console.log(chalk.gray('- Functions use nginx proxy at http://ollama-proxy:8080'));
    
    console.log(chalk.blue.bold('\n🎉 Your Supabase can now use Ollama AI!'));

    // 7. Add npm scripts
    console.log(chalk.yellow('\n📝 Updating package.json...'));
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    
    packageJson.scripts = {
      ...packageJson.scripts,
      'ollama:nginx:start': 'docker-compose -f docker-compose.ollama.yml up -d',
      'ollama:nginx:stop': 'docker-compose -f docker-compose.ollama.yml down',
      'ollama:nginx:logs': 'docker-compose -f docker-compose.ollama.yml logs -f',
      'ollama:nginx:test': 'curl http://localhost:8080/api/tags'
    };
    
    fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2) + '\n');
    console.log(chalk.green('✅ Added helper scripts'));

  } catch (error) {
    console.error(chalk.red('\n❌ Setup failed:'), error.message);
    process.exit(1);
  }
}

// Run setup
setupOllamaNginx();