import { spawn } from 'child_process';
import { getModelForTask } from '../config/models';
import { THREE } from '../utils/constants';
import { log, LogContext } from '../utils/logger';
import { ollamaService } from './ollama-service';
import { visionResourceManager } from './vision-resource-manager';
export class PyVisionBridge {
    pythonProcess = null;
    isInitialized = false;
    pendingRequests = new Map();
    requestQueue = [];
    metrics = {
        avgResponseTime: 0,
        totalRequests: 0,
        successRate: 1.0,
        cacheHitRate: 0,
        modelsLoaded: [],
    };
    cache = new Map();
    maxCacheSize = 1000;
    constructor() {
        this.initializePyVision();
    }
    async initializePyVision() {
        try {
            log.info('🚀 Initializing PyVision bridge service', LogContext.AI);
            const pythonScript = `/Users/christianmerrill/Desktop/universal-ai-tools/src/services/pyvision-server.py`;
            this.pythonProcess = spawn('python3', [pythonScript], {
                stdio: ['pipe', 'pipe', 'pipe'],
                env: {
                    ...process.env,
                    PYTHONPATH: '/Users/christianmerrill/Desktop/universal-ai-tools',
                    PYTORCH_ENABLE_MPS_FALLBACK: '1',
                },
            });
            if (!this.pythonProcess.stdout || !this.pythonProcess.stderr || !this.pythonProcess.stdin) {
                throw new Error('Failed to create Python process stdio');
            }
            this.pythonProcess.stdout.on('data', (data) => {
                const output = data.toString();
                log.info('📥 PyVision stdout data received', LogContext.AI, { output: output.trim() });
                this.handlePythonResponse(output);
            });
            this.pythonProcess.stderr.on('data', (data) => {
                const message = data.toString();
                log.info('📥 PyVision stderr data received', LogContext.AI, { message: message.trim() });
                if (message.includes('ERROR') ||
                    message.includes('CRITICAL') ||
                    message.includes('Traceback')) {
                    log.error('❌ PyVision Python error', LogContext.AI, { error: message });
                }
                else if (message.includes('WARNING')) {
                    log.warn('⚠️ PyVision Python warning', LogContext.AI, { message });
                }
                else {
                    log.debug('PyVision Python output', LogContext.AI, { message });
                }
            });
            this.pythonProcess.on('exit', (code) => {
                log.warn(`⚠️ PyVision Python process exited with code ${code}`, LogContext.AI);
                this.isInitialized = false;
                this.restartProcess();
            });
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    log.error('❌ PyVision initialization timeout after 30s', LogContext.AI, {
                        isInitialized: this.isInitialized,
                        processExists: !!this.pythonProcess,
                        processKilled: this.pythonProcess?.killed,
                    });
                    reject(new Error('PyVision initialization timeout'));
                }, 30000);
                const checkInit = () => {
                    if (this.isInitialized) {
                        clearTimeout(timeout);
                        log.info('✅ PyVision initialization completed', LogContext.AI);
                        resolve(true);
                    }
                    else {
                        setTimeout(checkInit, 100);
                    }
                };
                checkInit();
            });
            log.info('✅ PyVision bridge service initialized', LogContext.AI);
        }
        catch (error) {
            log.error('❌ Failed to initialize PyVision bridge', LogContext.AI, { error });
            this.initializeMockVision();
        }
    }
    initializeMockVision() {
        log.warn('⚠️ Using mock PyVision implementation', LogContext.AI);
        this.isInitialized = true;
    }
    async analyzeImage(imagePath, options = {}) {
        const cacheKey = this.getCacheKey('analyze', imagePath, options);
        const cached = this.cache.get(cacheKey);
        if (cached) {
            this.metrics.cacheHitRate =
                (this.metrics.cacheHitRate * this.metrics.totalRequests + 1) /
                    (this.metrics.totalRequests + 1);
            return { ...cached, cached: true };
        }
        return visionResourceManager.executeWithModel('yolo-v8n', async () => {
            const response = await this.sendRequest({
                type: 'analyze',
                data: imagePath,
                options,
            });
            this.updateCache(cacheKey, response);
            return response;
        });
    }
    async generateEmbedding(imagePath) {
        const cacheKey = this.getCacheKey('embed', imagePath, {});
        const cached = this.cache.get(cacheKey);
        if (cached) {
            return { ...cached, cached: true };
        }
        return visionResourceManager.executeWithModel('clip-vit-b32', async () => {
            const response = await this.sendRequest({
                type: 'embed',
                data: imagePath,
            });
            this.updateCache(cacheKey, response);
            return response;
        });
    }
    async generateImage(prompt, parameters = {}) {
        return visionResourceManager.executeWithModel('sd3b', async () => {
            const response = await this.sendRequest({
                type: 'generate',
                data: prompt,
                options: parameters,
            });
            return response;
        }, 10);
    }
    async refineImage(imagePath, parameters = {}) {
        const cacheKey = this.getCacheKey('refine', imagePath, parameters);
        const cached = this.cache.get(cacheKey);
        if (cached) {
            this.metrics.cacheHitRate =
                (this.metrics.cacheHitRate * this.metrics.totalRequests + 1) /
                    (this.metrics.totalRequests + 1);
            return { ...cached, cached: true };
        }
        return visionResourceManager.executeWithModel('sdxl-refiner', async () => {
            const response = await this.sendRequest({
                type: 'refine',
                data: imagePath,
                options: {
                    strength: parameters.strength || 0.3,
                    steps: parameters.steps || 20,
                    guidance: parameters.guidance || 7.5,
                    backend: parameters.backend || 'auto',
                    ...parameters,
                },
            });
            this.updateCache(cacheKey, response);
            return response;
        }, 8);
    }
    async analyzeBatch(imagePaths, options = {}) {
        log.info('📦 Processing vision batch request', LogContext.AI, { count: imagePaths.length });
        const batchSize = THREE;
        const results = [];
        for (let i = 0; i < imagePaths.length; i += batchSize) {
            const batch = imagePaths.slice(i, i + batchSize);
            const batchResults = await Promise.all(batch.map((path) => this.analyzeImage(path, options)));
            results.push(...batchResults);
        }
        return results;
    }
    async reason(imagePath, question) {
        const analysis = await this.analyzeImage(imagePath);
        if (!analysis.success || !analysis.data) {
            return {
                success: false,
                error: 'Failed to analyze image',
                processingTime: 0,
                model: 'none',
            };
        }
        const prompt = this.createReasoningPrompt(analysis.data, question);
        try {
            const response = await ollamaService.generateResponse([{ role: 'user', content: prompt }], getModelForTask('multimodal_reasoning'));
            return {
                success: true,
                data: {
                    answer: response.message.content,
                    confidence: 0.85,
                    reasoning: 'Visual analysis combined with language model reasoning',
                },
                processingTime: response.total_duration ? response.total_duration / 1000000 : 1000,
                model: 'llava:13b',
            };
        }
        catch (error) {
            return this.textBasedReasoning(analysis.data, question);
        }
    }
    async sendRequest(request) {
        if (!this.isInitialized) {
            return this.generateMockResponse(request);
        }
        const requestId = this.generateRequestId();
        const startTime = Date.now();
        return new Promise((resolve, reject) => {
            this.pendingRequests.set(requestId, {
                resolve,
                reject,
                startTime,
                type: request.type,
            });
            const pythonRequest = {
                id: requestId,
                type: request.type,
                data: request.data instanceof Buffer ? request.data.toString('base64') : request.data,
                options: request.options || {},
            };
            if (this.pythonProcess && this.pythonProcess.stdin) {
                this.pythonProcess.stdin.write(`${JSON.stringify(pythonRequest)}\n`);
            }
            else {
                reject(new Error('Python process not available'));
            }
            const timeout = request.options?.timeout || 30000;
            setTimeout(() => {
                if (this.pendingRequests.has(requestId)) {
                    this.pendingRequests.delete(requestId);
                    reject(new Error(`PyVision request timeout (${timeout}ms)`));
                }
            }, timeout);
        });
    }
    handlePythonResponse(data) {
        const lines = data.trim().split('\n');
        for (const line of lines) {
            if (line.trim() === 'INITIALIZED') {
                log.info('🚀 PyVision server initialized successfully', LogContext.AI);
                this.isInitialized = true;
                continue;
            }
            if (line.trim() === '') {
                continue;
            }
            try {
                const response = JSON.parse(line);
                if (response.id && this.pendingRequests.has(response.id)) {
                    const { resolve, startTime } = this.pendingRequests.get(response.id);
                    this.pendingRequests.delete(response.id);
                    const executionTime = Date.now() - startTime;
                    this.updateMetrics(executionTime, response.success);
                    const visionResponse = {
                        success: response.success,
                        data: response.data,
                        error: response.error,
                        processingTime: executionTime,
                        model: response.model || 'unknown',
                    };
                    resolve(visionResponse);
                }
                if (response.type === 'model_loaded') {
                    this.metrics.modelsLoaded = response.models || [];
                    log.info('📊 PyVision models updated', LogContext.AI, { models: response.models });
                }
            }
            catch (error) {
                log.error('❌ Failed to parse PyVision response', LogContext.AI, { error, data: line });
            }
        }
    }
    createReasoningPrompt(analysis, question) {
        return `Image Analysis:
- Objects detected: ${analysis.objects.map((o) => `${o.class} (${(o.confidence * 100).toFixed(1)}%)`).join(', ')}
- Scene: ${analysis.scene.description}
- Tags: ${analysis.scene.tags.join(', ')}
${analysis.text.length > 0 ? `- Text found: ${analysis.text.map((t) => t.text).join(', ')}` : ''}

Question: ${question}

Please provide a detailed answer based on the visual analysis above.`;
    }
    async textBasedReasoning(analysis, question) {
        const prompt = this.createReasoningPrompt(analysis, question);
        try {
            const response = await ollamaService.generateResponse([{ role: 'user', content: prompt }], getModelForTask('quick_response'));
            return {
                success: true,
                data: {
                    answer: response.message.content,
                    confidence: 0.7,
                    reasoning: 'Text-based reasoning from visual analysis',
                },
                processingTime: response.total_duration ? response.total_duration / 1000000 : 500,
                model: 'llama3.2:3b',
            };
        }
        catch (error) {
            return {
                success: false,
                error: 'Reasoning failed',
                processingTime: 0,
                model: 'none',
            };
        }
    }
    generateMockResponse(request) {
        const mockResponses = {
            analyze: {
                objects: [
                    {
                        class: 'mock_object',
                        confidence: 0.95,
                        bbox: { x: 10, y: 10, width: 100, height: 100 },
                    },
                ],
                scene: {
                    description: 'Mock scene analysis',
                    tags: ['mock', 'test'],
                    mood: 'neutral',
                },
                text: [],
                confidence: 0.9,
                processingTimeMs: 100,
            },
            embed: {
                vector: new Float32Array(512).fill(0.1),
                model: 'clip-vit-b32',
                dimension: 512,
            },
            generate: {
                id: `mock_gen_${Date.now()}`,
                base64: 'mock_base64_image_data',
                prompt: request.data,
                model: 'sd3b',
                parameters: {
                    width: 512,
                    height: 512,
                    steps: 20,
                    guidance: 7.5,
                },
                quality: {
                    clipScore: 0.85,
                    aestheticScore: 0.8,
                    safetyScore: 0.95,
                    promptAlignment: 0.9,
                },
                timestamp: new Date(),
            },
        };
        return {
            success: true,
            data: mockResponses[request.type] || {},
            processingTime: 50 + Math.random() * 150,
            model: 'mock',
            cached: false,
        };
    }
    getCacheKey(type, data, options) {
        const dataKey = data instanceof Buffer ? data.toString('base64').substring(0, 50) : data;
        return `${type}_${dataKey}_${JSON.stringify(options)}`;
    }
    updateCache(key, value) {
        if (this.cache.size >= this.maxCacheSize) {
            const firstKey = this.cache.keys().next().value;
            if (firstKey !== undefined) {
                this.cache.delete(firstKey);
            }
        }
        this.cache.set(key, value);
    }
    updateMetrics(executionTime, success) {
        this.metrics.totalRequests++;
        const alpha = 0.1;
        this.metrics.avgResponseTime =
            alpha * executionTime + (1 - alpha) * this.metrics.avgResponseTime;
        this.metrics.successRate =
            (this.metrics.successRate * (this.metrics.totalRequests - 1) + (success ? 1 : 0)) /
                this.metrics.totalRequests;
    }
    generateRequestId() {
        return `pyvision_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    async restartProcess() {
        log.info('🔄 Restarting PyVision bridge service', LogContext.AI);
        if (this.pythonProcess) {
            this.pythonProcess.kill();
            this.pythonProcess = null;
        }
        this.pendingRequests.forEach(({ reject }) => {
            reject(new Error('PyVision process restarting'));
        });
        this.pendingRequests.clear();
        await new Promise((resolve) => setTimeout(resolve, 2000));
        this.initializePyVision();
    }
    getMetrics() {
        return {
            ...this.metrics,
            isInitialized: this.isInitialized,
        };
    }
    async shutdown() {
        log.info('🛑 Shutting down PyVision bridge service', LogContext.AI);
        if (this.pythonProcess) {
            this.pythonProcess.kill();
            this.pythonProcess = null;
        }
        this.isInitialized = false;
        this.cache.clear();
    }
    isAvailable() {
        return this.isInitialized;
    }
}
class SafePyVisionBridge {
    instance = null;
    initAttempted = false;
    isCircuitBreakerOpen = false;
    constructor() {
    }
    async execute(operation) {
        if (this.isCircuitBreakerOpen) {
            throw new Error('PyVision service temporarily unavailable');
        }
        try {
            if (!this.initAttempted && !this.instance) {
                this.initAttempted = true;
                try {
                    this.instance = new PyVisionBridge();
                    await new Promise((resolve, reject) => {
                        const timeout = setTimeout(() => {
                            log.warn('⚠️ PyVision bridge initialization timeout', LogContext.AI);
                            resolve();
                        }, 10000);
                        const checkInit = () => {
                            if (this.instance?.isAvailable()) {
                                clearTimeout(timeout);
                                log.info('✅ PyVision bridge initialized successfully', LogContext.AI);
                                resolve();
                            }
                            else {
                                setTimeout(checkInit, 100);
                            }
                        };
                        checkInit();
                    });
                }
                catch (error) {
                    log.warn('⚠️ PyVision bridge initialization failed, using fallback', LogContext.AI, {
                        error: error instanceof Error ? error.message : String(error),
                    });
                }
            }
            if (this.instance && this.instance.isAvailable()) {
                return await operation();
            }
            log.warn('PyVision bridge not available, using mock', LogContext.AI, {
                hasInstance: !!this.instance,
                isAvailable: this.instance?.isAvailable(),
            });
            throw new Error('PyVision not available');
        }
        catch (error) {
            this.isCircuitBreakerOpen = true;
            setTimeout(() => {
                this.isCircuitBreakerOpen = false;
            }, 5000);
            throw error;
        }
    }
    async analyzeImage(imagePath, options) {
        return this.execute(async () => {
            const result = await this.instance?.analyzeImage(imagePath, options);
            if (!result)
                throw new Error('PyVision not available');
            return result;
        });
    }
    async generateEmbedding(imagePath) {
        return this.execute(async () => {
            const result = await this.instance?.generateEmbedding(imagePath);
            if (!result)
                throw new Error('PyVision not available');
            return result;
        });
    }
    async generateImage(prompt, parameters) {
        return this.execute(async () => {
            const result = await this.instance?.generateImage(prompt, parameters);
            if (!result)
                throw new Error('PyVision not available');
            return result;
        });
    }
    async reason(imagePath, question) {
        return this.execute(async () => {
            const result = await this.instance?.reason(imagePath, question);
            if (!result)
                throw new Error('PyVision not available');
            return result;
        });
    }
    async refineImage(imagePath, parameters) {
        return this.execute(async () => {
            const result = await this.instance?.refineImage(imagePath, parameters);
            if (!result)
                throw new Error('PyVision not available');
            return result;
        });
    }
    async analyzeBatch(imagePaths, options) {
        return this.execute(async () => {
            const result = await this.instance?.analyzeBatch(imagePaths, options);
            if (!result)
                throw new Error('PyVision not available');
            return result;
        });
    }
    getMetrics() {
        if (this.instance) {
            return this.instance.getMetrics();
        }
        return {
            avgResponseTime: 0,
            totalRequests: 0,
            successRate: 0,
            cacheHitRate: 0,
            modelsLoaded: [],
            isInitialized: false,
        };
    }
    async shutdown() {
        if (this.instance) {
            await this.instance.shutdown();
        }
    }
    getCircuitBreakerMetrics() {
        return {
            isOpen: this.isCircuitBreakerOpen,
            failures: 0,
            successes: 0,
        };
    }
}
export const pyVisionBridge = new SafePyVisionBridge();
export default pyVisionBridge;
//# sourceMappingURL=pyvision-bridge.js.map