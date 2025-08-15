import SwiftUI
import AVFoundation

// MARK: - TTS Controls Panel
struct TTSControlsPanel: View {
    @ObservedObject var ttsService: TTSService
    @State private var showVoiceSelector = false
    @State private var isExpanded = false
    
    var body: some View {
        VStack(spacing: 16) {
            // Header with toggle
            HStack {
                HStack(spacing: 8) {
                    Image(systemName: "speaker.wave.2.fill")
                        .foregroundColor(ttsService.isEnabled ? AppTheme.accentGreen : AppTheme.tertiaryText)
                        .font(.system(size: 16, weight: .medium))
                    
                    Text("Text-to-Speech")
                        .font(.headline)
                        .foregroundColor(AppTheme.primaryText)
                }
                
                Spacer()
                
                // Enable/Disable Toggle
                Toggle("", isOn: .init(
                    get: { ttsService.isEnabled },
                    set: { _ in ttsService.toggleEnabled() }
                ))
                .toggleStyle(SwitchToggleStyle(tint: AppTheme.accentGreen))
                .scaleEffect(0.8)
                
                // Expand/Collapse Button
                Button(action: { 
                    withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
                        isExpanded.toggle()
                    }
                }) {
                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(AppTheme.secondaryText)
                }
                .buttonStyle(.plain)
            }
            
            if isExpanded && ttsService.isEnabled {
                VStack(spacing: 12) {
                    // Voice Selection
                    voiceSelector
                    
                    // Volume Control
                    volumeControl
                    
                    // Speed Control
                    speedControl
                    
                    // Playback Controls
                    playbackControls
                }
                .transition(.asymmetric(
                    insertion: .scale.combined(with: .opacity),
                    removal: .scale.combined(with: .opacity)
                ))
            }
        }
        .padding(16)
        .background(
            ZStack {
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(.ultraThinMaterial)
                
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(
                        LinearGradient(
                            colors: [
                                Color.white.opacity(0.3),
                                Color.white.opacity(0.1)
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        lineWidth: 1
                    )
            }
        )
        .glow(color: ttsService.isEnabled ? AppTheme.accentGreen : .clear, radius: ttsService.isEnabled ? 4 : 0)
        .onAppear {
            // Auto-expand if TTS is actively playing
            if case .playing = ttsService.playbackState {
                isExpanded = true
            }
        }
        .onChange(of: ttsService.playbackState) { state in
            // Auto-expand when playback starts
            if case .playing = state, !isExpanded {
                withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
                    isExpanded = true
                }
            }
        }
    }
    
    // MARK: - Voice Selector
    private var voiceSelector: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Voice")
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .foregroundColor(AppTheme.primaryText)
                
                Spacer()
                
