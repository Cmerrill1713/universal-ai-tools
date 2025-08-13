import SwiftUI

struct ChatHeaderView: View {
    @Binding var selectedModel: String
    @Binding var showModelPicker: Bool
    @Binding var showSettings: Bool
    let availableModels: [String]
    let onModelSelect: (String) -> Void
    let onNewChat: () -> Void

    @EnvironmentObject var appState: AppState

    var body: some View {
        HStack(spacing: 12) {
            // Chat Title
            VStack(alignment: .leading, spacing: 4) {
                Text(appState.currentChat?.title ?? "New Chat")
                    .font(.headline)
                    .foregroundColor(AppTheme.primaryText)

                HStack(spacing: 4) {
                    Image(systemName: "cpu")
                        .font(.caption)
                    Text(selectedModel)
                        .font(.caption)
                }
                .foregroundColor(AppTheme.secondaryText)
            }

            Spacer()

            // Model Selector
            Button(action: { showModelPicker.toggle() }) {
                HStack(spacing: 4) {
                    Text(selectedModel)
                        .font(.subheadline)
                    Image(systemName: "chevron.down")
                        .font(.caption)
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(AppTheme.controlBackground)
                .cornerRadius(AppTheme.smallRadius)
            }
            .buttonStyle(BorderlessButtonStyle())
            .popover(isPresented: $showModelPicker) {
                ModelPickerView(
                    selectedModel: $selectedModel,
                    models: availableModels,
                    onSelect: onModelSelect
                )
            }

            Divider()
                .frame(height: 20)

            // Settings Button
            Button(action: { showSettings.toggle() }) {
                Image(systemName: "gearshape")
                    .font(.system(size: 14))
            }
            .buttonStyle(BorderlessButtonStyle())
            .help("Chat Settings")
            .popover(isPresented: $showSettings) {
                ChatSettingsView()
                    .frame(width: 300, height: 400)
            }

            // New Chat Button
            Button(action: onNewChat) {
                Image(systemName: "plus.square")
                    .font(.system(size: 14))
            }
            .buttonStyle(BorderlessButtonStyle())
            .help("New Chat")
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(AppTheme.secondaryBackground)
        .overlay(
            Rectangle()
                .fill(AppTheme.separator)
                .frame(height: 1),
            alignment: .bottom
        )
    }
}
