import SwiftUI

/// Settings view for chat parameters
public struct SimpleSettingsView: View {
    @AppStorage("temperature") private var temperature: Double = 0.7
    @AppStorage("max_tokens") private var maxTokens: Int = 512
    @AppStorage("showDiagnosticsOverlay") private var showDiagnostics: Bool = false
    
    public init() {}
    
    public var body: some View {
        Form {
            Section("Chat Parameters") {
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text("Temperature:")
                        Spacer()
                        Text(String(format: "%.1f", temperature))
                            .foregroundColor(.secondary)
                    }
                    
                    Slider(value: $temperature, in: 0...2, step: 0.1)
                        .accessibilityIdentifier("settings_temperature")
                    
                    Text("Controls randomness: 0 = focused, 2 = creative")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .padding(.vertical, 4)
                
                VStack(alignment: .leading, spacing: 8) {
                    Stepper(value: $maxTokens, in: 1...8192, step: 128) {
                        HStack {
                            Text("Max Tokens:")
                            Spacer()
                            Text("\(maxTokens)")
                                .foregroundColor(.secondary)
                        }
                    }
                    .accessibilityIdentifier("settings_max_tokens")
                    
                    Text("Maximum response length")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .padding(.vertical, 4)
            }
            
            Section("Diagnostics") {
                Toggle("Show Diagnostics Overlay", isOn: $showDiagnostics)
                    .accessibilityIdentifier("settings_show_diagnostics")
                
                Text("Displays real-time network activity")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Section("API Configuration") {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Base URL:")
                        .font(.caption.bold())
                    Text(apiBaseURL().absoluteString)
                        .font(.system(size: 11, design: .monospaced))
                        .textSelection(.enabled)
                        .foregroundColor(.secondary)
                    
                    Text("Change via API_BASE environment variable")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .padding(.vertical, 4)
            }
        }
        .formStyle(.grouped)
        .padding()
    }
}

