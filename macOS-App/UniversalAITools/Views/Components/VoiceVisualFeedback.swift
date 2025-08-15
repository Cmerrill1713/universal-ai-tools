import SwiftUI

// MARK: - Voice Waveform Visualizer
struct VoiceWaveformVisualizer: View {
    @ObservedObject var sttService: STTService
    @State private var waveformData: [Float] = Array(repeating: 0.0, count: 20)
    @State private var animationPhase: Double = 0.0
    
    var body: some View {
        HStack(spacing: 2) {
            ForEach(0..<waveformData.count, id: \.self) { index in
                RoundedRectangle(cornerRadius: 1)
                    .fill(barColor(for: index))
                    .frame(width: 3, height: barHeight(for: index))
                    .animation(.easeInOut(duration: 0.1), value: waveformData[index])
            }
        }
        .frame(height: 30)
        .onReceive(Timer.publish(every: 0.05, on: .main, in: .common).autoconnect()) {
            _ in updateWaveform()
        }
    }
    
    private func barHeight(for index: Int) -> CGFloat {
        let level = waveformData[index]
        let minHeight: CGFloat = 4
        let maxHeight: CGFloat = 30
        
        // Add wave animation when listening
        let waveEffect = sttService.recognitionState == .listening ? 
            sin(animationPhase + Double(index) * 0.5) * 0.3 : 0.0
        
        let adjustedLevel = max(0, level + Float(waveEffect))
        return minHeight + (maxHeight - minHeight) * CGFloat(adjustedLevel)
    }
    
    private func barColor(for index: Int) -> Color {
        let level = waveformData[index]
        
        switch sttService.recognitionState {
        case .listening:
            return level > 0.3 ? AppTheme.accentGreen : AppTheme.accentGreen.opacity(0.5)
        case .processing:
            return .orange
        case .error:
            return .red
        default:
            return AppTheme.tertiaryText.opacity(0.3)
        }
    }
    
    private func updateWaveform() {
        animationPhase += 0.2
        if animationPhase > 2.0 * .pi {
            animationPhase = 0.0
        }
        
        // Simulate or use real audio level data
        if sttService.recognitionState == .listening {
            // Use real audio level
            let audioLevel = sttService.audioLevel
            
            // Shift existing data
            for i in (1..<waveformData.count).reversed() {
                waveformData[i] = waveformData[i - 1]
            }
            
            // Add new data point
            waveformData[0] = audioLevel * 5.0 // Amplify for visibility
        } else {
            // Fade out when not listening
            for i in 0..<waveformData.count {
                waveformData[i] *= 0.95
            }
        }
    }
}

// MARK: - Voice Status Indicator
struct VoiceStatusIndicator: View {
    let state: VoiceAgentState
    @State private var isAnimating = false
    
    var body: some View {
        HStack(spacing: 8) {
            // Status icon with animation
            ZStack {
                Circle()
                    .fill(backgroundColor)
                    .frame(width: 24, height: 24)
                
                if isAnimating {
                    Circle()
                        .stroke(statusColor, lineWidth: 2)
                        .frame(width: 32, height: 32)
                        .scaleEffect(isAnimating ? 1.5 : 1.0)
                        .opacity(isAnimating ? 0.0 : 1.0)
                        .animation(
                            .easeOut(duration: 1.0)
                            .repeatForever(autoreverses: false),
                            value: isAnimating
                        )
                }
                
                Image(systemName: statusIcon)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(.white)
            }
            
            // Status text
            Text(statusText)
                .font(.caption)
                .fontWeight(.medium)
                .foregroundColor(statusColor)
        }
        .onAppear {
            updateAnimation()
        }
        .onChange(of: state) { _ in
            updateAnimation()
        }
    }
    
    private var statusIcon: String {
        switch state {
        case .idle:
            return "mic.slash"
        case .listening:
            return "mic.fill"
        case .processing:
            return "waveform"
        case .responding:
            return "speaker.wave.2.fill"
        case .error:
            return "exclamationmark.triangle.fill"
        }
    }
    
