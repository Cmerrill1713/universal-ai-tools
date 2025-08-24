# Memory Leak Prevention Guidelines for Developers

## 📋 Overview

This guide provides best practices and patterns to prevent memory leaks in the Universal AI Tools codebase. Follow these guidelines when writing new code or refactoring existing services.

## 🚨 Common Memory Leak Patterns to Avoid

### 1. Uncleared Timers (setTimeout/setInterval)
**❌ BAD:**
```typescript
class MyService {
  startPolling() {
    setInterval(() => this.poll(), 5000); // Timer reference lost!
  }
}
```

**✅ GOOD:**
```typescript
class MyService {
  private pollingTimer?: NodeJS.Timeout;
  private isShuttingDown = false;

  startPolling() {
    this.pollingTimer = setInterval(() => {
      if (!this.isShuttingDown) {
        this.poll();
      }
    }, 5000);
  }

  async shutdown() {
    this.isShuttingDown = true;
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = undefined;
    }
  }
}
```

### 2. Unbounded Data Structures
**❌ BAD:**
```typescript
class CacheService {
  private cache = new Map();
  
  addToCache(key: string, value: any) {
    this.cache.set(key, value); // Grows forever!
  }
}
```

**✅ GOOD:**
```typescript
class CacheService {
  private cache = new Map();
  private readonly maxCacheSize = 1000;
  
  addToCache(key: string, value: any) {
    // Implement LRU or size limit
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }
  
  async shutdown() {
    this.cache.clear();
  }
}
```

### 3. Event Listener Leaks
**❌ BAD:**
```typescript
class EventService {
  constructor() {
    process.on('message', this.handleMessage); // Listener never removed!
  }
}
```

**✅ GOOD:**
```typescript
class EventService {
  private handleMessageBound = this.handleMessage.bind(this);
  
  constructor() {
    process.on('message', this.handleMessageBound);
  }
  
  async shutdown() {
    process.removeListener('message', this.handleMessageBound);
  }
}
```

### 4. Stream and Connection Leaks
**❌ BAD:**
```typescript
async function processFile(path: string) {
  const stream = fs.createReadStream(path);
  // Stream never closed on error!
  stream.on('data', chunk => process(chunk));
}
```

**✅ GOOD:**
```typescript
async function processFile(path: string) {
  const stream = fs.createReadStream(path);
  try {
    stream.on('data', chunk => process(chunk));
    stream.on('error', err => {
      stream.destroy();
      throw err;
    });
    stream.on('end', () => stream.destroy());
  } catch (error) {
    stream.destroy();
    throw error;
  }
}
```

## 🛠️ Required Service Patterns

### 1. Mandatory Shutdown Method
Every service MUST implement a shutdown method:

```typescript
export class MyService {
  private isShuttingDown = false;
  private activeTimers = new Set<NodeJS.Timeout>();
  private connections = new Map<string, Connection>();

  async shutdown(): Promise<void> {
    log.info('Shutting down MyService...', LogContext.SYSTEM);
    
    // 1. Set shutdown flag
    this.isShuttingDown = true;
    
    // 2. Clear all timers
    for (const timer of this.activeTimers) {
      clearTimeout(timer);
    }
    this.activeTimers.clear();
    
    // 3. Close connections
    for (const [id, connection] of this.connections) {
      await connection.close();
    }
    this.connections.clear();
    
    // 4. Clear data structures
    this.cache?.clear();
    this.queue?.length = 0;
    
    log.info('MyService shutdown completed', LogContext.SYSTEM);
  }
}
```

### 2. Router Shutdown Integration
Routers with stateful services must export shutdown functions:

```typescript
// In router file
let service: MyService | null = null;

export async function shutdownMyRouter(): Promise<void> {
  if (service) {
    await service.shutdown();
    service = null;
  }
}

// In server.ts shutdown
const { shutdownMyRouter } = await import('./routers/my-router');
await shutdownMyRouter();
```

### 3. Bounded Collections
Always set maximum sizes for collections:

```typescript
class DataCollector {
  private readonly maxItems = 10000;
  private readonly maxAge = 60 * 60 * 1000; // 1 hour
  private items = new Map<string, TimestampedItem>();

  add(item: Item) {
    // Age-based pruning
    this.pruneOldItems();
    
    // Size-based pruning
    if (this.items.size >= this.maxItems) {
      this.pruneOldestItems(this.maxItems * 0.2); // Remove 20%
    }
    
    this.items.set(item.id, {
      data: item,
      timestamp: Date.now()
    });
  }

  private pruneOldItems() {
    const cutoff = Date.now() - this.maxAge;
    for (const [id, item] of this.items) {
      if (item.timestamp < cutoff) {
        this.items.delete(id);
      }
    }
  }
}
```

## 🔍 Testing for Memory Leaks

