import SwiftUI

struct RAGSourceAttributionView: View {
    let attributions: [SourceAttribution]
    let contexts: [ContextNode]
    
    @State private var selectedAttribution: SourceAttribution?
    @State private var selectedSource: String?
    @State private var expandedSources: Set<String> = []
    @State private var sortBy: SortOption = .contribution
    @State private var filterBy: FilterOption = .all
    @State private var showPreview = true
    @State private var showQualityMetrics = true
    @State private var searchText = ""
    @State private var hoveredSource: String?
    
    enum SortOption: String, CaseIterable {
        case contribution = "Contribution"
        case quality = "Quality"
        case type = "Type"
        case alphabetical = "Alphabetical"
        
        var icon: String {
            switch self {
            case .contribution: return "chart.bar.fill"
            case .quality: return "star.fill"
            case .type: return "folder.fill"
            case .alphabetical: return "textformat.abc"
            }
        }
    }
    
    enum FilterOption: String, CaseIterable {
        case all = "All Sources"
        case files = "Files"
        case web = "Web"
        case database = "Database"
        case memory = "Memory"
        
        var icon: String {
            switch self {
            case .all: return "square.stack.3d.up"
            case .files: return "doc.text"
            case .web: return "globe"
            case .database: return "server.rack"
            case .memory: return "brain.head.profile"
            }
        }
    }
    
    var body: some View {
        GeometryReader { geometry in
            HStack(spacing: 0) {
                // Source tree view
                sourceTreeView
                    .frame(width: geometry.size.width * 0.6)
                
                Divider()
                
                // Source details and preview
                sourceDetailsView
                    .frame(width: geometry.size.width * 0.4)
            }
        }
        .background(AppTheme.primaryBackground)
        .overlay(
            VStack {
                headerView
                Spacer()
            },
            alignment: .top
        )
    }
    
    // MARK: - Header View
    
    private var headerView: some View {
        VStack(spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Source Attribution")
                        .font(AppTheme.title3)
                        .fontWeight(.semibold)
                        .foregroundColor(AppTheme.primaryText)
                    
                    Text("\(filteredAttributions.count) sources contributing to responses")
                        .font(AppTheme.caption)
                        .foregroundColor(AppTheme.secondaryText)
                }
                
                Spacer()
                
                HStack(spacing: 12) {
                    // Search field
                    HStack {
                        Image(systemName: "magnifyingglass")
                            .foregroundColor(AppTheme.tertiaryText)
                        
                        TextField("Search sources...", text: $searchText)
                            .textFieldStyle(.plain)
                    }
                    .padding(.horizontal, 8)
                    .padding(.vertical, 6)
                    .background(AppTheme.surfaceBackground)
                    .cornerRadius(6)
                    .frame(width: 200)
                    
                    // Sort options
                    Menu {
                        ForEach(SortOption.allCases, id: \.self) { option in
                            Button(action: { sortBy = option }) {
                                HStack {
                                    Image(systemName: option.icon)
                                    Text(option.rawValue)
                                    if sortBy == option {
                                        Spacer()
                                        Image(systemName: "checkmark")
                                    }
                                }
                            }
                        }
                    } label: {
                        HStack {
                            Image(systemName: sortBy.icon)
                            Text("Sort by \(sortBy.rawValue)")
                        }
                        .font(AppTheme.caption)
                        .foregroundColor(AppTheme.primaryText)
                    }
                    .menuStyle(.borderlessButton)
                    
                    // Filter options
                    Menu {
                        ForEach(FilterOption.allCases, id: \.self) { option in
                            Button(action: { filterBy = option }) {
                                HStack {
                                    Image(systemName: option.icon)
                                    Text(option.rawValue)
                                    if filterBy == option {
                                        Spacer()
                                        Image(systemName: "checkmark")
                                    }
                                }
                            }
                        }
                    } label: {
                        HStack {
                            Image(systemName: filterBy.icon)
                            Text(filterBy.rawValue)
                        }
                        .font(AppTheme.caption)
                        .foregroundColor(AppTheme.primaryText)
                    }
                    .menuStyle(.borderlessButton)
                }
            }
            
