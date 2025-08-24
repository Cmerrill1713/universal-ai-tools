import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  DependencyContainer,
  container,
  SERVICE_NAMES,
  getAgentRegistry,
  getSupabaseClient,
  getHealthMonitor,
  getFlashAttentionService,
  injectServices,
} from '../../src/utils/dependency-container';

describe('DependencyContainer', () => {
  let testContainer: DependencyContainer;

  beforeEach(() => {
    testContainer = new DependencyContainer();
  });

  describe('Basic Registration and Retrieval', () => {
    it('should register and retrieve service instances', () => {
      const mockService = { name: 'test-service', getValue: () => 42 };
      
      testContainer.register('testService', mockService);
      
      const retrieved = testContainer.get('testService');
      expect(retrieved).toBe(mockService);
      expect((retrieved as any).getValue()).toBe(42);
    });

    it('should register and retrieve factory-created services', () => {
      const mockFactory = jest.fn(() => ({ value: 'factory-created' }));
      
      testContainer.registerFactory('factoryService', mockFactory);
      
      const retrieved = testContainer.get('factoryService');
      expect(retrieved).toEqual({ value: 'factory-created' });
      expect(mockFactory).toHaveBeenCalledTimes(1);
    });

    it('should throw error for unregistered services', () => {
      expect(() => {
        testContainer.get('nonExistentService');
      }).toThrow("Service 'nonExistentService' not found in dependency container");
    });
  });

  describe('Factory Registration', () => {
    it('should create singleton instances by default', () => {
      let instanceCount = 0;
      const mockFactory = jest.fn(() => {
        instanceCount++;
        return { id: instanceCount };
      });
      
      testContainer.registerFactory('singletonService', mockFactory);
      
      const instance1 = testContainer.get('singletonService');
      const instance2 = testContainer.get('singletonService');
      
      expect(instance1).toBe(instance2);
      expect(mockFactory).toHaveBeenCalledTimes(1);
      expect((instance1 as any).id).toBe(1);
    });

    it('should create new instances when singleton is false', () => {
      let instanceCount = 0;
      const mockFactory = jest.fn(() => {
        instanceCount++;
        return { id: instanceCount };
      });
      
      testContainer.registerFactory('nonSingletonService', mockFactory, false);
      
      const instance1 = testContainer.get('nonSingletonService');
      const instance2 = testContainer.get('nonSingletonService');
      
      expect(instance1).not.toBe(instance2);
      expect(mockFactory).toHaveBeenCalledTimes(2);
      expect((instance1 as any).id).toBe(1);
      expect((instance2 as any).id).toBe(2);
    });

    it('should handle async factory functions', async () => {
      const asyncFactory = jest.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return { async: true, value: 'async-result' };
      });
      
      testContainer.registerFactory('asyncService', asyncFactory);
      
      const promise = testContainer.get('asyncService');
      expect(promise).toBeInstanceOf(Promise);
      
      const result = await promise;
      expect(result).toEqual({ async: true, value: 'async-result' });
      expect(asyncFactory).toHaveBeenCalledTimes(1);
    });
  });

  describe('Service Management', () => {
    beforeEach(() => {
      testContainer.register('service1', { name: 'Service 1' });
      testContainer.registerFactory('service2', () => ({ name: 'Service 2' }));
      testContainer.registerFactory('service3', () => ({ name: 'Service 3' }), false);
    });

    it('should check if services exist', () => {
      expect(testContainer.has('service1')).toBe(true);
      expect(testContainer.has('service2')).toBe(true);
      expect(testContainer.has('service3')).toBe(true);
      expect(testContainer.has('nonExistentService')).toBe(false);
    });

    it('should remove services', () => {
      expect(testContainer.has('service1')).toBe(true);
      
      testContainer.remove('service1');
      
      expect(testContainer.has('service1')).toBe(false);
      expect(() => testContainer.get('service1')).toThrow();
    });

    it('should get all service names', () => {
      const names = testContainer.getServiceNames();
      
      expect(names).toHaveLength(3);
      expect(names).toContain('service1');
      expect(names).toContain('service2');
      expect(names).toContain('service3');
    });

    it('should clear all services', () => {
      expect(testContainer.getServiceNames()).toHaveLength(3);
      
      testContainer.clear();
      
      expect(testContainer.getServiceNames()).toHaveLength(0);
      expect(testContainer.has('service1')).toBe(false);
      expect(testContainer.has('service2')).toBe(false);
      expect(testContainer.has('service3')).toBe(false);
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle service replacement', () => {
      const originalService = { version: 1 };
      const updatedService = { version: 2 };
      
      testContainer.register('versionedService', originalService);
      expect(testContainer.get('versionedService')).toBe(originalService);
      
      testContainer.register('versionedService', updatedService);
      expect(testContainer.get('versionedService')).toBe(updatedService);
    });

    it('should handle factory with dependencies', () => {
      // Setup dependencies
      testContainer.register('config', { apiUrl: 'https://api.example.com' });
      testContainer.register('logger', { log: jest.fn() });
      
      // Register service that depends on others
      const apiServiceFactory = () => {
        const config = testContainer.get('config') as any;
        const logger = testContainer.get('logger') as any;
        return {
          config,
          logger,
          makeRequest: (path: string) => `${config.apiUrl}${path}`
        };
      };
      
      testContainer.registerFactory('apiService', apiServiceFactory);
      
      const apiService = testContainer.get('apiService') as any;
      expect(apiService.makeRequest('/users')).toBe('https://api.example.com/users');
      expect(apiService.logger.log).toBeDefined();
    });

    it('should handle circular dependencies gracefully', () => {
      // This test ensures the container doesn't crash with circular deps
      // but doesn't resolve them (which would require more complex logic)
      
      const factoryA = () => {
        const serviceB = testContainer.get('serviceB');
        return { name: 'A', dependency: serviceB };
      };
      
      const factoryB = () => {
        const serviceA = testContainer.get('serviceA');
        return { name: 'B', dependency: serviceA };
      };
      
      testContainer.registerFactory('serviceA', factoryA);
      testContainer.registerFactory('serviceB', factoryB);
      
      // This should throw due to circular dependency
      expect(() => testContainer.get('serviceA')).toThrow();
    });
  });

  describe('Type Safety', () => {
    it('should maintain type information for TypeScript', () => {
      interface TestService {
        getValue(): number;
        getName(): string;
      }
      
      const mockService: TestService = {
        getValue: () => 42,
        getName: () => 'test'
      };
      
      testContainer.register('typedService', mockService);
      
      const retrieved = testContainer.get<TestService>('typedService');
      
      // These should not cause TypeScript errors and should work at runtime
      expect(retrieved.getValue()).toBe(42);
      expect(retrieved.getName()).toBe('test');
    });
  });
});

