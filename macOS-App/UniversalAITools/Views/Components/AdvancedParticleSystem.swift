import SwiftUI
import Vortex
import Pow

/// Advanced particle systems for immersive data visualization and UI feedback
struct AdvancedParticleSystem {
    
    // MARK: - Data Flow Particles
    struct DataFlowVisualization: View {
        let dataPoints: [DataFlowPoint]
        let isActive: Bool
        
        @State private var particleSystem = VortexSystem()
        @State private var connectionParticles = VortexSystem()
        @State private var activeConnections: Set<UUID> = []
        
        struct DataFlowPoint {
            let id = UUID()
            let position: CGPoint
            let intensity: Double // 0.0 to 1.0
            let category: DataCategory
            
            enum DataCategory {
                case input, processing, output, storage
                
                var color: Color {
                    switch self {
                    case .input: return .blue
                    case .processing: return .orange
                    case .output: return .green
                    case .storage: return .purple
                    }
                }
                
                var particleCount: Int {
                    switch self {
                    case .input: return 15
                    case .processing: return 25
                    case .output: return 20
                    case .storage: return 10
                    }
                }
            }
        }
        
        var body: some View {
            GeometryReader { geometry in
                ZStack {
                    // Background particle field
                    VortexView(particleSystem) {
                        Circle()
                            .fill(.white.opacity(0.3))
                            .frame(width: 2, height: 2)
                            .blur(radius: 0.5)
                    }
                    .ignoresSafeArea()
                    .blendMode(.plusLighter)
                    
                    // Connection flow particles
                    VortexView(connectionParticles) {
                        Capsule()
                            .fill(.blue.opacity(0.6))
                            .frame(width: 8, height: 2)
                            .blur(radius: 1)
                    }
                    .ignoresSafeArea()
                    .blendMode(.plusLighter)
                    
                    // Data point nodes
                    ForEach(dataPoints, id: \.id) { point in
                        DataNodeView(
                            point: point,
                            isActive: isActive,
                            geometrySize: geometry.size
                        )
                        .position(
                            x: point.position.x * geometry.size.width,
                            y: point.position.y * geometry.size.height
                        )
                    }
                }
            }
            .onAppear {
                setupParticleSystems()
                if isActive {
                    startDataFlow()
                }
            }
            .onChange(of: isActive) { active in
                if active {
                    startDataFlow()
                } else {
                    stopDataFlow()
                }
            }
        }
        
        private func setupParticleSystems() {
            // Background ambient particles
            particleSystem.position = [0.5, 0.5]
            particleSystem.speed = 0.2
            particleSystem.speedVariation = 0.1
            particleSystem.lifespan = 5.0
            particleSystem.shape = .circle
            particleSystem.size = 0.05
            particleSystem.sizeVariation = 0.02
            particleSystem.birthRate = 10
            
            // Connection flow particles
            connectionParticles.speed = 1.0
            connectionParticles.speedVariation = 0.3
            connectionParticles.lifespan = 2.0
            connectionParticles.shape = .rectangle
            connectionParticles.size = 0.1
            connectionParticles.birthRate = 0 // Controlled manually
        }
        
        private func startDataFlow() {
            // Create particle flows between connected data points
            for i in 0..<dataPoints.count {
                for j in (i+1)..<dataPoints.count {
                    let from = dataPoints[i]
                    let to = dataPoints[j]
                    
                    // Create flow based on data relationships
                    if shouldCreateFlow(from: from, to: to) {
                        createParticleFlow(from: from.position, to: to.position)
                    }
                }
            }
            
            // Continuous ambient particle generation
            Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { timer in
                if !isActive {
                    timer.invalidate()
                    return
                }
                particleSystem.burst(count: 3)
            }
        }
        
        private func stopDataFlow() {
            activeConnections.removeAll()
        }
        
        private func shouldCreateFlow(from: DataFlowPoint, to: DataFlowPoint) -> Bool {
            // Create flows based on data category relationships
            switch (from.category, to.category) {
            case (.input, .processing), (.processing, .output), (.processing, .storage):
                return true
            default:
                return false
            }
        }
        
        private func createParticleFlow(from: CGPoint, to: CGPoint) {
            // Calculate flow direction and create particle burst
            let direction = CGPoint(
                x: to.x - from.x,
                y: to.y - from.y
            )
            
            connectionParticles.position = [from.x, from.y]
            connectionParticles.angle = .degrees(atan2(direction.y, direction.x) * 180 / .pi)
            connectionParticles.burst(count: 5)
        }
    }
    
