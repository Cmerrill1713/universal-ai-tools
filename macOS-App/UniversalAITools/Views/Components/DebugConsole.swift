import SwiftUI
import OSLog
import Combine

/// Real-time debug console for monitoring enhanced UI components
struct DebugConsole: View {
    @StateObject private var debugService = DebugService.shared
    @State private var selectedLogLevel: LogLevel = .all
    @State private var searchText = ""
    @State private var autoScroll = true
    @State private var showFilters = false
    @State private var maxLogEntries = 1000
    @State private var isPaused = false
    
    var filteredLogs: [DebugLogEntry] {
        debugService.logs
            .filter { entry in
                if selectedLogLevel != .all && entry.level != selectedLogLevel {
                    return false
                }
                if !searchText.isEmpty && !entry.message.localizedCaseInsensitiveContains(searchText) {
                    return false
                }
                return true
            }
            .suffix(maxLogEntries)
    }
    
    var body: some View {
        VStack(spacing: 0) {
            // Header with controls
            debugHeader
            
            Divider()
            
            // Filters (if shown)
            if showFilters {
                filtersSection
                Divider()
            }
            
            // Main console area
            consoleContent
            
            // Footer with stats
            debugFooter
        }
        .background(Color(NSColor.textBackgroundColor))
        .onReceive(debugService.$logs) { _ in
            if autoScroll && !isPaused {
                scrollToBottom()
            }
        }
    }
    
    // MARK: - Header
    
    private var debugHeader: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text("Debug Console")
                    .font(.headline)
                    .fontWeight(.semibold)
                
                Text("Real-time error monitoring and diagnostics")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            HStack(spacing: 12) {
                // Search
                HStack {
                    Image(systemName: "magnifyingglass")
                        .foregroundColor(.secondary)
                        .font(.caption)
                    
                    TextField("Search logs...", text: $searchText)
                        .textFieldStyle(.plain)
                        .font(.caption)
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(.thinMaterial)
                .cornerRadius(6)
                .frame(width: 200)
                
                // Log level picker
                Picker("Level", selection: $selectedLogLevel) {
                    ForEach(DebugLogLevel.allCases, id: \.self) { level in
                        Text(level.displayName)
                            .tag(level)
                    }
                }
                .pickerStyle(.menu)
                .frame(width: 80)
                
                // Controls
                Button(action: { showFilters.toggle() }) {
                    Image(systemName: "line.3.horizontal.decrease.circle")
                        .foregroundColor(showFilters ? .blue : .secondary)
                }
                .help("Show filters")
                
                Button(action: { isPaused.toggle() }) {
                    Image(systemName: isPaused ? "play.circle" : "pause.circle")
                        .foregroundColor(isPaused ? .orange : .green)
                }
                .help(isPaused ? "Resume logging" : "Pause logging")
                
                Button(action: { debugService.clearLogs() }) {
                    Image(systemName: "trash")
                        .foregroundColor(.red)
                }
                .help("Clear logs")
                
                Button(action: { exportLogs() }) {
                    Image(systemName: "square.and.arrow.up")
                }
                .help("Export logs")
            }
        }
        .padding()
    }
    
    // MARK: - Filters
    
    private var filtersSection: some View {
        VStack(spacing: 8) {
            HStack {
                Text("Filters")
                    .font(.subheadline)
                    .fontWeight(.medium)
                
                Spacer()
                
                HStack(spacing: 16) {
                    HStack {
                        Text("Max entries:")
                        TextField("1000", value: $maxLogEntries, format: .number)
                            .textFieldStyle(.roundedBorder)
                            .frame(width: 80)
                    }
                    
                    Toggle("Auto-scroll", isOn: $autoScroll)
                }
            }
            
            // Component filter toggles
            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 4), spacing: 8) {
                ForEach(DebugCategory.allCases, id: \.self) { category in
                    Toggle(category.displayName, isOn: debugService.binding(for: category))
                        .toggleStyle(.button)
                        .font(.caption)
                }
            }
        }
        .padding()
        .background(.regularMaterial)
    }
    
    // MARK: - Console Content
    
    private var consoleContent: some View {
        ScrollViewReader { proxy in
            List {
                ForEach(filteredLogs) { entry in
                    DebugLogRow(entry: entry)
                        .listRowSeparator(.hidden)
                        .listRowBackground(Color.clear)
                }
            }
            .listStyle(.plain)
            .font(.system(.caption, design: .monospaced))
            .onChange(of: filteredLogs.count) { _ in
                if autoScroll && !isPaused {
                    withAnimation {
                        if let lastEntry = filteredLogs.last {
                            proxy.scrollTo(lastEntry.id, anchor: .bottom)
                        }
                    }
                }
            }
        }
    }
    
    // MARK: - Footer
    
    private var debugFooter: some View {
        HStack {
            HStack(spacing: 16) {
                Label("\(filteredLogs.count)", systemImage: "doc.text")
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                Label("\(debugService.errorCount)", systemImage: "exclamationmark.triangle")
                    .font(.caption)
                    .foregroundColor(.red)
                
                Label("\(debugService.warningCount)", systemImage: "exclamationmark.circle")
                    .font(.caption)
                    .foregroundColor(.orange)
            }
            
            Spacer()
            
            if isPaused {
                Text("PAUSED")
                    .font(.caption)
                    .fontWeight(.bold)
                    .foregroundColor(.orange)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 2)
                    .background(.orange.opacity(0.2))
                    .cornerRadius(4)
            }
            
            Text("Last update: \(debugService.lastUpdate, formatter: timeFormatter)")
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
        .background(.regularMaterial)
    }
    
    // MARK: - Helper Methods
    
    private func scrollToBottom() {
        // Scrolling is handled in the onChange modifier
    }
    
    private func exportLogs() {
        let panel = NSSavePanel()
        panel.nameFieldStringValue = "debug-logs-\(Date().timeIntervalSince1970).txt"
        panel.allowedContentTypes = [.plainText]
        
        if panel.runModal() == .OK, let url = panel.url {
            let logText = filteredLogs.map { entry in
                "[\(entry.timestamp, formatter: timestampFormatter)] [\(entry.level.displayName)] [\(entry.category.displayName)] \(entry.message)"
            }.joined(separator: "\n")
            
            try? logText.write(to: url, atomically: true, encoding: .utf8)
        }
    }
    
    private var timeFormatter: DateFormatter {
        let formatter = DateFormatter()
        formatter.timeStyle = .medium
        return formatter
    }
    
    private var timestampFormatter: DateFormatter {
        let formatter = DateFormatter()
        formatter.dateStyle = .short
        formatter.timeStyle = .medium
        return formatter
    }
}

