#!/usr/bin/env tsx

import { BrowserAgentPool } from '../coordination/agent-pool';
import { dspyService } from '../../services/dspy-service';
import { logger } from '../../utils/logger';

async function testDSPyCoordination() {
  logger.info('🧪 Testing DSPy Agent Coordination System');
  
  // Create a minimal agent pool for testing
  const agentPool = new BrowserAgentPool({
    maxConcurrentAgents: 5,
    headless: true,
    slowMo: 0
  });
  
  // Initialize agent pool
  await agentPool.initialize();
  logger.info(`✅ Agent pool initialized with ${agentPool.getPoolStats().totalAgents} agents`);
  
  // DSPy service is already initialized
  const dspyStatus = dspyService.getStatus();
  logger.info('✅ DSPy coordination service status:', dspyStatus);
  
  try {
    // Test DSPy coordinated group fix for a connection failure
    const problem = 'Connection refused: UI server not responding on port 5173';
    const context = {
      timestamp: Date.now(),
      environment: 'development',
      affectedServices: ['frontend', 'vite-dev-server'],
      errorDetails: {
        port: 5173,
        protocol: 'http',
        host: 'localhost'
      }
    };
    
    logger.info('🎯 Starting DSPy coordinated fix test...');
    
    // Test DSPy agent coordination
    const availableAgents = ['researcher', 'executor', 'validator', 'monitor'];
    const coordination = await dspyService.coordinateAgents(problem, availableAgents, context);
    
    logger.info(`✅ DSPy coordination completed`);
    logger.info(`📊 Coordination status: ${coordination.success ? 'SUCCESS' : 'FAILED'}`);
    logger.info(`🤖 Selected agents: ${coordination.selectedAgents}`);
    logger.info(`📋 Coordination plan: ${coordination.coordinationPlan}`);
    
    // Test DSPy orchestration with the problem
    const orchestrationRequest = {
      requestId: `test-${Date.now()}`,
      userRequest: `Fix the following issue: ${problem}`,
      userId: 'test-user',
      orchestrationMode: 'adaptive' as const,
      context,
      timestamp: new Date()
    };
    
    const orchestrationResult = await dspyService.orchestrate(orchestrationRequest);
    
    logger.info('🎯 DSPy Orchestration Results:');
    logger.info(`  - Success: ${orchestrationResult.success}`);
    logger.info(`  - Mode: ${orchestrationResult.mode}`);
    logger.info(`  - Confidence: ${orchestrationResult.confidence}`);
    logger.info(`  - Execution Time: ${orchestrationResult.executionTime}ms`);
    logger.info(`  - Participating Agents: ${orchestrationResult.participatingAgents}`);
    
    // Test knowledge extraction
    const knowledgeExtraction = await dspyService.extractKnowledge(
      `Problem: ${problem}. Solution approach: Check if Vite dev server is running, restart if needed, verify port availability.`,
      { domain: 'debugging', type: 'solution' }
    );
    
    logger.info('🧠 DSPy Knowledge Extraction:');
    logger.info(`  - Success: ${knowledgeExtraction.success}`);
    
  } catch (error) {
    logger.error('❌ DSPy coordination test failed:', error);
  }
  
  // Cleanup
  await agentPool.shutdown();
  
  logger.info('🏁 DSPy coordination test completed');
  process.exit(0);
}

// Run test
testDSPyCoordination().catch(error => {
  logger.error('❌ Test failed:', error);
  process.exit(1);
});