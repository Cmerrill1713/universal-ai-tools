import Foundation

enum NetworkEnvironment {
    case localhost
    case localNetwork(ip: String)
    case public(url: String)
    case ngrok(subdomain: String)
    
    var baseURL: String {
        switch self {
        case .localhost:
            return "http://localhost:9999"
        case .localNetwork(let ip):
            return "http://\(ip):9999"
        case .public(let url):
            return url
        case .ngrok(let subdomain):
            return "https://\(subdomain).ngrok.io"
        }
    }
}

class NetworkConfig {
    static let shared = NetworkConfig()
    
    // Change this to switch between environments
    #if DEBUG
    // For development/testing
    // Change this to your Mac's IP address for physical device testing
    var environment: NetworkEnvironment = .localNetwork(ip: "169.254.105.52")
    #else
    // For production - update with your public server
    var environment: NetworkEnvironment = .public(url: "https://your-server.com:9999")
    #endif
    
    var baseURL: String {
        return environment.baseURL
    }
    
    // Dynamic configuration based on network state
    func configureForCurrentNetwork() {
        // This could check if on WiFi vs Cellular and adjust accordingly
        if isRunningOnSimulator() {
            environment = .localhost
        } else if let localIP = getLocalNetworkIP() {
            environment = .localNetwork(ip: localIP)
        } else {
            // Fallback to ngrok or public server for cellular
            environment = .ngrok(subdomain: "your-ngrok-subdomain")
        }
    }
    
    private func isRunningOnSimulator() -> Bool {
        #if targetEnvironment(simulator)
        return true
        #else
        return false
        #endif
    }
    
    private func getLocalNetworkIP() -> String? {
        // This would detect if on same WiFi network and return Mac's IP
        // For now, return nil to trigger ngrok/public server
        return nil
    }
}

// Usage in your services:
// let baseURL = NetworkConfig.shared.baseURL