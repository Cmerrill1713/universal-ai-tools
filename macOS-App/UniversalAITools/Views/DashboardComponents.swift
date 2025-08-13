import Foundation
import SwiftUI

public struct StatCard: View {
  let title: String
  let value: String
  let icon: String
  let color: Color
  let trend: Trend

  public enum Trend {
    case increase(Int)
    case decrease(Int)
    case stable

    var icon: String {
      switch self {
      case .increase: return "arrow.up.right"
      case .decrease: return "arrow.down.right"
      case .stable: return "minus"
      }
    }

    var color: Color {
      switch self {
      case .increase: return .green
      case .decrease: return .red
      case .stable: return .gray
      }
    }

    var text: String {
      switch self {
      case .increase(let percent): return "+\(percent)%"
      case .decrease(let percent): return "-\(percent)%"
      case .stable: return "0%"
      }
    }
  }

  public var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      HStack {
        Image(systemName: icon)
          .foregroundColor(color)
          .font(.title2)

        Spacer()

        HStack(spacing: 2) {
          Image(systemName: trend.icon)
            .font(.caption)
          Text(trend.text)
            .font(.caption)
        }
        .foregroundColor(trend.color)
      }

      Text(value)
        .font(.title)
        .fontWeight(.semibold)

      Text(title)
        .font(.caption)
        .foregroundColor(.secondary)
    }
    .padding()
    .background(
      RoundedRectangle(cornerRadius: 10, style: .continuous)
        .fill(Color(NSColor.controlBackgroundColor))
        .overlay(
          RoundedRectangle(cornerRadius: 10, style: .continuous)
            .stroke(AppTheme.separator, lineWidth: 1)
        )
    )
  }
}

public struct ChartCard<Content: View>: View {
  let title: String
  let content: Content

  public init(title: String, @ViewBuilder content: () -> Content) {
    self.title = title
    self.content = content()
  }

  public var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      Text(title)
        .font(.subheadline)
        .foregroundColor(.secondary)

      content
    }
    .padding()
    .background(
      RoundedRectangle(cornerRadius: 10, style: .continuous)
        .fill(Color(NSColor.controlBackgroundColor))
        .overlay(
          RoundedRectangle(cornerRadius: 10, style: .continuous)
            .stroke(AppTheme.separator, lineWidth: 1)
        )
    )
    .frame(maxWidth: .infinity)
  }
}

public struct AgentStatusCard: View {
  let agent: Agent

  public var statusColor: Color {
    switch agent.status {
    case .active: return .green
    case .busy: return .orange
    case .error: return .red
    case .inactive: return .gray
    }
  }

  public var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      HStack {
        Circle()
          .fill(statusColor)
          .frame(width: 8, height: 8)

        Text(agent.name)
          .font(.subheadline)
          .fontWeight(.medium)
      }

      Text(agent.type)
        .font(.caption)
        .foregroundColor(.secondary)
    }
    .padding()
    .frame(width: 150)
    .background(
      RoundedRectangle(cornerRadius: 10, style: .continuous)
        .fill(Color(NSColor.controlBackgroundColor))
        .overlay(
          RoundedRectangle(cornerRadius: 10, style: .continuous)
            .stroke(AppTheme.separator, lineWidth: 1)
        )
    )
  }
}

public struct ActivityRow: View {
  let activity: Activity

  public var body: some View {
    HStack {
      Image(systemName: activity.icon)
        .foregroundColor(.secondary)
        .frame(width: 20)

      VStack(alignment: .leading, spacing: 2) {
        Text(activity.title)
          .font(.subheadline)

        Text(activity.description)
          .font(.caption)
          .foregroundColor(.secondary)
      }

      Spacer()

      Text(activity.timestamp)
        .font(.caption2)
        .foregroundColor(.secondary)
    }
    .padding(.vertical, 4)
  }
}

public struct LinkButtonStyle: ButtonStyle {
  public func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .foregroundColor(.accentColor)
      .font(.subheadline)
      .scaleEffect(configuration.isPressed ? 0.95 : 1.0)
  }
}
// Duplicate definitions removed
