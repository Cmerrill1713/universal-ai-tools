import XCTest
import SwiftUI
import Foundation

class RouterTests: UniversalAIToolsTestSuite {
    func testContentRouterModes() {
        let item: SidebarItem = .analytics

        var view = ContentRouterView(item: item, viewMode: .web)
        XCTAssertNotNil(view)

        view = ContentRouterView(item: item, viewMode: .native)
        XCTAssertNotNil(view)

        view = ContentRouterView(item: item, viewMode: .hybrid)
        XCTAssertNotNil(view)
    }

    func testNativeRouterRoutesAllCases() {
        let all: [SidebarItem] = [
            .chat, .knowledge, .objectives,
            .orchestration, .analytics, .tools
        ]

        for item in all {
            let view = NativeRouterView(item: item)
            XCTAssertNotNil(view, "Router should return a view for \(item.rawValue)")
        }
    }
}


