import Charts
import SwiftUI

struct SystemMonitoringView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var apiService: APIService

    @State private var metrics: SystemMetrics?
    @State private var isLoading = false
    @State private var loadError: String?

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                header

                if isLoading {
                    overviewSkeleton
                } else {
                    overview
                }

                Group {
                    if let systemMetrics = metrics {
                        charts(metrics: systemMetrics)
                    } else if isLoading {
                        chartsSkeleton
                    } else {
                        emptyState
                    }
                }

                if let err = loadError {
                    errorBanner(message: err)
                }
            }
            .padding()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(AnimatedGradientBackground())
        .glassMorphism(cornerRadius: 0)
        .onAppear(perform: load)
        .refreshable { await loadAsync() }
    }

    private var header: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("System Monitoring").font(.title2).fontWeight(.semibold)
                Text(appState.backendConnected ? "Live" : "Offline")
                    .font(.caption).foregroundColor(.secondary)
            }
            Spacer()
            Button(action: load, label: {
                Image(systemName: "arrow.clockwise")
            })
            .buttonStyle(.bordered)
            .disabled(isLoading)
        }
    }

    private var overview: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
            metricTile(title: "CPU", value: cpuText, color: .blue, systemImage: "gauge.high")
            metricTile(title: "Memory", value: memoryText, color: .orange, systemImage: "memorychip")
            metricTile(title: "RPM", value: "\(metrics?.requestsPerMinute ?? 0)", color: .green, systemImage: "chart.line.uptrend.xyaxis")
        }
    }

    private var overviewSkeleton: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
            ForEach(0..<3, id: \.self) { _ in
                RoundedRectangle(cornerRadius: 10)
                    .fill(Color.secondary.opacity(0.15))
                    .frame(height: 64)
                    .shimmering()
            }
        }
    }

    private func charts(metrics: SystemMetrics) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            cpuAndMemoryCharts(metrics: metrics)
            requestsAndLatencyCharts(metrics: metrics)
        }
    }

    private func cpuAndMemoryCharts(metrics: SystemMetrics) -> some View {
        HStack(spacing: 12) {
            ChartCard(title: "CPU %", content: {
                Chart(metrics.cpuHistory ?? []) { point in
                    LineMark(
                        x: .value("t", point.timestamp),
                        y: .value("cpu", point.value)
                    )
                }.frame(height: 160)
            })
            ChartCard(title: "Mem MB", content: {
                Chart(metrics.memoryHistory ?? []) { point in
                    LineMark(
                        x: .value("t", point.timestamp),
                        y: .value("mb", Double(point.value) / 1024.0 / 1024.0)
                    )
                }.frame(height: 160)
            })
        }
    }

    private func requestsAndLatencyCharts(metrics: SystemMetrics) -> some View {
        HStack(spacing: 12) {
            ChartCard(title: "Requests/min", content: {
                Chart(metrics.requestHistory ?? []) { point in
                    BarMark(
                        x: .value("t", point.timestamp),
                        y: .value("rpm", point.value)
                    )
                }.frame(height: 160)
            })
            ChartCard(title: "Response ms", content: {
                Chart(metrics.responseTimeHistory ?? []) { point in
                    LineMark(
                        x: .value("t", point.timestamp),
                        y: .value("ms", point.value)
                    )
                }.frame(height: 160)
            })
        }
    }

    private var chartsSkeleton: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 12) {
                RoundedRectangle(cornerRadius: 8).fill(Color.secondary.opacity(0.15)).frame(height: 160).shimmering()
                RoundedRectangle(cornerRadius: 8).fill(Color.secondary.opacity(0.15)).frame(height: 160).shimmering()
            }
            HStack(spacing: 12) {
                RoundedRectangle(cornerRadius: 8).fill(Color.secondary.opacity(0.15)).frame(height: 160).shimmering()
                RoundedRectangle(cornerRadius: 8).fill(Color.secondary.opacity(0.15)).frame(height: 160).shimmering()
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: 8) {
            Image(systemName: "waveform.path.ecg").font(.title).foregroundColor(.secondary)
            Text("No monitoring data").font(.headline)
            Button("Retry", action: load).buttonStyle(.bordered)
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(Color(NSColor.controlBackgroundColor))
        .cornerRadius(8)
    }

    private func errorBanner(message: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "exclamationmark.triangle.fill").foregroundColor(.yellow)
            Text(message).font(.caption).lineLimit(2)
            Spacer()
            Button("Dismiss") { loadError = nil }.buttonStyle(.borderless).font(.caption)
            Button("Retry", action: load).buttonStyle(.bordered).font(.caption)
        }
        .padding(12)
        .background(.thinMaterial)
        .cornerRadius(10)
    }

    private func metricTile(title: String, value: String, color: Color, systemImage: String) -> some View {
        HStack {
            Image(systemName: systemImage).foregroundColor(color)
            VStack(alignment: .leading) {
                Text(title).font(.caption).foregroundColor(.secondary)
                Text(value).font(.headline)
            }
            Spacer()
        }
        .padding()
        .background(Color(NSColor.controlBackgroundColor))
        .cornerRadius(10)
    }

    private var cpuText: String { metrics != nil ? "\(Int(metrics!.cpuUsage))%" : "—" }
    private var memoryText: String {
        if let memoryBytes = metrics?.memoryBytes, memoryBytes > 0 {
            return String(format: "%.0f MB", Double(memoryBytes) / 1024 / 1024)
        }
        if let memoryPercent = metrics?.memoryUsage {
            return String(format: "%.0f%%", memoryPercent)
        }
        return "—"
    }

    private func load() {
        isLoading = true
        loadError = nil
        Task {
            do {
                metrics = try await apiService.getSystemMetrics()
                isLoading = false
            } catch {
                isLoading = false
                loadError = (error as? APIError)?.errorDescription ?? error.localizedDescription
            }
        }
    }

    private func loadAsync() async {
        do {
            loadError = nil
            metrics = try await apiService.getSystemMetrics()
        } catch {
            loadError = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }
}
