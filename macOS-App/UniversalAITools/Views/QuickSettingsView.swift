import SwiftUI

struct QuickSettingsView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var apiService: APIService

    @State private var backendURL = "http://localhost:9999"
    @State private var autoReconnect = true
    @State private var showNotifications = true
    @State private var enableWebSocket = true

    var body: some View {
        VStack(spacing: 20) {
            // Header
            HStack {
                Text("Quick Settings")
                    .font(.headline)
                Spacer()
                Button("Done") {
                    appState.showSettings = false
                }
                .buttonStyle(.borderless)
            }

            Divider()

            // Connection Settings
            connectionSettingsSection

            Divider()

            // Appearance Settings
            appearanceSettingsSection

            Divider()

            // Notification Settings
            notificationSettingsSection

            Spacer()

            // Actions
            actionsSection
        }
        .padding()
        .frame(width: 350, height: 400)
        .onAppear {
            // Load effective backend URL from persisted settings
            backendURL = UserDefaults.standard.string(forKey: "BackendURL") ?? backendURL
        }
    }

    private var connectionSettingsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Connection")
                .font(.subheadline)
                .fontWeight(.semibold)

            VStack(spacing: 8) {
                HStack {
                    Text("Backend URL:")
                    Spacer()
                    TextField("URL", text: $backendURL)
                        .textFieldStyle(RoundedBorderTextFieldStyle())
                        .frame(width: 150)
                        .onSubmit {
                            applyBackendURL()
                        }
                }

                Toggle("Auto Reconnect", isOn: $autoReconnect)
                Toggle("WebSocket Connection", isOn: $enableWebSocket)

                HStack {
                    Text("Status:")
                    Spacer()
                    Text(appState.backendConnected ? "Connected" : "Disconnected")
                        .foregroundColor(appState.backendConnected ? .green : .red)
                }
            }
        }
    }

    private var appearanceSettingsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Appearance")
                .font(.subheadline)
                .fontWeight(.semibold)

            VStack(spacing: 8) {
                Toggle("Dark Mode", isOn: $appState.darkMode)
                Toggle("Show Sidebar", isOn: $appState.sidebarVisible)

                Picker("Default View Mode", selection: $appState.viewMode) {
                    Text("Web").tag(ViewMode.webView)
                    Text("Native").tag(ViewMode.native)
                    Text("Hybrid").tag(ViewMode.hybrid)
                }
                .pickerStyle(SegmentedPickerStyle())
            }
        }
    }

    private var notificationSettingsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Notifications")
                .font(.subheadline)
                .fontWeight(.semibold)

            VStack(spacing: 8) {
                Toggle("Show Notifications", isOn: $showNotifications)
                Toggle("Connection Alerts", isOn: .constant(true))
                Toggle("Agent Status Updates", isOn: .constant(true))
                Toggle("System Alerts", isOn: .constant(true))
            }
        }
    }

    private var actionsSection: some View {
        VStack(spacing: 10) {
            Button("Save & Reconnect") {
                applyBackendURL()
            }
            .buttonStyle(.borderedProminent)

            Button("Test Connection") {
                Task { await apiService.connectToBackend() }
            }
            .buttonStyle(.bordered)

            Button("Reset to Defaults") {
                resetToDefaults()
            }
            .buttonStyle(.bordered)

            Button("Open Full Settings") {
                // Open full settings window
            }
            .buttonStyle(.borderless)
            .font(.caption)
        }
    }

    private func resetToDefaults() {
        appState.darkMode = true
        appState.sidebarVisible = true
        appState.viewMode = .native
        backendURL = "http://localhost:9999"
        autoReconnect = true
        showNotifications = true
        enableWebSocket = true
    }

    private func applyBackendURL() {
        apiService.setBackendURL(backendURL)
        UserDefaults.standard.set(backendURL, forKey: "BackendURL")
        Task { await apiService.connectToBackend() }
        appState.showNotification(message: "Backend URL applied: \(backendURL)", type: .success)
    }
}

#Preview {
    QuickSettingsView()
        .environmentObject(AppState())
        .environmentObject(APIService())
}
