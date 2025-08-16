//
//  RealTimeParameterTuning.swift
//  UniversalAITools
//
//  Live parameter adjustment interface with real-time preview,
//  multi-parameter synchronization, and A/B testing capabilities
//

import SwiftUI
import Combine

// MARK: - Parameter Types
enum ParameterType: String, CaseIterable {
    case slider = "slider"
    case stepper = "stepper"
    case toggle = "toggle"
    case picker = "picker"
    case textField = "textField"
    case colorPicker = "colorPicker"
    case datePicker = "datePicker"
}

// MARK: - Parameter Constraint
struct ParameterConstraint {
    let minValue: Double?
    let maxValue: Double?
    let step: Double?
    let allowedValues: [Any]?
    let validationRule: ((Any) -> Bool)?
}

// MARK: - Parameter Definition
struct ParameterDefinition: Identifiable {
    let id = UUID()
    let key: String
    let displayName: String
    let description: String
    let type: ParameterType
    let defaultValue: Any
    let constraint: ParameterConstraint?
    let category: String
    let isAdvanced: Bool
    let requiresRestart: Bool
    
    init(key: String, displayName: String, description: String, type: ParameterType, 
         defaultValue: Any, constraint: ParameterConstraint? = nil, category: String = "General", 
         isAdvanced: Bool = false, requiresRestart: Bool = false) {
        self.key = key
        self.displayName = displayName
        self.description = description
        self.type = type
        self.defaultValue = defaultValue
        self.constraint = constraint
        self.category = category
        self.isAdvanced = isAdvanced
        self.requiresRestart = requiresRestart
    }
}

// MARK: - Parameter Value
struct ParameterValue: Identifiable {
    let id = UUID()
    let parameterId: UUID
    var value: Any
    let timestamp: Date = Date()
    var isModified: Bool = false
}

// MARK: - Parameter Preset
struct ParameterPreset: Identifiable, Codable {
    let id = UUID()
    let name: String
    let description: String
    let category: String
    let parameters: [String: String] // JSON encoded values
    let createdAt: Date = Date()
    let isDefault: Bool
}

// MARK: - A/B Test Configuration
struct ABTestConfiguration: Identifiable {
    let id = UUID()
    let name: String
    let description: String
    let variantA: [String: Any]
    let variantB: [String: Any]
    let metrics: [String]
    let duration: TimeInterval
    let isActive: Bool
}

// MARK: - Parameter Change History
struct ParameterChange: Identifiable {
    let id = UUID()
    let parameterId: UUID
    let oldValue: Any
    let newValue: Any
    let timestamp: Date = Date()
    let source: ChangeSource
    
    enum ChangeSource {
        case user
        case preset
        case abTest
        case automation
    }
}

// MARK: - Real Time Parameter Tuning View
struct RealTimeParameterTuning: View {
    @StateObject private var parameterManager = ParameterManager()
    @StateObject private var presetManager = PresetManager()
    @StateObject private var abTestManager = ABTestManager()
    @StateObject private var historyManager = HistoryManager()
    
    @State private var selectedCategory: String = "All"
    @State private var showAdvanced: Bool = false
    @State private var searchText: String = ""
    @State private var showPresets: Bool = false
    @State private var showABTesting: Bool = false
    @State private var showHistory: Bool = false
    @State private var selectedPreset: ParameterPreset?
    @State private var isRecording: Bool = false
    @State private var showImpactVisualization: Bool = true
    
    private let categories = ["All", "Performance", "Model", "UI", "Advanced"]
    
    var body: some View {
        VStack(spacing: 0) {
            headerSection
            
            HSplitView {
                // Parameter Controls
                parameterControlsSection
                    .frame(minWidth: 300, maxWidth: 500)
                
                // Impact Visualization
                if showImpactVisualization {
                    impactVisualizationSection
                        .frame(minWidth: 400)
                }
            }
            
            footerSection
        }
        .background(Color(.controlBackgroundColor))
        .onAppear {
            setupParameterTuning()
        }
    }
    
