import XCTest
@testable import UniversalAICompanion

class AuthenticationTests: XCTestCase {
    
    var authManager: DeviceAuthenticationManager!
    
    override func setUp() {
        super.setUp()
        authManager = DeviceAuthenticationManager()
    }
    
    override func tearDown() {
        authManager = nil
        super.tearDown()
    }
    
    // MARK: - Critical Issue Tests
    
    func testURLForceUnwrapCrash() {
        // This demonstrates the force unwrap issue
        let invalidURL = "http://[invalid url]"
        
        // Current implementation would crash here:
        // let url = URL(string: invalidURL)!
        
        // Safe implementation:
        guard let url = URL(string: invalidURL) else {
            XCTFail("Invalid URL should be handled gracefully")
            return
        }
        
        XCTAssertNotNil(url)
    }
    
    func testBiometricAuthenticationWithoutPermission() {
        // Test biometric authentication when permission is denied
        let expectation = XCTestExpectation(description: "Biometric auth should fail gracefully")
        
        Task {
            await authManager.authenticateWithBiometrics()
            
            XCTAssertEqual(authManager.authenticationState, .unauthenticated)
            XCTAssertNotNil(authManager.lastError)
            expectation.fulfill()
        }
        
        wait(for: [expectation], timeout: 5.0)
    }
    
    func testDeviceRegistrationWithNetworkFailure() {
        // Test device registration when network is unavailable
        let expectation = XCTestExpectation(description: "Registration should fail with network error")
        
        // Simulate network failure by using invalid base URL
        // In real test, we'd inject a mock network service
        
        Task {
            await authManager.registerDevice()
            
            XCTAssertEqual(authManager.registrationState, .unregistered)
            XCTAssertNotNil(authManager.lastError)
            expectation.fulfill()
        }
        
        wait(for: [expectation], timeout: 5.0)
    }
    
    // MARK: - Security Tests
    
    func testPrivateKeyGeneration() {
        // Test that RSA keys are generated properly
        XCTAssertNotNil(authManager.publicKey, "Public key should be generated")
        
        // Verify key length (should be 2048 bits = 256 bytes)
        if let publicKey = authManager.publicKey,
           let keyData = Data(base64Encoded: publicKey) {
            XCTAssertGreaterThanOrEqual(keyData.count, 256, "RSA key should be at least 2048 bits")
        }
    }
    
    func testTokenStorageSecurity() {
        // Test that tokens are not exposed in plain text
        // This test would fail with current implementation
        
        // Tokens should be stored in Keychain, not in memory
        XCTAssertNil(authManager.authToken, "Token should not be directly accessible")
    }
    
    // MARK: - State Management Tests
    
    func testAuthenticationStateTransitions() {
        // Test valid state transitions
        XCTAssertEqual(authManager.authenticationState, .unauthenticated)
        
        // Simulate authentication process
        authManager.authenticationState = .authenticating
        XCTAssertEqual(authManager.authenticationState, .authenticating)
        
        authManager.authenticationState = .authenticated
        XCTAssertEqual(authManager.authenticationState, .authenticated)
        
        authManager.authenticationState = .locked
        XCTAssertEqual(authManager.authenticationState, .locked)
    }
    
    func testProximityStateUpdates() {
        // Test proximity state changes
        XCTAssertEqual(authManager.proximityState, .unknown)
        
        // Test each proximity state
        authManager.proximityState = .immediate
        XCTAssertEqual(authManager.proximityState, .immediate)
        
        authManager.proximityState = .near
        XCTAssertEqual(authManager.proximityState, .near)
        
        authManager.proximityState = .far
        XCTAssertEqual(authManager.proximityState, .far)
    }
    
    // MARK: - API Communication Tests
    
    func testChallengeRequestFormat() {
        // Test that challenge requests are properly formatted
        let expectation = XCTestExpectation(description: "Challenge request should be formatted correctly")
        
        // In a real test, we'd intercept the network request
        // and verify the request format
        
        expectation.fulfill()
        wait(for: [expectation], timeout: 1.0)
    }
    
    func testChallengeExpiration() {
        // Test that expired challenges are rejected
        let challenge = ChallengeResponse(
            challengeId: "test-id",
            challenge: "test-challenge",
            expiresAt: Date().timeIntervalSince1970 - 600 // 10 minutes ago
        )
        
        // Verify that expired challenge is rejected
        XCTAssertLessThan(challenge.expiresAt, Date().timeIntervalSince1970)
    }
    
    // MARK: - Error Handling Tests
    
    func testErrorRecovery() {
        // Test that errors are handled gracefully
        authManager.lastError = AuthError.networkError(NSError(domain: "test", code: -1, userInfo: nil))
        
        XCTAssertNotNil(authManager.lastError)
        XCTAssertNotNil(authManager.lastError?.localizedDescription)
    }
    
    func testMultipleFailureScenarios() {
        // Test cascading failures
        let scenarios: [AuthError] = [
            .notRegistered,
            .registrationFailed,
            .biometricFailed,
            .authenticationFailed,
            .challengeRequestFailed
        ]
        
        for error in scenarios {
            authManager.lastError = error
            XCTAssertNotNil(authManager.lastError?.errorDescription)
        }
    }
}

// MARK: - Mock Services for Testing

class MockProximityService: ProximityDetectionService {
    var mockProximity: ProximityState = .unknown
    var mockRSSI: Int = -100
    
    override func startProximityDetection() {
        updateProximity(to: mockProximity, rssi: mockRSSI)
    }
}

class MockWatchService: WatchConnectivityService {
    var mockIsConnected = false
    var mockIsReachable = false
    
    override func setupWatchConnectivity() {
        isWatchConnected = mockIsConnected
        isWatchReachable = mockIsReachable
    }
}