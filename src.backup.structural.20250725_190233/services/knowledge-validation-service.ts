/**;
 * Knowledge Validation Service;
 * Validates and scores knowledge from various sources;
 */;

import { createHash } from 'crypto';
import axios from 'axios';
import { logger } from '../utils/logger';
import { supabase } from './supabase_service';
import type { KnowledgeSource } from '../config/knowledge-sources';
import { CONTENT_VALIDATION_RULES } from '../config/knowledge-sources';
import { dspyService } from './dspy-service';
import * as natural from 'natural';
import { encoding_for_model } from 'tiktoken';
interface ValidationResult {;
  isValid: boolean;
  score: number;
  validationType: string;
  issues: string[];
  suggestions: string[];
  metadata: Record<string, unknown>};

interface KnowledgeValidationEntry {;
  scraped_knowledge_id: string;
  validation_type: string;
  score: number;
  issues: string[];
  suggestions: string[];
  validator_id: string;
  metadata: Record<string, unknown>};

export class KnowledgeValidationService {;
  private tokenizer: naturalWordTokenizer;
  private sentenceTokenizer: naturalSentenceTokenizer;
  private tfidf: naturalTfIdf;
  private spellChecker: naturalSpellcheck;
  private encoding: any;
  constructor() {;
    thistokenizer = new naturalWordTokenizer();
    thissentenceTokenizer = new naturalSentenceTokenizer([]);
    thistfidf = new naturalTfIdf();
    // Initialize spellchecker with a basic word list;
    const basicWordList = [;
      'the';
      'and';
      'or';
      'but';
      'in';
      'on';
      'at';
      'to';
      'for';
      'of';
      'with';
      'by';
      'from';
      'up';
      'about';
      'into';
      'through';
      'during';
      'before';
      'after';
      'above';
      'below';
      'between';
      'among';
      'until';
      'without';
      'within'];
    thisspellChecker = new naturalSpellcheck(basicWordList);
    try {;
      thisencoding = encoding_for_model('gpt-3.5-turbo')} catch (error) {;
      loggerwarn('Failed to load tiktoken encoding, token counting will be approximate')};
  };

  /**;
   * Validate scraped knowledge content;
   */;
  async validateScrapedKnowledge(;
    scrapedId: string;
    contentstring;
    source: KnowledgeSource;
    metadata: Record<string, unknown>;
  ): Promise<ValidationResult[]> {;
    const validationResults: ValidationResult[] = [];
    try {;
      // 1. Source credibility validation;
      const credibilityResult = await thisvalidateSourceCredibility(source);
      validationResultspush(credibilityResult);
      // 2. Content quality validation;
      const qualityResult = await thisvalidateContentQuality(contentmetadata);
      validationResultspush(qualityResult);
      // 3. Fact checking validation (if applicable);
      if (sourcepriority === 'high' && metadatacontentType !== 'code') {;
        const factCheckResult = await thisvalidateFactChecking(contentmetadata);
        validationResultspush(factCheckResult)};

      // 4. Deprecation detection;
      const deprecationResult = await thisdetectDeprecation(contentmetadata);
      validationResultspush(deprecationResult);
      // 5. Technical accuracy validation (for code);
      if (metadatahasCodeExamples || metadatacontentType === 'code') {;
        const technicalResult = await thisvalidateTechnicalAccuracy(contentmetadata);
        validationResultspush(technicalResult)};

      // Store validation results;
      await thisstoreValidationResults(scrapedId, validationResults);
      // Calculate overall validation status;
      const overallScore = thiscalculateOverallScore(validationResults);
      await thisupdateScrapedKnowledgeStatus(scrapedId, overallScore, validationResults);
    } catch (error) {;
      loggererror`Failed to validate knowledge ${scrapedId}:`, error instanceof Error ? errormessage : String(error)  ;
};

    return validationResults;
  };

