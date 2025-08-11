import SwiftUI
import LocalAuthentication

struct AuthenticationView: View {
    @EnvironmentObject var authManager: DeviceAuthenticationManager
    @State private var showingRegistration = false
    @State private var showingError = false

    var body: some View {
        NavigationView {
            ZStack {
                AppTheme.backgroundGradient.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 24) {
                        // Logo and Title
                        VStack(spacing: 10) {
                            Image(systemName: "lock.shield")
                                .font(.system(size: 64))
                                .foregroundStyle(AppTheme.chatUserGradient)

                            Text("Universal AI Tools")
                                .font(.largeTitle).bold()

                            Text("Secure Authentication")
                                .font(.title3)
                                .foregroundColor(.secondary)
                        }
                        .padding(.top, 28)

                        // Animated Authentication Status
                        AnimatedAuthenticationStatusView()
                            .environmentObject(authManager)

                        // Registration/Authentication Controls
                        VStack(spacing: 16) {
                            switch authManager.registrationState {
                            case .unregistered:
                                RegisterDeviceButton(authManager: authManager)
                                    .padding(.horizontal, 2)

                            case .registering:
                                ProgressView("Registering device...")
                                    .progressViewStyle(CircularProgressViewStyle(tint: .blue))

                            case .registered:
                                AuthenticationControls(authManager: authManager)
                            }
                        }

                        // Device Information
                        DeviceInfoCard(authManager: authManager)
                            .padding(.top, 8)

                        Spacer(minLength: 20)
                    }
                    .padding(.horizontal)
                    .padding(.bottom, 20)
                }
            }
            .navigationBarHidden(true)
            .alert("Authentication Error", isPresented: $showingError) {
                Button("OK") { authManager.lastError = nil }
            } message: {
                Text(authManager.lastError?.localizedDescription ?? "Unknown error")
            }
            .onChange(of: authManager.lastError) { error in
                showingError = error != nil
            }
        }
    }
}

struct AuthenticationStatusCard: View {
    @ObservedObject var authManager: DeviceAuthenticationManager

