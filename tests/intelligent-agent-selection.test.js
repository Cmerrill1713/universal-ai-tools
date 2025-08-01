import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { intelligentAgentSelector } from '../src/services/intelligent-agent-selector';
const mockDeviceContexts = {
    highBattery: {
        deviceId: 'test-iphone-15-pro',
        deviceName: 'iPhone 15 Pro',
        osVersion: 'iOS 17.2',
        batteryLevel: 85,
        isLowPowerMode: false,
        connectionType: 'wifi',
        authenticationState: 'authenticated',
        userId: 'test-user-123',
    },
    lowBattery: {
        deviceId: 'test-iphone-13',
        deviceName: 'iPhone 13',
        osVersion: 'iOS 17.1',
        batteryLevel: 15,
        isLowPowerMode: true,
        connectionType: 'cellular',
        authenticationState: 'authenticated',
        userId: 'test-user-456',
    },
    cellularConnection: {
        deviceId: 'test-iphone-se',
        deviceName: 'iPhone SE',
        osVersion: 'iOS 17.0',
        batteryLevel: 50,
        isLowPowerMode: false,
        connectionType: 'cellular',
        authenticationState: 'authenticated',
        userId: 'test-user-789',
    },
};
const testScenarios = [
    {
        name: 'Code Debugging Task',
        userInput: 'Help me debug this Swift code that\'s crashing when I try to load the image',
        expectedAgent: 'code_assistant',
        expectedComplexity: 'moderate',
        deviceContext: mockDeviceContexts.highBattery,
        expectedConfidence: 0.85,
    },
    {
        name: 'Simple Question',
        userInput: 'What\'s the weather like today?',
        expectedAgent: 'retriever',
        expectedComplexity: 'simple',
        deviceContext: mockDeviceContexts.highBattery,
        expectedConfidence: 0.9,
    },
    {
        name: 'Complex Analysis Task',
        userInput: 'Analyze the market trends for AI companies and provide detailed insights with investment recommendations',
        expectedAgent: 'synthesizer',
        expectedComplexity: 'complex',
        deviceContext: mockDeviceContexts.highBattery,
        expectedConfidence: 0.8,
    },
    {
        name: 'Planning Task',
        userInput: 'Plan my vacation itinerary for a 7-day trip to Tokyo including budget optimization',
        expectedAgent: 'planner',
        expectedComplexity: 'complex',
        deviceContext: mockDeviceContexts.highBattery,
        expectedConfidence: 0.9,
    },
    {
        name: 'Personal Assistant Task',
        userInput: 'Remind me to call mom tomorrow and help me organize my schedule',
        expectedAgent: 'personal_assistant',
        expectedComplexity: 'moderate',
        deviceContext: mockDeviceContexts.highBattery,
        expectedConfidence: 0.85,
    },
    {
        name: 'Low Battery Override',
        userInput: 'Create a comprehensive business plan for a new startup',
        expectedAgent: 'personal_assistant',
        expectedComplexity: 'simple',
        deviceContext: mockDeviceContexts.lowBattery,
        expectedConfidence: 0.9,
    },
];
describe('Intelligent Agent Selection System', () => {
    beforeEach(() => {
        intelligentAgentSelector.reset();
    });
    afterEach(() => {
        intelligentAgentSelector.reset();
    });
    describe('Core Agent Selection Logic', () => {
        test.each(testScenarios)('should correctly select agent for: $name', async (scenario) => {
            const recommendation = await intelligentAgentSelector.selectAgent({
                userInput: scenario.userInput,
                deviceContext: scenario.deviceContext,
                conversationHistory: [],
                urgency: 'medium',
            });
            expect(recommendation.primaryAgent).toBe(scenario.expectedAgent);
            expect(recommendation.confidence).toBeGreaterThanOrEqual(0.6);
            expect(recommendation.confidence).toBeLessThanOrEqual(1.0);
            expect(recommendation.processingComplexity).toBe(scenario.expectedComplexity);
            expect(recommendation.optimizedForDevice).toBe(true);
            expect(recommendation.fallbackAgents).toHaveLength(1);
            expect(recommendation.fallbackAgents[0]).not.toBe(recommendation.primaryAgent);
            expect(recommendation.reasoning).toBeTruthy();
            expect(typeof recommendation.reasoning).toBe('string');
            console.log(`✅ ${scenario.name}: Selected ${recommendation.primaryAgent} with ${(recommendation.confidence * 100).toFixed(1)}% confidence`);
        });
    });
    describe('Device Context Optimization', () => {
        test('should optimize for low battery conditions', async () => {
            const recommendation = await intelligentAgentSelector.selectAgent({
                userInput: 'Perform complex data analysis on this large dataset',
                deviceContext: mockDeviceContexts.lowBattery,
            });
            expect(recommendation.primaryAgent).toBe('personal_assistant');
            expect(recommendation.batteryImpact).toBe('low');
            expect(recommendation.reasoning).toContain('battery');
        });
        test('should optimize for cellular connection', async () => {
            const recommendation = await intelligentAgentSelector.selectAgent({
                userInput: 'Generate a detailed report with charts and graphs',
                deviceContext: mockDeviceContexts.cellularConnection,
            });
            expect(['low', 'medium']).toContain(recommendation.networkImpact);
            expect(recommendation.estimatedResponseTime).toBeLessThan(15000);
        });
        test('should handle offline scenarios gracefully', async () => {
            const offlineContext = {
                ...mockDeviceContexts.highBattery,
                connectionType: 'offline',
            };
            const recommendation = await intelligentAgentSelector.selectAgent({
                userInput: 'Help me with basic calculations',
                deviceContext: offlineContext,
            });
            expect(recommendation.primaryAgent).toBeTruthy();
            expect(recommendation.optimizedForDevice).toBe(true);
        });
    });
    describe('Conversation Context Awareness', () => {
        test('should use conversation history for context', async () => {
            const conversationHistory = [
                {
                    text: 'I\'m working on a Swift iOS app',
                    isFromUser: true,
                    timestamp: new Date(),
                },
                {
                    text: 'I can help you with iOS development!',
                    isFromUser: false,
                    agentName: 'code_assistant',
                    timestamp: new Date(),
                },
            ];
            const recommendation = await intelligentAgentSelector.selectAgent({
                userInput: 'Now I need help with the user interface',
                deviceContext: mockDeviceContexts.highBattery,
                conversationHistory,
            });
            expect(recommendation.primaryAgent).toBe('code_assistant');
        });
        test('should handle conversation context switches', async () => {
            const conversationHistory = [
                {
                    text: 'Help me debug this code',
                    isFromUser: true,
                    timestamp: new Date(),
                },
                {
                    text: 'Now I need to plan my project timeline',
                    isFromUser: true,
                    timestamp: new Date(),
                },
            ];
            const recommendation = await intelligentAgentSelector.selectAgent({
                userInput: 'Create a development roadmap with milestones',
                deviceContext: mockDeviceContexts.highBattery,
                conversationHistory,
            });
            expect(recommendation.primaryAgent).toBe('planner');
        });
    });
    describe('Performance Learning', () => {
        test('should update performance metrics', () => {
            const agentName = 'code_assistant';
            const initialMetrics = intelligentAgentSelector.getPerformanceMetrics();
            intelligentAgentSelector.updatePerformanceMetrics(agentName, true, 3000, 0.9, 0.8);
            const updatedMetrics = intelligentAgentSelector.getPerformanceMetrics();
            expect(updatedMetrics[agentName]).toBeDefined();
            expect(updatedMetrics[agentName].successRate).toBeGreaterThanOrEqual(initialMetrics[agentName].successRate);
        });
        test('should learn from failures', () => {
            const agentName = 'synthesizer';
            intelligentAgentSelector.updatePerformanceMetrics(agentName, false, 10000, 0.3, 0.2);
            const metrics = intelligentAgentSelector.getPerformanceMetrics();
            expect(metrics[agentName].successRate).toBeLessThan(0.9);
        });
    });
    describe('Edge Cases and Error Handling', () => {
        test('should handle empty user input gracefully', async () => {
            const recommendation = await intelligentAgentSelector.selectAgent({
                userInput: '',
                deviceContext: mockDeviceContexts.highBattery,
            });
            expect(recommendation.primaryAgent).toBe('personal_assistant');
            expect(recommendation.confidence).toBeLessThan(0.8);
        });
        test('should handle missing device context', async () => {
            const recommendation = await intelligentAgentSelector.selectAgent({
                userInput: 'Help me with something',
            });
            expect(recommendation.primaryAgent).toBeTruthy();
            expect(recommendation.optimizedForDevice).toBe(true);
        });
        test('should handle very long user input', async () => {
            const longInput = 'A'.repeat(10000);
            const recommendation = await intelligentAgentSelector.selectAgent({
                userInput: longInput,
                deviceContext: mockDeviceContexts.highBattery,
            });
            expect(recommendation.primaryAgent).toBeTruthy();
            expect(recommendation.processingComplexity).toBe('complex');
        });
        test('should provide reasonable fallback agents', async () => {
            const recommendation = await intelligentAgentSelector.selectAgent({
                userInput: 'Help with complex undefined task',
                deviceContext: mockDeviceContexts.highBattery,
            });
            expect(recommendation.fallbackAgents).toHaveLength(1);
            expect(recommendation.fallbackAgents[0]).not.toBe(recommendation.primaryAgent);
            expect(recommendation.fallbackAgents).toContain('personal_assistant');
        });
    });
});
describe('Mobile Orchestration API Integration', () => {
    describe('Agent Selection Endpoint', () => {
        test('should provide intelligent agent selection API', async () => {
            const testRequest = {
                userInput: 'Help me debug this Swift code',
                deviceContext: mockDeviceContexts.highBattery,
                conversationHistory: [],
            };
            const recommendation = await intelligentAgentSelector.selectAgent(testRequest);
            expect(recommendation).toHaveProperty('primaryAgent');
            expect(recommendation).toHaveProperty('confidence');
            expect(recommendation).toHaveProperty('reasoning');
            expect(recommendation).toHaveProperty('fallbackAgents');
            expect(recommendation).toHaveProperty('estimatedResponseTime');
            expect(recommendation).toHaveProperty('batteryImpact');
            expect(recommendation).toHaveProperty('networkImpact');
            expect(recommendation).toHaveProperty('processingComplexity');
            expect(recommendation).toHaveProperty('optimizedForDevice');
        });
    });
    describe('Smart Chat Integration', () => {
        test('should simulate complete smart chat flow', async () => {
            const startTime = Date.now();
            const recommendation = await intelligentAgentSelector.selectAgent({
                userInput: 'Explain how iOS memory management works',
                deviceContext: mockDeviceContexts.highBattery,
            });
            const selectionTime = Date.now() - startTime;
            expect(selectionTime).toBeLessThan(1000);
            expect(recommendation.primaryAgent).toBe('code_assistant');
            intelligentAgentSelector.updatePerformanceMetrics(recommendation.primaryAgent, true, 3000, 0.9, 0.8);
            const metrics = intelligentAgentSelector.getPerformanceMetrics();
            expect(metrics[recommendation.primaryAgent].successRate).toBeGreaterThan(0.8);
        });
    });
});
describe('Performance and Scalability', () => {
    test('should handle concurrent requests efficiently', async () => {
        const concurrentRequests = Array.from({ length: 10 }, (_, i) => intelligentAgentSelector.selectAgent({
            userInput: `Test request ${i + 1}`,
            deviceContext: mockDeviceContexts.highBattery,
        }));
        const startTime = Date.now();
        const results = await Promise.all(concurrentRequests);
        const totalTime = Date.now() - startTime;
        expect(results).toHaveLength(10);
        results.forEach(result => {
            expect(result.primaryAgent).toBeTruthy();
            expect(result.confidence).toBeGreaterThan(0);
        });
        expect(totalTime).toBeLessThan(5000);
        console.log(`✅ Handled 10 concurrent requests in ${totalTime}ms`);
    });
    test('should maintain performance under load', async () => {
        const iterations = 50;
        const times = [];
        for (let i = 0; i < iterations; i++) {
            const start = Date.now();
            await intelligentAgentSelector.selectAgent({
                userInput: `Load test iteration ${i + 1}`,
                deviceContext: mockDeviceContexts.highBattery,
            });
            times.push(Date.now() - start);
        }
        const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
        const maxTime = Math.max(...times);
        expect(averageTime).toBeLessThan(100);
        expect(maxTime).toBeLessThan(500);
        console.log(`✅ Average selection time: ${averageTime.toFixed(1)}ms, Max: ${maxTime}ms`);
    });
});
describe('Performance Benchmarks', () => {
    const benchmarkScenarios = [
        { type: 'simple', input: 'What time is it?', targetTime: 50 },
        { type: 'moderate', input: 'Help me plan my work schedule', targetTime: 100 },
        { type: 'complex', input: 'Analyze this complex business problem and provide recommendations', targetTime: 200 },
    ];
    test.each(benchmarkScenarios)('should meet performance targets for $type tasks', async (scenario) => {
        const iterations = 10;
        const times = [];
        for (let i = 0; i < iterations; i++) {
            const start = Date.now();
            await intelligentAgentSelector.selectAgent({
                userInput: scenario.input,
                deviceContext: mockDeviceContexts.highBattery,
            });
            times.push(Date.now() - start);
        }
        const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
        expect(averageTime).toBeLessThan(scenario.targetTime);
        console.log(`✅ ${scenario.type} task average time: ${averageTime.toFixed(1)}ms (target: <${scenario.targetTime}ms)`);
    });
});
console.log('\n🧪 Intelligent Agent Selection Test Suite');
console.log('🎯 Testing cloud-first architecture with automatic agent selection');
console.log('📱 All heavy processing happens on the server, not the mobile device');
console.log('🤖 Users never need to manually select agents - Athena chooses intelligently\n');
//# sourceMappingURL=intelligent-agent-selection.test.js.map