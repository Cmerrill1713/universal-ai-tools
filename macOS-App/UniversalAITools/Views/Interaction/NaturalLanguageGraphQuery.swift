//
//  NaturalLanguageGraphQuery.swift
//  UniversalAITools
//
//  Natural language interface for graph queries with NLP processing,
//  query suggestions, and voice input support
//

import SwiftUI
import NaturalLanguage
import Speech
import Combine

// MARK: - Query Types
enum QueryType: String, CaseIterable {
    case search = "search"
    case filter = "filter"
    case aggregate = "aggregate"
    case relationship = "relationship"
    case path = "path"
    case cluster = "cluster"
    case similarity = "similarity"
    case recommendation = "recommendation"
}

// MARK: - Query Intent
struct QueryIntent {
    let type: QueryType
    let entities: [String]
    let relationships: [String]
    let conditions: [String]
    let attributes: [String]
    let confidence: Double
}

// MARK: - Query Result
struct QueryResult {
    let id: UUID = UUID()
    let query: String
    let intent: QueryIntent
    let generatedQuery: String
    let queryType: QueryLanguage
    let timestamp: Date = Date()
    let executionTime: TimeInterval?
    let resultCount: Int?
}

enum QueryLanguage {
    case cypher
    case graphql
    case sparql
    case custom
}

// MARK: - Query Suggestion
struct QuerySuggestion {
    let text: String
    let type: QueryType
    let confidence: Double
    let description: String
    let example: String
}

// MARK: - Natural Language Graph Query View
struct NaturalLanguageGraphQuery: View {
    @StateObject private var queryProcessor = NLQueryProcessor()
    @StateObject private var speechRecognizer = SpeechRecognizer()
    @StateObject private var queryHistory = QueryHistoryManager()
    
    @State private var inputText: String = ""
    @State private var isListening: Bool = false
    @State private var currentSuggestions: [QuerySuggestion] = []
    @State private var queryResults: [QueryResult] = []
    @State private var showHistory: Bool = false
    @State private var selectedQueryType: QueryLanguage = .cypher
    @State private var isProcessing: Bool = false
    @State private var showAdvancedOptions: Bool = false
    
    var body: some View {
        VStack(spacing: 16) {
            queryInputSection
            suggestionsSection
            queryPreviewSection
            resultsSection
        }
        .padding()
        .background(Color(.controlBackgroundColor))
        .cornerRadius(12)
        .onAppear {
            setupNaturalLanguageProcessing()
        }
        .onChange(of: inputText) { _ in
            processInputText()
        }
    }
    
    // MARK: - Query Input Section
    private var queryInputSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Natural Language Graph Query")
                    .font(.headline)
                    .fontWeight(.semibold)
                
                Spacer()
                
