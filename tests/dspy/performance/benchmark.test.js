import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { DSPyService } from '../../../src/services/dspy-service';
import { EnhancedOrchestrator } from '../../../src/agents/enhanced_orchestrator';
import { logger } from '../../../src/utils/logger';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';
describe('DSPy Performance Benchmarks', () => {
    let dspyService;
    let oldOrchestrator;
    let benchmarkResults = [];
    const ITERATIONS = 10;
    const WARMUP_ITERATIONS = THREE;
    beforeAll(async () => {
        logger.info('🏁 Starting performance benchmarks...');
        dspyService = new DSPyService();
        oldOrchestrator = new EnhancedOrchestrator({
            supabaseUrl: process.env.SUPABASE_URL || 'http://localhost:54321',
            supabaseKey: process.env.SUPABASE_SERVICE_KEY || 'test-key',
            enableMLX: false,
            enableAdaptiveTools: false,
            enableCaching: false,
        });
        await new Promise((resolve) => setTimeout(resolve, 5000));
        await runWarmup();
    });
    afterAll(async () => {
        await generateBenchmarkReport();
        await dspyService.shutdown();
    });
    async function runWarmup() {
        logger.info('Running warmup iterations...');
        for (let i = 0; i < WARMUP_ITERATIONS; i++) {
            await dspyService.orchestrate({
                requestId: uuidv4(),
                userRequest: 'Warmup request',
                userId: 'warmup',
                timestamp: new Date(),
            });
            await oldOrchestrator.processRequest({
                requestId: uuidv4(),
                userRequest: 'Warmup request',
                userId: 'warmup',
                timestamp: new Date(),
            });
        }
    }
    async function measurePerformance(name, oldSystemFn, newSystemFn) {
        const oldMetrics = {
            times: [],
            successes: 0,
            memoryUsages: [],
        };
        const newMetrics = {
            times: [],
            successes: 0,
            memoryUsages: [],
        };
        for (let i = 0; i < ITERATIONS; i++) {
            const startMemory = process.memoryUsage().heapUsed;
            const startTime = performance.now();
            try {
                await oldSystemFn();
                oldMetrics.successes++;
            }
            catch (error) {
                logger.error(`Old system error in ${name}:`, error);
            }
            const endTime = performance.now();
            const endMemory = process.memoryUsage().heapUsed;
            oldMetrics.times.push(endTime - startTime);
            oldMetrics.memoryUsages.push(endMemory - startMemory);
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
        for (let i = 0; i < ITERATIONS; i++) {
            const startMemory = process.memoryUsage().heapUsed;
            const startTime = performance.now();
            try {
                await newSystemFn();
                newMetrics.successes++;
            }
            catch (error) {
                logger.error(`New system error in ${name}:`, error);
            }
            const endTime = performance.now();
            const endMemory = process.memoryUsage().heapUsed;
            newMetrics.times.push(endTime - startTime);
            newMetrics.memoryUsages.push(endMemory - startMemory);
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
        const oldStats = calculateStats(oldMetrics);
        const newStats = calculateStats(newMetrics);
        const result = {
            testName: name,
            oldSystem: oldStats,
            newSystem: newStats,
            improvement: {
                speedup: oldStats.avgTime / newStats.avgTime,
                memoryReduction: ((oldStats.memoryUsage - newStats.memoryUsage) / oldStats.memoryUsage) * 100,
                successRateChange: newStats.successRate - oldStats.successRate,
            },
        };
        benchmarkResults.push(result);
        return result;
    }
    function calculateStats(metrics) {
        const times = metrics.times.sort((a, b) => a - b);
        const memoryUsages = metrics.memoryUsages;
        return {
            avgTime: times.reduce((a, b) => a + b, 0) / times.length,
            minTime: times[0] || 0,
            maxTime: times[times.length - 1] || 0,
            successRate: (metrics.successes / ITERATIONS) * 100,
            memoryUsage: memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length,
        };
    }
    describe('Simple Request Orchestration', () => {
        it('should benchmark simple orchestration requests', async () => {
            const result = await measurePerformance('Simple Orchestration', async () => {
                await oldOrchestrator.processRequest({
                    requestId: uuidv4(),
                    userRequest: 'What is the weather today?',
                    userId: 'benchmark-user',
                    timestamp: new Date(),
                });
            }, async () => {
                await dspyService.orchestrate({
                    requestId: uuidv4(),
                    userRequest: 'What is the weather today?',
                    userId: 'benchmark-user',
                    orchestrationMode: 'simple',
                    timestamp: new Date(),
                });
            });
            logger.info(`Simple orchestration speedup: ${result.improvement.speedup.toFixed(2)}x`);
            expect(result.newSystem.successRate).toBeGreaterThanOrEqual(result.oldSystem.successRate);
            expect(result.improvement.speedup).toBeGreaterThan(0.8);
        });
    });
    describe('Complex Multi-Agent Coordination', () => {
        it('should benchmark complex agent coordination', async () => {
            const complexRequest = `
        Create a comprehensive data analysis system that:
        1. Reads data from multiple CSV files
        2. Performs statistical analysis
        3. Generates visualizations
        4. Creates a report with insights
        5. Implements caching for performance
      `;
            const result = await measurePerformance('Complex Agent Coordination', async () => {
                await oldOrchestrator.orchestrate(complexRequest, 'benchmark-user');
            }, async () => {
                await dspyService.orchestrate({
                    requestId: uuidv4(),
                    userRequest: complexRequest,
                    userId: 'benchmark-user',
                    orchestrationMode: 'cognitive',
                    timestamp: new Date(),
                });
            });
            logger.info(`Complex coordination speedup: ${result.improvement.speedup.toFixed(2)}x`);
            expect(result.newSystem.successRate).toBeGreaterThanOrEqual(95);
            expect(result.improvement.speedup).toBeGreaterThan(1.0);
        });
    });
    describe('Knowledge Search Performance', () => {
        it('should benchmark knowledge search operations', async () => {
            const searchQueries = [
                'TypeScript async await patterns',
                'Machine learning optimization techniques',
                'Docker container best practices',
                'React performance optimization',
                'PostgreSQL query optimization',
            ];
            const result = await measurePerformance('Knowledge Search', async () => {
                for (const query of searchQueries) {
                    await oldOrchestrator.orchestrate(`Search for information about: ${query}`, 'benchmark-user');
                }
            }, async () => {
                for (const query of searchQueries) {
                    await dspyService.searchKnowledge(query, { limit: 10 });
                }
            });
            logger.info(`Knowledge search speedup: ${result.improvement.speedup.toFixed(2)}x`);
            expect(result.improvement.speedup).toBeGreaterThan(1.5);
            expect(result.newSystem.successRate).toBe(100);
        });
    });
    describe('Concurrent Request Handling', () => {
        it('should benchmark concurrent request performance', async () => {
            const concurrentRequests = 5;
            const result = await measurePerformance('Concurrent Requests', async () => {
                const promises = Array.from({ length: concurrentRequests }, (_, i) => oldOrchestrator.orchestrate(`Concurrent request ${i}`, `user-${i}`));
                await Promise.all(promises);
            }, async () => {
                const promises = Array.from({ length: concurrentRequests }, (_, i) => dspyService.orchestrate({
                    requestId: uuidv4(),
                    userRequest: `Concurrent request ${i}`,
                    userId: `user-${i}`,
                    timestamp: new Date(),
                }));
                await Promise.all(promises);
            });
            logger.info(`Concurrent handling speedup: ${result.improvement.speedup.toFixed(2)}x`);
            expect(result.newSystem.successRate).toBeGreaterThanOrEqual(result.oldSystem.successRate);
            expect(result.improvement.speedup).toBeGreaterThan(1.2);
        });
    });
    describe('Memory Efficiency', () => {
        it('should benchmark memory usage for large contexts', async () => {
            const largeContext = {
                data: Array(1000)
                    .fill(0)
                    .map((_, i) => ({
                    id: i,
                    content: 'x'.repeat(1000),
                    metadata: { tags: ['tag1', 'tag2', 'tag3'] },
                })),
                history: Array(100).fill('Previous interaction'),
            };
            const result = await measurePerformance('Large Context Handling', async () => {
                await oldOrchestrator.orchestrate('Process this large dataset', 'benchmark-user', {
                    context: largeContext,
                });
            }, async () => {
                await dspyService.orchestrate({
                    requestId: uuidv4(),
                    userRequest: 'Process this large dataset',
                    userId: 'benchmark-user',
                    context: largeContext,
                    timestamp: new Date(),
                });
            });
            logger.info(`Memory efficiency improvement: ${result.improvement.memoryReduction.toFixed(2)}%`);
            expect(result.improvement.memoryReduction).toBeGreaterThan(0);
        });
    });
    describe('Adaptive Mode Performance', () => {
        it('should benchmark adaptive orchestration mode', async () => {
            const adaptiveRequests = [
                'Simple: What time is it?',
                'Medium: Explain quantum computing',
                'Complex: Design a microservices architecture for an e-commerce platform',
                'Simple: Hello',
                'Complex: Implement a distributed caching system with Redis',
            ];
            const result = await measurePerformance('Adaptive Mode', async () => {
                for (const request of adaptiveRequests) {
                    await oldOrchestrator.orchestrate(request, 'benchmark-user');
                }
            }, async () => {
                for (const request of adaptiveRequests) {
                    await dspyService.orchestrate({
                        requestId: uuidv4(),
                        userRequest: request,
                        userId: 'benchmark-user',
                        orchestrationMode: 'adaptive',
                        timestamp: new Date(),
                    });
                }
            });
            logger.info(`Adaptive mode speedup: ${result.improvement.speedup.toFixed(2)}x`);
            expect(result.improvement.speedup).toBeGreaterThan(1.3);
        });
    });
    describe('Error Recovery Performance', () => {
        it('should benchmark error handling and recovery', async () => {
            const problematicRequests = [
                { request: 'Normal request', shouldFail: false },
                { request: '', shouldFail: true },
                { request: 'Another normal request', shouldFail: false },
                { request: '🔥'.repeat(1000), shouldFail: true },
                { request: 'Final normal request', shouldFail: false },
            ];
            const result = await measurePerformance('Error Recovery', async () => {
                for (const { request } of problematicRequests) {
                    try {
                        await oldOrchestrator.orchestrate(request, 'benchmark-user');
                    }
                    catch (error) {
                    }
                }
            }, async () => {
                for (const { request } of problematicRequests) {
                    await dspyService.orchestrate({
                        requestId: uuidv4(),
                        userRequest: request,
                        userId: 'benchmark-user',
                        timestamp: new Date(),
                    });
                }
            });
            logger.info(`Error recovery speedup: ${result.improvement.speedup.toFixed(2)}x`);
            expect(result.newSystem.successRate).toBeGreaterThanOrEqual(60);
        });
    });
    async function generateBenchmarkReport() {
        const reportPath = path.join(process.cwd(), 'tests', 'dspy', 'performance', `benchmark-report-${new Date().toISOString().split('T')[0]}.json`);
        const summary = {
            timestamp: new Date().toISOString(),
            totalTests: benchmarkResults.length,
            averageSpeedup: benchmarkResults.reduce((sum, r) => sum + r.improvement.speedup, 0) /
                benchmarkResults.length,
            averageMemoryReduction: benchmarkResults.reduce((sum, r) => sum + r.improvement.memoryReduction, 0) /
                benchmarkResults.length,
            results: benchmarkResults,
            systemInfo: {
                node: process.version,
                platform: process.platform,
                arch: process.arch,
                memory: process.memoryUsage(),
            },
        };
        await fs.writeFile(reportPath, JSON.stringify(summary, null, TWO));
        logger.info(`\n📊 Benchmark Summary:`);
        logger.info(`Total Tests: ${summary.totalTests}`);
        logger.info(`Average Speedup: ${summary.averageSpeedup.toFixed(2)}x`);
        logger.info(`Average Memory Reduction: ${summary.averageMemoryReduction.toFixed(2)}%`);
        logger.info(`Report saved to: ${reportPath}`);
        logger.info('\n📈 Individual Test Results:');
        benchmarkResults.forEach((result) => {
            logger.info(`\n${result.testName}:`);
            logger.info(`  Speedup: ${result.improvement.speedup.toFixed(2)}x`);
            logger.info(`  Memory Reduction: ${result.improvement.memoryReduction.toFixed(2)}%`);
            logger.info(`  Success Rate Change: ${result.improvement.successRateChange.toFixed(2)}%`);
            logger.info(`  Old Avg Time: ${result.oldSystem.avgTime.toFixed(2)}ms`);
            logger.info(`  New Avg Time: ${result.newSystem.avgTime.toFixed(2)}ms`);
        });
    }
});
//# sourceMappingURL=benchmark.test.js.map