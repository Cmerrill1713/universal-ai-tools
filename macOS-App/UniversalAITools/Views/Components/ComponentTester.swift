import SwiftUI
import Combine

/// Component testing and validation tool for enhanced UI components
struct ComponentTester: View {
    @StateObject private var testRunner = TestRunner()
    @State private var selectedComponent: TestableComponent?
    @State private var testResults: [TestResult] = []
    @State private var isRunningTests = false
    @State private var showTestDetails = false
    @State private var selectedTestResult: TestResult?
    
    var body: some View {
        HSplitView {
            // Left sidebar - Component list
            componentList
            
            // Main content area
            VStack(spacing: 0) {
                // Header
                testingHeader
                
                Divider()
                
                // Test runner area
                if let component = selectedComponent {
                    testRunnerContent(for: component)
                } else {
                    emptySelectionView
                }
            }
        }
        .frame(minWidth: 1000, minHeight: 700)
        .sheet(isPresented: $showTestDetails) {
            if let result = selectedTestResult {
                TestResultDetailView(result: result)
            }
        }
    }
    
    // MARK: - Component List
    
    private var componentList: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Components")
                .font(.headline)
                .fontWeight(.semibold)
                .padding()
            
            Divider()
            
            List(TestableComponent.allCases, id: \.self, selection: $selectedComponent) { component in
                ComponentListRow(component: component)
            }
            .listStyle(.sidebar)
        }
        .frame(minWidth: 250, maxWidth: 300)
    }
    
    // MARK: - Testing Header
    
    private var testingHeader: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                if let component = selectedComponent {
                    Text("Testing: \(component.displayName)")
                        .font(.title2)
                        .fontWeight(.bold)
                    
                    Text(component.description)
                        .font(.caption)
                        .foregroundColor(.secondary)
                } else {
                    Text("Component Tester")
                        .font(.title2)
                        .fontWeight(.bold)
                    
                    Text("Select a component to run tests")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            
            Spacer()
            
            if selectedComponent != nil {
                HStack(spacing: 12) {
                    Button("Run All Tests") {
                        runAllTests()
                    }
                    .disabled(isRunningTests)
                    
                    Button("Clear Results") {
                        testResults.removeAll()
                    }
                    .disabled(testResults.isEmpty)
                    
                    if isRunningTests {
                        ProgressView()
                            .scaleEffect(0.8)
                    }
                }
            }
        }
        .padding()
    }
    
    // MARK: - Test Runner Content
    
    private func testRunnerContent(for component: TestableComponent) -> some View {
        VSplitView {
            // Top: Component preview and controls
            VStack(spacing: 16) {
                Text("Component Preview")
                    .font(.headline)
                    .frame(maxWidth: .infinity, alignment: .leading)
                
                // Component preview area
                componentPreview(for: component)
                    .frame(height: 300)
                    .background(.regularMaterial)
                    .cornerRadius(12)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(.tertiary, lineWidth: 1)
                    )
                
                // Test controls
                testControls(for: component)
            }
            .padding()
            
            Divider()
            
            // Bottom: Test results
            testResultsSection
        }
    }
    
    // MARK: - Component Preview
    
    @ViewBuilder
    private func componentPreview(for component: TestableComponent) -> some View {
        ScrollView {
            switch component {
            case .performanceMonitoring:
                PerformanceMonitoringView(webSocketService: AgentWebSocketService())
                    .frame(height: 250)
                    .scaleEffect(0.7)
                
            case .agentOrchestration:
                AgentOrchestrationDashboard()
                    .environmentObject(AppState())
                    .frame(height: 250)
                    .scaleEffect(0.7)
                
            case .knowledgeGraph3D:
                KnowledgeGraphView3D()
                    .environmentObject(APIService())
                    .frame(height: 250)
                    .scaleEffect(0.7)
                
            case .flashAttention:
                FlashAttentionAnalytics()
                    .frame(height: 250)
                    .scaleEffect(0.7)
                
            case .contextFlow:
                ContextFlowDashboard()
                    .frame(height: 250)
                    .scaleEffect(0.7)
                
            case .debugConsole:
                DebugConsole()
                    .frame(height: 250)
                    .scaleEffect(0.7)
            }
        }
    }
    
    // MARK: - Test Controls
    
    private func testControls(for component: TestableComponent) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Available Tests")
                .font(.subheadline)
                .fontWeight(.medium)
            
            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 3), spacing: 8) {
                ForEach(component.availableTests, id: \.self) { test in
                    Button(action: { runSingleTest(test, for: component) }) {
                        VStack(spacing: 4) {
                            Image(systemName: test.icon)
                                .font(.title3)
                                .foregroundColor(test.category.color)
                            
                            Text(test.name)
                                .font(.caption)
                                .multilineTextAlignment(.center)
                        }
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(.regularMaterial)
                        .cornerRadius(8)
                    }
                    .buttonStyle(.plain)
                    .disabled(isRunningTests)
                }
            }
        }
    }
    
    // MARK: - Test Results Section
    
    private var testResultsSection: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("Test Results")
                    .font(.headline)
                    .fontWeight(.semibold)
                
                Spacer()
                
                if !testResults.isEmpty {
                    let passed = testResults.filter { $0.status == .passed }.count
                    let failed = testResults.filter { $0.status == .failed }.count
                    
                    HStack(spacing: 12) {
                        Label("\(passed)", systemImage: "checkmark.circle.fill")
                            .foregroundColor(.green)
                            .font(.caption)
                        
                        Label("\(failed)", systemImage: "xmark.circle.fill")
                            .foregroundColor(.red)
                            .font(.caption)
                    }
                }
            }
            .padding()
            
            Divider()
            
            if testResults.isEmpty {
                VStack(spacing: 12) {
                    Image(systemName: "testtube.2")
                        .font(.largeTitle)
                        .foregroundColor(.secondary)
                    
                    Text("No test results")
                        .font(.headline)
                        .foregroundColor(.secondary)
                    
                    Text("Run tests to see results here")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List(testResults) { result in
                    TestResultRow(result: result) {
                        selectedTestResult = result
                        showTestDetails = true
                    }
                }
                .listStyle(.plain)
            }
        }
    }
    
    // MARK: - Empty Selection View
    
    private var emptySelectionView: some View {
        VStack(spacing: 20) {
            Image(systemName: "hammer.fill")
                .font(.largeTitle)
                .foregroundColor(.orange)
            
            Text("Component Tester")
                .font(.title)
                .fontWeight(.bold)
            
            Text("Select a component from the sidebar to start testing")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
    
    // MARK: - Test Methods
    
    private func runAllTests() {
        guard let component = selectedComponent else { return }
        
        isRunningTests = true
        testResults.removeAll()
        
        Task {
            for test in component.availableTests {
                let result = await testRunner.runTest(test, for: component)
                await MainActor.run {
                    testResults.append(result)
                }
                
                // Add small delay for visual feedback
                try? await Task.sleep(nanoseconds: 500_000_000) // 0.5 seconds
            }
            
            await MainActor.run {
                isRunningTests = false
            }
        }
    }
    
    private func runSingleTest(_ test: ComponentTest, for component: TestableComponent) {
        isRunningTests = true
        
        Task {
            let result = await testRunner.runTest(test, for: component)
            await MainActor.run {
                if let existingIndex = testResults.firstIndex(where: { $0.test.id == test.id }) {
                    testResults[existingIndex] = result
                } else {
                    testResults.append(result)
                }
                isRunningTests = false
            }
        }
    }
}

// MARK: - Supporting Views

struct ComponentListRow: View {
    let component: TestableComponent
    
    var body: some View {
        HStack {
            Image(systemName: component.icon)
                .foregroundColor(component.category.color)
                .frame(width: 24)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(component.displayName)
                    .font(.subheadline)
                    .fontWeight(.medium)
                
                Text("\(component.availableTests.count) tests")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
        }
        .padding(.vertical, 4)
    }
}

struct TestResultRow: View {
    let result: TestResult
    let onTap: () -> Void
    
    var body: some View {
        HStack {
            Image(systemName: result.status.icon)
                .foregroundColor(result.status.color)
                .frame(width: 20)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(result.test.name)
                    .font(.subheadline)
                    .fontWeight(.medium)
                
                if let message = result.message {
                    Text(message)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(2)
                }
            }
            
            Spacer()
            
            VStack(alignment: .trailing, spacing: 2) {
                Text("\(result.duration, specifier: "%.2f")s")
                    .font(.caption)
                    .fontDesign(.monospaced)
                    .foregroundColor(.secondary)
                
                Text(result.timestamp, style: .time)
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
        }
        .padding(.vertical, 4)
        .contentShape(Rectangle())
        .onTapGesture {
            onTap()
        }
    }
}

// MARK: - Test Result Detail View

struct TestResultDetailView: View {
    let result: TestResult
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Header
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(result.test.name)
                        .font(.title2)
                        .fontWeight(.bold)
                    
                    Text("Duration: \(result.duration, specifier: "%.3f")s")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                
                Spacer()
                
                HStack {
                    Image(systemName: result.status.icon)
                        .foregroundColor(result.status.color)
                    
                    Text(result.status.rawValue.capitalized)
                        .font(.headline)
                        .fontWeight(.semibold)
                        .foregroundColor(result.status.color)
                }
            }
            
            Divider()
            
            // Details
            if let message = result.message {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Message")
                        .font(.headline)
                        .fontWeight(.medium)
                    
                    Text(message)
                        .font(.body)
                        .padding()
                        .background(.regularMaterial)
                        .cornerRadius(8)
                }
            }
            
            if let logs = result.logs, !logs.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Logs")
                        .font(.headline)
                        .fontWeight(.medium)
                    
                    ScrollView {
                        VStack(alignment: .leading, spacing: 4) {
                            ForEach(logs, id: \.self) { log in
                                Text(log)
                                    .font(.caption)
                                    .fontDesign(.monospaced)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            }
                        }
                        .padding()
                    }
                    .background(.regularMaterial)
                    .cornerRadius(8)
                    .frame(maxHeight: 200)
                }
            }
            
            Spacer()
            
            // Actions
            HStack {
                Spacer()
                
                Button("Close") {
                    dismiss()
                }
                .keyboardShortcut(.cancelAction)
            }
        }
        .padding()
        .frame(width: 500, height: 400)
    }
}

