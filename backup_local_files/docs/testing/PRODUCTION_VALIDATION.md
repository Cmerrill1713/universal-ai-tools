# Production Validation Scripts
This document describes the validation scripts available in the Universal AI Tools project to ensure production readiness.
## Overview
The validation scripts help identify and fix common issues before deploying to production:

- Mock implementations that should be removed

- Disabled or commented code

- Hardcoded development keys

- TODO/FIXME comments

- Migration conflicts

- Security vulnerabilities
## Available Scripts
### Check Scripts
Run individual checks to identify specific issues:
```bash
# Find all mock implementations

npm run check:mocks

# Find disabled/commented code

npm run check:disabled

# Find hardcoded development keys

npm run check:dev-keys

# Find all TODO/FIXME comments

npm run check:todos

# Analyze migration conflicts

npm run check:migrations

# Run security vulnerability checks

npm run check:security

# Run all checks in sequence

npm run check:all

```
### Validation Scripts
Comprehensive validation for different scenarios:
```bash
# Full production readiness check

npm run validate:production

# Ensure no mocks in production code

npm run validate:no-mocks

# Security-focused validation

npm run validate:security

```
### Fix Scripts
Get guidance on fixing common issues:
```bash
# Guide for fixing infrastructure issues

npm run fix:infrastructure

# Guide for security fixes

npm run fix:security

# Migration consolidation helper

npm run fix:migrations

```
### Context Scripts
Generate context for AI assistants or team members:
```bash
# Generate comprehensive Claude context

npm run claude:context

# Quick system status summary

npm run claude:summary

```
### Pre-deployment Scripts
Run before deploying to ensure everything is ready:
```bash
# Run all validations before deployment

npm run pre-deploy

# Fast validation for CI/CD

npm run pre-deploy:quick

```
## Understanding the Output
### Check Scripts Output
When running check scripts, you'll see:

- 🔍 Blue text: Current check being performed

- ❌ Red text: Critical issues that must be fixed

- ⚠️ Yellow text: Warnings that should be reviewed

- ✅ Green text: Checks that passed
Example output:

```

🔍 Checking for mock implementations...

❌ Found 15 mock references in 5 files

  - src/tests/unit/service.test.ts

  - src/services/mock-service.ts

  ... and 3 more files

```
### Fix Guide Output
Fix guides provide step-by-step instructions:

```

Infrastructure Issues Fix Guide
1. Port conflicts

   Check and kill processes using required ports:

   - lsof -i :3000 (frontend)

   - lsof -i :8080 (backend)

   - kill -9 <PID>

```
## Common Issues and Solutions
### Mock Implementations

- **Issue**: Test mocks left in production code

- **Solution**: Move mocks to test files only

- **Check**: `npm run check:mocks`
### Hardcoded Keys

- **Issue**: Development URLs, passwords, or API keys in code

- **Solution**: Use environment variables

- **Check**: `npm run check:dev-keys`
### Migration Conflicts

- **Issue**: Multiple migrations with same timestamp

- **Solution**: Rename with unique timestamps

- **Check**: `npm run check:migrations`
### Security Vulnerabilities

- **Issue**: npm audit warnings

- **Solution**: Run `npm audit fix`

- **Check**: `npm run check:security`
## CI/CD Integration
Add to your CI/CD pipeline:
```yaml
# GitHub Actions example

- name: Validate Production Readiness

  run: npm run pre-deploy:quick

# Or for full validation

- name: Full Production Validation

  run: npm run pre-deploy

```
## Custom Validation
To add custom validation checks:
1. Edit `scripts/production-validation.js`

2. Add a new check method

3. Update the `runAllChecks()` method

4. Add corresponding npm script in `package.json`
Example:

```javascript

async checkCustomRule() {

  console.log(chalk.blue('\n🔍 Checking custom rule...'));

  // Your validation logic here

}

```
## Best Practices
1. Run `npm run check:all` before every commit

2. Use `npm run pre-deploy` before production deployments

3. Fix all critical issues (red) before deploying

4. Review warnings (yellow) and fix if possible

5. Keep TODO count low by addressing them regularly

6. Run security checks weekly
## Troubleshooting
### Scripts not working on Windows

Use Node.js directly: `node scripts/production-validation.js all`
### Permission denied errors

Make scripts executable: `chmod +x scripts/*.js`
### Missing dependencies

Install required packages: `npm install`