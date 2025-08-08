import SwiftUI
import WebKit

struct ContentView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var apiService: APIService
    @State private var selectedSidebarItem: SidebarItem? = .dashboard

    var body: some View {
        NavigationSplitView(
            columnVisibility: .constant(.all),
            sidebar: {
                SidebarView(selection: $selectedSidebarItem)
                    .navigationSplitViewColumnWidth(min: 250, ideal: 280, max: 350)
            },
            content: {
                if let selectedItem = selectedSidebarItem {
                    contentView(for: selectedItem)
                        .navigationTitle(selectedItem.title)
                        .navigationSubtitle(appState.backendConnected ? "Connected" : "Offline")
                } else {
                    WelcomeView()
                }
            },
            detail: {
                DetailView()
            }
        )
        .navigationSplitViewStyle(.balanced)
        .toolbar {
            ToolbarItemGroup(placement: .navigation) {
                Button(action: { appState.sidebarVisible.toggle() }) {
                    Image(systemName: "sidebar.left")
                }
                .help("Toggle Sidebar")
            }

            ToolbarItemGroup(placement: .principal) {
                ConnectionStatusView()
            }

            ToolbarItemGroup(placement: .automatic) {
                ViewModeSelector()

                Button(action: { appState.showSettings = true }) {
                    Image(systemName: "gear")
                }
                .help("Settings")
                .popover(isPresented: $appState.showSettings) {
                    QuickSettingsView()
                        .frame(width: 350, height: 400)
                }
            }
        }
        .overlay(alignment: .bottom) {
            if appState.showNotification {
                NotificationBanner()
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                    .animation(.spring(), value: appState.showNotification)
            }
            if !appState.backendConnected {
                HStack(spacing: 12) {
                    Image(systemName: "wifi.exclamationmark")
                    Text("Offline. Unable to reach backend.")
                    Spacer()
                    Button("Retry") {
                        Task { await apiService.connectToBackend() }
                    }
                    Button("Settings") { appState.showSettings = true }
                }
                .padding(12)
                .background(.thinMaterial)
                .cornerRadius(10)
                .padding(.horizontal, 16)
                .padding(.bottom, 12)
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
    }

    @ViewBuilder
    private func contentView(for item: SidebarItem) -> some View {
        switch appState.viewMode {
        case .webView:
            WebViewContainer(item: item)
        case .native:
            nativeView(for: item)
        case .hybrid:
            HybridView(item: item)
        }
    }

    @ViewBuilder
    private func nativeView(for item: SidebarItem) -> some View {
        switch item {
        case .dashboard:
            DashboardView()
        case .chat:
            ChatInterfaceView()
        case .agents:
            AgentManagementView()
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
        }
    }
}

// WebView Container for HTML integration
struct WebViewContainer: NSViewRepresentable {
    let item: SidebarItem
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var apiService: APIService

    func makeNSView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()

        // Setup JavaScript message handlers
        config.userContentController.add(context.coordinator, name: "swiftBridge")

        // Enable developer extras for debugging
        config.preferences.setValue(true, forKey: "developerExtrasEnabled")

        // Create WebView
        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator

        // Load the appropriate HTML content
        loadContent(in: webView)

        return webView
    }

    func updateNSView(_ webView: WKWebView, context: Context) {
        // Update WebView if needed
        if context.coordinator.currentItem != item {
            context.coordinator.currentItem = item
            loadContent(in: webView)
        }
    }

    private func loadContent(in webView: WKWebView) {
        let baseURL = UserDefaults.standard.string(forKey: "FrontendURL") ?? "http://localhost:5173"

        let path: String
        switch item {
        case .dashboard:
            path = "/"
        case .chat:
            path = "/chat"
        case .agents:
            path = "/agents"
        case .mlx:
            path = "/mlx"
        case .vision:
            path = "/vision"
        case .monitoring:
            path = "/monitoring"
        case .abMcts:
            path = "/ab-mcts"
        case .maltSwarm:
            path = "/malt-swarm"
        case .parameters:
            path = "/parameters"
        case .knowledge:
            path = "/knowledge"
        }

        if let url = URL(string: baseURL + path) {
            let request = URLRequest(url: url)
            webView.load(request)
        }
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
        var parent: WebViewContainer
        var currentItem: SidebarItem?

        init(_ parent: WebViewContainer) {
            self.parent = parent
        }

        // Handle JavaScript messages from web content
        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard let dict = message.body as? [String: Any],
                  let action = dict["action"] as? String else { return }

            DispatchQueue.main.async {
                self.handleWebAction(action: action, data: dict["data"])
            }
        }

        private func handleWebAction(action: String, data: Any?) {
            switch action {
            case "updateState":
                if let stateData = data as? [String: Any] {
                    parent.appState.updateFromWeb(stateData)
                }
            case "apiCall":
                if let apiData = data as? [String: Any] {
                    Task {
                        await parent.apiService.handleWebAPICall(apiData)
                    }
                }
            case "showNotification":
                if let message = data as? String {
                    parent.appState.showNotification(message: message)
                }
            default:
                print("Unknown web action: \(action)")
            }
        }

        // WKNavigationDelegate
        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            // Inject Swift bridge JavaScript
            let bridgeScript = """
                window.swiftBridge = {
                    send: function(action, data) {
                        window.webkit.messageHandlers.swiftBridge.postMessage({
                            action: action,
                            data: data
                        });
                    },
                    updateState: function(state) {
                        this.send('updateState', state);
                    },
                    apiCall: function(endpoint, params) {
                        this.send('apiCall', { endpoint: endpoint, params: params });
                    },
                    showNotification: function(message) {
                        this.send('showNotification', message);
                    }
                };

                // Notify React app that Swift bridge is ready
                window.dispatchEvent(new CustomEvent('swiftBridgeReady'));
            """

            webView.evaluateJavaScript(bridgeScript) { _, error in
                if let error = error {
                    print("Error injecting Swift bridge: \(error)")
                }
            }

            // Pass authentication token if available
            if let token = parent.apiService.authToken {
                let tokenScript = "window.localStorage.setItem('authToken', '\(token)');"
                webView.evaluateJavaScript(tokenScript, completionHandler: nil)
            }
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            print("WebView navigation failed: \(error)")
            parent.appState.showNotification(message: "Failed to load content: \(error.localizedDescription)")
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            print("WebView provisional navigation failed: \(error)")
            parent.appState.showNotification(message: "Failed to load content: \(error.localizedDescription)")
        }

        // WKUIDelegate
        func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
            // Handle opening links in new windows
            if let url = navigationAction.request.url {
                NSWorkspace.shared.open(url)
            }
            return nil
        }
    }
}

// Hybrid View combining native and web elements
struct HybridView: View {
    let item: SidebarItem
    @EnvironmentObject var appState: AppState

    var body: some View {
        VSplitView {
            // Native controls at top
            NativeControlBar(item: item)
                .frame(height: 60)
                .background(Color(NSColor.controlBackgroundColor))

            // Web content in main area
            WebViewContainer(item: item)
                .layoutPriority(1)

            // Native status/info panel at bottom
            NativeStatusPanel(item: item)
                .frame(minHeight: 100, maxHeight: 200)
                .background(Color(NSColor.controlBackgroundColor))
        }
    }
}
