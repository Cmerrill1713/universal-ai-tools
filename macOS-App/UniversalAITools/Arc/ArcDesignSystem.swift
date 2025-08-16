import SwiftUI

// MARK: - Arc Design System
// Inspired by Arc Browser's clean, modern aesthetic with glassmorphic elements

public struct ArcDesign {
    // MARK: - Colors
    public struct Colors {
        // Primary Colors
        public static let primaryBackground = Color(NSColor.controlBackgroundColor)
        public static let secondaryBackground = Color(NSColor.windowBackgroundColor)
        public static let tertiaryBackground = Color(NSColor.underPageBackgroundColor)
        
        // Text Colors
        public static let primaryText = Color(NSColor.labelColor)
        public static let secondaryText = Color(NSColor.secondaryLabelColor)
        public static let tertiaryText = Color(NSColor.tertiaryLabelColor)
        public static let quaternaryText = Color(NSColor.quaternaryLabelColor)
        
        // Accent Colors (Arc-inspired pastels)
        public static let accentPurple = Color(red: 0.58, green: 0.44, blue: 0.86)
        public static let accentBlue = Color(red: 0.35, green: 0.61, blue: 0.93)
        public static let accentGreen = Color(red: 0.32, green: 0.81, blue: 0.59)
        public static let accentOrange = Color(red: 0.95, green: 0.61, blue: 0.35)
        public static let accentPink = Color(red: 0.91, green: 0.46, blue: 0.65)
        public static let accentYellow = Color(red: 0.97, green: 0.81, blue: 0.27)
        
        // Semantic Colors
        public static let success = accentGreen
        public static let warning = accentYellow
        public static let error = Color(red: 0.91, green: 0.35, blue: 0.39)
        public static let info = accentBlue
        
        // Material Colors
        public static let glassTint = Color.white.opacity(0.05)
        public static let glassBackground = Color.black.opacity(0.2)
        public static let shadowColor = Color.black.opacity(0.15)
    }
    
    // MARK: - Typography
    public struct Typography {
        public static let largeTitle = Font.system(size: 34, weight: .bold, design: .rounded)
        public static let title1 = Font.system(size: 28, weight: .semibold, design: .rounded)
        public static let title2 = Font.system(size: 22, weight: .medium, design: .rounded)
        public static let title3 = Font.system(size: 20, weight: .medium, design: .rounded)
        public static let headline = Font.system(size: 17, weight: .semibold, design: .rounded)
        public static let body = Font.system(size: 17, weight: .regular, design: .default)
        public static let callout = Font.system(size: 16, weight: .regular, design: .default)
        public static let subheadline = Font.system(size: 15, weight: .regular, design: .default)
        public static let footnote = Font.system(size: 13, weight: .regular, design: .default)
        public static let caption = Font.system(size: 12, weight: .regular, design: .default)
        public static let caption2 = Font.system(size: 11, weight: .regular, design: .default)
        
        // Code fonts
        public static let code = Font.system(size: 14, design: .monospaced)
        public static let codeBlock = Font.system(size: 13, design: .monospaced)
    }
    
    // MARK: - Spacing
    public struct Spacing {
        public static let xxs: CGFloat = 2
        public static let xs: CGFloat = 4
        public static let sm: CGFloat = 8
        public static let md: CGFloat = 12
        public static let lg: CGFloat = 16
        public static let xl: CGFloat = 20
        public static let xxl: CGFloat = 24
        public static let xxxl: CGFloat = 32
    }
    
    // MARK: - Radius
    public struct Radius {
        public static let xs: CGFloat = 4
        public static let sm: CGFloat = 8
        public static let md: CGFloat = 12
        public static let lg: CGFloat = 16
        public static let xl: CGFloat = 20
        public static let xxl: CGFloat = 24
        public static let round: CGFloat = 9999
    }
    
    // MARK: - Animation
    public struct Animation {
        public static let springResponse: Double = 0.35
        public static let springDamping: Double = 0.8
        public static let quickDuration: Double = 0.15
        public static let standardDuration: Double = 0.25
        public static let slowDuration: Double = 0.35
        
        public static let spring = SwiftUI.Animation.spring(response: springResponse, dampingFraction: springDamping)
        public static let easeInOut = SwiftUI.Animation.easeInOut(duration: standardDuration)
        public static let quick = SwiftUI.Animation.easeOut(duration: quickDuration)
    }
    
    // MARK: - Shadows
    public struct Shadow {
        public static let sm = ShadowStyle(color: Colors.shadowColor, radius: 2, x: 0, y: 1)
        public static let md = ShadowStyle(color: Colors.shadowColor, radius: 4, x: 0, y: 2)
        public static let lg = ShadowStyle(color: Colors.shadowColor, radius: 8, x: 0, y: 4)
        public static let xl = ShadowStyle(color: Colors.shadowColor, radius: 12, x: 0, y: 6)
        public static let glow = ShadowStyle(color: Colors.accentBlue.opacity(0.3), radius: 8, x: 0, y: 0)
    }
    
