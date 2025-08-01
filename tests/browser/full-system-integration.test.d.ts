import { KnowledgeManager } from '../../src/core/knowledge/knowledge-manager';
import { IntelligentExtractor } from '../../src/core/knowledge/intelligent-extractor';
import { OnlineResearchAgent } from '../../src/core/knowledge/online-research-agent';
import { SearXNGClient } from '../../src/core/knowledge/searxng-client';
import { createClient } from '@supabase/supabase-js';
import { Browser, Page } from 'puppeteer';
interface TestMetrics {
    totalStartTime: number;
    totalEndTime: number;
    totalDuration: number;
    phaseTimes: Record<string, number>;
    successRate: number;
    errorRate: number;
    knowledgeItemsCreated: number;
    extractionAccuracy: number;
    coordinationEfficiency: number;
    learningEffectiveness: number;
    browserTasksCompleted: number;
    searchResultsProcessed: number;
    memoryUsage: number;
    cpuUsage: number;
}
interface TestContext {
    browser: Browser;
    page: Page;
    knowledgeManager: KnowledgeManager;
    intelligentExtractor: IntelligentExtractor;
    onlineResearchAgent: OnlineResearchAgent;
    supabase: ReturnType<typeof createClient>;
    searxngClient: SearXNGClient;
    sessionId: string;
    testMetrics: TestMetrics;
}
declare function initializeTestContext(): Promise<TestContext>;
declare function setupTestEnvironment(context: TestContext): Promise<void>;
declare function finalCleanup(context: TestContext): Promise<void>;
export { TestContext, TestMetrics, initializeTestContext, setupTestEnvironment, finalCleanup };
declare const _default: "full-system-integration";
export default _default;
//# sourceMappingURL=full-system-integration.test.d.ts.map