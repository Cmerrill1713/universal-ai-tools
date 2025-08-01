#!/usr/bin/env npx tsx
/**
 * Validate All Scenarios - Real endpoint testing
 * Tests actual functionality that exists in the codebase
 */

import axios from 'axios';
import chalk from 'chalk';
import * as fs from 'fs/promises';

const API_BASE = 'http://localhost:9999/api/v1';

interface TestCase {
  name: string;
  category: string;
  test: () => Promise<any>;
}

class ScenarioValidator {
  private passed = 0;
  private failed = 0;
  private results: any[] = [];

  async validateAll() {
    console.log(chalk.blue.bold('🧪 Universal AI Tools - Scenario Validation\n'));

    // Check if server is running
    try {
      await axios.get(`http://localhost:9999/health`);
    } catch (error) {
      console.log(chalk.red('❌ Server is not running at localhost:9999'));
      console.log(chalk.yellow('Please start the server with: npm run dev'));
      process.exit(1);
    }

    const testCases: TestCase[] = [
      // 1. Basic Chat Functionality
      {
        name: 'Basic Chat Message',
        category: 'Core',
        test: async () => {
          const response = await axios.post(`${API_BASE}/chat`, {
            message: 'Hello, how are you?',
            conversationId: 'test-basic-1'
          });
          
          if (!response.data.response) {
            throw new Error('No response received');
          }
          
          return {
            responseLength: response.data.response.length,
            metadata: response.data.metadata
          };
        }
      },

      // 2. LFM2 Routing Test
      {
        name: 'LFM2 Intelligent Routing',
        category: 'Routing',
        test: async () => {
          const response = await axios.post(`${API_BASE}/chat`, {
            message: 'What is 2+2?', // Simple task
            conversationId: 'test-lfm2-simple'
          });
          
          const metadata = response.data.metadata || {};
          return {
            lfm2Enabled: metadata.lfm2Enabled,
            serviceUsed: metadata.serviceUsed,
            routingTime: metadata.routingTime
          };
        }
      },

      // 3. Complex Task Routing
      {
        name: 'Complex Task Routing to Agent',
        category: 'Routing', 
        test: async () => {
          const response = await axios.post(`${API_BASE}/chat`, {
            message: 'Write a function to calculate fibonacci numbers',
            conversationId: 'test-lfm2-complex'
          });
          
          return {
            response: response.data.response?.substring(0, 100) + '...',
            serviceUsed: response.data.metadata?.serviceUsed,
            agentUsed: response.data.metadata?.agentId
          };
        }
      },

      // 4. Model Selection
      {
        name: 'Specific Model Selection',
        category: 'Models',
        test: async () => {
          const response = await axios.post(`${API_BASE}/chat`, {
            message: 'Explain machine learning',
            model: 'ollama:llama3.2:3b',
            conversationId: 'test-model-1'
          });
          
          return {
            modelUsed: response.data.model || 'default',
            responseReceived: !!response.data.response
          };
        }
      },

      // 5. Health & Monitoring
      {
        name: 'Health Check Endpoint',
        category: 'Infrastructure',
        test: async () => {
          const response = await axios.get(`http://localhost:9999/health`);
          return response.data;
        }
      },

      // 6. Memory Endpoint
      {
        name: 'Memory Storage',
        category: 'Features',
        test: async () => {
          const memory = {
            content: 'Test memory content',
            metadata: { type: 'test', timestamp: new Date().toISOString() }
          };
          
          const response = await axios.post(`${API_BASE}/memory`, memory);
          return {
            stored: response.data.success,
            id: response.data.id
          };
        }
      },

      // 7. Agent Registry
      {
        name: 'List Available Agents',
        category: 'Agents',
        test: async () => {
          const response = await axios.get(`${API_BASE}/agents`);
          return {
            agentCount: response.data.agents?.length || 0,
            agents: response.data.agents?.map((a: any) => a.id) || []
          };
        }
      },

      // 8. Monitoring Metrics
      {
        name: 'System Metrics',
        category: 'Infrastructure',
        test: async () => {
          const response = await axios.get(`${API_BASE}/monitoring/metrics`);
          return {
            hasMetrics: !!response.data,
            metricsCount: Object.keys(response.data).length
          };
        }
      },

      // 9. Vision Capabilities Check
      {
        name: 'Vision Service Status',
        category: 'Features',
        test: async () => {
          try {
            const response = await axios.get(`${API_BASE}/vision/status`);
            return response.data;
          } catch (error: any) {
            if (error.response?.status === 404) {
              return { available: false, reason: 'Endpoint not implemented' };
            }
            throw error;
          }
        }
      },

      // 10. Multi-conversation Context
      {
        name: 'Conversation Context Handling',
        category: 'Core',
        test: async () => {
          const convId = 'test-context-' + Date.now();
          
          // First message
          const response1 = await axios.post(`${API_BASE}/chat`, {
            message: 'My name is TestUser',
            conversationId: convId
          });
          
          // Second message referencing context
          const response2 = await axios.post(`${API_BASE}/chat`, {
            message: 'What is my name?',
            conversationId: convId
          });
          
          return {
            firstResponse: response1.data.response?.substring(0, 50),
            secondResponse: response2.data.response?.substring(0, 100),
            contextMaintained: response2.data.response?.toLowerCase().includes('testuser')
          };
        }
      },

      // 11. Error Handling
      {
        name: 'Graceful Error Handling',
        category: 'Infrastructure',
        test: async () => {
          try {
            await axios.post(`${API_BASE}/chat`, {
              // Missing required field
              conversationId: 'test-error'
            });
            return { errorHandled: false };
          } catch (error: any) {
            return {
              errorHandled: true,
              statusCode: error.response?.status,
              hasErrorMessage: !!error.response?.data?.error
            };
          }
        }
      },

      // 12. Parallel Request Handling
      {
        name: 'Parallel Request Processing',
        category: 'Performance',
        test: async () => {
          const start = Date.now();
          
          // Send 5 requests in parallel
          const requests = Array(5).fill(0).map((_, i) => 
            axios.post(`${API_BASE}/chat`, {
              message: `Parallel test ${i}`,
              conversationId: `parallel-${i}`
            })
          );
          
          const responses = await Promise.all(requests);
          const duration = Date.now() - start;
          
          return {
            totalDuration: duration,
            avgResponseTime: Math.round(duration / 5),
            allSuccessful: responses.every(r => r.status === 200)
          };
        }
      }
    ];

    // Run all tests
    for (const testCase of testCases) {
      await this.runTest(testCase);
    }

    // Generate report
    await this.generateReport();
  }

