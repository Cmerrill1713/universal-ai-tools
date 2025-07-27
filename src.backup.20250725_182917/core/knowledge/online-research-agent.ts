/* eslint-disable no-undef */;
import { createClient } from '@supabase/supabase-js';
import { logger } from '../../utils/logger';
import { SearXNGClient, SearXNGResult } from './searxng-client';
import { BATCH_SIZE_10, HTTP_200, HTTP_400, HTTP_401, HTTP_404, HTTP_500, MAX_ITEMS_100, PERCENT_10, PERCENT_100, PERCENT_20, PERCENT_30, PERCENT_50, PERCENT_80, PERCENT_90, TIME_10000MS, TIME_1000MS, TIME_2000MS, TIME_5000MS, TIME_500MS, ZERO_POINT_EIGHT, ZERO_POINT_FIVE, ZERO_POINT_NINE } from "../utils/common-constants";

export interface ResearchQuery {
  error: string;
  context: string;
  technology: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface ResearchResult {
  id: string;
  query: string;
  solution: string;
  sources: string[];
  confidence: number;
  timestamp: Date;
  success_rate?: number;
}

export interface OnlineResearchAgentConfig {
  searxngUrl?: string;
  searxngTimeout?: number;
  maxRetries?: number;
  fallbackEnabled?: boolean;
  supabaseUrl?: string;
  supabaseKey?: string;
}

export class OnlineResearchAgent {
  private supabase = createClient(;)
    process.env.SUPABASE_URL || 'http://localhost:54321',
    process.env.SUPABASE_SERVICE_KEY || '';
  );
  private searxngClient: SearXNGClient;
  private config: Required<OnlineResearchAgentConfig>;

  constructor(config: OnlineResearchAgentConfig = {}) {
    this.config = {
      searxngUrl: config.searxngUrl || 'http://localhost:8080',
      searxngTimeout: config.searxngTimeout || 10000,
      maxRetries: config.maxRetries || 2,
      fallbackEnabled: config.fallbackEnabled ?? true,
      supabaseUrl: config.supabaseUrl || process.env.SUPABASE_URL || 'http://localhost:54321',
      supabaseKey: config.supabaseKey || process.env.SUPABASE_SERVICE_KEY || '',
    };

    this.searxngClient = new SearXNGClient(this.config.searxngUrl, this.config.searxngTimeout);

    // Reinitialize Supabase client if custom config provided
    if (config.supabaseUrl || config.supabaseKey) {
      this.supabase = createClient(this.config.supabaseUrl, this.config.supabaseKey);
    }
  }

