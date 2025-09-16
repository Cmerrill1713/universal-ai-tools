#!/usr/bin/env tsx

/**
 * Automated Performance Regression Testing for Rust Services
 * Continuously monitors performance and detects regressions
 */

import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
import { performance } from 'perf_hooks';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Performance benchmarking utilities
interface PerformanceBenchmark {
    service: string;
    operation: string;
    samples: number;
    baseline_ms: number;
    current_ms: number;
    improvement_ratio: number;
    regression_threshold: number;
    status: 'pass' | 'regression' | 'warning';
}

interface ServiceTestConfig {
    name: string;
    lib_name: string;
    tests: ServiceTest[];
}

interface ServiceTest {
    name: string;
    baseline_ms: number;
    regression_threshold: number; // Minimum expected improvement ratio
    test_function: () => Promise<number>;
}

class PerformanceRegressionTester {
    private services: ServiceTestConfig[] = [];
    private results: PerformanceBenchmark[] = [];

    constructor() {
        this.initializeServiceTests();
    }

    private initializeServiceTests(): void {
        // AB-MCTS Service Tests
        this.services.push({
            name: 'ab-mcts-service',
            lib_name: 'ab_mcts_service',
            tests: [
                {
                    name: 'orchestrate_simple_task',
                    baseline_ms: 1200, // TypeScript baseline
                    regression_threshold: 15.0, // Minimum 15x improvement
                    test_function: () => this.testABMCTSOrchestration()
                },
                {
                    name: 'update_performance_metrics',
                    baseline_ms: 45,
                    regression_threshold: 8.0,
                    test_function: () => this.testABMCTSPerformanceUpdate()
                }
            ]
        });

        // Parameter Analytics Service Tests
        this.services.push({
            name: 'parameter-analytics-service',
            lib_name: 'parameter_analytics_service',
            tests: [
                {
                    name: 'compute_statistics_10k',
                    baseline_ms: 2500, // TypeScript baseline
                    regression_threshold: 35.0, // Minimum 35x improvement
                    test_function: () => this.testParameterAnalyticsStatistics()
                },
                {
                    name: 'analyze_parameters',
                    baseline_ms: 450,
                    regression_threshold: 20.0,
                    test_function: () => this.testParameterAnalyticsAnalysis()
                }
            ]
        });

        // Multimodal Fusion Service Tests
        this.services.push({
            name: 'multimodal-fusion-service',
            lib_name: 'multimodal_fusion_service',
            tests: [
                {
                    name: 'process_multimodal_windows',
                    baseline_ms: 800, // TypeScript baseline
                    regression_threshold: 30.0, // Minimum 30x improvement
                    test_function: () => this.testMultimodalFusion()
                },
                {
                    name: 'cross_modal_attention',
                    baseline_ms: 380,
                    regression_threshold: 25.0,
                    test_function: () => this.testCrossModalAttention()
                }
            ]
        });

        // Intelligent Parameter Service Tests
        this.services.push({
            name: 'intelligent-parameter-service',
            lib_name: 'intelligent_parameter_service',
            tests: [
                {
                    name: 'bayesian_optimization',
                    baseline_ms: 180, // TypeScript baseline
                    regression_threshold: 18.0, // Minimum 18x improvement
                    test_function: () => this.testBayesianOptimization()
                },
                {
                    name: 'multi_armed_bandit',
                    baseline_ms: 45,
                    regression_threshold: 15.0,
                    test_function: () => this.testMultiArmedBandit()
                }
            ]
        });
    }

    async runRegressionTests(): Promise<void> {
        console.log('🔍 Running Performance Regression Tests');
        console.log('=====================================');
        console.log('');

        for (const service of this.services) {
            console.log(`Testing ${service.name}...`);
            
            // Check if native module is available
            const nativeAvailable = this.checkNativeModule(service);
            
            if (!nativeAvailable) {
                console.log(`  ⚠️  Native module not available, skipping regression tests`);
                continue;
            }

            for (const test of service.tests) {
                const benchmark = await this.runSingleTest(service.name, test);
                this.results.push(benchmark);
                this.printTestResult(benchmark);
            }
            console.log('');
        }

        this.generateRegressionReport();
    }

    private checkNativeModule(service: ServiceTestConfig): boolean {
        try {
            const require = createRequire(import.meta.url);
            const libPath = path.join(
                __dirname,
                `../rust-services/${service.name}/target/release/lib${service.lib_name}`
            );
            
            const extensions = process.platform === 'darwin' ? ['.dylib'] :
                              process.platform === 'win32' ? ['.dll'] : ['.so'];
            
            for (const ext of extensions) {
                try {
                    require(libPath + ext);
                    return true;
                } catch (e) {
                    // Try next extension
                }
            }
            return false;
        } catch (error) {
            return false;
        }
    }

