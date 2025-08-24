#!/usr/bin/env node

// import { LoadTestFramework, createApiLoadTest } from '../src/tests/performance/load-test-framework';
// import { CachePerformanceTester } from '../src/tests/performance/cache-performance';
// import { DatabasePerformanceTester } from '../src/tests/performance/database-performance';
import { memoryOptimizationService } from '../src/services/memory-optimization-service';
import { databaseConnectionService } from '../src/services/database-connection-service';
import { log, LogContext } from '../src/utils/logger';

// Simple table utility
function createTable(head: string[], rows: string[][]): string {
  const colWidths = head.map(
    (h, i) => Math.max(h.length, ...rows.map((r) => r[i]?.length || 0)) + 2
  );

  const separator = '├' + colWidths.map((w) => '─'.repeat(w)).join('┼') + '┤';
  const topBorder = '┌' + colWidths.map((w) => '─'.repeat(w)).join('┬') + '┐';
  const bottomBorder = '└' + colWidths.map((w) => '─'.repeat(w)).join('┴') + '┘';

  const headerRow = '│' + head.map((h, i) => h.padEnd(colWidths[i])).join('│') + '│';
  const dataRows = rows.map(
    (row) => '│' + row.map((cell, i) => (cell || '').padEnd(colWidths[i])).join('│') + '│'
  );

  return [topBorder, headerRow, separator, ...dataRows, bottomBorder].join('\n');
}

async function runQuickMemoryTest(): Promise<void> {
  process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.log('\n🧠 Running Quick Memory Performance Test...');

  // Force memory optimization
  await memoryOptimizationService.forceMemoryOptimization();
  
  const beforeMetrics = memoryOptimizationService.getMemoryAnalytics();
  
  // Create some memory pressure
  const testData = [];
  for (let i = 0; i < 1000; i++) {
    testData.push(new Array(1000).fill(Math.random()));
  }
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const duringMetrics = memoryOptimizationService.getMemoryAnalytics();
  
  // Clear test data
  testData.length = 0;
  
  // Force cleanup
  await memoryOptimizationService.forceMemoryOptimization();
  
  const afterMetrics = memoryOptimizationService.getMemoryAnalytics();
  
  console.log('Memory Test Results:');
  console.log(`  Before: ${beforeMetrics.currentMetrics.heapUsedPercent.toFixed(1)}%`);
  console.log(`  During load: ${duringMetrics.currentMetrics.heapUsedPercent.toFixed(1)}%`);
  console.log(`  After cleanup: ${afterMetrics.currentMetrics.heapUsedPercent.toFixed(1)}%`);
  
  const memoryRecovered = duringMetrics.currentMetrics.heapUsedPercent - afterMetrics.currentMetrics.heapUsedPercent;
  console.log(`  Memory recovered: ${memoryRecovered.toFixed(1)}%`);
  
  if (memoryRecovered > 5) {
    console.log('✅ Memory optimization working effectively');
  } else {
    console.log('⚠️  Limited memory recovery observed');
  }
}

