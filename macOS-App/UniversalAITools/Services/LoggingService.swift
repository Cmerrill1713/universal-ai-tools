import Combine
import Foundation
import OSLog
import SwiftUI

// MARK: - Extended LogLevel
extension LogLevel {
    var osLogType: OSLogType {
        switch self {
        case .debug: return .debug
        case .info: return .info
        case .warning: return .error
        case .error: return .error
        case .critical: return .fault
        }
    }
}

// MARK: - Log Storage Protocol
public protocol LogStorage {
    func store(_ entry: LogEntry) async
    func retrieve(
        since: Date?,
        level: LogLevel?,
        category: LogCategory?,
        limit: Int?
    ) async -> [LogEntry]
    func clear() async
    func export() async -> Data?
}

// MARK: - File Log Storage Implementation
public class FileLogStorage: LogStorage {
    private let fileManager = FileManager.default
    private let logDirectory: URL
    private let maxFileSize: Int = 10 * 1024 * 1024 // 10MB
    private let maxFiles: Int = 5
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()
    private let queue = DispatchQueue(label: "com.universalai.logging.file", qos: .utility)
    
    public init() throws {
        let appSupport = try fileManager.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )
        
        logDirectory = appSupport.appendingPathComponent("UniversalAITools/Logs")
        try fileManager.createDirectory(at: logDirectory, withIntermediateDirectories: true)
        
        encoder.dateEncodingStrategy = .iso8601
        decoder.dateDecodingStrategy = .iso8601
    }
    
    public func store(_ entry: LogEntry) async {
        await withCheckedContinuation { continuation in
            queue.async {
                do {
                    let data = try self.encoder.encode(entry)
                    let logLine = String(data: data, encoding: .utf8)! + "\n"
                    
                    let currentLogFile = self.getCurrentLogFile()
                    
                    // Check if we need to rotate
                    if self.shouldRotateLog(currentLogFile) {
                        self.rotateLogFiles()
                    }
                    
                    // Append to current log file
                    let fileHandle = try FileHandle(forWritingTo: currentLogFile)
                    defer { fileHandle.closeFile() }
                    
                    fileHandle.seekToEndOfFile()
                    fileHandle.write(logLine.data(using: .utf8)!)
                } catch {
                    // Fallback to OSLog if file writing fails
                    os_log("Failed to write log to file: %@", log: OSLog.default, type: .error, error.localizedDescription)
                }
                continuation.resume()
            }
        }
    }
    
    public func retrieve(
        since: Date? = nil,
        level: LogLevel? = nil,
        category: LogCategory? = nil,
        limit: Int? = nil
    ) async -> [LogEntry] {
        return await withCheckedContinuation { continuation in
            queue.async {
                do {
                    var entries: [LogEntry] = []
                    let logFiles = self.getLogFiles()
                    
                    for logFile in logFiles.reversed() { // Start with newest
                        let content = try String(contentsOf: logFile, encoding: .utf8)
                        let lines = content.components(separatedBy: .newlines)
                        
                        for line in lines.reversed() { // Newest first
                            guard !line.isEmpty,
                                  let data = line.data(using: .utf8),
                                  let entry = try? self.decoder.decode(LogEntry.self, from: data) else {
                                continue
                            }
                            
                            // Apply filters
                            if let since = since, entry.timestamp < since { continue }
                            if let level = level, entry.level.rawValue < level.rawValue { continue }
                            if let category = category, entry.category != category { continue }
                            
                            entries.append(entry)
                            
                            // Apply limit
                            if let limit = limit, entries.count >= limit {
                                break
                            }
                        }
                        
                        if let limit = limit, entries.count >= limit {
                            break
                        }
                    }
                    
                    continuation.resume(returning: entries)
                } catch {
                    continuation.resume(returning: [])
                }
            }
        }
    }
    
    public func clear() async {
        await withCheckedContinuation { continuation in
            queue.async {
                do {
                    let logFiles = self.getLogFiles()
                    for file in logFiles {
                        try self.fileManager.removeItem(at: file)
                    }
                } catch {
                    os_log("Failed to clear log files: %@", log: OSLog.default, type: .error, error.localizedDescription)
                }
                continuation.resume()
            }
        }
    }
    
    public func export() async -> Data? {
        let entries = await retrieve(since: nil, level: nil, category: nil, limit: nil)
        let exportData = entries.map { $0.detailedMessage }.joined(separator: "\n")
        return exportData.data(using: .utf8)
    }
    
    // MARK: - Private Helper Methods
    
    private func getCurrentLogFile() -> URL {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        let dateString = formatter.string(from: Date())
        return logDirectory.appendingPathComponent("universal-ai-tools-\(dateString).log")
    }
    
    private func shouldRotateLog(_ logFile: URL) -> Bool {
        guard fileManager.fileExists(atPath: logFile.path) else { return false }
        
        do {
            let attributes = try fileManager.attributesOfItem(atPath: logFile.path)
            if let fileSize = attributes[.size] as? Int {
                return fileSize >= maxFileSize
            }
        } catch {
            return false
        }
        
        return false
    }
    
    private func rotateLogFiles() {
        let logFiles = getLogFiles()
        
        // Remove excess files
        if logFiles.count >= maxFiles {
            let filesToRemove = logFiles.prefix(logFiles.count - maxFiles + 1)
            for file in filesToRemove {
                try? fileManager.removeItem(at: file)
            }
        }
    }
    
    private func getLogFiles() -> [URL] {
        do {
            let files = try fileManager.contentsOfDirectory(
                at: logDirectory,
                includingPropertiesForKeys: [.creationDateKey],
                options: [.skipsHiddenFiles]
            )
            
            return files
                .filter { $0.pathExtension == "log" }
                .sorted { file1, file2 in
                    let date1 = (try? file1.resourceValues(forKeys: [.creationDateKey]))?.creationDate ?? Date.distantPast
                    let date2 = (try? file2.resourceValues(forKeys: [.creationDateKey]))?.creationDate ?? Date.distantPast
                    return date1 < date2
                }
        } catch {
            return []
        }
    }
}

