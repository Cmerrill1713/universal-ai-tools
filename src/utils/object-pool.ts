/**
 * Object Pool - Memory optimization utility
 * Reuses objects to reduce garbage collection pressure
 */

interface PoolableObject {
  reset?(): void;
}

class ObjectPool<T extends PoolableObject> {
  private pool: T[] = [];
  private createFn: () => T;
  private resetFn?: (obj: T) => void;
  private maxSize: number;

  constructor(
    createFn: () => T, 
    maxSize = 100,
    resetFn?: (obj: T) => void
  ) {
    this.createFn = createFn;
    this.resetFn = resetFn;
    this.maxSize = maxSize;
  }

  acquire(): T {
    const obj = this.pool.pop() || this.createFn();
    return obj;
  }

  release(obj: T): void {
    if (this.pool.length >= this.maxSize) {
      return; // Pool is full, let GC handle it
    }

    // Reset the object
    if (this.resetFn) {
      this.resetFn(obj);
    } else if (obj.reset) {
      obj.reset();
    }

    this.pool.push(obj);
  }

  size(): number {
    return this.pool.length;
  }

  clear(): void {
    this.pool.length = 0;
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

// Create object pools
export const requestPool = new ObjectPool(() => new PooledRequestImpl(), 50);
export const responsePool = new ObjectPool(() => new PooledResponseImpl(), 50);

// Generic memory optimized array pool
class ArrayPool<T> {
  private pools = new Map<number, T[][]>();
  private maxArraySize = 1000;
  private maxPoolSize = 20;

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
      return array;
    }

    return new Array<T>(poolSize);
  }

  releaseArray<T>(array: T[]): void {
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
    }
  }

  clear(): void {
    this.pools.clear();
  }
}

export const arrayPool = new ArrayPool();

// Buffer pool for handling binary data
class BufferPool {
  private pools = new Map<number, Buffer[]>();
  private maxPoolSize = 10;

  getBuffer(size: number): Buffer {
    const pool = this.pools.get(size) || [];
    this.pools.set(size, pool);

    const buffer = pool.pop();
    if (buffer) {
      buffer.fill(0); // Clear the buffer
      return buffer;
    }

    return Buffer.allocUnsafe(size);
  }

  releaseBuffer(buffer: Buffer): void {
    const size = buffer.length;
    const pool = this.pools.get(size) || [];
    
    if (pool.length < this.maxPoolSize) {
      pool.push(buffer);
      this.pools.set(size, pool);
    }
  }

  clear(): void {
    this.pools.clear();
  }
}

export const bufferPool = new BufferPool();

// Cleanup function to be called on shutdown
export function clearAllPools(): void {
  requestPool.clear();
  responsePool.clear();
  arrayPool.clear();
  bufferPool.clear();
}

// Start periodic cleanup of pools
setInterval(() => {
  // Randomly clear some pools to prevent indefinite growth
  if (Math.random() < 0.1) {
    if (requestPool.size() > 30) requestPool.clear();
    if (responsePool.size() > 30) responsePool.clear();
    arrayPool.clear();
    bufferPool.clear();
  }
}, 5 * 60 * 1000); // Every 5 minutes