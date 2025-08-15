//
//  OnboardingExperience.swift
//  UniversalAITools
//
//  Created by Claude Code on 8/15/25.
//  Copyright © 2025 Christian Merrill. All rights reserved.
//

import Foundation
import SwiftUI
import AppKit
import Combine
import AVFoundation

@MainActor
class OnboardingManager: ObservableObject {
    static let shared = OnboardingManager()
    
    // MARK: - Published Properties
    @Published var currentStep: OnboardingStep = .welcome
    @Published var progress: Double = 0.0
    @Published var isActive: Bool = false
    @Published var userProfile: UserProfile = UserProfile()
    @Published var selectedFeatures: Set<FeatureType> = []
    @Published var tutorialProgress: [String: Bool] = [:]
    @Published var achievements: [Achievement] = []
    @Published var showingTutorial: Bool = false
    @Published var currentTutorial: Tutorial?
    @Published var contextualHints: [ContextualHint] = []
    
    // MARK: - Private Properties
    private var cancellables = Set<AnyCancellable>()
    private var stepHistory: [OnboardingStep] = []
    private var analyticsTracker = AnalyticsTracker()
    private var helpSystem = HelpSystem()
    private var videoPlayer: AVPlayer?
    
    // MARK: - Initialization
    private init() {
        loadOnboardingState()
        setupContextualHints()
    }
    
    // MARK: - Public Interface
    
    /// Start the onboarding experience
    func startOnboarding(forUserType userType: UserType? = nil) {
        isActive = true
        currentStep = .welcome
        progress = 0.0
        stepHistory = []
        
        if let userType = userType {
            userProfile.userType = userType
            customizeOnboardingForUserType(userType)
        }
        
        analyticsTracker.trackOnboardingStart()
        
        // Show welcome step
        showStep(.welcome)
    }
    
    /// Advance to the next onboarding step
    func nextStep() {
        let nextStep = getNextStep(from: currentStep)
        
        if let next = nextStep {
            stepHistory.append(currentStep)
            showStep(next)
            analyticsTracker.trackStepCompletion(currentStep)
        } else {
            completeOnboarding()
        }
    }
    
    /// Go back to the previous step
    func previousStep() {
        guard let previousStep = stepHistory.last else { return }
        
        stepHistory.removeLast()
        showStep(previousStep)
        analyticsTracker.trackStepBack(currentStep)
    }
    
    /// Skip to a specific step
    func skipToStep(_ step: OnboardingStep) {
        stepHistory.append(currentStep)
        showStep(step)
        analyticsTracker.trackStepSkip(from: currentStep, to: step)
    }
    
    /// Complete the onboarding experience
    func completeOnboarding() {
        isActive = false
        progress = 1.0
        
        saveOnboardingCompletion()
        analyticsTracker.trackOnboardingComplete()
        
        // Award completion achievement
        awardAchievement(.onboardingComplete)
        
        // Setup initial workspace based on user preferences
        setupInitialWorkspace()
        
        NotificationCenter.default.post(
            name: .onboardingCompleted,
            object: userProfile
        )
    }
    
    /// Start an interactive tutorial
    func startTutorial(_ tutorial: Tutorial) {
        currentTutorial = tutorial
        showingTutorial = true
        
        analyticsTracker.trackTutorialStart(tutorial.id)
        
        // Prepare tutorial environment
        prepareTutorialEnvironment(tutorial)
    }
    
    /// Complete current tutorial
    func completeTutorial() {
        guard let tutorial = currentTutorial else { return }
        
        tutorialProgress[tutorial.id] = true
        showingTutorial = false
        currentTutorial = nil
        
        // Award tutorial achievement
        awardAchievement(.tutorialComplete(tutorial.id))
        
        analyticsTracker.trackTutorialComplete(tutorial.id)
        saveOnboardingState()
    }
    
    /// Show contextual help for a feature
    func showContextualHelp(for feature: String) {
        let helpContent = helpSystem.getHelpContent(for: feature)
        
        if let content = helpContent {
            let hint = ContextualHint(
                id: UUID().uuidString,
                feature: feature,
                content: content,
                position: .automatic,
                priority: .medium
            )
            
            contextualHints.append(hint)
            
            // Auto-dismiss after delay
            DispatchQueue.main.asyncAfter(deadline: .now() + 10.0) {
                self.dismissContextualHint(hint.id)
            }
        }
    }
    
    /// Dismiss a contextual hint
    func dismissContextualHint(_ hintId: String) {
        contextualHints.removeAll { $0.id == hintId }
    }
    
    /// Get available tutorials
    func getAvailableTutorials() -> [Tutorial] {
        return Tutorial.allTutorials.filter { tutorial in
            // Show tutorials appropriate for user level
            tutorial.difficulty <= userProfile.experienceLevel
        }
    }
    
