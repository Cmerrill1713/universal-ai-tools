//
//  SearchAndFilterSystem.swift
//  UniversalAITools
//
//  Created by Claude Code on 8/15/25.
//  Copyright © 2025 Christian Merrill. All rights reserved.
//

import Foundation
import SwiftUI
import Combine
import CoreSpotlight
import UniformTypeIdentifiers

@MainActor
class SearchAndFilterManager: ObservableObject {
    static let shared = SearchAndFilterManager()
    
    // MARK: - Published Properties
    @Published var searchQuery: String = ""
    @Published var searchResults: [SearchResult] = []
    @Published var isSearching: Bool = false
    @Published var searchHistory: [SearchHistoryItem] = []
    @Published var savedSearches: [SavedSearch] = []
    @Published var activeFilters: [SearchFilter] = []
    @Published var availableFilters: [FilterCategory] = []
    @Published var searchSuggestions: [SearchSuggestion] = []
    @Published var facetedResults: FacetedSearchResults = FacetedSearchResults()
    @Published var selectedScope: SearchScope = .all
    @Published var sortOption: SortOption = .relevance
    
    // MARK: - Private Properties
    private var cancellables = Set<AnyCancellable>()
    private var searchEngine: SearchEngine
    private var filterEngine: FilterEngine
    private var indexManager: SearchIndexManager
    private var searchDebouncer: Timer?
    
    // MARK: - Initialization
    private init() {
        self.searchEngine = SearchEngine()
        self.filterEngine = FilterEngine()
        self.indexManager = SearchIndexManager()
        
        setupSearchPipeline()
        loadSavedSearches()
        loadSearchHistory()
        setupAvailableFilters()
    }
    
    // MARK: - Public Interface
    
    /// Perform global search
    func search(_ query: String, scope: SearchScope = .all) async {
        guard !query.isEmpty else {
            clearSearchResults()
            return
        }
        
        isSearching = true
        searchQuery = query
        selectedScope = scope
        
        do {
            // Add to search history
            addToSearchHistory(query)
            
            // Perform search with current filters
            let results = try await searchEngine.search(
                query: query,
                scope: scope,
                filters: activeFilters,
                sortBy: sortOption
            )
            
            searchResults = results
            
            // Update faceted results
            facetedResults = try await searchEngine.generateFacets(for: results)
            
            // Generate suggestions
            searchSuggestions = try await searchEngine.generateSuggestions(for: query)
            
        } catch {
            print("Search failed: \(error)")
            searchResults = []
        }
        
        isSearching = false
    }
    
    /// Clear search results
    func clearSearchResults() {
        searchResults = []
        facetedResults = FacetedSearchResults()
        searchSuggestions = []
        isSearching = false
    }
    
    /// Add filter to active filters
    func addFilter(_ filter: SearchFilter) {
        if !activeFilters.contains(where: { $0.id == filter.id }) {
            activeFilters.append(filter)
            
            // Re-search with new filter
            if !searchQuery.isEmpty {
                Task {
                    await search(searchQuery, scope: selectedScope)
                }
            }
        }
    }
    
    /// Remove filter from active filters
    func removeFilter(_ filterId: String) {
        activeFilters.removeAll { $0.id == filterId }
        
        // Re-search without filter
        if !searchQuery.isEmpty {
            Task {
                await search(searchQuery, scope: selectedScope)
            }
        }
    }
    
    /// Clear all filters
    func clearFilters() {
        activeFilters.removeAll()
        
        if !searchQuery.isEmpty {
            Task {
                await search(searchQuery, scope: selectedScope)
            }
        }
    }
    
    /// Save current search
    func saveCurrentSearch(name: String) {
        let savedSearch = SavedSearch(
            id: UUID().uuidString,
            name: name,
            query: searchQuery,
            filters: activeFilters,
            scope: selectedScope,
            sortOption: sortOption,
            createdAt: Date()
        )
        
        savedSearches.append(savedSearch)
        saveSavedSearches()
    }
    
    /// Load saved search
    func loadSavedSearch(_ savedSearch: SavedSearch) {
        searchQuery = savedSearch.query
        activeFilters = savedSearch.filters
        selectedScope = savedSearch.scope
        sortOption = savedSearch.sortOption
        
        Task {
            await search(searchQuery, scope: selectedScope)
        }
    }
    
    /// Delete saved search
    func deleteSavedSearch(_ searchId: String) {
        savedSearches.removeAll { $0.id == searchId }
        saveSavedSearches()
    }
    
    /// Build advanced filter
    func buildAdvancedFilter() -> FilterBuilder {
        return FilterBuilder(manager: self)
    }
    
