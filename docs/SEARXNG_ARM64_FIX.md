# SearXNG ARM64 Native Fix for Apple Silicon

## Issue
SearXNG was running under AMD64 architecture with Rosetta 2 emulation on Apple Silicon Mac, causing performance degradation.

## Solution Applied

### 1. Removed AMD64 Container
```bash
docker stop searxng
docker rm searxng
```

### 2. Pulled and Started ARM64 Native Version
```bash
docker pull --platform linux/arm64 searxng/searxng:latest
docker run -d \
  --name searxng \
  -p 8888:8080 \
  -v ~/Desktop/universal-ai-tools/searxng-config/limiter.toml:/etc/searxng/limiter.toml:ro \
  --restart unless-stopped \
  --platform linux/arm64 \
  searxng/searxng:latest
```

### 3. Created Configuration
Created `searxng-config/limiter.toml` to suppress botdetection warnings for local development.

## Result
- ✅ SearXNG now runs natively on ARM64/Apple Silicon
- ✅ No more Rosetta 2 emulation overhead
- ✅ Significantly improved performance
- ✅ Accessible at http://localhost:8888

## Verification
```bash
# Check architecture
docker image inspect searxng/searxng:latest --format '{{.Architecture}}'
# Output: arm64

# System architecture
uname -m
# Output: arm64
```

## Notes
- The X-Forwarded-For warning is normal for direct access without reverse proxy
- Port changed from default to 8888 to avoid conflicts