            // View options
            HStack {
                Toggle("Show Preview", isOn: $showPreview)
                    .toggleStyle(.switch)
                    .controlSize(.mini)
                
                Toggle("Show Quality Metrics", isOn: $showQualityMetrics)
                    .toggleStyle(.switch)
                    .controlSize(.mini)
                
                Spacer()
                
                // Statistics
                HStack(spacing: 16) {
                    StatLabel(label: "Avg Quality", value: String(format: "%.1f%%", averageQuality * 100))
                    StatLabel(label: "Top Source", value: topSourceType)
                    StatLabel(label: "Total Citations", value: "\(filteredAttributions.count)")
                }
            }
        }
        .padding(16)
        .background(AppTheme.secondaryBackground)
        .overlay(
            Rectangle()
                .frame(height: 1)
                .foregroundColor(AppTheme.separator),
            alignment: .bottom
        )
    }
    
    // MARK: - Source Tree View
    
    private var sourceTreeView: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 0) {
                ForEach(groupedSources.keys.sorted(), id: \.self) { sourceType in
                    sourceTypeSection(sourceType: sourceType, sources: groupedSources[sourceType] ?? [])
                }
            }
            .padding(.top, 140) // Account for header height
        }
        .background(AppTheme.primaryBackground)
    }
    
    private func sourceTypeSection(sourceType: String, sources: [SourceAttribution]) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            // Section header
            HStack {
                Button(action: {
                    withAnimation(AppTheme.quickAnimation) {
                        if expandedSources.contains(sourceType) {
                            expandedSources.remove(sourceType)
                        } else {
                            expandedSources.insert(sourceType)
                        }
                    }
                }) {
                    HStack {
                        Image(systemName: expandedSources.contains(sourceType) ? "chevron.down" : "chevron.right")
                            .font(.system(size: 12))
                            .foregroundColor(AppTheme.secondaryText)
                        
                        Image(systemName: iconForSourceType(sourceType))
                            .font(.system(size: 16))
                            .foregroundColor(colorForSourceType(sourceType))
                        
                        Text(sourceType.capitalized)
                            .font(AppTheme.headline)
                            .fontWeight(.medium)
                            .foregroundColor(AppTheme.primaryText)
                        
                        Text("(\(sources.count))")
                            .font(AppTheme.caption)
                            .foregroundColor(AppTheme.tertiaryText)
                        
                        Spacer()
                        
                        // Section quality indicator
                        let avgQuality = sources.map { $0.qualityMetrics.overall }.reduce(0, +) / Float(sources.count)
                        QualityIndicator(quality: avgQuality, size: .small)
                    }
                }
                .buttonStyle(.plain)
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .background(
                    hoveredSource == sourceType ? AppTheme.surfaceBackground.opacity(0.5) : Color.clear
                )
                .onHover { isHovering in
                    hoveredSource = isHovering ? sourceType : nil
                }
            }
            
            // Section content
            if expandedSources.contains(sourceType) {
                ForEach(sources, id: \.id) { attribution in
                    sourceAttributionRow(attribution)
                }
            }
        }
    }
    
    private func sourceAttributionRow(_ attribution: SourceAttribution) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                // Indentation for tree structure
                Rectangle()
                    .fill(AppTheme.separator)
                    .frame(width: 2, height: 20)
                    .padding(.leading, 32)
                
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        // Source title
                        Text(displayTitle(for: attribution))
                            .font(AppTheme.body)
                            .fontWeight(.medium)
                            .foregroundColor(AppTheme.primaryText)
                            .lineLimit(1)
                        
                        Spacer()
                        
                        // Contribution score
                        ContributionBadge(score: attribution.contributionScore)
                    }
                    
                    // Source path/URL
                    if let path = attribution.citationInfo.path {
                        Text(path)
                            .font(AppTheme.caption)
                            .foregroundColor(AppTheme.tertiaryText)
                            .lineLimit(1)
                    } else if let url = attribution.citationInfo.url {
                        Text(url)
                            .font(AppTheme.caption)
                            .foregroundColor(AppTheme.accentBlue)
                            .lineLimit(1)
                    }
                    
                    // Quality metrics (if enabled)
                    if showQualityMetrics {
                        qualityMetricsView(for: attribution.qualityMetrics)
                    }
                }
                
                Spacer()
                
                // Action buttons
                HStack(spacing: 6) {
                    Button(action: {
                        withAnimation(AppTheme.normalAnimation) {
                            selectedAttribution = selectedAttribution?.id == attribution.id ? nil : attribution
                        }
                    }) {
                        Image(systemName: "info.circle")
                            .font(.system(size: 16))
                            .foregroundColor(AppTheme.secondaryText)
                    }
                    .buttonStyle(.plain)
                    
                    if attribution.citationInfo.url != nil {
                        Button(action: {
                            openURL(attribution.citationInfo.url!)
                        }) {
                            Image(systemName: "arrow.up.right.square")
                                .font(.system(size: 16))
                                .foregroundColor(AppTheme.accentBlue)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            
            // Line numbers (if available)
            if let lineNumbers = attribution.citationInfo.lineNumbers, !lineNumbers.isEmpty {
                HStack {
                    Rectangle()
                        .fill(Color.clear)
                        .frame(width: 34)
                    
                    Text("Lines: \(lineNumbers.map(String.init).joined(separator: ", "))")
                        .font(AppTheme.caption2)
                        .foregroundColor(AppTheme.quaternaryText)
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(
            selectedAttribution?.id == attribution.id ? AppTheme.surfaceBackground.opacity(0.3) :
            hoveredSource == attribution.id ? AppTheme.surfaceBackground.opacity(0.1) : Color.clear
        )
        .onTapGesture {
            withAnimation(AppTheme.normalAnimation) {
                selectedAttribution = selectedAttribution?.id == attribution.id ? nil : attribution
            }
        }
        .onHover { isHovering in
            hoveredSource = isHovering ? attribution.id : nil
        }
    }
    
    // MARK: - Source Details View
    
    private var sourceDetailsView: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Details header
            HStack {
                Text(selectedAttribution != nil ? "Source Details" : "Select a Source")
                    .font(AppTheme.headline)
                    .fontWeight(.semibold)
                    .foregroundColor(AppTheme.primaryText)
                
                Spacer()
                
                if selectedAttribution != nil {
                    Button(action: {
                        withAnimation(AppTheme.normalAnimation) {
                            selectedAttribution = nil
                        }
                    }) {
                        Image(systemName: "xmark")
                            .foregroundColor(AppTheme.secondaryText)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(16)
            .background(AppTheme.tertiaryBackground)
            
            ScrollView {
                if let attribution = selectedAttribution {
                    sourceDetailsContent(for: attribution)
                } else {
                    // Placeholder content
                    VStack(spacing: 16) {
                        Image(systemName: "doc.text.magnifyingglass")
                            .font(.system(size: 48))
                            .foregroundColor(AppTheme.quaternaryText)
                        
                        Text("Select a source to view details")
                            .font(AppTheme.body)
                            .foregroundColor(AppTheme.tertiaryText)
                        
                        // Summary statistics
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Attribution Summary")
                                .font(AppTheme.headline)
                                .foregroundColor(AppTheme.primaryText)
                            
                            attributionSummaryStats
                        }
                        .padding(16)
                        .background(AppTheme.surfaceBackground)
                        .cornerRadius(8)
                    }
                    .padding(16)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .background(AppTheme.secondaryBackground)
    }
    
    private func sourceDetailsContent(for attribution: SourceAttribution) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            // Source info
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Image(systemName: iconForSourceType(attribution.citationInfo.type))
                        .font(.system(size: 24))
                        .foregroundColor(colorForSourceType(attribution.citationInfo.type))
                    
                    VStack(alignment: .leading, spacing: 2) {
                        Text(displayTitle(for: attribution))
                            .font(AppTheme.title3)
                            .fontWeight(.medium)
                            .foregroundColor(AppTheme.primaryText)
                        
                        Text(attribution.citationInfo.type.capitalized)
                            .font(AppTheme.caption)
                            .foregroundColor(AppTheme.secondaryText)
                    }
                    
                    Spacer()
                    
                    ContributionBadge(score: attribution.contributionScore)
                }
                
                // Citation details
                VStack(alignment: .leading, spacing: 8) {
                    if let path = attribution.citationInfo.path {
                        DetailRow(label: "Path", value: path)
                    }
                    
                    if let url = attribution.citationInfo.url {
                        HStack {
                            Text("URL:")
                                .font(AppTheme.caption)
                                .foregroundColor(AppTheme.secondaryText)
                            
                            Spacer()
                            
                            Button(url) {
                                openURL(url)
                            }
                            .font(AppTheme.caption)
                            .foregroundColor(AppTheme.accentBlue)
                        }
                    }
                    
                    if let author = attribution.citationInfo.author {
                        DetailRow(label: "Author", value: author)
                    }
                    
                    if let lineNumbers = attribution.citationInfo.lineNumbers, !lineNumbers.isEmpty {
                        DetailRow(label: "Lines", value: lineNumbers.map(String.init).joined(separator: ", "))
                    }
                }
            }
            .padding(16)
            .background(AppTheme.surfaceBackground)
            .cornerRadius(8)
            
            // Quality metrics
            VStack(alignment: .leading, spacing: 12) {
                Text("Quality Metrics")
                    .font(AppTheme.headline)
                    .foregroundColor(AppTheme.primaryText)
                
                qualityMetricsDetailView(for: attribution.qualityMetrics)
            }
            .padding(16)
            .background(AppTheme.surfaceBackground)
            .cornerRadius(8)
            
            // Related contexts
            if let relatedContexts = getRelatedContexts(for: attribution) {
                VStack(alignment: .leading, spacing: 12) {
                    Text("Related Contexts")
                        .font(AppTheme.headline)
                        .foregroundColor(AppTheme.primaryText)
                    
                    ForEach(relatedContexts.prefix(5), id: \.id) { context in
                        contextPreviewRow(context)
                    }
                    
                    if relatedContexts.count > 5 {
                        Text("... and \(relatedContexts.count - 5) more")
                            .font(AppTheme.caption)
                            .foregroundColor(AppTheme.tertiaryText)
                    }
                }
                .padding(16)
                .background(AppTheme.surfaceBackground)
                .cornerRadius(8)
            }
            
            // File preview (if enabled and applicable)
            if showPreview && canShowPreview(for: attribution) {
                VStack(alignment: .leading, spacing: 12) {
                    Text("Preview")
                        .font(AppTheme.headline)
                        .foregroundColor(AppTheme.primaryText)
                    
                    sourcePreviewContent(for: attribution)
                }
                .padding(16)
                .background(AppTheme.surfaceBackground)
                .cornerRadius(8)
            }
        }
        .padding(16)
    }
    
    // MARK: - Quality Metrics Views
    
    private func qualityMetricsView(for metrics: SourceQualityMetrics) -> some View {
        HStack(spacing: 12) {
            QualityBar(label: "A", value: metrics.accuracy, color: .green)
            QualityBar(label: "C", value: metrics.completeness, color: .blue)  
            QualityBar(label: "F", value: metrics.freshness, color: .orange)
            QualityBar(label: "R", value: metrics.reliability, color: .purple)
            
            Spacer()
            
            QualityIndicator(quality: metrics.overall, size: .medium)
        }
    }
    
    private func qualityMetricsDetailView(for metrics: SourceQualityMetrics) -> some View {
        VStack(spacing: 12) {
            QualityMetricRow(label: "Accuracy", value: metrics.accuracy, color: .green, icon: "checkmark.circle")
            QualityMetricRow(label: "Completeness", value: metrics.completeness, color: .blue, icon: "doc.circle")
            QualityMetricRow(label: "Freshness", value: metrics.freshness, color: .orange, icon: "clock.circle")
            QualityMetricRow(label: "Reliability", value: metrics.reliability, color: .purple, icon: "shield.circle")
            
            Divider()
            
            HStack {
                Text("Overall Quality")
                    .font(AppTheme.body)
                    .fontWeight(.medium)
                    .foregroundColor(AppTheme.primaryText)
                
                Spacer()
                
                QualityIndicator(quality: metrics.overall, size: .large)
            }
        }
    }
    
    // MARK: - Helper Views
    
    private func contextPreviewRow(_ context: ContextNode) -> some View {
        HStack {
            Image(systemName: context.type.icon)
                .foregroundColor(context.type.color)
                .frame(width: 16)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(String(context.content.prefix(60)))
                    .font(AppTheme.caption)
                    .foregroundColor(AppTheme.primaryText)
                    .lineLimit(2)
                
                Text("Importance: \(String(format: "%.1f%%", context.metadata.importance * 100))")
                    .font(AppTheme.caption2)
                    .foregroundColor(AppTheme.tertiaryText)
            }
            
            Spacer()
        }
        .padding(.vertical, 4)
    }
    
    private func sourcePreviewContent(for attribution: SourceAttribution) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            if attribution.citationInfo.type == "file" {
                // Mock file content preview
                Text("// Example source code content\nfunction processContext(data) {\n    return data.filter(item => item.relevance > 0.5);\n}")
                    .font(AppTheme.monospacedSmall)
                    .foregroundColor(AppTheme.secondaryText)
                    .padding(12)
                    .background(AppTheme.tertiaryBackground)
                    .cornerRadius(6)
                    .frame(maxHeight: 200)
            } else if attribution.citationInfo.type == "web" {
                // Mock web content preview
                Text("Web page content preview would appear here, showing relevant sections that contributed to the context...")
                    .font(AppTheme.caption)
                    .foregroundColor(AppTheme.secondaryText)
                    .padding(12)
                    .background(AppTheme.tertiaryBackground)
                    .cornerRadius(6)
            } else {
                Text("Preview not available for this source type")
                    .font(AppTheme.caption)
                    .foregroundColor(AppTheme.quaternaryText)
                    .italic()
            }
        }
    }
    
    private var attributionSummaryStats: some View {
        VStack(alignment: .leading, spacing: 8) {
            SummaryStatRow(label: "Total Sources", value: "\(attributions.count)", icon: "doc.text")
            SummaryStatRow(label: "File Sources", value: "\(fileSourceCount)", icon: "doc")
            SummaryStatRow(label: "Web Sources", value: "\(webSourceCount)", icon: "globe")
            SummaryStatRow(label: "Avg Quality", value: String(format: "%.1f%%", averageQuality * 100), icon: "star")
            SummaryStatRow(label: "High Quality (>80%)", value: "\(highQualitySourceCount)", icon: "star.fill")
        }
    }
    
    // MARK: - Computed Properties
    
    private var filteredAttributions: [SourceAttribution] {
        var filtered = attributions
        
        // Apply search filter
        if !searchText.isEmpty {
            filtered = filtered.filter { attribution in
                displayTitle(for: attribution).localizedCaseInsensitiveContains(searchText) ||
                attribution.citationInfo.path?.localizedCaseInsensitiveContains(searchText) == true ||
                attribution.citationInfo.url?.localizedCaseInsensitiveContains(searchText) == true
            }
        }
        
        // Apply type filter
        if filterBy != .all {
            let targetType = filterBy.rawValue.lowercased()
            filtered = filtered.filter { attribution in
                attribution.citationInfo.type.lowercased().contains(targetType) ||
                (filterBy == .files && attribution.citationInfo.type == "file") ||
                (filterBy == .web && attribution.citationInfo.type == "web") ||
                (filterBy == .database && attribution.citationInfo.type == "database") ||
                (filterBy == .memory && attribution.citationInfo.type == "memory")
            }
        }
        
        // Apply sorting
        switch sortBy {
        case .contribution:
            filtered.sort { $0.contributionScore > $1.contributionScore }
        case .quality:
            filtered.sort { $0.qualityMetrics.overall > $1.qualityMetrics.overall }
        case .type:
            filtered.sort { $0.citationInfo.type < $1.citationInfo.type }
        case .alphabetical:
            filtered.sort { displayTitle(for: $0) < displayTitle(for: $1) }
        }
        
        return filtered
    }
    
    private var groupedSources: [String: [SourceAttribution]] {
        Dictionary(grouping: filteredAttributions) { $0.citationInfo.type }
    }
    
    private var averageQuality: Float {
        guard !attributions.isEmpty else { return 0 }
        let total = attributions.map { $0.qualityMetrics.overall }.reduce(0, +)
        return total / Float(attributions.count)
    }
    
    private var topSourceType: String {
        let typeCounts = Dictionary(grouping: attributions) { $0.citationInfo.type }
            .mapValues { $0.count }
        return typeCounts.max { $0.value < $1.value }?.key ?? "None"
    }
    
    private var fileSourceCount: Int {
        attributions.filter { $0.citationInfo.type == "file" }.count
    }
    
    private var webSourceCount: Int {
        attributions.filter { $0.citationInfo.type == "web" }.count
    }
    
    private var highQualitySourceCount: Int {
        attributions.filter { $0.qualityMetrics.overall > 0.8 }.count
    }
    
    // MARK: - Helper Methods
    
    private func displayTitle(for attribution: SourceAttribution) -> String {
        if let title = attribution.citationInfo.title {
            return title
        } else if let path = attribution.citationInfo.path {
            return URL(fileURLWithPath: path).lastPathComponent
        } else if let url = attribution.citationInfo.url {
            return URL(string: url)?.host ?? url
        } else {
            return "Unknown Source"
        }
    }
    
    private func iconForSourceType(_ type: String) -> String {
        switch type.lowercased() {
        case "file": return "doc.text"
        case "web": return "globe"
        case "database": return "server.rack"
        case "memory": return "brain.head.profile"
        default: return "doc"
        }
    }
    
    private func colorForSourceType(_ type: String) -> Color {
        switch type.lowercased() {
        case "file": return .green
        case "web": return .blue
        case "database": return .orange
        case "memory": return .purple
        default: return AppTheme.secondaryText
        }
    }
    
    private func getRelatedContexts(for attribution: SourceAttribution) -> [ContextNode]? {
        // In a real implementation, this would find contexts that reference this source
        return contexts.filter { _ in Bool.random() }.prefix(Int.random(in: 2...6)).map { $0 }
    }
    
    private func canShowPreview(for attribution: SourceAttribution) -> Bool {
        attribution.citationInfo.type == "file" || attribution.citationInfo.type == "web"
    }
    
    private func openURL(_ urlString: String) {
        guard let url = URL(string: urlString) else { return }
        NSWorkspace.shared.open(url)
    }
}