    // MARK: - Header Section
    private var headerSection: some View {
        VStack(spacing: 12) {
            HStack {
                Text("Real-Time Parameter Tuning")
                    .font(.title2)
                    .fontWeight(.semibold)
                
                Spacer()
                
                // Mode indicators
                HStack(spacing: 8) {
                    if isRecording {
                        HStack(spacing: 4) {
                            Circle()
                                .fill(Color.red)
                                .frame(width: 8, height: 8)
                            Text("Recording")
                                .font(.caption)
                                .foregroundColor(.red)
                        }
                    }
                    
                    if abTestManager.hasActiveTest {
                        HStack(spacing: 4) {
                            Circle()
                                .fill(Color.blue)
                                .frame(width: 8, height: 8)
                            Text("A/B Testing")
                                .font(.caption)
                                .foregroundColor(.blue)
                        }
                    }
                }
                
                // Action buttons
                HStack(spacing: 8) {
                    Button(action: { showPresets.toggle() }) {
                        Image(systemName: "list.bullet.rectangle")
                            .foregroundColor(showPresets ? .blue : .secondary)
                    }
                    
                    Button(action: { showABTesting.toggle() }) {
                        Image(systemName: "a.square.fill")
                            .foregroundColor(showABTesting ? .blue : .secondary)
                    }
                    
                    Button(action: { showHistory.toggle() }) {
                        Image(systemName: "clock.arrow.circlepath")
                            .foregroundColor(showHistory ? .blue : .secondary)
                    }
                    
                    Button(action: { showImpactVisualization.toggle() }) {
                        Image(systemName: "chart.line.uptrend.xyaxis")
                            .foregroundColor(showImpactVisualization ? .blue : .secondary)
                    }
                }
                .buttonStyle(PlainButtonStyle())
            }
            
            // Controls row
            HStack {
                // Category filter
                Picker("Category", selection: $selectedCategory) {
                    ForEach(categories, id: \.self) { category in
                        Text(category).tag(category)
                    }
                }
                .pickerStyle(SegmentedPickerStyle())
                .frame(maxWidth: 300)
                
                Spacer()
                
                // Search
                HStack {
                    Image(systemName: "magnifyingglass")
                        .foregroundColor(.secondary)
                    TextField("Search parameters...", text: $searchText)
                        .textFieldStyle(PlainTextFieldStyle())
                }
                .padding(6)
                .background(Color(.controlColor))
                .cornerRadius(6)
                .frame(width: 200)
                
                // Advanced toggle
                Toggle("Advanced", isOn: $showAdvanced)
                    .font(.caption)
            }
        }
        .padding()
        .background(Color(.controlBackgroundColor))
    }
    
    // MARK: - Parameter Controls Section
    private var parameterControlsSection: some View {
        VStack(spacing: 0) {
            if showPresets {
                presetsPanel
                    .frame(height: 200)
                Divider()
            }
            
            if showABTesting {
                abTestingPanel
                    .frame(height: 150)
                Divider()
            }
            
            if showHistory {
                historyPanel
                    .frame(height: 120)
                Divider()
            }
            
            // Main parameters
            ScrollView {
                LazyVStack(spacing: 0) {
                    ForEach(filteredParameters) { parameter in
                        parameterControlView(parameter)
                        Divider()
                    }
                }
            }
        }
        .background(Color(.textBackgroundColor))
    }
    
    private var filteredParameters: [ParameterDefinition] {
        parameterManager.parameters.filter { parameter in
            // Category filter
            let categoryMatch = selectedCategory == "All" || parameter.category == selectedCategory
            
            // Advanced filter
            let advancedMatch = showAdvanced || !parameter.isAdvanced
            
            // Search filter
            let searchMatch = searchText.isEmpty || 
                parameter.displayName.localizedCaseInsensitiveContains(searchText) ||
                parameter.description.localizedCaseInsensitiveContains(searchText)
            
            return categoryMatch && advancedMatch && searchMatch
        }
    }
    
