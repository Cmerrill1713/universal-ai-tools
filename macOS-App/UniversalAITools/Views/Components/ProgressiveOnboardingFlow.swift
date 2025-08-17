import SwiftUI

/// Progressive Onboarding Flow System
/// Guides users through feature discovery with contextual tutorials and progressive disclosure
struct ProgressiveOnboardingFlow: View {
    @StateObject private var onboardingManager = OnboardingManager.shared
    @State private var currentStep: OnboardingStep?
    @State private var showWelcome = false
    @State private var tourProgress: Double = 0.0
    
    var body: some View {
        ZStack {
            // Main content area
            Color.clear
                .contentShape(Rectangle())
            
            // Onboarding overlays
            if let step = currentStep {
                OnboardingStepView(
                    step: step,
                    progress: tourProgress,
                    onNext: { moveToNextStep() },
                    onSkip: { skipOnboarding() },
                    onComplete: { completeStep(step) }
                )
                .transition(.asymmetric(
                    insertion: .opacity.combined(with: .scale(scale: 0.9)),
                    removal: .opacity.combined(with: .scale(scale: 1.1))
                ))
            }
            
            // Welcome modal
            if showWelcome {
                WelcomeModal(
                    onStartTour: { startOnboardingTour() },
                    onSkip: { skipWelcome() }
                )
                .transition(.opacity.combined(with: .scale))
            }
            
            // Feature discovery hints
            FeatureDiscoveryHints()
        }
        .onAppear {
            checkOnboardingStatus()
        }
        .onChange(of: onboardingManager.activeStep) { step in
            withAnimation(.spring(response: 0.6, dampingFraction: 0.8)) {
                currentStep = step
            }
        }
    }
    
    private func checkOnboardingStatus() {
        if onboardingManager.shouldShowWelcome {
            withAnimation(.spring()) {
                showWelcome = true
            }
        }
    }
    
    private func startOnboardingTour() {
        withAnimation(.spring()) {
            showWelcome = false
        }
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            onboardingManager.startOnboarding()
            updateProgress()
        }
    }
    
    private func skipWelcome() {
        withAnimation(.spring()) {
            showWelcome = false
        }
        onboardingManager.markWelcomeCompleted()
    }
    
    private func moveToNextStep() {
        onboardingManager.nextStep()
        updateProgress()
    }
    
    private func skipOnboarding() {
        onboardingManager.skipOnboarding()
        withAnimation(.spring()) {
            currentStep = nil
        }
    }
    
    private func completeStep(_ step: OnboardingStep) {
        onboardingManager.completeStep(step)
        updateProgress()
    }
    
    private func updateProgress() {
        let totalSteps = onboardingManager.allSteps.count
        let completedSteps = onboardingManager.completedSteps.count
        
        withAnimation(.easeInOut(duration: 0.3)) {
            tourProgress = Double(completedSteps) / Double(totalSteps)
        }
    }
}

// MARK: - Welcome Modal

struct WelcomeModal: View {
    let onStartTour: () -> Void
    let onSkip: () -> Void
    
    @State private var titleScale: CGFloat = 0.8
    @State private var contentOffset: CGFloat = 50
    
