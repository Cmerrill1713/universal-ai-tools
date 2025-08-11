import SwiftUI

enum AppTheme {
    static let backgroundGradient = LinearGradient(
        gradient: Gradient(colors: [
            Color.blue.opacity(0.25),
            Color.purple.opacity(0.25)
        ]),
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )

    static let chatUserGradient = LinearGradient(
        gradient: Gradient(colors: [
            Color.blue,
            Color.purple
        ]),
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )

    static let chatAIBubble = Color.gray.opacity(0.15)
    static let inputBackground = Color(.secondarySystemBackground)
    static let separator = Color.black.opacity(0.06)
}


