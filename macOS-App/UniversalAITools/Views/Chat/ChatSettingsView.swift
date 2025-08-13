import SwiftUI

struct ChatSettingsView: View {
    @AppStorage("maxTokens") private var maxTokens = 2048
    @AppStorage("temperature") private var temperature = 0.7
    @AppStorage("systemPrompt") private var systemPrompt = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Chat Settings")
                .font(.headline)

            Divider()

            VStack(alignment: .leading, spacing: 8) {
                Text("Max Tokens: \(maxTokens)")
                    .font(.subheadline)

                Slider(value: Binding(
                    get: { Double(maxTokens) },
                    set: { maxTokens = Int($0) }
                ), in: 256...8192, step: 256)
            }

            VStack(alignment: .leading, spacing: 8) {
                Text("Temperature: \(String(format: "%.1f", temperature))")
                    .font(.subheadline)

                Slider(value: $temperature, in: 0...2, step: 0.1)
            }

            VStack(alignment: .leading, spacing: 8) {
                Text("System Prompt")
                    .font(.subheadline)

                TextEditor(text: $systemPrompt)
                    .font(.caption)
                    .frame(height: 100)
                    .padding(4)
                    .background(Color(NSColor.controlBackgroundColor))
                    .cornerRadius(4)
            }

            Spacer()
        }
        .padding()
    }
}
