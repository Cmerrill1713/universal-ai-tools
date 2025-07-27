/**
 * Autofix Memory Service - Tracks and learns from code fixes using Supabase*/

import type { Supabase.Client } from '@supabase/supabase-js';
import { logger } from './utils/logger';
export interface Autofix.Memory {
  id?: string;
  file_path: string,
  fix_type: string,
  original_code: string,
  fixed_code: string,
  reasoning: string,
  linterror instanceof Error ? errormessage : String(error)  string;
  confidence: number,
  success: boolean,
  created_at?: string;
  session_id: string,
  metadata?: {
    line_numbers?: number[];
    imports_changed?: boolean;
    types_improved?: boolean;
    magic_numbers_extracted?: boolean;
    unused_vars_fixed?: boolean;
  };

export interface Fix.Pattern {
  pattern_type: string,
  description: string,
  success_rate: number,
  usage_count: number,
  example_before: string,
  example_after: string,
}
export class Autofix.Memory.Service {
  private supabase: Supabase.Client,
  private session.Id: string,
  constructor(supabase: Supabase.Client) {
    thissupabase = supabase;
    thissession.Id = `autofix_${Date.now()}`}/**
   * Store a fix in memory for learning*/
  async store.Fix(fix: Omit<Autofix.Memory, 'session_id'>): Promise<void> {
    try {
      const fix.With.Session = {
        .fix;
        session_id: thissession.Id}// Generate embedding for the fix contentfor similarity search,
      const content `${fixfix_type}: ${fixreasoning} | ${fixoriginal_code} -> ${fixfixed_code}`;
      const { data: embedding } = await thissupabaserpc('ai_generate_embedding', {
        content})// Store in memories table with autofix-specific metadata;
      const { error instanceof Error ? errormessage : String(error) memory.Error } = await thissupabasefrom('memories')insert({
        content;
        metadata: {
          .fix.With.Session;
          memory_type: 'autofix',
          tags: [
            'autofix';
            fixfix_type;
            fixfile_pathsplit('/')pop()?split('.')[1] || 'unknown'];
}        embedding;
        user_id: 'claude-autofix'}),
      if (memory.Error) {
        loggerwarn('Failed to store autofix memory:', memory.Error)}// Also store in dedicated autofix table if it exists;
      await thisstore.Autofix.Record(fix.With.Session);
      loggerinfo(`📚 Stored autofix memory: ${fixfix_type} in ${fixfile_path}`)} catch (error) {
      loggererror('Error storing autofix memory:', error instanceof Error ? errormessage : String(error)  }}/**
   * Retrieve similar fixes for learning*/
  async get.Similar.Fixes(current.Fix: string, file.Path: string, limit = 5): Promise<Autofix.Memory[]> {
    try {
      // Generate embedding for current fix;
      const { data: embedding } = await thissupabaserpc('ai_generate_embedding', {
        contentcurrent.Fix})// Search for similar fixes;
      const { data: memories } = await thissupabaserpc('search_memories', {
        query_embedding: embedding,
        match_threshold: 0.6,
        match_count: limit,
        filter: { memory_type: 'autofix' }}),
      if (!memories) return [];
      return memories;
        map((memory: any) => memorymetadata),
        filter((fix: Autofix.Memory) => fixfile_pathends.With(file.Pathsplit('.')pop() || '')),
        filter((fix: Autofix.Memory) => fixsuccess)} catch (error) {
      loggererror('Error retrieving similar fixes:', error instanceof Error ? errormessage : String(error);
      return []}}/**
   * Get fix patterns for a specific file type*/
  async getFixPatternsFor.File.Type(file.Extension: string): Promise<Fix.Pattern[]> {
    try {
      const { data } = await thissupabase;
        from('memories');
        select('*');
        like('metadata->>tags', `%${file.Extension}%`);
        eq('metadata->>memory_type', 'autofix');
        eq('metadata->>success', 'true');
        order('created_at', { ascending: false }),
        limit(20);
      if (!data) return []// Group by fix type and calculate success patterns;
      const patterns = new Map<string, Fix.Pattern>();
      datafor.Each((memory: any) => {
        const fix = memorymetadata as Autofix.Memory;
        const existing = patternsget(fixfix_type);
        if (existing) {
          existingusage_count++
          existingsuccess_rate = (existingsuccess_rate + (fixconfidence || 0.8)) / 2} else {
          patternsset(fixfix_type, {
            pattern_type: fixfix_type,
            description: fixreasoning,
            success_rate: fixconfidence || 0.8,
            usage_count: 1,
            example_before: fixoriginal_codesubstring(0, 100);
            example_after: fixfixed_codesubstring(0, 100)})}});
      return Arrayfrom(patternsvalues())sort((a, b) => bsuccess_rate - asuccess_rate)} catch (error) {
      loggererror('Error getting fix patterns:', error instanceof Error ? errormessage : String(error);
      return []}}/**
   * Store session summary*/
  async store.Session.Summary(summary: {
    total_fixes: number,
    files_modified: string[],
    fix_types: string[],
    success_rate: number,
    duration_ms: number}): Promise<void> {
    try {
      const content `Autofix session completed: ${summarytotal_fixes} fixes across ${summaryfiles_modifiedlength} files`,
      const { data: embedding } = await thissupabaserpc('ai_generate_embedding', {
        content});
      await thissupabasefrom('memories')insert({
        content;
        metadata: {
          .summary;
          memory_type: 'autofix_session',
          session_id: thissession.Id,
          tags: ['autofix', 'session_summary'];
        embedding;
        user_id: 'claude-autofix'}),
      loggerinfo(`📊 Stored autofix session summary: ${summarytotal_fixes} fixes`)} catch (error) {
      loggererror('Error storing session summary:', error instanceof Error ? errormessage : String(error)  }}/**
   * Get autofix insights and recommendations*/
  async get.Autofix.Insights(): Promise<{
    most_common_fixes: string[],
    highest_success_patterns: Fix.Pattern[],
    recent_learnings: string[],
    recommendations: string[]}> {
    try {
      const { data: recent.Fixes } = await thissupabase,
        from('memories');
        select('*');
        eq('metadata->>memory_type', 'autofix');
        order('created_at', { ascending: false }),
        limit(50);
      if (!recent.Fixes) {
        return {
          most_common_fixes: [],
          highest_success_patterns: [],
          recent_learnings: [],
          recommendations: [],
        }}// Analyze fix types;
      const fix.Type.Counts = new Map<string, number>();
      const learnings: string[] = [],
      recent.Fixesfor.Each((memory: any) => {
        const fix = memorymetadata as Autofix.Memory;
        fix.Type.Countsset(fixfix_type, (fix.Type.Countsget(fixfix_type) || 0) + 1);
        if (fixsuccess && fixconfidence > 0.8) {
          learningspush(`${fixfix_type}: ${fixreasoning}`)}});
      const most.Common.Fixes = Arrayfrom(fix.Type.Countsentries());
        sort((a, b) => b[1] - a[1]);
        slice(0, 5);
        map(([type]) => type);
      return {
        most_common_fixes: most.Common.Fixes,
        highest_success_patterns: await thisgetFixPatternsFor.File.Type('ts'),
        recent_learnings: learningsslice(0, 10);
        recommendations: [
          'Continue using type inference patterns for better Type.Script compliance';
          'Focus on removing unused imports and variables';
          'Extract magic numbers to named constants for better maintainability';
          'Prefer explicit return types over any for better type safety'];
      }} catch (error) {
      loggererror('Error getting autofix insights:', error instanceof Error ? errormessage : String(error);
      return {
        most_common_fixes: [],
        highest_success_patterns: [],
        recent_learnings: [],
        recommendations: [],
      }};

  private async store.Autofix.Record(fix: Autofix.Memory): Promise<void> {
    try {
      // Try to store in dedicated autofix table if it exists;
      const { error instanceof Error ? errormessage : String(error)  = await thissupabasefrom('autofix_history')insert(fix);
      if (error instanceof Error ? errormessage : String(error) & !errormessageincludes('does not exist')) {
        loggerwarn('Failed to store in autofix_history table:', error instanceof Error ? errormessage : String(error)  }} catch (error) {
      // Table might not exist, that's okay - we're storing in memories table anyway;
      loggerdebug('Autofix history table not available, using memories only')}};