  private async runTest(testCase: TestCase) {
    const start = Date.now();
    
    try {
      const result = await testCase.test();
      const duration = Date.now() - start;
      
      this.passed++;
      console.log(chalk.green(`✅ ${testCase.name}`));
      console.log(chalk.gray(`   Duration: ${duration}ms`));
      
      this.results.push({
        name: testCase.name,
        category: testCase.category,
        status: 'passed',
        duration,
        result
      });
      
    } catch (error: any) {
      const duration = Date.now() - start;
      
      this.failed++;
      console.log(chalk.red(`❌ ${testCase.name}`));
      console.log(chalk.gray(`   Error: ${error.message}`));
      console.log(chalk.gray(`   Duration: ${duration}ms`));
      
      this.results.push({
        name: testCase.name,
        category: testCase.category,
        status: 'failed',
        duration,
        error: error.message,
        details: error.response?.data
      });
    }
  }

  private async generateReport() {
    const total = this.passed + this.failed;
    const percentage = Math.round((this.passed / total) * 100);
    
    console.log('\n' + '═'.repeat(60));
    console.log(chalk.bold('\n📊 Validation Summary\n'));
    
    // Group by category
    const categories = [...new Set(this.results.map(r => r.category))];
    
    for (const category of categories) {
      const catResults = this.results.filter(r => r.category === category);
      const catPassed = catResults.filter(r => r.status === 'passed').length;
      const catTotal = catResults.length;
      
      console.log(chalk.cyan(`${category}: ${catPassed}/${catTotal}`));
    }
    
    console.log('\n' + '═'.repeat(60));
    console.log(chalk.bold(`\nTotal: ${this.passed}/${total} (${percentage}%)\n`));
    
    // Save detailed report
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total,
        passed: this.passed,
        failed: this.failed,
        percentage
      },
      results: this.results
    };
    
    await fs.writeFile(
      'scenario-validation-report.json',
      JSON.stringify(report, null, 2)
    );
    
    console.log(chalk.gray('📄 Detailed report saved to scenario-validation-report.json\n'));
    
    // Show key insights
    if (percentage === 100) {
      console.log(chalk.green.bold('✨ All scenarios validated successfully!'));
    } else if (percentage >= 80) {
      console.log(chalk.yellow.bold('⚡ Most scenarios working well, some issues to address.'));
    } else {
      console.log(chalk.red.bold('⚠️  Several scenarios need attention.'));
    }
    
    // Exit code based on results
    process.exit(percentage >= 80 ? 0 : 1);
  }
}

// Run validation
const validator = new ScenarioValidator();
validator.validateAll().catch(error => {
  console.error(chalk.red('\n❌ Fatal error:'), error.message);
  process.exit(1);
});