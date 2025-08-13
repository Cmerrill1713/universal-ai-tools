import type { VisionDebugData } from '../types/index.js';
interface ScreenshotAnalysis {
    id: string;
    timestamp: Date;
    screenshotPath: string;
    detectedElements: UIElement[];
    consoleErrors: ConsoleError[];
    networkIssues: NetworkIssue[];
    performanceMetrics: PerformanceMetric[];
    suggestions: DebugSuggestion[];
}
interface UIElement {
    type: 'button' | 'input' | 'error' | 'warning' | 'console' | 'network';
    coordinates: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    text?: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    description: string;
}
interface ConsoleError {
    type: 'error' | 'warning' | 'info';
    message: string;
    file?: string;
    line?: number;
    severity: 'critical' | 'high' | 'medium' | 'low';
}
interface NetworkIssue {
    url: string;
    status: number;
    method: string;
    responseTime?: number;
    error?: string;
}
interface PerformanceMetric {
    metric: string;
    value: number;
    threshold: number;
    status: 'good' | 'warning' | 'critical';
}
interface DebugSuggestion {
    id: string;
    category: 'ui' | 'console' | 'network' | 'performance';
    priority: 'high' | 'medium' | 'low';
    issue: string;
    solution: string;
    autoFixable: boolean;
    fixCommand?: string;
}
declare class VisionBrowserDebugger {
    private isRunning;
    private screenshotInterval;
    private screenshotsPath;
    private allowedScreenshotRoots;
    private analysisResults;
    private visionServiceUrl;
    constructor();
    private validatePath;
    private validateCommand;
    private readonly ALLOWED_AUTO_FIX_COMMANDS;
    private validateAutoFixCommand;
    private escapeShellArg;
    private executeSecureCommand;
    start(): Promise<void>;
    captureAndAnalyzeBrowser(): Promise<void>;
    captureDevToolsScreenshot(): Promise<string | null>;
    analyzeScreenshot(screenshotPath: string): Promise<ScreenshotAnalysis>;
    callVisionService(imagePath: string): Promise<any>;
    private generateFallbackAnalysis;
    private generateMockConsoleErrors;
    private generateMockNetworkIssues;
    private generateMockUIElements;
    private generateMockPerformanceMetrics;
    extractConsoleErrors(visionData: VisionDebugData): ConsoleError[];
    extractUIElements(visionData: VisionDebugData): UIElement[];
    extractNetworkIssues(visionData: VisionDebugData): NetworkIssue[];
    extractPerformanceMetrics(visionData: VisionDebugData): PerformanceMetric[];
    generateDebugSuggestions(analysis: ScreenshotAnalysis): DebugSuggestion[];
    createConsoleErrorSuggestion(error: ConsoleError): DebugSuggestion;
    createNetworkIssueSuggestion(issue: NetworkIssue): DebugSuggestion;
    createPerformanceSuggestion(metric: PerformanceMetric): DebugSuggestion;
    createUIElementSuggestion(element: UIElement): DebugSuggestion;
    processAnalysisResults(analysis: ScreenshotAnalysis): Promise<void>;
    executeAutoFix(suggestion: DebugSuggestion): Promise<void>;
    classifyErrorType(message: string): 'error' | 'warning' | 'info';
    calculateErrorSeverity(message: string): 'critical' | 'high' | 'medium' | 'low';
    private ensureDirectories;
    getStatus(): object;
    getRecentAnalyses(count?: number): ScreenshotAnalysis[];
    stop(): void;
}
export { VisionBrowserDebugger };
//# sourceMappingURL=vision-browser-debugger.d.ts.map