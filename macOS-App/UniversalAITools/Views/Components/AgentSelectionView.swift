import SwiftUI

// MARK: - Agent Selection View
struct AgentSelectionView: View {
    let agents: [UniversalAIAgent]
    let selectedAgent: UniversalAIAgent?
    let onSelect: (UniversalAIAgent) -> Void
    
    @State private var searchText = ""
    @State private var selectedCapability: AgentCapability?
    
    private var filteredAgents: [UniversalAIAgent] {
        var filtered = agents
        
        // Filter by search text
        if !searchText.isEmpty {
            filtered = filtered.filter { agent in
                agent.name.localizedCaseInsensitiveContains(searchText) ||
                agent.description.localizedCaseInsensitiveContains(searchText) ||
                agent.type.displayName.localizedCaseInsensitiveContains(searchText)
            }
        }
        
        // Filter by capability
        if let capability = selectedCapability {
            filtered = filtered.filter { agent in
                agent.capabilities.contains(capability)
            }
        }
        
        return filtered
    }
    
    var body: some View {
        VStack(spacing: 0) {
            // Header
            headerView
            
            Divider()
            
            // Search and Filters
            searchAndFilters
            
            Divider()
            
            // Agent List
            agentList
        }
        .background(.regularMaterial)
    }
    
    private var headerView: some View {
        VStack(spacing: 8) {
            Text("Select AI Agent")
                .font(.headline)
                .fontWeight(.semibold)
            
            Text("Choose an agent based on your task requirements")
                .font(.caption)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding()
    }
    
    private var searchAndFilters: some View {
        VStack(spacing: 12) {
            // Search Field
            HStack {
                Image(systemName: "magnifyingglass")
                    .foregroundColor(.secondary)
                
                TextField("Search agents...", text: $searchText)
                    .textFieldStyle(.plain)
                
                if !searchText.isEmpty {
                    Button(action: { searchText = "" }) {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundColor(.secondary)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(.ultraThinMaterial)
            .cornerRadius(8)
            
            // Capability Filter
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    CapabilityFilterChip(
                        capability: nil,
                        isSelected: selectedCapability == nil,
                        title: "All"
                    ) {
                        selectedCapability = nil
                    }
                    
                    ForEach(AgentCapability.allCases, id: \.self) { capability in
                        CapabilityFilterChip(
                            capability: capability,
                            isSelected: selectedCapability == capability,
                            title: capability.displayName
                        ) {
                            selectedCapability = capability == selectedCapability ? nil : capability
                        }
                    }
                }
                .padding(.horizontal, 4)
            }
        }
        .padding()
    }
    
    private var agentList: some View {
        ScrollView {
            LazyVStack(spacing: 8) {
                ForEach(filteredAgents, id: \.id) { agent in
                    OptimizedAgentSelectionCard(
                        agent: agent,
                        isSelected: selectedAgent?.id == agent.id,
                        onSelect: { onSelect(agent) }
                    )
                    .onAppear {
                        // Preload agent details when scrolled into view
                        Task {
                            await preloadAgentDetails(agent)
                        }
                    }
                }
                
                if filteredAgents.isEmpty {
                    emptyStateView
                        .transition(.opacity.combined(with: .scale(scale: 0.95)))
                }
            }
            .padding()
        }
        .animation(.easeInOut(duration: 0.2), value: filteredAgents.count)
    }
    
    private func preloadAgentDetails(_ agent: UniversalAIAgent) async {
        // Preload any heavy agent details in background
        // This could include model information, capabilities, etc.
    }
    
    private var emptyStateView: some View {
        VStack(spacing: 12) {
            Image(systemName: "robot")
                .font(.title)
                .foregroundColor(.secondary)
            
            Text("No agents found")
                .font(.headline)
            
            Text("Try adjusting your search or filters")
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding(.vertical, 40)
    }
}

// MARK: - Optimized Agent Selection Card
struct OptimizedAgentSelectionCard: View {
    let agent: UniversalAIAgent
    let isSelected: Bool
    let onSelect: () -> Void
    
    @State private var isHovered = false
    @State private var hasAppeared = false
    
    var body: some View {
        Button(action: onSelect) {
            HStack(spacing: 12) {
                // Optimized Agent Icon with caching
                OptimizedAgentIcon(agent: agent)
                
                // Agent Info
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(agent.name)
                            .font(.subheadline)
                            .fontWeight(.medium)
                            .foregroundColor(.primary)
                        
                        Spacer()
                        
                        if agent.isVoiceEnabled {
                            Image(systemName: "mic.fill")
                                .font(.caption)
                                .foregroundColor(.blue)
                        }
                    }
                    
                    Text(agent.description)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(2)
                    
                    // Lazy-loaded capabilities
                    if hasAppeared {
                        OptimizedCapabilitiesView(capabilities: agent.capabilities)
                    } else {
                        Rectangle()
                            .fill(Color.clear)
                            .frame(height: 16)
                    }
                }
                
                // Selection Indicator
                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.title3)
                        .foregroundColor(.blue)
                        .transition(.scale.combined(with: .opacity))
                }
            }
            .padding(12)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(isSelected ? .blue.opacity(0.1) : .clear)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(
                                isSelected ? .blue : (isHovered ? .gray.opacity(0.3) : .clear),
                                lineWidth: isSelected ? 2 : 1
                            )
                    )
            )
            .scaleEffect(isHovered ? 1.02 : 1.0)
            .animation(.easeInOut(duration: 0.15), value: isHovered)
            .animation(.easeInOut(duration: 0.2), value: isSelected)
        }
        .buttonStyle(.plain)
        .onHover { hovering in
            isHovered = hovering
        }
        .onAppear {
            withAnimation(.easeIn(duration: 0.1)) {
                hasAppeared = true
            }
        }
        .drawingGroup() // Cache the entire card for better performance
    }
}

