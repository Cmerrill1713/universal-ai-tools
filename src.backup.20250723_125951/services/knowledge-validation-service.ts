/**
 * Knowledge Validation Service
 * Validates and scores knowledge from various sources
 */

import { createHash } from 'crypto';
import axios from 'axios';
import { logger } from '../utils/logger';
import { supabase } from './supabase_service';
import type { KnowledgeSource } from '../config/knowledge-sources';
import { CONTENT_VALIDATION_RULES } from '../config/knowledge-sources';
import { dspyService } from './dspy-service';
import * as natural from 'natural';
import { encoding_for_model } from 'tiktoken';

interface ValidationResult {
  isValid: boolean;
  score: number;
  validationType: string;
  issues: string[];
  suggestions: string[];
  metadata: Record<string, unknown>;
}

interface KnowledgeValidationEntry {
  scraped_knowledge_id: string;
  validation_type: string;
  score: number;
  issues: string[];
  suggestions: string[];
  validator_id: string;
  metadata: Record<string, unknown>;
}

export class KnowledgeValidationService {
  private tokenizer: natural.WordTokenizer;
  private sentenceTokenizer: natural.SentenceTokenizer;
  private tfidf: natural.TfIdf;
  private spellChecker: natural.Spellcheck;
  private encoding: any;

  constructor() {
    this.tokenizer = new natural.WordTokenizer();
    this.sentenceTokenizer = new natural.SentenceTokenizer([]);
    this.tfidf = new natural.TfIdf();
    // Initialize spellchecker with a basic word list
    const basicWordList = [
      'the',
      'and',
      'or',
      'but',
      'in',
      'on',
      'at',
      'to',
      'for',
      'of',
      'with',
      'by',
      'from',
      'up',
      'about',
      'into',
      'through',
      'during',
      'before',
      'after',
      'above',
      'below',
      'between',
      'among',
      'until',
      'without',
      'within',
    ];
    this.spellChecker = new natural.Spellcheck(basicWordList);

    try {
      this.encoding = encoding_for_model('gpt-3.5-turbo');
    } catch (error) {
      logger.warn('Failed to load tiktoken encoding, token counting will be approximate');
    }
  }

