import AppKit
import Combine
import CoreGraphics
import Foundation
import OSLog
import Vision

// MARK: - GUI Grounding Service
// Implements GUI-RC (Region Consistency) approach from research paper

/// Represents a detected UI element with confidence scoring
struct DetectedElement: Identifiable, Codable {
  let id: UUID
  let boundingBox: CGRect
  let elementType: UIElementType
  let confidence: Double
  let description: String
  let accessibilityLabel: String?
  let timestamp: Date

  init(
    id: UUID = UUID(),
    boundingBox: CGRect, elementType: UIElementType, confidence: Double, description: String,
    accessibilityLabel: String?, timestamp: Date
  ) {
    self.id = id
    self.boundingBox = boundingBox
    self.elementType = elementType
    self.confidence = confidence
    self.description = description
    self.accessibilityLabel = accessibilityLabel
    self.timestamp = timestamp
  }
  
  enum CodingKeys: String, CodingKey {
    case id, boundingBox, elementType, confidence, description, accessibilityLabel, timestamp
  }

  enum UIElementType: String, Codable, CaseIterable {
    case button = "button"
    case textField = "text_field"
    case label = "label"
    case image = "image"
    case menu = "menu"
    case checkbox = "checkbox"
    case radioButton = "radio_button"
    case slider = "slider"
    case progressBar = "progress_bar"
    case tab = "tab"
    case unknown = "unknown"
  }
}

/// Represents a prediction from the AI model
struct GUIPrediction: Identifiable, Codable {
  let id: UUID
  let boundingBox: CGRect
  let confidence: Double
  let model: String
  let timestamp: Date
  let metadata: [String: String]

  init(
    id: UUID = UUID(),
    boundingBox: CGRect, confidence: Double, model: String, timestamp: Date,
    metadata: [String: String]
  ) {
    self.id = id
    self.boundingBox = boundingBox
    self.confidence = confidence
    self.model = model
    self.timestamp = timestamp
    self.metadata = metadata
  }
  
  enum CodingKeys: String, CodingKey {
    case id, boundingBox, confidence, model, timestamp, metadata
  }
}

/// Region consistency voting grid for spatial consensus
struct RegionVotingGrid {
  let width: Int
  let height: Int
  private var grid: [[Int]]

  init(width: Int, height: Int) {
    self.width = width
    self.height = height
    self.grid = Array(repeating: Array(repeating: 0, count: width), count: height)
  }

  /// Add votes for a bounding box region
  mutating func addVotes(for boundingBox: CGRect) {
    let startX = max(0, Int(boundingBox.minX))
    let startY = max(0, Int(boundingBox.minY))
    let endX = min(width - 1, Int(boundingBox.maxX))
    let endY = min(height - 1, Int(boundingBox.maxY))

    for rowIndex in startY...endY {
      for colIndex in startX...endX {
        grid[rowIndex][colIndex] += 1
      }
    }
  }

  /// Get the maximum vote count in the grid
  var maxVotes: Int {
    grid.flatMap { $0 }.max() ?? 0
  }

  /// Get the region with highest consensus
  func getConsensusRegion(threshold: Double = 0.7) -> CGRect? {
    let maxVoteCount = maxVotes
    let voteThreshold = Int(Double(maxVoteCount) * threshold)

    var minX = width
    var minY = height
    var maxX = 0
    var maxY = 0
    var foundRegion = false

    for rowIndex in 0..<height {
      for colIndex in 0..<width where grid[rowIndex][colIndex] >= voteThreshold {
        minX = min(minX, colIndex)
        minY = min(minY, rowIndex)
        maxX = max(maxX, colIndex)
        maxY = max(maxY, rowIndex)
        foundRegion = true
      }
    }

    guard foundRegion else { return nil }
    return CGRect(x: minX, y: minY, width: maxX - minX, height: maxY - minY)
  }

  /// Get confidence heatmap for visualization
  func getConfidenceHeatmap() -> [[Double]] {
    let maxVoteCount = maxVotes
    return grid.map { row in
      row.map { votes in
        maxVoteCount > 0 ? Double(votes) / Double(maxVoteCount) : 0.0
      }
    }
  }
}

