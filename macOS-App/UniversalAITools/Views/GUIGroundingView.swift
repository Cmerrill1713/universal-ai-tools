import AppKit
import OSLog
import SwiftUI
import UniformTypeIdentifiers

/// Main view for GUI Grounding using GUI-RC approach
struct GUIGroundingView: View {
  @StateObject private var groundingService = GUIGroundingService.shared
  @EnvironmentObject var appState: AppState

  private let logger = Logger(subsystem: "com.universalai.tools", category: "GUIGroundingView")

  @State private var selectedImage: NSImage?
  @State private var instruction = ""
  @State private var isProcessing = false
  @State private var showImagePicker = false
  @State private var showResults = false
  @State private var errorMessage: String?

  // Configuration
  @State private var samplingCount = 5
  @State private var consensusThreshold = 0.7
  @State private var minConfidence = 0.3
  @State private var enableTestTimeRL = true

  // Results
  @State private var detectedElements: [DetectedElement] = []
  @State private var confidenceHeatmap: [[Double]] = []
  @State private var processingTime: TimeInterval = 0

  var body: some View {
    VStack(spacing: 0) {
      // Header
      headerSection

      Divider()

      // Main content
      HStack(spacing: 0) {
        // Left panel - Controls and image
        leftPanel

        Divider()

        // Right panel - Results and visualization
        rightPanel
      }
    }
    .navigationTitle("GUI Grounding")
    .navigationSubtitle("Region Consistency Approach")
    .sheet(isPresented: $showImagePicker) {
      ImagePicker(selectedImage: $selectedImage)
    }
    .alert("Error", isPresented: .constant(errorMessage != nil)) {
      Button("OK") {
        errorMessage = nil
      }
    } message: {
      if let errorMessage = errorMessage {
        Text(errorMessage)
      }
    }
  }

  // MARK: - Header Section

  private var headerSection: some View {
    HStack {
      VStack(alignment: .leading, spacing: 4) {
        Text("GUI Grounding with Region Consistency")
          .font(.title2)
          .fontWeight(.bold)

        Text(
          "AI-powered UI element detection using spatial voting and test-time reinforcement learning"
        )
        .font(.subheadline)
        .foregroundColor(.secondary)
      }

      Spacer()

      // Quick actions
      HStack(spacing: 12) {
        Button("Take Screenshot") {
          captureScreenshot()
        }
        .buttonStyle(.bordered)

        Button("Gallery") {
          showImagePicker = true
        }
        .buttonStyle(.bordered)
      }
    }
    .padding()
  }

  // MARK: - Left Panel

  private var leftPanel: some View {
    VStack(spacing: 20) {
      // Configuration section
      configurationSection

      // Image input section
      imageInputSection

      // Instruction input section
      instructionInputSection

      // Action buttons
      actionButtonsSection

      Spacer()
    }
    .padding()
    .frame(width: 400)
  }

  private var configurationSection: some View {
    VStack(alignment: .leading, spacing: 16) {
      Text("Configuration")
        .font(.headline)
        .fontWeight(.semibold)

      VStack(spacing: 12) {
        // Sampling count
        HStack {
          Text("Sampling Count:")
            .frame(width: 120, alignment: .leading)

          Slider(value: .constant(Double(samplingCount)), in: 3...10, step: 1) { _ in
            // Update sampling count
          }

          Text("\(samplingCount)")
            .frame(width: 30)
        }

        // Consensus threshold
        HStack {
          Text("Consensus Threshold:")
            .frame(width: 120, alignment: .leading)

          Slider(value: $consensusThreshold, in: 0.5...0.9, step: 0.1)

          Text("\(Int(consensusThreshold * 100))%")
            .frame(width: 40)
        }

        // Minimum confidence
        HStack {
          Text("Min Confidence:")
            .frame(width: 120, alignment: .leading)

          Slider(value: $minConfidence, in: 0.1...0.7, step: 0.1)

          Text("\(Int(minConfidence * 100))%")
            .frame(width: 40)
        }

        // Test-time RL toggle
        HStack {
          Text("Test-Time RL:")
            .frame(width: 120, alignment: .leading)

          Toggle("", isOn: $enableTestTimeRL)
            .toggleStyle(SwitchToggleStyle())
        }
      }
      .padding()
      .background(Color(NSColor.controlBackgroundColor))
      .cornerRadius(8)
    }
  }

  private var imageInputSection: some View {
    VStack(alignment: .leading, spacing: 12) {
      Text("Input Image")
        .font(.headline)
        .fontWeight(.semibold)

      ZStack {
        RoundedRectangle(cornerRadius: 8)
          .fill(Color(NSColor.controlBackgroundColor))
          .frame(height: 250)

        if let image = selectedImage {
          Image(nsImage: image)
            .resizable()
            .aspectRatio(contentMode: .fit)
            .frame(maxHeight: 230)
            .cornerRadius(6)
        } else {
          VStack(spacing: 12) {
            Image(systemName: "photo")
              .font(.system(size: 40))
              .foregroundColor(.secondary)

            Text("No image selected")
              .font(.subheadline)
              .foregroundColor(.secondary)

            Button("Select Image") {
              showImagePicker = true
            }
            .buttonStyle(.bordered)
          }
        }
      }
      .overlay(
        RoundedRectangle(cornerRadius: 8)
          .stroke(Color.secondary.opacity(0.3), lineWidth: 1)
      )
    }
  }

