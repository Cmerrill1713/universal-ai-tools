# 🤖 Automated LLM-Powered Fixer System

An intelligent Docker-based system that automatically identifies and fixes issues in your Universal AI Tools project using LLM decision-making.

## 🚀 Features

- **Automated Issue Detection**: Scans TypeScript, JavaScript, Python, Swift, and Docker files
- **LLM-Powered Fixes**: Uses OpenAI, Anthropic, or Google AI to generate intelligent fixes
- **Iterative Improvement**: Runs multiple iterations until all issues are resolved
- **Real-time Monitoring**: Web dashboard to track progress and view fix history
- **Parallel Processing**: Can fix multiple issues simultaneously
- **Rollback Support**: Creates backups before applying fixes
- **Comprehensive Analysis**: Includes linting, type checking, test validation, and security scanning

## 📋 Prerequisites

- Docker and Docker Compose
- At least one LLM API key (OpenAI, Anthropic, or Google AI)
- 8GB+ RAM recommended
- Node.js 20+ (for local development)

## 🔧 Setup

1. **Configure API Keys**

   Add to your `.env` file:
   ```env
   # Required: At least one LLM API key
   OPENAI_API_KEY=your-openai-key
   ANTHROPIC_API_KEY=your-anthropic-key
   GOOGLE_AI_API_KEY=your-google-key
   
   # Optional: Configure fix behavior
   LLM_MODEL=gpt-4o              # or claude-3-opus-20240229
   MAX_ITERATIONS=10              # Maximum fix attempts
   ITERATION_DELAY=5              # Seconds between iterations
   PARALLEL_FIXES=3               # Concurrent fixes
   AUTO_COMMIT=false              # Auto-commit fixes to git
   ```

2. **Start the Fixer**

   ```bash
   # Quick start with default settings
   ./scripts/start-auto-fixer.sh
   
   # Or use Docker Compose directly
   docker-compose -f docker-compose.fixer.yml up
   ```

3. **Access the Dashboard**

   Open http://localhost:8080 in your browser to monitor the fixing process.

## 🎮 Usage

### Via Dashboard (Recommended)

1. Navigate to http://localhost:8080
2. Click "▶️ Start Fixing" to begin the automated process
3. Monitor progress in real-time
4. View fix history and logs
5. Click "⏹️ Stop" to halt the process

### Via API

```bash
# Start fixing process
curl -X POST http://localhost:8080/start

# Check status
curl http://localhost:8080/status

# Stop fixing process
curl -X POST http://localhost:8080/stop

# Health check
curl http://localhost:8080/health
```

### Via Docker Compose

```bash
# Start all services
docker-compose -f docker-compose.fixer.yml up

# Run in background
docker-compose -f docker-compose.fixer.yml up -d

# View logs
docker-compose -f docker-compose.fixer.yml logs -f fixer

# Stop services
docker-compose -f docker-compose.fixer.yml down
```

## 🔄 How It Works

1. **Issue Detection Phase**
   - Runs TypeScript compiler (`tsc --noEmit`)
   - Executes ESLint for code quality
   - Runs test suites (`npm test`)
   - Checks Swift compilation
   - Validates Docker builds

2. **Fix Generation Phase**
   - Sends issue context to configured LLM
   - Generates targeted fixes for each issue
   - Falls back to rule-based fixes if LLM unavailable

3. **Application Phase**
   - Creates backup of original files
   - Applies generated fixes
   - Tracks all changes in fix history

4. **Validation Phase**
   - Re-runs all checks to verify fixes
   - Continues iterations if issues remain
   - Stops when all issues resolved or max iterations reached

## 📊 Monitoring

### Dashboard Features

- **Real-time Status**: Current iteration, issues found, fixes applied
- **Progress Bar**: Visual indication of completion
- **Issue List**: All detected problems with status
- **Fix History**: Complete audit trail of changes
- **Live Logs**: Stream of system activity

### Reports

Fix reports are saved to `/reports/` with:
- Total iterations performed
- Successful and failed fixes
- Complete fix history with timestamps
- Backup file locations

## 🛠️ Configuration Options

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `FIX_MODE` | `auto` | Fix mode: `auto`, `manual`, or `interactive` |
| `MAX_ITERATIONS` | `10` | Maximum number of fix attempts |
| `ITERATION_DELAY` | `5` | Seconds to wait between iterations |
| `PARALLEL_FIXES` | `3` | Number of concurrent fixes |
| `AUTO_COMMIT` | `false` | Automatically commit fixes to git |
| `LLM_MODEL` | `gpt-4o` | LLM model to use for fixes |
| `LLM_TEMPERATURE` | `0.2` | LLM creativity (0.0-1.0) |
| `LLM_MAX_TOKENS` | `4000` | Maximum tokens for LLM response |
| `TARGET_DIRECTORY` | `/app` | Directory to scan and fix |
| `SCAN_PATTERNS` | `*.ts,*.tsx,*.js,*.jsx,*.swift,*.py` | File patterns to scan |
| `EXCLUDE_PATTERNS` | `node_modules,dist,build,.git` | Patterns to exclude |

## 🔍 Supported Issue Types

- **TypeScript**: Type errors, missing imports, syntax issues
- **JavaScript/ESLint**: Code quality, unused variables, formatting
- **Python**: Syntax errors, linting issues, type hints
- **Swift**: Compilation errors, SwiftLint violations
- **Docker**: Build failures, configuration issues
- **Tests**: Failing unit tests, integration tests

## 🚨 Troubleshooting

### Fixer won't start
- Check Docker is running: `docker info`
- Verify API keys in `.env` file
- Check port 8080 is available

### No fixes being applied
- Ensure at least one LLM API key is configured
- Check LLM API quotas and rate limits
- Review logs: `docker-compose -f docker-compose.fixer.yml logs fixer`

### Fixes breaking code
- Reduce `LLM_TEMPERATURE` for more conservative fixes
- Enable `AUTO_COMMIT=false` to review changes
- Use backups in fix history to rollback

### Performance issues
- Reduce `PARALLEL_FIXES` to lower resource usage
- Increase `ITERATION_DELAY` to reduce API calls
- Allocate more memory to Docker

## 🔐 Security

- API keys are never logged or exposed
- All fixes create backups before application
- Docker containers run with limited permissions
- Network isolation between services

## 📝 Advanced Usage

### Custom Fix Rules

Add custom rules in `fixer/src/index.js`:

```javascript
generateLocalFix(issue) {
  // Add your custom fix logic here
  if (issue.message.includes('your-pattern')) {
    return {
      issue,
      fixedCode: 'your-fix'
    };
  }
}
```

### Integration with CI/CD

```yaml
# GitHub Actions example
- name: Run Auto Fixer
  run: |
    docker-compose -f docker-compose.fixer.yml up --abort-on-container-exit
    docker-compose -f docker-compose.fixer.yml down
```

### Webhook Notifications

Configure webhooks for fix events:

```bash
curl -X POST http://localhost:8080/webhooks \
  -H "Content-Type: application/json" \
  -d '{"url": "https://your-webhook-url.com"}'
```

## 🤝 Contributing

Contributions are welcome! Please see the main project README for guidelines.

## 📄 License

Part of the Universal AI Tools project. See LICENSE file for details.