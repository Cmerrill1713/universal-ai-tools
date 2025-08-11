import XCTest
import SwiftUI

class RouterTests: UniversalAIToolsTestSuite {
    func testContentRouterModes() {
        let item: SidebarItem = .dashboard

        var view = ContentRouterView(item: item, viewMode: .webView)
        XCTAssertNotNil(view)

        view = ContentRouterView(item: item, viewMode: .native)
        XCTAssertNotNil(view)

        view = ContentRouterView(item: item, viewMode: .hybrid)
        XCTAssertNotNil(view)
    }

    func testNativeRouterRoutesAllCases() {
        let all: [SidebarItem] = [
            .dashboard, .chat, .agents, .mlx, .vision,
            .monitoring, .abMcts, .maltSwarm, .parameters,
            .knowledge, .debugging,
        ]

        for item in all {
            let view = NativeRouterView(item: item)
            XCTAssertNotNil(view, "Router should return a view for \(item.rawValue)")
        }
    }
}


