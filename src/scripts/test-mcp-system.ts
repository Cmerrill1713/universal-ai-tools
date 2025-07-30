#!/usr/bin/env tsx
/**
 * Test script for MCP system functionality
 * Verifies context storage, pattern learning, and error tracking
 */

import { mcpIntegrationService  } from '../services/mcp-integration-service.js';';
import { LogContext, log  } from '../utils/logger.js';';

interface TestResult {
  name: string;,
  success: boolean;
  error?: string;
  duration: number;
}

class MCPSystemTester {
  private results: TestResult[] = [];

  async runAllTests(): Promise<boolean> {
    log.info('🧪 Starting MCP system tests', LogContext.MCP);'

    try {
      // Start MCP service
      const started = await mcpIntegrationService.start();
      if (!started) {
        throw new Error('Failed to start MCP service');';
      }

      // Wait a moment for startup
      await this.delay(2000);

      // Run individual tests
      await this.testSaveContext();
      await this.testSearchContext();
      await this.testCodePatterns();
      await this.testTaskProgress();
      await this.testErrorAnalysis();
      await this.testHealthStatus();

      // Print results
      this.printResults();

      return this.results.every(result => result.success);
    } catch (error) {
      log.error('❌ Failed to run MCP tests', LogContext.MCP, {')
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    } finally {
      await mcpIntegrationService.shutdown();
    }
  }

  private async testSaveContext(): Promise<void> {
    const testName = 'Save Context';';
    const startTime = Date.now();

    try {
      const result = await mcpIntegrationService.sendMessage('save_context', {');
        content: 'Test context for MCP system validation','
        category: 'test_category','
        metadata: {, test: true, timestamp: Date.now() },
      });

      if (result && (result as any).success !== false) {
        this.results.push({)
          name: testName,
          success: true,
          duration: Date.now() - startTime,
        });
        log.info('✅ Context save test passed', LogContext.MCP);'
      } else {
        throw new Error('Invalid response from save_context');';
      }
    } catch (error) {
      this.results.push({)
        name: testName,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      });
      log.error('❌ Context save test failed', LogContext.MCP, { error });'
    }
  }