async function runQuickDatabaseTest(): Promise<void> {
  console.log('\n🗄️  Running Quick Database Performance Test...');
  
  try {
    const startTime = Date.now();
    const healthCheck = await databaseConnectionService.performHealthCheck();
    const responseTime = Date.now() - startTime;
    
    console.log('Database Test Results:');
    console.log(`  Health status: ${healthCheck.status}`);
    console.log(`  Response time: ${responseTime}ms`);
    console.log(`  Connection pool utilization: ${healthCheck.connections.poolUtilization.toFixed(1)}%`);
    console.log(`  Active connections: ${healthCheck.connections.activeConnections}`);
    console.log(`  Connection leaks: ${healthCheck.connections.connectionLeaks}`);
    
    if (healthCheck.status === 'healthy' && responseTime < 1000) {
      console.log('✅ Database performance is good');
    } else {
      console.log('⚠️  Database performance may need attention');
    }
  } catch (error) {
    console.log('❌ Database connection test failed');
    console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function runSystemResourceCheck(): Promise<void> {
  console.log('\n💻 Running System Resource Check...');

  // Initialize services
  await memoryOptimizationService.initialize();

  // Let it collect some metrics
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Get current memory analytics
  const memoryAnalytics = memoryOptimizationService.getMemoryAnalytics();
  const currentMemory = memoryAnalytics.currentMetrics;
  
  // Get database connection metrics
  let dbMetrics;
  try {
    dbMetrics = databaseConnectionService.getConnectionMetrics();
  } catch (error) {
    dbMetrics = {
      totalConnections: 0,
      activeConnections: 0,
      poolUtilization: 0,
      connectionLeaks: 0,
    };
  }

  console.log('\n📊 System Resources:');

  const memoryPercentage = currentMemory.heapUsedPercent;
  const memoryStatus = memoryPercentage > 70 ? '🔴 High' : memoryPercentage > 50 ? '🟡 Medium' : '🟢 Normal';

  const connectionStatus = dbMetrics.connectionLeaks > 0 ? '🔴 Leaks' : 
                          dbMetrics.poolUtilization > 80 ? '🟡 High' : '🟢 Normal';

  const rows = [
    ['Memory Usage', `${(currentMemory.heapUsed / 1024 / 1024).toFixed(1)}MB`, memoryStatus],
    ['Heap Percentage', `${memoryPercentage.toFixed(1)}%`, memoryStatus],
    ['RSS Memory', `${(currentMemory.rss / 1024 / 1024).toFixed(1)}MB`, '-'],
    ['External Memory', `${(currentMemory.external / 1024 / 1024).toFixed(1)}MB`, '-'],
    ['DB Connections', `${dbMetrics.activeConnections}/${dbMetrics.totalConnections}`, connectionStatus],
    ['Pool Utilization', `${dbMetrics.poolUtilization.toFixed(1)}%`, connectionStatus],
    ['Connection Leaks', `${dbMetrics.connectionLeaks}`, dbMetrics.connectionLeaks > 0 ? '🔴 Leaks' : '🟢 None'],
    ['Memory Pressure', memoryAnalytics.isMemoryPressureMode ? 'Active' : 'Normal', memoryAnalytics.isMemoryPressureMode ? '🟡 Active' : '🟢 Normal'],
  ];

  const table = createTable(['Resource', 'Current', 'Status'], rows);
  console.log(table);

  // Overall system health assessment
  const criticalIssues = [
    memoryPercentage > 70,
    dbMetrics.connectionLeaks > 0,
    dbMetrics.poolUtilization > 90,
  ].filter(Boolean).length;

  const warningIssues = [
    memoryPercentage > 50,
    dbMetrics.poolUtilization > 70,
    memoryAnalytics.isMemoryPressureMode,
  ].filter(Boolean).length;

  if (criticalIssues > 0) {
    console.log('❌ System has critical issues!');
    console.log(`   Critical issues: ${criticalIssues}, Warning issues: ${warningIssues}`);
  } else if (warningIssues > 0) {
    console.log('⚠️  System showing some load');
    console.log(`   Warning issues: ${warningIssues}`);
  } else {
    console.log('✅ System resources healthy!');
  }

  // Cleanup
  await memoryOptimizationService.forceTestCleanup();
}

async function main() {
  const args = process.argv.slice(2);
  const testType = args[0] || 'all';

  console.log('⚡ Universal AI Tools - Quick Performance Check\n');

  try {
    switch (testType.toLowerCase()) {
      case 'memory':
        await runQuickMemoryTest();
        break;
      case 'database':
      case 'db':
        await runQuickDatabaseTest();
        break;
      case 'system':
        await runSystemResourceCheck();
        break;
      case 'all':
      default:
        await runSystemResourceCheck();
        await runQuickMemoryTest();
        await runQuickDatabaseTest();
        break;
    }

    console.log('\n✅ Quick performance check completed!');
    
    // Final cleanup to prevent open handles
    await memoryOptimizationService.forceTestCleanup();
    await databaseConnectionService.forceTestCleanup();
    
    // Force exit to prevent hanging
    setTimeout(() => {
      process.exit(0);
    }, 1000);
    
  } catch (error) {
    process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && process.env.NODE_ENV === 'development' && console.error('\n❌ Performance check failed:');
    console.error(error);
    
    // Cleanup on error
    try {
      await memoryOptimizationService.forceTestCleanup();
      await databaseConnectionService.forceTestCleanup();
    } catch (cleanupError) {
      // Ignore cleanup errors
    }
    
    process.exit(1);
  }
}

// Check if this file is being run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
