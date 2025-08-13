import { log, LogContext } from '@/utils/logger';
export class ModelDiscoveryService {
    discoveredModels = new Map();
    lastDiscovery = 0;
    discoveryInterval = 60000;
    providerStatus = new Map();
    constructor() {
        this.startAutoDiscovery();
    }
    async startAutoDiscovery() {
        await this.discoverAllModels();
        setInterval(async () => {
            await this.discoverAllModels();
        }, this.discoveryInterval);
    }
    async discoverAllModels() {
        log.info('🔍 Starting model discovery', LogContext.AI);
        const models = [];
        const [ollamaModels, lmStudioModels, mlxModels] = await Promise.all([
            this.discoverOllamaModels(),
            this.discoverLMStudioModels(),
            this.discoverMLXModels(),
        ]);
        models.push(...ollamaModels, ...lmStudioModels, ...mlxModels);
        this.discoveredModels.clear();
        models.forEach(model => {
            const key = `${model.provider}:${model.id}`;
            this.discoveredModels.set(key, model);
        });
        this.lastDiscovery = Date.now();
        log.info('✅ Model discovery complete', LogContext.AI, {
            total: models.length,
            byProvider: {
                ollama: ollamaModels.length,
                lmstudio: lmStudioModels.length,
                mlx: mlxModels.length,
            },
            byTier: this.groupByTier(models),
        });
        return models;
    }
    async discoverOllamaModels() {
        try {
            const response = await fetch('http://localhost:11434/api/tags');
            if (!response.ok) {
                this.providerStatus.set('ollama', false);
                return [];
            }
            const data = await response.json();
            this.providerStatus.set('ollama', true);
            return (data.models || []).map((model) => this.classifyModel({
                id: model.name,
                name: model.name,
                provider: 'ollama',
                size: model.size,
                metadata: {
                    family: model.details?.family,
                    quantization: model.details?.quantization_level,
                    modified: model.modified_at,
                    digest: model.digest,
                },
            }));
        }
        catch (error) {
            log.warn('Failed to discover Ollama models', LogContext.AI, { error });
            this.providerStatus.set('ollama', false);
            return [];
        }
    }
    async discoverLMStudioModels() {
        try {
            const ports = [5901, 1234, 8080];
            for (const port of ports) {
                try {
                    const response = await fetch(`http://localhost:${port}/v1/models`);
                    if (response.ok) {
                        const data = await response.json();
                        this.providerStatus.set('lmstudio', true);
                        return (data.data || []).map((model) => this.classifyModel({
                            id: model.id,
                            name: model.id,
                            provider: 'lmstudio',
                            metadata: {
                                family: this.extractModelFamily(model.id),
                            },
                        }));
                    }
                }
                catch {
                }
            }
            this.providerStatus.set('lmstudio', false);
            return [];
        }
        catch (error) {
            log.warn('Failed to discover LM Studio models', LogContext.AI, { error });
            this.providerStatus.set('lmstudio', false);
            return [];
        }
    }
    async discoverMLXModels() {
        try {
            const { mlxProviderService } = await import('./mlx-provider-service.js');
            await mlxProviderService.initialize().catch(() => {
                this.providerStatus.set('mlx', false);
                return [];
            });
            const mlxModels = mlxProviderService.getModelsForDiscovery();
            this.providerStatus.set('mlx', mlxModels.length > 0);
            return mlxModels.map((model) => this.classifyModel({
                id: model.id,
                name: model.name,
                provider: 'mlx',
                size: model.size,
                metadata: {
                    ...model.metadata,
                    fineTuned: true,
                },
            }));
        }
        catch (error) {
            log.warn('Failed to discover MLX models', LogContext.AI, { error });
            this.providerStatus.set('mlx', false);
            return [];
        }
    }
    classifyModel(model) {
        const name = model.name || model.id || '';
        const size = model.size || this.estimateSize(name);
        const sizeGB = size ? size / (1024 * 1024 * 1024) : this.estimateSizeFromName(name);
        const tier = this.detectTier(sizeGB, name);
        const capabilities = this.detectCapabilities(name);
        const estimatedSpeed = this.estimateSpeed(tier, sizeGB);
        return {
            ...model,
            id: model.id,
            name: model.name,
            provider: model.provider,
            size,
            sizeGB,
            tier,
            capabilities,
            estimatedSpeed,
            metadata: model.metadata || {},
        };
    }
    detectTier(sizeGB, name) {
        if (name.match(/draft|tiny|small|0\.[5-9]b/i))
            return 1;
        if (name.match(/mini|1b|2b|3b/i))
            return 2;
        if (name.match(/medium|7b|8b|13b|14b/i))
            return 3;
        if (name.match(/large|20b|24b|30b|70b/i))
            return 4;
        if (sizeGB < 1)
            return 1;
        if (sizeGB < 5)
            return 2;
        if (sizeGB < 15)
            return 3;
        return 4;
    }
    detectCapabilities(name) {
        const capabilities = ['general'];
        if (name.match(/code|coder|starcoder|codellama|devstral/i)) {
            capabilities.push('code_generation', 'code_review', 'debugging');
        }
        if (name.match(/embed|embedding|e5|bge/i)) {
            capabilities.push('embedding', 'similarity');
        }
        if (name.match(/vision|llava|clip|multimodal/i)) {
            capabilities.push('vision', 'multimodal', 'image_analysis');
        }
        if (name.match(/reason|r1|deepseek.*r|thinking/i)) {
            capabilities.push('reasoning', 'analysis', 'problem_solving');
        }
        if (name.match(/instruct|chat|rlhf|assistant/i)) {
            capabilities.push('conversation', 'instruction_following');
        }
        if (name.match(/math|mathstral|wizard.*math/i)) {
            capabilities.push('mathematics', 'calculation');
        }
        if (name.match(/dolphin|mixtral|creative|uncensored/i)) {
            capabilities.push('creative_writing', 'brainstorming');
        }
        if (name.match(/draft|quick|fast|tiny/i)) {
            capabilities.push('drafting', 'quick_response');
        }
        return [...new Set(capabilities)];
    }
    estimateSpeed(tier, sizeGB) {
        if (tier === 1 || sizeGB < 1)
            return 'instant';
        if (tier === 2 || sizeGB < 5)
            return 'fast';
        if (tier === 3 || sizeGB < 15)
            return 'moderate';
        return 'slow';
    }
    estimateSizeFromName(name) {
        const match = name.match(/(\d+(?:\.\d+)?)[bB]/);
        if (match && match[1]) {
            const size = parseFloat(match[1]);
            return size;
        }
        if (name.match(/tiny|small|mini/i))
            return 0.5;
        if (name.match(/medium/i))
            return 7;
        if (name.match(/large|xl/i))
            return 20;
        return 3;
    }
    estimateSize(name) {
        const gb = this.estimateSizeFromName(name);
        return gb * 1024 * 1024 * 1024;
    }
    extractModelFamily(name) {
        const families = [
            'llama', 'mistral', 'qwen', 'gemma', 'phi', 'deepseek',
            'dolphin', 'starcoder', 'codellama', 'wizard', 'vicuna',
            'alpaca', 'gpt', 'claude', 'palm', 'falcon'
        ];
        for (const family of families) {
            if (name.toLowerCase().includes(family)) {
                return family;
            }
        }
        return 'unknown';
    }
    groupByTier(models) {
        return models.reduce((acc, model) => {
            const key = `tier${model.tier}`;
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {});
    }
    getModels() {
        return Array.from(this.discoveredModels.values());
    }
    getModelsByProvider(provider) {
        return this.getModels().filter(m => m.provider === provider);
    }
    getModelsByTier(tier) {
        return this.getModels().filter(m => m.tier === tier);
    }
    getModelsWithCapability(capability) {
        return this.getModels().filter(m => m.capabilities.includes(capability));
    }
    findBestModel(requirements) {
        const models = this.getModels();
        const capable = models.filter(model => requirements.needs.every(need => model.capabilities.includes(need)));
        if (capable.length === 0) {
            return models.find(m => m.capabilities.includes('general')) || null;
        }
        const scored = capable.map(model => ({
            model,
            score: this.scoreModel(model, requirements),
        }));
        scored.sort((a, b) => b.score - a.score);
        return scored[0]?.model || null;
    }
    scoreModel(model, requirements) {
        let score = 0;
        const capabilityMatch = requirements.needs.filter(need => model.capabilities.includes(need)).length / requirements.needs.length;
        score += capabilityMatch * 50;
        if (requirements.priority === 'speed') {
            score += (5 - model.tier) * 20;
            if (model.estimatedSpeed === 'instant')
                score += 30;
            if (model.estimatedSpeed === 'fast')
                score += 20;
        }
        else if (requirements.priority === 'quality') {
            score += model.tier * 20;
            if (model.tier === 4)
                score += 30;
            if (model.tier === 3)
                score += 20;
        }
        else {
            if (model.tier === 2 || model.tier === 3)
                score += 30;
        }
        if (requirements.complexity > 0.7 && model.tier >= 3) {
            score += 20;
        }
        else if (requirements.complexity < 0.3 && model.tier <= 2) {
            score += 20;
        }
        if (model.provider === 'lmstudio')
            score += 5;
        if (requirements.maxLatencyMs) {
            if (model.estimatedSpeed === 'slow' && requirements.maxLatencyMs < 2000) {
                score -= 30;
            }
        }
        return score;
    }
    getProviderStatus() {
        return new Map(this.providerStatus);
    }
    hasCapability(capability) {
        return this.getModels().some(m => m.capabilities.includes(capability));
    }
}
export const modelDiscoveryService = new ModelDiscoveryService();
//# sourceMappingURL=model-discovery-service.js.map