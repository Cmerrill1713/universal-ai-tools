import SwiftUI

/// Centralized error handling that provides user-friendly alerts without crashing
@MainActor
public final class ErrorCenter: ObservableObject {
    @Published public var activeBanner: BannerData? = nil
    @Published public var recentErrors: [String] = []
    
    private let maxRecentErrors = 50
    
    public init() {}
    
    /// Handle an API error with user-friendly messaging
    public func handle(_ error: Error, context: String = "") {
        let bannerData = createBanner(for: error, context: context)
        activeBanner = bannerData
        
        // Log to recent errors
        let errorMsg = "\(Date().formatted(date: .omitted, time: .standard)) [\(context)] \(error.localizedDescription)"
        recentErrors.insert(errorMsg, at: 0)
        if recentErrors.count > maxRecentErrors {
            recentErrors.removeLast()
        }
        
        // Auto-dismiss info banners after 5 seconds
        if bannerData.kind == .info {
            Task {
                try? await Task.sleep(nanoseconds: 5_000_000_000)
                if activeBanner?.id == bannerData.id {
                    activeBanner = nil
                }
            }
        }
    }
    
    private func createBanner(for error: Error, context: String) -> BannerData {
        if let apiError = error as? APIError {
            switch apiError {
            case .validation422(let message):
                return BannerData(
                    message: message ?? "Please check your input",
                    kind: .info,
                    context: context
                )
            case .service503:
                return BannerData(
                    message: "Service temporarily unavailable - the app remains usable",
                    kind: .warning,
                    context: context
                )
            case .server5xx(let code):
                return BannerData(
                    message: "Server error (\(code)) - please try again",
                    kind: .error,
                    context: context
                )
            case .decoding:
                return BannerData(
                    message: "Response format error - please report this",
                    kind: .warning,
                    context: context
                )
            case .transport:
                return BannerData(
                    message: "Network connection issue - check your internet",
                    kind: .warning,
                    context: context
                )
            case .invalidResponse:
                return BannerData(
                    message: "Invalid server response",
                    kind: .error,
                    context: context
                )
            }
        } else {
            return BannerData(
                message: error.localizedDescription,
                kind: .error,
                context: context
            )
        }
    }
    
    public func clearBanner() {
        activeBanner = nil
    }
}

/// Banner data for displaying errors
public struct BannerData: Identifiable {
    public let id = UUID()
    public let message: String
    public let kind: BannerKind
    public let context: String
    
    public enum BannerKind {
        case info, warning, error
        
        var color: Color {
            switch self {
            case .info: return .blue
            case .warning: return .orange
            case .error: return .red
            }
        }
        
        var icon: String {
            switch self {
            case .info: return "info.circle.fill"
            case .warning: return "exclamationmark.triangle.fill"
            case .error: return "xmark.circle.fill"
            }
        }
    }
}

