import Foundation

private let fallbackHosts = [
    "http://localhost:8014", // unified evolutionary chat API (current primary)
    "http://localhost:8888", // python API (tts + misc)
    "http://localhost:8013", // legacy/alt backend
    "http://localhost:8080"  // gateway
]

private var cachedBase: URL?

/// Resolves API base URL with priority: ENV → Info.plist → cached → fallback
public func apiBaseURL() -> URL {
    if let u = cachedBase { return u }
    
    // Check environment variable
    if let s = ProcessInfo.processInfo.environment["API_BASE"], 
       let u = URL(string: s) {
        cachedBase = u
        return u
    }
    
    // Check Info.plist
    if let s = Bundle.main.infoDictionary?["API_BASE"] as? String,
       let u = URL(string: s) {
        cachedBase = u
        return u
    }
    
    // Default to first fallback
    cachedBase = URL(string: fallbackHosts[0])!
    return cachedBase!
}

/// Probe backends in background and switch to a healthy host
public func autodiscoverAPIBase(completion: @escaping (URL) -> Void) {
    let session = URLSession(configuration: .ephemeral)
    
    func probe(_ idx: Int) {
        guard idx < fallbackHosts.count else {
            // All failed, return current
            completion(apiBaseURL())
            return
        }
        
        let baseURL = URL(string: fallbackHosts[idx])!
        let healthURL = baseURL.appendingPathComponent("health")
        var req = URLRequest(url: healthURL)
        req.timeoutInterval = 2.0
        
        print("🔍 Probing backend: \(baseURL.absoluteString)")
        
        session.dataTask(with: req) { data, resp, error in
            if let http = resp as? HTTPURLResponse, (200..<400).contains(http.statusCode) {
                print("✅ Found healthy backend: \(baseURL.absoluteString)")
                cachedBase = baseURL
                DispatchQueue.main.async {
                    completion(baseURL)
                }
            } else {
                print("❌ Backend unhealthy: \(baseURL.absoluteString)")
                probe(idx + 1)
            }
        }.resume()
    }
    
    probe(0)
}

/// Reset cached base (for testing/reconnect)
public func resetAPIBaseCache() {
    cachedBase = nil
}