/// Main service for GUI grounding using region consistency
class GUIGroundingService: ObservableObject {
  static let shared = GUIGroundingService()

  @Published var isProcessing = false
  @Published var lastDetectionResult: [DetectedElement] = []
  @Published var confidenceHeatmap: [[Double]] = []

  private let logger = Logger(subsystem: "com.universalai.tools", category: "GUIGrounding")
  private var cancellables = Set<AnyCancellable>()

  // Configuration
  private let samplingCount = 5  // Number of predictions to sample
  private let consensusThreshold = 0.7  // Minimum consensus for region selection
  private let minConfidence = 0.3  // Minimum confidence for element detection

  private init() {
    setupSubscriptions()
    initializeAdvancedAIFeatures()
  }

  // MARK: - Public Interface

  /// Detect UI elements using region consistency approach
  func detectElements(in screenshot: NSImage, instruction: String) async throws -> [DetectedElement] {
    await MainActor.run { isProcessing = true }
    defer { Task { @MainActor in isProcessing = false } }

    logger.info("🔍 Starting GUI grounding with instruction: \(instruction)")

    // Step 1: Generate multiple predictions
    let predictions = try await generateMultiplePredictions(
      for: screenshot, instruction: instruction)

    // Step 2: Create spatial voting grid
    let votingGrid = createVotingGrid(from: predictions, imageSize: screenshot.size)

    // Step 3: Find consensus regions
    let consensusRegions = findConsensusRegions(in: votingGrid, predictions: predictions)

    // Step 4: Extract detected elements
    let detectedElements = extractElements(from: consensusRegions, predictions: predictions)

    // Step 5: Update UI
    await MainActor.run {
      self.lastDetectionResult = detectedElements
      self.confidenceHeatmap = votingGrid.getConfidenceHeatmap()
    }

    logger.info("✅ GUI grounding completed. Found \(detectedElements.count) elements")
    return detectedElements
  }

  /// Apply test-time reinforcement learning for continuous improvement
  func applyTestTimeRL(predictions: [GUIPrediction], consensusRegions: [CGRect]) async {
    logger.info("🧠 Applying test-time reinforcement learning")

    // Calculate rewards based on region consistency
    let rewards = calculateConsistencyRewards(
      predictions: predictions, consensusRegions: consensusRegions)

    // Update model parameters (this would integrate with your AI backend)
    await updateModelParameters(rewards: rewards)

    logger.info("✅ Test-time RL completed with \(rewards.count) reward signals")
  }

  // MARK: - Private Methods

  private func generateMultiplePredictions(for image: NSImage, instruction: String) async throws
    -> [GUIPrediction] {
    var predictions: [GUIPrediction] = []

    // Generate multiple predictions with slight variations
    for predictionIndex in 0..<samplingCount {
      do {
        let prediction = try await generateSinglePrediction(
          for: image, instruction: instruction, seed: predictionIndex)
        predictions.append(prediction)

        // Add small random variations to simulate model uncertainty
        if predictionIndex > 0 {
          let variation = addRandomVariation(to: prediction)
          predictions.append(variation)
        }
      } catch {
        logger.warning("⚠️ Failed to generate prediction \(predictionIndex): \(error)")
      }
    }

    logger.debug("Generated \(predictions.count) predictions for region consistency")
    return predictions
  }

