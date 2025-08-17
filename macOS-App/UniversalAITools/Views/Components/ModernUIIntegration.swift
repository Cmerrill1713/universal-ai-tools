import SwiftUI

/// Modern UI Integration Hub
/// Centralizes and demonstrates all enhanced UI components with advanced animations
struct ModernUIIntegration: View {
    @State private var selectedDemo: DemoCategory = .buttons
    @State private var showEffects = false
    @State private var particleBurstTrigger = false
    @State private var connectionStatus: ModernUIComponentsLibrary.AnimatedConnectionStatus.ConnectionStatus = .connected
    @State private var isLoading = false
    @State private var progress: Double = 0.75
    
    enum DemoCategory: String, CaseIterable {
        case buttons = "Interactive Buttons"
        case cards = "Data Cards"
        case status = "Status Indicators"
        case particles = "Particle Effects"
        case transitions = "Pow Transitions"
        case neural = "Neural Processing"
        case flows = "Data Flows"
        
        var icon: String {
            switch self {
            case .buttons: return "button.programmable"
            case .cards: return "rectangle.stack"
            case .status: return "wifi"
            case .particles: return "sparkles"
            case .transitions: return "wand.and.rays"
            case .neural: return "brain.head.profile"
            case .flows: return "arrow.triangle.branch"
            }
        }
    }
    
    var body: some View {
        NavigationSplitView {
            // Sidebar with demo categories
            demoSidebar
        } detail: {
            // Main demo area
            demoContent
        }
        .navigationTitle("Modern UI Components")
        .toolbar {
            toolbarContent
        }
        .onAppear {
            startProgressAnimation()
        }
    }
    
    // MARK: - Demo Sidebar
    
