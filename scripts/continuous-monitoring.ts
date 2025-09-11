#!/usr/bin/env tsx

/**
 * Continuous Monitoring System for Universal AI Tools
 * Real-time monitoring of system health, performance, and AI/ML metrics
 */

import { performance } from 'perf_hooks';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';
import chalk from 'chalk';

interface MonitoringMetrics {
  timestamp: string;
  system: {
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    uptime: number;
  };
  application: {
    healthStatus: 'healthy' | 'degraded' | 'unhealthy';
    activeConnections: number;
    responseTime: number;
    errorRate: number;
  };
  database: {
    connectionCount: number;
    queryTime: number;
    cacheHitRate: number;
  };
  ai: {
    modelsActive: number;
    avgResponseTime: number;
    successRate: number;
    queueLength: number;
  };
  security: {
    suspiciousActivities: number;
    failedAuthAttempts: number;
    rateLimitHits: number;
  };
}

interface Alert {
  id: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  timestamp: string;
  metric: string;
  value: number;
  threshold: number;
}

class ContinuousMonitor {
  private metrics: MonitoringMetrics[] = [];
  private alerts: Alert[] = [];
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  
  private thresholds = {
    system: {
      cpuUsage: 80, // %
      memoryUsage: 85, // %
      diskUsage: 90, // %
    },
    application: {
      responseTime: 2000, // ms
      errorRate: 5, // %
    },
    database: {
      queryTime: 1000, // ms
      connectionCount: 100,
    },
    ai: {
      responseTime: 10000, // ms
      successRate: 90, // %
      queueLength: 50,
    },
    security: {
      suspiciousActivities: 10,
      failedAuthAttempts: 20,
      rateLimitHits: 100,
    }
  };
  
  constructor() {
    this.setupDirectories();
  }
  
  private setupDirectories(): void {
    const dirs = ['monitoring-logs', 'monitoring-reports', 'monitoring-alerts'];
    dirs.forEach(dir => {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    });
  }
  
  /**
   * Start continuous monitoring
   */
  start(intervalMs = 30000): void { // Default: 30 seconds
    if (this.isRunning) {
      console.log(chalk.yellow('⚠️ Monitoring is already running'));
      return;
    }
    
    console.log(chalk.green('🚀 Starting continuous monitoring...'));
    console.log(chalk.gray(`📊 Monitoring interval: ${intervalMs / 1000}s`));
    
    this.isRunning = true;
    
    // Initial metrics collection
    this.collectMetrics();
    
    // Set up recurring monitoring
    this.intervalId = setInterval(() => {
      this.collectMetrics();
    }, intervalMs);
    
    // Set up graceful shutdown
    process.on('SIGINT', () => this.stop());
    process.on('SIGTERM', () => this.stop());
  }
  
  /**
   * Stop continuous monitoring
   */
  stop(): void {
    if (!this.isRunning) return;
    
    console.log(chalk.yellow('\n🛑 Stopping continuous monitoring...'));
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    this.isRunning = false;
    this.generateFinalReport();
    
    console.log(chalk.green('✅ Monitoring stopped successfully'));
  }
  
  /**
   * Collect all monitoring metrics
   */
  private async collectMetrics(): Promise<void> {
    const startTime = performance.now();
    
    try {
      const metrics: MonitoringMetrics = {
        timestamp: new Date().toISOString(),
        system: await this.collectSystemMetrics(),
        application: await this.collectApplicationMetrics(),
        database: await this.collectDatabaseMetrics(),
        ai: await this.collectAIMetrics(),
        security: await this.collectSecurityMetrics()
      };
      
      this.metrics.push(metrics);
      this.checkThresholds(metrics);
      this.logMetrics(metrics);
      
      // Keep only last 1000 metrics to prevent memory issues
      if (this.metrics.length > 1000) {
        this.metrics = this.metrics.slice(-1000);
      }
      
      const collectionTime = performance.now() - startTime;
      if (collectionTime > 5000) { // Warn if collection takes > 5s
        console.log(chalk.yellow(`⚠️ Slow metrics collection: ${collectionTime.toFixed(2)}ms`));
      }
      
    } catch (error) {
      console.error(chalk.red(`❌ Metrics collection error: ${error.message}`));
      this.createAlert('critical', 'Metrics collection failed', 'collection_error', 0, 0);
    }
  }
  
