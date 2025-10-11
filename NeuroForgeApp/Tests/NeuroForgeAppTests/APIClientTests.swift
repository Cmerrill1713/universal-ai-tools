import XCTest
@testable import NeuroForgeApp

/// Unit tests for APIClient error mapping
final class APIClientTests: XCTestCase {
    
    func testAPIBaseURL() {
        let url = apiBaseURL()
        XCTAssertNotNil(url)
        XCTAssertTrue(url.absoluteString.contains("localhost"))
    }
    
    func testAPIErrorMapping() {
        // Test that validation422 is properly categorized
        let error422 = APIError.validation422(message: "Test")
        XCTAssertEqual(error422.severity, .info)
        
        // Test that service503 is a warning
        let error503 = APIError.service503
        XCTAssertEqual(error503.severity, .warning)
        
        // Test that server5xx is an error
        let error500 = APIError.server5xx(code: 500)
        XCTAssertEqual(error500.severity, .error)
    }
    
    func testErrorDescriptions() {
        let error422 = APIError.validation422(message: "Invalid input")
        XCTAssertTrue(error422.errorDescription?.contains("Invalid input") == true)
        
        let error503 = APIError.service503
        XCTAssertTrue(error503.errorDescription?.contains("unavailable") == true)
        
        let error500 = APIError.server5xx(code: 500)
        XCTAssertTrue(error500.errorDescription?.contains("500") == true)
    }
}

