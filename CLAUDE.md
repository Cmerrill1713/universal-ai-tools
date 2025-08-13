# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

Universal AI Tools - AI platform with service-oriented architecture.

## Quick Start

```bash
npm install        # Install dependencies
npm run dev        # Start development server
npm run build      # Build for production
npm test           # Run tests
```

## Project Structure

```
src/
├── services/      # Core services
├── routers/       # API endpoints
├── agents/        # Agent system
└── middleware/    # Express middleware
```

## CRITICAL: Subagent Delegation Strategy

**YOU MUST ACTIVELY DELEGATE TO SUBAGENTS** - This project has specialized subagents that MUST be used:

### When to Delegate (MANDATORY):
1. **After ANY code modification** → Immediately use `code-reviewer` agent
2. **When ANY test fails** → Immediately use `test-runner` agent
3. **For ANY API/endpoint issue** → Immediately use `api-debugger` agent
4. **For ANY UI/SwiftUI work** → Immediately use `swift-ui-expert` agent
5. **For ANY performance issue** → Immediately use `performance-optimizer` agent

### Delegation Rules:
- **DO NOT** attempt to fix issues yourself if a specialized agent exists
- **DO NOT** write code without having it reviewed by code-reviewer
- **DO NOT** commit without test-runner verification
- **ALWAYS** delegate specialized tasks to the appropriate subagent
- **CHAIN** multiple agents for complex tasks (e.g., swift-ui-expert → code-reviewer → test-runner)

### Example Delegation Patterns:
```
User: "Fix the chat endpoint"
You: [Delegate to api-debugger] → [Then to code-reviewer] → [Then to test-runner]

User: "Add a new SwiftUI view"
You: [Delegate to swift-ui-expert] → [Then to code-reviewer]

User: "The app is slow"
You: [Delegate to performance-optimizer] → [Then to test-runner]
```

### Available Subagents:
- `code-reviewer` - Reviews ALL code changes
- `api-debugger` - Fixes ALL API/endpoint issues
- `swift-ui-expert` - Handles ALL SwiftUI/Apple platform work
- `test-runner` - Runs tests after ALL changes
- `performance-optimizer` - Optimizes ALL performance issues

**Remember: Your role is to ORCHESTRATE subagents, not do their specialized work yourself.**