                Button(action: { showAdvancedOptions.toggle() }) {
                    Image(systemName: showAdvancedOptions ? "chevron.up" : "chevron.down")
                        .foregroundColor(.secondary)
                }
                .buttonStyle(PlainButtonStyle())
            }
            
            // Main input field
            HStack {
                TextField("Ask anything about your graph...", text: $inputText)
                    .textFieldStyle(RoundedBorderTextFieldStyle())
                    .font(.body)
                    .onSubmit {
                        executeQuery()
                    }
                
                // Voice input button
                Button(action: toggleVoiceInput) {
                    Image(systemName: isListening ? "mic.fill" : "mic")
                        .foregroundColor(isListening ? .red : .blue)
                        .font(.title2)
                }
                .buttonStyle(PlainButtonStyle())
                .disabled(!speechRecognizer.isAvailable)
                
                // Execute button
                Button(action: executeQuery) {
                    if isProcessing {
                        ProgressView()
                            .scaleEffect(0.8)
                    } else {
                        Image(systemName: "play.fill")
                            .foregroundColor(.green)
                    }
                }
                .disabled(inputText.isEmpty || isProcessing)
                .buttonStyle(PlainButtonStyle())
            }
            
            // Advanced options
            if showAdvancedOptions {
                advancedOptionsView
            }
            
            // Quick action buttons
            quickActionsView
        }
    }
    
    private var advancedOptionsView: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Query Language:")
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                Picker("Query Language", selection: $selectedQueryType) {
                    Text("Cypher").tag(QueryLanguage.cypher)
                    Text("GraphQL").tag(QueryLanguage.graphql)
                    Text("SPARQL").tag(QueryLanguage.sparql)
                    Text("Custom").tag(QueryLanguage.custom)
                }
                .pickerStyle(SegmentedPickerStyle())
            }
            
            HStack {
                Toggle("Real-time preview", isOn: $queryProcessor.enableRealTimePreview)
                Spacer()
                Toggle("Query validation", isOn: $queryProcessor.enableValidation)
            }
            .font(.caption)
        }
        .padding(.vertical, 8)
        .padding(.horizontal, 12)
        .background(Color(.controlColor))
        .cornerRadius(8)
    }
    
    private var quickActionsView: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(QueryType.allCases, id: \.self) { type in
                    Button(action: { insertQuickQuery(type) }) {
                        HStack(spacing: 4) {
                            Image(systemName: iconForQueryType(type))
                                .font(.caption)
                            Text(type.rawValue.capitalized)
                                .font(.caption)
                        }
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color(.controlColor))
                        .cornerRadius(6)
                    }
                    .buttonStyle(PlainButtonStyle())
                }
                
                Button(action: { showHistory.toggle() }) {
                    HStack(spacing: 4) {
                        Image(systemName: "clock")
                            .font(.caption)
                        Text("History")
                            .font(.caption)
                    }
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color(.controlColor))
                    .cornerRadius(6)
                }
                .buttonStyle(PlainButtonStyle())
            }
            .padding(.horizontal)
        }
    }
    
    // MARK: - Suggestions Section
    private var suggestionsSection: some View {
        Group {
            if !currentSuggestions.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Suggestions")
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .foregroundColor(.secondary)
                    
                    LazyVGrid(columns: [
                        GridItem(.flexible()),
                        GridItem(.flexible())
                    ], spacing: 8) {
                        ForEach(currentSuggestions.prefix(4), id: \.text) { suggestion in
                            suggestionCard(suggestion)
                        }
                    }
                }
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
    }
    
    private func suggestionCard(_ suggestion: QuerySuggestion) -> some View {
        Button(action: { applySuggestion(suggestion) }) {
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Image(systemName: iconForQueryType(suggestion.type))
                        .foregroundColor(.blue)
                        .font(.caption)
                    
                    Text(suggestion.type.rawValue.capitalized)
                        .font(.caption)
                        .fontWeight(.medium)
                    
                    Spacer()
                    
                    Text("\(Int(suggestion.confidence * 100))%")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
                
                Text(suggestion.text)
                    .font(.caption)
                    .foregroundColor(.primary)
                    .multilineTextAlignment(.leading)
                
                Text(suggestion.description)
                    .font(.caption2)
                    .foregroundColor(.secondary)
                    .lineLimit(2)
            }
            .padding(8)
            .background(Color(.controlColor))
            .cornerRadius(8)
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(Color.blue.opacity(0.3), lineWidth: 1)
            )
        }
        .buttonStyle(PlainButtonStyle())
    }
    
    // MARK: - Query Preview Section
    private var queryPreviewSection: some View {
        Group {
            if let preview = queryProcessor.currentPreview, !preview.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text("Query Preview")
                            .font(.subheadline)
                            .fontWeight(.medium)
                        
                        Spacer()
                        
                        Text(selectedQueryType.description)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    
                    ScrollView(.horizontal, showsIndicators: false) {
                        Text(preview)
                            .font(.system(.caption, design: .monospaced))
                            .padding(8)
                            .background(Color(.textBackgroundColor))
                            .cornerRadius(6)
                    }
                    .frame(maxHeight: 80)
                }
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
    }
    
    // MARK: - Results Section
    private var resultsSection: some View {
        Group {
            if !queryResults.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Recent Queries")
                        .font(.subheadline)
                        .fontWeight(.medium)
                    
                    LazyVStack(spacing: 6) {
                        ForEach(queryResults.prefix(5)) { result in
                            queryResultCard(result)
                        }
                    }
                }
            }
        }
    }
    
    private func queryResultCard(_ result: QueryResult) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(result.query)
                    .font(.caption)
                    .fontWeight(.medium)
                    .lineLimit(1)
                
                Text(result.intent.type.rawValue.capitalized)
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            VStack(alignment: .trailing, spacing: 2) {
                if let resultCount = result.resultCount {
                    Text("\(resultCount) results")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
                
                if let executionTime = result.executionTime {
                    Text(String(format: "%.2fs", executionTime))
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding(8)
        .background(Color(.controlColor))
        .cornerRadius(6)
    }
    
    // MARK: - Methods
    private func setupNaturalLanguageProcessing() {
        queryProcessor.setup()
        speechRecognizer.setup()
    }
    
    private func processInputText() {
        guard !inputText.isEmpty else {
            currentSuggestions = []
            queryProcessor.currentPreview = nil
            return
        }
        
        // Update suggestions
        currentSuggestions = queryProcessor.generateSuggestions(for: inputText)
        
        // Update real-time preview if enabled
        if queryProcessor.enableRealTimePreview {
            queryProcessor.generatePreview(for: inputText, language: selectedQueryType)
        }
    }
    
    private func executeQuery() {
        guard !inputText.isEmpty else { return }
        
        isProcessing = true
        
        Task {
            let startTime = Date()
            let result = await queryProcessor.processQuery(inputText, language: selectedQueryType)
            let executionTime = Date().timeIntervalSince(startTime)
            
            await MainActor.run {
                var resultWithTiming = result
                resultWithTiming.executionTime = executionTime
                
                queryResults.insert(resultWithTiming, at: 0)
                queryHistory.addQuery(result)
                
                inputText = ""
                isProcessing = false
            }
        }
    }
    
    private func toggleVoiceInput() {
        if isListening {
            speechRecognizer.stopRecording()
        } else {
            speechRecognizer.startRecording { recognizedText in
                inputText = recognizedText
            }
        }
        isListening.toggle()
    }
    
    private func applySuggestion(_ suggestion: QuerySuggestion) {
        inputText = suggestion.text
        processInputText()
    }
    
    private func insertQuickQuery(_ type: QueryType) {
        let template = queryProcessor.getTemplate(for: type)
        inputText = template
        processInputText()
    }
    
    private func iconForQueryType(_ type: QueryType) -> String {
        switch type {
        case .search: return "magnifyingglass"
        case .filter: return "line.3.horizontal.decrease"
        case .aggregate: return "chart.bar"
        case .relationship: return "link"
        case .path: return "point.topleft.down.curvedto.point.bottomright.up"
        case .cluster: return "circle.grid.3x3"
        case .similarity: return "similarity"
        case .recommendation: return "star"
        }
    }
}

// MARK: - Natural Language Query Processor
@MainActor
class NLQueryProcessor: ObservableObject {
    @Published var enableRealTimePreview: Bool = true
    @Published var enableValidation: Bool = true
    @Published var currentPreview: String?
    
    private let nlTagger = NLTagger(tagSchemes: [.tokenType, .nameType, .lexicalClass])
    private var intentClassifier: NLModel?
    private var entityExtractor: EntityExtractor
    private var queryTranslator: QueryTranslator
    
    init() {
        self.entityExtractor = EntityExtractor()
        self.queryTranslator = QueryTranslator()
    }
    
    func setup() {
        // Load pre-trained models or create custom ones
        setupIntentClassifier()
    }
    
    func generateSuggestions(for text: String) -> [QuerySuggestion] {
        let intent = classifyIntent(text)
        let entities = entityExtractor.extractEntities(from: text)
        
        return generateSuggestionsForIntent(intent, entities: entities, originalText: text)
    }
    
    func generatePreview(for text: String, language: QueryLanguage) {
        let intent = classifyIntent(text)
        currentPreview = queryTranslator.translate(intent: intent, to: language)
    }
    
    func processQuery(_ text: String, language: QueryLanguage) async -> QueryResult {
        let intent = classifyIntent(text)
        let generatedQuery = queryTranslator.translate(intent: intent, to: language)
        
        return QueryResult(
            query: text,
            intent: intent,
            generatedQuery: generatedQuery,
            queryType: language
        )
    }
    
    func getTemplate(for type: QueryType) -> String {
        switch type {
        case .search:
            return "Find nodes with property [property] equal to [value]"
        case .filter:
            return "Show nodes where [condition]"
        case .aggregate:
            return "Count nodes by [grouping attribute]"
        case .relationship:
            return "Show relationships between [entity1] and [entity2]"
        case .path:
            return "Find path from [start] to [end]"
        case .cluster:
            return "Group similar nodes by [attribute]"
        case .similarity:
            return "Find nodes similar to [reference]"
        case .recommendation:
            return "Recommend connections for [entity]"
        }
    }
    
    private func setupIntentClassifier() {
        // Initialize custom intent classification model
        // This would typically load a pre-trained Core ML model
    }
    
    private func classifyIntent(_ text: String) -> QueryIntent {
        nlTagger.string = text
        
        let entities = entityExtractor.extractEntities(from: text)
        let relationships = extractRelationships(from: text)
        let conditions = extractConditions(from: text)
        let attributes = extractAttributes(from: text)
        
        let type = determineQueryType(from: text, entities: entities)
        
        return QueryIntent(
            type: type,
            entities: entities,
            relationships: relationships,
            conditions: conditions,
            attributes: attributes,
            confidence: 0.8 // Placeholder confidence score
        )
    }
    
    private func determineQueryType(from text: String, entities: [String]) -> QueryType {
        let lowercased = text.lowercased()
        
        if lowercased.contains("find") || lowercased.contains("search") || lowercased.contains("show") {
            return .search
        } else if lowercased.contains("filter") || lowercased.contains("where") {
            return .filter
        } else if lowercased.contains("count") || lowercased.contains("sum") || lowercased.contains("average") {
            return .aggregate
        } else if lowercased.contains("relationship") || lowercased.contains("connect") || lowercased.contains("between") {
            return .relationship
        } else if lowercased.contains("path") || lowercased.contains("route") {
            return .path
        } else if lowercased.contains("group") || lowercased.contains("cluster") {
            return .cluster
        } else if lowercased.contains("similar") || lowercased.contains("like") {
            return .similarity
        } else if lowercased.contains("recommend") || lowercased.contains("suggest") {
            return .recommendation
        }
        
        return .search // Default
    }
    
    private func extractRelationships(from text: String) -> [String] {
        // Extract relationship keywords from text
        return []
    }
    
    private func extractConditions(from text: String) -> [String] {
        // Extract conditional statements from text
        return []
    }
    
    private func extractAttributes(from text: String) -> [String] {
        // Extract attribute references from text
        return []
    }
    
    private func generateSuggestionsForIntent(_ intent: QueryIntent, entities: [String], originalText: String) -> [QuerySuggestion] {
        var suggestions: [QuerySuggestion] = []
        
        // Generate type-specific suggestions
        switch intent.type {
        case .search:
            suggestions.append(QuerySuggestion(
                text: "Find all nodes with label '\(entities.first ?? "Entity")'",
                type: .search,
                confidence: 0.9,
                description: "Search for nodes by label",
                example: "MATCH (n:Person) RETURN n"
            ))
        case .filter:
            suggestions.append(QuerySuggestion(
                text: "Filter nodes where property > value",
                type: .filter,
                confidence: 0.8,
                description: "Filter nodes by property conditions",
                example: "MATCH (n) WHERE n.age > 25 RETURN n"
            ))
        // Add more cases as needed
        default:
            break
        }
        
        return suggestions
    }
}

// MARK: - Supporting Classes

class EntityExtractor {
    func extractEntities(from text: String) -> [String] {
        let tagger = NLTagger(tagSchemes: [.nameType])
        tagger.string = text
        
        var entities: [String] = []
        
        tagger.enumerateTags(in: text.startIndex..<text.endIndex, unit: .word, scheme: .nameType) { tag, tokenRange in
            if let tag = tag {
                let entity = String(text[tokenRange])
                entities.append(entity)
            }
            return true
        }
        
        return entities
    }
}

class QueryTranslator {
    func translate(intent: QueryIntent, to language: QueryLanguage) -> String {
        switch language {
        case .cypher:
            return translateToCypher(intent)
        case .graphql:
            return translateToGraphQL(intent)
        case .sparql:
            return translateToSPARQL(intent)
        case .custom:
            return translateToCustom(intent)
        }
    }
    
    private func translateToCypher(_ intent: QueryIntent) -> String {
        switch intent.type {
        case .search:
            if let entity = intent.entities.first {
                return "MATCH (n:\(entity)) RETURN n LIMIT 10"
            }
            return "MATCH (n) RETURN n LIMIT 10"
        case .filter:
            return "MATCH (n) WHERE \(intent.conditions.joined(separator: " AND ")) RETURN n"
        case .relationship:
            if intent.entities.count >= 2 {
                return "MATCH (a:\(intent.entities[0]))-[r]-(b:\(intent.entities[1])) RETURN a, r, b"
            }
            return "MATCH (a)-[r]-(b) RETURN a, r, b LIMIT 10"
        default:
            return "MATCH (n) RETURN n LIMIT 10"
        }
    }
    
    private func translateToGraphQL(_ intent: QueryIntent) -> String {
        // Implement GraphQL translation
        return "{ nodes { id, label, properties } }"
    }
    
    private func translateToSPARQL(_ intent: QueryIntent) -> String {
        // Implement SPARQL translation
        return "SELECT ?subject ?predicate ?object WHERE { ?subject ?predicate ?object } LIMIT 10"
    }
    
    private func translateToCustom(_ intent: QueryIntent) -> String {
        // Implement custom query language translation
        return "CUSTOM_QUERY(\(intent.type.rawValue))"
    }
}

class QueryHistoryManager: ObservableObject {
    @Published var recentQueries: [QueryResult] = []
    @Published var favoriteQueries: [QueryResult] = []
    
    func addQuery(_ query: QueryResult) {
        recentQueries.insert(query, at: 0)
        if recentQueries.count > 50 {
            recentQueries.removeLast()
        }
    }
    
    func addToFavorites(_ query: QueryResult) {
        if !favoriteQueries.contains(where: { $0.query == query.query }) {
            favoriteQueries.append(query)
        }
    }
    
    func removeFromFavorites(_ query: QueryResult) {
        favoriteQueries.removeAll { $0.id == query.id }
    }
}

// MARK: - Speech Recognizer
class SpeechRecognizer: ObservableObject {
    @Published var isAvailable: Bool = false
    @Published var isRecording: Bool = false
    
    private let speechRecognizer = SFSpeechRecognizer()
    private let audioEngine = AVAudioEngine()
    private var recognitionTask: SFSpeechRecognitionTask?
    
    func setup() {
        requestPermission()
    }
    
    func startRecording(completion: @escaping (String) -> Void) {
        // Implement speech recognition
        isRecording = true
    }
    
    func stopRecording() {
        recognitionTask?.cancel()
        audioEngine.stop()
        isRecording = false
    }
    
    private func requestPermission() {
        SFSpeechRecognizer.requestAuthorization { status in
            DispatchQueue.main.async {
                self.isAvailable = status == .authorized
            }
        }
    }
}

// MARK: - Extensions
extension QueryLanguage {
    var description: String {
        switch self {
        case .cypher: return "Cypher"
        case .graphql: return "GraphQL"
        case .sparql: return "SPARQL"
        case .custom: return "Custom"
        }
    }
}