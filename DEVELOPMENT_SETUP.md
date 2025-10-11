# Development Setup Guide

This guide helps you set up a clean, consistent development environment with automated code quality tools.

## 🚀 Quick Start

```bash
# 1. Install dependencies and set up development environment
npm run dev:setup

# 2. Install Python quality tools (if not already installed)
pip install black ruff pylint mypy isort

# 3. Install pre-commit for additional checks
pip install pre-commit
pre-commit install

# 4. Run initial code cleanup
npm run clean:all
```

## 📋 Available Quality Commands

### All-in-One Commands

- `npm run clean:all` - Run all formatters and auto-fixers
- `npm run quality:dashboard` - View comprehensive quality metrics
- `npm run quality:strict` - Run all quality checks (no auto-fix)

### TypeScript/JavaScript

- `npm run lint` - Check for linting issues
- `npm run lint:fix` - Auto-fix linting issues
- `npm run format` - Format code with Prettier
- `npm run type-check` - Check TypeScript types
- `npm run fix:all` - Run all TS/JS fixes

### Python

- `npm run py:format` - Format with Black
- `npm run py:lint` - Check with Ruff
- `npm run py:fix` - Auto-fix Python issues
- `npm run py:type` - Type check with MyPy

### Security & Quality

- `npm run security:audit` - Check for vulnerabilities
- `npm run quality:report` - Generate quality report
- `npm run test:fast` - Run quick test suite

## 🪝 Git Hooks

The project uses Husky for Git hooks:

- **pre-commit**: Runs lint-staged on changed files
- **pre-push**: Runs tests and quality checks

To bypass hooks temporarily:

```bash
git commit --no-verify
git push --no-verify
```

## 🛠️ Development Tools

### Configured Tools

1. **ESLint** - JavaScript/TypeScript linting
   - Config: `.eslintrc.json`
   - Strict rules for code quality
   - Security and complexity checks

2. **Prettier** - Code formatting
   - Config: `.prettierrc.json`
   - Consistent formatting across the project

3. **Black** - Python formatting
   - Config: `pyproject.toml`
   - Line length: 100

4. **Ruff** - Fast Python linting
   - Config: `pyproject.toml`
   - Replaces flake8, isort, and more

5. **MyPy** - Python type checking
   - Config: `pyproject.toml`
   - Strict type checking

6. **Pre-commit** - Additional checks
   - Config: `.pre-commit-config.yaml`
   - Runs multiple tools before commit

## 📊 Quality Standards

### TypeScript/JavaScript

- No `any` types
- All functions must have explicit return types
- Max complexity: 10
- Max function length: 50 lines
- Unused imports/variables not allowed

### Python

- Black formatting required
- Type hints required
- Max line length: 100
- No bare except blocks

### General

- No hardcoded secrets
- No console.log in production code
- All tests must pass
- Security vulnerabilities must be fixed

## 🔧 Troubleshooting

### ESLint errors won't go away

```bash
# Clear ESLint cache
rm -rf .eslintcache
npm run lint:fix
```

### Python tools not working

```bash
# Ensure tools are installed
pip install -r requirements-dev.txt
```

### Pre-commit failing

```bash
# Update pre-commit hooks
pre-commit autoupdate
pre-commit run --all-files
```

## 📈 Continuous Improvement

1. Run quality dashboard regularly:

   ```bash
   npm run quality:dashboard
   ```

2. Before committing:

   ```bash
   npm run clean:all
   ```

3. Before major PRs:
   ```bash
   npm run quality:strict
   npm run test:coverage
   ```

## 🎯 IDE Setup

### VS Code

Install these extensions:

- ESLint
- Prettier
- Python (includes Pylance)
- GitLens
- Error Lens

### Settings

Add to `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true,
    "source.organizeImports": true
  },
  "python.linting.enabled": true,
  "python.formatting.provider": "black"
}
```

## 📝 Contributing

1. Always run `npm run clean:all` before committing
2. Fix all quality issues before pushing
3. Keep quality dashboard metrics green
4. Add tests for new features
5. Update documentation as needed
