import SwiftUI
import AVFoundation

// MARK: - Voice Recording View
struct VoiceRecordingView: View {
    @ObservedObject var sttService: STTService
    @ObservedObject var voiceAgent: VoiceAgent
    @State private var isRecording = false
    @State private var recordingAmplitude: CGFloat = 0.0
    @State private var pulsePhase: CGFloat = 0.0
    @State private var showWaveform = false
    
    let onTranscriptionComplete: (String) -> Void
    
    var body: some View {
        VStack(spacing: 16) {
            // Visual feedback area
            voiceVisualizer
            
            // Transcription display
            transcriptionDisplay
            
            // Control buttons
            controlButtons
        }
        .padding(20)
        .background(recordingBackground)
        .overlay(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .stroke(recordingBorderGradient, lineWidth: 2)
        )
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .scaleEffect(isRecording ? 1.02 : 1.0)
        .animation(.spring(response: 0.4, dampingFraction: 0.8), value: isRecording)
        .onReceive(Timer.publish(every: 0.05, on: .main, in: .common).autoconnect()) {
            _ in updateVisualization()
        }
        .onChange(of: sttService.recognitionState) { state in
            handleStateChange(state)
        }
        .onChange(of: voiceAgent.state) { state in
            handleVoiceAgentStateChange(state)
        }
    }
    
