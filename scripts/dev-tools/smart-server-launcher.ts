import React from 'react';
#!/usr/bin/env tsx
/**
 * Smart Server Launcher
 * Intelligently starts the server with error recovery and diagnostics
 */

import { spawn, execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import readline from 'readline';

interface ServerConfig {
  port: number;
  env: 'development' | 'production' | 'test';
  watch: boolean;
  debug: boolean;
  skipTypeCheck: boolean;
  autoFix: boolean;
}

class SmartServerLauncher {
  private config: ServerConfig;
  private serverProcess: unknown = null;
  private errorCount = 0;
  private restartAttempts = 0;
  private maxRestartAttempts = 3;

  constructor(config: Partial<ServerConfig> = {}) {
    this.config = {
      port: parseInt(process.env.PORT || '8080'),
      env: (process.env.NODE_ENV as any) || 'development',
      watch: true,
      debug: false,
      skipTypeCheck: false,
      autoFix: true,
      ...config,
    };
  }

  async launch() {
    process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.log(chalk.blue('🚀 Smart Server Launcher\n'));

    // Pre-launch checks
    await this.runPreLaunchChecks();

    // Setup error handlers
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());

    // Launch server
    await this.startServer();
  }

  private async runPreLaunchChecks() {
    console.log(chalk.yellow('🔍 Running pre-launch checks...\n'));

    // Check Node version
    const nodeVersion = process.version;
    console.log(`✓ Node version: ${chalk.green(nodeVersion)}`);

    // Check dependencies
    try {
      execSync('npm ls --depth=0', { stdio: 'ignore' });
      console.log(`✓ Dependencies: ${chalk.green('OK')}`);
    } catch (error) {
      console.log(`⚠ Dependencies: ${chalk.yellow('Some issues detected')}`);
      if (this.config.autoFix) {
        console.log(chalk.cyan('  Installing missing dependencies...'));
        execSync('npm install', { stdio: 'inherit' });
      }
    }

    // Check environment variables
    const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'];
    const missingEnvVars = requiredEnvVars.filter((v) => !process.env[v]);

    if (missingEnvVars.length > 0) {
      console.log(`⚠ Missing environment variables: ${chalk.yellow(missingEnvVars.join(', '))}`);

      // Check for .env file
      if (!fs.existsSync('.env')) {
        console.log(chalk.cyan('  Creating .env from .env.example...'));
        if (fs.existsSync('.env.example')) {
          fs.copyFileSync('.env.example', '.env');
          console.log(chalk.green('  ✓ .env file created'));
        }
      }
    } else {
      console.log(`✓ Environment variables: ${chalk.green('OK')}`);
    }

    // Quick syntax check
    if (!this.config.skipTypeCheck) {
      console.log(chalk.cyan('\n🔍 Running quick syntax check...'));
      try {
        execSync('npx tsc --noEmit --skipLibCheck src/server.ts', {
          stdio: 'pipe',
          encoding: 'utf8',
        });
        console.log(`✓ TypeScript check: ${chalk.green('PASSED')}\n`);
      } catch (error: unknown) {
        console.log(`✗ TypeScript check: ${chalk.red('FAILED')}`);

        if (this.config.autoFix) {
          console.log(chalk.cyan('\n🔧 Attempting auto-fix...'));
          this.runAutoFix();
        } else {
          console.log(chalk.yellow('\nContinuing with errors present...'));
        }
      }
    }

    // Check port availability
    await this.checkPort();
  }

  private async checkPort() {
    const portInUse = await this.isPortInUse(this.config.port);

    if (portInUse) {
      console.log(`⚠ Port ${this.config.port}: ${chalk.yellow('IN USE')}`);

      // Find alternative port
      let alternativePort = this.config.port + 1;
      while ((await this.isPortInUse(alternativePort)) && alternativePort < this.config.port + 10) {
        alternativePort++;
      }

      console.log(chalk.cyan(`  Using alternative port: ${alternativePort}`));
      this.config.port = alternativePort;
      process.env.PORT = alternativePort.toString();
    } else {
      console.log(`✓ Port ${this.config.port}: ${chalk.green('AVAILABLE')}`);
    }
  }

  private isPortInUse(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      import('net').then((net) => {
        const tester = net
          .createServer()
          .once('error', () => resolve(true))
          .once('listening', () => {
            tester.once('close', () => resolve(false)).close();
          })
          .listen(port);
      });
    });
  }

  private runAutoFix() {
    try {
      // Run ESLint fix
      console.log('  Running ESLint auto-fix...');
      execSync('npx eslint src --fix', { stdio: 'ignore' });

      // Run Prettier
      console.log('  Running Prettier...');
      execSync('npx prettier --write "src/**/*.{ts,tsx}"', { stdio: 'ignore' });

      console.log(chalk.green('  ✓ Auto-fix complete'));
    } catch (error) {
      console.log(chalk.yellow('  ⚠ Some auto-fixes may have failed'));
    }
  }

  private async startServer() {
    console.log(chalk.blue('\n🚀 Starting server...\n'));

    const env = {
      ...process.env,
      NODE_ENV: this.config.env,
      PORT: this.config.port.toString(),
      NODE_OPTIONS: '--max-old-space-size=4096',
      FORCE_COLOR: '1',
    };

    if (this.config.debug) {
      env.DEBUG = '*';
      env.LOG_LEVEL = 'debug';
    }

    const command = this.config.watch ? 'tsx' : 'node';
    const args = this.config.watch
      ? ['watch', '--clear-screen=false', 'src/server.ts']
      : ['dist/server.js'];

    this.serverProcess = spawn(command, args, {
      env,
      stdio: 'pipe',
      shell: true,
    });

    // Handle stdout
    this.serverProcess.stdout.on('data', (data: Buffer) => {
      const output = data.toString();

      // Parse and colorize output
      const lines = output.split('\n');
      for (const line of lines) {
        if (line.includes('Server running')) {
          console.log(chalk.green('✅ ' + line));
        } else if (line.includes('error') || line.includes('Error')) {
          console.log(chalk.red(line));
          this.errorCount++;
        } else if (line.includes('warning') || line.includes('Warning')) {
          console.log(chalk.yellow(line));
        } else if (line.includes('info')) {
          console.log(chalk.blue(line));
        } else if (line.trim()) {
          console.log(line);
        }
      }
    });

    // Handle stderr
    this.serverProcess.stderr.on('data', (data: Buffer) => {
      const error = data.toString();
      process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.error(chalk.red(error));
      this.errorCount++;

      // Check for common errors
      if (error.includes('Transform failed')) {
        console.log(chalk.yellow('\n⚠ Transform error detected. Running diagnostics...'));
        this.runDiagnostics();
      }
    });

    // Handle exit
    this.serverProcess.on('exit', (code: number) => {
      if (code !== 0 && this.restartAttempts < this.maxRestartAttempts) {
        console.log(chalk.yellow(`\n⚠ Server exited with code ${code}. Attempting restart...`));
        this.restartAttempts++;
        setTimeout(() => this.startServer(), 2000);
      } else if (code !== 0) {
        console.log(
          chalk.red(`\n❌ Server failed to start after ${this.maxRestartAttempts} attempts.`)
        );
        this.runDiagnostics();
      }
    });

    // Setup interactive commands
    this.setupInteractiveCommands();
  }

  private setupInteractiveCommands() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log(chalk.cyan('\n📋 Interactive Commands:'));
    console.log('  r - Restart server');
    console.log('  d - Run diagnostics');
    console.log('  f - Run auto-fix');
    console.log('  c - Clear console');
    console.log('  q - Quit\n');

    rl.on('line', (input) => {
      switch (input.trim().toLowerCase()) {
        case 'r':
          console.log(chalk.yellow('Restarting server...'));
          this.restart();
          break;
        case 'd':
          this.runDiagnostics();
          break;
        case 'f':
          this.runAutoFix();
          break;
        case 'c':
          console.clear();
          break;
        case 'q':
          this.shutdown();
          break;
      }
    });
  }

  private runDiagnostics() {
    console.log(chalk.blue('\n🔍 Running diagnostics...\n'));

    try {
      // Check for syntax errors in server.ts
      const serverPath = path.join(process.cwd(), 'src/server.ts');
      const serverContent = fs.readFileSync(serverPath, 'utf8');

      // Quick syntax checks
      const lines = serverContent.split('\n');
      const issues: string[] = [];

      lines.forEach((line, index) => {
        // Check for unterminated strings
        if (line.match(/['"`][^'"`]*$/) && !line.includes('//')) {
          issues.push(`Line ${index + 1}: Possible unterminated string`);
        }

        // Check for missing parentheses
        if (line.includes('=>') && !line.includes('=>{') && !line.includes('=> {')) {
          const beforeArrow = line.substring(0, line.indexOf('=>'));
          if (!beforeArrow.includes(')')) {
            issues.push(`Line ${index + 1}: Missing closing parenthesis before arrow function`);
          }
        }
      });

      if (issues.length > 0) {
        console.log(chalk.yellow('Found potential issues:'));
        issues.forEach((issue) => console.log(`  - ${issue}`));
      } else {
        console.log(chalk.green('No obvious syntax issues found.'));
      }

      // Check running processes
      console.log(chalk.cyan('\n📊 System Status:'));
      console.log(`  Error count: ${this.errorCount}`);
      console.log(`  Restart attempts: ${this.restartAttempts}`);
      console.log(`  Memory usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
    } catch (error) {
      console.log(chalk.red('Diagnostics failed:'), error);
    }
  }

  private restart() {
    if (this.serverProcess) {
      this.serverProcess.kill();
      this.serverProcess = null;
    }

    this.errorCount = 0;
    this.restartAttempts = 0;

    setTimeout(() => this.startServer(), 1000);
  }

  private shutdown() {
    console.log(chalk.yellow('\n👋 Shutting down server...'));

    if (this.serverProcess) {
      this.serverProcess.kill();
    }

    process.exit(0);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const config: Partial<ServerConfig> = {};

if (args.includes('--production')) {
  config.env = 'production';
  config.watch = false;
}

if (args.includes('--debug')) {
  config.debug = true;
}

if (args.includes('--no-fix')) {
  config.autoFix = false;
}

if (args.includes('--skip-check')) {
  config.skipTypeCheck = true;
}

const portArg = args.find((arg) => arg.startsWith('--port='));
if (portArg) {
  config.port = parseInt(portArg.split('=')[1]);
}

// Launch server
const launcher = new SmartServerLauncher(config);
launcher.launch();
