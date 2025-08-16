import Foundation
import SwiftUI
import Combine

/// ServiceContainer provides lazy initialization and centralized access to all conversation services
@MainActor
public class ServiceContainer: ObservableObject {
    
    // MARK: - Lazy Service Properties
    
    private var _conversationAnalytics: ConversationAnalytics?
    private var _conversationManager: ConversationManager?
    private var _agentService: AgentConversationService?
    private var _voiceInterface: EnhancedVoiceInterface?
    private var _conversationIntegration: ConversationMonitoringIntegration?
    
    // MARK: - Service Accessors
    
    public var conversationAnalytics: ConversationAnalytics {
        if _conversationAnalytics == nil {
            _conversationAnalytics = ConversationAnalytics(
                loggingService: LoggingService.shared,
                monitoringService: MonitoringService.shared
            )
        }
        return _conversationAnalytics!
    }
    
    public var conversationManager: ConversationManager {
        if _conversationManager == nil {
            _conversationManager = ConversationManager(
                apiService: APIService(),
                loggingService: LoggingService.shared,
                monitoringService: MonitoringService.shared
            )
        }
        return _conversationManager!
    }
    
    public var agentService: AgentConversationService {
        if _agentService == nil {
            _agentService = AgentConversationService(
                apiService: APIService(),
                loggingService: LoggingService.shared,
                monitoringService: MonitoringService.shared
            )
        }
        return _agentService!
    }
    
    public var voiceInterface: EnhancedVoiceInterface {
        if _voiceInterface == nil {
            _voiceInterface = EnhancedVoiceInterface(
                conversationManager: conversationManager,
                agentService: agentService,
                loggingService: LoggingService.shared
            )
        }
        return _voiceInterface!
    }
    
    public var conversationIntegration: ConversationMonitoringIntegration {
        if _conversationIntegration == nil {
            _conversationIntegration = ConversationMonitoringIntegration(
                loggingService: LoggingService.shared,
                monitoringService: MonitoringService.shared,
                conversationAnalytics: conversationAnalytics
            )
        }
        return _conversationIntegration!
    }
    
    // MARK: - Initialization
    
    public init() {
        // Services are initialized lazily on first access
    }
    
    // MARK: - Service Management
    
    /// Reset all services (useful for testing or cleanup)
    public func resetServices() {
        _conversationAnalytics = nil
        _conversationManager = nil
        _agentService = nil
        _voiceInterface = nil
        _conversationIntegration = nil
    }
    
    /// Preload all services (optional, for eager initialization)
    public func preloadServices() async {
        _ = conversationAnalytics
        _ = conversationManager
        _ = agentService
        _ = voiceInterface
        _ = conversationIntegration
    }
}