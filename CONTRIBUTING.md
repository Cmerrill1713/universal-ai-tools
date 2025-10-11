# Contributing to Universal AI Tools

## How to Contribute

We welcome contributions! Here's how to get started:

### 1. Fork & Branch
- Fork the repository
- Create a feature branch: `git checkout -b feature/your-feature-name`
- Use conventional commits: `feat:`, `fix:`, `docs:`, `chore:`

### 2. Development Workflow

```bash
# Run tests locally
make test

# Fix linting
make lint-fix

# Check Docker health
docker compose ps
```

### 3. Requirements

- All tests must pass (`make test`)
- No Ruff linting errors (`ruff check .`)
- No secrets in commits (use `.env.example`)
- Update `.env.sample` if new environment variables are needed

### 4. Pull Request Process

1. Ensure CI passes (tests, linting, security)
2. Update README if adding features
3. Add tests for new functionality
4. Request review from maintainers

### 5. Code Style

- **Python:** Follow PEP 8, use Ruff for linting
- **Swift:** SwiftLint configuration
- **TypeScript:** ESLint + Prettier
- **Go:** `gofmt` + `golangci-lint`

### 6. Security

- Never commit API keys or secrets
- Use environment variables for configuration
- Run security scans before submitting

## Questions?

Open an issue or start a discussion!

