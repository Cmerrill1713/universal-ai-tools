import Foundation
import UIKit
import LocalAuthentication
import Security
import CryptoKit
import Network
import Combine

@MainActor
class DeviceAuthenticationManager: ObservableObject, ProximityDetectionDelegate, WatchConnectivityDelegate {
    
    // MARK: - Published Properties
    @Published var authenticationState: AuthenticationState = .unauthenticated
    @Published var registrationState: RegistrationState = .unregistered
    @Published var proximityState: ProximityState = .unknown
    @Published var lastError: AuthError?
    
    // MARK: - Private Properties
    private let baseURL = "http://localhost:9999/api/v1/device-auth"
    private let websocketURL = "ws://localhost:8080/ws/device-auth"
    private var webSocketTask: URLSessionWebSocketTask?
    private var _authToken: String?
    private var isReceivingMessages = false
    private var cancellables = Set<AnyCancellable>()
    private let networkMonitor = NetworkMonitor()
    private let updateQueue = DispatchQueue(label: "com.universalaitools.updates", attributes: .concurrent)
    private var lastProximityUpdate: Date = .distantPast
    
    var authToken: String? {
        return _authToken
    }
    
    // Device Information
    private let deviceId: String
    private let deviceName: String
    private let deviceType: DeviceType
    private var publicKey: String?
    private var privateKey: SecKey?
    
    // Proximity Detection
    private var proximityService: ProximityDetectionService?
    
    // Watch Connectivity
    private var watchService: WatchConnectivityService?
    
    // MARK: - Initialization
    init() {
        // Generate unique device identifier
        self.deviceId = Self.getOrCreateDeviceId()
        self.deviceName = Self.getDeviceName()
        self.deviceType = Self.getDeviceType()
        
        // Generate cryptographic keys for secure communication
        generateKeyPair()
        
        // Initialize proximity detection
        setupProximityDetection()
        
        // Initialize watch connectivity
        setupWatchConnectivity()
        
        // Setup network monitoring
        setupNetworkMonitoring()
        
        // Check existing registration status
        Task {
            await checkRegistrationStatus()
        }
    }
    
    deinit {
        Task { @MainActor in
            disconnectWebSocket()
            proximityService?.stopProximityDetection()
        }
        cancellables.removeAll()
    }
    
    // MARK: - Device Registration
    
    func registerDevice() async {
        guard let publicKeyString = publicKey else {
            await setError(.keyGenerationFailed)
            return
        }
        
        registrationState = .registering
        
        let requestBody: [String: Any] = [
            "deviceId": deviceId,
            "deviceName": deviceName,
            "deviceType": deviceType.rawValue,
            "publicKey": publicKeyString,
            "metadata": [
                "osVersion": await getOSVersion(),
                "appVersion": await getAppVersion(),
                "capabilities": getDeviceCapabilities()
            ]
        ]
        
        do {
            guard let request = createRequest(endpoint: "register-initial") else {
                await setError(.networkError(URLError(.badURL)))
                return
            }
            
            var mutableRequest = request
            mutableRequest.httpBody = try JSONSerialization.data(withJSONObject: requestBody)
            
            let (data, response) = try await withTimeout(30) {
                try await URLSession.shared.data(for: mutableRequest)
            }
            
            if let httpResponse = response as? HTTPURLResponse {
                if httpResponse.statusCode == 200 {
                    if let responseData = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                       let success = responseData["success"] as? Bool,
                       success,
                       let dataDict = responseData["data"] as? [String: Any] {
                        
                        // Extract auth token from registration response
                        if let authToken = dataDict["authToken"] as? String {
                            _authToken = authToken
                            authenticationState = .authenticated
                            print("✅ Device registered and authenticated successfully")
                        }
                        
                        registrationState = .registered
                        await saveRegistrationInfo()
                        
                        // Connect to WebSocket for real-time events
                        await connectWebSocket()
                        
                    } else {
                        await setError(.registrationFailed)
                    }
                } else {
                    await setError(.registrationFailed)
                }
            }
        } catch {
            await setError(.networkError(error))
        }
    }
    
    // MARK: - Public Authentication Methods
    
    func signOut() async {
        authenticationState = .unauthenticated
        _authToken = nil
        disconnectWebSocket()
        stopProximityDetection()
        print("👋 User signed out")
    }
    
    // MARK: - Authentication Challenge Flow
    
