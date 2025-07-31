import XCTest

class AuthenticationUITests: XCTestCase {
    
    var app: XCUIApplication!
    
    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launch()
    }
    
    override func tearDownWithError() throws {
        app = nil
    }
    
    // MARK: - Registration Flow Tests
    
    func testDeviceRegistrationFlow() throws {
        // Navigate to authentication tab
        app.tabBars.buttons["Authentication"].tap()
        
        // Verify registration prompt is shown
        XCTAssertTrue(app.staticTexts["Device Registration Required"].exists)
        
        // Tap register button
        let registerButton = app.buttons["Register Device"]
        XCTAssertTrue(registerButton.exists)
        registerButton.tap()
        
        // Wait for registration to complete (or fail)
        let registrationComplete = app.staticTexts["Device registered successfully"].waitForExistence(timeout: 10)
        if !registrationComplete {
            // Check for error message
            XCTAssertTrue(app.alerts.firstMatch.exists, "Should show error alert if registration fails")
        }
    }
    
    func testBiometricAuthenticationFlow() throws {
        // This test requires a registered device
        // In real testing, we'd use a mock or test account
        
        app.tabBars.buttons["Authentication"].tap()
        
        // Look for authenticate button
        let authenticateButton = app.buttons.matching(identifier: "Authenticate with").firstMatch
        
        if authenticateButton.exists {
            authenticateButton.tap()
            
            // Biometric prompt will appear (cannot be automated)
            // Check for result after timeout
            sleep(3)
            
            // Verify state change
            let authenticated = app.staticTexts["Authenticated"].waitForExistence(timeout: 5)
            let authFailed = app.staticTexts["Not Authenticated"].exists
            
            XCTAssertTrue(authenticated || authFailed, "Should show authentication result")
        }
    }
    
    // MARK: - Proximity Visualization Tests
    
    func testProximityVisualization() throws {
        app.tabBars.buttons["Authentication"].tap()
        
        // Check if proximity visualization exists
        let proximitySection = app.otherElements["Proximity Detection"]
        
        if proximitySection.exists {
            // Verify proximity indicator elements
            XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'Close' OR label CONTAINS 'Near' OR label CONTAINS 'Far'")).firstMatch.exists)
        }
    }
    
    // MARK: - Animation Performance Tests
    
    func testAuthenticationAnimationPerformance() throws {
        app.tabBars.buttons["Authentication"].tap()
        
        measure {
            // Trigger state change animation
            if app.buttons["Reconnect"].exists {
                app.buttons["Reconnect"].tap()
                
                // Wait for animation to complete
                _ = app.staticTexts["Connecting..."].waitForExistence(timeout: 2)
            }
        }
    }
    
    // MARK: - Error Handling Tests
    
    func testNetworkErrorHandling() throws {
        // Disable network (would need to be done at system level)
        // For now, test error UI elements exist
        
        app.tabBars.buttons["Authentication"].tap()
        
        // Check for connection status indicator
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'Connected' OR label CONTAINS 'Disconnected'")).firstMatch.exists)
        
        // Verify reconnect button exists
        XCTAssertTrue(app.buttons["Reconnect"].exists)
    }
    
    // MARK: - Accessibility Tests
    
    func testVoiceOverSupport() throws {
        app.tabBars.buttons["Authentication"].tap()
        
        // Enable VoiceOver (cannot be automated, but check elements have labels)
        let authButton = app.buttons.matching(identifier: "Authenticate with").firstMatch
        
        if authButton.exists {
            XCTAssertNotEqual(authButton.label, "", "Button should have accessibility label")
        }
        
        // Check status indicators have labels
        let statusText = app.staticTexts.firstMatch
        XCTAssertNotEqual(statusText.label, "", "Status should have accessibility label")
    }
    
    // MARK: - Tab Navigation Tests
    
    func testTabNavigation() throws {
        // Test authentication tab
        app.tabBars.buttons["Authentication"].tap()
        XCTAssertTrue(app.navigationBars["Universal AI Tools"].exists)
        
        // Chat tab should only appear when authenticated
        let chatTab = app.tabBars.buttons["Chat"]
        
        // If chat tab exists, user is authenticated
        if chatTab.exists {
            chatTab.tap()
            XCTAssertTrue(app.textFields["Type your message..."].exists)
        }
    }
    
    // MARK: - Device Information Tests
    
    func testDeviceInfoDisplay() throws {
        app.tabBars.buttons["Authentication"].tap()
        
        // Scroll to device info section
        app.swipeUp()
        
        // Check device information is displayed
        XCTAssertTrue(app.staticTexts["Device Information"].exists)
        XCTAssertTrue(app.staticTexts["Device"].exists)
        XCTAssertTrue(app.staticTexts["Model"].exists)
        XCTAssertTrue(app.staticTexts["iOS Version"].exists)
    }
    
    // MARK: - Connection Status Tests
    
    func testConnectionIndicators() throws {
        app.tabBars.buttons["Authentication"].tap()
        
        // Check connection indicators exist
        XCTAssertTrue(app.staticTexts["Backend"].exists)
        XCTAssertTrue(app.staticTexts["Bluetooth"].exists)
        XCTAssertTrue(app.staticTexts["Watch"].exists)
    }
    
    // MARK: - Performance Tests
    
    func testLaunchPerformance() throws {
        if #available(iOS 15.0, *) {
            measure(metrics: [XCTApplicationLaunchMetric()]) {
                XCUIApplication().launch()
            }
        }
    }
}

// MARK: - Helper Extensions

extension XCUIElement {
    func clearAndTypeText(_ text: String) {
        guard let stringValue = self.value as? String else {
            XCTFail("Tried to clear and type text into a non string value")
            return
        }
        
        self.tap()
        let deleteString = String(repeating: XCUIKeyboardKey.delete.rawValue, count: stringValue.count)
        self.typeText(deleteString)
        self.typeText(text)
    }
}