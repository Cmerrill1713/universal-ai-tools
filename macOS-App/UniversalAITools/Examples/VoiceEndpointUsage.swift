import Foundation
import Combine

/**
 * Example usage of the new voice endpoint integrations in APIService
 * 
 * This demonstrates how to use the updated APIService methods to interact
 * with the backend voice endpoints for:
 * 1. Voice chat interactions
 * 2. Audio transcription
 * 3. Speech synthesis
 * 4. Voice service health checks
 */

class VoiceEndpointExamples {
    private let apiService = APIService.shared
    
    // MARK: - Voice Chat Example
    
    /// Example: Send a voice message and receive both text and audio response
    func exampleVoiceChat() async {
        do {
            // Configure voice settings
            let voiceSettings = VoiceSettings(
                voice: "en-US-Aria",
                speed: 1.0,
                pitch: 1.0,
                emotion: "friendly"
            )
            
            // Send voice message to backend
            let response = try await apiService.sendVoiceMessage(
                "Hello, can you help me understand how the voice features work?",
                voiceSettings: voiceSettings
            )
            
            print("Voice Response received:")
            print("- Text: \(response.data.message)")
            print("- Voice: \(response.data.voiceUsed)")
            print("- Duration: \(response.data.duration)s")
            
            // If audio data is included, you could play it
            if let audioData = response.audioData {
                print("- Audio data available: \(audioData.count) characters (base64)")
                // Here you would typically convert base64 to audio data and play it
            }
            
            // If audio URL is provided, you could download and play
            if let audioURL = response.data.audioUrl {
                print("- Audio URL: \(audioURL)")
                // Here you would download the audio file and play it
            }
            
        } catch {
            print("Voice chat error: \(error)")
        }
    }
    
    // MARK: - Audio Transcription Example
    
    /// Example: Transcribe audio data to text
    func exampleAudioTranscription(audioData: Data) async {
        do {
            // Transcribe audio with optional language and model specification
            let response = try await apiService.transcribeAudio(
                audioData: audioData,
                language: "en-US",
                model: "whisper-large-v3"
            )
            
            print("Transcription completed:")
            print("- Text: \(response.data.text)")
            print("- Language: \(response.data.language)")
            print("- Confidence: \(response.data.confidence)")
            print("- Processing time: \(response.metadata.processingTime)s")
            
            // If word-level timing is available
            if let words = response.data.words {
                print("- Word timing available: \(words.count) words")
                for word in words.prefix(5) {
                    print("  \(word.word): \(word.start)s - \(word.end)s (confidence: \(word.confidence))")
                }
            }
            
        } catch {
            print("Transcription error: \(error)")
        }
    }
    
    // MARK: - Speech Synthesis Example
    
    /// Example: Convert text to speech
    func exampleSpeechSynthesis() async {
        do {
            // Configure synthesis settings
            let settings = SynthesisSettings(
                speed: 1.0,
                pitch: 1.0,
                volume: 0.8,
                emotion: "neutral",
                format: "wav",
                sampleRate: 24000
            )
            
            // Synthesize speech
            let response = try await apiService.synthesizeSpeech(
                text: "This is an example of text-to-speech synthesis using the Universal AI Tools backend.",
                voice: "en-US-Aria",
                settings: settings
            )
            
            print("Speech synthesis completed:")
            print("- Voice: \(response.data.voiceUsed)")
            print("- Duration: \(response.data.duration)s")
            print("- Format: \(response.data.format)")
            print("- Sample rate: \(response.data.sampleRate)")
            print("- Processing time: \(response.metadata.processingTime)s")
            
            // Play the synthesized audio
            try await apiService.playSynthesizedAudio(from: response)
            print("- Audio playback initiated")
            
        } catch {
            print("Speech synthesis error: \(error)")
        }
    }
    
    // MARK: - Voice Services Health Check Example
    
    /// Example: Check voice services health and capabilities
    func exampleVoiceHealthCheck() async {
        do {
            let health = try await apiService.checkVoiceServicesHealth()
            
            print("Voice Services Health:")
            print("- Overall status: \(health.success ? "Healthy" : "Unhealthy")")
            
            print("- Transcription: \(health.services.transcription.status)")
            if let latency = health.services.transcription.latency {
                print("  Latency: \(latency)ms")
            }
            
            print("- Synthesis: \(health.services.synthesis.status)")
            if let latency = health.services.synthesis.latency {
                print("  Latency: \(latency)ms")
            }
            
            print("- Voice Chat: \(health.services.voiceChat.status)")
            if let latency = health.services.voiceChat.latency {
                print("  Latency: \(latency)ms")
            }
            
            print("Capabilities:")
            print("- Supported languages: \(health.capabilities.supportedLanguages.joined(separator: ", "))")
            print("- Supported voices: \(health.capabilities.supportedVoices.count) voices")
            print("- Supported formats: \(health.capabilities.supportedFormats.joined(separator: ", "))")
            print("- Max audio length: \(health.capabilities.maxAudioLength)s")
            print("- Max text length: \(health.capabilities.maxTextLength) characters")
            
        } catch {
            print("Voice health check error: \(error)")
        }
    }
    
