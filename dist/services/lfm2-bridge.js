import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { ollamaService } from '@/services/ollama-service';
import { CircuitBreaker, CircuitBreakerRegistry } from '@/utils/circuit-breaker';
import { THREE } from '@/utils/constants';
import { log, LogContext } from '@/utils/logger';
export class LFM2BridgeService {
    pythonProcess = null;
    isInitialized = false;
    requestQueue = [];
    pendingRequests = new Map();
    metrics = {
        avgResponseTime: 0,
        totalRequests: 0,
        successRate: 1.0,
        tokenThroughput: 0,
    };
    MAX_PENDING = parseInt(process.env.LFM2_MAX_PENDING || '50', 10);
    REQUEST_TIMEOUT_MS = parseInt(process.env.LFM2_TIMEOUT_MS || '10000', 10);
    MAX_CONCURRENCY = parseInt(process.env.LFM2_MAX_CONCURRENCY || '2', 10);
    MAX_TOKENS = parseInt(process.env.LFM2_MAX_TOKENS || '512', 10);
    MAX_PROMPT_CHARS = parseInt(process.env.LFM2_MAX_PROMPT_CHARS || '4000', 10);
    activeCount = 0;
    constructor() {
        if (process.env.DISABLE_LFM2 === 'true') {
            log.warn('⚠️ LFM2 disabled by DISABLE_LFM2 env flag', LogContext.AI);
            this.initializeMockLFM2();
        }
        else {
            this.initializeLFM2();
        }
    }
    async initializeLFM2() {
        try {
            log.info('🚀 Initializing LFM2-1.2B bridge service', LogContext.AI);
            const pythonBin = process.env.LFM2_PYTHON_BIN || 'python3';
            const scriptFromEnv = process.env.LFM2_PYTHON_SCRIPT;
            const defaultScript = path.join(__dirname, 'lfm2-server.py');
            const pythonScript = scriptFromEnv || defaultScript;
            const fs = await import('fs');
            if (!fs.existsSync(pythonScript)) {
                throw new Error(`LFM2 Python script not found at: ${pythonScript}`);
            }
            log.info('🐍 Starting LFM2 Python process', LogContext.AI, {
                pythonBin,
                scriptPath: pythonScript
            });
            this.pythonProcess = spawn(pythonBin, [pythonScript], {
                stdio: ['pipe', 'pipe', 'pipe'],
                env: { ...process.env },
            });
            if (!this.pythonProcess.stdout || !this.pythonProcess.stderr || !this.pythonProcess.stdin) {
                throw new Error('Failed to create Python process stdio');
            }
            this.pythonProcess.stdout.on('data', (data) => {
                this.handlePythonResponse(data.toString());
            });
            this.pythonProcess.stderr.on('data', (data) => {
                const message = data.toString().trim();
                if (message.includes('ERROR') ||
                    message.includes('CRITICAL') ||
                    message.includes('Traceback') ||
                    message.includes('Exception')) {
                    log.error('❌ LFM2 Python error', LogContext.AI, { error: message });
                }
                else if (message.includes('WARNING')) {
                    log.warn('⚠️ LFM2 Python warning', LogContext.AI, { message });
                }
                else if (message.length > 0) {
                    log.debug('LFM2 Python output', LogContext.AI, { message });
                }
            });
            this.pythonProcess.on('exit', (code) => {
                log.warn(`⚠️ LFM2 Python process exited with code ${code}`, LogContext.AI);
                this.isInitialized = false;
                this.restartProcess();
            });
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    log.error('❌ LFM2 initialization timeout after 30 seconds', LogContext.AI);
                    reject(new Error('LFM2 initialization timeout after 30 seconds'));
                }, 30000);
                const checkInit = () => {
                    if (this.isInitialized) {
                        clearTimeout(timeout);
                        log.info('✅ LFM2 initialization confirmed', LogContext.AI);
                        resolve(true);
                    }
                    else {
                        setTimeout(checkInit, 100);
                    }
                };
                setTimeout(checkInit, 200);
                if (this.pythonProcess) {
                    this.pythonProcess.on('exit', (code, signal) => {
                        if (!this.isInitialized && code !== 0) {
                            clearTimeout(timeout);
                            log.error('❌ LFM2 Python process exited early during initialization', LogContext.AI, {
                                exitCode: code,
                                signal,
                                error: 'Process terminated before initialization completed'
                            });
                            reject(new Error(`LFM2 Python process exited early with code ${code}, signal: ${signal}`));
                        }
                    });
                }
            });
            log.info('✅ LFM2-1.2B bridge service initialized', LogContext.AI);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : undefined;
            log.error('❌ Failed to initialize LFM2 bridge service', LogContext.AI, {
                error: errorMessage,
                stack: errorStack,
                details: error
            });
            this.initializeMockLFM2();
        }
    }
    initializeMockLFM2() {
        log.warn('⚠️ Using mock LFM2 implementation for testing', LogContext.AI);
        this.isInitialized = true;
    }
    async routingDecision(userRequest, context) {
        const prompt = this.createRoutingPrompt(userRequest, context);
        const response = await this.generate({
            prompt,
            maxLength: 200,
            temperature: 0.3,
            taskType: 'routing',
        });
        return this.parseRoutingResponse(response.content);
    }
    async quickResponse(userRequest, taskType = 'simple_qa') {
        const prompt = this.createQuickResponsePrompt(userRequest, taskType);
        return this.generate({
            prompt,
            maxLength: 150,
            temperature: 0.6,
            taskType,
        });
    }
    async coordinateAgents(primaryTask, supportingTasks) {
        const prompt = this.createCoordinationPrompt(primaryTask, supportingTasks);
        const response = await this.generate({
            prompt,
            maxLength: 300,
            temperature: 0.4,
            taskType: 'coordination',
        });
        return this.parseCoordinationResponse(response.content);
    }
    async generate(request) {
        if (!this.isInitialized) {
            return this.generateMockResponse(request);
        }
        if (this.pendingRequests.size >= this.MAX_PENDING) {
            log.warn('⚠️ LFM2 pending request limit reached, rejecting quickly', LogContext.AI, {
                maxPending: this.MAX_PENDING,
            });
            return {
                content: "I'm currently handling a lot of requests. Please try again in a moment.",
                tokens: 10,
                executionTime: 1,
                model: 'lfm2-overload-fallback',
                confidence: 0.3,
            };
        }
        const requestId = this.generateRequestId();
        const startTime = Date.now();
        const clampedPrompt = (request.prompt || '').slice(0, this.MAX_PROMPT_CHARS);
        const clampedTokens = Math.max(1, Math.min(request.maxTokens || request.maxLength || 512, this.MAX_TOKENS));
        return new Promise((resolve, reject) => {
            const exec = () => {
                this.activeCount += 1;
                this.pendingRequests.set(requestId, { resolve, reject, startTime });
                const pythonRequest = {
                    type: request.taskType === 'coordination'
                        ? 'coordination'
                        : request.taskType === 'classification'
                            ? 'classification'
                            : 'completion',
                    requestId,
                    prompt: clampedPrompt,
                    maxTokens: clampedTokens,
                    temperature: request.temperature || 0.7,
                };
                if (this.pythonProcess && this.pythonProcess.stdin) {
                    this.pythonProcess.stdin.write(`${JSON.stringify(pythonRequest)}\n`);
                }
                else {
                    this.pendingRequests.delete(requestId);
                    this.activeCount = Math.max(0, this.activeCount - 1);
                    resolve(this.generateMockResponse(request));
                    this.dequeueNext();
                    return;
                }
                setTimeout(() => {
                    if (this.pendingRequests.has(requestId)) {
                        this.pendingRequests.delete(requestId);
                        this.activeCount = Math.max(0, this.activeCount - 1);
                        reject(new Error('LFM2 request timeout'));
                        this.dequeueNext();
                    }
                }, this.REQUEST_TIMEOUT_MS);
            };
            if (this.activeCount < this.MAX_CONCURRENCY) {
                exec();
            }
            else {
                this.requestQueue.push({ id: requestId, request, resolve, reject });
            }
        });
    }
    async generateBatch(requests) {
        log.info('📦 Processing LFM2 batch request', LogContext.AI, { count: requests.length });
        const batchSize = THREE;
        const results = [];
        for (let i = 0; i < requests.length; i += batchSize) {
            const batch = requests.slice(i, i + batchSize);
            const batchResults = await Promise.all(batch.map((request) => this.generate(request)));
            results.push(...batchResults);
        }
        return results;
    }
    handlePythonResponse(data) {
        const lines = data.trim().split('\n');
        for (const line of lines) {
            if (line === 'INITIALIZED') {
                this.isInitialized = true;
                continue;
            }
            try {
                const response = JSON.parse(line);
                if (response.requestId && this.pendingRequests.has(response.requestId)) {
                    const { resolve, reject, startTime } = this.pendingRequests.get(response.requestId);
                    this.pendingRequests.delete(response.requestId);
                    const executionTime = response.processingTime || Date.now() - startTime;
                    if (response.success) {
                        const content = response.text || response.strategy || response.category || '';
                        this.updateMetrics(executionTime, content.length);
                        resolve({
                            content,
                            tokens: Math.ceil(content.length / 4),
                            executionTime,
                            model: response.model || 'lfm2-1.2b',
                            confidence: response.confidence,
                        });
                    }
                    else {
                        reject(new Error(response.error || 'LFM2 processing failed'));
                    }
                    this.activeCount = Math.max(0, this.activeCount - 1);
                    this.dequeueNext();
                }
            }
            catch (error) {
                log.error('❌ Failed to parse LFM2 response', LogContext.AI, { error, data: line });
            }
        }
    }
    dequeueNext() {
        if (this.activeCount >= this.MAX_CONCURRENCY)
            return;
        const next = this.requestQueue.shift();
        if (!next)
            return;
        const { id, request, resolve, reject } = next;
        const startTime = Date.now();
        this.pendingRequests.set(id, { resolve, reject, startTime });
        this.activeCount += 1;
        const pythonRequest = {
            type: request.taskType === 'coordination'
                ? 'coordination'
                : request.taskType === 'classification'
                    ? 'classification'
                    : 'completion',
            requestId: id,
            prompt: (request.prompt || '').slice(0, this.MAX_PROMPT_CHARS),
            maxTokens: Math.max(1, Math.min(request.maxTokens || request.maxLength || 512, this.MAX_TOKENS)),
            temperature: request.temperature || 0.7,
        };
        if (this.pythonProcess && this.pythonProcess.stdin) {
            this.pythonProcess.stdin.write(`${JSON.stringify(pythonRequest)}\n`);
        }
        else {
            this.pendingRequests.delete(id);
            this.activeCount = Math.max(0, this.activeCount - 1);
            resolve(this.generateMockResponse(request));
            this.dequeueNext();
            return;
        }
        setTimeout(() => {
            if (this.pendingRequests.has(id)) {
                this.pendingRequests.delete(id);
                this.activeCount = Math.max(0, this.activeCount - 1);
                reject(new Error('LFM2 request timeout'));
                this.dequeueNext();
            }
        }, this.REQUEST_TIMEOUT_MS);
    }
    createRoutingPrompt(userRequest, context) {
        return `FAST ROUTING DECISION:

USER REQUEST: "${userRequest}"
CONTEXT: ${JSON.stringify(context)}

ROUTING OPTIONS:
- lfm2: Simple questions, quick responses (<100 tokens)
- ollama: Medium complexity, general purpose (<1000 tokens)
- lm-studio: Code generation, technical tasks (<2000 tokens)
- openai: Complex reasoning, creative tasks (>1000 tokens)
- anthropic: Analysis, research, long-form content

Respond with JSON:
{"service": "...", "confidence": 0.0-1.0, "reasoning": "...", "tokens": number}`;
    }
    createQuickResponsePrompt(userRequest, taskType) {
        const taskInstructions = {
            classification: 'Classify this request into categories and respond briefly.',
            simple_qa: 'Answer this question quickly and concisely.',
        };
        return `${taskInstructions[taskType]}

REQUEST: "${userRequest}"

Response:`;
    }
    createCoordinationPrompt(primaryTask, supportingTasks) {
        return `AGENT COORDINATION PLAN:

PRIMARY TASK: "${primaryTask}"
SUPPORTING TASKS: ${supportingTasks.map((task, i) => `${i + 1}. "${task}"`).join(', ')}

Create execution plan with priorities, resource allocation, and timing.

Respond with JSON:
{
  "execution_plan": {
    "primary_priority": 1-5,
    "supporting_priorities": [1-5, ...],
    "parallel_execution": boolean,
    "estimated_total_time": seconds
  },
  "resource_allocation": {
    "primary_service": "service_name",
    "supporting_services": ["service1", "service2", ...]
  }
}`;
    }
    parseRoutingResponse(content) {
        try {
            const jsonMatch = content.match(/{.*}/s);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    targetService: parsed.service || 'ollama',
                    confidence: parsed.confidence || 0.7,
                    reasoning: parsed.reasoning || 'Automatic routing decision',
                    estimatedTokens: parsed.tokens || 100,
                };
            }
        }
        catch (error) {
            log.warn('⚠️ Failed to parse LFM2 routing response', LogContext.AI);
        }
        return {
            targetService: 'ollama',
            confidence: 0.5,
            reasoning: 'Fallback routing due to parsing error',
            estimatedTokens: 100,
        };
    }
    parseCoordinationResponse(content) {
        try {
            const jsonMatch = content.match(/{.*}/s);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        }
        catch (error) {
            log.warn('⚠️ Failed to parse LFM2 coordination response', LogContext.AI);
        }
        return {
            execution_plan: {
                primary_priority: 1,
                supporting_priorities: [2, 3],
                parallel_execution: true,
                estimated_total_time: 30,
            },
            resource_allocation: {
                primary_service: 'ollama',
                supporting_services: ['lfm2', 'ollama'],
            },
        };
    }
    generateMockResponse(request) {
        const mockContent = `Mock LFM2 response for: ${request.prompt.substring(0, 50)}...`;
        return {
            content: mockContent,
            tokens: Math.ceil(mockContent.length / 4),
            executionTime: 50 + Math.random() * 100,
            model: 'LFM2-1.2B',
            confidence: 0.8,
        };
    }
    generateRequestId() {
        return `lfm2_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    updateMetrics(executionTime, responseLength) {
        this.metrics.totalRequests++;
        const alpha = 0.1;
        this.metrics.avgResponseTime =
            alpha * executionTime + (1 - alpha) * this.metrics.avgResponseTime;
        const tokens = Math.ceil(responseLength / 4);
        const throughput = tokens / (executionTime / 1000);
        this.metrics.tokenThroughput = alpha * throughput + (1 - alpha) * this.metrics.tokenThroughput;
    }
    async restartProcess() {
        log.info('🔄 Restarting LFM2 bridge service', LogContext.AI);
        if (this.pythonProcess) {
            this.pythonProcess.kill();
            this.pythonProcess = null;
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
        this.initializeLFM2();
    }
    getMetrics() {
        return {
            ...this.metrics,
            isInitialized: this.isInitialized,
        };
    }
    isAvailable() {
        return this.isInitialized && this.pythonProcess !== null;
    }
    async shutdown() {
        log.info('🛑 Shutting down LFM2 bridge service', LogContext.AI);
        if (this.pythonProcess) {
            this.pythonProcess.kill();
            this.pythonProcess = null;
        }
        this.isInitialized = false;
    }
    updateLimits(options) {
        if (typeof options.maxPending === 'number' && options.maxPending > 0) {
            this.MAX_PENDING = options.maxPending;
        }
        if (typeof options.timeoutMs === 'number' && options.timeoutMs >= 1000) {
            this.REQUEST_TIMEOUT_MS = options.timeoutMs;
        }
        if (typeof options.maxConcurrency === 'number' && options.maxConcurrency >= 1) {
            this.MAX_CONCURRENCY = options.maxConcurrency;
        }
        if (typeof options.maxTokens === 'number' && options.maxTokens >= 1) {
            this.MAX_TOKENS = options.maxTokens;
        }
        if (typeof options.maxPromptChars === 'number' && options.maxPromptChars >= 500) {
            this.MAX_PROMPT_CHARS = options.maxPromptChars;
        }
    }
}
class SafeLFM2Bridge {
    instance = null;
    initAttempted = false;
    circuitBreaker;
    constructor() {
        this.circuitBreaker = new CircuitBreaker('lfm2-bridge', {
            failureThreshold: 3,
            successThreshold: 2,
            timeout: 30000,
            errorThresholdPercentage: 60,
            volumeThreshold: 5,
        });
        CircuitBreakerRegistry.register('lfm2-bridge', this.circuitBreaker);
    }
    async quickResponse(userRequest, taskType = 'simple_qa') {
        return this.circuitBreaker.execute(async () => {
            if (!this.initAttempted && !this.instance) {
                this.initAttempted = true;
                try {
                    this.instance = new LFM2BridgeService();
                    log.info('✅ LFM2 bridge initialized successfully', LogContext.AI);
                }
                catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    log.warn('⚠️ LFM2 bridge initialization failed, using fallback', LogContext.AI, {
                        error: errorMessage,
                        details: error instanceof Error ? error.stack : undefined
                    });
                    return this.createFallbackResponse(userRequest);
                }
            }
            if (this.instance) {
                return this.instance.quickResponse(userRequest, taskType);
            }
            else {
                return this.createFallbackResponse(userRequest);
            }
        });
    }
    async execute(request) {
        return this.circuitBreaker.execute(async () => {
            if (!this.initAttempted && !this.instance) {
                this.initAttempted = true;
                try {
                    this.instance = new LFM2BridgeService();
                    log.info('✅ LFM2 bridge initialized successfully', LogContext.AI);
                }
                catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    log.warn('⚠️ LFM2 bridge initialization failed, using fallback', LogContext.AI, {
                        error: errorMessage,
                        stack: error instanceof Error ? error.stack : undefined
                    });
                }
            }
            if (this.instance && this.instance.isAvailable()) {
                return this.instance.generate(request);
            }
            const messages = [
                ...(request.systemPrompt
                    ? [{ role: 'system', content: request.systemPrompt }]
                    : []),
                { role: 'user', content: request.prompt },
            ];
            const response = await ollamaService.generateResponse([{ role: 'user', content: request.prompt }], 'llama3.2:3b', {
                temperature: request.temperature || 0.1,
                max_tokens: request.maxTokens || 100,
            });
            return {
                content: response.message.content,
                tokens: response.eval_count || 50,
                executionTime: (response.total_duration || 100000000) / 1000000,
                model: 'llama3.2:3b (LFM2 fallback)',
                confidence: 0.85,
            };
        }, async () => {
            log.warn('⚡ Circuit breaker active, using emergency fallback', LogContext.AI);
            return {
                content: "I'm currently experiencing high load. Please try again in a moment.",
                tokens: 10,
                executionTime: 1,
                model: 'circuit-breaker-fallback',
                confidence: 0.3,
            };
        });
    }
    createFallbackResponse(userRequest) {
        return {
            content: `I understand you're asking about: ${userRequest.substring(0, 50)}... I'm currently experiencing connectivity issues but will help as soon as possible.`,
            tokens: 25,
            executionTime: 1,
            model: 'fallback-response',
            confidence: 0.4,
        };
    }
    isAvailable() {
        return this.instance?.isAvailable() || true;
    }
    getMetrics() {
        if (this.instance) {
            return this.instance.getMetrics();
        }
        return {
            avgResponseTime: 100,
            totalRequests: 0,
            successRate: 1.0,
            tokenThroughput: 500,
        };
    }
    async routingDecision(userRequest, context) {
        try {
            if (this.instance && this.instance.isAvailable()) {
                return this.instance.routingDecision(userRequest, context);
            }
            return {
                targetService: 'ollama',
                confidence: 0.5,
                reasoning: 'LFM2 unavailable, falling back to Ollama',
                estimatedTokens: userRequest.length / 4,
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            log.error('❌ LFM2 routing decision failed', LogContext.AI, {
                error: errorMessage,
                stack: error instanceof Error ? error.stack : undefined
            });
            return {
                targetService: 'ollama',
                confidence: 0.3,
                reasoning: 'Error in routing, defaulting to Ollama',
                estimatedTokens: userRequest.length / 4,
            };
        }
    }
    shutdown() {
        if (this.instance) {
            this.instance.shutdown();
        }
    }
    async restart() {
        if (this.instance) {
            await this.instance.shutdown();
            await new Promise((r) => setTimeout(r, 500));
            await this.instance.initializeLFM2?.();
        }
    }
    setLimits(options) {
        if (this.instance && this.instance.updateLimits) {
            this.instance.updateLimits(options);
        }
    }
    getCircuitBreakerMetrics() {
        return this.circuitBreaker.getMetrics();
    }
}
export const lfm2Bridge = new SafeLFM2Bridge();
export default lfm2Bridge;
//# sourceMappingURL=lfm2-bridge.js.map