// MARK: - Helper Views

struct ContributionBadge: View {
    let score: Float
    
    var body: some View {
        Text(String(format: "%.1f%%", score * 100))
            .font(AppTheme.caption2)
            .fontWeight(.medium)
            .foregroundColor(AppTheme.primaryText)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(contributionColor.opacity(0.2))
            .cornerRadius(4)
    }
    
    private var contributionColor: Color {
        if score > 0.8 { return .green }
        else if score > 0.5 { return .orange }
        else { return .red }
    }
}

struct QualityIndicator: View {
    let quality: Float
    let size: IndicatorSize
    
    enum IndicatorSize {
        case small, medium, large
        
        var diameter: CGFloat {
            switch self {
            case .small: return 16
            case .medium: return 20
            case .large: return 24
            }
        }
        
        var fontSize: CGFloat {
            switch self {
            case .small: return 8
            case .medium: return 10
            case .large: return 12
            }
        }
    }
    
    var body: some View {
        ZStack {
            Circle()
                .fill(qualityColor.opacity(0.2))
                .frame(width: size.diameter, height: size.diameter)
            
            Circle()
                .stroke(qualityColor, lineWidth: 2)
                .frame(width: size.diameter, height: size.diameter)
            
            Text(String(format: "%.0f", quality * 100))
                .font(.system(size: size.fontSize, weight: .medium))
                .foregroundColor(qualityColor)
        }
    }
    
