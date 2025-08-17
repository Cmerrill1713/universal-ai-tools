import SwiftUI
import AppKit

/// Enhanced accessibility system providing comprehensive support for assistive technologies
/// Includes VoiceOver optimization, keyboard navigation, high contrast support, and motion reduction
struct AccessibilityEnhanced {
    
    // MARK: - Accessibility Environment
    static let shared = AccessibilityManager()
    
    class AccessibilityManager: ObservableObject {
        @Published var isVoiceOverEnabled = false
        @Published var isReduceMotionEnabled = false
        @Published var isIncreaseContrastEnabled = false
        @Published var preferredContentSizeCategory: ContentSizeCategory = .medium
        @Published var isKeyboardNavigationEnabled = true
        
        private var notificationObservers: [NSObjectProtocol] = []
        
        init() {
            setupAccessibilityObservers()
            updateAccessibilityState()
        }
        
        deinit {
            notificationObservers.forEach { NotificationCenter.default.removeObserver($0) }
        }
        
        private func setupAccessibilityObservers() {
            // VoiceOver state changes
            let voiceOverObserver = NotificationCenter.default.addObserver(
                forName: NSNotification.Name(rawValue: "NSApplicationDidChangeScreenParametersNotification"),
                object: nil,
                queue: .main
            ) { [weak self] _ in
                self?.updateAccessibilityState()
            }
            notificationObservers.append(voiceOverObserver)
            
            // Reduce motion changes
            let motionObserver = NotificationCenter.default.addObserver(
                forName: NSNotification.Name.NSWorkspaceAccessibilityDisplayOptionsDidChange,
                object: nil,
                queue: .main
            ) { [weak self] _ in
                self?.updateAccessibilityState()
            }
            notificationObservers.append(motionObserver)
        }
        
        private func updateAccessibilityState() {
            isVoiceOverEnabled = NSWorkspace.shared.isVoiceOverEnabled
            isReduceMotionEnabled = NSWorkspace.shared.accessibilityDisplayShouldReduceMotion
            isIncreaseContrastEnabled = NSWorkspace.shared.accessibilityDisplayShouldIncreaseContrast
        }
    }
    
    enum ContentSizeCategory {
        case small, medium, large, extraLarge, accessibility1, accessibility2, accessibility3
        
        var scaleFactor: CGFloat {
            switch self {
            case .small: return 0.85
            case .medium: return 1.0
            case .large: return 1.15
            case .extraLarge: return 1.3
            case .accessibility1: return 1.6
            case .accessibility2: return 1.9
            case .accessibility3: return 2.2
            }
        }
        
        var fontWeight: Font.Weight {
            switch self {
            case .accessibility1, .accessibility2, .accessibility3: return .semibold
            default: return .regular
            }
        }
    }
    
    // MARK: - Accessible Button Component
    struct AccessibleButton: View {
        let title: String
        let icon: String?
        let action: () -> Void
        let role: ButtonRole
        let help: String?
        
        @State private var isFocused = false
        @State private var isPressed = false
        @Environment(\.colorScheme) private var colorScheme
        @EnvironmentObject private var accessibilityManager: AccessibilityManager
        
        enum ButtonRole {
            case primary, secondary, destructive, navigation
            
            var semanticRole: AccessibilityRole {
                switch self {
                case .navigation: return .link
                default: return .button
                }
            }
            
            func colors(for colorScheme: ColorScheme, highContrast: Bool) -> (background: Color, foreground: Color, border: Color) {
                let contrastMultiplier: Double = highContrast ? 1.2 : 1.0
                
                switch self {
                case .primary:
                    return (
                        .blue.opacity(0.8 * contrastMultiplier),
                        .white,
                        .blue.opacity(contrastMultiplier)
                    )
                case .secondary:
                    let bgOpacity = colorScheme == .dark ? 0.3 : 0.1
                    return (
                        .gray.opacity(bgOpacity * contrastMultiplier),
                        colorScheme == .dark ? .white : .black,
                        .gray.opacity(0.5 * contrastMultiplier)
                    )
                case .destructive:
                    return (
                        .red.opacity(0.8 * contrastMultiplier),
                        .white,
                        .red.opacity(contrastMultiplier)
                    )
                case .navigation:
                    return (
                        .clear,
                        .blue.opacity(contrastMultiplier),
                        .blue.opacity(0.3 * contrastMultiplier)
                    )
                }
            }
        }
        
