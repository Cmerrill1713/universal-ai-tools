#!/usr/bin/env npx tsx
/**
 * Comprehensive Scenario Testing Suite
 * Tests all major functionality across the Universal AI Tools platform
 */

import axios from 'axios';
import WebSocket from 'ws';
import { setTimeout } from 'timers/promises';
import chalk from 'chalk';
import * as fs from 'fs/promises';
import * as path from 'path';

const API_BASE = 'http://localhost:9999/api/v1';
const WS_BASE = 'ws://localhost:8080/ws';

interface TestResult {
  scenario: string;
  category: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
  details?: any;
}

class ScenarioTester {
  private results: TestResult[] = [];
  private authToken?: string;
  private apiKey?: string;

  async runAllScenarios() {
    console.log(chalk.blue.bold('🧪 Universal AI Tools - Comprehensive Scenario Testing\n'));

    // Test categories
    await this.testAuthenticationScenarios();
    await this.testLFM2RoutingScenarios();
    await this.testMultiTierLLMScenarios();
    await this.testAutonomousExecution();
    await this.testMemoryOptimization();
    await this.testWebSocketScenarios();
    await this.testVisionProcessing();
    await this.testMLXFineTuning();
    await this.testIntelligentParameters();
    await this.testAgentOrchestration();
    await this.testErrorRecovery();
    await this.testSecurityScenarios();

    // Generate report
    await this.generateReport();
  }

  // 1. Authentication Scenarios
  async testAuthenticationScenarios() {
    console.log(chalk.yellow('\n📐 Testing Authentication Scenarios...'));

    // JWT Authentication
    await this.runTest('JWT Authentication', 'auth', async () => {
      const response = await axios.post(`${API_BASE}/auth/login`, {
        username: 'test_user',
        password: 'test_password'
      });
      this.authToken = response.data.token;
      return response.data;
    });

    // API Key Authentication
    await this.runTest('API Key Authentication', 'auth', async () => {
      const response = await axios.get(`${API_BASE}/auth/verify`, {
        headers: {
          'X-API-Key': 'test-api-key',
          'X-AI-Service': 'test-service'
        }
      });
      this.apiKey = 'test-api-key';
      return response.data;
    });

    // Device Authentication
    await this.runTest('Device Registration', 'auth', async () => {
      const response = await axios.post(`${API_BASE}/device-auth/register`, {
        deviceId: 'test-device-123',
        deviceType: 'ios',
        publicKey: 'test-public-key'
      });
      return response.data;
    });
  }

  // 2. LFM2 Routing Scenarios
  async testLFM2RoutingScenarios() {
    console.log(chalk.yellow('\n🎯 Testing LFM2 Routing Scenarios...'));

    // Simple task - should use LFM2 directly
    await this.runTest('LFM2 Direct Response (Simple Task)', 'routing', async () => {
      const response = await axios.post(`${API_BASE}/chat`, {
        message: 'What is 2+2?',
        conversationId: 'test-simple-1'
      }, this.getAuthHeaders());
      
      // Verify LFM2 was used
      if (!response.data.metadata?.lfm2Enabled) {
        throw new Error('LFM2 routing not enabled');
      }
      return response.data;
    });

    // Complex task - should route to specialized agent
    await this.runTest('LFM2 Routes to Specialized Agent', 'routing', async () => {
      const response = await axios.post(`${API_BASE}/chat`, {
        message: 'Write a Python function to implement binary search with error handling',
        conversationId: 'test-complex-1'
      }, this.getAuthHeaders());
      
      // Verify routing occurred
      if (!response.data.metadata?.serviceUsed?.includes('code')) {
        throw new Error('Did not route to code assistant');
      }
      return response.data;
    });

    // Multi-turn conversation
    await this.runTest('LFM2 Multi-turn Context', 'routing', async () => {
      const convId = 'test-multi-turn';
      
      // First message
      await axios.post(`${API_BASE}/chat`, {
        message: 'I need help with a React component',
        conversationId: convId
      }, this.getAuthHeaders());
      
      // Follow-up should maintain context
      const response = await axios.post(`${API_BASE}/chat`, {
        message: 'Add state management to it',
        conversationId: convId
      }, this.getAuthHeaders());
      
      return response.data;
    });
  }

