# Universal AI Tools - Quick Start Guide
**⚠️ IMPORTANT**: This codebase has syntax errors that must be fixed before running. This guide reflects the actual current state.
**Version**: 1.0.0  

**Status**: Development - Contains syntax errors  

**Setup Time**: ~30 minutes (including fixes)  

**Prerequisites**: Node.js v18+, PostgreSQL, Redis (optional), Python 3.8+
---
## 🚨 Current State
The codebase contains widespread syntax errors that prevent it from running:

- `_error 'message'` should be `error: 'message'`

- `_errorinstanceof` should be `error instanceof`

- Duplicate constant imports
**You must fix these errors before the application will start.**
---
## 🛠️ Actual Setup Process
### 1. Clone and Install

```bash
# Clone repository

git clone https://github.com/Cmerrill1713/universal-ai-tools.git

cd universal-ai-tools

# Install dependencies

npm install

# Install UI dependencies

cd ui && npm install && cd ..

```
### 2. Fix Syntax Errors (REQUIRED)

```bash
# Run autofix scripts

npm run autofix

npm run fix:all

# Check for remaining errors

npm run lint

# Manual fixes needed for:
# - Search for "_error" and replace with "error:"
# - Search for "_errorinstanceof" and replace with "error instanceof"

```
### 3. Environment Setup

```bash
# Copy example environment

cp .env.example .env

```
Edit `.env` with actual values:

```bash
# Required

NODE_ENV=development

PORT=8080

DATABASE_URL=postgresql://user:password@localhost:5432/universal_ai_tools

SUPABASE_URL=your-supabase-url

SUPABASE_ANON_KEY=your-anon-key

SUPABASE_SERVICE_KEY=your-service-key

JWT_SECRET=your-jwt-secret

ENCRYPTION_KEY=your-encryption-key

# Optional (has fallbacks)

REDIS_URL=redis://localhost:6379

OPENAI_API_KEY=your-openai-key

ANTHROPIC_API_KEY=your-anthropic-key

OLLAMA_URL=http://localhost:11434

```
### 4. Database Setup

```bash
# Run migrations (40+ migration files with conflicts)

npm run migrate

# If migrations fail, check:
# - supabase/migrations/ has duplicate file numbers
# - Tables may have conflicts (ai_memories vs memories)

```
### 5. Start Services

```bash
# Start Ollama (for cognitive agents)

ollama serve

# Start Redis (optional - will fallback to in-memory)

redis-server

# Start DSPy orchestrator

cd src/services/dspy-orchestrator

python server.py

# Start development server

npm run dev

```
---
## ✅ Verification
### Check Server Status

```bash
# Basic health check

curl http://localhost:8080/health

# API health (requires authentication)

curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \

     http://localhost:8080/api/v1/health

```
### Common Issues
1. **Parsing Errors**: The codebase has syntax errors in multiple files

2. **Missing Services**: Redis will fallback to in-memory if not running

3. **Database Errors**: Migration conflicts may require manual intervention

4. **Authentication**: No default API keys - must generate JWT tokens
---
## 📁 Key Directories
```

src/

├── agents/          # All real implementations (not mocked)

│   ├── cognitive/   # 13 agents using Ollama LLM

│   ├── personal/    # 8 personal assistant agents

│   └── evolved/     # Self-improving agents

├── services/        # 80+ services

├── middleware/      # Has syntax errors

└── routers/         # 23+ API endpoints

```
---
## 🔧 Available Scripts
```bash
# Development

npm run dev              # Start with hot reload

npm start               # Run start.sh script

# Fixes

npm run autofix         # Auto-fix TypeScript

npm run fix:all         # Run all fixes

npm run lint:fix        # ESLint fixes

# Testing

npm test                # Run tests

npm run test:unit       # Unit tests only

# Database

npm run migrate         # Run migrations

npm run migrate:status  # Check status

```
---
## 📝 Notes
1. **Not Production Ready**: Syntax errors throughout codebase

2. **All Agents Real**: No mocks, but require Ollama running

3. **Graceful Fallbacks**: Redis → memory, but core syntax errors remain

4. **Active Development**: Many incomplete features
For detailed architecture and fixes needed, see [CLAUDE.md](../../CLAUDE.md).