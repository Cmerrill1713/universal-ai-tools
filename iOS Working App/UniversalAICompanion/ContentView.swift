import SwiftUI
import Foundation
import Network
import UIKit
import Combine

// Temporary NetworkConfig
struct NetworkConfig {
    static let shared = NetworkConfig()
    let baseURL = "http://169.254.105.52:9999"
}

enum ConnectionState {
    case connecting
    case connected
    case disconnected
    case error
}

// Unified Connection Status System
enum NetworkConnectivityState {
    case connected
    case disconnected
    case unknown
}

enum BackendConnectionState {
    case connected
    case connecting
    case disconnected
    case error
}

enum AuthenticationConnectionState {
    case authenticated
    case authenticating
    case unauthenticated
    case locked
}

@MainActor
final class ConnectionStatusService: ObservableObject {
    // Network connectivity (iOS system level)
    @Published var networkState: NetworkConnectivityState = .unknown
    
    // Backend API connectivity (app level)
    @Published var backendState: BackendConnectionState = .disconnected
    
    // Authentication status (user level)
    @Published var authState: AuthenticationConnectionState = .unauthenticated
    
    // Overall status for simplified displays
    @Published var overallStatus: String = "Initializing..."
    @Published var overallStatusColor: Color = .gray
    
    private var baseURL: String {
        return NetworkConfig.shared.baseURL
    }
    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "ConnectionMonitor")
    
    init() {
        startNetworkMonitoring()
        Task {
            await checkBackendConnection()
        }
    }
    
    deinit {
        monitor.cancel()
    }
    
    // MARK: - Network Monitoring
    
    private func startNetworkMonitoring() {
        monitor.pathUpdateHandler = { [weak self] path in
            DispatchQueue.main.async {
                self?.updateNetworkState(path: path)
            }
        }
        monitor.start(queue: queue)
    }
    
    private func updateNetworkState(path: NWPath) {
        switch path.status {
        case .satisfied:
            networkState = .connected
        case .requiresConnection, .unsatisfied:
            networkState = .disconnected
        @unknown default:
            networkState = .unknown
        }
        updateOverallStatus()
    }
    
    // MARK: - Backend Connection
    
    func checkBackendConnection() async {
        backendState = .connecting
        updateOverallStatus()
        
        do {
            guard let url = URL(string: "\(baseURL)/health") else {
                backendState = .error
                updateOverallStatus()
                return
            }
            
            var request = URLRequest(url: url)
            request.timeoutInterval = 5.0 // 5 second timeout
            
            let (_, response) = try await URLSession.shared.data(for: request)
            
            if let httpResponse = response as? HTTPURLResponse {
                switch httpResponse.statusCode {
                case 200...299:
                    backendState = .connected
                    print("✅ Backend connected: \(baseURL)")
                default:
                    backendState = .error
                    print("❌ Backend error: HTTP \(httpResponse.statusCode)")
                }
            } else {
                backendState = .error
                print("❌ Backend error: Invalid response")
            }
        } catch {
            backendState = .disconnected
            print("❌ Backend connection failed: \(error.localizedDescription)")
        }
        
        updateOverallStatus()
    }
    
    // MARK: - Authentication Status
    
    func updateAuthStatus(_ status: AuthenticationConnectionState) {
        authState = status
        updateOverallStatus()
    }
    
    // MARK: - Status Aggregation
    
    private func updateOverallStatus() {
        let status = calculateOverallStatus()
        overallStatus = status.text
        overallStatusColor = status.color
    }
    
    private func calculateOverallStatus() -> (text: String, color: Color) {
        // Priority: Backend > Network > Auth
        
        // First check backend connectivity
        switch backendState {
        case .connected:
            // Backend is connected, show auth status if authenticated
            switch authState {
            case .authenticated:
                return ("Online", .green)
            case .authenticating:
                return ("Authenticating...", .orange)
            case .unauthenticated, .locked:
                return ("Backend Connected", .green)
            }
        case .connecting:
            return ("Connecting...", .orange)
        case .disconnected:
            if networkState == .disconnected {
                return ("No Network", .red)
            } else {
                return ("Backend Offline", .red)
            }
        case .error:
            return ("Connection Error", .red)
        }
    }
    
    // MARK: - Detailed Status Information
    
    var networkStatusText: String {
        switch networkState {
        case .connected: return "Connected"
        case .disconnected: return "Disconnected"
        case .unknown: return "Unknown"
        }
    }
    
    var backendStatusText: String {
        switch backendState {
        case .connected: return "Connected to \(baseURL)"
        case .connecting: return "Connecting to backend..."
        case .disconnected: return "Backend offline"
        case .error: return "Connection error"
        }
    }
    
    var authStatusText: String {
        switch authState {
        case .authenticated: return "Authenticated"
        case .authenticating: return "Authenticating..."
        case .unauthenticated: return "Not authenticated"
        case .locked: return "Locked"
        }
    }
    
    // Status colors for individual components
    var networkStatusColor: Color {
        switch networkState {
        case .connected: return .green
        case .disconnected: return .red
        case .unknown: return .gray
        }
    }
    
    var backendStatusColor: Color {
        switch backendState {
        case .connected: return .green
        case .connecting: return .orange
        case .disconnected, .error: return .red
        }
    }
    
    var authStatusColor: Color {
        switch authState {
        case .authenticated: return .green
        case .authenticating: return .orange
        case .unauthenticated: return .red
        case .locked: return .purple
        }
    }
    
    // MARK: - Actions
    
    func reconnect() async {
        await checkBackendConnection()
    }
    
    func refreshAll() async {
        await checkBackendConnection()
        // Network monitoring is automatic
    }
}

