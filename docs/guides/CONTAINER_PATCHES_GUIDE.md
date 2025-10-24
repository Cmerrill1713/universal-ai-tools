# 🔧 Container Patches Application Guide

**Purpose:** Fix remaining 500 errors in containerized services  
**Impact:** 75% → 90%+ endpoint health  
**Time:** 20 minutes total

---

## 📋 Patches to Apply

### **Patch A: DB Auth → Return 503 (Not 500)**

**Target:** Corrections endpoints  
**Status:** ⚠️ Files may be in repo or container-only

**If file exists in repo:**
```bash
# Find the file
find . -name "*correction*" -type f | grep -E "\.py$"

# Apply patch if found
```

**If container-only:**
```bash
# Enter container
docker exec -it unified-ai-assistant-api bash

# Find and edit
vi /app/src/api/correction_routes.py

# Add error handling:
from fastapi.responses import JSONResponse

@router.get("/api/corrections/stats")
async def stats():
    try:
        # ... existing code ...
    except Exception as e:
        return JSONResponse(
            {"error": "DBUnavailable", "detail": str(e)},
            status_code=503
        )

# Restart
docker restart unified-ai-assistant-api
```

---

### **Patch B: Trend Key → Default to Neutral**

**Target:** `/api/v1/realtime-autonomous-vibe/technologies`  
**File:** Container `agentic-platform:/app/agents/core/realtime_autonomous_vibe_api.py`

```bash
# Enter container
docker exec -it agentic-platform bash

# Edit file
vi /app/agents/core/realtime_autonomous_vibe_api.py

# Find: trend = payload["trend"]
# Replace with:
trend = (payload.get("trend") or "neutral").lower()
if trend not in {"bullish", "bearish", "neutral"}:
    trend = "neutral"

# Restart
exit
docker restart agentic-platform
sleep 5

# Test
curl -X POST http://localhost:8013/api/v1/realtime-autonomous-vibe/technologies \
  -H "Content-Type: application/json" \
  -d '{}'

# Expected: 200 (not 500)
```

---

### **Patch C: _get_current_time Shim**

**Target:** Market/competitor analysis endpoints  
**File:** Same as Patch B

```bash
# Enter container
docker exec -it agentic-platform bash

# Edit file
vi /app/agents/core/realtime_autonomous_vibe_api.py

# Add import at top:
from datetime import datetime, timezone

# Find class definition, add method:
class RealTimeAutonomousVibeCoder:
    def _get_current_time(self):
        """Shim for legacy callers"""
        return datetime.now(timezone.utc)

# Restart
exit
docker restart agentic-platform
sleep 5

# Test
curl -X POST http://localhost:8013/api/v1/realtime-autonomous-vibe/market-analysis \
  -H "Content-Type: application/json" \
  -d '{}'

# Expected: 200 (not 500)
```

---

### **Patch D: Crawler Validation → 422 on Bad Input**

**Target:** `/crawler/crawl-urls`  
**File:** Container `/app/main.py`

```bash
# Enter container
docker exec -it agentic-platform bash

# Edit file
vi /app/main.py

# Find the crawl_urls function, update:
from fastapi import HTTPException

@app.post("/crawler/crawl-urls")
async def crawl_urls(payload: dict):
    urls = payload.get("urls")
    
    if not isinstance(urls, list) or not urls:
        raise HTTPException(
            status_code=422,
            detail="Field 'urls' must be a non-empty list"
        )
    
    # ... rest of logic ...

# Restart
exit
docker restart agentic-platform
sleep 5

# Test
curl -X POST http://localhost:8013/crawler/crawl-urls \
  -H "Content-Type: application/json" \
  -d '{}'

# Expected: 422 (not 500)
```

---

## ✅ Verification After All Patches

```bash
# Run comprehensive validation
make validate-all BASE=http://localhost:8013

# Run the one-liner
make green BASE=http://localhost:8013

# Expected results:
# - GETs: 85-90% success
# - POSTs: 85-90% success
# - 500 errors: 0 on patched endpoints
# - Overall: 🟢 BORINGLY GREEN
```

---

## 📝 Notes

**Container-only files:**
- These patches apply to files that exist only in containers
- Changes are not persisted in git
- Consider moving these files to src/ for version control
- Or document as configuration that applies at runtime

**Alternative approach:**
If these endpoints are critical, consider:
1. Extract to Python modules in `src/api/`
2. Mount as volumes in docker-compose.dev.yml
3. Version control the fixes

---

**After applying all patches, run:**
```bash
make green BASE=http://localhost:8013
```

**Expected:** 🟢 BORINGLY GREEN - ALL CHECKS PASS