                Button(action: { showVoiceSelector.toggle() }) {
                    HStack(spacing: 4) {
                        Text(ttsService.selectedVoice?.name ?? "Select Voice")
                            .font(.subheadline)
                            .foregroundColor(AppTheme.secondaryText)
                        
                        Image(systemName: "chevron.down")
                            .font(.caption)
                            .foregroundColor(AppTheme.tertiaryText)
                            .rotationEffect(.degrees(showVoiceSelector ? 180 : 0))
                    }
                }
                .buttonStyle(.plain)
            }
            
            if showVoiceSelector {
                ScrollView {
                    LazyVStack(spacing: 8) {
                        ForEach(ttsService.availableVoices) { voice in
                            VoiceSelectionRow(
                                voice: voice,
                                isSelected: voice.id == ttsService.selectedVoice?.id,
                                onSelect: {
                                    ttsService.setVoice(voice)
                                    withAnimation(.easeInOut(duration: 0.2)) {
                                        showVoiceSelector = false
                                    }
                                }
                            )
                        }
                    }
                }
                .frame(maxHeight: 200)
                .transition(.scale.combined(with: .opacity))
            }
        }
        .animation(.easeInOut(duration: 0.2), value: showVoiceSelector)
    }
    
    // MARK: - Volume Control
    private var volumeControl: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "speaker.fill")
                    .font(.caption)
                    .foregroundColor(AppTheme.secondaryText)
                
                Text("Volume")
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .foregroundColor(AppTheme.primaryText)
                
                Spacer()
                
                Text("\(Int(ttsService.volume * 100))%")
                    .font(.caption)
                    .foregroundColor(AppTheme.tertiaryText)
            }
            
            Slider(
                value: .init(
                    get: { ttsService.volume },
                    set: { ttsService.setVolume($0) }
                ),
                in: 0...1
            )
            .accentColor(AppTheme.accentGreen)
        }
    }
    
    // MARK: - Speed Control
    private var speedControl: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "speedometer")
                    .font(.caption)
                    .foregroundColor(AppTheme.secondaryText)
                
                Text("Speed")
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .foregroundColor(AppTheme.primaryText)
                
                Spacer()
                
                Text("\(String(format: "%.1f", ttsService.playbackSpeed))x")
                    .font(.caption)
                    .foregroundColor(AppTheme.tertiaryText)
            }
            
            Slider(
                value: .init(
                    get: { ttsService.playbackSpeed },
                    set: { ttsService.setPlaybackSpeed($0) }
                ),
                in: 0.5...2.0,
                step: 0.1
            )
            .accentColor(AppTheme.accentGreen)
        }
    }
    
    // MARK: - Playback Controls
    private var playbackControls: some View {
        VStack(spacing: 12) {
            // Progress Bar
            if case .playing = ttsService.playbackState {
                VStack(spacing: 4) {
                    HStack {
                        Text("Playing")
                            .font(.caption)
                            .foregroundColor(AppTheme.secondaryText)
                        
                        Spacer()
                        
                        Text("\(Int(ttsService.playbackProgress * 100))%")
                            .font(.caption)
                            .foregroundColor(AppTheme.tertiaryText)
                    }
                    
                    ProgressView(value: ttsService.playbackProgress)
                        .progressViewStyle(LinearProgressViewStyle(tint: AppTheme.accentGreen))
                        .scaleEffect(y: 0.5)
                }
            }
            
            // Control Buttons
            HStack(spacing: 16) {
                // Play/Pause Button
                Button(action: {
                    switch ttsService.playbackState {
                    case .playing:
                        ttsService.pausePlayback()
                    case .paused:
                        ttsService.resumePlayback()
                    default:
                        break
                    }
                }) {
                    Image(systemName: playPauseIcon)
                        .font(.system(size: 16, weight: .medium))
                        .foregroundColor(.white)
                        .frame(width: 36, height: 36)
                        .background(AppTheme.accentGreen.gradient)
                        .clipShape(Circle())
                        .glow(color: AppTheme.accentGreen, radius: 4)
                }
                .buttonStyle(.plain)
                .disabled(!canPlayPause)
                .opacity(canPlayPause ? 1.0 : 0.5)
                
                // Stop Button
                Button(action: {
                    ttsService.stopPlayback()
                }) {
                    Image(systemName: "stop.fill")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(.white)
                        .frame(width: 32, height: 32)
                        .background(Color.red.gradient)
                        .clipShape(Circle())
                        .glow(color: .red, radius: 3)
                }
                .buttonStyle(.plain)
                .disabled(!canStop)
                .opacity(canStop ? 1.0 : 0.5)
                
                Spacer()
                
                // Status Indicator
                statusIndicator
            }
        }
    }
    
    // MARK: - Status Indicator
    private var statusIndicator: some View {
        HStack(spacing: 6) {
            Circle()
                .fill(statusColor)
                .frame(width: 6, height: 6)
                .scaleEffect(isAnimating ? 1.2 : 1.0)
                .animation(.easeInOut(duration: 0.6).repeatForever(autoreverses: true), value: isAnimating)
                .onAppear {
                    updateAnimation()
                }
                .onChange(of: ttsService.playbackState) { _ in
                    updateAnimation()
                }
            
            Text(statusText)
                .font(.caption)
                .foregroundColor(AppTheme.secondaryText)
        }
    }
    
    // MARK: - Computed Properties
    private var playPauseIcon: String {
        switch ttsService.playbackState {
        case .playing:
            return "pause.fill"
        case .paused:
            return "play.fill"
        default:
            return "play.fill"
        }
    }
    
    private var canPlayPause: Bool {
        switch ttsService.playbackState {
        case .playing, .paused:
            return true
        default:
            return false
        }
    }
    
    private var canStop: Bool {
        switch ttsService.playbackState {
        case .playing, .paused:
            return true
        default:
            return false
        }
    }
    
    private var statusColor: Color {
        switch ttsService.playbackState {
        case .idle:
            return AppTheme.tertiaryText
        case .loading:
            return .orange
        case .playing:
            return AppTheme.accentGreen
        case .paused:
            return .yellow
        case .error:
            return .red
        }
    }
    
    private var statusText: String {
        switch ttsService.playbackState {
        case .idle:
            return "Ready"
        case .loading:
            return "Loading..."
        case .playing:
            return "Playing"
        case .paused:
            return "Paused"
        case .error(let message):
            return "Error: \(message)"
        }
    }
    
    private var isAnimating: Bool {
        switch ttsService.playbackState {
        case .loading, .playing:
            return true
        default:
            return false
        }
    }
    
    @State private var shouldAnimate = false
    
    private func updateAnimation() {
        shouldAnimate = isAnimating
    }
}