    private func parameterControlView(_ parameter: ParameterDefinition) -> some View {
        VStack(spacing: 8) {
            // Parameter header
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(parameter.displayName)
                        .font(.subheadline)
                        .fontWeight(.medium)
                    
                    Text(parameter.description)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(2)
                }
                
                Spacer()
                
                // Parameter status indicators
                HStack(spacing: 4) {
                    if parameterManager.isModified(parameter.key) {
                        Circle()
                            .fill(Color.orange)
                            .frame(width: 6, height: 6)
                    }
                    
                    if parameter.requiresRestart {
                        Image(systemName: "restart.circle")
                            .foregroundColor(.orange)
                            .font(.caption)
                    }
                    
                    // Reset button
                    Button(action: { resetParameter(parameter) }) {
                        Image(systemName: "arrow.counterclockwise")
                            .foregroundColor(.secondary)
                            .font(.caption)
                    }
                    .buttonStyle(PlainButtonStyle())
                    .opacity(parameterManager.isModified(parameter.key) ? 1.0 : 0.0)
                }
            }
            
            // Parameter control
            parameterInputView(parameter)
            
            // Real-time impact indicator
            if showImpactVisualization {
                parameterImpactIndicator(parameter)
            }
        }
        .padding()
    }
    
    private func parameterInputView(_ parameter: ParameterDefinition) -> some View {
        Group {
            switch parameter.type {
            case .slider:
                sliderControl(parameter)
            case .stepper:
                stepperControl(parameter)
            case .toggle:
                toggleControl(parameter)
            case .picker:
                pickerControl(parameter)
            case .textField:
                textFieldControl(parameter)
            case .colorPicker:
                colorPickerControl(parameter)
            case .datePicker:
                datePickerControl(parameter)
            }
        }
    }
    
    private func sliderControl(_ parameter: ParameterDefinition) -> some View {
        HStack {
            let binding = parameterManager.binding(for: parameter.key, defaultValue: parameter.defaultValue)
            
            if let constraint = parameter.constraint,
               let min = constraint.minValue,
               let max = constraint.maxValue {
                
                Text("\(min, specifier: "%.1f")")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .frame(width: 40, alignment: .trailing)
                
                Slider(value: binding, in: min...max, step: constraint.step ?? 0.1) {
                    Text(parameter.displayName)
                } minimumValueLabel: {
                    EmptyView()
                } maximumValueLabel: {
                    EmptyView()
                } onEditingChanged: { editing in
                    if !editing {
                        parameterManager.commitChange(for: parameter.key)
                    }
                }
                .accentColor(.blue)
                
                Text("\(max, specifier: "%.1f")")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .frame(width: 40)
            }
            
            // Current value display
            TextField("Value", value: binding, format: .number)
                .textFieldStyle(RoundedBorderTextFieldStyle())
                .frame(width: 70)
                .font(.caption)
        }
    }
    
    private func stepperControl(_ parameter: ParameterDefinition) -> some View {
        HStack {
            let binding = parameterManager.binding(for: parameter.key, defaultValue: parameter.defaultValue)
            
            Stepper(value: binding, 
                   step: parameter.constraint?.step ?? 1.0) {
                HStack {
                    Text("Value:")
                        .font(.caption)
                    TextField("Value", value: binding, format: .number)
                        .textFieldStyle(RoundedBorderTextFieldStyle())
                        .frame(width: 100)
                        .font(.caption)
                }
            }
            .onChange(of: binding.wrappedValue) { _ in
                parameterManager.commitChange(for: parameter.key)
            }
        }
    }
    
    private func toggleControl(_ parameter: ParameterDefinition) -> some View {
        HStack {
            let binding = parameterManager.boolBinding(for: parameter.key, defaultValue: parameter.defaultValue as? Bool ?? false)
            
            Toggle(isOn: binding) {
                Text("Enabled")
                    .font(.caption)
            }
            .onChange(of: binding.wrappedValue) { _ in
                parameterManager.commitChange(for: parameter.key)
            }
            
            Spacer()
        }
    }
    
    private func pickerControl(_ parameter: ParameterDefinition) -> some View {
        HStack {
            if let allowedValues = parameter.constraint?.allowedValues {
                let binding = parameterManager.stringBinding(for: parameter.key, defaultValue: parameter.defaultValue as? String ?? "")
                
                Picker("Value", selection: binding) {
                    ForEach(allowedValues.indices, id: \.self) { index in
                        Text("\(allowedValues[index])")
                            .tag("\(allowedValues[index])")
                    }
                }
                .pickerStyle(MenuPickerStyle())
                .onChange(of: binding.wrappedValue) { _ in
                    parameterManager.commitChange(for: parameter.key)
                }
            }
            
            Spacer()
        }
    }
    
    private func textFieldControl(_ parameter: ParameterDefinition) -> some View {
        HStack {
            let binding = parameterManager.stringBinding(for: parameter.key, defaultValue: parameter.defaultValue as? String ?? "")
            
            TextField("Enter value", text: binding)
                .textFieldStyle(RoundedBorderTextFieldStyle())
                .onSubmit {
                    parameterManager.commitChange(for: parameter.key)
                }
        }
    }
    
    private func colorPickerControl(_ parameter: ParameterDefinition) -> some View {
        HStack {
            let binding = parameterManager.colorBinding(for: parameter.key, defaultValue: parameter.defaultValue as? Color ?? .blue)
            
            ColorPicker("Color", selection: binding, supportsOpacity: true)
                .onChange(of: binding.wrappedValue) { _ in
                    parameterManager.commitChange(for: parameter.key)
                }
            
            Spacer()
        }
    }
    
    private func datePickerControl(_ parameter: ParameterDefinition) -> some View {
        HStack {
            let binding = parameterManager.dateBinding(for: parameter.key, defaultValue: parameter.defaultValue as? Date ?? Date())
            
            DatePicker("Date", selection: binding, displayedComponents: [.date, .hourAndMinute])
                .datePickerStyle(CompactDatePickerStyle())
                .onChange(of: binding.wrappedValue) { _ in
                    parameterManager.commitChange(for: parameter.key)
                }
            
            Spacer()
        }
    }
    
    private func parameterImpactIndicator(_ parameter: ParameterDefinition) -> some View {
        HStack {
            // Impact level indicator
            let impact = parameterManager.getImpactLevel(for: parameter.key)
            
            HStack(spacing: 2) {
                ForEach(0..<5) { level in
                    Rectangle()
                        .fill(level < impact ? impactColor(for: impact) : Color.gray.opacity(0.3))
                        .frame(width: 4, height: 8)
                }
            }
            
            Text("Impact")
                .font(.caption2)
                .foregroundColor(.secondary)
            
            Spacer()
            
            // Performance indicator
            if let performance = parameterManager.getPerformanceImpact(for: parameter.key) {
                Text(performance > 0 ? "+\(performance, specifier: "%.1f")%" : "\(performance, specifier: "%.1f")%")
                    .font(.caption2)
                    .foregroundColor(performance > 0 ? .green : performance < 0 ? .red : .secondary)
            }
        }
    }
    
    // MARK: - Presets Panel
    private var presetsPanel: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Parameter Presets")
                    .font(.subheadline)
                    .fontWeight(.medium)
                
                Spacer()
                
                Button(action: saveCurrentAsPreset) {
                    Image(systemName: "plus")
                        .foregroundColor(.blue)
                }
                .buttonStyle(PlainButtonStyle())
            }
            
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(presetManager.presets) { preset in
                        presetCard(preset)
                    }
                }
                .padding(.horizontal)
            }
        }
        .padding()
    }
    
    private func presetCard(_ preset: ParameterPreset) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(preset.name)
                .font(.caption)
                .fontWeight(.medium)
                .lineLimit(1)
            
            Text(preset.description)
                .font(.caption2)
                .foregroundColor(.secondary)
                .lineLimit(2)
            
            HStack {
                if preset.isDefault {
                    Image(systemName: "star.fill")
                        .foregroundColor(.yellow)
                        .font(.caption2)
                }
                
                Spacer()
                
                Button(action: { loadPreset(preset) }) {
                    Text("Load")
                        .font(.caption2)
                        .foregroundColor(.blue)
                }
                .buttonStyle(PlainButtonStyle())
            }
        }
        .padding(8)
        .frame(width: 120, height: 80)
        .background(
            RoundedRectangle(cornerRadius: 6)
                .fill(selectedPreset?.id == preset.id ? Color.blue.opacity(0.2) : Color(.controlColor))
                .overlay(
                    RoundedRectangle(cornerRadius: 6)
                        .stroke(selectedPreset?.id == preset.id ? Color.blue : Color.clear, lineWidth: 1)
                )
        )
        .onTapGesture {
            selectedPreset = preset
        }
    }
    
    // MARK: - A/B Testing Panel
    private var abTestingPanel: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("A/B Testing")
                    .font(.subheadline)
                    .fontWeight(.medium)
                
                Spacer()
                
                Button(action: createNewABTest) {
                    Image(systemName: "plus")
                        .foregroundColor(.blue)
                }
                .buttonStyle(PlainButtonStyle())
            }
            
            if let activeTest = abTestManager.activeTest {
                activeABTestView(activeTest)
            } else {
                Text("No active A/B test")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            HStack {
                Button(action: startABTest) {
                    Text("Start Test")
                        .font(.caption)
                        .foregroundColor(.white)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 4)
                        .background(Color.green)
                        .cornerRadius(4)
                }
                .disabled(abTestManager.hasActiveTest)
                
                Button(action: stopABTest) {
                    Text("Stop Test")
                        .font(.caption)
                        .foregroundColor(.white)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 4)
                        .background(Color.red)
                        .cornerRadius(4)
                }
                .disabled(!abTestManager.hasActiveTest)
            }
            .buttonStyle(PlainButtonStyle())
        }
        .padding()
    }
    
    private func activeABTestView(_ test: ABTestConfiguration) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(test.name)
                .font(.caption)
                .fontWeight(.medium)
            
            HStack {
                Text("Variant A")
                    .font(.caption2)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Color.blue.opacity(0.2))
                    .cornerRadius(3)
                
                Text("vs")
                    .font(.caption2)
                    .foregroundColor(.secondary)
                
                Text("Variant B")
                    .font(.caption2)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Color.green.opacity(0.2))
                    .cornerRadius(3)
            }
            
            ProgressView(value: abTestManager.testProgress)
                .progressViewStyle(LinearProgressViewStyle())
        }
    }
    
    // MARK: - History Panel
    private var historyPanel: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Recent Changes")
                    .font(.subheadline)
                    .fontWeight(.medium)
                
                Spacer()
                
                Button(action: { isRecording.toggle() }) {
                    HStack(spacing: 4) {
                        Circle()
                            .fill(isRecording ? Color.red : Color.gray)
                            .frame(width: 6, height: 6)
                        Text(isRecording ? "Recording" : "Record")
                            .font(.caption)
                    }
                    .foregroundColor(isRecording ? .red : .secondary)
                }
                .buttonStyle(PlainButtonStyle())
            }
            
            ScrollView {
                LazyVStack(spacing: 4) {
                    ForEach(historyManager.recentChanges.prefix(5)) { change in
                        historyItemView(change)
                    }
                }
            }
        }
        .padding()
    }
    
    private func historyItemView(_ change: ParameterChange) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                if let parameter = parameterManager.parameter(for: change.parameterId) {
                    Text(parameter.displayName)
                        .font(.caption)
                        .fontWeight(.medium)
                }
                
                Text("\(change.oldValue) → \(change.newValue)")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            Text(change.timestamp, style: .time)
                .font(.caption2)
                .foregroundColor(.secondary)
            
            Button(action: { revertChange(change) }) {
                Image(systemName: "arrow.uturn.backward")
                    .foregroundColor(.blue)
                    .font(.caption)
            }
            .buttonStyle(PlainButtonStyle())
        }
        .padding(4)
        .background(Color(.controlColor))
        .cornerRadius(4)
    }
    
    // MARK: - Impact Visualization Section
    private var impactVisualizationSection: some View {
        VStack(spacing: 16) {
            Text("Parameter Impact Visualization")
                .font(.headline)
                .fontWeight(.semibold)
            
            // Real-time metrics charts
            ScrollView {
                LazyVStack(spacing: 16) {
                    performanceChart
                    memoryUsageChart
                    accuracyChart
                    responseTimeChart
                }
            }
        }
        .padding()
    }
    
    private var performanceChart: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Performance Impact")
                .font(.subheadline)
                .fontWeight(.medium)
            
            // Placeholder chart - would use Charts framework in real implementation
            Rectangle()
                .fill(LinearGradient(colors: [.blue.opacity(0.3), .blue.opacity(0.1)], startPoint: .top, endPoint: .bottom))
                .frame(height: 100)
                .overlay(
                    Text("Performance metrics chart")
                        .foregroundColor(.secondary)
                )
        }
    }
    
    private var memoryUsageChart: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Memory Usage")
                .font(.subheadline)
                .fontWeight(.medium)
            
            Rectangle()
                .fill(LinearGradient(colors: [.green.opacity(0.3), .green.opacity(0.1)], startPoint: .top, endPoint: .bottom))
                .frame(height: 100)
                .overlay(
                    Text("Memory usage chart")
                        .foregroundColor(.secondary)
                )
        }
    }
    
    private var accuracyChart: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Model Accuracy")
                .font(.subheadline)
                .fontWeight(.medium)
            
            Rectangle()
                .fill(LinearGradient(colors: [.orange.opacity(0.3), .orange.opacity(0.1)], startPoint: .top, endPoint: .bottom))
                .frame(height: 100)
                .overlay(
                    Text("Accuracy metrics chart")
                        .foregroundColor(.secondary)
                )
        }
    }
    
    private var responseTimeChart: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Response Time")
                .font(.subheadline)
                .fontWeight(.medium)
            
            Rectangle()
                .fill(LinearGradient(colors: [.purple.opacity(0.3), .purple.opacity(0.1)], startPoint: .top, endPoint: .bottom))
                .frame(height: 100)
                .overlay(
                    Text("Response time chart")
                        .foregroundColor(.secondary)
                )
        }
    }
    
    // MARK: - Footer Section
    private var footerSection: some View {
        HStack {
            Text("\(parameterManager.modifiedParametersCount) modified parameters")
                .font(.caption)
                .foregroundColor(.secondary)
            
            Spacer()
            
            Button(action: resetAllParameters) {
                Text("Reset All")
                    .font(.caption)
                    .foregroundColor(.red)
            }
            .disabled(parameterManager.modifiedParametersCount == 0)
            
            Button(action: applyChanges) {
                Text("Apply Changes")
                    .font(.caption)
                    .foregroundColor(.white)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 4)
                    .background(parameterManager.modifiedParametersCount > 0 ? Color.blue : Color.gray)
                    .cornerRadius(4)
            }
            .disabled(parameterManager.modifiedParametersCount == 0)
        }
        .padding()
        .background(Color(.controlBackgroundColor))
        .buttonStyle(PlainButtonStyle())
    }
    
    // MARK: - Helper Methods
    private func setupParameterTuning() {
        parameterManager.loadDefaultParameters()
        presetManager.loadPresets()
    }
    
    private func resetParameter(_ parameter: ParameterDefinition) {
        parameterManager.resetParameter(parameter.key)
    }
    
    private func saveCurrentAsPreset() {
        presetManager.saveCurrentAsPreset(parameterManager.getAllValues())
    }
    
    private func loadPreset(_ preset: ParameterPreset) {
        selectedPreset = preset
        parameterManager.loadPreset(preset)
    }
    
    private func createNewABTest() {
        abTestManager.createNewTest(with: parameterManager.getAllValues())
    }
    
    private func startABTest() {
        abTestManager.startActiveTest()
    }
    
    private func stopABTest() {
        abTestManager.stopActiveTest()
    }
    
    private func revertChange(_ change: ParameterChange) {
        historyManager.revertChange(change, parameterManager: parameterManager)
    }
    
    private func resetAllParameters() {
        parameterManager.resetAllParameters()
    }
    
    private func applyChanges() {
        parameterManager.applyAllChanges()
    }
    
    private func impactColor(for level: Int) -> Color {
        switch level {
        case 0...1: return .green
        case 2...3: return .orange
        default: return .red
        }
    }
}

