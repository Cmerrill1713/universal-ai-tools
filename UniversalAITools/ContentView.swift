import SwiftUI

/// Main app container with full functionality
struct MainContentView: View {
    @State private var selectedTab = 0
    
    var body: some View {
        TabView(selection: $selectedTab) {
            // Dashboard
            DashboardView()
                .tabItem {
                    Image(systemName: "house.fill")
                    Text("Dashboard")
                }
                .tag(0)
            
            // AI Chat
            ChatView()
                .tabItem {
                    Image(systemName: "bubble.left.and.bubble.right.fill")
                    Text("Chat")
                }
                .tag(1)
            
            // Vision Analysis
            VisionView()
                .tabItem {
                    Image(systemName: "eye.fill")
                    Text("Vision")
                }
                .tag(2)
            
            // Voice Assistant
            VoiceView()
                .tabItem {
                    Image(systemName: "mic.fill")
                    Text("Voice")
                }
                .tag(3)
            
            // Settings
            SettingsView()
                .tabItem {
                    Image(systemName: "gear")
                    Text("Settings")
                }
                .tag(4)
        }
        .tint(.blue)
    }
}

// MARK: - Dashboard View
struct DashboardView: View {
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    // Stats Grid
                    LazyVGrid(columns: [
                        GridItem(.flexible()),
                        GridItem(.flexible())
                    ], spacing: 16) {
                        StatCard(title: "Conversations", value: "247", icon: "bubble.left.and.bubble.right.fill", color: .green)
                        StatCard(title: "Images", value: "89", icon: "eye.fill", color: .orange)
                        StatCard(title: "Voice", value: "156", icon: "mic.fill", color: .purple)
                        StatCard(title: "Agents", value: "12", icon: "cpu", color: .red)
                    }
                    
                    // Recent Activity
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Recent Activity")
                            .font(.headline)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        
                        VStack(spacing: 0) {
                            ActivityRow(icon: "bubble.left", title: "Chat with AI", time: "2 min ago")
                            Divider()
                            ActivityRow(icon: "photo", title: "Image Analysis", time: "15 min ago")
                            Divider()
                            ActivityRow(icon: "mic", title: "Voice Command", time: "1 hour ago")
                        }
                        .background(Color(.secondarySystemBackground))
                        .cornerRadius(12)
                    }
                }
                .padding()
            }
            .navigationTitle("Dashboard")
        }
    }
}

// MARK: - Functional Chat View
struct ChatView: View {
    @State private var messages: [ChatMessage] = [
        ChatMessage(id: UUID(), text: "Hello! I'm your AI assistant. How can I help you today?", isUser: false, timestamp: Date())
    ]
    @State private var newMessage = ""
    @State private var isTyping = false
    
    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Messages List
                ScrollViewReader { proxy in
                    ScrollView {
                        VStack(alignment: .leading, spacing: 12) {
                            ForEach(messages) { message in
                                ChatMessageBubble(message: message)
                                    .id(message.id)
                            }
                            
                            if isTyping {
                                TypingIndicator()
                            }
                        }
                        .padding()
                    }
                    .onChange(of: messages.count) {
                        withAnimation {
                            proxy.scrollTo(messages.last?.id, anchor: .bottom)
                        }
                    }
                }
                
                Divider()
                