    func authenticateWithBiometrics() async {
        guard registrationState == .registered else {
            await setError(.notRegistered)
            return
        }
        
        authenticationState = .authenticating
        
        // Step 1: Perform biometric authentication
        do {
            let biometricResult = try await performBiometricAuthentication()
            guard biometricResult else {
                authenticationState = .unauthenticated
                await setError(.biometricFailed)
                return
            }
        } catch {
            authenticationState = .unauthenticated
            await setError(.biometricFailed)
            return
        }
        
        // Step 2: Request challenge from server
        do {
            let challenge = try await requestChallenge()
            
            // Step 3: Sign challenge with private key
            let signature = try signChallenge(challenge.challenge)
            
            // Step 4: Verify challenge and get JWT token
            let authResult = try await verifyChallenge(
                challengeId: challenge.challengeId,
                signature: signature
            )
            
            _authToken = authResult.token
            authenticationState = .authenticated
            
            // Step 5: Connect to WebSocket for real-time events
            await connectWebSocket()
            
            print("✅ Authentication successful")
            
        } catch {
            authenticationState = .unauthenticated
            await setError(.authenticationFailed)
        }
    }
    
    // MARK: - Private Authentication Methods
    
    private func performBiometricAuthentication() async throws -> Bool {
        let context = LAContext()
        var error: NSError?
        
        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
            throw AuthError.biometricNotAvailable
        }
        
        let reason = "Authenticate to unlock Universal AI Tools"
        
