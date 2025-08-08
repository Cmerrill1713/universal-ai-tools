import SwiftUI
import WebKit

struct WebContainerView: NSViewRepresentable {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var apiService: APIService
    
    let htmlPath: String
    @Binding var jsMessageHandler: JSMessageHandler?
    
    func makeNSView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        
        // Enable developer extras for debugging
        configuration.preferences.setValue(true, forKey: "developerExtrasEnabled")
        
        // Add message handler for JavaScript communication
        configuration.userContentController.add(
            context.coordinator,
            name: "swiftBridge"
        )
        
        // Inject JavaScript bridge
        let bridgeScript = """
        window.swiftBridge = {
            send: function(action, data) {
                window.webkit.messageHandlers.swiftBridge.postMessage({
                    action: action,
                    data: data
                });
            },
            
            // API proxy through Swift
            apiCall: function(endpoint, method, params) {
                return new Promise((resolve, reject) => {
                    const requestId = Date.now().toString();
                    
                    window.swiftBridge._pendingRequests = window.swiftBridge._pendingRequests || {};
                    window.swiftBridge._pendingRequests[requestId] = { resolve, reject };
                    
                    window.webkit.messageHandlers.swiftBridge.postMessage({
                        action: 'api_call',
                        data: {
                            endpoint: endpoint,
                            method: method,
                            params: params,
                            requestId: requestId
                        }
                    });
                });
            },
            
            // Handle API responses
            _handleResponse: function(requestId, response, error) {
                const pending = window.swiftBridge._pendingRequests[requestId];
                if (pending) {
                    if (error) {
                        pending.reject(error);
                    } else {
                        pending.resolve(response);
                    }
                    delete window.swiftBridge._pendingRequests[requestId];
                }
            },
            
            _pendingRequests: {}
        };
        
        // Override fetch to route through Swift when needed
        const originalFetch = window.fetch;
        window.fetch = function(url, options) {
            if (typeof url === 'string' && url.startsWith('/api/')) {
                // Route API calls through Swift
                return window.swiftBridge.apiCall(url, options?.method || 'GET', options?.body);
            }
            return originalFetch(url, options);
        };
        
        // Listen for Swift events
        window.addEventListener('swift-event', function(event) {
            console.log('Received Swift event:', event.detail);
        });
        
        console.log('Swift bridge initialized');
        """
        
        let script = WKUserScript(
            source: bridgeScript,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: false
        )
        configuration.userContentController.addUserScript(script)
        
        // Configure CORS and local file access
        configuration.preferences.setValue(true, forKey: "allowFileAccessFromFileURLs")
        configuration.setValue(true, forKey: "allowUniversalAccessFromFileURLs")
        
        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        
        // Store reference for message handling
        context.coordinator.parent = self
        jsMessageHandler = context.coordinator
        
        // Load the HTML content
        loadContent(in: webView)
        
