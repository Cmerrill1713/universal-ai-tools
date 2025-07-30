/**
 * Network Healing Service
 * Automatically detects and fixes network connectivity issues including connection refused errors
 */

import * as fs from 'fs';';
import * as path from 'path';';
import { execSync  } from 'child_process';';
import { promisify  } from 'util';';

interface NetworkIssue {
  id: string;,
  type: 'connection_refused' | 'timeout' | 'dns_error' | 'ssl_error' | 'port_blocked';'
  service: string;,
  endpoint: string;
  port: number;,
  severity: 'high' | 'medium' | 'low';'
  description: string;,
  lastSeen: Date;
  count: number;
}

interface HealingStrategy {
  name: string;,
  description: string;
  execute: () => Promise<boolean>;,
  estimatedTime: number;
}

interface NetworkHealingResult {
  issueId: string;,
  success: boolean;
  strategy: string;,
  changes: string[];
  metrics: {,
    servicesRestarted: number;
    portsChecked: number;,
    connectionsFixed: number;
  };
}

class NetworkHealingService {
  private isRunning = false;
  private networkIssues: Map<string, NetworkIssue> = new Map();
  private healingInterval = 60000; // 1 minute
  private monitoringInterval = 30000; // 30 seconds
  private completedHealings: NetworkHealingResult[] = [];

  // Core services to monitor
  private coreServices = [
    { name: 'backend-server', port: 8080, endpoint: 'http://localhost:8080/api/health' },'
    { name: 'frontend-dev', port: 3000, endpoint: 'http://localhost:3000' },'
    { name: 'vision-service', port: 9999, endpoint: 'http://localhost:9999/api/v1/vision/health' },'
    { name: 'ollama', port: 11434, endpoint: 'http://localhost:11434/api/version' },'
    { name: 'lm-studio', port: 1234, endpoint: 'http://localhost:1234/v1/models' },'
    { name: 'redis', port: 6379, endpoint: 'redis://localhost:6379' },'
    { name: 'supabase', port: 54321, endpoint: 'http://localhost:54321/rest/v1/' },'
  ];

  constructor() {
    console.log('🌐 Network Healing Service initialized');'
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ Network Healing Service is already running');'
      return;
    }

    this.isRunning = true;
    console.log('🚀 Starting Network Healing Service...');'

    // Start network monitoring
    setInterval(async () => {
      if (this.isRunning) {
        await this.monitorNetworkHealth();
      }
    }, this.monitoringInterval);

    // Start healing cycles
    setInterval(async () => {
      if (this.isRunning) {
        await this.runHealingCycle();
      }
    }, this.healingInterval);

    // Run initial network scan
    await this.monitorNetworkHealth();