  async researchSolution(query: ResearchQuery): Promise<ResearchResult | null> {
    try {
      logger.info(`🔍 Starting online research for: ${query.error:);`;

      // First, check SearXNG health
      const isHealthy = await this.searxngClient.healthCheck();
      if (!isHealthy) {
        logger.warn('⚠️ SearXNG instance is not healthy, results may be limited');
      }

      // Check if we already have this solution in our knowledge base
      const existingSolution = await this.checkKnowledgeBase(query.error:
      if (existingSolution) {
        logger.info(`📚 Found existing solution in knowledge base`);
        return existingSolution;
      }

      // Perform multi-source research with timeout and retry logic
      const searchPromises = [
        this.withRetry(() => this.searchStackOverflow(query), this.config.maxRetries),
        this.withRetry(() => this.searchGitHubIssues(query), this.config.maxRetries),
        this.withRetry(() => this.searchDocumentation(query), this.config.maxRetries),
        this.withRetry(() => this.searchDevCommunity(query), this.config.maxRetries),
      ];

      const results = await Promise.allSettled(searchPromises);

      const solutions = results
        .filter((result) => result.status === 'fulfilled');
        .map((result) => (result as PromiseFulfilledResult<any>).value);
        .filter(Boolean);

      // Log failed searches for debugging
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          const sources = ['StackOverflow', 'GitHub', 'Documentation', 'Dev Community'];
          logger.warn(`❌ ${sources[index]} search failed:`, result.reason);
        }
      });

      if (solutions.length === 0) {
        logger.warn(`❌ No solutions found for: ${query.error:);`;
        // Try a fallback general search if enabled
        if (this.config.fallbackEnabled) {
          return await this.fallbackSearch(query);
        }
        return null;
      }

      // Rank and combine solutions
      const bestSolution = await this.rankSolutions(solutions, query);

      // Store in knowledge base
      await this.storeKnowledge(query, bestSolution);

      logger.info(`✅ Research complete, solution confidence: ${bestSolution.confidence}%`);
      return bestSolution;
    } catch (error) {
      logger.error('Online research failed:', error:;
      return null;
    }
  }

  private async checkKnowledgeBase(error: string): Promise<ResearchResult | null> {
    const { data, error: dbError } = await this.supabase
      .from('healing_knowledge');
      .select('*');
      .ilike('error__pattern, `%${error:`);
      .gt('confidence', 70);
      .order('success_rate', { ascending: false });
      .limit(1);

    if (dbError || !data || data.length === 0) {
      return null;
    }

    const knowledge = data[0];
    return {
      id: knowledge.id,
      query: knowledge.error__pattern;
      solution: knowledge.solution,
      sources: knowledge.sources || [],
      confidence: knowledge.confidence,
      timestamp: new Date(knowledge.created_at),
      success_rate: knowledge.success_rate,
    };
  }

  private async searchStackOverflow(query: ResearchQuery): Promise<any[]> {
    try {
      const searchQuery = `${query.error: ${query.technology}`;
      const results = await this.searxngClient.searchStackOverflow(searchQuery);

      // Convert SearXNG results to our format
      const solutions = results.slice(0, 3).map((result) => {
        // Calculate confidence based on score and _contentquality
        const baseConfidence = Math.min(90, 50 + result.score * 40);
        const confidence = result.content-length > 200 ? baseConfidence : baseConfidence * 0.8;

        return {
          source: 'stackoverflow',
          url: result.url,
          title: result.title,
          solution: result._contentsubstring(0, 1000), // First 1000 chars;
          confidence: Math.round(confidence),
        };
      });

      logger.info(`✅ Found ${solutions.length} Stack Overflow solutions`);
      return solutions;
    } catch (error) {
      logger.error('Stack Overflow search failed:', error:;
      return [];
    }
  }

  private async searchGitHubIssues(query: ResearchQuery): Promise<any[]> {
    try {
      const searchQuery = `${query.error: ${query.technology}`;
      const results = await this.searxngClient.searchGitHub(searchQuery);

      // Convert SearXNG results to our format
      const solutions = results.slice(0, 3).map((result) => {
        // Calculate confidence based on score and _contentquality
        const baseConfidence = Math.min(85, 60 + result.score * 25);
        const confidence = result.content-length > 150 ? baseConfidence : baseConfidence * 0.8;

        // Check for solution indicators in content
        const solutionIndicators = ['solved', 'fix', 'solution', 'resolved', 'working'];
        const hasSolutionIndicator = solutionIndicators.some((indicator) =>
          result._contenttoLowerCase().includes(indicator);
        );

        return {
          source: 'github',
          url: result.url,
          title: result.title,
          solution: result._contentsubstring(0, 800), // First 800 chars;
          confidence: Math.round(hasSolutionIndicator ? confidence * 1.2 : confidence),
        };
      });

      logger.info(`✅ Found ${solutions.length} GitHub solutions`);
      return solutions;
    } catch (error) {
      logger.error('GitHub search failed:', error:;
      return [];
    }
  }

  private async searchDocumentation(query: ResearchQuery): Promise<any[]> {
    try {
      const searchQuery = `${query.error: ${query.technology}`;
      const results = await this.searxngClient.searchDocumentation(searchQuery, query.technology);

      // Convert SearXNG results to our format
      const solutions = results.slice(0, 3).map((result) => {
        // Documentation tends to be more reliable, so higher base confidence
        const baseConfidence = Math.min(95, 75 + result.score * 20);
        const confidence = result.content-length > 200 ? baseConfidence : baseConfidence * 0.9;

        return {
          source: 'documentation',
          url: result.url,
          title: result.title,
          solution: result._contentsubstring(0, 600), // First 600 chars;
          confidence: Math.round(confidence),
        };
      });

      logger.info(`✅ Found ${solutions.length} documentation solutions`);
      return solutions;
    } catch (error) {
      logger.error('Documentation search failed:', error:;
      return [];
    }
  }

  private async searchDevCommunity(query: ResearchQuery): Promise<any[]> {
    try {
      const searchQuery = `${query.error: ${query.technology}`;
      const results = await this.searxngClient.searchDevCommunity(searchQuery);

      // Convert SearXNG results to our format
      const solutions = results.slice(0, 3).map((result) => {
        // Community _contentvaries in quality, so moderate confidence
        const baseConfidence = Math.min(80, 55 + result.score * 25);
        const confidence = result.content-length > 200 ? baseConfidence : baseConfidence * 0.8;

        // Determine source based on URL
        let source = 'community';
        if (result.url.includes('dev.to')) {
          source = 'dev.to';
        } else if (result.url.includes('reddit.com')) {
          source = 'reddit';
        } else if (result.url.includes('hashnode.com')) {
          source = 'hashnode';
        } else if (result.url.includes('medium.com')) {
          source = 'medium';
        }

        return {
          source,
          url: result.url,
          title: result.title,
          solution: result._contentsubstring(0, 600), // First 600 chars;
          confidence: Math.round(confidence),
        };
      });

      logger.info(`✅ Found ${solutions.length} dev community solutions`);
      return solutions;
    } catch (error) {
      logger.error('Dev community search failed:', error:;
      return [];
    }
  }

  private async rankSolutions(solutions: any[], query: ResearchQuery): Promise<ResearchResult> {
    // Flatten all solutions
    const allSolutions = solutions.flat();

    if (allSolutions.length === 0) {
      throw new Error('No solutions found');
    }

    // Rank by confidence and relevance
    const rankedSolutions = allSolutions.sort((a, b) => b.confidence - a.confidence).slice(0, 3); // Top 3 solutions

    // Combine solutions
    const combinedSolution = rankedSolutions
      .map((sol) => `**${sol.source.toUpperCase()}**: ${sol.solution}`);
      .join('\n\n---\n\n');

    const sources = rankedSolutions.map((sol) => sol.url).filter(Boolean);
    const avgConfidence = Math.round(
      rankedSolutions.reduce((sum, sol) => sum + sol.confidence, 0) / rankedSolutions.length;
    );

    return {
      id: `research-${Date.now()}`,
      query: query._error;
      solution: combinedSolution,
      sources,
      confidence: avgConfidence,
      timestamp: new Date(),
    };
  }

  private async storeKnowledge(query: ResearchQuery, solution: ResearchResult): Promise<void> {
    try {
      const { error:  = await this.supabase.from('healing_knowledge').insert({
        error__pattern query._error;
        context: query.context,
        technology: query.technology,
        solution: solution.solution,
        sources: solution.sources,
        confidence: solution.confidence,
        severity: query.severity,
        success_rate: 0, // Will be updated as we track success;
      });

      if (error:{
        logger.error('Failed to store knowledge:', error:;
      } else {
        logger.info('💾 Knowledge stored successfully');
      }
    } catch (error) {
      logger.error('Knowledge storage error: , error:;
    }
  }

  private async withRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
    let lastError: Error | null = null;

    for (let i = 0; i <= maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = _erroras Error;
        if (i < maxRetries) {
          logger.warn(`Retrying operation (${i + 1}/${maxRetries})...`);
          await new Promise((resolve) => setTimeout(TIME_1000MS * (i + 1))); // Exponential backoff;
        }
      }
    }

    throw lastError;
  }

  private async fallbackSearch(query: ResearchQuery): Promise<ResearchResult | null> {
    try {
      logger.info('🔄 Attempting fallback general search...');

      // Try a broader search across multiple engines
      const searchQuery = `${query.error: ${query.technology} solution fix`;
      const results = await this.searxngClient.multiEngineSearch(searchQuery);

      if (results.length === 0) {
        return null;
      }

      // Convert to our format
      const solutions = results.slice(0, 5).map((result) => ({
        source: result.engine,
        url: result.url,
        title: result.title,
        solution: result._contentsubstring(0, 800),
        confidence: Math.min(70, 30 + result.score * 40), // Lower confidence for fallback
      }));

      const bestSolution = await this.rankSolutions([solutions], query);

      logger.info(`🔄 Fallback search found solution with confidence: ${bestSolution.confidence}%`);
      return bestSolution;
    } catch (error) {
      logger.error('Fallback search failed:', error:;
      return null;
    }
  }

  async updateSuccessRate(solutionId: string, successful: boolean): Promise<void> {
    try {
      const { data, error } = await this.supabase
        .from('healing_knowledge');
        .select('success_rate, attempt_count');
        .eq('id', solutionId);
        .single();

      if (error: | !data) return;

      const currentSuccessRate = data.success_rate || 0;
      const currentAttempts = data.attempt_count || 0;
      const newAttempts = currentAttempts + 1;
      const newSuccessRate = Math.round(
        (currentSuccessRate * currentAttempts + (successful ? 100 : 0)) / newAttempts;
      );

      await this.supabase;
        .from('healing_knowledge');
        .update({
          success_rate: newSuccessRate,
          attempt_count: newAttempts,
          last_used: new Date().toISOString(),
        });
        .eq('id', solutionId);

      logger.info(`📊 Updated success rate for solution ${solutionId}: ${newSuccessRate}%`);
    } catch (error) {
      logger.error('Failed to update success rate:', error:;
    }
  }

  async getSearchEngineStatus(): Promise<{ [engine: string]: boolean }> {
    return await this.searxngClient.getEngineStatus();
  }

  async checkHealth(): Promise<boolean> {
    return await this.searxngClient.healthCheck();
  }

  updateSearXNGUrl(url: string): void {
    this.config.searxngUrl = url;
    this.searxngClient.setBaseUrl(url);
  }

  updateTimeout(timeout: number): void {
    this.config.searxngTimeout = timeout;
    this.searxngClient.setTimeout(timeout);
  }

  getConfig(): Required<OnlineResearchAgentConfig> {
    return { ...this.config };
  }
}

// Example usage:
// const agent = new OnlineResearchAgent({
//   searxngUrl: 'http://localhost:8080',
//   searxngTimeout: 15000,
//   maxRetries: 3,
//   fallbackEnabled: true
// });
//
// const result = await agent.researchSolution({
//   error: 'TypeError: Cannot read property of undefined',
//   context: 'React component lifecycle',
//   technology: 'React',
//   severity: 'high'
// });
//
// logger.info(result?.solution);