    /// Apply quick filter
    func applyQuickFilter(_ filterType: QuickFilterType, value: String) {
        let filter = SearchFilter(
            id: UUID().uuidString,
            type: filterType.filterType,
            field: filterType.field,
            operator: .equals,
            value: value,
            displayName: "\(filterType.displayName): \(value)"
        )
        
        addFilter(filter)
    }
    
    /// Update sort option
    func updateSortOption(_ option: SortOption) {
        sortOption = option
        
        if !searchQuery.isEmpty {
            Task {
                await search(searchQuery, scope: selectedScope)
            }
        }
    }
    
    /// Get search suggestions
    func getSearchSuggestions(for query: String) async -> [SearchSuggestion] {
        guard query.count > 1 else { return [] }
        
        return try await searchEngine.generateSuggestions(for: query)
    }
    
    /// Enable regex search
    func enableRegexSearch(_ enabled: Bool) {
        searchEngine.enableRegexSearch(enabled)
    }
    
    /// Enable fuzzy search
    func enableFuzzySearch(_ enabled: Bool, threshold: Double = 0.8) {
        searchEngine.enableFuzzySearch(enabled, threshold: threshold)
    }
    
    /// Index content for search
    func indexContent(_ content: SearchableContent) async {
        await indexManager.indexContent(content)
    }
    
    /// Remove content from index
    func removeFromIndex(_ contentId: String) async {
        await indexManager.removeContent(contentId)
    }
    
    /// Rebuild search index
    func rebuildIndex() async {
        await indexManager.rebuildIndex()
    }
    
    // MARK: - Private Implementation
    
    private func setupSearchPipeline() {
        // Setup search debouncing
        $searchQuery
            .debounce(for: .milliseconds(300), scheduler: RunLoop.main)
            .removeDuplicates()
            .sink { query in
                if !query.isEmpty {
                    Task {
                        await self.search(query, scope: self.selectedScope)
                    }
                } else {
                    self.clearSearchResults()
                }
            }
            .store(in: &cancellables)
    }
    
    private func addToSearchHistory(_ query: String) {
        // Remove existing entry if present
        searchHistory.removeAll { $0.query.lowercased() == query.lowercased() }
        
        // Add to beginning
        let historyItem = SearchHistoryItem(
            id: UUID().uuidString,
            query: query,
            timestamp: Date(),
            resultCount: searchResults.count
        )
        
        searchHistory.insert(historyItem, at: 0)
        
        // Keep only last 50 items
        if searchHistory.count > 50 {
            searchHistory = Array(searchHistory.prefix(50))
        }
        
        saveSearchHistory()
    }
    
    private func loadSavedSearches() {
        if let data = UserDefaults.standard.data(forKey: "SavedSearches"),
           let searches = try? JSONDecoder().decode([SavedSearch].self, from: data) {
            savedSearches = searches
        }
    }
    
    private func saveSavedSearches() {
        if let data = try? JSONEncoder().encode(savedSearches) {
            UserDefaults.standard.set(data, forKey: "SavedSearches")
        }
    }
    
    private func loadSearchHistory() {
        if let data = UserDefaults.standard.data(forKey: "SearchHistory"),
           let history = try? JSONDecoder().decode([SearchHistoryItem].self, from: data) {
            searchHistory = history
        }
    }
    
    private func saveSearchHistory() {
        if let data = try? JSONEncoder().encode(searchHistory) {
            UserDefaults.standard.set(data, forKey: "SearchHistory")
        }
    }
    
    private func setupAvailableFilters() {
        availableFilters = [
            FilterCategory(
                id: "content",
                name: "Content Type",
                filters: [
                    FilterOption(id: "chat", name: "Chat Messages", field: "type", value: "chat"),
                    FilterOption(id: "visualization", name: "Visualizations", field: "type", value: "visualization"),
                    FilterOption(id: "data", name: "Data Files", field: "type", value: "data"),
                    FilterOption(id: "workflow", name: "Workflows", field: "type", value: "workflow")
                ]
            ),
            FilterCategory(
                id: "date",
                name: "Date Range",
                filters: [
                    FilterOption(id: "today", name: "Today", field: "date", value: "today"),
                    FilterOption(id: "week", name: "This Week", field: "date", value: "week"),
                    FilterOption(id: "month", name: "This Month", field: "date", value: "month"),
                    FilterOption(id: "year", name: "This Year", field: "date", value: "year")
                ]
            ),
            FilterCategory(
                id: "agent",
                name: "AI Agent",
                filters: [
                    FilterOption(id: "gpt4", name: "GPT-4", field: "agent", value: "gpt4"),
                    FilterOption(id: "claude", name: "Claude", field: "agent", value: "claude"),
                    FilterOption(id: "local", name: "Local Model", field: "agent", value: "local")
                ]
            ),
            FilterCategory(
                id: "size",
                name: "File Size",
                filters: [
                    FilterOption(id: "small", name: "Small (<1MB)", field: "size", value: "small"),
                    FilterOption(id: "medium", name: "Medium (1-10MB)", field: "size", value: "medium"),
                    FilterOption(id: "large", name: "Large (>10MB)", field: "size", value: "large")
                ]
            )
        ]
    }
}

