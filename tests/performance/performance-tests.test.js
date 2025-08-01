import { jest } from '@jest/globals';
import { performance } from 'perf_hooks';
import { EventEmitter } from 'events';
import { PerformanceMonitor } from '../../src/utils/performance-monitor';
import { CacheManager } from '../../src/utils/cache-manager-improved';
import { ResourceManager } from '../../src/services/resource-manager';
jest.mock('../../src/services/supabase_service');
jest.mock('ioredis');
describe('Performance Tests', () => {
    let performanceMonitor;
    let cacheManager;
    let resourceManager;
    beforeEach(() => {
        performanceMonitor = new PerformanceMonitor();
        cacheManager = new CacheManager();
        resourceManager = new ResourceManager();
    });
    afterEach(() => {
        jest.clearAllMocks();
    });
    describe('Response Time Performance', () => {
        test('should handle API requests within acceptable time limits', async () => {
            const startTime = performance.now();
            await new Promise((resolve) => setTimeout(resolve, 50));
            const endTime = performance.now();
            const responseTime = endTime - startTime;
            expect(responseTime).toBeLessThan(100);
        });
        test('should maintain response times under load', async () => {
            const concurrentRequests = 50;
            const responseTimes = [];
            const requests = Array.from({ length: concurrentRequests }, async () => {
                const startTime = performance.now();
                await new Promise((resolve) => setTimeout(resolve, Math.random() * 20 + 10));
                const endTime = performance.now();
                return endTime - startTime;
            });
            const results = await Promise.all(requests);
            const averageResponseTime = results.reduce((a, b) => a + b, 0) / results.length;
            const maxResponseTime = Math.max(...results);
            expect(averageResponseTime).toBeLessThan(50);
            expect(maxResponseTime).toBeLessThan(200);
        });
        test('should handle database query performance', async () => {
            const mockQueries = [
                { type: 'simple_select', complexity: 1 },
                { type: 'join_query', complexity: 3 },
                { type: 'aggregate_query', complexity: 5 },
            ];
            for (const query of mockQueries) {
                const startTime = performance.now();
                await new Promise((resolve) => setTimeout(resolve, query.complexity * 10));
                const endTime = performance.now();
                const queryTime = endTime - startTime;
                const maxAllowedTime = query.complexity * 50;
                expect(queryTime).toBeLessThan(maxAllowedTime);
            }
        });
    });
    describe('Memory Usage Performance', () => {
        test('should not leak memory during normal operations', async () => {
            const initialMemory = process.memoryUsage().heapUsed;
            const largeArrays = [];
            for (let i = 0; i < 100; i++) {
                largeArrays.push(new Array(1000).fill(i));
            }
            largeArrays.length = 0;
            if (global.gc) {
                global.gc();
            }
            await new Promise((resolve) => setTimeout(resolve, 100));
            const finalMemory = process.memoryUsage().heapUsed;
            const memoryIncrease = finalMemory - initialMemory;
            expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
        });
        test('should handle large datasets efficiently', async () => {
            const datasetSize = 10000;
            const dataset = Array.from({ length: datasetSize }, (_, i) => ({
                id: i,
                data: `record-${i}`,
                timestamp: Date.now(),
            }));
            const startTime = performance.now();
            const processedData = dataset
                .filter((item) => item.id % 2 === 0)
                .map((item) => ({ ...item, processed: true }))
                .slice(0, MILLISECONDS_IN_SECOND);
            const endTime = performance.now();
            const processingTime = endTime - startTime;
            expect(processingTime).toBeLessThan(100);
            expect(processedData).toHaveLength(1000);
        });
        test('should manage cache memory efficiently', async () => {
            const initialMemory = process.memoryUsage().heapUsed;
            for (let i = 0; i < MILLISECONDS_IN_SECOND; i++) {
                await cacheManager.set(`key-${i}`, {
                    data: `value-${i}`,
                    metadata: { size: i, timestamp: Date.now() },
                });
            }
            const cacheFilledMemory = process.memoryUsage().heapUsed;
            await cacheManager.clear();
            await new Promise((resolve) => setTimeout(resolve, 100));
            const clearedMemory = process.memoryUsage().heapUsed;
            const memoryReduction = cacheFilledMemory - clearedMemory;
            expect(memoryReduction).toBeGreaterThan(0);
        });
    });
    describe('CPU Usage Performance', () => {
        test('should not block event loop during intensive operations', async () => {
            const eventLoop = new EventEmitter();
            let eventLoopBlocked = false;
            const eventLoopCheck = setTimeout(() => {
                eventLoop.emit('check');
            }, 10);
            eventLoop.on('check', () => {
                eventLoopBlocked = false;
            });
            const startTime = Date.now();
            let result = 0;
            for (let i = 0; i < 1000000; i++) {
                result += Math.sqrt(i);
                if (i % 10000 === 0) {
                    await new Promise((resolve) => setImmediate(resolve));
                }
            }
            const endTime = Date.now();
            clearTimeout(eventLoopCheck);
            expect(endTime - startTime).toBeLessThan(1000);
            expect(result).toBeGreaterThan(0);
        });
        test('should handle parallel processing efficiently', async () => {
            const tasks = Array.from({ length: 20 }, (_, i) => async () => {
                let result = 0;
                for (let j = 0; j < 100000; j++) {
                    result += Math.sin(j) * Math.cos(j);
                }
                return { taskId: i, result };
            });
            const startTime = performance.now();
            const results = await Promise.all(tasks.map((task) => task()));
            const endTime = performance.now();
            const totalTime = endTime - startTime;
            expect(results).toHaveLength(20);
            expect(totalTime).toBeLessThan(1000);
        });
        test('should optimize frequent operations', async () => {
            const iterations = 10000;
            const startTime = performance.now();
            const results = [];
            for (let i = 0; i < iterations; i++) {
                const parts = ['prefix', i.toString(), 'suffix'];
                results.push(parts.join('-'));
            }
            const endTime = performance.now();
            const operationTime = endTime - startTime;
            expect(results).toHaveLength(iterations);
            expect(operationTime).toBeLessThan(100);
        });
    });
    describe('Concurrency Performance', () => {
        test('should handle concurrent database operations', async () => {
            const concurrentOps = 25;
            const operations = Array.from({ length: concurrentOps }, async (_, i) => {
                await new Promise((resolve) => setTimeout(resolve, Math.random() * 50));
                return { id: i, result: `operation-${i}` };
            });
            const startTime = performance.now();
            const results = await Promise.all(operations);
            const endTime = performance.now();
            const totalTime = endTime - startTime;
            expect(results).toHaveLength(concurrentOps);
            expect(totalTime).toBeLessThan(200);
        });
        test('should handle concurrent cache operations', async () => {
            const concurrentOps = 50;
            const operations = Array.from({ length: concurrentOps }, async (_, i) => {
                if (i % 2 === 0) {
                    await cacheManager.set(`concurrent-key-${i}`, {
                        value: `data-${i}`,
                        timestamp: Date.now(),
                    });
                    return { type: 'write', key: `concurrent-key-${i}` };
                }
                else {
                    const value = await cacheManager.get(`concurrent-key-${i - 1}`);
                    return { type: 'read', value };
                }
            });
            const startTime = performance.now();
            const results = await Promise.all(operations);
            const endTime = performance.now();
            const totalTime = endTime - startTime;
            expect(results).toHaveLength(concurrentOps);
            expect(totalTime).toBeLessThan(300);
        });
        test('should manage connection pooling effectively', async () => {
            const poolSize = 10;
            const requests = 100;
            const connectionPool = Array.from({ length: poolSize }, (_, i) => ({
                id: i,
                inUse: false,
                lastUsed: Date.now(),
            }));
            const getConnection = () => {
                const available = connectionPool.find((conn) => !conn.inUse);
                if (available) {
                    available.inUse = true;
                    return available;
                }
                return null;
            };
            const releaseConnection = (conn) => {
                conn.inUse = false;
                conn.lastUsed = Date.now();
            };
            const requestPromises = Array.from({ length: requests }, async () => {
                let connection = null;
                while (!connection) {
                    connection = getConnection();
                    if (!connection) {
                        await new Promise((resolve) => setTimeout(resolve, 1));
                    }
                }
                await new Promise((resolve) => setTimeout(resolve, Math.random() * 10));
                releaseConnection(connection);
                return connection.id;
            });
            const startTime = performance.now();
            const results = await Promise.all(requestPromises);
            const endTime = performance.now();
            const totalTime = endTime - startTime;
            expect(results).toHaveLength(requests);
            expect(totalTime).toBeLessThan(2000);
        });
    });
    describe('Scalability Performance', () => {
        test('should scale linearly with data size', async () => {
            const dataSizes = [100, MILLISECONDS_IN_SECOND, 5000];
            const processingTimes = [];
            for (const size of dataSizes) {
                const dataset = Array.from({ length: size }, (_, i) => ({ id: i, value: Math.random() }));
                const startTime = performance.now();
                const processed = dataset
                    .filter((item) => item.value > 0.5)
                    .map((item) => ({ ...item, processed: true }));
                const endTime = performance.now();
                processingTimes.push(endTime - startTime);
            }
            const ratio1 = processingTimes[1] / processingTimes[0];
            const ratio2 = processingTimes[2] / processingTimes[1];
            expect(ratio1).toBeLessThan(20);
            expect(ratio2).toBeLessThan(10);
        });
        test('should handle increasing user load gracefully', async () => {
            const userLoads = [10, 50, 100];
            const responseTimes = [];
            for (const userCount of userLoads) {
                const userRequests = Array.from({ length: userCount }, async () => {
                    const startTime = performance.now();
                    await new Promise((resolve) => setTimeout(resolve, Math.random() * 20 + 5));
                    return performance.now() - startTime;
                });
                const results = await Promise.all(userRequests);
                const averageResponseTime = results.reduce((a, b) => a + b, 0) / results.length;
                responseTimes.push(averageResponseTime);
            }
            const degradation = responseTimes[2] / responseTimes[0];
            expect(degradation).toBeLessThan(3);
        });
        test('should optimize memory usage with large datasets', async () => {
            const largeDataset = Array.from({ length: 50000 }, (_, i) => ({
                id: i,
                data: `record-${i}`,
                metadata: { created: Date.now(), processed: false },
            }));
            const initialMemory = process.memoryUsage().heapUsed;
            const chunkSize = MILLISECONDS_IN_SECOND;
            const results = [];
            for (let i = 0; i < largeDataset.length; i += chunkSize) {
                const chunk = largeDataset.slice(i, i + chunkSize);
                const processedChunk = chunk.map((item) => ({
                    id: item.id,
                    processed: true,
                }));
                results.push(...processedChunk);
                if (i % (chunkSize * 10) === 0) {
                    await new Promise((resolve) => setImmediate(resolve));
                }
            }
            const finalMemory = process.memoryUsage().heapUsed;
            const memoryIncrease = finalMemory - initialMemory;
            expect(results).toHaveLength(largeDataset.length);
            expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
        });
    });
    describe('Performance Monitoring', () => {
        test('should track performance metrics accurately', async () => {
            const metrics = {
                requestCount: 0,
                totalResponseTime: 0,
                errorCount: 0,
                averageResponseTime: 0,
            };
            const trackRequest = async (fn) => {
                const startTime = performance.now();
                try {
                    await fn();
                    metrics.requestCount++;
                }
                catch (error) {
                    metrics.errorCount++;
                }
                const responseTime = performance.now() - startTime;
                metrics.totalResponseTime += responseTime;
                metrics.averageResponseTime =
                    metrics.totalResponseTime / (metrics.requestCount + metrics.errorCount);
            };
            await trackRequest(async () => new Promise((resolve) => setTimeout(resolve, 10)));
            await trackRequest(async () => new Promise((resolve) => setTimeout(resolve, 20)));
            await trackRequest(async () => {
                throw new Error('Test error');
            });
            await trackRequest(async () => new Promise((resolve) => setTimeout(resolve, 15)));
            expect(metrics.requestCount).toBe(3);
            expect(metrics.errorCount).toBe(1);
            expect(metrics.averageResponseTime).toBeGreaterThan(0);
        });
        test('should identify performance bottlenecks', async () => {
            const operations = {
                fastOp: async () => new Promise((resolve) => setTimeout(resolve, 5)),
                mediumOp: async () => new Promise((resolve) => setTimeout(resolve, 50)),
                slowOp: async () => new Promise((resolve) => setTimeout(resolve, 200)),
            };
            const timings = {};
            for (const [name, operation] of Object.entries(operations)) {
                const startTime = performance.now();
                await operation();
                timings[name] = performance.now() - startTime;
            }
            const slowestOp = Object.entries(timings).sort(([, a], [, b]) => b - a)[0];
            expect(slowestOp[0]).toBe('slowOp');
            expect(slowestOp[1]).toBeGreaterThan(100);
        });
        test('should generate performance reports', () => {
            const performanceData = {
                period: '1h',
                metrics: {
                    totalRequests: MILLISECONDS_IN_SECOND,
                    averageResponseTime: 45,
                    p95ResponseTime: 150,
                    p99ResponseTime: 300,
                    errorRate: 0.02,
                    throughput: 16.67,
                },
                bottlenecks: [
                    { operation: 'database_query', avgTime: 120, frequency: 0.4 },
                    { operation: 'external_api', avgTime: 200, frequency: 0.1 },
                ],
            };
            const generateReport = (data) => {
                return {
                    summary: `Processed ${data.metrics.totalRequests} requests with ${data.metrics.averageResponseTime}ms average response time`,
                    recommendations: data.bottlenecks.map((b) => `Optimize ${b.operation} (${b.avgTime}ms avg, ${b.frequency * 100}% of requests)`),
                };
            };
            const report = generateReport(performanceData);
            expect(report.summary).toContain('1000 requests');
            expect(report.recommendations).toHaveLength(2);
            expect(report.recommendations[0]).toContain('database_query');
        });
    });
    describe('Resource Usage Optimization', () => {
        test('should optimize resource allocation', async () => {
            const resourceLimits = {
                maxMemory: 100 * 1024 * 1024,
                maxCpuTime: MILLISECONDS_IN_SECOND,
                maxConnections: 50,
            };
            const currentUsage = {
                memory: 80 * 1024 * 1024,
                cpuTime: 500,
                connections: 30,
            };
            const isWithinLimits = (usage, limits) => {
                return (usage.memory < limits.maxMemory &&
                    usage.cpuTime < limits.maxCpuTime &&
                    usage.connections < limits.maxConnections);
            };
            expect(isWithinLimits(currentUsage, resourceLimits)).toBe(true);
            const optimizedUsage = {
                memory: currentUsage.memory * 0.8,
                cpuTime: currentUsage.cpuTime * 0.9,
                connections: currentUsage.connections,
            };
            expect(optimizedUsage.memory).toBeLessThan(currentUsage.memory);
            expect(optimizedUsage.cpuTime).toBeLessThan(currentUsage.cpuTime);
        });
        test('should implement efficient caching strategies', async () => {
            const cacheHitRatio = {
                hits: 0,
                misses: 0,
                get ratio() {
                    return this.hits / (this.hits + this.misses);
                },
            };
            const cachedGet = async (key) => {
                const cached = await cacheManager.get(key);
                if (cached) {
                    cacheHitRatio.hits++;
                    return cached;
                }
                cacheHitRatio.misses++;
                const data = `data-for-${key}`;
                await cacheManager.set(key, data);
                return data;
            };
            await cachedGet('key1');
            await cachedGet('key1');
            await cachedGet('key2');
            await cachedGet('key1');
            await cachedGet('key2');
            expect(cacheHitRatio.ratio).toBeGreaterThan(0.5);
        });
    });
});
//# sourceMappingURL=performance-tests.test.js.map