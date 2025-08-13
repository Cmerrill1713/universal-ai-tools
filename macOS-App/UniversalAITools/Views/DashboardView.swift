import Charts
import Foundation
import SwiftUI

struct DashboardView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var apiService: APIService

    @State private var systemMetrics: SystemMetrics?
    @State private var isLoadingMetrics = false
    @State private var loadError: String?
    @State private var selectedTimeRange = TimeRange.hour

    enum TimeRange: String, CaseIterable {
        case hour = "1H"
        case day = "24H"
        case week = "7D"
        case month = "30D"

        var displayName: String {
            switch self {
            case .hour: return "Last Hour"
            case .day: return "Last 24 Hours"
            case .week: return "Last Week"
            case .month: return "Last Month"
            }
        }
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                // Header
                headerSection

                // Quick Stats
                if isLoadingMetrics {
                    statsGridSkeleton
                } else {
                    statsGrid
                }

                // Performance Charts
                Group {
                    if let metrics = systemMetrics {
                        performanceCharts(metrics)
                    } else if isLoadingMetrics {
                        chartsSkeleton
                    } else {
                        emptyState
                    }
                }

                // Agent Status
                agentStatusSection

                // Recent Activity
                recentActivitySection

                if let errorMessage = loadError {
                    errorBanner(message: errorMessage)
                }
            }
            .padding()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(AnimatedGradientBackground())
        .glassMorphism(cornerRadius: 0)
        .onAppear {
            loadMetrics()
        }
        .refreshable {
            await loadMetricsAsync()
        }
    }

    // MARK: - Header Section

    private var headerSection: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("Universal AI Tools")
                    .font(.largeTitle)
                    .fontWeight(.bold)

                Text("System Dashboard")
                    .font(.headline)
                    .foregroundColor(.secondary)
            }

            Spacer()

            // Time Range Picker
            Picker("Time Range", selection: $selectedTimeRange, content: {
                ForEach(TimeRange.allCases, id: \.self) { range in
                    Text(range.rawValue).tag(range)
                }
            })
            .pickerStyle(SegmentedPickerStyle())
            .frame(width: 200)
            .onChange(of: selectedTimeRange) { _ in
                loadMetrics()
            }

            // Refresh Button
            Button(action: { loadMetrics() }, label: {
                Image(systemName: "arrow.clockwise")
                    .foregroundColor(isLoadingMetrics ? .gray : .accentColor)
            })
            .disabled(isLoadingMetrics)
            .buttonStyle(PlainButtonStyle())
        }
        .padding(.bottom)
    }

    // MARK: - Stats Grid

    private var statsGrid: some View {
        LazyVGrid(columns: [
            GridItem(.flexible()),
            GridItem(.flexible()),
            GridItem(.flexible()),
            GridItem(.flexible())
        ], spacing: 16) {
            StatCard(
                title: "Active Agents",
                value: "\(appState.activeAgents.count)",
                icon: "cpu",
                color: AppTheme.accentBlue,
                trend: .increase(12)
            )

            StatCard(
                title: "API Calls",
                value: formatNumber(systemMetrics?.requestsPerMinute ?? 0),
                icon: "network",
                color: AppTheme.accentOrange,
                trend: .increase(8)
            )

            StatCard(
                title: "Memory Usage",
                value: memoryUsageText,
                icon: "memorychip",
                color: AppTheme.accentOrange,
                trend: .stable
            )

            StatCard(
                title: "Response Time",
                value: averageResponseText,
                icon: "timer",
                color: AppTheme.accentBlue,
                trend: .decrease(15)
            )
        }
    }

    // MARK: - Performance Charts

    private func performanceCharts(_ metrics: SystemMetrics) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Performance Metrics")
                .font(.headline)
                .padding(.top)

            HStack(spacing: 16) {
                // CPU Usage Chart
                ChartCard(title: "CPU Usage", content: {
                    Chart(metrics.cpuHistory ?? []) { point in
                        LineMark(
                            x: .value("Time", point.timestamp),
                            y: .value("CPU %", point.value)
                        )
                        .foregroundStyle(AppTheme.accentBlue)

                        AreaMark(
                            x: .value("Time", point.timestamp),
                            y: .value("CPU %", point.value)
                        )
                        .foregroundStyle(AppTheme.accentBlue.opacity(0.1))
                    }
                    .frame(height: 150)
                })

                // Memory Usage Chart
                ChartCard(title: "Memory Usage", content: {
                    Chart(metrics.memoryHistory ?? []) { point in
                        LineMark(
                            x: .value("Time", point.timestamp),
                            y: .value("Memory MB", point.value / 1024 / 1024)
                        )
                        .foregroundStyle(AppTheme.accentOrange)

                        AreaMark(
                            x: .value("Time", point.timestamp),
                            y: .value("Memory MB", point.value / 1024 / 1024)
                        )
                        .foregroundStyle(AppTheme.accentOrange.opacity(0.1))
                    }
                    .frame(height: 150)
                })
            }

            HStack(spacing: 16) {
                // Request Rate Chart
                ChartCard(title: "Request Rate", content: {
                    Chart(metrics.requestHistory ?? []) { point in
                        BarMark(
                            x: .value("Time", point.timestamp),
                            y: .value("Requests/min", point.value)
                        )
                        .foregroundStyle(AppTheme.accentBlue)
                    }
                    .frame(height: 150)
                })

                // Response Time Chart
                ChartCard(title: "Response Time", content: {
                    Chart(metrics.responseTimeHistory ?? []) { point in
                        LineMark(
                            x: .value("Time", point.timestamp),
                            y: .value("Time (ms)", point.value)
                        )
                        .foregroundStyle(AppTheme.accentOrange)
                        .lineStyle(StrokeStyle(lineWidth: 2))

                        PointMark(
                            x: .value("Time", point.timestamp),
                            y: .value("Time (ms)", point.value)
                        )
                        .foregroundStyle(AppTheme.accentOrange)
                    }
                    .frame(height: 150)
                })
            }
        }
    }

    private var memoryUsageText: String {
        if let bytes = systemMetrics?.memoryBytes, bytes > 0 {
            return formatMemory(bytes)
        }
        if let percent = systemMetrics?.memoryUsage {
            return String(format: "%.0f%%", percent)
        }
        return "—"
    }

    private var averageResponseText: String {
        guard let points = systemMetrics?.responseTimeHistory, !points.isEmpty else {
            return "—"
        }
        let total = points.reduce(0) { $0 + $1.value }
        let avg = Double(total) / Double(points.count)
        return String(format: "%.0fms", avg)
    }

    // MARK: - Agent Status Section

    private var agentStatusSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Agent Status")
                .font(.headline)
                .padding(.top)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    ForEach(appState.activeAgents) { agent in
                        AgentStatusCard(agent: agent)
                    }
                }
            }
        }
    }

    // MARK: - Recent Activity

    private var recentActivitySection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Recent Activity")
                    .font(.headline)

                Spacer()

                Button("View All") {
                    appState.selectedSidebarItem = .tools
                    appState.selectedTool = .monitoring
                }
                .buttonStyle(LinkButtonStyle())
            }

            VStack(spacing: 8) {
                ForEach(appState.recentActivities.prefix(5)) { activity in
                    ActivityRow(activity: activity)
                }
            }
            .padding()
            .background(Color(NSColor.controlBackgroundColor))
            .cornerRadius(8)
        }
    }

    // MARK: - Helper Methods

    private func loadMetrics() {
        isLoadingMetrics = true
        loadError = nil

        Task {
            do {
                systemMetrics = try await apiService.getSystemMetrics()
                isLoadingMetrics = false
            } catch {
                print("Failed to load metrics:", error)
                loadError = (error as? APIError)?.errorDescription ?? error.localizedDescription
                isLoadingMetrics = false
            }
        }
    }

    private func loadMetricsAsync() async {
        do {
            loadError = nil
            systemMetrics = try await apiService.getSystemMetrics()
        } catch {
            print("Failed to load metrics:", error)
            loadError = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    private func formatNumber(_ number: Int) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.maximumFractionDigits = 0
        return formatter.string(from: NSNumber(value: number)) ?? "\(number)"
    }

    private func formatMemory(_ bytes: Int64) -> String {
        let megaBytes = Double(bytes) / 1024.0 / 1024.0
        if megaBytes < 1024 {
            return String(format: "%.1f MB", megaBytes)
        } else {
            let gigaBytes = megaBytes / 1024
            return String(format: "%.2f GB", gigaBytes)
        }
    }
}