    private var qualityColor: Color {
        if quality > 0.8 { return .green }
        else if quality > 0.6 { return .orange }
        else { return .red }
    }
}

struct QualityBar: View {
    let label: String
    let value: Float
    let color: Color
    
    var body: some View {
        VStack(spacing: 2) {
            Text(label)
                .font(AppTheme.caption2)
                .foregroundColor(AppTheme.tertiaryText)
            
            RoundedRectangle(cornerRadius: 2)
                .fill(color.opacity(0.3))
                .frame(width: 20, height: 40)
                .overlay(
                    VStack {
                        Spacer()
                        RoundedRectangle(cornerRadius: 2)
                            .fill(color)
                            .frame(height: 40 * CGFloat(value))
                    }
                )
        }
    }
}

struct QualityMetricRow: View {
    let label: String
    let value: Float
    let color: Color
    let icon: String
    
    var body: some View {
        HStack {
            Image(systemName: icon)
                .foregroundColor(color)
                .frame(width: 16)
            
            Text(label)
                .font(AppTheme.body)
                .foregroundColor(AppTheme.primaryText)
            
            Spacer()
            
            ProgressView(value: Double(value), total: 1.0)
                .progressViewStyle(.linear)
                .tint(color)
                .frame(width: 80)
            
            Text(String(format: "%.1f%%", value * 100))
                .font(AppTheme.caption)
                .foregroundColor(AppTheme.secondaryText)
                .frame(width: 40, alignment: .trailing)
        }
    }
}

struct SummaryStatRow: View {
    let label: String
    let value: String
    let icon: String
    
    var body: some View {
        HStack {
            Image(systemName: icon)
                .foregroundColor(AppTheme.accentColor)
                .frame(width: 16)
            
            Text(label)
                .font(AppTheme.caption)
                .foregroundColor(AppTheme.secondaryText)
            
            Spacer()
            
            Text(value)
                .font(AppTheme.caption)
                .fontWeight(.medium)
                .foregroundColor(AppTheme.primaryText)
        }
    }
}

struct StatLabel: View {
    let label: String
    let value: String
    
    var body: some View {
        VStack(alignment: .center, spacing: 2) {
            Text(value)
                .font(AppTheme.caption)
                .fontWeight(.medium)
                .foregroundColor(AppTheme.primaryText)
            
            Text(label)
                .font(AppTheme.caption2)
                .foregroundColor(AppTheme.tertiaryText)
        }
    }
}

#Preview {
    RAGSourceAttributionView(
        attributions: [],
        contexts: []
    )
    .frame(width: 1000, height: 700)
}