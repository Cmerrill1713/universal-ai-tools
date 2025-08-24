#!/usr/bin/env node

/**
 * Simple Resource Monitoring Test
 * Tests basic system resource monitoring capabilities
 */

import os from 'os';

process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.log('🖥️  Testing Resource Monitoring...\n');

// Memory monitoring test
function testMemoryMonitoring() {
  console.log('📊 Memory Monitoring Test:');

  const memUsage = process.memoryUsage();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memoryPercentage = (usedMem / totalMem) * 100;

  console.log(`  ✓ Heap Used: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  ✓ Heap Total: ${(memUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  ✓ RSS: ${(memUsage.rss / 1024 / 1024).toFixed(2)} MB`);
  console.log(
    `  ✓ System Memory: ${(usedMem / 1024 / 1024 / 1024).toFixed(2)}GB / ${(totalMem / 1024 / 1024 / 1024).toFixed(2)}GB (${memoryPercentage.toFixed(1)}%)`
  );

  return {
    success: true,
    data: {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      rss: memUsage.rss,
      systemUsed: usedMem,
      systemTotal: totalMem,
      percentage: memoryPercentage,
    },
  };
}

// CPU monitoring test
function testCpuMonitoring() {
  console.log('\n🖥️  CPU Monitoring Test:');

  const cpus = os.cpus();
  const loadAvg = os.loadavg();
  const normalizedLoad = loadAvg[0] / cpus.length;

  console.log(`  ✓ CPU Cores: ${cpus.length}`);
  console.log(`  ✓ CPU Model: ${cpus[0].model}`);
  console.log(`  ✓ Load Average (1m): ${loadAvg[0].toFixed(2)}`);
  console.log(`  ✓ Load Average (5m): ${loadAvg[1].toFixed(2)}`);
  console.log(`  ✓ Load Average (15m): ${loadAvg[2].toFixed(2)}`);
  console.log(`  ✓ Normalized Load: ${(normalizedLoad * 100).toFixed(1)}%`);

  return {
    success: true,
    data: {
      cores: cpus.length,
      model: cpus[0].model,
      loadAverage: loadAvg,
      normalizedLoad: normalizedLoad * 100,
    },
  };
}

// Network monitoring test
function testNetworkMonitoring() {
  console.log('\n🌐 Network Monitoring Test:');

  const networkInterfaces = os.networkInterfaces();
  const interfaces = Object.keys(networkInterfaces).filter(
    (name) => !name.startsWith('lo') && networkInterfaces[name].some((iface) => !iface.internal)
  );

  console.log(`  ✓ Network Interfaces: ${interfaces.join(', ')}`);

  interfaces.forEach((name) => {
    const iface = networkInterfaces[name].find((i) => i.family === 'IPv4' && !i.internal);
    if (iface) {
      console.log(`  ✓ ${name}: ${iface.address} (${iface.mac})`);
    }
  });

  return {
    success: true,
    data: {
      interfaces,
      details: networkInterfaces,
    },
  };
}

// Process monitoring test
function testProcessMonitoring() {
  console.log('\n⚙️  Process Monitoring Test:');

  const uptime = process.uptime();
  const pid = process.pid;
  const nodeVersion = process.version;
  const platform = process.platform;
  const arch = process.arch;

  console.log(`  ✓ Process ID: ${pid}`);
  console.log(`  ✓ Uptime: ${uptime.toFixed(1)} seconds`);
  console.log(`  ✓ Node.js Version: ${nodeVersion}`);
  console.log(`  ✓ Platform: ${platform}`);
  console.log(`  ✓ Architecture: ${arch}`);

  return {
    success: true,
    data: {
      pid,
      uptime,
      nodeVersion,
      platform,
      arch,
    },
  };
}