  /**
   * Collect system-level metrics
   */
  private async collectSystemMetrics(): Promise<MonitoringMetrics['system']> {
    try {
      // CPU Usage
      const cpuInfo = await this.executeCommand("top -l 1 -n 0 | grep 'CPU usage' | awk '{print $3}' | sed 's/%//'").catch(() => '0');
      const cpuUsage = parseFloat(cpuInfo) || 0;
      
      // Memory Usage
      const memInfo = process.memoryUsage();
      const totalMemory = 8 * 1024 * 1024 * 1024; // Assume 8GB, could be dynamic
      const memoryUsage = (memInfo.rss / totalMemory) * 100;
      
      // Disk Usage
      const diskInfo = await this.executeCommand("df / | tail -1 | awk '{print $5}' | sed 's/%//'").catch(() => '0');
      const diskUsage = parseFloat(diskInfo) || 0;
      
      // System uptime
      const uptime = process.uptime();
      
      return {
        cpuUsage,
        memoryUsage,
        diskUsage,
        uptime
      };
    } catch (error) {
      return {
        cpuUsage: 0,
        memoryUsage: 0,
        diskUsage: 0,
        uptime: process.uptime()
      };
    }
  }
  
  /**
   * Collect application-level metrics
   */
  private async collectApplicationMetrics(): Promise<MonitoringMetrics['application']> {
    try {
      // Health check
      const startTime = performance.now();
      const healthResponse = await this.executeCommand('curl -s -o /dev/null -w "%{http_code}" http://localhost:9999/health').catch(() => '500');
      const responseTime = performance.now() - startTime;
      
      const healthStatus = healthResponse === '200' ? 'healthy' : 
                          healthResponse === '503' ? 'degraded' : 'unhealthy';
      
      // Active connections (estimate)
      const connectionInfo = await this.executeCommand('lsof -ti:9999 | wc -l').catch(() => '0');
      const activeConnections = parseInt(connectionInfo) || 0;
      
      // Error rate (placeholder - would need actual implementation)
      const errorRate = 0; // Would calculate from logs
      
      return {
        healthStatus,
        activeConnections,
        responseTime,
        errorRate
      };
    } catch (error) {
      return {
        healthStatus: 'unhealthy',
        activeConnections: 0,
        responseTime: 0,
        errorRate: 100
      };
    }
  }
  
  /**
   * Collect database metrics
   */
  private async collectDatabaseMetrics(): Promise<MonitoringMetrics['database']> {
    try {
      // Database connection count (placeholder)
      const connectionCount = 5; // Would query actual database
      
      // Query time (placeholder)
      const queryStartTime = performance.now();
      const queryResponse = await this.executeCommand('curl -s -o /dev/null -w "%{time_total}" -H "X-API-Key: universal-ai-tools-network-2025-secure-key" http://localhost:9999/api/v1/memory?limit=1').catch(() => '0');
      const queryTime = parseFloat(queryResponse) * 1000 || 0;
      
      // Cache hit rate (placeholder)
      const cacheHitRate = 85; // Would calculate from Redis stats
      
      return {
        connectionCount,
        queryTime,
        cacheHitRate
      };
    } catch (error) {
      return {
        connectionCount: 0,
        queryTime: 0,
        cacheHitRate: 0
      };
    }
  }
  
  /**
   * Collect AI/ML metrics
   */
  private async collectAIMetrics(): Promise<MonitoringMetrics['ai']> {
    try {
      // Test AI response time
      const aiStartTime = performance.now();
      const aiResponse = await this.executeCommand('curl -s -X POST -H "Content-Type: application/json" -H "X-API-Key: universal-ai-tools-network-2025-secure-key" -d \'{"prompt":"test"}\' http://localhost:9999/api/v1/llm/chat').catch(() => '{}');
      const aiResponseTime = performance.now() - aiStartTime;
      
      let successRate = 0;
      try {
        const responseData = JSON.parse(aiResponse);
        successRate = responseData.success ? 100 : 0;
      } catch {
        successRate = 0;
      }
      
      return {
        modelsActive: 1, // Would count active models
        avgResponseTime: aiResponseTime,
        successRate,
        queueLength: 0 // Would check actual queue
      };
    } catch (error) {
      return {
        modelsActive: 0,
        avgResponseTime: 0,
        successRate: 0,
        queueLength: 0
      };
    }
  }
  
