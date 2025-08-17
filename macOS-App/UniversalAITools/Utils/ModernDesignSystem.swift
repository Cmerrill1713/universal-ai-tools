import SwiftUI
import Pow
import Vortex

/// Modern design system inspired by Arc browser and contemporary design patterns
/// Provides a comprehensive set of components, animations, and effects for a polished UI experience
struct ModernDesignSystem {
    
    // MARK: - Design Tokens
    struct Tokens {
        // Spacing Scale (based on 4px grid)
        static let space0: CGFloat = 0
        static let space1: CGFloat = 4
        static let space2: CGFloat = 8
        static let space3: CGFloat = 12
        static let space4: CGFloat = 16
        static let space5: CGFloat = 20
        static let space6: CGFloat = 24
        static let space8: CGFloat = 32
        static let space10: CGFloat = 40
        static let space12: CGFloat = 48
        static let space16: CGFloat = 64
        static let space20: CGFloat = 80
        
        // Border Radius Scale
        static let radius0: CGFloat = 0
        static let radius1: CGFloat = 4
        static let radius2: CGFloat = 8
        static let radius3: CGFloat = 12
        static let radius4: CGFloat = 16
        static let radius5: CGFloat = 20
        static let radius6: CGFloat = 24
        static let radiusFull: CGFloat = 9999
        
        // Shadow Levels
        static let shadowSmall = (offset: CGSize(width: 0, height: 1), blur: 2.0, color: Color.black.opacity(0.05))
        static let shadowMedium = (offset: CGSize(width: 0, height: 4), blur: 8.0, color: Color.black.opacity(0.1))
        static let shadowLarge = (offset: CGSize(width: 0, height: 8), blur: 16.0, color: Color.black.opacity(0.15))
        static let shadowXLarge = (offset: CGSize(width: 0, height: 16), blur: 32.0, color: Color.black.opacity(0.2))
        
        // Animation Durations
        static let durationFast: Double = 0.15
        static let durationNormal: Double = 0.3
        static let durationSlow: Double = 0.5
        static let durationXSlow: Double = 0.8
        
        // Animation Curves
        static let easeOut = Animation.timingCurve(0.16, 1, 0.3, 1)
        static let easeIn = Animation.timingCurve(0.7, 0, 0.84, 0)
        static let easeInOut = Animation.timingCurve(0.87, 0, 0.13, 1)
        static let spring = Animation.spring(response: 0.55, dampingFraction: 0.825, blendDuration: 0)
        static let bounce = Animation.spring(response: 0.3, dampingFraction: 0.6, blendDuration: 0.15)
    }
    
    // MARK: - Color Palette (Arc-inspired)
    struct Colors {
        // Primary Brand Colors
        static let brand50 = Color(hex: "F0F9FF")
        static let brand100 = Color(hex: "E0F2FE")
        static let brand500 = Color(hex: "0EA5E9")
        static let brand600 = Color(hex: "0284C7")
        static let brand700 = Color(hex: "0369A1")
        static let brand900 = Color(hex: "0C4A6E")
        
        // Neutral Palette (Dark Mode Optimized)
        static let gray50 = Color(hex: "F9FAFB")
        static let gray100 = Color(hex: "F3F4F6")
        static let gray200 = Color(hex: "E5E7EB")
        static let gray300 = Color(hex: "D1D5DB")
        static let gray400 = Color(hex: "9CA3AF")
        static let gray500 = Color(hex: "6B7280")
        static let gray600 = Color(hex: "4B5563")
        static let gray700 = Color(hex: "374151")
        static let gray800 = Color(hex: "1F2937")
        static let gray900 = Color(hex: "111827")
        static let gray950 = Color(hex: "030712")
        
        // Semantic Colors
        static let success = Color(hex: "10B981")
        static let warning = Color(hex: "F59E0B")
        static let error = Color(hex: "EF4444")
        static let info = Color(hex: "3B82F6")
        
        // Glass Effect Colors
        static let glassLight = Color.white.opacity(0.1)
        static let glassMedium = Color.white.opacity(0.15)
        static let glassDark = Color.black.opacity(0.1)
        
