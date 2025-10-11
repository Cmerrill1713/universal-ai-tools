import Foundation

/// API-specific errors mapped from HTTP status codes
public enum APIError: Error, LocalizedError {
    case validation422(message: String?)
    case service503
    case server5xx(code: Int)
    case decoding(Error)
    case transport(Error)
    case invalidResponse
    
    public var errorDescription: String? {
        switch self {
        case .validation422(let msg):
            return msg ?? "Validation error - please check your input"
        case .service503:
            return "Service temporarily unavailable - please try again"
        case .server5xx(let code):
            return "Server error (\(code)) - please try again later"
        case .decoding(let error):
            return "Response decoding failed: \(error.localizedDescription)"
        case .transport(let error):
            return "Network error: \(error.localizedDescription)"
        case .invalidResponse:
            return "Invalid response from server"
        }
    }
    
    public var severity: ErrorSeverity {
        switch self {
        case .validation422:
            return .info
        case .service503:
            return .warning
        case .server5xx, .transport, .invalidResponse:
            return .error
        case .decoding:
            return .warning
        }
    }
}

public enum ErrorSeverity {
    case info, warning, error
}