    private var demoSidebar: some View {
        VStack(spacing: 0) {
            // Header
            VStack(spacing: 12) {
                ModernUIComponentsLibrary.FeatureDiscoveryBadge(type: .new)
                
                Text("Modern UI Library")
                    .font(.headline)
                    .fontWeight(.semibold)
                
                Text("Interactive component showcase")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            .padding()
            
            Divider()
            
            // Category list
            ScrollView {
                LazyVStack(spacing: 8) {
                    ForEach(DemoCategory.allCases, id: \.self) { category in
                        CategoryRow(
                            category: category,
                            isSelected: selectedDemo == category,
                            onSelect: { selectedDemo = category }
                        )
                    }
                }
                .padding()
            }
            
            Spacer()
            
            // Footer controls
            VStack(spacing: 12) {
                ModernUIComponentsLibrary.EnhancedActionButton(
                    title: "Toggle Effects",
                    icon: "sparkles",
                    action: { showEffects.toggle() },
                    style: showEffects ? .primary : .secondary
                )
                
                ModernUIComponentsLibrary.EnhancedActionButton(
                    title: "Particle Burst",
                    icon: "burst",
                    action: { particleBurstTrigger.toggle() },
                    style: .ghost
                )
            }
            .padding()
        }
        .frame(minWidth: 250)
    }
    
    // MARK: - Demo Content
    
    private var demoContent: some View {
        ScrollView {
            VStack(spacing: 32) {
                // Demo header
                demoHeader
                
                // Demo content based on selection
                Group {
                    switch selectedDemo {
                    case .buttons:
                        buttonsDemo
                    case .cards:
                        cardsDemo
                    case .status:
                        statusDemo
                    case .particles:
                        particlesDemo
                    case .transitions:
                        transitionsDemo
                    case .neural:
                        neuralDemo
                    case .flows:
                        flowsDemo
                    }
                }
                .powTransition(.bounce, isActive: showEffects)
            }
            .padding()
        }
        .background(
            Group {
                if showEffects {
                    AdvancedVisualEffects.VortexParticleEmitter(
                        configuration: AdvancedVisualEffects.VortexParticleEmitter.ParticleConfiguration()
                    )
                    .opacity(0.3)
                }
            }
        )
        .touchParticleBurst()
    }
    
    private var demoHeader: some View {
        VStack(spacing: 16) {
            HStack {
                Image(systemName: selectedDemo.icon)
                    .font(.largeTitle)
                    .foregroundColor(.blue)
                    .powTransition(.glow, isActive: showEffects)
                
                VStack(alignment: .leading, spacing: 4) {
                    Text(selectedDemo.rawValue)
                        .font(.title)
                        .fontWeight(.bold)
                    
                    Text("Interactive demonstration of modern UI components")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
                
                Spacer()
            }
            
            Divider()
        }
    }
    
    // MARK: - Demo Sections
    
    private var buttonsDemo: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 2), spacing: 20) {
            DemoSection(title: "Action Buttons") {
                VStack(spacing: 12) {
                    ModernUIComponentsLibrary.EnhancedActionButton(
                        title: "Primary Action",
                        icon: "star.fill",
                        action: { print("Primary action") },
                        style: .primary,
                        isLoading: isLoading
                    )
                    
                    ModernUIComponentsLibrary.EnhancedActionButton(
                        title: "Secondary Action",
                        icon: "gear",
                        action: { isLoading.toggle() },
                        style: .secondary
                    )
                    
                    ModernUIComponentsLibrary.EnhancedActionButton(
                        title: "Destructive Action",
                        icon: "trash",
                        action: { print("Destructive action") },
                        style: .destructive
                    )
                    
                    ModernUIComponentsLibrary.EnhancedActionButton(
                        title: "Ghost Action",
                        icon: "eye",
                        action: { print("Ghost action") },
                        style: .ghost
                    )
                }
            }
            
            DemoSection(title: "Morphing Buttons") {
                VStack(spacing: 12) {
                    ModernUIComponentsLibrary.MorphingIconButton(
                        primaryIcon: "play.fill",
                        secondaryIcon: "pause.fill",
                        isToggled: showEffects,
                        action: { showEffects.toggle() }
                    )
                    
                    ModernUIComponentsLibrary.MorphingIconButton(
                        primaryIcon: "heart",
                        secondaryIcon: "heart.fill",
                        isToggled: particleBurstTrigger,
                        action: { particleBurstTrigger.toggle() }
                    )
                    
                    ModernUIComponentsLibrary.MorphingIconButton(
                        primaryIcon: "bookmark",
                        secondaryIcon: "bookmark.fill",
                        isToggled: false,
                        action: { print("Bookmark toggle") }
                    )
                }
            }
        }
    }
    
    private var cardsDemo: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 3), spacing: 20) {
            ModernUIComponentsLibrary.ParticleDataCard(
                title: "System Performance",
                value: "98.5%",
                trend: .rising,
                color: .green
            )
            
            ModernUIComponentsLibrary.ParticleDataCard(
                title: "Memory Usage",
                value: "67.2%",
                trend: .stable,
                color: .orange
            )
            
            ModernUIComponentsLibrary.ParticleDataCard(
                title: "Network Latency",
                value: "12ms",
                trend: .falling,
                color: .blue
            )
            
            ModernUIComponentsLibrary.ParticleDataCard(
                title: "Error Rate",
                value: "0.03%",
                trend: .falling,
                color: .red
            )
            
            ModernUIComponentsLibrary.ParticleDataCard(
                title: "Active Users",
                value: "1,247",
                trend: .rising,
                color: .purple
            )
            
            ModernUIComponentsLibrary.ParticleDataCard(
                title: "Throughput",
                value: "8.9K/s",
                trend: .rising,
                color: .cyan
            )
        }
    }
    
    private var statusDemo: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 2), spacing: 20) {
            DemoSection(title: "Connection Status") {
                VStack(spacing: 12) {
                    ModernUIComponentsLibrary.AnimatedConnectionStatus(status: connectionStatus)
                    
                    HStack {
                        Button("Connected") {
                            connectionStatus = .connected
                        }
                        .buttonStyle(.bordered)
                        
                        Button("Connecting") {
                            connectionStatus = .connecting
                        }
                        .buttonStyle(.bordered)
                        
                        Button("Failed") {
                            connectionStatus = .failed
                        }
                        .buttonStyle(.bordered)
                    }
                }
            }
            
            DemoSection(title: "Status Badges") {
                VStack(spacing: 12) {
                    ModernUIComponentsLibrary.EnhancedStatusBadge(status: "Online", type: .success)
                    ModernUIComponentsLibrary.EnhancedStatusBadge(status: "Processing", type: .active)
                    ModernUIComponentsLibrary.EnhancedStatusBadge(status: "Warning", type: .warning)
                    ModernUIComponentsLibrary.EnhancedStatusBadge(status: "Error", type: .error)
                    ModernUIComponentsLibrary.EnhancedStatusBadge(status: "Info", type: .info)
                }
            }
            
            DemoSection(title: "Feature Badges") {
                VStack(spacing: 12) {
                    ModernUIComponentsLibrary.FeatureDiscoveryBadge(type: .new)
                    ModernUIComponentsLibrary.FeatureDiscoveryBadge(type: .pro)
                    ModernUIComponentsLibrary.FeatureDiscoveryBadge(type: .beta)
                    ModernUIComponentsLibrary.FeatureDiscoveryBadge(type: .updated)
                }
            }
            
            DemoSection(title: "Progress Indicators") {
                VStack(spacing: 12) {
                    ModernUIComponentsLibrary.ProgressRing(progress: progress)
                    ModernUIComponentsLibrary.ModernLoadingSpinner()
                    
                    HStack {
                        Button("25%") { progress = 0.25 }
                        Button("50%") { progress = 0.50 }
                        Button("75%") { progress = 0.75 }
                        Button("100%") { progress = 1.0 }
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                }
            }
        }
    }
    
    private var particlesDemo: some View {
        VStack(spacing: 24) {
            DemoSection(title: "Particle Emitter") {
                AdvancedVisualEffects.VortexParticleEmitter(
                    configuration: AdvancedVisualEffects.VortexParticleEmitter.ParticleConfiguration()
                )
                .frame(height: 200)
                .background(.black.opacity(0.1))
                .cornerRadius(12)
            }
            
            DemoSection(title: "Classic Particle Effects") {
                HStack(spacing: 20) {
                    VStack {
                        Text("AI Thinking")
                        AIThinkingParticles()
                    }
                    
                    VStack {
                        Text("Voice Waveform")
                        VoiceWaveform(isRecording: .constant(true))
                    }
                    
                    VStack {
                        Text("Loading Dots")
                        LoadingDots()
                    }
                    
                    VStack {
                        Text("Connection Pulse")
                        ConnectionPulse(isConnected: .constant(true))
                    }
                }
            }
        }
    }
    
    private var transitionsDemo: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 3), spacing: 20) {
            TransitionDemoCard(effect: .bounce, label: "Bounce")
            TransitionDemoCard(effect: .spray, label: "Spray")
            TransitionDemoCard(effect: .glow, label: "Glow")
            TransitionDemoCard(effect: .shake, label: "Shake")
            TransitionDemoCard(effect: .pop, label: "Pop")
            TransitionDemoCard(effect: .wobble, label: "Wobble")
        }
    }
    
    private var neuralDemo: some View {
        VStack(spacing: 24) {
            DemoSection(title: "Neural Processing Visualization") {
                AdvancedVisualEffects.NeuralProcessingView()
                    .frame(height: 300)
                    .background(.black.opacity(0.8))
                    .cornerRadius(12)
            }
            
            Text("Simulates neural network processing with animated neurons and activation waves")
                .font(.caption)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
    }
    
    private var flowsDemo: some View {
        VStack(spacing: 24) {
            DemoSection(title: "Data Flow Visualization") {
                AdvancedVisualEffects.DataFlowVisualization(
                    nodes: createSampleNodes(),
                    connections: createSampleConnections()
                )
                .frame(height: 300)
                .background(.ultraThinMaterial)
                .cornerRadius(12)
            }
            
            Text("Interactive data flow visualization with animated connections")
                .font(.caption)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
    }
    
    // MARK: - Toolbar
    
    @ToolbarContentBuilder
    private var toolbarContent: some ToolbarContent {
        ToolbarItemGroup(placement: .primaryAction) {
            ModernUIComponentsLibrary.EnhancedActionButton(
                title: "Export Demo",
                icon: "square.and.arrow.up",
                action: { print("Export demo") },
                style: .secondary
            )
            
            ModernUIComponentsLibrary.MorphingIconButton(
                primaryIcon: "sparkles",
                secondaryIcon: "sparkles.rectangle.stack.fill",
                isToggled: showEffects,
                action: { showEffects.toggle() }
            )
        }
    }
    
    // MARK: - Helper Functions
    
    private func startProgressAnimation() {
        Timer.scheduledTimer(withTimeInterval: 2.0, repeats: true) { _ in
            withAnimation(.easeInOut(duration: 1.5)) {
                progress = Double.random(in: 0.2...1.0)
            }
        }
    }
    
    private func createSampleNodes() -> [AdvancedVisualEffects.DataFlowVisualization.DataNode] {
        [
            .init(position: CGPoint(x: 100, y: 100), label: "Input", color: .blue, size: 40),
            .init(position: CGPoint(x: 250, y: 80), label: "Process", color: .green, size: 50),
            .init(position: CGPoint(x: 250, y: 150), label: "Transform", color: .orange, size: 45),
            .init(position: CGPoint(x: 400, y: 100), label: "Output", color: .purple, size: 40),
            .init(position: CGPoint(x: 400, y: 180), label: "Cache", color: .cyan, size: 35)
        ]
    }
    
    private func createSampleConnections() -> [AdvancedVisualEffects.DataFlowVisualization.DataConnection] {
        let nodes = createSampleNodes()
        return [
            .init(fromNodeId: nodes[0].id, toNodeId: nodes[1].id, strength: 0.8, isActive: true),
            .init(fromNodeId: nodes[0].id, toNodeId: nodes[2].id, strength: 0.6, isActive: true),
            .init(fromNodeId: nodes[1].id, toNodeId: nodes[3].id, strength: 0.9, isActive: true),
            .init(fromNodeId: nodes[2].id, toNodeId: nodes[4].id, strength: 0.7, isActive: false),
            .init(fromNodeId: nodes[1].id, toNodeId: nodes[4].id, strength: 0.5, isActive: true)
        ]
    }
}

// MARK: - Supporting Views

struct CategoryRow: View {
    let category: ModernUIIntegration.DemoCategory
    let isSelected: Bool
    let onSelect: () -> Void
    
    var body: some View {
        Button(action: onSelect) {
            HStack(spacing: 12) {
                Image(systemName: category.icon)
                    .font(.system(size: 16, weight: .medium))
                    .foregroundColor(isSelected ? .white : .blue)
                    .frame(width: 24)
                
                Text(category.rawValue)
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .foregroundColor(isSelected ? .white : .primary)
                
                Spacer()
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(
                RoundedRectangle(cornerRadius: 8)
                    .fill(isSelected ? .blue : .clear)
            )
        }
        .buttonStyle(.plain)
        .animation(.easeInOut(duration: 0.2), value: isSelected)
    }
}

struct DemoSection<Content: View>: View {
    let title: String
    let content: () -> Content
    
    init(title: String, @ViewBuilder content: @escaping () -> Content) {
        self.title = title
        self.content = content
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
                .font(.headline)
                .fontWeight(.semibold)
            
            content()
        }
        .padding()
        .background(.ultraThinMaterial)
        .cornerRadius(12)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct TransitionDemoCard: View {
    let effect: AdvancedVisualEffects.PowTransition.TransitionEffect
    let label: String
    @State private var isTriggered = false
    
    var body: some View {
        Button(action: { isTriggered.toggle() }) {
            VStack(spacing: 8) {
                RoundedRectangle(cornerRadius: 8)
                    .fill(.blue.gradient)
                    .frame(width: 60, height: 60)
                    .powTransition(effect, isActive: isTriggered)
                
                Text(label)
                    .font(.caption)
                    .fontWeight(.medium)
            }
            .padding()
            .background(.ultraThinMaterial)
            .cornerRadius(12)
        }
        .buttonStyle(.plain)
    }
}

#Preview {
    ModernUIIntegration()
        .frame(width: 1200, height: 800)
}