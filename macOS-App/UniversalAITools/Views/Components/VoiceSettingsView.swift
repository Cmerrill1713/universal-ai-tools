import SwiftUI

// MARK: - Voice Settings View
struct VoiceSettingsView: View {
    @ObservedObject var voiceInterface: EnhancedVoiceInterface
    @State private var tempSettings: VoiceSettings
    
    init(voiceInterface: EnhancedVoiceInterface) {
        self.voiceInterface = voiceInterface
        self._tempSettings = State(initialValue: voiceInterface.voiceSettings)
    }
    
    var body: some View {
        VStack(spacing: 0) {
            // Header
            headerView
            
            Divider()
            
            // Settings Content
            ScrollView {
                VStack(spacing: 20) {
                    generalSettings
                    speechSettings
                    advancedSettings
                    capabilitiesInfo
                }
                .padding()
            }
            
            Divider()
            
            // Footer Actions
            footerActions
        }
        .background(.regularMaterial)
    }
    
    private var headerView: some View {
        VStack(spacing: 8) {
            HStack {
                Image(systemName: "speaker.wave.2")
                    .font(.title2)
                    .foregroundColor(.blue)
                
                Text("Voice Settings")
                    .font(.headline)
                    .fontWeight(.semibold)
            }
            
            Text("Configure voice recognition and speech output")
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding()
    }
    
    private var generalSettings: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("General")
                .font(.subheadline)
                .fontWeight(.semibold)
            
            VStack(spacing: 8) {
                Toggle("Enable Voice Recognition", isOn: $tempSettings.isEnabled)
                Toggle("Voice Commands", isOn: $tempSettings.voiceCommands)
                Toggle("Continuous Listening", isOn: $tempSettings.continuousListening)
                Toggle("Auto Response", isOn: $tempSettings.autoResponse)
                Toggle("Background Listening", isOn: $tempSettings.backgroundListening)
            }
        }
        .padding()
        .background(.ultraThinMaterial)
        .cornerRadius(12)
    }
    
    private var speechSettings: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Speech Output")
                .font(.subheadline)
                .fontWeight(.semibold)
            
            VStack(spacing: 16) {
                // Language Selection
                VStack(alignment: .leading, spacing: 4) {
                    Text("Language")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    
                    Picker("Language", selection: $tempSettings.language) {
                        ForEach(Array(VoiceSettings.availableLanguages.keys), id: \.self) { key in
                            Text(VoiceSettings.availableLanguages[key] ?? key)
                                .tag(key)
                        }
                    }
                    .pickerStyle(.menu)
                }
                
                // Speech Rate
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text("Speech Rate")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        
                        Spacer()
                        
                        Text("\(Int(tempSettings.speechRate * 100))%")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    
                    Slider(value: $tempSettings.speechRate, in: 0.1...2.0, step: 0.1)
                }
                
                // Speech Volume
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text("Volume")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        
                        Spacer()
                        
                        Text("\(Int(tempSettings.speechVolume * 100))%")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    
                    Slider(value: $tempSettings.speechVolume, in: 0.0...1.0, step: 0.1)
                }
                
                // Speech Pitch
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text("Pitch")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        
                        Spacer()
                        
                        Text("\(String(format: "%.1f", tempSettings.speechPitch))x")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    
                    Slider(value: $tempSettings.speechPitch, in: 0.5...2.0, step: 0.1)
                }
                
                // Test Speech Button
                Button("Test Speech") {
                    testSpeech()
                }
                .buttonStyle(.bordered)
            }
        }
        .padding()
        .background(.ultraThinMaterial)
        .cornerRadius(12)
    }
    
    private var advancedSettings: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Advanced")
                .font(.subheadline)
                .fontWeight(.semibold)
            
            VStack(spacing: 8) {
                Toggle("Keyword Detection", isOn: $tempSettings.keywordDetection)
                Toggle("Noise Reduction", isOn: $tempSettings.noiseReduction)
            }
        }
        .padding()
        .background(.ultraThinMaterial)
        .cornerRadius(12)
    }
    
    private var capabilitiesInfo: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Voice Capabilities")
                .font(.subheadline)
                .fontWeight(.semibold)
            
            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 2), spacing: 8) {
                ForEach(voiceInterface.getVoiceCapabilities(), id: \.self) { capability in
                    HStack {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.caption)
                            .foregroundColor(.green)
                        
                        Text(capability)
                            .font(.caption)
                        
                        Spacer()
                    }
                }
            }
            
            // Analytics
            if voiceInterface.voiceAnalytics.totalInteractions > 0 {
                Divider()
                
                VStack(alignment: .leading, spacing: 8) {
                    Text("Voice Analytics")
                        .font(.caption)
                        .fontWeight(.medium)
                        .foregroundColor(.secondary)
                    
                    HStack {
                        VStack(alignment: .leading) {
                            Text("Recognition Accuracy")
                                .font(.caption2)
                                .foregroundColor(.secondary)
                            Text("\(Int(voiceInterface.voiceAnalytics.recognitionAccuracy * 100))%")
                                .font(.caption)
                                .fontWeight(.medium)
                        }
                        
                        Spacer()
                        
                        VStack(alignment: .trailing) {
                            Text("Total Interactions")
                                .font(.caption2)
                                .foregroundColor(.secondary)
                            Text("\(voiceInterface.voiceAnalytics.totalInteractions)")
                                .font(.caption)
                                .fontWeight(.medium)
                        }
                    }
                }
            }
        }
        .padding()
        .background(.ultraThinMaterial)
        .cornerRadius(12)
    }
    
    private var footerActions: some View {
        HStack {
            Button("Reset to Defaults") {
                tempSettings = VoiceSettings()
            }
            .buttonStyle(.bordered)
            
            Spacer()
            
            Button("Cancel") {
                tempSettings = voiceInterface.voiceSettings
            }
            .buttonStyle(.bordered)
            
            Button("Apply") {
                applySettings()
            }
            .buttonStyle(.borderedProminent)
        }
        .padding()
    }
    
    // MARK: - Actions
    private func applySettings() {
        voiceInterface.updateVoiceSettings(tempSettings)
    }
    
    func testSpeech() {
        let testText = "This is a test of the voice settings. The speech rate is \(Int(tempSettings.speechRate * 100)) percent."
        
        Task {
            // Temporarily apply settings for test
            voiceInterface.ttsService.rate = tempSettings.speechRate
            voiceInterface.ttsService.volume = tempSettings.speechVolume
            voiceInterface.ttsService.pitchMultiplier = tempSettings.speechPitch
            
            do {
                try await voiceInterface.ttsService.speak(testText)
            } catch {
                print("Test speech failed: \(error)")
            }
        }
    }
}

