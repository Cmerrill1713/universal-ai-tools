import SwiftUI

// MARK: - Shared UI Components

// MARK: - Metric Row
struct MetricRow: View {
    let title: String
    let value: String
    let icon: String
    
    var body: some View {
        HStack {
            Image(systemName: icon)
                .foregroundColor(.blue)
                .frame(width: 20)
            
            Text(title)
                .fontWeight(.medium)
            
            Spacer()
            
            Text(value)
                .foregroundColor(.secondary)
                .fontFamily(.monospaced)
        }
    }
}

// MARK: - Detail Row
struct DetailRow: View {
    let label: String
    let value: String
    
    var body: some View {
        HStack {
            Text(label)
                .fontWeight(.medium)
            Spacer()
            Text(value)
                .foregroundColor(.secondary)
                .fontFamily(.monospaced)
        }
    }
}

// MARK: - Metric Item
struct MetricItem: View {
    let label: String
    let value: String
    
    var body: some View {
        HStack {
            Text(label)
                .font(.caption)
                .foregroundColor(.secondary)
            Spacer()
            Text(value)
                .font(.caption)
                .fontFamily(.monospaced)
        }
    }
}

// MARK: - Activity Row
struct ActivityRow: View {
    let update: AgentStatusUpdate
    
    var body: some View {
        HStack {
            Image(systemName: update.status.icon)
                .foregroundColor(update.status.color)
                .frame(width: 20)
            
            VStack(alignment: .leading, spacing: 2) {
                Text("Agent \(update.agentId)")
                    .font(.caption)
                    .fontWeight(.medium)
                
                Text(update.status.rawValue)
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            Text(timeAgoString(from: update.timestamp))
                .font(.caption2)
                .foregroundColor(.secondary)
        }
    }
    
    private func timeAgoString(from date: Date) -> String {
        let interval = Date().timeIntervalSince(date)
        if interval < 60 {
            return "\(Int(interval))s ago"
        } else if interval < 3600 {
            return "\(Int(interval / 60))m ago"
        } else {
            return "\(Int(interval / 3600))h ago"
        }
    }
}

// MARK: - Connection Status Indicator
struct ConnectionStatusIndicator: View {
    let status: ConnectionStatus
    
    var body: some View {
        HStack(spacing: 6) {
            Circle()
                .fill(status.color)
                .frame(width: 8, height: 8)
                .overlay(
                    Circle()
                        .stroke(.white, lineWidth: 1)
                )
                .scaleEffect(status == .connected ? 1.2 : 1.0)
                .animation(.easeInOut(duration: 0.5).repeatForever(autoreverses: true), value: status == .connected)
            
            Text(status.rawValue)
                .font(.caption)
                .foregroundColor(status.color)
        }
    }
}

// MARK: - Connection Row
struct ConnectionRow: View {
    let connection: AgentConnection
    let currentNodeId: String
    
    var body: some View {
        HStack {
            Image(systemName: connection.connectionType == .bidirectional ? "arrow.left.and.right" : "arrow.right")
                .foregroundColor(connection.isActive ? .green : .gray)
            
            Text(connection.fromAgentId == currentNodeId ? connection.toAgentId : connection.fromAgentId)
                .font(.caption)
            
            Spacer()
            
            Text("\(connection.latency, specifier: "%.0f")ms")
                .font(.caption)
                .foregroundColor(.secondary)
        }
    }
}