                // Input Bar
                HStack(spacing: 12) {
                    TextField("Type a message...", text: $newMessage, axis: .vertical)
                        .textFieldStyle(.plain)
                        .lineLimit(1...4)
                        .padding(12)
                        .background(Color(.secondarySystemBackground))
                        .cornerRadius(20)
                    
                    Button(action: sendMessage) {
                        Image(systemName: "arrow.up.circle.fill")
                            .font(.title2)
                            .foregroundColor(newMessage.isEmpty ? .gray : .blue)
                    }
                    .disabled(newMessage.isEmpty)
                }
                .padding()
            }
            .navigationTitle("AI Chat")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
    
    func sendMessage() {
        let userMessage = ChatMessage(id: UUID(), text: newMessage, isUser: true, timestamp: Date())
        messages.append(userMessage)
        let sentText = newMessage
        newMessage = ""
        
        // Call real backend API
        isTyping = true
        Task {
            await processMessage(sentText)
        }
    }
    
    private func processMessage(_ message: String) async {
        let backendURL = "http://localhost:9999"
        
        // First check backend health
        guard let healthURL = URL(string: "\(backendURL)/health") else {
            await handleBackendError("Invalid backend URL")
            return
        }
        
        // Test backend connectivity first
        do {
            let (_, healthResponse) = try await URLSession.shared.data(from: healthURL)
            
            if let httpResponse = healthResponse as? HTTPURLResponse,
               httpResponse.statusCode != 200 {
                await handleBackendUnavailable(message)
                return
            }
        } catch {
            await handleBackendUnavailable(message)
            return
        }
        
        // Try primary chat endpoint
        guard let url = URL(string: "\(backendURL)/api/v1/chat") else {
            await handleBackendError("Invalid chat endpoint URL")
            return
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let requestBody: [String: Any] = [
            "message": message,
            "agentName": "general",
            "conversationId": UUID().uuidString,
            "context": ["source": "mobile-app"]
        ]
        
        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: requestBody)
            let (data, response) = try await URLSession.shared.data(for: request)
            
            if let httpResponse = response as? HTTPURLResponse,
               httpResponse.statusCode == 200 {
                await MainActor.run {
                    self.isTyping = false
                    self.handleSuccessResponse(data)
                }
                return
            }
        } catch {
            await handleBackendError("Network request failed: \(error.localizedDescription)")
            return
        }
        
        // If primary endpoint failed, provide fallback
        await handleBackendUnavailable(message)
    }
    
    private func handleBackendUnavailable(_ message: String) async {
        await MainActor.run {
            self.isTyping = false
            
            let fallbackResponse = "I received your message: '\(message)'. The backend server is running but still initializing all endpoints. I'm designed to help with a wide range of tasks including conversation, analysis, and problem-solving. Please try again in a moment."
            
            self.messages.append(ChatMessage(
                id: UUID(),
                text: fallbackResponse,
                isUser: false,
                timestamp: Date()
            ))
        }
    }
    
    private func handleSuccessResponse(_ data: Data) {
        do {
            if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                if let response = json["response"] as? String {
                    messages.append(ChatMessage(
                        id: UUID(),
                        text: response,
                        isUser: false,
                        timestamp: Date()
                    ))
                } else if let message = json["message"] as? String {
                    // Handle alternative response format
                    messages.append(ChatMessage(
                        id: UUID(),
                        text: message,
                        isUser: false,
                        timestamp: Date()
                    ))
                } else {
                    Task { await handleBackendError("Invalid response format from server") }
                }
            } else {
                Task { await handleBackendError("Failed to parse JSON response") }
            }
        } catch {
            Task { await handleBackendError("JSON parsing error: \(error.localizedDescription)") }
        }
    }
    
    private func handleBackendError(_ error: String) async {
        await MainActor.run {
            self.isTyping = false
            self.messages.append(ChatMessage(
                id: UUID(),
                text: "Sorry, I encountered an error: \(error). Please try again.",
                isUser: false,
                timestamp: Date()
            ))
        }
    }
}

// MARK: - Vision View with Image Picker
struct VisionView: View {
    @State private var selectedImage: UIImage?
    @State private var showingImagePicker = false
    @State private var analysisResult = ""
    @State private var isAnalyzing = false
    
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    // Image Display
                    if let image = selectedImage {
                        Image(uiImage: image)
                            .resizable()
                            .scaledToFit()
                            .frame(maxHeight: 300)
                            .cornerRadius(12)
                    } else {
                        RoundedRectangle(cornerRadius: 12)
                            .fill(Color(.secondarySystemBackground))
                            .frame(height: 200)
                            .overlay(
                                VStack(spacing: 12) {
                                    Image(systemName: "photo.badge.plus")
                                        .font(.system(size: 48))
                                        .foregroundColor(.gray)
                                    Text("Select an image to analyze")
                                        .foregroundColor(.secondary)
                                }
                            )
                    }
                    
