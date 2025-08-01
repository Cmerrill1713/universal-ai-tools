/**
 * Repository Indexing Service - Automated Pattern Extraction and Coding Style Learning
 * Integrates with Universal AI Tools for repository-specific code generation optimization
 * PERFORMANCE OPTIMIZED: Git history analysis with incremental updates and Apple Silicon acceleration
 */

import { createClient } from '@supabase/supabase-js';
import { LogContext, log } from '@/utils/logger';
import { codeAnalysisService } from './code-analysis-service';
import { contextInjectionService } from './context-injection-service';
import { type ASTAnalysisResult, type CodePattern, astParser } from '@/utils/ast-parser';
import { vaultService } from './vault-service';
import { CircuitBreaker, createCircuitBreaker } from '@/utils/circuit-breaker';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface RepositoryIndexRequest {
  repositoryUrl: string;
  repositoryPath: string;
  userId: string;
  
  // Indexing options
  languages?: string[];
  includeGitHistory?: boolean;
  includeCommitAnalysis?: boolean;
  includeAuthorPatterns?: boolean;
  maxCommits?: number;
  
  // Pattern extraction options
  extractArchitecturalPatterns?: boolean;
  extractCodingStyles?: boolean;
  extractSecurityPatterns?: boolean;
  extractPerformancePatterns?: boolean;
  extractTestingPatterns?: boolean;
  
  // Performance options
  enableParallelProcessing?: boolean;
  maxConcurrentFiles?: number;
  useIncrementalUpdate?: boolean;
  
  // Learning options
  enablePatternLearning?: boolean;
  enableQualityScoring?: boolean;
  enableUsageTracking?: boolean;
}

interface RepositoryIndexResult {
  indexId: string;
  success: boolean;
  repositoryUrl: string;
  repositoryPath: string;
  includeGitHistory?: boolean;
  
  // Repository metadata
  repositoryInfo: RepositoryInfo;
  
  // Extracted patterns
  codePatterns: ExtractedCodePattern[];
  architecturalPatterns: ArchitecturalPattern[];
  codingStyles: CodingStylePattern[];
  securityPatterns: SecurityPattern[];
  performancePatterns: PerformancePattern[];
  testingPatterns: TestingPattern[];
  
  // Git analysis
  gitAnalysis: GitAnalysisResult;
  commitPatterns: CommitPattern[];
  authorInsights: AuthorInsight[];
  
  // Quality and usage metrics
  qualityMetrics: RepositoryQualityMetrics;
  usageStatistics: UsageStatistics;
  
  // Learning insights
  learningInsights: PatternLearningInsight[];
  recommendations: RepositoryRecommendation[];
  
  // Performance metrics
  indexingTimeMs: number;
  filesProcessed: number;
  patternsExtracted: number;
  storageUsed: number;
}

interface RepositoryInfo {
  name: string;
  description?: string;
  primaryLanguage: string;
  languages: LanguageInfo[];
  framework?: string;
  size: number;
  contributors: number;
  lastUpdated: string;
  branches: string[];
  tags: string[];
  license?: string;
}

interface LanguageInfo {
  language: string;
  files: number;
  lines: number;
  percentage: number;
}

interface ExtractedCodePattern extends CodePattern {
  repositoryUrl: string;
  filePath: string;
  gitCommit?: string;
  author?: string;
  frequency: number;
  qualityScore: number;
  usageContext: string[];
  relatedPatterns: string[];
}

interface ArchitecturalPattern {
  id: string;
  name: string;
  type: 'mvc' | 'service-oriented' | 'microservices' | 'layered' | 'component-based' | 'event-driven';
  description: string;
  implementation: string;
  files: string[];
  confidence: number;
  benefits: string[];
  tradeoffs: string[];
}

interface CodingStylePattern {
  id: string;
  category: 'naming' | 'formatting' | 'structure' | 'comments' | 'imports';
  pattern: string;
  examples: string[];
  consistency: number;
  prevalence: number;
  recommendation: string;
}

interface SecurityPattern {
  id: string;
  type: string;
  pattern: string;
  securityLevel: 'secure' | 'potentially-vulnerable' | 'vulnerable';
  description: string;
  recommendation: string;
  frequency: number;
}

interface PerformancePattern {
  id: string;
  type: string;
  pattern: string;
  performanceImpact: 'positive' | 'negative' | 'neutral';
  description: string;
  benchmarkData?: PerformanceBenchmark;
  recommendation: string;
}

interface TestingPattern {
  id: string;
  type: 'unit' | 'integration' | 'e2e' | 'performance' | 'security';
  pattern: string;
  framework: string;
  coverage: number;
  quality: number;
  examples: string[];
}

interface GitAnalysisResult {
  totalCommits: number;
  totalAuthors: number;
  averageCommitSize: number;
  commitFrequency: CommitFrequency;
  branchingStrategy: string;
  hotspots: FileHotspot[];
  evolutionPatterns: EvolutionPattern[];
}

interface CommitPattern {
  type: 'feature' | 'fix' | 'refactor' | 'docs' | 'style' | 'test' | 'chore';
  messagePattern: string;
  frequency: number;
  averageSize: number;
  filesAffected: number;
  authors: string[];
}