    // MARK: - Data Node Visualization
    struct DataNodeView: View {
        let point: DataFlowVisualization.DataFlowPoint
        let isActive: Bool
        let geometrySize: CGSize
        
        @State private var nodeParticles = VortexSystem()
        @State private var pulseScale: CGFloat = 1.0
        @State private var glowIntensity: Double = 0.5
        
        var nodeSize: CGFloat {
            20 + (point.intensity * 30) // 20-50pt based on intensity
        }
        
        var body: some View {
            ZStack {
                // Node particle emission
                VortexView(nodeParticles) {
                    Circle()
                        .fill(point.category.color.opacity(0.8))
                        .frame(width: 3, height: 3)
                        .blur(radius: 1)
                }
                .frame(width: nodeSize * 2, height: nodeSize * 2)
                .blendMode(.plusLighter)
                
                // Main node
                Circle()
                    .fill(
                        RadialGradient(
                            colors: [
                                point.category.color.opacity(0.8),
                                point.category.color.opacity(0.4),
                                point.category.color.opacity(0.1)
                            ],
                            center: .center,
                            startRadius: 0,
                            endRadius: nodeSize / 2
                        )
                    )
                    .frame(width: nodeSize, height: nodeSize)
                    .scaleEffect(pulseScale)
                    .glow(color: point.category.color, radius: glowIntensity * 10)
                    .overlay(
                        Circle()
                            .stroke(point.category.color, lineWidth: 2)
                            .opacity(0.6)
                    )
            }
            .onAppear {
                setupNodeParticles()
                startNodeAnimation()
            }
            .onChange(of: isActive) { active in
                if active {
                    startNodeAnimation()
                } else {
                    stopNodeAnimation()
                }
            }
        }
        
        private func setupNodeParticles() {
            nodeParticles.position = [0.5, 0.5]
            nodeParticles.speed = 0.3
            nodeParticles.speedVariation = 0.2
            nodeParticles.lifespan = 1.5
            nodeParticles.shape = .circle
            nodeParticles.size = 0.1
            nodeParticles.sizeVariation = 0.05
            nodeParticles.birthRate = Int(point.intensity * 20) // More particles for higher intensity
        }
        
        private func startNodeAnimation() {
            // Pulsing animation based on intensity
            withAnimation(.easeInOut(duration: 1.0 + point.intensity).repeatForever(autoreverses: true)) {
                pulseScale = 1.0 + (point.intensity * 0.3)
            }
            
            // Glow intensity animation
            withAnimation(.easeInOut(duration: 2.0).repeatForever(autoreverses: true)) {
                glowIntensity = 0.3 + (point.intensity * 0.7)
            }
            
            // Particle emission
            if isActive {
                Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { timer in
                    if !isActive {
                        timer.invalidate()
                        return
                    }
                    nodeParticles.burst(count: max(1, Int(point.intensity * 5)))
                }
            }
        }
        
        private func stopNodeAnimation() {
            // Reset to default state
            withAnimation(.easeOut(duration: 0.5)) {
                pulseScale = 1.0
                glowIntensity = 0.3
            }
        }
    }
    
    // MARK: - Performance Metrics Visualization
    struct PerformanceParticles: View {
        let metrics: PerformanceMetrics
        let isMonitoring: Bool
        
        @State private var cpuParticles = VortexSystem()
        @State private var memoryParticles = VortexSystem()
        @State private var networkParticles = VortexSystem()
        
        struct PerformanceMetrics {
            let cpuUsage: Double // 0.0 to 1.0
            let memoryUsage: Double // 0.0 to 1.0
            let networkActivity: Double // 0.0 to 1.0
            let alertLevel: AlertLevel
            
            enum AlertLevel {
                case normal, warning, critical
                
                var color: Color {
                    switch self {
                    case .normal: return .green
                    case .warning: return .orange
                    case .critical: return .red
                    }
                }
            }
        }
        
