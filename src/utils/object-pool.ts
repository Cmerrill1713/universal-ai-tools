/**
 * Memory-Optimized Object Pool - Enhanced memory optimization utility
 * Reuses objects to reduce garbage collection pressure with advanced memory management
 */

interface PoolableObject {
  reset?(): void;
}

interface PoolStats {
  name: string;
  currentSize: number;
  maxSize: number;
  totalAcquisitions: number;
  totalReleases: number;
  hitRate: number;
  memoryEstimateMB: number;
}

class ObjectPool<T extends PoolableObject> {
  private pool: T[] = [];
  private readonly createFn: () => T;
  private readonly resetFn?: (obj: T) => void;
  private readonly maxSize: number;
  private readonly name: string;
  private totalAcquisitions = 0;
  private totalReleases = 0;
  private cacheHits = 0;
  private lastCleanup = Date.now();
  private readonly cleanupInterval = 300000; // 5 minutes

  constructor(
    name: string,
    createFn: () => T,
    maxSize = 30, // Reduced default size for better memory management
    resetFn?: (obj: T) => void
  ) {
    this.name = name;
    this.createFn = createFn;
    this.resetFn = resetFn;
    this.maxSize = maxSize;
  }

  acquire(): T {
    this.totalAcquisitions++;
    
    // Periodic cleanup to prevent memory accumulation
    const now = Date.now();
    if (now - this.lastCleanup > this.cleanupInterval) {
      this.performMaintenance();
      this.lastCleanup = now;
    }

    const obj = this.pool.pop();
    if (obj) {
      this.cacheHits++;
      return obj;
    }
    return this.createFn();
  }

  release(obj: T): void {
    this.totalReleases++;
    
    if (this.pool.length >= this.maxSize) {
      return; // Pool is full, let GC handle it
    }

    try {
      // Reset the object
      if (this.resetFn) {
        this.resetFn(obj);
      } else if (obj.reset) {
        obj.reset();
      }
      this.pool.push(obj);
    } catch (error) {
      // If reset fails, don't pool the object
      console.warn(`Failed to reset object in pool ${this.name}:`, error);
    }
  }

  size(): number {
    return this.pool.length;
  }

  clear(): void {
    this.pool.length = 0;
  }

  getStats(): PoolStats {
    return {
      name: this.name,
      currentSize: this.pool.length,
      maxSize: this.maxSize,
      totalAcquisitions: this.totalAcquisitions,
      totalReleases: this.totalReleases,
      hitRate: this.totalAcquisitions > 0 ? this.cacheHits / this.totalAcquisitions : 0,
      memoryEstimateMB: this.estimateMemoryUsage()
    };
  }

  private estimateMemoryUsage(): number {
    // Rough estimate: each object ~1KB
    return (this.pool.length * 1024) / (1024 * 1024);
  }

  private performMaintenance(): void {
    // Clear half the pool if it's near capacity and hit rate is low
    const hitRate = this.totalAcquisitions > 0 ? this.cacheHits / this.totalAcquisitions : 0;
    if (this.pool.length > this.maxSize * 0.8 && hitRate < 0.5) {
      const keepCount = Math.floor(this.pool.length / 2);
      this.pool.length = keepCount;
    }
  }
}

// Commonly used pooled objects
interface PooledRequest {
  id?: string;
  content?: string;
  metadata?: Record<string, any>;
  reset(): void;
}

class PooledRequestImpl implements PooledRequest {
  id?: string;
  content?: string;
  metadata?: Record<string, any>;

  reset(): void {
    this.id = undefined;
    this.content = undefined;
    this.metadata = undefined;
  }
}

interface PooledResponse {
  status?: number;
  data?: any;
  error?: string;
  reset(): void;
}

class PooledResponseImpl implements PooledResponse {
  status?: number;
  data?: any;
  error?: string;

  reset(): void {
    this.status = undefined;
    this.data = undefined;
    this.error = undefined;
  }
}

// Create object pools with memory-optimized sizes
export const requestPool = new ObjectPool('request-pool', () => new PooledRequestImpl(), 25);
export const responsePool = new ObjectPool('response-pool', () => new PooledResponseImpl(), 25);

// Memory-optimized array pool with size limits
class ArrayPool<T> {
  private pools = new Map<number, T[][]>();
  private maxArraySize = 500; // Reduced from 1000 to save memory
  private maxPoolSize = 10; // Reduced from 20 to save memory
  private totalPooledArrays = 0;
  private maxTotalArrays = 100; // Global limit on pooled arrays

  getArray(size: number): T[] {
    const poolSize = Math.min(size, this.maxArraySize);
    let pool = this.pools.get(poolSize);
    
    if (!pool) {
      pool = [];
      this.pools.set(poolSize, pool);
    }

    const array = pool.pop();
    if (array) {
      array.length = 0; // Clear the array
      this.totalPooledArrays--;
      return array;
    }

    return new Array<T>(poolSize);
  }

  releaseArray<T>(array: T[]): void {
    // Don't pool very large arrays to save memory
    if (array.length > this.maxArraySize) {
      return;
    }

    // Global limit on pooled arrays
    if (this.totalPooledArrays >= this.maxTotalArrays) {
      return;
    }

    const size = array.length;
    const poolSize = Math.min(size, this.maxArraySize);
    let pool = this.pools.get(poolSize);
    
    if (!pool) {
      pool = [];
      this.pools.set(poolSize, pool);
    }

    if (pool.length < this.maxPoolSize) {
      array.length = 0; // Clear array
      pool.push(array as any);
      this.totalPooledArrays++;
    }
  }