// MARK: - Search Engine

class SearchEngine {
    private var regexEnabled = false
    private var fuzzyEnabled = true
    private var fuzzyThreshold = 0.8
    
    func search(query: String, 
               scope: SearchScope, 
               filters: [SearchFilter],
               sortBy: SortOption) async throws -> [SearchResult] {
        
        // Simulate search implementation
        var results: [SearchResult] = []
        
        // Mock search results based on query
        if query.lowercased().contains("chat") {
            results.append(SearchResult(
                id: "chat-1",
                title: "AI Chat Conversation",
                content: "Discussion about machine learning models...",
                type: .chat,
                score: 0.95,
                metadata: ["agent": "GPT-4", "date": "2024-01-15"],
                url: nil
            ))
        }
        
        if query.lowercased().contains("data") {
            results.append(SearchResult(
                id: "data-1",
                title: "Sales Data Analysis",
                content: "Comprehensive analysis of Q4 sales data...",
                type: .data,
                score: 0.88,
                metadata: ["size": "2.3MB", "format": "CSV"],
                url: nil
            ))
        }
        
        if query.lowercased().contains("visualization") {
            results.append(SearchResult(
                id: "viz-1",
                title: "Performance Metrics Dashboard",
                content: "Interactive dashboard showing system performance...",
                type: .visualization,
                score: 0.82,
                metadata: ["type": "dashboard", "charts": "5"],
                url: nil
            ))
        }
        
        // Apply filters
        results = applyFilters(results, filters)
        
        // Apply sorting
        results = applySorting(results, sortBy)
        
        return results
    }
    
    func generateFacets(for results: [SearchResult]) async throws -> FacetedSearchResults {
        var facets: [SearchFacet] = []
        
        // Content type facet
        let contentTypes = Dictionary(grouping: results) { $0.type }
        let contentTypeFacet = SearchFacet(
            name: "Content Type",
            values: contentTypes.map { (type, items) in
                FacetValue(name: type.displayName, count: items.count, value: type.rawValue)
            }
        )
        facets.append(contentTypeFacet)
        
        // Date facet
        let dateGroups = Dictionary(grouping: results) { result in
            // Group by date range
            "Recent" // Simplified
        }
        let dateFacet = SearchFacet(
            name: "Date",
            values: dateGroups.map { (range, items) in
                FacetValue(name: range, count: items.count, value: range)
            }
        )
        facets.append(dateFacet)
        
        return FacetedSearchResults(
            results: results,
            facets: facets,
            totalCount: results.count
        )
    }
    
    func generateSuggestions(for query: String) async throws -> [SearchSuggestion] {
        // Generate search suggestions based on query
        var suggestions: [SearchSuggestion] = []
        
        if query.lowercased().hasPrefix("ch") {
            suggestions.append(SearchSuggestion(
                id: "chat-suggest",
                text: "chat messages",
                type: .completion,
                score: 0.9
            ))
        }
        
        if query.lowercased().hasPrefix("da") {
            suggestions.append(SearchSuggestion(
                id: "data-suggest",
                text: "data analysis",
                type: .completion,
                score: 0.85
            ))
        }
        
        if query.lowercased().hasPrefix("vi") {
            suggestions.append(SearchSuggestion(
                id: "viz-suggest",
                text: "visualization",
                type: .completion,
                score: 0.8
            ))
        }
        
        return suggestions
    }
    
    func enableRegexSearch(_ enabled: Bool) {
        regexEnabled = enabled
    }
    
    func enableFuzzySearch(_ enabled: Bool, threshold: Double) {
        fuzzyEnabled = enabled
        fuzzyThreshold = threshold
    }
    
    private func applyFilters(_ results: [SearchResult], _ filters: [SearchFilter]) -> [SearchResult] {
        var filteredResults = results
        
        for filter in filters {
            filteredResults = filteredResults.filter { result in
                switch filter.operator {
                case .equals:
                    return result.metadata[filter.field] as? String == filter.value
                case .contains:
                    if let stringValue = result.metadata[filter.field] as? String {
                        return stringValue.contains(filter.value)
                    }
                    return false
                case .startsWith:
                    if let stringValue = result.metadata[filter.field] as? String {
                        return stringValue.hasPrefix(filter.value)
                    }
                    return false
                case .endsWith:
                    if let stringValue = result.metadata[filter.field] as? String {
                        return stringValue.hasSuffix(filter.value)
                    }
                    return false
                case .greaterThan:
                    // Implement numeric comparison
                    return false
                case .lessThan:
                    // Implement numeric comparison
                    return false
                case .range:
                    // Implement range comparison
                    return false
                case .regex:
                    // Implement regex matching
                    return false
                }
            }
        }
        
        return filteredResults
    }
    
