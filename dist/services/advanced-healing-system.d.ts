interface HealingTask {
    id: string;
    type: 'syntax' | 'performance' | 'security' | 'architecture' | 'dependencies' | 'network';
    severity: 'critical' | 'high' | 'medium' | 'low';
    description: string;
    autoFixable: boolean;
    estimatedTime: number;
}
interface HealingResult {
    taskId: string;
    success: boolean;
    changes: string[];
    metrics: {
        filesFixed: number;
        errorsResolved: number;
        performanceImprovement?: number;
    };
}
declare class AdvancedHealingSystem {
    private isRunning;
    private healingQueue;
    private completedTasks;
    private healingInterval;
    private diagnosticInterval;
    private networkHealingService;
    constructor();
    private initializeNetworkHealing;
    start(): Promise<void>;
    runComprehensiveDiagnostic(): Promise<void>;
    diagnoseSyntaxIssues(): Promise<void>;
    diagnosePerformanceIssues(): Promise<void>;
    checkForMemoryLeaks(): Promise<HealingTask | null>;
    checkForSlowQueries(): Promise<HealingTask | null>;
    checkForLargeFiles(): Promise<HealingTask | null>;
    diagnoseSecurityIssues(): Promise<void>;
    diagnoseArchitecturalIssues(): Promise<void>;
    checkCircularDependencies(): Promise<HealingTask | null>;
    checkCodeDuplication(): Promise<HealingTask | null>;
    checkComplexity(): Promise<HealingTask | null>;
    diagnoseDependencyIssues(): Promise<void>;
    diagnoseNetworkIssues(): Promise<void>;
    runHealingCycle(): Promise<void>;
    executeHealingTask(task: HealingTask): Promise<void>;
    healSyntaxIssues(task: HealingTask): Promise<HealingResult>;
    healSecurityIssues(task: HealingTask): Promise<HealingResult>;
    healDependencyIssues(task: HealingTask): Promise<HealingResult>;
    healNetworkIssues(task: HealingTask): Promise<HealingResult>;
    healGenericIssue(task: HealingTask): Promise<HealingResult>;
    private addHealingTask;
    private removeTask;
    private findSourceFiles;
    private findFiles;
    getStatus(): object;
    stop(): void;
}
export { AdvancedHealingSystem };
//# sourceMappingURL=advanced-healing-system.d.ts.map