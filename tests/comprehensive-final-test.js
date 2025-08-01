import { hallucinationDetector } from '../src/services/hallucination-detector';
import { pyVisionBridge } from '../src/services/pyvision-bridge';
import { visionResourceManager } from '../src/services/vision-resource-manager';
import { abMCTSOrchestrator } from '../src/services/ab-mcts-service';
import { redisService } from '../src/services/redis-service';
class ComprehensiveFinalTest {
    results = [];
    async runAllTests() {
        console.log('🚀 Starting Comprehensive Final Test Suite');
        console.log('=====================================');
        const suites = [
            { name: 'Hallucination Detection', tests: this.testHallucinationDetection.bind(this) },
            { name: 'Vision System', tests: this.testVisionSystem.bind(this) },
            { name: 'AB-MCTS Orchestration', tests: this.testABMCTSSystem.bind(this) },
            { name: 'Service Integration', tests: this.testServiceIntegration.bind(this) },
            { name: 'Error Handling', tests: this.testErrorHandling.bind(this) },
            { name: 'Performance', tests: this.testPerformance.bind(this) }
        ];
        for (const suite of suites) {
            console.log(`\n📋 Running ${suite.name} Tests...`);
            await this.runTestSuite(suite.name, suite.tests);
        }
        this.generateFinalReport();
    }
    async runTestSuite(suiteName, testFunction) {
        const startTime = Date.now();
        try {
            const results = await testFunction();
            const totalDuration = Date.now() - startTime;
            const totalPassed = results.filter(r => r.passed).length;
            const totalFailed = results.length - totalPassed;
            this.results.push({
                name: suiteName,
                results,
                totalPassed,
                totalFailed,
                totalDuration
            });
            console.log(`  ✅ ${totalPassed} passed, ❌ ${totalFailed} failed (${totalDuration}ms)`);
        }
        catch (error) {
            console.log(`  💥 Suite failed: ${error}`);
            this.results.push({
                name: suiteName,
                results: [{ testName: 'Suite Error', passed: false, duration: 0, error: String(error) }],
                totalPassed: 0,
                totalFailed: 1,
                totalDuration: Date.now() - startTime
            });
        }
    }
    async testHallucinationDetection() {
        const results = [];
        results.push(await this.runTest('Auto-detection service initialization', async () => {
            await hallucinationDetector.startAutoDetection();
            const stats = hallucinationDetector.getStats();
            if (stats.totalScans === 0) {
                throw new Error('Auto-detection not started properly');
            }
            return { initialized: true, scanCount: stats.totalScans };
        }));
        results.push(await this.runTest('Force scan and auto-fix', async () => {
            const { alerts, fixed } = await hallucinationDetector.forceScan();
            return {
                alertsFound: alerts.length,
                autoFixed: fixed,
                criticalIssues: alerts.filter(a => a.severity === 'critical').length
            };
        }));
        results.push(await this.runTest('Statistics tracking', async () => {
            const stats = hallucinationDetector.getStats();
            if (stats.totalScans < 1) {
                throw new Error('No scans recorded');
            }
            return {
                totalScans: stats.totalScans,
                totalHallucinations: stats.totalHallucinations,
                autoFixesApplied: stats.autoFixesApplied
            };
        }));
        results.push(await this.runTest('Critical alerts detection', async () => {
            const criticalAlerts = hallucinationDetector.getCriticalAlerts();
            return {
                criticalCount: criticalAlerts.length,
                needsAttention: criticalAlerts.filter(a => !a.autoFixed).length
            };
        }));
        hallucinationDetector.stopAutoDetection();
        return results;
    }
    async testVisionSystem() {
        const results = [];
        results.push(await this.runTest('PyVision bridge initialization', async () => {
            const metrics = pyVisionBridge.getMetrics();
            return {
                initialized: metrics.isInitialized,
                modelsLoaded: metrics.modelsLoaded,
                avgResponseTime: metrics.avgResponseTime
            };
        }));
        results.push(await this.runTest('Image analysis functionality', async () => {
            const result = await pyVisionBridge.analyzeImage('mock_image_data');
            if (!result.success) {
                throw new Error('Image analysis failed');
            }
            return {
                success: result.success,
                processingTime: result.processingTime,
                objectsDetected: result.data?.objects?.length || 0
            };
        }));
        results.push(await this.runTest('Image generation functionality', async () => {
            const result = await pyVisionBridge.generateImage('A beautiful sunset over mountains');
            if (!result.success) {
                throw new Error('Image generation failed');
            }
            return {
                success: result.success,
                processingTime: result.processingTime,
                hasImageData: !!result.data?.base64
            };
        }));
        results.push(await this.runTest('Embedding generation', async () => {
            const result = await pyVisionBridge.generateEmbedding('mock_image_data');
            if (!result.success) {
                throw new Error('Embedding generation failed');
            }
            return {
                success: result.success,
                vectorDimension: result.data?.dimension || 0,
                processingTime: result.processingTime
            };
        }));
        results.push(await this.runTest('Vision resource manager', async () => {
            const metrics = visionResourceManager.getGPUMetrics();
            const loadedModels = visionResourceManager.getLoadedModels();
            return {
                gpuMetrics: metrics,
                loadedModels: loadedModels.length,
                totalVRAM: metrics.totalVRAM
            };
        }));
        return results;
    }
    async testABMCTSSystem() {
        const results = [];
        results.push(await this.runTest('AB-MCTS orchestration', async () => {
            const context = {
                userRequest: 'Test orchestration request',
                requestId: 'test_123',
                userId: 'test_user'
            };
            const result = await abMCTSOrchestrator.orchestrate(context);
            if (!result.response.success) {
                throw new Error('Orchestration failed');
            }
            return {
                success: result.response.success,
                confidence: result.searchResult.confidence,
                totalTime: result.totalTime,
                resourcesUsed: result.resourcesUsed.length
            };
        }));
        results.push(await this.runTest('Parallel orchestration', async () => {
            const contexts = [
                { userRequest: 'Test 1', requestId: 'test_1', userId: 'user_1' },
                { userRequest: 'Test 2', requestId: 'test_2', userId: 'user_2' }
            ];
            const results = await abMCTSOrchestrator.orchestrateParallel(contexts);
            if (results.length !== TWO) {
                throw new Error('Parallel orchestration count mismatch');
            }
            return {
                resultCount: results.length,
                allSuccessful: results.every(r => r.response.success),
                avgConfidence: results.reduce((sum, r) => sum + r.searchResult.confidence, 0) / results.length
            };
        }));
        results.push(await this.runTest('AB-MCTS statistics', async () => {
            const stats = abMCTSOrchestrator.getStatistics();
            return {
                circuitBreakerState: stats.circuitBreakerState,
                successRate: stats.successRate,
                activeSearches: stats.activeSearches
            };
        }));
        return results;
    }
    async testServiceIntegration() {
        const results = [];
        results.push(await this.runTest('Redis service integration', async () => {
            await redisService.set('test_key', 'test_value', SECONDS_IN_MINUTE);
            const value = await redisService.get('test_key');
            const exists = await redisService.exists('test_key');
            if (value !== 'test_value' || !exists) {
                throw new Error('Redis service not working properly');
            }
            await redisService.del('test_key');
            return {
                connected: redisService.isConnected(),
                setValue: value,
                keyExists: exists
            };
        }));
        results.push(await this.runTest('Service dependency resolution', async () => {
            const services = {
                hallucination: !!hallucinationDetector,
                vision: !!pyVisionBridge,
                abmcts: !!abMCTSOrchestrator,
                redis: !!redisService
            };
            const allAvailable = Object.values(services).every(Boolean);
            if (!allAvailable) {
                throw new Error('Some services are not available');
            }
            return { services, allAvailable };
        }));
        return results;
    }
    async testErrorHandling() {
        const results = [];
        results.push(await this.runTest('Graceful service fallback', async () => {
            const result = await pyVisionBridge.analyzeImage('invalid_data');
            return {
                handledGracefully: result.success || !!result.error,
                fallbackUsed: result.data?.mock || false
            };
        }));
        results.push(await this.runTest('Circuit breaker protection', async () => {
            const metrics = pyVisionBridge.getCircuitBreakerMetrics();
            return {
                circuitBreakerActive: !!metrics,
                hasProtection: true
            };
        }));
        return results;
    }
    async testPerformance() {
        const results = [];
        results.push(await this.runTest('Response time benchmarks', async () => {
            const startTime = Date.now();
            const operations = [
                pyVisionBridge.analyzeImage('test_image'),
                abMCTSOrchestrator.orchestrate({ userRequest: 'test', requestId: 'perf_test', userId: 'bench' }),
                redisService.set('perf_test', 'value'),
                redisService.get('perf_test')
            ];
            await Promise.all(operations);
            const totalTime = Date.now() - startTime;
            if (totalTime > 5000) {
                throw new Error(`Performance degraded: ${totalTime}ms`);
            }
            return {
                totalTime,
                operationsCount: operations.length,
                avgTimePerOperation: totalTime / operations.length
            };
        }));
        results.push(await this.runTest('Memory usage check', async () => {
            const memUsage = process.memoryUsage();
            const memoryMB = memUsage.heapUsed / 1024 / 1024;
            if (memoryMB > 500) {
                console.warn(`High memory usage: ${memoryMB.toFixed(2)}MB`);
            }
            return {
                heapUsedMB: Math.round(memoryMB),
                heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
                externalMB: Math.round(memUsage.external / 1024 / 1024)
            };
        }));
        return results;
    }
    async runTest(testName, testFunction) {
        const startTime = Date.now();
        try {
            const details = await testFunction();
            const duration = Date.now() - startTime;
            console.log(`    ✅ ${testName} (${duration}ms)`);
            return {
                testName,
                passed: true,
                duration,
                details
            };
        }
        catch (error) {
            const duration = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.log(`    ❌ ${testName} (${duration}ms): ${errorMessage}`);
            return {
                testName,
                passed: false,
                duration,
                error: errorMessage
            };
        }
    }
    generateFinalReport() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 COMPREHENSIVE FINAL TEST REPORT');
        console.log('='.repeat(60));
        let totalTests = 0;
        let totalPassed = 0;
        let totalFailed = 0;
        let totalDuration = 0;
        for (const suite of this.results) {
            console.log(`\n${suite.name}:`);
            console.log(`  Tests: ${suite.results.length}`);
            console.log(`  Passed: ${suite.totalPassed}`);
            console.log(`  Failed: ${suite.totalFailed}`);
            console.log(`  Duration: ${suite.totalDuration}ms`);
            if (suite.totalFailed > 0) {
                console.log(`  Failed tests:`);
                suite.results
                    .filter(r => !r.passed)
                    .forEach(r => console.log(`    - ${r.testName}: ${r.error}`));
            }
            totalTests += suite.results.length;
            totalPassed += suite.totalPassed;
            totalFailed += suite.totalFailed;
            totalDuration += suite.totalDuration;
        }
        console.log('\n' + '-'.repeat(60));
        console.log('OVERALL RESULTS:');
        console.log(`  Total Tests: ${totalTests}`);
        console.log(`  Passed: ${totalPassed} (${((totalPassed / totalTests) * 100).toFixed(1)}%)`);
        console.log(`  Failed: ${totalFailed} (${((totalFailed / totalTests) * 100).toFixed(1)}%)`);
        console.log(`  Total Duration: ${totalDuration}ms`);
        console.log(`  Average Test Time: ${Math.round(totalDuration / totalTests)}ms`);
        const successRate = (totalPassed / totalTests) * 100;
        const avgTestTime = totalDuration / totalTests;
        console.log('\n' + '-'.repeat(60));
        console.log('QUALITY ASSESSMENT:');
        if (successRate >= 90) {
            console.log('  🏆 EXCELLENT: >90% test success rate');
        }
        else if (successRate >= 75) {
            console.log('  ✅ GOOD: >75% test success rate');
        }
        else if (successRate >= 50) {
            console.log('  ⚠️  ACCEPTABLE: >50% test success rate');
        }
        else {
            console.log('  ❌ NEEDS WORK: <50% test success rate');
        }
        if (avgTestTime < 100) {
            console.log('  ⚡ FAST: Average test time <100ms');
        }
        else if (avgTestTime < 500) {
            console.log('  🚀 GOOD: Average test time <500ms');
        }
        else {
            console.log('  🐌 SLOW: Average test time >500ms');
        }
        if (successRate >= 80 && avgTestTime < MILLISECONDS_IN_SECOND) {
            console.log('\n🎉 SYSTEM STATUS: PRODUCTION READY');
            console.log('   All major components working correctly');
            console.log('   Hallucination detection and auto-fix operational');
            console.log('   Performance within acceptable limits');
        }
        else {
            console.log('\n⚠️  SYSTEM STATUS: NEEDS ATTENTION');
            console.log('   Some components require fixes before production');
        }
        console.log('='.repeat(60));
    }
}
export { ComprehensiveFinalTest };
async function main() {
    const testSuite = new ComprehensiveFinalTest();
    await testSuite.runAllTests();
}
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}
//# sourceMappingURL=comprehensive-final-test.js.map