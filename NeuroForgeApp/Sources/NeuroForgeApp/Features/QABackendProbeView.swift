import SwiftUI

/// QA-only view to probe all backend services via the E2E probe endpoint
public struct QABackendProbeView: View {
    @State private var isProbing = false
    @State private var results: [ServiceProbeResult] = []
    @State private var summary: ProbeSummary?
    @State private var errorMessage: String?
    
    private let client = APIClient()
    
    public init() {}
    
    public var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Backend E2E Probe")
                .font(.title2.bold())
            
            // Summary header
            if let summary = summary {
                HStack(spacing: 16) {
                    StatusChip(label: "Pass", count: summary.counts.pass, color: .green)
                    StatusChip(label: "Warn", count: summary.counts.warn, color: .orange)
                    StatusChip(label: "Fail", count: summary.counts.fail, color: .red)
                    StatusChip(label: "Unused", count: summary.counts.unused, color: .gray)
                    
                    Spacer()
                    
                    Text("\(summary.duration_ms, specifier: "%.1f")ms")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .padding(8)
                .background(Color.secondary.opacity(0.1))
                .cornerRadius(8)
            }
            
            // Probe button
            Button {
                Task { await runProbe() }
            } label: {
                HStack {
                    if isProbing {
                        ProgressView()
                            .controlSize(.small)
                    }
                    Text(isProbing ? "Probing..." : "Run Backend Probe")
                }
            }
            .buttonStyle(.borderedProminent)
            .disabled(isProbing)
            .accessibilityIdentifier("qa_backend_probe_button")
            
            // Error message
            if let error = errorMessage {
                Text(error)
                    .foregroundColor(.red)
                    .font(.caption)
            }
            
            // Results list
            if !results.isEmpty {
                Text("Results (\(results.count) services):")
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                List(results) { result in
                    HStack(spacing: 8) {
                        Circle()
                            .fill(result.statusColor)
                            .frame(width: 8, height: 8)
                        
                        VStack(alignment: .leading, spacing: 2) {
                            Text(result.service)
                                .font(.system(.body, design: .monospaced))
                            Text(result.note)
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        
                        Spacer()
                        
                        VStack(alignment: .trailing, spacing: 2) {
                            Text("HTTP \(result.http)")
                                .font(.caption)
                            Text("\(result.latency_ms, specifier: "%.1f")ms")
                                .font(.caption2)
                                .foregroundColor(.secondary)
                        }
                    }
                    .padding(.vertical, 4)
                }
                .accessibilityIdentifier("qa_backend_results_list")
            } else {
                Spacer()
            }
        }
        .padding()
    }
    
    private func runProbe() async {
        isProbing = true
        errorMessage = nil
        results = []
        summary = nil
        
        do {
            struct ProbeResponse: Decodable {
                let started_at: String
                let duration_ms: Double
                let total_services: Int
                let counts: StatusCounts
                let services: [ServiceProbeResult]
            }
            
            let response: ProbeResponse = try await client.get("/api/probe/e2e")
            results = response.services
            summary = ProbeSummary(
                started_at: response.started_at,
                duration_ms: response.duration_ms,
                total_services: response.total_services,
                counts: response.counts
            )
        } catch {
            errorMessage = "Probe failed: \(error.localizedDescription)"
        }
        
        isProbing = false
    }
}

// MARK: - Models

struct ServiceProbeResult: Identifiable, Decodable {
    let service: String
    let url: String
    let status: String
    let http: Int
    let latency_ms: Double
    let note: String
    let critical: Bool
    
    var id: String { service }
    
    var statusColor: Color {
        switch status {
        case "pass": return .green
        case "warn": return .orange
        case "fail": return .red
        case "unused": return .gray
        default: return .gray
        }
    }
}

struct StatusCounts: Decodable {
    let pass: Int
    let warn: Int
    let fail: Int
    let unused: Int
}

struct ProbeSummary {
    let started_at: String
    let duration_ms: Double
    let total_services: Int
    let counts: StatusCounts
}

// MARK: - Helper Views

struct StatusChip: View {
    let label: String
    let count: Int
    let color: Color
    
    var body: some View {
        HStack(spacing: 4) {
            Circle()
                .fill(color)
                .frame(width: 6, height: 6)
            Text("\(label): \(count)")
                .font(.caption2.bold())
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(color.opacity(0.15))
        .cornerRadius(4)
    }
}