// MARK: - Parameter Manager
@MainActor
class ParameterManager: ObservableObject {
    @Published var parameters: [ParameterDefinition] = []
    @Published var values: [String: Any] = [:]
    @Published var modifiedKeys: Set<String> = []
    
    var modifiedParametersCount: Int {
        modifiedKeys.count
    }
    
    func loadDefaultParameters() {
        parameters = [
            ParameterDefinition(
                key: "model_temperature",
                displayName: "Temperature",
                description: "Controls randomness in model output",
                type: .slider,
                defaultValue: 0.7,
                constraint: ParameterConstraint(minValue: 0.0, maxValue: 2.0, step: 0.1, allowedValues: nil, validationRule: nil),
                category: "Model"
            ),
            ParameterDefinition(
                key: "max_tokens",
                displayName: "Max Tokens",
                description: "Maximum number of tokens to generate",
                type: .stepper,
                defaultValue: 1000.0,
                constraint: ParameterConstraint(minValue: 1.0, maxValue: 4000.0, step: 100.0, allowedValues: nil, validationRule: nil),
                category: "Model"
            ),
            ParameterDefinition(
                key: "enable_streaming",
                displayName: "Enable Streaming",
                description: "Stream responses as they are generated",
                type: .toggle,
                defaultValue: true,
                category: "Performance"
            ),
            ParameterDefinition(
                key: "response_format",
                displayName: "Response Format",
                description: "Format for model responses",
                type: .picker,
                defaultValue: "json",
                constraint: ParameterConstraint(minValue: nil, maxValue: nil, step: nil, allowedValues: ["json", "text", "markdown"], validationRule: nil),
                category: "Model"
            )
        ]
        
        // Initialize values with defaults
        for parameter in parameters {
            values[parameter.key] = parameter.defaultValue
        }
    }
    