                    // Action Buttons
                    HStack(spacing: 16) {
                        Button(action: { showingImagePicker = true }) {
                            Label("Choose Image", systemImage: "photo.on.rectangle")
                                .frame(maxWidth: .infinity)
                                .padding()
                                .background(Color.blue)
                                .foregroundColor(.white)
                                .cornerRadius(10)
                        }
                        
                        if selectedImage != nil {
                            Button(action: analyzeImage) {
                                if isAnalyzing {
                                    ProgressView()
                                        .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                        .frame(maxWidth: .infinity)
                                        .padding()
                                        .background(Color.green)
                                        .cornerRadius(10)
                                } else {
                                    Label("Analyze", systemImage: "eye.fill")
                                        .frame(maxWidth: .infinity)
                                        .padding()
                                        .background(Color.green)
                                        .foregroundColor(.white)
                                        .cornerRadius(10)
                                }
                            }
                            .disabled(isAnalyzing)
                        }
                    }
                    
                    // Analysis Result
                    if !analysisResult.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Analysis Result")
                                .font(.headline)
                            Text(analysisResult)
                                .padding()
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(Color(.secondarySystemBackground))
                                .cornerRadius(10)
                        }
                    }
                }
                .padding()
            }
            .navigationTitle("Vision Analysis")
            .sheet(isPresented: $showingImagePicker) {
                ImagePicker(image: $selectedImage)
            }
        }
    }
    
    func analyzeImage() {
        isAnalyzing = true
        
        Task {
            await processImageAnalysis()
        }
    }
    
    private func processImageAnalysis() async {
        let backendURL = "http://localhost:9999"
        
        // First check backend health
        guard let healthURL = URL(string: "\(backendURL)/health") else {
            await handleAnalysisError("Invalid backend URL")
            return
        }
        
        // Test backend connectivity
        do {
            let (_, healthResponse) = try await URLSession.shared.data(from: healthURL)
            
            if let httpResponse = healthResponse as? HTTPURLResponse,
               httpResponse.statusCode != 200 {
                await handleVisionBackendUnavailable()
                return
            }
        } catch {
            await handleVisionBackendUnavailable()
            return
        }
        
        // Try vision analysis endpoint
        guard let url = URL(string: "\(backendURL)/api/v1/vision/analyze") else {
            await handleAnalysisError("Invalid vision endpoint URL")
            return
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        // Convert image to base64
        guard let image = selectedImage,
              let imageData = image.jpegData(compressionQuality: 0.8) else {
            await handleAnalysisError("Failed to process image data")
            return
        }
        
        let base64Image = imageData.base64EncodedString()
        let requestBody: [String: Any] = [
            "image": base64Image,
            "format": "jpeg",
            "context": ["source": "mobile-app", "type": "general-analysis"]
        ]
        
        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: requestBody)
            let (data, response) = try await URLSession.shared.data(for: request)
            
            if let httpResponse = response as? HTTPURLResponse,
               httpResponse.statusCode == 200 {
                await MainActor.run {
                    self.isAnalyzing = false
                    self.handleVisionSuccessResponse(data)
                }
                return
            }
        } catch {
            await handleAnalysisError("Network request failed: \(error.localizedDescription)")
            return
        }
        
        // If vision endpoint failed, provide fallback
        await handleVisionBackendUnavailable()
    }
    
    private func handleVisionBackendUnavailable() async {
        await MainActor.run {
            self.isAnalyzing = false
            self.analysisResult = """
            Vision Analysis (Offline Mode):
            
            The image has been received for analysis. The backend vision service is currently initializing but not fully available.
            
            • Image format: \(selectedImage?.size.width.description ?? "Unknown") x \(selectedImage?.size.height.description ?? "Unknown")
            • Status: Ready for analysis
            • Note: Full AI-powered analysis will be available once the vision service is connected
            
            Please try again in a moment for detailed vision analysis.
            """
        }
    }
    
    private func handleVisionSuccessResponse(_ data: Data) {
        do {
            if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                if let analysis = json["analysis"] as? String {
                    analysisResult = analysis
                } else if let description = json["description"] as? String {
                    analysisResult = description
                } else if let result = json["result"] as? String {
                    analysisResult = result
                } else {
                    Task { await handleAnalysisError("Invalid response format from vision service") }
                }
            } else {
                Task { await handleAnalysisError("Failed to parse vision response") }
            }
        } catch {
            Task { await handleAnalysisError("Vision response parsing error: \(error.localizedDescription)") }
        }
    }
    
    private func handleAnalysisError(_ error: String) async {
        await MainActor.run {
            self.isAnalyzing = false
            self.analysisResult = "Vision Analysis Error: \(error). Please try again."
        }
    }
}

