import SwiftUI
import CoreGraphics

/// **Attention Heatmap Visualization**
/// 
/// Sophisticated 2D/3D heatmap rendering component that visualizes attention weights
/// across tokens with interactive exploration capabilities. Features:
/// - Interactive token-to-token attention exploration
/// - Multi-head attention visualization with layer selection
/// - Real-time heatmap updates as tokens are processed
/// - Color-coded attention strength with configurable scales
/// - Zoom and pan capabilities for detailed inspection

struct AttentionHeatmapView: View {
    @ObservedObject var metricsService: PerformanceMetricsService
    @State private var selectedLayer: Int = 0
    @State private var selectedHead: Int = 0
    @State private var selectedToken: Int? = nil
    @State private var heatmapMode: HeatmapMode = .attention
    @State private var colorScale: ColorScale = .viridis
    @State private var zoomLevel: Double = 1.0
    @State private var panOffset: CGSize = .zero
    @State private var isDragging = false
    @State private var showSettings = false
    @State private var animateUpdates = true
    
    var body: some View {
        VStack(spacing: 0) {
            // Heatmap Controls
            HeatmapControls(
                selectedLayer: $selectedLayer,
                selectedHead: $selectedHead,
                heatmapMode: $heatmapMode,
                colorScale: $colorScale,
                animateUpdates: $animateUpdates,
                showSettings: $showSettings,
                metricsService: metricsService
            )
            
            Divider()
            
            // Main Heatmap Content
            HStack(spacing: 0) {
                // Heatmap Canvas
                GeometryReader { geometry in
                    ZStack {
                        // Background
                        Color(NSColor.controlBackgroundColor)
                        
                        // Attention Heatmap
                        AttentionHeatmapCanvas(
                            attentionWeights: currentAttentionWeights,
                            tokens: currentTokens,
                            selectedToken: $selectedToken,
                            colorScale: colorScale,
                            zoomLevel: zoomLevel,
                            panOffset: panOffset,
                            animateUpdates: animateUpdates,
                            geometry: geometry
                        )
                        .clipped()
                        .scaleEffect(zoomLevel, anchor: .center)
                        .offset(panOffset)
                        .gesture(
                            SimultaneousGesture(
                                // Pan gesture
                                DragGesture()
                                    .onChanged { value in
                                        if !isDragging {
                                            isDragging = true
                                        }
                                        panOffset = CGSize(
                                            width: panOffset.width + value.translation.x,
                                            height: panOffset.height + value.translation.y
                                        )
                                    }
                                    .onEnded { _ in
                                        isDragging = false
                                    },
                                
                                // Zoom gesture
                                MagnificationGesture()
                                    .onChanged { value in
                                        zoomLevel = max(0.5, min(3.0, value))
                                    }
                            )
                        )
                        
                        // Loading overlay
                        if metricsService.isLoadingAttentionData {
                            LoadingOverlay()
                        }
                        
                        // Zoom and pan controls
                        VStack {
                            Spacer()
                            HStack {
                                Spacer()
                                ZoomPanControls(
                                    zoomLevel: $zoomLevel,
                                    panOffset: $panOffset
                                )
                            }
                        }
                        .padding()
                    }
                }
                
                // Side Panel with Details
                if selectedToken != nil || showSettings {
                    AttentionDetailsSidePanel(
                        selectedToken: selectedToken,
                        attentionWeights: currentAttentionWeights,
                        tokens: currentTokens,
                        layer: selectedLayer,
                        head: selectedHead,
                        showSettings: $showSettings,
                        metricsService: metricsService
                    )
                    .frame(width: 300)
                    .background(Color(NSColor.controlBackgroundColor))
                }
            }
            
            // Status Bar
            HeatmapStatusBar(
                selectedToken: selectedToken,
                totalTokens: currentTokens.count,
                layer: selectedLayer,
                head: selectedHead,
                zoomLevel: zoomLevel,
                metricsService: metricsService
            )
        }
        .onAppear {
            Task {
                await metricsService.loadAttentionData(layer: selectedLayer, head: selectedHead)
            }
        }
        .onChange(of: selectedLayer) { _ in
            Task {
                await metricsService.loadAttentionData(layer: selectedLayer, head: selectedHead)
            }
        }
        .onChange(of: selectedHead) { _ in
            Task {
                await metricsService.loadAttentionData(layer: selectedLayer, head: selectedHead)
            }
        }
    }
    
    private var currentAttentionWeights: [[Double]] {
        metricsService.getAttentionWeights(layer: selectedLayer, head: selectedHead)
    }
    