        // Dynamic Colors (adapt to system appearance)
        static func surface(for colorScheme: ColorScheme) -> Color {
            colorScheme == .dark ? gray800 : gray50
        }
        
        static func surfaceSecondary(for colorScheme: ColorScheme) -> Color {
            colorScheme == .dark ? gray700 : gray100
        }
        
        static func border(for colorScheme: ColorScheme) -> Color {
            colorScheme == .dark ? gray600.opacity(0.3) : gray200
        }
    }
    
    // MARK: - Typography Scale
    struct Typography {
        static let displayLarge = Font.system(size: 57, weight: .regular, design: .default)
        static let displayMedium = Font.system(size: 45, weight: .regular, design: .default)
        static let displaySmall = Font.system(size: 36, weight: .regular, design: .default)
        
        static let headlineLarge = Font.system(size: 32, weight: .regular, design: .default)
        static let headlineMedium = Font.system(size: 28, weight: .regular, design: .default)
        static let headlineSmall = Font.system(size: 24, weight: .regular, design: .default)
        
        static let titleLarge = Font.system(size: 22, weight: .medium, design: .default)
        static let titleMedium = Font.system(size: 16, weight: .medium, design: .default)
        static let titleSmall = Font.system(size: 14, weight: .medium, design: .default)
        
        static let labelLarge = Font.system(size: 14, weight: .medium, design: .default)
        static let labelMedium = Font.system(size: 12, weight: .medium, design: .default)
        static let labelSmall = Font.system(size: 11, weight: .medium, design: .default)
        
        static let bodyLarge = Font.system(size: 16, weight: .regular, design: .default)
        static let bodyMedium = Font.system(size: 14, weight: .regular, design: .default)
        static let bodySmall = Font.system(size: 12, weight: .regular, design: .default)
        
        static let monoLarge = Font.system(size: 14, weight: .regular, design: .monospaced)
        static let monoMedium = Font.system(size: 12, weight: .regular, design: .monospaced)
        static let monoSmall = Font.system(size: 10, weight: .regular, design: .monospaced)
    }
}

// MARK: - Modern Button Component
struct ModernButton: View {
    enum Style {
        case primary, secondary, ghost, destructive
        
        var backgroundColor: Color {
            switch self {
            case .primary: return ModernDesignSystem.Colors.brand500
            case .secondary: return ModernDesignSystem.Colors.gray700
            case .ghost: return Color.clear
            case .destructive: return ModernDesignSystem.Colors.error
            }
        }
        
        var foregroundColor: Color {
            switch self {
            case .primary: return .white
            case .secondary: return .white
            case .ghost: return ModernDesignSystem.Colors.brand500
            case .destructive: return .white
            }
        }
    }
    
    enum Size {
        case small, medium, large
        
        var padding: EdgeInsets {
            switch self {
            case .small: return EdgeInsets(top: 6, leading: 12, bottom: 6, trailing: 12)
            case .medium: return EdgeInsets(top: 10, leading: 16, bottom: 10, trailing: 16)
            case .large: return EdgeInsets(top: 14, leading: 20, bottom: 14, trailing: 20)
            }
        }
        
        var font: Font {
            switch self {
            case .small: return ModernDesignSystem.Typography.labelSmall
            case .medium: return ModernDesignSystem.Typography.labelMedium
            case .large: return ModernDesignSystem.Typography.labelLarge
            }
        }
    }
    
    let title: String
    let icon: String?
    let style: Style
    let size: Size
    let action: () -> Void
    let isLoading: Bool
    let isDisabled: Bool
    
    @State private var isPressed = false
    @State private var isHovered = false
    
    init(
        _ title: String,
        icon: String? = nil,
        style: Style = .primary,
        size: Size = .medium,
        isLoading: Bool = false,
        isDisabled: Bool = false,
        action: @escaping () -> Void
    ) {
        self.title = title
        self.icon = icon
        self.style = style
        self.size = size
        self.isLoading = isLoading
        self.isDisabled = isDisabled
        self.action = action
    }
    
