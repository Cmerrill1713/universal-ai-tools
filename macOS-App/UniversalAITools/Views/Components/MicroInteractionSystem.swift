import SwiftUI
import Pow

/// Comprehensive micro-interaction system providing delightful user feedback
/// Includes haptic feedback, smooth animations, and contextual responses
struct MicroInteractionSystem {
    
    // MARK: - Interactive Button with Rich Feedback
    struct InteractiveButton: View {
        let title: String
        let icon: String?
        let action: () -> Void
        let style: ButtonStyle
        let hapticStyle: HapticStyle
        let soundEnabled: Bool
        
        @State private var isPressed = false
        @State private var isHovered = false
        @State private var successTrigger = false
        @State private var pressScale: CGFloat = 1.0
        @State private var rippleOffset: CGFloat = 0
        @State private var glowIntensity: Double = 0
        
        enum ButtonStyle {
            case primary, secondary, success, warning, danger, ghost
            
            var colors: (background: Color, foreground: Color, accent: Color) {
                switch self {
                case .primary:
                    return (.blue, .white, .blue.opacity(0.3))
                case .secondary:
                    return (.gray.opacity(0.2), .primary, .gray.opacity(0.1))
                case .success:
                    return (.green, .white, .green.opacity(0.3))
                case .warning:
                    return (.orange, .white, .orange.opacity(0.3))
                case .danger:
                    return (.red, .white, .red.opacity(0.3))
                case .ghost:
                    return (.clear, .blue, .blue.opacity(0.1))
                }
            }
        }
        
        enum HapticStyle {
            case light, medium, heavy, none
            
            var impact: CGFloat {
                switch self {
                case .light: return 0.4
                case .medium: return 0.6
                case .heavy: return 0.8
                case .none: return 0.0
                }
            }
        }
        
        init(
            _ title: String,
            icon: String? = nil,
            style: ButtonStyle = .primary,
            hapticStyle: HapticStyle = .medium,
            soundEnabled: Bool = false,
            action: @escaping () -> Void
        ) {
            self.title = title
            self.icon = icon
            self.style = style
            self.hapticStyle = hapticStyle
            self.soundEnabled = soundEnabled
            self.action = action
        }
        
        var body: some View {
            Button(action: performAction) {
                HStack(spacing: 8) {
                    if let icon = icon {
                        Image(systemName: icon)
                            .font(.system(size: 16, weight: .medium))
                            .foregroundColor(style.colors.foreground)
                            .conditionalEffect(.bounce, condition: isPressed)
                            .scaleEffect(isPressed ? 1.2 : 1.0)
                    }
                    
                    Text(title)
                        .font(.system(size: 16, weight: .medium))
                        .foregroundColor(style.colors.foreground)
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 12)
                .background(
                    ZStack {
                        // Base background
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .fill(style.colors.background)
                        
                        // Hover overlay
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .fill(style.colors.accent)
                            .opacity(isHovered ? 1.0 : 0.0)
                        
                        // Ripple effect
                        Circle()
                            .fill(style.colors.foreground.opacity(0.2))
                            .frame(width: rippleOffset, height: rippleOffset)
                            .opacity(isPressed ? 1.0 : 0.0)
                        
                        // Border for ghost style
                        if style == .ghost {
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .stroke(style.colors.foreground.opacity(0.3), lineWidth: 1)
                        }
                    }
                )
                .overlay(
                    // Success shine effect
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(
                            LinearGradient(
                                colors: [
                                    .white.opacity(0.0),
                                    .white.opacity(0.3),
                                    .white.opacity(0.0)
                                ],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .opacity(successTrigger ? 1.0 : 0.0)
                        .offset(x: successTrigger ? 100 : -100)
                )
                .scaleEffect(pressScale)
                .glow(color: style.colors.background, radius: glowIntensity)
                .shadow(
                    color: style.colors.background.opacity(0.3),
                    radius: isPressed ? 2 : 8,
                    x: 0,
                    y: isPressed ? 1 : 4
                )
            }
            .buttonStyle(.plain)
            .onHover { hovering in
                withAnimation(.easeOut(duration: 0.2)) {
                    isHovered = hovering
                    glowIntensity = hovering ? 4 : 0
                }
            }
            .onLongPressGesture(minimumDuration: 0, maximumDistance: .infinity, pressing: { pressing in
                handlePress(pressing)
            }, perform: {})
            .conditionalEffect(
                .hapticFeedback(.impact(intensity: hapticStyle.impact)),
                condition: isPressed && hapticStyle != .none
            )
        }
        
        private func handlePress(_ pressing: Bool) {
            withAnimation(.easeOut(duration: 0.1)) {
                isPressed = pressing
                pressScale = pressing ? 0.95 : 1.0
            }
            
            if pressing {
                // Ripple animation
                withAnimation(.easeOut(duration: 0.6)) {
                    rippleOffset = 100
                }
                
                // Reset ripple after animation
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) {
                    rippleOffset = 0
                }
            }
        }
        
        private func performAction() {
            action()
            triggerSuccessAnimation()
        }
        
        private func triggerSuccessAnimation() {
            withAnimation(.easeOut(duration: 0.8)) {
                successTrigger = true
            }
            
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
                successTrigger = false
            }
        }
    }
    
