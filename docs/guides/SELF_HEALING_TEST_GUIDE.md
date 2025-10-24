# Universal AI Tools Self-Healing System Test Guide

## Overview

The Universal AI Tools Self-Healing System Test is a comprehensive testing framework designed to validate and demonstrate the system's ability to automatically detect, analyze, and resolve common operational issues. This system integrates multiple AI-powered improvement mechanisms to create a robust self-healing infrastructure.

## 🎯 What It Tests

### Error Detection & Pattern Recognition

- **Port Conflicts**: Detects `EADDRINUSE` errors, particularly the common port 8766 conflicts with DSPy services
- **Service Failures**: Monitors for connection refused, service unavailable, and DSPy service failures
- **TypeScript Compilation Errors**: Identifies TS compilation issues and module resolution problems
- **Memory Leaks**: Tracks memory usage spikes and out-of-memory conditions
- **Connection Issues**: Monitors database connections, Redis connectivity, and external service availability

### Self-Healing Mechanisms

- **Integrated Self-Improvement System**: Orchestrates all improvement components for comprehensive system evolution
- **Self-Improvement Orchestrator**: Manages improvement cycles and validates changes
- **Alpha Evolve System**: Uses genetic algorithms to evolve system strategies and learn from patterns
- **Health Check Service**: Provides continuous monitoring and health assessment

### Recovery Strategies

- **Port Reallocation**: Automatically finds alternative ports when conflicts occur
- **Service Restart**: Triggers service recovery procedures for failed components
- **Memory Optimization**: Implements garbage collection and resource cleanup
- **Connection Retry**: Handles network and database connectivity issues
- **Pattern Learning**: Records and learns from error patterns to prevent future occurrences

## 🚀 Quick Start

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Supabase account and credentials
- Environment variables configured (`.env` file)

### Basic Usage

```bash
# Run with default settings (10 minutes)
./test-self-healing.sh

# Quick 2-minute test
./test-self-healing.sh --quick

# Extended 30-minute test with detailed monitoring
./test-self-healing.sh --duration 1800 --interval 10 --verbose
```

## 📊 Configuration Options

### Command Line Options

```bash
./test-self-healing.sh [OPTIONS]

Options:
  -d, --duration SECONDS     Test duration in seconds (default: 600)
  -i, --interval SECONDS     Monitoring interval in seconds (default: 5)
  -n, --no-simulation        Disable error simulation
  -l, --log-level LEVEL      Log level: debug, info, warn, error (default: info)
  -q, --quick                Quick test (2 minutes, fast monitoring)
  -v, --verbose              Enable verbose logging
  -h, --help                 Show help message
```

### TypeScript API Configuration

```typescript
const config: TestConfig = {
  monitoringIntervalMs: 5000, // Check every 5 seconds
  improvementCycleIntervalMs: 30000, // Trigger improvements every 30 seconds
  maxTestDurationMs: 600000, // Run for 10 minutes max
  simulateErrors: true, // Enable error simulation
  logLevel: 'info', // Logging level
  reportIntervalMs: 60000, // Report every minute
};
```

## 🔍 Monitoring & Interaction

### Interactive Commands (During Test)

- **`q`** - Quit test gracefully
- **`s`** - Show current status
- **`r`** - Display current report summary

### Real-time Monitoring

The system provides continuous monitoring of:

- System health scores
- Error detection and resolution rates
- Improvement cycle effectiveness
- Resource usage (CPU, memory, disk)
- Service availability

## 📋 Test Reports

### Report Components

1. **Error Analysis**
   - Total errors detected
   - Resolution success rate
   - Average resolution time
   - Error type distribution

2. **Improvement Metrics**
   - Cycles triggered vs completed
   - System health improvements
   - Self-healing effectiveness score

3. **Performance Data**
   - System resource usage
   - Response times
   - Uptime statistics

4. **Recommendations**
   - Proactive monitoring suggestions
   - Resource optimization advice
   - Strategy improvement recommendations

### Sample Report Output

```json
{
  "startTime": "2024-01-15T10:00:00Z",
  "duration": 600000,
  "errorsDetected": 12,
  "errorsResolved": 10,
  "improvementCyclesCompleted": 8,
  "averageResolutionTime": 15000,
  "systemHealthImprovement": 15,
  "selfHealingEffectiveness": 0.85,
  "recommendations": [
    "Consider implementing proactive monitoring for port_conflict errors",
    "High memory process detected - review resource allocation"
  ]
}
```

## 🧪 Error Simulation

### Simulated Error Types