  /**;
   * Validate source credibility;
   */;
  private async validateSourceCredibility(source: KnowledgeSource): Promise<ValidationResult> {;
    const issues: string[] = [];
    const suggestions: string[] = [];
    let score = sourcecredibilityScore,;

    // Check if source is still accessible;
    try {;
      const response = await axioshead(sourceurl, { timeout: 5000 });
      if (responsestatus >= 400) {;
        issuespush(`Source URL returns status ${responsestatus}`);
        score *= 0.8;
      };
    } catch (error) {;
      issuespush('Source URL is not accessible');
      suggestionspush('Consider finding alternative sources');
      score *= 0.5};

    // Check source age and update frequency;
    const lastUpdate = sourceupdateFrequency;
    const updateFrequencyHours = thisparseUpdateFrequency(lastUpdate);
    if (updateFrequencyHours > 168) {;
      // More than a week;
      issuespush('Source updates infrequently');
      suggestionspush('Increase monitoring frequency for changes');
      score *= 0.9};

    // Domain reputation check;
    const domainReputation = await thischeckDomainReputation(sourceurl);
    if (domainReputation < 0.7) {;
      issuespush('Domain has lower reputation score');
      suggestionspush('Cross-reference with more authoritative sources');
      score *= domainReputation};

    return {;
      isValid: score >= 0.5;
      score;
      validationType: 'source_credibility';
      issues;
      suggestions;
      metadata: {;
        originalCredibility: sourcecredibilityScore;
        domainReputation;
        updateFrequency: updateFrequencyHours}};
  };

