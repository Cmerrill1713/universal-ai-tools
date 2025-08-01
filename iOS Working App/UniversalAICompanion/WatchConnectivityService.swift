import Foundation
import WatchConnectivity

protocol WatchConnectivityDelegate: AnyObject {
    func watchDidConnect()
    func watchDidDisconnect()
    func watchAuthenticationStateChanged(_ state: AuthenticationState)
    func receivedMessageFromWatch(_ message: [String: Any])
}

@MainActor
class WatchConnectivityService: NSObject, ObservableObject {
    
    // MARK: - Published Properties
    @Published var isWatchConnected: Bool = false
    @Published var isWatchReachable: Bool = false
    @Published var watchAppInstalled: Bool = false
    @Published var lastError: WatchError?
    
    // MARK: - Private Properties
    private var session: WCSession?
    weak var delegate: WatchConnectivityDelegate?
    private var messageQueue: [(message: [String: Any], completion: (() -> Void)?)] = []
    private var isProcessingQueue = false
    private var heartbeatTimer: Timer?
    
    // Message types for communication
    private enum MessageType: String {
        case authenticationState = "authenticationState"
        case proximityUpdate = "proximityUpdate"
        case lockScreen = "lockScreen"
        case unlockScreen = "unlockScreen"
        case deviceRegistration = "deviceRegistration"
        case healthData = "healthData"
        case heartbeat = "heartbeat"
    }
    
    // MARK: - Initialization
    override init() {
        super.init()
        setupWatchConnectivity()
    }
    
    deinit {
        heartbeatTimer?.invalidate()
        session?.delegate = nil
    }
    
    // MARK: - Public Methods
    
    func setupWatchConnectivity() {
        guard WCSession.isSupported() else {
            print("❌ WatchConnectivity not supported on this device")
            return
        }
        
        session = WCSession.default
        session?.delegate = self
        session?.activate()
        
        print("🔄 Activating WatchConnectivity session")
    }
    
    func sendAuthenticationState(_ state: AuthenticationState) {
        let message: [String: Any] = [
            "type": MessageType.authenticationState.rawValue,
            "state": stateToString(state),
            "timestamp": Date().timeIntervalSince1970
        ]
        
        queueMessage(message) { [weak self] in
            print("✅ Watch acknowledged authentication state")
        }
    }
    
    func sendProximityUpdate(proximity: ProximityState, rssi: Int) {
        guard let session = session, session.isReachable else { return }
        
        let message: [String: Any] = [
            "type": MessageType.proximityUpdate.rawValue,
            "proximity": proximity.rawValue,
            "rssi": rssi,
            "timestamp": Date().timeIntervalSince1970
        ]
        
        session.sendMessage(message, replyHandler: nil, errorHandler: { error in
            print("❌ Failed to send proximity update to watch: \(error)")
        })
    }
    
    func requestWatchAuthentication() {
        guard let session = session, session.isReachable else {
            lastError = .watchNotReachable
            return
        }
        
        let message: [String: Any] = [
            "type": "requestAuthentication",
            "timestamp": Date().timeIntervalSince1970
        ]
        
        session.sendMessage(message, replyHandler: { reply in
            print("✅ Watch authentication response: \(reply)")
            if let success = reply["success"] as? Bool, success {
                // Handle successful watch authentication
                self.delegate?.watchAuthenticationStateChanged(.authenticated)
            }
        }, errorHandler: { error in
            print("❌ Watch authentication request failed: \(error)")
            Task { @MainActor in
                self.lastError = .authenticationFailed(error)
            }
        })
    }
    
    func lockScreenOnWatch() {
        sendWatchCommand(.lockScreen)
    }
    
    func unlockScreenOnWatch() {
        sendWatchCommand(.unlockScreen)
    }
    
    func sendDeviceRegistrationInfo(_ info: [String: Any]) {
        guard let session = session else { return }
        
        let applicationContext: [String: Any] = [
            "type": MessageType.deviceRegistration.rawValue,
            "deviceInfo": info,
            "timestamp": Date().timeIntervalSince1970
        ]
        
        do {
            try session.updateApplicationContext(applicationContext)
            print("✅ Sent device registration info to watch")
        } catch {
            print("❌ Failed to send device registration to watch: \(error)")
            lastError = .contextUpdateFailed(error)
        }
    }
    
    // MARK: - Private Methods
    
