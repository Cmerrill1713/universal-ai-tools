#!/bin/bash

# Setup script for Universal AI Companion iOS app

echo "🚀 Setting up Universal AI Companion iOS app..."

# Create directory structure
mkdir -p UniversalAICompanion/{Services,Views,Models,Utils}

# Create ContentView.swift
cat > UniversalAICompanion/ContentView.swift << 'EOF'
import SwiftUI

struct ContentView: View {
    @StateObject private var authManager = DeviceAuthenticationManager()
    @StateObject private var connectionManager = ConnectionManager()
    
    var body: some View {
        NavigationView {
            VStack(spacing: 20) {
                // Connection Status
                ConnectionStatusView(isConnected: connectionManager.isConnected)
                
                // Authentication Status
                AuthenticationStatusCard(
                    status: authManager.authenticationStatus,
                    onAuthenticate: authManager.authenticateWithBiometrics
                )
                
                // Quick Actions
                VStack(spacing: 12) {
                    Button(action: connectToServer) {
                        Label("Connect to AI Server", systemImage: "network")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(connectionManager.isConnected)
                    
                    Button(action: testPersonalityAPI) {
                        Label("Test Personality Analysis", systemImage: "brain")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    .disabled(!connectionManager.isConnected)
                }
                .padding(.horizontal)
                
                Spacer()
            }
            .navigationTitle("AI Companion")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: { showSettings = true }) {
                        Image(systemName: "gear")
                    }
                }
            }
        }
    }
    
    @State private var showSettings = false
    
    private func connectToServer() {
        // Use your Mac's IP address when testing
        // Find it with: ifconfig | grep "inet " | grep -v 127.0.0.1
        let serverURL = "ws://YOUR_MAC_IP:8080/ws/device-auth"
        connectionManager.connect(to: serverURL)
    }
    
    private func testPersonalityAPI() {
        Task {
            await connectionManager.testPersonalityAnalysis()
        }
    }
}
EOF

# Create DeviceAuthenticationManager.swift
cat > UniversalAICompanion/Services/DeviceAuthenticationManager.swift << 'EOF'
import SwiftUI
import LocalAuthentication
import CoreBluetooth

class DeviceAuthenticationManager: NSObject, ObservableObject {
    @Published var authenticationStatus: AuthenticationStatus = .locked
    @Published var biometricType: LABiometryType = .none
    
    private let context = LAContext()
    
    enum AuthenticationStatus {
        case locked
        case authenticated
        case failed
        case pending
    }
    
    override init() {
        super.init()
        checkBiometricAvailability()
    }
    
    private func checkBiometricAvailability() {
        var error: NSError?
        if context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) {
            biometricType = context.biometryType
        }
    }
    
    func authenticateWithBiometrics() {
        let reason = "Authenticate to connect to your AI assistant"
        
        context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: reason) { success, error in
            DispatchQueue.main.async {
                if success {
                    self.authenticationStatus = .authenticated
                    self.sendAuthenticationToServer(confidence: 0.95)
                } else {
                    self.authenticationStatus = .failed
                    print("Authentication failed: \(error?.localizedDescription ?? "Unknown error")")
                }
            }
        }
    }
    
    private func sendAuthenticationToServer(confidence: Double) {
        // Send to personality system
        let authData = [
            "deviceId": UIDevice.current.identifierForVendor?.uuidString ?? "",
            "deviceType": "iphone",
            "authenticationConfidence": confidence,
            "biometricType": biometricTypeString
        ]
        
        NotificationCenter.default.post(
            name: .biometricAuthenticationCompleted,
            object: authData
        )
    }
    
    private var biometricTypeString: String {
        switch biometricType {
        case .faceID: return "face_id"
        case .touchID: return "touch_id"
        default: return "none"
        }
    }
}

extension Notification.Name {
    static let biometricAuthenticationCompleted = Notification.Name("biometricAuthenticationCompleted")
}
EOF

# Create ConnectionManager.swift
cat > UniversalAICompanion/Services/ConnectionManager.swift << 'EOF'
import Foundation
import Combine

class ConnectionManager: ObservableObject {
    @Published var isConnected = false
    @Published var lastResponse: String = ""
    
    private var webSocketTask: URLSessionWebSocketTask?
    private let session = URLSession.shared
    
    func connect(to urlString: String) {
        guard let url = URL(string: urlString) else { return }
        
        webSocketTask = session.webSocketTask(with: url)
        webSocketTask?.resume()
        
        isConnected = true
        receiveMessage()
    }
    
