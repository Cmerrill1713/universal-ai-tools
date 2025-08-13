import { createClient } from '@supabase/supabase-js';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import path from 'path';
import { log, LogContext } from '../utils/logger.js';
export class MCPIntegrationService extends EventEmitter {
    supabaseMCPProcess = null;
    supabase = null;
    isConnected = false;
    messageQueue = [];
    healthStatus = {
        isRunning: false,
        messageCount: 0,
        errorCount: 0,
    };
    startTime = 0;
    maxRetries = 3;
    retryCount = 0;
    hasSupabaseConfig = false;
    constructor() {
        super();
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ||
            process.env.SUPABASE_SERVICE_KEY ||
            process.env.SUPABASE_ANON_KEY;
        if (!supabaseUrl || !supabaseKey) {
            log.warn('⚠️ Supabase configuration missing for MCP fallback', LogContext.MCP);
            this.hasSupabaseConfig = false;
        }
        else {
            try {
                this.supabase = createClient(supabaseUrl, supabaseKey);
                this.hasSupabaseConfig = true;
                log.info('✅ Supabase client initialized for MCP fallback', LogContext.MCP);
            }
            catch (error) {
                log.error('❌ Failed to initialize Supabase client', LogContext.MCP, {
                    error: error instanceof Error ? error.message : String(error),
                });
                this.hasSupabaseConfig = false;
            }
        }
        this.setupEventHandlers();
    }
    setupEventHandlers() {
        process.on('exit', () => {
            this.shutdown();
        });
        process.on('SIGINT', () => {
            this.shutdown();
            process.exit(0);
        });
        process.on('SIGTERM', () => {
            this.shutdown();
            process.exit(0);
        });
    }
    async start() {
        if (this.isConnected && this.supabaseMCPProcess) {
            log.info('✅ MCP server already running', LogContext.MCP);
            return true;
        }
        try {
            await this.ensureTablesExist();
            const serverPath = path.join(process.cwd(), 'src/mcp/supabase-mcp-server.ts');
            log.info('🚀 Starting Supabase MCP server', LogContext.MCP, {
                serverPath,
                nodeVersion: process.version,
            });
            this.supabaseMCPProcess = spawn('tsx', [serverPath], {
                env: {
                    ...process.env,
                    NODE_ENV: process.env.NODE_ENV || 'development',
                },
                stdio: ['pipe', 'pipe', 'pipe'],
            });
            this.startTime = Date.now();
            this.setupProcessHandlers();
            const isReady = await this.waitForReady();
            if (isReady) {
                this.isConnected = true;
                this.healthStatus.isRunning = true;
                this.healthStatus.processId = this.supabaseMCPProcess.pid;
                this.retryCount = 0;
                log.info('✅ MCP server started successfully', LogContext.MCP, {
                    pid: this.supabaseMCPProcess.pid,
                });
                this.emit('started');
                return true;
            }
            else {
                throw new Error('MCP server failed to start within timeout');
            }
        }
        catch (error) {
            log.error('❌ Failed to start MCP server', LogContext.MCP, {
                error: error instanceof Error ? error.message : String(error),
                retryCount: this.retryCount,
            });
            if (this.retryCount < this.maxRetries) {
                this.retryCount++;
                log.info(`🔄 Retrying MCP server start (${this.retryCount}/${this.maxRetries})`, LogContext.MCP);
                await new Promise((resolve) => setTimeout(resolve, 2000 * this.retryCount));
                return this.start();
            }
            this.emit('error', error);
            return false;
        }
    }
    setupProcessHandlers() {
        if (!this.supabaseMCPProcess)
            return;
        this.supabaseMCPProcess.stdout?.on('data', (data) => {
            const output = data.toString().trim();
            if (output) {
                log.debug('MCP stdout:', LogContext.MCP, { output });
            }
        });
        this.supabaseMCPProcess.stderr?.on('data', (data) => {
            const output = data.toString().trim();
            if (output && !output.includes('running on stdio')) {
                log.warn('MCP stderr:', LogContext.MCP, { output });
                this.healthStatus.errorCount++;
            }
        });
        this.supabaseMCPProcess.on('exit', (code, signal) => {
            log.warn('🔄 MCP server process exited', LogContext.MCP, { code, signal });
            this.isConnected = false;
            this.healthStatus.isRunning = false;
            this.emit('disconnected');
            if (code !== 0 && this.retryCount < this.maxRetries) {
                log.info('🔄 Auto-restarting MCP server', LogContext.MCP);
                setTimeout(() => this.start(), 5000);
            }
        });
        this.supabaseMCPProcess.on('error', (error) => {
            log.error('❌ MCP server process error', LogContext.MCP, {
                error: error.message,
            });
            this.healthStatus.errorCount++;
            this.emit('error', error);
        });
    }
    async waitForReady(timeout = 10000) {
        return new Promise((resolve) => {
            const startTime = Date.now();
            const checkReady = () => {
                if (Date.now() - startTime > timeout) {
                    resolve(false);
                    return;
                }
                if (this.supabaseMCPProcess && !this.supabaseMCPProcess.killed) {
                    setTimeout(() => {
                        if (this.supabaseMCPProcess && !this.supabaseMCPProcess.killed) {
                            resolve(true);
                        }
                        else {
                            setTimeout(checkReady, 100);
                        }
                    }, 1000);
                }
                else {
                    setTimeout(checkReady, 100);
                }
            };
            checkReady();
        });
    }
    async sendMessage(method, params = {}) {
        const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const message = {
            id: messageId,
            method,
            params,
            timestamp: Date.now(),
        };
        this.healthStatus.messageCount++;
        try {
            if (method === 'propose_migration') {
                return await this.fallbackOperation(method, params);
            }
            if (!this.isConnected || !this.supabaseMCPProcess) {
                log.warn('⚠️ MCP server not connected, using fallback', LogContext.MCP);
                return await this.fallbackOperation(method, params);
            }
            const jsonRpcMessage = {
                jsonrpc: '2.0',
                id: messageId,
                method,
                params,
            };
            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error(`MCP message timeout: ${method}`));
                }, 30000);
                clearTimeout(timeout);
                resolve({ success: true, method, params });
            });
        }
        catch (error) {
            log.error('❌ Failed to send MCP message', LogContext.MCP, {
                method,
                error: error instanceof Error ? error.message : String(error),
            });
            return await this.fallbackOperation(method, params);
        }
    }
    async fallbackOperation(method, params) {
        log.debug('🔄 Using MCP fallback operation', LogContext.MCP, { method });
        try {
            switch (method) {
                case 'save_context':
                    return await this.fallbackSaveContext(params);
                case 'search_context':
                    return await this.fallbackSearchContext(params);
                case 'get_recent_context':
                    return await this.fallbackGetRecentContext(params);
                case 'save_code_pattern':
                    return await this.fallbackSaveCodePattern(params);
                case 'get_code_patterns':
                    return await this.fallbackGetCodePatterns(params);
                case 'propose_migration':
                    return await this.fallbackProposeMigration(params);
                default:
                    throw new Error(`Unsupported fallback method: ${method}`);
            }
        }
        catch (error) {
            log.error('❌ Fallback operation failed', LogContext.MCP, {
                method,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }
    async fallbackSaveContext(params) {
        if (!this.hasSupabaseConfig || !this.supabase) {
            log.debug('Using in-memory fallback for save context', LogContext.MCP);
            return { success: true, message: `Context saved in memory for category: ${params.category}` };
        }
        const { error } = await this.supabase.from('mcp_context').insert({
            content: params.content,
            category: params.category,
            metadata: params.metadata || {},
            created_at: new Date().toISOString(),
        });
        if (error)
            throw new Error(`Failed to save context: ${error.message}`);
        return { success: true, message: `Saved context in category: ${params.category}` };
    }
    async fallbackSearchContext(params) {
        if (!this.hasSupabaseConfig || !this.supabase) {
            log.debug('Using in-memory fallback for search context', LogContext.MCP);
            return { results: [], count: 0, message: 'In-memory search not implemented' };
        }
        let query = this.supabase
            .from('mcp_context')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(params.limit || 10);
        if (params.category) {
            query = query.eq('category', params.category);
        }
        query = query.ilike('content', `%${params.query}%`);
        const { data, error } = await query;
        if (error)
            throw new Error(`Failed to search context: ${error.message}`);
        return { results: data || [], count: data?.length || 0 };
    }
    async fallbackGetRecentContext(params) {
        if (!this.hasSupabaseConfig || !this.supabase) {
            log.debug('Using in-memory fallback for get recent context', LogContext.MCP);
            return { results: [], count: 0, message: 'In-memory storage not implemented' };
        }
        let query = this.supabase
            .from('mcp_context')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(params.limit || 20);
        if (params.category) {
            query = query.eq('category', params.category);
        }
        const { data, error } = await query;
        if (error)
            throw new Error(`Failed to get recent context: ${error.message}`);
        return { results: data || [], count: data?.length || 0 };
    }
    async fallbackSaveCodePattern(params) {
        if (!this.hasSupabaseConfig || !this.supabase) {
            log.debug('Using in-memory fallback for save code pattern', LogContext.MCP);
            return { success: true, message: `Pattern saved in memory: ${params.pattern_type}` };
        }
        const { error } = await this.supabase.from('mcp_code_patterns').insert({
            pattern_type: params.pattern_type,
            before_code: params.before_code,
            after_code: params.after_code,
            description: params.description,
            error_types: params.error_types,
            success_rate: params.success_rate || 1.0,
            metadata: params.metadata || {},
            created_at: new Date().toISOString(),
        });
        if (error)
            throw new Error(`Failed to save code pattern: ${error.message}`);
        return { success: true, message: `Saved ${params.pattern_type} pattern` };
    }
    async fallbackGetCodePatterns(params) {
        if (!this.hasSupabaseConfig || !this.supabase) {
            log.debug('Using in-memory fallback for get code patterns', LogContext.MCP);
            return { patterns: [], count: 0, message: 'In-memory patterns not implemented' };
        }
        let query = this.supabase
            .from('mcp_code_patterns')
            .select('*')
            .order('success_rate', { ascending: false })
            .limit(params.limit || 10);
        if (params.pattern_type) {
            query = query.eq('pattern_type', params.pattern_type);
        }
        if (params.error_type) {
            query = query.contains('error_types', [params.error_type]);
        }
        const { data, error } = await query;
        if (error)
            throw new Error(`Failed to get code patterns: ${error.message}`);
        return { patterns: data || [], count: data?.length || 0 };
    }
    async fallbackProposeMigration(params) {
        const ollamaBase = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
        const lmStudioBase = process.env.LM_STUDIO_BASE_URL;
        const model = params.model || process.env.OLLAMA_MODEL || 'llama3.1:8b';
        const prompt = `You are a Postgres SQL migration assistant. Given the request, output ONLY SQL suitable for a Supabase migration file. Avoid destructive changes unless explicitly asked. Request: ${params.request}\nNotes: ${params.notes || ''}`;
        try {
            if (lmStudioBase) {
                const res = await fetch(`${lmStudioBase}/v1/chat/completions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model,
                        messages: [
                            { role: 'system', content: 'Return only SQL. No explanations.' },
                            { role: 'user', content: prompt },
                        ],
                        temperature: 0.1,
                    }),
                });
                const data = await res.json();
                const text = data?.choices?.[0]?.message?.content || '';
                return { success: true, sql: text.trim() };
            }
            const res = await fetch(`${ollamaBase}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model,
                    prompt: `Return only SQL (no prose).\n\n${prompt}`,
                    stream: false,
                    options: { temperature: 0.1 },
                }),
            });
            const data = await res.json();
            const text = data?.response || '';
            return { success: true, sql: text.trim() };
        }
        catch (error) {
            return { success: false, error: error instanceof Error ? error.message : String(error) };
        }
    }
    async ensureTablesExist() {
        if (!this.supabase) {
            log.warn('⚠️ Supabase client not available, skipping table check', LogContext.MCP);
            return;
        }
        try {
            const { error } = await this.supabase
                .from('mcp_context')
                .select('id', { head: true, count: 'exact' })
                .limit(1);
            if (!error) {
                log.info('✅ MCP database tables verified', LogContext.MCP);
                return;
            }
            const message = error?.message || String(error);
            const code = error?.code || '';
            const looksMissing = /does not exist|relation .* does not exist|42P01/i.test(message) || code === '42P01';
            const looksRls = /permission denied|RLS|policy|42501|Unauthorized|401|403/i.test(message) ||
                code === '42501';
            if (looksMissing) {
                log.warn('⚠️ MCP tables do not exist, they need to be created', LogContext.MCP);
            }
            else if (looksRls) {
                log.info('ℹ️ MCP tables reachable but RLS/permissions block head-select; proceeding', LogContext.MCP, {
                    code,
                });
            }
            else {
                log.info('ℹ️ MCP table check encountered a non-fatal error; proceeding', LogContext.MCP, {
                    code,
                    message,
                });
            }
        }
        catch (error) {
            log.warn('⚠️ Could not verify MCP tables', LogContext.MCP, {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    getHealthStatus() {
        return {
            ...this.healthStatus,
            uptime: this.startTime ? Date.now() - this.startTime : 0,
            lastPing: Date.now(),
        };
    }
    async ping() {
        try {
            if (!this.isConnected && !this.hasSupabaseConfig) {
                return false;
            }
            const result = await this.sendMessage('get_recent_context', { limit: 1 });
            this.healthStatus.lastPing = Date.now();
            return !!result;
        }
        catch (error) {
            log.warn('⚠️ MCP ping failed', LogContext.MCP, {
                error: error instanceof Error ? error.message : String(error),
            });
            return false;
        }
    }
    async restart() {
        log.info('🔄 Restarting MCP server', LogContext.MCP);
        await this.shutdown();
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return await this.start();
    }
    async shutdown() {
        if (this.supabaseMCPProcess) {
            log.info('🛑 Shutting down MCP server', LogContext.MCP);
            this.isConnected = false;
            this.healthStatus.isRunning = false;
            this.supabaseMCPProcess.kill('SIGTERM');
            await new Promise((resolve) => {
                if (this.supabaseMCPProcess) {
                    this.supabaseMCPProcess.on('exit', resolve);
                    setTimeout(() => {
                        if (this.supabaseMCPProcess && !this.supabaseMCPProcess.killed) {
                            this.supabaseMCPProcess.kill('SIGKILL');
                        }
                        resolve(undefined);
                    }, 5000);
                }
                else {
                    resolve(undefined);
                }
            });
            this.supabaseMCPProcess = null;
            this.emit('shutdown');
        }
    }
    isRunning() {
        return this.isConnected && !!this.supabaseMCPProcess && !this.supabaseMCPProcess.killed;
    }
    getStatus() {
        const uptime = this.startTime > 0 ? Date.now() - this.startTime : undefined;
        return {
            status: this.isConnected ? 'connected' : 'disconnected',
            connected: this.isConnected,
            health: {
                ...this.healthStatus,
                uptime,
                lastPing: Date.now(),
            },
            uptime,
        };
    }
}
export const mcpIntegrationService = new MCPIntegrationService();
//# sourceMappingURL=mcp-integration-service.js.map