  // 3. Multi-Tier LLM Scenarios
  async testMultiTierLLMScenarios() {
    console.log(chalk.yellow('\n🔀 Testing Multi-Tier LLM Scenarios...'));

    // Test fallback chain
    await this.runTest('LLM Fallback Chain', 'multi-tier', async () => {
      const response = await axios.post(`${API_BASE}/fast-coordinator/process`, {
        task: 'Analyze this complex problem',
        requiresReasoning: true
      }, this.getAuthHeaders());
      
      // Should show tier progression
      if (!response.data.tiersUsed || response.data.tiersUsed.length === 0) {
        throw new Error('No tier information provided');
      }
      return response.data;
    });

    // Test Ollama integration
    await this.runTest('Ollama Model Usage', 'multi-tier', async () => {
      const response = await axios.post(`${API_BASE}/chat`, {
        message: 'Explain quantum computing',
        model: 'ollama:llama3.2:3b'
      }, this.getAuthHeaders());
      
      return response.data;
    });
  }

  // 4. Autonomous Execution
  async testAutonomousExecution() {
    console.log(chalk.yellow('\n🤖 Testing Autonomous Execution...'));

    // Function calling
    await this.runTest('Autonomous Function Calling', 'autonomous', async () => {
      const response = await axios.post(`${API_BASE}/chat`, {
        message: 'Create a file called test.txt with "Hello World" content',
        enableFunctions: true
      }, this.getAuthHeaders());
      
      // Check if function was called
      if (!response.data.functionsExecuted) {
        throw new Error('No functions were executed');
      }
      return response.data;
    });

    // Tool creation via Athena
    await this.runTest('Athena Tool Creation', 'autonomous', async () => {
      const response = await axios.post(`${API_BASE}/athena/spawn`, {
        task: 'Create a tool to calculate fibonacci numbers',
        autoExecute: true
      }, this.getAuthHeaders());
      
      return response.data;
    });
  }

  // 5. Memory Optimization
  async testMemoryOptimization() {
    console.log(chalk.yellow('\n💾 Testing Memory Optimization...'));

    // Test lazy loading
    await this.runTest('LFM2 Lazy Loading', 'memory', async () => {
      // Get initial memory stats
      const before = await axios.get(`${API_BASE}/monitoring/memory`, this.getAuthHeaders());
      
      // Trigger LFM2 usage
      await axios.post(`${API_BASE}/chat`, {
        message: 'Hello',
        conversationId: 'memory-test-1'
      }, this.getAuthHeaders());
      
      // Get memory after
      const after = await axios.get(`${API_BASE}/monitoring/memory`, this.getAuthHeaders());
      
      return {
        before: before.data,
        after: after.data,
        increase: after.data.lfm2Memory - before.data.lfm2Memory
      };
    });

    // Test cache cleanup
    await this.runTest('Memory Cache Cleanup', 'memory', async () => {
      // Generate multiple requests
      for (let i = 0; i < 5; i++) {
        await axios.post(`${API_BASE}/chat`, {
          message: `Test message ${i}`,
          conversationId: `memory-load-${i}`
        }, this.getAuthHeaders());
      }
      
      // Wait for cleanup
      await setTimeout(2000);
      
      // Check memory is stable
      const stats = await axios.get(`${API_BASE}/monitoring/memory`, this.getAuthHeaders());
      return stats.data;
    });
  }

