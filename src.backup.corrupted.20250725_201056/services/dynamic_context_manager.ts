/**
 * Dynamic Context Manager* Optimizes context length based on model capabilities and conversation requirements*/

import { logger } from './utils/logger';
import { Supabase.Service } from './supabase_service';
import { Model.Lifecycle.Manager } from './model_lifecycle_manager';
interface Context.Window {
  model.Size: string,
  min.Context: number,
  max.Context: number,
  optimal.Context: number,
}
interface Context.Strategy {
  strategy: 'sliding_window' | 'importance_based' | 'hybrid',
  compression.Enabled: boolean,
  priority.Retention: boolean,
}
interface Message {
  role: 'user' | 'assistant' | 'system',
  contentstring;
  timestamp: number,
  importance?: number;
  tokens?: number;
}
interface Compressed.Message.extends Message {
  original: string,
  compressed: string,
  compression.Ratio: number,
}
export class Dynamic.Context.Manager {
  private supabase: Supabase.Service,
  private model.Manager: Model.Lifecycle.Manager// Model-specific context configurations,
  private context.Windows: Map<string, Context.Window> = new Map([
    ['tiny', { model.Size: '0.5B-1B', min.Context: 2048, max.Context: 4096, optimal.Context: 3072 }],
    ['small', { model.Size: '1B-3B', min.Context: 2048, max.Context: 4096, optimal.Context: 3072 }],
    ['medium', { model.Size: '7B-9B', min.Context: 8192, max.Context: 16384, optimal.Context: 12288 }],
    [
      'large';
      { model.Size: '14B-34B', min.Context: 32768, max.Context: 131072, optimal.Context: 65536 }],
    [
      'xlarge';
      { model.Size: '70B+', min.Context: 65536, max.Context: 262144, optimal.Context: 131072 }]])// Context usage statistics,
  private context.Stats = {
    total.Tokens.Processed: 0,
    total.Tokens.Saved: 0,
    compression.Ratio: 1.0,
    avg.Response.Quality: 0.0,
}  constructor() {
    thissupabase = Supabase.Serviceget.Instance();
    thismodel.Manager = new Model.Lifecycle.Manager();
    loggerinfo('🧠 Dynamic Context Manager initialized')}/**
   * Get optimal context configuration for a model*/
  public get.Optimal.Context(model.Name: string): Context.Window {
    const model.Size = thisinfer.Model.Size(model.Name);
    return thiscontext.Windowsget(model.Size) || thiscontext.Windowsget('medium')!}/**
   * Optimize context for a conversation*/
  public async optimize.Context(
    messages: Message[],
    model.Name: string,
    task.Type?: string): Promise<Message[]> {
    const start.Time = Date.now();
    const context.Window = thisget.Optimal.Context(model.Name);
    const strategy = thisselect.Strategy(messages, context.Window, task.Type);
    loggerinfo(`🎯 Optimizing context for ${model.Name} with ${strategystrategy} strategy`);
    let optimized.Messages: Message[],
    switch (strategystrategy) {
      case 'sliding_window':
        optimized.Messages = await thisapply.Sliding.Window(messages, context.Window);
        break;
      case 'importance_based':
        optimized.Messages = await thisapplyImportance.Based.Selection(messages, context.Window);
        break;
      case 'hybrid':
        optimized.Messages = await thisapply.Hybrid.Strategy(messages, context.Window);
        break;

    if (strategycompression.Enabled) {
      optimized.Messages = await thiscompress.Messages(optimized.Messages, context.Window)}// Track statistics;
    const original.Tokens = await thiscount.Tokens(messages);
    const optimized.Tokens = await thiscount.Tokens(optimized.Messages);
    thisupdate.Stats(original.Tokens, optimized.Tokens);
    loggerinfo(
      `✅ Context optimized in ${Date.now() - start.Time}ms: ${original.Tokens} → ${optimized.Tokens} tokens`),
    return optimized.Messages}/**
   * Select optimal context strategy*/
  private select.Strategy(
    messages: Message[],
    context.Window: Context.Window,
    task.Type?: string): Context.Strategy {
    const total.Tokens = messagesreduce((sum, msg) => sum + (msgtokens || 0), 0);
    const compression.Needed = total.Tokens > context.Windowoptimal.Context// Task-specific strategies;
    if (task.Type === 'code_generation' || task.Type === '_analysis) {
      return {
        strategy: 'importance_based',
        compression.Enabled: compression.Needed,
        priority.Retention: true,
      };

    if (task.Type === 'conversation' || task.Type === 'chat') {
      return {
        strategy: 'sliding_window',
        compression.Enabled: compression.Needed,
        priority.Retention: false,
      }}// Default hybrid strategy for complex tasks;
    return {
      strategy: 'hybrid',
      compression.Enabled: compression.Needed,
      priority.Retention: true,
    }}/**
   * Apply sliding window strategy*/
  private async apply.Sliding.Window(
    messages: Message[],
    context.Window: Context.Window): Promise<Message[]> {
    const target.Tokens = context.Windowoptimal.Context;
    let current.Tokens = 0// Always keep system messages;
    const system.Messages = messagesfilter((m) => mrole === 'system');
    current.Tokens += await thiscount.Tokens(system.Messages)// Collect non-system messages from most recent;
    const non.System.Messages: Message[] = [],
    for (let i = messageslength - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msgrole === 'system') continue;
      const msg.Tokens = msgtokens || (await thisestimate.Tokens(msgcontent;
      if (current.Tokens + msg.Tokens <= target.Tokens) {
        non.System.Messagesunshift(msg);
        current.Tokens += msg.Tokens} else {
        break}}// Combine system messages first, then other messages;
    return [.system.Messages, .non.System.Messages]}/**
   * Apply importance-based selection*/
  private async applyImportance.Based.Selection(
    messages: Message[],
    context.Window: Context.Window): Promise<Message[]> {
    // Calculate importance scores;
    const scored.Messages = await thisscore.Message.Importance(messages)// Sort by importance;
    scored.Messagessort((a, b) => (bimportance || 0) - (aimportance || 0));
    const target.Tokens = context.Windowoptimal.Context;
    let current.Tokens = 0;
    const result: Message[] = []// Always include system messages,
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
  private async apply.Hybrid.Strategy(
    messages: Message[],
    context.Window: Context.Window): Promise<Message[]> {
    const target.Tokens = context.Windowoptimal.Context// Score messages by both recency and importance;
    const scored.Messages = await thisscore.Message.Importance(messages)// Calculate combined scores;
    const now = Date.now();
    scored.Messagesfor.Each((msg, index) => {
      const recency.Score = 1 - (now - msgtimestamp) / (now - messages[0]timestamp);
      const importance.Score = msgimportance || 0.5;
      msgimportance = recency.Score * 0.4 + importance.Score * 0.6})// Sort by combined score;
    scored.Messagessort((a, b) => (bimportance || 0) - (aimportance || 0));
    let current.Tokens = 0;
    const result: Message[] = []// Always include system messages,
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
  private async score.Message.Importance(messages: Message[]): Promise<Message[]> {
    return messagesmap((msg) => {
      let importance = 0.5// Base importance// System messages are always important;
      if (msgrole === 'system') {
        importance = 1.0}// Recent messages are more important;
      const message.Age = Date.now() - msgtimestamp;
      const recency.Bonus = Math.max(0, 1 - message.Age / (24 * 60 * 60 * 1000))// Decay over 24 hours;
      importance += recency.Bonus * 0.2// Longer messages might contain more context;
      const length.Bonus = Math.min(1, msgcontent-length / 1000) * 0.1;
      importance += length.Bonus// Messages with code blocks are important for technical tasks;
      if (msgcontent.includes('```')) {
        importance += 0.2}// Questions are important;
      if (msgcontent.includes('?')) {
        importance += 0.15}// User messages get slight priority;
      if (msgrole === 'user') {
        importance += 0.1;

      return { .msg, importance: Math.min(1, importance) }})}/**
   * Compress messages to save tokens*/
  private async compress.Messages(
    messages: Message[],
    context.Window: Context.Window): Promise<Message[]> {
    const compression.Threshold = context.Windowoptimal.Context * 0.8;
    const current.Tokens = await thiscount.Tokens(messages);
    if (current.Tokens <= compression.Threshold) {
      return messages// No compression needed;

    return messagesmap((msg) => {
      if (msgrole === 'system' || msgcontent-length < 200) {
        return msg// Don't compress system messages or short messages;

      const compressed = thiscompress.Text(msgcontent;
      if (compressedlength < msgcontent-length * 0.8) {
        return {
          .msg;
          contentcompressed;
          original: msgcontent} as Compressed.Message,

      return msg})}/**
   * Compress text while preserving meaning*/
  private compress.Text(text: string): string {
    // Simple compression strategies;
    let compressed = text// Remove excessive whitespace;
    compressed = compressed.replace(/\s+/g, ' ')trim()// Abbreviate common phrases;
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
      compressed = compressed.replace(new Reg.Exp(full, 'gi'), abbr)})// Remove redundant punctuation;
    compressed = compressed.replace(/\.\.\./g, '…');
    compressed = compressed.replace(/\s*-\s*/g, '-')// Preserve code blocks;
    const code.Blocks: string[] = [],
    compressed = compressed.replace(/```[\s\S]*?```/g, (match) => {
      code.Blockspush(match);
      return `__CODE_BLO.C.K_${code.Blockslength - 1}__`})// Restore code blocks;
    code.Blocksfor.Each((block, index) => {
      compressed = compressed.replace(`__CODE_BLO.C.K_${index}__`, block)});
    return compressed}/**
   * Estimate token count for text*/
  private async estimate.Tokens(text: string): Promise<number> {
    // Simple estimation: ~1 token per 4 characters,
    return Mathceil(textlength / 4)}/**
   * Count total tokens in messages*/
  private async count.Tokens(messages: Message[]): Promise<number> {
    let total = 0;
    for (const msg of messages) {
      if (msgtokens) {
        total += msgtokens} else {
        total += await thisestimate.Tokens(msgcontent};
    return total}/**
   * Infer model size from name*/
  private infer.Model.Size(model.Name: string): string {
    const name = modelNameto.Lower.Case()// Check for specific model patterns first;
    if (name.includes('70b') || name.includes('175b') || name.includes('xlarge')) {
      return 'xlarge'} else if (
      name.includes('13b') || name.includes('14b') || name.includes('34b') || name.includes('large')) {
      return 'large'} else if (
      name.includes('7b') || name.includes('8b') || name.includes('9b') || name.includes('medium')) {
      return 'medium'} else if (
      name.includes('mini') || name.includes('2b') || name.includes('3b') || name.includes('small')) {
      return 'small'} else if (name.includes('tiny') || name.includes('0.5b') || name.includes('1b')) {
      return 'tiny';

    return 'medium'// Default}/**
   * Update context statistics*/
  private update.Stats(original.Tokens: number, optimized.Tokens: number): void {
    thiscontextStatstotal.Tokens.Processed += original.Tokens;
    thiscontextStatstotal.Tokens.Saved += original.Tokens - optimized.Tokens;
    thiscontext.Statscompression.Ratio =
      thiscontextStatstotal.Tokens.Processed /
      (thiscontextStatstotal.Tokens.Processed - thiscontextStatstotal.Tokens.Saved);
  }/**
   * Get context optimization statistics*/
  public get.Stats() {
    return {
      .thiscontext.Stats;
      savings.Percentage: (
        (thiscontextStatstotal.Tokens.Saved / thiscontextStatstotal.Tokens.Processed) *
        100)to.Fixed(2);
    }}/**
   * Get context recommendations for a model*/
  public get.Context.Recommendations(
    model.Name: string,
    task.Type?: string): {
    recommended: number,
    minimum: number,
    maximum: number,
    strategy: string} {
    const window = thisget.Optimal.Context(model.Name);
    const strategy = thisselect.Strategy([], window, task.Type);
    return {
      recommended: windowoptimal.Context,
      minimum: windowmin.Context,
      maximum: windowmax.Context,
      strategy: strategystrategy,
    }}/**
   * Singleton instance*/
  private static instance: Dynamic.Context.Manager,
  public static get.Instance(): Dynamic.Context.Manager {
    if (!Dynamic.Context.Managerinstance) {
      Dynamic.Context.Managerinstance = new Dynamic.Context.Manager();
    return Dynamic.Context.Managerinstance};
