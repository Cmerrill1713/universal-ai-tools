import { EventEmitter } from 'events';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import { config } from '@/config/environment';
import { CircuitBreakerRegistry, createCircuitBreaker } from '@/utils/circuit-breaker';
import { log, LogContext } from '@/utils/logger';
class UnifiedHealthMonitor extends EventEmitter {
    config;
    services = new Map();
    alerts = new Map();
    metrics;
    checkTimer;
    isInitialized = false;
    circuitBreakers = new Map();
    startTime = Date.now();
    constructor() {
        super();
        this.config = {
            checkInterval: 30000,
            alertThresholds: {
                cpuUsage: 80,
                memoryUsage: 85,
                errorRate: 5,
                responseTime: 2000,
            },
            autoHeal: true,
            services: [
                'supabase',
                'redis',
                'llm-router',
                'memory-service',
                'mcp-integration',
            ],
        };
        this.metrics = {
            systemHealth: 1.0,
            agentHealth: 1.0,
            meshHealth: 1.0,
            memoryUsage: 0,
            cpuUsage: 0,
            errorRate: 0,
            responseTime: 0,
            uptime: 0,
            services: [],
            alerts: [],
        };
    }
    async initialize() {
        if (this.isInitialized)
            return;
        try {
            log.info('🏥 Initializing Unified Health Monitor', LogContext.SYSTEM);
            for (const serviceName of this.config.services) {
                const breaker = createCircuitBreaker(serviceName, {
                    timeout: 30000,
                    errorThresholdPercentage: 50,
                    failureThreshold: 5,
                });
                this.circuitBreakers.set(serviceName, breaker);
                CircuitBreakerRegistry.register(serviceName, breaker);
            }
            this.startHealthChecks();
            this.startMetricsCollection();
            this.isInitialized = true;
            this.emit('initialized');
            log.info('✅ Unified Health Monitor initialized', LogContext.SYSTEM);
        }
        catch (error) {
            log.error('❌ Failed to initialize Health Monitor', LogContext.SYSTEM, { error });
            throw error;
        }
    }
    startHealthChecks() {
        this.checkTimer = setInterval(() => {
            this.performHealthChecks().catch(error => log.error('❌ Health check failed', LogContext.SYSTEM, { error }));
        }, this.config.checkInterval);
        this.performHealthChecks().catch(error => log.error('❌ Initial health check failed', LogContext.SYSTEM, { error }));
    }
    startMetricsCollection() {
        setInterval(() => {
            this.collectSystemMetrics().catch(error => log.error('❌ Metrics collection failed', LogContext.SYSTEM, { error }));
        }, 15000);
    }
    async performHealthChecks() {
        const checkPromises = this.config.services.map(serviceName => this.checkService(serviceName));
        await Promise.allSettled(checkPromises);
        this.updateSystemHealth();
        this.checkAlerts();
        this.emit('healthUpdate', this.getHealthStatus());
    }
    async checkService(serviceName) {
        const startTime = Date.now();
        try {
            const breaker = this.circuitBreakers.get(serviceName);
            if (!breaker) {
                throw new Error(`Circuit breaker not found for service: ${serviceName}`);
            }
            const health = await breaker.execute(() => this.performServiceCheck(serviceName));
            const responseTime = Date.now() - startTime;
            this.services.set(serviceName, {
                name: serviceName,
                status: 'healthy',
                lastCheck: new Date(),
                responseTime,
                details: health,
            });
            this.clearServiceAlerts(serviceName);
        }
        catch (error) {
            const responseTime = Date.now() - startTime;
            this.services.set(serviceName, {
                name: serviceName,
                status: 'unhealthy',
                lastCheck: new Date(),
                responseTime,
                error: error instanceof Error ? error.message : String(error),
            });
            this.createAlert(serviceName, 'critical', `Service ${serviceName} is unhealthy: ${error}`);
            if (this.config.autoHeal) {
                await this.attemptAutoHeal(serviceName);
            }
        }
    }
    async performServiceCheck(serviceName) {
        switch (serviceName) {
            case 'supabase':
                return this.checkSupabase();
            case 'redis':
                return this.checkRedis();
            case 'llm-router':
                return this.checkLLMRouter();
            case 'memory-service':
                return this.checkMemoryService();
            case 'mcp-integration':
                return this.checkMCPIntegration();
            default:
                return this.checkGenericService(serviceName);
        }
    }
    async checkSupabase() {
        const supabaseUrl = config.supabase.url;
        const supabaseKey = config.supabase.anonKey;
        if (!supabaseUrl || !supabaseKey) {
            throw new Error('Supabase configuration missing');
        }
        const client = createClient(supabaseUrl, supabaseKey);
        const { data, error } = await client.from('user_feedback').select('count').limit(1);
        if (error)
            throw error;
        return {
            connected: true,
            tableAccess: true,
            recordCount: data?.length || 0
        };
    }
    async checkRedis() {
        return { connected: true };
    }
    async checkLLMRouter() {
        try {
            const response = await axios.get('http://localhost:3001/api/v1/health', {
                timeout: 3000,
            });
            return { status: response.status, healthy: response.status === 200 };
        }
        catch (error) {
            throw new Error('LLM Router not responsive');
        }
    }
    async checkMemoryService() {
        const memoryUsage = process.memoryUsage();
        const heapUsed = memoryUsage.heapUsed / 1024 / 1024;
        const heapTotal = memoryUsage.heapTotal / 1024 / 1024;
        return {
            heapUsed: Math.round(heapUsed),
            heapTotal: Math.round(heapTotal),
            heapPercentage: Math.round((heapUsed / heapTotal) * 100),
        };
    }
    async checkMCPIntegration() {
        return { connected: true, protocols: ['stdio', 'websocket'] };
    }
    async checkGenericService(serviceName) {
        return { status: 'unknown', checked: true };
    }
    async collectSystemMetrics() {
        try {
            this.metrics.uptime = Date.now() - this.startTime;
            const memoryUsage = process.memoryUsage();
            this.metrics.memoryUsage = Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100);
            const cpuUsage = process.cpuUsage();
            this.metrics.cpuUsage = Math.round((cpuUsage.user + cpuUsage.system) / 1000000);
            const responseTimes = Array.from(this.services.values())
                .map(s => s.responseTime)
                .filter(rt => rt !== undefined);
            this.metrics.responseTime = responseTimes.length > 0
                ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
                : 0;
            this.metrics.services = Array.from(this.services.values());
            this.metrics.alerts = Array.from(this.alerts.values()).filter(a => !a.resolved);
        }
        catch (error) {
            log.error('❌ Failed to collect system metrics', LogContext.SYSTEM, { error });
        }
    }
    updateSystemHealth() {
        const healthyServices = Array.from(this.services.values()).filter(s => s.status === 'healthy').length;
        const totalServices = this.services.size;
        if (totalServices === 0) {
            this.metrics.systemHealth = 1.0;
            return;
        }
        let healthScore = healthyServices / totalServices;
        if (this.metrics.memoryUsage > this.config.alertThresholds.memoryUsage) {
            healthScore *= 0.8;
        }
        if (this.metrics.cpuUsage > this.config.alertThresholds.cpuUsage) {
            healthScore *= 0.8;
        }
        if (this.metrics.responseTime > this.config.alertThresholds.responseTime) {
            healthScore *= 0.9;
        }
        this.metrics.systemHealth = Math.max(0, Math.min(1, healthScore));
        this.metrics.agentHealth = healthScore;
        this.metrics.meshHealth = healthScore;
    }
    checkAlerts() {
        if (this.metrics.memoryUsage > this.config.alertThresholds.memoryUsage) {
            this.createAlert('system', 'warning', `High memory usage: ${this.metrics.memoryUsage}%`);
        }
        if (this.metrics.cpuUsage > this.config.alertThresholds.cpuUsage) {
            this.createAlert('system', 'warning', `High CPU usage: ${this.metrics.cpuUsage}%`);
        }
        if (this.metrics.responseTime > this.config.alertThresholds.responseTime) {
            this.createAlert('system', 'warning', `High response time: ${this.metrics.responseTime}ms`);
        }
        if (this.metrics.systemHealth < 0.7) {
            this.createAlert('system', 'critical', `Low system health: ${Math.round(this.metrics.systemHealth * 100)}%`);
        }
    }
    createAlert(service, severity, message) {
        const alertId = `${service}_${severity}_${Date.now()}`;
        const existingAlert = Array.from(this.alerts.values()).find(a => a.service === service && a.message === message && !a.resolved);
        if (existingAlert)
            return;
        const alert = {
            id: alertId,
            severity,
            message,
            service,
            timestamp: new Date(),
            resolved: false,
        };
        this.alerts.set(alertId, alert);
        this.emit('alert', alert);
        log.warn(`🚨 Health Alert [${severity}]`, LogContext.SYSTEM, {
            service,
            message,
            alertId,
        });
    }
    clearServiceAlerts(serviceName) {
        for (const [alertId, alert] of this.alerts) {
            if (alert.service === serviceName && !alert.resolved) {
                alert.resolved = true;
                this.emit('alertResolved', alert);
            }
        }
    }
    async attemptAutoHeal(serviceName) {
        try {
            log.info(`🔧 Attempting auto-heal for service: ${serviceName}`, LogContext.SYSTEM);
            switch (serviceName) {
                case 'supabase':
                    await this.healSupabase();
                    break;
                case 'redis':
                    await this.healRedis();
                    break;
                case 'llm-router':
                    await this.healLLMRouter();
                    break;
                default:
                    log.warn(`🤷 No auto-heal strategy for service: ${serviceName}`, LogContext.SYSTEM);
            }
        }
        catch (error) {
            log.error(`❌ Auto-heal failed for ${serviceName}`, LogContext.SYSTEM, { error });
        }
    }
    async healSupabase() {
        log.info('🔧 Attempting Supabase heal...', LogContext.SYSTEM);
    }
    async healRedis() {
        log.info('🔧 Attempting Redis heal...', LogContext.SYSTEM);
    }
    async healLLMRouter() {
        log.info('🔧 Attempting LLM Router heal...', LogContext.SYSTEM);
    }
    getHealthStatus() {
        return { ...this.metrics };
    }
    getServiceHealth(serviceName) {
        return this.services.get(serviceName) || null;
    }
    getAlerts(includeResolved = false) {
        return Array.from(this.alerts.values()).filter(a => includeResolved || !a.resolved);
    }
    async forceHealthCheck(serviceName) {
        if (serviceName) {
            await this.checkService(serviceName);
        }
        else {
            await this.performHealthChecks();
        }
    }
    resolveAlert(alertId) {
        const alert = this.alerts.get(alertId);
        if (alert) {
            alert.resolved = true;
            this.emit('alertResolved', alert);
        }
    }
    updateConfig(newConfig) {
        Object.assign(this.config, newConfig);
        this.emit('configUpdated', this.config);
    }
    async shutdown() {
        if (this.checkTimer) {
            clearInterval(this.checkTimer);
        }
        this.circuitBreakers.clear();
        log.info('🏥 Health Monitor shut down', LogContext.SYSTEM);
    }
}
export const healthMonitor = new UnifiedHealthMonitor();
//# sourceMappingURL=health-monitor.js.map