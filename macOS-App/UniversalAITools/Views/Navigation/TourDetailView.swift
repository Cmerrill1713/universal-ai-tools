import SwiftUI

/// Detailed view for guided tours with step-by-step instructions
struct TourDetailView: View {
    let tour: GuidedTour
    @ObservedObject var navigationService: EnhancedNavigationService
    @Environment(\.dismiss) private var dismiss
    
    @State private var currentStepIndex = 0
    @State private var isPlaying = false
    @State private var stepProgress: Double = 0.0
    @State private var showConfirmation = false
    
    private var currentStep: TourStep? {
        guard currentStepIndex < tour.steps.count else { return nil }
        return tour.steps[currentStepIndex]
    }
    
    private var isLastStep: Bool {
        currentStepIndex >= tour.steps.count - 1
    }
    
    private var progressPercentage: Double {
        guard !tour.steps.isEmpty else { return 0 }
        return Double(currentStepIndex + 1) / Double(tour.steps.count)
    }
    
    var body: some View {
        VStack(spacing: 0) {
            // Header
            tourHeader
            
            // Progress bar
            progressBar
            
            Divider()
                .background(AppTheme.separator)
            
            // Content area
            if let step = currentStep {
                stepContent(step)
            } else {
                completionView
            }
            
            Divider()
                .background(AppTheme.separator)
            
            // Navigation controls
            navigationControls
        }
        .background(AppTheme.popupBackground)
        .cornerRadius(16)
        .shadow(color: AppTheme.heavyShadow, radius: 20, x: 0, y: 10)
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(AppTheme.popupBorder, lineWidth: 1)
        )
        .alert("Complete Tour?", isPresented: $showConfirmation) {
            Button("Cancel", role: .cancel) { }
            Button("Complete") {
                completeTour()
            }
        } message: {
            Text("Mark this tour as completed? You can always review it later.")
        }
    }
    
    // MARK: - Header
    private var tourHeader: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(tour.title)
                    .font(.system(size: 18, weight: .bold))
                    .foregroundColor(AppTheme.primaryText)
                
                HStack(spacing: 12) {
                    Label("\(Int(tour.estimatedDuration / 60)) min", systemImage: "clock")
                        .font(.system(size: 12))
                        .foregroundColor(AppTheme.secondaryText)
                    
                    Label("\(tour.steps.count) steps", systemImage: "list.number")
                        .font(.system(size: 12))
                        .foregroundColor(AppTheme.secondaryText)
                    
                    if tour.isCompleted {
                        Label("Completed", systemImage: "checkmark.circle.fill")
                            .font(.system(size: 12))
                            .foregroundColor(AppTheme.accentGreen)
                    }
                }
            }
            
            Spacer()
            
            Button(action: { dismiss() }) {
                Image(systemName: "xmark")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(AppTheme.tertiaryText)
                    .frame(width: 24, height: 24)
                    .background(
                        Circle()
                            .fill(AppTheme.sidebarItemHover)
                    )
            }
            .buttonStyle(PlainButtonStyle())
        }
        .padding(.horizontal, 24)
        .padding(.vertical, 20)
    }
    
    // MARK: - Progress Bar
    private var progressBar: some View {
        VStack(spacing: 8) {
            // Progress track
            GeometryReader { geometry in
                ZStack(alignment: .leading) {
                    // Background track
                    RoundedRectangle(cornerRadius: 2)
                        .fill(AppTheme.sidebarItemHover)
                        .frame(height: 4)
                    
                    // Progress fill
                    RoundedRectangle(cornerRadius: 2)
                        .fill(
                            LinearGradient(
                                colors: [AppTheme.accentBlue, AppTheme.accentBlue.opacity(0.8)],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .frame(width: geometry.size.width * progressPercentage, height: 4)
                        .animation(.easeInOut(duration: 0.3), value: progressPercentage)
                }
            }
            .frame(height: 4)
            
            // Step indicators
            HStack {
                ForEach(0..<tour.steps.count, id: \.self) { index in
                    Circle()
                        .fill(index <= currentStepIndex ? AppTheme.accentBlue : AppTheme.tertiaryText.opacity(0.3))
                        .frame(width: 8, height: 8)
                        .scaleEffect(index == currentStepIndex ? 1.2 : 1.0)
                        .animation(.spring(response: 0.3, dampingFraction: 0.7), value: currentStepIndex)
                    
                    if index < tour.steps.count - 1 {
                        Rectangle()
                            .fill(index < currentStepIndex ? AppTheme.accentBlue : AppTheme.tertiaryText.opacity(0.3))
                            .frame(height: 1)
                            .animation(.easeInOut(duration: 0.3), value: currentStepIndex)
                    }
                }
            }
            .padding(.horizontal, 12)
        }
        .padding(.horizontal, 24)
        .padding(.bottom, 16)
    }
    
    // MARK: - Step Content
    private func stepContent(_ step: TourStep) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                // Step header
                HStack {
                    Text("Step \(currentStepIndex + 1) of \(tour.steps.count)")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(AppTheme.tertiaryText)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(
                            Capsule()
                                .fill(AppTheme.sidebarItemHover)
                        )
                    
                    Spacer()
                }
                
                // Step title and description
                VStack(alignment: .leading, spacing: 12) {
                    Text(step.title)
                        .font(.system(size: 20, weight: .bold))
                        .foregroundColor(AppTheme.primaryText)
                    
                    Text(step.description)
                        .font(.system(size: 14))
                        .foregroundColor(AppTheme.secondaryText)
                        .lineSpacing(4)
                }
                
                // Step actions
                if !step.actions.isEmpty {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Actions to take:")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundColor(AppTheme.primaryText)
                        
                        ForEach(Array(step.actions.enumerated()), id: \.offset) { index, action in
                            StepActionView(
                                action: action,
                                index: index + 1,
                                isCompleted: false // TODO: Track action completion
                            )
                        }
                    }
                    .padding(16)
                    .background(
                        RoundedRectangle(cornerRadius: 12)
                            .fill(AppTheme.surfaceBackground.opacity(0.5))
                            .overlay(
                                RoundedRectangle(cornerRadius: 12)
                                    .stroke(AppTheme.borderColor, lineWidth: 1)
                            )
                    )
                }
                
                // Target element info
                if let targetElement = step.targetElement {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Focus on:")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundColor(AppTheme.primaryText)
                        
                        HStack {
                            Image(systemName: "target")
                                .font(.system(size: 12))
                                .foregroundColor(AppTheme.accentOrange)
                            
                            Text(targetElement)
                                .font(.system(size: 13))
                                .foregroundColor(AppTheme.secondaryText)
                                .italic()
                        }
                    }
                    .padding(12)
                    .background(
                        RoundedRectangle(cornerRadius: 8)
                            .fill(AppTheme.accentOrange.opacity(0.1))
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(AppTheme.accentOrange.opacity(0.3), lineWidth: 1)
                            )
                    )
                }
                
                Spacer()
            }
            .padding(.horizontal, 24)
            .padding(.vertical, 20)
        }
    }
    
    // MARK: - Completion View
    private var completionView: some View {
        VStack(spacing: 24) {
            // Completion icon
            ZStack {
                Circle()
                    .fill(
                        RadialGradient(
                            colors: [
                                AppTheme.accentGreen.opacity(0.3),
                                AppTheme.accentGreen.opacity(0.1),
                                Color.clear
                            ],
                            center: .center,
                            startRadius: 10,
                            endRadius: 50
                        )
                    )
                    .frame(width: 100, height: 100)
                
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 48, weight: .medium))
                    .foregroundColor(AppTheme.accentGreen)
            }
            
            // Completion message
            VStack(spacing: 8) {
                Text("Tour Completed!")
                    .font(.system(size: 20, weight: .bold))
                    .foregroundColor(AppTheme.primaryText)
                
                Text("You've successfully completed the \(tour.title) tour. You can now explore these features on your own.")
                    .font(.system(size: 14))
                    .foregroundColor(AppTheme.secondaryText)
                    .multilineTextAlignment(.center)
                    .lineSpacing(4)
            }
            
            // Next steps
            VStack(alignment: .leading, spacing: 12) {
                Text("What's next?")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(AppTheme.primaryText)
                
                VStack(alignment: .leading, spacing: 8) {
                    NextStepItem(
                        icon: "lightbulb.fill",
                        text: "Explore related features in the discovery panel"
                    )
                    NextStepItem(
                        icon: "map.fill",
                        text: "Try other guided tours to learn more"
                    )
                    NextStepItem(
                        icon: "questionmark.circle.fill",
                        text: "Use the command palette (⌘K) for quick access"
                    )
                }
            }
            .padding(16)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(AppTheme.surfaceBackground.opacity(0.5))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(AppTheme.borderColor, lineWidth: 1)
                    )
            )
        }
        .padding(.horizontal, 24)
        .padding(.vertical, 40)
    }
    
    // MARK: - Navigation Controls
    private var navigationControls: some View {
        HStack {
            // Previous button
            Button(action: previousStep) {
                HStack(spacing: 6) {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 12, weight: .medium))
                    Text("Previous")
                        .font(.system(size: 13, weight: .medium))
                }
                .foregroundColor(currentStepIndex > 0 ? AppTheme.primaryText : AppTheme.tertiaryText)
            }
            .buttonStyle(.bordered)
            .disabled(currentStepIndex <= 0)
            
            Spacer()
            
            // Step counter
            if currentStep != nil {
                Text("\(currentStepIndex + 1) / \(tour.steps.count)")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(AppTheme.tertiaryText)
            }
            
            Spacer()
            
            // Next/Complete button
            Button(action: nextStepOrComplete) {
                HStack(spacing: 6) {
                    Text(isLastStep ? "Complete Tour" : "Next")
                        .font(.system(size: 13, weight: .medium))
                    
                    if !isLastStep {
                        Image(systemName: "chevron.right")
                            .font(.system(size: 12, weight: .medium))
                    }
                }
                .foregroundColor(.white)
            }
            .buttonStyle(.borderedProminent)
        }
        .padding(.horizontal, 24)
        .padding(.vertical, 16)
    }
    
    // MARK: - Helper Methods
    private func nextStepOrComplete() {
        if isLastStep {
            if tour.isCompleted {
                dismiss()
            } else {
                showConfirmation = true
            }
        } else {
            withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
                currentStepIndex += 1
            }
        }
    }
    
    private func previousStep() {
        if currentStepIndex > 0 {
            withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
                currentStepIndex -= 1
            }
        }
    }
    
    private func completeTour() {
        navigationService.completeTour(tour.id)
        dismiss()
    }
}

