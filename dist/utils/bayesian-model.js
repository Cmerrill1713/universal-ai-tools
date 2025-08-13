import { log, LogContext } from './logger';
import { BetaSampler, NormalGammaSampler } from './thompson-sampling';
export class BayesianModel {
    agentName;
    taskType;
    successRate;
    executionTime;
    resourceUsage;
    observations;
    lastUpdated;
    totalSamples;
    expectedPerformance;
    confidenceInterval;
    reliability;
    timeParams;
    resourceParams;
    constructor(agentName, taskType) {
        this.agentName = agentName;
        this.taskType = taskType;
        this.successRate = {
            alpha: 1,
            beta: 1,
            mean: 0.5,
            variance: 1 / 12,
        };
        this.executionTime = {
            mean: 1000,
            variance: 250000,
            precision: 1 / 250000,
            standardDeviation: 500,
        };
        this.resourceUsage = {
            shape: 2,
            rate: 0.002,
            mean: 1000,
            variance: 500000,
        };
        this.timeParams = {
            mean: 1000,
            precision: 0.001,
            shape: 1,
            rate: 500,
        };
        this.resourceParams = {
            shape: 2,
            rate: 0.002,
        };
        this.observations = [];
        this.lastUpdated = Date.now();
        this.totalSamples = 0;
        this.expectedPerformance = 0.5;
        this.confidenceInterval = [0, 1];
        this.reliability = 0;
    }
    update(observation) {
        this.observations.push(observation);
        this.totalSamples++;
        this.lastUpdated = Date.now();
        this.successRate = BetaSampler.update(this.successRate, observation.success);
        const timeUpdate = NormalGammaSampler.update(this.timeParams.mean, this.timeParams.precision, this.timeParams.shape, this.timeParams.rate, observation.executionTime);
        this.timeParams = timeUpdate;
        const timeStats = NormalGammaSampler.getStatistics(timeUpdate.mean, timeUpdate.precision, timeUpdate.shape, timeUpdate.rate);
        this.executionTime = {
            mean: timeStats.expectedMean,
            variance: timeStats.variance,
            precision: 1 / timeStats.variance,
            standardDeviation: Math.sqrt(timeStats.variance),
        };
        this.updateResourceUsage(observation.resourceUsage);
        this.updatePerformanceMetrics();
        log.debug('Bayesian model updated', LogContext.AI, {
            agent: this.agentName,
            taskType: this.taskType,
            successRate: this.successRate.mean,
            avgExecutionTime: this.executionTime.mean,
            totalSamples: this.totalSamples,
        });
    }
    updateResourceUsage(usage) {
        const n = this.totalSamples;
        const oldMean = this.resourceUsage.mean;
        const newMean = (oldMean * (n - 1) + usage) / n;
        const oldVar = this.resourceUsage.variance;
        const newVar = ((n - 1) * oldVar + (usage - oldMean) * (usage - newMean)) / n;
        this.resourceUsage = {
            shape: (newMean * newMean) / newVar,
            rate: newMean / newVar,
            mean: newMean,
            variance: newVar,
        };
        this.resourceParams = {
            shape: this.resourceUsage.shape,
            rate: this.resourceUsage.rate,
        };
    }
    updatePerformanceMetrics() {
        const successScore = this.successRate.mean;
        const timeScore = 1 / (1 + this.executionTime.mean / 1000);
        const resourceScore = 1 / (1 + this.resourceUsage.mean / 1000);
        this.expectedPerformance = 0.5 * successScore + 0.3 * timeScore + 0.2 * resourceScore;
        this.confidenceInterval = BetaSampler.confidenceInterval(this.successRate);
        const sampleReliability = Math.min(1, this.totalSamples / 30);
        const consistencyScore = this.calculateConsistency();
        this.reliability = 0.7 * sampleReliability + 0.3 * consistencyScore;
    }
    calculateConsistency() {
        if (this.observations.length < 5)
            return 0;
        const recent = this.observations.slice(-10);
        const successRates = recent.map((o) => (o.success ? 1 : 0));
        const mean = successRates.reduce((a, b) => a + b, 0) / successRates.length;
        const variance = successRates.reduce((sum, rate) => sum + Math.pow(rate - mean, 2), 0) /
            successRates.length;
        return Math.exp(-2 * variance);
    }
    predict(context) {
        const successProb = BetaSampler.sample(this.successRate.alpha, this.successRate.beta);
        const timeEstimate = this.sampleExecutionTime();
        const resourceEstimate = this.sampleResourceUsage();
        const contextMultiplier = this.getContextMultiplier(context);
        return {
            expectedReward: successProb * contextMultiplier,
            expectedTime: timeEstimate * contextMultiplier,
            expectedResources: resourceEstimate * contextMultiplier,
            confidence: this.reliability,
        };
    }
    sampleExecutionTime() {
        const sample = NormalGammaSampler.sample(this.timeParams.mean, this.timeParams.precision, this.timeParams.shape, this.timeParams.rate);
        return Math.max(1, sample.mean);
    }
    sampleResourceUsage() {
        const sample = BetaSampler.sampleGamma(this.resourceParams.shape, this.resourceParams.rate);
        return Math.max(1, sample);
    }
    getContextMultiplier(context) {
        let multiplier = 1.0;
        if (context.complexity === 'simple')
            multiplier *= 0.8;
        else if (context.complexity === 'complex')
            multiplier *= 1.2;
        if (context.urgency === 'high')
            multiplier *= 1.1;
        else if (context.urgency === 'low')
            multiplier *= 0.9;
        return multiplier;
    }
    getStatistics() {
        return {
            successRate: {
                mean: this.successRate.mean,
                confidence: this.confidenceInterval,
            },
            executionTime: {
                mean: this.executionTime.mean,
                stdDev: this.executionTime.standardDeviation,
            },
            resourceUsage: {
                mean: this.resourceUsage.mean,
                variance: this.resourceUsage.variance,
            },
            reliability: this.reliability,
            samples: this.totalSamples,
        };
    }
    compareTo(other) {
        const samples = 10000;
        let betterSuccess = 0;
        let fasterExecution = 0;
        let moreEfficient = 0;
        let overallBetter = 0;
        for (let i = 0; i < samples; i++) {
            const thisSuccess = BetaSampler.sample(this.successRate.alpha, this.successRate.beta);
            const otherSuccess = BetaSampler.sample(other.successRate.alpha, other.successRate.beta);
            const thisTime = this.sampleExecutionTime();
            const otherTime = other.sampleExecutionTime();
            const thisResource = this.sampleResourceUsage();
            const otherResource = other.sampleResourceUsage();
            if (thisSuccess > otherSuccess)
                betterSuccess++;
            if (thisTime < otherTime)
                fasterExecution++;
            if (thisResource < otherResource)
                moreEfficient++;
            const thisScore = 0.5 * thisSuccess + 0.3 * (1 / thisTime) + 0.2 * (1 / thisResource);
            const otherScore = 0.5 * otherSuccess + 0.3 * (1 / otherTime) + 0.2 * (1 / otherResource);
            if (thisScore > otherScore)
                overallBetter++;
        }
        return {
            betterSuccess: betterSuccess / samples,
            fasterExecution: fasterExecution / samples,
            moreEfficient: moreEfficient / samples,
            overallBetter: overallBetter / samples,
        };
    }
    toJSON() {
        return JSON.stringify({
            agentName: this.agentName,
            taskType: this.taskType,
            successRate: this.successRate,
            executionTime: this.executionTime,
            resourceUsage: this.resourceUsage,
            timeParams: this.timeParams,
            resourceParams: this.resourceParams,
            observations: this.observations.slice(-100),
            lastUpdated: this.lastUpdated,
            totalSamples: this.totalSamples,
            expectedPerformance: this.expectedPerformance,
            confidenceInterval: this.confidenceInterval,
            reliability: this.reliability,
        });
    }
    static fromJSON(json) {
        const data = JSON.parse(json);
        const model = new BayesianModel(data.agentName, data.taskType);
        Object.assign(model, data);
        return model;
    }
}
export class BayesianModelRegistry {
    models = new Map();
    getModel(agentName, taskType) {
        const key = `${agentName}:${taskType}`;
        if (!this.models.has(key)) {
            this.models.set(key, new BayesianModel(agentName, taskType));
        }
        return this.models.get(key);
    }
    updateModel(agentName, taskType, reward, executionTime, context) {
        const model = this.getModel(agentName, taskType);
        const observation = {
            timestamp: Date.now(),
            success: reward.value > 0.5,
            executionTime,
            resourceUsage: reward.metadata.memoryUsed + reward.metadata.tokensUsed,
            reward: reward.value,
            context,
        };
        model.update(observation);
    }
    getBestAgent(taskType, availableAgents) {
        let bestAgent = '';
        let bestPerformance = -Infinity;
        let bestConfidence = 0;
        for (const agent of availableAgents) {
            const model = this.getModel(agent, taskType);
            if (model.expectedPerformance > bestPerformance) {
                bestPerformance = model.expectedPerformance;
                bestAgent = agent;
                bestConfidence = model.reliability;
            }
        }
        return {
            agent: bestAgent,
            confidence: bestConfidence,
            expectedPerformance: bestPerformance,
        };
    }
    getRankings(taskType) {
        const rankings = [];
        for (const [key, model] of this.models) {
            if (key.endsWith(`:${taskType}`)) {
                rankings.push({
                    agent: model.agentName,
                    performance: model.expectedPerformance,
                    reliability: model.reliability,
                    samples: model.totalSamples,
                });
            }
        }
        return rankings.sort((a, b) => b.performance - a.performance);
    }
    serialize() {
        const data = {};
        for (const [key, model] of this.models) {
            data[key] = JSON.parse(model.toJSON());
        }
        return JSON.stringify(data);
    }
    static deserialize(data) {
        const registry = new BayesianModelRegistry();
        const parsed = JSON.parse(data);
        for (const [key, modelData] of Object.entries(parsed)) {
            const model = BayesianModel.fromJSON(JSON.stringify(modelData));
            registry.models.set(key, model);
        }
        return registry;
    }
}
export const bayesianModelRegistry = new BayesianModelRegistry();
//# sourceMappingURL=bayesian-model.js.map