// MARK: - Test Runner

@MainActor
class TestRunner: ObservableObject {
    
    func runTest(_ test: ComponentTest, for component: TestableComponent) async -> TestResult {
        let startTime = Date()
        
        do {
            // Simulate test execution
            try await Task.sleep(nanoseconds: UInt64.random(in: 500_000_000...2_000_000_000)) // 0.5-2 seconds
            
            let success = Bool.random() || test.category == .performance // Bias toward success for demo
            let duration = Date().timeIntervalSince(startTime)
            
            if success {
                return TestResult(
                    test: test,
                    status: .passed,
                    duration: duration,
                    message: test.successMessage,
                    logs: generateMockLogs(for: test, success: true),
                    timestamp: Date()
                )
            } else {
                return TestResult(
                    test: test,
                    status: .failed,
                    duration: duration,
                    message: test.failureMessage,
                    logs: generateMockLogs(for: test, success: false),
                    timestamp: Date()
                )
            }
        } catch {
            let duration = Date().timeIntervalSince(startTime)
            return TestResult(
                test: test,
                status: .failed,
                duration: duration,
                message: "Test execution failed: \(error.localizedDescription)",
                logs: ["ERROR: \(error)"],
                timestamp: Date()
            )
        }
    }
    
    private func generateMockLogs(for test: ComponentTest, success: Bool) -> [String] {
        var logs = [
            "Starting test: \(test.name)",
            "Initializing test environment...",
            "Running test assertions..."
        ]
        
        if success {
            logs.append("✅ All assertions passed")
            logs.append("Test completed successfully")
        } else {
            logs.append("❌ Assertion failed: Expected value did not match")
            logs.append("Test failed with errors")
        }
        
        return logs
    }
}