    func binding(for key: String, defaultValue: Any) -> Binding<Double> {
        Binding(
            get: { self.values[key] as? Double ?? defaultValue as? Double ?? 0.0 },
            set: { newValue in
                self.values[key] = newValue
                self.modifiedKeys.insert(key)
            }
        )
    }
    
    func boolBinding(for key: String, defaultValue: Bool) -> Binding<Bool> {
        Binding(
            get: { self.values[key] as? Bool ?? defaultValue },
            set: { newValue in
                self.values[key] = newValue
                self.modifiedKeys.insert(key)
            }
        )
    }
    
    func stringBinding(for key: String, defaultValue: String) -> Binding<String> {
        Binding(
            get: { self.values[key] as? String ?? defaultValue },
            set: { newValue in
                self.values[key] = newValue
                self.modifiedKeys.insert(key)
            }
        )
    }
    
    func colorBinding(for key: String, defaultValue: Color) -> Binding<Color> {
        Binding(
            get: { self.values[key] as? Color ?? defaultValue },
            set: { newValue in
                self.values[key] = newValue
                self.modifiedKeys.insert(key)
            }
        )
    }
    
    func dateBinding(for key: String, defaultValue: Date) -> Binding<Date> {
        Binding(
            get: { self.values[key] as? Date ?? defaultValue },
            set: { newValue in
                self.values[key] = newValue
                self.modifiedKeys.insert(key)
            }
        )
    }
    
