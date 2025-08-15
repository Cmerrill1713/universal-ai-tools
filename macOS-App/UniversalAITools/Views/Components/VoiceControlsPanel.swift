import SwiftUI

// MARK: - Voice Controls Panel
struct VoiceControlsPanel: View {
    @ObservedObject var sttService: STTService
    @ObservedObject var ttsService: TTSService
    @ObservedObject var voiceAgent: VoiceAgent
    @State private var selectedTab: VoiceControlTab = .general
    @State private var showAdvanced = false
    @State private var testText = "Hello, this is a test of the voice system."
    
    var body: some View {
        VStack(spacing: 0) {
            // Header
            headerSection
            
            // Tab selector
            tabSelector
            
            // Content area
            ScrollView {
                VStack(spacing: 20) {
                    switch selectedTab {
                    case .general:
                        generalSettings
                    case .speechToText:
                        speechToTextSettings
                    case .textToSpeech:
                        textToSpeechSettings
                    case .agent:
                        agentSettings
                    case .advanced:
                        advancedSettings
                    }
                }
                .padding(20)
            }
            
            // Footer with test controls
            footerSection
        }
        .background(.regularMaterial)
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(
                    LinearGradient(
                        colors: [Color.white.opacity(0.3), Color.white.opacity(0.1)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    lineWidth: 1
                )
        )
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
    
    // MARK: - Header Section
    private var headerSection: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("Voice Controls")
                    .font(.title2)
                    .fontWeight(.semibold)
                    .foregroundColor(AppTheme.primaryText)
                
                Text("Configure speech recognition and voice interaction")
                    .font(.caption)
                    .foregroundColor(AppTheme.secondaryText)
            }
            
            Spacer()
            
            // Voice agent status
            VoiceActivityIndicator(voiceAgent: voiceAgent)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 16)
        .background(.ultraThinMaterial)
    }
    
    // MARK: - Tab Selector
    private var tabSelector: some View {
        HStack(spacing: 0) {
            ForEach(VoiceControlTab.allCases, id: \.self) { tab in
                Button(action: { selectedTab = tab }) {
                    VStack(spacing: 4) {
                        Image(systemName: tab.icon)
                            .font(.system(size: 16, weight: .medium))
                        
                        Text(tab.title)
                            .font(.caption)
                            .fontWeight(.medium)
                    }
                    .foregroundColor(selectedTab == tab ? AppTheme.accentGreen : AppTheme.secondaryText)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(
                        RoundedRectangle(cornerRadius: 8, style: .continuous)
                            .fill(selectedTab == tab ? AppTheme.accentGreen.opacity(0.15) : Color.clear)
                    )
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(.ultraThinMaterial)
    }
    
    // MARK: - General Settings
    private var generalSettings: some View {
        VStack(spacing: 16) {
            SettingsSection(title: "Voice System", icon: "waveform.and.mic") {
                VStack(spacing: 12) {
                    SettingsToggle(
                        title: "Enable Voice Agent",
                        description: "Turn on voice interaction capabilities",
                        isOn: .init(
                            get: { voiceAgent.isEnabled },
                            set: { voiceAgent.isEnabled = $0 }
                        )
                    )
                    
                    SettingsToggle(
                        title: "Enable Speech Recognition",
                        description: "Allow the app to convert speech to text",
                        isOn: .init(
                            get: { sttService.isAuthorized && sttService.isAvailable },
                            set: { _ in
                                if !sttService.isAuthorized {
                                    Task {
                                        await sttService.requestAuthorization()
                                    }
                                }
                            }
                        )
                    )
                    .disabled(!sttService.isAvailable)
                    
                    SettingsToggle(
                        title: "Enable Text-to-Speech",
                        description: "Allow the app to speak responses aloud",
                        isOn: .init(
                            get: { ttsService.isEnabled },
                            set: { _ in ttsService.toggleEnabled() }
                        )
                    )
                }
            }
            
            SettingsSection(title: "Interaction Mode", icon: "bubble.left.and.bubble.right") {
                VStack(spacing: 8) {
                    ForEach([VoiceInteractionMode.conversational, .command, .dictation, .assistant], id: \.self) { mode in
                        SettingsRadioOption(
                            title: mode.displayName,
                            description: mode.description,
                            isSelected: voiceAgent.configuration.interactionMode == mode,
                            onSelect: {
                                var config = voiceAgent.configuration
                                config.interactionMode = mode
                                voiceAgent.updateConfiguration(config)
                            }
                        )
                    }
                }
            }
        }
    }
    
    // MARK: - Speech-to-Text Settings
    private var speechToTextSettings: some View {
        VStack(spacing: 16) {
            SettingsSection(title: "Input Mode", icon: "mic") {
                VStack(spacing: 8) {
                    ForEach([STTInputMode.pushToTalk, .voiceActivation, .continuous], id: \.self) { mode in
                        SettingsRadioOption(
                            title: mode.displayName,
                            description: mode.description,
                            isSelected: sttService.configuration.inputMode == mode,
                            onSelect: {
                                var config = sttService.configuration
                                config.inputMode = mode
                                sttService.updateConfiguration(config)
                            }
                        )
                    }
                }
            }
            
            SettingsSection(title: "Recognition Settings", icon: "text.bubble") {
                VStack(spacing: 12) {
                    SettingsToggle(
                        title: "Enable Punctuation",
                        description: "Add punctuation to transcribed text",
                        isOn: .init(
                            get: { sttService.configuration.enablePunctuation },
                            set: { value in
                                var config = sttService.configuration
                                config.enablePunctuation = value
                                sttService.updateConfiguration(config)
                            }
                        )
                    )
                    
                    SettingsToggle(
                        title: "Show Partial Results",
                        description: "Display text as you speak",
                        isOn: .init(
                            get: { sttService.configuration.enablePartialResults },
                            set: { value in
                                var config = sttService.configuration
                                config.enablePartialResults = value
                                sttService.updateConfiguration(config)
                            }
                        )
                    )
                    
                    SettingsSlider(
                        title: "Silence Threshold",
                        description: "How long to wait before stopping recording",
                        value: .init(
                            get: { sttService.configuration.silenceThreshold },
                            set: { value in
                                var config = sttService.configuration
                                config.silenceThreshold = value
                                sttService.updateConfiguration(config)
                            }
                        ),
                        range: 0.5...10.0,
                        step: 0.5,
                        unit: "seconds"
                    )
                    
                    SettingsSlider(
                        title: "Max Recording Duration",
                        description: "Maximum time for a single recording",
                        value: .init(
                            get: { sttService.configuration.maxRecordingDuration },
                            set: { value in
                                var config = sttService.configuration
                                config.maxRecordingDuration = value
                                sttService.updateConfiguration(config)
                            }
                        ),
                        range: 10.0...300.0,
                        step: 10.0,
                        unit: "seconds"
                    )
                }
            }
            
            if sttService.configuration.inputMode == .voiceActivation {
                SettingsSection(title: "Voice Activation", icon: "mic.badge.plus") {
                    SettingsSlider(
                        title: "Activation Sensitivity",
                        description: "How sensitive voice activation should be",
                        value: .init(
                            get: { Double(sttService.configuration.voiceActivationThreshold) },
                            set: { value in
                                var config = sttService.configuration
                                config.voiceActivationThreshold = Float(value)
                                sttService.updateConfiguration(config)
                            }
                        ),
                        range: 0.01...1.0,
                        step: 0.01,
                        unit: ""
                    )
                }
            }
        }
    }
    
    // MARK: - Text-to-Speech Settings
    private var textToSpeechSettings: some View {
        VStack(spacing: 16) {
            // Voice selection (reuse from TTSControlsPanel)
            SettingsSection(title: "Voice Selection", icon: "speaker.wave.2") {
                VStack(spacing: 8) {
                    ForEach(ttsService.availableVoices) { voice in
                        SettingsRadioOption(
                            title: voice.name,
                            description: "\(voice.gender.displayName) • \(voice.language.uppercased()) • \(voice.description)",
                            isSelected: voice.id == ttsService.selectedVoice?.id,
                            onSelect: {
                                ttsService.setVoice(voice)
                            }
                        )
                    }
                }
            }
            
            SettingsSection(title: "Playback Settings", icon: "speaker.3") {
                VStack(spacing: 12) {
                    SettingsSlider(
                        title: "Volume",
                        description: "TTS playback volume",
                        value: .init(
                            get: { Double(ttsService.volume) },
                            set: { ttsService.setVolume(Float($0)) }
                        ),
                        range: 0.0...1.0,
                        step: 0.05,
                        unit: "%",
                        formatter: { String(format: "%.0f", $0 * 100) }
                    )
                    
                    SettingsSlider(
                        title: "Speech Rate",
                        description: "How fast the voice speaks",
                        value: .init(
                            get: { Double(ttsService.playbackSpeed) },
                            set: { ttsService.setPlaybackSpeed(Float($0)) }
                        ),
                        range: 0.5...2.0,
                        step: 0.1,
                        unit: "x"
                    )
                }
            }
        }
    }
    
    // MARK: - Agent Settings
    private var agentSettings: some View {
        VStack(spacing: 16) {
            SettingsSection(title: "Conversation", icon: "bubble.left.and.bubble.right") {
                VStack(spacing: 12) {
                    SettingsToggle(
                        title: "Auto TTS Response",
                        description: "Automatically speak AI responses",
                        isOn: .init(
                            get: { voiceAgent.configuration.autoTTSResponse },
                            set: { value in
                                var config = voiceAgent.configuration
                                config.autoTTSResponse = value
                                voiceAgent.updateConfiguration(config)
                            }
                        )
                    )
                    
                    SettingsToggle(
                        title: "Context Retention",
                        description: "Remember conversation history",
                        isOn: .init(
                            get: { voiceAgent.configuration.contextRetention },
                            set: { value in
                                var config = voiceAgent.configuration
                                config.contextRetention = value
                                voiceAgent.updateConfiguration(config)
                            }
                        )
                    )
                    
                    if voiceAgent.configuration.contextRetention {
                        SettingsSlider(
                            title: "Max Context Messages",
                            description: "How many messages to remember",
                            value: .init(
                                get: { Double(voiceAgent.configuration.maxContextMessages) },
                                set: { value in
                                    var config = voiceAgent.configuration
                                    config.maxContextMessages = Int(value)
                                    voiceAgent.updateConfiguration(config)
                                }
                            ),
                            range: 1...50,
                            step: 1,
                            unit: "messages"
                        )
                    }
                }
            }
            
            SettingsSection(title: "Personality", icon: "person.circle") {
                VStack(spacing: 8) {
                    ForEach(ConversationPersonality.allCases, id: \.self) { personality in
                        SettingsRadioOption(
                            title: personality.rawValue,
                            description: personality.description,
                            isSelected: voiceAgent.configuration.conversationPersonality == personality,
                            onSelect: {
                                var config = voiceAgent.configuration
                                config.conversationPersonality = personality
                                voiceAgent.updateConfiguration(config)
                            }
                        )
                    }
                }
            }
            
            SettingsSection(title: "Voice Commands", icon: "command") {
                VStack(spacing: 12) {
                    SettingsTextField(
                        title: "Activation Phrase",
                        description: "Optional phrase to activate voice commands",
                        text: .init(
                            get: { voiceAgent.configuration.voiceActivationPhrase ?? "" },
                            set: { value in
                                var config = voiceAgent.configuration
                                config.voiceActivationPhrase = value.isEmpty ? nil : value
                                voiceAgent.updateConfiguration(config)
                            }
                        ),
                        placeholder: "Hey Assistant"
                    )
                }
            }
        }
    }
    
    // MARK: - Advanced Settings
    private var advancedSettings: some View {
        VStack(spacing: 16) {
            SettingsSection(title: "Performance", icon: "speedometer") {
                VStack(spacing: 12) {
                    SettingsSlider(
                        title: "Response Timeout",
                        description: "Max time to wait for AI response",
                        value: .init(
                            get: { voiceAgent.configuration.responseTimeout },
                            set: { value in
                                var config = voiceAgent.configuration
                                config.responseTimeout = value
                                voiceAgent.updateConfiguration(config)
                            }
                        ),
                        range: 5.0...120.0,
                        step: 5.0,
                        unit: "seconds"
                    )
                }
            }
            
            SettingsSection(title: "Experimental", icon: "flask") {
                VStack(spacing: 12) {
                    SettingsToggle(
                        title: "Smart Punctuation",
                        description: "Intelligently add punctuation based on context",
                        isOn: .init(
                            get: { voiceAgent.configuration.enableSmartPunctuation },
                            set: { value in
                                var config = voiceAgent.configuration
                                config.enableSmartPunctuation = value
                                voiceAgent.updateConfiguration(config)
                            }
                        )
                    )
                    
                    SettingsToggle(
                        title: "Emotional Tone Detection",
                        description: "Detect and respond to emotional tone in voice",
                        isOn: .init(
                            get: { voiceAgent.configuration.enableEmotionalTone },
                            set: { value in
                                var config = voiceAgent.configuration
                                config.enableEmotionalTone = value
                                voiceAgent.updateConfiguration(config)
                            }
                        )
                    )
                }
            }
            
            SettingsSection(title: "Data", icon: "externaldrive") {
                VStack(spacing: 12) {
                    HStack {
                        Text("Interaction History")
                            .font(.subheadline)
                            .fontWeight(.medium)
                            .foregroundColor(AppTheme.primaryText)
                        
                        Spacer()
                        
                        Text("\(voiceAgent.interactionHistory.count) interactions")
                            .font(.caption)
                            .foregroundColor(AppTheme.secondaryText)
                    }
                    
                    HStack(spacing: 12) {
                        Button("Clear History") {
                            voiceAgent.interactionHistory.removeAll()
                        }
                        .buttonStyle(.bordered)
                        
                        Button("Export History") {
                            exportInteractionHistory()
                        }
                        .buttonStyle(.bordered)
                        
                        Button("Clear Context") {
                            voiceAgent.clearConversationContext()
                        }
                        .buttonStyle(.bordered)
                    }
                }
            }
        }
    }
    
    // MARK: - Footer Section
    private var footerSection: some View {
        VStack(spacing: 12) {
            Divider()
            
            HStack(spacing: 16) {
                // Test TTS
                HStack {
                    TextField("Test text...", text: $testText)
                        .textFieldStyle(.roundedBorder)
                    
                    Button("Speak") {
                        Task {
                            await ttsService.speak(text: testText)
                        }
                    }
                    .buttonStyle(.bordered)
                    .disabled(!ttsService.isEnabled)
                }
                
                Spacer()
                
                // Test STT
                Button("Test Recording") {
                    Task {
                        try? await sttService.startListening(
                            onComplete: { transcription in
                                testText = transcription
                            }
                        )
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(!sttService.isAuthorized || !sttService.isAvailable)
            }
        }
        .padding(.horizontal, 20)
        .padding(.bottom, 16)
        .background(.ultraThinMaterial)
    }
    
    // MARK: - Helper Methods
    private func exportInteractionHistory() {
        let historyData = voiceAgent.exportInteractionHistory()
        
        let savePanel = NSSavePanel()
        savePanel.nameFieldStringValue = "voice_interaction_history.json"
        savePanel.allowedContentTypes = [.json]
        
        if savePanel.runModal() == .OK {
            guard let url = savePanel.url else { return }
            
            do {
                try historyData.write(to: url, atomically: true, encoding: .utf8)
            } catch {
                print("Failed to export interaction history: \(error)")
            }
        }
    }
}

// MARK: - Voice Control Tabs
enum VoiceControlTab: String, CaseIterable {
    case general = "General"
    case speechToText = "Speech-to-Text"
    case textToSpeech = "Text-to-Speech"
    case agent = "Agent"
    case advanced = "Advanced"
    
    var title: String { rawValue }
    
    var icon: String {
        switch self {
        case .general:
            return "gear"
        case .speechToText:
            return "mic"
        case .textToSpeech:
            return "speaker.wave.2"
        case .agent:
            return "brain"
        case .advanced:
            return "slider.horizontal.3"
        }
    }
}

// MARK: - Settings Components
struct SettingsSection<Content: View>: View {
    let title: String
    let icon: String
    let content: Content
    
    init(title: String, icon: String, @ViewBuilder content: () -> Content) {
        self.title = title
        self.icon = icon
        self.content = content()
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Image(systemName: icon)
                    .font(.system(size: 16, weight: .medium))
                    .foregroundColor(AppTheme.accentGreen)
                
                Text(title)
                    .font(.headline)
                    .fontWeight(.semibold)
                    .foregroundColor(AppTheme.primaryText)
            }
            
            content
        }
        .padding(16)
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(Color.white.opacity(0.2), lineWidth: 1)
        )
    }
}

struct SettingsToggle: View {
    let title: String
    let description: String
    @Binding var isOn: Bool
    
    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .foregroundColor(AppTheme.primaryText)
                
                Text(description)
                    .font(.caption)
                    .foregroundColor(AppTheme.secondaryText)
            }
            
            Spacer()
            
            Toggle("", isOn: $isOn)
                .toggleStyle(SwitchToggleStyle(tint: AppTheme.accentGreen))
        }
    }
}

