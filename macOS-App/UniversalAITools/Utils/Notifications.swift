import Foundation

extension Notification.Name {
    static let backendConnected = Notification.Name("backendConnected")
    static let backendDisconnected = Notification.Name("backendDisconnected")
    static let systemWillSleep = Notification.Name("systemWillSleep")
    static let systemDidWake = Notification.Name("systemDidWake")
    static let websocketConnected = Notification.Name("websocketConnected")
    static let websocketDisconnected = Notification.Name("websocketDisconnected")

    // API / WebSocket payload events
    static let agentUpdate = Notification.Name("agentUpdate")
    static let metricsUpdate = Notification.Name("metricsUpdate")
    static let chatResponse = Notification.Name("chatResponse")
    static let webAPIResponse = Notification.Name("webAPIResponse")

    // Auth / credentials
    static let authTokenChanged = Notification.Name("authTokenChanged")
    static let credentialsUpdated = Notification.Name("credentialsUpdated")

    // MCP events
    static let mcpResourceUpdated = Notification.Name("mcpResourceUpdated")
    static let mcpToolListChanged = Notification.Name("mcpToolListChanged")
}



