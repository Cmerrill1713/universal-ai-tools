#!/usr/bin/env node

/**
 * Adaptive Auto-Fix Loop
 * Continuously monitors and fixes code issues
 */

import { execSync } from 'child_process';
import fs from 'fs';

class AdaptiveFixer {
  constructor() {
    this.isRunning = false;
    this.fixInterval = 60000; // 1 minute
    this.fixes = 0;
  }

  start() {
    if (this.isRunning) {
      console.log('⚠️ Adaptive fixer is already running');
      return;
    }

    this.isRunning = true;
    console.log('🔧 Starting Adaptive Auto-Fixer...');
    
    // Initial fix
    this.runFixCycle();
    
    // Set up periodic fixes
    setInterval(() => {
      if (this.isRunning) {
        this.runFixCycle();
      }
    }, this.fixInterval);
  }

  async runFixCycle() {
    try {
      console.log(`🔍 Running fix cycle #${this.fixes + 1}...`);
      
      // Check for issues and fix them
      await this.fixCommonIssues();
      
      this.fixes++;
      console.log(`✅ Fix cycle #${this.fixes} completed`);
    } catch (error) {
      console.error('❌ Fix cycle failed:', error.message);
    }
  }

  async fixCommonIssues() {
    const tasks = [
      { name: 'Lint Fix', command: 'npm run lint:fix' },
      { name: 'Format', command: 'npm run format' }
    ];

    for (const task of tasks) {
      try {
        console.log(`  🛠️  ${task.name}...`);
        execSync(task.command, { 
          cwd: process.cwd(),
          stdio: 'pipe',
          timeout: 30000
        });
        console.log(`  ✅ ${task.name} completed`);
      } catch (error) {
        console.log(`  ⚠️  ${task.name} had issues (continuing...)`);
      }
    }
  }

  stop() {
    this.isRunning = false;
    console.log('🛑 Adaptive Auto-Fixer stopped');
  }
}

// Start the fixer
const fixer = new AdaptiveFixer();
fixer.start();

// Graceful shutdown
process.on('SIGINT', () => {
  fixer.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  fixer.stop();
  process.exit(0);
});