    // MARK: - Complete Voice Interaction Example
    
    /// Example: Complete voice interaction workflow
    func exampleCompleteVoiceWorkflow() async {
        print("=== Complete Voice Workflow Example ===")
        
        // 1. Check if voice services are available
        await exampleVoiceHealthCheck()
        
        // 2. Simulate audio transcription (you would get real audio data from microphone)
        let mockAudioData = Data() // In real app, this would be actual audio data
        if !mockAudioData.isEmpty {
            await exampleAudioTranscription(audioData: mockAudioData)
        }
        
        // 3. Send voice message
        await exampleVoiceChat()
        
        // 4. Synthesize speech response
        await exampleSpeechSynthesis()
        
        print("=== Voice Workflow Complete ===")
    }
    
    // MARK: - WebSocket Voice Event Handling Example
    
    /// Example: Set up WebSocket listeners for voice events
    func setupVoiceEventListeners() {
        // Listen for voice transcription updates
        NotificationCenter.default.addObserver(
            forName: .voiceTranscriptionUpdate,
            object: nil,
            queue: .main
        ) { notification in
            if let data = notification.userInfo?["data"] as? [String: Any] {
                print("Voice transcription update: \(data)")
            }
        }
        
        // Listen for synthesis completion
        NotificationCenter.default.addObserver(
            forName: .voiceSynthesisComplete,
            object: nil,
            queue: .main
        ) { notification in
            if let data = notification.userInfo?["data"] as? [String: Any] {
                print("Voice synthesis complete: \(data)")
            }
        }
        
        // Listen for voice interaction start/end
        NotificationCenter.default.addObserver(
            forName: .voiceInteractionStarted,
            object: nil,
            queue: .main
        ) { _ in
            print("Voice interaction started")
        }
        
        NotificationCenter.default.addObserver(
            forName: .voiceInteractionEnded,
            object: nil,
            queue: .main
        ) { _ in
            print("Voice interaction ended")
        }
    }
    
    // MARK: - Error Handling Examples
    
    /// Example: Proper error handling for voice operations
    func exampleErrorHandling() async {
        do {
            // This might fail if the backend is not available
            let response = try await apiService.sendVoiceMessage("Test message")
            print("Success: \(response.data.message)")
            
        } catch APIError.invalidURL {
            print("Configuration error: Invalid backend URL")
            
        } catch APIError.httpError(let statusCode) {
            switch statusCode {
            case 401:
                print("Authentication error: Please check your API key")
            case 429:
                print("Rate limit exceeded: Please wait before trying again")
            case 500...599:
                print("Server error: The backend service is experiencing issues")
            default:
                print("HTTP error: Status code \(statusCode)")
            }
            
        } catch APIError.networkError(let error) {
            print("Network error: \(error.localizedDescription)")
            print("Please check your internet connection")
            
        } catch APIError.decodingError(let error) {
            print("Response parsing error: \(error.localizedDescription)")
            print("The backend may have returned unexpected data")
            
        } catch {
            print("Unexpected error: \(error.localizedDescription)")
        }
    }
}

// MARK: - Integration with Existing Voice Services

extension VoiceEndpointExamples {
    
    /// Example: Integrate with existing STTService
    func integrateWithSTTService(sttService: STTService) async {
        do {
            // Start local speech recognition
            try await sttService.startListening(
                onComplete: { [weak self] transcription in
                    print("Local transcription: \(transcription)")
                    
                    // Send to backend for processing
                    Task {
                        await self?.exampleVoiceChat()
                    }
                },
                onPartial: { partialText in
                    print("Partial: \(partialText)")
                }
            )
            
            // You could also send the audio data to backend for transcription
            // if you prefer server-side processing
            
        } catch {
            print("STT integration error: \(error)")
        }
    }
    
    /// Example: Integrate with existing TTSService
    func integrateWithTTSService(ttsService: TTSService, text: String) async {
        // Option 1: Use local TTS
        await ttsService.speak(text: text)
        
        // Option 2: Use backend TTS for better quality
        await exampleSpeechSynthesis()
        
        // Option 3: Hybrid approach - use backend for generation, local for playback
        do {
            let response = try await apiService.synthesizeSpeech(text: text)
            
            if let audioData = response.data.audioData,
               let data = Data(base64Encoded: audioData) {
                // Play using local audio systems
                print("Playing backend-generated audio locally")
                // Implement audio playback here
            }
        } catch {
            // Fallback to local TTS
            await ttsService.speak(text: text)
        }
    }
}
