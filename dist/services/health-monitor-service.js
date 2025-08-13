import { EventEmitter } from 'events';
import { log, LogContext } from '@/utils/logger';
import { a2aMesh } from './a2a-communication-mesh';
export class HealthMonitorService extends EventEmitter {
    agentRegistry = null;
    healthHistory = [];
    activeIssues = new Map();
    monitoringInterval = null;
    healingInterval = null;
    isMonitoring = false;
    constructor() {
        super();
        this.startMonitoring();
    }
    setAgentRegistry(agentRegistry) {
        this.agentRegistry = agentRegistry;
    }
    startMonitoring() {
        if (this.isMonitoring)
            return;
        this.isMonitoring = true;
        this.monitoringInterval = setInterval(() => {
            this.performHealthCheck();
        }, 120000);
        this.healingInterval = setInterval(() => {
            this.performSelfHealing();
        }, 300000);
        log.info('🏥 Health monitoring started', LogContext.SYSTEM);
    }
    async performHealthCheck() {
        try {
            const metrics = {
                systemHealth: 0,
                agentHealth: 0,
                meshHealth: 0,
                memoryUsage: process.memoryUsage().heapUsed / process.memoryUsage().heapTotal,
                cpuUsage: process.cpuUsage().user / 1000000,
                errorRate: this.calculateErrorRate(),
                responseTime: await this.measureResponseTime(),
                timestamp: new Date(),
            };
            if (this.agentRegistry) {
                const meshStatus = this.agentRegistry.getMeshStatus();
                metrics.agentHealth = meshStatus.meshHealth || 0;
                metrics.meshHealth = meshStatus.meshHealth || 0;
            }
            metrics.systemHealth = this.calculateSystemHealth(metrics);
            this.healthHistory.push(metrics);
            if (this.healthHistory.length > 100) {
                this.healthHistory = this.healthHistory.slice(-100);
            }
            this.detectIssues(metrics);
            this.emit('health_update', metrics);
            return metrics;
        }
        catch (error) {
            log.error('❌ Health check failed', LogContext.SYSTEM, { error });
            throw error;
        }
    }
    calculateSystemHealth(metrics) {
        const weights = {
            agentHealth: 0.3,
            meshHealth: 0.2,
            memoryUsage: 0.2,
            cpuUsage: 0.1,
            errorRate: 0.1,
            responseTime: 0.1,
        };
        let health = 0;
        health += metrics.agentHealth * weights.agentHealth;
        health += metrics.meshHealth * weights.meshHealth;
        health += (1 - Math.min(metrics.memoryUsage, 1)) * weights.memoryUsage;
        health += (1 - Math.min(metrics.cpuUsage / 100, 1)) * weights.cpuUsage;
        health += (1 - Math.min(metrics.errorRate, 1)) * weights.errorRate;
        health += (1 - Math.min(metrics.responseTime / 5000, 1)) * weights.responseTime;
        return Math.max(0, Math.min(1, health));
    }
    calculateErrorRate() {
        const recentMetrics = this.healthHistory.slice(-10);
        if (recentMetrics.length === 0)
            return 0;
        const totalErrors = recentMetrics.reduce((sum, m) => sum + (m.errorRate || 0), 0);
        return totalErrors / recentMetrics.length;
    }
    async measureResponseTime() {
        const start = Date.now();
        try {
            await new Promise((resolve) => setTimeout(resolve, 1));
            return Date.now() - start;
        }
        catch {
            return 5000;
        }
    }
    detectIssues(metrics) {
        const issues = [];
        if (metrics.memoryUsage > 0.85) {
            issues.push({
                id: 'high_memory_usage',
                severity: metrics.memoryUsage > 0.95 ? 'critical' : 'high',
                component: 'system',
                description: `High memory usage: ${Math.round(metrics.memoryUsage * 100)}%`,
                autoFixable: true,
                timestamp: new Date(),
            });
        }
        if (metrics.agentHealth < 0.5) {
            issues.push({
                id: 'low_agent_health',
                severity: metrics.agentHealth < 0.2 ? 'critical' : 'high',
                component: 'agents',
                description: `Low agent health: ${Math.round(metrics.agentHealth * 100)}%`,
                autoFixable: true,
                timestamp: new Date(),
            });
        }
        if (metrics.meshHealth < 0.3) {
            issues.push({
                id: 'mesh_connectivity',
                severity: 'high',
                component: 'mesh',
                description: `Poor mesh connectivity: ${Math.round(metrics.meshHealth * 100)}%`,
                autoFixable: true,
                timestamp: new Date(),
            });
        }
        if (metrics.errorRate > 0.1) {
            issues.push({
                id: 'high_error_rate',
                severity: metrics.errorRate > 0.3 ? 'critical' : 'medium',
                component: 'system',
                description: `High error rate: ${Math.round(metrics.errorRate * 100)}%`,
                autoFixable: false,
                timestamp: new Date(),
            });
        }
        for (const issue of issues) {
            if (!this.activeIssues.has(issue.id)) {
                this.activeIssues.set(issue.id, issue);
                this.emit('issue_detected', issue);
                log.warn(`🚨 Health issue detected: ${issue.description}`, LogContext.SYSTEM, {
                    severity: issue.severity,
                    component: issue.component,
                });
            }
        }
        for (const [issueId, issue] of this.activeIssues) {
            if (!issues.find((i) => i.id === issueId)) {
                this.activeIssues.delete(issueId);
                this.emit('issue_resolved', issue);
                log.info(`✅ Health issue resolved: ${issue.description}`, LogContext.SYSTEM);
            }
        }
    }
    async performSelfHealing() {
        if (this.activeIssues.size === 0)
            return;
        log.info('🔧 Performing self-healing actions', LogContext.SYSTEM, {
            issues: this.activeIssues.size,
        });
        for (const [issueId, issue] of this.activeIssues) {
            if (!issue.autoFixable)
                continue;
            try {
                await this.healIssue(issue);
                log.info(`✅ Auto-healed issue: ${issue.description}`, LogContext.SYSTEM);
            }
            catch (error) {
                log.error(`❌ Failed to auto-heal issue: ${issue.description}`, LogContext.SYSTEM, {
                    error,
                });
            }
        }
    }
    async healIssue(issue) {
        switch (issue.id) {
            case 'high_memory_usage':
                await this.healMemoryUsage();
                break;
            case 'low_agent_health':
                await this.healAgentHealth();
                break;
            case 'mesh_connectivity':
                await this.healMeshConnectivity();
                break;
            default:
                log.warn(`No healing strategy for issue: ${issue.id}`, LogContext.SYSTEM);
        }
    }
    async healMemoryUsage() {
        if (global.gc) {
            global.gc();
        }
        if (this.agentRegistry) {
            await this.agentRegistry.unloadIdleAgents(15);
        }
        if (this.healthHistory.length > 50) {
            this.healthHistory = this.healthHistory.slice(-50);
        }
        try {
            const { lfm2Bridge } = await import('@/services/lfm2-bridge');
            const latest = this.healthHistory.slice(-2);
            if (latest.length === 2 && latest.every((m) => m.memoryUsage > 0.85)) {
                await lfm2Bridge.restart?.();
                log.info('🔄 Requested LFM2 restart due to sustained high memory', LogContext.AI);
            }
        }
        catch {
        }
    }
    async healAgentHealth() {
        if (!this.agentRegistry)
            return;
        try {
            const coreAgents = this.agentRegistry.getCoreAgents();
            for (const agentName of coreAgents) {
                try {
                    const agent = await this.agentRegistry.getAgent(agentName);
                    if (agent) {
                        log.info(`🔄 Restarting agent: ${agentName}`, LogContext.AGENT);
                        await agent.initialize();
                    }
                }
                catch (error) {
                    log.error(`Failed to restart agent: ${agentName}`, LogContext.AGENT, { error });
                }
            }
        }
        catch (error) {
            log.error('Failed to heal agent health', LogContext.SYSTEM, { error });
        }
    }
    async healMeshConnectivity() {
        try {
            const connections = a2aMesh.getAgentConnections();
            const offlineAgents = connections.filter((conn) => conn.status === 'offline');
            for (const conn of offlineAgents) {
                try {
                    a2aMesh.registerAgent(conn.agentName, conn.capabilities, conn.trustLevel);
                    log.info(`🔗 Reconnected agent to mesh: ${conn.agentName}`, LogContext.AGENT);
                }
                catch (error) {
                    log.error(`Failed to reconnect agent: ${conn.agentName}`, LogContext.AGENT, { error });
                }
            }
        }
        catch (error) {
            log.error('Failed to heal mesh connectivity', LogContext.SYSTEM, { error });
        }
    }
    getCurrentHealth() {
        return this.healthHistory.length > 0
            ? this.healthHistory[this.healthHistory.length - 1] || null
            : null;
    }
    getHealthHistory(limit = 10) {
        return this.healthHistory.slice(-limit);
    }
    getActiveIssues() {
        return Array.from(this.activeIssues.values());
    }
    async forceHealthCheck() {
        return await this.performHealthCheck();
    }
    async forceSelfHealing() {
        await this.performSelfHealing();
    }
    getHealthSummary() {
        const currentHealth = this.getCurrentHealth();
        const criticalIssues = Array.from(this.activeIssues.values()).filter((issue) => issue.severity === 'critical').length;
        return {
            overallHealth: currentHealth?.systemHealth || 0,
            issueCount: this.activeIssues.size,
            criticalIssues,
            uptimeHours: process.uptime() / 3600,
        };
    }
    async shutdown() {
        this.isMonitoring = false;
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        if (this.healingInterval) {
            clearInterval(this.healingInterval);
            this.healingInterval = null;
        }
        this.removeAllListeners();
        log.info('🏥 Health monitoring stopped', LogContext.SYSTEM);
    }
}
export const healthMonitor = new HealthMonitorService();
export default healthMonitor;
//# sourceMappingURL=health-monitor-service.js.map