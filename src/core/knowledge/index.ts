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
  KnowledgeSearchOptions,
  KnowledgeUpdateOptions,
  KnowledgeVerificationResult,
  KnowledgeQueryOptions,
  KnowledgeTag,
  KnowledgeScore,
  KnowledgeMetadata
} from './knowledge-manager';

export type {
  ExtractionResult,
  ExtractionOptions,
  ExtractorConfig,
  ContentPattern,
  ExtractionRule,
  DataValidator,
  ExtractionContext
} from './intelligent-extractor';

export type {
  ResearchQuery,
  ResearchResult,
  ResearchOptions,
  ResearchSource,
  ResearchContext,
  ResearchStrategy
} from './online-research-agent';

export type {
  SearchQuery,
  SearchResult,
  SearchEngine,
  SearchOptions,
  SearchMetadata
} from './searxng-client';