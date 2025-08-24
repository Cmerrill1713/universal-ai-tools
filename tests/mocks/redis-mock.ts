// Redis Mock for Testing
// Provides a lightweight Redis implementation for test environments

export class RedisMock {
  private data: Map<string, any> = new Map();
  private ttl: Map<string, number> = new Map();

  async ping(): Promise<string> {
    return 'PONG';
  }

  async get(key: string): Promise<string | null> {
    // Check if key has expired
    const expiry = this.ttl.get(key);
    if (expiry && Date.now() > expiry) {
      this.data.delete(key);
      this.ttl.delete(key);
      return null;
    }
    return this.data.get(key) || null;
  }

  async set(key: string, value: string, options?: { EX?: number }): Promise<string> {
    this.data.set(key, value);
    if (options?.EX) {
      this.ttl.set(key, Date.now() + (options.EX * 1000));
    }
    return 'OK';
  }

  async del(...keys: string[]): Promise<number> {
    let deleted = 0;
    for (const key of keys) {
      if (this.data.has(key)) {
        this.data.delete(key);
        this.ttl.delete(key);
        deleted++;
      }
    }
    return deleted;
  }

  async exists(...keys: string[]): Promise<number> {
    return keys.filter(key => this.data.has(key)).length;
  }

  async keys(pattern: string): Promise<string[]> {
    const keys = Array.from(this.data.keys());
    if (pattern === '*') return keys;
    
    // Simple pattern matching for test purposes
    const regexPattern = pattern.replace(/\*/g, '.*');
    const regex = new RegExp(regexPattern);
    return keys.filter(key => regex.test(key));
  }

  async flushdb(): Promise<string> {
    this.data.clear();
    this.ttl.clear();
    return 'OK';
  }

  async info(section?: string): Promise<string> {
    if (section === 'memory') {
      return `used_memory:${this.data.size * 100}\nused_memory_human:${Math.round(this.data.size / 10)}K`;
    }
    if (section === 'keyspace') {
      return `db0:keys=${this.data.size},expires=${this.ttl.size}`;
    }
    return 'redis_mode:standalone\nredis_version:6.0.0-mock';
  }

  // Connection management (no-ops for mock)
  async quit(): Promise<string> {
    return 'OK';
  }

  async disconnect(): Promise<void> {
    // No-op for mock
  }

  // Support chaining
  result(): any {
    return this;
  }
}

// Factory function for creating Redis mock instances
export function createRedisMock(): RedisMock {
  return new RedisMock();
}

// Default export for easy testing
export default RedisMock;