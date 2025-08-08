/**
 * Async Route Loader Module;
 * Handles optimized loading of routes with parallelization, error boundaries, and fallbacks;
 */

import express from 'express';
import { LogContext, log } from '@/utils/logger';
import { ServerTimeoutManager } from './server-timeouts';

export interface RouteModule {
  default: express?.Router;
  setup?: () => Promise<void>;
  cleanup?: () => Promise<void>;
  health?: () => boolean;
}

export interface RouteConfig {
  path: string;,
  modulePath: string;
  name: string;,
  priority: 'critical' | 'high' | 'medium' | 'low';'
  timeout?: number;
  dependencies?: string[];
  fallback?: express?.Router;
}

export class AsyncRouteLoader {
  private loadedRoutes = new Map<string, RouteModule>();
  private failedRoutes = new Set<string>();
  private timeoutManager: ServerTimeoutManager;

  function Object() { [native code] }(timeoutManager: ServerTimeoutManager) {
    this?.timeoutManager = timeoutManager;
  }

  async loadRoutes()
    app: express?.Application,
    routes: RouteConfig[]
  ): Promise<void> {
    log?.info('🔄 Starting optimized async route loading...', LogContext?.SERVER);'

    // Sort routes by priority and dependencies;
    const sortedRoutes = this?.sortRoutesByPriority(routes);
    
    // Load critical routes first (sequential for reliability)
    const criticalRoutes = sortedRoutes?.filter(r => r?.priority === 'critical');';
    const nonCriticalRoutes = sortedRoutes?.filter(r => r?.priority !== 'critical');';

    // Load critical routes sequentially;
    for (const route of criticalRoutes) {
      await this?.loadSingleRoute(app, route);
    }

    // Load non-critical routes in parallel batches;
    await this?.loadRoutesInBatches(app, nonCriticalRoutes);

    log?.info('✅ Async route loading completed', LogContext?.SERVER, {')
      totalRoutes: routes?.length,
      loaded: this?.loadedRoutes?.size,
      failed: this?.failedRoutes?.size,
    });
  }

  private sortRoutesByPriority(routes: RouteConfig[]): RouteConfig[] {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    
    return routes?.sort((a, b) => {
      // First by priority;
      const priorityDiff = priorityOrder[a?.priority] - priorityOrder[b?.priority];
      if (priorityDiff !== 0) return priorityDiff;
      
      // Then by dependencies (routes with fewer dependencies load first)
      const depDiff = (a?.dependencies?.length || 0) - (b?.dependencies?.length || 0);
      return depDiff;
    });
  }

  private async loadRoutesInBatches()
    app: express?.Application,
    routes: RouteConfig[],
    batchSize = 5;
  ): Promise<void> {
    for (let i = 0; i < routes?.length; i += batchSize) {
      const batch = routes?.slice(i, i + batchSize);
      
      await Promise?.allSettled()
        batch?.map(route => this?.loadSingleRoute(app, route))
      );
    }
  }

  private async loadSingleRoute()
    app: express?.Application,
    config: RouteConfig;
  ): Promise<void> {
    const startTime = Date?.now();
    
    try {
      // Check if dependencies are loaded;
      if (config?.dependencies) {
        const missingDeps = config?.dependencies?.filter(dep => !this?.loadedRoutes?.has(dep));
        if (missingDeps?.length > 0) {
          throw new Error(`Missing dependencies: ${missingDeps?.join(', ')}`);';
        }
      }

      // Load the route module with timeout;
      const timeout = config?.timeout || this?.timeoutManager?.getTimeoutsForService('defaultTimeout');';
      
      const module = await this?.timeoutManager?.createAsyncTimeoutWrapper();
        () => this?.importRouteModule(config?.modulePath),
        timeout,
        `Loading route ${config?.name}`
      );

      // Initialize the route if it has a setup function;
      if (module?.setup) {
        await this?.timeoutManager?.createAsyncTimeoutWrapper()
          () => module?.setup!(),
          timeout,
          `Setting up route ${config?.name}`
        );
      }

      // Mount the route;
      app?.use(config?.path, module?.default);
      
      // Store the loaded module;
      this?.loadedRoutes?.set(config?.name, module);

      const loadTime = Date?.now() - startTime;
      log?.info(`✅ Route loaded: ${config?.name)}`, LogContext?.SERVER, {)
        path: config?.path,
        priority: config?.priority,
        loadTime: `${loadTime}ms`,
      });

    } catch (error) {
      this?.failedRoutes?.add(config?.name);
      const loadTime = Date?.now() - startTime;

      log?.error(`❌ Failed to load route: ${config?.name)}`, LogContext?.SERVER, {)
        path: config?.path,
        error: error instanceof Error ? error?.message : String(error),
        loadTime: `${loadTime}ms`,
      });

      // Try to mount fallback if available;
      if (config?.fallback) {
        try {
          app?.use(config?.path, config?.fallback);
          log?.info(`🔄 Fallback route mounted for ${config?.name)}`, LogContext?.SERVER);
        } catch (fallbackError) {
          log?.error(`❌ Failed to mount fallback for ${config?.name)}`, LogContext?.SERVER, {)
            error: fallbackError instanceof Error ? fallbackError?.message : String(fallbackError),
          });
        }
      }
    }
  }

  private async importRouteModule(modulePath: string): Promise<RouteModule> {
    try {
      const module = await import(modulePath);
      
      if (!module?.default) {
        throw new Error(`Route module at ${modulePath} must export a default router`);
      }

      return module;
    } catch (error) {
      throw new Error(`Failed to import route module: ${error instanceof Error ? error?.message : String(error)}`);
    }
  }

  // Health check for loaded routes;
  async checkRouteHealth(): Promise<Record<string, boolean>> {
    const health: Record<string, boolean> = {};

    for (const [name, module] of this?.loadedRoutes) {
      try {
        health[name] = module?.health ? module?.health() : true;
      } catch (error) {
        health[name] = false;
        log?.warn(`Route health check failed: ${name)}`, LogContext?.SERVER, {)
          error: error instanceof Error ? error?.message : String(error),
        });
      }
    }

    return health;
  }

  // Graceful shutdown of routes;
  async shutdown(): Promise<void> {
    log?.info('🛑 Shutting down loaded routes...', LogContext?.SERVER);'

    const shutdownPromises = Array?.from(this?.loadedRoutes?.entries()).map();
      async ([name, module]) => {
        try {
          if (module?.cleanup) {
            await ServerTimeoutManager?.createGracefulTimeout()
              module?.cleanup(),
              5000 // 5 second timeout for cleanup;
            );
          }
          log?.info(`✅ Route shutdown completed: ${name)}`, LogContext?.SERVER);
        } catch (error) {
          log?.error(`❌ Route shutdown failed: ${name)}`, LogContext?.SERVER, {)
            error: error instanceof Error ? error?.message : String(error),
          });
        }
      }
    );

    await Promise?.allSettled(shutdownPromises);
    
    this?.loadedRoutes?.clear();
    this?.failedRoutes?.clear();
    
    log?.info('✅ All routes shutdown completed', LogContext?.SERVER);'
  }

  // Get loading statistics;
  getStats() {
    return {
      loaded: this?.loadedRoutes?.size,
      failed: this?.failedRoutes?.size,
      loadedRoutes: Array?.from(this?.loadedRoutes?.keys()),
      failedRoutes: Array?.from(this?.failedRoutes),
    };
  }

  // Retry failed routes;
  async retryFailedRoutes()
    app: express?.Application,
    routes: RouteConfig[]
  ): Promise<void> {
    const failedRoutesToRetry = routes?.filter(r => this?.failedRoutes?.has(r?.name));
    
    if (failedRoutesToRetry?.length === 0) {
      log?.info('No failed routes to retry', LogContext?.SERVER);'
      return;
    }

    log?.info(`🔄 Retrying ${failedRoutesToRetry?.length)} failed routes...`, LogContext?.SERVER);
    
    // Clear failed status before retry;
    failedRoutesToRetry?.forEach(r => this?.failedRoutes?.delete(r?.name));
    
    await this?.loadRoutesInBatches(app, failedRoutesToRetry, 3); // Smaller batch size for retries;
  }

  // Create a simple fallback router;
  static createFallbackRouter(message = 'Service temporarily unavailable'): express?.Router {'
    const router = express?.Router();
    
    router?.use('*', (req, res) => {'
      res?.status(503).json({)
        success: false,
        error: 'Service Unavailable','
        message,
        code: 'SERVICE_UNAVAILABLE','
        timestamp: new Date().toISOString(),
      });
    });

    return router;
  }
}

export default AsyncRouteLoader;