import SwiftUI
import Pow

/// Enhanced error recovery view with guided user assistance and modern animations
struct EnhancedErrorRecoveryView: View {
    let error: String
    let recoveryOptions: [ErrorRecoveryOption]
    let guidedRecoveryState: GuidedRecoveryState
    let onOptionSelected: (ErrorRecoveryOption) -> Void
    let onDismiss: () -> Void
    
    @State private var selectedOptionIndex: Int = 0
    @State private var showGuidedSteps = false
    @State private var completedSteps: Set<Int> = []
    
    var body: some View {
        VStack(spacing: 24) {
            // Error header with icon
            errorHeader
            
            // Error message
            errorMessage
            
            // Recovery options or guided steps
            recoveryContent
            
            // Action buttons
            actionButtons
        }
        .padding(32)
        .background(
            RoundedRectangle(cornerRadius: 20)
                .fill(.ultraThinMaterial)
                .stroke(Color.red.opacity(0.3), lineWidth: 1)
        )
        .frame(maxWidth: 500)
        .conditionalEffect(.glow(color: .red, radius: 10), value: true, isEnabled: true)
        .onAppear {
            // Start with a subtle shake to draw attention
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                // Animation is handled by the conditionalEffect
            }
        }
    }
    
    // MARK: - Header
    
    private var errorHeader: some View {
        HStack(spacing: 12) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.title)
                .foregroundColor(.red)
                .conditionalEffect(.shake(rate: .fast), value: true, isEnabled: true)
            
            Text("Connection Issue")
                .font(.title2)
                .fontWeight(.bold)
                .foregroundColor(.primary)
        }
    }
    
    // MARK: - Error Message
    
    private var errorMessage: some View {
        VStack(spacing: 12) {
            Text(error)
                .font(.body)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .lineLimit(3)
            
            if guidedRecoveryState == .guidedRecovery {
                Text("Let us help you resolve this step by step.")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .italic()
            }
        }
    }
    
    // MARK: - Recovery Content
    
    @ViewBuilder
    private var recoveryContent: some View {
        switch guidedRecoveryState {
        case .none, .showingOptions:
            recoveryOptionsView
        case .guidedRecovery:
            guidedRecoveryView
        }
    }
    
    private var recoveryOptionsView: some View {
        VStack(spacing: 12) {
            Text("Choose a recovery option:")
                .font(.headline)
                .foregroundColor(.primary)
            
            ForEach(Array(recoveryOptions.enumerated()), id: \.offset) { index, option in
                RecoveryOptionButton(
                    option: option,
                    isSelected: selectedOptionIndex == index,
                    onTap: {
                        selectedOptionIndex = index
                        onOptionSelected(option)
                    }
                )
                .conditionalEffect(.bounce, value: selectedOptionIndex == index, isEnabled: selectedOptionIndex == index)
            }
        }
    }
    
    private var guidedRecoveryView: some View {
        VStack(spacing: 16) {
            Text("Guided Recovery Steps")
                .font(.headline)
                .foregroundColor(.primary)
            
            let recoverySteps = [
                "Check your internet connection",
                "Verify the backend server is running",
                "Check if authentication is required",
                "Try refreshing the page or restarting the app"
            ]
            
            ForEach(Array(recoverySteps.enumerated()), id: \.offset) { index, step in
                GuidedStepView(
                    stepNumber: index + 1,
                    description: step,
                    isCompleted: completedSteps.contains(index),
                    onComplete: {
                        completedSteps.insert(index)
                    }
                )
            }
        }
    }
    
    // MARK: - Action Buttons
    
    private var actionButtons: some View {
        HStack(spacing: 16) {
            Button("Cancel") {
                onDismiss()
            }
            .buttonStyle(.bordered)
            .conditionalEffect(.shine(angle: .degrees(45)), value: false, isEnabled: false)
            
            if guidedRecoveryState == .guidedRecovery {
                Button("Start Over") {
                    showGuidedSteps = false
                    completedSteps.removeAll()
                }
                .buttonStyle(.borderedProminent)
            }
            
            Button(guidedRecoveryState == .guidedRecovery ? "Continue" : "Dismiss") {
                if guidedRecoveryState == .guidedRecovery && completedSteps.count < 4 {
                    // Continue with guided recovery
                    return
                } else {
                    onDismiss()
                }
            }
            .buttonStyle(.borderedProminent)
            .conditionalEffect(.glow(color: .blue, radius: 8), value: true, isEnabled: true)
        }
    }
}

// MARK: - Recovery Option Button

struct RecoveryOptionButton: View {
    let option: ErrorRecoveryOption
    let isSelected: Bool
    let onTap: () -> Void
    
    var body: some View {
        Button(action: onTap) {
            VStack(alignment: .leading, spacing: 8) {
                Text(option.title)
                    .font(.headline)
                    .foregroundColor(.primary)
                
                Text(option.description)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.leading)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(16)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(isSelected ? Color.blue.opacity(0.1) : Color.gray.opacity(0.05))
                    .stroke(isSelected ? Color.blue : Color.gray.opacity(0.3), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Guided Step View

struct GuidedStepView: View {
    let stepNumber: Int
    let description: String
    let isCompleted: Bool
    let onComplete: () -> Void
    
    var body: some View {
        HStack(spacing: 12) {
            // Step number/checkmark
            ZStack {
                Circle()
                    .fill(isCompleted ? Color.green : Color.blue)
                    .frame(width: 24, height: 24)
                
                if isCompleted {
                    Image(systemName: "checkmark")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundColor(.white)
                        .conditionalEffect(.spray(origin: UnitPoint.center), value: isCompleted, isEnabled: isCompleted)
                } else {
                    Text("\\(stepNumber)")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundColor(.white)
                }
            }
            
            // Description
            Text(description)
                .font(.body)
                .foregroundColor(isCompleted ? .secondary : .primary)
                .strikethrough(isCompleted)
            
            Spacer()
            
            // Complete button
            if !isCompleted {
                Button("Complete") {
                    withAnimation(.spring(response: 0.5, dampingFraction: 0.8)) {
                        onComplete()
                    }
                }
                .buttonStyle(.bordered)
                .controlSize(.small)
            }
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Preview

#Preview {
    EnhancedErrorRecoveryView(
        error: "Unable to connect to the agent orchestration service. This might be due to network issues or the backend server being unavailable.",
        recoveryOptions: [
            ErrorRecoveryOption(
                title: "Check Network Connection",
                description: "Verify your internet connection and try again",
                action: {}
            ),
            ErrorRecoveryOption(
                title: "Re-authenticate",
                description: "Your session may have expired. Sign in again",
                action: {}
            ),
            ErrorRecoveryOption(
                title: "Use Sample Data",
                description: "Continue with sample data while we resolve the issue",
                action: {}
            )
        ],
        guidedRecoveryState: .showingOptions,
        onOptionSelected: { _ in },
        onDismiss: {}
    )
    .padding()
    .background(Color.black.opacity(0.3))
}