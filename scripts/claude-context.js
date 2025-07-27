#!/usr/bin/env node

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

class ClaudeContextGenerator {
  async generateContext() {
    console.log(chalk.blue('Generating Claude context...\n'));

    const context = {
      projectStructure: await this.getProjectStructure(),
      environmentVariables: await this.getEnvironmentVariables(),
      dependencies: await this.getDependencies(),
      recentChanges: await this.getRecentChanges(),
      currentIssues: await this.getCurrentIssues(),
      quickStart: await this.getQuickStart(),
    };

    return this.formatContext(context);
  }

  async getProjectStructure() {
    const structure = [];
    const importantDirs = ['src', 'ui/src', 'supabase', 'scripts', 'tests'];

    for (const dir of importantDirs) {
      try {
        const files = await this.listDirectory(path.join(rootDir, dir), 2);
        structure.push({ dir, files });
      } catch (error) {
        // Directory might not exist
      }
    }

    return structure;
  }

  async listDirectory(dirPath, maxDepth = 1, currentDepth = 0) {
    if (currentDepth >= maxDepth) return [];

    const items = [];
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

      if (entry.isDirectory() && currentDepth < maxDepth - 1) {
        const subItems = await this.listDirectory(
          path.join(dirPath, entry.name),
          maxDepth,
          currentDepth + 1
        );
        items.push({
          name: entry.name + '/',
          type: 'directory',
          children: subItems,
        });
      } else {
        items.push({
          name: entry.name,
          type: entry.isDirectory() ? 'directory' : 'file',
        });
      }
    }

    return items;
  }

  async getEnvironmentVariables() {
    const envExample = path.join(rootDir, '.env.example');
    try {
      const content = await fs.readFile(envExample, 'utf-8');
      const vars = content
        .split('\n')
        .filter((line) => line.includes('='))
        .map((line) => line.split('=')[0]);
      return vars;
    } catch {
      return ['Check .env.example for required variables'];
    }
  }

  async getDependencies() {
    const packageJson = JSON.parse(await fs.readFile(path.join(rootDir, 'package.json'), 'utf-8'));

    return {
      main: Object.keys(packageJson.dependencies || {}).slice(0, 10),
      dev: Object.keys(packageJson.devDependencies || {}).slice(0, 10),
    };
  }

  async getRecentChanges() {
    try {
      const { execSync } = await import('child_process');
      const commits = execSync('git log --oneline -10', { cwd: rootDir })
        .toString()
        .trim()
        .split('\n');
      return commits;
    } catch {
      return ['Unable to get git history'];
    }
  }

  async getCurrentIssues() {
    const issues = [];

    // Check if server is running
    try {
      await fetch('http://localhost:8080/health');
    } catch {
      issues.push('Backend server not running (port 8080)');
    }

    // Check Supabase
    try {
      const { execSync } = await import('child_process');
      execSync('npx supabase status', { cwd: rootDir, stdio: 'pipe' });
    } catch {
      issues.push('Supabase not running');
    }

    return issues;
  }

  async getQuickStart() {
    return [
      '1. Install dependencies: npm install',
      '2. Copy .env.example to .env and configure',
      '3. Start Supabase: npm run supabase:start',
      '4. Run migrations: npm run migrate:up',
      '5. Start backend: npm run dev',
      '6. Start frontend: cd ui && npm run dev',
    ];
  }

  formatContext(context) {
    let output = chalk.bold('=== Universal AI Tools - Claude Context ===\n\n');

    output += chalk.blue('## Project Structure\n');
    context.projectStructure.forEach(({ dir, files }) => {
      output += `${dir}/\n`;
      this.printFileTree(files, output, '  ');
    });

    output += chalk.blue('\n## Environment Variables\n');
    output += context.environmentVariables.join('\n') + '\n';

    output += chalk.blue('\n## Key Dependencies\n');
    output += 'Main: ' + context.dependencies.main.join(', ') + '\n';
    output += 'Dev: ' + context.dependencies.dev.join(', ') + '\n';

    output += chalk.blue('\n## Recent Changes\n');
    output += context.recentChanges.join('\n') + '\n';

    if (context.currentIssues.length > 0) {
      output += chalk.red('\n## Current Issues\n');
      output += context.currentIssues.join('\n') + '\n';
    }

    output += chalk.blue('\n## Quick Start\n');
    output += context.quickStart.join('\n') + '\n';

    return output;
  }

  printFileTree(items, output, indent = '') {
    items.forEach((item) => {
      output += indent + item.name + '\n';
      if (item.children) {
        this.printFileTree(item.children, output, indent + '  ');
      }
    });
    return output;
  }

  async generateSummary() {
    console.log(chalk.blue('Generating quick summary...\n'));

    const summary = {
      status: await this.getSystemStatus(),
      todos: await this.countTodos(),
      tests: await this.getTestStatus(),
    };

    console.log(chalk.bold('=== System Summary ===\n'));

    console.log(chalk.blue('System Status:'));
    Object.entries(summary.status).forEach(([key, value]) => {
      const icon = value ? '✅' : '❌';
      console.log(`  ${icon} ${key}: ${value ? 'Running' : 'Not running'}`);
    });

    console.log(chalk.blue('\nCode Quality:'));
    console.log(`  📝 TODOs found: ${summary.todos}`);
    console.log(`  🧪 Test files: ${summary.tests.total}`);

    return summary;
  }

  async getSystemStatus() {
    const status = {
      backend: false,
      frontend: false,
      supabase: false,
    };

    try {
      await fetch('http://localhost:8080/health');
      status.backend = true;
    } catch {}

    try {
      await fetch('http://localhost:3000');
      status.frontend = true;
    } catch {}

    try {
      const { execSync } = await import('child_process');
      execSync('npx supabase status', { cwd: rootDir, stdio: 'pipe' });
      status.supabase = true;
    } catch {}

    return status;
  }

  async countTodos() {
    try {
      const { execSync } = await import('child_process');
      const result = execSync(
        'grep -r "TODO\\|FIXME" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" . | wc -l',
        { cwd: rootDir, stdio: 'pipe' }
      );
      return parseInt(result.toString().trim()) || 0;
    } catch {
      return 0;
    }
  }

  async getTestStatus() {
    const { glob } = await import('glob');
    const testFiles = await glob('**/*.test.{ts,tsx,js,jsx}', {
      cwd: rootDir,
      ignore: ['node_modules/**'],
    });

    return {
      total: testFiles.length,
    };
  }
}

// CLI handling
const generator = new ClaudeContextGenerator();
const command = process.argv[2] || 'context';

if (command === 'context') {
  generator.generateContext().then(console.log);
} else if (command === 'summary') {
  generator.generateSummary();
} else {
  console.error(chalk.red(`Unknown command: ${command}`));
  console.log(chalk.gray('\nAvailable commands: context, summary'));
  process.exit(1);
}
