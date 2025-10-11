import Foundation

/// Network event for diagnostics
public struct NetworkEvent {
    let method: String
    let url: String
    let statusCode: Int
    let duration: TimeInterval  // milliseconds
    let bytes: Int
    let timestamp: Date
    
    var isError: Bool {
        statusCode >= 400
    }
    
    var severityColor: String {
        if statusCode >= 500 { return "red" }
        if statusCode == 503 { return "yellow" }
        if statusCode == 422 { return "blue" }
        if statusCode >= 400 { return "orange" }
        return "green"
    }
}

/// URLProtocol subclass to intercept all network requests
final class InterceptingURLProtocol: URLProtocol {
    private var dataTask: URLSessionDataTask?
    private var startTime: CFAbsoluteTime = 0
    
    // Ring buffer for recent events (last 100)
    private static var recentEvents: [NetworkEvent] = []
    private static let maxEvents = 100
    private static let lock = NSLock()
    
    // Count recent error codes
    public static func recentErrorCounts() -> (e500: Int, e503: Int, e422: Int) {
        lock.lock()
        defer { lock.unlock() }
        
        let cutoff = Date().addingTimeInterval(-60) // Last 60 seconds
        let recent = recentEvents.filter { $0.timestamp > cutoff }
        
        let e500 = recent.filter { $0.statusCode >= 500 && $0.statusCode != 503 }.count
        let e503 = recent.filter { $0.statusCode == 503 }.count
        let e422 = recent.filter { $0.statusCode == 422 }.count
        
        return (e500, e503, e422)
    }
    
    public static func getRecentEvents(limit: Int = 20) -> [NetworkEvent] {
        lock.lock()
        defer { lock.unlock()}
        return Array(recentEvents.prefix(limit))
    }
    
    override class func canInit(with request: URLRequest) -> Bool {
        // Intercept all HTTP(S) requests
        return request.url?.scheme == "http" || request.url?.scheme == "https"
    }
    
    override class func canonicalRequest(for request: URLRequest) -> URLRequest {
        return request
    }
    
    override func startLoading() {
        startTime = CFAbsoluteTimeGetCurrent()
        
        let session = URLSession(configuration: .default)
        dataTask = session.dataTask(with: request) { [weak self] data, response, error in
            guard let self = self else { return }
            
            let duration = (CFAbsoluteTimeGetCurrent() - self.startTime) * 1000 // Convert to ms
            let statusCode = (response as? HTTPURLResponse)?.statusCode ?? -1
            let bytes = data?.count ?? 0
            
            // Record event
            let event = NetworkEvent(
                method: self.request.httpMethod ?? "GET",
                url: self.request.url?.absoluteString ?? "",
                statusCode: statusCode,
                duration: duration,
                bytes: bytes,
                timestamp: Date()
            )
            
            Self.lock.lock()
            Self.recentEvents.insert(event, at: 0)
            if Self.recentEvents.count > Self.maxEvents {
                Self.recentEvents.removeLast()
            }
            Self.lock.unlock()
            
            // Post notification for real-time monitoring
            NotificationCenter.default.post(
                name: .networkEventRecorded,
                object: nil,
                userInfo: [
                    "method": event.method,
                    "url": event.url,
                    "status": event.statusCode,
                    "duration": event.duration,
                    "bytes": event.bytes
                ]
            )
            
            // Forward to client
            if let error = error {
                self.client?.urlProtocol(self, didFailWithError: error)
            } else {
                if let response = response {
                    self.client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
                }
                if let data = data {
                    self.client?.urlProtocol(self, didLoad: data)
                }
                self.client?.urlProtocolDidFinishLoading(self)
            }
        }
        
        dataTask?.resume()
    }
    
    override func stopLoading() {
        dataTask?.cancel()
    }
}

/// Register network interceptor globally
public func registerNetworkInterceptor() {
    URLProtocol.registerClass(InterceptingURLProtocol.self)
    
    // Also configure default session to use it
    let config = URLSessionConfiguration.default
    config.protocolClasses = [InterceptingURLProtocol.self] + (config.protocolClasses ?? [])
}

extension Notification.Name {
    static let networkEventRecorded = Notification.Name("net:result")
}

