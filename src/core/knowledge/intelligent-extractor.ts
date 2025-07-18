import { createClient } from '@supabase/supabase-js';
import { logger } from '../../utils/logger';
import { SearXNGClient, SearXNGResult } from './searxng-client';
import { Browser, Page } from 'puppeteer';
import { Browser as PlaywrightBrowser, Page as PlaywrightPage } from 'playwright';
import * as cheerio from 'cheerio';

export interface ExtractionContext {
  sessionId: string;
  agentId: string;
  taskId: string;
  domain: string;
  contentType: 'html' | 'json' | 'text' | 'image' | 'pdf' | 'api_response' | 'structured_data';
  extractionGoal: string;
  confidenceThreshold: number;
  maxRetries: number;
  coordinationEnabled: boolean;
  learningEnabled: boolean;
}

export interface ExtractionPattern {
  id: string;
  name: string;
  type: 'dom' | 'regex' | 'semantic' | 'ai' | 'template' | 'xpath' | 'css' | 'json_path';
  pattern: string;
  confidence: number;
  applicableDomains: string[];
  applicableContentTypes: string[];
  extractionFields: ExtractionField[];
  validationRules: ValidationRule[];
  learningEnabled: boolean;
  evolutionData: PatternEvolutionData;
}

export interface ExtractionField {
  name: string;
  type: 'text' | 'number' | 'date' | 'url' | 'email' | 'code' | 'structured' | 'boolean';
  required: boolean;
  selector?: string;
  regex?: string;
  transformer?: string;
  validator?: string;
  defaultValue?: any;
  semanticTags?: string[];
}

export interface ValidationRule {
  id: string;
  type: 'required' | 'format' | 'length' | 'range' | 'custom' | 'semantic' | 'cross_field';
  field: string;
  condition: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  adaptable: boolean;
}

export interface PatternEvolutionData {
  successCount: number;
  failureCount: number;
  lastUpdated: number;
  adaptations: PatternAdaptation[];
  performanceMetrics: PatternPerformanceMetrics;
  learningHistory: PatternLearningEvent[];
}

export interface PatternAdaptation {
  id: string;
  type: 'selector_update' | 'field_addition' | 'validation_enhancement' | 'confidence_adjustment';
  description: string;
  oldValue: string;
  newValue: string;
  timestamp: number;
  confidence: number;
  triggeredBy: string;
}

export interface PatternPerformanceMetrics {
  averageExtractionTime: number;
  accuracyRate: number;
  falsePositiveRate: number;
  falseNegativeRate: number;
  adaptationEffectiveness: number;
  coordinationBenefit: number;
}

export interface PatternLearningEvent {
  timestamp: number;
  eventType: 'success' | 'failure' | 'adaptation' | 'validation_error' | 'performance_improvement';
  details: any;
  learningValue: number;
  contributorAgent: string;
}

export interface ExtractionResult {
  id: string;
  context: ExtractionContext;
  success: boolean;
  confidence: number;
  extractedData: ExtractedData;
  validationResults: ValidationResult[];
  patternMatches: PatternMatch[];
  semanticAnalysis: SemanticAnalysis;
  performanceMetrics: ExtractionPerformanceMetrics;
  learningInsights: LearningInsights;
  coordinationEvents: CoordinationEvent[];
  timestamp: number;
  error?: string;
}

export interface ExtractedData {
  structured: Record<string, any>;
  raw: string;
  metadata: DataMetadata;
  relationships: DataRelationship[];
  semanticTags: string[];
  relevanceScore: number;
  qualityScore: number;
}

export interface DataMetadata {
  source: string;
  extractionMethod: string;
  contentHash: string;
  extractionTimestamp: number;
  lastModified?: string;
  author?: string;
  contentLength: number;
  language?: string;
  encoding?: string;
}

export interface DataRelationship {
  type: 'parent' | 'child' | 'sibling' | 'reference' | 'dependency' | 'example';
  target: string;
  confidence: number;
  description: string;
}

export interface ValidationResult {
  ruleId: string;
  field: string;
  passed: boolean;
  message: string;
  severity: 'error' | 'warning' | 'info';
  suggestedFix?: string;
  confidence: number;
}

export interface PatternMatch {
  patternId: string;
  patternName: string;
  matchConfidence: number;
  extractedFields: Record<string, any>;
  matchedElements: MatchedElement[];
  adaptationsSuggested: string[];
}

export interface MatchedElement {
  selector: string;
  element: string;
  confidence: number;
  position: ElementPosition;
  attributes: Record<string, string>;
}

export interface ElementPosition {
  x: number;
  y: number;
  width: number;
  height: number;
  index: number;
}

export interface SemanticAnalysis {
  contentType: string;
  mainTopic: string;
  subTopics: string[];
  entities: SemanticEntity[];
  sentiment: number;
  complexity: number;
  readability: number;
  technicalLevel: number;
  relevanceToGoal: number;
}

export interface SemanticEntity {
  text: string;
  type: 'person' | 'organization' | 'location' | 'technology' | 'concept' | 'error' | 'solution';
  confidence: number;
  context: string;
  relationships: string[];
}

export interface ExtractionPerformanceMetrics {
  totalTime: number;
  domParsingTime: number;
  patternMatchingTime: number;
  validationTime: number;
  semanticAnalysisTime: number;
  coordinationTime: number;
  learningTime: number;
  memoryUsage: number;
  accuracyScore: number;
  efficiencyScore: number;
}

export interface LearningInsights {
  patternsLearned: string[];
  adaptationsApplied: string[];
  performanceImprovement: number;
  confidenceEvolution: number;
  knowledgeContribution: KnowledgeContribution;
  futureOptimizations: string[];
}

export interface KnowledgeContribution {
  type: 'pattern_discovery' | 'validation_improvement' | 'semantic_enhancement' | 'coordination_optimization';
  description: string;
  applicability: string[];
  confidence: number;
  impact: number;
}

export interface CoordinationEvent {
  type: 'knowledge_request' | 'knowledge_share' | 'pattern_validation' | 'collaborative_extraction' | 'error_reporting';
  fromAgent: string;
  toAgent?: string;
  timestamp: number;
  data: any;
  success: boolean;
}

export interface ContentAnalysisResult {
  contentType: string;
  structure: ContentStructure;
  complexity: number;
  extractability: number;
  recommendedPatterns: string[];
  challenges: string[];
  opportunities: string[];
}

export interface ContentStructure {
  hasTable: boolean;
  hasForm: boolean;
  hasCode: boolean;
  hasImages: boolean;
  hasVideo: boolean;
  hasStructuredData: boolean;
  hierarchyDepth: number;
  elementCount: number;
  textDensity: number;
}

export interface IntelligentExtractorConfig {
  supabaseUrl?: string;
  supabaseKey?: string;
  searxngUrl?: string;
  defaultConfidenceThreshold: number;
  maxRetries: number;
  enableLearning: boolean;
  enableCoordination: boolean;
  enableSemanticAnalysis: boolean;
  enablePatternEvolution: boolean;
  cacheEnabled: boolean;
  cacheTTL: number;
}

export class IntelligentExtractor {
  private supabase = createClient(
    process.env.SUPABASE_URL || 'http://localhost:54321',
    process.env.SUPABASE_SERVICE_KEY || 'your-service-key'
  );
  
  private searxngClient: SearXNGClient;
  private config: Required<IntelligentExtractorConfig>;
  private patterns: Map<string, ExtractionPattern> = new Map();
  private patternCache: Map<string, ExtractionResult> = new Map();
  private learningKnowledge: Map<string, any> = new Map();
  private coordinationNetwork: Map<string, any> = new Map();
  private performanceMetrics: Map<string, any> = new Map();
  private adaptiveStrategies: Map<string, any> = new Map();

  constructor(config: Partial<IntelligentExtractorConfig> = {}) {
    this.config = {
      supabaseUrl: config.supabaseUrl || process.env.SUPABASE_URL || 'http://localhost:54321',
      supabaseKey: config.supabaseKey || process.env.SUPABASE_SERVICE_KEY || 'your-service-key',
      searxngUrl: config.searxngUrl || 'http://localhost:8080',
      defaultConfidenceThreshold: config.defaultConfidenceThreshold ?? 0.7,
      maxRetries: config.maxRetries ?? 3,
      enableLearning: config.enableLearning ?? true,
      enableCoordination: config.enableCoordination ?? true,
      enableSemanticAnalysis: config.enableSemanticAnalysis ?? true,
      enablePatternEvolution: config.enablePatternEvolution ?? true,
      cacheEnabled: config.cacheEnabled ?? true,
      cacheTTL: config.cacheTTL ?? 300000 // 5 minutes
    };

    this.searxngClient = new SearXNGClient(this.config.searxngUrl);
    
    // Reinitialize Supabase client if custom config provided
    if (config.supabaseUrl || config.supabaseKey) {
      this.supabase = createClient(this.config.supabaseUrl, this.config.supabaseKey);
    }

    this.initializePredefinedPatterns();
    this.startLearningEvolution();
  }

