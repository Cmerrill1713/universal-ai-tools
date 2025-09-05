import Foundation
import SwiftUI

/// API client for backend face recognition services with 95%+ accuracy
@MainActor
final class FaceRecognitionAPIClient {
    
    // MARK: - Configuration
    
    private let baseURL: URL = {
        // Use your existing backend base URL
        if let urlString = Bundle.main.infoDictionary?["API_BASE_URL"] as? String,
           let url = URL(string: urlString) {
            return url
        }
        // Default to localhost for development
        return URL(string: "http://localhost:3000")!
    }()
    
    private let session = URLSession.shared
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()
    
    init() {
        encoder.keyEncodingStrategy = .convertToSnakeCase
        decoder.keyDecodingStrategy = .convertFromSnakeCase
    }
    
    // MARK: - Face Profile Management
    
    /// Create a new face profile with training images
    func createFaceProfile(_ request: CreateFaceProfileRequest) async throws -> CreateFaceProfileResponse {
        let url = baseURL.appendingPathComponent("/api/face-recognition/profiles")
        
        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "POST"
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        // Convert images to base64 for JSON transmission
        let profileData = CreateProfileData(
            name: request.name,
            photos: request.photos.map { $0.base64EncodedString() },
            contactInfo: request.contactInfo
        )
        
        urlRequest.httpBody = try encoder.encode(profileData)
        
        let (data, response) = try await session.data(for: urlRequest)
        
        guard let httpResponse = response as? HTTPURLResponse,
              200...299 ~= httpResponse.statusCode else {
            throw FaceRecognitionAPIError.invalidResponse
        }
        
        return try decoder.decode(CreateFaceProfileResponse.self, from: data)
    }
    
    /// Recognize faces in an image using backend processing
    func recognizeFaces(_ request: FaceRecognitionRequest) async throws -> FaceRecognitionResponse {
        let url = baseURL.appendingPathComponent("/api/face-recognition/recognize")
        
        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "POST"
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        // Convert image to base64 for JSON transmission
        let recognitionData = RecognitionData(
            imageData: request.imageData.base64EncodedString(),
            profileIds: request.profileIds
        )
        
        urlRequest.httpBody = try encoder.encode(recognitionData)
        
        let (data, response) = try await session.data(for: urlRequest)
        
        guard let httpResponse = response as? HTTPURLResponse,
              200...299 ~= httpResponse.statusCode else {
            throw FaceRecognitionAPIError.recognitionFailed
        }
        
        return try decoder.decode(FaceRecognitionResponse.self, from: data)
    }
    
    /// Validate accuracy metrics from backend
    func validateAccuracy() async throws -> AccuracyValidationResponse {
        let url = baseURL.appendingPathComponent("/api/face-recognition/validate-accuracy")
        
        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "GET"
        
        let (data, response) = try await session.data(for: urlRequest)
        
        guard let httpResponse = response as? HTTPURLResponse,
              200...299 ~= httpResponse.statusCode else {
            throw FaceRecognitionAPIError.validationFailed
        }
        
        return try decoder.decode(AccuracyValidationResponse.self, from: data)
    }
    
    /// Get performance metrics from backend
    func getPerformanceMetrics() async throws -> PerformanceMetricsResponse {
        let url = baseURL.appendingPathComponent("/api/face-recognition/performance")
        
        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "GET"
        
        let (data, response) = try await session.data(for: urlRequest)
        
        guard let httpResponse = response as? HTTPURLResponse,
              200...299 ~= httpResponse.statusCode else {
            throw FaceRecognitionAPIError.metricsUnavailable
        }
        
        return try decoder.decode(PerformanceMetricsResponse.self, from: data)
    }
    
    /// Update existing face profile
    func updateFaceProfile(_ profileId: UUID, with photos: [Data]) async throws -> UpdateFaceProfileResponse {
        let url = baseURL.appendingPathComponent("/api/face-recognition/profiles/\(profileId.uuidString)")
        
        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "PUT"
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let updateData = UpdateProfileData(
            additionalPhotos: photos.map { $0.base64EncodedString() }
        )
        
        urlRequest.httpBody = try encoder.encode(updateData)
        
        let (data, response) = try await session.data(for: urlRequest)
        
        guard let httpResponse = response as? HTTPURLResponse,
              200...299 ~= httpResponse.statusCode else {
            throw FaceRecognitionAPIError.updateFailed
        }
        
        return try decoder.decode(UpdateFaceProfileResponse.self, from: data)
    }
    
    /// Delete face profile
    func deleteFaceProfile(_ profileId: UUID) async throws {
        let url = baseURL.appendingPathComponent("/api/face-recognition/profiles/\(profileId.uuidString)")
        
        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "DELETE"
        
        let (_, response) = try await session.data(for: urlRequest)
        
        guard let httpResponse = response as? HTTPURLResponse,
              200...299 ~= httpResponse.statusCode else {
            throw FaceRecognitionAPIError.deleteFailed
        }
    }
}

// MARK: - Request/Response Models

struct CreateFaceProfileRequest {
    let name: String
    let photos: [Data]
    let contactInfo: ContactInfo?
}

struct CreateProfileData: Codable {
    let name: String
    let photos: [String] // Base64 encoded images
    let contactInfo: ContactInfo?
}

struct CreateFaceProfileResponse: Codable {
    let profileId: UUID
    let name: String
    let faceEmbedding: [Float]
    let success: Bool
    let message: String?
}

struct FaceRecognitionRequest {
    let imageData: Data
    let profileIds: [UUID]
}

struct RecognitionData: Codable {
    let imageData: String // Base64 encoded image
    let profileIds: [UUID]
}

struct FaceRecognitionResponse: Codable {
    let results: [FaceRecognitionResult]
    let processingTime: Double
    let success: Bool
}

struct FaceRecognitionResult: Codable {
    let profileId: UUID?
    let boundingBox: CGRect
    let detectionConfidence: Float
    let matchConfidence: Float
    let faceEmbedding: [Float]?
}

struct AccuracyValidationResponse: Codable {
    let overallAccuracy: Double
    let precisionScore: Double
    let recallScore: Double
    let f1Score: Double
    let falsePositiveRate: Double
    let falseNegativeRate: Double
    let averageConfidenceScore: Double
    let testSampleCount: Int
    let validationTimestamp: String
}

struct PerformanceMetricsResponse: Codable {
    let averageProcessingTime: Double
    let memoryUsage: Double
    let throughputPerSecond: Double
    let activeProfiles: Int
}

struct UpdateProfileData: Codable {
    let additionalPhotos: [String] // Base64 encoded images
}

struct UpdateFaceProfileResponse: Codable {
    let profileId: UUID
    let updatedEmbedding: [Float]
    let success: Bool
    let message: String?
}

// CGRect is already Codable in modern Swift, no extension needed

// MARK: - API Errors

enum FaceRecognitionAPIError: LocalizedError {
    case invalidResponse
    case recognitionFailed
    case validationFailed
    case metricsUnavailable
    case updateFailed
    case deleteFailed
    case networkError(String)
    
    var errorDescription: String? {
        switch self {
        case .invalidResponse:
            return "Invalid response from face recognition API"
        case .recognitionFailed:
            return "Face recognition request failed"
        case .validationFailed:
            return "Accuracy validation request failed"
        case .metricsUnavailable:
            return "Performance metrics unavailable"
        case .updateFailed:
            return "Failed to update face profile"
        case .deleteFailed:
            return "Failed to delete face profile"
        case .networkError(let message):
            return "Network error: \(message)"
        }
    }
}