// MARK: - Test Data Models

enum TestableComponent: String, CaseIterable {
    case performanceMonitoring = "PerformanceMonitoring"
    case agentOrchestration = "AgentOrchestration"
    case knowledgeGraph3D = "KnowledgeGraph3D"
    case flashAttention = "FlashAttention"
    case contextFlow = "ContextFlow"
    case debugConsole = "DebugConsole"
    
    var displayName: String {
        switch self {
        case .performanceMonitoring: return "Performance Monitoring"
        case .agentOrchestration: return "Agent Orchestration"
        case .knowledgeGraph3D: return "3D Knowledge Graph"
        case .flashAttention: return "Flash Attention Analytics"
        case .contextFlow: return "Context Flow Dashboard"
        case .debugConsole: return "Debug Console"
        }
    }
    
    var description: String {
        switch self {
        case .performanceMonitoring: return "Real-time agent performance metrics and analytics"
        case .agentOrchestration: return "Agent orchestration control center dashboard"
        case .knowledgeGraph3D: return "3D interactive knowledge graph visualization"
        case .flashAttention: return "Flash attention performance analytics hub"
        case .contextFlow: return "Context flow and analytics dashboard"
        case .debugConsole: return "Real-time debug console and monitoring"
        }
    }
    
    var icon: String {
        switch self {
        case .performanceMonitoring: return "chart.line.uptrend.xyaxis"
        case .agentOrchestration: return "brain.head.profile"
        case .knowledgeGraph3D: return "point.3.connected.trianglepath.dotted"
        case .flashAttention: return "bolt.circle"
        case .contextFlow: return "arrow.right.arrow.left.circle"
        case .debugConsole: return "terminal"
        }
    }
    
    var category: ComponentCategory {
        switch self {
        case .performanceMonitoring, .flashAttention: return .analytics
        case .agentOrchestration: return .orchestration
        case .knowledgeGraph3D, .contextFlow: return .visualization
        case .debugConsole: return .debugging
        }
    }
    
