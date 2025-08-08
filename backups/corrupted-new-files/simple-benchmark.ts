#!/usr/bin/env npx tsx

/**
 * Simple benchmark to test actual memory usage and startup times
 */

import { spawn } from 'child_process';
import { performance } from 'perf_hooks';

async function testServer(serverPath: string, serverName: string, port: number): Promise<void> {
  console.log(`\n🧪 Testing ${serverName} (${serverPath})`);
  console.log('─'.repeat(50));
  
  if (!require('fs').existsSync(serverPath)) {
    console.log(`❌ Server file not found: ${serverPath}`);
    return;
  }
  
  const startTime = performance.now();
  
  return new Promise<void>((resolve) => {
    const serverProcess = spawn('npx', ['tsx', serverPath], {
      env: { ...process.env, PORT: port.toString(), NODE_ENV: 'test' },
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let resolved = false;
    
    const timeout = setTimeout(() => {
      if (!resolved) {
        console.log(`⏰ Timeout after 15 seconds`);
        serverProcess.kill();
        resolved = true;
        resolve();
      }
    }, 15000);
    
    serverProcess.stdout?.on('data', (data) => {
      const output = data.toString();
      if ((output.includes('started') || output.includes('listening')) && !resolved) {
        const startupTime = performance.now() - startTime;
        console.log(`✅ Startup time: ${startupTime.toFixed(0)}ms`);
        
        // Get memory after startup
        setTimeout(async () => {
          if (serverProcess.pid && !resolved) {
            const memory = await getProcessMemory(serverProcess.pid);
            console.log(`💾 Memory usage: ${memory.toFixed(1)}MB`);
            
            // Test health endpoint
            try {
              const healthStart = performance.now();
              const response = await fetch(`http://localhost:${port}/health`).catch(() => 
                fetch(`http://localhost:${port}/api/v1/health`).catch(() => 
                  fetch(`http://localhost:${port}/`)
                )
              );
              
              if (response?.ok) {
                const healthTime = performance.now() - healthStart;
                console.log(`🚀 Health response: ${healthTime.toFixed(1)}ms`);
              } else {
                console.log(`⚠️  Health endpoint not accessible`);
              }
            } catch (error) {
              console.log(`⚠️  Could not test health endpoint`);
            }
          }
          
          clearTimeout(timeout);
          serverProcess.kill();
          resolved = true;
          resolve();
        }, 2000);
      }
    });
    
    serverProcess.stderr?.on('data', (data) => {
      const error = data.toString();
      if (!error.includes('ExperimentalWarning') && !error.includes('Warning')) {
        console.log(`⚠️  Error: ${error.trim()}`);
      }
    });
    
    serverProcess.on('error', (error) => {
      console.log(`❌ Process error: ${error.message}`);
      clearTimeout(timeout);
      resolved = true;
      resolve();
    });
  });
}

async function getProcessMemory(pid: number): Promise<number> {
  try {
    return new Promise((resolve) => {
      const ps = spawn('ps', ['-o', 'rss=', '-p', pid.toString()]);
      let output = '';
      
      ps.stdout.on('data', (data) => {
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

async function main(): Promise<void> {
  console.log('🔬 Universal AI Tools - Simple Server Benchmark');
  console.log('═'.repeat(60));
  
  const servers = [
    { name: 'Standard Server', path: 'src/server.ts', port: 9991 },
    { name: 'Optimized Server', path: 'src/server-optimized.ts', port: 9992 },
    { name: 'Frontier Server', path: 'src/server-frontier.ts', port: 9993 }
  ];
  
  for (const server of servers) {
    await testServer(server.path, server.name, server.port);
    // Wait between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n🎯 Benchmark Complete!');
  console.log('Check results above for memory usage and startup time comparisons.');
}

main().catch(console.error);