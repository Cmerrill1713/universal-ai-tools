import Foundation
import XCTest

@discardableResult
func requireUITestHost(file: StaticString = #filePath, line: UInt = #line) throws -> [String: String] {
    let env = ProcessInfo.processInfo.environment
    guard let targetPath = env["XCTestTargetApplicationPath"], !targetPath.isEmpty else {
        throw XCTSkip("UI target application not configured; run via xcodebuild UITesting scheme")
    }
    return env
}