        return try await context.evaluatePolicy(
            .deviceOwnerAuthenticationWithBiometrics,
            localizedReason: reason
        )
    }
    
    private func requestChallenge() async throws -> ChallengeResponse {
        guard var request = createRequest(endpoint: "challenge") else {
            throw AuthError.networkError(URLError(.badURL))
        }
        
        let requestBody = ["deviceId": deviceId]
        request.httpBody = try JSONSerialization.data(withJSONObject: requestBody)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200,
              let responseData = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let success = responseData["success"] as? Bool,
              success,
              let challengeData = responseData["data"] as? [String: Any],
              let challengeId = challengeData["challengeId"] as? String,
              let challenge = challengeData["challenge"] as? String,
              let expiresAt = challengeData["expiresAt"] as? TimeInterval else {
            throw AuthError.challengeRequestFailed
        }
        
        return ChallengeResponse(
            challengeId: challengeId,
            challenge: challenge,
            expiresAt: expiresAt
        )
    }
    
    private func signChallenge(_ challenge: String) throws -> String {
        guard let privateKey = privateKey else {
            throw AuthError.keyGenerationFailed
        }
        
        let challengeData = Data(challenge.utf8)
        
        var error: Unmanaged<CFError>?
        guard let signature = SecKeyCreateSignature(
            privateKey,
            .rsaSignatureMessagePKCS1v15SHA256,
            challengeData as CFData,
            &error
        ) else {
            throw AuthError.signatureFailed
        }
        
        let signatureData = signature as Data
        return signatureData.base64EncodedString()
    }
    
    private func verifyChallenge(challengeId: String, signature: String) async throws -> AuthenticationResult {
        guard var request = createRequest(endpoint: "verify") else {
            throw AuthError.networkError(URLError(.badURL))
        }
        
        let requestBody: [String: Any] = [
            "challengeId": challengeId,
            "signature": signature,
            "proximity": [
                "rssi": -50 // Mock proximity data for now
            ]
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: requestBody)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200,
              let responseData = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let success = responseData["success"] as? Bool,
              success,
              let authData = responseData["data"] as? [String: Any],
              let token = authData["token"] as? String,
              let expiresIn = authData["expiresIn"] as? TimeInterval else {
            throw AuthError.verificationFailed
        }
        
        return AuthenticationResult(
            token: token,
            expiresIn: expiresIn
        )
    }
    
    // MARK: - WebSocket Connection
    
    private func connectWebSocket() async {
        guard let token = _authToken else { return }
        
        guard let url = URL(string: websocketURL) else { return }
        
        var request = URLRequest(url: url)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.timeoutInterval = 60
        
        disconnectWebSocket() // Clean up any existing connection
        
        webSocketTask = URLSession.shared.webSocketTask(with: request)
        webSocketTask?.resume()
        
        // Send ping periodically to keep connection alive
        startWebSocketHeartbeat()
        
        // Start listening for messages
        await receiveWebSocketMessages()
    }
    
    private func disconnectWebSocket() {
        webSocketTask?.cancel(with: .goingAway, reason: nil)
        webSocketTask = nil
        isReceivingMessages = false
    }
    
    private func startWebSocketHeartbeat() {
        Task {
            while webSocketTask?.state == .running {
                webSocketTask?.sendPing { error in
                    if let error = error {
                        print("WebSocket ping failed: \(error)")
                    }
                }
                try? await Task.sleep(nanoseconds: 30_000_000_000) // 30 seconds
            }
        }
    }
    
    private func receiveWebSocketMessages() async {
        guard let webSocketTask = webSocketTask,
              !isReceivingMessages else { return }
        
        isReceivingMessages = true
        
        while webSocketTask.state == .running {
            do {
                let message = try await webSocketTask.receive()
                
                switch message {
                case .string(let text):
                    await handleWebSocketMessage(text)
                case .data(let data):
                    if let text = String(data: data, encoding: .utf8) {
                        await handleWebSocketMessage(text)
                    }
                @unknown default:
                    break
                }
            } catch {
                print("WebSocket error: \(error)")
                isReceivingMessages = false
                
                // Attempt to reconnect after a delay
                if authenticationState == .authenticated {
                    try? await Task.sleep(nanoseconds: 5_000_000_000) // 5 seconds
                    await connectWebSocket()
                }
                break
            }
        }
        
        isReceivingMessages = false
    }
    
    private func handleWebSocketMessage(_ message: String) async {
        guard let data = message.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return
        }
        
        if let type = json["type"] as? String {
            switch type {
            case "welcome":
                print("WebSocket connected successfully")
            case "auth_event":
                if let event = json["event"] as? [String: Any],
                   let eventType = event["type"] as? String {
                    await handleAuthEvent(eventType, data: event)
                }
            default:
                break
            }
        }
    }
    
    private func handleAuthEvent(_ eventType: String, data: [String: Any]) async {
        switch eventType {
        case "proximity_changed":
            if let proximityData = data["data"] as? [String: Any],
               let proximityString = proximityData["proximity"] as? String,
               let locked = proximityData["locked"] as? Bool {
                
                proximityState = ProximityState(rawValue: proximityString) ?? .unknown
                
                if locked {
                    authenticationState = .locked
                } else if proximityState == .immediate {
                    authenticationState = .authenticated
                }
            }
        case "screen_locked":
            authenticationState = .locked
        case "screen_unlocked":
            authenticationState = .authenticated
        default:
            break
        }
    }
    
    // MARK: - Key Generation
    
    private func generateKeyPair() {
        let keySize = 2048
        let publicKeyTag = "com.universalaitools.publickey"
        let privateKeyTag = "com.universalaitools.privatekey"
        
        let publicKeyAttributes: [String: Any] = [
            kSecAttrIsPermanent as String: true,
            kSecAttrApplicationTag as String: publicKeyTag.data(using: .utf8)!
        ]
        
        let privateKeyAttributes: [String: Any] = [
            kSecAttrIsPermanent as String: true,
            kSecAttrApplicationTag as String: privateKeyTag.data(using: .utf8)!
        ]
        
        let attributes: [String: Any] = [
            kSecAttrKeyType as String: kSecAttrKeyTypeRSA,
            kSecAttrKeySizeInBits as String: keySize,
            kSecPublicKeyAttrs as String: publicKeyAttributes,
            kSecPrivateKeyAttrs as String: privateKeyAttributes
        ]
        
        var publicKey: SecKey?
        var privateKey: SecKey?
        
        let status = SecKeyGeneratePair(attributes as CFDictionary, &publicKey, &privateKey)
        
        if status == errSecSuccess {
            self.privateKey = privateKey
            
            // Export public key
            if let publicKey = publicKey,
               let publicKeyData = SecKeyCopyExternalRepresentation(publicKey, nil) {
                self.publicKey = (publicKeyData as Data).base64EncodedString()
            }
        }
    }
    
    // MARK: - Utility Methods
    
    private static func getOrCreateDeviceId() -> String {
        let key = "UniversalAITools.DeviceId"
        
        if let existingId = UserDefaults.standard.string(forKey: key) {
            return existingId
        }
        
        let newId = "iPhone-\(UUID().uuidString.prefix(8))"
        UserDefaults.standard.set(newId, forKey: key)
        return newId
    }
    
    private static func getDeviceName() -> String {
        return UIDevice.current.name
    }
    
    private static func getDeviceType() -> DeviceType {
        let deviceModel = UIDevice.current.model
        
        if deviceModel.contains("iPhone") {
            return .iPhone
        } else if deviceModel.contains("iPad") {
            return .iPad
        } else {
            return .iPhone // Default
        }
    }
    
    private func getOSVersion() async -> String {
        return UIDevice.current.systemVersion
    }
    
    private func getAppVersion() async -> String {
        return Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0"
    }
    
    private func getDeviceCapabilities() -> [String] {
        var capabilities = ["bluetooth", "proximity"]
        
        let context = LAContext()
        if context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil) {
            capabilities.append("biometric")
            
            switch context.biometryType {
            case .faceID:
                capabilities.append("face_id")
            case .touchID:
                capabilities.append("touch_id")
            default:
                break
            }
        }
        
        return capabilities
    }
    
    private func checkRegistrationStatus() async {
        // Check if device is already registered
        if UserDefaults.standard.bool(forKey: "DeviceRegistered") {
            registrationState = .registered
        }
    }
    
    private func saveRegistrationInfo() async {
        UserDefaults.standard.set(true, forKey: "DeviceRegistered")
    }
    
    private func setError(_ error: AuthError) async {
        self.lastError = error
        print("❌ Authentication error: \(error)")
    }
    
    // MARK: - Proximity Detection
    
    private func setupProximityDetection() {
        proximityService = ProximityDetectionService()
        proximityService?.delegate = self
    }
    
    func startProximityDetection() {
        proximityService?.startProximityDetection()
    }
    
    func stopProximityDetection() {
        proximityService?.stopProximityDetection()
    }
    
    // MARK: - ProximityDetectionDelegate
    
    nonisolated func proximityDidUpdate(_ proximity: ProximityState, rssi: Int) {
        Task { @MainActor in
            // Debounce proximity updates
            let now = Date()
            guard now.timeIntervalSince(lastProximityUpdate) > 0.5 else { return }
            lastProximityUpdate = now
            
            self.proximityState = proximity
            
            // Auto-lock/unlock based on proximity
            if proximity == .far || proximity == .unknown {
                if authenticationState == .authenticated {
                    authenticationState = .locked
                }
            } else if proximity == .immediate && authenticationState == .locked {
                // Auto-unlock when very close (could add additional security checks)
                authenticationState = .authenticated
            }
            
            // Send proximity update to backend
            await sendProximityUpdate(proximity: proximity, rssi: rssi)
        }
    }
    
    nonisolated func proximityDetectionDidFail(error: ProximityError) {
        Task { @MainActor in
            await setError(.networkError(error))
        }
    }
    
    private func sendProximityUpdate(proximity: ProximityState, rssi: Int) async {
        guard let token = _authToken else { return }
        
        do {
            guard var request = createRequest(endpoint: "proximity") else { return }
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            
            let requestBody: [String: Any] = [
                "deviceId": deviceId,
                "rssi": rssi
            ]
            
            request.httpBody = try JSONSerialization.data(withJSONObject: requestBody)
            
            let (_, response) = try await withTimeout(5) {
                try await URLSession.shared.data(for: request)
            }
            
            if let httpResponse = response as? HTTPURLResponse,
               httpResponse.statusCode == 200 {
                print("📡 Proximity update sent successfully")
            }
        } catch {
            print("❌ Failed to send proximity update: \(error)")
        }
    }
    
    // MARK: - Watch Connectivity
    
    private func setupWatchConnectivity() {
        watchService = WatchConnectivityService()
        watchService?.delegate = self
    }
    
    // MARK: - WatchConnectivityDelegate
    
    nonisolated func watchDidConnect() {
        Task { @MainActor in
            print("⌚ Apple Watch connected")
            
            // Send current authentication state to watch
            watchService?.sendAuthenticationState(authenticationState)
            
            // Send device registration info
            let deviceInfo: [String: Any] = [
                "deviceId": deviceId,
                "deviceName": deviceName,
                "deviceType": deviceType.rawValue,
                "registrationState": registrationState == .registered
            ]
            watchService?.sendDeviceRegistrationInfo(deviceInfo)
        }
    }
    
    nonisolated func watchDidDisconnect() {
        Task { @MainActor in
            print("⌚ Apple Watch disconnected")
        }
    }
    
    nonisolated func watchAuthenticationStateChanged(_ state: AuthenticationState) {
        Task { @MainActor in
            print("⌚ Watch authentication state changed: \(state)")
            
            // Sync authentication state from watch
            if state == .authenticated && authenticationState != .authenticated {
                // Watch authenticated, update phone state
                authenticationState = .authenticated
                
                // Start proximity detection
                startProximityDetection()
            } else if state == .locked && authenticationState == .authenticated {
                // Watch locked, lock phone too
                authenticationState = .locked
            }
        }
    }
    
    nonisolated func receivedMessageFromWatch(_ message: [String: Any]) {
        Task { @MainActor in
            guard let type = message["type"] as? String else { return }
            
            switch type {
            case "requestUnlock":
                // Watch is requesting to unlock the phone
                await handleWatchUnlockRequest(message)
                
            case "biometricComplete":
                // Watch completed biometric authentication
                if let success = message["success"] as? Bool, success {
                    await performWatchBasedAuthentication()
                }
                
            case "healthData":
                // Process health data for additional security
                await processWatchHealthData(message)
                
            default:
                print("⌚ Received unknown message from watch: \(type)")
            }
        }
    }
    
    private func handleWatchUnlockRequest(_ message: [String: Any]) async {
        guard authenticationState == .locked else { return }
        
        // Verify the watch request is legitimate
        if let timestamp = message["timestamp"] as? TimeInterval {
            let now = Date().timeIntervalSince1970
            
            // Check if request is recent (within 30 seconds)
            if now - timestamp < 30 {
                // Authenticate with watch
                watchService?.requestWatchAuthentication()
            }
        }
    }
    
    private func performWatchBasedAuthentication() async {
        // When watch completes biometric authentication, unlock phone
        if authenticationState == .locked || authenticationState == .unauthenticated {
            authenticationState = .authenticated
            
            // Start proximity detection
            startProximityDetection()
            
            print("✅ Authenticated via Apple Watch")
        }
    }
    
    private func processWatchHealthData(_ message: [String: Any]) async {
        guard let healthData = message["data"] as? [String: Any] else { return }
        
        // Use health data for additional authentication factors
        if let heartRate = healthData["heartRate"] as? Double {
            // Could implement stress detection or biometric patterns
            print("❤️ Watch heart rate: \(heartRate) BPM")
        }
        
        if let steps = healthData["steps"] as? Int {
            // Could use activity patterns for authentication
            print("👣 Watch steps: \(steps)")
        }
    }
    
    // Override authentication state changes to sync with watch
    private func syncAuthenticationStateWithWatch() {
        watchService?.sendAuthenticationState(authenticationState)
        
        // Send lock/unlock commands to watch
        switch authenticationState {
        case .locked:
            watchService?.lockScreenOnWatch()
        case .authenticated:
            watchService?.unlockScreenOnWatch()
        default:
            break
        }
    }
    
    // MARK: - Helper Methods
    
    private func createRequest(endpoint: String, method: String = "POST") -> URLRequest? {
        guard let url = URL(string: "\(baseURL)/\(endpoint)") else {
            return nil
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 30
        
        if let token = _authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        return request
    }
    
    private func withTimeout<T>(_ seconds: TimeInterval, operation: @escaping () async throws -> T) async throws -> T {
        return try await withThrowingTaskGroup(of: T.self) { group in
            group.addTask {
                return try await operation()
            }
            
            group.addTask {
                try await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
                throw URLError(.timedOut)
            }
            
            let result = try await group.next()!
            group.cancelAll()
            return result
        }
    }
    
    private func retryableRequest<T>(
        maxAttempts: Int = 3,
        delay: TimeInterval = 1.0,
        operation: @escaping () async throws -> T
    ) async throws -> T {
        var lastError: Error?
        
        for attempt in 1...maxAttempts {
            do {
                return try await operation()
            } catch {
                lastError = error
                
                if attempt < maxAttempts {
                    try await Task.sleep(nanoseconds: UInt64(delay * Double(attempt) * 1_000_000_000))
                }
            }
        }
        
        throw lastError ?? URLError(.unknown)
    }
    
    // MARK: - Network Monitoring
    
    private func setupNetworkMonitoring() {
        networkMonitor.$isConnected
            .debounce(for: .seconds(1), scheduler: DispatchQueue.main)
            .sink { [weak self] isConnected in
                guard let self = self else { return }
                if !isConnected && self.authenticationState == .authenticated {
                    Task { @MainActor in
                        self.authenticationState = .locked
                        await self.setError(.networkError(URLError(.notConnectedToInternet)))
                    }
                }
            }
            .store(in: &cancellables)
    }
    
    // MARK: - Keychain Storage
    
    private enum KeychainKey: String {
        case authToken = "com.universalaitools.authToken"
        case deviceId = "com.universalaitools.deviceId"
        case privateKey = "com.universalaitools.privateKey"
    }
    
    private func saveToKeychain(key: KeychainKey, value: String) -> Bool {
        guard let data = value.data(using: .utf8) else { return false }
        
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key.rawValue,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        ]
        
        // Delete existing item
        SecItemDelete(query as CFDictionary)
        
        // Add new item
        let status = SecItemAdd(query as CFDictionary, nil)
        return status == errSecSuccess
    }
    
    private func loadFromKeychain(key: KeychainKey) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key.rawValue,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        
        var dataTypeRef: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &dataTypeRef)
        
        if status == errSecSuccess,
           let data = dataTypeRef as? Data,
           let value = String(data: data, encoding: .utf8) {
            return value
        }
        
        return nil
    }
}