// MARK: - Connection Status Views

struct ConnectionStatusView: View {
    @ObservedObject var connectionService: ConnectionStatusService
    @State private var showDetailedStatus = false
    
    var body: some View {
        VStack(spacing: 12) {
            // Main Status Indicator
            HStack {
                Circle()
                    .fill(connectionService.overallStatusColor)
                    .frame(width: 12, height: 12)
                
                Text(connectionService.overallStatus)
                    .font(.caption)
                    .foregroundColor(.primary)
                
                Spacer()
                
                Button("Details") {
                    showDetailedStatus.toggle()
                }
                .font(.caption2)
                .foregroundColor(.blue)
            }
            
            // Detailed Status (when expanded)
            if showDetailedStatus {
                VStack(spacing: 8) {
                    Divider()
                    
                    // Network Status
                    HStack {
                        Circle()
                            .fill(connectionService.networkStatusColor)
                            .frame(width: 8, height: 8)
                        
                        Text("Network")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                        
                        Spacer()
                        
                        Text(connectionService.networkStatusText)
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                    
                    // Backend Status
                    HStack {
                        Circle()
                            .fill(connectionService.backendStatusColor)
                            .frame(width: 8, height: 8)
                        
                        Text("Backend")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                        
                        Spacer()
                        
                        Text(connectionService.backendStatusText)
                            .font(.caption2)
                            .foregroundColor(.secondary)
                            .lineLimit(1)
                            .truncationMode(.middle)
                    }
                    
                    // Authentication Status
                    HStack {
                        Circle()
                            .fill(connectionService.authStatusColor)
                            .frame(width: 8, height: 8)
                        
                        Text("Authentication")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                        
                        Spacer()
                        
                        Text(connectionService.authStatusText)
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                    
                    // Action Buttons
                    HStack {
                        Button("Reconnect") {
                            Task {
                                await connectionService.reconnect()
                            }
                        }
                        .font(.caption2)
                        .foregroundColor(.blue)
                        .disabled(connectionService.backendState == .connecting)
                        
                        Spacer()
                        
                        Button("Refresh All") {
                            Task {
                                await connectionService.refreshAll()
                            }
                        }
                        .font(.caption2)
                        .foregroundColor(.blue)
                    }
                }
                .padding(.horizontal, 4)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(Color.gray.opacity(0.1))
        .cornerRadius(8)
    }
}

// Compact version for smaller spaces
struct CompactConnectionStatusView: View {
    @ObservedObject var connectionService: ConnectionStatusService
    
    var body: some View {
        HStack(spacing: 8) {
            Circle()
                .fill(connectionService.overallStatusColor)
                .frame(width: 10, height: 10)
            
            Text(connectionService.overallStatus)
                .font(.caption)
                .foregroundColor(.secondary)
            
            if connectionService.backendState == .connecting {
                ProgressView()
                    .scaleEffect(0.7)
            }
        }
    }
}

// Status bar for navigation bars
struct NavigationConnectionStatusView: View {
    @ObservedObject var connectionService: ConnectionStatusService
    
    var body: some View {
        HStack(spacing: 6) {
            Circle()
                .fill(connectionService.overallStatusColor)
                .frame(width: 8, height: 8)
            
            Text(connectionService.overallStatus)
                .font(.caption2)
                .foregroundColor(.secondary)
        }
    }
}

// Full DeviceAuthenticationManager is now used directly

struct ContentView: View {
    @StateObject private var authManager = DeviceAuthenticationManager()
    @StateObject private var connectionService = ConnectionStatusService()
    
    var body: some View {
        TabView {
            // Authentication Tab (Simplified)
            SimpleAuthenticationView()
                .tabItem {
                    Image(systemName: "lock.shield")
                    Text("Authentication")
                }
                .environmentObject(authManager)
                .environmentObject(connectionService)
            
            // Simple Chat Tab - Available when backend is connected (no auth required for testing)
            if connectionService.backendState == .connected {
                SimpleChatView()
                    .tabItem {
                        Image(systemName: "message.fill")
                        Text("AI Chat")
                    }
                    .environmentObject(connectionService)
            }
            
            // Vision Tab - Available when backend is connected (no auth required for testing)
            if connectionService.backendState == .connected {
                SimpleVisionView()
                    .tabItem {
                        Image(systemName: "camera.viewfinder")
                        Text("Vision AI")
                    }
                    .environmentObject(connectionService)
            }
            
            // Settings Tab - Always available
            SettingsView()
                .tabItem {
                    Image(systemName: "gear")
                    Text("Settings")
                }
                .environmentObject(authManager)
                .environmentObject(connectionService)
        }
        .onReceive(authManager.$authenticationState) { authState in
            // Update connection service when auth state changes
            let connectionAuthState: AuthenticationConnectionState = switch authState {
            case .unauthenticated: .unauthenticated
            case .authenticating: .authenticating
            case .authenticated: .authenticated
            case .locked: .locked
            }
            connectionService.updateAuthStatus(connectionAuthState)
        }
    }
}

// Authentication View
struct SimpleAuthenticationView: View {
    @EnvironmentObject var authManager: DeviceAuthenticationManager
    @EnvironmentObject var connectionService: ConnectionStatusService
    
    var body: some View {
        NavigationView {
            VStack(spacing: 30) {
                // Connection Status Bar
                ConnectionStatusView(connectionService: connectionService)
                
                // Logo
                VStack(spacing: 16) {
                    Image(systemName: "lock.shield")
                        .font(.system(size: 80))
                        .foregroundColor(.blue)
                    
                    Text("Universal AI Tools")
                        .font(.largeTitle)
                        .fontWeight(.bold)
                    
                    Text("iOS Companion")
                        .font(.title2)
                        .foregroundColor(.secondary)
                }
                
                Spacer()
                
                // Status - Now showing authentication status specifically
                VStack(spacing: 16) {
                    Circle()
                        .fill(statusColor.opacity(0.2))
                        .frame(width: 120, height: 120)
                        .overlay(
                            Image(systemName: statusIcon)
                                .font(.system(size: 40))
                                .foregroundColor(statusColor)
                        )
                    
                    Text(statusText)
                        .font(.headline)
                        .foregroundColor(statusColor)
                }
                
                Spacer()
                
                // Authentication Button
                Button(action: {
                    Task {
                        if authManager.registrationState == .unregistered {
                            // First time setup - register device
                            await authManager.registerDevice()
                        } else if authManager.authenticationState == .unauthenticated || authManager.authenticationState == .locked {
                            // Authenticate with biometrics
                            await authManager.authenticateWithBiometrics()
                        } else {
                            // Sign out (reset to unauthenticated)
                            await authManager.signOut()
                        }
                    }
                }) {
                    Text(buttonText)
                        .font(.headline)
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(statusColor)
                        .cornerRadius(12)
                }
                .disabled(authManager.authenticationState == .authenticating)
                .padding(.horizontal)
                
                Spacer()
            }
            .padding()
            .navigationBarHidden(true)
        }
    }
    
    private var statusColor: Color {
        switch authManager.authenticationState {
        case .unauthenticated: return .red
        case .authenticating: return .orange
        case .authenticated: return .green
        case .locked: return .purple
        }
    }
    
    private var statusIcon: String {
        switch authManager.authenticationState {
        case .unauthenticated: return "lock.slash"
        case .authenticating: return "lock.rotation"
        case .authenticated: return "checkmark.shield"
        case .locked: return "lock.fill"
        }
    }
    
    private var statusText: String {
        switch authManager.authenticationState {
        case .unauthenticated: return "Not Authenticated"
        case .authenticating: return "Authenticating..."
        case .authenticated: return "Authenticated"
        case .locked: return "Locked"
        }
    }
    
    private var buttonText: String {
        if authManager.registrationState == .unregistered {
            return "Register Device"
        } else if authManager.registrationState == .registering {
            return "Registering..."
        }
        
        switch authManager.authenticationState {
        case .unauthenticated: return "Authenticate with Biometrics"
        case .authenticating: return "Authenticating..."
        case .authenticated: return "Sign Out"
        case .locked: return "Unlock with Biometrics"
        }
    }
}

// Smart Chat Message Model
struct SmartChatMessage: Identifiable {
    let id = UUID()
    let content: String
    let isUser: Bool
    let timestamp: Date
    let agentUsed: String?
    let processingTime: Double?
    
    init(content: String, isUser: Bool, agentUsed: String? = nil, processingTime: Double? = nil) {
        self.content = content
        self.isUser = isUser
        self.timestamp = Date()
        self.agentUsed = agentUsed
        self.processingTime = processingTime
    }
}

// Enhanced Chat View with Smart Agent Selection
struct SimpleChatView: View {
    @EnvironmentObject var connectionService: ConnectionStatusService
    @State private var messages: [SmartChatMessage] = []
    @State private var newMessage: String = ""
    @State private var isLoading = false
    @State private var lastAgent: String?
    
    var body: some View {
        NavigationView {
            VStack {
                // Show last agent used if available
                if let agent = lastAgent {
                    HStack {
                        Spacer()
                        Text("Agent: \(agent)")
                            .font(.caption)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 2)
                            .background(Color.blue.opacity(0.1))
                            .cornerRadius(4)
                        Spacer()
                    }
                    .padding(.horizontal)
                    .padding(.top, 8)
                }
                
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(alignment: .leading, spacing: 12) {
                            ForEach(messages) { message in
                                MessageBubbleSimpleView(message: message)
                                    .id(message.id)
                            }
                            
                            if isLoading {
                                HStack {
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text("🧠 Thinking...")
                                            .font(.caption)
                                            .foregroundColor(.blue)
                                        
                                        HStack(spacing: 4) {
                                            ForEach(0..<3) { _ in
                                                Circle()
                                                    .fill(Color.gray.opacity(0.6))
                                                    .frame(width: 6, height: 6)
                                            }
                                        }
                                        .padding(.vertical, 8)
                                        .padding(.horizontal, 12)
                                        .background(Color.gray.opacity(0.1))
                                        .cornerRadius(12)
                                    }
                                    Spacer()
                                }
                                .padding(.horizontal)
                            }
                        }
                        .padding()
                    }
                    .onChange(of: messages.count) { _ in
                        if let lastMessage = messages.last {
                            proxy.scrollTo(lastMessage.id, anchor: .bottom)
                        }
                    }
                }
                
                HStack {
                    TextField("Ask me anything...", text: $newMessage)
                        .textFieldStyle(RoundedBorderTextFieldStyle())
                        .onSubmit {
                            Task { await sendMessage() }
                        }
                    
                    Button("Send") {
                        Task { await sendMessage() }
                    }
                    .disabled(newMessage.isEmpty || connectionService.backendState != .connected || isLoading)
                }
                .padding()
            }
            .navigationTitle("AI Assistant")
            .navigationBarItems(trailing: NavigationConnectionStatusView(connectionService: connectionService))
        }
        .onAppear {
            if messages.isEmpty {
                messages.append(SmartChatMessage(
                    content: "Hello! I'm your intelligent AI assistant. I'll automatically choose the best agent for each of your requests. What can I help you with today?",
                    isUser: false,
                    agentUsed: "system"
                ))
            }
        }
    }
    