    private func receiveMessage() {
        webSocketTask?.receive { [weak self] result in
            switch result {
            case .success(let message):
                switch message {
                case .string(let text):
                    DispatchQueue.main.async {
                        self?.lastResponse = text
                    }
                case .data(let data):
                    print("Received data: \(data)")
                @unknown default:
                    break
                }
                self?.receiveMessage()
            case .failure(let error):
                print("WebSocket error: \(error)")
                DispatchQueue.main.async {
                    self?.isConnected = false
                }
            }
        }
    }
    
    func testPersonalityAnalysis() async {
        let testData = [
            "userId": UIDevice.current.identifierForVendor?.uuidString ?? "",
            "interactions": [[
                "timestamp": ISO8601DateFormatter().string(from: Date()),
                "type": "chat",
                "content": "Help me build a SwiftUI app",
                "satisfaction": 4.5
            ]],
            "biometricData": [
                "deviceType": "iphone",
                "authenticationConfidence": 0.95,
                "proximityScore": 0.98
            ]
        ] as [String : Any]
        
        guard let jsonData = try? JSONSerialization.data(withJSONObject: testData) else { return }
        
        let message = URLSessionWebSocketTask.Message.data(jsonData)
        try? await webSocketTask?.send(message)
    }
    
    func disconnect() {
        webSocketTask?.cancel(with: .goingAway, reason: nil)
        isConnected = false
    }
}
EOF

# Create Info.plist
cat > UniversalAICompanion/Info.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>NSBluetoothAlwaysUsageDescription</key>
    <string>This app uses Bluetooth for proximity-based authentication with your AI system</string>
    <key>NSFaceIDUsageDescription</key>
    <string>Authenticate to securely connect to your AI assistant</string>
    <key>NSLocalNetworkUsageDescription</key>
    <string>Connect to your local AI server for personalized assistance</string>
    <key>UIApplicationSceneManifest</key>
    <dict>
        <key>UIApplicationSupportsMultipleScenes</key>
        <false/>
    </dict>
</dict>
</plist>
EOF

# Create simple UI components
cat > UniversalAICompanion/Views/ConnectionStatusView.swift << 'EOF'
import SwiftUI

struct ConnectionStatusView: View {
    let isConnected: Bool
    
    var body: some View {
        HStack {
            Circle()
                .fill(isConnected ? Color.green : Color.red)
                .frame(width: 12, height: 12)
            
            Text(isConnected ? "Connected to AI Server" : "Disconnected")
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding(.horizontal)
    }
}
EOF

cat > UniversalAICompanion/Views/AuthenticationStatusCard.swift << 'EOF'
import SwiftUI

struct AuthenticationStatusCard: View {
    let status: DeviceAuthenticationManager.AuthenticationStatus
    let onAuthenticate: () -> Void
    
    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: iconName)
                .font(.system(size: 60))
                .foregroundColor(iconColor)
            
            Text(statusText)
                .font(.headline)
            
            if status == .locked {
                Button("Authenticate", action: onAuthenticate)
                    .buttonStyle(.borderedProminent)
            }
        }
        .padding(24)
        .frame(maxWidth: .infinity)
        .background(Color(.secondarySystemBackground))
        .cornerRadius(16)
        .padding(.horizontal)
    }
    
    private var iconName: String {
        switch status {
        case .authenticated: return "lock.open.fill"
        case .locked: return "lock.fill"
        case .failed: return "exclamationmark.lock.fill"
        case .pending: return "lock.rotation"
        }
    }
    
    private var iconColor: Color {
        switch status {
        case .authenticated: return .green
        case .locked: return .orange
        case .failed: return .red
        case .pending: return .blue
        }
    }
    
    private var statusText: String {
        switch status {
        case .authenticated: return "Authenticated"
        case .locked: return "Locked - Authenticate to continue"
        case .failed: return "Authentication Failed"
        case .pending: return "Authenticating..."
        }
    }
}
EOF

# Create App.swift
cat > UniversalAICompanion/UniversalAICompanionApp.swift << 'EOF'
import SwiftUI

@main
struct UniversalAICompanionApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
EOF

echo "✅ iOS app structure created!"
echo ""
echo "📱 Next steps:"
echo "1. Open Xcode"
echo "2. Create a new iOS App project named 'UniversalAICompanion'"
echo "3. Replace the default files with the ones created above"
echo "4. Update YOUR_MAC_IP in ContentView.swift with your Mac's IP address"
echo "5. Connect your iPhone via USB"
echo "6. Select your iPhone as the target device"
echo "7. Click Run (⌘R)"
echo ""
echo "🔧 To find your Mac's IP address:"
echo "ifconfig | grep 'inet ' | grep -v 127.0.0.1"
EOF

chmod +x setup-ios-app.sh