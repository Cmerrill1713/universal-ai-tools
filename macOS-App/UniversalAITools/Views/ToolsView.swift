import SwiftUI

struct ToolsView: View {
  @EnvironmentObject var appState: AppState
  @EnvironmentObject var apiService: APIService
  @State private var selectedCategory: ToolCategory?
  @State private var searchText = ""

  var body: some View {
    if let selected = selectedCategory {
      toolDetailView(for: selected)
    } else {
      toolsOverview
    }
  }

  private var toolsOverview: some View {
    VStack(spacing: 0) {
      // Header
      toolsHeader

      Divider()
        .background(AppTheme.separator)

      // Search
      searchBar

      Divider()
        .background(AppTheme.separator)

      // Tools Grid
      ScrollView {
        LazyVGrid(columns: gridColumns, spacing: 20) {
          ForEach(filteredTools) { tool in
            ToolCategoryCard(tool: tool) {
              withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
                selectedCategory = tool
                appState.selectedTool = tool
              }
            }
          }
        }
        .padding()
      }
    }
    .background(AnimatedGradientBackground())
    .glassMorphism(cornerRadius: 0)
  }

  private var toolsHeader: some View {
    HStack {
      Button(action: {
        withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
          selectedCategory = nil
          appState.selectedTool = nil
        }
      }) {
        HStack(spacing: 8) {
          if selectedCategory != nil {
            Image(systemName: "chevron.left")
              .font(.caption)
          }
          Image(systemName: "wrench.and.screwdriver")
            .font(.title2)
            .foregroundColor(AppTheme.accentOrange)
        }
      }
      .buttonStyle(.plain)
      .opacity(selectedCategory != nil ? 1 : 0.6)

      VStack(alignment: .leading, spacing: 4) {
        Text(selectedCategory?.title ?? "Tools")
          .font(.title2)
          .fontWeight(.semibold)
          .foregroundColor(AppTheme.primaryText)

        Text(selectedCategory?.description ?? "Powerful AI-powered tools and utilities")
          .font(.subheadline)
          .foregroundColor(AppTheme.secondaryText)
      }

      Spacer()

      // Status indicator
      ConnectionPulse(isConnected: .constant(appState.backendConnected))
    }
    .padding()
  }

  private var searchBar: some View {
    HStack {
      Image(systemName: "magnifyingglass")
        .foregroundColor(AppTheme.tertiaryText)

      TextField("Search tools...", text: $searchText)
        .textFieldStyle(.plain)
        .font(.system(size: 14))
        .foregroundColor(AppTheme.primaryText)

      if !searchText.isEmpty {
        Button(action: { searchText = "" }) {
          Image(systemName: "xmark.circle.fill")
            .foregroundColor(AppTheme.tertiaryText)
        }
        .buttonStyle(.plain)
      }
    }
    .padding(.horizontal, 12)
    .padding(.vertical, 8)
    .background(AppTheme.surfaceBackground)
    .glassMorphism(cornerRadius: 8)
    .padding(.horizontal)
    .padding(.vertical, 8)
  }

  private var filteredTools: [ToolCategory] {
    if searchText.isEmpty {
      return ToolCategory.allCases
    } else {
      return ToolCategory.allCases.filter {
        $0.title.localizedCaseInsensitiveContains(searchText)
          || $0.description.localizedCaseInsensitiveContains(searchText)
      }
    }
  }

  private var gridColumns: [GridItem] {
    [
      GridItem(.adaptive(minimum: 300, maximum: 350), spacing: 20)
    ]
  }

  @ViewBuilder
  private func toolDetailView(for category: ToolCategory) -> some View {
    switch category {
    case .mlx:
      MLXFineTuningView()
        .environmentObject(appState)
        .environmentObject(apiService)
    case .vision:
      VisionProcessingView()
        .environmentObject(appState)
        .environmentObject(apiService)
    case .monitoring:
      SystemMonitoringView()
        .environmentObject(appState)
        .environmentObject(apiService)
    case .abMcts:
      PlaceholderView(
        title: "AB-MCTS",
        icon: "tree",
        description: "AlphaBeta Monte Carlo Tree Search orchestration"
      )
    case .maltSwarm:
      PlaceholderView(
        title: "MALT Swarm",
        icon: "network",
        description: "Multi-Agent Learning and Teaching swarm coordination"
      )
    case .parameters:
      PlaceholderView(
        title: "Parameters",
        icon: "slider.horizontal.3",
        description: "Intelligent parameter optimization settings"
      )
    case .knowledge:
      KnowledgeBaseView()
        .environmentObject(appState)
        .environmentObject(MCPService())
    case .debugging:
      DebugConsoleView()
        .environmentObject(appState)
        .environmentObject(apiService)
    case .guiGrounding:
      GUIGroundingView()
        .environmentObject(appState)
    }
  }
}

// MARK: - Tool Category Card
struct ToolCategoryCard: View {
  let tool: ToolCategory
  let onTap: () -> Void
  @State private var isHovered = false

  var body: some View {
    ParticleButton(action: onTap) {
      VStack(alignment: .leading, spacing: 16) {
        // Header
        HStack {
          Image(systemName: tool.icon)
            .font(.system(size: 32))
            .foregroundColor(AppTheme.accentBlue)
            .glow(color: AppTheme.accentBlue, radius: isHovered ? 10 : 0)
            .frame(width: 50, height: 50)
            .background(
              Circle()
                .fill(AppTheme.accentBlue.opacity(0.1))
            )

          Spacer()

          // Arrow indicator
          Image(systemName: "arrow.up.right")
            .font(.caption)
            .foregroundColor(AppTheme.tertiaryText)
            .opacity(isHovered ? 1 : 0.6)
        }

        // Title and Description
        VStack(alignment: .leading, spacing: 8) {
          Text(tool.title)
            .font(.headline)
            .fontWeight(.semibold)
            .foregroundColor(AppTheme.primaryText)

          Text(tool.description)
            .font(.subheadline)
            .foregroundColor(AppTheme.secondaryText)
            .lineLimit(3)
            .multilineTextAlignment(.leading)
        }

        Spacer()
      }
      .padding(20)
      .frame(height: 160)
      .background(AppTheme.surfaceBackground)
      .glassMorphism(cornerRadius: 16)
      .glow(color: isHovered ? AppTheme.accentOrange : .clear, radius: isHovered ? 8 : 0)
      .scaleEffect(isHovered ? 1.02 : 1.0)
      .animation(.spring(response: 0.3, dampingFraction: 0.8), value: isHovered)
    }
    .onHover { hovering in
      isHovered = hovering
    }
    .transition(.scale.combined(with: .opacity))
  }
}

#Preview {
  ToolsView()
    .environmentObject(AppState())
    .environmentObject(APIService())
}
