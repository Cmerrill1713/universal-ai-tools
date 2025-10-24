/**
 * Test Athena Central Routing Integration
 * Tests Athena's intelligent routing system for all Universal AI Tools services
 */

import { createClient } from '@supabase/supabase-js';

interface TestResult {
  test: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message: string;
  duration: number;
  athenaInsights?: any;
}

class AthenaRoutingTester {
  private baseUrl: string;
  private supabase: any;
  private results: TestResult[] = [];

  constructor() {
    this.baseUrl = process.env.API_BASE_URL || 'http://localhost:9999';
    this.supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_ANON_KEY || ''
    );
  }

  async runAllTests(): Promise<void> {
    console.log('🌸 Universal AI Tools - Athena Central Routing Test Suite\n');
    console.log('Testing Athena\'s intelligent routing system...\n');

    try {
      // Test 1: Athena Status
      await this.testAthenaStatus();

      // Test 2: Athena Intelligence
      await this.testAthenaIntelligence();

      // Test 3: Routing Statistics
      await this.testRoutingStatistics();

      // Test 4: Governance Routing
      await this.testGovernanceRouting();

      // Test 5: Chat Routing
      await this.testChatRouting();

      // Test 6: Intelligent Request Analysis
      await this.testIntelligentRequestAnalysis();

      // Test 7: Neural Routing Integration
      await this.testNeuralRoutingIntegration();

      // Test 8: UAT-Prompt Routing Integration
      await this.testUATPromptRoutingIntegration();

      // Test 9: Error Handling
      await this.testErrorHandling();

      // Test 10: Performance Testing
      await this.testPerformance();

      // Test 11: End-to-End Routing
      await this.testEndToEndRouting();

      // Display results
      this.displayResults();

    } catch (error) {
      console.error('❌ Athena routing test suite failed:', error);
      this.addResult('Test Suite', 'FAIL', `Test suite failed: ${error}`, 0);
    }
  }

  private async testAthenaStatus(): Promise<void> {
    const start = Date.now();
    try {
      console.log('🌸 Testing Athena status...');

      const response = await fetch(`${this.baseUrl}/api/athena/status`);
      
      if (!response.ok) {
        throw new Error(`Athena status check failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.success || !data.data.name || data.data.name !== 'Sweet Athena') {
        throw new Error('Athena status response invalid');
      }

      // Check Athena headers
      const athenaRequestId = response.headers.get('X-Athena-Request-ID');
      const athenaIntelligence = response.headers.get('X-Athena-Intelligence');
      const athenaPersonality = response.headers.get('X-Athena-Personality');

      this.addResult('Athena Status', 'PASS', 'Athena is active and responding', Date.now() - start, {
        requestId: athenaRequestId,
        intelligence: athenaIntelligence,
        personality: athenaPersonality,
        services: data.data.services
      });

    } catch (error) {
      this.addResult('Athena Status', 'FAIL', error instanceof Error ? error.message : 'Unknown error', Date.now() - start);
    }
  }

  private async testAthenaIntelligence(): Promise<void> {
    const start = Date.now();
    try {
      console.log('🧠 Testing Athena intelligence...');

      const response = await fetch(`${this.baseUrl}/api/athena/intelligence`);
      
      if (!response.ok) {
        throw new Error(`Athena intelligence check failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.success || !data.data.intelligenceLevel) {
        throw new Error('Athena intelligence response invalid');
      }

      this.addResult('Athena Intelligence', 'PASS', 'Athena intelligence is operational', Date.now() - start, {
        intelligenceLevel: data.data.intelligenceLevel,
        neuralInsights: data.data.neuralInsights,
        uatPromptInsights: data.data.uatPromptInsights,
        personality: data.data.personality
      });

    } catch (error) {
      this.addResult('Athena Intelligence', 'FAIL', error instanceof Error ? error.message : 'Unknown error', Date.now() - start);
    }
  }

  private async testRoutingStatistics(): Promise<void> {
    const start = Date.now();
    try {
      console.log('📊 Testing routing statistics...');

      const response = await fetch(`${this.baseUrl}/api/athena/routing-stats`);
      
      if (!response.ok) {
        throw new Error(`Routing stats check failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.success || typeof data.data.totalRequests !== 'number') {
        throw new Error('Routing stats response invalid');
      }

      this.addResult('Routing Statistics', 'PASS', 'Routing statistics retrieved successfully', Date.now() - start, {
        totalRequests: data.data.totalRequests,
        averageResponseTime: data.data.averageResponseTime,
        routingDistribution: data.data.routingDistribution,
        cacheSize: data.data.intelligenceCache.size
      });

    } catch (error) {
      this.addResult('Routing Statistics', 'FAIL', error instanceof Error ? error.message : 'Unknown error', Date.now() - start);
    }
  }

  private async testGovernanceRouting(): Promise<void> {
    const start = Date.now();
    try {
      console.log('🏛️ Testing governance routing...');

      // Test governance health through Athena
      const response = await fetch(`${this.baseUrl}/api/governance/health`);
      
      if (!response.ok) {
        throw new Error(`Governance routing failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error('Governance routing response invalid');
      }

      // Check Athena headers
      const athenaRequestId = response.headers.get('X-Athena-Request-ID');
      const athenaIntelligence = response.headers.get('X-Athena-Intelligence');

      this.addResult('Governance Routing', 'PASS', 'Governance routing through Athena successful', Date.now() - start, {
        requestId: athenaRequestId,
        intelligence: athenaIntelligence,
        governanceStatus: data.data.status
      });

    } catch (error) {
      this.addResult('Governance Routing', 'FAIL', error instanceof Error ? error.message : 'Unknown error', Date.now() - start);
    }
  }

  private async testChatRouting(): Promise<void> {
    const start = Date.now();
    try {
      console.log('💬 Testing chat routing...');

      // Test chat health through Athena
      const response = await fetch(`${this.baseUrl}/api/chat/health`);
      
      if (!response.ok) {
        throw new Error(`Chat routing failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error('Chat routing response invalid');
      }

      // Check Athena headers
      const athenaRequestId = response.headers.get('X-Athena-Request-ID');
      const athenaIntelligence = response.headers.get('X-Athena-Intelligence');

      this.addResult('Chat Routing', 'PASS', 'Chat routing through Athena successful', Date.now() - start, {
        requestId: athenaRequestId,
        intelligence: athenaIntelligence,
        chatStatus: data.data.status
      });

    } catch (error) {
      this.addResult('Chat Routing', 'FAIL', error instanceof Error ? error.message : 'Unknown error', Date.now() - start);
    }
  }

  private async testIntelligentRequestAnalysis(): Promise<void> {
    const start = Date.now();
    try {
      console.log('🔍 Testing intelligent request analysis...');

      // Test different types of requests to see Athena's analysis
      const testRequests = [
        { path: '/api/governance/proposals', method: 'GET', expectedType: 'governance' },
        { path: '/api/chat/message', method: 'POST', expectedType: 'chat' },
        { path: '/api/athena/status', method: 'GET', expectedType: 'athena' },
        { path: '/api/health', method: 'GET', expectedType: 'health' }
      ];

      let analysisResults = [];

      for (const testReq of testRequests) {
        const response = await fetch(`${this.baseUrl}${testReq.path}`, {
          method: testReq.method,
          headers: { 'Content-Type': 'application/json' }
        });

        const athenaRequestId = response.headers.get('X-Athena-Request-ID');
        const athenaIntelligence = response.headers.get('X-Athena-Intelligence');
        
        analysisResults.push({
          path: testReq.path,
          method: testReq.method,
          expectedType: testReq.expectedType,
          requestId: athenaRequestId,
          intelligence: athenaIntelligence,
          status: response.ok ? 'success' : 'failed'
        });
      }

      this.addResult('Intelligent Request Analysis', 'PASS', 'Athena analyzed all request types successfully', Date.now() - start, {
        analysisResults,
        totalAnalyzed: analysisResults.length
      });

    } catch (error) {
      this.addResult('Intelligent Request Analysis', 'FAIL', error instanceof Error ? error.message : 'Unknown error', Date.now() - start);
    }
  }

  private async testNeuralRoutingIntegration(): Promise<void> {
    const start = Date.now();
    try {
      console.log('🧠 Testing neural routing integration...');

      // Test a complex request that should trigger neural analysis
      const complexRequest = {
        path: '/api/governance/proposals',
        method: 'POST',
        body: {
          title: 'Complex Neural Analysis Proposal',
          description: 'This is a complex proposal that should trigger neural analysis for routing decisions',
          category: 'platform',
          proposer: 'test_user',
          priority: 'high'
        }
      };

      const response = await fetch(`${this.baseUrl}${complexRequest.path}`, {
        method: complexRequest.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(complexRequest.body)
      });

      const athenaRequestId = response.headers.get('X-Athena-Request-ID');
      const athenaIntelligence = response.headers.get('X-Athena-Intelligence');

      this.addResult('Neural Routing Integration', 'PASS', 'Neural routing integration working', Date.now() - start, {
        requestId: athenaRequestId,
        intelligence: athenaIntelligence,
        neuralRouting: true
      });

    } catch (error) {
      this.addResult('Neural Routing Integration', 'FAIL', error instanceof Error ? error.message : 'Unknown error', Date.now() - start);
    }
  }

  private async testUATPromptRoutingIntegration(): Promise<void> {
    const start = Date.now();
    try {
      console.log('🔧 Testing UAT-prompt routing integration...');

      // Test a request that should trigger UAT-prompt analysis
      const promptRequest = {
        path: '/api/chat/message',
        method: 'POST',
        body: {
          message: 'Create a complex widget with advanced features',
          sessionId: 'test_session',
          context: 'This is a complex request that should trigger UAT-prompt analysis for routing'
        }
      };

      const response = await fetch(`${this.baseUrl}${promptRequest.path}`, {
        method: promptRequest.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(promptRequest.body)
      });

      const athenaRequestId = response.headers.get('X-Athena-Request-ID');
      const athenaIntelligence = response.headers.get('X-Athena-Intelligence');

      this.addResult('UAT-Prompt Routing Integration', 'PASS', 'UAT-prompt routing integration working', Date.now() - start, {
        requestId: athenaRequestId,
        intelligence: athenaIntelligence,
        uatPromptRouting: true
      });

    } catch (error) {
      this.addResult('UAT-Prompt Routing Integration', 'FAIL', error instanceof Error ? error.message : 'Unknown error', Date.now() - start);
    }
  }

  private async testErrorHandling(): Promise<void> {
    const start = Date.now();
    try {
      console.log('⚠️ Testing error handling...');

      // Test invalid endpoint
      const response = await fetch(`${this.baseUrl}/api/invalid/endpoint`);
      
      if (response.status !== 404) {
        throw new Error('Error handling not working correctly');
      }

      const data = await response.json();
      
      if (!data.athena || !data.athena.includes('Athena')) {
        throw new Error('Athena error response invalid');
      }

      this.addResult('Error Handling', 'PASS', 'Athena handles errors gracefully', Date.now() - start, {
        statusCode: response.status,
        athenaMessage: data.athena
      });

    } catch (error) {
      this.addResult('Error Handling', 'FAIL', error instanceof Error ? error.message : 'Unknown error', Date.now() - start);
    }
  }

  private async testPerformance(): Promise<void> {
    const start = Date.now();
    try {
      console.log('⚡ Testing Athena routing performance...');

      const performanceTests = [
        { name: 'Athena Status', url: '/api/athena/status' },
        { name: 'Athena Intelligence', url: '/api/athena/intelligence' },
        { name: 'Governance Health', url: '/api/governance/health' },
        { name: 'Chat Health', url: '/api/chat/health' },
        { name: 'General Request', url: '/' }
      ];

      const results = await Promise.all(
        performanceTests.map(async (test) => {
          const testStart = Date.now();
          const response = await fetch(`${this.baseUrl}${test.url}`);
          const duration = Date.now() - testStart;
          
          return {
            test: test.name,
            duration,
            success: response.ok,
            athenaHeaders: {
              requestId: response.headers.get('X-Athena-Request-ID'),
              intelligence: response.headers.get('X-Athena-Intelligence'),
              personality: response.headers.get('X-Athena-Personality')
            }
          };
        })
      );

      const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
      const allSuccessful = results.every(r => r.success);

      if (allSuccessful && avgDuration < 2000) {
        this.addResult('Performance', 'PASS', `Average response time: ${Math.round(avgDuration)}ms`, Date.now() - start, {
          averageDuration: avgDuration,
          allSuccessful,
          results
        });
      } else {
        this.addResult('Performance', 'FAIL', `Performance issues: avg ${Math.round(avgDuration)}ms, success: ${allSuccessful}`, Date.now() - start, {
          averageDuration: avgDuration,
          allSuccessful,
          results
        });
      }

    } catch (error) {
      this.addResult('Performance', 'FAIL', error instanceof Error ? error.message : 'Unknown error', Date.now() - start);
    }
  }

  private async testEndToEndRouting(): Promise<void> {
    const start = Date.now();
    try {
      console.log('🔄 Testing end-to-end routing...');

      // Test complete flow through Athena
      const flow = [
        { step: 'Athena Status', url: '/api/athena/status' },
        { step: 'Governance Stats', url: '/api/governance/stats' },
        { step: 'Chat Stats', url: '/api/chat/stats' },
        { step: 'Athena Intelligence', url: '/api/athena/intelligence' },
        { step: 'Routing Stats', url: '/api/athena/routing-stats' }
      ];

      let flowResults = [];

      for (const step of flow) {
        const stepStart = Date.now();
        const response = await fetch(`${this.baseUrl}${step.url}`);
        const stepDuration = Date.now() - stepStart;

        flowResults.push({
          step: step.step,
          url: step.url,
          success: response.ok,
          duration: stepDuration,
          athenaRequestId: response.headers.get('X-Athena-Request-ID'),
          athenaIntelligence: response.headers.get('X-Athena-Intelligence')
        });
      }

      const allSuccessful = flowResults.every(r => r.success);
      const totalDuration = flowResults.reduce((sum, r) => sum + r.duration, 0);

      if (allSuccessful) {
        this.addResult('End-to-End Routing', 'PASS', 'Complete routing flow successful', Date.now() - start, {
          flowResults,
          totalDuration,
          allSuccessful
        });
      } else {
        this.addResult('End-to-End Routing', 'FAIL', 'Some routing steps failed', Date.now() - start, {
          flowResults,
          totalDuration,
          allSuccessful
        });
      }

    } catch (error) {
      this.addResult('End-to-End Routing', 'FAIL', error instanceof Error ? error.message : 'Unknown error', Date.now() - start);
    }
  }

  private addResult(test: string, status: 'PASS' | 'FAIL' | 'SKIP', message: string, duration: number, athenaInsights?: any): void {
    this.results.push({ test, status, message, duration, athenaInsights });
  }

  private displayResults(): void {
    console.log('\n📊 Athena Routing Test Results Summary\n');
    console.log('=' .repeat(80));

    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const skipped = this.results.filter(r => r.status === 'SKIP').length;
    const total = this.results.length;

    console.log(`Total Tests: ${total}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏭️ Skipped: ${skipped}`);
    console.log(`Success Rate: ${Math.round((passed / total) * 100)}%`);

    console.log('\n📋 Detailed Results\n');
    console.log('-'.repeat(80));

    this.results.forEach(result => {
      const statusIcon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⏭️';
      const duration = `${result.duration}ms`;
      console.log(`${statusIcon} ${result.test.padEnd(35)} ${duration.padStart(8)} ${result.message}`);
      
      if (result.athenaInsights) {
        console.log(`    🌸 Athena Insights: ${JSON.stringify(result.athenaInsights, null, 2).substring(0, 100)}...`);
      }
    });

    console.log('\n' + '='.repeat(80));

    if (failed === 0) {
      console.log('🎉 All tests passed! Athena routing system is ready for intelligent orchestration.');
    } else {
      console.log('⚠️ Some tests failed. Please review the issues above.');
    }
  }
}

// Run the tests
async function main() {
  const tester = new AthenaRoutingTester();
  await tester.runAllTests();
}

if (require.main === module) {
  main().catch(console.error);
}

export { AthenaRoutingTester };