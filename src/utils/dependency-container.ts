/**
 * Dependency Injection Container
 * Manages service dependencies without global variables
 */

type ServiceFactory<T> = () => T | Promise<T>;
type ServiceInstance<T> = T | Promise<T>;

export class DependencyContainer {
  private services = new Map<string, ServiceInstance<any>>();
  private factories = new Map<string, ServiceFactory<any>>();
  private singletons = new Set<string>();

  /**
   * Register a service instance
   */
  register<T>(name: string, instance: T): void {
    this.services.set(name, instance);
  }

  /**
   * Register a service factory
   */
  registerFactory<T>(name: string, factory: ServiceFactory<T>, singleton = true): void {
    this.factories.set(name, factory);
    if (singleton) {
      this.singletons.add(name);
    }
  }

  /**
   * Get a service instance
   */
  get<T>(name: string): T {
    // Check if already instantiated
    if (this.services.has(name)) {
      return this.services.get(name) as T;
    }

    // Check if factory exists
    if (this.factories.has(name)) {
      const factory = this.factories.get(name)!;
      const instance = factory();

      // Cache if singleton
      if (this.singletons.has(name)) {
        this.services.set(name, instance);
      }

      return instance as T;
    }

    throw new Error(`Service '${name}' not found in dependency container`);
  }

  /**
   * Check if service is registered
   */
  has(name: string): boolean {
    return this.services.has(name) || this.factories.has(name);
  }

  /**
   * Remove a service
   */
  remove(name: string): void {
    this.services.delete(name);
    this.factories.delete(name);
    this.singletons.delete(name);
  }

  /**
   * Clear all services
   */
  clear(): void {
    this.services.clear();
    this.factories.clear();
    this.singletons.clear();
  }

  /**
   * Get all registered service names
   */
  getServiceNames(): string[] {
    const names = new Set<string>();
    this.services.forEach((_, name) => names.add(name));
    this.factories.forEach((_, name) => names.add(name));
    return Array.from(names);
  }
}

// Global container instance (but properly managed)
export const container = new DependencyContainer();

// Service name constants
export const SERVICE_NAMES = {
  AGENT_REGISTRY: 'agentRegistry',
  SUPABASE_CLIENT: 'supabaseClient',
  HEALTH_MONITOR: 'healthMonitor',
  FLASH_ATTENTION_SERVICE: 'flashAttentionService',
  SECRETS_MANAGER: 'secretsManager',
  PARAMETER_OPTIMIZER: 'parameterOptimizer',
  FEEDBACK_COLLECTOR: 'feedbackCollector',
} as const;

// Utility functions for common services
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

// Middleware to inject services into request context
export function injectServices(req: any, res: any, next: any) {
  req.services = {
    get: <T>(name: string) => container.get<T>(name),
    agentRegistry: getAgentRegistry(),
    supabaseClient: getSupabaseClient(),
    healthMonitor: getHealthMonitor(),
  };
  next();
}