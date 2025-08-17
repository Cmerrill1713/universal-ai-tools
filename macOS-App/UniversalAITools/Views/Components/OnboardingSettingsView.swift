import SwiftUI

/// Onboarding Settings and Tour Management
/// Allows users to control their onboarding experience, replay tours, and manage feature discovery
struct OnboardingSettingsView: View {
    @StateObject private var onboardingManager = OnboardingManager.shared
    @State private var showTourSelection = false
    @State private var selectedTour: TourType = .complete
    @State private var hintsEnabled = true
    @State private var autoplayEnabled = true
    @State private var tourSpeed: TourSpeed = .normal
    
    enum TourType: String, CaseIterable {
        case complete = "Complete Tour"
        case quickStart = "Quick Start"
        case features = "Feature Overview"
        case advanced = "Advanced Features"
        
        var description: String {
            switch self {
            case .complete:
                return "Full walkthrough of all features and capabilities"
            case .quickStart:
                return "Essential features to get started quickly"
            case .features:
                return "Overview of key features and their benefits"
            case .advanced:
                return "Deep dive into advanced functionality"
            }
        }
        
        var icon: String {
            switch self {
            case .complete: return "list.bullet"
            case .quickStart: return "bolt.fill"
            case .features: return "star.fill"
            case .advanced: return "brain.head.profile"
            }
        }
        
        var estimatedDuration: String {
            switch self {
            case .complete: return "5-7 minutes"
            case .quickStart: return "2-3 minutes"
            case .features: return "3-4 minutes"
            case .advanced: return "4-5 minutes"
            }
        }
    }
    
    enum TourSpeed: String, CaseIterable {
        case slow = "Slow"
        case normal = "Normal"
        case fast = "Fast"
        
