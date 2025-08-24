# Memory Management Quick Reference

## 🚀 Quick Commands

### Check Memory Status
```bash
# Real-time Node.js memory monitor (recommended)
node scripts/monitor-memory.js

# One-time memory check
./scripts/memory-optimization.sh

# Docker memory usage
docker stats --no-stream
```

### Clean Up Memory
```bash
# Full cleanup (safe, recommended)
./scripts/cleanup-memory.sh

# Quick Docker cleanup
docker system prune -a -f
```

### Start Services
```bash
# Start only essential services (recommended)
./scripts/start-essential.sh

# Then start your dev server
npm run dev
```

## ⚡ Quick Fixes

### "High memory usage detected" warnings
```bash
# These are fixed now, but if they appear:
# The warnings were about system memory, not Node.js
# Your Node.js uses only ~150MB (healthy!)
```

### Docker using too much memory
```bash
# Stop duplicates (already done)
docker stop universal-ai-tools-postgres universal-ai-tools-redis

# Use Supabase PostgreSQL instead
# Port: 54322 (not 5432)
```

### Swift compilation eating memory
```bash
# Kill Swift processes
pkill -f swift-frontend

# Or close Xcode
osascript -e 'quit app "Xcode"'
```

## 📊 Memory Health Indicators

### ✅ Healthy (Your Current State)
- Node.js heap: < 200MB
- Docker total: < 5GB  
- System free: > 10GB

### ⚠️ Warning
- Node.js heap: 200-500MB
- Docker total: 5-10GB
- System free: 5-10GB

### 🔴 Critical
- Node.js heap: > 500MB
- Docker total: > 10GB
- System free: < 5GB

## 🎯 Your Actual Memory Usage

```
Node.js Server:     150MB  ✅ Excellent!
Docker (Supabase):  3.7GB  ✅ Normal
Swift (when building): 4-6GB  ⚠️ Temporary
System Total:       64GB   💪 Plenty!
```

## 🔧 Configuration Files

### Node.js Memory Settings
Location: `package.json`
```json
"dev": "node --expose-gc --max-old-space-size=4096 ..."
```

### Docker Memory Limits
Location: `docker-compose.yml`
```yaml
mem_limit: 2g
```

### Monitoring Thresholds
Location: `src/services/monitoring/metrics-collection-service.ts`
- Now monitors Node.js heap (not system memory)
- Warning at 85% heap usage (not 90% system)

## 📝 Remember

1. **Your Node.js server is fine** - 150MB is excellent
2. **Docker was the issue** - Now optimized
3. **Swift is temporary** - Only during Xcode builds
4. **64GB is plenty** - Just avoid duplicates

## 🆘 Emergency Commands

```bash
# If everything is slow
./scripts/cleanup-memory.sh

# If server won't start
pkill -f "npm\|node\|tsx"
npm run dev

# If Docker is stuck
docker stop $(docker ps -q)
docker system prune -a -f

# If system is frozen
sudo purge  # macOS only
```