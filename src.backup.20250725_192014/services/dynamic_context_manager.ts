/**
 * Dynamic Context Manager* Optimizes context length based on model capabilities and conversation requirements*/

import { logger } from './utils/logger';
import { Supabase.Service } from './supabase_service';
import { ModelLifecycle.Manager } from './model_lifecycle_manager';
interface ContextWindow {
  model.Size: string;
  min.Context: number;
  max.Context: number;
  optimal.Context: number;
};

interface ContextStrategy {
  strategy: 'sliding_window' | 'importance_based' | 'hybrid';
  compression.Enabled: boolean;
  priority.Retention: boolean;
};

interface Message {
  role: 'user' | 'assistant' | 'system';
  contentstring;
  timestamp: number;
  importance?: number;
  tokens?: number;
};

interface CompressedMessage extends Message {
  original: string;
  compressed: string;
  compression.Ratio: number;
};

export class DynamicContext.Manager {
  private supabase: Supabase.Service;
  private model.Manager: ModelLifecycle.Manager// Model-specific context configurations;
  private context.Windows: Map<string, Context.Window> = new Map([
    ['tiny', { model.Size: '0.5B-1B', min.Context: 2048, max.Context: 4096, optimal.Context: 3072 }];
    ['small', { model.Size: '1B-3B', min.Context: 2048, max.Context: 4096, optimal.Context: 3072 }];
    ['medium', { model.Size: '7B-9B', min.Context: 8192, max.Context: 16384, optimal.Context: 12288 }];
    [
      'large';
      { model.Size: '14B-34B', min.Context: 32768, max.Context: 131072, optimal.Context: 65536 }];
    [
      'xlarge';
      { model.Size: '70B+', min.Context: 65536, max.Context: 262144, optimal.Context: 131072 }]])// Context usage statistics;
  private context.Stats = {
    totalTokens.Processed: 0;
    totalTokens.Saved: 0;
    compression.Ratio: 1.0;
    avgResponse.Quality: 0.0;
  };
  constructor() {
    thissupabase = SupabaseServiceget.Instance();
    thismodel.Manager = new ModelLifecycle.Manager();
    loggerinfo('🧠 Dynamic Context Manager initialized')}/**
   * Get optimal context configuration for a model*/
  public getOptimal.Context(model.Name: string): Context.Window {
    const model.Size = thisinferModel.Size(model.Name);
    return thiscontext.Windowsget(model.Size) || thiscontext.Windowsget('medium')!}/**
   * Optimize context for a conversation*/
  public async optimize.Context(
    messages: Message[];
    model.Name: string;
    task.Type?: string): Promise<Message[]> {
    const start.Time = Date.now();
    const context.Window = thisgetOptimal.Context(model.Name);
    const strategy = thisselect.Strategy(messages, context.Window, task.Type);
    loggerinfo(`🎯 Optimizing context for ${model.Name} with ${strategystrategy} strategy`);
    let optimized.Messages: Message[];
    switch (strategystrategy) {
      case 'sliding_window':
        optimized.Messages = await thisapplySliding.Window(messages, context.Window);
        break;
      case 'importance_based':
        optimized.Messages = await thisapplyImportanceBased.Selection(messages, context.Window);
        break;
      case 'hybrid':
        optimized.Messages = await thisapplyHybrid.Strategy(messages, context.Window);
        break};

    if (strategycompression.Enabled) {
      optimized.Messages = await thiscompress.Messages(optimized.Messages, context.Window)}// Track statistics;
    const original.Tokens = await thiscount.Tokens(messages);
    const optimized.Tokens = await thiscount.Tokens(optimized.Messages);
    thisupdate.Stats(original.Tokens, optimized.Tokens);
    loggerinfo(
      `✅ Context optimized in ${Date.now() - start.Time}ms: ${original.Tokens} → ${optimized.Tokens} tokens`);
    return optimized.Messages}/**
   * Select optimal context strategy*/
  private select.Strategy(
    messages: Message[];
    context.Window: Context.Window;
    task.Type?: string): Context.Strategy {
    const total.Tokens = messagesreduce((sum, msg) => sum + (msgtokens || 0), 0);
    const compression.Needed = total.Tokens > contextWindowoptimal.Context// Task-specific strategies;
    if (task.Type === 'code_generation' || task.Type === '_analysis) {
      return {
        strategy: 'importance_based';
        compression.Enabled: compression.Needed;
        priority.Retention: true;
      }};

    if (task.Type === 'conversation' || task.Type === 'chat') {
      return {
        strategy: 'sliding_window';
        compression.Enabled: compression.Needed;
        priority.Retention: false;
      }}// Default hybrid strategy for complex tasks;
    return {
      strategy: 'hybrid';
      compression.Enabled: compression.Needed;
      priority.Retention: true;
    }}/**
   * Apply sliding window strategy*/
  private async applySliding.Window(
    messages: Message[];
    context.Window: Context.Window): Promise<Message[]> {
    const target.Tokens = contextWindowoptimal.Context;
    let current.Tokens = 0// Always keep system messages;
    const system.Messages = messagesfilter((m) => mrole === 'system');
    current.Tokens += await thiscount.Tokens(system.Messages)// Collect non-system messages from most recent;
    const nonSystem.Messages: Message[] = [];
    for (let i = messageslength - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msgrole === 'system') continue;
      const msg.Tokens = msgtokens || (await thisestimate.Tokens(msgcontent;
      if (current.Tokens + msg.Tokens <= target.Tokens) {
        nonSystem.Messagesunshift(msg);
        current.Tokens += msg.Tokens} else {
        break}}// Combine system messages first, then other messages;
    return [.system.Messages, .nonSystem.Messages]}/**
   * Apply importance-based selection*/
  private async applyImportanceBased.Selection(
    messages: Message[];
    context.Window: Context.Window): Promise<Message[]> {
    // Calculate importance scores;
    const scored.Messages = await thisscoreMessage.Importance(messages)// Sort by importance;
    scored.Messagessort((a, b) => (bimportance || 0) - (aimportance || 0));
    const target.Tokens = contextWindowoptimal.Context;
    let current.Tokens = 0;
    const result: Message[] = []// Always include system messages;
    const system.Messages = messagesfilter((m) => mrole === 'system');
    resultpush(.system.Messages);
    current.Tokens += await thiscount.Tokens(system.Messages)// Add messages by importance;
    for (const msg of scored.Messages) {
      if (msgrole === 'system') continue;
      const msg.Tokens = msgtokens || (await thisestimate.Tokens(msgcontent;
      if (current.Tokens + msg.Tokens <= target.Tokens) {
        resultpush(msg);
        current.Tokens += msg.Tokens}}// Restore chronological order;
    resultsort((a, b) => atimestamp - btimestamp);
    return result}/**
   * Apply hybrid strategy combining recency and importance*/
  private async applyHybrid.Strategy(
    messages: Message[];
    context.Window: Context.Window): Promise<Message[]> {
    const target.Tokens = contextWindowoptimal.Context// Score messages by both recency and importance;
    const scored.Messages = await thisscoreMessage.Importance(messages)// Calculate combined scores;
    const now = Date.now();
    scoredMessagesfor.Each((msg, index) => {
      const recency.Score = 1 - (now - msgtimestamp) / (now - messages[0]timestamp);
      const importance.Score = msgimportance || 0.5;
      msgimportance = recency.Score * 0.4 + importance.Score * 0.6})// Sort by combined score;
    scored.Messagessort((a, b) => (bimportance || 0) - (aimportance || 0));
    let current.Tokens = 0;
    const result: Message[] = []// Always include system messages;
    const system.Messages = messagesfilter((m) => mrole === 'system');
    resultpush(.system.Messages);
    current.Tokens += await thiscount.Tokens(system.Messages)// Add messages based on combined score;
    for (const msg of scored.Messages) {
      if (msgrole === 'system') continue;
      const msg.Tokens = msgtokens || (await thisestimate.Tokens(msgcontent;
      if (current.Tokens + msg.Tokens <= target.Tokens) {
        resultpush(msg);
        current.Tokens += msg.Tokens}}// Restore chronological order;
    resultsort((a, b) => atimestamp - btimestamp);
    return result}/**
   * Score message importance*/
  private async scoreMessage.Importance(messages: Message[]): Promise<Message[]> {
    return messagesmap((msg) => {
      let importance = 0.5// Base importance// System messages are always important;
      if (msgrole === 'system') {
        importance = 1.0}// Recent messages are more important;
      const message.Age = Date.now() - msgtimestamp;
      const recency.Bonus = Math.max(0, 1 - message.Age / (24 * 60 * 60 * 1000))// Decay over 24 hours;
      importance += recency.Bonus * 0.2// Longer messages might contain more context;
      const length.Bonus = Math.min(1, msgcontent-length / 1000) * 0.1;
      importance += length.Bonus// Messages with code blocks are important for technical tasks;
      if (msgcontentincludes('```')) {
        importance += 0.2}// Questions are important;
      if (msgcontentincludes('?')) {
        importance += 0.15}// User messages get slight priority;
      if (msgrole === 'user') {
        importance += 0.1};

      return { .msg, importance: Math.min(1, importance) }})}/**
   * Compress messages to save tokens*/
  private async compress.Messages(
    messages: Message[];
    context.Window: Context.Window): Promise<Message[]> {
    const compression.Threshold = contextWindowoptimal.Context * 0.8;
    const current.Tokens = await thiscount.Tokens(messages);
    if (current.Tokens <= compression.Threshold) {
      return messages// No compression needed};

    return messagesmap((msg) => {
      if (msgrole === 'system' || msgcontent-length < 200) {
        return msg// Don't compress system messages or short messages};

      const compressed = thiscompress.Text(msgcontent;
      if (compressedlength < msgcontent-length * 0.8) {
        return {
          .msg;
          contentcompressed;
          original: msgcontent} as Compressed.Message};

      return msg})}/**
   * Compress text while preserving meaning*/
  private compress.Text(text: string): string {
    // Simple compression strategies;
    let compressed = text// Remove excessive whitespace;
    compressed = compressedreplace(/\s+/g, ' ')trim()// Abbreviate common phrases;
    const abbreviations = [
      ['for example', 'eg.'];
      ['that is', 'ie.'];
      ['in other words', 'ie.'];
      ['and so on', 'etc.'];
      ['versus', 'vs.'];
      ['approximately', '~'];
      ['greater than', '>'];
      ['less than', '<']];
    abbreviationsfor.Each(([full, abbr]) => {
      compressed = compressedreplace(new Reg.Exp(full, 'gi'), abbr)})// Remove redundant punctuation;
    compressed = compressedreplace(/\.\.\./g, '…');
    compressed = compressedreplace(/\s*-\s*/g, '-')// Preserve code blocks;
    const code.Blocks: string[] = [];
    compressed = compressedreplace(/```[\s\S]*?```/g, (match) => {
      code.Blockspush(match);
      return `__CODE_BLOC.K_${code.Blockslength - 1}__`})// Restore code blocks;
    codeBlocksfor.Each((block, index) => {
      compressed = compressedreplace(`__CODE_BLOC.K_${index}__`, block)});
    return compressed}/**
   * Estimate token count for text*/
  private async estimate.Tokens(text: string): Promise<number> {
    // Simple estimation: ~1 token per 4 characters;
    return Mathceil(textlength / 4)}/**
   * Count total tokens in messages*/
  private async count.Tokens(messages: Message[]): Promise<number> {
    let total = 0;
    for (const msg of messages) {
      if (msgtokens) {
        total += msgtokens} else {
        total += await thisestimate.Tokens(msgcontent}};
    return total}/**
   * Infer model size from name*/
  private inferModel.Size(model.Name: string): string {
    const name = modelNametoLower.Case()// Check for specific model patterns first;
    if (nameincludes('70b') || nameincludes('175b') || nameincludes('xlarge')) {
      return 'xlarge'} else if (
      nameincludes('13b') || nameincludes('14b') || nameincludes('34b') || nameincludes('large')) {
      return 'large'} else if (
      nameincludes('7b') || nameincludes('8b') || nameincludes('9b') || nameincludes('medium')) {
      return 'medium'} else if (
      nameincludes('mini') || nameincludes('2b') || nameincludes('3b') || nameincludes('small')) {
      return 'small'} else if (nameincludes('tiny') || nameincludes('0.5b') || nameincludes('1b')) {
      return 'tiny'};

    return 'medium'// Default}/**
   * Update context statistics*/
  private update.Stats(original.Tokens: number, optimized.Tokens: number): void {
    thiscontextStatstotalTokens.Processed += original.Tokens;
    thiscontextStatstotalTokens.Saved += original.Tokens - optimized.Tokens;
    thiscontextStatscompression.Ratio =
      thiscontextStatstotalTokens.Processed /
      (thiscontextStatstotalTokens.Processed - thiscontextStatstotalTokens.Saved);
  }/**
   * Get context optimization statistics*/
  public get.Stats() {
    return {
      .thiscontext.Stats;
      savings.Percentage: (
        (thiscontextStatstotalTokens.Saved / thiscontextStatstotalTokens.Processed) *
        100)to.Fixed(2);
    }}/**
   * Get context recommendations for a model*/
  public getContext.Recommendations(
    model.Name: string;
    task.Type?: string): {
    recommended: number;
    minimum: number;
    maximum: number;
    strategy: string} {
    const window = thisgetOptimal.Context(model.Name);
    const strategy = thisselect.Strategy([], window, task.Type);
    return {
      recommended: windowoptimal.Context;
      minimum: windowmin.Context;
      maximum: windowmax.Context;
      strategy: strategystrategy;
    }}/**
   * Singleton instance*/
  private static instance: DynamicContext.Manager;
  public static get.Instance(): DynamicContext.Manager {
    if (!DynamicContext.Managerinstance) {
      DynamicContext.Managerinstance = new DynamicContext.Manager()};
    return DynamicContext.Managerinstance}};
