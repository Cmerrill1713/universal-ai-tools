export class DependencyContainer {
    services = new Map();
    factories = new Map();
    singletons = new Set();
    register(name, instance) {
        this.services.set(name, instance);
    }
    registerFactory(name, factory, singleton = true) {
        this.factories.set(name, factory);
        if (singleton) {
            this.singletons.add(name);
        }
    }
    get(name) {
        if (this.services.has(name)) {
            return this.services.get(name);
        }
        if (this.factories.has(name)) {
            const factory = this.factories.get(name);
            const instance = factory();
            if (this.singletons.has(name)) {
                this.services.set(name, instance);
            }
            return instance;
        }
        throw new Error(`Service '${name}' not found in dependency container`);
    }
    has(name) {
        return this.services.has(name) || this.factories.has(name);
    }
    remove(name) {
        this.services.delete(name);
        this.factories.delete(name);
        this.singletons.delete(name);
    }
    clear() {
        this.services.clear();
        this.factories.clear();
        this.singletons.clear();
    }
    getServiceNames() {
        const names = new Set();
        this.services.forEach((_, name) => names.add(name));
        this.factories.forEach((_, name) => names.add(name));
        return Array.from(names);
    }
}
export const container = new DependencyContainer();
export const SERVICE_NAMES = {
    AGENT_REGISTRY: 'agentRegistry',
    SUPABASE_CLIENT: 'supabaseClient',
    HEALTH_MONITOR: 'healthMonitor',
    FLASH_ATTENTION_SERVICE: 'flashAttentionService',
    SECRETS_MANAGER: 'secretsManager',
    PARAMETER_OPTIMIZER: 'parameterOptimizer',
    FEEDBACK_COLLECTOR: 'feedbackCollector',
};
export function getAgentRegistry() {
    return container.get(SERVICE_NAMES.AGENT_REGISTRY);
}
export function getSupabaseClient() {
    return container.get(SERVICE_NAMES.SUPABASE_CLIENT);
}
export function getHealthMonitor() {
    return container.get(SERVICE_NAMES.HEALTH_MONITOR);
}
export function getFlashAttentionService() {
    return container.get(SERVICE_NAMES.FLASH_ATTENTION_SERVICE);
}
export function injectServices(req, res, next) {
    req.services = {
        get: (name) => container.get(name),
        agentRegistry: getAgentRegistry(),
        supabaseClient: getSupabaseClient(),
        healthMonitor: getHealthMonitor(),
    };
    next();
}
//# sourceMappingURL=dependency-container.js.map