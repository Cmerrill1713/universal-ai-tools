#!/usr/bin/env node

/**
 * Universal AI Tools - Comprehensive Performance Benchmark Suite
 * Tests backend API performance, mobile app responsiveness, and system metrics
 */

const https = require('https');
const http = require('http');
const { performance } = require('perf_hooks');
const { spawn, exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Configuration
const CONFIG = {
    backend: {
        baseUrl: 'http://localhost:9999',
        endpoints: [
            '/health',
            '/api/v1/chat',
            '/api/v1/athena/chat', 
            '/api/v1/vision',
            '/api/v1/voice',
            '/api/v1/agents',
            '/api/v1/memory'
        ]
    },
    mobile: {
        simulatorUuid: '9E201695-F363-41B8-B011-613F4B0F91DE',
        bundleId: 'com.universalaitools.app'
    },
    benchmarks: {
        iterations: 10,
        concurrency: 5,
        timeoutMs: 30000
    }
};

class PerformanceBenchmark {
    constructor() {
        this.results = {
            backend: {},
            mobile: {},
            system: {},
            summary: {}
        };
        this.startTime = Date.now();
    }

    log(message, level = 'INFO') {
        const timestamp = new Date().toISOString();
        const color = {
            INFO: '\x1b[32m',
            WARN: '\x1b[33m', 
            ERROR: '\x1b[31m',
            SUCCESS: '\x1b[36m'
        }[level] || '\x1b[0m';
        
        console.log(`${color}[${level}]\x1b[0m ${timestamp}: ${message}`);
    }

    async makeRequest(url, options = {}) {
        return new Promise((resolve, reject) => {
            const start = performance.now();
            const client = url.startsWith('https') ? https : http;
            
            const req = client.request(url, {
                method: 'GET',
                timeout: CONFIG.benchmarks.timeoutMs,
                ...options
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    const end = performance.now();
                    resolve({
                        statusCode: res.statusCode,
                        responseTime: end - start,
                        contentLength: data.length,
                        data: data
                    });
                });
            });

            req.on('error', reject);
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            if (options.body) {
                req.write(options.body);
            }
            req.end();
        });
    }

    async testEndpoint(endpoint, options = {}) {
        const url = `${CONFIG.backend.baseUrl}${endpoint}`;
        const results = [];
        
        this.log(`Testing endpoint: ${endpoint}`);
        
        try {
            // Sequential requests
            for (let i = 0; i < CONFIG.benchmarks.iterations; i++) {
                const result = await this.makeRequest(url, options);
                results.push(result);
                
                if (result.statusCode !== 200) {
                    this.log(`Non-200 response: ${result.statusCode}`, 'WARN');
                }
            }

            // Concurrent requests
            this.log(`Testing concurrent requests for ${endpoint}`);
            const concurrentStart = performance.now();
            const concurrentPromises = Array(CONFIG.benchmarks.concurrency)
                .fill()
                .map(() => this.makeRequest(url, options));
            
            const concurrentResults = await Promise.allSettled(concurrentPromises);
            const concurrentEnd = performance.now();
            const concurrentTime = concurrentEnd - concurrentStart;

            // Calculate statistics
            const responseTimes = results.map(r => r.responseTime);
            const stats = {
                endpoint,
                sequential: {
                    avg: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
                    min: Math.min(...responseTimes),
                    max: Math.max(...responseTimes),
                    median: this.calculateMedian(responseTimes),
                    p95: this.calculatePercentile(responseTimes, 95),
                    p99: this.calculatePercentile(responseTimes, 99)
                },
                concurrent: {
                    totalTime: concurrentTime,
                    successful: concurrentResults.filter(r => r.status === 'fulfilled').length,
                    failed: concurrentResults.filter(r => r.status === 'rejected').length,
                    throughput: CONFIG.benchmarks.concurrency / (concurrentTime / 1000)
                },
                errors: results.filter(r => r.statusCode !== 200).length,
                successRate: (results.filter(r => r.statusCode === 200).length / results.length) * 100
            };

            this.results.backend[endpoint] = stats;
            this.log(`✅ ${endpoint} - Avg: ${stats.sequential.avg.toFixed(2)}ms, Success: ${stats.successRate}%`, 'SUCCESS');
            
            return stats;
        } catch (error) {
            this.log(`❌ Failed to test ${endpoint}: ${error.message}`, 'ERROR');
            this.results.backend[endpoint] = { error: error.message };
            return null;
        }
    }

    async benchmarkBackend() {
        this.log('🚀 Starting Backend Performance Benchmarks');
        
        // Test health endpoint first
        await this.testEndpoint('/health');
        
        // Test chat endpoint with POST
        await this.testEndpoint('/api/v1/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: 'Performance test message',
                agentName: 'general',
                conversationId: 'benchmark-test'
            })
        });

        // Test other endpoints
        const getEndpoints = [
            '/api/v1/agents',
            '/api/v1/memory',
            '/metrics'
        ];

        for (const endpoint of getEndpoints) {
            await this.testEndpoint(endpoint);
        }
    }

    async benchmarkMobile() {
        this.log('📱 Starting Mobile App Performance Benchmarks');
        
        try {
            // Test app launch time
            const launchStart = performance.now();
            await this.execCommand(`xcrun simctl launch ${CONFIG.mobile.simulatorUuid} ${CONFIG.mobile.bundleId}`);
            const launchEnd = performance.now();
            const launchTime = launchEnd - launchStart;

            // Test UI responsiveness
            const uiStart = performance.now();
            await this.execCommand(`xcrun simctl io ${CONFIG.mobile.simulatorUuid} screenshot benchmark-before.png`);
            
            // Simulate tab navigation
            for (let i = 0; i < 5; i++) {
                await new Promise(resolve => setTimeout(resolve, 500));
                // Simulate tap on different tabs
                await this.execCommand(`xcrun simctl io ${CONFIG.mobile.simulatorUuid} tap ${100 + i * 50} 750`);
            }
            
            await this.execCommand(`xcrun simctl io ${CONFIG.mobile.simulatorUuid} screenshot benchmark-after.png`);
            const uiEnd = performance.now();
            const uiTime = uiEnd - uiStart;

            this.results.mobile = {
                launchTime,
                uiResponseTime: uiTime,
                status: 'success'
            };

            this.log(`✅ Mobile benchmarks completed - Launch: ${launchTime.toFixed(2)}ms`, 'SUCCESS');
        } catch (error) {
            this.log(`❌ Mobile benchmark failed: ${error.message}`, 'ERROR');
            this.results.mobile = { error: error.message };
        }
    }

    async benchmarkSystem() {
        this.log('⚙️ Starting System Performance Benchmarks');
        
        try {
            // Memory usage
            const { stdout: memInfo } = await execAsync('vm_stat');
            const memLines = memInfo.split('\n');
            const pageSize = 4096; // macOS default page size
            
            const freePages = parseInt(memLines.find(line => line.includes('free'))?.match(/\d+/)?.[0] || '0');
            const inactivePages = parseInt(memLines.find(line => line.includes('inactive'))?.match(/\d+/)?.[0] || '0');
            const availableMemory = (freePages + inactivePages) * pageSize / (1024 * 1024 * 1024); // GB

            // CPU usage
            const { stdout: cpuInfo } = await execAsync('top -l 1 -n 0 | grep "CPU usage"');
            const cpuMatch = cpuInfo.match(/(\d+\.\d+)% user.*?(\d+\.\d+)% sys.*?(\d+\.\d+)% idle/);
            const cpuUsage = cpuMatch ? {
                user: parseFloat(cpuMatch[1]),
                system: parseFloat(cpuMatch[2]),
                idle: parseFloat(cpuMatch[3])
            } : null;

            // Disk I/O
            const { stdout: diskInfo } = await execAsync('iostat -d 1 2 | tail -n +3');
            const diskLines = diskInfo.split('\n').filter(line => line.trim());
            const lastDiskLine = diskLines[diskLines.length - 1];
            const diskParts = lastDiskLine.trim().split(/\s+/);
            
            // Process information
            const { stdout: processInfo } = await execAsync('ps aux | grep -E "(node|Universal AI Tools)" | grep -v grep');
            const processes = processInfo.split('\n').filter(line => line.trim()).map(line => {
                const parts = line.trim().split(/\s+/);
                return {
                    pid: parts[1],
                    cpu: parseFloat(parts[2]),
                    memory: parseFloat(parts[3]),
                    command: parts.slice(10).join(' ')
                };
            });

            this.results.system = {
                memory: {
                    availableGB: availableMemory,
                    timestamp: new Date().toISOString()
                },
                cpu: cpuUsage,
                processes: processes,
                disk: diskParts.length > 2 ? {
                    readMBps: parseFloat(diskParts[diskParts.length - 2]),
                    writeMBps: parseFloat(diskParts[diskParts.length - 1])
                } : null
            };

            this.log(`✅ System metrics captured - Available RAM: ${availableMemory.toFixed(2)}GB`, 'SUCCESS');
        } catch (error) {
            this.log(`❌ System benchmark failed: ${error.message}`, 'ERROR');
            this.results.system = { error: error.message };
        }
    }

    async runComprehensiveBenchmark() {
        this.log('🎯 Starting Comprehensive Universal AI Tools Benchmark Suite');
        
        // Run benchmarks in parallel where possible
        await Promise.allSettled([
            this.benchmarkBackend(),
            this.benchmarkSystem()
        ]);
        
        // Mobile benchmark runs separately to avoid interference
        await this.benchmarkMobile();
        
        // Generate summary
        this.generateSummary();
        
        // Save results
        await this.saveResults();
        
        this.log(`🏁 Benchmark completed in ${((Date.now() - this.startTime) / 1000).toFixed(2)}s`, 'SUCCESS');
    }

    generateSummary() {
        const backendEndpoints = Object.keys(this.results.backend).length;
        const backendErrors = Object.values(this.results.backend).filter(r => r.error).length;
        const avgResponseTime = Object.values(this.results.backend)
            .filter(r => r.sequential)
            .reduce((sum, r) => sum + r.sequential.avg, 0) / Math.max(1, backendEndpoints - backendErrors);

        this.results.summary = {
            totalDuration: (Date.now() - this.startTime) / 1000,
            backend: {
                endpointsTested: backendEndpoints,
                errors: backendErrors,
                avgResponseTime: avgResponseTime || 0,
                overallHealth: backendErrors === 0 ? 'excellent' : backendErrors < 3 ? 'good' : 'poor'
            },
            mobile: {
                tested: !this.results.mobile.error,
                status: this.results.mobile.status || 'failed'
            },
            system: {
                monitored: !this.results.system.error,
                processCount: this.results.system.processes?.length || 0
            },
            timestamp: new Date().toISOString(),
            platform: 'macOS',
            nodeVersion: process.version
        };
    }

    async saveResults() {
        const fs = require('fs').promises;
        const filename = `benchmark-results-${Date.now()}.json`;
        const filepath = `/Users/christianmerrill/Desktop/universal-ai-tools/${filename}`;
        
        try {
            await fs.writeFile(filepath, JSON.stringify(this.results, null, 2));
            this.log(`📊 Results saved to: ${filename}`, 'SUCCESS');
        } catch (error) {
            this.log(`❌ Failed to save results: ${error.message}`, 'ERROR');
        }
    }

    async execCommand(command) {
        return execAsync(command);
    }

    calculateMedian(arr) {
        const sorted = [...arr].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
    }

    calculatePercentile(arr, percentile) {
        const sorted = [...arr].sort((a, b) => a - b);
        const index = Math.ceil((percentile / 100) * sorted.length) - 1;
        return sorted[index];
    }

    printResults() {
        console.log('\n' + '='.repeat(80));
        console.log('📊 UNIVERSAL AI TOOLS - PERFORMANCE BENCHMARK RESULTS');
        console.log('='.repeat(80));
        
        console.log('\n🖥️  BACKEND PERFORMANCE:');
        Object.entries(this.results.backend).forEach(([endpoint, stats]) => {
            if (stats.error) {
                console.log(`   ❌ ${endpoint}: ${stats.error}`);
            } else {
                console.log(`   ✅ ${endpoint}:`);
                console.log(`      Response Time: ${stats.sequential.avg.toFixed(2)}ms avg, ${stats.sequential.min.toFixed(2)}ms min, ${stats.sequential.max.toFixed(2)}ms max`);
                console.log(`      Success Rate: ${stats.successRate.toFixed(1)}%`);
                console.log(`      Throughput: ${stats.concurrent.throughput.toFixed(2)} req/sec`);
            }
        });

        console.log('\n📱 MOBILE PERFORMANCE:');
        if (this.results.mobile.error) {
            console.log(`   ❌ Mobile testing failed: ${this.results.mobile.error}`);
        } else {
            console.log(`   ✅ App Launch Time: ${this.results.mobile.launchTime.toFixed(2)}ms`);
            console.log(`   ✅ UI Response Time: ${this.results.mobile.uiResponseTime.toFixed(2)}ms`);
        }

        console.log('\n⚙️  SYSTEM METRICS:');
        if (this.results.system.error) {
            console.log(`   ❌ System monitoring failed: ${this.results.system.error}`);
        } else {
            console.log(`   💾 Available Memory: ${this.results.system.memory.availableGB.toFixed(2)}GB`);
            if (this.results.system.cpu) {
                console.log(`   🔥 CPU Usage: ${(100 - this.results.system.cpu.idle).toFixed(1)}% (${this.results.system.cpu.user.toFixed(1)}% user, ${this.results.system.cpu.system.toFixed(1)}% sys)`);
            }
            console.log(`   🔄 Running Processes: ${this.results.system.processes.length} AI-related processes`);
        }

        console.log('\n📈 SUMMARY:');
        console.log(`   Total Test Duration: ${this.results.summary.totalDuration.toFixed(2)}s`);
        console.log(`   Backend Health: ${this.results.summary.backend.overallHealth.toUpperCase()}`);
        console.log(`   Average Response Time: ${this.results.summary.backend.avgResponseTime.toFixed(2)}ms`);
        console.log(`   Mobile App Status: ${this.results.summary.mobile.status.toUpperCase()}`);
        console.log(`   System Monitoring: ${this.results.summary.system.monitored ? 'SUCCESS' : 'FAILED'}`);
        
        console.log('\n' + '='.repeat(80));
    }
}

// Main execution
async function main() {
    const benchmark = new PerformanceBenchmark();
    
    try {
        await benchmark.runComprehensiveBenchmark();
        benchmark.printResults();
        
        // Return success code based on results
        const hasErrors = benchmark.results.summary.backend.errors > 2 || 
                         benchmark.results.mobile.error ||
                         benchmark.results.system.error;
        
        process.exit(hasErrors ? 1 : 0);
    } catch (error) {
        console.error('❌ Benchmark suite failed:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = PerformanceBenchmark;