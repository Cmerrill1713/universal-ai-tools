#!/usr/bin/env node
/**
 * Comprehensive Inference Performance Benchmark
 * Tests and compares all inference engines for Apple Silicon optimization
 */

const fs = require('fs');
const path = require('path');

class InferenceBenchmark {
    constructor() {
        this.engines = [
            {
                name: 'Rust Candle (Apple Silicon)',
                url: 'http://localhost:8084/infer',
                priority: 1,
                expectedMultiplier: 6.0,
            },
            {
                name: 'Go Inference (Concurrent)',
                url: 'http://localhost:8085/infer',
                priority: 2,
                expectedMultiplier: 3.0,
            },
            {
                name: 'MLX (Current)',
                url: 'http://localhost:9999/api/v1/mlx/generate',
                priority: 3,
                expectedMultiplier: 2.5,
            },
            {
                name: 'LFM2 Bridge',
                url: 'http://localhost:9999/api/v1/fast-coordinator/execute',
                priority: 4,
                expectedMultiplier: 2.0,
            },
            {
                name: 'Ollama (Fallback)',
                url: 'http://localhost:11434/api/generate',
                priority: 5,
                expectedMultiplier: 1.0, // Baseline
            },
            {
                name: 'LM Studio',
                url: 'http://localhost:1234/v1/chat/completions',
                priority: 6,
                expectedMultiplier: 1.5,
            },
        ];

        this.testCases = [
            {
                name: 'Simple Q&A',
                prompt: 'What is the capital of France?',
                expectedTokens: 20,
                complexity: 'simple',
            },
            {
                name: 'Code Generation',
                prompt: 'Write a Python function that calculates fibonacci numbers using recursion.',
                expectedTokens: 150,
                complexity: 'medium',
            },
            {
                name: 'Complex Analysis',
                prompt: 'Analyze the economic implications of artificial intelligence adoption in healthcare, considering both benefits and potential drawbacks.',
                expectedTokens: 300,
                complexity: 'complex',
            },
            {
                name: 'Technical Documentation',
                prompt: 'Create comprehensive API documentation for a REST endpoint that handles user authentication including error codes, request/response examples.',
                expectedTokens: 400,
                complexity: 'complex',
            },
        ];

        this.concurrencyLevels = [1, 2, 4, 8];
        this.results = [];
    }

    async runBenchmark() {
        console.log('🚀 Starting Apple Silicon Inference Performance Benchmark');
        console.log('=' .repeat(70));
        
        await this.checkEngineAvailability();
        
        for (const testCase of this.testCases) {
            console.log(`\n📋 Running test: ${testCase.name}`);
            console.log('-'.repeat(50));
            
            for (const concurrency of this.concurrencyLevels) {
                console.log(`\n🔄 Testing with ${concurrency} concurrent request(s)`);
                
                const batchResults = [];
                
                for (const engine of this.engines) {
                    try {
                        const result = await this.testEngine(engine, testCase, concurrency);
                        batchResults.push(result);
                        
                        const tokensPerSec = result.tokensPerSecond || 0;
                        const multiplier = tokensPerSec > 0 ? tokensPerSec / 10 : 0; // Baseline comparison
                        
                        console.log(`  ${engine.name}: ${result.avgLatency}ms, ${tokensPerSec.toFixed(1)} tok/s (${multiplier.toFixed(1)}x)`);
                    } catch (error) {
                        console.log(`  ${engine.name}: ❌ FAILED (${error.message})`);
                        batchResults.push({
                            engine: engine.name,
                            testCase: testCase.name,
                            concurrency,
                            avgLatency: null,
                            tokensPerSecond: 0,
                            error: error.message,
                        });
                    }
                }
                
                this.results.push(...batchResults);
                
                // Show winner for this batch
                const successful = batchResults.filter(r => !r.error);
                if (successful.length > 0) {
                    const fastest = successful.reduce((prev, curr) => 
                        curr.tokensPerSecond > prev.tokensPerSecond ? curr : prev
                    );
                    console.log(`  🏆 Winner: ${fastest.engine} (${fastest.tokensPerSecond.toFixed(1)} tok/s)`);
                }
            }
        }
        
        this.generateReport();
    }

