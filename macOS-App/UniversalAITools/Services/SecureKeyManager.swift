import Combine
import Foundation
import IOKit
import Network
import OSLog

// MARK: - Key Management Types

enum KeySource {
    case keychain
    case vault
    case environment
    case none
}

enum KeySyncStatus {
    case synced
    case keychainOnly
    case vaultOnly
    case conflict
    case missing
}

struct KeyInfo {
    let service: String
    let hasKeychainValue: Bool
    let hasVaultValue: Bool
    let syncStatus: KeySyncStatus
    let lastUpdated: Date?
    let source: KeySource
}

struct VaultCredentials {
    let supabaseUrl: String
    let serviceKey: String
    let deviceId: String
    let deviceToken: String
}

// MARK: - Secure Key Manager

class SecureKeyManager: ObservableObject {
    static let shared = SecureKeyManager()

    @Published var isVaultConnected = false
    @Published var keyStatuses: [String: KeyInfo] = [:]
    @Published var lastSyncTime: Date?

    private let keychainService = KeychainService.shared
    private let logger = Logger(subsystem: "com.universalai.tools", category: "SecureKeyManager")
    private var session: URLSession
    private var networkMonitor = NWPathMonitor()
    private var cancellables = Set<AnyCancellable>()

    private let knownServices = [
        "universal_ai_backend",
        "openai",
        "anthropic",
        "google_ai",
        "huggingface",
        "lm_studio",
        "ollama"
    ]

    private init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 10
        config.waitsForConnectivity = false
        self.session = URLSession(configuration: config)

        setupNetworkMonitoring()

