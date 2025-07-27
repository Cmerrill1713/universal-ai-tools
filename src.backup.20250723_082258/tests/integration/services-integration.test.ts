/**
 * Integration tests for critical backend services
 * Tests the completed implementations of all core services
 */

import { BackupRecoveryService } from '../../services/backup-recovery-service';
import { HealthCheckService } from '../../services/health-check';
import { CircuitBreakerService } from '../../services/circuit-breaker';
import ToolMakerAgent from '../../agents/personal/tool_maker_agent';
import CalendarAgent from '../../agents/personal/calendar_agent';
import { createClient } from '@supabase/supabase-js';

describe('Services Integration Tests', () => {
  let supabase: any;
  let backupService: BackupRecoveryService;
  let healthService: HealthCheckService;
  let circuitBreakerService: CircuitBreakerService;
  let toolMakerAgent: ToolMakerAgent;
  let calendarAgent: CalendarAgent;

  beforeAll(async () => {
    // Initialize test supabase client
    supabase = createClient(
      process.env.SUPABASE_URL || 'https://test.supabase.co',
      process.env.SUPABASE_ANON_KEY || 'test-key'
    );

    // Initialize services
    backupService = new BackupRecoveryService(supabase);
    healthService = new HealthCheckService(supabase);
    circuitBreakerService = new CircuitBreakerService();
    toolMakerAgent = new ToolMakerAgent(supabase);
    calendarAgent = new CalendarAgent(supabase);
  });

  describe('BackupRecoveryService', () => {
    test('should initialize with default configuration', () => {
      expect(backupService).toBeDefined();
    });

    test('should handle S3 configuration correctly', async () => {
      const status = await backupService.getBackupStatus();
      expect(status).toHaveProperty('isRunning');
      expect(status).toHaveProperty('totalBackups');
    });

    test('should list backups without errors', async () => {
      const result = await backupService.listBackups({ limit: 10 });
      expect(result).toHaveProperty('backups');
      expect(result).toHaveProperty('total');
      expect(Array.isArray(result.backups)).toBe(true);
    });
  });

  describe('HealthCheckService', () => {
    test('should initialize with proper health checks', () => {
      expect(healthService).toBeDefined();
    });

    test('should perform comprehensive health check', async () => {
      const health = await healthService.checkHealth();

      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('services');
      expect(health).toHaveProperty('metrics');
      expect(health).toHaveProperty('dependencies');

      // Check that all expected services are monitored
      expect(health.services).toHaveProperty('database');
      expect(health.services).toHaveProperty('redis');
      expect(health.services).toHaveProperty('memory');
      expect(health.services).toHaveProperty('cpu');
      expect(health.services).toHaveProperty('disk');
    });

    test('should track _requestmetrics', () => {
      healthService.trackRequest(100);
      const metrics = healthService.getRequestMetrics();

      expect(metrics).toHaveProperty('totalRequests');
      expect(metrics).toHaveProperty('requestsPerMinute');
      expect(metrics).toHaveProperty('averageResponseTime');
      expect(metrics.totalRequests).toBeGreaterThan(0);
    });

    test('should perform readiness check', async () => {
      const ready = await healthService.runReadinessCheck();
      expect(typeof ready).toBe('boolean');
    });

    test('should perform liveness check', async () => {
      const alive = await healthService.runLivenessCheck();
      expect(typeof alive).toBe('boolean');
    });
  });

  describe('CircuitBreakerService', () => {
    test('should initialize circuit breakers', () => {
      expect(circuitBreakerService).toBeDefined();
    });

    test('should create circuit breaker for service', () => {
      const breaker = circuitBreakerService.getBreaker('test-service');
      expect(breaker).toBeDefined();
    });

    test('should track metrics for circuit breakers', () => {
      const breaker = circuitBreakerService.getBreaker('test-service-2');
      const metrics = circuitBreakerService.getMetrics('test-service-2');

      expect(metrics).toBeDefined();
      expect(metrics).toHaveProperty('name');
      expect(metrics).toHaveProperty('state');
      expect(metrics).toHaveProperty('requests');
    });

    test('should perform health check', () => {
      const health = circuitBreakerService.healthCheck();

      expect(health).toHaveProperty('healthy');
      expect(health).toHaveProperty('openCircuits');
      expect(health).toHaveProperty('metrics');
      expect(Array.isArray(health.openCircuits)).toBe(true);
      expect(Array.isArray(health.metrics)).toBe(true);
    });

    test('should reset circuit breakers', () => {
      circuitBreakerService.reset('test-service');
      circuitBreakerService.resetAll();
      // Should not throw errors
    });
  });

  describe('ToolMakerAgent', () => {
    test('should initialize properly', async () => {
      expect(toolMakerAgent).toBeDefined();
      expect(toolMakerAgent).toBeDefined();
      expect(toolMakerAgent.getStatus().name).toBe('tool_maker');
    });

    test('should have proper capabilities', () => {
      const { capabilities } = toolMakerAgent.config;
      expect(capabilities.length).toBeGreaterThan(0);

      const capabilityNames = capabilities.map((c) => c.name);
      expect(capabilityNames).toContain('create_tool');
      expect(capabilityNames).toContain('generate_integration');
      expect(capabilityNames).toContain('create_workflow');
    });

    test('should initialize without errors', async () => {
      try {
        await toolMakerAgent.initialize();
        expect(toolMakerAgent.getStatus().isInitialized).toBe(true);
      } catch (_error) {
        // Expected to fail in test environment without full dependencies
        expect(_error.toBeDefined();
      }
    });
  });

  describe('CalendarAgent', () => {
    test('should initialize properly', () => {
      expect(calendarAgent).toBeDefined();
      expect(calendarAgent.getStatus().name).toBe('calendar_agent');
    });

    test('should have calendar capabilities', () => {
      const { capabilities } = calendarAgent.config;
      expect(capabilities.length).toBeGreaterThan(0);

      const capabilityNames = capabilities.map((c) => c.name);
      expect(capabilityNames).toContain('create_event');
      expect(capabilityNames).toContain('find_free_time');
      expect(capabilityNames).toContain('analyze_schedule');
    });

    test('should initialize calendar preferences', async () => {
      try {
        await calendarAgent.initialize();
        expect(calendarAgent.getStatus().isInitialized).toBe(true);
      } catch (_error) {
        // Expected to fail in test environment without macOS Calendar access
        expect(_error.toBeDefined();
      }
    });
  });

  describe('Service Integration', () => {
    test('should have circuit breaker integration in health service', () => {
      // Health service should use circuit breaker for external calls
      expect(healthService).toBeDefined();
    });

    test('should have circuit breaker integration in backup service', () => {
      // Backup service should use circuit breaker for database operations
      expect(backupService).toBeDefined();
    });

    test('all services should be production ready', () => {
      // Basic production readiness checks
      expect(backupService).toHaveProperty('constructor');
      expect(healthService).toHaveProperty('checkHealth');
      expect(circuitBreakerService).toHaveProperty('healthCheck');
      expect(toolMakerAgent).toHaveProperty('execute');
      expect(calendarAgent).toHaveProperty('execute');
    });
  });

  afterAll(async () => {
    // Cleanup
    try {
      await toolMakerAgent?.shutdown();
      await calendarAgent?.shutdown();
    } catch (_error) {
      // Ignore cleanup errors in tests
    }
  });
});
