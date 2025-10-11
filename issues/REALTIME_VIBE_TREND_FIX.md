# Issue: Harden payload schema for /api/v1/realtime-autonomous-vibe/technologies

## 🐛 Problem

**Impact:** 500 error on missing 'trend' key  
**Endpoint:** `GET /api/v1/realtime-autonomous-vibe/technologies`

**Error Message:**
```
KeyError: 'trend'
```

---

## 🔍 Root Cause

Endpoint expects `payload['trend']` but the key may not exist in all technology data structures.

---

## ✅ Fix

**File:** `/app/agents/core/realtime_autonomous_vibe_api.py` (in container)

**Before:**
```python
trend = payload["trend"]
```

**After:**
```python
trend = payload.get('trend') or payload.get('trendScore') or 'neutral'
if trend not in {'bullish', 'bearish', 'neutral'}:
    trend = 'neutral'
```

---

## 🧪 Validation

### Test with trend
```bash
curl -X POST http://localhost:8000/api/v1/realtime-autonomous-vibe/technologies \
  -H "Content-Type: application/json" \
  -d '{"trend": "bullish"}'
```
Expected: `200 OK`

### Test without trend
```bash
curl -X POST http://localhost:8000/api/v1/realtime-autonomous-vibe/technologies \
  -H "Content-Type: application/json" \
  -d '{}'
```
Expected: `200 OK` or `422 Validation Error` (not 500)

---

## 📋 Implementation Checklist

- [ ] Locate the trend extraction in realtime_autonomous_vibe_api.py
- [ ] Replace `payload["trend"]` with safe getter
- [ ] Add validation for allowed values
- [ ] Restart agentic-platform container
- [ ] Test with/without trend key
- [ ] Verify no 500 errors

---

**Status:** Documented for separate PR  
**Priority:** Medium  
**Estimated effort:** 15 minutes