    var body: some View {
        Button(action: {
            if !isDisabled && !isLoading {
                action()
            }
        }) {
            HStack(spacing: ModernDesignSystem.Tokens.space2) {
                if isLoading {
                    ProgressView()
                        .scaleEffect(0.7)
                        .foregroundColor(style.foregroundColor)
                } else if let icon = icon {
                    Image(systemName: icon)
                        .font(size.font)
                        .foregroundColor(style.foregroundColor)
                        .conditionalEffect(.bounce, condition: isPressed)
                }
                
                Text(title)
                    .font(size.font)
                    .foregroundColor(style.foregroundColor)
            }
            .padding(size.padding)
            .background(
                RoundedRectangle(cornerRadius: ModernDesignSystem.Tokens.radius2)
                    .fill(style.backgroundColor)
                    .opacity(isDisabled ? 0.5 : 1.0)
                    .overlay(
                        // Hover effect
                        RoundedRectangle(cornerRadius: ModernDesignSystem.Tokens.radius2)
                            .fill(.white.opacity(isHovered ? 0.1 : 0.0))
                    )
                    .overlay(
                        // Ghost button border
                        RoundedRectangle(cornerRadius: ModernDesignSystem.Tokens.radius2)
                            .stroke(style.foregroundColor.opacity(style == .ghost ? 1.0 : 0.0), lineWidth: 1)
                    )
                    .shadow(
                        color: ModernDesignSystem.Tokens.shadowMedium.color,
                        radius: isPressed ? 2 : 4,
                        x: 0,
                        y: isPressed ? 1 : 2
                    )
            )
        }
        .buttonStyle(.plain)
        .scaleEffect(isPressed ? 0.97 : 1.0)
        .animation(ModernDesignSystem.Tokens.spring, value: isPressed)
        .animation(ModernDesignSystem.Tokens.easeOut.speed(2), value: isHovered)
        .onHover { hovering in
            isHovered = hovering
        }
        .onLongPressGesture(minimumDuration: 0, maximumDistance: .infinity, pressing: { pressing in
            isPressed = pressing
        }, perform: {})
        .disabled(isDisabled || isLoading)
        .conditionalEffect(.hapticFeedback(.impact(intensity: 0.6)), condition: isPressed && !isDisabled)
    }
}

// MARK: - Modern Card Component
struct ModernCard<Content: View>: View {
    let content: Content
    let padding: EdgeInsets
    let cornerRadius: CGFloat
    let hasShadow: Bool
    let hasGlow: Bool
    let glowColor: Color
    
    @Environment(\.colorScheme) private var colorScheme
    @State private var isHovered = false
    
    init(
        padding: EdgeInsets = EdgeInsets(top: 16, leading: 16, bottom: 16, trailing: 16),
        cornerRadius: CGFloat = 12,
        hasShadow: Bool = true,
        hasGlow: Bool = false,
        glowColor: Color = .blue,
        @ViewBuilder content: () -> Content
    ) {
        self.content = content()
        self.padding = padding
        self.cornerRadius = cornerRadius
        self.hasShadow = hasShadow
        self.hasGlow = hasGlow
        self.glowColor = glowColor
    }
    
    var body: some View {
        content
            .padding(padding)
            .background(
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .fill(.ultraThinMaterial)
                    .overlay(
                        // Glass overlay
                        RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                            .fill(
                                LinearGradient(
                                    colors: [
                                        Color.white.opacity(0.1),
                                        Color.white.opacity(0.05)
                                    ],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )
                    )
                    .overlay(
                        // Border
                        RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                            .stroke(
                                ModernDesignSystem.Colors.border(for: colorScheme),
                                lineWidth: 1
                            )
                    )
                    .shadow(
                        color: hasShadow ? ModernDesignSystem.Tokens.shadowMedium.color : .clear,
                        radius: isHovered ? 8 : 4,
                        x: 0,
                        y: isHovered ? 4 : 2
                    )
                    .conditionalEffect(
                        .glow(color: glowColor, radius: 8),
                        condition: hasGlow && isHovered
                    )
            )
            .scaleEffect(isHovered ? 1.02 : 1.0)
            .animation(ModernDesignSystem.Tokens.spring, value: isHovered)
            .onHover { hovering in
                isHovered = hovering
            }
    }
}

// MARK: - Modern Progress Indicator
struct ModernProgressIndicator: View {
    let progress: Double // 0.0 to 1.0
    let color: Color
    let backgroundColor: Color
    let height: CGFloat
    let cornerRadius: CGFloat
    let showPercentage: Bool
    
