import SwiftUI

/// Simple compilation test to verify all enhanced components compile
struct CompilationTest: View {
    var body: some View {
        TabView {
            // Test DebugConsole
            DebugConsole()
                .tabItem {
                    Label("Debug", systemImage: "terminal")
                }
            
            // Test ComponentTester
            ComponentTester()
                .tabItem {
                    Label("Testing", systemImage: "hammer")
                }
            
            // Test PerformanceMonitoring with mock service
            PerformanceMonitoringView(webSocketService: AgentWebSocketService())
                .tabItem {
                    Label("Performance", systemImage: "chart.line.uptrend.xyaxis")
                }
            
            // Test error state views
            VStack {
                ErrorStateView(
                    error: ErrorState(
                        title: "Test Error",
                        message: "This is a test error message",
                        suggestion: "This is a test suggestion"
                    ),
                    retry: { },
                    canRetry: true
                )
            }
            .tabItem {
                Label("Error States", systemImage: "exclamationmark.triangle")
            }
            
            // Test loading state
            LoadingStateView(message: "Testing loading state...")
                .tabItem {
                    Label("Loading", systemImage: "arrow.clockwise")
                }
        }
    }
}

#Preview {
    CompilationTest()
        .frame(width: 1200, height: 800)
}