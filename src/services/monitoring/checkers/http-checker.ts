/**
 * HTTP Health Checker
 * Checks HTTP/HTTPS service endpoints for availability
 */

import { Logger } from '../../../utils/logger';
import type { HealthCheck, HealthCheckConfig, HealthChecker, ServiceType } from '../types';

export class HttpHealthChecker implements HealthChecker {
  public readonly name = 'http';
  private readonly logger: Logger;

  constructor() {
    this.logger = new Logger('HttpHealthChecker');
  }

  supports(type: ServiceType): boolean {
    return type === 'api' || type === 'external';
  }

  async check(config: HealthCheckConfig): Promise<HealthCheck> {
    const startTime = Date.now();

    try {
      if (!config.endpoint) {
        throw new Error('HTTP health check requires endpoint URL');
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.timeout);

      const response = await fetch(config.endpoint, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Universal-AI-Tools-HealthCheck/1.0',
          Accept: 'application/json, text/plain, */*',
        },
      });

      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;

      let status: 'healthy' | 'degraded' | 'unhealthy';
      const details: Record<string, any> = {
        statusCode: response.status,
        responseTime,
        url: config.endpoint,
      };

      // Determine health status based on HTTP status code and response time
      if (response.status >= 200 && response.status < 300) {
        if (responseTime < 1000) {
          status = 'healthy';
        } else if (responseTime < 5000) {
          status = 'degraded';
          details.slowResponse = true;
        } else {
          status = 'unhealthy';
          details.verySlowResponse = true;
        }
      } else if (response.status >= 500) {
        status = 'unhealthy';
        details.serverError = true;
      } else if (response.status >= 400) {
        status = 'degraded';
        details.clientError = true;
      } else {
        status = 'degraded';
        details.unexpectedStatus = true;
      }

      // Try to get response body for additional information
      try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const body = await response.text();
          if (body && body.length < 10000) {
            // Limit body size
            details.responseBody = body;
          }
        }
      } catch (bodyError) {
        // Ignore body parsing errors
        details.bodyParseError = true;
      }

      // Check for specific health indicators in headers
      const healthHeader =
        response.headers.get('x-health') || response.headers.get('x-service-health');
      if (healthHeader) {
        details.healthHeader = healthHeader;
        if (healthHeader.toLowerCase() === 'unhealthy') {
          status = 'unhealthy';
        } else if (healthHeader.toLowerCase() === 'degraded') {
          status = 'degraded';
        }
      }

      return {
        service: config.service,
        status,
        responseTime,
        timestamp: new Date(),
        details,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      const errorDetails: Record<string, any> = {
        responseTime,
        url: config.endpoint,
      };

      if (error instanceof Error) {
        errorDetails.errorType = error.name;
        errorDetails.errorMessage = error.message;

        // Categorize common errors
        if (error.name === 'AbortError') {
          errorDetails.timeout = true;
        } else if (error.message.includes('ECONNREFUSED')) {
          errorDetails.connectionRefused = true;
        } else if (error.message.includes('ENOTFOUND')) {
          errorDetails.dnsError = true;
        } else if (error.message.includes('ECONNRESET')) {
          errorDetails.connectionReset = true;
        }
      }

      return {
        service: config.service,
        status: 'unhealthy',
        responseTime,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
        details: errorDetails,
      };
    }
  }
}