    var body: some View {
        ZStack {
            // Background overlay
            Color.black.opacity(0.7)
                .ignoresSafeArea()
            
            // Welcome card
            VStack(spacing: 24) {
                // Header
                VStack(spacing: 16) {
                    Image(systemName: "sparkles")
                        .font(.system(size: 48, weight: .light))
                        .foregroundStyle(.blue.gradient)
                        .scaleEffect(titleScale)
                        .powTransition(.glow, isActive: true)
                    
                    Text("Welcome to Universal AI Tools")
                        .font(.title)
                        .fontWeight(.bold)
                        .multilineTextAlignment(.center)
                        .scaleEffect(titleScale)
                    
                    Text("Discover powerful AI capabilities through our guided tour")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                        .offset(y: contentOffset)
                }
                
                // Features preview
                LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 2), spacing: 16) {
                    FeaturePreviewCard(
                        icon: "brain.head.profile",
                        title: "Agent Orchestration",
                        description: "Real-time AI agent coordination"
                    )
                    
                    FeaturePreviewCard(
                        icon: "chart.line.uptrend.xyaxis",
                        title: "Performance Analytics",
                        description: "Advanced monitoring and insights"
                    )
                    
                    FeaturePreviewCard(
                        icon: "wand.and.rays",
                        title: "Modern UI Effects",
                        description: "Beautiful animations and interactions"
                    )
                    
                    FeaturePreviewCard(
                        icon: "shield.checkered",
                        title: "Error Recovery",
                        description: "Intelligent problem resolution"
                    )
                }
                .offset(y: contentOffset)
                
                // Action buttons
                HStack(spacing: 16) {
                    Button("Skip Tour") {
                        onSkip()
                    }
                    .buttonStyle(.bordered)
                    
                    ModernUIComponentsLibrary.EnhancedActionButton(
                        title: "Start Tour",
                        icon: "play.fill",
                        action: onStartTour,
                        style: .primary
                    )
                }
                .offset(y: contentOffset)
            }
            .padding(32)
            .background(.ultraThickMaterial)
            .cornerRadius(20)
            .shadow(color: .black.opacity(0.3), radius: 20)
            .frame(maxWidth: 600)
            .padding()
        }
        .onAppear {
            withAnimation(.spring(response: 0.8, dampingFraction: 0.7)) {
                titleScale = 1.0
            }
            
            withAnimation(.spring(response: 0.9, dampingFraction: 0.8).delay(0.2)) {
                contentOffset = 0
            }
        }
    }
}

struct FeaturePreviewCard: View {
    let icon: String
    let title: String
    let description: String
    
    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundColor(.blue)
            
            Text(title)
                .font(.subheadline)
                .fontWeight(.semibold)
            
            Text(description)
                .font(.caption)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding()
        .background(.regularMaterial)
        .cornerRadius(12)
    }
}

// MARK: - Onboarding Step View

struct OnboardingStepView: View {
    let step: OnboardingStep
    let progress: Double
    let onNext: () -> Void
    let onSkip: () -> Void
    let onComplete: () -> Void
    
    @State private var isVisible = false
    @State private var highlightPulse: CGFloat = 1.0
    
    var body: some View {
        ZStack {
            // Darkened background
            Color.black.opacity(0.6)
                .ignoresSafeArea()
            
            // Spotlight effect
            if let targetFrame = step.targetFrame {
                SpotlightOverlay(targetFrame: targetFrame)
            }
            
            // Tutorial card
            VStack {
                if step.position == .top {
                    tutorialCard
                    Spacer()
                } else {
                    Spacer()
                    tutorialCard
                }
            }
            .padding()
        }
        .opacity(isVisible ? 1 : 0)
        .onAppear {
            withAnimation(.easeInOut(duration: 0.5)) {
                isVisible = true
            }
            startHighlightPulse()
        }
    }
    
    private var tutorialCard: some View {
        VStack(spacing: 20) {
            // Progress indicator
            HStack {
                ModernUIComponentsLibrary.ProgressRing(progress: progress)
                    .frame(width: 40, height: 40)
                
                Spacer()
                
                Button("Skip Tour") {
                    onSkip()
                }
                .buttonStyle(.borderless)
                .foregroundColor(.secondary)
            }
            
            // Content
            VStack(spacing: 16) {
                // Icon
                Image(systemName: step.icon)
                    .font(.system(size: 32, weight: .medium))
                    .foregroundColor(.blue)
                    .scaleEffect(highlightPulse)
                
                // Title and description
                VStack(spacing: 8) {
                    Text(step.title)
                        .font(.title2)
                        .fontWeight(.bold)
                        .multilineTextAlignment(.center)
                    
                    Text(step.description)
                        .font(.body)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                        .lineLimit(nil)
                }
                
                // Interactive element
                if let interactiveElement = step.interactiveElement {
                    interactiveElement
                }
                
                // Tip
                if let tip = step.tip {
                    HStack(spacing: 8) {
                        Image(systemName: "lightbulb.fill")
                            .foregroundColor(.yellow)
                        
                        Text(tip)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(.yellow.opacity(0.1))
                    .cornerRadius(8)
                }
            }
            
            // Navigation buttons
            HStack(spacing: 16) {
                if step.isOptional {
                    Button("Skip Step") {
                        onNext()
                    }
                    .buttonStyle(.bordered)
                }
                
                Spacer()
                
                if step.type == .action {
                    ModernUIComponentsLibrary.EnhancedActionButton(
                        title: "Try It",
                        icon: "hand.tap",
                        action: onComplete,
                        style: .primary
                    )
                } else {
                    ModernUIComponentsLibrary.EnhancedActionButton(
                        title: step.isLast ? "Finish" : "Next",
                        icon: step.isLast ? "checkmark" : "chevron.right",
                        action: onNext,
                        style: .primary
                    )
                }
            }
        }
        .padding(24)
        .background(.ultraThickMaterial)
        .cornerRadius(16)
        .shadow(color: .black.opacity(0.2), radius: 10)
        .frame(maxWidth: 400)
    }
    
    private func startHighlightPulse() {
        withAnimation(.easeInOut(duration: 1.5).repeatForever(autoreverses: true)) {
            highlightPulse = 1.2
        }
    }
}

// MARK: - Spotlight Overlay

struct SpotlightOverlay: View {
    let targetFrame: CGRect
    
