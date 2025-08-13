import SwiftUI

struct DebugConsoleView: View {
    @EnvironmentObject var mcpService: MCPService
    @State private var errorType: String = "TS2345"
    @State private var taskId: String = ""
    @State private var logText: String = ""
    @State private var isBusy = false
    @State private var selectedResourceURI: String = "supabase://errors"
    @State private var availableResources: [String] = []
    @State private var canSaveLog = false

    var body: some View {
        VStack(spacing: 12) {
            HStack {
                Text("MCP Debug Console").font(.title2).fontWeight(.bold)
                Spacer()
                Circle().fill(mcpService.isConnected ? .green : .red).frame(width: 10, height: 10)
                Text(mcpService.isConnected ? "Connected" : "Disconnected").font(.caption).foregroundColor(.secondary)
            }

            HStack(spacing: 8) {
                TextField("Error Type (e.g. TS2345)", text: $errorType)
                    .textFieldStyle(RoundedBorderTextFieldStyle())
                    .frame(width: 220)
                Button("Get Code Patterns") { Task { await getCodePatterns() } }
                    .disabled(isBusy || !mcpService.isConnected || errorType.isEmpty)

                Divider().frame(height: 22)

                TextField("Task ID", text: $taskId)
                    .textFieldStyle(RoundedBorderTextFieldStyle())
                    .frame(width: 180)
                Button("Get Task History") { Task { await getTaskHistory() } }
                    .disabled(isBusy || !mcpService.isConnected)

                Spacer()

                Button("Analyze Last TS Errors") { Task { await analyzeLastErrors() } }
                    .disabled(isBusy || !mcpService.isConnected)
                Button("Save Output to MCP") { Task { await saveOutputToMCP() } }
                    .disabled(isBusy || !mcpService.isConnected || logText.isEmpty)
            }

            HStack(spacing: 8) {
                Picker("Resource", selection: $selectedResourceURI) {
                    ForEach(availableResources, id: \.self) { uri in
                        Text(uri).tag(uri)
                    }
                }
                .frame(width: 240)
                Button("Refresh Resources") { Task { await refreshResources() } }
                    .disabled(isBusy || !mcpService.isConnected)
                Button("Read Resource") { Task { await readSelectedResource() } }
                    .disabled(isBusy || !mcpService.isConnected || selectedResourceURI.isEmpty)
                Spacer()
            }

            ScrollView {
                Text(logText.isEmpty ? "Results will appear here." : logText)
                    .font(.system(.caption, design: .monospaced))
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding()
                    .background(Color(NSColor.controlBackgroundColor))
                    .cornerRadius(8)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .padding()
    }

    private func getCodePatterns() async {
        isBusy = true
        defer { isBusy = false }
        do {
            let patterns = try await mcpService.getCodePatterns(errorType: errorType, patternType: nil, limit: 10)
            logText = "Patterns for \(errorType):\n\(pretty(patterns))"
        } catch {
            logText = "Error: \(error.localizedDescription)"
        }
    }

    private func refreshResources() async {
        isBusy = true
        defer { isBusy = false }
        do {
            let resources = try await mcpService.listResources()
            availableResources = resources.map { $0.uri }
            if let first = availableResources.first { selectedResourceURI = first }
            let joined = availableResources.joined(separator: "\n")
            logText = "Resources:\n\(joined)"
        } catch {
            logText = "Error: \(error.localizedDescription)"
        }
    }

    private func readSelectedResource() async {
        isBusy = true
        defer { isBusy = false }
        do {
            let text = try await mcpService.readResource(selectedResourceURI)
            logText = "Resource (\(selectedResourceURI)):\n\(text)"
        } catch {
            logText = "Error: \(error.localizedDescription)"
        }
    }

    private func getTaskHistory() async {
        isBusy = true
        defer { isBusy = false }
        do {
            let tasks = try await mcpService.getTaskHistory(limit: 50)
            logText = "Task History:\n\(pretty(tasks))"
        } catch {
            logText = "Error: \(error.localizedDescription)"
        }
    }

    private func analyzeLastErrors() async {
        isBusy = true
        defer { isBusy = false }
        // For now, provide guidance for invoking the CLI that pushes errors into MCP
        logText = "Use the CLI: src/scripts/mcp-assisted-ts-fixer.ts to parse TS errors and save patterns via MCP."
    }

    private func saveOutputToMCP() async {
        isBusy = true
        defer { isBusy = false }
        do {
            try await mcpService.saveContext([
                "content": logText,
                "category": "debug_logs",
                "metadata": ["origin": "DebugConsoleView", "timestamp": Date().timeIntervalSince1970]
            ])
        } catch {
            logText += "\n\nSave failed: \(error.localizedDescription)"
        }
    }

    private func pretty(_ any: Any) -> String {
        guard JSONSerialization.isValidJSONObject(any),
              let data = try? JSONSerialization.data(withJSONObject: any, options: [.prettyPrinted]),
              let text = String(data: data, encoding: .utf8) else { return String(describing: any) }
        return text
    }
}

#Preview {
    DebugConsoleView().environmentObject(MCPService())
}
