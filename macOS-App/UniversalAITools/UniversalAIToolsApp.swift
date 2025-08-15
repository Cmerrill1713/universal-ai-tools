import Combine
import OSLog
import SwiftUI

@main
struct UniversalAIToolsApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    @StateObject private var appState = AppState()
    @StateObject private var apiService = APIService()
    @StateObject private var mcpService = MCPService()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(appState)
                .environmentObject(apiService)
                .environmentObject(mcpService)
                .frame(minWidth: 1200, minHeight: 800)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .onAppear {
                    setupApplication()
                }
                .sheet(isPresented: $appState.showAboutWindow) {
                    AboutView()
                        .frame(width: 400, height: 320)
                }
        }
        .windowStyle(.titleBar)
        .windowToolbarStyle(.unified(showsTitle: true))
        .commands {
            CommandGroup(replacing: .appInfo) {
                Button("About Universal AI Tools") {
                    appState.showAboutWindow = true
                }
            }
            CommandGroup(replacing: .newItem) {
                Button("New Chat") {
                    appState.createNewChat()
                }
                .keyboardShortcut("n", modifiers: .command)

                Button("New Agent Task") {
                    appState.showAgentSelector = true
                }
                .keyboardShortcut("t", modifiers: .command)
            }
            CommandMenu("View") {
                Button("Toggle Sidebar") {
                    appState.sidebarVisible.toggle()
                }
                .keyboardShortcut("s", modifiers: [.command, .option])
                
                Button("Search...") {
                    appState.showGlobalSearch = true
                }
                .keyboardShortcut("f", modifiers: .command)

                Divider()

                Button("Show Web Dashboard") {
                    appState.viewMode = .webView
                }
                Button("Show Native UI") {
                    appState.viewMode = .native
                }
                Button("Show Hybrid View") {
                    appState.viewMode = .hybrid
                }
            }
            CommandMenu("AI Tools") {
                Button("Agent Activity Monitor") {
                    appState.openAgentActivityWindow()
                }
                .keyboardShortcut("1", modifiers: [.command, .option])

                Button("MLX Fine-Tuning") {
                    appState.openMLXWindow()
                }
                .keyboardShortcut("2", modifiers: [.command, .option])

                Button("Vision Processing") {
                    appState.openVisionWindow()
                }
                .keyboardShortcut("3", modifiers: [.command, .option])

                Divider()

                Button("AB-MCTS Orchestration") {
                    appState.openABMCTSWindow()
                }
                Button("MALT Swarm Control") {
                    appState.openMALTSwarmWindow()
                }

                Button("System Monitor") {
                    appState.openSystemMonitorWindow()
                }

                Button("Agent Selector") {
                    appState.openAgentSelectorWindow()
                }
            }
        }

        Settings {
            SettingsView()
                .environmentObject(appState)
                .environmentObject(apiService)
                .environmentObject(mcpService)
        }

        // Agent Activity Window
        WindowGroup("Agent Activity", id: "agent-activity", for: String.self) { _ in
            AgentActivityWindow()
                .environmentObject(appState)
                .environmentObject(apiService)
                .environmentObject(mcpService)
        }
        .windowStyle(.titleBar)
        .windowToolbarStyle(.unified(showsTitle: true))
        .defaultSize(width: 700, height: 600)

        // Agent Selector Window
        WindowGroup("Agent Selector", id: "agent-selector", for: String.self) { _ in
            AgentSelectorView()
                .environmentObject(appState)
                .environmentObject(apiService)
                .environmentObject(mcpService)
        }
        .windowStyle(.titleBar)
        .windowToolbarStyle(.unified(showsTitle: true))
        .defaultSize(width: 600, height: 500)

        // System Monitoring Window
        WindowGroup("System Monitor", id: "system-monitor", for: String.self) { _ in
            SystemMonitoringView()
                .environmentObject(appState)
                .environmentObject(apiService)
                .environmentObject(mcpService)
        }
        .windowStyle(.titleBar)
        .windowToolbarStyle(.unified(showsTitle: true))
        .defaultSize(width: 800, height: 600)

        // MLX Fine-Tuning Window
        WindowGroup("MLX Fine-Tuning", id: "mlx-finetuning", for: String.self) { _ in
            MLXFineTuningView()
                .environmentObject(appState)
                .environmentObject(apiService)
                .environmentObject(mcpService)
        }
        .windowStyle(.titleBar)
        .windowToolbarStyle(.unified(showsTitle: true))
        .defaultSize(width: 900, height: 700)

        // Vision Processing Window
        WindowGroup("Vision Processing", id: "vision-processing", for: String.self) { _ in
            VisionProcessingView()
                .environmentObject(appState)
                .environmentObject(apiService)
                .environmentObject(mcpService)
        }
        .windowStyle(.titleBar)
        .windowToolbarStyle(.unified(showsTitle: true))
        .defaultSize(width: 900, height: 700)

        // AB-MCTS Orchestration Window
        WindowGroup("AB-MCTS Orchestration", id: "ab-mcts", for: String.self) { _ in
            ABMCTSOrchestrationView()
                .environmentObject(appState)
                .environmentObject(apiService)
                .environmentObject(mcpService)
        }
        .windowStyle(.titleBar)
        .windowToolbarStyle(.unified(showsTitle: true))
        .defaultSize(width: 800, height: 600)

        // MALT Swarm Control Window
        WindowGroup("MALT Swarm Control", id: "malt-swarm", for: String.self) { _ in
            MALTSwarmControlView()
                .environmentObject(appState)
                .environmentObject(apiService)
                .environmentObject(mcpService)
        }
        .windowStyle(.titleBar)
        .windowToolbarStyle(.unified(showsTitle: true))
        .defaultSize(width: 800, height: 600)

        // Menu Bar Extra for quick access
        MenuBarExtra("Universal AI Tools", systemImage: "brain") {
            MenuBarView()
                .environmentObject(appState)
                .environmentObject(apiService)
                .environmentObject(mcpService)
        }
        .menuBarExtraStyle(.window)
    }

    private func setupApplication() {
        Log.startup.info("🚀 Universal AI Tools starting up")
        Log.startup.debug("Environment - Previews: \(EnvironmentContext.isRunningInXcodePreviews), UI Tests: \(EnvironmentContext.isRunningUITests)")
        
        // Configure app appearance
        NSApplication.shared.appearance = NSAppearance(named: appState.darkMode ? .darkAqua : .aqua)
        Log.startup.debug("App appearance set to: \(appState.darkMode ? "dark" : "light")")

        // Force Native UI as default view mode
        appState.viewMode = .native
        UserDefaults.standard.set("native", forKey: "viewMode")
        Log.startup.info("View mode set to native")

        // Skip network work in Xcode Previews and UI tests
        if EnvironmentContext.isRunningInXcodePreviews || EnvironmentContext.isRunningUITests {
            Log.startup.debug("Skipping backend connection for previews/tests")
        } else {
            Log.startup.info("Starting backend connections...")
            // Connect to backend
            Task {
                Log.network.info("Attempting backend connection...")
                await apiService.connectToBackend()
                Log.network.info("Backend connection attempt completed")
            }
            // Connect to MCP server for references
            Task {
                Log.mcp.info("Attempting MCP server connection...")
                await mcpService.connect()
                Log.mcp.info("MCP server connection attempt completed")
            }
        }

        // Setup notifications
        setupNotifications()
        Log.startup.info("Application setup completed")
    }

    private func setupNotifications() {
        NotificationCenter.default.publisher(for: .backendConnected)
            .sink { _ in
                appState.backendConnected = true
                Log.network.info("Backend connected")
            }
            .store(in: &appState.cancellables)

        NotificationCenter.default.publisher(for: .backendDisconnected)
            .sink { _ in
                appState.backendConnected = false
                Log.network.warning("Backend disconnected")
            }
            .store(in: &appState.cancellables)
    }
}

class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Foundation.Notification) {
        // Setup any macOS-specific configurations
        NSApp.setActivationPolicy(.regular)

        // Register for system events
        registerForSystemEvents()
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        // Keep app running even if all windows are closed (menu bar app behavior)
        return false
    }

    private func registerForSystemEvents() {
        // Register for sleep/wake notifications for connection management
        NSWorkspace.shared.notificationCenter.addObserver(
            self,
            selector: #selector(handleSleep),
            name: NSWorkspace.willSleepNotification,
            object: nil
        )

        NSWorkspace.shared.notificationCenter.addObserver(
            self,
            selector: #selector(handleWake),
            name: NSWorkspace.didWakeNotification,
            object: nil
        )
    }

    @objc private func handleSleep() {
        NotificationCenter.default.post(name: .systemWillSleep, object: nil)
    }

    @objc private func handleWake() {
        NotificationCenter.default.post(name: .systemDidWake, object: nil)
    }
}

// Notification names are defined centrally in Utils/Notifications.swift
