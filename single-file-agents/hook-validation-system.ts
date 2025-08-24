#!/usr/bin/env node

/**
 * Hook-Based Validation System
 * Based on IndyDevDan's approach: "Deterministic control over Claude Code's behavior"
 * 
 * This provides pre/post execution hooks for all agent operations
 * ensuring safety, observability, and control.
 */

import { promises as fs } from 'fs';
import { execSync } from 'child_process';
import * as path from 'path';
import * as crypto from 'crypto';

interface HookConfig {
  name: string;
  pattern: RegExp | string;
  type: 'pre' | 'post';
  handler: (context: HookContext) => Promise<HookResult>;
  priority?: number;
}

interface HookContext {
  action: string;
  agentName: string;
  input: any;
  output?: any;
  sessionId: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

interface HookResult {
  allowed: boolean;
  modified?: any;
  reason?: string;
  logs?: string[];
}

interface ValidationRule {
  name: string;
  check: (context: HookContext) => Promise<boolean>;
  message: string;
}

class HookValidationSystem {
  private hooks: Map<string, HookConfig[]> = new Map();
  private validationRules: ValidationRule[] = [];
  private eventLog: any[] = [];
  private sessionColors: Map<string, string> = new Map();

  constructor() {
    this.setupDefaultHooks();
    this.setupValidationRules();
  }

  /**
   * Setup default hooks based on IndyDevDan's patterns
   */
  private setupDefaultHooks() {
    // Pre-write validation
    this.registerHook({
      name: 'pre-write-validation',
      pattern: /^(write|edit|create|modify)/i,
      type: 'pre',
      priority: 100,
      handler: async (context) => {
        const logs: string[] = [];
        
        // Check if we're modifying critical files
        const criticalPaths = [
          '/etc/', '/System/', '/.git/', '/node_modules/',
          'package-lock.json', '.env', 'credentials'
        ];
        
        const targetPath = context.input?.path || context.input?.file_path || '';
        const isCritical = criticalPaths.some(p => targetPath.includes(p));
        
        if (isCritical) {
          logs.push(`⚠️ Attempting to modify critical path: ${targetPath}`);
          return {
            allowed: false,
            reason: 'Cannot modify critical system files',
            logs
          };
        }

        // Create backup of existing file
        if (context.action.includes('edit') && targetPath) {
          try {
            const backupPath = `${targetPath}.backup-${Date.now()}`;
            await fs.copyFile(targetPath, backupPath);
            logs.push(`✅ Created backup: ${backupPath}`);
          } catch (e) {
            logs.push(`⚠️ Could not create backup: ${e}`);
          }
        }

        logs.push('✅ Pre-write validation passed');
        return { allowed: true, logs };
      }
    });

    // Pre-execution sandbox check
    this.registerHook({
      name: 'pre-execution-sandbox',
      pattern: /^(execute|run|eval|spawn)/i,
      type: 'pre',
      priority: 90,
      handler: async (context) => {
        const logs: string[] = [];
        
        // Check if code should run in sandbox first
        const requiresSandbox = this.shouldUseSandbox(context);
        
        if (requiresSandbox) {
          logs.push('🔒 Running in sandbox mode first...');
          const sandboxResult = await this.runInSandbox(context);
          
          if (!sandboxResult.success) {
            return {
              allowed: false,
              reason: `Sandbox execution failed: ${sandboxResult.error}`,
              logs: [...logs, ...sandboxResult.logs]
            };
          }
          
          logs.push('✅ Sandbox execution successful');
        }

        return { allowed: true, logs };
      }
    });

    // Post-execution observability
    this.registerHook({
      name: 'post-execution-observability',
      pattern: /.*/,
      type: 'post',
      priority: 10,
      handler: async (context) => {
        const logs: string[] = [];
        
        // Log to observability system
        const event = {
          sessionId: context.sessionId,
          sessionColor: this.getSessionColor(context.sessionId),
          agentName: context.agentName,
          action: context.action,
          timestamp: context.timestamp,
          duration: Date.now() - context.timestamp,
          success: context.output?.success !== false,
          metadata: context.metadata
        };
        
        this.eventLog.push(event);
        logs.push(`📊 Event logged: ${event.action} (${event.duration}ms)`);
        
        // Save to file for dashboard
        await this.saveObservabilityData();
        
        return { allowed: true, logs };
      }
    });

    // Test verification hook
    this.registerHook({
      name: 'post-code-test-verification',
      pattern: /^(write|edit|create).*\.(ts|js|py)/i,
      type: 'post',
      priority: 50,
      handler: async (context) => {
        const logs: string[] = [];
        
        // Check if tests exist for modified code
        const codePath = context.input?.path || context.input?.file_path || '';
        const testPath = this.getTestPath(codePath);
        
        try {
          await fs.access(testPath);
          logs.push(`✅ Tests found: ${testPath}`);
          
          // Run tests
          try {
            execSync(`npm test -- ${testPath}`, { encoding: 'utf-8' });
            logs.push('✅ Tests passed');
          } catch (e) {
            logs.push(`⚠️ Tests failed - consider fixing`);
          }
        } catch {
          logs.push(`⚠️ No tests found for ${codePath}`);
        }
        
        return { allowed: true, logs };
      }
    });
  }