    private var statusColor: Color {
        switch state {
        case .idle:
            return AppTheme.tertiaryText
        case .listening:
            return .red
        case .processing:
            return .orange
        case .responding:
            return AppTheme.accentGreen
        case .error:
            return .red
        }
    }
    
    private var backgroundColor: Color {
        statusColor.opacity(0.2)
    }
    
    private var statusText: String {
        switch state {
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
    
    private func updateAnimation() {
        withAnimation {
            isAnimating = state == .listening || state == .processing || state == .responding
        }
    }
}

// MARK: - Voice Mode Indicator
struct VoiceModeIndicator: View {
    let mode: VoiceInteractionMode
    let isActive: Bool
    
    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: modeIcon)
                .font(.system(size: 14, weight: .medium))
                .foregroundColor(isActive ? AppTheme.accentGreen : AppTheme.tertiaryText)
            
            Text(mode.displayName)
                .font(.caption)
                .fontWeight(.medium)
                .foregroundColor(isActive ? AppTheme.primaryText : AppTheme.secondaryText)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .fill(isActive ? AppTheme.accentGreen.opacity(0.15) : Color.clear)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .stroke(
                    isActive ? AppTheme.accentGreen : Color.clear,
                    lineWidth: 1
                )
        )
        .scaleEffect(isActive ? 1.05 : 1.0)
        .animation(.spring(response: 0.3, dampingFraction: 0.6), value: isActive)
    }
    
    private var modeIcon: String {
        switch mode {
        case .conversational:
            return "bubble.left.and.bubble.right"
        case .command:
            return "command"
        case .dictation:
            return "doc.text"
        case .assistant:
            return "brain"
        }
    }
}

// MARK: - Voice Confidence Meter
struct VoiceConfidenceMeter: View {
    let confidence: Double
    let isVisible: Bool
    
    var body: some View {
        if isVisible {
            VStack(alignment: .leading, spacing: 4) {
                Text("Confidence")
                    .font(.caption2)
                    .foregroundColor(AppTheme.secondaryText)
                
                HStack(spacing: 2) {
                    ForEach(0..<10, id: \.self) { index in
                        RoundedRectangle(cornerRadius: 1)
                            .fill(barColor(for: index))
                            .frame(width: 3, height: 8)
                    }
                }
                
                Text("\(Int(confidence * 100))%")
                    .font(.caption2)
                    .foregroundColor(confidenceTextColor)
                    .monospacedDigit()
            }
            .transition(.scale.combined(with: .opacity))
        }
    }
    
    private func barColor(for index: Int) -> Color {
        let threshold = Double(index) / 10.0
        
        if confidence >= threshold {
            if confidence > 0.8 {
                return AppTheme.accentGreen
            } else if confidence > 0.6 {
                return .orange
            } else {
                return .red
            }
        } else {
            return AppTheme.tertiaryText.opacity(0.3)
        }
    }
    
    private var confidenceTextColor: Color {
        if confidence > 0.8 {
            return AppTheme.accentGreen
        } else if confidence > 0.6 {
            return .orange
        } else {
            return .red
        }
    }
}

// MARK: - Floating Voice Button
struct FloatingVoiceButton: View {
    @ObservedObject var voiceAgent: VoiceAgent
    @State private var isPressed = false
    @State private var dragOffset = CGSize.zero
    @State private var position = CGPoint(x: 60, y: 60)
    
    let onTap: () -> Void
    
