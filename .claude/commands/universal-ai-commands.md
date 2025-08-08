# Universal AI Tools Commands

## Implementation Workflow

### Execute Feature Implementation
1. **Load Context**: Review CLAUDE.md, check service architecture
2. **Plan**: Use TodoWrite tool, identify integration points  
3. **Implement**: Follow service-oriented patterns, use Context Injection Service
4. **Validate**: Run `npm run lint:fix && npm run build && npm test`
5. **Save Context**: Store progress in Supabase for continuity

### Generate PRP (Production Readiness Plan)
For complex features requiring formal planning:
- Research Universal AI Tools architecture patterns
- Use `PRPs/templates/prp_base.md` template
- Include service integration points, security requirements
- Validate with production testing pipeline

### Production Readiness Fixing
Current critical blockers:
- TypeScript compilation errors: Priority fix
- ESLint errors (focus on errors, defer warnings) 
- Production code quality (remove mocks, hardcoded values)

**Fix Process**: Diagnose → Batch fix → Validate → Repeat
**Commands**: `npm run type-check`, `npm run lint:fix`

### Rule to Hook Conversion
Convert project rules to Claude hook configurations:
- **PreToolUse**: Before tool execution (validate, scan)
- **PostToolUse**: After tool completion (format, test)
- **Stop**: When Claude finishes (summary, commit)

**Event Mapping**: "before" → PreToolUse, "after" → PostToolUse, "finish" → Stop

## Key Architecture Patterns
- **Context Injection**: Mandatory for all LLM calls
- **Service-Oriented**: Extend services, don't create isolated agents  
- **Supabase Vault**: Store all secrets securely
- **Production Validation**: Maintain 17/17 self-improvement tests

## Essential Commands
- `npm run dev` - Development server
- `npm run build` - Production build
- `npm run test` - Full test suite
- `npm run lint:fix` - Auto-fix linting
- `supabase start` - Start local database