    private func sendWatchCommand(_ command: MessageType) {
        guard let session = session, session.isReachable else { return }
        
        let message: [String: Any] = [
            "type": command.rawValue,
            "timestamp": Date().timeIntervalSince1970
        ]
        
        session.sendMessage(message, replyHandler: nil, errorHandler: { error in
            print("❌ Failed to send command \(command.rawValue) to watch: \(error)")
        })
    }
    
    private func stateToString(_ state: AuthenticationState) -> String {
        switch state {
        case .unauthenticated:
            return "unauthenticated"
        case .authenticating:
            return "authenticating"
        case .authenticated:
            return "authenticated"
        case .locked:
            return "locked"
        }
    }
    
    private func stringToState(_ string: String) -> AuthenticationState {
        switch string {
        case "unauthenticated":
            return .unauthenticated
        case "authenticating":
            return .authenticating
        case "authenticated":
            return .authenticated
        case "locked":
            return .locked
        default:
            return .unauthenticated
        }
    }
    
    private func handleWatchMessage(_ message: [String: Any]) {
        guard let type = message["type"] as? String else { return }
        
        switch type {
        case MessageType.authenticationState.rawValue:
            if let stateString = message["state"] as? String {
                let state = stringToState(stateString)
                delegate?.watchAuthenticationStateChanged(state)
            }
            
        case MessageType.heartbeat.rawValue:
            // Respond to watch heartbeat
            respondToHeartbeat()
            
        case "requestUnlock":
            // Watch is requesting to unlock the phone
            delegate?.receivedMessageFromWatch(message)
            
        case "biometricComplete":
            // Watch completed biometric authentication
            if let success = message["success"] as? Bool, success {
                delegate?.watchAuthenticationStateChanged(.authenticated)
            }
            
        case MessageType.healthData.rawValue:
            // Process health data from watch (heart rate, activity, etc.)
            processHealthData(message)
            
        default:
            print("🔄 Unknown message type from watch: \(type)")
            delegate?.receivedMessageFromWatch(message)
        }
    }
    
    private func respondToHeartbeat() {
        guard let session = session, session.isReachable else { return }
        
        let response: [String: Any] = [
            "type": "heartbeatResponse",
            "timestamp": Date().timeIntervalSince1970,
            "status": "alive"
        ]
        
        session.sendMessage(response, replyHandler: nil, errorHandler: nil)
    }
    
    private func processHealthData(_ message: [String: Any]) {
        guard let healthData = message["data"] as? [String: Any] else { return }
        
        // Extract health metrics that could be used for additional authentication
        if let heartRate = healthData["heartRate"] as? Double {
            print("❤️ Received heart rate from watch: \(heartRate) BPM")
            // Could be used for stress detection or biometric verification
        }
        
        if let steps = healthData["steps"] as? Int {
            print("👣 Received step count from watch: \(steps)")
            // Could be used for activity-based authentication
        }
        
        // Forward to delegate for processing
        delegate?.receivedMessageFromWatch(message)
    }
    
    // MARK: - Message Queue Management
    
    private func queueMessage(_ message: [String: Any], completion: (() -> Void)? = nil) {
        messageQueue.append((message: message, completion: completion))
        processMessageQueue()
    }
    
    private func processMessageQueue() {
        guard !isProcessingQueue,
              let session = session,
              session.isReachable,
              !messageQueue.isEmpty else { return }
        
        isProcessingQueue = true
        
        let item = messageQueue.removeFirst()
        
        session.sendMessage(item.message, replyHandler: { [weak self] reply in
            item.completion?()
            self?.isProcessingQueue = false
            self?.processMessageQueue() // Process next message
        }, errorHandler: { [weak self] error in
            print("❌ Failed to send message to watch: \(error)")
            self?.lastError = .messageFailed(error)
            self?.isProcessingQueue = false
            
            // Retry after delay
            DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
                self?.processMessageQueue()
            }
        })
    }
    
    // MARK: - Heartbeat Management
    
    private func startHeartbeat() {
        heartbeatTimer?.invalidate()
        
        heartbeatTimer = Timer.scheduledTimer(withTimeInterval: 30.0, repeats: true) { [weak self] _ in
            self?.sendHeartbeat()
        }
    }
    
    private func sendHeartbeat() {
        let message: [String: Any] = [
            "type": MessageType.heartbeat.rawValue,
            "timestamp": Date().timeIntervalSince1970
        ]
        
        queueMessage(message)
    }
}

// MARK: - WCSessionDelegate