// MARK: - Memory Log Storage Implementation
public class MemoryLogStorage: LogStorage {
    private var entries: [LogEntry] = []
    private let maxEntries: Int = 1000
    private let queue = DispatchQueue(label: "com.universalai.logging.memory", qos: .utility)
    
    public init() {}
    
    public func store(_ entry: LogEntry) async {
        await withCheckedContinuation { continuation in
            queue.async {
                self.entries.append(entry)
                
                // Keep only the most recent entries
                if self.entries.count > self.maxEntries {
                    self.entries.removeFirst(self.entries.count - self.maxEntries)
                }
                
                continuation.resume()
            }
        }
    }
    
    public func retrieve(
        since: Date? = nil,
        level: LogLevel? = nil,
        category: LogCategory? = nil,
        limit: Int? = nil
    ) async -> [LogEntry] {
        return await withCheckedContinuation { continuation in
            queue.async {
                var filtered = self.entries
                
                // Apply filters
                if let since = since {
                    filtered = filtered.filter { $0.timestamp >= since }
                }
                
                if let level = level {
                    filtered = filtered.filter { $0.level.rawValue >= level.rawValue }
                }
                
                if let category = category {
                    filtered = filtered.filter { $0.category == category }
                }
                
                // Sort by timestamp (newest first)
                filtered.sort { $0.timestamp > $1.timestamp }
                
                // Apply limit
                if let limit = limit {
                    filtered = Array(filtered.prefix(limit))
                }
                
                continuation.resume(returning: filtered)
            }
        }
    }
    
    public func clear() async {
        await withCheckedContinuation { continuation in
            queue.async {
                self.entries.removeAll()
                continuation.resume()
            }
        }
    }
    
    public func export() async -> Data? {
        let entries = await retrieve(since: nil, level: nil, category: nil, limit: nil)
        let exportData = entries.map { $0.detailedMessage }.joined(separator: "\n")
        return exportData.data(using: .utf8)
    }
}

// MARK: - Remote Log Streaming
public class RemoteLogStreamer: ObservableObject {
    @Published public var isConnected = false
    @Published public var connectionError: String?
    
    private let baseURL: String
    private let session: URLSession
    private let encoder = JSONEncoder()
    private let queue = DispatchQueue(label: "com.universalai.logging.remote", qos: .utility)
    private var streamingTask: Task<Void, Never>?
    private var pendingLogs: [LogEntry] = []
    private let maxBatchSize = 100
    private let batchInterval: TimeInterval = 5.0
    
    public init(baseURL: String = "http://localhost:9999") {
        self.baseURL = baseURL
        self.session = URLSession.shared
        self.encoder.dateEncodingStrategy = .iso8601
    }
    
    public func startStreaming() {
        guard streamingTask == nil else { return }
        
        streamingTask = Task {
            await streamLogs()
        }
    }
    
    public func stopStreaming() {
        streamingTask?.cancel()
        streamingTask = nil
        
        DispatchQueue.main.async {
            self.isConnected = false
        }
    }
    
    public func stream(_ entry: LogEntry) async {
        await withCheckedContinuation { continuation in
            queue.async {
                self.pendingLogs.append(entry)
                continuation.resume()
            }
        }
    }
    
