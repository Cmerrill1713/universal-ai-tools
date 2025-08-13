import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { mcpIntegrationService } from '@/services/mcp-integration-service';
import { log, LogContext } from '@/utils/logger';
const router = Router();
router.get('/status', async (req, res) => {
    try {
        const status = mcpIntegrationService.getHealthStatus();
        const fullStatus = mcpIntegrationService.getStatus();
        res.json({
            success: true,
            data: {
                connected: status.isRunning,
                status: fullStatus.status,
                uptime: status.uptime,
                messageCount: status.messageCount,
                errorCount: status.errorCount,
                processId: status.processId,
                lastPing: status.lastPing
            },
            metadata: { requestId: uuidv4() }
        });
    }
    catch (error) {
        log.error('Failed to get MCP status', LogContext.API, {
            error: error instanceof Error ? error.message : String(error),
        });
        res.json({
            success: true,
            data: {
                connected: false,
                status: 'Failed',
                error: error instanceof Error ? error.message : String(error)
            },
            metadata: { requestId: uuidv4() }
        });
    }
});
router.get('/resources', async (req, res) => {
    try {
        const contextResult = await mcpIntegrationService.sendMessage('get_recent_context', {
            limit: 100
        });
        const resources = [
            {
                id: '1',
                name: 'Project Context',
                type: 'context',
                uri: 'mcp://context/project',
                count: contextResult?.count || 0
            },
            {
                id: '2',
                name: 'Code Patterns',
                type: 'patterns',
                uri: 'mcp://patterns/code',
                count: 0
            },
            {
                id: '3',
                name: 'Database Schema',
                type: 'schema',
                uri: 'mcp://db/schema',
                count: 1
            }
        ];
        res.json({
            success: true,
            data: {
                resources,
                total: resources.length,
                connected: mcpIntegrationService.isRunning()
            },
            metadata: { requestId: uuidv4() }
        });
    }
    catch (error) {
        log.error('Failed to list MCP resources', LogContext.API, {
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({
            success: false,
            error: 'Failed to list MCP resources',
            metadata: { requestId: uuidv4() }
        });
    }
});
router.get('/resources/:uri', async (req, res) => {
    try {
        const { uri } = req.params;
        const decodedUri = decodeURIComponent(uri);
        let result;
        if (decodedUri.startsWith('mcp://context/')) {
            const category = decodedUri.replace('mcp://context/', '');
            result = await mcpIntegrationService.sendMessage('get_recent_context', {
                category: category === 'project' ? undefined : category,
                limit: 50
            });
        }
        else if (decodedUri.startsWith('mcp://patterns/')) {
            const patternType = decodedUri.replace('mcp://patterns/', '');
            result = await mcpIntegrationService.sendMessage('get_code_patterns', {
                pattern_type: patternType === 'code' ? undefined : patternType,
                limit: 20
            });
        }
        else if (decodedUri === 'mcp://db/schema') {
            result = {
                content: 'Database schema available via MCP integration service',
                type: 'schema',
                tables: ['mcp_context', 'mcp_code_patterns']
            };
        }
        else {
            result = { content: `Resource not found: ${decodedUri}` };
        }
        res.json({
            success: true,
            data: {
                uri: decodedUri,
                content: result.content || result,
                connected: mcpIntegrationService.isRunning()
            },
            metadata: { requestId: uuidv4() }
        });
    }
    catch (error) {
        log.error('Failed to read MCP resource', LogContext.API, {
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({
            success: false,
            error: 'Failed to read MCP resource',
            metadata: { requestId: uuidv4() }
        });
    }
});
router.get('/tools', async (req, res) => {
    try {
        const tools = [
            {
                name: 'save_context',
                description: 'Save contextual information to MCP storage',
                schema: {
                    type: 'object',
                    properties: {
                        content: { type: 'string', description: 'Content to save' },
                        category: { type: 'string', description: 'Content category' },
                        metadata: { type: 'object', description: 'Additional metadata' }
                    },
                    required: ['content', 'category']
                }
            },
            {
                name: 'search_context',
                description: 'Search through stored context',
                schema: {
                    type: 'object',
                    properties: {
                        query: { type: 'string', description: 'Search query' },
                        category: { type: 'string', description: 'Category to search in' },
                        limit: { type: 'number', description: 'Maximum results to return' }
                    },
                    required: ['query']
                }
            },
            {
                name: 'save_code_pattern',
                description: 'Save a code pattern to MCP storage',
                schema: {
                    type: 'object',
                    properties: {
                        pattern_type: { type: 'string', description: 'Type of code pattern' },
                        before_code: { type: 'string', description: 'Code before transformation' },
                        after_code: { type: 'string', description: 'Code after transformation' },
                        description: { type: 'string', description: 'Pattern description' },
                        error_types: { type: 'array', description: 'Types of errors this pattern fixes' }
                    },
                    required: ['pattern_type', 'before_code', 'after_code']
                }
            },
            {
                name: 'get_code_patterns',
                description: 'Get code patterns from MCP storage',
                schema: {
                    type: 'object',
                    properties: {
                        pattern_type: { type: 'string', description: 'Type of pattern to search for' },
                        error_type: { type: 'string', description: 'Error type to find patterns for' },
                        limit: { type: 'number', description: 'Maximum patterns to return' }
                    }
                }
            },
            {
                name: 'propose_migration',
                description: 'Generate SQL migration using local LLM',
                schema: {
                    type: 'object',
                    properties: {
                        request: { type: 'string', description: 'Migration request description' },
                        notes: { type: 'string', description: 'Additional notes or context' },
                        model: { type: 'string', description: 'LLM model to use' }
                    },
                    required: ['request']
                }
            }
        ];
        res.json({
            success: true,
            data: {
                tools,
                count: tools.length,
                connected: mcpIntegrationService.isRunning()
            },
            metadata: { requestId: uuidv4() }
        });
    }
    catch (error) {
        log.error('Failed to list MCP tools', LogContext.API, {
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({
            success: false,
            error: 'Failed to list MCP tools',
            metadata: { requestId: uuidv4() }
        });
    }
});
router.post('/tools/call', async (req, res) => {
    try {
        const { name, arguments: args } = req.body;
        if (!name) {
            return res.status(400).json({
                success: false,
                error: 'Tool name is required',
                metadata: { requestId: uuidv4() }
            });
        }
        log.info(`MCP tool call: ${name}`, LogContext.MCP, { arguments: args });
        const result = await mcpIntegrationService.sendMessage(name, args || {});
        return res.json({
            success: true,
            data: {
                result,
                tool: name,
                connected: mcpIntegrationService.isRunning()
            },
            metadata: { requestId: uuidv4() }
        });
    }
    catch (error) {
        log.error('Failed to call MCP tool', LogContext.API, {
            error: error instanceof Error ? error.message : String(error),
        });
        return res.status(500).json({
            success: false,
            error: 'Failed to call MCP tool',
            details: error instanceof Error ? error.message : String(error),
            metadata: { requestId: uuidv4() }
        });
    }
});
router.get('/prompts', async (req, res) => {
    try {
        const prompts = [
            {
                name: 'analyze_code',
                description: 'Analyze code quality and patterns',
                arguments: ['filepath', 'language']
            },
            {
                name: 'summarize_project',
                description: 'Summarize project structure and purpose',
                arguments: ['depth']
            },
            {
                name: 'generate_docs',
                description: 'Generate documentation for code',
                arguments: ['component', 'format']
            }
        ];
        res.json({
            success: true,
            data: { prompts },
            metadata: { requestId: uuidv4() }
        });
    }
    catch (error) {
        log.error('Failed to list MCP prompts', LogContext.API, {
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({
            success: false,
            error: 'Failed to list MCP prompts',
            metadata: { requestId: uuidv4() }
        });
    }
});
router.post('/prompts/get', async (req, res) => {
    try {
        const { name, arguments: args } = req.body;
        if (!name) {
            return res.status(400).json({
                success: false,
                error: 'Prompt name is required',
                metadata: { requestId: uuidv4() }
            });
        }
        log.info(`MCP prompt request: ${name}`, LogContext.MCP, { arguments: args });
        let prompt = '';
        switch (name) {
            case 'analyze_code':
                prompt = `Please analyze the code file ${args?.filepath || '[file]'} written in ${args?.language || '[language]'} for quality, patterns, and potential improvements.`;
                break;
            case 'summarize_project':
                prompt = `Please provide a summary of this project structure and its main purpose, analyzing to depth level ${args?.depth || '2'}.`;
                break;
            case 'generate_docs':
                prompt = `Generate ${args?.format || 'markdown'} documentation for the ${args?.component || '[component]'} component.`;
                break;
            default:
                prompt = `Generated prompt for ${name}`;
        }
        return res.json({
            success: true,
            data: { prompt },
            metadata: { requestId: uuidv4() }
        });
    }
    catch (error) {
        log.error('Failed to get MCP prompt', LogContext.API, {
            error: error instanceof Error ? error.message : String(error),
        });
        return res.status(500).json({
            success: false,
            error: 'Failed to get MCP prompt',
            metadata: { requestId: uuidv4() }
        });
    }
});
export default router;
//# sourceMappingURL=mcp-agent.js.map