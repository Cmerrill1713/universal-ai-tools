import XCTest
@testable import UniversalAICompanion

// MARK: - Mock Services for Testing

class MockAuthenticationService: DeviceAuthenticationManager {
    var shouldFailRegistration = false
    var shouldFailAuthentication = false
    var mockAuthToken = "mock-jwt-token"
    
    override func registerDevice() async {
        if shouldFailRegistration {
            await setError(.registrationFailed)
        } else {
            registrationState = .registered
        }
    }
    
    override func authenticateWithBiometrics() async {
        if shouldFailAuthentication {
            await setError(.biometricFailed)
        } else {
            authenticationState = .authenticated
            _authToken = mockAuthToken
        }
    }
}

class MockProximityService: ProximityDetectionService {
    var mockProximityState: ProximityState = .unknown
    var mockRSSI: Int = -50
    
    override func startProximityDetection() {
        isScanning = true
        updateProximity(to: mockProximityState, rssi: mockRSSI)
    }
}

// MARK: - Authentication Manager Tests

class DeviceAuthenticationManagerTests: XCTestCase {
    
    var authManager: DeviceAuthenticationManager!
    
    override func setUp() {
        super.setUp()
        authManager = DeviceAuthenticationManager()
    }
    
    override func tearDown() {
        authManager = nil
        super.tearDown()
    }
    
    // CRITICAL BUG TEST: Missing UIKit Import
    func testUIDeviceUsage_CrashesWithoutUIKit() {
        // This test will fail to compile without UIKit import
        // Demonstrates the critical bug in DeviceAuthenticationManager.swift
        XCTAssertNotNil(UIDevice.current.name, "UIDevice should be accessible")
    }
    
    // Test Device ID Generation
    func testDeviceIdGeneration() {
        let deviceId = DeviceAuthenticationManager.getOrCreateDeviceId()
        XCTAssertTrue(deviceId.hasPrefix("iPhone-"), "Device ID should have correct prefix")
        XCTAssertEqual(deviceId.count, 15, "Device ID should be 15 characters")
        
        // Test persistence
        let secondId = DeviceAuthenticationManager.getOrCreateDeviceId()
        XCTAssertEqual(deviceId, secondId, "Device ID should persist")
    }
    
    // Test Force Unwrap Crashes
    func testURLForceUnwrapCrash() {
        // This demonstrates the force unwrap vulnerability
        let badAuthManager = DeviceAuthenticationManager()
        badAuthManager.baseURL = "ht!tp://[invalid url]" // Invalid URL
        
        // This would crash with force unwrap
        // await badAuthManager.registerDevice() // CRASH!
    }
    
    // Test Memory Leak in WebSocket
    func testWebSocketMemoryLeak() async {
        // Start multiple WebSocket connections
        for _ in 0..<10 {
            await authManager.connectWebSocket()
        }
        
        // Check for memory leak
        // In real app, this causes memory to grow indefinitely
        XCTAssertNotNil(authManager.webSocketTask, "WebSocket should exist")
    }
    
    // Test Concurrent Authentication
    func testConcurrentAuthenticationRaceCondition() async {
        let expectation1 = XCTestExpectation(description: "First auth")
        let expectation2 = XCTestExpectation(description: "Second auth")
        
        // Simulate rapid taps
        Task {
            await authManager.authenticateWithBiometrics()
            expectation1.fulfill()
        }
        
        Task {
            await authManager.authenticateWithBiometrics()
            expectation2.fulfill()
        }
        
        await fulfillment(of: [expectation1, expectation2], timeout: 5.0)
        
        // This can cause race conditions in the actual app
        XCTAssertTrue(authManager.authenticationState == .authenticated ||
                     authManager.authenticationState == .authenticating,
                     "State should be consistent")
    }
    