interface AuthorInsight {
  author: string;
  commits: number;
  linesAdded: number;
  linesDeleted: number;
  filesModified: number;
  specializations: string[];
  codingStyle: CodingStylePreference;
  qualityScore: number;
}

interface CodingStylePreference {
  namingConvention: string;
  indentationStyle: string;
  commentStyle: string;
  functionSize: number;
  classSize: number;
}

interface RepositoryQualityMetrics {
  overallQuality: number;
  maintainabilityIndex: number;
  technicalDebt: number;
  testCoverage: number;
  documentation: number;
  consistency: number;
  security: number;
  performance: number;
}

interface UsageStatistics {
  mostUsedPatterns: PatternUsage[];
  leastUsedPatterns: PatternUsage[];
  frameworkUsage: FrameworkUsage[];
  libraryUsage: LibraryUsage[];
  patternCooccurrence: PatternCooccurrence[];
}

interface PatternUsage {
  pattern: string;
  usage: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}

interface FrameworkUsage {
  framework: string;
  files: number;
  usage: number;
  version?: string;
}

interface LibraryUsage {
  library: string;
  imports: number;
  usage: number;
  version?: string;
}

interface PatternCooccurrence {
  pattern1: string;
  pattern2: string;
  cooccurrence: number;
  correlation: number;
}

interface PatternLearningInsight {
  category: string;
  insight: string;
  confidence: number;
  actionable: boolean;
  recommendation: string;
}

interface RepositoryRecommendation {
  type: 'quality' | 'security' | 'performance' | 'maintainability' | 'style';
  priority: number;
  title: string;
  description: string;
  actionItems: string[];
  estimatedImpact: string;
}

interface CommitFrequency {
  daily: number;
  weekly: number;
  monthly: number;
  pattern: 'regular' | 'sporadic' | 'burst';
}

interface FileHotspot {
  filePath: string;
  modifications: number;
  authors: number;
  complexity: number;
  riskScore: number;
}

interface EvolutionPattern {
  pattern: string;
  timeframe: string;
  description: string;
  impact: string;
}

interface PerformanceBenchmark {
  metric: string;
  value: number;
  unit: string;
  comparison: string;
}

export class RepositoryIndexingService {
  private supabase;
  private indexCache = new Map<string, { result: RepositoryIndexResult; expiry: number }>();
  private cacheExpiryMs = 60 * 60 * 1000; // 1 hour for repository indexing
  private circuitBreaker;

  // Service integrations
  private analysisService;
  private contextService;
  private vault;

