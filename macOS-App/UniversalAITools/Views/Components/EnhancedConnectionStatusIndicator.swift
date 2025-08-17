import SwiftUI
import Pow

/// Enhanced connection status indicator with animations and visual feedback
struct EnhancedConnectionStatusIndicator: View {
    let status: ConnectionStatus
    @State private var isAnimating = false
    @State private var pulseScale: CGFloat = 1.0
    
    var body: some View {
        HStack(spacing: 8) {
            // Status icon with animations
            statusIcon
                .font(.system(size: 14, weight: .medium))
                .foregroundColor(status.color)
                .scaleEffect(pulseScale)
                .animation(.easeInOut(duration: 1.0).repeatForever(autoreverses: true), value: isAnimating)
                .conditionalEffect(.glow(color: status.color, radius: 6), value: status == .connected, isEnabled: status == .connected)
                .conditionalEffect(.shake(rate: .fast), value: status == .error, isEnabled: status == .error)
                .conditionalEffect(.spin, value: status == .connecting, isEnabled: status == .connecting)
            
            // Status text
            Text(status.displayName)
                .font(.caption)
                .fontWeight(.medium)
                .foregroundColor(status.color)
                .contentTransition(.opacity)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 4)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(status.color.opacity(0.1))
                .stroke(status.color.opacity(0.3), lineWidth: 1)
        )
        .conditionalEffect(.spray(origin: UnitPoint.center), value: status == .connected, isEnabled: status == .connected)
        .onAppear {
            startAnimation()
        }
        .onChange(of: status) { _, newStatus in
            handleStatusChange(newStatus)
        }
    }
    
    @ViewBuilder
    private var statusIcon: some View {
        switch status {
        case .connected:
            Image(systemName: "checkmark.circle.fill")
        case .connecting:
            Image(systemName: "arrow.clockwise")
        case .disconnected:
            Image(systemName: "circle")
        case .reconnecting:
            Image(systemName: "arrow.triangle.2.circlepath")
        case .disconnecting:
            Image(systemName: "arrow.down.circle")
        case .failed:
            Image(systemName: "xmark.circle.fill")
        case .error:
            Image(systemName: "exclamationmark.triangle.fill")
        }
    }
    
    private func startAnimation() {
        switch status {
        case .connecting, .reconnecting:
            isAnimating = true
            withAnimation(.easeInOut(duration: 0.8).repeatForever(autoreverses: true)) {
                pulseScale = 1.2
            }
        case .connected:
            withAnimation(.spring(response: 0.6, dampingFraction: 0.8)) {
                pulseScale = 1.1
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) {
                withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
                    pulseScale = 1.0
                }
            }
        default:
            isAnimating = false
            pulseScale = 1.0
        }
    }
    
    private func handleStatusChange(_ newStatus: ConnectionStatus) {
        withAnimation(.smooth(duration: 0.3)) {
            startAnimation()
        }
        
        // Add haptic feedback for status changes
        switch newStatus {
        case .connected:
            // Success haptic
            #if os(iOS)
            let impactFeedback = UIImpactFeedbackGenerator(style: .light)
            impactFeedback.impactOccurred()
            #endif
        case .failed, .error:
            // Error haptic
            #if os(iOS)
            let notificationFeedback = UINotificationFeedbackGenerator()
            notificationFeedback.notificationOccurred(.error)
            #endif
        default:
            break
        }
    }
}

#Preview {
    VStack(spacing: 20) {
        EnhancedConnectionStatusIndicator(status: .connected)
        EnhancedConnectionStatusIndicator(status: .connecting)
        EnhancedConnectionStatusIndicator(status: .disconnected)
        EnhancedConnectionStatusIndicator(status: .failed)
        EnhancedConnectionStatusIndicator(status: .error)
    }
    .padding()
}