  private var instructionInputSection: some View {
    VStack(alignment: .leading, spacing: 12) {
      Text("Instruction")
        .font(.headline)
        .fontWeight(.semibold)

      TextField(
        "e.g., 'Find the submit button' or 'Locate the email input field'", text: $instruction,
        axis: .vertical
      )
      .textFieldStyle(.roundedBorder)
      .lineLimit(3...6)

      // Example instructions
      VStack(alignment: .leading, spacing: 4) {
        Text("Examples:")
          .font(.caption)
          .fontWeight(.medium)

        Text("• Click the login button")
        Text("• Find the search bar")
        Text("• Locate the submit form")
        Text("• Identify the menu icon")
      }
      .font(.caption)
      .foregroundColor(.secondary)
    }
  }

  private var actionButtonsSection: some View {
    VStack(spacing: 12) {
      Button(action: startGrounding) {
        HStack {
          if isProcessing {
            ProgressView()
              .scaleEffect(0.8)
          } else {
            Image(systemName: "magnifyingglass")
          }

          Text(isProcessing ? "Processing..." : "Start Grounding")
        }
        .frame(maxWidth: .infinity)
      }
      .buttonStyle(.borderedProminent)
      .disabled(selectedImage == nil || instruction.isEmpty || isProcessing)

      if !detectedElements.isEmpty {
        Button("Clear Results") {
          clearResults()
        }
        .buttonStyle(.bordered)
        .frame(maxWidth: .infinity)
      }
    }
  }

  // MARK: - Right Panel

  private var rightPanel: some View {
    VStack(spacing: 16) {
      if isProcessing {
        processingView
      } else if !detectedElements.isEmpty {
        resultsView
      } else {
        placeholderView
      }

      Spacer()
    }
    .padding()
  }

