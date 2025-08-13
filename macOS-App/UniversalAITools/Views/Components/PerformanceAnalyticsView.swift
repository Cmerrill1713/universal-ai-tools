import SwiftUI

/// Performance analytics dashboard component for GUI Grounding
struct PerformanceAnalyticsView: View {
  let processingTime: TimeInterval
  let detectedElements: [DetectedElement]
  let consensusThreshold: Double
  let samplingCount: Int
  let minConfidence: Double

  private var averageConfidence: Double {
    guard !detectedElements.isEmpty else { return 0.0 }
    return detectedElements.map(\.confidence).reduce(0, +) / Double(detectedElements.count)
  }

  private var highConfidenceCount: Int {
    detectedElements.filter { $0.confidence >= 0.8 }.count
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      HStack {
        Image(systemName: "chart.line.uptrend.xyaxis")
          .foregroundColor(.blue)
        Text("Performance Analytics")
          .font(.headline)
          .fontWeight(.semibold)
        Spacer()
      }

      LazyVGrid(
        columns: [
          GridItem(.flexible()),
          GridItem(.flexible()),
          GridItem(.flexible())
        ], spacing: 16
      ) {
        // Processing Performance
        VStack(alignment: .leading, spacing: 8) {
          HStack {
            Image(systemName: "clock")
              .foregroundColor(.orange)
            Text("Processing Time")
              .font(.subheadline)
              .fontWeight(.medium)
          }

          Text("\(String(format: "%.2f", processingTime))s")
            .font(.title2)
            .fontWeight(.bold)

          Text("Last detection")
            .font(.caption)
            .foregroundColor(.secondary)
        }
        .padding()
        .background(Color(.controlBackgroundColor))
        .cornerRadius(8)

        // Accuracy Metrics
        VStack(alignment: .leading, spacing: 8) {
          HStack {
            Image(systemName: "target")
              .foregroundColor(.green)
            Text("Detection Accuracy")
              .font(.subheadline)
              .fontWeight(.medium)
          }

          Text("\(Int(averageConfidence * 100))%")
            .font(.title2)
            .fontWeight(.bold)

          Text("Average confidence")
            .font(.caption)
            .foregroundColor(.secondary)
        }
        .padding()
        .background(Color(.controlBackgroundColor))
        .cornerRadius(8)

        // Element Count
        VStack(alignment: .leading, spacing: 8) {
          HStack {
            Image(systemName: "rectangle.3.group")
              .foregroundColor(.purple)
            Text("Elements Found")
              .font(.subheadline)
              .fontWeight(.medium)
          }

          Text("\(detectedElements.count)")
            .font(.title2)
            .fontWeight(.bold)

          Text("High confidence: \(highConfidenceCount)")
            .font(.caption)
            .foregroundColor(.secondary)
        }
        .padding()
        .background(Color(.controlBackgroundColor))
        .cornerRadius(8)
      }

      // Performance Trends
      if !detectedElements.isEmpty {
        VStack(alignment: .leading, spacing: 12) {
          Text("Performance Trends")
            .font(.subheadline)
            .fontWeight(.medium)

          HStack(spacing: 20) {
            VStack(alignment: .leading, spacing: 4) {
              Text("Region Consistency")
                .font(.caption)
                .foregroundColor(.secondary)
              Text("\(Int(consensusThreshold * 100))%")
                .font(.title3)
                .fontWeight(.semibold)
            }

            VStack(alignment: .leading, spacing: 4) {
              Text("Sampling Count")
                .font(.caption)
                .foregroundColor(.secondary)
              Text("\(samplingCount)")
                .font(.title3)
                .fontWeight(.semibold)
            }

            VStack(alignment: .leading, spacing: 4) {
              Text("Min Confidence")
                .font(.caption)
                .foregroundColor(.secondary)
              Text("\(Int(minConfidence * 100))%")
                .font(.title3)
                .fontWeight(.semibold)
            }
          }
        }
        .padding()
        .background(Color(.controlBackgroundColor))
        .cornerRadius(8)
      }
    }
  }
}

#Preview {
  PerformanceAnalyticsView(
    processingTime: 2.5,
    detectedElements: [
      DetectedElement(
        boundingBox: CGRect(x: 100, y: 100, width: 200, height: 50),
        elementType: .button,
        confidence: 0.85,
        description: "Login button",
        accessibilityLabel: "Login button",
        timestamp: Date()
      )
    ],
    consensusThreshold: 0.7,
    samplingCount: 5,
    minConfidence: 0.3
  )
  .padding()
}
