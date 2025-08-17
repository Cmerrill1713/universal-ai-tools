import SwiftUI
import Combine
import QuartzCore

/// Performance-optimized animation system for smooth 120Hz rendering
/// Includes animation pooling, GPU acceleration, and memory management
struct PerformanceOptimizedAnimations {
    
    // MARK: - Animation Pool Manager
    static let shared = AnimationPoolManager()
    
    class AnimationPoolManager: ObservableObject {
        private var activeAnimations: Set<UUID> = []
        private var animationLimiter = AnimationLimiter()
        private let maxConcurrentAnimations = 8
        private let performanceMonitor = PerformanceMonitor()
        
        @Published var isHighPerformanceMode = true
        @Published var currentFPS: Double = 120.0
        
        func requestAnimation(priority: AnimationPriority = .normal) -> UUID? {
            guard activeAnimations.count < maxConcurrentAnimations else {
                return handleAnimationOverflow(priority: priority)
            }
            
            let animationID = UUID()
            activeAnimations.insert(animationID)
            performanceMonitor.trackAnimationStart(animationID)
            return animationID
        }
        
        func releaseAnimation(_ id: UUID) {
            activeAnimations.remove(id)
            performanceMonitor.trackAnimationEnd(id)
        }
        
        private func handleAnimationOverflow(priority: AnimationPriority) -> UUID? {
            guard priority == .high else { return nil }
            
            // Find and cancel lowest priority animation
            if let lowPriorityAnimation = findLowestPriorityAnimation() {
                releaseAnimation(lowPriorityAnimation)
                return requestAnimation(priority: priority)
            }
            
            return nil
        }
        
        private func findLowestPriorityAnimation() -> UUID? {
            // Implementation would track animation priorities
            return activeAnimations.first
        }
    }
    
    enum AnimationPriority {
        case low, normal, high, critical
    }
    
    // MARK: - GPU-Accelerated Animations
    struct GPUOptimizedView: View {
        let content: AnyView
        let animationEnabled: Bool
        
        @State private var animationID: UUID?
        @State private var isRendering = false
        
        init<Content: View>(animationEnabled: Bool = true, @ViewBuilder content: () -> Content) {
            self.content = AnyView(content())
            self.animationEnabled = animationEnabled
        }
        
        var body: some View {
            content
                .drawingGroup() // Force GPU rendering
                .clipped() // Prevent overdraw
                .onAppear {
                    if animationEnabled {
                        animationID = PerformanceOptimizedAnimations.shared.requestAnimation()
                    }
                }
                .onDisappear {
                    if let id = animationID {
                        PerformanceOptimizedAnimations.shared.releaseAnimation(id)
                    }
                }
        }
    }
    
    // MARK: - Optimized Particle System
    struct OptimizedParticleView: View {
        let particleCount: Int
        let color: Color
        let isActive: Bool
        
        @State private var particles: [Particle] = []
        @State private var animationTimer: Timer?
        @State private var lastUpdateTime = CACurrentMediaTime()
        
        private let maxParticles = 100 // Limit for performance
        private let targetFPS = 120.0
        private let frameTime = 1.0 / 120.0
        
        struct Particle {
            var position: CGPoint
            var velocity: CGPoint
            var life: Double
            var maxLife: Double
            var size: CGFloat
            
            var alpha: Double {
                max(0, life / maxLife)
            }
            
            mutating func update(deltaTime: Double) {
                position.x += velocity.x * deltaTime * 60 // Normalize to 60fps
                position.y += velocity.y * deltaTime * 60
                life -= deltaTime
            }
            
            var isDead: Bool {
                life <= 0
            }
        }
        
        var body: some View {
            Canvas { context, size in
                let currentTime = CACurrentMediaTime()
                let deltaTime = min(currentTime - lastUpdateTime, 0.016) // Cap at 16ms
                
                // Update particles
                for (index, var particle) in particles.enumerated() {
                    particle.update(deltaTime: deltaTime)
                    particles[index] = particle
                    
                    // Draw particle
                    if !particle.isDead {
                        let rect = CGRect(
                            x: particle.position.x - particle.size / 2,
                            y: particle.position.y - particle.size / 2,
                            width: particle.size,
                            height: particle.size
                        )
                        
                        context.fill(
                            Path(ellipseIn: rect),
                            with: .color(color.opacity(particle.alpha))
                        )
                    }
                }
                
                // Remove dead particles
                particles.removeAll { $0.isDead }
                
                lastUpdateTime = currentTime
            }
            .onAppear {
                if isActive {
                    startParticleSystem()
                }
            }
            .onDisappear {
                stopParticleSystem()
            }
            .onChange(of: isActive) { active in
                if active {
                    startParticleSystem()
                } else {
                    stopParticleSystem()
                }
            }
        }
        
