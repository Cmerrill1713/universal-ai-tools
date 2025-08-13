import { THREE, TWO } from './common-constants';
import { log, LogContext } from './logger';
export class BetaSampler {
    static sample(alpha, beta) {
        const x = this.sampleGamma(alpha, 1);
        const y = this.sampleGamma(beta, 1);
        return x / (x + y);
    }
    static sampleGamma(shape, rate) {
        if (shape < 1) {
            const u = Math.random();
            return this.sampleGamma(1 + shape, rate) * Math.pow(u, 1 / shape);
        }
        const d = shape - 1 / THREE;
        const c = 1 / Math.sqrt(9 * d);
        while (true) {
            let x, v;
            do {
                x = this.sampleNormal(0, 1);
                v = 1 + c * x;
            } while (v <= 0);
            v = v * v * v;
            const u = Math.random();
            if (u < 1 - 0.0331 * x * x * x * x) {
                return (d * v) / rate;
            }
            if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
                return (d * v) / rate;
            }
        }
    }
    static sampleNormal(mean, variance) {
        const u1 = Math.random();
        const u2 = Math.random();
        const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        return mean + Math.sqrt(variance) * z0;
    }
    static update(distribution, success) {
        const newAlpha = distribution.alpha + (success ? 1 : 0);
        const newBeta = distribution.beta + (success ? 0 : 1);
        return {
            alpha: newAlpha,
            beta: newBeta,
            mean: newAlpha / (newAlpha + newBeta),
            variance: (newAlpha * newBeta) / ((newAlpha + newBeta) ** 2 * (newAlpha + newBeta + 1)),
            mode: newAlpha > 1 && newBeta > 1 ? (newAlpha - 1) / (newAlpha + newBeta - TWO) : undefined,
        };
    }
    static confidenceInterval(distribution, confidence = 0.95) {
        const z = this.quantileNormal((1 + confidence) / TWO);
        const n = distribution.alpha + distribution.beta;
        const p = distribution.mean;
        const denominator = 1 + (z * z) / n;
        const center = (p + (z * z) / (2 * n)) / denominator;
        const margin = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denominator;
        return [Math.max(0, center - margin), Math.min(1, center + margin)];
    }
    static quantileNormal(p) {
        const a1 = -3.969683028665376e1;
        const a2 = 2.209460984245205e2;
        const a3 = -2.759285104469687e2;
        const a4 = 1.38357751867269e2;
        const a5 = -3.066479806614716e1;
        const a6 = 2.506628277459239;
        const b1 = -5.447609879822406e1;
        const b2 = 1.615858368580409e2;
        const b3 = -1.556989798598866e2;
        const b4 = 6.680131188771972e1;
        const b5 = -1.328068155288572e1;
        const c1 = -7.784894002430293e-3;
        const c2 = -3.223964580411365e-1;
        const c3 = -2.400758277161838;
        const c4 = -2.549732539343734;
        const c5 = 4.374664141464968;
        const c6 = 2.938163982698783;
        const d1 = 7.784695709041462e-3;
        const d2 = 3.224671290700398e-1;
        const d3 = 2.445134137142996;
        const d4 = 3.754408661907416;
        const p_low = 0.02425;
        const p_high = 1 - p_low;
        let q, r;
        if (p < p_low) {
            q = Math.sqrt(-2 * Math.log(p));
            return ((((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
                ((((d1 * q + d2) * q + d3) * q + d4) * q + 1));
        }
        else if (p <= p_high) {
            q = p - 0.5;
            r = q * q;
            return (((((((a1 * r + a2) * r + a3) * r + a4) * r + a5) * r + a6) * q) /
                (((((b1 * r + b2) * r + b3) * r + b4) * r + b5) * r + 1));
        }
        else {
            q = Math.sqrt(-2 * Math.log(1 - p));
            return (-(((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
                ((((d1 * q + d2) * q + d3) * q + d4) * q + 1));
        }
    }
}
export class NormalGammaSampler {
    static sample(mean, precision, shape, rate) {
        const sampledPrecision = BetaSampler['sampleGamma'](shape, rate);
        const sampledMean = BetaSampler['sampleNormal'](mean, 1 / (precision * sampledPrecision));
        return { mean: sampledMean, precision: sampledPrecision };
    }
    static update(mean, precision, shape, rate, observation, observationPrecision = 1) {
        const newPrecision = precision + observationPrecision;
        const newMean = (precision * mean + observationPrecision * observation) / newPrecision;
        const newShape = shape + 0.5;
        const newRate = rate + (0.5 * observationPrecision * (observation - mean) ** 2 * precision) / newPrecision;
        return {
            mean: newMean,
            precision: newPrecision,
            shape: newShape,
            rate: newRate,
        };
    }
    static getStatistics(mean, precision, shape, rate) {
        const _expectedPrecision = shape / rate;
        const variance = rate / (precision * (shape - 1));
        return {
            expectedMean: mean,
            variance: variance > 0 ? variance : Infinity,
        };
    }
}
export class ThompsonSelector {
    arms;
    continuousArms;
    constructor() {
        this.arms = new Map();
        this.continuousArms = new Map();
    }
    initializeArms(armNames, priorAlpha = 1, priorBeta = 1) {
        for (const name of armNames) {
            this.arms.set(name, {
                alpha: priorAlpha,
                beta: priorBeta,
                mean: priorAlpha / (priorAlpha + priorBeta),
                variance: (priorAlpha * priorBeta) / ((priorAlpha + priorBeta) ** 2 * (priorAlpha + priorBeta + 1)),
            });
        }
    }
    selectArm(temperature = 1.0) {
        let bestArm = '';
        let bestSample = -Infinity;
        for (const [name, dist] of this.arms) {
            const sample = BetaSampler.sample(dist.alpha * temperature, dist.beta * temperature);
            if (sample > bestSample) {
                bestSample = sample;
                bestArm = name;
            }
        }
        log.debug('Thompson sampling arm selection', LogContext.AI, {
            selectedArm: bestArm,
            sample: bestSample,
            temperature,
        });
        return bestArm;
    }
    updateArm(armName, success) {
        const dist = this.arms.get(armName);
        if (!dist) {
            log.warn(`Arm ${armName} not found for update`, LogContext.AI);
            return;
        }
        const updated = BetaSampler.update(dist, success);
        this.arms.set(armName, updated);
        log.debug('Thompson sampling arm updated', LogContext.AI, {
            arm: armName,
            success,
            newAlpha: updated.alpha,
            newBeta: updated.beta,
            newMean: updated.mean,
        });
    }
    getArmStats(armName) {
        const dist = this.arms.get(armName);
        if (!dist)
            return null;
        return {
            mean: dist.mean,
            confidence: BetaSampler.confidenceInterval(dist),
            samples: dist.alpha + dist.beta - TWO,
        };
    }
    getRankedArms() {
        const rankings = [];
        for (const [name, dist] of this.arms) {
            rankings.push({
                name,
                mean: dist.mean,
                confidence: BetaSampler.confidenceInterval(dist),
                samples: dist.alpha + dist.beta - TWO,
            });
        }
        return rankings.sort((a, b) => b.mean - a.mean);
    }
    reset(priorAlpha = 1, priorBeta = 1) {
        for (const [name] of this.arms) {
            this.arms.set(name, {
                alpha: priorAlpha,
                beta: priorBeta,
                mean: priorAlpha / (priorAlpha + priorBeta),
                variance: (priorAlpha * priorBeta) / ((priorAlpha + priorBeta) ** 2 * (priorAlpha + priorBeta + 1)),
            });
        }
    }
}
export class UCBCalculator {
    static ucb1(averageReward, totalVisits, nodeVisits, explorationConstant = Math.sqrt(2)) {
        if (nodeVisits === 0)
            return Infinity;
        const exploitation = averageReward;
        const exploration = explorationConstant * Math.sqrt(Math.log(totalVisits) / nodeVisits);
        return exploitation + exploration;
    }
    static ucbTuned(averageReward, rewardVariance, totalVisits, nodeVisits) {
        if (nodeVisits === 0)
            return Infinity;
        const V = rewardVariance + Math.sqrt((2 * Math.log(totalVisits)) / nodeVisits);
        const exploration = Math.sqrt((Math.log(totalVisits) / nodeVisits) * Math.min(0.25, V));
        return averageReward + exploration;
    }
}
export class AdaptiveExplorer {
    thompsonWeight = 0.7;
    ucbWeight = 0.3;
    adaptationRate = 0.1;
    selectAction(thompsonScores, ucbScores, temperature = 1.0) {
        let bestAction = '';
        let bestScore = -Infinity;
        const actions = Array.from(thompsonScores.keys());
        for (const action of actions) {
            const thompsonScore = thompsonScores.get(action) || 0;
            const ucbScore = ucbScores.get(action) || 0;
            const combinedScore = (this.thompsonWeight * thompsonScore + this.ucbWeight * ucbScore) * temperature;
            if (combinedScore > bestScore) {
                bestScore = combinedScore;
                bestAction = action;
            }
        }
        return bestAction;
    }
    adaptWeights(thompsonSuccess, ucbSuccess) {
        if (thompsonSuccess && !ucbSuccess) {
            this.thompsonWeight = Math.min(0.9, this.thompsonWeight + this.adaptationRate);
            this.ucbWeight = 1 - this.thompsonWeight;
        }
        else if (!thompsonSuccess && ucbSuccess) {
            this.ucbWeight = Math.min(0.9, this.ucbWeight + this.adaptationRate);
            this.thompsonWeight = 1 - this.ucbWeight;
        }
    }
    getWeights() {
        return {
            thompson: this.thompsonWeight,
            ucb: this.ucbWeight,
        };
    }
}
export function createThompsonParams(armCount, priorAlpha = 1, priorBeta = 1, temperature = 1.0) {
    return {
        useBeta: true,
        alphas: new Array(armCount).fill(priorAlpha),
        betas: new Array(armCount).fill(priorBeta),
        useNormalGamma: false,
        means: [],
        precisions: [],
        shapes: [],
        rates: [],
        temperature,
        epsilon: 0.1,
    };
}
export const defaultThompsonSelector = new ThompsonSelector();
export const adaptiveExplorer = new AdaptiveExplorer();
//# sourceMappingURL=thompson-sampling.js.map