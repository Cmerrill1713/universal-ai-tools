import SwiftUI
import Pow
import Vortex

/// Enhanced UI components with advanced animations and effects
struct EnhancedUIComponents {
    
    /// Animated connection status indicator with Pow effects
    struct AnimatedConnectionStatus: View {
        let status: ConnectionStatus
        @State private var pulseEffect = false
        
        var body: some View {
            HStack(spacing: 8) {
                Circle()
                    .fill(status.color)
                    .frame(width: 8, height: 8)
                    .conditionalEffect(.repeat(.glow(color: status.color, radius: 8), every: 1.5), condition: status == .connected)
                    .conditionalEffect(.repeat(.shine(duration: 1.0), every: 2.0), condition: status == .connecting)
                    .conditionalEffect(.shake(strength: .light), condition: status == .failed)
                
                Text(status.displayName)
                    .font(.caption)
                    .fontWeight(.medium)
                    .foregroundColor(status.color)
                    .changeEffect(.spray(origin: UnitPoint.center) {
                        Image(systemName: "sparkles")
                            .foregroundColor(status.color)
                    }, value: status == .connected)
            }
        }
    }
    
    /// Particle-enhanced data visualization card
    struct ParticleDataCard: View {
        let title: String
        let value: String
        let trend: TrendDirection
        let color: Color
        @State private var particleSystem = VortexSystem()
        
        var body: some View {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Text(title)
                        .font(.caption)
                        .foregroundColor(.secondary)
                    
                    Spacer()
                    
                    Image(systemName: trend.icon)
                        .foregroundColor(trend.color)
                        .conditionalEffect(.spin(axis: (0, 0, 1)), condition: trend == .rising)
                }
                
