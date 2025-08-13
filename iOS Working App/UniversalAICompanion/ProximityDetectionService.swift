import Foundation
import CoreBluetooth
import CoreLocation
import Combine

protocol ProximityDetectionDelegate: AnyObject {
    func proximityDidUpdate(_ proximity: ProximityState, rssi: Int)
    func proximityDetectionDidFail(error: ProximityError)
}

enum ProximityAlgorithmType {
    case simple
    case weighted
    case machinelearning
}

class AdvancedProximityDetectionService: NSObject, ObservableObject {
    @Published var currentProximity: ProximityState = .unknown
    @Published var confidenceScore: Double = 0.0

    private var proximityAlgorithm: ProximityAlgorithmType = .weighted
    private var rssiHistory: [(rssi: Int, timestamp: Date)] = []

    func detectProximity(rssiReadings: [Int]) -> ProximityState {
        switch proximityAlgorithm {
        case .simple:
            return simpleProximityDetection(rssiReadings)
        case .weighted:
            return weightedProximityDetection(rssiReadings)
        case .machinelearning:
            return mlBasedProximityDetection(rssiReadings)
        }
    }

    private func simpleProximityDetection(_ readings: [Int]) -> ProximityState {
        guard !readings.isEmpty else { return .unknown }

        let averageRSSI = readings.reduce(0, +) / readings.count

        switch averageRSSI {
        case Int.min..<(-75):
            return .far
        case -75..<(-50):
            return .near
        default:
            return averageRSSI >= -50 ? .immediate : .unknown
        }
    }

    private func weightedProximityDetection(_ readings: [Int]) -> ProximityState {
        guard !readings.isEmpty else { return .unknown }

        // More recent readings have higher weight
        let weightedAverage = readings.enumerated().reduce(0.0) { (result, element) in
            let (index, rssi) = element
            let weight = Double(readings.count - index) / Double(readings.count)
            return result + (Double(rssi) * weight)
        } / Double(readings.count)

        confidenceScore = calculateConfidenceScore(readings)

        switch weightedAverage {
        case Double(Int.min)..<(-75):
            return .far
        case -75..<(-50):
            return .near
        default:
            return weightedAverage >= -50 ? .immediate : .unknown
        }
    }

    private func mlBasedProximityDetection(_ readings: [Int]) -> ProximityState {
        // Placeholder for machine learning-based proximity detection
        // In a real implementation, this would use a trained ML model
        return weightedProximityDetection(readings)
    }

    private func calculateConfidenceScore(_ readings: [Int]) -> Double {
        guard readings.count > 1 else { return 0.0 }

        let standardDeviation = calculateStandardDeviation(readings)
        let consistencyFactor = 1.0 - (standardDeviation / 100.0)

        return min(max(consistencyFactor, 0.0), 1.0)
    }

    private func calculateStandardDeviation(_ numbers: [Int]) -> Double {
        let count = Double(numbers.count)
        let mean = Double(numbers.reduce(0, +)) / count
        let sumOfSquaredDifferences = numbers.map { pow(Double($0) - mean, 2.0) }.reduce(0, +)
        return sqrt(sumOfSquaredDifferences / count)
    }
}

@MainActor
class ProximityDetectionService: NSObject, ObservableObject {
    // MARK: - Published Properties
    @Published var currentProximity: ProximityState = .unknown
    @Published var rssiValue: Int = -100
    @Published var isScanning: Bool = false
    @Published var bluetoothState: CBManagerState = .unknown

    // MARK: - Constants
    enum Constants {
        static let scanInterval: TimeInterval = 2.0
        static let maxRSSIHistory = 5
        static let proximityChangeThreshold = 10
    }

    // MARK: - Private Properties
    var centralManager: CBCentralManager?
    var peripheralManager: CBPeripheralManager?
    var beaconRegion: CLBeaconRegion?
    var locationManager: CLLocationManager?

    // Delegate
    weak var delegate: ProximityDetectionDelegate?

    // Constants
    let serviceUUID = CBUUID(string: "12345678-1234-1234-1234-123456789ABC")
    let characteristicUUID = CBUUID(string: "87654321-4321-4321-4321-CBA987654321")
    let beaconUUID = UUID(uuidString: "E2C56DB5-DFFB-48D2-B060-D0F5A71096E0")!
    let beaconIdentifier = "UniversalAITools.Beacon"

    // Timer for periodic proximity updates
    private var proximityTimer: Timer?

    // MARK: - Initialization
    override init() {
        super.init()
        setupBluetoothCentral()
        setupBeaconRegion()
    }

    deinit {
        Task { await stopProximityDetectionAsync() }
    }

    // MARK: - Public Methods
    func startProximityDetection() {
        guard checkBluetoothPermissions() else { return }
        guard bluetoothState == .poweredOn else {
            delegate?.proximityDetectionDidFail(error: .bluetoothUnavailable)
            return
        }

        isScanning = true
        startBLEScanning()
        startBeaconMonitoring()
        startProximityTimer()

        print("🔵 Started proximity detection")
    }

    func stopProximityDetection() {
        isScanning = false
        centralManager?.stopScan()
        stopBeaconMonitoring()
        proximityTimer?.invalidate()
        proximityTimer = nil

        print("🔴 Stopped proximity detection")
    }

    nonisolated func stopProximityDetectionAsync() async {
        await MainActor.run { self.stopProximityDetection() }
    }

    // MARK: - Private Methods
    func setupBluetoothCentral() {
        centralManager = CBCentralManager(delegate: self, queue: nil)
    }

    func startBLEScanning() {
        guard let centralManager = centralManager, centralManager.state == .poweredOn else {
            return
        }

        let options: [String: Any] = [
            CBCentralManagerScanOptionAllowDuplicatesKey: true
        ]

        centralManager.scanForPeripherals(withServices: [serviceUUID], options: options)
        print("🔍 Started BLE scanning for Universal AI Tools devices")
    }

    private func startProximityTimer() {
        proximityTimer = Timer.scheduledTimer(withTimeInterval: 2.0, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.sendProximityUpdate() }
        }
    }

    private func sendProximityUpdate() {
        guard currentProximity != .unknown else { return }
        print("📍 Proximity: \(currentProximity.rawValue), RSSI: \(rssiValue)")
    }

    func calculateProximity(from rssi: Int) -> ProximityState {
        if rssi >= -50 { return .immediate }
        if rssi >= -70 { return .near }
        if rssi >= -90 { return .far }
        return .unknown
    }
}

// MARK: - Supporting Types
enum ProximityError: Error, LocalizedError {
    case bluetoothUnavailable
    case bluetoothUnauthorized
    case bluetoothUnsupported
    case locationUnauthorized
    case scanningFailed

    var errorDescription: String? {
        switch self {
        case .bluetoothUnavailable:
            return "Bluetooth is not available or powered off"
        case .bluetoothUnauthorized:
            return "Bluetooth access is not authorized"
        case .bluetoothUnsupported:
            return "Bluetooth is not supported on this device"
        case .locationUnauthorized:
            return "Location access is required for proximity detection"
        case .scanningFailed:
            return "Failed to start proximity scanning"
        }
    }
}
