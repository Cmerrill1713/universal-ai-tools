# Debug SwiftUI Layout

Debug layout and rendering issues in SwiftUI views:

1. **Identify the Issue**
   - Read the view at $ARGUMENTS
   - Look for layout problems, constraint conflicts, or rendering issues

2. **Add Debug Modifiers**
   ```swift
   .border(Color.red, width: 1) // Visualize bounds
   .background(Color.blue.opacity(0.1)) // See actual size
   .overlay(GeometryReader { geometry in
       Text("\(geometry.size.width) x \(geometry.size.height)")
   })
   ```

3. **Check Common Issues**
   - Missing `.frame()` modifiers
   - Incorrect `Spacer()` usage
   - Wrong stack alignment
   - Conflicting constraints
   - Z-order problems with `.zIndex()`

4. **Performance Debugging**
   - Add `Self._printChanges()` in body to track redraws
   - Use `_logChanges()` to see what triggered updates
   - Check for unnecessary `@State` changes
   - Look for expensive computed properties

5. **Memory Debugging**
   - Check for retain cycles in closures
   - Verify `[weak self]` usage
   - Look for leaked observers
   - Ensure proper cleanup in `.onDisappear`

6. **Fix Suggestions**
   - Provide specific solutions for identified issues
   - Recommend optimal layout approach
   - Suggest performance improvements