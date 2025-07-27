/* eslint-disable no-undef */
#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { resourceManager } from '../services/resource-manager';
import { connectionPoolManager } from '../services/connection-pool-manager';
import { memoryManager } from '../services/memory-manager';
import { logger } from '../utils/logger';
// import Table from 'cli-table3'; // Package not available, using simple table implementation
interface TableOptions {
  head?: string[];
  colWidths?: number[];
  style?: any; // Ignore style properties for now
}
class SimpleTable {
  private options: TableOptions;
  private rows: string[][] = [];

  constructor(options: TableOptions = {}) {
    this.options = options;
  }

  push(...args: any[]) {
    if (args.length === 1 && Array.isArray(args[0])) {
      this.rows.push(args[0]);
    } else {
      this.rows.push(args.map(String));
    }
  }

  toString(): string {
    const { head = [], colWidths = [] } = this.options;
    let result = '';

    if (head.length > 0) {
      result += `${head.map((h, i) => h.padEnd(colWidths[i] || 20)).join(' | ')}\n`;
      result += `${head.map((_, i) => '-'.repeat(colWidths[i] || 20)).join('-+-')}\n`;
    }

    for (const row of this.rows) {
      result += `${row.map((cell, i) => String(cell).padEnd(colWidths[i] || 20)).join(' | ')}\n`;
    }

    return result;
  }
}
const Table = SimpleTable;
// @ts-ignore - blessed types are not available
import blessed from 'blessed';
// @ts-ignore - blessed-contrib types are not available
import contrib from 'blessed-contrib';

const program = new Command();

program
  .name('resource-monitor')
  .description('Monitor and manage Universal AI Tools resources')
  .version('1.0.0');

// Real-time monitoring command
program
  .command('monitor')
  .description('Start real-time resource monitoring dashboard')
  .option('-i, --interval <ms>', 'Update interval in milliseconds', '1000')
  .action(async (options) => {
    const interval = parseInt(options.interval, 10);
    await startDashboard(interval);
  });

// Resource usage report
program
  .command('report')
  .description('Generate resource usage report')
  .option('-f, --format <format>', 'Output format (json|table)', 'table')
  .action(async (options) => {
    await generateReport(options.format);
  });

// Performance profiling
program
  .command('profile')
  .description('Start performance profiling')
  .option('-d, --duration <seconds>', 'Profiling duration in seconds', '60')
  .option('-o, --output <file>', 'Output file for profile data')
  .action(async (options) => {
    await startProfiling(parseInt(options.duration, 10), options.output);
  });

// Resource allocation adjustment
program
  .command('adjust')
  .description('Adjust resource allocations')
  .option('--max-memory <mb>', 'Set maximum memory limit (MB)')
  .option('--max-connections <n>', 'Set maximum connections')
  .option('--max-requests <n>', 'Set maximum requests per minute')
  .action(async (options) => {
    await adjustResources(options);
  });

// Health status check
program
  .command('health')
  .description('Check system health status')
  .option('-v, --verbose', 'Show detailed health information')
  .action(async (options) => {
    await checkHealth(options.verbose);
  });

// Memory commands
program
  .command('memory')
  .description('Memory management commands')
  .command('gc')
  .description('Force garbage collection')
  .action(async () => {
    await forceGC();
  });

program
  .command('memory')
  .command('snapshot')
  .description('Take heap snapshot')
  .action(async () => {
    await takeHeapSnapshot();
  });

program
  .command('memory')
  .command('leaks')
  .description('Check for memory leaks')
  .action(async () => {
    await checkMemoryLeaks();
  });

// Connection pool commands
program
  .command('connections')
  .description('Connection pool management')
  .command('status')
  .description('Show connection pool status')
  .option('-p, --pool <name>', 'Pool name', 'default')
  .action(async (options) => {
    await showConnectionStatus(options.pool);
  });

program
  .command('connections')
  .command('reset')
  .description('Reset connection pool')
  .option('-p, --pool <name>', 'Pool name', 'default')
  .action(async (options) => {
    await resetConnectionPool(options.pool);
  });