1. **Port Conflict Simulation**

   ```typescript
   // Simulates: EADDRINUSE: address already in use :::8766
   simulatePortConflict();
   ```

2. **Service Failure Simulation**

   ```typescript
   // Simulates: Failed to connect to service: Connection refused
   simulateServiceFailure();
   ```

3. **Memory Spike Simulation**

   ```typescript
   // Simulates: Memory usage critically high: 87.3%
   simulateMemorySpike();
   ```

4. **Connection Error Simulation**
   ```typescript
   // Simulates: Database connection timeout after 30s
   simulateConnectionError();
   ```

### Disabling Simulation

```bash
# Run without error simulation (monitor real issues only)
./test-self-healing.sh --no-simulation
```

## 🔧 Self-Healing Strategies

### Port Conflict Resolution

```typescript
// 1. Detect port conflict
detectError('port_conflict', 'high', 'EADDRINUSE: port 8766', source, null, { port: 8766 });

// 2. Find alternative port
const alternativePorts = [3001, 3002, 3003, 8001, 8002, 8003];

// 3. Trigger system adaptation
await improvementOrchestrator.runImprovementCycle();
```

### Service Failure Recovery

```typescript
// 1. Detect service failure
detectError('service_failure', 'critical', 'DSPy service unavailable', 'dspy');

// 2. Trigger multiple recovery strategies
await Promise.allSettled([
  improvementOrchestrator.runImprovementCycle(),
  integratedSystem.forceImprovement(['improve-service-reliability']),
  alphaEvolve.learnFromPattern('service_failure_dspy', context, outcome),
]);

// 3. Validate recovery
setTimeout(() => checkServiceRecovery(errorId), 10000);
```

### Memory Optimization

```typescript
// 1. Detect memory issue
detectError('memory_leak', 'high', 'Memory usage: 87.3%', 'memory_monitor');

// 2. Apply immediate fixes
if (global.gc) global.gc(); // Force garbage collection

// 3. Trigger optimization
await integratedSystem.forceImprovement(['reduce-memory-resource-usage']);

// 4. Learn from pattern
await alphaEvolve.learnFromPattern('memory_usage_high', context, outcome);
```

## 📁 File Structure

```
universal-ai-tools/
├── scripts/
│   └── test-self-healing-system.ts    # Main test orchestrator
├── test-self-healing.sh               # Shell script runner
├── SELF_HEALING_TEST_GUIDE.md        # This documentation
├── logs/                              # Generated logs and reports
│   ├── self-healing-report-*.json    # Periodic reports
│   ├── self-healing-final-report-*.json # Final test report
│   ├── test-execution-*.log          # Test execution logs
│   └── system-monitor.log            # System resource monitoring
└── src/
    ├── core/
    │   ├── self-improvement/
    │   │   ├── integrated-self-improvement-system.ts
    │   │   └── self-improvement-orchestrator.ts
    │   └── evolution/
    │       └── alpha-evolve-system.ts
    └── services/
        └── health-check.ts
```

## 🔑 Environment Setup

### Required Environment Variables

```bash
# .env file
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Optional
REDIS_URL=redis://localhost:6379
DATABASE_URL=postgresql://...
```

### Database Tables

The system requires these Supabase tables:

- `ai_agents` - Agent configurations
- `ai_learning_patterns` - Learned patterns
- `ai_evolution_strategies` - Evolution strategies
- `ai_learning_milestones` - Improvement milestones
- `ai_improvement_suggestions` - Improvement records
- `system_improvement_snapshots` - System state snapshots
- `system_improvement_plans` - Improvement plans

## 🎛️ Advanced Usage

### Programmatic Usage

```typescript
import { SelfHealingTestOrchestrator } from './scripts/test-self-healing-system';

const orchestrator = new SelfHealingTestOrchestrator({
  monitoringIntervalMs: 3000,
  maxTestDurationMs: 300000, // 5 minutes
  simulateErrors: false,
  logLevel: 'debug',
});

// Event handling
orchestrator.on('test-started', (data) => {
  console.log('Test started:', data.startTime);
});

orchestrator.on('healing-event', (event) => {
  console.log('Healing event:', event.type, event.details);
});

orchestrator.on('test-completed', (report) => {
  console.log('Test completed. Effectiveness:', report.selfHealingEffectiveness);
});

// Start test
await orchestrator.startTest();

// Get real-time status
const status = await orchestrator.getSystemStatus();
console.log('Current status:', status);

// Stop test manually
const finalReport = await orchestrator.stopTest();
```

### Custom Error Detection

