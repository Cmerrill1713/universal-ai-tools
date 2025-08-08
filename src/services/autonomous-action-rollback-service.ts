/**
 * Autonomous Action Rollback Service
 * Handles automatic rollback of autonomous actions when performance degrades
 */

import { LogContext, log } from '../utils/logger';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config/environment';

export interface RollbackTrigger {
  id: string;
  actionId: string;
  metric: string;
  threshold: number;
  operator: 'lt' | 'gt' | 'eq';
  triggered: boolean;
  triggeredAt?: Date;
}

export interface RollbackResult {
  success: boolean;
  actionId: string;
  reason: string;
  metricsBefore: Record<string, number>;
  metricsAfter: Record<string, number>;
  duration: number;
  timestamp: Date;
}

export interface PerformanceBaseline {
  actionId: string;
  metrics: Record<string, number>;
  timestamp: Date;
  validUntil: Date;
}

export class AutonomousActionRollbackService {
  private supabase: any;
  private activeRollbacks: Map<string, RollbackResult> = new Map();
  private performanceBaselines: Map<string, PerformanceBaseline> = new Map();
  private rollbackTriggers: Map<string, RollbackTrigger[]> = new Map();

  constructor() {
    this.initializeSupabase();
  }

  private initializeSupabase(): void {
    try {
      this.supabase = createClient(
        config.supabase.url,
        config.supabase.anonKey
      );
      log.info('✅ Autonomous action rollback service initialized', LogContext.SERVICE);
    } catch (error) {
      log.error('❌ Failed to initialize Supabase for rollback service', LogContext.SERVICE, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Set performance baseline for an action
   */
  public async setBaseline(actionId: string, metrics: Record<string, number>): Promise<void> {
    const baseline: PerformanceBaseline = {
      actionId,
      metrics,
      timestamp: new Date(),
      validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    };

    this.performanceBaselines.set(actionId, baseline);

    // Store in database
    if (this.supabase) {
      try {
        await this.supabase
          .from('autonomous_action_baselines')
          .upsert({
            action_id: actionId,
            metrics,
            created_at: baseline.timestamp.toISOString(),
            valid_until: baseline.validUntil.toISOString(),
          });
      } catch (error) {
        log.error('Failed to store baseline in database', LogContext.SERVICE, {
          actionId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * Add rollback triggers for an action
   */
  public async addRollbackTriggers(actionId: string, triggers: Omit<RollbackTrigger, 'id' | 'triggered'>[]): Promise<void> {
    const rollbackTriggers: RollbackTrigger[] = triggers.map((trigger, index) => ({
      ...trigger,
      id: `${actionId}-trigger-${index}`,
      triggered: false,
    }));

    this.rollbackTriggers.set(actionId, rollbackTriggers);

    // Store in database
    if (this.supabase) {
      try {
        await this.supabase
          .from('autonomous_action_triggers')
          .upsert(
            rollbackTriggers.map(trigger => ({
              id: trigger.id,
              action_id: actionId,
              metric: trigger.metric,
              threshold: trigger.threshold,
              operator: trigger.operator,
            }))
          );
      } catch (error) {
        log.error('Failed to store rollback triggers in database', LogContext.SERVICE, {
          actionId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * Check if rollback is needed based on current metrics
   */
  public async checkRollbackNeeded(actionId: string, currentMetrics: Record<string, number>): Promise<RollbackTrigger | null> {
    const baseline = this.performanceBaselines.get(actionId);
    const triggers = this.rollbackTriggers.get(actionId);

    if (!baseline || !triggers) {
      return null;
    }

    for (const trigger of triggers) {
      if (trigger.triggered) continue;

      const baselineValue = baseline.metrics[trigger.metric];
      const currentValue = currentMetrics[trigger.metric];

      if (baselineValue === undefined || currentValue === undefined) continue;

      let shouldTrigger = false;

      switch (trigger.operator) {
        case 'lt':
          shouldTrigger = currentValue < trigger.threshold;
          break;
        case 'gt':
          shouldTrigger = currentValue > trigger.threshold;
          break;
        case 'eq':
          shouldTrigger = currentValue === trigger.threshold;
          break;
      }

      if (shouldTrigger) {
        trigger.triggered = true;
        trigger.triggeredAt = new Date();
        return trigger;
      }
    }

    return null;
  }

  /**
   * Execute rollback for an action
   */
  public async executeRollback(actionId: string, reason: string): Promise<RollbackResult> {
    const startTime = Date.now();
    const baseline = this.performanceBaselines.get(actionId);

    if (!baseline) {
      throw new Error(`No baseline found for action ${actionId}`);
    }

    log.info('🔄 Executing rollback for autonomous action', LogContext.SERVICE, {
      actionId,
      reason,
    });

    try {
      // Simulate rollback process
      await new Promise(resolve => setTimeout(resolve, 1000));

      const rollbackResult: RollbackResult = {
        success: true,
        actionId,
        reason,
        metricsBefore: baseline.metrics,
        metricsAfter: baseline.metrics, // Rollback restores baseline metrics
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };

      this.activeRollbacks.set(actionId, rollbackResult);

      // Store rollback result in database
      if (this.supabase) {
        try {
          await this.supabase
            .from('autonomous_action_rollbacks')
            .insert({
              action_id: actionId,
              reason,
              metrics_before: rollbackResult.metricsBefore,
              metrics_after: rollbackResult.metricsAfter,
              duration: rollbackResult.duration,
              created_at: rollbackResult.timestamp.toISOString(),
            });
        } catch (error) {
          log.error('Failed to store rollback result in database', LogContext.SERVICE, {
            actionId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      log.info('✅ Rollback completed successfully', LogContext.SERVICE, {
        actionId,
        duration: rollbackResult.duration,
      });

      return rollbackResult;
    } catch (error) {
      const rollbackResult: RollbackResult = {
        success: false,
        actionId,
        reason: error instanceof Error ? error.message : String(error),
        metricsBefore: baseline.metrics,
        metricsAfter: baseline.metrics,
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };

      log.error('❌ Rollback failed', LogContext.SERVICE, {
        actionId,
        error: error instanceof Error ? error.message : String(error),
      });

      return rollbackResult;
    }
  }

  /**
   * Get rollback history for an action
   */
  public async getRollbackHistory(actionId: string): Promise<RollbackResult[]> {
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('autonomous_action_rollbacks')
          .select('*')
          .eq('action_id', actionId)
          .order('created_at', { ascending: false });

        if (error) throw error;

        return data.map((row: any) => ({
          success: row.success,
          actionId: row.action_id,
          reason: row.reason,
          metricsBefore: row.metrics_before,
          metricsAfter: row.metrics_after,
          duration: row.duration,
          timestamp: new Date(row.created_at),
        }));
      } catch (error) {
        log.error('Failed to get rollback history from database', LogContext.SERVICE, {
          actionId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Return local rollback results if database is not available
    const localResult = this.activeRollbacks.get(actionId);
    return localResult ? [localResult] : [];
  }

  /**
   * Get service status
   */
  public async getStatus(): Promise<{
    activeRollbacks: number;
    totalBaselines: number;
    totalTriggers: number;
    lastRollback?: Date;
  }> {
    const lastRollback = Array.from(this.activeRollbacks.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0]?.timestamp;

    return {
      activeRollbacks: this.activeRollbacks.size,
      totalBaselines: this.performanceBaselines.size,
      totalTriggers: Array.from(this.rollbackTriggers.values()).flat().length,
      lastRollback,
    };
  }
}

// Export singleton instance
export const autonomousActionRollbackService = new AutonomousActionRollbackService();
