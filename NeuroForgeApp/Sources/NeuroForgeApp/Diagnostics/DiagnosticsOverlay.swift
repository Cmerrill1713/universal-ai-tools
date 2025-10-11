import SwiftUI

/// Floating diagnostics panel showing recent network activity
public struct DiagnosticsOverlay: View {
    @State private var recentEvents: [NetworkEvent] = []
    @State private var errorCounts: (e500: Int, e503: Int, e422: Int) = (0, 0, 0)
    
    public init() {}
    
    public var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text("Network Diagnostics")
                    .font(.caption.bold())
                Spacer()
                Text("\(errorCounts.e500)×500 \(errorCounts.e503)×503 \(errorCounts.e422)×422")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
            
            Divider()
            
            ScrollView {
                VStack(alignment: .leading, spacing: 2) {
                    ForEach(Array(recentEvents.prefix(5)), id: \.timestamp) { event in
                        EventChip(event: event)
                    }
                }
            }
            .frame(maxHeight: 150)
        }
        .padding(8)
        .frame(width: 320)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(Color(nsColor: .controlBackgroundColor))
                .shadow(radius: 4)
        )
        .padding()
        .allowsHitTesting(false)  // Don't steal clicks/typing
        .accessibilityHidden(true) // Hide from accessibility tree
        .onReceive(NotificationCenter.default.publisher(for: .networkEventRecorded)) { notification in
            updateFromNotification(notification)
        }
        .onAppear {
            updateEvents()
        }
    }
    
    private func updateFromNotification(_ notification: Notification) {
        guard let userInfo = notification.userInfo,
              let method = userInfo["method"] as? String,
              let url = userInfo["url"] as? String,
              let status = userInfo["status"] as? Int,
              let duration = userInfo["duration"] as? TimeInterval,
              let bytes = userInfo["bytes"] as? Int else {
            return
        }
        
        let event = NetworkEvent(
            method: method,
            url: url,
            statusCode: status,
            duration: duration,
            bytes: bytes,
            timestamp: Date()
        )
        
        recentEvents.insert(event, at: 0)
        if recentEvents.count > 20 {
            recentEvents.removeLast()
        }
        
        errorCounts = InterceptingURLProtocol.recentErrorCounts()
    }
    
    private func updateEvents() {
        recentEvents = InterceptingURLProtocol.getRecentEvents(limit: 20)
        errorCounts = InterceptingURLProtocol.recentErrorCounts()
    }
}

/// Visual chip for a single network event
private struct EventChip: View {
    let event: NetworkEvent
    
    var body: some View {
        HStack(spacing: 4) {
            Circle()
                .fill(statusColor)
                .frame(width: 6, height: 6)
            
            Text("\(event.method)")
                .font(.system(size: 9, weight: .medium, design: .monospaced))
                .frame(width: 35, alignment: .leading)
            
            Text("\(event.statusCode)")
                .font(.system(size: 9, weight: .semibold, design: .monospaced))
                .foregroundColor(statusColor)
                .frame(width: 30, alignment: .center)
            
            Text("\(Int(event.duration))ms")
                .font(.system(size: 9, design: .monospaced))
                .foregroundColor(.secondary)
                .frame(width: 40, alignment: .trailing)
            
            Text(shortURL)
                .font(.system(size: 9, design: .monospaced))
                .lineLimit(1)
                .truncationMode(.middle)
        }
        .padding(.vertical, 2)
        .padding(.horizontal, 4)
        .background(
            RoundedRectangle(cornerRadius: 4)
                .fill(statusColor.opacity(0.1))
        )
    }
    
    private var statusColor: Color {
        if event.statusCode >= 500 && event.statusCode != 503 { return .red }
        if event.statusCode == 503 { return .orange }
        if event.statusCode == 422 { return .blue }
        if event.statusCode >= 400 { return .yellow }
        if event.statusCode >= 200 && event.statusCode < 300 { return .green }
        return .gray
    }
    
    private var shortURL: String {
        let components = event.url.components(separatedBy: "/")
        if components.count > 2 {
            return "/" + components.suffix(2).joined(separator: "/")
        }
        return event.url
    }
}

