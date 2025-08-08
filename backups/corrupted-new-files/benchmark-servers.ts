#!/usr/bin/env npx tsx

/**
 * Comprehensive Server Benchmarking Script
 * 
 * Compares different server implementations:
 * - Standard server (src/server.ts)
 * - Optimized server (src/server-optimized.ts)  
 * - Frontier server (src/server-frontier.ts)
 */

import { spawn, ChildProcess } from 'child_process';
import { performance } from 'perf_hooks';
import { writeFileSync, existsSync } from 'fs';

interface BenchmarkResult {
  server: string;
  port: number;
  memoryUsage: number; // RSS in MB
  startupTime: number; // milliseconds
  healthCheckTime: number; // milliseconds
  chatResponseTime: number; // milliseconds
  successful: boolean;
  error?: string;
}

interface LoadTestResult {
  server: string;
  requestsPerSecond: number;
  averageResponseTime: number;
  errorRate: number;
  memoryUnderLoad: number;
}

class ServerBenchmark {
  private servers = [
    { name: 'Standard', path: 'src/server.ts', port: 9995 },
    { name: 'Optimized', path: 'src/server-optimized.ts', port: 9996 },
    { name: 'Frontier', path: 'src/server-frontier.ts', port: 9997 }
  ];
  
  private results: BenchmarkResult[] = [];
  private loadTestResults: LoadTestResult[] = [];
  
  async runBenchmarks(): Promise<void> {
    console.log('🚀 Universal AI Tools - Server Benchmark Suite');
    console.log('═══════════════════════════════════════════════');
    console.log(`Testing ${this.servers.length} server implementations`);
    
    // Filter servers that exist
    const existingServers = this.servers.filter(s => existsSync(s.path));
    console.log(`Found ${existingServers.length} server files to test`);
    
    // Run individual server benchmarks
    for (const server of existingServers) {
      console.log(`\n📊 Benchmarking ${server.name} Server (${server.path})...`);
      const result = await this.benchmarkServer(server);
      this.results.push(result);
      
      if (result.successful) {
        console.log(`   ✅ Memory: ${result.memoryUsage.toFixed(1)}MB`);
        console.log(`   ✅ Startup: ${result.startupTime.toFixed(0)}ms`);
        console.log(`   ✅ Health: ${result.healthCheckTime.toFixed(1)}ms`);
        if (result.chatResponseTime > 0) {
          console.log(`   ✅ Chat: ${result.chatResponseTime.toFixed(1)}ms`);
        }
      } else {
        console.log(`   ❌ Failed: ${result.error}`);
      }
    }
    
    // Run load tests on successful servers
    const successfulServers = this.results.filter(r => r.successful);
    if (successfulServers.length > 0) {
      console.log('\n🔥 Running Load Tests...');
      for (const result of successfulServers) {
        const server = this.servers.find(s => s.name === result.server)!;
        console.log(`\n⚡ Load testing ${server.name} Server...`);
        const loadResult = await this.loadTestServer(server);
        this.loadTestResults.push(loadResult);
      }
    }
    
    // Display comparison
    this.displayComparison();
    
    // Save results
    this.saveResults();
  }
  
  private async benchmarkServer(server: any): Promise<BenchmarkResult> {
    const startTime = performance.now();
    
    return new Promise<BenchmarkResult>((resolve) => {
      const serverProcess = spawn('npx', ['tsx', server.path], {
        env: { ...process.env, PORT: server.port.toString() },
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let serverReady = false;
      let startupTime = 0;
      
      const timeout = setTimeout(() => {
        if (!serverReady) {
          serverProcess.kill();
          resolve({
            server: server.name,
            port: server.port,
            memoryUsage: 0,
            startupTime: 0,
            healthCheckTime: 0,
            chatResponseTime: 0,
            successful: false,
            error: 'Startup timeout (30s)'
          });
        }
      }, 30000);
      
      serverProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        if ((output.includes('started') || output.includes('listening') || output.includes('Server')) && !serverReady) {
          startupTime = performance.now() - startTime;
          serverReady = true;
          clearTimeout(timeout);
          
          // Give server time to fully initialize
          setTimeout(async () => {
            try {
              const result = await this.measureServerPerformance(serverProcess, server, startupTime);
              serverProcess.kill();
              resolve(result);
            } catch (error) {
              serverProcess.kill();
              resolve({
                server: server.name,
                port: server.port,
                memoryUsage: 0,
                startupTime,
                healthCheckTime: 0,
                chatResponseTime: 0,
                successful: false,
                error: error instanceof Error ? error.message : String(error)
              });
            }
          }, 2000);
        }
      });
      
      serverProcess.stderr?.on('data', (data) => {
        // Suppress stderr unless it's a critical error
        const error = data.toString();
        if (error.includes('Error') && !error.includes('Warning')) {
          console.error(`   ⚠️  ${server.name}: ${error.trim()}`);
        }
      });
      
      serverProcess.on('error', (error) => {
        clearTimeout(timeout);
        resolve({
          server: server.name,
          port: server.port,
          memoryUsage: 0,
          startupTime: 0,
          healthCheckTime: 0,
          chatResponseTime: 0,
          successful: false,
          error: error.message
        });
      });
    });
  }
  
