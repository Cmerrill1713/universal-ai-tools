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
            set: { newValue in
                if let newValue = newValue {
                    appState.selectedSidebarItem = newValue
                }
            }
        )
    }

    var body: some View {
        mainView
            .overlay(
                // Onboarding overlay
                Group {
                    if appState.showOnboarding {
                        OnboardingFlow {
                            appState.completeOnboarding()
                        }
                        .zIndex(1000)
                    }
                }
            )
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
            ToolbarItemGroup(placement: .primaryAction) {
                Button(action: { 
                    appState.showOnboarding = true
                }) {
                    Image(systemName: "questionmark.circle")
                        .foregroundColor(.blue)
                }
                .help("Show Feature Tour")
                
                EnhancedUIComponents.EnhancedActionButton(
                    title: "",
                    icon: "brain.head.profile",
                    action: { 
                        openWindow(id: "agent-activity", value: "main")
                    },
                    style: .primary
                )
                .help("Agent Activity")
            }
        }
    }

    @ViewBuilder
    private var detailView: some View {
        ZStack {
            Group {
                switch appState.selectedSidebarItem ?? .chat {
                case .chat:
                    SimpleChatView()
                        .environmentObject(appState)
                        .environmentObject(apiService)
                case .claude:
                    ClaudeAIChatView()
                        .environmentObject(appState)
                        .environmentObject(apiService)
                case .knowledge:
                    KnowledgeGraphView3D()
                        .environmentObject(appState)
                        .environmentObject(apiService)
                case .objectives:
                    AgentManagementView()
                        .environmentObject(appState)
                        .environmentObject(apiService)
                case .orchestration:
                    AgentOrchestrationDashboard()
                        .environmentObject(appState)
                        .environmentObject(apiService)
                case .analytics:
                    ContextFlowDashboard()
                        .environmentObject(appState)
                        .environmentObject(apiService)
                case .tools:
                    ToolsView()
                        .environmentObject(appState)
                        .environmentObject(apiService)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(AnimatedGradientBackground())
            .clipped() // Ensure content doesn't extend beyond bounds
            .transition(.scale.combined(with: .opacity))
            .id(appState.selectedSidebarItem?.rawValue ?? "chat") // Force view refresh when selection changes
            
            // Enhanced loading overlay
            if appState.isLoading {
                ZStack {
                    Color.black.opacity(0.3)
                        .edgesIgnoringSafeArea(.all)
                    
                    EnhancedUIComponents.EnhancedLoadingIndicator(
                        message: "Loading Universal AI Tools..."
                    )
                    .frame(width: 200, height: 120)
                }
                .transition(.opacity)
            }
        }
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
        // Show enhanced loading state
        await MainActor.run {
            appState.isLoading = true
        }
        
        do {
            let agents = try await apiService.getAgents()
            await MainActor.run { 
                appState.availableAgents = agents
            }
        } catch { 
            Log.api.error("Failed to load agents: \(error)")
        }

        do {
            let metrics = try await apiService.getMetrics()
            await MainActor.run {
                appState.systemMetrics = metrics
                appState.backendConnected = true
            }
        } catch { 
            Log.api.error("Failed to load metrics: \(error)")
        }
        
        await MainActor.run {
            appState.isLoading = false
        }
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
                ContentFeatureCard(
                    icon: "message.and.waveform",
                    title: "AI Chat",
                    description: "Interactive conversations with advanced AI models"
                )

                ContentFeatureCard(
                    icon: "brain.head.profile",
                    title: "AI Agents",
                    description: "Specialized agents for different tasks and workflows"
                )

                ContentFeatureCard(
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

struct ContentFeatureCard: View {
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
