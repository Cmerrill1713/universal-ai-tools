import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { DSPyService } from '../../../src/services/dspy-service';
import { UniversalAgentRegistry } from '../../../src/agents/universal_agent_registry';
import { EnhancedMemorySystem } from '../../../src/memory/enhanced_memory_system';
import { SupabaseService } from '../../../src/services/supabase_service';
import { logger } from '../../../src/utils/logger';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';
describe('DSPy End-to-End Workflows', () => {
    let dspyService;
    let agentRegistry;
    let memorySystem;
    let supabaseService;
    let testUserId;
    let testWorkspace;
    beforeAll(async () => {
        logger.info('🚀 Starting E2E workflow tests...');
        testUserId = `test-user-${uuidv4()}`;
        testWorkspace = path.join(process.cwd(), 'tests', 'dspy', 'e2e', 'workspace', testUserId);
        await fs.mkdir(testWorkspace, { recursive: true });
        dspyService = new DSPyService();
        agentRegistry = UniversalAgentRegistry.getInstance();
        memorySystem = EnhancedMemorySystem.getInstance();
        supabaseService = SupabaseService.getInstance();
        await new Promise((resolve) => setTimeout(resolve, 5000));
    });
    afterAll(async () => {
        await fs.rm(testWorkspace, { recursive: true, force: true });
        await dspyService.shutdown();
    });
    beforeEach(() => {
        jest.clearAllMocks();
    });
    async function executeWorkflow(name, steps) {
        const workflowId = uuidv4();
        const workflowStart = Date.now();
        const results = [];
        let overallSuccess = true;
        logger.info(`\n🔄 Starting workflow: ${name} (${workflowId})`);
        for (const step of steps) {
            const stepStart = Date.now();
            logger.info(`  ▶️ Executing: ${step.name}`);
            try {
                const result = await step.action();
                step.validate(result);
                const duration = Date.now() - stepStart;
                results.push({
                    name: step.name,
                    success: true,
                    duration,
                    result,
                });
                logger.info(`  ✅ Completed: ${step.name} (${duration}ms)`);
            }
            catch (error) {
                const duration = Date.now() - stepStart;
                overallSuccess = false;
                results.push({
                    name: step.name,
                    success: false,
                    duration,
                    error: error instanceof Error ? error.message : String(error),
                });
                logger.error(`  ❌ Failed: ${step.name} - ${error}`);
            }
        }
        const totalDuration = Date.now() - workflowStart;
        logger.info(`\n${overallSuccess ? '✅' : '❌'} Workflow completed in ${totalDuration}ms`);
        return {
            workflowId,
            steps: results,
            totalDuration,
            success: overallSuccess,
        };
    }
    describe('Code Development Workflow', () => {
        it('should complete a full code development workflow', async () => {
            const projectPath = path.join(testWorkspace, 'todo-api');
            const workflow = await executeWorkflow('Code Development', [
                {
                    name: 'Project Planning',
                    action: async () => {
                        return await dspyService.orchestrate({
                            requestId: uuidv4(),
                            userRequest: 'Plan a REST API for a todo list application with TypeScript, Express, and PostgreSQL',
                            userId: testUserId,
                            orchestrationMode: 'cognitive',
                            context: {
                                projectType: 'REST API',
                                technologies: ['TypeScript', 'Express', 'PostgreSQL'],
                                outputPath: projectPath,
                            },
                            timestamp: new Date(),
                        });
                    },
                    validate: (result) => {
                        expect(result.success).toBe(true);
                        expect(result.reasoning).toBeTruthy();
                        expect(result.participatingAgents).toContain('planner');
                    },
                },
                {
                    name: 'Code Generation',
                    action: async () => {
                        const agents = ['code_assistant_agent', 'file_manager_agent'];
                        return await dspyService.coordinateAgents('Generate TypeScript code for todo API endpoints', agents, {
                            projectPath,
                            endpoints: ['/todos', '/todos/:id'],
                            methods: ['GET', 'POST', 'PUT', 'DELETE'],
                        });
                    },
                    validate: (result) => {
                        expect(result.success).toBe(true);
                        expect(result.selectedAgents).toHaveLength(2);
                        expect(result.assignments).toBeTruthy();
                    },
                },
                {
                    name: 'Test Creation',
                    action: async () => {
                        return await dspyService.orchestrate({
                            requestId: uuidv4(),
                            userRequest: 'Create comprehensive unit tests for the todo API endpoints',
                            userId: testUserId,
                            orchestrationMode: 'standard',
                            context: {
                                projectPath,
                                testFramework: 'jest',
                                coverageTarget: 80,
                            },
                            timestamp: new Date(),
                        });
                    },
                    validate: (result) => {
                        expect(result.success).toBe(true);
                        expect(result.result).toBeTruthy();
                    },
                },
                {
                    name: 'Documentation',
                    action: async () => {
                        return await dspyService.manageKnowledge('extract', {
                            content: 'Todo API with CRUD operations',
                            context: {
                                type: 'API Documentation',
                                format: 'OpenAPI',
                                projectPath,
                            },
                        });
                    },
                    validate: (result) => {
                        expect(result.success).toBe(true);
                        expect(result.result).toHaveProperty('entities');
                        expect(result.result).toHaveProperty('concepts');
                    },
                },
                {
                    name: 'Knowledge Storage',
                    action: async () => {
                        const knowledge = {
                            type: 'project',
                            name: 'todo-api',
                            description: 'REST API for todo list management',
                            technologies: ['TypeScript', 'Express', 'PostgreSQL'],
                            timestamp: new Date(),
                        };
                        return await memorySystem.store(JSON.stringify(knowledge), testUserId, {
                            projectId: 'todo-api',
                            type: 'project-metadata',
                        });
                    },
                    validate: (result) => {
                        expect(result).toBeTruthy();
                        expect(typeof result).toBe('string');
                    },
                },
            ]);
            expect(workflow.success).toBe(true);
            expect(workflow.steps).toHaveLength(5);
            expect(workflow.totalDuration).toBeLessThan(30000);
        });
    });
    describe('Research and Analysis Workflow', () => {
        it('should complete a research workflow with knowledge evolution', async () => {
            const researchTopic = 'Quantum Computing Applications in Cryptography';
            let accumulatedKnowledge = '';
            const workflow = await executeWorkflow('Research and Analysis', [
                {
                    name: 'Initial Research',
                    action: async () => {
                        return await dspyService.searchKnowledge(researchTopic, {
                            limit: 20,
                            includeRelated: true,
                        });
                    },
                    validate: (result) => {
                        expect(result.success).toBe(true);
                        expect(result.result.results).toBeTruthy();
                        expect(Array.isArray(result.result.results)).toBe(true);
                    },
                },
                {
                    name: 'Deep Dive Analysis',
                    action: async () => {
                        return await dspyService.orchestrate({
                            requestId: uuidv4(),
                            userRequest: `Provide a comprehensive analysis of ${researchTopic} including current state, challenges, and future prospects`,
                            userId: testUserId,
                            orchestrationMode: 'cognitive',
                            context: {
                                depth: 'expert',
                                includeReferences: true,
                            },
                            timestamp: new Date(),
                        });
                    },
                    validate: (result) => {
                        expect(result.success).toBe(true);
                        expect(result.mode).toBe('cognitive');
                        expect(result.result).toBeTruthy();
                        accumulatedKnowledge = result.result;
                    },
                },
                {
                    name: 'Knowledge Extraction',
                    action: async () => {
                        return await dspyService.extractKnowledge(accumulatedKnowledge, {
                            domain: 'quantum-cryptography',
                            extractTypes: ['concepts', 'entities', 'relationships', 'implications'],
                        });
                    },
                    validate: (result) => {
                        expect(result.success).toBe(true);
                        expect(result.result.concepts).toBeTruthy();
                        expect(result.result.entities).toBeTruthy();
                    },
                },
                {
                    name: 'Knowledge Evolution',
                    action: async () => {
                        const newInformation = 'Recent breakthrough in quantum key distribution using entangled photons';
                        return await dspyService.evolveKnowledge(accumulatedKnowledge, newInformation);
                    },
                    validate: (result) => {
                        expect(result.success).toBe(true);
                        expect(result.result.evolved_knowledge).toContain('quantum key distribution');
                        expect(result.result.confidence).toBeGreaterThan(0.7);
                    },
                },
                {
                    name: 'Report Generation',
                    action: async () => {
                        return await dspyService.orchestrate({
                            requestId: uuidv4(),
                            userRequest: 'Generate an executive summary of the quantum cryptography research findings',
                            userId: testUserId,
                            orchestrationMode: 'standard',
                            context: {
                                format: 'executive-summary',
                                maxLength: 500,
                                audience: 'technical-leadership',
                            },
                            timestamp: new Date(),
                        });
                    },
                    validate: (result) => {
                        expect(result.success).toBe(true);
                        expect(result.result).toBeTruthy();
                        expect(result.result.length).toBeLessThan(1000);
                    },
                },
            ]);
            expect(workflow.success).toBe(true);
            expect(workflow.steps.every((step) => step.success)).toBe(true);
        });
    });
    describe('Multi-Agent Collaboration Workflow', () => {
        it('should coordinate multiple agents for a complex task', async () => {
            const projectRequirements = {
                type: 'web-scraper',
                target: 'e-commerce-prices',
                features: ['pagination', 'rate-limiting', 'data-export'],
                outputFormat: 'JSON',
            };
            const workflow = await executeWorkflow('Multi-Agent Collaboration', [
                {
                    name: 'Task Decomposition',
                    action: async () => {
                        const availableAgents = await agentRegistry.getAvailableAgents();
                        return await dspyService.coordinateAgents('Build a web scraper for e-commerce price monitoring', availableAgents.map((a) => a.id), projectRequirements);
                    },
                    validate: (result) => {
                        expect(result.success).toBe(true);
                        expect(result.selectedAgents.length).toBeGreaterThan(1);
                        expect(result.assignments).toBeTruthy();
                        expect(result.assignments.length).toBeGreaterThan(0);
                    },
                },
                {
                    name: 'Parallel Execution',
                    action: async () => {
                        const subtasks = [
                            {
                                request: 'Design the scraper architecture',
                                mode: 'standard',
                            },
                            {
                                request: 'Implement rate limiting logic',
                                mode: 'simple',
                            },
                            {
                                request: 'Create data export functionality',
                                mode: 'standard',
                            },
                        ];
                        const results = await Promise.all(subtasks.map((task) => dspyService.orchestrate({
                            requestId: uuidv4(),
                            userRequest: task.request,
                            userId: testUserId,
                            orchestrationMode: task.mode,
                            context: projectRequirements,
                            timestamp: new Date(),
                        })));
                        return results;
                    },
                    validate: (results) => {
                        expect(Array.isArray(results)).toBe(true);
                        expect(results).toHaveLength(3);
                        results.forEach((result) => {
                            expect(result.success).toBe(true);
                        });
                    },
                },
                {
                    name: 'Integration Testing',
                    action: async () => {
                        return await dspyService.orchestrate({
                            requestId: uuidv4(),
                            userRequest: 'Create integration tests for the web scraper components',
                            userId: testUserId,
                            orchestrationMode: 'cognitive',
                            context: {
                                components: ['scraper', 'rate-limiter', 'exporter'],
                                testingFramework: 'jest',
                                mockData: true,
                            },
                            timestamp: new Date(),
                        });
                    },
                    validate: (result) => {
                        expect(result.success).toBe(true);
                        expect(result.participatingAgents.length).toBeGreaterThan(0);
                    },
                },
                {
                    name: 'Performance Optimization',
                    action: async () => {
                        const testCases = [
                            { url: 'https://example.com/page1', expectedTime: 1000 },
                            { url: 'https://example.com/page2', expectedTime: 1200 },
                        ];
                        return await dspyService.optimizePrompts(testCases);
                    },
                    validate: (result) => {
                        expect(result.success).toBe(true);
                        expect(result.optimized).toBe(true);
                        expect(result.performanceGain).toBeGreaterThanOrEqual(0);
                    },
                },
            ]);
            expect(workflow.success).toBe(true);
            expect(workflow.steps.filter((s) => s.success).length).toBeGreaterThanOrEqual(3);
        });
    });
    describe('Adaptive Workflow with Error Recovery', () => {
        it('should adapt to changing requirements and handle errors', async () => {
            let currentContext = {
                complexity: 'simple',
                retryCount: 0,
            };
            const workflow = await executeWorkflow('Adaptive Error Recovery', [
                {
                    name: 'Initial Simple Task',
                    action: async () => {
                        return await dspyService.orchestrate({
                            requestId: uuidv4(),
                            userRequest: 'Calculate the sum of 1 to 100',
                            userId: testUserId,
                            orchestrationMode: 'adaptive',
                            context: currentContext,
                            timestamp: new Date(),
                        });
                    },
                    validate: (result) => {
                        expect(result.success).toBe(true);
                        expect(result.mode).toBeTruthy();
                        currentContext.lastMode = result.mode;
                    },
                },
                {
                    name: 'Complex Task Requiring Adaptation',
                    action: async () => {
                        currentContext.complexity = 'high';
                        return await dspyService.orchestrate({
                            requestId: uuidv4(),
                            userRequest: 'Design and implement a distributed cache invalidation strategy for a microservices architecture with eventual consistency requirements',
                            userId: testUserId,
                            orchestrationMode: 'adaptive',
                            context: currentContext,
                            timestamp: new Date(),
                        });
                    },
                    validate: (result) => {
                        expect(result.success).toBe(true);
                        expect(result.mode).not.toBe('simple');
                        expect(result.participatingAgents.length).toBeGreaterThan(1);
                    },
                },
                {
                    name: 'Error Simulation and Recovery',
                    action: async () => {
                        const problematicRequest = {
                            requestId: uuidv4(),
                            userRequest: '',
                            userId: testUserId,
                            orchestrationMode: 'adaptive',
                            context: { ...currentContext, allowEmpty: false },
                            timestamp: new Date(),
                        };
                        const result = await dspyService.orchestrate(problematicRequest);
                        if (!result.success) {
                            currentContext.retryCount++;
                            return await dspyService.orchestrate({
                                ...problematicRequest,
                                userRequest: 'Retry: Provide a default response for empty requests',
                                context: { ...currentContext, isRetry: true },
                            });
                        }
                        return result;
                    },
                    validate: (result) => {
                        expect(result).toBeTruthy();
                        if (currentContext.retryCount > 0) {
                            expect(result.success).toBe(true);
                        }
                    },
                },
                {
                    name: 'Context Persistence',
                    action: async () => {
                        const memoryId = await memorySystem.store(JSON.stringify(currentContext), testUserId, {
                            type: 'workflow-context',
                            workflowType: 'adaptive',
                        });
                        const retrieved = await memorySystem.retrieve(memoryId);
                        return { stored: currentContext, retrieved: JSON.parse(retrieved.content) };
                    },
                    validate: (result) => {
                        expect(result.retrieved).toEqual(result.stored);
                        expect(result.retrieved.retryCount).toBe(currentContext.retryCount);
                    },
                },
            ]);
            expect(workflow.success).toBe(true);
            expect(workflow.steps.filter((s) => s.success).length).toBeGreaterThanOrEqual(3);
        });
    });
    describe('Full System Integration', () => {
        it('should complete an end-to-end workflow using all system components', async () => {
            const sessionId = uuidv4();
            const knowledgeBase = [];
            const workflow = await executeWorkflow('Full System Integration', [
                {
                    name: 'Session Initialization',
                    action: async () => {
                        const sessionData = {
                            sessionId,
                            userId: testUserId,
                            startTime: new Date(),
                            goals: ['Learn about DSPy', 'Build a test application', 'Optimize performance'],
                        };
                        return await memorySystem.store(JSON.stringify(sessionData), testUserId, {
                            type: 'session',
                            sessionId,
                        });
                    },
                    validate: (result) => {
                        expect(result).toBeTruthy();
                        expect(typeof result).toBe('string');
                    },
                },
                {
                    name: 'Progressive Learning',
                    action: async () => {
                        const topics = [
                            'What is DSPy and how does it work?',
                            'How to implement prompt optimization with DSPy?',
                            'Best practices for agent coordination',
                        ];
                        const results = [];
                        for (const topic of topics) {
                            const response = await dspyService.orchestrate({
                                requestId: uuidv4(),
                                userRequest: topic,
                                userId: testUserId,
                                orchestrationMode: 'cognitive',
                                context: {
                                    sessionId,
                                    previousKnowledge: knowledgeBase,
                                },
                                timestamp: new Date(),
                            });
                            if (response.success) {
                                knowledgeBase.push(response.result);
                                results.push(response);
                            }
                        }
                        return results;
                    },
                    validate: (results) => {
                        expect(results).toHaveLength(3);
                        results.forEach((result) => {
                            expect(result.success).toBe(true);
                            expect(result.result).toBeTruthy();
                        });
                        expect(knowledgeBase).toHaveLength(3);
                    },
                },
                {
                    name: 'Knowledge Synthesis',
                    action: async () => {
                        return await dspyService.orchestrate({
                            requestId: uuidv4(),
                            userRequest: 'Synthesize all the learned information about DSPy into a practical implementation guide',
                            userId: testUserId,
                            orchestrationMode: 'cognitive',
                            context: {
                                sessionId,
                                knowledgeBase,
                                outputFormat: 'step-by-step-guide',
                            },
                            timestamp: new Date(),
                        });
                    },
                    validate: (result) => {
                        expect(result.success).toBe(true);
                        expect(result.mode).toBe('cognitive');
                        expect(result.result).toContain('DSPy');
                        expect(result.reasoning).toBeTruthy();
                    },
                },
                {
                    name: 'Implementation Planning',
                    action: async () => {
                        const allAgents = await agentRegistry.getAvailableAgents();
                        return await dspyService.coordinateAgents('Create a sample DSPy application based on the synthesized guide', allAgents.map((a) => a.id), {
                            sessionId,
                            guide: knowledgeBase[knowledgeBase.length - 1],
                            targetLanguage: 'TypeScript',
                        });
                    },
                    validate: (result) => {
                        expect(result.success).toBe(true);
                        expect(result.selectedAgents).toBeTruthy();
                        expect(result.coordinationPlan).toBeTruthy();
                        expect(result.assignments.length).toBeGreaterThan(0);
                    },
                },
                {
                    name: 'Performance Analysis',
                    action: async () => {
                        const metrics = {
                            totalRequests: 5,
                            successfulRequests: 5,
                            averageResponseTime: MILLISECONDS_IN_SECOND,
                            knowledgeItemsCreated: knowledgeBase.length,
                            agentsUsed: new Set(),
                        };
                        return await memorySystem.store(JSON.stringify(metrics), testUserId, {
                            type: 'performance-metrics',
                            sessionId,
                        });
                    },
                    validate: (result) => {
                        expect(result).toBeTruthy();
                    },
                },
                {
                    name: 'Session Cleanup',
                    action: async () => {
                        return {
                            sessionId,
                            itemsProcessed: knowledgeBase.length,
                            success: true,
                        };
                    },
                    validate: (result) => {
                        expect(result.success).toBe(true);
                        expect(result.itemsProcessed).toBeGreaterThan(0);
                    },
                },
            ]);
            expect(workflow.success).toBe(true);
            expect(workflow.steps).toHaveLength(6);
            expect(workflow.totalDuration).toBeLessThan(60000);
            const failedSteps = workflow.steps.filter((s) => !s.success);
            expect(failedSteps).toHaveLength(0);
        });
    });
    describe('Stress Testing', () => {
        it('should handle high-load scenarios gracefully', async () => {
            const concurrentUsers = 10;
            const requestsPerUser = 5;
            const userWorkflows = await Promise.all(Array.from({ length: concurrentUsers }, (_, userIndex) => executeWorkflow(`User ${userIndex} Workflow`, Array.from({ length: requestsPerUser }, (_, reqIndex) => ({
                name: `Request ${reqIndex}`,
                action: async () => {
                    return await dspyService.orchestrate({
                        requestId: uuidv4(),
                        userRequest: `User ${userIndex} request ${reqIndex}: Perform a simple calculation`,
                        userId: `stress-test-user-${userIndex}`,
                        orchestrationMode: 'simple',
                        timestamp: new Date(),
                    });
                },
                validate: (result) => {
                    expect(result.success).toBe(true);
                },
            })))));
            const totalRequests = concurrentUsers * requestsPerUser;
            const successfulWorkflows = userWorkflows.filter((w) => w.success).length;
            const totalSteps = userWorkflows.reduce((sum, w) => sum + w.steps.length, 0);
            const successfulSteps = userWorkflows.reduce((sum, w) => sum + w.steps.filter((s) => s.success).length, 0);
            logger.info(`\n📊 Stress Test Results:`);
            logger.info(`Total Workflows: ${concurrentUsers}`);
            logger.info(`Successful Workflows: ${successfulWorkflows}`);
            logger.info(`Total Requests: ${totalRequests}`);
            logger.info(`Successful Requests: ${successfulSteps}`);
            logger.info(`Success Rate: ${((successfulSteps / totalSteps) * 100).toFixed(2)}%`);
            expect(successfulSteps / totalSteps).toBeGreaterThan(0.95);
        });
    });
});
//# sourceMappingURL=full-workflow.test.js.map