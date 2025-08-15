import Speech
import AVFoundation
import Foundation
import OSLog
import SwiftUI

// MARK: - STT Recognition State
enum STTRecognitionState: String, CaseIterable {
    case idle = "idle"
    case listening = "listening"
    case processing = "processing"
    case completed = "completed"
    case error = "error"
    
    var description: String {
        switch self {
        case .idle: return "Ready"
        case .listening: return "Listening..."
        case .processing: return "Processing..."
        case .completed: return "Completed"
        case .error: return "Error"
        }
    }
}

// MARK: - STT Service
@MainActor
class STTService: NSObject, ObservableObject {
    @Published var isAuthorized: Bool = false
    @Published var isEnabled: Bool = true
    @Published var recognitionState: STTRecognitionState = .idle
    @Published var isListening: Bool = false
    @Published var partialTranscription: String = ""
    @Published var finalTranscription: String = ""
    @Published var confidence: Double = 0.0
    @Published var errorMessage: String?
    
    private let speechRecognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
    private let audioEngine = AVAudioEngine()
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private let logger = Logger(subsystem: "com.universalai.tools", category: "stt")
    
    // Callbacks
    private var onCompleteCallback: ((String) -> Void)?
    private var onPartialCallback: ((String) -> Void)?
    
    override init() {
        super.init()
        setupSTT()
    }
    
    private func setupSTT() {
        speechRecognizer?.delegate = self
        configureAudioSession()
        
        // Check initial authorization
        let authStatus = SFSpeechRecognizer.authorizationStatus()
        updateAuthorizationStatus(authStatus)
    }
    
    private func configureAudioSession() {
        // macOS doesn't use AVAudioSession - audio permissions handled differently
        logger.info("Audio session configured for STT (macOS)")
    }
    
    func requestAuthorization() async {
        await withCheckedContinuation { continuation in
            SFSpeechRecognizer.requestAuthorization { authStatus in
                Task { @MainActor in
                    self.updateAuthorizationStatus(authStatus)
                    continuation.resume()
                }
            }
        }
    }
    
    private func updateAuthorizationStatus(_ status: SFSpeechRecognizerAuthorizationStatus) {
        switch status {
        case .authorized:
            isAuthorized = true
            logger.info("Speech recognition authorized")
        case .denied, .restricted, .notDetermined:
            isAuthorized = false
            logger.warning("Speech recognition not authorized: \(status.rawValue)")
        @unknown default:
            isAuthorized = false
            logger.error("Unknown authorization status: \(status.rawValue)")
        }
    }
    
    func startListening(onComplete: ((String) -> Void)? = nil, onPartial: ((String) -> Void)? = nil) async throws {
        guard isAuthorized else {
            throw STTError.notAuthorized
        }
        
        guard isEnabled else {
            throw STTError.serviceDisabled
        }
        
        // Store callbacks
        self.onCompleteCallback = onComplete
        self.onPartialCallback = onPartial
        
        // Cancel any existing recognition
        stopListening()
        
        // Create recognition request
        recognitionRequest = SFSpeechAudioBufferRecognitionRequest()
        guard let recognitionRequest = recognitionRequest else {
            throw STTError.recognitionRequestFailed
        }
        
        recognitionRequest.shouldReportPartialResults = true
        
        // Configure audio engine
        let inputNode = audioEngine.inputNode
        let recordingFormat = inputNode.outputFormat(forBus: 0)
        
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) { buffer, _ in
            recognitionRequest.append(buffer)
        }
        
        audioEngine.prepare()
        try audioEngine.start()
        
        // Start recognition task
        recognitionTask = speechRecognizer?.recognitionTask(with: recognitionRequest) { [weak self] result, error in
            Task { @MainActor in
                self?.handleRecognitionResult(result, error: error)
            }
        }
        
        recognitionState = .listening
        isListening = true
        partialTranscription = ""
        finalTranscription = ""
        confidence = 0.0
        
        logger.info("Started listening for speech")
    }
    
    func stopListening() {
        audioEngine.stop()
        audioEngine.inputNode.removeTap(onBus: 0)
        
        recognitionRequest?.endAudio()
        recognitionRequest = nil
        
        recognitionTask?.cancel()
        recognitionTask = nil
        
        isListening = false
        
        if recognitionState == .listening {
            recognitionState = .processing
        }
        
        logger.info("Stopped listening for speech")
    }
    
    func cancelListening() {
        audioEngine.stop()
        audioEngine.inputNode.removeTap(onBus: 0)
        
        recognitionRequest?.endAudio()
        recognitionRequest = nil
        
        recognitionTask?.cancel()
        recognitionTask = nil
        
        isListening = false
        recognitionState = .idle
        
        // Clear callbacks
        onCompleteCallback = nil
        onPartialCallback = nil
        
        logger.info("Cancelled listening for speech")
    }
    
    private func handleRecognitionResult(_ result: SFSpeechRecognitionResult?, error: Error?) {
        if let error = error {
            logger.error("Speech recognition error: \(error)")
            errorMessage = error.localizedDescription
            recognitionState = .error
            isListening = false
            return
        }
        
        guard let result = result else { return }
        
        let transcription = result.bestTranscription.formattedString
        confidence = Double(result.bestTranscription.averageConfidence)
        
        if result.isFinal {
            finalTranscription = transcription
            partialTranscription = ""
            recognitionState = .completed
            isListening = false
            onCompleteCallback?(transcription)
            logger.info("Final transcription: \(transcription)")
        } else {
            partialTranscription = transcription
            onPartialCallback?(transcription)
            logger.debug("Partial transcription: \(transcription)")
        }
    }
    
    func clearTranscription() {
        partialTranscription = ""
        finalTranscription = ""
        confidence = 0.0
        recognitionState = .idle
        errorMessage = nil
    }
    
    func toggleListening() async {
        if isListening {
            stopListening()
        } else {
            do {
                try await startListening()
            } catch {
                logger.error("Failed to start listening: \(error)")
                errorMessage = error.localizedDescription
                recognitionState = .error
            }
        }
    }
}

// MARK: - SFSpeechRecognizerDelegate
extension STTService: SFSpeechRecognizerDelegate {
    nonisolated func speechRecognizer(_ speechRecognizer: SFSpeechRecognizer, availabilityDidChange available: Bool) {
        Task { @MainActor in
            self.isEnabled = available
            if !available {
                self.stopListening()
                self.logger.warning("Speech recognizer became unavailable")
            }
        }
    }
}

// MARK: - STT Errors
enum STTError: LocalizedError {
    case notAuthorized
    case serviceDisabled
    case recognitionRequestFailed
    case audioEngineFailed
    case recognitionFailed(String)
    
    var errorDescription: String? {
        switch self {
        case .notAuthorized:
            return "Speech recognition not authorized"
        case .serviceDisabled:
            return "Speech recognition service is disabled"
        case .recognitionRequestFailed:
            return "Failed to create recognition request"
        case .audioEngineFailed:
            return "Audio engine failed to start"
        case .recognitionFailed(let message):
            return "Recognition failed: \(message)"
        }
    }
}