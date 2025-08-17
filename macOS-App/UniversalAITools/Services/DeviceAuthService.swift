import Foundation
import Combine
import CryptoKit
import LocalAuthentication
import Network
import OSLog
import SwiftUI

// MARK: - Device Authentication Service
/// Handles device-specific authentication including proximity auth, trusted device management, and hardware-based security
@MainActor
public final class DeviceAuthService: ObservableObject {
    static let shared = DeviceAuthService()
    
    // MARK: - Published Properties
    @Published public var isDeviceRegistered: Bool = false
    @Published public var trustedDevices: [TrustedDevice] = []
    @Published public var nearbyDevices: [NearbyDevice] = []
    @Published public var authenticationMethods: Set<DeviceAuthMethod> = []
    @Published public var connectionStatus: DeviceConnectionStatus = .disconnected
    
    // MARK: - Private Properties
    private let authService: AuthenticationService
    private let apiService: APIService
    private let keychain = KeychainManager()
    private let logger = Logger(subsystem: "com.universalai.tools", category: "DeviceAuthService")
    
    // Proximity authentication
    private var proximityManager: ProximityAuthManager?
    
    // Hardware security
    private let secureEnclave = SecureEnclaveManager()
    
    // Network discovery
    private var browser: NWBrowser?
    private let browserQueue = DispatchQueue(label: "DeviceDiscovery")
    
    // Session management
    private var currentDeviceToken: String?
    private var deviceId: String
    private var deviceKeyPair: SecKey?
    
    private var cancellables = Set<AnyCancellable>()
    
    // MARK: - Initialization
    private init() {
        self.authService = AuthenticationService.shared
        self.apiService = APIService.shared
        self.deviceId = Self.generateDeviceId()
        
        setupDeviceAuthentication()
        loadTrustedDevices()
        startDeviceDiscovery()
    }
    
    // MARK: - Device Registration
    
    /// Register current device with backend
    public func registerDevice(name: String? = nil, requireBiometric: Bool = true) async throws -> DeviceRegistration {
        let deviceName = name ?? Host.current().localizedName ?? "macOS Device"
        
        // Generate device key pair if needed
        if deviceKeyPair == nil {
            deviceKeyPair = try await generateDeviceKeyPair()
        }
        
        // Get device fingerprint
        let fingerprint = try await generateDeviceFingerprint()
        
        // Require biometric confirmation if requested
        if requireBiometric {
            try await confirmWithBiometrics(reason: "Register device '\(deviceName)'")
        }
        
        // Create registration request
        let request = DeviceRegistrationRequest(
            deviceId: deviceId,
            deviceName: deviceName,
            platform: "macOS",
            model: getMacModel(),
            fingerprint: fingerprint,
            publicKey: try exportPublicKey(deviceKeyPair!),
            capabilities: getDeviceCapabilities()
        )
        
        // Send to backend
        let url = URL(string: "\(apiService.baseURL)/device-auth/register")!
        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "POST"
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        if let token = authService.accessToken {
            urlRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        urlRequest.httpBody = try JSONEncoder().encode(request)
        
        let (data, response) = try await URLSession.shared.data(for: urlRequest)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw DeviceAuthError.registrationFailed
        }
        
        let registration = try JSONDecoder().decode(DeviceRegistration.self, from: data)
        
        // Store device credentials
        currentDeviceToken = registration.deviceToken
        try await storeDeviceCredentials(registration)
        
        isDeviceRegistered = true
        logger.info("✅ Device registered: \(deviceName)")
        
        return registration
    }
    
    /// Authenticate using device credentials
    public func authenticateWithDevice() async throws {
        guard isDeviceRegistered,
              let deviceToken = currentDeviceToken ?? (try? await retrieveDeviceToken()) else {
            throw DeviceAuthError.deviceNotRegistered
        }
        
        // Create challenge-response authentication
        let challenge = try await requestAuthChallenge()
        let signature = try signChallenge(challenge)
        
        let request = DeviceAuthRequest(
            deviceId: deviceId,
            deviceToken: deviceToken,
            challenge: challenge,
            signature: signature
        )
        
        let url = URL(string: "\(apiService.baseURL)/device-auth/authenticate")!
        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "POST"
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        urlRequest.httpBody = try JSONEncoder().encode(request)
        
        let (data, response) = try await URLSession.shared.data(for: urlRequest)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw DeviceAuthError.authenticationFailed
        }
        
