/**
 * Model Configuration
 * Centralizes all model references to allow easy switching
 */

import { getServiceUrls, ports } from './ports';

// Get service URLs with proper ports
const serviceUrls = getServiceUrls(ports);

export const ModelConfig = {
  // Vision models
  vision: {
    multimodal: process.env.VISION_MULTIMODAL_MODEL || 'llava:13b',
    analysis: process.env.VISION_ANALYSIS_MODEL || 'llama3.2-vision:latest',
    embedding: process.env.VISION_EMBEDDING_MODEL || 'nomic-embed-vision:latest',
  },

  // Text generation models
  text: {
    // LFM2 as default for ultra-fast routing and simple tasks
    routing: process.env.ROUTING_MODEL || 'lfm2:1.2b',
    small: process.env.TEXT_SMALL_MODEL || 'lfm2:1.2b',
    medium: process.env.TEXT_MEDIUM_MODEL || 'llama3.2:8b',
    large: process.env.TEXT_LARGE_MODEL || 'llama3.2:70b',
    code: process.env.CODE_MODEL || 'qwen2.5-coder:7b',
    reasoning: process.env.REASONING_MODEL || 'deepseek-r1:8b',
  },

  // Embedding models
  embedding: {
    text: process.env.TEXT_EMBEDDING_MODEL || 'nomic-embed-text:latest',
    vision: process.env.VISION_EMBEDDING_MODEL || 'nomic-embed-vision:latest',
  },

  // Image generation models
  imageGeneration: {
    sdxl:
      process.env.SDXL_MODEL_PATH ||
      '/Users/christianmerrill/Downloads/stable-diffusion-xl-base-1.0-Q4_1.gguf',
    sdxlRefiner:
      process.env.SDXL_REFINER_PATH ||
      '/Users/christianmerrill/Downloads/stable-diffusion-xl-refiner-1.0-Q4_1.gguf',
    flux: process.env.FLUX_MODEL || 'flux-schnell',
  },

  // Specialized models
  specialized: {
    math: process.env.MATH_MODEL || 'mathstral:7b',
    medical: process.env.MEDICAL_MODEL || 'meditron:7b',
    finance: process.env.FINANCE_MODEL || 'nous-hermes:13b',
  },

  // LM Studio configuration (replaces HuggingFace)
  lmStudio: {
    enabled: process.env.ENABLE_LM_STUDIO !== 'false',
    url: process.env.LM_STUDIO_URL || serviceUrls.lmStudio,
    // Models available in LM Studio for HuggingFace-like tasks
    models: {
      textGeneration: process.env.LM_STUDIO_TEXT_MODEL || 'meta-llama-3-8b-instruct',
      embedding: process.env.LM_STUDIO_EMBEDDING_MODEL || 'nomic-embed-text-v1',
      summarization: process.env.LM_STUDIO_SUMMARY_MODEL || 'mistral-7b-instruct',
      sentiment: process.env.LM_STUDIO_SENTIMENT_MODEL || 'phi-2',
    },
  },

  // Model routing preferences
  routing: {
    preferLocal: process.env.PREFER_LOCAL_MODELS === 'true',
    fallbackEnabled: process.env.MODEL_FALLBACK_ENABLED !== 'false',
    maxRetries: parseInt(process.env.MODEL_MAX_RETRIES || '3', 10),
    // LFM2 server endpoint
    lfm2Endpoint: process.env.LFM2_SERVER_URL || serviceUrls.lfm2Server,
  },

  // LFM2 specific configuration
  lfm2: {
    enabled: process.env.ENABLE_LFM2 !== 'false',
    serverUrl: process.env.LFM2_SERVER_URL || serviceUrls.lfm2Server,
    modelPath:
      process.env.LFM2_MODEL_PATH ||
      '/Users/christianmerrill/Downloads/hf/LFM-1.2B-GGUF-Q5_1/lfm-1.2b_q5_1.gguf',
    // Use LFM2 for ultra-fast routing decisions
    useForRouting: process.env.LFM2_FOR_ROUTING !== 'false',
    // Use LFM2 for simple queries
    useForSimpleQueries: process.env.LFM2_FOR_SIMPLE !== 'false',
  },
};

/**
 * Get the appropriate model based on task requirements
 */
export function getModelForTask(
  taskType: string,
  requirements?: {
    speed?: 'fast' | 'balanced' | 'quality';
    capabilities?: string[];
    maxTokens?: number;
  }
): string {
  const { speed = 'balanced' } = requirements || {};

  // Use LFM2 for routing and simple tasks when enabled
  if (ModelConfig.lfm2.enabled) {
    if (
      taskType === 'routing' ||
      (taskType === 'quick_response' && ModelConfig.lfm2.useForSimpleQueries)
    ) {
      return ModelConfig.text.routing; // Returns 'lfm2:1.2b'
    }
  }

  switch (taskType) {
    case 'vision_analysis':
      return ModelConfig.vision.analysis;
    case 'multimodal_reasoning':
      return ModelConfig.vision.multimodal;
    case 'code_generation':
      return ModelConfig.text.code;
    case 'reasoning':
      return ModelConfig.text.reasoning;
    case 'quick_response':
      return ModelConfig.text.small;
    case 'embedding':
      return ModelConfig.embedding.text;
    case 'vision_embedding':
      return ModelConfig.embedding.vision;
    case 'math':
      return ModelConfig.specialized.math;
    default:
      // Choose based on speed preference
      if (speed === 'fast') return ModelConfig.text.small;
      if (speed === 'quality') return ModelConfig.text.large;
      return ModelConfig.text.medium;
  }
}

/**
 * Check if a model is available locally
 */
export async function isModelAvailable(model: string): Promise<boolean> {
  try {
    // Check with Ollama
    const response = await fetch('http://localhost:11434/api/tags');
    const data = await response.json();
    return data.models?.some((m: unknown) => m.name === model) || false;
  } catch {
    return false;
  }
}