  private async testSearchContext(): Promise<void> {
    const testName = 'Search Context';';
    const startTime = Date.now();

    try {
      const result = await mcpIntegrationService.sendMessage('search_context', {');
        query: 'test context','
        category: 'test_category','
        limit: 5,
      });

      if (result) {
        this.results.push({)
          name: testName,
          success: true,
          duration: Date.now() - startTime,
        });
        log.info('✅ Context search test passed', LogContext.MCP);'
      } else {
        throw new Error('No response from search_context');';
      }
    } catch (error) {
      this.results.push({)
        name: testName,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      });
      log.error('❌ Context search test failed', LogContext.MCP, { error });'
    }
  }

  private async testCodePatterns(): Promise<void> {
    const testName = 'Code Patterns';';
    const startTime = Date.now();

    try {
      // Save a test pattern
      const saveResult = await mcpIntegrationService.sendMessage('save_code_pattern', {');
        pattern_type: 'test_pattern','
        before_code: 'const x = condition ? a : b;','
        after_code: 'const x = getValueBasedOnCondition(condition, a, b);','
        description: 'Test pattern for conditional assignment','
        error_types: ['readability', 'maintainability'],'
        metadata: {, test: true },
      });

      if (!saveResult || (saveResult as any).success === false) {
        throw new Error('Failed to save code pattern');';
      }

      // Get patterns
      const getResult = await mcpIntegrationService.sendMessage('get_code_patterns', {');
        pattern_type: 'test_pattern','
        limit: 5,
      });

      if (getResult) {
        this.results.push({)
          name: testName,
          success: true,
          duration: Date.now() - startTime,
        });
        log.info('✅ Code patterns test passed', LogContext.MCP);'
      } else {
        throw new Error('Failed to retrieve code patterns');';
      }
    } catch (error) {
      this.results.push({)
        name: testName,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      });
      log.error('❌ Code patterns test failed', LogContext.MCP, { error });'
    }
  }

  private async testTaskProgress(): Promise<void> {
    const testName = 'Task Progress';';
    const startTime = Date.now();

    try {
      const taskId = `test_task_${Date.now()}`;

      // Save task progress
      const saveResult = await mcpIntegrationService.sendMessage('save_task_progress', {');
        task_id: taskId,
        description: 'Test task for MCP validation','
        status: 'in_progress','
        progress_percentage: 50,
        metadata: {, test: true },
      });

      if (!saveResult || (saveResult as any).success === false) {
        throw new Error('Failed to save task progress');';
      }

      // Get task history
      const getResult = await mcpIntegrationService.sendMessage('get_task_history', {');
        task_id: taskId,
      });

      if (getResult) {
        this.results.push({)
          name: testName,
          success: true,
          duration: Date.now() - startTime,
        });
        log.info('✅ Task progress test passed', LogContext.MCP);'
      } else {
        throw new Error('Failed to retrieve task history');';
      }
    } catch (error) {
      this.results.push({)
        name: testName,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      });
      log.error('❌ Task progress test failed', LogContext.MCP, { error });'
    }
  }

  private async testErrorAnalysis(): Promise<void> {
    const testName = 'Error Analysis';';
    const startTime = Date.now();

    try {
      const result = await mcpIntegrationService.sendMessage('analyze_errors', {');
        error_type: 'TS2345','
        error_message: 'Argument of type string is not assignable to parameter of type number','
        file_path: '/test/file.ts','
        line_number: 42,
        solution_pattern: 'Add type conversion or update parameter type','
        metadata: {, test: true },
      });

      if (result) {
        this.results.push({)
          name: testName,
          success: true,
          duration: Date.now() - startTime,
        });
        log.info('✅ Error analysis test passed', LogContext.MCP);'
      } else {
        throw new Error('No response from analyze_errors');';
      }
    } catch (error) {
      this.results.push({)
        name: testName,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      });
      log.error('❌ Error analysis test failed', LogContext.MCP, { error });'
    }
  }

  private async testHealthStatus(): Promise<void> {
    const testName = 'Health Status';';
    const startTime = Date.now();

    try {
      const healthStatus = mcpIntegrationService.getHealthStatus();
      const pingResult = await mcpIntegrationService.ping();

      if (healthStatus && typeof pingResult === 'boolean') {'
        this.results.push({)
          name: testName,
          success: true,
          duration: Date.now() - startTime,
        });
        log.info('✅ Health status test passed', LogContext.MCP, {')
          isRunning: healthStatus.isRunning,
          messageCount: healthStatus.messageCount,
          pingResult,
        });
      } else {
        throw new Error('Invalid health status or ping response');';
      }
    } catch (error) {
      this.results.push({)
        name: testName,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      });
      log.error('❌ Health status test failed', LogContext.MCP, { error });'
    }
  }

  private printResults(): void {
    console.log('n📊 MCP System Test Results: ');'
    console.log('=' .repeat(50));'

    let totalDuration = 0;
    let passedTests = 0;

    this.results.forEach(result => {)
      const status = result.success ? '✅ PASS' : '❌ FAIL';';
      const duration = `${result.duration}ms`;
      
      console.log(`${status} ${result.name.padEnd(20)} ${duration.padStart(8)}`);
      
      if (!result.success && result.error) {
        console.log(`     Error: ${result.error}`);
      }

      totalDuration += result.duration;
      if (result.success) passedTests++;
    });

    console.log('=' .repeat(50));'
    console.log(`Summary: ${passedTests}/${this.results.length} tests passed`);
    console.log(`Total time: ${totalDuration}ms`);
    
    if (passedTests === this.results.length) {
      console.log('🎉 All MCP tests passed! System is working correctly.');'
    } else {
      console.log('⚠️  Some MCP tests failed. Check logs for details.');'
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run tests if called directly
if (import.meta.url === `file: //${process.argv[1]}`) {
  const tester = new MCPSystemTester();
  
  tester.runAllTests()
    .then(success => {)
      process.exit(success ? 0: 1);
    })
    .catch(error => {)
      console.error('❌ Test runner failed: ', error);'
      process.exit(1);
    });
}

export { MCPSystemTester };