### 1. Stress Test Template
```javascript
// memory-stress-test.js
const ITERATIONS = 1000;
const CONCURRENT = 10;

async function stressTest() {
  const before = process.memoryUsage();
  
  // Run operations
  for (let i = 0; i < ITERATIONS; i++) {
    await Promise.all(
      Array(CONCURRENT).fill(0).map(() => 
        callYourEndpoint()
      )
    );
    
    if (i % 100 === 0) {
      const current = process.memoryUsage();
      const growth = (current.heapUsed - before.heapUsed) / 1024 / 1024;
      console.log(`Iteration ${i}: Memory growth: ${growth.toFixed(2)} MB`);
    }
  }
  
  const after = process.memoryUsage();
  const totalGrowth = (after.heapUsed - before.heapUsed) / 1024 / 1024;
  
  // Should be near 0 for leak-free code
  assert(totalGrowth < 10, `Memory grew by ${totalGrowth} MB`);
}
```

### 2. Monitoring During Development
Run with memory monitoring flags:
```bash
# Enable GC logging
node --expose-gc --trace-gc server.js

# Profile memory
node --inspect server.js
# Then use Chrome DevTools Memory Profiler
```

## 📊 Memory Budget Guidelines

### Service Memory Limits
- **Small Services**: < 50 MB heap usage
- **Medium Services**: < 200 MB heap usage  
- **Large Services**: < 500 MB heap usage
- **ML/AI Services**: < 1 GB heap usage

### Collection Size Limits
- **Caches**: Max 10,000 items or 100 MB
- **Queues**: Max 1,000 items
- **History**: Max 24 hours of data
- **Connections**: Max 100 concurrent

## 🚀 Best Practices Checklist

### When Writing New Services
- [ ] Implement `shutdown()` method
- [ ] Track all timers in a Set
- [ ] Set `isShuttingDown` flag
- [ ] Bound all collections with max size
- [ ] Clear event listeners on shutdown
- [ ] Close all connections/streams
- [ ] Add to server shutdown sequence

### When Using External Resources
- [ ] Always use try/finally for cleanup
- [ ] Set timeouts on all operations
- [ ] Handle connection errors
- [ ] Implement reconnection with backoff
- [ ] Log resource allocation/deallocation

### Code Review Checklist
- [ ] Check for `setInterval` without cleanup
- [ ] Check for `setTimeout` without tracking
- [ ] Check for unbounded Maps/Arrays
- [ ] Check for event listeners without removal
- [ ] Check for streams without proper closing
- [ ] Verify shutdown method exists
- [ ] Verify shutdown is called in server

## 🔧 Automated Prevention

### 1. ESLint Rules
Add to `.eslintrc.js`:
```javascript
{
  "rules": {
    "no-restricted-syntax": [
      "error",
      {
        "selector": "CallExpression[callee.name='setInterval']:not([parent.type='AssignmentExpression'])",
        "message": "setInterval must be assigned to a variable for cleanup"
      }
    ]
  }
}
```

### 2. Pre-commit Hooks
Check for shutdown methods:
```bash
#!/bin/bash
# Check services have shutdown methods
for file in src/services/*.ts; do
  if ! grep -q "shutdown()" "$file"; then
    echo "ERROR: $file missing shutdown() method"
    exit 1
  fi
done
```

## 📈 Monitoring in Production

### Key Metrics to Track
1. **Heap Usage Percentage**: Should stay < 70%
2. **Memory Growth Rate**: Should be ~0 MB/min
3. **GC Frequency**: Major GCs < 1/min
4. **RSS Growth**: Should stabilize after warmup

### Alert Thresholds
- **Warning**: Heap usage > 70%
- **Error**: Heap usage > 85%
- **Critical**: Heap usage > 95%
- **Leak Detection**: Growth > 10 MB/min for 10 min

## 🆘 Debugging Memory Leaks

### Quick Diagnosis
```bash
# 1. Check current memory usage
curl http://localhost:9999/api/v1/memory-monitoring/current

# 2. Check memory statistics
curl http://localhost:9999/api/v1/memory-monitoring/statistics?hours=1

# 3. Force garbage collection
curl -X POST http://localhost:9999/api/v1/memory-monitoring/gc
```

### Heap Snapshot Analysis
```javascript
// Take heap snapshots
const v8 = require('v8');
v8.writeHeapSnapshot(`heap-${Date.now()}.heapsnapshot`);

// Compare in Chrome DevTools
// 1. Load both snapshots
// 2. Select "Comparison" view
// 3. Look for objects with high "# Delta"
```

## 📚 Additional Resources

- [Node.js Memory Management](https://nodejs.org/en/docs/guides/diagnostics/memory-leaks/)
- [V8 Memory Profiling](https://v8.dev/docs/memory)
- [Chrome DevTools Memory Profiler](https://developer.chrome.com/docs/devtools/memory-problems/)

## 🎯 Summary

1. **Always implement shutdown methods**
2. **Track and clear all timers**
3. **Bound all data structures**
4. **Remove event listeners**
5. **Close streams and connections**
6. **Test with stress loads**
7. **Monitor in production**

Following these guidelines will prevent 95%+ of memory leaks in Node.js applications.