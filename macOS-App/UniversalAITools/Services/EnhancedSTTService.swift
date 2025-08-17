import Speech
import AVFoundation
import Foundation
import OSLog
import SwiftUI
import Combine

// MARK: - Enhanced STT Service with Unified Error Handling

@MainActor
class EnhancedSTTService: NSObject, ObservableObject, ErrorHandlingServiceProtocol {
    // MARK: - ErrorHandlingServiceProtocol Conformance
    public let errorSystem = UnifiedErrorHandlingSystem.shared
    @Published public var currentError: AppError?
    
    // MARK: - Published Properties
    @Published var isAuthorized: Bool = false
    @Published var isEnabled: Bool = true
    @Published var recognitionState: STTRecognitionState = .idle
    @Published var isListening: Bool = false
    @Published var partialTranscription: String = ""
    @Published var finalTranscription: String = ""
    @Published var confidence: Double = 0.0
    
    // MARK: - Private Properties
    private let speechRecognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
    private let audioEngine = AVAudioEngine()
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private let logger = Logger(subsystem: "com.universalai.tools", category: "EnhancedSTTService")
    
    // Service-specific error handler
    private let serviceErrorHandler: ServiceErrorHandler
    
    // Callbacks
    private var onCompleteCallback: ((String) -> Void)?
    private var onPartialCallback: ((String) -> Void)?
    
    // Recovery state
    @Published var isRecovering: Bool = false
    private var cancellables = Set<AnyCancellable>()
    
    override init() {
        self.serviceErrorHandler = ServiceErrorHandler(serviceName: "STTService")
        super.init()
        setupSTT()
        setupErrorHandling()
    }
    
    // MARK: - Setup
    
    private func setupSTT() {
        speechRecognizer?.delegate = self
        configureAudioSession()
        
        // Check initial authorization
        let authStatus = SFSpeechRecognizer.authorizationStatus()
        updateAuthorizationStatus(authStatus)
    }
    
    private func setupErrorHandling() {
        // Observe service error handler changes
        serviceErrorHandler.$currentError
            .receive(on: DispatchQueue.main)
            .sink { [weak self] error in
                self?.currentError = error
                
                if let error = error {
                    self?.handleErrorStateChange(error)
                }
            }
            .store(in: &cancellables)
    }
    
    private func configureAudioSession() {
        // macOS doesn't use AVAudioSession - audio permissions handled differently
        logger.info("Audio session configured for Enhanced STT (macOS)")
    }
    
    // MARK: - Authorization
    
    func requestAuthorization() async {
        await serviceErrorHandler.operation(userAction: "Request microphone permission") {
            await withCheckedContinuation { continuation in
                SFSpeechRecognizer.requestAuthorization { authStatus in
                    Task { @MainActor in
                        self.updateAuthorizationStatus(authStatus)
                        continuation.resume()
                    }
                }
            }
        }.execute()
    }
    
    private func updateAuthorizationStatus(_ status: SFSpeechRecognizerAuthorizationStatus) {
        switch status {
        case .authorized:
            isAuthorized = true
            clearError() // Clear any authorization errors
            logger.info("Speech recognition authorized")
        case .denied:
            isAuthorized = false
            reportAuthorizationError(.denied)
        case .restricted:
            isAuthorized = false
            reportAuthorizationError(.restricted)
        case .notDetermined:
            isAuthorized = false
            reportAuthorizationError(.notDetermined)
        @unknown default:
            isAuthorized = false
            reportAuthorizationError(.unknown)
        }
    }
    
    private func reportAuthorizationError(_ status: SFSpeechRecognizerAuthorizationStatus) {
        let errorType: AppErrorType
        let userMessage: String
        
        switch status {
        case .denied:
            errorType = .permissions
            userMessage = "Microphone access denied. Please enable microphone access in System Preferences > Security & Privacy > Privacy > Microphone."
        case .restricted:
            errorType = .permissions
            userMessage = "Speech recognition is restricted on this device. Please check parental controls or device restrictions."
        case .notDetermined:
            errorType = .permissions
            userMessage = "Microphone permission not determined. Please grant access to use voice features."
        default:
            errorType = .permissions
            userMessage = "Unable to access speech recognition services. Please check system permissions."
        }
        
        let context = ErrorContext(
            feature: "STTService",
            userAction: "Request Authorization",
            additionalData: ["authStatus": status.rawValue]
        )
        
        let appError = AppError(
            id: UUID().uuidString,
            type: errorType,
            category: errorType.category,
            title: "Microphone Access Required",
            userMessage: userMessage,
            technicalDetails: "Speech recognizer authorization status: \(status)",
            severity: .high,
            context: context,
            recoverySuggestions: createAuthorizationRecoverySuggestions(),
            timestamp: Date(),
            metadata: ["authStatus": "\(status.rawValue)"]
        )
        
        errorSystem.handleAppError(appError)
        currentError = appError
    }
    