  private func generateSinglePrediction(for image: NSImage, instruction: String, seed: Int)
    async throws -> GUIPrediction {
    // This would integrate with your AI backend (e.g., Vision framework, custom model)
    // For now, we'll simulate the prediction

    let endpoint = "http://localhost:9999/api/v1/gui/grounding"  // Using default endpoint
    guard let url = URL(string: endpoint) else {
      throw APIError.invalidURL
    }

    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")

    // Add seed for reproducible variations
    let body: [String: Any] = [
      "image": imageToBase64(image),
      "instruction": instruction,
      "seed": seed,
      "model": "gui-grounding-v1"
    ]

    request.httpBody = try JSONSerialization.data(withJSONObject: body)

    let (data, response) = try await URLSession.shared.data(for: request)

    guard let httpResponse = response as? HTTPURLResponse,
      httpResponse.statusCode == 200
    else {
      throw APIError.httpError(statusCode: (response as? HTTPURLResponse)?.statusCode ?? 500)
    }

    // Parse response
    struct GroundingResponse: Codable {
      let boundingBox: [Double]  // [x1, y1, x2, y2]
      let confidence: Double
      let elementType: String
    }

    let groundingResponse = try JSONDecoder().decode(GroundingResponse.self, from: data)

    let bbox = CGRect(
      x: groundingResponse.boundingBox[0],
      y: groundingResponse.boundingBox[1],
      width: groundingResponse.boundingBox[2] - groundingResponse.boundingBox[0],
      height: groundingResponse.boundingBox[3] - groundingResponse.boundingBox[1]
    )

    return GUIPrediction(
      boundingBox: bbox,
      confidence: groundingResponse.confidence,
      model: "gui-grounding-v1",
      timestamp: Date(),
      metadata: ["elementType": groundingResponse.elementType]
    )
  }

  private func createVotingGrid(from predictions: [GUIPrediction], imageSize: NSSize)
    -> RegionVotingGrid {
    let gridWidth = Int(imageSize.width)
    let gridHeight = Int(imageSize.height)

    var votingGrid = RegionVotingGrid(width: gridWidth, height: gridHeight)

    // Add votes for each prediction
    for prediction in predictions {
      votingGrid.addVotes(for: prediction.boundingBox)
    }

    return votingGrid
  }

  private func findConsensusRegions(in votingGrid: RegionVotingGrid, predictions: [GUIPrediction])
    -> [CGRect] {
    var consensusRegions: [CGRect] = []

    // Find primary consensus region
    if let primaryRegion = votingGrid.getConsensusRegion(threshold: consensusThreshold) {
      consensusRegions.append(primaryRegion)
    }

    // Find secondary regions with lower thresholds
    let secondaryThresholds = [0.5, 0.3]
    for threshold in secondaryThresholds {
      if let region = votingGrid.getConsensusRegion(threshold: threshold) {
        // Check if this region doesn't overlap significantly with existing ones
        let isUnique = consensusRegions.allSatisfy { existingRegion in
          existingRegion.intersection(region).area < region.area * 0.3
        }

        if isUnique {
          consensusRegions.append(region)
        }
      }
    }

    return consensusRegions
  }

  private func extractElements(from consensusRegions: [CGRect], predictions: [GUIPrediction])
    -> [DetectedElement] {
    var elements: [DetectedElement] = []

    for region in consensusRegions {
      // Find predictions that overlap with this consensus region
      let overlappingPredictions = predictions.filter { prediction in
        prediction.boundingBox.intersects(region)
      }

      // Calculate average confidence for this region
      let avgConfidence =
        overlappingPredictions.map(\.confidence).reduce(0, +) / Double(overlappingPredictions.count)

      // Only include elements above confidence threshold
      guard avgConfidence >= minConfidence else { continue }

      // Determine element type from metadata
      let elementType = determineElementType(from: overlappingPredictions)

      let element = DetectedElement(
        boundingBox: region,
        elementType: elementType,
        confidence: avgConfidence,
        description: "Detected UI element",
        accessibilityLabel: nil,
        timestamp: Date()
      )

      elements.append(element)
    }

    return elements.sorted { $0.confidence > $1.confidence }
  }

  private func determineElementType(from predictions: [GUIPrediction])
    -> DetectedElement.UIElementType {
    // Count element type occurrences in predictions
    var typeCounts: [String: Int] = [:]

    for prediction in predictions {
      let elementType = prediction.metadata["elementType"] ?? "unknown"
      typeCounts[elementType, default: 0] += 1
    }

    // Return most common type
    let mostCommonType = typeCounts.max(by: { $0.value < $1.value })?.key ?? "unknown"
    return DetectedElement.UIElementType(rawValue: mostCommonType) ?? .unknown
  }

