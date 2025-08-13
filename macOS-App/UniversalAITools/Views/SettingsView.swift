import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var apiService: APIService

    @State private var selectedTab = "General"
    private let tabs = ["General", "Connection", "AI Models", "Security", "Advanced"]

    var body: some View {
        ZStack {
            AnimatedGradientBackground()
                .trackPerformance("SettingsBackgroundGradient")
                .ignoresSafeArea()

            VStack(spacing: 0) {
                // Header with Done button
                HStack {
                    Spacer()
                    Button("Done") {
                        appState.showSettings = false
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                }
                .padding()
                .background(.ultraThinMaterial)

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
            }
        }
        .frame(width: 600, height: 500)
        .glassMorphism(cornerRadius: 0)
    }
}

struct GeneralSettingsView: View {
    @EnvironmentObject var appState: AppState
    @AppStorage("showNotifications") private var showNotifications = true
    @AppStorage("autoStartWithSystem") private var autoStartWithSystem = false

    var body: some View {
        VStack(spacing: 20) {
            Text("General Settings")
                .font(.title2)
                .fontWeight(.bold)

            VStack(spacing: 16) {
                Toggle("Dark Mode", isOn: $appState.darkMode)
                    .onChange(of: appState.darkMode) { newValue in
                        UserDefaults.standard.set(newValue, forKey: "darkMode")
                        NSApplication.shared.appearance = NSAppearance(named: newValue ? .darkAqua : .aqua)
                    }
                Toggle("Show Sidebar", isOn: $appState.sidebarVisible)
                    .onChange(of: appState.sidebarVisible) { newValue in
                        UserDefaults.standard.set(newValue, forKey: "sidebarVisible")
                    }
                Toggle("Show Notifications", isOn: $showNotifications)
                Toggle("Auto-start with System", isOn: $autoStartWithSystem)

                Picker("Default View Mode", selection: $appState.viewMode) {
                    Text("Web").tag(ViewMode.webView)
                    Text("Native").tag(ViewMode.native)
                    Text("Hybrid").tag(ViewMode.hybrid)
                }
                .pickerStyle(SegmentedPickerStyle())
                .onChange(of: appState.viewMode) { newValue in
                    UserDefaults.standard.set(String(describing: newValue), forKey: "viewMode")
                }
            }
            .padding()
            .glassMorphism(cornerRadius: 12)

            Spacer()
        }
        .padding()
    }
}

struct ConnectionSettingsView: View {
    @EnvironmentObject var apiService: APIService
    @AppStorage("BackendURL") private var backendURL = "http://localhost:9999"
    @AppStorage("FrontendURL") private var frontendURL = "http://localhost:5173"
    @AppStorage("autoReconnect") private var autoReconnect = true
    @AppStorage("connectionTimeout") private var connectionTimeout = 30.0
    @AppStorage("enableWebSocket") private var enableWebSocket = true
    @State private var statusText = "Checking…"
    @State private var statusColor = Color.secondary

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
                        .frame(width: 280)
                        .onSubmit { saveBackend() }
                        .onChange(of: backendURL) { _ in
                            saveBackend()
                        }
                }

                HStack {
                    Text("Frontend URL:")
                    Spacer()
                    TextField("URL", text: $frontendURL)
                        .textFieldStyle(RoundedBorderTextFieldStyle())
                        .frame(width: 280)
                        .onChange(of: frontendURL) { _ in
                            // Automatically saved via @AppStorage
                        }
                }

                Toggle("Auto Reconnect", isOn: $autoReconnect)
                Toggle("WebSocket Connection", isOn: $enableWebSocket)

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
                    Text(statusText)
                        .foregroundColor(statusColor)
                }

                HStack(spacing: 12) {
                    Button("Save & Test") {
                        saveBackend()
                        saveFrontend()
                        Task { await probeHealth() }
                    }
                    Button("Retry Connect") {
                        Task { await apiService.connectToBackend(); await probeHealth() }
                    }
                }
            }
            .padding()
            .glassMorphism(cornerRadius: 12)

            Spacer()
        }
        .padding()
        .task { await probeHealth() }
    }

    private func saveBackend() {
        UserDefaults.standard.set(backendURL, forKey: "BackendURL")
        apiService.setBackendURL(backendURL)
    }

    private func saveFrontend() {
        UserDefaults.standard.set(frontendURL, forKey: "FrontendURL")
    }

    private func probeHealth() async {
        do {
            let healthy = try await apiService.performHealthProbe()
            await MainActor.run {
                statusText = healthy ? "Connected" : "Offline"
                statusColor = healthy ? AppTheme.accentOrange : .red
            }
        } catch {
            await MainActor.run {
                statusText = "Error"
                statusColor = AppTheme.accentBlue
            }
        }
    }
}

