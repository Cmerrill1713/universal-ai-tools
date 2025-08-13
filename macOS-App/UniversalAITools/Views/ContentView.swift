import Combine
import SwiftUI
import WebKit

struct ContentView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var apiService: APIService
    @Environment(\.openWindow) private var openWindow
    @State private var columnVisibility: NavigationSplitViewVisibility = .all

    private var sidebarSelectionBinding: Binding<SidebarItem?> {
        Binding<SidebarItem?>(
            get: { appState.selectedSidebarItem },
            set: { appState.selectedSidebarItem = $0 }
        )
    }

    var body: some View {
        mainView
            .onAppear {
                Log.userInterface.info("ContentView appeared")
                updateColumnVisibility(for: appState.selectedSidebarItem)
                
                // Set up window opener closure
                appState.windowOpener = { windowId, value in
                    openWindow(id: windowId, value: value)
                }
            }
            .onChange(of: appState.selectedSidebarItem) { newItem in
                Log.userInterface.debug("Sidebar selection changed to: \(newItem?.rawValue ?? "nil")")
                updateColumnVisibility(for: newItem)
            }
            .task {
                // Kick off backend probe and initial data fetch
                await apiService.connectToBackend()
                await loadInitialData()
            }
            .onReceive(NotificationCenter.default.publisher(for: .metricsUpdate)) { note in
                Task { @MainActor in
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
            }
            .onReceive(NotificationCenter.default.publisher(for: .backendConnected)) { _ in
                Task { @MainActor in
                    appState.backendConnected = true
                }
            }
            .onReceive(NotificationCenter.default.publisher(for: .backendDisconnected)) { _ in
                Task { @MainActor in
                    appState.backendConnected = false
                }
            }
    }

    private var mainView: some View {
        NavigationSplitView(columnVisibility: $columnVisibility) {
            SidebarView(selection: sidebarSelectionBinding)
                .environmentObject(appState)
        } detail: {
            detailView
        }
        .navigationSplitViewStyle(.balanced)
        .background(.ultraThinMaterial)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button(action: { 
                    openWindow(id: "agent-activity", value: "main")
                }) {
                    Image(systemName: "brain.head.profile")
                        .foregroundColor(.accentColor)
                        .glow(color: .accentColor, radius: 4)
                }
                .help("Agent Activity")
                .neumorphism(cornerRadius: 8)
                .frame(width: 32, height: 32)
            }
        }
    }

    private var detailView: some View {
        let view: AnyView
        switch appState.selectedSidebarItem ?? .chat {
        case .chat:
            view = AnyView(SimpleChatView()
                .environmentObject(appState)
                .environmentObject(apiService))
        case .objectives:
            view = AnyView(AgentManagementView()
                .environmentObject(appState)
                .environmentObject(apiService))
        case .tools:
            view = AnyView(ToolsView()
                .environmentObject(appState)
                .environmentObject(apiService))
        }
        return view
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(AnimatedGradientBackground())
            .transition(.scale.combined(with: .opacity))
    }

    private func toggleSidebar() {
        withAnimation(.easeInOut(duration: 0.3)) {
            columnVisibility = columnVisibility == .all ? .detailOnly : .all
        }
    }

    private func updateColumnVisibility(for item: SidebarItem?) {
        // Allow sidebar to be toggled for all views including chat
        // Don't automatically hide sidebar based on selection
                        Log.userInterface.debug("Column visibility maintained")
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
    @State private var logoScale: CGFloat = 1.0

    var body: some View {
        VStack(spacing: 30) {
            Image(systemName: "brain.head.profile")
                .font(.system(size: 80))
                .foregroundColor(.accentColor)
                .scaleEffect(logoScale)
                .glow(color: .accentColor, radius: 20)
                .onAppear {
                    withAnimation(.easeInOut(duration: 2).repeatForever(autoreverses: true)) {
                        logoScale = 1.1
                    }
                }

            Text("Universal AI Tools")
                .font(.largeTitle)
                .fontWeight(.bold)
                .foregroundColor(.white)
                .glow(color: .white, radius: 10)

            Text("Your intelligent companion for AI-powered workflows")
                .font(.title2)
                .foregroundColor(.white.opacity(0.8))
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
        .background(AnimatedGradientBackground())
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
                .fill(.ultraThinMaterial)
        )
        .glassMorphism(cornerRadius: 12)
        .floating(amplitude: 5, duration: 3)
    }
}

#Preview {
    ContentView()
        .environmentObject(AppState())
        .environmentObject(APIService())
}
