/**
 * Healing Rollback Service
 * Comprehensive rollback capabilities for failed healing attempts
 * Ensures system can recover from unsuccessful fixes to maintain >95% reliability
 */

import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import { spawn } from 'child_process';
import { Logger } from '@/utils/logger';
import { CircuitBreaker } from '@/utils/circuit-breaker';
import { contextStorageService } from './context-storage-service';

interface RollbackSnapshot {
  id: string;
  timestamp: Date;
  healingId: string;
  description: string;
  changes: SnapshotChange[];
  systemState: SystemSnapshot;
  rollbackPlan: RollbackStep[];
  metadata: {
    module: string;
    approach: string;
    originalError: string;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
  };
}

interface SnapshotChange {
  type: 'file' | 'directory' | 'config' | 'dependency' | 'environment';
  path: string;
  operation: 'create' | 'modify' | 'delete' | 'move';
  beforeState?: {
    content?: string;
    permissions?: string;
    metadata?: Record<string, any>;
  };
  afterState?: {
    content?: string;
    permissions?: string;
    metadata?: Record<string, any>;
  };
  backupPath?: string;
}

interface SystemSnapshot {
  workingDirectory: string;
  gitCommit?: string;
  nodeModules?: {
    hash: string;
    dependencies: Record<string, string>;
  };
  environment: Record<string, string>;
  processState: {
    pid: number;
    memory: NodeJS.MemoryUsage;
    uptime: number;
  };
  openFiles: string[];
  networkConnections: Array<{
    local: string;
    remote: string;
    state: string;
  }>;
}

interface RollbackStep {
  order: number;
  action: 'restore_file' | 'delete_file' | 'run_command' | 'restore_config' | 'restart_service';
  target: string;
  parameters: Record<string, any>;
  critical: boolean;
  timeout: number;
  rollbackOnFailure: boolean;
}

interface RollbackResult {
  success: boolean;
  snapshotId: string;
  stepsExecuted: number;
  stepsFailed: number;
  duration: number;
  errors: Array<{
    step: number;
    action: string;
    error: string;
    recovered: boolean;
  }>;
  finalState: 'rolled_back' | 'partial_rollback' | 'failed';
  additionalActions?: string[];
}

class HealingRollbackService extends EventEmitter {
  private snapshots: Map<string, RollbackSnapshot> = new Map();
  private activeRollbacks: Set<string> = new Set();
  private rollbackHistory: Array<{ snapshotId: string; timestamp: Date; result: RollbackResult }> = [];
  private circuitBreaker: CircuitBreaker;
  private logger = new Logger('RollbackService');
  private readonly MAX_SNAPSHOTS = 50;
  private readonly ROLLBACK_TIMEOUT = 300000; // 5 minutes
  private readonly CRITICAL_FILES = [
    'package.json',
    'tsconfig.json',
    '.env',
    'src/config',
    'src/types'
  ];

  constructor() {
    super();
    this.circuitBreaker = new CircuitBreaker('rollback-service', {
      failureThreshold: 3,
      timeout: this.ROLLBACK_TIMEOUT,
      successThreshold: 2
    });
    this.initializeService();
  }