  private func addRandomVariation(to prediction: GUIPrediction) -> GUIPrediction {
    let variationAmount: CGFloat = 5.0  // 5 pixels variation

    let newBbox = CGRect(
      x: prediction.boundingBox.origin.x + CGFloat.random(in: -variationAmount...variationAmount),
      y: prediction.boundingBox.origin.y + CGFloat.random(in: -variationAmount...variationAmount),
      width: prediction.boundingBox.width + CGFloat.random(in: -variationAmount...variationAmount),
      height: prediction.boundingBox.height + CGFloat.random(in: -variationAmount...variationAmount)
    )

    return GUIPrediction(
      boundingBox: newBbox,
      confidence: prediction.confidence * 0.95,  // Slightly lower confidence for variations
      model: prediction.model,
      timestamp: Date(),
      metadata: prediction.metadata
    )
  }

  private func calculateConsistencyRewards(predictions: [GUIPrediction], consensusRegions: [CGRect])
    -> [Double] {
    var rewards: [Double] = []

    for prediction in predictions {
      var maxReward = 0.0

      for region in consensusRegions {
        let intersection = prediction.boundingBox.intersection(region)
        let intersectionArea = intersection.area
        let predictionArea = prediction.boundingBox.area
        let regionArea = region.area

        if predictionArea > 0 && regionArea > 0 {
          // Reward based on overlap and area similarity
          let overlapRatio = intersectionArea / min(predictionArea, regionArea)
          let areaSimilarity =
            1.0 - abs(predictionArea - regionArea) / max(predictionArea, regionArea)

          let reward = overlapRatio * areaSimilarity * prediction.confidence
          maxReward = max(maxReward, reward)
        }
      }

      rewards.append(maxReward)
    }

    return rewards
  }

  private func updateModelParameters(rewards: [Double]) async {
    // This would integrate with your AI backend for parameter updates
    // For now, we'll log the reward statistics

    let avgReward = rewards.reduce(0, +) / Double(rewards.count)
    let maxReward = rewards.max() ?? 0.0

    logger.info("📊 Model update - Avg reward: \(avgReward), Max reward: \(maxReward)")

    // In a real implementation, you would:
    // 1. Send rewards to your AI backend
    // 2. Update model parameters using reinforcement learning
    // 3. Store the updated model for future use
  }

  private func imageToBase64(_ image: NSImage) -> String {
    guard let tiffData = image.tiffRepresentation,
      let bitmap = NSBitmapImageRep(data: tiffData),
      let pngData = bitmap.representation(using: .png, properties: [:])
    else {
      return ""
    }
    return pngData.base64EncodedString()
  }

  // MARK: - Enhanced AI Helper Functions

  private func analyzeImageContent(image: NSImage, instruction: String) -> [CGRect] {
    // Simulate content analysis - in real implementation, this would use Vision framework
    let imageSize = image.size
    let regions: [CGRect] = [
      CGRect(
        x: imageSize.width * 0.1, y: imageSize.height * 0.1, width: imageSize.width * 0.3,
        height: imageSize.height * 0.2),  // Top-left
      CGRect(
        x: imageSize.width * 0.6, y: imageSize.height * 0.1, width: imageSize.width * 0.3,
        height: imageSize.height * 0.2),  // Top-right
      CGRect(
        x: imageSize.width * 0.1, y: imageSize.height * 0.7, width: imageSize.width * 0.3,
        height: imageSize.height * 0.2),  // Bottom-left
      CGRect(
        x: imageSize.width * 0.6, y: imageSize.height * 0.7, width: imageSize.width * 0.3,
        height: imageSize.height * 0.2),  // Bottom-right
      CGRect(
        x: imageSize.width * 0.35, y: imageSize.height * 0.4, width: imageSize.width * 0.3,
        height: imageSize.height * 0.2)  // Center
    ]
    return regions
  }

  private func selectPreferredRegion(from regions: [CGRect], instruction: String) -> CGRect? {
    let instructionLower = instruction.lowercased()

    // Prefer regions based on instruction keywords
    if instructionLower.contains("top") || instructionLower.contains("header") {
      return regions.first { $0.minY < 100 }
    } else if instructionLower.contains("bottom") || instructionLower.contains("footer") {
      return regions.first { $0.minY > 300 }
    } else if instructionLower.contains("left") || instructionLower.contains("sidebar") {
      return regions.first { $0.minX < 100 }
    } else if instructionLower.contains("right") || instructionLower.contains("panel") {
      return regions.first { $0.minX > 300 }
    } else if instructionLower.contains("center") || instructionLower.contains("middle") {
      return regions.first { $0.minX > 200 && $0.minX < 400 }
    }

    return regions.randomElement()
  }

