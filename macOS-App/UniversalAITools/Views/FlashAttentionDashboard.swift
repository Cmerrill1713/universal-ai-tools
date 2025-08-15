import SwiftUI

/// **Flash Attention Dashboard Integration**
/// 
/// Main integration view that demonstrates the Flash Attention Analytics Hub.
/// This view serves as the entry point for the sophisticated analytics dashboard
/// and can be accessed from the main application sidebar.

struct FlashAttentionDashboard: View {
    @StateObject private var metricsService = PerformanceMetricsService()
    @State private var selectedTab: DashboardTab = .analytics
    
    var body: some View {
        NavigationSplitView {
            // Dashboard sidebar
            DashboardSidebar(selectedTab: $selectedTab)
                .frame(minWidth: 200, maxWidth: 250)
        } detail: {
            // Main dashboard content
            Group {
                switch selectedTab {
                case .analytics:
                    FlashAttentionAnalytics()
                        .environmentObject(metricsService)
                        
                case .heatmaps:
                    AttentionHeatmapView(metricsService: metricsService)
                        
                case .pipeline:
                    TokenProcessingWaterfall(metricsService: metricsService)
                        
                case .performance:
                    ModelPerformanceChart(metricsService: metricsService)
                        
                case .memory:
                    MemoryOptimizationPanel(metricsService: metricsService)
                }
            }
        }
        .navigationTitle("Flash Attention Analytics")
        .onAppear {
            Task {
                await metricsService.initialize()
            }
        }
    }
}

// MARK: - Dashboard Sidebar

struct DashboardSidebar: View {
    @Binding var selectedTab: DashboardTab
    
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Image(systemName: "brain.head.profile")
                        .font(.title)
                        .foregroundColor(.purple)
                    
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Flash Attention")
                            .font(.headline)
                            .fontWeight(.semibold)
                        
                        Text("Analytics Hub")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 20)
            
            Divider()
            
            // Navigation tabs
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 4) {
                    ForEach(DashboardTab.allCases, id: \.self) { tab in
                        DashboardTabRow(
                            tab: tab,
                            isSelected: selectedTab == tab
                        ) {
                            selectedTab = tab
                        }
                    }
                }
                .padding(.vertical, 12)
            }
            
            Spacer()
            
            // Footer info
            VStack(alignment: .leading, spacing: 8) {
                Text("Real-time Analytics")
                    .font(.caption)
                    .fontWeight(.medium)
                    .foregroundColor(.secondary)
                
                HStack {
                    Circle()
                        .fill(Color.green)
                        .frame(width: 6, height: 6)
                    
                    Text("Connected")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 16)
        }
        .background(Color(NSColor.controlBackgroundColor))
    }
}

struct DashboardTabRow: View {
    let tab: DashboardTab
    let isSelected: Bool
    let onSelect: () -> Void
    
    var body: some View {
        Button(action: onSelect) {
            HStack(spacing: 12) {
                Image(systemName: tab.icon)
                    .font(.system(size: 16, weight: .medium))
                    .foregroundColor(isSelected ? .white : .primary)
                    .frame(width: 20)
                
                VStack(alignment: .leading, spacing: 2) {
                    Text(tab.title)
                        .font(.system(size: 14, weight: .medium))
                        .foregroundColor(isSelected ? .white : .primary)
                    
                    Text(tab.description)
                        .font(.caption)
                        .foregroundColor(isSelected ? .white.opacity(0.8) : .secondary)
                        .lineLimit(2)
                }
                
                Spacer()
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
            .background(
                RoundedRectangle(cornerRadius: 6)
                    .fill(isSelected ? Color.accentColor : Color.clear)
            )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Dashboard Tabs

enum DashboardTab: String, CaseIterable {
    case analytics = "Analytics"
    case heatmaps = "Heatmaps"
    case pipeline = "Pipeline"
    case performance = "Performance"
    case memory = "Memory"
    
    var title: String {
        return rawValue
    }
    
    var icon: String {
        switch self {
        case .analytics: return "chart.bar.doc.horizontal"
        case .heatmaps: return "grid.circle"
        case .pipeline: return "flowchart"
        case .performance: return "speedometer"
        case .memory: return "memorychip"
        }
    }
    
    var description: String {
        switch self {
        case .analytics: return "Overview dashboard with key metrics"
        case .heatmaps: return "Interactive attention weight visualization"
        case .pipeline: return "Token processing waterfall analysis"
        case .performance: return "Multi-model performance comparison"
        case .memory: return "Memory optimization and leak detection"
        }
    }
}

// MARK: - Preview

#Preview {
    FlashAttentionDashboard()
        .frame(width: 1400, height: 900)
}

#Preview("Sidebar Only") {
    DashboardSidebar(selectedTab: .constant(.analytics))
        .frame(width: 250, height: 600)
}