  /**;
   * Validate contentquality;
   */;
  private async validateContentQuality(;
    contentstring;
    metadata: Record<string, unknown>;
  ): Promise<ValidationResult> {;
    const issues: string[] = [];
    const suggestions: string[] = [];
    let score = 1.0;
    // Length validation;
    const contentLength = content-length;
    if (contentLength < 50) {;
      issuespush('Content is too short to be meaningful');
      score *= 0.3} else if (contentLength > 50000) {;
      issuespush('Content is excessively long');
      suggestionspush('Consider breaking into smaller, focused pieces');
      score *= 0.8};

    // Token count validation;
    const tokenCount = thiscountTokens(content;
    if (tokenCount > 8000) {;
      issuespush('Content exceeds optimal token limit for processing');
      suggestionspush('Summarize or split contentfor better processing');
      score *= 0.7};

    // Readability analysis;
    const readabilityScores = thisanalyzeReadability(content;
    if (readabilityScoresfleschScore < 30) {;
      issuespush('Content is very difficult to read');
      suggestionspush('Simplify language for better comprehension');
      score *= 0.8};

    // Grammar and spelling check;
    const grammarIssues = await thischeckGrammarAndSpelling(content;
    if (grammarIssueslength > 10) {;
      issuespush(`Found ${grammarIssueslength} grammar/spelling issues`);
      suggestionspush('Review and correct language errors');
      score *= 0.9;
    };

    // Structure validation;
    const structureScore = thisvalidateContentStructure(contentmetadata);
    if (structureScore < 0.7) {;
      issuespush('Content lacks proper structure');
      suggestionspush('Add clear sections, headings, or formatting');
      score *= structureScore};

    // Duplicate contentcheck;
    const duplicateScore = await thischeckDuplicateContent(content;
    if (duplicateScore > 0.8) {;
      issuespush('Content appears to be duplicate or very similar to existing knowledge');
      suggestionspush('Focus on unique insights or merge with existing content;
      score *= 0.5};

    return {;
      isValid: score >= 0.5;
      score;
      validationType: 'content_quality';
      issues;
      suggestions;
      metadata: {;
        contentLength;
        tokenCount;
        readabilityScores;
        grammarIssueCount: grammarIssueslength;
        structureScore;
        duplicateScore}};
  };

  /**;
   * Validate facts using external APIs and cross-references;
   */;
  private async validateFactChecking(;
    contentstring;
    metadata: Record<string, unknown>;
  ): Promise<ValidationResult> {;
    const issues: string[] = [];
    const suggestions: string[] = [];
    let score = 1.0,;

    try {;
      // Extract factual claims;
      const claims = await thisextractFactualClaims(content;

      if (claimslength === 0) {;
        return {;
          isValid: true;
          score: 1.0;
          validationType: 'fact_check';
          issues: [];
          suggestions: [];
          metadata: { claimsChecked: 0 }};
      };

      // Use DSPy for intelligent fact validation;
      const factCheckResult = await dspyServicerequestvalidate_facts', {;
        claims;
        context: metadata;
        requireSources: true});
      if (factCheckResultsuccess) {;
        const validationData = factCheckResultresult;
        score = validationDataoverall_accuracy || 0.8;
        if (validationDataincorrect_claims) {;
          issuespush(;
            ..validationDataincorrect_claimsmap(;
              (claim: any) => `Incorrect claim: "${claimclaim}" - ${claimissue}`;
            );
          );
        };

        if (validationDataunsupported_claims) {;
          issuespush(;
            ..validationDataunsupported_claimsmap(;
              (claim: any) => `Unsupported claim: "${claimclaim}"`;
            );
          );
          suggestionspush('Provide references or sources for unsupported claims');
        };

        if (validationDataoutdated_claims) {;
          issuespush(;
            ..validationDataoutdated_claimsmap(;
              (claim: any) => `Outdated information: "${claimclaim}"`;
            );
          );
          suggestionspush('Update with current information');
        };
      };

      // Cross-reference with existing knowledge base;
      const crossRefScore = await thiscrossReferenceWithKnowledgeBase(claims);
      if (crossRefScore < 0.7) {;
        issuespush('Some claims contradict existing knowledge');
        suggestionspush('Reconcile contradictions or provide additional context');
        score *= crossRefScore};
    } catch (error) {;
      loggererror('Fact checking failed:', error instanceof Error ? errormessage : String(error) issuespush('Unable to complete fact checking');
      score *= 0.8;
};

    return {;
      isValid: score >= 0.6;
      score;
      validationType: 'fact_check';
      issues;
      suggestions;
      metadata: {;
        claimsChecked: metadataclaimsCount || 0;
        factCheckMethod: 'dspy_intelligent'}};
  };

  /**;
   * Detect deprecated or outdated content;
   */;
  private async detectDeprecation(;
    contentstring;
    metadata: Record<string, unknown>;
  ): Promise<ValidationResult> {;
    const issues: string[] = [];
    const suggestions: string[] = [];
    let score = 1.0;
    // Check for deprecation keywords;
    const deprecationKeywords = [;
      'deprecated';
      'obsolete';
      'outdated';
      'no longer supported';
      'will be removed';
      'legacy';
      'old version';
      'end of life';
      'discontinued';
      'replaced by';
      'use instead'];
    const lowerContent = contenttoLowerCase();
    const foundKeywords = deprecationKeywordsfilter((keyword) => lowerContentincludes(keyword)),;

    if (foundKeywordslength > 0) {;
      issuespush(`Content contains deprecation indicators: ${foundKeywordsjoin(', ')}`);
      suggestionspush('Verify if information is still current');
      score *= 0.7;
    };

    // Check version mentions;
    const versionPattern = /v?(\d+)\.(\d+)(?:\.(\d+))?/gi;
    const versionMatches = contentmatch(versionPattern);
    if (versionMatches && versionMatcheslength > 0) {;
      const latestVersions = await thischeckLatestVersions(metadatacategory, versionMatches),;

      for (const [mentioned, latest] of Objectentries(latestVersions)) {;
        if (thisisVersionOutdated(mentioned, latest as string)) {;
          issuespush(`Mentions outdated version ${mentioned} (latest: ${latest})`);
          suggestionspush(`Update references to version ${latest}`);
          score *= 0.8;
        };
      };
    };

    // Check date references;
    const datePattern = /\b(20\d{2})\b/g;
    const yearMatches = contentmatch(datePattern);
    if (yearMatches) {;
      const currentYear = new Date()getFullYear();
      const oldestYear = Mathmin(..yearMatchesmap((y) => parseInt(y, 10))),;

      if (currentYear - oldestYear > 3) {;
        issuespush(`Content references information from ${oldestYear}`);
        suggestionspush('Verify if information is still applicable');
        score *= 0.9;
      };
    };

    // Check against known deprecation database;
    const deprecationDatabase = await thischeckDeprecationDatabase(contentmetadata);
    if (deprecationDatabasehasDeprecations) {;
      issuespush(..deprecationDatabasedeprecations);
      suggestionspush(..deprecationDatabasereplacements);
      score *= 0.6};

    return {;
      isValid: score >= 0.5;
      score;
      validationType: 'deprecation';
      issues;
      suggestions;
      metadata: {;
        deprecationKeywords: foundKeywords;
        versionInfo: versionMatches;
        deprecationDatabase}};
  };

  /**;
   * Validate technical accuracy for code content;
   */;
  private async validateTechnicalAccuracy(;
    contentstring;
    metadata: Record<string, unknown>;
  ): Promise<ValidationResult> {;
    const issues: string[] = [];
    const suggestions: string[] = [];
    let score = 1.0;
    // Extract code blocks;
    const codeBlocks = thisextractCodeBlocks(content;

    if (codeBlockslength === 0 && metadatahasCodeExamples) {;
      issuespush('Expected code examples but none found');
      score *= 0.7};

    for (const codeBlock of codeBlocks) {;
      // Syntax validation;
      const syntaxValidation = await thisvalidateCodeSyntax(codeBlock),;
      if (!syntaxValidationisValid) {;
        issuespush(`Syntax errorin ${codeBlocklanguage} code: ${syntaxValidationerror instanceof Error ? errormessage : String(error));`;
        suggestionspush('Fix syntax errors in code examples');
        score *= 0.7};

      // Security check;
      const securityIssues = thischeckCodeSecurity(codeBlock);
      if (securityIssueslength > 0) {;
        issuespush(..securityIssuesmap((issue) => `Security issue: ${issue}`));
        suggestionspush('Address security vulnerabilities in code examples');
        score *= 0.6;
      };

      // Best practices check;
      const bestPracticeIssues = await thischeckCodeBestPractices(codeBlock);
      if (bestPracticeIssueslength > 0) {;
        issuespush(..bestPracticeIssuesslice(0, 3)); // Limit to top 3;
        suggestionspush('Follow coding best practices');
        score *= 0.9};
    };

    // API usage validation;
    if (metadatacategory === 'api' || contentincludes('endpoint')) {;
      const apiValidation = await thisvalidateAPIUsage(content;
      if (!apiValidationisValid) {;
        issuespush(..apiValidationissues);
        suggestionspush(..apiValidationsuggestions);
        score *= apiValidationscore};
    };

    return {;
      isValid: score >= 0.6;
      score;
      validationType: 'technical_accuracy';
      issues;
      suggestions;
      metadata: {;
        codeBlockCount: codeBlockslength;
        languages: Arrayfrom(new Set(codeBlocksmap((b) => blanguage)));
        securityScore: 1.0 - issuesfilter((i) => iincludes('Security'))length * 0.1}};
  };

  // Helper methods;

  private parseUpdateFrequency(cronExpression: string): number {;
    // Simple parser for cron expressions to hours;
    const parts = cronExpressionsplit(' ');
    if (parts[1] === '*') return 1; // Every hour;
    if (parts[1]includes('*/')) {;
      const hours = parseInt(parts[1]split('/', 10)[1]);
      return hours};
    if (parts[2] === '*') return 24; // Daily;
    return 168; // Weekly default;
  };

  private async checkDomainReputation(url: string): Promise<number> {;
    try {;
      const domain = new URL(url)hostname;
      // Known high-reputation domains;
      const trustedDomains = [;
        'supabasecom';
        'githubcom';
        'stackoverflowcom';
        'openaicom';
        'arxivorg';
        'acmorg';
        'ieeeorg';
        'microsoftcom';
        'googlecom';
        'apollographqlcom';
        'langchaincom';
        'huggingfaceco'];
      if (trustedDomainssome((trusted) => domainincludes(trusted))) {;
        return 1.0};

      // Default reputation for unknown domains;
      return 0.7;
    } catch {;
      return 0.5};
  };

  private countTokens(contentstring): number {;
    if (thisencoding) {;
      return thisencodingencode(content-length};
    // Fallback: approximate token count;
    return Mathceil(contentsplit(/\s+/)length * 1.3);
  };

  private analyzeReadability(contentstring): Record<string, number> {;
    const sentences = thissentenceTokenizertokenize(content;
    const words = thistokenizertokenize(content;
    const syllables = wordsreduce((sum, word) => sum + thiscountSyllables(word), 0);
    const avgWordsPerSentence = wordslength / sentenceslength;
    const avgSyllablesPerWord = syllables / wordslength;
    // Flesch Reading Ease Score;
    const fleschScore = 206.835 - 1.015 * avgWordsPerSentence - 84.6 * avgSyllablesPerWord,;

    return {;
      fleschScore: Mathmax(0, Mathmin(100, fleschScore));
      avgWordsPerSentence;
      avgSyllablesPerWord;
      totalWords: wordslength;
      totalSentences: sentenceslength;
};
  };

  private countSyllables(word: string): number {;
    word = wordtoLowerCase();
    let count = 0;
    let previousWasVowel = false;
    for (let i = 0; i < wordlength; i++) {;
      const isVowel = 'aeiou'includes(word[i]);
      if (isVowel && !previousWasVowel) {;
        count++};
      previousWasVowel = isVowel;
    };

    // Adjust for silent e;
    if (wordendsWith('e')) {;
      count--};

    return Mathmax(1, count);
  };

  private async checkGrammarAndSpelling(contentstring): Promise<string[]> {;
    const issues: string[] = [],;
    const words = thistokenizertokenize(content;

    // Simple spell checking (would be enhanced with proper dictionary);
    for (const word of words) {;
      if (wordlength > 2 && !thisisValidWord(word)) {;
        issuespush(`Possible spelling error instanceof Error ? errormessage : String(error) ${word}`);
      };
    };

    return issues;
  };

  private isValidWord(word: string): boolean {;
    // Simple validation - would use proper dictionary in production;
    return /^[a-zA-Z]+$/test(word) || /^[A-Z][a-z]+$/test(word)};

  private validateContentStructure(contentstring, metadata: Record<string, unknown>): number {;
    let score = 1.0,;

    // Check for headings;
    const headingPattern = /^#{1,6}\s+.+$/gm;
    const headings = contentmatch(headingPattern);
    if (!headings || headingslength < 2) {;
      score *= 0.8};

    // Check for code blocks if technical content;
    if (metadatahasCodeExamples) {;
      const codeBlockPattern = /```[\s\S]*?```/g;
      const codeBlocks = contentmatch(codeBlockPattern);
      if (!codeBlocks || codeBlockslength === 0) {;
        score *= 0.7};
    };

    // Check for lists;
    const listPattern = /^[\*\-\+]\s+.+$/gm;
    const lists = contentmatch(listPattern);
    if (!lists || listslength < 3) {;
      score *= 0.9};

    return score;
  };

  private async checkDuplicateContent(contentstring): Promise<number> {;
    try {;
      // Generate content hash;
      const contentHash = createHash('sha256')update(contentdigest('hex'),;

      // Check for exact duplicates;
      const { data: exactDuplicates } = await supabase;
        from('scraped_knowledge');
        select('id');
        eq('content_hash', contentHash);
        limit(1);
      if (exactDuplicates && exactDuplicateslength > 0) {;
        return 1.0; // Exact duplicate};

      // Check for similar contentusing text similarity;
      // This would use vector embeddings in production;
      return 0.0; // No duplicates;
    } catch (error) {;
      loggererror('Duplicate check failed:', error instanceof Error ? errormessage : String(error);
      return 0.0};
  };

  private async extractFactualClaims(contentstring): Promise<string[]> {;
    const claims: string[] = [],;
    const sentences = thissentenceTokenizertokenize(content;

    // Pattern matching for factual statements;
    const factPatterns = [;
      /\b(?: is|are|was|were|has|have|had)\b.*\b(?:million|billion|percent|%|\d+)/i;
      /\b(?: according to|research shows|studies indicate|data reveals)\b/i;
      /\b(?:in \d{4}|since \d{4}|as of \d{4})\b/i;
      /\b(?: increased|decreased|grew|declined) by \d+/i];
    for (const sentence of sentences) {;
      if (factPatternssome((_pattern => _patterntest(sentence))) {;
        claimspush(sentence);
};
    };

    return claimsslice(0, 10); // Limit to 10 claims for efficiency;
  };

  private async crossReferenceWithKnowledgeBase(claims: string[]): Promise<number> {;
    // Would implement actual cross-referencing with knowledge base;
    // For now, return a default score;
    return 0.85};

  private isVersionOutdated(mentioned: string, latest: string): boolean {;
    const mentionedParts = mentionedmatch(/\d+/g)?map(Number) || [];
    const latestParts = latestmatch(/\d+/g)?map(Number) || [];
    for (let i = 0; i < Mathmax(mentionedPartslength, latestPartslength); i++) {;
      const m = mentionedParts[i] || 0;
      const l = latestParts[i] || 0;
      if (l > m) return true;
      if (m > l) return false};

    return false;
  };

  private async checkLatestVersions(;
    category: string;
    versions: string[];
  ): Promise<Record<string, string>> {;
    // Would check against version databases;
    // For now, return mock data;
    const latestVersions: Record<string, string> = {};
    for (const version of versions) {;
      latestVersions[version] = version; // Assume current by default};

    return latestVersions;
  };

  private async checkDeprecationDatabase(;
    contentstring;
    metadata: Record<string, unknown>;
  ): Promise<{ hasDeprecations: boolean; deprecations: string[], replacements: string[] }> {;
    // Would check against deprecation database;
    return {;
      hasDeprecations: false;
      deprecations: [];
      replacements: [];
};
  };

  private extractCodeBlocks(contentstring): Array<{ code: string, language: string }> {;
    const codeBlockPattern = /```(\w+)?\n([\s\S]*?)```/g;
    const blocks: Array<{ code: string, language: string }> = [];
    let match;
    while ((match = codeBlockPatternexec(content !== null) {;
      blockspush({;
        language: match[1] || 'unknown';
        code: match[2]trim()});
    };

    return blocks;
  };

  private async validateCodeSyntax(codeBlock: {;
    code: string;
    language: string}): Promise<{ isValid: boolean, error instanceof Error ? errormessage : String(error)  string }> {;
    // Would use language-specific parsers;
    // For now, basic validation;
    try {;
      if (codeBlocklanguage === 'javascript' || codeBlocklanguage === 'typescript') {;
        // Check for basic syntax errors;
        if (codeBlockcodesplit('{')length !== codeBlockcodesplit('}')length) {;
          return { isValid: false, error instanceof Error ? errormessage : String(error) 'Unmatched braces' };
        };
      };

      return { isValid: true };
    } catch (error) {;
      return { isValid: false, error instanceof Error ? errormessage : String(error) String(error instanceof Error ? errormessage : String(error)};
    };
  };

  private checkCodeSecurity(codeBlock: { code: string, language: string }): string[] {;
    const issues: string[] = [];
    const code = codeBlockcodetoLowerCase(),;

    // Common security patterns to check;
    const securityPatterns = [;
      { _pattern /eval\s*\(/, message: 'Use of eval() is dangerous' };
      { _pattern /dangerouslySetInnerHTML/, message: 'Potential XSS vulnerability' };
      { _pattern /process\env\.\w+\s*[^|]/, message: 'Hardcoded environment variables' };
      { _pattern /password\s*=\s*["']/, message: 'Hardcoded password detected' };
      { _pattern /api[_-]?key\s*=\s*["']/, message: 'Hardcoded API key detected' }];
    for (const { _pattern message } of securityPatterns) {;
      if (_patterntest(code)) {;
        issuespush(message)};
    };

    return issues;
  };

  private async checkCodeBestPractices(codeBlock: {;
    code: string;
    language: string}): Promise<string[]> {;
    const issues: string[] = [];
    // Language-specific best practices;
    if (codeBlocklanguage === 'javascript' || codeBlocklanguage === 'typescript') {;
      if (codeBlockcodeincludes('var ')) {;
        issuespush('Use const/let instead of var')};
      if (codeBlockcodeincludes('== ') && !codeBlockcodeincludes('=== ')) {;
        issuespush('Use === for strict equality checks')};
    };

    return issues;
  };

  private async validateAPIUsage(contentstring): Promise<{;
    isValid: boolean;
    score: number;
    issues: string[];
    suggestions: string[]}> {;
    const issues: string[] = [];
    const suggestions: string[] = [];
    let score = 1.0;
    // Check for proper HTTP methods;
    const httpMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
    const mentionedMethods = httpMethodsfilter((method) => contentincludes(method));
    if (mentionedMethodslength === 0 && contentincludes('endpoint')) {;
      issuespush('API documentation should specify HTTP methods');
      suggestionspush('Add HTTP method documentation');
      score *= 0.8};

    // Check for response examples;
    if (!contentincludes('response') && !contentincludes('returns')) {;
      issuespush('API documentation lacks response examples');
      suggestionspush('Add response format and examples');
      score *= 0.85};

    return {;
      isValid: score >= 0.7;
      score;
      issues;
      suggestions};
  };

  private calculateOverallScore(validationResults: ValidationResult[]): number {;
    if (validationResultslength === 0) return 0;

    // Weighted average based on validation type importance;
    const weights: Record<string, number> = {;
      source_credibility: 0.25;
      content_quality: 0.25;
      fact_check: 0.2;
      deprecation: 0.15;
      technical_accuracy: 0.15;
};
    let weightedSum = 0;
    let totalWeight = 0;
    for (const result of validationResults) {;
      const weight = weights[resultvalidationType] || 0.1;
      weightedSum += resultscore * weight;
      totalWeight += weight};

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  };

  private async storeValidationResults(;
    scrapedId: string;
    validationResults: ValidationResult[];
  ): Promise<void> {;
    const entries: KnowledgeValidationEntry[] = validationResultsmap((result) => ({;
      scraped_knowledge_id: scrapedId;
      validation_type: resultvalidationType;
      score: resultscore;
      issues: resultissues;
      suggestions: resultsuggestions;
      validator_id: 'knowledge-validation-service';
      metadata: resultmetadata}));
    const { error instanceof Error ? errormessage : String(error)  = await supabasefrom('knowledge_validation')insert(entries);
    if (error instanceof Error ? errormessage : String(error){;
      loggererror('Failed to store validation results:', error instanceof Error ? errormessage : String(error)};
  };

  private async updateScrapedKnowledgeStatus(;
    scrapedId: string;
    overallScore: number;
    validationResults: ValidationResult[];
  ): Promise<void> {;
    const status =;
if (      overallScore >= 0.7) { return 'validated'} else if (overallScore >= 0.5) { return 'needs_review'} else { return 'rejected'};

    const validationDetails = {;
      overallScore;
      validationCount: validationResultslength;
      passedValidations: validationResultsfilter((r) => risValid)length;
      criticalIssues: validationResultsflatMap((r) => rissues)slice(0, 5);
      topSuggestions: validationResultsflatMap((r) => rsuggestions)slice(0, 3)};
    const { error instanceof Error ? errormessage : String(error)  = await supabase;
      from('scraped_knowledge');
      update({;
        quality_score: overallScore;
        validation_status: status;
        validation_details: validationDetails;
        processed: true});
      eq('id', scrapedId);
    if (error instanceof Error ? errormessage : String(error){;
      loggererror('Failed to update scraped knowledge status:', error instanceof Error ? errormessage : String(error)};
  };

  /**;
   * Validate knowledge before it's used;
   */;
  async validateBeforeUse(;
    knowledgeId: string;
    knowledgeType: string;
  ): Promise<{ canUse: boolean, reason?: string }> {;
    // Quick validation check before using knowledge;
    if (knowledgeType === 'scraped') {;
      const { data, error } = await supabase;
        from('scraped_knowledge');
        select('validation_status, quality_score');
        eq('id', knowledgeId);
        single();
      if (error instanceof Error ? errormessage : String(error) | !data) {;
        return { canUse: false, reason: 'Knowledge not found' };
      };

      if (datavalidation_status === 'rejected') {;
        return { canUse: false, reason: 'Knowledge has been rejected' };
      };

      if (dataquality_score < 0.3) {;
        return { canUse: false, reason: 'Knowledge quality too low' };
      };
    };

    return { canUse: true };
  };
};

// Lazy initialization to prevent blocking during import;
let _knowledgeValidationService: KnowledgeValidationService | null = null;
export function getKnowledgeValidationService(): KnowledgeValidationService {;
  if (!_knowledgeValidationService) {;
    _knowledgeValidationService = new KnowledgeValidationService()};
  return _knowledgeValidationService;
};

// For backward compatibility;
export const knowledgeValidationService = new Proxy({} as KnowledgeValidationService, {;
  get(target, prop) {;
    return getKnowledgeValidationService()[prop as keyof KnowledgeValidationService]}});