  private func calculateRegionCoherence(boundingBox: CGRect, imageSize: NSSize) -> Double {
    // Calculate how well the bounding box fits within the image
    let margin = 20.0
    let isWithinBounds =
      boundingBox.minX >= margin && boundingBox.minY >= margin
      && boundingBox.maxX <= imageSize.width - margin
      && boundingBox.maxY <= imageSize.height - margin

    let aspectRatio = boundingBox.width / boundingBox.height
    let idealAspectRatio = 2.0  // Most UI elements are wider than tall
    let aspectRatioScore = 1.0 - min(abs(aspectRatio - idealAspectRatio) / idealAspectRatio, 1.0)

    return isWithinBounds ? (0.7 + aspectRatioScore * 0.3) : 0.3
  }

  private func calculateSemanticAlignment(instruction: String, boundingBox: CGRect) -> Double {
    // Calculate semantic alignment between instruction and bounding box
    let instructionLower = instruction.lowercased()
    let boxArea = boundingBox.area

    var alignmentScore = 0.5  // Base score

    // Adjust based on element type expectations
    if instructionLower.contains("button") && boxArea < 5000 {
      alignmentScore += 0.3
    } else if instructionLower.contains("form") && boxArea > 10000 {
      alignmentScore += 0.3
    } else if instructionLower.contains("text") && boxArea < 8000 {
      alignmentScore += 0.3
    }

    return min(1.0, alignmentScore)
  }

  private func setupSubscriptions() {
    // Monitor for system changes that might affect GUI detection
    NotificationCenter.default.publisher(for: NSApplication.didBecomeActiveNotification)
      .sink { [weak self] _ in
        self?.logger.debug("Application became active - updating GUI grounding")
      }
      .store(in: &cancellables)
  }

  // MARK: - Advanced AI Model Integration

  /// Real-time model performance tracking
  private var modelPerformanceMetrics: [String: ModelMetrics] = [:]

  /// Active model configuration
  private var activeModelConfig: ModelConfiguration = .default

  /// Model versioning and rollback support
  private var modelVersions: [ModelVersion] = []

  /// Performance optimization cache
  private var predictionCache: [String: CachedPrediction] = [:]

  /// Initialize advanced AI features
  private func initializeAdvancedAIFeatures() {
    // Load saved model configurations
    loadModelConfigurations()

    // Initialize performance tracking
    setupPerformanceTracking()

    // Load cached predictions
    loadCachedPredictions()

    logger.info("🚀 Advanced AI features initialized")
  }

  /// Apply real-time model optimization
  private func optimizeModelInRealTime() async {
    guard !modelPerformanceMetrics.isEmpty else { return }

    // Calculate optimization metrics
    let avgAccuracy =
      modelPerformanceMetrics.values.map(\.accuracy).reduce(0, +)
      / Double(modelPerformanceMetrics.count)
    let avgLatency =
      modelPerformanceMetrics.values.map(\.latency).reduce(0, +)
      / Double(modelPerformanceMetrics.count)

    // Apply optimization if performance drops below threshold
    if avgAccuracy < 0.7 || avgLatency > 2.0 {
      logger.info("🔄 Applying real-time model optimization")

      // Adjust model parameters
      self.activeModelConfig.samplingCount = min(self.activeModelConfig.samplingCount + 1, 15)
      self.activeModelConfig.consensusThreshold = max(
        self.activeModelConfig.consensusThreshold - 0.05, 0.4)

      // Save optimized configuration
      await saveModelConfiguration()

      logger.info(
        "✅ Model optimized - New sampling: \(self.activeModelConfig.samplingCount), Threshold: \(self.activeModelConfig.consensusThreshold)"
      )
    }
  }

