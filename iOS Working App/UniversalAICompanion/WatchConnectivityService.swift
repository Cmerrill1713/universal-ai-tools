import Foundation
import WatchConnectivity

protocol WatchConnectivityDelegate: AnyObject {
    func watchDidConnect()
    func watchDidDisconnect()
    func watchAuthenticationStateChanged(_ state: AuthenticationState)
    func receivedMessageFromWatch(_ message: [String: Any])
}

class WatchConnectivityService: NSObject, WCSessionDelegate {
    private let session: WCSession?
    weak var delegate: WatchConnectivityDelegate?

    override init() {
        session = WCSession.isSupported() ? WCSession.default : nil
        super.init()

        session?.delegate = self
        session?.activate()
    }

    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        switch activationState {
        case .activated:
            delegate?.watchDidConnect()
        case .inactive:
            break
        case .notActivated:
            break
        @unknown default:
            break
        }
    }

    func sessionDidBecomeInactive(_ session: WCSession) {
        delegate?.watchDidDisconnect()
    }

    func sessionDidDeactivate(_ session: WCSession) {
        delegate?.watchDidDisconnect()
    }

    func session(_ session: WCSession, didReceiveMessage message: [String : Any]) {
        delegate?.receivedMessageFromWatch(message)
    }

    // iOS-specific method
    #if os(iOS)
    func sessionDidBecomeActive(_ session: WCSession) {
        delegate?.watchDidConnect()
    }
    #endif

    func sendAuthenticationState(_ state: AuthenticationState) {
        let stateString: String
        switch state {
        case .unauthenticated:
            stateString = "unauthenticated"
        case .authenticating:
            stateString = "authenticating"
        case .authenticated:
            stateString = "authenticated"
        case .locked:
            stateString = "locked"
        }

        session?.sendMessage(["type": "authState", "state": stateString], replyHandler: nil)
    }

    func sendDeviceRegistrationInfo(_ info: [String: Any]) {
        session?.sendMessage(["type": "deviceRegistration", "info": info], replyHandler: nil)
    }

    func requestWatchAuthentication() {
        session?.sendMessage(["type": "requestAuthentication"], replyHandler: nil)
    }

    func lockScreenOnWatch() {
        session?.sendMessage(["type": "lockScreen"], replyHandler: nil)
    }

    func unlockScreenOnWatch() {
        session?.sendMessage(["type": "unlockScreen"], replyHandler: nil)
    }
}
