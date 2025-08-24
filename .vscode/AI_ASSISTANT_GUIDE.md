# AI Assistant Development Guide for Universal AI Tools

## 🤖 AI Assistant Context

This document provides comprehensive context for AI assistants (Claude, ChatGPT, etc.) working on the Universal AI Tools project. Use this information to provide better assistance and avoid common issues.

## 📋 Project Overview

**Universal AI Tools** is a full-stack AI platform featuring:
- **Backend**: TypeScript/Express API with agents, monitoring, and AI orchestration
- **Frontend**: Swift/SwiftUI macOS application
- **ML Services**: Python DSPy orchestrator for AI workflows
- **Infrastructure**: Docker, Prometheus, Grafana monitoring stack

## 🛠️ Development Environment

### IDE: Cursor (VS Code fork with AI features)
- **Location**: `/Users/christianmerrill/Desktop/universal-ai-tools`
- **Configuration**: Optimized for multi-language development
- **Extensions**: Comprehensive Swift, TypeScript, Python support

### Installed Extensions & Their Purposes

#### Swift/iOS Development
```json
{
  "sswg.swift-lang": "Swift language support with IntelliSense",
  "vknabel.vscode-apple-swift-format": "Apple's official Swift formatter",
  "swift-server.swift-syntax-language-server": "Advanced Swift language server",
  "vadimcn.vscode-lldb": "LLDB debugger for Swift debugging"
}
```

#### TypeScript/JavaScript
```json
{
  "dbaeumer.vscode-eslint": "ESLint for code quality and linting",
  "esbenp.prettier-vscode": "Prettier for code formatting",
  "ms-vscode.vscode-typescript-next": "Latest TypeScript features"
}
```

#### Python
```json
{
  "ms-python.python": "Python language support",
  "charliermarsh.ruff": "Fast Python linter and formatter"
}
```

#### Development Tools
```json
{
  "ms-azuretools.vscode-docker": "Docker container management",
  "eamodio.gitlens": "Enhanced Git integration",
  "supabase-community.supabase-vscode": "Supabase database tools",
  "humao.rest-client": "HTTP request testing",
  "rangav.vscode-thunder-client": "Advanced API testing"
}
```

## 🎯 Available Commands & Tasks

### Swift Development
```bash
# Build Commands (use Cmd+Shift+P)
"swift: Build Debug"           # Build debug configuration
"swift: Build Release"         # Build release configuration  
"swift: Clean"                 # Clean build artifacts
"swift: Run Tests"             # Execute Swift tests
"swift: Format Code"           # Format Swift code
"swift: Run App"               # Build and launch macOS app

# Xcode Integration
xcodebuild -project macOS-App/UniversalAITools/UniversalAITools.xcodeproj -scheme UniversalAITools build
```

### TypeScript Development
```bash
# NPM Scripts
npm run dev                    # Start development server
npm run build                  # Build for production
npm run test                   # Run Jest tests
npm run lint                   # ESLint code checking
npm run format                 # Prettier formatting
npm run type-check             # TypeScript type checking

# VS Code Commands
"TypeScript: Restart TS Server"
"ESLint: Fix All Problems"
"Prettier: Format Document"
```

### Python Development
```bash
# Python Scripts
python src/services/dspy-orchestrator/server.py

# VS Code Commands  
"Python: Select Interpreter"
"Python: Run Python File"
"Ruff: Fix All"
"Ruff: Organize Imports"
```

## 🐛 Debug Configurations

### Available Debug Configs
1. **"Debug Server (Development)"** - Backend TypeScript debugging
2. **"Debug Universal AI Tools (macOS)"** - Swift macOS app debugging
3. **"Python: DSPy Orchestrator"** - Python service debugging
4. **"Full Stack Debug"** - Compound configuration for full stack