        init(
            _ title: String,
            icon: String? = nil,
            role: ButtonRole = .primary,
            help: String? = nil,
            action: @escaping () -> Void
        ) {
            self.title = title
            self.icon = icon
            self.role = role
            self.help = help
            self.action = action
        }
        
        var body: some View {
            let colors = role.colors(for: colorScheme, highContrast: accessibilityManager.isIncreaseContrastEnabled)
            let scaleFactor = accessibilityManager.preferredContentSizeCategory.scaleFactor
            
            Button(action: action) {
                HStack(spacing: 8 * scaleFactor) {
                    if let icon = icon {
                        Image(systemName: icon)
                            .font(.system(size: 16 * scaleFactor, weight: accessibilityManager.preferredContentSizeCategory.fontWeight))
                            .foregroundColor(colors.foreground)
                    }
                    
                    Text(title)
                        .font(.system(size: 16 * scaleFactor, weight: accessibilityManager.preferredContentSizeCategory.fontWeight))
                        .foregroundColor(colors.foreground)
                }
                .padding(.horizontal, 16 * scaleFactor)
                .padding(.vertical, 12 * scaleFactor)
                .background(
                    RoundedRectangle(cornerRadius: 8 * scaleFactor, style: .continuous)
                        .fill(colors.background)
                        .overlay(
                            RoundedRectangle(cornerRadius: 8 * scaleFactor, style: .continuous)
                                .stroke(colors.border, lineWidth: isFocused ? 3 : 1)
                        )
                )
                .scaleEffect(isPressed ? 0.95 : 1.0)
                .animation(
                    accessibilityManager.isReduceMotionEnabled ? .none : .easeOut(duration: 0.1),
                    value: isPressed
                )
            }
            .buttonStyle(.plain)
            .focusable()
            .onLongPressGesture(minimumDuration: 0, maximumDistance: .infinity, pressing: { pressing in
                isPressed = pressing
            }, perform: {})
            .onFocusChange { focused in
                isFocused = focused
            }
            .accessibilityRole(role.semanticRole)
            .accessibilityLabel(title)
            .accessibilityHint(help ?? "")
            .accessibilityAddTraits(isFocused ? .isSelected : [])
            .help(help ?? title)
        }
    }
    
    // MARK: - Accessible Toggle Switch
    struct AccessibleToggle: View {
        @Binding var isOn: Bool
        let label: String
        let description: String?
        
        @State private var isFocused = false
        @Environment(\.colorScheme) private var colorScheme
        @EnvironmentObject private var accessibilityManager: AccessibilityManager
        
        init(_ label: String, isOn: Binding<Bool>, description: String? = nil) {
            self.label = label
            self._isOn = isOn
            self.description = description
        }
        
        var body: some View {
            let scaleFactor = accessibilityManager.preferredContentSizeCategory.scaleFactor
            let switchWidth = 60 * scaleFactor
            let switchHeight = 34 * scaleFactor
            let knobSize = 26 * scaleFactor
            
            HStack(spacing: 12 * scaleFactor) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(label)
                        .font(.system(size: 16 * scaleFactor, weight: accessibilityManager.preferredContentSizeCategory.fontWeight))
                        .foregroundColor(.primary)
                    
                    if let description = description {
                        Text(description)
                            .font(.system(size: 14 * scaleFactor))
                            .foregroundColor(.secondary)
                    }
                }
                
                Spacer()
                
