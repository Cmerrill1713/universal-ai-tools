import SwiftUI
import Combine
import OSLog
import MCP

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
                .onAppear {
                    setupApplication()
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
                    appState.showAgentMonitor = true
                }
                .keyboardShortcut("1", modifiers: [.command, .option])

                Button("MLX Fine-Tuning") {
                    appState.showMLXInterface = true
                }
                .keyboardShortcut("2", modifiers: [.command, .option])

                Button("Vision Processing") {
                    appState.showVisionInterface = true
                }
                .keyboardShortcut("3", modifiers: [.command, .option])

                Divider()

                Button("AB-MCTS Orchestration") {
                    appState.showABMCTS = true
                }
                Button("MALT Swarm Control") {
                    appState.showMALTSwarm = true
                }
            }
        }

        Settings {
            SettingsView()
                .environmentObject(appState)
                .environmentObject(apiService)
                .environmentObject(mcpService)
        }

        // About sheet
        .onChange(of: appState.showAboutWindow) { show in
            if show {
                NSApp.activate(ignoringOtherApps: true)
                let controller = NSHostingController(rootView: AboutView())
                let window = NSWindow(
                    contentRect: NSRect(x: 0, y: 0, width: 400, height: 320),
                    styleMask: [.titled, .closable],
                    backing: .buffered,
                    defer: false
                )
                window.center()
                window.title = "About Universal AI Tools"
                window.contentView = controller.view
                window.isReleasedWhenClosed = false
                window.makeKeyAndOrderFront(nil)
            }
        }

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
        // Configure app appearance
        NSApplication.shared.appearance = NSAppearance(named: appState.darkMode ? .darkAqua : .aqua)

        // Force Native UI as default view mode
        appState.viewMode = .native
        UserDefaults.standard.set("native", forKey: "viewMode")

        // Skip network work in Xcode Previews and UI tests
        if EnvironmentContext.isRunningInXcodePreviews || EnvironmentContext.isRunningUITests {
            Log.app.debug("Skipping backend connection for previews/tests")
        } else {
            // Connect to backend
            Task {
                await apiService.connectToBackend()
            }
            // Connect to MCP server for references
            Task {
                do {
                    try await mcpService.connectToServer()
                    Log.app.info("Connected to MCP server")
                } catch {
                    Log.app.error("Failed to connect MCP server: \(String(describing: error))")
                }
            }
        }

        // Setup notifications
        setupNotifications()
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