        let authResponse = try JSONDecoder().decode(DeviceAuthResponse.self, from: data)
        
        // Update authentication service with tokens
        await authService.updateTokens(
            access: authResponse.accessToken,
            refresh: authResponse.refreshToken
        )
        
        logger.info("✅ Device authentication successful")
    }
    
    // MARK: - Proximity Authentication
    
    /// Enable proximity-based authentication with nearby trusted devices
    public func enableProximityAuth() async throws {
        proximityManager = ProximityAuthManager()
        
        try await proximityManager?.startAdvertising(deviceId: deviceId)
        try await proximityManager?.startScanning()
        
        // Monitor nearby devices
        proximityManager?.$nearbyDevices
            .receive(on: DispatchQueue.main)
            .assign(to: &$nearbyDevices)
        
        authenticationMethods.insert(.proximity)
        logger.info("✅ Proximity authentication enabled")
    }
    
    /// Authenticate using nearby trusted device
    public func authenticateWithProximity(device: NearbyDevice) async throws {
        guard trustedDevices.contains(where: { $0.id == device.id }) else {
            throw DeviceAuthError.untrustedDevice
        }
        
        // Exchange authentication tokens via secure channel
        let token = try await proximityManager?.exchangeToken(with: device)
        
        guard let token = token else {
            throw DeviceAuthError.proximityAuthFailed
        }
        
        // Validate with backend
        try await validateProximityToken(token)
        
        logger.info("✅ Proximity authentication successful with device: \(device.name)")
    }
    
    // MARK: - Trusted Devices
    
    /// Add device to trusted list
    public func trustDevice(_ device: NearbyDevice) async throws {
        // Require biometric confirmation
        try await confirmWithBiometrics(reason: "Trust device '\(device.name)'")
        
        let trusted = TrustedDevice(
            id: device.id,
            name: device.name,
            platform: device.platform,
            addedAt: Date(),
            lastSeen: Date(),
            publicKey: device.publicKey
        )
        
        // Register with backend
        try await registerTrustedDevice(trusted)
        
        // Store locally
        trustedDevices.append(trusted)
        try await storeTrustedDevices()
        
        logger.info("✅ Device trusted: \(device.name)")
    }
    
    /// Remove device from trusted list
    public func removeTrustedDevice(_ device: TrustedDevice) async throws {
        try await confirmWithBiometrics(reason: "Remove trusted device '\(device.name)'")
        
        // Remove from backend
        try await unregisterTrustedDevice(device)
        
        // Remove locally
        trustedDevices.removeAll { $0.id == device.id }
        try await storeTrustedDevices()
        
        logger.info("✅ Trusted device removed: \(device.name)")
    }
    
    // MARK: - Hardware Security
    
    /// Generate hardware-backed key pair
    private func generateDeviceKeyPair() async throws -> SecKey {
        if secureEnclave.isAvailable {
            return try secureEnclave.generateKeyPair()
        } else {
            // Fallback to regular keychain
            return try generateKeychainKeyPair()
        }
    }
    
    /// Sign data with device key
    private func signChallenge(_ challenge: String) throws -> String {
        guard let privateKey = deviceKeyPair else {
            throw DeviceAuthError.noDeviceKey
        }
        
        let data = challenge.data(using: .utf8)!
        
        var error: Unmanaged<CFError>?
        guard let signature = SecKeyCreateSignature(
            privateKey,
            .ecdsaSignatureMessageX962SHA256,
            data as CFData,
            &error
        ) else {
            throw DeviceAuthError.signatureFailed
        }
        
        return (signature as Data).base64EncodedString()
    }
    
    // MARK: - Network Discovery
    
    private func startDeviceDiscovery() {
        let parameters = NWParameters()
        parameters.includePeerToPeer = true
        
        browser = NWBrowser(
            for: .bonjour(type: "_universalai._tcp", domain: nil),
            using: parameters
        )
        
        browser?.browseResultsChangedHandler = { [weak self] results, changes in
            self?.handleDiscoveryResults(results, changes: changes)
        }
        
        browser?.start(queue: browserQueue)
    }
    
    private func handleDiscoveryResults(_ results: Set<NWBrowser.Result>, changes: Set<NWBrowser.Result.Change>) {
        Task { @MainActor in
            for result in results {
                switch result.endpoint {
                case .service(let name, let type, let domain, _):
                    await discoverDevice(name: name, type: type, domain: domain)
                default:
                    break
                }
            }
        }
    }
    
    private func discoverDevice(name: String, type: String, domain: String) async {
        // Parse device info from service name
        let device = NearbyDevice(
            id: name,
            name: name,
            platform: "Unknown",
            distance: .unknown,
            publicKey: nil
        )
        
        if !nearbyDevices.contains(where: { $0.id == device.id }) {
            nearbyDevices.append(device)
        }
    }
    
    // MARK: - Biometric Confirmation
    
    private func confirmWithBiometrics(reason: String) async throws {
        let context = LAContext()
        
        var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
            throw DeviceAuthError.biometricsUnavailable
        }
        
        do {
            let success = try await context.evaluatePolicy(
                .deviceOwnerAuthenticationWithBiometrics,
                localizedReason: reason
            )
            
            guard success else {
                throw DeviceAuthError.biometricsFailed
            }
        } catch {
            throw DeviceAuthError.biometricsFailed
        }
    }
    
    // MARK: - Helper Methods
    
    private func setupDeviceAuthentication() {
        // Check available authentication methods
        if LAContext().canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil) {
            authenticationMethods.insert(.biometric)
        }
        
        if SecureEnclaveManager.isAvailable {
            authenticationMethods.insert(.secureEnclave)
        }
        
        authenticationMethods.insert(.deviceToken)
    }
    
    private func loadTrustedDevices() {
        Task {
            trustedDevices = (try? await retrieveTrustedDevices()) ?? []
        }
    }
    
    private static func generateDeviceId() -> String {
        // Try to get hardware UUID
        let service = IOServiceGetMatchingService(
            kIOMasterPortDefault,
            IOServiceMatching("IOPlatformExpertDevice")
        )
        
        defer { IOObjectRelease(service) }
        
        if let serialNumber = IORegistryEntryCreateCFProperty(
            service,
            kIOPlatformSerialNumberKey as CFString,
            kCFAllocatorDefault,
            0
        )?.takeRetainedValue() as? String {
            // Hash the serial number for privacy
            let data = serialNumber.data(using: .utf8)!
            let hash = SHA256.hash(data: data)
            return hash.compactMap { String(format: "%02x", $0) }.joined()
        }
        
        // Fallback to generated UUID stored in keychain
        return UUID().uuidString
    }
    
    private func getMacModel() -> String {
        var size = 0
        sysctlbyname("hw.model", nil, &size, nil, 0)
        var model = [CChar](repeating: 0, count: size)
        sysctlbyname("hw.model", &model, &size, nil, 0)
        return String(cString: model)
    }
    
    private func getDeviceCapabilities() -> [String] {
        var capabilities: [String] = ["macOS"]
        
        if authenticationMethods.contains(.biometric) {
            capabilities.append("TouchID")
        }
        
        if authenticationMethods.contains(.secureEnclave) {
            capabilities.append("SecureEnclave")
        }
        
        if authenticationMethods.contains(.proximity) {
            capabilities.append("ProximityAuth")
        }
        
        return capabilities
    }
    
    private func generateDeviceFingerprint() async throws -> String {
        var fingerprint = [String: Any]()
        
        // Hardware info
        fingerprint["model"] = getMacModel()
        fingerprint["deviceId"] = deviceId
        
        // OS info
        let osVersion = ProcessInfo.processInfo.operatingSystemVersion
        fingerprint["osVersion"] = "\(osVersion.majorVersion).\(osVersion.minorVersion).\(osVersion.patchVersion)"
        
        // Network interfaces
        fingerprint["networkInterfaces"] = getNetworkInterfaces()
        
        // Create hash
        let data = try JSONSerialization.data(withJSONObject: fingerprint)
        let hash = SHA256.hash(data: data)
        return hash.compactMap { String(format: "%02x", $0) }.joined()
    }
    
    private func getNetworkInterfaces() -> [String] {
        var interfaces: [String] = []
        
        var ifaddr: UnsafeMutablePointer<ifaddrs>?
        guard getifaddrs(&ifaddr) == 0 else { return interfaces }
        defer { freeifaddrs(ifaddr) }
        
        var ptr = ifaddr
        while ptr != nil {
            defer { ptr = ptr?.pointee.ifa_next }
            
            let interface = ptr?.pointee
            let name = String(cString: (interface?.ifa_name)!)
            
            if !interfaces.contains(name) {
                interfaces.append(name)
            }
        }
        
        return interfaces
    }
    
    private func exportPublicKey(_ key: SecKey) throws -> String {
        var error: Unmanaged<CFError>?
        guard let publicKeyData = SecKeyCopyExternalRepresentation(key, &error) else {
            throw DeviceAuthError.keyExportFailed
        }
        
        return (publicKeyData as Data).base64EncodedString()
    }
    
    private func generateKeychainKeyPair() throws -> SecKey {
        let attributes: [String: Any] = [
            kSecAttrKeyType as String: kSecAttrKeyTypeECSECPrimeRandom,
            kSecAttrKeySizeInBits as String: 256,
            kSecPrivateKeyAttrs as String: [
                kSecAttrIsPermanent as String: true,
                kSecAttrApplicationTag as String: "com.universalai.devicekey"
            ]
        ]
        
        var error: Unmanaged<CFError>?
        guard let privateKey = SecKeyCreateRandomKey(attributes as CFDictionary, &error) else {
            throw DeviceAuthError.keyGenerationFailed
        }
        
        return privateKey
    }
    
    // MARK: - Backend Communication
    
    private func requestAuthChallenge() async throws -> String {
        let url = URL(string: "\(apiService.baseURL)/device-auth/challenge")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(["deviceId": deviceId])
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw DeviceAuthError.challengeFailed
        }
        
        let challengeResponse = try JSONDecoder().decode(ChallengeResponse.self, from: data)
        return challengeResponse.challenge
    }
    
    private func validateProximityToken(_ token: String) async throws {
        let url = URL(string: "\(apiService.baseURL)/device-auth/proximity")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(["token": token, "deviceId": deviceId])
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw DeviceAuthError.proximityAuthFailed
        }
        
        let authResponse = try JSONDecoder().decode(DeviceAuthResponse.self, from: data)
        
        await authService.updateTokens(
            access: authResponse.accessToken,
            refresh: authResponse.refreshToken
        )
    }
    
    private func registerTrustedDevice(_ device: TrustedDevice) async throws {
        let url = URL(string: "\(apiService.baseURL)/device-auth/trust")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        if let token = authService.accessToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        request.httpBody = try JSONEncoder().encode(device)
        
        let (_, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw DeviceAuthError.trustFailed
        }
    }
    
    private func unregisterTrustedDevice(_ device: TrustedDevice) async throws {
        let url = URL(string: "\(apiService.baseURL)/device-auth/untrust/\(device.id)")!
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        
        if let token = authService.accessToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        let (_, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw DeviceAuthError.untrustFailed
        }
    }
    
    // MARK: - Storage
    
    private func storeDeviceCredentials(_ registration: DeviceRegistration) async throws {
        let data = try JSONEncoder().encode(registration)
        
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "com.universalai.deviceauth",
            kSecAttrAccount as String: "device_registration",
            kSecValueData as String: data
        ]
        
        SecItemDelete(query as CFDictionary)
        SecItemAdd(query as CFDictionary, nil)
    }
    
    private func retrieveDeviceToken() async throws -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "com.universalai.deviceauth",
            kSecAttrAccount as String: "device_registration",
            kSecReturnData as String: true
        ]
        
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        
        guard status == errSecSuccess,
              let data = result as? Data,
              let registration = try? JSONDecoder().decode(DeviceRegistration.self, from: data) else {
            return nil
        }
        
        return registration.deviceToken
    }
    
    private func storeTrustedDevices() async throws {
        let data = try JSONEncoder().encode(trustedDevices)
        UserDefaults.standard.set(data, forKey: "trusted_devices")
    }
    
    private func retrieveTrustedDevices() async throws -> [TrustedDevice] {
        guard let data = UserDefaults.standard.data(forKey: "trusted_devices") else {
            return []
        }
        
        return try JSONDecoder().decode([TrustedDevice].self, from: data)
    }
}

