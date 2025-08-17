import Foundation
import Combine
import LocalAuthentication
import Security
import SwiftUI
import OSLog

// MARK: - Authentication Service
/// Comprehensive authentication service handling JWT tokens, API keys, and device authentication
@MainActor
public final class AuthenticationService: ObservableObject {
    static let shared = AuthenticationService()
    
    // MARK: - Published Properties
    @Published public var isAuthenticated: Bool = false
    @Published public var currentUser: User?
    @Published public var authState: AuthenticationState = .unauthenticated
    @Published public var lastError: AuthenticationError?
    @Published public var biometricAvailable: Bool = false
    
    // MARK: - Token Management
    @Published private(set) var accessToken: String?
    @Published private(set) var refreshToken: String?
    @Published private(set) var apiKeys: [APIKey] = []
    
    // MARK: - Private Properties
    private let keychain = KeychainManager()
    private let apiService: APIService
    private let logger = Logger(subsystem: "com.universalai.tools", category: "AuthenticationService")
    private var cancellables = Set<AnyCancellable>()
    
    // Token refresh
    private var refreshTimer: Timer?
    private let tokenRefreshThreshold: TimeInterval = 300 // Refresh 5 minutes before expiry
    
    // Biometric authentication
    private let laContext = LAContext()
    
    // MARK: - Initialization
    private init() {
        self.apiService = APIService.shared
        setupBiometricAuthentication()
        loadStoredCredentials()
        setupTokenRefresh()
    }
    
    // MARK: - Public Authentication Methods
    
    /// Authenticate with username and password
    public func authenticate(username: String, password: String) async throws {
        authState = .authenticating
        
        do {
            let credentials = LoginCredentials(username: username, password: password)
            let response = try await performLogin(credentials)
            
            // Store tokens securely
            accessToken = response.accessToken
            refreshToken = response.refreshToken
            
            try await keychain.store(token: response.accessToken, type: .access)
            if let refresh = response.refreshToken {
                try await keychain.store(token: refresh, type: .refresh)
            }
            
            // Update user info
            currentUser = response.user
            isAuthenticated = true
            authState = .authenticated
            
            // Start token refresh timer
            scheduleTokenRefresh(expiresIn: response.expiresIn)
            
            logger.info("✅ Authentication successful for user: \(username)")
        } catch {
            handleAuthenticationError(error)
            throw error
        }
    }
    
    /// Authenticate with biometrics
    public func authenticateWithBiometrics() async throws {
        guard biometricAvailable else {
            throw AuthenticationError.biometricsNotAvailable
        }
        
        authState = .authenticating
        
        do {
            // Verify biometric
            let reason = "Authenticate to access Universal AI Tools"
            let success = try await laContext.evaluatePolicy(
                .deviceOwnerAuthenticationWithBiometrics,
                localizedReason: reason
            )
            
            guard success else {
                throw AuthenticationError.biometricsFailed
            }
            
            // Retrieve stored credentials
            guard let storedToken = try await keychain.retrieve(type: .access) else {
                throw AuthenticationError.noStoredCredentials
            }
            
            // Validate token with backend
            let isValid = try await validateToken(storedToken)
            
            if isValid {
                accessToken = storedToken
                isAuthenticated = true
                authState = .authenticated
                
                // Load user info
                await loadUserInfo()
            } else {
                // Token expired, try refresh
                try await refreshAccessToken()
            }
            
            logger.info("✅ Biometric authentication successful")
        } catch {
            handleAuthenticationError(error)
            throw error
        }
    }
    
    /// Generate demo token for testing
    public func generateDemoToken(duration: String = "24h") async throws -> String {
        let request = DemoTokenRequest(
            name: "Demo User",
            purpose: "Testing",
            duration: duration
        )
        
        let url = URL(string: "\(apiService.baseURL)/auth/demo-token")!
        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "POST"
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        urlRequest.httpBody = try JSONEncoder().encode(request)
        
        let (data, response) = try await URLSession.shared.data(for: urlRequest)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw AuthenticationError.invalidResponse
        }
        
        let tokenResponse = try JSONDecoder().decode(DemoTokenResponse.self, from: data)
        
        // Store demo token
        accessToken = tokenResponse.token
        isAuthenticated = true
        authState = .authenticated
        
