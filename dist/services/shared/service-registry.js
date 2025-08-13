import { EventEmitter } from 'events';
import { log, LogContext } from '@/utils/logger';
class ServiceRegistry extends EventEmitter {
    services = new Map();
    dependencies = new Map();
    isShuttingDown = false;
    healthCheckInterval;
    constructor() {
        super();
        this.startHealthChecks();
    }
    register(service, options) {
        if (this.services.has(service.name)) {
            log.warn(`⚠️ Service ${service.name} already registered, updating...`, LogContext.SYSTEM);
        }
        const serviceInfo = {
            name: service.name,
            version: service.version,
            status: service.status,
            type: options.type,
            domain: options.domain,
            instance: service,
            metadata: options.metadata || {},
            registeredAt: new Date(),
        };
        this.services.set(service.name, serviceInfo);
        if (options.dependencies) {
            this.dependencies.set(service.name, options.dependencies);
        }
        this.emit('serviceRegistered', serviceInfo);
        log.info(`📋 Service registered: ${service.name}`, LogContext.SYSTEM, {
            type: options.type,
            domain: options.domain,
            version: service.version,
        });
    }
    unregister(serviceName) {
        const serviceInfo = this.services.get(serviceName);
        if (!serviceInfo) {
            log.warn(`⚠️ Attempted to unregister unknown service: ${serviceName}`, LogContext.SYSTEM);
            return;
        }
        this.services.delete(serviceName);
        this.dependencies.delete(serviceName);
        this.emit('serviceUnregistered', serviceInfo);
        log.info(`📋 Service unregistered: ${serviceName}`, LogContext.SYSTEM);
    }
    get(serviceName) {
        const serviceInfo = this.services.get(serviceName);
        return serviceInfo ? serviceInfo.instance : null;
    }
    getByType(type) {
        return Array.from(this.services.values())
            .filter(service => service.type === type)
            .map(service => service.instance);
    }
    getByDomain(domain) {
        return Array.from(this.services.values())
            .filter(service => service.domain === domain)
            .map(service => service.instance);
    }
    getAll() {
        return Array.from(this.services.values());
    }
    getAllActive() {
        return Array.from(this.services.values())
            .filter(service => service.status === 'active');
    }
    exists(serviceName) {
        return this.services.has(serviceName);
    }
    getServiceInfo(serviceName) {
        return this.services.get(serviceName) || null;
    }
    async initializeAll() {
        log.info('🚀 Initializing all services...', LogContext.SYSTEM);
        const services = Array.from(this.services.values());
        const initializationOrder = this.calculateInitializationOrder(services);
        for (const serviceName of initializationOrder) {
            await this.initializeService(serviceName);
        }
        log.info('✅ All services initialized', LogContext.SYSTEM);
    }
    async initializeService(serviceName) {
        const serviceInfo = this.services.get(serviceName);
        if (!serviceInfo) {
            throw new Error(`Service not found: ${serviceName}`);
        }
        if (serviceInfo.status === 'active') {
            log.debug(`Service ${serviceName} already active`, LogContext.SYSTEM);
            return;
        }
        try {
            log.info(`🔄 Initializing service: ${serviceName}`, LogContext.SYSTEM);
            serviceInfo.status = 'initializing';
            this.updateServiceStatus(serviceName, 'initializing');
            await this.checkDependencies(serviceName);
            await serviceInfo.instance.initialize();
            serviceInfo.status = 'active';
            this.updateServiceStatus(serviceName, 'active');
            this.emit('serviceInitialized', serviceInfo);
            log.info(`✅ Service initialized: ${serviceName}`, LogContext.SYSTEM);
        }
        catch (error) {
            serviceInfo.status = 'error';
            this.updateServiceStatus(serviceName, 'error');
            this.emit('serviceError', { serviceInfo, error });
            log.error(`❌ Failed to initialize service: ${serviceName}`, LogContext.SYSTEM, { error });
            throw error;
        }
    }
    async shutdownAll() {
        if (this.isShuttingDown)
            return;
        this.isShuttingDown = true;
        log.info('🛑 Shutting down all services...', LogContext.SYSTEM);
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }
        const services = Array.from(this.services.values());
        const shutdownOrder = this.calculateShutdownOrder(services);
        for (const serviceName of shutdownOrder) {
            await this.shutdownService(serviceName);
        }
        log.info('🛑 All services shut down', LogContext.SYSTEM);
    }
    async shutdownService(serviceName) {
        const serviceInfo = this.services.get(serviceName);
        if (!serviceInfo) {
            log.warn(`⚠️ Attempted to shutdown unknown service: ${serviceName}`, LogContext.SYSTEM);
            return;
        }
        if (serviceInfo.status === 'inactive') {
            log.debug(`Service ${serviceName} already inactive`, LogContext.SYSTEM);
            return;
        }
        try {
            log.info(`🛑 Shutting down service: ${serviceName}`, LogContext.SYSTEM);
            await serviceInfo.instance.shutdown();
            serviceInfo.status = 'inactive';
            this.updateServiceStatus(serviceName, 'inactive');
            this.emit('serviceShutdown', serviceInfo);
            log.info(`🛑 Service shut down: ${serviceName}`, LogContext.SYSTEM);
        }
        catch (error) {
            serviceInfo.status = 'error';
            this.updateServiceStatus(serviceName, 'error');
            log.error(`❌ Failed to shutdown service: ${serviceName}`, LogContext.SYSTEM, { error });
        }
    }
    async checkDependencies(serviceName) {
        const dependencies = this.dependencies.get(serviceName);
        if (!dependencies || dependencies.length === 0) {
            return;
        }
        const missingDependencies = [];
        const inactiveDependencies = [];
        for (const dependency of dependencies) {
            const dependentService = this.services.get(dependency.serviceName);
            if (!dependentService) {
                if (dependency.required) {
                    missingDependencies.push(dependency.serviceName);
                }
            }
            else if (dependentService.status !== 'active') {
                if (dependency.required) {
                    inactiveDependencies.push(dependency.serviceName);
                }
            }
        }
        if (missingDependencies.length > 0) {
            throw new Error(`Missing required dependencies for ${serviceName}: ${missingDependencies.join(', ')}`);
        }
        if (inactiveDependencies.length > 0) {
            for (const depName of inactiveDependencies) {
                await this.initializeService(depName);
            }
        }
    }
    calculateInitializationOrder(services) {
        const visited = new Set();
        const order = [];
        const visit = (serviceName) => {
            if (visited.has(serviceName))
                return;
            visited.add(serviceName);
            const dependencies = this.dependencies.get(serviceName);
            if (dependencies) {
                for (const dep of dependencies) {
                    if (this.services.has(dep.serviceName)) {
                        visit(dep.serviceName);
                    }
                }
            }
            order.push(serviceName);
        };
        for (const service of services) {
            visit(service.name);
        }
        return order;
    }
    calculateShutdownOrder(services) {
        const initOrder = this.calculateInitializationOrder(services);
        return initOrder.reverse();
    }
    startHealthChecks() {
        this.healthCheckInterval = setInterval(() => {
            this.performHealthChecks().catch(error => log.error('❌ Registry health check failed', LogContext.SYSTEM, { error }));
        }, 60000);
    }
    async performHealthChecks() {
        if (this.isShuttingDown)
            return;
        const healthPromises = Array.from(this.services.values()).map(async (serviceInfo) => {
            try {
                const isHealthy = await serviceInfo.instance.healthCheck();
                serviceInfo.lastHealthCheck = new Date();
                if (!isHealthy && serviceInfo.status === 'active') {
                    log.warn(`⚠️ Service health check failed: ${serviceInfo.name}`, LogContext.SYSTEM);
                    this.emit('serviceUnhealthy', serviceInfo);
                }
                return { serviceName: serviceInfo.name, healthy: isHealthy };
            }
            catch (error) {
                log.error(`❌ Health check error for ${serviceInfo.name}`, LogContext.SYSTEM, { error });
                return { serviceName: serviceInfo.name, healthy: false, error };
            }
        });
        const results = await Promise.allSettled(healthPromises);
        const unhealthyServices = results
            .filter(result => result.status === 'fulfilled' && !result.value.healthy)
            .map(result => result.status === 'fulfilled' ? result.value.serviceName : 'unknown');
        if (unhealthyServices.length > 0) {
            this.emit('unhealthyServices', unhealthyServices);
        }
    }
    updateServiceStatus(serviceName, status) {
        const serviceInfo = this.services.get(serviceName);
        if (serviceInfo) {
            serviceInfo.status = status;
            this.emit('serviceStatusChanged', { serviceName, status });
        }
    }
    getStats() {
        const services = Array.from(this.services.values());
        const stats = {
            totalServices: services.length,
            activeServices: services.filter(s => s.status === 'active').length,
            inactiveServices: services.filter(s => s.status === 'inactive').length,
            errorServices: services.filter(s => s.status === 'error').length,
            byDomain: {},
            byType: {},
        };
        for (const service of services) {
            stats.byDomain[service.domain] = (stats.byDomain[service.domain] || 0) + 1;
            stats.byType[service.type] = (stats.byType[service.type] || 0) + 1;
        }
        return stats;
    }
}
export const serviceRegistry = new ServiceRegistry();
//# sourceMappingURL=service-registry.js.map