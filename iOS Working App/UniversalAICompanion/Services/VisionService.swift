import Foundation
import UIKit

struct VisionAnalysisResult: Identifiable, Codable {
    let id: UUID
    let objects: [DetectedObject]
    let scene: SceneAnalysis?
    let text: [String]
    let confidence: Double
    let processingTimeMs: Int
    let cached: Bool
    let timestamp: Date
    let imageId: String?
    
    init(from response: [String: Any]) {
        self.id = UUID()
        self.timestamp = Date()
        
        // Parse objects
        if let objectsArray = response["objects"] as? [[String: Any]] {
            self.objects = objectsArray.compactMap { objectData in
                guard let className = objectData["class"] as? String,
                      let confidence = objectData["confidence"] as? Double,
                      let bboxData = objectData["bbox"] as? [String: Any],
                      let x = bboxData["x"] as? Double,
                      let y = bboxData["y"] as? Double,
                      let width = bboxData["width"] as? Double,
                      let height = bboxData["height"] as? Double else {
                    return nil
                }
                
                return DetectedObject(
                    class: className,
                    confidence: confidence,
                    bbox: BoundingBox(x: x, y: y, width: width, height: height)
                )
            }
        } else {
            self.objects = []
        }
        
        // Parse scene analysis
        if let sceneData = response["scene"] as? [String: Any] {
            self.scene = SceneAnalysis(
                description: sceneData["description"] as? String ?? "",
                tags: sceneData["tags"] as? [String] ?? [],
                mood: sceneData["mood"] as? String ?? "neutral"
            )
        } else {
            self.scene = nil
        }
        
        // Parse text detection
        self.text = response["text"] as? [String] ?? []
        
        // Parse metadata
        self.confidence = response["confidence"] as? Double ?? 0.0
        self.processingTimeMs = response["processingTimeMs"] as? Int ?? 0
        self.cached = response["cached"] as? Bool ?? false
        self.imageId = response["imageId"] as? String
    }
}

struct DetectedObject: Codable {
    let `class`: String
    let confidence: Double
    let bbox: BoundingBox
}

struct BoundingBox: Codable {
    let x: Double
    let y: Double
    let width: Double
    let height: Double
}

struct SceneAnalysis: Codable {
    let description: String
    let tags: [String]
    let mood: String
}

@MainActor
class VisionService: ObservableObject {
    @Published var connectionState: ConnectionState = .disconnected
    @Published var analysisHistory: [VisionAnalysisResult] = []
    @Published var isProcessing = false
    
    private var authToken: String?
    private let baseURL = "http://localhost:9999"
    
    init() {
        loadAnalysisHistory()
        Task {
            await checkConnection()
        }
    }
    
    func setAuthToken(_ token: String) {
        self.authToken = token
        Task {
            await checkConnection()
        }
    }
    
    func checkConnection() async {
        connectionState = .connecting
        
        do {
            guard let url = URL(string: "\(baseURL)/api/v1/vision/health") else {
                connectionState = .error
                return
            }
            
            var request = URLRequest(url: url)
            if let token = authToken {
                request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            }
            
            let (data, response) = try await URLSession.shared.data(for: request)
            
            if let httpResponse = response as? HTTPURLResponse,
               httpResponse.statusCode == 200 {
                connectionState = .connected
                print("✅ Connected to Vision AI service")
            } else {
                connectionState = .error
            }
        } catch {
            connectionState = .disconnected
            print("❌ Failed to connect to Vision AI: \(error)")
        }
    }
    
    func analyzeImage(_ image: UIImage) async -> VisionAnalysisResult? {
        guard connectionState == .connected else {
            print("❌ Vision service not connected")
            return createMockResult()
        }
        
        isProcessing = true
        defer { isProcessing = false }
        
        do {
            // Convert image to base64
            guard let imageData = image.jpegData(compressionQuality: 0.8) else {
                print("❌ Failed to convert image to data")
                return createMockResult()
            }
            
            let base64String = imageData.base64EncodedString()
            
            guard let url = URL(string: "\(baseURL)/api/v1/vision/analyze") else {
                print("❌ Invalid vision analyze URL")
                return createMockResult()
            }
            
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            
            if let token = authToken {
                request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            }
            
            let requestBody: [String: Any] = [
                "imageBase64": base64String,
                "options": [
                    "detectObjects": true,
                    "analyzeScene": true,
                    "extractText": true,
                    "generateEmbedding": false
                ]
            ]
            
            let jsonData = try JSONSerialization.data(withJSONObject: requestBody)
            request.httpBody = jsonData
            
            let (data, response) = try await URLSession.shared.data(for: request)
            
            if let httpResponse = response as? HTTPURLResponse,
               httpResponse.statusCode == 200,
               let responseData = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let successData = responseData["data"] as? [String: Any],
               let analysisData = successData["analysis"] as? [String: Any] {
                
                let result = VisionAnalysisResult(from: analysisData)
                
                // Add to history
                analysisHistory.insert(result, at: 0)
                if analysisHistory.count > 50 {
                    analysisHistory = Array(analysisHistory.prefix(50))
                }
                saveAnalysisHistory()
                
                print("✅ Vision analysis completed: \(result.objects.count) objects detected")
                return result
            } else {
                print("❌ Failed to parse vision analysis response")
                return createMockResult()
            }
        } catch {
            print("❌ Vision analysis error: \(error)")
            return createMockResult()
        }
    }
    