    /// Get personalized onboarding path
    func getPersonalizedPath() -> [OnboardingStep] {
        var path: [OnboardingStep] = [.welcome, .userTypeSelection]
        
        // Customize based on user type
        switch userProfile.userType {
        case .developer:
            path += [.developmentSetup, .apiConfiguration, .debugging]
        case .dataScientist:
            path += [.dataAnalysis, .visualization, .modelTraining]
        case .businessUser:
            path += [.dashboardSetup, .basicWorkflows, .reporting]
        case .researcher:
            path += [.researchTools, .dataCollection, .analysis]
        case .student:
            path += [.learningMode, .tutorials, .basicFeatures]
        }
        
        path += [.featureDiscovery, .firstProject, .completion]
        return path
    }
    
    /// Check if onboarding should be shown
    func shouldShowOnboarding() -> Bool {
        return !UserDefaults.standard.bool(forKey: "OnboardingCompleted")
    }
    
    /// Reset onboarding state
    func resetOnboarding() {
        UserDefaults.standard.removeObject(forKey: "OnboardingCompleted")
        UserDefaults.standard.removeObject(forKey: "OnboardingState")
        UserDefaults.standard.removeObject(forKey: "TutorialProgress")
        
        currentStep = .welcome
        progress = 0.0
        isActive = false
        tutorialProgress = [:]
        achievements = []
    }
    
    // MARK: - Private Implementation
    
    private func showStep(_ step: OnboardingStep) {
        currentStep = step
        progress = Double(getStepIndex(step)) / Double(getTotalSteps())
        
        // Update UI for new step
        updateUIForStep(step)
        
        // Show contextual hints for this step
        showContextualHintsForStep(step)
    }
    
    private func getNextStep(from current: OnboardingStep) -> OnboardingStep? {
        let path = getPersonalizedPath()
        guard let currentIndex = path.firstIndex(of: current),
              currentIndex < path.count - 1 else {
            return nil
        }
        
        return path[currentIndex + 1]
    }
    
    private func getStepIndex(_ step: OnboardingStep) -> Int {
        let path = getPersonalizedPath()
        return path.firstIndex(of: step) ?? 0
    }
    
    private func getTotalSteps() -> Int {
        return getPersonalizedPath().count
    }
    
    private func customizeOnboardingForUserType(_ userType: UserType) {
        // Customize the experience based on user type
        switch userType {
        case .developer:
            selectedFeatures = [.apiAccess, .debugging, .codeGeneration]
        case .dataScientist:
            selectedFeatures = [.dataAnalysis, .visualization, .modelTraining]
        case .businessUser:
            selectedFeatures = [.dashboards, .reporting, .workflows]
        case .researcher:
            selectedFeatures = [.research, .dataCollection, .analysis]
        case .student:
            selectedFeatures = [.learning, .tutorials, .basicTools]
        }
    }
    
    private func updateUIForStep(_ step: OnboardingStep) {
        // Update UI elements for the current step
        NotificationCenter.default.post(
            name: .onboardingStepChanged,
            object: step
        )
    }
    
    private func showContextualHintsForStep(_ step: OnboardingStep) {
        let hints = getHintsForStep(step)
        contextualHints.append(contentsOf: hints)
    }
    
    private func getHintsForStep(_ step: OnboardingStep) -> [ContextualHint] {
        switch step {
        case .welcome:
            return [
                ContextualHint(
                    id: "welcome-hint",
                    feature: "welcome",
                    content: HelpContent(
                        title: "Welcome to Universal AI Tools",
                        description: "Let's get you set up with the perfect configuration for your needs.",
                        steps: ["Follow the guided setup", "Customize your experience", "Start your first project"],
                        videoURL: Bundle.main.url(forResource: "welcome-intro", withExtension: "mp4")
                    ),
                    position: .center,
                    priority: .high
                )
            ]
        case .userTypeSelection:
            return [
                ContextualHint(
                    id: "user-type-hint",
                    feature: "userType",
                    content: HelpContent(
                        title: "Choose Your Role",
                        description: "This helps us customize the interface and features for your specific needs.",
                        steps: ["Select your primary role", "We'll tailor the experience", "You can change this later"],
                        videoURL: nil
                    ),
                    position: .bottom,
                    priority: .medium
                )
            ]
        default:
            return []
        }
    }
    
    private func prepareTutorialEnvironment(_ tutorial: Tutorial) {
        // Setup the environment for the tutorial
        switch tutorial.id {
        case "first-chat":
            // Prepare chat interface
            break
        case "data-visualization":
            // Load sample data
            loadSampleDataForTutorial()
        case "workflow-creation":
            // Setup workflow builder
            break
        default:
            break
        }
    }
    