    private func streamLogs() async {
        var lastBatchTime = Date()
        
        while !Task.isCancelled {
            let currentTime = Date()
            let shouldSendBatch = currentTime.timeIntervalSince(lastBatchTime) >= batchInterval ||
                                 pendingLogs.count >= maxBatchSize
            
            if shouldSendBatch && !pendingLogs.isEmpty {
                let logsToSend = Array(pendingLogs.prefix(maxBatchSize))
                
                await sendLogBatch(logsToSend)
                
                await withCheckedContinuation { continuation in
                    queue.async {
                        self.pendingLogs.removeFirst(min(logsToSend.count, self.pendingLogs.count))
                        continuation.resume()
                    }
                }
                
                lastBatchTime = currentTime
            }
            
            try? await Task.sleep(nanoseconds: 1_000_000_000) // 1 second
        }
    }
    
    private func sendLogBatch(_ logs: [LogEntry]) async {
        guard !logs.isEmpty else { return }
        
        do {
            let endpoint = "\(baseURL)/api/v1/monitoring/logs"
            guard let url = URL(string: endpoint) else {
                await updateConnectionStatus(false, error: "Invalid monitoring endpoint URL")
                return
            }
            
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.timeoutInterval = 10
            
            let payload = [
                "source": "universal-ai-tools-macos",
                "timestamp": ISO8601DateFormatter().string(from: Date()),
                "logs": logs
            ] as [String: Any]
            
            request.httpBody = try JSONSerialization.data(withJSONObject: payload)
            
            let (_, response) = try await session.data(for: request)
            
            if let httpResponse = response as? HTTPURLResponse {
                let success = httpResponse.statusCode == 200
                await updateConnectionStatus(success, error: success ? nil : "HTTP \(httpResponse.statusCode)")
            }
        } catch {
            await updateConnectionStatus(false, error: error.localizedDescription)
        }
    }
    
    @MainActor
    private func updateConnectionStatus(_ connected: Bool, error: String?) {
        isConnected = connected
        connectionError = error
    }
}

// MARK: - Main Logging Service
@MainActor
public class LoggingService: ObservableObject {
    public static let shared = LoggingService()
    
    @Published public var isEnabled = true
    @Published public var minimumLevel: LogLevel = .debug
    @Published public var recentLogs: [LogEntry] = []
    @Published public var remoteStreamer: RemoteLogStreamer
    
    private let fileStorage: FileLogStorage
    private let memoryStorage = MemoryLogStorage()
    private let maxRecentLogs = 100
    
    private init() {
        do {
            self.fileStorage = try FileLogStorage()
        } catch {
            fatalError("Failed to initialize file logging: \(error)")
        }
        
        self.remoteStreamer = RemoteLogStreamer()
        
        // Start remote streaming if enabled
        remoteStreamer.startStreaming()
    }
    
    // MARK: - Public Logging Methods
    
    public func log(
        level: LogLevel,
        category: LogCategory,
        message: String,
        metadata: [String: String] = [:],
        file: String = #file,
        function: String = #function,
        line: Int = #line
    ) {
        guard isEnabled && level.rawValue >= minimumLevel.rawValue else { return }
        
        let entry = LogEntry(
            level: level,
            category: category,
            message: message,
            metadata: metadata,
            file: file,
            function: function,
            line: line
        )
        
        Task {
            // Store in multiple locations
            await fileStorage.store(entry)
            await memoryStorage.store(entry)
            await remoteStreamer.stream(entry)
            
            // Update recent logs for UI
            DispatchQueue.main.async {
                self.recentLogs.append(entry)
                if self.recentLogs.count > self.maxRecentLogs {
                    self.recentLogs.removeFirst(self.recentLogs.count - self.maxRecentLogs)
                }
            }
            
            // Also log to OSLog for system integration
            let osLogger = Logger(subsystem: "com.universalai.tools", category: category.rawValue)
            osLogger.log(level: level.osLogType, "\(message)")
        }
    }
    
    // Convenience methods
    public func debug(_ message: String, category: LogCategory = .app, metadata: [String: String] = [:], file: String = #file, function: String = #function, line: Int = #line) {
        log(level: .debug, category: category, message: message, metadata: metadata, file: file, function: function, line: line)
    }
    
    public func info(_ message: String, category: LogCategory = .app, metadata: [String: String] = [:], file: String = #file, function: String = #function, line: Int = #line) {
        log(level: .info, category: category, message: message, metadata: metadata, file: file, function: function, line: line)
    }
    
    public func warning(_ message: String, category: LogCategory = .app, metadata: [String: String] = [:], file: String = #file, function: String = #function, line: Int = #line) {
        log(level: .warning, category: category, message: message, metadata: metadata, file: file, function: function, line: line)
    }
    
