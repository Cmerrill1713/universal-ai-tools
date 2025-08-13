interface ErrorPattern {
    id: string;
    pattern: string;
    frequency: number;
    lastSeen: Date;
    category: 'syntax' | 'runtime' | 'performance' | 'security';
    predictedRecurrence: number;
    autoFixSuccess: number;
}
interface PredictiveAlert {
    id: string;
    severity: 'warning' | 'critical';
    message: string;
    predictedTime: Date;
    confidence: number;
    preventive?: string[];
}
interface LearningMemory {
    patterns: ErrorPattern[];
    fixes: Map<string, string[]>;
    performance: Map<string, number>;
    lastUpdated: Date;
}
declare class PredictiveHealingAgent {
    private isRunning;
    private memory;
    private memoryFile;
    private predictionInterval;
    private learningInterval;
    private alerts;
    constructor();
    start(): Promise<void>;
    analyzeCurrentPatterns(): Promise<void>;
    scanLogFiles(): Promise<void>;
    extractPatternsFromLog(content: string): void;
    recordPattern(pattern: string, category: ErrorPattern['category'], context: string): void;
    analyzeCodeChanges(): Promise<void>;
    checkSystemHealth(): Promise<void>;
    checkDiskSpace(): Promise<{
        severity: 'warning' | 'critical';
        message: string;
        hours: number;
        confidence: number;
    } | null>;
    checkMemoryUsage(): Promise<{
        severity: 'warning' | 'critical';
        message: string;
        hours: number;
        confidence: number;
    } | null>;
    checkProcessHealth(): Promise<{
        severity: 'warning' | 'critical';
        message: string;
        hours: number;
        confidence: number;
    } | null>;
    runPredictiveCycle(): Promise<void>;
    generatePredictions(): PredictiveAlert[];
    generatePredictiveAlert(severity: 'warning' | 'critical', message: string, hours: number, confidence: number, preventive?: string[]): PredictiveAlert;
    generatePreventiveMeasures(pattern: ErrorPattern): string[];
    executePreventiveMeasures(alert: PredictiveAlert): Promise<void>;
    executeMeasure(measure: string): Promise<void>;
    runLearningCycle(): Promise<void>;
    updatePatternSuccessRates(): void;
    adjustPredictionAlgorithms(): void;
    cleanupOldAlerts(): void;
    loadMemory(): LearningMemory;
    saveMemory(): void;
    getStatus(): object;
    stop(): void;
}
export { PredictiveHealingAgent };
//# sourceMappingURL=predictive-healing-agent.d.ts.map