    private func loadSampleDataForTutorial() {
        // Load sample data for tutorial purposes
        let sampleData = SampleDataGenerator.generateVisualizationData()
        
        // Make it available to the tutorial
        NotificationCenter.default.post(
            name: .tutorialDataLoaded,
            object: sampleData
        )
    }
    
    private func setupInitialWorkspace() {
        // Setup initial workspace based on user preferences
        let layoutManager = DashboardLayoutManager.shared
        
        switch userProfile.userType {
        case .developer:
            setupDeveloperWorkspace(layoutManager)
        case .dataScientist:
            setupDataScientistWorkspace(layoutManager)
        case .businessUser:
            setupBusinessWorkspace(layoutManager)
        case .researcher:
            setupResearchWorkspace(layoutManager)
        case .student:
            setupStudentWorkspace(layoutManager)
        }
    }
    
    private func setupDeveloperWorkspace(_ layoutManager: DashboardLayoutManager) {
        // Create developer-focused layout
        let _ = layoutManager.createPanel(
            type: .debug,
            title: "Debug Console",
            content: AnyView(DebugConsoleView())
        )
        
        let _ = layoutManager.createPanel(
            type: .tools,
            title: "Development Tools",
            content: AnyView(ToolsView())
        )
    }
    
    private func setupDataScientistWorkspace(_ layoutManager: DashboardLayoutManager) {
        // Create data science layout
        let _ = layoutManager.createPanel(
            type: .analytics,
            title: "Data Analytics",
            content: AnyView(Text("Analytics Panel"))
        )
        
        let _ = layoutManager.createPanel(
            type: .visualization,
            title: "Visualizations",
            content: AnyView(Text("Visualization Panel"))
        )
    }
    
    private func setupBusinessWorkspace(_ layoutManager: DashboardLayoutManager) {
        // Create business user layout
        let _ = layoutManager.createPanel(
            type: .analytics,
            title: "Business Dashboard",
            content: AnyView(Text("Dashboard Panel"))
        )
    }
    
    private func setupResearchWorkspace(_ layoutManager: DashboardLayoutManager) {
        // Create research-focused layout
        let _ = layoutManager.createPanel(
            type: .tools,
            title: "Research Tools",
            content: AnyView(Text("Research Panel"))
        )
    }
    
    private func setupStudentWorkspace(_ layoutManager: DashboardLayoutManager) {
        // Create learning-focused layout
        let _ = layoutManager.createPanel(
            type: .chat,
            title: "AI Assistant",
            content: AnyView(SimpleChatView())
        )
    }
    
    private func awardAchievement(_ achievement: Achievement) {
        if !achievements.contains(where: { $0.id == achievement.id }) {
            achievements.append(achievement)
            
            // Show achievement notification
            NotificationCenter.default.post(
                name: .achievementUnlocked,
                object: achievement
            )
        }
    }
    
    private func loadOnboardingState() {
        // Load saved onboarding state
        if let data = UserDefaults.standard.data(forKey: "OnboardingState"),
           let state = try? JSONDecoder().decode(OnboardingState.self, from: data) {
            currentStep = state.currentStep
            progress = state.progress
            userProfile = state.userProfile
            selectedFeatures = state.selectedFeatures
        }
        
        // Load tutorial progress
        if let progressData = UserDefaults.standard.data(forKey: "TutorialProgress"),
           let progress = try? JSONDecoder().decode([String: Bool].self, from: progressData) {
            tutorialProgress = progress
        }
    }
    
    private func saveOnboardingState() {
        let state = OnboardingState(
            currentStep: currentStep,
            progress: progress,
            userProfile: userProfile,
            selectedFeatures: selectedFeatures
        )
        
        if let data = try? JSONEncoder().encode(state) {
            UserDefaults.standard.set(data, forKey: "OnboardingState")
        }
        
        // Save tutorial progress
        if let progressData = try? JSONEncoder().encode(tutorialProgress) {
            UserDefaults.standard.set(progressData, forKey: "TutorialProgress")
        }
    }
    
    private func saveOnboardingCompletion() {
        UserDefaults.standard.set(true, forKey: "OnboardingCompleted")
        UserDefaults.standard.set(Date(), forKey: "OnboardingCompletedDate")
        saveOnboardingState()
    }
    
    private func setupContextualHints() {
        // Setup system for showing contextual hints
        Timer.publish(every: 30.0, on: .main, in: .common)
            .autoconnect()
            .sink { _ in
                self.checkForContextualHints()
            }
            .store(in: &cancellables)
    }
    