### Debugging Workflow
```typescript
// To debug backend:
// 1. Set breakpoints in TypeScript files
// 2. Press F5 or use "Debug Server (Development)"
// 3. Server starts on http://localhost:9999

// To debug Swift app:
// 1. Set breakpoints in Swift files
// 2. Use "Debug Universal AI Tools (macOS)" 
// 3. LLDB attaches to macOS application
```

## 📁 Project Structure Awareness

```
universal-ai-tools/
├── src/                           # TypeScript backend
│   ├── server.ts                  # Main server entry
│   ├── routers/                   # API endpoints
│   ├── services/                  # Business logic
│   ├── agents/                    # AI agent system
│   └── middleware/                # Express middleware
├── macOS-App/UniversalAITools/    # Swift macOS application
│   ├── UniversalAITools.xcodeproj # Xcode project
│   ├── Views/                     # SwiftUI views
│   ├── Services/                  # Swift services
│   ├── Models/                    # Data models
│   └── Controllers/               # App controllers
├── monitoring/                    # Infrastructure monitoring
│   ├── prometheus.yml             # Metrics collection
│   ├── grafana/                   # Dashboards
│   └── alertmanager.yml           # Alert routing
├── scripts/                       # Deployment scripts
├── tests/                         # Test suites
└── .vscode/                       # IDE configuration
```

## 🔧 Common Development Tasks

### When Asked to Modify Code:

#### TypeScript Files
1. **Format**: Use Prettier (`esbenp.prettier-vscode`)
2. **Lint**: Use ESLint (`dbaeumer.vscode-eslint`)
3. **Build**: Run `npm run build`
4. **Test**: Run `npm test`

#### Swift Files  
1. **Format**: Use Apple Swift Format (`vknabel.vscode-apple-swift-format`)
2. **Build**: Use `swift: Build Debug` task
3. **Test**: Use `swift: Run Tests` task
4. **Debug**: Use LLDB configuration

#### Python Files
1. **Format**: Use Ruff (`charliermarsh.ruff`)
2. **Lint**: Ruff handles both linting and formatting
3. **Run**: Use Python debug configuration

### When Asked About Debugging:

#### Backend Issues
- Use **"Debug Server (Development)"** configuration
- Set breakpoints in TypeScript files
- Server runs on `http://localhost:9999`
- Check terminal for console output

#### macOS App Issues  
- Use **"Debug Universal AI Tools (macOS)"** configuration
- LLDB debugger with Swift support
- Set breakpoints in SwiftUI views or services
- Use Xcode Simulator or run directly

#### Full Stack Issues
- Use **"Full Stack Debug"** compound configuration
- Starts both backend and frontend debugging
- Allows simultaneous debugging of API and UI

### When Asked About Building:

#### Development Build
```bash
# Backend
npm run dev              # Starts with hot reload

# macOS App  
# Use: "swift: Build Debug" task
# Or: Cmd+Shift+B → swift: Build Debug
```

#### Production Build
```bash
# Backend
npm run build:prod      # Optimized production build

# macOS App
# Use: "swift: Build Release" task  

# Full deployment
./scripts/deploy-production.sh
```

## 🚨 Troubleshooting Guide

### Swift Language Server Issues
```bash
# If Swift IntelliSense not working:
1. Check Swift installation: `swift --version`
2. Restart language server: Cmd+Shift+P → "Swift: Restart Language Server"  
3. Verify Xcode CLI tools: `xcode-select --install`
4. Check SourceKit-LSP: `xcrun sourcekit-lsp --help`
```

### TypeScript Issues
```bash
# If TypeScript errors or slow performance:
1. Restart TS server: Cmd+Shift+P → "TypeScript: Restart TS Server"
2. Clear cache: `rm -rf node_modules/.cache`
3. Rebuild: `npm run build`
4. Check tsconfig.json for issues
```

### Debug Connection Issues
```bash
# If debugger won't connect:
1. Check debug configuration in .vscode/launch.json
2. Verify ports are available (9999 for backend)
3. For Swift: Ensure LLDB installed: `lldb --version`
4. For Node: Check if process is running: `lsof -i :9999`
```

