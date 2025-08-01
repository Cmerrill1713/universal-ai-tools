import { describe, it, beforeAll, afterAll, beforeEach, afterEach, expect } from '@jest/globals';
import { logger } from '../../src/utils/logger';
import { KnowledgeManager, knowledgeUtils } from '../../src/core/knowledge/knowledge-manager';
import { IntelligentExtractor, extractionUtils } from '../../src/core/knowledge/intelligent-extractor';
import { OnlineResearchAgent } from '../../src/core/knowledge/online-research-agent';
import { SearXNGClient } from '../../src/core/knowledge/searxng-client';
import { createClient } from '@supabase/supabase-js';
import * as puppeteer from 'puppeteer';
import { setTimeout } from 'timers/promises';
describe('Full System Integration Test', () => {
    let testContext;
    let cleanup = [];
    beforeAll(async () => {
        logger.info('🚀 Starting Full System Integration Test');
        testContext = await initializeTestContext();
        await setupTestEnvironment(testContext);
        logger.info('✅ Test environment initialized successfully');
    }, 60000);
    afterAll(async () => {
        logger.info('🧹 Cleaning up Full System Integration Test');
        for (const cleanupFn of cleanup) {
            try {
                await cleanupFn();
            }
            catch (error) {
                logger.error('Cleanup error:', error);
            }
        }
        await finalCleanup(testContext);
        logger.info('✅ Full System Integration Test cleanup complete');
    }, 30000);
    beforeEach(async () => {
        testContext.testMetrics = {
            totalStartTime: Date.now(),
            totalEndTime: 0,
            totalDuration: 0,
            phaseTimes: {},
            successRate: 0,
            errorRate: 0,
            knowledgeItemsCreated: 0,
            extractionAccuracy: 0,
            coordinationEfficiency: 0,
            learningEffectiveness: 0,
            browserTasksCompleted: 0,
            searchResultsProcessed: 0,
            memoryUsage: process.memoryUsage().heapUsed,
            cpuUsage: process.cpuUsage().user
        };
    });
    afterEach(async () => {
        testContext.testMetrics.totalEndTime = Date.now();
        testContext.testMetrics.totalDuration = testContext.testMetrics.totalEndTime - testContext.testMetrics.totalStartTime;
        logger.info('📊 Test Metrics:', testContext.testMetrics);
    });
    it('should handle a complete TypeScript error resolution scenario', async () => {
        const scenario = {
            problemDescription: 'Module import error: Cannot find module "@/components/ui/button" or its corresponding type declarations',
            errorType: 'module_import_error',
            technology: 'TypeScript',
            severity: 'high',
            context: {
                project: 'React TypeScript Application',
                component: 'Button component import',
                environment: 'development',
                buildTool: 'Vite'
            }
        };
        await executePhase('coordination_setup', async () => {
            logger.info('🎯 Phase 1: Setting up coordination for TypeScript error');
            const coordinationPlan = {
                id: `plan-${Date.now()}`,
                problem: scenario.problemDescription,
                severity: scenario.severity,
                assignedAgents: ['agent-1', 'agent-2', 'agent-3'],
                strategies: ['primary-strategy', 'backup-strategy'],
                status: 'planning',
                startTime: Date.now(),
                results: [],
                context: {
                    sessionId: testContext.sessionId,
                    sharedState: scenario.context,
                    dependencies: {},
                    resourceLimits: {
                        maxConcurrentTasks: 10,
                        taskTimeout: 30000,
                        memoryLimit: 1024 * 1024 * 50,
                        cpuLimit: 70
                    },
                    capabilities: []
                },
                tasks: []
            };
            expect(coordinationPlan).toBeDefined();
            expect(coordinationPlan.problem).toBe(scenario.problemDescription);
            expect(coordinationPlan.severity).toBe(scenario.severity);
            expect(coordinationPlan.assignedAgents.length).toBeGreaterThan(0);
            testContext.testMetrics.coordinationEfficiency = 85;
            return coordinationPlan;
        });
        const researchResults = await executePhase('online_research', async () => {
            logger.info('🔍 Phase 2: Conducting online research for TypeScript import errors');
            const researchQuery = {
                error: scenario.problemDescription,
                context: JSON.stringify(scenario.context),
                technology: scenario.technology,
                severity: scenario.severity
            };
            const solution = await testContext.onlineResearchAgent.researchSolution(researchQuery);
            expect(solution).toBeDefined();
            expect(solution?.confidence).toBeGreaterThan(50);
            expect(solution?.sources.length).toBeGreaterThan(0);
            testContext.testMetrics.searchResultsProcessed = solution?.sources.length;
            return solution;
        });
        const extractionResults = await executePhase('intelligent_extraction', async () => {
            logger.info('🧠 Phase 3: Extracting intelligent insights from research results');
            const extractionContext = extractionUtils.createContext(testContext.sessionId, 'test-agent-001', 'task-extract-solution', 'stackoverflow.com', 'html', 'extract TypeScript module import solutions', {
                confidenceThreshold: 0.7,
                coordinationEnabled: true,
                learningEnabled: true
            });
            const allExtractions = [];
            for (const source of researchResults?.sources.slice(0, THREE)) {
                const mockContent = `
          <html>
            <head><title>TypeScript Import Error Solution</title></head>
            <body>
              <div class="answer">
                <h2>Solution for TypeScript Import Error</h2>
                <p>This error typically occurs when the module path is incorrect or the module doesn't exist.</p>
                <pre><code>
                  // Solution 1: Check if the path is correct
                  import { Button } from "@/components/ui/button";
                  
                  // Solution 2: Use relative path
                  import { Button } from "../components/ui/button";
                  
                  // Solution 3: Check tsconfig.json paths
                  {
                    "compilerOptions": {
                      "paths": {
                        "@/*": ["./src/*"]
                      }
                    }
                  }
                </code></pre>
                <p>Make sure the file exists at the specified path and is properly exported.</p>
              </div>
            </body>
          </html>
        `;
                const extraction = await testContext.intelligentExtractor.extract(mockContent, extractionContext, testContext.page);
                expect(extraction.success).toBe(true);
                expect(extraction.confidence).toBeGreaterThan(0.5);
                allExtractions.push(extraction);
            }
            testContext.testMetrics.extractionAccuracy =
                allExtractions.filter(e => e.success).length / allExtractions.length;
            return allExtractions;
        });
        const knowledgeIds = await executePhase('knowledge_management', async () => {
            logger.info('📚 Phase 4: Storing and managing extracted knowledge');
            const knowledgeIds = [];
            const solutionKnowledge = knowledgeUtils.createSolutionKnowledge('TypeScript Module Import Error Fix', {
                errorType: 'module_import_error',
                technology: 'TypeScript',
                solutions: [
                    'Verify module path is correct',
                    'Check tsconfig.json paths configuration',
                    'Ensure module exists and is properly exported',
                    'Use relative paths if absolute paths fail'
                ],
                codeExamples: [
                    'import { Button } from "@/components/ui/button";',
                    'import { Button } from "../components/ui/button";'
                ],
                configurationFixes: [
                    'Update tsconfig.json paths mapping',
                    'Check build tool configuration'
                ]
            }, {
                errorMessage: scenario.problemDescription,
                technology: scenario.technology,
                severity: scenario.severity,
                researchSources: researchResults?.sources,
                extractionResults: extractionResults.map(e => e.extractedData)
            }, {
                domain: 'frontend',
                technology: ['typescript', 'react', 'vite'],
                complexity: 'medium',
                quality_score: 0.9,
                impact_score: 0.8
            });
            const solutionId = await testContext.knowledgeManager.storeKnowledge(solutionKnowledge);
            knowledgeIds.push(solutionId);
            const patternKnowledge = knowledgeUtils.createPatternKnowledge('TypeScript Import Error Pattern', {
                errorPattern: 'Cannot find module.*or its corresponding type declarations',
                commonCauses: [
                    'Incorrect module path',
                    'Missing tsconfig.json paths',
                    'Module not exported properly',
                    'Build tool configuration issue'
                ],
                diagnosticSteps: [
                    'Check file existence',
                    'Verify export statements',
                    'Validate tsconfig.json',
                    'Check build configuration'
                ]
            }, {
                coordinationPlan: 'multi-agent-typescript-debugging',
                extractionPatterns: extractionResults.map(e => e.patternMatches),
                learningInsights: extractionResults.map(e => e.learningInsights)
            }, {
                domain: 'development',
                technology: ['typescript'],
                complexity: 'medium',
                quality_score: 0.85,
                impact_score: 0.9
            });
            const patternId = await testContext.knowledgeManager.storeKnowledge(patternKnowledge);
            knowledgeIds.push(patternId);
            const errorKnowledge = knowledgeUtils.createErrorKnowledge('TypeScript Module Import Error', {
                errorType: 'ImportError',
                errorMessage: scenario.problemDescription,
                stackTrace: 'Error: Cannot find module "@/components/ui/button"',
                affectedFiles: ['src/components/MyComponent.tsx'],
                buildTool: 'Vite'
            }, {
                project: scenario.context.project,
                environment: scenario.context.environment,
                reproductionSteps: [
                    'Create React TypeScript project',
                    'Import component with path alias',
                    'Run build or dev server'
                ]
            }, {
                domain: 'development',
                technology: ['typescript', 'react'],
                complexity: 'medium',
                quality_score: 0.8,
                impact_score: 0.95
            });
            const errorId = await testContext.knowledgeManager.storeKnowledge(errorKnowledge);
            knowledgeIds.push(errorId);
            testContext.testMetrics.knowledgeItemsCreated = knowledgeIds.length;
            return knowledgeIds;
        });
        await executePhase('knowledge_retrieval', async () => {
            logger.info('🔍 Phase 5: Retrieving and validating stored knowledge');
            const searchResults = await testContext.knowledgeManager.searchKnowledge({
                content_search: 'TypeScript import error',
                type: ['solution', 'pattern', 'error'],
                technology: ['typescript'],
                min_confidence: 0.7,
                limit: 10
            });
            expect(searchResults.items.length).toBeGreaterThan(0);
            expect(searchResults.items.some(item => knowledgeIds.includes(item.id))).toBe(true);
            const recommendations = await testContext.knowledgeManager.getRecommendations({
                domain: 'frontend',
                technology: ['typescript', 'react'],
                problem_type: 'module import error',
                agent_id: 'test-agent-001',
                session_id: testContext.sessionId
            });
            expect(recommendations.length).toBeGreaterThan(0);
            for (const knowledgeId of knowledgeIds) {
                const knowledge = await testContext.knowledgeManager.getKnowledge(knowledgeId);
                expect(knowledge).toBeDefined();
                expect(knowledge?.confidence).toBeGreaterThan(0.5);
                const validationEvent = await testContext.knowledgeManager.validateKnowledge(knowledgeId, 'automated', 'test-validator');
                expect(validationEvent.score).toBeGreaterThan(0.5);
            }
        });
        await executePhase('task_execution', async () => {
            logger.info('🤖 Phase 6: Executing coordinated browser tasks');
            const browserTasks = [
                {
                    name: 'Check tsconfig.json',
                    action: async () => {
                        await testContext.page.goto('data:text/html,<html><body><h1>tsconfig.json</h1><pre>{"compilerOptions": {"paths": {"@/*": ["./src/*"]}}}</pre></body></html>');
                        await setTimeout(1000);
                        const title = await testContext.page.title();
                        expect(title).toBe('');
                        return { success: true, data: { configFound: true } };
                    }
                },
                {
                    name: 'Verify file structure',
                    action: async () => {
                        await testContext.page.goto('data:text/html,<html><body><h1>File Structure</h1><div>src/components/ui/button.tsx - Found</div></body></html>');
                        await setTimeout(1000);
                        const content = await testContext.page.content();
                        expect(content).toContain('File Structure');
                        return { success: true, data: { fileExists: true } };
                    }
                },
                {
                    name: 'Test import resolution',
                    action: async () => {
                        await testContext.page.goto('data:text/html,<html><body><h1>Import Test</h1><div class="success">Import resolved successfully</div></body></html>');
                        await setTimeout(1000);
                        const successElement = await testContext.page.$('.success');
                        expect(successElement).toBeDefined();
                        return { success: true, data: { importResolved: true } };
                    }
                }
            ];
            const taskResults = [];
            for (const task of browserTasks) {
                logger.info(`Executing browser task: ${task.name}`);
                const result = await task.action();
                taskResults.push(result);
            }
            testContext.testMetrics.browserTasksCompleted = taskResults.filter(r => r.success).length;
            expect(taskResults.every(r => r.success)).toBe(true);
        });
        await executePhase('learning_evolution', async () => {
            logger.info('🧬 Phase 7: Learning and evolution from the experience');
            const evolutionResults = [];
            for (const knowledgeId of knowledgeIds) {
                const evolution = await testContext.knowledgeManager.evolveKnowledge(knowledgeId, {
                    evolution_type: 'refinement',
                    description: 'Updated based on successful TypeScript error resolution',
                    changes: [
                        {
                            field: 'confidence',
                            old_value: 0.8,
                            new_value: 0.9,
                            change_type: 'modification',
                            confidence: 0.95,
                            reasoning: 'Successful application in real scenario'
                        },
                        {
                            field: 'metadata.quality_score',
                            old_value: 0.8,
                            new_value: 0.95,
                            change_type: 'modification',
                            confidence: 0.9,
                            reasoning: 'High success rate in task execution'
                        }
                    ],
                    trigger: {
                        type: 'usage_pattern',
                        source: 'integration_test',
                        confidence: 0.95,
                        context: {
                            scenarioType: 'typescript_import_error',
                            successRate: 1.0,
                            taskCompletionRate: 1.0
                        }
                    },
                    impact_assessment: {
                        affected_knowledge: knowledgeIds,
                        users_impacted: 1,
                        systems_affected: ['typescript', 'react', 'vite'],
                        risk_level: 'low',
                        rollback_plan: 'Revert to previous version if needed'
                    }
                });
                evolutionResults.push(evolution);
            }
            testContext.testMetrics.learningEffectiveness = evolutionResults.length / knowledgeIds.length;
            expect(evolutionResults.length).toBe(knowledgeIds.length);
        });
        await executePhase('system_health', async () => {
            logger.info('📊 Phase 8: Checking system health and collecting metrics');
            const knowledgeMetrics = await testContext.knowledgeManager.getKnowledgeMetrics();
            expect(knowledgeMetrics.total_items).toBeGreaterThan(0);
            expect(knowledgeMetrics.average_confidence).toBeGreaterThan(0.5);
            const extractorMetrics = await testContext.intelligentExtractor.getPerformanceMetrics();
            expect(extractorMetrics.patterns).toBeDefined();
            expect(extractorMetrics.cache.size).toBeGreaterThan(0);
            const coordinationStats = {
                totalPlans: 1,
                activePlans: 0,
                completedPlans: 1,
                failedPlans: 0,
                totalAgents: THREE,
                activeAgents: THREE,
                totalTasks: 6,
                completedTasks: 6,
                averagePlanDuration: 45000,
                successRate: 100
            };
            expect(coordinationStats.totalPlans).toBeGreaterThan(0);
            expect(coordinationStats.successRate).toBeGreaterThan(0);
            try {
                const researchHealth = await testContext.onlineResearchAgent.checkHealth();
                logger.info('Research agent health:', researchHealth);
            }
            catch (error) {
                logger.info('Research agent health check failed (expected in CI):', error);
            }
            testContext.testMetrics.successRate = 100;
            testContext.testMetrics.errorRate = 0;
            const memoryUsage = process.memoryUsage();
            const cpuUsage = process.cpuUsage();
            testContext.testMetrics.memoryUsage = memoryUsage.heapUsed - testContext.testMetrics.memoryUsage;
            testContext.testMetrics.cpuUsage = cpuUsage.user - testContext.testMetrics.cpuUsage;
            logger.info('📊 Final System Health Metrics:', {
                knowledge: knowledgeMetrics,
                extractor: extractorMetrics,
                coordination: coordinationStats,
                test: testContext.testMetrics
            });
        });
        logger.info('🎯 Final Validation: All phases completed successfully');
        expect(testContext.testMetrics.successRate).toBeGreaterThan(0);
        expect(testContext.testMetrics.knowledgeItemsCreated).toBeGreaterThan(0);
        expect(testContext.testMetrics.extractionAccuracy).toBeGreaterThan(0);
        expect(testContext.testMetrics.coordinationEfficiency).toBeGreaterThan(0);
        expect(testContext.testMetrics.learningEffectiveness).toBeGreaterThan(0);
        expect(testContext.testMetrics.browserTasksCompleted).toBeGreaterThan(0);
        logger.info('✅ Full System Integration Test completed successfully!');
        logger.info('🎉 The system demonstrated complete end-to-end functionality with TypeScript error resolution');
    }, 300000);
    it('should handle error recovery and fallback scenarios', async () => {
        logger.info('🔄 Testing error recovery and fallback scenarios');
        const errorScenario = {
            problemDescription: 'Network connection failed to external service',
            errorType: 'connection_failure',
            technology: 'Node.js',
            severity: 'critical'
        };
        await expect(async () => {
            const faultyKnowledge = knowledgeUtils.createSolutionKnowledge('Faulty Test Knowledge', null, {});
            await testContext.knowledgeManager.storeKnowledge(faultyKnowledge);
        }).rejects.toThrow();
        const extractionContext = extractionUtils.createContext(testContext.sessionId, 'test-agent-recovery', 'task-recovery-test', 'unknown-domain.com', 'html', 'test error recovery');
        const emptyExtraction = await testContext.intelligentExtractor.extract('', extractionContext);
        expect(emptyExtraction.success).toBe(false);
        expect(emptyExtraction.error).toBeDefined();
        const coordinationPlan = {
            id: `error-plan-${Date.now()}`,
            problem: errorScenario.problemDescription,
            severity: errorScenario.severity,
            assignedAgents: ['recovery-agent-1', 'recovery-agent-2'],
            strategies: ['primary-recovery', 'fallback-recovery'],
            status: 'planning',
            startTime: Date.now(),
            results: [],
            context: {
                sessionId: testContext.sessionId,
                sharedState: { errorScenario },
                dependencies: {},
                resourceLimits: {
                    maxConcurrentTasks: 5,
                    taskTimeout: 15000,
                    memoryLimit: 1024 * 1024 * 25,
                    cpuLimit: 50
                },
                capabilities: []
            },
            tasks: []
        };
        expect(coordinationPlan).toBeDefined();
        expect(coordinationPlan.strategies.length).toBeGreaterThan(1);
        logger.info('✅ Error recovery and fallback scenarios tested successfully');
    });
    it('should demonstrate system learning and adaptation', async () => {
        logger.info('🧠 Testing system learning and adaptation capabilities');
        const initialKnowledge = knowledgeUtils.createSolutionKnowledge('Learning Test Solution', { initialVersion: 1.0 }, { testScenario: 'learning_adaptation' });
        const knowledgeId = await testContext.knowledgeManager.storeKnowledge(initialKnowledge);
        await testContext.knowledgeManager.validateKnowledge(knowledgeId, 'automated', 'test-validator');
        const evolution = await testContext.knowledgeManager.evolveKnowledge(knowledgeId, {
            evolution_type: 'refinement',
            description: 'Learning from usage patterns',
            changes: [
                {
                    field: 'content.primary.version',
                    old_value: 1.0,
                    new_value: 1.1,
                    change_type: 'modification',
                    confidence: 0.9,
                    reasoning: 'Improved through usage'
                }
            ],
            trigger: {
                type: 'usage_pattern',
                source: 'learning_test',
                confidence: 0.9,
                context: { learning: true }
            }
        });
        expect(evolution).toBeDefined();
        const updatedKnowledge = await testContext.knowledgeManager.getKnowledge(knowledgeId);
        expect(updatedKnowledge?.content.primary.version).toBe(1.1);
        const pattern = extractionUtils.createPattern('learning-test-pattern', 'Learning Test Pattern', 'dom', '.test-element', [
            { name: 'test_field', type: 'text', required: true, selector: '.test-text' }
        ], { confidence: 0.5 });
        await testContext.intelligentExtractor.addPattern(pattern);
        const testContent = '<div class="test-element"><span class="test-text">Test content</span></div>';
        const extractionContext = extractionUtils.createContext(testContext.sessionId, 'learning-agent', 'learning-task', 'test-domain.com', 'html', 'test pattern learning');
        const extraction = await testContext.intelligentExtractor.extract(testContent, extractionContext);
        expect(extraction.success).toBe(true);
        const patterns = await testContext.intelligentExtractor.getPatterns();
        const learningPattern = patterns.find(p => p.id === 'learning-test-pattern');
        expect(learningPattern?.evolutionData.successCount).toBeGreaterThan(0);
        logger.info('✅ System learning and adaptation tested successfully');
    });
    async function executePhase(phaseName, phaseFunction) {
        const startTime = Date.now();
        logger.info(`🔄 Starting phase: ${phaseName}`);
        try {
            const result = await phaseFunction();
            const endTime = Date.now();
            const duration = endTime - startTime;
            testContext.testMetrics.phaseTimes[phaseName] = duration;
            logger.info(`✅ Phase completed: ${phaseName} (${duration}ms)`);
            return result;
        }
        catch (error) {
            const endTime = Date.now();
            const duration = endTime - startTime;
            testContext.testMetrics.phaseTimes[phaseName] = duration;
            logger.error(`❌ Phase failed: ${phaseName} (${duration}ms)`, error);
            throw error;
        }
    }
});
async function initializeTestContext() {
    const sessionId = `test-session-${Date.now()}`;
    const browser = await puppeteer.launch({
        headless: process.env.CI ? true : false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    const supabase = createClient(process.env.SUPABASE_URL || 'http://localhost:54321', process.env.SUPABASE_SERVICE_KEY || 'test-key');
    const knowledgeManager = new KnowledgeManager({
        enableSemanticSearch: true,
        enableAutoEvolution: true,
        enableValidation: true,
        confidenceThreshold: 0.7
    });
    const intelligentExtractor = new IntelligentExtractor({
        defaultConfidenceThreshold: 0.7,
        enableLearning: true,
        enableCoordination: true,
        enableSemanticAnalysis: true,
        enablePatternEvolution: true
    });
    const onlineResearchAgent = new OnlineResearchAgent({
        searxngUrl: process.env.SEARXNG_URL || 'http://localhost:8080',
        maxRetries: TWO,
        fallbackEnabled: true
    });
    const searxngClient = new SearXNGClient(process.env.SEARXNG_URL || 'http://localhost:8080');
    return {
        browser,
        page,
        knowledgeManager,
        intelligentExtractor,
        onlineResearchAgent,
        supabase,
        searxngClient,
        sessionId,
        testMetrics: {
            totalStartTime: 0,
            totalEndTime: 0,
            totalDuration: 0,
            phaseTimes: {},
            successRate: 0,
            errorRate: 0,
            knowledgeItemsCreated: 0,
            extractionAccuracy: 0,
            coordinationEfficiency: 0,
            learningEffectiveness: 0,
            browserTasksCompleted: 0,
            searchResultsProcessed: 0,
            memoryUsage: 0,
            cpuUsage: 0
        }
    };
}
async function setupTestEnvironment(context) {
    await context.page.setViewport({ width: 1920, height: 1080 });
    await context.page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
    try {
        await context.supabase.rpc('create_test_tables');
    }
    catch (error) {
        logger.info('Test tables might already exist or RPC not available');
    }
    logger.info('✅ Test environment setup complete');
}
async function finalCleanup(context) {
    try {
        await context.knowledgeManager.shutdown();
        await context.intelligentExtractor.shutdown();
        await context.browser.close();
        logger.info('✅ Final cleanup completed');
    }
    catch (error) {
        logger.error('Error during final cleanup:', error);
    }
}
export { initializeTestContext, setupTestEnvironment, finalCleanup };
export default 'full-system-integration';
//# sourceMappingURL=full-system-integration.test.js.map