/**
 * SystemControlAgent - macOS system integration and control
 * Provides system automation, application management, network monitoring, and resource optimization
 */

import type { AgentConfig, AgentContext, AgentResponse } from '../base_agent';
import { BaseAgent } from '../base_agent';
import type { SupabaseClient } from '@supabase/supabase-js';
import { execSync, spawn } from 'child_process';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import axios from 'axios';
import { TIME_500MS, TIME_1000MS, TIME_2000MS, TIME_5000MS, TIME_10000MS, ZERO_POINT_FIVE, ZERO_POINT_EIGHT, ZERO_POINT_NINE, BATCH_SIZE_10, MAX_ITEMS_100, PERCENT_10, PERCENT_20, PERCENT_30, PERCENT_50, PERCENT_80, PERCENT_90, PERCENT_100, HTTP_200, HTTP_400, HTTP_401, HTTP_404, HTTP_500 } from "../utils/common-constants";

interface SystemMetrics {
  cpu: {
    usage: number;
    temperature?: number;
    cores: number;
    model: string;
  };
  memory: {
    total: number;
    used: number;
    available: number;
    pressure: 'normal' | 'warning' | 'critical';
  };
  disk: {
    total: number;
    used: number;
    available: number;
    health: 'good' | 'warning' | 'critical';
  };
  network: {
    download: number;
    upload: number;
    latency: number;
    connected: boolean;
  };
  battery?: {
    level: number;
    isCharging: boolean;
    timeRemaining?: number;
    health: 'normal' | 'replace_soon' | 'replace_now';
  };
}

interface ApplicationInfo {
  name: string;
  bundleId: string;
  version: string;
  isRunning: boolean;
  pid?: number;
  cpuUsage?: number;
  memoryUsage?: number;
  windowCount?: number;
}

interface NetworkConnection {
  ssid?: string;
  signalStrength?: number;
  security: string;
  ipAddress: string;
  gateway: string;
  dns: string[];
  isActive: boolean;
}

interface SystemPreferences {
  appearance: 'light' | 'dark' | 'auto';
  doNotDisturb: boolean;
  volume: number;
  brightness: number;
  energySaver: boolean;
  bluetooth: boolean;
  wifi: boolean;
}

export class SystemControlAgent extends BaseAgent {
  private supabase: SupabaseClient;
  private systemMonitoringInterval?: NodeJS.Timeout;
  private lastMetrics?: SystemMetrics;
  private runningApplications: Map<string, ApplicationInfo> = new Map();

  constructor(supabase: SupabaseClient) {
    const config: AgentConfig = {
      name: 'system_control',
      description: 'macOS system integration and intelligent automation',
      priority: 7,
      capabilities: [
        {
          name: 'system_status',
          description: 'Get comprehensive system status and metrics',
          inputSchema: {
            type: 'object',
            properties: {
              detailed: { type: 'boolean' },
              includeApps: { type: 'boolean' },
              includeNetwork: { type: 'boolean' },
            },
          },
          outputSchema: {
            type: 'object',
            properties: {
              metrics: { type: 'object' },
              applications: { type: 'array' },
              network: { type: 'object' },
              recommendations: { type: 'array' },
            },
          },
        },
        {
          name: 'app_control',
          description: 'Launch, quit, and manage applications',
          inputSchema: {
            type: 'object',
            properties: {
              action: { type: 'string', enum: ['launch', 'quit', 'restart', 'focus', 'hide'] },
              application: { type: 'string' },
              arguments: { type: 'array' },
            },
            required: ['action', 'application'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              pid: { type: 'number' },
              message: { type: 'string' },
            },
          },
        },
        {
          name: 'system_preferences',
          description: 'Get and set system preferences',
          inputSchema: {
            type: 'object',
            properties: {
              action: { type: 'string', enum: ['get', 'set'] },
              preference: { type: 'string' },
              value: { type: 'string' },
            },
            required: ['action'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              preferences: { type: 'object' },
              changed: { type: 'boolean' },
            },
          },
        },
        {
          name: 'automation',
          description: 'Create and execute system automation workflows',
          inputSchema: {
            type: 'object',
            properties: {
              workflow: { type: 'string' },
              trigger: { type: 'string' },
              actions: { type: 'array' },
            },
            required: ['workflow'],
          },
          outputSchema: {
            type: 'object',
            properties: {
              executed: { type: 'boolean' },
              results: { type: 'array' },
            },
          },
        },
      ],
      maxLatencyMs: 5000,
      retryAttempts: 2,
      dependencies: ['ollama_assistant'],
      memoryEnabled: true,
    };

    super(config);
    this.supabase = supabase;
  }

