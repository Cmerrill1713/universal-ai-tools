import OSLog

enum Log {
    static let app = Logger(subsystem: "com.universalai.tools", category: "app")
    static let network = Logger(subsystem: "com.universalai.tools", category: "network")
    static let webview = Logger(subsystem: "com.universalai.tools", category: "webview")
    static let tests = Logger(subsystem: "com.universalai.tools", category: "tests")
    static let startup = Logger(subsystem: "com.universalai.tools", category: "startup")
    static let errors = Logger(subsystem: "com.universalai.tools", category: "errors")
    static let userInterface = Logger(subsystem: "com.universalai.tools", category: "ui")
    static let mcp = Logger(subsystem: "com.universalai.tools", category: "mcp")
}
