import SwiftUI
import WebKit

struct ContentView: View {
    // Change this to your Mac's IP address on your local network
    // You can also use this in Safari on your iPhone to test first
    let serverURL = "http://192.168.1.198"
    
    var body: some View {
        WebView(url: URL(string: serverURL)!)
            .ignoresSafeArea()
    }
}

struct WebView: UIViewRepresentable {
    let url: URL
    
    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []
        
        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        
        return webView
    }
    
    func updateUIView(_ webView: WKWebView, context: Context) {
        let request = URLRequest(url: url)
        webView.load(request)
    }
}

#Preview {
    ContentView()
}

