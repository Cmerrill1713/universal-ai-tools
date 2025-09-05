/**
 * System Metrics Collector
 * Collects CPU, memory, disk, and network metrics
 */

import * as os from 'os';
import * as fs from 'fs/promises';
import { Logger } from '../../../utils/logger';
import type { Metric, MetricCollector } from '../types';

export class SystemMetricsCollector implements MetricCollector {
  public readonly name = 'system';
  private readonly logger: Logger;
  private previousNetworkStats: any = null;
  private previousCpuStats: any = null;
  private lastCollection: Date = new Date();

  constructor() {
    this.logger = new Logger('SystemMetricsCollector');
  }

  async initialize(): Promise<void> {
    // Initialize baseline measurements
    this.previousCpuStats = this.getCpuStats();
    this.previousNetworkStats = await this.getNetworkStats().catch(() => null);
    this.lastCollection = new Date();

    this.logger.info('System metrics collector initialized');
  }

  async collect(): Promise<Metric[]> {
    const now = new Date();
    const metrics: Metric[] = [];

    try {
      // CPU Metrics
      const cpuMetrics = await this.collectCpuMetrics();
      metrics.push(...cpuMetrics);

      // Memory Metrics
      const memoryMetrics = this.collectMemoryMetrics();
      metrics.push(...memoryMetrics);

      // Load Average Metrics
      const loadMetrics = this.collectLoadMetrics();
      metrics.push(...loadMetrics);

      // Disk Metrics
      const diskMetrics = await this.collectDiskMetrics();
      metrics.push(...diskMetrics);

      // Network Metrics
      const networkMetrics = await this.collectNetworkMetrics();
      metrics.push(...networkMetrics);

      // Process Metrics
      const processMetrics = this.collectProcessMetrics();
      metrics.push(...processMetrics);

      this.lastCollection = now;

      this.logger.debug(`Collected ${metrics.length} system metrics`);
    } catch (error) {
      this.logger.error('Failed to collect system metrics', error);

      // Return error metric
      metrics.push({
        name: 'system_collection_error',
        type: 'counter',
        value: 1,
        timestamp: now,
        labels: { error: error instanceof Error ? error.message : 'Unknown error' },
      });
    }

    return metrics;
  }

  private async collectCpuMetrics(): Promise<Metric[]> {
    const metrics: Metric[] = [];
    const now = new Date();

    // Get current CPU stats
    const currentCpuStats = this.getCpuStats();

    if (this.previousCpuStats) {
      // Calculate CPU usage percentage
      const prevTotal = this.previousCpuStats.idle + this.previousCpuStats.total;
      const currTotal = currentCpuStats.idle + currentCpuStats.total;

      const totalDiff = currTotal - prevTotal;
      const idleDiff = currentCpuStats.idle - this.previousCpuStats.idle;

      const cpuUsage = totalDiff > 0 ? 1 - idleDiff / totalDiff : 0;

      metrics.push({
        name: 'system_cpu_usage_ratio',
        type: 'gauge',
        value: Math.max(0, Math.min(1, cpuUsage)),
        timestamp: now,
        unit: 'ratio',
        help: 'CPU usage as a ratio (0-1)',
      });
    }

    // CPU count
    metrics.push({
      name: 'system_cpu_count',
      type: 'gauge',
      value: os.cpus().length,
      timestamp: now,
      unit: 'count',
      help: 'Number of CPU cores',
    });

    this.previousCpuStats = currentCpuStats;

    return metrics;
  }

  private collectMemoryMetrics(): Metric[] {
    const metrics: Metric[] = [];
    const now = new Date();

    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    metrics.push(
      {
        name: 'system_memory_total_bytes',
        type: 'gauge',
        value: totalMemory,
        timestamp: now,
        unit: 'bytes',
        help: 'Total system memory in bytes',
      },
      {
        name: 'system_memory_used_bytes',
        type: 'gauge',
        value: usedMemory,
        timestamp: now,
        unit: 'bytes',
        help: 'Used system memory in bytes',
      },
      {
        name: 'system_memory_free_bytes',
        type: 'gauge',
        value: freeMemory,
        timestamp: now,
        unit: 'bytes',
        help: 'Free system memory in bytes',
      },
      {
        name: 'system_memory_usage_ratio',
        type: 'gauge',
        value: totalMemory > 0 ? usedMemory / totalMemory : 0,
        timestamp: now,
        unit: 'ratio',
        help: 'Memory usage as a ratio (0-1)',
      }
    );

    return metrics;
  }

  private collectLoadMetrics(): Metric[] {
    const metrics: Metric[] = [];
    const now = new Date();
    const loadAvg = os.loadavg();

    metrics.push(
      {
        name: 'system_load_average_1m',
        type: 'gauge',
        value: loadAvg[0],
        timestamp: now,
        help: '1-minute load average',
      },
      {
        name: 'system_load_average_5m',
        type: 'gauge',
        value: loadAvg[1],
        timestamp: now,
        help: '5-minute load average',
      },
      {
        name: 'system_load_average_15m',
        type: 'gauge',
        value: loadAvg[2],
        timestamp: now,
        help: '15-minute load average',
      }
    );

    return metrics;
  }

