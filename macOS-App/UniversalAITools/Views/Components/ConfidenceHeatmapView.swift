import CoreGraphics
import SwiftUI

/// SwiftUI view for displaying confidence heatmap from GUI grounding
struct ConfidenceHeatmapView: View {
  let confidenceData: [[Double]]
  let detectedElements: [DetectedElement]
  let imageSize: CGSize

  @State private var selectedElement: DetectedElement?
  @State private var showElementDetails = false
  @State private var showHeatmap = true
  @State private var showElements = true
  @State private var selectedConfidenceThreshold: Double = 0.5
  @State private var animationPhase: Double = 0

  // Heatmap configuration
  private let cellSize: CGFloat = 4.0
  private let colorScheme: [Color] = [
    Color.blue.opacity(0.1),
    Color.blue.opacity(0.3),
    Color.blue.opacity(0.5),
    Color.blue.opacity(0.7),
    Color.blue.opacity(0.9)
  ]

  var body: some View {
    VStack(spacing: 16) {
      // Header
      HStack {
        VStack(alignment: .leading, spacing: 4) {
          Text("Confidence Heatmap")
            .font(.headline)
            .fontWeight(.semibold)

          Text("Areas of high consensus are highlighted")
            .font(.caption)
            .foregroundColor(.secondary)
        }

        Spacer()

        // Legend
        HStack(spacing: 12) {
          ForEach(0..<colorScheme.count, id: \.self) { index in
            HStack(spacing: 4) {
              Rectangle()
                .fill(colorScheme[index])
                .frame(width: 12, height: 12)
                .cornerRadius(2)

              Text("\(Int(Double(index + 1) / Double(colorScheme.count) * 100))%")
                .font(.caption2)
                .foregroundColor(.secondary)
            }
          }
        }
      }
      .padding(.horizontal)

      // Enhanced visualization controls
      HStack {
        Text("Visualization Options")
          .font(.subheadline)
          .fontWeight(.medium)
        Spacer()

        Toggle("Heatmap", isOn: $showHeatmap)
          .toggleStyle(.button)
          .buttonStyle(.bordered)

        Toggle("Elements", isOn: $showElements)
          .toggleStyle(.button)
          .buttonStyle(.bordered)

        VStack(alignment: .leading, spacing: 2) {
          Text("Confidence Threshold: \(Int(selectedConfidenceThreshold * 100))%")
            .font(.caption)
          Slider(value: $selectedConfidenceThreshold, in: 0.1...1.0, step: 0.1)
            .frame(width: 120)
        }
      }
      .padding(.horizontal)

      // Heatmap visualization
      ZStack {
        // Background grid
        Rectangle()
          .fill(Color(NSColor.controlBackgroundColor))
          .cornerRadius(8)

        // Confidence heatmap
        if !confidenceData.isEmpty && showHeatmap {
          confidenceHeatmapLayer
            .transition(.opacity.combined(with: .scale))
        }

        // Detected elements overlay
        if showElements {
          detectedElementsOverlay
            .transition(.opacity.combined(with: .scale))
        }
      }
      .frame(width: imageSize.width, height: imageSize.height)
      .clipped()
      .cornerRadius(8)
      .shadow(radius: 2)

      // Element list
      if !detectedElements.isEmpty {
        detectedElementsList
      }
    }
    .padding()
    .background(Color(NSColor.controlBackgroundColor))
    .cornerRadius(12)
    .sheet(isPresented: $showElementDetails) {
      if let element = selectedElement {
        ElementDetailView(element: element)
      }
    }
  }

  // MARK: - Heatmap Layer

  private var confidenceHeatmapLayer: some View {
    Canvas { context, size in
      let cellWidth = size.width / CGFloat(confidenceData[0].count)
      let cellHeight = size.height / CGFloat(confidenceData.count)

      for (rowIndex, row) in confidenceData.enumerated() {
        for (colIndex, confidence) in row.enumerated() {
          let rect = CGRect(
            x: CGFloat(colIndex) * cellWidth,
            y: CGFloat(rowIndex) * cellHeight,
            width: cellWidth,
            height: cellHeight
          )

          let colorIndex = min(Int(confidence * Double(colorScheme.count)), colorScheme.count - 1)
          let color = colorScheme[max(0, colorIndex)]

          context.fill(Path(rect), with: .color(color))
        }
      }
    }
  }

  // MARK: - Detected Elements Overlay

  private var detectedElementsOverlay: some View {
    ForEach(detectedElements) { element in
      Rectangle()
        .stroke(elementColor(for: element.elementType), lineWidth: 2)
        .frame(
          width: element.boundingBox.width,
          height: element.boundingBox.height
        )
        .position(
          x: element.boundingBox.midX,
          y: element.boundingBox.midY
        )
        .onTapGesture {
          selectedElement = element
          showElementDetails = true
        }
        .overlay(
          // Confidence indicator
          VStack(spacing: 2) {
            Text("\(Int(element.confidence * 100))%")
              .font(.caption2)
              .fontWeight(.bold)
              .foregroundColor(.white)
              .padding(.horizontal, 4)
              .padding(.vertical, 2)
              .background(elementColor(for: element.elementType))
              .cornerRadius(4)

            Text(element.elementType.rawValue)
              .font(.caption2)
              .foregroundColor(.white)
              .padding(.horizontal, 4)
              .padding(.vertical, 2)
              .background(Color.black.opacity(0.7))
              .cornerRadius(4)
          }
          .position(
            x: element.boundingBox.midX,
            y: element.boundingBox.minY - 20
          )
        )
    }
  }

  // MARK: - Detected Elements List

