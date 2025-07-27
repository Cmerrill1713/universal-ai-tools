/**
 * Knowledge Module - Exports for knowledge management and research
 */

// Core knowledge components
export { KnowledgeManager, knowledgeUtils } from './knowledge-manager';
export { IntelligentExtractor, extractionUtils } from './intelligent-extractor';
export { OnlineResearchAgent } from './online-research-agent';
export { SearXNGClient } from './searxng-client';

// Re-export types from individual modules
export type {
  KnowledgeItem,
  KnowledgeQuery,
  KnowledgeType,
  KnowledgeManagerConfig,
} from './dspy-knowledge-manager';

export type {
  ExtractionResult,
  ExtractionContext,
  ExtractionPattern,
  ExtractionField,
  ValidationRule,
  PatternEvolutionData,
  PatternAdaptation,
  PatternPerformanceMetrics,
  PatternLearningEvent,
  ExtractedData,
} from './intelligent-extractor';

export type {
  ResearchQuery,
  ResearchResult,
  OnlineResearchAgentConfig,
} from './online-research-agent';

export type { SearXNGSearchParams, SearXNGResult, SearXNGResponse } from './searxng-client';
