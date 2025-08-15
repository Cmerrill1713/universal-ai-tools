import Foundation
import SwiftUI
import Combine

// Note: STTService is now defined in STTService.swift
// Note: VoiceAgent is defined in VoiceAgent.swift

// MARK: - Voice UI Components

struct VoiceActivityIndicator: View {
    @ObservedObject var sttService: STTService
    
    var body: some View {
        Circle()
            .fill(indicatorColor)
            .frame(width: 12, height: 12)
            .scaleEffect(sttService.isListening ? 1.2 : 1.0)
            .animation(.easeInOut(duration: 0.5).repeatForever(autoreverses: true), value: sttService.isListening)
    }
    
    private var indicatorColor: Color {
        switch sttService.recognitionState {
        case .idle:
            return .gray
        case .listening:
            return .red
        case .processing:
            return .orange
        case .completed:
            return .green
        case .error:
            return .red
        }
    }
}

struct CompactVoiceButton: View {
    @ObservedObject var sttService: STTService
    let onToggle: () -> Void
    
    var body: some View {
        Button(action: onToggle) {
            Image(systemName: sttService.isListening ? "mic.fill" : "mic")
                .font(.system(size: 16, weight: .medium))
                .foregroundColor(.white)
                .frame(width: 32, height: 32)
                .background(sttService.isListening ? Color.red.gradient : Color.blue.gradient)
                .clipShape(Circle())
        }
        .buttonStyle(.plain)
    }
}

struct VoiceControlsPanel: View {
    @ObservedObject var sttService: STTService
    @ObservedObject var ttsService: TTSService
    
    var body: some View {
        VStack(spacing: 20) {
            Text("Voice Controls")
                .font(.headline)
            
            VStack(alignment: .leading, spacing: 12) {
                Toggle("Voice Recognition", isOn: $sttService.isAuthorized)
                Toggle("Text to Speech", isOn: $ttsService.isEnabled)
            }
            
            Spacer()
        }
        .padding()
    }
}

struct VoiceRecordingView: View {
    @ObservedObject var sttService: STTService
    let onTranscriptionComplete: (String) -> Void
    
    @State private var isRecording = false
    
    var body: some View {
        VStack(spacing: 20) {
            Text("Voice Recording")
                .font(.headline)
            
            Circle()
                .fill(isRecording ? Color.red : Color.gray)
                .frame(width: 80, height: 80)
                .scaleEffect(isRecording ? 1.1 : 1.0)
                .animation(.easeInOut(duration: 0.5).repeatForever(autoreverses: true), value: isRecording)
                .onTapGesture {
                    toggleRecording()
                }
            
            Text(isRecording ? "Recording..." : "Tap to record")
                .font(.caption)
                .foregroundColor(.secondary)
            
            if !sttService.partialTranscription.isEmpty {
                Text(sttService.partialTranscription)
                    .font(.body)
                    .padding()
                    .background(Color.gray.opacity(0.1))
                    .cornerRadius(8)
            }
            
            Spacer()
        }
        .padding()
    }
    
    private func toggleRecording() {
        if isRecording {
            isRecording = false
            sttService.stopListening()
        } else {
            isRecording = true
            Task {
                do {
                    try await sttService.startListening(
                        onComplete: { [weak self] transcription in
                            Task { @MainActor in
                                self?.isRecording = false
                                self?.onTranscriptionComplete(transcription)
                            }
                        },
                        onPartial: { _ in
                            // Handle partial results if needed
                        }
                    )
                } catch {
                    await MainActor.run {
                        self.isRecording = false
                        // Handle error - could show an alert or error message
                    }
                }
            }
        }
    }
}