        logger.info("✅ Demo token generated successfully")
        return tokenResponse.token
    }
    
    /// Create API key for long-term access
    public func createAPIKey(name: String, permissions: [String] = ["api_access"], duration: String = "90d") async throws -> APIKey {
        guard isAuthenticated else {
            throw AuthenticationError.notAuthenticated
        }
        
        let request = APIKeyRequest(
            name: name,
            permissions: permissions,
            duration: duration
        )
        
        let url = URL(string: "\(apiService.baseURL)/auth/api-key")!
        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "POST"
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        urlRequest.setValue("Bearer \(accessToken ?? "")", forHTTPHeaderField: "Authorization")
        urlRequest.httpBody = try JSONEncoder().encode(request)
        
        let (data, response) = try await URLSession.shared.data(for: urlRequest)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw AuthenticationError.invalidResponse
        }
        
        let apiKey = try JSONDecoder().decode(APIKey.self, from: data)
        
        // Store API key securely
        apiKeys.append(apiKey)
        try await keychain.store(apiKey: apiKey)
        
        logger.info("✅ API key created: \(name)")
        return apiKey
    }
    
    /// Register device for device-based authentication
    public func registerDevice(deviceName: String? = nil) async throws -> DeviceRegistration {
        let name = deviceName ?? Host.current().localizedName ?? "Unknown Device"
        let deviceId = getDeviceIdentifier()
        
        let request = DeviceRegistrationRequest(
            deviceId: deviceId,
            deviceName: name,
            platform: "macOS",
            model: getMacModel()
        )
        
        let url = URL(string: "\(apiService.baseURL)/device-auth/register")!
        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "POST"
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token = accessToken {
            urlRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        urlRequest.httpBody = try JSONEncoder().encode(request)
        
        let (data, response) = try await URLSession.shared.data(for: urlRequest)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw AuthenticationError.deviceRegistrationFailed
        }
        
        let registration = try JSONDecoder().decode(DeviceRegistration.self, from: data)
        
        // Store device credentials
        try await keychain.store(deviceRegistration: registration)
        
        logger.info("✅ Device registered: \(name)")
        return registration
    }
    
    // MARK: - Token Management
    
    /// Refresh access token using refresh token
    public func refreshAccessToken() async throws {
        guard let refreshToken = refreshToken ?? (try? await keychain.retrieve(type: .refresh)) else {
            throw AuthenticationError.noRefreshToken
        }
        
        let url = URL(string: "\(apiService.baseURL)/auth/refresh")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(["refreshToken": refreshToken])
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            // Refresh failed, need to re-authenticate
            await logout()
            throw AuthenticationError.tokenRefreshFailed
        }
        
        let tokenResponse = try JSONDecoder().decode(TokenResponse.self, from: data)
        
        // Update tokens
        self.accessToken = tokenResponse.accessToken
        if let newRefresh = tokenResponse.refreshToken {
            self.refreshToken = newRefresh
            try await keychain.store(token: newRefresh, type: .refresh)
        }
        
        try await keychain.store(token: tokenResponse.accessToken, type: .access)
        
        // Reschedule refresh
        scheduleTokenRefresh(expiresIn: tokenResponse.expiresIn)
        
        logger.info("✅ Token refreshed successfully")
    }
    
    /// Validate token with backend
    private func validateToken(_ token: String) async throws -> Bool {
        let url = URL(string: "\(apiService.baseURL)/auth/validate")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(["token": token])
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            return false
        }
        
        let validation = try JSONDecoder().decode(TokenValidation.self, from: data)
        return validation.valid
    }
    
    /// Revoke token or API key
    public func revokeCredential(_ credential: String) async throws {
        let url = URL(string: "\(apiService.baseURL)/auth/revoke")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token = accessToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        request.httpBody = try JSONEncoder().encode(["credential": credential])
        
        let (_, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw AuthenticationError.revocationFailed
        }
        
        logger.info("✅ Credential revoked successfully")
    }
    
    // MARK: - User Management
    
    /// Load user information
    public func loadUserInfo() async {
        guard let token = accessToken else { return }
        
        do {
            let url = URL(string: "\(apiService.baseURL)/auth/info")!
            var request = URLRequest(url: url)
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            
            let (data, response) = try await URLSession.shared.data(for: request)
            
            guard let httpResponse = response as? HTTPURLResponse,
                  httpResponse.statusCode == 200 else {
                return
            }
            
            currentUser = try JSONDecoder().decode(User.self, from: data)
            logger.info("✅ User info loaded")
        } catch {
            logger.error("Failed to load user info: \(error)")
        }
    }
    
    /// Logout and clear credentials
    public func logout() async {
        // Revoke tokens if possible
        if let token = accessToken {
            try? await revokeCredential(token)
        }
        
        // Clear stored credentials
        accessToken = nil
        refreshToken = nil
        currentUser = nil
        isAuthenticated = false
        authState = .unauthenticated
        
        // Clear keychain
        try? await keychain.clearAll()
        
        // Cancel refresh timer
        refreshTimer?.invalidate()
        refreshTimer = nil
        
        logger.info("✅ Logged out successfully")
    }
    
    // MARK: - Private Methods
    
    private func setupBiometricAuthentication() {
        var error: NSError?
        biometricAvailable = laContext.canEvaluatePolicy(
            .deviceOwnerAuthenticationWithBiometrics,
            error: &error
        )
        
        if let error = error {
            logger.error("Biometric setup error: \(error)")
        }
    }
    
    private func loadStoredCredentials() {
        Task {
            // Try to load stored tokens
            if let storedAccess = try? await keychain.retrieve(type: .access) {
                accessToken = storedAccess
                
                // Validate token
                if try await validateToken(storedAccess) {
                    isAuthenticated = true
                    authState = .authenticated
                    await loadUserInfo()
                } else {
                    // Try to refresh
                    try? await refreshAccessToken()
                }
            }
            
            // Load API keys
            apiKeys = (try? await keychain.retrieveAPIKeys()) ?? []
        }
    }
    
    private func setupTokenRefresh() {
        // Monitor authentication state changes
        $accessToken
            .compactMap { $0 }
            .sink { [weak self] _ in
                self?.scheduleTokenRefresh(expiresIn: 3600) // Default 1 hour
            }
            .store(in: &cancellables)
    }
    
    private func scheduleTokenRefresh(expiresIn: TimeInterval) {
        refreshTimer?.invalidate()
        
        let refreshTime = expiresIn - tokenRefreshThreshold
        guard refreshTime > 0 else { return }
        
        refreshTimer = Timer.scheduledTimer(withTimeInterval: refreshTime, repeats: false) { [weak self] _ in
            Task {
                try? await self?.refreshAccessToken()
            }
        }
    }
    
    private func performLogin(_ credentials: LoginCredentials) async throws -> TokenResponse {
        let url = URL(string: "\(apiService.baseURL)/auth/login")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(credentials)
        
        let (data, response) = try await URLSession.shared.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw AuthenticationError.invalidCredentials
        }
        
        return try JSONDecoder().decode(TokenResponse.self, from: data)
    }
    
    private func handleAuthenticationError(_ error: Error) {
        logger.error("Authentication error: \(error)")
        
        if let authError = error as? AuthenticationError {
            lastError = authError
        } else {
            lastError = .unknown(error)
        }
        
        authState = .failed(error)
        isAuthenticated = false
    }
    
    private func getDeviceIdentifier() -> String {
        // Get hardware UUID
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
            return serialNumber
        }
        
        // Fallback to generated UUID
        return UUID().uuidString
    }
    
    private func getMacModel() -> String {
        var size = 0
        sysctlbyname("hw.model", nil, &size, nil, 0)
        var model = [CChar](repeating: 0, count: size)
        sysctlbyname("hw.model", &model, &size, nil, 0)
        return String(cString: model)
    }
}

