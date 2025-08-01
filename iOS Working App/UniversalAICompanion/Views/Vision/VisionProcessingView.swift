import SwiftUI
import AVFoundation
import UIKit

struct VisionProcessingView: View {
    @StateObject private var visionService = VisionService()
    @ObservedObject var authManager: DeviceAuthenticationManager
    @State private var selectedPhotoData: Data?
    @State private var selectedImage: UIImage?
    @State private var showingCamera = false
    @State private var showingImagePicker = false
    @State private var analysisResult: VisionAnalysisResult?
    @State private var isAnalyzing = false
    @State private var showingResultDetail = false
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 20) {
                    // Connection Status
                    HStack {
                        Circle()
                            .fill(visionService.connectionState == .connected ? .green : .red)
                            .frame(width: 12, height: 12)
                        
                        Text(visionService.connectionState == .connected ? "Vision AI Connected" : "Vision AI Disconnected")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        
                        Spacer()
                        
                        Button("Refresh") {
                            Task {
                                await visionService.checkConnection()
                            }
                        }
                        .font(.caption)
                    }
                    .padding()
                    .background(Color.gray.opacity(0.1))
                    .cornerRadius(12)
                    
                    // Image Selection Section
                    VStack(spacing: 16) {
                        Text("Select Image to Analyze")
                            .font(.headline)
                        
                        HStack(spacing: 20) {
                            // Camera Button
                            Button(action: {
                                checkCameraPermission()
                            }) {
                                VStack {
                                    Image(systemName: "camera.fill")
                                        .font(.largeTitle)
                                        .foregroundColor(.blue)
                                    Text("Camera")
                                        .font(.caption)
                                }
                            }
                            .frame(width: 80, height: 80)
                            .background(Color.blue.opacity(0.1))
                            .cornerRadius(12)
                            
                            // Photo Library Button
                            Button(action: {
                                showingImagePicker = true
                            }) {
                                VStack {
                                    Image(systemName: "photo.fill")
                                        .font(.largeTitle)
                                        .foregroundColor(.green)
                                    Text("Photos")
                                        .font(.caption)
                                }
                            }
                            .frame(width: 80, height: 80)
                            .background(Color.green.opacity(0.1))
                            .cornerRadius(12)
                        }
                    }
                    
                    // Selected Image Preview
                    if let image = selectedImage {
                        VStack(spacing: 12) {
                            Text("Selected Image")
                                .font(.headline)
                            
                            Image(uiImage: image)
                                .resizable()
                                .aspectRatio(contentMode: .fit)
                                .frame(maxHeight: 300)
                                .cornerRadius(12)
                                .shadow(radius: 5)
                            
                            HStack(spacing: 16) {
                                Button("Analyze Image") {
                                    Task {
                                        await analyzeImage(image)
                                    }
                                }
                                .buttonStyle(.borderedProminent)
                                .disabled(isAnalyzing || visionService.connectionState != .connected)
                                
                                Button("Clear") {
                                    selectedImage = nil
                                    analysisResult = nil
                                }
                                .buttonStyle(.bordered)
                            }
                            
                            if isAnalyzing {
                                ProgressView("Analyzing image...")
                                    .padding()
                            }
                        }
                    }
                    
                    // Analysis Results
                    if let result = analysisResult {
                        VisionResultCard(result: result, onDetailTap: {
                            showingResultDetail = true
                        })
                    }
                    
                    // Recent Analysis History
                    if !visionService.analysisHistory.isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Recent Analysis")
                                .font(.headline)
                            
                            ForEach(visionService.analysisHistory.prefix(3)) { result in
                                VisionHistoryCard(result: result, onTap: {
                                    analysisResult = result
                                    showingResultDetail = true
                                })
                            }
                            
                            if visionService.analysisHistory.count > 3 {
                                Button("View All History") {
                                    // Navigate to full history view
                                }
                                .font(.caption)
                                .foregroundColor(.blue)
                            }
                        }
                    }
                }
                .padding()
            }
            .navigationTitle("Vision AI")
            .sheet(isPresented: $showingCamera) {
                CameraView(selectedImage: $selectedImage)
            }
            .sheet(isPresented: $showingResultDetail) {
                if let result = analysisResult {
                    VisionResultDetailView(result: result)
                }
            }
            .sheet(isPresented: $showingImagePicker) {
                ImagePicker(image: $selectedImage)
            }
            .onAppear {
                if let token = authManager.authToken {
                    visionService.setAuthToken(token)
                }
            }
        }
    }
    
    private func checkCameraPermission() {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            showingCamera = true
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { granted in
                DispatchQueue.main.async {
                    if granted {
                        showingCamera = true
                    }
                }
            }
        case .denied, .restricted:
            // Show alert to go to settings
            break
        @unknown default:
            break
        }
    }
    
    private func loadImageData(_ data: Data) {
        if let image = UIImage(data: data) {
            selectedImage = image
        }
    }
    
    private func analyzeImage(_ image: UIImage) async {
        isAnalyzing = true
        
        let result = await visionService.analyzeImage(image)
        await MainActor.run {
            analysisResult = result
            isAnalyzing = false
        }
    }
}

