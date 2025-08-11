import SwiftUI

struct ContentRouterView: View {
    let item: SidebarItem
    let viewMode: ViewMode

    var body: some View {
        switch viewMode {
        case .webView:
            NativeRouterView(item: item) // fallback: remove missing RoutedWebViewContainer
        case .native:
            NativeRouterView(item: item)
        case .hybrid:
            NativeRouterView(item: item) // fallback: remove missing HybridView
        }
    }
}

struct NativeRouterView: View {
    let item: SidebarItem

    var body: some View {
        switch item {
        case .dashboard:
            DashboardView()
        case .chat:
            ChatInterfaceView()
        case .agents:
            AgentManagementView()
        case .tools:
            ToolsView()
        case .mlx:
            MLXFineTuningView()
        case .vision:
            VisionProcessingView()
        case .monitoring:
            SystemMonitoringView()
        case .abMcts:
            ABMCTSOrchestrationView()
        case .maltSwarm:
            MALTSwarmControlView()
        case .parameters:
            IntelligentParametersView()
        case .knowledge:
            KnowledgeBaseView()
        case .debugging:
            DebugConsoleView()
        }
    }
}

#Preview {
    VStack {
        ContentRouterView(item: .dashboard, viewMode: .native)
        NativeRouterView(item: .chat)
    }
    .environmentObject(AppState())
    .environmentObject(APIService())
}