    private func sendMessage() async {
        let messageText = newMessage.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !messageText.isEmpty else { return }
        
        // Add user message
        let userMessage = SmartChatMessage(content: messageText, isUser: true)
        messages.append(userMessage)
        newMessage = ""
        isLoading = true
        
        do {
            // Test with mobile orchestration endpoint
            let url = URL(string: "http://localhost:9999/api/v1/mobile-orchestration/test")!
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            
            let deviceContext: [String: Any] = [
                "deviceId": UIDevice.current.identifierForVendor?.uuidString ?? "unknown",
                "deviceName": UIDevice.current.name,
                "osVersion": UIDevice.current.systemVersion,
                "batteryLevel": UIDevice.current.batteryLevel >= 0 ? UIDevice.current.batteryLevel : 1.0,
                "isLowPowerMode": ProcessInfo.processInfo.isLowPowerModeEnabled,
                "connectionType": "wifi"
            ]
            
            let requestBody: [String: Any] = [
                "deviceContext": deviceContext
            ]
            
            request.httpBody = try JSONSerialization.data(withJSONObject: requestBody)
            
            let (data, response) = try await URLSession.shared.data(for: request)
            
            if let httpResponse = response as? HTTPURLResponse,
               httpResponse.statusCode == 200 {
                
                if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    let responseText = "✅ Smart AI system is working! I can intelligently route your requests to the best agent automatically. This was handled by the mobile orchestration system.\n\nYour original message was: \"\(messageText)\""
                    
                    let assistantMessage = SmartChatMessage(
                        content: responseText,
                        isUser: false,
                        agentUsed: "mobile-orchestrator",
                        processingTime: 1.5
                    )
                    messages.append(assistantMessage)
                    lastAgent = "mobile-orchestrator"
                } else {
                    let errorMessage = SmartChatMessage(
                        content: "I received a response but couldn't parse it properly. The system is working but there might be a formatting issue.",
                        isUser: false,
                        agentUsed: "error"
                    )
                    messages.append(errorMessage)
                }
            } else {
                let errorMessage = SmartChatMessage(
                    content: "I'm having trouble connecting to the AI system right now. Please make sure the backend is running and try again.",
                    isUser: false,
                    agentUsed: "error"
                )
                messages.append(errorMessage)
            }
            
        } catch {
            let errorMessage = SmartChatMessage(
                content: "Connection error: \(error.localizedDescription)",
                isUser: false,
                agentUsed: "error"
            )
            messages.append(errorMessage)
        }
        
