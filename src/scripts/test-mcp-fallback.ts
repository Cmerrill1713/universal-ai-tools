#!/usr/bin/env tsx
/**
 * Test MCP Fallback System
 * Tests the MCP integration without requiring full Supabase configuration
 */

import { mcpIntegrationService } from '../services/mcp-integration-service.js';
import { LogContext, log } from '../utils/logger.js';

interface TestResult {
  name: string;
  success: boolean;
  error?: string;
  duration: number;
}

class MCPFallbackTester {
  private results: TestResult[] = [];

  async runFallbackTests(): Promise<boolean> {
    log.info('🧪 Testing MCP fallback system (no Supabase connection required)', LogContext.MCP);

    try {
      // Test fallback operations without starting the MCP server
      await this.testFallbackMode();
      await this.testHealthStatus();
      await this.testErrorHandling();

      // Print results
      this.printResults();

      return this.results.every(result => result.success);
    } catch (error) {
      log.error('❌ Failed to run MCP fallback tests', LogContext.MCP, {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  private async testFallbackMode(): Promise<void> {
    const testName = 'Fallback Mode';
    const startTime = Date.now();

    try {
      // Test that fallback operations work when MCP server is not running
      log.info('📝 Testing fallback operations', LogContext.MCP);
      
      const isRunning = mcpIntegrationService.isRunning();
      if (isRunning) {
        throw new Error('MCP service should not be running for fallback test');
      }

      // Test basic functionality exists
      const healthStatus = mcpIntegrationService.getHealthStatus();
      if (!healthStatus || typeof healthStatus.isRunning !== 'boolean') {
        throw new Error('Health status should return valid object');
      }

      this.results.push({
        name: testName,
        success: true,
        duration: Date.now() - startTime,
      });
      log.info('✅ Fallback mode test passed', LogContext.MCP);
    } catch (error) {
      this.results.push({
        name: testName,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      });
      log.error('❌ Fallback mode test failed', LogContext.MCP, { error });
    }
  }

  private async testHealthStatus(): Promise<void> {
    const testName = 'Health Status';
    const startTime = Date.now();

    try {
      const healthStatus = mcpIntegrationService.getHealthStatus();
      
      const requiredFields = ['isRunning', 'messageCount', 'errorCount'];
      for (const field of requiredFields) {
        if (!(field in healthStatus)) {
          throw new Error(`Missing required field: ${field}`);
        }
      }

      if (healthStatus.isRunning !== false) {
        throw new Error('Health status should show not running when server is down');
      }

      this.results.push({
        name: testName,
        success: true,
        duration: Date.now() - startTime,
      });
      log.info('✅ Health status test passed', LogContext.MCP, {
        healthStatus,
      });
    } catch (error) {
      this.results.push({
        name: testName,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      });
      log.error('❌ Health status test failed', LogContext.MCP, { error });
    }
  }

  private async testErrorHandling(): Promise<void> {
    const testName = 'Error Handling';
    const startTime = Date.now();

    try {
      // Test that ping returns false when server is not running
      const pingResult = await mcpIntegrationService.ping();
      if (pingResult !== false) {
        throw new Error('Ping should return false when server is not running');
      }

      // Test that service methods exist and don't crash
      const serviceExists = typeof mcpIntegrationService.start === 'function' &&
                           typeof mcpIntegrationService.shutdown === 'function' &&
                           typeof mcpIntegrationService.restart === 'function';

      if (!serviceExists) {
        throw new Error('Required service methods are missing');
      }

      this.results.push({
        name: testName,
        success: true,
        duration: Date.now() - startTime,
      });
      log.info('✅ Error handling test passed', LogContext.MCP);
    } catch (error) {
      this.results.push({
        name: testName,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      });
      log.error('❌ Error handling test failed', LogContext.MCP, { error });
    }
  }

  private printResults(): void {
    console.log('\n📊 MCP Fallback Test Results:');
    console.log('='.repeat(50));

    let totalDuration = 0;
    let passedTests = 0;

    this.results.forEach(result => {
      const status = result.success ? '✅ PASS' : '❌ FAIL';
      const duration = `${result.duration}ms`;
      
      console.log(`${status} ${result.name.padEnd(20)} ${duration.padStart(8)}`);
      
      if (!result.success && result.error) {
        console.log(`     Error: ${result.error}`);
      }

      totalDuration += result.duration;
      if (result.success) passedTests++;
    });

    console.log('='.repeat(50));
    console.log(`Summary: ${passedTests}/${this.results.length} tests passed`);
    console.log(`Total time: ${totalDuration}ms`);
    
    if (passedTests === this.results.length) {
      console.log('🎉 All MCP fallback tests passed! Basic functionality works.');
    } else {
      console.log('⚠️  Some MCP tests failed. Check logs for details.');
    }
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new MCPFallbackTester();
  
  tester.runFallbackTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Test runner failed:', error);
      process.exit(1);
    });
}

export { MCPFallbackTester };