    func isModified(_ key: String) -> Bool {
        modifiedKeys.contains(key)
    }
    
    func resetParameter(_ key: String) {
        if let parameter = parameters.first(where: { $0.key == key }) {
            values[key] = parameter.defaultValue
            modifiedKeys.remove(key)
        }
    }
    
    func resetAllParameters() {
        for parameter in parameters {
            values[parameter.key] = parameter.defaultValue
        }
        modifiedKeys.removeAll()
    }
    
    func commitChange(for key: String) {
        // Trigger any real-time updates
        NotificationCenter.default.post(name: .parameterChanged, object: key)
    }
    
    func getAllValues() -> [String: Any] {
        return values
    }
    
    func loadPreset(_ preset: ParameterPreset) {
        // Load preset values
        for (key, encodedValue) in preset.parameters {
            // Decode JSON value and set
            values[key] = encodedValue
            modifiedKeys.insert(key)
        }
    }
    
    func parameter(for id: UUID) -> ParameterDefinition? {
        return parameters.first { $0.id == id }
    }
    
    func getImpactLevel(for key: String) -> Int {
        // Calculate impact level based on parameter importance
        return Int.random(in: 0...5) // Placeholder
    }
    
    func getPerformanceImpact(for key: String) -> Double? {
        // Calculate performance impact
        return Double.random(in: -10...10) // Placeholder
    }
    
