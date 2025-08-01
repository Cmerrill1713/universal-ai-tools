# 🚨 Memory Optimization Analysis for Universal AI Tools

## Current Memory Usage Issues

### 1. **LFM2 Server (Python)** - 2.68GB RAM
- Loading full LFM2-1.2B model in bf16 format
- MLX framework loads entire model into memory
- No quantization applied

### 2. **Multiple Process Duplication**
- Multiple node processes running (tsx watch)
- Duplicate Python processes (kokoro_server.py running twice)
- Multiple esbuild instances

### 3. **Main Node Server** - 797MB RAM
- Holding all service instances in memory
- No lazy loading of services

## 🎯 Optimization Strategies

### 1. **Model Quantization** (Immediate - Save 50-75% RAM)
```python
# Change from bf16 to 4-bit quantization
# In lfm2-server.py:
self.model, self.tokenizer = load(
    self.model_path,
    tokenizer_config={"trust_remote_code": True},
    model_config={"quantization": {"group_size": 32, "bits": 4}}
)
```

### 2. **Lazy Service Loading**
```typescript
// In server.ts - Load services only when needed
class LazyServiceLoader {
  private services = new Map<string, any>();
  
  async getService(name: string) {
    if (!this.services.has(name)) {
      switch(name) {
        case 'lfm2':
          this.services.set(name, await import('./services/lfm2-bridge'));
          break;
        // ... other services
      }
    }
    return this.services.get(name);
  }
}
```

### 3. **Process Consolidation**
- Kill duplicate processes
- Use single kokoro server instance
- Consolidate tsx watch processes

### 4. **Memory Limits for Python Processes**
```python
# Add to Python services
import resource
# Limit to 1GB per Python process
resource.setrlimit(resource.RLIMIT_AS, (1 * 1024 * 1024 * 1024, -1))
```

### 5. **Garbage Collection Optimization**
```typescript
// In server.ts
if (global.gc) {
  setInterval(() => {
    global.gc();
    log.debug('Manual GC triggered', LogContext.SYSTEM);
  }, 30000); // Every 30 seconds
}
```

### 6. **Service Timeout & Cleanup**
```typescript
// Auto-shutdown idle services
class ServiceManager {
  private lastUsed = new Map<string, number>();
  private readonly IDLE_TIMEOUT = 5 * 60 * 1000; // 5 minutes
  
  scheduleCleanup() {
    setInterval(() => {
      const now = Date.now();
      for (const [service, lastTime] of this.lastUsed) {
        if (now - lastTime > this.IDLE_TIMEOUT) {
          this.shutdownService(service);
        }
      }
    }, 60000); // Check every minute
  }
}
```

## 🚀 Quick Wins (Do These First)

### 1. Kill Duplicate Processes
```bash
# Kill duplicate kokoro servers
pkill -f kokoro_server.py
# Kill extra tsx watchers
pkill -f "tsx watch"
# Restart services cleanly
npm run dev
```

### 2. Use Quantized LFM2 Model
Download or convert LFM2 to 4-bit quantization:
```bash
# If using mlx_lm
python -m mlx_lm.convert --model LFM2-1.2B --quantize --q-bits 4
```

### 3. Disable Unused Services
In `.env`:
```
ENABLE_KOKORO=false  # If not using TTS
ENABLE_MLX_FINE_TUNING=false  # If not actively training
ENABLE_SDXL_REFINER=false  # If not using image generation
```

### 4. Node.js Memory Limit
```json
// In package.json scripts
"dev": "NODE_OPTIONS='--max-old-space-size=1024' tsx watch src/server.ts"
```

## 📊 Expected Results

After optimizations:
- LFM2 Server: 2.68GB → ~700MB (4-bit quantization)
- Main Node Server: 797MB → ~400MB (lazy loading)
- Total System RAM: ~4GB → ~1.5GB

## 🔧 Long-term Solutions

1. **Model Server Pool**
   - Share models across services
   - Load balancing for multiple requests
   
2. **Edge Runtime**
   - Use Cloudflare Workers or Deno Deploy for stateless operations
   
3. **Model Streaming**
   - Stream model weights from disk instead of full loading
   
4. **Microservices Architecture**
   - Separate heavy services into independent deployable units
   - Use Kubernetes-style orchestration

## 🎯 Immediate Action Items

1. Quantize LFM2 model to 4-bit
2. Kill duplicate processes
3. Implement lazy loading for services
4. Add memory monitoring to health checks
5. Set up auto-cleanup for idle services