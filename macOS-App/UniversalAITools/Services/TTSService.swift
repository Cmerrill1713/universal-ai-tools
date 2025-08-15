import Foundation
import AVFoundation
import Combine
import OSLog

// MARK: - Voice Models
struct TTSVoice: Identifiable, Codable, Hashable {
    let id: String
    let name: String
    let gender: Gender
    let language: String
    let description: String
    let quality: VoiceQuality
    
    enum Gender: String, Codable, CaseIterable {
        case male = "male"
        case female = "female"
        case unspecified = "unspecified"
        
        var displayName: String {
            switch self {
            case .male: return "Male"
            case .female: return "Female"
            case .unspecified: return "Unspecified"
            }
        }
    }
    
    enum VoiceQuality: String, Codable, CaseIterable {
        case standard = "standard"
        case enhanced = "enhanced"
        case premium = "premium"
        
        var displayName: String {
            switch self {
            case .standard: return "Standard"
            case .enhanced: return "Enhanced"
            case .premium: return "Premium"
            }
        }
    }
}

// MARK: - TTS Playback State
enum TTSPlaybackState: Equatable {
    case idle
    case loading
    case playing
    case paused
    case error(String)
    
    static func == (lhs: TTSPlaybackState, rhs: TTSPlaybackState) -> Bool {
        switch (lhs, rhs) {
        case (.idle, .idle), (.loading, .loading), (.playing, .playing), (.paused, .paused):
            return true
        case (.error(let lhsMessage), .error(let rhsMessage)):
            return lhsMessage == rhsMessage
        default:
            return false
        }
    }
}

// MARK: - Speech Event Callbacks
protocol TTSSpeechDelegate: AnyObject {
    func speechDidStart()
    func speechDidProgress(characterRange: NSRange)
    func speechDidFinish()
    func speechDidCancel()
    func speechDidEncounterError(_ error: Error)
}

// MARK: - TTS Service
@MainActor
class TTSService: NSObject, ObservableObject {
    // MARK: - Published Properties
    @Published var availableVoices: [TTSVoice] = []
    @Published var selectedVoice: TTSVoice?
    @Published var playbackState: TTSPlaybackState = .idle
    @Published var playbackProgress: Double = 0.0
    @Published var volume: Float = 1.0
    @Published var playbackSpeed: Float = 1.0
    @Published var pitch: Float = 1.0
    @Published var isEnabled: Bool = true
    @Published var currentUtterance: String?
    @Published var utteranceQueue: [String] = []
    
    // MARK: - Private Properties
    private let speechSynthesizer = AVSpeechSynthesizer()
    private let logger = Logger(subsystem: "UniversalAITools", category: "TTSService")
    private var cancellables = Set<AnyCancellable>()
    private var currentAVUtterance: AVSpeechUtterance?
    private var speechDelegate: TTSSpeechDelegate?
    private var progressTimer: Timer?
    
    // MARK: - Voice Personalities
    private var voicePersonalities: [String: VoicePersonality] = [:]
    
    struct VoicePersonality {
        let rate: Float
        let pitchMultiplier: Float
        let volumeOffset: Float
        let description: String
    }
    
    // MARK: - Initialization
    override init() {
        super.init()
        
        setupSpeechSynthesizer()
        loadSystemVoices()
        setupVoicePersonalities()
        loadUserPreferences()
        
        logger.info("🔊 TTSService initialized with \(self.availableVoices.count) system voices")
    }
    
    // MARK: - Public Methods
    func speak(text: String, immediate: Bool = false) async {
        guard isEnabled, !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            logger.debug("TTS skipped: disabled or empty text")
            return
        }
        
        if immediate {
            stopPlayback()
        }
        
        let cleanedText = preprocessText(text)
        