  private async measureServerPerformance(
    process: ChildProcess,
    server: any,
    startupTime: number
  ): Promise<BenchmarkResult> {
    // Get memory usage
    const memoryUsage = await this.getProcessMemory(process.pid!);
    
    // Test health endpoint
    const healthCheckTime = await this.testEndpoint(`http://localhost:${server.port}/health`) ||
                           await this.testEndpoint(`http://localhost:${server.port}/api/v1/health`) ||
                           await this.testEndpoint(`http://localhost:${server.port}/`);
    
    // Test chat endpoint if available
    let chatResponseTime = 0;
    try {
      const chatStart = performance.now();
      const response = await fetch(`http://localhost:${server.port}/api/v1/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Hello', userId: 'test' })
      });
      if (response.ok) {
        chatResponseTime = performance.now() - chatStart;
      }
    } catch (error) {
      // Chat endpoint not available or failed
    }
    
    return {
      server: server.name,
      port: server.port,
      memoryUsage,
      startupTime,
      healthCheckTime,
      chatResponseTime,
      successful: healthCheckTime > 0
    };
  }
  
  private async getProcessMemory(pid: number): Promise<number> {
    try {
      const { spawn } = require('child_process');
      return new Promise((resolve) => {
        const ps = spawn('ps', ['-o', 'rss=', '-p', pid.toString()]);
        let output = '';
        
        ps.stdout.on('data', (data: Buffer) => {
          output += data.toString();
        });
        
        ps.on('close', () => {
          const rss = parseInt(output.trim()) || 0;
          resolve(rss / 1024); // Convert KB to MB
        });
      });
    } catch (error) {
      return 0;
    }
  }
  
  private async testEndpoint(url: string): Promise<number> {
    try {
      const start = performance.now();
      const response = await fetch(url);
      const end = performance.now();
      
      if (response.ok) {
        return end - start;
      }
    } catch (error) {
      // Endpoint not available
    }
    return 0;
  }
  
  private async loadTestServer(server: any): Promise<LoadTestResult> {
    const duration = 10000; // 10 seconds
    const concurrency = 5; // 5 concurrent requests
    
    return new Promise<LoadTestResult>((resolve) => {
      const serverProcess = spawn('npx', ['tsx', server.path], {
        env: { ...process.env, PORT: server.port.toString() },
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let serverReady = false;
      
      serverProcess.stdout?.on('data', (data) => {
        if (!serverReady && data.toString().includes('started')) {
          serverReady = true;
          setTimeout(async () => {
            const result = await this.runLoadTest(server.port, duration, concurrency);
            const memoryUnderLoad = await this.getProcessMemory(serverProcess.pid!);
            serverProcess.kill();
            resolve({
              server: server.name,
              ...result,
              memoryUnderLoad
            });
          }, 1000);
        }
      });
      
      setTimeout(() => {
        if (!serverReady) {
          serverProcess.kill();
          resolve({
            server: server.name,
            requestsPerSecond: 0,
            averageResponseTime: 0,
            errorRate: 100,
            memoryUnderLoad: 0
          });
        }
      }, 10000);
    });
  }
  
  private async runLoadTest(port: number, duration: number, concurrency: number) {
    const startTime = Date.now();
    let requests = 0;
    let errors = 0;
    let totalResponseTime = 0;
    
    const makeRequest = async (): Promise<void> => {
      while (Date.now() - startTime < duration) {
        try {
          const reqStart = performance.now();
          const response = await fetch(`http://localhost:${port}/health`);
          const reqEnd = performance.now();
          
          requests++;
          totalResponseTime += (reqEnd - reqStart);
          
          if (!response.ok) {
            errors++;
          }
        } catch (error) {
          requests++;
          errors++;
        }
        
        // Small delay to avoid overwhelming
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    };
    
    // Run concurrent requests
    const promises = Array(concurrency).fill(0).map(() => makeRequest());
    await Promise.all(promises);
    
    const actualDuration = (Date.now() - startTime) / 1000;
    
    return {
      requestsPerSecond: requests / actualDuration,
      averageResponseTime: requests > 0 ? totalResponseTime / requests : 0,
      errorRate: requests > 0 ? (errors / requests) * 100 : 100
    };
  }
  
