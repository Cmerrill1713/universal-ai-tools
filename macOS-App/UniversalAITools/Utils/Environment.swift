import Foundation

enum EnvironmentContext {
    static var isRunningInXcodePreviews: Bool {
        ProcessInfo.processInfo.environment["XCODE_RUNNING_FOR_PREVIEWS"] == "1"
    }

    static var isRunningUITests: Bool {
        ProcessInfo.processInfo.arguments.contains("UI-TESTING")
    }
}
