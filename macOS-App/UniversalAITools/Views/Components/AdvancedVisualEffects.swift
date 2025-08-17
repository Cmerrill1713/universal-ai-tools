import SwiftUI

/// Advanced Visual Effects System
/// Sophisticated animation library for Universal AI Tools with Vortex-style particle effects and Pow-style transitions
struct AdvancedVisualEffects {
    
    // MARK: - Pow-Style Transitions
    
    /// Spring-powered View Transitions
    struct PowTransition: ViewModifier {
        let isActive: Bool
        let effect: TransitionEffect
        
        enum TransitionEffect {
            case bounce, spray, glow, shake, pop, wobble
        }
        
        @State private var animationState: CGFloat = 0
        @State private var rotationAngle: Double = 0
        @State private var glowIntensity: Double = 0
        
        func body(content: Content) -> some View {
            content
                .scaleEffect(scaleForEffect())
                .rotationEffect(.degrees(rotationForEffect()))
                .shadow(color: glowColorForEffect(), radius: glowIntensity * 10)
                .onChange(of: isActive) { active in
                    if active {
                        triggerEffect()
                    }
                }
        }
        
        private func scaleForEffect() -> CGFloat {
            switch effect {
            case .bounce, .pop:
                return 1.0 + animationState * 0.2
            case .wobble:
                return 1.0 + sin(animationState * .pi * 4) * 0.05
            case .shake:
                return 1.0
            case .spray:
                return 1.0 + animationState * 0.1
            case .glow:
                return 1.0 + animationState * 0.02
            }
        }
        
        private func rotationForEffect() -> Double {
            switch effect {
            case .wobble:
                return sin(animationState * .pi * 8) * 5
            case .shake:
                return sin(animationState * .pi * 12) * 2
            case .spray:
                return rotationAngle
            default:
                return 0
            }
        }
        
        private func glowColorForEffect() -> Color {
            switch effect {
            case .glow:
                return .blue.opacity(glowIntensity)
            case .pop:
                return .purple.opacity(glowIntensity * 0.5)
            default:
                return .clear
            }
        }
        
        private func triggerEffect() {
            switch effect {
            case .bounce:
                withAnimation(.spring(response: 0.6, dampingFraction: 0.3, blendDuration: 0.5)) {
                    animationState = 1.0
                }
                withAnimation(.spring(response: 0.3, dampingFraction: 0.8).delay(0.3)) {
                    animationState = 0.0
                }
                
            case .spray:
                withAnimation(.easeOut(duration: 0.8)) {
                    animationState = 1.0
                    rotationAngle = Double.random(in: -15...15)
                }
                withAnimation(.easeIn(duration: 0.4).delay(0.4)) {
                    animationState = 0.0
                    rotationAngle = 0
                }
                
            case .glow:
                withAnimation(.easeInOut(duration: 0.6)) {
                    glowIntensity = 1.0
                }
                withAnimation(.easeOut(duration: 1.0).delay(0.6)) {
                    glowIntensity = 0.0
                }
                
            case .shake:
                withAnimation(.linear(duration: 0.5)) {
                    animationState = 1.0
                }
                withAnimation(.linear(duration: 0.1).delay(0.5)) {
                    animationState = 0.0
                }
                
            case .pop:
                withAnimation(.spring(response: 0.4, dampingFraction: 0.4)) {
                    animationState = 1.0
                    glowIntensity = 0.8
                }
                withAnimation(.easeOut(duration: 0.8).delay(0.2)) {
                    animationState = 0.0
                    glowIntensity = 0.0
                }
                
            case .wobble:
                withAnimation(.linear(duration: 1.0)) {
                    animationState = 1.0
                }
                withAnimation(.linear(duration: 0.1).delay(1.0)) {
                    animationState = 0.0
                }
            }
        }
    }
    
    // MARK: - Vortex-Style Particle Systems
    
    /// Advanced Particle Emitter
    struct VortexParticleEmitter: View {
        let configuration: ParticleConfiguration
        @State private var particles: [Particle] = []
        @State private var isEmitting = false
        
        struct ParticleConfiguration {
            let emissionRate: Double = 30 // particles per second
            let lifetime: Double = 3.0
            let speed: ClosedRange<Double> = 50...150
            let scale: ClosedRange<Double> = 0.5...1.5
            let colors: [Color] = [.blue, .purple, .pink, .cyan]
            let shapes: [ParticleShape] = [.circle, .star, .triangle]
            let gravity: CGPoint = CGPoint(x: 0, y: 100)
            let wind: CGPoint = CGPoint(x: 0, y: 0)
        }
        
