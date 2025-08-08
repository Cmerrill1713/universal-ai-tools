import SwiftUI
import UniformTypeIdentifiers

struct VisionProcessingView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var apiService: APIService

    @State private var selectedImage: NSImage?
    @State private var processingResult = ""
    @State private var isProcessing = false
    @State private var selectedTask = "Object Detection"

    private let visionTasks = [
        "Object Detection",
        "Image Classification",
        "Text Recognition (OCR)",
        "Face Detection",
        "Image Segmentation",
        "Pose Estimation"
    ]

    var body: some View {
        VStack(spacing: 0) {
            // Header
            headerSection

            Divider()

            // Main content
            HStack(spacing: 0) {
                // Left panel - Image and controls
                leftPanel

                Divider()

                // Right panel - Results
                rightPanel
            }
        }
    }

    private var headerSection: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("Vision Processing")
                    .font(.title2)
                    .fontWeight(.bold)

                Text("AI-powered computer vision analysis")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }

            Spacer()

            Button("Gallery") {
                // Show image gallery
            }
            .buttonStyle(.bordered)
        }
        .padding()
    }

    private var leftPanel: some View {
        VStack(spacing: 16) {
            // Task selection
            VStack(alignment: .leading, spacing: 8) {
                Text("Vision Task")
                    .font(.headline)

                Picker("Task", selection: $selectedTask) {
                    ForEach(visionTasks, id: \.self) { task in
                        Text(task).tag(task)
                    }
                }
                .pickerStyle(MenuPickerStyle())
            }
            .padding()
            .background(Color(NSColor.controlBackgroundColor))
            .cornerRadius(8)

            // Image display
            VStack(alignment: .leading, spacing: 8) {
                Text("Input Image")
                    .font(.headline)

                ZStack {
                    RoundedRectangle(cornerRadius: 8)
                        .fill(Color(NSColor.controlBackgroundColor))
                        .frame(height: 300)

                    if let image = selectedImage {
                        Image(nsImage: image)
                            .resizable()
                            .aspectRatio(contentMode: .fit)
                            .frame(maxHeight: 280)
                            .cornerRadius(6)
                    } else {
                        VStack(spacing: 12) {
                            Image(systemName: "photo")
                                .font(.system(size: 48))
                                .foregroundColor(.secondary)

                            Text("No image selected")
                                .font(.subheadline)
                                .foregroundColor(.secondary)

                            Button("Select Image") {
                                selectImage()
                            }
                            .buttonStyle(.borderedProminent)
                        }
                    }
                }

                HStack {
                    Button("Select Image") {
                        selectImage()
                    }
                    .buttonStyle(.bordered)

                    Button("Clear") {
                        selectedImage = nil
                        processingResult = ""
                    }
                    .buttonStyle(.bordered)

                    Spacer()
                }
            }

            // Processing controls
            VStack(alignment: .leading, spacing: 8) {
                Text("Processing")
                    .font(.headline)

                HStack {
                    Button(isProcessing ? "Stop Processing" : "Process Image") {
                        if isProcessing {
                            stopProcessing()
                        } else {
                            startProcessing()
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(selectedImage == nil)

                    Spacer()

                    if isProcessing {
                        ProgressView()
                            .scaleEffect(0.8)
                    }
                }
            }
            .padding()
            .background(Color(NSColor.controlBackgroundColor))
            .cornerRadius(8)

            Spacer()
        }
        .padding()
        .frame(width: 400)
    }

    private var rightPanel: some View {
        VStack(spacing: 16) {
            // Results header
            HStack {
                Text("Processing Results")
                    .font(.headline)

                Spacer()

                Button("Export") {
                    exportResults()
                }
                .buttonStyle(.bordered)
                .disabled(processingResult.isEmpty)
            }

            // Results display
            VStack(alignment: .leading, spacing: 12) {
                if !processingResult.isEmpty {
                    ScrollView {
                        Text(processingResult)
                            .font(.system(.body, design: .monospaced))
                            .textSelection(.enabled)
                    }
                    .frame(maxHeight: .infinity)
                    .padding()
                    .background(Color(NSColor.controlBackgroundColor))
                    .cornerRadius(8)
                } else {
                    VStack(spacing: 12) {
                        Image(systemName: "doc.text")
                            .font(.system(size: 48))
                            .foregroundColor(.secondary)

                        Text("No results yet")
                            .font(.subheadline)
                            .foregroundColor(.secondary)

                        Text("Process an image to see results here")
                            .font(.caption)
                            .foregroundColor(.secondary)
                            .multilineTextAlignment(.center)
                    }
                    .frame(maxHeight: .infinity)
                }
            }

            // Processing info
            if isProcessing {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Processing Info")
                        .font(.subheadline)
                        .fontWeight(.medium)

                    HStack {
                        Text("Task:")
                        Spacer()
                        Text(selectedTask)
                            .foregroundColor(.secondary)
                    }

                    HStack {
                        Text("Model:")
                        Spacer()
                        Text("YOLOv8")
                            .foregroundColor(.secondary)
                    }

                    HStack {
                        Text("Confidence:")
                        Spacer()
                        Text("0.85")
                            .foregroundColor(.green)
                    }
                }
                .padding()
                .background(Color(NSColor.controlBackgroundColor))
                .cornerRadius(8)
            }
        }
        .padding()
    }

    private func selectImage() {
        let panel = NSOpenPanel()
        panel.allowsMultipleSelection = false
        panel.canChooseDirectories = false
        panel.canChooseFiles = true
        panel.allowedContentTypes = [UTType.image]

        if panel.runModal() == .OK {
            if let url = panel.url {
                selectedImage = NSImage(contentsOf: url)
            }
        }
    }

    private func startProcessing() {
        isProcessing = true

        // Simulate processing
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
            isProcessing = false
            processingResult = generateSampleResult()
        }
    }

    private func stopProcessing() {
        isProcessing = false
    }

    private func exportResults() {
        let panel = NSSavePanel()
        panel.allowedContentTypes = [UTType.plainText]
        panel.nameFieldStringValue = "vision_results.txt"

        if panel.runModal() == .OK {
            if let url = panel.url {
                try? processingResult.write(to: url, atomically: true, encoding: .utf8)
            }
        }
    }

    private func generateSampleResult() -> String {
        switch selectedTask {
        case "Object Detection":
            return """
            Objects Detected:
            - person (confidence: 0.92, bbox: [120, 45, 180, 320])
            - chair (confidence: 0.87, bbox: [200, 150, 280, 250])
            - laptop (confidence: 0.78, bbox: [300, 200, 380, 280])

            Total objects: 3
            Processing time: 1.2s
            """
        case "Image Classification":
            return """
            Classification Results:
            - office (confidence: 0.89)
            - indoor (confidence: 0.85)
            - workspace (confidence: 0.76)
            - modern (confidence: 0.72)

            Top prediction: office
            Confidence: 89%
            """
        case "Text Recognition (OCR)":
            return """
            Extracted Text:
            "Universal AI Tools"
            "Version 1.0.0"
            "Computer Vision Module"

            Total characters: 45
            Confidence: 94%
            """
        default:
            return "Processing completed successfully.\nResults available for \(selectedTask)."
        }
    }
}

#Preview {
    VisionProcessingView()
        .environmentObject(AppState())
        .environmentObject(APIService())
}
