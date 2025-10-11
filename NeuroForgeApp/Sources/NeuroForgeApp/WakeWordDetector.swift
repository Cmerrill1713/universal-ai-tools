import Foundation
import Speech
import AVFoundation

@MainActor
class WakeWordDetector: NSObject, ObservableObject {
    @Published var isListening = false
    @Published var wakeWordDetected = false
    
    private var audioEngine: AVAudioEngine?
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private let speechRecognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
    
    private let wakeWords = ["hey athena", "hi athena", "okay athena"]
    
    func startListening() async throws {
        // Request speech recognition authorization
        let authStatus = await withCheckedContinuation { continuation in
            SFSpeechRecognizer.requestAuthorization { status in
                continuation.resume(returning: status)
            }
        }
        
        guard authStatus == .authorized else {
            throw NSError(domain: "WakeWord", code: 1, userInfo: [NSLocalizedDescriptionKey: "Speech recognition not authorized"])
        }
        
        audioEngine = AVAudioEngine()
        recognitionRequest = SFSpeechAudioBufferRecognitionRequest()
        
        guard let audioEngine = audioEngine,
              let recognitionRequest = recognitionRequest,
              let speechRecognizer = speechRecognizer else {
            throw NSError(domain: "WakeWord", code: 2, userInfo: [NSLocalizedDescriptionKey: "Audio engine setup failed"])
        }
        
        recognitionRequest.shouldReportPartialResults = true
        
        let inputNode = audioEngine.inputNode
        let recordingFormat = inputNode.outputFormat(forBus: 0)
        
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) { buffer, _ in
            recognitionRequest.append(buffer)
        }
        
        audioEngine.prepare()
        try audioEngine.start()
        
        isListening = true
        
        recognitionTask = speechRecognizer.recognitionTask(with: recognitionRequest) { [weak self] result, error in
            guard let self = self else { return }
            
            if let result = result {
                let transcription = result.bestTranscription.formattedString.lowercased()
                print("🎤 Heard: \(transcription)")
                
                // Check for wake word
                for wakeWord in self.wakeWords {
                    if transcription.contains(wakeWord) {
                        Task { @MainActor in
                            print("✨ Wake word detected: \(wakeWord)")
                            self.wakeWordDetected = true
                            self.stopListening()
                        }
                        break
                    }
                }
            }
            
            if error != nil {
                self.stopListening()
            }
        }
    }
    
    func stopListening() {
        audioEngine?.stop()
        audioEngine?.inputNode.removeTap(onBus: 0)
        recognitionRequest?.endAudio()
        recognitionTask?.cancel()
        
        audioEngine = nil
        recognitionRequest = nil
        recognitionTask = nil
        isListening = false
    }
}