// Dashboard implementation
async function startDashboard(interval: number) {
  const screen = blessed.screen({
    smartCSR: true,
    title: 'Universal AI Tools - Resource Monitor',
  });

  const grid = new contrib.grid({ rows: 12, cols: 12, screen });

  // CPU gauge
  const cpuGauge = grid.set(0, 0, 4, 3, contrib.gauge, {
    label: 'CPU Usage',
    stroke: 'green',
    fill: 'white',
  });

  // Memory gauge
  const memoryGauge = grid.set(0, 3, 4, 3, contrib.gauge, {
    label: 'Memory Usage',
    stroke: 'cyan',
    fill: 'white',
  });

  // Connection gauge
  const connectionGauge = grid.set(0, 6, 4, 3, contrib.gauge, {
    label: 'Connections',
    stroke: 'yellow',
    fill: 'white',
  });

  // Request gauge
  const requestGauge = grid.set(0, 9, 4, 3, contrib.gauge, {
    label: 'Requests/min',
    stroke: 'magenta',
    fill: 'white',
  });

  // CPU line chart
  const cpuLine = grid.set(4, 0, 4, 6, contrib.line, {
    style: { line: 'yellow', text: 'green', baseline: 'black' },
    xLabelPadding: 3,
    xPadding: 5,
    showLegend: true,
    label: 'CPU History',
  });

  // Memory line chart
  const memoryLine = grid.set(4, 6, 4, 6, contrib.line, {
    style: { line: 'green', text: 'green', baseline: 'black' },
    xLabelPadding: 3,
    xPadding: 5,
    showLegend: true,
    label: 'Memory History',
  });

  // Log display
  const log = grid.set(8, 0, 4, 6, contrib.log, {
    fg: 'green',
    selectedFg: 'green',
    label: 'System Log',
  });

  // Allocations table
  const allocTable = grid.set(8, 6, 4, 6, contrib.table, {
    keys: true,
    fg: 'white',
    selectedFg: 'white',
    selectedBg: 'blue',
    interactive: false,
    label: 'Resource Allocations',
    width: '100%',
    height: '100%',
    border: { type: 'line', fg: 'cyan' },
    columnSpacing: 2,
    columnWidth: [10, 10, 10, 10],
  });

  // Data storage for charts
  const cpuData: number[] = [];
  const memoryData: number[] = [];
  const timestamps: string[] = [];
  const maxDataPoints = 60;

  // Update function
  const update = () => {
    const usage = resourceManager.getResourceUsage();
    const allocations = resourceManager.getAllocations();
    const timestamp = new Date().toLocaleTimeString();

    // Update gauges
    cpuGauge.setPercent(Math.round(usage.cpu.percentage));
    memoryGauge.setPercent(Math.round(usage.memory.percentage));
    connectionGauge.setPercent(Math.round((usage.connections.total / 100) * 100));
    requestGauge.setPercent(Math.round((usage.requests.perMinute / 1000) * 100));

    // Update chart data
    cpuData.push(usage.cpu.percentage);
    memoryData.push(usage.memory.percentage);
    timestamps.push(timestamp);

    if (cpuData.length > maxDataPoints) {
      cpuData.shift();
      memoryData.shift();
      timestamps.shift();
    }

    // Update line charts
    cpuLine.setData([
      {
        title: 'CPU %',
        x: timestamps,
        y: cpuData,
        style: { line: 'yellow' },
      },
    ]);

    memoryLine.setData([
      {
        title: 'Memory %',
        x: timestamps,
        y: memoryData,
        style: { line: 'green' },
      },
      {
        title: 'Heap %',
        x: timestamps,
        y: memoryData.map((_, i) => (usage.memory.heap.used / usage.memory.heap.limit) * 100),
        style: { line: 'cyan' },
      },
    ]);

    // Update allocations table
    const tableData = allocations
      .slice(0, 10)
      .map((a) => [
        a.type,
        a.owner,
        a.amount.toString(),
        new Date(a.allocatedAt).toLocaleTimeString(),
      ]);

    allocTable.setData({
      headers: ['Type', 'Owner', 'Amount', 'Time'],
      data: tableData,
    });

    // Add log entry
    if (usage.cpu.percentage > 80 || usage.memory.percentage > 80) {
      log.log(`${timestamp} - Warning: High resource usage detected`);
    }

    screen.render();
  };

  // Set up update interval
  const updateInterval = setInterval(update, interval);

  // Initial update
  update();

  // Key bindings
  screen.key(['escape', 'q', 'C-c'], () => {
    clearInterval(updateInterval);
    return process.exit(0);
  });

  screen.render();
}