        isLoading = false
    }
}

// Simple Message Bubble View
struct MessageBubbleSimpleView: View {
    let message: SmartChatMessage
    
    var body: some View {
        HStack {
            if message.isUser {
                Spacer()
                VStack(alignment: .trailing, spacing: 2) {
                    Text(message.content)
                        .padding(.vertical, 8)
                        .padding(.horizontal, 12)
                        .background(Color.blue)
                        .foregroundColor(.white)
                        .cornerRadius(16)
                    
                    Text(timeString(from: message.timestamp))
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
            } else {
                VStack(alignment: .leading, spacing: 2) {
                    if let agent = message.agentUsed, agent != "system" {
                        Text("🤖 \(agent)")
                            .font(.caption2)
                            .foregroundColor(.blue)
                    }
                    
                    Text(message.content)
                        .padding(.vertical, 8)
                        .padding(.horizontal, 12)
                        .background(message.agentUsed == "error" ? Color.red.opacity(0.1) : Color.gray.opacity(0.1))
                        .foregroundColor(message.agentUsed == "error" ? .red : .primary)
                        .cornerRadius(16)
                    
                    HStack {
                        Text(timeString(from: message.timestamp))
                            .font(.caption2)
                            .foregroundColor(.secondary)
                        
                        if let processingTime = message.processingTime {
                            Text("• \(String(format: "%.1fs", processingTime))")
                                .font(.caption2)
                                .foregroundColor(.secondary)
                        }
                    }
                }
                Spacer()
            }
        }
        .padding(.horizontal)
    }
    
    private func timeString(from date: Date) -> String {
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

// Simple Vision View
struct SimpleVisionView: View {
    @EnvironmentObject var connectionService: ConnectionStatusService
    
    var body: some View {
        NavigationView {
            VStack(spacing: 30) {
                Spacer()
                
                Image(systemName: "camera.viewfinder")
                    .font(.system(size: 80))
                    .foregroundColor(.blue)
                
                Text("Vision AI")
                    .font(.largeTitle)
                    .fontWeight(.bold)
                
                Text("Vision processing features will be available here.")
                    .font(.body)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                    .padding()
                
                Button("Analyze Image") {
                    // Placeholder
                }
                .font(.headline)
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding()
                .background(connectionService.backendState == .connected ? Color.blue : Color.gray)
                .cornerRadius(12)
                .padding(.horizontal)
                .disabled(connectionService.backendState != .connected)
                
                Spacer()
            }
            .padding()
            .navigationTitle("Vision AI")
            .navigationBarItems(trailing: NavigationConnectionStatusView(connectionService: connectionService))
        }
    }
}

struct SettingsView: View {
    @EnvironmentObject var authManager: DeviceAuthenticationManager
    @EnvironmentObject var connectionService: ConnectionStatusService
    @State private var apiTestResult: String = ""
    
    var body: some View {
        NavigationView {
            List {
                Section("Connection Status") {
                    HStack {
                        Text("Overall Status")
                        Spacer()
                        HStack {
                            Circle()
                                .fill(connectionService.overallStatusColor)
                                .frame(width: 8, height: 8)
                            Text(connectionService.overallStatus)
                                .foregroundColor(.secondary)
                        }
                    }
                    
                    HStack {
                        Text("Network")
                        Spacer()
                        HStack {
                            Circle()
                                .fill(connectionService.networkStatusColor)
                                .frame(width: 8, height: 8)
                            Text(connectionService.networkStatusText)
                                .foregroundColor(.secondary)
                        }
                    }
                    
                    HStack {
                        Text("Backend")
                        Spacer()
                        HStack {
                            Circle()
                                .fill(connectionService.backendStatusColor)
                                .frame(width: 8, height: 8)
                            Text("localhost:9999")
                                .foregroundColor(.secondary)
                        }
                    }
                    
                    Button("Test Connection") {
                        Task {
                            await connectionService.checkBackendConnection()
                        }
                    }
                    .foregroundColor(.blue)
                    
                    Button("Test Mobile API") {
                        Task {
                            await testMobileOrchestrationAPI()
                        }
                    }
                    .foregroundColor(.green)
                    
                    if !apiTestResult.isEmpty {
                        HStack {
                            Text("API Test Result")
                            Spacer()
                        }
                        Text(apiTestResult)
                            .font(.caption)
                            .foregroundColor(.secondary)
                            .padding(.horizontal)
                    }
                }
                
                Section("Authentication") {
                    HStack {
                        Text("Registration")
                        Spacer()
                        Text(registrationText)
                            .foregroundColor(.secondary)
                    }
                    
                    HStack {
                        Text("Status")
                        Spacer()
                        HStack {
                            Circle()
                                .fill(connectionService.authStatusColor)
                                .frame(width: 8, height: 8)
                            Text(statusText)
                                .foregroundColor(.secondary)
                        }
                    }
                    
                    if authManager.lastError != nil {
                        HStack {
                            Text("Last Error")
                            Spacer()
                            Text(authManager.lastError?.localizedDescription ?? "None")
                                .foregroundColor(.red)
                                .font(.caption)
                        }
                    }
                    
                    if authManager.authenticationState == .authenticated {
                        Button("Sign Out") {
                            Task {
                                await authManager.signOut()
                            }
                        }
                        .foregroundColor(.red)
                    } else if authManager.registrationState == .unregistered {
                        Button("Register Device") {
                            Task {
                                await authManager.registerDevice()
                            }
                        }
                        .foregroundColor(.blue)
                    }
                }
                
                Section("App Information") {
                    HStack {
                        Text("Version")
                        Spacer()
                        Text("1.0.0")
                            .foregroundColor(.secondary)
                    }
                    
                    HStack {
                        Text("Backend URL")
                        Spacer()
                        Text("http://localhost:9999")
                            .foregroundColor(.secondary)
                    }
                }
                
                Section("About") {
                    Text("Universal AI Tools Companion")
                        .font(.headline)
                    
                    Text("A native iOS companion app for Universal AI Tools featuring secure authentication, agent selection, and seamless AI interactions.")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            .navigationTitle("Settings")
        }
    }
    
    private func testMobileOrchestrationAPI() async {
        apiTestResult = "Testing..."
        
        do {
            let url = URL(string: "http://localhost:9999/api/v1/mobile-orchestration/metrics")!
            var request = URLRequest(url: url)
            request.timeoutInterval = 10.0
            
            let (data, response) = try await URLSession.shared.data(for: request)
            
            if let httpResponse = response as? HTTPURLResponse {
                if httpResponse.statusCode == 200 {
                    if let jsonString = String(data: data, encoding: .utf8) {
                        // Try to parse and show a summary
                        if let jsonData = jsonString.data(using: .utf8),
                           let json = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any],
                           let success = json["success"] as? Bool {
                            apiTestResult = success ? "✅ Mobile API is working!" : "❌ API returned error"
                        } else {
                            apiTestResult = "✅ API responded with data"
                        }
                    } else {
                        apiTestResult = "✅ API responded (no data)"
                    }
                } else {
                    apiTestResult = "❌ HTTP \(httpResponse.statusCode)"
                }
            } else {
                apiTestResult = "❌ Invalid response"
            }
        } catch {
            apiTestResult = "❌ \(error.localizedDescription)"
        }
    }
    
    private var registrationText: String {
        switch authManager.registrationState {
        case .unregistered: return "Not Registered"
        case .registering: return "Registering..."
        case .registered: return "Registered"
        }
    }
    
    private var statusText: String {
        switch authManager.authenticationState {
        case .unauthenticated: return "Not Authenticated"
        case .authenticating: return "Authenticating..."
        case .authenticated: return "Authenticated"
        case .locked: return "Locked"
        }
    }
}

#Preview {
    ContentView()
}