        private func startParticleSystem() {
            guard animationTimer == nil else { return }
            
            animationTimer = Timer.scheduledTimer(withTimeInterval: frameTime, repeats: true) { _ in
                addParticles()
            }
        }
        
        private func stopParticleSystem() {
            animationTimer?.invalidate()
            animationTimer = nil
        }
        
        private func addParticles() {
            guard particles.count < maxParticles else { return }
            
            let newParticleCount = min(particleCount, maxParticles - particles.count)
            
            for _ in 0..<newParticleCount {
                let particle = Particle(
                    position: CGPoint(
                        x: Double.random(in: 0...300),
                        y: Double.random(in: 0...300)
                    ),
                    velocity: CGPoint(
                        x: Double.random(in: -50...50),
                        y: Double.random(in: -50...50)
                    ),
                    life: Double.random(in: 1...3),
                    maxLife: 3.0,
                    size: CGFloat.random(in: 2...8)
                )
                particles.append(particle)
            }
        }
    }
    
    // MARK: - Smooth Morphing Animation
    struct MorphingView<Content: View>: View {
        let content: Content
        let morphStyle: MorphStyle
        let isActive: Bool
        
        @State private var morphProgress: Double = 0
        @State private var animationID: UUID?
        
        enum MorphStyle {
            case scale, rotation, position, color
            
            var keyframes: [Double] {
                switch self {
                case .scale: return [1.0, 1.2, 0.8, 1.0]
                case .rotation: return [0, 45, -45, 0]
                case .position: return [0, 20, -20, 0]
                case .color: return [0, 0.5, 1.0, 0]
                }
            }
        }
        
        init(style: MorphStyle, isActive: Bool, @ViewBuilder content: () -> Content) {
            self.content = content()
            self.morphStyle = style
            self.isActive = isActive
        }
        
        var body: some View {
            content
                .modifier(MorphModifier(style: morphStyle, progress: morphProgress))
                .onAppear {
                    animationID = PerformanceOptimizedAnimations.shared.requestAnimation(priority: .normal)
                }
                .onDisappear {
                    if let id = animationID {
                        PerformanceOptimizedAnimations.shared.releaseAnimation(id)
                    }
                }
                .onChange(of: isActive) { active in
                    if active {
                        startMorphAnimation()
                    } else {
                        stopMorphAnimation()
                    }
                }
        }
        
        private func startMorphAnimation() {
            withAnimation(.easeInOut(duration: 2.0).repeatForever(autoreverses: true)) {
                morphProgress = 1.0
            }
        }
        
        private func stopMorphAnimation() {
            withAnimation(.easeOut(duration: 0.3)) {
                morphProgress = 0
            }
        }
    }
    
    struct MorphModifier: ViewModifier {
        let style: MorphingView<AnyView>.MorphStyle
        let progress: Double
        
        func body(content: Content) -> some View {
            let keyframes = style.keyframes
            let currentValue = interpolateKeyframes(keyframes, progress: progress)
            
            switch style {
            case .scale:
                content.scaleEffect(currentValue)
            case .rotation:
                content.rotationEffect(.degrees(currentValue))
            case .position:
                content.offset(y: currentValue)
            case .color:
                content.colorMultiply(Color.white.opacity(1.0 - currentValue * 0.3))
            }
        }
        
        private func interpolateKeyframes(_ keyframes: [Double], progress: Double) -> Double {
            guard keyframes.count > 1 else { return keyframes.first ?? 0 }
            
            let segmentCount = keyframes.count - 1
            let segmentProgress = progress * Double(segmentCount)
            let segmentIndex = Int(segmentProgress)
            let localProgress = segmentProgress - Double(segmentIndex)
            
            if segmentIndex >= segmentCount {
                return keyframes.last ?? 0
            }
            
            let startValue = keyframes[segmentIndex]
            let endValue = keyframes[segmentIndex + 1]
            
            return startValue + (endValue - startValue) * localProgress
        }
    }
    
    // MARK: - Memory-Efficient Blur Effect
    struct OptimizedBlurView: View {
        let content: AnyView
        let radius: CGFloat
        let quality: BlurQuality
        
        @State private var shouldUseGPU = true
        
        enum BlurQuality {
            case low, medium, high, adaptive
            
            var sampleCount: Int {
                switch self {
                case .low: return 4
                case .medium: return 8
                case .high: return 16
                case .adaptive: return PerformanceOptimizedAnimations.shared.isHighPerformanceMode ? 16 : 4
                }
            }
        }
        
        init<Content: View>(radius: CGFloat, quality: BlurQuality = .adaptive, @ViewBuilder content: () -> Content) {
            self.content = AnyView(content())
            self.radius = radius
            self.quality = quality
        }
        
