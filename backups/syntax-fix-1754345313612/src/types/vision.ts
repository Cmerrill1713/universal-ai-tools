/**
 * Vision System Type Definitions;
 * Shared types for vision analysis, generation, and reasoning;
 */

export interface VisionAnalysis {
  objects: DetectedObject[];
  scene: SceneDescription;
  text: ExtractedText[];
  confidence: number;
  processingTimeMs: number;
}

export interface DetectedObject {
  class: string;
  confidence: number;
  bbox: BoundingBox;
  attributes?: Record<string, any>;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SceneDescription {
  description: string;
  tags: string[];
  mood?: string;
  lighting?: string;
  composition?: string;
}

export interface ExtractedText {
  text: string;
  confidence: number;
  location: BoundingBox;
  language?: string;
}

export interface VisionEmbedding {
  vector: Float32Array;
  model: string;
  dimension: number;
  metadata?: Record<string, any>;
}

export interface GeneratedImage {
  id: string;
  base64: string;
  prompt: string;
  model: string;
  parameters: GenerationParameters;
  quality: QualityMetrics;
  timestamp: Date;
  refinement_applied?: boolean;
}

export interface RefinedImage {
  id: string;
  original_base64: string;
  refined_base64: string;
  improvement_score: number;
  refinement_applied: boolean;
  backend: string;
  parameters: RefinementParameters;
  quality_metrics: QualityMetrics & {
    sharpness_improvement: number;
    detail_enhancement: number;
    color_balance: number;
    overall_quality: number;
    processing_backend: string;
  };
  fallback_reason?: string;
  timestamp: number;
}

export interface GenerationParameters {
  width: number;
  height: number;
  steps: number;
  guidance: number;
  seed?: number;
  negativePrompt?: string;
}

export interface RefinementParameters {
  strength: number; // 0?.1-1?.0, how much to refine the image;
  steps: number; // Number of inference steps;
  guidance: number; // Guidance scale;
  denoising_end?: number; // SDXL specific parameter;
  backend?: 'mlx' | 'gguf' | 'auto'; // Preferred backend;
}

export interface QualityMetrics {
  clipScore: number;
  aestheticScore: number;
  safetyScore: number;
  promptAlignment: number;
}

export interface VisualHypothesis {
  id: string;
  concept: string;
  generatedImage: GeneratedImage;
  expectedOutcome: string;
  confidence: number;
}

export interface ValidationResult {
  hypothesis: VisualHypothesis;
  actual: VisionAnalysis;
  match: boolean;
  matchScore: number;
  learning: LearningOutcome;
}

export interface LearningOutcome {
  concept: string;
  success: boolean;
  adjustment: string;
  newUnderstanding?: string;
}

export interface VisualMemory {
  id: string;
  embedding: VisionEmbedding;
  imageData?: {
    path?: string;
    base64?: string;
    thumbnail?: string;
  };
  analysis?: VisionAnalysis;
  temporalContext?: TemporalContext;
  spatialContext?: SpatialContext;
  causalChain?: CausalEvent[];
  metadata: Record<string, any>;
  timestamp: Date;
}

export interface TemporalContext {
  before: string[];
  after: string[];
  duration: number;
  frameIndex?: number;
  videoId?: string;
}

export interface SpatialContext {
  objects: SpatialObject[];
  relationships: SpatialRelation[];
  sceneGraph?: unknown;
}

export interface SpatialObject {
  id: string;
  class: string;
  position: { x: number; y: number; z?: number };
  size: { width: number; height: number; depth?: number };
  orientation?: { pitch: number; yaw: number; roll: number };
}

export interface SpatialRelation {
  subject: string;
  relation: 'above' | 'below' | 'left' | 'right' | 'inside' | 'near' | 'far';
  object: string;
  confidence: number;
}

export interface CausalEvent {
  cause: string;
  effect: string;
  confidence: number;
  timestamp: number;
}

export interface VisionRequest {
  type: 'analyze' | 'generate' | 'embed' | 'reason' | 'refine';
  data: Buffer | string;
  options?: VisionOptions;
  priority?: number;
}

export interface VisionOptions {
  model?: string;
  detailed?: boolean;
  extractText?: boolean;
  generateEmbedding?: boolean;
  timeout?: number;
  analysisType?: string;
  optimization?: Record<string, any>;
  // Refinement-specific options;
  strength?: number;
  steps?: number;
  guidance?: number;
  backend?: 'mlx' | 'gguf' | 'auto';
}

export interface VisionResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  processingTime: number;
  model: string;
  cached?: boolean;
  analysis?: T;
  metadata?: {
    totalProcessingTime?: number;
    [key: string]: any;
  };
}

export interface VisionServiceConfig {
  pythonPath: string;
  modelsPath: string;
  maxVRAM: number;
  enableGeneration: boolean;
  enableCaching: boolean;
  cacheSize: number;
  timeout: number;
}
