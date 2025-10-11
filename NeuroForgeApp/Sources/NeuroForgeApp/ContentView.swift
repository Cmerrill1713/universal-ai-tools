import SwiftUI

struct ContentView: View {
    let profile: UserProfile
    @StateObject private var chatService: ChatService
    @StateObject private var voiceRecorder = VoiceRecorder()
    @StateObject private var layoutManager = LayoutManager()
    @State private var messageText = ""
    @State private var isLoading = false
    @State private var showImagePicker = false
    @State private var messagesSent = 0  // Track locally instead of via ProfileManager
    
    init(profile: UserProfile) {
        self.profile = profile
        // Initialize ChatService with profile ID
        _chatService = StateObject(wrappedValue: ChatService(userID: profile.id, threadID: "thread_\(profile.id)_\(UUID().uuidString)"))
    }
    
    // Toggle states for different modes
    @State private var isWebSearchEnabled = true
    @State private var isVisionEnabled = true
    @State private var isVoiceEnabled = true
    @State private var isMacOSControlEnabled = true
    @State private var isMemoryEnabled = false
    
    // Feedback states
    @State private var showThumbsUp = false
    @State private var showThumbsDown = false
    
    // Evolution/Learning toggle
    @State private var isEvolutionEnabled = true
    
    // Toggle buttons visibility
    @State private var showFeatureToggles = true
    
