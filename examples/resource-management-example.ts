import { resourceManager } from '../src/services/resource-manager';
import { connectionPoolManager } from '../src/services/connection-pool-manager';
import { memoryManager } from '../src/services/memory-manager';
import { logger } from '../src/utils/logger';

/**
 * Example: Basic Resource Management
 * 
 * This example demonstrates how to use the resource management system
 * to monitor and control system resources in your Universal AI Tools application.
 */

async function basicResourceManagement() {
  console.log('=== Basic Resource Management Example ===\n');

  // 1. Monitor current resource usage
  const usage = resourceManager.getResourceUsage();
  console.log('Current Resource Usage:');
  console.log(`- CPU: ${usage.cpu.percentage.toFixed(1)}%`);
  console.log(`- Memory: ${usage.memory.percentage.toFixed(1)}%`);
  console.log(`- Connections: ${usage.connections.active} active, ${usage.connections.idle} idle`);
  console.log(`- Requests/min: ${usage.requests.perMinute}\n`);

  // 2. Allocate resources for a task
  try {
    const allocationId = await resourceManager.allocateResource(
      'memory',
      100 * 1024 * 1024, // 100MB
      'example-task',
      2 // priority
    );
    console.log(`Allocated 100MB memory (ID: ${allocationId})`);

    // Do some work...
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Release the allocation
    resourceManager.releaseResource(allocationId);
    console.log('Released memory allocation\n');
  } catch (error) {
    console.error('Failed to allocate resources:', error);
  }

  // 3. Set resource quotas
  resourceManager.setResourceQuota('api-user-123', 500); // 500MB limit
  console.log('Set resource quota for api-user-123: 500MB\n');
}

/**
 * Example: Connection Pool Management
 * 
 * Shows how to use the connection pool manager for efficient database connections.
 */
async function connectionPoolExample() {
  console.log('=== Connection Pool Management Example ===\n');

  // 1. Get a Supabase connection from the pool
  let supabaseClient;
  try {
    supabaseClient = await connectionPoolManager.getSupabaseConnection('main-pool');
    console.log('Acquired Supabase connection from pool');

    // Use the connection for queries
    const { data, error } = await supabaseClient
      .from('users')
      .select('id, email')
      .limit(5);

    if (error) {
      console.error('Query error:', error);
    } else {
      console.log(`Fetched ${data?.length || 0} users`);
    }
  } catch (error) {
    console.error('Failed to get connection:', error);
  } finally {
    // Always release the connection back to the pool
    if (supabaseClient) {
      connectionPoolManager.releaseSupabaseConnection('main-pool', supabaseClient);
      console.log('Released connection back to pool\n');
    }
  }

  // 2. Check pool status
  const poolStatus = connectionPoolManager.getPoolStatus('main-pool');
  console.log('Pool Status:');
  console.log(`- Supabase: ${poolStatus.supabase.active} active, ${poolStatus.supabase.idle} idle`);
  console.log(`- Redis: ${poolStatus.redis.active} active, ${poolStatus.redis.idle} idle\n`);
}

/**
 * Example: Memory Management
 * 
 * Demonstrates memory monitoring, leak detection, and cache management.
 */