    private var currentTokens: [String] {
        metricsService.getCurrentTokens()
    }
}

// MARK: - Heatmap Controls

struct HeatmapControls: View {
    @Binding var selectedLayer: Int
    @Binding var selectedHead: Int
    @Binding var heatmapMode: HeatmapMode
    @Binding var colorScale: ColorScale
    @Binding var animateUpdates: Bool
    @Binding var showSettings: Bool
    @ObservedObject var metricsService: PerformanceMetricsService
    
    var body: some View {
        HStack(spacing: 16) {
            // Layer Selector
            VStack(alignment: .leading, spacing: 4) {
                Text("Layer")
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                Picker("Layer", selection: $selectedLayer) {
                    ForEach(0..<metricsService.availableLayers.count, id: \.self) { layer in
                        Text("Layer \(layer)").tag(layer)
                    }
                }
                .pickerStyle(.menu)
                .frame(width: 100)
            }
            
            // Head Selector
            VStack(alignment: .leading, spacing: 4) {
                Text("Head")
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                Picker("Head", selection: $selectedHead) {
                    ForEach(0..<metricsService.getHeadCount(for: selectedLayer), id: \.self) { head in
                        Text("Head \(head)").tag(head)
                    }
                }
                .pickerStyle(.menu)
                .frame(width: 100)
            }
            
            Divider()
                .frame(height: 30)
            
            // Heatmap Mode
            VStack(alignment: .leading, spacing: 4) {
                Text("Mode")
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                Picker("Mode", selection: $heatmapMode) {
                    ForEach(HeatmapMode.allCases, id: \.self) { mode in
                        Text(mode.displayName).tag(mode)
                    }
                }
                .pickerStyle(.segmented)
                .frame(width: 200)
            }
            
            // Color Scale
            VStack(alignment: .leading, spacing: 4) {
                Text("Colors")
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                Picker("Color Scale", selection: $colorScale) {
                    ForEach(ColorScale.allCases, id: \.self) { scale in
                        HStack {
                            ColorScalePreview(scale: scale)
                            Text(scale.displayName)
                        }
                        .tag(scale)
                    }
                }
                .pickerStyle(.menu)
                .frame(width: 120)
            }
            
            Spacer()
            
            // Controls
            HStack(spacing: 12) {
                // Animate toggle
                Toggle("Animate", isOn: $animateUpdates)
                    .font(.caption)
                
                // Refresh button
                Button(action: {
                    Task {
                        await metricsService.refreshAttentionData()
                    }
                }) {
                    Image(systemName: "arrow.clockwise")
                        .font(.system(size: 14, weight: .medium))
                }
                .buttonStyle(.borderless)
                .disabled(metricsService.isLoadingAttentionData)
                
                // Settings button
                Button(action: { showSettings.toggle() }) {
                    Image(systemName: "gear")
                        .font(.system(size: 14, weight: .medium))
                }
                .buttonStyle(.borderless)
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
        .background(Color(NSColor.controlBackgroundColor))
    }
}

// MARK: - Attention Heatmap Canvas

struct AttentionHeatmapCanvas: View {
    let attentionWeights: [[Double]]
    let tokens: [String]
    @Binding var selectedToken: Int?
    let colorScale: ColorScale
    let zoomLevel: Double
    let panOffset: CGSize
    let animateUpdates: Bool
    let geometry: GeometryProxy
    
    private let cellPadding: CGFloat = 1
    private let minCellSize: CGFloat = 20
    
    var body: some View {
        Canvas { context, size in
            guard !attentionWeights.isEmpty else { return }
            
            let tokenCount = attentionWeights.count
            let cellSize = max(minCellSize, min(size.width, size.height) / CGFloat(tokenCount))
            let totalSize = CGFloat(tokenCount) * cellSize
            
            // Center the heatmap
            let xOffset = (size.width - totalSize) / 2
            let yOffset = (size.height - totalSize) / 2
            
            // Draw attention cells
            for i in 0..<tokenCount {
                for j in 0..<tokenCount {
                    let attention = attentionWeights[i][j]
                    let color = colorScale.color(for: attention)
                    
                    let x = xOffset + CGFloat(j) * cellSize
                    let y = yOffset + CGFloat(i) * cellSize
                    
                    let rect = CGRect(
                        x: x + cellPadding,
                        y: y + cellPadding,
                        width: cellSize - cellPadding * 2,
                        height: cellSize - cellPadding * 2
                    )
                    
                    context.fill(Path(rect), with: .color(color))
                    
                    // Highlight selected token
                    if selectedToken == i || selectedToken == j {
                        context.stroke(
                            Path(rect.insetBy(dx: -2, dy: -2)),
                            with: .color(.white),
                            lineWidth: 2
                        )
                    }
                }
            }
            
            // Draw grid lines for better visibility
            if zoomLevel > 1.5 {
                context.stroke(
                    Path { path in
                        for i in 0...tokenCount {
                            let x = xOffset + CGFloat(i) * cellSize
                            path.move(to: CGPoint(x: x, y: yOffset))
                            path.addLine(to: CGPoint(x: x, y: yOffset + totalSize))
                            
                            let y = yOffset + CGFloat(i) * cellSize
                            path.move(to: CGPoint(x: xOffset, y: y))
                            path.addLine(to: CGPoint(x: xOffset + totalSize, y: y))
                        }
                    },
                    with: .color(.gray.opacity(0.3)),
                    lineWidth: 0.5
                )
            }
        }
        .gesture(
            TapGesture()
                .onEnded { location in
                    // Convert tap location to token index
                    if let tokenIndex = tokenIndex(for: location) {
                        selectedToken = tokenIndex == selectedToken ? nil : tokenIndex
                    }
                }
        )
        .animation(animateUpdates ? .easeInOut(duration: 0.3) : .none, value: attentionWeights)
    }
    
    private func tokenIndex(for location: CGPoint) -> Int? {
        guard !attentionWeights.isEmpty else { return nil }
        
        let tokenCount = attentionWeights.count
        let size = geometry.size
        let cellSize = max(minCellSize, min(size.width, size.height) / CGFloat(tokenCount))
        let totalSize = CGFloat(tokenCount) * cellSize
        
        let xOffset = (size.width - totalSize) / 2
        let yOffset = (size.height - totalSize) / 2
        
        let adjustedLocation = CGPoint(
            x: (location.x - panOffset.width) / zoomLevel,
            y: (location.y - panOffset.height) / zoomLevel
        )
        
        let col = Int((adjustedLocation.x - xOffset) / cellSize)
        let row = Int((adjustedLocation.y - yOffset) / cellSize)
        
        if col >= 0 && col < tokenCount && row >= 0 && row < tokenCount {
            return row
        }
        
        return nil
    }
}

// MARK: - Supporting Enums and Types

enum HeatmapMode: String, CaseIterable {
    case attention = "attention"
    case similarity = "similarity"
    case entropy = "entropy"
    
    var displayName: String {
        switch self {
        case .attention: return "Attention"
        case .similarity: return "Similarity" 
        case .entropy: return "Entropy"
        }
    }
}

enum ColorScale: String, CaseIterable {
    case viridis = "viridis"
    case plasma = "plasma"
    case inferno = "inferno"
    case coolwarm = "coolwarm"
    case blues = "blues"
    case reds = "reds"
    
    var displayName: String {
        switch self {
        case .viridis: return "Viridis"
        case .plasma: return "Plasma"
        case .inferno: return "Inferno"
        case .coolwarm: return "Cool-Warm"
        case .blues: return "Blues"
        case .reds: return "Reds"
        }
    }
    
    func color(for value: Double) -> Color {
        let normalizedValue = max(0, min(1, value))
        
        switch self {
        case .viridis:
            return viridisColor(normalizedValue)
        case .plasma:
            return plasmaColor(normalizedValue)
        case .inferno:
            return infernoColor(normalizedValue)
        case .coolwarm:
            return coolwarmColor(normalizedValue)
        case .blues:
            return Color.blue.opacity(normalizedValue)
        case .reds:
            return Color.red.opacity(normalizedValue)
        }
    }
    
    private func viridisColor(_ t: Double) -> Color {
        // Simplified viridis colormap
        let r = 0.267 * pow(t, 3) - 0.283 * pow(t, 2) + 0.031 * t + 0.267
        let g = -0.889 * pow(t, 3) + 1.909 * pow(t, 2) - 0.528 * t + 0.004
        let b = 1.777 * pow(t, 3) - 2.855 * pow(t, 2) + 1.267 * t + 0.334
        
        return Color(red: max(0, min(1, r)), green: max(0, min(1, g)), blue: max(0, min(1, b)))
    }
    
    private func plasmaColor(_ t: Double) -> Color {
        // Simplified plasma colormap
        let r = 0.535 * pow(t, 2) + 0.467 * t + 0.050
        let g = -1.347 * pow(t, 3) + 2.170 * pow(t, 2) - 0.395 * t + 0.051
        let b = -0.582 * pow(t, 2) + 1.578 * t + 0.054
        
        return Color(red: max(0, min(1, r)), green: max(0, min(1, g)), blue: max(0, min(1, b)))
    }
    
    private func infernoColor(_ t: Double) -> Color {
        // Simplified inferno colormap
        let r = 1.071 * pow(t, 2) - 0.071 * t + 0.000
        let g = 1.347 * pow(t, 3) - 1.347 * pow(t, 2) + 1.000 * t + 0.000
        let b = -0.923 * pow(t, 2) + 1.923 * t + 0.000
        
        return Color(red: max(0, min(1, r)), green: max(0, min(1, g)), blue: max(0, min(1, b)))
    }
    
    private func coolwarmColor(_ t: Double) -> Color {
        // Cool-warm diverging colormap
        if t < 0.5 {
            let s = 2 * t
            return Color(red: s, green: s, blue: 1.0)
        } else {
            let s = 2 * (t - 0.5)
            return Color(red: 1.0, green: 1.0 - s, blue: 1.0 - s)
        }
    }
}

// MARK: - Supporting Views

struct ColorScalePreview: View {
    let scale: ColorScale
    
    var body: some View {
        HStack(spacing: 1) {
            ForEach(0..<8, id: \.self) { i in
                Rectangle()
                    .fill(scale.color(for: Double(i) / 7.0))
                    .frame(width: 3, height: 12)
            }
        }
        .cornerRadius(2)
    }
}

struct ZoomPanControls: View {
    @Binding var zoomLevel: Double
    @Binding var panOffset: CGSize
    
    var body: some View {
        VStack(spacing: 8) {
            // Zoom controls
            VStack(spacing: 4) {
                Button(action: { zoomLevel = min(3.0, zoomLevel * 1.2) }) {
                    Image(systemName: "plus.magnifyingglass")
                        .font(.system(size: 14, weight: .medium))
                }
                .buttonStyle(.borderless)
                .disabled(zoomLevel >= 3.0)
                
                Text("\(Int(zoomLevel * 100))%")
                    .font(.caption2)
                    .foregroundColor(.secondary)
                
                Button(action: { zoomLevel = max(0.5, zoomLevel / 1.2) }) {
                    Image(systemName: "minus.magnifyingglass")
                        .font(.system(size: 14, weight: .medium))
                }
                .buttonStyle(.borderless)
                .disabled(zoomLevel <= 0.5)
            }
            
            // Reset button
            Button(action: {
                zoomLevel = 1.0
                panOffset = .zero
            }) {
                Image(systemName: "arrow.uturn.backward")
                    .font(.system(size: 14, weight: .medium))
            }
            .buttonStyle(.borderless)
        }
        .padding(8)
        .background(Color(NSColor.controlBackgroundColor).opacity(0.9))
        .cornerRadius(8)
    }
}

struct LoadingOverlay: View {
    var body: some View {
        ZStack {
            Color.black.opacity(0.3)
            
            VStack(spacing: 12) {
                ProgressView()
                    .scaleEffect(1.2)
                
                Text("Loading attention data...")
                    .font(.subheadline)
                    .foregroundColor(.primary)
            }
            .padding(20)
            .background(Color(NSColor.controlBackgroundColor))
            .cornerRadius(12)
        }
    }
}

struct AttentionDetailsSidePanel: View {
    let selectedToken: Int?
    let attentionWeights: [[Double]]
    let tokens: [String]
    let layer: Int
    let head: Int
    @Binding var showSettings: Bool
    @ObservedObject var metricsService: PerformanceMetricsService
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            if showSettings {
                // Settings panel
                SettingsPanel(showSettings: $showSettings)
            } else if let tokenIndex = selectedToken {
                // Token details panel
                TokenDetailsPanel(
                    tokenIndex: tokenIndex,
                    attentionWeights: attentionWeights,
                    tokens: tokens,
                    layer: layer,
                    head: head
                )
            }
            
            Spacer()
        }
        .padding()
    }
}

