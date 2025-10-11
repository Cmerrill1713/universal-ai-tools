# Issue: Provide _get_current_time shim or replace with datetime.now(tz=UTC)

## 🐛 Problem

**Impact:** 500 error on market/competitor analysis endpoints  
**Affected Endpoints:**
- `GET /api/v1/realtime-autonomous-vibe/market-analysis` → 500
- `GET /api/v1/realtime-autonomous-vibe/competitor-analysis` → 500

**Error Message:**
```
AttributeError: 'RealTimeAutonomousVibeCoder' object has no attribute '_get_current_time'
```

---

## 🔍 Root Cause

The `RealTimeAutonomousVibeCoder` class is calling `self._get_current_time()` but the method doesn't exist.

---

## ✅ Fix

**File:** `/app/agents/core/realtime_autonomous_vibe_api.py` (in container)

**Option 1: Add shim method**
```python
class RealTimeAutonomousVibeCoder:
    def _get_current_time(self):
        """Get current UTC timestamp"""
        from datetime import datetime, timezone
        return datetime.now(timezone.utc)
```

**Option 2: Inline datetime (simpler)**
```python
# Replace all: self._get_current_time()
# With: datetime.now(timezone.utc)

from datetime import datetime, timezone

# In market-analysis endpoint:
current_time = datetime.now(timezone.utc)

# In competitor-analysis endpoint:
current_time = datetime.now(timezone.utc)
```

---

## 🧪 Validation

### Test market analysis
```bash
curl -X POST http://localhost:8000/api/v1/realtime-autonomous-vibe/market-analysis \
  -H "Content-Type: application/json" \
  -d '{}'
```
Expected: `200 OK` (not 500)

### Test competitor analysis
```bash
curl -X POST http://localhost:8000/api/v1/realtime-autonomous-vibe/competitor-analysis \
  -H "Content-Type: application/json" \
  -d '{}'
```
Expected: `200 OK` (not 500)

---

## 📋 Implementation Checklist

- [ ] Choose fix approach (shim vs inline)
- [ ] Add imports: `from datetime import datetime, timezone`
- [ ] Apply fix to both endpoints
- [ ] Restart agentic-platform container
- [ ] Test both endpoints return 200
- [ ] Run verifier v2 to confirm no 500s

---

**Status:** Documented for separate PR  
**Priority:** Medium  
**Estimated effort:** 10 minutes