    private func checkForContextualHints() {
        // Check if we should show contextual hints based on user behavior
        let currentView = getCurrentActiveView()
        let timeSinceLastHint = getTimeSinceLastHint()
        
        if timeSinceLastHint > 60 && shouldShowHintForView(currentView) {
            showContextualHelp(for: currentView)
        }
    }
    
    private func getCurrentActiveView() -> String {
        // Determine the currently active view
        return "main" // Placeholder
    }
    
    private func getTimeSinceLastHint() -> TimeInterval {
        // Get time since last hint was shown
        return 0 // Placeholder
    }
    
    private func shouldShowHintForView(_ view: String) -> Bool {
        // Determine if we should show a hint for the current view
        return false // Placeholder
    }
}

// MARK: - OnboardingExperienceView

struct OnboardingExperienceView: View {
    @StateObject private var onboardingManager = OnboardingManager.shared
    @State private var showingVideoPlayer = false
    
    var body: some View {
        ZStack {
            // Background
            LinearGradient(
                colors: [Color.blue.opacity(0.1), Color.purple.opacity(0.1)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()
            
            VStack(spacing: 0) {
                // Progress indicator
                OnboardingProgressView(
                    progress: onboardingManager.progress,
                    currentStep: onboardingManager.currentStep
                )
                
                // Main content
                currentStepView
                    .transition(.asymmetric(
                        insertion: .move(edge: .trailing).combined(with: .opacity),
                        removal: .move(edge: .leading).combined(with: .opacity)
                    ))
                
                // Navigation buttons
                OnboardingNavigationView(
                    canGoBack: !onboardingManager.stepHistory.isEmpty,
                    canGoForward: true,
                    onBack: onboardingManager.previousStep,
                    onNext: onboardingManager.nextStep,
                    onSkip: { onboardingManager.skipToStep(.completion) }
                )
            }
        }
        .sheet(isPresented: $showingVideoPlayer) {
            if let tutorial = onboardingManager.currentTutorial,
               let videoURL = tutorial.videoURL {
                VideoPlayerView(url: videoURL)
            }
        }
        .overlay(
            // Contextual hints overlay
            ForEach(onboardingManager.contextualHints) { hint in
                ContextualHintView(hint: hint) {
                    onboardingManager.dismissContextualHint(hint.id)
                }
            }
        )
    }
    
    @ViewBuilder
    private var currentStepView: some View {
        switch onboardingManager.currentStep {
        case .welcome:
            WelcomeStepView()
        case .userTypeSelection:
            UserTypeSelectionView()
        case .featureDiscovery:
            FeatureDiscoveryView()
        case .developmentSetup:
            DevelopmentSetupView()
        case .dataAnalysis:
            DataAnalysisSetupView()
        case .dashboardSetup:
            DashboardSetupView()
        case .researchTools:
            ResearchToolsSetupView()
        case .learningMode:
            LearningModeSetupView()
        case .apiConfiguration:
            APIConfigurationView()
        case .firstProject:
            FirstProjectView()
        case .tutorials:
            TutorialSelectionView()
        case .completion:
            CompletionView()
        default:
            GenericStepView(step: onboardingManager.currentStep)
        }
    }
}

// MARK: - Step Views

struct WelcomeStepView: View {
    var body: some View {
        VStack(spacing: 30) {
            // App icon and title
            VStack(spacing: 20) {
                Image(systemName: "brain.head.profile")
                    .font(.system(size: 80))
                    .foregroundColor(.blue)
                
                Text("Welcome to Universal AI Tools")
                    .font(.largeTitle)
                    .fontWeight(.bold)
                
                Text("Your comprehensive AI development and analysis platform")
                    .font(.title2)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
            }
            
            // Key features highlight
            VStack(alignment: .leading, spacing: 15) {
                FeatureHighlight(
                    icon: "wand.and.rays",
                    title: "Advanced AI Integration",
                    description: "Connect with multiple AI models and services"
                )
                
                FeatureHighlight(
                    icon: "chart.bar.xaxis",
                    title: "Data Visualization",
                    description: "Create stunning visualizations and dashboards"
                )
                
                FeatureHighlight(
                    icon: "gear.badge.checkmark",
                    title: "Workflow Automation",
                    description: "Automate complex AI workflows and processes"
                )
            }
            .padding()
            .background(Color(.controlBackgroundColor))
            .cornerRadius(12)
            
            Spacer()
        }
        .padding(40)
    }
}

struct UserTypeSelectionView: View {
    @StateObject private var onboardingManager = OnboardingManager.shared
    
    var body: some View {
        VStack(spacing: 30) {
            VStack(spacing: 10) {
                Text("What describes you best?")
                    .font(.title)
                    .fontWeight(.semibold)
                
                Text("We'll customize your experience based on your role")
                    .font(.body)
                    .foregroundColor(.secondary)
            }
            
            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 2), spacing: 20) {
                ForEach(UserType.allCases, id: \.self) { userType in
                    UserTypeCard(
                        userType: userType,
                        isSelected: onboardingManager.userProfile.userType == userType
                    ) {
                        onboardingManager.userProfile.userType = userType
                    }
                }
            }
            
            Spacer()
        }
        .padding(40)
    }
}

