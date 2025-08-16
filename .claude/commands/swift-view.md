# Create SwiftUI View

Create a new SwiftUI view following our project conventions:

1. Read the existing view structure in Views/Components/ to understand our patterns
2. Create a new SwiftUI view named $ARGUMENTS with:
   - Proper MARK comments for organization
   - @State and @Environment properties as needed
   - Extracted subviews using @ViewBuilder computed properties
   - Accessibility labels and hints
   - SF Symbols for icons
   - Preview provider with multiple states
3. Follow our MVVM pattern if the view needs business logic
4. Ensure the view is responsive and works with different window sizes
5. Add appropriate animations and transitions
6. Test with VoiceOver enabled