    @State private var animatedProgress: Double = 0
    
    init(
        progress: Double,
        color: Color = ModernDesignSystem.Colors.brand500,
        backgroundColor: Color = ModernDesignSystem.Colors.gray200,
        height: CGFloat = 8,
        cornerRadius: CGFloat = 4,
        showPercentage: Bool = false
    ) {
        self.progress = max(0, min(1, progress))
        self.color = color
        self.backgroundColor = backgroundColor
        self.height = height
        self.cornerRadius = cornerRadius
        self.showPercentage = showPercentage
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            if showPercentage {
                HStack {
                    Spacer()
                    Text("\(Int(progress * 100))%")
                        .font(ModernDesignSystem.Typography.labelSmall)
                        .foregroundColor(.secondary)
                }
            }
            
            GeometryReader { geometry in
                ZStack(alignment: .leading) {
                    // Background
                    RoundedRectangle(cornerRadius: cornerRadius)
                        .fill(backgroundColor)
                        .frame(height: height)
                    
                    // Progress fill
                    RoundedRectangle(cornerRadius: cornerRadius)
                        .fill(color)
                        .frame(
                            width: max(0, geometry.size.width * animatedProgress),
                            height: height
                        )
                        .overlay(
                            // Shine effect
                            LinearGradient(
                                colors: [
                                    Color.white.opacity(0.3),
                                    Color.clear,
                                    Color.white.opacity(0.3)
                                ],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                            .clipShape(RoundedRectangle(cornerRadius: cornerRadius))
                        )
                }
            }
            .frame(height: height)
        }
        .onAppear {
            withAnimation(ModernDesignSystem.Tokens.easeOut.delay(0.2)) {
                animatedProgress = progress
            }
        }
        .onChange(of: progress) { newProgress in
            withAnimation(ModernDesignSystem.Tokens.spring) {
                animatedProgress = newProgress
            }
        }
    }
}

// MARK: - Modern Loading States
struct ModernLoadingSpinner: View {
    let size: CGFloat
    let color: Color
    let lineWidth: CGFloat
    
    @State private var rotation: Double = 0
    
    init(size: CGFloat = 24, color: Color = .primary, lineWidth: CGFloat = 2) {
        self.size = size
        self.color = color
        self.lineWidth = lineWidth
    }
    
    var body: some View {
        Circle()
            .trim(from: 0.1, to: 0.9)
            .stroke(
                AngularGradient(
                    colors: [color.opacity(0.2), color],
                    center: .center,
                    startAngle: .degrees(0),
                    endAngle: .degrees(270)
                ),
                style: StrokeStyle(lineWidth: lineWidth, lineCap: .round)
            )
            .frame(width: size, height: size)
            .rotationEffect(.degrees(rotation))
            .onAppear {
                withAnimation(.linear(duration: 1.0).repeatForever(autoreverses: false)) {
                    rotation = 360
                }
            }
    }
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
            (a, r, g, b) = (1, 1, 1, 0)
        }
        
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue:  Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}

#Preview {
    VStack(spacing: 20) {
        ModernButton("Primary Button", icon: "star.fill") {
            print("Primary tapped")
        }
        
        ModernButton("Secondary", style: .secondary) {
            print("Secondary tapped")
        }
        
        ModernButton("Loading", isLoading: true) {
            print("Loading tapped")
        }
        
        ModernCard {
            VStack(alignment: .leading, spacing: 12) {
                Text("Card Title")
                    .font(ModernDesignSystem.Typography.titleMedium)
                Text("This is a modern card component with glassmorphism effects.")
                    .font(ModernDesignSystem.Typography.bodyMedium)
                    .foregroundColor(.secondary)
            }
        }
        
        ModernProgressIndicator(progress: 0.7, showPercentage: true)
        
        ModernLoadingSpinner()
    }
    .padding()
    .background(Color(.systemBackground))
}