struct AIModelsSettingsView: View {
    @AppStorage("defaultModel") private var selectedModel = "llama3.2:3b"
    @AppStorage("modelTemperature") private var temperature = 0.7
    @AppStorage("maxTokens") private var maxTokens = 2048.0
    @AppStorage("useLocalModels") private var useLocalModels = false
    @AppStorage("enableModelCaching") private var enableModelCaching = true

    private let models = ["tinyllama:latest", "gpt-oss:20b", "llama3.2:3b", "phi3:mini", "mistral:7b"]

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
                    Text("\(Int(maxTokens))")
                    Slider(value: $maxTokens, in: 100...4096, step: 100)
                        .frame(width: 100)
                }

                Toggle("Use Local Models", isOn: $useLocalModels)
                Toggle("Enable Model Caching", isOn: $enableModelCaching)
            }
            .padding()
            .glassMorphism(cornerRadius: 12)

            Spacer()
        }
        .padding()
    }
}

struct SecuritySettingsView: View {
    @StateObject private var keyManager = SecureKeyManager.shared
    @AppStorage("enableEncryption") private var enableEncryption = true
    @AppStorage("requireAuthentication") private var requireAuthentication = true
    @AppStorage("sessionTimeout") private var sessionTimeout = 3600.0
    @AppStorage("autoLockOnSleep") private var autoLockOnSleep = true

    @State private var showingKeyForm = false
    @State private var selectedService = ""
    @State private var newAPIKey = ""
    @State private var isRefreshing = false
    @State private var showingDeleteConfirmation = false
    @State private var serviceToDelete = ""

    var body: some View {
        VStack(spacing: 20) {
            Text("Security & API Keys")
                .font(.title2)
                .fontWeight(.bold)

            // Security Settings Section
            VStack(spacing: 16) {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Security Settings")
                            .font(.headline)
                        Text("General security and authentication options")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    Spacer()
                }

                Toggle("Enable Encryption", isOn: $enableEncryption)
                Toggle("Require Authentication", isOn: $requireAuthentication)
                Toggle("Auto-lock on Sleep", isOn: $autoLockOnSleep)

                HStack {
                    Text("Session Timeout:")
                    Spacer()
                    Text("\(Int(sessionTimeout / 60)) minutes")
                    Slider(value: $sessionTimeout, in: 300...7200, step: 300)
                        .frame(width: 100)
                }
            }
            .padding()
            .glassMorphism(cornerRadius: 12)

            // API Key Management Section
            VStack(spacing: 16) {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text("API Key Management")
                                .font(.headline)
                            if keyManager.isVaultConnected {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundColor(.green)
                                    .help("Connected to Vault")
                            } else {
                                Image(systemName: "exclamationmark.triangle.fill")
                                    .foregroundColor(.orange)
                                    .help("Vault offline - using local storage only")
                            }
                        }
                        Text("Secure storage in Keychain and encrypted cloud Vault")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    Spacer()

                    HStack(spacing: 8) {
                        Button {
                            Task { await refreshKeys() }
                        } label: {
                            Image(systemName: "arrow.clockwise")
                        }
                        .disabled(isRefreshing)

                        Button("Add Key") {
                            selectedService = ""
                            newAPIKey = ""
                            showingKeyForm = true
                        }
                        .buttonStyle(.borderedProminent)
                    }
                }

                if keyManager.keyStatuses.isEmpty {
                    VStack(spacing: 12) {
                        Image(systemName: "key.fill")
                            .font(.system(size: 40))
                            .foregroundColor(.secondary)
                        Text("No API keys configured")
                            .font(.headline)
                            .foregroundColor(.secondary)
                        Text("Add your first API key to get started")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    .padding(.vertical, 20)
                } else {
                    LazyVStack(spacing: 8) {
                        ForEach(Array(keyManager.keyStatuses.keys.sorted()), id: \.self) { service in
                            if let keyInfo = keyManager.keyStatuses[service] {
                                KeyStatusRow(
                                    service: service,
                                    keyInfo: keyInfo,
                                    onEdit: {
                                        selectedService = service
                                        showingKeyForm = true
                                    },
                                    onDelete: {
                                        serviceToDelete = service
                                        showingDeleteConfirmation = true
                                    }
                                )
                            }
                        }
                    }
                }

                if let lastSync = keyManager.lastSyncTime {
                    HStack {
                        Text("Last sync: \(lastSync.formatted(date: .omitted, time: .shortened))")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        Spacer()
                        Button("Sync Now") {
                            Task { await keyManager.syncAllKeys() }
                        }
                        .font(.caption)
                        .disabled(!keyManager.isVaultConnected)
                    }
                }
            }
            .padding()
            .glassMorphism(cornerRadius: 12)

