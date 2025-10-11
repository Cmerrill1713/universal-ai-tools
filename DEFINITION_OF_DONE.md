# ✅ Definition of Done: "Boringly Green"

**Status:** Production-ready stability criteria  
**Owner:** Platform Team  
**Updated:** 2025-10-11

---

## 🎯 One-Liner Check

Run this anytime, anywhere:

```bash
make green BASE=http://localhost:8013
```

If it passes, you're good. If it fails, it fails loud and tells you why.

**Equivalent to:**
```bash
make sentry && make validate && make validate-all && make contract
```

---

## 📊 Success Criteria

### 1. GET Endpoints: ≥90% Success Rate
```bash
make validate BASE=http://localhost:8013
```

**Acceptable responses:**
- `200-299` (Success)
- `300-399` (Redirect)
- `404` (Not Found - expected for optional endpoints)

**Not acceptable:**
- `500-599` (Server errors)

**Formula:** `(2xx + 3xx) / total_gets >= 0.90`

---

### 2. POST Endpoints: 2xx or 422 (No 500s)
```bash
make validate-all BASE=http://localhost:8013
```

**Acceptable responses:**
- `200-299` (Success)
- `422` (Validation error - expected for schema violations)

**Not acceptable:**
- `500-599` (Server errors)

**Rule:** POST probes should fail gracefully with 422, never crash with 500

---

### 3. DB-Backed Routes: 503 When DB Down (Never 500)
```bash
# Simulate DB down
docker-compose stop postgres

# Test corrections endpoints
curl -i http://localhost:8013/api/corrections/stats
curl -i http://localhost:8013/api/corrections/recent

# Expected: HTTP/1.1 503 Service Unavailable
# Body: {"database_status": "unavailable", ...}

# Restart DB
docker-compose start postgres
```

**Rule:** Database unavailable = 503 (temporary), not 500 (bug)

---

### 4. Critical Pages: Zero 500s
```bash
make sentry BASE=http://localhost:8013
```

**Critical pages:**
- `/openapi.json` - API spec
- `/health` - Service health
- `/api/unified-chat/health` - Chat service health

**Rule:** These must ALWAYS return 2xx/3xx, with 3 retries and backoff for startup blips

---

### 5. Nightly Matrix: All Bases Green
```bash
# Runs automatically via GitHub Actions at 04:00 UTC
# Manual trigger:
for port in 8000 8013 8888; do
  BASE=http://localhost:$port make green
done
```

**Rule:** All 3 services (ports 8000, 8013, 8888) must pass for 7 consecutive nights

---

### 6. Contract Tests: /chat Shape Validated
```bash
make contract BASE=http://localhost:8013
```

**Required fields:**
- `id` (string) - Request/response ID
- `message` or `content` or `response` (string) - Chat response

**Optional but recommended:**
- `tokens` (number) - Token count
- `latency` (number) - Response time in ms
- `model` (string) - Model used

**Rule:** Response shape must not break on refactors

---

## 🚨 Red Flags (Immediate Action Required)

| Symptom | Root Cause | Fix |
|---------|------------|-----|
| 500 on `/api/corrections/*` | DB auth failure | Apply patch 01: Postgres 503 graceful fallback |
| 500 on `/technologies` | KeyError: 'trend' | Apply patch 02: Trend key default validation |
| 500 on `/market-analysis` | AttributeError: _get_current_time | Apply patch 03: Current time shim |
| 500 on `/crawler/crawl-urls` | Bad input | Apply patch 04: Crawler input validation |
| Flapping CI | Startup blips | Already fixed: error_sentry.py has retry backoff |
| Broken /chat contract | Schema change | Review contract_chat.py, update schema |

---

## 📋 Pre-Deployment Checklist

Before deploying to production:

- [ ] `make smoke` passes (import tests)
- [ ] `make sentry` passes (no 500s on critical pages)
- [ ] `make validate` passes (≥90% GET success)
- [ ] `make validate-all` passes (POST endpoints graceful)
- [ ] `make contract` passes (/chat shape valid)
- [ ] **FULL:** `make green` passes (all of the above)
- [ ] Database connectivity verified (`python scripts/db_health.py`)
- [ ] Archive isolation confirmed (`python scripts/test_archive_isolation.py`)
- [ ] No new linter errors (`make lint` if available)
- [ ] Docker compose up without errors
- [ ] Nightly CI green for past 3 nights

---

## 🔄 Continuous Monitoring

### Daily (Automated)
- GitHub Actions: `.github/workflows/nightly.yml` (04:00 UTC)
- Matrix test: All 3 services × All test suites
- Alert on: Any failure after 2 consecutive nights

### Per-Commit (Automated)
- GitHub Actions: `.github/workflows/smoke.yml` and `.github/workflows/verify.yml`
- Quick smoke test + full verification
- Alert on: Any red check

### On-Demand (Manual)
```bash
# Quick health check
make sentry BASE=http://localhost:8013

# Full validation
make green BASE=http://localhost:8013

# Multi-service check
for port in 8000 8013 8888; do
  echo "Testing port $port..."
  BASE=http://localhost:$port make sentry
done
```

---

## 🎓 Philosophy

**Boring is good.** Green is the new exciting.

| Old Way | New Way |
|---------|---------|
| Let it crash (500) | Fail gracefully (503/422/200) |
| Undefined = error | Undefined = default |
| DB down = 500 | DB down = 503 |
| Bad input = 500 | Bad input = 422 |
| No retry = flappy CI | 3 retries = stable CI |
| Manual checks = forgot | `make green` = always |

---

## 📈 Metrics Over Time

Track these weekly:

| Week | GET Success | POST Success | 500 Count | Nightly Pass Rate |
|------|-------------|--------------|-----------|-------------------|
| W1 (Baseline) | 79% | 70% | 8 | 43% (3/7 nights) |
| W2 (After main PR) | 79% | 70% | 8 | 86% (6/7 nights) |
| W3 (After surgical) | 83% | 85% | 4 | 100% (7/7 nights) |
| W4 (Target) | ≥90% | ≥85% | 0 | 100% (7/7 nights) |

**Goal:** Maintain ≥90% GET, ≥85% POST, 0 critical 500s, 100% nightly pass for 4 consecutive weeks

---

## 🛡️ Rollback Trigger

Initiate rollback if:

1. `make green` fails on any service
2. Critical 500s appear on previously working endpoints
3. Nightly CI fails 3 consecutive nights
4. GET success rate drops below 70%
5. Contract tests break (shape changed unexpectedly)

**See:** `ROLLBACK_PLAYBOOK.md` for detailed procedures

---

## 🎉 When You Know You're Done

You'll know you're done when:

1. **`make green` is boring** - It passes. Every time. No surprises.
2. **CI is silent** - Green checks, no alerts, no drama.
3. **Errors are meaningful** - 503 means "DB down", 422 means "fix your input", 500 is extinct.
4. **Team trusts the build** - No one asks "Is it safe to merge?"
5. **Monitoring is quiet** - No 500s in logs, no pages at 3am.

**That's boring. That's green. That's done.** 🟢

---

## 🚀 Commands Reference

```bash
# Quick checks
make sentry                  # No 500s on critical pages
make smoke                   # Import + endpoint smoke tests
make contract                # /chat shape validation

# Comprehensive validation
make validate                # GET-only (safe)
make validate-all            # GET + POST (comprehensive)

# Full suite
make green                   # All checks (the one-liner)
make test                    # Smoke + sentry + validate + validate-all

# Multi-service
for port in 8000 8013 8888; do
  BASE=http://localhost:$port make green
done

# With Telegram alerts
make notify BASE=http://localhost:8013
```

---

**Last updated:** 2025-10-11  
**Next review:** After 4 consecutive green weeks  
**Status:** 🟢 Active