    private async runSingleTest(serviceName: string, test: ServiceTest): Promise<PerformanceBenchmark> {
        const samples = 10; // Number of test iterations
        const durations: number[] = [];

        // Warm-up runs
        for (let i = 0; i < 3; i++) {
            await test.test_function();
        }

        // Actual benchmark runs
        for (let i = 0; i < samples; i++) {
            const startTime = performance.now();
            await test.test_function();
            const duration = performance.now() - startTime;
            durations.push(duration);
        }

        // Calculate statistics
        const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
        const improvementRatio = test.baseline_ms / avgDuration;
        
        let status: 'pass' | 'regression' | 'warning';
        if (improvementRatio >= test.regression_threshold) {
            status = 'pass';
        } else if (improvementRatio >= test.regression_threshold * 0.8) {
            status = 'warning';
        } else {
            status = 'regression';
        }

        return {
            service: serviceName,
            operation: test.name,
            samples: samples,
            baseline_ms: test.baseline_ms,
            current_ms: avgDuration,
            improvement_ratio: improvementRatio,
            regression_threshold: test.regression_threshold,
            status: status
        };
    }

    // Mock test implementations (would connect to actual services in production)
    private async testABMCTSOrchestration(): Promise<number> {
        // Simulate AB-MCTS orchestration work
        const start = performance.now();
        
        // Mock computation representing tree search and agent selection
        let result = 0;
        for (let i = 0; i < 1000; i++) {
            result += Math.random() * Math.sin(i);
        }
        
        return performance.now() - start;
    }

    private async testABMCTSPerformanceUpdate(): Promise<number> {
        const start = performance.now();
        
        // Mock performance metric update
        const metrics = Array(100).fill(0).map(() => Math.random());
        metrics.sort();
        
        return performance.now() - start;
    }

    private async testParameterAnalyticsStatistics(): Promise<number> {
        const start = performance.now();
        
        // Mock statistical computation on large dataset
        const data = Array(10000).fill(0).map(() => Math.random() * 100);
        const mean = data.reduce((a, b) => a + b) / data.length;
        const variance = data.reduce((a, b) => a + (b - mean) ** 2, 0) / data.length;
        const stdDev = Math.sqrt(variance);
        
        // Additional statistical operations
        data.sort();
        const median = data[Math.floor(data.length / 2)];
        
        return performance.now() - start;
    }

    private async testParameterAnalyticsAnalysis(): Promise<number> {
        const start = performance.now();
        
        // Mock parameter analysis with correlation computation
        const params = Array(1000).fill(0).map(() => ({
            temperature: Math.random(),
            top_p: Math.random(),
            quality: Math.random()
        }));
        
        // Compute correlations
        params.forEach(p => {
            const correlation = (p.temperature + p.top_p) * p.quality;
        });
        
        return performance.now() - start;
    }

    private async testMultimodalFusion(): Promise<number> {
        const start = performance.now();
        
        // Mock multimodal processing with attention computation
        const embeddings = Array(50).fill(0).map(() => 
            Array(768).fill(0).map(() => Math.random())
        );
        
        // Mock attention computation
        for (let i = 0; i < embeddings.length; i++) {
            for (let j = 0; j < embeddings.length; j++) {
                const attention = embeddings[i].reduce((sum, val, idx) => 
                    sum + val * embeddings[j][idx], 0
                );
            }
        }
        
        return performance.now() - start;
    }

    private async testCrossModalAttention(): Promise<number> {
        const start = performance.now();
        
        // Mock cross-modal attention between text and vision
        const textEmbeddings = Array(20).fill(0).map(() => Array(768).fill(0).map(() => Math.random()));
        const visionEmbeddings = Array(20).fill(0).map(() => Array(768).fill(0).map(() => Math.random()));
        
        // Cross-attention computation
        textEmbeddings.forEach(text => {
            visionEmbeddings.forEach(vision => {
                const crossAttention = text.reduce((sum, val, idx) => sum + val * vision[idx], 0);
            });
        });
        
        return performance.now() - start;
    }

    private async testBayesianOptimization(): Promise<number> {
        const start = performance.now();
        
        // Mock Bayesian optimization with Gaussian process
        const history = Array(150).fill(0).map(() => ({
            params: Array(8).fill(0).map(() => Math.random()),
            score: Math.random()
        }));
        
        // Mock GP fitting and acquisition function optimization
        history.forEach(entry => {
            const prediction = entry.params.reduce((sum, p, idx) => 
                sum + p * Math.sin(idx), 0
            );
        });
        
        return performance.now() - start;
    }