// MARK: - Step Action View
struct StepActionView: View {
    let action: TourStep.TourAction
    let index: Int
    let isCompleted: Bool
    
    var body: some View {
        HStack(spacing: 12) {
            // Action index
            ZStack {
                Circle()
                    .fill(isCompleted ? AppTheme.accentGreen : AppTheme.accentBlue)
                    .frame(width: 24, height: 24)
                
                if isCompleted {
                    Image(systemName: "checkmark")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(.white)
                } else {
                    Text("\(index)")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(.white)
                }
            }
            
            // Action description
            VStack(alignment: .leading, spacing: 2) {
                Text(actionTitle)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundColor(AppTheme.primaryText)
                
                if let description = actionDescription {
                    Text(description)
                        .font(.system(size: 11))
                        .foregroundColor(AppTheme.secondaryText)
                }
            }
            
            Spacer()
            
            // Action icon
            Image(systemName: actionIcon)
                .font(.system(size: 12, weight: .medium))
                .foregroundColor(AppTheme.tertiaryText)
        }
    }
    
    private var actionTitle: String {
        switch action {
        case .highlight:
            return "Look for highlighted element"
        case .click:
            return "Click on the element"
        case .navigate:
            return "Navigate to new view"
        case .wait:
            return "Wait for action to complete"
        case .custom:
            return "Follow the instruction"
        }
    }
    
    private var actionDescription: String? {
        switch action {
        case .highlight:
            return "The element will be highlighted with a blue outline"
        case .click:
            return "Click once to proceed"
        case .navigate:
            return "A new view will open automatically"
        case .wait:
            return "Wait a moment for the system to respond"
        case .custom:
            return nil
        }
    }
    
    private var actionIcon: String {
        switch action {
        case .highlight:
            return "eye.fill"
        case .click:
            return "hand.tap.fill"
        case .navigate:
            return "arrow.right.circle.fill"
        case .wait:
            return "clock.fill"
        case .custom:
            return "gear.circle.fill"
        }
    }
}

// MARK: - Next Step Item
struct NextStepItem: View {
    let icon: String
    let text: String
    
    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: icon)
                .font(.system(size: 12, weight: .medium))
                .foregroundColor(AppTheme.accentBlue)
                .frame(width: 16)
            
            Text(text)
                .font(.system(size: 12))
                .foregroundColor(AppTheme.secondaryText)
        }
    }
}