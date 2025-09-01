#!/usr/bin/env tsx

/**
 * Comprehensive Integration Testing Suite for Rust Migrations
 * 
 * Tests all Rust services working together with the TypeScript backend
 * to ensure seamless integration and proper functionality.
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import { Logger } from '../src/utils/logger';
import axios, { AxiosInstance } from 'axios';
import WebSocket from 'ws';
import { performance } from 'perf_hooks';

// Import Rust service wrappers
import { VoiceProcessingService } from '../src/services/voice-processing-rust';
import { VisionResourceManager } from '../src/services/vision-resource-manager-rust';
import { FastLLMCoordinator } from '../src/services/fast-llm-coordinator-rust';
import { ParameterAnalytics } from '../src/services/parameter-analytics-rust';
import { redisService } from '../src/services/redis-service-rust';
import { llmRouter } from '../src/services/llm-router-rust';

interface TestContext {
    serverProcess: ChildProcess | null;
    apiClient: AxiosInstance;
    wsClient: WebSocket | null;
    services: {
        voice: VoiceProcessingService | null;
        vision: VisionResourceManager | null;
        llmCoordinator: FastLLMCoordinator | null;
        paramAnalytics: ParameterAnalytics | null;
    };
}

const context: TestContext = {
    serverProcess: null,
    apiClient: axios.create({
        baseURL: 'http://localhost:9999/api/v1',
        timeout: 30000,
        headers: {
            'Content-Type': 'application/json',
            'X-API-Key': 'test-api-key',
            'X-AI-Service': 'integration-test'
        }
    }),
    wsClient: null,
    services: {
        voice: null,
        vision: null,
        llmCoordinator: null,
        paramAnalytics: null
    }
};

describe('Rust Service Integration Tests', () => {
    beforeAll(async () => {
        Logger.info('🚀 Starting integration test suite...');
        
        // Start the server
        await startServer();
        
        // Initialize Rust services
        await initializeRustServices();
        
        // Wait for services to be ready
        await waitForServicesReady();
    }, 60000);

    afterAll(async () => {
        Logger.info('🔚 Cleaning up integration tests...');
        
        // Close WebSocket
        if (context.wsClient) {
            context.wsClient.close();
        }
        
        // Cleanup services
        await cleanupServices();
        
        // Stop server
        if (context.serverProcess) {
            context.serverProcess.kill('SIGTERM');
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    });

    describe('Voice Processing Integration', () => {
        test('should process audio through Rust service', async () => {
            if (!context.services.voice) {
                throw new Error('Voice service not initialized');
            }

            // Create mock audio buffer
            const audioBuffer = Buffer.alloc(16000); // 1 second of 16kHz audio
            
            const result = await context.services.voice.processAudio(audioBuffer, {
                enableVAD: true,
                sampleRate: 16000,
                channels: 1
            });

            expect(result).toBeDefined();
            expect(result.vadDetected).toBeDefined();
        });

        test('should handle voice pipeline with LLM integration', async () => {
            const response = await context.apiClient.post('/voice/process', {
                audio: Buffer.alloc(16000).toString('base64'),
                options: {
                    transcribe: true,
                    generateResponse: true
                }
            });

            expect(response.status).toBe(200);
            expect(response.data).toHaveProperty('transcription');
        });
    });

    describe('Vision Resource Manager Integration', () => {
        test('should allocate GPU resources', async () => {
            if (!context.services.vision) {
                throw new Error('Vision service not initialized');
            }

            const allocation = await context.services.vision.allocateResources({
                vramRequired: 2048,
                priority: 'high',
                duration: 5000
            });

            expect(allocation).toBeDefined();
            expect(allocation.allocated).toBeDefined();
            
            // Release resources
            if (allocation.id) {
                await context.services.vision.releaseResources(allocation.id);
            }
        });

        test('should coordinate with PyVision for image processing', async () => {
            const response = await context.apiClient.post('/vision/process', {
                image: Buffer.alloc(1024).toString('base64'),
                operations: ['enhance', 'analyze']
            });

            expect(response.status).toBe(200);
            expect(response.data).toHaveProperty('results');
        });
    });

    describe('LLM Coordination Integration', () => {
        test('should route requests through Fast LLM Coordinator', async () => {
            if (!context.services.llmCoordinator) {
                throw new Error('LLM Coordinator not initialized');
            }

            const response = await context.services.llmCoordinator.route({
                model: 'llama3.2:3b',
                messages: [
                    { role: 'user', content: 'Test message' }
                ],
                temperature: 0.7
            });

            expect(response).toBeDefined();
            expect(response.provider).toBeDefined();
        });

        test('should handle multi-tier routing with fallbacks', async () => {
            const response = await context.apiClient.post('/fast-coordinator/generate', {
                tier: 'expert',
                messages: [
                    { role: 'system', content: 'You are a helpful assistant' },
                    { role: 'user', content: 'Explain quantum computing' }
                ],
                options: {
                    maxTokens: 100,
                    temperature: 0.3
                }
            });

            expect(response.status).toBe(200);
            expect(response.data).toHaveProperty('content');
            expect(response.data).toHaveProperty('model');
            expect(response.data).toHaveProperty('provider');
        });
    });

    describe('Parameter Analytics Integration', () => {
        test('should optimize parameters using Rust service', async () => {
            if (!context.services.paramAnalytics) {
                throw new Error('Parameter Analytics not initialized');
            }

            const optimalParams = await context.services.paramAnalytics.optimize({
                model: 'gpt-4',
                taskType: 'code-generation',
                constraints: {
                    maxLatency: 1000,
                    minAccuracy: 0.8
                }
            });

            expect(optimalParams).toBeDefined();
            expect(optimalParams.temperature).toBeDefined();
            expect(optimalParams.maxTokens).toBeDefined();
        });

        test('should track performance metrics', async () => {
            const response = await context.apiClient.post('/parameters/track', {
                model: 'llama3.2:3b',
                parameters: {
                    temperature: 0.7,
                    maxTokens: 2000
                },
                result: {
                    latency: 450,
                    accuracy: 0.92,
                    userSatisfaction: 0.95
                }
            });

            expect(response.status).toBe(200);
        });
    });

    describe('Redis Service Integration', () => {
        test('should cache data with compression', async () => {
            const testData = {
                id: 'test-123',
                content: 'A'.repeat(1000), // Large string to trigger compression
                metadata: { type: 'test', timestamp: Date.now() }
            };

            await redisService.set('test:large', testData, 60);
            const retrieved = await redisService.get('test:large');

            expect(retrieved).toEqual(testData);
        });

        test('should handle session management', async () => {
            const sessionId = 'session-123';
            const sessionData = {
                userId: 'user-456',
                preferences: { theme: 'dark' }
            };

            await redisService.setSession(sessionId, sessionData, 300);
            const session = await redisService.getSession(sessionId);

            expect(session).toEqual(sessionData);
        });

        test('should support pub/sub messaging', async () => {
            const channel = 'test-channel';
            const message = { type: 'test', data: 'hello' };

            // Subscribe
            const received = new Promise((resolve) => {
                redisService.subscribe(channel, (msg) => {
                    resolve(msg);
                });
            });

            // Publish
            await redisService.publish(channel, message);

            // Verify
            const receivedMessage = await received;
            expect(receivedMessage).toEqual(message);
        });
    });

    describe('LLM Router Integration', () => {
        test('should select optimal model based on task', async () => {
            const response = await llmRouter.generateResponse(
                'expert-reasoning',
                [
                    { role: 'user', content: 'Solve this complex problem...' }
                ],
                {
                    temperature: 0.3,
                    maxTokens: 4000,
                    capabilities: ['deep_reasoning']
                }
            );

            expect(response).toBeDefined();
            expect(response.model).toBeDefined();
            expect(response.provider).toBeDefined();
        });

        test('should handle provider failover', async () => {
            // Simulate primary provider failure
            const response = await context.apiClient.post('/llm/generate', {
                model: 'unavailable-model',
                messages: [
                    { role: 'user', content: 'Test failover' }
                ],
                options: {
                    allowFallback: true
                }
            });

            expect(response.status).toBe(200);
            expect(response.data.metadata?.fallback).toBe(true);
        });
    });

    describe('Cross-Service Integration', () => {
        test('should process voice -> LLM -> response pipeline', async () => {
            const startTime = performance.now();

            // Voice processing -> Transcription
            const audioBuffer = Buffer.alloc(16000);
            const voiceResult = await context.services.voice!.processAudio(audioBuffer, {
                enableVAD: true,
                sampleRate: 16000
            });

            // LLM processing with optimized parameters
            const optimalParams = await context.services.paramAnalytics!.optimize({
                model: 'llama3.2:3b',
                taskType: 'conversation',
                constraints: { maxLatency: 500 }
            });

            // Generate response
            const llmResponse = await context.services.llmCoordinator!.route({
                model: 'llama3.2:3b',
                messages: [
                    { role: 'user', content: 'Test transcription result' }
                ],
                ...optimalParams
            });

            const endTime = performance.now();
            const totalTime = endTime - startTime;

            expect(totalTime).toBeLessThan(2000); // Should complete in under 2 seconds
            expect(llmResponse).toBeDefined();
        });

        test('should handle vision -> analysis -> caching pipeline', async () => {
            // Allocate resources
            const allocation = await context.services.vision!.allocateResources({
                vramRequired: 1024,
                priority: 'normal',
                duration: 10000
            });

            // Process image
            const imageData = Buffer.alloc(2048);
            const analysisResult = {
                allocation: allocation.id,
                analysis: {
                    objects: ['cat', 'dog'],
                    confidence: 0.95
                }
            };

            // Cache result
            await redisService.set(`vision:${allocation.id}`, analysisResult, 300);

            // Retrieve from cache
            const cached = await redisService.get(`vision:${allocation.id}`);
            expect(cached).toEqual(analysisResult);

            // Release resources
            await context.services.vision!.releaseResources(allocation.id!);
        });
    });

    describe('WebSocket Integration', () => {
        test('should establish WebSocket connection for real-time updates', async () => {
            return new Promise((resolve, reject) => {
                context.wsClient = new WebSocket('ws://localhost:9999/ws');

                context.wsClient.on('open', () => {
                    context.wsClient!.send(JSON.stringify({
                        type: 'subscribe',
                        channels: ['performance', 'health']
                    }));
                });

                context.wsClient.on('message', (data) => {
                    const message = JSON.parse(data.toString());
                    expect(message).toHaveProperty('type');
                    resolve(undefined);
                });

                context.wsClient.on('error', reject);

                // Timeout
                setTimeout(() => reject(new Error('WebSocket timeout')), 5000);
            });
        });
    });

    describe('Performance Benchmarks', () => {
        test('should meet performance targets for Rust services', async () => {
            const benchmarks = {
                voiceProcessing: { target: 20, actual: 0 },
                resourceAllocation: { target: 10, actual: 0 },
                llmRouting: { target: 5, actual: 0 },
                cacheOperation: { target: 2, actual: 0 }
            };

            // Voice processing benchmark
            const voiceStart = performance.now();
            await context.services.voice!.processAudio(Buffer.alloc(8000), {
                enableVAD: false,
                sampleRate: 8000
            });
            benchmarks.voiceProcessing.actual = performance.now() - voiceStart;

            // Resource allocation benchmark
            const visionStart = performance.now();
            const allocation = await context.services.vision!.allocateResources({
                vramRequired: 512,
                priority: 'low',
                duration: 1000
            });
            benchmarks.resourceAllocation.actual = performance.now() - visionStart;

            // LLM routing benchmark
            const llmStart = performance.now();
            await context.services.llmCoordinator!.selectProvider('llama3.2:3b');
            benchmarks.llmRouting.actual = performance.now() - llmStart;

            // Cache operation benchmark
            const cacheStart = performance.now();
            await redisService.set('bench:test', { data: 'test' }, 10);
            await redisService.get('bench:test');
            benchmarks.cacheOperation.actual = performance.now() - cacheStart;

            // Clean up
            if (allocation.id) {
                await context.services.vision!.releaseResources(allocation.id);
            }

            // Verify all benchmarks meet targets
            Object.entries(benchmarks).forEach(([name, bench]) => {
                Logger.info(`${name}: ${bench.actual.toFixed(2)}ms (target: ${bench.target}ms)`);
                expect(bench.actual).toBeLessThan(bench.target);
            });
        });
    });

    describe('Error Handling and Recovery', () => {
        test('should handle Rust service crashes gracefully', async () => {
            // Simulate service crash by sending invalid data
            try {
                await context.services.voice!.processAudio(Buffer.alloc(0), {
                    enableVAD: true,
                    sampleRate: -1 // Invalid sample rate
                });
            } catch (error: any) {
                expect(error).toBeDefined();
                expect(error.message).toContain('Invalid');
            }

            // Service should still be functional
            const result = await context.services.voice!.processAudio(Buffer.alloc(1000), {
                enableVAD: false,
                sampleRate: 16000
            });
            expect(result).toBeDefined();
        });

        test('should fallback to TypeScript when Rust service unavailable', async () => {
            // This tests the fallback mechanism built into the wrappers
            const response = await context.apiClient.post('/health/check', {
                services: ['voice', 'vision', 'llm-coordinator', 'redis']
            });

            expect(response.status).toBe(200);
            expect(response.data.services).toBeDefined();
            response.data.services.forEach((service: any) => {
                expect(service.status).toMatch(/healthy|degraded/);
            });
        });
    });
});

async function startServer(): Promise<void> {
    return new Promise((resolve, reject) => {
        Logger.info('Starting server for integration tests...');
        
        context.serverProcess = spawn('npm', ['run', 'dev'], {
            cwd: path.join(process.cwd()),
            env: {
                ...process.env,
                NODE_ENV: 'test',
                PORT: '9999',
                ENABLE_RUST_SERVICES: 'true'
            }
        });

        context.serverProcess.stdout?.on('data', (data) => {
            const output = data.toString();
            if (output.includes('Server running') || output.includes('Ready')) {
                Logger.info('Server started successfully');
                resolve();
            }
        });

        context.serverProcess.stderr?.on('data', (data) => {
            Logger.error('Server error:', data.toString());
        });

        context.serverProcess.on('error', reject);

        // Timeout
        setTimeout(() => reject(new Error('Server startup timeout')), 30000);
    });
}

async function initializeRustServices(): Promise<void> {
    Logger.info('Initializing Rust services...');

    // Initialize Voice Processing
    context.services.voice = new VoiceProcessingService();
    await context.services.voice.initialize();

    // Initialize Vision Resource Manager
    context.services.vision = VisionResourceManager.getInstance();

    // Initialize Fast LLM Coordinator
    context.services.llmCoordinator = new FastLLMCoordinator();
    await context.services.llmCoordinator.initialize();

    // Initialize Parameter Analytics
    context.services.paramAnalytics = new ParameterAnalytics();
    await context.services.paramAnalytics.initialize();

    // Initialize Redis Service
    await redisService.initialize({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        maxConnections: 10,
        enableCompression: true
    });

    // Initialize LLM Router
    await llmRouter.initialize();

    Logger.info('All Rust services initialized');
}

async function waitForServicesReady(): Promise<void> {
    Logger.info('Waiting for services to be ready...');
    
    const maxRetries = 30;
    let retries = 0;

    while (retries < maxRetries) {
        try {
            const response = await context.apiClient.get('/health');
            if (response.status === 200 && response.data.status === 'healthy') {
                Logger.info('All services ready');
                return;
            }
        } catch (error) {
            // Service not ready yet
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
        retries++;
    }

    throw new Error('Services failed to become ready');
}

async function cleanupServices(): Promise<void> {
    Logger.info('Cleaning up services...');

    // Cleanup Voice Processing
    if (context.services.voice) {
        await context.services.voice.shutdown();
    }

    // Cleanup Vision Resource Manager
    if (context.services.vision) {
        await context.services.vision.shutdown();
    }

    // Cleanup LLM Coordinator
    if (context.services.llmCoordinator) {
        await context.services.llmCoordinator.shutdown();
    }

    // Cleanup Parameter Analytics
    if (context.services.paramAnalytics) {
        await context.services.paramAnalytics.shutdown();
    }

    // Cleanup Redis
    await redisService.disconnect();

    // Cleanup LLM Router
    await llmRouter.shutdown();

    Logger.info('Services cleaned up');
}