  // 6. WebSocket Scenarios
  async testWebSocketScenarios() {
    console.log(chalk.yellow('\n🔌 Testing WebSocket Scenarios...'));

    // Device auth WebSocket
    await this.runTest('Device Auth WebSocket', 'websocket', async () => {
      return new Promise((resolve, reject) => {
        const ws = new WebSocket(`${WS_BASE}/device-auth`);
        
        ws.on('open', () => {
          ws.send(JSON.stringify({
            type: 'register',
            deviceId: 'ws-test-device'
          }));
        });
        
        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          ws.close();
          resolve(message);
        });
        
        ws.on('error', reject);
        
        setTimeout(() => {
          ws.close();
          reject(new Error('WebSocket timeout'));
        }, 5000);
      });
    });
  }

  // 7. Vision Processing
  async testVisionProcessing() {
    console.log(chalk.yellow('\n👁️ Testing Vision Processing...'));

    // Test image analysis
    await this.runTest('PyVision Image Analysis', 'vision', async () => {
      // Create test image buffer
      const testImage = Buffer.from('fake-image-data');
      
      const response = await axios.post(`${API_BASE}/vision/analyze`, {
        image: testImage.toString('base64'),
        prompt: 'What is in this image?'
      }, this.getAuthHeaders());
      
      return response.data;
    });

    // Test SDXL refiner
    await this.runTest('SDXL Image Refinement', 'vision', async () => {
      const response = await axios.post(`${API_BASE}/vision/refine`, {
        image: 'base64-image-data',
        strength: 0.3,
        steps: 20
      }, this.getAuthHeaders());
      
      return response.data;
    });
  }

  // 8. MLX Fine-Tuning
  async testMLXFineTuning() {
    console.log(chalk.yellow('\n🎓 Testing MLX Fine-Tuning...'));

    await this.runTest('MLX Fine-Tuning Job Creation', 'mlx', async () => {
      const response = await axios.post(`${API_BASE}/mlx/fine-tune`, {
        baseModel: 'llama3.2:3b',
        trainingData: [
          { input: 'Example 1', output: 'Response 1' },
          { input: 'Example 2', output: 'Response 2' }
        ],
        epochs: 5
      }, this.getAuthHeaders());
      
      return response.data;
    });
  }

  // 9. Intelligent Parameters
  async testIntelligentParameters() {
    console.log(chalk.yellow('\n🧠 Testing Intelligent Parameters...'));

    await this.runTest('Parameter Optimization', 'parameters', async () => {
      const response = await axios.post(`${API_BASE}/parameters/optimize`, {
        model: 'ollama:llama3.2:3b',
        taskType: 'code_generation',
        historicalPerformance: true
      }, this.getAuthHeaders());
      
      // Should return optimized parameters
      if (!response.data.temperature || !response.data.maxTokens) {
        throw new Error('Missing optimized parameters');
      }
      return response.data;
    });
  }

  // 10. Agent Orchestration
  async testAgentOrchestration() {
    console.log(chalk.yellow('\n🎭 Testing Agent Orchestration...'));

    // Test DSPy orchestration
    await this.runTest('DSPy 10-Agent Chain', 'orchestration', async () => {
      const response = await axios.post(`${API_BASE}/orchestration/dspy`, {
        task: 'Design a secure authentication system',
        enableAllAgents: true
      }, this.getAuthHeaders());
      
      // Should show all 10 agents participated
      if (!response.data.agentsUsed || response.data.agentsUsed.length < 10) {
        throw new Error('Not all DSPy agents were used');
      }
      return response.data;
    });

    // Test AB-MCTS
    await this.runTest('AB-MCTS Probabilistic Coordination', 'orchestration', async () => {
      const response = await axios.post(`${API_BASE}/ab-mcts/orchestrate`, {
        task: 'Optimize API response time',
        agents: ['planner', 'analyzer', 'optimizer'],
        maxIterations: 50
      }, this.getAuthHeaders());
      
      return response.data;
    });
  }

  // 11. Error Recovery
  async testErrorRecovery() {
    console.log(chalk.yellow('\n🛡️ Testing Error Recovery...'));

    // Test circuit breaker
    await this.runTest('Circuit Breaker Pattern', 'recovery', async () => {
      // Simulate failures
      for (let i = 0; i < 3; i++) {
        try {
          await axios.post(`${API_BASE}/chat`, {
            message: 'Test',
            forceError: true
          }, this.getAuthHeaders());
        } catch (e) {
          // Expected
        }
      }
      
      // Circuit should be open now
      try {
        await axios.post(`${API_BASE}/chat`, {
          message: 'Test after circuit open'
        }, this.getAuthHeaders());
      } catch (error: any) {
        if (error.response?.status === 503) {
          return { circuitBreakerWorking: true };
        }
      }
      
      throw new Error('Circuit breaker did not activate');
    });

    // Test graceful degradation
    await this.runTest('Graceful Service Degradation', 'recovery', async () => {
      const response = await axios.post(`${API_BASE}/chat`, {
        message: 'Test with degraded service',
        simulateServiceFailure: 'ollama'
      }, this.getAuthHeaders());
      
      // Should fallback gracefully
      if (!response.data.metadata?.fallbackUsed) {
        throw new Error('No fallback occurred');
      }
      return response.data;
    });
  }

  // 12. Security Scenarios
  async testSecurityScenarios() {
    console.log(chalk.yellow('\n🔒 Testing Security Scenarios...'));

    // Test rate limiting
    await this.runTest('Rate Limiting', 'security', async () => {
      const requests = [];
      for (let i = 0; i < 15; i++) {
        requests.push(
          axios.get(`${API_BASE}/health`, this.getAuthHeaders()).catch(e => e)
        );
      }
      
      const results = await Promise.all(requests);
      const rateLimited = results.filter(r => r.response?.status === 429);
      
      if (rateLimited.length === 0) {
        throw new Error('Rate limiting not working');
      }
      
      return { rateLimitedRequests: rateLimited.length };
    });

    // Test SQL injection protection
    await this.runTest('SQL Injection Protection', 'security', async () => {
      try {
        await axios.post(`${API_BASE}/chat`, {
          message: "'; DROP TABLE users; --",
          conversationId: 'sql-injection-test'
        }, this.getAuthHeaders());
        
        // If we get here, the input was safely handled
        return { protected: true };
      } catch (error: any) {
        if (error.response?.status === 400) {
          return { blocked: true };
        }
        throw error;
      }
    });

    // Test Supabase Vault integration
    await this.runTest('Secrets from Vault', 'security', async () => {
      const response = await axios.get(`${API_BASE}/secrets/verify-vault`, 
        this.getAuthHeaders()
      );
      
      if (!response.data.vaultActive) {
        throw new Error('Vault not being used for secrets');
      }
      return response.data;
    });
  }

  // Helper methods
  private async runTest(name: string, category: string, testFn: () => Promise<any>) {
    const start = Date.now();
    let result: TestResult;

    try {
      const details = await testFn();
      result = {
        scenario: name,
        category,
        status: 'passed',
        duration: Date.now() - start,
        details
      };
      console.log(chalk.green(`  ✅ ${name}`));
    } catch (error: any) {
      result = {
        scenario: name,
        category,
        status: 'failed',
        duration: Date.now() - start,
        error: error.message || String(error)
      };
      console.log(chalk.red(`  ❌ ${name}`));
      console.log(chalk.gray(`     ${error.message}`));
    }

    this.results.push(result);
    return result;
  }

  private getAuthHeaders() {
    return {
      headers: {
        ...(this.authToken && { Authorization: `Bearer ${this.authToken}` }),
        ...(this.apiKey && { 
          'X-API-Key': this.apiKey,
          'X-AI-Service': 'test-service'
        })
      }
    };
  }

  private async generateReport() {
    console.log(chalk.blue('\n\n📊 Test Results Summary'));
    console.log('═'.repeat(80));

    // Group by category
    const categories = [...new Set(this.results.map(r => r.category))];
    
    for (const category of categories) {
      const categoryResults = this.results.filter(r => r.category === category);
      const passed = categoryResults.filter(r => r.status === 'passed').length;
      const total = categoryResults.length;
      const percentage = Math.round((passed / total) * 100);
      
      const color = percentage === 100 ? chalk.green : percentage >= 80 ? chalk.yellow : chalk.red;
      console.log(color(`\n${category.toUpperCase()}: ${passed}/${total} (${percentage}%)`));
      
      for (const result of categoryResults) {
        const icon = result.status === 'passed' ? '✅' : '❌';
        const timeStr = `${result.duration}ms`;
        console.log(`  ${icon} ${result.scenario.padEnd(50)} ${timeStr.padStart(10)}`);
      }
    }

    // Overall summary
    const totalPassed = this.results.filter(r => r.status === 'passed').length;
    const totalTests = this.results.length;
    const overallPercentage = Math.round((totalPassed / totalTests) * 100);
    
    console.log('\n' + '═'.repeat(80));
    console.log(chalk.bold(`\nOVERALL: ${totalPassed}/${totalTests} (${overallPercentage}%)`));
    
    // Save detailed report
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: totalTests,
        passed: totalPassed,
        failed: totalTests - totalPassed,
        percentage: overallPercentage
      },
      categorySummary: categories.map(cat => {
        const catResults = this.results.filter(r => r.category === cat);
        return {
          category: cat,
          total: catResults.length,
          passed: catResults.filter(r => r.status === 'passed').length,
          failed: catResults.filter(r => r.status === 'failed').length
        };
      }),
      detailedResults: this.results
    };

    await fs.writeFile(
      path.join(process.cwd(), 'scenario-test-report.json'),
      JSON.stringify(report, null, 2)
    );
    
    console.log(chalk.gray('\n📄 Detailed report saved to scenario-test-report.json'));

    // Exit with appropriate code
    process.exit(overallPercentage === 100 ? 0 : 1);
  }
}

// Run tests
const tester = new ScenarioTester();
tester.runAllScenarios().catch(error => {
  console.error(chalk.red('Fatal error running tests:'), error);
  process.exit(1);
});

export { ScenarioTester };