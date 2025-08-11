import XCTest
@testable import UniversalAIToolsClient

final class UniversalAIToolsClientTests: XCTestCase {
  func testBuilds() throws {
    // Simple compile-time sanity test
    _ = APIClient(baseURL: URL(string: "http://127.0.0.1:9999")!)
  }
}


