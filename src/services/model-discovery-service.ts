/**
 * Model Discovery Service
 * Dynamically discovers and classifies models from all providers
 * No hardcoding - automatically adapts to available models
 */

import { log, LogContext } from '@/utils/logger';

export interface DiscoveredModel {
  id: string;
  name: string;
  provider: 'ollama' | 'lmstudio' | 'mlx' | 'local';
  size?: number; // Size in bytes
  sizeGB?: number; // Size in GB for display
  tier: 1 | 2 | 3 | 4; // Auto-classified tier
  capabilities: string[];
  estimatedSpeed: 'instant' | 'fast' | 'moderate' | 'slow';
  metadata: {
    quantization?: string;
    family?: string;
    modified?: string;
    digest?: string;
  };
}

export interface TaskRequirements {
  type: string;
  needs: string[]; // Required capabilities
  priority: 'speed' | 'quality' | 'balanced';
  complexity: number; // 0-1 scale
  maxLatencyMs?: number;
  minQuality?: number; // 0-1 scale
}

export class ModelDiscoveryService {
  private discoveredModels: Map<string, DiscoveredModel> = new Map();
  private lastDiscovery: number = 0;
  private discoveryInterval = 60000; // Refresh every minute
  private providerStatus: Map<string, boolean> = new Map();

  constructor() {
    this.startAutoDiscovery();
  }

  /**
   * Start automatic model discovery
   */
  private async startAutoDiscovery() {
    await this.discoverAllModels();
    
    // Periodic refresh
    setInterval(async () => {
      await this.discoverAllModels();
    }, this.discoveryInterval);
  }

