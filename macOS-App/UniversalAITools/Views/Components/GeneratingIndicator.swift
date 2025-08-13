import SwiftUI

struct GeneratingIndicator: View {
    @State private var dots = 0

    let timer = Timer.publish(every: 0.5, on: .main, in: .common).autoconnect()

    var body: some View {
        HStack {
            HStack(spacing: 4) {
                ForEach(0..<3) { index in
                    Circle()
                        .fill(Color.secondary)
                        .frame(width: 8, height: 8)
                        .opacity(index < dots ? 1.0 : 0.3)
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Color(NSColor.controlBackgroundColor))
            .cornerRadius(12)

            Spacer()
        }
        .onReceive(timer) { _ in
            withAnimation {
                dots = (dots + 1) % 4
            }
        }
    }
}