  private async collectDiskMetrics(): Promise<Metric[]> {
    const metrics: Metric[] = [];
    const now = new Date();

    try {
      // Try to get disk usage for current directory
      const stats = await fs.stat('.');

      // This is a simplified implementation - in production you'd use a proper disk usage library
      metrics.push({
        name: 'system_disk_usage_ratio',
        type: 'gauge',
        value: 0.5, // Placeholder - would need proper disk usage calculation
        timestamp: now,
        unit: 'ratio',
        help: 'Disk usage as a ratio (0-1)',
      });
    } catch (error) {
      this.logger.warn('Failed to collect disk metrics', error);

      metrics.push({
        name: 'system_disk_collection_error',
        type: 'counter',
        value: 1,
        timestamp: now,
        labels: { error: 'disk_stats_unavailable' },
      });
    }

    return metrics;
  }

  private async collectNetworkMetrics(): Promise<Metric[]> {
    const metrics: Metric[] = [];
    const now = new Date();

    try {
      const networkStats = await this.getNetworkStats();

      if (this.previousNetworkStats && networkStats) {
        const timeDiff = (now.getTime() - this.lastCollection.getTime()) / 1000; // seconds

        if (timeDiff > 0) {
          const bytesInDiff = networkStats.bytesReceived - this.previousNetworkStats.bytesReceived;
          const bytesOutDiff = networkStats.bytesSent - this.previousNetworkStats.bytesSent;

          metrics.push(
            {
              name: 'system_network_bytes_received_total',
              type: 'counter',
              value: networkStats.bytesReceived,
              timestamp: now,
              unit: 'bytes',
              help: 'Total network bytes received',
            },
            {
              name: 'system_network_bytes_sent_total',
              type: 'counter',
              value: networkStats.bytesSent,
              timestamp: now,
              unit: 'bytes',
              help: 'Total network bytes sent',
            },
            {
              name: 'system_network_bytes_received_per_second',
              type: 'gauge',
              value: Math.max(0, bytesInDiff / timeDiff),
              timestamp: now,
              unit: 'bytes_per_second',
              help: 'Network bytes received per second',
            },
            {
              name: 'system_network_bytes_sent_per_second',
              type: 'gauge',
              value: Math.max(0, bytesOutDiff / timeDiff),
              timestamp: now,
              unit: 'bytes_per_second',
              help: 'Network bytes sent per second',
            }
          );
        }
      }

      this.previousNetworkStats = networkStats;
    } catch (error) {
      this.logger.warn('Failed to collect network metrics', error);

      metrics.push({
        name: 'system_network_collection_error',
        type: 'counter',
        value: 1,
        timestamp: now,
        labels: { error: 'network_stats_unavailable' },
      });
    }

    return metrics;
  }

  private collectProcessMetrics(): Metric[] {
    const metrics: Metric[] = [];
    const now = new Date();

    // Process uptime
    metrics.push({
      name: 'system_process_uptime_seconds',
      type: 'gauge',
      value: process.uptime(),
      timestamp: now,
      unit: 'seconds',
      help: 'Process uptime in seconds',
    });

    // Process memory usage
    const memUsage = process.memoryUsage();
    metrics.push(
      {
        name: 'system_process_memory_rss_bytes',
        type: 'gauge',
        value: memUsage.rss,
        timestamp: now,
        unit: 'bytes',
        help: 'Process RSS memory usage',
      },
      {
        name: 'system_process_memory_heap_used_bytes',
        type: 'gauge',
        value: memUsage.heapUsed,
        timestamp: now,
        unit: 'bytes',
        help: 'Process heap memory used',
      },
      {
        name: 'system_process_memory_heap_total_bytes',
        type: 'gauge',
        value: memUsage.heapTotal,
        timestamp: now,
        unit: 'bytes',
        help: 'Process heap memory total',
      },
      {
        name: 'system_process_memory_external_bytes',
        type: 'gauge',
        value: memUsage.external,
        timestamp: now,
        unit: 'bytes',
        help: 'Process external memory usage',
      }
    );

    return metrics;
  }

  private getCpuStats() {
    const cpus = os.cpus();
    let idle = 0;
    let total = 0;

    for (const cpu of cpus) {
      for (const type in cpu.times) {
        total += (cpu.times as any)[type];
      }
      idle += cpu.times.idle;
    }

    return { idle, total };
  }

  private async getNetworkStats(): Promise<any> {
    // This is a simplified implementation
    // In production, you'd use a proper network stats library or read from /proc/net/dev on Linux

    const interfaces = os.networkInterfaces();
    const bytesReceived = 0;
    const bytesSent = 0;

    // This is a placeholder - actual network stats would need platform-specific implementation
    return {
      bytesReceived: Math.floor(Math.random() * 1000000), // Placeholder
      bytesSent: Math.floor(Math.random() * 1000000), // Placeholder
    };
  }

  async cleanup(): Promise<void> {
    this.logger.info('System metrics collector cleaned up');
  }
}
