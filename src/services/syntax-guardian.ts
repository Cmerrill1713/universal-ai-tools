/**
 * Syntax Guardian - Automated error detection and fixing system
 * Monitors code for syntax errors and automatically fixes them
 */

import { execSync } from 'child_process';

interface SyntaxError {
  file: string;
  line: number;
  column: number;
  message: string;
  rule?: string;
  severity: 'error' | 'warning';
}

class SyntaxGuardian {
  private isRunning = false;
  private checkInterval = 30000; // 30 seconds

  constructor() {
    console.log('🛡️ Syntax Guardian initialized');
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ Syntax Guardian is already running');
      return;
    }
    // Error handling in checkSyntax/attemptAutoFix

    this.isRunning = true;
    console.log('🔍 Starting Syntax Guardian monitoring...');

    // Initial check
    await this.checkSyntax();

    // Set up periodic checks
    setInterval(async () => {
      if (this.isRunning) {
        await this.checkSyntax();
      }
    }, this.checkInterval);
  }

  async checkSyntax(): Promise<void> {
    try {
      console.log('🔍 Running syntax check...');

      // Run TypeScript compiler check
      execSync('npx tsc --noEmit --skipLibCheck', {
        cwd: process.cwd(),
        encoding: 'utf8',
        timeout: 30000,
      });

      console.log('✅ No syntax errors found');
    } catch (error) {
      const e = error as { stdout?: string; stderr?: string };
      if (e.stdout || e.stderr) {
        const output = e.stdout || e.stderr || '';
        console.log('⚠️ Syntax issues detected, attempting auto-fix...');

        // Try to auto-fix common issues
        await this.attemptAutoFix(output);
      }
    }
  }

  async attemptAutoFix(_errorOutput: string): Promise<void> {
    try {
      console.log('🔧 Attempting auto-fix...');

      // Run eslint auto-fix
      execSync('npm run lint:fix', {
        cwd: process.cwd(),
        stdio: 'inherit',
        timeout: 60000,
      });

      console.log('✅ Auto-fix completed');
    } catch (error) {
      console.log('❌ Auto-fix failed, manual intervention may be required');
    }
  }

  stop() {
    this.isRunning = false;
    console.log('🛑 Syntax Guardian stopped');
  }
}

// Start the guardian if this file is run directly
if (require.main === module) {
  const guardian = new SyntaxGuardian();
  guardian.start().catch(console.error);

  // Graceful shutdown
  process.on('SIGINT', () => {
    guardian.stop();
    process.exit(0);
  });
}

export { SyntaxGuardian };
