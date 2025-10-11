# Universal AI Tools Documentation

Welcome to the Universal AI Tools documentation! This directory contains all the documentation you need to understand, use, and contribute to the project.

## 📚 Documentation Index

### Getting Started
- **[Quick Start Guide](../QUICK_START.md)** - Get up and running in 5 minutes
- **[Command Reference](COMMANDS.md)** - Complete list of all CLI commands
- **[Quick Reference Card](QUICK_REFERENCE.md)** - Essential commands cheat sheet

### API Documentation
- **[API Reference](API.md)** - Complete API endpoint documentation
- **[API Versioning Guide](API_VERSIONING.md)** - How API versioning works
- **[Authentication Guide](AUTHENTICATION.md)** - API authentication details

### Architecture & Design
- **[Architecture Overview](ARCHITECTURE.md)** - System design and components
- **[Database Schema](DATABASE.md)** - Database tables and relationships
- **[Security Guide](SECURITY.md)** - Security features and best practices

### Development
- **[Development Guide](DEVELOPMENT.md)** - Development setup and workflow
- **[Testing Guide](TESTING.md)** - How to write and run tests
- **[Migration Guide](MIGRATIONS.md)** - Database migration documentation
- **[Contributing Guide](CONTRIBUTING.md)** - How to contribute to the project

### Features & Integrations
- **[Supabase Integration](SUPABASE.md)** - Supabase features and setup
- **[Memory System](MEMORY_SYSTEM.md)** - Advanced memory management
- **[LLM Integration](LLM_INTEGRATION.md)** - Multi-model LLM support
- **[Agent System](AGENTS.md)** - Cognitive agent architecture

### Operations
- **[Deployment Guide](DEPLOYMENT.md)** - Production deployment instructions
- **[Monitoring Guide](MONITORING.md)** - Health checks and metrics
- **[Performance Guide](PERFORMANCE.md)** - Performance optimization
- **[Troubleshooting](TROUBLESHOOTING.md)** - Common issues and solutions

## 🔍 Finding Information

### By Task

**"I want to..."**
- **Start development** → [Quick Start Guide](../QUICK_START.md)
- **Run a command** → [Command Reference](COMMANDS.md)
- **Call an API** → [API Reference](API.md)
- **Add a feature** → [Development Guide](DEVELOPMENT.md)
- **Fix a bug** → [Troubleshooting](TROUBLESHOOTING.md)
- **Deploy to production** → [Deployment Guide](DEPLOYMENT.md)

### By Topic

**Database & Storage**
- Database operations → [Migration Guide](MIGRATIONS.md)
- Supabase features → [Supabase Integration](SUPABASE.md)
- Memory management → [Memory System](MEMORY_SYSTEM.md)

**API & Integration**
- REST endpoints → [API Reference](API.md)
- Authentication → [Authentication Guide](AUTHENTICATION.md)
- API versioning → [API Versioning Guide](API_VERSIONING.md)

**Development & Testing**
- Development setup → [Development Guide](DEVELOPMENT.md)
- Running tests → [Testing Guide](TESTING.md)
- Code standards → [Contributing Guide](CONTRIBUTING.md)

**Operations & Monitoring**
- Health checks → [Monitoring Guide](MONITORING.md)
- Performance → [Performance Guide](PERFORMANCE.md)
- Security → [Security Guide](SECURITY.md)

## 📝 Documentation Standards

When contributing documentation:

1. **Use clear headings** - Make content scannable
2. **Include examples** - Show, don't just tell
3. **Add code blocks** - Format code properly
4. **Update the index** - Add new docs to this README
5. **Cross-reference** - Link to related documentation

## 🚀 Quick Links

### Most Used Commands
```bash
npm run dev              # Start development
npm run migrate         # Run database migrations
npm test               # Run tests
npm run lint:fix       # Fix linting issues
npm run scrape:supabase # Update Supabase docs
```

### Key API Endpoints
- `GET /health` - Service health check
- `GET /api/docs` - API documentation
- `POST /api/v1/memory` - Store memory
- `POST /api/v1/assistant/chat` - Chat with AI

### Important Files
- `.env.example` - Environment variables template
- `package.json` - All available scripts
- `src/server.ts` - Main server file
- `supabase/migrations/` - Database migrations

## 💡 Tips for Using Documentation

1. **Start with Quick Start** if you're new to the project
2. **Use Command Reference** to find the right command quickly
3. **Check API Reference** for endpoint details and examples
4. **Read Architecture Overview** to understand the system
5. **Consult Troubleshooting** when something goes wrong

## 🤝 Contributing to Documentation

Found an error or want to improve the docs?

1. **Fix typos** - Direct PR for small fixes
2. **Add examples** - More examples always help
3. **Create guides** - Write tutorials for common tasks
4. **Update commands** - Keep command reference current
5. **Improve clarity** - Make complex topics simple

See [Contributing Guide](CONTRIBUTING.md) for details.

---

**Need help?** Can't find what you're looking for? Open an issue or ask in discussions!