        var body: some View {
            GeometryReader { geometry in
                ZStack {
                    // CPU usage particles (left side)
                    VortexView(cpuParticles) {
                        Circle()
                            .fill(.blue.opacity(0.6))
                            .frame(width: 4, height: 4)
                            .blur(radius: 1)
                    }
                    .frame(width: geometry.size.width / 3, height: geometry.size.height)
                    .position(x: geometry.size.width * 0.16, y: geometry.size.height / 2)
                    
                    // Memory usage particles (center)
                    VortexView(memoryParticles) {
                        Rectangle()
                            .fill(.orange.opacity(0.6))
                            .frame(width: 3, height: 6)
                            .blur(radius: 1)
                    }
                    .frame(width: geometry.size.width / 3, height: geometry.size.height)
                    .position(x: geometry.size.width * 0.5, y: geometry.size.height / 2)
                    
                    // Network activity particles (right side)
                    VortexView(networkParticles) {
                        Capsule()
                            .fill(.purple.opacity(0.6))
                            .frame(width: 8, height: 2)
                            .blur(radius: 1)
                    }
                    .frame(width: geometry.size.width / 3, height: geometry.size.height)
                    .position(x: geometry.size.width * 0.84, y: geometry.size.height / 2)
                    
                    // Performance indicators
                    HStack(spacing: geometry.size.width * 0.25) {
                        PerformanceIndicator(
                            title: "CPU",
                            value: metrics.cpuUsage,
                            color: .blue,
                            alertLevel: metrics.alertLevel
                        )
                        
                        PerformanceIndicator(
                            title: "Memory",
                            value: metrics.memoryUsage,
                            color: .orange,
                            alertLevel: metrics.alertLevel
                        )
                        
                        PerformanceIndicator(
                            title: "Network",
                            value: metrics.networkActivity,
                            color: .purple,
                            alertLevel: metrics.alertLevel
                        )
                    }
                    .frame(maxWidth: .infinity)
                }
            }
            .onAppear {
                setupPerformanceParticles()
                if isMonitoring {
                    startPerformanceVisualization()
                }
            }
            .onChange(of: isMonitoring) { monitoring in
                if monitoring {
                    startPerformanceVisualization()
                }
            }
            .onChange(of: metrics.cpuUsage) { _ in updateParticleRates() }
            .onChange(of: metrics.memoryUsage) { _ in updateParticleRates() }
            .onChange(of: metrics.networkActivity) { _ in updateParticleRates() }
        }
        
        private func setupPerformanceParticles() {
            // CPU particles (vertical flow)
            cpuParticles.position = [0.5, 1.0]
            cpuParticles.angle = .degrees(-90)
            cpuParticles.angleRange = .degrees(10)
            cpuParticles.speed = 0.5
            cpuParticles.speedVariation = 0.2
            cpuParticles.lifespan = 3.0
            cpuParticles.shape = .circle
            cpuParticles.size = 0.1
            cpuParticles.birthRate = 0
            
            // Memory particles (stacking effect)
            memoryParticles.position = [0.5, 1.0]
            memoryParticles.angle = .degrees(-90)
            memoryParticles.angleRange = .degrees(5)
            memoryParticles.speed = 0.3
            memoryParticles.speedVariation = 0.1
            memoryParticles.lifespan = 4.0
            memoryParticles.shape = .rectangle
            memoryParticles.size = 0.08
            memoryParticles.birthRate = 0
            
            // Network particles (horizontal flow)
            networkParticles.position = [0.0, 0.5]
            networkParticles.angle = .degrees(0)
            networkParticles.angleRange = .degrees(5)
            networkParticles.speed = 0.8
            networkParticles.speedVariation = 0.3
            networkParticles.lifespan = 2.0
            networkParticles.shape = .rectangle
            networkParticles.size = 0.12
            networkParticles.birthRate = 0
        }
        
        private func startPerformanceVisualization() {
            updateParticleRates()
            
            // Continuous particle emission based on metrics
            Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { timer in
                if !isMonitoring {
                    timer.invalidate()
                    return
                }
                
                // Emit particles based on current metrics
                cpuParticles.burst(count: max(1, Int(metrics.cpuUsage * 10)))
                memoryParticles.burst(count: max(1, Int(metrics.memoryUsage * 8)))
                networkParticles.burst(count: max(1, Int(metrics.networkActivity * 12)))
            }
        }
        
        private func updateParticleRates() {
            cpuParticles.birthRate = Int(metrics.cpuUsage * 15)
            memoryParticles.birthRate = Int(metrics.memoryUsage * 12)
            networkParticles.birthRate = Int(metrics.networkActivity * 18)
        }
    }
    