  private displayComparison(): void {
    console.log('\n🏆 BENCHMARK COMPARISON');
    console.log('═══════════════════════════════════════');
    
    const successful = this.results.filter(r => r.successful);
    
    if (successful.length === 0) {
      console.log('❌ No servers completed successfully');
      return;
    }
    
    // Memory comparison
    console.log('\n💾 MEMORY USAGE (MB):');
    successful.forEach(r => {
      console.log(`   ${r.server.padEnd(10)}: ${r.memoryUsage.toFixed(1)}MB`);
    });
    
    // Startup time comparison
    console.log('\n⏱️  STARTUP TIME (ms):');
    successful.forEach(r => {
      console.log(`   ${r.server.padEnd(10)}: ${r.startupTime.toFixed(0)}ms`);
    });
    
    // Response time comparison
    console.log('\n🚀 HEALTH CHECK TIME (ms):');
    successful.forEach(r => {
      console.log(`   ${r.server.padEnd(10)}: ${r.healthCheckTime.toFixed(1)}ms`);
    });
    
    // Load test results
    if (this.loadTestResults.length > 0) {
      console.log('\n🔥 LOAD TEST RESULTS:');
      this.loadTestResults.forEach(r => {
        console.log(`   ${r.server.padEnd(10)}: ${r.requestsPerSecond.toFixed(1)} req/s, ${r.averageResponseTime.toFixed(1)}ms avg, ${r.errorRate.toFixed(1)}% errors`);
      });
      
      console.log('\n💾 MEMORY UNDER LOAD (MB):');
      this.loadTestResults.forEach(r => {
        console.log(`   ${r.server.padEnd(10)}: ${r.memoryUnderLoad.toFixed(1)}MB`);
      });
    }
    
    // Winner determination
    if (successful.length > 1) {
      const bestMemory = successful.reduce((best, current) => 
        current.memoryUsage < best.memoryUsage ? current : best
      );
      const bestStartup = successful.reduce((best, current) => 
        current.startupTime < best.startupTime ? current : best
      );
      
      console.log('\n🥇 WINNERS:');
      console.log(`   Memory:  ${bestMemory.server} (${bestMemory.memoryUsage.toFixed(1)}MB)`);
      console.log(`   Startup: ${bestStartup.server} (${bestStartup.startupTime.toFixed(0)}ms)`);
    }
  }
  
  private saveResults(): void {
    const results = {
      timestamp: new Date().toISOString(),
      benchmarks: this.results,
      loadTests: this.loadTestResults,
      summary: {
        serversTestd: this.results.length,
        successful: this.results.filter(r => r.successful).length,
        bestMemory: this.results.filter(r => r.successful).reduce((best, current) => 
          current.memoryUsage < best.memoryUsage ? current : best, this.results[0]
        ),
        bestStartup: this.results.filter(r => r.successful).reduce((best, current) => 
          current.startupTime < best.startupTime ? current : best, this.results[0]
        )
      }
    };
    
    writeFileSync('benchmark-results.json', JSON.stringify(results, null, 2));
    console.log('\n💾 Detailed results saved to benchmark-results.json');
  }
}

// Run if called directly
if (require.main === module) {
  const benchmark = new ServerBenchmark();
  benchmark.runBenchmarks().catch(console.error);
}

export { ServerBenchmark };