# Agent Coordination & Testing Guidelines

## Critical Issues Identified
1. **No Testing Verification**: Agents create code without running tests
2. **Missing File Creation**: Agents report creating files but don't actually create them
3. **No Handoff Protocol**: No clear way to pass context between agents
4. **No Validation**: No automated checks before marking tasks complete

## Agent Coordination Protocol

### 1. Task Assignment Rules

#### Pre-Task Checklist
```yaml
before_starting:
  - Read CLAUDE.md for project context
  - Check existing implementations (don't duplicate)
  - List files that will be created/modified
  - Define success criteria
  - Identify testing requirements
```

#### Task Execution Requirements
```yaml
during_task:
  - Use TodoWrite to track progress
  - Actually create/modify files (use Write/Edit tools)
  - Run tests after implementation
  - Verify files exist with Bash ls commands
  - Check build status
  - Document any issues encountered
```

#### Post-Task Validation
```yaml
after_completion:
  - Run relevant tests (MANDATORY)
  - Verify all files exist
  - Check compilation/build
  - Update documentation if needed
  - Create handoff summary
```

### 2. Testing Requirements

#### For TypeScript/JavaScript
```bash
# MANDATORY after code changes
npm run lint:fix
npm run build:ts
npm test -- --related <modified_files>
```

#### For Swift/iOS Development
```bash
# MANDATORY after Swift changes
# Build for simulator
mcp__XcodeBuildMCP__build_sim({
  workspacePath: "/path/to/workspace",
  scheme: "AppScheme",
  simulatorName: "iPhone 16"
})

# Run tests
mcp__XcodeBuildMCP__test_sim({
  workspacePath: "/path/to/workspace",
  scheme: "AppScheme",
  simulatorName: "iPhone 16"
})

# Verify app launches
mcp__XcodeBuildMCP__launch_app_sim({
  simulatorUuid: "UUID",
  bundleId: "com.example.app"
})
```

#### For Rust
```bash
# MANDATORY after Rust changes
cargo check
cargo test
cargo build --release
```

#### For Go
```bash
# MANDATORY after Go changes
go test ./...
go build ./...
go vet ./...
```

### 3. File Creation Verification

**NEVER** assume a file was created. Always verify:

```bash
# After using Write tool
ls -la /path/to/new/file.ext

# After creating multiple files
find . -name "*.swift" -newer /tmp/timestamp

# Verify file content
head -20 /path/to/file.ext
```

### 4. Agent Handoff Protocol

When passing work between agents or sessions:

```yaml
handoff_summary:
  completed:
    - List of completed tasks with file paths
    - Test results (pass/fail)
    - Build status
  
  in_progress:
    - Current task status
    - Files being modified
    - Blockers encountered
  
  next_steps:
    - Prioritized task list
    - Dependencies needed
    - Testing requirements
  
  context:
    - Key decisions made
    - Architecture choices
    - Known issues
```

### 5. Swift Companion App Specific Rules

For the Universal AI Tools companion app:

```yaml
swift_app_requirements:
  structure:
    - UniversalAITools.xcworkspace (workspace)
    - UniversalAIToolsPackage/ (SPM package with features)
    - UniversalAITools/ (app target)
    
  before_implementation:
    - Check if workspace exists
    - Verify package structure
    - List existing Swift files
    
  implementation:
    - Create files in correct locations
    - Use @Observable for state management
    - Implement in Package/Sources not app target
    - Add proper imports
    
  testing:
    - Build for simulator
    - Run unit tests
    - Launch app and verify
    - Take screenshot for validation
    
  authentication_features:
    - Bluetooth proximity detection
    - Apple Watch integration
    - Biometric authentication
    - Secure token exchange
```

## Automated Validation System

### Pre-Commit Hooks

```javascript
// .husky/pre-commit
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Check for missing files referenced in code
node scripts/verify-file-references.js

# Run tests for changed files
npm run test:changed

# Verify Swift files if changed
if git diff --cached --name-only | grep -q "\.swift$"; then
  swift test
fi

# Check for TODO/FIXME markers
git diff --cached | grep -E "(TODO|FIXME|XXX)" && echo "Warning: TODO markers found"
```

### Continuous Validation

```javascript
// scripts/agent-validator.js
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class AgentValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
  }

  validateFileCreation(filePath) {
    if (!fs.existsSync(filePath)) {
      this.errors.push(`File not created: ${filePath}`);
      return false;
    }
    
    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      this.warnings.push(`Empty file created: ${filePath}`);
    }
    
    return true;
  }

  validateTests(testPattern) {
    try {
      const result = execSync(`npm test -- ${testPattern}`, { 
        encoding: 'utf8',
        stdio: 'pipe' 
      });
      return result.includes('PASS');
    } catch (error) {
      this.errors.push(`Tests failed: ${error.message}`);
      return false;
    }
  }

  validateSwiftBuild(workspacePath) {
    try {
      execSync(`xcodebuild -workspace ${workspacePath} -scheme UniversalAITools -destination 'platform=iOS Simulator,name=iPhone 16' build`, {
        encoding: 'utf8',
        stdio: 'pipe'
      });
      return true;
    } catch (error) {
      this.errors.push(`Swift build failed: ${error.message}`);
      return false;
    }
  }

  generateReport() {
    return {
      timestamp: new Date().toISOString(),
      errors: this.errors,
      warnings: this.warnings,
      success: this.errors.length === 0
    };
  }
}

module.exports = AgentValidator;
```

## Testing Checklist Template

```markdown
## Testing Checklist for [Feature/Task Name]

### Pre-Implementation
- [ ] Read existing code
- [ ] Check for duplicates
- [ ] Define test cases

### Implementation
- [ ] Files created successfully
- [ ] Code follows conventions
- [ ] No syntax errors

### Testing
- [ ] Unit tests written
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Build succeeds
- [ ] Manual testing completed

### Swift/iOS Specific
- [ ] Builds for simulator
- [ ] Launches without crash
- [ ] UI renders correctly
- [ ] Features work as expected
- [ ] Accessibility tested

### Documentation
- [ ] Code commented
- [ ] README updated
- [ ] API docs updated

### Handoff
- [ ] All files committed
- [ ] Tests passing
- [ ] Known issues documented
- [ ] Next steps defined
```

## Common Failure Patterns to Avoid

1. **"I've created the file"** - Always verify with `ls`
2. **"Tests should pass"** - Actually run them
3. **"The build will work"** - Build it and check
4. **"I've implemented X"** - Show the actual code
5. **"It's ready to use"** - Prove it works

## Enforcement

These guidelines are MANDATORY. Any agent that:
- Doesn't run tests after code changes
- Doesn't verify file creation
- Marks tasks complete without validation

Will be considered to have FAILED the task.

## Quick Reference Commands

```bash
# TypeScript/Node.js
npm run lint:fix && npm run build:ts && npm test

# Swift
swift build && swift test

# Rust
cargo check && cargo test && cargo build

# Go
go test ./... && go build ./...

# Verify files
ls -la path/to/files/
find . -name "pattern" -newer timestamp

# Check processes
ps aux | grep [process]
lsof -i :port

# Git verification
git status
git diff --cached
```

Remember: **TRUST BUT VERIFY** - Always validate your work!