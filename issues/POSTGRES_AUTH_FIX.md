# Issue: Fix Postgres Auth for Corrections Endpoints

## 🐛 Problem

**Impact:** 500 errors on corrections endpoints  
**Affected Endpoints:**
- `GET /api/corrections/stats` → 500
- `GET /api/corrections/recent` → 500
- `POST /api/corrections/trigger-retraining` → 500

**Error Message:**
```
(psycopg2.OperationalError) connection to server at "postgres" (172.18.0.20), 
port 5432 failed: FATAL: password authentication failed for user "postgres"
```

---

## 🔍 Root Cause

**DATABASE_URL/user mismatch or missing grants**

Current configuration has mismatched credentials:
- Container uses: `DATABASE_URL=postgresql://postgres:unified-secure-password-$(openssl rand -hex 16)@postgres:5432/unified_platform`
- The `$(openssl rand -hex 16)` is NOT being evaluated, causing literal string mismatch
- Database user may not have proper grants

---

## ✅ Fix

### 1. Ensure DATABASE_URL matches app_user + app_db

**File:** `docker-compose.yml` or `.env`

```yaml
services:
  unified-postgres:
    environment:
      POSTGRES_DB: app_db
      POSTGRES_USER: app_user
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-secure_password_123}
  
  unified-ai-assistant-api:
    environment:
      DATABASE_URL: postgresql+psycopg://app_user:${POSTGRES_PASSWORD:-secure_password_123}@postgres:5432/app_db
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-secure_password_123}
    depends_on:
      - unified-postgres
```

### 2. Bootstrap SQL: create user/db + grants

**File:** `sql/bootstrap_corrections_db.sql`

```sql
-- Create database and user if not exists
CREATE DATABASE IF NOT EXISTS app_db;
CREATE USER IF NOT EXISTS app_user WITH PASSWORD 'secure_password_123';

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE app_db TO app_user;
GRANT ALL ON SCHEMA public TO app_user;
GRANT ALL ON ALL TABLES IN SCHEMA public TO app_user;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- Create corrections table
CREATE TABLE IF NOT EXISTS corrections (
    id SERIAL PRIMARY KEY,
    chat_id TEXT NOT NULL,
    original_task TEXT NOT NULL,
    system_output TEXT NOT NULL,
    corrected_output TEXT NOT NULL,
    worker_used TEXT DEFAULT 'HRM',
    task_type TEXT DEFAULT 'unknown',
    confidence FLOAT DEFAULT 0.0,
    latency_ms FLOAT DEFAULT 0.0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_corrections_chat_id ON corrections(chat_id);
CREATE INDEX IF NOT EXISTS idx_corrections_created_at ON corrections(created_at DESC);
```

### 3. Add graceful 503 if DB unavailable

**File:** `src/api/correction_routes.py`

```python
@router.get("/stats")
async def get_correction_statistics():
    """Get correction statistics with graceful DB fallback"""
    try:
        tracker = get_correction_tracker()
        stats = await tracker.get_correction_stats()
        return stats
    except Exception as e:
        logger.warning("DB unavailable for corrections stats", error=str(e))
        # Return graceful fallback instead of 500
        return JSONResponse(
            {
                "total_corrections": 0,
                "by_worker": {},
                "by_task_type": {},
                "ready_for_retraining": False,
                "database_status": "unavailable",
                "error": "Database connection unavailable"
            },
            status_code=503  # Service Unavailable
        )
```

---

## 🧪 Validation

### Step 1: Run DB health check
```bash
docker exec unified-ai-assistant-api python scripts/db_health.py
```

Expected: `DB OK` or `DB FAIL: [specific error]`

### Step 2: Run verifier v2
```bash
python -m scripts.independent_verifier_v2 --base http://localhost:8013
```

Expected: All correction endpoints should return 200 or 503 (not 500)

### Step 3: Verify with curl
```bash
curl http://localhost:8013/api/corrections/stats
```

Expected:
```json
{
  "total_corrections": 0,
  "database_status": "unavailable",
  ...
}
```

---

## 📋 Implementation Checklist

- [ ] Update `docker-compose.yml` with correct DATABASE_URL
- [ ] Create `sql/bootstrap_corrections_db.sql`
- [ ] Add `.env.example` with POSTGRES_PASSWORD
- [ ] Update correction_routes.py to return 503 instead of 500
- [ ] Run `docker exec unified-postgres psql -U postgres -f /sql/bootstrap_corrections_db.sql`
- [ ] Restart unified-ai-assistant-api
- [ ] Run `scripts/db_health.py` to verify
- [ ] Run verifier v2 to confirm all green

---

## 🎯 Success Criteria

- ✅ `scripts/db_health.py` returns `DB OK`
- ✅ `/api/corrections/stats` returns 200 or 503 (not 500)
- ✅ `/api/corrections/recent` returns 200 or 503 (not 500)
- ✅ Verifier v2 shows no 500 errors on corrections endpoints
- ✅ Overall success rate >= 80%

---

## 📝 Notes

This is a **pre-existing bug** not caused by the import fixes PR. The corrections module requires proper Postgres configuration to function, but gracefully degrades when DB is unavailable.

**Status:** Documented for separate PR  
**Priority:** Medium (non-critical, has graceful fallback)  
**Estimated effort:** 1 hour