        var body: some View {
            Group {
                if shouldUseGPU && radius > 0 {
                    content
                        .blur(radius: radius)
                        .drawingGroup() // GPU acceleration
                } else {
                    content
                }
            }
            .onReceive(PerformanceOptimizedAnimations.shared.$currentFPS) { fps in
                shouldUseGPU = fps > 60 // Disable GPU blur if performance drops
            }
        }
    }
    
    // MARK: - Performance Monitor
    class PerformanceMonitor: ObservableObject {
        private var animationStartTimes: [UUID: CFTimeInterval] = [:]
        private var fpsCounter = FPSCounter()
        
        @Published var averageAnimationDuration: Double = 0
        @Published var currentFPS: Double = 120
        
        func trackAnimationStart(_ id: UUID) {
            animationStartTimes[id] = CACurrentMediaTime()
        }
        
        func trackAnimationEnd(_ id: UUID) {
            guard let startTime = animationStartTimes.removeValue(forKey: id) else { return }
            
            let duration = CACurrentMediaTime() - startTime
            updateAverageAnimationDuration(duration)
        }
        
        private func updateAverageAnimationDuration(_ newDuration: Double) {
            // Simple moving average
            averageAnimationDuration = (averageAnimationDuration * 0.9) + (newDuration * 0.1)
        }
    }
    
    // MARK: - FPS Counter
    class FPSCounter: ObservableObject {
        @Published var fps: Double = 120.0
        
        private var displayLink: CADisplayLink?
        private var frameCount = 0
        private var lastTimestamp: CFTimeInterval = 0
        
        init() {
            startMonitoring()
        }
        
        private func startMonitoring() {
            #if !os(macOS)
            displayLink = CADisplayLink(target: self, selector: #selector(displayLinkDidFire))
            displayLink?.add(to: .main, forMode: .common)
            #endif
        }
        
        @objc private func displayLinkDidFire(_ displayLink: CADisplayLink) {
            if lastTimestamp == 0 {
                lastTimestamp = displayLink.timestamp
                return
            }
            
            frameCount += 1
            
            let elapsed = displayLink.timestamp - lastTimestamp
            if elapsed >= 1.0 {
                fps = Double(frameCount) / elapsed
                frameCount = 0
                lastTimestamp = displayLink.timestamp
                
                // Update global performance state
                PerformanceOptimizedAnimations.shared.currentFPS = fps
            }
        }
        
        deinit {
            displayLink?.invalidate()
        }
    }
    
    // MARK: - Animation Limiter
    struct AnimationLimiter {
        private let maxAnimationsPerFrame = 4
        private var currentFrameAnimations = 0
        private var lastFrameTime: CFTimeInterval = 0
        
        mutating func shouldAllowAnimation() -> Bool {
            let currentTime = CACurrentMediaTime()
            
            // Reset counter on new frame
            if currentTime - lastFrameTime > 0.016 { // ~60fps threshold
                currentFrameAnimations = 0
                lastFrameTime = currentTime
            }
            
            guard currentFrameAnimations < maxAnimationsPerFrame else {
                return false
            }
            
            currentFrameAnimations += 1
            return true
        }
    }
}

// MARK: - Convenience Extensions
extension View {
    func optimizedAnimation<V: Equatable>(
        _ animation: Animation?,
        value: V,
        priority: PerformanceOptimizedAnimations.AnimationPriority = .normal
    ) -> some View {
        self.animation(
            PerformanceOptimizedAnimations.shared.isHighPerformanceMode ? animation : nil,
            value: value
        )
    }
    
    func gpuAccelerated() -> some View {
        PerformanceOptimizedAnimations.GPUOptimizedView {
            self
        }
    }
    
    func optimizedBlur(radius: CGFloat, quality: PerformanceOptimizedAnimations.OptimizedBlurView.BlurQuality = .adaptive) -> some View {
        PerformanceOptimizedAnimations.OptimizedBlurView(radius: radius, quality: quality) {
            self
        }
    }
    
    func morphing(style: PerformanceOptimizedAnimations.MorphingView<AnyView>.MorphStyle, isActive: Bool) -> some View {
        PerformanceOptimizedAnimations.MorphingView(style: style, isActive: isActive) {
            self
        }
    }
}

#Preview {
    VStack(spacing: 20) {
        // GPU Optimized View
        Rectangle()
            .fill(.blue.gradient)
            .frame(width: 100, height: 100)
            .gpuAccelerated()
        
        // Optimized Particle System
        PerformanceOptimizedAnimations.OptimizedParticleView(
            particleCount: 5,
            color: .orange,
            isActive: true
        )
        .frame(width: 200, height: 100)
        .background(.black.opacity(0.1))
        
        // Morphing Animation
        Circle()
            .fill(.green)
            .frame(width: 50, height: 50)
            .morphing(style: .scale, isActive: true)
        
        // Optimized Blur
        Text("Blurred Text")
            .font(.title)
            .optimizedBlur(radius: 5)
    }
    .padding()
}