// MARK: - Supporting Types

enum AuthenticationState {
    case unauthenticated
    case authenticating
    case authenticated
    case locked
}

enum RegistrationState {
    case unregistered
    case registering
    case registered
}

enum ProximityState: String {
    case immediate = "immediate"
    case near = "near"
    case far = "far"
    case unknown = "unknown"
}

enum DeviceType: String {
    case iPhone = "iPhone"
    case iPad = "iPad"
    case appleWatch = "AppleWatch"
    case mac = "Mac"
}

enum AuthError: Error, LocalizedError, Equatable {
    case notRegistered
    case registrationFailed
    case keyGenerationFailed
    case biometricNotAvailable
    case biometricFailed
    case challengeRequestFailed
    case signatureFailed
    case verificationFailed
    case authenticationFailed
    case networkError(Error)
    
    static func == (lhs: AuthError, rhs: AuthError) -> Bool {
        switch (lhs, rhs) {
        case (.notRegistered, .notRegistered),
             (.registrationFailed, .registrationFailed),
             (.keyGenerationFailed, .keyGenerationFailed),
             (.biometricNotAvailable, .biometricNotAvailable),
             (.biometricFailed, .biometricFailed),
             (.challengeRequestFailed, .challengeRequestFailed),
             (.signatureFailed, .signatureFailed),
             (.verificationFailed, .verificationFailed),
             (.authenticationFailed, .authenticationFailed):
            return true
        case (.networkError(let lhsError), .networkError(let rhsError)):
            return lhsError.localizedDescription == rhsError.localizedDescription
        default:
            return false
        }
    }
    
