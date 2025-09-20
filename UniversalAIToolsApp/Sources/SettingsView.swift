import SwiftUI
import AVFoundation

struct SettingsView: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var ttsService = TTSService()
    @State private var selectedVoice: AVSpeechSynthesisVoice?
    @State private var speechRate: Float = 0.5
    @State private var ttsEnabled = true
    
    var body: some View {
        NavigationView {
            List {
                // TTS Settings Section
                Section("Text-to-Speech") {
                    Toggle("Enable TTS", isOn: $ttsEnabled)
                        .onChange(of: ttsEnabled) { newValue in
                            ttsService.isEnabled = newValue
                        }
                    
                    HStack {
                        Text("Speech Rate")
                        Spacer()
                        Slider(value: $speechRate, in: 0.0...1.0, step: 0.1)
                            .frame(width: 150)
                        Text("\(Int(speechRate * 100))%")
                            .frame(width: 40)
                    }
                    .onChange(of: speechRate) { newValue in
                        ttsService.setSpeechRate(newValue)
                    }
                    
                    Picker("Voice", selection: $selectedVoice) {
                        ForEach(ttsService.availableVoices, id: \.identifier) { voice in
                            Text("\(voice.name) (\(voice.language))")
                                .tag(voice as AVSpeechSynthesisVoice?)
                        }
                    }
                    .onChange(of: selectedVoice) { newValue in
                        if let voice = newValue {
                            ttsService.setVoice(voice)
                        }
                    }
                    
                    // Test TTS Button
                    Button("Test Speech") {
                        ttsService.speakText("Hello, this is a test of the text-to-speech system.")
                    }
                    .disabled(!ttsEnabled)
                }
                
                // Connection Settings Section
                Section("Connections") {
                    ConnectionRow(
                        title: "Chat Service",
                        url: "http://localhost:8010",
                        status: .connected
                    )
                    
                    ConnectionRow(
                        title: "Knowledge Gateway",
                        url: "http://localhost:8088",
                        status: .unknown
                    )
                    
                    ConnectionRow(
                        title: "Monitoring",
                        url: "http://localhost:9091",
                        status: .connected
                    )
                }
                
                // Knowledge Settings Section
                Section("Knowledge Grounding") {
                    Toggle("Use Knowledge in Chat", isOn: .constant(true))
                    Toggle("Auto-sync Knowledge", isOn: .constant(true))
                    
                    HStack {
                        Text("Sync Interval")
                        Spacer()
                        Text("5 minutes")
                            .foregroundColor(.secondary)
                    }
                }
                
                // Monitoring Settings Section
                Section("Monitoring") {
                    Toggle("Enable Notifications", isOn: .constant(true))
                    Toggle("Sound Alerts", isOn: .constant(false))
                    Toggle("Visual Alerts", isOn: .constant(true))
                    
                    HStack {
                        Text("Refresh Interval")
                        Spacer()
                        Text("30 seconds")
                            .foregroundColor(.secondary)
                    }
                }
                
                // About Section
                Section("About") {
                    HStack {
                        Text("Version")
                        Spacer()
                        Text("1.0.0")
                            .foregroundColor(.secondary)
                    }
                    
                    HStack {
                        Text("Build")
                        Spacer()
                        Text("2025.09.19")
                            .foregroundColor(.secondary)
                    }
                    
                    Button("Export Configuration") {
                        exportConfiguration()
                    }
                    
                    Button("Reset to Defaults") {
                        resetToDefaults()
                    }
                    .foregroundColor(.red)
                }
            }
            .navigationTitle("Settings")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
        .frame(width: 500, height: 600)
        .onAppear {
            selectedVoice = ttsService.voice
            speechRate = ttsService.speechRate
            ttsEnabled = ttsService.isEnabled
        }
    }
    
    private func exportConfiguration() {
        do {
            try GroundingConfig.saveConfigurationToFile()
        } catch {
            print("Failed to export configuration: \(error)")
        }
    }
    
    private func resetToDefaults() {
        // Reset TTS settings
        ttsService.setSpeechRate(0.5)
        speechRate = 0.5
        
        // Reset other settings to defaults
        // This would reset all user preferences
    }
}

struct ConnectionRow: View {
    let title: String
    let url: String
    let status: ConnectionStatus
    
    var body: some View {
        HStack {
            Image(systemName: status.icon)
                .foregroundColor(status.color)
                .frame(width: 20)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.body)
                
                Text(url)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            Text(status.text)
                .font(.caption)
                .foregroundColor(status.color)
        }
        .padding(.vertical, 2)
    }
}

