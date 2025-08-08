import Foundation
import Security

class KeychainService {
    static let shared = KeychainService()
    
    private let service = "com.universalaitools.app"
    private let tokenKey = "authToken"
    private let apiKeyPrefix = "api_key_"
    
    private init() {}
    
    // MARK: - Token Management
    
    func saveToken(_ token: String) -> Bool {
        let data = token.data(using: .utf8)!
        
        // Delete existing token first
        deleteToken()
        
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: tokenKey,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        ]
        
        let status = SecItemAdd(query as CFDictionary, nil)
        return status == errSecSuccess
    }
    
    func getToken() -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: tokenKey,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        
        var dataTypeRef: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &dataTypeRef)
        
        guard status == errSecSuccess,
              let data = dataTypeRef as? Data,
              let token = String(data: data, encoding: .utf8) else {
            return nil
        }
        
        return token
    }
    
    func deleteToken() -> Bool {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: tokenKey
        ]
        
        let status = SecItemDelete(query as CFDictionary)
        return status == errSecSuccess || status == errSecItemNotFound
    }
    
    // MARK: - API Key Management
    
    func saveAPIKey(_ key: String, for service: String) -> Bool {
        let data = key.data(using: .utf8)!
        let account = "\(apiKeyPrefix)\(service)"
        
        // Delete existing key first
        deleteAPIKey(for: service)
        
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: self.service,
            kSecAttrAccount as String: account,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
            kSecAttrLabel as String: "API Key for \(service)"
        ]
        
        let status = SecItemAdd(query as CFDictionary, nil)
        return status == errSecSuccess
    }
    
    func getAPIKey(for service: String) -> String? {
        let account = "\(apiKeyPrefix)\(service)"
        
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: self.service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        
        var dataTypeRef: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &dataTypeRef)
        
        guard status == errSecSuccess,
              let data = dataTypeRef as? Data,
              let key = String(data: data, encoding: .utf8) else {
            return nil
        }
        
        return key
    }
    
    func deleteAPIKey(for service: String) -> Bool {
        let account = "\(apiKeyPrefix)\(service)"
        
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: self.service,
            kSecAttrAccount as String: account
        ]
        
        let status = SecItemDelete(query as CFDictionary)
        return status == errSecSuccess || status == errSecItemNotFound
    }
    
    // MARK: - User Credentials
    
    func saveCredentials(username: String, password: String) -> Bool {
        let credentials = "\(username):\(password)"
        guard let data = credentials.data(using: .utf8) else { return false }
        
        // Delete existing credentials first
        deleteCredentials()
        
        let query: [String: Any] = [
            kSecClass as String: kSecClassInternetPassword,
            kSecAttrServer as String: "localhost",
            kSecAttrPort as String: 9999,
            kSecAttrAccount as String: username,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        ]
        
        let status = SecItemAdd(query as CFDictionary, nil)
        return status == errSecSuccess
    }
    
    func getCredentials() -> (username: String, password: String)? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassInternetPassword,
            kSecAttrServer as String: "localhost",
            kSecAttrPort as String: 9999,
            kSecReturnData as String: true,
            kSecReturnAttributes as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        
        var dataTypeRef: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &dataTypeRef)
        
        guard status == errSecSuccess,
              let result = dataTypeRef as? [String: Any],
              let data = result[kSecValueData as String] as? Data,
              let credentials = String(data: data, encoding: .utf8),
              let username = result[kSecAttrAccount as String] as? String else {
            return nil
        }
        
        let components = credentials.split(separator: ":", maxSplits: 1)
        guard components.count == 2 else { return nil }
        
        return (username: username, password: String(components[1]))
    }
    
    func deleteCredentials() -> Bool {
        let query: [String: Any] = [
            kSecClass as String: kSecClassInternetPassword,
            kSecAttrServer as String: "localhost",
            kSecAttrPort as String: 9999
        ]
        
        let status = SecItemDelete(query as CFDictionary)
        return status == errSecSuccess || status == errSecItemNotFound
    }
    
    // MARK: - Device Authentication
    
    func saveDeviceToken(_ token: String, for deviceId: String) -> Bool {
        let data = token.data(using: .utf8)!
        let account = "device_\(deviceId)"
        
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
            kSecAttrLabel as String: "Device Authentication Token"
        ]
        
        // Delete existing first
        deleteDeviceToken(for: deviceId)
        
        let status = SecItemAdd(query as CFDictionary, nil)
        return status == errSecSuccess
    }
    
    func getDeviceToken(for deviceId: String) -> String? {
        let account = "device_\(deviceId)"
        
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        
        var dataTypeRef: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &dataTypeRef)
        
        guard status == errSecSuccess,
              let data = dataTypeRef as? Data,
              let token = String(data: data, encoding: .utf8) else {
            return nil
        }
        
        return token
    }
    
    func deleteDeviceToken(for deviceId: String) -> Bool {
        let account = "device_\(deviceId)"
        
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
        
        let status = SecItemDelete(query as CFDictionary)
        return status == errSecSuccess || status == errSecItemNotFound
    }
    
    // MARK: - Clear All
    
    func clearAll() -> Bool {
        var success = true
        
        // Clear all generic passwords
        let genericQuery: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service
        ]
        
        let genericStatus = SecItemDelete(genericQuery as CFDictionary)
        if genericStatus != errSecSuccess && genericStatus != errSecItemNotFound {
            success = false
        }
        
        // Clear all internet passwords
        let internetQuery: [String: Any] = [
            kSecClass as String: kSecClassInternetPassword,
            kSecAttrServer as String: "localhost",
            kSecAttrPort as String: 9999
        ]
        
        let internetStatus = SecItemDelete(internetQuery as CFDictionary)
        if internetStatus != errSecSuccess && internetStatus != errSecItemNotFound {
            success = false
        }
        
        return success
    }
}

// MARK: - Extensions

extension Notification.Name {
    static let authTokenChanged = Notification.Name("authTokenChanged")
    static let credentialsUpdated = Notification.Name("credentialsUpdated")
    static let backendConnected = Notification.Name("backendConnected")
    static let backendDisconnected = Notification.Name("backendDisconnected")
}