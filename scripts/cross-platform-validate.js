#!/usr/bin/env node

// Cross-platform validation helper
// This ensures Windows compatibility for validation scripts

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const command = process.argv[2];
const args = process.argv.slice(3);

const scripts = {
  validate: 'production-validation.js',
  'fix-guide': 'fix-guide.js',
  context: 'claude-context.js',
};

const scriptFile = scripts[command];
if (!scriptFile) {
  console.error(`Unknown command: ${command}`);
  console.error(`Available commands: ${Object.keys(scripts).join(', ')}`);
  process.exit(1);
}

const scriptPath = path.join(__dirname, scriptFile);
const nodeExecutable = process.execPath;

const child = spawn(nodeExecutable, [scriptPath, ...args], {
  stdio: 'inherit',
  shell: false,
});

child.on('exit', (code) => {
  process.exit(code || 0);
});