        enum ParticleShape {
            case circle, star, triangle, square
            
            @ViewBuilder
            var view: some View {
                switch self {
                case .circle:
                    Circle()
                case .star:
                    Image(systemName: "star.fill")
                case .triangle:
                    Image(systemName: "triangle.fill")
                case .square:
                    Rectangle()
                }
            }
        }
        
        struct Particle: Identifiable {
            let id = UUID()
            var position: CGPoint
            var velocity: CGPoint
            var scale: Double
            var rotation: Double
            var opacity: Double
            var color: Color
            var shape: ParticleShape
            var lifetime: Double
            var age: Double = 0
        }
        
        var body: some View {
            GeometryReader { geometry in
                ForEach(particles) { particle in
                    particle.shape.view
                        .foregroundColor(particle.color)
                        .scaleEffect(particle.scale)
                        .rotationEffect(.degrees(particle.rotation))
                        .opacity(particle.opacity)
                        .position(particle.position)
                        .blur(radius: max(0, 1 - particle.opacity))
                }
            }
            .onAppear {
                startEmission(in: CGSize(width: 400, height: 400))
            }
            .onDisappear {
                stopEmission()
            }
        }
        
        private func startEmission(in size: CGSize) {
            isEmitting = true
            
            Timer.scheduledTimer(withTimeInterval: 1.0 / configuration.emissionRate, repeats: true) { timer in
                guard isEmitting else {
                    timer.invalidate()
                    return
                }
                
                let newParticle = createParticle(in: size)
                particles.append(newParticle)
                
                // Animate particle
                animateParticle(newParticle)
            }
        }
        
        private func createParticle(in size: CGSize) -> Particle {
            return Particle(
                position: CGPoint(x: size.width / 2, y: size.height),
                velocity: CGPoint(
                    x: Double.random(in: -50...50),
                    y: -Double.random(in: configuration.speed)
                ),
                scale: Double.random(in: configuration.scale),
                rotation: Double.random(in: 0...360),
                opacity: 1.0,
                color: configuration.colors.randomElement() ?? .blue,
                shape: configuration.shapes.randomElement() ?? .circle,
                lifetime: configuration.lifetime
            )
        }
        
        private func animateParticle(_ particle: Particle) {
            guard let index = particles.firstIndex(where: { $0.id == particle.id }) else { return }
            
            withAnimation(.linear(duration: particle.lifetime)) {
                particles[index].position.y -= 300
                particles[index].position.x += particle.velocity.x * particle.lifetime / 2
                particles[index].opacity = 0
                particles[index].scale *= 0.5
                particles[index].rotation += 360
            }
            
            DispatchQueue.main.asyncAfter(deadline: .now() + particle.lifetime) {
                particles.removeAll { $0.id == particle.id }
            }
        }
        
        private func stopEmission() {
            isEmitting = false
        }
    }
    
    // MARK: - Interactive Particle Effects
    
    /// Touch-Responsive Particle Burst
    struct TouchParticleBurst: View {
        @State private var burstParticles: [BurstParticle] = []
        
        struct BurstParticle: Identifiable {
            let id = UUID()
            var position: CGPoint
            var velocity: CGPoint
            var color: Color
            var scale: Double = 1.0
            var opacity: Double = 1.0
        }
        
        var body: some View {
            ZStack {
                ForEach(burstParticles) { particle in
                    Circle()
                        .fill(particle.color)
                        .frame(width: 6, height: 6)
                        .scaleEffect(particle.scale)
                        .opacity(particle.opacity)
                        .position(particle.position)
                }
            }
            .contentShape(Rectangle())
            .onTapGesture { location in
                createBurst(at: location)
            }
        }
        
        private func createBurst(at location: CGPoint) {
            let colors: [Color] = [.blue, .purple, .pink, .cyan, .mint, .indigo]
            let particleCount = 12
            
            for i in 0..<particleCount {
                let angle = Double(i) * 2 * .pi / Double(particleCount)
                let speed = Double.random(in: 100...200)
                
                let particle = BurstParticle(
                    position: location,
                    velocity: CGPoint(
                        x: cos(angle) * speed,
                        y: sin(angle) * speed
                    ),
                    color: colors.randomElement() ?? .blue
                )
                
                burstParticles.append(particle)
                animateBurstParticle(particle)
            }
        }
        
