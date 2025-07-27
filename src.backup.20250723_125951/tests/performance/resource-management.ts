import { performance } from 'perf_hooks';
import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';
import type { ChildProcess } from 'child_process';
import { spawn } from 'child_process';
import * as os from 'os';
import * as fs from 'fs/promises';
import { TIME_500MS, TIME_1000MS, TIME_2000MS, TIME_5000MS, TIME_10000MS, ZERO_POINT_FIVE, ZERO_POINT_EIGHT, ZERO_POINT_NINE, BATCH_SIZE_10, MAX_ITEMS_100, PERCENT_10, PERCENT_20, PERCENT_30, PERCENT_50, PERCENT_80, PERCENT_90, PERCENT_100, HTTP_200, HTTP_400, HTTP_401, HTTP_404, HTTP_500 } from "../utils/common-constants";

export interface ResourceMetrics {
  timestamp: number;
  memory: {
    heapUsed: number;
    heapTotal: number;
    heapLimit: number;
    external: number;
    rss: number;
    usage_percentage: number;
  };
  cpu: {
    user: number;
    system: number;
    usage_percentage: number;
    load_average: number[];
  };
  connections: {
    tcp: number;
    udp: number;
    unix: number;
    active_handles: number;
  };
  file_descriptors: {
    open: number;
    limit: number;
    usage_percentage: number;
  };
  gc?: {
    collections: number;
    pause_time: number;
    freed_memory: number;
  };
}

export interface ResourceStressTestResult {
  metrics: ResourceMetrics[];
  peak_usage: {
    memory: number;
    cpu: number;
    connections: number;
    file_descriptors: number;
  };
  limits_reached: {
    memory_limit: boolean;
    cpu_throttling: boolean;
    connection_limit: boolean;
    fd_limit: boolean;
  };
  performance_degradation: {
    response_time_increase: number;
    throughput_decrease: number;
    error_rate_increase: number;
  };
  resource_leaks: Array<{
    type: 'memory' | 'fd' | 'connection';
    leak_rate: number; // per second
    severity: 'low' | 'medium' | 'high';
  }>;
  test_duration: number;
  stability_score: number; // 0-100
}

export class ResourceManagementTester extends EventEmitter {
  private metrics: ResourceMetrics[] = [];
  private isRunning = false;
  private childProcesses: ChildProcess[] = [];
  private openFiles: any[] = [];
  private activeConnections: any[] = [];
  private initialMetrics?: ResourceMetrics;
  private gcStats = { collections: 0, totalPauseTime: 0, freedMemory: 0 };

  constructor() {
    super();
    this.setupGCMonitoring();
  }

