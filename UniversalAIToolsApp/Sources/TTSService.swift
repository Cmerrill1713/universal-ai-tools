import Foundation
import AVFoundation

@MainActor
class TTSService: ObservableObject {
    @Published var isEnabled = true
    @Published var isGenerating = false
    @Published var lastGenerationTime: TimeInterval = 0
    @Published var speechRate: Float = 0.5
    @Published var voice: AVSpeechSynthesisVoice?
    
    private let synthesizer = AVSpeechSynthesizer()
    private let session = URLSession.shared
    
    // TTS Service URL (if using external service)
    private let ttsServiceURL = "http://localhost:8020/tts"
    
    init() {
        setupVoice()
    }
    
    private func setupVoice() {
        // Try to find a good default voice
        if let englishVoice = AVSpeechSynthesisVoice.speechVoices().first(where: { 
            $0.language.hasPrefix("en") && $0.quality == .enhanced 
        }) {
            voice = englishVoice
        } else if let anyEnglishVoice = AVSpeechSynthesisVoice.speechVoices().first(where: { 
            $0.language.hasPrefix("en") 
        }) {
            voice = anyEnglishVoice
        } else {
            voice = AVSpeechSynthesisVoice(language: "en-US")
        }
    }
    
    func generateSpeech(for text: String) async -> Bool {
        guard isEnabled && !text.isEmpty else { return false }
        
        isGenerating = true
        let startTime = Date()
        
        do {
            let response = try await performTTSRequest(text: text)
            let generationTime = Date().timeIntervalSince(startTime)
            lastGenerationTime = generationTime
            
            if response.success, let audioData = response.audioData {
                await playAudioData(audioData)
                return true
            } else {
                print("❌ TTS generation failed: \(response.error ?? "Unknown error")")
                return false
            }
        } catch {
            print("❌ TTS request failed: \(error.localizedDescription)")
            isGenerating = false
            return false
        }
    }
    
    private func performTTSRequest(text: String) async throws -> TTSResponse {
        guard let url = URL(string: ttsServiceURL) else {
            throw TTSError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let payload: [String: Any] = [
            "text": text,
            "voice": voice?.identifier ?? "default",
            "rate": speechRate
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: payload)
        
        let (data, response) = try await session.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw TTSError.invalidResponse
        }
        
        return try JSONDecoder().decode(TTSResponse.self, from: data)
    }
    
    private func playAudioData(_ audioData: Data) async {
        // For now, fall back to system TTS if external service fails
        await playSystemTTS(audioData)
    }
    
    private func playSystemTTS(_ audioData: Data) async {
        // This would implement system TTS playback
        // For now, we'll use AVSpeechSynthesizer as fallback
        isGenerating = false
    }
    
    func speakText(_ text: String) {
        guard isEnabled && !text.isEmpty else { return }
        
        let utterance = AVSpeechUtterance(string: text)
        utterance.voice = voice
        utterance.rate = speechRate
        
        synthesizer.speak(utterance)
    }
    
    func stopSpeaking() {
        synthesizer.stopSpeaking(at: .immediate)
        isGenerating = false
    }
    
    func pauseSpeaking() {
        synthesizer.pauseSpeaking(at: .word)
    }
    
    func continueSpeaking() {
        synthesizer.continueSpeaking()
    }
    
    func setVoice(_ voice: AVSpeechSynthesisVoice) {
        self.voice = voice
    }
    
    func setSpeechRate(_ rate: Float) {
        self.speechRate = max(0.0, min(1.0, rate))
    }
    
    func toggleEnabled() {
        isEnabled.toggle()
        if !isEnabled {
            stopSpeaking()
        }
    }
}

// MARK: - Data Models

struct TTSResponse: Codable {
    let success: Bool
    let audioData: Data?
    let error: String?
    let duration: TimeInterval?
    
    enum CodingKeys: String, CodingKey {
        case success, error, duration
        case audioData = "audio_data"
    }
}

enum TTSError: Error {
    case invalidURL
    case invalidResponse
    case networkError
    case audioError
}

// MARK: - TTS Configuration

extension TTSService {
    var availableVoices: [AVSpeechSynthesisVoice] {
        AVSpeechSynthesisVoice.speechVoices().filter { $0.language.hasPrefix("en") }
    }
    
    var isSpeaking: Bool {
        synthesizer.isSpeaking
    }
    
    var isPaused: Bool {
        synthesizer.isPaused
    }
}