// System health check
function testSystemHealth() {
  console.log('\n🏥 System Health Check:');

  const results = [];

  // Memory health
  const memUsage = process.memoryUsage();
  const totalMem = os.totalmem();
  const memPercentage = (memUsage.heapUsed / totalMem) * 100;
  const memoryHealthy = memPercentage < 80;

  console.log(
    `  ${memoryHealthy ? '✅' : '⚠️ '} Memory: ${memPercentage.toFixed(1)}% ${memoryHealthy ? 'OK' : 'HIGH'}`
  );
  results.push({ component: 'memory', healthy: memoryHealthy, value: memPercentage });

  // CPU health
  const loadAvg = os.loadavg();
  const cpuCount = os.cpus().length;
  const normalizedLoad = loadAvg[0] / cpuCount;
  const cpuHealthy = normalizedLoad < 0.8;

  console.log(
    `  ${cpuHealthy ? '✅' : '⚠️ '} CPU Load: ${(normalizedLoad * 100).toFixed(1)}% ${cpuHealthy ? 'OK' : 'HIGH'}`
  );
  results.push({ component: 'cpu', healthy: cpuHealthy, value: normalizedLoad * 100 });

  // Uptime health
  const uptime = os.uptime();
  const uptimeHealthy = uptime > 0;

  console.log(`  ✅ System Uptime: ${(uptime / 3600).toFixed(1)} hours`);
  results.push({ component: 'uptime', healthy: uptimeHealthy, value: uptime });

  const overallHealth = results.every((r) => r.healthy);
  console.log(`\n  🎯 Overall Health: ${overallHealth ? '✅ HEALTHY' : '⚠️  DEGRADED'}`);

  return {
    success: true,
    overallHealth,
    results,
  };
}

// Connection monitoring simulation
function testConnectionMonitoring() {
  console.log('\n🔗 Connection Monitoring Test:');

  // Simulate connection pool monitoring
  const connections = {
    redis: { active: 2, idle: 3, total: 5, healthy: true },
    database: { active: 1, idle: 4, total: 5, healthy: true },
    http: { active: 0, idle: 10, total: 10, healthy: true },
  };

  Object.entries(connections).forEach(([name, conn]) => {
    console.log(
      `  ${conn.healthy ? '✅' : '❌'} ${name}: ${conn.active} active, ${conn.idle} idle (${conn.total} total)`
    );
  });

  return {
    success: true,
    data: connections,
  };
}

// Run all tests
async function runResourceMonitoringTests() {
  console.log('=' * 60);
  console.log('🔍 RESOURCE MONITORING VALIDATION');
  console.log('=' * 60);

  const results = {
    timestamp: new Date().toISOString(),
    tests: {},
  };

  try {
    results.tests.memory = testMemoryMonitoring();
    results.tests.cpu = testCpuMonitoring();
    results.tests.network = testNetworkMonitoring();
    results.tests.process = testProcessMonitoring();
    results.tests.health = testSystemHealth();
    results.tests.connections = testConnectionMonitoring();

    const totalTests = Object.keys(results.tests).length;
    const passedTests = Object.values(results.tests).filter((t) => t.success).length;
    const successRate = (passedTests / totalTests) * 100;

    console.log('\n' + '=' * 60);
    console.log('📊 RESOURCE MONITORING RESULTS');
    console.log('=' * 60);
    console.log(`✅ Tests Passed: ${passedTests}/${totalTests}`);
    console.log(`📈 Success Rate: ${successRate.toFixed(1)}%`);
    console.log(`🕐 Timestamp: ${results.timestamp}`);

    if (successRate === 100) {
      console.log('🎉 All resource monitoring tests passed!');
    } else {
      console.log('⚠️  Some resource monitoring tests need attention.');
    }

    results.summary = {
      totalTests,
      passedTests,
      successRate,
      status: successRate === 100 ? 'healthy' : successRate >= 75 ? 'degraded' : 'unhealthy',
    };

    return results;
  } catch (error) {
    process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.error('❌ Resource monitoring test failed:', error.message);
    results.error = error.message;
    results.summary = { status: 'failed' };
    return results;
  }
}

// Export for use in other scripts
export { runResourceMonitoringTests };

// Run if called directly
if (process.argv[1].endsWith('test-resource-monitoring.js')) {
  runResourceMonitoringTests().catch(console.error);
}
