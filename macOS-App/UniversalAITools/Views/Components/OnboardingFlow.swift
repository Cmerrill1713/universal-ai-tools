import SwiftUI

/// Progressive onboarding flow for feature discovery
struct OnboardingFlow: View {
    @AppStorage("hasCompletedOnboarding") private var hasCompletedOnboarding = false
    @AppStorage("onboardingStep") private var currentStep = 0
    @Environment(\.dismiss) private var dismiss
    
    let onComplete: () -> Void
    
    private let steps: [OnboardingStep] = [
        OnboardingStep(
            title: "Welcome to Universal AI Tools",
            description: "A sophisticated AI platform with agent orchestration, real-time analytics, and advanced visualizations.",
            icon: "brain.head.profile",
            features: [
                "🤖 Multi-agent orchestration",
                "📊 Real-time performance monitoring", 
                "🌐 3D knowledge graph visualization",
                "🎯 AB-MCTS decision trees"
            ]
        ),
        OnboardingStep(
            title: "Agent Orchestration Dashboard",
            description: "Monitor and control your AI agents in real-time. See network topology, performance metrics, and coordination.",
            icon: "network",
            features: [
                "⚡ Live agent status updates",
                "🔗 Network topology visualization",
                "📈 Performance analytics",
                "🎛️ Workflow management"
            ]
        ),
        OnboardingStep(
            title: "3D Knowledge Graph",
            description: "Explore complex data relationships in an interactive 3D space with advanced navigation controls.",
            icon: "cube.transparent",
            features: [
                "🌌 Immersive 3D visualization",
                "🔍 Semantic search and filtering",
                "⚡ Real-time data updates",
                "🎨 Customizable themes and layouts"
            ]
        ),
        OnboardingStep(
            title: "Advanced Analytics",
            description: "Deep insights into agent performance, memory usage, and system health with professional-grade monitoring.",
            icon: "chart.line.uptrend.xyaxis",
            features: [
                "📊 Real-time performance dashboards",
                "💾 Memory optimization tracking",
                "🔥 Flash Attention analytics",
                "⚠️ Intelligent alerting system"
            ]
        ),
        OnboardingStep(
            title: "Voice & Context Management",
            description: "Interact naturally with AI agents and manage conversation context with advanced features.",
            icon: "waveform.circle.fill",
            features: [
                "🎤 Voice interactions with STT/TTS",
                "🧠 Intelligent context clustering",
                "📝 Automatic conversation summarization",
                "🔄 Context synchronization across agents"
            ]
        )
    ]
    
    var body: some View {
        ZStack {
            // Animated background
            AnimatedGradientBackground()
                .edgesIgnoringSafeArea(.all)
            
            VStack(spacing: 0) {
                // Progress indicator
                progressIndicator
                
                // Main content
                TabView(selection: $currentStep) {
                    ForEach(0..<steps.count, id: \.self) { index in
                        OnboardingStepView(
                            step: steps[index],
                            isFirst: index == 0,
                            isLast: index == steps.count - 1,
                            onNext: { nextStep() },
                            onSkip: { completeOnboarding() },
                            onComplete: { completeOnboarding() }
                        )
                        .tag(index)
                    }
                }
                .tabViewStyle(PageTabViewStyle(indexDisplayMode: .never))
                .animation(.easeInOut(duration: 0.4), value: currentStep)
            }
        }
        .onAppear {
            // Reset if we're starting over
            if currentStep >= steps.count {
                currentStep = 0
            }
        }
    }
    
    private var progressIndicator: some View {
        HStack {
            ForEach(0..<steps.count, id: \.self) { index in
                Capsule()
                    .fill(index <= currentStep ? AppTheme.accentOrange : Color.gray.opacity(0.3))
                    .frame(height: 4)
                    .animation(.easeInOut(duration: 0.3), value: currentStep)
            }
        }
        .padding(.horizontal, 40)
        .padding(.top, 20)
    }
    
    private func nextStep() {
        withAnimation(.easeInOut(duration: 0.4)) {
            if currentStep < steps.count - 1 {
                currentStep += 1
            } else {
                completeOnboarding()
            }
        }
    }
    
    private func completeOnboarding() {
        hasCompletedOnboarding = true
        currentStep = 0
        withAnimation(.easeInOut(duration: 0.3)) {
            onComplete()
        }
    }
}

struct OnboardingStep {
    let title: String
    let description: String
    let icon: String
    let features: [String]
}