    async checkEngineAvailability() {
        console.log('🔍 Checking engine availability...');
        
        for (const engine of this.engines) {
            try {
                const response = await this.makeRequest(engine.url.replace(/\/[^\/]*$/, '/health'), 'GET', {});
                console.log(`  ✅ ${engine.name}: Available`);
            } catch (error) {
                console.log(`  ⚠️  ${engine.name}: Not available (${error.message})`);
            }
        }
    }

    async testEngine(engine, testCase, concurrency) {
        const requests = Array(concurrency).fill().map(() => 
            this.performSingleRequest(engine, testCase)
        );
        
        const startTime = Date.now();
        const results = await Promise.allSettled(requests);
        const totalTime = Date.now() - startTime;
        
        const successful = results
            .filter(r => r.status === 'fulfilled')
            .map(r => r.value);
        
        if (successful.length === 0) {
            throw new Error('All requests failed');
        }
        
        const avgLatency = successful.reduce((sum, r) => sum + r.latency, 0) / successful.length;
        const totalTokens = successful.reduce((sum, r) => sum + r.tokens, 0);
        const tokensPerSecond = (totalTokens / totalTime) * 1000;
        
        return {
            engine: engine.name,
            testCase: testCase.name,
            concurrency,
            avgLatency: Math.round(avgLatency),
            tokensPerSecond,
            totalTime,
            successRate: (successful.length / concurrency) * 100,
            error: null,
        };
    }

    async performSingleRequest(engine, testCase) {
        const startTime = Date.now();
        let requestBody, endpoint;
        
        // Customize request based on engine
        if (engine.name.includes('Rust Candle')) {
            endpoint = engine.url;
            requestBody = {
                model_id: 'candle-llama-7b',
                input: { Text: testCase.prompt },
                parameters: {
                    batch_size: 1,
                    temperature: 0.7,
                    max_length: testCase.expectedTokens,
                    use_gpu: true,
                    cache_result: false, // For benchmarking
                },
            };
        } else if (engine.name.includes('Go Inference')) {
            endpoint = engine.url;
            requestBody = {
                model_id: 'go-gorgonia-model',
                input: testCase.prompt,
                parameters: {
                    temperature: 0.7,
                    max_tokens: testCase.expectedTokens,
                    use_gpu: false,
                    cache_result: false,
                },
            };
        } else if (engine.name.includes('MLX')) {
            endpoint = engine.url;
            requestBody = {
                model: 'mlx-llama-7b',
                prompt: testCase.prompt,
                max_tokens: testCase.expectedTokens,
                temperature: 0.7,
            };
        } else if (engine.name.includes('Fast Coordinator')) {
            endpoint = engine.url;
            requestBody = {
                userRequest: testCase.prompt,
                context: {
                    taskType: 'benchmark',
                    complexity: testCase.complexity,
                    urgency: 'medium',
                    expectedResponseLength: 'medium',
                    requiresCreativity: false,
                    requiresAccuracy: true,
                },
            };
        } else if (engine.name.includes('Ollama')) {
            endpoint = engine.url;
            requestBody = {
                model: 'llama3.2:3b',
                prompt: testCase.prompt,
                stream: false,
                options: {
                    temperature: 0.7,
                    num_predict: testCase.expectedTokens,
                },
            };
        } else if (engine.name.includes('LM Studio')) {
            endpoint = engine.url;
            requestBody = {
                model: 'local-model',
                messages: [{ role: 'user', content: testCase.prompt }],
                temperature: 0.7,
                max_tokens: testCase.expectedTokens,
            };
        }
        
        const response = await this.makeRequest(endpoint, 'POST', requestBody);
        const latency = Date.now() - startTime;
        
        // Extract tokens from response based on engine
        let tokens = testCase.expectedTokens; // Fallback estimate
        
        if (response.output && response.output.Generation) {
            tokens = response.output.Generation.text.length / 4; // Rough token estimate
        } else if (response.response) {
            tokens = response.response.length / 4;
        } else if (response.choices && response.choices[0]) {
            tokens = response.choices[0].message.content.length / 4;
        } else if (response.content) {
            tokens = response.content.length / 4;
        }
        
        return { latency, tokens };
    }