    // MARK: - Interactive Toggle Switch
    struct InteractiveToggle: View {
        @Binding var isOn: Bool
        let onColor: Color
        let offColor: Color
        let hapticEnabled: Bool
        
        @State private var dragOffset: CGFloat = 0
        @State private var isDragging = false
        @State private var knobScale: CGFloat = 1.0
        @State private var backgroundPulse: CGFloat = 1.0
        
        private let switchWidth: CGFloat = 54
        private let switchHeight: CGFloat = 32
        private let knobSize: CGFloat = 26
        
        init(
            isOn: Binding<Bool>,
            onColor: Color = .green,
            offColor: Color = .gray,
            hapticEnabled: Bool = true
        ) {
            self._isOn = isOn
            self.onColor = onColor
            self.offColor = offColor
            self.hapticEnabled = hapticEnabled
        }
        
        var body: some View {
            ZStack {
                // Background track
                RoundedRectangle(cornerRadius: switchHeight / 2, style: .continuous)
                    .fill(isOn ? onColor : offColor)
                    .frame(width: switchWidth, height: switchHeight)
                    .scaleEffect(backgroundPulse)
                    .overlay(
                        // Inner shadow effect
                        RoundedRectangle(cornerRadius: switchHeight / 2, style: .continuous)
                            .stroke(Color.black.opacity(0.1), lineWidth: 1)
                            .blur(radius: 1)
                    )
                
                // Animated background particles
                if isOn {
                    Circle()
                        .fill(onColor.opacity(0.3))
                        .frame(width: 8, height: 8)
                        .offset(x: -8, y: -4)
                        .opacity(0.8)
                        .floating(amplitude: 2, duration: 2)
                    
                    Circle()
                        .fill(onColor.opacity(0.2))
                        .frame(width: 6, height: 6)
                        .offset(x: 8, y: 4)
                        .opacity(0.6)
                        .floating(amplitude: 3, duration: 1.5)
                }
                
                // Toggle knob
                Circle()
                    .fill(.white)
                    .frame(width: knobSize, height: knobSize)
                    .scaleEffect(knobScale)
                    .shadow(color: .black.opacity(0.2), radius: 4, x: 0, y: 2)
                    .overlay(
                        // Knob highlight
                        Circle()
                            .fill(
                                RadialGradient(
                                    colors: [.white, .white.opacity(0.8)],
                                    center: .topLeading,
                                    startRadius: 0,
                                    endRadius: knobSize / 2
                                )
                            )
                    )
                    .offset(x: knobPosition + dragOffset)
                    .gesture(
                        DragGesture()
                            .onChanged { value in
                                if !isDragging {
                                    isDragging = true
                                    withAnimation(.easeOut(duration: 0.1)) {
                                        knobScale = 1.1
                                    }
                                }
                                
                                // Constrain drag within switch bounds
                                let maxOffset = (switchWidth - knobSize) / 2
                                dragOffset = max(-maxOffset, min(maxOffset, value.translation.x))
                            }
                            .onEnded { value in
                                isDragging = false
                                
                                withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                                    knobScale = 1.0
                                    dragOffset = 0
                                }
                                
                                // Determine if toggle should flip
                                let threshold: CGFloat = 20
                                if abs(value.translation.x) > threshold {
                                    let shouldToggle = (value.translation.x > 0 && !isOn) || (value.translation.x < 0 && isOn)
                                    if shouldToggle {
                                        toggleWithFeedback()
                                    }
                                }
                            }
                    )
            }
            .onTapGesture {
                toggleWithFeedback()
            }
            .onChange(of: isOn) { _ in
                animateBackgroundPulse()
            }
        }
        