  /**
   * Discover models from all available providers
   */
  public async discoverAllModels(): Promise<DiscoveredModel[]> {
    log.info('🔍 Starting model discovery', LogContext.AI);
    
    const models: DiscoveredModel[] = [];
    
    // Discover from each provider in parallel
    const [ollamaModels, lmStudioModels, mlxModels] = await Promise.all([
      this.discoverOllamaModels(),
      this.discoverLMStudioModels(),
      this.discoverMLXModels(),
    ]);
    
    models.push(...ollamaModels, ...lmStudioModels, ...mlxModels);
    
    // Clear and rebuild the map
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

  /**
   * Discover Ollama models
   */
  private async discoverOllamaModels(): Promise<DiscoveredModel[]> {
    try {
      const response = await fetch('http://localhost:11434/api/tags');
      if (!response.ok) {
        this.providerStatus.set('ollama', false);
        return [];
      }
      
      const data = await response.json();
      this.providerStatus.set('ollama', true);
      
      return (data.models || []).map((model: any) => this.classifyModel({
        id: model.name,
        name: model.name,
        provider: 'ollama' as const,
        size: model.size,
        metadata: {
          family: model.details?.family,
          quantization: model.details?.quantization_level,
          modified: model.modified_at,
          digest: model.digest,
        },
      }));
    } catch (error) {
      log.warn('Failed to discover Ollama models', LogContext.AI, { error });
      this.providerStatus.set('ollama', false);
      return [];
    }
  }

  /**
   * Discover LM Studio models
   */
  private async discoverLMStudioModels(): Promise<DiscoveredModel[]> {
    try {
      // Try multiple possible LM Studio ports
      const ports = [5901, 1234, 8080];
      
      for (const port of ports) {
        try {
          const response = await fetch(`http://localhost:${port}/v1/models`);
          if (response.ok) {
            const data = await response.json();
            this.providerStatus.set('lmstudio', true);
            
            return (data.data || []).map((model: any) => this.classifyModel({
              id: model.id,
              name: model.id,
              provider: 'lmstudio' as const,
              metadata: {
                family: this.extractModelFamily(model.id),
              },
            }));
          }
        } catch {
          // Try next port
        }
      }
      
      this.providerStatus.set('lmstudio', false);
      return [];
    } catch (error) {
      log.warn('Failed to discover LM Studio models', LogContext.AI, { error });
      this.providerStatus.set('lmstudio', false);
      return [];
    }
  }

  /**
   * Discover MLX models (fine-tuned models)
   */
  private async discoverMLXModels(): Promise<DiscoveredModel[]> {
    try {
      // Import MLX provider service
      const { mlxProviderService } = await import('./mlx-provider-service.js');
      
      // Initialize if not already done
      await mlxProviderService.initialize().catch(() => {
        // If initialization fails, MLX is not available
        this.providerStatus.set('mlx', false);
        return [];
      });
      
      // Get fine-tuned models from MLX provider
      const mlxModels = mlxProviderService.getModelsForDiscovery();
      this.providerStatus.set('mlx', mlxModels.length > 0);
      
      return mlxModels.map((model: any) => this.classifyModel({
        id: model.id,
        name: model.name,
        provider: 'mlx' as const,
        size: model.size,
        metadata: {
          ...model.metadata,
          fineTuned: true,
        },
      }));
    } catch (error) {
      log.warn('Failed to discover MLX models', LogContext.AI, { error });
      this.providerStatus.set('mlx', false);
      return [];
    }
  }

  /**
   * Classify a model based on its properties
   */
  private classifyModel(model: Partial<DiscoveredModel>): DiscoveredModel {
    const name = model.name || model.id || '';
    const size = model.size || this.estimateSize(name);
    const sizeGB = size ? size / (1024 * 1024 * 1024) : this.estimateSizeFromName(name);
    
    // Detect tier based on size
    const tier = this.detectTier(sizeGB, name);
    
    // Detect capabilities from name
    const capabilities = this.detectCapabilities(name);
    
    // Estimate speed based on tier
    const estimatedSpeed = this.estimateSpeed(tier, sizeGB);
    
    return {
      ...model,
      id: model.id!,
      name: model.name!,
      provider: model.provider!,
      size,
      sizeGB,
      tier,
      capabilities,
      estimatedSpeed,
      metadata: model.metadata || {},
    } as DiscoveredModel;
  }

  /**
   * Detect tier based on model size and name
   */
  private detectTier(sizeGB: number, name: string): 1 | 2 | 3 | 4 {
    // Check for explicit tier hints in name
    if (name.match(/draft|tiny|small|0\.[5-9]b/i)) return 1;
    if (name.match(/mini|1b|2b|3b/i)) return 2;
    if (name.match(/medium|7b|8b|13b|14b/i)) return 3;
    if (name.match(/large|20b|24b|30b|70b/i)) return 4;
    
    // Fallback to size-based classification
    if (sizeGB < 1) return 1;
    if (sizeGB < 5) return 2;
    if (sizeGB < 15) return 3;
    return 4;
  }

  /**
   * Detect capabilities from model name
   */
  private detectCapabilities(name: string): string[] {
    const capabilities: string[] = ['general']; // All models can do general tasks
    
    // Coding capabilities
    if (name.match(/code|coder|starcoder|codellama|devstral/i)) {
      capabilities.push('code_generation', 'code_review', 'debugging');
    }
    
    // Embedding capabilities
    if (name.match(/embed|embedding|e5|bge/i)) {
      capabilities.push('embedding', 'similarity');
    }
    
    // Vision capabilities
    if (name.match(/vision|llava|clip|multimodal/i)) {
      capabilities.push('vision', 'multimodal', 'image_analysis');
    }
    
    // Reasoning capabilities
    if (name.match(/reason|r1|deepseek.*r|thinking/i)) {
      capabilities.push('reasoning', 'analysis', 'problem_solving');
    }
    
    // Instruction following
    if (name.match(/instruct|chat|rlhf|assistant/i)) {
      capabilities.push('conversation', 'instruction_following');
    }
    
    // Math capabilities
    if (name.match(/math|mathstral|wizard.*math/i)) {
      capabilities.push('mathematics', 'calculation');
    }
    
    // Creative capabilities
    if (name.match(/dolphin|mixtral|creative|uncensored/i)) {
      capabilities.push('creative_writing', 'brainstorming');
    }
    
    // Fast drafting
    if (name.match(/draft|quick|fast|tiny/i)) {
      capabilities.push('drafting', 'quick_response');
    }
    
    return [...new Set(capabilities)]; // Remove duplicates
  }

  /**
   * Estimate speed based on tier and size
   */
  private estimateSpeed(tier: number, sizeGB: number): 'instant' | 'fast' | 'moderate' | 'slow' {
    if (tier === 1 || sizeGB < 1) return 'instant';
    if (tier === 2 || sizeGB < 5) return 'fast';
    if (tier === 3 || sizeGB < 15) return 'moderate';
    return 'slow';
  }

  /**
   * Estimate size from model name when size is not provided
   */
  private estimateSizeFromName(name: string): number {
    const match = name.match(/(\d+(?:\.\d+)?)[bB]/);
    if (match && match[1]) {
      const size = parseFloat(match[1]);
      return size; // Already in GB for billion parameter models
    }
    
    // Default estimates based on common patterns
    if (name.match(/tiny|small|mini/i)) return 0.5;
    if (name.match(/medium/i)) return 7;
    if (name.match(/large|xl/i)) return 20;
    
    return 3; // Default to small-medium
  }

  /**
   * Estimate size in bytes (rough approximation)
   */
  private estimateSize(name: string): number {
    const gb = this.estimateSizeFromName(name);
    return gb * 1024 * 1024 * 1024;
  }

  /**
   * Extract model family from name
   */
  private extractModelFamily(name: string): string {
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

  /**
   * Group models by tier for reporting
   */
  private groupByTier(models: DiscoveredModel[]): Record<string, number> {
    return models.reduce((acc, model) => {
      const key = `tier${model.tier}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  /**
   * Get all discovered models
   */
  public getModels(): DiscoveredModel[] {
    return Array.from(this.discoveredModels.values());
  }

  /**
   * Get models by provider
   */
  public getModelsByProvider(provider: string): DiscoveredModel[] {
    return this.getModels().filter(m => m.provider === provider);
  }

  /**
   * Get models by tier
   */
  public getModelsByTier(tier: number): DiscoveredModel[] {
    return this.getModels().filter(m => m.tier === tier);
  }

  /**
   * Get models with specific capability
   */
  public getModelsWithCapability(capability: string): DiscoveredModel[] {
    return this.getModels().filter(m => m.capabilities.includes(capability));
  }

  /**
   * Find best model for task requirements
   */
  public findBestModel(requirements: TaskRequirements): DiscoveredModel | null {
    const models = this.getModels();
    
    // Filter models that have all required capabilities
    const capable = models.filter(model => 
      requirements.needs.every(need => model.capabilities.includes(need))
    );
    
    if (capable.length === 0) {
      // Fallback to any general model
      return models.find(m => m.capabilities.includes('general')) || null;
    }
    
    // Score and sort models
    const scored = capable.map(model => ({
      model,
      score: this.scoreModel(model, requirements),
    }));
    
    scored.sort((a, b) => b.score - a.score);
    
    return scored[0]?.model || null;
  }

  /**
   * Score a model for given requirements
   */
  private scoreModel(model: DiscoveredModel, requirements: TaskRequirements): number {
    let score = 0;
    
    // Capability match (highest weight)
    const capabilityMatch = requirements.needs.filter(need => 
      model.capabilities.includes(need)
    ).length / requirements.needs.length;
    score += capabilityMatch * 50;
    
    // Speed vs Quality tradeoff
    if (requirements.priority === 'speed') {
      // Prefer lower tiers for speed
      score += (5 - model.tier) * 20;
      if (model.estimatedSpeed === 'instant') score += 30;
      if (model.estimatedSpeed === 'fast') score += 20;
    } else if (requirements.priority === 'quality') {
      // Prefer higher tiers for quality
      score += model.tier * 20;
      if (model.tier === 4) score += 30;
      if (model.tier === 3) score += 20;
    } else {
      // Balanced - prefer tier 2-3
      if (model.tier === 2 || model.tier === 3) score += 30;
    }
    
    // Complexity matching
    if (requirements.complexity > 0.7 && model.tier >= 3) {
      score += 20;
    } else if (requirements.complexity < 0.3 && model.tier <= 2) {
      score += 20;
    }
    
    // Provider preference (LM Studio often has better performance)
    if (model.provider === 'lmstudio') score += 5;
    
    // Penalize slow models if latency requirement exists
    if (requirements.maxLatencyMs) {
      if (model.estimatedSpeed === 'slow' && requirements.maxLatencyMs < 2000) {
        score -= 30;
      }
    }
    
    return score;
  }

  /**
   * Get provider status
   */
  public getProviderStatus(): Map<string, boolean> {
    return new Map(this.providerStatus);
  }

  /**
   * Check if we have models for a specific capability
   */
  public hasCapability(capability: string): boolean {
    return this.getModels().some(m => m.capabilities.includes(capability));
  }
}

// Singleton instance
export const modelDiscoveryService = new ModelDiscoveryService();