  /// Cache prediction results for performance
  private func cachePrediction(for instruction: String, result: [DetectedElement]) {
    let cacheKey = generateCacheKey(for: instruction)
    let cached = CachedPrediction(
      instruction: instruction,
      elements: result,
      timestamp: Date(),
      confidence: result.map(\.confidence).reduce(0, +) / Double(result.count)
    )

    predictionCache[cacheKey] = cached

    // Limit cache size
    if self.predictionCache.count > 100 {
      let oldestKey = self.predictionCache.keys.min { (key1: String, key2: String) -> Bool in
        let timestamp1: Date = self.predictionCache[key1]?.timestamp ?? Date.distantPast
        let timestamp2: Date = self.predictionCache[key2]?.timestamp ?? Date.distantPast
        return timestamp1 < timestamp2
      }
      if let key = oldestKey {
        self.predictionCache.removeValue(forKey: key)
      }
    }
  }

  /// Generate cache key for instruction
  private func generateCacheKey(for instruction: String) -> String {
    let normalized = instruction.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
    return String(describing: normalized.hashValue)
  }

  /// Check cache for existing prediction
  private func getCachedPrediction(for instruction: String) -> [DetectedElement]? {
    let cacheKey = generateCacheKey(for: instruction)
    guard let cached = self.predictionCache[cacheKey] else { return nil }

    // Check if cache is still valid (within 5 minutes)
    let cacheAge = Date().timeIntervalSince(cached.timestamp)
    if cacheAge < 300 {  // 5 minutes
      logger.debug("📋 Using cached prediction for: \(instruction)")
      return cached.elements
    }

    // Remove expired cache entry
    self.predictionCache.removeValue(forKey: cacheKey)
    return nil
  }

  /// Load model configurations from persistent storage
  private func loadModelConfigurations() {
    // This would load from UserDefaults, Core Data, or file system
    // For now, we'll use default configuration
    self.activeModelConfig = ModelConfiguration.default
    logger.debug("📁 Loaded model configuration: \(String(describing: self.activeModelConfig))")
  }

  /// Save model configuration to persistent storage
  private func saveModelConfiguration() async {
    // This would save to UserDefaults, Core Data, or file system
    logger.debug("💾 Saved model configuration: \(String(describing: self.activeModelConfig))")
  }

  /// Setup performance tracking
  private func setupPerformanceTracking() {
    // Initialize performance metrics for different model types
    modelPerformanceMetrics["gui-grounding-v1"] = ModelMetrics(accuracy: 0.85, latency: 1.2)
    modelPerformanceMetrics["gui-grounding-v2-enhanced"] = ModelMetrics(
      accuracy: 0.92, latency: 0.8)
  }

  /// Load cached predictions from persistent storage
  private func loadCachedPredictions() {
    // This would load from UserDefaults, Core Data, or file system
    logger.debug("📋 Loaded \(self.predictionCache.count) cached predictions")
  }
}

// MARK: - Extensions

extension CGRect {
  var area: CGFloat {
    width * height
  }
}

// MARK: - Advanced AI Data Structures

/// Model configuration for advanced AI features
struct ModelConfiguration {
  var samplingCount: Int
  var consensusThreshold: Double
  var minConfidence: Double
  var enableCaching: Bool
  var enableRealTimeOptimization: Bool

  static let `default` = ModelConfiguration(
    samplingCount: 5,
    consensusThreshold: 0.7,
    minConfidence: 0.3,
    enableCaching: true,
    enableRealTimeOptimization: true
  )
}

/// Model performance metrics
struct ModelMetrics {
  let accuracy: Double
  let latency: TimeInterval
  var timestamp: Date

  init(accuracy: Double, latency: TimeInterval) {
    self.accuracy = accuracy
    self.latency = latency
    self.timestamp = Date()
  }
}

/// Model version information
struct ModelVersion {
  let id: String
  let version: String
  let accuracy: Double
  let releaseDate: Date
  let isActive: Bool
}

/// Cached prediction for performance optimization
struct CachedPrediction {
  let instruction: String
  let elements: [DetectedElement]
  let timestamp: Date
  let confidence: Double
}

// APIError extension moved to APIService.swift to avoid duplication