  /**
   * Collect security metrics
   */
  private async collectSecurityMetrics(): Promise<MonitoringMetrics['security']> {
    // These would typically come from security logs
    return {
      suspiciousActivities: 0,
      failedAuthAttempts: 0,
      rateLimitHits: 0
    };
  }
  
  /**
   * Check metrics against thresholds and create alerts
   */
  private checkThresholds(metrics: MonitoringMetrics): void {
    const checks = [
      {
        metric: 'system.cpuUsage',
        value: metrics.system.cpuUsage,
        threshold: this.thresholds.system.cpuUsage,
        severity: 'warning' as const
      },
      {
        metric: 'system.memoryUsage',
        value: metrics.system.memoryUsage,
        threshold: this.thresholds.system.memoryUsage,
        severity: 'error' as const
      },
      {
        metric: 'application.responseTime',
        value: metrics.application.responseTime,
        threshold: this.thresholds.application.responseTime,
        severity: 'warning' as const
      },
      {
        metric: 'ai.avgResponseTime',
        value: metrics.ai.avgResponseTime,
        threshold: this.thresholds.ai.responseTime,
        severity: 'warning' as const
      },
      {
        metric: 'ai.successRate',
        value: metrics.ai.successRate,
        threshold: this.thresholds.ai.successRate,
        severity: 'error' as const,
        inverse: true // Alert when value is BELOW threshold
      }
    ];
    
    for (const check of checks) {
      const exceedsThreshold = check.inverse ? 
        check.value < check.threshold : 
        check.value > check.threshold;
        
      if (exceedsThreshold) {
        this.createAlert(
          check.severity,
          `${check.metric} ${check.inverse ? 'below' : 'above'} threshold`,
          check.metric,
          check.value,
          check.threshold
        );
      }
    }
  }
  
  /**
   * Create a new alert
   */
  private createAlert(severity: Alert['severity'], message: string, metric: string, value: number, threshold: number): void {
    const alert: Alert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      severity,
      message,
      timestamp: new Date().toISOString(),
      metric,
      value,
      threshold
    };
    
    this.alerts.push(alert);
    
    // Log alert immediately
    const severityColor = {
      info: chalk.blue,
      warning: chalk.yellow,
      error: chalk.red,
      critical: chalk.bgRed.white
    }[severity];
    
    console.log(severityColor(`🚨 ${severity.toUpperCase()}: ${message} (${value.toFixed(2)} vs ${threshold})`));
    