// MARK: - Optimized Agent Icon (Cached)
private struct OptimizedAgentIcon: View {
    let agent: UniversalAIAgent
    
    var body: some View {
        ZStack {
            Circle()
                .fill(LinearGradient(
                    colors: [
                        agent.type.color.opacity(0.8),
                        agent.type.color.opacity(0.6)
                    ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                ))
                .frame(width: 40, height: 40)
            
            Image(systemName: agent.type.icon)
                .font(.system(size: 18, weight: .medium))
                .foregroundColor(.white)
        }
        .drawingGroup() // Cache the icon rendering
    }
}

// MARK: - Optimized Capabilities View (Lazy loaded)
private struct OptimizedCapabilitiesView: View {
    let capabilities: [AgentCapability]
    
    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 4) {
                ForEach(Array(capabilities.prefix(3).enumerated()), id: \.offset) { _, capability in
                    Text(capability.displayName)
                        .font(.caption2)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(.ultraThinMaterial)
                        .cornerRadius(4)
                }
                
                if capabilities.count > 3 {
                    Text("+\(capabilities.count - 3)")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
            }
        }
        .drawingGroup() // Cache the capabilities view
    }
}

// MARK: - Original Agent Selection Card (Kept for compatibility)
struct AgentSelectionCard: View {
    let agent: UniversalAIAgent
    let isSelected: Bool
    let onSelect: () -> Void
    
    @State private var isHovered = false
    