    // MARK: - Performance Indicator Component
    struct PerformanceIndicator: View {
        let title: String
        let value: Double
        let color: Color
        let alertLevel: PerformanceParticles.PerformanceMetrics.AlertLevel
        
        @State private var animatedValue: Double = 0
        
        var body: some View {
            VStack(spacing: 8) {
                Text(title)
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                ZStack {
                    Circle()
                        .stroke(color.opacity(0.2), lineWidth: 4)
                        .frame(width: 60, height: 60)
                    
                    Circle()
                        .trim(from: 0, to: animatedValue)
                        .stroke(
                            AngularGradient(
                                colors: [color.opacity(0.3), color],
                                center: .center
                            ),
                            style: StrokeStyle(lineWidth: 4, lineCap: .round)
                        )
                        .frame(width: 60, height: 60)
                        .rotationEffect(.degrees(-90))
                        .glow(color: alertLevel.color, radius: alertLevel == .critical ? 8 : 0)
                    
                    Text("\(Int(value * 100))%")
                        .font(.caption2)
                        .fontWeight(.semibold)
                        .foregroundColor(color)
                }
                .conditionalEffect(.shake(strength: .light), condition: alertLevel == .critical)
            }
            .onAppear {
                withAnimation(.easeOut(duration: 1.0)) {
                    animatedValue = value
                }
            }
            .onChange(of: value) { newValue in
                withAnimation(.spring(response: 0.5, dampingFraction: 0.7)) {
                    animatedValue = newValue
                }
            }
        }
    }
    
    // MARK: - Success Celebration Particles
    struct CelebrationParticles: View {
        let isTriggered: Bool
        let color: Color
        let intensity: Double // 0.0 to 1.0
        
        @State private var celebrationSystem = VortexSystem()
        
        var body: some View {
            VortexView(celebrationSystem) {
                Group {
                    Circle()
                        .fill(color)
                        .frame(width: 6, height: 6)
                    
                    Image(systemName: "star.fill")
                        .foregroundColor(color)
                        .font(.system(size: 8))
                    
                    Image(systemName: "sparkles")
                        .foregroundColor(color.opacity(0.8))
                        .font(.system(size: 6))
                }
            }
            .allowsHitTesting(false)
            .onChange(of: isTriggered) { triggered in
                if triggered {
                    triggerCelebration()
                }
            }
            .onAppear {
                setupCelebrationSystem()
            }
        }
        
        private func setupCelebrationSystem() {
            celebrationSystem.position = [0.5, 0.5]
            celebrationSystem.speed = 2.0
            celebrationSystem.speedVariation = 1.0
            celebrationSystem.lifespan = 2.0
            celebrationSystem.shape = .circle
            celebrationSystem.size = 0.15
            celebrationSystem.sizeVariation = 0.1
            celebrationSystem.birthRate = 0
        }
        
        private func triggerCelebration() {
            let particleCount = Int(intensity * 50) + 20 // 20-70 particles
            celebrationSystem.burst(count: particleCount)
            
            // Secondary burst after delay
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                celebrationSystem.burst(count: particleCount / 2)
            }
        }
    }
}

#Preview {
    VStack(spacing: 20) {
        AdvancedParticleSystem.DataFlowVisualization(
            dataPoints: [
                .init(position: CGPoint(x: 0.2, y: 0.3), intensity: 0.8, category: .input),
                .init(position: CGPoint(x: 0.5, y: 0.5), intensity: 1.0, category: .processing),
                .init(position: CGPoint(x: 0.8, y: 0.3), intensity: 0.6, category: .output),
                .init(position: CGPoint(x: 0.5, y: 0.8), intensity: 0.4, category: .storage)
            ],
            isActive: true
        )
        .frame(height: 200)
        .background(.black.opacity(0.1))
        .cornerRadius(12)
        
        AdvancedParticleSystem.PerformanceParticles(
            metrics: .init(
                cpuUsage: 0.65,
                memoryUsage: 0.45,
                networkActivity: 0.8,
                alertLevel: .warning
            ),
            isMonitoring: true
        )
        .frame(height: 120)
        .background(.black.opacity(0.1))
        .cornerRadius(12)
    }
    .padding()
    .background(.black)
}