import Foundation
import Network
import Observation

/// Native Swift client for Rust/Go microservices integration
/// Handles direct communication with your production-ready backend services
@MainActor
@Observable
final class NativeMicroserviceClient: @unchecked Sendable {
    static let shared = NativeMicroserviceClient()
    
    // MARK: - Service Endpoints
    struct ServiceEndpoints {
        // Rust Services (High-performance AI processing)
        static let fastLLMCoordinator = "http://localhost:8001"      // fast-llm-coordinator
        static let parameterAnalytics = "http://localhost:8002"      // parameter-analytics  
        static let voiceProcessing = "http://localhost:8003"         // voice-processing
        static let visionResourceManager = "http://localhost:8004"   // vision-resource-manager
        static let multimodalFusion = "http://localhost:8005"        // multimodal-fusion-service
        static let mlInference = "http://localhost:8006"             // ml-inference-service
        static let intelligentParameter = "http://localhost:8007"    // intelligent-parameter-service
        static let abMCTS = "http://localhost:8008"                  // ab-mcts-service
        
        // Go Services (Infrastructure & coordination)
        static let loadBalancer = "http://localhost:9001"            // go-services load-balancer
        static let messageBroker = "http://localhost:9002"           // go-services message-broker
        static let mlInferenceGo = "http://localhost:9003"           // go-services ml-inference
        static let realtimeData = "http://localhost:9004"            // go-services realtime-data-service
        
        // Node.js Main API (your existing TypeScript server)
        static let mainAPI = "http://localhost:3000"                 // Main orchestration layer
    }
    
    // MARK: - Connection Status
    var connectionStatus: [String: ServiceStatus] = [:]
    var isHealthy: Bool = false
    private let session = URLSession.shared
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()
    
    private init() {
        encoder.dateEncodingStrategy = .iso8601
        decoder.dateDecodingStrategy = .iso8601
        startHealthMonitoring()
    }
    
    // MARK: - Service Health Monitoring
    private func startHealthMonitoring() {
        Task {
            while true {
                await checkAllServicesHealth()
                try? await Task.sleep(for: .seconds(30)) // Check every 30 seconds
            }
        }
    }
    
    private func checkAllServicesHealth() async {
        let services = [
            ("fast-llm", ServiceEndpoints.fastLLMCoordinator),
            ("parameter-analytics", ServiceEndpoints.parameterAnalytics),
            ("voice-processing", ServiceEndpoints.voiceProcessing),
            ("vision-manager", ServiceEndpoints.visionResourceManager),
            ("multimodal-fusion", ServiceEndpoints.multimodalFusion),
            ("ml-inference-rust", ServiceEndpoints.mlInference),
            ("intelligent-parameter", ServiceEndpoints.intelligentParameter),
            ("ab-mcts", ServiceEndpoints.abMCTS),
            ("load-balancer", ServiceEndpoints.loadBalancer),
            ("message-broker", ServiceEndpoints.messageBroker),
            ("ml-inference-go", ServiceEndpoints.mlInferenceGo),
            ("realtime-data", ServiceEndpoints.realtimeData),
            ("main-api", ServiceEndpoints.mainAPI)
        ]
        
        await withTaskGroup(of: (String, ServiceStatus).self) { group in
            for (name, endpoint) in services {
                group.addTask {
                    let status = await self.checkServiceHealth(endpoint: endpoint)
                    return (name, status)
                }
            }
            
            for await (serviceName, status) in group {
                connectionStatus[serviceName] = status
            }
        }
        
        // Overall health check
        let healthyServices = connectionStatus.values.filter { $0.isHealthy }.count
        isHealthy = healthyServices >= services.count / 2 // At least 50% healthy
    }
    
    private func checkServiceHealth(endpoint: String) async -> ServiceStatus {
        guard let url = URL(string: "\(endpoint)/health") else {
            return ServiceStatus(isHealthy: false, latency: nil, error: "Invalid URL")
        }
        
        let startTime = Date()
        
        do {
            let (_, response) = try await session.data(from: url)
            let latency = Date().timeIntervalSince(startTime) * 1000 // ms
            
            if let httpResponse = response as? HTTPURLResponse,
               200..<300 ~= httpResponse.statusCode {
                return ServiceStatus(isHealthy: true, latency: latency, error: nil)
            } else {
                return ServiceStatus(isHealthy: false, latency: latency, error: "HTTP error")
            }
        } catch {
            let latency = Date().timeIntervalSince(startTime) * 1000
            return ServiceStatus(isHealthy: false, latency: latency, error: error.localizedDescription)
        }
    }
    
