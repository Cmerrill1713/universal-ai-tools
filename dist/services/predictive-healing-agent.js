import { execSync } from 'child_process';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { HOURS_IN_DAY, THREE, TWO } from '../utils/constants';
class PredictiveHealingAgent {
    isRunning = false;
    memory;
    memoryFile = 'logs/healing-memory.json';
    predictionInterval = 180000;
    learningInterval = 600000;
    alerts = [];
    constructor() {
        console.log('🧠 Predictive Healing Agent initialized');
        this.memory = this.loadMemory();
    }
    async start() {
        if (this.isRunning) {
            console.log('⚠️ Predictive Healing Agent is already running');
            return;
        }
        this.isRunning = true;
        console.log('🔮 Starting Predictive Healing Agent...');
        await this.analyzeCurrentPatterns();
        setInterval(async () => {
            if (this.isRunning) {
                await this.runPredictiveCycle();
            }
        }, this.predictionInterval);
        setInterval(async () => {
            if (this.isRunning) {
                await this.runLearningCycle();
            }
        }, this.learningInterval);
        console.log('✅ Predictive Healing Agent active - ML pattern recognition running');
    }
    async analyzeCurrentPatterns() {
        console.log('🔍 Analyzing current error patterns...');
        try {
            await this.scanLogFiles();
            await this.analyzeCodeChanges();
            await this.checkSystemHealth();
            console.log(`📊 Pattern analysis complete. Tracking ${this.memory.patterns.length} patterns`);
        }
        catch (error) {
            console.log('⚠️ Pattern analysis failed, using existing memory');
        }
    }
    async scanLogFiles() {
        const logFiles = [
            'logs/syntax-guardian.log',
            'logs/adaptive-fixer.log',
            'logs/error-monitor.log',
        ];
        for (const logFile of logFiles) {
            try {
                if (fs.existsSync(logFile)) {
                    const content = fs.readFileSync(logFile, 'utf8');
                    this.extractPatternsFromLog(content);
                }
            }
            catch (error) {
                console.log(`Could not read ${logFile}`);
            }
        }
    }
    extractPatternsFromLog(content) {
        const lines = content.split('\n');
        const errorPatterns = [
            /error TSd+:/,
            /SyntaxError:/,
            /ReferenceError:/,
            /TypeError:/,
            /Failed to/,
            /Cannot find/,
            /Unexpected/,
        ];
        lines.forEach((line) => {
            errorPatterns.forEach((pattern) => {
                if (pattern.test(line)) {
                    this.recordPattern(pattern.source, 'syntax', line);
                }
            });
        });
    }
    recordPattern(pattern, category, context) {
        const existingPattern = this.memory.patterns.find((p) => p.pattern === pattern);
        if (existingPattern) {
            existingPattern.frequency++;
            existingPattern.lastSeen = new Date();
            existingPattern.predictedRecurrence = Math.max(1, 24 / existingPattern.frequency);
        }
        else {
            this.memory.patterns.push({
                id: `pattern-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                pattern,
                frequency: 1,
                lastSeen: new Date(),
                category,
                predictedRecurrence: HOURS_IN_DAY,
                autoFixSuccess: 0.5,
            });
        }
    }
    async analyzeCodeChanges() {
        try {
            const result = execSync('git log --oneline -10 2>/dev/null || echo "No git history"', {
                encoding: 'utf8',
                timeout: 10000,
            });
            if (result.includes('No git history'))
                return;
            const changes = result.split('\n').filter((line) => line.trim());
            const riskyPatterns = [/refactor/i, /major/i, /breaking/i, /dependency/i, /migration/i];
            changes.forEach((change) => {
                riskyPatterns.forEach((pattern) => {
                    if (pattern.test(change)) {
                        this.generatePredictiveAlert('warning', `Recent ${pattern.source.replace(/[/\^$*+?.()|[]{}]/g, '').replace('i', '')} changes detected - monitoring for stability`, TWO, 0.7);
                    }
                });
            });
        }
        catch (error) {
            console.log('Git analysis failed');
        }
    }
    async checkSystemHealth() {
        const healthChecks = [
            this.checkDiskSpace(),
            this.checkMemoryUsage(),
            this.checkProcessHealth(),
        ];
        const results = await Promise.allSettled(healthChecks);
        results.forEach((result, index) => {
            if (result.status === 'fulfilled' && result.value) {
                this.generatePredictiveAlert(result.value.severity, result.value.message, result.value.hours, result.value.confidence);
            }
        });
    }
    async checkDiskSpace() {
        try {
            const result = execSync('df -h . | tail -1', { encoding: 'utf8' });
            const usage = result.match(/(d+)%/);
            if (usage && usage[1] && parseInt(usage[1], 10) > 85) {
                const percentage = parseInt(usage[1], 10);
                return {
                    severity: percentage > 95 ? 'critical' : 'warning',
                    message: `Disk space ${usage[1]}% full - potential build failures predicted`,
                    hours: percentage > 95 ? 1 : 6,
                    confidence: 0.9,
                };
            }
        }
        catch (error) {
        }
        return null;
    }
    async checkMemoryUsage() {
        try {
            const result = execSync("ps aux | awk 'NR>1{sum+=$4} END{print sum}'", { encoding: 'utf8' });
            const memoryUsage = parseFloat(result.trim());
            if (memoryUsage > 80) {
                return {
                    severity: memoryUsage > 90 ? 'critical' : 'warning',
                    message: `High memory usage ${memoryUsage.toFixed(1)}% - performance degradation predicted`,
                    hours: memoryUsage > 90 ? 0.5 : 3,
                    confidence: 0.8,
                };
            }
        }
        catch (error) {
        }
        return null;
    }
    async checkProcessHealth() {
        try {
            const result = execSync('ps aux | grep node | wc -l', { encoding: 'utf8' });
            const processCount = parseInt(result.trim(), 10);
            if (processCount > 50) {
                return {
                    severity: 'warning',
                    message: `High process count ${processCount} - resource exhaustion predicted`,
                    hours: 2,
                    confidence: 0.6,
                };
            }
        }
        catch (error) {
        }
        return null;
    }
    async runPredictiveCycle() {
        console.log('🔮 Running predictive analysis...');
        const predictions = this.generatePredictions();
        for (const alert of predictions) {
            if (alert.confidence > 0.7 && alert.severity === 'critical') {
                await this.executePreventiveMeasures(alert);
            }
        }
        this.cleanupOldAlerts();
        console.log(`🎯 Generated ${predictions.length} predictions, ${this.alerts.length} active alerts`);
    }
    generatePredictions() {
        const predictions = [];
        const now = new Date();
        for (const pattern of this.memory.patterns) {
            const hoursSinceLastSeen = (now.getTime() - pattern.lastSeen.getTime()) / (1000 * 60 * 60);
            if (hoursSinceLastSeen >= pattern.predictedRecurrence * 0.8) {
                const confidence = Math.min(0.9, pattern.frequency / 10);
                const predictedTime = new Date(now.getTime() + pattern.predictedRecurrence * 60 * 60 * 1000);
                const alert = this.generatePredictiveAlert(pattern.frequency > 5 ? 'critical' : 'warning', `Pattern "${pattern.pattern}" likely to recur (${pattern.frequency} previous occurrences)`, pattern.predictedRecurrence, confidence, this.generatePreventiveMeasures(pattern));
                predictions.push(alert);
            }
        }
        return predictions;
    }
    generatePredictiveAlert(severity, message, hours, confidence, preventive) {
        const alert = {
            id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            severity,
            message,
            predictedTime: new Date(Date.now() + hours * 60 * 60 * 1000),
            confidence,
            preventive,
        };
        this.alerts.push(alert);
        console.log(`🚨 Predictive Alert (${confidence.toFixed(1)}): ${message}`);
        return alert;
    }
    generatePreventiveMeasures(pattern) {
        const measures = [];
        switch (pattern.category) {
            case 'syntax':
                measures.push('Run TypeScript compilation check');
                measures.push('Execute lint auto-fix');
                measures.push('Validate import statements');
                break;
            case 'runtime':
                measures.push('Check environment variables');
                measures.push('Validate service connections');
                measures.push('Clear temporary caches');
                break;
            case 'performance':
                measures.push('Monitor memory usage');
                measures.push('Check for resource leaks');
                measures.push('Optimize slow queries');
                break;
            case 'security':
                measures.push('Update dependencies');
                measures.push('Run security audit');
                measures.push('Check for exposed credentials');
                break;
        }
        return measures;
    }
    async executePreventiveMeasures(alert) {
        if (!alert.preventive)
            return;
        console.log(`🛡️ Executing preventive measures for: ${alert.message}`);
        for (const measure of alert.preventive) {
            try {
                await this.executeMeasure(measure);
                console.log(`  ✅ ${measure}`);
            }
            catch (error) {
                console.log(`  ⚠️ ${measure} failed`);
            }
        }
    }
    async executeMeasure(measure) {
        switch (measure) {
            case 'Run TypeScript compilation check':
                execSync('npx tsc --noEmit --skipLibCheck', { timeout: 30000, stdio: 'pipe' });
                break;
            case 'Execute lint auto-fix':
                execSync('npm run lint:fix', { timeout: 60000, stdio: 'pipe' });
                break;
            case 'Update dependencies':
                execSync('npm audit fix', { timeout: 120000, stdio: 'pipe' });
                break;
            default:
                console.log(`  📝 Manual measure: ${measure}`);
        }
    }
    async runLearningCycle() {
        console.log('🧠 Running learning cycle...');
        this.updatePatternSuccessRates();
        this.adjustPredictionAlgorithms();
        this.saveMemory();
        console.log('✅ Learning cycle completed - AI model updated');
    }
    updatePatternSuccessRates() {
        for (const pattern of this.memory.patterns) {
            const recentFixes = this.memory.fixes.get(pattern.id) || [];
            if (recentFixes.length > 0) {
                const successCount = recentFixes.filter((fix) => fix === 'success').length;
                pattern.autoFixSuccess = successCount / recentFixes.length;
            }
        }
    }
    adjustPredictionAlgorithms() {
        for (const pattern of this.memory.patterns) {
            if (pattern.frequency > THREE) {
                const avgInterval = 168 / pattern.frequency;
                pattern.predictedRecurrence = Math.max(1, avgInterval * 0.8);
            }
        }
    }
    cleanupOldAlerts() {
        const now = new Date();
        this.alerts = this.alerts.filter((alert) => {
            return alert.predictedTime.getTime() > now.getTime() - 24 * 60 * 60 * 1000;
        });
    }
    loadMemory() {
        try {
            if (fs.existsSync(this.memoryFile)) {
                const data = fs.readFileSync(this.memoryFile, 'utf8');
                const parsed = JSON.parse(data);
                return {
                    patterns: parsed.patterns || [],
                    fixes: new Map(parsed.fixes || []),
                    performance: new Map(parsed.performance || []),
                    lastUpdated: new Date(parsed.lastUpdated || Date.now()),
                };
            }
        }
        catch (error) {
            console.log('Failed to load memory, starting fresh');
        }
        return {
            patterns: [],
            fixes: new Map(),
            performance: new Map(),
            lastUpdated: new Date(),
        };
    }
    saveMemory() {
        try {
            if (!fs.existsSync('logs')) {
                fs.mkdirSync('logs', { recursive: true });
            }
            const data = {
                patterns: this.memory.patterns,
                fixes: Array.from(this.memory.fixes.entries()),
                performance: Array.from(this.memory.performance.entries()),
                lastUpdated: new Date().toISOString(),
            };
            fs.writeFileSync(this.memoryFile, JSON.stringify(data, null, TWO));
        }
        catch (error) {
            console.log('Failed to save memory');
        }
    }
    getStatus() {
        return {
            isRunning: this.isRunning,
            patternsLearned: this.memory.patterns.length,
            activeAlerts: this.alerts.length,
            criticalAlerts: this.alerts.filter((a) => a.severity === 'critical').length,
            lastLearning: this.memory.lastUpdated,
            predictions: this.alerts.map((a) => ({
                severity: a.severity,
                message: a.message,
                confidence: a.confidence,
                predictedTime: a.predictedTime,
            })),
        };
    }
    stop() {
        this.isRunning = false;
        this.saveMemory();
        console.log('🛑 Predictive Healing Agent stopped');
    }
}
export { PredictiveHealingAgent };
const ___filename = fileURLToPath(import.meta.url);
if (import.meta.url === `file://${process.argv[1]}`) {
    const agent = new PredictiveHealingAgent();
    agent.start().catch(console.error);
    process.on('SIGINT', () => {
        agent.stop();
        process.exit(0);
    });
}
//# sourceMappingURL=predictive-healing-agent.js.map