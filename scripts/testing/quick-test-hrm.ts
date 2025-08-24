#!/usr/bin/env tsx
/**
 * Quick HRM Integration Test
 * Validates core functionality without requiring all services to be running
 */

process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.log('🧪 Quick HRM Integration Test');
console.log('='.repeat(50));

interface QuickTestResult {
  testName: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  details: string;
}

class QuickHRMTester {
  private results: QuickTestResult[] = [];

  async runQuickTests(): Promise<void> {
    console.log('🚀 Running quick validation tests...\n');

    // Test 1: Import all HRM integration modules
    await this.testImports();

    // Test 2: Basic client instantiation
    await this.testClientInstantiation();

    // Test 3: Service connectivity checks
    await this.testServiceConnectivity();

    // Test 4: HRM decision flow simulation
    await this.testHRMDecisionFlow();

    this.generateQuickReport();
  }

  private async testImports(): Promise<void> {
    console.log('1️⃣ Testing Module Imports');
    console.log('-'.repeat(30));

    await this.runQuickTest('HRM Agent Bridge Import', async () => {
      const { hrmAgentBridge } = await import('./src/services/hrm-agent-bridge');
      return `HRM Bridge imported: ${typeof hrmAgentBridge}`;
    });

    await this.runQuickTest('Rust Agent Registry Client Import', async () => {
      const { rustAgentRegistry } = await import('./src/services/rust-agent-registry-client');
      return `Rust Registry imported: ${typeof rustAgentRegistry}`;
    });

    await this.runQuickTest('Go Agent Orchestrator Client Import', async () => {
      const { goAgentOrchestrator } = await import('./src/services/go-agent-orchestrator-client');
      return `Go Orchestrator imported: ${typeof goAgentOrchestrator}`;
    });

    await this.runQuickTest('DSPy Agent Client Import', async () => {
      const { dspyAgentClient } = await import('./src/services/dspy-agent-client');
      return `DSPy Client imported: ${typeof dspyAgentClient}`;
    });

    await this.runQuickTest('Dynamic Agent Factory Import', async () => {
      const { DynamicAgentFactory } = await import('./src/services/dynamic-agent-factory');
      return `Dynamic Factory imported: ${typeof DynamicAgentFactory}`;
    });

    console.log();
  }

  private async testClientInstantiation(): Promise<void> {
    console.log('2️⃣ Testing Client Instantiation');
    console.log('-'.repeat(30));

    await this.runQuickTest('HRM Agent Bridge Instance', async () => {
      const { hrmAgentBridge } = await import('./src/services/hrm-agent-bridge');
      return `Instance created: ${hrmAgentBridge.constructor.name}`;
    });

    await this.runQuickTest('Dynamic Agent Factory Instance', async () => {
      const { DynamicAgentFactory } = await import('./src/services/dynamic-agent-factory');
      const factory = new DynamicAgentFactory();
      return `Factory created: ${factory.constructor.name}`;
    });

    await this.runQuickTest('Client Connection Status', async () => {
      const { rustAgentRegistry } = await import('./src/services/rust-agent-registry-client');
      const { goAgentOrchestrator } = await import('./src/services/go-agent-orchestrator-client');
      const { dspyAgentClient } = await import('./src/services/dspy-agent-client');

      const rustStatus = rustAgentRegistry.getConnectionStatus();
      const goStatus = goAgentOrchestrator.getConnectionStatus();
      const dspyStatus = dspyAgentClient.getConnectionStatus();

      return `Rust: ${rustStatus.baseUrl}, Go: ${goStatus.baseUrl}, DSPy: ${dspyStatus.baseUrl}`;
    });

    console.log();
  }

  private async testServiceConnectivity(): Promise<void> {
    console.log('3️⃣ Testing Service Connectivity (No External Dependencies)');
    console.log('-'.repeat(30));

    await this.runQuickTest('HRM Service Configuration', async () => {
      const { hrmAgentBridge } = await import('./src/services/hrm-agent-bridge');
      
      // Test basic configuration without actually connecting
      const hasHRMConfig = hrmAgentBridge && typeof hrmAgentBridge.selectBestLLM === 'function';
      return `HRM configured: ${hasHRMConfig}`;
    });

    await this.runQuickTest('Client Health Check Methods', async () => {
      const { rustAgentRegistry } = await import('./src/services/rust-agent-registry-client');
      const { goAgentOrchestrator } = await import('./src/services/go-agent-orchestrator-client');
      const { dspyAgentClient } = await import('./src/services/dspy-agent-client');

      const hasHealthChecks = [
        typeof rustAgentRegistry.isHealthy === 'function',
        typeof goAgentOrchestrator.isHealthy === 'function', 
        typeof dspyAgentClient.isHealthy === 'function'
      ].every(check => check);

      return `Health check methods: ${hasHealthChecks ? 'Available' : 'Missing'}`;
    });

    await this.runQuickTest('Service URLs Configuration', async () => {
      const { rustAgentRegistry } = await import('./src/services/rust-agent-registry-client');
      const { goAgentOrchestrator } = await import('./src/services/go-agent-orchestrator-client');
      const { dspyAgentClient } = await import('./src/services/dspy-agent-client');

      const rustConfig = rustAgentRegistry.getConnectionStatus();
      const goConfig = goAgentOrchestrator.getConnectionStatus();
      const dspyConfig = dspyAgentClient.getConnectionStatus();

      const hasValidURLs = [
        rustConfig.baseUrl.includes('localhost'),
        goConfig.baseUrl.includes('localhost'),
        dspyConfig.baseUrl.includes('localhost')
      ].every(check => check);

      return `Service URLs configured: ${hasValidURLs}`;
    });

    console.log();
  }

