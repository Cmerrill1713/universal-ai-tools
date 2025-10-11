---
title: "Harden payload schema for /api/v1/realtime-autonomous-vibe/technologies"
labels: ["bug", "api", "validation", "priority-medium"]
assignees: []
---

## Impact
- `/api/v1/realtime-autonomous-vibe/technologies` → 500 on missing 'trend' key

## Root Cause
```python
# In agentic-platform:/app/agents/core/realtime_autonomous_vibe_api.py
trend = payload["trend"]  # KeyError if 'trend' not provided
```

## Current Behavior
```json
POST /api/v1/realtime-autonomous-vibe/technologies
{"trendScore": "bullish"}  # Missing 'trend' key

Response: 500 Internal Server Error
{"error": "KeyError", "detail": "'trend'"}
```

## Expected Behavior
- Accept `trend` or `trendScore` keys
- Default to `"neutral"` if neither provided
- Validate against allowed values: `{"bullish", "bearish", "neutral"}`
- Return 422 for invalid values (not 500)

## Fix

### Minimal Change
```python
# Before
trend = payload["trend"]

# After
trend = payload.get("trend") or payload.get("trendScore") or "neutral"
if trend not in {"bullish", "bearish", "neutral"}:
    trend = "neutral"  # Or raise HTTPException(422, detail="Invalid trend value")
```

### Recommended: Pydantic Model
```python
from pydantic import BaseModel, Field
from typing import Literal

class TechnologyPayload(BaseModel):
    trend: Literal["bullish", "bearish", "neutral"] = Field(default="neutral", alias="trendScore")
    # ... other fields ...

@app.post("/api/v1/realtime-autonomous-vibe/technologies")
async def technologies(payload: TechnologyPayload):
    trend = payload.trend
    # ... rest of logic ...
```

## Validation
```bash
# Test with missing trend
curl -X POST http://localhost:8013/api/v1/realtime-autonomous-vibe/technologies \
  -H "Content-Type: application/json" \
  -d '{"trendScore": "bullish"}'

# Expected: 200 OK

# Test with invalid trend
curl -X POST http://localhost:8013/api/v1/realtime-autonomous-vibe/technologies \
  -H "Content-Type: application/json" \
  -d '{"trend": "invalid"}'

# Expected: 422 Unprocessable Entity (or 200 with default)
```

## File Location
- Container: `agentic-platform`
- Path: `/app/agents/core/realtime_autonomous_vibe_api.py`
- Function: `technologies()` endpoint handler

## References
- See `issues/REALTIME_VIBE_TREND_FIX.md` for detailed analysis

