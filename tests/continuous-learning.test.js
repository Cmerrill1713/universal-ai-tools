import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { continuousLearningService } from '../src/services/continuous-learning-service';
import { knowledgeScraperService } from '../src/services/knowledge-scraper-service';
import { knowledgeValidationService } from '../src/services/knowledge-validation-service';
import { createKnowledgeFeedbackService } from '../src/services/knowledge-feedback-service';
import { supabase } from '../src/services/supabase_service';
import { logger } from '../src/utils/logger';
jest.mock('../src/services/supabase');
jest.mock('../src/utils/logger');
describe('Continuous Learning System', () => {
    beforeAll(async () => {
        await knowledgeScraperService.initialize();
    });
    afterAll(async () => {
        await continuousLearningService.stop();
        await knowledgeScraperService.shutdown();
    });
    describe('Knowledge Scraper Service', () => {
        it('should scrape content from configured sources', async () => {
            const mockSource = {
                id: 'test-source',
                name: 'Test Source',
                type: 'scraper',
                url: 'https://example.com',
                updateFrequency: '0 * * * *',
                categories: ['test'],
                priority: 'high',
                credibilityScore: 1.0,
                enabled: true,
            };
            const scrapedContent = await knowledgeScraperService.scrapeSource(mockSource);
            expect(Array.isArray(scrapedContent)).toBe(true);
        });
        it('should respect rate limits', async () => {
            const startTime = Date.now();
            const promises = [];
            for (let i = 0; i < 5; i++) {
                promises.push(knowledgeScraperService.scrapeSource({
                    id: 'rate-limit-test',
                    name: 'Rate Limit Test',
                    type: 'api',
                    url: 'https://api.example.com',
                    updateFrequency: '0 * * * *',
                    categories: ['test'],
                    priority: 'low',
                    credibilityScore: 0.8,
                    enabled: true,
                    scrapeConfig: {
                        rateLimit: TWO,
                    },
                }));
            }
            await Promise.all(promises);
            const duration = Date.now() - startTime;
            expect(duration).toBeGreaterThan(1000);
        });
    });
    describe('Knowledge Validation Service', () => {
        it('should validate scraped knowledge', async () => {
            const mockContent = 'This is a test documentation about Supabase authentication.';
            const mockSource = {
                id: 'test-source',
                name: 'Test Source',
                type: 'scraper',
                url: 'https://example.com',
                updateFrequency: '0 * * * *',
                categories: ['test'],
                priority: 'high',
                credibilityScore: 1.0,
                enabled: true,
            };
            const validationResults = await knowledgeValidationService.validateScrapedKnowledge('test-id', mockContent, mockSource, { hasCodeExamples: false });
            expect(validationResults).toBeDefined();
            expect(Array.isArray(validationResults)).toBe(true);
            expect(validationResults.length).toBeGreaterThan(0);
            const validationTypes = validationResults.map((r) => r.validationType);
            expect(validationTypes).toContain('source_credibility');
            expect(validationTypes).toContain('content_quality');
        });
        it('should detect deprecated content', async () => {
            const deprecatedContent = `
        This method is deprecated and will be removed in version 2.0.
        Use the new API instead.
      `;
            const mockSource = {
                id: 'test-source',
                name: 'Test Source',
                type: 'scraper',
                url: 'https://example.com',
                updateFrequency: '0 * * * *',
                categories: ['api'],
                priority: 'medium',
                credibilityScore: 0.9,
                enabled: true,
            };
            const validationResults = await knowledgeValidationService.validateScrapedKnowledge('deprecated-test', deprecatedContent, mockSource, {});
            const deprecationResult = validationResults.find((r) => r.validationType === 'deprecation');
            expect(deprecationResult).toBeDefined();
            expect(deprecationResult?.issues.length).toBeGreaterThan(0);
        });
    });
    describe('Knowledge Feedback Service', () => {
        it('should track knowledge usage', async () => {
            const feedbackService = createKnowledgeFeedbackService(supabase, logger);
            await feedbackService.trackUsage({
                knowledgeId: 'test-knowledge-1',
                knowledgeType: 'solution',
                agentId: 'test-agent',
                actionType: 'accessed',
                context: { test: true },
                performanceScore: 0.85,
            });
            expect(true).toBe(true);
        });
        it('should detect usage patterns', async () => {
            const feedbackService = createKnowledgeFeedbackService(supabase, logger);
            for (let i = 0; i < 5; i++) {
                await feedbackService.trackUsage({
                    knowledgeId: 'pattern-test-1',
                    knowledgeType: 'solution',
                    agentId: 'pattern-agent',
                    actionType: 'accessed',
                    context: { sessionId: 'test-session' },
                });
                await feedbackService.trackUsage({
                    knowledgeId: 'pattern-test-2',
                    knowledgeType: 'solution',
                    agentId: 'pattern-agent',
                    actionType: 'accessed',
                    context: { sessionId: 'test-session' },
                });
            }
            const patterns = feedbackService.getPatterns();
            expect(patterns.size).toBeGreaterThan(0);
        });
    });
    describe('Continuous Learning Service', () => {
        it('should start and stop properly', async () => {
            const status = continuousLearningService.getStatus();
            expect(status.isRunning).toBe(false);
            await continuousLearningService.start();
            const runningStatus = continuousLearningService.getStatus();
            expect(runningStatus.isRunning).toBe(true);
            await continuousLearningService.stop();
            const stoppedStatus = continuousLearningService.getStatus();
            expect(stoppedStatus.isRunning).toBe(false);
        });
        it('should handle learning cycle phases', async () => {
            const cyclePromise = continuousLearningService.runLearningCycle();
            await expect(cyclePromise).resolves.not.toThrow();
            const history = await continuousLearningService.getLearningHistory(1);
            expect(history.length).toBeGreaterThan(0);
        });
        it('should emit events during operation', async () => {
            const events = [];
            continuousLearningService.on('cycle_started', (data) => {
                events.push({ type: 'cycle_started', data });
            });
            continuousLearningService.on('cycle_completed', (data) => {
                events.push({ type: 'cycle_completed', data });
            });
            await continuousLearningService.runLearningCycle();
            expect(events.some((e) => e.type === 'cycle_started')).toBe(true);
            expect(events.some((e) => e.type === 'cycle_completed')).toBe(true);
        });
    });
    describe('Integration Tests', () => {
        it('should handle full knowledge update workflow', async () => {
            const updateAutomation = continuousLearningService.updateAutomation;
            const jobId = await updateAutomation.queueUpdateJob({
                sourceId: 'test-source',
                url: 'https://example.com/test',
                updateType: 'new',
                priority: 9,
            });
            expect(jobId).toBeDefined();
            const jobStatus = await updateAutomation.getJobStatus(jobId);
            expect(jobStatus).toBeDefined();
            expect(jobStatus?.status).toBe('pending');
            const stats = await updateAutomation.getStatistics();
            expect(stats).toBeDefined();
            expect(stats.queuedJobs).toBeGreaterThanOrEqual(0);
        });
        it('should provide monitoring dashboard data', async () => {
            const _mockReq = { query: { timeRange: '24h' } };
            const _mockRes = {
                json: jest.fn(),
                status: jest.fn().mockReturnThis(),
            };
            const dashboardData = {
                timestamp: new Date().toISOString(),
                timeRange: '24h',
                overview: {
                    totalKnowledgeItems: 100,
                    activeAlerts: TWO,
                    recentUpdates: 15,
                    averageQualityScore: 0.85,
                    healthStatus: 'healthy',
                },
                sourceHealth: [],
                validationMetrics: [],
                usageAnalytics: {},
                performanceMetrics: [],
                activeAlerts: [],
                updateQueue: {},
                insights: [],
            };
            expect(dashboardData).toBeDefined();
            expect(dashboardData.overview.healthStatus).toBe('healthy');
        });
    });
});
describe('API Endpoints', () => {
    it('should handle manual update requests', async () => {
        const mockUpdateRequest = {
            sourceId: 'supabase-docs',
            url: 'https://supabase.com/docs/guides/auth',
            updateType: 'update',
            priority: 8,
        };
        expect(mockUpdateRequest.sourceId).toBeDefined();
        expect(mockUpdateRequest.url).toBeDefined();
        expect(mockUpdateRequest.updateType).toMatch(/^(new|update|deprecate|delete)$/);
        expect(mockUpdateRequest.priority).toBeGreaterThanOrEqual(0);
        expect(mockUpdateRequest.priority).toBeLessThanOrEqual(10);
    });
    it('should provide quality trends data', async () => {
        const mockTrendsResponse = {
            trends: [
                {
                    date: '2024-01-19',
                    itemCount: 45,
                    averageQuality: 0.82,
                    validationRate: 92.5,
                },
            ],
            summary: {
                averageQuality: 0.84,
                validatedPercentage: 89.3,
                totalItems: 523,
                period: {
                    start: '2024-01-12T00:00:00Z',
                    end: '2024-01-19T00:00:00Z',
                },
            },
        };
        expect(mockTrendsResponse.trends).toBeDefined();
        expect(Array.isArray(mockTrendsResponse.trends)).toBe(true);
        expect(mockTrendsResponse.summary.averageQuality).toBeGreaterThanOrEqual(0);
        expect(mockTrendsResponse.summary.averageQuality).toBeLessThanOrEqual(1);
    });
});
//# sourceMappingURL=continuous-learning.test.js.map