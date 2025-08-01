import Foundation

// TEMPORARY TESTING CONFIGURATION
// Update this file with your ngrok URL for cellular testing

extension NetworkConfig {
    // STEP 1: Get ngrok auth token
    // Go to: https://dashboard.ngrok.com/signup (free account)
    // Get token at: https://dashboard.ngrok.com/get-started/your-authtoken
    
    // STEP 2: Configure ngrok
    // Run: ngrok config add-authtoken YOUR_TOKEN
    
    // STEP 3: Start ngrok tunnel
    // Run: ngrok http 9999
    
    // STEP 4: Update this URL with the one ngrok gives you
    static let testingURL = "https://YOUR-NGROK-ID.ngrok-free.app"
    
    // To use ngrok URL for testing:
    func useTestingURL() {
        self.environment = .public(url: NetworkConfig.testingURL)
    }
}

// Quick test URLs for different scenarios:
struct TestURLs {
    static let localhost = "http://localhost:9999"
    static let localIP = "http://192.168.1.100:9999" // Update with your Mac's IP
    static let ngrok = "https://example.ngrok-free.app" // Update after running ngrok
    static let production = "https://your-server.com:9999" // Future production URL
}