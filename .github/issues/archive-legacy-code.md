---
title: "Quarantine legacy servers and exclude from import path"
labels: ["cleanup", "technical-debt", "completed"]
assignees: []
---

## Status
✅ **COMPLETED** - Included in PR "Stabilize imports + endpoint verification"

## Impact
- Noise in import paths
- Accidental imports from deprecated code
- Confusion about which code is active

## What Was Done

### 1. Moved Legacy Files
```bash
# All backup and legacy files moved to /archive
*.bak → archive/
*_old.py → archive/
*.broken.py → archive/
```

### 2. Created Test Guard
```python
# scripts/test_archive_isolation.py
# Ensures nothing under /archive can be imported
```

### 3. Pre-commit Hook
```yaml
# .pre-commit-config.yaml
- id: test-archive-isolation
  name: Ensure /archive is not importable
  entry: python scripts/test_archive_isolation.py
  language: system
```

### 4. CI Integration
```yaml
# .github/workflows/verify.yml
- name: Run archive isolation test
  run: python scripts/test_archive_isolation.py
```

## Files Archived
- 47 `.bak` files
- 15 `*_old.py` files
- 3 `*.broken.py` files

## Validation
```bash
# Test isolation
python scripts/test_archive_isolation.py

# Expected: ✅ PASS

# Verify pre-commit
pre-commit run test-archive-isolation --all-files

# Expected: Passed
```

## Future Maintenance

### Add New Files to Archive
```bash
# Move single file
git mv old_implementation.py archive/

# Move pattern
git mv $(find . -name "*.deprecated.py") archive/
```

### Check Archive Contents
```bash
# List archived files
find archive/ -type f | wc -l

# Check for accidental imports
rg "^import archive" --type py
rg "^from archive" --type py

# Expected: No matches
```

## References
- PR: "Stabilize imports + endpoint verification"
- Script: `scripts/test_archive_isolation.py`
- Hook: `.pre-commit-config.yaml`
- CI: `.github/workflows/verify.yml`