        if immediate {
            await speakImmediate(cleanedText)
        } else {
            queueUtterance(cleanedText)
        }
    }
    
    func speakWithPersonality(_ text: String, personality: String) async {
        guard let voicePersonality = voicePersonalities[personality] else {
            await speak(text: text)
            return
        }
        
        let originalRate = playbackSpeed
        let originalPitch = pitch
        let originalVolume = volume
        
        // Temporarily adjust settings for personality
        playbackSpeed = voicePersonality.rate
        pitch = voicePersonality.pitchMultiplier
        volume = min(1.0, max(0.0, originalVolume + voicePersonality.volumeOffset))
        
        await speak(text: text, immediate: true)
        
        // Restore original settings
        playbackSpeed = originalRate
        pitch = originalPitch
        volume = originalVolume
    }
    
    func pausePlayback() {
        guard playbackState == .playing else { return }
        
        if speechSynthesizer.isSpeaking {
            speechSynthesizer.pauseSpeaking(at: .immediate)
            playbackState = .paused
            stopProgressTimer()
            logger.debug("TTS playback paused")
        }
    }
    
    func resumePlayback() {
        guard playbackState == .paused else { return }
        
        if speechSynthesizer.isPaused {
            speechSynthesizer.continueSpeaking()
            playbackState = .playing
            startProgressTimer()
            logger.debug("TTS playback resumed")
        }
    }
    
    func stopPlayback() {
        speechSynthesizer.stopSpeaking(at: .immediate)
        playbackState = .idle
        playbackProgress = 0.0
        currentUtterance = nil
        currentAVUtterance = nil
        utteranceQueue.removeAll()
        stopProgressTimer()
        logger.debug("TTS playback stopped")
    }
    
    func setVoice(_ voice: TTSVoice) {
        selectedVoice = voice
        saveUserPreferences()
        logger.info("TTS voice changed to: \(voice.name)")
    }
    
    func setVolume(_ newVolume: Float) {
        volume = max(0.0, min(1.0, newVolume))
        
        // Apply to current utterance if speaking
        if let utterance = currentAVUtterance {
            utterance.volume = volume
        }
        
        saveUserPreferences()
    }
    
    func setPlaybackSpeed(_ speed: Float) {
        playbackSpeed = max(0.25, min(2.0, speed))
        
        // Apply to current utterance if speaking
        if let utterance = currentAVUtterance {
            utterance.rate = AVSpeechUtteranceDefaultSpeechRate * playbackSpeed
        }
        
        saveUserPreferences()
    }
    
    func setPitch(_ newPitch: Float) {
        pitch = max(0.5, min(2.0, newPitch))
        
        // Apply to current utterance if speaking
        if let utterance = currentAVUtterance {
            utterance.pitchMultiplier = pitch
        }
        
        saveUserPreferences()
    }
    
    func toggleEnabled() {
        isEnabled.toggle()
        if !isEnabled {
            stopPlayback()
        }
        saveUserPreferences()
        logger.info("TTS \(self.isEnabled ? "enabled" : "disabled")")
    }
    
    func setSpeechDelegate(_ delegate: TTSSpeechDelegate?) {
        speechDelegate = delegate
    }
    
    func getAvailableLanguages() -> [String] {
        return Array(Set(availableVoices.map { $0.language })).sorted()
    }
    
    func getVoicesForLanguage(_ language: String) -> [TTSVoice] {
        return availableVoices.filter { $0.language == language }
    }
    
    func supportsSSML() -> Bool {
        // AVSpeechSynthesizer has limited SSML support on macOS
        return true
    }
    
    // MARK: - Private Methods
    private func setupSpeechSynthesizer() {
        speechSynthesizer.delegate = self
        logger.debug("Speech synthesizer setup completed")
    }
    
    private func loadSystemVoices() {
        var voices: [TTSVoice] = []
        
        for avVoice in AVSpeechSynthesisVoice.speechVoices() {
            let language = avVoice.language
            let voiceName = avVoice.name
            
            // Determine gender based on voice name patterns (heuristic)
            let gender: TTSVoice.Gender = determineGender(for: voiceName)
            
            // Determine quality based on voice identifier
            let quality: TTSVoice.VoiceQuality = determineQuality(for: avVoice.identifier)
            
            let ttsVoice = TTSVoice(
                id: avVoice.identifier,
                name: voiceName,
                gender: gender,
                language: language,
                description: createVoiceDescription(name: voiceName, language: language),
                quality: quality
            )
            
            voices.append(ttsVoice)
        }
        
        // Sort voices by language and then by name
        self.availableVoices = voices.sorted { lhs, rhs in
            if lhs.language == rhs.language {
                return lhs.name < rhs.name
            }
            return lhs.language < rhs.language
        }
        
        // Set default voice (first English voice or first available)
        if let defaultVoice = availableVoices.first(where: { $0.language.hasPrefix("en") }) {
            selectedVoice = defaultVoice
        } else {
            selectedVoice = availableVoices.first
        }
    }
    
    private func setupVoicePersonalities() {
        voicePersonalities = [
            "professional": VoicePersonality(
                rate: 0.95,
                pitchMultiplier: 1.0,
                volumeOffset: 0.0,
                description: "Professional and authoritative tone"
            ),
            "friendly": VoicePersonality(
                rate: 1.05,
                pitchMultiplier: 1.1,
                volumeOffset: 0.05,
                description: "Warm and approachable tone"
            ),
            "creative": VoicePersonality(
                rate: 1.1,
                pitchMultiplier: 1.15,
                volumeOffset: 0.1,
                description: "Energetic and expressive tone"
            ),
            "analytical": VoicePersonality(
                rate: 0.9,
                pitchMultiplier: 0.95,
                volumeOffset: -0.05,
                description: "Calm and methodical tone"
            ),
            "concise": VoicePersonality(
                rate: 1.2,
                pitchMultiplier: 0.98,
                volumeOffset: 0.0,
                description: "Direct and efficient delivery"
            )
        ]
    }
    
    private func determineGender(for voiceName: String) -> TTSVoice.Gender {
        let lowercasedName = voiceName.lowercased()
        
        // Common female voice names
        let femaleIndicators = ["female", "woman", "her", "she", "girl", "lady", 
                               "alex", "allison", "ava", "fiona", "karen", "moira", "samantha", "susan", "tessa", "vicki", "victoria"]
        
        // Common male voice names  
        let maleIndicators = ["male", "man", "him", "he", "boy", "guy", "aaron", "albert", "bruce", "daniel", "fred", "junior", "ralph", "tom"]
        
        for indicator in femaleIndicators {
            if lowercasedName.contains(indicator) {
                return .female
            }
        }
        
        for indicator in maleIndicators {
            if lowercasedName.contains(indicator) {
                return .male
            }
        }
        
        return .unspecified
    }
    
    private func determineQuality(for identifier: String) -> TTSVoice.VoiceQuality {
        let lowercasedId = identifier.lowercased()
        
        if lowercasedId.contains("premium") || lowercasedId.contains("neural") {
            return .premium
        } else if lowercasedId.contains("enhanced") || lowercasedId.contains("compact") {
            return .enhanced
        }
        
        return .standard
    }
    
    private func createVoiceDescription(name: String, language: String) -> String {
        let locale = Locale(identifier: language)
        let localizedLanguage = locale.localizedString(forLanguageCode: language) ?? language
        return "\(name) - \(localizedLanguage)"
    }
    
    private func preprocessText(_ text: String) -> String {
        var processedText = text
        
        // Handle common abbreviations and improve pronunciation
        let replacements: [String: String] = [
            "API": "A P I",
            "URL": "U R L",
            "HTML": "H T M L",
            "CSS": "C S S",
            "JSON": "J S O N",
            "XML": "X M L",
            "HTTP": "H T T P",
            "HTTPS": "H T T P S",
            "UI": "U I",
            "UX": "U X"
        ]
        
        for (abbreviation, replacement) in replacements {
            processedText = processedText.replacingOccurrences(of: abbreviation, with: replacement)
        }
        
        // Clean up extra whitespace
        processedText = processedText.trimmingCharacters(in: .whitespacesAndNewlines)
        processedText = processedText.replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
        
        return processedText
    }
    
    private func queueUtterance(_ text: String) {
        utteranceQueue.append(text)
        
        if playbackState == .idle {
            processUtteranceQueue()
        }
    }
    
    private func processUtteranceQueue() {
        guard !utteranceQueue.isEmpty, playbackState == .idle else { return }
        
        let nextText = utteranceQueue.removeFirst()
        Task {
            await speakImmediate(nextText)
        }
    }
    
    private func speakImmediate(_ text: String) async {
        guard let voice = selectedVoice else {
            logger.warning("No voice selected for TTS")
            playbackState = .error("No voice selected")
            return
        }
        
        guard let avVoice = AVSpeechSynthesisVoice(identifier: voice.id) else {
            logger.error("Failed to create AVSpeechSynthesisVoice for identifier: \(voice.id)")
            playbackState = .error("Voice not available")
            return
        }
        
        let utterance = AVSpeechUtterance(string: text)
        utterance.voice = avVoice
        utterance.rate = AVSpeechUtteranceDefaultSpeechRate * playbackSpeed
        utterance.pitchMultiplier = pitch
        utterance.volume = volume
        
        currentAVUtterance = utterance
        currentUtterance = text
        playbackState = .loading
        
        // Speak the utterance
        speechSynthesizer.speak(utterance)
    }
    
    private func startProgressTimer() {
        stopProgressTimer()
        
        progressTimer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
            Task { @MainActor in
                guard let self = self else { return }
                
                // Update progress based on speech synthesizer state
                if self.speechSynthesizer.isSpeaking {
                    // This is a rough approximation - AVSpeechSynthesizer doesn't provide exact progress
                    self.playbackProgress = min(0.95, self.playbackProgress + 0.01)
                }
            }
        }
    }
    
    private func stopProgressTimer() {
        progressTimer?.invalidate()
        progressTimer = nil
    }
    
    private func loadUserPreferences() {
        let defaults = UserDefaults.standard
        
        // Load selected voice
        if let voiceId = defaults.string(forKey: "tts_selectedVoice"),
           let voice = availableVoices.first(where: { $0.id == voiceId }) {
            selectedVoice = voice
        }
        
        // Load audio settings
        let savedVolume = defaults.float(forKey: "tts_volume")
        volume = savedVolume > 0 ? savedVolume : 1.0
        
        let savedSpeed = defaults.float(forKey: "tts_speed")
        playbackSpeed = savedSpeed > 0 ? savedSpeed : 1.0
        
        let savedPitch = defaults.float(forKey: "tts_pitch")
        pitch = savedPitch > 0 ? savedPitch : 1.0
        
        // Load enabled state
        if defaults.object(forKey: "tts_enabled") != nil {
            isEnabled = defaults.bool(forKey: "tts_enabled")
        } else {
            isEnabled = true // Default enabled
        }
        
        logger.debug("User preferences loaded - Volume: \(self.volume), Speed: \(self.playbackSpeed), Pitch: \(self.pitch), Enabled: \(self.isEnabled)")
    }
    
    private func saveUserPreferences() {
        let defaults = UserDefaults.standard
        defaults.set(selectedVoice?.id, forKey: "tts_selectedVoice")
        defaults.set(volume, forKey: "tts_volume")
        defaults.set(playbackSpeed, forKey: "tts_speed")
        defaults.set(pitch, forKey: "tts_pitch")
        defaults.set(isEnabled, forKey: "tts_enabled")
        
        logger.debug("User preferences saved")
    }
}

