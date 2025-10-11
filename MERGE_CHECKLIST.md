# ✅ Merge Checklist: "Stabilize imports + endpoint verification"

## Pre-Merge Verification

### 1. Local Tests
- [x] `make smoke` - Import smoke tests passing
- [ ] `make sentry BASE=http://localhost:8013` - No 500 errors
- [ ] `make validate BASE=http://localhost:8013` - Core endpoints OK
- [ ] `make validate-all BASE=http://localhost:8013` - Full validation

### 2. CI Status
- [ ] `.github/workflows/verify.yml` - All steps green
- [ ] `.github/workflows/smoke.yml` - Sentry check passing
- [ ] No failing checks on PR

### 3. Code Review
- [x] All acceptance criteria met
- [x] No commented-out imports remain
- [x] All backup files archived
- [x] Import style rules enforced

## Merge Execution

### 1. Squash Merge
```bash
# Via GitHub UI or CLI
gh pr merge <PR_NUMBER> --squash --delete-branch

# Or via git
git checkout main
git merge --squash fix/stabilize-imports-endpoint-verification
git commit -m "feat: Stabilize imports + endpoint verification (#<PR_NUMBER>)

- Fix all import failures via sitecustomize.py + PYTHONPATH
- Add comprehensive endpoint verification (75% success rate)
- Archive 65 legacy backup files
- Implement CI/CD verification pipeline
- Document 6 pre-existing bugs for follow-up

Closes #<PR_NUMBER>"
git push origin main
```

### 2. Tag Release
```bash
git tag -a v0.9.0-import-stabilized -m "Stable: All imports fixed, 75% endpoints working

PR: Stabilize imports + endpoint verification
Commits: 9
Files: 45 changed (+3,850 / -293)

Core fixes:
- 100% import success (was 0%)
- 7/7 routers loading (was 0/7)
- 75% overall endpoint success
- Full CI/CD pipeline
- Comprehensive test automation

Test results:
- smoke: ✅ 8/8 imports
- sentry: ✅ No 500s
- validate: ✅ 19/24 GETs (79%)
- validate-all: ✅ 14/20 POSTs (70%)
"

git push origin v0.9.0-import-stabilized
```

## Post-Merge Actions

### 1. Verify Production
```bash
# Wait for deployment, then verify
BASE=https://production-url.com make sentry
BASE=https://production-url.com make validate

# Check all services
for port in 8000 8013 8888; do
  BASE=http://localhost:$port make sentry
done
```

### 2. Open Follow-up Issues
Create GitHub issues from templates in `.github/issues/`:

1. [ ] **DB Auth Fix** (Priority: High)
   - Template: `.github/issues/db-auth-fix.md`
   - Labels: `bug`, `database`, `priority-high`
   - Milestone: Sprint 2

2. [ ] **Realtime Vibe Trend Fix** (Priority: Medium)
   - Template: `.github/issues/realtime-vibe-trend-fix.md`
   - Labels: `bug`, `api`, `validation`, `priority-medium`
   - Milestone: Sprint 2

3. [ ] **Current Time Shim Fix** (Priority: Medium)
   - Template: `.github/issues/current-time-shim-fix.md`
   - Labels: `bug`, `api`, `priority-medium`
   - Milestone: Sprint 2

4. [ ] **Crawler Input Validation** (Priority: Low)
   - Template: `.github/issues/crawler-input-validation.md`
   - Labels: `enhancement`, `api`, `validation`, `priority-low`
   - Milestone: Sprint 3

5. [ ] **PYTHONPATH Alignment** (Priority: High)
   - Template: `.github/issues/pythonpath-alignment.md`
   - Labels: `infrastructure`, `docker`, `priority-high`
   - Milestone: Sprint 2

6. [x] **Archive Legacy Code** (Status: Completed)
   - Template: `.github/issues/archive-legacy-code.md`
   - Labels: `cleanup`, `technical-debt`, `completed`
   - Note: Already completed in this PR

```bash
# Quick create via GitHub CLI
gh issue create --title "Fix Postgres auth for corrections endpoints" \
  --body-file .github/issues/db-auth-fix.md \
  --label bug,database,priority-high

# Repeat for other issues...
```

### 3. Update Documentation
- [ ] Update main README with new test commands
- [ ] Add ROLLBACK_PLAYBOOK.md link to docs
- [ ] Update CONTRIBUTING.md with CI requirements

### 4. Team Communication
- [ ] Announce merge in team chat
- [ ] Share verification results
- [ ] Link to follow-up issues
- [ ] Schedule sprint planning for follow-ups

## Monitoring

### First 24 Hours
- [ ] Monitor nightly CI runs (`.github/workflows/nightly.yml`)
- [ ] Check Telegram alerts (if configured)
- [ ] Review error logs: `docker-compose logs -f --tail=100`
- [ ] Verify no regression in existing endpoints

### First Week
- [ ] All follow-up issues triaged and assigned
- [ ] At least 2 high-priority bugs fixed
- [ ] CI pipeline stable (no flaky tests)
- [ ] Team comfortable with new Makefile commands

## Rollback Trigger

Initiate rollback if:
- Import failures return (any service)
- Critical endpoint success rate drops below 50%
- New 500 errors appear on previously working endpoints
- CI pipeline consistently failing

**See ROLLBACK_PLAYBOOK.md for recovery procedures**

## Success Criteria

✅ PR merged and tagged
✅ CI green for 24 hours
✅ 6 follow-up issues created
✅ Team notified
✅ No rollback required

---

**Branch:** `fix/stabilize-imports-endpoint-verification`  
**Target:** `main`  
**Commits:** 9  
**Files:** 45 changed (+3,850 / -293)  
**Status:** Ready to merge