  private var detectedElementsList: some View {
    VStack(alignment: .leading, spacing: 12) {
      Text("Detected Elements")
        .font(.headline)
        .fontWeight(.semibold)

      LazyVStack(spacing: 8) {
        ForEach(detectedElements.sorted(by: { $0.confidence > $1.confidence })) { element in
          ElementRowView(element: element) {
            selectedElement = element
            showElementDetails = true
          }
        }
      }
    }
    .padding()
    .background(Color(NSColor.controlBackgroundColor))
    .cornerRadius(8)
  }

  // MARK: - Helper Methods

  private func elementColor(for elementType: DetectedElement.UIElementType) -> Color {
    switch elementType {
    case .button:
      return .blue
    case .textField:
      return .green
    case .label:
      return .orange
    case .image:
      return .purple
    case .menu:
      return .red
    case .checkbox:
      return .cyan
    case .radioButton:
      return .mint
    case .slider:
      return .indigo
    case .progressBar:
      return .teal
    case .tab:
      return .pink
    case .unknown:
      return .gray
    }
  }
}

// MARK: - Element Row View

struct ElementRowView: View {
  let element: DetectedElement
  let onTap: () -> Void

  var body: some View {
    Button(action: onTap) {
      HStack(spacing: 12) {
        // Element type icon
        Image(systemName: iconName(for: element.elementType))
          .foregroundColor(elementColor(for: element.elementType))
          .frame(width: 20)

        VStack(alignment: .leading, spacing: 2) {
          Text(element.elementType.rawValue.capitalized)
            .font(.subheadline)
            .fontWeight(.medium)

          Text("Confidence: \(Int(element.confidence * 100))%")
            .font(.caption)
            .foregroundColor(.secondary)
        }

        Spacer()

        // Confidence bar
        Rectangle()
          .fill(elementColor(for: element.elementType))
          .frame(width: 60, height: 4)
          .cornerRadius(2)
          .overlay(
            Rectangle()
              .fill(Color.white)
              .frame(width: 60 * element.confidence, height: 4)
              .cornerRadius(2)
          )

        Image(systemName: "chevron.right")
          .font(.caption)
          .foregroundColor(.secondary)
      }
      .padding(.horizontal, 12)
      .padding(.vertical, 8)
      .background(Color(NSColor.controlBackgroundColor))
      .cornerRadius(6)
    }
    .buttonStyle(PlainButtonStyle())
  }

  private func iconName(for elementType: DetectedElement.UIElementType) -> String {
    switch elementType {
    case .button:
      return "button.programmable"
    case .textField:
      return "textformat"
    case .label:
      return "text.alignleft"
    case .image:
      return "photo"
    case .menu:
      return "list.bullet"
    case .checkbox:
      return "checkmark.square"
    case .radioButton:
      return "circle"
    case .slider:
      return "slider.horizontal.3"
    case .progressBar:
      return "chart.bar.fill"
    case .tab:
      return "folder"
    case .unknown:
      return "questionmark.circle"
    }
  }

  private func elementColor(for elementType: DetectedElement.UIElementType) -> Color {
    switch elementType {
    case .button:
      return .blue
    case .textField:
      return .green
    case .label:
      return .orange
    case .image:
      return .purple
    case .menu:
      return .red
    case .checkbox:
      return .cyan
    case .radioButton:
      return .mint
    case .slider:
      return .indigo
    case .progressBar:
      return .teal
    case .tab:
      return .pink
    case .unknown:
      return .gray
    }
  }
}

// MARK: - Element Detail View

struct ElementDetailView: View {
  let element: DetectedElement
  @Environment(\.dismiss) private var dismiss

  var body: some View {
    VStack(spacing: 20) {
      // Header
      HStack {
        VStack(alignment: .leading, spacing: 4) {
          Text("Element Details")
            .font(.title2)
            .fontWeight(.bold)

          Text(element.elementType.rawValue.capitalized)
            .font(.subheadline)
            .foregroundColor(.secondary)
        }

        Spacer()

        Button("Done") {
          dismiss()
        }
        .buttonStyle(.borderedProminent)
      }

      // Element information
      VStack(spacing: 16) {
        InfoRow(label: "Type", value: element.elementType.rawValue.capitalized)
        InfoRow(label: "Confidence", value: "\(Int(element.confidence * 100))%")
        InfoRow(
          label: "Position",
          value: "X: \(Int(element.boundingBox.origin.x)), Y: \(Int(element.boundingBox.origin.y))")
        InfoRow(
          label: "Size",
          value: "\(Int(element.boundingBox.width)) × \(Int(element.boundingBox.height))")
        InfoRow(label: "Timestamp", value: element.timestamp.formatted())

        if let accessibilityLabel = element.accessibilityLabel {
          InfoRow(label: "Accessibility", value: accessibilityLabel)
        }
      }
      .padding()
      .background(Color(NSColor.controlBackgroundColor))
      .cornerRadius(8)

      Spacer()
    }
    .padding()
    .frame(width: 400, height: 300)
  }
}

// MARK: - Info Row Component

// InfoRow is now defined in AgentsView.swift to avoid duplication

// MARK: - Preview

#Preview {
  ConfidenceHeatmapView(
    confidenceData: Array(
      repeating: Array(repeating: Double.random(in: 0...1), count: 100), count: 100),
    detectedElements: [
      DetectedElement(
        boundingBox: CGRect(x: 50, y: 50, width: 100, height: 40),
        elementType: .button,
        confidence: 0.85,
        description: "Submit button",
        accessibilityLabel: "Submit",
        timestamp: Date()
      )
    ],
    imageSize: CGSize(width: 400, height: 300)
  )
}
