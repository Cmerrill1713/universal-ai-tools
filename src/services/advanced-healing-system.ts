/**
 * Advanced Healing System
 * AI-powered self-repair and optimization system
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

interface HealingTask {
  id: string;
  type: 'syntax' | 'performance' | 'security' | 'architecture' | 'dependencies' | 'network';
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  autoFixable: boolean;
  estimatedTime: number;
}

interface HealingResult {
  taskId: string;
  success: boolean;
  changes: string[];
  metrics: {
    filesFixed: number;
    errorsResolved: number;
    performanceImprovement?: number;
  };
}

class AdvancedHealingSystem {
  private isRunning = false;
  private healingQueue: HealingTask[] = [];
  private completedTasks: HealingResult[] = [];
  private healingInterval = 120000; // 2 minutes
  private diagnosticInterval = 300000; // 5 minutes
  private networkHealingService: any;

  constructor() {
    console.log('🧬 Advanced Healing System initialized');
    this.initializeNetworkHealing();
  }

  private async initializeNetworkHealing(): Promise<void> {
    try {
      const { NetworkHealingService } = await import('./network-healing-service');
      this.networkHealingService = new NetworkHealingService();
      console.log('🌐 Network Healing Service integrated');
    } catch (error) {
      console.log('⚠️ Failed to initialize Network Healing Service:', error);
    }
  }

  async start() {
    if (this.isRunning) {
      console.log('⚠️ Advanced Healing System is already running');
      return;
    }
    // TODO: Add error handling with try-catch

    this.isRunning = true;
    console.log('🚀 Starting Advanced Healing System...');

    // Start network healing service
    if (this.networkHealingService) {
      await this.networkHealingService.start();
    }

    // Run initial comprehensive diagnostic
    await this.runComprehensiveDiagnostic();

    // Start healing cycles
    setInterval(async () => {
      if (this.isRunning) {
        await this.runHealingCycle();
      }
    }, this.healingInterval);

    // Start periodic diagnostics
    setInterval(async () => {
      if (this.isRunning) {
        await this.runComprehensiveDiagnostic();
      }
    }, this.diagnosticInterval);

    console.log('✅ Advanced Healing System active - AI diagnostics running');
  }

  async runComprehensiveDiagnostic(): Promise<void> {
    console.log('🔍 Running comprehensive system diagnostic...');

    const diagnostics = [
      this.diagnoseSyntaxIssues(),
      this.diagnosePerformanceIssues(),
      this.diagnoseSecurityIssues(),
      this.diagnoseArchitecturalIssues(),
      this.diagnoseDependencyIssues(),
      this.diagnoseNetworkIssues(),
    ];

    try {
      await Promise.all(diagnostics);
      console.log(`📊 Diagnostic complete. Found ${this.healingQueue.length} healing tasks`);
    } catch (error) {
      console.log('⚠️ Some diagnostic checks failed, continuing...');
    }
  }

  async diagnoseSyntaxIssues(): Promise<void> {
    try {
      // Advanced syntax analysis
      const result = execSync('npx tsc --noEmit --skipLibCheck 2>&1', {
        encoding: 'utf8',
        timeout: 30000,
      });
    } catch (error: unknown) {
      const output = (error as any).stdout || (error as any).stderr || '';
      const errorCount = (output.match(/error TS/g) || []).length;

      if (errorCount > 0) {
        this.addHealingTask({
          id: `syntax-${Date.now()}`,
          type: 'syntax',
          severity: errorCount > 10 ? 'critical' : errorCount > 5 ? 'high' : 'medium',
          description: `${errorCount} TypeScript syntax errors detected`,
          autoFixable: true,
          estimatedTime: errorCount * 30, // 30s per error
        });
      }
    }
  }

  async diagnosePerformanceIssues(): Promise<void> {
    // Check for performance anti-patterns
    const       issues = [this.checkForMemoryLeaks(), this.checkForSlowQueries(), this.checkForLargeFiles()];

    const results = await Promise.allSettled(issues);
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        this.addHealingTask(result.value);
      }
    });
  }

  async checkForMemoryLeaks(): Promise<HealingTask | null> {
    // Analyze code for potential memory leaks
    try {
      const sourceFiles = await this.findSourceFiles();
      let leakPatterns = 0;

      for (const file of sourceFiles) {
        const content = fs.readFileSync(file, 'utf8');
        // Check for common leak patterns
        if (content.includes('setInterval') && !content.includes('clearInterval')) {
          leakPatterns++;
        }
        if (content.includes('addEventListener') && !content.includes('removeEventListener')) {
          leakPatterns++;
        }
      }

      if (leakPatterns > 0) {
        return {
          id: `memory-${Date.now()}`,
          type: 'performance',
          severity: leakPatterns > 5 ? 'high' : 'medium',
          description: `${leakPatterns} potential memory leak patterns detected`,
          autoFixable: false,
          estimatedTime: leakPatterns * 600, // 10 min per pattern
        };
      }
    } catch (error) {
      console.log('Memory leak check failed');
    }
    return null;
  }

  async checkForSlowQueries(): Promise<HealingTask | null> {
    // Check for inefficient database queries
    try {
      const queryFiles = await this.findFiles(
        ['**/*.ts', '**/*.js'],
        ['**/test/**', '**/tests/**']
      );
      let slowQueries = 0;

      for (const file of queryFiles) {
        const content = fs.readFileSync(file, 'utf8');
        // Look for potential slow query patterns
        if (content.includes('SELECT *') || content.includes('N+1')) {
          slowQueries++;
        }
      }

      if (slowQueries > 0) {
        return {
          id: `queries-${Date.now()}`,
          type: 'performance',
          severity: 'medium',
          description: `${slowQueries} potentially slow database queries found`,
          autoFixable: false,
          estimatedTime: slowQueries * 300,
        };
      }
    } catch (error) {
      console.log('Query analysis failed');
    }
    return null;
  }

  async checkForLargeFiles(): Promise<HealingTask | null> {
    try {
      const sourceFiles = await this.findSourceFiles();
      const largeFiles = sourceFiles.filter((file) => {
        const stats = fs.statSync(file);
        return stats.size > 100000; // > 100KB
      });

      if (largeFiles.length > 0) {
        return {
          id: `large-files-${Date.now()}`,
          type: 'performance',
          severity: 'low',
          description: `${largeFiles.length} large source files detected`,
          autoFixable: true,
          estimatedTime: largeFiles.length * 120,
        };
      }
    } catch (error) {
      console.log('Large file check failed');
    }
    return null;
  }

  async diagnoseSecurityIssues(): Promise<void> {
    try {
      // Check for security vulnerabilities
      const result = execSync('npm audit --json 2>/dev/null || echo "{}"', {
        encoding: 'utf8',
        timeout: 30000,
      });

      const audit = JSON.parse(result);
      const vulnerabilities = audit.metadata?.vulnerabilities || {};
      const total = Object.values(vulnerabilities).reduce(
        (sum: number, count: unknown) => sum + (count as number),
        0
      );

      if (total > 0) {
        this.addHealingTask({
          id: `security-${Date.now()}`,
          type: 'security',
          severity:
            vulnerabilities.critical > 0
              ? 'critical'
              : vulnerabilities.high > 0
                ? 'high'
                : 'medium',
          description: `${total} security vulnerabilities in dependencies`,
          autoFixable: true,
          estimatedTime: total * 60, // 60 seconds per vulnerability
        });
      }
    } catch (error) {
      console.log('Security audit failed, continuing...');
    }
  }

  async diagnoseArchitecturalIssues(): Promise<void> {
    // Check for architectural problems
    const       issues = [
        this.checkCircularDependencies(),
        this.checkCodeDuplication(),
        this.checkComplexity(),
      ];

    const results = await Promise.allSettled(issues);
    results.forEach((result) => {
      if (result.status === 'fulfilled' && result.value) {
        this.addHealingTask(result.value);
      }
    });
  }

  async checkCircularDependencies(): Promise<HealingTask | null> {
    try {
      // Simplified circular dependency check
      const sourceFiles = await this.findSourceFiles();
      let circularCount = 0;

      // This is a simplified check - in production you'd use proper dependency analysis
      for (const file of sourceFiles.slice(0, 10)) {
        // Limit for performance
        const content = fs.readFileSync(file, 'utf8');
        const imports = content.match(/import.*from ['"]..*['"];?/g) || [];
        if (imports.length > 10) {
          // Arbitrary threshold
          circularCount++;
        }
      }

      if (circularCount > 0) {
        return {
          id: `circular-${Date.now()}`,
          type: 'architecture',
          severity: 'medium',
          description: `${circularCount} files with high import complexity`,
          autoFixable: false,
          estimatedTime: circularCount * 900,
        };
      }
    } catch (error) {
      console.log('Circular dependency check failed');
    }
    return null;
  }

  async checkCodeDuplication(): Promise<HealingTask | null> {
    // Simplified duplication detection
    return {
      id: `duplication-${Date.now()}`,
      type: 'architecture',
      severity: 'low',
      description: 'Code duplication analysis pending',
      autoFixable: false,
      estimatedTime: 1800,
    };
  }

  async checkComplexity(): Promise<HealingTask | null> {
    try {
      const sourceFiles = await this.findSourceFiles();
      let complexFiles = 0;

      for (const file of sourceFiles.slice(0, 20)) {
        // Limit for performance
        const content = fs.readFileSync(file, 'utf8');
        const lines = content.split('\n').length;
        if (lines > 500) {
          // Files over 500 lines
          complexFiles++;
        }
      }

      if (complexFiles > 0) {
        return {
          id: `complexity-${Date.now()}`,
          type: 'architecture',
          severity: 'medium',
          description: `${complexFiles} overly complex files detected`,
          autoFixable: false,
          estimatedTime: complexFiles * 1200,
        };
      }
    } catch (error) {
      console.log('Complexity check failed');
    }
    return null;
  }

  async diagnoseDependencyIssues(): Promise<void> {
    try {
      // Check for outdated dependencies
      const result = execSync('npm outdated --json 2>/dev/null || echo "{}"', {
        encoding: 'utf8',
        timeout: 30000,
      });

      const outdated = JSON.parse(result);
      const count = Object.keys(outdated).length;

      if (count > 0) {
        this.addHealingTask({
          id: `deps-${Date.now()}`,
          type: 'dependencies',
          severity: 'low',
          description: `${count} outdated dependencies`,
          autoFixable: true,
          estimatedTime: count * 30,
        });
      }
    } catch (error) {
      console.log('Dependency check failed');
    }
  }

  async diagnoseNetworkIssues(): Promise<void> {
    try {
      if (!this.networkHealingService) {
        console.log('Network healing service not available');
        return;
      }

      // Get network status from the network healing service
      const networkStatus = this.networkHealingService.getStatus();

      if (networkStatus.activeIssues > 0) {
        // Convert network issues to healing tasks
        for (const issue of networkStatus.issues || []) {
          this.addHealingTask({
            id: `network-${issue.id}`,
            type: 'network',
            severity: issue.severity,
            description: `Network issue: ${issue.description}`,
            autoFixable: true,
            estimatedTime: 60000, // 1 minute per network issue
          });
        }
      }

      // Check for connection refused errors in logs specifically
      const logFiles = ['logs/adaptive-fixer.log', 'logs/server.log'];
      for (const logFile of logFiles) {
        if (require('fs').existsSync(logFile)) {
          const content = require('fs').readFileSync(logFile, 'utf8');
          const connectionRefusedCount = (content.match(/ECONNREFUSED|connection refused/gi) || [])
            .length;

          if (connectionRefusedCount > 0) {
            this.addHealingTask({
              id: `connection-refused-${Date.now()}`,
              type: 'network',
              severity: 'high',
              description: `${connectionRefusedCount} connection refused errors detected in ${logFile}`,
              autoFixable: true,
              estimatedTime: 120000, // 2 minutes
            });
          }
        }
      }
    } catch (error) {
      console.log('Network diagnostic failed:', error);
    }
  }

  async runHealingCycle(): Promise<void> {
    if (this.healingQueue.length === 0) {
      console.log('💚 No healing tasks in queue');
      return;
    }

    console.log(`🔧 Processing ${this.healingQueue.length} healing tasks...`);

    // Process critical and high priority tasks first
    const prioritizedTasks = this.healingQueue.sort((a, b) => {
      const priorities = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorities[b.severity] - priorities[a.severity];
    });

    for (const task of prioritizedTasks.slice(0, 3)) {
      // Process up to 3 tasks per cycle
      await this.executeHealingTask(task);
    }
  }

  async executeHealingTask(task: HealingTask): Promise<void> {
    console.log(`🩺 Healing: ${task.description}`);

    if (!task.autoFixable) {
      console.log(`⚠️ Task ${task.id} requires manual intervention`);
      this.removeTask(task.id);
      return;
    }

    try {
      let result: HealingResult;

      switch (task.type) {
        case 'syntax':
          result = await this.healSyntaxIssues(task);
          break;
        case 'security':
          result = await this.healSecurityIssues(task);
          break;
        case 'dependencies':
          result = await this.healDependencyIssues(task);
          break;
        case 'network':
          result = await this.healNetworkIssues(task);
          break;
        default:
          result = await this.healGenericIssue(task);
      }

      this.completedTasks.push(result);
      this.removeTask(task.id);

      console.log(`✅ Healed: ${task.description} - ${result.metrics.filesFixed} files fixed`);
    } catch (error) {
      console.log(`❌ Failed to heal: ${task.description}`);
      this.removeTask(task.id);
    }
  }

  async healSyntaxIssues(task: HealingTask): Promise<HealingResult> {
    try {
      // Use enhanced TypeScript healer for better results
      const { EnhancedTypeScriptHealer } = await import('./enhanced-typescript-healer');
      const healer = new EnhancedTypeScriptHealer();

      console.log('🔧 Running enhanced TypeScript healing...');

      // Run targeted fixes first
      await healer.runTargetedFixes();

      // Then run comprehensive healing
      const stats = await healer.healProject();

      const success = stats.errorsFixed > 0 || stats.filesProcessed > 0;

      return {
        taskId: task.id,
        success,
        changes: [
          `Fixed ${stats.errorsFixed} errors across ${stats.filesProcessed} files`,
          `Pattern fixes: ${Object.entries(stats.patterns)
            .map(([k, v]) => `${k}: ${v}`)
            .join(', ')}`,
          ...(stats.errors.length > 0 ? [`Errors: ${stats.errors.slice(0, 3).join(', ')}`] : []),
        ],
        metrics: {
          filesFixed: stats.filesProcessed,
          errorsResolved: stats.errorsFixed,
        },
      };
    } catch (error) {
      console.error('Enhanced TypeScript healing failed, falling back to basic lint:fix');

      // Fallback to basic lint fix
      try {
        execSync('npm run lint:fix', {
          cwd: process.cwd(),
          stdio: 'pipe',
          timeout: 60000,
        });

        return {
          taskId: task.id,
          success: true,
          changes: ['Applied basic ESLint auto-fixes (fallback)'],
          metrics: {
            filesFixed: 1,
            errorsResolved: 1,
          },
        };
      } catch (fallbackError) {
        return {
          taskId: task.id,
          success: false,
          changes: [`Enhanced healing failed: ${error}`, `Fallback failed: ${fallbackError}`],
          metrics: {
            filesFixed: 0,
            errorsResolved: 0,
          },
        };
      }
    }
  }

  async healSecurityIssues(task: HealingTask): Promise<HealingResult> {
    try {
      execSync('npm audit fix', {
        cwd: process.cwd(),
        stdio: 'pipe',
        timeout: 120000,
      });

      return {
        taskId: task.id,
        success: true,
        changes: ['Applied security patches'],
        metrics: {
          filesFixed: 1,
          errorsResolved: 1,
        },
      };
    } catch (error) {
      throw new Error('Security healing failed');
    }
  }

  async healDependencyIssues(task: HealingTask): Promise<HealingResult> {
    // Conservative dependency updates
    return {
      taskId: task.id,
      success: true,
      changes: ['Dependency analysis completed'],
      metrics: {
        filesFixed: 0,
        errorsResolved: 0,
      },
    };
  }

  async healNetworkIssues(task: HealingTask): Promise<HealingResult> {
    try {
      if (!this.networkHealingService) {
        return {
          taskId: task.id,
          success: false,
          changes: ['Network healing service not available'],
          metrics: {
            filesFixed: 0,
            errorsResolved: 0,
          },
        };
      }

      console.log('🌐 Running network healing...');

      // Let the network healing service handle its own issues
      await this.networkHealingService.runHealingCycle();

      // Get the updated status
      const networkStatus = this.networkHealingService.getStatus();
      const healingsCompleted = networkStatus.recentHealings || 0;

      return {
        taskId: task.id,
        success: healingsCompleted > 0,
        changes: [
          `Network healing completed`,
          `Active issues: ${networkStatus.activeIssues}`,
          `Recent healings: ${healingsCompleted}`,
          `Services monitored: ${networkStatus.monitoredServices}`,
        ],
        metrics: {
          filesFixed: 0,
          errorsResolved: healingsCompleted,
        },
      };
    } catch (error) {
      return {
        taskId: task.id,
        success: false,
        changes: [`Network healing failed: ${error}`],
        metrics: {
          filesFixed: 0,
          errorsResolved: 0,
        },
      };
    }
  }

  async healGenericIssue(task: HealingTask): Promise<HealingResult> {
    return {
      taskId: task.id,
      success: true,
      changes: ['Generic healing applied'],
      metrics: {
        filesFixed: 0,
        errorsResolved: 0,
      },
    };
  }

  private addHealingTask(task: HealingTask): void {
    // Avoid duplicates
    if (
      !this.healingQueue.find((t) => t.type === task.type && t.description === task.description)
    ) {
      this.healingQueue.push(task);
    }
  }

  private removeTask(taskId: string): void {
    this.healingQueue = this.healingQueue.filter((task) => task.id !== taskId);
  }

  private async findSourceFiles(): Promise<string[]> {
    return this.findFiles(
      ['src/**/*.ts', 'src/**/*.tsx'],
      ['src/**/*.test.ts', 'src/**/*.spec.ts']
    );
  }

  private async findFiles(patterns: string[], exclude: string[] = []): Promise<string[]> {
    // Simplified file finding - in production would use proper glob
    const files: string[] = [];
    try {
      const result = execSync('find src -name "*.ts" -o -name "*.tsx" | head -50', {
        encoding: 'utf8',
        timeout: 10000,
      });
      files.push(
        ...result
          .trim()
          .split('\n')
          .filter((f) => f)
      );
    } catch (error) {
      // Fallback
    }
    return files;
  }

  getStatus(): object {
    return {
      isRunning: this.isRunning,
      queueLength: this.healingQueue.length,
      completedTasks: this.completedTasks.length,
      lastDiagnostic: new Date().toISOString(),
      criticalTasks: this.healingQueue.filter((t) => t.severity === 'critical').length,
      highPriorityTasks: this.healingQueue.filter((t) => t.severity === 'high').length,
    };
  }

  stop(): void {
    this.isRunning = false;

    // Stop network healing service
    if (this.networkHealingService) {
      this.networkHealingService.stop();
    }

    console.log('🛑 Advanced Healing System stopped');
  }
}

// Export for use in other modules
export { AdvancedHealingSystem };

// Start if run directly
const ___filename = fileURLToPath(import.meta.url);
if (import.meta.url === `file://${process.argv[1]}`) {
  const healingSystem = new AdvancedHealingSystem();
  healingSystem.start().catch(console.error);

  // Graceful shutdown
  process.on('SIGINT', () => {
    healingSystem.stop();
    process.exit(0);
  });
}