```typescript
// Add custom error patterns
const customPatterns = {
  apiTimeout: /API.*timeout.*(\d+)ms/gi,
  rateLimit: /(rate.limit|429|too.many.requests)/gi,
  diskFull: /(no.space|disk.full|ENOSPC)/gi,
};

// Extend the orchestrator
class CustomSelfHealingOrchestrator extends SelfHealingTestOrchestrator {
  protected async analyzeLogContent(content: string, source: string): Promise<void> {
    await super.analyzeLogContent(content, source);

    // Custom pattern detection
    const apiTimeouts = content.match(customPatterns.apiTimeout);
    if (apiTimeouts) {
      this.detectError('connection_error', 'medium', 'API timeout detected', source);
    }
  }
}
```

## 📈 Performance Metrics

### Key Performance Indicators

- **Error Detection Rate**: Percentage of actual errors detected
- **Resolution Success Rate**: Percentage of detected errors successfully resolved
- **Mean Time to Detection (MTTD)**: Average time from error occurrence to detection
- **Mean Time to Resolution (MTTR)**: Average time from detection to resolution
- **System Health Improvement**: Percentage improvement in overall system health
- **False Positive Rate**: Percentage of detected "errors" that weren't actual issues

### Benchmark Targets

- Error Detection Rate: > 90%
- Resolution Success Rate: > 80%
- MTTD: < 30 seconds
- MTTR: < 2 minutes
- System Health Improvement: > 10%
- False Positive Rate: < 5%

## 🚨 Troubleshooting

### Common Issues

1. **Supabase Connection Failed**

   ```
   Error: Supabase credentials not found
   ```

   **Solution**: Ensure `.env` file contains valid `SUPABASE_URL` and `SUPABASE_ANON_KEY`

2. **TypeScript Compilation Errors**

   ```
   Error: Cannot find module 'tsx'
   ```

   **Solution**: Install tsx globally: `npm install -g tsx`

3. **Permission Denied**

   ```
   Error: Permission denied: ./test-self-healing.sh
   ```

   **Solution**: Make script executable: `chmod +x test-self-healing.sh`

4. **Port Already in Use**
   ```
   Error: EADDRINUSE: address already in use
   ```
   **Solution**: This is expected during testing - the system should detect and resolve it

### Debug Mode

```bash
# Enable debug logging
./test-self-healing.sh --log-level debug --verbose

# Monitor system resources
tail -f logs/system-monitor.log

# Watch test execution in real-time
tail -f logs/test-execution-*.log
```

### Manual Verification

```bash
# Check if services are running
ps aux | grep -E "(node|npm|tsx)"

# Check port usage
lsof -i :8766 -i :3000 -i :5432

# Monitor memory usage
top -o mem

# Check disk space
df -h
```

## 🔄 Integration with CI/CD

### GitHub Actions Example

```yaml
name: Self-Healing System Test

on:
  schedule:
    - cron: '0 */6 * * *' # Every 6 hours
  workflow_dispatch:

jobs:
  self-healing-test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Run self-healing test
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
        run: |
          ./test-self-healing.sh --duration 300 --no-simulation

      - name: Upload test reports
        uses: actions/upload-artifact@v3
        with:
          name: self-healing-reports
          path: logs/*.json
```

## 📚 Additional Resources

### Related Documentation

- [Integrated Self-Improvement System](src/core/self-improvement/integrated-self-improvement-system.ts)
- [Self-Improvement Orchestrator](src/core/self-improvement/self-improvement-orchestrator.ts)
- [Alpha Evolve System](src/core/evolution/alpha-evolve-system.ts)
- [Health Check Service](src/services/health-check.ts)

### Academic Background

The self-healing system is based on principles from:

- Autonomic Computing (IBM's MAPE-K loop)
- Genetic Algorithms for System Optimization
- Machine Learning for Pattern Recognition
- Circuit Breaker Pattern for Fault Tolerance

### Contributing

To contribute to the self-healing system:

1. Fork the repository
2. Create a feature branch
3. Add tests for new error types or healing strategies
4. Submit a pull request with detailed description

---

## 🎉 Conclusion

The Universal AI Tools Self-Healing System represents a significant advancement in autonomous system management. By combining multiple AI-powered improvement mechanisms with comprehensive monitoring and intelligent error recovery, the system can maintain high availability and performance even under adverse conditions.

Regular testing with this framework ensures that your self-healing capabilities remain effective and can adapt to new types of issues as they emerge. The system learns from each test run, continuously improving its ability to detect and resolve problems before they impact users.

For support or questions, please refer to the project documentation or create an issue in the repository.
