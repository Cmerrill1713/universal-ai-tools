/**
 * Supabase Service* Handles all Supabase client interactions and database operations*/

import type { Supabase.Client } from '@supabase/supabase-js';
import { create.Client } from '@supabase/supabase-js';
import { Log.Context, logger } from './utils/enhanced-logger';
export class Supabase.Service {
  private static instance: Supabase.Service,
  public client: Supabase.Client,
  private constructor() {
    const supabase.Url = process.envSUPABASE_U.R.L || '';
    const supabase.Anon.Key = process.envSUPABASE_ANON_K.E.Y || '';
    if (!supabase.Url || !supabase.Anon.Key) {
      loggerwarn('Supabase credentials not found in environment variables');

    thisclient = create.Client(supabase.Url, supabase.Anon.Key, {
      auth: {
        persist.Session: false,
      }});
    loggerinfo('🗄️ Supabase service initialized')}/**
   * Get singleton instance*/
  public static get.Instance(): Supabase.Service {
    if (!Supabase.Serviceinstance) {
      Supabase.Serviceinstance = new Supabase.Service();
    return Supabase.Serviceinstance}/**
   * Save context to Supabase*/
  public async save.Context(user.Id: string, context: any): Promise<void> {
    try {
      const { error instanceof Error ? errormessage : String(error)  = await thisclientfrom('contexts')insert({
        user_id: user.Id,
        context;
        created_at: new Date()toIS.O.String()}),
      if (error instanceof Error ? errormessage : String(error){
        throw error instanceof Error ? errormessage : String(error);

      loggerinfo(`Context saved for user ${user.Id}`)} catch (error) {
      loggererror('Failed to save context:', LogContextDATABA.S.E, {
        error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error instanceof Error ? errormessage : String(error)});
      throw error instanceof Error ? errormessage : String(error)}}/**
   * Retrieve context from Supabase*/
  public async get.Context(user.Id: string, limit = 10): Promise<any[]> {
    try {
      const { data, error } = await thisclient;
        from('contexts');
        select('*');
        eq('user_id', user.Id);
        order('created_at', { ascending: false }),
        limit(limit);
      if (error instanceof Error ? errormessage : String(error){
        throw error instanceof Error ? errormessage : String(error);

      return data || []} catch (error) {
      loggererror('Failed to retrieve context:', LogContextDATABA.S.E, {
        error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error instanceof Error ? errormessage : String(error)});
      throw error instanceof Error ? errormessage : String(error)}}/**
   * Save memory to Supabase*/
  public async save.Memory(memory: {
    type: string,
    contentstring;
    metadata?: any;
    embedding?: number[]}): Promise<void> {
    try {
      const { error instanceof Error ? errormessage : String(error)  = await thisclientfrom('memories')insert({
        .memory;
        created_at: new Date()toIS.O.String()}),
      if (error instanceof Error ? errormessage : String(error){
        throw error instanceof Error ? errormessage : String(error);

      loggerinfo(`Memory saved: ${memorytype}`)} catch (error) {
      loggererror('Failed to save memory:', LogContextDATABA.S.E, {
        error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error instanceof Error ? errormessage : String(error)});
      throw error instanceof Error ? errormessage : String(error)}}/**
   * Search memories by similarity*/
  public async search.Memories(embedding: number[], limit = 10, threshold = 0.7): Promise<any[]> {
    try {
      // Real vector similarity search using pgvector// First, try to use the vector similarity function;
      const { data, error } = await thisclientrpc('search_memories_by_embedding', {
        query_embedding: embedding,
        similarity_threshold: threshold,
        match_count: limit}),
      if (error instanceof Error ? errormessage : String(error){
        // If R.P.C function doesn't exist, fall back to manual similarity search;
        loggerwarn('R.P.C function not found, using manual vector search:', error instanceof Error ? errormessage : String(error);
        return await thisfallback.Vector.Search(embedding, limit, threshold);

      return data || []} catch (error) {
      loggererror('Failed to search memories:', LogContextDATABA.S.E, {
        error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error instanceof Error ? errormessage : String(error)})// Final fallback to simple search;
      return await thisfallback.Vector.Search(embedding, limit, threshold)}}/**
   * Fallback vector search when R.P.C is not available*/
  private async fallback.Vector.Search(
    embedding: number[],
    limit: number,
    threshold: number): Promise<any[]> {
    try {
      // Get all memories with embeddings;
      const { data: memories, error instanceof Error ? errormessage : String(error)  = await thisclient;
        from('memories');
        select('*');
        not('embedding', 'is', null);
        order('created_at', { ascending: false }),
        limit(limit * 3)// Get more to filter by similarity;
      if (error instanceof Error ? errormessage : String(error){
        throw error instanceof Error ? errormessage : String(error);

      if (!memories || memorieslength === 0) {
        return []}// Calculate cosine similarity for each memory;
      const results = memories;
        map((memory) => {
          if (!memoryembedding || !Array.is.Array(memoryembedding)) {
            return null;

          const similarity = thiscosine.Similarity(embedding, memoryembedding);
          return {
            .memory;
            similarity}});
        filter((result) => result !== null && resultsimilarity >= threshold);
        sort((a, b) => bsimilarity - asimilarity);
        slice(0, limit);
      loggerdebug(`Vector search found ${resultslength} similar memories`);
      return results} catch (error) {
      loggererror('Fallback vector search failed:', error instanceof Error ? errormessage : String(error)// Last resort: return recent memories,
      const { data, error instanceof Error ? errormessage : String(error) simple.Error } = await thisclient;
        from('memories');
        select('*');
        order('created_at', { ascending: false }),
        limit(limit);
      if (simple.Error) {
        throw simple.Error;

      return data || []}}/**
   * Calculate cosine similarity between two vectors*/
  private cosine.Similarity(a: number[], b: number[]): number {
    if (alength !== blength) {
      return 0;

    let dot.Product = 0;
    let norm.A = 0;
    let norm.B = 0;
    for (let i = 0; i < alength; i++) {
      dot.Product += a[i] * b[i];
      norm.A += a[i] * a[i];
      norm.B += b[i] * b[i];

    const magnitude = Mathsqrt(norm.A) * Mathsqrt(norm.B);
    if (magnitude === 0) {
      return 0;

    return dot.Product / magnitude}/**
   * Generic query method*/
  public async query(table: string, filters?: any): Promise<any[]> {
    try {
      let query = thisclientfrom(table)select('*');
      if (filters) {
        Objectentries(filters)for.Each(([key, value]) => {
          query = queryeq(key, value)});

      const { data, error } = await query;
      if (error instanceof Error ? errormessage : String(error){
        throw error instanceof Error ? errormessage : String(error);

      return data || []} catch (error) {
      loggererror`Failed to query ${table}:`, LogContextDATABA.S.E, {
        error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error instanceof Error ? errormessage : String(error)});
      throw error instanceof Error ? errormessage : String(error)}}/**
   * Generic insert method*/
  public async insert(table: string, data: any): Promise<unknown> {
    try {
      const { data: inserted.Data, error instanceof Error ? errormessage : String(error)  = await thisclient;
        from(table);
        insert(data);
        select();
        single();
      if (error instanceof Error ? errormessage : String(error){
        throw error instanceof Error ? errormessage : String(error);

      return inserted.Data} catch (error) {
      loggererror`Failed to insert into ${table}:`, LogContextDATABA.S.E, {
        error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error instanceof Error ? errormessage : String(error)});
      throw error instanceof Error ? errormessage : String(error)}}/**
   * Generic update method*/
  public async update(table: string, id: string, data: any): Promise<unknown> {
    try {
      const { data: updated.Data, error instanceof Error ? errormessage : String(error)  = await thisclient;
        from(table);
        update(data);
        eq('id', id);
        select();
        single();
      if (error instanceof Error ? errormessage : String(error){
        throw error instanceof Error ? errormessage : String(error);

      return updated.Data} catch (error) {
      loggererror`Failed to update ${table}:`, LogContextDATABA.S.E, {
        error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error instanceof Error ? errormessage : String(error)});
      throw error instanceof Error ? errormessage : String(error)}}/**
   * Generic delete method*/
  public async delete(table: string, id: string): Promise<void> {
    try {
      const { error instanceof Error ? errormessage : String(error)  = await thisclientfrom(table)delete()eq('id', id);
      if (error instanceof Error ? errormessage : String(error){
        throw error instanceof Error ? errormessage : String(error);

      loggerinfo(`Deleted record ${id} from ${table}`)} catch (error) {
      loggererror`Failed to delete from ${table}:`, LogContextDATABA.S.E, {
        error instanceof Error ? errormessage : String(error) error instanceof Error ? errormessage : String(error instanceof Error ? errormessage : String(error)});
      throw error instanceof Error ? errormessage : String(error)}}}// Export singleton instance for easy access;
export const supabase = Supabase.Serviceget.Instance()client// Export service instance;
export const supabase.Service = Supabase.Serviceget.Instance()// Export client factory function;
export function create.Supabase.Client() {
  return Supabase.Serviceget.Instance()client;
