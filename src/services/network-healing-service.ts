/**
 * Network Healing Service
 * Automatically detects and fixes network connectivity issues including connection refused errors
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import { log, LogContext } from '../utils/logger';

interface NetworkIssue {
  id: string;
  type: 'connection_refused' | 'timeout' | 'dns_error' | 'ssl_error' | 'port_blocked';
  service: string;
  endpoint: string;
  port: number;
  severity: 'high' | 'medium' | 'low';
  description: string;
  lastSeen: Date;
  count: number;
}

interface HealingStrategy {
  name: string;
  description: string;
  execute: () => Promise<boolean>;
  estimatedTime: number;
}

interface NetworkHealingResult {
  issueId: string;
  success: boolean;
  strategy: string;
  changes: string[];
  metrics: {
    servicesRestarted: number;
    portsChecked: number;
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
    { name: 'backend-server', port: 8080, endpoint: 'http://localhost:8080/api/health' },
    { name: 'frontend-dev', port: 3000, endpoint: 'http://localhost:3000' },
    { name: 'vision-service', port: 9999, endpoint: 'http://localhost:9999/api/v1/vision/health' },
    { name: 'ollama', port: 11434, endpoint: 'http://localhost:11434/api/version' },
    { name: 'lm-studio', port: 1234, endpoint: 'http://localhost:1234/v1/models' },
    { name: 'redis', port: 6379, endpoint: 'redis://localhost:6379' },
    { name: 'supabase', port: 54321, endpoint: 'http://localhost:54321/rest/v1/' },
  ];

  constructor() {
    log.info('🌐 Network Healing Service initialized', LogContext.SERVICE);
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      log.warn('⚠️ Network Healing Service is already running', LogContext.SERVICE);
      return;
    }

    this.isRunning = true;
    log.info('🚀 Starting Network Healing Service...', LogContext.SERVICE);

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

    log.info('✅ Network Healing Service active - Monitoring network connectivity', LogContext.SERVICE);
  }

  async monitorNetworkHealth(): Promise<void> {
    log.info('🔍 Monitoring network health...', LogContext.SERVICE);

    for (const service of this.coreServices) {
      await this.checkServiceHealth(service);
    }

    // Check for process-level issues
    await this.checkProcessHealth();

    // Analyze logs for network errors
    await this.analyzeLogs();
  }

  async checkServiceHealth(service: {
    name: string;
    port: number;
    endpoint: string;
  }): Promise<void> {
    try {
      // Check if port is listening
      const portCheck = await this.checkPort(service.port);

      if (!portCheck) {
        this.recordNetworkIssue({
          id: `${service.name}-port-${service.port}`,
          type: 'connection_refused',
          service: service.name,
          endpoint: service.endpoint,
          port: service.port,
          severity: service.name === 'backend-server' ? 'high' : 'medium',
          description: `${service.name} not responding on port ${service.port}`,
          lastSeen: new Date(),
          count: 1,
        });
        return;
      }

      // Try HTTP health check if applicable
      if (service.endpoint.startsWith('http')) {
        try {
          const response = await fetch(service.endpoint, {
            method: 'GET',
            signal: AbortSignal.timeout(5000),
          });

          if (!response.ok) {
            this.recordNetworkIssue({
              id: `${service.name}-http-${response.status}`,
              type: 'connection_refused',
              service: service.name,
              endpoint: service.endpoint,
              port: service.port,
              severity: 'medium',
              description: `${service.name} HTTP health check failed with status ${response.status}`,
              lastSeen: new Date(),
              count: 1,
            });
          }
        } catch (fetchError) {
          this.recordNetworkIssue({
            id: `${service.name}-fetch-error`,
            type: 'connection_refused',
            service: service.name,
            endpoint: service.endpoint,
            port: service.port,
            severity: 'high',
            description: `${service.name} fetch failed: ${fetchError}`,
            lastSeen: new Date(),
            count: 1,
          });
        }
      }
    } catch (error) {
      log.error(`Network check failed for ${service.name}`, LogContext.SERVICE, { service: service.name, error });
    }
  }

  private validatePort(port: number): boolean {
    // Security: Validate port number to prevent command injection
    return Number.isInteger(port) && port > 0 && port <= 65535;
  }

  private async executeSecureCommand(
    command: string,
    args: string[] = [],
    options: any = {}
  ): Promise<string> {
    // Security: Execute commands safely using spawn instead of execSync
    return new Promise((resolve, reject) => {
      log.info(`🔒 Executing secure command: ${command} ${args.join(' ')}`, LogContext.SERVICE);

      const child = spawn(command, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: options.timeout || 30000,
        cwd: options.cwd || process.cwd(),
        ...options,
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        log.info(`🔒 Command completed with code: ${code}`, LogContext.SERVICE);
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr}`));
        }
      });

      child.on('error', (error) => {
        log.error(`🔒 Command execution error`, LogContext.SERVICE, { error });
        reject(error);
      });
    });
  }

  async checkPort(port: number): Promise<boolean> {
    try {
      // Security: Validate port number to prevent command injection
      if (!this.validatePort(port)) {
        log.warn(`🔒 Invalid port number: ${port}`, LogContext.SERVICE);
        return false;
      }

      log.info(`🔒 Checking port ${port} using secure command execution`, LogContext.SERVICE);

      if (process.platform === 'win32') {
        try {
          const result = await this.executeSecureCommand('netstat', ['-an'], { timeout: 5000 });
          return result.includes(`:${port}`) && result.includes('LISTENING');
        } catch (error) {
          log.error(`🔒 Windows port check failed`, LogContext.SERVICE, { error });
          return false;
        }
      } else {
        // Try lsof first, then netstat as fallback
        try {
          const result = await this.executeSecureCommand('lsof', ['-i', `:${port}`], {
            timeout: 5000,
          });
          return result.trim().length > 0;
        } catch (lsofError) {
          try {
            const result = await this.executeSecureCommand('netstat', ['-ln'], { timeout: 5000 });
            return result.includes(`:${port}`);
          } catch (netstatError) {
            log.error(`🔒 Unix port check failed`, LogContext.SERVICE, { lsofError, netstatError });
            return false;
          }
        }
      }
    } catch (error) {
      log.error(`🔒 Port check failed for port ${port}`, LogContext.SERVICE, { port, error });
      return false;
    }
  }

  async checkProcessHealth(): Promise<void> {
    try {
      log.info('🔒 Checking process health using secure command execution', LogContext.SERVICE);

      // Check for hung Node.js processes using secure command execution
      try {
        const psResult = await this.executeSecureCommand('ps', ['aux'], { timeout: 5000 });
        const grepResult = psResult
          .split('\n')
          .filter(
            (line) =>
              (line.includes('node') || line.includes('npm') || line.includes('tsx')) &&
              !line.includes('grep')
          );

        // Look for processes that might be consuming too many resources
        for (const line of grepResult) {
          const parts = line.split(/\s+/);
          if (parts.length >= 3 && parts[2]) {
            const cpuUsage = parseFloat(parts[2]);
            if (!isNaN(cpuUsage) && cpuUsage > 80) {
              log.warn(
                `🔒 High CPU usage detected: ${cpuUsage}% in process: ${parts.slice(10).join(' ')}`,
                LogContext.SERVICE
              );
              this.recordNetworkIssue({
                id: `high-cpu-${Date.now()}`,
                type: 'timeout',
                service: 'system',
                endpoint: 'localhost',
                port: 0,
                severity: 'medium',
                description: `High CPU usage detected: ${cpuUsage}%`,
                lastSeen: new Date(),
                count: 1,
              });
            }
          }
        }
      } catch (error) {
        log.error('🔒 Process health check failed (ps command)', LogContext.SERVICE, { error });
      }
    } catch (error) {
      log.error('🔒 Process health check failed', LogContext.SERVICE, { error });
    }
  }

  async analyzeLogs(): Promise<void> {
    try {
      const logFiles = [
        'logs/adaptive-fixer.log',
        'logs/server.log',
        'logs/error.log',
        'npm-debug.log',
      ];

      for (const logFile of logFiles) {
        if (fs.existsSync(logFile)) {
          const content = fs.readFileSync(logFile, 'utf8');

          // Look for connection refused patterns
          const connectionRefusedMatches = content.match(
            /ECONNREFUSED|connection refused|connect ECONNREFUSED/gi
          );
          if (connectionRefusedMatches && connectionRefusedMatches.length > 0) {
            this.recordNetworkIssue({
              id: `log-connection-refused-${Date.now()}`,
              type: 'connection_refused',
              service: 'unknown',
              endpoint: 'unknown',
              port: 0,
              severity: 'high',
              description: `Found ${connectionRefusedMatches.length} connection refused errors in ${logFile}`,
              lastSeen: new Date(),
              count: connectionRefusedMatches.length,
            });
          }

          // Look for timeout patterns
          const timeoutMatches = content.match(/timeout|ETIMEDOUT/gi);
          if (timeoutMatches && timeoutMatches.length > 5) {
            this.recordNetworkIssue({
              id: `log-timeout-${Date.now()}`,
              type: 'timeout',
              service: 'unknown',
              endpoint: 'unknown',
              port: 0,
              severity: 'medium',
              description: `Found ${timeoutMatches.length} timeout errors in ${logFile}`,
              lastSeen: new Date(),
              count: timeoutMatches.length,
            });
          }
        }
      }
    } catch (error) {
      log.error('Log analysis failed', LogContext.SERVICE, { error });
    }
  }

  recordNetworkIssue(issue: NetworkIssue): void {
    const existing = this.networkIssues.get(issue.id);
    if (existing) {
      existing.count++;
      existing.lastSeen = new Date();
    } else {
      this.networkIssues.set(issue.id, issue);
      log.warn(`🚨 Network issue detected: ${issue.description}`, LogContext.SERVICE);
    }
  }

  async runHealingCycle(): Promise<void> {
    const issues = Array.from(this.networkIssues.values()).sort((a, b) => {
      const severityOrder = { high: 3, medium: 2, low: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });

    if (issues.length === 0) {
      log.info('💚 No network issues detected', LogContext.SERVICE);
      return;
    }

    log.info(`🔧 Healing ${issues.length} network issues...`, LogContext.SERVICE);

    for (const issue of issues.slice(0, 3)) {
      // Process up to 3 issues per cycle
      await this.healNetworkIssue(issue);
    }
  }

  async healNetworkIssue(issue: NetworkIssue): Promise<void> {
    log.info(`🩺 Healing network issue: ${issue.description}`, LogContext.SERVICE);

    const strategies = this.getHealingStrategies(issue);

    for (const strategy of strategies) {
      try {
        log.info(`🔧 Trying healing strategy: ${strategy.name}`, LogContext.SERVICE);
        const success = await strategy.execute();

        if (success) {
          const result: NetworkHealingResult = {
            issueId: issue.id,
            success: true,
            strategy: strategy.name,
            changes: [`Applied ${strategy.name}`, strategy.description],
            metrics: {
              servicesRestarted: strategy.name.includes('restart') ? 1 : 0,
              portsChecked: 1,
              connectionsFixed: 1,
            },
          };

          this.completedHealings.push(result);
          this.networkIssues.delete(issue.id);

          log.info(`✅ Successfully healed: ${issue.description} using ${strategy.name}`, LogContext.SERVICE);
          return;
        }
      } catch (error) {
        log.error(`❌ Healing strategy ${strategy.name} failed`, LogContext.SERVICE, { strategy: strategy.name, error });
      }
    }

    log.warn(`⚠️ All healing strategies failed for: ${issue.description}`, LogContext.SERVICE);
  }

  getHealingStrategies(issue: NetworkIssue): HealingStrategy[] {
    const strategies: HealingStrategy[] = [];

    switch (issue.type) {
      case 'connection_refused':
        strategies.push(
          {
            name: 'restart-service',
            description: `Restart ${issue.service} service`,
            execute: () => this.restartService(issue.service),
            estimatedTime: 30000,
          },
          {
            name: 'check-and-start-service',
            description: `Check if ${issue.service} is running and start if needed`,
            execute: () => this.checkAndStartService(issue.service, issue.port),
            estimatedTime: 15000,
          },
          {
            name: 'kill-port-process',
            description: `Kill any process using port ${issue.port} and restart`,
            execute: () => this.killPortProcess(issue.port),
            estimatedTime: 10000,
          },
          {
            name: 'network-reset',
            description: 'Reset network configuration',
            execute: () => this.resetNetworkConfiguration(),
            estimatedTime: 20000,
          }
        );
        break;

      case 'timeout':
        strategies.push(
          {
            name: 'increase-timeout',
            description: 'Increase service timeout settings',
            execute: () => this.increaseTimeouts(),
            estimatedTime: 5000,
          },
          {
            name: 'restart-high-cpu-processes',
            description: 'Restart processes with high CPU usage',
            execute: () => this.restartHighCpuProcesses(),
            estimatedTime: 15000,
          }
        );
        break;

      default:
        strategies.push({
          name: 'generic-network-fix',
          description: 'Apply generic network fixes',
          execute: () => this.genericNetworkFix(),
          estimatedTime: 10000,
        });
    }

    return strategies;
  }

  private validateServiceName(serviceName: string): boolean {
    // Security: Validate service name to prevent command injection
    const allowedServices = [
      'backend-server',
      'frontend-dev',
      'redis',
      'ollama',
      'supabase',
      'lm-studio',
      'vision-service',
    ];
    return allowedServices.includes(serviceName) && /^[a-zA-Z0-9\-_]+$/.test(serviceName);
  }

  async restartService(serviceName: string): Promise<boolean> {
    try {
      // Security: Validate service name to prevent command injection
      if (!this.validateServiceName(serviceName)) {
        log.warn(`🔒 Invalid service name rejected: ${serviceName}`, LogContext.SERVICE);
        return false;
      }

      log.info(`🔄 Restarting ${serviceName} service using secure commands...`, LogContext.SERVICE);

      switch (serviceName) {
        case 'backend-server':
          try {
            // Kill existing server processes using secure commands
            log.info('🔒 Killing existing backend server processes', LogContext.SERVICE);
            await this.executeSecureCommand('pkill', ['-f', 'tsx.*server'], {
              timeout: 5000,
            }).catch(() => {
              log.info('🔒 No tsx server processes found', LogContext.SERVICE);
            });
            await this.executeSecureCommand('pkill', ['-f', 'node.*server'], {
              timeout: 5000,
            }).catch(() => {
              log.info('🔒 No node server processes found', LogContext.SERVICE);
            });
            await this.sleep(2000);

            // Start server in background using secure spawn
            log.info('🔒 Starting backend server', LogContext.SERVICE);
            const serverProcess = spawn('npm', ['run', 'dev'], {
              cwd: process.cwd(),
              detached: true,
              stdio: ['ignore', 'ignore', 'ignore'],
            });
            serverProcess.unref();
          } catch (error) {
            log.error(`🔒 Backend server restart failed`, LogContext.SERVICE, { error });
            return false;
          }
          break;

        case 'frontend-dev':
          try {
            log.info('🔒 Killing existing frontend processes', LogContext.SERVICE);
            await this.executeSecureCommand('pkill', ['-f', 'vite'], { timeout: 5000 }).catch(
              () => {
                log.info('🔒 No vite processes found', LogContext.SERVICE);
              }
            );
            await this.executeSecureCommand('pkill', ['-f', 'npm.*dev'], { timeout: 5000 }).catch(
              () => {
                log.info('🔒 No npm dev processes found', LogContext.SERVICE);
              }
            );
            await this.sleep(2000);

            log.info('🔒 Starting frontend dev server', LogContext.SERVICE);
            const frontendProcess = spawn('npm', ['run', 'dev'], {
              cwd: path.join(process.cwd(), 'ui'),
              detached: true,
              stdio: ['ignore', 'ignore', 'ignore'],
            });
            frontendProcess.unref();
          } catch (error) {
            log.error(`🔒 Frontend restart failed`, LogContext.SERVICE, { error });
            return false;
          }
          break;

        case 'redis':
          try {
            log.info('🔒 Restarting Redis service', LogContext.SERVICE);
            // Try brew services first, then systemctl
            try {
              await this.executeSecureCommand('brew', ['services', 'restart', 'redis'], {
                timeout: 10000,
              });
            } catch (brewError) {
              try {
                await this.executeSecureCommand('sudo', ['systemctl', 'restart', 'redis'], {
                  timeout: 10000,
                });
              } catch (systemctlError) {
                log.error(
                  `🔒 Redis restart failed`,
                  LogContext.SERVICE,
                  { brewError, systemctlError }
                );
                return false;
              }
            }
          } catch (error) {
            log.error(`🔒 Redis restart failed`, LogContext.SERVICE, { error });
            return false;
          }
          break;

        case 'ollama':
          try {
            log.info('🔒 Restarting Ollama service', LogContext.SERVICE);
            await this.executeSecureCommand('pkill', ['ollama'], { timeout: 5000 }).catch(() => {
              log.info('🔒 No ollama processes found', LogContext.SERVICE);
            });
            await this.sleep(1000);

            const ollamaProcess = spawn('ollama', ['serve'], {
              detached: true,
              stdio: ['ignore', 'ignore', 'ignore'],
            });
            ollamaProcess.unref();
          } catch (error) {
            log.error(`🔒 Ollama restart failed`, LogContext.SERVICE, { error });
            return false;
          }
          break;

        default:
          log.warn(`🔒 No specific restart logic for ${serviceName}`, LogContext.SERVICE);
          return false;
      }

      // Wait for service to start
      await this.sleep(5000);

      // Verify service is running
      const serviceConfig = this.coreServices.find((s) => s.name === serviceName);
      if (serviceConfig) {
        const isRunning = await this.checkPort(serviceConfig.port);
        log.info(
          `🔒 Service ${serviceName} restart ${isRunning ? 'successful' : 'failed'} - port ${serviceConfig.port} ${isRunning ? 'listening' : 'not listening'}`,
          LogContext.SERVICE
        );
        return isRunning;
      }

      return true;
    } catch (error) {
      log.error(`🔒 Failed to restart ${serviceName}`, LogContext.SERVICE, { serviceName, error });
      return false;
    }
  }

  async checkAndStartService(serviceName: string, port: number): Promise<boolean> {
    try {
      const isRunning = await this.checkPort(port);
      if (isRunning) {
        log.info(`✅ ${serviceName} is already running on port ${port}`, LogContext.SERVICE);
        return true;
      }

      log.info(`🚀 Starting ${serviceName} on port ${port}...`, LogContext.SERVICE);
      return await this.restartService(serviceName);
    } catch (error) {
      log.error(`Failed to check/start ${serviceName}`, LogContext.SERVICE, { serviceName, error });
      return false;
    }
  }

  async killPortProcess(port: number): Promise<boolean> {
    try {
      // Security: Validate port number to prevent command injection
      if (!this.validatePort(port)) {
        log.warn(`🔒 Invalid port number for kill operation: ${port}`, LogContext.SERVICE);
        return false;
      }

      log.info(`🔒 Killing process on port ${port} using secure commands...`, LogContext.SERVICE);

      if (process.platform === 'win32') {
        try {
          const result = await this.executeSecureCommand('netstat', ['-ano'], { timeout: 5000 });
          const lines = result.split('\n');
          const portsToKill = [];

          for (const line of lines) {
            if (line.includes(`:${port}`)) {
              const parts = line.trim().split(/\s+/);
              if (parts.length >= 5) {
                const pid = parts[4];
                // Security: Validate PID is numeric before using in command
                if (pid && /^\d+$/.test(pid) && this.validatePid(pid)) {
                  portsToKill.push(pid);
                }
              }
            }
          }

          for (const pid of portsToKill) {
            try {
              log.info(`🔒 Killing Windows process PID: ${pid}`, LogContext.SERVICE);
              await this.executeSecureCommand('taskkill', ['/PID', pid, '/F'], { timeout: 5000 });
            } catch (killError) {
              log.error(`🔒 Failed to kill PID ${pid}`, LogContext.SERVICE, { pid, killError });
            }
          }
        } catch (error) {
          log.error(`🔒 Windows port kill failed`, LogContext.SERVICE, { error });
          return false;
        }
      } else {
        try {
          // Use lsof to find processes on the port, then kill them individually
          const result = await this.executeSecureCommand('lsof', ['-ti', `:${port}`], {
            timeout: 5000,
          });
          const pids = result.split('\n').filter((pid) => pid.trim() && /^\d+$/.test(pid.trim()));

          for (const pid of pids) {
            if (this.validatePid(pid.trim())) {
              try {
                log.info(`🔒 Killing Unix process PID: ${pid.trim()}`, LogContext.SERVICE);
                await this.executeSecureCommand('kill', ['-9', pid.trim()], { timeout: 3000 });
              } catch (killError) {
                log.error(`🔒 Failed to kill PID ${pid}`, LogContext.SERVICE, { pid, killError });
              }
            }
          }
        } catch (lsofError) {
          log.error(`🔒 Unix port kill failed (lsof)`, LogContext.SERVICE, { lsofError });
          return false;
        }
      }

      await this.sleep(2000);

      // Verify port is free
      const isPortFree = !(await this.checkPort(port));
      log.info(`🔒 Port ${port} is ${isPortFree ? 'now free' : 'still in use'}`, LogContext.SERVICE);
      return isPortFree;
    } catch (error) {
      log.error(`🔒 Failed to kill process on port ${port}`, LogContext.SERVICE, { port, error });
      return false;
    }
  }

  async resetNetworkConfiguration(): Promise<boolean> {
    try {
      log.info('🔒 Resetting network configuration using secure commands...', LogContext.SERVICE);

      if (process.platform === 'darwin') {
        try {
          // macOS network reset
          log.info('🔒 Flushing DNS cache on macOS', LogContext.SERVICE);
          await this.executeSecureCommand('sudo', ['dscacheutil', '-flushcache'], {
            timeout: 5000,
          });

          log.info('🔒 Restarting mDNSResponder on macOS', LogContext.SERVICE);
          await this.executeSecureCommand('sudo', ['killall', '-HUP', 'mDNSResponder'], {
            timeout: 5000,
          });
        } catch (error) {
          log.error(`🔒 macOS network reset failed`, LogContext.SERVICE, { error });
          return false;
        }
      } else if (process.platform === 'linux') {
        try {
          // Linux network reset
          log.info('🔒 Restarting network services on Linux', LogContext.SERVICE);
          try {
            await this.executeSecureCommand('sudo', ['systemctl', 'restart', 'systemd-resolved'], {
              timeout: 10000,
            });
          } catch (systemdError) {
            log.warn('🔒 systemd-resolved restart failed, trying networking service', LogContext.SERVICE);
            try {
              await this.executeSecureCommand('sudo', ['service', 'networking', 'restart'], {
                timeout: 10000,
              });
            } catch (networkingError) {
              log.error(
                `🔒 Both network restart methods failed`,
                LogContext.SERVICE,
                { systemdError, networkingError }
              );
              return false;
            }
          }
        } catch (error) {
          log.error(`🔒 Linux network reset failed`, LogContext.SERVICE, { error });
          return false;
        }
      } else {
        log.warn(`🔒 Network reset not supported on platform: ${process.platform}`, LogContext.SERVICE);
        return false;
      }

      log.info('🔒 Network configuration reset completed', LogContext.SERVICE);
      return true;
    } catch (error) {
      log.error(`🔒 Network reset failed`, LogContext.SERVICE, { error });
      return false;
    }
  }

  async increaseTimeouts(): Promise<boolean> {
    try {
      log.info('⏱️ Increasing timeout settings...', LogContext.SERVICE);

      // Set environment variables for longer timeouts
      process.env.HTTP_TIMEOUT = '30000';
      process.env.REQUEST_TIMEOUT = '30000';
      process.env.CONNECT_TIMEOUT = '10000';

      return true;
    } catch (error) {
      log.error(`Failed to increase timeouts`, LogContext.SERVICE, { error });
      return false;
    }
  }

  private validatePid(pid: string): boolean {
    // Security: Validate PID is numeric and reasonable range
    return /^\d+$/.test(pid) && parseInt(pid) > 0 && parseInt(pid) <= 4194304;
  }

  async restartHighCpuProcesses(): Promise<boolean> {
    try {
      log.info('🔒 Restarting high CPU processes using secure commands...', LogContext.SERVICE);

      try {
        const psResult = await this.executeSecureCommand('ps', ['aux'], { timeout: 5000 });
        const highCpuProcesses = [];

        // Parse ps output and find high CPU processes
        const lines = psResult.split('\n').slice(1); // Skip header
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 3) {
            const cpuUsage = parseFloat(parts[2] || '0');
            const pid = parts[1] || '';

            if (!isNaN(cpuUsage) && cpuUsage > 50 && this.validatePid(pid)) {
              highCpuProcesses.push({ pid, cpu: cpuUsage, command: parts.slice(10).join(' ') });
            }
          }
        }

        // Limit to 3 processes for safety
        const processesToKill = highCpuProcesses.slice(0, 3);
        log.info(
          `🔒 Found ${highCpuProcesses.length} high CPU processes, killing top ${processesToKill.length}`,
          LogContext.SERVICE
        );

        for (const proc of processesToKill) {
          try {
            log.info(
              `🔒 Terminating high CPU process PID: ${proc.pid} (${proc.cpu}% CPU) - ${proc.command}`,
              LogContext.SERVICE
            );
            await this.executeSecureCommand('kill', ['-TERM', proc.pid || ''], { timeout: 3000 });

            // Give process time to terminate gracefully
            await this.sleep(1000);

            // Check if still running, force kill if necessary
            try {
              await this.executeSecureCommand('kill', ['-0', proc.pid || ''], { timeout: 1000 });
              log.warn(`🔒 Process ${proc.pid} still running, force killing`, LogContext.SERVICE);
              await this.executeSecureCommand('kill', ['-9', proc.pid || ''], { timeout: 3000 });
            } catch (checkError) {
              // Process already terminated, which is good
              log.info(`🔒 Process ${proc.pid} terminated successfully`, LogContext.SERVICE);
            }
          } catch (error) {
            log.error(`🔒 Failed to kill process ${proc.pid}`, LogContext.SERVICE, { pid: proc.pid, error });
          }
        }

        return true;
      } catch (psError) {
        log.error(`🔒 Failed to get process list`, LogContext.SERVICE, { psError });
        return false;
      }
    } catch (error) {
      log.error(`🔒 Failed to restart high CPU processes`, LogContext.SERVICE, { error });
      return false;
    }
  }

  async genericNetworkFix(): Promise<boolean> {
    try {
      log.info('🔒 Applying generic network fixes using secure commands...', LogContext.SERVICE);

      // Clear DNS cache and reset connections
      if (process.platform === 'darwin') {
        try {
          log.info('🔒 Flushing DNS cache for generic network fix', LogContext.SERVICE);
          await this.executeSecureCommand('sudo', ['dscacheutil', '-flushcache'], {
            timeout: 5000,
          });
        } catch (error) {
          log.error(`🔒 DNS cache flush failed`, LogContext.SERVICE, { error });
          return false;
        }
      } else if (process.platform === 'linux') {
        try {
          log.info('🔒 Flushing DNS cache on Linux', LogContext.SERVICE);
          await this.executeSecureCommand('sudo', ['systemctl', 'flush-dns'], { timeout: 5000 });
        } catch (error) {
          log.warn(`🔒 Linux DNS flush failed`, LogContext.SERVICE, { error });
          // Don't return false as this is not critical
        }
      }

      log.info('🔒 Generic network fix completed', LogContext.SERVICE);
      return true;
    } catch (error) {
      log.error(`🔒 Generic network fix failed`, LogContext.SERVICE, { error });
      return false;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getStatus(): object {
    const issues = Array.from(this.networkIssues.values());
    const criticalIssues = issues.filter((i) => i.severity === 'high');
    const recentHealings = this.completedHealings.slice(-10);

    return {
      isRunning: this.isRunning,
      activeIssues: issues.length,
      criticalIssues: criticalIssues.length,
      totalHealings: this.completedHealings.length,
      recentHealings: recentHealings.length,
      monitoredServices: this.coreServices.length,
      lastCheck: new Date().toISOString(),
      issues: issues.map((issue) => ({
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
    log.info('🛑 Network Healing Service stopped', LogContext.SERVICE);
  }
}

export { NetworkHealingService };
