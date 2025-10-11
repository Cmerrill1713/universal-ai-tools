# 🎭 Playwright MCP Frontend Testing Setup

Complete setup guide for testing Universal AI Tools frontends using Playwright MCP (Model Context Protocol).

## 🎯 Overview

This setup provides comprehensive frontend testing for:

- **Web Frontend**: HTML/JS interface (`web-frontend/`)
- **Swift macOS App**: Native SwiftUI application (`swift-companion-app/`)
- **Backend Integration**: Full API testing with real services

## 📋 Prerequisites

- Node.js (v18+)
- npm
- Rust toolchain (for backend services)
- Swift (for Swift frontend, optional)
- Python 3 (for web server)

## 🚀 Quick Start

### 1. Install Dependencies

```bash
# Install Node.js dependencies
npm install

# Install Playwright browsers
npm run test:install-browsers
```

### 2. Start Frontend Testing Environment

```bash
# Start all services and frontends
./start-frontend-tests.sh
```

This script will:

- ✅ Start backend services (LLM Router, Assistant Service)
- ✅ Start web frontend on port 3000
- ✅ Start Swift frontend on port 8080 (if available)
- ✅ Verify all services are running
- ✅ Install Playwright browsers if needed

### 3. Run Tests

```bash
# Test web frontend only
npm run test:web-frontend

# Test Swift frontend only
npm run test:swift-frontend

# Test all frontends
npm run test:all-frontends

# Run tests with UI
npm run test:web-ui
npm run test:swift-ui
```

## 🧪 Available Test Suites

### Web Frontend Tests (`tests/web-frontend-tests.spec.ts`)

**Interface Tests:**

- ✅ Main interface loading
- ✅ Connection status display
- ✅ Chat interface functionality
- ✅ User input handling
- ✅ Keyboard shortcuts (Enter, Shift+Enter)
- ✅ Auto-resize textarea
- ✅ Typing indicator
- ✅ Error handling
- ✅ Mobile responsiveness
- ✅ Message history
- ✅ Empty message handling
- ✅ Model information display
- ✅ Page refresh handling

**API Integration Tests:**

- ✅ Backend service connectivity
- ✅ Successful chat responses
- ✅ API timeout handling
- ✅ Malformed response handling

**Performance Tests:**

- ✅ Quick loading (< 3 seconds)
- ✅ Rapid message sending
- ✅ Large text input handling

### Swift Frontend Tests (`tests/swift-frontend-tests.spec.ts`)

**Interface Tests:**

- ✅ Main interface loading
- ✅ Version information display
- ✅ AI model selector
- ✅ Chat interface
- ✅ User input handling
- ✅ Settings panel
- ✅ Authentication flow
- ✅ Performance metrics
- ✅ File uploads
- ✅ Error handling
- ✅ Responsive design
- ✅ Keyboard shortcuts
- ✅ Loading states
- ✅ Dark/light theme

**API Integration Tests:**

- ✅ Backend service connectivity
- ✅ API error handling

**Performance Tests:**

- ✅ Quick loading
- ✅ Large dataset handling

## 🔧 Configuration Files

### MCP Configuration (`mcp-config.json`)

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp"],
      "env": {
        "NODE_ENV": "development",
        "PLAYWRIGHT_BROWSERS_PATH": "/Users/christianmerrill/Library/Caches/ms-playwright"
      }
    },
    "playwright-web-frontend": {
      "command": "npx",
      "args": [
        "@playwright/mcp",
        "--config",
        "playwright-web-frontend.config.ts"
      ],
      "env": {
        "NODE_ENV": "development",
        "WEB_FRONTEND_URL": "http://127.0.0.1:3000"
      }
    },
    "playwright-swift-frontend": {
      "command": "npx",
      "args": ["@playwright/mcp", "--config", "playwright-swift-mcp.config.ts"],
      "env": {
        "NODE_ENV": "development",
        "SWIFT_FRONTEND_URL": "http://127.0.0.1:8080"
      }
    }
  }
}
```

### Web Frontend Config (`playwright-web-frontend.config.ts`)

- **Base URL**: `http://127.0.0.1:3000`
- **Browsers**: Chrome, Safari, Firefox, Mobile
- **Web Server**: Python HTTP server
- **Test Patterns**: `**/web-frontend-tests.spec.ts`

### Swift Frontend Config (`playwright-swift-mcp.config.ts`)

- **Base URL**: `http://127.0.0.1:8080`
- **Browsers**: Chrome, Safari, Firefox, Mobile
- **Web Server**: Swift package server
- **Test Patterns**: `**/swift-frontend-tests.spec.ts`

## 📊 Test Reports

### HTML Reports

- **Web Frontend**: `test-results/web-frontend/`
- **Swift Frontend**: `test-results/swift-frontend/`

### JSON Reports

- **Web Frontend**: `test-results/web-frontend-results.json`
- **Swift Frontend**: `test-results/swift-frontend-results.json`

### JUnit Reports

- **Web Frontend**: `test-results/web-frontend-results.xml`
- **Swift Frontend**: `test-results/swift-frontend-results.xml`

## 🛠️ Available Commands

### Test Commands

