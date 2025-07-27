/**;
 * Knowledge Module - Exports for knowledge management and research*/

// Core knowledge components;
export { Knowledge.Manager, knowledge.Utils } from './knowledge-manager';
export { Intelligent.Extractor, extraction.Utils } from './intelligent-extractor';
export { Online.Research.Agent } from './online-research-agent';
export { SearXN.G.Client } from './searxng-client'// Re-export types from individual modules;
export type {;
  Knowledge.Item;
  Knowledge.Query;
  Knowledge.Type;
  Knowledge.Manager.Config} from './dspy-knowledge-manager';
export type {;
  Extraction.Result;
  Extraction.Context;
  Extraction.Pattern;
  Extraction.Field;
  Validation.Rule;
  Pattern.Evolution.Data;
  Pattern.Adaptation;
  Pattern.Performance.Metrics;
  Pattern.Learning.Event;
  Extracted.Data} from './intelligent-extractor';
export type {;
  Research.Query;
  Research.Result;
  OnlineResearchAgent.Config} from './online-research-agent';
export type { SearXNG.Search.Params, SearXN.G.Result, SearXN.G.Response } from './searxng-client';