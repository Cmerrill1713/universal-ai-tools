# Universal AI Tools - UAT Testing Guide

## 🎯 Overview

This guide provides comprehensive instructions for User Acceptance Testing (UAT) of the Universal AI Tools macOS application. The testing framework includes automated test suites, performance benchmarks, debug overlays, and CI/CD integration.

## 📋 Testing Components

### 1. Test Suites
- **UATTestSuite.swift** - Main UAT scenarios covering user workflows
- **PerformanceTests.swift** - Performance benchmarks and stress tests
- **TestDataFactory.swift** - Mock data generation for consistent testing

### 2. Debug Tools
- **DebugOverlay.swift** - Real-time debugging interface
- **DebugConsole.swift** - Logging and state inspection

### 3. Automation
- **run-uat-tests.sh** - Automated test runner script
- **UniversalAITools.xctestplan** - Test plan with multiple configurations
- **uat-tests.yml** - GitHub Actions CI/CD workflow

## 🚀 Quick Start

### Prerequisites
- macOS 12.0 or later
- Xcode 15.0 or later
- Node.js 18+ (for backend)
- Universal AI Tools backend running

### Running Tests Locally

```bash
# Navigate to project directory
cd macOS-App/UniversalAITools

# Run full UAT suite
./Tests/run-uat-tests.sh UAT-Full

# Run smoke tests only
./Tests/run-uat-tests.sh UAT-Smoke

# Run with debug mode
./Tests/run-uat-tests.sh UAT-Debug
```

### Available Test Configurations

| Configuration | Description | Duration | Use Case |
|---------------|-------------|----------|----------|
| **UAT-Full** | Complete test suite with all scenarios | ~10 min | Pre-release validation |
| **UAT-Smoke** | Essential functionality tests | ~2 min | Quick verification |
| **UAT-Accessibility** | WCAG 2.1 compliance testing | ~5 min | Accessibility validation |
| **UAT-Performance** | Performance benchmarks and stress tests | ~15 min | Performance regression |
| **UAT-Debug** | Interactive debugging with detailed logging | Variable | Development debugging |

## 📊 Test Scenarios

### Core User Workflows

#### 1. First-Time User Onboarding
- **Objective**: Verify new user setup process
- **Steps**:
  1. Launch app for first time
  2. Complete welcome wizard
  3. Set up initial preferences
  4. Verify default configuration
- **Success Criteria**: User can complete setup within 2 minutes

#### 2. Basic Chat Workflow
- **Objective**: Test core chat functionality
- **Steps**:
  1. Navigate to chat interface
  2. Send text message
  3. Receive AI response
  4. Verify message history
- **Success Criteria**: Messages sent/received within 3 seconds

#### 3. Agent Management
- **Objective**: Test agent selection and task assignment
- **Steps**:
  1. Open agent selector
  2. Browse available agents
  3. Assign task to agent
  4. Monitor task progress
- **Success Criteria**: Agents respond and complete tasks correctly

#### 4. 3D Knowledge Graph Interaction
- **Objective**: Test 3D visualization and navigation
- **Steps**:
  1. Open knowledge graph view
  2. Navigate 3D space (rotate, zoom, pan)
  3. Select and inspect nodes
  4. Verify graph updates
- **Success Criteria**: Smooth 3D interaction with 30+ FPS

#### 5. Voice Command Integration
- **Objective**: Test voice input functionality
- **Steps**:
  1. Enable voice commands
  2. Speak command
  3. Verify speech recognition
  4. Confirm action execution
- **Success Criteria**: 95%+ voice recognition accuracy

### Performance Testing

#### Memory Usage
- Maximum memory increase: 200MB under load
- Memory cleanup: 90% release after operations
- No memory leaks during extended usage

#### Response Times
- Chat messages: < 3 seconds
- Agent responses: < 5 seconds
- UI interactions: < 100ms
- 3D graph rendering: 30+ FPS

#### Stress Testing
- 1000+ concurrent messages
- 500+ 3D graph nodes
- 50+ active agents
- 1 hour continuous usage

### Accessibility Testing

#### WCAG 2.1 Compliance
- **Level A**: Full compliance required
- **Level AA**: Full compliance required
- **Level AAA**: Best effort (color contrast)