async function memoryManagementExample() {
  console.log('=== Memory Management Example ===\n');

  // 1. Check current memory usage
  const memoryCheck = memoryManager.checkMemoryUsage();
  console.log(`Memory Status: ${memoryCheck.status}`);
  console.log(`- Heap Used: ${memoryCheck.details.heapUsedPercent}%`);
  console.log(`- RSS: ${memoryCheck.details.rss}`);
  console.log(`- External: ${memoryCheck.details.external}\n`);

  // 2. Register a cache
  memoryManager.registerCache('api-responses');
  console.log('Registered cache: api-responses');

  // 3. Add entries to cache
  for (let i = 0; i < 10; i++) {
    memoryManager.addCacheEntry(
      'api-responses',
      `response-${i}`,
      1024 * 1024, // 1MB per entry
      i < 5 ? 2 : 1 // Higher priority for first 5
    );
  }
  console.log('Added 10 entries to cache\n');

  // 4. Handle memory pressure
  memoryManager.onMemoryPressure(() => {
    console.log('Memory pressure detected! Clearing non-essential data...');
    // Implement your cleanup logic here
  });

  // 5. Get memory profile
  const profile = memoryManager.getMemoryProfile();
  console.log('Memory Profile:');
  console.log(`- Heap Size Limit: ${(profile.heap.heapSizeLimit / 1024 / 1024).toFixed(2)} MB`);
  console.log(`- Used Heap Size: ${(profile.heap.usedHeapSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`- Number of caches: ${profile.caches.length}`);
  console.log(`- Potential leaks: ${profile.leaks.length}\n`);
}

/**
 * Example: Resource Monitoring with Events
 * 
 * Shows how to listen to resource events for real-time monitoring.
 */
async function resourceMonitoringExample() {
  console.log('=== Resource Monitoring Example ===\n');

  // 1. Listen to resource events
  resourceManager.on('resource-allocated', (allocation) => {
    console.log(`[Event] Resource allocated: ${allocation.type} (${allocation.amount} units) to ${allocation.owner}`);
  });

  resourceManager.on('resource-released', (allocation) => {
    console.log(`[Event] Resource released: ${allocation.type} from ${allocation.owner}`);
  });

  resourceManager.on('resource-alerts', (alerts) => {
    console.log('[Alert] Resource warnings:', alerts);
  });

  // 2. Listen to memory events
  memoryManager.on('memory-pressure', (level) => {
    console.log(`[Event] Memory pressure: ${level}`);
  });

  memoryManager.on('gc-completed', (stats) => {
    console.log(`[Event] GC completed: freed ${(stats.freedMemory / 1024 / 1024).toFixed(2)} MB in ${stats.duration.toFixed(2)}ms`);
  });

  // 3. Listen to connection pool events
  connectionPoolManager.on('metrics', (metrics) => {
    console.log(`[Event] Connection pool metrics:`, metrics);
  });

  console.log('Monitoring started. Events will be logged as they occur.\n');

  // Simulate some activity
  const allocationId = await resourceManager.allocateResource('cpu', 25, 'monitoring-example', 1);
  await new Promise(resolve => setTimeout(resolve, 1000));
  resourceManager.releaseResource(allocationId);

  // Force a GC to see the event
  if (global.gc) {
    memoryManager.forceGC();
  }
}

/**
 * Example: Handling Resource Limits
 * 
 * Demonstrates how to handle resource limit scenarios gracefully.
 */
async function resourceLimitsExample() {
  console.log('=== Resource Limits Example ===\n');

  // 1. Try to allocate resources beyond limits
  try {
    // This might fail if system is already under load
    await resourceManager.allocateResource(
      'cpu',
      90, // 90% CPU
      'heavy-task',
      1
    );
    console.log('Successfully allocated 90% CPU');
  } catch (error) {
    console.error('Failed to allocate CPU:', error.message);
  }

  // 2. Track requests with rate limiting
  try {
    for (let i = 0; i < 10; i++) {
      resourceManager.trackRequest('api-client-1');
      console.log(`Request ${i + 1} tracked`);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  } catch (error) {
    console.error('Rate limit exceeded:', error.message);
  } finally {
    // Release requests
    for (let i = 0; i < 10; i++) {
      resourceManager.releaseRequest();
    }
  }

  // 3. Check system health
  const health = resourceManager.getHealthStatus();
  console.log(`\nSystem Health: ${health}`);
}

/**
 * Main function to run all examples
 */
async function main() {
  console.log('Universal AI Tools - Resource Management Examples\n');

  try {
    // Run examples sequentially
    await basicResourceManagement();
    await connectionPoolExample();
    await memoryManagementExample();
    await resourceMonitoringExample();
    await resourceLimitsExample();

    console.log('\nAll examples completed successfully!');
  } catch (error) {
    console.error('Error running examples:', error);
  } finally {
    // Cleanup
    console.log('\nShutting down resource managers...');
    await resourceManager.shutdown();
    process.exit(0);
  }
}

// Run the examples
if (require.main === module) {
  main().catch(console.error);
}

export {
  basicResourceManagement,
  connectionPoolExample,
  memoryManagementExample,
  resourceMonitoringExample,
  resourceLimitsExample
};