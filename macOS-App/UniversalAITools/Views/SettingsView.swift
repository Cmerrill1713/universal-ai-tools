import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var apiService: APIService

    @State private var selectedTab = "General"
    private let tabs = ["General", "Connection", "AI Models", "Security", "Advanced"]

    var body: some View {
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
                ScrollView {
                    GeneralSettingsView()
                        .padding(.bottom, 20)
                }
                .tabItem {
                    Image(systemName: "gear")
                    Text("General")
                }
                .tag("General")

                ScrollView {
                    ConnectionSettingsView()
                        .padding(.bottom, 20)
                }
                .tabItem {
                    Image(systemName: "network")
                    Text("Connection")
                }
                .tag("Connection")

                ScrollView {
                    AIModelsSettingsView()
                        .padding(.bottom, 20)
                }
                .tabItem {
                    Image(systemName: "cpu")
                    Text("AI Models")
                }
                .tag("AI Models")

                ScrollView {
                    SecuritySettingsView()
                        .padding(.bottom, 20)
                }
                .tabItem {
                    Image(systemName: "lock")
                    Text("Security")
                }
                .tag("Security")

                ScrollView {
                    AdvancedSettingsView()
                        .padding(.bottom, 20)
                }
                .tabItem {
                    Image(systemName: "slider.horizontal.3")
                    Text("Advanced")
                }
                .tag("Advanced")
            }
        }
        .frame(minWidth: 600, minHeight: 500)
        .frame(maxWidth: 800, maxHeight: 700)
        .background(AnimatedGradientBackground())
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
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .top)
    }
}

struct ConnectionSettingsView: View {
    @EnvironmentObject var apiService: APIService
    @AppStorage("BackendURL") private var backendURL = "http://localhost:9998"
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
                    Button("Test Chat") {
                        Task { await apiService.testChatFunctionality() }
                    }
                    .foregroundColor(.orange)
                }
            }
            .padding()
            .glassMorphism(cornerRadius: 12)

        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .top)
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
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .top)
    }
}

// MARK: - Service Configuration Types
enum ServiceType {
    case cloud
    case local
}

struct ServiceConfig {
    let id: String
    let displayName: String
    let type: ServiceType
    let defaultEndpoint: String?
    let iconName: String
    let color: Color
}

struct SecuritySettingsView: View {
    @EnvironmentObject var apiService: APIService
    @StateObject private var keyManager = SecureKeyManager.shared
    @AppStorage("enableEncryption") private var enableEncryption = true
    @AppStorage("requireAuthentication") private var requireAuthentication = true
    @AppStorage("sessionTimeout") private var sessionTimeout = 3600.0
    @AppStorage("autoLockOnSleep") private var autoLockOnSleep = true

    // Local service endpoints
    @AppStorage("ollamaEndpoint") private var ollamaEndpoint = "http://localhost:11434"
    @AppStorage("lmStudioEndpoint") private var lmStudioEndpoint = "http://localhost:1234/v1"
    
    @State private var showingKeyForm = false
    @State private var showingLocalServiceForm = false
    @State private var selectedService = ""
    @State private var newAPIKey = ""
    @State private var selectedLocalService = ""
    @State private var newEndpoint = ""
    @State private var isRefreshing = false
    @State private var showingDeleteConfirmation = false
    @State private var serviceToDelete = ""

    private let serviceConfigs: [String: ServiceConfig] = [
        // Cloud Services (require API keys)
        "universal_ai_backend": ServiceConfig(
            id: "universal_ai_backend",
            displayName: "Universal AI Backend",
            type: .cloud,
            defaultEndpoint: nil,
            iconName: "server.rack",
            color: .blue
        ),
        "openai": ServiceConfig(
            id: "openai",
            displayName: "OpenAI",
            type: .cloud,
            defaultEndpoint: nil,
            iconName: "brain",
            color: .green
        ),
        "anthropic": ServiceConfig(
            id: "anthropic",
            displayName: "Anthropic (Claude)",
            type: .cloud,
            defaultEndpoint: nil,
            iconName: "cpu",
            color: .orange
        ),
        "google_ai": ServiceConfig(
            id: "google_ai",
            displayName: "Google AI",
            type: .cloud,
            defaultEndpoint: nil,
            iconName: "globe",
            color: .red
        ),
        "huggingface": ServiceConfig(
            id: "huggingface",
            displayName: "Hugging Face",
            type: .cloud,
            defaultEndpoint: nil,
            iconName: "face.smiling",
            color: .yellow
        ),
        // Local Services (require endpoint configuration)
        "ollama": ServiceConfig(
            id: "ollama",
            displayName: "Ollama",
            type: .local,
            defaultEndpoint: "http://localhost:11434",
            iconName: "desktopcomputer",
            color: .purple
        ),
        "lm_studio": ServiceConfig(
            id: "lm_studio",
            displayName: "LM Studio",
            type: .local,
            defaultEndpoint: "http://localhost:1234/v1",
            iconName: "desktopcomputer",
            color: .purple
        )
    ]