                HStack {
                    Text(value)
                        .font(.title2)
                        .fontWeight(.bold)
                        .foregroundColor(color)
                        .changeEffect(.rise, value: value)
                    
                    Spacer()
                }
            }
            .padding(16)
            .background(.ultraThinMaterial)
            .cornerRadius(12)
            .overlay(
                // Particle effects for significant changes
                VortexView(particleSystem) {
                    Circle()
                        .fill(color.opacity(0.6))
                        .frame(width: 4, height: 4)
                        .blur(radius: 1)
                }
                .allowsHitTesting(false)
                .opacity(trend == .rising ? 1.0 : 0.0)
            )
            .onAppear {
                setupParticleSystem()
            }
            .onChange(of: trend) { newTrend in
                if newTrend == .rising {
                    triggerParticleEffect()
                }
            }
        }
        
        private func setupParticleSystem() {
            particleSystem.position = [0.5, 0.8]
            particleSystem.speed = 0.5
            particleSystem.speedVariation = 0.3
            particleSystem.lifespan = 1.0
            particleSystem.shape = .circle
            particleSystem.size = 0.1
            particleSystem.sizeVariation = 0.05
        }
        
        private func triggerParticleEffect() {
            particleSystem.burst(count: 20)
        }
    }
    
    /// Enhanced button with multiple animation effects
    struct EnhancedActionButton: View {
        let title: String
        let icon: String
        let action: () -> Void
        let style: ButtonStyle
        @State private var isPressed = false
        @State private var successEffect = false
        
        enum ButtonStyle {
            case primary, secondary, destructive, success
            
            var color: Color {
                switch self {
                case .primary: return .blue
                case .secondary: return .gray
                case .destructive: return .red
                case .success: return .green
                }
            }
        }
        
        var body: some View {
            Button(action: {
                action()
                triggerSuccessEffect()
            }) {
                HStack(spacing: 8) {
                    Image(systemName: icon)
                        .font(.system(size: 14, weight: .medium))
                        .conditionalEffect(.bounce, condition: isPressed)
                    
                    Text(title)
                        .font(.system(size: 14, weight: .medium))
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .background(style.color.opacity(0.1))
                .foregroundColor(style.color)
                .cornerRadius(8)
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(style.color.opacity(0.3), lineWidth: 1)
                )
            }
            .buttonStyle(.plain)
            .scaleEffect(isPressed ? 0.95 : 1.0)
            .conditionalEffect(.shine(duration: 0.8), condition: successEffect)
            .conditionalEffect(.hapticFeedback(.impact(intensity: 0.6)), condition: isPressed)
            .onLongPressGesture(minimumDuration: 0, maximumDistance: .infinity, pressing: { pressing in
                withAnimation(.easeInOut(duration: 0.1)) {
                    isPressed = pressing
                }
            }, perform: {})
        }
        
        private func triggerSuccessEffect() {
            withAnimation(.easeOut(duration: 0.6)) {
                successEffect = true
            }
            
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) {
                successEffect = false
            }
        }
    }
    
    /// Advanced metric visualization with particle trails
    struct MetricVisualization: View {
        let metrics: [MetricDataPoint]
        let color: Color
        @State private var animateChart = false
        @State private var particleSystem = VortexSystem()
        
        var body: some View {
            GeometryReader { geometry in
                ZStack {
                    // Chart background
                    RoundedRectangle(cornerRadius: 12)
                        .fill(.ultraThinMaterial)
                    
                    // Chart line
                    Path { path in
                        guard !metrics.isEmpty else { return }
                        
                        let width = geometry.size.width - 32
                        let height = geometry.size.height - 32
                        let stepX = width / CGFloat(max(metrics.count - 1, 1))
                        
                        let minValue = metrics.map(\.value).min() ?? 0
                        let maxValue = metrics.map(\.value).max() ?? 1
                        let range = maxValue - minValue
                        
                        for (index, metric) in metrics.enumerated() {
                            let x = 16 + CGFloat(index) * stepX
                            let normalizedValue = range > 0 ? (metric.value - minValue) / range : 0.5
                            let y = 16 + height * (1 - normalizedValue)
                            
                            if index == 0 {
                                path.move(to: CGPoint(x: x, y: y))
                            } else {
                                path.addLine(to: CGPoint(x: x, y: y))
                            }
                        }
                    }
                    .trim(from: 0, to: animateChart ? 1 : 0)
                    .stroke(color, lineWidth: 2)
                    .animation(.easeInOut(duration: 1.5), value: animateChart)
                    
                    // Particle trail effect
                    VortexView(particleSystem) {
                        Circle()
                            .fill(color.opacity(0.8))
                            .frame(width: 3, height: 3)
                            .blur(radius: 0.5)
                    }
                    .allowsHitTesting(false)
                }
            }
            .onAppear {
                withAnimation(.easeInOut(duration: 1.5)) {
                    animateChart = true
                }
                setupParticleTrail()
            }
        }
        
        private func setupParticleTrail() {
            particleSystem.position = [0.1, 0.5]
            particleSystem.speed = 0.3
            particleSystem.angleRange = .degrees(0...10)
            particleSystem.lifespan = 2.0
            particleSystem.shape = .circle
            particleSystem.size = 0.05
        }
    }
    
    /// Interactive loading state with advanced animations
    struct EnhancedLoadingIndicator: View {
        let message: String
        @State private var rotationAngle: Double = 0
        @State private var pulseScale: CGFloat = 1.0
        @State private var particleSystem = VortexSystem()
        
        var body: some View {
            VStack(spacing: 20) {
                ZStack {
                    // Outer ring
                    Circle()
                        .stroke(Color.blue.opacity(0.3), lineWidth: 4)
                        .frame(width: 60, height: 60)
                    
                    // Animated arc
                    Circle()
                        .trim(from: 0, to: 0.7)
                        .stroke(Color.blue, lineWidth: 4)
                        .frame(width: 60, height: 60)
                        .rotationEffect(.degrees(rotationAngle))
                        .animation(.linear(duration: 1.0).repeatForever(autoreverses: false), value: rotationAngle)
                    
                    // Center dot with pulse
                    Circle()
                        .fill(Color.blue)
                        .frame(width: 8, height: 8)
                        .scaleEffect(pulseScale)
                        .animation(.easeInOut(duration: 0.8).repeatForever(autoreverses: true), value: pulseScale)
                    
                    // Particle system overlay
                    VortexView(particleSystem) {
                        Circle()
                            .fill(Color.blue.opacity(0.6))
                            .frame(width: 2, height: 2)
                            .blur(radius: 0.5)
                    }
                    .allowsHitTesting(false)
                }
                
                Text(message)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .changeEffect(.sparkle(origin: UnitPoint.center), value: message)
            }
            .onAppear {
                rotationAngle = 360
                pulseScale = 1.2
                setupLoadingParticles()
            }
        }
        
        private func setupLoadingParticles() {
            particleSystem.position = [0.5, 0.5]
            particleSystem.speed = 0.2
            particleSystem.speedVariation = 0.1
            particleSystem.angleRange = .degrees(0...360)
            particleSystem.lifespan = 1.5
            particleSystem.shape = .circle
            particleSystem.size = 0.03
            particleSystem.birthRate = 10
        }
    }
    
    /// Enhanced status badge with contextual animations
    struct EnhancedStatusBadge: View {
        let status: String
        let type: BadgeType
        @State private var glowEffect = false
        
        enum BadgeType {
            case success, warning, error, info, active
            
            var color: Color {
                switch self {
                case .success: return .green
                case .warning: return .orange
                case .error: return .red
                case .info: return .blue
                case .active: return .purple
                }
            }
            
            var icon: String {
                switch self {
                case .success: return "checkmark.circle.fill"
                case .warning: return "exclamationmark.triangle.fill"
                case .error: return "xmark.circle.fill"
                case .info: return "info.circle.fill"
                case .active: return "bolt.circle.fill"
                }
            }
        }
        
        var body: some View {
            HStack(spacing: 6) {
                Image(systemName: type.icon)
                    .font(.caption)
                    .conditionalEffect(.repeat(.glow(color: type.color, radius: 6), every: 2.0), condition: type == .active)
                
                Text(status)
                    .font(.caption2)
                    .fontWeight(.semibold)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(type.color.opacity(0.1))
            .foregroundColor(type.color)
            .cornerRadius(12)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(type.color.opacity(0.3), lineWidth: 1)
            )
            .conditionalEffect(.repeat(.shine(duration: 1.5), every: 3.0), condition: type == .success)
            .conditionalEffect(.repeat(.bounce, every: 1.0), condition: type == .error)
        }
    }
}

// MARK: - Supporting Types

struct MetricDataPoint {
    let timestamp: Date
    let value: Double
}

enum TrendDirection {
    case rising, falling, stable
    
    var icon: String {
        switch self {
        case .rising: return "arrow.up.right"
        case .falling: return "arrow.down.right"
        case .stable: return "minus"
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

// MARK: - Helper Extensions

extension ConnectionStatus {
    var displayName: String {
        switch self {
        case .connected: return "Connected"
        case .connecting: return "Connecting"
        case .disconnected: return "Disconnected"
        case .reconnecting: return "Reconnecting"
        case .failed: return "Failed"
        }
    }
}

#Preview {
    VStack(spacing: 20) {
        EnhancedUIComponents.AnimatedConnectionStatus(status: .connected)
        
        EnhancedUIComponents.ParticleDataCard(
            title: "Active Agents",
            value: "12",
            trend: .rising,
            color: .blue
        )
        
        EnhancedUIComponents.EnhancedActionButton(
            title: "Connect",
            icon: "wifi",
            action: { print("Connected") },
            style: .primary
        )
        
        EnhancedUIComponents.EnhancedStatusBadge(
            status: "Online",
            type: .success
        )
    }
    .padding()
    .frame(width: 300, height: 400)
}