    private func applySorting(_ results: [SearchResult], _ sortBy: SortOption) -> [SearchResult] {
        switch sortBy {
        case .relevance:
            return results.sorted { $0.score > $1.score }
        case .dateNewest:
            return results.sorted { ($0.metadata["date"] as? String ?? "") > ($1.metadata["date"] as? String ?? "") }
        case .dateOldest:
            return results.sorted { ($0.metadata["date"] as? String ?? "") < ($1.metadata["date"] as? String ?? "") }
        case .title:
            return results.sorted { $0.title < $1.title }
        case .size:
            return results.sorted { ($0.metadata["size"] as? String ?? "") > ($1.metadata["size"] as? String ?? "") }
        }
    }
}

// MARK: - Filter Engine

class FilterEngine {
    func buildFilter(_ builder: FilterBuilder) -> SearchFilter {
        return builder.build()
    }
}

// MARK: - Search Index Manager

class SearchIndexManager {
    func indexContent(_ content: SearchableContent) async {
        // Index content for search
        let searchableItem = CSSearchableItem(
            uniqueIdentifier: content.id,
            domainIdentifier: "com.universalaitools.content",
            attributeSet: createAttributeSet(from: content)
        )
        
        do {
            try await CSSearchableIndex.default().indexSearchableItems([searchableItem])
        } catch {
            print("Failed to index content: \(error)")
        }
    }
    
    func removeContent(_ contentId: String) async {
        do {
            try await CSSearchableIndex.default().deleteSearchableItems(withIdentifiers: [contentId])
        } catch {
            print("Failed to remove content from index: \(error)")
        }
    }
    
    func rebuildIndex() async {
        do {
            try await CSSearchableIndex.default().deleteSearchableItems(withDomainIdentifiers: ["com.universalaitools.content"])
            // Re-index all content
        } catch {
            print("Failed to rebuild index: \(error)")
        }
    }
    
    private func createAttributeSet(from content: SearchableContent) -> CSSearchableItemAttributeSet {
        let attributeSet = CSSearchableItemAttributeSet(itemContentType: kUTTypeText as String)
        
        attributeSet.title = content.title
        attributeSet.contentDescription = content.description
        attributeSet.textContent = content.content
        attributeSet.contentCreationDate = content.createdAt
        attributeSet.contentModificationDate = content.modifiedAt
        
        return attributeSet
    }
}

// MARK: - Filter Builder

class FilterBuilder {
    private weak var manager: SearchAndFilterManager?
    private var conditions: [FilterCondition] = []
    private var logic: FilterLogic = .and
    
    init(manager: SearchAndFilterManager) {
        self.manager = manager
    }
    
    func `where`(_ field: String, _ operator: FilterOperator, _ value: String) -> FilterBuilder {
        conditions.append(FilterCondition(field: field, operator: `operator`, value: value))
        return self
    }
    
    func and(_ field: String, _ operator: FilterOperator, _ value: String) -> FilterBuilder {
        logic = .and
        conditions.append(FilterCondition(field: field, operator: `operator`, value: value))
        return self
    }
    
    func or(_ field: String, _ operator: FilterOperator, _ value: String) -> FilterBuilder {
        logic = .or
        conditions.append(FilterCondition(field: field, operator: `operator`, value: value))
        return self
    }
    
    func build() -> SearchFilter {
        return SearchFilter(
            id: UUID().uuidString,
            type: .custom,
            field: conditions.first?.field ?? "",
            operator: conditions.first?.operator ?? .equals,
            value: conditions.first?.value ?? "",
            displayName: buildDisplayName(),
            conditions: conditions,
            logic: logic
        )
    }
    
    private func buildDisplayName() -> String {
        return conditions.map { "\($0.field) \($0.operator.symbol) \($0.value)" }
                         .joined(separator: logic == .and ? " AND " : " OR ")
    }
}

// MARK: - Search UI Views

struct UniversalSearchView: View {
    @StateObject private var searchManager = SearchAndFilterManager.shared
    @State private var showingFilters = false
    @State private var showingSavedSearches = false
    