    var errorDescription: String? {
        switch self {
        case .notRegistered:
            return "Device is not registered"
        case .registrationFailed:
            return "Device registration failed"
        case .keyGenerationFailed:
            return "Failed to generate security keys"
        case .biometricNotAvailable:
            return "Biometric authentication not available"
        case .biometricFailed:
            return "Biometric authentication failed"
        case .challengeRequestFailed:
            return "Failed to request authentication challenge"
        case .signatureFailed:
            return "Failed to sign authentication challenge"
        case .verificationFailed:
            return "Challenge verification failed"
        case .authenticationFailed:
            return "Authentication failed"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        }
    }
}

struct ChallengeResponse {
    let challengeId: String
    let challenge: String
    let expiresAt: TimeInterval
}

struct AuthenticationResult {
    let token: String
    let expiresIn: TimeInterval
}

// MARK: - Network Monitor

class NetworkMonitor: ObservableObject {
    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "NetworkMonitor")
    
    @Published var isConnected = true
    @Published var connectionType = NWInterface.InterfaceType.other
    
    init() {
        monitor.pathUpdateHandler = { [weak self] path in
            DispatchQueue.main.async {
                self?.isConnected = path.status == .satisfied
                self?.connectionType = path.availableInterfaces.first?.type ?? .other
            }
        }
        
        monitor.start(queue: queue)
    }
    
    deinit {
        monitor.cancel()
    }
}