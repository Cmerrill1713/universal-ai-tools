import SwiftUI
import UIKit

struct AnimatedAuthenticationStatusView: View {
    @EnvironmentObject var authManager: DeviceAuthenticationManager
    @State private var pulseAnimation = false
    @State private var rotationAnimation = false
    @State private var scaleAnimation = false
    @State private var lastAuthState: AuthenticationState?
    @State private var animationDebounceTimer: Timer?
    
    var body: some View {
        VStack(spacing: 20) {
            // Main Status Circle with Animations
            ZStack {
                // Background Circle
                Circle()
                    .fill(
                        RadialGradient(
                            gradient: Gradient(colors: [
                                statusColor.opacity(0.3),
                                statusColor.opacity(0.1)
                            ]),
                            center: .center,
                            startRadius: 20,
                            endRadius: 80
                        )
                    )
                    .frame(width: 160, height: 160)
                    .scaleEffect(pulseAnimation ? 1.1 : 1.0)
                    .animation(.easeInOut(duration: 2).repeatForever(autoreverses: true), value: pulseAnimation)
                
                // Outer Ring
                Circle()
                    .stroke(
                        AngularGradient(
                            gradient: Gradient(colors: [
                                statusColor,
                                statusColor.opacity(0.5),
                                statusColor
                            ]),
                            center: .center
                        ),
                        lineWidth: 4
                    )
                    .frame(width: 140, height: 140)
                    .rotationEffect(.degrees(rotationAnimation ? 360 : 0))
                    .animation(.linear(duration: 3).repeatForever(autoreverses: false), value: rotationAnimation)
                
                // Inner Circle
                Circle()
                    .fill(statusColor.opacity(0.2))
                    .frame(width: 120, height: 120)
                
                // Status Icon
                statusIcon
                    .font(.system(size: 50, weight: .light))
                    .foregroundColor(statusColor)
                    .scaleEffect(scaleAnimation ? 1.2 : 1.0)
                    .animation(.spring(response: 0.6, dampingFraction: 0.8), value: scaleAnimation)
                
                // Authentication Progress Ring (for authenticating state)
                if authManager.authenticationState == .authenticating {
                    Circle()
                        .trim(from: 0, to: 0.7)
                        .stroke(statusColor, style: StrokeStyle(lineWidth: 6, lineCap: .round))
                        .frame(width: 100, height: 100)
                        .rotationEffect(.degrees(rotationAnimation ? 360 : 0))
                        .animation(.linear(duration: 1).repeatForever(autoreverses: false), value: rotationAnimation)
                }
            }
            .onAppear {
                startAnimations()
            }
            .onChange(of: authManager.authenticationState) { newState in
                // Debounce state changes to prevent excessive animations
                animationDebounceTimer?.invalidate()
                animationDebounceTimer = Timer.scheduledTimer(withTimeInterval: 0.3, repeats: false) { _ in
                    if lastAuthState != newState {
                        lastAuthState = newState
                        triggerStateChangeAnimation()
                    }
                }
            }
            
            // Status Text with Typewriter Effect
            VStack(spacing: 8) {
                TypewriterText(text: statusTitle, speed: 0.05)
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundColor(statusColor)
                
                Text(statusDescription)
                    .font(.body)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)
                    .transition(.opacity.combined(with: .scale))
            }
            
            // Connection Status Indicators
            HStack(spacing: 20) {
                ConnectionIndicator(
                    title: "Backend",
                    isConnected: authManager.registrationState == .registered,
                    icon: "server.rack"
                )
                
                ConnectionIndicator(
                    title: "Bluetooth",
                    isConnected: true, // Based on proximity service
                    icon: "bluetooth"
                )
                
                ConnectionIndicator(
                    title: "Watch",
                    isConnected: false, // TODO: Access watch connectivity status
                    icon: "applewatch"
                )
            }
            .padding(.top, 10)
            
            // Proximity Visualization
            if authManager.registrationState == .registered {
                ProximityVisualization(proximityState: authManager.proximityState)
                    .transition(.slide.combined(with: .opacity))
            }
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 20)
                .fill(.ultraThinMaterial)
                .shadow(color: statusColor.opacity(0.3), radius: 10, x: 0, y: 5)
        )
    }
    
    // MARK: - Computed Properties
    
    private var statusColor: Color {
        switch authManager.authenticationState {
        case .unauthenticated:
            return .red
        case .authenticating:
            return .orange
        case .authenticated:
            return .green
        case .locked:
            return .purple
        }
    }
    
    private var statusIcon: Image {
        switch authManager.authenticationState {
        case .unauthenticated:
            return Image(systemName: "lock.slash")
        case .authenticating:
            return Image(systemName: "faceid")
        case .authenticated:
            return Image(systemName: "checkmark.shield")
        case .locked:
            return Image(systemName: "lock.fill")
        }
    }
    
    private var statusTitle: String {
        switch authManager.authenticationState {
        case .unauthenticated:
            return "Not Authenticated"
        case .authenticating:
            return "Authenticating..."
        case .authenticated:
            return "Authenticated"
        case .locked:
            return "Locked"
        }
    }
    
    private var statusDescription: String {
        switch authManager.authenticationState {
        case .unauthenticated:
            return "Tap the authentication button to secure your connection"
        case .authenticating:
            return "Please complete biometric authentication"
        case .authenticated:
            return "Your device is authenticated and connected securely"
        case .locked:
            return "Device is locked due to proximity or manual action"
        }
    }
    
    // MARK: - Animation Methods
    
    private func startAnimations() {
        pulseAnimation = true
        
        if authManager.authenticationState == .authenticating {
            rotationAnimation = true
        }
    }
    
    private func triggerStateChangeAnimation() {
        // Scale animation on state change
        scaleAnimation = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
            scaleAnimation = false
        }
        
        // Update rotation animation based on state
        rotationAnimation = authManager.authenticationState == .authenticating
    }
}

