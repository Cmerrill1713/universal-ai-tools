---
title: "Validate input & handle fetch errors in /crawler/crawl-urls"
labels: ["enhancement", "api", "validation", "priority-low"]
assignees: []
---

## Impact
- `/crawler/crawl-urls` → 500 on invalid/missing `urls` field

## Current Behavior
**Note**: Upon investigation, this endpoint appears to have proper validation already. This issue documents the expected behavior for future reference.

```python
# Likely already implemented in main.py
urls = payload.get("urls") or []
if not isinstance(urls, list) or not urls:
    return JSONResponse({"error": "urls list required"}, status_code=422)
```

## Expected Behavior
1. **Input Validation**:
   - Require `urls` to be a non-empty list
   - Return 422 for invalid input
   - Validate URL format (optional)

2. **Error Handling**:
   - Capture per-URL fetch errors
   - Return partial results for successful fetches
   - Don't fail entire request on single URL error

3. **Response Format**:
```json
{
  "results": [
    {"url": "https://example.com", "status": 200},
    {"url": "https://invalid.test", "error": "ConnectionError"}
  ]
}
```

## Implementation Reference

### Robust Input Validation
```python
from fastapi import HTTPException
from fastapi.responses import JSONResponse

@app.post("/crawler/crawl-urls")
async def crawl_urls(payload: dict):
    urls = payload.get("urls") or []
    
    # Validate input
    if not isinstance(urls, list) or not urls:
        return JSONResponse(
            {"error": "urls list required", "detail": "Provide a non-empty array of URLs"},
            status_code=422
        )
    
    # Optional: validate URL format
    for url in urls:
        if not isinstance(url, str) or not url.startswith(("http://", "https://")):
            return JSONResponse(
                {"error": "Invalid URL format", "detail": f"Invalid URL: {url}"},
                status_code=422
            )
    
    # Process URLs...
```

### Per-URL Error Handling
```python
import httpx
import asyncio

async def fetch(url: str, client: httpx.AsyncClient):
    """Fetch single URL with error handling"""
    try:
        r = await client.get(url, timeout=5, follow_redirects=True)
        return {"url": url, "status": r.status_code, "content_length": len(r.content)}
    except httpx.TimeoutException:
        return {"url": url, "error": "timeout"}
    except httpx.HTTPError as e:
        return {"url": url, "error": f"HTTPError: {type(e).__name__}"}
    except Exception as e:
        return {"url": url, "error": f"{type(e).__name__}: {str(e)[:100]}"}

@app.post("/crawler/crawl-urls")
async def crawl_urls(payload: dict):
    urls = payload.get("urls") or []
    
    if not isinstance(urls, list) or not urls:
        return JSONResponse({"error": "urls list required"}, status_code=422)
    
    # Fetch all URLs concurrently
    async with httpx.AsyncClient() as client:
        results = await asyncio.gather(*[fetch(u, client) for u in urls])
    
    return {"results": results, "total": len(urls)}
```

## Validation
```bash
# Test with invalid payload
curl -X POST http://localhost:8013/crawler/crawl-urls \
  -H "Content-Type: application/json" \
  -d '{}'

# Expected: 422 Unprocessable Entity

# Test with valid URLs
curl -X POST http://localhost:8013/crawler/crawl-urls \
  -H "Content-Type: application/json" \
  -d '{"urls": ["https://httpbin.org/get", "https://example.com"]}'

# Expected: 200 OK with results array

# Test with mix of valid/invalid URLs
curl -X POST http://localhost:8013/crawler/crawl-urls \
  -H "Content-Type: application/json" \
  -d '{"urls": ["https://httpbin.org/get", "https://invalid.test.123"]}'

# Expected: 200 OK with partial results (one success, one error)
```

## File Location
- Container: `agentic-platform`
- Path: `/app/main.py` (likely)
- Endpoint: `POST /crawler/crawl-urls`

## References
- See `issues/CRAWLER_INPUT_VALIDATION.md` for detailed analysis
- Note: This endpoint may already be correctly implemented