struct VisionResultCard: View {
    let result: VisionAnalysisResult
    let onDetailTap: () -> Void
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Analysis Results")
                    .font(.headline)
                
                Spacer()
                
                Button("Details", action: onDetailTap)
                    .font(.caption)
                    .foregroundColor(.blue)
            }
            
            if !result.objects.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Objects Detected:")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                    
                    ForEach(result.objects.prefix(3), id: \.class) { object in
                        HStack {
                            Circle()
                                .fill(Color.blue)
                                .frame(width: 8, height: 8)
                            
                            Text(object.class.capitalized)
                                .font(.body)
                            
                            Spacer()
                            
                            Text("\(Int(object.confidence * 100))%")
                                .font(.caption)
                                .foregroundColor(.green)
                        }
                    }
                    
                    if result.objects.count > 3 {
                        Text("+ \(result.objects.count - 3) more objects")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
            }
            
            if let scene = result.scene {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Scene Analysis:")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                    
                    Text(scene.description)
                        .font(.body)
                        .lineLimit(2)
                    
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack {
                            ForEach(scene.tags, id: \.self) { tag in
                                Text(tag)
                                    .font(.caption)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 4)
                                    .background(Color.blue.opacity(0.2))
                                    .cornerRadius(8)
                            }
                        }
                        .padding(.horizontal, 1)
                    }
                }
            }
            
            HStack {
                Text("Confidence: \(Int(result.confidence * 100))%")
                    .font(.caption)
                    .foregroundColor(.green)
                
                Spacer()
                
                Text("Processing: \(result.processingTimeMs)ms")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding()
        .background(Color.gray.opacity(0.1))
        .cornerRadius(12)
    }
}

struct VisionHistoryCard: View {
    let result: VisionAnalysisResult
    let onTap: () -> Void
    
