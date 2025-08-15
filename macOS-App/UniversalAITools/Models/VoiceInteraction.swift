import Foundation
import SwiftUI

// MARK: - Voice Interaction
struct VoiceInteraction: Identifiable, Codable, Hashable {
    let id: UUID
    let userInput: String
    let aiResponse: String?
    let timestamp: Date
    let duration: TimeInterval
    let transcriptionConfidence: Double
    let successful: Bool
    let sessionId: String
    
    init(
        id: UUID = UUID(),
        userInput: String,
        aiResponse: String? = nil,
        timestamp: Date = Date(),
        duration: TimeInterval = 0,
        transcriptionConfidence: Double = 1.0,
        successful: Bool = true,
        sessionId: String = UUID().uuidString
    ) {
        self.id = id
        self.userInput = userInput
        self.aiResponse = aiResponse
        self.timestamp = timestamp
        self.duration = duration
        self.transcriptionConfidence = transcriptionConfidence
        self.successful = successful
        self.sessionId = sessionId
    }
}

// MARK: - Voice Interaction Mode
enum VoiceInteractionMode: String, CaseIterable, Identifiable {
    case conversational = "conversational"
    case command = "command"
    case dictation = "dictation"
    case assistant = "assistant"
    
    var id: String { rawValue }
    
    var displayName: String {
        switch self {
        case .conversational: return "Conversational"
        case .command: return "Command Mode"
        case .dictation: return "Dictation"
        case .assistant: return "AI Assistant"
        }
    }
    
    var description: String {
        switch self {
        case .conversational: return "Natural conversation with AI"
        case .command: return "Execute specific commands"
        case .dictation: return "Text dictation only"
        case .assistant: return "Intelligent assistant mode"
        }
    }
    
    var icon: String {
        switch self {
        case .conversational: return "bubble.left.and.bubble.right"
        case .command: return "terminal"
        case .dictation: return "doc.text"
        case .assistant: return "brain.head.profile"
        }
    }
}

// MARK: - Voice Agent State
enum VoiceAgentState: Equatable {
    case idle
    case listening
    case processing
    case responding
    case error(String)
    
    var displayName: String {
        switch self {
        case .idle: return "Ready"
        case .listening: return "Listening..."
        case .processing: return "Processing..."
        case .responding: return "Responding..."
        case .error(let message): return "Error: \(message)"
        }
    }
    
    var color: Color {
        switch self {
        case .idle: return .gray
        case .listening: return .blue
        case .processing: return .orange
        case .responding: return .green
        case .error: return .red
        }
    }
    
    var icon: String {
        switch self {
        case .idle: return "mic.slash"
        case .listening: return "mic"
        case .processing: return "waveform"
        case .responding: return "speaker.wave.2"
        case .error: return "exclamationmark.triangle"
        }
    }
    
    static func == (lhs: VoiceAgentState, rhs: VoiceAgentState) -> Bool {
        switch (lhs, rhs) {
        case (.idle, .idle), (.listening, .listening), (.processing, .processing), (.responding, .responding):
            return true
        case (.error(let lhsMessage), .error(let rhsMessage)):
            return lhsMessage == rhsMessage
        default:
            return false
        }
    }
}

// MARK: - STT Input Mode
enum STTInputMode: String, CaseIterable, Identifiable, Codable {
    case voiceActivation = "voice_activation"
    case continuous = "continuous"
    case pushToTalk = "push_to_talk"
    case manual = "manual"
    
    var id: String { rawValue }
    
    var displayName: String {
        switch self {
        case .voiceActivation: return "Voice Activation"
        case .continuous: return "Continuous"
        case .pushToTalk: return "Push to Talk"
        case .manual: return "Manual"
        }
    }
    
    var description: String {
        switch self {
        case .voiceActivation: return "Activates on voice detection"
        case .continuous: return "Always listening"
        case .pushToTalk: return "Hold to record"
        case .manual: return "Manual start/stop"
        }
    }
    
    var icon: String {
        switch self {
        case .voiceActivation: return "waveform.badge.mic"
        case .continuous: return "mic.circle"
        case .pushToTalk: return "mic.square"
        case .manual: return "mic.slash"
        }
    }
}

// MARK: - TTS Playback State
enum TTSPlaybackState: String, CaseIterable, Codable {
    case idle = "idle"
    case speaking = "speaking"
    case paused = "paused"
    case error = "error"
    
    var displayName: String {
        switch self {
        case .idle: return "Ready"
        case .speaking: return "Speaking"
        case .paused: return "Paused"
        case .error: return "Error"
        }
    }
    
    var color: Color {
        switch self {
        case .idle: return .gray
        case .speaking: return .green
        case .paused: return .orange
        case .error: return .red
        }
    }
    
    var icon: String {
        switch self {
        case .idle: return "speaker"
        case .speaking: return "speaker.wave.2"
        case .paused: return "speaker.slash"
        case .error: return "speaker.slash.circle"
        }
    }
}