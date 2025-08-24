import { EventEmitter } from 'events';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'dead';
  lastCheck: Date;
  responseTime?: number;
  errorCount: number;
  memoryUsage?: number;
  cpuUsage?: number;
}

interface HealingStrategy {
  name: string;
  condition: (health: ServiceHealth) => boolean;
  action: (service: string) => Promise<void>;
  priority: number;
}

export class SelfHealingService extends EventEmitter {
  private services: Map<string, ServiceHealth> = new Map();
  private healingStrategies: HealingStrategy[] = [];
  private isMonitoring = false;
  private checkInterval = 30000; // 30 seconds
  private maxRetries = 3;
  private retryCount: Map<string, number> = new Map();

  constructor() {
    super();
    this.initializeStrategies();
    this.setupErrorHandlers();
  }

  private initializeStrategies(): void {
    // Strategy 1: Restart dead services
    this.healingStrategies.push({
      name: 'restart-dead',
      priority: 1,
      condition: (health) => health.status === 'dead',
      action: async (service) => {
        console.log(`🔧 Auto-healing: Restarting dead service ${service}`);
        await this.restartService(service);
      }
    });

    // Strategy 2: Clear memory for high usage
    this.healingStrategies.push({
      name: 'memory-optimization',
      priority: 2,
      condition: (health) => (health.memoryUsage || 0) > 80,
      action: async (service) => {
        console.log(`🧹 Auto-healing: Optimizing memory for ${service}`);
        await this.optimizeMemory(service);
      }
    });

    // Strategy 3: Circuit breaker for high error rates
    this.healingStrategies.push({
      name: 'circuit-breaker',
      priority: 3,
      condition: (health) => health.errorCount > 10,
      action: async (service) => {
        console.log(`⚡ Auto-healing: Activating circuit breaker for ${service}`);
        await this.activateCircuitBreaker(service);
      }
    });

    // Strategy 4: Performance optimization for slow responses
    this.healingStrategies.push({
      name: 'performance-tuning',
      priority: 4,
      condition: (health) => (health.responseTime || 0) > 1000,
      action: async (service) => {
        console.log(`⚡ Auto-healing: Tuning performance for ${service}`);
        await this.tunePerformance(service);
      }
    });

    // Sort strategies by priority
    this.healingStrategies.sort((a, b) => a.priority - b.priority);
  }

  private setupErrorHandlers(): void {
    process.on('uncaughtException', (error) => {
      console.error('🚨 Uncaught Exception detected, auto-healing...', error);
      this.handleCriticalError(error);
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('🚨 Unhandled Rejection detected, auto-healing...', reason);
      this.handleCriticalError(new Error(String(reason)));
    });

    // Monitor system resources
    setInterval(() => this.monitorSystemResources(), 10000);
  }

