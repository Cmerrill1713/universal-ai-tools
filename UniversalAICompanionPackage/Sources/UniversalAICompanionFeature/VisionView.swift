import SwiftUI
import AVFoundation

/// Main vision view with camera preview and analysis results
struct VisionView: View {
    @State private var visionService = VisionService()
    @State private var showAnalysisResults = false
    @State private var showImagePicker = false
    @State private var selectedImage: UIImage?
    @State private var isFlashEnabled = false
    
    var body: some View {
        ZStack {
            // Camera preview
            CameraPreviewView(visionService: visionService)
                .ignoresSafeArea()
            
            // UI overlay
            VStack {
                // Top bar
                topBar
                
                Spacer()
                
                // Analysis results overlay
                if showAnalysisResults, let results = visionService.analysisResults {
                    analysisOverlay(results)
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                }
                
                // Bottom controls
                bottomControls
            }
        }
        .task {
            do {
                try await visionService.setupCamera()
            } catch {
                print("Camera setup failed: \(error)")
            }
        }
        .onDisappear {
            visionService.stopCamera()
        }
        .sheet(isPresented: $showImagePicker) {
            ImagePicker(image: $selectedImage)
        }
        .onChange(of: selectedImage) { _, newImage in
            if let image = newImage {
                analyzeSelectedImage(image)
            }
        }
    }
    
    // MARK: - UI Components
    
    private var topBar: some View {
        HStack {
            Button(action: { showImagePicker = true }) {
                Image(systemName: "photo.on.rectangle")
                    .font(.title2)
                    .foregroundColor(.white)
                    .padding()
                    .background(Circle().fill(.black.opacity(0.5)))
            }
            
            Spacer()
            
            if visionService.isProcessing {
                ProgressView()
                    .tint(.white)
                    .padding()
                    .background(Circle().fill(.black.opacity(0.5)))
            }
            
            Spacer()
            
            Button(action: toggleFlash) {
                Image(systemName: isFlashEnabled ? "bolt.fill" : "bolt.slash.fill")
                    .font(.title2)
                    .foregroundColor(.white)
                    .padding()
                    .background(Circle().fill(.black.opacity(0.5)))
            }
        }
        .padding()
    }
    
    private var bottomControls: some View {
        VStack(spacing: 20) {
            // Analysis toggle
            if visionService.capturedImage != nil {
                Button(action: { withAnimation { showAnalysisResults.toggle() } }) {
                    Label(
                        showAnalysisResults ? "Hide Analysis" : "Show Analysis",
                        systemImage: showAnalysisResults ? "eye.slash" : "eye"
                    )
                    .padding(.horizontal, 20)
                    .padding(.vertical, 10)
                    .background(Capsule().fill(.blue))
                    .foregroundColor(.white)
                }
            }
            
            // Capture controls
            HStack(spacing: 40) {
                // Switch camera
                Button(action: switchCamera) {
                    Image(systemName: "camera.rotate")
                        .font(.title)
                        .foregroundColor(.white)
                        .padding()
                        .background(Circle().fill(.black.opacity(0.5)))
                }
                
                // Capture button
                Button(action: capturePhoto) {
                    ZStack {
                        Circle()
                            .fill(.white)
                            .frame(width: 70, height: 70)
                        
                        Circle()
                            .stroke(.white, lineWidth: 3)
                            .frame(width: 80, height: 80)
                    }
                }
                .disabled(visionService.isProcessing)
                
                // Backend integration
                Button(action: sendToBackend) {
                    Image(systemName: "cloud.fill")
                        .font(.title)
                        .foregroundColor(.white)
                        .padding()
                        .background(Circle().fill(.black.opacity(0.5)))
                }
                .disabled(visionService.capturedImage == nil)
            }
        }
        .padding(.bottom, 30)
    }
    