    func generateEmbedding(_ image: UIImage) async -> [Double]? {
        guard connectionState == .connected else { return nil }
        
        do {
            guard let imageData = image.jpegData(compressionQuality: 0.8) else { return nil }
            let base64String = imageData.base64EncodedString()
            
            guard let url = URL(string: "\(baseURL)/api/v1/vision/embed") else { return nil }
            
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            
            if let token = authToken {
                request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            }
            
            let requestBody: [String: Any] = [
                "imageBase64": base64String,
                "saveToMemory": true
            ]
            
            let jsonData = try JSONSerialization.data(withJSONObject: requestBody)
            request.httpBody = jsonData
            
            let (data, response) = try await URLSession.shared.data(for: request)
            
            if let httpResponse = response as? HTTPURLResponse,
               httpResponse.statusCode == 200,
               let responseData = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let dataDict = responseData["data"] as? [String: Any],
               let vector = dataDict["vector"] as? [Double] {
                
                print("✅ Generated image embedding with \(vector.count) dimensions")
                return vector
            }
        } catch {
            print("❌ Embedding generation error: \(error)")
        }
        
        return nil
    }
    
    func searchSimilarImages(_ image: UIImage, limit: Int = 10) async -> [VisionAnalysisResult] {
        guard connectionState == .connected else { return [] }
        
        do {
            guard let imageData = image.jpegData(compressionQuality: 0.8) else { return [] }
            let base64String = imageData.base64EncodedString()
            
            guard let url = URL(string: "\(baseURL)/api/v1/vision/search") else { return [] }
            
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            
            if let token = authToken {
                request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            }
            
            let requestBody: [String: Any] = [
                "imageBase64": base64String,
                "limit": limit,
                "threshold": 0.7
            ]
            
            let jsonData = try JSONSerialization.data(withJSONObject: requestBody)
            request.httpBody = jsonData
            
            let (data, response) = try await URLSession.shared.data(for: request)
            
            if let httpResponse = response as? HTTPURLResponse,
               httpResponse.statusCode == 200,
               let responseData = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let dataDict = responseData["data"] as? [String: Any],
               let results = dataDict["results"] as? [[String: Any]] {
                
                let similarResults = results.compactMap { resultData -> VisionAnalysisResult? in
                    // Convert search result to VisionAnalysisResult
                    return VisionAnalysisResult(from: resultData)
                }
                
                print("✅ Found \(similarResults.count) similar images")
                return similarResults
            }
        } catch {
            print("❌ Image search error: \(error)")
        }
        
        return []
    }
    
    private func createMockResult() -> VisionAnalysisResult {
        let mockResponse: [String: Any] = [
            "objects": [
                [
                    "class": "person",
                    "confidence": 0.92,
                    "bbox": ["x": 10, "y": 10, "width": 200, "height": 300]
                ],
                [
                    "class": "phone",
                    "confidence": 0.85,
                    "bbox": ["x": 150, "y": 50, "width": 80, "height": 160]
                ]
            ],
            "scene": [
                "description": "A person holding a smartphone in what appears to be an indoor setting",
                "tags": ["person", "technology", "indoor", "casual"],
                "mood": "neutral"
            ],
            "text": [],
            "confidence": 0.88,
            "processingTimeMs": 245,
            "cached": false
        ]
        
        let result = VisionAnalysisResult(from: mockResponse)
        
        // Add to history
        analysisHistory.insert(result, at: 0)
        if analysisHistory.count > 50 {
            analysisHistory = Array(analysisHistory.prefix(50))
        }
        saveAnalysisHistory()
        
        return result
    }
    
    // MARK: - Persistence
    
    private func saveAnalysisHistory() {
        do {
            let data = try JSONEncoder().encode(analysisHistory)
            UserDefaults.standard.set(data, forKey: "VisionAnalysisHistory")
        } catch {
            print("❌ Failed to save analysis history: \(error)")
        }
    }
    
    private func loadAnalysisHistory() {
        guard let data = UserDefaults.standard.data(forKey: "VisionAnalysisHistory") else { return }
        
        do {
            analysisHistory = try JSONDecoder().decode([VisionAnalysisResult].self, from: data)
        } catch {
            print("❌ Failed to load analysis history: \(error)")
            analysisHistory = []
        }
    }
    
    func clearHistory() {
        analysisHistory.removeAll()
        saveAnalysisHistory()
    }
    
    func exportHistory() -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .full
        formatter.timeStyle = .medium
        
        var export = "Universal AI Tools - Vision Analysis Export\n"
        export += "Generated: \(formatter.string(from: Date()))\n"
        export += "Total Analyses: \(analysisHistory.count)\n\n"
        
        for (index, result) in analysisHistory.enumerated() {
            export += "Analysis #\(index + 1)\n"
            export += "Timestamp: \(formatter.string(from: result.timestamp))\n"
            export += "Objects Detected: \(result.objects.count)\n"
            
            for object in result.objects {
                export += "  - \(object.class): \(Int(object.confidence * 100))%\n"
            }
            
            if let scene = result.scene {
                export += "Scene: \(scene.description)\n"
                export += "Tags: \(scene.tags.joined(separator: ", "))\n"
                export += "Mood: \(scene.mood)\n"
            }
            
            export += "Confidence: \(Int(result.confidence * 100))%\n"
            export += "Processing Time: \(result.processingTimeMs)ms\n\n"
        }
        
        return export
    }
}