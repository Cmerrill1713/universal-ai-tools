import SwiftUI
import AppKit

/// Minimal but complete chat view for QA testing
public struct SimpleChatView: View {
    @State private var input = ""
    @State private var response = ""
    @State private var lastPrompt = ""
    @State private var isLoading = false
    
    @EnvironmentObject var errorCenter: ErrorCenter
    @AppStorage("temperature") private var temperature: Double = 0.7
    @AppStorage("max_tokens") private var maxTokens: Int = 512
    
    private let client = APIClient()
    
    public init() {}
    
    public var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Health banner at top
            HealthBanner()
            
            Text("Chat")
                .font(.title2.bold())
            
            // Input area
            VStack(alignment: .leading, spacing: 8) {
                Text("Your message:")
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                KeyCatchingTextEditor(
                    text: $input,
                    onSubmit: { Task { await send() } },
                    focusOnAppear: true
                )
                .frame(minHeight: 100, maxHeight: 150)
                .background(Color(nsColor: .textBackgroundColor))  // ✅ Solid background
                .overlay(
                    RoundedRectangle(cornerRadius: 4)
                        .stroke(Color.secondary.opacity(0.3), lineWidth: 1)
                )
                .accessibilityIdentifier("chat_input")
            }
            
            // Action buttons
            HStack(spacing: 12) {
                Button {
                    Task { await send() }
                } label: {
                    if isLoading {
                        ProgressView()
                            .scaleEffect(0.7)
                            .frame(width: 60)
                    } else {
                        Text("Send")
                            .frame(width: 60)
                    }
                }
                .disabled(isLoading || input.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                .accessibilityIdentifier("chat_send")
                
                Button("Retry") {
                    input = lastPrompt
                    Task { await send() }
                }
                .disabled(lastPrompt.isEmpty || isLoading)
                .accessibilityIdentifier("chat_retry")
                
                Spacer()
                
                if !response.isEmpty {
                    Button("Clear") {
                        response = ""
                        input = ""
                    }
                }
            }
            
            Divider()
            
            // Response area
            if !response.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Response:")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    
                ScrollView {
                    Text(response)
                        .font(.body)
                        .foregroundColor(Color(nsColor: .labelColor))  // ✅ Readable in light/dark
                        .textSelection(.enabled)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .accessibilityIdentifier("chat_response")
                }
                .frame(maxHeight: .infinity)
                }
            } else {
                Spacer()
            }
        }
        .padding()
    }
    
    // Request/Response models
    struct ChatRequest: Encodable {
        let message: String
        let temperature: Double?
        let max_tokens: Int?
        let request_id: String
    }
    
    struct ChatResponse: Decodable {
        let id: String?
        let message: String?
        let content: String?
        let response: String?
        let provider: String?
        let model: String?
    }
    
    private func send() async {
        guard !input.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            errorCenter.handle(APIError.validation422(message: "Please enter a message"), context: "Chat")
            return
        }
        
        isLoading = true
        lastPrompt = input
        
        do {
            let request = ChatRequest(
                message: input,
                temperature: temperature,
                max_tokens: maxTokens,
                request_id: UUID().uuidString
            )
            
            let result: ChatResponse = try await client.post("/api/chat", body: request)
            
            // Extract response text from various possible fields
            var responseText = result.response ?? result.message ?? result.content ?? "<no response>"
            
            // Add provider info if available
            if let provider = result.provider {
                responseText += "\n\n(Provider: \(provider))"
            }
            
            if let model = result.model {
                responseText += "\n(Model: \(model))"
            }
            
            response = responseText
            input = "" // Clear input after successful send
            
        } catch {
            errorCenter.handle(error, context: "Chat")
            // Don't clear input on error - user can retry
        }
        
        isLoading = false
    }
}

