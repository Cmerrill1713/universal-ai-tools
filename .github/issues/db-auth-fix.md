---
title: "Fix Postgres auth for corrections endpoints"
labels: ["bug", "database", "priority-high"]
assignees: []
---

## Impact
- `/api/corrections/stats` → 500
- `/api/corrections/recent` → 500
- `/api/corrections/trigger-retraining` → 500

## Root Cause
DATABASE_URL mismatch or missing database grants for `app_user`

## Current Behavior
```python
psycopg.OperationalError: connection failed: FATAL:  password authentication failed for user "app_user"
```

## Expected Behavior
- Graceful 503 response when DB unavailable
- Successful connection when credentials are correct
- Clear error messages for debugging

## Fix Steps

### 1. Verify DATABASE_URL format
```bash
# Should be:
DATABASE_URL=postgresql+psycopg://app_user:${POSTGRES_PASSWORD}@postgres:5432/app_db
```

### 2. Bootstrap SQL (init script)
```sql
-- Create user and database
CREATE USER app_user WITH PASSWORD '${POSTGRES_PASSWORD}';
CREATE DATABASE app_db OWNER app_user;

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON DATABASE app_db TO app_user;
\c app_db
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO app_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO app_user;
```

### 3. Add graceful error handling
```python
# In src/api/correction_routes.py
try:
    # ... database operations ...
except psycopg.OperationalError as e:
    raise HTTPException(status_code=503, detail=f"Database unavailable: {e}")
except Exception as e:
    raise HTTPException(status_code=500, detail=str(e))
```

## Validation
```bash
# Test database connectivity
python scripts/db_health.py

# Test endpoints
python -m scripts.independent_verifier_v2 --base http://localhost:8000

# Expected: 200 or 503 (not 500)
```

## References
- See `issues/POSTGRES_AUTH_FIX.md` for comprehensive guide
- Related: `scripts/db_health.py`
- Docker Compose: `docker-compose.yml` postgres service