    var cloudServices: [ServiceConfig] {
        serviceConfigs.values.filter { $0.type == .cloud }.sorted { $0.displayName < $1.displayName }
    }

    var localServices: [ServiceConfig] {
        serviceConfigs.values.filter { $0.type == .local }.sorted { $0.displayName < $1.displayName }
    }

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

            // Cloud Services (API Key Management)
            VStack(spacing: 16) {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Image(systemName: "cloud")
                                .foregroundColor(.blue)
                            Text("Cloud AI Services")
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
                        Text("Secure API key storage in Keychain and encrypted cloud Vault")
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

                        Button("Add API Key") {
                            selectedService = ""
                            newAPIKey = ""
                            showingKeyForm = true
                        }
                        .buttonStyle(.borderedProminent)
                    }
                }

                let cloudKeyStatuses = keyManager.keyStatuses.filter { service, _ in
                    cloudServices.contains { $0.id == service }
                }

                if cloudKeyStatuses.isEmpty {
                    VStack(spacing: 12) {
                        Image(systemName: "key.fill")
                            .font(.system(size: 30))
                            .foregroundColor(.secondary)
                        Text("No cloud API keys configured")
                            .font(.headline)
                            .foregroundColor(.secondary)
                        Text("Add API keys for cloud AI services")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    .padding(.vertical, 16)
                } else {
                    LazyVStack(spacing: 8) {
                        ForEach(Array(cloudKeyStatuses.keys.sorted()), id: \.self) { service in
                            if let keyInfo = cloudKeyStatuses[service],
                               let config = serviceConfigs[service] {
                                CloudServiceRow(
                                    config: config,
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

            // Local Services (Endpoint Configuration)
            VStack(spacing: 16) {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Image(systemName: "desktopcomputer")
                                .foregroundColor(.purple)
                            Text("Local AI Services")
                                .font(.headline)
                        }
                        Text("Configure endpoints for locally running AI services")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    Spacer()

                    Button("Configure Service") {
                        selectedLocalService = ""
                        newEndpoint = ""
                        showingLocalServiceForm = true
                    }
                    .buttonStyle(.borderedProminent)
                }

                LazyVStack(spacing: 8) {
                    ForEach(localServices, id: \.id) { config in
                        LocalServiceRow(
                            config: config,
                            endpoint: getEndpointForService(config.id),
                            onEdit: {
                                selectedLocalService = config.id
                                newEndpoint = getEndpointForService(config.id)
                                showingLocalServiceForm = true
                            }
                        )
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

                HStack(spacing: 12) {
                    Button("Clear All API Keys") {
                        Task { await keyManager.clearAllKeys() }
                    }
                    .buttonStyle(.bordered)
                    .foregroundColor(.red)
                    
                    Button("Force Reauth") {
                        Task { await apiService.forceReauthentication() }
                    }
                    .buttonStyle(.bordered)
                    .foregroundColor(.orange)
                }
            }
            .padding()
            .glassMorphism(cornerRadius: 12)
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .top)
        .sheet(isPresented: $showingKeyForm) {
            CloudKeyManagementFormView(
                selectedService: $selectedService,
                newAPIKey: $newAPIKey,
                isPresented: $showingKeyForm,
                keyManager: keyManager,
                serviceConfigs: serviceConfigs
            )
        }
        .sheet(isPresented: $showingLocalServiceForm) {
            LocalServiceConfigFormView(
                selectedService: $selectedLocalService,
                newEndpoint: $newEndpoint,
                isPresented: $showingLocalServiceForm,
                serviceConfigs: serviceConfigs
            ) { service, endpoint in
                setEndpointForService(service, endpoint)
            }
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

    private func getEndpointForService(_ service: String) -> String {
        switch service {
        case "ollama":
            return ollamaEndpoint
        case "lm_studio":
            return lmStudioEndpoint
        default:
            return serviceConfigs[service]?.defaultEndpoint ?? "http://localhost:8080"
        }
    }

    private func setEndpointForService(_ service: String, _ endpoint: String) {
        switch service {
        case "ollama":
            ollamaEndpoint = endpoint
        case "lm_studio":
            lmStudioEndpoint = endpoint
        default:
            break
        }
    }
}

struct CloudServiceRow: View {
    let config: ServiceConfig
    let keyInfo: KeyInfo
    let onEdit: () -> Void
    let onDelete: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            // Service icon and name
            VStack(alignment: .leading, spacing: 2) {
                HStack {
                    Image(systemName: config.iconName)
                        .foregroundColor(config.color)
                        .font(.title3)
                    Text(config.displayName)
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

    private var statusDescription: String {
        switch keyInfo.syncStatus {
        case .synced:
            return "API key synced across all storage"
        case .keychainOnly:
            return "API key stored locally only"
        case .vaultOnly:
            return "API key available in cloud only"
        case .conflict:
            return "API key sync conflict detected"
        case .missing:
            return "No API key configured"
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

struct LocalServiceRow: View {
    let config: ServiceConfig
    let endpoint: String
    let onEdit: () -> Void
    @State private var connectionStatus: ConnectionStatus = .unknown
    @State private var isTestingConnection = false

    enum ConnectionStatus {
        case unknown
        case connected
        case disconnected
        case testing
    }

    var body: some View {
        HStack(spacing: 12) {
            // Service icon and name
            VStack(alignment: .leading, spacing: 2) {
                HStack {
                    Image(systemName: config.iconName)
                        .foregroundColor(config.color)
                        .font(.title3)
                    Text(config.displayName)
                        .font(.headline)
                }
                Text("Endpoint: \(endpoint)")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(1)
                    .truncationMode(.middle)
            }

            Spacer()

            // Connection status and test button
            HStack(spacing: 8) {
                VStack {
                    Image(systemName: connectionStatusIcon)
                        .foregroundColor(connectionStatusColor)
                        .font(.caption)
                    Text(connectionStatusText)
                        .font(.system(size: 9))
                        .foregroundColor(.secondary)
                }

                Button {
                    Task { await testConnection() }
                } label: {
                    Image(systemName: isTestingConnection ? "arrow.clockwise" : "network")
                        .font(.caption)
                }
                .buttonStyle(.borderless)
                .disabled(isTestingConnection)
                .rotationEffect(.degrees(isTestingConnection ? 360 : 0))
                .animation(isTestingConnection ? .linear(duration: 1).repeatForever(autoreverses: false) : .default, value: isTestingConnection)
            }

            // Edit button
            Button {
                onEdit()
            } label: {
                Image(systemName: "pencil")
                    .font(.caption)
            }
            .buttonStyle(.borderless)
        }
        .padding(.vertical, 8)
        .padding(.horizontal, 12)
        .background(Color.primary.opacity(0.05))
        .cornerRadius(8)
    }

    private var connectionStatusIcon: String {
        switch connectionStatus {
        case .unknown: return "questionmark.circle"
        case .connected: return "checkmark.circle.fill"
        case .disconnected: return "xmark.circle.fill"
        case .testing: return "arrow.clockwise"
        }
    }

    private var connectionStatusColor: Color {
        switch connectionStatus {
        case .unknown: return .secondary
        case .connected: return .green
        case .disconnected: return .red
        case .testing: return .blue
        }
    }

    private var connectionStatusText: String {
        switch connectionStatus {
        case .unknown: return "Unknown"
        case .connected: return "Online"
        case .disconnected: return "Offline"
        case .testing: return "Testing"
        }
    }

    private func testConnection() async {
        guard !isTestingConnection else { return }
        
        isTestingConnection = true
        connectionStatus = .testing

        do {
            guard let url = URL(string: endpoint) else {
                connectionStatus = .disconnected
                isTestingConnection = false
                return
            }

            // Add health check endpoint for local services
            let healthURL = URL(string: endpoint.hasSuffix("/") ? "\(endpoint)health" : "\(endpoint)/health") ?? url

            let request = URLRequest(url: healthURL)
            let session = URLSession.shared
            session.configuration.timeoutIntervalForRequest = 5

            let (_, response) = try await session.data(for: request)

            if let httpResponse = response as? HTTPURLResponse,
               httpResponse.statusCode < 400 {
                connectionStatus = .connected
            } else {
                connectionStatus = .disconnected
            }
        } catch {
            connectionStatus = .disconnected
        }

        isTestingConnection = false
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

struct CloudKeyManagementFormView: View {
    @Binding var selectedService: String
    @Binding var newAPIKey: String
    @Binding var isPresented: Bool
    let keyManager: SecureKeyManager
    let serviceConfigs: [String: ServiceConfig]

    @State private var isSaving = false
    @State private var saveError: String?

    var availableCloudServices: [ServiceConfig] {
        serviceConfigs.values.filter { $0.type == .cloud }.sorted { $0.displayName < $1.displayName }
    }

    var body: some View {
        VStack(spacing: 20) {
            Text(selectedService.isEmpty ? "Add API Key" : "Edit API Key")
                .font(.title2)
                .fontWeight(.bold)

            VStack(spacing: 16) {
                if selectedService.isEmpty {
                    Picker("Cloud Service", selection: $selectedService) {
                        Text("Select a cloud service...").tag("")
                        ForEach(availableCloudServices, id: \.id) { config in
                            HStack {
                                Image(systemName: config.iconName)
                                    .foregroundColor(config.color)
                                Text(config.displayName)
                            }
                            .tag(config.id)
                        }
                    }
                    .pickerStyle(.menu)
                }

                VStack(alignment: .leading, spacing: 8) {
                    Text("API Key")
                        .font(.headline)
                    SecureField("Enter your API key", text: $newAPIKey)
                        .textFieldStyle(.roundedBorder)
                    
                    if !selectedService.isEmpty {
                        Text(getServiceDescription(selectedService))
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }

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
        .frame(width: 450, height: 350)
    }

    private func getServiceDescription(_ service: String) -> String {
        switch service {
        case "openai":
            return "Get your API key from platform.openai.com/api-keys"
        case "anthropic":
            return "Get your API key from console.anthropic.com"
        case "google_ai":
            return "Get your API key from aistudio.google.com/app/apikey"
        case "huggingface":
            return "Get your API key from huggingface.co/settings/tokens"
        default:
            return "Enter the API key for this service"
        }
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

struct LocalServiceConfigFormView: View {
    @Binding var selectedService: String
    @Binding var newEndpoint: String
    @Binding var isPresented: Bool
    let serviceConfigs: [String: ServiceConfig]
    let onSave: (String, String) -> Void

    @State private var isTesting = false
    @State private var connectionStatus: String = ""

    var availableLocalServices: [ServiceConfig] {
        serviceConfigs.values.filter { $0.type == .local }.sorted { $0.displayName < $1.displayName }
    }

    var body: some View {
        VStack(spacing: 20) {
            Text(selectedService.isEmpty ? "Configure Local Service" : "Edit Service Configuration")
                .font(.title2)
                .fontWeight(.bold)

            VStack(spacing: 16) {
                if selectedService.isEmpty {
                    Picker("Local Service", selection: $selectedService) {
                        Text("Select a service...").tag("")
                        ForEach(availableLocalServices, id: \.id) { config in
                            HStack {
                                Image(systemName: config.iconName)
                                    .foregroundColor(config.color)
                                Text(config.displayName)
                            }
                            .tag(config.id)
                        }
                    }
                    .pickerStyle(.menu)
                    .onChange(of: selectedService) { service in
                        if !service.isEmpty, let config = serviceConfigs[service] {
                            newEndpoint = config.defaultEndpoint ?? "http://localhost:8080"
                        }
                    }
                }

                VStack(alignment: .leading, spacing: 8) {
                    Text("Endpoint URL")
                        .font(.headline)
                    TextField("http://localhost:port", text: $newEndpoint)
                        .textFieldStyle(.roundedBorder)
                    
                    if !selectedService.isEmpty {
                        Text(getServiceDescription(selectedService))
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }

                HStack {
                    Button("Test Connection") {
                        Task { await testConnection() }
                    }
                    .buttonStyle(.bordered)
                    .disabled(newEndpoint.isEmpty || isTesting)

                    if !connectionStatus.isEmpty {
                        Text(connectionStatus)
                            .font(.caption)
                            .foregroundColor(connectionStatus.contains("Connected") ? .green : .red)
                    }
                }
            }

            HStack(spacing: 12) {
                Button("Cancel") {
                    isPresented = false
                }
                .buttonStyle(.bordered)

                Button("Save") {
                    onSave(selectedService, newEndpoint)
                    isPresented = false
                }
                .buttonStyle(.borderedProminent)
                .disabled(selectedService.isEmpty || newEndpoint.isEmpty)
            }

            Spacer()
        }
        .padding()
        .frame(width: 450, height: 400)
    }

    private func getServiceDescription(_ service: String) -> String {
        switch service {
        case "ollama":
            return "Default: http://localhost:11434 - Make sure Ollama is running"
        case "lm_studio":
            return "Default: http://localhost:1234/v1 - Enable local server in LM Studio"
        default:
            return "Configure the endpoint for your local AI service"
        }
    }

    private func testConnection() async {
        guard !newEndpoint.isEmpty else { return }
        
        isTesting = true
        connectionStatus = "Testing connection..."

        do {
            guard let url = URL(string: newEndpoint) else {
                connectionStatus = "❌ Invalid URL"
                isTesting = false
                return
            }

            let request = URLRequest(url: url)
            let session = URLSession.shared
            session.configuration.timeoutIntervalForRequest = 5

            let (_, response) = try await session.data(for: request)

            if let httpResponse = response as? HTTPURLResponse {
                if httpResponse.statusCode < 400 {
                    connectionStatus = "✅ Connected successfully"
                } else {
                    connectionStatus = "❌ Service responded with error (\(httpResponse.statusCode))"
                }
            } else {
                connectionStatus = "❌ No valid response"
            }
        } catch {
            connectionStatus = "❌ Connection failed: \(error.localizedDescription)"
        }

        isTesting = false
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
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .top)
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