    // MARK: - LLM Coordination (Rust Service)
    func coordinateLLMRequest(_ request: LLMRequest) async throws -> LLMResponse {
        return try await makeRequest(
            to: ServiceEndpoints.fastLLMCoordinator,
            endpoint: "coordinate",
            method: .POST,
            body: request,
            responseType: LLMResponse.self
        )
    }
    
    func optimizeParameters(_ request: ParameterOptimizationRequest) async throws -> ParameterOptimizationResponse {
        return try await makeRequest(
            to: ServiceEndpoints.parameterAnalytics,
            endpoint: "optimize",
            method: .POST,
            body: request,
            responseType: ParameterOptimizationResponse.self
        )
    }
    
    // MARK: - Voice Processing (Rust Service)
    func processVoiceCommand(_ request: VoiceProcessingRequest) async throws -> VoiceProcessingResponse {
        return try await makeRequest(
            to: ServiceEndpoints.voiceProcessing,
            endpoint: "process",
            method: .POST,
            body: request,
            responseType: VoiceProcessingResponse.self
        )
    }
    
    func synthesizeSpeech(_ request: NativeTTSRequest) async throws -> NativeTTSResponse {
        return try await makeRequest(
            to: ServiceEndpoints.voiceProcessing,
            endpoint: "synthesize",
            method: .POST,
            body: request,
            responseType: NativeTTSResponse.self
        )
    }
    
    // MARK: - Vision Processing (Rust Service)
    func analyzeImage(_ request: VisionAnalysisRequest) async throws -> VisionAnalysisResponse {
        return try await makeRequest(
            to: ServiceEndpoints.visionResourceManager,
            endpoint: "analyze",
            method: .POST,
            body: request,
            responseType: VisionAnalysisResponse.self
        )
    }
    
    func optimizeVisionResources(_ request: VisionOptimizationRequest) async throws -> VisionOptimizationResponse {
        return try await makeRequest(
            to: ServiceEndpoints.visionResourceManager,
            endpoint: "optimize",
            method: .POST,
            body: request,
            responseType: VisionOptimizationResponse.self
        )
    }
    
    // MARK: - Multimodal Fusion (Rust Service)
    func fuseModalityInputs(_ request: MultimodalFusionRequest) async throws -> MultimodalFusionResponse {
        return try await makeRequest(
            to: ServiceEndpoints.multimodalFusion,
            endpoint: "fuse",
            method: .POST,
            body: request,
            responseType: MultimodalFusionResponse.self
        )
    }
    
    // MARK: - ML Inference (Rust Service)
    func runInference(_ request: MLInferenceRequest) async throws -> MLInferenceResponse {
        return try await makeRequest(
            to: ServiceEndpoints.mlInference,
            endpoint: "infer",
            method: .POST,
            body: request,
            responseType: MLInferenceResponse.self
        )
    }
    
    // MARK: - AB-MCTS (Rust Service)
    func executeMCTSSearch(_ request: MCTSRequest) async throws -> MCTSResponse {
        return try await makeRequest(
            to: ServiceEndpoints.abMCTS,
            endpoint: "search",
            method: .POST,
            body: request,
            responseType: MCTSResponse.self
        )
    }
    
    // MARK: - Go Services Integration
    func sendMessage(_ request: MessageBrokerRequest) async throws -> MessageBrokerResponse {
        return try await makeRequest(
            to: ServiceEndpoints.messageBroker,
            endpoint: "send",
            method: .POST,
            body: request,
            responseType: MessageBrokerResponse.self
        )
    }
    
    func getRealtimeData(_ request: RealtimeDataRequest) async throws -> RealtimeDataResponse {
        return try await makeRequest(
            to: ServiceEndpoints.realtimeData,
            endpoint: "stream",
            method: .GET,
            body: request,
            responseType: RealtimeDataResponse.self
        )
    }
    