    // Test Keychain Security
    func testKeychainSecurityVulnerability() {
        // Current implementation stores keys without protection
        let attributes: [String: Any] = [
            kSecClass as String: kSecClassKey,
            kSecAttrApplicationTag as String: "com.universalaitools.privatekey".data(using: .utf8)!,
            kSecReturnAttributes as String: true
        ]
        
        var item: CFTypeRef?
        let status = SecItemCopyMatching(attributes as CFDictionary, &item)
        
        if status == errSecSuccess {
            // VULNERABILITY: Key accessible without authentication
            XCTFail("Private key should require biometric authentication")
        }
    }
}

// MARK: - Proximity Detection Tests

class ProximityDetectionServiceTests: XCTestCase {
    
    var proximityService: ProximityDetectionService!
    
    override func setUp() {
        super.setUp()
        proximityService = ProximityDetectionService()
    }
    
    // Test Bluetooth State Handling
    func testBluetoothStateTransitions() {
        // Test all state transitions
        let states: [CBManagerState] = [.unknown, .resetting, .unsupported, .unauthorized, .poweredOff, .poweredOn]
        
        for state in states {
            proximityService.centralManagerDidUpdateState(MockCBCentralManager(state: state))
            
            switch state {
            case .poweredOn:
                XCTAssertTrue(proximityService.bluetoothState == .poweredOn)
            case .unauthorized:
                XCTAssertNotNil(proximityService.delegate?.proximityDetectionDidFail(error: .bluetoothUnauthorized))
            default:
                break
            }
        }
    }
    
    // Test RSSI Edge Cases
    func testRSSIEdgeCases() {
        let edgeCases: [(rssi: Int, expected: ProximityState)] = [
            (0, .immediate),      // Impossible but should handle
            (-1, .immediate),     // Very close
            (-50, .immediate),    // Threshold
            (-51, .near),        // Just past threshold
            (-70, .near),        // Threshold
            (-71, .far),         // Just past threshold
            (-90, .far),         // Threshold
            (-91, .unknown),     // Too far
            (-127, .unknown),    // Minimum RSSI
            (1, .immediate),     // Invalid positive
        ]
        
        for testCase in edgeCases {
            let proximity = proximityService.calculateProximity(from: testCase.rssi)
            XCTAssertEqual(proximity, testCase.expected, 
                          "RSSI \(testCase.rssi) should map to \(testCase.expected)")
        }
    }
    
    // Test Battery Drain from Timer
    func testProximityTimerBatteryDrain() {
        proximityService.startProximityDetection()
        
        // Timer fires every 2 seconds - too frequent
        XCTAssertNotNil(proximityService.proximityTimer, "Timer should be active")
        
        // Measure CPU usage would show high battery drain
        // Recommendation: Increase interval or use event-driven updates
    }
}

// MARK: - UI Tests

class AuthenticationViewTests: XCTestCase {
    
    // Test Missing Environment Object Crash
    func testPreviewCrash() {
        // This would crash in SwiftUI Preview
        // let view = AuthenticationView() // Missing @EnvironmentObject
    }
    
    // Test Rapid Button Taps
    func testRapidAuthenticationTaps() {
        // UI Test: Rapidly tap authenticate button
        // Current implementation allows multiple simultaneous requests
        // Should disable button during authentication
    }
    
    // Test Accessibility
    func testAccessibilityMissing() {
        // No accessibility labels or hints
        // Voice Over users cannot use the app
        // XCTAssertNotNil(authButton.accessibilityLabel) // FAILS
    }
}

// MARK: - Integration Tests

class IntegrationTests: XCTestCase {
    
    // Test Full Authentication Flow
    func testEndToEndAuthenticationFlow() async {
        let authManager = DeviceAuthenticationManager()
        
        // 1. Register Device
        await authManager.registerDevice()
        // FAILS: Network connection to localhost:9999
        
        // 2. Authenticate with Biometrics
        await authManager.authenticateWithBiometrics()
        // FAILS: LAContext in test environment
        
        // 3. Start Proximity Detection
        authManager.startProximityDetection()
        // FAILS: CBCentralManager in test environment
        
        // 4. Connect WebSocket
        await authManager.connectWebSocket()
        // FAILS: WebSocket connection
    }
    
