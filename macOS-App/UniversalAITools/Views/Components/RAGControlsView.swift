import SwiftUI

struct RAGControlsView: View {
    @Binding var ragSettings: RAGSettings
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("RAG Controls")
                .font(.headline)
                .fontWeight(.semibold)
            
            Toggle("Enable RAG", isOn: $ragSettings.isEnabled)
            
            if ragSettings.isEnabled {
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text("Max Context")
                        Spacer()
                        Text("\(ragSettings.maxContext)")
                            .foregroundColor(.secondary)
                    }
                    
                    Slider(value: Binding(
                        get: { Double(ragSettings.maxContext) },
                        set: { ragSettings.maxContext = Int($0) }
                    ), in: 1...20, step: 1)
                    
                    Toggle("Include Graph Paths", isOn: $ragSettings.includeGraphPaths)
                    
                    TextField("Project Path", text: $ragSettings.projectPath)
                        .textFieldStyle(.roundedBorder)
                }
            }
        }
        .padding()
        .background(Color.gray.opacity(0.1))
        .cornerRadius(8)
    }
}

#Preview {
    RAGControlsView(ragSettings: .constant(RAGSettings()))
}