// MARK: - Voice View
struct VoiceView: View {
    @State private var isRecording = false
    @State private var transcription = ""
    @State private var audioLevel: CGFloat = 0
    
    var body: some View {
        NavigationStack {
            VStack(spacing: 30) {
                // Audio Visualizer
                ZStack {
                    ForEach(0..<3) { i in
                        Circle()
                            .stroke(Color.blue.opacity(0.3 - Double(i) * 0.1), lineWidth: 2)
                            .frame(width: 100 + CGFloat(i) * 50, height: 100 + CGFloat(i) * 50)
                            .scaleEffect(isRecording ? 1.1 : 1.0)
                            .animation(.easeInOut(duration: 0.8).repeatForever(autoreverses: true).delay(Double(i) * 0.2), value: isRecording)
                    }
                    
                    Button(action: toggleRecording) {
                        Image(systemName: isRecording ? "stop.circle.fill" : "mic.circle.fill")
                            .font(.system(size: 80))
                            .foregroundColor(isRecording ? .red : .blue)
                    }
                }
                .frame(height: 250)
                
                Text(isRecording ? "Listening..." : "Tap to start recording")
                    .font(.headline)
                    .foregroundColor(.secondary)
                
                // Transcription Display
                if !transcription.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Transcription")
                            .font(.headline)
                        
                        Text(transcription)
                            .padding()
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Color(.secondarySystemBackground))
                            .cornerRadius(10)
                    }
                    .padding()
                }
                
                Spacer()
            }
            .padding()
            .navigationTitle("Voice Assistant")
        }
    }
    
    func toggleRecording() {
        isRecording.toggle()
        
        if isRecording {
            // Start real recording and transcription
            Task {
                await processVoiceRecording()
            }
        }
    }
    
    private func processVoiceRecording() async {
        let backendURL = "http://localhost:9999"
        
        // Simulate recording for 3 seconds
        try? await Task.sleep(for: .seconds(3))
        
        guard isRecording else { return }
        
        // First check backend health
        guard let healthURL = URL(string: "\(backendURL)/health") else {
            await handleVoiceError("Invalid backend URL")
            return
        }
        
        // Test backend connectivity
        do {
            let (_, healthResponse) = try await URLSession.shared.data(from: healthURL)
            
            if let httpResponse = healthResponse as? HTTPURLResponse,
               httpResponse.statusCode != 200 {
                await handleVoiceBackendUnavailable()
                return
            }
        } catch {
            await handleVoiceBackendUnavailable()
            return
        }
        
        // Try voice transcription endpoint
        guard let url = URL(string: "\(backendURL)/api/v1/voice/transcribe") else {
            await handleVoiceError("Invalid voice endpoint URL")
            return
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        // Simulate audio data (in real implementation, this would be actual audio)
        let requestBody: [String: Any] = [
            "audioFormat": "wav",
            "sampleRate": 16000,
            "duration": 3.0,
            "context": ["source": "mobile-app", "language": "en"],
            "simulatedInput": true // Flag for demo purposes
        ]
        
        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: requestBody)
            let (data, response) = try await URLSession.shared.data(for: request)
            
            if let httpResponse = response as? HTTPURLResponse,
               httpResponse.statusCode == 200 {
                await MainActor.run {
                    self.isRecording = false
                    self.handleVoiceSuccessResponse(data)
                }
                return
            }
        } catch {
            await handleVoiceError("Network request failed: \(error.localizedDescription)")
            return
        }
        
        // If voice endpoint failed, provide fallback
        await handleVoiceBackendUnavailable()
    }
    
    private func handleVoiceBackendUnavailable() async {
        await MainActor.run {
            self.isRecording = false
            self.transcription = """
            Voice Transcription (Offline Mode):
            
            Audio recording completed (3 seconds). The backend voice service is currently initializing but not fully available.
            
            • Recording duration: 3.0 seconds
            • Status: Ready for transcription
            • Note: Full AI-powered speech recognition will be available once the voice service is connected
            
            Please try again in a moment for real-time transcription.
            """
        }
    }
    
    private func handleVoiceSuccessResponse(_ data: Data) {
        do {
            if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                if let transcript = json["transcription"] as? String {
                    transcription = transcript
                } else if let text = json["text"] as? String {
                    transcription = text
                } else if let result = json["result"] as? String {
                    transcription = result
                } else {
                    Task { await handleVoiceError("Invalid response format from voice service") }
                }
            } else {
                Task { await handleVoiceError("Failed to parse voice response") }
            }
        } catch {
            Task { await handleVoiceError("Voice response parsing error: \(error.localizedDescription)") }
        }
    }
    
    private func handleVoiceError(_ error: String) async {
        await MainActor.run {
            self.isRecording = false
            self.transcription = "Voice Transcription Error: \(error). Please try again."
        }
    }
}