struct OnboardingStepView: View {
    let step: OnboardingStep
    let isFirst: Bool
    let isLast: Bool
    let onNext: () -> Void
    let onSkip: () -> Void
    let onComplete: () -> Void
    
    @State private var animateContent = false
    
    var body: some View {
        VStack(spacing: 40) {
            Spacer()
            
            // Icon
            VStack(spacing: 24) {
                Image(systemName: step.icon)
                    .font(.system(size: 80, weight: .light))
                    .foregroundColor(AppTheme.accentOrange)
                    .background(
                        Circle()
                            .fill(AppTheme.accentOrange.opacity(0.1))
                            .frame(width: 140, height: 140)
                    )
                    .scaleEffect(animateContent ? 1.0 : 0.8)
                    .animation(.spring(response: 0.6, dampingFraction: 0.7), value: animateContent)
                
                // Title
                Text(step.title)
                    .font(.largeTitle)
                    .fontWeight(.bold)
                    .multilineTextAlignment(.center)
                    .opacity(animateContent ? 1.0 : 0.0)
                    .offset(y: animateContent ? 0 : 20)
                    .animation(.easeOut(duration: 0.6).delay(0.2), value: animateContent)
            }
            
            // Description
            Text(step.description)
                .font(.title3)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
                .opacity(animateContent ? 1.0 : 0.0)
                .offset(y: animateContent ? 0 : 20)
                .animation(.easeOut(duration: 0.6).delay(0.4), value: animateContent)
            
            // Features list
            VStack(alignment: .leading, spacing: 12) {
                ForEach(Array(step.features.enumerated()), id: \.offset) { index, feature in
                    HStack(alignment: .top, spacing: 12) {
                        Text(String(feature.prefix(2))) // Extract emoji
                            .font(.title2)
                        Text(String(feature.dropFirst(2))) // Extract text without emoji
                            .font(.body)
                            .fontWeight(.medium)
                        Spacer()
                    }
                    .opacity(animateContent ? 1.0 : 0.0)
                    .offset(x: animateContent ? 0 : -30)
                    .animation(.easeOut(duration: 0.5).delay(0.6 + Double(index) * 0.1), value: animateContent)
                }
            }
            .padding(.horizontal, 60)
            .padding(.vertical, 20)
            .background(.ultraThinMaterial)
            .cornerRadius(16)
            .padding(.horizontal, 40)
            .opacity(animateContent ? 1.0 : 0.0)
            .offset(y: animateContent ? 0 : 30)
            .animation(.easeOut(duration: 0.6).delay(0.8), value: animateContent)
            
            Spacer()
            
            // Navigation buttons
            HStack(spacing: 20) {
                if !isFirst {
                    Button("Skip Tour") {
                        onSkip()
                    }
                    .buttonStyle(.bordered)
                    .opacity(animateContent ? 1.0 : 0.0)
                    .animation(.easeOut(duration: 0.6).delay(1.0), value: animateContent)
                }
                
                Spacer()
                
                Button(action: isLast ? onComplete : onNext) {
                    HStack {
                        Text(isLast ? "Get Started" : "Continue")
                            .fontWeight(.semibold)
                        
                        if !isLast {
                            Image(systemName: "arrow.right")
                                .font(.caption)
                        }
                    }
                    .frame(minWidth: 120)
                }
                .buttonStyle(.borderedProminent)
                .opacity(animateContent ? 1.0 : 0.0)
                .animation(.easeOut(duration: 0.6).delay(1.0), value: animateContent)
            }
            .padding(.horizontal, 40)
            .padding(.bottom, 40)
        }
        .onAppear {
            animateContent = true
        }
        .onDisappear {
            animateContent = false
        }
    }
}

/// Feature discovery tooltip system
struct FeatureDiscoveryTooltip: View {
    let title: String
    let description: String
    let position: TooltipPosition
    @Binding var isVisible: Bool
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(title)
                    .font(.headline)
                    .fontWeight(.semibold)
                
                Spacer()
                
                Button("✕") {
                    withAnimation(.easeOut(duration: 0.2)) {
                        isVisible = false
                    }
                }
                .buttonStyle(.plain)
                .foregroundColor(.secondary)
            }
            
            Text(description)
                .font(.body)
                .foregroundColor(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(16)
        .background(.regularMaterial)
        .cornerRadius(12)
        .shadow(radius: 8)
        .frame(maxWidth: 280)
        .opacity(isVisible ? 1.0 : 0.0)
        .scaleEffect(isVisible ? 1.0 : 0.9)
        .animation(.spring(response: 0.4, dampingFraction: 0.8), value: isVisible)
    }
}