  /**
   * Setup validation rules from IndyDevDan's patterns
   */
  private setupValidationRules() {
    // Rule: No infinite loops
    this.validationRules.push({
      name: 'no-infinite-loops',
      check: async (context) => {
        const code = context.input?.code || context.input?.content || '';
        const hasWhileTrue = /while\s*\(\s*true\s*\)/.test(code);
        const hasForeverLoop = /for\s*\(\s*;\s*;\s*\)/.test(code);
        return !hasWhileTrue && !hasForeverLoop;
      },
      message: 'Code contains potential infinite loop'
    });

    // Rule: No eval() or dangerous functions
    this.validationRules.push({
      name: 'no-dangerous-functions',
      check: async (context) => {
        const code = context.input?.code || context.input?.content || '';
        const dangerous = ['eval(', 'exec(', 'Function(', '__import__'];
        return !dangerous.some(fn => code.includes(fn));
      },
      message: 'Code contains potentially dangerous functions'
    });

    // Rule: Resource limits
    this.validationRules.push({
      name: 'resource-limits',
      check: async (context) => {
        const size = JSON.stringify(context.input).length;
        return size < 1000000; // 1MB limit
      },
      message: 'Input exceeds resource limits'
    });
  }

  /**
   * Register a new hook
   */
  registerHook(config: HookConfig) {
    const key = `${config.type}-${config.priority || 50}`;
    if (!this.hooks.has(key)) {
      this.hooks.set(key, []);
    }
    this.hooks.get(key)!.push(config);
    
    // Sort by priority
    this.hooks.set(key, this.hooks.get(key)!.sort((a, b) => 
      (b.priority || 50) - (a.priority || 50)
    ));
  }

  /**
   * Execute hooks for a given context
   */
  async executeHooks(context: HookContext, type: 'pre' | 'post'): Promise<HookResult> {
    const logs: string[] = [];
    let finalResult: HookResult = { allowed: true, logs };

    // Get all hooks for this type, sorted by priority
    const relevantHooks: HookConfig[] = [];
    for (const [key, hooks] of this.hooks.entries()) {
      if (key.startsWith(type)) {
        relevantHooks.push(...hooks);
      }
    }

    // Execute hooks in priority order
    for (const hook of relevantHooks) {
      // Check if hook pattern matches
      const matches = typeof hook.pattern === 'string' 
        ? context.action.includes(hook.pattern)
        : hook.pattern.test(context.action);
      
      if (!matches) continue;

      try {
        const result = await hook.handler(context);
        logs.push(`Hook ${hook.name}: ${result.allowed ? '✅' : '❌'}`);
        
        if (result.logs) {
          logs.push(...result.logs);
        }

        if (!result.allowed) {
          return {
            allowed: false,
            reason: result.reason,
            logs
          };
        }

        if (result.modified) {
          context.input = result.modified;
        }
      } catch (error) {
        logs.push(`❌ Hook ${hook.name} failed: ${error}`);
        return {
          allowed: false,
          reason: `Hook execution failed: ${error}`,
          logs
        };
      }
    }

    // Run validation rules for pre-hooks
    if (type === 'pre') {
      for (const rule of this.validationRules) {
        const passed = await rule.check(context);
        if (!passed) {
          logs.push(`❌ Validation failed: ${rule.message}`);
          return {
            allowed: false,
            reason: rule.message,
            logs
          };
        }
      }
    }

    return { allowed: true, logs };
  }

  /**
   * Determine if sandbox is needed
   */
  private shouldUseSandbox(context: HookContext): boolean {
    // Sandbox for untrusted code execution
    const dangerousActions = ['execute', 'eval', 'spawn', 'run-untrusted'];
    return dangerousActions.some(action => 
      context.action.toLowerCase().includes(action)
    );
  }

  /**
   * Run code in sandbox
   */
  private async runInSandbox(context: HookContext): Promise<any> {
    const logs: string[] = [];
    
    try {
      // Create temporary sandbox directory
      const sandboxDir = `/tmp/sandbox-${Date.now()}`;
      await fs.mkdir(sandboxDir, { recursive: true });
      logs.push(`Created sandbox: ${sandboxDir}`);

      // Copy necessary files
      const code = context.input?.code || '';
      const sandboxFile = path.join(sandboxDir, 'sandbox-test.js');
      await fs.writeFile(sandboxFile, code);

      // Run with restrictions
      const result = execSync(
        `timeout 5s node --max-old-space-size=128 ${sandboxFile}`,
        { 
          encoding: 'utf-8',
          cwd: sandboxDir,
          env: { ...process.env, NODE_ENV: 'sandbox' }
        }
      );

      // Cleanup
      await fs.rm(sandboxDir, { recursive: true });
      logs.push('Sandbox execution completed successfully');

      return { success: true, output: result, logs };
    } catch (error) {
      logs.push(`Sandbox execution failed: ${error}`);
      return { success: false, error: error.message, logs };
    }
  }

