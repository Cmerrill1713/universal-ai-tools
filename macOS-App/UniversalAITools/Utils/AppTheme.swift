import SwiftUI

// MARK: - App Theme
struct AppTheme {
    // Primary Colors
    static let accentOrange = Color.orange
    static let accentBlue = Color.blue
    static let accentPurple = Color.purple
    
    // UI Colors
    static let separator = Color.gray.opacity(0.3)
    static let background = Color.black.opacity(0.05)
    static let cardBackground = Color.white.opacity(0.1)
    
    // Gradients
    static let primaryGradient = LinearGradient(
        colors: [accentOrange, accentBlue],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )
    
    static let backgroundGradient = RadialGradient(
        colors: [
            Color.blue.opacity(0.1),
            Color.purple.opacity(0.05),
            Color.black.opacity(0.1)
        ],
        center: .center,
        startRadius: 100,
        endRadius: 500
    )
}

// MARK: - View Extensions
extension View {
    func glow(color: Color, radius: CGFloat) -> some View {
        self
            .shadow(color: color.opacity(0.6), radius: radius)
            .shadow(color: color.opacity(0.3), radius: radius * 2)
    }
}

// MARK: - Animated Gradient Background
struct AnimatedGradientBackground: View {
    @State private var animateGradient = false
    
    var body: some View {
        LinearGradient(
            colors: [
                Color.blue.opacity(0.1),
                Color.purple.opacity(0.05),
                Color.orange.opacity(0.08),
                Color.black.opacity(0.1)
            ],
            startPoint: animateGradient ? .topLeading : .bottomLeading,
            endPoint: animateGradient ? .bottomTrailing : .topTrailing
        )
        .onAppear {
            withAnimation(.easeInOut(duration: 3.0).repeatForever(autoreverses: true)) {
                animateGradient.toggle()
            }
        }
    }
}
