# Xcode Build Commands

Execute Xcode build and test commands for the project:

## Build Commands

```bash
# Clean build folder
xcodebuild clean -scheme UniversalAITools

# Build for debugging
xcodebuild -scheme UniversalAITools -configuration Debug build

# Build for release
xcodebuild -scheme UniversalAITools -configuration Release build

# Build and analyze
xcodebuild -scheme UniversalAITools analyze
```

## Test Commands

```bash
# Run all tests
xcodebuild test -scheme UniversalAITools

# Run specific test class
xcodebuild test -scheme UniversalAITools -only-testing:UniversalAIToolsTests/ExampleTests

# Generate code coverage
xcodebuild test -scheme UniversalAITools -enableCodeCoverage YES
```

## Useful Options

- `-derivedDataPath ./DerivedData` - Custom derived data location
- `-quiet` - Less verbose output
- `-parallel-testing-enabled YES` - Run tests in parallel
- `-maximum-concurrent-test-device-destinations 2` - Limit parallel tests

Check build logs for warnings and errors, fix any issues found.