struct ConnectionIndicator: View {
    let title: String
    let isConnected: Bool
    let icon: String
    
    var body: some View {
        VStack(spacing: 4) {
            ZStack {
                Circle()
                    .fill(isConnected ? Color.green.opacity(0.2) : Color.gray.opacity(0.2))
                    .frame(width: 30, height: 30)
                
                Image(systemName: icon)
                    .font(.system(size: 14))
                    .foregroundColor(isConnected ? .green : .gray)
            }
            
            Text(title)
                .font(.caption2)
                .foregroundColor(.secondary)
        }
    }
}

struct ProximityVisualization: View {
    let proximityState: ProximityState
    @State private var waveAnimation = false
    
    var body: some View {
        VStack(spacing: 12) {
            Text("Proximity Detection")
                .font(.headline)
                .foregroundColor(.secondary)
            
            // Concentric circles representing proximity
            ZStack {
                ForEach(0..<4) { index in
                    Circle()
                        .stroke(
                            proximityColor.opacity(Double(4 - index) * 0.2),
                            lineWidth: 2
                        )
                        .frame(width: CGFloat(40 + index * 20), height: CGFloat(40 + index * 20))
                        .scaleEffect(waveAnimation ? 1.2 : 0.8)
                        .animation(
                            .easeInOut(duration: 2)
                                .repeatForever(autoreverses: true)
                                .delay(Double(index) * 0.2),
                            value: waveAnimation
                        )
                }
                
                // Center dot
                Circle()
                    .fill(proximityColor)
                    .frame(width: 12, height: 12)
            }
            .onAppear {
                waveAnimation = true
            }
            
            // Proximity Text
            HStack {
                Circle()
                    .fill(proximityColor)
                    .frame(width: 8, height: 8)
                
                Text(proximityText)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(proximityColor.opacity(0.1))
            .clipShape(Capsule())
        }
    }
    
    private var proximityColor: Color {
        switch proximityState {
        case .immediate:
            return .green
        case .near:
            return .yellow
        case .far:
            return .orange
        case .unknown:
            return .gray
        }
    }
    
    private var proximityText: String {
        switch proximityState {
        case .immediate:
            return "Very Close"
        case .near:
            return "Nearby"
        case .far:
            return "Far Away"
        case .unknown:
            return "Unknown Distance"
        }
    }
}

struct TypewriterText: View {
    let text: String
    let speed: Double
    @State private var displayedText = ""
    @State private var animationTask: Task<Void, Never>?
    
    var body: some View {
        Text(displayedText)
            .onAppear {
                startAnimation()
            }
            .onChange(of: text) { newText in
                animationTask?.cancel()
                displayedText = ""
                startAnimation()
            }
            .onDisappear {
                animationTask?.cancel()
            }
    }
    
    private func startAnimation() {
        animationTask = Task {
            for (index, character) in text.enumerated() {
                guard !Task.isCancelled else { break }
                
                try? await Task.sleep(nanoseconds: UInt64(speed * 1_000_000_000))
                
                if !Task.isCancelled {
                    await MainActor.run {
                        displayedText += String(character)
                    }
                }
            }
        }
    }
}

#Preview {
    AnimatedAuthenticationStatusView()
        .environmentObject(DeviceAuthenticationManager())
}