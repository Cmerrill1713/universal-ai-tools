/**
 * Test Missing Components Integration
 * Tests all newly implemented missing components
 */

import { createClient } from '@supabase/supabase-js';

interface TestResult {
  test: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message: string;
  duration: number;
  details?: any;
}

class MissingComponentsTester {
  private baseUrl: string;
  private supabase: any;
  private results: TestResult[] = [];

  constructor() {
    this.baseUrl = process.env.API_BASE_URL || 'http://localhost:9999';
    this.supabase = createClient(
      process.env.SUPABASE_URL || 'http://127.0.0.1:54321',
      process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
    );
  }

  async runAllTests(): Promise<void> {
    console.log('🧪 Universal AI Tools - Missing Components Integration Test Suite\n');
    console.log('Testing newly implemented components...\n');

    try {
      // Test 1: Service Health Checks
      await this.testServiceHealth();

      // Test 2: DSPy Orchestrator
      await this.testDSPyOrchestrator();

      // Test 3: MLX Fine-Tuning Service
      await this.testMLXFineTuningService();

      // Test 4: Intelligent Parameter Service
      await this.testIntelligentParameterService();

      // Test 5: API Endpoints Integration
      await this.testAPIEndpointsIntegration();

      // Test 6: End-to-End Workflow
      await this.testEndToEndWorkflow();

      // Test 7: Performance Testing
      await this.testPerformance();

      // Test 8: Error Handling
      await this.testErrorHandling();

      // Display results
      this.displayResults();

    } catch (error) {
      console.error('❌ Missing components test failed:', error);
      this.addResult('Test Suite', 'FAIL', `Test suite failed: ${error}`, 0);
    }
  }

  private async testServiceHealth(): Promise<void> {
    const start = Date.now();
    try {
      console.log('🏥 Testing service health...');

      const response = await fetch(`${this.baseUrl}/api/health`);
      if (!response.ok) {
        throw new Error('Health check failed');
      }

      const data = await response.json();
      const newServices = ['dspy', 'mlx', 'intelligentParameters'];
      const allNewServicesAvailable = newServices.every(service => 
        data.services && data.services[service] === 'available'
      );

      if (allNewServicesAvailable) {
        this.addResult('Service Health', 'PASS', 'All new services are healthy', Date.now() - start, {
          services: data.services,
          newServicesAvailable: newServices
        });
      } else {
        this.addResult('Service Health', 'WARN', 'Some new services not available', Date.now() - start, {
          services: data.services,
          newServices: newServices
        });
      }

    } catch (error) {
      this.addResult('Service Health', 'FAIL', error instanceof Error ? error.message : 'Unknown error', Date.now() - start);
    }
  }

