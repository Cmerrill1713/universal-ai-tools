import { createClient } from '@supabase/supabase-js';
import { TaskType } from '@/types';
import { config } from '../config/environment';
import { log, LogContext } from '../utils/logger';
import { feedbackIntegrationService } from './feedback-integration-service';
import { mlParameterOptimizer } from './ml-parameter-optimizer';
import { parameterAnalyticsService } from './parameter-analytics-service';
export class AutonomousActionLoopService {
    supabase;
    actionQueue = [];
    activeActions = new Map();
    implementationHistory = [];
    policy = {
        enabled: false,
        maxActionsPerHour: 5,
        maxConcurrentActions: 2,
        riskThresholds: {
            low: { minConfidence: 0.85, autoApprove: true },
            medium: { minConfidence: 0.9, autoApprove: false },
            high: { minConfidence: 0.95, autoApprove: false }
        },
        cooldownPeriods: {
            afterRollback: 3600000,
            betweenSimilarActions: 1800000
        },
        safeguards: {
            maxParameterChange: 0.2,
            requireUserApprovalFor: ['model_switch', 'feature_toggle'],
            emergencyStop: false
        }
    };
    riskAssessmentCache = new Map();
    isProcessing = false;
    lastInsightCollection = new Date();
    actionMetrics = {
        totalActions: 0,
        successfulActions: 0,
        rolledBackActions: 0,
        averageImprovement: 0
    };
    constructor() {
        this.initializeSupabase();
        this.initializePolicy();
        this.startAutonomousLoop();
        log.info('🤖 Autonomous Action Loop Service initialized', LogContext.AI, {
            enabled: this.policy.enabled,
            maxActionsPerHour: this.policy.maxActionsPerHour
        });
    }
    initializeSupabase() {
        try {
            if (!config.supabase.url || !config.supabase.serviceKey) {
                throw new Error('Supabase configuration missing for Autonomous Action Loop');
            }
            this.supabase = createClient(config.supabase.url, config.supabase.serviceKey);
            log.info('✅ Autonomous Action Loop connected to Supabase', LogContext.AI);
        }
        catch (error) {
            log.error('❌ Failed to initialize Autonomous Action Loop Service', LogContext.AI, {
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }
    initializePolicy() {
        this.policy = {
            enabled: process.env.ENABLE_AUTONOMOUS_ACTIONS === 'true',
            maxActionsPerHour: parseInt(process.env.MAX_AUTONOMOUS_ACTIONS_PER_HOUR || '5'),
            maxConcurrentActions: parseInt(process.env.MAX_CONCURRENT_AUTONOMOUS_ACTIONS || '2'),
            riskThresholds: {
                low: {
                    minConfidence: parseFloat(process.env.LOW_RISK_MIN_CONFIDENCE || '0.85'),
                    autoApprove: true
                },
                medium: {
                    minConfidence: parseFloat(process.env.MEDIUM_RISK_MIN_CONFIDENCE || '0.9'),
                    autoApprove: process.env.AUTO_APPROVE_MEDIUM_RISK === 'true'
                },
                high: {
                    minConfidence: parseFloat(process.env.HIGH_RISK_MIN_CONFIDENCE || '0.95'),
                    autoApprove: false
                }
            },
            cooldownPeriods: {
                afterRollback: parseInt(process.env.ROLLBACK_COOLDOWN_MS || '3600000'),
                betweenSimilarActions: parseInt(process.env.SIMILAR_ACTION_COOLDOWN_MS || '1800000')
            },
            safeguards: {
                maxParameterChange: parseFloat(process.env.MAX_PARAMETER_CHANGE_PERCENT || '20') / 100,
                requireUserApprovalFor: (process.env.REQUIRE_APPROVAL_FOR || 'model_switch,feature_toggle').split(','),
                emergencyStop: false
            }
        };
    }
    async startAutonomousLoop() {
        if (!this.policy.enabled) {
            log.info('🚫 Autonomous Action Loop disabled in configuration', LogContext.AI);
            return;
        }
        setInterval(async () => {
            if (this.isProcessing || this.policy.safeguards.emergencyStop) {
                return;
            }
            this.isProcessing = true;
            try {
                await this.collectAndProcessInsights();
                await this.processActionQueue();
                await this.monitorActiveActions();
            }
            catch (error) {
                log.error('❌ Error in autonomous action loop', LogContext.AI, { error });
            }
            finally {
                this.isProcessing = false;
            }
        }, 15 * 60 * 1000);
        log.info('🔄 Autonomous action loop started', LogContext.AI);
    }
    async collectAndProcessInsights() {
        log.info('🧠 Collecting insights from learning systems', LogContext.AI);
        const insights = await this.gatherAllInsights();
        const potentialActions = [];
        for (const insight of insights.feedbackInsights) {
            const actions = await this.generateActionsFromFeedback(insight);
            potentialActions.push(...actions);
        }
        for (const insight of insights.optimizationInsights) {
            const actions = await this.generateActionsFromOptimization(insight);
            potentialActions.push(...actions);
        }
        for (const signal of insights.learningSignals) {
            const actions = await this.generateActionsFromSignal(signal);
            potentialActions.push(...actions);
        }
        const assessedActions = await Promise.all(potentialActions.map(action => this.assessActionRisk(action)));
        const approvedActions = assessedActions.filter(action => this.shouldAutoImplement(action));
        for (const action of approvedActions) {
            await this.enqueueAction(action);
        }
        log.info('📝 Generated autonomous actions', LogContext.AI, {
            totalInsights: insights.feedbackInsights.length + insights.optimizationInsights.length + insights.learningSignals.length,
            potentialActions: potentialActions.length,
            approvedActions: approvedActions.length
        });
    }
    async gatherAllInsights() {
        try {
            const [feedbackInsights, learningSignals] = await Promise.all([
                feedbackIntegrationService.generateFeedbackInsights(),
                feedbackIntegrationService.getLearningSignals()
            ]);
            const optimizationInsights = await mlParameterOptimizer.getOptimizationInsights();
            const parameterEffectiveness = [];
            for (const taskType of Object.values(TaskType)) {
                const effectiveness = await parameterAnalyticsService.getParameterEffectiveness(taskType);
                parameterEffectiveness.push(...effectiveness);
            }
            return {
                feedbackInsights,
                optimizationInsights,
                learningSignals,
                parameterEffectiveness
            };
        }
        catch (error) {
            log.error('❌ Failed to gather insights', LogContext.AI, { error });
            return { feedbackInsights: [], optimizationInsights: [], learningSignals: [], parameterEffectiveness: [] };
        }
    }
    async generateActionsFromFeedback(insight) {
        const actions = [];
        if (insight.type === 'parameter_adjustment' && insight.confidence > 0.7) {
            const parameterMatch = insight.recommendation.match(/(\w+):\s*([0-9.]+)/g);
            if (parameterMatch && insight.taskType) {
                for (const match of parameterMatch) {
                    const [param, value] = match.split(':').map(s => s.trim());
                    actions.push({
                        id: this.generateActionId(),
                        type: 'parameter_adjustment',
                        priority: insight.priority,
                        target: {
                            service: 'intelligent-parameter-service',
                            component: 'task-profiles',
                            property: param || 'unknown',
                            taskType: insight.taskType || 'unknown'
                        },
                        change: {
                            from: null,
                            to: parseFloat(value || '0'),
                            rationale: insight.insight || 'No rationale provided'
                        },
                        assessment: {
                            riskLevel: 'low',
                            confidenceScore: insight.confidence,
                            expectedImpact: insight.estimatedImprovement / 100,
                            implementationComplexity: 'simple',
                            reversibilityScore: 0.95
                        },
                        evidence: {
                            sources: [`feedback-insight-${insight.taskType}`],
                            supportingData: insight.supportingFeedbacks,
                            historicalPerformance: { affectedUsers: insight.affectedUsers },
                            userImpact: {
                                affectedUsers: insight.affectedUsers,
                                potentialBenefit: `${insight.estimatedImprovement}% improvement in user satisfaction`
                            }
                        },
                        execution: {
                            method: 'gradual_rollout',
                            rollbackTriggers: [
                                { metric: 'user_satisfaction', threshold: -0.1, operator: 'lt' },
                                { metric: 'error_rate', threshold: 0.05, operator: 'gt' }
                            ],
                            monitoringPeriod: 24 * 60 * 60 * 1000,
                            successCriteria: [
                                { metric: 'user_satisfaction', improvementTarget: insight.estimatedImprovement / 100 }
                            ]
                        },
                        createdAt: new Date(),
                        status: 'pending'
                    });
                }
            }
        }
        return actions;
    }
    async generateActionsFromOptimization(insight) {
        const actions = [];
        if (insight.confidence > 0.8 && insight.supportingData.improvementPercent > 10) {
            const parameterMatches = insight.recommendation.match(/(temp|tokens)=([0-9.]+)/g);
            if (parameterMatches && insight.taskType) {
                for (const match of parameterMatches) {
                    const [param, value] = match.split('=');
                    const propertyName = param === 'temp' ? 'temperature' : 'maxTokens';
                    actions.push({
                        id: this.generateActionId(),
                        type: 'parameter_adjustment',
                        priority: insight.impact === 'high' ? 'high' : insight.impact === 'medium' ? 'medium' : 'low',
                        target: {
                            service: 'intelligent-parameter-service',
                            component: 'task-profiles',
                            property: propertyName,
                            taskType: insight.taskType
                        },
                        change: {
                            from: null,
                            to: parseFloat(value || '0'),
                            rationale: `ML optimization discovered ${insight.supportingData.improvementPercent}% improvement`
                        },
                        assessment: {
                            riskLevel: 'low',
                            confidenceScore: insight.confidence,
                            expectedImpact: insight.supportingData.improvementPercent / 100,
                            implementationComplexity: 'simple',
                            reversibilityScore: 0.95
                        },
                        evidence: {
                            sources: [`ml-optimization-${insight.taskType}`],
                            supportingData: [insight.supportingData],
                            historicalPerformance: {
                                sampleSize: insight.supportingData.sampleSize,
                                currentMetric: insight.supportingData.currentMetric,
                                optimizedMetric: insight.supportingData.optimizedMetric
                            },
                            userImpact: {
                                affectedUsers: Math.floor(insight.supportingData.sampleSize * 10),
                                potentialBenefit: `${insight.supportingData.improvementPercent}% performance improvement`
                            }
                        },
                        execution: {
                            method: 'ab_test',
                            rollbackTriggers: [
                                { metric: 'performance_score', threshold: -0.05, operator: 'lt' },
                                { metric: 'response_time', threshold: 1.2, operator: 'gt' }
                            ],
                            monitoringPeriod: 48 * 60 * 60 * 1000,
                            successCriteria: [
                                { metric: 'performance_score', improvementTarget: insight.supportingData.improvementPercent / 100 }
                            ]
                        },
                        createdAt: new Date(),
                        status: 'pending'
                    });
                }
            }
        }
        return actions;
    }
    async generateActionsFromSignal(signal) {
        const actions = [];
        if (signal.strength > 0.8) {
            let changeValue;
            const currentValue = 0.5;
            switch (signal.recommendedAction) {
                case 'increase':
                    changeValue = Math.min(1.0, currentValue * 1.1);
                    break;
                case 'decrease':
                    changeValue = Math.max(0.1, currentValue * 0.9);
                    break;
                case 'maintain':
                    return [];
                case 'experiment':
                    changeValue = currentValue + (Math.random() - 0.5) * 0.2;
                    break;
                default:
                    return [];
            }
            actions.push({
                id: this.generateActionId(),
                type: 'parameter_adjustment',
                priority: 'medium',
                target: {
                    service: 'intelligent-parameter-service',
                    component: 'task-profiles',
                    property: signal.parameterAffected,
                    taskType: signal.taskType
                },
                change: {
                    from: null,
                    to: changeValue,
                    rationale: signal.signal
                },
                assessment: {
                    riskLevel: 'low',
                    confidenceScore: signal.strength,
                    expectedImpact: signal.strength * 0.1,
                    implementationComplexity: 'simple',
                    reversibilityScore: 0.95
                },
                evidence: {
                    sources: [`learning-signal-${signal.source}`],
                    supportingData: signal.evidence,
                    historicalPerformance: {},
                    userImpact: {
                        affectedUsers: 50,
                        potentialBenefit: `Addressing ${signal.signal}`
                    }
                },
                execution: {
                    method: 'gradual_rollout',
                    rollbackTriggers: [
                        { metric: 'user_satisfaction', threshold: -0.05, operator: 'lt' }
                    ],
                    monitoringPeriod: 12 * 60 * 60 * 1000,
                    successCriteria: [
                        { metric: 'user_satisfaction', improvementTarget: 0.05 }
                    ]
                },
                createdAt: new Date(),
                status: 'pending'
            });
        }
        return actions;
    }
    async assessActionRisk(action) {
        const currentValue = await this.getCurrentParameterValue(action.target);
        action.change.from = currentValue;
        const changeMagnitude = Math.abs((action.change.to - currentValue) / currentValue);
        let riskScore = 0;
        if (changeMagnitude > this.policy.safeguards.maxParameterChange) {
            riskScore += 0.4;
        }
        else if (changeMagnitude > this.policy.safeguards.maxParameterChange * 0.5) {
            riskScore += 0.2;
        }
        if (action.evidence.userImpact.affectedUsers > 1000) {
            riskScore += 0.3;
        }
        else if (action.evidence.userImpact.affectedUsers > 100) {
            riskScore += 0.1;
        }
        const complexityRisk = { simple: 0, moderate: 0.1, complex: 0.3 };
        riskScore += complexityRisk[action.assessment.implementationComplexity];
        riskScore += (1 - action.assessment.confidenceScore) * 0.2;
        if (riskScore < 0.3) {
            action.assessment.riskLevel = 'low';
        }
        else if (riskScore < 0.6) {
            action.assessment.riskLevel = 'medium';
        }
        else {
            action.assessment.riskLevel = 'high';
        }
        this.riskAssessmentCache.set(action.id, riskScore);
        return action;
    }
    shouldAutoImplement(action) {
        const threshold = this.policy.riskThresholds[action.assessment.riskLevel];
        if (action.assessment.confidenceScore < threshold.minConfidence) {
            return false;
        }
        if (!threshold.autoApprove) {
            return false;
        }
        if (this.policy.safeguards.requireUserApprovalFor.includes(action.type)) {
            return false;
        }
        if (this.isInCooldownPeriod(action)) {
            return false;
        }
        if (!this.isWithinRateLimit()) {
            return false;
        }
        return true;
    }
    async enqueueAction(action) {
        this.actionQueue.push(action);
        await this.supabase.from('autonomous_actions').insert({
            id: action.id,
            type: action.type,
            priority: action.priority,
            target: action.target,
            change: action.change,
            assessment: action.assessment,
            evidence: action.evidence,
            execution: action.execution,
            status: action.status,
            created_at: action.createdAt.toISOString()
        });
        log.info('📥 Enqueued autonomous action', LogContext.AI, {
            actionId: action.id,
            type: action.type,
            riskLevel: action.assessment.riskLevel,
            confidence: action.assessment.confidenceScore
        });
    }
    async processActionQueue() {
        if (this.actionQueue.length === 0)
            return;
        this.actionQueue.sort((a, b) => {
            const priorityWeight = { critical: 4, high: 3, medium: 2, low: 1 };
            const aScore = priorityWeight[a.priority] * a.assessment.confidenceScore;
            const bScore = priorityWeight[b.priority] * b.assessment.confidenceScore;
            return bScore - aScore;
        });
        const actionsToProcess = this.actionQueue.splice(0, Math.min(this.policy.maxConcurrentActions - this.activeActions.size, this.actionQueue.length));
        for (const action of actionsToProcess) {
            await this.implementAction(action);
        }
    }
    async implementAction(action) {
        log.info('🚀 Implementing autonomous action', LogContext.AI, {
            actionId: action.id,
            type: action.type,
            target: action.target
        });
        action.status = 'implementing';
        action.implementedAt = new Date();
        this.activeActions.set(action.id, action);
        try {
            const beforeMetrics = await this.captureMetrics(action);
            await this.executeChange(action);
            this.startActionMonitoring(action, beforeMetrics);
            action.status = 'active';
            this.actionMetrics.totalActions++;
            log.info('✅ Action implementation started', LogContext.AI, {
                actionId: action.id,
                monitoringPeriod: action.execution.monitoringPeriod
            });
        }
        catch (error) {
            log.error('❌ Failed to implement action', LogContext.AI, {
                actionId: action.id,
                error
            });
            action.status = 'rolled_back';
            action.implementationResult = {
                success: false,
                metricsBeforeAfter: { before: {}, after: {}, improvement: {} },
                duration: 0,
                issues: [error instanceof Error ? error.message : String(error)],
                rollbackRequired: true,
                rollbackReason: 'Implementation failed'
            };
            this.activeActions.delete(action.id);
        }
    }
    async executeChange(action) {
        switch (action.type) {
            case 'parameter_adjustment':
                await this.adjustParameter(action);
                break;
            case 'model_switch':
                await this.switchModel(action);
                break;
            case 'prompt_optimization':
                await this.optimizePrompt(action);
                break;
            case 'configuration_update':
                await this.updateConfiguration(action);
                break;
            default:
                throw new Error(`Unknown action type: ${action.type}`);
        }
    }
    async adjustParameter(action) {
        log.info('🔧 Adjusting parameter', LogContext.AI, {
            service: action.target.service,
            property: action.target.property,
            from: action.change.from,
            to: action.change.to,
            taskType: action.target.taskType
        });
    }
    async switchModel(action) {
        log.info('🔄 Switching model', LogContext.AI, {
            from: action.change.from,
            to: action.change.to,
            rationale: action.change.rationale
        });
    }
    async optimizePrompt(action) {
        log.info('📝 Optimizing prompt', LogContext.AI, {
            target: action.target,
            change: action.change
        });
    }
    async updateConfiguration(action) {
        log.info('⚙️ Updating configuration', LogContext.AI, {
            component: action.target.component,
            property: action.target.property,
            change: action.change
        });
    }
    startActionMonitoring(action, beforeMetrics) {
        setTimeout(async () => {
            await this.evaluateActionResults(action, beforeMetrics);
        }, action.execution.monitoringPeriod);
    }
    async evaluateActionResults(action, beforeMetrics) {
        log.info('📊 Evaluating action results', LogContext.AI, {
            actionId: action.id,
            monitoringComplete: true
        });
        try {
            const afterMetrics = await this.captureMetrics(action);
            const improvement = this.calculateImprovement(beforeMetrics, afterMetrics);
            let shouldRollback = false;
            let rollbackReason = '';
            for (const trigger of action.execution.rollbackTriggers) {
                const currentValue = afterMetrics[trigger.metric] || 0;
                const baselineValue = beforeMetrics[trigger.metric] || 0;
                const changeValue = currentValue - baselineValue;
                if (this.triggerConditionMet(changeValue, trigger)) {
                    shouldRollback = true;
                    rollbackReason = `${trigger.metric} trigger: ${changeValue} ${trigger.operator} ${trigger.threshold}`;
                    break;
                }
            }
            let successCriteriaMet = true;
            for (const criteria of action.execution.successCriteria) {
                const improvementValue = improvement[criteria.metric] || 0;
                if (improvementValue < criteria.improvementTarget) {
                    successCriteriaMet = false;
                    break;
                }
            }
            const implementationResult = {
                success: !shouldRollback && successCriteriaMet,
                metricsBeforeAfter: {
                    before: beforeMetrics,
                    after: afterMetrics,
                    improvement
                },
                duration: action.execution.monitoringPeriod,
                issues: shouldRollback ? [rollbackReason] : [],
                rollbackRequired: shouldRollback,
                rollbackReason: shouldRollback ? rollbackReason : undefined
            };
            action.implementationResult = implementationResult;
            if (shouldRollback) {
                await this.rollbackAction(action, rollbackReason);
            }
            else {
                action.status = 'completed';
                this.actionMetrics.successfulActions++;
                this.actionMetrics.averageImprovement =
                    (this.actionMetrics.averageImprovement * (this.actionMetrics.successfulActions - 1) +
                        Object.values(improvement).reduce((sum, val) => sum + val, 0) / Object.keys(improvement).length) /
                        this.actionMetrics.successfulActions;
                log.info('🎉 Action completed successfully', LogContext.AI, {
                    actionId: action.id,
                    improvement
                });
            }
            this.activeActions.delete(action.id);
            this.implementationHistory.push(implementationResult);
            await this.learnFromImplementation(action, implementationResult);
        }
        catch (error) {
            log.error('❌ Error evaluating action results', LogContext.AI, {
                actionId: action.id,
                error
            });
            await this.rollbackAction(action, 'Evaluation failed');
        }
    }
    async rollbackAction(action, reason) {
        log.warn('🔄 Rolling back action', LogContext.AI, {
            actionId: action.id,
            reason
        });
        try {
            const rollbackAction = {
                ...action,
                change: {
                    from: action.change.to,
                    to: action.change.from,
                    rationale: `Rollback: ${reason}`
                }
            };
            await this.executeChange(rollbackAction);
            action.status = 'rolled_back';
            this.actionMetrics.rolledBackActions++;
            log.info('✅ Action rolled back successfully', LogContext.AI, {
                actionId: action.id
            });
        }
        catch (error) {
            log.error('❌ Failed to rollback action', LogContext.AI, {
                actionId: action.id,
                error
            });
        }
    }
    async learnFromImplementation(action, result) {
        const learningData = {
            actionType: action.type,
            riskLevel: action.assessment.riskLevel,
            confidenceScore: action.assessment.confidenceScore,
            expectedImpact: action.assessment.expectedImpact,
            actualSuccess: result.success,
            actualImprovement: Object.values(result.metricsBeforeAfter.improvement).reduce((sum, val) => sum + val, 0) / Object.keys(result.metricsBeforeAfter.improvement).length,
            rollbackRequired: result.rollbackRequired
        };
        await this.supabase.from('autonomous_learning').insert({
            action_id: action.id,
            learning_data: learningData,
            timestamp: new Date().toISOString()
        });
        this.adjustRiskAssessmentModel(learningData);
    }
    adjustRiskAssessmentModel(learningData) {
        log.debug('🧠 Learning from implementation', LogContext.AI, {
            actionType: learningData.actionType,
            predicted: learningData.expectedImpact,
            actual: learningData.actualImprovement,
            success: learningData.actualSuccess
        });
    }
    async monitorActiveActions() {
        for (const [actionId, action] of this.activeActions.entries()) {
            const timeSinceImplementation = Date.now() - (action.implementedAt?.getTime() || 0);
            if (timeSinceImplementation > action.execution.monitoringPeriod * 0.5) {
                const currentMetrics = await this.captureMetrics(action);
                for (const trigger of action.execution.rollbackTriggers) {
                    if (trigger.metric === 'error_rate' && (currentMetrics[trigger.metric] || 0) > trigger.threshold) {
                        log.warn('🚨 Emergency rollback triggered', LogContext.AI, {
                            actionId,
                            metric: trigger.metric,
                            value: currentMetrics[trigger.metric],
                            threshold: trigger.threshold
                        });
                        await this.rollbackAction(action, `Emergency rollback: ${trigger.metric} exceeded threshold`);
                        break;
                    }
                }
            }
        }
    }
    async getCurrentParameterValue(target) {
        return 0.5;
    }
    async captureMetrics(action) {
        return {
            user_satisfaction: 4.2,
            performance_score: 0.85,
            response_time: 1500,
            error_rate: 0.02
        };
    }
    calculateImprovement(before, after) {
        const improvement = {};
        for (const metric in before) {
            if (metric in after) {
                const beforeVal = before[metric] || 0;
                const afterVal = after[metric] || 0;
                improvement[metric] = beforeVal !== 0 ? (afterVal - beforeVal) / beforeVal : 0;
            }
        }
        return improvement;
    }
    triggerConditionMet(value, trigger) {
        switch (trigger.operator) {
            case 'lt': return value < trigger.threshold;
            case 'gt': return value > trigger.threshold;
            case 'eq': return Math.abs(value - trigger.threshold) < 0.001;
            default: return false;
        }
    }
    isInCooldownPeriod(action) {
        const now = Date.now();
        for (const result of this.implementationHistory.slice(-10)) {
            if (result.rollbackRequired) {
                const timeSinceRollback = now - (result.duration || 0);
                if (timeSinceRollback < this.policy.cooldownPeriods.afterRollback) {
                    return true;
                }
            }
        }
        const recentSimilarActions = this.implementationHistory
            .filter(r => r.success && (now - (r.duration || 0)) < this.policy.cooldownPeriods.betweenSimilarActions)
            .length;
        return recentSimilarActions > 0;
    }
    isWithinRateLimit() {
        const hourAgo = Date.now() - 60 * 60 * 1000;
        const recentActions = this.implementationHistory.filter(r => (r.duration || 0) > hourAgo).length;
        return recentActions < this.policy.maxActionsPerHour;
    }
    generateActionId() {
        return `auto_action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    async queueAction(action) {
        await this.enqueueAction(action);
    }
    async getActionStatus() {
        return {
            activeActions: this.activeActions.size,
            queuedActions: this.actionQueue.length,
            metrics: this.actionMetrics,
            policy: this.policy
        };
    }
    async pauseAutonomousActions() {
        this.policy.safeguards.emergencyStop = true;
        log.info('⏸️ Autonomous actions paused', LogContext.AI);
    }
    async resumeAutonomousActions() {
        this.policy.safeguards.emergencyStop = false;
        log.info('▶️ Autonomous actions resumed', LogContext.AI);
    }
    async getActionHistory(limit = 20) {
        const { data, error } = await this.supabase
            .from('autonomous_actions')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);
        if (error) {
            log.error('❌ Failed to fetch action history', LogContext.AI, { error });
            return [];
        }
        return data || [];
    }
}
export const autonomousActionLoopService = new AutonomousActionLoopService();
export default autonomousActionLoopService;
//# sourceMappingURL=autonomous-action-loop-service.js.map