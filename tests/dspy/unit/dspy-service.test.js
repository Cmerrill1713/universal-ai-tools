import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { DSPyService, } from '../../../src/services/dspy-service';
import { dspyBridge } from '../../../src/services/dspy-orchestrator/bridge';
import { v4 as uuidv4 } from 'uuid';
jest.mock('../../../src/services/dspy-orchestrator/bridge', () => ({
    dspyBridge: {
        getStatus: jest.fn(),
        orchestrate: jest.fn(),
        coordinateAgents: jest.fn(),
        manageKnowledge: jest.fn(),
        optimizePrompts: jest.fn(),
        shutdown: jest.fn(),
        on: jest.fn(),
        removeAllListeners: jest.fn(),
    },
}));
jest.mock('../../../src/utils/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
    },
}));
describe('DSPyService', () => {
    let dspyService;
    let mockBridge;
    beforeEach(() => {
        jest.clearAllMocks();
        mockBridge = dspyBridge;
        mockBridge.getStatus.mockReturnValue({
            connected: true,
            queueSize: 0,
        });
        dspyService = new DSPyService();
    });
    afterEach(async () => {
        await dspyService.shutdown();
    });
    describe('initialization', () => {
        it('should initialize successfully when bridge is connected', async () => {
            await new Promise((resolve) => setTimeout(resolve, 100));
            const status = dspyService.getStatus();
            expect(status.initialized).toBe(true);
            expect(status.connected).toBe(true);
        });
        it('should wait for connection if bridge is not initially connected', async () => {
            mockBridge.getStatus
                .mockReturnValueOnce({ connected: false, queueSize: 0 })
                .mockReturnValueOnce({ connected: false, queueSize: 0 })
                .mockReturnValue({ connected: true, queueSize: 0 });
            const newService = new DSPyService();
            await new Promise((resolve) => setTimeout(resolve, 3000));
            expect(mockBridge.getStatus).toHaveBeenCalledTimes(3);
        });
        it('should throw error on connection timeout', async () => {
            mockBridge.getStatus.mockReturnValue({ connected: false, queueSize: 0 });
            const newService = new DSPyService();
            await expect(newService.waitForConnection(1000)).rejects.toThrow('DSPy connection timeout');
        });
    });
    describe('orchestrate', () => {
        it('should successfully orchestrate a request', async () => {
            const request = {
                requestId: uuidv4(),
                userRequest: 'Help me write a Python function to calculate fibonacci',
                userId: 'test-user',
                orchestrationMode: 'cognitive',
                context: { language: 'Python' },
                timestamp: new Date(),
            };
            const mockResult = {
                orchestration_mode: 'cognitive',
                consensus: 'Here is a Python fibonacci function...',
                complexity: THREE,
                confidence: 0.95,
                coordination_plan: 'Using code assistant and planner agents',
                selected_agents: 'code_assistant, planner',
            };
            mockBridge.orchestrate.mockResolvedValue(mockResult);
            const response = await dspyService.orchestrate(request);
            expect(response).toMatchObject({
                requestId: request.requestId,
                success: true,
                mode: 'cognitive',
                result: mockResult.consensus,
                complexity: THREE,
                confidence: 0.95,
                reasoning: mockResult.coordination_plan,
                participatingAgents: ['code_assistant', 'planner'],
            });
            expect(response.executionTime).toBeGreaterThan(0);
        });
        it('should handle orchestration errors gracefully', async () => {
            const request = {
                requestId: uuidv4(),
                userRequest: 'Test error handling',
                userId: 'test-user',
                timestamp: new Date(),
            };
            mockBridge.orchestrate.mockRejectedValue(new Error('Connection failed'));
            const response = await dspyService.orchestrate(request);
            expect(response).toMatchObject({
                requestId: request.requestId,
                success: false,
                mode: 'fallback',
                result: null,
                error: 'Connection failed',
            });
            expect(response.executionTime).toBeGreaterThan(0);
        });
        it('should handle different orchestration modes', async () => {
            const modes = [
                'simple',
                'standard',
                'cognitive',
                'adaptive',
            ];
            for (const mode of modes) {
                const request = {
                    requestId: uuidv4(),
                    userRequest: `Test ${mode} mode`,
                    userId: 'test-user',
                    orchestrationMode: mode,
                    timestamp: new Date(),
                };
                mockBridge.orchestrate.mockResolvedValue({
                    orchestration_mode: mode,
                    consensus: `Result for ${mode} mode`,
                });
                const response = await dspyService.orchestrate(request);
                expect(response.mode).toBe(mode);
            }
        });
    });
    describe('coordinateAgents', () => {
        it('should coordinate agents successfully', async () => {
            const task = 'Write and test a sorting algorithm';
            const availableAgents = ['code_assistant', 'planner', 'tester'];
            const context = { language: 'TypeScript' };
            const mockResult = {
                selected_agents: ['code_assistant', 'tester'],
                coordination_plan: 'Code assistant writes, tester validates',
                agent_assignments: [
                    { agent: 'code_assistant', task: 'Write sorting algorithm' },
                    { agent: 'tester', task: 'Create unit tests' },
                ],
            };
            mockBridge.coordinateAgents.mockResolvedValue(mockResult);
            const result = await dspyService.coordinateAgents(task, availableAgents, context);
            expect(result).toEqual({
                success: true,
                selectedAgents: mockResult.selected_agents,
                coordinationPlan: mockResult.coordination_plan,
                assignments: mockResult.agent_assignments,
            });
            expect(mockBridge.coordinateAgents).toHaveBeenCalledWith(task, availableAgents, context);
        });
        it('should handle coordination errors', async () => {
            mockBridge.coordinateAgents.mockRejectedValue(new Error('No suitable agents'));
            await expect(dspyService.coordinateAgents('Complex task', [])).rejects.toThrow('No suitable agents');
        });
    });
    describe('knowledge management', () => {
        describe('searchKnowledge', () => {
            it('should search knowledge successfully', async () => {
                const query = 'TypeScript async patterns';
                const options = { limit: 10, threshold: 0.7 };
                const mockSearchResult = {
                    results: [
                        { content: 'Async/await pattern...', score: 0.9 },
                        { content: 'Promise patterns...', score: 0.85 },
                    ],
                    total: TWO,
                };
                mockBridge.manageKnowledge.mockResolvedValue(mockSearchResult);
                const result = await dspyService.searchKnowledge(query, options);
                expect(result).toEqual({
                    success: true,
                    operation: 'search',
                    result: mockSearchResult,
                });
                expect(mockBridge.manageKnowledge).toHaveBeenCalledWith('search', {
                    query,
                    ...options,
                });
            });
        });
        describe('extractKnowledge', () => {
            it('should extract knowledge from content', async () => {
                const content = 'TypeScript is a typed superset of JavaScript...';
                const context = { domain: 'programming' };
                const mockExtractResult = {
                    entities: ['TypeScript', 'JavaScript'],
                    concepts: ['typed language', 'superset'],
                    relationships: [{ from: 'TypeScript', to: 'JavaScript', type: 'superset_of' }],
                };
                mockBridge.manageKnowledge.mockResolvedValue(mockExtractResult);
                const result = await dspyService.extractKnowledge(content, context);
                expect(result).toEqual({
                    success: true,
                    operation: 'extract',
                    result: mockExtractResult,
                });
            });
        });
        describe('evolveKnowledge', () => {
            it('should evolve knowledge with new information', async () => {
                const existingKnowledge = 'Python is a programming language';
                const newInfo = 'Python 3.12 introduces new syntax features';
                const mockEvolveResult = {
                    evolved_knowledge: 'Python is a programming language. Python 3.12 introduces new syntax features.',
                    changes: ['Added version 3.12 information', 'Added syntax features mention'],
                    confidence: 0.9,
                };
                mockBridge.manageKnowledge.mockResolvedValue(mockEvolveResult);
                const result = await dspyService.evolveKnowledge(existingKnowledge, newInfo);
                expect(result).toEqual({
                    success: true,
                    operation: 'evolve',
                    result: mockEvolveResult,
                });
            });
        });
        it('should handle knowledge management errors', async () => {
            mockBridge.manageKnowledge.mockRejectedValue(new Error('Knowledge base unavailable'));
            await expect(dspyService.searchKnowledge('test query')).rejects.toThrow('Knowledge management failed');
        });
    });
    describe('optimizePrompts', () => {
        it('should optimize prompts successfully', async () => {
            const examples = [
                { input: 'Write a function', output: 'def func():' },
                { input: 'Create a class', output: 'class MyClass:' },
            ];
            const mockOptimizeResult = {
                optimized: true,
                improvements: ['Added context clarity', 'Improved instruction specificity'],
                performance_gain: 0.25,
            };
            mockBridge.optimizePrompts.mockResolvedValue(mockOptimizeResult);
            const result = await dspyService.optimizePrompts(examples);
            expect(result).toEqual({
                success: true,
                optimized: true,
                improvements: mockOptimizeResult.improvements,
                performanceGain: 0.25,
            });
        });
        it('should handle optimization errors', async () => {
            mockBridge.optimizePrompts.mockRejectedValue(new Error('Insufficient examples'));
            await expect(dspyService.optimizePrompts([])).rejects.toThrow('Prompt optimization failed');
        });
    });
    describe('getStatus', () => {
        it('should return correct status', () => {
            const status = dspyService.getStatus();
            expect(status).toEqual({
                initialized: true,
                connected: true,
                queueSize: 0,
            });
        });
        it('should reflect bridge status changes', () => {
            mockBridge.getStatus.mockReturnValue({
                connected: false,
                queueSize: 5,
            });
            const status = dspyService.getStatus();
            expect(status.connected).toBe(false);
            expect(status.queueSize).toBe(5);
        });
    });
    describe('shutdown', () => {
        it('should shutdown gracefully', async () => {
            await dspyService.shutdown();
            expect(mockBridge.shutdown).toHaveBeenCalled();
            expect(dspyService.getStatus().initialized).toBe(false);
        });
    });
    describe('edge cases', () => {
        it('should handle empty user requests', async () => {
            const request = {
                requestId: uuidv4(),
                userRequest: '',
                userId: 'test-user',
                timestamp: new Date(),
            };
            mockBridge.orchestrate.mockResolvedValue({
                consensus: 'Please provide a valid request',
            });
            const response = await dspyService.orchestrate(request);
            expect(response.success).toBe(true);
        });
        it('should handle very large contexts', async () => {
            const largeContext = {
                data: 'x'.repeat(10000),
                nested: { deep: { structure: Array(100).fill('item') } },
            };
            const request = {
                requestId: uuidv4(),
                userRequest: 'Process large context',
                userId: 'test-user',
                context: largeContext,
                timestamp: new Date(),
            };
            mockBridge.orchestrate.mockResolvedValue({
                consensus: 'Processed successfully',
            });
            const response = await dspyService.orchestrate(request);
            expect(response.success).toBe(true);
        });
        it('should handle concurrent requests', async () => {
            const requests = Array.from({ length: 10 }, (_, i) => ({
                requestId: uuidv4(),
                userRequest: `Concurrent request ${i}`,
                userId: 'test-user',
                timestamp: new Date(),
            }));
            mockBridge.orchestrate.mockImplementation(async (req) => ({
                consensus: `Processed: ${req}`,
            }));
            const responses = await Promise.all(requests.map((req) => dspyService.orchestrate(req)));
            expect(responses).toHaveLength(10);
            responses.forEach((response) => {
                expect(response.success).toBe(true);
            });
        });
    });
});
//# sourceMappingURL=dspy-service.test.js.map