    var body: some View {
        VStack(spacing: 0) {
            // Header with profile and connection status
            HStack {
                // Profile avatar - show photo if available
                Group {
                    if let imageData = profile.profileImageData,
                       let nsImage = NSImage(data: imageData) {
                        Image(nsImage: nsImage)
                            .resizable()
                            .scaledToFill()
                            .frame(width: 32, height: 32)
                            .clipShape(Circle())
                    } else {
                        Image(systemName: profile.avatar)
                            .font(.title3)
                            .foregroundColor(.purple)
                    }
                }
                
                VStack(alignment: .leading, spacing: 2) {
                    Text(profile.name)
                        .font(.headline)
                    
                    HStack(spacing: 8) {
                        Circle()
                            .fill(chatService.isConnected ? .green : .red)
                            .frame(width: 6, height: 6)
                        
                        Text(chatService.isConnected ? "Connected" : "Disconnected")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
                
                Spacer()
                
                Text("\(messagesSent) messages")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.secondary.opacity(0.1))
                    .cornerRadius(6)
            }
            .padding()
            
            
            // Header
            headerView
            
            Divider()
            
            // Messages
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 16) {
                        ForEach(chatService.messages) { message in
                            MessageBubble(message: message)
                                .id(message.id)
                        }
                        
                        if isLoading {
                            HStack {
                                ProgressView()
                                    .progressViewStyle(.circular)
                                    .scaleEffect(0.7)
                                Text("AI is thinking...")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                            .padding()
                        }
                    }
                    .padding()
                }
                .onChange(of: chatService.messages.count) { _ in
                    if let lastMessage = chatService.messages.last {
                        withAnimation {
                            proxy.scrollTo(lastMessage.id, anchor: .bottom)
                        }
                    }
                }
            }
            
            Divider()
            
            // Toggle buttons above input (like your reference) - collapsible
            if showFeatureToggles {
                HStack(spacing: 8) {
                // Memory/Context toggle
                ToggleButton(icon: "doc.fill", isOn: $isMemoryEnabled, color: .blue)
                    .help("Memory: Store conversation context")
                
                // Voice output toggle
                ToggleButton(icon: "speaker.wave.2.fill", isOn: $isVoiceEnabled, color: .green)
                    .help("Voice: Enable speech output")
                
                // Thumbs up (positive feedback)
                Button(action: submitPositiveFeedback) {
                    Image(systemName: showThumbsUp ? "hand.thumbsup.fill" : "hand.thumbsup")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(showThumbsUp ? .white : .secondary)
                        .frame(width: 24, height: 24)
                        .background(
                            Circle()
                                .fill(showThumbsUp ? Color.orange : Color.clear)
                                .overlay(
                                    Circle()
                                        .stroke(showThumbsUp ? Color.orange : Color.secondary.opacity(0.3), lineWidth: 1)
                                )
                        )
                }
                .buttonStyle(.plain)
                .help("Thumbs up: Mark response as helpful")
                
                // Thumbs down (negative feedback)
                Button(action: submitNegativeFeedback) {
                    Image(systemName: showThumbsDown ? "hand.thumbsdown.fill" : "hand.thumbsdown")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(showThumbsDown ? .white : .secondary)
                        .frame(width: 24, height: 24)
                        .background(
                            Circle()
                                .fill(showThumbsDown ? Color.red : Color.clear)
                                .overlay(
                                    Circle()
                                        .stroke(showThumbsDown ? Color.red : Color.secondary.opacity(0.3), lineWidth: 1)
                                )
                        )
                }
                .buttonStyle(.plain)
                .help("Thumbs down: Mark response as unhelpful")
                
                // Evolution/Learning toggle
                ToggleButton(icon: "arrow.clockwise", isOn: $isEvolutionEnabled, color: .purple)
                    .help("Evolution: Enable auto-learning & improvement")
                
                Spacer()
                
                // Collapse toggle
                Button(action: { 
                    withAnimation(.easeInOut(duration: 0.2)) {
                        showFeatureToggles.toggle()
                    }
                }) {
                    Image(systemName: "chevron.up")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(.secondary)
                        .frame(width: 20, height: 20)
                        .background(Circle().fill(Color.secondary.opacity(0.1)))
                }
                .buttonStyle(.plain)
                .help("Hide feature toggles")
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
            .transition(.move(edge: .top).combined(with: .opacity))
        } else {
            // Collapsed state - show expand button
            HStack {
                Spacer()
                Button(action: { 
                    withAnimation(.easeInOut(duration: 0.2)) {
                        showFeatureToggles.toggle()
                    }
                }) {
                    Image(systemName: "chevron.down")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(.secondary)
                        .frame(width: 20, height: 20)
                        .background(Circle().fill(Color.secondary.opacity(0.1)))
                }
                .buttonStyle(.plain)
                .help("Show feature toggles")
                Spacer()
            }
            .padding(.vertical, 4)
            .transition(.move(edge: .top).combined(with: .opacity))
        }
            
            // Input area with inline controls
            VStack(spacing: 0) {
                // Input field with controls
                HStack(alignment: .bottom, spacing: 12) {
                    // Left side controls
                    HStack(spacing: layoutManager.spacing) {
                        Button(action: {}) {
                            Image(systemName: "plus")
                                .font(.system(size: layoutManager.buttonSize))
                                .foregroundColor(.secondary)
                        }
                        .buttonStyle(.plain)
                    }
                    
                    // Chat composer with proper Enter key handling
                    ChatComposer(
                        text: $messageText,
                        placeholder: "Type your message...",
                        isEnabled: !isLoading,
                        onSend: { text in
                            await handleSendMessage(text)
                        }
                    )
                    
                    // Right side controls
                    HStack(spacing: layoutManager.spacing) {
                        // Camera button
                        Button(action: { showImagePicker.toggle() }) {
                            Image(systemName: "camera.fill")
                                .font(.system(size: layoutManager.buttonSize))
                                .foregroundColor(.blue)
                        }
                        .buttonStyle(.plain)
                        
                        // Mic button
                        Button(action: toggleVoiceInput) {
                            Image(systemName: voiceRecorder.isRecording ? "mic.fill" : "mic")
                                .font(.system(size: layoutManager.buttonSize))
                                .foregroundColor(voiceRecorder.isRecording ? .red : .green)
                        }
                        .buttonStyle(.plain)
                        .help("Click to record voice message")
                    }
                }
                .padding(.horizontal, layoutManager.horizontalPadding)
                .padding(.vertical, layoutManager.verticalPadding)
            }
        }
        .frame(minWidth: 600, minHeight: 400)
        .sheet(isPresented: $showImagePicker) {
            ImagePicker(isPresented: $showImagePicker) { imageData in
                Task {
                    await handleImageSelected(imageData)
                }
            }
        }
                .onAppear {
                    print("🔔 ContentView appeared")
                    Task {
                        await chatService.checkConnection()
                    }
                }
    }
    