    func applyAllChanges() {
        // Apply all parameter changes
        modifiedKeys.removeAll()
        NotificationCenter.default.post(name: .parametersApplied, object: nil)
    }
}

// MARK: - Supporting Managers
@MainActor
class PresetManager: ObservableObject {
    @Published var presets: [ParameterPreset] = []
    
    func loadPresets() {
        // Load saved presets
        presets = [
            ParameterPreset(
                name: "High Performance",
                description: "Optimized for speed",
                category: "Performance",
                parameters: [:],
                isDefault: true
            ),
            ParameterPreset(
                name: "High Quality",
                description: "Optimized for accuracy",
                category: "Quality",
                parameters: [:],
                isDefault: false
            )
        ]
    }
    
    func saveCurrentAsPreset(_ values: [String: Any]) {
        // Save current parameter values as a preset
    }
}

@MainActor
class ABTestManager: ObservableObject {
    @Published var activeTest: ABTestConfiguration?
    @Published var testProgress: Double = 0.0
    
    var hasActiveTest: Bool {
        activeTest?.isActive ?? false
    }
    
    func createNewTest(with parameters: [String: Any]) {
        // Create new A/B test configuration
    }
    
    func startActiveTest() {
        // Start the active test
    }
    
    func stopActiveTest() {
        // Stop the active test
    }
}

@MainActor
class HistoryManager: ObservableObject {
    @Published var recentChanges: [ParameterChange] = []
    
    func addChange(_ change: ParameterChange) {
        recentChanges.insert(change, at: 0)
        if recentChanges.count > 50 {
            recentChanges.removeLast()
        }
    }
    
    func revertChange(_ change: ParameterChange, parameterManager: ParameterManager) {
        // Revert the parameter change
        parameterManager.values[change.parameterId.uuidString] = change.oldValue
    }
}

// MARK: - Notification Extensions
extension Notification.Name {
    static let parameterChanged = Notification.Name("parameterChanged")
    static let parametersApplied = Notification.Name("parametersApplied")
}