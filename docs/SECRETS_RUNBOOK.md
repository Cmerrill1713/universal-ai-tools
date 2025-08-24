# Secrets Management Runbook

Scope: Self-hosted, private enterprise deployment using Supabase Vault (preferred) or platform secret store.

## Principles
- No secrets in code, images, or repo
- Vault is source of truth; env-only for local dev
- Rotate regularly; audit all access; least privilege

## Required Secrets
- SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY
- DATABASE_URL
- REDIS_URL
- JWT_SECRET
- Provider keys (e.g., OPENAI_API_KEY, HUGGINGFACE_API_KEY) as needed

## Rotation Procedure
1. Create new secret in Vault with version-tag (e.g., `openai_api_key@2025-08-10`)
2. Update app to reference logical name (e.g., `openai_api_key`) – Vault resolves latest
3. Trigger rolling restart of services
4. Verify health and error rates
5. Deactivate old version after verification window

## Emergency Rotation (Compromise)
1. Revoke old key immediately at provider
2. Create new key in Vault
3. Restart app pods/containers
4. Search logs for leakage; notify stakeholders

## Auditing
- Enable Vault access logs
- Review monthly: access by role, frequency, anomalies

## CI/CD
- Use platform secret store for CI jobs (no secrets in repo)
- Separate test creds from prod creds; fail “prod-check” job if required secrets absent

## Local Development
- `.env` allowed only locally; never commit
- Shim functions permitted only in dev; disabled in production by validation
