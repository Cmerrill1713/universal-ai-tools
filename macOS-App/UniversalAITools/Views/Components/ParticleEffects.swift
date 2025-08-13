import SwiftUI

// MARK: - AI Thinking Particle Effect
struct AIThinkingParticles: View {
    @State private var animationTrigger = false

    var body: some View {
        HStack(spacing: 8) {
            ForEach(0..<3) { index in
                Circle()
                    .fill(Color.blue.gradient)
                    .frame(width: 8, height: 8)
                    .scaleEffect(animationTrigger ? 1.0 : 0.5)
                    .opacity(animationTrigger ? 1.0 : 0.3)
                    .animation(
                        Animation.easeInOut(duration: 0.6)
                            .repeatForever(autoreverses: true)
                            .delay(Double(index) * 0.2),
                        value: animationTrigger
                    )
            }
        }
        .frame(width: 200, height: 60)
        .onAppear {
            animationTrigger = true
        }
    }
}

// MARK: - Success Celebration Particles
struct SuccessParticles: View {
    @Binding var isTriggered: Bool
    @State private var particleScale: CGFloat = 0
    @State private var particleOpacity: Double = 1

    var body: some View {
        ZStack {
            ForEach(0..<8) { index in
                Image(systemName: "star.fill")
                    .foregroundColor(Color.yellow)
                    .scaleEffect(particleScale)
                    .opacity(particleOpacity)
                    .offset(
                        x: cos(CGFloat(index) * .pi / 4) * 50,
                        y: sin(CGFloat(index) * .pi / 4) * 50
                    )
            }
        }
        .frame(width: 300, height: 200)
        .onChange(of: isTriggered) { _ in
            if isTriggered {
                withAnimation(.easeOut(duration: 1.0)) {
                    particleScale = 1.5
                    particleOpacity = 0
                }
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                    particleScale = 0
                    particleOpacity = 1
                    isTriggered = false
                }
            }
        }
    }
}

// MARK: - Voice Recording Waveform
struct VoiceWaveform: View {
    @Binding var isRecording: Bool
    @State private var waveHeights: [CGFloat] = Array(repeating: 0.1, count: 12)
    @State private var animationTimer: Timer?

    var body: some View {
        HStack(spacing: 3) {
            ForEach(0..<waveHeights.count, id: \.self) { index in
                RoundedRectangle(cornerRadius: 2)
                    .fill(
                        LinearGradient(
                            gradient: Gradient(colors: [Color.green, Color.blue]),
                            startPoint: .bottom,
                            endPoint: .top
                        )
                    )
                    .frame(width: 4, height: waveHeights[index] * 60)
                    .animation(.easeInOut(duration: 0.3), value: waveHeights[index])
            }
        }
        .frame(height: 60)
        .onAppear {
            if isRecording {
                startWaveAnimation()
            }
        }
        .onDisappear {
            stopWaveAnimation()
        }
        .onChange(of: isRecording) { _ in
            if isRecording {
                startWaveAnimation()
            } else {
                stopWaveAnimation()
            }
        }
    }

    private func startWaveAnimation() {
        animationTimer = Timer.scheduledTimer(withTimeInterval: 0.15, repeats: true) { _ in
                    for waveIndex in 0..<waveHeights.count {
            waveHeights[waveIndex] = CGFloat.random(in: 0.1...1.0)
        }
        }
    }

    private func stopWaveAnimation() {
        animationTimer?.invalidate()
        animationTimer = nil
        for waveIndex in 0..<waveHeights.count {
            waveHeights[waveIndex] = 0.1
        }
    }
}

// MARK: - Loading Dots
struct LoadingDots: View {
    @State private var currentDot = 0
    @State private var timer: Timer?

    var body: some View {
        HStack(spacing: 4) {
            ForEach(0..<3) { index in
                Circle()
                    .fill(Color.blue)
                    .frame(width: 8, height: 8)
                    .scaleEffect(currentDot == index ? 1.3 : 1.0)
                    .opacity(currentDot == index ? 1.0 : 0.5)
            }
        }
        .onAppear {
            startAnimation()
        }
        .onDisappear {
            stopAnimation()
        }
    }

    private func startAnimation() {
        timer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { _ in
            withAnimation(.easeInOut(duration: 0.3)) {
                currentDot = (currentDot + 1) % 3
            }
        }
    }

    private func stopAnimation() {
        timer?.invalidate()
        timer = nil
    }
}

// MARK: - Floating Bubbles Background
struct FloatingBubbles: View {
    @State private var bubbleOffsets: [CGPoint] = []
    @State private var bubbleScales: [CGFloat] = []
    let bubbleCount = 10

