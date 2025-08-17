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

## Extension and Development Context

### Installed Extensions (Cursor IDE)
- **Swift**: `sswg.swift-lang`, `vknabel.vscode-apple-swift-format`, `vadimcn.vscode-lldb`
- **TypeScript**: `dbaeumer.vscode-eslint`, `esbenp.prettier-vscode`
- **Python**: `ms-python.python`, `charliermarsh.ruff`
- **Tools**: `ms-azuretools.vscode-docker`, `eamodio.gitlens`, `supabase-community.supabase-vscode`

### Debug Configurations Available
- **"Debug Server (Development)"** - Backend TypeScript debugging
- **"Debug Universal AI Tools (macOS)"** - Swift macOS app with LLDB
- **"Python: DSPy Orchestrator"** - Python service debugging
- **"Full Stack Debug"** - Compound configuration

### Build Tasks Available
- **TypeScript**: `npm run build`, `npm run dev`, `npm test`, `npm run lint`
- **Swift**: `swift: Build Debug`, `swift: Build Release`, `swift: Run Tests`, `swift: Clean`
- **Python**: Available via Python extension

### Key Commands to Suggest
- **Swift Formatting**: Use Apple Swift Format (`Shift+Alt+F` or `swift: Format Code`)
- **TypeScript Formatting**: Use Prettier (`Shift+Alt+F`)
- **Debugging**: Suggest specific debug configurations by name
- **Building**: Use Command Palette (`Cmd+Shift+P`) with task names

### Project-Specific Context
- **Multi-language**: TypeScript backend + Swift macOS app + Python ML services
- **Architecture**: Full-stack AI platform with monitoring and deployment automation
- **Debugging**: LLDB for Swift, Node.js inspector for TypeScript
- **Testing**: Jest for TypeScript, XCTest for Swift, pytest for Python

### When User Asks About:
1. **Swift/iOS Development**: 
   - Mention LLDB debugging, Apple Swift Format, Xcode integration
   - Reference `swift: Build Debug` and other Swift tasks
   - Suggest using SwiftUI-specific features

2. **TypeScript Development**:
   - Mention ESLint, Prettier, TypeScript server restart
   - Reference `npm run` scripts and debug configurations
   - Suggest using REST Client or Thunder Client for API testing

3. **Debugging Issues**:
   - Reference specific debug configuration names
   - Suggest checking extension-specific troubleshooting
   - Mention LLDB for Swift, Node.js inspector for TypeScript

4. **Building/Deployment**:
   - Reference production deployment scripts
   - Mention monitoring setup and health checks
   - Suggest using Docker integration for containerization

5. **Extensions Not Working**:
   - Provide extension-specific troubleshooting
   - Suggest restarting language servers
   - Check tool installations (Swift, Node.js, Python)

## AI Assistant Collaboration

### For Other AI Assistants (ChatGPT, etc.)
- Read `.vscode/AI_ASSISTANT_GUIDE.md` for comprehensive context
- Check `.vscode/ai-assistant-context.json` for structured information
- Use available extensions and their commands
- Reference debug configurations and build tasks by their exact names

### Extension-Aware Development
- Always consider which extensions are available before suggesting solutions
- Suggest using extension-specific commands via Command Palette
- Reference appropriate formatters (Prettier, Swift Format, Ruff)
- Consider multi-language debugging and build requirements

## Production Deployment Context

### Monitoring Stack
- **Prometheus**: Metrics collection (port 9090)
- **Grafana**: Dashboards and visualization (port 3000)
- **Alertmanager**: Alert routing and notifications (port 9093)

### Deployment Scripts
- `./scripts/deploy-production.sh` - Full production deployment
- `./scripts/monitoring-setup.sh` - Monitoring infrastructure
- `./scripts/ssl-setup.sh` - SSL certificate configuration
- `./scripts/health-check.sh` - System health validation

### Health Endpoints
- Backend API: `http://localhost:9999/api/health`
- Prometheus: `http://localhost:9090/-/healthy`
- Grafana: `http://localhost:3000/api/health`

## IMPORTANT: Extension Context Awareness

When providing assistance:
1. **Check Available Extensions**: Reference installed extensions and their capabilities
2. **Suggest Extension Commands**: Use Command Palette with specific extension commands
3. **Consider Debug Configurations**: Reference debug configs by their exact names
4. **Multi-Language Support**: Account for TypeScript, Swift, and Python development
5. **Build Task Integration**: Suggest using defined build tasks rather than raw commands