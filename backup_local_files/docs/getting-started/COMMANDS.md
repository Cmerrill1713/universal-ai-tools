# Universal AI Tools - Command Reference
This document contains all available commands for the Universal AI Tools project.
## Table of Contents

- [Development Commands](#development-commands)

- [Build Commands](#build-commands)

- [Testing Commands](#testing-commands)

- [Database Migration Commands](#database-migration-commands)

- [Documentation Commands](#documentation-commands)

- [Monitoring Commands](#monitoring-commands)

- [Demo Commands](#demo-commands)

- [Utility Commands](#utility-commands)
## Development Commands
### Start Development Servers

```bash
# Start backend development server with hot reload

npm run dev

# Start backend only

npm run dev:backend

# Start frontend only

npm run dev:frontend

# Start full demo (Sweet Athena)

npm run demo:sweet-athena

```
### Initial Setup

```bash
# Run initial setup script

npm run setup

# Install dependencies

npm install

# Prepare git hooks

npm run prepare

```
## Build Commands
### Production Builds

```bash
# Build for production (webpack)

npm run build

# Build with production config

npm run build:prod

# Build with TypeScript compiler

npm run build:tsc

# Build for development

npm run build:dev

```
### Build Analysis

```bash
# Analyze bundle size

npm run build:analyze

# Analyze production bundle

npm run build:analyze:prod

```
### Start Production Server

```bash
# Start production server

npm start

# Start with NODE_ENV=production

npm run start:prod

```
## Testing Commands
### Run Tests

```bash
# Run all tests

npm test

# Run tests in watch mode

npm run test:watch

# Run tests with coverage

npm run test:coverage

# Run unit tests only

npm run test:unit

# Run integration tests only

npm run test:integration

# Run simple test

npm run test:simple

# Run fast tests (exclude e2e and browser)

npm run test:fast

# Run full system test

npm run test:full-system

```
### Specific Test Suites

```bash
# Test local LLM functionality

npm run test:local-llm

# Test Metal optimization

npm run test:metal

# Test browser functionality

npm run test:browser

# Test browser headless

npm run test:browser:headless

# Test browser fast mode

npm run test:browser:fast

# Test hot reload

npm run test:hot-reload

# Test agent pool

npm run test:agents

# Test UI validation

npm run test:ui-validation

# Test performance

npm run test:performance

# Test self-healing

npm run test:self-healing

```
### Monitoring Tests

```bash
# Monitor hot reload (non-headless)

npm run monitor:hot-reload

# Monitor performance

npm run monitor:performance

```
## Database Migration Commands
### Migration Management

```bash
# Run pending migrations

npm run migrate

# Check migration status

npm run migrate:status

# Run migrations up

npm run migrate:up

# Rollback migrations

npm run migrate:down

# Create new migration

npm run migrate:create <migration-name>

# Validate migrations

npm run migrate:validate

```
### Example Migration Commands

```bash
# Create a new migration

npm run migrate:create add_user_preferences

# Check current migration status

npm run migrate:status

# Run all pending migrations

npm run migrate

# Rollback last migration

npm run migrate:down

```
## Documentation Commands
### Scrape Documentation

```bash
# Scrape Supabase documentation and store in database

npm run scrape:supabase

# Dry run - show what would be scraped without storing

npm run scrape:supabase:dry

```
## Backup and Recovery Commands
### Backup Management

```bash
# Show backup CLI help

npm run backup

# Create a new backup

npm run backup:create

npm run backup:create -- --type full --tables ai_memories,ai_agents

npm run backup:create -- --no-compress --no-encrypt

# List available backups

npm run backup:list

npm run backup:list -- --limit 20 --status completed

# Restore from backup

npm run backup:restore <backup-id>

npm run backup:restore <backup-id> -- --dry-run

npm run backup:restore <backup-id> -- --tables ai_memories

# Get backup system status

npm run backup:status

# Clean up old backups

npm run backup:cleanup

```
### Advanced Backup Operations

```bash
# Verify backup integrity

npm run backup verify <backup-id>

# Delete specific backup

npm run backup delete <backup-id>

# Schedule backup

npm run backup schedule --list

npm run backup schedule --create daily --schedule "0 2 * * *" --type full

# Estimate backup size

curl -X POST http://localhost:3456/api/v1/backup/estimate \

  -H "X-API-Key: your-key" \

  -H "X-AI-Service: your-service" \

  -H "Content-Type: application/json" \

  -d '{"tables": ["ai_memories", "ai_agents"]}'

```
## Code Quality Commands
### Linting and Formatting

```bash
# Run ESLint

npm run lint

# Run ESLint with auto-fix

npm run lint:fix

# Format code with Prettier

npm run format

# Type check with TypeScript

npm run type-check

```
### Fix TypeScript Issues

```bash
# Analyze and fix TypeScript errors

npm run fix:typescript

```
## Monitoring Commands
### Performance Monitoring

```bash
# Monitor performance metrics

npm run perf:monitor

# Generate performance report

npm run perf:report

```
## Demo Commands
### Run Demos

```bash
# Run local LLM TypeScript fixer demo

npm run demo:local-llm

# Run intelligent extractor demo

npm run demo:intelligent-extractor

# Run Sweet Athena full demo

npm run demo:sweet-athena

```
## API Endpoints Reference
### Health Check

```bash
# Basic health check

curl http://localhost:3456/health

# Detailed health check

curl http://localhost:3456/api/health/detailed

# Readiness probe

curl http://localhost:3456/api/health/ready

# Liveness probe

curl http://localhost:3456/api/health/live

```
### API Documentation

```bash
# Get API documentation

curl http://localhost:3456/api/docs

# Get API versions

curl http://localhost:3456/api/versions

```
## Environment Setup
### Required Environment Variables

```bash
# Create .env file

cp .env.example .env

# Edit with your values

SUPABASE_URL=your_supabase_url

SUPABASE_ANON_KEY=your_anon_key

SUPABASE_SERVICE_KEY=your_service_key

JWT_SECRET=your_jwt_secret

OPENAI_API_KEY=your_openai_key  # Optional

REDIS_URL=redis://localhost:6379  # Optional

```
### Local Model Setup

```bash
# Clone Kokoro TTS model

git clone https://huggingface.co/hexgrad/Kokoro-82M models/tts/Kokoro-82M

# Clone LFM2 model

git clone https://huggingface.co/mlx-community/LFM2-1.2B-bf16 models/agents/LFM2-1.2B

# Install Ollama (for local LLMs)
# macOS

brew install ollama

# Start Ollama

ollama serve

# Pull models

ollama pull llama3.2:3b

ollama pull mistral:7b

```
## Docker Commands (if using Docker)
```bash
# Build Docker image

docker build -t universal-ai-tools .

# Run container

docker run -p 3456:3456 --env-file .env universal-ai-tools

# Run with volume mounting

docker run -p 3456:3456 -v $(pwd)/data:/app/data --env-file .env universal-ai-tools

```
## Supabase CLI Commands
```bash
# Login to Supabase

supabase login

# Initialize Supabase project

supabase init

# Link to existing project

supabase link --project-ref your-project-ref

# Run migrations

supabase db push

# Generate types

supabase gen types typescript --local > src/types/supabase.ts

# Start local Supabase

supabase start

# Stop local Supabase

supabase stop

```
## Utility Commands
### Port Management

```bash
# Check port status via API

curl http://localhost:3456/api/ports/status

# Get port report

curl http://localhost:3456/api/ports/report

# Trigger health check

curl -X POST http://localhost:3456/api/ports/health-check

# Resolve port conflict

curl -X POST http://localhost:3456/api/ports/resolve-conflict \

  -H "Content-Type: application/json" \

  -d '{"service": "redis", "requestedPort": 6379}'

```
### Performance Metrics

```bash
# Get performance metrics

curl http://localhost:3456/api/performance/metrics

# Get performance report

curl http://localhost:3456/api/performance/report

# Get Prometheus metrics

curl http://localhost:3456/metrics

```
## Quick Start Commands
### First Time Setup

```bash
# 1. Clone repository

git clone https://github.com/your-org/universal-ai-tools.git

cd universal-ai-tools

# 2. Install dependencies

npm install

# 3. Setup environment

cp .env.example .env
# Edit .env with your values

# 4. Run database migrations

npm run migrate

# 5. Scrape Supabase docs (optional but recommended)

npm run scrape:supabase

# 6. Start development server

npm run dev

```
### Daily Development Flow

```bash
# 1. Check migration status

npm run migrate:status

# 2. Run any pending migrations

npm run migrate

# 3. Start development

npm run dev

# 4. Run tests before committing

npm run test:fast

# 5. Lint and format

npm run lint:fix

npm run format

# 6. Type check

npm run type-check

```
## Production Deployment
```bash
# 1. Build for production

npm run build:prod

# 2. Run migrations on production database

NODE_ENV=production npm run migrate

# 3. Start production server

npm run start:prod

```
## Troubleshooting Commands
```bash
# Check TypeScript errors

npm run type-check

# Analyze TypeScript errors in detail

npm run fix:typescript

# Check all code quality

npm run lint && npm run type-check && npm run test:fast

# Clean and reinstall

rm -rf node_modules package-lock.json

npm install

# Reset database (local only)

supabase db reset

# Check Ollama status

curl http://localhost:11434/api/tags

```
## Advanced Commands
### API Testing with Authentication

```bash
# First register a service

curl -X POST http://localhost:3456/api/register \

  -H "Content-Type: application/json" \

  -d '{

    "service_name": "test-service",

    "service_type": "custom",

    "capabilities": ["memory", "tools"]

  }'

# Use the returned API key for authenticated requests

curl http://localhost:3456/api/v1/memory \

  -H "X-API-Key: your-api-key" \

  -H "X-AI-Service: test-service" \

  -H "Content-Type: application/json" \

  -d '{"content": "Test memory"}'

```
### WebSocket Connection

```bash
# Connect to WebSocket for real-time updates

wscat -c ws://localhost:3456/ws/port-status

```
## Notes
- All commands assume you're in the project root directory

- Some commands require environment variables to be set

- Database commands require Supabase to be configured

- Test commands may require additional setup (Ollama, models, etc.)

- Use `--help` flag on CLI commands for more options