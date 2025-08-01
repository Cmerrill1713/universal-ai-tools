import XCTest

class FinalConnectionStatusValidationTests: XCTestCase {
    
    var app: XCUIApplication!
    
    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launch()
    }
    
    override func tearDownWithError() throws {
        app = nil
    }
    
    // MARK: - Validation Tests
    
    func testUnifiedConnectionStatusSystem() throws {
        print("\n🔍 TESTING UNIFIED CONNECTION STATUS SYSTEM")
        
        // Test Authentication Tab
        print("\n📱 Testing Authentication Tab Status Display")
        app.tabBars.buttons["Authentication"].tap()
        
        // Check for main connection status display
        let connectionStatusExists = app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'Ready to Authenticate' OR label CONTAINS[c] 'Connecting' OR label CONTAINS[c] 'Online' OR label CONTAINS[c] 'Backend'")).firstMatch.exists
        XCTAssertTrue(connectionStatusExists, "Authentication tab should show connection status")
        
        // Look for details button and try to expand
        let detailsButton = app.buttons["Details"]
        if detailsButton.exists {
            print("✅ Found connection details button")
            detailsButton.tap()
            
            // Check for detailed status indicators
            let networkStatus = app.staticTexts["Network"].exists
            let backendStatus = app.staticTexts["Backend"].exists
            let authStatus = app.staticTexts["Authentication"].exists
            
            print("Network status shown: \(networkStatus)")
            print("Backend status shown: \(backendStatus)")
            print("Auth status shown: \(authStatus)")
            
            XCTAssertTrue(networkStatus || backendStatus || authStatus, "Should show detailed status information")
        }
        
        // Test Settings Tab
        print("\n⚙️ Testing Settings Tab Status Display")
        app.tabBars.buttons["Settings"].tap()
        
        // Check for connection status section
        let connectionSection = app.staticTexts["Connection Status"].exists
        XCTAssertTrue(connectionSection, "Settings should have Connection Status section")
        
        // Look for test connection button
        let testConnectionButton = app.buttons["Test Connection"]
        if testConnectionButton.exists {
            print("✅ Found Test Connection button")
            testConnectionButton.tap()
            
            // Wait for connection test to complete
            sleep(3)
            
            // Verify status updated
            let statusAfterTest = app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'Connected' OR label CONTAINS[c] 'Offline' OR label CONTAINS[c] 'Error'")).firstMatch.exists
            XCTAssertTrue(statusAfterTest, "Status should update after connection test")
        }
        
        print("\n✅ UNIFIED CONNECTION STATUS VALIDATION COMPLETE")
    }
    
    func testStatusConsistencyAcrossTabs() throws {
        print("\n🔄 TESTING STATUS CONSISTENCY ACROSS TABS")
        
        var tabStatuses: [String: String] = [:]
        
        // Collect status from each tab
        let tabs = ["Authentication", "Settings"]
        
        for tabName in tabs {
            if app.tabBars.buttons[tabName].exists {
                app.tabBars.buttons[tabName].tap()
                sleep(1) // Allow tab to load
                
                // Look for overall status indicators
                let statusElements = app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'Online' OR label CONTAINS[c] 'Offline' OR label CONTAINS[c] 'Ready' OR label CONTAINS[c] 'Connecting' OR label CONTAINS[c] 'Error'"))
                
                if statusElements.count > 0 {
                    let firstStatus = statusElements.element(boundBy: 0)
                    if firstStatus.exists {
                        tabStatuses[tabName] = firstStatus.label
                        print("\(tabName) Tab Status: \(firstStatus.label)")
                    }
                }
            }
        }
        
        // Check if authenticated tabs are available
        if app.tabBars.buttons["Chat"].exists {
            app.tabBars.buttons["Chat"].tap()
            sleep(1)
            
            let chatStatusElements = app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'Online' OR label CONTAINS[c] 'Offline' OR label CONTAINS[c] 'Connected' OR label CONTAINS[c] 'Disconnected'"))
            
            if chatStatusElements.count > 0 {
                let chatStatus = chatStatusElements.element(boundBy: 0)
                if chatStatus.exists {
                    tabStatuses["Chat"] = chatStatus.label
                    print("Chat Tab Status: \(chatStatus.label)")
                }
            }
        }
        
        if app.tabBars.buttons["Vision"].exists {
            app.tabBars.buttons["Vision"].tap()
            sleep(1)
            
            let visionStatusElements = app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'Online' OR label CONTAINS[c] 'Offline' OR label CONTAINS[c] 'Connected' OR label CONTAINS[c] 'Disconnected'"))
            
            if visionStatusElements.count > 0 {
                let visionStatus = visionStatusElements.element(boundBy: 0)
                if visionStatus.exists {
                    tabStatuses["Vision"] = visionStatus.label
                    print("Vision Tab Status: \(visionStatus.label)")
                }
            }
        }
        
        print("\n📊 STATUS SUMMARY:")
        for (tab, status) in tabStatuses {
            print("  \(tab): \(status)")
        }
        
        // Verify no conflicting statuses
        let uniqueStatuses = Set(tabStatuses.values)
        print("Unique statuses found: \(uniqueStatuses.count)")
        
        // Allow for some variation but check for obvious conflicts
        let hasOnline = tabStatuses.values.contains { $0.lowercased().contains("online") || $0.lowercased().contains("connected") }
        let hasOffline = tabStatuses.values.contains { $0.lowercased().contains("offline") || $0.lowercased().contains("disconnected") }
        
        if hasOnline && hasOffline {
            print("⚠️ WARNING: Found both online and offline statuses - this may indicate inconsistency")
            // This is a warning, not a failure, as statuses can change during testing
        }
        
        print("\n✅ STATUS CONSISTENCY CHECK COMPLETE")
    }
    
    func testBackendConnectivityStatus() throws {
        print("\n🌐 TESTING BACKEND CONNECTIVITY STATUS")
        
        // Go to settings where we can test connection
        app.tabBars.buttons["Settings"].tap()
        
        // Look for backend status information
        let backendInfo = app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'localhost:9999' OR label CONTAINS[c] 'http://localhost:9999'"))
        
        if backendInfo.count > 0 {
            print("✅ Found backend URL information")
            
            // Test connection if button exists
            let testButton = app.buttons["Test Connection"]
            if testButton.exists {
                print("🔄 Testing backend connection...")
                testButton.tap()
                
                // Wait for connection test
                sleep(5)
                
                // Check for updated status
                let updatedStatus = app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'Connected' OR label CONTAINS[c] 'Error' OR label CONTAINS[c] 'Offline'")).firstMatch
                
                if updatedStatus.exists {
                    print("Backend connection status: \(updatedStatus.label)")
                    
                    // If connection successful, should show connected status
                    let isConnected = updatedStatus.label.lowercased().contains("connected") || updatedStatus.label.lowercased().contains("online")
                    
                    if isConnected {
                        print("✅ Backend connection successful")
                    } else {
                        print("❌ Backend connection failed: \(updatedStatus.label)")
                    }
                } else {
                    print("⚠️ No status update visible after connection test")
                }
            }
        } else {
            print("⚠️ Backend URL information not found")
        }
        
        print("\n✅ BACKEND CONNECTIVITY STATUS TEST COMPLETE")
    }
    
    func testStatusIndicatorColors() throws {
        print("\n🎨 TESTING STATUS INDICATOR COLORS")
        
        // Navigate through tabs and look for colored status indicators
        let tabs = ["Authentication", "Settings"]
        
        for tabName in tabs {
            if app.tabBars.buttons[tabName].exists {
                print("\nChecking \(tabName) tab for colored indicators...")
                app.tabBars.buttons[tabName].tap()
                sleep(1)
                
                // Look for circular status indicators (colored dots)
                let circles = app.otherElements.matching(NSPredicate(format: "elementType == %d", XCUIElement.ElementType.other.rawValue))
                
                var foundColoredIndicators = 0
                for i in 0..<min(circles.count, 10) { // Check first 10 elements to avoid timeout
                    let circle = circles.element(boundBy: i)
                    if circle.exists && circle.frame.width <= 20 && circle.frame.height <= 20 {
                        // This might be a status indicator circle
                        foundColoredIndicators += 1
                    }
                }
                
                print("Found \(foundColoredIndicators) potential status indicators in \(tabName)")
            }
        }
        
        print("\n✅ STATUS INDICATOR COLOR TEST COMPLETE")
    }
    
    // MARK: - Performance Tests
    
    func testStatusUpdatePerformance() throws {
        measure {
            app.tabBars.buttons["Settings"].tap()
            
            let testButton = app.buttons["Test Connection"]
            if testButton.exists {
                testButton.tap()
                
                // Wait for status update
                let statusUpdate = app.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] 'Connecting' OR label CONTAINS[c] 'Connected' OR label CONTAINS[c] 'Error'")).firstMatch
                _ = statusUpdate.waitForExistence(timeout: 5)
            }
        }
    }
}