enum TooltipPosition {
    case top, bottom, leading, trailing
}

/// Progressive feature disclosure system
struct FeatureDiscoveryManager: ObservableObject {
    @Published var discoveredFeatures: Set<String> = []
    @Published var availableFeatures: [DiscoverableFeature] = [
        DiscoverableFeature(
            id: "3d-knowledge-graph",
            title: "3D Knowledge Graph",
            description: "Explore data relationships in 3D space with advanced navigation controls",
            icon: "cube.transparent",
            category: .visualization
        ),
        DiscoverableFeature(
            id: "agent-orchestration",
            title: "Agent Orchestration",
            description: "Monitor and control multiple AI agents with real-time coordination",
            icon: "brain.head.profile",
            category: .agents
        ),
        DiscoverableFeature(
            id: "voice-interaction",
            title: "Voice Commands",
            description: "Control the app with natural speech using advanced STT/TTS",
            icon: "waveform.circle.fill",
            category: .interaction
        ),
        DiscoverableFeature(
            id: "context-clustering",
            title: "Context Clustering", 
            description: "Automatically organize conversations by topic and relevance",
            icon: "brain.fill",
            category: .intelligence
        ),
        DiscoverableFeature(
            id: "flash-attention",
            title: "Flash Attention Analytics",
            description: "Advanced memory optimization with attention mechanism insights",
            icon: "bolt.circle.fill",
            category: .performance
        )
    ]
    
    func discoverFeature(_ featureId: String) {
        discoveredFeatures.insert(featureId)
        UserDefaults.standard.set(Array(discoveredFeatures), forKey: "discoveredFeatures")
    }
    
    func loadDiscoveredFeatures() {
        if let saved = UserDefaults.standard.array(forKey: "discoveredFeatures") as? [String] {
            discoveredFeatures = Set(saved)
        }
    }
    
    func isFeatureDiscovered(_ featureId: String) -> Bool {
        discoveredFeatures.contains(featureId)
    }
    
    func undiscoveredFeatures(in category: FeatureCategory) -> [DiscoverableFeature] {
        availableFeatures.filter { feature in
            feature.category == category && !isFeatureDiscovered(feature.id)
        }
    }
}

struct DiscoverableFeature: Identifiable {
    let id: String
    let title: String
    let description: String
    let icon: String
    let category: FeatureCategory
}

enum FeatureCategory: String, CaseIterable {
    case visualization = "Visualization"
    case agents = "Agent Systems"
    case interaction = "Interaction"
    case intelligence = "AI Intelligence"
    case performance = "Performance"
    
    var color: Color {
        switch self {
        case .visualization: return .blue
        case .agents: return .orange
        case .interaction: return .green
        case .intelligence: return .purple
        case .performance: return .red
        }
    }
}

/// Feature discovery badge that appears on new features
struct FeatureDiscoveryBadge: View {
    let feature: DiscoverableFeature
    @ObservedObject var discoveryManager: FeatureDiscoveryManager
    @State private var showTooltip = false
    
    var body: some View {
        Button(action: {
            showTooltip.toggle()
            if showTooltip {
                discoveryManager.discoverFeature(feature.id)
            }
        }) {
            HStack(spacing: 6) {
                Image(systemName: "sparkles")
                    .font(.caption)
                Text("New")
                    .font(.caption2)
                    .fontWeight(.semibold)
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(feature.category.color)
            .foregroundColor(.white)
            .cornerRadius(8)
            .shadow(radius: 2)
        }
        .buttonStyle(.plain)
        .opacity(discoveryManager.isFeatureDiscovered(feature.id) ? 0 : 1)
        .animation(.easeInOut(duration: 0.3), value: discoveryManager.isFeatureDiscovered(feature.id))
        .popover(isPresented: $showTooltip) {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Image(systemName: feature.icon)
                        .foregroundColor(feature.category.color)
                    Text(feature.title)
                        .font(.headline)
                        .fontWeight(.semibold)
                }
                
                Text(feature.description)
                    .font(.body)
                    .foregroundColor(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
                
                Button("Got it!") {
                    showTooltip = false
                }
                .buttonStyle(.borderedProminent)
            }
            .padding()
            .frame(maxWidth: 300)
        }
    }
}

#Preview {
    OnboardingFlow(onComplete: {
        print("Onboarding completed")
    })
}