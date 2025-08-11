import SwiftUI

struct AboutView: View {
    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: "brain")
                .font(.system(size: 48))
                .foregroundColor(.accentColor)

            Text("Universal AI Tools")
                .font(.title2)
                .fontWeight(.bold)

            Text("Version 1.0.0")
                .font(.subheadline)
                .foregroundColor(.secondary)

            Divider()

            Text("A macOS companion for orchestrating and monitoring Universal AI Tools.")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)

            Spacer()

            HStack(spacing: 12) {
                Link("Website", destination: URL(string: "https://github.com/Cmerrill1713/universal-ai-tools")!)
                Link("Docs", destination: URL(string: "https://github.com/Cmerrill1713/universal-ai-tools/tree/main/docs")!)
                Link("Releases", destination: URL(string: "https://github.com/Cmerrill1713/universal-ai-tools/releases")!)
            }
            .font(.caption)
        }
        .frame(width: 360, height: 300)
        .padding()
    }
}

#Preview {
    AboutView()
}