    // MARK: - Generic Request Handler
    private func makeRequest<T: Codable>(
        to baseURL: String,
        endpoint: String,
        method: HTTPMethod = .GET,
        body: (any Encodable)? = nil,
        responseType: T.Type
    ) async throws -> T {
        guard let url = URL(string: "\(baseURL)/\(endpoint)") else {
            throw MicroserviceError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = method.rawValue
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Universal-AI-Tools-Swift/2.0", forHTTPHeaderField: "User-Agent")
        
        // Add request body if provided
        if let body = body {
            do {
                request.httpBody = try encoder.encode(body)
            } catch {
                throw MicroserviceError.encodingError(error)
            }
        }
        
        // Execute request
        do {
            let (data, response) = try await session.data(for: request)
            
            guard let httpResponse = response as? HTTPURLResponse else {
                throw MicroserviceError.invalidResponse
            }
            
            guard 200..<300 ~= httpResponse.statusCode else {
                let errorMessage = String(data: data, encoding: .utf8) ?? "Unknown error"
                throw MicroserviceError.httpError(httpResponse.statusCode, errorMessage)
            }
            
            do {
                return try decoder.decode(responseType, from: data)
            } catch {
                throw MicroserviceError.decodingError(error)
            }
            
        } catch let error as MicroserviceError {
            throw error
        } catch {
            throw MicroserviceError.networkError(error)
        }
    }
}

// MARK: - Supporting Types
public struct ServiceStatus: Sendable {
    let isHealthy: Bool
    let latency: Double? // in milliseconds
    let error: String?
    
    public init(isHealthy: Bool, latency: Double?, error: String?) {
        self.isHealthy = isHealthy
        self.latency = latency
        self.error = error
    }
}

public enum HTTPMethod: String, Sendable {
    case GET = "GET"
    case POST = "POST"
    case PUT = "PUT"
    case DELETE = "DELETE"
    case PATCH = "PATCH"
}

public enum MicroserviceError: Error, LocalizedError, Sendable {
    case invalidURL
    case invalidResponse
    case httpError(Int, String)
    case encodingError(Error)
    case decodingError(Error)
    case networkError(Error)
    
    public var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid service URL"
        case .invalidResponse:
            return "Invalid response from service"
        case .httpError(let code, let message):
            return "HTTP \(code): \(message)"
        case .encodingError(let error):
            return "Request encoding error: \(error.localizedDescription)"
        case .decodingError(let error):
            return "Response decoding error: \(error.localizedDescription)"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        }
    }
}

// MARK: - Request/Response Types for Rust Services
public struct LLMRequest: Codable, Sendable {
    let prompt: String
    let model: String
    let parameters: LLMParameters
    let context: String?
}

public struct LLMParameters: Codable, Sendable {
    let temperature: Double
    let maxTokens: Int
    let topP: Double
    let frequencyPenalty: Double
}

public struct LLMResponse: Codable, Sendable {
    let content: String
    let model: String
    let usage: TokenUsage
    let metadata: [String: String]
}

public struct TokenUsage: Codable, Sendable {
    let promptTokens: Int
    let completionTokens: Int
    let totalTokens: Int
}

public struct ParameterOptimizationRequest: Codable, Sendable {
    let parameters: [String: Double]
    let objective: String
    let constraints: [String: Double]
}

public struct ParameterOptimizationResponse: Codable, Sendable {
    let optimizedParameters: [String: Double]
    let score: Double
    let iterations: Int
}

public struct VoiceProcessingRequest: Codable, Sendable {
    let audioData: Data
    let language: String
    let processingType: VoiceProcessingType
}

public enum VoiceProcessingType: String, Codable, Sendable {
    case transcription = "transcription"
    case commandRecognition = "command_recognition"
    case speakerIdentification = "speaker_identification"
}

public struct VoiceProcessingResponse: Codable, Sendable {
    let text: String?
    let command: VoiceCommand?
    let speakerId: String?
    let confidence: Double
}

public struct VoiceCommand: Codable, Sendable {
    let action: String
    let parameters: [String: String]
}

public struct NativeTTSRequest: Codable, Sendable {
    let text: String
    let voice: String
    let speed: Double
    let pitch: Double
}

public struct NativeTTSResponse: Codable, Sendable {
    let audioData: Data
    let duration: Double
    let sampleRate: Int
}

public struct VisionAnalysisRequest: Codable, Sendable {
    let imageData: Data
    let analysisType: VisionAnalysisType
    let parameters: VisionParameters?
}