struct FeatureDiscoveryView: View {
    @StateObject private var onboardingManager = OnboardingManager.shared
    
    var body: some View {
        VStack(spacing: 30) {
            VStack(spacing: 10) {
                Text("Choose Your Tools")
                    .font(.title)
                    .fontWeight(.semibold)
                
                Text("Select the features you're most interested in")
                    .font(.body)
                    .foregroundColor(.secondary)
            }
            
            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 3), spacing: 15) {
                ForEach(FeatureType.allCases, id: \.self) { feature in
                    FeatureCard(
                        feature: feature,
                        isSelected: onboardingManager.selectedFeatures.contains(feature)
                    ) {
                        if onboardingManager.selectedFeatures.contains(feature) {
                            onboardingManager.selectedFeatures.remove(feature)
                        } else {
                            onboardingManager.selectedFeatures.insert(feature)
                        }
                    }
                }
            }
            
            Spacer()
        }
        .padding(40)
    }
}

struct TutorialSelectionView: View {
    @StateObject private var onboardingManager = OnboardingManager.shared
    
    var body: some View {
        VStack(spacing: 30) {
            VStack(spacing: 10) {
                Text("Interactive Tutorials")
                    .font(.title)
                    .fontWeight(.semibold)
                
                Text("Get hands-on experience with guided tutorials")
                    .font(.body)
                    .foregroundColor(.secondary)
            }
            
            ScrollView {
                LazyVStack(spacing: 15) {
                    ForEach(onboardingManager.getAvailableTutorials()) { tutorial in
                        TutorialCard(tutorial: tutorial) {
                            onboardingManager.startTutorial(tutorial)
                        }
                    }
                }
            }
            
            Spacer()
        }
        .padding(40)
    }
}

struct CompletionView: View {
    @StateObject private var onboardingManager = OnboardingManager.shared
    
    var body: some View {
        VStack(spacing: 30) {
            VStack(spacing: 20) {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 80))
                    .foregroundColor(.green)
                
                Text("You're All Set!")
                    .font(.largeTitle)
                    .fontWeight(.bold)
                
                Text("Universal AI Tools is configured for your needs")
                    .font(.title2)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
            }
            
            // Summary of user selections
            VStack(alignment: .leading, spacing: 10) {
                Text("Your Configuration:")
                    .font(.headline)
                
                HStack {
                    Text("Role:")
                    Spacer()
                    Text(onboardingManager.userProfile.userType.displayName)
                        .fontWeight(.medium)
                }
                
                HStack {
                    Text("Selected Features:")
                    Spacer()
                    Text("\(onboardingManager.selectedFeatures.count) features")
                        .fontWeight(.medium)
                }
                
                if !onboardingManager.tutorialProgress.isEmpty {
                    HStack {
                        Text("Completed Tutorials:")
                        Spacer()
                        Text("\(onboardingManager.tutorialProgress.count)")
                            .fontWeight(.medium)
                    }
                }
            }
            .padding()
            .background(Color(.controlBackgroundColor))
            .cornerRadius(12)
            
            Button("Start Using Universal AI Tools") {
                onboardingManager.completeOnboarding()
            }
            .buttonStyle(.borderedProminent)
            .font(.headline)
            
            Spacer()
        }
        .padding(40)
    }
}

// MARK: - Supporting Views and Components

struct OnboardingProgressView: View {
    let progress: Double
    let currentStep: OnboardingStep
    
    var body: some View {
        VStack(spacing: 10) {
            ProgressView(value: progress)
                .progressViewStyle(.linear)
                .frame(height: 8)
            
            HStack {
                Text(currentStep.displayName)
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                Spacer()
                
                Text("\(Int(progress * 100))% Complete")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding()
    }
}

struct OnboardingNavigationView: View {
    let canGoBack: Bool
    let canGoForward: Bool
    let onBack: () -> Void
    let onNext: () -> Void
    let onSkip: () -> Void
    
    var body: some View {
        HStack {
            Button("Back") {
                onBack()
            }
            .disabled(!canGoBack)
            
            Spacer()
            
            Button("Skip") {
                onSkip()
            }
            .foregroundColor(.secondary)
            
            Button("Continue") {
                onNext()
            }
            .buttonStyle(.borderedProminent)
        }
        .padding()
    }
}

struct FeatureHighlight: View {
    let icon: String
    let title: String
    let description: String
    
    var body: some View {
        HStack(spacing: 15) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundColor(.blue)
                .frame(width: 30)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.headline)
                
                Text(description)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
        }
    }
}

