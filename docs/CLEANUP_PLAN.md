# Universal AI Tools - Root Directory Cleanup Plan

## Overview

The root directory currently contains **279+ files**, with over **150 test-related files**. This cleanup will organize everything into a proper structure.

## Current State

```
Root Directory:
- 37 essential config files (to keep)
- 183 files to move to subdirectories
- 59 log/pid files to delete
- 150+ test-related files scattered everywhere
```

## Cleanup Actions

### 1. Test Files Organization

#### Test Reports → `/docs/test-reports/` (21 files)

- All `*TEST*.md` and `*TESTING*.md` files
- `ACTUAL_TEST_RESULTS.md`
- `MODEL_TESTING_RESULTS.md`
- `REAL_WORLD_TEST_RESULTS.md`
- `USER_ACCEPTANCE_TESTING.md`
- Various test report markdown files

#### Test HTML → `/tests/html/` (22 files)

- `test-*.html`
- `minimal-test.html`
- Various viewer and diagnostic HTML files

#### Test Scripts → `/scripts/testing/` (40+ files)

- `test-*.js`, `test-*.ts`, `test-*.mjs`, `test-*.cjs`
- `test-*.sh`
- `test-*.py`
- `run-*test*.js`

#### Security Tests → `/scripts/security/` (10+ files)

- `security-test*.js`
- `test-security*.js`
- `test-auth*.js`

#### Validation Scripts → `/scripts/validation/` (8+ files)

- `validate-*.js`
- `verify-*.sh`
- `check-*.js`

### 2. Other File Organization

#### Sweet Athena → `/scripts/sweet-athena/` & `/docs/sweet-athena/`

- Scripts: `sweet-athena-*.js`, `sweet-athena-*.mjs`
- Docs: `sweet-athena-*.html`, `sweet-athena-*.txt`, `SWEET_ATHENA_*.md`

#### UE5/Pixel Streaming → `/scripts/ue5/` & `/scripts/pixel-streaming/`

- `ue5-*.py`, `ue5-*.sh`, `ue5-*.mjs`
- `pixel-streaming*.sh`
- `signaling-server*.js`

#### Documentation → `/docs/guides/`

- All `*_GUIDE.md`, `*_REPORT.md` files
- Implementation summaries and documentation

#### Examples → `/examples/`

- `/examples/demos/` - `demo-*.py`
- `/examples/models/` - `test-model*.py`, `manage-models.py`
- `/examples/integrations/` - `integrate-*.py`

### 3. Files to Delete (59 files)

All log and PID files:

- `*.log` - All log files
- `*.pid` - All process ID files
- Old test outputs like `load-test-report.json`

### 4. Files to Archive

Old/duplicate server variations → `/archive/old-tests/`

- `server-debug*.ts`
- `server-test*.js`
- Multiple versions of the same test

## How to Execute

### Option 1: Full Cleanup (Recommended)

```bash
# See what will happen (safe)
npm run organize:dry-run

# Execute the cleanup
npm run organize
```

### Option 2: Quick Test Cleanup

```bash
# Just clean up test files
./scripts/cleanup-test-files.sh
```

### Option 3: Manual Cleanup

```bash
# Delete logs
rm -f *.log *.pid

# Move test reports
mkdir -p docs/test-reports
mv *TEST*.md docs/test-reports/

# Move test scripts
mkdir -p scripts/testing
mv test-*.js test-*.ts scripts/testing/
```

## Expected Result

After cleanup:

```
Root Directory (37 files):
├── Configuration files (.eslintrc, tsconfig, etc.)
├── Package files (package.json, requirements.txt)
├── Docker files (Dockerfile, docker-compose.yml)
├── Essential scripts (install.sh, release.sh)
└── Documentation (README.md, LICENSE, CHANGELOG.md)

Organized Structure:
├── scripts/
│   ├── testing/      (40+ test scripts)
│   ├── security/     (10+ security tests)
│   ├── validation/   (8+ validation scripts)
│   └── ...
├── docs/
│   ├── test-reports/ (21 test reports)
│   ├── guides/       (39 guides)
│   └── ...
├── tests/
│   └── html/         (22 test HTML files)
└── examples/
    ├── demos/        (Python demos)
    └── models/       (Model tests)
```

## Benefits

1. **Cleaner root** - Only essential files remain
2. **Better organization** - Easy to find related files
3. **Improved navigation** - Clear directory structure
4. **Git-friendly** - Less clutter in commits
5. **Professional appearance** - Well-organized codebase

## Next Steps

After cleanup:

1. Update any scripts that reference moved files
2. Add cleanup to regular maintenance routine
3. Update .gitignore to prevent future clutter
4. Consider CI/CD rules to enforce structure
