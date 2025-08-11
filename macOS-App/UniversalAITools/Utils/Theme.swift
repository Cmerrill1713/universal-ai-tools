import SwiftUI

enum AppTheme {
    // MARK: - Core Colors (ChatGPT-inspired)
    static let primaryBackground = Color(hex: "343541") // Dark charcoal
    static let secondaryBackground = Color(hex: "444654") // Lighter charcoal
    static let tertiaryBackground = Color(hex: "202123") // Darker accent
    static let surfaceBackground = Color(hex: "40414F") // Card/surface color
    
    // Text colors
    static let primaryText = Color.white
    static let secondaryText = Color.white.opacity(0.7)
    static let tertiaryText = Color.white.opacity(0.5)
    
    // Accent colors
    static let accentGreen = Color(hex: "10A37F") // ChatGPT green
    static let accentPurple = Color(hex: "AB68FF") // Purple accent
    static let accentBlue = Color(hex: "19C3E6") // Blue accent
    
    // MARK: - Gradients
    static let windowBackgroundGradient = LinearGradient(
        gradient: Gradient(colors: [
            primaryBackground,
            primaryBackground.opacity(0.98)
        ]),
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )
    
    static let glassGradient = LinearGradient(
        gradient: Gradient(colors: [
            Color.white.opacity(0.1),
            Color.white.opacity(0.05)
        ]),
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )
    
    // MARK: - Chat Elements
    static let userMessageBackground = LinearGradient(
        gradient: Gradient(colors: [
            surfaceBackground,
            surfaceBackground.opacity(0.9)
        ]),
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )
    
    static let assistantMessageBackground = Color.clear
    static let messageBorder = Color.white.opacity(0.1)
    
    // MARK: - Floating Composer
    static let composerBackground = Color(hex: "40414F")
    static let composerBorder = Color.white.opacity(0.15)
    static let composerShadow = Color.black.opacity(0.3)
    
    // MARK: - Input & Interactive Elements
    static let inputBackground = Color(hex: "40414F")
    static let inputBorder = Color.white.opacity(0.1)
    static let buttonBackground = accentGreen
    static let buttonHover = accentGreen.opacity(0.8)
    
    // MARK: - Popup & Modal
    static let popupBackground = Color(hex: "202123")
    static let popupBorder = Color.white.opacity(0.1)
    static let overlayBackground = Color.black.opacity(0.5)
    
    // MARK: - Sidebar
    static let sidebarBackground = tertiaryBackground
    static let sidebarItemHover = Color.white.opacity(0.05)
    static let sidebarItemSelected = Color.white.opacity(0.1)
    
    // MARK: - Misc
    static let separator = Color.white.opacity(0.1)
    static let scrollbarBackground = Color.white.opacity(0.05)
    static let scrollbarThumb = Color.white.opacity(0.2)
    
    // MARK: - Effects
    static let glassEffect: some View = {
        Rectangle()
            .fill(.ultraThinMaterial)
            .background(glassGradient)
    }()
    
    // MARK: - Shadows
    static let lightShadow = Color.black.opacity(0.1)
    static let mediumShadow = Color.black.opacity(0.2)
    static let heavyShadow = Color.black.opacity(0.4)
}

// MARK: - Color Extension for Hex Support
extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}