// MARK: - Conversation Settings View
struct ConversationSettingsView: View {
    @ObservedObject var conversationManager: ConversationManager
    
    var body: some View {
        VStack(spacing: 0) {
            // Header
            headerView
            
            Divider()
            
            // Settings Content
            ScrollView {
                VStack(spacing: 20) {
                    modeSettings
                    sessionSettings
                    metricsView
                }
                .padding()
            }
        }
        .background(.regularMaterial)
    }
    
    private var headerView: some View {
        VStack(spacing: 8) {
            HStack {
                Image(systemName: "gearshape")
                    .font(.title2)
                    .foregroundColor(.blue)
                
                Text("Conversation Settings")
                    .font(.headline)
                    .fontWeight(.semibold)
            }
            
            Text("Configure conversation behavior and preferences")
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding()
    }
    
    private var modeSettings: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Conversation Mode")
                .font(.subheadline)
                .fontWeight(.semibold)
            
            VStack(spacing: 8) {
                ForEach(ConversationMode.allCases, id: \.self) { mode in
                    HStack {
                        Button(action: {
                            conversationManager.mode = mode
                        }) {
                            HStack {
                                Image(systemName: conversationManager.mode == mode ? "checkmark.circle.fill" : "circle")
                                    .foregroundColor(conversationManager.mode == mode ? .blue : .gray)
                                
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(mode.displayName)
                                        .font(.subheadline)
                                        .foregroundColor(.primary)
                                    
                                    Text(modeDescription(mode))
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }
                                
                                Spacer()
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        .padding()
        .background(.ultraThinMaterial)
        .cornerRadius(12)
    }
    
    private var sessionSettings: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Session Management")
                .font(.subheadline)
                .fontWeight(.semibold)
            
            VStack(spacing: 8) {
                Toggle("Voice Recognition", isOn: $conversationManager.isVoiceEnabled)
                
                if let session = conversationManager.currentSession {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Current Session")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        
                        HStack {
                            Text(session.title)
                                .font(.subheadline)
                            
                            Spacer()
                            
                            Text("\(conversationManager.conversationHistory.count) messages")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        
                        Text("Started: \(formatDate(session.startTime))")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    .padding(.top, 8)
                    
                    Button("End Session") {
                        Task {
                            await conversationManager.endConversation()
                        }
                    }
                    .buttonStyle(.bordered)
                    .foregroundColor(.red)
                }
            }
        }
        .padding()
        .background(.ultraThinMaterial)
        .cornerRadius(12)
    }
    
    private var metricsView: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Session Metrics")
                .font(.subheadline)
                .fontWeight(.semibold)
            
            let metrics = conversationManager.conversationMetrics
            
            VStack(spacing: 8) {
                MetricRow(
                    label: "Sessions Started",
                    value: "\(metrics.sessionsStarted)"
                )
                
                MetricRow(
                    label: "Sessions Completed",
                    value: "\(metrics.sessionsCompleted)"
                )
                
                MetricRow(
                    label: "Messages Processed",
                    value: "\(metrics.messagesProcessed)"
                )
                
                MetricRow(
                    label: "Voice Interactions",
                    value: "\(metrics.voiceInteractions)"
                )
                
                MetricRow(
                    label: "Completion Rate",
                    value: "\(Int(metrics.completionRate * 100))%"
                )
                
                MetricRow(
                    label: "Voice Usage Rate",
                    value: "\(Int(metrics.voiceUsageRate * 100))%"
                )
            }
        }
        .padding()
        .background(.ultraThinMaterial)
        .cornerRadius(12)
    }
    
    // MARK: - Helper Methods
    private func modeDescription(_ mode: ConversationMode) -> String {
        switch mode {
        case .textOnly:
            return "Text input and output only"
        case .voiceOnly:
            return "Voice input and output only"
        case .hybrid:
            return "Both text and voice supported"
        }
    }
    
    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .short
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}

// MARK: - Metric Row
struct MetricRow: View {
    let label: String
    let value: String
    
    var body: some View {
        HStack {
            Text(label)
                .font(.caption)
                .foregroundColor(.secondary)
            
            Spacer()
            
            Text(value)
                .font(.caption)
                .fontWeight(.medium)
        }
    }
}

// MARK: - Preview
struct VoiceSettingsView_Previews: PreviewProvider {
    static var previews: some View {
        let apiService = APIService()
        let loggingService = LoggingService()
        let monitoringService = MonitoringService()
        
        let conversationManager = ConversationManager(
            apiService: apiService,
            loggingService: loggingService,
            monitoringService: monitoringService
        )
        
        let agentService = AgentConversationService(
            apiService: apiService,
            loggingService: loggingService,
            monitoringService: monitoringService
        )
        
        let voiceInterface = EnhancedVoiceInterface(
            conversationManager: conversationManager,
            agentService: agentService,
            loggingService: loggingService
        )
        
        VoiceSettingsView(voiceInterface: voiceInterface)
    }
}