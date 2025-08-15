import SwiftUI

struct VoiceControlsPanel: View {
    let sttService: STTService
    let ttsService: TTSService
    let voiceAgent: VoiceAgent
    
    var body: some View {
        VStack(spacing: 20) {
            Text("Voice Controls")
                .font(.title2)
                .fontWeight(.semibold)
            
            Text("Voice services are being configured...")
                .font(.body)
                .foregroundColor(.secondary)
            
            Spacer()
        }
        .padding()
    }
}

struct VoiceRecordingView: View {
    let sttService: STTService
    let voiceAgent: VoiceAgent
    let onTranscriptionComplete: (String) -> Void
    
    var body: some View {
        VStack(spacing: 20) {
            Text("Voice Recording")
                .font(.title2)
                .fontWeight(.semibold)
            
            Text("Voice recording interface coming soon...")
                .font(.body)
                .foregroundColor(.secondary)
            
            Button("Close") {
                onTranscriptionComplete("")
            }
            
            Spacer()
        }
        .padding()
    }
}

struct VoiceActivityIndicator: View {
    let voiceAgent: VoiceAgent
    
    var body: some View {
        Circle()
            .fill(Color.blue)
            .frame(width: 20, height: 20)
    }
}

struct CompactVoiceButton: View {
    let voiceAgent: VoiceAgent
    
    var body: some View {
        Button(action: {}) {
            Image(systemName: "mic")
                .font(.caption)
        }
        .buttonStyle(.borderless)
    }
}