    var body: some View {
        Rectangle()
            .fill(Color.black.opacity(0.4))
            .mask(
                Rectangle()
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .frame(
                                width: targetFrame.width + 20,
                                height: targetFrame.height + 20
                            )
                            .position(
                                x: targetFrame.midX,
                                y: targetFrame.midY
                            )
                            .blendMode(.destinationOut)
                    )
            )
    }
}

// MARK: - Feature Discovery Hints

struct FeatureDiscoveryHints: View {
    @StateObject private var onboardingManager = OnboardingManager.shared
    @State private var activeHints: [FeatureHint] = []
    
    var body: some View {
        ZStack {
            ForEach(activeHints, id: \.id) { hint in
                FeatureHintView(hint: hint) {
                    removeHint(hint)
                }
                .position(hint.position)
                .transition(.scale.combined(with: .opacity))
            }
        }
        .onAppear {
            loadActiveHints()
        }
        .onReceive(onboardingManager.$availableHints) { hints in
            updateActiveHints(hints)
        }
    }
    
    private func loadActiveHints() {
        activeHints = onboardingManager.availableHints
    }
    
    private func updateActiveHints(_ hints: [FeatureHint]) {
        withAnimation(.spring()) {
            activeHints = hints
        }
    }
    
    private func removeHint(_ hint: FeatureHint) {
        withAnimation(.spring()) {
            activeHints.removeAll { $0.id == hint.id }
        }
        onboardingManager.dismissHint(hint)
    }
}

struct FeatureHintView: View {
    let hint: FeatureHint
    let onDismiss: () -> Void
    
    @State private var scale: CGFloat = 0
    @State private var pulseScale: CGFloat = 1.0
    
