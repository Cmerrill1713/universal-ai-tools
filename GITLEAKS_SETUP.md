# Gitleaks Security Automation Setup

## Overview

Gitleaks has been fully automated in this project to prevent secrets from being committed to the repository. The setup includes:

- ✅ **Pre-commit hooks** - Automatic scanning before every commit
- ✅ **GitHub Actions** - CI/CD pipeline integration
- ✅ **NPM scripts** - Easy command-line access
- ✅ **Auto-fix tools** - Interactive secret remediation
- ✅ **Baseline management** - Track known false positives

## Quick Commands

```bash
# Manual scan
npm run security:scan

# Scan all files (including git-ignored)
npm run security:scan:all

# Auto-fix detected secrets
npm run security:fix

# Update baseline
npm run security:baseline:update

# Check security (fails if secrets found)
npm run security:check
```

## Automated Features

### 1. Pre-commit Hook
- Automatically scans staged files before commit
- Blocks commits containing secrets
- Provides helpful remediation tips
- Can be bypassed with `git commit --no-verify` (use cautiously)

### 2. GitHub Actions
- **Push/PR Scanning**: Runs on all pushes and pull requests
- **Daily Scans**: Scheduled scan at 2 AM UTC
- **PR Comments**: Automatic comments on PRs with detected secrets
- **Artifact Storage**: Scan results saved for 30 days
- **Security Summary**: Job summary with scan results

### 3. CI Pipeline Integration
- Added as first step in CI pipeline
- Blocks other jobs if secrets detected
- Uploads results as artifacts
- Integrated with existing workflows

### 4. Auto-fix Script
Interactive tool to fix detected secrets:
- Move secrets to environment variables
- Replace with placeholders
- Add false positives to ignore list
- Automatic .env.example updates

### 5. Baseline Management
Track known false positives:
- `npm run security:baseline:update` - Update baseline
- `npm run security:baseline:commit` - Update and commit
- `npm run security:baseline:push` - Update, commit, and push

## Configuration

### .gitleaks.toml
Custom configuration includes:
- AI/ML specific rules (OpenAI, HuggingFace keys)
- Allowlists for common patterns
- Path exclusions for build artifacts
- Custom entropy thresholds

### Ignored Files
The following are automatically ignored:
- `.env` files (except examples)
- `node_modules/`
- Build directories (`dist/`, `build/`)
- Test files
- Documentation

## Best Practices

1. **Never commit real secrets** - Use environment variables
2. **Update .env.example** - Include placeholder values
3. **Review scan results** - Don't blindly ignore findings
4. **Keep baseline updated** - Remove outdated entries
5. **Use auto-fix tool** - Faster remediation

## Troubleshooting

### False Positives
1. Update `.gitleaks.toml` with specific exclusions
2. Add to baseline if it's a known safe pattern
3. Use the auto-fix tool's ignore option

### Timeout Issues
If scans timeout on large repos:
```bash
# Scan specific directory
gitleaks detect --config .gitleaks.toml --path src/

# Use baseline to skip known issues
npm run security:baseline
```

### Emergency Bypass
If you need to commit urgently:
```bash
# Bypass pre-commit hook (use carefully!)
git commit --no-verify -m "Emergency fix"

# Remember to fix any secrets later
npm run security:fix
```

## Maintenance

### Weekly Tasks
- Review new findings: `npm run security:scan`
- Update baseline: `npm run security:baseline:update`

### Monthly Tasks
- Clean up old baseline entries
- Review and update rules in `.gitleaks.toml`
- Check GitHub Actions logs for patterns

## Support

For issues or questions:
1. Check scan output for specific guidance
2. Run `npm run security:fix` for interactive help
3. Review `.gitleaks.toml` for configuration options
4. Check GitHub Actions logs for CI issues