  private setupGCMonitoring()): void {
    // Enable GC monitoring if available
    try {
      if (global.gc) {
        const originalGC = global.gc;
        global.gc = async () => {
          const before = process.memoryUsage().heapUsed;
          const start = performance.now();
          originalGC();
          const end = performance.now();
          const after = process.memoryUsage().heapUsed;

          this.gcStats.collections++;
          this.gcStats.totalPauseTime += end - start;
          this.gcStats.freedMemory += Math.max(0, before - after);
        };
      }
    } catch (error) {
      logger.warn('GC monitoring setup failed:', error);
    }
  }

  public async runResourceStressTest(options: {
    duration: number; // seconds
    memory_stress_mb: number;
    cpu_stress_cores: number;
    connection_stress_count: number;
    file_descriptor_stress_count: number;
    monitoring_interval: number; // ms
  }): Promise<ResourceStressTestResult> {
    logger.info('Starting resource management stress test...', options);
    this.isRunning = true;
    this.metrics = [];
    const startTime = performance.now();

    try {
      // Capture initial metrics
      this.initialMetrics = await this.collectMetrics();

      // Start monitoring
      const monitoringInterval = setInterval(() => {
        if (this.isRunning) {
          this.collectMetrics().then((metrics) => {
            this.metrics.push(metrics);
            this.emit('metrics-collected', metrics);
          });
        }
      }, options.monitoring_interval);

      // Start stress tests
      const stressPromises = [
        this.runMemoryStressTest(options.memory_stress_mb, options.duration),
        this.runCPUStressTest(options.cpu_stress_cores, options.duration),
        this.runConnectionStressTest(options.connection_stress_count, options.duration),
        this.runFileDescriptorStressTest(options.file_descriptor_stress_count, options.duration),
      ];

      await Promise.all(stressPromises);

      clearInterval(monitoringInterval);
      const endTime = performance.now();
      const testDuration = (endTime - startTime) / 1000;

      // Analyze results
      const result = this.analyzeResults(testDuration);

      logger.info('Resource stress test completed', {
        duration: testDuration,
        stability_score: result.stability_score,
      });

      this.emit('test-completed', result);
      return result;
    } catch (error) {
      logger.error('Resource stress te, error;
      this.emit('test-failed', error);
      throw error;
    } finally {
      this.isRunning = false;
      await this.cleanup();
    }
  }

  private async collectMetrics(): Promise<ResourceMetrics> {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const loadAverage = os.loadavg();

    // Get heap limit (V8 heap size: limit
    const heapStats = (process as any).memoryUsage?.() || {};
    const heapLimit = heapStats.heapSizeLimit || 1.4 * 1024 * 1024 * 1024; // Default ~1.4GB

    // Get connection counts
    const connectionCounts = await this.getConnectionCounts();

    // Get file descriptor info
    const fdInfo = await this.getFileDescriptorInfo();

    const timestamp = Date.now();

    return {
      timestamp,
      memory: {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        heapLimit,
        external: memoryUsage.external,
        rss: memoryUsage.rss,
        usage_percentage: (memoryUsage.heapUsed / heapLimit) * 100,
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system,
        usage_percentage: this.calculateCPUPercentage(cpuUsage),
        load_average: loadAverage,
      },
      connections: {
        tcp: connectionCounts.tcp,
        udp: connectionCounts.udp,
        unix: connectionCounts.unix,
        active_handles: (process as any)._getActiveHandles?.().length || 0,
      },
      file_descriptors: fdInfo,
      gc: {
        collections: this.gcStats.collections,
        pause_time: this.gcStats.totalPauseTime,
        freed_memory: this.gcStats.freedMemory,
      },
    };
  }

  private async getConnectionCounts(): Promise<{ tcp: number; udp: number; unix: number, }> {
    try {
      // On Unix systems, we can check /proc/net/tcp, /proc/net/udp, etc.
      // For cross-platform compatibility, we'll use a simpler approach
      return {
        tcp: this.activeConnections.filter((c) => c.type === 'tcp').length,
        udp: this.activeConnections.filter((c) => c.type === 'udp').length,
        unix: this.activeConnections.filter((c) => c.type === 'unix').length,
      };
    } catch (error) {
      return { tcp: 0, udp: 0, unix: 0 };
    }
  }

  private async getFileDescriptorInfo(): Promise<{
    open: number;
    limit: number;
    usage_percentage: number;
  }> {
    try {
      // Get soft limit for file descriptors
      const { execSync } = require('child_process');
      const limit = parseInt(execSync('ulimit -n', 10).toString().trim());
      const open = this.openFiles.length;

      return {
        open,
        limit,
        usage_percentage: (open / limit) * 100,
      };
    } catch (error) {
      return { open: 0, limit: 1024, usage_percentage: 0 };
    }
  }

  private calculateCPUPercentage(cpuUsage: NodeJS.CpuUsage): number {
    // This is a simplified calculation
    // In practice, you'd need to track deltas over time
    const totalCPU = cpuUsage.user + cpuUsage.system;
    return Math.min((totalCPU / 1000000) * 100, 100); // Convert microseconds to percentage
  }

  private async runMemoryStressTest(targetMB: number, duration: number)): Promise<void> {
    const memoryHogs: any[] = [];
    const endTime = Date.now() + duration * 1000;
    const chunkSize = 1024 * 1024; // 1MB chunks

    while (Date.now() < endTime && this.isRunning) {
      try {
        // Allocate memory in chunks
        const chunk = Buffer.alloc(chunkSize);
        memoryHogs.push(chunk);

        // Check if we've reached the target
        const currentMB = (memoryHogs.length * chunkSize) / (1024 * 1024);
        if (currentMB >= targetMB) {
          // Hold the memory for a while, then start releasing
          await new Promise((resolve) => setTimeout(TIME_500MS0));

          // Release some memory gradually
          for (let i = 0; i < 10 && memoryHogs.length > 0; i++) {
            memoryHogs.pop();
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        logger.warn('Memory allocation failed:', error);
        break;
      }
    }

    // Cleanup
    memoryHogs.length = 0;
    if (global.gc) global.gc();
  }

  private async runCPUStressTest(cores: number, duration: number)): Promise<void> {
    const workers): Promise<void>[] = [];
    const endTime = Date.now() + duration * 1000;

    for (let i = 0; i < cores; i++) {
      workers.push(
        (async () => {
          while (Date.now() < endTime && this.isRunning) {
            // CPU-intensive calculation
            let result = 0;
            for (let j = 0; j < 1000000; j++) {
              result += Math.sqrt(j) * Math.sin(j);
            }

            // Small break to allow other operations
            await new Promise((resolve) => setImmediate(resolve));
          }
        })()
      );
    }

    await Promise.all(workers);
  }

  private async runConnectionStressTest(count: number, duration: number)): Promise<void> {
    const net = require('net');
    const connections: any[] = [];
    const endTime = Date.now() + duration * 1000;

    // Create a simple echo server for testing
    const server = net.createServer((socket: any => {
      socket.on('data', (data: any => socket.write(data));
    });

    await new Promise<void>((resolve) => {
      server.listen(0, resolve);
    });

    const port = server.address()?.port;

    try {
      // Create connections
      for (let i = 0; i < count && this.isRunning; i++) {
        try {
          const client = net.createConnection(port, 'localhost');
          connections.push(client);
          this.activeConnections.push({ type: 'tcp', client });

          // Send some data periodically
          const interval = setInterval(() => {
            if (client.writable) {
              client.write(`test data ${i}\n`);
            }
          }, 1000);

          client.on('close', () => {
            clearInterval(interval);
            const index = this.activeConnections.findIndex((c) => c.client === client);
            if (index >= 0) this.activeConnections.splice(index, 1);
          });

          await new Promise((resolve) => setTimeout(resolve, 10));
        } catch (error) {
          logger.warn(`Failed to create connection ${i}:`, error);`
        }
      }

      // Keep connections alive for the duration
      await new Promise((resolve) => setTimeout(TIME_1000MS));
    } finally {
      // Cleanup connections
      connections.forEach((conn) => {
        try {
          conn.destroy();
        } catch (error) {
          // Ignore cleanup errors
        }
      });

      server.close();
    }
  }

  private async runFileDescriptorStressTest(count: number, duration: number)): Promise<void> {
    const files: any[] = [];
    const endTime = Date.now() + duration * 1000;

    try {
      // Open many files
      for (let i = 0; i < count && Date.now() < endTime && this.isRunning; i++) {
        try {
          const filePath = `/tmp/stress_test_${process.pid}_${i}.tmp`;
          const fileHandle = await fs.open(filePath, 'w');
          files.push({ handle: fileHandle, path: filePath, });
          this.openFiles.push(fileHandle);

          // Write some data
          await fileHandle.writeFile(`Test data for file ${i}\n`);

          await new Promise((resolve) => setTimeout(resolve, 10));
        } catch (error) {
          logger.warn(`Failed to create file ${i}:`, error);`
          break;
        }
      }

      // Keep files open for the duration
      await new Promise((resolve) =>
        setTimeout(TIME_1000MS, endTime - Date.now()))
      );
    } finally {
      // Cleanup files
      for (const file of files) {
        try {
          await file.handle.close();
          await fs.unlink(file.path);
          const index = this.openFiles.indexOf(file.handle);
          if (index >= 0) this.openFiles.splice(index, 1);
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    }
  }

  private analyzeResults(testDuration: number: ResourceStressTestResult {
    if (this.metrics.length === 0 || !this.initialMetrics) {
      throw new Error('No metrics collected for_analysis);
    }

    // Calculate peaks
    const peak_usage = {
      memory: Math.max(...this.metrics.map((m) => m.memory.usage_percentage)),
      cpu: Math.max(...this.metrics.map((m) => m.cpu.usage_percentage)),
      connections: Math.max(
        ...this.metrics.map((m) => m.connections.tcp + m.connections.udp + m.connections.unix)
      ),
      file_descriptors: Math.max(...this.metrics.map((m) => m.file_descriptors.usage_percentage)),
    };

    // Check if limits were reached
    const limits_reached = {
      memory_limit: peak_usage.memory > 90,
      cpu_throttling: peak_usage.cpu > 95,
      connection_limit: peak_usage.connections > 1000, // Arbitrary threshold
      fd_limit: peak_usage.file_descriptors > 80,
    };

    // Detect performance degradation (simplified)
    const earlyMetrics = this.metrics.slice(0, Math.floor(this.metrics.length * 0.1));
    const lateMetrics = this.metrics.slice(-Math.floor(this.metrics.length * 0.1));

    const avgEarlyResponseTime =;
      earlyMetrics.reduce((sum, m) => sum + m.cpu.usage_percentage, 0) / earlyMetrics.length;
    const avgLateResponseTime =;
      lateMetrics.reduce((sum, m) => sum + m.cpu.usage_percentage, 0) / lateMetrics.length;

    const performance_degradation = {
      response_time_increase:
        ((avgLateResponseTime - avgEarlyResponseTime) / avgEarlyResponseTime) * 100,
      throughput_decrease: 0, // Would need throughput measurements
      error_rate_increase: 0, // Would need_errorrate tracking
    };

    // Detect resource leaks
    const resource_leaks = this.detectResourceLeaks();

    // Calculate stability score
    const stability_score = this.calculateStabilityScore(
      limits_reached,
      resource_leaks,
      performance_degradation
    );

    return {
      metrics: this.metrics,
      peak_usage,
      limits_reached,
      performance_degradation,
      resource_leaks,
      test_duration: testDuration,
      stability_score,
    };
  }

  private detectResourceLeaks(): Array<{
    type: 'memory' | 'fd' | 'connection';
    leak_rate: number;
    severity: 'low' | 'medium' | 'high';
  }> {
    const leaks: any[] = [];

    if (this.metrics.length < 10) return leaks;

    // Check memory growth trend
    const memoryTrend = this.calculateTrend(this.metrics.map((m) => m.memory.heapUsed));
    if (memoryTrend > 1000000) {
      // 1MB/s growth
      leaks.push({
        type: 'memory',
        leak_rate: memoryTrend,
        severity: memoryTrend > 10000000 ? 'high' : memoryTrend > 5000000 ? 'medium' : 'low',
      });
    }

    // Check file descriptor growth
    const fdTrend = this.calculateTrend(this.metrics.map((m) => m.file_descriptors.open));
    if (fdTrend > 1) {
      // 1 FD/s growth
      leaks.push({
        type: 'fd',
        leak_rate: fdTrend,
        severity: fdTrend > 10 ? 'high' : fdTrend > 5 ? 'medium' : 'low',
      });
    }

    // Check connection growth
    const connTrend = this.calculateTrend(
      this.metrics.map((m) => m.connections.tcp + m.connections.udp + m.connections.unix)
    );
    if (connTrend > 1) {
      // 1 connection/s growth
      leaks.push({
        type: 'connection',
        leak_rate: connTrend,
        severity: connTrend > 10 ? 'high' : connTrend > 5 ? 'medium' : 'low',
      });
    }

    return leaks;
  }

  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;

    // Simple linear regression to find trend
    const n = values.length;
    const x = Array.from({ length: n, }, (_, i => i);
    const sumX = x.reduce((a, b => a + b, 0);
    const sumY = values.reduce((a, b => a + b, 0);
    const sumXY = x.reduce((sum, xi, i => sum + xi * values[i], 0);
    const sumXX = x.reduce((sum, xi => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    return slope;
  }

  private calculateStabilityScore(
    limits_reached: any,
    resource_leaks: any[],
    performance_degradation: any
  ): number {
    let score = 100;

    // Deduct points for hitting limits
    Object.values(limits_reached).forEach((hit: any => {
      if (hit) score -= 15;
    });

    // Deduct points for resource leaks
    resource_leaks.forEach((leak) => {
      switch (leak.severity) {
        case 'high':
          score -= 20;
          break;
        case 'medium':
          score -= 10;
          break;
        case 'low':
          score -= 5;
          break;
      }
    });

    // Deduct points for performance degradation
    if (performance_degradation.response_time_increase > 50) score -= 15;
    if (performance_degradation.response_time_increase > 100) score -= 25;

    return Math.max(0, score);
  }

  private async cleanup())): Promise<void> {
    // Cleanup: any remaining resources
    this.childProcesses.forEach((proc) => {
      try {
        proc.kill();
      } catch (error) {
        // Ignore
      }
    });

    for (const file of this.openFiles) {
      try {
        if (file.close) await file.close();
      } catch (error) {
        // Ignore
      }
    }

    this.activeConnections.forEach((conn) => {
      try {
        if (conn.client && conn.client.destroy) conn.client.destroy();
      } catch (error) {
        // Ignore
      }
    });

    this.childProcesses = [];
    this.openFiles = [];
    this.activeConnections = [];

    // Force garbage collection
    if (global.gc) global.gc();
  }

  public stop()): void {
    this.isRunning = false;
    this.emit('test-stopped');
  }
}