struct UserTypeCard: View {
    let userType: UserType
    let isSelected: Bool
    let onSelect: () -> Void
    
    var body: some View {
        Button(action: onSelect) {
            VStack(spacing: 15) {
                Image(systemName: userType.icon)
                    .font(.system(size: 40))
                    .foregroundColor(isSelected ? .white : .blue)
                
                Text(userType.displayName)
                    .font(.headline)
                    .foregroundColor(isSelected ? .white : .primary)
                
                Text(userType.description)
                    .font(.caption)
                    .multilineTextAlignment(.center)
                    .foregroundColor(isSelected ? .white.opacity(0.8) : .secondary)
            }
            .padding(20)
            .frame(maxWidth: .infinity)
            .background(isSelected ? Color.blue : Color(.controlBackgroundColor))
            .cornerRadius(12)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(isSelected ? Color.blue : Color.clear, lineWidth: 2)
            )
        }
        .buttonStyle(.plain)
    }
}

struct FeatureCard: View {
    let feature: FeatureType
    let isSelected: Bool
    let onToggle: () -> Void
    
    var body: some View {
        Button(action: onToggle) {
            VStack(spacing: 10) {
                Image(systemName: feature.icon)
                    .font(.title2)
                    .foregroundColor(isSelected ? .white : .blue)
                
                Text(feature.displayName)
                    .font(.headline)
                    .foregroundColor(isSelected ? .white : .primary)
                    .multilineTextAlignment(.center)
            }
            .padding(15)
            .frame(maxWidth: .infinity)
            .background(isSelected ? Color.blue : Color(.controlBackgroundColor))
            .cornerRadius(8)
        }
        .buttonStyle(.plain)
    }
}

struct TutorialCard: View {
    let tutorial: Tutorial
    let onStart: () -> Void
    
    var body: some View {
        HStack(spacing: 15) {
            VStack(alignment: .leading, spacing: 5) {
                Text(tutorial.title)
                    .font(.headline)
                
                Text(tutorial.description)
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                HStack {
                    Text("Duration: \(tutorial.estimatedDuration) min")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                    
                    Text("•")
                        .foregroundColor(.secondary)
                    
                    Text(tutorial.difficulty.displayName)
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
            }
            
            Spacer()
            
            Button("Start") {
                onStart()
            }
            .buttonStyle(.borderedProminent)
        }
        .padding()
        .background(Color(.controlBackgroundColor))
        .cornerRadius(8)
    }
}

struct ContextualHintView: View {
    let hint: ContextualHint
    let onDismiss: () -> Void
    
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(hint.content.title)
                    .font(.headline)
                
                Spacer()
                
                Button("×") {
                    onDismiss()
                }
                .foregroundColor(.secondary)
            }
            
            Text(hint.content.description)
                .font(.body)
            
            if !hint.content.steps.isEmpty {
                VStack(alignment: .leading, spacing: 5) {
                    ForEach(Array(hint.content.steps.enumerated()), id: \.offset) { index, step in
                        HStack {
                            Text("\(index + 1).")
                                .fontWeight(.medium)
                            Text(step)
                        }
                        .font(.caption)
                    }
                }
            }
        }
        .padding()
        .background(.regularMaterial)
        .cornerRadius(12)
        .shadow(radius: 10)
        .padding()
    }
}

struct VideoPlayerView: View {
    let url: URL
    @State private var player: AVPlayer?
    
