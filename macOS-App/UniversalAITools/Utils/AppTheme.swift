// This file is no longer needed because `AppTheme` is defined in `Utils/Theme.swift`.
// Keeping it as a small extension point for view helpers only, to avoid duplicate symbol definitions.
import SwiftUI

extension View {
    func applyCardStyle() -> some View {
        self
            .background(Color(NSColor.controlBackgroundColor))
            .cornerRadius(8)
            .shadow(color: Color.black.opacity(0.2), radius: 4, x: 0, y: 2)
    }

    func applyPrimaryButtonStyle() -> some View {
        self.buttonStyle(.borderedProminent).controlSize(.regular)
    }

    func applySecondaryButtonStyle() -> some View {
        self.buttonStyle(.bordered).controlSize(.regular)
    }

    func applyDestructiveButtonStyle() -> some View {
        self.buttonStyle(.bordered).tint(.red)
    }
}