  private var processingView: some View {
    VStack(spacing: 20) {
      ProgressView("Processing GUI Grounding...")
        .scaleEffect(1.2)

      VStack(spacing: 8) {
        Text("Applying Region Consistency")
          .font(.headline)

        Text("• Generating multiple predictions")
        Text("• Creating spatial voting grid")
        Text("• Finding consensus regions")
        Text("• Extracting detected elements")

        if enableTestTimeRL {
          Text("• Applying test-time reinforcement learning")
            .foregroundColor(.blue)
        }
      }
      .font(.subheadline)
      .foregroundColor(.secondary)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
  }

  private var resultsView: some View {
    VStack(spacing: 16) {
      // Results summary
      HStack {
        VStack(alignment: .leading, spacing: 4) {
          Text("Detection Results")
            .font(.headline)
            .fontWeight(.semibold)

          Text(
            "Found \(detectedElements.count) elements in \(String(format: "%.2f", processingTime))s"
          )
          .font(.subheadline)
          .foregroundColor(.secondary)
        }

        Spacer()

        // Export button
        Button("Export") {
          exportResults()
        }
        .buttonStyle(.bordered)
      }

      // Confidence heatmap
      if !confidenceHeatmap.isEmpty {
        ConfidenceHeatmapView(
          confidenceData: confidenceHeatmap,
          detectedElements: detectedElements,
          imageSize: selectedImage?.size ?? CGSize(width: 400, height: 300)
        )
      }

      // Statistics
      statisticsView

      // Performance Analytics Dashboard
      PerformanceAnalyticsView(
        processingTime: processingTime,
        detectedElements: detectedElements,
        consensusThreshold: consensusThreshold,
        samplingCount: samplingCount,
        minConfidence: minConfidence
      )
    }
  }

  private var statisticsView: some View {
    VStack(alignment: .leading, spacing: 12) {
      Text("Statistics")
        .font(.headline)
        .fontWeight(.semibold)

      LazyVGrid(
        columns: [
          GridItem(.flexible()),
          GridItem(.flexible())
        ], spacing: 12
      ) {
        StatCard(
          title: "Total Elements",
          value: "\(detectedElements.count)",
          icon: "rectangle.3.group",
          color: .blue,
          trend: .stable
        )
        StatCard(
          title: "Avg Confidence",
          value: "\(Int(averageConfidence * 100))%",
          icon: "target",
          color: .green,
          trend: .stable
        )
        StatCard(
          title: "High Confidence",
          value: "\(highConfidenceCount)",
          icon: "checkmark.circle",
          color: .green,
          trend: .stable
        )
        StatCard(
          title: "Processing Time",
          value: "\(String(format: "%.2f", processingTime))s",
          icon: "clock",
          color: .orange,
          trend: .stable
        )
      }
    }
    .padding()
    .background(Color(NSColor.controlBackgroundColor))
    .cornerRadius(8)
  }

  private var placeholderView: some View {
    VStack(spacing: 20) {
      Image(systemName: "rectangle.3.group")
        .font(.system(size: 60))
        .foregroundColor(.secondary)

      VStack(spacing: 8) {
        Text("Ready to Start")
          .font(.title2)
          .fontWeight(.semibold)

        Text("Select an image and provide an instruction to begin GUI grounding")
          .font(.subheadline)
          .foregroundColor(.secondary)
          .multilineTextAlignment(.center)
      }

      // Quick start examples
      VStack(alignment: .leading, spacing: 8) {
        Text("Quick Start Examples:")
          .font(.caption)
          .fontWeight(.medium)

        Button("Take a screenshot and find buttons") {
          captureScreenshot()
          instruction = "Find all buttons on the screen"
        }
        .buttonStyle(.bordered)
        .frame(maxWidth: .infinity)

        Button("Upload an image and locate form fields") {
          showImagePicker = true
          instruction = "Locate all input fields and form elements"
        }
        .buttonStyle(.bordered)
        .frame(maxWidth: .infinity)
      }
      .font(.caption)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
  }

  // MARK: - Actions

  private func startGrounding() {
    guard let image = selectedImage, !instruction.isEmpty else { return }

    isProcessing = true
    errorMessage = nil
    let startTime = Date()

    Task {
      do {
        let elements = try await groundingService.detectElements(
          in: image, instruction: instruction)

        await MainActor.run {
          detectedElements = elements
          confidenceHeatmap = groundingService.confidenceHeatmap
          processingTime = Date().timeIntervalSince(startTime)
          showResults = true
          isProcessing = false
        }

        // Apply test-time RL if enabled
        if enableTestTimeRL {
          await groundingService.applyTestTimeRL(
            predictions: [],  // This would come from the service
            consensusRegions: elements.map(\.boundingBox)
          )
        }

      } catch {
        await MainActor.run {
          errorMessage = error.localizedDescription
          isProcessing = false
        }
      }
    }
  }

  private func captureScreenshot() {
    let task = Process()
    task.launchPath = "/usr/sbin/screencapture"
    task.arguments = ["-i", "-c"]  // Interactive mode, copy to clipboard

    do {
      try task.run()
      task.waitUntilExit()

      if task.terminationStatus == 0 {
        // Get image from clipboard
        if let image = NSPasteboard.general.readObjects(forClasses: [NSImage.self], options: nil)?
          .first as? NSImage {
          selectedImage = image
          logger.info("📸 Screenshot captured successfully")
        }
      }
    } catch {
      logger.error("Failed to capture screenshot: \(error.localizedDescription)")
    }
  }

  private func clearResults() {
    detectedElements.removeAll()
    confidenceHeatmap.removeAll()
    processingTime = 0
    showResults = false
  }

  private func exportResults() {
    // Export results to JSON or other format
    let encoder = JSONEncoder()
    encoder.outputFormatting = .prettyPrinted

    do {
      let data = try encoder.encode(detectedElements)
      let jsonString = String(data: data, encoding: .utf8) ?? ""

      let savePanel = NSSavePanel()
      savePanel.nameFieldStringValue = "gui_grounding_results.json"
      savePanel.allowedContentTypes = [.json]

      if savePanel.runModal() == .OK, let url = savePanel.url {
        try jsonString.write(to: url, atomically: true, encoding: .utf8)
        logger.info("✅ Results exported to \(url.path)")
      }
    } catch {
      errorMessage = "Failed to export results: \(error.localizedDescription)"
    }
  }

  // MARK: - Computed Properties

  private var averageConfidence: Double {
    guard !detectedElements.isEmpty else { return 0.0 }
    return detectedElements.map(\.confidence).reduce(0, +) / Double(detectedElements.count)
  }

  private var highConfidenceCount: Int {
    detectedElements.filter { $0.confidence >= 0.8 }.count
  }

  // MARK: - Performance Analytics View

  // Performance analytics view has been moved to PerformanceAnalyticsView.swift component
}

// MARK: - Stat Card Component

// StatCard is now defined in DashboardComponents.swift to avoid duplication

// MARK: - Image Picker

struct ImagePicker: NSViewControllerRepresentable {
  @Binding var selectedImage: NSImage?
  @Environment(\.dismiss) private var dismiss

  func makeNSViewController(context: Context) -> NSViewController {
    let picker = NSViewController()

    let openPanel = NSOpenPanel()
    openPanel.allowedContentTypes = [.image]
    openPanel.allowsMultipleSelection = false

    openPanel.begin { response in
      if response == .OK, let url = openPanel.url {
        if let image = NSImage(contentsOf: url) {
          selectedImage = image
        }
      }
      dismiss()
    }

    return picker
  }

  func updateNSViewController(_ nsViewController: NSViewController, context: Context) {}
}

// MARK: - Preview

#Preview {
  GUIGroundingView()
    .environmentObject(AppState())
}
