import { CircuitBreakerService, } from '../src/services/circuit-breaker';
class CircuitBreakerFailureTests {
    circuitBreaker;
    testResults = [];
    alertsTriggered = [];
    constructor() {
        this.
            circuitBreaker = new CircuitBreakerService();
        this.setupAlertMonitoring();
    }
    setupAlertMonitoring() {
        this.circuitBreaker.on('circuit-open', (data) => {
            this.alertsTriggered.push(`ALERT: Circuit ${data.name} opened`);
            console.log(`🔴 ALERT: Circuit breaker ${data.name} opened!`);
        });
        this.circuitBreaker.on('circuit-close', (data) => {
            this.alertsTriggered.push(`ALERT: Circuit ${data.name} closed`);
            console.log(`🟢 ALERT: Circuit breaker ${data.name} closed!`);
        });
    }
    async runAllTests() {
        console.log('🧪 Starting Circuit Breaker Failure Tests...\n');
        await this.testDatabaseCircuitBreaker();
        await this.testHttpServiceCircuitBreakers();
        await this.testRedisCircuitBreaker();
        await this.testAIServiceCircuitBreakers();
        await this.testMonitoringAndAlerts();
        this.generateReport();
    }
    async testDatabaseCircuitBreaker() {
        const suite = {
            suiteName: 'Database Circuit Breaker Tests',
            results: [],
            summary: { total: 0, passed: 0, failed: 0, openCircuits: [] },
        };
        console.log('📊 Testing Database Circuit Breaker...');
        await this.runTest(suite, 'Database Connection Failures', async () => {
            let fallbackTriggered = false;
            for (let i = 0; i < 10; i++) {
                try {
                    await this.circuitBreaker.databaseQuery('user-lookup', async () => {
                        throw new Error('Connection refused');
                    }, {
                        fallback: () => {
                            fallbackTriggered = true;
                            throw new Error('Database temporarily unavailable');
                        },
                    });
                }
                catch (error) {
                }
                await this.sleep(100);
            }
            const metrics = this.circuitBreaker.getMetrics('db-user-lookup');
            return {
                success: metrics?.state === 'open' && fallbackTriggered,
                fallbackTriggered,
                metrics,
            };
        });
        await this.runTest(suite, 'Database Timeout Scenarios', async () => {
            let fallbackTriggered = false;
            for (let i = 0; i < 6; i++) {
                try {
                    await this.circuitBreaker.databaseQuery('slow-query', async () => {
                        return new Promise((resolve) => {
                            setTimeout(resolve, 6000);
                        });
                    }, {
                        timeout: MILLISECONDS_IN_SECOND,
                        fallback: () => {
                            fallbackTriggered = true;
                            throw new Error('Query timeout');
                        },
                    });
                }
                catch (error) {
                }
                await this.sleep(200);
            }
            const metrics = this.circuitBreaker.getMetrics('db-slow-query');
            return {
                success: metrics?.timeouts > 0 && fallbackTriggered,
                fallbackTriggered,
                metrics,
            };
        });
        await this.runTest(suite, 'Database Recovery After Restoration', async () => {
            this.circuitBreaker.reset('db-user-lookup');
            await this.sleep(1000);
            let successCount = 0;
            for (let i = 0; i < 5; i++) {
                try {
                    await this.circuitBreaker.databaseQuery('user-lookup', async () => {
                        return { id: i, name: `User ${i}` };
                    });
                    successCount++;
                }
                catch (error) {
                }
                await this.sleep(100);
            }
            const metrics = this.circuitBreaker.getMetrics('db-user-lookup');
            return {
                success: metrics?.state === 'closed' && successCount === 5,
                fallbackTriggered: false,
                metrics,
            };
        });
        this.testResults.push(suite);
    }
    async testHttpServiceCircuitBreakers() {
        const suite = {
            suiteName: 'HTTP Service Circuit Breaker Tests',
            results: [],
            summary: { total: 0, passed: 0, failed: 0, openCircuits: [] },
        };
        console.log('🌐 Testing HTTP Service Circuit Breakers...');
        await this.runTest(suite, 'External API Failures', async () => {
            let fallbackTriggered = false;
            for (let i = 0; i < 8; i++) {
                try {
                    await this.circuitBreaker.httpRequest('external-api', {
                        url: 'https://httpstat.us/500',
                        timeout: 5000,
                    }, {
                        fallback: () => {
                            fallbackTriggered = true;
                            return { data: null, fallback: true };
                        },
                    });
                }
                catch (error) {
                }
                await this.sleep(200);
            }
            const metrics = this.circuitBreaker.getMetrics('external-api');
            return {
                success: metrics?.failures > 0 && fallbackTriggered,
                fallbackTriggered,
                metrics,
            };
        });
        await this.runTest(suite, 'HTTP Timeout and Retry Logic', async () => {
            let fallbackTriggered = false;
            for (let i = 0; i < 5; i++) {
                try {
                    await this.circuitBreaker.httpRequest('slow-api', {
                        url: 'https://httpstat.us/200?sleep=10000',
                        timeout: 2000,
                    }, {
                        timeout: 2000,
                        fallback: () => {
                            fallbackTriggered = true;
                            return { data: null, fallback: true };
                        },
                    });
                }
                catch (error) {
                }
                await this.sleep(300);
            }
            const metrics = this.circuitBreaker.getMetrics('slow-api');
            return {
                success: metrics?.timeouts > 0 && fallbackTriggered,
                fallbackTriggered,
                metrics,
            };
        });
        await this.runTest(suite, 'Circuit Breaker Thresholds', async () => {
            let fallbackTriggered = false;
            for (let i = 0; i < THREE; i++) {
                try {
                    await this.circuitBreaker.httpRequest('threshold-test', {
                        url: 'https://httpstat.us/503',
                    }, {
                        errorThresholdPercentage: 30,
                        fallback: () => {
                            fallbackTriggered = true;
                            return { data: null, fallback: true };
                        },
                    });
                }
                catch (error) {
                }
                await this.sleep(100);
            }
            const metrics = this.circuitBreaker.getMetrics('threshold-test');
            return {
                success: metrics?.state === 'open' || metrics?.failures > 0,
                fallbackTriggered,
                metrics,
            };
        });
        this.testResults.push(suite);
    }
    async testRedisCircuitBreaker() {
        const suite = {
            suiteName: 'Redis Circuit Breaker Tests',
            results: [],
            summary: { total: 0, passed: 0, failed: 0, openCircuits: [] },
        };
        console.log('🔴 Testing Redis Circuit Breaker...');
        await this.runTest(suite, 'Redis Connection Failures', async () => {
            let fallbackTriggered = false;
            for (let i = 0; i < 6; i++) {
                try {
                    await this.circuitBreaker.redisOperation('get', async () => {
                        throw new Error('Redis connection failed');
                    }, {
                        fallback: () => {
                            fallbackTriggered = true;
                            return null;
                        },
                    });
                }
                catch (error) {
                }
                await this.sleep(150);
            }
            const metrics = this.circuitBreaker.getMetrics('redis-get');
            return {
                success: metrics?.failures > 0 && fallbackTriggered,
                fallbackTriggered,
                metrics,
            };
        });
        await this.runTest(suite, 'Cache Fallback Behavior', async () => {
            let fallbackExecuted = false;
            try {
                const result = await this.circuitBreaker.redisOperation('cache-miss', async () => {
                    throw new Error('Redis unavailable');
                }, {
                    fallback: () => {
                        fallbackExecuted = true;
                        return null;
                    },
                });
                return {
                    success: result === null && fallbackExecuted,
                    fallbackTriggered: fallbackExecuted,
                    metrics: this.circuitBreaker.getMetrics('redis-cache-miss'),
                };
            }
            catch (error) {
                return {
                    success: false,
                    fallbackTriggered: fallbackExecuted,
                    metrics: this.circuitBreaker.getMetrics('redis-cache-miss'),
                };
            }
        });
        await this.runTest(suite, 'Redis Recovery Procedures', async () => {
            this.circuitBreaker.reset('redis-get');
            await this.sleep(500);
            let successCount = 0;
            for (let i = 0; i < THREE; i++) {
                try {
                    await this.circuitBreaker.redisOperation('recovery-test', async () => {
                        return `value-${i}`;
                    });
                    successCount++;
                }
                catch (error) {
                }
                await this.sleep(100);
            }
            const metrics = this.circuitBreaker.getMetrics('redis-recovery-test');
            return {
                success: metrics?.successes === 3 && successCount === THREE,
                fallbackTriggered: false,
                metrics,
            };
        });
        this.testResults.push(suite);
    }
    async testAIServiceCircuitBreakers() {
        const suite = {
            suiteName: 'AI Service Circuit Breaker Tests',
            results: [],
            summary: { total: 0, passed: 0, failed: 0, openCircuits: [] },
        };
        console.log('🤖 Testing AI Service Circuit Breakers...');
        await this.runTest(suite, 'Ollama Service Failures', async () => {
            let fallbackTriggered = false;
            for (let i = 0; i < 4; i++) {
                try {
                    await this.circuitBreaker.modelInference('llama2', async () => {
                        throw new Error('Ollama service unavailable');
                    }, {
                        fallback: () => {
                            fallbackTriggered = true;
                            throw new Error('Model temporarily unavailable');
                        },
                    });
                }
                catch (error) {
                }
                await this.sleep(200);
            }
            const metrics = this.circuitBreaker.getMetrics('model-llama2');
            return {
                success: metrics?.failures > 0 && fallbackTriggered,
                fallbackTriggered,
                metrics,
            };
        });
        await this.runTest(suite, 'Model Inference Failures', async () => {
            let fallbackTriggered = false;
            for (let i = 0; i < THREE; i++) {
                try {
                    await this.circuitBreaker.modelInference('gpt-3.5', async () => {
                        return new Promise((resolve) => {
                            setTimeout(resolve, 35000);
                        });
                    }, {
                        timeout: 5000,
                        fallback: () => {
                            fallbackTriggered = true;
                            throw new Error('Model inference timeout');
                        },
                    });
                }
                catch (error) {
                }
                await this.sleep(300);
            }
            const metrics = this.circuitBreaker.getMetrics('model-gpt-3.5');
            return {
                success: metrics?.timeouts > 0 && fallbackTriggered,
                fallbackTriggered,
                metrics,
            };
        });
        await this.runTest(suite, 'Alternative Model Fallbacks', async () => {
            let fallbackExecuted = false;
            try {
                const result = await this.circuitBreaker.modelInference('claude-3', async () => {
                    throw new Error('Claude model unavailable');
                }, {
                    fallback: async () => {
                        fallbackExecuted = true;
                        return 'Fallback response from simpler model';
                    },
                });
                return {
                    success: result === 'Fallback response from simpler model' && fallbackExecuted,
                    fallbackTriggered: fallbackExecuted,
                    metrics: this.circuitBreaker.getMetrics('model-claude-3'),
                };
            }
            catch (error) {
                return {
                    success: false,
                    fallbackTriggered: fallbackExecuted,
                    metrics: this.circuitBreaker.getMetrics('model-claude-3'),
                };
            }
        });
        this.testResults.push(suite);
    }
    async testMonitoringAndAlerts() {
        const suite = {
            suiteName: 'Monitoring and Alerts Tests',
            results: [],
            summary: { total: 0, passed: 0, failed: 0, openCircuits: [] },
        };
        console.log('📊 Testing Monitoring and Alerts...');
        await this.runTest(suite, 'Circuit Breaker Metrics Collection', async () => {
            const allMetrics = this.circuitBreaker.getAllMetrics();
            const hasMetrics = allMetrics.length > 0;
            const validMetrics = allMetrics.every((metric) => metric.name &&
                typeof metric.requests === 'number' &&
                typeof metric.failures === 'number' &&
                typeof metric.successes === 'number');
            return {
                success: hasMetrics && validMetrics,
                fallbackTriggered: false,
                metrics: { totalCircuits: allMetrics.length, allMetrics },
            };
        });
        await this.runTest(suite, 'Alert Generation', async () => {
            const alertsCount = this.alertsTriggered.length;
            return {
                success: alertsCount > 0,
                fallbackTriggered: false,
                metrics: {
                    alertsTriggered: this.alertsTriggered,
                    alertCount: alertsCount,
                },
            };
        });
        await this.runTest(suite, 'Health Check Functionality', async () => {
            const healthCheck = this.circuitBreaker.healthCheck();
            const hasValidStructure = typeof healthCheck.healthy === 'boolean' &&
                Array.isArray(healthCheck.openCircuits) &&
                Array.isArray(healthCheck.metrics);
            return {
                success: hasValidStructure,
                fallbackTriggered: false,
                metrics: healthCheck,
            };
        });
        this.testResults.push(suite);
    }
    async runTest(suite, testName, testFn) {
        const startTime = Date.now();
        console.log(`  🧪 Running: ${testName}`);
        try {
            const result = await testFn();
            const duration = Date.now() - startTime;
            const testResult = {
                testName,
                success: result.success,
                circuitState: result.metrics?.state || 'unknown',
                metrics: result.metrics,
                duration,
                fallbackTriggered: result.fallbackTriggered,
            };
            suite.results.push(testResult);
            suite.summary.total++;
            if (result.success) {
                suite.summary.passed++;
                console.log(`    ✅ PASSED (${duration}ms)`);
            }
            else {
                suite.summary.failed++;
                console.log(`    ❌ FAILED (${duration}ms)`);
            }
            if (result.metrics?.
                state === 'open') {
                suite.summary.openCircuits.push(testName);
            }
        }
        catch (error) {
            const duration = Date.now() - startTime;
            const testResult = {
                testName,
                success: false,
                circuitState: 'error',
                metrics: null,
                error: error instanceof Error ? error.message : String(error),
                duration,
                fallbackTriggered: false,
            };
            suite.results.push(testResult);
            suite.summary.total++;
            suite.summary.failed++;
            console.log(`    ❌ ERROR: ${error} (${duration}ms)`);
        }
    }
    generateReport() {
        console.log('\n📋 Circuit Breaker Test Report');
        console.log('='.repeat(50));
        let totalTests = 0;
        let totalPassed = 0;
        let totalFailed = 0;
        let allOpenCircuits = [];
        this.testResults.forEach((suite) => {
            console.log(`\n${suite.suiteName}:`);
            console.log(`  Total: ${suite.summary.total}, Passed: ${suite.summary.passed}, Failed: ${suite.summary.failed}`);
            if (suite.summary.openCircuits.length > 0) {
                console.log(`  Open Circuits: ${suite.summary.openCircuits.join(', ')}`);
                allOpenCircuits.push(...suite.summary.openCircuits);
            }
            totalTests += suite.summary.total;
            totalPassed += suite.summary.passed;
            totalFailed += suite.summary.failed;
        });
        console.log('\n📊 Overall Summary:');
        console.log(`  Total Tests: ${totalTests}`);
        console.log(`  Passed: ${totalPassed} (${((totalPassed / totalTests) * 100).toFixed(1)}%)`);
        console.log(`  Failed: ${totalFailed} (${((totalFailed / totalTests) * 100).toFixed(1)}%)`);
        if (allOpenCircuits.length > 0) {
            console.log(`  🔴 Open Circuits: ${allOpenCircuits.length}`);
        }
        console.log('\n🚨 Alerts Triggered:');
        this.alertsTriggered.forEach((alert) => console.log(`  ${alert}`));
        console.log('\n💡 Recommendations:');
        this.generateRecommendations();
        console.log('\n🏥 Final Health Check:');
        const finalHealth = this.circuitBreaker.healthCheck();
        console.log(`  System Healthy: ${finalHealth.healthy ? '✅' : '❌'}`);
        console.log(`  Open Circuits: ${finalHealth.openCircuits.length}`);
    }
    generateRecommendations() {
        const recommendations = [
            '1. Monitor failure rates continuously',
            '2. Adjust timeout values based on service SLAs',
            '3. Implement progressive fallback strategies',
            '4. Set up automated alerts for circuit state changes',
            '5. Consider implementing bulkhead pattern for isolation',
            '6. Regular testing of circuit breaker thresholds',
            '7. Implement graceful degradation for critical services',
        ];
        recommendations.forEach((rec) => console.log(`  ${rec}`));
    }
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
export { CircuitBreakerFailureTests };
if (require.main === module) {
    const tests = new CircuitBreakerFailureTests();
    tests.runAllTests().catch(console.error);
}
//# sourceMappingURL=circuit-breaker-failure-test.js.map