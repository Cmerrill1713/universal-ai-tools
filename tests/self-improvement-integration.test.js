import { IntegratedSelfImprovementSystem } from '../src/core/self-improvement/integrated-self-improvement-system';
import { PatternMiningSystem } from '../src/core/self-improvement/pattern-mining-system';
import { ReinforcementLearningSystem } from '../src/core/self-improvement/reinforcement-learning-system';
const mockSupabase = {
    from: () => ({
        select: () => ({ data: [], error: null }),
        insert: () => ({ data: null, error: null }),
        upsert: () => ({ data: null, error: null }),
        update: () => ({ data: null, error: null }),
        delete: () => ({ data: null, error: null }),
        eq: function () {
            return this;
        },
        order: function () {
            return this;
        },
        limit: function () {
            return this;
        },
    }),
};
describe('Self-Improvement System Integration', () => {
    let system;
    beforeAll(async () => {
        system = new IntegratedSelfImprovementSystem(mockSupabase, {
            enabledComponents: ['pattern-mining', 'reinforcement-learning'],
            orchestrationMode: 'adaptive',
            improvementThreshold: 0.1,
            coordinationInterval: MILLISECONDS_IN_SECOND,
            failureHandling: 'continue',
            resourceLimits: {
                maxConcurrentTasks: TWO,
                maxMemoryUsage: 512,
                maxCpuUsage: 50,
                maxDiskUsage: 1024,
            },
        });
        await new Promise((resolve) => setTimeout(resolve, 100));
    });
    afterAll(async () => {
        if (system) {
            await system.shutdown();
        }
    });
    test('should initialize system components', async () => {
        const components = await system.getComponentStatus();
        expect(components.length).toBeGreaterThan(0);
        const componentNames = components.map((c) => c.id);
        expect(componentNames).toContain('pattern-mining');
        expect(componentNames).toContain('reinforcement-learning');
    });
    test('should capture system snapshots', async () => {
        const snapshots = await system.getSystemSnapshots();
        expect(Array.isArray(snapshots)).toBe(true);
        if (snapshots.length > 0) {
            const snapshot = snapshots[0];
            expect(snapshot).toHaveProperty('timestamp');
            expect(snapshot).toHaveProperty('overallHealth');
            expect(snapshot).toHaveProperty('componentStates');
            expect(snapshot).toHaveProperty('performanceMetrics');
        }
    });
    test('should calculate system health', async () => {
        const health = await system.getSystemHealth();
        expect(typeof health).toBe('number');
        expect(health).toBeGreaterThanOrEqual(0);
        expect(health).toBeLessThanOrEqual(1);
    });
    test('should manage improvement plans', async () => {
        const plans = await system.getActiveImprovementPlans();
        expect(Array.isArray(plans)).toBe(true);
    });
    test('should handle component state changes', async () => {
        const components = await system.getComponentStatus();
        if (components.length > 0) {
            const componentId = components[0].id;
            await system.pauseComponent(componentId);
            const updatedComponents = await system.getComponentStatus();
            const pausedComponent = updatedComponents.find((c) => c.id === componentId);
            expect(pausedComponent?.status).toBe('paused');
            await system.resumeComponent(componentId);
            const resumedComponents = await system.getComponentStatus();
            const resumedComponent = resumedComponents.find((c) => c.id === componentId);
            expect(resumedComponent?.status).toBe('active');
        }
    });
    test('should force improvement execution', async () => {
        const objectives = ['improve-system-performance', 'reduce-resource-usage'];
        const plan = await system.forceImprovement(objectives);
        expect(plan).toHaveProperty('id');
        expect(plan).toHaveProperty('objectives');
        expect(plan.objectives).toEqual(objectives);
        expect(plan).toHaveProperty('phase');
    });
});
describe('Pattern Mining System', () => {
    let patternMining;
    beforeAll(() => {
        patternMining = new PatternMiningSystem(mockSupabase);
    });
    test('should mine behavioral patterns', async () => {
        const mockData = [
            { userId: 'user1', action: 'login', timestamp: new Date() },
            { userId: 'user1', action: 'view_dashboard', timestamp: new Date() },
            { userId: 'user1', action: 'logout', timestamp: new Date() },
        ];
        const patterns = await patternMining.minePatterns({
            type: 'behavioral',
            algorithm: 'apriori',
            data: mockData,
            parameters: { minSupport: 0.1, minConfidence: 0.5 },
        });
        expect(Array.isArray(patterns)).toBe(true);
    });
    test('should discover sequence patterns', async () => {
        const sequenceData = [
            { sequence: ['A', 'B', 'C'], support: 0.8 },
            { sequence: ['B', 'C', 'D'], support: 0.6 },
        ];
        const patterns = await patternMining.minePatterns({
            type: 'sequence',
            algorithm: 'prefixspan',
            data: sequenceData,
            parameters: { minSupport: 0.5 },
        });
        expect(Array.isArray(patterns)).toBe(true);
    });
    test('should detect anomalies', async () => {
        const anomalyData = Array.from({ length: 100 }, (_, i) => ({
            feature1: Math.random() * 10,
            feature2: Math.random() * 5,
            feature3: i % 10 === 0 ? 100 : Math.random() * TWO,
        }));
        const patterns = await patternMining.minePatterns({
            type: 'anomaly',
            algorithm: 'isolation_forest',
            data: anomalyData,
            parameters: { contamination: 0.1 },
        });
        expect(Array.isArray(patterns)).toBe(true);
    });
});
describe('Reinforcement Learning System', () => {
    let rlSystem;
    beforeAll(() => {
        rlSystem = new ReinforcementLearningSystem(mockSupabase);
    });
    test('should create RL environment', async () => {
        const environment = await rlSystem.createEnvironment({
            name: 'Test Environment',
            description: 'A simple test environment',
            stateSpace: {
                type: 'continuous',
                dimensions: TWO,
                bounds: [
                    { min: -1, max: 1 },
                    { min: -1, max: 1 },
                ],
            },
            actionSpace: {
                type: 'discrete',
                dimensions: 4,
                discreteActions: [
                    { id: '0', name: 'up' },
                    { id: '1', name: 'down' },
                    { id: '2', name: 'left' },
                    { id: '3', name: 'right' },
                ],
            },
            rewardFunction: {
                type: 'sparse',
                calculate: (state, action, nextState) => {
                    return Math.random() > 0.5 ? 1 : -0.1;
                },
            },
            terminationCondition: {
                maxSteps: 100,
                targetReward: 10,
            },
        });
        expect(environment).toHaveProperty('id');
        expect(environment.name).toBe('Test Environment');
        expect(environment.stateSpace.dimensions).toBe(2);
        expect(environment.actionSpace.discreteActions).toHaveLength(4);
    });
    test('should create RL agent', async () => {
        const environment = await rlSystem.createEnvironment({
            name: 'Agent Test Environment',
            description: 'Environment for testing agent creation',
            stateSpace: {
                type: 'continuous',
                dimensions: THREE,
                bounds: [
                    { min: 0, max: 1 },
                    { min: 0, max: 1 },
                    { min: 0, max: 1 },
                ],
            },
            actionSpace: {
                type: 'discrete',
                dimensions: TWO,
                discreteActions: [
                    { id: '0', name: 'action1' },
                    { id: '1', name: 'action2' },
                ],
            },
            rewardFunction: {
                type: 'dense',
                calculate: () => Math.random(),
            },
            terminationCondition: {
                maxSteps: 50,
            },
        });
        const agent = await rlSystem.createAgent({
            type: 'dqn',
            environmentId: environment.id,
            hyperparameters: {
                learningRate: 0.001,
                discountFactor: 0.99,
                epsilon: 0.1,
                batchSize: 32,
            },
        });
        expect(agent).toHaveProperty('id');
        expect(agent.type).toBe('dqn');
        expect(agent.environmentId).toBe(environment.id);
        expect(agent.performance.episodesCompleted).toBe(0);
        expect(agent.model).toBeDefined();
    });
    test('should get environments and agents', async () => {
        const environments = await rlSystem.getEnvironments();
        const agents = await rlSystem.getAgents();
        expect(Array.isArray(environments)).toBe(true);
        expect(Array.isArray(agents)).toBe(true);
    });
});
describe('System Performance', () => {
    test('should handle concurrent operations', async () => {
        const system = new IntegratedSelfImprovementSystem(mockSupabase, {
            enabledComponents: ['pattern-mining'],
            orchestrationMode: 'parallel',
            improvementThreshold: 0.1,
            coordinationInterval: 5000,
            failureHandling: 'continue',
            resourceLimits: {
                maxConcurrentTasks: 5,
                maxMemoryUsage: 1024,
                maxCpuUsage: 70,
                maxDiskUsage: 2048,
            },
        });
        const startTime = Date.now();
        const promises = [
            system.getSystemHealth(),
            system.getComponentStatus(),
            system.getActiveImprovementPlans(),
            system.getSystemSnapshots(5),
        ];
        const results = await Promise.all(promises);
        const endTime = Date.now();
        expect(results).toHaveLength(4);
        expect(endTime - startTime).toBeLessThan(5000);
        await system.shutdown();
    });
    test('should maintain performance under load', async () => {
        const patternMining = new PatternMiningSystem(mockSupabase);
        const startTime = Date.now();
        const testData = Array.from({ length: 1000 }, (_, i) => ({
            id: i,
            value: Math.random() * 100,
            category: ['A', 'B', 'C'][i % 3],
            timestamp: new Date(Date.now() + i * MILLISECONDS_IN_SECOND),
        }));
        const patterns = await patternMining.minePatterns({
            type: 'clustering',
            algorithm: 'kmeans',
            data: testData,
            parameters: { k: THREE, maxIterations: 100 },
        });
        const endTime = Date.now();
        expect(Array.isArray(patterns)).toBe(true);
        expect(endTime - startTime).toBeLessThan(10000);
    });
});
describe('Error Handling', () => {
    test('should handle component initialization failures gracefully', async () => {
        const faultySupabase = {
            from: () => {
                throw new Error('Database connection failed');
            },
        };
        const system = new IntegratedSelfImprovementSystem(faultySupabase, {
            enabledComponents: ['pattern-mining'],
            orchestrationMode: 'adaptive',
            improvementThreshold: 0.1,
            coordinationInterval: 5000,
            failureHandling: 'continue',
            resourceLimits: {
                maxConcurrentTasks: THREE,
                maxMemoryUsage: 512,
                maxCpuUsage: SECONDS_IN_MINUTE,
                maxDiskUsage: 1024,
            },
        });
        await new Promise((resolve) => setTimeout(resolve, 500));
        const health = await system.getSystemHealth();
        expect(typeof health).toBe('number');
        await system.shutdown();
    });
    test('should handle invalid improvement objectives', async () => {
        const system = new IntegratedSelfImprovementSystem(mockSupabase, {
            enabledComponents: [],
            orchestrationMode: 'adaptive',
            improvementThreshold: 0.1,
            coordinationInterval: 5000,
            failureHandling: 'continue',
            resourceLimits: {
                maxConcurrentTasks: 1,
                maxMemoryUsage: 256,
                maxCpuUsage: 30,
                maxDiskUsage: 512,
            },
        });
        const plan = await system.forceImprovement([]);
        expect(plan).toHaveProperty('id');
        expect(plan.objectives).toHaveLength(0);
        await system.shutdown();
    });
});
describe('Component Integration', () => {
    test('should demonstrate cross-component communication', (done) => {
        const system = new IntegratedSelfImprovementSystem(mockSupabase, {
            enabledComponents: ['pattern-mining', 'reinforcement-learning'],
            orchestrationMode: 'adaptive',
            improvementThreshold: 0.05,
            coordinationInterval: MILLISECONDS_IN_SECOND,
            failureHandling: 'continue',
            resourceLimits: {
                maxConcurrentTasks: TWO,
                maxMemoryUsage: 512,
                maxCpuUsage: 50,
                maxDiskUsage: 1024,
            },
        });
        let eventCount = 0;
        system.on('component-task-completed', () => {
            eventCount++;
        });
        system.on('improvement-detected', () => {
            eventCount++;
        });
        system.on('orchestration-cycle-completed', () => {
            eventCount++;
            if (eventCount >= 1) {
                system.shutdown().then(() => done());
            }
        });
        setTimeout(() => {
            if (eventCount === 0) {
                system.shutdown().then(() => done());
            }
        }, 3000);
    });
});
//# sourceMappingURL=self-improvement-integration.test.js.map