  clear(): void {
    this.pools.clear();
    this.totalPooledArrays = 0;
  }

  getStats(): { poolCount: number; totalArrays: number; memoryEstimateMB: number } {
    return {
      poolCount: this.pools.size,
      totalArrays: this.totalPooledArrays,
      memoryEstimateMB: (this.totalPooledArrays * 100) / (1024 * 1024) // Rough estimate
    };
  }
}

export const arrayPool = new ArrayPool();

// Memory-efficient buffer pool for handling binary data
class BufferPool {
  private pools = new Map<number, Buffer[]>();
  private maxPoolSize = 5; // Reduced from 10 to save memory
  private maxBufferSize = 8192; // 8KB max buffer size
  private totalPooledBuffers = 0;
  private maxTotalBuffers = 30; // Global limit on pooled buffers

  getBuffer(size: number): Buffer {
    // Don't pool very large buffers
    if (size > this.maxBufferSize) {
      return Buffer.allocUnsafe(size);
    }

    const pool = this.pools.get(size) || [];
    this.pools.set(size, pool);

    const buffer = pool.pop();
    if (buffer) {
      buffer.fill(0); // Clear the buffer
      this.totalPooledBuffers--;
      return buffer;
    }

    return Buffer.allocUnsafe(size);
  }

  releaseBuffer(buffer: Buffer): void {
    const size = buffer.length;
    
    // Don't pool very large buffers
    if (size > this.maxBufferSize) {
      return;
    }

    // Global limit on pooled buffers
    if (this.totalPooledBuffers >= this.maxTotalBuffers) {
      return;
    }

    const pool = this.pools.get(size) || [];
    
    if (pool.length < this.maxPoolSize) {
      pool.push(buffer);
      this.pools.set(size, pool);
      this.totalPooledBuffers++;
    }
  }

  clear(): void {
    this.pools.clear();
    this.totalPooledBuffers = 0;
  }

  getStats(): { poolCount: number; totalBuffers: number; memoryEstimateMB: number } {
    let totalMemory = 0;
    for (const [size, pool] of this.pools) {
      totalMemory += size * pool.length;
    }
    return {
      poolCount: this.pools.size,
      totalBuffers: this.totalPooledBuffers,
      memoryEstimateMB: totalMemory / (1024 * 1024)
    };
  }
}

export const bufferPool = new BufferPool();

// Pool registry for centralized management
const poolRegistry = new Map<string, any>([
  ['request', requestPool],
  ['response', responsePool],
  ['array', arrayPool],
  ['buffer', bufferPool]
]);

// Enhanced cleanup function with statistics
export function clearAllPools(): void {
  requestPool.clear();
  responsePool.clear();
  arrayPool.clear();
  bufferPool.clear();
}

// Get comprehensive pool statistics
export function getAllPoolStats(): Record<string, any> {
  return {
    request: requestPool.getStats(),
    response: responsePool.getStats(),
    array: arrayPool.getStats(),
    buffer: bufferPool.getStats(),
    summary: {
      totalPools: poolRegistry.size,
      totalMemoryEstimateMB: [
        requestPool.getStats().memoryEstimateMB,
        responsePool.getStats().memoryEstimateMB,
        arrayPool.getStats().memoryEstimateMB,
        bufferPool.getStats().memoryEstimateMB
      ].reduce((sum, mem) => sum + mem, 0)
    }
  };
}

// Memory-efficient periodic cleanup with adaptive strategy
let cleanupTimer: NodeJS.Timeout | null = null;
let lastFullCleanup = Date.now();
const FULL_CLEANUP_INTERVAL = 30 * 60 * 1000; // 30 minutes

function startPeriodicCleanup(): void {
  if (cleanupTimer) {return;} // Already started

  cleanupTimer = setInterval(() => {
    const now = Date.now();
    
    // Adaptive cleanup based on memory pressure
    const stats = getAllPoolStats();
    const totalMemory = stats.summary.totalMemoryEstimateMB;
    
    if (totalMemory > 10 || now - lastFullCleanup > FULL_CLEANUP_INTERVAL) {
      // Full cleanup if memory usage is high or it's been a while
      clearAllPools();
      lastFullCleanup = now;
    } else {
      // Partial cleanup: only clear pools with low hit rates
      if (requestPool.getStats().hitRate < 0.3 && requestPool.size() > 10) {
        requestPool.clear();
      }
      if (responsePool.getStats().hitRate < 0.3 && responsePool.size() > 10) {
        responsePool.clear();
      }
    }
  }, 5 * 60 * 1000); // Every 5 minutes
}

// Stop periodic cleanup (useful for testing)
export function stopPeriodicCleanup(): void {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}

// Auto-start cleanup when module loads
startPeriodicCleanup();

// Cleanup on process exit
process.on('exit', () => {
  stopPeriodicCleanup();
  clearAllPools();
});

// Additional utility functions for memory management
export function forcePoolMaintenance(): void {
  // Force maintenance on all pools that support it
  // This is useful during memory pressure situations
  clearAllPools();
}

export function getPoolMemoryUsage(): number {
  const stats = getAllPoolStats();
  return stats.summary.totalMemoryEstimateMB;
}