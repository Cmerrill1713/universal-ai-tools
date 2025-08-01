// Copy this EXACT code into ContentView.swift in Xcode

import SwiftUI

struct ContentView: View {
    @State private var serverStatus = "Not Connected"
    @State private var testResult = ""
    @State private var isLoading = false
    
    var body: some View {
        VStack(spacing: 30) {
            Text("AI Companion")
                .font(.largeTitle)
                .bold()
            
            // Status indicator
            HStack {
                Circle()
                    .fill(serverStatus == "Connected" ? Color.green : Color.red)
                    .frame(width: 12, height: 12)
                Text(serverStatus)
                    .foregroundColor(serverStatus == "Connected" ? .green : .red)
            }
            
            // Test button
            Button(action: testConnection) {
                if isLoading {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle())
                } else {
                    Text("Test Connection")
                }
            }
            .buttonStyle(.borderedProminent)
            .disabled(isLoading)
            
            // Results
            if !testResult.isEmpty {
                ScrollView {
                    Text(testResult)
                        .font(.system(.body, design: .monospaced))
                        .padding()
                }
                .frame(maxHeight: 300)
                .background(Color.gray.opacity(0.1))
                .cornerRadius(8)
            }
            
            Spacer()
            
            // Instructions
            VStack(alignment: .leading, spacing: 5) {
                Text("Setup Instructions:")
                    .font(.headline)
                Text("1. Run 'npm run dev' in terminal")
                Text("2. Find your IP: ifconfig | grep 'inet '")
                Text("3. Update IP in code (line 64)")
                Text("4. Make sure on same WiFi")
            }
            .font(.caption)
            .foregroundColor(.secondary)
            .padding()
            .background(Color.blue.opacity(0.1))
            .cornerRadius(8)
        }
        .padding()
    }
    
    func testConnection() {
        isLoading = true
        testResult = ""
        
        // CHANGE THIS: Replace XXX with your Mac's IP
        let urlString = "http://192.168.1.XXX:9999/api/v1/health"
        
        guard let url = URL(string: urlString) else {
            serverStatus = "Invalid URL"
            isLoading = false
            return
        }
        
        var request = URLRequest(url: url)
        request.timeoutInterval = 5
        
        URLSession.shared.dataTask(with: request) { data, response, error in
            DispatchQueue.main.async {
                isLoading = false
                
                if let error = error {
                    serverStatus = "Connection Failed"
                    testResult = """
                    Error: \(error.localizedDescription)
                    
                    Check:
                    ✓ Server running (npm run dev)
                    ✓ IP address is correct
                    ✓ Same WiFi network
                    ✓ Firewall disabled
                    
                    URL tried: \(urlString)
                    """
                } else if let httpResponse = response as? HTTPURLResponse {
                    if httpResponse.statusCode == 200 {
                        serverStatus = "Connected"
                        if let data = data,
                           let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                            testResult = """
                            ✅ Success!
                            
                            Server Response:
                            \(json.map { "\($0.key): \($0.value)" }.joined(separator: "\n"))
                            
                            Your Personality System is ready!
                            """
                        }
                    } else {
                        serverStatus = "Server Error"
                        testResult = "HTTP Status: \(httpResponse.statusCode)"
                    }
                }
            }
        }.resume()
    }
}

#Preview {
    ContentView()
}