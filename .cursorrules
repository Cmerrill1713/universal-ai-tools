# Universal AI Tools - Claude Instructions for Cursor

## Project Context
- **Production Readiness**: ~35% - NOT READY FOR PRODUCTION
- **Tech Stack**: TypeScript, Express, Supabase, PostgreSQL, Redis (missing), DSPy (mock only)
- **Architecture**: Microservices with agent orchestration, memory management, and LLM integration
- **Current State**: Development environment with many production blockers

## Critical Issues (MUST FIX)

### 1. Disabled Services (src/server.ts)
- Performance middleware mocked (lines 58-67)
- GraphQL server disabled (lines 1337-1347)
- Port integration service disabled (lines 1349-1369)
- Security hardening service commented out (line 79, 475-520)
- Agent execution endpoints disabled (lines 1112-1141, 1166-1230)

### 2. Security Vulnerabilities
- Hardcoded 'local-dev-key' authentication bypass
- Development fallbacks in production code
- CORS allows localhost in production
- Test keys embedded in source code
- 31 SECURITY DEFINER functions without audit

### 3. Mock Implementations
- ALL cognitive agents are mocks (src/agents/cognitive/)
- DSPy orchestration using mock_server.py only
- No real Redis infrastructure
- Circuit breakers imported but not implemented

### 4. Database Issues
- 41 migration files with conflicts
- Duplicate tables (ai_memories vs memories)
- 3 versions of ollama_ai_functions
- No tested rollback strategy

### 5. Testing Gaps
- Only 15% test coverage
- ZERO API endpoint tests
- No security testing
- No integration tests for database

## Code Style & Standards
- TypeScript strict mode enabled
- ESLint + Prettier configured
- 100 char line width
- Single quotes for strings
- Trailing commas in ES5
- 2-space indentation
- Path aliases: @/, @utils/, @services/, @agents/

## When Making Changes

### Before ANY Implementation:
1. Check if the service/feature is disabled or mocked
2. Look for TODO/FIXME comments in the area
3. Verify no development fallbacks are being added
4. Check for migration conflicts if database-related

### Required for ALL Changes:
1. Add tests for new functionality
2. Update relevant documentation
3. No hardcoded values or dev-only code
4. Follow existing patterns in the codebase

### Security Checklist:
- [ ] No hardcoded keys or secrets
- [ ] No localhost in production configs
- [ ] Input validation on all endpoints
- [ ] Proper error handling (no stack traces to users)
- [ ] Authentication required (no dev bypasses)

## Current Priorities (In Order)

### Phase 1: Critical Infrastructure (Weeks 1-3)
1. Re-enable performance middleware with proper error handling
2. Fix GraphQL server (@apollo/server dependency issues)
3. Enable security hardening service
4. Fix agent execution endpoints (timeout issues)
5. Remove ALL development authentication fallbacks

### Phase 2: Real Implementations (Weeks 4-7)
1. Implement real DSPy backend (replace mock_server.py)
2. Deploy Redis infrastructure
3. Convert ALL cognitive agents from mocks to real
4. Implement circuit breaker patterns
5. Add comprehensive test coverage (target 80%)

### Phase 3: Production Hardening (Weeks 8-10)
1. Consolidate database migrations
2. Enable monitoring and observability
3. Load testing and optimization
4. Security audit and penetration testing

## Important File Locations

### Core Infrastructure:
- `src/server.ts` - Main server with disabled services
- `src/middleware/` - Security and performance middleware
- `src/config/` - Configuration files

### Services:
- `src/services/dspy-orchestrator/` - Mock DSPy implementation
- `src/services/dspy-orchestrator/bridge.ts` - WebSocket bridge
- `src/agents/cognitive/` - ALL are mock implementations

### Database:
- `supabase/migrations/` - 41 conflicting migration files
- Look for duplicate implementations before adding

### Testing:
- `src/tests/` - Minimal test coverage
- `jest.config.js` - Test configuration

## Helper Commands

```bash
# Check for mocks
grep -r "mock" src/agents/

# Find disabled code
grep -r "DISABLED\|SKIPPING\|commented\|TODO\|FIXME" src/

# Find dev keys
grep -r "local-dev-key\|test-key\|hardcoded" src/

# Check migrations
ls -la supabase/migrations/ | grep -E "(ollama|memory|similar_pattern)"

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:security  # Currently missing
```

## Memory Context
- Always check PRODUCTION_BLOCKERS.md for latest status
- Reference MIGRATION_ANALYSIS_REPORT.md for database issues
- See INFRASTRUCTURE_AUDIT_REPORT.md for service details
- Review SECURITY_ASSESSMENT_REPORT.md for vulnerabilities

## Communication Style
- Be direct about production blockers
- Highlight security issues immediately
- Suggest fixes that remove (not add) complexity
- Focus on getting to production, not adding features
- Always mention if something is mocked/disabled