/**
 * Knowledge Module - Exports for knowledge management and research*/

// Core knowledge components;
export { Knowledge.Manager, knowledge.Utils } from './knowledge-manager';
export { Intelligent.Extractor, extraction.Utils } from './intelligent-extractor';
export { OnlineResearch.Agent } from './online-research-agent';
export { SearXNG.Client } from './searxng-client'// Re-export types from individual modules;
export type {
  Knowledge.Item;
  Knowledge.Query;
  Knowledge.Type;
  KnowledgeManager.Config} from './dspy-knowledge-manager';
export type {
  Extraction.Result;
  Extraction.Context;
  Extraction.Pattern;
  Extraction.Field;
  Validation.Rule;
  PatternEvolution.Data;
  Pattern.Adaptation;
  PatternPerformance.Metrics;
  PatternLearning.Event;
  Extracted.Data} from './intelligent-extractor';
export type {
  Research.Query;
  Research.Result;
  OnlineResearchAgent.Config} from './online-research-agent';
export type { SearXNGSearch.Params, SearXNG.Result, SearXNG.Response } from './searxng-client';