struct SettingsRadioOption: View {
    let title: String
    let description: String
    let isSelected: Bool
    let onSelect: () -> Void
    
    var body: some View {
        Button(action: onSelect) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .foregroundColor(AppTheme.primaryText)
                    
                    Text(description)
                        .font(.caption)
                        .foregroundColor(AppTheme.secondaryText)
                        .lineLimit(2)
                }
                
                Spacer()
                
                Image(systemName: isSelected ? "largecircle.fill.circle" : "circle")
                    .foregroundColor(isSelected ? AppTheme.accentGreen : AppTheme.tertiaryText)
                    .font(.system(size: 16))
            }
            .padding(.vertical, 4)
        }
        .buttonStyle(.plain)
    }
}

struct SettingsSlider: View {
    let title: String
    let description: String
    @Binding var value: Double
    let range: ClosedRange<Double>
    let step: Double
    let unit: String
    let formatter: ((Double) -> String)?
    
    init(title: String, description: String, value: Binding<Double>, range: ClosedRange<Double>, step: Double, unit: String, formatter: ((Double) -> String)? = nil) {
        self.title = title
        self.description = description
        self._value = value
        self.range = range
        self.step = step
        self.unit = unit
        self.formatter = formatter
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .foregroundColor(AppTheme.primaryText)
                    
                    Text(description)
                        .font(.caption)
                        .foregroundColor(AppTheme.secondaryText)
                }
                