// MARK: - Loading Skeletons and Empty/Error States

extension DashboardView {
    // Skeleton grid for loading state
    private var statsGridSkeleton: some View {
        LazyVGrid(columns: [
            GridItem(.flexible()),
            GridItem(.flexible()),
            GridItem(.flexible()),
            GridItem(.flexible())
        ], spacing: 16) {
            ForEach(0..<4, id: \.self) { _ in
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        RoundedRectangle(cornerRadius: 4)
                            .fill(Color.secondary.opacity(0.2))
                            .frame(width: 24, height: 24)
                            .shimmering()
                        Spacer()
                        RoundedRectangle(cornerRadius: 4)
                            .fill(Color.secondary.opacity(0.2))
                            .frame(width: 60, height: 14)
                            .shimmering()
                    }

                    RoundedRectangle(cornerRadius: 6)
                        .fill(Color.secondary.opacity(0.2))
                        .frame(width: 120, height: 22)
                        .shimmering()

                    RoundedRectangle(cornerRadius: 6)
                        .fill(Color.secondary.opacity(0.2))
                        .frame(width: 100, height: 12)
                        .shimmering()
                }
                .padding()
                .background(Color(NSColor.controlBackgroundColor))
                .cornerRadius(8)
            }
        }
    }

    // Skeleton charts while loading
    private var chartsSkeleton: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Performance Metrics")
                .font(.headline)
                .padding(.top)

            HStack(spacing: 16) {
                ChartCard(title: "CPU Usage") {
                    RoundedRectangle(cornerRadius: 8)
                        .fill(Color.secondary.opacity(0.15))
                        .frame(height: 150)
                        .shimmering()
                }
                ChartCard(title: "Memory Usage") {
                    RoundedRectangle(cornerRadius: 8)
                        .fill(Color.secondary.opacity(0.15))
                        .frame(height: 150)
                        .shimmering()
                }
            }

            HStack(spacing: 16) {
                ChartCard(title: "Request Rate") {
                    RoundedRectangle(cornerRadius: 8)
                        .fill(Color.secondary.opacity(0.15))
                        .frame(height: 150)
                        .shimmering()
                }
                ChartCard(title: "Response Time") {
                    RoundedRectangle(cornerRadius: 8)
                        .fill(Color.secondary.opacity(0.15))
                        .frame(height: 150)
                        .shimmering()
                }
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "waveform.path.ecg")
                .font(.largeTitle)
                .foregroundColor(.secondary)
            Text("No metrics available")
                .font(.headline)
            Text("Pull to refresh or try again.")
                .font(.caption)
                .foregroundColor(.secondary)
            Button(action: { loadMetrics() }, label: {
                Label("Retry", systemImage: "arrow.clockwise")
            })
            .buttonStyle(.bordered)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 24)
        .background(Color(NSColor.controlBackgroundColor))
        .cornerRadius(8)
    }

    private func errorBanner(message: String) -> some View {
        HStack(spacing: 10) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundColor(.yellow)
            Text(message)
                .font(.caption)
                .lineLimit(2)
                .truncationMode(.tail)
            Spacer()
            Button("Dismiss") { loadError = nil }
                .buttonStyle(.borderless)
                .font(.caption)
            Button("Retry") { loadMetrics() }
                .buttonStyle(.bordered)
                .font(.caption)
        }
        .padding(12)
        .background(.thinMaterial)
        .cornerRadius(10)
    }
}

    // The supporting view types are defined in `DashboardComponents.swift`
