# Self-Hosted Production Guide (Private/Enterprise)

## Environment
- SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY (no test keys)
- DATABASE_URL (Postgres 15+)
- REDIS_URL (Redis 7)
- FRONTEND_URL / PRODUCTION_URL (for CORS)
- ENABLE_CONTEXT=false (enable selectively)
- ENABLE_PERF_LOGS=false (enable for debugging only)

## Run (Docker Compose)
```bash
docker compose up -d --build
```

Health checks:
- App: http://localhost:9999/health
- Metrics: http://localhost:9999/metrics

## Database
- RLS: `public.ai_memories` enabled + FORCE RLS
- View: `public.memories` SECURITY BARRIER, read-only grants
- Functions: `ai_*` and `search_context_storage_by_embedding` are SECURITY INVOKER; EXECUTE only for `postgres`/`service_role`
- Backups: schedule logical dumps and verify restore

## Observability
- OTEL traces/metrics/logs to your collector (Prometheus/Grafana recommended)
- Alerts for uptime, error rate, queue lag, DB latency

## Security
- No dev keys or PUBLIC EXECUTE on functions
- CORS restricted to `FRONTEND_URL`/`PRODUCTION_URL`
- Error responses sanitized; input validation on all public routes

## Testing
- CI runs typecheck/lint/unit and DB integration tests with Postgres service
- Target ≥80% coverage before enabling new features

## Rollout
- Canary or blue/green; feature flags for risky paths
- Graceful shutdown, backpressure, DLQs

## Runbooks
- Secrets rotation SOP
- Backup/restore SOP
- Incident response & escalation