// MARK: - Debug Log Row

struct DebugLogRow: View {
    let entry: DebugLogEntry
    @State private var isExpanded = false
    
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                // Timestamp
                Text(entry.timestamp, formatter: timeFormatter)
                    .foregroundColor(.secondary)
                    .frame(width: 80, alignment: .leading)
                
                // Level indicator
                Text(entry.level.shortName)
                    .font(.caption2)
                    .fontWeight(.medium)
                    .foregroundColor(.white)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(entry.level.color)
                    .cornerRadius(4)
                
                // Category
                Text(entry.category.shortName)
                    .font(.caption2)
                    .foregroundColor(.secondary)
                    .frame(width: 60, alignment: .leading)
                
                // Message
                Text(entry.message)
                    .lineLimit(isExpanded ? nil : 1)
                    .foregroundColor(entry.level.textColor)
                
                Spacer()
                
                // Expand button for long messages
                if entry.message.count > 100 {
                    Button(action: { isExpanded.toggle() }) {
                        Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                    .buttonStyle(.plain)
                }
            }
            
            // Stack trace or additional info (if available)
            if isExpanded && !entry.details.isEmpty {
                Text(entry.details)
                    .font(.caption2)
                    .foregroundColor(.secondary)
                    .padding(.leading, 20)
            }
        }
        .padding(.vertical, 1)
        .contentShape(Rectangle())
        .onTapGesture {
            if entry.message.count > 100 {
                isExpanded.toggle()
            }
        }
    }
    
    private var timeFormatter: DateFormatter {
        let formatter = DateFormatter()
        formatter.timeStyle = .medium
        return formatter
    }
}

// MARK: - Debug Service

class DebugService: ObservableObject {
    static let shared = DebugService()
    
    @Published var logs: [DebugLogEntry] = []
    @Published var lastUpdate = Date()
    @Published var categoryFilters: [DebugCategory: Bool] = [:]
    
