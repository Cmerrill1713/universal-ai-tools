import { createClient,type SupabaseClient } from '@supabase/supabase-js';

import { config } from '@/config/environment';
import { log,LogContext } from '@/utils/logger';

export type MemoryType = 'conversation' | 'knowledge' | 'context' | 'preference' | 'summary';

export interface MemoryRecord {
  id?: string;
  userId: string;
  content: string;
  type: MemoryType;
  source?: string;
  projectPath?: string | null;
  importance?: number; // 0-1
  tags?: string[];
  metadata?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export class MemoryService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(config.supabase.url, config.supabase.serviceKey);
  }

  async save(memory: MemoryRecord): Promise<string | null> {
    try {
      // Dedupe: avoid storing near-duplicate content for the same user/type
      try {
        const probe = memory.content.trim().slice(0, 80);
        const pattern = `%${probe.replace(/[%_]/g, '')}%`;
        const existing = await this.supabase
          .from('context_storage')
          .select('id, metadata')
          .eq('user_id', memory.userId)
          .eq('category', memory.type)
          .ilike('content', pattern)
          .limit(1)
          .maybeSingle();
        if (existing.data?.id) {
          // Merge: bump importance slightly and return existing id
          const importance = Math.min(1, Number(existing.data.metadata?.importance || 0.5) + 0.05);
          await this.supabase
            .from('context_storage')
            .update({ metadata: { ...(existing.data.metadata || {}), importance } })
            .eq('id', existing.data.id);
          return existing.data.id;
        }
      } catch {}

      // Best-effort embedding
      let embedding: number[] | null = null;
      try {
        const { generateEmbedding } = await import('./embeddings');
        embedding = await generateEmbedding(memory.content);
      } catch {}

      const { data, error } = await this.supabase
        .from('context_storage')
        .insert({
          content: memory.content,
          category: memory.type,
          source: memory.source || 'memory_api',
          user_id: memory.userId,
          project_path: memory.projectPath || null,
          metadata: {
            ...memory.metadata,
            importance: memory.importance ?? 0.5,
            tags: memory.tags || [],
          },
          embedding: embedding || null,
        })
        .select('id')
        .single();

      if (error) {
        log.error('Failed to save memory', LogContext.DATABASE, { error: error.message });
        return null;
      }
      return data?.id || null;
    } catch (error) {
      log.error('Error saving memory', LogContext.DATABASE, {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  async list(userId: string, type?: MemoryType, limit = 50, offset = 0) {
    let query = this.supabase
      .from('context_storage')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (type) {query = query.eq('category', type);}

    const { data, error } = await query;
    if (error) {
      log.error('Failed to list memories', LogContext.DATABASE, { error: error.message });
      return [];
    }
    return data || [];
  }

  async get(userId: string, id: string) {
    const { data, error } = await this.supabase
      .from('context_storage')
      .select('*')
      .eq('user_id', userId)
      .eq('id', id)
      .maybeSingle();

    if (error) {return null;}
    return data || null;
  }

  async update(userId: string, id: string, updates: Partial<MemoryRecord>) {
    const payload: Record<string, any> = {};
    if (updates.content) {payload.content = updates.content;}
    if (updates.type) {payload.category = updates.type;}
    if (updates.source) {payload.source = updates.source;}
    if (updates.projectPath !== undefined) {payload.project_path = updates.projectPath;}

    if (updates.importance !== undefined || updates.tags || updates.metadata) {
      payload.metadata = {
        ...(updates.metadata || {}),
        ...(updates.importance !== undefined ? { importance: updates.importance } : {}),
        ...(updates.tags ? { tags: updates.tags } : {}),
      };
    }

    const { error } = await this.supabase
      .from('context_storage')
      .update(payload)
      .eq('user_id', userId)
      .eq('id', id);

    if (error) {return false;}

    // Recompute embedding if content changed
    if (updates.content) {
      try {
        const { generateEmbedding } = await import('./embeddings');
        const emb = await generateEmbedding(updates.content);
        await this.supabase
          .from('context_storage')
          .update({ embedding: emb })
          .eq('user_id', userId)
          .eq('id', id);
      } catch {}
    }

    return true;
  }

  async remove(userId: string, id: string) {
    const { error } = await this.supabase
      .from('context_storage')
      .delete()
      .eq('user_id', userId)
      .eq('id', id);
    return !error;
  }

  async search(userId: string, queryText: string, type?: MemoryType, limit = 10) {
    try {
      // Currently using text search; future enhancement: add semantic search with embeddings
      // when embedding vectors are available in the schema
      let query = this.supabase
        .from('context_storage')
        .select('*')
        .eq('user_id', userId)
        .textSearch('content', queryText, { type: 'websearch' })
        .order('updated_at', { ascending: false })
        .limit(limit);

      if (type) {query = query.eq('category', type);}

      let { data, error } = await query;
      if (error) {
        // Fallback to ilike
        const terms = queryText
          .toLowerCase()
          .split(/\s+/)
          .filter((t) => t.length > 2)
          .slice(0, 5);
        const pattern = `%${terms.join('%')}%`;
        const fb = await this.supabase
          .from('context_storage')
          .select('*')
          .eq('user_id', userId)
          .ilike('content', pattern)
          .order('updated_at', { ascending: false })
          .limit(limit);
        data = fb.data || [];
        error = null as any;
      }
      return data || [];
    } catch (error) {
      log.error('Error searching memories', LogContext.DATABASE, {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  async cleanup(userId: string, maxAgeDays = 30, minImportance = 0.4): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - maxAgeDays);
    const { data, error } = await this.supabase
      .from('context_storage')
      .delete()
      .eq('user_id', userId)
      .lt('created_at', cutoff.toISOString())
      .lte('metadata->>importance', String(minImportance))
      .select('id');
    if (error) {return 0;}
    return data?.length || 0;
  }

  async getStats(userId: string): Promise<{
    total: number;
    byType: Record<string, number>;
    newest?: string | null;
    oldest?: string | null;
  }> {
    const { data, error } = await this.supabase
      .from('context_storage')
      .select('category, created_at')
      .eq('user_id', userId);
    if (error) {return { total: 0, byType: {}, newest: null, oldest: null };}
    const byType: Record<string, number> = {};
    let newest: string | null = null;
    let oldest: string | null = null;
    for (const row of data || []) {
      byType[row.category] = (byType[row.category] || 0) + 1;
      if (!newest || row.created_at > newest) {newest = row.created_at;}
      if (!oldest || row.created_at < oldest) {oldest = row.created_at;}
    }
    return { total: data?.length || 0, byType, newest, oldest };
  }

  async summarizeRecent(
    userId: string,
    opts: { window?: number; destinationType?: MemoryType } = {}
  ): Promise<string | null> {
    const window = opts.window ?? 50;
    // Fetch recent conversation entries
    const { data, error } = await this.supabase
      .from('context_storage')
      .select('id, content, created_at, metadata')
      .eq('user_id', userId)
      .eq('category', 'conversation')
      .order('created_at', { ascending: false })
      .limit(window);
    if (error || !data || data.length === 0) {return null;}

    // Naive summarization: take first, most recent, and key sentences
    const texts = data.map((d) => d.content);
    const head = texts[texts.length - 1]?.slice(0, 250) || '';
    const tail = texts[0]?.slice(0, 250) || '';
    const middle = texts
      .slice(Math.max(0, Math.floor(texts.length / 2) - 2), Math.floor(texts.length / 2) + 2)
      .map((t) => t.slice(0, 200))
      .join('\n');
    const summary = `Conversation summary (last ${texts.length} items):\n\n- Start: ${head}\n\n- Recent: ${tail}\n\n- Midpoints:\n${middle}`;

    const id = await this.save({
      userId,
      content: summary,
      type: opts.destinationType ?? 'summary',
      source: 'summarizer',
      importance: 0.6,
      metadata: { window, compressed_from: data.map((d) => d.id) },
    });
    return id;
  }
}

export const memoryService = new MemoryService();
