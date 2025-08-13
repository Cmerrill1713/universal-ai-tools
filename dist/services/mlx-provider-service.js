import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';
import { log, LogContext } from '@/utils/logger';
import { getPorts } from '@/config/ports';
export class MLXProviderService extends EventEmitter {
    models = new Map();
    activeProcesses = new Map();
    modelsDirectory;
    isInitialized = false;
    mlxServerPort = 8004;
    validatePort(port) {
        const validPort = Math.floor(port);
        if (validPort < 1024 || validPort > 65535) {
            throw new Error('Invalid port number');
        }
        return validPort;
    }
    mlxServerProcess = null;
    constructor() {
        super();
        this.modelsDirectory = process.env.MLX_MODELS_DIR ||
            path.join(process.env.HOME || '/Users/christianmerrill', 'models', 'mlx-fine-tuned');
    }
    async initialize() {
        if (this.isInitialized)
            return;
        try {
            const ports = await getPorts();
            this.mlxServerPort = ports.mlxProvider;
            log.info('🍎 Initializing MLX Provider Service', LogContext.AI, {
                port: this.mlxServerPort,
                modelsDirectory: this.modelsDirectory,
            });
            await fs.mkdir(this.modelsDirectory, { recursive: true });
            await this.startMLXServer();
            await this.scanForModels();
            this.isInitialized = true;
            log.info('✅ MLX Provider initialized', LogContext.AI, {
                modelsDirectory: this.modelsDirectory,
                modelsFound: this.models.size,
                serverPort: this.mlxServerPort,
            });
        }
        catch (error) {
            log.error('❌ Failed to initialize MLX provider', LogContext.AI, { error });
            this.isInitialized = false;
        }
    }
    async startMLXServer() {
        try {
            const response = await fetch(`http://localhost:${this.mlxServerPort}/health`, {
                signal: AbortSignal.timeout(3000)
            });
            if (response.ok) {
                log.info('✅ MLX server already running', LogContext.AI, {
                    port: this.mlxServerPort
                });
                return;
            }
        }
        catch (error) {
            log.info('🔄 MLX server not running, starting it...', LogContext.AI, {
                port: this.mlxServerPort,
                error: error instanceof Error ? error.message : String(error),
            });
        }
        return new Promise((resolve, reject) => {
            const safePort = this.validatePort(this.mlxServerPort);
            const serverScript = `
import mlx_lm
from flask import Flask, request, jsonify
import json
import os
import sys

app = Flask(__name__)
loaded_models = {}

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "healthy", "models": list(loaded_models.keys())})

@app.route('/load', methods=['POST'])
def load_model():
    data = request.json
    model_path = data['model_path']
    adapter_path = data.get('adapter_path')
    
    # Validate paths to prevent path traversal
    if not os.path.abspath(model_path).startswith(os.path.abspath('.')):
        return jsonify({"success": False, "error": "Invalid model path"}), 400
    
    try:
        if adapter_path:
            if not os.path.abspath(adapter_path).startswith(os.path.abspath('.')):
                return jsonify({"success": False, "error": "Invalid adapter path"}), 400
            model, tokenizer = mlx_lm.load(model_path, adapter_path=adapter_path)
        else:
            model, tokenizer = mlx_lm.load(model_path)
        
        model_id = data['model_id']
        loaded_models[model_id] = {'model': model, 'tokenizer': tokenizer}
        return jsonify({"success": True, "model_id": model_id})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/generate', methods=['POST'])
def generate():
    data = request.json
    model_id = data['model_id']
    prompt = data['prompt']
    
    if model_id not in loaded_models:
        return jsonify({"error": "Model not loaded"}), 404
    
    # Validate prompt length to prevent abuse
    if len(prompt) > 10000:
        return jsonify({"error": "Prompt too long"}), 400
    
    model_data = loaded_models[model_id]
    
    try:
        # Generate response with limits
        response = mlx_lm.generate(
            model_data['model'],
            model_data['tokenizer'],
            prompt=prompt,
            max_tokens=min(data.get('max_tokens', 100), 1000),
            temperature=max(0.0, min(2.0, data.get('temperature', 0.7))),
            top_p=max(0.0, min(1.0, data.get('top_p', 0.9))),
        )
        
        return jsonify({"response": response})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/unload', methods=['POST'])
def unload_model():
    data = request.json
    model_id = data['model_id']
    
    if model_id in loaded_models:
        del loaded_models[model_id]
        return jsonify({"success": True})
    return jsonify({"success": False, "error": "Model not found"}), 404

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=${safePort}, debug=False)
`;
            const scriptPath = path.join(this.modelsDirectory, 'mlx_server.py');
            fs.writeFile(scriptPath, serverScript)
                .then(() => {
                this.mlxServerProcess = spawn('python3', [scriptPath], {
                    cwd: this.modelsDirectory,
                    env: { ...process.env, PYTHONUNBUFFERED: '1' },
                });
                this.mlxServerProcess.stdout.on('data', (data) => {
                    const output = data.toString();
                    if (output.includes('Running on')) {
                        log.info('✅ MLX server started', LogContext.AI);
                        resolve();
                    }
                });
                this.mlxServerProcess.stderr.on('data', (data) => {
                    const errorMessage = data.toString();
                    if (errorMessage.includes('Address already in use') || errorMessage.includes('Port') && errorMessage.includes('in use')) {
                        log.warn('❌ MLX server port conflict detected', LogContext.AI, {
                            port: this.mlxServerPort,
                            error: errorMessage.trim()
                        });
                        resolve();
                    }
                    else {
                        log.warn('⚠️ MLX server stderr', LogContext.AI, { error: errorMessage.trim() });
                    }
                });
                this.mlxServerProcess.on('error', (error) => {
                    log.error('❌ Failed to start MLX server', LogContext.AI, {
                        port: this.mlxServerPort,
                        error: error.message
                    });
                    resolve();
                });
                setTimeout(() => {
                    log.info('⏰ MLX server startup timeout - continuing without server', LogContext.AI);
                    resolve();
                }, 5000);
            })
                .catch(reject);
        });
    }
    async scanForModels() {
        try {
            const entries = await fs.readdir(this.modelsDirectory, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const modelPath = path.join(this.modelsDirectory, entry.name);
                    const configPath = path.join(modelPath, 'training_config.json');
                    try {
                        const configExists = await fs.access(configPath).then(() => true).catch(() => false);
                        if (configExists) {
                            const config = JSON.parse(await fs.readFile(configPath, 'utf-8'));
                            const model = {
                                id: `mlx:${entry.name}`,
                                name: entry.name,
                                baseModel: config.base_model || 'unknown',
                                fineTunedAt: new Date(config.trained_at || Date.now()),
                                method: config.method || 'lora',
                                adapterPath: config.adapter_path,
                                modelPath,
                                config: {
                                    task: config.task,
                                    dataset: config.dataset,
                                    epochs: config.epochs,
                                    performance: config.performance,
                                },
                                size: await this.getDirectorySize(modelPath),
                                status: 'ready',
                            };
                            this.models.set(model.id, model);
                            log.info('Found fine-tuned model', LogContext.AI, {
                                id: model.id,
                                baseModel: model.baseModel,
                                method: model.method,
                            });
                        }
                    }
                    catch (error) {
                        log.warn(`Failed to load model ${entry.name}`, LogContext.AI, { error });
                    }
                }
            }
        }
        catch (error) {
            log.error('Failed to scan for models', LogContext.AI, { error });
        }
    }
    async registerFineTunedModel(modelId, baseModel, method, modelPath, adapterPath, config) {
        const model = {
            id: `mlx:${modelId}`,
            name: modelId,
            baseModel,
            fineTunedAt: new Date(),
            method,
            adapterPath,
            modelPath,
            config: config || {},
            size: await this.getDirectorySize(modelPath),
            status: 'ready',
        };
        const configPath = path.join(modelPath, 'training_config.json');
        await fs.writeFile(configPath, JSON.stringify({
            base_model: baseModel,
            method,
            adapter_path: adapterPath,
            trained_at: model.fineTunedAt.toISOString(),
            ...config,
        }, null, 2));
        this.models.set(model.id, model);
        this.emit('model-registered', model);
        log.info('✅ Fine-tuned model registered', LogContext.AI, {
            id: model.id,
            baseModel,
            method,
        });
        return model;
    }
    async loadModel(modelId) {
        const model = this.models.get(modelId);
        if (!model) {
            throw new Error(`Model ${modelId} not found`);
        }
        if (model.status === 'loading') {
            log.info('Model already loading', LogContext.AI, { modelId });
            return;
        }
        model.status = 'loading';
        try {
            const response = await fetch(`http://localhost:${this.mlxServerPort}/load`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model_id: modelId,
                    model_path: model.modelPath,
                    adapter_path: model.adapterPath,
                }),
            });
            if (!response.ok) {
                throw new Error(`Failed to load model: ${response.statusText}`);
            }
            model.status = 'ready';
            log.info('✅ Model loaded', LogContext.AI, { modelId });
        }
        catch (error) {
            model.status = 'failed';
            log.error('Failed to load model', LogContext.AI, { modelId, error });
            throw error;
        }
    }
    async generate(modelId, prompt, options) {
        const model = this.models.get(modelId);
        if (!model) {
            log.warn('Model not found, returning mock response', LogContext.AI, { modelId });
            return `[MLX Mock] ${prompt.slice(0, 100)}... (model ${modelId} not available)`;
        }
        if (model.status !== 'ready') {
            await this.loadModel(modelId);
        }
        let lastError = null;
        const maxRetries = 3;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const response = await fetch(`http://localhost:${this.mlxServerPort}/generate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model_id: modelId,
                        prompt,
                        max_tokens: options?.maxTokens || 100,
                        temperature: options?.temperature || 0.7,
                        top_p: options?.topP || 0.9,
                        top_k: options?.topK,
                        repetition_penalty: options?.repetitionPenalty,
                        seed: options?.seed,
                    }),
                    signal: AbortSignal.timeout(30000)
                });
                if (!response.ok) {
                    throw new Error(`Generation failed: ${response.statusText}`);
                }
                const data = await response.json();
                return data.response;
            }
            catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                if (attempt < maxRetries) {
                    log.warn(`Generation attempt ${attempt} failed, retrying...`, LogContext.AI, {
                        modelId,
                        error: lastError.message,
                        attemptsRemaining: maxRetries - attempt
                    });
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                }
            }
        }
        log.error('All generation attempts failed, returning mock response', LogContext.AI, {
            modelId,
            error: lastError?.message
        });
        return `[MLX Mock] ${prompt.slice(0, 100)}... (generation failed after ${maxRetries} attempts)`;
    }
    async unloadModel(modelId) {
        const model = this.models.get(modelId);
        if (!model)
            return;
        try {
            await fetch(`http://localhost:${this.mlxServerPort}/unload`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model_id: modelId }),
            });
            model.status = 'ready';
            log.info('Model unloaded', LogContext.AI, { modelId });
        }
        catch (error) {
            log.warn('Failed to unload model', LogContext.AI, { modelId, error });
        }
    }
    getModels() {
        return Array.from(this.models.values());
    }
    getModelsForDiscovery() {
        return this.getModels().map(model => ({
            id: model.id,
            name: `${model.name} (fine-tuned)`,
            provider: 'mlx',
            size: model.size,
            sizeGB: model.size / (1024 * 1024 * 1024),
            tier: this.estimateTier(model),
            capabilities: this.inferCapabilities(model),
            estimatedSpeed: this.estimateSpeed(model),
            metadata: {
                baseModel: model.baseModel,
                fineTunedAt: model.fineTunedAt.toISOString(),
                method: model.method,
                task: model.config.task,
            },
        }));
    }
    estimateTier(model) {
        const base = model.baseModel.toLowerCase();
        if (base.includes('tiny') || base.includes('small') || base.includes('1b'))
            return 1;
        if (base.includes('3b') || base.includes('7b'))
            return 2;
        if (base.includes('13b') || base.includes('14b'))
            return 3;
        if (base.includes('20b') || base.includes('30b') || base.includes('70b'))
            return 4;
        const sizeGB = model.size / (1024 * 1024 * 1024);
        if (sizeGB < 2)
            return 1;
        if (sizeGB < 8)
            return 2;
        if (sizeGB < 20)
            return 3;
        return 4;
    }
    inferCapabilities(model) {
        const capabilities = ['general', 'fine_tuned'];
        if (model.config.task) {
            const task = model.config.task.toLowerCase();
            if (task.includes('code'))
                capabilities.push('code_generation', 'debugging');
            if (task.includes('chat'))
                capabilities.push('conversation', 'instruction_following');
            if (task.includes('reason'))
                capabilities.push('reasoning', 'analysis');
            if (task.includes('creative'))
                capabilities.push('creative_writing');
            if (task.includes('math'))
                capabilities.push('mathematics');
            if (task.includes('medical'))
                capabilities.push('medical');
            if (task.includes('legal'))
                capabilities.push('legal');
            if (task.includes('finance'))
                capabilities.push('finance');
        }
        capabilities.push(`specialized_${model.name.replace(/[^a-z0-9]/gi, '_')}`);
        return capabilities;
    }
    estimateSpeed(model) {
        const sizeGB = model.size / (1024 * 1024 * 1024);
        if (model.method === 'lora' || model.method === 'qlora') {
            if (sizeGB < 1)
                return 'instant';
            if (sizeGB < 5)
                return 'fast';
            return 'moderate';
        }
        if (sizeGB < 2)
            return 'fast';
        if (sizeGB < 10)
            return 'moderate';
        return 'slow';
    }
    async getDirectorySize(dirPath) {
        let size = 0;
        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                if (entry.isDirectory()) {
                    size += await this.getDirectorySize(fullPath);
                }
                else {
                    const stats = await fs.stat(fullPath);
                    size += stats.size;
                }
            }
        }
        catch (error) {
            log.warn('Failed to calculate directory size', LogContext.AI, { dirPath, error });
        }
        return size;
    }
    async shutdown() {
        for (const modelId of this.models.keys()) {
            await this.unloadModel(modelId);
        }
        if (this.mlxServerProcess) {
            this.mlxServerProcess.kill();
            this.mlxServerProcess = null;
        }
        this.isInitialized = false;
        log.info('MLX Provider shut down', LogContext.AI);
    }
    getStatistics() {
        const loadedModels = Array.from(this.models.values()).filter(m => m.status === 'ready');
        return {
            totalModels: this.models.size,
            loadedModels: loadedModels.length,
            totalSize: Array.from(this.models.values()).reduce((sum, m) => sum + m.size, 0),
            methods: {
                lora: Array.from(this.models.values()).filter(m => m.method === 'lora').length,
                qlora: Array.from(this.models.values()).filter(m => m.method === 'qlora').length,
                full: Array.from(this.models.values()).filter(m => m.method === 'full').length,
            },
            serverStatus: this.mlxServerProcess ? 'running' : 'stopped',
            serverPort: this.mlxServerPort,
        };
    }
}
export const mlxProviderService = new MLXProviderService();
//# sourceMappingURL=mlx-provider-service.js.map