    private let maxLogs = 10000
    private var cancellables = Set<AnyCancellable>()
    
    var errorCount: Int {
        logs.filter { $0.level == .error }.count
    }
    
    var warningCount: Int {
        logs.filter { $0.level == .warning }.count
    }
    
    private init() {
        setupCategoryFilters()
        setupSystemLogging()
    }
    
    private func setupCategoryFilters() {
        for category in DebugCategory.allCases {
            categoryFilters[category] = true
        }
    }
    
    private func setupSystemLogging() {
        // Monitor system logs for our bundle
        // This would require more sophisticated implementation for production
    }
    
    func log(_ message: String, level: DebugLogLevel, category: DebugCategory, details: String = "") {
        DispatchQueue.main.async {
            let entry = DebugLogEntry(
                message: message,
                level: level,
                category: category,
                details: details,
                timestamp: Date()
            )
            
            self.logs.append(entry)
            
            // Keep only recent logs to prevent memory issues
            if self.logs.count > self.maxLogs {
                self.logs.removeFirst(self.logs.count - self.maxLogs)
            }
            
            self.lastUpdate = Date()
        }
    }
    
    func clearLogs() {
        logs.removeAll()
        lastUpdate = Date()
    }
    
    func binding(for category: DebugCategory) -> Binding<Bool> {
        Binding(
            get: { self.categoryFilters[category] ?? true },
            set: { self.categoryFilters[category] = $0 }
        )
    }
}

// MARK: - Supporting Types

struct DebugLogEntry: Identifiable {
    let id = UUID()
    let message: String
    let level: DebugLogLevel
    let category: DebugCategory
    let details: String
    let timestamp: Date
}

enum DebugLogLevel: String, CaseIterable {
    case all = "All"
    case debug = "Debug"
    case info = "Info"
    case warning = "Warning"
    case error = "Error"
    
    var displayName: String { rawValue }
    var shortName: String {
        switch self {
        case .all: return "ALL"
        case .debug: return "DBG"
        case .info: return "INF"
        case .warning: return "WRN"
        case .error: return "ERR"
        }
    }
    
    var color: Color {
        switch self {
        case .all: return .gray
        case .debug: return .blue
        case .info: return .green
        case .warning: return .orange
        case .error: return .red
        }
    }
    
    var textColor: Color {
        switch self {
        case .error: return .red
        case .warning: return .orange
        default: return .primary
        }
    }
}

enum DebugCategory: String, CaseIterable {
    case ui = "UI"
    case webSocket = "WebSocket"
    case agent = "Agent"
    case performance = "Performance"
    case memory = "Memory"
    case network = "Network"
    case animation = "Animation"
    case system = "System"
    
    var displayName: String { rawValue }
    var shortName: String {
        switch self {
        case .ui: return "UI"
        case .webSocket: return "WS"
        case .agent: return "AGT"
        case .performance: return "PRF"
        case .memory: return "MEM"
        case .network: return "NET"
        case .animation: return "ANI"
        case .system: return "SYS"
        }
    }
}

// MARK: - Global Debug Logger

extension DebugService {
    static func logError(_ message: String, category: DebugCategory = .system, details: String = "") {
        shared.log(message, level: .error, category: category, details: details)
    }
    
    static func logWarning(_ message: String, category: DebugCategory = .system, details: String = "") {
        shared.log(message, level: .warning, category: category, details: details)
    }
    
    static func logInfo(_ message: String, category: DebugCategory = .system, details: String = "") {
        shared.log(message, level: .info, category: category, details: details)
    }
    
    static func logDebug(_ message: String, category: DebugCategory = .system, details: String = "") {
        shared.log(message, level: .debug, category: category, details: details)
    }
}

#Preview {
    DebugConsole()
        .frame(width: 800, height: 600)
        .onAppear {
            // Add sample logs
            DebugService.logInfo("Debug console initialized", category: .ui)
            DebugService.logWarning("WebSocket connection unstable", category: .webSocket)
            DebugService.logError("Failed to load agent configuration", category: .agent, details: "Configuration file not found at path: /config/agents.json")
            DebugService.logDebug("Memory usage: 45.2MB", category: .memory)
            DebugService.logInfo("Performance metrics updated", category: .performance)
        }
}