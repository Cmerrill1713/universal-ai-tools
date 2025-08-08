#!/usr/bin/env tsx

/**
 * Resource Monitor Script
 * 
 * Monitors system resource usage for the optimized Universal AI Tools server.
 * Provides real-time metrics and alerts for low-resource environments.
 */

import { performance } from 'perf_hooks';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface SystemMetrics {
  timestamp: string;
  memory: {
    total: number;
    used: number;
    free: number;
    percentage: number;
    nodeHeap: {
      used: number;
      total: number;
      percentage: number;
    };
  };
  cpu: {
    usage: number;
    load: number[];
  };
  disk: {
    usage: number;
    free: number;
  };
  network: {
    connections: number;
  };
  containers?: {
    [name: string]: {
      memory: number;
      cpu: number;
      status: string;
    };
  };
}

class ResourceMonitor {
  private interval: NodeJS.Timeout | null = null;
  private alerts: string[] = [];
  private readonly thresholds = {
    memory: 80,
    cpu: 75,
    disk: 85
  };

  constructor(private monitorInterval: number = 5000) {}

  public start(): void {
    console.log('🔍 Starting Resource Monitor for Universal AI Tools (Optimized)');
    console.log(`📊 Monitoring every ${this.monitorInterval / 1000} seconds`);
    console.log('🚨 Thresholds: Memory 80%, CPU 75%, Disk 85%\n');

    this.interval = setInterval(async () => {
      try {
        const metrics = await this.collectMetrics();
        this.displayMetrics(metrics);
        this.checkThresholds(metrics);
      } catch (error) {
        console.error('❌ Error collecting metrics:', error);
      }
    }, this.monitorInterval);

    // Graceful shutdown
    process.on('SIGINT', () => this.stop());
    process.on('SIGTERM', () => this.stop());
  }