  public async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      console.log('⚠️ Monitoring already active');
      return;
    }

    this.isMonitoring = true;
    console.log('🚀 Starting self-healing monitoring system...');

    // Register core services
    this.registerService('go-api-gateway', 'http://localhost:8080/api/health');
    this.registerService('rust-llm-router', 'http://localhost:8082/health');
    this.registerService('rust-ai-core', 'http://localhost:8083/health');

    // Start monitoring loop
    this.monitoringLoop();
  }

  private registerService(name: string, healthEndpoint: string): void {
    this.services.set(name, {
      name,
      status: 'healthy',
      lastCheck: new Date(),
      errorCount: 0
    });

    console.log(`📝 Registered service: ${name}`);
  }

  private async monitoringLoop(): Promise<void> {
    while (this.isMonitoring) {
      await this.checkAllServices();
      await this.applyHealingStrategies();
      await this.sleep(this.checkInterval);
    }
  }

  private async checkAllServices(): Promise<void> {
    for (const [name, health] of this.services) {
      try {
        const startTime = Date.now();
        const isHealthy = await this.checkServiceHealth(name);
        const responseTime = Date.now() - startTime;

        health.responseTime = responseTime;
        health.lastCheck = new Date();

        if (isHealthy) {
          health.status = responseTime < 500 ? 'healthy' : 'degraded';
          health.errorCount = Math.max(0, health.errorCount - 1); // Decay error count
        } else {
          health.status = 'unhealthy';
          health.errorCount++;
        }

        // Check if service is completely dead
        if (health.errorCount > 5) {
          health.status = 'dead';
        }

      } catch (error) {
        console.error(`❌ Error checking ${name}:`, error);
        health.status = 'unhealthy';
        health.errorCount++;
      }
    }
  }

  private async checkServiceHealth(service: string): Promise<boolean> {
    // Simulate health check (replace with actual HTTP check)
    try {
      const endpoints: Record<string, string> = {
        'go-api-gateway': 'http://localhost:8080/api/health',
        'rust-llm-router': 'http://localhost:8082/health',
        'rust-ai-core': 'http://localhost:8083/health'
      };

      const endpoint = endpoints[service];
      if (!endpoint) return true;

      // In production, use fetch or axios
      const { stdout } = await execAsync(`curl -sf --max-time 2 ${endpoint}`);
      return stdout.includes('ok') || stdout.includes('healthy');
    } catch {
      return false;
    }
  }

  private async applyHealingStrategies(): Promise<void> {
    for (const [name, health] of this.services) {
      if (health.status === 'healthy') continue;

      for (const strategy of this.healingStrategies) {
        if (strategy.condition(health)) {
          try {
            console.log(`🔧 Applying ${strategy.name} to ${name}`);
            await strategy.action(name);
            
            // Reset retry count on successful healing
            this.retryCount.set(name, 0);
            break; // Apply only one strategy at a time
          } catch (error) {
            console.error(`❌ Healing strategy ${strategy.name} failed for ${name}:`, error);
            
            // Increment retry count
            const retries = (this.retryCount.get(name) || 0) + 1;
            this.retryCount.set(name, retries);

            if (retries >= this.maxRetries) {
              console.error(`🚨 Max retries reached for ${name}, escalating...`);
              this.escalateIssue(name, health);
            }
          }
        }
      }
    }
  }

  private async restartService(service: string): Promise<void> {
    const commands: Record<string, string> = {
      'go-api-gateway': 'cd go-api-gateway && go run cmd/main.go',
      'rust-llm-router': 'cd rust-services/llm-router && cargo run --release',
      'rust-ai-core': 'cd rust-services/ai-core && cargo run --release'
    };

    const command = commands[service];
    if (!command) return;

    // Kill existing process
    try {
      await execAsync(`pkill -f "${service}"`);
    } catch {
      // Process might not be running
    }

    // Start service
    exec(command, { cwd: '/Users/christianmerrill/Desktop/universal-ai-tools' });
    
    // Wait for service to start
    await this.sleep(5000);
  }

  private async optimizeMemory(service: string): Promise<void> {
    // Trigger garbage collection if possible
    if (global.gc) {
      global.gc();
    }

    // Clear caches
    await execAsync('rm -rf /tmp/uat-cache/* 2>/dev/null || true');

    // Send memory optimization signal to service
    try {
      await execAsync(`curl -X POST http://localhost:808X/admin/gc`);
    } catch {
      // Service might not support this endpoint
    }
  }

  private async activateCircuitBreaker(service: string): Promise<void> {
    const health = this.services.get(service);
    if (!health) return;

    // Temporarily mark as degraded to reduce load
    health.status = 'degraded';
    
    // Reset error count after cooldown
    setTimeout(() => {
      health.errorCount = 0;
      health.status = 'healthy';
    }, 60000); // 1 minute cooldown
  }

  private async tunePerformance(service: string): Promise<void> {
    // Adjust connection pool sizes, timeouts, etc.
    console.log(`⚙️ Tuning performance parameters for ${service}`);
    
    // This would typically involve API calls to the service
    // to adjust its configuration dynamically
  }

  private async monitorSystemResources(): Promise<void> {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMemPercent = ((totalMem - freeMem) / totalMem) * 100;

    if (usedMemPercent > 90) {
      console.warn(`⚠️ High memory usage: ${usedMemPercent.toFixed(2)}%`);
      this.emit('memory-pressure', usedMemPercent);
      
      // Trigger system-wide memory optimization
      for (const [name] of this.services) {
        await this.optimizeMemory(name);
      }
    }

    // Check CPU usage
    const cpus = os.cpus();
    const avgLoad = os.loadavg()[0];
    
    if (avgLoad > cpus.length * 0.8) {
      console.warn(`⚠️ High CPU load: ${avgLoad}`);
      this.emit('cpu-pressure', avgLoad);
    }
  }

  private handleCriticalError(error: Error): void {
    console.error('🚨 Critical error detected:', error);
    
    // Log to file
    import('fs').then(fs => {
      const logEntry = `[${new Date().toISOString()}] CRITICAL: ${error.message}\n${error.stack}\n\n`;
      fs.appendFileSync('/tmp/uat-autoheal/critical-errors.log', logEntry);
    }).catch(console.error);

    // Attempt recovery
    this.attemptRecovery(error);
  }

  private attemptRecovery(error: Error): void {
    // Pattern matching for common errors
    const patterns = [
      { pattern: /EADDRINUSE/, action: () => this.handlePortConflict(error) },
      { pattern: /ENOMEM/, action: () => this.handleMemoryError(error) },
      { pattern: /ECONNREFUSED/, action: () => this.handleConnectionError(error) },
      { pattern: /TypeError/, action: () => this.handleTypeError(error) }
    ];

    for (const { pattern, action } of patterns) {
      if (pattern.test(error.message)) {
        action();
        return;
      }
    }

    // Generic recovery
    console.log('🔧 Attempting generic recovery...');
    this.restartAllServices();
  }

  private async handlePortConflict(error: Error): Promise<void> {
    console.log('🔧 Handling port conflict...');
    const portMatch = error.message.match(/:(\d+)/);
    if (portMatch) {
      const port = portMatch[1];
      await execAsync(`lsof -ti :${port} | xargs kill -9`).catch(() => {});
    }
  }

  private handleMemoryError(error: Error): void {
    console.log('🔧 Handling memory error...');
    if (global.gc) global.gc();
    this.emit('memory-critical');
  }

  private handleConnectionError(error: Error): void {
    console.log('🔧 Handling connection error...');
    // Restart affected services
    this.restartAllServices();
  }

  private handleTypeError(error: Error): void {
    console.log('🔧 Handling type error...');
    // Log for debugging but continue operation
    console.error('Type error details:', error);
  }

  private async restartAllServices(): Promise<void> {
    console.log('🔄 Restarting all services...');
    for (const [name] of this.services) {
      await this.restartService(name);
    }
  }

  private escalateIssue(service: string, health: ServiceHealth): void {
    console.error(`🚨 ESCALATION: Service ${service} cannot be healed automatically`);
    console.error('Health status:', health);
    
    // In production, this would send alerts to monitoring systems
    this.emit('escalation', { service, health });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public stopMonitoring(): void {
    this.isMonitoring = false;
    console.log('🛑 Stopping self-healing monitoring system');
  }
}

// Export singleton instance
export const selfHealingService = new SelfHealingService();

// Auto-start if running as main module
if (require.main === module) {
  selfHealingService.startMonitoring().catch(console.error);
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n👋 Shutting down self-healing service...');
    selfHealingService.stopMonitoring();
    process.exit(0);
  });
}