    var body: some View {
        VStack(spacing: 16) {
            // Status Icon with Animation
            ZStack {
                Circle()
                    .fill(statusColor.opacity(0.2))
                    .frame(width: 100, height: 100)

                Circle()
                    .stroke(statusColor, lineWidth: 4)
                    .frame(width: 100, height: 100)
                    .scaleEffect(authManager.authenticationState == .authenticating ? 1.1 : 1.0)
                    .animation(.easeInOut(duration: 1).repeatForever(autoreverses: true),
                              value: authManager.authenticationState == .authenticating)

                Image(systemName: statusIcon)
                    .font(.system(size: 40))
                    .foregroundColor(statusColor)
            }

            // Status Text
            VStack(spacing: 4) {
                Text(statusTitle)
                    .font(.headline)
                    .fontWeight(.semibold)

                Text(statusDescription)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
            }

            // Proximity Indicator
            if authManager.registrationState == .registered {
                ProximityIndicator(proximityState: authManager.proximityState)
            }
        }
        .padding()
        .background(Color(.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .shadow(color: .black.opacity(0.1), radius: 10, x: 0, y: 4)
    }

    private var statusColor: Color {
        switch authManager.authenticationState {
        case .unauthenticated:
            return .gray
        case .authenticating:
            return .orange
        case .authenticated:
            return .green
        case .locked:
            return .red
        }
    }

    private var statusIcon: String {
        switch authManager.authenticationState {
        case .unauthenticated:
            return "lock"
        case .authenticating:
            return "lock.rotation"
        case .authenticated:
            return "lock.open"
        case .locked:
            return "lock.fill"
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
            return "Tap to authenticate with biometrics"
        case .authenticating:
            return "Please complete biometric authentication"
        case .authenticated:
            return "Device authenticated and connected"
        case .locked:
            return "Device locked due to proximity"
        }
    }
}

struct ProximityIndicator: View {
    let proximityState: ProximityState

    var body: some View {
        HStack(spacing: 8) {
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

struct RegisterDeviceButton: View {
    @ObservedObject var authManager: DeviceAuthenticationManager

    var body: some View {
        VStack(spacing: 16) {
            Text("Device Registration Required")
                .font(.headline)
                .multilineTextAlignment(.center)

            Text("Register this device to enable secure authentication with Universal AI Tools")
                .font(.body)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)

            Button(action: {
                Task {
                    await authManager.registerDevice()
                }
            }) {
                HStack(spacing: 8) {
                    Image(systemName: "plus.circle.fill")
                    Text("Register Device")
                }
                .font(.headline)
                .foregroundColor(.white)
                .padding(.vertical, 14)
                .frame(maxWidth: .infinity)
                .background(AppTheme.chatUserGradient)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            }
        }
        .padding()
    }
}

struct AuthenticationControls: View {
    @ObservedObject var authManager: DeviceAuthenticationManager
    @State private var isProximityEnabled: Bool = true

    var body: some View {
        VStack(spacing: 16) {
            // Primary Authentication Button
            Button(action: {
                Task {
                    await authManager.authenticateWithBiometrics()
                }
            }) {
                HStack(spacing: 8) {
                    Image(systemName: biometricIcon)
                    Text("Authenticate with \(biometricType)")
                }
                .font(.headline)
                .foregroundColor(.white)
                .padding(.vertical, 14)
                .frame(maxWidth: .infinity)
                .background(primaryBackground)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            }
            .disabled(authManager.authenticationState == .authenticating)

            // Proximity Detection Toggle
            if authManager.registrationState == .registered {
                Toggle("Proximity Detection", isOn: $isProximityEnabled)
                    .onChange(of: isProximityEnabled) { enabled in
                        if enabled { authManager.startProximityDetection() }
                        else { authManager.stopProximityDetection() }
                    }
                    .padding(.horizontal)
                    .padding(.vertical, 12)
                    .background(AppTheme.inputBackground)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            }

            // Quick Actions
            if authManager.authenticationState == .authenticated {
                HStack(spacing: 16) {
                    Button("View Devices") {
                        // Navigate to device list
                    }
                    .font(.caption)
                    .foregroundColor(.blue)

                    Button("Settings") {
                        // Navigate to settings
                    }
                    .font(.caption)
                    .foregroundColor(.blue)
                }
            }
        }
        .padding()
    }

    @ViewBuilder
    private var primaryBackground: some View {
        if authManager.authenticationState == .authenticated {
            Color.green
        } else {
            AppTheme.chatUserGradient
        }
    }

    private var biometricType: String {
        let context = LAContext()
        var error: NSError?

        if context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) {
            switch context.biometryType {
            case .faceID:
                return "Face ID"
            case .touchID:
                return "Touch ID"
            default:
                return "Biometrics"
            }
        }

        return "Passcode"
    }

    private var biometricIcon: String {
        let context = LAContext()
        var error: NSError?

        if context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) {
            switch context.biometryType {
            case .faceID:
                return "faceid"
            case .touchID:
                return "touchid"
            default:
                return "lock.shield"
            }
        }

        return "lock.shield"
    }
}

struct DeviceInfoCard: View {
    @ObservedObject var authManager: DeviceAuthenticationManager

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "info.circle")
                    .foregroundColor(.blue)
                Text("Device Information")
                    .font(.headline)
                Spacer()
            }

            VStack(alignment: .leading, spacing: 4) {
                InfoRow(title: "Device", value: UIDevice.current.name)
                InfoRow(title: "Model", value: UIDevice.current.model)
                InfoRow(title: "iOS Version", value: UIDevice.current.systemVersion)
                InfoRow(title: "App Version", value: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0")
            }
        }
        .padding()
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}

struct InfoRow: View {
    let title: String
    let value: String

    var body: some View {
        HStack {
            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)
            Spacer()
            Text(value)
                .font(.caption)
                .fontWeight(.medium)
        }
    }
}

#Preview {
    AuthenticationView()
}
