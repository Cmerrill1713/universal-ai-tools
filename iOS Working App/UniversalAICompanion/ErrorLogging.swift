import Foundation
import os.log

enum LogLevel {
    case debug
    case info
    case warning
    case error
    case critical
}

class ErrorLogger {
    static let shared = ErrorLogger()

    private let logger = Logger(subsystem: "com.universalaitools.companion", category: "main")
    private let fileManager = FileManager.default

    private var logFileURL: URL {
        let documentsDirectory = fileManager.urls(for: .documentDirectory, in: .userDomainMask).first!
        return documentsDirectory.appendingPathComponent("error_log.txt")
    }

    private init() {
        setupLogRotation()
    }

    private func setupLogRotation() {
        // Implement log file rotation
        do {
            let attributes = try fileManager.attributesOfItem(atPath: logFileURL.path)
            if let fileSize = attributes[.size] as? Int64, fileSize > 1_000_000 { // 1MB
                rotateLogFile()
            }
        } catch {
            // Initial log file creation or error handling
            try? "".write(to: logFileURL, atomically: true, encoding: .utf8)
        }
    }

    private func rotateLogFile() {
        let archiveURL = logFileURL.deletingLastPathComponent()
            .appendingPathComponent("error_log_\(Date().timeIntervalSince1970).txt")

        do {
            try fileManager.moveItem(at: logFileURL, to: archiveURL)
            try? "".write(to: logFileURL, atomically: true, encoding: .utf8)
        } catch {
            print("Failed to rotate log file: \(error)")
        }
    }

    func log(
        _ message: String,
        level: LogLevel = .info,
        error: Error? = nil,
        file: String = #file,
        function: String = #function,
        line: Int = #line
    ) {
        let fileName = (file as NSString).lastPathComponent
        let logMessage = """
        [\(Date())] \(level) - \(fileName):\(line) \(function)
        Message: \(message)
        \(error?.localizedDescription ?? "")

        """

        // Log to system console
        switch level {
        case .debug:
            logger.debug("\(logMessage)")
        case .info:
            logger.info("\(logMessage)")
        case .warning:
            logger.warning("\(logMessage)")
        case .error:
            logger.error("\(logMessage)")
        case .critical:
            logger.critical("\(logMessage)")
        }

        // Log to file
        appendToLogFile(logMessage)
    }

    private func appendToLogFile(_ message: String) {
        do {
            let fileHandle = try FileHandle(forWritingTo: logFileURL)
            fileHandle.seekToEndOfFile()
            fileHandle.write(message.data(using: .utf8)!)
            fileHandle.closeFile()
        } catch {
            // If file doesn't exist or can't be opened, create it
            try? message.write(to: logFileURL, atomically: true, encoding: .utf8)
        }
    }

    func captureAndLogError(
        _ error: Error,
        context: [String: Any]? = nil,
        level: LogLevel = .error
    ) {
        var logContext: [String: Any] = [
            "error_type": String(describing: type(of: error)),
            "error_description": error.localizedDescription
        ]

        if let context = context {
            for (k, v) in context { logContext[k] = v }
        }

        log(
            "Error Captured: \(logContext)",
            level: level,
            error: error,
            file: #file,
            function: #function,
            line: #line
        )
    }
}

// Extension to make error logging more convenient
extension Error {
    func log(context: [String: Any]? = nil, level: LogLevel = .error) {
        ErrorLogger.shared.captureAndLogError(self, context: context, level: level)
    }
}

// Convenience function for quick logging
func log(
    _ message: String,
    level: LogLevel = .info,
    error: Error? = nil,
    file: String = #file,
    function: String = #function,
    line: Int = #line
) {
    ErrorLogger.shared.log(
        message,
        level: level,
        error: error,
        file: file,
        function: function,
        line: line
    )
}