// MARK: - Supporting Types

public enum DeviceAuthMethod {
    case deviceToken
    case biometric
    case proximity
    case secureEnclave
}

public enum DeviceConnectionStatus {
    case connected
    case connecting
    case disconnected
    case error(Error)
}

public enum DeviceAuthError: LocalizedError {
    case deviceNotRegistered
    case registrationFailed
    case authenticationFailed
    case untrustedDevice
    case proximityAuthFailed
    case biometricsUnavailable
    case biometricsFailed
    case noDeviceKey
    case signatureFailed
    case keyExportFailed
    case keyGenerationFailed
    case challengeFailed
    case trustFailed
    case untrustFailed
    
    public var errorDescription: String? {
        switch self {
        case .deviceNotRegistered:
            return "Device is not registered"
        case .registrationFailed:
            return "Failed to register device"
        case .authenticationFailed:
            return "Device authentication failed"
        case .untrustedDevice:
            return "Device is not trusted"
        case .proximityAuthFailed:
            return "Proximity authentication failed"
        case .biometricsUnavailable:
            return "Biometric authentication is not available"
        case .biometricsFailed:
            return "Biometric authentication failed"
        case .noDeviceKey:
            return "No device key available"
        case .signatureFailed:
            return "Failed to sign challenge"
        case .keyExportFailed:
            return "Failed to export public key"
        case .keyGenerationFailed:
            return "Failed to generate key pair"
        case .challengeFailed:
            return "Failed to get authentication challenge"
        case .trustFailed:
            return "Failed to trust device"
        case .untrustFailed:
            return "Failed to remove trusted device"
        }
    }
}