// MARK: - Authentication Types

public enum AuthenticationState: Equatable {
    case unauthenticated
    case authenticating
    case authenticated
    case failed(Error)
    
    public static func == (lhs: AuthenticationState, rhs: AuthenticationState) -> Bool {
        switch (lhs, rhs) {
        case (.unauthenticated, .unauthenticated),
             (.authenticating, .authenticating),
             (.authenticated, .authenticated):
            return true
        case (.failed, .failed):
            return true
        default:
            return false
        }
    }
}

public enum AuthenticationError: LocalizedError {
    case invalidCredentials
    case noStoredCredentials
    case biometricsNotAvailable
    case biometricsFailed
    case tokenExpired
    case noRefreshToken
    case tokenRefreshFailed
    case invalidResponse
    case notAuthenticated
    case deviceRegistrationFailed
    case revocationFailed
    case unknown(Error)
    
    public var errorDescription: String? {
        switch self {
        case .invalidCredentials:
            return "Invalid username or password"
        case .noStoredCredentials:
            return "No stored credentials found"
        case .biometricsNotAvailable:
            return "Biometric authentication is not available"
        case .biometricsFailed:
            return "Biometric authentication failed"
        case .tokenExpired:
            return "Authentication token has expired"
        case .noRefreshToken:
            return "No refresh token available"
        case .tokenRefreshFailed:
            return "Failed to refresh authentication token"
        case .invalidResponse:
            return "Invalid response from server"
        case .notAuthenticated:
            return "Not authenticated"
        case .deviceRegistrationFailed:
            return "Failed to register device"
        case .revocationFailed:
            return "Failed to revoke credential"
        case .unknown(let error):
            return "Authentication error: \(error.localizedDescription)"
        }
    }
}