    var body: some View {
        VStack(spacing: 8) {
            HStack {
                Image(systemName: hint.icon)
                    .foregroundColor(.white)
                    .font(.caption)
                
                Text(hint.title)
                    .font(.caption)
                    .fontWeight(.medium)
                    .foregroundColor(.white)
                    .lineLimit(2)
                
                Button(action: onDismiss) {
                    Image(systemName: "xmark")
                        .font(.caption2)
                        .foregroundColor(.white.opacity(0.7))
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(
                Capsule()
                    .fill(hint.color.gradient)
                    .scaleEffect(pulseScale)
            )
            .scaleEffect(scale)
        }
        .onAppear {
            withAnimation(.spring(response: 0.6, dampingFraction: 0.7)) {
                scale = 1.0
            }
            
            withAnimation(.easeInOut(duration: 2).repeatForever(autoreverses: true)) {
                pulseScale = 1.1
            }
        }
    }
}

// MARK: - Onboarding Data Models

struct OnboardingStep: Identifiable {
    let id = UUID()
    let title: String
    let description: String
    let icon: String
    let type: StepType
    let position: Position
    let targetFrame: CGRect?
    let interactiveElement: AnyView?
    let tip: String?
    let isOptional: Bool
    let isLast: Bool
    
    enum StepType {
        case information, action, interaction
    }
    
    enum Position {
        case top, bottom, center
    }
    
    init(
        title: String,
        description: String,
        icon: String,
        type: StepType = .information,
        position: Position = .center,
        targetFrame: CGRect? = nil,
        interactiveElement: AnyView? = nil,
        tip: String? = nil,
        isOptional: Bool = false,
        isLast: Bool = false
    ) {
        self.title = title
        self.description = description
        self.icon = icon
        self.type = type
        self.position = position
        self.targetFrame = targetFrame
        self.interactiveElement = interactiveElement
        self.tip = tip
        self.isOptional = isOptional
        self.isLast = isLast
    }
}

struct FeatureHint: Identifiable {
    let id = UUID()
    let title: String
    let icon: String
    let color: Color
    let position: CGPoint
    let trigger: HintTrigger
    
    enum HintTrigger {
        case timeDelay(seconds: Double)
        case userAction(String)
        case contextual(String)
    }
}

// MARK: - Onboarding Manager

@MainActor
@Observable
class OnboardingManager: ObservableObject {
    static let shared = OnboardingManager()
    
    @Published var activeStep: OnboardingStep?
    @Published var availableHints: [FeatureHint] = []
    
    private var currentStepIndex = 0
    private(set) var completedSteps: Set<UUID> = []
    private(set) var isOnboardingActive = false
    private let userDefaults = UserDefaults.standard
    
    private init() {
        loadCompletedSteps()
        scheduleContextualHints()
    }
    
    // MARK: - Public API
    
    var shouldShowWelcome: Bool {
        !userDefaults.bool(forKey: "onboarding_welcome_completed")
    }
    
    var allSteps: [OnboardingStep] {
        return [
            OnboardingStep(
                title: "Agent Orchestration Dashboard",
                description: "Monitor your AI agents in real-time. See their status, performance metrics, and network topology.",
                icon: "brain.head.profile",
                type: .action,
                position: .bottom,
                tip: "Click on any agent to see detailed metrics and logs"
            ),
            
            OnboardingStep(
                title: "Error Recovery System",
                description: "When errors occur, our guided recovery system helps you resolve them step-by-step.",
                icon: "shield.checkered",
                type: .information,
                position: .center,
                tip: "Errors are automatically categorized by severity and impact"
            ),
            
            OnboardingStep(
                title: "Performance Optimization",
                description: "Monitor memory usage, cache performance, and get optimization recommendations.",
                icon: "speedometer",
                type: .interaction,
                position: .bottom,
                interactiveElement: AnyView(
                    VStack(spacing: 8) {
                        ModernUIComponentsLibrary.ProgressRing(progress: 0.75)
                            .frame(width: 60, height: 60)
                        Text("75% Cache Hit Rate")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                ),
                tip: "Green indicators show optimal performance"
            ),
            
            OnboardingStep(
                title: "Modern UI Effects",
                description: "Experience beautiful animations and particle effects throughout the interface.",
                icon: "sparkles",
                type: .action,
                position: .center,
                tip: "Many effects respond to your interactions"
            ),
            
            OnboardingStep(
                title: "Command Palette",
                description: "Press ⌘K to quickly access any feature or navigate to different sections.",
                icon: "command",
                type: .action,
                position: .top,
                tip: "Type to search for features, settings, or documentation",
                isOptional: true
            ),
            
            OnboardingStep(
                title: "You're All Set!",
                description: "You've completed the tour. Explore the features at your own pace, or revisit this tour anytime from Settings.",
                icon: "checkmark.circle.fill",
                type: .information,
                position: .center,
                tip: "Use the Help menu to access documentation and support",
                isLast: true
            )
        ]
    }
    
    func startOnboarding() {
        isOnboardingActive = true
        currentStepIndex = 0
        activeStep = allSteps[currentStepIndex]
    }
    
    func nextStep() {
        if currentStepIndex < allSteps.count - 1 {
            currentStepIndex += 1
            activeStep = allSteps[currentStepIndex]
        } else {
            completeOnboarding()
        }
    }
    
    func completeStep(_ step: OnboardingStep) {
        completedSteps.insert(step.id)
        saveCompletedSteps()
        nextStep()
    }
    
    func skipOnboarding() {
        isOnboardingActive = false
        activeStep = nil
        markOnboardingCompleted()
    }
    
    func markWelcomeCompleted() {
        userDefaults.set(true, forKey: "onboarding_welcome_completed")
    }
    
    func restartOnboarding() {
        completedSteps.removeAll()
        saveCompletedSteps()
        userDefaults.set(false, forKey: "onboarding_welcome_completed")
        userDefaults.set(false, forKey: "onboarding_completed")
    }
    
    func showHint(_ hint: FeatureHint) {
        if !availableHints.contains(where: { $0.id == hint.id }) {
            availableHints.append(hint)
        }
    }
    
    func dismissHint(_ hint: FeatureHint) {
        availableHints.removeAll { $0.id == hint.id }
    }
    
    // MARK: - Private Methods
    
    private func completeOnboarding() {
        isOnboardingActive = false
        activeStep = nil
        markOnboardingCompleted()
        showCompletionHint()
    }
    
    private func markOnboardingCompleted() {
        userDefaults.set(true, forKey: "onboarding_completed")
    }
    
    private func loadCompletedSteps() {
        if let data = userDefaults.data(forKey: "completed_onboarding_steps"),
           let steps = try? JSONDecoder().decode(Set<UUID>.self, from: data) {
            completedSteps = steps
        }
    }
    
    private func saveCompletedSteps() {
        if let data = try? JSONEncoder().encode(completedSteps) {
            userDefaults.set(data, forKey: "completed_onboarding_steps")
        }
    }
    
    private func scheduleContextualHints() {
        // Schedule hints to appear based on user behavior
        DispatchQueue.main.asyncAfter(deadline: .now() + 30) {
            self.showCommandPaletteHint()
        }
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 120) {
            self.showPerformanceHint()
        }
    }
    
    private func showCommandPaletteHint() {
        let hint = FeatureHint(
            title: "Press ⌘K for quick access",
            icon: "command",
            color: .blue,
            position: CGPoint(x: 100, y: 50),
            trigger: .timeDelay(seconds: 30)
        )
        showHint(hint)
    }
    
    private func showPerformanceHint() {
        let hint = FeatureHint(
            title: "Check performance metrics",
            icon: "speedometer",
            color: .green,
            position: CGPoint(x: 300, y: 100),
            trigger: .timeDelay(seconds: 120)
        )
        showHint(hint)
    }
    
    private func showCompletionHint() {
        let hint = FeatureHint(
            title: "Tour completed! 🎉",
            icon: "checkmark.circle.fill",
            color: .green,
            position: CGPoint(x: 200, y: 150),
            trigger: .contextual("onboarding_completed")
        )
        showHint(hint)
        
        // Auto-dismiss after 3 seconds
        DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
            self.dismissHint(hint)
        }
    }
}

// MARK: - View Extensions

extension View {
    /// Add progressive onboarding to any view
    func progressiveOnboarding() -> some View {
        self.overlay(ProgressiveOnboardingFlow())
    }
    
    /// Mark a view as an onboarding target
    func onboardingTarget(id: String) -> some View {
        self.background(
            GeometryReader { geometry in
                Color.clear
                    .onAppear {
                        // Register this view's frame for onboarding targeting
                        let frame = geometry.frame(in: .global)
                        OnboardingTargetRegistry.shared.registerTarget(id: id, frame: frame)
                    }
            }
        )
    }
}

// MARK: - Target Registry

class OnboardingTargetRegistry: ObservableObject {
    static let shared = OnboardingTargetRegistry()
    
    private var targets: [String: CGRect] = [:]
    
    private init() {}
    
    func registerTarget(id: String, frame: CGRect) {
        targets[id] = frame
    }
    
    func getTargetFrame(id: String) -> CGRect? {
        return targets[id]
    }
}

#Preview {
    ZStack {
        Color.gray.opacity(0.1)
            .ignoresSafeArea()
        
        VStack {
            Text("Sample App Content")
                .font(.title)
            
            Rectangle()
                .fill(.blue.opacity(0.3))
                .frame(width: 200, height: 100)
                .onboardingTarget(id: "sample_feature")
        }
    }
    .progressiveOnboarding()
}