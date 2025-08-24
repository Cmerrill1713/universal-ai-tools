/**
 * Production Performance Tracking Middleware
 * Tracks request performance metrics for production optimization
 */

import { NextFunction, Request, Response } from 'express';
import { performance } from 'perf_hooks';

import { log, LogContext } from '@/utils/logger';

import { productionMemoryManager } from '../services/production-memory-manager';

// Extend Request interface to include performance tracking
declare global {
  namespace Express {
    interface Request {
      startTime?: number;
      responseTime?: number;
    }
  }
}

export interface PerformanceMetrics {
  route: string;
  method: string;
  statusCode: number;
  responseTime: number;
  memoryUsed: number;
  timestamp: Date;
  userAgent?: string;
  isError: boolean;
}

class PerformanceTracker {
  private recentRequests: PerformanceMetrics[] = [];
  private slowRequestThreshold = 2000; // 2 seconds
  private maxStoredRequests = 1000;

  trackRequest(metrics: PerformanceMetrics): void {
    this.recentRequests.push(metrics);
    
    // Keep only recent requests
    if (this.recentRequests.length > this.maxStoredRequests) {
      this.recentRequests = this.recentRequests.slice(-this.maxStoredRequests);
    }

    // Record in production memory manager
    productionMemoryManager.recordRequest(metrics.responseTime, metrics.isError);

    // Log slow requests
    if (metrics.responseTime > this.slowRequestThreshold) {
      log.warn('Slow request detected', LogContext.SYSTEM, {
        route: metrics.route,
        method: metrics.method,
        responseTime: `${metrics.responseTime.toFixed(2)}ms`,
        statusCode: metrics.statusCode,
        memoryUsed: `${metrics.memoryUsed.toFixed(2)}MB`
      });
    }

    // Log errors
    if (metrics.isError) {
      log.error('Request resulted in error', LogContext.SYSTEM, {
        route: metrics.route,
        method: metrics.method,
        statusCode: metrics.statusCode,
        responseTime: `${metrics.responseTime.toFixed(2)}ms`
      });
    }
  }

  getMetrics(): {
    totalRequests: number;
    averageResponseTime: number;
    errorRate: number;
    slowRequestCount: number;
    recentRequests: PerformanceMetrics[];
  } {
    const totalRequests = this.recentRequests.length;
    const errorCount = this.recentRequests.filter(r => r.isError).length;
    const slowRequestCount = this.recentRequests.filter(r => r.responseTime > this.slowRequestThreshold).length;
    
    const averageResponseTime = totalRequests > 0 
      ? this.recentRequests.reduce((sum, req) => sum + req.responseTime, 0) / totalRequests
      : 0;
    
    const errorRate = totalRequests > 0 ? errorCount / totalRequests : 0;

    return {
      totalRequests,
      averageResponseTime,
      errorRate,
      slowRequestCount,
      recentRequests: this.recentRequests.slice(-100) // Last 100 requests
    };
  }

  getRouteSummary(): Record<string, {
    count: number;
    averageResponseTime: number;
    errorRate: number;
  }> {
    const routeStats: Record<string, {
      requests: PerformanceMetrics[];
      count: number;
      averageResponseTime: number;
      errorRate: number;
    }> = {};

    for (const request of this.recentRequests) {
      const routeKey = `${request.method} ${request.route}`;
      
      if (!routeStats[routeKey]) {
        routeStats[routeKey] = {
          requests: [],
          count: 0,
          averageResponseTime: 0,
          errorRate: 0
        };
      }

      routeStats[routeKey].requests.push(request);
      routeStats[routeKey].count++;
    }

    // Calculate averages
    for (const [route, stats] of Object.entries(routeStats)) {
      const totalResponseTime = stats.requests.reduce((sum, req) => sum + req.responseTime, 0);
      const errorCount = stats.requests.filter(req => req.isError).length;
      
      stats.averageResponseTime = totalResponseTime / stats.count;
      stats.errorRate = errorCount / stats.count;
      
      // Remove raw requests to clean up response
      delete (stats as any).requests;
    }

    return routeStats;
  }
}