    private func analysisOverlay(_ results: VisionAnalysisResult) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 15) {
                // Objects
                if !results.objects.isEmpty {
                    analysisSection(
                        title: "Objects Detected",
                        icon: "square.dashed",
                        count: results.objects.count
                    )
                }
                
                // Text
                if !results.text.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        analysisSection(
                            title: "Text Recognized",
                            icon: "text.magnifyingglass",
                            count: results.text.count
                        )
                        
                        ForEach(results.text.prefix(3)) { text in
                            Text(text.text)
                                .font(.caption)
                                .foregroundColor(.white.opacity(0.8))
                                .lineLimit(1)
                        }
                    }
                }
                
                // Faces
                if !results.faces.isEmpty {
                    analysisSection(
                        title: "Faces Detected",
                        icon: "person.crop.square",
                        count: results.faces.count
                    )
                }
                
                // Barcodes
                if !results.barcodes.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        analysisSection(
                            title: "Barcodes Found",
                            icon: "barcode",
                            count: results.barcodes.count
                        )
                        
                        ForEach(results.barcodes.prefix(2)) { barcode in
                            Text(barcode.payload)
                                .font(.caption2)
                                .foregroundColor(.white.opacity(0.8))
                                .lineLimit(1)
                        }
                    }
                }
            }
            .padding()
            .background(
                RoundedRectangle(cornerRadius: 15)
                    .fill(.ultraThinMaterial)
            )
        }
        .frame(maxHeight: 300)
        .padding()
    }
    
    private func analysisSection(title: String, icon: String, count: Int) -> some View {
        HStack {
            Image(systemName: icon)
                .foregroundColor(.blue)
            
            Text(title)
                .font(.headline)
            
            Spacer()
            
            Text("\(count)")
                .font(.caption)
                .padding(.horizontal, 8)
                .padding(.vertical, 2)
                .background(Capsule().fill(.blue.opacity(0.2)))
        }
        .foregroundColor(.white)
    }
    
    // MARK: - Actions
    
    private func capturePhoto() {
        visionService.capturePhoto()
        
        // Haptic feedback
        let impact = UIImpactFeedbackGenerator(style: .medium)
        impact.impactOccurred()
    }
    
    private func switchCamera() {
        Task {
            try? await visionService.switchCamera()
        }
    }
    
    private func toggleFlash() {
        isFlashEnabled.toggle()
        // TODO: Implement flash control in VisionService
    }
    
    private func analyzeSelectedImage(_ image: UIImage) {
        Task {
            do {
                _ = try await visionService.analyzeImage(image)
                visionService.capturedImage = image
                showAnalysisResults = true
            } catch {
                print("Analysis failed: \(error)")
            }
        }
    }
    
    private func sendToBackend() {
        guard let image = visionService.capturedImage else { return }
        
        Task {
            await BackendIntegration.shared.sendImageForAnalysis(image)
        }
    }
}

// MARK: - Camera Preview

struct CameraPreviewView: UIViewRepresentable {
    let visionService: VisionService
    
    func makeUIView(context: Context) -> UIView {
        let view = UIView(frame: .zero)
        view.backgroundColor = .black
        
        if let previewLayer = visionService.previewLayer {
            previewLayer.frame = view.bounds
            view.layer.addSublayer(previewLayer)
        }
        
        return view
    }
    
    func updateUIView(_ uiView: UIView, context: Context) {
        if let previewLayer = visionService.previewLayer {
            DispatchQueue.main.async {
                previewLayer.frame = uiView.bounds
            }
        }
    }
}

// MARK: - Image Picker

struct ImagePicker: UIViewControllerRepresentable {
    @Binding var image: UIImage?
    @Environment(\.dismiss) private var dismiss
    
    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.delegate = context.coordinator
        picker.sourceType = .photoLibrary
        return picker
    }
    
    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}
    
    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }
    
    class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let parent: ImagePicker
        
        init(_ parent: ImagePicker) {
            self.parent = parent
        }
        
        func imagePickerController(_ picker: UIImagePickerController, 
                                  didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey : Any]) {
            if let uiImage = info[.originalImage] as? UIImage {
                parent.image = uiImage
            }
            parent.dismiss()
        }
        
        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            parent.dismiss()
        }
    }
}

// MARK: - Preview

#Preview {
    VisionView()
}