                // Custom toggle switch
                ZStack {
                    // Track
                    RoundedRectangle(cornerRadius: switchHeight / 2, style: .continuous)
                        .fill(isOn ? .green : .gray.opacity(0.3))
                        .frame(width: switchWidth, height: switchHeight)
                        .overlay(
                            RoundedRectangle(cornerRadius: switchHeight / 2, style: .continuous)
                                .stroke(isFocused ? .blue : .clear, lineWidth: 3)
                        )
                        .animation(
                            accessibilityManager.isReduceMotionEnabled ? .none : .easeInOut(duration: 0.2),
                            value: isOn
                        )
                    
                    // Knob
                    Circle()
                        .fill(.white)
                        .frame(width: knobSize, height: knobSize)
                        .shadow(color: .black.opacity(0.2), radius: 2, x: 0, y: 1)
                        .offset(x: isOn ? (switchWidth - knobSize) / 2 - 4 : -(switchWidth - knobSize) / 2 + 4)
                        .animation(
                            accessibilityManager.isReduceMotionEnabled ? .none : .spring(response: 0.3, dampingFraction: 0.7),
                            value: isOn
                        )
                }
                .onTapGesture {
                    isOn.toggle()
                    
                    // Provide haptic feedback for accessibility
                    NSSound.beep()
                }
                .focusable()
                .onFocusChange { focused in
                    isFocused = focused
                }
                .onKeyPress(.space) {
                    isOn.toggle()
                    return .handled
                }
                .onKeyPress(.return) {
                    isOn.toggle()
                    return .handled
                }
            }
            .accessibilityElement(children: .ignore)
            .accessibilityRole(.toggleButton)
            .accessibilityLabel(label)
            .accessibilityValue(isOn ? "On" : "Off")
            .accessibilityHint(description ?? "Double-tap to toggle")
            .accessibilityAddTraits(isOn ? .isSelected : [])
        }
    }
    
    // MARK: - Accessible Progress Indicator
    struct AccessibleProgressIndicator: View {
        let progress: Double
        let label: String
        let showPercentage: Bool
        
        @EnvironmentObject private var accessibilityManager: AccessibilityManager
        
        init(progress: Double, label: String, showPercentage: Bool = true) {
            self.progress = max(0, min(1, progress))
            self.label = label
            self.showPercentage = showPercentage
        }
        
        var body: some View {
            let scaleFactor = accessibilityManager.preferredContentSizeCategory.scaleFactor
            let trackHeight = 8 * scaleFactor
            
            VStack(alignment: .leading, spacing: 8 * scaleFactor) {
                HStack {
                    Text(label)
                        .font(.system(size: 16 * scaleFactor, weight: accessibilityManager.preferredContentSizeCategory.fontWeight))
                        .foregroundColor(.primary)
                    
                    Spacer()
                    
                    if showPercentage {
                        Text("\(Int(progress * 100))%")
                            .font(.system(size: 14 * scaleFactor, design: .monospaced))
                            .foregroundColor(.secondary)
                    }
                }
                
                GeometryReader { geometry in
                    ZStack(alignment: .leading) {
                        // Background track
                        RoundedRectangle(cornerRadius: trackHeight / 2)
                            .fill(.gray.opacity(0.3))
                            .frame(height: trackHeight)
                        
                        // Progress fill
                        RoundedRectangle(cornerRadius: trackHeight / 2)
                            .fill(.blue)
                            .frame(
                                width: geometry.size.width * progress,
                                height: trackHeight
                            )
                            .animation(
                                accessibilityManager.isReduceMotionEnabled ? .none : .easeOut(duration: 0.3),
                                value: progress
                            )
                    }
                }
                .frame(height: trackHeight)
            }
            .accessibilityElement(children: .ignore)
            .accessibilityRole(.progressIndicator)
            .accessibilityLabel(label)
            .accessibilityValue("\(Int(progress * 100)) percent complete")
        }
    }
    
    // MARK: - Accessible Card Container
    struct AccessibleCard<Content: View>: View {
        let content: Content
        let title: String?
        let description: String?
        let isInteractive: Bool
        let onTap: (() -> Void)?
        
        @State private var isFocused = false
        @State private var isHovered = false
        @EnvironmentObject private var accessibilityManager: AccessibilityManager
        
        init(
            title: String? = nil,
            description: String? = nil,
            isInteractive: Bool = false,
            onTap: (() -> Void)? = nil,
            @ViewBuilder content: () -> Content
        ) {
            self.title = title
            self.description = description
            self.isInteractive = isInteractive
            self.onTap = onTap
            self.content = content()
        }
        
        var body: some View {
            let scaleFactor = accessibilityManager.preferredContentSizeCategory.scaleFactor
            let cornerRadius = 12 * scaleFactor
            
            content
                .padding(16 * scaleFactor)
                .background(
                    RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                        .fill(.ultraThinMaterial)
                        .overlay(
                            RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                                .stroke(
                                    isFocused ? .blue : .gray.opacity(0.3),
                                    lineWidth: isFocused ? 3 : 1
                                )
                        )
                        .shadow(
                            color: .black.opacity(0.1),
                            radius: isHovered ? 8 : 4,
                            x: 0,
                            y: isHovered ? 4 : 2
                        )
                )
                .scaleEffect(
                    accessibilityManager.isReduceMotionEnabled ? 1.0 : (isHovered ? 1.02 : 1.0)
                )
                .animation(
                    accessibilityManager.isReduceMotionEnabled ? .none : .easeOut(duration: 0.2),
                    value: isHovered
                )
                .onHover { hovering in
                    isHovered = hovering
                }
                .focusable(isInteractive)
                .onFocusChange { focused in
                    isFocused = focused
                }
                .onTapGesture {
                    onTap?()
                }
                .accessibilityElement(children: isInteractive ? .ignore : .contain)
                .accessibilityRole(isInteractive ? .button : .group)
                .accessibilityLabel(title ?? "")
                .accessibilityHint(description ?? "")
                .accessibilityAddTraits(isFocused ? .isSelected : [])
        }
    }
    
    // MARK: - High Contrast Color Adapter
    struct HighContrastColors {
        static func adaptColor(_ color: Color, for colorScheme: ColorScheme, highContrast: Bool) -> Color {
            guard highContrast else { return color }
            
            switch colorScheme {
            case .dark:
                return color.opacity(1.0) // Ensure full opacity in dark mode
            case .light:
                return color.opacity(0.9) // Slightly reduce opacity in light mode for better contrast
            @unknown default:
                return color
            }
        }
        
        static func textColor(for colorScheme: ColorScheme, highContrast: Bool) -> Color {
            if highContrast {
                return colorScheme == .dark ? .white : .black
            } else {
                return .primary
            }
        }
        
        static func backgroundColor(for colorScheme: ColorScheme, highContrast: Bool) -> Color {
            if highContrast {
                return colorScheme == .dark ? .black : .white
            } else {
                return Color(NSColor.controlBackgroundColor)
            }
        }
    }
    
    // MARK: - Keyboard Navigation Helper
    struct KeyboardNavigationContainer<Content: View>: View {
        let content: Content
        @State private var focusedIndex = 0
        @State private var focusableItems: [String] = []
        
        init(@ViewBuilder content: () -> Content) {
            self.content = content()
        }
        
        var body: some View {
            content
                .onKeyPress(.tab) {
                    moveFocus(direction: 1)
                    return .handled
                }
                .onKeyPress(.tab, modifiers: .shift) {
                    moveFocus(direction: -1)
                    return .handled
                }
                .accessibilityElement(children: .contain)
        }
        
        private func moveFocus(direction: Int) {
            let newIndex = (focusedIndex + direction) % max(1, focusableItems.count)
            focusedIndex = max(0, newIndex)
        }
    }
}

