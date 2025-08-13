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
    static let quaternaryText = Color.white.opacity(0.3)

    // Accent colors
    static let accentGreen = Color(hex: "10A37F") // ChatGPT green
    static let accentOrange = Color(hex: "FF8C42") // Orange accent
    static let accentBlue = Color(hex: "19C3E6") // Blue accent
    static let accentColor = accentGreen // Default accent color
    static let destructiveColor = Color.red // Destructive actions
    static let borderColor = Color.white.opacity(0.1) // Border color

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

    static let assistantMessageBackground = LinearGradient(
        gradient: Gradient(colors: [
            Color.clear,
            Color.clear
        ]),
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )
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
        let alpha, red, green, blue: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (alpha, red, green, blue) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (alpha, red, green, blue) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (alpha, red, green, blue) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (alpha, red, green, blue) = (255, 0, 0, 0)
        }
        self.init(
            .sRGB,
            red: Double(red) / 255,
            green: Double(green) / 255,
            blue: Double(blue) / 255,
            opacity: Double(alpha) / 255
        )
    }
}

// MARK: - macOS Adaptive Additions and Layout
extension AppTheme {
    // Controls and system-derived colors
    static let controlBackground = Color(NSColor.controlBackgroundColor)
    static let controlAccent = Color(NSColor.controlAccentColor)
    static let controlText = Color(NSColor.controlTextColor)
    static let gridColor = Color(NSColor.gridColor)

    // Common statuses
    static let errorColor = Color.red

    // Spacing
    static let smallSpacing: CGFloat = 4
    static let mediumSpacing: CGFloat = 8
    static let largeSpacing: CGFloat = 16
    static let extraLargeSpacing: CGFloat = 24

    // Corner radius
    static let smallRadius: CGFloat = 4
    static let mediumRadius: CGFloat = 8
    static let largeRadius: CGFloat = 12
    static let extraLargeRadius: CGFloat = 16

    // Typography
    static let largeTitle = Font.largeTitle
    static let title = Font.title
    static let title2 = Font.title2
    static let title3 = Font.title3
    static let headline = Font.headline
    static let subheadline = Font.subheadline
    static let body = Font.body
    static let callout = Font.callout
    static let footnote = Font.footnote
    static let caption = Font.caption
    static let caption2 = Font.caption2
    static let monospacedFont = Font.system(.body, design: .monospaced)
    static let monospacedSmall = Font.system(.caption, design: .monospaced)

    // Animations
    static let quickAnimation = Animation.easeInOut(duration: 0.2)
    static let normalAnimation = Animation.easeInOut(duration: 0.3)
    static let slowAnimation = Animation.easeInOut(duration: 0.5)
    static let springAnimation = Animation.spring(response: 0.5, dampingFraction: 0.8)

    // Layout
    static let sidebarWidth: CGFloat = 260
    static let minWindowWidth: CGFloat = 900
    static let minWindowHeight: CGFloat = 600
    static let maxChatWidth: CGFloat = 720
    static let composerMaxWidth: CGFloat = 720
    static let composerMinHeight: CGFloat = 44
    static let composerMaxHeight: CGFloat = 200

    // Adaptive helpers
    static func adaptiveBackground(for colorScheme: ColorScheme) -> Color {
        colorScheme == .dark ? tertiaryBackground : primaryBackground
    }

    static func adaptiveSecondaryBackground(for colorScheme: ColorScheme) -> Color {
        colorScheme == .dark ? secondaryBackground : secondaryBackground
    }

    static func adaptiveTertiaryBackground(for colorScheme: ColorScheme) -> Color {
        colorScheme == .dark ? tertiaryBackground : tertiaryBackground
    }
}