```bash
# Basic tests
npm run test                    # Run all tests
npm run test:ui                # Run with UI
npm run test:headed            # Run in headed mode
npm run test:debug             # Run in debug mode

# Frontend-specific tests
npm run test:web-frontend      # Web frontend only
npm run test:swift-frontend    # Swift frontend only
npm run test:all-frontends     # All frontends

# UI tests
npm run test:web-ui            # Web frontend with UI
npm run test:swift-ui          # Swift frontend with UI

# Backend tests
npm run test:backend           # Backend services only
npm run test:frontend          # Legacy frontend integration

# Utilities
npm run test:report            # Show test report
npm run test:install-browsers  # Install Playwright browsers
npm run test:install-deps      # Install system dependencies
```

### Service Management

```bash
# Start all services for testing
./start-frontend-tests.sh

# Manual service startup
cargo run -p llm-router &      # Backend API
cargo run -p assistantd &      # Assistant service
cd web-frontend && python3 -m http.server 3000 &  # Web frontend
cd swift-companion-app && swift run &              # Swift frontend
```

## 🔍 Debugging

### Common Issues

**Services Not Starting:**

```bash
# Check if ports are available
lsof -i :3000  # Web frontend
lsof -i :3033  # LLM Router
lsof -i :8080  # Swift frontend

# Check service logs
tail -f logs/llm-router.log
tail -f logs/web-frontend.log
tail -f logs/swift-frontend.log
```

**Playwright Issues:**

```bash
# Reinstall browsers
npm run test:install-browsers

# Run in headed mode to see browser
npm run test:web-frontend -- --headed

# Debug specific test
npm run test:web-frontend -- --debug tests/web-frontend-tests.spec.ts
```

**Swift Frontend Issues:**

```bash
# Check Swift installation
swift --version

# Check Swift package
cd swift-companion-app
swift package resolve
swift build
```

### Test Debugging

**View Test Results:**

```bash
# Open HTML report
npm run test:report

# View specific test results
open test-results/web-frontend/index.html
open test-results/swift-frontend/index.html
```

**Debug Mode:**

```bash
# Debug web frontend tests
npm run test:web-frontend -- --debug

# Debug specific test
npm run test:web-frontend -- --debug --grep "should load the main interface"
```

## 📁 File Structure

```
├── mcp-config.json                    # MCP server configuration
├── playwright-web-frontend.config.ts # Web frontend Playwright config
├── playwright-swift-mcp.config.ts     # Swift frontend Playwright config
├── start-frontend-tests.sh           # Service startup script
├── package.json                       # Test dependencies and scripts
├── tests/
│   ├── web-frontend-tests.spec.ts    # Web frontend test suite
│   ├── swift-frontend-tests.spec.ts  # Swift frontend test suite
│   ├── web-frontend-setup.ts         # Web frontend test setup
│   ├── web-frontend-teardown.ts      # Web frontend test cleanup
│   ├── swift-frontend-setup.ts       # Swift frontend test setup
│   └── swift-frontend-teardown.ts    # Swift frontend test cleanup
├── web-frontend/
│   └── index.html                    # Web frontend interface
├── swift-companion-app/
│   └── Package.swift                 # Swift package configuration
└── test-results/                     # Test output directory
    ├── web-frontend/                 # Web frontend test results
    └── swift-frontend/              # Swift frontend test results
```

## 🎯 Testing Strategy

### Frontend Testing Approach

1. **Unit Tests**: Individual component functionality
2. **Integration Tests**: Frontend-backend communication
3. **E2E Tests**: Complete user workflows
4. **Performance Tests**: Loading times and responsiveness
5. **Cross-browser Tests**: Chrome, Safari, Firefox compatibility
6. **Mobile Tests**: Responsive design validation

### Test Data Management

- **Mock APIs**: Use Playwright's `page.route()` for controlled testing
- **Real Services**: Test against actual backend services
- **Error Scenarios**: Test timeout, network errors, malformed responses
- **Edge Cases**: Empty inputs, large data, rapid interactions

## 🚀 Continuous Integration

### GitHub Actions Integration

```yaml
name: Frontend Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: "18"
      - run: npm install
      - run: npm run test:install-browsers
      - run: ./start-frontend-tests.sh &
      - run: npm run test:all-frontends
```

## 📞 Support

### Troubleshooting Checklist

1. ✅ All services running (`./start-frontend-tests.sh`)
2. ✅ Playwright browsers installed (`npm run test:install-browsers`)
3. ✅ Ports available (3000, 3033, 8080)
4. ✅ Dependencies installed (`npm install`)
5. ✅ Swift available (for Swift frontend)

### Getting Help

- Check service logs in `logs/` directory
- Run tests in headed mode: `npm run test:web-frontend -- --headed`
- Use debug mode: `npm run test:web-frontend -- --debug`
- View test reports: `npm run test:report`

## 🎉 Success Indicators

When everything is working correctly:

1. ✅ All services start without errors
2. ✅ Web frontend loads at http://127.0.0.1:3000
3. ✅ Swift frontend loads at http://127.0.0.1:8080
4. ✅ Backend services respond to health checks
5. ✅ Playwright tests pass (50+ tests total)
6. ✅ Test reports generate successfully
7. ✅ MCP integration works with AI assistants

The Playwright MCP setup provides comprehensive frontend testing capabilities for both web and native Swift interfaces, ensuring robust functionality across all supported platforms.
