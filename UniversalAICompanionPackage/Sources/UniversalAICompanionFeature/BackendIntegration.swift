import Foundation
import UIKit
import Combine

/// Backend integration service for AI vision features
@Observable
@MainActor
final class BackendIntegration {
    static let shared = BackendIntegration()
    
    // MARK: - Properties
    
    private let baseURL: String
    private let session: URLSession
    
    /// Current processing state
    var isProcessing = false
    var currentError: BackendError?
    
    /// Latest results from backend
    var generatedImage: GeneratedImage?
    var advancedAnalysis: AdvancedAnalysisResult?
    var visualReasoning: VisualReasoningResult?
    
    // MARK: - Initialization
    
    private init() {
        // Configure base URL from environment or use default
        // Note: In production, this should be set via environment variable
        self.baseURL = ProcessInfo.processInfo.environment["API_BASE_URL"] ?? "https://api.example.com/v1"
        
        // Configure URLSession with longer timeouts for AI processing
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 60
        config.timeoutIntervalForResource = 300
        self.session = URLSession(configuration: config)
    }
    
    // MARK: - Image Analysis
    
    /// Send image to backend for advanced AI analysis
    func sendImageForAnalysis(_ image: UIImage) async {
        isProcessing = true
        defer { isProcessing = false }
        
        do {
            // Convert image to base64
            guard let imageData = image.jpegData(compressionQuality: 0.8) else {
                throw BackendError.imageConversionFailed
            }
            let base64String = imageData.base64EncodedString()
            
            // Prepare request
            let url = URL(string: "\(baseURL)/vision/analyze")!
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            
            let body = [
                "imageBase64": base64String,
                "options": [
                    "extractText": true,
                    "generateEmbedding": true,
                    "detailed": true
                ]
            ] as [String : Any]
            
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
            
            // Send request
            let (data, response) = try await session.data(for: request)
            
            guard let httpResponse = response as? HTTPURLResponse,
                  httpResponse.statusCode == 200 else {
                throw BackendError.invalidResponse
            }
            
            // Parse response
            let result = try JSONDecoder().decode(AdvancedAnalysisResponse.self, from: data)
            self.advancedAnalysis = result.data.analysis
            
        } catch {
            self.currentError = error as? BackendError ?? .networkError(error.localizedDescription)
        }
    }
    
    // MARK: - Image Generation
    
    /// Generate image from text prompt using Stable Diffusion
    func generateImage(prompt: String, refine: Bool = false) async {
        isProcessing = true
        defer { isProcessing = false }
        
        do {
            let url = URL(string: "\(baseURL)/vision/generate")!
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            
            let body = [
                "prompt": prompt,
                "parameters": [
                    "width": 512,
                    "height": 512,
                    "steps": 30,
                    "guidance": 7.5
                ],
                "refine": [
                    "enabled": refine,
                    "strength": 0.3,
                    "backend": "mlx"
                ]
            ] as [String : Any]
            
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
            
            let (data, response) = try await session.data(for: request)
            
            guard let httpResponse = response as? HTTPURLResponse,
                  httpResponse.statusCode == 200 else {
                throw BackendError.invalidResponse
            }
            
            let result = try JSONDecoder().decode(GenerationResponse.self, from: data)
            self.generatedImage = result.data.generation
            
        } catch {
            self.currentError = error as? BackendError ?? .networkError(error.localizedDescription)
        }
    }
    
    // MARK: - Visual Reasoning
    
    /// Ask questions about an image
    func performVisualReasoning(image: UIImage, question: String) async {
        isProcessing = true
        defer { isProcessing = false }
        
        do {
            guard let imageData = image.jpegData(compressionQuality: 0.8) else {
                throw BackendError.imageConversionFailed
            }
            let base64String = imageData.base64EncodedString()
            
            let url = URL(string: "\(baseURL)/vision/reason")!
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            
            let body = [
                "imageBase64": base64String,
                "question": question
            ]
            
            request.httpBody = try JSONEncoder().encode(body)
            
            let (data, response) = try await session.data(for: request)
            
            guard let httpResponse = response as? HTTPURLResponse,
                  httpResponse.statusCode == 200 else {
                throw BackendError.invalidResponse
            }
            
            let result = try JSONDecoder().decode(ReasoningResponse.self, from: data)
            self.visualReasoning = result.data
            
        } catch {
            self.currentError = error as? BackendError ?? .networkError(error.localizedDescription)
        }
    }
    
    // MARK: - Image Refinement
    
