export interface HallucinationAlert {
    id: string;
    timestamp: number;
    type: 'MISSING_IMPORT' | 'UNDEFINED_REFERENCE' | 'SYNTAX_ERROR' | 'INVALID_PATH';
    severity: 'critical' | 'warning' | 'info';
    file: string;
    line?: number;
    message: string;
    autoFixAvailable: boolean;
    autoFixed: boolean;
}
export interface HallucinationStats {
    totalScans: number;
    totalHallucinations: number;
    autoFixesApplied: number;
    lastScanTime: number;
    criticalIssues: number;
    warningIssues: number;
    trendsLast24h: {
        detected: number;
        fixed: number;
        newIssues: number;
    };
}
declare class HallucinationDetectorService {
    private isRunning;
    private scanInterval;
    private intervalId;
    private projectRoot;
    private validator;
    private fixer;
    private alerts;
    private stats;
    private lastKnownIssues;
    private autoFixEnabled;
    constructor(projectRoot?: string);
    startAutoDetection(): Promise<void>;
    stopAutoDetection(): void;
    performScan(): Promise<HallucinationAlert[]>;
    getStats(): HallucinationStats;
    getRecentAlerts(limit?: number): HallucinationAlert[];
    getCriticalAlerts(): HallucinationAlert[];
    setAutoFixEnabled(enabled: boolean): void;
    setScanInterval(intervalMs: number): void;
    forceScan(): Promise<{
        alerts: HallucinationAlert[];
        fixed: number;
    }>;
    private processValidationReport;
    private canAutoFix;
    private applyAutoFixes;
    private createMissingService;
    private createMissingUtil;
    private generateServiceStub;
    private generateUtilStub;
    private toPascalCase;
    private toCamelCase;
    private updateStats;
}
export declare const hallucinationDetector: HallucinationDetectorService;
export default hallucinationDetector;
//# sourceMappingURL=hallucination-detector.d.ts.map