import XCTest

class ConnectionStatusUITests: XCTestCase {
    
    var app: XCUIApplication!
    
    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launch()
    }
    
    override func tearDownWithError() throws {
        app = nil
    }
    
    // MARK: - Connection Status Audit Tests
    
    func testIdentifyAllConnectionStatusIndicators() throws {
        print("\n🔍 STARTING COMPREHENSIVE CONNECTION STATUS AUDIT")
        
        // Check Authentication Tab
        print("\n📱 TESTING AUTHENTICATION TAB")
        app.tabBars.buttons["Authentication"].tap()
        
        let authTabElements = findAllStatusIndicators(in: app, context: "Authentication Tab")
        print("Found \(authTabElements.count) status indicators in Authentication tab:")
        for element in authTabElements {
            print("  - \(element)")
        }
        
        // Check if Chat tab is available (when authenticated)
        let chatTabButton = app.tabBars.buttons["Chat"]
        if chatTabButton.exists {
            print("\n💬 TESTING CHAT TAB")
            chatTabButton.tap()
            
            let chatTabElements = findAllStatusIndicators(in: app, context: "Chat Tab")
            print("Found \(chatTabElements.count) status indicators in Chat tab:")
            for element in chatTabElements {
                print("  - \(element)")
            }
        } else {
            print("\n💬 CHAT TAB NOT AVAILABLE (user not authenticated)")
        }
        
        // Check Vision tab if available
        let visionTabButton = app.tabBars.buttons["Vision"]
        if visionTabButton.exists {
            print("\n👁️ TESTING VISION TAB")
            visionTabButton.tap()
            
            let visionTabElements = findAllStatusIndicators(in: app, context: "Vision Tab")
            print("Found \(visionTabElements.count) status indicators in Vision tab:")
            for element in visionTabElements {
                print("  - \(element)")
            }
        } else {
            print("\n👁️ VISION TAB NOT AVAILABLE (user not authenticated)")
        }
        
        // Check Settings Tab
        print("\n⚙️ TESTING SETTINGS TAB")  
        app.tabBars.buttons["Settings"].tap()
        
        let settingsTabElements = findAllStatusIndicators(in: app, context: "Settings Tab")
        print("Found \(settingsTabElements.count) status indicators in Settings tab:")
        for element in settingsTabElements {
            print("  - \(element)")
        }
        
        print("\n✅ CONNECTION STATUS AUDIT COMPLETE")
    }
    
    func testBackendConnectivity() throws {
        print("\n🌐 TESTING BACKEND CONNECTIVITY")
        
        // Go to authentication tab and look for connection indicators
        app.tabBars.buttons["Authentication"].tap()
        
        // Look for any connection or status indicators
        let connectionTexts = [
            "Online", "Offline", "Connected", "Disconnected", "Connecting",
            "Connection Error", "Backend", "Server", "localhost:9999"
        ]
        
        var foundStatuses: [String] = []
        for text in connectionTexts {
            let elements = app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] %@", text))
            if elements.count > 0 {
                for i in 0..<elements.count {
                    let element = elements.element(boundBy: i)
                    if element.exists && element.isHittable {
                        foundStatuses.append("\(text): '\(element.label)'")
                    }
                }
            }
        }
        
        print("Found connection status indicators:")
        for status in foundStatuses {
            print("  - \(status)")
        }
        
        // Look for reconnect or refresh buttons
        let actionButtons = ["Reconnect", "Refresh", "Retry", "Connect"]
        var foundButtons: [String] = []
        
        for buttonText in actionButtons {
            let button = app.buttons[buttonText]
            if button.exists {
                foundButtons.append(buttonText)
                print("Found action button: \(buttonText)")
            }
        }
        
        // Test backend connectivity by triggering a reconnect if available
        if let reconnectButton = foundButtons.first {
            print("Testing backend connectivity with \(reconnectButton) button...")
            app.buttons[reconnectButton].tap()
            
            // Wait for connection attempt
            sleep(3)
            
            // Check updated status
            let updatedStatuses = findAllStatusIndicators(in: app, context: "After Reconnect")
            print("Status after reconnect attempt:")
            for status in updatedStatuses {
                print("  - \(status)")
            }
        }
    }
    
    func testIdentifyStatusInconsistencies() throws {
        print("\n🔍 IDENTIFYING STATUS INCONSISTENCIES")
        
        var allStatusTexts: [String: [String]] = [:]
        
        // Collect all status indicators from all tabs
        let tabs = ["Authentication", "Settings"]
        
        for tabName in tabs {
            if app.tabBars.buttons[tabName].exists {
                app.tabBars.buttons[tabName].tap()
                sleep(1) // Allow tab to load
                
                let statuses = findAllStatusIndicators(in: app, context: tabName)
                allStatusTexts[tabName] = statuses
            }
        }
        
        // Check for authenticated tabs
        if app.tabBars.buttons["Chat"].exists {
            app.tabBars.buttons["Chat"].tap()
            sleep(1)
            let chatStatuses = findAllStatusIndicators(in: app, context: "Chat")
            allStatusTexts["Chat"] = chatStatuses
        }
        
        if app.tabBars.buttons["Vision"].exists {
            app.tabBars.buttons["Vision"].tap()
            sleep(1)
            let visionStatuses = findAllStatusIndicators(in: app, context: "Vision")
            allStatusTexts["Vision"] = visionStatuses
        }
        
        // Analyze for inconsistencies
        print("\n📊 STATUS ANALYSIS BY TAB:")
        for (tab, statuses) in allStatusTexts {
            print("\n\(tab) Tab:")
            for status in statuses {
                print("  - \(status)")
            }
        }
        
        // Look for conflicting status messages
        let allStatuses = allStatusTexts.values.flatMap { $0 }
        let connectionRelatedStatuses = allStatuses.filter { status in
            status.lowercased().contains("connect") || 
            status.lowercased().contains("online") || 
            status.lowercased().contains("offline") ||
            status.lowercased().contains("server") ||
            status.lowercased().contains("backend")
        }
        
        print("\n⚠️ CONNECTION-RELATED STATUS MESSAGES:")
        for status in connectionRelatedStatuses {
            print("  - \(status)")
        }
        
        // Check for obvious inconsistencies
        let hasOnline = connectionRelatedStatuses.contains { $0.lowercased().contains("online") }
        let hasDisconnected = connectionRelatedStatuses.contains { $0.lowercased().contains("disconnect") }
        
        if hasOnline && hasDisconnected {
            print("\n🚨 INCONSISTENCY DETECTED: Found both 'Online' and 'Disconnected' status indicators!")
            XCTFail("Status inconsistency: Found conflicting connection status indicators")
        }
    }
    
    // MARK: - Helper Methods
    
    private func findAllStatusIndicators(in app: XCUIApplication, context: String) -> [String] {
        var indicators: [String] = []
        
        // Common status-related keywords
        let statusKeywords = [
            "connected", "disconnected", "connecting", "online", "offline",
            "authenticated", "unauthenticated", "authenticating", "locked",
            "backend", "server", "api", "bluetooth", "watch", "proximity",
            "status", "state", "error", "success", "failed", "loading"
        ]
        
        // Collect all text elements
        let allTexts = app.staticTexts.allElementsBoundByAccessibilityElement
        
        for textElement in allTexts {
            if textElement.exists && textElement.isHittable {
                let label = textElement.label.lowercased()
                
                // Check if this text contains status-related keywords
                for keyword in statusKeywords {
                    if label.contains(keyword) {
                        indicators.append("[\(context)] \(textElement.label)")
                        break
                    }
                }
                
                // Also check for specific patterns
                if label.contains(":") || 
                   label.starts(with: "not ") ||
                   label.contains("...") ||
                   label.contains("localhost") {
                    indicators.append("[\(context)] \(textElement.label)")
                }
            }
        }
        
        // Check for colored indicators (status dots, etc.)
        let circles = app.otherElements.matching(NSPredicate(format: "elementType == %@", NSNumber(value: XCUIElement.ElementType.other.rawValue)))
        for i in 0..<circles.count {
            let circle = circles.element(boundBy: i)
            if circle.exists && circle.accessibilityLabel != nil && !circle.accessibilityLabel!.isEmpty {
                indicators.append("[\(context)] Status Indicator: \(circle.accessibilityLabel!)")
            }
        }
        
        return Array(Set(indicators)) // Remove duplicates
    }
    
    func testNetworkStatusVsBackendStatus() throws {
        print("\n🌐 TESTING NETWORK STATUS VS BACKEND STATUS DISTINCTION")
        
        app.tabBars.buttons["Authentication"].tap()
        
        // Look for different types of status indicators
        let networkIndicators = app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'network' OR label CONTAINS[c] 'wifi' OR label CONTAINS[c] 'cellular'"))
        let backendIndicators = app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'backend' OR label CONTAINS[c] 'server' OR label CONTAINS[c] 'api' OR label CONTAINS[c] 'localhost'"))
        let authIndicators = app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'authenticated' OR label CONTAINS[c] 'auth' OR label CONTAINS[c] 'biometric'"))
        
        print("Network Status Indicators: \(networkIndicators.count)")
        for i in 0..<networkIndicators.count {
            let element = networkIndicators.element(boundBy: i)
            if element.exists {
                print("  - \(element.label)")
            }
        }
        
        print("Backend Status Indicators: \(backendIndicators.count)")
        for i in 0..<backendIndicators.count {
            let element = backendIndicators.element(boundBy: i)
            if element.exists {
                print("  - \(element.label)")
            }
        }
        
        print("Authentication Status Indicators: \(authIndicators.count)")
        for i in 0..<authIndicators.count {
            let element = authIndicators.element(boundBy: i)
            if element.exists {
                print("  - \(element.label)")
            }
        }
    }
    
    // MARK: - Performance Tests
    
    func testStatusUpdatePerformance() throws {
        measure {
            app.tabBars.buttons["Authentication"].tap()
            
            // If there's a reconnect button, test the update performance
            if app.buttons["Reconnect"].exists {
                app.buttons["Reconnect"].tap()
                
                // Wait for status to update
                let connectionStatus = app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'connect'")).firstMatch
                _ = connectionStatus.waitForExistence(timeout: 5)
            }
        }
    }
}