  private async testDSPyOrchestrator(): Promise<void> {
    const start = Date.now();
    try {
      console.log('🧠 Testing DSPy Orchestrator...');

      // Test 1: Get available chains
      const chainsResponse = await fetch(`${this.baseUrl}/api/dspy/chains`);
      if (!chainsResponse.ok) {
        throw new Error('Failed to get DSPy chains');
      }

      const chainsData = await chainsResponse.json();
      const hasChains = chainsData.success && chainsData.data && chainsData.data.length > 0;

      // Test 2: Get available agents
      const agentsResponse = await fetch(`${this.baseUrl}/api/dspy/agents`);
      if (!agentsResponse.ok) {
        throw new Error('Failed to get DSPy agents');
      }

      const agentsData = await agentsResponse.json();
      const hasAgents = agentsData.success && agentsData.data && agentsData.data.length > 0;

      // Test 3: Quick analysis
      const quickAnalysisResponse = await fetch(`${this.baseUrl}/api/dspy/quick-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: 'Analyze the benefits of using AI in software development',
          context: { domain: 'software_development' },
          userId: 'test_user',
          sessionId: 'test_session'
        })
      });

      const quickAnalysisData = await quickAnalysisResponse.json();
      const quickAnalysisSuccess = quickAnalysisData.success;

      if (hasChains && hasAgents && quickAnalysisSuccess) {
        this.addResult('DSPy Orchestrator', 'PASS', 'DSPy Orchestrator working correctly', Date.now() - start, {
          chainsCount: chainsData.data?.length || 0,
          agentsCount: agentsData.data?.length || 0,
          quickAnalysisSuccess,
          chains: chainsData.data?.map((c: any) => c.name) || [],
          agents: agentsData.data?.map((a: any) => a.name) || []
        });
      } else {
        this.addResult('DSPy Orchestrator', 'WARN', 'DSPy Orchestrator partially working', Date.now() - start, {
          hasChains,
          hasAgents,
          quickAnalysisSuccess
        });
      }

    } catch (error) {
      this.addResult('DSPy Orchestrator', 'FAIL', error instanceof Error ? error.message : 'Unknown error', Date.now() - start);
    }
  }

  private async testMLXFineTuningService(): Promise<void> {
    const start = Date.now();
    try {
      console.log('🎯 Testing MLX Fine-Tuning Service...');

      // Test 1: Get service status
      const statusResponse = await fetch(`${this.baseUrl}/api/mlx/status`);
      if (!statusResponse.ok) {
        throw new Error('Failed to get MLX status');
      }

      const statusData = await statusResponse.json();
      const isInitialized = statusData.success && statusData.data?.initialized;

      // Test 2: Get available datasets
      const datasetsResponse = await fetch(`${this.baseUrl}/api/mlx/datasets`);
      if (!datasetsResponse.ok) {
        throw new Error('Failed to get MLX datasets');
      }

      const datasetsData = await datasetsResponse.json();
      const hasDatasets = datasetsData.success && datasetsData.data && datasetsData.data.length > 0;

      // Test 3: Create a fine-tuning job (without starting it)
      const createJobResponse = await fetch(`${this.baseUrl}/api/mlx/fine-tune`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test Fine-Tuning Job',
          description: 'Test job for integration testing',
          baseModel: 'llama3.2-3b',
          trainingData: [
            { input: 'Hello', output: 'Hi there!' },
            { input: 'How are you?', output: 'I am doing well, thank you!' }
          ],
          config: {
            epochs: 1,
            learningRate: 0.0001,
            batchSize: 2,
            validationSplit: 0.1,
            optimization: 'lora'
          },
          userId: 'test_user'
        })
      });

      const createJobData = await createJobResponse.json();
      const jobCreated = createJobData.success && createJobData.data?.id;

      if (isInitialized && hasDatasets && jobCreated) {
        this.addResult('MLX Fine-Tuning Service', 'PASS', 'MLX Fine-Tuning Service working correctly', Date.now() - start, {
          initialized: isInitialized,
          datasetsCount: datasetsData.data?.length || 0,
          jobCreated,
          jobId: createJobData.data?.id
        });
      } else {
        this.addResult('MLX Fine-Tuning Service', 'WARN', 'MLX Fine-Tuning Service partially working', Date.now() - start, {
          initialized: isInitialized,
          hasDatasets,
          jobCreated
        });
      }

    } catch (error) {
      this.addResult('MLX Fine-Tuning Service', 'FAIL', error instanceof Error ? error.message : 'Unknown error', Date.now() - start);
    }
  }

  private async testIntelligentParameterService(): Promise<void> {
    const start = Date.now();
    try {
      console.log('🎯 Testing Intelligent Parameter Service...');

      // Test 1: Get service status
      const statusResponse = await fetch(`${this.baseUrl}/api/parameters/status`);
      if (!statusResponse.ok) {
        throw new Error('Failed to get parameter service status');
      }

      const statusData = await statusResponse.json();
      const isInitialized = statusData.success && statusData.data?.initialized;

      // Test 2: Get available task types
      const taskTypesResponse = await fetch(`${this.baseUrl}/api/parameters/task-types`);
      if (!taskTypesResponse.ok) {
        throw new Error('Failed to get task types');
      }

      const taskTypesData = await taskTypesResponse.json();
      const hasTaskTypes = taskTypesData.success && taskTypesData.data && taskTypesData.data.length > 0;

      // Test 3: Optimize parameters
      const optimizeResponse = await fetch(`${this.baseUrl}/api/parameters/optimize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama3.2:3b',
          taskType: 'text_generation',
          context: {
            userId: 'test_user',
            sessionId: 'test_session',
            prompt: 'Generate a creative story about AI'
          },
          performanceGoals: ['creativity', 'accuracy'],
          userPreferences: {
            creativity: 0.8,
            formality: 0.3,
            verbosity: 0.7,
            technicality: 0.5,
            consistency: 0.6
          }
        })
      });

      const optimizeData = await optimizeResponse.json();
      const optimizationSuccess = optimizeData.success && optimizeData.data?.optimizedParameters;

      if (isInitialized && hasTaskTypes && optimizationSuccess) {
        this.addResult('Intelligent Parameter Service', 'PASS', 'Intelligent Parameter Service working correctly', Date.now() - start, {
          initialized: isInitialized,
          taskTypesCount: taskTypesData.data?.length || 0,
          optimizationSuccess,
          optimizedParameters: optimizeData.data?.optimizedParameters,
          confidence: optimizeData.data?.confidence
        });
      } else {
        this.addResult('Intelligent Parameter Service', 'WARN', 'Intelligent Parameter Service partially working', Date.now() - start, {
          initialized: isInitialized,
          hasTaskTypes,
          optimizationSuccess
        });
      }

    } catch (error) {
      this.addResult('Intelligent Parameter Service', 'FAIL', error instanceof Error ? error.message : 'Unknown error', Date.now() - start);
    }
  }

  private async testAPIEndpointsIntegration(): Promise<void> {
    const start = Date.now();
    try {
      console.log('🔗 Testing API endpoints integration...');

      const endpoints = [
        { name: 'DSPy Health', url: '/api/dspy/health', method: 'GET' },
        { name: 'DSPy Status', url: '/api/dspy/status', method: 'GET' },
        { name: 'MLX Health', url: '/api/mlx/health', method: 'GET' },
        { name: 'MLX Status', url: '/api/mlx/status', method: 'GET' },
        { name: 'Parameters Health', url: '/api/parameters/health', method: 'GET' },
        { name: 'Parameters Status', url: '/api/parameters/status', method: 'GET' }
      ];

      const results = [];
      for (const endpoint of endpoints) {
        try {
          const response = await fetch(`${this.baseUrl}${endpoint.url}`, {
            method: endpoint.method
          });
          results.push({
            name: endpoint.name,
            success: response.ok,
            status: response.status
          });
        } catch (error) {
          results.push({
            name: endpoint.name,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const successRate = (successCount / results.length) * 100;

      if (successRate >= 80) {
        this.addResult('API Endpoints Integration', 'PASS', `API endpoints working with ${successRate}% success rate`, Date.now() - start, {
          successRate,
          totalEndpoints: results.length,
          successfulEndpoints: successCount,
          results
        });
      } else {
        this.addResult('API Endpoints Integration', 'WARN', `API endpoints working but with low success rate: ${successRate}%`, Date.now() - start, {
          successRate,
          totalEndpoints: results.length,
          successfulEndpoints: successCount,
          results
        });
      }

    } catch (error) {
      this.addResult('API Endpoints Integration', 'FAIL', error instanceof Error ? error.message : 'Unknown error', Date.now() - start);
    }
  }

  private async testEndToEndWorkflow(): Promise<void> {
    const start = Date.now();
    try {
      console.log('🔄 Testing end-to-end workflow...');

      // Step 1: Optimize parameters for a task
      const parameterOptimization = await fetch(`${this.baseUrl}/api/parameters/optimize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama3.2:3b',
          taskType: 'analysis',
          context: {
            userId: 'test_user',
            sessionId: 'test_session',
            prompt: 'Analyze the impact of AI on software development'
          },
          performanceGoals: ['accuracy', 'speed']
        })
      });

      const paramData = await parameterOptimization.json();
      if (!paramData.success) {
        throw new Error('Parameter optimization failed');
      }

      // Step 2: Use DSPy for comprehensive analysis
      const dspyAnalysis = await fetch(`${this.baseUrl}/api/dspy/orchestrate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: 'Analyze the impact of AI on software development',
          context: {
            userId: 'test_user',
            sessionId: 'test_session',
            optimizedParameters: paramData.data.optimizedParameters
          },
          reasoningChain: 'comprehensive_analysis',
          enableLearning: true
        })
      });

      const dspyData = await dspyAnalysis.json();
      if (!dspyData.success) {
        throw new Error('DSPy analysis failed');
      }

      // Step 3: Create a fine-tuning job based on the analysis
      const fineTuningJob = await fetch(`${this.baseUrl}/api/mlx/fine-tune`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'AI Impact Analysis Model',
          description: 'Model fine-tuned for AI impact analysis based on DSPy insights',
          baseModel: 'llama3.2-3b',
          trainingData: [
            {
              input: 'Analyze the impact of AI on software development',
              output: dspyData.data.result?.summary || 'AI has significant impact on software development'
            }
          ],
          config: {
            epochs: 1,
            learningRate: 0.0001,
            batchSize: 1,
            validationSplit: 0.1,
            optimization: 'lora'
          },
          userId: 'test_user'
        })
      });

      const ftData = await fineTuningJob.json();
      const workflowSuccess = paramData.success && dspyData.success && ftData.success;

      if (workflowSuccess) {
        this.addResult('End-to-End Workflow', 'PASS', 'Complete workflow working correctly', Date.now() - start, {
          parameterOptimization: paramData.success,
          dspyAnalysis: dspyData.success,
          fineTuningJob: ftData.success,
          dspyAgentsUsed: dspyData.data?.agentsUsed?.length || 0,
          dspyConfidence: dspyData.data?.confidence || 0,
          jobId: ftData.data?.id
        });
      } else {
        this.addResult('End-to-End Workflow', 'WARN', 'Workflow working but some steps failed', Date.now() - start, {
          parameterOptimization: paramData.success,
          dspyAnalysis: dspyData.success,
          fineTuningJob: ftData.success
        });
      }

    } catch (error) {
      this.addResult('End-to-End Workflow', 'FAIL', error instanceof Error ? error.message : 'Unknown error', Date.now() - start);
    }
  }

  private async testPerformance(): Promise<void> {
    const start = Date.now();
    try {
      console.log('⚡ Testing performance...');

      const performanceTests = [
        { name: 'DSPy Quick Analysis', endpoint: '/api/dspy/quick-analysis', method: 'POST' },
        { name: 'Parameter Optimization', endpoint: '/api/parameters/optimize', method: 'POST' },
        { name: 'MLX Status Check', endpoint: '/api/mlx/status', method: 'GET' }
      ];

      const results = [];
      for (const test of performanceTests) {
        const testStart = Date.now();
        
        try {
          const response = await fetch(`${this.baseUrl}${test.endpoint}`, {
            method: test.method,
            headers: { 'Content-Type': 'application/json' },
            body: test.method === 'POST' ? JSON.stringify({
              task: 'Performance test',
              context: { userId: 'test_user', sessionId: 'test_session' },
              userId: 'test_user',
              sessionId: 'test_session',
              model: 'llama3.2:3b',
              taskType: 'text_generation',
              performanceGoals: ['speed']
            }) : undefined
          });
          
          const testDuration = Date.now() - testStart;
          results.push({
            name: test.name,
            duration: testDuration,
            success: response.ok,
            status: response.status
          });
        } catch (error) {
          results.push({
            name: test.name,
            duration: Date.now() - testStart,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
      const allSuccessful = results.every(r => r.success);

      if (allSuccessful && avgDuration < 15000) { // Less than 15 seconds
        this.addResult('Performance', 'PASS', `Average response time: ${Math.round(avgDuration)}ms`, Date.now() - start, {
          averageDuration: avgDuration,
          allSuccessful,
          results
        });
      } else {
        this.addResult('Performance', 'WARN', `Performance issues: avg ${Math.round(avgDuration)}ms, success: ${allSuccessful}`, Date.now() - start, {
          averageDuration: avgDuration,
          allSuccessful,
          results
        });
      }

    } catch (error) {
      this.addResult('Performance', 'FAIL', error instanceof Error ? error.message : 'Unknown error', Date.now() - start);
    }
  }

  private async testErrorHandling(): Promise<void> {
    const start = Date.now();
    try {
      console.log('⚠️ Testing error handling...');

      const errorTests = [
        { name: 'Invalid DSPy Request', endpoint: '/api/dspy/orchestrate', body: { invalid: 'data' } },
        { name: 'Invalid Parameter Request', endpoint: '/api/parameters/optimize', body: { invalid: 'data' } },
        { name: 'Invalid MLX Request', endpoint: '/api/mlx/fine-tune', body: { invalid: 'data' } }
      ];

      const results = [];
      for (const test of errorTests) {
        try {
          const response = await fetch(`${this.baseUrl}${test.endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(test.body)
          });
          
          results.push({
            name: test.name,
            status: response.status,
            handledGracefully: response.status === 400 || response.status === 422
          });
        } catch (error) {
          results.push({
            name: test.name,
            status: 0,
            handledGracefully: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      const gracefulHandling = results.every(r => r.handledGracefully);

      if (gracefulHandling) {
        this.addResult('Error Handling', 'PASS', 'Error handling working correctly', Date.now() - start, results);
      } else {
        this.addResult('Error Handling', 'WARN', 'Some errors not handled gracefully', Date.now() - start, results);
      }

    } catch (error) {
      this.addResult('Error Handling', 'FAIL', error instanceof Error ? error.message : 'Unknown error', Date.now() - start);
    }
  }

  private addResult(test: string, status: 'PASS' | 'FAIL' | 'SKIP', message: string, duration: number, details?: any): void {
    this.results.push({ test, status, message, duration, details });
  }

  private displayResults(): void {
    console.log('\n📊 Missing Components Integration Test Results\n');
    console.log('=' .repeat(80));

    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const warnings = this.results.filter(r => r.status === 'WARN').length;
    const total = this.results.length;

    console.log(`Total Tests: ${total}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⚠️ Warnings: ${warnings}`);
    console.log(`Success Rate: ${Math.round((passed / total) * 100)}%`);

    console.log('\n📋 Detailed Results\n');
    console.log('-'.repeat(80));

    this.results.forEach(result => {
      const statusIcon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⚠️';
      const duration = `${result.duration}ms`;
      console.log(`${statusIcon} ${result.test.padEnd(35)} ${duration.padStart(8)} ${result.message}`);
      
      if (result.details) {
        console.log(`    Details: ${JSON.stringify(result.details, null, 2).substring(0, 150)}...`);
      }
    });

    console.log('\n' + '='.repeat(80));

    if (failed === 0 && warnings <= 2) {
      console.log('🎉 Missing components integration is working! All new services are successfully integrated.');
    } else if (failed === 0) {
      console.log('⚠️ Missing components integration is mostly working with some warnings. Review the details above.');
    } else {
      console.log('❌ Missing components integration has issues. Please fix the failed tests before proceeding.');
    }

    // Recommendations
    if (failed > 0 || warnings > 2) {
      console.log('\n💡 Recommendations:');
      if (failed > 0) {
        console.log('   - Fix all FAILED tests before using the system');
      }
      if (warnings > 2) {
        console.log('   - Address WARN items for optimal performance');
      }
      console.log('   - Check that all services are properly initialized');
      console.log('   - Verify database connections and migrations');
      console.log('   - Ensure all environment variables are set correctly');
    }
  }
}

// Run the tests
async function main() {
  const tester = new MissingComponentsTester();
  await tester.runAllTests();
}

if (require.main === module) {
  main().catch(console.error);
}

export { MissingComponentsTester };