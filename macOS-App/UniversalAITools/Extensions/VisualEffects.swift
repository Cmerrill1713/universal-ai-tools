import SwiftUI

// MARK: - Glassmorphism Effect
struct GlassMorphism: ViewModifier {
    var cornerRadius: CGFloat = 20
    var blurRadius: CGFloat = 10
    var saturation: Double = 1.8
    var opacity: Double = 0.6
    var borderWidth: CGFloat = 1

    func body(content: Content) -> some View {
        content
            .background(
                ZStack {
                    // Blur layer
                    RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                        .fill(.ultraThinMaterial)
                        .blur(radius: blurRadius)

                    // Gradient overlay
                    LinearGradient(
                        colors: [
                            Color.white.opacity(0.25),
                            Color.white.opacity(0.05)
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                    .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
                }
            )
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .stroke(
                        LinearGradient(
                            colors: [
                                Color.white.opacity(0.6),
                                Color.white.opacity(0.2)
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        lineWidth: borderWidth
                    )
            )
            .saturation(saturation)
            .shadow(color: .black.opacity(0.1), radius: 10, x: 0, y: 10)
    }
}

// MARK: - Neumorphism Effect
struct Neumorphism: ViewModifier {
    var shape = RoundedRectangle(cornerRadius: 20, style: .continuous)
    var isPressed: Bool = false
    var lightShadowColor = Color.white.opacity(0.7)
    var darkShadowColor = Color.black.opacity(0.2)
    var fillColor = Color(NSColor.controlBackgroundColor)

    func body(content: Content) -> some View {
        content
            .background(
                ZStack {
                    if isPressed {
                        shape
                            .fill(fillColor)
                            .overlay(
                                shape
                                    .stroke(Color.gray.opacity(0.1), lineWidth: 2)
                                    .blur(radius: 1)
                                    .offset(x: 2, y: 2)
                                    .mask(shape.fill(LinearGradient(colors: [.black, .clear], startPoint: .topLeading, endPoint: .bottomTrailing)))
                            )
                            .overlay(
                                shape
                                    .stroke(lightShadowColor, lineWidth: 2)
                                    .blur(radius: 1)
                                    .offset(x: -2, y: -2)
                                    .mask(shape.fill(LinearGradient(colors: [.clear, .black], startPoint: .topLeading, endPoint: .bottomTrailing)))
                            )
                    } else {
                        shape
                            .fill(fillColor)
                            .shadow(color: darkShadowColor, radius: 10, x: 10, y: 10)
                            .shadow(color: lightShadowColor, radius: 10, x: -5, y: -5)
                    }
                }
            )
    }
}

// MARK: - Liquid Glass Effect (Apple's New Design)
struct LiquidGlass: ViewModifier {
    @State private var animationPhase: CGFloat = 0
    @State private var animationTask: Task<Void, Never>?
    var cornerRadius: CGFloat = 20

    func body(content: Content) -> some View {
        content
            .background(
                ZStack {
                    // Base glass layer
                    RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                        .fill(.ultraThinMaterial)

                    // Static gradient overlay (removed animation for performance)
                    LinearGradient(
                        colors: [
                            Color.blue.opacity(0.4),
                            Color.orange.opacity(0.3),
                            Color.blue.opacity(0.2),
                            Color.orange.opacity(0.1)
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                    .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
                    .blur(radius: 20)
                    .opacity(0.6)
                }
            )
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .stroke(
                        LinearGradient(
                            colors: [
                                Color.white.opacity(0.8),
                                Color.white.opacity(0.1)
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        lineWidth: 1
                    )
            )
            .onAppear {
                startLightAnimation()
            }
            .onDisappear {
                stopLightAnimation()
            }
    }

    private func startLightAnimation() {
        stopLightAnimation()

        animationTask = Task { @MainActor in
            while !Task.isCancelled {
                withAnimation(.easeInOut(duration: 12)) {
                    animationPhase += 0.1
                }
                try? await Task.sleep(nanoseconds: 12_000_000_000)
            }
        }
    }

    private func stopLightAnimation() {
        animationTask?.cancel()
        animationTask = nil
    }
}

// MARK: - Animated Gradient Background
struct AnimatedGradientBackground: View {
    @State private var animateGradient = false
    @State private var animationTask: Task<Void, Never>?
    @State private var isVisible = true

    var body: some View {
        LinearGradient(
            colors: [
                Color(red: 0.1, green: 0.15, blue: 0.25),
                Color(red: 0.25, green: 0.15, blue: 0.1),
                Color(red: 0.15, green: 0.25, blue: 0.35)
            ],
            startPoint: animateGradient ? .topLeading : .bottomLeading,
            endPoint: animateGradient ? .bottomTrailing : .topTrailing
        )
        .ignoresSafeArea()
        .onAppear {
            startAnimation()
        }
        .onDisappear {
            stopAnimation()
        }
        .onChange(of: isVisible) { visible in
            if visible {
                startAnimation()
            } else {
                stopAnimation()
            }
        }
    }

    private func startAnimation() {
        stopAnimation() // Ensure no duplicate animations

        animationTask = Task { @MainActor in
            while !Task.isCancelled {
                withAnimation(.easeInOut(duration: 8)) {
                    animateGradient.toggle()
                }
                try? await Task.sleep(nanoseconds: 8_000_000_000) // 8 seconds
            }
        }
    }

    private func stopAnimation() {
        animationTask?.cancel()
        animationTask = nil
    }
}

// MARK: - Mesh Gradient (for macOS 15.0+)
struct MeshGradient: View {
    let colors: [Color]
    let locations: [CGPoint]

    var body: some View {
        GeometryReader { _ in
            Canvas { context, size in
                // Create a mesh gradient effect
                for (index, location) in locations.enumerated() {
                    let color = colors[min(index, colors.count - 1)]
                    let center = CGPoint(
                        x: location.x * size.width,
                        y: location.y * size.height
                    )

                    let gradient = Gradient(colors: [color, Color.clear])
                    let ellipsePath = Path(ellipseIn: CGRect(
                        x: center.x - size.width * 0.35,
                        y: center.y - size.width * 0.35,
                        width: size.width * 0.7,
                        height: size.width * 0.7
                    ))

                    context.fill(ellipsePath, with: .radialGradient(
                        gradient,
                        center: center,
                        startRadius: 0,
                        endRadius: size.width * 0.35
                    ))
                }
            }
        }
    }
}

// MARK: - Glow Effect
struct GlowEffect: ViewModifier {
    var color: Color = .accentColor
    var radius: CGFloat = 20

    func body(content: Content) -> some View {
        content
            .shadow(color: color.opacity(0.3), radius: radius * 0.5)
            .shadow(color: color.opacity(0.5), radius: radius * 0.75)
            .shadow(color: color.opacity(0.8), radius: radius)
    }
}

// MARK: - Floating Animation
struct FloatingAnimation: ViewModifier {
    @State private var offset: CGFloat = 0
    @State private var animationTask: Task<Void, Never>?
    var amplitude: CGFloat = 10
    var duration: Double = 2

    func body(content: Content) -> some View {
        content
            .offset(y: offset)
            .onAppear {
                startFloatingAnimation()
            }
            .onDisappear {
                stopFloatingAnimation()
            }
    }

    private func startFloatingAnimation() {
        stopFloatingAnimation()

        animationTask = Task { @MainActor in
            while !Task.isCancelled {
                withAnimation(.easeInOut(duration: duration)) {
                    offset = amplitude
                }
                try? await Task.sleep(nanoseconds: UInt64(duration * 1_000_000_000))

                withAnimation(.easeInOut(duration: duration)) {
                    offset = 0
                }
                try? await Task.sleep(nanoseconds: UInt64(duration * 1_000_000_000))
            }
        }
    }

    private func stopFloatingAnimation() {
        animationTask?.cancel()
        animationTask = nil
    }
}

// MARK: - Pulse Animation
struct PulseAnimation: ViewModifier {
    @State private var scale: CGFloat = 1
    @State private var animationTask: Task<Void, Never>?
    var minScale: CGFloat = 0.95
    var maxScale: CGFloat = 1.05
    var duration: Double = 1

    func body(content: Content) -> some View {
        content
            .scaleEffect(scale)
            .onAppear {
                startPulseAnimation()
            }
            .onDisappear {
                stopPulseAnimation()
            }
    }

    private func startPulseAnimation() {
        stopPulseAnimation()

        animationTask = Task { @MainActor in
            while !Task.isCancelled {
                withAnimation(.easeInOut(duration: duration)) {
                    scale = maxScale
                }
                try? await Task.sleep(nanoseconds: UInt64(duration * 1_000_000_000))

                withAnimation(.easeInOut(duration: duration)) {
                    scale = minScale
                }
                try? await Task.sleep(nanoseconds: UInt64(duration * 1_000_000_000))
            }
        }
    }

    private func stopPulseAnimation() {
        animationTask?.cancel()
        animationTask = nil
    }
}

// MARK: - View Extensions
extension View {
    func glassMorphism(
        cornerRadius: CGFloat = 20,
        blurRadius: CGFloat = 10,
        saturation: Double = 1.8,
        opacity: Double = 0.6
    ) -> some View {
        modifier(GlassMorphism(
            cornerRadius: cornerRadius,
            blurRadius: blurRadius,
            saturation: saturation,
            opacity: opacity
        ))
    }

    func neumorphism(
        isPressed: Bool = false,
        cornerRadius: CGFloat = 20
    ) -> some View {
        modifier(Neumorphism(
            shape: RoundedRectangle(cornerRadius: cornerRadius, style: .continuous),
            isPressed: isPressed
        ))
    }

    func liquidGlass(cornerRadius: CGFloat = 20) -> some View {
        modifier(LiquidGlass(cornerRadius: cornerRadius))
    }

    func glow(color: Color = .accentColor, radius: CGFloat = 20) -> some View {
        modifier(GlowEffect(color: color, radius: radius))
    }

    func floating(amplitude: CGFloat = 10, duration: Double = 2) -> some View {
        modifier(FloatingAnimation(amplitude: amplitude, duration: duration))
    }

    func pulse(minScale: CGFloat = 0.95, maxScale: CGFloat = 1.05, duration: Double = 1) -> some View {
        modifier(PulseAnimation(minScale: minScale, maxScale: maxScale, duration: duration))
    }

    func trackPerformance(_ animationName: String) -> some View {
        modifier(PerformanceTracking(animationName: animationName))
    }
}

// MARK: - Performance Tracking View Modifier
struct PerformanceTracking: ViewModifier {
    let animationName: String
    func body(content: Content) -> some View {
        content
            .onAppear {
                // Performance tracking temporarily disabled for build
                print("Animation started: \(animationName)")
            }
            .onDisappear {
                print("Animation stopped: \(animationName)")
            }
    }
}
