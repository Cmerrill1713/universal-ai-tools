import SwiftUI
import WebKit
import Combine

struct ContentView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var apiService: APIService
    @State private var columnVisibility: NavigationSplitViewVisibility = .all
    @State private var showingAgentActivity = false

    private var sidebarSelectionBinding: Binding<SidebarItem?> {
        Binding<SidebarItem?>(
            get: { appState.selectedSidebarItem },
            set: { appState.selectedSidebarItem = $0 }
        )
    }

    var body: some View {
        mainView
            .sheet(isPresented: $showingAgentActivity) {
                AgentActivityWindow()
                    .environmentObject(appState)
                    .environmentObject(apiService)
            }
            .onAppear { updateColumnVisibility(for: appState.selectedSidebarItem) }
            .onChange(of: appState.selectedSidebarItem) { newItem in
                updateColumnVisibility(for: newItem)
            }
            .task {
                // Kick off backend probe and initial data fetch
                await apiService.connectToBackend()
                await loadInitialData()
            }
            .onReceive(NotificationCenter.default.publisher(for: .metricsUpdate)) { note in
                if let data = note.userInfo?["data"] as? [String: Any],
                   let cpu = data["cpu"] as? Double,
                   let memory = data["memory"] as? Double,
                   let uptime = data["uptime"] as? Double {
                    appState.systemMetrics = SystemMetrics(
                        cpuUsage: cpu,
                        memoryUsage: memory,
                        uptime: uptime,
                        requestsPerMinute: data["rpm"] as? Int ?? 0,
                        activeConnections: data["connections"] as? Int ?? 0
                    )
                }
            }
            .onReceive(NotificationCenter.default.publisher(for: .backendConnected)) { _ in
                appState.backendConnected = true
            }
            .onReceive(NotificationCenter.default.publisher(for: .backendDisconnected)) { _ in
                appState.backendConnected = false
            }
    }

    private var mainView: some View {
        Group {
            if appState.selectedSidebarItem == .chat {
                // Dock-only layout for Chat: no native sidebar
                detailView
            } else {
                NavigationSplitView(columnVisibility: $columnVisibility) {
                    SidebarView(selection: sidebarSelectionBinding)
                        .environmentObject(appState)
                } detail: {
                    detailView
                }
            }
        }
        .navigationSplitViewStyle(.balanced)
        .toolbar {
            ToolbarItem(placement: .navigation) {
                Button(action: toggleSidebar) {
                    Image(systemName: "sidebar.left")
                }
            }

            ToolbarItem(placement: .primaryAction) {
                Button(action: { showingAgentActivity = true }) {
                    Image(systemName: "brain.head.profile")
                        .foregroundColor(.accentColor)
                }
                .help("Agent Activity")
            }
        }
    }

    private var detailView: some View {
        let view: AnyView
        switch appState.selectedSidebarItem {
        case .chat:
            view = AnyView(ChatInterfaceView()
                .environmentObject(appState)
                .environmentObject(apiService))
        case .agents:
            view = AnyView(AgentManagementView()
                .environmentObject(appState)
                .environmentObject(apiService))
        case .tools:
            if let tools = try? buildToolsView() {
                view = tools
            } else {
                view = AnyView(ContentWelcomeView().environmentObject(appState))
            }
        default:
            view = AnyView(ContentWelcomeView().environmentObject(appState))
        }
        return view
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(AppTheme.windowBackgroundGradient)
    }

    private func buildToolsView() throws -> AnyView {
        AnyView(ToolsView().environmentObject(appState).environmentObject(apiService))
    }

    private func toggleSidebar() {
        withAnimation(.easeInOut(duration: 0.3)) {
            columnVisibility = columnVisibility == .all ? .detailOnly : .all
        }
    }

    private func updateColumnVisibility(for item: SidebarItem?) {
        withAnimation(.easeInOut(duration: 0.25)) {
            if item == .chat {
                columnVisibility = .detailOnly
            } else {
                columnVisibility = .all
            }
        }
    }

    // MARK: - Data Loading
    private func loadInitialData() async {
        do {
            let agents = try await apiService.getAgents()
            await MainActor.run { appState.availableAgents = agents }
        } catch { /* ignore for now */ }

        do {
            let metrics = try await apiService.getMetrics()
            await MainActor.run {
                appState.systemMetrics = metrics
                appState.backendConnected = true
            }
        } catch { /* ignore for now */ }
    }
}

// MARK: - Welcome View
struct ContentWelcomeView: View {
    @EnvironmentObject var appState: AppState

    var body: some View {
        VStack(spacing: 30) {
            Image(systemName: "brain.head.profile")
                .font(.system(size: 80))
                .foregroundColor(.accentColor)

            Text("Universal AI Tools")
                .font(.largeTitle)
                .fontWeight(.bold)

            Text("Your intelligent companion for AI-powered workflows")
                .font(.title2)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)

            VStack(spacing: 20) {
                FeatureCard(
                    icon: "message.and.waveform",
                    title: "AI Chat",
                    description: "Interactive conversations with advanced AI models"
                )

                FeatureCard(
                    icon: "brain.head.profile",
                    title: "AI Agents",
                    description: "Specialized agents for different tasks and workflows"
                )

                FeatureCard(
                    icon: "wrench.and.screwdriver",
                    title: "AI Tools",
                    description: "Powerful tools and utilities powered by AI"
                )
            }
            .padding(.horizontal, 40)

            Spacer()
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(.windowBackgroundColor))
    }
}

struct FeatureCard: View {
    let icon: String
    let title: String
    let description: String

    var body: some View {
        HStack(spacing: 20) {
            Image(systemName: icon)
                .font(.title)
                .foregroundColor(.accentColor)
                .frame(width: 40)

            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.headline)
                    .fontWeight(.semibold)

                Text(description)
                    .font(.body)
                    .foregroundColor(.secondary)
            }

            Spacer()
        }
        .padding()
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(.controlBackgroundColor))
                .shadow(color: .black.opacity(0.1), radius: 2, x: 0, y: 1)
        )
    }
}

#Preview {
    ContentView()
        .environmentObject(AppState())
        .environmentObject(APIService())
}