    var body: some View {
        Button(action: onSelect) {
            HStack(spacing: 12) {
                // Agent Icon
                ZStack {
                    Circle()
                        .fill(LinearGradient(
                            colors: [
                                agent.type.color.opacity(0.8),
                                agent.type.color.opacity(0.6)
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ))
                        .frame(width: 40, height: 40)
                    
                    Image(systemName: agent.type.icon)
                        .font(.system(size: 18, weight: .medium))
                        .foregroundColor(.white)
                }
                
                // Agent Info
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(agent.name)
                            .font(.subheadline)
                            .fontWeight(.medium)
                            .foregroundColor(.primary)
                        
                        Spacer()
                        
                        if agent.isVoiceEnabled {
                            Image(systemName: "mic.fill")
                                .font(.caption)
                                .foregroundColor(.blue)
                        }
                    }
                    
                    Text(agent.description)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(2)
                    
                    // Capabilities
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 4) {
                            ForEach(agent.capabilities.prefix(3), id: \.self) { capability in
                                Text(capability.displayName)
                                    .font(.caption2)
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 2)
                                    .background(.ultraThinMaterial)
                                    .cornerRadius(4)
                            }
                            
                            if agent.capabilities.count > 3 {
                                Text("+\(agent.capabilities.count - 3)")
                                    .font(.caption2)
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                }
                
                // Selection Indicator
                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.title3)
                        .foregroundColor(.blue)
                }
            }
            .padding(12)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(isSelected ? .blue.opacity(0.1) : .clear)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(
                                isSelected ? .blue : (isHovered ? .gray.opacity(0.3) : .clear),
                                lineWidth: isSelected ? 2 : 1
                            )
                    )
            )
            .scaleEffect(isHovered ? 1.02 : 1.0)
            .animation(.easeInOut(duration: 0.15), value: isHovered)
        }
        .buttonStyle(.plain)
        .onHover { hovering in
            isHovered = hovering
        }
    }
}

// MARK: - Capability Filter Chip
struct CapabilityFilterChip: View {
    let capability: AgentCapability?
    let isSelected: Bool
    let title: String
    let onTap: () -> Void
    
    var body: some View {
        Button(action: onTap) {
            Text(title)
                .font(.caption)
                .fontWeight(.medium)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(isSelected ? .blue : .gray.opacity(0.2))
                .foregroundColor(isSelected ? .white : .primary)
                .cornerRadius(16)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Agent Details Popover
struct AgentDetailsPopover: View {
    let agent: UniversalAIAgent
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Header
            HStack(spacing: 12) {
                ZStack {
                    Circle()
                        .fill(LinearGradient(
                            colors: [
                                agent.type.color.opacity(0.8),
                                agent.type.color.opacity(0.6)
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ))
                        .frame(width: 50, height: 50)
                    
                    Image(systemName: agent.type.icon)
                        .font(.title2)
                        .foregroundColor(.white)
                }
                
                VStack(alignment: .leading, spacing: 4) {
                    Text(agent.name)
                        .font(.title3)
                        .fontWeight(.semibold)
                    
                    Text(agent.type.displayName)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                
                Spacer()
            }
            
            // Description
            Text(agent.description)
                .font(.body)
                .foregroundColor(.primary)
            
            // Capabilities
            VStack(alignment: .leading, spacing: 8) {
                Text("Capabilities")
                    .font(.headline)
                    .fontWeight(.semibold)
                
                LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 2), spacing: 8) {
                    ForEach(agent.capabilities, id: \.self) { capability in
                        HStack {
                            Image(systemName: "checkmark.circle.fill")
                                .font(.caption)
                                .foregroundColor(.green)
                            
                            Text(capability.displayName)
                                .font(.caption)
                            
                            Spacer()
                        }
                    }
                }
            }
            
            // Features
            VStack(alignment: .leading, spacing: 8) {
                Text("Features")
                    .font(.headline)
                    .fontWeight(.semibold)
                
                HStack {
                    FeatureIndicator(
                        icon: "mic.fill",
                        label: "Voice Enabled",
                        isEnabled: agent.isVoiceEnabled
                    )
                    
                    Spacer()
                    
                    FeatureIndicator(
                        icon: "text.alignleft",
                        label: "Context: \(agent.maxContextLength)",
                        isEnabled: true
                    )
                }
            }
        }
        .padding()
        .frame(width: 300)
    }
}

struct FeatureIndicator: View {
    let icon: String
    let label: String
    let isEnabled: Bool
    
    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: icon)
                .font(.caption)
                .foregroundColor(isEnabled ? .green : .gray)
            
            Text(label)
                .font(.caption)
                .foregroundColor(isEnabled ? .primary : .secondary)
        }
    }
}

// MARK: - Preview
struct AgentSelectionView_Previews: PreviewProvider {
    static var previews: some View {
        AgentSelectionView(
            agents: UniversalAIAgent.availableAgents,
            selectedAgent: UniversalAIAgent.availableAgents.first,
            onSelect: { _ in }
        )
    }
}