struct TokenDetailsPanel: View {
    let tokenIndex: Int
    let attentionWeights: [[Double]]
    let tokens: [String]
    let layer: Int
    let head: Int
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Header
            VStack(alignment: .leading, spacing: 4) {
                Text("Token Details")
                    .font(.headline)
                    .fontWeight(.semibold)
                
                Text("Layer \(layer), Head \(head)")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            // Selected token info
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("Selected Token:")
                        .font(.subheadline)
                        .fontWeight(.medium)
                    
                    Spacer()
                    
                    Text("#\(tokenIndex)")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                
                Text(tokenIndex < tokens.count ? tokens[tokenIndex] : "Unknown")
                    .font(.title3)
                    .fontWeight(.semibold)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(Color(NSColor.textBackgroundColor))
                    .cornerRadius(6)
            }
            
            // Attention statistics
            if tokenIndex < attentionWeights.count {
                VStack(alignment: .leading, spacing: 12) {
                    Text("Attention Statistics")
                        .font(.subheadline)
                        .fontWeight(.medium)
                    
                    let incomingAttention = attentionWeights.map { $0[tokenIndex] }
                    let outgoingAttention = attentionWeights[tokenIndex]
                    
                    StatisticRow(
                        title: "Max Incoming",
                        value: String(format: "%.3f", incomingAttention.max() ?? 0)
                    )
                    
                    StatisticRow(
                        title: "Avg Incoming",
                        value: String(format: "%.3f", incomingAttention.reduce(0, +) / Double(incomingAttention.count))
                    )
                    
                    StatisticRow(
                        title: "Max Outgoing",
                        value: String(format: "%.3f", outgoingAttention.max() ?? 0)
                    )
                    
                    StatisticRow(
                        title: "Avg Outgoing",
                        value: String(format: "%.3f", outgoingAttention.reduce(0, +) / Double(outgoingAttention.count))
                    )
                }
            }
            