  /**
   * Get test file path for a code file
   */
  private getTestPath(codePath: string): string {
    const dir = path.dirname(codePath);
    const base = path.basename(codePath, path.extname(codePath));
    const ext = path.extname(codePath);
    
    // Try common test file patterns
    const patterns = [
      path.join(dir, '__tests__', `${base}.test${ext}`),
      path.join(dir, '__tests__', `${base}.spec${ext}`),
      path.join(dir, 'tests', `${base}.test${ext}`),
      path.join(dir, `${base}.test${ext}`),
      path.join(dir, `${base}.spec${ext}`)
    ];

    return patterns[0]; // Return first pattern for check
  }

  /**
   * Get color for session (from IndyDevDan's observability)
   */
  private getSessionColor(sessionId: string): string {
    if (!this.sessionColors.has(sessionId)) {
      const hash = crypto.createHash('md5').update(sessionId).digest('hex');
      const hue = parseInt(hash.substring(0, 3), 16) % 360;
      this.sessionColors.set(sessionId, `hsl(${hue}, 70%, 50%)`);
    }
    return this.sessionColors.get(sessionId)!;
  }

  /**
   * Save observability data for dashboard
   */
  private async saveObservabilityData() {
    const dataPath = path.join(__dirname, 'observability-data.json');
    await fs.writeFile(dataPath, JSON.stringify({
      events: this.eventLog.slice(-1000), // Keep last 1000 events
      sessions: Array.from(this.sessionColors.entries()).map(([id, color]) => ({
        id, color
      }))
    }, null, 2));
  }

  /**
   * Create context for hook execution
   */
  createContext(
    action: string,
    agentName: string,
    input: any,
    sessionId?: string
  ): HookContext {
    return {
      action,
      agentName,
      input,
      sessionId: sessionId || crypto.randomUUID(),
      timestamp: Date.now()
    };
  }

  /**
   * Get observability dashboard HTML
   */
  async getDashboardHTML(): Promise<string> {
    return `
<!DOCTYPE html>
<html>
<head>
  <title>Hook Validation System - Observability Dashboard</title>
  <style>
    body { 
      font-family: 'Monaco', monospace; 
      background: #1e1e1e; 
      color: #fff;
      padding: 20px;
    }
    .event {
      background: #2d2d2d;
      border-radius: 8px;
      padding: 10px;
      margin: 10px 0;
      border-left: 4px solid var(--session-color);
    }
    .success { background: #1e3a1e; }
    .failure { background: #3a1e1e; }
    .metric {
      display: inline-block;
      background: #333;
      padding: 5px 10px;
      margin: 5px;
      border-radius: 4px;
    }
    h1 { color: #4CAF50; }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin: 20px 0;
    }
    .stat-card {
      background: #2d2d2d;
      padding: 15px;
      border-radius: 8px;
      text-align: center;
    }
    .stat-value {
      font-size: 2em;
      color: #4CAF50;
    }
  </style>
</head>
<body>
  <h1>🪝 Hook Validation System Dashboard</h1>
  <div class="stats">
    <div class="stat-card">
      <div class="stat-value">${this.eventLog.length}</div>
      <div>Total Events</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${this.sessionColors.size}</div>
      <div>Active Sessions</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${this.hooks.size}</div>
      <div>Registered Hooks</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${this.validationRules.length}</div>
      <div>Validation Rules</div>
    </div>
  </div>
  
  <h2>Recent Events</h2>
  ${this.eventLog.slice(-20).reverse().map(event => `
    <div class="event ${event.success ? 'success' : 'failure'}" 
         style="--session-color: ${event.sessionColor}">
      <strong>${event.agentName}</strong> - ${event.action}
      <div class="metric">Duration: ${event.duration}ms</div>
      <div class="metric">Session: ${event.sessionId.substring(0, 8)}</div>
      <div class="metric">${new Date(event.timestamp).toLocaleTimeString()}</div>
    </div>
  `).join('')}
</body>
</html>
    `;
  }
}

// Export for use by other agents
export { HookValidationSystem, HookConfig, HookContext, HookResult };

// CLI usage
if (require.main === module) {
  const system = new HookValidationSystem();
  
  // Example: Run dashboard server
  if (process.argv[2] === 'dashboard') {
    const http = require('http');
    const server = http.createServer(async (req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(await system.getDashboardHTML());
    });
    
    const port = 8888;
    server.listen(port, () => {
      console.log(`🪝 Hook Validation Dashboard running at http://localhost:${port}`);
    });
  } else {
    console.log(`
Hook Validation System
Based on IndyDevDan's approach

Usage:
  node hook-validation-system.js dashboard  - Run observability dashboard

This system provides:
- Pre/post execution hooks for all agents
- Sandbox execution for untrusted code  
- Automatic backup creation
- Test verification
- Resource limit checking
- Observability and monitoring

Import in your agents:
  import { HookValidationSystem } from './hook-validation-system';
    `);
  }
}

export default HookValidationSystem;