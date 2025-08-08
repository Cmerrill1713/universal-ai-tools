#!/usr/bin/env ts-node
/**
 * System Health Test Script
 * Tests the self-healing and optimization capabilities
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:3001';

interface HealthResponse {
  success: boolean;
  data: {
    status: string;
    health: any;
    summary: any;
    issues: any[];
  };
}

async function testSystemHealth(): Promise<void> {
  console.log('🏥 Testing Universal AI Tools System Health...\n');

  try {
    // Test 1: Basic health check
    console.log('1. Testing basic health endpoint...');
    const healthResponse = await axios.get<HealthResponse>(`${BASE_URL}/api/v1/health`);

    if (healthResponse.data.success) {
      console.log('✅ Health endpoint responding');
      console.log(`   Status: ${healthResponse.data.data.status}`);
      console.log(
        `   System Health: ${(healthResponse.data.data.health?.systemHealth * 100).toFixed(1)}%`
      );
      console.log(`   Active Issues: ${healthResponse.data.data.issues.length}`);

      if (healthResponse.data.data.issues.length > 0) {
        console.log('   Issues:');
        healthResponse.data.data.issues.forEach((issue) => {
          console.log(`     - [${issue.severity.toUpperCase()}] ${issue.description}`);
        });
      }
    } else {
      console.log('❌ Health endpoint returned error');
    }

    // Test 2: Force health check
    console.log('\n2. Testing force health check...');
    const forceHealthResponse = await axios.post(`${BASE_URL}/api/v1/health/check`);

    if (forceHealthResponse.data.success) {
      console.log('✅ Force health check completed');
    } else {
      console.log('❌ Force health check failed');
    }

    // Test 3: Test A2A mesh connectivity
    console.log('\n3. Testing A2A mesh connectivity...');
    try {
      const meshResponse = await axios.get(`${BASE_URL}/api/v1/a2a/status`);
      console.log('✅ A2A mesh endpoint accessible');
      console.log(`   Mesh status: ${meshResponse.data.success ? 'Active' : 'Inactive'}`);
    } catch (error) {
      console.log('❌ A2A mesh endpoint not accessible');
      console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Test 4: Test agent registry
    console.log('\n4. Testing agent registry...');
    try {
      const agentsResponse = await axios.get(`${BASE_URL}/api/v1/agents/list`);
      console.log('✅ Agent registry endpoint accessible');

      if (agentsResponse.data.success && agentsResponse.data.data) {
        const agents = agentsResponse.data.data;
        console.log(`   Registered agents: ${agents.length || 0}`);

        if (agents.length > 0) {
          agents.slice(0, 3).forEach((agent: any) => {
            console.log(`     - ${agent.name} (${agent.type})`);
          });

          if (agents.length > 3) {
            console.log(`     ... and ${agents.length - 3} more`);
          }
        }
      }
    } catch (error) {
      console.log('❌ Agent registry endpoint not accessible');
      console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Test 5: Test self-healing trigger
    console.log('\n5. Testing self-healing capabilities...');
    try {
      const healResponse = await axios.post(`${BASE_URL}/api/v1/health/heal`);

      if (healResponse.data.success) {
        console.log('✅ Self-healing triggered successfully');
        console.log(`   Healing actions: ${healResponse.data.data?.healingActions || 0}`);
      } else {
        console.log('❌ Self-healing failed to trigger');
      }
    } catch (error) {
      console.log('❌ Self-healing endpoint not accessible');
      console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Test 6: Performance metrics
    console.log('\n6. Testing performance metrics...');
    const finalHealthResponse = await axios.get<HealthResponse>(`${BASE_URL}/api/v1/health`);

    if (finalHealthResponse.data.success && finalHealthResponse.data.data.health) {
      const health = finalHealthResponse.data.data.health;
      console.log('✅ Performance metrics available');
      console.log(`   Response Time: ${health.responseTime || 'N/A'}ms`);
      console.log(`   Memory Usage: ${(health.memoryUsage * 100).toFixed(1)}%`);
      console.log(`   CPU Usage: ${(health.cpuUsage * 100).toFixed(1)}%`);
      console.log(`   Error Rate: ${(health.errorRate * 100).toFixed(2)}%`);
    }

    console.log('\n🎉 System health test completed!');

    // Summary
    const overallHealth = finalHealthResponse.data.data.health?.systemHealth || 0;
    if (overallHealth > 0.8) {
      console.log('🟢 System Status: EXCELLENT');
    } else if (overallHealth > 0.6) {
      console.log('🟡 System Status: GOOD');
    } else if (overallHealth > 0.4) {
      console.log('🟠 System Status: DEGRADED');
    } else {
      console.log('🔴 System Status: CRITICAL');
    }
  } catch (error) {
    console.error(
      '❌ System health test failed:',
      error instanceof Error ? error.message : String(error)
    );

    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNREFUSED') {
        console.log('\n💡 Server appears to be offline. Start the server with:');
        console.log('   npm run dev');
      } else if (error.response) {
        console.log(`   HTTP ${error.response.status}: ${error.response.statusText}`);
      }
    }

    process.exit(1);
  }
}

// Run the test
// Run the test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testSystemHealth().catch(console.error);
}

export { testSystemHealth };