        return webView
    }
    
    func updateNSView(_ webView: WKWebView, context: Context) {
        // Update web view if needed based on state changes
        if appState.shouldReloadWebView {
            loadContent(in: webView)
            DispatchQueue.main.async {
                appState.shouldReloadWebView = false
            }
        }
    }
    
    private func loadContent(in webView: WKWebView) {
        if htmlPath.starts(with: "http://") || htmlPath.starts(with: "https://") {
            // Load remote URL (for development server)
            if let url = URL(string: htmlPath) {
                let request = URLRequest(url: url)
                webView.load(request)
            }
        } else {
            // Load local HTML file
            let url = URL(fileURLWithPath: htmlPath)
            webView.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
        }
    }
    
    func makeCoordinator() -> Coordinator {
        Coordinator()
    }
    
    class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler, JSMessageHandler {
        weak var parent: WebContainerView?
        
        // MARK: - WKScriptMessageHandler
        
        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard let parent = parent,
                  let body = message.body as? [String: Any],
                  let action = body["action"] as? String else { return }
            
            let data = body["data"] as? [String: Any] ?? [:]
            
            Task { @MainActor in
                switch action {
                case "api_call":
                    await parent.apiService.handleWebAPICall(data)
                    
                case "update_state":
                    if let state = data["state"] as? String {
                        parent.appState.webViewState = state
                    }
                    
                case "navigate":
                    if let route = data["route"] as? String {
                        parent.appState.navigateToRoute(route)
                    }
                    
                case "log":
                    if let message = data["message"] as? String {
                        print("[WebView Log]:", message)
                    }
                    
                case "authenticate":
                    if let username = data["username"] as? String,
                       let password = data["password"] as? String {
                        do {
                            let success = try await parent.apiService.authenticate(
                                username: username,
                                password: password
                            )
                            executeJavaScript("window.swiftBridge._handleResponse('\(data["requestId"] ?? "")', { success: \(success) }, null)")
                        } catch {
                            executeJavaScript("window.swiftBridge._handleResponse('\(data["requestId"] ?? "")', null, '\(error.localizedDescription)')")
                        }
                    }
                    
                case "chat_message":
                    if let message = data["message"] as? String,
                       let chatId = data["chatId"] as? String {
                        do {
                            let response = try await parent.apiService.sendChatMessage(message, chatId: chatId)
                            let jsonData = try JSONEncoder().encode(response)
                            let jsonString = String(data: jsonData, encoding: .utf8) ?? "{}"
                            executeJavaScript("window.swiftBridge._handleResponse('\(data["requestId"] ?? "")', \(jsonString), null)")
                        } catch {
                            executeJavaScript("window.swiftBridge._handleResponse('\(data["requestId"] ?? "")', null, '\(error.localizedDescription)')")
                        }
                    }
                    
                default:
                    print("Unknown action from WebView:", action)
                }
            }
        }
        
        // MARK: - JSMessageHandler Protocol
        
        func executeJavaScript(_ script: String) {
            // Find the web view through the view hierarchy
            guard let window = NSApplication.shared.windows.first,
                  let contentView = window.contentView,
                  let webView = findWebView(in: contentView) else { return }
            
            webView.evaluateJavaScript(script) { result, error in
                if let error = error {
                    print("JavaScript execution error:", error)
                }
            }
        }
        
        func sendEvent(_ event: String, data: [String: Any]) {
            let jsonData = try? JSONSerialization.data(withJSONObject: data)
            let jsonString = jsonData != nil ? String(data: jsonData!, encoding: .utf8) ?? "{}" : "{}"
            
            let script = """
            window.dispatchEvent(new CustomEvent('swift-event', {
                detail: {
                    type: '\(event)',
                    data: \(jsonString)
                }
            }));
            """
            
            executeJavaScript(script)
        }
        
        private func findWebView(in view: NSView) -> WKWebView? {
            if let webView = view as? WKWebView {
                return webView
            }
            
            for subview in view.subviews {
                if let webView = findWebView(in: subview) {
                    return webView
                }
            }
            
            return nil
        }
        
        // MARK: - WKNavigationDelegate
        
        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            // Inject current app state into web view
            if let parent = parent {
                let state = [
                    "isAuthenticated": parent.apiService.authToken != nil,
                    "isDarkMode": parent.appState.isDarkMode,
                    "viewMode": parent.appState.viewMode == .webView ? "web" : 
                               parent.appState.viewMode == .native ? "native" : "hybrid"
                ]
                
                if let jsonData = try? JSONSerialization.data(withJSONObject: state),
                   let jsonString = String(data: jsonData, encoding: .utf8) {
                    executeJavaScript("window.appState = \(jsonString);")
                }
            }
        }
        
        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            print("WebView navigation failed:", error)
        }
        
        // MARK: - WKUIDelegate
        
        func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
            // Handle window.open() calls
            if navigationAction.targetFrame == nil {
                webView.load(navigationAction.request)
            }
            return nil
        }
        
        func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
            let alert = NSAlert()
            alert.messageText = "Universal AI Tools"
            alert.informativeText = message
            alert.alertStyle = .informational
            alert.addButton(withTitle: "OK")
            alert.runModal()
            completionHandler()
        }
        
        func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
            let alert = NSAlert()
            alert.messageText = "Universal AI Tools"
            alert.informativeText = message
            alert.alertStyle = .informational
            alert.addButton(withTitle: "OK")
            alert.addButton(withTitle: "Cancel")
            
            completionHandler(alert.runModal() == .alertFirstButtonReturn)
        }
    }
}

// MARK: - JavaScript Message Handler Protocol

protocol JSMessageHandler: AnyObject {
    func executeJavaScript(_ script: String)
    func sendEvent(_ event: String, data: [String: Any])
}