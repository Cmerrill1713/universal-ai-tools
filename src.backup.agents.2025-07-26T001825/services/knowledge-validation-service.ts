/**
 * Knowledge Validation Service* Validates and scores knowledge from various sources*/

import { create.Hash } from 'crypto';
import axios from 'axios';
import { logger } from './utils/logger';
import { supabase } from './supabase_service';
import type { Knowledge.Source } from './config/knowledge-sources';
import { CONTENT_VALIDATION_RULE.S } from './config/knowledge-sources';
import { dspy.Service } from './dspy-service';
import * as natural from 'natural';
import { encoding_for_model } from 'tiktoken';
interface ValidationResult {
  is.Valid: boolean;
  score: number;
  validation.Type: string;
  issues: string[];
  suggestions: string[];
  metadata: Record<string, unknown>};

interface KnowledgeValidationEntry {
  scraped_knowledge_id: string;
  validation_type: string;
  score: number;
  issues: string[];
  suggestions: string[];
  validator_id: string;
  metadata: Record<string, unknown>};

export class KnowledgeValidation.Service {
  private tokenizer: naturalWord.Tokenizer;
  private sentence.Tokenizer: naturalSentence.Tokenizer;
  private tfidf: naturalTf.Idf;
  private spell.Checker: natural.Spellcheck;
  private encoding: any;
  constructor() {
    thistokenizer = new naturalWord.Tokenizer();
    thissentence.Tokenizer = new naturalSentence.Tokenizer([]);
    thistfidf = new naturalTf.Idf()// Initialize spellchecker with a basic word list;
    const basicWord.List = [
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
    thisspell.Checker = new natural.Spellcheck(basicWord.List);
    try {
      thisencoding = encoding_for_model('gpt-3.5-turbo')} catch (error) {
      loggerwarn('Failed to load tiktoken encoding, token counting will be approximate')}}/**
   * Validate scraped knowledge content*/
  async validateScraped.Knowledge(
    scraped.Id: string;
    contentstring;
    source: Knowledge.Source;
    metadata: Record<string, unknown>): Promise<Validation.Result[]> {
    const validation.Results: Validation.Result[] = [];
    try {
      // 1. Source credibility validation;
      const credibility.Result = await thisvalidateSource.Credibility(source);
      validation.Resultspush(credibility.Result)// 2. Content quality validation;
      const quality.Result = await thisvalidateContent.Quality(contentmetadata);
      validation.Resultspush(quality.Result)// 3. Fact checking validation (if applicable);
      if (sourcepriority === 'high' && metadatacontent.Type !== 'code') {
        const factCheck.Result = await thisvalidateFact.Checking(contentmetadata);
        validation.Resultspush(factCheck.Result)}// 4. Deprecation detection;
      const deprecation.Result = await thisdetect.Deprecation(contentmetadata);
      validation.Resultspush(deprecation.Result)// 5. Technical accuracy validation (for code);
      if (metadatahasCode.Examples || metadatacontent.Type === 'code') {
        const technical.Result = await thisvalidateTechnical.Accuracy(contentmetadata);
        validation.Resultspush(technical.Result)}// Store validation results;
      await thisstoreValidation.Results(scraped.Id, validation.Results)// Calculate overall validation status;
      const overall.Score = thiscalculateOverall.Score(validation.Results);
      await thisupdateScrapedKnowledge.Status(scraped.Id, overall.Score, validation.Results)} catch (error) {
      loggererror`Failed to validate knowledge ${scraped.Id}:`, error instanceof Error ? errormessage : String(error)  };

    return validation.Results}/**
   * Validate source credibility*/
  private async validateSource.Credibility(source: Knowledge.Source): Promise<Validation.Result> {
    const issues: string[] = [];
    const suggestions: string[] = [];
    let score = sourcecredibility.Score,

    // Check if source is still accessible;
    try {
      const response = await axioshead(sourceurl, { timeout: 5000 });
      if (responsestatus >= 400) {
        issuespush(`Source UR.L returns status ${responsestatus}`);
        score *= 0.8}} catch (error) {
      issuespush('Source UR.L is not accessible');
      suggestionspush('Consider finding alternative sources');
      score *= 0.5}// Check source age and update frequency;
    const last.Update = sourceupdate.Frequency;
    const updateFrequency.Hours = thisparseUpdate.Frequency(last.Update);
    if (updateFrequency.Hours > 168) {
      // More than a week;
      issuespush('Source updates infrequently');
      suggestionspush('Increase monitoring frequency for changes');
      score *= 0.9}// Domain reputation check;
    const domain.Reputation = await thischeckDomain.Reputation(sourceurl);
    if (domain.Reputation < 0.7) {
      issuespush('Domain has lower reputation score');
      suggestionspush('Cross-reference with more authoritative sources');
      score *= domain.Reputation};

    return {
      is.Valid: score >= 0.5;
      score;
      validation.Type: 'source_credibility';
      issues;
      suggestions;
      metadata: {
        original.Credibility: sourcecredibility.Score;
        domain.Reputation;
        update.Frequency: updateFrequency.Hours}}}/**
   * Validate contentquality*/
  private async validateContent.Quality(
    contentstring;
    metadata: Record<string, unknown>): Promise<Validation.Result> {
    const issues: string[] = [];
    const suggestions: string[] = [];
    let score = 1.0// Length validation;
    const content.Length = content-length;
    if (content.Length < 50) {
      issuespush('Content is too short to be meaningful');
      score *= 0.3} else if (content.Length > 50000) {
      issuespush('Content is excessively long');
      suggestionspush('Consider breaking into smaller, focused pieces');
      score *= 0.8}// Token count validation;
    const token.Count = thiscount.Tokens(content;
    if (token.Count > 8000) {
      issuespush('Content exceeds optimal token limit for processing');
      suggestionspush('Summarize or split contentfor better processing');
      score *= 0.7}// Readability analysis;
    const readability.Scores = thisanalyze.Readability(content;
    if (readabilityScoresflesch.Score < 30) {
      issuespush('Content is very difficult to read');
      suggestionspush('Simplify language for better comprehension');
      score *= 0.8}// Grammar and spelling check;
    const grammar.Issues = await thischeckGrammarAnd.Spelling(content;
    if (grammar.Issueslength > 10) {
      issuespush(`Found ${grammar.Issueslength} grammar/spelling issues`);
      suggestionspush('Review and correct language errors');
      score *= 0.9}// Structure validation;
    const structure.Score = thisvalidateContent.Structure(contentmetadata);
    if (structure.Score < 0.7) {
      issuespush('Content lacks proper structure');
      suggestionspush('Add clear sections, headings, or formatting');
      score *= structure.Score}// Duplicate contentcheck;
    const duplicate.Score = await thischeckDuplicate.Content(content;
    if (duplicate.Score > 0.8) {
      issuespush('Content appears to be duplicate or very similar to existing knowledge');
      suggestionspush('Focus on unique insights or merge with existing content;
      score *= 0.5};

    return {
      is.Valid: score >= 0.5;
      score;
      validation.Type: 'content_quality';
      issues;
      suggestions;
      metadata: {
        content.Length;
        token.Count;
        readability.Scores;
        grammarIssue.Count: grammar.Issueslength;
        structure.Score;
        duplicate.Score}}}/**
   * Validate facts using external AP.Is and cross-references*/
  private async validateFact.Checking(
    contentstring;
    metadata: Record<string, unknown>): Promise<Validation.Result> {
    const issues: string[] = [];
    const suggestions: string[] = [];
    let score = 1.0,

    try {
      // Extract factual claims;
      const claims = await thisextractFactual.Claims(content;

      if (claimslength === 0) {
        return {
          is.Valid: true;
          score: 1.0;
          validation.Type: 'fact_check';
          issues: [];
          suggestions: [];
          metadata: { claims.Checked: 0 }}}// Use DS.Py for intelligent fact validation;
      const factCheck.Result = await dspy.Servicerequestvalidate_facts', {
        claims;
        context: metadata;
        require.Sources: true});
      if (factCheck.Resultsuccess) {
        const validation.Data = factCheck.Resultresult;
        score = validation.Dataoverall_accuracy || 0.8;
        if (validation.Dataincorrect_claims) {
          issuespush(
            .validation.Dataincorrect_claimsmap(
              (claim: any) => `Incorrect claim: "${claimclaim}" - ${claimissue}`))};

        if (validation.Dataunsupported_claims) {
          issuespush(
            .validation.Dataunsupported_claimsmap(
              (claim: any) => `Unsupported claim: "${claimclaim}"`));
          suggestionspush('Provide references or sources for unsupported claims')};

        if (validation.Dataoutdated_claims) {
          issuespush(
            .validation.Dataoutdated_claimsmap(
              (claim: any) => `Outdated information: "${claimclaim}"`));
          suggestionspush('Update with current information')}}// Cross-reference with existing knowledge base;
      const crossRef.Score = await thiscrossReferenceWithKnowledge.Base(claims);
      if (crossRef.Score < 0.7) {
        issuespush('Some claims contradict existing knowledge');
        suggestionspush('Reconcile contradictions or provide additional context');
        score *= crossRef.Score}} catch (error) {
      loggererror('Fact checking failed:', error instanceof Error ? errormessage : String(error) issuespush('Unable to complete fact checking');
      score *= 0.8};

    return {
      is.Valid: score >= 0.6;
      score;
      validation.Type: 'fact_check';
      issues;
      suggestions;
      metadata: {
        claims.Checked: metadataclaims.Count || 0;
        factCheck.Method: 'dspy_intelligent'}}}/**
   * Detect deprecated or outdated content*/
  private async detect.Deprecation(
    contentstring;
    metadata: Record<string, unknown>): Promise<Validation.Result> {
    const issues: string[] = [];
    const suggestions: string[] = [];
    let score = 1.0// Check for deprecation keywords;
    const deprecation.Keywords = [
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
    const lower.Content = contenttoLower.Case();
    const found.Keywords = deprecation.Keywordsfilter((keyword) => lower.Contentincludes(keyword)),

    if (found.Keywordslength > 0) {
      issuespush(`Content contains deprecation indicators: ${found.Keywordsjoin(', ')}`);
      suggestionspush('Verify if information is still current');
      score *= 0.7}// Check version mentions;
    const version.Pattern = /v?(\d+)\.(\d+)(?:\.(\d+))?/gi;
    const version.Matches = contentmatch(version.Pattern);
    if (version.Matches && version.Matcheslength > 0) {
      const latest.Versions = await thischeckLatest.Versions(metadatacategory, version.Matches),

      for (const [mentioned, latest] of Objectentries(latest.Versions)) {
        if (thisisVersion.Outdated(mentioned, latest as string)) {
          issuespush(`Mentions outdated version ${mentioned} (latest: ${latest})`);
          suggestionspush(`Update references to version ${latest}`);
          score *= 0.8}}}// Check date references;
    const date.Pattern = /\b(20\d{2})\b/g;
    const year.Matches = contentmatch(date.Pattern);
    if (year.Matches) {
      const current.Year = new Date()getFull.Year();
      const oldest.Year = Math.min(.year.Matchesmap((y) => parse.Int(y, 10))),

      if (current.Year - oldest.Year > 3) {
        issuespush(`Content references information from ${oldest.Year}`);
        suggestionspush('Verify if information is still applicable');
        score *= 0.9}}// Check against known deprecation database;
    const deprecation.Database = await thischeckDeprecation.Database(contentmetadata);
    if (deprecationDatabasehas.Deprecations) {
      issuespush(.deprecation.Databasedeprecations);
      suggestionspush(.deprecation.Databasereplacements);
      score *= 0.6};

    return {
      is.Valid: score >= 0.5;
      score;
      validation.Type: 'deprecation';
      issues;
      suggestions;
      metadata: {
        deprecation.Keywords: found.Keywords;
        version.Info: version.Matches;
        deprecation.Database}}}/**
   * Validate technical accuracy for code content*/
  private async validateTechnical.Accuracy(
    contentstring;
    metadata: Record<string, unknown>): Promise<Validation.Result> {
    const issues: string[] = [];
    const suggestions: string[] = [];
    let score = 1.0// Extract code blocks;
    const code.Blocks = thisextractCode.Blocks(content;

    if (code.Blockslength === 0 && metadatahasCode.Examples) {
      issuespush('Expected code examples but none found');
      score *= 0.7};

    for (const code.Block of code.Blocks) {
      // Syntax validation;
      const syntax.Validation = await thisvalidateCode.Syntax(code.Block),
      if (!syntaxValidationis.Valid) {
        issuespush(`Syntax errorin ${code.Blocklanguage} code: ${syntax.Validationerror instanceof Error ? errormessage : String(error));`;
        suggestionspush('Fix syntax errors in code examples');
        score *= 0.7}// Security check;
      const security.Issues = thischeckCode.Security(code.Block);
      if (security.Issueslength > 0) {
        issuespush(.security.Issuesmap((issue) => `Security issue: ${issue}`));
        suggestionspush('Address security vulnerabilities in code examples');
        score *= 0.6}// Best practices check;
      const bestPractice.Issues = await thischeckCodeBest.Practices(code.Block);
      if (bestPractice.Issueslength > 0) {
        issuespush(.bestPractice.Issuesslice(0, 3))// Limit to top 3;
        suggestionspush('Follow coding best practices');
        score *= 0.9}}// AP.I usage validation;
    if (metadatacategory === 'api' || contentincludes('endpoint')) {
      const api.Validation = await thisvalidateAPI.Usage(content;
      if (!apiValidationis.Valid) {
        issuespush(.api.Validationissues);
        suggestionspush(.api.Validationsuggestions);
        score *= api.Validationscore}};

    return {
      is.Valid: score >= 0.6;
      score;
      validation.Type: 'technical_accuracy';
      issues;
      suggestions;
      metadata: {
        codeBlock.Count: code.Blockslength;
        languages: Arrayfrom(new Set(code.Blocksmap((b) => blanguage)));
        security.Score: 1.0 - issuesfilter((i) => iincludes('Security'))length * 0.1}}}// Helper methods;

  private parseUpdate.Frequency(cron.Expression: string): number {
    // Simple parser for cron expressions to hours;
    const parts = cron.Expressionsplit(' ');
    if (parts[1] === '*') return 1// Every hour;
    if (parts[1]includes('*/')) {
      const hours = parse.Int(parts[1]split('/', 10)[1]);
      return hours};
    if (parts[2] === '*') return 24// Daily;
    return 168// Weekly default};

  private async checkDomain.Reputation(url: string): Promise<number> {
    try {
      const domain = new UR.L(url)hostname// Known high-reputation domains;
      const trusted.Domains = [
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
      if (trusted.Domainssome((trusted) => domainincludes(trusted))) {
        return 1.0}// Default reputation for unknown domains;
      return 0.7} catch {
      return 0.5}};

  private count.Tokens(contentstring): number {
    if (thisencoding) {
      return thisencodingencode(content-length}// Fallback: approximate token count;
    return Mathceil(contentsplit(/\s+/)length * 1.3)};

  private analyze.Readability(contentstring): Record<string, number> {
    const sentences = thissentence.Tokenizertokenize(content;
    const words = thistokenizertokenize(content;
    const syllables = wordsreduce((sum, word) => sum + thiscount.Syllables(word), 0);
    const avgWordsPer.Sentence = wordslength / sentenceslength;
    const avgSyllablesPer.Word = syllables / wordslength// Flesch Reading Ease Score;
    const flesch.Score = 206.835 - 1.015 * avgWordsPer.Sentence - 84.6 * avgSyllablesPer.Word,

    return {
      flesch.Score: Math.max(0, Math.min(100, flesch.Score));
      avgWordsPer.Sentence;
      avgSyllablesPer.Word;
      total.Words: wordslength;
      total.Sentences: sentenceslength}};

  private count.Syllables(word: string): number {
    word = wordtoLower.Case();
    let count = 0;
    let previousWas.Vowel = false;
    for (let i = 0; i < wordlength; i++) {
      const is.Vowel = 'aeiou'includes(word[i]);
      if (is.Vowel && !previousWas.Vowel) {
        count++};
      previousWas.Vowel = is.Vowel}// Adjust for silent e;
    if (wordends.With('e')) {
      count--};

    return Math.max(1, count)};

  private async checkGrammarAnd.Spelling(contentstring): Promise<string[]> {
    const issues: string[] = [],
    const words = thistokenizertokenize(content// Simple spell checking (would be enhanced with proper dictionary);
    for (const word of words) {
      if (wordlength > 2 && !thisisValid.Word(word)) {
        issuespush(`Possible spelling error instanceof Error ? errormessage : String(error) ${word}`)}};

    return issues};

  private isValid.Word(word: string): boolean {
    // Simple validation - would use proper dictionary in production;
    return /^[a-z.A-Z]+$/test(word) || /^[A-Z][a-z]+$/test(word)};

  private validateContent.Structure(contentstring, metadata: Record<string, unknown>): number {
    let score = 1.0,

    // Check for headings;
    const heading.Pattern = /^#{1,6}\s+.+$/gm;
    const headings = contentmatch(heading.Pattern);
    if (!headings || headingslength < 2) {
      score *= 0.8}// Check for code blocks if technical content;
    if (metadatahasCode.Examples) {
      const codeBlock.Pattern = /```[\s\S]*?```/g;
      const code.Blocks = contentmatch(codeBlock.Pattern);
      if (!code.Blocks || code.Blockslength === 0) {
        score *= 0.7}}// Check for lists;
    const list.Pattern = /^[\*\-\+]\s+.+$/gm;
    const lists = contentmatch(list.Pattern);
    if (!lists || listslength < 3) {
      score *= 0.9};

    return score};

  private async checkDuplicate.Content(contentstring): Promise<number> {
    try {
      // Generate content hash;
      const content.Hash = create.Hash('sha256')update(contentdigest('hex'),

      // Check for exact duplicates;
      const { data: exact.Duplicates } = await supabase;
        from('scraped_knowledge');
        select('id');
        eq('content_hash', content.Hash);
        limit(1);
      if (exact.Duplicates && exact.Duplicateslength > 0) {
        return 1.0// Exact duplicate}// Check for similar contentusing text similarity// This would use vector embeddings in production;
      return 0.0// No duplicates} catch (error) {
      loggererror('Duplicate check failed:', error instanceof Error ? errormessage : String(error);
      return 0.0}};

  private async extractFactual.Claims(contentstring): Promise<string[]> {
    const claims: string[] = [],
    const sentences = thissentence.Tokenizertokenize(content// Pattern matching for factual statements;
    const fact.Patterns = [
      /\b(?: is|are|was|were|has|have|had)\b.*\b(?:million|billion|percent|%|\d+)/i/\b(?: according to|research shows|studies indicate|data reveals)\b/i/\b(?:in \d{4}|since \d{4}|as of \d{4})\b/i/\b(?: increased|decreased|grew|declined) by \d+/i];
    for (const sentence of sentences) {
      if (fact.Patternssome((_pattern => _patterntest(sentence))) {
        claimspush(sentence)}};

    return claimsslice(0, 10)// Limit to 10 claims for efficiency};

  private async crossReferenceWithKnowledge.Base(claims: string[]): Promise<number> {
    // Would implement actual cross-referencing with knowledge base// For now, return a default score;
    return 0.85};

  private isVersion.Outdated(mentioned: string, latest: string): boolean {
    const mentioned.Parts = mentionedmatch(/\d+/g)?map(Number) || [];
    const latest.Parts = latestmatch(/\d+/g)?map(Number) || [];
    for (let i = 0; i < Math.max(mentioned.Partslength, latest.Partslength); i++) {
      const m = mentioned.Parts[i] || 0;
      const l = latest.Parts[i] || 0;
      if (l > m) return true;
      if (m > l) return false};

    return false};

  private async checkLatest.Versions(
    category: string;
    versions: string[]): Promise<Record<string, string>> {
    // Would check against version databases// For now, return mock data;
    const latest.Versions: Record<string, string> = {};
    for (const version of versions) {
      latest.Versions[version] = version// Assume current by default};

    return latest.Versions};

  private async checkDeprecation.Database(
    contentstring;
    metadata: Record<string, unknown>): Promise<{ has.Deprecations: boolean; deprecations: string[], replacements: string[] }> {
    // Would check against deprecation database;
    return {
      has.Deprecations: false;
      deprecations: [];
      replacements: []}};

  private extractCode.Blocks(contentstring): Array<{ code: string, language: string }> {
    const codeBlock.Pattern = /```(\w+)?\n([\s\S]*?)```/g;
    const blocks: Array<{ code: string, language: string }> = [];
    let match;
    while ((match = codeBlock.Patternexec(content !== null) {
      blockspush({
        language: match[1] || 'unknown';
        code: match[2]trim()})};

    return blocks};

  private async validateCode.Syntax(code.Block: {
    code: string;
    language: string}): Promise<{ is.Valid: boolean, error instanceof Error ? errormessage : String(error)  string }> {
    // Would use language-specific parsers// For now, basic validation;
    try {
      if (code.Blocklanguage === 'javascript' || code.Blocklanguage === 'typescript') {
        // Check for basic syntax errors;
        if (code.Blockcodesplit('{')length !== code.Blockcodesplit('}')length) {
          return { is.Valid: false, error instanceof Error ? errormessage : String(error) 'Unmatched braces' }}};

      return { is.Valid: true }} catch (error) {
      return { is.Valid: false, error instanceof Error ? errormessage : String(error) String(error instanceof Error ? errormessage : String(error)}}};

  private checkCode.Security(code.Block: { code: string, language: string }): string[] {
    const issues: string[] = [];
    const code = codeBlockcodetoLower.Case(),

    // Common security patterns to check;
    const security.Patterns = [
      { _pattern /eval\s*\(/, message: 'Use of eval() is dangerous' };
      { _pattern /dangerouslySetInnerHTM.L/, message: 'Potential XS.S vulnerability' };
      { _pattern /process\env\.\w+\s*[^|]/, message: 'Hardcoded environment variables' };
      { _pattern /password\s*=\s*["']/, message: 'Hardcoded password detected' };
      { _pattern /api[_-]?key\s*=\s*["']/, message: 'Hardcoded AP.I key detected' }];
    for (const { _pattern message } of security.Patterns) {
      if (_patterntest(code)) {
        issuespush(message)}};

    return issues};

  private async checkCodeBest.Practices(code.Block: {
    code: string;
    language: string}): Promise<string[]> {
    const issues: string[] = []// Language-specific best practices;
    if (code.Blocklanguage === 'javascript' || code.Blocklanguage === 'typescript') {
      if (code.Blockcodeincludes('var ')) {
        issuespush('Use const/let instead of var')};
      if (code.Blockcodeincludes('== ') && !code.Blockcodeincludes('=== ')) {
        issuespush('Use === for strict equality checks')}};

    return issues};

  private async validateAPI.Usage(contentstring): Promise<{
    is.Valid: boolean;
    score: number;
    issues: string[];
    suggestions: string[]}> {
    const issues: string[] = [];
    const suggestions: string[] = [];
    let score = 1.0// Check for proper HTT.P methods;
    const http.Methods = ['GE.T', 'POS.T', 'PU.T', 'PATC.H', 'DELET.E'];
    const mentioned.Methods = http.Methodsfilter((method) => contentincludes(method));
    if (mentioned.Methodslength === 0 && contentincludes('endpoint')) {
      issuespush('AP.I documentation should specify HTT.P methods');
      suggestionspush('Add HTT.P method documentation');
      score *= 0.8}// Check for response examples;
    if (!contentincludes('response') && !contentincludes('returns')) {
      issuespush('AP.I documentation lacks response examples');
      suggestionspush('Add response format and examples');
      score *= 0.85};

    return {
      is.Valid: score >= 0.7;
      score;
      issues;
      suggestions}};

  private calculateOverall.Score(validation.Results: Validation.Result[]): number {
    if (validation.Resultslength === 0) return 0// Weighted average based on validation type importance;
    const weights: Record<string, number> = {
      source_credibility: 0.25;
      content_quality: 0.25;
      fact_check: 0.2;
      deprecation: 0.15;
      technical_accuracy: 0.15};
    let weighted.Sum = 0;
    let total.Weight = 0;
    for (const result of validation.Results) {
      const weight = weights[resultvalidation.Type] || 0.1;
      weighted.Sum += resultscore * weight;
      total.Weight += weight};

    return total.Weight > 0 ? weighted.Sum / total.Weight : 0};

  private async storeValidation.Results(
    scraped.Id: string;
    validation.Results: Validation.Result[]): Promise<void> {
    const entries: KnowledgeValidation.Entry[] = validation.Resultsmap((result) => ({
      scraped_knowledge_id: scraped.Id;
      validation_type: resultvalidation.Type;
      score: resultscore;
      issues: resultissues;
      suggestions: resultsuggestions;
      validator_id: 'knowledge-validation-service';
      metadata: resultmetadata}));
    const { error instanceof Error ? errormessage : String(error)  = await supabasefrom('knowledge_validation')insert(entries);
    if (error instanceof Error ? errormessage : String(error){
      loggererror('Failed to store validation results:', error instanceof Error ? errormessage : String(error)}};

  private async updateScrapedKnowledge.Status(
    scraped.Id: string;
    overall.Score: number;
    validation.Results: Validation.Result[]): Promise<void> {
    const status =
if (      overall.Score >= 0.7) { return 'validated'} else if (overall.Score >= 0.5) { return 'needs_review'} else { return 'rejected'};

    const validation.Details = {
      overall.Score;
      validation.Count: validation.Resultslength;
      passed.Validations: validation.Resultsfilter((r) => ris.Valid)length;
      critical.Issues: validationResultsflat.Map((r) => rissues)slice(0, 5);
      top.Suggestions: validationResultsflat.Map((r) => rsuggestions)slice(0, 3)};
    const { error instanceof Error ? errormessage : String(error)  = await supabase;
      from('scraped_knowledge');
      update({
        quality_score: overall.Score;
        validation_status: status;
        validation_details: validation.Details;
        processed: true});
      eq('id', scraped.Id);
    if (error instanceof Error ? errormessage : String(error){
      loggererror('Failed to update scraped knowledge status:', error instanceof Error ? errormessage : String(error)}}/**
   * Validate knowledge before it's used*/
  async validateBefore.Use(
    knowledge.Id: string;
    knowledge.Type: string): Promise<{ can.Use: boolean, reason?: string }> {
    // Quick validation check before using knowledge;
    if (knowledge.Type === 'scraped') {
      const { data, error } = await supabase;
        from('scraped_knowledge');
        select('validation_status, quality_score');
        eq('id', knowledge.Id);
        single();
      if (error instanceof Error ? errormessage : String(error) | !data) {
        return { can.Use: false, reason: 'Knowledge not found' }};

      if (datavalidation_status === 'rejected') {
        return { can.Use: false, reason: 'Knowledge has been rejected' }};

      if (dataquality_score < 0.3) {
        return { can.Use: false, reason: 'Knowledge quality too low' }}};

    return { can.Use: true }}}// Lazy initialization to prevent blocking during import;
let _knowledgeValidation.Service: KnowledgeValidation.Service | null = null;
export function getKnowledgeValidation.Service(): KnowledgeValidation.Service {
  if (!_knowledgeValidation.Service) {
    _knowledgeValidation.Service = new KnowledgeValidation.Service()};
  return _knowledgeValidation.Service}// For backward compatibility;
export const knowledgeValidation.Service = new Proxy({} as KnowledgeValidation.Service, {
  get(target, prop) {
    return getKnowledgeValidation.Service()[prop as keyof KnowledgeValidation.Service]}});