# SwiftUI Best Practices for Universal AI Tools

## Overview
This document outlines critical best practices to prevent recurring SwiftUI compilation and runtime issues in the Universal AI Tools macOS application.

## ✅ FIXES IMPLEMENTED

### 1. State Management
- **ISSUE**: TTSService not accessible in scope
- **FIX**: Use `@StateObject` instead of `@State` for objects
- **PATTERN**:
```swift
@StateObject private var service: SomeService
init() {
    self._service = StateObject(wrappedValue: SomeService())
}
```

### 2. Publishing Changes Error
- **ISSUE**: "Publishing changes from within view updates"
- **FIX**: Defer state changes with DispatchQueue
- **PATTERN**:
```swift
set: { newValue in
    DispatchQueue.main.async {
        appState.selectedSidebarItem = newValue
    }
}
```

### 3. Performance Tracking
- **ISSUE**: Synchronous operations in view lifecycles
- **FIX**: Wrap operations in `Task { @MainActor in }`

## 🛡️ PREVENTIVE MEASURES

### State Management Rules
1. **Use @StateObject** for services and complex objects
2. **Use @State** only for simple value types
3. **Use @ObservedObject** for injected dependencies
4. **Always defer state updates** that might trigger view updates

### View Architecture Patterns
1. **Dependency Injection**: Pass services through environment objects
2. **Error Boundaries**: Wrap async operations in Task blocks
3. **Performance**: Use `.safeStateUpdates()` modifier for complex views

### Code Organization
1. **Services**: Keep in separate files with proper access control
2. **Views**: Split complex views into smaller components
3. **State**: Centralize state management in AppState

## 🔧 DEBUGGING TECHNIQUES

### Common Error Patterns
- `Cannot find type 'X' in scope` → Missing import or incorrect access
- `Publishing changes from within view updates` → State change in view cycle
- Performance warnings → Use Task { @MainActor in } wrapper

### Quick Fixes
- Build clean: `cmd+shift+k`
- Clear derived data: Delete ~/Library/Developer/Xcode/DerivedData
- Check target membership for all Swift files

## 📊 VERIFICATION CHECKLIST

Before committing SwiftUI changes:
- [ ] Build succeeds without warnings
- [ ] App launches without runtime errors
- [ ] No "Publishing changes" warnings in console
- [ ] All services properly injected via environment objects
- [ ] State updates wrapped in proper async contexts

## 🚀 PERFORMANCE OPTIMIZATIONS

1. Use `.trackPerformance()` modifier for monitoring
2. Implement `.safeStateUpdates()` for complex state changes
3. Defer heavy operations to background queues
4. Cache expensive view computations

## 🔮 FUTURE CONSIDERATIONS

1. Migrate to Observable macro when iOS 17+ is minimum target
2. Implement SwiftUI debugging tools
3. Add automated testing for view state changes
4. Consider view model pattern for complex business logic

---

**Last Updated**: 2025-01-14
**Verified Build**: Universal AI Tools v1.0 (macOS 14.0+)