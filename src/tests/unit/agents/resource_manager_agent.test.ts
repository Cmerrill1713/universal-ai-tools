import { ResourceManagerAgent } from '../../../agents/cognitive/resource_manager_agent';
import { createMockMemory, waitFor } from '../../setup';

describe('ResourceManagerAgent', () => {
  let agent: ResourceManagerAgent;
  const mockContext = {
    requestId: 'test-request-123',
    userRequest: 'test request',
    timestamp: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    agent = new ResourceManagerAgent({
      name: 'Resource Manager',
      description: 'Manages system resources',
      priority: 5,
      capabilities: [],
      maxLatencyMs: 5000,
      retryAttempts: 3,
      dependencies: [],
      memoryEnabled: true,
      category: 'cognitive',
      resourceSettings: {
        maxConcurrentAllocations: 10,
        allocationTimeout: 5000,
        optimizationInterval: 60000,
        oversubscriptionRatio: 1.2,
        priorityLevels: 5,
        enablePreemption: true,
      },
    });
  });

  describe('resource allocation', () => {
    it('should allocate resources for valid requests', async () => {
      const input = 'allocate 100 cores of compute for data processing';
      const response = await agent.processInput(input, mockContext);

      expect(response.success).toBe(true);
      expect(response.data).toHaveProperty('allocationId');
      expect(response.data.amountAllocated).toBe(100);
      expect(response.data.resourceName).toContain('Compute');
      expect(response.message).toContain('Successfully allocated');
    });

    it('should handle priority allocations', async () => {
      const input = 'urgently need 500MB memory for critical task';
      const response = await agent.processInput(input, mockContext);

      expect(response.success).toBe(true);
      expect(response.data.amountAllocated).toBe(500);
      const allocation = agent['allocations'].get(response.data.allocationId);
      expect(allocation?.priority).toBe(5); // High priority
    });

    it('should queue requests when resources unavailable', async () => {
      // Allocate all available compute
      await agent.processInput('allocate 1000 cores of compute', mockContext);
      
      // Try to allocate more
      const response = await agent.processInput('allocate 500 cores of compute', mockContext);

      expect(response.success).toBe(true);
      expect(response.data.status).toBe('pending');
      expect(response.data.queuePosition).toBeGreaterThan(0);
      expect(response.message).toContain('queued');
    });

    it('should enforce resource limits', async () => {
      const input = 'allocate 50000 cores of compute'; // Exceeds capacity
      const response = await agent.processInput(input, mockContext);

      expect(response.success).toBe(true);
      expect(response.data.status).toBe('pending');
      expect(response.reasoning).toContain('Insufficient capacity');
    });
  });

  describe('resource release', () => {
    it('should release allocated resources', async () => {
      // First allocate
      const allocResponse = await agent.processInput(
        'allocate 200 cores of compute',
        mockContext
      );
      const {allocationId} = allocResponse.data;

      // Then release
      const releaseResponse = await agent.processInput(
        `release allocation ${allocationId}`,
        mockContext
      );

      expect(releaseResponse.success).toBe(true);
      expect(releaseResponse.data.allocationId).toBe(allocationId);
      expect(releaseResponse.data.amountReleased).toBe(200);
      expect(releaseResponse.message).toContain('Successfully released');
    });

    it('should auto-release after duration expires', async () => {
      const response = await agent.processInput(
        'allocate 100 cores for 100 milliseconds',
        mockContext
      );

      expect(response.success).toBe(true);
      const {allocationId} = response.data;

      // Wait for auto-release
      await waitFor(150);

      const allocation = agent['allocations'].get(allocationId);
      expect(allocation?.status).toBe('completed');
    });

    it('should process pending requests after release', async () => {
      // Fill capacity
      await agent.processInput('allocate 900 cores', mockContext);
      
      // Queue a request
      const pendingResponse = await agent.processInput(
        'allocate 200 cores',
        mockContext
      );
      expect(pendingResponse.data.status).toBe('pending');

      // Release some resources
      await agent.processInput('release allocation for test-agent', mockContext);

      // Check if pending request was processed
      await waitFor(50);
      const pendingRequests = agent['pendingRequests'];
      expect(pendingRequests).toHaveLength(0);
    });
  });

  describe('resource optimization', () => {
    it('should optimize resource distribution', async () => {
      // Create suboptimal allocations
      await agent.processInput('allocate 300 cores', mockContext);
      await agent.processInput('allocate 200 cores', { ...mockContext, requestId: 'agent2' });
      await agent.processInput('allocate 100 cores', { ...mockContext, requestId: 'agent3' });

      const response = await agent.processInput('optimize resources', mockContext);

      expect(response.success).toBe(true);
      expect(response.data.strategy).toBeDefined();
      expect(response.data.allocationsOptimized).toBeGreaterThan(0);
      expect(response.reasoning).toContain('optimization');
    });

    it('should select appropriate optimization strategy', async () => {
      // Create high priority spread
      await agent.processInput('allocate 100 cores with high priority', mockContext);
      await agent.processInput('allocate 100 cores with low priority', mockContext);

      const response = await agent.processInput('optimize', mockContext);

      expect(response.data.strategy).toContain('priority');
    });

    it('should calculate optimization improvements', async () => {
      // Setup for cost optimization
      await agent.processInput('allocate 500 storage', mockContext);
      
      const response = await agent.processInput('optimize for cost', mockContext);

      expect(response.data.improvements).toBeDefined();
      expect(response.data.improvements).toHaveProperty('costImprovement');
      expect(response.data.improvements).toHaveProperty('loadBalanceImprovement');
    });
  });

  describe('resource status and monitoring', () => {
    it('should provide comprehensive status report', async () => {
      // Create some allocations
      await agent.processInput('allocate 200 cores', mockContext);
      await agent.processInput('allocate 1000 MB memory', mockContext);

      const response = await agent.processInput('show resource status', mockContext);

      expect(response.success).toBe(true);
      expect(response.data.summary).toBeDefined();
      expect(response.data.summary.totalResources).toBeGreaterThan(0);
      expect(response.data.summary.activeAllocations).toBe(2);
      expect(response.data.resources).toBeInstanceOf(Array);
      expect(response.data.topConsumers).toBeInstanceOf(Array);
    });

    it('should track resource metrics', async () => {
      // Perform multiple allocations and releases
      for (let i = 0; i < 5; i++) {
        const allocResponse = await agent.processInput(
          `allocate ${100 + i * 50} cores`,
          mockContext
        );
        await agent.processInput(
          `release ${allocResponse.data.allocationId}`,
          mockContext
        );
      }

      const metrics = agent.getMetricsReport();
      
      expect(metrics).toBeDefined();
      expect(Object.keys(metrics).length).toBeGreaterThan(0);
    });

    it('should provide utilization insights', async () => {
      const response = await agent.processInput(
        'what is the current utilization?',
        mockContext
      );

      expect(response.success).toBe(true);
      expect(response.data.insights).toBeDefined();
      expect(response.data.insights.some((i: any) => i.type === 'capacity')).toBe(true);
    });
  });

  describe('resource forecasting', () => {
    it('should generate resource forecasts', async () => {
      // Create historical data
      for (let i = 0; i < 10; i++) {
        await agent.processInput(`allocate ${50 + i * 10} cores`, mockContext);
      }

      const response = await agent.processInput(
        'forecast resource usage for next 24 hours',
        mockContext
      );

      expect(response.success).toBe(true);
      expect(response.data.horizon).toBe('24 hours');
      expect(response.data.predictions).toBeDefined();
      expect(response.data.predictions.peakUtilization).toBeDefined();
      expect(response.data.predictions.resourceShortages).toBeDefined();
      expect(response.data.recommendations).toBeInstanceOf(Array);
    });

    it('should identify usage trends', async () => {
      // Simulate increasing usage
      for (let hour = 0; hour < 5; hour++) {
        await agent.processInput(
          `allocate ${100 * (hour + 1)} cores`,
          { ...mockContext, requestId: `trend-${hour}`, timestamp: new Date(Date.now() + hour * 3600000) }
        );
      }

      const response = await agent.processInput('analyze usage trends', mockContext);

      expect(response.success).toBe(true);
      expect(response.data.insights.some((i: any) => 
        i.type === 'trends' && i.details.weeklyGrowth.includes('+')
      )).toBe(true);
    });

    it('should project costs', async () => {
      // Create allocations with costs
      await agent.processInput('allocate 1000 cores', mockContext);
      await agent.processInput('allocate 5000 MB memory', mockContext);

      const response = await agent.processInput(
        'forecast costs for next week',
        mockContext
      );

      expect(response.success).toBe(true);
      expect(response.data.predictions.costProjection).toBeDefined();
      expect(response.data.predictions.costProjection.projected).toBeDefined();
    });
  });

  describe('advanced resource management', () => {
    it('should handle exclusive access requests', async () => {
      const response = await agent.processInput(
        'allocate 500 cores with exclusive access',
        mockContext
      );

      expect(response.success).toBe(true);
      
      // Try to allocate same resource
      const response2 = await agent.processInput(
        'allocate 100 cores',
        { ...mockContext, requestId: 'other-agent' }
      );

      // Should be queued or use different resource
      expect(response2.data.resourceId).not.toBe(response.data.resourceId);
    });

    it('should respect minimum allocation amounts', async () => {
      const response = await agent.processInput(
        'allocate compute with at least 300 cores',
        mockContext
      );

      expect(response.success).toBe(true);
      expect(response.data.amountAllocated).toBeGreaterThanOrEqual(300);
    });

    it('should handle preferred resources', async () => {
      const response = await agent.processInput(
        'allocate 100 cores from Primary Compute Pool',
        mockContext
      );

      expect(response.success).toBe(true);
      expect(response.data.resourceName).toContain('Primary Compute Pool');
    });
  });

  describe('resource types', () => {
    it('should manage compute resources', async () => {
      const response = await agent.processInput(
        'allocate 250 compute cores',
        mockContext
      );

      expect(response.success).toBe(true);
      expect(response.data.unit).toBe('cores');
    });

    it('should manage memory resources', async () => {
      const response = await agent.processInput(
        'allocate 4096 MB of memory',
        mockContext
      );

      expect(response.success).toBe(true);
      expect(response.data.unit).toBe('MB');
      expect(response.data.amountAllocated).toBe(4096);
    });

    it('should manage API quota', async () => {
      const response = await agent.processInput(
        'allocate 1000 API calls',
        mockContext
      );

      expect(response.success).toBe(true);
      expect(response.data.unit).toBe('calls/hour');
    });

    it('should manage token budget', async () => {
      const response = await agent.processInput(
        'allocate 50000 tokens for processing',
        mockContext
      );

      expect(response.success).toBe(true);
      expect(response.data.unit).toBe('tokens');
    });
  });

  describe('error handling', () => {
    it('should handle invalid allocation requests', async () => {
      const response = await agent.processInput(
        'allocate invalid resource type',
        mockContext
      );

      expect(response.success).toBe(true); // Gracefully handles by defaulting
      expect(response.data).toBeDefined();
    });

    it('should handle release of non-existent allocations', async () => {
      const response = await agent.processInput(
        'release allocation invalid-id',
        mockContext
      );

      expect(response.success).toBe(false);
      expect(response.message).toContain('not found');
    });

    it('should recover from optimization failures', async () => {
      // Force an optimization with no allocations
      const response = await agent.processInput('optimize resources', mockContext);

      expect(response.success).toBe(true);
      expect(response.data.allocationsOptimized).toBe(0);
    });
  });

  describe('performance', () => {
    it('should handle concurrent allocations efficiently', async () => {
      const promises = [];
      
      for (let i = 0; i < 10; i++) {
        promises.push(
          agent.processInput(
            `allocate ${50 + i * 10} cores`,
            { ...mockContext, requestId: `agent-${i}` }
          )
        );
      }

      const responses = await Promise.all(promises);
      const successCount = responses.filter(r => r.success).length;

      expect(successCount).toBe(10);
    });

    it('should complete operations within timeout', async () => {
      const startTime = Date.now();
      
      await agent.processInput(
        'allocate 500 cores for complex computation',
        mockContext
      );
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });
  });
});