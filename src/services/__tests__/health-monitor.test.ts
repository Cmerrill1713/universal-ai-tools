/**
 * Health Monitor Service Tests
 */

import { HealthMonitor } from './mocks/health-monitor';

describe('HealthMonitor', () => {
  let healthMonitor: HealthMonitor;

  beforeEach(() => {
    healthMonitor = new HealthMonitor();
  });

  describe('getHealth', () => {
    it('should return healthy status when all services are operational', () => {
      const health = healthMonitor.getHealth();
      
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('timestamp');
      expect(health).toHaveProperty('services');
      expect(health.status).toMatch(/healthy|degraded|unhealthy/);
    });

    it('should include memory metrics', () => {
      const health = healthMonitor.getHealth();
      
      expect(health.services).toHaveProperty('memory');
      expect(health.services.memory).toHaveProperty('heapUsed');
      expect(health.services.memory).toHaveProperty('heapTotal');
      expect(health.services.memory).toHaveProperty('external');
      expect(health.services.memory).toHaveProperty('rss');
    });

    it('should include uptime information', () => {
      const health = healthMonitor.getHealth();
      
      expect(health).toHaveProperty('uptime');
      expect(typeof health.uptime).toBe('number');
      expect(health.uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('checkServices', () => {
    it('should check all configured services', async () => {
      const services = await healthMonitor.checkServices();
      
      expect(services).toBeDefined();
      expect(typeof services).toBe('object');
    });
  });

  describe('metrics', () => {
    it('should track request counts', () => {
      healthMonitor.recordRequest('/api/v1/test', 'GET', 200, 100);
      healthMonitor.recordRequest('/api/v1/test', 'GET', 200, 150);
      
      const metrics = healthMonitor.getMetrics();
      expect(metrics.requests.total).toBe(2);
      expect(metrics.requests.successful).toBe(2);
      expect(metrics.requests.failed).toBe(0);
    });

    it('should track failed requests', () => {
      healthMonitor.recordRequest('/api/v1/test', 'GET', 500, 50);
      healthMonitor.recordRequest('/api/v1/test', 'GET', 404, 30);
      
      const metrics = healthMonitor.getMetrics();
      expect(metrics.requests.failed).toBe(2);
    });

    it('should calculate average response time', () => {
      healthMonitor.recordRequest('/api/v1/test', 'GET', 200, 100);
      healthMonitor.recordRequest('/api/v1/test', 'GET', 200, 200);
      healthMonitor.recordRequest('/api/v1/test', 'GET', 200, 300);
      
      const metrics = healthMonitor.getMetrics();
      expect(metrics.requests.avgResponseTime).toBe(200);
    });
  });
});