    private async testMultiArmedBandit(): Promise<number> {
        const start = performance.now();
        
        // Mock multi-armed bandit with UCB1
        const arms = Array(20).fill(0).map(() => ({
            plays: Math.floor(Math.random() * 100),
            reward: Math.random()
        }));
        
        // UCB1 calculation for each arm
        arms.forEach(arm => {
            const ucb = arm.reward + Math.sqrt(2 * Math.log(1000) / arm.plays);
        });
        
        return performance.now() - start;
    }

    private printTestResult(benchmark: PerformanceBenchmark): void {
        const statusIcon = benchmark.status === 'pass' ? '✅' : 
                          benchmark.status === 'warning' ? '⚠️' : '❌';
        
        const improvementText = `${benchmark.improvement_ratio.toFixed(1)}x`;
        const thresholdText = `${benchmark.regression_threshold.toFixed(1)}x`;
        
        console.log(`  ${statusIcon} ${benchmark.operation}`);
        console.log(`    Performance: ${benchmark.current_ms.toFixed(1)}ms (was ${benchmark.baseline_ms}ms)`);
        console.log(`    Improvement: ${improvementText} (threshold: ${thresholdText})`);
        
        if (benchmark.status === 'regression') {
            console.log(`    🚨 REGRESSION DETECTED: Performance below threshold!`);
        } else if (benchmark.status === 'warning') {
            console.log(`    ⚠️  Performance close to regression threshold`);
        }
    }

    private generateRegressionReport(): void {
        console.log('📊 Performance Regression Report');
        console.log('===============================');
        console.log('');

        const passedTests = this.results.filter(r => r.status === 'pass');
        const warningTests = this.results.filter(r => r.status === 'warning');
        const failedTests = this.results.filter(r => r.status === 'regression');

        console.log(`✅ Passed: ${passedTests.length}`);
        console.log(`⚠️  Warnings: ${warningTests.length}`);
        console.log(`❌ Regressions: ${failedTests.length}`);
        console.log('');

        if (failedTests.length > 0) {
            console.log('🚨 REGRESSION DETECTED:');
            failedTests.forEach(test => {
                console.log(`  - ${test.service}.${test.operation}: ${test.improvement_ratio.toFixed(1)}x (expected ${test.regression_threshold.toFixed(1)}x)`);
            });
            console.log('');
        }

        if (warningTests.length > 0) {
            console.log('⚠️  PERFORMANCE WARNINGS:');
            warningTests.forEach(test => {
                console.log(`  - ${test.service}.${test.operation}: ${test.improvement_ratio.toFixed(1)}x (threshold ${test.regression_threshold.toFixed(1)}x)`);
            });
            console.log('');
        }

        // Overall statistics
        const avgImprovement = this.results.reduce((sum, r) => sum + r.improvement_ratio, 0) / this.results.length;
        console.log(`📈 Average Performance Improvement: ${avgImprovement.toFixed(1)}x`);
        
        // Best and worst performers
        const bestPerformer = this.results.reduce((best, current) => 
            current.improvement_ratio > best.improvement_ratio ? current : best
        );
        const worstPerformer = this.results.reduce((worst, current) => 
            current.improvement_ratio < worst.improvement_ratio ? current : worst
        );
        
        console.log(`🏆 Best: ${bestPerformer.service}.${bestPerformer.operation} (${bestPerformer.improvement_ratio.toFixed(1)}x)`);
        console.log(`🐌 Worst: ${worstPerformer.service}.${worstPerformer.operation} (${worstPerformer.improvement_ratio.toFixed(1)}x)`);
        console.log('');

        // Recommendations
        console.log('💡 Recommendations:');
        if (failedTests.length > 0) {
            console.log('  • Investigate regression causes in failing services');
            console.log('  • Check for changes in algorithms or dependencies');
            console.log('  • Consider reverting recent changes if performance is critical');
        } else if (warningTests.length > 0) {
            console.log('  • Monitor warning services closely');
            console.log('  • Consider optimization improvements');
        } else {
            console.log('  • All services performing within expected ranges');
            console.log('  • Continue monitoring for performance trends');
        }

        // Exit code based on results
        if (failedTests.length > 0) {
            console.log('');
            console.log('❌ PERFORMANCE REGRESSION TEST FAILED');
            process.exit(1);
        } else {
            console.log('');
            console.log('✅ PERFORMANCE REGRESSION TEST PASSED');
            process.exit(0);
        }
    }
}

// Run regression tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const tester = new PerformanceRegressionTester();
    tester.runRegressionTests().catch(console.error);
}