### Build Failures
```bash
# Swift build failures:
1. Clean build: Cmd+Shift+P → "swift: Clean"
2. Clean derived data: `rm -rf ~/Library/Developer/Xcode/DerivedData`
3. Check Xcode project integrity

# TypeScript build failures:  
1. Clear node_modules: `rm -rf node_modules && npm install`
2. Check for type errors: `npm run type-check`
3. Verify all dependencies: `npm audit`
```

## 🎨 Code Style Guidelines

### Swift Style
- **Formatter**: Apple Swift Format (automatic on save)
- **Line Length**: 100 characters
- **Indentation**: 2 spaces
- **Import Organization**: Automatic via code actions

### TypeScript Style
- **Formatter**: Prettier (automatic on save)
- **Linter**: ESLint with strict rules
- **Quote Style**: Single quotes
- **Semicolons**: Required

### Python Style  
- **Formatter**: Ruff (automatic on save)
- **Line Length**: 88 characters (Black standard)
- **Import Organization**: Ruff handles automatically

## 📊 Monitoring & Deployment

### Production Monitoring
```bash
# Start monitoring stack
./scripts/monitoring-setup.sh

# Services available at:
# - Prometheus: http://localhost:9090
# - Grafana: http://localhost:3000  
# - Alertmanager: http://localhost:9093
```

### Deployment Commands
```bash
# Production deployment
./scripts/deploy-production.sh

# SSL setup
./scripts/ssl-setup.sh

# Health check
./scripts/health-check.sh
```

## 🤖 AI Assistant Best Practices

### When Providing Code Solutions:

1. **Check Extension Context**: Always consider which extensions are available
2. **Use Appropriate Formatters**: Mention using Prettier, Swift Format, or Ruff
3. **Suggest Debug Configs**: Reference specific debug configurations by name
4. **Include Build Steps**: Mention relevant build tasks and commands
5. **Consider Multi-Language**: Project uses TypeScript, Swift, and Python

### When Debugging Issues:

1. **Extension-Specific Commands**: Suggest using relevant VS Code commands
2. **Check Tool Availability**: Verify required tools are installed
3. **Multi-Platform Considerations**: Account for macOS development requirements
4. **Reference Debug Configs**: Use the specific debug configuration names

### When Making Suggestions:

1. **Use Available Tasks**: Reference tasks defined in `.vscode/tasks.json`
2. **Leverage Extensions**: Suggest using installed extension features
3. **Follow Project Structure**: Respect the established project organization
4. **Consider Dependencies**: Account for the full stack nature of the project

## 🔑 Keyboard Shortcuts Reference

### Universal Shortcuts
- **Cmd+Shift+P**: Command Palette (essential for extension commands)
- **Cmd+Shift+B**: Build (shows available build tasks)
- **F5**: Start Debugging
- **Shift+Alt+F**: Format Document

### Swift-Specific
- **Cmd+R**: Run (build and launch app)
- **Cmd+U**: Run tests
- **Cmd+Shift+K**: Clean build folder

### Debugging
- **F9**: Toggle breakpoint
- **F10**: Step over
- **F11**: Step into
- **Shift+F5**: Stop debugging

---

## 📞 Quick Reference for AI Assistants

**When user asks about:**
- **Building**: Suggest appropriate build task from Command Palette
- **Debugging**: Reference specific debug configuration by name  
- **Formatting**: Mention relevant formatter (Prettier/Swift Format/Ruff)
- **Extensions**: Reference by ID and explain capabilities
- **Issues**: Provide extension-specific troubleshooting steps

**Always consider:**
- Multi-language project (TypeScript + Swift + Python)
- Cursor IDE specific features
- Available extensions and their commands
- Project structure and build requirements
- Debug configurations and their purposes

---

**Last Updated**: 2025-01-17  
**For**: Claude, ChatGPT, and other AI development assistants  
**Project**: Universal AI Tools v1.0