        var multiplier: Double {
            switch self {
            case .slow: return 1.5
            case .normal: return 1.0
            case .fast: return 0.7
            }
        }
    }
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 24) {
                    // Header
                    headerSection
                    
                    // Tour Management
                    tourManagementSection
                    
                    // Settings
                    settingsSection
                    
                    // Progress & Stats
                    progressSection
                    
                    // Advanced Options
                    advancedSection
                }
                .padding()
            }
            .navigationTitle("Onboarding & Tours")
            .toolbar {
                toolbarContent
            }
        }
        .sheet(isPresented: $showTourSelection) {
            TourSelectionSheet(
                selectedTour: $selectedTour,
                onStartTour: { startSelectedTour() }
            )
        }
    }
    
    // MARK: - Sections
    
    private var headerSection: some View {
        VStack(spacing: 16) {
            Image(systemName: "graduationcap.fill")
                .font(.system(size: 48, weight: .light))
                .foregroundStyle(.blue.gradient)
                .powTransition(.glow, isActive: true)
            
            VStack(spacing: 8) {
                Text("Learning & Discovery")
                    .font(.title2)
                    .fontWeight(.bold)
                
                Text("Customize your onboarding experience and discover new features")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
            }
        }
        .padding()
        .background(.ultraThinMaterial)
        .cornerRadius(16)
    }
    
    private var tourManagementSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            SectionHeader(title: "Tours & Guides", icon: "map")
            
            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 2), spacing: 16) {
                ForEach(TourType.allCases, id: \.self) { tour in
                    TourCard(
                        tour: tour,
                        isSelected: selectedTour == tour,
                        onSelect: { selectedTour = tour }
                    )
                }
            }
            
            // Start Tour Button
            ModernUIComponentsLibrary.EnhancedActionButton(
                title: "Start \(selectedTour.rawValue)",
                icon: "play.fill",
                action: { showTourSelection = true },
                style: .primary
            )
        }
        .padding()
        .background(.ultraThinMaterial)
        .cornerRadius(16)
    }
    
    private var settingsSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            SectionHeader(title: "Tour Settings", icon: "gearshape")
            
            VStack(spacing: 12) {
                // Feature Hints Toggle
                SettingRow(
                    title: "Feature Hints",
                    description: "Show contextual hints for discovering new features",
                    icon: "lightbulb.fill"
                ) {
                    Toggle("", isOn: $hintsEnabled)
                        .toggleStyle(SwitchToggleStyle())
                }
                
                Divider()
                
                // Autoplay Toggle
                SettingRow(
                    title: "Autoplay Tours",
                    description: "Automatically advance through tour steps",
                    icon: "play.circle.fill"
                ) {
                    Toggle("", isOn: $autoplayEnabled)
                        .toggleStyle(SwitchToggleStyle())
                }
                
                Divider()
                
                // Tour Speed Picker
                SettingRow(
                    title: "Tour Speed",
                    description: "Adjust the pace of guided tours",
                    icon: "speedometer"
                ) {
                    Picker("Tour Speed", selection: $tourSpeed) {
                        ForEach(TourSpeed.allCases, id: \.self) { speed in
                            Text(speed.rawValue).tag(speed)
                        }
                    }
                    .pickerStyle(SegmentedPickerStyle())
                    .frame(width: 150)
                }
            }
        }
        .padding()
        .background(.ultraThinMaterial)
        .cornerRadius(16)
    }
    
    private var progressSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            SectionHeader(title: "Progress & Statistics", icon: "chart.bar")
            
            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 2), spacing: 16) {
                StatCard(
                    title: "Tours Completed",
                    value: "\(onboardingManager.completedSteps.count)",
                    icon: "checkmark.circle.fill",
                    color: .green
                )
                
                StatCard(
                    title: "Features Discovered",
                    value: "12/16",
                    icon: "star.fill",
                    color: .blue
                )
                
                StatCard(
                    title: "Tips Viewed",
                    value: "28",
                    icon: "lightbulb.fill",
                    color: .yellow
                )
                
                StatCard(
                    title: "Time Spent Learning",
                    value: "14m",
                    icon: "clock.fill",
                    color: .purple
                )
            }
            
            // Progress visualization
            VStack(spacing: 8) {
                HStack {
                    Text("Overall Progress")
                        .font(.subheadline)
                        .fontWeight(.medium)
                    
                    Spacer()
                    
                    Text("75%")
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .foregroundColor(.blue)
                }
                
                ModernUIComponentsLibrary.ProgressRing(progress: 0.75)
                    .frame(width: 60, height: 60)
            }
            .padding()
            .background(.regularMaterial)
            .cornerRadius(12)
        }
        .padding()
        .background(.ultraThinMaterial)
        .cornerRadius(16)
    }
    
    private var advancedSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            SectionHeader(title: "Advanced Options", icon: "slider.horizontal.3")
            
            VStack(spacing: 12) {
                // Reset Progress
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Reset All Progress")
                            .font(.subheadline)
                            .fontWeight(.medium)
                        
                        Text("Clear all tour progress and start fresh")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    
                    Spacer()
                    
                    Button("Reset") {
                        resetProgress()
                    }
                    .buttonStyle(.bordered)
                    .foregroundColor(.red)
                }
                
                Divider()
                
                // Export Progress
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Export Learning Data")
                            .font(.subheadline)
                            .fontWeight(.medium)
                        
                        Text("Save your progress and preferences")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    
                    Spacer()
                    
                    Button("Export") {
                        exportProgress()
                    }
                    .buttonStyle(.bordered)
                }
                
                Divider()
                
                // Developer Mode
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Developer Mode")
                            .font(.subheadline)
                            .fontWeight(.medium)
                        
                        Text("Show technical details in tours")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    
                    Spacer()
                    
                    Toggle("", isOn: .constant(false))
                        .toggleStyle(SwitchToggleStyle())
                }
            }
        }
        .padding()
        .background(.ultraThinMaterial)
        .cornerRadius(16)
    }
    
    @ToolbarContentBuilder
    private var toolbarContent: some ToolbarContent {
        ToolbarItemGroup(placement: .primaryAction) {
            Button("Help") {
                // Show help documentation
            }
            .buttonStyle(.bordered)
            
            Menu("Quick Actions") {
                Button("Restart Onboarding") {
                    restartOnboarding()
                }
                
                Button("Show Welcome Screen") {
                    showWelcomeScreen()
                }
                
                Divider()
                
                Button("Feature Suggestions") {
                    // Show feature suggestions
                }
            }
        }
    }
    
    // MARK: - Actions
    
    private func startSelectedTour() {
        // Start the selected tour type
        switch selectedTour {
        case .complete:
            onboardingManager.startOnboarding()
        case .quickStart:
            startQuickStartTour()
        case .features:
            startFeaturesTour()
        case .advanced:
            startAdvancedTour()
        }
    }
    
    private func startQuickStartTour() {
        // Implementation for quick start tour
        print("Starting Quick Start tour")
    }
    
    private func startFeaturesTour() {
        // Implementation for features tour
        print("Starting Features tour")
    }
    
    private func startAdvancedTour() {
        // Implementation for advanced tour
        print("Starting Advanced tour")
    }
    
    private func resetProgress() {
        onboardingManager.restartOnboarding()
    }
    
    private func exportProgress() {
        // Export progress data
        print("Exporting progress data")
    }
    
    private func restartOnboarding() {
        onboardingManager.restartOnboarding()
        onboardingManager.startOnboarding()
    }
    
    private func showWelcomeScreen() {
        onboardingManager.restartOnboarding()
    }
}