public enum VisionAnalysisType: String, Codable, Sendable {
    case objectDetection = "object_detection"
    case faceRecognition = "face_recognition"
    case sceneAnalysis = "scene_analysis"
    case textExtraction = "text_extraction"
}

public struct VisionParameters: Codable, Sendable {
    let confidence: Double
    let maxObjects: Int
    let includeAttributes: Bool
}

public struct VisionAnalysisResponse: Codable, Sendable {
    let objects: [NativeDetectedObject]
    let faces: [DetectedFace]
    let scene: SceneDescription?
    let text: ExtractedText?
}

public struct NativeDetectedObject: Codable, Sendable {
    let label: String
    let confidence: Double
    let boundingBox: BoundingBox
}

public struct DetectedFace: Codable, Sendable {
    let boundingBox: BoundingBox
    let landmarks: [FaceLandmark]
    let attributes: FaceAttributes
}

public struct BoundingBox: Codable, Sendable {
    let x: Double
    let y: Double
    let width: Double
    let height: Double
}

public struct FaceLandmark: Codable, Sendable {
    let type: String
    let x: Double
    let y: Double
}

public struct FaceAttributes: Codable, Sendable {
    let age: Int?
    let gender: String?
    let emotion: String?
}

public struct SceneDescription: Codable, Sendable {
    let description: String
    let tags: [String]
    let confidence: Double
}

public struct ExtractedText: Codable, Sendable {
    let text: String
    let regions: [TextRegion]
}

public struct TextRegion: Codable, Sendable {
    let text: String
    let boundingBox: BoundingBox
    let confidence: Double
}

public struct VisionOptimizationRequest: Codable, Sendable {
    let currentLoad: Double
    let availableResources: ResourceInfo
}

public struct ResourceInfo: Codable, Sendable {
    let cpuUsage: Double
    let memoryUsage: Double
    let gpuUsage: Double?
}

public struct VisionOptimizationResponse: Codable, Sendable {
    let recommendedSettings: ProcessingSettings
    let estimatedPerformance: PerformanceMetrics
}

public struct ProcessingSettings: Codable, Sendable {
    let batchSize: Int
    let resolution: ImageResolution
    let processingMode: String
}

public struct ImageResolution: Codable, Sendable {
    let width: Int
    let height: Int
}

public struct PerformanceMetrics: Codable, Sendable {
    let estimatedLatency: Double
    let throughput: Double
    let resourceUtilization: Double
}

public struct MultimodalFusionRequest: Codable, Sendable {
    let textInput: String?
    let imageData: Data?
    let audioData: Data?
    let fusionStrategy: FusionStrategy
}

public enum FusionStrategy: String, Codable, Sendable {
    case early = "early"
    case late = "late"
    case hybrid = "hybrid"
}

public struct MultimodalFusionResponse: Codable, Sendable {
    let fusedRepresentation: [Double]
    let confidence: Double
    let modalityWeights: [String: Double]
}

public struct MLInferenceRequest: Codable, Sendable {
    let modelId: String
    let inputData: Data // Changed from [String: Any] to Data for JSON serialization
    let parameters: InferenceParameters
    
    enum CodingKeys: String, CodingKey {
        case modelId, inputData = "input", parameters
    }
    
    public init(modelId: String, input: [String: Any], parameters: InferenceParameters) throws {
        self.modelId = modelId
        self.parameters = parameters
        // Serialize the input dictionary to JSON Data
        let jsonData = try JSONSerialization.data(withJSONObject: input, options: [])
        self.inputData = jsonData
    }
    
    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(modelId, forKey: .modelId)
        try container.encode(parameters, forKey: .parameters)
        
        // Decode Data back to JSON for encoding
        if let inputDict = try JSONSerialization.jsonObject(with: inputData, options: []) as? [String: Any] {
            // Create a temporary codable wrapper for the input
            let encoder = JSONEncoder()
            let inputJson = try encoder.encode(AnyCodable(inputDict))
            if let inputString = String(data: inputJson, encoding: .utf8) {
                try container.encode(inputString, forKey: .inputData)
            }
        }
    }
    
    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        modelId = try container.decode(String.self, forKey: .modelId)
        parameters = try container.decode(InferenceParameters.self, forKey: .parameters)
        
        // Handle input data decoding
        if let inputString = try? container.decode(String.self, forKey: .inputData) {
            inputData = inputString.data(using: .utf8) ?? Data()
        } else {
            inputData = try container.decode(Data.self, forKey: .inputData)
        }
    }
}

