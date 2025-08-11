import SwiftUI

struct ChatHeaderView: View {
    @Binding var selectedModel: String
    @Binding var showModelPicker: Bool
    @Binding var showSettings: Bool
    @EnvironmentObject var appState: AppState

    let availableModels: [String]
    let onModelSelect: (String) -> Void
    let onNewChat: () -> Void

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(appState.currentChat?.title ?? "New Chat")
                    .font(.headline)

                HStack(spacing: 4) {
                    Image(systemName: "cpu")
                        .font(.caption)
                    Text(selectedModel)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }

            Spacer()

            Button(action: { showModelPicker.toggle() }, label: {
                HStack(spacing: 4) {
                    Text(selectedModel)
                        .font(.subheadline)
                    Image(systemName: "chevron.down")
                        .font(.caption)
                }
            })
            .buttonStyle(BorderlessButtonStyle())
            .popover(isPresented: $showModelPicker, content: {
                ModelPickerView(
                    selectedModel: $selectedModel,
                    models: availableModels,
                    onSelect: { model in
                        onModelSelect(model)
                    }
                )
            })

            Button(action: { showSettings.toggle() }, label: {
                Image(systemName: "gearshape")
            })
            .buttonStyle(BorderlessButtonStyle())
            .popover(isPresented: $showSettings, content: {
                ChatSettingsView()
                    .frame(width: 300, height: 400)
            })

            Button(action: onNewChat, label: {
                Image(systemName: "plus.square")
            })
            .buttonStyle(BorderlessButtonStyle())
        }
        .padding()
    }
}