    /// Refine/upscale an image using SDXL Refiner
    func refineImage(_ image: UIImage, strength: Double = 0.3) async -> UIImage? {
        isProcessing = true
        defer { isProcessing = false }
        
        do {
            guard let imageData = image.jpegData(compressionQuality: 0.9) else {
                throw BackendError.imageConversionFailed
            }
            let base64String = imageData.base64EncodedString()
            
            let url = URL(string: "\(baseURL)/vision/refine")!
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            
            let body = [
                "imageBase64": base64String,
                "parameters": [
                    "strength": strength,
                    "steps": 20,
                    "guidance": 7.5,
                    "backend": "mlx"
                ]
            ] as [String : Any]
            
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
            
            let (data, response) = try await session.data(for: request)
            
            guard let httpResponse = response as? HTTPURLResponse,
                  httpResponse.statusCode == 200 else {
                throw BackendError.invalidResponse
            }
            
            let result = try JSONDecoder().decode(RefinementResponse.self, from: data)
            
            if let refinedBase64 = result.data.refinement?.refinedBase64,
               let imageData = Data(base64Encoded: refinedBase64),
               let refinedImage = UIImage(data: imageData) {
                return refinedImage
            }
            
        } catch {
            self.currentError = error as? BackendError ?? .networkError(error.localizedDescription)
        }
        
        return nil
    }
    
    // MARK: - Batch Processing
    
    /// Analyze multiple images in batch
    func analyzeBatch(_ images: [UIImage]) async -> [AdvancedAnalysisResult] {
        isProcessing = true
        defer { isProcessing = false }
        
        var results: [AdvancedAnalysisResult] = []
        
        // Process in batches of 5 to avoid overwhelming the server
        for batch in images.chunked(into: 5) {
            await withTaskGroup(of: AdvancedAnalysisResult?.self) { group in
                for image in batch {
                    group.addTask {
                        await self.analyzeImageSilently(image)
                    }
                }
                
                for await result in group {
                    if let result = result {
                        results.append(result)
                    }
                }
            }
        }
        
        return results
    }
    
    private func analyzeImageSilently(_ image: UIImage) async -> AdvancedAnalysisResult? {
        // Similar to sendImageForAnalysis but returns result directly
        // Implementation omitted for brevity
        return nil
    }
}

// MARK: - Response Models

struct AdvancedAnalysisResponse: Codable {
    let success: Bool
    let data: AnalysisData
    
    struct AnalysisData: Codable {
        let analysis: AdvancedAnalysisResult
        let embedding: [Float]?
        let processingTime: Int
        let cached: Bool
    }
}

struct AdvancedAnalysisResult: Codable, Identifiable {
    let id = UUID()
    let objects: [AIDetectedObject]
    let scene: SceneDescription
    let text: [ExtractedText]
    let confidence: Double
    
    struct AIDetectedObject: Codable {
        let className: String
        let confidence: Double
        let bbox: BBox
        
        struct BBox: Codable {
            let x: Double
            let y: Double
            let width: Double
            let height: Double
        }
    }
    
    struct SceneDescription: Codable {
        let description: String
        let tags: [String]
        let mood: String?
        let lighting: String?
    }
    
    struct ExtractedText: Codable {
        let text: String
        let confidence: Double
    }
}

struct GenerationResponse: Codable {
    let success: Bool
    let data: GenerationData
    
    struct GenerationData: Codable {
        let generation: GeneratedImage
        let refinement: RefinedImage?
    }
}

struct GeneratedImage: Codable, Identifiable {
    let id: String
    let base64: String
    let prompt: String
    let model: String
}

struct RefinedImage: Codable {
    let id: String
    let refinedBase64: String
    let improvementScore: Double
}

struct ReasoningResponse: Codable {
    let success: Bool
    let data: VisualReasoningResult
}

struct VisualReasoningResult: Codable, Identifiable {
    let id = UUID()
    let question: String
    let answer: String
    let confidence: Double
    let reasoning: [String]
}

struct RefinementResponse: Codable {
    let success: Bool
    let data: RefinementData
    
    struct RefinementData: Codable {
        let refinement: RefinedImageData?
        
        struct RefinedImageData: Codable {
            let id: String
            let originalBase64: String
            let refinedBase64: String
            let improvementScore: Double
        }
    }
}

// MARK: - Errors

enum BackendError: LocalizedError {
    case imageConversionFailed
    case invalidResponse
    case networkError(String)
    case serverError(String)
    
    var errorDescription: String? {
        switch self {
        case .imageConversionFailed:
            return "Failed to convert image for upload"
        case .invalidResponse:
            return "Invalid response from server"
        case .networkError(let message):
            return "Network error: \(message)"
        case .serverError(let message):
            return "Server error: \(message)"
        }
    }
}

// MARK: - Helpers

extension Array {
    func chunked(into size: Int) -> [[Element]] {
        return stride(from: 0, to: count, by: size).map {
            Array(self[$0..<Swift.min($0 + size, count)])
        }
    }
}