  public stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    console.log('\n👋 Resource monitoring stopped');
    process.exit(0);
  }

  private async collectMetrics(): Promise<SystemMetrics> {
    const timestamp = new Date().toISOString();
    
    // Node.js memory usage
    const nodeMemory = process.memoryUsage();
    
    // System memory
    const systemMemory = await this.getSystemMemory();
    
    // CPU usage
    const cpuUsage = await this.getCpuUsage();
    
    // Disk usage
    const diskUsage = await this.getDiskUsage();
    
    // Network connections
    const networkConnections = await this.getNetworkConnections();
    
    // Container metrics (if running in Docker)
    const containerMetrics = await this.getContainerMetrics();

    return {
      timestamp,
      memory: {
        total: systemMemory.total,
        used: systemMemory.used,
        free: systemMemory.free,
        percentage: Math.round((systemMemory.used / systemMemory.total) * 100),
        nodeHeap: {
          used: Math.round(nodeMemory.heapUsed / 1024 / 1024),
          total: Math.round(nodeMemory.heapTotal / 1024 / 1024),
          percentage: Math.round((nodeMemory.heapUsed / nodeMemory.heapTotal) * 100)
        }
      },
      cpu: {
        usage: cpuUsage,
        load: process.platform !== 'win32' ? await this.getLoadAverage() : [0, 0, 0]
      },
      disk: diskUsage,
      network: {
        connections: networkConnections
      },
      containers: containerMetrics
    };
  }

  private async getSystemMemory(): Promise<{ total: number; used: number; free: number }> {
    try {
      if (process.platform === 'linux') {
        const { stdout } = await execAsync("free -m | grep '^Mem:'");
        const values = stdout.trim().split(/\s+/);
        return {
          total: parseInt(values[1]),
          used: parseInt(values[2]),
          free: parseInt(values[3])
        };
      } else if (process.platform === 'darwin') {
        const { stdout: totalMem } = await execAsync('sysctl -n hw.memsize');
        const { stdout: freeMem } = await execAsync('vm_stat | grep "Pages free"');
        
        const total = Math.round(parseInt(totalMem) / 1024 / 1024);
        const freePages = parseInt(freeMem.split(':')[1].trim().replace('.', ''));
        const free = Math.round((freePages * 4096) / 1024 / 1024);
        
        return {
          total,
          used: total - free,
          free
        };
      } else {
        // Windows fallback
        return { total: 8192, used: 4096, free: 4096 };
      }
    } catch (error) {
      return { total: 0, used: 0, free: 0 };
    }
  }

  private async getCpuUsage(): Promise<number> {
    try {
      if (process.platform === 'linux' || process.platform === 'darwin') {
        const { stdout } = await execAsync("top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | sed 's/%us,//' || echo '0'");
        return parseFloat(stdout.trim()) || 0;
      } else {
        // Windows fallback or estimate based on process
        const cpuUsage = process.cpuUsage();
        return Math.round((cpuUsage.user + cpuUsage.system) / 1000 / 10); // Rough estimate
      }
    } catch (error) {
      return 0;
    }
  }

  private async getLoadAverage(): Promise<number[]> {
    try {
      const { stdout } = await execAsync('uptime | grep -o "load average.*" | cut -d: -f2');
      const loads = stdout.trim().split(',').map(l => parseFloat(l.trim()));
      return loads.length >= 3 ? loads.slice(0, 3) : [0, 0, 0];
    } catch (error) {
      return [0, 0, 0];
    }
  }

  private async getDiskUsage(): Promise<{ usage: number; free: number }> {
    try {
      const { stdout } = await execAsync("df -h / | tail -1 | awk '{print $5 \" \" $4}'");
      const [usageStr, freeStr] = stdout.trim().split(' ');
      
      return {
        usage: parseInt(usageStr.replace('%', '')),
        free: this.parseSize(freeStr)
      };
    } catch (error) {
      return { usage: 0, free: 0 };
    }
  }

  private async getNetworkConnections(): Promise<number> {
    try {
      const { stdout } = await execAsync('netstat -an | grep ESTABLISHED | wc -l');
      return parseInt(stdout.trim()) || 0;
    } catch (error) {
      return 0;
    }
  }

  private async getContainerMetrics(): Promise<any> {
    try {
      const { stdout } = await execAsync('docker stats --no-stream --format "table {{.Name}}\t{{.MemUsage}}\t{{.CPUPerc}}\t{{.MemPerc}}" 2>/dev/null');
      const lines = stdout.trim().split('\n').slice(1); // Skip header
      
      const metrics: any = {};
      
      for (const line of lines) {
        const [name, memUsage, cpuPerc, memPerc] = line.split('\t');
        if (name && name.includes('universal-ai-tools')) {
          metrics[name] = {
            memory: parseFloat(memPerc.replace('%', '')),
            cpu: parseFloat(cpuPerc.replace('%', '')),
            status: 'running'
          };
        }
      }
      
      return Object.keys(metrics).length > 0 ? metrics : undefined;
    } catch (error) {
      return undefined;
    }
  }

  private parseSize(sizeStr: string): number {
    const size = parseFloat(sizeStr);
    const unit = sizeStr.slice(-1).toUpperCase();
    
    switch (unit) {
      case 'G': return Math.round(size * 1024);
      case 'M': return Math.round(size);
      case 'K': return Math.round(size / 1024);
      default: return size;
    }
  }

  private displayMetrics(metrics: SystemMetrics): void {
    console.clear();
    console.log('🚀 Universal AI Tools - Resource Monitor (Optimized)');
    console.log('═'.repeat(60));
    console.log(`⏰ ${new Date(metrics.timestamp).toLocaleString()}\n`);

    // Memory Section
    console.log('💾 MEMORY USAGE');
    console.log('─'.repeat(30));
    console.log(`System: ${metrics.memory.used}MB / ${metrics.memory.total}MB (${metrics.memory.percentage}%)`);
    console.log(`Node.js Heap: ${metrics.memory.nodeHeap.used}MB / ${metrics.memory.nodeHeap.total}MB (${metrics.memory.nodeHeap.percentage}%)`);
    console.log(this.getProgressBar(metrics.memory.percentage, 30));

    // CPU Section
    console.log('\n🔥 CPU USAGE');
    console.log('─'.repeat(30));
    console.log(`Current: ${metrics.cpu.usage.toFixed(1)}%`);
    if (metrics.cpu.load[0] !== 0) {
      console.log(`Load Average: ${metrics.cpu.load.map(l => l.toFixed(2)).join(', ')}`);
    }
    console.log(this.getProgressBar(metrics.cpu.usage, 30));

    // Disk Section
    console.log('\n💽 DISK USAGE');
    console.log('─'.repeat(30));
    console.log(`Usage: ${metrics.disk.usage}% (${metrics.disk.free}MB free)`);
    console.log(this.getProgressBar(metrics.disk.usage, 30));

    // Network Section
    console.log('\n🌐 NETWORK');
    console.log('─'.repeat(30));
    console.log(`Active Connections: ${metrics.network.connections}`);

    // Container Section
    if (metrics.containers) {
      console.log('\n🐳 CONTAINERS');
      console.log('─'.repeat(30));
      Object.entries(metrics.containers).forEach(([name, stats]) => {
        console.log(`${name}:`);
        console.log(`  Memory: ${stats.memory.toFixed(1)}%`);
        console.log(`  CPU: ${stats.cpu.toFixed(1)}%`);
      });
    }

    // Alerts Section
    if (this.alerts.length > 0) {
      console.log('\n🚨 ALERTS');
      console.log('─'.repeat(30));
      this.alerts.slice(-5).forEach(alert => console.log(`⚠️  ${alert}`));
    }

    // Recommendations
    console.log('\n💡 OPTIMIZATION STATUS');
    console.log('─'.repeat(30));
    this.showOptimizationRecommendations(metrics);
  }

  private getProgressBar(percentage: number, width: number): string {
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    
    let color = '';
    if (percentage > 85) color = '🟥';
    else if (percentage > 70) color = '🟨';
    else color = '🟩';
    
    return `[${color.repeat(filled)}${'⬜'.repeat(empty)}] ${percentage.toFixed(1)}%`;
  }

  private checkThresholds(metrics: SystemMetrics): void {
    const now = new Date().toLocaleTimeString();
    
    // Memory threshold
    if (metrics.memory.percentage > this.thresholds.memory) {
      const alert = `${now} - High memory usage: ${metrics.memory.percentage}%`;
      if (!this.alerts.includes(alert)) {
        this.alerts.push(alert);
      }
    }

    // CPU threshold
    if (metrics.cpu.usage > this.thresholds.cpu) {
      const alert = `${now} - High CPU usage: ${metrics.cpu.usage.toFixed(1)}%`;
      if (!this.alerts.includes(alert)) {
        this.alerts.push(alert);
      }
    }

    // Disk threshold
    if (metrics.disk.usage > this.thresholds.disk) {
      const alert = `${now} - High disk usage: ${metrics.disk.usage}%`;
      if (!this.alerts.includes(alert)) {
        this.alerts.push(alert);
      }
    }

    // Node.js heap threshold
    if (metrics.memory.nodeHeap.percentage > 85) {
      const alert = `${now} - High Node.js heap usage: ${metrics.memory.nodeHeap.percentage}%`;
      if (!this.alerts.includes(alert)) {
        this.alerts.push(alert);
      }
    }

    // Keep only recent alerts
    if (this.alerts.length > 20) {
      this.alerts = this.alerts.slice(-10);
    }
  }

  private showOptimizationRecommendations(metrics: SystemMetrics): void {
    const recommendations = [];

    if (metrics.memory.percentage > 80) {
      recommendations.push('Consider reducing cache sizes or increasing swap');
    }

    if (metrics.memory.nodeHeap.percentage > 80) {
      recommendations.push('Node.js heap usage high - consider restarting server');
    }

    if (metrics.cpu.usage > 70) {
      recommendations.push('High CPU usage - consider scaling horizontally');
    }

    if (metrics.network.connections > 100) {
      recommendations.push('High connection count - check for connection leaks');
    }

    if (recommendations.length === 0) {
      console.log('✅ System performance is optimal');
    } else {
      recommendations.forEach(rec => console.log(`📋 ${rec}`));
    }
  }
}

// CLI Interface
const monitor = new ResourceMonitor(5000); // Monitor every 5 seconds

// Handle command line arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
🔍 Universal AI Tools Resource Monitor

Usage: npm run monitor:resources [options]

Options:
  --interval <ms>    Monitoring interval in milliseconds (default: 5000)
  --help, -h         Show this help message

Examples:
  npm run monitor:resources
  npm run monitor:resources -- --interval 10000
  `);
  process.exit(0);
}

// Parse interval argument
const intervalIndex = args.indexOf('--interval');
if (intervalIndex !== -1 && args[intervalIndex + 1]) {
  const customInterval = parseInt(args[intervalIndex + 1]);
  if (!isNaN(customInterval) && customInterval >= 1000) {
    monitor.stop();
    const customMonitor = new ResourceMonitor(customInterval);
    customMonitor.start();
  } else {
    console.error('❌ Invalid interval. Must be a number >= 1000ms');
    process.exit(1);
  }
} else {
  monitor.start();
}