  /**
   * Validate scraped knowledge content
   */
  async validateScrapedKnowledge(
    scrapedId: string,
    content string,
    source: KnowledgeSource,
    metadata: Record<string, unknown>
  ): Promise<ValidationResult[]> {
    const validationResults: ValidationResult[] = [];

    try {
      // 1. Source credibility validation
      const credibilityResult = await this.validateSourceCredibility(source);
      validationResults.push(credibilityResult);

      // 2. Content quality validation
      const qualityResult = await this.validateContentQuality(content: metadata;
      validationResults.push(qualityResult);

      // 3. Fact checking validation (if: applicable
      if (source.priority === 'high' && metadata.contentType !== 'code') {
        const factCheckResult = await this.validateFactChecking(content: metadata;
        validationResults.push(factCheckResult);
      }

      // 4. Deprecation detection
      const deprecationResult = await this.detectDeprecation(content: metadata;
      validationResults.push(deprecationResult);

      // 5. Technical accuracy validation (for code)
      if (metadata.hasCodeExamples || metadata.contentType === 'code') {
        const technicalResult = await this.validateTechnicalAccuracy(content: metadata;
        validationResults.push(technicalResult);
      }

      // Store validation results
      await this.storeValidationResults(scrapedId, validationResults;

      // Calculate overall validation status
      const overallScore = this.calculateOverallScore(validationResults);
      await this.updateScrapedKnowledgeStatus(scrapedId, overallScore, validationResults;
    } catch (error) {
      logger.error(Failed to validate knowledge ${, error);
    }

    return validationResults;
  }

  /**
   * Validate source credibility
   */
  private async validateSourceCredibility(source: KnowledgeSource: Promise<ValidationResult> {
    const issues: string[] = [];
    const suggestions: string[] = [];
    let score = source.credibilityScore;

    // Check if source is still accessible
    try {
      const response = await axios.head(source.url, { timeout: 5000 });
      if (response.status >= 400) {
        issues.push(`Source URL returns status ${response.status}`);
        score *= 0.8;
      }
    } catch (error) {
      issues.push('Source URL is not accessible');
      suggestions.push('Consider finding alternative sources');
      score *= 0.5;
    }

    // Check source age and update frequency
    const lastUpdate = source.updateFrequency;
    const updateFrequencyHours = this.parseUpdateFrequency(lastUpdate);

    if (updateFrequencyHours > 168) {
      // More than a week
      issues.push('Source updates infrequently');
      suggestions.push('Increase monitoring frequency for changes');
      score *= 0.9;
    }

    // Domain reputation check
    const domainReputation = await this.checkDomainReputation(source.url);
    if (domainReputation < 0.7) {
      issues.push('Domain has lower reputation score');
      suggestions.push('Cross-reference with more authoritative sources');
      score *= domainReputation;
    }

    return {
      isValid: score >= 0.5,
      score,
      validationType: 'source_credibility',
      issues,
      suggestions,
      metadata: {
        originalCredibility: source.credibilityScore,
        domainReputation,
        updateFrequency: updateFrequencyHours,
      },
    };
  }

  /**
   * Validate contentquality
   */
  private async validateContentQuality(
    content string,
    metadata: Record<string, unknown>
  ): Promise<ValidationResult> {
    const issues: string[] = [];
    const suggestions: string[] = [];
    let score = 1.0;

    // Length validation
    const contentLength = content.length;
    if (contentLength < 50) {
      issues.push('Content is too short to be meaningful');
      score *= 0.3;
    } else if (contentLength > 50000) {
      issues.push('Content is excessively long');
      suggestions.push('Consider breaking into smaller, focused pieces');
      score *= 0.8;
    }

    // Token count validation
    const tokenCount = this.countTokens(content;
    if (tokenCount > 8000) {
      issues.push('Content exceeds optimal token limit for processing');
      suggestions.push('Summarize or split contentfor better processing');
      score *= 0.7;
    }

    // Readability analysis
    const readabilityScores = this.analyzeReadability(content;
    if (readabilityScores.fleschScore < 30) {
      issues.push('Content is very difficult to read');
      suggestions.push('Simplify language for better comprehension');
      score *= 0.8;
    }

    // Grammar and spelling check
    const grammarIssues = await this.checkGrammarAndSpelling(content;
    if (grammarIssues.length > 10) {
      issues.push(`Found ${grammarIssues.length} grammar/spelling issues`);
      suggestions.push('Review and correct language errors');
      score *= 0.9;
    }

    // Structure validation
    const structureScore = this.validateContentStructure(content: metadata;
    if (structureScore < 0.7) {
      issues.push('Content lacks proper structure');
      suggestions.push('Add clear sections, headings, or formatting');
      score *= structureScore;
    }

    // Duplicate contentcheck
    const duplicateScore = await this.checkDuplicateContent(content;
    if (duplicateScore > 0.8) {
      issues.push('Content appears to be duplicate or very similar to existing knowledge');
      suggestions.push('Focus on unique insights or merge with existing: content;
      score *= 0.5;
    }

    return {
      isValid: score >= 0.5,
      score,
      validationType: 'content_quality',
      issues,
      suggestions,
      metadata: {
        contentLength,
        tokenCount,
        readabilityScores,
        grammarIssueCount: grammarIssues.length,
        structureScore,
        duplicateScore,
      },
    };
  }

  /**
   * Validate facts using external APIs and cross-references
   */
  private async validateFactChecking(
    content string,
    metadata: Record<string, unknown>
  ): Promise<ValidationResult> {
    const issues: string[] = [];
    const suggestions: string[] = [];
    let score = 1.0;

    try {
      // Extract factual claims
      const claims = await this.extractFactualClaims(content;

      if (claims.length === 0) {
        return {
          isValid: true,
          score: 1.0,
          validationType: 'fact_check',
          issues: [],
          suggestions: [],
          metadata: { claimsChecked: 0 },
        };
      }

      // Use DSPy for intelligent fact validation
      const factCheckResult = await dspyService.request'validate_facts', {
        claims,
        context: metadata,
        requireSources: true,
      });

      if (factCheckResult.success) {
        const validationData = factCheckResult.result;
        score = validationData.overall_accuracy || 0.8;

        if (validationData.incorrect_claims) {
          issues.push(
            ...validationData.incorrect_claims.map(
              (claim: any => `Incorrect claim: "${claim.claim}" - ${claim.issue}``
            )
          );
        }

        if (validationData.unsupported_claims) {
          issues.push(
            ...validationData.unsupported_claims.map(
              (claim: any => `Unsupported claim: "${claim.claim}"``
            )
          );
          suggestions.push('Provide references or sources for unsupported claims');
        }

        if (validationData.outdated_claims) {
          issues.push(
            ...validationData.outdated_claims.map(
              (claim: any => `Outdated information: "${claim.claim}"``
            )
          );
          suggestions.push('Update with current information');
        }
      }

      // Cross-reference with existing knowledge base
      const crossRefScore = await this.crossReferenceWithKnowledgeBase(claims);
      if (crossRefScore < 0.7) {
        issues.push('Some claims contradict existing knowledge');
        suggestions.push('Reconcile contradictions or provide additional context');
        score *= crossRefScore;
      }
    } catch (error) {
      logger.error('Fact checking failed:', error);
      issues.push('Unable to complete fact checking');
      score *= 0.8;
    }

    return {
      isValid: score >= 0.6,
      score,
      validationType: 'fact_check',
      issues,
      suggestions,
      metadata: {
        claimsChecked: metadata.claimsCount || 0,
        factCheckMethod: 'dspy_intelligent',
      },
    };
  }

  /**
   * Detect deprecated or outdated content
   */
  private async detectDeprecation(
    content string,
    metadata: Record<string, unknown>
  ): Promise<ValidationResult> {
    const issues: string[] = [];
    const suggestions: string[] = [];
    let score = 1.0;

    // Check for deprecation keywords
    const deprecationKeywords = [
      'deprecated',
      'obsolete',
      'outdated',
      'no longer supported',
      'will be removed',
      'legacy',
      'old version',
      'end of life',
      'discontinued',
      'replaced by',
      'use instead',
    ];

    const lowerContent = contenttoLowerCase();
    const foundKeywords = deprecationKeywords.filter((keyword) => lowerContent.includes(keyword));

    if (foundKeywords.length > 0) {
      issues.push(`Content contains deprecation indicators: ${foundKeywords.join(', ')}`);
      suggestions.push('Verify if information is still current');
      score *= 0.7;
    }

    // Check version mentions
    const versionPattern = /v?(\d+)\.(\d+)(?:\.(\d+))?/gi;
    const versionMatches = contentmatch(versionPattern);

    if (versionMatches && versionMatches.length > 0) {
      const latestVersions = await this.checkLatestVersions(metadata.category, versionMatches;

      for (const [mentioned, latest] of Object.entries(latestVersions)) {
        if (this.isVersionOutdated(mentioned, latest as string)) {
          issues.push(`Mentions outdated version ${mentioned} (latest: ${latest})`);
          suggestions.push(`Update references to version ${latest}`);
          score *= 0.8;
        }
      }
    }

    // Check date references
    const datePattern = /\b(20\d{2})\b/g;
    const yearMatches = contentmatch(datePattern);

    if (yearMatches) {
      const currentYear = new Date().getFullYear();
      const oldestYear = Math.min(...yearMatches.map((y) => parseInt(y, 10)));

      if (currentYear - oldestYear > 3) {
        issues.push(`Content references information from ${oldestYear}`);
        suggestions.push('Verify if information is still applicable');
        score *= 0.9;
      }
    }

    // Check against known deprecation database
    const deprecationDatabase = await this.checkDeprecationDatabase(content: metadata;
    if (deprecationDatabase.hasDeprecations) {
      issues.push(...deprecationDatabase.deprecations);
      suggestions.push(...deprecationDatabase.replacements);
      score *= 0.6;
    }

    return {
      isValid: score >= 0.5,
      score,
      validationType: 'deprecation',
      issues,
      suggestions,
      metadata: {
        deprecationKeywords: foundKeywords,
        versionInfo: versionMatches,
        deprecationDatabase,
      },
    };
  }

  /**
   * Validate technical accuracy for code content
   */
  private async validateTechnicalAccuracy(
    content string,
    metadata: Record<string, unknown>
  ): Promise<ValidationResult> {
    const issues: string[] = [];
    const suggestions: string[] = [];
    let score = 1.0;

    // Extract code blocks
    const codeBlocks = this.extractCodeBlocks(content;

    if (codeBlocks.length === 0 && metadata.hasCodeExamples) {
      issues.push('Expected code examples but none found');
      score *= 0.7;
    }

    for (const codeBlock of codeBlocks) {
      // Syntax validation
      const syntaxValidation = await this.validateCodeSyntax(codeBlock);
      if (!syntaxValidation.isValid) {
        issues.push(`Syntax_errorin ${codeBlock.language} code: ${syntaxValidation._error`);
        suggestions.push('Fix syntax errors in code examples');
        score *= 0.7;
      }

      // Security check
      const securityIssues = this.checkCodeSecurity(codeBlock);
      if (securityIssues.length > 0) {
        issues.push(...securityIssues.map((issue) => `Security issue: ${issue}`));`
        suggestions.push('Address security vulnerabilities in code examples');
        score *= 0.6;
      }

      // Best practices check
      const bestPracticeIssues = await this.checkCodeBestPractices(codeBlock);
      if (bestPracticeIssues.length > 0) {
        issues.push(...bestPracticeIssues.slice(0, 3)); // Limit to top 3
        suggestions.push('Follow coding best practices');
        score *= 0.9;
      }
    }

    // API usage validation
    if (metadata.category === 'api' || contentincludes('endpoint')) {
      const apiValidation = await this.validateAPIUsage(content;
      if (!apiValidation.isValid) {
        issues.push(...apiValidation.issues);
        suggestions.push(...apiValidation.suggestions);
        score *= apiValidation.score;
      }
    }

    return {
      isValid: score >= 0.6,
      score,
      validationType: 'technical_accuracy',
      issues,
      suggestions,
      metadata: {
        codeBlockCount: codeBlocks.length,
        languages: Array.from(new Set(codeBlocks.map((b) => b.language))),
        securityScore: 1.0 - issues.filter((i) => i.includes('Security')).length * 0.1,
      },
    };
  }

  // Helper methods

  private parseUpdateFrequency(cronExpression: string: number {
    // Simple parser for cron expressions to hours
    const parts = cronExpression.split(' ');
    if (parts[1] === '*') return 1; // Every hour
    if (parts[1].includes('*/')) {
      const hours = parseInt(parts[1].split('/', 10)[1]);
      return hours;
    }
    if (parts[2] === '*') return 24; // Daily
    return 168; // Weekly default
  }

  private async checkDomainReputation(url: string: Promise<number> {
    try {
      const domain = new URL(url).hostname;

      // Known high-reputation domains
      const trustedDomains = [
        'supabase.com',
        'github.com',
        'stackoverflow.com',
        'openai.com',
        'arxiv.org',
        'acm.org',
        'ieee.org',
        'microsoft.com',
        'google.com',
        'apollographql.com',
        'langchain.com',
        'huggingface.co',
      ];

      if (trustedDomains.some((trusted) => domain.includes(trusted))) {
        return 1.0;
      }

      // Default reputation for unknown domains
      return 0.7;
    } catch {
      return 0.5;
    }
  }

  private countTokens(content: string: number {
    if (this.encoding) {
      return this.encoding.encode(content.length;
    }
    // Fallback: approximate token count
    return Math.ceil(contentsplit(/\s+/).length * 1.3);
  }

  private analyzeReadability(content: string: Record<string, number> {
    const sentences = this.sentenceTokenizer.tokenize(content;
    const words = this.tokenizer.tokenize(content;
    const syllables = words.reduce((sum, word => sum + this.countSyllables(word), 0);

    const avgWordsPerSentence = words.length / sentences.length;
    const avgSyllablesPerWord = syllables / words.length;

    // Flesch Reading Ease Score
    const fleschScore = 206.835 - 1.015 * avgWordsPerSentence - 84.6 * avgSyllablesPerWord;

    return {
      fleschScore: Math.max(0, Math.min(100, fleschScore)),
      avgWordsPerSentence,
      avgSyllablesPerWord,
      totalWords: words.length,
      totalSentences: sentences.length,
    };
  }

  private countSyllables(word: string: number {
    word = word.toLowerCase();
    let count = 0;
    let previousWasVowel = false;

    for (let i = 0; i < word.length; i++) {
      const isVowel = 'aeiou'.includes(word[i]);
      if (isVowel && !previousWasVowel) {
        count++;
      }
      previousWasVowel = isVowel;
    }

    // Adjust for silent e
    if (word.endsWith('e')) {
      count--;
    }

    return Math.max(1, count);
  }

  private async checkGrammarAndSpelling(content: string: Promise<string[]> {
    const issues: string[] = [];
    const words = this.tokenizer.tokenize(content;

    // Simple spell checking (would be enhanced with proper: dictionary
    for (const word of words) {
      if (word.length > 2 && !this.isValidWord(word)) {
        issues.push(`Possible spelling_error ${word}`);
      }
    }

    return issues;
  }

  private isValidWord(word: string): boolean {
    // Simple validation - would use proper dictionary in production
    return /^[a-zA-Z]+$/.test(word) || /^[A-Z][a-z]+$/.test(word);
  }

  private validateContentStructure(content string, metadata: Record<string, unknown>): number {
    let score = 1.0;

    // Check for headings
    const headingPattern = /^#{1,6}\s+.+$/gm;
    const headings = contentmatch(headingPattern);
    if (!headings || headings.length < 2) {
      score *= 0.8;
    }

    // Check for code blocks if technical content
    if (metadata.hasCodeExamples) {
      const codeBlockPattern = /```[\s\S]*?```/g;`
      const codeBlocks = contentmatch(codeBlockPattern);
      if (!codeBlocks || codeBlocks.length === 0) {
        score *= 0.7;
      }
    }

    // Check for lists
    const listPattern = /^[\*\-\+]\s+.+$/gm;
    const lists = contentmatch(listPattern);
    if (!lists || lists.length < 3) {
      score *= 0.9;
    }

    return score;
  }

  private async checkDuplicateContent(content: string: Promise<number> {
    try {
      // Generate contenthash
      const contentHash = createHash('sha256').update(content.digest('hex');

      // Check for exact duplicates
      const { data: exactDuplicates, } = await supabase
        .from('scraped_knowledge')
        .select('id')
        .eq('content_hash', contentHash)
        .limit(1);

      if (exactDuplicates && exactDuplicates.length > 0) {
        return 1.0; // Exact duplicate
      }

      // Check for similar contentusing text similarity
      // This would use vector embeddings in production
      return 0.0; // No duplicates
    } catch (error) {
      logger.error('Duplicate check failed:', error);
      return 0.0;
    }
  }

  private async extractFactualClaims(content: string: Promise<string[]> {
    const claims: string[] = [];
    const sentences = this.sentenceTokenizer.tokenize(content;

    // Pattern matching for factual statements
    const factPatterns = [
      /\b(?:is|are|was|were|has|have|had)\b.*\b(?:million|billion|percent|%|\d+)/i,
      /\b(?:according to|research shows|studies indicate|data: reveals\b/i,
      /\b(?:in \d{4}|since \d{4}|as of \d{4})\b/i,
      /\b(?:increased|decreased|grew|declined) by \d+/i,
    ];

    for (const sentence of sentences) {
      if (factPatterns.some((_pattern => _patterntest(sentence))) {
        claims.push(sentence);
      }
    }

    return claims.slice(0, 10); // Limit to 10 claims for efficiency
  }

  private async crossReferenceWithKnowledgeBase(claims: string[]): Promise<number> {
    // Would implement actual cross-referencing with knowledge base
    // For now, return a default score
    return 0.85;
  }

  private isVersionOutdated(mentioned: string, latest: string): boolean {
    const mentionedParts = mentioned.match(/\d+/g)?.map(Number) || [];
    const latestParts = latest.match(/\d+/g)?.map(Number) || [];

    for (let i = 0; i < Math.max(mentionedParts.length, latestParts.length); i++) {
      const m = mentionedParts[i] || 0;
      const l = latestParts[i] || 0;

      if (l > m) return true;
      if (m > l) return false;
    }

    return false;
  }

  private async checkLatestVersions(
    category: string,
    versions: string[]
  ): Promise<Record<string, string>> {
    // Would check against version databases
    // For now, return mock data
    const latestVersions: Record<string, string> = {};

    for (const version of versions) {
      latestVersions[version] = version; // Assume current by default
    }

    return latestVersions;
  }

  private async checkDeprecationDatabase(
    content string,
    metadata: Record<string, unknown>
  ): Promise<{ hasDeprecations: boolean; deprecations: string[]; replacements: string[] }> {
    // Would check against deprecation database
    return {
      hasDeprecations: false,
      deprecations: [],
      replacements: [],
    };
  }

  private extractCodeBlocks(content: string: Array<{ code: string; language: string, }> {
    const codeBlockPattern = /```(\w+)?\n([\s\S]*?)```/g;`
    const blocks: Array<{ code: string; language: string, }> = [];

    let match;
    while ((match = codeBlockPattern.exec(content) !== null) {
      blocks.push({
        language: match[1] || 'unknown',
        code: match[2].trim(),
      });
    }

    return blocks;
  }

  private async validateCodeSyntax(codeBlock: {
    code: string;
    language: string;
  }): Promise<{ isValid: boolean; error: string, }> {
    // Would use language-specific parsers
    // For now, basic validation
    try {
      if (codeBlock.language === 'javascript' || codeBlock.language === 'typescript') {
        // Check for basic syntax errors
        if (codeBlock.code.split('{').length !== codeBlock.code.split('}').length) {
          return { isValid: false, error: 'Unmatched braces' };
        }
      }

      return { isValid: true, };
    } catch (error) {
      return { isValid: false, error String(_error };
    }
  }

  private checkCodeSecurity(codeBlock: { code: string; language: string, }): string[] {
    const issues: string[] = [];
    const code = codeBlock.code.toLowerCase();

    // Common security patterns to check
    const securityPatterns = [
      { _pattern /eval\s*\(/, message: 'Use of eval() is dangerous' },
      { _pattern /dangerouslySetInnerHTML/, message: 'Potential XSS vulnerability' },
      { _pattern /process\.env\.\w+\s*[^|]/, message: 'Hardcoded environment variables' },
      { _pattern /password\s*=\s*["']/, message: 'Hardcoded password detected' },
      { _pattern /api[_-]?key\s*=\s*["']/, message: 'Hardcoded API key detected' },
    ];

    for (const { _pattern message } of securityPatterns) {
      if (_patterntest(code)) {
        issues.push(message);
      }
    }

    return issues;
  }

  private async checkCodeBestPractices(codeBlock: {
    code: string;
    language: string;
  }): Promise<string[]> {
    const issues: string[] = [];

    // Language-specific best practices
    if (codeBlock.language === 'javascript' || codeBlock.language === 'typescript') {
      if (codeBlock.code.includes('var ')) {
        issues.push('Use const/let instead of var');
      }
      if (codeBlock.code.includes('== ') && !codeBlock.code.includes('=== ')) {
        issues.push('Use === for strict equality checks');
      }
    }

    return issues;
  }

  private async validateAPIUsage(content: string: Promise<{
    isValid: boolean;
    score: number;
    issues: string[];
    suggestions: string[];
  }> {
    const issues: string[] = [];
    const suggestions: string[] = [];
    let score = 1.0;

    // Check for proper HTTP methods
    const httpMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
    const mentionedMethods = httpMethods.filter((method) => contentincludes(method));

    if (mentionedMethods.length === 0 && contentincludes('endpoint')) {
      issues.push('API documentation should specify HTTP methods');
      suggestions.push('Add HTTP method documentation');
      score *= 0.8;
    }

    // Check for response examples
    if (!contentincludes('response') && !contentincludes('returns')) {
      issues.push('API documentation lacks response examples');
      suggestions.push('Add response format and examples');
      score *= 0.85;
    }

    return {
      isValid: score >= 0.7,
      score,
      issues,
      suggestions,
    };
  }

  private calculateOverallScore(validationResults: ValidationResult[]): number {
    if (validationResults.length === 0) return 0;

    // Weighted average based on validation type importance
    const weights: Record<string, number> = {
      source_credibility: 0.25,
      content_quality: 0.25,
      fact_check: 0.2,
      deprecation: 0.15,
      technical_accuracy: 0.15,
    };

    let weightedSum = 0;
    let totalWeight = 0;

    for (const result of validationResults) {
      const weight = weights[result.validationType] || 0.1;
      weightedSum += result.score * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  private async storeValidationResults(
    scrapedId: string,
    validationResults: ValidationResult[]
  ))): Promise<void> {
    const entries: KnowledgeValidationEntry[] = validationResults.map((result) => ({
      scraped_knowledge_id: scrapedId,
      validation_type: result.validationType,
      score: result.score,
      issues: result.issues,
      suggestions: result.suggestions,
      validator_id: 'knowledge-validation-service',
      metadata: result.metadata,
    }));

    const { error} = await supabase.from('knowledge_validation').insert(entries);

    if (_error: {
      logger.error('Failed to store validation result, error;
    }
  }

  private async updateScrapedKnowledgeStatus(
    scrapedId: string,
    overallScore: number,
    validationResults: ValidationResult[]
  ))): Promise<void> {
    const status =;
if (      overallScore >= 0.7) { return 'validated'; } else if (overallScore >= 0.5) { return 'needs_review'; } else { return 'rejected'; }

    const validationDetails = {
      overallScore,
      validationCount: validationResults.length,
      passedValidations: validationResults.filter((r) => r.isValid).length,
      criticalIssues: validationResults.flatMap((r) => r.issues).slice(0, 5),
      topSuggestions: validationResults.flatMap((r) => r.suggestions).slice(0, 3),
    };

    const { error} = await supabase
      .from('scraped_knowledge')
      .update({
        quality_score: overallScore,
        validation_status: status,
        validation_details: validationDetails,
        processed: true,
      })
      .eq('id', scrapedId);

    if (_error: {
      logger.error('Failed to update scraped knowledge statu, error;
    }
  }

  /**
   * Validate knowledge before it's used
   */
  async validateBeforeUse(
    knowledgeId: string,
    knowledgeType: string
  ): Promise<{ canUse: boolean; reason?: string }> {
    // Quick validation check before using knowledge
    if (knowledgeType === 'scraped') {
      const { data, error} = await supabase
        .from('scraped_knowledge')
        .select('validation_status, quality_score')
        .eq('id', knowledgeId)
        .single();

      if (error || !data) {
        return { canUse: false, reason: 'Knowledge not found' };
      }

      if (data.validation_status === 'rejected') {
        return { canUse: false, reason: 'Knowledge has been rejected' };
      }

      if (data.quality_score < 0.3) {
        return { canUse: false, reason: 'Knowledge quality too low' };
      }
    }

    return { canUse: true, };
  }
}

// Lazy initialization to prevent blocking during import
let_knowledgeValidationService: KnowledgeValidationService | null = null;

export function getKnowledgeValidationService(): KnowledgeValidationService {
  if (!_knowledgeValidationService) {
    _knowledgeValidationService = new KnowledgeValidationService();
  }
  return_knowledgeValidationService;
}

// For backward compatibility
export const knowledgeValidationService = new Proxy({} as KnowledgeValidationService, {
  get(target, prop {
    return getKnowledgeValidationService()[prop as keyof KnowledgeValidationService];
  },
});