// MARK: - Models

struct DeviceRegistrationRequest: Codable {
    let deviceId: String
    let deviceName: String
    let platform: String
    let model: String
    let fingerprint: String
    let publicKey: String
    let capabilities: [String]
}

public struct DeviceRegistration: Codable {
    public let deviceId: String
    public let deviceToken: String
    public let registeredAt: Date
    public let expiresAt: Date?
}

struct DeviceAuthRequest: Codable {
    let deviceId: String
    let deviceToken: String
    let challenge: String
    let signature: String
}

struct DeviceAuthResponse: Codable {
    let accessToken: String
    let refreshToken: String?
    let expiresIn: TimeInterval
}

struct ChallengeResponse: Codable {
    let challenge: String
    let expiresAt: Date
}

public struct TrustedDevice: Codable, Identifiable {
    public let id: String
    public let name: String
    public let platform: String
    public let addedAt: Date
    public var lastSeen: Date
    public let publicKey: String?
}

public struct NearbyDevice: Identifiable {
    public let id: String
    public let name: String
    public let platform: String
    public let distance: ProximityDistance
    public let publicKey: String?
}

public enum ProximityDistance {
    case immediate
    case near
    case far
    case unknown
}

// MARK: - Proximity Auth Manager

class ProximityAuthManager: ObservableObject {
    @Published var nearbyDevices: [NearbyDevice] = []
    private var session: NISession?
    