    var availableTests: [ComponentTest] {
        switch self {
        case .performanceMonitoring:
            return [
                ComponentTest(name: "Rendering Performance", category: .performance, icon: "speedometer"),
                ComponentTest(name: "Memory Usage", category: .memory, icon: "memorychip"),
                ComponentTest(name: "WebSocket Connection", category: .connectivity, icon: "network"),
                ComponentTest(name: "Data Visualization", category: .ui, icon: "chart.bar")
            ]
        case .agentOrchestration:
            return [
                ComponentTest(name: "Agent Network Loading", category: .data, icon: "square.grid.3x3"),
                ComponentTest(name: "Real-time Updates", category: .connectivity, icon: "arrow.clockwise"),
                ComponentTest(name: "UI Responsiveness", category: .ui, icon: "hand.point.up"),
                ComponentTest(name: "Error Handling", category: .error, icon: "exclamationmark.triangle")
            ]
        case .knowledgeGraph3D:
            return [
                ComponentTest(name: "3D Rendering", category: .performance, icon: "cube"),
                ComponentTest(name: "Node Interactions", category: .ui, icon: "point.3.connected.trianglepath.dotted"),
                ComponentTest(name: "Graph Layout", category: .ui, icon: "rectangle.3.group"),
                ComponentTest(name: "Performance at Scale", category: .performance, icon: "speedometer")
            ]
        case .flashAttention:
            return [
                ComponentTest(name: "Metrics Calculation", category: .data, icon: "function"),
                ComponentTest(name: "Chart Rendering", category: .ui, icon: "chart.line.uptrend.xyaxis"),
                ComponentTest(name: "Real-time Updates", category: .connectivity, icon: "bolt"),
                ComponentTest(name: "Memory Efficiency", category: .memory, icon: "memorychip")
            ]
        case .contextFlow:
            return [
                ComponentTest(name: "Flow Diagram", category: .ui, icon: "arrow.right.arrow.left"),
                ComponentTest(name: "Data Processing", category: .data, icon: "gearshape.2"),
                ComponentTest(name: "Interactive Elements", category: .ui, icon: "hand.point.up"),
                ComponentTest(name: "Export Functions", category: .functionality, icon: "square.and.arrow.up")
            ]
        case .debugConsole:
            return [
                ComponentTest(name: "Log Display", category: .ui, icon: "text.alignleft"),
                ComponentTest(name: "Filtering", category: .functionality, icon: "line.3.horizontal.decrease"),
                ComponentTest(name: "Real-time Logging", category: .connectivity, icon: "arrow.clockwise"),
                ComponentTest(name: "Export Capability", category: .functionality, icon: "square.and.arrow.up")
            ]
        }
    }
}

struct ComponentTest: Identifiable, Hashable {
    let id = UUID()
    let name: String
    let category: TestCategory
    let icon: String
    
    var successMessage: String {
        "\(name) test completed successfully"
    }
    
    var failureMessage: String {
        "\(name) test failed - component did not meet expected criteria"
    }
}

enum TestCategory: String, CaseIterable {
    case performance = "Performance"
    case memory = "Memory"
    case ui = "UI/UX"
    case connectivity = "Connectivity"
    case data = "Data"
    case error = "Error Handling"
    case functionality = "Functionality"
    
    var color: Color {
        switch self {
        case .performance: return .blue
        case .memory: return .orange
        case .ui: return .green
        case .connectivity: return .purple
        case .data: return .cyan
        case .error: return .red
        case .functionality: return .yellow
        }
    }
}

enum ComponentCategory: String {
    case analytics = "Analytics"
    case orchestration = "Orchestration"
    case visualization = "Visualization"
    case debugging = "Debugging"
    
    var color: Color {
        switch self {
        case .analytics: return .blue
        case .orchestration: return .orange
        case .visualization: return .purple
        case .debugging: return .green
        }
    }
}

struct TestResult: Identifiable {
    let id = UUID()
    let test: ComponentTest
    let status: TestStatus
    let duration: TimeInterval
    let message: String?
    let logs: [String]?
    let timestamp: Date
}

enum TestStatus: String {
    case passed = "passed"
    case failed = "failed"
    case running = "running"
    
    var icon: String {
        switch self {
        case .passed: return "checkmark.circle.fill"
        case .failed: return "xmark.circle.fill"
        case .running: return "arrow.clockwise.circle"
        }
    }
    
    var color: Color {
        switch self {
        case .passed: return .green
        case .failed: return .red
        case .running: return .blue
        }
    }
}

#Preview {
    ComponentTester()
}