        private var knobPosition: CGFloat {
            let maxOffset = (switchWidth - knobSize) / 2
            return isOn ? maxOffset : -maxOffset
        }
        
        private func toggleWithFeedback() {
            withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                isOn.toggle()
            }
            
            if hapticEnabled {
                // Trigger haptic feedback
                #if os(iOS)
                let impactGenerator = UIImpactFeedbackGenerator(style: .medium)
                impactGenerator.impactOccurred()
                #endif
            }
        }
        
        private func animateBackgroundPulse() {
            withAnimation(.easeOut(duration: 0.2)) {
                backgroundPulse = 1.05
            }
            
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
                withAnimation(.easeOut(duration: 0.2)) {
                    backgroundPulse = 1.0
                }
            }
        }
    }
    
    // MARK: - Interactive Slider
    struct InteractiveSlider: View {
        @Binding var value: Double
        let range: ClosedRange<Double>
        let step: Double?
        let trackColor: Color
        let fillColor: Color
        let thumbColor: Color
        let hapticEnabled: Bool
        
        @State private var isDragging = false
        @State private var thumbScale: CGFloat = 1.0
        @State private var trackHeight: CGFloat = 6
        @State private var lastHapticValue: Double = 0
        
        private let defaultTrackHeight: CGFloat = 6
        private let activeTrackHeight: CGFloat = 8
        private let thumbSize: CGFloat = 20
        
        init(
            value: Binding<Double>,
            in range: ClosedRange<Double> = 0...1,
            step: Double? = nil,
            trackColor: Color = .gray.opacity(0.3),
            fillColor: Color = .blue,
            thumbColor: Color = .white,
            hapticEnabled: Bool = true
        ) {
            self._value = value
            self.range = range
            self.step = step
            self.trackColor = trackColor
            self.fillColor = fillColor
            self.thumbColor = thumbColor
            self.hapticEnabled = hapticEnabled
        }
        
        var body: some View {
            GeometryReader { geometry in
                let trackWidth = geometry.size.width - thumbSize
                let normalizedValue = (value - range.lowerBound) / (range.upperBound - range.lowerBound)
                let thumbPosition = trackWidth * normalizedValue
                
                ZStack(alignment: .leading) {
                    // Track background
                    RoundedRectangle(cornerRadius: trackHeight / 2, style: .continuous)
                        .fill(trackColor)
                        .frame(height: trackHeight)
                        .offset(x: thumbSize / 2)
                    
                    // Fill track
                    RoundedRectangle(cornerRadius: trackHeight / 2, style: .continuous)
                        .fill(fillColor)
                        .frame(width: thumbPosition + thumbSize / 2, height: trackHeight)
                        .offset(x: thumbSize / 2)
                        .overlay(
                            // Progress shine effect
                            LinearGradient(
                                colors: [
                                    .white.opacity(0.0),
                                    .white.opacity(0.3),
                                    .white.opacity(0.0)
                                ],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                            .clipShape(RoundedRectangle(cornerRadius: trackHeight / 2, style: .continuous))
                        )
                    
                    // Thumb
                    Circle()
                        .fill(thumbColor)
                        .frame(width: thumbSize, height: thumbSize)
                        .scaleEffect(thumbScale)
                        .shadow(color: .black.opacity(0.2), radius: 4, x: 0, y: 2)
                        .overlay(
                            Circle()
                                .fill(
                                    RadialGradient(
                                        colors: [.white.opacity(0.8), .white.opacity(0.4)],
                                        center: .topLeading,
                                        startRadius: 0,
                                        endRadius: thumbSize / 2
                                    )
                                )
                        )
                        .glow(color: fillColor, radius: isDragging ? 6 : 0)
                        .offset(x: thumbPosition)
                        .gesture(
                            DragGesture()
                                .onChanged { dragValue in
                                    if !isDragging {
                                        isDragging = true
                                        withAnimation(.easeOut(duration: 0.1)) {
                                            thumbScale = 1.2
                                            trackHeight = activeTrackHeight
                                        }
                                    }
                                    
                                    let newPosition = max(0, min(trackWidth, dragValue.location.x - thumbSize / 2))
                                    let newNormalizedValue = newPosition / trackWidth
                                    var newValue = range.lowerBound + newNormalizedValue * (range.upperBound - range.lowerBound)
                                    
                                    // Apply step if specified
                                    if let step = step {
                                        newValue = round(newValue / step) * step
                                    }
                                    
                                    // Clamp to range
                                    newValue = max(range.lowerBound, min(range.upperBound, newValue))
                                    
                                    // Haptic feedback on value change
                                    if hapticEnabled && abs(newValue - lastHapticValue) >= (step ?? 0.1) {
                                        lastHapticValue = newValue
                                        #if os(iOS)
                                        let selectionGenerator = UISelectionFeedbackGenerator()
                                        selectionGenerator.selectionChanged()
                                        #endif
                                    }
                                    
                                    value = newValue
                                }
                                .onEnded { _ in
                                    isDragging = false
                                    withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                                        thumbScale = 1.0
                                        trackHeight = defaultTrackHeight
                                    }
                                }
                        )
                }
            }
            .frame(height: thumbSize)
        }
    }
    
    // MARK: - Interactive Rating System
    struct InteractiveRating: View {
        @Binding var rating: Int
        let maxRating: Int
        let starSize: CGFloat
        let fillColor: Color
        let emptyColor: Color
        let hapticEnabled: Bool
        
        @State private var hoverRating: Int = 0
        @State private var isAnimating = false
        
        init(
            rating: Binding<Int>,
            maxRating: Int = 5,
            starSize: CGFloat = 24,
            fillColor: Color = .yellow,
            emptyColor: Color = .gray.opacity(0.3),
            hapticEnabled: Bool = true
        ) {
            self._rating = rating
            self.maxRating = maxRating
            self.starSize = starSize
            self.fillColor = fillColor
            self.emptyColor = emptyColor
            self.hapticEnabled = hapticEnabled
        }
        
        var body: some View {
            HStack(spacing: 4) {
                ForEach(1...maxRating, id: \.self) { index in
                    let isSelected = index <= (hoverRating > 0 ? hoverRating : rating)
                    
                    Image(systemName: isSelected ? "star.fill" : "star")
                        .font(.system(size: starSize))
                        .foregroundColor(isSelected ? fillColor : emptyColor)
                        .scaleEffect(isAnimating && index == rating ? 1.3 : 1.0)
                        .glow(color: fillColor, radius: isSelected && hoverRating > 0 ? 4 : 0)
                        .onTapGesture {
                            setRating(index)
                        }
                        .onHover { hovering in
                            if hovering {
                                hoverRating = index
                            } else {
                                hoverRating = 0
                            }
                        }
                        .conditionalEffect(.bounce, condition: index == rating && isAnimating)
                }
            }
        }
        
        private func setRating(_ newRating: Int) {
            rating = newRating
            
            // Animate the selected star
            withAnimation(.spring(response: 0.3, dampingFraction: 0.6)) {
                isAnimating = true
            }
            
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                isAnimating = false
            }
            
            // Haptic feedback
            if hapticEnabled {
                #if os(iOS)
                let impactGenerator = UIImpactFeedbackGenerator(style: .light)
                impactGenerator.impactOccurred()
                #endif
            }
        }
    }
    
    // MARK: - Interactive Card with Hover Effects
    struct InteractiveCard<Content: View>: View {
        let content: Content
        let cornerRadius: CGFloat
        let hapticEnabled: Bool
        let onTap: (() -> Void)?
        
        @State private var isHovered = false
        @State private var isPressed = false
        @State private var rotationX: Double = 0
        @State private var rotationY: Double = 0
        @State private var scale: CGFloat = 1.0
        
        init(
            cornerRadius: CGFloat = 16,
            hapticEnabled: Bool = true,
            onTap: (() -> Void)? = nil,
            @ViewBuilder content: () -> Content
        ) {
            self.content = content()
            self.cornerRadius = cornerRadius
            self.hapticEnabled = hapticEnabled
            self.onTap = onTap
        }
        
        var body: some View {
            content
                .background(
                    RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                        .fill(.ultraThinMaterial)
                        .overlay(
                            RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                                .stroke(.white.opacity(0.1), lineWidth: 1)
                        )
                        .shadow(
                            color: .black.opacity(0.1),
                            radius: isHovered ? 20 : 10,
                            x: 0,
                            y: isHovered ? 10 : 5
                        )
                )
                .scaleEffect(scale)
                .rotation3DEffect(
                    .degrees(rotationX),
                    axis: (x: 1, y: 0, z: 0),
                    perspective: 0.5
                )
                .rotation3DEffect(
                    .degrees(rotationY),
                    axis: (x: 0, y: 1, z: 0),
                    perspective: 0.5
                )
                .onHover { hovering in
                    withAnimation(.easeOut(duration: 0.3)) {
                        isHovered = hovering
                        scale = hovering ? 1.05 : 1.0
                    }
                }
                .onTapGesture {
                    if let onTap = onTap {
                        performTapAction(onTap)
                    }
                }
                .gesture(
                    DragGesture(minimumDistance: 0)
                        .onChanged { value in
                            if !isPressed {
                                isPressed = true
                                withAnimation(.easeOut(duration: 0.1)) {
                                    scale = 0.98
                                }
                            }
                            
                            // Calculate 3D rotation based on drag position
                            let rotationRange: Double = 10
                            rotationY = Double(value.location.x / 100) * rotationRange - rotationRange / 2
                            rotationX = Double(value.location.y / 100) * -rotationRange + rotationRange / 2
                        }
                        .onEnded { _ in
                            isPressed = false
                            withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
                                scale = isHovered ? 1.05 : 1.0
                                rotationX = 0
                                rotationY = 0
                            }
                        }
                )
        }
        
        private func performTapAction(_ action: @escaping () -> Void) {
            // Scale animation
            withAnimation(.easeOut(duration: 0.1)) {
                scale = 0.95
            }
            
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                    scale = 1.0
                }
                action()
            }
            
            // Haptic feedback
            if hapticEnabled {
                #if os(iOS)
                let impactGenerator = UIImpactFeedbackGenerator(style: .medium)
                impactGenerator.impactOccurred()
                #endif
            }
        }
    }
}

#Preview {
    VStack(spacing: 30) {
        MicroInteractionSystem.InteractiveButton(
            "Primary Action",
            icon: "star.fill",
            style: .primary
        ) {
            print("Primary action triggered")
        }
        
        HStack {
            Text("Enable Notifications")
            Spacer()
            MicroInteractionSystem.InteractiveToggle(
                isOn: .constant(true),
                onColor: .green
            )
        }
        
        MicroInteractionSystem.InteractiveSlider(
            value: .constant(0.7),
            in: 0...1,
            fillColor: .blue
        )
        .frame(height: 30)
        
        MicroInteractionSystem.InteractiveRating(
            rating: .constant(4),
            maxRating: 5
        )
        
        MicroInteractionSystem.InteractiveCard {
            VStack(alignment: .leading, spacing: 8) {
                Text("Interactive Card")
                    .font(.headline)
                Text("Hover and interact with this card to see 3D effects")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            .padding()
        } onTap: {
            print("Card tapped")
        }
    }
    .padding()
    .background(.black.opacity(0.1))
}