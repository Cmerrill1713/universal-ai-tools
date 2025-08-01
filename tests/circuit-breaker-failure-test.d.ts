declare class CircuitBreakerFailureTests {
    private circuitBreaker;
    private testResults;
    private alertsTriggered;
    constructor();
    private setupAlertMonitoring;
    runAllTests(): Promise<void>;
    testDatabaseCircuitBreaker(): Promise<void>;
    testHttpServiceCircuitBreakers(): Promise<void>;
    testRedisCircuitBreaker(): Promise<void>;
    testAIServiceCircuitBreakers(): Promise<void>;
    testMonitoringAndAlerts(): Promise<void>;
    private runTest;
    private generateReport;
    private generateRecommendations;
    private sleep;
}
export { CircuitBreakerFailureTests };
//# sourceMappingURL=circuit-breaker-failure-test.d.ts.map