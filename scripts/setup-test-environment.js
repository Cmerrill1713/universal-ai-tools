#!/usr/bin/env node

import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const execAsync = promisify(exec);

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
};

const log = {
  info: (msg) => process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.log(`${colors.blue}ℹ${colors.reset}  ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset}  ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset}  ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset}  ${msg}`),
};

async function checkCommand(command) {
  try {
    await execAsync(`which ${command}`);
    return true;
  } catch {
    return false;
  }
}

async function checkService(name, checkCommand, startCommand) {
  try {
    await execAsync(checkCommand);
    log.success(`${name} is running`);
    return true;
  } catch {
    log.warn(`${name} is not running`);
    if (startCommand) {
      log.info(`Starting ${name}...`);
      try {
        const child = spawn(startCommand.split(' ')[0], startCommand.split(' ').slice(1), {
          detached: true,
          stdio: 'ignore',
        });
        child.unref();
        await new Promise((resolve) => setTimeout(resolve, 3000));
        return true;
      } catch (err) {
        log.error(`Failed to start ${name}: ${err.message}`);
        return false;
      }
    }
    return false;
  }
}

async function loadEnvFile() {
  const envPath = path.join(__dirname, '..', '.env.test');
  if (!existsSync(envPath)) {
    log.error('.env.test file not found!');
    log.info('Please create .env.test based on .env.example');
    return false;
  }

  const envContent = readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach((line) => {
    if (line && !line.startsWith('#')) {
      const [key, value] = line.split('=');
      if (key && value) {
        process.env[key.trim()] = value.trim();
      }
    }
  });

  log.success('Loaded .env.test configuration');
  return true;
}

async function checkEnvironment() {
  log.info('Checking environment variables...');

  const required = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_KEY',
    'SUPABASE_ANON_KEY',
    'JWT_SECRET',
    'DEV_API_KEY',
  ];

  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    log.error(`Missing required environment variables: ${missing.join(', ')}`);
    return false;
  }

  log.success('All required environment variables are set');
  return true;
}

async function setupTestDatabase() {
  log.info('Setting up test database...');

  try {
    // Check if Supabase CLI is installed
    if (!(await checkCommand('supabase'))) {
      log.error('Supabase CLI is not installed');
      log.info('Install with: brew install supabase/tap/supabase');
      return false;
    }

    // Check Supabase status
    const { stdout } = await execAsync('supabase status');
    if (stdout.includes('stopped')) {
      log.info('Starting Supabase...');
      await execAsync('supabase start');
      await new Promise((resolve) => setTimeout(resolve, 10000)); // Wait for startup
    }

    log.success('Supabase is running');

    // Run migrations
    log.info('Running database migrations...');
    await execAsync('supabase db reset --linked');
    log.success('Database migrations completed');

    return true;
  } catch (err) {
    log.error(`Database setup failed: ${err.message}`);
    return false;
  }
}

async function checkDependencies() {
  log.info('Checking dependencies...');

  const checks = [
    { name: 'Node.js', command: 'node --version', minVersion: '18.0.0' },
    { name: 'npm', command: 'npm --version', minVersion: '8.0.0' },
    { name: 'Docker', command: 'docker --version', required: false },
    { name: 'Redis', command: 'redis-cli ping', required: false },
  ];

  for (const check of checks) {
    try {
      const { stdout } = await execAsync(check.command);
      log.success(`${check.name}: ${stdout.trim()}`);
    } catch {
      if (check.required !== false) {
        log.error(`${check.name} is not available`);
        return false;
      } else {
        log.warn(`${check.name} is not available (optional)`);
      }
    }
  }

  return true;
}

async function createTestData() {
  log.info('Creating test data...');

  try {
    // Import test data generator (to be created)
    const generateScript = path.join(__dirname, 'generate-phase1-test-data.js');
    if (existsSync(generateScript)) {
      const { stdout } = await execAsync(`node ${generateScript}`);
      log.success('Test data created successfully');
    } else {
      log.warn('Test data generator not found, skipping...');
    }

    return true;
  } catch (err) {
    log.error(`Failed to create test data: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log('🧪 Universal AI Tools - Test Environment Setup');
  console.log('===========================================\n');

  // Load environment variables
  if (!(await loadEnvFile())) {
    process.exit(1);
  }

  // Check environment
  if (!(await checkEnvironment())) {
    process.exit(1);
  }

  // Check dependencies
  if (!(await checkDependencies())) {
    process.exit(1);
  }

  // Setup database
  if (!(await setupTestDatabase())) {
    log.warn('Database setup failed, continuing anyway...');
  }

  // Check optional services
  await checkService('Redis', 'redis-cli ping', 'redis-server');
  await checkService('Ollama', 'curl -s http://localhost:11434/api/tags', null);

  // Create test data
  await createTestData();

  console.log('\n===========================================');
  log.success('Test environment setup complete!');
  console.log('\nNext steps:');
  console.log('1. Start the server: npm run dev');
  console.log('2. Run tests: npm test');
  console.log('3. Run Phase 1 tests: node tests/test-phase1-fixes.js');
}

main().catch((err) => {
  log.error(`Setup failed: ${err.message}`);
  process.exit(1);
});