#### Test Areas
- Keyboard navigation
- Screen reader support
- Focus management
- ARIA labels and roles
- Color contrast ratios
- Text scaling (up to 200%)
- Motion preferences

## 🛠 Debug Tools Usage

### Debug Overlay

The debug overlay provides real-time monitoring during testing:

```swift
// Automatically enabled in debug builds
#if DEBUG
// Overlay appears in top-right corner
#endif

// Manual activation via environment variable
ENABLE_DEBUG_CONSOLE=true
```

#### Features
- **Performance Metrics**: CPU, memory, FPS, network
- **State Inspection**: App state, feature flags, preferences
- **Network Monitoring**: Request/response times, error rates
- **Real-time Logs**: Filterable log entries with timestamps
- **Test Actions**: Simulate load, network failures, memory warnings

### Debug Console

Access via keyboard shortcut: `Cmd+Shift+D`

#### Log Levels
- **Error**: Critical issues requiring attention
- **Warning**: Potential issues to investigate
- **Info**: General information and status updates
- **Debug**: Detailed debugging information

## 📈 Performance Baselines

### Current Baselines
- **Launch Time**: < 2 seconds cold start
- **Memory Usage**: < 150MB baseline
- **Frame Rate**: 60 FPS target
- **API Response**: < 200ms average

### Regression Thresholds
- Launch time: +20% maximum
- Memory usage: +30% maximum
- Frame rate: -15% maximum
- Response time: +50% maximum

## 🔄 CI/CD Integration

### GitHub Actions Workflow

Tests run automatically on:
- Push to main/develop branches
- Pull requests
- Nightly schedule (2 AM UTC)
- Manual dispatch

### Artifacts Generated
- Test results (XCTest format)
- HTML reports
- Code coverage reports
- Performance metrics
- Screenshots on failure

### Notifications
- PR comments with test results
- Slack notifications (if configured)
- Email alerts for failures

## 📝 Test Reporting

### HTML Reports
Generated automatically with:
- Test execution summary
- Performance metrics
- Error details and screenshots
- Trend analysis

### JUnit XML
For CI/CD integration:
- Jenkins compatible
- Azure DevOps compatible
- GitHub Actions compatible

### Performance Trends
- Historical baseline comparison
- Regression detection
- Performance improvement tracking

## 🐛 Troubleshooting

### Common Issues

#### Backend Not Running
```bash
# Start backend server
cd /path/to/universal-ai-tools
npm run dev
```

#### Xcode Build Errors
```bash
# Clean build folder
xcodebuild clean

# Reset package cache
rm -rf ~/Library/Developer/Xcode/DerivedData
```

#### Test Failures
1. Check backend connectivity
2. Verify test data setup
3. Review debug logs
4. Check system resources

### Debug Environment Variables

```bash
# Enable verbose logging
export VERBOSE_LOGGING=true

# Disable animations for testing
export DISABLE_ANIMATIONS=true

# Mock network responses
export MOCK_NETWORK=true

# Enable performance profiling
export ENABLE_PROFILING=true
```

## 📚 Best Practices

### Test Development
1. Use TestDataFactory for consistent mock data
2. Clean up state between tests
3. Use meaningful assertions with descriptive messages
4. Test both success and failure scenarios

### Performance Testing
1. Establish baselines early
2. Test under realistic load conditions
3. Monitor memory usage patterns
4. Profile critical code paths

### Accessibility Testing
1. Test with actual assistive technologies
2. Verify keyboard-only navigation
3. Check color contrast in all themes
4. Test with screen magnification

### Debug Testing
1. Use debug overlay for real-time monitoring
2. Capture state snapshots for complex issues
3. Monitor performance during testing
4. Document unusual behavior

## 🎯 Success Criteria

### Must Pass
- All UAT scenarios complete successfully
- No performance regressions > 20%
- WCAG 2.1 AA compliance
- Zero critical bugs
- Memory usage within limits

### Quality Gates
- Test coverage > 80%
- Performance tests pass baseline
- Accessibility audit score > 95%
- No memory leaks detected
- All automated tests pass

## 📞 Support

For testing issues or questions:
1. Check this documentation
2. Review debug logs
3. Search existing issues
4. Create new issue with detailed information

## 🔄 Updates

This guide is updated with each release. Check the latest version at:
`/Tests/UAT_TESTING_GUIDE.md`

---

*Last updated: December 2024*
*Version: 1.0.0*