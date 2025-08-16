import SwiftUI
import Foundation

/// Connection Settings for Agent Orchestration Service
struct ConnectionSettingsView: View {
    @EnvironmentObject var webSocketService: AgentWebSocketService
    @Environment(\.dismiss) private var dismiss
    
    @State private var serverURL = "ws://localhost:3001/agents/orchestration"
    @State private var apiKey = ""
    @State private var useSSL = false
    @State private var customHeaders: [String: String] = [:]
    @State private var connectionTimeout: Double = 10.0
    @State private var heartbeatInterval: Double = 30.0
    @State private var maxReconnectAttempts = 10
    @State private var reconnectDelay: Double = 2.0
    @State private var enableLogging = true
    @State private var logLevel: LogLevel = .info
    @State private var autoReconnect = true
    @State private var showTestConnection = false
    @State private var testConnectionResult: ConnectionTestResult?
    
    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Text("Connection Settings")
                    .font(.title2)
                    .fontWeight(.bold)
                
                Spacer()
                
                HStack(spacing: 12) {
                    Button("Test Connection") {
                        testConnection()
                    }
                    .buttonStyle(.bordered)
                    
                    Button("Cancel") {
                        dismiss()
                    }
                    .buttonStyle(.borderless)
                    
                    Button("Save") {
                        saveSettings()
                    }
                    .buttonStyle(.borderedProminent)
                }
            }
            .padding()
            
            Divider()
            
            ScrollView {
                VStack(spacing: 20) {
                    // Basic connection settings
                    connectionSection
                    
                    // Security settings
                    securitySection
                    
                    // Advanced settings
                    advancedSection
                    
                    // Logging settings
                    loggingSection
                    
                    // Connection test results
                    if let testResult = testConnectionResult {
                        connectionTestSection(testResult)
                    }
                }
                .padding()
            }
        }
        .onAppear {
            loadCurrentSettings()
        }
    }
    
    // MARK: - Connection Section
    
    private var connectionSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Connection")
                .font(.headline)
                .fontWeight(.semibold)
            
            VStack(spacing: 12) {
                HStack {
                    Text("Server URL:")
                        .frame(width: 120, alignment: .leading)
                    
                    TextField("ws://localhost:3001/agents/orchestration", text: $serverURL)
                        .textFieldStyle(.roundedBorder)
                        .help("WebSocket URL for the agent orchestration service")
                }
                
                HStack {
                    Text("Use SSL:")
                        .frame(width: 120, alignment: .leading)
                    
                    Toggle("", isOn: $useSSL)
                        .toggleStyle(.switch)
                        .help("Enable SSL/TLS encryption for the connection")
                    
                    Spacer()
                }
                
                HStack {
                    Text("Timeout:")
                        .frame(width: 120, alignment: .leading)
                    
                    Slider(value: $connectionTimeout, in: 5...60, step: 1)
                        .frame(width: 200)
                    
                    Text("\(connectionTimeout, specifier: "%.0f")s")
                        .frame(width: 40)
                    
                    Spacer()
                }
                
                HStack {
                    Text("Auto Reconnect:")
                        .frame(width: 120, alignment: .leading)
                    
                    Toggle("", isOn: $autoReconnect)
                        .toggleStyle(.switch)
                        .help("Automatically reconnect when connection is lost")
                    
                    Spacer()
                }
            }
        }
        .padding()
        .background(.ultraThinMaterial)
        .cornerRadius(12)
    }
    
    // MARK: - Security Section
    
    private var securitySection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Security")
                .font(.headline)
                .fontWeight(.semibold)
            
            VStack(spacing: 12) {
                HStack {
                    Text("API Key:")
                        .frame(width: 120, alignment: .leading)
                    
                    SecureField("Enter API key (optional)", text: $apiKey)
                        .textFieldStyle(.roundedBorder)
                        .help("Optional API key for authentication")
                }
                
                // Custom headers
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text("Custom Headers:")
                            .frame(width: 120, alignment: .leading)
                        
                        Spacer()
                        
                        Button("Add Header") {
                            addCustomHeader()
                        }
                        .buttonStyle(.borderless)
                        .font(.caption)
                    }
                    
                    ForEach(Array(customHeaders.keys.sorted()), id: \.self) { key in
                        CustomHeaderRow(
                            key: key,
                            value: customHeaders[key] ?? "",
                            onUpdate: { newKey, newValue in
                                updateCustomHeader(oldKey: key, newKey: newKey, value: newValue)
                            },
                            onDelete: {
                                deleteCustomHeader(key: key)
                            }
                        )
                    }
                    
                    if customHeaders.isEmpty {
                        Text("No custom headers defined")
                            .font(.caption)
                            .foregroundColor(.secondary)
                            .frame(maxWidth: .infinity, alignment: .center)
                            .padding(.vertical, 8)
                    }
                }
            }
        }
        .padding()
        .background(.ultraThinMaterial)
        .cornerRadius(12)
    }
    
    // MARK: - Advanced Section
    
    private var advancedSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Advanced")
                .font(.headline)
                .fontWeight(.semibold)
            
            VStack(spacing: 12) {
                HStack {
                    Text("Heartbeat:")
                        .frame(width: 120, alignment: .leading)
                    
                    Slider(value: $heartbeatInterval, in: 10...120, step: 5)
                        .frame(width: 200)
                    
                    Text("\(heartbeatInterval, specifier: "%.0f")s")
                        .frame(width: 40)
                    
                    Spacer()
                }
                
                HStack {
                    Text("Max Reconnects:")
                        .frame(width: 120, alignment: .leading)
                    
                    Stepper("\(maxReconnectAttempts)", value: $maxReconnectAttempts, in: 1...50)
                        .frame(width: 150)
                    
                    Spacer()
                }
                
                HStack {
                    Text("Reconnect Delay:")
                        .frame(width: 120, alignment: .leading)
                    
                    Slider(value: $reconnectDelay, in: 1...30, step: 0.5)
                        .frame(width: 200)
                    
                    Text("\(reconnectDelay, specifier: "%.1f")s")
                        .frame(width: 50)
                    
                    Spacer()
                }
            }
        }
        .padding()
        .background(.ultraThinMaterial)
        .cornerRadius(12)
    }
    
    // MARK: - Logging Section
    
    private var loggingSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Logging")
                .font(.headline)
                .fontWeight(.semibold)
            
            VStack(spacing: 12) {
                HStack {
                    Text("Enable Logging:")
                        .frame(width: 120, alignment: .leading)
                    
                    Toggle("", isOn: $enableLogging)
                        .toggleStyle(.switch)
                        .help("Enable connection and message logging")
                    
                    Spacer()
                }
                
                HStack {
                    Text("Log Level:")
                        .frame(width: 120, alignment: .leading)
                    
                    Picker("Log Level", selection: $logLevel) {
                        ForEach(LogLevel.allCases, id: \.self) { level in
                            Text(level.description).tag(level)
                        }
                    }
                    .pickerStyle(.menu)
                    .disabled(!enableLogging)
                    
                    Spacer()
                }
            }
        }
        .padding()
        .background(.ultraThinMaterial)
        .cornerRadius(12)
    }
    
    // MARK: - Connection Test Section
    
    private func connectionTestSection(_ result: ConnectionTestResult) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Connection Test Result")
                .font(.headline)
                .fontWeight(.semibold)
            
            HStack {
                Image(systemName: result.success ? "checkmark.circle.fill" : "xmark.circle.fill")
                    .foregroundColor(result.success ? .green : .red)
                    .font(.title2)
                
                VStack(alignment: .leading, spacing: 4) {
                    Text(result.success ? "Connection Successful" : "Connection Failed")
                        .font(.body)
                        .fontWeight(.medium)
                        .foregroundColor(result.success ? .green : .red)
                    
                    if let message = result.message {
                        Text(message)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    
                    Text("Response time: \(result.responseTime, specifier: "%.0f")ms")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                
                Spacer()
            }
        }
        .padding()
        .background(.ultraThinMaterial)
        .cornerRadius(12)
    }
    
    // MARK: - Helper Functions
    
    private func loadCurrentSettings() {
        // Load current settings from the WebSocket service
        // This would typically read from UserDefaults or service configuration
    }
    
    private func saveSettings() {
        // Save settings and apply them to the WebSocket service
        UserDefaults.standard.set(serverURL, forKey: "orchestration_server_url")
        UserDefaults.standard.set(apiKey, forKey: "orchestration_api_key")
        UserDefaults.standard.set(useSSL, forKey: "orchestration_use_ssl")
        UserDefaults.standard.set(connectionTimeout, forKey: "orchestration_timeout")
        UserDefaults.standard.set(heartbeatInterval, forKey: "orchestration_heartbeat")
        UserDefaults.standard.set(maxReconnectAttempts, forKey: "orchestration_max_reconnects")
        UserDefaults.standard.set(reconnectDelay, forKey: "orchestration_reconnect_delay")
        UserDefaults.standard.set(autoReconnect, forKey: "orchestration_auto_reconnect")
        UserDefaults.standard.set(enableLogging, forKey: "orchestration_enable_logging")
        
        // Apply settings to the WebSocket service
        // webSocketService.updateSettings(...)
        
        dismiss()
    }
    
    private func testConnection() {
        showTestConnection = true
        
        Task {
            let startTime = Date()
            
            // Simulate connection test
            try? await Task.sleep(nanoseconds: 1_000_000_000) // 1 second
            
            let responseTime = Date().timeIntervalSince(startTime) * 1000 // Convert to ms
            let success = serverURL.contains("localhost") || serverURL.contains("127.0.0.1")
            
            await MainActor.run {
                testConnectionResult = ConnectionTestResult(
                    success: success,
                    responseTime: responseTime,
                    message: success ? "Successfully connected to orchestration service" : "Unable to reach server at \(serverURL)"
                )
                showTestConnection = false
            }
        }
    }
    
    private func addCustomHeader() {
        let newKey = "X-Custom-Header-\(customHeaders.count + 1)"
        customHeaders[newKey] = ""
    }
    
    private func updateCustomHeader(oldKey: String, newKey: String, value: String) {
        customHeaders.removeValue(forKey: oldKey)
        customHeaders[newKey] = value
    }
    
    private func deleteCustomHeader(key: String) {
        customHeaders.removeValue(forKey: key)
    }
}