        private func animateBurstParticle(_ particle: BurstParticle) {
            guard let index = burstParticles.firstIndex(where: { $0.id == particle.id }) else { return }
            
            withAnimation(.easeOut(duration: 1.5)) {
                burstParticles[index].position.x += particle.velocity.x * 0.01
                burstParticles[index].position.y += particle.velocity.y * 0.01
                burstParticles[index].opacity = 0
                burstParticles[index].scale = 0.1
            }
            
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                burstParticles.removeAll { $0.id == particle.id }
            }
        }
    }
    
    // MARK: - Data Visualization Effects
    
    /// Animated Data Flow Visualization
    struct DataFlowVisualization: View {
        let nodes: [DataNode]
        let connections: [DataConnection]
        
        @State private var flowAnimations: [UUID: Double] = [:]
        
        struct DataNode: Identifiable {
            let id = UUID()
            let position: CGPoint
            let label: String
            let color: Color
            let size: CGFloat
        }
        
        struct DataConnection: Identifiable {
            let id = UUID()
            let fromNodeId: UUID
            let toNodeId: UUID
            let strength: Double // 0-1
            let isActive: Bool
        }
        
        var body: some View {
            ZStack {
                // Draw connections
                ForEach(connections) { connection in
                    if let fromNode = nodes.first(where: { $0.id == connection.fromNodeId }),
                       let toNode = nodes.first(where: { $0.id == connection.toNodeId }) {
                        
                        ConnectionLine(
                            from: fromNode.position,
                            to: toNode.position,
                            strength: connection.strength,
                            isActive: connection.isActive,
                            flowProgress: flowAnimations[connection.id] ?? 0
                        )
                    }
                }
                
                // Draw nodes
                ForEach(nodes) { node in
                    DataNodeView(node: node)
                        .position(node.position)
                }
            }
            .onAppear {
                startFlowAnimations()
            }
        }
        
        private func startFlowAnimations() {
            for connection in connections where connection.isActive {
                withAnimation(.linear(duration: 2).repeatForever(autoreverses: false)) {
                    flowAnimations[connection.id] = 1.0
                }
            }
        }
    }
    
    struct ConnectionLine: View {
        let from: CGPoint
        let to: CGPoint
        let strength: Double
        let isActive: Bool
        let flowProgress: Double
        
        var body: some View {
            ZStack {
                // Base connection line
                Path { path in
                    path.move(to: from)
                    path.addLine(to: to)
                }
                .stroke(
                    isActive ? Color.blue.opacity(0.6) : Color.gray.opacity(0.3),
                    lineWidth: CGFloat(2 + strength * 3)
                )
                
                // Flow animation
                if isActive {
                    Path { path in
                        path.move(to: from)
                        path.addLine(to: to)
                    }
                    .trim(from: max(0, flowProgress - 0.1), to: flowProgress)
                    .stroke(
                        LinearGradient(
                            colors: [.clear, .cyan, .blue, .clear],
                            startPoint: .leading,
                            endPoint: .trailing
                        ),
                        style: StrokeStyle(lineWidth: 4, lineCap: .round)
                    )
                }
            }
        }
    }
    
    struct DataNodeView: View {
        let node: DataFlowVisualization.DataNode
        @State private var pulseScale: CGFloat = 1.0
        
        var body: some View {
            ZStack {
                // Node background with pulse
                Circle()
                    .fill(node.color.opacity(0.2))
                    .frame(width: node.size * 1.5, height: node.size * 1.5)
                    .scaleEffect(pulseScale)
                
                // Main node
                Circle()
                    .fill(
                        RadialGradient(
                            colors: [node.color, node.color.opacity(0.7)],
                            center: .center,
                            startRadius: 0,
                            endRadius: node.size / 2
                        )
                    )
                    .frame(width: node.size, height: node.size)
                
                // Label
                Text(node.label)
                    .font(.caption2)
                    .fontWeight(.medium)
                    .foregroundColor(.white)
                    .shadow(radius: 2)
            }
            .onAppear {
                withAnimation(.easeInOut(duration: 2).repeatForever(autoreverses: true)) {
                    pulseScale = 1.2
                }
            }
        }
    }
    
    // MARK: - AI Processing Visualization
    
    /// Neural Network Processing Animation
    struct NeuralProcessingView: View {
        @State private var processingLayers: [ProcessingLayer] = []
        @State private var isProcessing = false
        
        struct ProcessingLayer {
            let id = UUID()
            var neurons: [Neuron]
            let layerIndex: Int
        }
        
        struct Neuron {
            let id = UUID()
            var activation: Double = 0
            var position: CGPoint
        }
        
        var body: some View {
            GeometryReader { geometry in
                ZStack {
                    // Background neural network
                    ForEach(processingLayers, id: \.id) { layer in
                        ForEach(layer.neurons, id: \.id) { neuron in
                            Circle()
                                .fill(
                                    RadialGradient(
                                        colors: [
                                            .blue.opacity(neuron.activation),
                                            .purple.opacity(neuron.activation * 0.5)
                                        ],
                                        center: .center,
                                        startRadius: 0,
                                        endRadius: 10
                                    )
                                )
                                .frame(width: 20, height: 20)
                                .position(neuron.position)
                                .scaleEffect(0.5 + neuron.activation * 0.5)
                        }
                    }
                    
                    // Processing wave overlay
                    if isProcessing {
                        ProcessingWave()
                    }
                }
            }
            .onAppear {
                setupNeuralNetwork()
                startProcessing()
            }
        }
        
        private func setupNeuralNetwork() {
            let layerCount = 4
            let neuronsPerLayer = 6
            
            for layerIndex in 0..<layerCount {
                var neurons: [Neuron] = []
                
                for neuronIndex in 0..<neuronsPerLayer {
                    let neuron = Neuron(
                        position: CGPoint(
                            x: 100 + CGFloat(layerIndex) * 80,
                            y: 50 + CGFloat(neuronIndex) * 40
                        )
                    )
                    neurons.append(neuron)
                }
                
                processingLayers.append(ProcessingLayer(neurons: neurons, layerIndex: layerIndex))
            }
        }
        
        private func startProcessing() {
            isProcessing = true
            
            Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { _ in
                animateNeuralActivation()
            }
        }
        
        private func animateNeuralActivation() {
            for layerIndex in processingLayers.indices {
                let delay = Double(layerIndex) * 0.2
                
                DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
                    withAnimation(.easeInOut(duration: 0.8)) {
                        for neuronIndex in processingLayers[layerIndex].neurons.indices {
                            processingLayers[layerIndex].neurons[neuronIndex].activation = Double.random(in: 0.3...1.0)
                        }
                    }
                    
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
                        withAnimation(.easeOut(duration: 0.5)) {
                            for neuronIndex in processingLayers[layerIndex].neurons.indices {
                                processingLayers[layerIndex].neurons[neuronIndex].activation = 0.1
                            }
                        }
                    }
                }
            }
        }
    }
    
    struct ProcessingWave: View {
        @State private var waveOffset: CGFloat = 0
        
        var body: some View {
            Wave(offset: waveOffset)
                .fill(
                    LinearGradient(
                        colors: [.clear, .cyan.opacity(0.3), .blue.opacity(0.5), .clear],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
                .onAppear {
                    withAnimation(.linear(duration: 2).repeatForever(autoreverses: false)) {
                        waveOffset = 400
                    }
                }
        }
    }
    
    struct Wave: Shape {
        let offset: CGFloat
        
        func path(in rect: CGRect) -> Path {
            var path = Path()
            
            let width = rect.width
            let height = rect.height
            let waveHeight: CGFloat = 20
            
            path.move(to: CGPoint(x: 0, y: height / 2))
            
            for x in stride(from: 0, through: width, by: 1) {
                let y = height / 2 + sin((x + offset) * 0.02) * waveHeight
                path.addLine(to: CGPoint(x: x, y: y))
            }
            
            return path
        }
    }
}

// MARK: - View Extensions

extension View {
    /// Apply Pow-style transition effects
    func powTransition(_ effect: AdvancedVisualEffects.PowTransition.TransitionEffect, isActive: Bool) -> some View {
        self.modifier(AdvancedVisualEffects.PowTransition(isActive: isActive, effect: effect))
    }
    
    /// Add touch-responsive particle burst
    func touchParticleBurst() -> some View {
        self.overlay(AdvancedVisualEffects.TouchParticleBurst())
    }
    
    /// Add neural processing background
    func neuralProcessingBackground() -> some View {
        self.background(AdvancedVisualEffects.NeuralProcessingView())
    }
}

// MARK: - Preview
#Preview {
    VStack(spacing: 30) {
        // Pow transition effects
        Rectangle()
            .fill(.blue)
            .frame(width: 100, height: 100)
            .powTransition(.bounce, isActive: true)
        
        // Particle emitter
        AdvancedVisualEffects.VortexParticleEmitter(
            configuration: AdvancedVisualEffects.VortexParticleEmitter.ParticleConfiguration()
        )
        .frame(height: 200)
        
        // Touch particle burst
        Rectangle()
            .fill(.purple.opacity(0.3))
            .frame(width: 200, height: 100)
            .touchParticleBurst()
        
        // Neural processing
        Rectangle()
            .fill(.black.opacity(0.8))
            .frame(width: 300, height: 200)
            .neuralProcessingBackground()
    }
    .padding()
}