    var body: some View {
        Button(action: onTap) {
            HStack {
                // Thumbnail placeholder
                RoundedRectangle(cornerRadius: 8)
                    .fill(Color.gray.opacity(0.3))
                    .frame(width: 50, height: 50)
                    .overlay(
                        Image(systemName: "photo")
                            .foregroundColor(.gray)
                    )
                
                VStack(alignment: .leading, spacing: 4) {
                    Text(result.scene?.description ?? "Image Analysis")
                        .font(.subheadline)
                        .lineLimit(1)
                    
                    Text("\(result.objects.count) objects detected")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    
                    Text(result.timestamp, style: .relative)
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
                
                Spacer()
                
                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .buttonStyle(.plain)
        .padding()
        .background(Color.gray.opacity(0.05))
        .cornerRadius(8)
    }
}

struct VisionResultDetailView: View {
    let result: VisionAnalysisResult
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    // Complete object list
                    if !result.objects.isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Detected Objects")
                                .font(.headline)
                            
                            ForEach(result.objects, id: \.class) { object in
                                VStack(alignment: .leading, spacing: 4) {
                                    HStack {
                                        Text(object.class.capitalized)
                                            .font(.subheadline)
                                            .fontWeight(.medium)
                                        
                                        Spacer()
                                        
                                        Text("\(Int(object.confidence * 100))%")
                                            .font(.caption)
                                            .foregroundColor(.green)
                                    }
                                    
                                    Text("Location: x:\(Int(object.bbox.x)), y:\(Int(object.bbox.y)), \(Int(object.bbox.width))×\(Int(object.bbox.height))")
                                        .font(.caption2)
                                        .foregroundColor(.secondary)
                                }
                                .padding()
                                .background(Color.gray.opacity(0.1))
                                .cornerRadius(8)
                            }
                        }
                    }
                    
                    // Scene analysis
                    if let scene = result.scene {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Scene Analysis")
                                .font(.headline)
                            
                            Text(scene.description)
                                .font(.body)
                            
                            Text("Mood: \(scene.mood)")
                                .font(.subheadline)
                                .foregroundColor(.blue)
                            
                            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 3), spacing: 8) {
                                ForEach(scene.tags, id: \.self) { tag in
                                    Text(tag)
                                        .font(.caption)
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 4)
                                        .background(Color.blue.opacity(0.2))
                                        .cornerRadius(8)
                                }
                            }
                        }
                    }
                    
                    // Text detection
                    if !result.text.isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Text Detected")
                                .font(.headline)
                            
                            ForEach(result.text, id: \.self) { text in
                                Text(text)
                                    .padding()
                                    .background(Color.yellow.opacity(0.1))
                                    .cornerRadius(8)
                            }
                        }
                    }
                    
                    // Metadata
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Analysis Details")
                            .font(.headline)
                        
                        HStack {
                            Text("Overall Confidence:")
                            Spacer()
                            Text("\(Int(result.confidence * 100))%")
                                .foregroundColor(.green)
                        }
                        
                        HStack {
                            Text("Processing Time:")
                            Spacer()
                            Text("\(result.processingTimeMs)ms")
                        }
                        
                        HStack {
                            Text("Analyzed:")
                            Spacer()
                            Text(result.timestamp, style: .date)
                        }
                        
                        if result.cached {
                            HStack {
                                Text("Source:")
                                Spacer()
                                Text("Cached Result")
                                    .foregroundColor(.orange)
                            }
                        }
                    }
                    .font(.subheadline)
                    .padding()
                    .background(Color.gray.opacity(0.1))
                    .cornerRadius(8)
                }
                .padding()
            }
            .navigationTitle("Analysis Details")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }
}

// Camera View using UIViewControllerRepresentable
struct CameraView: UIViewControllerRepresentable {
    @Binding var selectedImage: UIImage?
    @Environment(\.dismiss) private var dismiss
    
    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.delegate = context.coordinator
        picker.sourceType = .camera
        picker.allowsEditing = true
        return picker
    }
    
    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}
    
    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }
    
    class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let parent: CameraView
        
        init(_ parent: CameraView) {
            self.parent = parent
        }
        
        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey : Any]) {
            if let image = info[.editedImage] as? UIImage ?? info[.originalImage] as? UIImage {
                parent.selectedImage = image
            }
            parent.dismiss()
        }
        
        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            parent.dismiss()
        }
    }
}

// Temporary ImagePicker implementation
struct ImagePicker: UIViewControllerRepresentable {
    @Environment(\.dismiss) private var dismiss
    @Binding var image: UIImage?
    
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
        
        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey : Any]) {
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

#Preview {
    VisionProcessingView(authManager: DeviceAuthenticationManager())
}