    public struct ShadowStyle {
        let color: Color
        let radius: CGFloat
        let x: CGFloat
        let y: CGFloat
    }
}

// MARK: - Arc View Modifiers

extension View {
    // Glassmorphic background effect
    public func arcGlass(cornerRadius: CGFloat = ArcDesign.Radius.md) -> some View {
        self
            .background(.ultraThinMaterial)
            .background(ArcDesign.Colors.glassTint)
            .cornerRadius(cornerRadius)
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius)
                    .stroke(Color.white.opacity(0.1), lineWidth: 0.5)
            )
            .shadow(color: ArcDesign.Colors.shadowColor, radius: 4, x: 0, y: 2)
    }
    
    // Arc-style card
    public func arcCard(padding: CGFloat = ArcDesign.Spacing.md) -> some View {
        self
            .padding(padding)
            .background(ArcDesign.Colors.primaryBackground)
            .cornerRadius(ArcDesign.Radius.md)
            .shadow(color: ArcDesign.Colors.shadowColor, radius: 2, x: 0, y: 1)
    }
    
    // Arc hover effect
    public func arcHover(_ isHovered: Binding<Bool>) -> some View {
        self
            .scaleEffect(isHovered.wrappedValue ? 1.02 : 1.0)
            .brightness(isHovered.wrappedValue ? 0.05 : 0)
            .animation(ArcDesign.Animation.quick, value: isHovered.wrappedValue)
            .onHover { hovering in
                isHovered.wrappedValue = hovering
            }
    }
    
    // Arc button style
    public func arcButton(color: Color = ArcDesign.Colors.accentBlue) -> some View {
        self
            .foregroundColor(.white)
            .padding(.horizontal, ArcDesign.Spacing.lg)
            .padding(.vertical, ArcDesign.Spacing.sm)
            .background(color)
            .cornerRadius(ArcDesign.Radius.sm)
            .shadow(color: color.opacity(0.3), radius: 4, x: 0, y: 2)
    }
    
    // Arc glow effect
    public func arcGlow(color: Color = ArcDesign.Colors.accentBlue, intensity: Double = 0.3) -> some View {
        self
            .shadow(color: color.opacity(intensity), radius: 8, x: 0, y: 0)
            .shadow(color: color.opacity(intensity * 0.5), radius: 16, x: 0, y: 0)
    }
}

// MARK: - Arc Components

// Arc-style button
struct ArcButton: ButtonStyle {
    var color: Color = ArcDesign.Colors.accentBlue
    @State private var isHovered = false
    
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .foregroundColor(.white)
            .padding(.horizontal, ArcDesign.Spacing.lg)
            .padding(.vertical, ArcDesign.Spacing.sm)
            .background(
                RoundedRectangle(cornerRadius: ArcDesign.Radius.sm)
                    .fill(color)
                    .brightness(configuration.isPressed ? -0.1 : (isHovered ? 0.05 : 0))
            )
            .scaleEffect(configuration.isPressed ? 0.98 : 1.0)
            .shadow(
                color: color.opacity(configuration.isPressed ? 0.2 : 0.3),
                radius: configuration.isPressed ? 2 : 4,
                x: 0, y: configuration.isPressed ? 1 : 2
            )
            .onHover { hovering in
                isHovered = hovering
            }
            .animation(ArcDesign.Animation.quick, value: configuration.isPressed)
            .animation(ArcDesign.Animation.quick, value: isHovered)
    }
}

// Arc-style text field
struct ArcTextField: View {
    @Binding var text: String
    var placeholder: String
    var icon: String?
    
    var body: some View {
        HStack(spacing: ArcDesign.Spacing.sm) {
            if let icon = icon {
                Image(systemName: icon)
                    .foregroundColor(ArcDesign.Colors.secondaryText)
                    .font(.system(size: 16))
            }
            
            TextField(placeholder, text: $text)
                .textFieldStyle(PlainTextFieldStyle())
                .font(ArcDesign.Typography.body)
        }
        .padding(ArcDesign.Spacing.md)
        .background(ArcDesign.Colors.tertiaryBackground.opacity(0.5))
        .cornerRadius(ArcDesign.Radius.sm)
        .overlay(
            RoundedRectangle(cornerRadius: ArcDesign.Radius.sm)
                .stroke(Color.white.opacity(0.1), lineWidth: 0.5)
        )
    }
}

// Arc-style divider
struct ArcDivider: View {
    var body: some View {
        Rectangle()
            .fill(ArcDesign.Colors.quaternaryText.opacity(0.2))
            .frame(height: 0.5)
    }
}