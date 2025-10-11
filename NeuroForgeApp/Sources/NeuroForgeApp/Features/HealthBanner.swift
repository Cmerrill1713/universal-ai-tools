import SwiftUI

/// Displays backend health status with autodiscovery and reconnect
public struct HealthBanner: View {
    enum HealthState { case checking, ok, degraded503, error, reconnecting }
    
    @State private var state: HealthState = .checking
    @State private var text = "Checking backend..."
    @State private var currentURL = ""
    
    private let client = APIClient()
    
    public init() {}
    
    public var body: some View {
        HStack(spacing: 8) {
            Circle()
                .frame(width: 8, height: 8)
                .foregroundStyle(color)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(text)
                    .font(.caption)
                if !currentURL.isEmpty {
                    Text(currentURL)
                        .font(.system(size: 9))
                        .foregroundColor(.secondary)
                }
            }
            
            Spacer()
            
            // Reconnect button temporarily disabled due to Swift concurrency constraints
            // TODO: Implement reconnect with proper MainActor isolation
        }
        .padding(6)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(color.opacity(0.12))
        )
        .accessibilityIdentifier("health_banner")
        .task { @MainActor in
            await check()
        }
        .onReceive(Timer.publish(every: 30, on: .main, in: .common).autoconnect()) { _ in
            Task { @MainActor in await check() }
        }
    }
    
    private var color: Color {
        switch state {
        case .ok: return .green
        case .degraded503: return .yellow
        case .checking, .reconnecting: return .gray
        case .error: return .red
        }
    }
    
    @MainActor
    private func check() async {
        struct Health: Decodable { let status: String? }
        
        currentURL = apiBaseURL().absoluteString
        
        do {
            let _: Health = try await client.get("/health")
            state = .ok
            text = "Connected"
        } catch APIError.service503 {
            state = .degraded503
            text = "Degraded (503)"
        } catch APIError.transport(let error) {
            state = .error
            text = "Disconnected"
            print("❌ Health check failed: \(error.localizedDescription)")
        } catch {
            state = .error
            text = "Disconnected"
            print("❌ Health check failed: \(error.localizedDescription)")
        }
    }
    
}