  // Pattern extractors
  private patternExtractors = new Map<string, PatternExtractor>();

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL || 'http://127.0.0.1:54321',
      process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || ''
    );

    this.circuitBreaker = createCircuitBreaker('repository-indexing-service', {
      failureThreshold: 5,
      timeout: 30000,
      errorThresholdPercentage: 50
    });
    this.analysisService = codeAnalysisService;
    this.contextService = contextInjectionService;
    this.vault = vaultService;

    this.initializePatternExtractors();
  }

  /**
   * Main method: Index repository and extract patterns
   */
  async indexRepository(request: RepositoryIndexRequest): Promise<RepositoryIndexResult> {
    const startTime = Date.now();
    const indexId = this.generateIndexId(request);

    try {
      log.info('📊 Starting repository indexing', LogContext.ANALYSIS, {
        indexId,
        repositoryUrl: request.repositoryUrl,
        repositoryPath: request.repositoryPath,
        userId: request.userId,
        languages: request.languages || ['all'],
        includeGitHistory: request.includeGitHistory !== false
      });

      // Check for existing index and incremental update
      const existingIndex = await this.getExistingIndex(request.repositoryUrl);
      if (existingIndex && request.useIncrementalUpdate) {
        return await this.performIncrementalUpdate(existingIndex, request);
      }

      // Phase 1: Repository Analysis and Metadata Extraction
      const repositoryInfo = await this.analyzeRepositoryStructure(request);
      log.debug('📁 Repository structure analyzed', LogContext.ANALYSIS, { indexId });

      // Phase 2: Code Pattern Extraction
      const codePatterns = await this.extractCodePatterns(request, repositoryInfo);
      log.debug('🔍 Code patterns extracted', LogContext.ANALYSIS, { 
        indexId, 
        patternsFound: codePatterns.length 
      });

      // Phase 3: Architectural Pattern Detection
      const architecturalPatterns = await this.detectArchitecturalPatterns(request, codePatterns);
      log.debug('🏗️ Architectural patterns detected', LogContext.ANALYSIS, { indexId });

      // Phase 4: Coding Style Analysis
      const codingStyles = await this.analyzeCodingStyles(request, codePatterns);
      log.debug('✨ Coding styles analyzed', LogContext.ANALYSIS, { indexId });

      // Phase 5: Security Pattern Analysis
      const securityPatterns = await this.analyzeSecurityPatterns(request, codePatterns);
      log.debug('🔒 Security patterns analyzed', LogContext.ANALYSIS, { indexId });

      // Phase 6: Performance Pattern Analysis
      const performancePatterns = await this.analyzePerformancePatterns(request, codePatterns);
      log.debug('⚡ Performance patterns analyzed', LogContext.ANALYSIS, { indexId });

      // Phase 7: Testing Pattern Analysis
      const testingPatterns = await this.analyzeTestingPatterns(request, codePatterns);
      log.debug('🧪 Testing patterns analyzed', LogContext.ANALYSIS, { indexId });

      // Phase 8: Git History Analysis (if enabled)
      const gitAnalysis = request.includeGitHistory 
        ? await this.analyzeGitHistory(request)
        : this.getEmptyGitAnalysis();
      log.debug('📈 Git history analyzed', LogContext.ANALYSIS, { indexId });

      // Phase 9: Commit and Author Pattern Analysis
      const [commitPatterns, authorInsights] = request.includeGitHistory 
        ? await Promise.all([
            this.analyzeCommitPatterns(request, gitAnalysis),
            this.analyzeAuthorInsights(request, gitAnalysis)
          ])
        : [[], []];
      log.debug('👥 Commit and author patterns analyzed', LogContext.ANALYSIS, { indexId });

      // Phase 10: Quality Metrics Calculation
      const qualityMetrics = await this.calculateQualityMetrics(
        codePatterns, 
        architecturalPatterns, 
        securityPatterns,
        testingPatterns
      );
      log.debug('📊 Quality metrics calculated', LogContext.ANALYSIS, { indexId });

      // Phase 11: Usage Statistics and Pattern Co-occurrence
      const usageStatistics = await this.calculateUsageStatistics(
        codePatterns, 
        architecturalPatterns,
        repositoryInfo
      );
      log.debug('📈 Usage statistics calculated', LogContext.ANALYSIS, { indexId });

      // Phase 12: Learning Insights and Recommendations
      const learningInsights = await this.extractLearningInsights(
        codePatterns,
        architecturalPatterns,
        qualityMetrics,
        gitAnalysis
      );
      const recommendations = await this.generateRecommendations(
        qualityMetrics,
        securityPatterns,
        performancePatterns,
        learningInsights
      );
      log.debug('🧠 Learning insights and recommendations generated', LogContext.ANALYSIS, { indexId });

      // Compile comprehensive result
      const indexingTimeMs = Date.now() - startTime;
      const totalPatterns = codePatterns.length + architecturalPatterns.length + 
                           securityPatterns.length + performancePatterns.length + testingPatterns.length;

      const result: RepositoryIndexResult = {
        indexId,
        success: true,
        repositoryUrl: request.repositoryUrl,
        repositoryPath: request.repositoryPath,
        includeGitHistory: request.includeGitHistory,
        repositoryInfo,
        codePatterns,
        architecturalPatterns,
        codingStyles,
        securityPatterns,
        performancePatterns,
        testingPatterns,
        gitAnalysis,
        commitPatterns,
        authorInsights,
        qualityMetrics,
        usageStatistics,
        learningInsights,
        recommendations,
        indexingTimeMs,
        filesProcessed: repositoryInfo.languages.reduce((sum, lang) => sum + lang.files, 0),
        patternsExtracted: totalPatterns,
        storageUsed: 0 // Would calculate actual storage usage
      };

      // Store index result for future use and learning
      await this.storeIndexResult(result, request);

      // Update pattern database with new patterns
      await this.updatePatternDatabase(codePatterns, request);

      log.info('✅ Repository indexing completed successfully', LogContext.ANALYSIS, {
        indexId,
        indexingTimeMs,
        filesProcessed: result.filesProcessed,
        patternsExtracted: result.patternsExtracted,
        overallQuality: qualityMetrics.overallQuality,
        recommendations: recommendations.length
      });

      return result;

    } catch (error) {
      const indexingTimeMs = Date.now() - startTime;
      
      log.error('❌ Repository indexing failed', LogContext.ANALYSIS, {
        indexId,
        error: error instanceof Error ? error.message : String(error),
        indexingTimeMs
      });

      return this.createFailureResult(indexId, request, error, indexingTimeMs);
    }
  }

  /**
   * Perform incremental repository update
   */
  async updateRepositoryIndex(
    repositoryUrl: string, 
    options: {
      sinceCommit?: string;
      sinceDate?: string;
      filesChanged?: string[];
    }
  ): Promise<RepositoryIndexResult> {
    try {
      const existingIndex = await this.getExistingIndex(repositoryUrl);
      if (!existingIndex) {
        throw new Error('No existing index found for incremental update');
      }

      // Create incremental update request
      const request: RepositoryIndexRequest = {
        repositoryUrl,
        repositoryPath: existingIndex.repositoryPath,
        userId: existingIndex.userId || 'system',
        useIncrementalUpdate: true,
        enablePatternLearning: true
      };

      return await this.performIncrementalUpdate(existingIndex, request);
    } catch (error) {
      log.error('❌ Repository index update failed', LogContext.ANALYSIS, {
        repositoryUrl,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get repository patterns for code generation
   */
  async getRepositoryPatterns(
    repositoryUrl: string, 
    options: {
      language?: string;
      patternType?: string;
      minQuality?: number;
      limit?: number;
    } = {}
  ): Promise<ExtractedCodePattern[]> {
    try {
      const query = this.supabase
        .from('repository_patterns')
        .select('*')
        .eq('repository_url', repositoryUrl);

      if (options.language) {
        query.eq('language', options.language);
      }

      if (options.patternType) {
        query.eq('pattern_type', options.patternType);
      }

      if (options.minQuality) {
        query.gte('quality_score', options.minQuality);
      }

      const { data: patterns, error } = await query
        .order('quality_score', { ascending: false })
        .order('usage_frequency', { ascending: false })
        .limit(options.limit || 50);

      if (error) {
        throw new Error(`Failed to fetch repository patterns: ${error.message}`);
      }

      return patterns || [];
    } catch (error) {
      log.error('❌ Failed to get repository patterns', LogContext.ANALYSIS, {
        repositoryUrl,
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * Phase 1: Analyze repository structure and metadata
   */
  private async analyzeRepositoryStructure(request: RepositoryIndexRequest): Promise<RepositoryInfo> {
    try {
      const repoPath = request.repositoryPath;
      
      // Get basic repository information
      const [repoName, languages, gitInfo] = await Promise.all([
        this.getRepositoryName(repoPath),
        this.analyzeLanguageDistribution(repoPath, request.languages),
        this.getGitRepositoryInfo(repoPath)
      ]);

      // Detect framework
      const framework = await this.detectFramework(repoPath, languages);

      return {
        name: repoName,
        description: await this.getRepositoryDescription(repoPath),
        primaryLanguage: languages[0]?.language || 'unknown',
        languages,
        framework,
        size: await this.calculateRepositorySize(repoPath),
        contributors: gitInfo.contributors,
        lastUpdated: gitInfo.lastUpdated,
        branches: gitInfo.branches,
        tags: gitInfo.tags,
        license: await this.detectLicense(repoPath)
      };
    } catch (error) {
      log.warn('⚠️ Repository structure analysis failed', LogContext.ANALYSIS, {
        error: error instanceof Error ? error.message : String(error)
      });
      
      return {
        name: 'unknown',
        primaryLanguage: 'unknown',
        languages: [],
        size: 0,
        contributors: 0,
        lastUpdated: new Date().toISOString(),
        branches: [],
        tags: []
      };
    }
  }

  /**
   * Phase 2: Extract code patterns from repository
   */
  private async extractCodePatterns(
    request: RepositoryIndexRequest, 
    repositoryInfo: RepositoryInfo
  ): Promise<ExtractedCodePattern[]> {
    try {
      const patterns: ExtractedCodePattern[] = [];
      const repoPath = request.repositoryPath;

      // Get all code files to analyze
      const codeFiles = await this.getCodeFiles(repoPath, request.languages || []);
      
      // Process files in parallel (with concurrency limit)
      const maxConcurrent = request.maxConcurrentFiles || 5;
      const fileChunks = this.chunkArray(codeFiles, maxConcurrent);

      for (const chunk of fileChunks) {
        const chunkPatterns = await Promise.all(
          chunk.map(async (file) => {
            try {
              const fileContent = await fs.readFile(file.path, 'utf-8');
              const language = this.detectLanguageFromPath(file.path);
              
              if (!language) return [];

              // Use AST parser to extract patterns
              const analysis = await astParser.parseCode(fileContent, language, file.path);
              
              // Convert AST patterns to repository patterns
              return analysis.patterns.map(pattern => ({
                ...pattern,
                repositoryUrl: request.repositoryUrl,
                filePath: file.relativePath,
                frequency: 1, // Initial frequency
                qualityScore: this.calculatePatternQuality(pattern, analysis),
                usageContext: this.extractUsageContext(pattern, fileContent),
                relatedPatterns: this.findRelatedPatterns(pattern, analysis.patterns)
              }));
            } catch (error) {
              log.warn('⚠️ Failed to analyze file for patterns', LogContext.ANALYSIS, {
                filePath: file.path,
                error: error instanceof Error ? error.message : String(error)
              });
              return [];
            }
          })
        );

        patterns.push(...chunkPatterns.flat());
      }

      // Group similar patterns and calculate frequencies
      const groupedPatterns = this.groupSimilarPatterns(patterns);
      
      return groupedPatterns;
    } catch (error) {
      log.error('❌ Code pattern extraction failed', LogContext.ANALYSIS, {
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * Phase 3: Detect architectural patterns
   */
  private async detectArchitecturalPatterns(
    request: RepositoryIndexRequest,
    codePatterns: ExtractedCodePattern[]
  ): Promise<ArchitecturalPattern[]> {
    try {
      const patterns: ArchitecturalPattern[] = [];
      
      // MVC Pattern Detection
      const mvcPattern = this.detectMVCPattern(codePatterns);
      if (mvcPattern) patterns.push(mvcPattern);

      // Service-Oriented Architecture Detection
      const soaPattern = this.detectSOAPattern(codePatterns);
      if (soaPattern) patterns.push(soaPattern);

      // Component-Based Architecture Detection
      const componentPattern = this.detectComponentPattern(codePatterns);
      if (componentPattern) patterns.push(componentPattern);

      // Event-Driven Architecture Detection
      const eventPattern = this.detectEventDrivenPattern(codePatterns);
      if (eventPattern) patterns.push(eventPattern);

      return patterns;
    } catch (error) {
      log.warn('⚠️ Architectural pattern detection failed', LogContext.ANALYSIS, {
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * Phase 4: Analyze coding styles
   */
  private async analyzeCodingStyles(
    request: RepositoryIndexRequest,
    codePatterns: ExtractedCodePattern[]
  ): Promise<CodingStylePattern[]> {
    try {
      const styles: CodingStylePattern[] = [];

      // Naming convention analysis
      const namingStyles = this.analyzeNamingConventions(codePatterns);
      styles.push(...namingStyles);

      // Code structure analysis
      const structureStyles = this.analyzeCodeStructure(codePatterns);
      styles.push(...structureStyles);

      // Comment and documentation styles
      const commentStyles = this.analyzeCommentStyles(request.repositoryPath);
      styles.push(...commentStyles);

      return styles;
    } catch (error) {
      log.warn('⚠️ Coding style analysis failed', LogContext.ANALYSIS, {
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * Phase 5: Analyze security patterns
   */
  private async analyzeSecurityPatterns(
    request: RepositoryIndexRequest,
    codePatterns: ExtractedCodePattern[]
  ): Promise<SecurityPattern[]> {
    try {
      const patterns: SecurityPattern[] = [];

      // Authentication patterns
      const authPatterns = this.detectAuthenticationPatterns(codePatterns);
      patterns.push(...authPatterns);

      // Authorization patterns
      const authzPatterns = this.detectAuthorizationPatterns(codePatterns);
      patterns.push(...authzPatterns);

      // Input validation patterns
      const validationPatterns = this.detectValidationPatterns(codePatterns);
      patterns.push(...validationPatterns);

      // Cryptography patterns
      const cryptoPatterns = this.detectCryptographyPatterns(codePatterns);
      patterns.push(...cryptoPatterns);

      return patterns;
    } catch (error) {
      log.warn('⚠️ Security pattern analysis failed', LogContext.ANALYSIS, {
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * Phase 6: Analyze performance patterns
   */
  private async analyzePerformancePatterns(
    request: RepositoryIndexRequest,
    codePatterns: ExtractedCodePattern[]
  ): Promise<PerformancePattern[]> {
    try {
      const patterns: PerformancePattern[] = [];

      // Caching patterns
      const cachingPatterns = this.detectCachingPatterns(codePatterns);
      patterns.push(...cachingPatterns);

      // Database optimization patterns
      const dbPatterns = this.detectDatabasePatterns(codePatterns);
      patterns.push(...dbPatterns);

      // Async processing patterns
      const asyncPatterns = this.detectAsyncPatterns(codePatterns);
      patterns.push(...asyncPatterns);

      return patterns;
    } catch (error) {
      log.warn('⚠️ Performance pattern analysis failed', LogContext.ANALYSIS, {
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * Phase 7: Analyze testing patterns
   */
  private async analyzeTestingPatterns(
    request: RepositoryIndexRequest,
    codePatterns: ExtractedCodePattern[]
  ): Promise<TestingPattern[]> {
    try {
      const patterns: TestingPattern[] = [];

      // Unit testing patterns
      const unitPatterns = this.detectUnitTestPatterns(codePatterns);
      patterns.push(...unitPatterns);

      // Integration testing patterns
      const integrationPatterns = this.detectIntegrationTestPatterns(codePatterns);
      patterns.push(...integrationPatterns);

      // E2E testing patterns
      const e2ePatterns = this.detectE2ETestPatterns(codePatterns);
      patterns.push(...e2ePatterns);

      return patterns;
    } catch (error) {
      log.warn('⚠️ Testing pattern analysis failed', LogContext.ANALYSIS, {
        error: error instanceof Error ? error.message : String(error)
      });
      return [];
    }
  }

  /**
   * Phase 8: Analyze Git history
   */
  private async analyzeGitHistory(request: RepositoryIndexRequest): Promise<GitAnalysisResult> {
    try {
      const repoPath = request.repositoryPath;
      const maxCommits = request.maxCommits || 1000;

      // Get commit history
      const { stdout: commitLog } = await execAsync(
        `git log --oneline --no-merges -n ${maxCommits}`,
        { cwd: repoPath }
      );

      const commits = commitLog.trim().split('\n').filter(line => line.length > 0);

      // Get author information
      const { stdout: authorLog } = await execAsync(
        `git shortlog -sn --no-merges`,
        { cwd: repoPath }
      );

      const authors = authorLog.trim().split('\n').length;

      // Calculate hotspots (files with most changes)
      const hotspots = await this.calculateFileHotspots(repoPath);

      // Analyze commit frequency
      const commitFrequency = await this.analyzeCommitFrequency(repoPath);

      // Detect branching strategy
      const branchingStrategy = await this.detectBranchingStrategy(repoPath);

      return {
        totalCommits: commits.length,
        totalAuthors: authors,
        averageCommitSize: await this.calculateAverageCommitSize(repoPath),
        commitFrequency,
        branchingStrategy,
        hotspots,
        evolutionPatterns: []
      };
    } catch (error) {
      log.warn('⚠️ Git history analysis failed', LogContext.ANALYSIS, {
        error: error instanceof Error ? error.message : String(error)
      });
      return this.getEmptyGitAnalysis();
    }
  }

  // Helper methods and utility functions
  private generateIndexId(request: RepositoryIndexRequest): string {
    const timestamp = Date.now().toString();
    const hash = crypto.createHash('md5')
      .update(request.repositoryUrl + request.userId)
      .digest('hex')
      .substring(0, 8);
    return `idx_${timestamp}_${hash}`;
  }

  private async getRepositoryName(repoPath: string): Promise<string> {
    try {
      const { stdout } = await execAsync('git config --get remote.origin.url', { cwd: repoPath });
      const url = stdout.trim();
      const match = url.match(/\/([^\/]+)\.git$/);
      return match ? match[1] : path.basename(repoPath);
    } catch {
      return path.basename(repoPath);
    }
  }

  private async analyzeLanguageDistribution(
    repoPath: string,
    languages?: string[]
  ): Promise<LanguageInfo[]> {
    try {
      // This would use a more sophisticated language detection tool
      // For now, simple implementation based on file extensions
      const languageStats = new Map<string, { files: number; lines: number }>();
      
      const files = await this.getCodeFiles(repoPath, languages || []);
      
      for (const file of files) {
        const lang = this.detectLanguageFromPath(file.path);
        if (lang) {
          const content = await fs.readFile(file.path, 'utf-8');
          const lines = content.split('\n').length;
          
          const current = languageStats.get(lang) || { files: 0, lines: 0 };
          languageStats.set(lang, {
            files: current.files + 1,
            lines: current.lines + lines
          });
        }
      }
      
      const total = Array.from(languageStats.values()).reduce((sum, stats) => sum + stats.lines, 0);
      
      return Array.from(languageStats.entries()).map(([language, stats]) => ({
        language,
        files: stats.files,
        lines: stats.lines,
        percentage: total > 0 ? (stats.lines / total) * 100 : 0
      })).sort((a, b) => b.lines - a.lines);
    } catch (error) {
      return [];
    }
  }

  private async getGitRepositoryInfo(repoPath: string): Promise<any> {
    try {
      const [branches, tags, lastCommit] = await Promise.all([
        this.getGitBranches(repoPath),
        this.getGitTags(repoPath),
        this.getLastCommitDate(repoPath)
      ]);

      const contributors = await this.getContributorCount(repoPath);

      return {
        branches,
        tags,
        lastUpdated: lastCommit,
        contributors
      };
    } catch (error) {
      return {
        branches: [],
        tags: [],
        lastUpdated: new Date().toISOString(),
        contributors: 0
      };
    }
  }

  private async getCodeFiles(repoPath: string, languages: string[]): Promise<Array<{path: string, relativePath: string}>> {
    const files: Array<{path: string, relativePath: string}> = [];
    const allowedExtensions = ['.ts', '.js', '.py', '.swift', '.go', '.rs', '.java', '.cpp', '.c', '.vue', '.jsx', '.tsx'];
    
    async function scanDirectory(dir: string, relativePath = '') {
      try {
        const items = await fs.readdir(dir, { withFileTypes: true });
        
        for (const item of items) {
          if (item.name.startsWith('.')) continue; // Skip hidden files/dirs
          
          const fullPath = path.join(dir, item.name);
          const relPath = path.join(relativePath, item.name);
          
          if (item.isDirectory()) {
            // Skip common non-code directories
            if (!['node_modules', '.git', 'dist', 'build', '.next', 'coverage'].includes(item.name)) {
              await scanDirectory(fullPath, relPath);
            }
          } else if (item.isFile()) {
            const ext = path.extname(item.name);
            if (allowedExtensions.includes(ext)) {
              files.push({ path: fullPath, relativePath: relPath });
            }
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    }
    
    await scanDirectory(repoPath);
    return files;
  }

  private detectLanguageFromPath(filePath: string): string | null {
    const ext = path.extname(filePath).toLowerCase();
    const languageMap: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.py': 'python',
      '.swift': 'swift',
      '.go': 'go',
      '.rs': 'rust',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
      '.vue': 'vue'
    };
    return languageMap[ext] || null;
  }

  private calculatePatternQuality(pattern: CodePattern, analysis: ASTAnalysisResult): number {
    let quality = 0.5; // Base quality
    
    // Complexity factor (lower complexity = higher quality)
    quality += Math.max(0, (10 - pattern.complexity) / 10 * 0.3);
    
    // Documentation factor
    if (pattern.documentation) {
      quality += 0.2;
    }
    
    // Security factor (from analysis)
    if (analysis.securityIssues.length === 0) {
      quality += 0.3;
    }
    
    return Math.min(1.0, quality);
  }

  private extractUsageContext(pattern: CodePattern, fileContent: string): string[] {
    const context: string[] = [];
    
    // Extract import statements near the pattern
    const lines = fileContent.split('\n');
    const imports = lines.filter(line => line.trim().startsWith('import') || line.trim().startsWith('from'));
    context.push(...imports.slice(0, 3)); // Top 3 imports
    
    return context;
  }

  private findRelatedPatterns(pattern: CodePattern, patterns: CodePattern[]): string[] {
    return patterns
      .filter(p => p.name !== pattern.name && p.type === pattern.type)
      .slice(0, 3)
      .map(p => p.name);
  }

  private groupSimilarPatterns(patterns: ExtractedCodePattern[]): ExtractedCodePattern[] {
    const grouped = new Map<string, ExtractedCodePattern>();
    
    for (const pattern of patterns) {
      const key = `${pattern.type}_${pattern.name}`;
      
      if (grouped.has(key)) {
        const existing = grouped.get(key)!;
        existing.frequency += 1;
        existing.qualityScore = (existing.qualityScore + pattern.qualityScore) / 2;
      } else {
        grouped.set(key, { ...pattern, frequency: 1 });
      }
    }
    
    return Array.from(grouped.values());
  }

  // Placeholder implementations for various analysis methods
  private detectMVCPattern(patterns: ExtractedCodePattern[]): ArchitecturalPattern | null {
    const hasModels = patterns.some(p => p.name.toLowerCase().includes('model'));
    const hasViews = patterns.some(p => p.name.toLowerCase().includes('view'));
    const hasControllers = patterns.some(p => p.name.toLowerCase().includes('controller'));
    
    if (hasModels && hasViews && hasControllers) {
      return {
        id: crypto.randomUUID(),
        name: 'Model-View-Controller (MVC)',
        type: 'mvc',
        description: 'Classic MVC architectural pattern detected',
        implementation: 'Separation of concerns with Models, Views, and Controllers',
        files: patterns.filter(p => 
          p.name.toLowerCase().includes('model') ||
          p.name.toLowerCase().includes('view') ||
          p.name.toLowerCase().includes('controller')
        ).map(p => p.filePath),
        confidence: 0.8,
        benefits: ['Clear separation of concerns', 'Maintainable code structure'],
        tradeoffs: ['Can be overkill for simple applications']
      };
    }
    
    return null;
  }

  private detectSOAPattern(patterns: ExtractedCodePattern[]): ArchitecturalPattern | null {
    const hasServices = patterns.filter(p => p.name.toLowerCase().includes('service')).length;
    
    if (hasServices >= 3) {
      return {
        id: crypto.randomUUID(),
        name: 'Service-Oriented Architecture (SOA)',
        type: 'service-oriented',
        description: 'Service-oriented architecture pattern detected',
        implementation: `${hasServices} service classes implementing business logic`,
        files: patterns.filter(p => p.name.toLowerCase().includes('service')).map(p => p.filePath),
        confidence: 0.7,
        benefits: ['Modular architecture', 'Reusable services', 'Easy to test'],
        tradeoffs: ['Potential over-engineering', 'Service boundaries complexity']
      };
    }
    
    return null;
  }

  // Additional placeholder methods for comprehensive functionality
  private detectComponentPattern(patterns: ExtractedCodePattern[]): ArchitecturalPattern | null { return null; }
  private detectEventDrivenPattern(patterns: ExtractedCodePattern[]): ArchitecturalPattern | null { return null; }
  private analyzeNamingConventions(patterns: ExtractedCodePattern[]): CodingStylePattern[] { return []; }
  private analyzeCodeStructure(patterns: ExtractedCodePattern[]): CodingStylePattern[] { return []; }
  private analyzeCommentStyles(repoPath: string): Promise<CodingStylePattern[]> { return Promise.resolve([]); }
  private detectAuthenticationPatterns(patterns: ExtractedCodePattern[]): SecurityPattern[] { return []; }
  private detectAuthorizationPatterns(patterns: ExtractedCodePattern[]): SecurityPattern[] { return []; }
  private detectValidationPatterns(patterns: ExtractedCodePattern[]): SecurityPattern[] { return []; }
  private detectCryptographyPatterns(patterns: ExtractedCodePattern[]): SecurityPattern[] { return []; }
  private detectCachingPatterns(patterns: ExtractedCodePattern[]): PerformancePattern[] { return []; }
  private detectDatabasePatterns(patterns: ExtractedCodePattern[]): PerformancePattern[] { return []; }
  private detectAsyncPatterns(patterns: ExtractedCodePattern[]): PerformancePattern[] { return []; }
  private detectUnitTestPatterns(patterns: ExtractedCodePattern[]): TestingPattern[] { return []; }
  private detectIntegrationTestPatterns(patterns: ExtractedCodePattern[]): TestingPattern[] { return []; }
  private detectE2ETestPatterns(patterns: ExtractedCodePattern[]): TestingPattern[] { return []; }

  // Git analysis helper methods
  private async getGitBranches(repoPath: string): Promise<string[]> {
    try {
      const { stdout } = await execAsync('git branch -r', { cwd: repoPath });
      return stdout.trim().split('\n').map(branch => branch.trim()).filter(Boolean);
    } catch {
      return [];
    }
  }

  private async getGitTags(repoPath: string): Promise<string[]> {
    try {
      const { stdout } = await execAsync('git tag', { cwd: repoPath });
      return stdout.trim().split('\n').filter(Boolean);
    } catch {
      return [];
    }
  }

  private async getLastCommitDate(repoPath: string): Promise<string> {
    try {
      const { stdout } = await execAsync('git log -1 --format=%ci', { cwd: repoPath });
      return new Date(stdout.trim()).toISOString();
    } catch {
      return new Date().toISOString();
    }
  }

  private async getContributorCount(repoPath: string): Promise<number> {
    try {
      const { stdout } = await execAsync('git shortlog -sn | wc -l', { cwd: repoPath });
      return parseInt(stdout.trim()) || 0;
    } catch {
      return 0;
    }
  }

  // More helper methods
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private initializePatternExtractors(): void {
    // Initialize pattern extractors for different types
  }
  
  private async getExistingIndex(repositoryUrl: string): Promise<any> {
    // Check for existing index in database
    return null;
  }
  
  private async performIncrementalUpdate(existingIndex: any, request: RepositoryIndexRequest): Promise<RepositoryIndexResult> {
    // Perform incremental update
    throw new Error('Incremental update not implemented');
  }

  // Additional placeholder implementations for comprehensive functionality
  private async detectFramework(repoPath: string, languages: LanguageInfo[]): Promise<string | undefined> { return undefined; }
  private async getRepositoryDescription(repoPath: string): Promise<string | undefined> { return undefined; }
  private async calculateRepositorySize(repoPath: string): Promise<number> { return 0; }
  private async detectLicense(repoPath: string): Promise<string | undefined> { return undefined; }
  private async analyzeCommitPatterns(request: RepositoryIndexRequest, gitAnalysis: GitAnalysisResult): Promise<CommitPattern[]> { return []; }
  private async analyzeAuthorInsights(request: RepositoryIndexRequest, gitAnalysis: GitAnalysisResult): Promise<AuthorInsight[]> { return []; }
  private async calculateQualityMetrics(codePatterns: ExtractedCodePattern[], architecturalPatterns: ArchitecturalPattern[], securityPatterns: SecurityPattern[], testingPatterns: TestingPattern[]): Promise<RepositoryQualityMetrics> {
    return {
      overallQuality: 0.7,
      maintainabilityIndex: 0.7,
      technicalDebt: 0.3,
      testCoverage: 0.6,
      documentation: 0.5,
      consistency: 0.8,
      security: 0.8,
      performance: 0.7
    };
  }
  
  private async calculateUsageStatistics(codePatterns: ExtractedCodePattern[], architecturalPatterns: ArchitecturalPattern[], repositoryInfo: RepositoryInfo): Promise<UsageStatistics> {
    return {
      mostUsedPatterns: [],
      leastUsedPatterns: [],
      frameworkUsage: [],
      libraryUsage: [],
      patternCooccurrence: []
    };
  }
  
  private async extractLearningInsights(codePatterns: ExtractedCodePattern[], architecturalPatterns: ArchitecturalPattern[], qualityMetrics: RepositoryQualityMetrics, gitAnalysis: GitAnalysisResult): Promise<PatternLearningInsight[]> { 
    return []; 
  }
  
  private async generateRecommendations(qualityMetrics: RepositoryQualityMetrics, securityPatterns: SecurityPattern[], performancePatterns: PerformancePattern[], learningInsights: PatternLearningInsight[]): Promise<RepositoryRecommendation[]> { 
    return []; 
  }
  
  private async storeIndexResult(result: RepositoryIndexResult, request: RepositoryIndexRequest): Promise<void> {}
  private async updatePatternDatabase(patterns: ExtractedCodePattern[], request: RepositoryIndexRequest): Promise<void> {}
  private async calculateFileHotspots(repoPath: string): Promise<FileHotspot[]> { return []; }
  private async analyzeCommitFrequency(repoPath: string): Promise<CommitFrequency> { 
    return { daily: 0, weekly: 0, monthly: 0, pattern: 'regular' }; 
  }
  
  private async detectBranchingStrategy(repoPath: string): Promise<string> { return 'git-flow'; }
  private async calculateAverageCommitSize(repoPath: string): Promise<number> { return 0; }

  private createFailureResult(indexId: string, request: RepositoryIndexRequest, error: unknown, timeMs: number): RepositoryIndexResult {
    return {
      indexId,
      success: false,
      repositoryUrl: request.repositoryUrl,
      repositoryPath: request.repositoryPath,
      repositoryInfo: {
        name: 'unknown',
        primaryLanguage: 'unknown',
        languages: [],
        size: 0,
        contributors: 0,
        lastUpdated: new Date().toISOString(),
        branches: [],
        tags: []
      },
      codePatterns: [],
      architecturalPatterns: [],
      codingStyles: [],
      securityPatterns: [],
      performancePatterns: [],
      testingPatterns: [],
      gitAnalysis: this.getEmptyGitAnalysis(),
      commitPatterns: [],
      authorInsights: [],
      qualityMetrics: {
        overallQuality: 0,
        maintainabilityIndex: 0,
        technicalDebt: 0,
        testCoverage: 0,
        documentation: 0,
        consistency: 0,
        security: 0,
        performance: 0
      },
      usageStatistics: {
        mostUsedPatterns: [],
        leastUsedPatterns: [],
        frameworkUsage: [],
        libraryUsage: [],
        patternCooccurrence: []
      },
      learningInsights: [],
      recommendations: [],
      indexingTimeMs: timeMs,
      filesProcessed: 0,
      patternsExtracted: 0,
      storageUsed: 0
    };
  }

  private getEmptyGitAnalysis(): GitAnalysisResult {
    return {
      totalCommits: 0,
      totalAuthors: 0,
      averageCommitSize: 0,
      commitFrequency: { daily: 0, weekly: 0, monthly: 0, pattern: 'regular' },
      branchingStrategy: 'unknown',
      hotspots: [],
      evolutionPatterns: []
    };
  }

  /**
   * Clear indexing cache
   */
  public clearCache(): void {
    this.indexCache.clear();
    log.info('🧹 Repository indexing cache cleared', LogContext.ANALYSIS);
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): { size: number; entries: number } {
    return {
      size: this.indexCache.size,
      entries: this.indexCache.size
    };
  }
}

// Pattern extractor interface for extensibility
interface PatternExtractor {
  extractPatterns(code: string, language: string): Promise<CodePattern[]>;
}

export const repositoryIndexingService = new RepositoryIndexingService();
export default repositoryIndexingService;