    private var headerView: some View {
        HStack {
            Image(systemName: "brain.head.profile")
                .font(.title)
                .foregroundColor(.purple)
            
            VStack(alignment: .leading, spacing: 2) {
                Text("Athena")
                    .font(.headline)
                HStack(spacing: 4) {
                    Circle()
                        .fill(chatService.isConnected ? Color.green : Color.red)
                        .frame(width: 8, height: 8)
                    Text(chatService.isConnected ? "Connected" : "Disconnected")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            
            Spacer()
            
            Text("\(chatService.messages.count) messages")
                .font(.caption)
                .foregroundColor(.secondary)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(Color.secondary.opacity(0.1))
                .cornerRadius(8)
        }
        .padding()
        .background(Color(nsColor: .controlBackgroundColor))
    }
    
    private var inputView: some View {
        HStack(alignment: .bottom, spacing: 12) {
            // Chat composer with proper Enter key handling
            ChatComposer(
                text: $messageText,
                placeholder: "Ask Athena anything...",
                isEnabled: !isLoading,
                onSend: { text in
                    await handleSendMessage(text)
                }
            )
            
            // Camera button
            Button(action: { showImagePicker.toggle() }) {
                Image(systemName: "camera.fill")
                    .font(.title3)
                    .foregroundColor(.blue)
            }
            .buttonStyle(.plain)
            .help("Analyze image")
            
            // Microphone button
            Button(action: toggleVoiceInput) {
                Image(systemName: voiceRecorder.isRecording ? "mic.fill" : "mic")
                    .font(.title3)
                    .foregroundColor(voiceRecorder.isRecording ? .red : .green)
            }
            .buttonStyle(.plain)
            .help("Voice input (click to record)")
        }
        .padding()
        .background(Color(nsColor: .controlBackgroundColor))
    }
    
    // New async handler for ChatComposer
    private func handleSendMessage(_ text: String) async {
        print("📝 Sending message: '\(text)'")
        isLoading = true
        
        // Check for layout modification requests
        if text.lowercased().contains("layout") || text.lowercased().contains("interface") || 
           text.lowercased().contains("taller") || text.lowercased().contains("shorter") ||
           text.lowercased().contains("padding") || text.lowercased().contains("rounded") ||
           text.lowercased().contains("buttons") || text.lowercased().contains("spacing") {
            
            print("🎨 Layout modification detected!")
            layoutManager.updateLayout(from: text)
            await chatService.addSystemMessage("🎨 Layout updated based on your request!")
            isLoading = false
            return
        }
        
        // Check for layout info request
        if text.lowercased().contains("what") && text.lowercased().contains("layout") {
            await chatService.addSystemMessage(layoutManager.getLayoutInfo())
            isLoading = false
            return
        }
        
        // Check for layout reset
        if text.lowercased().contains("reset") && text.lowercased().contains("layout") {
            layoutManager.resetToDefault()
            await chatService.addSystemMessage("🎨 Layout reset to defaults!")
            isLoading = false
            return
        }
        
        // Build context for the AI
        let context: [String: Any] = [
            "user_id": profile.id,
            "profile_name": profile.name,
            "messages_sent": messagesSent
        ]
        
        // Send message with context
        await chatService.sendMessage(text, context: context)
        
        // Increment message count
        messagesSent += 1
        
        isLoading = false
        
        // Speak response if voice is enabled
        if isVoiceEnabled, let lastMessage = chatService.messages.last, !lastMessage.isUser {
            print("🔊 Speaking AI response...")
            await speakText(lastMessage.text)
        }
        
        // ✅ Restore focus to input after send
        DispatchQueue.main.async {
            NSApp.activate(ignoringOtherApps: true)
            FocusHelper.focusChatEditor()
        }
    }
    
    // Legacy sendMessage for button clicks (redirects to async version)
    private func sendMessage() {
        print("🔔 Send button triggered")
        guard !messageText.isEmpty else {
            print("⚠️ Message is empty, ignoring")
            return
        }
        
        let text = messageText
        messageText = ""
        
        Task {
            await handleSendMessage(text)
        }
    }
    
    
    private func toggleVoiceInput() {
        Task {
            if !voiceRecorder.isRecording {
                // Start voice conversation mode
                do {
                    try await voiceRecorder.startRecording()
                    await chatService.addSystemMessage("🎤 Listening... (speak now, I'll respond when you're done)")
                    
                    // Wait for recording to finish (auto-stops after silence)
                    try await Task.sleep(nanoseconds: 6_000_000_000) // 6 seconds
                    
                    if let audioData = try await voiceRecorder.stopRecording() {
                        await chatService.addSystemMessage("🎤 Transcribing...")
                        await transcribeAndRespond(audioData)
                    }
                } catch {
                    await chatService.addSystemMessage("❌ Microphone error: \(error.localizedDescription)")
                }
            } else {
                // Manual stop if they click again
                do {
                    if let audioData = try await voiceRecorder.stopRecording() {
                        await transcribeAndRespond(audioData)
                    }
                } catch {
                    await chatService.addSystemMessage("❌ Error: \(error.localizedDescription)")
                }
            }
        }
    }
    
    private func transcribeAndRespond(_ audioData: Data) async {
        // Step 1: Transcribe speech to text
        // Try backend Whisper first, fall back to macOS Speech Recognition
        var transcript: String?
        
        // Try backend transcription
        do {
            let url = URL(string: "\(chatService.baseURL)/api/speech/transcribe")!
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.timeoutInterval = 30
            
            // Create multipart form data
            let boundary = UUID().uuidString
            request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
            
            var body = Data()
            body.append("--\(boundary)\r\n".data(using: .utf8)!)
            body.append("Content-Disposition: form-data; name=\"audio\"; filename=\"recording.m4a\"\r\n".data(using: .utf8)!)
            body.append("Content-Type: audio/m4a\r\n\r\n".data(using: .utf8)!)
            body.append(audioData)
            body.append("\r\n--\(boundary)--\r\n".data(using: .utf8)!)
            
            request.httpBody = body
            
            let (data, response) = try await URLSession.shared.data(for: request)
            
            if let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 {
                if let json = try? JSONDecoder().decode([String: AnyCodable].self, from: data),
                   let text = json["transcript"]?.value as? String {
                    transcript = text
                }
            }
        } catch {
            print("❌ Backend transcription failed: \(error), using fallback")
        }
        
        // Fallback: Use macOS built-in speech recognition
        if transcript == nil {
            await chatService.addSystemMessage("⚠️ Backend Whisper unavailable, using macOS speech recognition as fallback")
            
            // Save audio to file and use macOS dictation
            let tempFile = "/tmp/voice_\(UUID().uuidString).m4a"
            try? audioData.write(to: URL(fileURLWithPath: tempFile))
            
            // For now, show a prompt for user to type what they said
            // Real macOS speech recognition requires Speech framework which is complex
            await chatService.addSystemMessage("🎤 Please type what you said (Whisper API not available yet)")
            return
        }
        
        // Show what was transcribed
        await chatService.addSystemMessage("🗣️ You said: \(transcript!)")
        
        // Step 2: Send to AI and get response
        await chatService.sendMessage(transcript!)
        
        // Step 3: Speak the response back
        // Wait a moment for the message to be added
        try? await Task.sleep(nanoseconds: 500_000_000)
        
        if let lastMessage = chatService.messages.last, !lastMessage.isUser {
            await speakText(lastMessage.text)
        }
    }
    
    private func speakText(_ text: String) async {
        // Use Kokoro TTS for natural AI voices
        do {
            let url = URL(string: "\(chatService.baseURL)/api/tts/speak")!
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            
            let body = [
                "text": text,
                "voice": "sarah",  // Female voice - warm and natural
                "speed": "normal"
            ]
            request.httpBody = try JSONEncoder().encode(body)
            
            let (data, _) = try await URLSession.shared.data(for: request)
            if let json = try? JSONDecoder().decode([String: AnyCodable].self, from: data),
               let audioBase64 = json["audio_base64"]?.value as? String {
                // Decode base64 audio
                if let audioData = Data(base64Encoded: audioBase64) {
                    // Save and play audio
                    let tempFile = "/tmp/tts_\(UUID().uuidString).wav"
                    try audioData.write(to: URL(fileURLWithPath: tempFile))
                    
                    let task = Process()
                    task.executableURL = URL(fileURLWithPath: "/usr/bin/afplay")
                    task.arguments = [tempFile]
                    try? task.run()
                    task.waitUntilExit()
                    
                    // Clean up
                    try? FileManager.default.removeItem(atPath: tempFile)
                    print("🔊 Spoke response with Kokoro TTS")
                    return
                }
            }
        } catch {
            print("⚠️ Kokoro TTS failed, falling back to 'say': \(error)")
        }
        
        // Fallback to macOS say command
        let task = Process()
        task.executableURL = URL(fileURLWithPath: "/usr/bin/say")
        task.arguments = ["-v", "Samantha", text]
        try? task.run()
        print("🔊 Speaking response with fallback voice...")
    }
    
    private func handleImageSelected(_ imageData: Data) async {
        await chatService.addSystemMessage("📸 Analyzing image...")
        
        // Send to vision API
        do {
            let url = URL(string: "\(chatService.baseURL)/api/vision/analyze")!
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            
            let base64Image = imageData.base64EncodedString()
            let body = [
                "image": base64Image,
                "prompt": "Describe this image in detail"
            ]
            request.httpBody = try JSONEncoder().encode(body)
            
            let (data, _) = try await URLSession.shared.data(for: request)
            if let json = try? JSONDecoder().decode([String: AnyCodable].self, from: data),
               let description = json["description"]?.value as? String {
                await chatService.addSystemMessage("👁️ Vision: \(description)")
            }
        } catch {
            await chatService.addSystemMessage("❌ Vision analysis failed: \(error.localizedDescription)")
        }
    }
    
    // MARK: - Feedback Functions
    
    private func submitPositiveFeedback() {
        guard let lastMessage = chatService.messages.last, !lastMessage.isUser else {
            return
        }
        
        showThumbsUp = true
        showThumbsDown = false
        
        Task {
            do {
                let url = URL(string: "\(chatService.baseURL)/api/corrections/submit")!
                var request = URLRequest(url: url)
                request.httpMethod = "POST"
                request.setValue("application/json", forHTTPHeaderField: "Content-Type")
                
                let feedback = [
                    "message_id": lastMessage.id,
                    "feedback": "positive",
                    "timestamp": ISO8601DateFormatter().string(from: Date())
                ]
                request.httpBody = try JSONEncoder().encode(feedback)
                
                let (_, response) = try await URLSession.shared.data(for: request)
                if let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 {
                    await chatService.addSystemMessage("👍 Feedback sent! This helps improve the AI.")
                }
            } catch {
                print("Failed to submit feedback: \(error)")
            }
            
            // Reset after 2 seconds
            try? await Task.sleep(nanoseconds: 2_000_000_000)
            showThumbsUp = false
        }
    }
    
    private func submitNegativeFeedback() {
        guard let lastMessage = chatService.messages.last, !lastMessage.isUser else {
            return
        }
        
        showThumbsDown = true
        showThumbsUp = false
        
        Task {
            do {
                let url = URL(string: "\(chatService.baseURL)/api/corrections/submit")!
                var request = URLRequest(url: url)
                request.httpMethod = "POST"
                request.setValue("application/json", forHTTPHeaderField: "Content-Type")
                
                let feedback = [
                    "message_id": lastMessage.id,
                    "feedback": "negative",
                    "timestamp": ISO8601DateFormatter().string(from: Date())
                ]
                request.httpBody = try JSONEncoder().encode(feedback)
                
                let (_, response) = try await URLSession.shared.data(for: request)
                if let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 {
                    await chatService.addSystemMessage("👎 Feedback noted. The AI will learn from this.")
                }
            } catch {
                print("Failed to submit feedback: \(error)")
            }
            
            // Reset after 2 seconds
            try? await Task.sleep(nanoseconds: 2_000_000_000)
            showThumbsDown = false
        }
    }
    
    private func showSettingsMenu() {
        Task {
            await chatService.addSystemMessage("""
            ⚙️ **Athena Settings**
            
            **Available Features:**
            • 🧠 Memory: Conversation context storage
            • 🔊 Voice: Text-to-speech responses
            • 👁️ Vision: Image analysis
            • 🖥️ macOS Control: System automation
            • 🔄 Evolution: Auto-learning from feedback
            • 🏗️ App Builder: Build applications with AI agents
            
            **Backend API Endpoints:**
            • /api/models - Model management
            • /api/orchestration - TRM/HRM routing
            • /api/automation - macOS & browser control
            • /api/evolution - Learning & improvement
            • /api/unified-chat - Intelligent routing
            
            Type 'help' for more info on any feature!
            """)
        }
    }
}

struct MessageBubble: View {
    let message: ChatMessage
    
    var body: some View {
        HStack {
            if message.isUser {
                Spacer()
            }
            
            VStack(alignment: message.isUser ? .trailing : .leading, spacing: 4) {
                Text(message.text)
                    .padding(12)
                    .background(message.isUser ? Color.purple : Color.secondary.opacity(0.2))
                    .foregroundColor(message.isUser ? .white : .primary)
                    .cornerRadius(12)
                
                Text(formatDate(message.timestamp))
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
            .frame(maxWidth: 500, alignment: message.isUser ? .trailing : .leading)
            
            if !message.isUser {
                Spacer()
            }
        }
    }
    
    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm"
        return formatter.string(from: date)
    }
}

