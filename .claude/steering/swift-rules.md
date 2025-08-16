# Swift Development Rules

## Compiler Error Handling

When you encounter "The compiler is unable to type-check this expression in reasonable time":
1. IMMEDIATELY extract the view body into smaller @ViewBuilder computed properties
2. Break complex expressions into separate variables
3. Avoid inline closures in view builders - extract them to methods
4. Use explicit type annotations when type inference is struggling

## SwiftUI Best Practices

### View Composition
- Keep view bodies under 50 lines
- Extract repeated UI patterns into reusable components
- Use @ViewBuilder for conditional content
- Prefer computed properties over functions for subviews

### State Management
- Use @State for view-local state only
- Use @StateObject for reference types owned by the view
- Use @ObservedObject for reference types passed in
- Use @EnvironmentObject sparingly for true app-wide state
- Prefer @Observable (iOS 17+) over ObservableObject

### Performance
- Use .equatable() on views with expensive equality checks
- Implement .id() for list items to control identity
- Use .drawingGroup() for complex graphics
- Avoid AnyView - use @ViewBuilder instead
- Use LazyVStack/LazyHStack for long lists

## Async/Await Patterns

### Task Management
```swift
// Good - Cancellable task
private var loadingTask: Task<Void, Never>?

func load() {
    loadingTask?.cancel()
    loadingTask = Task {
        // async work
    }
}
```

### MainActor Usage
```swift
// Update UI on main thread
await MainActor.run {
    self.items = newItems
}
```

### Error Handling
```swift
do {
    let result = try await service.fetch()
    // handle success
} catch {
    // handle specific errors
    await MainActor.run {
        self.errorMessage = error.localizedDescription
    }
}
```

## Common Pitfalls to Avoid

1. **Force unwrapping**: Never use `!` except in truly impossible cases
2. **Retain cycles**: Use `[weak self]` in closures
3. **Blocking main thread**: Always use async/await for I/O
4. **Massive view files**: Break into smaller components
5. **Ignoring accessibility**: Always add labels and hints
6. **Hard-coded strings**: Use localized strings or constants
7. **Missing error handling**: Always handle errors gracefully
8. **Synchronous network calls**: Always use async/await

## Testing Requirements

- Write tests for all public methods
- Mock external dependencies
- Test error conditions
- Use XCTestExpectation for async tests
- Aim for >80% code coverage
- Include UI tests for critical flows

## Code Organization

### File Structure
```swift
// MARK: - Properties
// MARK: - Body  
// MARK: - Subviews
// MARK: - Methods
// MARK: - Preview
```

### Naming Conventions
- Views: `SomethingView`
- View Models: `SomethingViewModel` or use @Observable
- Services: `SomethingService`
- Managers: `SomethingManager`
- Models: Plain names like `User`, `Message`

## Swift 6 Features

- Use structured concurrency (async/await)
- Implement actors for thread-safe services
- Use `@MainActor` for UI updates
- Leverage Swift macros where appropriate
- Use primary associated types in protocols

## Memory Management

- Use `weak` for delegates and callbacks
- Avoid retain cycles in closures
- Clean up observers in `deinit`
- Cancel tasks when views disappear
- Use `@StateObject` for view-owned objects

## Debugging Tips

- Use `dump()` for detailed object inspection
- Add `.border(Color.red)` to debug layout issues
- Use `.background(Color.random)` to visualize view bounds
- Enable "Debug View Hierarchy" in Xcode
- Use Memory Graph Debugger for retain cycles