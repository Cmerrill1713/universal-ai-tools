import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var apiService: APIService

    @State private var selectedTab = "General"
    private let tabs = ["General", "Connection", "AI Models", "Security", "Advanced"]

    var body: some View {
        TabView(selection: $selectedTab) {
            GeneralSettingsView()
                .tabItem {
                    Image(systemName: "gear")
                    Text("General")
                }
                .tag("General")

            ConnectionSettingsView()
                .tabItem {
                    Image(systemName: "network")
                    Text("Connection")
                }
                .tag("Connection")

            AIModelsSettingsView()
                .tabItem {
                    Image(systemName: "cpu")
                    Text("AI Models")
                }
                .tag("AI Models")

            SecuritySettingsView()
                .tabItem {
                    Image(systemName: "lock")
                    Text("Security")
                }
                .tag("Security")

            AdvancedSettingsView()
                .tabItem {
                    Image(systemName: "slider.horizontal.3")
                    Text("Advanced")
                }
                .tag("Advanced")
        }
        .frame(width: 600, height: 500)
    }
}

struct GeneralSettingsView: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        VStack(spacing: 20) {
            Text("General Settings")
                .font(.title2)
                .fontWeight(.bold)

            VStack(spacing: 16) {
                Toggle("Dark Mode", isOn: $appState.darkMode)
                Toggle("Show Sidebar", isOn: $appState.sidebarVisible)
                Toggle("Show Notifications", isOn: .constant(true))
                Toggle("Auto-start with System", isOn: .constant(false))

                Picker("Default View Mode", selection: $appState.viewMode) {
                    Text("Web").tag(ViewMode.webView)
                    Text("Native").tag(ViewMode.native)
                    Text("Hybrid").tag(ViewMode.hybrid)
                }
                .pickerStyle(SegmentedPickerStyle())
            }
            .padding()
            .background(Color(NSColor.controlBackgroundColor))
            .cornerRadius(8)

            Spacer()
        }
        .padding()
    }
}

struct ConnectionSettingsView: View {
    @EnvironmentObject var apiService: APIService
    @State private var backendURL = "http://localhost:9999"
    @State private var autoReconnect = true
    @State private var connectionTimeout = 30.0

    var body: some View {
        VStack(spacing: 20) {
            Text("Connection Settings")
                .font(.title2)
                .fontWeight(.bold)

            VStack(spacing: 16) {
                HStack {
                    Text("Backend URL:")
                    Spacer()
                    TextField("URL", text: $backendURL)
                        .textFieldStyle(RoundedBorderTextFieldStyle())
                        .frame(width: 200)
                }

                Toggle("Auto Reconnect", isOn: $autoReconnect)
                Toggle("WebSocket Connection", isOn: .constant(true))

                HStack {
                    Text("Connection Timeout:")
                    Spacer()
                    Text("\(Int(connectionTimeout))s")
                    Slider(value: $connectionTimeout, in: 5...60, step: 5)
                        .frame(width: 100)
                }

                HStack {
                    Text("Status:")
                    Spacer()
                    Text("Connected")
                        .foregroundColor(.green)
                }
            }
            .padding()
            .background(Color(NSColor.controlBackgroundColor))
            .cornerRadius(8)

            Spacer()
        }
        .padding()
    }
}

struct AIModelsSettingsView: View {
    @State private var selectedModel = "gpt-4"
    @State private var temperature = 0.7
    @State private var maxTokens = 2048

    private let models = ["gpt-4", "gpt-3.5-turbo", "claude-3", "llama-2"]

    var body: some View {
        VStack(spacing: 20) {
            Text("AI Model Settings")
                .font(.title2)
                .fontWeight(.bold)

            VStack(spacing: 16) {
                HStack {
                    Text("Default Model:")
                    Spacer()
                    Picker("Model", selection: $selectedModel) {
                        ForEach(models, id: \.self) { model in
                            Text(model).tag(model)
                        }
                    }
                    .pickerStyle(MenuPickerStyle())
                    .frame(width: 150)
                }

                HStack {
                    Text("Temperature:")
                    Spacer()
                    Text(String(format: "%.1f", temperature))
                    Slider(value: $temperature, in: 0...2, step: 0.1)
                        .frame(width: 100)
                }

                HStack {
                    Text("Max Tokens:")
                    Spacer()
                    Text("\(maxTokens)")
                    Slider(value: .constant(Double(maxTokens)), in: 100...4096, step: 100)
                        .frame(width: 100)
                }

                Toggle("Use Local Models", isOn: .constant(false))
                Toggle("Enable Model Caching", isOn: .constant(true))
            }
            .padding()
            .background(Color(NSColor.controlBackgroundColor))
            .cornerRadius(8)

            Spacer()
        }
        .padding()
    }
}

struct SecuritySettingsView: View {
    @State private var enableEncryption = true
    @State private var requireAuthentication = true
    @State private var sessionTimeout = 3600.0

    var body: some View {
        VStack(spacing: 20) {
            Text("Security Settings")
                .font(.title2)
                .fontWeight(.bold)

            VStack(spacing: 16) {
                Toggle("Enable Encryption", isOn: $enableEncryption)
                Toggle("Require Authentication", isOn: $requireAuthentication)
                Toggle("Auto-lock on Sleep", isOn: .constant(true))

                HStack {
                    Text("Session Timeout:")
                    Spacer()
                    Text("\(Int(sessionTimeout / 60)) minutes")
                    Slider(value: $sessionTimeout, in: 300...7200, step: 300)
                        .frame(width: 100)
                }

                Button("Change Password") {
                    // Change password action
                }
                .buttonStyle(.bordered)

                Button("Clear All Data") {
                    // Clear data action
                }
                .buttonStyle(.bordered)
                .foregroundColor(.red)
            }
            .padding()
            .background(Color(NSColor.controlBackgroundColor))
            .cornerRadius(8)

            Spacer()
        }
        .padding()
    }
}

struct AdvancedSettingsView: View {
    @State private var enableDebugMode = false
    @State private var logLevel = "Info"
    @State private var enableTelemetry = false

    private let logLevels = ["Debug", "Info", "Warning", "Error"]

    var body: some View {
        VStack(spacing: 20) {
            Text("Advanced Settings")
                .font(.title2)
                .fontWeight(.bold)

            VStack(spacing: 16) {
                Toggle("Debug Mode", isOn: $enableDebugMode)
                Toggle("Enable Telemetry", isOn: $enableTelemetry)
                Toggle("Auto-update", isOn: .constant(true))

                HStack {
                    Text("Log Level:")
                    Spacer()
                    Picker("Log Level", selection: $logLevel) {
                        ForEach(logLevels, id: \.self) { level in
                            Text(level).tag(level)
                        }
                    }
                    .pickerStyle(MenuPickerStyle())
                    .frame(width: 100)
                }

                Button("Export Logs") {
                    // Export logs action
                }
                .buttonStyle(.bordered)

                Button("Reset to Defaults") {
                    // Reset action
                }
                .buttonStyle(.bordered)
            }
            .padding()
            .background(Color(NSColor.controlBackgroundColor))
            .cornerRadius(8)

            Spacer()
        }
        .padding()
    }
}

#Preview {
    SettingsView()
        .environmentObject(AppState())
        .environmentObject(APIService())
}