            // Top attended tokens
            if tokenIndex < attentionWeights.count {
                TopAttendedTokens(
                    tokenIndex: tokenIndex,
                    attentionWeights: attentionWeights,
                    tokens: tokens
                )
            }
        }
    }
}

struct StatisticRow: View {
    let title: String
    let value: String
    
    var body: some View {
        HStack {
            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)
            
            Spacer()
            
            Text(value)
                .font(.caption)
                .fontWeight(.medium)
        }
    }
}

struct TopAttendedTokens: View {
    let tokenIndex: Int
    let attentionWeights: [[Double]]
    let tokens: [String]
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Top Attended Tokens")
                .font(.subheadline)
                .fontWeight(.medium)
            
            let sortedAttention = attentionWeights[tokenIndex]
                .enumerated()
                .sorted { $0.element > $1.element }
                .prefix(5)
            
            ForEach(Array(sortedAttention), id: \.offset) { item in
                HStack {
                    Text(item.offset < tokens.count ? tokens[item.offset] : "Token \(item.offset)")
                        .font(.caption)
                        .lineLimit(1)
                    
                    Spacer()
                    
                    Text(String(format: "%.3f", item.element))
                        .font(.caption)
                        .fontWeight(.medium)
                        .foregroundColor(.primary)
                }
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(Color(NSColor.textBackgroundColor))
                .cornerRadius(4)
            }
        }
    }
}

