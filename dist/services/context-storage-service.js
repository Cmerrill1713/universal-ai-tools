import { createClient } from '@supabase/supabase-js';
import { config } from '../config/environment';
import { log, LogContext } from '../utils/logger';
export class ContextStorageService {
    supabase;
    constructor() {
        this.supabase = createClient(config.supabase.url, config.supabase.serviceKey);
    }
    async storeContext(context) {
        try {
            const embedding = await this.generateEmbedding((config.llm.ollamaUrl || 'http://localhost:11434').replace(/\/$/, ''), context.content);
            const { data, error } = await this.supabase
                .from('context_storage')
                .insert({
                content: context.content,
                category: context.category,
                source: context.source,
                user_id: context.userId,
                project_path: context.projectPath || null,
                metadata: context.metadata || {},
                embedding,
            })
                .select('id')
                .single();
            if (error) {
                log.error('Failed to store context to Supabase', LogContext.DATABASE, {
                    error: error.message,
                    category: context.category,
                    source: context.source,
                });
                return null;
            }
            log.info('✅ Context stored to Supabase', LogContext.DATABASE, {
                contextId: data.id,
                category: context.category,
                source: context.source,
                contentLength: context.content.length,
            });
            return data.id;
        }
        catch (error) {
            log.error('Error storing context to Supabase', LogContext.DATABASE, {
                error: error instanceof Error ? error.message : String(error),
            });
            return null;
        }
    }
    async backfillEmbeddingsForUser(userId, maxRows = 500) {
        const ollamaUrl = (config.llm.ollamaUrl || 'http://localhost:11434').replace(/\/$/, '');
        const { data: rows, error } = await this.supabase
            .from('context_storage')
            .select('id, content')
            .eq('user_id', userId)
            .is('embedding', null)
            .order('updated_at', { ascending: false })
            .limit(maxRows);
        if (error || !rows || rows.length === 0) {
            return { updated: 0 };
        }
        let updated = 0;
        for (const row of rows) {
            const embedding = await this.generateEmbedding(ollamaUrl, row.content);
            const { error: upErr } = await this.supabase
                .from('context_storage')
                .update({ embedding })
                .eq('id', row.id);
            if (!upErr)
                updated += 1;
        }
        return { updated };
    }
    async generateEmbedding(ollamaUrl, content) {
        try {
            const truncated = content.length > 2000 ? `${content.slice(0, 2000)}...` : content;
            const res = await fetch(`${ollamaUrl}/api/embeddings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: 'all-minilm:latest', prompt: truncated }),
            });
            if (res.ok) {
                const json = await res.json();
                if (Array.isArray(json?.embedding))
                    return json.embedding;
            }
            return this.generateFallbackEmbedding(content);
        }
        catch {
            return this.generateFallbackEmbedding(content);
        }
    }
    generateFallbackEmbedding(content) {
        const embedding = new Array(384).fill(0);
        const words = (content || '').toLowerCase().split(/\s+/);
        for (let i = 0; i < words.length && i < 100; i++) {
            const w = words[i];
            if (!w)
                continue;
            let h = 0;
            for (let j = 0; j < w.length; j++) {
                h = (h << 5) - h + w.charCodeAt(j);
                h |= 0;
            }
            const idx = Math.abs(h) % embedding.length;
            embedding[idx] += 1 / (i + 1);
        }
        const mag = Math.sqrt(embedding.reduce((s, v) => s + v * v, 0));
        return mag > 0 ? embedding.map((v) => v / mag) : embedding;
    }
    async getContext(userId, category, projectPath, limit = 10) {
        try {
            let query = this.supabase
                .from('context_storage')
                .select('*')
                .eq('user_id', userId)
                .order('updated_at', { ascending: false })
                .limit(limit);
            if (category) {
                query = query.eq('category', category);
            }
            if (projectPath) {
                query = query.eq('project_path', projectPath);
            }
            const { data, error } = await query;
            if (error) {
                log.error('Failed to retrieve context from Supabase', LogContext.DATABASE, {
                    error: error.message,
                    userId,
                    category,
                    projectPath,
                });
                return [];
            }
            log.info('📖 Retrieved context from Supabase', LogContext.DATABASE, {
                resultsCount: data?.length || 0,
                userId,
                category,
                projectPath,
            });
            return data || [];
        }
        catch (error) {
            log.error('Error retrieving context from Supabase', LogContext.DATABASE, {
                error: error instanceof Error ? error.message : String(error),
            });
            return [];
        }
    }
    async updateContext(contextId, updates) {
        try {
            const updateData = {};
            if (updates.content) {
                updateData.content = updates.content;
            }
            if (updates.category) {
                updateData.category = updates.category;
            }
            if (updates.source) {
                updateData.source = updates.source;
            }
            if (updates.metadata) {
                updateData.metadata = updates.metadata;
            }
            if (updates.projectPath) {
                updateData.project_path = updates.projectPath;
            }
            updateData.updated_at = new Date().toISOString();
            const { error } = await this.supabase
                .from('context_storage')
                .update(updateData)
                .eq('id', contextId);
            if (error) {
                log.error('Failed to update context in Supabase', LogContext.DATABASE, {
                    error: error.message,
                    contextId,
                });
                return false;
            }
            log.info('✅ Context updated in Supabase', LogContext.DATABASE, {
                contextId,
            });
            return true;
        }
        catch (error) {
            log.error('Error updating context in Supabase', LogContext.DATABASE, {
                error: error instanceof Error ? error.message : String(error),
            });
            return false;
        }
    }
    async searchContext(userId, searchQuery, category, limit = 5) {
        try {
            let query = this.supabase
                .from('context_storage')
                .select('*')
                .eq('user_id', userId)
                .textSearch('content', searchQuery, { type: 'websearch' })
                .order('updated_at', { ascending: false })
                .limit(limit);
            if (category) {
                query = query.eq('category', category);
            }
            let { data, error } = await query;
            if (error) {
                try {
                    const terms = searchQuery
                        .toLowerCase()
                        .split(/\s+/)
                        .filter((t) => t.length > 2)
                        .slice(0, 5);
                    const pattern = `%${terms.join('%')}%`;
                    const fallback = await this.supabase
                        .from('context_storage')
                        .select('*')
                        .eq('user_id', userId)
                        .ilike('content', pattern)
                        .order('updated_at', { ascending: false })
                        .limit(limit);
                    if (!fallback.error) {
                        data = fallback.data || [];
                    }
                }
                catch (e) {
                    log.error('Failed to search context in Supabase', LogContext.DATABASE, {
                        error: e instanceof Error ? e.message : String(e),
                        searchQuery,
                        userId,
                        category,
                    });
                    return [];
                }
            }
            log.info('🔍 Context search completed', LogContext.DATABASE, {
                resultsCount: data?.length || 0,
                searchQuery,
                userId,
                category,
            });
            return data || [];
        }
        catch (error) {
            log.error('Error searching context in Supabase', LogContext.DATABASE, {
                error: error instanceof Error ? error.message : String(error),
            });
            return [];
        }
    }
    async storeTestResults(userId, testResults, source, projectPath) {
        return this.storeContext({
            content: JSON.stringify(testResults, null, 2),
            category: 'test_results',
            source,
            userId,
            projectPath,
            metadata: {
                timestamp: new Date().toISOString(),
                testType: 'automated',
                resultType: typeof testResults,
            },
        });
    }
    async storeConversation(userId, conversation, source, projectPath) {
        return this.storeContext({
            content: conversation,
            category: 'conversation',
            source,
            userId,
            projectPath,
            metadata: {
                timestamp: new Date().toISOString(),
                conversationType: 'user_assistant',
            },
        });
    }
    async cleanupOldContext(userId, daysOld = 30) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysOld);
            const { data, error } = await this.supabase
                .from('context_storage')
                .delete()
                .eq('user_id', userId)
                .lt('created_at', cutoffDate.toISOString())
                .select('id');
            if (error) {
                log.error('Failed to cleanup old context', LogContext.DATABASE, {
                    error: error.message,
                    userId,
                    daysOld,
                });
                return 0;
            }
            const deletedCount = data?.length || 0;
            log.info('🧹 Cleaned up old context entries', LogContext.DATABASE, {
                deletedCount,
                userId,
                daysOld,
            });
            return deletedCount;
        }
        catch (error) {
            log.error('Error cleaning up old context', LogContext.DATABASE, {
                error: error instanceof Error ? error.message : String(error),
            });
            return 0;
        }
    }
    async getContextStats(userId) {
        try {
            const { data, error } = await this.supabase
                .from('context_storage')
                .select('category, created_at')
                .eq('user_id', userId);
            if (error) {
                throw error;
            }
            const stats = {
                totalEntries: data?.length || 0,
                entriesByCategory: {},
                oldestEntry: null,
                newestEntry: null,
            };
            if (data && data.length > 0) {
                data.forEach((entry) => {
                    stats.entriesByCategory[entry.category] =
                        (stats.entriesByCategory[entry.category] || 0) + 1;
                });
                const dates = data.map((entry) => entry.created_at).sort();
                stats.oldestEntry = dates[0];
                stats.newestEntry = dates[dates.length - 1];
            }
            return stats;
        }
        catch (error) {
            log.error('Error getting context stats', LogContext.DATABASE, {
                error: error instanceof Error ? error.message : String(error),
            });
            return {
                totalEntries: 0,
                entriesByCategory: {},
                oldestEntry: null,
                newestEntry: null,
            };
        }
    }
}
export const contextStorageService = new ContextStorageService();
export default contextStorageService;
//# sourceMappingURL=context-storage-service.js.map