  protected async onInitialize())): Promise<void> {
    // Check macOS version and capabilities
    await this.checkSystemCapabilities();

    // Initialize system monitoring
    await this.startSystemMonitoring();

    // Load automation rules
    await this.loadAutomationRules();

    this.logger.info('✅ SystemControlAgent initialized with macOS integration');
  }

  protected async process(_context: AgentContext & { memoryContext?: any }): Promise<AgentResponse> {
    const { userRequest } = context;
    const startTime = Date.now();

    try {
      // Parse the user request to determine system operation
      const intent = await this.parseSystemIntent(userRequest);

      let result: any;

      switch (intent.action) {
        case 'status':
          result = await this.getSystemStatus(intent);
          break;

        case 'launch':
        case 'quit':
        case 'focus':
          result = await this.controlApplication(intent);
          break;

        case 'preferences':
          result = await this.manageSystemPreferences(intent);
          break;

        case 'optimize':
          result = await this.optimizeSystem(intent);
          break;

        case 'monitor':
          result = await this.monitorResource(intent);
          break;

        case 'network':
          result = await this.manageNetwork(intent);
          break;

        case 'automate':
          result = await this.executeAutomation(intent);
          break;

        case 'backup':
          result = await this.manageBackup(intent);
          break;

        default:
          result = await this.handleGeneralSystemQuery(userRequest);
      }

      const confidence = this.calculateSystemConfidence(intent, result;

      return {
        success: true,
        data: result,
        reasoning: this.buildSystemReasoning(intent, result,
        confidence,
        latencyMs: Date.now() - startTime,
        agentId: this.config.name,
        nextActions: this.suggestSystemActions(intent, result,
      };
    } catch (error) {
      this.logger.error('SystemControlAgent proces, error;
      return {
        success: false,
        data: null,
        reasoning: `System operation failed: ${(error as Error).message}`,
        confidence: 0.1,
        latencyMs: Date.now() - startTime,
        agentId: this.config.name,
        _error (error as Error).message,
      };
    }
  }

  protected async onShutdown())): Promise<void> {
    // Stop system monitoring
    if (this.systemMonitoringInterval) {
      clearInterval(this.systemMonitoringInterval);
    }

    this.logger.info('SystemControlAgent shutting down');
  }

  /**
   * Parse system control intent from natural language
   */
  private async parseSystemIntent(request: string): Promise<unknown> {
    const prompt = `Parse this macOS system control request;`

Request: "${request"

Determine:
1. Action (status, launch, quit, preferences, optimize, monitor, network, automate, backup
2. Target (application name, preference name, resource: type
3. Parameters (specific values, options
4. Context (user preference, system: state

Respond with JSON: {
  "action": "...",
  "target": "...",
  "parameters": {...},
  "context": "..."
}`;

    try {
      const response = await axios.post('http://localhost:11434/api/generate', {
        model: 'llama3.2:3b',
        prompt,
        stream: false,
        format: 'json',
      });

      return JSON.parse(response.data.response);
    } catch (error) {
      return this.fallbackSystemIntentParsing(request;
    }
  }

  /**
   * Get comprehensive system status
   */
  private async getSystemStatus(intent: any): Promise<unknown> {
    const detailed = intent.parameters?.detailed || false;
    const includeApps = intent.parameters?.includeApps || false;
    const includeNetwork = intent.parameters?.includeNetwork || false;

    // Collect system metrics
    const metrics = await this.collectSystemMetrics();

    let applications: ApplicationInfo[] = [];
    if (includeApps) {
      applications = await this.getRunningApplications();
    }

    let network: NetworkConnection | null = null;
    if (includeNetwork) {
      network = await this.getNetworkStatus();
    }

    // Generate recommendations based on metrics
    const recommendations = await this.generateSystemRecommendations(metrics);

    // Store metrics for historical analysis
    await this.storeSystemMetrics(metrics);

    return {
      metrics,
      applications,
      network,
      recommendations,
      timestamp: new Date().toISOString(),
      detailed,
    };
  }

  /**
   * Control applications (launch, quit, focus, etc.)
   */
  private async controlApplication(intent: any): Promise<unknown> {
    const { action } = intent;
    const appName = intent.target;
    const args = intent.parameters?.arguments || [];

    let success = false;
    let pid: number | undefined;
    let message = '';

    try {
      switch (action) {
        case 'launch':
          const result = await this.launchApplication(appName, args;
          success = result.success;
          pid = result.pid;
          message = result.message;
          break;

        case 'quit':
          success = await this.quitApplication(appName);
          message = success ? `Successfully quit ${appName}` : `Failed to quit ${appName}`;
          break;

        case 'focus':
          success = await this.focusApplication(appName);
          message = success ? `Brought ${appName} to front` : `Failed to focus ${appName}`;
          break;

        case 'hide':
          success = await this.hideApplication(appName);
          message = success ? `Hidden ${appName}` : `Failed to hide ${appName}`;
          break;

        case 'restart':
          await this.quitApplication(appName);
          setTimeout(async () => {
            const restartResult = await this.launchApplication(appName, args;
            success = restartResult.success;
            pid = restartResult.pid;
          }, 2000);
          message = `Restarting ${appName}`;
          break;
      }

      // Update application cache
      await this.updateApplicationCache();
    } catch (error) {
      message = `Application control failed: ${(error as Error).message}`;
    }

    return {
      action,
      application: appName,
      success,
      pid,
      message,
    };
  }

  /**
   * Manage system preferences
   */
  private async manageSystemPreferences(intent: any): Promise<unknown> {
    const action = intent.parameters?.action || 'get';
    const preference = intent.parameters?.preference;
    const value = intent.parameters?.value;

    let preferences: SystemPreferences;
    let changed = false;

    if (action === 'get') {
      preferences = await this.getSystemPreferences();
    } else {
      preferences = await this.setSystemPreference(preference, value;
      changed = true;
    }

    return {
      action,
      preferences,
      changed,
      preference,
      value,
    };
  }

  /**
   * Collect comprehensive system metrics
   */
  private async collectSystemMetrics(): Promise<SystemMetrics> {
    const metrics: SystemMetrics = {
      cpu: await this.getCPUMetrics(),
      memory: await this.getMemoryMetrics(),
      disk: await this.getDiskMetrics(),
      network: await this.getNetworkMetrics(),
    };

    // Add battery metrics for laptops
    const batteryInfo = await this.getBatteryMetrics();
    if (batteryInfo) {
      metrics.battery = batteryInfo;
    }

    this.lastMetrics = metrics;
    return metrics;
  }

  /**
   * Get CPU metrics
   */
  private async getCPUMetrics(): Promise<SystemMetrics['cpu']> {
    try {
      // Get CPU usage using top command
      const topOutput = execSync('top -l 1 -n 0 | grep "CPU usage"', { encoding: 'utf8' });
      const cpuMatch = topOutput.match(/(\d+\.\d+)% user/);
      const usage = cpuMatch ? parseFloat(cpuMatch[1]) : 0;

      // Get CPU info
      const cpuInfo = os.cpus()[0];

      return {
        usage,
        cores: os.cpus().length,
        model: cpuInfo.model,
      };
    } catch (error) {
      this.logger.error('Failed to get CPU metric, (error as Error).message);
      return {
        usage: 0,
        cores: os.cpus().length,
        model: 'Unknown',
      };
    }
  }

  /**
   * Get memory metrics
   */
  private async getMemoryMetrics(): Promise<SystemMetrics['memory']> {
    try {
      const total = os.totalmem();
      const free = os.freemem();
      const used = total - free;

      // Get memory pressure
      const pressureOutput = execSync('memory_pressure', { encoding: 'utf8' });
      let pressure: 'normal' | 'warning' | 'critical' = 'normal';

      if (pressureOutput.includes('warn')) pressure = 'warning';
      if (pressureOutput.includes('critical')) pressure = 'critical';

      return {
        total,
        used,
        available: free,
        pressure,
      };
    } catch (error) {
      this.logger.error('Failed to get memory metric, error;
      const total = os.totalmem();
      const free = os.freemem();

      return {
        total,
        used: total - free,
        available: free,
        pressure: 'normal',
      };
    }
  }

  /**
   * Get disk metrics
   */
  private async getDiskMetrics(): Promise<SystemMetrics['disk']> {
    try {
      const dfOutput = execSync('df -h /', { encoding: 'utf8' });
      const lines = dfOutput.split('\n');
      const diskLine = lines[1];
      const parts = diskLine.split(/\s+/);

      const total = this.parseSize(parts[1]);
      const used = this.parseSize(parts[2]);
      const available = this.parseSize(parts[3]);

      // Determine disk health based on usage
      const usagePercent = (used / total) * 100;
      let health: 'good' | 'warning' | 'critical' = 'good';

      if (usagePercent > 85) health = 'warning';
      if (usagePercent > 95) health = 'critical';

      return {
        total,
        used,
        available,
        health,
      };
    } catch (error) {
      this.logger.error('Failed to get disk metric, error;
      return {
        total: 0,
        used: 0,
        available: 0,
        health: 'good',
      };
    }
  }

  /**
   * Get network metrics
   */
  private async getNetworkMetrics(): Promise<SystemMetrics['network']> {
    try {
      // Check network connectivity
      const pingOutput = execSync('ping -c 1 8.8.8.8', { encoding: 'utf8' });
      const latencyMatch = pingOutput.match(/time=(\d+\.\d+) ms/);
      const latency = latencyMatch ? parseFloat(latencyMatch[1]) : 0;
      const connected = !pingOutput.includes('100.0% packet loss');

      return {
        download: 0, // Would need more complex monitoring for actual speeds
        upload: 0,
        latency,
        connected,
      };
    } catch (error) {
      return {
        download: 0,
        upload: 0,
        latency: 0,
        connected: false,
      };
    }
  }

  /**
   * Get battery metrics (for laptops)
   */
  private async getBatteryMetrics(): Promise<SystemMetrics['battery'] | null> {
    try {
      const batteryOutput = execSync('pmset -g batt', { encoding: 'utf8' });

      if (batteryOutput.includes('Battery Power')) {
        const levelMatch = batteryOutput.match(/(\d+)%/);
        const level = levelMatch ? parseInt(levelMatch[1], 10) : 0;
        const isCharging = batteryOutput.includes('charging');

        return {
          level,
          isCharging,
          health: 'normal', // Would need more detailed battery health check
        };
      }

      return null; // Desktop machine
    } catch (error) {
      return null;
    }
  }

  /**
   * Launch application
   */
  private async launchApplication(appName: string, args: string[] = [])): Promise<unknown> {
    try {
      const command = `open -a "${appName}"${args.length > 0 ? ` --args ${args.join(' ')}` : ''}`;
      execSync(command);

      // Wait a moment for the app to start
      await new Promise((resolve) => setTimeout(TIME_1000MS));

      // Try to get the PID
      const pid = await this.getApplicationPID(appName);

      return {
        success: true,
        pid,
        message: `Successfully launched ${appName}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to launch ${appName}: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Quit application
   */
  private async quitApplication(appName: string: Promise<boolean> {
    try {
      execSync(`osascript -e 'tell application "${appName}" to quit'`);
      return true;
    } catch (error) {
      this.logger.error(Failed to quit ${appName}:`, error);`
      return false;
    }
  }

  /**
   * Focus application (bring to: front
   */
  private async focusApplication(appName: string: Promise<boolean> {
    try {
      execSync(`osascript -e 'tell application "${appName}" to activate'`);
      return true;
    } catch (error) {
      this.logger.error(Failed to focu, error;
      return false;
    }
  }

  /**
   * Hide application
   */
  private async hideApplication(appName: string: Promise<boolean> {
    try {
      execSync(
        `osascript -e 'tell application "System Events" to set visible of process "${appName}" to false'``
      );
      return true;
    } catch (error) {
      this.logger.error(Failed to hide ${appName}:`, error);`
      return false;
    }
  }

  /**
   * Get running applications
   */
  private async getRunningApplications(): Promise<ApplicationInfo[]> {
    try {
      const psOutput = execSync('ps aux', { encoding: 'utf8' });
      const lines = psOutput.split('\n').slice(1); // Skip header

      const applications: ApplicationInfo[] = [];

      for (const line of lines) {
        const parts = line.split(/\s+/);
        if (parts.length < 11) continue;

        const pid = parseInt(parts[1], 10);
        const cpuUsage = parseFloat(parts[2]);
        const memoryUsage = parseFloat(parts[3]);
        const command = parts.slice(10).join(' ');

        // Filter for GUI applications
        if (command.includes('.app/Contents/MacOS/')) {
          const appMatch = command.match(/([^\/]+)\.app\/Contents\/MacOS\/([^\/\s]+)/);
          if (appMatch) {
            const appName = appMatch[1];

            applications.push({
              name: appName,
              bundleId: '', // Would need additional lookup
              version: '', // Would need additional lookup
              isRunning: true,
              pid,
              cpuUsage,
              memoryUsage,
            });
          }
        }
      }

      return applications;
    } catch (error) {
      this.logger.error('Failed to get running application, error;
      return [];
    }
  }

  // Placeholder implementations for complex methods
  private async checkSystemCapabilities())): Promise<void> {
    // Check macOS version and available system APIs
  }

  private async startSystemMonitoring())): Promise<void> {
    // Start periodic system monitoring
    this.systemMonitoringInterval = setInterval(async () => {
      await this.collectSystemMetrics();
    }, 60000); // Every minute
  }

  private async loadAutomationRules())): Promise<void> {
    // Load automation rules from database
  }

  private fallbackSystemIntentParsing(request: string): any {
    const requestLower = request toLowerCase();

    if (requestLower.includes('status') || requestLower.includes('system')) {
      return { action: 'status' };
    }

    if (requestLower.includes('launch') || requestLower.includes('open')) {
      return { action: 'launch' };
    }

    if (requestLower.includes('quit') || requestLower.includes('close')) {
      return { action: 'quit' };
    }

    return { action: 'status' };
  }

  private async generateSystemRecommendations(metrics: SystemMetrics: Promise<string[]> {
    const recommendations: string[] = [];

    if (metrics.cpu.usage > 80) {
      recommendations.push('High CPU usage detected - consider closing unused applications');
    }

    if (metrics.memory.pressure === 'warning') {
      recommendations.push('Memory pressure detected - restart some applications');
    }

    if (metrics.disk.health === 'warning') {
      recommendations.push('Disk space running low - clean up files or move to external storage');
    }

    return recommendations;
  }

  private async storeSystemMetrics(metrics: SystemMetrics)): Promise<void> {
    try {
      await this.supabase.from('ai_memories').insert({
        service_id: 'system_control',
        memory_type: 'system_metrics',
        content `System metrics: CPU ${metrics.cpu.usage}%, Memory ${Math.round((metrics.memory.used / metrics.memory.total) * 100)}%`,
        metadata: metrics,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error('Failed to store system metric, (error as Error).message);
    }
  }

  private parseSize(sizeStr: string: number {
    const match = sizeStr.match(/^(\d+(?:\.\d+)?)([KMGT]?)$/);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const unit = match[2];

    const multipliers: { [key: string]: number } = {
      '': 1,
      K: 1024,
      M: 1024 * 1024,
      G: 1024 * 1024 * 1024,
      T: 1024 * 1024 * 1024 * 1024,
    };

    return value * (multipliers[unit] || 1);
  }

  private async getApplicationPID(appName: string: Promise<number | undefined> {
    try {
      const output = execSync(`pgrep -f "${appName}"`, { encoding: 'utf8' });`
      const pid = parseInt(output.trim(, 10).split('\n')[0]);
      return isNaN(pid) ? undefined : pid;
    } catch (error) {
      return undefined;
    }
  }

  private async updateApplicationCache())): Promise<void> {
    // Update running applications cache
  }

  private async getSystemPreferences(): Promise<SystemPreferences> {
    // Get current system preferences
    return {
      appearance: 'light',
      doNotDisturb: false,
      volume: 50,
      brightness: 75,
      energySaver: false,
      bluetooth: true,
      wifi: true,
    };
  }

  private async setSystemPreference(preference: string, value: string: Promise<SystemPreferences> {
    // Set system preference
    return await this.getSystemPreferences();
  }

  private async getNetworkStatus(): Promise<NetworkConnection> {
    // Get detailed network status
    return {
      security: 'WPA2',
      ipAddress: '192.168.1.100',
      gateway: '192.168.1.1',
      dns: ['8.8.8.8', '8.8.4.4'],
      isActive: true,
    };
  }

  private calculateSystemConfidence(intent: any, result: any: number {
    return 0.8;
  }

  private buildSystemReasoning(intent: any, result: any: string {
    return `Processed system ${intent.action} operation`;
  }

  private suggestSystemActions(intent: any, result: any: string[] {
    return ['Monitor system performance', 'Set up automation rules'];
  }

  private async optimizeSystem(intent: any): Promise<unknown> {
    return { optimized: true, };
  }

  private async monitorResource(intent: any): Promise<unknown> {
    return { monitoring: true, };
  }

  private async manageNetwork(intent: any): Promise<unknown> {
    return { network: 'managed' };
  }

  private async executeAutomation(intent: any): Promise<unknown> {
    return { executed: true, };
  }

  private async manageBackup(intent: any): Promise<unknown> {
    return { backup: 'managed' };
  }

  private async handleGeneralSystemQuery(request: string): Promise<unknown> {
    return { response: 'General system query processed' };
  }
}

export default SystemControlAgent;
