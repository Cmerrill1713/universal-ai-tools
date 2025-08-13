import { createClient } from '@supabase/supabase-js';
import { TaskType } from '@/types';
import { config } from '../config/environment';
import { BayesianModel } from '../utils/bayesian-model';
import { TWO } from '../utils/constants';
import { log, LogContext } from '../utils/logger';
import { ThompsonSelector } from '../utils/thompson-sampling';
import { autonomousActionLoopService } from './autonomous-action-loop-service';
import { parameterAnalyticsService } from './parameter-analytics-service';
export class MLParameterOptimizer {
    supabase;
    experiments = new Map();
    bayesianModels = new Map();
    thompsonSelector;
    parameterSpaces = new Map();
    optimizationStrategies = [];
    learningRate = 0.01;
    explorationRate = 0.1;
    convergenceThreshold = 0.05;
    constructor() {
        this.thompsonSelector = new ThompsonSelector();
        this.initializeSupabase();
        this.initializeOptimizers();
        this.setupParameterSpaces();
        this.defineOptimizationStrategies();
        this.startPeriodicOptimization();
    }
    initializeSupabase() {
        try {
            if (!config.supabase.url || !config.supabase.serviceKey) {
                throw new Error('Supabase configuration missing for ML Parameter Optimizer');
            }
            this.supabase = createClient(config.supabase.url, config.supabase.serviceKey);
            log.info('✅ ML Parameter Optimizer initialized with Supabase', LogContext.AI);
        }
        catch (error) {
            log.error('❌ Failed to initialize ML Parameter Optimizer', LogContext.AI, {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    initializeOptimizers() {
        this.thompsonSelector = new ThompsonSelector();
        log.info('🧠 Initialized ML optimizers (Bayesian + Thompson Sampling)', LogContext.AI);
    }
    setupParameterSpaces() {
        const defaultSpace = {
            temperature: { min: 0.1, max: 1.0, type: 'continuous' },
            maxTokens: { min: 50, max: 4000, type: 'discrete' },
            topP: { min: 0.1, max: 1.0, type: 'continuous' },
            frequencyPenalty: { min: 0.0, max: 2.0, type: 'continuous' },
            presencePenalty: { min: 0.0, max: 2.0, type: 'continuous' },
        };
        this.parameterSpaces.set(TaskType.CREATIVE_WRITING, {
            ...defaultSpace,
            temperature: { min: 0.7, max: 1.2, type: 'continuous' },
            maxTokens: { min: 500, max: 8000, type: 'discrete' },
        });
        this.parameterSpaces.set(TaskType.CODE_GENERATION, {
            ...defaultSpace,
            temperature: { min: 0.1, max: 0.5, type: 'continuous' },
            maxTokens: { min: 100, max: 2000, type: 'discrete' },
        });
        this.parameterSpaces.set(TaskType.DATA_ANALYSIS, {
            ...defaultSpace,
            temperature: { min: 0.2, max: 0.8, type: 'continuous' },
            maxTokens: { min: 200, max: 3000, type: 'discrete' },
        });
        Object.values(TaskType).forEach((taskType) => {
            if (!this.parameterSpaces.has(taskType)) {
                this.parameterSpaces.set(taskType, defaultSpace);
            }
        });
    }
    defineOptimizationStrategies() {
        this.optimizationStrategies = [
            {
                name: 'exploration_heavy',
                description: 'High exploration for new task types with limited data',
                suitableFor: [TaskType.RESEARCH, TaskType.BRAINSTORMING, TaskType.CREATIVE_WRITING],
                hyperparameters: { exploration_rate: 0.3, learning_rate: 0.02 },
            },
            {
                name: 'exploitation_focused',
                description: 'Focus on known good parameters for production tasks',
                suitableFor: [TaskType.CODE_GENERATION, TaskType.CODE_REVIEW, TaskType.CODE_EXPLANATION],
                hyperparameters: { exploration_rate: 0.05, learning_rate: 0.005 },
            },
            {
                name: 'balanced_learning',
                description: 'Balanced exploration-exploitation for general tasks',
                suitableFor: [TaskType.FACTUAL_QA, TaskType.SUMMARIZATION, TaskType.DATA_ANALYSIS],
                hyperparameters: { exploration_rate: 0.1, learning_rate: 0.01 },
            },
        ];
    }
    async getOptimizedParameters(taskType, context, userPreferences) {
        try {
            const startTime = Date.now();
            const historicalData = await parameterAnalyticsService.getParameterEffectiveness(taskType);
            if (historicalData.length < 5) {
                return this.getHeuristicPrediction(taskType, context, userPreferences);
            }
            const experiment = await this.getOrCreateExperiment(taskType);
            const model = this.getOrCreateBayesianModel(taskType);
            const modelPrediction = model.predict(context);
            const predictedParameters = this.generateParametersFromPrediction(taskType, modelPrediction, experiment);
            if (userPreferences) {
                this.applyUserPreferences(predictedParameters, userPreferences);
            }
            const confidenceScore = this.calculateConfidence(experiment, historicalData.length);
            const expectedPerformance = modelPrediction.expectedReward;
            const prediction = {
                taskType,
                predictedParameters,
                confidenceScore,
                expectedPerformance,
                uncertaintyBounds: {
                    lower: Math.max(0, expectedPerformance - 0.1),
                    upper: Math.min(1, expectedPerformance + 0.1),
                },
                recommendationStrength: this.getRecommendationStrength(confidenceScore, historicalData.length),
            };
            log.debug('🎯 ML parameter optimization completed', LogContext.AI, {
                taskType,
                optimizationTime: Date.now() - startTime,
                confidence: confidenceScore,
                dataPoints: historicalData.length,
            });
            return prediction;
        }
        catch (error) {
            log.error('❌ ML parameter optimization failed', LogContext.AI, { error });
            return this.getHeuristicPrediction(taskType, context, userPreferences);
        }
    }
    async learnFromExecution(taskType, parameters, score, executionTime, contextMetadata = {}) {
        try {
            const experiment = await this.getOrCreateExperiment(taskType);
            const trial = {
                id: this.generateTrialId(),
                parameters,
                score,
                executionTime,
                timestamp: new Date(),
                contextMetadata,
            };
            experiment.trials.push(trial);
            experiment.lastUpdate = new Date();
            const model = this.getOrCreateBayesianModel(taskType);
            model.update({
                timestamp: Date.now(),
                success: score > 0.7,
                executionTime,
                resourceUsage: contextMetadata.resourceUsage || 1000,
                reward: score,
                context: contextMetadata,
            });
            experiment.convergenceStatus = this.checkConvergence(experiment);
            if (score > this.getBestScore(experiment)) {
                experiment.bestParameters = { ...parameters };
            }
            await this.storeExperiment(experiment);
            if (experiment.trials.length % 10 === 0) {
                await this.generateOptimizationInsights(experiment);
            }
            log.debug('📚 Learned from execution', LogContext.AI, {
                taskType,
                trialCount: experiment.trials.length,
                score,
                convergenceStatus: experiment.convergenceStatus,
            });
        }
        catch (error) {
            log.error('❌ Failed to learn from execution', LogContext.AI, { error });
        }
    }
    async getOptimizationInsights(taskType) {
        try {
            const insights = [];
            const taskTypes = taskType
                ? [taskType]
                : Array.from(this.experiments.keys()).map((key) => key.split('_')[0]);
            for (const type of taskTypes) {
                const experiment = this.experiments.get(`${type}_experiment`);
                if (experiment && experiment.trials.length >= 10) {
                    const insight = await this.generateTaskTypeInsight(experiment);
                    if (insight) {
                        insights.push(insight);
                        if (insight.confidence > 0.8 && insight.supportingData?.improvementPercent > 15) {
                            await this.queueMLOptimizationAction(insight, experiment);
                        }
                    }
                }
            }
            return insights.sort((a, b) => b.confidence - a.confidence);
        }
        catch (error) {
            log.error('❌ Failed to get optimization insights', LogContext.AI, { error });
            return [];
        }
    }
    async queueMLOptimizationAction(insight, experiment) {
        try {
            const bestTrial = experiment.trials.reduce((best, current) => current.score > best.score ? current : best);
            const riskLevel = this.assessParameterChangeRisk(experiment.bestParameters, bestTrial.parameters);
            const action = {
                id: `ml_opt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                type: 'parameter_adjustment',
                priority: insight.impact === 'high' ? 'high' : 'medium',
                target: {
                    service: 'intelligent_parameter_service',
                    component: 'task_parameters',
                    taskType: experiment.taskType,
                    property: 'default_parameters',
                },
                change: {
                    from: experiment.bestParameters,
                    to: bestTrial.parameters,
                    rationale: insight.insight,
                },
                assessment: {
                    riskLevel,
                    confidenceScore: insight.confidence,
                    expectedImpact: insight.supportingData?.improvementPercent
                        ? insight.supportingData.improvementPercent / 100
                        : 0.15,
                    implementationComplexity: 'simple',
                    reversibilityScore: 0.9,
                },
                evidence: {
                    sources: [`ml-optimization-${experiment.taskType}`],
                    supportingData: [insight],
                    historicalPerformance: {
                        experimentId: experiment.id,
                        trialCount: experiment.trials.length,
                        bestTrialScore: bestTrial.score,
                        averageScore: experiment.trials.reduce((sum, t) => sum + t.score, 0) / experiment.trials.length,
                    },
                    userImpact: {
                        affectedUsers: insight.supportingData?.sampleSize || 0,
                        potentialBenefit: `${insight.supportingData?.improvementPercent || 0}% performance improvement`,
                    },
                },
                execution: {
                    method: 'gradual_rollout',
                    rollbackTriggers: [
                        { metric: 'performance_score', threshold: -0.05, operator: 'lt' },
                        { metric: 'error_rate', threshold: 0.05, operator: 'gt' },
                    ],
                    monitoringPeriod: 24 * 60 * 60 * 1000,
                    successCriteria: [
                        {
                            metric: 'performance_score',
                            improvementTarget: insight.supportingData?.improvementPercent
                                ? insight.supportingData.improvementPercent / 100
                                : 0.1,
                        },
                    ],
                },
                createdAt: new Date(),
                status: 'pending',
            };
            await autonomousActionLoopService.queueAction(action);
            log.info('🤖 Queued autonomous ML optimization action', LogContext.AI, {
                actionId: action.id,
                taskType: experiment.taskType,
                confidence: insight.confidence,
                expectedImprovement: insight.supportingData?.improvementPercent,
                riskLevel,
            });
        }
        catch (error) {
            log.error('❌ Failed to queue ML optimization action', LogContext.AI, { error });
        }
    }
    assessParameterChangeRisk(currentParams, newParams) {
        const tempChange = Math.abs((newParams.temperature || 0.5) - (currentParams.temperature || 0.5));
        const tokenChange = Math.abs((newParams.maxTokens || 1024) - (currentParams.maxTokens || 1024)) / 1024;
        const topPChange = Math.abs((newParams.topP || 0.9) - (currentParams.topP || 0.9));
        if (tempChange > 0.3 || tokenChange > 0.5 || topPChange > 0.3) {
            return 'high';
        }
        if (tempChange > 0.1 || tokenChange > 0.2 || topPChange > 0.1) {
            return 'medium';
        }
        return 'low';
    }
    async createABTest(taskType, controlParameters, testParameters, trafficSplit = 0.5) {
        try {
            const experimentId = this.generateExperimentId();
            const { error } = await this.supabase.from('parameter_experiments').insert({
                id: experimentId,
                name: `AB_Test_${taskType}_${Date.now()}`,
                description: `A/B test for ${taskType} parameter optimization`,
                task_type: taskType,
                control_parameters: controlParameters,
                test_parameters: testParameters,
                traffic_split: trafficSplit,
                status: 'running',
                start_date: new Date().toISOString(),
                created_by: 'ml_optimizer',
            });
            if (error) {
                throw new Error(`Failed to create A/B test: ${error.message}`);
            }
            log.info('🧪 Created A/B test experiment', LogContext.AI, {
                experimentId,
                taskType,
                trafficSplit,
            });
            return experimentId;
        }
        catch (error) {
            log.error('❌ Failed to create A/B test', LogContext.AI, { error });
            throw error;
        }
    }
    async getABTestResults(experimentId) {
        try {
            const { data: experiment, error } = await this.supabase
                .from('parameter_experiments')
                .select('*')
                .eq('id', experimentId)
                .single();
            if (error || !experiment) {
                throw new Error('A/B test experiment not found');
            }
            const controlSuccessRate = experiment.control_success_rate || 0;
            const testSuccessRate = experiment.test_success_rate || 0;
            const controlExecutions = experiment.control_executions || 0;
            const testExecutions = experiment.test_executions || 0;
            const performanceDiff = Math.abs(testSuccessRate - controlSuccessRate);
            const pooledSE = Math.sqrt((controlSuccessRate * (1 - controlSuccessRate)) / controlExecutions +
                (testSuccessRate * (1 - testSuccessRate)) / testExecutions);
            const statisticalSignificance = pooledSE > 0 ? performanceDiff / pooledSE : 0;
            let winner = 'inconclusive';
            if (statisticalSignificance > 1.96) {
                winner = testSuccessRate > controlSuccessRate ? 'test' : 'control';
            }
            const recommendation = this.generateABTestRecommendation(winner, controlSuccessRate, testSuccessRate, statisticalSignificance);
            return {
                winner,
                controlPerformance: controlSuccessRate,
                testPerformance: testSuccessRate,
                statisticalSignificance,
                recommendation,
            };
        }
        catch (error) {
            log.error('❌ Failed to get A/B test results', LogContext.AI, { error });
            throw error;
        }
    }
    async getOrCreateExperiment(taskType) {
        const experimentKey = `${taskType}_experiment`;
        if (this.experiments.has(experimentKey)) {
            return this.experiments.get(experimentKey);
        }
        const experiment = {
            id: this.generateExperimentId(),
            taskType,
            parameterSpace: this.parameterSpaces.get(taskType),
            trials: [],
            bestParameters: this.getInitialParameters(taskType),
            convergenceStatus: 'exploring',
            startTime: new Date(),
            lastUpdate: new Date(),
        };
        this.experiments.set(experimentKey, experiment);
        await this.storeExperiment(experiment);
        return experiment;
    }
    getHeuristicPrediction(taskType, context, userPreferences) {
        const baseParameters = this.getInitialParameters(taskType);
        if (context.complexity === 'complex') {
            baseParameters.maxTokens = Math.min(4000, baseParameters.maxTokens * 1.5);
            baseParameters.temperature = Math.max(0.1, baseParameters.temperature - 0.1);
        }
        if (userPreferences) {
            this.applyUserPreferences(baseParameters, userPreferences);
        }
        return {
            taskType,
            predictedParameters: baseParameters,
            confidenceScore: 0.3,
            expectedPerformance: 0.7,
            uncertaintyBounds: { lower: 0.5, upper: 0.9 },
            recommendationStrength: 'weak',
        };
    }
    applyUserPreferences(parameters, preferences) {
        if (preferences.creativity === 'creative') {
            parameters.temperature = Math.min(1.0, parameters.temperature + 0.2);
        }
        else if (preferences.creativity === 'conservative') {
            parameters.temperature = Math.max(0.1, parameters.temperature - 0.2);
        }
        if (preferences.preferredLength === 'comprehensive') {
            parameters.maxTokens = Math.round(parameters.maxTokens * 1.5);
        }
        else if (preferences.preferredLength === 'concise') {
            parameters.maxTokens = Math.round(parameters.maxTokens * 0.7);
        }
    }
    calculateConfidence(experiment, dataPoints) {
        const baseConfidence = Math.min(0.95, dataPoints / 100);
        const convergenceBonus = experiment.convergenceStatus === 'converged' ? 0.1 : 0;
        const trialBonus = Math.min(0.2, experiment.trials.length / 50);
        return Math.min(0.95, baseConfidence + convergenceBonus + trialBonus);
    }
    getRecommendationStrength(confidence, dataPoints) {
        if (confidence > 0.8 && dataPoints > 50)
            return 'strong';
        if (confidence > 0.6 && dataPoints > 20)
            return 'moderate';
        return 'weak';
    }
    checkConvergence(experiment) {
        if (experiment.trials.length < 20)
            return 'exploring';
        const recentTrials = experiment.trials.slice(-10);
        const scoreVariance = this.calculateVariance(recentTrials.map((t) => t.score));
        if (scoreVariance < this.convergenceThreshold) {
            return 'converged';
        }
        else if (scoreVariance < this.convergenceThreshold * TWO) {
            return 'converging';
        }
        return 'exploring';
    }
    calculateVariance(scores) {
        const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
        const squaredDiffs = scores.map((score) => Math.pow(score - mean, TWO));
        return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / scores.length;
    }
    getBestScore(experiment) {
        if (experiment.trials.length === 0)
            return 0;
        return Math.max(...experiment.trials.map((t) => t.score));
    }
    async storeExperiment(experiment) {
        try {
            const { error } = await this.supabase.from('parameter_insights').upsert({
                id: experiment.id,
                task_type: experiment.taskType,
                insight: `ML optimization experiment with ${experiment.trials.length} trials`,
                recommendation: `Best parameters: ${JSON.stringify(experiment.bestParameters)}`,
                impact: experiment.convergenceStatus === 'converged' ? 'high' : 'medium',
                confidence: this.calculateConfidence(experiment, experiment.trials.length),
                sample_size: experiment.trials.length,
                improvement_percent: this.calculateImprovement(experiment),
                current_metric: this.getBestScore(experiment),
                optimized_metric: this.getBestScore(experiment),
                status: 'active',
            });
            if (error) {
                log.error('Failed to store experiment', LogContext.AI, { error });
            }
        }
        catch (error) {
            log.error('Error storing experiment', LogContext.AI, { error });
        }
    }
    async generateOptimizationInsights(experiment) {
        const bestTrial = experiment.trials.reduce((best, current) => current.score > best.score ? current : best);
        const averageScore = experiment.trials.reduce((sum, trial) => sum + trial.score, 0) / experiment.trials.length;
        const improvement = ((bestTrial.score - averageScore) / averageScore) * 100;
        if (improvement > 10) {
            const insight = `ML optimization found ${improvement.toFixed(1)}% performance improvement for ${experiment.taskType}`;
            const recommendation = `Use temperature: ${bestTrial.parameters.temperature}, maxTokens: ${bestTrial.parameters.maxTokens}`;
            await this.supabase.from('parameter_insights').insert({
                task_type: experiment.taskType,
                insight,
                recommendation,
                impact: improvement > 50 ? 'high' : 'medium',
                confidence: this.calculateConfidence(experiment, experiment.trials.length),
                sample_size: experiment.trials.length,
                improvement_percent: improvement,
                current_metric: averageScore,
                optimized_metric: bestTrial.score,
                status: 'active',
            });
        }
    }
    async generateTaskTypeInsight(experiment) {
        if (experiment.trials.length < 10)
            return null;
        const bestTrial = experiment.trials.reduce((best, current) => current.score > best.score ? current : best);
        const averageScore = experiment.trials.reduce((sum, trial) => sum + trial.score, 0) / experiment.trials.length;
        const improvement = ((bestTrial.score - averageScore) / averageScore) * 100;
        if (improvement < 5)
            return null;
        return {
            taskType: experiment.taskType,
            insight: `ML optimization discovered ${improvement.toFixed(1)}% performance improvement`,
            recommendation: `Optimal parameters: temp=${bestTrial.parameters.temperature?.toFixed(2)}, tokens=${bestTrial.parameters.maxTokens}`,
            impact: improvement > 30 ? 'high' : improvement > 15 ? 'medium' : 'low',
            confidence: this.calculateConfidence(experiment, experiment.trials.length),
            supportingData: {
                sampleSize: experiment.trials.length,
                improvementPercent: improvement,
                currentMetric: averageScore,
                optimizedMetric: bestTrial.score,
            },
        };
    }
    calculateImprovement(experiment) {
        if (experiment.trials.length < TWO)
            return 0;
        const firstHalf = experiment.trials.slice(0, Math.floor(experiment.trials.length / TWO));
        const secondHalf = experiment.trials.slice(Math.floor(experiment.trials.length / TWO));
        const firstAvg = firstHalf.reduce((sum, t) => sum + t.score, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((sum, t) => sum + t.score, 0) / secondHalf.length;
        return ((secondAvg - firstAvg) / firstAvg) * 100;
    }
    generateABTestRecommendation(winner, controlPerformance, testPerformance, significance) {
        if (winner === 'inconclusive') {
            return 'Continue testing - results are not statistically significant yet';
        }
        const improvement = Math.abs(testPerformance - controlPerformance) * 100;
        if (winner === 'test') {
            return `Adopt test parameters - ${improvement.toFixed(1)}% performance improvement (${significance.toFixed(2)}σ confidence)`;
        }
        else {
            return `Keep control parameters - test performed ${improvement.toFixed(1)}% worse (${significance.toFixed(2)}σ confidence)`;
        }
    }
    getInitialParameters(taskType) {
        const defaults = {
            [TaskType.CODE_GENERATION]: { temperature: 0.2, maxTokens: 1024, topP: 0.9 },
            [TaskType.CREATIVE_WRITING]: { temperature: 0.8, maxTokens: 2048, topP: 0.95 },
            [TaskType.DATA_ANALYSIS]: { temperature: 0.4, maxTokens: 1536, topP: 0.9 },
            [TaskType.FACTUAL_QA]: { temperature: 0.5, maxTokens: 1024, topP: 0.9 },
        };
        return defaults[taskType] || { temperature: 0.5, maxTokens: 1024, topP: 0.9 };
    }
    getOrCreateBayesianModel(taskType) {
        const modelKey = `ml_optimizer_${taskType}`;
        if (!this.bayesianModels.has(modelKey)) {
            const model = new BayesianModel('ml_optimizer', taskType);
            this.bayesianModels.set(modelKey, model);
        }
        return this.bayesianModels.get(modelKey);
    }
    generateParametersFromPrediction(taskType, prediction, experiment) {
        const baseParams = experiment.bestParameters;
        const paramSpace = this.parameterSpaces.get(taskType);
        const adjustedParams = { ...baseParams };
        if (prediction.expectedReward > 0.8) {
            adjustedParams.temperature = Math.max(paramSpace.temperature.min, (adjustedParams.temperature || 0.5) * 0.9);
        }
        else if (prediction.expectedReward < 0.5) {
            adjustedParams.temperature = Math.min(paramSpace.temperature.max, (adjustedParams.temperature || 0.5) * 1.1);
        }
        if (prediction.expectedTime > 5000) {
            adjustedParams.maxTokens = Math.max(paramSpace.maxTokens.min, Math.round((adjustedParams.maxTokens || 1024) * 0.8));
        }
        return adjustedParams;
    }
    getParameterHash(parameters) {
        return Buffer.from(JSON.stringify(parameters)).toString('base64').substr(0, 16);
    }
    generateExperimentId() {
        return `ml_exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    generateTrialId() {
        return `trial_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    startPeriodicOptimization() {
        setInterval(async () => {
            try {
                await this.performPeriodicOptimization();
            }
            catch (error) {
                log.error('Periodic optimization failed', LogContext.AI, { error });
            }
        }, 60 * 60 * 1000);
    }
    async performPeriodicOptimization() {
        log.info('🔄 Running periodic ML parameter optimization', LogContext.AI);
        for (const [key, experiment] of this.experiments.entries()) {
            if (experiment.trials.length >= 5) {
                const hoursSinceLastUpdate = (Date.now() - experiment.lastUpdate.getTime()) / (1000 * 60 * 60);
                if (hoursSinceLastUpdate >= 6) {
                    await this.generateOptimizationInsights(experiment);
                    const insight = await this.generateTaskTypeInsight(experiment);
                    if (insight &&
                        insight.confidence > 0.8 &&
                        insight.supportingData?.improvementPercent > 15) {
                        log.info('🤖 Periodic optimization found high-confidence insight, queueing autonomous action', LogContext.AI, {
                            taskType: experiment.taskType,
                            confidence: insight.confidence,
                            improvement: insight.supportingData?.improvementPercent,
                        });
                        await this.queueMLOptimizationAction(insight, experiment);
                    }
                }
            }
        }
    }
}
export const mlParameterOptimizer = new MLParameterOptimizer();
export default mlParameterOptimizer;
//# sourceMappingURL=ml-parameter-optimizer.js.map