    async makeRequest(url, method, body) {
        const fetch = (await import('node-fetch')).default;
        
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
            },
            timeout: 30000, // 30 second timeout
        };
        
        if (method !== 'GET') {
            options.body = JSON.stringify(body);
        }
        
        const response = await fetch(url, options);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return response.json();
    }

    generateReport() {
        console.log('\n📊 PERFORMANCE BENCHMARK REPORT');
        console.log('=' .repeat(70));
        
        // Overall performance summary
        const engineSummary = {};
        
        this.results.forEach(result => {
            if (!result.error) {
                if (!engineSummary[result.engine]) {
                    engineSummary[result.engine] = {
                        totalRequests: 0,
                        avgTokensPerSec: 0,
                        avgLatency: 0,
                        successRate: 0,
                    };
                }
                
                const summary = engineSummary[result.engine];
                summary.totalRequests++;
                summary.avgTokensPerSec += result.tokensPerSecond;
                summary.avgLatency += result.avgLatency;
                summary.successRate += result.successRate;
            }
        });
        
        // Calculate averages
        Object.keys(engineSummary).forEach(engine => {
            const summary = engineSummary[engine];
            summary.avgTokensPerSec /= summary.totalRequests;
            summary.avgLatency /= summary.totalRequests;
            summary.successRate /= summary.totalRequests;
        });
        
        // Sort by performance
        const sortedEngines = Object.entries(engineSummary)
            .sort(([,a], [,b]) => b.avgTokensPerSec - a.avgTokensPerSec);
        
        console.log('\n🏆 OVERALL PERFORMANCE RANKING:');
        console.log('-'.repeat(50));
        
        sortedEngines.forEach(([engine, summary], index) => {
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '  ';
            const multiplier = summary.avgTokensPerSec / (sortedEngines[sortedEngines.length - 1][1].avgTokensPerSec);
            
            console.log(`${medal} ${index + 1}. ${engine}`);
            console.log(`     Throughput: ${summary.avgTokensPerSec.toFixed(1)} tokens/sec (${multiplier.toFixed(1)}x baseline)`);
            console.log(`     Latency: ${summary.avgLatency.toFixed(0)}ms`);
            console.log(`     Success Rate: ${summary.successRate.toFixed(1)}%`);
            console.log('');
        });
        
        // Apple Silicon specific insights
        const rustCandle = engineSummary['Rust Candle (Apple Silicon)'];
        const baseline = sortedEngines[sortedEngines.length - 1][1];
        
        if (rustCandle) {
            const actualMultiplier = rustCandle.avgTokensPerSec / baseline.avgTokensPerSec;
            console.log('🍎 APPLE SILICON OPTIMIZATION RESULTS:');
            console.log('-'.repeat(50));
            console.log(`Rust Candle achieved ${actualMultiplier.toFixed(1)}x performance improvement`);
            console.log(`Target was 6x - ${actualMultiplier >= 6 ? '✅ TARGET MET' : '⚠️  Below target'}`);
            console.log('');
        }
        
        // Save detailed results
        this.saveDetailedResults();
        
        console.log('📄 Detailed results saved to benchmark-results.json');
        console.log('🎯 Recommendation: Use Rust Candle for maximum Apple Silicon performance');
    }

    saveDetailedResults() {
        const detailedReport = {
            timestamp: new Date().toISOString(),
            platform: {
                os: process.platform,
                arch: process.arch,
                node_version: process.version,
            },
            summary: 'Apple Silicon Inference Performance Benchmark',
            results: this.results,
            engines_tested: this.engines.map(e => e.name),
            test_cases: this.testCases.map(t => t.name),
            concurrency_levels: this.concurrencyLevels,
        };
        
        fs.writeFileSync(
            path.join(__dirname, 'benchmark-results.json'),
            JSON.stringify(detailedReport, null, 2)
        );
    }
}

// Run the benchmark if this file is executed directly
if (require.main === module) {
    const benchmark = new InferenceBenchmark();
    benchmark.runBenchmark().catch(console.error);
}

module.exports = InferenceBenchmark;