// MARK: - Supporting Views

struct CustomHeaderRow: View {
    let key: String
    let value: String
    let onUpdate: (String, String) -> Void
    let onDelete: () -> Void
    
    @State private var editingKey: String
    @State private var editingValue: String
    
    init(key: String, value: String, onUpdate: @escaping (String, String) -> Void, onDelete: @escaping () -> Void) {
        self.key = key
        self.value = value
        self.onUpdate = onUpdate
        self.onDelete = onDelete
        self._editingKey = State(initialValue: key)
        self._editingValue = State(initialValue: value)
    }
    
    var body: some View {
        HStack(spacing: 8) {
            TextField("Header name", text: $editingKey)
                .textFieldStyle(.roundedBorder)
                .frame(width: 150)
                .onChange(of: editingKey) { _ in
                    onUpdate(editingKey, editingValue)
                }
            
            TextField("Header value", text: $editingValue)
                .textFieldStyle(.roundedBorder)
                .onChange(of: editingValue) { _ in
                    onUpdate(editingKey, editingValue)
                }
            
            Button(action: onDelete) {
                Image(systemName: "trash")
                    .foregroundColor(.red)
            }
            .buttonStyle(.borderless)
            .help("Delete header")
        }
    }
}

// MARK: - Supporting Types

struct ConnectionTestResult {
    let success: Bool
    let responseTime: TimeInterval
    let message: String?
}

#Preview {
    struct PreviewWrapper: View {
        @StateObject private var service = AgentWebSocketService()
        
        var body: some View {
            ConnectionSettingsView()
                .environmentObject(service)
        }
    }
    
    return PreviewWrapper()
        .frame(width: 600, height: 700)
}