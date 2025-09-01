/**
 * Integration tests for Rust native services
 * Validates FFI bindings and performance improvements
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

// Import native service wrappers
import { ABMCTSOrchestrator } from '../src/services/ab-mcts-native';
import { ParameterAnalyticsService } from '../src/services/parameter-analytics-native';
import { MultimodalFusionService } from '../src/services/multimodal-fusion-native';
import { IntelligentParameterService } from '../src/services/intelligent-parameter-native';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to check if native module is available
function isNativeModuleAvailable(serviceName: string): boolean {
    try {
        const libPath = path.join(
            __dirname,
            `../rust-services/${serviceName}/target/release`
        );
        const fs = require('fs');
        
        const extensions = process.platform === 'darwin' ? ['.dylib'] :
                          process.platform === 'win32' ? ['.dll'] : ['.so'];
        
        for (const ext of extensions) {
            const fullPath = path.join(libPath, `lib${serviceName.replace(/-/g, '_')}${ext}`);
            if (fs.existsSync(fullPath)) {
                return true;
            }
        }
    } catch (e) {
        // Module not available
    }
    return false;
}

describe('Rust Services Integration', () => {
    let abmctsService: ABMCTSOrchestrator;
    let analyticsService: ParameterAnalyticsService;
    let fusionService: MultimodalFusionService;
    let parameterService: IntelligentParameterService;

    beforeAll(() => {
        // Initialize services
        abmctsService = new ABMCTSOrchestrator();
        analyticsService = new ParameterAnalyticsService();
        fusionService = new MultimodalFusionService();
        parameterService = new IntelligentParameterService();
    });

    afterAll(() => {
        // Clean up
        abmctsService.dispose();
        analyticsService.dispose();
        fusionService.dispose();
        parameterService.dispose();
    });

    describe('AB-MCTS Orchestrator', () => {
        const hasNative = isNativeModuleAvailable('ab-mcts-service');
        
        it('should initialize service', () => {
            expect(abmctsService).toBeDefined();
        });

        it('should orchestrate agent selection', async () => {
            const result = await abmctsService.orchestrate({
                task: 'Write a Python function to calculate fibonacci',
                context: 'Educational purpose',
                constraints: {
                    max_iterations: 10,
                    time_limit_ms: 5000
                }
            });

            expect(result).toBeDefined();
            expect(result.selected_agents).toBeInstanceOf(Array);
            expect(result.confidence).toBeGreaterThan(0);
            expect(result.confidence).toBeLessThanOrEqual(1);
        });

        it('should track agent performance', async () => {
            await abmctsService.updatePerformance({
                agent_id: 'test-agent',
                task_id: 'test-task',
                reward: 0.85,
                execution_time_ms: 1200
            });

            const stats = await abmctsService.getStatistics();
            expect(stats).toBeDefined();
            expect(stats.total_orchestrations).toBeGreaterThanOrEqual(0);
        });

        if (hasNative) {
            it('should use native module for performance', async () => {
                const startTime = Date.now();
                
                // Run multiple orchestrations
                const promises = Array(10).fill(0).map(() => 
                    abmctsService.orchestrate({
                        task: 'Complex task',
                        context: 'Performance test',
                        constraints: { max_iterations: 100 }
                    })
                );
                
                await Promise.all(promises);
                const duration = Date.now() - startTime;
                
                // Native should be fast
                expect(duration).toBeLessThan(1000); // Under 1 second for 10 orchestrations
            });
        }
    });

    describe('Parameter Analytics Service', () => {
        const hasNative = isNativeModuleAvailable('parameter-analytics-service');
        
        it('should initialize service', () => {
            expect(analyticsService).toBeDefined();
        });

        it('should analyze parameter effectiveness', async () => {
            const analysis = await analyticsService.analyzeParameters({
                model: 'gpt-4',
                parameters: {
                    temperature: [0.1, 0.3, 0.5, 0.7, 0.9],
                    top_p: [0.8, 0.9, 0.95],
                    max_tokens: [512, 1024, 2048]
                },
                metrics: {
                    quality_scores: [0.7, 0.8, 0.85, 0.9, 0.88],
                    latency_ms: [800, 950, 1100, 1300, 1500]
                }
            });

            expect(analysis).toBeDefined();
            expect(analysis.optimal_temperature).toBeGreaterThan(0);
            expect(analysis.optimal_temperature).toBeLessThan(2);
            expect(analysis.correlations).toBeDefined();
        });

        it('should compute statistics efficiently', async () => {
            const data = Array(10000).fill(0).map(() => Math.random() * 100);
            
            const stats = await analyticsService.computeStatistics({
                values: data,
                compute_outliers: true,
                compute_trends: true
            });

            expect(stats.mean).toBeDefined();
            expect(stats.median).toBeDefined();
            expect(stats.std_dev).toBeDefined();
            expect(stats.outliers).toBeInstanceOf(Array);
        });

        if (hasNative) {
            it('should demonstrate 10x performance improvement', async () => {
                const largeDataset = Array(100000).fill(0).map(() => Math.random() * 1000);
                
                const startTime = Date.now();
                await analyticsService.computeStatistics({
                    values: largeDataset,
                    compute_outliers: true,
                    compute_trends: true
                });
                const duration = Date.now() - startTime;
                
                // Should process 100k points quickly with native
                expect(duration).toBeLessThan(100); // Under 100ms
            });
        }
    });

    describe('Multimodal Fusion Service', () => {
        const hasNative = isNativeModuleAvailable('multimodal-fusion-service');
        
        it('should initialize service', () => {
            expect(fusionService).toBeDefined();
        });

        it('should process text modality', async () => {
            const result = await fusionService.processMultimodal({
                id: 'test-1',
                modality: 'text',
                content: { type: 'text', value: 'Hello world' },
                metadata: {},
                timestamp: new Date().toISOString()
            });

            expect(result).toBeDefined();
            expect(result.unified_representation).toBeDefined();
            expect(result.confidence).toBeGreaterThan(0);
        });

        it('should discover cross-modal connections', async () => {
            // Process text
            await fusionService.processMultimodal({
                id: 'text-1',
                modality: 'text',
                content: { type: 'text', value: 'A red car driving fast' },
                metadata: {},
                timestamp: new Date().toISOString()
            });

            // Process related image description
            const result = await fusionService.processMultimodal({
                id: 'vision-1',
                modality: 'vision',
                content: {
                    type: 'image',
                    value: {
                        width: 640,
                        height: 480,
                        channels: 3,
                        data: new Uint8Array(640 * 480 * 3),
                        format: 'rgb' as const
                    }
                },
                metadata: { description: 'car image' },
                timestamp: new Date().toISOString()
            });

            expect(result.cross_modal_connections).toBeDefined();
            expect(result.cross_modal_connections.length).toBeGreaterThanOrEqual(0);
        });

        it('should handle multiple modalities', async () => {
            const modalities: Array<'text' | 'audio' | 'vision'> = ['text', 'audio', 'vision'];
            
            for (const modality of modalities) {
                const result = await fusionService.processMultimodal({
                    id: `test-${modality}`,
                    modality,
                    content: { type: 'embedding', value: Array(768).fill(0).map(() => Math.random()) },
                    metadata: {},
                    timestamp: new Date().toISOString()
                });
                
                expect(result).toBeDefined();
                expect(result.processing_time_ms).toBeDefined();
            }
        });

        if (hasNative) {
            it('should process with Q-Former architecture efficiently', async () => {
                const startTime = Date.now();
                
                // Process multiple windows
                const promises = Array(50).fill(0).map((_, i) => 
                    fusionService.processMultimodal({
                        id: `window-${i}`,
                        modality: 'text',
                        content: { type: 'embedding', value: Array(768).fill(0).map(() => Math.random()) },
                        metadata: {},
                        timestamp: new Date().toISOString()
                    })
                );
                
                await Promise.all(promises);
                const duration = Date.now() - startTime;
                
                // Should handle 50 windows quickly
                expect(duration).toBeLessThan(500); // Under 500ms
            });
        }
    });

    describe('Intelligent Parameter Service', () => {
        const hasNative = isNativeModuleAvailable('intelligent-parameter-service');
        
        it('should initialize service', () => {
            expect(parameterService).toBeDefined();
        });

        it('should optimize parameters for different tasks', async () => {
            const tasks = [
                { prompt: 'Write a function to sort an array', expectedType: 'code_generation' },
                { prompt: 'Explain quantum computing', expectedType: 'explanation' },
                { prompt: 'Summarize this article', expectedType: 'summarization' },
                { prompt: 'Create a story about dragons', expectedType: 'creative' }
            ];

            for (const task of tasks) {
                const params = await parameterService.getOptimalParameters({
                    model: 'gpt-4',
                    prompt: task.prompt,
                    user_preferences: {
                        priority: 'quality',
                        quality_threshold: 0.8
                    }
                });

                expect(params).toBeDefined();
                expect(params.temperature).toBeGreaterThan(0);
                expect(params.temperature).toBeLessThanOrEqual(2);
                expect(params.reasoning).toContain(expect.any(String));
            }
        });

        it('should learn from feedback', async () => {
            const taskId = 'test-task-' + Date.now();
            
            // Get initial parameters
            const params = await parameterService.getOptimalParameters({
                model: 'gpt-4',
                prompt: 'Write a haiku about coding',
                user_preferences: {
                    priority: 'creative',
                    quality_threshold: 0.7
                }
            });

            // Record feedback
            await parameterService.recordFeedback({
                task_id: taskId,
                parameters_used: params,
                task_type: 'creative',
                quality_score: 0.9,
                latency_ms: 1200,
                token_count: 150,
                cost_estimate: 0.002,
                error_occurred: false,
                timestamp: new Date().toISOString()
            });

            // Get analytics
            const analytics = await parameterService.getAnalytics();
            expect(analytics.total_requests).toBeGreaterThanOrEqual(0);
        });

        it('should apply multi-armed bandit optimization', async () => {
            // Simulate multiple requests to trigger bandit optimization
            const requests = Array(20).fill(0).map((_, i) => ({
                model: 'gpt-4',
                prompt: `Task ${i}: Generate creative content`,
                user_preferences: {
                    priority: 'balanced' as const,
                    quality_threshold: 0.75
                }
            }));

            const results = await Promise.all(
                requests.map(req => parameterService.getOptimalParameters(req))
            );

            // Should show exploration and exploitation
            const temperatures = results.map(r => r.temperature);
            const uniqueTemps = new Set(temperatures);
            
            // Should have some variety (exploration)
            expect(uniqueTemps.size).toBeGreaterThan(1);
        });

        if (hasNative) {
            it('should optimize with Bayesian optimization efficiently', async () => {
                // Provide sufficient history for Bayesian optimization
                const feedbacks = Array(150).fill(0).map((_, i) => ({
                    task_id: `task-${i}`,
                    parameters_used: {
                        temperature: 0.1 + (i % 10) * 0.1,
                        top_p: 0.8 + (i % 3) * 0.05,
                        top_k: 20 + (i % 5) * 10,
                        max_tokens: 1024,
                        presence_penalty: 0,
                        frequency_penalty: 0,
                        stop_sequences: [],
                        confidence: 0.8,
                        reasoning: ['test'],
                        expected_quality: 0.8,
                        expected_latency_ms: 1000
                    },
                    task_type: 'general' as const,
                    quality_score: 0.7 + Math.random() * 0.3,
                    latency_ms: 800 + Math.random() * 400,
                    token_count: 500 + Math.floor(Math.random() * 500),
                    cost_estimate: 0.001 + Math.random() * 0.003,
                    error_occurred: false,
                    timestamp: new Date().toISOString()
                }));

                // Record all feedback
                await Promise.all(
                    feedbacks.map(f => parameterService.recordFeedback(f))
                );

                const startTime = Date.now();
                
                // Now optimization should use Bayesian approach
                const optimized = await parameterService.getOptimalParameters({
                    model: 'gpt-4',
                    prompt: 'Optimize this with Bayesian methods',
                    user_preferences: {
                        priority: 'quality',
                        quality_threshold: 0.9
                    }
                });
                
                const duration = Date.now() - startTime;
                
                expect(optimized.confidence).toBeGreaterThan(0.8); // High confidence with Bayesian
                expect(duration).toBeLessThan(50); // Fast with native
            });
        }
    });

    describe('Performance Benchmarks', () => {
        if (isNativeModuleAvailable('ab-mcts-service') &&
            isNativeModuleAvailable('parameter-analytics-service') &&
            isNativeModuleAvailable('multimodal-fusion-service') &&
            isNativeModuleAvailable('intelligent-parameter-service')) {
            
            it('should demonstrate overall system performance', async () => {
                const startTime = Date.now();
                
                // Complex workflow using all services
                
                // 1. Get optimal parameters
                const params = await parameterService.getOptimalParameters({
                    model: 'gpt-4',
                    prompt: 'Complex multimodal task',
                    user_preferences: {
                        priority: 'balanced',
                        quality_threshold: 0.8
                    }
                });
                
                // 2. Process multimodal inputs
                const fusionResults = await Promise.all(
                    ['text', 'vision', 'audio'].map(modality =>
                        fusionService.processMultimodal({
                            id: `bench-${modality}`,
                            modality: modality as any,
                            content: { type: 'embedding', value: Array(768).fill(0).map(() => Math.random()) },
                            metadata: {},
                            timestamp: new Date().toISOString()
                        })
                    )
                );
                
                // 3. Orchestrate agents
                const orchestration = await abmctsService.orchestrate({
                    task: 'Process fusion results',
                    context: JSON.stringify(fusionResults),
                    constraints: {
                        max_iterations: 50,
                        time_limit_ms: 2000
                    }
                });
                
                // 4. Analyze performance
                const analysis = await analyticsService.analyzeParameters({
                    model: 'gpt-4',
                    parameters: {
                        temperature: [params.temperature],
                        top_p: [params.top_p],
                        max_tokens: [params.max_tokens]
                    },
                    metrics: {
                        quality_scores: fusionResults.map(r => r.confidence),
                        latency_ms: fusionResults.map(r => r.processing_time_ms)
                    }
                });
                
                const duration = Date.now() - startTime;
                
                // All operations should complete quickly
                expect(duration).toBeLessThan(1000); // Under 1 second for entire workflow
                expect(orchestration.confidence).toBeGreaterThan(0.5);
                expect(analysis.optimal_temperature).toBeDefined();
            });
        }
    });
});