extension WatchConnectivityService: @preconcurrency WCSessionDelegate {
    
    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        DispatchQueue.main.async {
            switch activationState {
            case .activated:
                print("✅ WatchConnectivity session activated")
                self.isWatchConnected = session.isPaired && session.isWatchAppInstalled
                self.watchAppInstalled = session.isWatchAppInstalled
                
                if self.isWatchConnected {
                    self.delegate?.watchDidConnect()
                }
                
            case .inactive:
                print("⚠️ WatchConnectivity session inactive")
                self.isWatchConnected = false
                
            case .notActivated:
                print("❌ WatchConnectivity session not activated")
                self.isWatchConnected = false
                
                if let error = error {
                    self.lastError = .activationFailed(error)
                }
                
            @unknown default:
                print("🔄 Unknown WatchConnectivity activation state")
            }
        }
    }
    
    func sessionDidBecomeInactive(_ session: WCSession) {
        print("⚠️ WatchConnectivity session became inactive")
        DispatchQueue.main.async {
            self.isWatchConnected = false
            self.delegate?.watchDidDisconnect()
        }
    }
    
    func sessionDidDeactivate(_ session: WCSession) {
        print("❌ WatchConnectivity session deactivated")
        DispatchQueue.main.async {
            self.isWatchConnected = false
            self.delegate?.watchDidDisconnect()
        }
        
        // Reactivate session for iOS
        session.activate()
    }
    
    func sessionWatchStateDidChange(_ session: WCSession) {
        DispatchQueue.main.async {
            self.isWatchConnected = session.isPaired && session.isWatchAppInstalled
            self.isWatchReachable = session.isReachable
            self.watchAppInstalled = session.isWatchAppInstalled
            
            print("🔄 Watch state changed - Connected: \(self.isWatchConnected), Reachable: \(self.isWatchReachable)")
            
            if self.isWatchConnected {
                self.delegate?.watchDidConnect()
            } else {
                self.delegate?.watchDidDisconnect()
            }
        }
    }
    
    func sessionReachabilityDidChange(_ session: WCSession) {
        DispatchQueue.main.async {
            self.isWatchReachable = session.isReachable
            print("📡 Watch reachability changed: \(self.isWatchReachable)")
        }
    }
    
    // MARK: - Message Handling
    
    func session(_ session: WCSession, didReceiveMessage message: [String : Any]) {
        DispatchQueue.main.async {
            self.handleWatchMessage(message)
        }
    }
    
    func session(_ session: WCSession, didReceiveMessage message: [String : Any], replyHandler: @escaping ([String : Any]) -> Void) {
        DispatchQueue.main.async {
            self.handleWatchMessage(message)
            
            // Send acknowledgment
            let reply: [String: Any] = [
                "received": true,
                "timestamp": Date().timeIntervalSince1970
            ]
            replyHandler(reply)
        }
    }
    
    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String : Any]) {
        DispatchQueue.main.async {
            print("📱 Received application context from watch: \(applicationContext)")
            self.delegate?.receivedMessageFromWatch(applicationContext)
        }
    }
    
    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String : Any] = [:]) {
        DispatchQueue.main.async {
            print("📱 Received user info from watch: \(userInfo)")
            self.delegate?.receivedMessageFromWatch(userInfo)
        }
    }
    
    // MARK: - File Transfer (for larger data)
    
    func session(_ session: WCSession, didReceive file: WCSessionFile) {
        print("📁 Received file from watch: \(file.fileURL)")
        // Handle file received from watch (logs, data exports, etc.)
    }
    
    func session(_ session: WCSession, didFinish fileTransfer: WCSessionFileTransfer, error: Error?) {
        if let error = error {
            print("❌ File transfer to watch failed: \(error)")
        } else {
            print("✅ File transfer to watch completed")
        }
    }
}

// MARK: - Supporting Types

enum WatchError: Error, LocalizedError {
    case watchNotReachable
    case activationFailed(Error)
    case messageFailed(Error)
    case contextUpdateFailed(Error)
    case authenticationFailed(Error)
    
    var errorDescription: String? {
        switch self {
        case .watchNotReachable:
            return "Apple Watch is not reachable"
        case .activationFailed(let error):
            return "Watch connectivity activation failed: \(error.localizedDescription)"
        case .messageFailed(let error):
            return "Failed to send message to watch: \(error.localizedDescription)"
        case .contextUpdateFailed(let error):
            return "Failed to update watch context: \(error.localizedDescription)"
        case .authenticationFailed(let error):
            return "Watch authentication failed: \(error.localizedDescription)"
        }
    }
}