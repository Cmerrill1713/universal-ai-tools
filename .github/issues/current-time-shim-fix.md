---
title: "Provide _get_current_time shim or replace with datetime.now(tz=UTC)"
labels: ["bug", "api", "priority-medium"]
assignees: []
---

## Impact
- `/api/v1/realtime-autonomous-vibe/market-analysis` → 500
- `/api/v1/realtime-autonomous-vibe/competitor-analysis` → 500

## Root Cause
```python
# In agentic-platform:/app/agents/core/realtime_autonomous_vibe_api.py
current_time = self._get_current_time()  # AttributeError: method doesn't exist
```

## Current Behavior
```json
POST /api/v1/realtime-autonomous-vibe/market-analysis
{}

Response: 500 Internal Server Error
{"error": "AttributeError", "detail": "'RealtimeVibeAPI' object has no attribute '_get_current_time'"}
```

## Expected Behavior
- Return current UTC timestamp
- Return 200 with analysis results

## Fix Options

### Option 1: Add Shim Method (Minimal)
```python
from datetime import datetime, timezone

class RealtimeVibeAPI:
    def _get_current_time(self) -> datetime:
        """Return current UTC time"""
        return datetime.now(timezone.utc)
    
    # ... rest of class ...
```

### Option 2: Inline Replacement (Preferred)
```python
# Before
current_time = self._get_current_time()

# After
from datetime import datetime, timezone
current_time = datetime.now(timezone.utc)
```

### Option 3: Use Existing Utility
```python
# If there's a time utility module
from src.utils.time import get_utc_now

current_time = get_utc_now()
```

## Validation
```bash
# Test market analysis
curl -X POST http://localhost:8013/api/v1/realtime-autonomous-vibe/market-analysis \
  -H "Content-Type: application/json" \
  -d '{}'

# Expected: 200 OK with analysis data

# Test competitor analysis
curl -X POST http://localhost:8013/api/v1/realtime-autonomous-vibe/competitor-analysis \
  -H "Content-Type: application/json" \
  -d '{}'

# Expected: 200 OK with analysis data
```

## File Location
- Container: `agentic-platform`
- Path: `/app/agents/core/realtime_autonomous_vibe_api.py`
- Class: `RealtimeVibeAPI`
- Methods: `market_analysis()`, `competitor_analysis()`

## References
- See `issues/CURRENT_TIME_SHIM_FIX.md` for detailed analysis
- Affected endpoints both in same file

