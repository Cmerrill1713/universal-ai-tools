#!/usr/bin/env npx tsx

/**
 * Performance Testing Script for Resource Optimizations
 * 
 * Tests actual memory usage, startup time, and performance metrics
 * to validate optimization claims against baseline measurements.
 */

import { spawn, ChildProcess } from 'child_process';
import { performance } from 'perf_hooks';
import { writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

interface PerformanceMetrics {
  memoryUsage: {
    rss: number; // Resident Set Size
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  startupTime: number;
  responseTime: number;
  cpuUsage: {
    user: number;
    system: number;
  };
  timestamp: string;
}

interface TestResults {
  baseline: PerformanceMetrics;
  optimized: PerformanceMetrics;
  comparison: {
    memoryReduction: number;
    startupSpeedup: number;
    responseSpeedup: number;
  };
}

class OptimizationTester {
  private results: TestResults = {} as TestResults;
  
  async runTests(): Promise<void> {
    console.log('🔬 Starting Performance Evaluation of Resource Optimizations');
    console.log('═══════════════════════════════════════════════════════════');
    
    try {
      // Test baseline server
      console.log('\n📊 Testing Baseline Server (src/server.ts)...');
      this.results.baseline = await this.testServer('src/server.ts', 9998);
      
      // Test optimized server
      console.log('\n⚡ Testing Optimized Server (src/server-optimized.ts)...');
      this.results.optimized = await this.testServer('src/server-optimized.ts', 9997);
      
      // Calculate comparisons
      this.calculateComparisons();
      
      // Display results
      this.displayResults();
      
      // Save results
      this.saveResults();
      
    } catch (error) {
      console.error('❌ Testing failed:', error);
      process.exit(1);
    }
  }
  
  private async testServer(serverPath: string, port: number): Promise<PerformanceMetrics> {
    const startTime = performance.now();
    
    return new Promise<PerformanceMetrics>((resolve, reject) => {
      // Start server process
      const serverProcess = spawn('npx', ['tsx', serverPath], {
        env: { ...process.env, PORT: port.toString() },
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let serverReady = false;
      let startupTime = 0;
      
      // Monitor stdout for startup completion
      serverProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        if (output.includes('started') || output.includes('listening')) {
          if (!serverReady) {
            startupTime = performance.now() - startTime;
            serverReady = true;
            
            // Wait a moment for full initialization
            setTimeout(async () => {
              try {
                const metrics = await this.measureServerMetrics(serverProcess, port, startupTime);
                serverProcess.kill();
                resolve(metrics);
              } catch (error) {
                serverProcess.kill();
                reject(error);
              }
            }, 2000);
          }
        }
      });
      
      serverProcess.stderr?.on('data', (data) => {
        console.error(`Server Error: ${data}`);
      });
      
      serverProcess.on('error', (error) => {
        reject(error);
      });
      
      // Timeout after 30 seconds
      setTimeout(() => {
        if (!serverReady) {
          serverProcess.kill();
          reject(new Error('Server startup timeout'));
        }
      }, 30000);
    });
  }
  
  private async measureServerMetrics(
    process: ChildProcess, 
    port: number, 
    startupTime: number
  ): Promise<PerformanceMetrics> {
    // Get process memory usage
    const memoryUsage = process.pid ? await this.getProcessMemory(process.pid) : {
      rss: 0, heapUsed: 0, heapTotal: 0, external: 0
    };
    
    // Test response time
    const responseTime = await this.testResponseTime(port);
    
    // Get CPU usage (approximation)
    const cpuUsage = process.pid ? await this.getProcessCPU(process.pid) : {
      user: 0, system: 0
    };
    
    return {
      memoryUsage,
      startupTime,
      responseTime,
      cpuUsage,
      timestamp: new Date().toISOString()
    };
  }
  
  private async getProcessMemory(pid: number): Promise<PerformanceMetrics['memoryUsage']> {
    try {
      // Use ps command to get memory usage
      const { spawn } = require('child_process');
      return new Promise((resolve) => {
        const ps = spawn('ps', ['-o', 'rss,vsz', '-p', pid.toString()]);
        let output = '';
        
        ps.stdout.on('data', (data: Buffer) => {
          output += data.toString();
        });
        
        ps.on('close', () => {
          const lines = output.trim().split('\n');
          if (lines.length > 1) {
            const [rss, vsz] = lines[1].trim().split(/\s+/).map(Number);
            resolve({
              rss: rss * 1024, // Convert KB to bytes
              heapUsed: rss * 1024 * 0.7, // Estimate
              heapTotal: vsz * 1024, // Convert KB to bytes
              external: rss * 1024 * 0.1 // Estimate
            });
          } else {
            resolve({ rss: 0, heapUsed: 0, heapTotal: 0, external: 0 });
          }
        });
      });
    } catch (error) {
      return { rss: 0, heapUsed: 0, heapTotal: 0, external: 0 };
    }
  }
  
  private async getProcessCPU(pid: number): Promise<PerformanceMetrics['cpuUsage']> {
    try {
      // Use ps command to get CPU usage
      const { spawn } = require('child_process');
      return new Promise((resolve) => {
        const ps = spawn('ps', ['-o', 'pcpu', '-p', pid.toString()]);
        let output = '';
        
        ps.stdout.on('data', (data: Buffer) => {
          output += data.toString();
        });
        
        ps.on('close', () => {
          const lines = output.trim().split('\n');
          if (lines.length > 1) {
            const cpu = parseFloat(lines[1].trim());
            resolve({
              user: cpu,
              system: cpu * 0.2 // Estimate
            });
          } else {
            resolve({ user: 0, system: 0 });
          }
        });
      });
    } catch (error) {
      return { user: 0, system: 0 };
    }
  }
  
  private async testResponseTime(port: number): Promise<number> {
    const startTime = performance.now();
    
    try {
      const response = await fetch(`http://localhost:${port}/api/v1/health`);
      const endTime = performance.now();
      
      if (response.ok) {
        return endTime - startTime;
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.warn(`Response time test failed for port ${port}:`, error);
      return 0;
    }
  }
  
  private calculateComparisons(): void {
    const baseline = this.results.baseline;
    const optimized = this.results.optimized;
    
    this.results.comparison = {
      memoryReduction: baseline.memoryUsage.rss > 0 
        ? ((baseline.memoryUsage.rss - optimized.memoryUsage.rss) / baseline.memoryUsage.rss) * 100
        : 0,
      startupSpeedup: baseline.startupTime > 0
        ? ((baseline.startupTime - optimized.startupTime) / baseline.startupTime) * 100
        : 0,
      responseSpeedup: baseline.responseTime > 0
        ? ((baseline.responseTime - optimized.responseTime) / baseline.responseTime) * 100
        : 0
    };
  }
  
  private displayResults(): void {
    console.log('\n🎯 PERFORMANCE TEST RESULTS');
    console.log('═══════════════════════════════════════');
    
    console.log('\n📊 MEMORY USAGE:');
    console.log(`   Baseline:  ${this.formatBytes(this.results.baseline.memoryUsage.rss)}`);
    console.log(`   Optimized: ${this.formatBytes(this.results.optimized.memoryUsage.rss)}`);
    console.log(`   Reduction: ${this.results.comparison.memoryReduction.toFixed(1)}%`);
    
    console.log('\n⏱️  STARTUP TIME:');
    console.log(`   Baseline:  ${this.results.baseline.startupTime.toFixed(0)}ms`);
    console.log(`   Optimized: ${this.results.optimized.startupTime.toFixed(0)}ms`);
    console.log(`   Speedup:   ${this.results.comparison.startupSpeedup.toFixed(1)}%`);
    
    console.log('\n🚀 RESPONSE TIME:');
    console.log(`   Baseline:  ${this.results.baseline.responseTime.toFixed(1)}ms`);
    console.log(`   Optimized: ${this.results.optimized.responseTime.toFixed(1)}ms`);
    console.log(`   Speedup:   ${this.results.comparison.responseSpeedup.toFixed(1)}%`);
    
    console.log('\n🎯 VALIDATION:');
    if (this.results.comparison.memoryReduction > 50) {
      console.log('   ✅ Memory optimization: SIGNIFICANT (>50% reduction)');
    } else if (this.results.comparison.memoryReduction > 20) {
      console.log('   ⚠️  Memory optimization: MODERATE (20-50% reduction)');
    } else {
      console.log('   ❌ Memory optimization: MINIMAL (<20% reduction)');
    }
    
    if (this.results.comparison.startupSpeedup > 50) {
      console.log('   ✅ Startup optimization: SIGNIFICANT (>50% faster)');
    } else if (this.results.comparison.startupSpeedup > 20) {
      console.log('   ⚠️  Startup optimization: MODERATE (20-50% faster)');
    } else {
      console.log('   ❌ Startup optimization: MINIMAL (<20% faster)');
    }
  }
  
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
  
  private saveResults(): void {
    const resultsPath = join(process.cwd(), 'optimization-test-results.json');
    writeFileSync(resultsPath, JSON.stringify(this.results, null, 2));
    console.log(`\n💾 Results saved to: ${resultsPath}`);
  }
}

// Run tests if called directly
if (require.main === module) {
  const tester = new OptimizationTester();
  tester.runTests().catch(console.error);
}

export { OptimizationTester };