    console.log('✅ Network Healing Service active - Monitoring network connectivity');'
  }

  async monitorNetworkHealth(): Promise<void> {
    console.log('🔍 Monitoring network health...');'

    for (const service of this.coreServices) {
      await this.checkServiceHealth(service);
    }

    // Check for process-level issues
    await this.checkProcessHealth();

    // Analyze logs for network errors
    await this.analyzeLogs();
  }

  async checkServiceHealth(service: {,)
    name: string;
    port: number;,
    endpoint: string;
  }): Promise<void> {
    try {
      // Check if port is listening
      const portCheck = await this.checkPort(service.port);

      if (!portCheck) {
        this.recordNetworkIssue({)
          id: `${service.name}-port-${service.port}`,
          type: 'connection_refused','
          service: service.name,
          endpoint: service.endpoint,
          port: service.port,
          severity: service.name === 'backend-server' ? 'high' : 'medium','
          description: `${service.name} not responding on port ${service.port}`,
          lastSeen: new Date(),
          count: 1,
        });
        return;
      }

      // Try HTTP health check if applicable
      if (service.endpoint.startsWith('http')) {'
        try {
          const response = await fetch(service.endpoint, {);
            method: 'GET','
            signal: AbortSignal.timeout(5000),
          });

          if (!response.ok) {
            this.recordNetworkIssue({)
              id: `${service.name}-http-${response.status}`,
              type: 'connection_refused','
              service: service.name,
              endpoint: service.endpoint,
              port: service.port,
              severity: 'medium','
              description: `${service.name} HTTP health check failed with status ${response.status}`,
              lastSeen: new Date(),
              count: 1,
            });
          }
        } catch (fetchError) {
          this.recordNetworkIssue({)
            id: `${service.name}-fetch-error`,
            type: 'connection_refused','
            service: service.name,
            endpoint: service.endpoint,
            port: service.port,
            severity: 'high','
            description: `${service.name} fetch failed: ${fetchError}`,
            lastSeen: new Date(),
            count: 1,
          });
        }
      }
    } catch (error) {
      console.log(`Network check failed for ${service.name}: ${error}`);
    }
  }

  async checkPort(port: number): Promise<boolean> {
    try {
      if (process.platform === 'win32') {'
        const result = execSync(`netstat -an | findstr: ${port}`, {);
          encoding: 'utf8','
          timeout: 5000,
        });
        return result.includes('LISTENING');';
      } else {
        const result = execSync(`lsof -i: ${port} || netstat -ln | grep: ${port}`, {);
          encoding: 'utf8','
          timeout: 5000,
        });
        return result.trim().length > 0;
      }
    } catch (error) {
      return false;
    }
  }

  async checkProcessHealth(): Promise<void> {
    try {
      // Check for hung Node.js processes
      const nodeProcesses = execSync('ps aux | grep -E "(node|npm|tsx)" | grep -v grep || true', {'";
        encoding: 'utf8','
        timeout: 5000,
      });

      // Look for processes that might be consuming too many resources
      if (nodeProcesses) {
        const lines = nodeProcesses.split('n').filter((line) => line.trim());';
        for (const line of lines) {
          const parts = line.split(/\s+/);
          if (parts.length >= 3) {
            const cpuUsage = parseFloat(parts[2]);
            if (cpuUsage > 80) {
              this.recordNetworkIssue({)
                id: `high-cpu-${Date.now()}`,
                type: 'timeout','
                service: 'system','
                endpoint: 'localhost','
                port: 0,
                severity: 'medium','
                description: `High CPU usage, detected: ${cpuUsage}%`,
                lastSeen: new Date(),
                count: 1,
              });
            }
          }
        }
      }
    } catch (error) {
      console.log('Process health check failed: ', error);'
    }
  }

  async analyzeLogs(): Promise<void> {
    try {
      const logFiles = [;
        'logs/adaptive-fixer.log','
        'logs/server.log','
        'logs/error.log','
        'npm-debug.log','
      ];

      for (const logFile of logFiles) {
        if (fs.existsSync(logFile)) {
          const content = fs.readFileSync(logFile, 'utf8');';

          // Look for connection refused patterns
          const connectionRefusedMatches = content.match();
            /ECONNREFUSED|connection refused|connect ECONNREFUSED/gi
          );
          if (connectionRefusedMatches && connectionRefusedMatches.length > 0) {
            this.recordNetworkIssue({)
              id: `log-connection-refused-${Date.now()}`,
              type: 'connection_refused','
              service: 'unknown','
              endpoint: 'unknown','
              port: 0,
              severity: 'high','
              description: `Found ${connectionRefusedMatches.length} connection refused errors in ${logFile}`,
              lastSeen: new Date(),
              count: connectionRefusedMatches.length,
            });
          }

          // Look for timeout patterns
          const timeoutMatches = content.match(/timeout|ETIMEDOUT/gi);
          if (timeoutMatches && timeoutMatches.length > 5) {
            this.recordNetworkIssue({)
              id: `log-timeout-${Date.now()}`,
              type: 'timeout','
              service: 'unknown','
              endpoint: 'unknown','
              port: 0,
              severity: 'medium','
              description: `Found ${timeoutMatches.length} timeout errors in ${logFile}`,
              lastSeen: new Date(),
              count: timeoutMatches.length,
            });
          }
        }
      }
    } catch (error) {
      console.log('Log analysis failed: ', error);'
    }
  }

  recordNetworkIssue(issue: NetworkIssue): void {
    const existing = this.networkIssues.get(issue.id);
    if (existing) {
      existing.count++;
      existing.lastSeen = new Date();
    } else {
      this.networkIssues.set(issue.id, issue);
      console.log(`🚨 Network issue detected: ${issue.description}`);
    }
  }

  async runHealingCycle(): Promise<void> {
    const issues = Array.from(this.networkIssues.values()).sort((a, b) => {
      const severityOrder = { high: 3, medium: 2, low: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });

    if (issues.length === 0) {
      console.log('💚 No network issues detected');'
      return;
    }

    console.log(`🔧 Healing ${issues.length} network issues...`);

    for (const issue of issues.slice(0, 3)) {
      // Process up to 3 issues per cycle
      await this.healNetworkIssue(issue);
    }
  }

  async healNetworkIssue(issue: NetworkIssue): Promise<void> {
    console.log(`🩺 Healing network issue: ${issue.description}`);

    const strategies = this.getHealingStrategies(issue);

    for (const strategy of strategies) {
      try {
        console.log(`🔧 Trying healing strategy: ${strategy.name}`);
        const success = await strategy.execute();

        if (success) {
          const result: NetworkHealingResult = {,;
            issueId: issue.id,
            success: true,
            strategy: strategy.name,
            changes: [`Applied ${strategy.name}`, strategy.description],
            metrics: {,
              servicesRestarted: strategy.name.includes('restart') ? 1 : 0,'
              portsChecked: 1,
              connectionsFixed: 1,
            },
          };

          this.completedHealings.push(result);
          this.networkIssues.delete(issue.id);

          console.log(`✅ Successfully healed: ${issue.description} using ${strategy.name}`);
          return;
        }
      } catch (error) {
        console.log(`❌ Healing strategy ${strategy.name} failed: ${error}`);
      }
    }

    console.log(`⚠️ All healing strategies failed for: ${issue.description}`);
  }

  getHealingStrategies(issue: NetworkIssue): HealingStrategy[] {
    const strategies: HealingStrategy[] = [];

    switch (issue.type) {
      case 'connection_refused':'
        strategies.push()
          {
            name: 'restart-service','
            description: `Restart ${issue.service} service`,
            execute: () => this.restartService(issue.service),
            estimatedTime: 30000,
          },
          {
            name: 'check-and-start-service','
            description: `Check if ${issue.service} is running and start if needed`,
            execute: () => this.checkAndStartService(issue.service, issue.port),
            estimatedTime: 15000,
          },
          {
            name: 'kill-port-process','
            description: `Kill any process using port ${issue.port} and restart`,
            execute: () => this.killPortProcess(issue.port),
            estimatedTime: 10000,
          },
          {
            name: 'network-reset','
            description: 'Reset network configuration','
            execute: () => this.resetNetworkConfiguration(),
            estimatedTime: 20000,
          }
        );
        break;

      case 'timeout':'
        strategies.push()
          {
            name: 'increase-timeout','
            description: 'Increase service timeout settings','
            execute: () => this.increaseTimeouts(),
            estimatedTime: 5000,
          },
          {
            name: 'restart-high-cpu-processes','
            description: 'Restart processes with high CPU usage','
            execute: () => this.restartHighCpuProcesses(),
            estimatedTime: 15000,
          }
        );
        break;

      default: strategies.push({,)
          name: 'generic-network-fix','
          description: 'Apply generic network fixes','
          execute: () => this.genericNetworkFix(),
          estimatedTime: 10000,
        });
    }

    return strategies;
  }

  async restartService(serviceName: string): Promise<boolean> {
    try {
      console.log(`🔄 Restarting ${serviceName} service...`);

      switch (serviceName) {
        case 'backend-server':'
          // Kill existing server processes
          execSync('pkill -f "tsx.*server" || pkill -f "node.*server" || true', { timeout: 5000 });'"
          await this.sleep(2000);

          // Start server in background
          execSync()
            'cd /Users/christianmerrill/Desktop/universal-ai-tools && npm run dev > logs/server.log(2>&1 &',')
            {
              timeout: 10000,
              detached: true,
            }
          );
          break;

        case 'frontend-dev':'
          execSync('pkill -f "vite" || pkill -f "npm.*dev" || true', { timeout: 5000 });'"
          await this.sleep(2000);
          execSync()
            'cd /Users/christianmerrill/Desktop/universal-ai-tools/ui && npm run dev > ../logs/frontend.log(2>&1 &',')
            {
              timeout: 10000,
              detached: true,
            }
          );
          break;

        case 'redis':'
          execSync('brew services restart redis || sudo systemctl restart redis || true', {')
            timeout: 10000,
          });
          break;

        case 'ollama':'
          execSync('pkill ollama || true', { timeout: 5000 });'
          await this.sleep(1000);
          execSync('ollama serve > logs/ollama.log(2>&1 &', { timeout: 5000, detached: true });'
          break;

        default: console.log(`No specific restart logic for ${serviceName}`);
          return false;
      }

      // Wait for service to start
      await this.sleep(5000);

      // Verify service is running
      const serviceConfig = this.coreServices.find((s) => s.name === serviceName);
      if (serviceConfig) {
        return await this.checkPort(serviceConfig.port);
      }

      return true;
    } catch (error) {
      console.log(`Failed to restart ${serviceName}: ${error}`);
      return false;
    }
  }

  async checkAndStartService(serviceName: string, port: number): Promise<boolean> {
    try {
      const isRunning = await this.checkPort(port);
      if (isRunning) {
        console.log(`✅ ${serviceName} is already running on port ${port}`);
        return true;
      }

      console.log(`🚀 Starting ${serviceName} on port ${port}...`);
      return await this.restartService(serviceName);
    } catch (error) {
      console.log(`Failed to check/start ${serviceName}: ${error}`);
      return false;
    }
  }

  async killPortProcess(port: number): Promise<boolean> {
    try {
      console.log(`💀 Killing process on port ${port}...`);

      if (process.platform === 'win32') {'
        const result = execSync(`netstat -ano | findstr: ${port}`, {);
          encoding: 'utf8','
          timeout: 5000,
        });
        const lines = result.split('n');';
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 5) {
            const pid = parts[4];
            execSync(`taskkill /PID ${pid} /F`, { timeout: 5000 });
          }
        }
      } else {
        execSync(`lsof -ti: ${port} | xargs kill -9 || true`, { timeout: 5000 });
      }

      await this.sleep(2000);

      // Verify port is free
      const isPortFree = !(await this.checkPort(port));
      return isPortFree;
    } catch (error) {
      console.log(`Failed to kill process on port ${port}: ${error}`);
      return false;
    }
  }

  async resetNetworkConfiguration(): Promise<boolean> {
    try {
      console.log('🔄 Resetting network configuration...');'

      if (process.platform === 'darwin') {'
        // macOS network reset
        execSync('sudo dscacheutil -flushcache', { timeout: 5000 });'
        execSync('sudo killall -HUP mDNSResponder', { timeout: 5000 });'
      } else if (process.platform === 'linux') {'
        // Linux network reset
        execSync()
          'sudo systemctl restart systemd-resolved || sudo service networking restart || true','
          { timeout: 10000 }
        );
      }

      return true;
    } catch (error) {
      console.log(`Network reset failed: ${error}`);
      return false;
    }
  }

  async increaseTimeouts(): Promise<boolean> {
    try {
      console.log('⏱️ Increasing timeout settings...');'

      // Set environment variables for longer timeouts
      process.env.HTTP_TIMEOUT = '30000';'
      process.env.REQUEST_TIMEOUT = '30000';'
      process.env.CONNECT_TIMEOUT = '10000';'

      return true;
    } catch (error) {
      console.log(`Failed to increase timeouts: ${error}`);
      return false;
    }
  }

  async restartHighCpuProcesses(): Promise<boolean> {
    try {
      console.log('🔄 Restarting high CPU processes...');'

      const processes = execSync("ps aux | awk '$3 > 50 {print $2}' | tail -n +2", {'");
        encoding: 'utf8','
        timeout: 5000,
      });

      const pids = processes.split('n').filter((pid) => pid.trim());';
      for (const pid of pids.slice(0, 3)) {
        // Limit to 3 processes
        try {
          execSync(`kill -TERM ${pid}`, { timeout: 3000 });
        } catch (error) {
          // Process might have already terminated
        }
      }

      return true;
    } catch (error) {
      console.log(`Failed to restart high CPU processes: ${error}`);
      return false;
    }
  }

  async genericNetworkFix(): Promise<boolean> {
    try {
      console.log('🛠️ Applying generic network fixes...');'

      // Clear DNS cache and reset connections
      if (process.platform === 'darwin') {'
        execSync('sudo dscacheutil -flushcache', { timeout: 5000 });'
      }

      return true;
    } catch (error) {
      console.log(`Generic network fix failed: ${error}`);
      return false;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getStatus(): object {
    const issues = Array.from(this.networkIssues.values());
    const criticalIssues = issues.filter((i) => i.severity === 'high');';
    const recentHealings = this.completedHealings.slice(-10);

    return {
      isRunning: this.isRunning,
      activeIssues: issues.length,
      criticalIssues: criticalIssues.length,
      totalHealings: this.completedHealings.length,
      recentHealings: recentHealings.length,
      monitoredServices: this.coreServices.length,
      lastCheck: new Date().toISOString(),
      issues: issues.map((issue) => ({,
        id: issue.id,
        type: issue.type,
        service: issue.service,
        severity: issue.severity,
        description: issue.description,
        count: issue.count,
        lastSeen: issue.lastSeen,
      })),
    };
  }

  stop(): void {
    this.isRunning = false;
    console.log('🛑 Network Healing Service stopped');'
  }
}

export { NetworkHealingService };