        // Load key statuses asynchronously
        Task { @MainActor in
            loadKeyStatuses()
        }
    }

    // MARK: - Core Key Management

    /// Get a key with Keychain-first, Vault-fallback strategy
    func getKey(for service: String) async -> String? {
        // 1. Try Keychain first (fastest)
        if let keychainKey = keychainService.getAPIKey(for: service) {
            logger.debug("✅ Retrieved key for \(service) from Keychain")
            await updateKeyStatus(service: service, source: .keychain)
            return keychainKey
        }

        // 2. Try Vault if connected
        if isVaultConnected {
            if let vaultKey = await getKeyFromVault(service: service) {
                logger.debug("✅ Retrieved key for \(service) from Vault")

                // Cache in Keychain for next time
                if keychainService.saveAPIKey(vaultKey, for: service) {
                    logger.debug("💾 Cached \(service) key in Keychain")
                }

                await updateKeyStatus(service: service, source: .vault)
                return vaultKey
            }
        }

        // 3. Try environment variable as last resort
        if let envKey = getEnvironmentKey(for: service) {
            logger.debug("⚠️ Using environment key for \(service)")

            // Try to store in both Keychain and Vault
            _ = keychainService.saveAPIKey(envKey, for: service)
            _ = await storeKeyInVault(service: service, key: envKey)

            await updateKeyStatus(service: service, source: .environment)
            return envKey
        }

        logger.warning("❌ No key found for service: \(service)")
        await updateKeyStatus(service: service, source: .none)
        return nil
    }

    /// Store a key in both Keychain and Vault
    func storeKey(for service: String, key: String) async -> Bool {
        var success = true

        // Store in Keychain
        if keychainService.saveAPIKey(key, for: service) {
            logger.debug("✅ Stored key for \(service) in Keychain")
        } else {
            logger.error("❌ Failed to store key for \(service) in Keychain")
            success = false
        }

        // Store in Vault
        if await storeKeyInVault(service: service, key: key) {
            logger.debug("✅ Stored key for \(service) in Vault")
        } else {
            logger.warning("⚠️ Failed to store key for \(service) in Vault")
            // Don't mark as failure if Keychain succeeded
        }

        await updateKeyStatus(service: service, source: .keychain)
        return success
    }

    /// Remove a key from both stores
    func removeKey(for service: String) async -> Bool {
        var success = true

        // Remove from Keychain
        if !keychainService.deleteAPIKey(for: service) {
            success = false
        }

        // Remove from Vault
        let vaultRemoved = await removeKeyFromVault(service: service)
        if !vaultRemoved {
            // Don't mark as failure if offline
        }

        await updateKeyStatus(service: service, source: .none)
        return success
    }

    // MARK: - Vault Integration

    private func getVaultCredentials() -> VaultCredentials? {
        guard let backendUrl = UserDefaults.standard.string(forKey: "BackendURL"),
              let deviceId = getDeviceId(),
              let deviceToken = keychainService.getDeviceToken(for: deviceId) else {
            return nil
        }

        // For development, we'll use the backend API to access Vault
        // In production, this could be direct Supabase access
        return VaultCredentials(
            supabaseUrl: backendUrl,
            serviceKey: "", // We'll use device auth instead
            deviceId: deviceId,
            deviceToken: deviceToken
        )
    }

    private func getKeyFromVault(service: String) async -> String? {
        guard let credentials = getVaultCredentials() else {
            logger.debug("No Vault credentials available")
            return nil
        }

        do {
            let endpoint = "\(credentials.supabaseUrl)/api/v1/secrets/get"
            guard let url = URL(string: endpoint) else { return nil }

            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.setValue(credentials.deviceToken, forHTTPHeaderField: "X-Device-Token")

            let body = ["service": service]
            request.httpBody = try JSONSerialization.data(withJSONObject: body)

            let (data, response) = try await session.data(for: request)

            guard let httpResponse = response as? HTTPURLResponse,
                  httpResponse.statusCode == 200 else {
                return nil
            }

            if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
               let success = json["success"] as? Bool, success,
               let keyData = json["data"] as? [String: Any],
               let key = keyData["key"] as? String {
                return key
            }

        } catch {
            logger.error("❌ Failed to get key from Vault: \(error)")
        }

        return nil
    }

    private func storeKeyInVault(service: String, key: String) async -> Bool {
        guard let credentials = getVaultCredentials() else {
            logger.debug("No Vault credentials available")
            return false
        }

        do {
            let endpoint = "\(credentials.supabaseUrl)/api/v1/secrets/store"
            guard let url = URL(string: endpoint) else { return false }

            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.setValue(credentials.deviceToken, forHTTPHeaderField: "X-Device-Token")

            let body = [
                "service": service,
                "key": key,
                "description": "API key for \(service)",
                "device_id": credentials.deviceId
            ]
            request.httpBody = try JSONSerialization.data(withJSONObject: body)

            let (data, response) = try await session.data(for: request)

            guard let httpResponse = response as? HTTPURLResponse,
                  httpResponse.statusCode == 200 else {
                logger.warning("⚠️ Vault store failed with status: \((response as? HTTPURLResponse)?.statusCode ?? -1)")
                return false
            }

            if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
               let success = json["success"] as? Bool {
                return success
            }

        } catch {
            logger.error("❌ Failed to store key in Vault: \(error)")
        }

        return false
    }

    private func removeKeyFromVault(service: String) async -> Bool {
        guard let credentials = getVaultCredentials() else { return false }

        do {
            let endpoint = "\(credentials.supabaseUrl)/api/v1/secrets/delete"
            guard let url = URL(string: endpoint) else { return false }

            var request = URLRequest(url: url)
            request.httpMethod = "DELETE"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.setValue(credentials.deviceToken, forHTTPHeaderField: "X-Device-Token")

            let body = ["service": service]
            request.httpBody = try JSONSerialization.data(withJSONObject: body)

            let (_, response) = try await session.data(for: request)

            return (response as? HTTPURLResponse)?.statusCode == 200

        } catch {
            logger.error("❌ Failed to remove key from Vault: \(error)")
            return false
        }
    }

    // MARK: - Sync Operations

    func syncAllKeys() async {
        logger.info("🔄 Starting key synchronization")

        for service in knownServices {
            await syncKey(for: service)
        }

        lastSyncTime = Date()
        logger.info("✅ Key synchronization completed")
    }

    private func syncKey(for service: String) async {
        let keychainKey = keychainService.getAPIKey(for: service)
        let vaultKey = await getKeyFromVault(service: service)

        switch (keychainKey, vaultKey) {
        case (let local?, let remote?) where local == remote:
            // Keys match, all good
            await MainActor.run {
                updateKeyStatus(service: service, syncStatus: .synced, source: .keychain)
            }

        case (let local?, let remote?) where local != remote:
            // Conflict - prefer most recent (Vault for now)
            logger.warning("⚠️ Key conflict for \(service), using Vault version")
            _ = keychainService.saveAPIKey(remote, for: service)
            await MainActor.run {
                updateKeyStatus(service: service, syncStatus: .conflict, source: .vault)
            }

        case (let local?, nil):
            // Only in Keychain, upload to Vault
            _ = await storeKeyInVault(service: service, key: local)
            await MainActor.run {
                updateKeyStatus(service: service, syncStatus: .keychainOnly, source: .keychain)
            }

        case (nil, let remote?):
            // Only in Vault, download to Keychain
            _ = keychainService.saveAPIKey(remote, for: service)
            await MainActor.run {
                updateKeyStatus(service: service, syncStatus: .vaultOnly, source: .vault)
            }

        case (nil, nil):
            // No key in either place
            await MainActor.run {
                updateKeyStatus(service: service, syncStatus: .missing, source: .none)
            }

        default:
            // Catch-all case for safety
            logger.warning("⚠️ Unexpected key sync state for \(service)")
            await MainActor.run {
                updateKeyStatus(service: service, syncStatus: .missing, source: .none)
            }
        }
    }

    // MARK: - Utilities

    private func getEnvironmentKey(for service: String) -> String? {
        let envVars = [
            "universal_ai_backend": "UNIVERSAL_AI_API_KEY",
            "openai": "OPENAI_API_KEY",
            "anthropic": "ANTHROPIC_API_KEY",
            "google_ai": "GOOGLE_AI_API_KEY",
            "huggingface": "HUGGINGFACE_API_KEY"
        ]

        guard let envVar = envVars[service],
              let value = ProcessInfo.processInfo.environment[envVar],
              !value.isEmpty && value != "your-\(service)-key-here" else {
            return nil
        }

        return value
    }

    private func getDeviceId() -> String? {
        // Use macOS system identifier
        let service = IOServiceGetMatchingService(kIOMainPortDefault, IOServiceMatching("IOPlatformExpertDevice"))
        defer {
            if service != 0 {
                IOObjectRelease(service)
            }
        }

        guard service != 0 else {
            logger.warning("⚠️ Failed to get IOPlatformExpertDevice service")
            return UUID().uuidString // Fallback to random UUID
        }

        if let uuid = IORegistryEntryCreateCFProperty(
            service,
            "IOPlatformUUID" as CFString,
            kCFAllocatorDefault,
            0
        )?.takeRetainedValue() as? String {
            return uuid
        }

        logger.warning("⚠️ Failed to get IOPlatformUUID, using fallback")
        return UUID().uuidString // Fallback to random UUID
    }

    @MainActor
    private func updateKeyStatus(service: String, syncStatus: KeySyncStatus = .synced, source: KeySource) {
        keyStatuses[service] = KeyInfo(
            service: service,
            hasKeychainValue: keychainService.getAPIKey(for: service) != nil,
            hasVaultValue: false, // We'd need to check this async
            syncStatus: syncStatus,
            lastUpdated: Date(),
            source: source
        )
    }

    @MainActor
    private func loadKeyStatuses() {
        for service in knownServices {
            let hasKeychain = keychainService.getAPIKey(for: service) != nil
            let source: KeySource = hasKeychain ? .keychain : .none

            keyStatuses[service] = KeyInfo(
                service: service,
                hasKeychainValue: hasKeychain,
                hasVaultValue: false,
                syncStatus: hasKeychain ? .keychainOnly : .missing,
                lastUpdated: nil,
                source: source
            )
        }
    }

    private func setupNetworkMonitoring() {
        networkMonitor.pathUpdateHandler = { [weak self] path in
            Task { @MainActor in
                guard let self = self else { return }
                let wasConnected = self.isVaultConnected
                self.isVaultConnected = path.status == .satisfied

                // Auto-sync when connection is restored
                if !wasConnected && path.status == .satisfied {
                    Task {
                        await self.syncAllKeys()
                    }
                }
            }
        }
        networkMonitor.start(queue: DispatchQueue.global(qos: .background))
    }

    deinit {
        networkMonitor.cancel()
    }

    // MARK: - Public API

    func refreshKeyStatuses() async {
        await syncAllKeys()
    }

    func hasKey(for service: String) async -> Bool {
        await getKey(for: service) != nil
    }

    func clearAllKeys() async {
        for service in knownServices {
            _ = await removeKey(for: service)
        }
        await MainActor.run {
            keyStatuses.removeAll()
        }
    }
}

// MARK: - Key Manager Extensions

extension SecureKeyManager {
    /// Get the Universal AI Tools backend API key
    func getBackendAPIKey() async -> String? {
        await getKey(for: "universal_ai_backend")
    }

    /// Set the Universal AI Tools backend API key
    func setBackendAPIKey(_ key: String) async -> Bool {
        await storeKey(for: "universal_ai_backend", key: key)
    }
}
