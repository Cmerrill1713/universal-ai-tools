import SwiftUI

/// Modern UI Components Library with Advanced Animations
/// Integrates sophisticated visual effects and interactions for the Universal AI Tools app
struct ModernUIComponentsLibrary {
    
    // MARK: - Enhanced Button Components
    
    /// Modern Action Button with Spring Animations
    struct EnhancedActionButton: View {
        let title: String
        let icon: String?
        let action: () -> Void
        let style: ButtonStyle
        let isLoading: Bool
        
        @State private var isPressed = false
        @State private var hoverScale: CGFloat = 1.0
        
        enum ButtonStyle {
            case primary, secondary, destructive, ghost
            
            var backgroundColor: Color {
                switch self {
                case .primary: return .blue
                case .secondary: return .gray.opacity(0.2)
                case .destructive: return .red
                case .ghost: return .clear
                }
            }
            
            var foregroundColor: Color {
                switch self {
                case .primary, .destructive: return .white
                case .secondary, .ghost: return .primary
                }
            }
        }
        
        init(
            title: String,
            icon: String? = nil,
            action: @escaping () -> Void,
            style: ButtonStyle = .primary,
            isLoading: Bool = false
        ) {
            self.title = title
            self.icon = icon
            self.action = action
            self.style = style
            self.isLoading = isLoading
        }
        
