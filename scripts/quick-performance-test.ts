#!/usr/bin/env node

// import { LoadTestFramework, createApiLoadTest } from '../src/tests/performance/load-test-framework';
// import { CachePerformanceTester } from '../src/tests/performance/cache-performance';
// import { DatabasePerformanceTester } from '../src/tests/performance/database-performance';
import { performanceMonitor } from '../src/utils/performance-monitor';
import { logger } from '../src/utils/logger';
import chalk from 'chalk';

// Simple table utility
function createTable(head: string[], rows: string[][]): string {
  const colWidths = head.map((h, i) => Math.max(h.length, ...rows.map(r => r[i]?.length || 0)) + 2);
  
  const separator = '├' + colWidths.map(w => '─'.repeat(w)).join('┼') + '┤';
  const topBorder = '┌' + colWidths.map(w => '─'.repeat(w)).join('┬') + '┐';
  const bottomBorder = '└' + colWidths.map(w => '─'.repeat(w)).join('┴') + '┘';
  
  const headerRow = '│' + head.map((h, i) => h.padEnd(colWidths[i])).join('│') + '│';
  const dataRows = rows.map(row => 
    '│' + row.map((cell, i) => (cell || '').padEnd(colWidths[i])).join('│') + '│'
  );
  
  return [topBorder, headerRow, separator, ...dataRows, bottomBorder].join('\n');
}

async function runQuickAPITest(): Promise<void> {
  console.log(chalk.cyan('🚀 Running Quick API Performance Test...'));
  console.log(chalk.yellow('⚠️  API tests require service dependencies - run full test suite for complete testing'));
}

async function runQuickCacheTest(): Promise<void> {
  console.log(chalk.cyan('\n🎯 Running Quick Cache Performance Test...'));
  console.log(chalk.yellow('⚠️  Cache tests require Redis connection - run full test suite for complete testing'));
}

async function runQuickDatabaseTest(): Promise<void> {
  console.log(chalk.cyan('\n🗄️  Running Quick Database Performance Test...'));
  console.log(chalk.yellow('⚠️  Database tests require Supabase connection - run full test suite for complete testing'));
}

async function runSystemResourceCheck(): Promise<void> {
  console.log(chalk.cyan('\n💻 Running System Resource Check...'));
  
  // Start monitoring
  performanceMonitor.startMonitoring(1000);
  
  // Let it collect some metrics
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  const currentMetrics = performanceMonitor.getCurrentMetrics();
  const aggregated = performanceMonitor.getAggregatedMetrics(5000);
  
  performanceMonitor.stopMonitoring();
  
  console.log(chalk.cyan('\n📊 System Resources:'));
  
  const memoryPercentage = (currentMetrics.heapUsedMB / currentMetrics.heapTotalMB) * 100;
  const memoryStatus = memoryPercentage > 80 ? chalk.red('High') : 
                      memoryPercentage > 60 ? chalk.yellow('Medium') : chalk.green('Normal');
  
  const errorRateStatus = currentMetrics.errorRate > 5 ? chalk.red('High') :
                         currentMetrics.errorRate > 1 ? chalk.yellow('Medium') : chalk.green('Low');
  
  const rows = [
    ['Memory Usage', `${currentMetrics.heapUsedMB}MB`, memoryStatus],
    ['RSS Memory', `${currentMetrics.rss}MB`, '-'],
    ['Uptime', `${Math.round(currentMetrics.uptime / 60)}min`, '-'],
    ['Active Connections', currentMetrics.activeConnections.toString(), '-'],
    ['Error Rate', `${currentMetrics.errorRate.toFixed(1)}%`, errorRateStatus],
    ['Cache Hit Rate', `${currentMetrics.cacheHitRate.toFixed(1)}%`, 
     currentMetrics.cacheHitRate > 80 ? chalk.green('Good') : chalk.yellow('Low')]
  ];
  
  const table = createTable(['Resource', 'Current', 'Status'], rows);
  console.log(table);
  
  // Overall system health
  if (memoryPercentage > 80 || currentMetrics.errorRate > 5) {
    console.log(chalk.red('❌ System under stress!'));
  } else if (memoryPercentage > 60 || currentMetrics.errorRate > 1) {
    console.log(chalk.yellow('⚠️  System showing load'));
  } else {
    console.log(chalk.green('✅ System resources healthy!'));
  }
}

async function main() {
  const args = process.argv.slice(2);
  const testType = args[0] || 'all';
  
  console.log(chalk.blue('⚡ Universal AI Tools - Quick Performance Check\n'));
  
  try {
    switch (testType.toLowerCase()) {
      case 'api':
        await runQuickAPITest();
        break;
      case 'cache':
        await runQuickCacheTest();
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
        await runQuickAPITest();
        await runQuickCacheTest();
        await runQuickDatabaseTest();
        break;
    }
    
    console.log(chalk.green('\n✅ Quick performance check completed!'));
    
  } catch (error) {
    console.error(chalk.red('\n❌ Performance check failed:'));
    console.error(error);
    process.exit(1);
  }
}

// Check if this file is being run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}