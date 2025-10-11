import SwiftUI
import UniformTypeIdentifiers

struct ImagePicker: View {
    @Binding var isPresented: Bool
    let onImageSelected: (Data) -> Void
    
    var body: some View {
        VStack(spacing: 20) {
            Text("Select Image Source")
                .font(.headline)
            
            HStack(spacing: 20) {
                Button(action: { selectFromFiles() }) {
                    VStack {
                        Image(systemName: "photo.on.rectangle")
                            .font(.system(size: 40))
                        Text("Choose File")
                    }
                }
                .buttonStyle(.bordered)
                
                Button(action: { takeScreenshot() }) {
                    VStack {
                        Image(systemName: "camera.viewfinder")
                            .font(.system(size: 40))
                        Text("Screenshot")
                    }
                }
                .buttonStyle(.bordered)
            }
            
            Button("Cancel") {
                isPresented = false
            }
            .buttonStyle(.plain)
        }
        .padding(30)
        .frame(width: 300, height: 200)
    }
    
    private func selectFromFiles() {
        let panel = NSOpenPanel()
        panel.allowsMultipleSelection = false
        panel.canChooseDirectories = false
        panel.allowedContentTypes = [.image, .png, .jpeg]
        
        if panel.runModal() == .OK, let url = panel.url {
            if let data = try? Data(contentsOf: url) {
                onImageSelected(data)
                isPresented = false
            }
        }
    }
    
    private func takeScreenshot() {
        // Take screenshot and get image data
        let task = Process()
        task.executableURL = URL(fileURLWithPath: "/usr/sbin/screencapture")
        let tempFile = "/tmp/neuroforge_screenshot_\(UUID().uuidString).png"
        task.arguments = ["-i", tempFile] // -i for interactive selection
        
        try? task.run()
        task.waitUntilExit()
        
        if let data = try? Data(contentsOf: URL(fileURLWithPath: tempFile)) {
            onImageSelected(data)
            try? FileManager.default.removeItem(atPath: tempFile)
            isPresented = false
        }
    }
}