// MARK: - AVSpeechSynthesizerDelegate
extension TTSService: AVSpeechSynthesizerDelegate {
    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didStart utterance: AVSpeechUtterance) {
        Task { @MainActor in
            playbackState = .playing
            playbackProgress = 0.0
            startProgressTimer()
            speechDelegate?.speechDidStart()
            logger.debug("Speech synthesis started")
        }
    }
    
    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        Task { @MainActor in
            playbackState = .idle
            playbackProgress = 1.0
            currentUtterance = nil
            currentAVUtterance = nil
            stopProgressTimer()
            speechDelegate?.speechDidFinish()
            
            // Process next utterance in queue if available
            processUtteranceQueue()
            
            logger.debug("Speech synthesis finished")
        }
    }
    
    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didPause utterance: AVSpeechUtterance) {
        Task { @MainActor in
            playbackState = .paused
            stopProgressTimer()
            logger.debug("Speech synthesis paused")
        }
    }
    
    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didContinue utterance: AVSpeechUtterance) {
        Task { @MainActor in
            playbackState = .playing
            startProgressTimer()
            logger.debug("Speech synthesis resumed")
        }
    }
    
    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        Task { @MainActor in
            playbackState = .idle
            playbackProgress = 0.0
            currentUtterance = nil
            currentAVUtterance = nil
            utteranceQueue.removeAll()
            stopProgressTimer()
            speechDelegate?.speechDidCancel()
            logger.debug("Speech synthesis cancelled")
        }
    }
    
    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, willSpeakRangeOfSpeechString characterRange: NSRange, utterance: AVSpeechUtterance) {
        Task { @MainActor in
            // Update progress based on character range
            let totalLength = utterance.speechString.count
            if totalLength > 0 {
                let progress = Double(characterRange.location + characterRange.length) / Double(totalLength)
                playbackProgress = min(1.0, progress)
            }
            speechDelegate?.speechDidProgress(characterRange: characterRange)
        }
    }
}