describe('Global Container and Utility Functions', () => {
  beforeEach(() => {
    // Clear the global container before each test
    container.clear();
  });

  describe('SERVICE_NAMES constants', () => {
    it('should provide consistent service names', () => {
      expect(SERVICE_NAMES.AGENT_REGISTRY).toBe('agentRegistry');
      expect(SERVICE_NAMES.SUPABASE_CLIENT).toBe('supabaseClient');
      expect(SERVICE_NAMES.HEALTH_MONITOR).toBe('healthMonitor');
      expect(SERVICE_NAMES.FLASH_ATTENTION_SERVICE).toBe('flashAttentionService');
      expect(SERVICE_NAMES.SECRETS_MANAGER).toBe('secretsManager');
      expect(SERVICE_NAMES.PARAMETER_OPTIMIZER).toBe('parameterOptimizer');
      expect(SERVICE_NAMES.FEEDBACK_COLLECTOR).toBe('feedbackCollector');
      expect(SERVICE_NAMES.MEMORY_OPTIMIZER).toBe('memoryOptimizer');
      expect(SERVICE_NAMES.FEATURE_DISCOVERY).toBe('featureDiscovery');
    });
  });

  describe('Utility getter functions', () => {
    beforeEach(() => {
      // Register mock services for testing
      container.register(SERVICE_NAMES.AGENT_REGISTRY, { 
        type: 'agentRegistry',
        getAgents: jest.fn(() => [])
      });
      container.register(SERVICE_NAMES.SUPABASE_CLIENT, { 
        type: 'supabaseClient',
        from: jest.fn()
      });
      container.register(SERVICE_NAMES.HEALTH_MONITOR, { 
        type: 'healthMonitor',
        checkHealth: jest.fn()
      });
      container.register(SERVICE_NAMES.FLASH_ATTENTION_SERVICE, { 
        type: 'flashAttentionService',
        process: jest.fn()
      });
    });

    it('should get agent registry', () => {
      const agentRegistry = getAgentRegistry() as any;
      expect(agentRegistry.type).toBe('agentRegistry');
      expect(agentRegistry.getAgents).toBeDefined();
    });

    it('should get supabase client', () => {
      const supabaseClient = getSupabaseClient() as any;
      expect(supabaseClient.type).toBe('supabaseClient');
      expect(supabaseClient.from).toBeDefined();
    });

    it('should get health monitor', () => {
      const healthMonitor = getHealthMonitor() as any;
      expect(healthMonitor.type).toBe('healthMonitor');
      expect(healthMonitor.checkHealth).toBeDefined();
    });

    it('should get flash attention service', () => {
      const flashAttentionService = getFlashAttentionService() as any;
      expect(flashAttentionService.type).toBe('flashAttentionService');
      expect(flashAttentionService.process).toBeDefined();
    });

    it('should throw error when services are not registered', () => {
      container.clear();
      
      expect(() => getAgentRegistry()).toThrow();
      expect(() => getSupabaseClient()).toThrow();
      expect(() => getHealthMonitor()).toThrow();
      expect(() => getFlashAttentionService()).toThrow();
    });
  });

  describe('Express Middleware', () => {
    it('should inject services into request object', () => {
      // Setup mock services
      const mockAgentRegistry = { type: 'agentRegistry' };
      const mockSupabaseClient = { type: 'supabaseClient' };
      const mockHealthMonitor = { type: 'healthMonitor' };
      
      container.register(SERVICE_NAMES.AGENT_REGISTRY, mockAgentRegistry);
      container.register(SERVICE_NAMES.SUPABASE_CLIENT, mockSupabaseClient);
      container.register(SERVICE_NAMES.HEALTH_MONITOR, mockHealthMonitor);
      
      // Mock Express request, response, next
      const mockReq: any = {};
      const mockRes: any = {};
      const mockNext = jest.fn();
      
      // Execute middleware
      injectServices(mockReq, mockRes, mockNext);
      
      // Verify services are injected
      expect(mockReq.services).toBeDefined();
      expect(mockReq.services.get).toBeInstanceOf(Function);
      expect(mockReq.services.agentRegistry).toBe(mockAgentRegistry);
      expect(mockReq.services.supabaseClient).toBe(mockSupabaseClient);
      expect(mockReq.services.healthMonitor).toBe(mockHealthMonitor);
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should allow getting services through request.services.get', () => {
      // Setup required services for the middleware
      container.register(SERVICE_NAMES.AGENT_REGISTRY, { type: 'agentRegistry' });
      container.register(SERVICE_NAMES.SUPABASE_CLIENT, { type: 'supabaseClient' });
      container.register(SERVICE_NAMES.HEALTH_MONITOR, { type: 'healthMonitor' });
      
      const customService = { name: 'custom', value: 123 };
      container.register('customService', customService);
      
      const mockReq: any = {};
      const mockRes: any = {};
      const mockNext = jest.fn();
      
      injectServices(mockReq, mockRes, mockNext);
      
      const retrievedService = mockReq.services.get('customService');
      expect(retrievedService).toBe(customService);
      expect((retrievedService as any).value).toBe(123);
    });
  });

  describe('Error Scenarios', () => {
    it('should handle missing services in utility functions gracefully', () => {
      container.clear();
      
      expect(() => getAgentRegistry()).toThrow("Service 'agentRegistry' not found");
      expect(() => getSupabaseClient()).toThrow("Service 'supabaseClient' not found");
      expect(() => getHealthMonitor()).toThrow("Service 'healthMonitor' not found");
      expect(() => getFlashAttentionService()).toThrow("Service 'flashAttentionService' not found");
    });

    it('should handle factory errors gracefully', () => {
      const errorFactory = () => {
        throw new Error('Factory initialization failed');
      };
      
      container.registerFactory('errorService', errorFactory);
      
      expect(() => container.get('errorService')).toThrow('Factory initialization failed');
    });
  });
});