// MARK: - Request/Response Models

struct LoginCredentials: Codable {
    let username: String
    let password: String
}

struct TokenResponse: Codable {
    let accessToken: String
    let refreshToken: String?
    let expiresIn: TimeInterval
    let user: User?
}

struct DemoTokenRequest: Codable {
    let name: String?
    let purpose: String?
    let duration: String
}

struct DemoTokenResponse: Codable {
    let token: String
    let expiresAt: Date
}

struct APIKeyRequest: Codable {
    let name: String
    let permissions: [String]
    let duration: String
}

public struct APIKey: Codable, Identifiable {
    public let id: String
    public let name: String
    public let key: String
    public let permissions: [String]
    public let createdAt: Date
    public let expiresAt: Date?
    public let lastUsed: Date?
}

struct DeviceRegistrationRequest: Codable {
    let deviceId: String
    let deviceName: String
    let platform: String
    let model: String
}

public struct DeviceRegistration: Codable {
    public let deviceId: String
    public let deviceToken: String
    public let registeredAt: Date
}

struct TokenValidation: Codable {
    let valid: Bool
    let expiresAt: Date?
}

public struct User: Codable, Identifiable {
    public let id: String
    public let username: String
    public let email: String?
    public let name: String?
    public let role: String?
    public let permissions: [String]?
}

// MARK: - Keychain Manager

class KeychainManager {
    enum TokenType: String {
        case access = "access_token"
        case refresh = "refresh_token"
    }
    
    private let service = "com.universalai.tools"
    
    func store(token: String, type: TokenType) async throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: type.rawValue,
            kSecValueData as String: token.data(using: .utf8)!
        ]
        
        // Delete existing item
        SecItemDelete(query as CFDictionary)
        
        // Add new item
        let status = SecItemAdd(query as CFDictionary, nil)
        guard status == errSecSuccess else {
            throw AuthenticationError.unknown(NSError(domain: NSOSStatusErrorDomain, code: Int(status)))
        }
    }
    
    func retrieve(type: TokenType) async throws -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: type.rawValue,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        
        guard status == errSecSuccess,
              let data = result as? Data,
              let token = String(data: data, encoding: .utf8) else {
            return nil
        }
        
        return token
    }
    
    func store(apiKey: APIKey) async throws {
        let encoder = JSONEncoder()
        let data = try encoder.encode(apiKey)
        
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: "api_key_\(apiKey.id)",
            kSecValueData as String: data
        ]
        
        SecItemDelete(query as CFDictionary)
        
        let status = SecItemAdd(query as CFDictionary, nil)
        guard status == errSecSuccess else {
            throw AuthenticationError.unknown(NSError(domain: NSOSStatusErrorDomain, code: Int(status)))
        }
    }
    
    func retrieveAPIKeys() async throws -> [APIKey] {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecMatchLimit as String: kSecMatchLimitAll,
            kSecReturnAttributes as String: true,
            kSecReturnData as String: true
        ]
        
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        
        guard status == errSecSuccess,
              let items = result as? [[String: Any]] else {
            return []
        }
        
        let decoder = JSONDecoder()
        var apiKeys: [APIKey] = []
        
        for item in items {
            guard let account = item[kSecAttrAccount as String] as? String,
                  account.hasPrefix("api_key_"),
                  let data = item[kSecValueData as String] as? Data,
                  let apiKey = try? decoder.decode(APIKey.self, from: data) else {
                continue
            }
            apiKeys.append(apiKey)
        }
        
        return apiKeys
    }
    
    func store(deviceRegistration: DeviceRegistration) async throws {
        let encoder = JSONEncoder()
        let data = try encoder.encode(deviceRegistration)
        
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: "device_registration",
            kSecValueData as String: data
        ]
        
        SecItemDelete(query as CFDictionary)
        
        let status = SecItemAdd(query as CFDictionary, nil)
        guard status == errSecSuccess else {
            throw AuthenticationError.unknown(NSError(domain: NSOSStatusErrorDomain, code: Int(status)))
        }
    }
    
    func clearAll() async throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service
        ]
        
        SecItemDelete(query as CFDictionary)
    }
}