// MARK: - TTS Errors
enum TTSError: LocalizedError {
    case noVoiceSelected
    case voiceNotAvailable
    case speechSynthesizerFailed
    case invalidText
    case synthesizerNotReady
    case audioSystemError(Error)
    case configurationError(String)
    
    var errorDescription: String? {
        switch self {
        case .noVoiceSelected:
            return "No voice selected for text-to-speech"
        case .voiceNotAvailable:
            return "Selected voice is not available on this system"
        case .speechSynthesizerFailed:
            return "Speech synthesizer failed to process the text"
        case .invalidText:
            return "Text provided for synthesis is invalid or empty"
        case .synthesizerNotReady:
            return "Speech synthesizer is not ready for use"
        case .audioSystemError(let error):
            return "Audio system error: \(error.localizedDescription)"
        case .configurationError(let message):
            return "TTS configuration error: \(message)"
        }
    }
    
    var recoverySuggestion: String? {
        switch self {
        case .noVoiceSelected:
            return "Please select a voice from the available options"
        case .voiceNotAvailable:
            return "Try selecting a different voice or restart the application"
        case .speechSynthesizerFailed:
            return "Check your audio settings and try again"
        case .invalidText:
            return "Provide valid text content for speech synthesis"
        case .synthesizerNotReady:
            return "Wait a moment and try again"
        case .audioSystemError:
            return "Check your audio system settings and try again"
        case .configurationError:
            return "Reset TTS settings to default values"
        }
    }
}