// MARK: - Supporting Views

struct SectionHeader: View {
    let title: String
    let icon: String
    
    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: icon)
                .foregroundColor(.blue)
            
            Text(title)
                .font(.headline)
                .fontWeight(.semibold)
        }
    }
}

struct TourCard: View {
    let tour: OnboardingSettingsView.TourType
    let isSelected: Bool
    let onSelect: () -> Void
    
    var body: some View {
        Button(action: onSelect) {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Image(systemName: tour.icon)
                        .font(.title2)
                        .foregroundColor(isSelected ? .white : .blue)
                    
                    Spacer()
                    
                    if isSelected {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundColor(.white)
                    }
                }
                
                VStack(alignment: .leading, spacing: 4) {
                    Text(tour.rawValue)
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .foregroundColor(isSelected ? .white : .primary)
                    
                    Text(tour.description)
                        .font(.caption)
                        .foregroundColor(isSelected ? .white.opacity(0.9) : .secondary)
                        .lineLimit(3)
                    
                    Text(tour.estimatedDuration)
                        .font(.caption2)
                        .fontWeight(.medium)
                        .foregroundColor(isSelected ? .white.opacity(0.8) : .blue)
                }
                
                Spacer()
            }
            .padding()
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(isSelected ? .blue.gradient : .regularMaterial)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(isSelected ? .clear : .blue.opacity(0.3), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .animation(.easeInOut(duration: 0.2), value: isSelected)
    }
}

struct SettingRow<Content: View>: View {
    let title: String
    let description: String
    let icon: String
    let content: () -> Content
    
    init(
        title: String,
        description: String,
        icon: String,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.title = title
        self.description = description
        self.icon = icon
        self.content = content
    }
    
    var body: some View {
        HStack {
            Image(systemName: icon)
                .foregroundColor(.blue)
                .frame(width: 20)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline)
                    .fontWeight(.medium)
                
                Text(description)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            content()
        }
    }
}

struct StatCard: View {
    let title: String
    let value: String
    let icon: String
    let color: Color
    
    var body: some View {
        VStack(spacing: 8) {
            HStack {
                Image(systemName: icon)
                    .foregroundColor(color)
                
                Spacer()
                
                Text(value)
                    .font(.title2)
                    .fontWeight(.bold)
                    .foregroundColor(color)
            }
            
            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding()
        .background(.regularMaterial)
        .cornerRadius(12)
    }
}

// MARK: - Tour Selection Sheet

struct TourSelectionSheet: View {
    @Binding var selectedTour: OnboardingSettingsView.TourType
    let onStartTour: () -> Void
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationView {
            VStack(spacing: 24) {
                // Header
                VStack(spacing: 12) {
                    Image(systemName: "play.circle.fill")
                        .font(.system(size: 48))
                        .foregroundStyle(.blue.gradient)
                    
                    Text("Start Tour")
                        .font(.title)
                        .fontWeight(.bold)
                    
                    Text("Choose your learning experience")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
                
                // Selected tour details
                VStack(spacing: 16) {
                    HStack {
                        Image(systemName: selectedTour.icon)
                            .font(.title2)
                            .foregroundColor(.blue)
                        
                        VStack(alignment: .leading, spacing: 4) {
                            Text(selectedTour.rawValue)
                                .font(.headline)
                                .fontWeight(.semibold)
                            
                            Text("Duration: \(selectedTour.estimatedDuration)")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        
                        Spacer()
                    }
                    
                    Text(selectedTour.description)
                        .font(.body)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.leading)
                }
                .padding()
                .background(.ultraThinMaterial)
                .cornerRadius(12)
                
                Spacer()
                
                // Action buttons
                HStack(spacing: 16) {
                    Button("Cancel") {
                        dismiss()
                    }
                    .buttonStyle(.bordered)
                    
                    ModernUIComponentsLibrary.EnhancedActionButton(
                        title: "Start Tour",
                        icon: "play.fill",
                        action: {
                            onStartTour()
                            dismiss()
                        },
                        style: .primary
                    )
                }
            }
            .padding()
            .navigationTitle("Tour Selection")
            .navigationBarTitleDisplayMode(.inline)
        }
        .frame(width: 500, height: 400)
    }
}

#Preview {
    OnboardingSettingsView()
        .frame(width: 800, height: 600)
}