// CRITICAL_FIXES_REQUIRED.swift
// These fixes MUST be applied before the app can run safely

import Foundation

// MARK: - 1. Fix Force Unwrapped URLs

// ❌ CURRENT (WILL CRASH):
/*
let url = URL(string: "\(baseURL)/register")!
var request = URLRequest(url: url)
*/

// ✅ FIXED:
extension DeviceAuthenticationManager {
    private func createURL(endpoint: String) -> URL? {
        return URL(string: "\(baseURL)/\(endpoint)")
    }
    
    private func createRequest(endpoint: String, method: String = "POST") -> URLRequest? {
        guard let url = createURL(endpoint: endpoint) else {
            Task { @MainActor in
                await setError(.networkError(URLError(.badURL)))
            }
            return nil
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        if let token = _authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        return request
    }
}

// MARK: - 2. Fix WebSocket Memory Leak

// ❌ CURRENT (MEMORY LEAK):
/*
private func receiveWebSocketMessages() async {
    guard let webSocketTask = webSocketTask else { return }
    
    do {
        let message = try await webSocketTask.receive()
        // ... handle message ...
        
        // Continue listening - THIS CAUSES MEMORY LEAK!
        await receiveWebSocketMessages()
    } catch {
        print("WebSocket error: \(error)")
    }
}
*/

// ✅ FIXED:
extension DeviceAuthenticationManager {
    private var webSocketContinuation: CheckedContinuation<Void, Never>?
    private var isReceivingMessages = false
    
    private func receiveWebSocketMessages() async {
        guard let webSocketTask = webSocketTask,
              !isReceivingMessages else { return }
        
        isReceivingMessages = true
        
        while webSocketTask.state == .running {
            do {
                let message = try await webSocketTask.receive()
                
                switch message {
                case .string(let text):
                    await handleWebSocketMessage(text)
                case .data(let data):
                    if let text = String(data: data, encoding: .utf8) {
                        await handleWebSocketMessage(text)
                    }
                @unknown default:
                    break
                }
            } catch {
                print("WebSocket error: \(error)")
                isReceivingMessages = false
                break
            }
        }
        
        isReceivingMessages = false
    }
    
    func disconnectWebSocket() {
        webSocketTask?.cancel(with: .goingAway, reason: nil)
        webSocketTask = nil
        isReceivingMessages = false
    }
}

// MARK: - 3. Fix Thread Safety Issues

// ❌ CURRENT (CRASHES):
/*
DispatchQueue.main.async {
    self.currentProximity = .immediate // Can crash if called from background
}
*/

// ✅ FIXED:
extension ProximityDetectionService {
    @MainActor
    func updateProximityMainThread(to newState: ProximityState, rssi: Int) {
        self.currentProximity = newState
        self.rssiValue = rssi
        self.delegate?.proximityDidUpdate(newState, rssi: rssi)
    }
    
    func updateProximitySafely(to newState: ProximityState, rssi: Int) {
        Task { @MainActor in
            await updateProximityMainThread(to: newState, rssi: rssi)
        }
    }
}

// MARK: - 4. Add Proper Error Handling

// ✅ COMPREHENSIVE ERROR HANDLING:
extension DeviceAuthenticationManager {
    private func handleAPIError(_ error: Error) async {
        if let urlError = error as? URLError {
            switch urlError.code {
            case .notConnectedToInternet:
                await setError(.networkError(error))
            case .timedOut:
                await setError(.networkError(error))
            case .cannotFindHost:
                await setError(.networkError(error))
            default:
                await setError(.networkError(error))
            }
        } else {
            await setError(.networkError(error))
        }
    }
    
    private func withTimeout<T>(_ seconds: TimeInterval, operation: @escaping () async throws -> T) async throws -> T {
        return try await withThrowingTaskGroup(of: T.self) { group in
            group.addTask {
                return try await operation()
            }
            
            group.addTask {
                try await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
                throw URLError(.timedOut)
            }
            
            let result = try await group.next()!
            group.cancelAll()
            return result
        }
    }
}

// MARK: - 5. Fix Bluetooth Permission Checking

// ✅ PROPER PERMISSION HANDLING:
extension ProximityDetectionService {
    private func checkBluetoothPermissions() -> Bool {
        switch CBCentralManager.authorization {
        case .allowedAlways:
            return true
        case .denied, .restricted:
            delegate?.proximityDetectionDidFail(error: .bluetoothUnauthorized)
            return false
        case .notDetermined:
            // Will prompt for permission
            return true
        @unknown default:
            return false
        }
    }
    
    override func startProximityDetection() {
        guard checkBluetoothPermissions() else { return }
        guard bluetoothState == .poweredOn else {
            delegate?.proximityDetectionDidFail(error: .bluetoothUnavailable)
            return
        }
        
        // Continue with detection...
        super.startProximityDetection()
    }
}

// MARK: - 6. Secure Token Storage

// ✅ KEYCHAIN STORAGE:
import Security

extension DeviceAuthenticationManager {
    private enum KeychainKey: String {
        case authToken = "com.universalaitools.authToken"
        case deviceId = "com.universalaitools.deviceId"
        case privateKey = "com.universalaitools.privateKey"
    }
    
    private func saveToKeychain(key: KeychainKey, value: String) -> Bool {
        let data = value.data(using: .utf8)!
        
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key.rawValue,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        ]
        
        // Delete existing item
        SecItemDelete(query as CFDictionary)
        
        // Add new item
        let status = SecItemAdd(query as CFDictionary, nil)
        return status == errSecSuccess
    }
    
    private func loadFromKeychain(key: KeychainKey) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key.rawValue,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        
        var dataTypeRef: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &dataTypeRef)
        
        if status == errSecSuccess,
           let data = dataTypeRef as? Data,
           let value = String(data: data, encoding: .utf8) {
            return value
        }
        
        return nil
    }
}

// MARK: - 7. Add Network Reachability

import Network

class NetworkMonitor: ObservableObject {
    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "NetworkMonitor")
    
    @Published var isConnected = true
    @Published var connectionType = NWInterface.InterfaceType.other
    
    init() {
        monitor.pathUpdateHandler = { [weak self] path in
            DispatchQueue.main.async {
                self?.isConnected = path.status == .satisfied
                self?.connectionType = path.availableInterfaces.first?.type ?? .other
            }
        }
        
        monitor.start(queue: queue)
    }
    
    deinit {
        monitor.cancel()
    }
}

// MARK: - 8. Add Retry Logic

extension DeviceAuthenticationManager {
    private func retryableRequest<T>(
        maxAttempts: Int = 3,
        delay: TimeInterval = 1.0,
        operation: @escaping () async throws -> T
    ) async throws -> T {
        var lastError: Error?
        
        for attempt in 1...maxAttempts {
            do {
                return try await operation()
            } catch {
                lastError = error
                
                if attempt < maxAttempts {
                    try await Task.sleep(nanoseconds: UInt64(delay * Double(attempt) * 1_000_000_000))
                }
            }
        }
        
        throw lastError ?? URLError(.unknown)
    }
}

// MARK: - 9. Fix Memory Retain Cycles

// ✅ WEAK REFERENCES:
extension ProximityDetectionService {
    // Change delegate to weak
    weak var delegate: ProximityDetectionDelegate?
}

extension WatchConnectivityService {
    // Change delegate to weak
    weak var delegate: WatchConnectivityDelegate?
}

// MARK: - 10. Add Proper Deinitialization

extension DeviceAuthenticationManager {
    deinit {
        disconnectWebSocket()
        proximityService?.stopProximityDetection()
        // Clean up any other resources
    }
}