    func startAdvertising(deviceId: String) async throws {
        // Implementation for proximity advertising
    }
    
    func startScanning() async throws {
        // Implementation for proximity scanning
    }
    
    func exchangeToken(with device: NearbyDevice) async throws -> String {
        // Implementation for secure token exchange
        return UUID().uuidString
    }
}

// MARK: - Secure Enclave Manager

class SecureEnclaveManager {
    static var isAvailable: Bool {
        // Check if Secure Enclave is available on this Mac
        return true // Simplified for now
    }
    
    var isAvailable: Bool {
        Self.isAvailable
    }
    
    func generateKeyPair() throws -> SecKey {
        let access = SecAccessControlCreateWithFlags(
            kCFAllocatorDefault,
            kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
            [.privateKeyUsage, .biometryCurrentSet],
            nil
        )!
        
        let attributes: [String: Any] = [
            kSecAttrKeyType as String: kSecAttrKeyTypeECSECPrimeRandom,
            kSecAttrKeySizeInBits as String: 256,
            kSecAttrTokenID as String: kSecAttrTokenIDSecureEnclave,
            kSecPrivateKeyAttrs as String: [
                kSecAttrIsPermanent as String: true,
                kSecAttrApplicationTag as String: "com.universalai.devicekey.se",
                kSecAttrAccessControl as String: access
            ]
        ]
        
        var error: Unmanaged<CFError>?
        guard let privateKey = SecKeyCreateRandomKey(attributes as CFDictionary, &error) else {
            throw DeviceAuthError.keyGenerationFailed
        }
        
        return privateKey
    }
}

// MARK: - Extensions

extension AuthenticationService {
    func updateTokens(access: String, refresh: String?) async {
        await MainActor.run {
            self.accessToken = access
            if let refresh = refresh {
                self.refreshToken = refresh
            }
            self.isAuthenticated = true
            self.authState = .authenticated
        }
    }
}