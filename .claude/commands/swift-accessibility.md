# Add SwiftUI Accessibility

Enhance $ARGUMENTS with comprehensive accessibility support:

1. Add VoiceOver labels to all interactive elements:
   ```swift
   .accessibilityLabel("Descriptive label")
   ```
2. Provide hints for complex interactions:
   ```swift
   .accessibilityHint("Double tap to perform action")
   ```
3. Group related elements:
   ```swift
   .accessibilityElement(children: .combine)
   ```
4. Add traits for custom controls:
   ```swift
   .accessibilityAddTraits(.isButton)
   ```
5. Support Dynamic Type:
   ```swift
   .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
   ```
6. Implement keyboard navigation:
   - Add .focusable() to interactive elements
   - Handle keyboard shortcuts
   - Support Tab navigation
7. Test with VoiceOver enabled
8. Ensure contrast ratios meet WCAG 2.1 Level AA standards
9. Add accessibility identifiers for UI testing