// MARK: - View Extensions for Accessibility
extension View {
    func accessibilityEnhanced(
        label: String? = nil,
        hint: String? = nil,
        value: String? = nil,
        role: AccessibilityRole? = nil
    ) -> some View {
        self
            .accessibilityLabel(label ?? "")
            .accessibilityHint(hint ?? "")
            .accessibilityValue(value ?? "")
            .if(role != nil) { view in
                view.accessibilityRole(role!)
            }
    }
    
    func reduceMotionSensitive<T: Equatable>(
        animation: Animation?,
        value: T
    ) -> some View {
        self.animation(
            AccessibilityEnhanced.shared.isReduceMotionEnabled ? .none : animation,
            value: value
        )
    }
    
    func highContrastAdaptive(
        baseColor: Color,
        colorScheme: ColorScheme
    ) -> some View {
        self.foregroundColor(
            AccessibilityEnhanced.HighContrastColors.adaptColor(
                baseColor,
                for: colorScheme,
                highContrast: AccessibilityEnhanced.shared.isIncreaseContrastEnabled
            )
        )
    }
}

// Helper extension for conditional view modification
extension View {
    @ViewBuilder func `if`<Content: View>(_ condition: Bool, transform: (Self) -> Content) -> some View {
        if condition {
            transform(self)
        } else {
            self
        }
    }
}

#Preview {
    VStack(spacing: 20) {
        AccessibilityEnhanced.AccessibleButton(
            "Primary Action",
            icon: "star.fill",
            role: .primary,
            help: "Tap to perform the primary action"
        ) {
            print("Primary action")
        }
        
        AccessibilityEnhanced.AccessibleToggle(
            "Enable Notifications",
            isOn: .constant(true),
            description: "Receive push notifications when new messages arrive"
        )
        
        AccessibilityEnhanced.AccessibleProgressIndicator(
            progress: 0.65,
            label: "Upload Progress"
        )
        
        AccessibilityEnhanced.AccessibleCard(
            title: "Sample Card",
            description: "This is an accessible card component",
            isInteractive: true
        ) {
            VStack(alignment: .leading, spacing: 8) {
                Text("Card Content")
                    .font(.headline)
                Text("This card demonstrates accessibility features")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        } onTap: {
            print("Card tapped")
        }
    }
    .padding()
    .environmentObject(AccessibilityEnhanced.shared)
}