    var body: some View {
        VStack(spacing: 0) {
            // Search bar
            SearchBarView(
                searchQuery: $searchManager.searchQuery,
                isSearching: searchManager.isSearching,
                suggestions: searchManager.searchSuggestions,
                onSuggestionTap: { suggestion in
                    searchManager.searchQuery = suggestion.text
                }
            )
            
            // Filters and controls
            HStack {
                // Active filters
                if !searchManager.activeFilters.isEmpty {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(searchManager.activeFilters, id: \.id) { filter in
                                FilterChip(filter: filter) {
                                    searchManager.removeFilter(filter.id)
                                }
                            }
                        }
                        .padding(.horizontal)
                    }
                }
                
                Spacer()
                
                // Controls
                HStack(spacing: 10) {
                    Button("Filters") {
                        showingFilters.toggle()
                    }
                    .buttonStyle(.bordered)
                    
                    Button("Saved") {
                        showingSavedSearches.toggle()
                    }
                    .buttonStyle(.bordered)
                    
                    if !searchManager.searchQuery.isEmpty {
                        Button("Save") {
                            // Save current search
                        }
                        .buttonStyle(.borderedProminent)
                    }
                }
            }
            .padding()
            
            Divider()
            
            // Results
            if searchManager.isSearching {
                VStack {
                    ProgressView()
                    Text("Searching...")
                        .foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if searchManager.searchResults.isEmpty && !searchManager.searchQuery.isEmpty {
                NoResultsView(query: searchManager.searchQuery)
            } else if searchManager.searchResults.isEmpty {
                SearchHomeView()
            } else {
                SearchResultsView(
                    results: searchManager.searchResults,
                    facets: searchManager.facetedResults.facets,
                    sortOption: searchManager.sortOption,
                    onSortChange: searchManager.updateSortOption,
                    onFacetSelect: { facet, value in
                        searchManager.applyQuickFilter(.custom(facet), value: value.value)
                    }
                )
            }
        }
        .sheet(isPresented: $showingFilters) {
            FilterPanelView()
        }
        .sheet(isPresented: $showingSavedSearches) {
            SavedSearchesView()
        }
    }
}

struct SearchBarView: View {
    @Binding var searchQuery: String
    let isSearching: Bool
    let suggestions: [SearchSuggestion]
    let onSuggestionTap: (SearchSuggestion) -> Void
    
    @State private var showingSuggestions = false
    @FocusState private var isSearchFieldFocused: Bool
    
    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Image(systemName: "magnifyingglass")
                    .foregroundColor(.secondary)
                
                TextField("Search everything...", text: $searchQuery)
                    .textFieldStyle(.plain)
                    .focused($isSearchFieldFocused)
                    .onChange(of: isSearchFieldFocused) { focused in
                        showingSuggestions = focused && !suggestions.isEmpty
                    }
                
                if isSearching {
                    ProgressView()
                        .scaleEffect(0.8)
                } else if !searchQuery.isEmpty {
                    Button("Clear") {
                        searchQuery = ""
                    }
                    .buttonStyle(.plain)
                    .foregroundColor(.secondary)
                }
            }
            .padding(12)
            .background(Color(.controlBackgroundColor))
            .cornerRadius(8)
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(Color(.separatorColor), lineWidth: 1)
            )
            
            // Suggestions dropdown
            if showingSuggestions {
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(suggestions.prefix(5)) { suggestion in
                        Button {
                            onSuggestionTap(suggestion)
                            showingSuggestions = false
                        } label: {
                            HStack {
                                Image(systemName: suggestion.type.icon)
                                    .foregroundColor(.secondary)
                                
                                Text(suggestion.text)
                                
                                Spacer()
                            }
                            .padding(8)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .background(Color(.controlBackgroundColor))
                        .onHover { hovering in
                            // Highlight on hover
                        }
                    }
                }
                .background(Color(.controlBackgroundColor))
                .cornerRadius(8)
                .shadow(radius: 5)
                .padding(.top, 4)
            }
        }
        .padding()
    }
}

struct FilterChip: View {
    let filter: SearchFilter
    let onRemove: () -> Void
    
    var body: some View {
        HStack(spacing: 6) {
            Text(filter.displayName)
                .font(.caption)
            
            Button("×") {
                onRemove()
            }
            .font(.caption)
            .foregroundColor(.secondary)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(Color.blue.opacity(0.2))
        .cornerRadius(12)
    }
}

struct SearchResultsView: View {
    let results: [SearchResult]
    let facets: [SearchFacet]
    let sortOption: SortOption
    let onSortChange: (SortOption) -> Void
    let onFacetSelect: (SearchFacet, FacetValue) -> Void
    
