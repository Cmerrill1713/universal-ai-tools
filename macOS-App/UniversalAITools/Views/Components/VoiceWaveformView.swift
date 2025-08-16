import SwiftUI

// MARK: - Voice Waveform View
struct VoiceWaveformView: View {
    let waveformData: [Float]
    let isRecording: Bool
    
    @State private var animationPhase: CGFloat = 0
    
    var body: some View {
        HStack(alignment: .center, spacing: 2) {
            ForEach(0..<waveformData.count, id: \.self) { index in
                WaveformBar(
                    height: CGFloat(waveformData[index]),
                    index: index,
                    isRecording: isRecording,
                    animationPhase: animationPhase
                )
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(.ultraThinMaterial)
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .stroke(isRecording ? Color.red.opacity(0.3) : Color.gray.opacity(0.2), lineWidth: 1)
                )
        )
        .onAppear {
            startAnimation()
        }
        .onChange(of: isRecording) { _, recording in
            if recording {
                startAnimation()
            } else {
                stopAnimation()
            }
        }
    }
    
    private func startAnimation() {
        withAnimation(.linear(duration: 2.0).repeatForever(autoreverses: false)) {
            animationPhase = 360
        }
    }
    
    private func stopAnimation() {
        withAnimation(.easeOut(duration: 0.5)) {
            animationPhase = 0
        }
    }
    
    // MARK: - Performance Optimized Methods
    
    private func setupDisplayData() {
        // Limit bars for performance
        let maxBars = 50
        if waveformData.count > maxBars {
            displayData = downsampleData(waveformData, to: maxBars)
        } else {
            displayData = waveformData
        }
    }
    
    private func downsampleData(_ data: [Float], to count: Int) -> [Float] {
        let step = data.count / count
        return stride(from: 0, to: data.count, by: step).compactMap { i in
            data.indices.contains(i) ? data[i] : nil
        }
    }
}

// MARK: - Waveform Bar
struct WaveformBar: View {
    let height: CGFloat
    let index: Int
    let isRecording: Bool
    let animationPhase: CGFloat
    
    private var barHeight: CGFloat {
        let baseHeight = max(2, height * 40) // Scale to view height
        
        if isRecording {
            // Add animation effect
            let animationOffset = sin((animationPhase + CGFloat(index) * 10) * .pi / 180) * 10
            return baseHeight + animationOffset
        }
        
        return baseHeight
    }
    
    private var barColor: Color {
        if isRecording {
            return Color.red.opacity(0.7 + Double(height) * 0.3)
        } else {
            return Color.gray.opacity(0.5)
        }
    }
    
    var body: some View {
        RoundedRectangle(cornerRadius: 1)
            .fill(barColor)
            .frame(width: 3, height: barHeight)
            .animation(.easeInOut(duration: 0.1), value: barHeight)
    }
}

// MARK: - Voice Status Indicator
struct VoiceStatusIndicator: View {
    let status: STTRecognitionState
    
    var body: some View {
        HStack(spacing: 8) {
            statusIcon
            
            Text(status.description)
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(.ultraThinMaterial)
        .cornerRadius(16)
    }
    
    private var statusIcon: some View {
        Group {
            switch status {
            case .idle:
                Image(systemName: "mic.slash")
                    .foregroundColor(.gray)
            case .listening:
                Image(systemName: "mic.fill")
                    .foregroundColor(.red)
                    .scaleEffect(1.1)
                    .animation(.easeInOut(duration: 0.5).repeatForever(autoreverses: true), value: status)
            case .processing:
                Image(systemName: "waveform")
                    .foregroundColor(.orange)
            case .completed:
                Image(systemName: "checkmark.circle")
                    .foregroundColor(.green)
            case .error:
                Image(systemName: "exclamationmark.triangle")
                    .foregroundColor(.red)
            }
        }
        .font(.caption)
    }
}

// MARK: - Voice Confidence Meter
struct VoiceConfidenceMeter: View {
    let confidence: Double
    
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Confidence")
                .font(.caption2)
                .foregroundColor(.secondary)
            
            ProgressView(value: confidence, total: 1.0)
                .progressViewStyle(LinearProgressViewStyle(tint: confidenceColor))
                .frame(height: 4)
            
            Text("\(Int(confidence * 100))%")
                .font(.caption2)
                .foregroundColor(.secondary)
        }
        .frame(width: 80)
    }
    
    private var confidenceColor: Color {
        if confidence > 0.8 {
            return .green
        } else if confidence > 0.6 {
            return .orange
        } else {
            return .red
        }
    }
}

// MARK: - Voice Input Visualization
struct VoiceInputVisualization: View {
    let isListening: Bool
    let amplitude: Double
    
    @State private var pulseScale: CGFloat = 1.0
    
    var body: some View {
        ZStack {
            // Outer ring
            Circle()
                .stroke(
                    LinearGradient(
                        colors: [.red.opacity(0.3), .red.opacity(0.1)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    lineWidth: 2
                )
                .frame(width: 100, height: 100)
                .scaleEffect(pulseScale)
                .opacity(isListening ? 1.0 : 0.3)
            
            // Inner circle
            Circle()
                .fill(
                    LinearGradient(
                        colors: [.red.opacity(0.8), .red.opacity(0.6)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .frame(width: 60, height: 60)
                .scaleEffect(1.0 + CGFloat(amplitude) * 0.2)
                .opacity(isListening ? 1.0 : 0.5)
            
            // Microphone icon
            Image(systemName: "mic.fill")
                .font(.title)
                .foregroundColor(.white)
        }
        .onAppear {
            startPulseAnimation()
        }
        .onChange(of: isListening) { _, listening in
            if listening {
                startPulseAnimation()
            } else {
                stopPulseAnimation()
            }
        }
    }
    
    private func startPulseAnimation() {
        withAnimation(.easeInOut(duration: 1.5).repeatForever(autoreverses: true)) {
            pulseScale = 1.2
        }
    }
    
    private func stopPulseAnimation() {
        withAnimation(.easeOut(duration: 0.5)) {
            pulseScale = 1.0
        }
    }
}

// MARK: - Preview
struct VoiceWaveformView_Previews: PreviewProvider {
    static var previews: some View {
        VStack(spacing: 20) {
            VoiceWaveformView(
                waveformData: Array(0..<50).map { _ in Float.random(in: 0.1...1.0) },
                isRecording: true
            )
            .frame(height: 60)
            
            VoiceStatusIndicator(status: .listening)
            
            VoiceConfidenceMeter(confidence: 0.85)
            
            VoiceInputVisualization(isListening: true, amplitude: 0.7)
        }
        .padding()
        .background(Color(.windowBackgroundColor))
    }
}
