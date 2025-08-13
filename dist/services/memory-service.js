import { createClient } from '@supabase/supabase-js';
import { config } from '@/config/environment';
import { log, LogContext } from '@/utils/logger';
export class MemoryService {
    supabase;
    constructor() {
        this.supabase = createClient(config.supabase.url, config.supabase.serviceKey);
    }
    async save(memory) {
        try {
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
                    const importance = Math.min(1, Number(existing.data.metadata?.importance || 0.5) + 0.05);
                    await this.supabase
                        .from('context_storage')
                        .update({ metadata: { ...(existing.data.metadata || {}), importance } })
                        .eq('id', existing.data.id);
                    return existing.data.id;
                }
            }
            catch { }
            let embedding = null;
            try {
                const { generateEmbedding } = await import('./embeddings');
                embedding = await generateEmbedding(memory.content);
            }
            catch { }
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
        }
        catch (error) {
            log.error('Error saving memory', LogContext.DATABASE, {
                error: error instanceof Error ? error.message : String(error),
            });
            return null;
        }
    }
    async list(userId, type, limit = 50, offset = 0) {
        let query = this.supabase
            .from('context_storage')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);
        if (type)
            query = query.eq('category', type);
        const { data, error } = await query;
        if (error) {
            log.error('Failed to list memories', LogContext.DATABASE, { error: error.message });
            return [];
        }
        return data || [];
    }
    async get(userId, id) {
        const { data, error } = await this.supabase
            .from('context_storage')
            .select('*')
            .eq('user_id', userId)
            .eq('id', id)
            .maybeSingle();
        if (error)
            return null;
        return data || null;
    }
    async update(userId, id, updates) {
        const payload = {};
        if (updates.content)
            payload.content = updates.content;
        if (updates.type)
            payload.category = updates.type;
        if (updates.source)
            payload.source = updates.source;
        if (updates.projectPath !== undefined)
            payload.project_path = updates.projectPath;
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
        if (error)
            return false;
        if (updates.content) {
            try {
                const { generateEmbedding } = await import('./embeddings');
                const emb = await generateEmbedding(updates.content);
                await this.supabase
                    .from('context_storage')
                    .update({ embedding: emb })
                    .eq('user_id', userId)
                    .eq('id', id);
            }
            catch { }
        }
        return true;
    }
    async remove(userId, id) {
        const { error } = await this.supabase
            .from('context_storage')
            .delete()
            .eq('user_id', userId)
            .eq('id', id);
        return !error;
    }
    async search(userId, queryText, type, limit = 10) {
        try {
            let query = this.supabase
                .from('context_storage')
                .select('*')
                .eq('user_id', userId)
                .textSearch('content', queryText, { type: 'websearch' })
                .order('updated_at', { ascending: false })
                .limit(limit);
            if (type)
                query = query.eq('category', type);
            let { data, error } = await query;
            if (error) {
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
                error = null;
            }
            return data || [];
        }
        catch (error) {
            log.error('Error searching memories', LogContext.DATABASE, {
                error: error instanceof Error ? error.message : String(error),
            });
            return [];
        }
    }
    async cleanup(userId, maxAgeDays = 30, minImportance = 0.4) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - maxAgeDays);
        const { data, error } = await this.supabase
            .from('context_storage')
            .delete()
            .eq('user_id', userId)
            .lt('created_at', cutoff.toISOString())
            .lte('metadata->>importance', String(minImportance))
            .select('id');
        if (error)
            return 0;
        return data?.length || 0;
    }
    async getStats(userId) {
        const { data, error } = await this.supabase
            .from('context_storage')
            .select('category, created_at')
            .eq('user_id', userId);
        if (error)
            return { total: 0, byType: {}, newest: null, oldest: null };
        const byType = {};
        let newest = null;
        let oldest = null;
        for (const row of data || []) {
            byType[row.category] = (byType[row.category] || 0) + 1;
            if (!newest || row.created_at > newest)
                newest = row.created_at;
            if (!oldest || row.created_at < oldest)
                oldest = row.created_at;
        }
        return { total: data?.length || 0, byType, newest, oldest };
    }
    async summarizeRecent(userId, opts = {}) {
        const window = opts.window ?? 50;
        const { data, error } = await this.supabase
            .from('context_storage')
            .select('id, content, created_at, metadata')
            .eq('user_id', userId)
            .eq('category', 'conversation')
            .order('created_at', { ascending: false })
            .limit(window);
        if (error || !data || data.length === 0)
            return null;
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
//# sourceMappingURL=memory-service.js.map