const performanceTracker = new PerformanceTracker();

// Request start timing middleware
export const performanceStart = (req: Request, res: Response, next: NextFunction): void => {
  req.startTime = performance.now();
  next();
};

// Request end timing and recording middleware
export const performanceEnd = (req: Request, res: Response, next: NextFunction): void => {
  // Override res.end to capture response metrics
  const originalEnd = res.end;
  
  res.end = function(chunk?: any, encoding?: any, cb?: any): Response {
    const endTime = performance.now();
    const responseTime = req.startTime ? endTime - req.startTime : 0;
    req.responseTime = responseTime;

    // Get current memory usage
    const memoryUsage = process.memoryUsage();
    const memoryUsedMB = memoryUsage.heapUsed / 1024 / 1024;

    // Determine route path (clean up dynamic segments)
    const route = req.route?.path || req.path || 'unknown';
    const cleanRoute = route.replace(/\/:[^\/]+/g, '/:param'); // Replace :id with :param

    // Track the request
    const metrics: PerformanceMetrics = {
      route: cleanRoute,
      method: req.method,
      statusCode: res.statusCode,
      responseTime,
      memoryUsed: memoryUsedMB,
      timestamp: new Date(),
      userAgent: req.get('User-Agent'),
      isError: res.statusCode >= 400
    };

    performanceTracker.trackRequest(metrics);

    // Call original end function
    return originalEnd.call(this, chunk, encoding, cb);
  };

  next();
};

// Combined middleware that includes both start and end tracking
export const performanceMiddleware = [performanceStart, performanceEnd];

// Endpoint to get performance metrics
export const getPerformanceMetrics = () => performanceTracker.getMetrics();
export const getRouteSummary = () => performanceTracker.getRouteSummary();

// Connection pool optimization middleware
export const connectionPoolMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Set connection keep-alive headers for better performance
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Keep-Alive', 'timeout=5, max=1000');
  
  // Optimize for production
  if (process.env.NODE_ENV === 'production') {
    // Enable compression hints
    res.setHeader('Vary', 'Accept-Encoding');
    
    // Set cache headers for static-like responses
    if (req.method === 'GET' && !req.path.includes('/api/')) {
      res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minutes
    }
  }

  next();
};

// Memory pressure response middleware
export const memoryPressureMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const healthStatus = productionMemoryManager.getHealthStatus();
  
  // If in critical memory pressure, reject non-essential requests
  if (healthStatus.status === 'emergency') {
    // Allow only health checks and critical endpoints
    const criticalPaths = ['/health', '/status', '/metrics', '/optimize'];
    const isCritical = criticalPaths.some(path => req.path.includes(path));
    
    if (!isCritical) {
      res.status(503).json({
        error: 'Service temporarily unavailable due to memory pressure',
        status: 'emergency',
        retryAfter: 30 // seconds
      });
      return;
    }
  }
  
  // Add memory pressure headers for monitoring
  res.setHeader('X-Memory-Status', healthStatus.status);
  res.setHeader('X-Memory-Pressure', healthStatus.memoryPressure.toString());
  
  next();
};

// Request size limiting middleware for memory optimization
export const requestSizeLimiter = (maxSizeMB: number = 10) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.get('Content-Length') || '0', 10);
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    
    if (contentLength > maxSizeBytes) {
      log.warn('Request size limit exceeded', LogContext.SYSTEM, {
        contentLength: `${(contentLength / 1024 / 1024).toFixed(2)}MB`,
        limit: `${maxSizeMB}MB`,
        path: req.path,
        method: req.method
      });
      
      res.status(413).json({
        error: 'Request size too large',
        maxSize: `${maxSizeMB}MB`,
        actualSize: `${(contentLength / 1024 / 1024).toFixed(2)}MB`
      });
      return;
    }
    
    next();
  };
};

export default performanceTracker;