struct SettingsPanel: View {
    @Binding var showSettings: Bool
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("Heatmap Settings")
                    .font(.headline)
                    .fontWeight(.semibold)
                
                Spacer()
                
                Button(action: { showSettings = false }) {
                    Image(systemName: "xmark")
                        .font(.system(size: 12, weight: .medium))
                }
                .buttonStyle(.borderless)
            }
            
            // Settings content would go here
            Text("Heatmap configuration options coming soon...")
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
    }
}

struct HeatmapStatusBar: View {
    let selectedToken: Int?
    let totalTokens: Int
    let layer: Int
    let head: Int
    let zoomLevel: Double
    @ObservedObject var metricsService: PerformanceMetricsService
    
    var body: some View {
        HStack(spacing: 16) {
            // Token info
            Text("Tokens: \(totalTokens)")
                .font(.caption)
                .foregroundColor(.secondary)
            
            if let selectedToken = selectedToken {
                Text("Selected: #\(selectedToken)")
                    .font(.caption)
                    .foregroundColor(.primary)
            }
            
            Divider()
                .frame(height: 12)
            
            // Layer/Head info
            Text("Layer \(layer), Head \(head)")
                .font(.caption)
                .foregroundColor(.secondary)
            
            Divider()
                .frame(height: 12)
            
            // Zoom info
            Text("Zoom: \(Int(zoomLevel * 100))%")
                .font(.caption)
                .foregroundColor(.secondary)
            
            Spacer()
            
            // Connection status
            HStack(spacing: 4) {
                Circle()
                    .fill(metricsService.isConnected ? Color.green : Color.red)
                    .frame(width: 6, height: 6)
                
                Text(metricsService.isConnected ? "Live" : "Offline")
                    .font(.caption)
                    .foregroundColor(metricsService.isConnected ? .green : .red)
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 8)
        .background(Color(NSColor.controlBackgroundColor))
    }
}

#Preview {
    AttentionHeatmapView(metricsService: PerformanceMetricsService())
        .frame(width: 1000, height: 700)
}