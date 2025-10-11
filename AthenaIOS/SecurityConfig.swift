import Foundation
import CryptoKit

/// Security configuration for Athena iOS app
/// This pins the connection to YOUR specific Mac server
struct SecurityConfig {
    // Your Mac's local IP address
    static let serverIP = "192.168.1.198"
    
    // Server certificate fingerprint (SHA-256 hash)
    // This will be generated when you run the SSL setup
    // For now, this is a placeholder - we'll generate the real one
    static let certificateFingerprint = "PLACEHOLDER_WILL_BE_GENERATED"
    
    // Allowed domains (for future cloud deployment)
    static let allowedDomains = [
        "192.168.1.198",
        "localhost"
    ]
    
    /// Validates that we're connecting to the correct server
    static func validateServer(host: String) -> Bool {
        return allowedDomains.contains(host)
    }
    
    /// Certificate pinning validation
    /// This ensures the iPhone ONLY connects to YOUR Mac
    static func validateCertificate(_ trust: SecTrust) -> Bool {
        // For now, allow local network connections
        // When SSL is set up, this will verify the certificate fingerprint
        return true
    }
}

/// Extension to add certificate pinning to URLSession
extension URLSession {
    static var athenaSession: URLSession {
        let configuration = URLSessionConfiguration.default
        let session = URLSession(
            configuration: configuration,
            delegate: AthenaCertificateDelegate(),
            delegateQueue: nil
        )
        return session
    }
}

/// Handles certificate validation for Athena connections
class AthenaCertificateDelegate: NSObject, URLSessionDelegate {
    func urlSession(
        _ session: URLSession,
        didReceive challenge: URLAuthenticationChallenge,
        completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
    ) {
        // Validate that we're connecting to the right server
        guard let serverTrust = challenge.protectionSpace.serverTrust else {
            completionHandler(.cancelAuthenticationChallenge, nil)
            return
        }
        
        // For local development, accept the connection
        // When SSL pinning is set up, this will verify the certificate
        if SecurityConfig.validateServer(host: challenge.protectionSpace.host) {
            let credential = URLCredential(trust: serverTrust)
            completionHandler(.useCredential, credential)
        } else {
            completionHandler(.cancelAuthenticationChallenge, nil)
        }
    }
}