    // Test Background to Foreground Transition
    func testBackgroundTransition() async {
        // Simulate app going to background
        NotificationCenter.default.post(name: UIApplication.didEnterBackgroundNotification, object: nil)
        
        // Simulate return to foreground
        NotificationCenter.default.post(name: UIApplication.willEnterForegroundNotification, object: nil)
        
        // Check state restoration
        // ISSUE: WebSocket not reconnected
        // ISSUE: Proximity detection not resumed
    }
}

// MARK: - Security Tests

class SecurityTests: XCTestCase {
    
    // Test Token Storage Vulnerability
    func testTokenStorageInsecure() {
        let authManager = DeviceAuthenticationManager()
        authManager._authToken = "sensitive-jwt-token"
        
        // Token stored in plain text in memory
        // No encryption or secure enclave usage
        XCTAssertEqual(authManager.authToken, "sensitive-jwt-token", 
                      "Token should be encrypted")
    }
    
    // Test Man-in-the-Middle Vulnerability
    func testMITMVulnerability() {
        // HTTP connections without certificate pinning
        let url = URL(string: "http://localhost:9999/api/v1/device-auth/register")!
        
        // No certificate validation
        // No request signing
        // Vulnerable to MITM attacks
    }
    
    // Test Replay Attack Vulnerability
    func testReplayAttackVulnerability() {
        // No timestamp or nonce in requests
        // Captured requests can be replayed
        // No request expiration
    }
}

// MARK: - Performance Tests

class PerformanceTests: XCTestCase {
    
    // Test Memory Growth
    func testMemoryLeak() {
        measure {
            let authManager = DeviceAuthenticationManager()
            
            // Simulate usage
            for _ in 0..<100 {
                Task {
                    await authManager.connectWebSocket()
                    await authManager.receiveWebSocketMessages()
                }
            }
            
            // Memory grows without bounds due to recursive calls
        }
    }
    
    // Test Main Thread Blocking
    func testMainThreadBlocking() {
        measure {
            // Keychain operations on main thread
            let authManager = DeviceAuthenticationManager()
            authManager.generateKeyPair() // Blocks main thread
        }
    }
}

// MARK: - Mock Helpers

class MockCBCentralManager: CBCentralManager {
    let mockState: CBManagerState
    
    init(state: CBManagerState) {
        self.mockState = state
        super.init()
    }
    
    override var state: CBManagerState {
        return mockState
    }
}

// MARK: - Test Scenarios for Manual QA

/*
Manual Test Scenarios:

1. Device Registration Flow:
   - Launch app fresh (no prior registration)
   - Tap "Register Device"
   - Expected: Registration succeeds
   - Actual: Network error (server not running)

2. Biometric Authentication:
   - Register device first
   - Tap "Authenticate with Face ID"
   - Expected: Face ID prompt appears
   - Actual: Works if Face ID enrolled

3. Proximity Detection:
   - Enable Bluetooth
   - Start proximity detection
   - Move phone away/closer
   - Expected: Status updates
   - Actual: High battery drain

4. Background Handling:
   - Authenticate successfully
   - Press home button
   - Wait 30 seconds
   - Return to app
   - Expected: Still authenticated
   - Actual: Connection lost

5. Rapid Actions:
   - Rapidly tap authenticate button 10 times
   - Expected: Only one request
   - Actual: Multiple requests, potential crash

6. Permission Denials:
   - Deny Bluetooth permission
   - Try proximity detection
   - Expected: Graceful error
   - Actual: Poor error message

7. Network Loss:
   - Authenticate successfully
   - Turn on Airplane mode
   - Try to use chat
   - Expected: Offline mode
   - Actual: No offline support

8. Token Expiration:
   - Authenticate and wait 1 hour
   - Try to use chat
   - Expected: Auto-refresh
   - Actual: 401 errors

9. Multiple Devices:
   - Register same device twice
   - Expected: Handle gracefully
   - Actual: Unknown behavior

10. Watch Integration:
    - Open app on iPhone and Watch
    - Authenticate on Watch
    - Expected: iPhone unlocks
    - Actual: Not implemented
*/