    // Save alert to file
    this.saveAlert(alert);
    
    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }
  }
  
  /**
   * Log current metrics
   */
  private logMetrics(metrics: MonitoringMetrics): void {
    const timestamp = new Date().toISOString();
    
    // Console output (compact)
    const status = metrics.application.healthStatus === 'healthy' ? 
      chalk.green('✅') : 
      metrics.application.healthStatus === 'degraded' ? 
      chalk.yellow('⚠️') : 
      chalk.red('❌');
    
    console.log(`${status} ${timestamp} | ` +
      `CPU: ${metrics.system.cpuUsage.toFixed(1)}% | ` +
      `MEM: ${metrics.system.memoryUsage.toFixed(1)}% | ` +
      `API: ${metrics.application.responseTime.toFixed(0)}ms | ` +
      `AI: ${metrics.ai.avgResponseTime.toFixed(0)}ms (${metrics.ai.successRate.toFixed(0)}%)`
    );
    
    // Save detailed metrics to file
    const logEntry = JSON.stringify(metrics) + '\n';
    const logFile = `monitoring-logs/metrics-${new Date().toISOString().split('T')[0]}.jsonl`;
    
    try {
      const fs = require('fs');
      fs.appendFileSync(logFile, logEntry);
    } catch (error) {
      console.error(chalk.red(`Failed to write metrics log: ${error.message}`));
    }
  }
  
  /**
   * Save alert to file
   */
  private saveAlert(alert: Alert): void {
    const alertFile = `monitoring-alerts/alerts-${new Date().toISOString().split('T')[0]}.jsonl`;
    const alertEntry = JSON.stringify(alert) + '\n';
    
    try {
      const fs = require('fs');
      fs.appendFileSync(alertFile, alertEntry);
    } catch (error) {
      console.error(chalk.red(`Failed to write alert log: ${error.message}`));
    }
  }
  
  /**
   * Generate final monitoring report
   */
  private generateFinalReport(): void {
    if (this.metrics.length === 0) return;
    
    const report = {
      summary: {
        monitoringPeriod: {
          start: this.metrics[0].timestamp,
          end: this.metrics[this.metrics.length - 1].timestamp,
          duration: new Date(this.metrics[this.metrics.length - 1].timestamp).getTime() - 
                   new Date(this.metrics[0].timestamp).getTime()
        },
        totalMetrics: this.metrics.length,
        totalAlerts: this.alerts.length,
        alertsBySerivty: {
          info: this.alerts.filter(a => a.severity === 'info').length,
          warning: this.alerts.filter(a => a.severity === 'warning').length,
          error: this.alerts.filter(a => a.severity === 'error').length,
          critical: this.alerts.filter(a => a.severity === 'critical').length
        }
      },
      averages: {
        system: {
          cpuUsage: this.calculateAverage(this.metrics, 'system.cpuUsage'),
          memoryUsage: this.calculateAverage(this.metrics, 'system.memoryUsage'),
          diskUsage: this.calculateAverage(this.metrics, 'system.diskUsage')
        },
        application: {
          responseTime: this.calculateAverage(this.metrics, 'application.responseTime'),
          activeConnections: this.calculateAverage(this.metrics, 'application.activeConnections')
        },
        ai: {
          responseTime: this.calculateAverage(this.metrics, 'ai.avgResponseTime'),
          successRate: this.calculateAverage(this.metrics, 'ai.successRate')
        }
      },
      recentAlerts: this.alerts.slice(-10) // Last 10 alerts
    };
    
    const reportPath = `monitoring-reports/monitoring-report-${Date.now()}.json`;
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(chalk.blue(`📊 Monitoring report saved: ${reportPath}`));
    console.log(chalk.gray(`📈 Collected ${this.metrics.length} metrics over ${Math.round(report.summary.monitoringPeriod.duration / 1000 / 60)} minutes`));
    console.log(chalk.gray(`🚨 Generated ${this.alerts.length} alerts total`));
  }
  
  /**
   * Calculate average value from metrics array
   */
  private calculateAverage(metrics: MonitoringMetrics[], path: string): number {
    const values = metrics.map(m => {
      const keys = path.split('.');
      let value: any = m;
      for (const key of keys) {
        value = value[key];
      }
      return typeof value === 'number' ? value : 0;
    });
    
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  }
  
  /**
   * Execute shell command with timeout
   */
  private async executeCommand(command: string, timeoutMs = 5000): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        const result = execSync(command, { 
          encoding: 'utf8', 
          timeout: timeoutMs,
          maxBuffer: 1024 * 1024 // 1MB buffer
        });
        resolve(result.toString().trim());
      } catch (error) {
        reject(error);
      }
    });
  }
  
  /**
   * Get current monitoring status
   */
  getStatus(): { isRunning: boolean; metricsCount: number; alertsCount: number } {
    return {
      isRunning: this.isRunning,
      metricsCount: this.metrics.length,
      alertsCount: this.alerts.length
    };
  }
  
  /**
   * Get recent metrics
   */
  getRecentMetrics(count = 10): MonitoringMetrics[] {
    return this.metrics.slice(-count);
  }
  
  /**
   * Get recent alerts
   */
  getRecentAlerts(count = 10): Alert[] {
    return this.alerts.slice(-count);
  }
}

// CLI Interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const monitor = new ContinuousMonitor();
  
  const command = process.argv[2] || 'start';
  const interval = parseInt(process.argv[3]) || 30000;
  
  switch (command) {
    case 'start':
      monitor.start(interval);
      break;
      
    case 'status':
      console.log('Current monitoring status:', monitor.getStatus());
      break;
      
    case 'alerts':
      const alerts = monitor.getRecentAlerts();
      console.log(`Recent alerts (${alerts.length}):`);
      alerts.forEach(alert => {
        console.log(`  ${alert.timestamp} [${alert.severity}] ${alert.message}`);
      });
      break;
      
    default:
      console.log('Usage: continuous-monitoring.ts [start|status|alerts] [interval_ms]');
      console.log('  start [30000] - Start monitoring with optional interval in ms');
      console.log('  status        - Show current monitoring status');
      console.log('  alerts        - Show recent alerts');
  }
}

export { ContinuousMonitor, type MonitoringMetrics, type Alert };