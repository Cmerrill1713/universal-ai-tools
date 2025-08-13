import SwiftUI

struct ModelPickerView: View {
    @Binding var selectedModel: String
    let models: [String]
    let onSelect: (String) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Select Model")
                .font(.headline)
                .padding()

            Divider()

            ScrollView {
                VStack(spacing: 0) {
                    ForEach(models, id: \.self) { model in
                        Button(action: { onSelect(model) }, label: {
                            HStack {
                                Image(systemName: "cpu")
                                    .foregroundColor(.secondary)

                                Text(model)
                                    .foregroundColor(.primary)

                                Spacer()

                                if model == selectedModel {
                                    Image(systemName: "checkmark")
                                        .foregroundColor(.accentColor)
                                }
                            }
                            .padding(.horizontal)
                            .padding(.vertical, 8)
                            .contentShape(Rectangle())
                        })
                        .buttonStyle(PlainButtonStyle())
                        .background(
                            model == selectedModel ?
                            Color.accentColor.opacity(0.1) : Color.clear
                        )
                    }
                }
            }
        }
        .frame(width: 250, height: 300)
    }
}