                Spacer()
                
                Text(displayValue)
                    .font(.caption)
                    .foregroundColor(AppTheme.tertiaryText)
                    .monospacedDigit()
            }
            
            Slider(value: $value, in: range, step: step)
                .accentColor(AppTheme.accentGreen)
        }
    }
    
    private var displayValue: String {
        if let formatter = formatter {
            return formatter(value) + unit
        } else {
            return String(format: "%.1f", value) + unit
        }
    }
}

struct SettingsTextField: View {
    let title: String
    let description: String
    @Binding var text: String
    let placeholder: String
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .foregroundColor(AppTheme.primaryText)
                
                Text(description)
                    .font(.caption)
                    .foregroundColor(AppTheme.secondaryText)
            }
            
            TextField(placeholder, text: $text)
                .textFieldStyle(.roundedBorder)
        }
    }
}

// MARK: - Extensions
extension VoiceInteractionMode {
    var displayName: String {
        switch self {
        case .conversational:
            return "Conversational"
        case .command:
            return "Command"
        case .dictation:
            return "Dictation"
        case .assistant:
            return "AI Assistant"
        }
    }
    
    var description: String {
        switch self {
        case .conversational:
            return "Back-and-forth conversation with AI"
        case .command:
            return "Single command execution"
        case .dictation:
            return "Pure speech-to-text transcription"
        case .assistant:
            return "AI assistant with context awareness"
        }
    }
}

extension STTInputMode {
    var description: String {
        switch self {
        case .pushToTalk:
            return "Press and hold to record"
        case .voiceActivation:
            return "Automatically detect speech"
        case .continuous:
            return "Always listening for input"
        }
    }
}

extension ConversationPersonality {
    var description: String {
        switch self {
        case .professional:
            return "Business-appropriate, clear responses"
        case .friendly:
            return "Warm, conversational, and engaging"
        case .creative:
            return "Imaginative and innovative thinking"
        case .analytical:
            return "Logical, data-driven approach"
        case .concise:
            return "Brief, direct, to-the-point"
        }
    }
}

// MARK: - Preview
struct VoiceControlsPanel_Previews: PreviewProvider {
    static var previews: some View {
        VoiceControlsPanel(
            sttService: STTService(),
            ttsService: TTSService(),
            voiceAgent: VoiceAgent(
                sttService: STTService(),
                ttsService: TTSService(),
                apiService: APIService()
            )
        )
        .frame(width: 600, height: 700)
        .background(Color.black)
    }
}