public struct InferenceParameters: Codable, Sendable {
    let batchSize: Int
    let useGPU: Bool
    let precision: String
}

public struct MLInferenceResponse: Codable, Sendable {
    let predictions: [Prediction]
    let latency: Double
    let modelVersion: String
}

public struct Prediction: Codable, Sendable {
    let value: Double
    let confidence: Double
    let metadata: [String: String]
}

public struct MCTSRequest: Codable, Sendable {
    let gameState: GameState
    let searchParameters: MCTSParameters
}

public struct GameState: Codable, Sendable {
    let board: [[Int]]
    let currentPlayer: Int
    let moveHistory: [Move]
}

public struct Move: Codable, Sendable {
    let player: Int
    let position: Position
    let timestamp: Date
}

public struct Position: Codable, Sendable {
    let x: Int
    let y: Int
}

public struct MCTSParameters: Codable, Sendable {
    let iterations: Int
    let explorationConstant: Double
    let timeLimit: Double
}

public struct MCTSResponse: Codable, Sendable {
    let bestMove: Move
    let evaluation: Double
    let searchStats: SearchStatistics
}

public struct SearchStatistics: Codable, Sendable {
    let nodesVisited: Int
    let searchDepth: Int
    let timeUsed: Double
}

// MARK: - Go Service Types
public struct MessageBrokerRequest: Codable, Sendable {
    let topic: String
    let message: String
    let priority: MessagePriority
}

public enum MessagePriority: String, Codable, Sendable {
    case low = "low"
    case normal = "normal"
    case high = "high"
    case critical = "critical"
}

public struct MessageBrokerResponse: Codable, Sendable {
    let messageId: String
    let status: String
    let deliveryTime: Date
}

public struct RealtimeDataRequest: Codable, Sendable {
    let dataType: RealtimeDataType
    let filters: [String: String]
    let limit: Int?
}

public enum RealtimeDataType: String, Codable, Sendable {
    case metrics = "metrics"
    case logs = "logs"
    case events = "events"
    case analytics = "analytics"
}

public struct RealtimeDataResponse: Codable, Sendable {
    let data: [RealtimeDataPoint]
    let timestamp: Date
    let hasMore: Bool
}

public struct RealtimeDataPoint: Codable, Sendable {
    let id: String
    let value: String
    let metadata: [String: String]
    let timestamp: Date
}

// MARK: - Helper Types

/// Helper type for encoding/decoding arbitrary JSON objects
private struct AnyCodable: Codable {
    let value: Any
    
    init(_ value: Any) {
        self.value = value
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        
        switch value {
        case let string as String:
            try container.encode(string)
        case let int as Int:
            try container.encode(int)
        case let double as Double:
            try container.encode(double)
        case let bool as Bool:
            try container.encode(bool)
        case let array as [Any]:
            let encodableArray = array.map { AnyCodable($0) }
            try container.encode(encodableArray)
        case let dict as [String: Any]:
            let encodableDict = dict.mapValues { AnyCodable($0) }
            try container.encode(encodableDict)
        case is NSNull:
            try container.encodeNil()
        default:
            throw EncodingError.invalidValue(value, EncodingError.Context(codingPath: encoder.codingPath, debugDescription: "Unsupported type for AnyCodable"))
        }
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        
        if container.decodeNil() {
            value = NSNull()
        } else if let string = try? container.decode(String.self) {
            value = string
        } else if let int = try? container.decode(Int.self) {
            value = int
        } else if let double = try? container.decode(Double.self) {
            value = double
        } else if let bool = try? container.decode(Bool.self) {
            value = bool
        } else if let array = try? container.decode([AnyCodable].self) {
            value = array.map { $0.value }
        } else if let dict = try? container.decode([String: AnyCodable].self) {
            value = dict.mapValues { $0.value }
        } else {
            throw DecodingError.dataCorrupted(DecodingError.Context(codingPath: decoder.codingPath, debugDescription: "Failed to decode AnyCodable"))
        }
    }
}