            // Danger Zone
            VStack(spacing: 12) {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Danger Zone")
                            .font(.headline)
                            .foregroundColor(.red)
                        Text("Irreversible actions - use with caution")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    Spacer()
                }

                Button("Clear All API Keys") {
                    Task { await keyManager.clearAllKeys() }
                }
                .buttonStyle(.bordered)
                .foregroundColor(.red)
            }
            .padding()
            .glassMorphism(cornerRadius: 12)

            Spacer()
        }
        .padding()
        .sheet(isPresented: $showingKeyForm) {
            KeyManagementFormView(
                selectedService: $selectedService,
                newAPIKey: $newAPIKey,
                isPresented: $showingKeyForm,
                keyManager: keyManager
            )
        }
        .alert("Delete API Key", isPresented: $showingDeleteConfirmation) {
            Button("Cancel", role: .cancel) { }
            Button("Delete", role: .destructive) {
                Task {
                    _ = await keyManager.removeKey(for: serviceToDelete)
                    serviceToDelete = ""
                }
            }
        } message: {
            Text("Are you sure you want to delete the API key for \(serviceToDelete)? This action cannot be undone.")
        }
        .task {
            await refreshKeys()
        }
    }

    private func refreshKeys() async {
        isRefreshing = true
        await keyManager.refreshKeyStatuses()
        isRefreshing = false
    }
}

struct KeyStatusRow: View {
    let service: String
    let keyInfo: KeyInfo
    let onEdit: () -> Void
    let onDelete: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            // Service icon and name
            VStack(alignment: .leading, spacing: 2) {
                HStack {
                    serviceIcon(for: service)
                    Text(service.replacingOccurrences(of: "_", with: " ").capitalized)
                        .font(.headline)
                }
                Text(statusDescription)
                    .font(.caption)
                    .foregroundColor(statusColor)
            }

            Spacer()

            // Storage status indicators
            HStack(spacing: 6) {
                StorageIndicator(
                    type: "Keychain",
                    hasValue: keyInfo.hasKeychainValue,
                    icon: "key.fill"
                )
                StorageIndicator(
                    type: "Vault",
                    hasValue: keyInfo.hasVaultValue,
                    icon: "lock.shield.fill"
                )
            }

            // Actions
            HStack(spacing: 4) {
                Button {
                    onEdit()
                } label: {
                    Image(systemName: "pencil")
                        .font(.caption)
                }
                .buttonStyle(.borderless)

                Button {
                    onDelete()
                } label: {
                    Image(systemName: "trash")
                        .font(.caption)
                }
                .buttonStyle(.borderless)
                .foregroundColor(.red)
            }
        }
        .padding(.vertical, 8)
        .padding(.horizontal, 12)
        .background(Color.primary.opacity(0.05))
        .cornerRadius(8)
    }

    private func serviceIcon(for service: String) -> some View {
        let iconName: String
        let color: Color

        switch service {
        case "universal_ai_backend":
            iconName = "server.rack"
            color = .blue
        case "openai":
            iconName = "brain"
            color = .green
        case "anthropic":
            iconName = "cpu"
            color = .orange
        case "google_ai":
            iconName = "globe"
            color = .red
        case "huggingface":
            iconName = "face.smiling"
            color = .yellow
        case "lm_studio", "ollama":
            iconName = "desktopcomputer"
            color = .purple
        default:
            iconName = "key.fill"
            color = .secondary
        }

        return Image(systemName: iconName)
            .foregroundColor(color)
            .font(.title3)
    }

    private var statusDescription: String {
        switch keyInfo.syncStatus {
        case .synced:
            return "Synced across all storage"
        case .keychainOnly:
            return "Stored locally only"
        case .vaultOnly:
            return "Available in cloud only"
        case .conflict:
            return "Sync conflict detected"
        case .missing:
            return "No key configured"
        }
    }

    private var statusColor: Color {
        switch keyInfo.syncStatus {
        case .synced:
            return .green
        case .keychainOnly, .vaultOnly:
            return .orange
        case .conflict:
            return .red
        case .missing:
            return .secondary
        }
    }
}

struct StorageIndicator: View {
    let type: String
    let hasValue: Bool
    let icon: String

    var body: some View {
        VStack(spacing: 2) {
            Image(systemName: icon)
                .font(.caption)
                .foregroundColor(hasValue ? .green : .secondary)
            Text(type)
                .font(.system(size: 9))
                .foregroundColor(.secondary)
        }
        .help("\(type): \(hasValue ? "Configured" : "Not configured")")
    }
}

struct KeyManagementFormView: View {
    @Binding var selectedService: String
    @Binding var newAPIKey: String
    @Binding var isPresented: Bool
    let keyManager: SecureKeyManager

    @State private var isSaving = false
    @State private var saveError: String?

