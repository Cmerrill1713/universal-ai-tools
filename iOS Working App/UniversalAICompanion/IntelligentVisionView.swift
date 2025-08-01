import SwiftUI
import PhotosUI

struct IntelligentVisionView: View {
    @EnvironmentObject var connectionService: ConnectionStatusService
    @State private var selectedPhoto: PhotosPickerItem?
    @State private var selectedImage: UIImage?
    @State private var analysisResult: String = ""
    @State private var isAnalyzing = false
    @State private var analysisQuestion: String = ""
    @State private var showingCamera = false
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 24) {
                    // Connection Status
                    CompactConnectionStatusView(connectionService: connectionService)
                        .padding(.horizontal)
                    
                    // Header
                    VStack(spacing: 16) {
                        Image(systemName: "eye.fill")
                            .font(.system(size: 60))
                            .foregroundColor(.blue)
                        
                        Text("Vision AI")
                            .font(.largeTitle)
                            .fontWeight(.bold)
                        
                        Text("Upload an image and ask questions about it. Our AI will automatically analyze and provide intelligent insights.")
                            .font(.body)
                            .foregroundColor(.secondary)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal)
                    }
                    
                    // Image Selection
                    VStack(spacing: 16) {
                        if let selectedImage = selectedImage {
                            // Selected Image
                            Image(uiImage: selectedImage)
                                .resizable()
                                .aspectRatio(contentMode: .fit)
                                .frame(maxHeight: 300)
                                .cornerRadius(12)
                                .shadow(radius: 4)
                        } else {
                            // Placeholder
                            RoundedRectangle(cornerRadius: 12)
                                .fill(Color.gray.opacity(0.1))
                                .frame(height: 200)
                                .overlay(
                                    VStack(spacing: 12) {
                                        Image(systemName: "photo.badge.plus")
                                            .font(.system(size: 40))
                                            .foregroundColor(.gray)
                                        
                                        Text("Select an image to analyze")
                                            .font(.headline)
                                            .foregroundColor(.gray)
                                    }
                                )
                        }
                        
                        // Photo Selection Buttons
                        HStack(spacing: 16) {
                            PhotosPicker(selection: $selectedPhoto, matching: .images) {
                                Label("Photo Library", systemImage: "photo.on.rectangle")
                                    .font(.headline)
                                    .foregroundColor(.white)
                                    .frame(maxWidth: .infinity)
                                    .padding()
                                    .background(Color.blue)
                                    .cornerRadius(12)
                            }
                            
                            Button {
                                showingCamera = true
                            } label: {
                                Label("Camera", systemImage: "camera")
                                    .font(.headline)
                                    .foregroundColor(.white)
                                    .frame(maxWidth: .infinity)
                                    .padding()
                                    .background(Color.green)
                                    .cornerRadius(12)
                            }
                        }
                    }
                    .padding(.horizontal)
                    
                    // Analysis Question
                    VStack(spacing: 12) {
                        Text("What would you like to know about this image?")
                            .font(.headline)
                            .multilineTextAlignment(.center)
                        
                        TextField("Ask a question about the image...", text: $analysisQuestion, axis: .vertical)
                            .textFieldStyle(RoundedBorderTextFieldStyle())
                            .lineLimit(1...3)
                    }
                    .padding(.horizontal)
                    
                    // Analyze Button
                    Button {
                        Task {
                            await analyzeImage()
                        }
                    } label: {
                        HStack {
                            if isAnalyzing {
                                ProgressView()
                                    .scaleEffect(0.8)
                                Text("Analyzing...")
                            } else {
                                Image(systemName: "brain.head.profile")
                                Text("Analyze with AI")
                            }
                        }
                        .font(.headline)
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(canAnalyze ? Color.purple : Color.gray)
                        .cornerRadius(12)
                    }
                    .disabled(!canAnalyze)
                    .padding(.horizontal)
                    
                    // Analysis Result
                    if !analysisResult.isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            HStack {
                                Image(systemName: "sparkles")
                                    .foregroundColor(.purple)
                                Text("AI Analysis")
                                    .font(.headline)
                                    .foregroundColor(.purple)
                                Spacer()
                            }
                            
                            Text(analysisResult)
                                .font(.body)
                                .padding()
                                .background(Color.purple.opacity(0.1))
                                .cornerRadius(12)
                        }
                        .padding(.horizontal)
                    }
                    
                    Spacer(minLength: 100)
                }
                .padding(.vertical)
            }
            .navigationTitle("Vision AI")
            .navigationBarTitleDisplayMode(.inline)
            .sheet(isPresented: $showingCamera) {
                CameraView { image in
                    selectedImage = image
                    showingCamera = false
                }
            }
        }
        .onChange(of: selectedPhoto) {
            loadSelectedPhoto()
        }
    }
    
    private var canAnalyze: Bool {
        selectedImage != nil && 
        !analysisQuestion.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        !isAnalyzing &&
        connectionService.backendState == .connected
    }
    
    private func loadSelectedPhoto() {
        Task {
            if let selectedPhoto = selectedPhoto {
                if let data = try? await selectedPhoto.loadTransferable(type: Data.self) {
                    if let image = UIImage(data: data) {
                        selectedImage = image
                    }
                }
            }
        }
    }
    
    private func analyzeImage() async {
        guard let image = selectedImage else { return }
        
        isAnalyzing = true
        
        do {
            // Convert image to base64
            guard let imageData = image.jpegData(compressionQuality: 0.8) else {
                analysisResult = "Error: Could not process image"
                isAnalyzing = false
                return
            }
            
            let base64Image = imageData.base64EncodedString()
            let deviceContext = DeviceContext.getCurrentContext()
            
            let requestBody: [String: Any] = [
                "imageData": base64Image,
                "deviceContext": [
                    "deviceId": deviceContext.deviceId,
                    "batteryLevel": deviceContext.batteryLevel,
                    "isLowPowerMode": deviceContext.isLowPowerMode,
                    "connectionType": deviceContext.connectionType
                ],
                "analysisType": "reasoning",
                "question": analysisQuestion
            ]
            
            let url = URL(string: "http://localhost:9999/api/v1/mobile-orchestration/analyze-image")!
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.timeoutInterval = 30
            
            let jsonData = try JSONSerialization.data(withJSONObject: requestBody)
            request.httpBody = jsonData
            
            let (data, response) = try await URLSession.shared.data(for: request)
            
            if let httpResponse = response as? HTTPURLResponse {
                if httpResponse.statusCode == 200 {
                    if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                       let success = json["success"] as? Bool,
                       success == true,
                       let responseData = json["data"] as? [String: Any],
                       let analysis = responseData["analysis"] as? String {
                        analysisResult = analysis
                    } else {
                        analysisResult = "I was unable to analyze this image. Please try again with a different image or question."
                    }
                } else {
                    analysisResult = "Error: Server returned HTTP \(httpResponse.statusCode)"
                }
            }
            
        } catch {
            analysisResult = "Error: \(error.localizedDescription)"
        }
        
        isAnalyzing = false
    }
}

// MARK: - Camera View

struct CameraView: UIViewControllerRepresentable {
    let onImageCaptured: (UIImage) -> Void
    
    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = .camera
        picker.delegate = context.coordinator
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
            if let image = info[.originalImage] as? UIImage {
                parent.onImageCaptured(image)
            }
        }
    }
}

#Preview {
    IntelligentVisionView()
        .environmentObject(ConnectionStatusService())
}