    private func createAuthorizationRecoverySuggestions() -> [RecoverySuggestion] {
        return [
            RecoverySuggestion(
                id: "open_system_prefs",
                title: "Open System Preferences",
                description: "Go to Privacy settings to enable microphone access",
                action: .checkPermissions,
                priority: .high
            ),
            RecoverySuggestion(
                id: "retry_auth",
                title: "Try Again",
                description: "Retry requesting microphone permission",
                action: .retry,
                priority: .medium
            )
        ]
    }
    
    // MARK: - Speech Recognition
    
    func startListening(
        onComplete: ((String) -> Void)? = nil,
        onPartial: ((String) -> Void)? = nil
    ) async throws {
        let result = await serviceErrorHandler.operation(userAction: "Start voice recording") {
            try await self.performStartListening(onComplete: onComplete, onPartial: onPartial)
        }.executeWithRetry(maxRetries: 2)
        
        if result == nil {
            throw STTError.recognitionFailed
        }
    }
    
    private func performStartListening(
        onComplete: ((String) -> Void)? = nil,
        onPartial: ((String) -> Void)? = nil
    ) async throws {
        // Validate preconditions
        try validateListeningPreconditions()
        
        // Store callbacks
        self.onCompleteCallback = onComplete
        self.onPartialCallback = onPartial
        
        // Prepare recognition request
        let (audioFormat, inputNode) = try prepareAudioEngine()
        
        recognitionRequest = SFSpeechAudioBufferRecognitionRequest()
        guard let recognitionRequest = recognitionRequest else {
            throw STTError.recognitionRequestFailed
        }
        
        recognitionRequest.shouldReportPartialResults = true
        
        // Update state
        recognitionState = .listening
        isListening = true
        partialTranscription = ""
        finalTranscription = ""
        
        // Start recognition task
        recognitionTask = speechRecognizer?.recognitionTask(with: recognitionRequest) { [weak self] result, error in
            Task { @MainActor in
                self?.handleRecognitionResult(result: result, error: error)
            }
        }
        
        // Start audio engine
        try audioEngine.start()
        
        // Install audio tap
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: audioFormat) { [weak self] buffer, _ in
            self?.recognitionRequest?.append(buffer)
        }
        
        logger.info("STT listening started successfully")
    }
    
    private func validateListeningPreconditions() throws {
        guard isAuthorized else {
            throw STTError.notAuthorized
        }
        
        guard isEnabled else {
            throw STTError.serviceDisabled
        }
        
        guard speechRecognizer?.isAvailable == true else {
            throw STTError.recognizerUnavailable
        }
        
        guard !isListening else {
            throw STTError.alreadyListening
        }
    }
    
    private func prepareAudioEngine() throws -> (AVAudioFormat, AVAudioInputNode) {
        let inputNode = audioEngine.inputNode
        let audioFormat = inputNode.outputFormat(forBus: 0)
        
        guard audioFormat.sampleRate > 0 else {
            throw STTError.audioFormatInvalid
        }
        
        return (audioFormat, inputNode)
    }
    
    private func handleRecognitionResult(result: SFSpeechRecognitionResult?, error: Error?) {
        if let error = error {
            handleRecognitionError(error)
            return
        }
        
        guard let result = result else { return }
        
        let transcription = result.bestTranscription.formattedString
        confidence = Double(result.bestTranscription.segments.map { $0.confidence }.reduce(0, +)) / Double(result.bestTranscription.segments.count)
        
        if result.isFinal {
            finalTranscription = transcription
            recognitionState = .completed
            onCompleteCallback?(transcription)
            stopListening()
        } else {
            partialTranscription = transcription
            recognitionState = .processing
            onPartialCallback?(transcription)
        }
    }
    
    private func handleRecognitionError(_ error: Error) {
        logger.error("Recognition error: \(error.localizedDescription)")
        
        // Determine error type
        let errorType: AppErrorType
        let userMessage: String
        
        if let speechError = error as? NSError {
            switch speechError.code {
            case 203: // kLSRErrorCodeNetwork
                errorType = .networkConnection
                userMessage = "Network connection required for speech recognition. Please check your internet connection."
            case 209: // kLSRErrorCodeRequestTimedOut
                errorType = .requestTimeout
                userMessage = "Speech recognition timed out. Please try speaking again."
            case 216: // kLSRErrorCodeNoSpeechDetected
                errorType = .speechRecognition
                userMessage = "No speech detected. Please try speaking closer to the microphone."
            default:
                errorType = .speechRecognition
                userMessage = "Speech recognition failed. Please try again."
            }
        } else {
            errorType = .speechRecognition
            userMessage = "Speech recognition encountered an error. Please try again."
        }
        
        serviceErrorHandler.reportVoiceError(
            error,
            operation: "Speech Recognition",
            userAction: "Voice Input"
        )
        
        recognitionState = .error
        stopListening()
    }
    
    func stopListening() {
        recognitionTask?.cancel()
        recognitionRequest?.endAudio()
        audioEngine.stop()
        audioEngine.inputNode.removeTap(onBus: 0)
        
        isListening = false
        
        if recognitionState == .listening || recognitionState == .processing {
            recognitionState = .idle
        }
        
        recognitionTask = nil
        recognitionRequest = nil
        onCompleteCallback = nil
        onPartialCallback = nil
        
        logger.info("STT listening stopped")
    }
    
    // MARK: - Error Recovery
    
    private func handleErrorStateChange(_ error: AppError) {
        switch error.type {
        case .permissions:
            recognitionState = .error
        case .speechRecognition:
            recognitionState = .error
            // Auto-retry for certain speech recognition errors
            if error.metadata["autoRetry"] != "disabled" {
                Task {
                    await autoRetryRecognition()
                }
            }
        default:
            break
        }
    }
    
    private func autoRetryRecognition() async {
        guard !isRecovering else { return }
        
        isRecovering = true
        
        // Wait a moment before retrying
        try? await Task.sleep(nanoseconds: 1_000_000_000) // 1 second
        
        // Clear the error and try again
        clearError()
        recognitionState = .idle
        
        isRecovering = false
        
        logger.info("Auto-retry completed for speech recognition")
    }
    
    // MARK: - Public API
    
    /// Checks if the service can start listening
    func canStartListening() -> Bool {
        return isAuthorized && isEnabled && !isListening && speechRecognizer?.isAvailable == true
    }
    
    /// Gets the current status message for UI display
    func getStatusMessage() -> String {
        if let error = currentError {
            return error.userMessage
        }
        
        return recognitionState.description
    }
    
    /// Manually retries the last failed operation
    func retryLastOperation() async {
        guard let error = currentError else { return }
        
        let success = await attemptRecovery()
        
        if success {
            logger.info("Manual retry successful")
        } else {
            logger.warning("Manual retry failed")
        }
    }
}