    public func error(_ message: String, category: LogCategory = .app, metadata: [String: String] = [:], file: String = #file, function: String = #function, line: Int = #line) {
        log(level: .error, category: category, message: message, metadata: metadata, file: file, function: function, line: line)
    }
    
    public func critical(_ message: String, category: LogCategory = .app, metadata: [String: String] = [:], file: String = #file, function: String = #function, line: Int = #line) {
        log(level: .critical, category: category, message: message, metadata: metadata, file: file, function: function, line: line)
    }
    
    // MARK: - Log Retrieval
    
    public func getLogs(
        since: Date? = nil,
        level: LogLevel? = nil,
        category: LogCategory? = nil,
        limit: Int? = nil,
        source: LogStorageSource = .file
    ) async -> [LogEntry] {
        switch source {
        case .file:
            return await fileStorage.retrieve(since: since, level: level, category: category, limit: limit)
        case .memory:
            return await memoryStorage.retrieve(since: since, level: level, category: category, limit: limit)
        }
    }
    
    public func exportLogs(source: LogStorageSource = .file) async -> Data? {
        switch source {
        case .file:
            return await fileStorage.export()
        case .memory:
            return await memoryStorage.export()
        }
    }
    
    public func clearLogs(source: LogStorageSource = .file) async {
        switch source {
        case .file:
            await fileStorage.clear()
        case .memory:
            await memoryStorage.clear()
        }
        
        DispatchQueue.main.async {
            self.recentLogs.removeAll()
        }
    }
    
    // MARK: - Configuration
    
    public func setMinimumLevel(_ level: LogLevel) {
        minimumLevel = level
    }
    
    public func setEnabled(_ enabled: Bool) {
        isEnabled = enabled
    }
    
    public func configureRemoteStreaming(baseURL: String) {
        remoteStreamer.stopStreaming()
        remoteStreamer = RemoteLogStreamer(baseURL: baseURL)
        remoteStreamer.startStreaming()
    }
}

// MARK: - Supporting Types

public enum LogStorageSource {
    case file
    case memory
}

// MARK: - Global Logger Extension
extension LoggingService {
    /// Performance-aware logging that includes execution time tracking
    public func logPerformance<T>(
        operationName: String,
        category: LogCategory = .performance,
        metadata: [String: String] = [:],
        operation: () async throws -> T
    ) async rethrows -> T {
        let startTime = CFAbsoluteTimeGetCurrent()
        
        debug("Starting operation: \(operationName)", category: category, metadata: metadata)
        
        do {
            let result = try await operation()
            let duration = CFAbsoluteTimeGetCurrent() - startTime
            
            info("Operation completed: \(operationName) (duration: \(String(format: "%.3f", duration))s)", 
                 category: category, 
                 metadata: metadata.merging(["duration": String(duration)]) { current, new in new })
            
            return result
        } catch {
            let duration = CFAbsoluteTimeGetCurrent() - startTime
            
            self.error("Operation failed: \(operationName) (duration: \(String(format: "%.3f", duration))s, error: \(error.localizedDescription))", 
                      category: category, 
                      metadata: metadata.merging(["duration": String(duration), "error": error.localizedDescription]) { current, new in new })
            
            throw error
        }
    }
    
    /// Log user interactions for analytics and debugging
    public func logUserInteraction(
        action: String,
        component: String,
        metadata: [String: String] = [:]
    ) {
        let enrichedMetadata = metadata.merging([
            "component": component,
            "user_action": action,
            "session_id": UserDefaults.standard.string(forKey: "current_session_id") ?? "unknown"
        ]) { current, new in new }
        
        info("User interaction: \(action) on \(component)", 
             category: .userInterface, 
             metadata: enrichedMetadata)
    }
    
    /// Log API calls with request/response details
    public func logAPICall(
        endpoint: String,
        method: String,
        statusCode: Int? = nil,
        duration: TimeInterval? = nil,
        error: Error? = nil
    ) {
        var metadata: [String: String] = [
            "endpoint": endpoint,
            "method": method
        ]
        
        if let statusCode = statusCode {
            metadata["status_code"] = String(statusCode)
        }
        
        if let duration = duration {
            metadata["duration"] = String(format: "%.3f", duration)
        }
        
        if let error = error {
            self.error("API call failed: \(method) \(endpoint) - \(error.localizedDescription)", 
                      category: .network, 
                      metadata: metadata.merging(["error": error.localizedDescription]) { current, new in new })
        } else {
            info("API call: \(method) \(endpoint)", category: .network, metadata: metadata)
        }
    }
}