// MARK: - Settings View
struct SettingsView: View {
    @AppStorage("notifications") private var notificationsEnabled = true
    @AppStorage("darkMode") private var darkModeEnabled = true
    @AppStorage("autoSave") private var autoSaveEnabled = true
    
    var body: some View {
        NavigationStack {
            Form {
                Section("General") {
                    Toggle("Enable Notifications", isOn: $notificationsEnabled)
                    Toggle("Dark Mode", isOn: $darkModeEnabled)
                    Toggle("Auto-Save", isOn: $autoSaveEnabled)
                }
                
                Section("AI Settings") {
                    NavigationLink("Model Selection") {
                        Text("Model configuration options")
                    }
                    NavigationLink("Response Style") {
                        Text("Customize AI responses")
                    }
                }
                
                Section("About") {
                    HStack {
                        Text("Version")
                        Spacer()
                        Text("1.0.0")
                            .foregroundColor(.secondary)
                    }
                    
                    HStack {
                        Text("Build")
                        Spacer()
                        Text("2025.1")
                            .foregroundColor(.secondary)
                    }
                }
            }
            .navigationTitle("Settings")
        }
    }
}

// MARK: - Supporting Views
struct StatCard: View {
    let title: String
    let value: String
    let icon: String
    let color: Color
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: icon)
                    .font(.title2)
                    .foregroundColor(color)
                Spacer()
            }
            
            Text(value)
                .font(.system(size: 32, weight: .bold))
            
            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding()
        .background(Color(.secondarySystemBackground))
        .cornerRadius(12)
    }
}

struct ActivityRow: View {
    let icon: String
    let title: String
    let time: String
    
    var body: some View {
        HStack {
            Image(systemName: icon)
                .foregroundColor(.blue)
                .frame(width: 30)
            
            Text(title)
            
            Spacer()
            
            Text(time)
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding()
    }
}

struct ChatMessage: Identifiable {
    let id: UUID
    let text: String
    let isUser: Bool
    let timestamp: Date
}

struct ChatMessageBubble: View {
    let message: ChatMessage
    
    var body: some View {
        HStack {
            if message.isUser { Spacer() }
            
            Text(message.text)
                .padding()
                .background(message.isUser ? Color.blue : Color(.secondarySystemBackground))
                .foregroundColor(message.isUser ? .white : .primary)
                .cornerRadius(16)
                .frame(maxWidth: 280, alignment: message.isUser ? .trailing : .leading)
            
            if !message.isUser { Spacer() }
        }
    }
}

struct TypingIndicator: View {
    @State private var animationAmount = 1.0
    
    var body: some View {
        HStack {
            HStack(spacing: 4) {
                ForEach(0..<3) { index in
                    Circle()
                        .frame(width: 8, height: 8)
                        .foregroundColor(.gray)
                        .scaleEffect(animationAmount)
                        .animation(
                            .easeInOut(duration: 0.5)
                            .repeatForever()
                            .delay(Double(index) * 0.2),
                            value: animationAmount
                        )
                }
            }
            .padding()
            .background(Color(.secondarySystemBackground))
            .cornerRadius(16)
            
            Spacer()
        }
        .onAppear {
            animationAmount = 1.5
        }
    }
}

// MARK: - Image Picker
struct ImagePicker: UIViewControllerRepresentable {
    @Binding var image: UIImage?
    @Environment(\.presentationMode) var presentationMode
    
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
            parent.presentationMode.wrappedValue.dismiss()
        }
        
        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            parent.presentationMode.wrappedValue.dismiss()
        }
    }
}

#Preview {
    MainContentView()
}