    private let availableServices = [
        "universal_ai_backend": "Universal AI Backend",
        "openai": "OpenAI",
        "anthropic": "Anthropic (Claude)",
        "google_ai": "Google AI",
        "huggingface": "Hugging Face",
        "lm_studio": "LM Studio",
        "ollama": "Ollama"
    ]

    var body: some View {
        VStack(spacing: 20) {
            Text(selectedService.isEmpty ? "Add API Key" : "Edit API Key")
                .font(.title2)
                .fontWeight(.bold)

            VStack(spacing: 16) {
                if selectedService.isEmpty {
                    Picker("Service", selection: $selectedService) {
                        Text("Select a service...").tag("")
                        ForEach(Array(availableServices.keys.sorted()), id: \.self) { key in
                            Text(availableServices[key] ?? key).tag(key)
                        }
                    }
                    .pickerStyle(.menu)
                }

                SecureField("API Key", text: $newAPIKey)
                    .textFieldStyle(.roundedBorder)

                if let error = saveError {
                    Text(error)
                        .foregroundColor(.red)
                        .font(.caption)
                }
            }

            HStack(spacing: 12) {
                Button("Cancel") {
                    isPresented = false
                }
                .buttonStyle(.bordered)

                Button(selectedService.isEmpty ? "Add" : "Update") {
                    Task { await saveKey() }
                }
                .buttonStyle(.borderedProminent)
                .disabled(selectedService.isEmpty || newAPIKey.isEmpty || isSaving)
            }

            Spacer()
        }
        .padding()
        .frame(width: 400, height: 300)
    }

    private func saveKey() async {
        guard !selectedService.isEmpty && !newAPIKey.isEmpty else { return }

        isSaving = true
        saveError = nil

        let success = await keyManager.storeKey(for: selectedService, key: newAPIKey)

        if success {
            isPresented = false
        } else {
            saveError = "Failed to save API key. Please try again."
        }

        isSaving = false
    }
}

struct AdvancedSettingsView: View {
    @EnvironmentObject var appState: AppState
    @AppStorage("enableDebugMode") private var enableDebugMode = false
    @AppStorage("logLevel") private var logLevel = "Info"
    @AppStorage("enableTelemetry") private var enableTelemetry = false
    @AppStorage("autoUpdate") private var autoUpdate = true

    private let logLevels = ["Debug", "Info", "Warning", "Error"]

    var body: some View {
        VStack(spacing: 20) {
            Text("Advanced Settings")
                .font(.title2)
                .fontWeight(.bold)

            VStack(spacing: 16) {
                Toggle("Debug Mode", isOn: $enableDebugMode)
                Toggle("Enable Telemetry", isOn: $enableTelemetry)
                Toggle("Auto-update", isOn: $autoUpdate)

                HStack {
                    Text("Log Level:")
                    Spacer()
                    Picker("Log Level", selection: $logLevel) {
                        ForEach(logLevels, id: \.self) { level in
                            Text(level).tag(level)
                        }
                    }
                    .pickerStyle(.menu)
                    .frame(width: 120)
                    .fixedSize()
                }

                Button("Export Logs") {
                    // Export logs action
                }
                .buttonStyle(.bordered)

                Button("Reset to Defaults") {
                    resetToDefaults()
                }
                .buttonStyle(.bordered)

                Divider()

                Button("Export Chat History") {
                    exportChatHistory()
                }
                .buttonStyle(.bordered)

                Button("Export Settings") {
                    exportSettings()
                }
                .buttonStyle(.bordered)
            }
            .padding()
            .glassMorphism(cornerRadius: 12)

            Spacer()
        }
        .padding()
    }

    private func exportChatHistory() {
        let content = appState.exportChatHistory()
        appState.saveToFile(content: content, filename: "chat-history-\(Date().formatted(date: .numeric, time: .omitted)).json")
    }

    private func exportSettings() {
        // Export app settings as JSON
        let settings = [
            "darkMode": appState.darkMode,
            "viewMode": String(describing: appState.viewMode),
            "sidebarVisible": appState.sidebarVisible
        ] as [String: Any]

        do {
            let data = try JSONSerialization.data(withJSONObject: settings, options: .prettyPrinted)
            let content = String(data: data, encoding: .utf8) ?? "{}"
            appState.saveToFile(content: content, filename: "settings-\(Date().formatted(date: .numeric, time: .omitted)).json")
        } catch {
            appState.showNotification(message: "Failed to export settings: \(error.localizedDescription)", type: NotificationType.error)
        }
    }

    private func resetToDefaults() {
        enableDebugMode = false
        logLevel = "Info"
        enableTelemetry = false
        autoUpdate = true
    }
}

#Preview {
    SettingsView()
        .environmentObject(AppState())
        .environmentObject(APIService())
}