    var body: some View {
        HStack(spacing: 0) {
            // Facets sidebar
            if !facets.isEmpty {
                VStack(alignment: .leading, spacing: 15) {
                    Text("Refine Results")
                        .font(.headline)
                        .padding(.horizontal)
                    
                    ForEach(facets, id: \.name) { facet in
                        FacetView(facet: facet) { value in
                            onFacetSelect(facet, value)
                        }
                    }
                    
                    Spacer()
                }
                .frame(width: 200)
                .padding(.vertical)
                .background(Color(.controlBackgroundColor))
                
                Divider()
            }
            
            // Results list
            VStack(spacing: 0) {
                // Results header
                HStack {
                    Text("\(results.count) results")
                        .foregroundColor(.secondary)
                    
                    Spacer()
                    
                    Picker("Sort", selection: Binding(
                        get: { sortOption },
                        set: { onSortChange($0) }
                    )) {
                        ForEach(SortOption.allCases, id: \.self) { option in
                            Text(option.displayName).tag(option)
                        }
                    }
                    .pickerStyle(.menu)
                }
                .padding()
                
                Divider()
                
                // Results
                ScrollView {
                    LazyVStack(spacing: 0) {
                        ForEach(results) { result in
                            SearchResultRow(result: result)
                            Divider()
                        }
                    }
                }
            }
        }
    }
}

struct SearchResultRow: View {
    let result: SearchResult
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: result.type.icon)
                    .foregroundColor(.blue)
                
                Text(result.title)
                    .font(.headline)
                    .lineLimit(1)
                
                Spacer()
                
                Text(String(format: "%.0f%%", result.score * 100))
                    .font(.caption)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Color.green.opacity(0.2))
                    .cornerRadius(4)
            }
            
            Text(result.content)
                .font(.body)
                .lineLimit(3)
                .foregroundColor(.secondary)
            
            // Metadata
            HStack {
                ForEach(Array(result.metadata.keys.prefix(3)), id: \.self) { key in
                    if let value = result.metadata[key] as? String {
                        Text("\(key): \(value)")
                            .font(.caption)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color(.controlBackgroundColor))
                            .cornerRadius(4)
                    }
                }
                
                Spacer()
            }
        }
        .padding()
        .background(Color.clear)
        .onTapGesture {
            // Handle result selection
        }
    }
}

struct FacetView: View {
    let facet: SearchFacet
    let onValueSelect: (FacetValue) -> Void
    
