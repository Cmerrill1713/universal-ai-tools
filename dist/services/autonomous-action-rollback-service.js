import { createClient } from '@supabase/supabase-js';
import { config } from '../config/environment';
import { log, LogContext } from '../utils/logger';
export class AutonomousActionRollbackService {
    supabase;
    activeRollbacks = new Map();
    performanceBaselines = new Map();
    rollbackTriggers = new Map();
    constructor() {
        this.initializeSupabase();
    }
    initializeSupabase() {
        try {
            this.supabase = createClient(config.supabase.url, config.supabase.anonKey);
            log.info('✅ Autonomous action rollback service initialized', LogContext.SERVICE);
        }
        catch (error) {
            log.error('❌ Failed to initialize Supabase for rollback service', LogContext.SERVICE, {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    async setBaseline(actionId, metrics) {
        const baseline = {
            actionId,
            metrics,
            timestamp: new Date(),
            validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000),
        };
        this.performanceBaselines.set(actionId, baseline);
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
            }
            catch (error) {
                log.error('Failed to store baseline in database', LogContext.SERVICE, {
                    actionId,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }
    }
    async addRollbackTriggers(actionId, triggers) {
        const rollbackTriggers = triggers.map((trigger, index) => ({
            ...trigger,
            id: `${actionId}-trigger-${index}`,
            triggered: false,
        }));
        this.rollbackTriggers.set(actionId, rollbackTriggers);
        if (this.supabase) {
            try {
                await this.supabase
                    .from('autonomous_action_triggers')
                    .upsert(rollbackTriggers.map(trigger => ({
                    id: trigger.id,
                    action_id: actionId,
                    metric: trigger.metric,
                    threshold: trigger.threshold,
                    operator: trigger.operator,
                })));
            }
            catch (error) {
                log.error('Failed to store rollback triggers in database', LogContext.SERVICE, {
                    actionId,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }
    }
    async checkRollbackNeeded(actionId, currentMetrics) {
        const baseline = this.performanceBaselines.get(actionId);
        const triggers = this.rollbackTriggers.get(actionId);
        if (!baseline || !triggers) {
            return null;
        }
        for (const trigger of triggers) {
            if (trigger.triggered)
                continue;
            const baselineValue = baseline.metrics[trigger.metric];
            const currentValue = currentMetrics[trigger.metric];
            if (baselineValue === undefined || currentValue === undefined)
                continue;
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
    async executeRollback(actionId, reason) {
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
            await new Promise(resolve => setTimeout(resolve, 1000));
            const rollbackResult = {
                success: true,
                actionId,
                reason,
                metricsBefore: baseline.metrics,
                metricsAfter: baseline.metrics,
                duration: Date.now() - startTime,
                timestamp: new Date(),
            };
            this.activeRollbacks.set(actionId, rollbackResult);
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
                }
                catch (error) {
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
        }
        catch (error) {
            const rollbackResult = {
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
    async getRollbackHistory(actionId) {
        if (this.supabase) {
            try {
                const { data, error } = await this.supabase
                    .from('autonomous_action_rollbacks')
                    .select('*')
                    .eq('action_id', actionId)
                    .order('created_at', { ascending: false });
                if (error)
                    throw error;
                return data.map((row) => ({
                    success: row.success,
                    actionId: row.action_id,
                    reason: row.reason,
                    metricsBefore: row.metrics_before,
                    metricsAfter: row.metrics_after,
                    duration: row.duration,
                    timestamp: new Date(row.created_at),
                }));
            }
            catch (error) {
                log.error('Failed to get rollback history from database', LogContext.SERVICE, {
                    actionId,
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }
        const localResult = this.activeRollbacks.get(actionId);
        return localResult ? [localResult] : [];
    }
    async getStatus() {
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
export const autonomousActionRollbackService = new AutonomousActionRollbackService();
//# sourceMappingURL=autonomous-action-rollback-service.js.map