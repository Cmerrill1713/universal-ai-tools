/**
 * Test Real AI Integration
 * Tests MLX and Ollama integration with Universal AI Tools
 */

import { createClient } from '@supabase/supabase-js';

interface TestResult {
  test: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  message: string;
  duration: number;
  details?: any;
}

class RealAIIntegrationTester {
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
    console.log('🤖 Universal AI Tools - Real AI Integration Test Suite\n');
    console.log('Testing MLX and Ollama integration...\n');

    try {
      // Test 1: Service Health Checks
      await this.testServiceHealth();

      // Test 2: Ollama Integration
      await this.testOllamaIntegration();

      // Test 3: MLX Integration
      await this.testMLXIntegration();

      // Test 4: Chat Service with Real AI
      await this.testChatServiceWithRealAI();

      // Test 5: Neuroforge with MLX
      await this.testNeuroforgeWithMLX();

      // Test 6: End-to-End AI Pipeline
      await this.testEndToEndAIPipeline();

      // Test 7: Performance Testing
      await this.testAIPerformance();

      // Test 8: Error Handling
      await this.testAIErrorHandling();

      // Display results
      this.displayResults();

    } catch (error) {
      console.error('❌ Real AI integration test failed:', error);
      this.addResult('Test Suite', 'FAIL', `Test suite failed: ${error}`, 0);
    }
  }

  private async testServiceHealth(): Promise<void> {
    const start = Date.now();
    try {
      console.log('🏥 Testing service health...');

      // Test Athena health
      const athenaResponse = await fetch(`${this.baseUrl}/api/athena/status`);
      if (!athenaResponse.ok) {
        throw new Error('Athena service not responding');
      }

      // Test chat health
      const chatResponse = await fetch(`${this.baseUrl}/api/chat/health`);
      if (!chatResponse.ok) {
        throw new Error('Chat service not responding');
      }

      this.addResult('Service Health', 'PASS', 'All services are healthy', Date.now() - start, {
        athena: athenaResponse.status,
        chat: chatResponse.status
      });

    } catch (error) {
      this.addResult('Service Health', 'FAIL', error instanceof Error ? error.message : 'Unknown error', Date.now() - start);
    }
  }

  private async testOllamaIntegration(): Promise<void> {
    const start = Date.now();
    try {
      console.log('🦙 Testing Ollama integration...');

      // Test Ollama service directly
      const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
      const ollamaResponse = await fetch(`${ollamaUrl}/api/tags`);
      
      if (!ollamaResponse.ok) {
        throw new Error('Ollama service not available');
      }

      const ollamaData = await ollamaResponse.json();
      const models = ollamaData.models || [];

      // Test chat through our service
      const chatResponse = await fetch(`${this.baseUrl}/api/chat/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'test_user',
          sessionId: 'test_session',
          message: 'Hello, this is a test message for Ollama integration.'
        })
      });

      if (!chatResponse.ok) {
        throw new Error('Chat with Ollama failed');
      }

      const chatData = await chatResponse.json();

      this.addResult('Ollama Integration', 'PASS', 'Ollama integration working', Date.now() - start, {
        ollamaModels: models.length,
        chatResponse: chatData.success,
        responseLength: chatData.data?.content?.length || 0
      });

    } catch (error) {
      this.addResult('Ollama Integration', 'FAIL', error instanceof Error ? error.message : 'Unknown error', Date.now() - start);
    }
  }

  private async testMLXIntegration(): Promise<void> {
    const start = Date.now();
    try {
      console.log('🧠 Testing MLX integration...');

      // Test MLX through chat service (which uses Neuroforge)
      const chatResponse = await fetch(`${this.baseUrl}/api/chat/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'test_user',
          sessionId: 'test_session',
          message: 'Analyze this text for sentiment and complexity: "I love working with AI and machine learning technologies!"'
        })
      });

      if (!chatResponse.ok) {
        throw new Error('MLX integration test failed');
      }

      const chatData = await chatResponse.json();
      const hasNeuralInsights = chatData.data?.metadata?.neuroforge?.neuralInsights;

      if (hasNeuralInsights) {
        this.addResult('MLX Integration', 'PASS', 'MLX integration working through Neuroforge', Date.now() - start, {
          hasNeuralInsights: true,
          sentiment: hasNeuralInsights.sentiment,
          complexity: hasNeuralInsights.complexity,
          mlxProcessing: hasNeuralInsights.mlxProcessing
        });
      } else {
        this.addResult('MLX Integration', 'WARN', 'MLX integration responding but no neural insights', Date.now() - start, {
          hasNeuralInsights: false,
          response: chatData.data?.content
        });
      }

    } catch (error) {
      this.addResult('MLX Integration', 'FAIL', error instanceof Error ? error.message : 'Unknown error', Date.now() - start);
    }
  }

  private async testChatServiceWithRealAI(): Promise<void> {
    const start = Date.now();
    try {
      console.log('💬 Testing chat service with real AI...');

      const testMessages = [
        'Hello, can you help me understand machine learning?',
        'What are the benefits of using neural networks?',
        'Can you explain the difference between supervised and unsupervised learning?',
        'How can I improve my AI model performance?'
      ];

      let successfulResponses = 0;
      const responses = [];

      for (const message of testMessages) {
        const response = await fetch(`${this.baseUrl}/api/chat/message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: 'test_user',
            sessionId: 'test_session',
            message: message
          })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data?.content) {
            successfulResponses++;
            responses.push({
              message: message.substring(0, 50) + '...',
              responseLength: data.data.content.length,
              hasMetadata: !!data.data.metadata
            });
          }
        }
      }

      const successRate = (successfulResponses / testMessages.length) * 100;

      if (successRate >= 80) {
        this.addResult('Chat Service with Real AI', 'PASS', `Chat service working with ${successRate}% success rate`, Date.now() - start, {
          successRate,
          totalMessages: testMessages.length,
          successfulResponses,
          responses: responses.slice(0, 3) // Show first 3 responses
        });
      } else {
        this.addResult('Chat Service with Real AI', 'WARN', `Chat service working but with low success rate: ${successRate}%`, Date.now() - start, {
          successRate,
          totalMessages: testMessages.length,
          successfulResponses
        });
      }

    } catch (error) {
      this.addResult('Chat Service with Real AI', 'FAIL', error instanceof Error ? error.message : 'Unknown error', Date.now() - start);
    }
  }

  private async testNeuroforgeWithMLX(): Promise<void> {
    const start = Date.now();
    try {
      console.log('🧠 Testing Neuroforge with MLX...');

      // Test complex analysis through chat
      const response = await fetch(`${this.baseUrl}/api/chat/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'test_user',
          sessionId: 'test_session',
          message: 'I need help with a complex machine learning problem involving neural networks, data preprocessing, and model optimization. Can you provide detailed guidance?'
        })
      });

      if (!response.ok) {
        throw new Error('Neuroforge test failed');
      }

      const data = await response.json();
      const neuroforgeData = data.data?.metadata?.neuroforge;

      if (neuroforgeData) {
        const insights = neuroforgeData.neuralInsights;
        this.addResult('Neuroforge with MLX', 'PASS', 'Neuroforge with MLX working', Date.now() - start, {
          sentiment: insights.sentiment,
          intent: insights.intent,
          complexity: insights.complexity,
          confidence: insights.confidence,
          topics: insights.topics,
          mlxProcessing: insights.mlxProcessing,
          processingTime: insights.processingTime
        });
      } else {
        this.addResult('Neuroforge with MLX', 'WARN', 'Neuroforge responding but no detailed insights', Date.now() - start, {
          hasNeuroforgeData: false,
          response: data.data?.content?.substring(0, 100)
        });
      }

    } catch (error) {
      this.addResult('Neuroforge with MLX', 'FAIL', error instanceof Error ? error.message : 'Unknown error', Date.now() - start);
    }
  }

  private async testEndToEndAIPipeline(): Promise<void> {
    const start = Date.now();
    try {
      console.log('🔄 Testing end-to-end AI pipeline...');

      // Test complete pipeline: UAT-Prompt -> Neuroforge -> Ollama -> Response
      const response = await fetch(`${this.baseUrl}/api/chat/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'test_user',
          sessionId: 'test_session',
          message: 'Create a comprehensive guide for building an AI-powered application using modern technologies like MLX, Ollama, and neural networks. Include best practices, code examples, and implementation strategies.'
        })
      });

      if (!response.ok) {
        throw new Error('End-to-end pipeline test failed');
      }

      const data = await response.json();
      const hasUATPrompt = !!data.data?.metadata?.uatPrompt;
      const hasNeuroforge = !!data.data?.metadata?.neuroforge;
      const hasResponse = !!data.data?.content;

      if (hasUATPrompt && hasNeuroforge && hasResponse) {
        this.addResult('End-to-End AI Pipeline', 'PASS', 'Complete AI pipeline working', Date.now() - start, {
          uatPrompt: hasUATPrompt,
          neuroforge: hasNeuroforge,
          response: hasResponse,
          responseLength: data.data.content.length,
          processingTime: data.data.metadata?.neuroforge?.neuralInsights?.processingTime || 0
        });
      } else {
        this.addResult('End-to-End AI Pipeline', 'WARN', 'Pipeline working but missing components', Date.now() - start, {
          uatPrompt: hasUATPrompt,
          neuroforge: hasNeuroforge,
          response: hasResponse
        });
      }

    } catch (error) {
      this.addResult('End-to-End AI Pipeline', 'FAIL', error instanceof Error ? error.message : 'Unknown error', Date.now() - start);
    }
  }

  private async testAIPerformance(): Promise<void> {
    const start = Date.now();
    try {
      console.log('⚡ Testing AI performance...');

      const performanceTests = [
        { name: 'Simple Query', message: 'Hello, how are you?' },
        { name: 'Complex Query', message: 'Explain quantum computing and its applications in AI' },
        { name: 'Technical Query', message: 'How do I implement a transformer neural network from scratch?' }
      ];

      const results = [];

      for (const test of performanceTests) {
        const testStart = Date.now();
        const response = await fetch(`${this.baseUrl}/api/chat/message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: 'test_user',
            sessionId: 'test_session',
            message: test.message
          })
        });
        const testDuration = Date.now() - testStart;

        results.push({
          name: test.name,
          duration: testDuration,
          success: response.ok,
          status: response.status
        });
      }

      const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
      const allSuccessful = results.every(r => r.success);

      if (allSuccessful && avgDuration < 10000) { // Less than 10 seconds
        this.addResult('AI Performance', 'PASS', `Average response time: ${Math.round(avgDuration)}ms`, Date.now() - start, {
          averageDuration: avgDuration,
          allSuccessful,
          results
        });
      } else {
        this.addResult('AI Performance', 'WARN', `Performance issues: avg ${Math.round(avgDuration)}ms, success: ${allSuccessful}`, Date.now() - start, {
          averageDuration: avgDuration,
          allSuccessful,
          results
        });
      }

    } catch (error) {
      this.addResult('AI Performance', 'FAIL', error instanceof Error ? error.message : 'Unknown error', Date.now() - start);
    }
  }

  private async testAIErrorHandling(): Promise<void> {
    const start = Date.now();
    try {
      console.log('⚠️ Testing AI error handling...');

      // Test with empty message
      const emptyResponse = await fetch(`${this.baseUrl}/api/chat/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'test_user',
          sessionId: 'test_session',
          message: ''
        })
      });

      // Test with very long message
      const longMessage = 'A'.repeat(10000);
      const longResponse = await fetch(`${this.baseUrl}/api/chat/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'test_user',
          sessionId: 'test_session',
          message: longMessage
        })
      });

      // Test with invalid JSON
      const invalidResponse = await fetch(`${this.baseUrl}/api/chat/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json'
      });

      const errorHandlingResults = {
        emptyMessage: emptyResponse.status,
        longMessage: longResponse.status,
        invalidJson: invalidResponse.status
      };

      // Check if errors are handled gracefully (not 500 errors)
      const hasGracefulErrors = Object.values(errorHandlingResults).every(status => 
        status === 400 || status === 200 // 400 for bad request, 200 for handled gracefully
      );

      if (hasGracefulErrors) {
        this.addResult('AI Error Handling', 'PASS', 'AI error handling working correctly', Date.now() - start, errorHandlingResults);
      } else {
        this.addResult('AI Error Handling', 'WARN', 'Some errors not handled gracefully', Date.now() - start, errorHandlingResults);
      }

    } catch (error) {
      this.addResult('AI Error Handling', 'FAIL', error instanceof Error ? error.message : 'Unknown error', Date.now() - start);
    }
  }

  private addResult(test: string, status: 'PASS' | 'FAIL' | 'SKIP', message: string, duration: number, details?: any): void {
    this.results.push({ test, status, message, duration, details });
  }

  private displayResults(): void {
    console.log('\n📊 Real AI Integration Test Results\n');
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
      console.log('🎉 Real AI integration is working! MLX and Ollama are successfully integrated.');
    } else if (failed === 0) {
      console.log('⚠️ Real AI integration is mostly working with some warnings. Review the details above.');
    } else {
      console.log('❌ Real AI integration has issues. Please fix the failed tests before proceeding.');
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
      console.log('   - Check that Ollama is running: ollama serve');
      console.log('   - Check that MLX dependencies are installed');
      console.log('   - Verify environment variables are set correctly');
    }
  }
}

// Run the tests
async function main() {
  const tester = new RealAIIntegrationTester();
  await tester.runAllTests();
}

if (require.main === module) {
  main().catch(console.error);
}

export { RealAIIntegrationTester };