    var body: some View {
        Button(action: onTap) {
            ZStack {
                // Glow effect when active
                if voiceAgent.state != .idle {
                    Circle()
                        .fill(
                            RadialGradient(
                                colors: [statusColor.opacity(0.4), statusColor.opacity(0.0)],
                                center: .center,
                                startRadius: 20,
                                endRadius: 40
                            )
                        )
                        .frame(width: 80, height: 80)
                        .scaleEffect(voiceAgent.state == .listening ? 1.2 : 1.0)
                        .animation(.easeInOut(duration: 0.8).repeatForever(autoreverses: true), value: voiceAgent.state == .listening)
                }
                
                // Main button
                Circle()
                    .fill(buttonGradient)
                    .frame(width: 56, height: 56)
                    .overlay(
                        Circle()
                            .stroke(Color.white.opacity(0.3), lineWidth: 2)
                    )
                    .shadow(color: statusColor.opacity(0.3), radius: 8, x: 0, y: 4)
                
                // Icon
                Image(systemName: buttonIcon)
                    .font(.system(size: 24, weight: .medium))
                    .foregroundColor(.white)
                    .scaleEffect(isPressed ? 0.9 : 1.0)
            }
        }
        .buttonStyle(.plain)
        .scaleEffect(isPressed ? 0.95 : 1.0)
        .animation(.spring(response: 0.3, dampingFraction: 0.6), value: isPressed)
        .position(x: position.x + dragOffset.width, y: position.y + dragOffset.height)
        .gesture(
            DragGesture()
                .onChanged { value in
                    dragOffset = value.translation
                    isPressed = true
                }
                .onEnded { value in
                    position.x += value.translation.x
                    position.y += value.translation.y
                    dragOffset = .zero
                    isPressed = false
                    
                    // Keep button within bounds
                    position.x = max(30, min(position.x, 300))
                    position.y = max(30, min(position.y, 400))
                }
        )
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
            return "exclamationmark.triangle"
        }
    }
    
    private var statusColor: Color {
        switch voiceAgent.state {
        case .idle:
            return AppTheme.accentGreen
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
    
    private var buttonGradient: LinearGradient {
        LinearGradient(
            colors: [statusColor, statusColor.opacity(0.8)],
            startPoint: .top,
            endPoint: .bottom
        )
    }
}

// MARK: - Voice Interaction Timeline
struct VoiceInteractionTimeline: View {
    let interactions: [VoiceInteraction]
    let maxItems: Int = 5
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Recent Voice Interactions")
                .font(.headline)
                .foregroundColor(AppTheme.primaryText)
            
            if interactions.isEmpty {
                Text("No voice interactions yet")
                    .font(.caption)
                    .foregroundColor(AppTheme.secondaryText)
                    .italic()
            } else {
                ForEach(Array(interactions.prefix(maxItems).enumerated()), id: \.element.id) { index, interaction in
                    VoiceInteractionRow(interaction: interaction, isRecent: index == 0)
                }
            }
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

struct VoiceInteractionRow: View {
    let interaction: VoiceInteraction
    let isRecent: Bool
    
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                // Status indicator
                Circle()
                    .fill(interaction.successful ? AppTheme.accentGreen : .red)
                    .frame(width: 6, height: 6)
                
                Text(interaction.userInput)
                    .font(.caption)
                    .foregroundColor(AppTheme.primaryText)
                    .lineLimit(1)
                
                Spacer()
                
                Text(timeAgo(from: interaction.timestamp))
                    .font(.caption2)
                    .foregroundColor(AppTheme.tertiaryText)
            }
            
            if let response = interaction.aiResponse, !response.isEmpty {
                Text(response)
                    .font(.caption2)
                    .foregroundColor(AppTheme.secondaryText)
                    .lineLimit(2)
                    .padding(.leading, 14)
            }
        }
        .padding(.vertical, 4)
        .background(
            RoundedRectangle(cornerRadius: 6, style: .continuous)
                .fill(isRecent ? AppTheme.accentGreen.opacity(0.1) : Color.clear)
        )
    }
    
    private func timeAgo(from date: Date) -> String {
        let interval = Date().timeIntervalSince(date)
        
        if interval < 60 {
            return "now"
        } else if interval < 3600 {
            return "\(Int(interval / 60))m"
        } else {
            return "\(Int(interval / 3600))h"
        }
    }
}

// MARK: - Preview
struct VoiceVisualFeedback_Previews: PreviewProvider {
    static var previews: some View {
        VStack(spacing: 20) {
            VoiceWaveformVisualizer(sttService: STTService())
            
            VoiceStatusIndicator(state: .listening)
            
            VoiceModeIndicator(mode: .conversational, isActive: true)
            
            VoiceConfidenceMeter(confidence: 0.85, isVisible: true)
        }
        .padding()
        .background(Color.black)
    }
}