// Report generation
async function generateReport(format: string) {
  const spinner = ora('Generating resource report...').start();

  try {
    const usage = resourceManager.getResourceUsage();
    const allocations = resourceManager.getAllocations();
    const poolStatus = connectionPoolManager.getPoolStatus();
    const memoryProfile = memoryManager.getMemoryProfile();

    const report = {
      timestamp: new Date().toISOString(),
      usage,
      allocations: {
        total: allocations.length,
        byType: allocations.reduce(
          (acc, a) => {
            acc[a.type] = (acc[a.type] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        ),
      },
      connectionPools: poolStatus,
      memory: memoryProfile,
      health: resourceManager.getHealthStatus(),
    };

    spinner.succeed('Report generated');

    if (format === 'json') {
      console.log(JSON.stringify(report, null, 2));
    } else {
      displayReportTable(report);
    }
  } catch (_error) {
    spinner.fail(`Failed to generate report: ${_error`);
    process.exit(1);
  }
}

function displayReportTable(report: any) {
  // System overview
  const overviewTable = new Table({
    head: ['Metric', 'Value'],
    colWidths: [30, 50],
  });

  overviewTable.push(
    ['Timestamp', report.timestamp],
    ['Health Status', report.health],
    ['CPU Usage', `${report.usage.cpu.percentage.toFixed(1)}%`],
    ['Memory Usage', `${report.usage.memory.percentage.toFixed(1)}%`],
    ['Active Connections', report.usage.connections.active],
    ['Requests/min', report.usage.requests.perMinute]
  );

  console.log(chalk.cyan('\n=== System Overview ==='));
  console.log(overviewTable.toString());

  // Resource allocations
  const allocTable = new Table({
    head: ['Type', 'Count'],
    colWidths: [20, 20],
  });

  Object.entries(report.allocations.byType).forEach(([type, count]) => {
    allocTable.push([type, count]);
  });

  console.log(chalk.cyan('\n=== Resource Allocations ==='));
  console.log(allocTable.toString());

  // Memory details
  const memoryTable = new Table({
    head: ['Memory Metric', 'Value'],
    colWidths: [30, 50],
  });

  memoryTable.push(
    ['Heap Used', `${(report.memory.current.heapUsed / 1024 / 1024).toFixed(2)} MB`],
    ['Heap Total', `${(report.memory.current.heapTotal / 1024 / 1024).toFixed(2)} MB`],
    ['RSS', `${(report.memory.current.rss / 1024 / 1024).toFixed(2)} MB`],
    ['External', `${(report.memory.current.external / 1024 / 1024).toFixed(2)} MB`],
    ['Caches', report.memory.caches.length],
    ['Potential Leaks', report.memory.leaks.length]
  );

  console.log(chalk.cyan('\n=== Memory Details ==='));
  console.log(memoryTable.toString());
}

// Performance profiling
async function startProfiling(duration: number, outputFile?: string) {
  const spinner = ora(`Starting performance profiling for ${duration} seconds...`).start();

  const startTime = Date.now();
  const samples: any[] = [];

  const sampleInterval = setInterval(() => {
    const usage = resourceManager.getResourceUsage();
    const memoryProfile = memoryManager.getMemoryProfile();

    samples.push({
      timestamp: Date.now() - startTime,
      cpu: usage.cpu,
      memory: usage.memory,
      connections: usage.connections,
      requests: usage.requests,
      heap: memoryProfile.current,
    });
  }, 100); // Sample every 100ms

  setTimeout(async () => {
    clearInterval(sampleInterval);
    spinner.succeed('Profiling completed');

    const profile = {
      duration,
      samples,
      summary: calculateProfileSummary(samples),
    };

    if (outputFile) {
      const fs = await import('fs/promises');
      await fs.writeFile(outputFile, JSON.stringify(profile, null, 2));
      console.log(chalk.green(`Profile saved to ${outputFile}`));
    } else {
      displayProfileSummary(profile.summary);
    }

    process.exit(0);
  }, duration * 1000);
}

function calculateProfileSummary(samples: any[]): any {
  const cpuValues = samples.map((s) => s.cpu.percentage);
  const memoryValues = samples.map((s) => s.memory.percentage);
  const requestValues = samples.map((s) => s.requests.perMinute);

  return {
    cpu: {
      min: Math.min(...cpuValues),
      max: Math.max(...cpuValues),
      avg: cpuValues.reduce((a, b) => a + b, 0) / cpuValues.length,
    },
    memory: {
      min: Math.min(...memoryValues),
      max: Math.max(...memoryValues),
      avg: memoryValues.reduce((a, b) => a + b, 0) / memoryValues.length,
    },
    requests: {
      min: Math.min(...requestValues),
      max: Math.max(...requestValues),
      avg: requestValues.reduce((a, b) => a + b, 0) / requestValues.length,
    },
  };
}

function displayProfileSummary(summary: any) {
  const table = new Table({
    head: ['Metric', 'Min', 'Max', 'Average'],
    colWidths: [20, 15, 15, 15],
  });

  table.push(
    ['CPU %', summary.cpu.min.toFixed(1), summary.cpu.max.toFixed(1), summary.cpu.avg.toFixed(1)],
    [
      'Memory %',
      summary.memory.min.toFixed(1),
      summary.memory.max.toFixed(1),
      summary.memory.avg.toFixed(1),
    ],
    [
      'Requests/min',
      summary.requests.min.toFixed(0),
      summary.requests.max.toFixed(0),
      summary.requests.avg.toFixed(0),
    ]
  );

  console.log(chalk.cyan('\n=== Performance Profile Summary ==='));
  console.log(table.toString());
}

// Resource adjustment
async function adjustResources(options: any) {
  const spinner = ora('Adjusting resource limits...').start();

  try {
    const adjustments: string[] = [];

    if (options.maxMemory) {
      process.env.MAX_MEMORY_MB = options.maxMemory;
      adjustments.push(`Max memory: ${options.maxMemory} MB`);
    }

    if (options.maxConnections) {
      process.env.MAX_CONNECTIONS = options.maxConnections;
      adjustments.push(`Max connections: ${options.maxConnections}`);
    }

    if (options.maxRequests) {
      process.env.MAX_REQUESTS_PER_MINUTE = options.maxRequests;
      adjustments.push(`Max requests/min: ${options.maxRequests}`);
    }

    spinner.succeed('Resource limits adjusted');

    if (adjustments.length > 0) {
      console.log(chalk.green('\nAdjustments made:'));
      adjustments.forEach((a) => console.log(`  - ${a}`));
      console.log(chalk.yellow('\nNote: Some changes may require a restart to take effect.'));
    }
  } catch (_error) {
    spinner.fail(`Failed to adjust resources: ${_error`);
    process.exit(1);
  }
}

// Health check
async function checkHealth(verbose: boolean) {
  const spinner = ora('Checking system health...').start();

  try {
    const health = resourceManager.getHealthStatus();
    const usage = resourceManager.getResourceUsage();
    const memoryCheck = memoryManager.checkMemoryUsage();

    spinner.stop();

    // Display health status with appropriate color
    const statusColor =
if (      health === 'healthy') { return chalk.green; } else if (health === 'degraded') { return chalk.yellow; } else { return chalk.red; }

    console.log(`\nSystem Health: ${statusColor(health.toUpperCase())}`);

    if (verbose) {
      const table = new Table({
        head: ['Component', 'Status', 'Details'],
        colWidths: [20, 15, 45],
      });

      // CPU status
      const cpuStatus =
if (        usage.cpu.percentage < 60) { return 'OK'; } else if (usage.cpu.percentage < 80) { return 'WARNING'; } else { return 'CRITICAL'; }
      table.push([
        'CPU',
        cpuStatus,
        `${usage.cpu.percentage.toFixed(1)}% (${usage.cpu.cores} cores)`,
      ]);

      // Memory status
      table.push([
        'Memory',
        memoryCheck.status.toUpperCase(),
        `${memoryCheck.details.heapUsedPercent}% heap, ${memoryCheck.details.rss} RSS`,
      ]);

      // Connection status
      const connStatus = usage.connections.total < 80 ? 'OK' : 'WARNING';
      table.push([
        'Connections',
        connStatus,
        `${usage.connections.active} active, ${usage.connections.idle} idle`,
      ]);

      // Request rate status
      const reqStatus = usage.requests.perMinute < 800 ? 'OK' : 'WARNING';
      table.push(['Request Rate', reqStatus, `${usage.requests.perMinute}/min`]);

      console.log(`\n${table.toString()}`);
    }
  } catch (_error) {
    spinner.fail(`Health check failed: ${_error`);
    process.exit(1);
  }
}

// Memory management commands
async function forceGC() {
  const spinner = ora('Forcing garbage collection...').start();

  try {
    memoryManager.forceGC();
    spinner.succeed('Garbage collection completed');

    const usage = memoryManager.checkMemoryUsage();
    console.log(`Current memory usage: ${usage.details.heapUsedPercent}%`);
  } catch (_error) {
    spinner.fail(`Failed to force GC: ${_error`);
  }
}

async function takeHeapSnapshot() {
  const spinner = ora('Taking heap snapshot...').start();

  try {
    const filepath = await memoryManager.takeHeapSnapshot();
    spinner.succeed(`Heap snapshot saved to ${filepath}`);
  } catch (_error) {
    spinner.fail(`Failed to take heap snapshot: ${_error`);
  }
}

async function checkMemoryLeaks() {
  const spinner = ora('Checking for memory leaks...').start();

  try {
    const profile = memoryManager.getMemoryProfile();
    spinner.stop();

    if (profile.leaks.length === 0) {
      console.log(chalk.green('No memory leaks detected'));
    } else {
      console.log(chalk.yellow(`\nPotential memory leaks detected: ${profile.leaks.length}`));

      const table = new Table({
        head: ['Location', 'Growth Rate', 'Current Size', 'First Detected'],
        colWidths: [20, 15, 15, 25],
      });

      profile.leaks.forEach((leak: any) => {
        table.push([
          leak.id,
          `${(leak.growthRate * 100).toFixed(1)}%`,
          `${(leak.size / 1024 / 1024).toFixed(2)} MB`,
          new Date(leak.firstDetected).toLocaleString(),
        ]);
      });

      console.log(table.toString());
    }
  } catch (_error) {
    spinner.fail(`Failed to check for leaks: ${_error`);
  }
}

// Connection pool commands
async function showConnectionStatus(poolName: string) {
  const spinner = ora('Fetching connection pool status...').start();

  try {
    const status = connectionPoolManager.getPoolStatus(poolName);
    spinner.stop();

    console.log(chalk.cyan(`\n=== Connection Pool: ${poolName} ===\n`));

    // Supabase connections
    console.log(chalk.yellow('Supabase Connections:'));
    console.log(`  Total: ${status.supabase.total}`);
    console.log(`  Active: ${status.supabase.active}`);
    console.log(`  Idle: ${status.supabase.idle}`);
    console.log(`  Waiting: ${status.supabase.waiting}`);

    // Redis connections
    console.log(chalk.yellow('\nRedis Connections:'));
    console.log(`  Total: ${status.redis.total}`);
    console.log(`  Active: ${status.redis.active}`);
    console.log(`  Idle: ${status.redis.idle}`);
    console.log(`  Waiting: ${status.redis.waiting}`);

    // Connection details
    if (status.supabase.connections.length > 0 || status.redis.connections.length > 0) {
      const table = new Table({
        head: ['Type', 'ID', 'In Use', 'Use Count', 'Errors', 'Age (min)'],
        colWidths: [10, 20, 10, 12, 10, 12],
      });

      [
        ...status.supabase.connections.map((c: any) => ({ ...c, type: 'Supabase' })),
        ...status.redis.connections.map((c: any) => ({ ...c, type: 'Redis' })),
      ].forEach((conn) => {
        const age = (Date.now() - new Date(conn.createdAt).getTime()) / 60000;
        table.push([
          conn.type,
          `${conn.id.substring(0, 18)}...`,
          conn.inUse ? 'Yes' : 'No',
          conn.useCount.toString(),
          conn.errors.toString(),
          age.toFixed(1),
        ]);
      });

      console.log(`\n${table.toString()}`);
    }
  } catch (_error) {
    spinner.fail(`Failed to get connection status: ${_error`);
  }
}

async function resetConnectionPool(poolName: string) {
  const spinner = ora(`Resetting connection pool: ${poolName}...`).start();

  try {
    // This would require adding a reset method to the connection pool manager
    spinner.warn('Connection pool reset not yet implemented');
    console.log(chalk.yellow('Please restart the service to reset connection pools'));
  } catch (_error) {
    spinner.fail(`Failed to reset connection pool: ${_error`);
  }
}

// Parse arguments and run
program.parse(process.argv);

// If no command specified, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