    @State private var isExpanded = true
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Button {
                isExpanded.toggle()
            } label: {
                HStack {
                    Text(facet.name)
                        .font(.subheadline)
                        .fontWeight(.medium)
                    
                    Spacer()
                    
                    Image(systemName: isExpanded ? "chevron.down" : "chevron.right")
                        .font(.caption)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .padding(.horizontal)
            
            if isExpanded {
                VStack(alignment: .leading, spacing: 4) {
                    ForEach(facet.values.prefix(8), id: \.name) { value in
                        Button {
                            onValueSelect(value)
                        } label: {
                            HStack {
                                Text(value.name)
                                    .font(.caption)
                                
                                Spacer()
                                
                                Text("\(value.count)")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                            .padding(.horizontal)
                            .padding(.vertical, 2)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }
}

struct NoResultsView: View {
    let query: String
    
    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 60))
                .foregroundColor(.secondary)
            
            Text("No results found for '\(query)'")
                .font(.title2)
            
            Text("Try adjusting your search or filters")
                .foregroundColor(.secondary)
            
            VStack(alignment: .leading, spacing: 8) {
                Text("Search tips:")
                    .font(.headline)
                
                Text("• Try different keywords")
                Text("• Remove filters")
                Text("• Check spelling")
                Text("• Use quotation marks for exact phrases")
            }
            .padding()
            .background(Color(.controlBackgroundColor))
            .cornerRadius(8)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding()
    }
}

struct SearchHomeView: View {
    @StateObject private var searchManager = SearchAndFilterManager.shared
    
    var body: some View {
        VStack(spacing: 30) {
            VStack(spacing: 10) {
                Image(systemName: "magnifyingglass.circle")
                    .font(.system(size: 60))
                    .foregroundColor(.blue)
                
                Text("Search Everything")
                    .font(.title)
                
                Text("Find chat messages, visualizations, data, and workflows")
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
            }
            
            // Recent searches
            if !searchManager.searchHistory.isEmpty {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Recent Searches")
                        .font(.headline)
                    
                    VStack(spacing: 4) {
                        ForEach(searchManager.searchHistory.prefix(5)) { item in
                            Button {
                                searchManager.searchQuery = item.query
                            } label: {
                                HStack {
                                    Image(systemName: "clock")
                                        .foregroundColor(.secondary)
                                    
                                    Text(item.query)
                                    
                                    Spacer()
                                    
                                    Text("\(item.resultCount) results")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }
                                .padding(8)
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                .frame(maxWidth: 400)
            }
            
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding()
    }
}

struct FilterPanelView: View {
    @StateObject private var searchManager = SearchAndFilterManager.shared
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationView {
            VStack(alignment: .leading, spacing: 20) {
                // Filter categories
                ForEach(searchManager.availableFilters) { category in
                    FilterCategoryView(category: category) { filter in
                        searchManager.addFilter(filter)
                    }
                }
                
                Spacer()
                
                // Advanced filter builder
                VStack(alignment: .leading, spacing: 10) {
                    Text("Advanced Filters")
                        .font(.headline)
                    
                    Text("Build complex filters with boolean logic")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    
                    Button("Build Advanced Filter") {
                        // Show advanced filter builder
                    }
                    .buttonStyle(.bordered)
                }
            }
            .padding()
            .navigationTitle("Filters")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
        .frame(width: 400, height: 500)
    }
}

struct FilterCategoryView: View {
    let category: FilterCategory
    let onFilterSelect: (SearchFilter) -> Void
    
    @State private var isExpanded = true
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Button {
                isExpanded.toggle()
            } label: {
                HStack {
                    Text(category.name)
                        .font(.headline)
                    
                    Spacer()
                    
                    Image(systemName: isExpanded ? "chevron.down" : "chevron.right")
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            
            if isExpanded {
                VStack(alignment: .leading, spacing: 4) {
                    ForEach(category.filters, id: \.id) { option in
                        Button {
                            let filter = SearchFilter(
                                id: UUID().uuidString,
                                type: .quick,
                                field: option.field,
                                operator: .equals,
                                value: option.value,
                                displayName: option.name
                            )
                            onFilterSelect(filter)
                        } label: {
                            HStack {
                                Text(option.name)
                                Spacer()
                            }
                            .padding(.horizontal, 16)
                            .padding(.vertical, 8)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .background(Color(.controlBackgroundColor))
                        .cornerRadius(6)
                    }
                }
            }
        }
    }
}

struct SavedSearchesView: View {
    @StateObject private var searchManager = SearchAndFilterManager.shared
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationView {
            VStack {
                if searchManager.savedSearches.isEmpty {
                    VStack(spacing: 20) {
                        Image(systemName: "bookmark")
                            .font(.system(size: 40))
                            .foregroundColor(.secondary)
                        
                        Text("No saved searches")
                            .font(.title2)
                        
                        Text("Save your frequently used searches for quick access")
                            .foregroundColor(.secondary)
                            .multilineTextAlignment(.center)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    List {
                        ForEach(searchManager.savedSearches) { savedSearch in
                            SavedSearchRow(savedSearch: savedSearch) {
                                searchManager.loadSavedSearch(savedSearch)
                                dismiss()
                            } onDelete: {
                                searchManager.deleteSavedSearch(savedSearch.id)
                            }
                        }
                    }
                }
            }
            .navigationTitle("Saved Searches")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
        .frame(width: 400, height: 500)
    }
}

struct SavedSearchRow: View {
    let savedSearch: SavedSearch
    let onLoad: () -> Void
    let onDelete: () -> Void
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(savedSearch.name)
                    .font(.headline)
                
                Spacer()
                
                Button("Load") {
                    onLoad()
                }
                .buttonStyle(.bordered)
                
                Button("Delete") {
                    onDelete()
                }
                .foregroundColor(.red)
            }
            
            Text(savedSearch.query)
                .font(.body)
                .foregroundColor(.secondary)
            
            HStack {
                Text("\(savedSearch.filters.count) filters")
                    .font(.caption)
                
                Text("•")
                    .font(.caption)
                
                Text(savedSearch.scope.displayName)
                    .font(.caption)
                
                Spacer()
                
                Text(savedSearch.createdAt.formatted(date: .abbreviated, time: .omitted))
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Supporting Types

enum SearchScope: String, CaseIterable, Codable {
    case all
    case chat
    case visualizations
    case data
    case workflows
    case settings
    
    var displayName: String {
        switch self {
        case .all: return "Everything"
        case .chat: return "Chat"
        case .visualizations: return "Visualizations"
        case .data: return "Data"
        case .workflows: return "Workflows"
        case .settings: return "Settings"
        }
    }
}

enum SortOption: String, CaseIterable, Codable {
    case relevance
    case dateNewest
    case dateOldest
    case title
    case size
    
    var displayName: String {
        switch self {
        case .relevance: return "Relevance"
        case .dateNewest: return "Date (Newest)"
        case .dateOldest: return "Date (Oldest)"
        case .title: return "Title"
        case .size: return "Size"
        }
    }
}

// ContentType now imported from SharedTypes

enum FilterType: String, Codable {
    case quick
    case advanced
    case custom
    case date
    case size
}

enum FilterOperator: String, CaseIterable, Codable {
    case equals
    case contains
    case startsWith
    case endsWith
    case greaterThan
    case lessThan
    case range
    case regex
    
    var symbol: String {
        switch self {
        case .equals: return "="
        case .contains: return "contains"
        case .startsWith: return "starts with"
        case .endsWith: return "ends with"
        case .greaterThan: return ">"
        case .lessThan: return "<"
        case .range: return "in range"
        case .regex: return "matches"
        }
    }
}

enum FilterLogic: String, Codable {
    case and
    case or
}

enum QuickFilterType {
    case contentType
    case dateRange
    case agent
    case size
    case custom(String)
    
    var displayName: String {
        switch self {
        case .contentType: return "Content Type"
        case .dateRange: return "Date"
        case .agent: return "Agent"
        case .size: return "Size"
        case .custom(let name): return name
        }
    }
    
    var field: String {
        switch self {
        case .contentType: return "type"
        case .dateRange: return "date"
        case .agent: return "agent"
        case .size: return "size"
        case .custom(let field): return field
        }
    }
    
    var filterType: FilterType {
        switch self {
        case .custom: return .custom
        default: return .quick
        }
    }
}

enum SuggestionType {
    case completion
    case correction
    case related
    
    var icon: String {
        switch self {
        case .completion: return "text.cursor"
        case .correction: return "wand.and.rays"
        case .related: return "link"
        }
    }
}

struct SearchResult: Identifiable, Codable {
    let id: String
    let title: String
    let content: String
    let type: ContentType
    let score: Double
    let metadata: [String: Any]
    let url: URL?
    
    enum CodingKeys: String, CodingKey {
        case id, title, content, type, score, url
    }
    
    init(id: String, title: String, content: String, type: ContentType, score: Double, metadata: [String: Any], url: URL?) {
        self.id = id
        self.title = title
        self.content = content
        self.type = type
        self.score = score
        self.metadata = metadata
        self.url = url
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        title = try container.decode(String.self, forKey: .title)
        content = try container.decode(String.self, forKey: .content)
        type = try container.decode(ContentType.self, forKey: .type)
        score = try container.decode(Double.self, forKey: .score)
        url = try container.decodeIfPresent(URL.self, forKey: .url)
        metadata = [:]
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(title, forKey: .title)
        try container.encode(content, forKey: .content)
        try container.encode(type, forKey: .type)
        try container.encode(score, forKey: .score)
        try container.encodeIfPresent(url, forKey: .url)
    }
}

struct SearchFilter: Identifiable, Codable {
    let id: String
    let type: FilterType
    let field: String
    let `operator`: FilterOperator
    let value: String
    let displayName: String
    let conditions: [FilterCondition]?
    let logic: FilterLogic?
    
    init(id: String, type: FilterType, field: String, operator: FilterOperator, value: String, displayName: String, conditions: [FilterCondition]? = nil, logic: FilterLogic? = nil) {
        self.id = id
        self.type = type
        self.field = field
        self.operator = `operator`
        self.value = value
        self.displayName = displayName
        self.conditions = conditions
        self.logic = logic
    }
}

struct FilterCondition: Codable {
    let field: String
    let `operator`: FilterOperator
    let value: String
}

struct SearchHistoryItem: Identifiable, Codable {
    let id: String
    let query: String
    let timestamp: Date
    let resultCount: Int
}

struct SavedSearch: Identifiable, Codable {
    let id: String
    let name: String
    let query: String
    let filters: [SearchFilter]
    let scope: SearchScope
    let sortOption: SortOption
    let createdAt: Date
}

struct SearchSuggestion: Identifiable, Codable {
    let id: String
    let text: String
    let type: SuggestionType
    let score: Double
    
    enum CodingKeys: String, CodingKey {
        case id, text, score
    }
    
    init(id: String, text: String, type: SuggestionType, score: Double) {
        self.id = id
        self.text = text
        self.type = type
        self.score = score
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        text = try container.decode(String.self, forKey: .text)
        score = try container.decode(Double.self, forKey: .score)
        type = .completion
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(text, forKey: .text)
        try container.encode(score, forKey: .score)
    }
}

struct FacetedSearchResults {
    let results: [SearchResult]
    let facets: [SearchFacet]
    let totalCount: Int
    
    init(results: [SearchResult] = [], facets: [SearchFacet] = [], totalCount: Int = 0) {
        self.results = results
        self.facets = facets
        self.totalCount = totalCount
    }
}

struct SearchFacet {
    let name: String
    let values: [FacetValue]
}

struct FacetValue {
    let name: String
    let count: Int
    let value: String
}

struct FilterCategory: Identifiable {
    let id: String
    let name: String
    let filters: [FilterOption]
}

struct FilterOption: Identifiable {
    let id: String
    let name: String
    let field: String
    let value: String
}

struct SearchableContent {
    let id: String
    let title: String
    let description: String
    let content: String
    let type: ContentType
    let createdAt: Date
    let modifiedAt: Date
    let metadata: [String: Any]
}