import SwiftUI

struct ShimmerModifier: ViewModifier {
    let duration: Double
    let bounce: Bool

    @State private var phase: CGFloat = -1

    func body(content: Content) -> some View {
        content
            .overlay(
                GeometryReader { geometry in
                    let gradient = LinearGradient(
                        gradient: Gradient(colors: [
                            .clear,
                            Color.white.opacity(0.35),
                            .clear
                        ]),
                        startPoint: .top,
                        endPoint: .bottom
                    )
                    Rectangle()
                        .fill(gradient)
                        .rotationEffect(.degrees(20))
                        .offset(x: geometry.size.width * phase)
                        .frame(width: geometry.size.width * 0.6)
                        .clipped()
                        .allowsHitTesting(false)
                }
                .mask(content)
            )
            .onAppear {
                withAnimation(
                    bounce
                    ? .easeInOut(duration: duration).repeatForever(autoreverses: true)
                    : .linear(duration: duration).repeatForever(autoreverses: false)
                ) {
                    phase = 2
                }
            }
    }
}

extension View {
    func shimmering(active: Bool = true, duration: Double = 1.2, bounce: Bool = false) -> some View {
        Group {
            if active {
                self.modifier(ShimmerModifier(duration: duration, bounce: bounce))
            } else {
                self
            }
        }
    }
}