        var body: some View {
            Button(action: {
                if !isLoading {
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.6)) {
                        isPressed = true
                    }
                    
                    // Haptic feedback
                    NSHapticFeedbackManager.defaultPerformer.perform(.generic, performanceTime: .now)
                    
                    action()
                    
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                        withAnimation(.spring(response: 0.3, dampingFraction: 0.6)) {
                            isPressed = false
                        }
                    }
                }
            }) {
                HStack(spacing: 8) {
                    if isLoading {
                        ModernLoadingSpinner(size: 16, color: style.foregroundColor)
                    } else if let icon = icon {
                        Image(systemName: icon)
                            .font(.system(size: 14, weight: .medium))
                    }
                    
                    Text(title)
                        .font(.system(size: 14, weight: .medium))
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .foregroundColor(style.foregroundColor)
                .background(
                    RoundedRectangle(cornerRadius: 8)
                        .fill(style.backgroundColor)
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(style == .ghost ? Color.primary.opacity(0.3) : Color.clear, lineWidth: 1)
                        )
                )
                .scaleEffect(isPressed ? 0.96 : hoverScale)
                .animation(.spring(response: 0.3, dampingFraction: 0.6), value: isPressed)
                .animation(.easeInOut(duration: 0.2), value: hoverScale)
            }
            .buttonStyle(.plain)
            .onHover { hovering in
                withAnimation(.easeInOut(duration: 0.2)) {
                    hoverScale = hovering ? 1.02 : 1.0
                }
            }
            .disabled(isLoading)
        }
    }
    
    // MARK: - Enhanced Cards
    
    /// Modern Data Card with Particle Effects
    struct ParticleDataCard: View {
        let title: String
        let value: String
        let trend: TrendDirection
        let color: Color
        
        @State private var particleOffset: CGFloat = 0
        @State private var glowIntensity: Double = 0.5
        
        enum TrendDirection {
            case rising, falling, stable
            
            var icon: String {
                switch self {
                case .rising: return "arrow.up.right"
                case .falling: return "arrow.down.right"
                case .stable: return "arrow.right"
                }
            }
            
            var color: Color {
                switch self {
                case .rising: return .green
                case .falling: return .red
                case .stable: return .gray
                }
            }
        }
        
        var body: some View {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Text(title)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .fontWeight(.medium)
                    
                    Spacer()
                    
                    HStack(spacing: 4) {
                        Image(systemName: trend.icon)
                            .font(.caption2)
                            .foregroundColor(trend.color)
                        
                        // Floating particles for positive trends
                        if trend == .rising {
                            ForEach(0..<3, id: \.self) { index in
                                Circle()
                                    .fill(trend.color)
                                    .frame(width: 2, height: 2)
                                    .offset(y: particleOffset - CGFloat(index * 8))
                                    .opacity(0.6)
                            }
                        }
                    }
                }
                
                Text(value)
                    .font(.title2)
                    .fontWeight(.bold)
                    .foregroundColor(.primary)
                    .shadow(color: color.opacity(glowIntensity), radius: 4, x: 0, y: 0)
            }
            .padding()
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(.ultraThinMaterial)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(
                                LinearGradient(
                                    colors: [color.opacity(0.5), color.opacity(0.1)],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                ),
                                lineWidth: 1
                            )
                    )
            )
            .onAppear {
                if trend == .rising {
                    withAnimation(.linear(duration: 2).repeatForever(autoreverses: false)) {
                        particleOffset = -20
                    }
                }
                
                withAnimation(.easeInOut(duration: 2).repeatForever(autoreverses: true)) {
                    glowIntensity = 0.8
                }
            }
        }
    }
    
    // MARK: - Enhanced Status Components
    
    /// Animated Connection Status with Pow Effects
    struct AnimatedConnectionStatus: View {
        let status: ConnectionStatus
        
        @State private var pulseScale: CGFloat = 1.0
        @State private var rotationAngle: Double = 0
        
        enum ConnectionStatus {
            case connected, connecting, disconnected, failed
            
            var color: Color {
                switch self {
                case .connected: return .green
                case .connecting: return .orange
                case .disconnected: return .gray
                case .failed: return .red
                }
            }
            
            var icon: String {
                switch self {
                case .connected: return "wifi"
                case .connecting: return "wifi.exclamationmark"
                case .disconnected: return "wifi.slash"
                case .failed: return "wifi.slash"
                }
            }
            
            var label: String {
                switch self {
                case .connected: return "Connected"
                case .connecting: return "Connecting..."
                case .disconnected: return "Disconnected"
                case .failed: return "Connection Failed"
                }
            }
        }
        
        var body: some View {
            HStack(spacing: 8) {
                ZStack {
                    // Background pulse for connected state
                    if status == .connected {
                        Circle()
                            .fill(status.color.opacity(0.2))
                            .frame(width: 20, height: 20)
                            .scaleEffect(pulseScale)
                    }
                    
                    // Main icon
                    Image(systemName: status.icon)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(status.color)
                        .rotationEffect(.degrees(status == .connecting ? rotationAngle : 0))
                }
                
                Text(status.label)
                    .font(.caption)
                    .fontWeight(.medium)
                    .foregroundColor(status.color)
            }
            .onAppear {
                setupAnimations()
            }
            .onChange(of: status) { _ in
                setupAnimations()
            }
        }
        
        private func setupAnimations() {
            switch status {
            case .connected:
                withAnimation(.easeInOut(duration: 1.5).repeatForever(autoreverses: true)) {
                    pulseScale = 1.3
                }
                
            case .connecting:
                withAnimation(.linear(duration: 1).repeatForever(autoreverses: false)) {
                    rotationAngle = 360
                }
                
            default:
                break
            }
        }
    }
    
    /// Enhanced Status Badge with Animations
    struct EnhancedStatusBadge: View {
        let status: String
        let type: BadgeType
        
        @State private var shimmerOffset: CGFloat = -100
        
        enum BadgeType {
            case info, success, warning, error, active
            
            var backgroundColor: Color {
                switch self {
                case .info: return .blue.opacity(0.1)
                case .success: return .green.opacity(0.1)
                case .warning: return .orange.opacity(0.1)
                case .error: return .red.opacity(0.1)
                case .active: return .purple.opacity(0.1)
                }
            }
            
            var foregroundColor: Color {
                switch self {
                case .info: return .blue
                case .success: return .green
                case .warning: return .orange
                case .error: return .red
                case .active: return .purple
                }
            }
        }
        
        var body: some View {
            Text(status)
                .font(.caption2)
                .fontWeight(.semibold)
                .foregroundColor(type.foregroundColor)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(
                    RoundedRectangle(cornerRadius: 6)
                        .fill(type.backgroundColor)
                        .overlay(
                            // Shimmer effect for active badges
                            type == .active ?
                            RoundedRectangle(cornerRadius: 6)
                                .fill(
                                    LinearGradient(
                                        colors: [.clear, .white.opacity(0.3), .clear],
                                        startPoint: .leading,
                                        endPoint: .trailing
                                    )
                                )
                                .offset(x: shimmerOffset)
                                .clipped()
                            : nil
                        )
                )
                .onAppear {
                    if type == .active {
                        withAnimation(.linear(duration: 1.5).repeatForever(autoreverses: false)) {
                            shimmerOffset = 100
                        }
                    }
                }
        }
    }
    
    // MARK: - Modern Loading Components
    
    /// Advanced Loading Spinner with Morphing Shapes
    struct ModernLoadingSpinner: View {
        let size: CGFloat
        let color: Color
        
        @State private var rotationAngle: Double = 0
        @State private var morphProgress: Double = 0
        
        init(size: CGFloat = 24, color: Color = .blue) {
            self.size = size
            self.color = color
        }
        
        var body: some View {
            ZStack {
                // Outer ring
                Circle()
                    .trim(from: 0, to: 0.7)
                    .stroke(color, style: StrokeStyle(lineWidth: 2, lineCap: .round))
                    .frame(width: size, height: size)
                    .rotationEffect(.degrees(rotationAngle))
                
                // Inner morphing shape
                RoundedRectangle(cornerRadius: morphProgress * size / 4)
                    .fill(color.opacity(0.3))
                    .frame(width: size * 0.3, height: size * 0.3)
                    .scaleEffect(0.5 + morphProgress * 0.5)
            }
            .onAppear {
                withAnimation(.linear(duration: 1).repeatForever(autoreverses: false)) {
                    rotationAngle = 360
                }
                
                withAnimation(.easeInOut(duration: 1.5).repeatForever(autoreverses: true)) {
                    morphProgress = 1.0
                }
            }
        }
    }
    
    /// Sophisticated Progress Ring
    struct ProgressRing: View {
        let progress: Double
        let size: CGFloat
        let lineWidth: CGFloat
        let color: Color
        
        @State private var animatedProgress: Double = 0
        
        init(progress: Double, size: CGFloat = 40, lineWidth: CGFloat = 4, color: Color = .blue) {
            self.progress = progress
            self.size = size
            self.lineWidth = lineWidth
            self.color = color
        }
        
        var body: some View {
            ZStack {
                // Background circle
                Circle()
                    .stroke(color.opacity(0.2), lineWidth: lineWidth)
                
                // Progress circle
                Circle()
                    .trim(from: 0, to: animatedProgress)
                    .stroke(
                        AngularGradient(
                            colors: [color.opacity(0.5), color, color.opacity(0.5)],
                            center: .center,
                            startAngle: .degrees(-90),
                            endAngle: .degrees(270)
                        ),
                        style: StrokeStyle(lineWidth: lineWidth, lineCap: .round)
                    )
                    .rotationEffect(.degrees(-90))
                
                // Center indicator
                Circle()
                    .fill(color)
                    .frame(width: 4, height: 4)
                    .opacity(animatedProgress > 0 ? 1 : 0)
            }
            .frame(width: size, height: size)
            .onAppear {
                withAnimation(.spring(response: 1.5, dampingFraction: 0.8)) {
                    animatedProgress = progress
                }
            }
            .onChange(of: progress) { newProgress in
                withAnimation(.spring(response: 1.0, dampingFraction: 0.8)) {
                    animatedProgress = newProgress
                }
            }
        }
    }
    
    // MARK: - Interactive Elements
    
    /// Morphing Icon Button with State Transitions
    struct MorphingIconButton: View {
        let primaryIcon: String
        let secondaryIcon: String
        let isToggled: Bool
        let action: () -> Void
        
        @State private var morphProgress: Double = 0
        @State private var pressScale: CGFloat = 1.0
        
        var body: some View {
            Button(action: {
                withAnimation(.spring(response: 0.3, dampingFraction: 0.6)) {
                    pressScale = 0.9
                }
                
                action()
                
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.6)) {
                        pressScale = 1.0
                    }
                }
            }) {
                ZStack {
                    // Background with morphing shape
                    RoundedRectangle(cornerRadius: 8 + morphProgress * 12)
                        .fill(.ultraThinMaterial)
                        .frame(width: 32, height: 32)
                    
                    // Icon overlay
                    Image(systemName: isToggled ? secondaryIcon : primaryIcon)
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(.primary)
                        .scaleEffect(pressScale)
                }
            }
            .buttonStyle(.plain)
            .onAppear {
                withAnimation(.easeInOut(duration: 0.5)) {
                    morphProgress = isToggled ? 1.0 : 0.0
                }
            }
            .onChange(of: isToggled) { newValue in
                withAnimation(.spring(response: 0.6, dampingFraction: 0.7)) {
                    morphProgress = newValue ? 1.0 : 0.0
                }
            }
        }
    }
    
    // MARK: - Advanced Visual Effects
    
    /// Particle Field Background
    struct ParticleField: View {
        let particleCount: Int
        let animationDuration: Double
        
        @State private var particles: [ParticleData] = []
        
        struct ParticleData: Identifiable {
            let id = UUID()
            var position: CGPoint
            var velocity: CGPoint
            var size: CGFloat
            var opacity: Double
            var color: Color
        }
        
        init(particleCount: Int = 50, animationDuration: Double = 20.0) {
            self.particleCount = particleCount
            self.animationDuration = animationDuration
        }
        
        var body: some View {
            GeometryReader { geometry in
                ForEach(particles) { particle in
                    Circle()
                        .fill(particle.color)
                        .frame(width: particle.size, height: particle.size)
                        .position(particle.position)
                        .opacity(particle.opacity)
                        .blur(radius: 1)
                }
            }
            .onAppear {
                generateParticles(in: CGSize(width: 800, height: 600))
                animateParticles()
            }
        }
        
        private func generateParticles(in size: CGSize) {
            particles = (0..<particleCount).map { _ in
                ParticleData(
                    position: CGPoint(
                        x: CGFloat.random(in: 0...size.width),
                        y: CGFloat.random(in: 0...size.height)
                    ),
                    velocity: CGPoint(
                        x: CGFloat.random(in: -1...1),
                        y: CGFloat.random(in: -2...0)
                    ),
                    size: CGFloat.random(in: 1...3),
                    opacity: Double.random(in: 0.1...0.6),
                    color: [.blue, .purple, .pink, .cyan].randomElement() ?? .blue
                )
            }
        }
        
        private func animateParticles() {
            withAnimation(.linear(duration: animationDuration).repeatForever(autoreverses: false)) {
                for index in particles.indices {
                    particles[index].position.y -= 800
                    particles[index].position.x += particles[index].velocity.x * 100
                }
            }
        }
    }
    
    /// Animated Gradient Background
    struct AnimatedGradientBackground: View {
        @State private var animateGradient = false
        
        var body: some View {
            LinearGradient(
                colors: [
                    .blue.opacity(0.1),
                    .purple.opacity(0.05),
                    .pink.opacity(0.1),
                    .cyan.opacity(0.05)
                ],
                startPoint: animateGradient ? .topLeading : .bottomTrailing,
                endPoint: animateGradient ? .bottomTrailing : .topLeading
            )
            .onAppear {
                withAnimation(.linear(duration: 10).repeatForever(autoreverses: true)) {
                    animateGradient.toggle()
                }
            }
        }
    }
    
    // MARK: - Contextual Helpers
    
    /// Smart Tooltip with Dynamic Positioning
    struct SmartTooltip: View {
        let text: String
        let isVisible: Bool
        
        var body: some View {
            if isVisible {
                Text(text)
                    .font(.caption)
                    .foregroundColor(.white)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(
                        RoundedRectangle(cornerRadius: 6)
                            .fill(.black.opacity(0.8))
                    )
                    .transition(.opacity.combined(with: .scale(scale: 0.8)))
                    .animation(.spring(response: 0.3, dampingFraction: 0.7), value: isVisible)
            }
        }
    }
    
    /// Feature Discovery Badge
    struct FeatureDiscoveryBadge: View {
        let type: BadgeType
        
        @State private var pulseScale: CGFloat = 1.0
        @State private var rotationAngle: Double = 0
        
        enum BadgeType {
            case new, pro, beta, updated
            
            var text: String {
                switch self {
                case .new: return "NEW"
                case .pro: return "PRO"
                case .beta: return "BETA"
                case .updated: return "UPDATED"
                }
            }
            
            var color: Color {
                switch self {
                case .new: return .green
                case .pro: return .purple
                case .beta: return .orange
                case .updated: return .blue
                }
            }
        }
        
        var body: some View {
            Text(type.text)
                .font(.caption2)
                .fontWeight(.bold)
                .foregroundColor(.white)
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(
                    RoundedRectangle(cornerRadius: 4)
                        .fill(type.color)
                        .scaleEffect(pulseScale)
                )
                .rotationEffect(.degrees(rotationAngle))
                .onAppear {
                    if type == .new || type == .updated {
                        withAnimation(.easeInOut(duration: 1.5).repeatForever(autoreverses: true)) {
                            pulseScale = 1.1
                        }
                    }
                    
                    if type == .beta {
                        withAnimation(.linear(duration: 8).repeatForever(autoreverses: false)) {
                            rotationAngle = 360
                        }
                    }
                }
        }
    }
}

// MARK: - Preview
#Preview {
    VStack(spacing: 20) {
        ModernUIComponentsLibrary.EnhancedActionButton(
            title: "Enhanced Button",
            icon: "star.fill",
            action: { print("Button tapped") },
            style: .primary,
            isLoading: false
        )
        
        ModernUIComponentsLibrary.ParticleDataCard(
            title: "Performance",
            value: "95%",
            trend: .rising,
            color: .green
        )
        
        ModernUIComponentsLibrary.AnimatedConnectionStatus(status: .connected)
        
        ModernUIComponentsLibrary.ProgressRing(progress: 0.75)
        
        ModernUIComponentsLibrary.FeatureDiscoveryBadge(type: .new)
    }
    .padding()
    .background(ModernUIComponentsLibrary.AnimatedGradientBackground())
}