// MARK: - Voice Selection Row
struct VoiceSelectionRow: View {
    let voice: TTSVoice
    let isSelected: Bool
    let onSelect: () -> Void
    
    var body: some View {
        Button(action: onSelect) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(voice.name)
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .foregroundColor(AppTheme.primaryText)
                    
                    HStack(spacing: 8) {
                        Text(voice.gender.displayName)
                            .font(.caption)
                            .foregroundColor(AppTheme.tertiaryText)
                        
                        Text("•")
                            .font(.caption)
                            .foregroundColor(AppTheme.tertiaryText)
                        
                        Text(voice.language.uppercased())
                            .font(.caption)
                            .foregroundColor(AppTheme.tertiaryText)
                    }
                    
                    Text(voice.description)
                        .font(.caption2)
                        .foregroundColor(AppTheme.secondaryText)
                        .lineLimit(2)
                }
                
                Spacer()
                
                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(AppTheme.accentGreen)
                        .font(.system(size: 16))
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(isSelected ? AppTheme.accentGreen.opacity(0.1) : Color.clear)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .stroke(
                        isSelected ? AppTheme.accentGreen : Color.clear,
                        lineWidth: 1
                    )
            )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Compact TTS Button
struct CompactTTSButton: View {
    @ObservedObject var ttsService: TTSService
    @State private var showControls = false
    let text: String
    
    var body: some View {
        Button(action: {
            if case .playing = ttsService.playbackState {
                ttsService.stopPlayback()
            } else {
                Task {
                    await ttsService.speak(text: text)
                }
            }
        }) {
            Image(systemName: buttonIcon)
                .font(.system(size: 14, weight: .medium))
                .foregroundColor(buttonColor)
                .frame(width: 24, height: 24)
                .background(
                    Circle()
                        .fill(backgroundColor)
                        .overlay(
                            Circle()
                                .stroke(borderColor, lineWidth: 1)
                        )
                )
                .scaleEffect(isActive ? 1.1 : 1.0)
                .animation(.spring(response: 0.3, dampingFraction: 0.6), value: isActive)
        }
        .buttonStyle(.plain)
        .disabled(!ttsService.isEnabled)
        .opacity(ttsService.isEnabled ? 1.0 : 0.5)
        .help(helpText)
        .contextMenu {
            Button("Settings") {
                showControls.toggle()
            }
            
            if case .playing = ttsService.playbackState {
                Button("Stop") {
                    ttsService.stopPlayback()
                }
            }
        }
        .popover(isPresented: $showControls) {
            TTSControlsPanel(ttsService: ttsService)
                .frame(width: 320, height: 400)
        }
    }
    
    private var buttonIcon: String {
        switch ttsService.playbackState {
        case .loading:
            return "waveform"
        case .playing:
            return "stop.fill"
        default:
            return "speaker.wave.2"
        }
    }
    
    private var buttonColor: Color {
        switch ttsService.playbackState {
        case .loading:
            return .orange
        case .playing:
            return .red
        case .error:
            return .red
        default:
            return AppTheme.secondaryText
        }
    }
    
    private var backgroundColor: Color {
        isActive ? AppTheme.accentGreen.opacity(0.2) : Color.clear
    }
    
    private var borderColor: Color {
        isActive ? AppTheme.accentGreen : Color.clear
    }
    
    private var isActive: Bool {
        switch ttsService.playbackState {
        case .loading, .playing:
            return true
        default:
            return false
        }
    }
    
    private var helpText: String {
        if !ttsService.isEnabled {
            return "Text-to-speech is disabled"
        }
        
        switch ttsService.playbackState {
        case .loading:
            return "Loading speech..."
        case .playing:
            return "Stop playback"
        default:
            return "Read message aloud"
        }
    }
}

// MARK: - Preview
struct TTSControlsPanel_Previews: PreviewProvider {
    static var previews: some View {
        TTSControlsPanel(ttsService: TTSService())
            .frame(width: 350, height: 500)
            .background(Color.black)
    }
}