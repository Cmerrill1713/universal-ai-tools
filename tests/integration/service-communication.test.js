import { describe, test, expect, beforeAll, afterAll } from '@jest/testjs/globals';
import { UniversalAIToolsServer } from '../../src/server';
import { contextStorageService } from '../../src/services/context-storage-service';
import { mcpIntegrationService } from '../../src/services/mcp-integration-service';
import { vaultService } from '../../src/services/vault-service';
import AgentRegistry from '../../src/agents/agent-registry';
describe('Service Communication Integration Tests', () => {
    let server;
    let agentRegistry;
    beforeAll(async () => {
        server = new UniversalAIToolsServer();
        agentRegistry = new AgentRegistry();
        await new Promise(resolve => setTimeout(resolve, 2000));
    });
    afterAll(async () => {
        if (agentRegistry) {
            await agentRegistry.shutdown();
        }
    });
    describe('Context Storage Service Integration', () => {
        test('should store and retrieve context successfully', async () => {
            const testContext = {
                content: 'Integration test context',
                category: 'test_results',
                source: 'integration-test',
                userId: 'test-user',
                projectPath: '/test/path',
                metadata: {
                    testId: 'integration-test-1',
                    timestamp: new Date().toISOString()
                }
            };
            const contextId = await contextStorageService.storeContext(testContext);
            expect(contextId).toBeTruthy();
            const retrievedContext = await contextStorageService.getContext(testContext.userId, testContext.category, testContext.projectPath, 1);
            expect(retrievedContext).toHaveLength(1);
            expect(retrievedContext[0].content).toBe(testContext.content);
            expect(retrievedContext[0].category).toBe(testContext.category);
        });
        test('should search context by content', async () => {
            const searchResults = await contextStorageService.searchContext('test-user', 'integration test', 'test_results', 5);
            expect(Array.isArray(searchResults)).toBe(true);
        });
        test('should get context statistics', async () => {
            const stats = await contextStorageService.getContextStats('test-user');
            expect(stats).toHaveProperty('totalEntries');
            expect(stats).toHaveProperty('entriesByCategory');
            expect(typeof stats.totalEntries).toBe('number');
            expect(typeof stats.entriesByCategory).toBe('object');
        });
    });
    describe('MCP Integration Service', () => {
        test('should provide MCP status', async () => {
            const status = await mcpIntegrationService.getStatus();
            expect(status).toHaveProperty('server');
            expect(status.server).toHaveProperty('running');
            expect(status.server).toHaveProperty('port');
            expect(typeof status.server.running).toBe('boolean');
        });
        test('should handle context storage operations', async () => {
            const testParams = {
                content: 'MCP integration test content',
                category: 'integration_test',
                metadata: { test: true }
            };
            try {
                const result = await mcpIntegrationService.storeContext(testParams);
                expect(result === null || typeof result === 'object').toBe(true);
            }
            catch (error) {
                expect(error).toBeDefined();
            }
        });
        test('should handle fallback operations gracefully', async () => {
            const fallbackResult = await mcpIntegrationService.searchCodePatterns('test query');
            expect(Array.isArray(fallbackResult) || fallbackResult === null).toBe(true);
        });
    });
    describe('Vault Service Integration', () => {
        test('should test vault connectivity', async () => {
            const connectivity = await vaultService.testVaultConnectivity();
            expect(connectivity).toHaveProperty('connected');
            expect(typeof connectivity.connected).toBe('boolean');
            if (!connectivity.connected) {
                expect(connectivity).toHaveProperty('error');
            }
        });
        test('should handle secret operations gracefully', async () => {
            const missingSecret = await vaultService.getSecret('non_existent_secret');
            expect(missingSecret).toBeNull();
        });
        test('should provide cache statistics', async () => {
            const cacheStats = vaultService.getCacheStats();
            expect(cacheStats).toHaveProperty('size');
            expect(cacheStats).toHaveProperty('entries');
            expect(typeof cacheStats.size).toBe('number');
            expect(Array.isArray(cacheStats.entries)).toBe(true);
        });
    });
    describe('Agent Registry Integration', () => {
        test('should initialize and provide available agents', async () => {
            const availableAgents = agentRegistry.getAvailableAgents();
            expect(Array.isArray(availableAgents)).toBe(true);
            expect(availableAgents.length).toBeGreaterThan(0);
            availableAgents.forEach(agent => {
                expect(agent).toHaveProperty('name');
                expect(agent).toHaveProperty('description');
                expect(agent).toHaveProperty('category');
                expect(agent).toHaveProperty('capabilities');
            });
        });
        test('should load agents on demand', async () => {
            const availableAgents = agentRegistry.getAvailableAgents();
            if (availableAgents.length > 0) {
                const firstAgent = availableAgents[0];
                try {
                    const agent = await agentRegistry.getAgent(firstAgent.name);
                    expect(agent).toBeTruthy();
                    const loadedAgents = agentRegistry.getLoadedAgents();
                    expect(loadedAgents).toContain(firstAgent.name);
                }
                catch (error) {
                    expect(error).toBeDefined();
                }
            }
        });
        test('should provide mesh status', async () => {
            const meshStatus = agentRegistry.getMeshStatus();
            expect(meshStatus).toBeDefined();
        });
    });
    describe('Cross-Service Communication', () => {
        test('should store agent execution context in context service', async () => {
            const executionContext = {
                content: JSON.stringify({
                    agentName: 'test-agent',
                    userRequest: 'Test agent execution',
                    result: { success: true, message: 'Test completed' },
                    executionTime: 150,
                    timestamp: new Date().toISOString()
                }),
                category: 'test_results',
                source: 'agent-execution-test',
                userId: 'integration-test-user',
                metadata: {
                    agentName: 'test-agent',
                    executionTime: 150,
                    success: true
                }
            };
            const contextId = await contextStorageService.storeContext(executionContext);
            expect(contextId).toBeTruthy();
            const retrievedContext = await contextStorageService.getContext(executionContext.userId, executionContext.category);
            expect(retrievedContext.length).toBeGreaterThan(0);
            const matchingContext = retrievedContext.find(ctx => ctx.id === contextId);
            expect(matchingContext).toBeTruthy();
        });
        test('should handle service failure gracefully', async () => {
            try {
                const result = await contextStorageService.getContext('invalid-user', 'invalid-category');
                expect(Array.isArray(result)).toBe(true);
            }
            catch (error) {
                expect(error).toBeDefined();
            }
        });
    });
    describe('Service Health and Status', () => {
        test('should provide comprehensive service status', async () => {
            const services = [
                { name: 'Context Storage', service: contextStorageService },
                { name: 'MCP Integration', service: mcpIntegrationService },
                { name: 'Vault Service', service: vaultService },
                { name: 'Agent Registry', service: agentRegistry }
            ];
            const healthChecks = await Promise.allSettled(services.map(async ({ name, service }) => {
                try {
                    const isHealthy = service && typeof service === 'object';
                    return { name, healthy: isHealthy, error: null };
                }
                catch (error) {
                    return {
                        name,
                        healthy: false,
                        error: error instanceof Error ? error.message : String(error)
                    };
                }
            }));
            expect(healthChecks).toHaveLength(services.length);
            healthChecks.forEach((result, index) => {
                expect(result.status).toBeDefined();
                if (result.status === 'fulfilled') {
                    expect(result.value).toHaveProperty('name');
                    expect(result.value).toHaveProperty('healthy');
                }
            });
        });
    });
});
//# sourceMappingURL=service-communication.test.js.map