    // MARK: - Visual Components
    private var voiceVisualizer: some View {
        ZStack {
            // Background circles
            ForEach(0..<3, id: \.self) { index in
                Circle()
                    .stroke(
                        LinearGradient(
                            colors: [
                                AppTheme.accentGreen.opacity(0.3),
                                AppTheme.accentGreen.opacity(0.1)
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        lineWidth: 2
                    )
                    .frame(width: circleSize(for: index), height: circleSize(for: index))
                    .scaleEffect(isRecording ? 1.0 + CGFloat(index) * 0.1 : 0.8)
                    .opacity(isRecording ? 0.6 - CGFloat(index) * 0.15 : 0.3)
                    .animation(
                        .easeInOut(duration: 1.5 + Double(index) * 0.2)
                        .repeatForever(autoreverses: true),
                        value: isRecording
                    )
            }
            
            // Main recording button/indicator
            ZStack {
                // Pulse effect
                if isRecording {
                    Circle()
                        .fill(
                            RadialGradient(
                                colors: [
                                    AppTheme.accentGreen.opacity(0.4),
                                    AppTheme.accentGreen.opacity(0.0)
                                ],
                                center: .center,
                                startRadius: 20,
                                endRadius: 60
                            )
                        )
                        .frame(width: 120, height: 120)
                        .scaleEffect(1.0 + recordingAmplitude * 0.5)
                        .animation(.easeInOut(duration: 0.1), value: recordingAmplitude)
                }
                
                // Main button
                Button(action: toggleRecording) {
                    ZStack {
                        Circle()
                            .fill(buttonGradient)
                            .frame(width: 80, height: 80)
                            .overlay(
                                Circle()
                                    .stroke(Color.white.opacity(0.3), lineWidth: 2)
                            )
                        
                        // Icon
                        Image(systemName: buttonIcon)
                            .font(.system(size: 28, weight: .medium))
                            .foregroundColor(.white)
                            .scaleEffect(isRecording ? 1.1 : 1.0)
                            .animation(.spring(response: 0.3, dampingFraction: 0.6), value: isRecording)
                    }
                }
                .buttonStyle(.plain)
                .disabled(!canRecord)
                .help(buttonHelpText)
                
                // State indicator
                if case .processing = sttService.recognitionState {
                    Circle()
                        .stroke(Color.orange, lineWidth: 3)
                        .frame(width: 90, height: 90)
                        .rotationEffect(.degrees(pulsePhase * 360))
                        .animation(.linear(duration: 1).repeatForever(autoreverses: false), value: pulsePhase)
                }
            }
            
            // Audio level indicator
            if isRecording && showWaveform {
                audioLevelIndicator
            }
        }
        .frame(height: 160)
    }
    
    private var audioLevelIndicator: some View {
        HStack(spacing: 3) {
            ForEach(0..<5, id: \.self) { index in
                RoundedRectangle(cornerRadius: 2)
                    .fill(AppTheme.accentGreen)
                    .frame(width: 4, height: barHeight(for: index))
                    .animation(.easeInOut(duration: 0.1), value: sttService.audioLevel)
            }
        }
        .offset(y: 50)
    }
    
    private var transcriptionDisplay: some View {
        VStack(spacing: 8) {
            // Current transcription
            if !currentDisplayText.isEmpty {
                ScrollView {
                    Text(currentDisplayText)
                        .font(.system(size: 16))
                        .foregroundColor(AppTheme.primaryText)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 16)
                        .frame(maxWidth: .infinity)
                }
                .frame(maxHeight: 100)
                .background(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(.ultraThinMaterial)
                        .overlay(
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .stroke(Color.white.opacity(0.2), lineWidth: 1)
                        )
                )
            }
            
            // Status text
            Text(statusText)
                .font(.caption)
                .foregroundColor(statusColor)
                .animation(.easeInOut(duration: 0.3), value: statusText)
        }
    }
    
    private var controlButtons: some View {
        HStack(spacing: 16) {
            // Input mode selector
            Menu {
                ForEach([STTInputMode.pushToTalk, .voiceActivation, .continuous], id: \.self) { mode in
                    Button(action: { updateInputMode(mode) }) {
                        Label(mode.displayName, systemImage: mode.icon)
                    }
                }
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: sttService.configuration.inputMode.icon)
                        .font(.system(size: 14))
                    Text(sttService.configuration.inputMode.displayName)
                        .font(.caption)
                }
                .foregroundColor(AppTheme.secondaryText)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(.ultraThinMaterial)
                .clipShape(Capsule())
            }
            .buttonStyle(.plain)
            
            Spacer()
            
            // Settings button
            Button(action: openVoiceSettings) {
                Image(systemName: "gear")
                    .font(.system(size: 16))
                    .foregroundColor(AppTheme.secondaryText)
                    .frame(width: 32, height: 32)
                    .background(.ultraThinMaterial)
                    .clipShape(Circle())
            }
            .buttonStyle(.plain)
            .help("Voice Settings")
        }
    }
    
    // MARK: - Computed Properties
    private var buttonIcon: String {
        switch sttService.recognitionState {
        case .idle:
            return "mic.fill"
        case .listening:
            return "mic.fill"
        case .processing:
            return "waveform"
        case .completed:
            return "checkmark"
        case .error:
            return "mic.slash.fill"
        }
    }
    
    private var buttonGradient: LinearGradient {
        switch sttService.recognitionState {
        case .idle:
            return LinearGradient(
                colors: [AppTheme.accentGreen, AppTheme.accentGreen.opacity(0.8)],
                startPoint: .top,
                endPoint: .bottom
            )
        case .listening:
            return LinearGradient(
                colors: [.red, .red.opacity(0.8)],
                startPoint: .top,
                endPoint: .bottom
            )
        case .processing:
            return LinearGradient(
                colors: [.orange, .orange.opacity(0.8)],
                startPoint: .top,
                endPoint: .bottom
            )
        case .completed:
            return LinearGradient(
                colors: [AppTheme.accentGreen, .blue],
                startPoint: .top,
                endPoint: .bottom
            )
        case .error:
            return LinearGradient(
                colors: [.red, .red.opacity(0.6)],
                startPoint: .top,
                endPoint: .bottom
            )
        }
    }
    
    private var recordingBackground: some ShapeStyle {
        if isRecording {
            return AnyShapeStyle(.ultraThinMaterial)
        } else {
            return AnyShapeStyle(.regularMaterial)
        }
    }
    
    private var recordingBorderGradient: LinearGradient {
        if isRecording {
            return LinearGradient(
                colors: [AppTheme.accentGreen, .blue, AppTheme.accentGreen],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        } else {
            return LinearGradient(
                colors: [Color.white.opacity(0.3), Color.white.opacity(0.1)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        }
    }
    
    private var currentDisplayText: String {
        if !sttService.partialTranscription.isEmpty {
            return sttService.partialTranscription
        } else if !sttService.currentTranscription.isEmpty {
            return sttService.currentTranscription
        }
        return ""
    }
    
    private var statusText: String {
        switch voiceAgent.state {
        case .idle:
            return "Tap to start voice input"
        case .listening:
            return "Listening..."
        case .processing:
            return "Processing speech..."
        case .responding:
            return "AI is responding..."
        case .error(let message):
            return "Error: \(message)"
        }
    }
    
    private var statusColor: Color {
        switch voiceAgent.state {
        case .idle:
            return AppTheme.secondaryText
        case .listening:
            return AppTheme.accentGreen
        case .processing:
            return .orange
        case .responding:
            return .blue
        case .error:
            return .red
        }
    }
    
    private var canRecord: Bool {
        sttService.isAuthorized && sttService.isAvailable && voiceAgent.isEnabled
    }
    
    private var buttonHelpText: String {
        if !sttService.isAuthorized {
            return "Microphone access required. Check System Preferences."
        } else if !sttService.isAvailable {
            return "Speech recognition not available"
        } else if !voiceAgent.isEnabled {
            return "Voice agent is disabled"
        } else {
            switch sttService.recognitionState {
            case .idle:
                return "Start voice recording"
            case .listening:
                return "Stop recording"
            case .processing:
                return "Processing speech..."
            case .completed:
                return "Recording complete"
            case .error:
                return "Recording error"
            }
        }
    }
    
    // MARK: - Helper Methods
    private func circleSize(for index: Int) -> CGFloat {
        return 100 + CGFloat(index) * 30
    }
    
    private func barHeight(for index: Int) -> CGFloat {
        let baseHeight: CGFloat = 8
        let maxHeight: CGFloat = 24
        let level = sttService.audioLevel * 10 // Amplify for visualization
        
        // Create wave-like effect
        let waveOffset = sin(Double(index) * 0.5 + Double(pulsePhase) * 2.0 * .pi) * 0.3
        let adjustedLevel = max(0, level + Float(waveOffset))
        
        return baseHeight + (maxHeight - baseHeight) * CGFloat(adjustedLevel)
    }
    
    private func updateVisualization() {
        withAnimation(.linear(duration: 0.05)) {
            recordingAmplitude = CGFloat(sttService.audioLevel) * 2.0
            pulsePhase += 0.02
            if pulsePhase > 1.0 {
                pulsePhase = 0.0
            }
        }
    }
    
    private func toggleRecording() {
        if isRecording {
            voiceAgent.stopVoiceInteraction()
        } else {
            Task {
                await voiceAgent.startVoiceInteraction()
            }
        }
    }
    
    private func handleStateChange(_ state: STTRecognitionState) {
        withAnimation(.easeInOut(duration: 0.3)) {
            isRecording = state == .listening
            showWaveform = state == .listening
        }
        
        if case .completed = state {
            onTranscriptionComplete(sttService.currentTranscription)
        }
    }
    
    private func handleVoiceAgentStateChange(_ state: VoiceAgentState) {
        withAnimation(.easeInOut(duration: 0.3)) {
            switch state {
            case .listening:
                isRecording = true
                showWaveform = true
            case .idle:
                isRecording = false
                showWaveform = false
            default:
                break
            }
        }
    }
    
    private func updateInputMode(_ mode: STTInputMode) {
        var config = sttService.configuration
        config.inputMode = mode
        sttService.updateConfiguration(config)
    }
    
    private func openVoiceSettings() {
        NotificationCenter.default.post(name: NSNotification.Name("OpenVoiceSettings"), object: nil)
    }
}

// MARK: - Input Mode Extensions
extension STTInputMode {
    var displayName: String {
        switch self {
        case .pushToTalk:
            return "Push to Talk"
        case .voiceActivation:
            return "Voice Activation"
        case .continuous:
            return "Continuous"
        }
    }
    
    var icon: String {
        switch self {
        case .pushToTalk:
            return "mic.circle"
        case .voiceActivation:
            return "mic.badge.plus"
        case .continuous:
            return "mic.circle.fill"
        }
    }
}

// MARK: - Compact Voice Button
struct CompactVoiceButton: View {
    @ObservedObject var voiceAgent: VoiceAgent
    @State private var isPressed = false
    @State private var showRecording = false
    
    var body: some View {
        Button(action: {
            if voiceAgent.state == .idle {
                showRecording = true
            } else {
                voiceAgent.cancelVoiceInteraction()
            }
        }) {
            Image(systemName: buttonIcon)
                .font(.system(size: 16, weight: .medium))
                .foregroundColor(buttonColor)
                .frame(width: 32, height: 32)
                .background(buttonBackground)
                .clipShape(Circle())
                .overlay(
                    Circle()
                        .stroke(borderColor, lineWidth: isActive ? 2 : 1)
                )
                .scaleEffect(isPressed ? 0.95 : 1.0)
                .animation(.spring(response: 0.3, dampingFraction: 0.6), value: isPressed)
                .onLongPressGesture(
                    minimumDuration: 0,
                    maximumDistance: .infinity,
                    pressing: { pressing in
                        isPressed = pressing
                    },
                    perform: {}
                )
        }
        .buttonStyle(.plain)
        .disabled(!voiceAgent.isEnabled)
        .opacity(voiceAgent.isEnabled ? 1.0 : 0.5)
        .help(helpText)
        .popover(isPresented: $showRecording) {
            VoiceRecordingView(
                sttService: STTService(), // This should be injected properly
                voiceAgent: voiceAgent,
                onTranscriptionComplete: { _ in
                    showRecording = false
                }
            )
            .frame(width: 400, height: 300)
        }
    }
    
    private var buttonIcon: String {
        switch voiceAgent.state {
        case .idle:
            return "mic"
        case .listening:
            return "mic.fill"
        case .processing:
            return "waveform"
        case .responding:
            return "speaker.wave.2"
        case .error:
            return "mic.slash"
        }
    }
    
    private var buttonColor: Color {
        switch voiceAgent.state {
        case .idle:
            return AppTheme.secondaryText
        case .listening:
            return .red
        case .processing:
            return .orange
        case .responding:
            return .blue
        case .error:
            return .red
        }
    }
    
    private var buttonBackground: Color {
        isActive ? AppTheme.accentGreen.opacity(0.2) : Color.clear
    }
    
    private var borderColor: Color {
        isActive ? AppTheme.accentGreen : Color.clear
    }
    
    private var isActive: Bool {
        voiceAgent.state != .idle
    }
    
    private var helpText: String {
        if !voiceAgent.isEnabled {
            return "Voice agent is disabled"
        }
        
        switch voiceAgent.state {
        case .idle:
            return "Start voice input"
        case .listening:
            return "Listening for voice input"
        case .processing:
            return "Processing speech"
        case .responding:
            return "AI is responding"
        case .error(let message):
            return "Error: \(message)"
        }
    }
}

// MARK: - Voice Activity Indicator
struct VoiceActivityIndicator: View {
    @ObservedObject var voiceAgent: VoiceAgent
    @State private var animationPhase: CGFloat = 0.0
    
    var body: some View {
        HStack(spacing: 8) {
            // Activity dot
            Circle()
                .fill(activityColor)
                .frame(width: 8, height: 8)
                .scaleEffect(isAnimating ? 1.2 : 1.0)
                .animation(
                    .easeInOut(duration: 0.6)
                    .repeatForever(autoreverses: true),
                    value: isAnimating
                )
            
            // Status text
            Text(statusText)
                .font(.caption)
                .foregroundColor(AppTheme.secondaryText)
                .animation(.easeInOut(duration: 0.3), value: statusText)
        }
        .onChange(of: voiceAgent.state) { _ in
            updateAnimation()
        }
        .onAppear {
            updateAnimation()
        }
    }
    
    private var activityColor: Color {
        switch voiceAgent.state {
        case .idle:
            return AppTheme.tertiaryText
        case .listening:
            return .red
        case .processing:
            return .orange
        case .responding:
            return .blue
        case .error:
            return .red
        }
    }
    
    private var statusText: String {
        switch voiceAgent.state {
        case .idle:
            return "Voice Ready"
        case .listening:
            return "Listening"
        case .processing:
            return "Processing"
        case .responding:
            return "Speaking"
        case .error:
            return "Voice Error"
        }
    }
    
    private var isAnimating: Bool {
        switch voiceAgent.state {
        case .listening, .processing, .responding:
            return true
        default:
            return false
        }
    }
    
    private func updateAnimation() {
        // Trigger animation update
    }
}

// MARK: - Preview
struct VoiceRecordingView_Previews: PreviewProvider {
    static var previews: some View {
        VoiceRecordingView(
            sttService: STTService(),
            voiceAgent: VoiceAgent(
                sttService: STTService(),
                ttsService: TTSService(),
                apiService: APIService()
            ),
            onTranscriptionComplete: { _ in }
        )
        .frame(width: 400, height: 400)
        .background(Color.black)
    }
}