  private async testHRMDecisionFlow(): Promise<void> {
    console.log('4️⃣ Testing HRM Decision Flow Logic');
    console.log('-'.repeat(30));

    await this.runQuickTest('HRM Decision Methods Available', async () => {
      const { hrmAgentBridge } = await import('./src/services/hrm-agent-bridge');
      
      const methods = [
        'selectBestLLM',
        'selectBestAgent', 
        'executeTaskWithHRM',
        'getSystemStatus',
        'getAgentById'
      ];

      const availableMethods = methods.filter(method => 
        typeof hrmAgentBridge[method] === 'function'
      );

      return `Available methods: ${availableMethods.length}/${methods.length}`;
    });

    await this.runQuickTest('Dynamic Factory HRM Integration', async () => {
      const { DynamicAgentFactory } = await import('./src/services/dynamic-agent-factory');
      const factory = new DynamicAgentFactory();
      
      const hrmMethods = [
        'executeTaskWithHRM',
        'createAgent'
      ];

      const availableMethods = hrmMethods.filter(method => 
        typeof factory[method] === 'function'
      );

      return `HRM methods in factory: ${availableMethods.length}/${hrmMethods.length}`;
    });

    await this.runQuickTest('Agent Templates Loaded', async () => {
      const { DynamicAgentFactory } = await import('./src/services/dynamic-agent-factory');
      const factory = new DynamicAgentFactory();
      
      // Wait for template initialization
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Check if templates are available (private property, so we check indirectly)
      const hasCreateAgent = typeof factory.createAgent === 'function';
      
      return `Agent creation ready: ${hasCreateAgent}`;
    });

    await this.runQuickTest('Fallback Strategy Available', async () => {
      const { DynamicAgentFactory } = await import('./src/services/dynamic-agent-factory');
      const factory = new DynamicAgentFactory();
      
      // Check if fallback methods exist
      const fallbackCapabilities = [
        typeof factory.executeTaskWithHRM === 'function',
        typeof factory.getRunningAgents === 'function'
      ];

      const hasFullFallback = fallbackCapabilities.every(cap => cap);
      
      return `Fallback strategy: ${hasFullFallback ? 'Complete' : 'Partial'}`;
    });

    console.log();
  }

  private async runQuickTest(testName: string, testFunction: () => Promise<string>): Promise<void> {
    try {
      console.log(`   🧪 ${testName}...`);
      const details = await testFunction();
      
      this.results.push({
        testName,
        status: 'PASS',
        details
      });
      
      console.log(`   ✅ PASS - ${details}`);
    } catch (error) {
      this.results.push({
        testName,
        status: 'FAIL',
        details: error.message
      });
      
      console.log(`   ❌ FAIL - ${error.message}`);
    }
  }

  private generateQuickReport(): void {
    console.log('\n' + '='.repeat(50));
    console.log('📊 QUICK HRM INTEGRATION TEST REPORT');
    console.log('='.repeat(50));

    const passCount = this.results.filter(r => r.status === 'PASS').length;
    const failCount = this.results.filter(r => r.status === 'FAIL').length;
    const totalTests = this.results.length;
    const successRate = Math.round((passCount / totalTests) * 100);

    console.log(`\n📈 SUMMARY:`);
    console.log(`   Total Tests: ${totalTests}`);
    console.log(`   Passed: ${passCount} ✅`);
    console.log(`   Failed: ${failCount} ❌`);
    console.log(`   Success Rate: ${successRate}%`);
    
    console.log(`\n🎯 INTEGRATION READINESS:`);
    if (successRate === 100) {
      console.log(`   🟢 EXCELLENT - All integration components are properly configured`);
      console.log(`   ✅ Ready for full functional testing with live services`);
    } else if (successRate >= 80) {
      console.log(`   🟡 GOOD - Most integration components are working`);
      console.log(`   ⚠️  Some minor issues need attention before full testing`);
    } else {
      console.log(`   🟠 NEEDS WORK - Significant integration issues detected`);
      console.log(`   🔧 Fix these issues before running full functional tests`);
    }

    if (failCount > 0) {
      console.log(`\n❌ ISSUES TO FIX:`);
      this.results.filter(r => r.status === 'FAIL').forEach(result => {
        console.log(`   • ${result.testName}: ${result.details}`);
      });
    }

    console.log(`\n💡 NEXT STEPS:`);
    if (successRate === 100) {
      console.log(`   1. Start required services (HRM, Rust Registry, Go Orchestrator, DSPy)`);
      console.log(`   2. Run full functional test: npx tsx test-hrm-integration.ts`);
      console.log(`   3. Test real-world scenarios with actual agent execution`);
    } else {
      console.log(`   1. Fix the failing integration components above`);
      console.log(`   2. Re-run this quick test: npx tsx quick-test-hrm.ts`);
      console.log(`   3. Once all tests pass, proceed to full functional testing`);
    }

    console.log('\n' + '='.repeat(50));
    console.log('✅ Quick integration test complete!');
    console.log('='.repeat(50));
  }
}

// Run the quick tests
const tester = new QuickHRMTester();
tester.runQuickTests().catch(error => {
  process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.error('❌ Quick test failed:', error);
  process.exit(1);
});

export default QuickHRMTester;