    var body: some View {
        GeometryReader { _ in
            ForEach(0..<bubbleCount, id: \.self) { index in
                Circle()
                    .fill(
                        LinearGradient(
                            gradient: Gradient(colors: [
                                Color.blue.opacity(0.3),
                                Color.purple.opacity(0.2)
                            ]),
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 50, height: 50)
                    .scaleEffect(bubbleScales.indices.contains(index) ? bubbleScales[index] : 1.0)
                    .offset(
                        x: bubbleOffsets.indices.contains(index) ? bubbleOffsets[index].x : 0,
                        y: bubbleOffsets.indices.contains(index) ? bubbleOffsets[index].y : 0
                    )
                    .blur(radius: 3)
                    .opacity(0.6)
            }
        }
        .onAppear {
            setupBubbles()
            animateBubbles()
        }
    }

    private func setupBubbles() {
        for _ in 0..<bubbleCount {
            bubbleOffsets.append(
                CGPoint(
                    x: CGFloat.random(in: -200...200),
                    y: CGFloat.random(in: -200...200)
                )
            )
            bubbleScales.append(CGFloat.random(in: 0.5...1.5))
        }
    }

    private func animateBubbles() {
        withAnimation(
            Animation.linear(duration: 20)
                .repeatForever(autoreverses: false)
        ) {
            for index in 0..<bubbleCount {
                bubbleOffsets[index] = CGPoint(
                    x: CGFloat.random(in: -200...200),
                    y: -400
                )
            }
        }
    }
}

// MARK: - Particle Button
struct ParticleButton<Content: View>: View {
    let action: () -> Void
    let content: () -> Content
    @State private var isPressed = false

    init(action: @escaping () -> Void, @ViewBuilder content: @escaping () -> Content) {
        self.action = action
        self.content = content
    }

    var body: some View {
        Button(action: {
            withAnimation(.easeInOut(duration: 0.1)) {
                isPressed = true
            }
            action()
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                isPressed = false
            }
        }) {
            content()
                .scaleEffect(isPressed ? 0.95 : 1.0)
        }
        .buttonStyle(PlainButtonStyle())
    }
}

// MARK: - Connection Pulse
struct ConnectionPulse: View {
    @Binding var isConnected: Bool
    @State private var pulseScale: CGFloat = 1.0
    @State private var pulseOpacity: Double = 0.8

    var body: some View {
        ZStack {
            Circle()
                .fill(isConnected ? Color.green : Color.red)
                .frame(width: 12, height: 12)

            Circle()
                .stroke(isConnected ? Color.green : Color.red, lineWidth: 2)
                .frame(width: 12, height: 12)
                .scaleEffect(pulseScale)
                .opacity(pulseOpacity)
        }
        .onAppear {
            animatePulse()
        }
        .onChange(of: isConnected) { _ in
            animatePulse()
        }
    }

    private func animatePulse() {
        withAnimation(
            Animation.easeOut(duration: 1.5)
                .repeatForever(autoreverses: false)
        ) {
            pulseScale = 2.5
            pulseOpacity = 0
        }
    }
}

// MARK: - Gradient Pulse
struct GradientPulse: View {
    @State private var animateGradient = false
    let colors: [Color]

    init(colors: [Color] = [.blue, .purple, .pink]) {
        self.colors = colors
    }

    var body: some View {
        LinearGradient(
            gradient: Gradient(colors: colors),
            startPoint: animateGradient ? .topLeading : .bottomTrailing,
            endPoint: animateGradient ? .bottomTrailing : .topLeading
        )
        .onAppear {
            withAnimation(
                Animation.linear(duration: 3)
                    .repeatForever(autoreverses: true)
            ) {
                animateGradient.toggle()
            }
        }
    }
}

// MARK: - Typing Indicator
struct TypingIndicator: View {
    @State private var animationPhase = 0
    @State private var timer: Timer?

    var body: some View {
        HStack(spacing: 4) {
            ForEach(0..<3) { index in
                Circle()
                    .fill(Color.gray)
                    .frame(width: 8, height: 8)
                    .offset(y: animationPhase == index ? -5 : 0)
            }
        }
        .onAppear {
            startAnimation()
        }
        .onDisappear {
            stopAnimation()
        }
    }

    private func startAnimation() {
        timer = Timer.scheduledTimer(withTimeInterval: 0.3, repeats: true) { _ in
            withAnimation(.easeInOut(duration: 0.3)) {
                animationPhase = (animationPhase + 1) % 3
            }
        }
    }

    private func stopAnimation() {
        timer?.invalidate()
        timer = nil
    }
}

// MARK: - Preview
struct ParticleEffects_Previews: PreviewProvider {
    static var previews: some View {
        VStack(spacing: 40) {
            AIThinkingParticles()

            SuccessParticles(isTriggered: .constant(true))

            VoiceWaveform(isRecording: .constant(true))

            LoadingDots()

            ConnectionPulse(isConnected: .constant(true))

            TypingIndicator()
        }
        .padding()
        .background(Color.black)
    }
}
