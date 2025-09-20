# Universal AI Tools - MCP (Model Context Protocol) Setup

## 🎯 Overview

This setup provides a complete MCP (Model Context Protocol) integration for Universal AI Tools, including:

- **Custom MCP Server** for testing backend services
- **Playwright Integration** for frontend testing
- **Automated Test Suite** for all services
- **Service Health Monitoring**

## 📋 Prerequisites

- Node.js (v18+)
- npm
- Playwright browsers installed
- Universal AI Tools backend services running

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Start Backend Services

```bash
# LLM Router
cargo run -p llm-router &

# HRM-MLX Service
./start-hrm-service.sh &

# FastVLM Service
cd python-services/mlx-fastvlm-service && MLX_PORT=8003 python server.py &
```

### 3. Start MCP Server

```bash
./start-mcp.sh
```

## 🛠️ Available MCP Tools

### `test_llm_router`

Test the LLM Router service endpoints.

**Parameters:**

- `endpoint`: "health" | "smart" | "models" | "providers"
- `message`: Test message for smart endpoint (optional)

**Example:**

```json
{
  "endpoint": "smart",
  "message": "Hello, test message"
}
```

### `test_hrm_mlx`

Test the HRM-MLX service endpoints.

**Parameters:**

- `endpoint`: "health" | "process"
- `input`: Input for processing endpoint (optional)

**Example:**

```json
{
  "endpoint": "process",
  "input": "What is the capital of France?"
}
```

### `test_fastvlm`

Test the FastVLM service endpoints.

**Parameters:**

- `endpoint`: "health" | "vision"
- `prompt`: Vision prompt (optional)

**Example:**

```json
{
  "endpoint": "vision",
  "prompt": "What do you see in this image?"
}
```

### `run_playwright_test`

Run Playwright tests for frontend integration.

**Parameters:**

- `testFile`: "backend-services.spec.ts" | "frontend-integration.spec.ts" | "all"
- `browser`: "chromium" | "firefox" | "webkit" | "all" (optional)

**Example:**

```json
{
  "testFile": "backend-services.spec.ts",
  "browser": "chromium"
}
```

## 🧪 Running Tests

### All Tests

```bash
npx playwright test
```

### Specific Test Files

```bash
# Backend services only
npx playwright test tests/backend-services.spec.ts

# Frontend integration only
npx playwright test tests/frontend-integration.spec.ts
```

### With UI

```bash
npx playwright test --ui
```

### Debug Mode

```bash
npx playwright test --debug
```

## 📊 Test Results

The tests cover:

### Backend Services Tests

- ✅ LLM Router health check
- ✅ LLM Router smart chat endpoint
- ✅ HRM-MLX service health check
- ✅ HRM-MLX processing endpoint
- ✅ FastVLM service health check
- ✅ FastVLM vision endpoint
- ✅ LLM Router models endpoint
- ✅ LLM Router provider health endpoint

### Frontend Integration Tests

- ✅ Chat functionality integration
- ✅ Vision functionality integration
- ✅ Backend service connectivity
- ✅ Error handling

## 🔧 Configuration

### Environment Variables

```bash
export LLM_ROUTER_URL="http://127.0.0.1:3033"
export HRM_MLX_URL="http://127.0.0.1:8002"
export FASTVLM_URL="http://127.0.0.1:8003"
```

### MCP Configuration

The `mcp-config.json` file contains the MCP server configuration for integration with AI assistants.

## 🐛 Troubleshooting

### Services Not Running

If tests fail with connection errors:

1. Check if services are running:

   ```bash
   curl http://127.0.0.1:3033/health
   curl http://127.0.0.1:8002/health
   curl http://127.0.0.1:8003/health
   ```

2. Start missing services:

   ```bash
   # LLM Router
   cargo run -p llm-router &

   # HRM-MLX
   ./start-hrm-service.sh &

   # FastVLM
   cd python-services/mlx-fastvlm-service && MLX_PORT=8003 python server.py &
   ```

### Playwright Issues

If Playwright tests fail:

1. Install browsers:

   ```bash
   npx playwright install
   ```

2. Check browser permissions:
   ```bash
   npx playwright test --headed
   ```

### MCP Server Issues

If MCP server fails to start:

1. Check Node.js version:

   ```bash
   node --version  # Should be v18+
   ```

2. Reinstall dependencies:
   ```bash
   npm install
   ```

## 📁 File Structure

```
├── mcp-config.json          # MCP configuration
├── mcp-server.js            # Custom MCP server
├── start-mcp.sh             # MCP startup script
├── playwright.config.ts     # Playwright configuration
├── package.json             # Node.js dependencies
├── tests/
│   ├── backend-services.spec.ts    # Backend service tests
│   └── frontend-integration.spec.ts # Frontend integration tests
└── MCP-SETUP.md             # This documentation
```

## 🎉 Success Indicators

When everything is working correctly:

1. ✅ All backend services respond to health checks
2. ✅ MCP server starts without errors
3. ✅ Playwright tests pass (28+ tests)
4. ✅ Frontend integration tests pass
5. ✅ AI assistants can use MCP tools

## 🔄 Continuous Integration

The MCP setup is designed to work with CI/CD pipelines:

```bash
# Install dependencies
npm install

# Start services (in background)
cargo run -p llm-router &
./start-hrm-service.sh &
cd python-services/mlx-fastvlm-service && MLX_PORT=8003 python server.py &

# Wait for services to start
sleep 10

# Run tests
npx playwright test

# Test MCP server
node mcp-server.js --test
```

## 📞 Support

For issues with the MCP setup:

1. Check service logs
2. Verify network connectivity
3. Review test output
4. Check MCP server logs

The MCP server provides detailed error messages and status information for debugging.