  async extract(
    content: string | Buffer,
    context: ExtractionContext,
    page?: Page | PlaywrightPage
  ): Promise<ExtractionResult> {
    const startTime = Date.now();
    logger.info(`🔍 Starting intelligent extraction for ${context.contentType} content (Goal: ${context.extractionGoal})`);

    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(content, context);
      if (this.config.cacheEnabled && this.patternCache.has(cacheKey)) {
        const cachedResult = this.patternCache.get(cacheKey)!;
        if (Date.now() - cachedResult.timestamp < this.config.cacheTTL) {
          logger.info(`📦 Using cached extraction result`);
          return cachedResult;
        }
      }

      // Initialize result structure
      const result: ExtractionResult = {
        id: `extraction-${Date.now()}`,
        context,
        success: false,
        confidence: 0,
        extractedData: {
          structured: {},
          raw: content.toString(),
          metadata: await this.generateMetadata(content, context),
          relationships: [],
          semanticTags: [],
          relevanceScore: 0,
          qualityScore: 0
        },
        validationResults: [],
        patternMatches: [],
        semanticAnalysis: {
          contentType: context.contentType,
          mainTopic: '',
          subTopics: [],
          entities: [],
          sentiment: 0,
          complexity: 0,
          readability: 0,
          technicalLevel: 0,
          relevanceToGoal: 0
        },
        performanceMetrics: {
          totalTime: 0,
          domParsingTime: 0,
          patternMatchingTime: 0,
          validationTime: 0,
          semanticAnalysisTime: 0,
          coordinationTime: 0,
          learningTime: 0,
          memoryUsage: 0,
          accuracyScore: 0,
          efficiencyScore: 0
        },
        learningInsights: {
          patternsLearned: [],
          adaptationsApplied: [],
          performanceImprovement: 0,
          confidenceEvolution: 0,
          knowledgeContribution: {
            type: 'pattern_discovery',
            description: '',
            applicability: [],
            confidence: 0,
            impact: 0
          },
          futureOptimizations: []
        },
        coordinationEvents: [],
        timestamp: startTime
      };

      // Analyze content structure
      const contentAnalysis = await this.analyzeContent(content, context);
      
      // Request coordination if enabled
      if (this.config.enableCoordination && context.coordinationEnabled) {
        await this.requestCoordinationSupport(context, contentAnalysis, result);
      }

      // Find and apply matching patterns
      const domParsingStart = Date.now();
      const applicablePatterns = await this.findApplicablePatterns(context, contentAnalysis);
      result.performanceMetrics.domParsingTime = Date.now() - domParsingStart;

      // Execute extraction with multiple methods
      const extractionMethods = await this.determineExtractionMethods(context, contentAnalysis);
      
      for (const method of extractionMethods) {
        const methodResult = await this.executeExtractionMethod(method, content, context, applicablePatterns, page);
        
        // Merge results
        if (methodResult.patternMatches) {
          result.patternMatches.push(...methodResult.patternMatches);
        }
        if (methodResult.extractedData) {
          result.extractedData.structured = { ...result.extractedData.structured, ...methodResult.extractedData.structured };
          if (methodResult.extractedData.relationships) {
            result.extractedData.relationships.push(...methodResult.extractedData.relationships);
          }
          if (methodResult.extractedData.semanticTags) {
            result.extractedData.semanticTags.push(...methodResult.extractedData.semanticTags);
          }
        }
      }

      // Pattern matching and validation
      const patternMatchingStart = Date.now();
      await this.applyPatternMatching(result, applicablePatterns, content, context);
      result.performanceMetrics.patternMatchingTime = Date.now() - patternMatchingStart;

      // Validate extracted data
      const validationStart = Date.now();
      await this.validateExtractedData(result, context);
      result.performanceMetrics.validationTime = Date.now() - validationStart;

      // Semantic analysis
      if (this.config.enableSemanticAnalysis) {
        const semanticStart = Date.now();
        result.semanticAnalysis = await this.performSemanticAnalysis(result.extractedData, context);
        result.performanceMetrics.semanticAnalysisTime = Date.now() - semanticStart;
      }

      // Calculate confidence and quality scores
      await this.calculateConfidenceScores(result, context);

      // Learning and adaptation
      if (this.config.enableLearning && context.learningEnabled) {
        const learningStart = Date.now();
        await this.applyLearningInsights(result, context);
        result.performanceMetrics.learningTime = Date.now() - learningStart;
      }

      // Coordination sharing
      if (this.config.enableCoordination && context.coordinationEnabled) {
        const coordinationStart = Date.now();
        await this.shareExtractionResults(result, context);
        result.performanceMetrics.coordinationTime = Date.now() - coordinationStart;
      }

      // Store knowledge
      await this.storeExtractionKnowledge(result, context);

      // Cache result
      if (this.config.cacheEnabled) {
        this.patternCache.set(cacheKey, result);
      }

      // Calculate final metrics
      result.performanceMetrics.totalTime = Date.now() - startTime;
      result.performanceMetrics.efficiencyScore = this.calculateEfficiencyScore(result);
      result.success = result.confidence >= context.confidenceThreshold;

      logger.info(`${result.success ? '✅' : '❌'} Extraction completed: ${result.confidence.toFixed(2)} confidence, ${result.patternMatches.length} patterns matched`);
      return result;

    } catch (error) {
      logger.error('❌ Intelligent extraction failed:', error);
      
      // Create failure result
      const failureResult: ExtractionResult = {
        id: `extraction-failed-${Date.now()}`,
        context,
        success: false,
        confidence: 0,
        extractedData: {
          structured: {},
          raw: content.toString(),
          metadata: await this.generateMetadata(content, context),
          relationships: [],
          semanticTags: [],
          relevanceScore: 0,
          qualityScore: 0
        },
        validationResults: [],
        patternMatches: [],
        semanticAnalysis: {
          contentType: context.contentType,
          mainTopic: '',
          subTopics: [],
          entities: [],
          sentiment: 0,
          complexity: 0,
          readability: 0,
          technicalLevel: 0,
          relevanceToGoal: 0
        },
        performanceMetrics: {
          totalTime: Date.now() - startTime,
          domParsingTime: 0,
          patternMatchingTime: 0,
          validationTime: 0,
          semanticAnalysisTime: 0,
          coordinationTime: 0,
          learningTime: 0,
          memoryUsage: 0,
          accuracyScore: 0,
          efficiencyScore: 0
        },
        learningInsights: {
          patternsLearned: [],
          adaptationsApplied: [],
          performanceImprovement: 0,
          confidenceEvolution: 0,
          knowledgeContribution: {
            type: 'pattern_discovery',
            description: '',
            applicability: [],
            confidence: 0,
            impact: 0
          },
          futureOptimizations: []
        },
        coordinationEvents: [],
        timestamp: startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };

      // Learn from failure
      if (this.config.enableLearning) {
        await this.learnFromFailure(failureResult, context, error);
      }

      return failureResult;
    }
  }

  private initializePredefinedPatterns(): void {
    logger.info('🧠 Initializing predefined extraction patterns...');

    // Stack Overflow Answer Pattern
    this.patterns.set('stackoverflow-answer', {
      id: 'stackoverflow-answer',
      name: 'Stack Overflow Answer',
      type: 'dom',
      pattern: '.answer',
      confidence: 0.9,
      applicableDomains: ['stackoverflow.com', 'stackexchange.com'],
      applicableContentTypes: ['html'],
      extractionFields: [
        { name: 'answer_text', type: 'text', required: true, selector: '.s-prose', semanticTags: ['solution', 'explanation'] },
        { name: 'code_snippets', type: 'code', required: false, selector: 'code, pre', semanticTags: ['code', 'example'] },
        { name: 'votes', type: 'number', required: false, selector: '.js-vote-count', semanticTags: ['rating'] },
        { name: 'accepted', type: 'boolean', required: false, selector: '.js-accepted-answer-indicator', semanticTags: ['validated'] }
      ],
      validationRules: [
        { id: 'answer-length', type: 'length', field: 'answer_text', condition: 'min:10', message: 'Answer too short', severity: 'warning', adaptable: true },
        { id: 'code-present', type: 'custom', field: 'code_snippets', condition: 'hasCode', message: 'No code examples found', severity: 'info', adaptable: true }
      ],
      learningEnabled: true,
      evolutionData: {
        successCount: 0,
        failureCount: 0,
        lastUpdated: Date.now(),
        adaptations: [],
        performanceMetrics: {
          averageExtractionTime: 0,
          accuracyRate: 0,
          falsePositiveRate: 0,
          falseNegativeRate: 0,
          adaptationEffectiveness: 0,
          coordinationBenefit: 0
        },
        learningHistory: []
      }
    });

    // GitHub Issue Pattern
    this.patterns.set('github-issue', {
      id: 'github-issue',
      name: 'GitHub Issue',
      type: 'dom',
      pattern: '.timeline-comment',
      confidence: 0.85,
      applicableDomains: ['github.com'],
      applicableContentTypes: ['html'],
      extractionFields: [
        { name: 'issue_title', type: 'text', required: true, selector: '.js-issue-title', semanticTags: ['title', 'problem'] },
        { name: 'issue_body', type: 'text', required: true, selector: '.comment-body', semanticTags: ['description', 'details'] },
        { name: 'labels', type: 'text', required: false, selector: '.IssueLabel', semanticTags: ['category', 'classification'] },
        { name: 'status', type: 'text', required: true, selector: '.State', semanticTags: ['status'] },
        { name: 'code_snippets', type: 'code', required: false, selector: 'pre, code', semanticTags: ['code', 'example'] }
      ],
      validationRules: [
        { id: 'title-present', type: 'required', field: 'issue_title', condition: 'required', message: 'Issue title is required', severity: 'error', adaptable: false },
        { id: 'body-length', type: 'length', field: 'issue_body', condition: 'min:20', message: 'Issue body too short', severity: 'warning', adaptable: true }
      ],
      learningEnabled: true,
      evolutionData: {
        successCount: 0,
        failureCount: 0,
        lastUpdated: Date.now(),
        adaptations: [],
        performanceMetrics: {
          averageExtractionTime: 0,
          accuracyRate: 0,
          falsePositiveRate: 0,
          falseNegativeRate: 0,
          adaptationEffectiveness: 0,
          coordinationBenefit: 0
        },
        learningHistory: []
      }
    });

    // Documentation Pattern
    this.patterns.set('documentation', {
      id: 'documentation',
      name: 'Technical Documentation',
      type: 'semantic',
      pattern: 'main, .content, .docs, .documentation',
      confidence: 0.8,
      applicableDomains: ['*'],
      applicableContentTypes: ['html'],
      extractionFields: [
        { name: 'title', type: 'text', required: true, selector: 'h1, .title', semanticTags: ['title', 'topic'] },
        { name: 'content', type: 'text', required: true, selector: 'p, .content', semanticTags: ['explanation', 'instructions'] },
        { name: 'code_examples', type: 'code', required: false, selector: 'pre, code', semanticTags: ['code', 'example'] },
        { name: 'links', type: 'url', required: false, selector: 'a[href]', semanticTags: ['reference'] }
      ],
      validationRules: [
        { id: 'title-present', type: 'required', field: 'title', condition: 'required', message: 'Documentation title is required', severity: 'error', adaptable: false },
        { id: 'content-substantial', type: 'length', field: 'content', condition: 'min:50', message: 'Content too brief', severity: 'warning', adaptable: true }
      ],
      learningEnabled: true,
      evolutionData: {
        successCount: 0,
        failureCount: 0,
        lastUpdated: Date.now(),
        adaptations: [],
        performanceMetrics: {
          averageExtractionTime: 0,
          accuracyRate: 0,
          falsePositiveRate: 0,
          falseNegativeRate: 0,
          adaptationEffectiveness: 0,
          coordinationBenefit: 0
        },
        learningHistory: []
      }
    });

    // Error Message Pattern
    this.patterns.set('error-message', {
      id: 'error-message',
      name: 'Error Message',
      type: 'regex',
      pattern: '(error|exception|failed|failure|cannot|unable|invalid|undefined|null|not found)',
      confidence: 0.75,
      applicableDomains: ['*'],
      applicableContentTypes: ['html', 'text', 'json'],
      extractionFields: [
        { name: 'error_type', type: 'text', required: true, regex: '(\\w+Error|\\w+Exception)', semanticTags: ['error_type'] },
        { name: 'error_message', type: 'text', required: true, selector: '.error, .exception', semanticTags: ['error_message'] },
        { name: 'stack_trace', type: 'text', required: false, selector: '.stack, .trace', semanticTags: ['stack_trace'] },
        { name: 'line_number', type: 'number', required: false, regex: 'line\\s+(\\d+)', semanticTags: ['location'] }
      ],
      validationRules: [
        { id: 'error-type-valid', type: 'format', field: 'error_type', condition: 'regex:\\w+(Error|Exception)', message: 'Invalid error type format', severity: 'warning', adaptable: true }
      ],
      learningEnabled: true,
      evolutionData: {
        successCount: 0,
        failureCount: 0,
        lastUpdated: Date.now(),
        adaptations: [],
        performanceMetrics: {
          averageExtractionTime: 0,
          accuracyRate: 0,
          falsePositiveRate: 0,
          falseNegativeRate: 0,
          adaptationEffectiveness: 0,
          coordinationBenefit: 0
        },
        learningHistory: []
      }
    });

    // API Documentation Pattern
    this.patterns.set('api-documentation', {
      id: 'api-documentation',
      name: 'API Documentation',
      type: 'template',
      pattern: 'api, endpoint, method, parameter',
      confidence: 0.85,
      applicableDomains: ['*'],
      applicableContentTypes: ['html', 'json'],
      extractionFields: [
        { name: 'endpoint', type: 'url', required: true, selector: '.endpoint, .url', semanticTags: ['endpoint'] },
        { name: 'method', type: 'text', required: true, selector: '.method, .http-method', semanticTags: ['http_method'] },
        { name: 'parameters', type: 'structured', required: false, selector: '.parameters, .params', semanticTags: ['parameters'] },
        { name: 'example_request', type: 'code', required: false, selector: '.example, .request', semanticTags: ['example'] },
        { name: 'example_response', type: 'code', required: false, selector: '.response', semanticTags: ['response_example'] }
      ],
      validationRules: [
        { id: 'endpoint-valid', type: 'format', field: 'endpoint', condition: 'url', message: 'Invalid endpoint URL', severity: 'error', adaptable: true },
        { id: 'method-valid', type: 'format', field: 'method', condition: 'regex:(GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD)', message: 'Invalid HTTP method', severity: 'error', adaptable: false }
      ],
      learningEnabled: true,
      evolutionData: {
        successCount: 0,
        failureCount: 0,
        lastUpdated: Date.now(),
        adaptations: [],
        performanceMetrics: {
          averageExtractionTime: 0,
          accuracyRate: 0,
          falsePositiveRate: 0,
          falseNegativeRate: 0,
          adaptationEffectiveness: 0,
          coordinationBenefit: 0
        },
        learningHistory: []
      }
    });

    logger.info(`✅ Initialized ${this.patterns.size} predefined patterns`);
  }

  private async analyzeContent(content: string | Buffer, context: ExtractionContext): Promise<ContentAnalysisResult> {
    const contentStr = content.toString();
    const $ = cheerio.load(contentStr);

    const structure: ContentStructure = {
      hasTable: $('table').length > 0,
      hasForm: $('form').length > 0,
      hasCode: $('code, pre').length > 0,
      hasImages: $('img').length > 0,
      hasVideo: $('video').length > 0,
      hasStructuredData: $('[itemscope], [vocab]').length > 0,
      hierarchyDepth: this.calculateHierarchyDepth($),
      elementCount: $('*').length,
      textDensity: this.calculateTextDensity($)
    };

    const complexity = this.calculateComplexity(structure, contentStr);
    const extractability = this.calculateExtractability(structure, context);

    return {
      contentType: context.contentType,
      structure,
      complexity,
      extractability,
      recommendedPatterns: this.recommendPatterns(structure, context),
      challenges: this.identifyChallenges(structure, context),
      opportunities: this.identifyOpportunities(structure, context)
    };
  }

  private async findApplicablePatterns(context: ExtractionContext, contentAnalysis: ContentAnalysisResult): Promise<ExtractionPattern[]> {
    const applicable: ExtractionPattern[] = [];

    for (const pattern of this.patterns.values()) {
      if (this.isPatternApplicable(pattern, context, contentAnalysis)) {
        applicable.push(pattern);
      }
    }

    // Sort by confidence and relevance
    applicable.sort((a, b) => {
      const scoreA = a.confidence * this.calculateRelevanceScore(a, context);
      const scoreB = b.confidence * this.calculateRelevanceScore(b, context);
      return scoreB - scoreA;
    });

    return applicable;
  }

  private async determineExtractionMethods(context: ExtractionContext, contentAnalysis: ContentAnalysisResult): Promise<string[]> {
    const methods: string[] = [];

    // Always include basic DOM parsing for HTML
    if (context.contentType === 'html') {
      methods.push('dom');
    }

    // Add semantic analysis for complex content
    if (contentAnalysis.complexity > 0.7) {
      methods.push('semantic');
    }

    // Add pattern matching for structured content
    if (contentAnalysis.structure.hasStructuredData) {
      methods.push('template');
    }

    // Add regex for text content
    if (context.contentType === 'text' || contentAnalysis.structure.textDensity > 0.5) {
      methods.push('regex');
    }

    // Add AI-based extraction for complex goals
    if (context.extractionGoal.includes('understand') || context.extractionGoal.includes('analyze')) {
      methods.push('ai');
    }

    return methods;
  }

  private async executeExtractionMethod(
    method: string,
    content: string | Buffer,
    context: ExtractionContext,
    patterns: ExtractionPattern[],
    page?: Page | PlaywrightPage
  ): Promise<Partial<ExtractionResult>> {
    const contentStr = content.toString();
    
    switch (method) {
      case 'dom':
        return await this.executeDOMExtraction(contentStr, context, patterns, page);
      case 'semantic':
        return await this.executeSemanticExtraction(contentStr, context, patterns);
      case 'template':
        return await this.executeTemplateExtraction(contentStr, context, patterns);
      case 'regex':
        return await this.executeRegexExtraction(contentStr, context, patterns);
      case 'ai':
        return await this.executeAIExtraction(contentStr, context, patterns);
      default:
        return { extractedData: { structured: {}, raw: contentStr, metadata: await this.generateMetadata(content, context), relationships: [], semanticTags: [], relevanceScore: 0, qualityScore: 0 }, patternMatches: [] };
    }
  }

  private async executeDOMExtraction(
    content: string,
    context: ExtractionContext,
    patterns: ExtractionPattern[],
    page?: Page | PlaywrightPage
  ): Promise<Partial<ExtractionResult>> {
    const $ = cheerio.load(content);
    const extractedData: ExtractedData = {
      structured: {},
      raw: content,
      metadata: await this.generateMetadata(content, context),
      relationships: [],
      semanticTags: [],
      relevanceScore: 0,
      qualityScore: 0
    };
    const patternMatches: PatternMatch[] = [];

    for (const pattern of patterns) {
      if (pattern.type === 'dom') {
        const match = await this.applyDOMPattern(pattern, $, context);
        if (match) {
          patternMatches.push(match);
          extractedData.structured = { ...extractedData.structured, ...match.extractedFields };
        }
      }
    }

    // Enhanced DOM extraction with page context
    if (page) {
      try {
        // Simplified page data extraction
        const pageData = {
          hasPage: true,
          extractedAt: new Date().toISOString()
        };
        
        extractedData.structured.pageData = pageData;
      } catch (error) {
        logger.warn('Failed to extract page data:', error);
      }
    }

    return { extractedData, patternMatches };
  }

  private async executeSemanticExtraction(
    content: string,
    context: ExtractionContext,
    patterns: ExtractionPattern[]
  ): Promise<Partial<ExtractionResult>> {
    const extractedData: ExtractedData = {
      structured: {},
      raw: content,
      metadata: await this.generateMetadata(content, context),
      relationships: [],
      semanticTags: [],
      relevanceScore: 0,
      qualityScore: 0
    };
    const patternMatches: PatternMatch[] = [];

    // Extract semantic entities
    const entities = this.extractSemanticEntities(content, context);
    extractedData.structured.entities = entities;

    // Extract relationships
    const relationships = this.extractRelationships(content, entities);
    extractedData.relationships = relationships;

    // Apply semantic tags
    extractedData.semanticTags = this.generateSemanticTags(content, context, entities);

    // Calculate relevance score
    extractedData.relevanceScore = this.calculateContentRelevanceScore(content, context);

    return { extractedData, patternMatches };
  }

  private async executeTemplateExtraction(
    content: string,
    context: ExtractionContext,
    patterns: ExtractionPattern[]
  ): Promise<Partial<ExtractionResult>> {
    const extractedData: ExtractedData = {
      structured: {},
      raw: content,
      metadata: await this.generateMetadata(content, context),
      relationships: [],
      semanticTags: [],
      relevanceScore: 0,
      qualityScore: 0
    };
    const patternMatches: PatternMatch[] = [];

    for (const pattern of patterns) {
      if (pattern.type === 'template') {
        const match = await this.applyTemplatePattern(pattern, content, context);
        if (match) {
          patternMatches.push(match);
          extractedData.structured = { ...extractedData.structured, ...match.extractedFields };
        }
      }
    }

    return { extractedData, patternMatches };
  }

  private async executeRegexExtraction(
    content: string,
    context: ExtractionContext,
    patterns: ExtractionPattern[]
  ): Promise<Partial<ExtractionResult>> {
    const extractedData: ExtractedData = {
      structured: {},
      raw: content,
      metadata: await this.generateMetadata(content, context),
      relationships: [],
      semanticTags: [],
      relevanceScore: 0,
      qualityScore: 0
    };
    const patternMatches: PatternMatch[] = [];

    for (const pattern of patterns) {
      if (pattern.type === 'regex') {
        const match = await this.applyRegexPattern(pattern, content, context);
        if (match) {
          patternMatches.push(match);
          extractedData.structured = { ...extractedData.structured, ...match.extractedFields };
        }
      }
    }

    return { extractedData, patternMatches };
  }

  private async executeAIExtraction(
    content: string,
    context: ExtractionContext,
    patterns: ExtractionPattern[]
  ): Promise<Partial<ExtractionResult>> {
    const extractedData: ExtractedData = {
      structured: {},
      raw: content,
      metadata: await this.generateMetadata(content, context),
      relationships: [],
      semanticTags: [],
      relevanceScore: 0,
      qualityScore: 0
    };

    // AI-based extraction would integrate with external AI services
    // For now, we'll implement intelligent heuristics
    
    // Extract code snippets intelligently
    const codeSnippets = this.extractCodeSnippets(content);
    if (codeSnippets.length > 0) {
      extractedData.structured.codeSnippets = codeSnippets;
    }

    // Extract technical concepts
    const concepts = this.extractTechnicalConcepts(content, context);
    extractedData.structured.concepts = concepts;

    // Extract solutions and explanations
    const solutions = this.extractSolutions(content, context);
    extractedData.structured.solutions = solutions;

    return { extractedData, patternMatches: [] };
  }

  private async applyDOMPattern(
    pattern: ExtractionPattern,
    $: cheerio.CheerioAPI,
    context: ExtractionContext
  ): Promise<PatternMatch | null> {
    const elements = $(pattern.pattern);
    
    if (elements.length === 0) {
      return null;
    }

    const extractedFields: Record<string, any> = {};
    const matchedElements: MatchedElement[] = [];

    elements.each((index, element) => {
      const $element = $(element);
      
      for (const field of pattern.extractionFields) {
        if (field.selector) {
          const fieldElements = $element.find(field.selector);
          if (fieldElements.length > 0) {
            const value = this.extractFieldValue(fieldElements, field);
            if (value !== null) {
              extractedFields[field.name] = value;
            }
          }
        }
      }

      // Record matched element
      matchedElements.push({
        selector: pattern.pattern,
        element: $element.html() || '',
        confidence: pattern.confidence,
        position: {
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          index
        },
        attributes: ($element.get(0) as any)?.attribs || {}
      });
    });

    if (Object.keys(extractedFields).length === 0) {
      return null;
    }

    return {
      patternId: pattern.id,
      patternName: pattern.name,
      matchConfidence: pattern.confidence,
      extractedFields,
      matchedElements,
      adaptationsSuggested: []
    };
  }

  private async applyTemplatePattern(
    pattern: ExtractionPattern,
    content: string,
    context: ExtractionContext
  ): Promise<PatternMatch | null> {
    const $ = cheerio.load(content);
    const extractedFields: Record<string, any> = {};
    const matchedElements: MatchedElement[] = [];

    // Template-based extraction for API documentation
    if (pattern.id === 'api-documentation') {
      const endpoints = this.extractAPIEndpoints(content);
      if (endpoints.length > 0) {
        extractedFields.endpoints = endpoints;
      }

      const methods = this.extractHTTPMethods(content);
      if (methods.length > 0) {
        extractedFields.methods = methods;
      }
    }

    if (Object.keys(extractedFields).length === 0) {
      return null;
    }

    return {
      patternId: pattern.id,
      patternName: pattern.name,
      matchConfidence: pattern.confidence,
      extractedFields,
      matchedElements,
      adaptationsSuggested: []
    };
  }

  private async applyRegexPattern(
    pattern: ExtractionPattern,
    content: string,
    context: ExtractionContext
  ): Promise<PatternMatch | null> {
    const regex = new RegExp(pattern.pattern, 'gi');
    const matches = content.match(regex);

    if (!matches || matches.length === 0) {
      return null;
    }

    const extractedFields: Record<string, any> = {};

    for (const field of pattern.extractionFields) {
      if (field.regex) {
        const fieldRegex = new RegExp(field.regex, 'gi');
        const fieldMatches = content.match(fieldRegex);
        if (fieldMatches) {
          extractedFields[field.name] = fieldMatches;
        }
      }
    }

    return {
      patternId: pattern.id,
      patternName: pattern.name,
      matchConfidence: pattern.confidence,
      extractedFields,
      matchedElements: [],
      adaptationsSuggested: []
    };
  }

  private async applyPatternMatching(
    result: ExtractionResult,
    patterns: ExtractionPattern[],
    content: string | Buffer,
    context: ExtractionContext
  ): Promise<void> {
    for (const pattern of patterns) {
      // Update pattern performance metrics
      const startTime = Date.now();
      
      try {
        // Pattern matching logic is already handled in executeExtractionMethod
        // Here we update the pattern's learning data
        
        const executionTime = Date.now() - startTime;
        pattern.evolutionData.performanceMetrics.averageExtractionTime = 
          (pattern.evolutionData.performanceMetrics.averageExtractionTime + executionTime) / 2;
        
        pattern.evolutionData.successCount++;
        pattern.evolutionData.lastUpdated = Date.now();
        
        // Add learning event
        pattern.evolutionData.learningHistory.push({
          timestamp: Date.now(),
          eventType: 'success',
          details: { executionTime, context: context.extractionGoal },
          learningValue: 1.0,
          contributorAgent: context.agentId
        });
        
      } catch (error) {
        pattern.evolutionData.failureCount++;
        pattern.evolutionData.learningHistory.push({
          timestamp: Date.now(),
          eventType: 'failure',
          details: { error: error instanceof Error ? error.message : 'Unknown error', context: context.extractionGoal },
          learningValue: -0.5,
          contributorAgent: context.agentId
        });
      }
    }
  }

  private async validateExtractedData(result: ExtractionResult, context: ExtractionContext): Promise<void> {
    const validationResults: ValidationResult[] = [];

    for (const match of result.patternMatches) {
      const pattern = this.patterns.get(match.patternId);
      if (!pattern) continue;

      for (const rule of pattern.validationRules) {
        const validationResult = await this.validateField(match.extractedFields, rule, context);
        validationResults.push(validationResult);
      }
    }

    result.validationResults = validationResults;
  }

  private async validateField(
    extractedFields: Record<string, any>,
    rule: ValidationRule,
    context: ExtractionContext
  ): Promise<ValidationResult> {
    const fieldValue = extractedFields[rule.field];
    let passed = true;
    let message = rule.message;
    let suggestedFix: string | undefined;

    switch (rule.type) {
      case 'required':
        passed = fieldValue !== undefined && fieldValue !== null && fieldValue !== '';
        break;
      case 'length':
        if (typeof fieldValue === 'string') {
          const minMatch = rule.condition.match(/min:(\d+)/);
          const maxMatch = rule.condition.match(/max:(\d+)/);
          if (minMatch && fieldValue.length < parseInt(minMatch[1])) {
            passed = false;
            suggestedFix = `Field should be at least ${minMatch[1]} characters long`;
          }
          if (maxMatch && fieldValue.length > parseInt(maxMatch[1])) {
            passed = false;
            suggestedFix = `Field should be at most ${maxMatch[1]} characters long`;
          }
        }
        break;
      case 'format':
        if (typeof fieldValue === 'string') {
          const regexMatch = rule.condition.match(/regex:(.+)/);
          if (regexMatch) {
            const regex = new RegExp(regexMatch[1]);
            passed = regex.test(fieldValue);
          }
        }
        break;
      case 'custom':
        // Custom validation logic
        if (rule.condition === 'hasCode' && Array.isArray(fieldValue)) {
          passed = fieldValue.length > 0;
        }
        break;
    }

    return {
      ruleId: rule.id,
      field: rule.field,
      passed,
      message,
      severity: rule.severity,
      suggestedFix,
      confidence: passed ? 1.0 : 0.0
    };
  }

  private async performSemanticAnalysis(extractedData: ExtractedData, context: ExtractionContext): Promise<SemanticAnalysis> {
    const content = extractedData.raw;
    
    // Extract entities
    const entities = this.extractSemanticEntities(content, context);
    
    // Analyze content
    const mainTopic = this.extractMainTopic(content, context);
    const subTopics = this.extractSubTopics(content, context);
    
    // Calculate metrics
    const sentiment = this.calculateSentiment(content);
    const complexity = this.calculateContentComplexity(content);
    const readability = this.calculateReadability(content);
    const technicalLevel = this.calculateTechnicalLevel(content);
    const relevanceToGoal = this.calculateRelevanceToGoal(content, context);

    return {
      contentType: context.contentType,
      mainTopic,
      subTopics,
      entities,
      sentiment,
      complexity,
      readability,
      technicalLevel,
      relevanceToGoal
    };
  }

  private async calculateConfidenceScores(result: ExtractionResult, context: ExtractionContext): Promise<void> {
    // Calculate overall confidence based on multiple factors
    const patternConfidence = result.patternMatches.length > 0 
      ? result.patternMatches.reduce((sum, match) => sum + match.matchConfidence, 0) / result.patternMatches.length
      : 0;

    const validationConfidence = result.validationResults.length > 0
      ? result.validationResults.filter(v => v.passed).length / result.validationResults.length
      : 0;

    const semanticConfidence = result.semanticAnalysis.relevanceToGoal;

    result.confidence = (patternConfidence + validationConfidence + semanticConfidence) / 3;
    result.extractedData.qualityScore = this.calculateQualityScore(result);
  }

  private async applyLearningInsights(result: ExtractionResult, context: ExtractionContext): Promise<void> {
    const learningInsights: LearningInsights = {
      patternsLearned: [],
      adaptationsApplied: [],
      performanceImprovement: 0,
      confidenceEvolution: 0,
      knowledgeContribution: {
        type: 'pattern_discovery',
        description: '',
        applicability: [],
        confidence: 0,
        impact: 0
      },
      futureOptimizations: []
    };

    // Analyze patterns that worked well
    const successfulPatterns = result.patternMatches.filter(match => match.matchConfidence > 0.8);
    learningInsights.patternsLearned = successfulPatterns.map(match => match.patternName);

    // Suggest improvements
    if (result.confidence < context.confidenceThreshold) {
      learningInsights.futureOptimizations = [
        'improve_pattern_matching',
        'enhance_validation_rules',
        'add_semantic_analysis',
        'request_coordination_support'
      ];
    }

    // Calculate knowledge contribution
    if (successfulPatterns.length > 0) {
      learningInsights.knowledgeContribution = {
        type: 'pattern_discovery',
        description: `Successfully applied ${successfulPatterns.length} patterns for ${context.extractionGoal}`,
        applicability: [context.domain, context.contentType],
        confidence: result.confidence,
        impact: successfulPatterns.length * 0.1
      };
    }

    result.learningInsights = learningInsights;
  }

  private async requestCoordinationSupport(
    context: ExtractionContext,
    contentAnalysis: ContentAnalysisResult,
    result: ExtractionResult
  ): Promise<void> {
    // Request coordination support for complex extractions
    if (contentAnalysis.complexity > 0.8 || contentAnalysis.extractability < 0.5) {
      const coordinationEvent: CoordinationEvent = {
        type: 'knowledge_request',
        fromAgent: context.agentId,
        timestamp: Date.now(),
        data: {
          extractionGoal: context.extractionGoal,
          contentType: context.contentType,
          domain: context.domain,
          complexity: contentAnalysis.complexity,
          challenges: contentAnalysis.challenges
        },
        success: false
      };

      result.coordinationEvents.push(coordinationEvent);
    }
  }

  private async shareExtractionResults(result: ExtractionResult, context: ExtractionContext): Promise<void> {
    // Share successful extraction results with the coordination network
    if (result.success && result.confidence > 0.8) {
      const coordinationEvent: CoordinationEvent = {
        type: 'knowledge_share',
        fromAgent: context.agentId,
        timestamp: Date.now(),
        data: {
          extractionGoal: context.extractionGoal,
          patterns: result.patternMatches.map(match => match.patternName),
          confidence: result.confidence,
          insights: result.learningInsights
        },
        success: true
      };

      result.coordinationEvents.push(coordinationEvent);
    }
  }

  private async storeExtractionKnowledge(result: ExtractionResult, context: ExtractionContext): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('extraction_knowledge')
        .insert({
          session_id: context.sessionId,
          agent_id: context.agentId,
          task_id: context.taskId,
          extraction_goal: context.extractionGoal,
          content_type: context.contentType,
          domain: context.domain,
          success: result.success,
          confidence: result.confidence,
          patterns_used: result.patternMatches.map(match => match.patternName),
          extracted_data: result.extractedData.structured,
          semantic_analysis: result.semanticAnalysis,
          learning_insights: result.learningInsights,
          performance_metrics: result.performanceMetrics,
          coordination_events: result.coordinationEvents,
          created_at: new Date().toISOString()
        });

      if (error) {
        logger.error('Failed to store extraction knowledge:', error);
      } else {
        logger.info('💾 Extraction knowledge stored successfully');
      }
    } catch (error) {
      logger.error('Extraction knowledge storage error:', error);
    }
  }

  private async learnFromFailure(result: ExtractionResult, context: ExtractionContext, error: any): Promise<void> {
    // Learn from extraction failures
    const failureInsight: LearningInsights = {
      patternsLearned: [],
      adaptationsApplied: [],
      performanceImprovement: 0,
      confidenceEvolution: -0.1,
      knowledgeContribution: {
        type: 'pattern_discovery',
        description: `Failed extraction: ${error instanceof Error ? error.message : 'Unknown error'}`,
        applicability: [context.domain, context.contentType],
        confidence: 0,
        impact: -0.1
      },
      futureOptimizations: [
        'improve_error_handling',
        'add_fallback_patterns',
        'enhance_pattern_matching',
        'request_coordination_support'
      ]
    };

    result.learningInsights = failureInsight;
    
    // Store failure knowledge
    await this.storeExtractionKnowledge(result, context);
  }

  private startLearningEvolution(): void {
    // Start pattern evolution and learning processes
    setInterval(() => {
      this.evolvePatterns();
    }, 300000); // Every 5 minutes

    setInterval(() => {
      this.updateAdaptiveStrategies();
    }, 600000); // Every 10 minutes
  }

  private async evolvePatterns(): Promise<void> {
    logger.info('🧬 Evolving extraction patterns...');
    
    for (const pattern of this.patterns.values()) {
      if (pattern.learningEnabled && pattern.evolutionData.learningHistory.length > 0) {
        const recentEvents = pattern.evolutionData.learningHistory
          .filter(event => Date.now() - event.timestamp < 3600000) // Last hour
          .slice(-10); // Last 10 events

        if (recentEvents.length > 0) {
          await this.evolvePattern(pattern, recentEvents);
        }
      }
    }
  }

  private async evolvePattern(pattern: ExtractionPattern, events: PatternLearningEvent[]): Promise<void> {
    const successEvents = events.filter(e => e.eventType === 'success');
    const failureEvents = events.filter(e => e.eventType === 'failure');

    // Adapt pattern based on success/failure ratio
    if (failureEvents.length > successEvents.length) {
      // Pattern is failing, try to adapt
      const adaptation: PatternAdaptation = {
        id: `adapt-${Date.now()}`,
        type: 'confidence_adjustment',
        description: 'Reducing confidence due to recent failures',
        oldValue: pattern.confidence.toString(),
        newValue: Math.max(0.1, pattern.confidence - 0.1).toString(),
        timestamp: Date.now(),
        confidence: 0.7,
        triggeredBy: 'failure_analysis'
      };

      pattern.confidence = Math.max(0.1, pattern.confidence - 0.1);
      pattern.evolutionData.adaptations.push(adaptation);
      
      logger.info(`📉 Adapted pattern ${pattern.name}: reduced confidence to ${pattern.confidence}`);
    } else if (successEvents.length > failureEvents.length * 2) {
      // Pattern is performing well, increase confidence
      const adaptation: PatternAdaptation = {
        id: `adapt-${Date.now()}`,
        type: 'confidence_adjustment',
        description: 'Increasing confidence due to recent successes',
        oldValue: pattern.confidence.toString(),
        newValue: Math.min(1.0, pattern.confidence + 0.05).toString(),
        timestamp: Date.now(),
        confidence: 0.9,
        triggeredBy: 'success_analysis'
      };

      pattern.confidence = Math.min(1.0, pattern.confidence + 0.05);
      pattern.evolutionData.adaptations.push(adaptation);
      
      logger.info(`📈 Adapted pattern ${pattern.name}: increased confidence to ${pattern.confidence}`);
    }
  }

  private async updateAdaptiveStrategies(): Promise<void> {
    // Update adaptive strategies based on learning
    const strategies = new Map<string, any>();
    
    // Strategy for handling complex content
    strategies.set('complex_content', {
      description: 'Use multiple extraction methods for complex content',
      conditions: ['complexity > 0.8'],
      actions: ['use_multiple_methods', 'request_coordination', 'apply_semantic_analysis']
    });

    // Strategy for low confidence results
    strategies.set('low_confidence', {
      description: 'Improve confidence through validation and coordination',
      conditions: ['confidence < 0.7'],
      actions: ['apply_additional_validation', 'request_peer_review', 'use_fallback_patterns']
    });

    this.adaptiveStrategies = strategies;
  }

  // Helper methods for content analysis and extraction
  private calculateHierarchyDepth($: cheerio.CheerioAPI): number {
    let maxDepth = 0;
    
    const calculateDepth = (element: any, currentDepth: number) => {
      maxDepth = Math.max(maxDepth, currentDepth);
      $(element).children().each((_, child) => {
        calculateDepth(child, currentDepth + 1);
      });
    };

    $('body').children().each((_, element) => {
      calculateDepth(element, 1);
    });

    return maxDepth;
  }

  private calculateTextDensity($: cheerio.CheerioAPI): number {
    const textNodes = $('*').contents().filter(function() {
      return this.type === 'text' && $(this).text().trim().length > 0;
    });
    
    const totalElements = $('*').length;
    return totalElements > 0 ? textNodes.length / totalElements : 0;
  }

  private calculateComplexity(structure: ContentStructure, content: string): number {
    let complexity = 0;
    
    // Add complexity based on structure
    if (structure.hasTable) complexity += 0.2;
    if (structure.hasForm) complexity += 0.1;
    if (structure.hasCode) complexity += 0.3;
    if (structure.hasStructuredData) complexity += 0.2;
    
    // Add complexity based on hierarchy depth
    complexity += Math.min(structure.hierarchyDepth / 10, 0.3);
    
    // Add complexity based on content length
    complexity += Math.min(content.length / 50000, 0.2);
    
    return Math.min(complexity, 1.0);
  }

  private calculateExtractability(structure: ContentStructure, context: ExtractionContext): number {
    let extractability = 0.5; // Base extractability
    
    // Improve extractability based on structure
    if (structure.hasStructuredData) extractability += 0.3;
    if (structure.hasTable) extractability += 0.2;
    if (structure.hasCode && context.extractionGoal.includes('code')) extractability += 0.2;
    
    // Adjust based on text density
    extractability += structure.textDensity * 0.2;
    
    return Math.min(extractability, 1.0);
  }

  private recommendPatterns(structure: ContentStructure, context: ExtractionContext): string[] {
    const recommendations: string[] = [];
    
    if (context.domain.includes('stackoverflow')) {
      recommendations.push('stackoverflow-answer');
    }
    
    if (context.domain.includes('github')) {
      recommendations.push('github-issue');
    }
    
    if (structure.hasCode) {
      recommendations.push('code-extraction');
    }
    
    if (context.extractionGoal.includes('documentation')) {
      recommendations.push('documentation');
    }
    
    if (context.extractionGoal.includes('error')) {
      recommendations.push('error-message');
    }
    
    return recommendations;
  }

  private identifyChallenges(structure: ContentStructure, context: ExtractionContext): string[] {
    const challenges: string[] = [];
    
    if (structure.hierarchyDepth > 10) {
      challenges.push('complex_hierarchy');
    }
    
    if (structure.textDensity < 0.3) {
      challenges.push('low_text_density');
    }
    
    if (!structure.hasStructuredData) {
      challenges.push('no_structured_data');
    }
    
    return challenges;
  }

  private identifyOpportunities(structure: ContentStructure, context: ExtractionContext): string[] {
    const opportunities: string[] = [];
    
    if (structure.hasStructuredData) {
      opportunities.push('structured_data_extraction');
    }
    
    if (structure.hasTable) {
      opportunities.push('table_data_extraction');
    }
    
    if (structure.hasCode) {
      opportunities.push('code_snippet_extraction');
    }
    
    return opportunities;
  }

  private isPatternApplicable(pattern: ExtractionPattern, context: ExtractionContext, contentAnalysis: ContentAnalysisResult): boolean {
    // Check domain applicability
    if (pattern.applicableDomains.length > 0 && !pattern.applicableDomains.includes('*')) {
      const domainMatch = pattern.applicableDomains.some(domain => 
        context.domain.includes(domain) || domain.includes(context.domain)
      );
      if (!domainMatch) return false;
    }

    // Check content type applicability
    if (!pattern.applicableContentTypes.includes(context.contentType)) {
      return false;
    }

    // Check pattern confidence threshold
    return pattern.confidence >= context.confidenceThreshold * 0.5; // Allow some flexibility
  }

  private calculateRelevanceScore(pattern: ExtractionPattern, context: ExtractionContext): number {
    let score = 0.5; // Base score
    
    // Domain relevance
    if (pattern.applicableDomains.includes('*')) {
      score += 0.1;
    } else if (pattern.applicableDomains.some(domain => context.domain.includes(domain))) {
      score += 0.3;
    }
    
    // Content type relevance
    if (pattern.applicableContentTypes.includes(context.contentType)) {
      score += 0.2;
    }
    
    // Goal relevance
    if (pattern.name.toLowerCase().includes(context.extractionGoal.toLowerCase())) {
      score += 0.2;
    }
    
    return Math.min(score, 1.0);
  }

  private extractFieldValue(elements: cheerio.Cheerio<cheerio.Element>, field: ExtractionField): any {
    const element = elements.first();
    
    switch (field.type) {
      case 'text':
        return element.text().trim();
      case 'number':
        const numText = element.text().trim();
        const num = parseFloat(numText.replace(/[^\d.-]/g, ''));
        return isNaN(num) ? null : num;
      case 'url':
        return element.attr('href') || element.text().trim();
      case 'boolean':
        return element.length > 0;
      case 'code':
        return element.text().trim();
      case 'structured':
        return this.extractStructuredData(element);
      default:
        return element.text().trim();
    }
  }

  private extractStructuredData(element: cheerio.Cheerio<any>): any {
    const data: any = {};
    
    // Extract itemscope data
    if (element.attr('itemscope')) {
      const itemType = element.attr('itemtype');
      if (itemType) {
        data.type = itemType;
      }
      
      const properties: any = {};
      element.find('[itemprop]').each((_, propElement) => {
        const $propElement = element.constructor(propElement);
        const propName = $propElement.attr('itemprop');
        const propValue = $propElement.text().trim();
        if (propName) {
          properties[propName] = propValue;
        }
      });
      
      data.properties = properties;
    }
    
    return data;
  }

  private extractSemanticEntities(content: string, context: ExtractionContext): SemanticEntity[] {
    const entities: SemanticEntity[] = [];
    
    // Extract technology entities
    const techPatterns = [
      /\b(JavaScript|TypeScript|Python|Java|C\+\+|C#|Ruby|Go|Rust|PHP|Swift|Kotlin)\b/gi,
      /\b(React|Angular|Vue|Node\.js|Express|Django|Flask|Spring|Rails|Laravel)\b/gi,
      /\b(AWS|Azure|Google Cloud|Docker|Kubernetes|Git|GitHub|GitLab)\b/gi
    ];
    
    for (const pattern of techPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        for (const match of matches) {
          entities.push({
            text: match,
            type: 'technology',
            confidence: 0.8,
            context: this.extractEntityContext(content, match),
            relationships: []
          });
        }
      }
    }
    
    // Extract error entities
    const errorPattern = /\b(\w+Error|\w+Exception|Error:\s*.*|Exception:\s*.*)\b/gi;
    const errorMatches = content.match(errorPattern);
    if (errorMatches) {
      for (const match of errorMatches) {
        entities.push({
          text: match,
          type: 'error',
          confidence: 0.9,
          context: this.extractEntityContext(content, match),
          relationships: []
        });
      }
    }
    
    return entities;
  }

  private extractEntityContext(content: string, entity: string): string {
    const index = content.indexOf(entity);
    if (index === -1) return '';
    
    const start = Math.max(0, index - 50);
    const end = Math.min(content.length, index + entity.length + 50);
    
    return content.substring(start, end);
  }

  private extractRelationships(content: string, entities: SemanticEntity[]): DataRelationship[] {
    const relationships: DataRelationship[] = [];
    
    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const entity1 = entities[i];
        const entity2 = entities[j];
        
        // Check if entities are related
        if (this.areEntitiesRelated(entity1, entity2, content)) {
          relationships.push({
            type: 'reference',
            target: entity2.text,
            confidence: 0.7,
            description: `${entity1.text} is related to ${entity2.text}`
          });
        }
      }
    }
    
    return relationships;
  }

  private areEntitiesRelated(entity1: SemanticEntity, entity2: SemanticEntity, content: string): boolean {
    // Simple proximity-based relationship detection
    const index1 = content.indexOf(entity1.text);
    const index2 = content.indexOf(entity2.text);
    
    if (index1 === -1 || index2 === -1) return false;
    
    const distance = Math.abs(index1 - index2);
    return distance < 200; // Entities within 200 characters are considered related
  }

  private generateSemanticTags(content: string, context: ExtractionContext, entities: SemanticEntity[]): string[] {
    const tags: string[] = [];
    
    // Add tags based on extraction goal
    if (context.extractionGoal.includes('error')) {
      tags.push('error_analysis');
    }
    
    if (context.extractionGoal.includes('solution')) {
      tags.push('solution_extraction');
    }
    
    if (context.extractionGoal.includes('code')) {
      tags.push('code_extraction');
    }
    
    // Add tags based on entities
    const techEntities = entities.filter(e => e.type === 'technology');
    if (techEntities.length > 0) {
      tags.push('technical_content');
    }
    
    const errorEntities = entities.filter(e => e.type === 'error');
    if (errorEntities.length > 0) {
      tags.push('error_content');
    }
    
    return tags;
  }

  private calculateContentRelevanceScore(content: string, context: ExtractionContext): number {
    let score = 0.5; // Base score
    
    // Check for goal-related keywords
    const goalKeywords = context.extractionGoal.toLowerCase().split(' ');
    const contentLower = content.toLowerCase();
    
    for (const keyword of goalKeywords) {
      if (contentLower.includes(keyword)) {
        score += 0.1;
      }
    }
    
    // Check for domain-specific content
    if (contentLower.includes(context.domain)) {
      score += 0.2;
    }
    
    return Math.min(score, 1.0);
  }

  private extractMainTopic(content: string, context: ExtractionContext): string {
    // Simple topic extraction based on frequent words
    const words = content.toLowerCase().match(/\b\w+\b/g) || [];
    const wordCount = new Map<string, number>();
    
    // Count word frequency
    for (const word of words) {
      if (word.length > 3) { // Ignore short words
        wordCount.set(word, (wordCount.get(word) || 0) + 1);
      }
    }
    
    // Find most frequent word
    let maxCount = 0;
    let mainTopic = '';
    
    for (const [word, count] of wordCount.entries()) {
      if (count > maxCount) {
        maxCount = count;
        mainTopic = word;
      }
    }
    
    return mainTopic;
  }

  private extractSubTopics(content: string, context: ExtractionContext): string[] {
    // Extract subtopics based on headers and frequent phrases
    const $ = cheerio.load(content);
    const headers = $('h1, h2, h3, h4, h5, h6').map((_, el) => $(el).text().trim()).get();
    
    return headers.slice(0, 5); // Return top 5 subtopics
  }

  private calculateSentiment(content: string): number {
    // Simple sentiment analysis
    const positiveWords = ['good', 'great', 'excellent', 'awesome', 'perfect', 'works', 'solved', 'fixed'];
    const negativeWords = ['bad', 'terrible', 'awful', 'broken', 'error', 'failed', 'wrong', 'issue'];
    
    const words = content.toLowerCase().split(/\s+/);
    let positiveCount = 0;
    let negativeCount = 0;
    
    for (const word of words) {
      if (positiveWords.includes(word)) positiveCount++;
      if (negativeWords.includes(word)) negativeCount++;
    }
    
    const totalSentimentWords = positiveCount + negativeCount;
    if (totalSentimentWords === 0) return 0;
    
    return (positiveCount - negativeCount) / totalSentimentWords;
  }

  private calculateContentComplexity(content: string): number {
    let complexity = 0;
    
    // Add complexity based on length
    complexity += Math.min(content.length / 10000, 0.3);
    
    // Add complexity based on technical terms
    const techTerms = content.match(/\b(function|class|interface|async|await|promise|callback|API|HTTP|JSON|XML|SQL|database|server|client|framework|library|algorithm|data structure)\b/gi);
    if (techTerms) {
      complexity += Math.min(techTerms.length / 50, 0.3);
    }
    
    // Add complexity based on code blocks
    const codeBlocks = content.match(/```[\s\S]*?```|`[^`]+`/g);
    if (codeBlocks) {
      complexity += Math.min(codeBlocks.length / 10, 0.2);
    }
    
    return Math.min(complexity, 1.0);
  }

  private calculateReadability(content: string): number {
    // Simple readability score based on sentence length and word complexity
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = content.split(/\s+/).filter(w => w.trim().length > 0);
    
    if (sentences.length === 0 || words.length === 0) return 0;
    
    const avgSentenceLength = words.length / sentences.length;
    const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / words.length;
    
    // Lower score for longer sentences and words (less readable)
    const readability = Math.max(0, 1 - (avgSentenceLength / 20) - (avgWordLength / 10));
    
    return Math.min(readability, 1.0);
  }

  private calculateTechnicalLevel(content: string): number {
    const technicalTerms = [
      'algorithm', 'data structure', 'API', 'framework', 'library', 'database',
      'server', 'client', 'HTTP', 'JSON', 'XML', 'SQL', 'async', 'await',
      'promise', 'callback', 'function', 'class', 'interface', 'inheritance',
      'polymorphism', 'encapsulation', 'abstraction', 'recursion', 'iteration'
    ];
    
    const contentLower = content.toLowerCase();
    const matchedTerms = technicalTerms.filter(term => contentLower.includes(term));
    
    return Math.min(matchedTerms.length / 10, 1.0);
  }

  private calculateRelevanceToGoal(content: string, context: ExtractionContext): number {
    const goalWords = context.extractionGoal.toLowerCase().split(/\s+/);
    const contentLower = content.toLowerCase();
    
    const matchedWords = goalWords.filter(word => contentLower.includes(word));
    
    return goalWords.length > 0 ? matchedWords.length / goalWords.length : 0;
  }

  private calculateQualityScore(result: ExtractionResult): number {
    let score = 0;
    
    // Score based on data completeness
    const dataKeys = Object.keys(result.extractedData.structured);
    score += Math.min(dataKeys.length / 5, 0.3);
    
    // Score based on validation results
    const passedValidations = result.validationResults.filter(v => v.passed).length;
    const totalValidations = result.validationResults.length;
    if (totalValidations > 0) {
      score += (passedValidations / totalValidations) * 0.3;
    }
    
    // Score based on pattern matches
    if (result.patternMatches.length > 0) {
      const avgPatternConfidence = result.patternMatches.reduce((sum, match) => sum + match.matchConfidence, 0) / result.patternMatches.length;
      score += avgPatternConfidence * 0.4;
    }
    
    return Math.min(score, 1.0);
  }

  private calculateEfficiencyScore(result: ExtractionResult): number {
    const totalTime = result.performanceMetrics.totalTime;
    const dataExtracted = Object.keys(result.extractedData.structured).length;
    
    if (totalTime === 0 || dataExtracted === 0) return 0;
    
    // Higher score for more data extracted in less time
    return Math.min(dataExtracted / (totalTime / 1000), 1.0);
  }

  private extractCodeSnippets(content: string): string[] {
    const codeBlocks = content.match(/```[\s\S]*?```/g) || [];
    const inlineCode = content.match(/`[^`]+`/g) || [];
    
    return [...codeBlocks, ...inlineCode].map(code => code.replace(/`/g, '').trim());
  }

  private extractTechnicalConcepts(content: string, context: ExtractionContext): string[] {
    const concepts: string[] = [];
    
    // Extract programming concepts
    const conceptPatterns = [
      /\b(object[-\s]?oriented|functional|procedural|declarative|imperative)\s+programming\b/gi,
      /\b(design\s+pattern|singleton|factory|observer|decorator|strategy)\b/gi,
      /\b(algorithm|data\s+structure|array|linked\s+list|tree|graph|hash\s+table)\b/gi,
      /\b(recursion|iteration|loop|conditional|branching)\b/gi
    ];
    
    for (const pattern of conceptPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        concepts.push(...matches);
      }
    }
    
    return concepts;
  }

  private extractSolutions(content: string, context: ExtractionContext): string[] {
    const solutions: string[] = [];
    
    // Extract solution indicators
    const solutionPatterns = [
      /solution:\s*(.+?)(?:\n|$)/gi,
      /fix:\s*(.+?)(?:\n|$)/gi,
      /answer:\s*(.+?)(?:\n|$)/gi,
      /resolved:\s*(.+?)(?:\n|$)/gi,
      /working:\s*(.+?)(?:\n|$)/gi
    ];
    
    for (const pattern of solutionPatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) {
          solutions.push(match[1].trim());
        }
      }
    }
    
    return solutions;
  }

  private extractAPIEndpoints(content: string): string[] {
    const endpoints: string[] = [];
    
    // Extract API endpoints
    const endpointPatterns = [
      /https?:\/\/[^\s]+\/api\/[^\s]+/gi,
      /\/api\/[^\s]+/gi,
      /GET|POST|PUT|DELETE|PATCH\s+([^\s]+)/gi
    ];
    
    for (const pattern of endpointPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        endpoints.push(...matches);
      }
    }
    
    return endpoints;
  }

  private extractHTTPMethods(content: string): string[] {
    const methods = content.match(/\b(GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD)\b/gi) || [];
    return [...new Set(methods)]; // Remove duplicates
  }

  private async generateMetadata(content: string | Buffer, context: ExtractionContext): Promise<DataMetadata> {
    const contentStr = content.toString();
    
    return {
      source: context.domain,
      extractionMethod: 'intelligent_extractor',
      contentHash: this.generateContentHash(contentStr),
      extractionTimestamp: Date.now(),
      contentLength: contentStr.length,
      encoding: 'utf-8'
    };
  }

  private generateContentHash(content: string): string {
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
  }

  private generateCacheKey(content: string | Buffer, context: ExtractionContext): string {
    const contentStr = content.toString();
    const hash = this.generateContentHash(contentStr);
    return `${context.extractionGoal}-${context.contentType}-${hash}`;
  }

  // Public methods for external access
  async addPattern(pattern: ExtractionPattern): Promise<void> {
    this.patterns.set(pattern.id, pattern);
    logger.info(`✅ Added extraction pattern: ${pattern.name}`);
  }

  async removePattern(patternId: string): Promise<boolean> {
    const removed = this.patterns.delete(patternId);
    if (removed) {
      logger.info(`🗑️ Removed extraction pattern: ${patternId}`);
    }
    return removed;
  }

  async getPatterns(): Promise<ExtractionPattern[]> {
    return Array.from(this.patterns.values());
  }

  async getPattern(patternId: string): Promise<ExtractionPattern | undefined> {
    return this.patterns.get(patternId);
  }

  async updatePattern(patternId: string, updates: Partial<ExtractionPattern>): Promise<boolean> {
    const pattern = this.patterns.get(patternId);
    if (!pattern) return false;
    
    Object.assign(pattern, updates);
    this.patterns.set(patternId, pattern);
    
    logger.info(`🔄 Updated extraction pattern: ${pattern.name}`);
    return true;
  }

  async getExtractionHistory(sessionId?: string): Promise<ExtractionResult[]> {
    try {
      let query = this.supabase.from('extraction_knowledge').select('*');
      
      if (sessionId) {
        query = query.eq('session_id', sessionId);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false }).limit(100);
      
      if (error) {
        logger.error('Failed to fetch extraction history:', error);
        return [];
      }
      
      return data || [];
    } catch (error) {
      logger.error('Extraction history fetch error:', error);
      return [];
    }
  }

  async getPerformanceMetrics(): Promise<Record<string, any>> {
    const metrics: Record<string, any> = {};
    
    // Pattern performance metrics
    metrics.patterns = {};
    for (const [id, pattern] of this.patterns.entries()) {
      metrics.patterns[id] = {
        name: pattern.name,
        confidence: pattern.confidence,
        successCount: pattern.evolutionData.successCount,
        failureCount: pattern.evolutionData.failureCount,
        performance: pattern.evolutionData.performanceMetrics
      };
    }
    
    // Cache metrics
    metrics.cache = {
      size: this.patternCache.size,
      hitRate: this.calculateCacheHitRate()
    };
    
    // Learning metrics
    metrics.learning = {
      patternsEvolved: this.countEvolvedPatterns(),
      adaptiveStrategies: this.adaptiveStrategies.size,
      knowledgeBase: this.learningKnowledge.size
    };
    
    return metrics;
  }

  private calculateCacheHitRate(): number {
    // This would need to be tracked during actual usage
    return 0.75; // Placeholder
  }

  private countEvolvedPatterns(): number {
    return Array.from(this.patterns.values()).filter(p => p.evolutionData.adaptations.length > 0).length;
  }

  async clearCache(): Promise<void> {
    this.patternCache.clear();
    logger.info('🧹 Extraction cache cleared');
  }

  async exportPatterns(): Promise<string> {
    const patterns = Array.from(this.patterns.values());
    return JSON.stringify(patterns, null, 2);
  }

  async importPatterns(patternsJson: string): Promise<number> {
    try {
      const patterns = JSON.parse(patternsJson) as ExtractionPattern[];
      let imported = 0;
      
      for (const pattern of patterns) {
        this.patterns.set(pattern.id, pattern);
        imported++;
      }
      
      logger.info(`📥 Imported ${imported} extraction patterns`);
      return imported;
    } catch (error) {
      logger.error('Failed to import patterns:', error);
      return 0;
    }
  }

  async shutdown(): Promise<void> {
    logger.info('🔥 Shutting down Intelligent Extractor...');
    
    // Clear caches and maps
    this.patternCache.clear();
    this.learningKnowledge.clear();
    this.coordinationNetwork.clear();
    this.performanceMetrics.clear();
    this.adaptiveStrategies.clear();
    
    logger.info('🔥 Intelligent Extractor shutdown complete');
  }
}

// Export utility functions for external use
export const extractionUtils = {
  createContext: (
    sessionId: string,
    agentId: string,
    taskId: string,
    domain: string,
    contentType: ExtractionContext['contentType'],
    extractionGoal: string,
    options: Partial<ExtractionContext> = {}
  ): ExtractionContext => ({
    sessionId,
    agentId,
    taskId,
    domain,
    contentType,
    extractionGoal,
    confidenceThreshold: options.confidenceThreshold ?? 0.7,
    maxRetries: options.maxRetries ?? 3,
    coordinationEnabled: options.coordinationEnabled ?? true,
    learningEnabled: options.learningEnabled ?? true
  }),

  createPattern: (
    id: string,
    name: string,
    type: ExtractionPattern['type'],
    pattern: string,
    fields: ExtractionField[],
    options: Partial<ExtractionPattern> = {}
  ): ExtractionPattern => ({
    id,
    name,
    type,
    pattern,
    confidence: options.confidence ?? 0.8,
    applicableDomains: options.applicableDomains ?? ['*'],
    applicableContentTypes: options.applicableContentTypes ?? ['html'],
    extractionFields: fields,
    validationRules: options.validationRules ?? [],
    learningEnabled: options.learningEnabled ?? true,
    evolutionData: {
      successCount: 0,
      failureCount: 0,
      lastUpdated: Date.now(),
      adaptations: [],
      performanceMetrics: {
        averageExtractionTime: 0,
        accuracyRate: 0,
        falsePositiveRate: 0,
        falseNegativeRate: 0,
        adaptationEffectiveness: 0,
        coordinationBenefit: 0
      },
      learningHistory: []
    }
  })
};

// Example usage:
// const extractor = new IntelligentExtractor({
//   defaultConfidenceThreshold: 0.8,
//   enableLearning: true,
//   enableCoordination: true,
//   enableSemanticAnalysis: true
// });
// 
// const context = extractionUtils.createContext(
//   'session-123',
//   'agent-research-001',
//   'task-extract-solution',
//   'stackoverflow.com',
//   'html',
//   'extract solution for TypeScript error'
// );
// 
// const result = await extractor.extract(htmlContent, context, page);
// console.log(result.extractedData.structured);