    var body: some View {
        VStack {
            if let player = player {
                VideoPlayer(player: player)
                    .aspectRatio(16/9, contentMode: .fit)
            } else {
                ProgressView("Loading video...")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .onAppear {
            player = AVPlayer(url: url)
        }
        .onDisappear {
            player?.pause()
        }
    }
}

// MARK: - Generic Step Views (Placeholders)

struct GenericStepView: View {
    let step: OnboardingStep
    
    var body: some View {
        VStack(spacing: 30) {
            Text(step.displayName)
                .font(.title)
            
            Text("This step is under development")
                .foregroundColor(.secondary)
            
            Spacer()
        }
        .padding()
    }
}

struct DevelopmentSetupView: View {
    var body: some View {
        GenericStepView(step: .developmentSetup)
    }
}

struct DataAnalysisSetupView: View {
    var body: some View {
        GenericStepView(step: .dataAnalysis)
    }
}

struct DashboardSetupView: View {
    var body: some View {
        GenericStepView(step: .dashboardSetup)
    }
}

struct ResearchToolsSetupView: View {
    var body: some View {
        GenericStepView(step: .researchTools)
    }
}

struct LearningModeSetupView: View {
    var body: some View {
        GenericStepView(step: .learningMode)
    }
}

struct APIConfigurationView: View {
    var body: some View {
        GenericStepView(step: .apiConfiguration)
    }
}

struct FirstProjectView: View {
    var body: some View {
        GenericStepView(step: .firstProject)
    }
}

// MARK: - Supporting Types

enum OnboardingStep: String, Codable, CaseIterable {
    case welcome
    case userTypeSelection
    case featureDiscovery
    case developmentSetup
    case dataAnalysis
    case dashboardSetup
    case researchTools
    case learningMode
    case apiConfiguration
    case debugging
    case visualization
    case modelTraining
    case basicWorkflows
    case reporting
    case dataCollection
    case analysis
    case tutorials
    case basicFeatures
    case firstProject
    case completion
    
    var displayName: String {
        switch self {
        case .welcome: return "Welcome"
        case .userTypeSelection: return "Choose Your Role"
        case .featureDiscovery: return "Select Features"
        case .developmentSetup: return "Development Setup"
        case .dataAnalysis: return "Data Analysis"
        case .dashboardSetup: return "Dashboard Setup"
        case .researchTools: return "Research Tools"
        case .learningMode: return "Learning Mode"
        case .apiConfiguration: return "API Configuration"
        case .debugging: return "Debugging Setup"
        case .visualization: return "Visualization"
        case .modelTraining: return "Model Training"
        case .basicWorkflows: return "Basic Workflows"
        case .reporting: return "Reporting"
        case .dataCollection: return "Data Collection"
        case .analysis: return "Analysis"
        case .tutorials: return "Tutorials"
        case .basicFeatures: return "Basic Features"
        case .firstProject: return "First Project"
        case .completion: return "Complete"
        }
    }
}

enum UserType: String, Codable, CaseIterable {
    case developer
    case dataScientist
    case businessUser
    case researcher
    case student
    
    var displayName: String {
        switch self {
        case .developer: return "Developer"
        case .dataScientist: return "Data Scientist"
        case .businessUser: return "Business User"
        case .researcher: return "Researcher"
        case .student: return "Student"
        }
    }
    
    var description: String {
        switch self {
        case .developer: return "Building applications with AI"
        case .dataScientist: return "Analyzing data and building models"
        case .businessUser: return "Making data-driven decisions"
        case .researcher: return "Conducting research with AI"
        case .student: return "Learning about AI and data science"
        }
    }
    
    var icon: String {
        switch self {
        case .developer: return "hammer"
        case .dataScientist: return "chart.bar"
        case .businessUser: return "briefcase"
        case .researcher: return "magnifyingglass"
        case .student: return "graduationcap"
        }
    }
}

enum FeatureType: String, Codable, CaseIterable {
    case apiAccess = "api"
    case debugging = "debug"
    case codeGeneration = "code"
    case dataAnalysis = "analysis"
    case visualization = "viz"
    case modelTraining = "training"
    case dashboards = "dashboards"
    case reporting = "reports"
    case workflows = "workflows"
    case research = "research"
    case dataCollection = "collection"
    case analysis = "analytics"
    case learning = "learning"
    case tutorials = "tutorials"
    case basicTools = "tools"
    
    var displayName: String {
        switch self {
        case .apiAccess: return "API Access"
        case .debugging: return "Debugging"
        case .codeGeneration: return "Code Generation"
        case .dataAnalysis: return "Data Analysis"
        case .visualization: return "Visualization"
        case .modelTraining: return "Model Training"
        case .dashboards: return "Dashboards"
        case .reporting: return "Reporting"
        case .workflows: return "Workflows"
        case .research: return "Research"
        case .dataCollection: return "Data Collection"
        case .analysis: return "Analytics"
        case .learning: return "Learning"
        case .tutorials: return "Tutorials"
        case .basicTools: return "Basic Tools"
        }
    }
    
    var icon: String {
        switch self {
        case .apiAccess: return "link"
        case .debugging: return "ant"
        case .codeGeneration: return "curlybraces"
        case .dataAnalysis: return "chart.line.uptrend.xyaxis"
        case .visualization: return "chart.bar"
        case .modelTraining: return "brain"
        case .dashboards: return "rectangle.3.group"
        case .reporting: return "doc.text"
        case .workflows: return "arrow.triangle.branch"
        case .research: return "magnifyingglass"
        case .dataCollection: return "tray.and.arrow.down"
        case .analysis: return "chart.xyaxis.line"
        case .learning: return "book"
        case .tutorials: return "play.circle"
        case .basicTools: return "wrench.and.screwdriver"
        }
    }
}

enum ExperienceLevel: Int, Codable {
    case beginner = 1
    case intermediate = 2
    case advanced = 3
    case expert = 4
}

struct UserProfile: Codable {
    var userType: UserType = .businessUser
    var experienceLevel: ExperienceLevel = .beginner
    var interests: [String] = []
    var previousExperience: [String] = []
}

struct Tutorial: Identifiable, Codable {
    let id: String
    let title: String
    let description: String
    let difficulty: ExperienceLevel
    let estimatedDuration: Int // minutes
    let videoURL: URL?
    let steps: [TutorialStep]
    
    static let allTutorials = [
        Tutorial(
            id: "first-chat",
            title: "Your First AI Chat",
            description: "Learn how to interact with AI models",
            difficulty: .beginner,
            estimatedDuration: 5,
            videoURL: Bundle.main.url(forResource: "first-chat", withExtension: "mp4"),
            steps: []
        ),
        Tutorial(
            id: "data-visualization",
            title: "Creating Visualizations",
            description: "Build your first data visualization",
            difficulty: .beginner,
            estimatedDuration: 10,
            videoURL: Bundle.main.url(forResource: "visualization", withExtension: "mp4"),
            steps: []
        ),
        Tutorial(
            id: "workflow-creation",
            title: "Building Workflows",
            description: "Automate tasks with workflows",
            difficulty: .intermediate,
            estimatedDuration: 15,
            videoURL: Bundle.main.url(forResource: "workflows", withExtension: "mp4"),
            steps: []
        )
    ]
}

struct TutorialStep: Codable {
    let id: String
    let title: String
    let instruction: String
    let targetElement: String?
    let validation: String?
}

struct Achievement: Identifiable, Codable {
    let id: String
    let title: String
    let description: String
    let icon: String
    let unlockedAt: Date
    
    static let onboardingComplete = Achievement(
        id: "onboarding-complete",
        title: "Welcome Aboard!",
        description: "Completed the onboarding process",
        icon: "checkmark.circle.fill",
        unlockedAt: Date()
    )
    
    static func tutorialComplete(_ tutorialId: String) -> Achievement {
        Achievement(
            id: "tutorial-\(tutorialId)",
            title: "Tutorial Master",
            description: "Completed the \(tutorialId) tutorial",
            icon: "star.fill",
            unlockedAt: Date()
        )
    }
}

enum HintPosition {
    case top, bottom, left, right, center, automatic
}

enum HintPriority {
    case low, medium, high
}

struct ContextualHint: Identifiable {
    let id: String
    let feature: String
    let content: HelpContent
    let position: HintPosition
    let priority: HintPriority
}

struct HelpContent {
    let title: String
    let description: String
    let steps: [String]
    let videoURL: URL?
}

struct OnboardingState: Codable {
    let currentStep: OnboardingStep
    let progress: Double
    let userProfile: UserProfile
    let selectedFeatures: Set<FeatureType>
}

// MARK: - Supporting Classes

class AnalyticsTracker {
    func trackOnboardingStart() {
        // Track onboarding start
    }
    
    func trackStepCompletion(_ step: OnboardingStep) {
        // Track step completion
    }
    
    func trackStepBack(_ step: OnboardingStep) {
        // Track step back navigation
    }
    
    func trackStepSkip(from: OnboardingStep, to: OnboardingStep) {
        // Track step skipping
    }
    
    func trackOnboardingComplete() {
        // Track onboarding completion
    }
    
    func trackTutorialStart(_ tutorialId: String) {
        // Track tutorial start
    }
    
    func trackTutorialComplete(_ tutorialId: String) {
        // Track tutorial completion
    }
}

class HelpSystem {
    func getHelpContent(for feature: String) -> HelpContent? {
        // Return help content for specific features
        switch feature {
        case "welcome":
            return HelpContent(
                title: "Getting Started",
                description: "Welcome to Universal AI Tools",
                steps: ["Follow the setup", "Choose your preferences"],
                videoURL: nil
            )
        default:
            return nil
        }
    }
}

class SampleDataGenerator {
    static func generateVisualizationData() -> [String: Any] {
        return [
            "data": ["Sample data for tutorials"],
            "charts": ["bar", "line", "scatter"],
            "metrics": ["accuracy", "performance", "speed"]
        ]
    }
}

// MARK: - Notifications

extension Notification.Name {
    static let onboardingCompleted = Notification.Name("OnboardingCompleted")
    static let onboardingStepChanged = Notification.Name("OnboardingStepChanged")
    static let achievementUnlocked = Notification.Name("AchievementUnlocked")
    static let tutorialDataLoaded = Notification.Name("TutorialDataLoaded")
}