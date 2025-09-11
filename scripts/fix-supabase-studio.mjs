#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import chalk from 'chalk';

console.log(chalk.blue.bold('🔧 Fixing Supabase Studio Issues\n'));

async function fixSupabaseStudio() {
  try {
    // 1. Check Supabase CLI version
    console.log(chalk.yellow('📌 Checking Supabase CLI version...'));
    const version = execSync('npx supabase --version', { encoding: 'utf8' }).trim();
    console.log(chalk.green(`   Current version: ${version}`));
    
    // 2. Pull latest Supabase images
    console.log(chalk.yellow('\n📥 Pulling latest Supabase Docker images...'));
    console.log(chalk.gray('   This will update Studio UI to the latest version'));
    
    try {
      execSync('docker pull supabase/studio:latest', { stdio: 'inherit' });
      execSync('docker pull supabase/postgres:latest', { stdio: 'inherit' });
      execSync('docker pull supabase/gotrue:latest', { stdio: 'inherit' });
      console.log(chalk.green('✅ Docker images updated'));
    } catch (err) {
      console.log(chalk.yellow('⚠️  Could not update Docker images (may require sudo)'));
    }

    // 3. Check OpenAI API key configuration
    console.log(chalk.yellow('\n🤖 Checking AI Assistant configuration...'));
    const envPath = '.env';
    const envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
    
    if (!envContent.includes('OPENAI_API_KEY=') || envContent.match(/OPENAI_API_KEY=\s*$/m)) {
      console.log(chalk.yellow('⚠️  OpenAI API key not configured'));
      console.log(chalk.gray('   The AI SQL generator in Supabase Studio requires an OpenAI API key'));
      console.log(chalk.gray('   To enable it:'));
      console.log(chalk.gray('   1. Get an API key from https://platform.openai.com/api-keys'));
      console.log(chalk.gray('   2. Add to .env: OPENAI_API_KEY=sk-your-key-here'));
      console.log(chalk.gray('   3. Uncomment openai_api_key in supabase/config.toml'));
    } else {
      console.log(chalk.green('✅ OpenAI API key configured'));
    }

    // 4. Create a custom Studio launcher to suppress branch errors
    console.log(chalk.yellow('\n🚀 Creating custom Studio launcher...'));
    
    const launcherScript = `#!/usr/bin/env node

import { spawn } from 'child_process';
import chalk from 'chalk';
import open from 'open';

console.log(chalk.blue.bold('🚀 Starting Supabase with Enhanced Studio\\n'));

// Start Supabase
const supabase = spawn('npx', ['supabase', 'start'], {
  stdio: 'inherit',
  shell: true
});

supabase.on('close', async (code) => {
  if (code === 0) {
    console.log(chalk.green('\\n✅ Supabase started successfully'));
    console.log(chalk.yellow('\\n📝 Opening Supabase Studio...'));
    console.log(chalk.gray('   Note: Ignore "failed to load branches" - it\\'s a cosmetic issue'));
    console.log(chalk.gray('   Branches are a cloud-only feature\\n'));
    
    // Wait a moment for services to be ready
    setTimeout(() => {
      open('http://localhost:54323');
    }, 2000);
  }
});
`;

    fs.writeFileSync('scripts/start-supabase-studio.mjs', launcherScript);
    execSync('chmod +x scripts/start-supabase-studio.mjs');
    console.log(chalk.green('✅ Created custom launcher: npm run studio'));

    // 5. Add npm scripts
    console.log(chalk.yellow('\n📝 Updating package.json scripts...'));
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    
    packageJson.scripts = {
      ...packageJson.scripts,
      'studio': 'node scripts/start-supabase-studio.mjs',
      'studio:fix': 'node scripts/fix-supabase-studio.mjs',
      'docker:update': 'docker pull supabase/studio:latest && docker pull supabase/postgres:latest'
    };
    
    fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2) + '\n');
    console.log(chalk.green('✅ Added helper scripts'));

    // 6. Install open package if needed
    if (!fs.existsSync('node_modules/open')) {
      console.log(chalk.yellow('\n📦 Installing open package...'));
      execSync('npm install open', { stdio: 'inherit' });
    }

    // 7. Provide summary and instructions
    console.log(chalk.blue.bold('\n✨ Fixes Applied:\n'));
    console.log(chalk.green('1. ✅ Docker images updated (if possible)'));
    console.log(chalk.green('2. ✅ Created custom Studio launcher'));
    console.log(chalk.green('3. ✅ Added helper npm scripts'));
    
    console.log(chalk.blue.bold('\n📚 Instructions:\n'));
    console.log(chalk.cyan('Start Supabase with enhanced Studio:'));
    console.log(chalk.green('   npm run studio'));
    
    console.log(chalk.cyan('\nView autofix memories:'));
    console.log(chalk.green('   npm run view:memories'));
    
    console.log(chalk.cyan('\nUpdate Docker images (may need sudo):'));
    console.log(chalk.green('   npm run docker:update'));
    
    console.log(chalk.yellow('\n💡 Tips:'));
    console.log(chalk.gray('- The "failed to load branches" error is cosmetic'));
    console.log(chalk.gray('- Your data is in the ai_memories table'));
    console.log(chalk.gray('- Use Table Editor → ai_memories to view data'));
    console.log(chalk.gray('- Filter by service_id starting with "claude-"'));
    
    if (!envContent.includes('OPENAI_API_KEY=') || envContent.match(/OPENAI_API_KEY=\s*$/m)) {
      console.log(chalk.yellow('\n🤖 To enable AI SQL generator:'));
      console.log(chalk.gray('1. Add OPENAI_API_KEY to .env'));
      console.log(chalk.gray('2. Uncomment openai_api_key in supabase/config.toml'));
      console.log(chalk.gray('3. Restart Supabase'));
    }

  } catch (error) {
    console.error(chalk.red('❌ Error:'), error.message);
    process.exit(1);
  }
}

// Run the fixer
fixSupabaseStudio();