  /**
   * Creates a rollback snapshot before applying healing
   */
  async createSnapshot(
    healingId: string,
    changes: SnapshotChange[],
    metadata: {
      module: string;
      approach: string;
      originalError: string;
      riskLevel?: 'low' | 'medium' | 'high' | 'critical';
    }
  ): Promise<string> {
    const snapshotId = this.generateSnapshotId();
    const timestamp = new Date();
    
    try {
      this.logger.info('Creating rollback snapshot', {
        snapshotId,
        healingId,
        changesCount: changes.length,
        riskLevel: metadata.riskLevel
      });
      
      // Capture system state
      const systemState = await this.captureSystemState();
      
      // Create file backups
      await this.createFileBackups(changes);
      
      // Generate rollback plan
      const rollbackPlan = await this.generateRollbackPlan(changes, metadata.riskLevel || 'medium');
      
      // Create snapshot
      const snapshot: RollbackSnapshot = {
        id: snapshotId,
        timestamp,
        healingId,
        description: `Snapshot for ${metadata.module} healing using ${metadata.approach}`,
        changes,
        systemState,
        rollbackPlan,
        metadata: {
          ...metadata,
          riskLevel: metadata.riskLevel || 'medium'
        }
      };
      
      // Store snapshot
      this.snapshots.set(snapshotId, snapshot);
      
      // Persist to storage
      await this.persistSnapshot(snapshot);
      
      // Clean up old snapshots if needed
      await this.cleanupOldSnapshots();
      
      this.emit('snapshot-created', {
        snapshotId,
        healingId,
        changesCount: changes.length
      });
      
      return snapshotId;
    } catch (error) {
      this.logger.error('Failed to create snapshot', {
        error,
        snapshotId,
        healingId
      });
      throw new Error(`Snapshot creation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Executes rollback to a specific snapshot
   */
  async executeRollback(
    snapshotId: string,
    options: {
      force?: boolean;
      skipValidation?: boolean;
      partialRollback?: string[]; // Specific steps to rollback
    } = {}
  ): Promise<RollbackResult> {
    if (this.activeRollbacks.has(snapshotId)) {
      throw new Error(`Rollback already in progress for snapshot ${snapshotId}`);
    }
    
    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot) {
      throw new Error(`Snapshot ${snapshotId} not found`);
    }
    
    this.activeRollbacks.add(snapshotId);
    const startTime = Date.now();
    
    try {
      this.logger.info('Starting rollback execution', {
        snapshotId,
        healingId: snapshot.healingId,
        riskLevel: snapshot.metadata.riskLevel,
        stepsCount: snapshot.rollbackPlan.length
      });
      
      this.emit('rollback-started', {
        snapshotId,
        healingId: snapshot.healingId
      });
      
      // Validate system state before rollback
      if (!options.skipValidation) {
        await this.validateRollbackPreconditions(snapshot);
      }
      
      // Execute rollback steps
      const result = await this.executeRollbackSteps(
        snapshot,
        options.partialRollback
      );
      
      // Record rollback history
      this.rollbackHistory.push({
        snapshotId,
        timestamp: new Date(),
        result
      });
      
      // Store rollback result
      await this.storeRollbackResult(snapshot, result);
      
      this.emit('rollback-completed', {
        snapshotId,
        healingId: snapshot.healingId,
        result
      });
      
      return result;
    } catch (error) {
      const result: RollbackResult = {
        success: false,
        snapshotId,
        stepsExecuted: 0,
        stepsFailed: 1,
        duration: Date.now() - startTime,
        errors: [{
          step: 0,
          action: 'initialization',
          error: error instanceof Error ? error.message : String(error),
          recovered: false
        }],
        finalState: 'failed',
        additionalActions: ['Check logs for detailed error information']
      };
      
      this.emit('rollback-failed', {
        snapshotId,
        healingId: snapshot.healingId,
        error
      });
      
      return result;
    } finally {
      this.activeRollbacks.delete(snapshotId);
    }
  }

  /**
   * Executes individual rollback steps
   */
  private async executeRollbackSteps(
    snapshot: RollbackSnapshot,
    partialSteps?: string[]
  ): Promise<RollbackResult> {
    const startTime = Date.now();
    const errors: RollbackResult['errors'] = [];
    let stepsExecuted = 0;
    let stepsFailed = 0;
    
    // Sort steps by execution order
    const sortedSteps = snapshot.rollbackPlan.sort((a, b) => a.order - b.order);
    
    // Filter steps if partial rollback requested
    const stepsToExecute = partialSteps
      ? sortedSteps.filter(step => partialSteps.includes(step.target))
      : sortedSteps;
    
    for (const step of stepsToExecute) {
      try {
        this.logger.info('Executing rollback step', {
          order: step.order,
          action: step.action,
          target: step.target,
          critical: step.critical
        });
        
        await this.executeRollbackStep(step);
        stepsExecuted++;
        
        this.emit('rollback-step-completed', {
          snapshotId: snapshot.id,
          step: step.order,
          action: step.action
        });
      } catch (error) {
        stepsFailed++;
        const errorInfo = {
          step: step.order,
          action: step.action,
          error: error instanceof Error ? error.message : String(error),
          recovered: false
        };
        errors.push(errorInfo);
        
        this.logger.error('Rollback step failed', {
          ...errorInfo,
          target: step.target,
          critical: step.critical
        });
        
        // For critical steps, attempt recovery
        if (step.critical) {
          try {
            await this.attemptStepRecovery(step, error);
            errorInfo.recovered = true;
            this.logger.info('Critical step recovery successful', {
              step: step.order,
              action: step.action
            });
          } catch (recoveryError) {
            this.logger.error('Critical step recovery failed', {
              step: step.order,
              action: step.action,
              recoveryError
            });
            
            // If critical step fails and can't be recovered, stop rollback
            if (!step.rollbackOnFailure) {
              break;
            }
          }
        }
        
        this.emit('rollback-step-failed', {
          snapshotId: snapshot.id,
          step: step.order,
          error: errorInfo
        });
      }
    }
    
    // Determine final state
    let finalState: RollbackResult['finalState'];
    const additionalActions: string[] = [];
    
    if (stepsFailed === 0) {
      finalState = 'rolled_back';
      additionalActions.push('Rollback completed successfully');
    } else if (stepsExecuted > stepsFailed) {
      finalState = 'partial_rollback';
      additionalActions.push(
        `Partial rollback completed. ${stepsFailed} steps failed.`,
        'Manual intervention may be required for failed steps',
        'Review error logs and system state'
      );
    } else {
      finalState = 'failed';
      additionalActions.push(
        'Rollback failed',
        'System may be in inconsistent state',
        'Immediate manual intervention required'
      );
    }
    
    return {
      success: stepsFailed === 0,
      snapshotId: snapshot.id,
      stepsExecuted,
      stepsFailed,
      duration: Date.now() - startTime,
      errors,
      finalState,
      additionalActions
    };
  }

  /**
   * Executes a single rollback step
   */
  private async executeRollbackStep(step: RollbackStep): Promise<void> {
    const timeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Step timeout after ${step.timeout}ms`)), step.timeout);
    });
    
    const execution = this.performStepAction(step);
    
    await Promise.race([execution, timeout]);
  }

  /**
   * Performs the actual rollback step action
   */
  private async performStepAction(step: RollbackStep): Promise<void> {
    switch (step.action) {
      case 'restore_file':
        await this.restoreFile(step.target, step.parameters.backupPath);
        break;
        
      case 'delete_file':
        await this.deleteFile(step.target);
        break;
        
      case 'run_command':
        await this.runCommand(step.parameters.command, step.parameters.args || []);
        break;
        
      case 'restore_config':
        await this.restoreConfig(step.target, step.parameters.configData);
        break;
        
      case 'restart_service':
        await this.restartService(step.target);
        break;
        
      default:
        throw new Error(`Unknown rollback action: ${step.action}`);
    }
  }

  /**
   * Restores a file from backup
   */
  private async restoreFile(filePath: string, backupPath: string): Promise<void> {
    try {
      await fs.access(backupPath);
      await fs.copyFile(backupPath, filePath);
      this.logger.info('File restored from backup', { filePath, backupPath });
    } catch (error) {
      throw new Error(`Failed to restore ${filePath}: ${error}`);
    }
  }

  /**
   * Deletes a file
   */
  private async deleteFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
      this.logger.info('File deleted', { filePath });
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        throw new Error(`Failed to delete ${filePath}: ${error}`);
      }
    }
  }

  /**
   * Runs a command
   */
  private async runCommand(command: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const process = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let output = '';
      let errorOutput = '';
      
      process.stdout?.on('data', (data) => {
        output += data.toString();
      });
      
      process.stderr?.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      process.on('close', (code) => {
        if (code === 0) {
          this.logger.info('Command executed successfully', {
            command,
            args,
            output
          });
          resolve();
        } else {
          reject(new Error(`Command failed with code ${code}: ${errorOutput}`));
        }
      });
      
      process.on('error', (error) => {
        reject(new Error(`Failed to execute command: ${error.message}`));
      });
    });
  }

  /**
   * Restores configuration
   */
  private async restoreConfig(configPath: string, configData: any): Promise<void> {
    try {
      const content = typeof configData === 'string' ? configData : JSON.stringify(configData, null, 2);
      await fs.writeFile(configPath, content);
      this.logger.info('Configuration restored', { configPath });
    } catch (error) {
      throw new Error(`Failed to restore config ${configPath}: ${error}`);
    }
  }

  /**
   * Restarts a service
   */
  private async restartService(serviceName: string): Promise<void> {
    // This would implement actual service restart logic
    this.logger.info('Service restart requested', { serviceName });
    // Implementation depends on the service management system
  }

  /**
   * Creates file backups for rollback
   */
  private async createFileBackups(changes: SnapshotChange[]): Promise<void> {
    const backupDir = path.join(process.cwd(), '.rollback-backups', Date.now().toString());
    await fs.mkdir(backupDir, { recursive: true });
    
    for (const change of changes) {
      if (change.type === 'file' && change.operation !== 'create') {
        try {
          const backupPath = path.join(backupDir, path.basename(change.path));
          await fs.copyFile(change.path, backupPath);
          change.backupPath = backupPath;
        } catch (error) {
          // If file doesn't exist, that's ok for delete operations
          if (change.operation !== 'delete') {
            this.logger.warn('Failed to create backup', {
              filePath: change.path,
              error
            });
          }
        }
      }
    }
  }

  /**
   * Generates rollback plan from changes
   */
  private async generateRollbackPlan(
    changes: SnapshotChange[],
    riskLevel: string
  ): Promise<RollbackStep[]> {
    const steps: RollbackStep[] = [];
    let order = 1;
    
    // Reverse the order of changes for rollback
    const reversedChanges = [...changes].reverse();
    
    for (const change of reversedChanges) {
      switch (change.operation) {
        case 'create':
          // Delete created files
          steps.push({
            order: order++,
            action: 'delete_file',
            target: change.path,
            parameters: {},
            critical: this.isCriticalFile(change.path),
            timeout: 30000,
            rollbackOnFailure: false
          });
          break;
          
        case 'modify':
          // Restore modified files
          if (change.backupPath) {
            steps.push({
              order: order++,
              action: 'restore_file',
              target: change.path,
              parameters: { backupPath: change.backupPath },
              critical: this.isCriticalFile(change.path),
              timeout: 30000,
              rollbackOnFailure: true
            });
          }
          break;
          
        case 'delete':
          // Restore deleted files
          if (change.beforeState?.content) {
            steps.push({
              order: order++,
              action: 'restore_file',
              target: change.path,
              parameters: { content: change.beforeState.content },
              critical: this.isCriticalFile(change.path),
              timeout: 30000,
              rollbackOnFailure: true
            });
          }
          break;
      }
    }
    
    // Add additional steps based on risk level
    if (riskLevel === 'high' || riskLevel === 'critical') {
      steps.push({
        order: order++,
        action: 'run_command',
        target: 'npm-install',
        parameters: {
          command: 'npm',
          args: ['install']
        },
        critical: false,
        timeout: 120000,
        rollbackOnFailure: false
      });
      
      steps.push({
        order: order++,
        action: 'run_command',
        target: 'build-check',
        parameters: {
          command: 'npm',
          args: ['run', 'build']
        },
        critical: false,
        timeout: 180000,
        rollbackOnFailure: false
      });
    }
    
    return steps;
  }

  /**
   * Captures current system state
   */
  private async captureSystemState(): Promise<SystemSnapshot> {
    const cwd = process.cwd();
    
    // Get Git commit if available
    let gitCommit: string | undefined;
    try {
      const { execSync } = require('child_process');
      gitCommit = execSync('git rev-parse HEAD', { cwd, encoding: 'utf8' }).trim();
    } catch (error) {
      // Git not available or not in a git repo
    }
    
    // Get package.json dependencies
    let nodeModules: SystemSnapshot['nodeModules'] | undefined;
    try {
      const packageJson = JSON.parse(
        await fs.readFile(path.join(cwd, 'package.json'), 'utf8')
      );
      nodeModules = {
        hash: this.hashObject(packageJson.dependencies || {}),
        dependencies: packageJson.dependencies || {}
      };
    } catch (error) {
      // package.json not found
    }
    
    return {
      workingDirectory: cwd,
      gitCommit,
      nodeModules,
      environment: Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== undefined)) as Record<string, string>,
      processState: {
        pid: process.pid,
        memory: process.memoryUsage(),
        uptime: process.uptime()
      },
      openFiles: [], // Would implement actual open file detection
      networkConnections: [] // Would implement actual network connection detection
    };
  }

  /**
   * Validates preconditions for rollback
   */
  private async validateRollbackPreconditions(snapshot: RollbackSnapshot): Promise<void> {
    // Check if system is in a state where rollback is safe
    const currentState = await this.captureSystemState();
    
    // Validate working directory
    if (currentState.workingDirectory !== snapshot.systemState.workingDirectory) {
      throw new Error('Working directory has changed since snapshot was taken');
    }
    
    // Check for active processes that might interfere
    if (this.activeRollbacks.size > 0) {
      throw new Error('Another rollback is currently in progress');
    }
    
    // Validate critical files exist
    for (const change of snapshot.changes) {
      if (change.backupPath) {
        try {
          await fs.access(change.backupPath);
        } catch (error) {
          throw new Error(`Backup file not found: ${change.backupPath}`);
        }
      }
    }
  }

  /**
   * Attempts to recover from a failed rollback step
   */
  private async attemptStepRecovery(step: RollbackStep, originalError: any): Promise<void> {
    this.logger.info('Attempting step recovery', {
      step: step.order,
      action: step.action,
      originalError: originalError.message
    });
    
    // Implement recovery strategies based on step type
    switch (step.action) {
      case 'restore_file':
        // Try alternative restore methods
        await this.attemptAlternativeFileRestore(step.target, step.parameters);
        break;
        
      case 'run_command':
        // Retry command with modified parameters
        await this.retryCommandWithFallback(step.parameters);
        break;
        
      default:
        throw new Error('No recovery strategy available for this step type');
    }
  }

  private async attemptAlternativeFileRestore(filePath: string, parameters: any): Promise<void> {
    // Implementation of alternative file restore methods
    throw new Error('Alternative file restore not implemented');
  }

  private async retryCommandWithFallback(parameters: any): Promise<void> {
    // Implementation of command retry with fallback
    throw new Error('Command retry not implemented');
  }

  // Utility methods
  private isCriticalFile(filePath: string): boolean {
    return this.CRITICAL_FILES.some(critical => filePath.includes(critical));
  }

  private generateSnapshotId(): string {
    return `rollback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private hashObject(obj: any): string {
    return Buffer.from(JSON.stringify(obj)).toString('base64');
  }

  private async initializeService(): Promise<void> {
    // Initialize service state
    this.logger.info('Rollback service initialized');
  }

  private async persistSnapshot(snapshot: RollbackSnapshot): Promise<void> {
    try {
      await contextStorageService.storeContext({
        content: JSON.stringify(snapshot),
        category: 'architecture_patterns',
        source: 'rollback-service',
        metadata: {
          type: 'rollback_snapshot',
          healingId: snapshot.healingId,
          riskLevel: snapshot.metadata.riskLevel
        }
      });
    } catch (error) {
      this.logger.error('Failed to persist snapshot', { error });
    }
  }

  private async cleanupOldSnapshots(): Promise<void> {
    if (this.snapshots.size > this.MAX_SNAPSHOTS) {
      const sortedSnapshots = Array.from(this.snapshots.values())
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      
      const toRemove = sortedSnapshots.slice(0, this.snapshots.size - this.MAX_SNAPSHOTS);
      
      for (const snapshot of toRemove) {
        this.snapshots.delete(snapshot.id);
        
        // Clean up backup files
        for (const change of snapshot.changes) {
          if (change.backupPath) {
            try {
              await fs.unlink(change.backupPath);
            } catch (error) {
              // Ignore cleanup errors
            }
          }
        }
      }
      
      this.logger.info('Cleaned up old snapshots', { removed: toRemove.length });
    }
  }

  private async storeRollbackResult(
    snapshot: RollbackSnapshot,
    result: RollbackResult
  ): Promise<void> {
    try {
      await contextStorageService.storeContext({
        content: JSON.stringify({ snapshot: snapshot.id, result }),
        category: 'test_results',
        source: 'rollback-service',
        metadata: {
          type: 'rollback_result',
          healingId: snapshot.healingId,
          success: result.success,
          finalState: result.finalState
        }
      });
    } catch (error) {
      this.logger.error('Failed to store rollback result', { error });
    }
  }

  /**
   * Gets rollback service metrics
   */
  getMetrics(): {
    activeSnapshots: number;
    totalRollbacks: number;
    successfulRollbacks: number;
    averageRollbackTime: number;
    criticalFailures: number;
  } {
    const successfulRollbacks = this.rollbackHistory.filter(r => r.result.success).length;
    const totalTime = this.rollbackHistory.reduce((sum, r) => sum + r.result.duration, 0);
    const criticalFailures = this.rollbackHistory.filter(
      r => r.result.finalState === 'failed'
    ).length;
    
    return {
      activeSnapshots: this.snapshots.size,
      totalRollbacks: this.rollbackHistory.length,
      successfulRollbacks,
      averageRollbackTime: this.rollbackHistory.length > 0 ? totalTime / this.rollbackHistory.length : 0,
      criticalFailures
    };
  }

  /**
   * Lists available snapshots
   */
  listSnapshots(): Array<{
    id: string;
    timestamp: Date;
    healingId: string;
    description: string;
    riskLevel: string;
    changesCount: number;
  }> {
    return Array.from(this.snapshots.values()).map(s => ({
      id: s.id,
      timestamp: s.timestamp,
      healingId: s.healingId,
      description: s.description,
      riskLevel: s.metadata.riskLevel,
      changesCount: s.changes.length
    }));
  }
}

// Export singleton instance
export const healingRollbackService = new HealingRollbackService();
export default healingRollbackService;

// Export types
export type {
  RollbackSnapshot,
  SnapshotChange,
  RollbackResult,
  RollbackStep
};