// MARK: - SFSpeechRecognizerDelegate

extension EnhancedSTTService: SFSpeechRecognizerDelegate {
    func speechRecognizer(_ speechRecognizer: SFSpeechRecognizer, availabilityDidChange available: Bool) {
        logger.info("Speech recognizer availability changed: \(available)")
        
        if !available && isListening {
            let error = STTError.recognizerUnavailable
            serviceErrorHandler.reportVoiceError(
                error,
                operation: "Availability Check",
                userAction: "Background Check"
            )
            stopListening()
        }
    }
}

// MARK: - STT Error Types

enum STTError: Error, LocalizedError {
    case notAuthorized
    case serviceDisabled
    case recognizerUnavailable
    case alreadyListening
    case audioFormatInvalid
    case recognitionRequestFailed
    case recognitionFailed
    
    var errorDescription: String? {
        switch self {
        case .notAuthorized:
            return "Speech recognition not authorized"
        case .serviceDisabled:
            return "STT service is disabled"
        case .recognizerUnavailable:
            return "Speech recognizer is not available"
        case .alreadyListening:
            return "Already listening for speech"
        case .audioFormatInvalid:
            return "Invalid audio format"
        case .recognitionRequestFailed:
            return "Failed to create recognition request"
        case .recognitionFailed:
            return "Speech recognition failed"
        }
    }
}

// MARK: - Integration Helpers

extension EnhancedSTTService {
    /// Creates a voice operation wrapper for UI components
    func createVoiceOperation<T>(
        userAction: String,
        operation: @escaping () async throws -> T
    ) -> ServiceOperation<T> {
        return serviceErrorHandler.operation(
            userAction: userAction,
            context: ["feature": "voice_recognition"],
            operation
        )
    }
    
    /// Provides recovery suggestions specific to STT
    func getContextualRecoverySuggestions() -> [RecoverySuggestion] {
        guard let error = currentError else { return [] }
        
        var suggestions = error.recoverySuggestions
        
        // Add STT-specific suggestions based on error type
        switch error.type {
        case .permissions:
            suggestions.append(
                RecoverySuggestion(
                    id: "check_microphone",
                    title: "Check Microphone",
                    description: "Ensure your microphone is connected and working",
                    action: .checkPermissions,
                    priority: .medium
                )
            )
        case .speechRecognition:
            suggestions.append(
                RecoverySuggestion(
                    id: "speak_clearly",
                    title: "Speak Clearly",
                    description: "Try speaking more clearly and closer to the microphone",
                    action: .retry,
                    priority: .high
                )
            )
        default:
            break
        }
        
        return suggestions
    }
}