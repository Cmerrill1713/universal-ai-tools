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
        case .chat:
            ChatInterfaceView()
        case .objectives:
            AgentManagementView()
        case .tools:
            ToolsView()
        case .knowledge:
            KnowledgeGraphView3D()
        }
    }
}

#Preview {
    VStack {
        ContentRouterView(item: .chat, viewMode: .native)
        NativeRouterView(item: .chat)
    }
    .environmentObject(AppState())
    .environmentObject(APIService())
}
