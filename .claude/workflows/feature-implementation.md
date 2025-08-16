# Feature Implementation Workflow

Follow this workflow when implementing a new feature:

## 1. Understanding Phase
- [ ] Read the feature requirements carefully
- [ ] Identify which existing components can be reused
- [ ] Review similar features in the codebase for patterns
- [ ] Check the API documentation for backend endpoints

## 2. Planning Phase
- [ ] Break down the feature into components:
  - Data models
  - Services/API calls
  - Views and UI components
  - State management
- [ ] Identify dependencies and integration points
- [ ] Plan the testing strategy

## 3. Implementation Phase

### 3.1 Create Data Models
```swift
// Create models in Models/ directory
struct FeatureName: Codable, Identifiable {
    let id: String
    // properties
}
```

### 3.2 Implement Service Layer
- Use the service-actor template
- Implement API calls with proper error handling
- Add retry logic and caching where appropriate

### 3.3 Create View Model
- Use @Observable for iOS 17+
- Implement business logic
- Handle loading states and errors

### 3.4 Build UI Components
- Start with basic layout
- Add interactivity
- Implement animations
- Add accessibility

### 3.5 Integration
- Connect view to view model
- Wire up navigation
- Add to main app structure

## 4. Testing Phase
- [ ] Write unit tests for models
- [ ] Write unit tests for view models
- [ ] Test service layer with mocked responses
- [ ] Add UI tests for critical paths
- [ ] Manual testing on device

## 5. Polish Phase
- [ ] Optimize performance (profile with Instruments)
- [ ] Enhance animations and transitions
- [ ] Verify accessibility with VoiceOver
- [ ] Test on different window sizes
- [ ] Review with dark mode

## 6. Documentation
- [ ] Add inline documentation for public APIs
- [ ] Update README if needed
- [ ] Document any special setup requirements
- [ ] Add usage examples in previews

## 7. Code Review Checklist
- [ ] No force unwrapping
- [ ] Proper error handling
- [ ] No memory leaks
- [ ] Follows project conventions
- [ ] Tests pass
- [ ] Accessibility implemented
- [ ] Performance acceptable

## Common Commands
```bash
# Build and test
xcodebuild -scheme UniversalAITools test

# Run SwiftLint
swiftlint

# Generate documentation
swift-doc generate Sources/ --module-name UniversalAITools
```