# Issue: Validate input & handle fetch errors in /crawler/crawl-urls

## 🐛 Problem

**Impact:** Potential 500 on bad/missing urls  
**Endpoint:** `POST /crawler/crawl-urls`

**Note:** Endpoint is actually working now, but needs hardening for edge cases.

---

## 🔍 Root Cause

May not properly validate input or handle fetch errors for invalid URLs.

---

## ✅ Fix

**File:** `/app/main.py` or wherever crawler endpoint is defined

```python
@app.post("/crawler/crawl-urls")
async def crawl_urls_direct(request: dict):
    """Crawl URLs with proper validation"""
    
    # Validate input
    urls = request.get("urls") or []
    if not isinstance(urls, list) or not urls:
        return JSONResponse(
            {"error": "urls list required"}, 
            status_code=422
        )
    
    # Fetch with error handling
    import httpx, asyncio
    
    async def fetch(u, c):
        try:
            r = await c.get(u, timeout=5)
            return {"url": u, "status": r.status_code, "success": True}
        except Exception as e:
            return {"url": u, "error": f"{type(e).__name__}", "success": False}
    
    async with httpx.AsyncClient() as c:
        results = [await fetch(u, c) for u in urls]
    
    return {
        "results": results,
        "total": len(results),
        "successful": sum(1 for r in results if r.get("success"))
    }
```

---

## 🧪 Validation

### Test with invalid input
```bash
curl -X POST http://localhost:8000/crawler/crawl-urls \
  -H "Content-Type: application/json" \
  -d '{}'
```
Expected: `422 Validation Error`

### Test with valid URLs
```bash
curl -X POST http://localhost:8000/crawler/crawl-urls \
  -H "Content-Type: application/json" \
  -d '{"urls": ["https://example.com", "https://invalid-url"]}'
```
Expected: `200 OK` with result array showing success/failure per URL

### Test with malformed URLs
```bash
curl -X POST http://localhost:8000/crawler/crawl-urls \
  -H "Content-Type: application/json" \
  -d '{"urls": ["not-a-url", "also-bad"]}'
```
Expected: `200 OK` with error details per URL (not 500)

---

## 📋 Implementation Checklist

- [ ] Add input validation (check urls is list)
- [ ] Return 422 for invalid input
- [ ] Wrap each URL fetch in try/except
- [ ] Return structured results with per-URL status
- [ ] Test with valid/invalid/malformed URLs
- [ ] Verify no 500 errors

---

**Status:** Documented for hardening (currently works but can be improved)  
**Priority:** Low (works now, hardening for edge cases)  
**Estimated effort:** 20 minutes

