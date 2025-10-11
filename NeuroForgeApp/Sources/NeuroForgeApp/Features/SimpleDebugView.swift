import SwiftUI

/// Debug view showing API configuration and network diagnostics
public struct SimpleDebugView: View {
    @State private var networkEvents: [(String, String)] = []
    @State private var healthData: String = "Loading..."
    @State private var openAPIData: String = "Not loaded"
    
    @AppStorage("showDiagnosticsOverlay") private var showDiagnostics: Bool = false
    @EnvironmentObject var errorCenter: ErrorCenter
    
    private let client = APIClient()
    
    public init() {}
    
    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                // API Base URL
                GroupBox("API Configuration") {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text("Base URL:")
                                .font(.caption.bold())
                            Spacer()
                            Text(apiBaseURL().absoluteString)
                                .font(.system(size: 11, design: .monospaced))
                                .textSelection(.enabled)
                        }
                        
                        Text("Set via: API_BASE env var → Info.plist → fallback")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                    .padding(8)
                }
                
                // Diagnostics Toggle
                GroupBox("Diagnostics") {
                    VStack(alignment: .leading, spacing: 8) {
                        Toggle("Show Diagnostics Overlay", isOn: $showDiagnostics)
                            .accessibilityIdentifier("debug_toggle_diag")
                        
                        Text("Floating panel with recent network activity")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    .padding(8)
                }
                
                // Recent Network Events
                GroupBox("Recent Network Events") {
                    VStack(alignment: .leading, spacing: 4) {
                        if networkEvents.isEmpty {
                            Text("No events yet")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        } else {
                            ForEach(Array(networkEvents.enumerated()), id: \.offset) { _, event in
                                HStack(spacing: 4) {
                                    Text(event.0)
                                        .font(.system(size: 10, design: .monospaced))
                                        .foregroundColor(event.0.contains("500") || event.0.contains("503") ? .red : .green)
                                        .frame(width: 30, alignment: .center)
                                    
                                    Text(event.1)
                                        .font(.system(size: 10, design: .monospaced))
                                        .lineLimit(1)
                                }
                            }
                        }
                    }
                    .frame(maxHeight: 200)
                    .padding(8)
                }
                .onReceive(NotificationCenter.default.publisher(for: .networkEventRecorded)) { notification in
                    if let userInfo = notification.userInfo,
                       let status = userInfo["status"] as? Int,
                       let url = userInfo["url"] as? String,
                       let duration = userInfo["duration"] as? TimeInterval {
                        let event = ("\(status)", "\(Int(duration))ms \(url)")
                        networkEvents.insert(event, at: 0)
                        if networkEvents.count > 20 {
                            networkEvents.removeLast()
                        }
                    }
                }
                
                // Health Check
                GroupBox("Health Check") {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(healthData)
                            .font(.system(size: 11, design: .monospaced))
                            .textSelection(.enabled)
                        
                        Button("Refresh Health") {
                            Task { await fetchHealth() }
                        }
                    }
                    .padding(8)
                }
                
                // OpenAPI Schema
                GroupBox("OpenAPI Schema") {
                    VStack(alignment: .leading, spacing: 8) {
                        ScrollView(.horizontal) {
                            Text(openAPIData)
                                .font(.system(size: 10, design: .monospaced))
                                .textSelection(.enabled)
                        }
                        .frame(maxHeight: 150)
                        
                        Button("Load OpenAPI") {
                            Task { await fetchOpenAPI() }
                        }
                    }
                    .padding(8)
                }
                
                // Recent Errors
                GroupBox("Recent Errors") {
                    VStack(alignment: .leading, spacing: 4) {
                        if errorCenter.recentErrors.isEmpty {
                            Text("No errors")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        } else {
                            ForEach(Array(errorCenter.recentErrors.prefix(10)), id: \.self) { error in
                                Text(error)
                                    .font(.system(size: 10, design: .monospaced))
                                    .foregroundColor(.red)
                            }
                        }
                    }
                    .frame(maxHeight: 150)
                    .padding(8)
                }
            }
            .padding()
        }
        .task {
            await fetchHealth()
        }
    }
    
    private func fetchHealth() async {
        struct HealthResponse: Decodable {
            let status: String?
            let timestamp: String?
            let service: String?
        }
        
        do {
            let health: HealthResponse = try await client.get("/health")
            healthData = """
            Status: \(health.status ?? "unknown")
            Service: \(health.service ?? "unknown")
            Time: \(health.timestamp ?? "unknown")
            """
        } catch {
            healthData = "Error: \(error.localizedDescription)"
        }
    }
    
    private func fetchOpenAPI() async {
        struct OpenAPIResponse: Decodable {
            let openapi: String?
            let info: Info?
            let paths: [String: AnyCodable]?
            
            struct Info: Decodable {
                let title: String?
                let version: String?
            }
        }
        
        do {
            let api: OpenAPIResponse = try await client.get("/openapi.json")
            var text = "OpenAPI: \(api.openapi ?? "unknown")\n"
            text += "Title: \(api.info?.title ?? "unknown")\n"
            text += "Version: \(api.info?.version ?? "unknown")\n"
            text += "Endpoints: \(api.paths?.keys.count ?? 0)\n"
            if let paths = api.paths {
                text += "\nPaths:\n"
                for (path, _) in paths.sorted(by: { $0.key < $1.key }).prefix(10) {
                    text += "  \(path)\n"
                }
            }
            openAPIData = text
        } catch {
            openAPIData = "Error: \(error.localizedDescription)"
        }
    }
}

